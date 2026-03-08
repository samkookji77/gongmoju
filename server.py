#!/usr/bin/env python3
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from app.db import load_all_items, load_meta
from app.service import ensure_bootstrap, refresh_from_source

ROOT = Path(__file__).resolve().parent


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_json(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.end_json(200, {"ok": True})
            return
        if parsed.path == "/api/meta":
            meta = load_meta()
            self.end_json(200, {"ok": True, **meta})
            return
        if parsed.path == "/api/events":
            qs = parse_qs(parsed.query)
            market = (qs.get("market", ["ALL"])[0] or "ALL").upper()
            items = load_all_items(None if market == "ALL" else market)
            meta = load_meta()
            self.end_json(200, {"ok": True, "items": items, **meta})
            return
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/refresh":
            self.end_json(404, {"ok": False, "error": "Not found"})
            return

        try:
            payload = refresh_from_source()
            self.end_json(
                200,
                {
                    "ok": True,
                    "message": f"Wrote {len(payload.get('items', []))} items",
                    "updatedAt": payload.get("updatedAt"),
                    "count": len(payload.get("items", [])),
                },
            )
        except Exception as e:
            self.end_json(500, {"ok": False, "error": str(e)})


def run():
    ensure_bootstrap()
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "5173"))
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Serving on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
