"""Skills: tarefas recorrentes salvas para reaproveitar.

Uma skill guarda o pedido, o plano aprovado e as preferências usadas. Na
próxima vez, o advogado escolhe a skill e a Acta parte do mesmo roteiro, em
vez de começar do zero. As skills ficam em arquivos JSON na pasta skills/,
legíveis por qualquer pessoa do escritório.
"""

import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

from acta.analyze import SKILL_LABELS

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"


def slugify(name: str) -> str:
    value = unicodedata.normalize("NFD", name.lower())
    value = "".join(c for c in value if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")[:60] or "skill"


def list_saved(directory: Path | None = None) -> list[dict]:
    directory = directory or SKILLS_DIR
    if not directory.exists():
        return []
    skills = []
    for path in sorted(directory.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        data["id"] = path.stem
        skills.append(data)
    return skills


def get_saved(skill_id: str, directory: Path | None = None) -> dict | None:
    directory = directory or SKILLS_DIR
    path = directory / f"{slugify(skill_id)}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    data["id"] = path.stem
    return data


def save(payload: dict, directory: Path | None = None) -> dict:
    directory = directory or SKILLS_DIR
    name = str(payload.get("name") or "").strip()
    if not name:
        raise ValueError("Dê um nome à skill.")
    base = payload.get("base") if payload.get("base") in SKILL_LABELS else "relatorio"
    plan = payload.get("plan") or {}
    data = {
        "name": name[:80],
        "description": str(payload.get("description") or plan.get("objective") or "")[:200],
        "base": base,
        "task": str(payload.get("task") or "")[:2000],
        "system_prompt": str(payload.get("system_prompt") or "")[:2000],
        "steps": [str(s) for s in plan.get("steps", [])][:10],
        "tests": [str(s) for s in plan.get("tests", [])][:8],
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    directory.mkdir(parents=True, exist_ok=True)
    slug = slugify(name)
    (directory / f"{slug}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    data["id"] = slug
    return data


def delete(skill_id: str, directory: Path | None = None) -> bool:
    directory = directory or SKILLS_DIR
    path = directory / f"{slugify(skill_id)}.json"
    if path.exists():
        path.unlink()
        return True
    return False
