"""xwatch daemon — every N minutes within your waking window, ask X for the
topic's high-engagement tweets and ping the ones you haven't seen. Long-polls
Telegram in the same loop so the threshold, query, and window are settable live.

Run: python3 -m xwatch.main   (from docs/x-targeting/)
The clock that gates the 10:00–22:00 window is this machine's local clock — so
"your time" needs no timezone config; it is simply where the Mac is.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from . import commands, config, scan
from .tg import Telegram

log = logging.getLogger("xwatch")

NO_KEY_NOTICE = (
    "⚠️ <b>TWITTERAPI_API_KEY is not set</b>, so X scans are disabled.\n"
    "Paste your twitterapi.io key into <code>xwatch/.env</code> and restart.\n"
    "Telegram commands keep working in the meantime."
)


def _setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def _within_window(settings: dict) -> bool:
    hour = datetime.now().hour  # local clock = the user's time
    return settings["start_hour"] <= hour < settings["end_hour"]


def _under_cap(settings: dict) -> bool:
    return scan.twitter.today_spend_usd() < settings["daily_cap_usd"]


class Daemon:
    def __init__(self, tg: Telegram, settings: dict):
        self.tg = tg
        self.settings = settings
        self.seen = config.prune_seen(config.load_seen())
        self.last_scan_monotonic = 0.0

    # -- ctx surface used by commands.handle ---------------------------------
    def spend(self):
        return scan.twitter.today_spend_usd(), scan.twitter.calls_today()

    def calibrate(self) -> str:
        if not config.has_twitter_key():
            return NO_KEY_NOTICE
        c = scan.calibrate(self.settings)
        return scan.format_calibration(c, self.settings)

    def scan_now(self, *, automatic: bool = False) -> str:
        if not config.has_twitter_key():
            return NO_KEY_NOTICE
        if automatic and not _under_cap(self.settings):
            return f"Skipped — daily cap ${self.settings['daily_cap_usd']} reached."
        fresh, status = scan.run_scan(self.settings, self.seen)
        self.last_scan_monotonic = time.monotonic()
        if status not in (200, 0) and not fresh:
            return f"Scan returned status {status}, nothing to show."
        if not fresh:
            return (
                f"Scanned <code>{self.settings['query']}</code> — "
                f"nothing new above {self.settings['threshold']} likes."
            )
        top = fresh[: self.settings["max_pings_per_scan"]]
        now_iso = datetime.now(timezone.utc).isoformat()
        header = (
            f"<b>{len(top)} new</b> on <code>{self.settings['query']}</code> "
            f"(≥{self.settings['threshold']} likes)"
        )
        self.tg.send(header)
        for t in top:
            self.tg.send(scan.format_tweet(t))
            self.seen[str(t.get("id"))] = now_iso
        config.save_seen(self.seen)
        extra = len(fresh) - len(top)
        return f"Pinged {len(top)} tweet(s)." + (f" ({extra} more held back)" if extra else "")

    # -- main loop -----------------------------------------------------------
    def run(self) -> None:
        offset = config.load_offset()
        self.tg.send(
            "xwatch online. Watching <code>{}</code> at ≥{} likes, "
            "{:02d}:00–{:02d}:00 local, every {} min.\n<code>/help</code> for controls.".format(
                self.settings["query"], self.settings["threshold"],
                self.settings["start_hour"], self.settings["end_hour"],
                self.settings["scan_interval_min"],
            )
        )

        if not config.has_twitter_key():
            self.tg.send(NO_KEY_NOTICE)
        elif not config.CALIBRATED_FLAG.exists():
            log.info("first run — calibrating")
            self.tg.send("First run — calibrating to recommend a threshold…")
            self.tg.send(self.calibrate())
            config.CALIBRATED_FLAG.write_text(datetime.now(timezone.utc).isoformat())

        while True:
            updates = self.tg.get_updates(offset, timeout=25)
            for u in updates:
                offset = max(offset, u["update_id"] + 1)
                msg = u.get("message") or {}
                text = msg.get("text") or ""
                if str(msg.get("chat", {}).get("id")) != str(self.tg._chat_id):
                    continue  # only obey the configured chat
                if not text.startswith("/"):
                    continue
                log.info("cmd: %s", text)
                if text.split()[0].lstrip("/").split("@")[0].lower() == "scan":
                    self.tg.send(self.scan_now(automatic=False))
                else:
                    res = commands.handle(text, self.settings, self)
                    if res.get("reply"):
                        self.tg.send(res["reply"], reply_to=msg.get("message_id"))
            config.save_offset(offset)

            due = (time.monotonic() - self.last_scan_monotonic) >= self.settings[
                "scan_interval_min"
            ] * 60
            if (
                due
                and config.has_twitter_key()
                and not self.settings["paused"]
                and _within_window(self.settings)
            ):
                log.info("auto scan")
                result = self.scan_now(automatic=True)
                log.info("scan: %s", result)


def main() -> None:
    _setup_logging()
    settings = config.load_settings()
    tg = Telegram(config.telegram_token(), config.telegram_chat_id())
    Daemon(tg, settings).run()


if __name__ == "__main__":
    main()
