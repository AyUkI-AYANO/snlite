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


ZH_CN_MESSAGES: Dict[str, str] = {
    "page.title": "SNLite v7.2.0",
    "brand.sub": "v7.2.0 · 本地 GenAI",
    "tile.model": "模型",
    "tile.sessions": "会话",
    "tile.params": "参数",
    "tile.archives": "归档聊天",
    "tile.thinking": "思考（Ollama 原生）",
    "tile.ui": "界面",
    "ui.language": "语言",
    "ui.primary": "重点",
    "ui.common": "常用",
    "ui.secondary": "次要",
    "ui.autoscroll": "流式生成时自动滚动",
    "ui.autoscroll_hint": "当你向上滚动查看历史时会暂停。",
    "btn.refresh": "刷新",
    "btn.load": "加载",
    "btn.unload": "卸载",
    "btn.new": "新建",
    "btn.rename": "重命名",
    "btn.archive": "归档",
    "btn.delete": "删除",
    "btn.set_group": "设置分组",
    "btn.export_md": "导出 .md",
    "btn.export_json": "导出 .json",
    "btn.backup_all": "备份全部",
    "btn.import": "导入",
    "btn.compact": "压缩",
    "btn.delete_archive": "删除归档",
    "btn.copy": "复制",
    "btn.copy_last": "复制最后一条",
    "btn.regenerate": "重新生成",
    "btn.retry": "重试",
    "btn.stop": "停止",
    "btn.send": "发送",
    "btn.clear_ui": "清空界面",
    "btn.attach_image": "附加图片",
    "btn.remove_image": "移除图片",
    "btn.attach_files": "附加文件",
    "btn.inspect_files": "检查文件提取",
    "btn.clear": "清空",
    "btn.hide": "隐藏",
    "btn.enable": "启用",
    "btn.disable": "停用",
    "btn.remove": "移除",
    "ph.group_name": "分组名称...",
    "ph.search_sessions": "搜索会话...",
    "ph.archive_content": "选择归档后在这里查看 .txt 内容",
    "ph.search_chat": "在聊天中搜索...",
    "ph.message_input": "输入消息…（Ctrl/⌘ + Enter 发送）",
    "title.prev_match": "上一个匹配",
    "title.next_match": "下一个匹配",
    "title.copy_last": "复制最后一条助手消息",
    "title.regenerate": "重新生成最后一条助手消息",
    "title.retry_mode": "重试模式",
    "title.retry_last": "重试上一次失败请求",
    "title.clear_ui": "清空界面（不会删除会话）",
    "retry.keep": "重试：保留上下文",
    "retry.clean": "重试：清理上下文",
    "thinking.mode": "思考模式",
    "think.auto": "自动（默认）",
    "think.on": "开启",
    "think.off": "关闭",
    "think.low": "低（gpt-oss）",
    "think.medium": "中（gpt-oss）",
    "think.high": "高（gpt-oss）",
    "thinking.show_trace": "在工作区显示 trace",
    "thinking.ui_only": "仅影响 UI 展示。",
    "param.temperature": "temperature",
    "param.top_p": "top_p",
    "param.max_tokens": "最大 token（num_predict）",
    "param.repeat_penalty": "重复惩罚",
    "system.title": "系统提示词（System prompt）",
    "system.hint": "仅在当前发送时生效，不会自动写入历史。建议用于角色、规则、语气。",
    "system.placeholder": "例如：你是一个严谨的助教。回答用要点，必要时给例子。",
    "composer.label": "消息输入（Message）",
    "image.hint": "图片会随下一条消息发送。",
    "image.default_name": "图片",
    "workspace.title": "思考工作区",
    "workspace.hint": "该面板显示流式 thinking token（Ollama 原生），内容可能不完整或不准确。",
    "footer.github": "查看项目 GitHub",
    "tip.model": "选择后端与模型。图片输入仅对多模态模型生效。Thinking trace 仅对支持 thinking 的模型生效。",
    "tip.sessions": "每个会话是一条独立聊天。第一轮对话完成后会根据首条用户消息自动生成标题。",
    "tip.params": "这些参数会影响生成风格与随机性。不同模型支持程度不同。",
    "tip.temperature": "随机性/发散度。越高越有创意但更不稳定；越低越严谨但更保守。",
    "tip.top_p": "核采样阈值。越低越保守；与 temperature 共同作用。",
    "tip.max_tokens": "最大输出 token 数（Ollama: num_predict）。越大越长，但更慢、更耗资源。",
    "tip.repeat_penalty": "重复惩罚。提高可减少复读，但过高可能导致语言不自然。",
    "tip.thinking": "stream 会分离 message.thinking 与 message.content。Show trace 仅控制展示，不影响模型是否思考。",
    "tip.think_mode": "Auto：不显式传 think（模型默认）。On/Off：多数模型为 true/false。GPT-OSS 需 low/medium/high。",
    "tip.show_trace": "开启后右侧显示 thinking token 流。关闭后仍可 think，但 UI 不展示。",
    "tip.ui_autoscroll": "自动滚动：流式时跟随到底部；你上滑阅读历史时会暂停，避免抢控制。",
    "tip.system_prompt": "只在本次发送时拼到消息前面，不自动写入历史。适合定义角色、规则、输出格式。",
    "tip.message_input": "Ctrl/⌘ + Enter 发送。支持 1 张图片 + 多文件（pdf/docx/txt/md），文件会解析为文本注入本次提问。",
    "tip.workspace": "显示模型推理 trace（message.thinking）。仅供调试；不写入会话历史。",
    "status.idle": "空闲",
    "status.refreshing": "刷新中...",
    "status.loading": "加载中...",
    "status.unloaded": "已卸载。",
    "status.no_model": "未加载模型",
    "status.no_models_found": "（未找到模型）",
    "status.idle_select_load": "空闲。请选择模型并加载。",
    "status.ready_model": "就绪：{provider} / {model}",
    "status.error": "错误：{error}",
    "status.error_prefix": "错误：",
    "status.unknown": "未知",
    "status.inspecting": "检查中...",
    "status.init_error": "初始化错误：{message}",
    "stage.thinking": "思考中…",
    "stage.answering": "回答中…",
    "session.ungrouped": "未分组",
    "session.new_chat": "新聊天",
    "archive.none": "暂无归档",
    "archive.untitled": "未命名",
    "prompt.new_title": "新标题：",
    "confirm.archive": "归档当前会话？会话将被移除并保存为 TXT。",
    "confirm.delete_session": "永久删除当前会话（不归档）？此操作不可撤销。",
    "confirm.delete_archive": "永久删除选中的归档？",
    "confirm.import_mode": "导入模式：确定=替换本地会话，取消=仅追加。",
    "confirm.compact": "现在压缩本地会话快照吗？",
    "alert.enter_group_name": "请输入分组名称",
    "alert.select_archive_first": "请先选择一个归档",
    "alert.export_failed": "导出失败",
    "alert.export_json_failed": "导出 JSON 失败",
    "alert.backup_failed": "备份失败",
    "alert.invalid_json": "JSON 文件无效。",
    "alert.no_sessions_in_backup": "备份文件中未发现会话。",
    "alert.import_done": "导入完成：导入 {imported}，跳过 {skipped}。",
    "alert.compaction_done": "压缩完成：{before} -> {after}（节省 {saved}）。",
    "alert.no_enabled_files": "没有可检查的已启用文件。",
    "alert.inspect_failed": "检查失败：{message}",
    "alert.load_model_first": "请先加载模型。",
    "alert.choose_image_file": "请选择图片文件。",
    "alert.image_too_large": "图片太大，请使用 <= 6MB。",
    "alert.max_files_allowed": "最多允许 {max} 个文件。",
    "alert.file_too_large": "文件过大（最大 6MB）：{name}",
    "files.enabled_summary": "已启用 {enabled}/{total} 个文件。最多 {max} 个文件，每个 <= 6MB。",
    "files.inspect_summary": "检查摘要：{count} 个文件，共 {chars} 字符{truncated}。",
    "files.inspect_line": "- {name}: {status}, {chars} 字符{flag}",
    "meta.file_context": "文件上下文：{chars} 字符{truncated}",
    "meta.elapsed": "耗时：{ms} ms",
    "meta.output": "输出：{chars} 字符",
    "meta.result": "结果：{reason}",
    "meta.stopped_by_user": "用户已停止",
    "meta.truncated": "（已截断）",
    "meta.truncated_short": " · 已截断",
    "stream.error_prefix": "[错误]",
    "stream.generation_stopped": "[已由用户停止生成]",
    "stream.generation_failed": "[生成失败]",
    "stream.generation_interrupted": "[生成被中断]",
    "role.assistant": "助手",
    "role.you": "你",
    "toast.copied": "已复制",
    "toast.copy_failed": "复制失败",
}

EN_MESSAGES: Dict[str, str] = {
    "page.title": "SNLite v7.2.0",
    "brand.sub": "v7.2.0 · Local GenAI",
    "tile.model": "Model",
    "tile.sessions": "Sessions",
    "tile.params": "Params",
    "tile.archives": "Archived Chats",
    "tile.thinking": "Thinking (Ollama native)",
    "tile.ui": "UI",
    "ui.language": "Language",
    "ui.primary": "Primary",
    "ui.common": "Common",
    "ui.secondary": "Secondary",
    "ui.autoscroll": "Auto-scroll during streaming",
    "ui.autoscroll_hint": "Pauses when you scroll up.",
    "btn.refresh": "Refresh",
    "btn.load": "Load",
    "btn.unload": "Unload",
    "btn.new": "New",
    "btn.rename": "Rename",
    "btn.archive": "Archive",
    "btn.delete": "Delete",
    "btn.set_group": "Set Group",
    "btn.export_md": "Export .md",
    "btn.export_json": "Export .json",
    "btn.backup_all": "Backup all",
    "btn.import": "Import",
    "btn.compact": "Compact",
    "btn.delete_archive": "Delete archive",
    "btn.copy": "Copy",
    "btn.copy_last": "Copy last",
    "btn.regenerate": "Regenerate",
    "btn.retry": "Retry",
    "btn.stop": "Stop",
    "btn.send": "Send",
    "btn.clear_ui": "Clear UI",
    "btn.attach_image": "Attach Image",
    "btn.remove_image": "Remove Image",
    "btn.attach_files": "Attach Files",
    "btn.inspect_files": "Inspect file extraction",
    "btn.clear": "Clear",
    "btn.hide": "Hide",
    "btn.enable": "Enable",
    "btn.disable": "Disable",
    "btn.remove": "Remove",
    "ph.group_name": "Group name...",
    "ph.search_sessions": "Search sessions...",
    "ph.archive_content": "Select an archive to preview .txt content here",
    "ph.search_chat": "Search in chat...",
    "ph.message_input": "Type your message… (Ctrl/⌘ + Enter to send)",
    "title.prev_match": "Previous match",
    "title.next_match": "Next match",
    "title.copy_last": "Copy last assistant message",
    "title.regenerate": "Regenerate last assistant message",
    "title.retry_mode": "Retry mode",
    "title.retry_last": "Retry last failed request",
    "title.clear_ui": "Clear UI (does not delete session)",
    "retry.keep": "Retry: Keep context",
    "retry.clean": "Retry: Clean context",
    "thinking.mode": "Think mode",
    "think.auto": "auto (default)",
    "think.on": "on",
    "think.off": "off",
    "think.low": "low (gpt-oss)",
    "think.medium": "medium (gpt-oss)",
    "think.high": "high (gpt-oss)",
    "thinking.show_trace": "Show trace in workspace",
    "thinking.ui_only": "UI only.",
    "param.temperature": "temperature",
    "param.top_p": "top_p",
    "param.max_tokens": "max tokens (num_predict)",
    "param.repeat_penalty": "repeat_penalty",
    "system.title": "System prompt",
    "system.hint": "Applied only to current send; not written to session history automatically.",
    "system.placeholder": "For example: You are a rigorous tutor. Answer in bullet points and include examples when needed.",
    "composer.label": "Message",
    "image.hint": "Image will be sent with your next message.",
    "image.default_name": "image",
    "workspace.title": "Thinking workspace",
    "workspace.hint": "This panel shows streaming thinking tokens (Ollama native). It may be incomplete or inaccurate.",
    "footer.github": "View project on GitHub",
    "tip.model": "Choose provider and model. Image input works for multimodal models. Thinking trace works for thinking-capable models.",
    "tip.sessions": "Each session is an independent chat. Title is auto-generated after first round from the first user message.",
    "tip.params": "These params affect style and randomness. Support varies across models.",
    "tip.temperature": "Randomness/diversity. Higher is more creative but less stable; lower is stricter but conservative.",
    "tip.top_p": "Nucleus sampling threshold. Lower is more conservative; works with temperature.",
    "tip.max_tokens": "Max output tokens (Ollama: num_predict). Larger allows longer output but slower and heavier.",
    "tip.repeat_penalty": "Repeat penalty. Higher can reduce repetition but too high may hurt fluency.",
    "tip.thinking": "Streaming separates message.thinking from message.content. Show trace only controls UI visibility.",
    "tip.think_mode": "Auto: omit think param. On/Off: boolean on most models. GPT-OSS requires low/medium/high.",
    "tip.show_trace": "When enabled, right workspace shows thinking token stream. Disabled still allows think, but hidden in UI.",
    "tip.ui_autoscroll": "Auto-scroll follows streaming output; pauses when you manually scroll up to read history.",
    "tip.system_prompt": "Prepended only for this send, not auto-saved to history. Useful for role/rules/format.",
    "tip.message_input": "Ctrl/⌘ + Enter to send. Supports 1 image + multiple files (pdf/docx/txt/md).",
    "tip.workspace": "Displays model reasoning trace (message.thinking). For debugging only; not saved in history.",
    "status.idle": "Idle",
    "status.refreshing": "Refreshing...",
    "status.loading": "Loading...",
    "status.unloaded": "Unloaded.",
    "status.no_model": "No model",
    "status.no_models_found": "(no models found)",
    "status.idle_select_load": "Idle. Select a model and Load.",
    "status.ready_model": "Ready: {provider} / {model}",
    "status.error": "Error: {error}",
    "status.error_prefix": "Error:",
    "status.unknown": "unknown",
    "status.inspecting": "Inspecting...",
    "status.init_error": "Init error: {message}",
    "stage.thinking": "Thinking…",
    "stage.answering": "Answering…",
    "session.ungrouped": "Ungrouped",
    "session.new_chat": "New Chat",
    "archive.none": "No archives yet",
    "archive.untitled": "Untitled",
    "prompt.new_title": "New title:",
    "confirm.archive": "Archive this session? It will be removed and saved as TXT.",
    "confirm.delete_session": "Delete this session permanently without archiving? This cannot be undone.",
    "confirm.delete_archive": "Delete selected archive permanently?",
    "confirm.import_mode": "Import mode: OK = replace all local sessions, Cancel = append only.",
    "confirm.compact": "Compact local session snapshots now?",
    "alert.enter_group_name": "Please enter group name.",
    "alert.select_archive_first": "Please select an archive first.",
    "alert.export_failed": "Export failed",
    "alert.export_json_failed": "Export JSON failed",
    "alert.backup_failed": "Backup failed",
    "alert.invalid_json": "Invalid JSON file.",
    "alert.no_sessions_in_backup": "No sessions found in backup file.",
    "alert.import_done": "Import done: imported {imported}, skipped {skipped}.",
    "alert.compaction_done": "Compaction done: {before} -> {after} snapshots (saved {saved}).",
    "alert.no_enabled_files": "No enabled files to inspect.",
    "alert.inspect_failed": "Inspect failed: {message}",
    "alert.load_model_first": "Please load a model first.",
    "alert.choose_image_file": "Please choose an image file.",
    "alert.image_too_large": "Image too large. Please use <= 6MB.",
    "alert.max_files_allowed": "Max {max} files allowed.",
    "alert.file_too_large": "File too large (max 6MB): {name}",
    "files.enabled_summary": "Enabled {enabled}/{total} files. Max {max} files, each <= 6MB.",
    "files.inspect_summary": "Inspect summary: {count} files, {chars} chars{truncated}.",
    "files.inspect_line": "- {name}: {status}, {chars} chars{flag}",
    "meta.file_context": "File context: {chars} chars{truncated}",
    "meta.elapsed": "Elapsed: {ms} ms",
    "meta.output": "Output: {chars} chars",
    "meta.result": "Result: {reason}",
    "meta.stopped_by_user": "Stopped by user",
    "meta.truncated": " (truncated)",
    "meta.truncated_short": " · truncated",
    "stream.error_prefix": "[Error]",
    "stream.generation_stopped": "[Generation stopped by user]",
    "stream.generation_failed": "[Generation failed]",
    "stream.generation_interrupted": "[Generation interrupted]",
    "role.assistant": "Assistant",
    "role.you": "You",
    "toast.copied": "Copied",
    "toast.copy_failed": "Copy failed",
}

BUILTIN_LOCALES: Dict[str, Dict[str, Any]] = {
    "zh-CN": {"name": "简体中文", "messages": ZH_CN_MESSAGES},
    "en": {"name": "English", "messages": EN_MESSAGES},
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
