from __future__ import annotations

import inspect
import logging
import os
from dataclasses import dataclass
from importlib.metadata import EntryPoint, entry_points
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple

logger = logging.getLogger(__name__)

LOCALE_ENTRYPOINT_GROUP = "snlite.locales"


@dataclass
class LocalePluginRecord:
    code: str
    name: str
    source: str
    module: str
    loaded: bool
    error: Optional[str] = None


BUILTIN_LOCALES: Dict[str, Dict[str, Any]] = {
    "zh-CN": {
        "name": "简体中文",
        "messages": {
            "lang.name": "简体中文",
            "ui.language": "语言",
            "ui.secondary": "次要",
            "ui.common": "常用",
            "ui.primary": "重点",
            "status.idle": "空闲",
            "status.refreshing": "刷新中...",
            "status.loading": "加载中...",
            "status.unloaded": "已卸载。",
            "status.init_error": "初始化错误：{message}",
            "status.no_model": "未加载模型",
            "toast.copied": "已复制",
            "toast.copy_failed": "复制失败",
            "archive.none": "暂无归档",
            "session.ungrouped": "未分组",
            "session.new_chat": "新聊天",
            "confirm.archive": "归档当前会话？会话将被移除并保存为 TXT。",
            "confirm.delete_session": "永久删除当前会话（不归档）？此操作不可撤销。",
            "confirm.delete_archive": "永久删除选中的归档？",
            "prompt.new_title": "新标题：",
        },
    },
    "en": {
        "name": "English",
        "messages": {
            "lang.name": "English",
            "ui.language": "Language",
            "ui.secondary": "Secondary",
            "ui.common": "Common",
            "ui.primary": "Primary",
            "status.idle": "Idle",
            "status.refreshing": "Refreshing...",
            "status.loading": "Loading...",
            "status.unloaded": "Unloaded.",
            "status.init_error": "Init error: {message}",
            "status.no_model": "No model",
            "toast.copied": "Copied",
            "toast.copy_failed": "Copy failed",
            "archive.none": "No archives yet",
            "session.ungrouped": "Ungrouped",
            "session.new_chat": "New Chat",
            "confirm.archive": "Archive this session? It will be removed and saved as TXT.",
            "confirm.delete_session": "Delete this session permanently without archiving? This cannot be undone.",
            "confirm.delete_archive": "Delete selected archive permanently?",
            "prompt.new_title": "New title:",
        },
    },
}


def _is_allowed(plugin_name: str, allowlist: str) -> bool:
    raw = (allowlist or "*").strip()
    if raw in ("", "*"):
        return True
    allowed = {x.strip() for x in raw.split(",") if x.strip()}
    return plugin_name in allowed


def _iter_locale_entry_points() -> Iterable[EntryPoint]:
    eps = entry_points()
    if hasattr(eps, "select"):
        return eps.select(group=LOCALE_ENTRYPOINT_GROUP)
    return eps.get(LOCALE_ENTRYPOINT_GROUP, [])


def _normalize_locale_payload(plugin_name: str, payload: Any) -> Tuple[str, str, Dict[str, str]]:
    data = payload() if callable(payload) else payload
    if inspect.isclass(data):
        data = data()
    if not isinstance(data, Mapping):
        raise TypeError("locale plugin must return a mapping")

    code = str(data.get("code") or plugin_name).strip()
    name = str(data.get("name") or code).strip()
    messages_raw = data.get("messages") or {}
    if not isinstance(messages_raw, Mapping):
        raise TypeError("locale plugin messages must be a mapping")

    messages: Dict[str, str] = {}
    for k, v in messages_raw.items():
        key = str(k).strip()
        if key:
            messages[key] = str(v)
    if not code:
        raise ValueError("locale code is empty")
    return code, name, messages


def load_locales() -> tuple[Dict[str, Dict[str, Any]], List[LocalePluginRecord]]:
    locales: Dict[str, Dict[str, Any]] = {
        code: {"name": meta["name"], "messages": dict(meta.get("messages") or {})}
        for code, meta in BUILTIN_LOCALES.items()
    }
    records: List[LocalePluginRecord] = [
        LocalePluginRecord(code=code, name=meta["name"], source="builtin", module="snlite.i18n", loaded=True)
        for code, meta in BUILTIN_LOCALES.items()
    ]

    allowlist = os.getenv("SNLITE_LOCALE_PLUGINS", "*")
    for ep in _iter_locale_entry_points():
        plugin_name = ep.name
        module_name = getattr(ep, "module", ep.value)

        if not _is_allowed(plugin_name, allowlist):
            records.append(LocalePluginRecord(code=plugin_name, name=plugin_name, source="entrypoint", module=module_name, loaded=False, error="blocked by SNLITE_LOCALE_PLUGINS"))
            continue

        try:
            payload = ep.load()
            code, name, messages = _normalize_locale_payload(plugin_name, payload)
            if code in locales:
                merged = dict(locales[code].get("messages") or {})
                merged.update(messages)
                locales[code] = {"name": name or locales[code].get("name") or code, "messages": merged}
            else:
                locales[code] = {"name": name or code, "messages": messages}
            records.append(LocalePluginRecord(code=code, name=name, source="entrypoint", module=module_name, loaded=True))
        except Exception as e:  # pragma: no cover
            logger.exception("failed to load locale plugin %s", plugin_name)
            records.append(LocalePluginRecord(code=plugin_name, name=plugin_name, source="entrypoint", module=module_name, loaded=False, error=str(e)))

    return locales, records
