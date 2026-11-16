from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from acta.analyze import analyze_documents, build_plan
from acta.extract import extract_upload


ROOT = Path(__file__).resolve().parent
app = FastAPI(title="Acta", description="Assistente configurável para advogados")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")
app.mount("/samples", StaticFiles(directory=ROOT / "samples"), name="samples")


@app.get("/")
def index():
    return FileResponse(ROOT / "static" / "index.html")


@app.get("/api/health")
def health():
    return {"status": "ok", "product": "acta"}


@app.post("/api/plan")
def plan(payload: dict):
    return build_plan(payload.get("task", ""), payload.get("skill", "relatorio"))


@app.post("/api/analyze")
async def analyze(
    files: Annotated[list[UploadFile], File()],
    skill: Annotated[str, Form()] = "relatorio",
    task: Annotated[str, Form()] = "",
    system_prompt: Annotated[str, Form()] = "",
    allow_read: Annotated[bool, Form()] = True,
    allow_external: Annotated[bool, Form()] = False,
):
    if not allow_read:
        return JSONResponse({"error": "A leitura dos arquivos não foi autorizada."}, status_code=403)
    if not files:
        return JSONResponse({"error": "Envie pelo menos um documento."}, status_code=400)

    documents = []
    for uploaded in files:
        content = await uploaded.read()
        try:
            text = extract_upload(uploaded.filename or "documento", content)
        except ValueError as exc:
            return JSONResponse({"error": str(exc)}, status_code=400)
        documents.append({"name": uploaded.filename or "documento", "text": text})

    result = analyze_documents(documents, skill, task, system_prompt)
    result["permissions"] = {
        "read_files": allow_read,
        "external_transfer": allow_external,
        "originals_edited": False,
    }
    return result

