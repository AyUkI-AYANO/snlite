from __future__ import annotations

import os
import uvicorn


def run() -> None:
    host = os.getenv("NEOSNL_HOST", "127.0.0.1")
    port = int(os.getenv("NEOSNL_PORT", "8010"))
    uvicorn.run("neosnl.main:app", host=host, port=port, reload=False)
