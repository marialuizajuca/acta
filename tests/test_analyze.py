from acta.analyze import analyze_documents, build_plan, classify, extract_dates


DOCS = [
    {"name": "peticao-inicial.txt", "text": "PETIÇÃO INICIAL. Em 10/01/2026 foi celebrado contrato. A autora pede R$ 48.000,00. A entrega ocorreu em 18/02/2026."},
    {"name": "contestacao.txt", "text": "CONTESTAÇÃO. A ré alega força maior em 22 de janeiro de 2026 e contesta o prejuízo."},
]


def test_classification():
    assert classify(DOCS[0]["name"], DOCS[0]["text"]) == "Petição inicial"
    assert classify(DOCS[1]["name"], DOCS[1]["text"]) == "Defesa"


def test_timeline_orders_dates():
    events = extract_dates(DOCS)
    assert [event["date"] for event in events] == ["10/01/2026", "22/01/2026", "18/02/2026"]
    assert all(event["source"] for event in events)


def test_plan_requires_approval_elements():
    plan = build_plan("Monte a cronologia", "cronologia")
    assert plan["steps"]
    assert "Ler arquivos selecionados" in plan["permissions"]
    assert "Enviar dados para fora" in plan["blocked"]


def test_report_is_generated():
    output = analyze_documents(DOCS, "relatorio", "Explique ao cliente")
    assert output["result"]["title"] == "Relatório ao cliente"
    assert "R$ 48.000,00" in output["result"]["amounts"]

