"""Jarvis — forwards waitlist redemptions, a Discord channel, and Gmail unread mail to one Telegram chat."""

from __future__ import annotations

import asyncio
import logging
import signal
import sys

from . import config
from .telegram_client import Telegram
from .waitlist import poll_waitlist_loop
from .gmail_poller import poll_gmail_loop
from .discord_bridge import run_discord_bridge
from .command_poller import poll_commands_loop


def _setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    logging.getLogger("discord").setLevel(logging.WARNING)
    logging.getLogger("websockets").setLevel(logging.WARNING)


async def _main() -> None:
    cfg = config.load()
    log = logging.getLogger("jarvis")

    async with Telegram(cfg.telegram_bot_token, cfg.telegram_chat_id) as tg:
        await tg.send("Jarvis online. Watchers — waitlist, Discord, Gmail. Reply <code>ban</code> or <code>mute</code> to a Gmail forward to act on the sender.", html=True)

        tasks: list[asyncio.Task] = []
        tasks.append(asyncio.create_task(poll_waitlist_loop(cfg, tg), name="waitlist"))

        if cfg.discord_enabled and cfg.discord_bot_token and cfg.discord_channel_id:
            tasks.append(asyncio.create_task(run_discord_bridge(cfg, tg), name="discord"))
        else:
            log.warning("discord disabled or unconfigured")

        if cfg.gmail_enabled and cfg.gmail_user and cfg.gmail_app_password:
            tasks.append(asyncio.create_task(poll_gmail_loop(cfg, tg), name="gmail"))
        else:
            log.warning("gmail disabled or unconfigured")

        tasks.append(asyncio.create_task(poll_commands_loop(cfg, tg), name="commands"))

        stop = asyncio.Event()

        def _stop(*_: object) -> None:
            stop.set()

        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, _stop)
            except NotImplementedError:
                pass

        done_task = asyncio.create_task(stop.wait())
        await asyncio.wait([done_task, *tasks], return_when=asyncio.FIRST_COMPLETED)

        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        log.info("jarvis stopped")


def main() -> None:
    _setup_logging()
    try:
        asyncio.run(_main())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
