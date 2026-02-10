# SNLite

**SNLite** is a lightweight, local-first GenAI chat UI built on top of **Ollama**.  
It runs entirely on `localhost`, focuses on clarity and hackability, and exposes advanced features like **native thinking traces**, **image input**, and **document-assisted chat** — without becoming bloated.

> Minimal UI · Streaming · Local only · No cloud lock-in

---

## Features

- 🧠 **Ollama native thinking support**
  - Separates `thinking` and final answer
  - Optional right-side workspace for trace inspection
- 💬 **Streaming chat UI**
  - Token-by-token output
  - Auto-scroll during generation (pauses when you scroll up)
- 🖼 **Image input**
  - For multimodal models (e.g. LLaVA, Qwen-VL)
- 📄 **File attachments**
  - PDF / DOCX / TXT / MD
  - Text is extracted and injected into the prompt (no binary storage)
- 🗂 **Sessions with auto titles**
  - First user message → automatic chat title
- 🧩 **Lightweight & hackable**
  - No frontend framework
  - Plain FastAPI + vanilla JS

---

## Requirements

- Python **3.10+**
- **Ollama** installed and running  
  👉 https://ollama.com

Check:
```bash
ollama --version
ollama list
```

---

## Install

```bash
git clone https://github.com/AyUkI-AYANO/snlite
cd snlite
pip install -e .
```

---

## run

```bash
snlite
```

Open on browser:
127.0.0.1:8000

Environment variables (optional):
```bash
SNLITE_HOST=127.0.0.1
SNLITE_PORT=8000
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

---

### Usage Notes

Models

Load models from the sidebar (via Ollama).

Image input requires multimodal models.

Thinking trace requires thinking-capable models (e.g. Qwen 3, DeepSeek R1, GPT-OSS).

Thinking Mode

auto – use model default

on / off – boolean (most models)

low / medium / high – GPT-OSS only

Thinking trace is never written to session history.

File Attachments

Max 3 files, each ≤ 6MB

Extracted text is truncated and injected into the current prompt

Scanned PDFs (image-only) are not OCR’d in v0.5.0

---

### Export

Export any session as Markdown (.md)

---

### Project Structure

```bash
snlite/
├─ snlite/
│  ├─ main.py
│  ├─ web/
│  │  ├─ index.html
│  │  ├─ style.css
│  │  └─ app.js
│  ├─ providers/
│  │  └─ ollama.py
│  ├─ store.py
│  └─ registry.py
├─ pyproject.toml
└─ README.md
```

---

### Changelog

v0.5.0

Auto-scroll during streaming (smart pause on manual scroll)

Clear visual separation between user / assistant messages

File attachments (PDF / DOCX / TXT / MD)

Improved long-content readability

v0.4.x

Native Ollama thinking trace support

Dedicated thinking workspace

Image input support

Markdown rendering fixes

v0.3.x

Per-setting explanations (tooltips)

Auto chat title generation

v0.2.x

UI refinements

Initial “deep thinking” concept

v0.1.0

Initial local chat UI

Model loading + basic conversation

---

