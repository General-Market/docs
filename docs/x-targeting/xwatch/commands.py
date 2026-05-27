"""Telegram command handling. Every setting the daemon reads is settable here.

Commands (reply in the chat):
  /status                 current settings + today's spend
  /query <text>           set the search topic
  /threshold <n>          set min likes to ping
  /lang <code|off>        restrict language (e.g. en) or disable
  /lookback <hours>       how far back each scan looks
  /window <start> <end>   active hours, local clock (e.g. /window 10 22)
  /interval <minutes>     minutes between scans (applied next tick)
  /max <n>                max pings per scan
  /calibrate              one pass: recommend a threshold + list influencers
  /scan                   force a scan right now
  /pause   /resume        stop / start scanning (commands still work)
  /help                   this list
"""
from __future__ import annotations

import html
import logging

from . import config

log = logging.getLogger("xwatch.cmd")

HELP = (
    "<b>xwatch commands</b>\n"
    "<code>/status</code> — settings + today's spend\n"
    "<code>/query &lt;text&gt;</code> — set the search topic\n"
    "<code>/threshold &lt;n&gt;</code> — min likes to ping\n"
    "<code>/lang &lt;code|off&gt;</code> — language filter\n"
    "<code>/lookback &lt;hours&gt;</code> — scan window depth\n"
    "<code>/window &lt;start&gt; &lt;end&gt;</code> — active hours, your clock\n"
    "<code>/interval &lt;minutes&gt;</code> — minutes between scans\n"
    "<code>/max &lt;n&gt;</code> — max pings per scan\n"
    "<code>/calibrate</code> — recommend a threshold + influencers\n"
    "<code>/scan</code> — force a scan now\n"
    "<code>/pause</code> · <code>/resume</code>\n"
)


def _status_text(settings: dict, spend_usd: float, calls: int) -> str:
    return (
        "<b>xwatch status</b>\n"
        f"query: <code>{html.escape(settings['query'])}</code>\n"
        f"threshold: <b>{settings['threshold']}</b> likes\n"
        f"lang: {settings['lang'] or 'any'}\n"
        f"lookback: {settings['lookback_hours']}h\n"
        f"window: {settings['start_hour']:02d}:00–{settings['end_hour']:02d}:00 local\n"
        f"interval: {settings['scan_interval_min']} min\n"
        f"max pings/scan: {settings['max_pings_per_scan']}\n"
        f"state: {'PAUSED' if settings['paused'] else 'running'}\n"
        f"today: {calls} API calls · ~${spend_usd:.4f} "
        f"(cap ${settings['daily_cap_usd']})"
    )


def handle(text: str, settings: dict, ctx) -> dict:
    """Process one command. Returns {'reply': str|None, 'action': str|None}.

    ctx exposes: ctx.scan_now() -> str, ctx.calibrate() -> str, ctx.spend() -> (usd, calls).
    Settings are mutated in place and persisted by the caller when 'changed' is True.
    """
    text = text.strip()
    if not text.startswith("/"):
        return {"reply": None}
    parts = text.split()
    cmd = parts[0].lstrip("/").split("@")[0].lower()
    arg = text[len(parts[0]):].strip()
    changed = False
    reply = None

    if cmd in ("help", "start"):
        reply = HELP
    elif cmd == "status":
        usd, calls = ctx.spend()
        reply = _status_text(settings, usd, calls)
    elif cmd == "query":
        if not arg:
            reply = "Usage: <code>/query insider trading</code>"
        else:
            settings["query"] = arg
            changed = True
            reply = f"Query set to <code>{html.escape(arg)}</code>"
    elif cmd == "threshold":
        try:
            settings["threshold"] = max(0, int(arg))
            changed = True
            reply = f"Threshold set to <b>{settings['threshold']}</b> likes"
        except ValueError:
            reply = "Usage: <code>/threshold 15</code>"
    elif cmd == "lang":
        val = arg.lower()
        settings["lang"] = "" if val in ("off", "any", "") else val
        changed = True
        reply = f"Language filter: {settings['lang'] or 'any'}"
    elif cmd == "lookback":
        try:
            settings["lookback_hours"] = max(1, min(24, int(arg)))
            changed = True
            reply = f"Lookback set to {settings['lookback_hours']}h"
        except ValueError:
            reply = "Usage: <code>/lookback 3</code>"
    elif cmd == "window":
        try:
            a, b = arg.split()
            sh, eh = int(a), int(b)
            if not (0 <= sh <= 23 and 1 <= eh <= 24 and sh < eh):
                raise ValueError
            settings["start_hour"], settings["end_hour"] = sh, eh
            changed = True
            reply = f"Window set to {sh:02d}:00–{eh:02d}:00 local"
        except (ValueError, IndexError):
            reply = "Usage: <code>/window 10 22</code> (start &lt; end, 0–24)"
    elif cmd == "interval":
        try:
            settings["scan_interval_min"] = max(5, int(arg))
            changed = True
            reply = f"Interval set to {settings['scan_interval_min']} min (next tick)"
        except ValueError:
            reply = "Usage: <code>/interval 30</code>"
    elif cmd == "max":
        try:
            settings["max_pings_per_scan"] = max(1, min(20, int(arg)))
            changed = True
            reply = f"Max pings per scan: {settings['max_pings_per_scan']}"
        except ValueError:
            reply = "Usage: <code>/max 8</code>"
    elif cmd == "pause":
        settings["paused"] = True
        changed = True
        reply = "Paused. Scans stopped; commands still work. <code>/resume</code> to restart."
    elif cmd == "resume":
        settings["paused"] = False
        changed = True
        reply = "Resumed."
    elif cmd == "calibrate":
        reply = ctx.calibrate()
    elif cmd == "scan":
        reply = ctx.scan_now()
    else:
        reply = f"Unknown command <code>{html.escape(cmd)}</code>. <code>/help</code> for the list."

    if changed:
        config.save_settings(settings)
    return {"reply": reply}
