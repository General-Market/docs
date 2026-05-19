"""Listen to one Discord channel and forward every message to Telegram."""

from __future__ import annotations

import logging

import discord

from .config import Config
from .formatters import discord_message
from .telegram_client import Telegram

log = logging.getLogger("jarvis.discord")


async def run_discord_bridge(cfg: Config, tg: Telegram) -> None:
    intents = discord.Intents.default()
    intents.message_content = True
    intents.messages = True
    intents.guilds = True

    client = discord.Client(intents=intents)

    @client.event
    async def on_ready() -> None:
        log.info("discord ready as %s, watching channel=%s", client.user, cfg.discord_channel_id)

    @client.event
    async def on_message(msg: discord.Message) -> None:
        if msg.author.bot:
            return
        if msg.channel.id != cfg.discord_channel_id:
            return

        author = msg.author.display_name or msg.author.name
        channel_name = getattr(msg.channel, "name", "channel")
        content = msg.clean_content or ""
        attachments = [a.filename for a in msg.attachments] if msg.attachments else []
        if not content and not attachments:
            return

        body = discord_message(
            guild_id=msg.guild.id if msg.guild else None,
            channel_id=msg.channel.id,
            channel_name=channel_name,
            author=author,
            message_id=msg.id,
            content=content,
            attachments=attachments or None,
        )
        await tg.send(body, html=True)

    try:
        await client.start(cfg.discord_bot_token)
    except Exception as e:
        log.error("discord bridge crashed: %s", e)
        raise
