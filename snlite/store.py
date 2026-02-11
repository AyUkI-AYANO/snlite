from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
from uuid import uuid4


DEFAULT_GROUP = "未分组"

@dataclass
class Session:
    id: str
    title: str
    group: str
    created_at: float
    updated_at: float
    messages: List[Dict[str, Any]]  # {role, content}

class SessionStore:
    """
    Lightweight JSONL store:
    - file: data/sessions.jsonl
    - each line is a full session snapshot
    - last snapshot wins
    """
    def __init__(self, data_dir: str) -> None:
        self.data_dir = data_dir
        os.makedirs(self.data_dir, exist_ok=True)
        self.path = os.path.join(self.data_dir, "sessions.jsonl")
        self.archives_dir = os.path.join(self.data_dir, "archives")
        os.makedirs(self.archives_dir, exist_ok=True)
        self.archive_index_path = os.path.join(self.data_dir, "archives.jsonl")

    def _normalize_group(self, group: Optional[str]) -> str:
        g = str(group or "").strip()
        return g or DEFAULT_GROUP

    def _load_all_snapshots(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.path):
            return []
        out: List[Dict[str, Any]] = []
        with open(self.path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    out.append(json.loads(line))
                except Exception:
                    continue
        return out

    def _materialize(self) -> Dict[str, Session]:
        snapshots = self._load_all_snapshots()
        by_id: Dict[str, Session] = {}
        for s in snapshots:
            try:
                sess = Session(
                    id=s["id"],
                    title=s.get("title", "Untitled"),
                    group=self._normalize_group(s.get("group")),
                    created_at=float(s.get("created_at", time.time())),
                    updated_at=float(s.get("updated_at", time.time())),
                    messages=list(s.get("messages", [])),
                )
                by_id[sess.id] = sess
            except Exception:
                continue
        return by_id

    def _write_all(self, sessions: List[Session]) -> None:
        with open(self.path, "w", encoding="utf-8") as f:
            for sess in sessions:
                f.write(json.dumps(asdict(sess), ensure_ascii=False) + "\n")

    def list_sessions(self) -> List[Dict[str, Any]]:
        by_id = self._materialize()
        items = sorted(by_id.values(), key=lambda x: x.updated_at, reverse=True)
        return [
            {
                "id": s.id,
                "title": s.title,
                "group": s.group,
                "updated_at": s.updated_at,
                "created_at": s.created_at,
            }
            for s in items
        ]

    def get_session(self, session_id: str) -> Optional[Session]:
        by_id = self._materialize()
        return by_id.get(session_id)

    def create_session(self, title: str = "New Chat", group: str = DEFAULT_GROUP) -> Session:
        now = time.time()
        sess = Session(
            id=uuid4().hex,
            title=title,
            group=self._normalize_group(group),
            created_at=now,
            updated_at=now,
            messages=[],
        )
        self.save_session(sess)
        return sess

    def save_session(self, session: Session) -> None:
        session.updated_at = time.time()
        line = json.dumps(asdict(session), ensure_ascii=False)
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(line + "\n")

    def rename_session(self, session_id: str, title: str) -> Optional[Session]:
        sess = self.get_session(session_id)
        if not sess:
            return None
        sess.title = title
        self.save_session(sess)
        return sess

    def set_session_group(self, session_id: str, group: str) -> Optional[Session]:
        sess = self.get_session(session_id)
        if not sess:
            return None
        sess.group = self._normalize_group(group)
        self.save_session(sess)
        return sess

    def _build_archive_text(self, sess: Session, archived_at: float) -> str:
        lines = [
            f"# {sess.title}",
            "",
            f"会话ID: {sess.id}",
            f"分组: {sess.group}",
            f"创建时间戳: {sess.created_at}",
            f"归档时间戳: {archived_at}",
            "",
            "---",
            "",
        ]
        for m in sess.messages:
            role = m.get("role", "unknown")
            content = m.get("content", "")
            lines.append(f"[{role}]")
            lines.append(content)
            lines.append("")
        return "\n".join(lines).strip() + "\n"

    def _append_archive_index(self, archive: Dict[str, Any]) -> None:
        with open(self.archive_index_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(archive, ensure_ascii=False) + "\n")

    def list_archives(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.archive_index_path):
            return []
        out: Dict[str, Dict[str, Any]] = {}
        with open(self.archive_index_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except Exception:
                    continue
                archive_id = str(row.get("archive_id") or "").strip()
                if not archive_id:
                    continue
                out[archive_id] = row
        rows = list(out.values())
        rows.sort(key=lambda x: float(x.get("archived_at", 0)), reverse=True)
        return rows

    def get_archive(self, archive_id: str) -> Optional[Dict[str, Any]]:
        rows = self.list_archives()
        item = next((x for x in rows if x.get("archive_id") == archive_id), None)
        if not item:
            return None
        file_path = item.get("file_path") or ""
        if not file_path or not os.path.exists(file_path):
            return None
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {**item, "content": content}

    def delete_archive(self, archive_id: str) -> bool:
        rows = self.list_archives()
        target = next((x for x in rows if x.get("archive_id") == archive_id), None)
        if not target:
            return False

        file_path = str(target.get("file_path") or "").strip()
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        kept = [x for x in rows if x.get("archive_id") != archive_id]
        with open(self.archive_index_path, "w", encoding="utf-8") as f:
            for row in kept:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        return True

    def archive_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        sess = self.get_session(session_id)
        if not sess:
            return None

        archived_at = time.time()
        archive_id = uuid4().hex
        filename = f"archive_{int(archived_at)}_{session_id}.txt"
        file_path = os.path.join(self.archives_dir, filename)
        content = self._build_archive_text(sess, archived_at)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        archive_meta = {
            "archive_id": archive_id,
            "session_id": sess.id,
            "title": sess.title,
            "group": sess.group,
            "archived_at": archived_at,
            "created_at": sess.created_at,
            "message_count": len(sess.messages),
            "file_path": file_path,
            "file_name": filename,
        }
        self._append_archive_index(archive_meta)
        self.delete_session(session_id)
        return archive_meta

    def delete_session(self, session_id: str) -> bool:
        """
        Hard delete all snapshots for a session from JSONL.

        This prevents deleted session content from remaining in the underlying
        `sessions.jsonl` file, which can otherwise happen with tombstone-only
        deletion.
        """
        snapshots = self._load_all_snapshots()
        if not snapshots:
            return False

        kept: List[Dict[str, Any]] = []
        found = False
        for raw in snapshots:
            if str(raw.get("id")) == session_id:
                found = True
                continue
            kept.append(raw)

        if not found:
            return False

        with open(self.path, "w", encoding="utf-8") as f:
            for raw in kept:
                f.write(json.dumps(raw, ensure_ascii=False) + "\n")
        return True

    def export_markdown(self, session_id: str) -> Optional[str]:
        sess = self.get_session(session_id)
        if not sess:
            return None
        # If deleted
        if sess.title == "__deleted__":
            return None
        lines = [f"# {sess.title}", ""]
        for m in sess.messages:
            role = m.get("role", "")
            content = m.get("content", "")
            if role == "user":
                lines.append(f"## User\n\n{content}\n")
            elif role == "assistant":
                lines.append(f"## Assistant\n\n{content}\n")
            elif role == "system":
                lines.append(f"## System\n\n{content}\n")
            else:
                lines.append(f"## {role}\n\n{content}\n")
        return "\n".join(lines)

    def export_all(self) -> Dict[str, Any]:
        by_id = self._materialize()
        items = [asdict(s) for s in sorted(by_id.values(), key=lambda x: x.updated_at, reverse=True) if s.title != "__deleted__"]
        return {
            "format": "snlite.sessions.backup.v1",
            "exported_at": time.time(),
            "count": len(items),
            "sessions": items,
        }

    def import_all(self, sessions: List[Dict[str, Any]], mode: str = "append") -> Dict[str, int]:
        if mode not in ("append", "replace"):
            raise ValueError("mode must be append or replace")

        existing = self._materialize()
        imported = 0
        skipped = 0

        def _to_session(raw: Dict[str, Any]) -> Optional[Session]:
            try:
                sid = str(raw.get("id") or "").strip() or uuid4().hex
                title = str(raw.get("title") or "New Chat").strip() or "New Chat"
                group = self._normalize_group(raw.get("group"))
                created_at = float(raw.get("created_at") or time.time())
                updated_at = float(raw.get("updated_at") or created_at)
                messages = raw.get("messages") or []
                if not isinstance(messages, list):
                    messages = []
                normalized = []
                for m in messages:
                    if isinstance(m, dict) and "role" in m and "content" in m:
                        normalized.append(m)
                return Session(id=sid, title=title, group=group, created_at=created_at, updated_at=updated_at, messages=normalized)
            except Exception:
                return None

        if mode == "replace":
            existing = {}

        for raw in sessions:
            if not isinstance(raw, dict):
                skipped += 1
                continue
            sess = _to_session(raw)
            if not sess:
                skipped += 1
                continue

            prev = existing.get(sess.id)
            if prev and prev.updated_at > sess.updated_at:
                skipped += 1
                continue
            existing[sess.id] = sess
            imported += 1

        out = sorted(existing.values(), key=lambda x: x.updated_at)
        self._write_all(out)
        return {"imported": imported, "skipped": skipped, "total": len(out)}

    def compact(self) -> Dict[str, int]:
        snapshots = self._load_all_snapshots()
        before = len(snapshots)
        by_id = self._materialize()
        ordered = sorted(by_id.values(), key=lambda x: x.updated_at)
        self._write_all(ordered)
        return {"before": before, "after": len(ordered), "saved": max(0, before - len(ordered))}
