from __future__ import annotations

import os
import asyncio
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

NEOSNL_OLLAMA_BASE = os.getenv("NEOSNL_OLLAMA_BASE", "http://127.0.0.1:11434")
TIMEOUT = 180.0

app = FastAPI(title="NeoSNL", version="8.0.1")
WEB_DIR = os.path.join(os.path.dirname(__file__), "web")
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")


@app.get("/")
async def index() -> Any:
    return FileResponse(os.path.join(WEB_DIR, "index.html"))


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "app": "neosnl", "version": "8.0.1"}


@app.get("/api/models")
async def models() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            r = await client.get(f"{NEOSNL_OLLAMA_BASE}/api/tags")
            r.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Ollama unavailable: {e}")
    body = r.json()
    names = [m.get("name") for m in body.get("models", []) if m.get("name")]
    return {"models": names}


async def _generate(model: str, messages: list[dict[str, str]], options: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": options or {},
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            r = await client.post(f"{NEOSNL_OLLAMA_BASE}/api/chat", json=payload)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Generate failed: {e}")


@app.post("/api/chat")
async def chat(payload: dict[str, Any]) -> dict[str, Any]:
    model = payload.get("model")
    messages = payload.get("messages") or []
    if not model:
        raise HTTPException(status_code=400, detail="model is required")
    if not messages:
        raise HTTPException(status_code=400, detail="messages is required")
    result = await _generate(model, messages, payload.get("options") or {})
    return {"message": (result.get("message") or {}).get("content", ""), "raw": result}


@app.post("/api/experiment/duel")
async def duel(payload: dict[str, Any]) -> dict[str, Any]:
    model = payload.get("model")
    prompt = (payload.get("prompt") or "").strip()
    if not model or not prompt:
        raise HTTPException(status_code=400, detail="model and prompt are required")

    sys_prompt = payload.get("system", "You are a concise assistant.")
    ta = float(payload.get("temp_a", 0.2))
    tb = float(payload.get("temp_b", 0.9))
    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": prompt},
    ]

    a_task = _generate(model, messages, {"temperature": ta})
    b_task = _generate(model, messages, {"temperature": tb})
    a, b = await asyncio.gather(a_task, b_task)

    return {
        "experiment": "temperature_duel",
        "left": {"temperature": ta, "output": (a.get("message") or {}).get("content", "")},
        "right": {"temperature": tb, "output": (b.get("message") or {}).get("content", "")},
    }
