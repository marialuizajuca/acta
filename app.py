import json
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from acta import assistant, llm, skills
from acta.analyze import SKILL_LABELS, analyze_documents, build_plan
from acta.anonymize import anonymize
from acta.extract import extract_upload
from acta.text import plain


ROOT = Path(__file__).resolve().parent
llm.load_env(ROOT / ".env")

app = FastAPI(title="Acta", description="Assistente configurável para advogados")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")
app.mount("/samples", StaticFiles(directory=ROOT / "samples"), name="samples")


@app.get("/")
def index():
    return FileResponse(ROOT / "static" / "index.html")


@app.get("/api/health")
def health():
    return {"status": "ok", "product": "acta"}


@app.get("/api/status")
def status():
    return {
        "ai": llm.status(),
        "builtin_skills": [{"id": k, "name": v} for k, v in SKILL_LABELS.items()],
        "saved_skills": skills.list_saved(),
    }


@app.get("/api/skills")
def list_skills():
    return skills.list_saved()


@app.post("/api/skills")
def save_skill(payload: dict):
    try:
        return skills.save(payload)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)


@app.delete("/api/skills/{skill_id}")
def delete_skill(skill_id: str):
    return {"deleted": skills.delete(skill_id)}


def _resolve_skill(skill: str, saved_id: str) -> tuple[str, dict | None]:
    """Uma skill salva roda sobre uma skill-base, usada no modo local."""
    saved = skills.get_saved(saved_id) if saved_id else None
    base = saved["base"] if saved else (skill if skill in SKILL_LABELS else "relatorio")
    return base, saved


@app.post("/api/plan")
def plan(payload: dict):
    task = payload.get("task", "")
    base, saved = _resolve_skill(payload.get("skill", "relatorio"), payload.get("saved_skill_id", ""))
    label = saved["name"] if saved else SKILL_LABELS[base]
    if payload.get("use_ai") and llm.status()["available"]:
        try:
            return assistant.plan(
                task, label, payload.get("doc_names", []), payload.get("system_prompt", ""),
                saved["steps"] if saved else None,
            )
        except llm.LLMError as exc:
            result = build_plan(task, base)
            result["warning"] = f"{exc} O plano abaixo é o do modo local."
            return result
    result = build_plan(task, base)
    if saved:
        result["title"] = saved["name"]
        if saved.get("steps"):
            result["steps"] = saved["steps"]
    return result


async def _read(files: list[UploadFile]) -> list[dict]:
    documents = []
    for uploaded in files:
        content = await uploaded.read()
        documents.append({"name": uploaded.filename or "documento", "text": extract_upload(uploaded.filename or "documento", content)})
    return documents


@app.post("/api/anonymize")
async def anonymize_preview(files: Annotated[list[UploadFile], File()]):
    """Mostra ao advogado, antes do envio, o que será trocado por código."""
    try:
        documents = await _read(files)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    anon = anonymize([plain(d["text"]) for d in documents])
    return {
        "replaced": anon.found,
        "preview": "\n\n".join(f"===== {d['name']} =====\n{t}" for d, t in zip(documents, anon.texts))[:2500],
    }


@app.post("/api/analyze")
async def analyze(
    files: Annotated[list[UploadFile], File()],
    skill: Annotated[str, Form()] = "relatorio",
    task: Annotated[str, Form()] = "",
    system_prompt: Annotated[str, Form()] = "",
    allow_read: Annotated[bool, Form()] = True,
    allow_external: Annotated[bool, Form()] = False,
    plan: Annotated[str, Form()] = "",
    saved_skill_id: Annotated[str, Form()] = "",
):
    if not allow_read:
        return JSONResponse({"error": "A leitura dos arquivos não foi autorizada."}, status_code=403)
    if not files:
        return JSONResponse({"error": "Envie pelo menos um documento."}, status_code=400)
    try:
        documents = await _read(files)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)

    base, saved = _resolve_skill(skill, saved_skill_id)
    permissions = {"read_files": allow_read, "external_transfer": allow_external, "originals_edited": False}
    warning = None

    # A IA só é chamada com a permissão de envio marcada pelo advogado.
    if allow_external and llm.status()["available"]:
        try:
            approved = json.loads(plan) if plan else {}
        except json.JSONDecodeError:
            approved = {}
        try:
            out = assistant.run(documents, task, approved, system_prompt)
            return {
                "skill": base, "saved_skill": saved["name"] if saved else None, "task": task, "mode": "ia",
                "provider": llm.status(), "document_count": len(documents),
                "sources": [d["name"] for d in documents],
                "checks": [
                    "Dados identificáveis trocados por códigos antes do envio",
                    f"{out['verification']['confirmed']} de {out['verification']['total']} afirmações conferidas no texto original",
                    "Originais não alterados",
                ],
                "permissions": permissions, **out,
            }
        except llm.LLMError as exc:
            warning = f"{exc} O resultado abaixo foi gerado no modo local, sem IA."
    elif allow_external:
        warning = "A IA não está configurada neste computador. O resultado foi gerado no modo local, sem envio de dados."

    result = analyze_documents(documents, base, task, system_prompt)
    result["saved_skill"] = saved["name"] if saved else None
    result["permissions"] = permissions
    if warning:
        result["warning"] = warning
    return result
