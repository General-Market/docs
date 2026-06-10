#!/usr/bin/env python3
"""hyperfeed enrichment sidecar — runs on the VPS3 HOST, not in the container.

When the bot fires an outlier, it POSTs the tweet here. We run `codex exec` with web search
ON (the same ChatGPT-login pipeline family-chat / docs-AI use) to find data that confirms or
disputes the tweet's claims, sourced — who said what. The bot appends the result to its alert.

The container can't run codex (no binary, no auth), so this lives on the host and binds the
docker bridge gateway. codex invocation copied from /opt/family-chat/server.js:
  codex exec -m <model> --skip-git-repo-check --sandbox workspace-write
    -c sandbox_workspace_write.network_access=true -c tools.web_search=true -o <file> -C <ws>
  env: HOME=<codex home dir>, CODEX_HOME=<.codex>
"""
from __future__ import annotations

import json
import os
import subprocess
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

CODEX_BIN = os.environ.get("CODEX_BIN", "codex")
CODEX_HOME = os.environ.get("CODEX_HOME", "/opt/docsai/.codex")
HOME_DIR = os.environ.get("HOME_DIR", "/opt/docsai")
MODEL = os.environ.get("CODEX_MODEL", "gpt-5.5")
WORKSPACE = Path(os.environ.get("WORKSPACE", "/root/hyperfeed-enrich/workspace"))
BIND_ADDR = os.environ.get("BIND_ADDR", "172.17.0.1")
PORT = int(os.environ.get("PORT", "8092"))
TIMEOUT_S = int(os.environ.get("CODEX_TIMEOUT_S", "150"))

WORKSPACE.mkdir(parents=True, exist_ok=True)

# codex is heavy; serialize runs so concurrent outliers queue rather than fork a swarm.
_lock = threading.Lock()

PROMPT = """You decide whether a Hyperliquid/crypto tweet makes a CONCRETE, CHECKABLE factual claim, and if so you verify it on the web for a professional trading audience.

Tweet by @{handle}:
\"\"\"{text}\"\"\"

STEP 1 — judge. If the tweet has no specific verifiable factual claim — it is an image/meme,
an opinion, hype, a greeting (gm), a question, price vibes, an emoji/one-liner, or just a link —
reply with EXACTLY one word and nothing else: SKIP

STEP 2 — only if there IS a concrete claim (a number, an event, a launch, a record, a named
fact, a comparison), search the web NOW and reply in EXACTLY this shape, under 600 characters:
STANCE: CONFIRMS / DISPUTES / ADDS CONTEXT / UNVERIFIED
WHY: 2-3 sentences of the most useful facts that confirm or contradict the claim.
SOURCES: 1-3 items, each as "<who said it> — <publication>: <url>".

Hard rules:
- Never comment on whether a link or image was accessible. If you cannot see linked media, that is SKIP, not a finding.
- Never invent a search from a hashtag, meme word, or vibe. Only verify an explicit factual claim.
- Never write the words t.co, x.com, or twitter, and never include a link to them.
- Attribute every fact to who said it. UNVERIFIED only for a REAL claim you could not confirm — one line on what's missing.
- Be neutral and concise."""


def run_codex(text: str, handle: str) -> dict:
    prompt = PROMPT.format(handle=handle or "?", text=(text or "")[:1200])
    ans_file = WORKSPACE / f".ans-{uuid.uuid4().hex[:8]}.txt"
    args = [
        CODEX_BIN, "exec", "-m", MODEL,
        "--ignore-user-config",   # codex home's config.toml is root-owned 0600; skip it, auth.json still loads
        "--skip-git-repo-check",
        "--sandbox", "workspace-write",
        "-c", "sandbox_workspace_write.network_access=true",
        "-c", "tools.web_search=true",
        "-o", str(ans_file),
        "-C", str(WORKSPACE),
    ]
    env = {"PATH": os.environ.get("PATH", ""), "HOME": HOME_DIR, "CODEX_HOME": CODEX_HOME}
    with _lock:
        try:
            subprocess.run(
                args, input=prompt.encode(), env=env, cwd=str(WORKSPACE),
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=TIMEOUT_S,
            )
        except subprocess.TimeoutExpired:
            return {"ok": False, "reason": "timeout"}
        except Exception as e:
            return {"ok": False, "reason": f"spawn:{e}"}
        finally:
            answer = ""
            try:
                answer = ans_file.read_text().strip()
            except Exception:
                pass
            try:
                ans_file.unlink()
            except Exception:
                pass
    if not answer:
        return {"ok": False, "reason": "empty"}
    head = answer.strip().upper()
    if head == "SKIP" or head.startswith("SKIP"):
        return {"ok": False, "reason": "skip"}   # no real claim — bot sends nothing
    # A model that ignored the rules and talked about link/image access = no usable claim.
    low = answer.lower()
    if "stance:" not in low or any(p in low for p in ("not publicly accessible", "could not access", "link resolves", "image/status")):
        return {"ok": False, "reason": "no_claim"}
    return {"ok": True, "text": answer}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, obj: dict) -> None:
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # health
        self._send(200, {"ok": True, "service": "hyperfeed-enrich", "model": MODEL})

    def do_POST(self):
        if self.path.rstrip("/") != "/enrich":
            return self._send(404, {"ok": False, "reason": "not found"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            req = json.loads(self.rfile.read(n) or b"{}")
        except Exception as e:
            return self._send(400, {"ok": False, "reason": f"bad json:{e}"})
        text = (req.get("text") or "").strip()
        if not text:
            return self._send(400, {"ok": False, "reason": "no text"})
        self._send(200, run_codex(text, req.get("handle") or ""))

    def log_message(self, *a):  # quiet
        pass


def main() -> None:
    srv = ThreadingHTTPServer((BIND_ADDR, PORT), Handler)
    print(f"hyperfeed-enrich on {BIND_ADDR}:{PORT}, model {MODEL}, web search ON", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
