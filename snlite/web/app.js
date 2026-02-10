/* 直接使用你当前 v0.5.3.1 的 app.js（无需改动）
   ——为了保持“只改 UI”，这里不动任何逻辑。
   如果你希望我把这里也升级成 v6.0 的小增强（比如：workspace 自动折叠按钮/移动端 sidebar drawer），
   你再说，我再给你 v6.0 的 JS 版本。
*/

const $ = (id) => document.getElementById(id);

let state = {
  providers: [],
  loaded: null,
  currentSessionId: null,
  streaming: false,
  requestId: null,
  lastRequestBody: null,
  chatSearchMatches: [],
  chatSearchIndex: -1,
};

let attachedImage = { name: null, b64: null };
let attachedFiles = []; // {name, mime, size, b64}

const FILE_MAX_BYTES = 6 * 1024 * 1024;
const FILE_MAX_COUNT = 3;

/* ---------------------------
   Tooltip Manager (v0.5.2) ✅
   - render tooltip in <body>
   - position: fixed
   - viewport clamped
---------------------------- */
function createGlobalTooltip() {
  let tip = document.querySelector(".snlite-tooltip");
  if (tip) return tip;

  tip = document.createElement("div");
  tip.className = "snlite-tooltip";
  tip.innerHTML = `<div class="content"></div><div class="arrow"></div>`;
  document.body.appendChild(tip);
  return tip;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function positionTooltip(tipEl, targetEl, text) {
  const contentEl = tipEl.querySelector(".content");
  contentEl.textContent = text || "";

  // Temporarily show to measure
  tipEl.style.left = "0px";
  tipEl.style.top = "0px";
  tipEl.classList.add("show");

  // Force layout
  const tRect = targetEl.getBoundingClientRect();
  const tipRect = tipEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const pad = 10;
  const gap = 10;

  // Prefer above; if not enough space, place below
  const spaceAbove = tRect.top;
  const spaceBelow = vh - tRect.bottom;

  let placeAbove = true;
  if (spaceAbove < tipRect.height + gap + 8 && spaceBelow > spaceAbove) {
    placeAbove = false;
  }

  // Compute x centered on target
  let x = tRect.left + tRect.width / 2 - tipRect.width / 2;
  x = clamp(x, pad, vw - tipRect.width - pad);

  let y;
  if (placeAbove) {
    y = tRect.top - tipRect.height - gap;
  } else {
    y = tRect.bottom + gap;
  }
  y = clamp(y, pad, vh - tipRect.height - pad);

  // Arrow positioning: relative to tooltip box
  const arrowX = clamp((tRect.left + tRect.width / 2) - x, 14, tipRect.width - 14);
  tipEl.style.setProperty("--arrow-x", `${arrowX}px`);

  // Arrow direction class
  tipEl.classList.toggle("arrow-down", placeAbove);
  tipEl.classList.toggle("arrow-up", !placeAbove);

  tipEl.style.left = `${Math.round(x)}px`;
  tipEl.style.top = `${Math.round(y)}px`;
}

function installHelpTooltips() {
  const tip = createGlobalTooltip();
  let activeTarget = null;
  let hideTimer = null;

  const show = (el) => {
    const text = el.getAttribute("data-tip");
    if (!text) return;
    activeTarget = el;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    positionTooltip(tip, el, text);
  };

  const hide = () => {
    activeTarget = null;
    tip.classList.remove("show");
  };

  // Use event delegation
  document.addEventListener("pointerover", (e) => {
    const el = e.target && e.target.closest ? e.target.closest(".help") : null;
    if (!el) return;
    show(el);
  });

  document.addEventListener("pointerout", (e) => {
    const el = e.target && e.target.closest ? e.target.closest(".help") : null;
    if (!el) return;
    // small delay prevents flicker
    hideTimer = setTimeout(() => hide(), 60);
  });

  window.addEventListener("scroll", () => {
    if (activeTarget) {
      const text = activeTarget.getAttribute("data-tip") || "";
      positionTooltip(tip, activeTarget, text);
    }
  }, true);

  window.addEventListener("resize", () => {
    if (activeTarget) {
      const text = activeTarget.getAttribute("data-tip") || "";
      positionTooltip(tip, activeTarget, text);
    }
  });
}

/* ---------------------------
   Safe Markdown render
---------------------------- */
function escapeHtml(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMd(s) {
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return s;
}

function renderMarkdownSafe(text) {
  const raw = (text || "");
  if (!raw) return '<div class="md"></div>';

  const parts = raw.split(/```/);
  let html = '<div class="md">';

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const codeRaw = parts[i];
      let code = codeRaw;
      const firstNewline = codeRaw.indexOf("\n");
      if (firstNewline !== -1) {
        const maybeLang = codeRaw.slice(0, firstNewline).trim();
        if (maybeLang && !maybeLang.includes(" ")) {
          code = codeRaw.slice(firstNewline + 1);
        }
      }
      html += `<pre><code>${escapeHtml(code)}</code></pre>`;
      continue;
    }

    const chunk = parts[i];
    const lines = chunk.split(/\r?\n/);

    let inUl = false;
    let inOl = false;

    const closeLists = () => {
      if (inUl) { html += "</ul>"; inUl = false; }
      if (inOl) { html += "</ol>"; inOl = false; }
    };

    const flushParagraph = (buf) => {
      if (!buf.length) return;
      const joined = buf.join("<br>");
      html += `<p>${joined}</p>`;
      buf.length = 0;
    };

    let paraBuf = [];

    for (let ln of lines) {
      const line = ln.replace(/\t/g, "    ");
      const trimmed = line.trim();

      if (!trimmed) {
        flushParagraph(paraBuf);
        closeLists();
        continue;
      }

      const mH = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (mH) {
        flushParagraph(paraBuf);
        closeLists();
        const level = mH[1].length;
        const content = renderInlineMd(escapeHtml(mH[2].trim()));
        html += `<h${level}>${content}</h${level}>`;
        continue;
      }

      const mOl = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (mOl) {
        flushParagraph(paraBuf);
        if (inUl) { html += "</ul>"; inUl = false; }
        if (!inOl) { html += "<ol>"; inOl = true; }
        const item = renderInlineMd(escapeHtml(mOl[2]));
        html += `<li>${item}</li>`;
        continue;
      }

      const mUl = trimmed.match(/^[-*]\s+(.*)$/);
      if (mUl) {
        flushParagraph(paraBuf);
        if (inOl) { html += "</ol>"; inOl = false; }
        if (!inUl) { html += "<ul>"; inUl = true; }
        const item = renderInlineMd(escapeHtml(mUl[1]));
        html += `<li>${item}</li>`;
        continue;
      }

      if (inUl || inOl) closeLists();

      const rendered = renderInlineMd(escapeHtml(line));
      paraBuf.push(rendered);
    }

    flushParagraph(paraBuf);
    closeLists();
  }

  html += "</div>";
  return html;
}

/* ---------------------------
   Auto-scroll
---------------------------- */
let userScrolledUp = false;

function isNearBottom(el, threshold = 140) {
  return (el.scrollHeight - (el.scrollTop + el.clientHeight)) <= threshold;
}

function updateUserScrolledFlag() {
  const el = $("chatScroll");
  userScrolledUp = !isNearBottom(el);
}

function maybeAutoScroll(force = false) {
  const el = $("chatScroll");
  const enabled = $("autoScroll")?.checked;
  if (!enabled) return;

  if (force) {
    el.scrollTop = el.scrollHeight;
    return;
  }
  if (!userScrolledUp) {
    el.scrollTop = el.scrollHeight;
  }
}

/* ---------------------------
   API
---------------------------- */
async function apiGet(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPost(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPatch(url, body) {
  const r = await fetch(url, {
    method: "PATCH",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiDelete(url) {
  const r = await fetch(url, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ---------------------------
   UI helpers
---------------------------- */
function paramsFromUI() {
  return {
    temperature: parseFloat($("temperature").value),
    top_p: parseFloat($("top_p").value),
    num_predict: parseInt($("num_predict").value, 10),
    repeat_penalty: parseFloat($("repeat_penalty").value),
  };
}

function updateParamLabels() {
  $("tempVal").textContent = $("temperature").value;
  $("topPVal").textContent = $("top_p").value;
}

function setStage(text) {
  $("stageBadge").textContent = text || "Idle";
}

function setModelStatus(text) {
  $("modelStatus").textContent = text || "";
}

function setLoadedBadge() {
  const b = $("loadedBadge");
  if (!state.loaded) {
    b.textContent = "No model";
    b.style.color = "var(--muted)";
    return;
  }
  b.textContent = `${state.loaded.provider} / ${state.loaded.model_id}`;
  b.style.color = "var(--text)";
}

function isGptOssModelId(modelId) {
  return (modelId || "").toLowerCase().includes("gpt-oss");
}

function syncThinkModeOptions() {
  const sel = $("thinkMode");
  const modelId = state.loaded?.model_id || $("modelSelect").value || "";
  const isGpt = isGptOssModelId(modelId);

  const opts = Array.from(sel.options);
  for (const opt of opts) {
    const v = opt.value;
    const isLevel = (v === "low" || v === "medium" || v === "high");
    const isBoolMode = (v === "on" || v === "off");
    if (isGpt) {
      if (isBoolMode) opt.disabled = true;
      if (isLevel) opt.disabled = false;
    } else {
      if (isBoolMode) opt.disabled = false;
      if (isLevel) opt.disabled = true;
    }
  }

  if (sel.options[sel.selectedIndex]?.disabled) {
    sel.value = "auto";
  }
}

/* ---------------------------
   Copy helpers (v0.5.1)
---------------------------- */
async function copyTextToClipboard(text) {
  const t = (text || "").toString();
  if (!t.trim()) return false;
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

function toast(msg) {
  const old = $("stageBadge").textContent;
  $("stageBadge").textContent = msg;
  setTimeout(() => $("stageBadge").textContent = old, 900);
}

function getLastAssistantRow() {
  const rows = Array.from(document.querySelectorAll(".msg-row.assistant"));
  return rows.length ? rows[rows.length - 1] : null;
}

function getRawFromAssistantRow(row) {
  if (!row) return "";
  const bubble = row.querySelector(".bubble.assistant");
  if (!bubble) return "";
  return bubble.dataset.raw || "";
}

/* ---------------------------
   Message UI
---------------------------- */
function createMessageRow(role, opts = {}) {
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${role === "assistant" ? "ai" : ""}`;
  avatar.textContent = role === "assistant" ? "AI" : "U";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.dataset.raw = (opts.raw || "");

  const roleLine = document.createElement("div");
  roleLine.className = "role-line";

  const chip = document.createElement("div");
  chip.className = `role-chip ${role === "assistant" ? "ai" : "user"}`;
  chip.textContent = role === "assistant" ? "Assistant" : "You";

  roleLine.appendChild(chip);

  if (role === "assistant") {
    const actions = document.createElement("div");
    actions.className = "msg-actions";

    const btnCopy = document.createElement("button");
    btnCopy.className = "msg-action";
    btnCopy.textContent = "Copy";
    btnCopy.onclick = async () => {
      const ok = await copyTextToClipboard(bubble.dataset.raw || "");
      toast(ok ? "Copied" : "Copy failed");
    };

    const btnRegen = document.createElement("button");
    btnRegen.className = "msg-action primary";
    btnRegen.textContent = "Regenerate";
    btnRegen.onclick = async () => {
      await regenerateLast();
    };

    actions.appendChild(btnCopy);
    actions.appendChild(btnRegen);
    roleLine.appendChild(actions);
  }

  bubble.appendChild(roleLine);

  const content = document.createElement("div");
  content.className = "content";
  content.innerHTML = renderMarkdownSafe("");
  bubble.appendChild(content);

  const metaLine = document.createElement("div");
  metaLine.className = "msg-meta";
  bubble.appendChild(metaLine);

  if (role === "assistant") {
    row.appendChild(avatar);
    row.appendChild(bubble);
  } else {
    row.appendChild(bubble);
    row.appendChild(avatar);
  }

  $("messages").appendChild(row);
  maybeAutoScroll(true);
  return { row, bubble, contentEl: content, metaEl: metaLine };
}

function setMessageContent(contentEl, rawText, bubbleEl = null) {
  contentEl.innerHTML = renderMarkdownSafe(rawText);
  if (bubbleEl) bubbleEl.dataset.raw = rawText || "";
}

function clearUI() {
  $("messages").innerHTML = "";
  state.chatSearchMatches = [];
  state.chatSearchIndex = -1;
  updateChatSearch();
  maybeAutoScroll(true);
}

function updateChatSearch() {
  const q = ($("chatSearch")?.value || "").trim().toLowerCase();
  const rows = Array.from(document.querySelectorAll(".msg-row"));
  state.chatSearchMatches = [];

  rows.forEach((row) => {
    const bubble = row.querySelector(".bubble");
    if (!bubble) return;
    bubble.classList.remove("search-hit", "search-active");
    const raw = (bubble.dataset.raw || "").toLowerCase();
    if (q && raw.includes(q)) {
      bubble.classList.add("search-hit");
      state.chatSearchMatches.push(row);
    }
  });

  if (!q || !state.chatSearchMatches.length) {
    state.chatSearchIndex = -1;
    $("chatSearchCount").textContent = `0/${state.chatSearchMatches.length}`;
    return;
  }

  state.chatSearchIndex = 0;
  focusChatSearchMatch(0);
}

function focusChatSearchMatch(nextIndex) {
  if (!state.chatSearchMatches.length) {
    $("chatSearchCount").textContent = "0/0";
    return;
  }
  const total = state.chatSearchMatches.length;
  state.chatSearchIndex = ((nextIndex % total) + total) % total;

  Array.from(document.querySelectorAll(".bubble.search-active")).forEach((el) => el.classList.remove("search-active"));
  const row = state.chatSearchMatches[state.chatSearchIndex];
  const bubble = row?.querySelector(".bubble");
  if (bubble) {
    bubble.classList.add("search-active");
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  $("chatSearchCount").textContent = `${state.chatSearchIndex + 1}/${total}`;
}


function setAssistantMeta(metaEl, data = {}) {
  if (!metaEl) return;
  const parts = [];
  if (data.fileChars > 0) {
    parts.push(`File context: ${data.fileChars} chars${data.fileTruncated ? " (truncated)" : ""}`);
  }
  if (typeof data.elapsedMs === "number") {
    parts.push(`Elapsed: ${data.elapsedMs} ms`);
  }
  if (typeof data.outputChars === "number") {
    parts.push(`Output: ${data.outputChars} chars`);
  }
  if (data.cancelled) {
    parts.push("Stopped by user");
  }
  metaEl.textContent = parts.join(" · ");
}

/* ---------- Workspace ---------- */
function wsClear() { $("wsText").textContent = ""; }
function wsShow(show) {
  const ws = $("workspace");
  if (show) ws.classList.remove("hidden");
  else ws.classList.add("hidden");
}

/* ---------- Models ---------- */
async function refreshModels() {
  setModelStatus("Refreshing...");
  const data = await apiGet("/api/models");
  state.providers = data.providers;
  state.loaded = data.state.loaded;
  setLoadedBadge();

  const providerSelect = $("providerSelect");
  providerSelect.innerHTML = "";
  for (const p of state.providers) {
    const opt = document.createElement("option");
    opt.value = p.name;
    opt.textContent = p.name;
    providerSelect.appendChild(opt);
  }
  if (state.providers.length) providerSelect.value = state.providers[0].name;

  await refreshModelListForProvider(providerSelect.value);

  const s = data.state.status;
  if (s === "ready" && state.loaded) setModelStatus(`Ready: ${state.loaded.provider} / ${state.loaded.model_id}`);
  else if (s === "idle") setModelStatus("Idle. Select a model and Load.");
  else if (s === "loading") setModelStatus("Loading...");
  else if (s === "error") setModelStatus(`Error: ${data.state.error || "unknown"}`);
  else setModelStatus(s);

  syncThinkModeOptions();
}

async function refreshModelListForProvider(providerName) {
  const provider = state.providers.find(x => x.name === providerName);
  const modelSelect = $("modelSelect");
  modelSelect.innerHTML = "";
  if (!provider || !provider.models || provider.models.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(no models found)";
    modelSelect.appendChild(opt);
    return;
  }
  for (const m of provider.models) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name || m.id;
    modelSelect.appendChild(opt);
  }
  syncThinkModeOptions();
}

async function loadModel() {
  const provider = $("providerSelect").value;
  const model_id = $("modelSelect").value;
  if (!model_id) return;
  setModelStatus("Loading...");
  const data = await apiPost("/api/models/load", { provider, model_id, params: {} });
  state.loaded = data.loaded;
  setLoadedBadge();
  setModelStatus(data.status === "ready" ? `Ready: ${state.loaded.provider} / ${state.loaded.model_id}` : data.status);
  syncThinkModeOptions();
}

async function unloadModel() {
  const data = await apiPost("/api/models/unload", {});
  state.loaded = data.loaded;
  setLoadedBadge();
  setModelStatus("Unloaded.");
  syncThinkModeOptions();
}

/* ---------- Sessions ---------- */
async function refreshSessions() {
  const items = await apiGet("/api/sessions");
  const q = ($("sessionSearch")?.value || "").trim().toLowerCase();
  const filtered = q ? items.filter((s) => (s.title || "").toLowerCase().includes(q)) : items;
  const container = $("sessions");
  container.innerHTML = "";
  for (const s of filtered) {
    const div = document.createElement("div");
    div.className = "session-item" + (state.currentSessionId === s.id ? " active" : "");
    div.textContent = s.title;
    div.onclick = async () => {
      state.currentSessionId = s.id;
      await openSession(s.id);
      await refreshSessions();
    };
    container.appendChild(div);
  }
  if (!state.currentSessionId && items.length) {
    state.currentSessionId = items[0].id;
    await openSession(items[0].id);
    await refreshSessions();
  }
}

async function newSession() {
  const r = await apiPost("/api/sessions", { title: "New Chat" });
  state.currentSessionId = r.id;
  await openSession(r.id);
  await refreshSessions();
}

async function renameSession() {
  if (!state.currentSessionId) return;
  const title = prompt("New title:");
  if (!title) return;
  await apiPatch(`/api/sessions/${state.currentSessionId}`, { title });
  await refreshSessions();
}

async function deleteSession() {
  if (!state.currentSessionId) return;
  const ok = confirm("Delete this session?");
  if (!ok) return;
  await apiDelete(`/api/sessions/${state.currentSessionId}`);
  state.currentSessionId = null;
  clearUI();
  await refreshSessions();
}

async function exportSession() {
  if (!state.currentSessionId) return;
  const url = `/api/sessions/${state.currentSessionId}/export.md`;
  const r = await fetch(url);
  if (!r.ok) {
    alert("Export failed");
    return;
  }
  const text = await r.text();
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `snlite_${state.currentSessionId}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}


async function exportSessionJson() {
  if (!state.currentSessionId) return;
  const url = `/api/sessions/${state.currentSessionId}/export.json`;
  const r = await fetch(url);
  if (!r.ok) {
    alert("Export JSON failed");
    return;
  }
  const data = await r.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `snlite_${state.currentSessionId}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function openSession(sessionId) {
  const sess = await apiGet(`/api/sessions/${sessionId}`);
  clearUI();
  for (const m of sess.messages) {
    if (m.role === "user") {
      const msg = createMessageRow("user", { raw: m.content });
      setMessageContent(msg.contentEl, m.content, msg.bubble);
    } else if (m.role === "assistant") {
      const msg = createMessageRow("assistant", { raw: m.content });
      setMessageContent(msg.contentEl, m.content, msg.bubble);
    }
  }
  maybeAutoScroll(true);
  updateRegenButtons();
  updateChatSearch();
}

async function stopStreaming() {
  if (!state.requestId) return;
  await apiPost("/api/chat/stop", { request_id: state.requestId });
}

async function maybeAutoTitle(sessionId) {
  try {
    const sess = await apiGet(`/api/sessions/${sessionId}`);
    if (!(sess.title === "New Chat" || (sess.title || "").startsWith("New Chat"))) return;
    const hasUser = (sess.messages || []).some(m => m.role === "user" && (m.content || "").trim().length > 0);
    if (!hasUser) return;
    await apiPost(`/api/sessions/${sessionId}/auto_title`, {});
  } catch {}
}

/* ---------- Image attach ---------- */
function clearAttachedImage() {
  attachedImage.name = null;
  attachedImage.b64 = null;
  $("imageInfo").style.display = "none";
  $("btnRemoveImage").style.display = "none";
  $("imageName").textContent = "";
  $("imagePreview").src = "";
  $("imageFile").value = "";
}

function setAttachedImage(name, dataUrl) {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  attachedImage.name = name;
  attachedImage.b64 = b64;

  $("imageInfo").style.display = "flex";
  $("btnRemoveImage").style.display = "inline-flex";
  $("imageName").textContent = name || "image";
  $("imagePreview").src = dataUrl;
}

/* ---------- File attach ---------- */
function humanSize(bytes) {
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function renderFileList() {
  const box = $("fileList");
  if (!attachedFiles.length) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }
  box.style.display = "flex";
  box.innerHTML = "";

  const enabledCount = attachedFiles.filter((f) => f.enabled !== false).length;
  const stat = document.createElement("div");
  stat.className = "hint file-stat";
  stat.textContent = `Enabled ${enabledCount}/${attachedFiles.length} files. Max ${FILE_MAX_COUNT} files, each <= 6MB.`;
  box.appendChild(stat);

  attachedFiles.forEach((f, idx) => {
    const item = document.createElement("div");
    item.className = "file-item";

    const meta = document.createElement("div");
    meta.className = "file-meta";

    const name = document.createElement("div");
    name.className = "file-name";
    name.textContent = f.name;

    const sub = document.createElement("div");
    sub.className = "file-sub";
    const status = f.enabled === false ? "disabled" : "enabled";
    sub.textContent = `${f.mime || "unknown"} · ${humanSize(f.size)} · ${status}`;

    meta.appendChild(name);
    meta.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "file-actions";

    const toggle = document.createElement("button");
    toggle.className = "file-remove";
    toggle.textContent = f.enabled === false ? "Enable" : "Disable";
    toggle.onclick = () => {
      attachedFiles[idx].enabled = !(attachedFiles[idx].enabled !== false);
      renderFileList();
    };

    const btn = document.createElement("button");
    btn.className = "file-remove";
    btn.textContent = "Remove";
    btn.onclick = () => {
      attachedFiles.splice(idx, 1);
      renderFileList();
    };

    actions.appendChild(toggle);
    actions.appendChild(btn);
    item.appendChild(meta);
    item.appendChild(actions);
    box.appendChild(item);
  });
}

function clearAttachedFiles() {
  attachedFiles = [];
  $("docFiles").value = "";
  renderFileList();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = r.result;
      const comma = dataUrl.indexOf(",");
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      resolve(b64);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ---------- Copy last & Regenerate ---------- */
function updateRegenButtons() {
  const last = getLastAssistantRow();
  const has = !!last;
  $("btnCopyLast").disabled = !has || state.streaming;
  $("btnRegen").disabled = !has || state.streaming;
  $("btnRetry").disabled = state.streaming || (!has && !state.lastRequestBody);
}

async function retryLastRequest() {
  if (state.streaming) return;
  const last = getLastAssistantRow();
  if (last) {
    await regenerateLast();
    return;
  }
  if (state.lastRequestBody?.user_text) {
    $("input").value = state.lastRequestBody.user_text;
    await send();
  }
}

async function copyLastAssistant() {
  const last = getLastAssistantRow();
  if (!last) return;
  const ok = await copyTextToClipboard(getRawFromAssistantRow(last));
  toast(ok ? "Copied" : "Copy failed");
}

async function regenerateLast() {
  if (state.streaming) return;
  if (!state.currentSessionId) return;

  const last = getLastAssistantRow();
  if (!last) return;

  const showTrace = $("showTrace").checked;
  wsShow(showTrace);
  if (showTrace) wsClear();

  last.remove();

  const assistantMsg = createMessageRow("assistant", { raw: "" });
  setMessageContent(assistantMsg.contentEl, "", assistantMsg.bubble);

  state.streaming = true;
  $("btnSend").disabled = true;
  $("btnStop").disabled = false;
  updateRegenButtons();

  setStage("Answering…");

  const body = { session_id: state.currentSessionId, show_trace: showTrace };

  const resp = await fetch("/api/chat/regenerate/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    state.streaming = false;
    $("btnSend").disabled = false;
    $("btnStop").disabled = true;
    setStage("Idle");
    const err = await resp.text();
    setMessageContent(assistantMsg.contentEl, `Error: ${err}`, assistantMsg.bubble);
    updateRegenButtons();
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let assistantRaw = "";
  const streamMeta = { fileChars: 0, fileTruncated: false, elapsedMs: null, outputChars: null, cancelled: false };

  updateUserScrolledFlag();
  if (!userScrolledUp) maybeAutoScroll(true);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        const lines = frame.split("\n").map(l => l.trimEnd());
        let eventType = "message";
        let dataLine = null;

        for (const l of lines) {
          if (l.startsWith("event:")) eventType = l.slice(6).trim();
          if (l.startsWith("data:")) dataLine = l.slice(5).trim();
        }
        if (!dataLine) continue;

        if (eventType === "meta") {
          try { state.requestId = JSON.parse(dataLine).request_id; } catch {}
          continue;
        }

        if (eventType === "request_meta") {
          try {
            const obj = JSON.parse(dataLine);
            const fx = obj.file_extract || {};
            streamMeta.fileChars = Number(fx.total_chars || 0);
            streamMeta.fileTruncated = !!fx.truncated;
            setAssistantMeta(assistantMsg.metaEl, streamMeta);
          } catch {}
          continue;
        }


        if (eventType === "status") {
          try {
            const s = JSON.parse(dataLine);
            if (s.stage === "thinking") setStage("Thinking…");
            if (s.stage === "answering") setStage("Answering…");
          } catch {}
          continue;
        }

        if (eventType === "thinking") {
          if (!$("showTrace").checked) continue;
          try {
            const obj = JSON.parse(dataLine);
            if (obj.token) {
              $("wsText").textContent += obj.token;
              $("wsText").scrollTop = $("wsText").scrollHeight;
            }
          } catch {}
          continue;
        }

        if (eventType === "content") {
          try {
            const obj = JSON.parse(dataLine);
            if (obj.token) {
              assistantRaw += obj.token;
              setMessageContent(assistantMsg.contentEl, assistantRaw, assistantMsg.bubble);
              maybeAutoScroll(false);
            }
          } catch {}
          continue;
        }

        if (eventType === "error") {
          assistantRaw += `\n[Error] ${dataLine}`;
          setMessageContent(assistantMsg.contentEl, assistantRaw, assistantMsg.bubble);
          maybeAutoScroll(false);
          continue;
        }

        if (eventType === "done") {
          try {
            const obj = JSON.parse(dataLine);
            streamMeta.elapsedMs = obj.elapsed_ms;
            streamMeta.outputChars = obj.output_chars;
            streamMeta.cancelled = !!obj.cancelled;
            if (obj.cancelled) {
              assistantRaw += "\n\n[Generation stopped by user]";
              setMessageContent(assistantMsg.contentEl, assistantRaw, assistantMsg.bubble);
            }
            setAssistantMeta(assistantMsg.metaEl, streamMeta);
          } catch {}
          setStage("Idle");
          maybeAutoScroll(false);
          continue;
        }
      }
    }
  } finally {
    state.streaming = false;
    $("btnSend").disabled = false;
    $("btnStop").disabled = true;
    state.requestId = null;
    setStage("Idle");

    await refreshSessions();
    updateRegenButtons();
    maybeAutoScroll(false);
    updateChatSearch();
  }
}

/* ---------- Send ---------- */
async function send() {
  if (state.streaming) return;
  if (!state.currentSessionId) await newSession();
  if (!state.loaded) {
    alert("Please load a model first.");
    return;
  }

  const input = $("input");
  const text = input.value.trim();

  if (!text && !attachedImage.b64 && attachedFiles.filter((f) => f.enabled !== false).length === 0) return;

  let userDisplay = text;
  if (attachedImage.b64) {
    const marker = attachedImage.name ? `[Image] ${attachedImage.name}` : "[Image]";
    userDisplay = userDisplay ? `${marker}\n${userDisplay}` : marker;
  }
  const enabledFiles = attachedFiles.filter((f) => f.enabled !== false);
  if (attachedFiles.length) {
    const fileMarkers = attachedFiles.map(f => `[File] ${f.name} (${humanSize(f.size)})${f.enabled === false ? " [disabled]" : ""}`).join("\n");
    userDisplay = userDisplay ? `${fileMarkers}\n${userDisplay}` : fileMarkers;
  }

  const userMsg = createMessageRow("user", { raw: userDisplay });
  setMessageContent(userMsg.contentEl, userDisplay, userMsg.bubble);

  input.value = "";

  const assistantMsg = createMessageRow("assistant", { raw: "" });
  setMessageContent(assistantMsg.contentEl, "", assistantMsg.bubble);

  state.streaming = true;
  $("btnSend").disabled = true;
  $("btnStop").disabled = false;
  updateRegenButtons();

  const showTrace = $("showTrace").checked;
  wsShow(showTrace);
  if (showTrace) wsClear();

  setStage("Answering…");

  const thinkMode = $("thinkMode").value;

  const filesPayload = enabledFiles.map(f => ({
    name: f.name,
    mime: f.mime,
    b64: f.b64,
  }));

  const body = {
    session_id: state.currentSessionId,
    user_text: text,
    system_text: $("systemText").value || "",
    params: paramsFromUI(),
    think_mode: thinkMode,
    show_trace: showTrace,
    images_b64: attachedImage.b64 ? [attachedImage.b64] : [],
    image_name: attachedImage.name || "",
    files: filesPayload,
  };

  state.lastRequestBody = JSON.parse(JSON.stringify(body));

  clearAttachedImage();
  clearAttachedFiles();

  const resp = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    state.streaming = false;
    $("btnSend").disabled = false;
    $("btnStop").disabled = true;
    setStage("Idle");
    setMessageContent(assistantMsg.contentEl, `Error: ${await resp.text()}`, assistantMsg.bubble);
    updateRegenButtons();
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let assistantRaw = "";
  const streamMeta = { fileChars: 0, fileTruncated: false, elapsedMs: null, outputChars: null, cancelled: false };

  updateUserScrolledFlag();
  if (!userScrolledUp) maybeAutoScroll(true);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        const lines = frame.split("\n").map(l => l.trimEnd());
        let eventType = "message";
        let dataLine = null;

        for (const l of lines) {
          if (l.startsWith("event:")) eventType = l.slice(6).trim();
          if (l.startsWith("data:")) dataLine = l.slice(5).trim();
        }
        if (!dataLine) continue;

        if (eventType === "meta") {
          try { state.requestId = JSON.parse(dataLine).request_id; } catch {}
          continue;
        }

        if (eventType === "request_meta") {
          try {
            const obj = JSON.parse(dataLine);
            const fx = obj.file_extract || {};
            streamMeta.fileChars = Number(fx.total_chars || 0);
            streamMeta.fileTruncated = !!fx.truncated;
            setAssistantMeta(assistantMsg.metaEl, streamMeta);
          } catch {}
          continue;
        }

        if (eventType === "status") {
          try {
            const s = JSON.parse(dataLine);
            if (s.stage === "thinking") setStage("Thinking…");
            if (s.stage === "answering") setStage("Answering…");
          } catch {}
          continue;
        }

        if (eventType === "thinking") {
          if (!$("showTrace").checked) continue;
          try {
            const obj = JSON.parse(dataLine);
            if (obj.token) {
              $("wsText").textContent += obj.token;
              $("wsText").scrollTop = $("wsText").scrollHeight;
            }
          } catch {}
          continue;
        }

        if (eventType === "content") {
          try {
            const obj = JSON.parse(dataLine);
            if (obj.token) {
              assistantRaw += obj.token;
              setMessageContent(assistantMsg.contentEl, assistantRaw, assistantMsg.bubble);
              maybeAutoScroll(false);
            }
          } catch {}
          continue;
        }

        if (eventType === "error") {
          assistantRaw += `\n[Error] ${dataLine}`;
          setMessageContent(assistantMsg.contentEl, assistantRaw, assistantMsg.bubble);
          maybeAutoScroll(false);
          continue;
        }

        if (eventType === "done") {
          try {
            const obj = JSON.parse(dataLine);
            streamMeta.elapsedMs = obj.elapsed_ms;
            streamMeta.outputChars = obj.output_chars;
            streamMeta.cancelled = !!obj.cancelled;
            if (obj.cancelled) {
              assistantRaw += "\n\n[Generation stopped by user]";
              setMessageContent(assistantMsg.contentEl, assistantRaw, assistantMsg.bubble);
            }
            setAssistantMeta(assistantMsg.metaEl, streamMeta);
          } catch {}
          setStage("Idle");
          maybeAutoScroll(false);
          continue;
        }
      }
    }
  } finally {
    state.streaming = false;
    $("btnSend").disabled = false;
    $("btnStop").disabled = true;
    state.requestId = null;
    setStage("Idle");

    await maybeAutoTitle(state.currentSessionId);
    await refreshSessions();
    updateRegenButtons();
    maybeAutoScroll(false);
    updateChatSearch();
  }
}

/* ---------- Init ---------- */
async function init() {
  installHelpTooltips(); // ✅ v0.5.2

  $("btnRefresh").onclick = refreshModels;
  $("btnLoad").onclick = loadModel;
  $("btnUnload").onclick = unloadModel;

  $("providerSelect").onchange = async (e) => {
    await refreshModelListForProvider(e.target.value);
  };
  $("modelSelect").onchange = () => syncThinkModeOptions();

  $("btnNewSession").onclick = newSession;
  $("btnRenameSession").onclick = renameSession;
  $("btnDeleteSession").onclick = deleteSession;
  $("btnExport").onclick = exportSession;
  $("btnExportJson").onclick = exportSessionJson;

  $("btnSend").onclick = send;
  $("btnStop").onclick = stopStreaming;
  $("btnClear").onclick = clearUI;

  $("btnCopyLast").onclick = copyLastAssistant;
  $("btnRegen").onclick = regenerateLast;
  $("btnRetry").onclick = retryLastRequest;

  $("temperature").oninput = updateParamLabels;
  $("top_p").oninput = updateParamLabels;
  updateParamLabels();

  $("input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send();
    }
  });

  $("chatScroll").addEventListener("scroll", () => updateUserScrolledFlag());
  $("chatSearch").addEventListener("input", () => updateChatSearch());
  $("btnSearchNext").onclick = () => focusChatSearchMatch(state.chatSearchIndex + 1);
  $("btnSearchPrev").onclick = () => focusChatSearchMatch(state.chatSearchIndex - 1);
  $("sessionSearch").addEventListener("input", () => refreshSessions());

  $("btnWsClear").onclick = () => $("wsText").textContent = "";
  $("btnWsHide").onclick = () => {
    $("showTrace").checked = false;
    wsShow(false);
  };
  $("showTrace").onchange = () => wsShow($("showTrace").checked);

  $("autoScroll").onchange = () => {
    if ($("autoScroll").checked) {
      userScrolledUp = false;
      maybeAutoScroll(true);
    }
  };

  // Image
  $("btnAttach").onclick = () => $("imageFile").click();
  $("btnRemoveImage").onclick = clearAttachedImage;
  $("imageFile").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      clearAttachedImage();
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      alert("Image too large. Please use <= 6MB.");
      clearAttachedImage();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachedImage(file.name, reader.result);
    reader.readAsDataURL(file);
  });

  // Files
  $("btnAttachFiles").onclick = () => $("docFiles").click();
  $("docFiles").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const f of files) {
      if (attachedFiles.length >= FILE_MAX_COUNT) {
        alert(`Max ${FILE_MAX_COUNT} files allowed.`);
        break;
      }
      if (f.size > FILE_MAX_BYTES) {
        alert(`File too large (max 6MB): ${f.name}`);
        continue;
      }

      const b64 = await readFileAsBase64(f);
      attachedFiles.push({
        name: f.name,
        mime: f.type || "",
        size: f.size,
        b64,
        enabled: true,
      });
    }

    renderFileList();
    $("docFiles").value = "";
  });

  wsShow(false);
  state.lastRequestBody = JSON.parse(JSON.stringify(body));

  clearAttachedImage();
  clearAttachedFiles();

  setStage("Idle");
  await refreshModels();
  await refreshSessions();

  userScrolledUp = false;
  maybeAutoScroll(true);
  updateRegenButtons();
  updateChatSearch();
}

init().catch(err => {
  console.error(err);
  setModelStatus("Init error: " + err.message);
  setStage("Idle");
});
