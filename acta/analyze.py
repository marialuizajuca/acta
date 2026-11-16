"""Análise local (sem IA) dos documentos.

É o modo que funciona sempre, sem internet e sem chave de API: regras
determinísticas sobre o texto. Também é a reserva quando a IA está desligada
ou quando o advogado não autoriza o envio de dados para fora.
"""

import re
from collections import Counter, defaultdict
from datetime import datetime

from acta.text import boilerplate_lines, normalize, sentences, squash, title

MONTHS = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4, "maio": 5, "junho": 6,
    "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}
DATE_NUM = re.compile(r"\b([0-3]?\d)[/-]([01]?\d)[/-]((?:19|20)\d{2})\b")
DATE_TEXT = re.compile(r"\b([0-3]?\d)º?\s+de\s+([a-zç]+)\s+de\s+((?:19|20)\d{2})\b", re.I)
# "entre 22 e 29 de janeiro" ou "de 22 a 29 de janeiro de 2026"
DATE_RANGE = re.compile(r"\b(?:entre|de)\s+([0-3]?\d)\s+(?:e|a)\s+([0-3]?\d)\s+de\s+([a-zç]+)(?:\s+de\s+((?:19|20)\d{2}))?", re.I)
DEADLINE = re.compile(r"\b(?:em|no prazo de|prazo de)\s+(\d{1,3})\s+(dias(?:\s+úteis|\s+corridos)?|horas)\b", re.I)
MONEY = re.compile(r"R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?")
CNJ = re.compile(r"\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b")
CITED_DOCS = re.compile(r"documentos? (?:citados?|anexos?|juntados?)\s*:\s*((?:\b(?:Sr|Sra|Dr|Dra)\.|[^.])+)", re.I)
# "no dia 2 de setembro": data sem ano, completada pelo ano predominante do documento.
DATE_NOYEAR = re.compile(r"\b([0-3]?\d)º?\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b(?!\s+de\s+(?:19|20)\d{2})", re.I)
# Verbos de fatos que as partes costumam datar de forma diferente.
FACT_STEMS = ["pag", "entreg", "notific", "comunic", "dispens", "admit", "assin", "celebr", "rescind", "receb"]

DOC_TYPES = [
    # (palavra-chave, rótulo). A ordem importa: uma decisão costuma mencionar
    # a contestação, então "decisão" é testada antes de "contestação".
    ("ata de audiencia", "Ata de audiência"), ("ata-audiencia", "Ata de audiência"),
    ("sentenca", "Sentença"), ("decisao", "Decisão"), ("despacho", "Decisão"),
    ("acordao", "Acórdão"), ("contestacao", "Defesa"), ("defesa", "Defesa"),
    ("replica", "Réplica"), ("reclamacao", "Petição inicial"), ("peticao inicial", "Petição inicial"), ("inicial", "Petição inicial"),
    ("recurso", "Recurso"), ("apelacao", "Recurso"), ("contrato", "Contrato"),
]

SKILL_LABELS = {
    "relatorio": "Relatório ao cliente",
    "cronologia": "Cronologia processual",
    "comparacao": "Comparação das alegações",
    "organizacao": "Organização documental",
    "riscos": "Mapa de riscos",
}

CLAIM_WORDS = ["afirma", "sustenta", "alega", "pede", "pedido", "condenacao", "prejuizo", "celebraram", "ocorreu", "atraso", "requer"]
DEFENSE_WORDS = ["reconhece", "sustenta", "invoca", "afirma", "contesta", "alega", "improcedencia", "reducao", "nega", "impugna"]
ORDER_WORDS = ["designo", "fixo", "determino", "defiro", "indefiro", "deverao", "julgo", "condeno", "intimem"]


def short(text: str, limit: int = 230) -> str:
    text = squash(text)
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def classify(name: str, text: str) -> str:
    """Tipo do documento: primeiro pelo nome do arquivo, depois pelo título."""
    for candidate in (normalize(name), normalize(title(text)), normalize(text[:600])):
        for key, label in DOC_TYPES:
            if key in candidate:
                return label
    return "Documento geral"


def _prepare(documents: list[dict]) -> list[dict]:
    """Calcula uma vez, para cada documento, tipo e frases limpas."""
    boiler = boilerplate_lines(documents)
    prepared = []
    for doc in documents:
        prepared.append({
            **doc,
            "type": classify(doc["name"], doc["text"]),
            "title": title(doc["text"], boiler),
            "sentences": sentences(doc["text"], boiler),
        })
    return prepared


def _main_year(doc: dict) -> int | None:
    years = [int(m.group(3)) for s in doc["sentences"] for m in DATE_TEXT.finditer(s["text"])]
    years += [int(m.group(3)) for s in doc["sentences"] for m in DATE_NUM.finditer(s["text"])]
    return Counter(years).most_common(1)[0][0] if years else None


def _event(dt: datetime, text: str, doc: dict, page: int, **extra) -> dict:
    return {
        "date": dt.strftime("%d/%m/%Y"), "iso": dt.strftime("%Y-%m-%d"),
        "event": short(text), "source": doc["name"], "page": page, "doc_type": doc["type"], **extra,
    }


def _timeline(prepared: list[dict]) -> tuple[list[dict], list[dict]]:
    events, deadlines, seen = [], [], set()
    for doc in prepared:
        year = _main_year(doc)
        for s in doc["sentences"]:
            text, page = s["text"], s["page"]
            found = []
            for m in DATE_NUM.finditer(text):
                d, mo, y = map(int, m.groups())
                found.append((d, mo, y, {}))
            for m in DATE_TEXT.finditer(text):
                d, month, y = m.groups()
                mo = MONTHS.get(normalize(month))
                if mo:
                    found.append((int(d), mo, int(y), {}))
            for m in DATE_RANGE.finditer(text):
                d1, d2, month, y = m.groups()
                mo = MONTHS.get(normalize(month))
                if not mo or (not y and not year):
                    continue
                extra = {"end_date": f"{int(d2):02d}/{mo:02d}/{int(y or year)}"}
                if not y:
                    extra["note"] = "ano não escrito no trecho; inferido pelas outras datas do documento"
                found.append((int(d1), mo, int(y or year), extra))
            ranges = [m.span() for m in DATE_RANGE.finditer(text)]
            for m in DATE_NOYEAR.finditer(text):
                if not year or any(a <= m.start() < b for a, b in ranges):
                    continue
                mo = MONTHS.get(normalize(m.group(2)))
                found.append((int(m.group(1)), mo, year, {"note": "ano não escrito no trecho; inferido pelas outras datas do documento"}))
            for d, mo, y, extra in found:
                try:
                    dt = datetime(y, mo, d)
                except ValueError:
                    continue
                key = (dt.date(), doc["name"], text[:80])
                if key in seen:
                    continue
                seen.add(key)
                events.append(_event(dt, text, doc, page, **extra))
            for m in DEADLINE.finditer(text):
                deadlines.append({
                    "deadline": f"{m.group(1)} {m.group(2)}", "event": short(text),
                    "source": doc["name"], "page": page,
                    "note": "o documento não diz a partir de quando o prazo corre; conferir a intimação",
                })
    events.sort(key=lambda e: (e["iso"], e["source"]))
    return events, deadlines


def extract_dates(documents: list[dict]) -> list[dict]:
    """Eventos com data, em ordem cronológica, cada um com documento e página."""
    return _timeline(_prepare(documents))[0]


def _fact_dates(doc: dict) -> dict[str, set[str]]:
    """Para cada verbo de fato (pagar, entregar...), a data escrita logo depois dele."""
    out: dict[str, set[str]] = defaultdict(set)
    for s in doc["sentences"]:
        text = normalize(s["text"])
        for stem in FACT_STEMS:
            for verb in re.finditer(rf"\b{stem}\w*", text):
                window = text[verb.end(): verb.end() + 40]
                m = DATE_TEXT.search(window) or DATE_NUM.search(window)
                if not m:
                    continue
                d, mo, y = m.groups()
                mo = MONTHS.get(mo, None) if not mo.isdigit() else int(mo)
                if mo:
                    out[stem].add(f"{int(d):02d}/{int(mo):02d}/{y}")
    return out


def divergences(prepared: list[dict]) -> list[str]:
    """Mesmo fato, datas diferentes na inicial e na defesa: o ponto que mais pesa na prova."""
    petition = next((d for d in prepared if d["type"] == "Petição inicial"), None)
    defense = next((d for d in prepared if d["type"] == "Defesa"), None)
    if not petition or not defense:
        return []
    a, b = _fact_dates(petition), _fact_dates(defense)
    found = []
    for stem in FACT_STEMS:
        if a.get(stem) and b.get(stem) and not (a[stem] & b[stem]):
            found.append(
                f"Divergência de data: para o fato \"{stem}…\", a inicial indica {', '.join(sorted(a[stem]))} "
                f"e a defesa indica {', '.join(sorted(b[stem]))}. Conferir a prova documental."
            )
    return found


def _pending_from_timeline(events: list[dict], deadlines: list[dict], prepared: list[dict]) -> list[str]:
    pending = divergences(prepared)
    by_date = defaultdict(set)
    for e in events:
        by_date[e["date"]].add(e["doc_type"])
    for date, types in by_date.items():
        if "Petição inicial" in types and "Defesa" in types:
            pending.append(f"{date}: a data aparece na inicial e na defesa. Verificar se o fato é incontroverso.")
    for e in events:
        if e.get("note"):
            pending.append(f"{e['date']}: {e['note']} ({e['source']}, p. {e['page']}).")
    for d in deadlines:
        pending.append(f"Prazo de {d['deadline']} ({d['source']}, p. {d['page']}): {d['note']}.")
    for doc in prepared:
        for s in doc["sentences"]:
            m = CITED_DOCS.search(s["text"])
            if m:
                pending.append(f"{doc['name']} cita documentos que não foram enviados à Acta: {squash(m.group(1))}.")
    return pending


def build_plan(task: str, skill: str) -> dict:
    label = SKILL_LABELS.get(skill, "Ferramenta personalizada")
    return {
        "title": label,
        "objective": task or "Transformar os documentos em uma saída jurídica conferível.",
        "steps": [
            "Ler somente os arquivos autorizados.",
            "Remover cabeçalhos repetidos e reconstruir as frases quebradas pelo PDF.",
            "Classificar cada documento (inicial, defesa, decisão…).",
            "Identificar fatos, datas, prazos, valores e posições das partes.",
            f"Construir: {label}.",
            "Ligar cada informação ao arquivo e à página de origem.",
            "Listar o que o advogado ainda precisa conferir.",
        ],
        "permissions": ["Ler arquivos selecionados", "Criar resultado para download"],
        "blocked": ["Editar arquivos originais", "Enviar dados para fora"],
        "tests": ["Resultado não vazio", "Fontes identificadas", "Originais preservados"],
        "questions": [],
        "mode": "local",
    }


def document_summary(doc: dict) -> dict:
    sents = [s["text"] for s in doc["sentences"]]
    keys = CLAIM_WORDS + DEFENSE_WORDS + ORDER_WORDS + ["decide", "contrato"]
    chosen = next((s for s in sents if any(k in normalize(s) for k in keys)), sents[0] if sents else "")
    process = CNJ.search(doc["text"])
    pages = doc["text"].count("⟦p. ") or 1
    return {
        "name": doc["name"], "type": doc["type"], "title": doc["title"], "summary": short(chosen),
        "process": process.group(0) if process else None, "pages": pages, "characters": len(doc["text"]),
    }


def _amounts(prepared: list[dict]) -> list[str]:
    found = []
    for doc in prepared:
        for s in doc["sentences"]:
            found.extend(squash(m.group(0)).replace("R$", "R$ ").replace("  ", " ") for m in MONEY.finditer(s["text"]))
    return list(dict.fromkeys(found))


def _pick(doc: dict | None, words: list[str], limit: int) -> list[dict]:
    if not doc:
        return []
    chosen = [s for s in doc["sentences"] if any(w in normalize(s["text"]) for w in words)]
    return chosen[:limit]


def _controverted_points(prepared: list[dict]) -> list[str]:
    for doc in prepared:
        for s in doc["sentences"]:
            m = re.search(r"pontos controvertidos\s*:\s*(.+)", s["text"], re.I)
            if m:
                parts = re.split(r",\s*(?:e\s+)?|\s+e\s+(?=a |o |as |os )", m.group(1).rstrip("."))
                return [p.strip() for p in parts if len(p.strip()) > 3]
    return []


def report_client(prepared: list[dict], events: list[dict], pending: list[str]) -> dict:
    summaries = [document_summary(d) for d in prepared]
    types = Counter(s["type"] for s in summaries)
    status_doc = next((d for d in reversed(prepared) if d["type"] in ("Decisão", "Sentença", "Acórdão", "Ata de audiência")), None)
    orders = _pick(status_doc, ORDER_WORDS, 3)
    status = " ".join(s["text"] for s in orders) if orders else "Nenhuma decisão entre os documentos enviados."
    return {
        "title": "Relatório ao cliente",
        "summary": f"Foram lidos {len(prepared)} documentos: "
                   + ", ".join(f"{n} do tipo {t.lower()}" for t, n in types.items()) + ".",
        "current_status": short(status, 420),
        "status_source": f"{status_doc['name']}, p. {orders[0]['page']}" if orders else None,
        "amounts": _amounts(prepared),
        "next_event": events[-1] if events else None,
        "controverted": _controverted_points(prepared),
        "attention": [
            "Validar valores, datas e prazos nos originais antes de enviar ao cliente.",
            "Revisar as conclusões jurídicas: a Acta não substitui o advogado.",
        ],
        "documents": summaries,
    }


def compare_claims(prepared: list[dict]) -> dict:
    petition = next((d for d in prepared if d["type"] == "Petição inicial"), prepared[0])
    defense = next((d for d in prepared if d["type"] == "Defesa"), prepared[-1])
    fmt = lambda doc, items: [{"text": short(s["text"]), "source": doc["name"], "page": s["page"]} for s in items]
    left = fmt(petition, _pick(petition, CLAIM_WORDS, 6))
    right = fmt(defense, _pick(defense, DEFENSE_WORDS, 6))
    return {
        "title": "Comparação das alegações",
        "columns": [f"Parte autora ({petition['name']})", f"Parte ré ({defense['name']})"],
        "left": left, "right": right,
        "controverted": _controverted_points(prepared),
        "sources": [petition["name"], defense["name"]],
    }


def risk_map(prepared: list[dict], events: list[dict], deadlines: list[dict]) -> dict:
    items = [
        {"risk": f"Ponto controvertido: {p}", "level": "alto",
         "action": "Fixado pelo juízo: separar as provas que sustentam a versão do cliente sobre este ponto."}
        for p in _controverted_points(prepared)
    ]
    corpus = normalize(" ".join(s["text"] for d in prepared for s in d["sentences"]))
    if deadlines:
        items.append({"risk": "Prazo em curso", "level": "alto",
                      "action": f"Há {len(deadlines)} prazo(s) nos documentos sem termo inicial explícito. Conferir a intimação."})
    if "forca maior" in corpus or "caso fortuito" in corpus:
        items.append({"risk": "Excludente de responsabilidade alegada", "level": "alto",
                      "action": "A defesa invoca força maior ou caso fortuito: avaliar a prova do evento e da sua inevitabilidade."})
    if MONEY.search(corpus.replace("r$", "R$")):
        items.append({"risk": "Valores pedidos", "level": "médio",
                      "action": "Validar cálculos, comprovantes e a relação de cada valor com o dano alegado."})
    if not items:
        items.append({"risk": "Divergência entre as partes", "level": "médio",
                      "action": "Comparar as versões e destacar os pontos controvertidos."})
    return {"title": "Mapa de riscos", "items": items}


def analyze_documents(documents: list[dict], skill: str, task: str = "", system_prompt: str = "") -> dict:
    prepared = _prepare(documents)
    events, deadlines = _timeline(prepared)
    pending = _pending_from_timeline(events, deadlines, prepared)
    base = {
        "skill": skill, "task": task, "mode": "local",
        "system_prompt_applied": bool(system_prompt.strip()),
        "document_count": len(documents), "sources": [d["name"] for d in documents],
        "checks": ["Arquivos lidos", "Fontes indicadas com página", "Originais não alterados", "Nenhum dado enviado para fora"],
        "pending": pending,
    }
    if skill == "cronologia":
        base["result"] = {"title": "Cronologia processual", "events": events, "deadlines": deadlines}
    elif skill == "comparacao":
        base["result"] = compare_claims(prepared)
    elif skill == "organizacao":
        base["result"] = {"title": "Organização documental", "documents": [document_summary(d) for d in prepared]}
    elif skill == "riscos":
        base["result"] = risk_map(prepared, events, deadlines)
    else:
        base["result"] = report_client(prepared, events, pending)
    return base
