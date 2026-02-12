# SNLite / NeoSNL

**SNLite** continues as the classic local-first GenAI chat app.  
**NeoSNL 8.0.1** is an experimental, independent runtime that can coexist on the same machine and is started with a new command: `neosnl`.

> SNLite keeps `snlite` command and default port `8000`.
> NeoSNL uses `neosnl` command and default port `8010`.

---

## 8.0.1 Experimental Direction

NeoSNL introduces a new lightweight experimental runtime (separate module namespace `neosnl.*`) with:

- **Prompt Duel (experimental)**
  - Send one prompt to the same model twice with different temperatures
  - Compare two outputs side-by-side for creativity vs stability evaluation
- **Independent app identity**
  - New API root and app metadata (`NeoSNL`, version `8.0.1`)
  - No dependency on `snlite.*` runtime modules
- **Coexistence with SNLite**
  - Keep old `snlite` command unchanged
  - Add new `neosnl` command for isolated launch

---

## Install

```bash
git clone https://github.com/AyUkI-AYANO/snlite
cd snlite
pip install -e .
```

---

## Run

Classic SNLite:

```bash
snlite
```

Experimental NeoSNL:

```bash
neosnl
```

Default addresses:

- SNLite: `http://127.0.0.1:8000`
- NeoSNL: `http://127.0.0.1:8010`

---

## Environment Variables

SNLite:

```bash
SNLITE_HOST=127.0.0.1
SNLITE_PORT=8000
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

NeoSNL:

```bash
NEOSNL_HOST=127.0.0.1
NEOSNL_PORT=8010
NEOSNL_OLLAMA_BASE=http://127.0.0.1:11434
```

---

## Changelog

### v8.0.1

Added

- Added independent experimental runtime package: `neosnl`
- Added new executable command: `neosnl`
- Added experimental **Prompt Duel** feature (`/api/experiment/duel`) to compare two temperatures in parallel
- Updated project version to `8.0.1`

### v7.1.1 and below

See previous release history in Git.
