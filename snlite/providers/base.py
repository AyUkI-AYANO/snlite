from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Callable, Dict, List


class Provider(ABC):
    name: str

    @abstractmethod
    async def list_models(self) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    async def load(self, model_id: str, **kwargs: Any) -> Dict[str, Any]:
        """
        Returns meta dict about loaded model.
        """
        ...

    @abstractmethod
    async def unload(self) -> None:
        ...

    @abstractmethod
    async def chat(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        params: Dict[str, Any],
    ) -> str:
        """
        Non-stream chat: returns full text.
        Optional for some providers; used by deep-thinking if needed.
        """
        ...

    @abstractmethod
    async def stream_chat(
        self,
        model_id: str,
        messages: List[Dict[str, Any]],
        params: Dict[str, Any],
        cancelled: Callable[[], bool],
    ) -> AsyncIterator[Dict[str, str]]:
        """
        Yields dict chunks.
        Typical shape: {"thinking": "...", "content": "..."}.
        cancelled(): bool -> return True if should cancel
        """
        ...
