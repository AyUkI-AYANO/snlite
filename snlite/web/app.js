/* SNLite web app (v8.0.0)
   Vanilla JS only, local-first UI.
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
  selectedArchiveId: null,
};

let attachedImage = { name: null, b64: null };
let attachedFiles = []; // {name, mime, size, b64}

const FILE_MAX_BYTES = 6 * 1024 * 1024;
const FILE_MAX_COUNT = 3;

const I18N_KEY = "snlite.ui.lang.v1";
const UI_STYLE_KEY = "snlite.ui.style.v1";
const i18nState = {
  current: "zh-CN",
  fallback: "en",
  locales: {},
};

function t(key, vars = {}) {
  const active = i18nState.locales[i18nState.current]?.messages || {};
  const fallback = i18nState.locales[i18nState.fallback]?.messages || {};
  let text = active[key] || fallback[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function setAttr(selector, attr, value) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

function setOptionText(selectId, value, text) {
  const el = document.querySelector(`#${selectId} option[value="${value}"]`);
  if (el) el.textContent = text;
}

function setLeadText(selector, text) {
  const el = document.querySelector(selector);
  if (!el || !el.firstChild) return;
  el.firstChild.textContent = `${text} `;
}

function applyStaticI18n() {
  document.documentElement.lang = i18nState.current === "zh-CN" ? "zh-CN" : i18nState.current;
  document.title = t("page.title");

  setText('.sidebar .sub', t('brand.sub'));
  setText('.tile[data-tile="model"] .tile-title > span:first-child', t('tile.model'));
  setText('.tile[data-tile="sessions"] .tile-title > span:first-child', t('tile.sessions'));
  setText('.tile[data-tile="params"] .tile-title > span:first-child', t('tile.params'));
  setText('.tile[data-tile="archives"] .tile-title > span:first-child', t('tile.archives'));
  setText('.tile[data-tile="thinking"] .tile-title > span:first-child', t('tile.thinking'));
  setText('.tile[data-tile="ui"] .tile-title > span:first-child', t('tile.ui'));

  setText('.tile[data-tile="model"] .tile-meta', t('ui.primary'));
  setText('.tile[data-tile="sessions"] .tile-meta', t('ui.primary'));
  setText('.tile[data-tile="params"] .tile-meta', t('ui.common'));
  setText('.tile[data-tile="archives"] .tile-meta', t('ui.secondary'));
  setText('.tile[data-tile="thinking"] .tile-meta', t('ui.secondary'));
  setText('.tile[data-tile="ui"] .tile-meta', t('ui.secondary'));

  setText('#btnRefresh', t('btn.refresh'));
  setText('#btnLoad', t('btn.load'));
  setText('#btnUnload', t('btn.unload'));
  setText('#btnNewSession', t('btn.new'));
  setText('#btnRenameSession', t('btn.rename'));
  setText('#btnArchiveSession', t('btn.archive'));
  setText('#btnDeleteSession', t('btn.delete'));
  setText('#btnSetGroup', t('btn.set_group'));
  setText('#btnExport', t('btn.export_md'));
  setText('#btnExportJson', t('btn.export_json'));
  setText('#btnExportAll', t('btn.backup_all'));
  setText('#btnImportAll', t('btn.import'));
  setText('#btnCompact', t('btn.compact'));
  setText('#btnRefreshArchives', t('btn.refresh'));
  setText('#btnDeleteArchive', t('btn.delete_archive'));

  setAttr('#sessionGroup', 'placeholder', t('ph.group_name'));
  setAttr('#sessionSearch', 'placeholder', t('ph.search_sessions'));
  setAttr('#archiveContent', 'placeholder', t('ph.archive_content'));

  setLeadText('.tile[data-tile="thinking"] .small', t('thinking.mode'));
  setOptionText('thinkMode', 'auto', t('think.auto'));
  setOptionText('thinkMode', 'on', t('think.on'));
  setOptionText('thinkMode', 'off', t('think.off'));
  setOptionText('thinkMode', 'low', t('think.low'));
  setOptionText('thinkMode', 'medium', t('think.medium'));
  setOptionText('thinkMode', 'high', t('think.high'));
  setLeadText('.tile[data-tile="thinking"] .switch-title', t('thinking.show_trace'));
  setText('.tile[data-tile="thinking"] .switch-text .hint', t('thinking.ui_only'));

  setText('label[for="langSelect"]', t('ui.language'));
  setText('label[for="uiStyleSelect"]', t('ui.style'));
  setOptionText('uiStyleSelect', 'uix8', t('ui.style_uix8'));
  setOptionText('uiStyleSelect', 'uix7', t('ui.style_uix7'));
  setOptionText('uiStyleSelect', 'uixone', t('ui.style_uixone'));
  setText('.tile[data-tile="ui"] .switch-title', t('ui.autoscroll'));
  setText('.tile[data-tile="ui"] .switch-text .hint', t('ui.autoscroll_hint'));

  setAttr('#chatSearch', 'placeholder', t('ph.search_chat'));
  setAttr('#btnSearchPrev', 'title', t('title.prev_match'));
  setAttr('#btnSearchNext', 'title', t('title.next_match'));
  setText('#btnCopyLast', t('btn.copy_last'));
  setAttr('#btnCopyLast', 'title', t('title.copy_last'));
  setText('#btnRegen', t('btn.regenerate'));
  setAttr('#btnRegen', 'title', t('title.regenerate'));
  setAttr('#retryMode', 'title', t('title.retry_mode'));
  setOptionText('retryMode', 'keep_params', t('retry.keep'));
  setOptionText('retryMode', 'clean_context', t('retry.clean'));
  setText('#btnRetry', t('btn.retry'));
  setAttr('#btnRetry', 'title', t('title.retry_last'));
  setText('#btnStop', t('btn.stop'));
  setText('#btnClear', t('btn.clear_ui'));
  setAttr('#btnClear', 'title', t('title.clear_ui'));

  setLeadText('.system-title', t('system.title'));
  setText('.system-head .hint', t('system.hint'));
  setAttr('#systemText', 'placeholder', t('system.placeholder'));

  setLeadText('.composer-label', t('composer.label'));
  setText('#btnAttach', t('btn.attach_image'));
  setText('#btnRemoveImage', t('btn.remove_image'));
  setText('#btnAttachFiles', t('btn.attach_files'));
  setText('#btnInspectFiles', t('btn.inspect_files'));
  setText('#imageHint', t('image.hint'));
  setAttr('#input', 'placeholder', t('ph.message_input'));
  setText('#btnSend', t('btn.send'));

  setLeadText('.workspace-title', t('workspace.title'));
  setText('#btnWsClear', t('btn.clear'));
  setText('#btnWsHide', t('btn.hide'));
  setText('#workspace .hint', t('workspace.hint'));
  setText('#githubLink', t('footer.github'));

  setLeadText('.param:nth-of-type(1) .param-head > span', t('param.temperature'));
  setLeadText('.param:nth-of-type(2) .param-head > span', t('param.top_p'));
  setLeadText('.param-grid > div:nth-child(1) > label.small', t('param.max_tokens'));
  setLeadText('.param-grid > div:nth-child(2) > label.small', t('param.repeat_penalty'));

  setAttr('.tile[data-tile="model"] .help', 'data-tip', t('tip.model'));
  setAttr('.tile[data-tile="sessions"] .help', 'data-tip', t('tip.sessions'));
  setAttr('.tile[data-tile="params"] > summary .help', 'data-tip', t('tip.params'));
  setAttr('.param:nth-of-type(1) .help', 'data-tip', t('tip.temperature'));
  setAttr('.param:nth-of-type(2) .help', 'data-tip', t('tip.top_p'));
  setAttr('.param-grid > div:nth-child(1) .help', 'data-tip', t('tip.max_tokens'));
  setAttr('.param-grid > div:nth-child(2) .help', 'data-tip', t('tip.repeat_penalty'));
  setAttr('.tile[data-tile="thinking"] > summary .help', 'data-tip', t('tip.thinking'));
  setAttr('.tile[data-tile="thinking"] .row .small .help', 'data-tip', t('tip.think_mode'));
  setAttr('.tile[data-tile="thinking"] .switch-title .help', 'data-tip', t('tip.show_trace'));
  setAttr('.tile[data-tile="ui"] > summary .help', 'data-tip', t('tip.ui_autoscroll'));
  setAttr('.system-title .help', 'data-tip', t('tip.system_prompt'));
  setAttr('.composer-label .help', 'data-tip', t('tip.message_input'));
  setAttr('.workspace-title .help', 'data-tip', t('tip.workspace'));

  document.querySelectorAll('.tile[data-tile]').forEach((tile) => syncTileBodyHeight(tile));
}

function applyUIStyle(styleName) {
  const style = ["uix8", "uix7", "uixone"].includes(styleName) ? styleName : "uix8";
  document.body.setAttribute("data-ui-style", style);
  const select = $("uiStyleSelect");
  if (select && select.value !== style) {
    select.value = style;
  }
}

function initUIStyle() {
  const select = $("uiStyleSelect");
  const saved = localStorage.getItem(UI_STYLE_KEY);
  const initial = ["uix8", "uix7", "uixone"].includes(saved) ? saved : "uix8";
  applyUIStyle(initial);
  if (select) {
    select.value = initial;
    select.onchange = () => {
      const nextStyle = select.value;
      localStorage.setItem(UI_STYLE_KEY, nextStyle);
      applyUIStyle(nextStyle);
    };
  }
}


async function initI18n() {
  try {
    const data = await apiGet('/api/i18n/locales');
    const map = {};
    for (const item of (data.locales || [])) {
      map[item.code] = item;
    }
    i18nState.locales = map;
    i18nState.fallback = map.en ? 'en' : (Object.keys(map)[0] || 'zh-CN');

    const select = $('langSelect');
    select.innerHTML = '';
    for (const code of Object.keys(map)) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = map[code].name || code;
      select.appendChild(opt);
    }

    const saved = localStorage.getItem(I18N_KEY);
    const defaultCode = map[saved] ? saved : (map[(data.default || '')] ? data.default : i18nState.fallback);
    i18nState.current = defaultCode;
    select.value = defaultCode;
    applyStaticI18n();

    select.onchange = async () => {
      i18nState.current = select.value;
      localStorage.setItem(I18N_KEY, i18nState.current);
      applyStaticI18n();
      setLoadedBadge();
      if ($('stageBadge').textContent === t('status.idle') || $('stageBadge').textContent === 'Idle' || $('stageBadge').textContent === '空闲') {
        setStage(t('status.idle'));
      }
      await refreshSessions();
      await refreshArchives();
      updateRegenButtons();
    };
  } catch (err) {
    console.error('i18n init failed', err);
  }
}


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


function syncTileBodyHeight(tile) {
  if (!tile) return;
  const body = tile.querySelector(":scope > .tile-body");
  if (!body) return;
  const h = Math.max(body.scrollHeight, body.offsetHeight, 0);
  if (h > 0) {
    body.style.setProperty("--tile-body-h", `${h}px`);
  }
}

function installSidebarTiles() {
  const KEY = "snlite.sidebar.tiles.v1";
  const tiles = Array.from(document.querySelectorAll(".tile[data-tile]"));
  if (!tiles.length) return;

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch (_) {
    saved = {};
  }

  const syncAllHeights = () => tiles.forEach((tile) => syncTileBodyHeight(tile));

  tiles.forEach((tile) => {
    const name = tile.dataset.tile;
    const summary = tile.querySelector(":scope > summary");
    if (Object.prototype.hasOwnProperty.call(saved, name)) {
      tile.open = !!saved[name];
    }
    syncTileBodyHeight(tile);

    if (summary) {
      summary.setAttribute("aria-expanded", tile.open ? "true" : "false");
      summary.querySelectorAll(".help").forEach((helpEl) => {
        helpEl.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      });
    }

    tile.addEventListener("toggle", () => {
      if (summary) {
        summary.setAttribute("aria-expanded", tile.open ? "true" : "false");
      }
      if (tile.open) {
        requestAnimationFrame(() => syncTileBodyHeight(tile));
        requestAnimationFrame(() => {
          tile.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      }
      const next = {};
      tiles.forEach((t) => {
        next[t.dataset.tile] = t.open;
      });
      localStorage.setItem(KEY, JSON.stringify(next));
    });
  });

  window.addEventListener("resize", syncAllHeights);
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
  $("stageBadge").textContent = text || t("status.idle");
}

function setModelStatus(text) {
  $("modelStatus").textContent = text || "";
}

function setLoadedBadge() {
  const b = $("loadedBadge");
  if (!state.loaded) {
    b.textContent = t("status.no_model");
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
  chip.textContent = role === "assistant" ? t("role.assistant") : t("role.you");

  roleLine.appendChild(chip);

  if (role === "assistant") {
    const actions = document.createElement("div");
    actions.className = "msg-actions";

    const btnCopy = document.createElement("button");
    btnCopy.className = "msg-action";
    btnCopy.textContent = t("btn.copy");
    btnCopy.onclick = async () => {
      const ok = await copyTextToClipboard(bubble.dataset.raw || "");
      toast(ok ? t("toast.copied") : t("toast.copy_failed"));
    };

    const btnRegen = document.createElement("button");
    btnRegen.className = "msg-action primary";
    btnRegen.textContent = t("btn.regenerate");
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
    parts.push(t("meta.file_context", { chars: data.fileChars, truncated: data.fileTruncated ? t("meta.truncated") : "" }));
  }
  if (typeof data.elapsedMs === "number") {
    parts.push(t("meta.elapsed", { ms: data.elapsedMs }));
  }
  if (typeof data.outputChars === "number") {
    parts.push(t("meta.output", { chars: data.outputChars }));
  }
  if (data.cancelled) {
    parts.push(t("meta.stopped_by_user"));
  }
  if (data.finishReason) {
    parts.push(t("meta.result", { reason: data.finishReason }));
  }
  metaEl.textContent = parts.join(" · ");
}

/* ---------- Workspace ---------- */
function wsClear() { $("wsText").textContent = ""; }
function wsShow(show) {
  const ws = $("workspace");
  const app = document.querySelector(".app");
  ws.classList.toggle("hidden", !show);
  ws.setAttribute("aria-hidden", show ? "false" : "true");
  if (app) app.classList.toggle("workspace-open", !!show);
}

/* ---------- Models ---------- */
async function refreshModels() {
  setModelStatus(t("status.refreshing"));
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
  if (s === "ready" && state.loaded) setModelStatus(t("status.ready_model", { provider: state.loaded.provider, model: state.loaded.model_id }));
  else if (s === "idle") setModelStatus(t("status.idle_select_load"));
  else if (s === "loading") setModelStatus(t("status.loading"));
  else if (s === "error") setModelStatus(t("status.error", { error: data.state.error || t("status.unknown") }));
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
    opt.textContent = t("status.no_models_found");
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
  setModelStatus(t("status.loading"));
  const data = await apiPost("/api/models/load", { provider, model_id, params: {} });
  state.loaded = data.loaded;
  setLoadedBadge();
  setModelStatus(data.status === "ready" ? t("status.ready_model", { provider: state.loaded.provider, model: state.loaded.model_id }) : data.status);
  syncThinkModeOptions();
}

async function unloadModel() {
  const data = await apiPost("/api/models/unload", {});
  state.loaded = data.loaded;
  setLoadedBadge();
  setModelStatus(t("status.unloaded"));
  syncThinkModeOptions();
}

/* ---------- Sessions ---------- */
async function refreshSessions() {
  const items = await apiGet("/api/sessions");
  const q = ($("sessionSearch")?.value || "").trim().toLowerCase();
  const filtered = q
    ? items.filter((s) => {
      const t = (s.title || "").toLowerCase();
      const g = (s.group || "").toLowerCase();
      return t.includes(q) || g.includes(q);
    })
    : items;
  const container = $("sessions");
  container.innerHTML = "";

  const grouped = new Map();
  for (const s of filtered) {
    const groupName = (s.group || t("session.ungrouped")).trim() || t("session.ungrouped");
    if (!grouped.has(groupName)) grouped.set(groupName, []);
    grouped.get(groupName).push(s);
  }

  for (const [groupName, list] of grouped.entries()) {
    const head = document.createElement("div");
    head.className = "session-group-title";
    head.textContent = groupName;
    container.appendChild(head);

    for (const s of list) {
      const div = document.createElement("div");
      div.className = "session-item" + (state.currentSessionId === s.id ? " active" : "");
      div.innerHTML = `<span class="session-title">${escapeHtml(s.title || t("session.new_chat"))}</span><span class="session-meta">${escapeHtml(groupName)}</span>`;
      div.onclick = async () => {
        state.currentSessionId = s.id;
        await openSession(s.id);
        await refreshSessions();
      };
      container.appendChild(div);
    }
  }

  if (!state.currentSessionId && items.length) {
    state.currentSessionId = items[0].id;
    await openSession(items[0].id);
    await refreshSessions();
  }
}

async function newSession() {
  const r = await apiPost("/api/sessions", { title: t("session.new_chat") });
  state.currentSessionId = r.id;
  await openSession(r.id);
  await refreshSessions();
}

async function renameSession() {
  if (!state.currentSessionId) return;
  const title = prompt(t("prompt.new_title"));
  if (!title) return;
  await apiPatch(`/api/sessions/${state.currentSessionId}`, { title });
  await refreshSessions();
}

async function archiveSession() {
  if (!state.currentSessionId) return;
  const ok = confirm(t("confirm.archive"));
  if (!ok) return;
  await apiDelete(`/api/sessions/${state.currentSessionId}`);
  state.currentSessionId = null;
  clearUI();
  await refreshSessions();
  await refreshArchives();
}

async function deleteSession() {
  if (!state.currentSessionId) return;
  const ok = confirm(t("confirm.delete_session"));
  if (!ok) return;
  await apiDelete(`/api/sessions/${state.currentSessionId}/hard`);
  state.currentSessionId = null;
  clearUI();
  await refreshSessions();
}

async function setSessionGroup() {
  if (!state.currentSessionId) return;
  const group = ($("sessionGroup")?.value || "").trim();
  if (!group) {
    alert(t("alert.enter_group_name"));
    return;
  }
  await apiPatch(`/api/sessions/${state.currentSessionId}`, { group });
  await refreshSessions();
}

async function refreshArchives() {
  const items = await apiGet("/api/archives");
  const box = $("archives");
  box.innerHTML = "";
  if (!items.length) {
    state.selectedArchiveId = null;
    $("archiveContent").value = "";
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = t("archive.none");
    box.appendChild(empty);
    return;
  }

  if (state.selectedArchiveId && !items.some((a) => a.archive_id === state.selectedArchiveId)) {
    state.selectedArchiveId = null;
    $("archiveContent").value = "";
  }

  for (const a of items) {
    const div = document.createElement("div");
    const active = state.selectedArchiveId === a.archive_id;
    div.className = "archive-item" + (active ? " active" : "");
    const ts = new Date((a.archived_at || 0) * 1000).toLocaleString();
    div.innerHTML = `<div class="archive-title">${escapeHtml(a.title || t("archive.untitled"))}</div><div class="archive-meta">${escapeHtml(a.group || t("session.ungrouped"))} · ${escapeHtml(ts)}</div>`;
    div.onclick = async () => {
      const detail = await apiGet(`/api/archives/${a.archive_id}`);
      state.selectedArchiveId = a.archive_id;
      $("archiveContent").value = detail.content || "";
      await refreshArchives();
    };
    box.appendChild(div);
  }
}

async function deleteArchive() {
  if (!state.selectedArchiveId) {
    alert(t("alert.select_archive_first"));
    return;
  }
  const ok = confirm(t("confirm.delete_archive"));
  if (!ok) return;
  await apiDelete(`/api/archives/${state.selectedArchiveId}`);
  state.selectedArchiveId = null;
  $("archiveContent").value = "";
  await refreshArchives();
}

async function exportSession() {
  if (!state.currentSessionId) return;
  const url = `/api/sessions/${state.currentSessionId}/export.md`;
  const r = await fetch(url);
  if (!r.ok) {
    alert(t("alert.export_failed"));
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
    alert(t("alert.export_json_failed"));
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

async function exportAllSessions() {
  const r = await fetch('/api/export/sessions.json');
  if (!r.ok) {
    alert(t('alert.backup_failed'));
    return;
  }
  const data = await r.json();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `snlite_backup_${ts}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importAllSessions() {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.json,application/json';
  picker.onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      alert(t('alert.invalid_json'));
      return;
    }
    const sessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
    if (!sessions.length) {
      alert(t('alert.no_sessions_in_backup'));
      return;
    }
    const replace = confirm(t('confirm.import_mode'));
    const mode = replace ? 'replace' : 'append';
    const result = await apiPost('/api/sessions/import.json', { sessions, mode });
    alert(t('alert.import_done', { imported: result.imported, skipped: result.skipped }));
    await refreshSessions();
  };
  picker.click();
}

async function compactSessions() {
  const ok = confirm(t('confirm.compact'));
  if (!ok) return;
  const result = await apiPost('/api/sessions/compact', {});
  alert(t('alert.compaction_done', { before: result.before, after: result.after, saved: result.saved }));
}

async function openSession(sessionId) {
  const sess = await apiGet(`/api/sessions/${sessionId}`);
  if ($("sessionGroup")) {
    $("sessionGroup").value = sess.group || "";
  }
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
    if (![t("session.new_chat"), "New Chat", "新聊天"].some((x) => sess.title === x || (sess.title || "").startsWith(x))) return;
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
  $("imageName").textContent = name || t("image.default_name");
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
  stat.textContent = t("files.enabled_summary", { enabled: enabledCount, total: attachedFiles.length, max: FILE_MAX_COUNT });
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
    toggle.textContent = f.enabled === false ? t("btn.enable") : t("btn.disable");
    toggle.onclick = () => {
      attachedFiles[idx].enabled = !(attachedFiles[idx].enabled !== false);
      renderFileList();
      clearFileInspect();
    };

    const btn = document.createElement("button");
    btn.className = "file-remove";
    btn.textContent = t("btn.remove");
    btn.onclick = () => {
      attachedFiles.splice(idx, 1);
      renderFileList();
      clearFileInspect();
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
  clearFileInspect();
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

function clearFileInspect() {
  const el = $("fileInspect");
  if (!el) return;
  el.style.display = "none";
  el.textContent = "";
}

async function inspectAttachedFiles() {
  const active = attachedFiles.filter((f) => f.enabled !== false);
  if (!active.length) {
    alert(t("alert.no_enabled_files"));
    clearFileInspect();
    return;
  }
  const btn = $("btnInspectFiles");
  btn.disabled = true;
  btn.textContent = t("status.inspecting");
  try {
    const result = await apiPost('/api/files/inspect', { files: active });
    const files = result?.meta?.files || [];
    const total = Number(result?.meta?.total_chars || 0);
    const truncated = !!result?.meta?.truncated;
    const lines = files.map((f) => {
      const flag = f.truncated ? t('meta.truncated_short') : '';
      return t('files.inspect_line', { name: f.name, status: f.status, chars: f.chars || 0, flag });
    });
    const msg = [t('files.inspect_summary', { count: files.length, chars: total, truncated: truncated ? t('meta.truncated') : '' }), ...lines].join('\n');
    const el = $("fileInspect");
    el.style.display = "block";
    el.textContent = msg;
  } catch (err) {
    alert(t("alert.inspect_failed", { message: err.message }));
  } finally {
    btn.disabled = false;
    btn.textContent = t("btn.inspect_files");
  }
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
  toast(ok ? t("toast.copied") : t("toast.copy_failed"));
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

  setStage(t("stage.answering"));

  const body = {
    session_id: state.currentSessionId,
    show_trace: showTrace,
    retry_mode: $("retryMode")?.value || "keep_params",
  };

  const resp = await fetch("/api/chat/regenerate/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    state.streaming = false;
    $("btnSend").disabled = false;
    $("btnStop").disabled = true;
    setStage(t("status.idle"));
    const err = await resp.text();
    setMessageContent(assistantMsg.contentEl, `Error: ${err}`, assistantMsg.bubble);
    updateRegenButtons();
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let assistantRaw = "";
  const streamMeta = { fileChars: 0, fileTruncated: false, elapsedMs: null, outputChars: null, cancelled: false, finishReason: "" };

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
            if (s.stage === "thinking") setStage(t("stage.thinking"));
            if (s.stage === "answering") setStage(t("stage.answering"));
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
          assistantRaw += `\n${t("stream.error_prefix")} ${dataLine}`;
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
            streamMeta.finishReason = obj.finish_reason || "";
            if (obj.finish_reason === "cancelled") {
              assistantRaw += `\n\n${t("stream.generation_stopped")}`;
              setMessageContent(assistantMsg.contentEl, assistantRaw, assistantMsg.bubble);
            } else if (obj.finish_reason === "failed") {
              assistantRaw += `\n\n${t("stream.generation_failed")}`;
              setMessageContent(assistantMsg.contentEl, assistantRaw, assistantMsg.bubble);
            } else if (obj.finish_reason === "interrupted") {
              assistantRaw += `\n\n${t("stream.generation_interrupted")}`;
              setMessageContent(assistantMsg.contentEl, assistantRaw, assistantMsg.bubble);
            }
            setAssistantMeta(assistantMsg.metaEl, streamMeta);
          } catch {}
          setStage(t("status.idle"));
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
    setStage(t("status.idle"));

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
    alert(t("alert.load_model_first"));
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

  setStage(t("stage.answering"));

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
    setStage(t("status.idle"));
    setMessageContent(assistantMsg.contentEl, `${t("status.error_prefix")} ${await resp.text()}`, assistantMsg.bubble);
    updateRegenButtons();
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let assistantRaw = "";
  const streamMeta = { fileChars: 0, fileTruncated: false, elapsedMs: null, outputChars: null, cancelled: false, finishReason: "" };

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
            if (s.stage === "thinking") setStage(t("stage.thinking"));
            if (s.stage === "answering") setStage(t("stage.answering"));
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
          assistantRaw += `\n${t("stream.error_prefix")} ${dataLine}`;
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
            streamMeta.finishReason = obj.finish_reason || "";
            if (obj.finish_reason === "cancelled") {
              assistantRaw += `\n\n${t("stream.generation_stopped")}`;
              setMessageContent(assistantMsg.contentEl, assistantRaw, assistantMsg.bubble);
            } else if (obj.finish_reason === "failed") {
              assistantRaw += `\n\n${t("stream.generation_failed")}`;
              setMessageContent(assistantMsg.contentEl, assistantRaw, assistantMsg.bubble);
            } else if (obj.finish_reason === "interrupted") {
              assistantRaw += `\n\n${t("stream.generation_interrupted")}`;
              setMessageContent(assistantMsg.contentEl, assistantRaw, assistantMsg.bubble);
            }
            setAssistantMeta(assistantMsg.metaEl, streamMeta);
          } catch {}
          setStage(t("status.idle"));
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
    setStage(t("status.idle"));

    await maybeAutoTitle(state.currentSessionId);
    await refreshSessions();
    updateRegenButtons();
    maybeAutoScroll(false);
    updateChatSearch();
  }
}

/* ---------- Init ---------- */
async function init() {
  initUIStyle();
  installSidebarTiles();
  installHelpTooltips(); // ✅ v0.5.2
  await initI18n();

  $("btnRefresh").onclick = refreshModels;
  $("btnLoad").onclick = loadModel;
  $("btnUnload").onclick = unloadModel;

  $("providerSelect").onchange = async (e) => {
    await refreshModelListForProvider(e.target.value);
  };
  $("modelSelect").onchange = () => syncThinkModeOptions();

  $("btnNewSession").onclick = newSession;
  $("btnRenameSession").onclick = renameSession;
  $("btnArchiveSession").onclick = archiveSession;
  $("btnDeleteSession").onclick = deleteSession;
  $("btnSetGroup").onclick = setSessionGroup;
  $("btnExport").onclick = exportSession;
  $("btnExportJson").onclick = exportSessionJson;
  $("btnExportAll").onclick = exportAllSessions;
  $("btnImportAll").onclick = importAllSessions;
  $("btnCompact").onclick = compactSessions;
  $("btnRefreshArchives").onclick = refreshArchives;
  $("btnDeleteArchive").onclick = deleteArchive;

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
      alert(t("alert.choose_image_file"));
      clearAttachedImage();
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      alert(t("alert.image_too_large"));
      clearAttachedImage();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachedImage(file.name, reader.result);
    reader.readAsDataURL(file);
  });

  // Files
  $("btnAttachFiles").onclick = () => $("docFiles").click();
  $("btnInspectFiles").onclick = inspectAttachedFiles;
  $("docFiles").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const f of files) {
      if (attachedFiles.length >= FILE_MAX_COUNT) {
        alert(t("alert.max_files_allowed", { max: FILE_MAX_COUNT }));
        break;
      }
      if (f.size > FILE_MAX_BYTES) {
        alert(t("alert.file_too_large", { name: f.name }));
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
    clearFileInspect();
    $("docFiles").value = "";
  });

  wsShow(false);
  clearAttachedImage();
  clearAttachedFiles();

  setStage(t("status.idle"));
  await refreshModels();
  await refreshSessions();
  await refreshArchives();

  userScrolledUp = false;
  maybeAutoScroll(true);
  updateRegenButtons();
  updateChatSearch();
}

init().catch(err => {
  console.error(err);
  setModelStatus(t("status.init_error", { message: err.message }));
  setStage(t("status.idle"));
});
