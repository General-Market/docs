"""hyperfeed daemon — an always-on Telegram bot that alerts on Hyperliquid outliers.

Two concurrent tasks (jarvis pattern):
  - command_loop: the only getUpdates consumer; applies /hyperliquid, /status, /calibrate, …
  - scanner_loop: harvests + calibrates on startup, then scans every SCAN_INTERVAL_MIN and
    recalibrates daily.

Blocking twitterapi.io work runs in asyncio.to_thread so the event loop stays responsive.
"""
from __future__ import annotations

import asyncio
import logging
import signal
from datetime import datetime, timezone

from . import calibrate, commands, config, formatters, harvest, scan, store
from .telegram_client import Telegram
from .twitter import Twitter

log = logging.getLogger("hyperfeed")


def _setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


class Daemon:
    def __init__(self, cfg: config.Config, tw: Twitter, tg: Telegram):
        self.cfg = cfg
        self.tw = tw
        self.tg = tg
        self.accounts: dict = store.load_accounts()
        self.calibration: dict = store.load_calibration()
        self.seen: dict = store.prune_seen(store.load_seen(), cfg.seen_max_age_hours)
        self.last_scan_dt: datetime | None = None
        self._calib_lock = asyncio.Lock()

    # -- helpers used by commands -------------------------------------------
    def _fired_today(self) -> int:
        today = datetime.now(timezone.utc).date().isoformat()
        return sum(1 for r in store.recent_fired(500) if (r.get("fired_at") or "").startswith(today))

    async def status_text(self) -> str:
        spend, calls = self.tw.today_spend_usd(), self.tw.calls_today()
        last_ago = None
        if self.last_scan_dt:
            last_ago = (datetime.now(timezone.utc) - self.last_scan_dt).total_seconds() / 60
        return formatters.format_status(
            subscriber_count=len(store.load_subscribers()),
            accounts=self.accounts,
            calibration=self.calibration,
            spend_usd=spend,
            calls_today=calls,
            fired_today=self._fired_today(),
            last_scan_ago_min=last_ago,
            cfg=self.cfg,
        )

    async def do_calibrate(self) -> str:
        if not self.tw.has_key():
            return "No twitterapi.io key — cannot calibrate."
        if not self.accounts:
            await self._harvest()
        async with self._calib_lock:
            self.calibration = await asyncio.to_thread(
                calibrate.calibrate, self.cfg, self.tw, self.accounts
            )
        return formatters.format_calibration(self.calibration)

    async def _harvest(self) -> str:
        self.accounts, note = await asyncio.to_thread(harvest.harvest, self.cfg, self.tw)
        log.info("harvest: %s", note)
        return note

    # -- startup -------------------------------------------------------------
    async def startup(self) -> None:
        await self.tg.set_my_commands(commands.BOT_COMMANDS)  # clear leftover menu, set ours
        if not self.accounts:
            await self._harvest()
        if self.tw.has_key() and not self.calibration:
            log.info("first run — calibrating")
            await self.do_calibrate()
        # Greet existing subscribers so a redeploy is visible.
        subs = store.load_subscribers()
        if subs:
            await self.tg.broadcast(subs, await self.status_text(), html=True)

    # -- scanning ------------------------------------------------------------
    def _over_cap(self) -> bool:
        return self.tw.today_spend_usd() >= self.cfg.daily_cap_usd

    async def _self_heal(self) -> None:
        """Recover once the twitterapi.io key has credit again: harvest if we have no accounts,
        calibrate if we have no usable history. Cheap no-ops while the key is dead (402)."""
        if not self.tw.has_key():
            return
        if not self.accounts:
            await self._harvest()
        if self.accounts and not self.calibration.get("sample_size"):
            log.info("no usable calibration — calibrating")
            await self.do_calibrate()

    async def run_scan_cycle(self, *, automatic: bool) -> int:
        if not self.tw.has_key():
            return 0
        if automatic and self._over_cap():
            log.warning("daily cap $%.2f reached — skipping scan", self.cfg.daily_cap_usd)
            return 0
        await self._self_heal()
        if not self.accounts:
            return 0
        hits, status = await asyncio.to_thread(
            scan.run_scan, self.cfg, self.tw, self.accounts, self.calibration, self.seen
        )
        self.last_scan_dt = datetime.now(timezone.utc)
        if not hits:
            return 0
        subs = store.load_subscribers()
        now_iso = datetime.now(timezone.utc).isoformat()
        for hit in hits:
            if subs:
                await self.tg.broadcast(subs, formatters.format_alert(hit), html=True)
            store.append_fired({**hit, "fired_at": now_iso})
            self.seen[hit["tweet_id"]] = now_iso
        store.save_seen(self.seen)
        log.info("scan fired %d outlier(s) to %d subscribers", len(hits), len(subs))
        return len(hits)

    async def maybe_recalibrate(self) -> None:
        computed = self.calibration.get("computed_at")
        if not computed:
            return
        try:
            age_h = (datetime.now(timezone.utc) - datetime.fromisoformat(computed)).total_seconds() / 3600
        except Exception:
            return
        if age_h >= self.cfg.recalibrate_hours and not self._over_cap():
            log.info("calibration is %.1fh old — refreshing", age_h)
            await self.do_calibrate()

    # -- loops ---------------------------------------------------------------
    async def scanner_loop(self) -> None:
        await self.startup()
        while True:
            try:
                await self.run_scan_cycle(automatic=True)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                log.error("scan cycle error: %s", e)
            await asyncio.sleep(self.cfg.scan_interval_min * 60)
            try:
                await self.maybe_recalibrate()
            except asyncio.CancelledError:
                raise
            except Exception as e:
                log.error("recalibrate error: %s", e)

    async def command_loop(self) -> None:
        offset = store.load_offset()
        while True:
            try:
                updates = await self.tg.get_updates(offset, timeout=25)
                for u in updates:
                    uid = u.get("update_id")
                    if isinstance(uid, int):
                        offset = max(offset, uid + 1)
                    msg = u.get("message") or {}
                    text = msg.get("text") or ""
                    chat_id = (msg.get("chat") or {}).get("id")
                    if chat_id is None or not text.startswith("/"):
                        continue
                    log.info("cmd from %s: %s", chat_id, text)
                    await commands.handle(self, int(chat_id), text, msg.get("message_id"))
                store.save_offset(offset)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                log.error("command loop error: %s", e)
                await asyncio.sleep(5)


async def _main() -> None:
    cfg = config.load()
    tw = Twitter(cfg.twitterapi_key, config.LEDGER_FILE)
    if not tw.has_key():
        log.warning("no twitterapi.io key resolved — scans disabled until one is provided")

    async with Telegram(cfg.telegram_bot_token) as tg:
        daemon = Daemon(cfg, tw, tg)
        tasks = [
            asyncio.create_task(daemon.command_loop(), name="commands"),
            asyncio.create_task(daemon.scanner_loop(), name="scanner"),
        ]

        stop = asyncio.Event()

        def _stop(*_: object) -> None:
            stop.set()

        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, _stop)
            except NotImplementedError:
                pass

        done = asyncio.create_task(stop.wait())
        await asyncio.wait([done, *tasks], return_when=asyncio.FIRST_COMPLETED)
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        log.info("hyperfeed stopped")


def main() -> None:
    _setup_logging()
    try:
        asyncio.run(_main())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
