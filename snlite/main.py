from __future__ import annotations

import os
import re
import json
import asyncio
import base64
from io import BytesIO
from typing import Any, Dict, List, Optional, Union, Tuple

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse, PlainTextResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from snlite.registry import AppRegistry
from snlite.store import SessionStore
from snlite.providers.ollama import OllamaProvider

from docx import Document
from pypdf import PdfReader

SNLITE_HOST = os.getenv("SNLITE_HOST", "127.0.0.1")
SNLITE_PORT = int(os.getenv("SNLITE_PORT", "8000"))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
SNLITE_DATA_DIR = os.getenv("SNLITE_DATA_DIR", os.path.join(os.getcwd(), "data"))

MAX_FILES = 3
MAX_FILE_BYTES = 6 * 1024 * 1024
MAX_EXTRACT_CHARS_PER_FILE = 8000
MAX_TOTAL_EXTRACT_CHARS = 16000

app = FastAPI(title="SNLite", version="6.0.1")

WEB_DIR = os.path.join(os.path.dirname(__file__), "web")
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")

registry = AppRegistry()
store = SessionStore(SNLITE_DATA_DIR)

ollama_provider = OllamaProvider(base_url=OLLAMA_BASE_URL)
PROVIDERS = {"ollama": ollama_provider}


@app.middleware("http")
async def no_cache_static(request: Request, call_next):
    resp = await call_next(request)
    path = request.url.path
    if path.startswith("/static/") or path == "/":
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
    return resp


@app.get("/")
async def index() -> Any:
    return FileResponse(os.path.join(WEB_DIR, "index.html"))


@app.get("/api/models")
async def list_models() -> Dict[str, Any]:
    state = await registry.get_state()
    providers_out = []
    for name, p in PROVIDERS.items():
        try:
            models = await p.list_models()
            err = None
        except Exception as e:
            models = []
            err = str(e)
        providers_out.append({"name": name, "models": models, "error": err})
    return {"state": state, "providers": providers_out}


@app.post("/api/models/load")
async def load_model(payload: Dict[str, Any]) -> Dict[str, Any]:
    provider_name = payload.get("provider", "ollama")
    model_id = payload.get("model_id")
    params = payload.get("params") or {}

    if not model_id:
        raise HTTPException(status_code=400, detail="model_id is required")
    provider = PROVIDERS.get(provider_name)
    if not provider:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider_name}")

    await registry.set_loading()
    try:
        meta = await provider.load(model_id, **params)
        await registry.set_provider_and_model(provider, provider_name, model_id, meta=meta)
    except Exception as e:
        await registry.set_error(str(e))
        raise HTTPException(status_code=500, detail=str(e))

    return await registry.get_state()


@app.post("/api/models/unload")
async def unload_model() -> Dict[str, Any]:
    await registry.unload()
    return await registry.get_state()


# Sessions
@app.get("/api/sessions")
async def sessions_list() -> List[Dict[str, Any]]:
    items = store.list_sessions()
    return [x for x in items if x.get("title") != "__deleted__"]


@app.post("/api/sessions")
async def sessions_create(payload: Dict[str, Any]) -> Dict[str, Any]:
    title = payload.get("title") or "New Chat"
    sess = store.create_session(title=title)
    return {"id": sess.id, "title": sess.title, "created_at": sess.created_at, "updated_at": sess.updated_at}


@app.get("/api/sessions/{session_id}")
async def sessions_get(session_id: str) -> Dict[str, Any]:
    sess = store.get_session(session_id)
    if not sess or sess.title == "__deleted__":
        raise HTTPException(status_code=404, detail="session not found")
    return {
        "id": sess.id,
        "title": sess.title,
        "created_at": sess.created_at,
        "updated_at": sess.updated_at,
        "messages": sess.messages,
    }


@app.patch("/api/sessions/{session_id}")
async def sessions_rename(session_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    title = payload.get("title")
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    sess = store.rename_session(session_id, title=title)
    if not sess or sess.title == "__deleted__":
        raise HTTPException(status_code=404, detail="session not found")
    return {"id": sess.id, "title": sess.title, "updated_at": sess.updated_at}


@app.delete("/api/sessions/{session_id}")
async def sessions_delete(session_id: str) -> Dict[str, Any]:
    ok = store.delete_session(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="session not found")
    return {"ok": True}


@app.get("/api/sessions/{session_id}/export.md")
async def sessions_export_md(session_id: str) -> Any:
    md = store.export_markdown(session_id)
    if md is None:
        raise HTTPException(status_code=404, detail="session not found")
    return PlainTextResponse(md, media_type="text/markdown; charset=utf-8")


@app.get("/api/sessions/{session_id}/export.json")
async def sessions_export_json(session_id: str) -> Any:
    sess = store.get_session(session_id)
    if not sess or sess.title == "__deleted__":
        raise HTTPException(status_code=404, detail="session not found")
    return JSONResponse({
        "id": sess.id,
        "title": sess.title,
        "created_at": sess.created_at,
        "updated_at": sess.updated_at,
        "messages": sess.messages,
    })


def _clean_title(s: str) -> str:
    s = s.strip()
    s = re.sub(r"\s+", " ", s)
    s = s.strip("“”\"'`")
    if len(s) > 48:
        s = s[:48].rstrip() + "…"
    return s


def _fallback_title_from_first_user(first_user: str) -> str:
    t = first_user.strip()
    t = re.sub(r"\s+", " ", t)
    if not t:
        return "Chat"
    if len(t) > 32:
        t = t[:32].rstrip() + "…"
    return t


async def _generate_title_with_model(provider: Any, model_id: str, first_user: str) -> Optional[str]:
    prompt = (
        "Generate a short, descriptive chat title based on the user's first message.\n"
        "Rules:\n"
        "- Return TITLE ONLY.\n"
        "- No quotes.\n"
        "- Max 8 words (or <= 20 Chinese characters).\n"
        "- Be specific.\n\n"
        f"User first message:\n{first_user}"
    )
    messages = [{"role": "system", "content": "You are a title generator."}, {"role": "user", "content": prompt}]
    try:
        text = await provider.chat(
            model_id=model_id,
            messages=messages,
            params={"temperature": 0.2, "top_p": 0.9, "num_predict": 32, "repeat_penalty": 1.05},
        )
        if not text:
            return None
        title = text.strip().splitlines()[0].strip()
        title = _clean_title(title)
        if not title:
            return None
        bad = {"new chat", "chat", "conversation", "title", "untitled"}
        if title.lower() in bad:
            return None
        return title
    except Exception:
        return None


@app.post("/api/sessions/{session_id}/auto_title")
async def sessions_auto_title(session_id: str) -> Dict[str, Any]:
    sess = store.get_session(session_id)
    if not sess or sess.title == "__deleted__":
        raise HTTPException(status_code=404, detail="session not found")

    if not (sess.title == "New Chat" or sess.title.startswith("New Chat")):
        return {"ok": True, "skipped": True, "title": sess.title}

    first_user = None
    for m in sess.messages:
        if m.get("role") == "user":
            first_user = (m.get("content") or "").strip()
            break
    if not first_user:
        return {"ok": False, "error": "no user message found"}

    loaded_state = await registry.get_state()
    provider = await registry.get_provider()
    loaded_model = await registry.get_loaded_model()

    title: Optional[str] = None
    if loaded_state.get("loaded") and provider and loaded_model:
        title = await _generate_title_with_model(provider, loaded_model.model_id, first_user)

    if not title:
        title = _fallback_title_from_first_user(first_user)

    title = _clean_title(title)
    sess2 = store.rename_session(session_id, title=title)
    if not sess2:
        raise HTTPException(status_code=500, detail="failed to rename")

    return {"ok": True, "skipped": False, "title": sess2.title, "updated_at": sess2.updated_at}


@app.post("/api/chat/stop")
async def chat_stop(payload: Dict[str, Any]) -> Dict[str, Any]:
    request_id = payload.get("request_id")
    if not request_id:
        raise HTTPException(status_code=400, detail="request_id is required")
    ok = await registry.cancel_stream(request_id)
    return {"ok": ok}


def _build_messages(
    system_text: str,
    history: List[Dict[str, Any]],
    user_text: str,
    images_b64: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    msgs: List[Dict[str, Any]] = []
    if system_text.strip():
        msgs.append({"role": "system", "content": system_text.strip()})

    for m in history:
        if "role" in m and "content" in m:
            msgs.append({"role": m["role"], "content": m["content"]})

    user_msg: Dict[str, Any] = {"role": "user", "content": user_text}
    if images_b64:
        user_msg["images"] = images_b64
    msgs.append(user_msg)
    return msgs


def _resolve_think_value(model_id: str, think_mode: str) -> Optional[Union[bool, str]]:
    m = (model_id or "").lower()
    tm = (think_mode or "auto").lower()
    is_gpt_oss = "gpt-oss" in m

    if tm == "auto":
        return None

    if is_gpt_oss:
        if tm in ("low", "medium", "high"):
            return tm
        if tm == "on":
            return "medium"
        if tm == "off":
            return "low"
        return None

    if tm == "on":
        return True
    if tm == "off":
        return False
    if tm in ("low", "medium", "high"):
        return True
    return None


def _safe_b64_to_bytes(b64: str) -> bytes:
    try:
        return base64.b64decode(b64, validate=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 file data: {e}")


def _extract_text_pdf(data: bytes) -> str:
    bio = BytesIO(data)
    reader = PdfReader(bio)
    out_parts = []
    for page in reader.pages[:20]:
        try:
            t = page.extract_text() or ""
        except Exception:
            t = ""
        if t.strip():
            out_parts.append(t)
        if sum(len(x) for x in out_parts) > MAX_EXTRACT_CHARS_PER_FILE:
            break
    return "\n\n".join(out_parts).strip()


def _extract_text_docx(data: bytes) -> str:
    doc = Document(BytesIO(data))
    parts = []
    for p in doc.paragraphs:
        if p.text:
            parts.append(p.text)
        if sum(len(x) for x in parts) > MAX_EXTRACT_CHARS_PER_FILE:
            break
    return "\n".join(parts).strip()


def _extract_text_plain(data: bytes) -> str:
    try:
        return data.decode("utf-8", errors="ignore").strip()
    except Exception:
        return data.decode("latin-1", errors="ignore").strip()


def _snip(s: str, n: int) -> str:
    s = (s or "").strip()
    if len(s) <= n:
        return s
    return s[:n].rstrip() + "…"


def _parse_files(files: List[Dict[str, Any]]) -> Tuple[str, List[str], Dict[str, Any]]:
    if not files:
        return "", [], {"files": [], "total_chars": 0, "truncated": False}

    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Too many files. Max {MAX_FILES}.")

    total_chars = 0
    injected_blocks: List[str] = []
    markers: List[str] = []
    file_stats: List[Dict[str, Any]] = []
    total_truncated = False

    for f in files:
        name = (f.get("name") or "file").strip()
        mime = (f.get("mime") or "").strip().lower()
        b64 = f.get("b64")
        if not isinstance(b64, str) or not b64:
            raise HTTPException(status_code=400, detail=f"File {name} missing b64")

        data = _safe_b64_to_bytes(b64)
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(status_code=400, detail=f"File too large: {name} (max {MAX_FILE_BYTES//1024//1024}MB)")

        ext = os.path.splitext(name)[1].lower()

        text = ""
        try:
            if ext == ".pdf" or mime == "application/pdf":
                text = _extract_text_pdf(data)
            elif ext == ".docx" or mime in ("application/vnd.openxmlformats-officedocument.wordprocessingml.document",):
                text = _extract_text_docx(data)
            elif ext in (".txt", ".md") or mime.startswith("text/"):
                text = _extract_text_plain(data)
            else:
                text = _extract_text_plain(data)
        except HTTPException:
            raise
        except Exception as e:
            injected_blocks.append(f"> [File: {name}] (parse failed: {e})")
            markers.append(f"[File] {name} (parse failed)")
            file_stats.append({"name": name, "status": "parse_failed", "chars": 0, "truncated": False})
            continue

        text = (text or "").strip()
        if not text:
            injected_blocks.append(f"> [File: {name}] (no extractable text)")
            markers.append(f"[File] {name} (empty)")
            file_stats.append({"name": name, "status": "empty", "chars": 0, "truncated": False})
            continue

        raw_len = len(text)
        text = _snip(text, MAX_EXTRACT_CHARS_PER_FILE)
        file_truncated = len(text) < raw_len
        if total_chars + len(text) > MAX_TOTAL_EXTRACT_CHARS:
            remain = max(0, MAX_TOTAL_EXTRACT_CHARS - total_chars)
            text = _snip(text, remain) if remain > 0 else ""
            file_truncated = True
        total_chars += len(text)
        total_truncated = total_truncated or file_truncated

        injected_blocks.append(f"> [File: {name}]\n> " + "\n> ".join(text.splitlines()))
        trunc_mark = " (truncated)" if file_truncated else ""
        one_line = _snip(text.replace("\n", " "), 120)
        markers.append(f"[File] {name}: {one_line} [injected {len(text)} chars{trunc_mark}]")
        file_stats.append({"name": name, "status": "ok", "chars": len(text), "truncated": file_truncated})

        if total_chars >= MAX_TOTAL_EXTRACT_CHARS:
            injected_blocks.append("> [Note] File excerpts truncated due to total limit.")
            total_truncated = True
            break

    injected_text = "\n\n".join(injected_blocks).strip() if injected_blocks else ""
    return injected_text, markers, {"files": file_stats, "total_chars": total_chars, "truncated": total_truncated}


def _make_model_user_text(user_text: str, injected_text: str, has_images: bool) -> str:
    model_user_text = user_text or ""
    if injected_text:
        if model_user_text:
            model_user_text = model_user_text + "\n\n" + "Attached file excerpts:\n" + injected_text
        else:
            model_user_text = "Use the attached file excerpts below to answer.\n\nAttached file excerpts:\n" + injected_text

    if not model_user_text and has_images:
        model_user_text = "Describe the image and answer any relevant details."
    return model_user_text.strip()


async def _stream_chat_common(
    *,
    session_id: str,
    history: List[Dict[str, Any]],
    system_text: str,
    model_user_text: str,
    images_b64: List[str],
    params: Dict[str, Any],
    think_mode: str,
    show_trace: bool,
    request_id: str,
    request_meta: Optional[Dict[str, Any]] = None,
):
    loaded_state = await registry.get_state()
    provider = await registry.get_provider()
    loaded_model = await registry.get_loaded_model()

    if not loaded_state.get("loaded") or not provider or not loaded_model:
        raise HTTPException(status_code=400, detail="No model loaded. Load a model first.")

    cancel_flag = {"v": False}

    async def poll_cancel() -> None:
        while True:
            cancel_flag["v"] = await registry.is_cancelled(request_id)
            if cancel_flag["v"]:
                return
            await asyncio.sleep(0.05)

    def cancelled() -> bool:
        return cancel_flag["v"]

    think_value = _resolve_think_value(loaded_model.model_id, think_mode)
    stream_params = dict(params)
    if think_value is not None:
        stream_params["think"] = think_value

    messages = _build_messages(system_text=system_text, history=history, user_text=model_user_text, images_b64=images_b64)

    async def event_gen():
        assistant_accum = ""
        poll_task = asyncio.create_task(poll_cancel())
        saw_thinking = False
        saw_content = False

        try:
            yield f"event: meta\ndata: {json.dumps({'request_id': request_id}, ensure_ascii=False)}\n\n"
            if request_meta:
                yield f"event: request_meta\ndata: {json.dumps(request_meta, ensure_ascii=False)}\n\n"
            yield f"event: status\ndata: {json.dumps({'stage': 'answering'}, ensure_ascii=False)}\n\n"
            started_at = asyncio.get_event_loop().time()

            async for chunk in provider.stream_chat(
                model_id=loaded_model.model_id,
                messages=messages,
                params=stream_params,
                cancelled=cancelled,
            ):
                if cancelled():
                    break

                thinking = (chunk.get("thinking") or "")
                content = (chunk.get("content") or "")

                if thinking:
                    if not saw_thinking:
                        saw_thinking = True
                        yield f"event: status\ndata: {json.dumps({'stage': 'thinking'}, ensure_ascii=False)}\n\n"
                    if show_trace:
                        yield f"event: thinking\ndata: {json.dumps({'token': thinking}, ensure_ascii=False)}\n\n"

                if content:
                    if not saw_content:
                        saw_content = True
                        yield f"event: status\ndata: {json.dumps({'stage': 'answering'}, ensure_ascii=False)}\n\n"
                    assistant_accum += content
                    yield f"event: content\ndata: {json.dumps({'token': content}, ensure_ascii=False)}\n\n"

            elapsed_ms = int((asyncio.get_event_loop().time() - started_at) * 1000)
            yield f"event: done\ndata: {json.dumps({'done': True, 'cancelled': cancelled(), 'elapsed_ms': elapsed_ms, 'output_chars': len(assistant_accum)}, ensure_ascii=False)}\n\n"

        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
        finally:
            poll_task.cancel()

            if assistant_accum.strip():
                sess2 = store.get_session(session_id)
                if sess2 and sess2.title != "__deleted__":
                    sess2.messages.append({"role": "assistant", "content": assistant_accum})
                    store.save_session(sess2)

            await registry.pop_stream(request_id)

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@app.post("/api/chat/stream")
async def chat_stream(payload: Dict[str, Any]) -> Any:
    session_id = payload.get("session_id")
    user_text = (payload.get("user_text") or "").strip()
    system_text = (payload.get("system_text") or "").strip()
    params = payload.get("params") or {}

    images_b64 = payload.get("images_b64") or []
    if not isinstance(images_b64, list):
        raise HTTPException(status_code=400, detail="images_b64 must be a list")
    images_b64 = [x for x in images_b64 if isinstance(x, str) and len(x) > 0]
    image_name = (payload.get("image_name") or "").strip()

    files = payload.get("files") or []
    if files and not isinstance(files, list):
        raise HTTPException(status_code=400, detail="files must be a list")

    think_mode = (payload.get("think_mode") or "auto").strip()
    show_trace = bool(payload.get("show_trace", False))

    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    sess = store.get_session(session_id)
    if not sess or sess.title == "__deleted__":
        raise HTTPException(status_code=404, detail="session not found")

    if not user_text and not images_b64 and not files:
        raise HTTPException(status_code=400, detail="user_text or images/files is required")

    request_id = await registry.new_stream()

    injected_text, file_markers, file_meta = _parse_files(files)
    model_user_text = _make_model_user_text(user_text, injected_text, has_images=bool(images_b64))

    # Persist user message (NO raw image b64, but DO store prompt text for regen)
    persisted_lines: List[str] = []
    if images_b64:
        marker = f"[Image] {image_name}".strip() if image_name else "[Image]"
        persisted_lines.append(marker)
    for mk in file_markers:
        persisted_lines.append(mk)
    if user_text:
        persisted_lines.append(user_text)

    sess.messages.append({
        "role": "user",
        "content": "\n".join(persisted_lines).strip(),
        "meta": {
            "prompt": model_user_text,
            "system_text": system_text,
            "params": params,
            "think_mode": think_mode,
            "has_images": bool(images_b64),
            "file_extract": file_meta,
        }
    })
    store.save_session(sess)

    # history excludes the persisted user message; model receives model_user_text (+ images)
    history = [{"role": m["role"], "content": m["content"]} for m in sess.messages[:-1] if "role" in m and "content" in m]

    return await _stream_chat_common(
        session_id=session_id,
        history=history,
        system_text=system_text,
        model_user_text=model_user_text,
        images_b64=images_b64,
        params=params,
        think_mode=think_mode,
        show_trace=show_trace,
        request_id=request_id,
        request_meta={"file_extract": file_meta},
    )


@app.post("/api/chat/regenerate/stream")
async def chat_regenerate_stream(payload: Dict[str, Any]) -> Any:
    session_id = payload.get("session_id")
    show_trace = bool(payload.get("show_trace", False))

    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    sess = store.get_session(session_id)
    if not sess or sess.title == "__deleted__":
        raise HTTPException(status_code=404, detail="session not found")

    if len(sess.messages) < 2:
        raise HTTPException(status_code=400, detail="Not enough messages to regenerate")

    # Find last assistant and its preceding user
    last_idx = len(sess.messages) - 1
    if sess.messages[last_idx].get("role") != "assistant":
        raise HTTPException(status_code=400, detail="Last message is not assistant")

    prev_idx = last_idx - 1
    if prev_idx < 0 or sess.messages[prev_idx].get("role") != "user":
        raise HTTPException(status_code=400, detail="No preceding user message found")

    user_msg = sess.messages[prev_idx]
    meta = user_msg.get("meta") or {}

    if meta.get("has_images"):
        raise HTTPException(status_code=400, detail="Regenerate is not supported for image messages (image binary is not stored).")

    model_user_text = (meta.get("prompt") or user_msg.get("content") or "").strip()
    system_text = (meta.get("system_text") or "").strip()
    params = meta.get("params") or {}
    think_mode = meta.get("think_mode") or "auto"

    if not model_user_text:
        raise HTTPException(status_code=400, detail="Cannot regenerate: missing prompt")

    # Remove last assistant message
    sess.messages.pop(last_idx)
    store.save_session(sess)

    # history: all messages before the user message
    history = [{"role": m["role"], "content": m["content"]} for m in sess.messages[:prev_idx] if "role" in m and "content" in m]

    request_id = await registry.new_stream()

    return await _stream_chat_common(
        session_id=session_id,
        history=history,
        system_text=system_text,
        model_user_text=model_user_text,
        images_b64=[],
        params=params,
        think_mode=str(think_mode),
        show_trace=show_trace,
        request_id=request_id,
        request_meta={"regenerate": True},
    )


def run() -> None:
    uvicorn.run("snlite.main:app", host=SNLITE_HOST, port=SNLITE_PORT, reload=False)


if __name__ == "__main__":
    run()
