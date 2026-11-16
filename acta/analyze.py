import re
import unicodedata
from collections import Counter
from datetime import datetime


MONTHS = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4, "maio": 5,
    "junho": 6, "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10,
    "novembro": 11, "dezembro": 12,
}
DATE_NUM = re.compile(r"\b([0-3]?\d)[/-]([01]?\d)[/-]((?:19|20)\d{2})\b")
DATE_TEXT = re.compile(r"\b([0-3]?\d)\s+de\s+([a-zç]+)\s+de\s+((?:19|20)\d{2})\b", re.I)
MONEY = re.compile(r"R\$\s*[\d.]+(?:,\d{2})?")


def normalize(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", value.lower()) if unicodedata.category(c) != "Mn")


def classify(name: str, text: str) -> str:
    sample = normalize(name + " " + text[:1200])
    for key, label in [
        ("contestacao", "Defesa"), ("peticao inicial", "Petição inicial"),
        ("decisao", "Decisão"), ("sentenca", "Sentença"),
        ("contrato", "Contrato"), ("recurso", "Recurso"),
    ]:
        if key in sample:
            return label
    return "Documento geral"


def sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [p.strip() for p in parts if len(p.strip()) >= 25]


def short(text: str, limit: int = 190) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def extract_dates(documents: list[dict]) -> list[dict]:
    events = []
    seen = set()
    for doc in documents:
        for sentence in sentences(doc["text"]):
            matches = []
            for m in DATE_NUM.finditer(sentence):
                d, mo, y = map(int, m.groups())
                try: matches.append((datetime(y, mo, d), m.group(0)))
                except ValueError: pass
            for m in DATE_TEXT.finditer(sentence):
                d, month, y = m.groups(); mo = MONTHS.get(normalize(month))
                if mo:
                    try: matches.append((datetime(int(y), mo, int(d)), m.group(0)))
                    except ValueError: pass
            for dt, raw in matches:
                key = (dt.date(), doc["name"], sentence[:90])
                if key in seen: continue
                seen.add(key)
                events.append({"date": dt.strftime("%d/%m/%Y"), "iso": dt.strftime("%Y-%m-%d"), "event": short(sentence), "source": doc["name"]})
    return sorted(events, key=lambda x: x["iso"])


def build_plan(task: str, skill: str) -> dict:
    labels = {"relatorio": "Relatório ao cliente", "cronologia": "Cronologia processual", "comparacao": "Comparação das alegações", "organizacao": "Organização documental", "riscos": "Mapa de riscos"}
    return {
        "title": labels.get(skill, "Ferramenta personalizada"),
        "objective": task or "Transformar os documentos em uma saída jurídica conferível.",
        "steps": [
            "Ler somente os arquivos autorizados.",
            "Classificar os documentos e extrair o texto.",
            "Identificar fatos, datas, valores e posições das partes.",
            f"Construir: {labels.get(skill, 'resultado personalizado')}.",
            "Relacionar as informações aos arquivos de origem.",
            "Aplicar critérios de conferência e apresentar o resultado.",
        ],
        "permissions": ["Ler arquivos selecionados", "Criar resultado para download"],
        "blocked": ["Editar arquivos originais", "Enviar dados para fora"],
        "tests": ["Resultado não vazio", "Fontes identificadas", "Originais preservados"],
    }


def document_summary(doc: dict) -> dict:
    sents = sentences(doc["text"])
    chosen = next((s for s in sents if any(k in normalize(s) for k in ["alega", "pede", "decide", "contrato", "conden"])), sents[0] if sents else doc["text"])
    return {"name": doc["name"], "type": classify(doc["name"], doc["text"]), "summary": short(chosen), "characters": len(doc["text"])}


def report_client(documents: list[dict], timeline: list[dict]) -> dict:
    summaries = [document_summary(d) for d in documents]
    values = []
    for d in documents: values.extend(MONEY.findall(d["text"]))
    types = Counter(s["type"] for s in summaries)
    status = "Há " + ", ".join(f"{n} documento(s) do tipo {t.lower()}" for t, n in types.items()) + "."
    next_event = timeline[-1] if timeline else None
    return {
        "title": "Relatório ao cliente",
        "summary": f"Foram lidos {len(documents)} documentos. {status}",
        "current_status": short(summaries[-1]["summary"] if summaries else "Não identificado."),
        "amounts": sorted(set(values))[:8],
        "next_event": next_event,
        "attention": [
            "Conferir se os fatos descritos aparecem nos documentos originais.",
            "Validar valores, datas e prazos antes de enviar ao cliente.",
            "Revisar as conclusões jurídicas: a Acta não substitui o advogado.",
        ],
        "documents": summaries,
    }


def compare_claims(documents: list[dict]) -> dict:
    petition = next((d for d in documents if classify(d["name"], d["text"]) == "Petição inicial"), documents[0])
    defense = next((d for d in documents if classify(d["name"], d["text"]) == "Defesa"), documents[-1])
    return {
        "title": "Comparação das alegações",
        "columns": ["Documento da parte autora", "Documento da parte ré"],
        "left": [short(s) for s in sentences(petition["text"])[:5]],
        "right": [short(s) for s in sentences(defense["text"])[:5]],
        "sources": [petition["name"], defense["name"]],
    }


def risk_map(documents: list[dict]) -> dict:
    corpus = normalize(" ".join(d["text"] for d in documents))
    rules = [
        ("Prova dos fatos", "alto" if "prova" in corpus else "médio", "Verificar documentos e elementos que sustentam as alegações."),
        ("Prazos e datas", "alto" if len(extract_dates(documents)) >= 3 else "médio", "Conferir a sequência temporal e eventuais prazos futuros."),
        ("Valores", "médio" if MONEY.search(" ".join(d["text"] for d in documents)) else "baixo", "Validar cálculos, comprovantes e relação com o dano alegado."),
        ("Divergência entre partes", "alto" if len(documents) >= 2 else "médio", "Comparar versões e destacar pontos controvertidos."),
    ]
    return {"title": "Mapa de riscos", "items": [{"risk": a, "level": b, "action": c} for a, b, c in rules]}


def analyze_documents(documents: list[dict], skill: str, task: str = "", system_prompt: str = "") -> dict:
    timeline = extract_dates(documents)
    base = {
        "skill": skill, "task": task, "system_prompt_applied": bool(system_prompt.strip()),
        "document_count": len(documents), "sources": [d["name"] for d in documents],
        "checks": ["Arquivos lidos", "Fontes preservadas", "Originais não alterados"],
    }
    if skill == "cronologia": base["result"] = {"title": "Cronologia processual", "events": timeline}
    elif skill == "comparacao": base["result"] = compare_claims(documents)
    elif skill == "organizacao": base["result"] = {"title": "Organização documental", "documents": [document_summary(d) for d in documents]}
    elif skill == "riscos": base["result"] = risk_map(documents)
    else: base["result"] = report_client(documents, timeline)
    return base

