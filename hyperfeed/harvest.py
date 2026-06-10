"""Harvest the curated Hyperliquid account list from @vibe_trading's followings.

We pull who the seed account follows, then keep the ones whose handle, name, or bio reads as
Hyperliquid (same relevance gate as a tweet). The result — ~30 accounts — is the universe the
scan watches. Re-runnable; an env seed list can be merged in or used as a fallback.
"""
from __future__ import annotations

import logging
import os

from . import store
from .config import Config
from .hl_filter import is_hyperliquid
from .twitter import Twitter

log = logging.getLogger("hyperfeed.harvest")


def _user_field(u: dict, *names: str) -> str:
    for n in names:
        v = u.get(n)
        if v:
            return str(v)
    return ""


def _user_handle(u: dict) -> str:
    return _user_field(u, "userName", "screenName", "screen_name").lstrip("@")


def _user_followers(u: dict) -> int:
    for n in ("followers", "followersCount", "followers_count"):
        v = u.get(n)
        if isinstance(v, int):
            return v
        try:
            return int(v)
        except (TypeError, ValueError):
            continue
    return 0


def _relevant(u: dict) -> bool:
    handle = _user_handle(u)
    name = _user_field(u, "name")
    bio = _user_field(u, "description", "bio")
    return is_hyperliquid(f"{name} {bio}", handle)


def _seed_handles() -> list[str]:
    raw = os.environ.get("ACCOUNTS_SEED", "")
    return [h.strip().lstrip("@") for h in raw.replace(",", " ").split() if h.strip()]


def harvest(cfg: Config, tw: Twitter) -> tuple[dict, str]:
    """Returns (accounts_dict, note). Falls back to the existing list if the API gives nothing."""
    existing = store.load_accounts()

    if not tw.has_key():
        return existing, "no twitterapi.io key — kept existing accounts"

    follows, status = tw.user_followings(cfg.seed_handle, max_results=600)
    if not follows:
        if existing:
            return existing, f"followings fetch empty (status {status}) — kept {len(existing)} existing"
        return existing, f"followings fetch empty (status {status}) and no existing list"

    accounts: dict = {}
    for u in follows:
        if not _relevant(u):
            continue
        handle = _user_handle(u)
        if not handle:
            continue
        accounts[handle] = {
            "followers": _user_followers(u),
            "name": _user_field(u, "name"),
            "bio": _user_field(u, "description", "bio")[:280],
            "source": f"{cfg.seed_handle}-followings",
        }

    # Merge an explicit env seed list (handles we always want watched).
    for handle in _seed_handles():
        accounts.setdefault(handle, {"followers": 0, "name": "", "bio": "", "source": "env-seed"})

    # Keep the most-followed up to the cap — they anchor the feed; tail accounts add noise.
    if len(accounts) > cfg.max_accounts:
        top = sorted(accounts.items(), key=lambda kv: kv[1].get("followers", 0), reverse=True)[: cfg.max_accounts]
        accounts = dict(top)

    if not accounts:
        return existing, f"no Hyperliquid accounts among {len(follows)} followings — kept existing"

    store.save_accounts(accounts)
    note = f"harvested {len(accounts)} Hyperliquid accounts from {len(follows)} @{cfg.seed_handle} followings"
    log.info(note)
    return accounts, note


def ensure_accounts(cfg: Config, tw: Twitter) -> tuple[dict, str]:
    """Load the saved list, harvesting only if it is empty."""
    existing = store.load_accounts()
    if existing:
        return existing, f"{len(existing)} accounts loaded from disk"
    return harvest(cfg, tw)
