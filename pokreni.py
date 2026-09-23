#!/usr/bin/env python3
"""Lokalni poslužitelj čitaonice. Lista svaki HTML iz mape knjige/."""
from __future__ import annotations

import json
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
KNJIGE = ROOT / "knjige"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


def meta(html: str, name: str) -> str:
    m = re.search(
        rf'<meta\s+name=["\']{re.escape(name)}["\']\s+content=["\']([^"\']*)["\']',
        html,
        re.I,
    )
    return m.group(1).strip() if m else ""


def title_tag(html: str) -> str:
    m = re.search(r"<title>([^<]+)</title>", html, re.I)
    if not m:
        return ""
    return re.split(r"\s+[—–-]\s+", m.group(1).strip())[0].strip()


def lang_of(html: str, fallback: str) -> str:
    m = re.search(r"<html[^>]*\slang=["\']([^"\']+)["\']", html, re.I)
    return (m.group(1) if m else fallback).lower()


def subtitle_of(html: str) -> str:
    m = re.search(r'<p class="subtitle">([^<]+)</p>', html)
    return m.group(1).strip() if m else ""


def author_of(html: str) -> str:
    m = re.search(r'<meta\s+name=["\']author["\']\s+content=["\']([^"\']+)["\']', html, re.I)
    return m.group(1).strip() if m else ""


LANG_LABEL = {
    "hr": "Hrvatski",
    "sr": "Srpski",
    "bs": "Bosanski",
    "en": "English",
}


def describe(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8", errors="replace")[:24000]
    code = lang_of(raw, "hr")
    return {
        "file": path.name,
        "href": f"knjige/{path.name}",
        "title": meta(raw, "book-title") or title_tag(raw) or path.stem,
        "subtitle": meta(raw, "book-subtitle") or subtitle_of(raw),
        "author": meta(raw, "book-author") or author_of(raw),
        "lang": code,
        "langLabel": meta(raw, "book-lang") or LANG_LABEL.get(code[:2], code),
    }


def catalog() -> list:
    if not KNJIGE.is_dir():
        return []
    books = []
    for p in sorted(KNJIGE.glob("*.html"), key=lambda x: x.name.lower()):
        try:
            books.append(describe(p))
        except OSError:
            continue
    return books


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.split("?", 1)[0] in ("/api/knjige", "/knjige.json"):
            payload = json.dumps(catalog(), ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        return super().do_GET()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))


if __name__ == "__main__":
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Čitaonica:  http://127.0.0.1:{PORT}/")
    print("Stavi novi HTML u mapu knjige/ i osvježi početnu stranicu.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nZaustavljeno.")
