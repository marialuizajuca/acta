"""Modo IA da Acta: plano, execução e conferência automática.

Fluxo, na ordem:
1. plan()     a IA propõe o plano; nada é executado.
2. run()      depois do "sim" do advogado:
              a. a trava de sigilo troca nomes e documentos por códigos;
              b. só então o texto vai para a IA, com o plano aprovado;
              c. cada afirmação devolvida é conferida contra o documento original;
              d. os nomes reais voltam ao resultado, que nunca saiu do computador.
"""

import json
import re
from datetime import datetime

from acta import llm
from acta.analyze import MONTHS
from acta.anonymize import anonymize
from acta.prompts import ACTA_RULES, PLAN_FORMAT, RUN_FORMAT
from acta.text import normalize, plain

MAX_CHARS_PER_DOC = 60_000


def _system(extra: str) -> str:
    extra = (extra or "").strip()
    if not extra:
        return ACTA_RULES
    return ACTA_RULES + "\n\nPreferências do escritório (valem desde que não contrariem as regras acima):\n" + extra


def plan(task: str, skill_label: str, doc_names: list[str], system_prompt: str = "", saved_steps: list[str] | None = None) -> dict:
    user = (
        f"Tarefa pedida pelo advogado: {task or skill_label}\n"
        f"Tipo de ferramenta escolhida: {skill_label}\n"
        f"Arquivos que serão lidos: {', '.join(doc_names) or 'ainda não enviados'}\n"
    )
    if saved_steps:
        user += "Esta é uma skill salva. Reaproveite estes passos, ajustando só se necessário:\n- " + "\n- ".join(saved_steps) + "\n"
    data = llm.complete_json(_system(system_prompt), user + "\n" + PLAN_FORMAT, max_tokens=1500)
    return {
        "title": str(data.get("title") or skill_label),
        "objective": str(data.get("objective") or task),
        "steps": [str(s) for s in data.get("steps", [])][:10],
        "tests": [str(s) for s in data.get("tests", [])][:8],
        "questions": [str(s) for s in data.get("questions", []) if str(s).strip()][:5],
        "permissions": ["Ler arquivos selecionados", "Enviar à IA o texto já anonimizado", "Criar resultado para download"],
        "blocked": ["Editar arquivos originais", "Enviar nomes, CPFs ou CNPJs sem anonimização", "Protocolar ou enviar e-mail"],
        "mode": "ia",
    }


def _squash_for_match(value: str) -> str:
    value = normalize(value)
    value = re.sub(r"[“”\"'«»]", "", value)
    return re.sub(r"\s+", " ", value).strip(" .;,:")


def _date_in_quote(date: str, quote: str) -> bool:
    try:
        dt = datetime.strptime(date, "%d/%m/%Y")
    except ValueError:
        return False
    q = normalize(quote)
    month = next((name for name, n in MONTHS.items() if n == dt.month), "")
    patterns = [
        dt.strftime("%d/%m/%Y"), f"{dt.day}/{dt.month}/{dt.year}", dt.strftime("%d/%m"),
        f"{dt.day} de {month}", f"{dt.day:02d} de {month}", f"{dt.day}º de {month}",
    ]
    if any(p in q for p in patterns):
        return True
    # Intervalos como "entre 22 e 29 de janeiro": o dia e o mês aparecem separados.
    return bool(month and month in q and re.search(rf"(?<!\d){dt.day}(?!\d)", q))


def verify(items: list[dict], documents: dict[str, str]) -> list[dict]:
    """Confere cada afirmação contra o texto do documento citado.

    Status possíveis:
      conferido            o trecho existe, literalmente, no arquivo citado
      outro arquivo        o trecho existe, mas em outro arquivo
      não localizado       o trecho não existe em nenhum documento
      sem trecho           a IA não indicou trecho
    """
    corpus = {name: _squash_for_match(plain(text)) for name, text in documents.items()}
    checked = []
    for item in items:
        quote = str(item.get("quote") or "").strip()
        source = str(item.get("source") or "").strip()
        status = "sem trecho"
        if quote:
            needle = _squash_for_match(quote)
            if source in corpus and needle in corpus[source]:
                status = "conferido"
            elif any(needle in text for text in corpus.values()):
                status = "outro arquivo"
                source = next(n for n, t in corpus.items() if needle in t)
            else:
                status = "não localizado"
        date = str(item.get("date") or "").strip()
        date_ok = None
        if date and status in ("conferido", "outro arquivo"):
            date_ok = _date_in_quote(date, quote)
        checked.append({**item, "source": source, "date": date, "status": status, "date_in_quote": date_ok})
    return checked


def run(documents: list[dict], task: str, approved_plan: dict, system_prompt: str = "") -> dict:
    texts = [plain(d["text"])[:MAX_CHARS_PER_DOC] for d in documents]
    anon = anonymize(texts)
    names = [d["name"] for d in documents]
    body = "\n\n".join(
        f"===== ARQUIVO: {name} =====\n{text}" for name, text in zip(names, anon.texts)
    )
    plan_text = json.dumps({k: approved_plan.get(k) for k in ("title", "objective", "steps", "tests")}, ensure_ascii=False)
    user = f"Tarefa: {task}\nPlano aprovado pelo advogado: {plan_text}\n\nDOCUMENTOS:\n{body}\n\n{RUN_FORMAT}"
    data = llm.complete_json(_system(system_prompt), user, max_tokens=6000)

    items = data.get("items") if isinstance(data.get("items"), list) else []
    items = [i for i in items if isinstance(i, dict)]
    # A conferência roda sobre o texto anonimizado, que é exatamente o que a IA leu.
    checked = verify(items, dict(zip(names, anon.texts)))
    pending = [str(p) for p in data.get("pending", []) if str(p).strip()]
    problems = [i for i in checked if i["status"] in ("não localizado", "sem trecho")]
    if problems:
        pending.insert(0, f"{len(problems)} afirmação(ões) da IA sem trecho localizado nos documentos: revisar antes de usar.")
    wrong_dates = [i for i in checked if i["date_in_quote"] is False]
    if wrong_dates:
        pending.insert(0, f"{len(wrong_dates)} data(s) não aparecem no trecho citado: conferir no original.")

    result = {
        "title": str(data.get("title") or approved_plan.get("title") or "Resultado"),
        "summary": str(data.get("summary") or ""),
        "items": checked,
    }
    sent_preview = body[:3000]
    return {
        "result": anon.restore(result),
        "pending": anon.restore(pending),
        "anonymization": {
            "replaced": [{"code": f["code"], "kind": f["kind"], "occurrences": f["occurrences"]} for f in anon.found],
            "sent_preview": sent_preview,
            "sent_characters": len(body),
        },
        "verification": {
            "total": len(checked),
            "confirmed": sum(i["status"] == "conferido" for i in checked),
            "other_file": sum(i["status"] == "outro arquivo" for i in checked),
            "not_found": len(problems),
        },
    }
