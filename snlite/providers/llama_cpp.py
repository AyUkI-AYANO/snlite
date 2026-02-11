from __future__ import annotations

from typing import Any, AsyncIterator, Dict, List, Optional
from .base import Provider

class LlamaCppProvider(Provider):
    """
    Placeholder for future GGUF support (llama-cpp-python).
    We keep it here to show how providers plug in, but v7.0.0 does not enable it by default.
    """
    name = "llama_cpp"

    def __init__(self, models_dir: str = "./models") -> None:
        self.models_dir = models_dir
        self._loaded = None

    async def list_models(self) -> List[Dict[str, Any]]:
        # Implement directory scan for *.gguf in the future
        return []

    async def load(self, model_id: str, **kwargs: Any) -> Dict[str, Any]:
        raise NotImplementedError("llama_cpp provider is not enabled in v7.0.0. Use Ollama provider.")

    async def unload(self) -> None:
        self._loaded = None

    async def stream_chat(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        params: Dict[str, Any],
        cancelled: Optional[callable] = None,
    ) -> AsyncIterator[str]:
        raise NotImplementedError("llama_cpp provider is not enabled in v7.0.0.")
