from __future__ import annotations

import asyncio
from typing import Any, AsyncIterator, Callable, Dict, List

from snlite.providers.base import Provider


class EchoProvider(Provider):
    """
    Example provider plugin for development and integration testing.
    """

    name = "echo"

    async def list_models(self) -> List[Dict[str, Any]]:
        return [{"id": "echo-v1", "name": "Echo v1 (example plugin)"}]

    async def load(self, model_id: str, **kwargs: Any) -> Dict[str, Any]:
        return {
            "provider": self.name,
            "model_id": model_id,
            "type": "example_plugin",
            "note": "This is a built-in sample provider plugin.",
        }

    async def unload(self) -> None:
        return

    async def chat(self, model_id: str, messages: List[Dict[str, Any]], params: Dict[str, Any]) -> str:
        _ = params
        last_user = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                last_user = str(msg.get("content") or "")
                break
        return f"[echo:{model_id}] {last_user}".strip()

    async def stream_chat(
        self,
        model_id: str,
        messages: List[Dict[str, Any]],
        params: Dict[str, Any],
        cancelled: Callable[[], bool],
    ) -> AsyncIterator[Dict[str, str]]:
        text = await self.chat(model_id=model_id, messages=messages, params=params)
        for ch in text:
            if cancelled():
                return
            yield {"thinking": "", "content": ch}
            await asyncio.sleep(0)


def plugin_entry() -> Provider:
    """
    Entrypoint object discovered from `snlite.providers`.
    """

    return EchoProvider()
