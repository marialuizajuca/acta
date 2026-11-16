"""Conexão com o modelo de linguagem (OpenAI ou Anthropic).

Usa só a biblioteca padrão do Python, sem SDK, para o grupo ver exatamente o
que é enviado. A chave fica no arquivo .env, que o .gitignore impede de ir
para o GitHub. Sem chave, a Acta funciona no modo local.
"""

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_MODELS = {"openai": "gpt-5.4-mini", "anthropic": "claude-haiku-5-5"}
TIMEOUT = 120


class LLMError(RuntimeError):
    pass


def load_env(path: Path) -> None:
    """Lê um arquivo .env simples (CHAVE=valor) sem sobrescrever o ambiente."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def config() -> dict:
    provider = os.environ.get("ACTA_PROVIDER", "").strip().lower()
    if not provider:
        if os.environ.get("OPENAI_API_KEY"):
            provider = "openai"
        elif os.environ.get("ANTHROPIC_API_KEY"):
            provider = "anthropic"
    key = os.environ.get("OPENAI_API_KEY" if provider == "openai" else "ANTHROPIC_API_KEY", "")
    model = os.environ.get("ACTA_MODEL") or DEFAULT_MODELS.get(provider, "")
    return {"provider": provider, "model": model, "available": bool(provider in DEFAULT_MODELS and key), "key": key}


def status() -> dict:
    """O que a interface mostra: sem a chave, claro."""
    cfg = config()
    return {"available": cfg["available"], "provider": cfg["provider"] or None, "model": cfg["model"] or None}


def _post(url: str, headers: dict, body: dict) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json", **headers}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        raise LLMError(f"O provedor de IA recusou o pedido ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise LLMError(f"Sem conexão com o provedor de IA: {exc.reason}") from exc


def parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    raise LLMError("A IA não devolveu um resultado no formato esperado. Tente de novo ou use o modo local.")


def complete_json(system: str, user: str, max_tokens: int = 4000) -> dict:
    """Envia o pedido e devolve a resposta já convertida de JSON."""
    cfg = config()
    if not cfg["available"]:
        raise LLMError("Nenhuma chave de IA configurada. Veja o arquivo .env.example.")

    if cfg["provider"] == "openai":
        body = {
            "model": cfg["model"],
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_object"},
        }
        data = _post("https://api.openai.com/v1/chat/completions", {"Authorization": f"Bearer {cfg['key']}"}, body)
        try:
            text = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMError("Resposta inesperada da OpenAI.") from exc
    else:
        body = {
            "model": cfg["model"], "max_tokens": max_tokens, "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        headers = {"x-api-key": cfg["key"], "anthropic-version": "2023-06-01"}
        data = _post("https://api.anthropic.com/v1/messages", headers, body)
        try:
            text = "".join(block.get("text", "") for block in data["content"])
        except (KeyError, TypeError) as exc:
            raise LLMError("Resposta inesperada da Anthropic.") from exc
    return parse_json(text)
