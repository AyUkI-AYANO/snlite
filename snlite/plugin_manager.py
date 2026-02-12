from __future__ import annotations

import inspect
import logging
import os
from dataclasses import dataclass
from importlib.metadata import EntryPoint, entry_points
from typing import Any, Callable, Dict, Iterable, List, Optional

from snlite.providers.base import Provider

logger = logging.getLogger(__name__)

PROVIDER_ENTRYPOINT_GROUP = "snlite.providers"


@dataclass
class PluginRecord:
    name: str
    source: str
    module: str
    loaded: bool
    error: Optional[str] = None


def _is_allowed(plugin_name: str, allowlist: str) -> bool:
    raw = (allowlist or "*").strip()
    if raw in ("", "*"):
        return True
    allowed = {x.strip() for x in raw.split(",") if x.strip()}
    return plugin_name in allowed


def _materialize_provider(candidate: Any) -> Provider:
    obj = candidate
    if inspect.isclass(candidate):
        obj = candidate()
    elif callable(candidate):
        obj = candidate()

    required = ("list_models", "load", "unload", "chat", "stream_chat")
    missing = [name for name in required if not hasattr(obj, name)]
    if missing:
        raise TypeError(f"missing provider methods: {', '.join(missing)}")

    return obj


def _iter_provider_entry_points() -> Iterable[EntryPoint]:
    eps = entry_points()
    # python 3.10 compatibility
    if hasattr(eps, "select"):
        return eps.select(group=PROVIDER_ENTRYPOINT_GROUP)
    return eps.get(PROVIDER_ENTRYPOINT_GROUP, [])


def load_provider_plugins() -> tuple[Dict[str, Provider], List[PluginRecord]]:
    providers: Dict[str, Provider] = {}
    records: List[PluginRecord] = []

    allowlist = os.getenv("SNLITE_PROVIDER_PLUGINS", "*")

    seen_entrypoint_names = set()

    for ep in _iter_provider_entry_points():
        plugin_name = ep.name
        seen_entrypoint_names.add(plugin_name)
        module_name = getattr(ep, "module", ep.value)

        if not _is_allowed(plugin_name, allowlist):
            records.append(
                PluginRecord(
                    name=plugin_name,
                    source="entrypoint",
                    module=module_name,
                    loaded=False,
                    error="blocked by SNLITE_PROVIDER_PLUGINS",
                )
            )
            continue

        try:
            factory = ep.load()
            provider = _materialize_provider(factory)
            provider_name = (getattr(provider, "name", "") or plugin_name).strip()
            if not provider_name:
                raise ValueError("provider name is empty")
            if provider_name in providers:
                records.append(
                    PluginRecord(
                        name=plugin_name,
                        source="entrypoint",
                        module=module_name,
                        loaded=False,
                        error=f"provider name conflict: {provider_name} (skipped duplicate)",
                    )
                )
                logger.warning(
                    "skip provider plugin %s because provider name %s is already registered",
                    plugin_name,
                    provider_name,
                )
                continue
            providers[provider_name] = provider
            records.append(
                PluginRecord(
                    name=provider_name,
                    source="entrypoint",
                    module=module_name,
                    loaded=True,
                )
            )
        except Exception as e:  # pragma: no cover - defensive for plugin isolation
            logger.exception("failed to load provider plugin %s", plugin_name)
            records.append(
                PluginRecord(
                    name=plugin_name,
                    source="entrypoint",
                    module=module_name,
                    loaded=False,
                    error=str(e),
                )
            )

    # Guarantee one built-in example plugin for local dev even when package
    # metadata entry points are unavailable (e.g. direct source execution).
    if "echo" not in seen_entrypoint_names and _is_allowed("echo", allowlist):
        try:
            from snlite.plugins.example_provider import plugin_entry

            provider = _materialize_provider(plugin_entry)
            provider_name = (getattr(provider, "name", "") or "echo").strip()
            if provider_name not in providers:
                providers[provider_name] = provider
                records.append(
                    PluginRecord(
                        name=provider_name,
                        source="builtin_plugin",
                        module="snlite.plugins.example_provider",
                        loaded=True,
                    )
                )
        except Exception as e:  # pragma: no cover
            records.append(
                PluginRecord(
                    name="echo",
                    source="builtin_plugin",
                    module="snlite.plugins.example_provider",
                    loaded=False,
                    error=str(e),
                )
            )

    return providers, records
