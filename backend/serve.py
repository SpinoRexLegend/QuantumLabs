from __future__ import annotations

import threading
import time
import urllib.request
import webbrowser

import uvicorn
from app import app


URL = "http://127.0.0.1:8000"


def open_when_ready() -> None:
    for _ in range(60):
        try:
            with urllib.request.urlopen(f"{URL}/api/health", timeout=0.5) as response:
                if response.status == 200:
                    webbrowser.open(URL)
                    return
        except OSError:
            time.sleep(0.25)


if __name__ == "__main__":
    threading.Thread(target=open_when_ready, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
