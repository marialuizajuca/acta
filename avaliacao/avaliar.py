"""Mede o quanto a Acta acerta na cronologia, comparando com o gabarito de avaliacao/gabarito.json.

Uso (na pasta do projeto):
    python avaliacao/avaliar.py            # modo local, sem IA
    python avaliacao/avaliar.py --ia       # modo IA (precisa de chave no .env; custa centavos)

Gera avaliacao/resultado.md com a tabela que vai para o README.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from acta import assistant, llm  # noqa: E402
from acta.analyze import analyze_documents  # noqa: E402
from acta.extract import extract_upload  # noqa: E402

GOLD = json.loads((ROOT / "avaliacao" / "gabarito.json").read_text(encoding="utf-8"))


def load(names):
    return [{"name": n, "text": extract_upload(n, (ROOT / "samples" / n).read_bytes())} for n in names]


def evaluate_local(case):
    out = analyze_documents(load(case["arquivos"]), "cronologia")
    dates = {e["date"] for e in out["result"]["events"]}
    deadlines = {d["deadline"] for d in out["result"]["deadlines"]}
    divergences = [p for p in out["pending"] if p.startswith("Divergência")]
    return dates, deadlines, divergences, None


def evaluate_ai(case):
    docs = load(case["arquivos"])
    task = "Monte a cronologia do caso com todas as datas e prazos, indicando documento, página e trecho literal."
    approved = assistant.plan(task, "Cronologia processual", case["arquivos"])
    out = assistant.run(docs, task, approved)
    dates = {i["date"] for i in out["result"]["items"] if i.get("date")}
    deadlines = {d for d in case["prazos"] if any(d in i["text"] or d in (i.get("quote") or "") for i in out["result"]["items"])}
    return dates, deadlines, [], out["verification"]


def main():
    use_ai = "--ia" in sys.argv
    if use_ai and not llm.status()["available"]:
        llm.load_env(ROOT / ".env")
        if not llm.status()["available"]:
            sys.exit("Sem chave de IA. Configure o .env ou rode sem --ia.")
    rows, total_found, total_gold, total_extra = [], 0, 0, 0
    for case in GOLD["casos"]:
        dates, deadlines, divergences, verification = (evaluate_ai if use_ai else evaluate_local)(case)
        gold = {e["data"] for e in case["eventos"]}
        found = gold & dates
        extra = dates - gold
        missed = [e for e in case["eventos"] if e["data"] not in dates]
        total_found += len(found); total_gold += len(gold); total_extra += len(extra)
        rows.append({
            "caso": case["nome"], "encontrados": f"{len(found)}/{len(gold)}",
            "datas_sobrando": len(extra),
            "prazos": f"{len(set(case['prazos']) & deadlines)}/{len(case['prazos'])}",
            "divergencia": ("sim" if divergences else "não") if case["divergencias"] else "—",
            "faltou": "; ".join(f"{e['data']} ({e['descricao']})" for e in missed) or "nada",
            "sobrou": ", ".join(sorted(extra)) or "nada",
            "conferencia": f"{verification['confirmed']}/{verification['total']} trechos conferidos" if verification else "—",
        })
    mode = f"IA ({llm.status()['provider']} · {llm.status()['model']})" if use_ai else "local (sem IA)"
    lines = [f"# Avaliação da cronologia: modo {mode}", "",
             "| Caso | Eventos encontrados | Datas a mais | Prazos | Detectou a divergência de datas | Conferência de trechos |",
             "|---|---|---|---|---|---|"]
    for r in rows:
        lines.append(f"| {r['caso']} | {r['encontrados']} | {r['datas_sobrando']} | {r['prazos']} | {r['divergencia']} | {r['conferencia']} |")
    lines += ["", f"**Cobertura total:** {total_found} de {total_gold} eventos do gabarito ({100 * total_found / total_gold:.0f}%). "
                  f"**Datas que não estão no gabarito:** {total_extra}.", ""]
    for r in rows:
        lines.append(f"- **{r['caso']}**: faltou {r['faltou']}; datas a mais: {r['sobrou']}.")
    text = "\n".join(lines) + "\n"
    name = "resultado-ia.md" if use_ai else "resultado-local.md"
    (ROOT / "avaliacao" / name).write_text(text, encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
