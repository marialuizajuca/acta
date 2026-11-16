"""Testes do servidor: permissões, modo local de reserva e skills salvas."""
from pathlib import Path

from fastapi.testclient import TestClient

import app as server
from acta import skills

SAMPLES = Path(__file__).resolve().parent.parent / "samples"
client = TestClient(server.app)


def _files():
    return [("files", (p.name, p.read_bytes(), "application/pdf")) for p in sorted(SAMPLES.glob("0*.pdf"))]


def test_read_permission_is_required():
    r = client.post("/api/analyze", files=_files(), data={"skill": "cronologia", "allow_read": "false"})
    assert r.status_code == 403


def test_external_without_key_falls_back_to_local(monkeypatch):
    for var in ["ACTA_PROVIDER", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]:
        monkeypatch.delenv(var, raising=False)
    r = client.post("/api/analyze", files=_files(), data={"skill": "cronologia", "allow_external": "true"})
    data = r.json()
    assert data["mode"] == "local" and "warning" in data


def test_anonymize_preview_hides_parties():
    data = client.post("/api/anonymize", files=_files()).json()
    assert "Aurora" not in data["preview"]
    assert {f["kind"] for f in data["replaced"]} >= {"PARTE", "PROCESSO"}


def test_save_and_reuse_skill(tmp_path, monkeypatch):
    monkeypatch.setattr(skills, "SKILLS_DIR", tmp_path)
    saved = client.post("/api/skills", json={
        "name": "Cronologia para audiência", "base": "cronologia", "task": "Cronologia com prazos",
        "plan": {"steps": ["Ler peças", "Listar datas"], "objective": "Preparar audiência"},
    }).json()
    assert saved["id"] == "cronologia-para-audiencia"
    plan = client.post("/api/plan", json={"saved_skill_id": saved["id"], "task": "x"}).json()
    assert plan["title"] == "Cronologia para audiência" and plan["steps"] == ["Ler peças", "Listar datas"]
    r = client.post("/api/analyze", files=_files(), data={"saved_skill_id": saved["id"]}).json()
    assert r["skill"] == "cronologia" and r["saved_skill"] == "Cronologia para audiência"
