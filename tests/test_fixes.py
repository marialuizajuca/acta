"""Testes das correções feitas sobre o caso Aurora × Delta da pasta samples/."""
from pathlib import Path

import pytest

from acta.analyze import analyze_documents, classify, extract_dates
from acta.extract import extract_upload

SAMPLES = Path(__file__).resolve().parent.parent / "samples"
NAMES = ["01-peticao-inicial-ficticia.pdf", "02-contestacao-ficticia.pdf", "03-decisao-ficticia.pdf"]


@pytest.fixture(scope="module")
def docs():
    return [{"name": n, "text": extract_upload(n, (SAMPLES / n).read_bytes())} for n in NAMES]


def test_decision_is_not_classified_as_defense(docs):
    # A decisão menciona a contestação; antes ela era classificada como "Defesa".
    assert classify(docs[2]["name"], docs[2]["text"]) == "Decisão"


def test_events_are_full_sentences(docs):
    # Antes apareciam pedaços como "eletrônicos até 31 de janeiro de 2026."
    for event in extract_dates(docs):
        assert event["event"][0].isupper(), event["event"]
        assert event["page"] == 1


def test_flood_period_without_year_is_found(docs):
    events = extract_dates(docs)
    flood = [e for e in events if "enchentes" in e["event"] and e.get("end_date") == "29/01/2026"]
    assert flood and flood[0]["date"] == "22/01/2026"
    assert "inferido" in flood[0]["note"]


def test_deadline_is_listed(docs):
    out = analyze_documents(docs, "cronologia")
    assert out["result"]["deadlines"][0]["deadline"] == "15 dias"


def test_comparison_ignores_headers(docs):
    out = analyze_documents(docs, "comparacao")
    texts = [i["text"] for i in out["result"]["left"] + out["result"]["right"]]
    assert not any("FICTÍCIO" in t or "Processo fictício" in t for t in texts)
    assert len(out["result"]["controverted"]) == 4


def test_amounts_are_not_broken_across_lines(docs):
    out = analyze_documents(docs, "relatorio")
    assert out["result"]["amounts"] == ["R$ 30.000,00", "R$ 18.000,00", "R$ 48.000,00"]


def test_cited_documents_not_sent_are_flagged(docs):
    out = analyze_documents(docs, "relatorio")
    assert any("não foram enviados" in p for p in out["pending"])


def test_labor_case_flags_payment_date_divergence():
    names = ["04-reclamacao-trabalhista-ficticia.pdf", "05-contestacao-trabalhista-ficticia.pdf", "06-ata-audiencia-trabalhista-ficticia.pdf"]
    docs = [{"name": n, "text": extract_upload(n, (SAMPLES / n).read_bytes())} for n in names]
    out = analyze_documents(docs, "cronologia")
    assert any("28/08/2026" in p and "24/08/2026" in p for p in out["pending"] if p.startswith("Divergência"))
    assert any("Sr. Roberto Lima" in p for p in out["pending"])
    assert [classify(d["name"], d["text"]) for d in docs] == ["Petição inicial", "Defesa", "Ata de audiência"]


def test_paragraph_sign_is_preserved():
    # Antes, o caractere usado para proteger abreviações era o próprio "§", e "art. 477, § 8º" virava "art. 477, . 8º".
    from acta.text import split_sentences
    out = split_sentences("Pede a multa do art. 477, § 8º, da CLT. A ré nega.")
    assert out == ["Pede a multa do art. 477, § 8º, da CLT.", "A ré nega."]
