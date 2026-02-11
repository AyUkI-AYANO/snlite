from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, AsyncIterator, Callable, Dict, List, Optional

import httpx

from snlite.providers.base import Provider


@dataclass
class ModelInfo:
    id: str
    name: str


@dataclass
class LoadedModel:
    model_id: str
    meta: Dict[str, Any]


class OllamaProvider(Provider):
    name = "ollama"

    def __init__(self, base_url: str = "http://127.0.0.1:11434", timeout: float = 120.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(self.timeout))

    async def list_models(self) -> List[Dict[str, Any]]:
        """
        Ollama: GET /api/tags
        Returns: {"models":[{"name":"qwen3:4b", ...}, ...]}
        """
        url = f"{self.base_url}/api/tags"
        r = await self._client.get(url)
        r.raise_for_status()
        data = r.json()
        out = []
        for m in data.get("models", []):
            mid = m.get("name") or m.get("model") or ""
            if not mid:
                continue
            out.append({"id": mid, "name": mid})
        return out

    async def load(self, model_id: str, **_: Any) -> Dict[str, Any]:
        """
        For Ollama local models, "load" is effectively a no-op; the first chat call loads it.
        Return meta for UI.
        """
        return {"provider": "ollama", "model_id": model_id}

    async def unload(self) -> None:
        # Ollama doesn't have explicit unload in common usage.
        return

    async def chat(self, model_id: str, messages: List[Dict[str, Any]], params: Dict[str, Any]) -> str:
        """
        Non-streaming chat. Return final answer content (not thinking).
        """
        payload: Dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "stream": False,
            "options": self._map_params(params),
        }
        # pass think if present
        if "think" in params:
            payload["think"] = params["think"]

        url = f"{self.base_url}/api/chat"
        r = await self._client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()
        msg = data.get("message") or {}
        return (msg.get("content") or "").strip()

    def _map_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map SNLite UI params to Ollama options.
        """
        out: Dict[str, Any] = {}
        if "temperature" in params:
            out["temperature"] = float(params["temperature"])
        if "top_p" in params:
            out["top_p"] = float(params["top_p"])
        if "num_predict" in params:
            out["num_predict"] = int(params["num_predict"])
        if "repeat_penalty" in params:
            out["repeat_penalty"] = float(params["repeat_penalty"])
        return out

    async def stream_chat(
        self,
        model_id: str,
        messages: List[Dict[str, Any]],
        params: Dict[str, Any],
        cancelled: Callable[[], bool],
    ) -> AsyncIterator[Dict[str, str]]:
        """
        Streaming chat.
        Yield dicts: {"thinking": "...", "content": "..."} — either key may be empty.
        Ollama streaming returns newline-delimited JSON objects.
        """
        payload: Dict[str, Any] = {
            "model": model_id,
            "messages": messages,
            "stream": True,
            "options": self._map_params(params),
        }
        if "think" in params:
            payload["think"] = params["think"]

        url = f"{self.base_url}/api/chat"

        async with self._client.stream("POST", url, json=payload) as resp:
            resp.raise_for_status()

            async for line in resp.aiter_lines():
                if cancelled():
                    return
                if not line:
                    continue

                try:
                    obj = json.loads(line)
                except Exception:
                    continue

                if obj.get("error"):
                    raise RuntimeError(str(obj["error"]))

                msg = obj.get("message") or {}
                thinking = msg.get("thinking") or ""
                content = msg.get("content") or ""

                # IMPORTANT: sometimes both can appear; don't use elif in consumers
                if thinking or content:
                    yield {"thinking": thinking, "content": content}

                if obj.get("done") is True:
                    return

    async def aclose(self) -> None:
        await self._client.aclose()
