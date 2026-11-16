"""Testes do modo IA sem gastar com API: a IA é substituída por uma resposta fixa."""
import pytest

from acta import assistant, llm
from acta.anonymize import anonymize

DOCS = [
    {"name": "inicial.txt", "text": "PETIÇÃO INICIAL\nAutora: Aurora Tecnologia Ltda. Ré: Logística Delta S.A.\n"
                                    "Em 10 de janeiro de 2026, as partes celebraram contrato. CPF do sócio 123.456.789-00."},
    {"name": "contestacao.txt", "text": "CONTESTAÇÃO\nA Logística Delta reconhece a entrega em 18 de fevereiro de 2026."},
]


def test_anonymization_hides_names_and_documents():
    anon = anonymize([d["text"] for d in DOCS])
    sent = "\n".join(anon.texts)
    for secret in ["Aurora", "Delta", "123.456.789-00"]:
        assert secret not in sent
    assert "Logística Delta S.A." in anon.restore(sent)


def test_run_verifies_quotes_and_restores_names(monkeypatch):
    captured = {}

    def fake(system, user, max_tokens=4000):
        captured["user"] = user
        return {
            "title": "Cronologia", "summary": "Contrato e entrega.",
            "items": [
                {"date": "10/01/2026", "label": "Fato", "text": "[PARTE_1] e [PARTE_2] celebram contrato",
                 "source": "inicial.txt", "page": 1, "quote": "Em 10 de janeiro de 2026, as partes celebraram contrato"},
                {"date": "18/02/2026", "label": "Fato", "text": "Entrega reconhecida pela ré",
                 "source": "inicial.txt", "page": 1, "quote": "reconhece a entrega em 18 de fevereiro de 2026"},
                {"date": "01/03/2026", "label": "Fato", "text": "Notificação extrajudicial",
                 "source": "inicial.txt", "page": 1, "quote": "a autora notificou a ré em 1º de março"},
            ],
            "pending": ["Conferir o contrato."],
        }

    monkeypatch.setattr(llm, "complete_json", fake)
    out = assistant.run(DOCS, "Monte a cronologia", {"title": "Cronologia", "steps": ["ler"]})

    # O que foi enviado à IA não tem nomes nem CPF.
    assert "Aurora" not in captured["user"] and "123.456.789-00" not in captured["user"]
    status = [i["status"] for i in out["result"]["items"]]
    assert status == ["conferido", "outro arquivo", "não localizado"]
    assert out["result"]["items"][1]["source"] == "contestacao.txt"
    # Os nomes reais voltam no resultado.
    assert "Aurora Tecnologia Ltda." in out["result"]["items"][0]["text"]
    assert out["pending"][0].startswith("1 afirmação")
    assert out["verification"] == {"total": 3, "confirmed": 1, "other_file": 1, "not_found": 1}


def test_without_key_ai_is_unavailable(monkeypatch):
    for var in ["ACTA_PROVIDER", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]:
        monkeypatch.delenv(var, raising=False)
    assert llm.status()["available"] is False
    with pytest.raises(llm.LLMError):
        llm.complete_json("s", "u")


def test_parse_json_accepts_code_fences():
    assert llm.parse_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_date_check_accepts_ranges():
    assert assistant._date_in_quote("22/01/2026", "enchentes entre 22 e 29 de janeiro")
    assert not assistant._date_in_quote("23/01/2026", "enchentes entre 22 e 29 de janeiro")
