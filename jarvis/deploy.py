"""CRX prod deploy gate.

The Jarvis container has no docker access. On an APPROVED /golive it drops a
request file into STATE_DIR — which is bind-mounted to the host (/root/jarvis/state).
A host-side systemd path unit (crx-prod-deploy) sees the file, rotates the live
container to ghcr.io/crxnetwork/ui:prod-latest, and writes the result back here.
So the single Telegram poller (locked to Max's chat) is the only consent gate,
and docker never enters the bot.
"""
from __future__ import annotations

import secrets
import time

from .config import STATE_DIR

REQUEST = STATE_DIR / "deploy.request"
RESULT = STATE_DIR / "deploy.result"


VALID_TARGETS = ("app", "docs", "landing", "blog", "solver-dash", "faucet", "dataroom", "developers", "portal", "explorer")


def run_deploy(target: str, timeout: int = 240) -> str:
    """Request a per-surface prod deploy and block until the host writes the result.

    target is one of app | docs | landing. Runs in a worker thread (via
    asyncio.to_thread) so it never blocks the Telegram poll loop.
    """
    if target not in VALID_TARGETS:
        return f"unknown target: {target}"
    try:
        RESULT.unlink()
    except FileNotFoundError:
        pass
    REQUEST.write_text(f"{target}\n{secrets.token_hex(8)}\n")
    deadline = time.time() + timeout
    while time.time() < deadline:
        if RESULT.exists():
            out = RESULT.read_text().strip()
            try:
                RESULT.unlink()
            except FileNotFoundError:
                pass
            return out or "deploy finished (no output)."
        time.sleep(2)
    return "timed out waiting for the host deployer — check VPS3 (journalctl -u crx-prod-deploy)."
