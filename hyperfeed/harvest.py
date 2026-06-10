"""Harvest the curated Hyperliquid account list — laterally — from @vibe_trading.

@vibe_trading follows ~400 accounts, but only a handful are Hyperliquid (it follows plenty of
general crypto/NFT/personal accounts). So we expand *laterally*: take the HL accounts it follows
(tier 0), then collect the HL accounts THEY follow (tier 1), union and dedup. HL people follow HL
people, so one hop through the cluster turns a handful of seeds into the ~30 we want.

Relevance is the same gate as a tweet: an exact Hyperliquid term (or eco-protocol name) in the
handle, name, or bio. High precision — the lateral hop supplies the recall.
"""
from __future__ import annotations

import logging
import os

from . import store
from .config import Config
from .hl_filter import is_hyperliquid
from .twitter import Twitter

log = logging.getLogger("hyperfeed.harvest")

LATERAL_SEED_CAP = 12   # expand from at most this many tier-0 accounts (bounds API cost)


def _user_field(u: dict, *names: str) -> str:
    for n in names:
        v = u.get(n)
        if v:
            return str(v)
    return ""


def _user_handle(u: dict) -> str:
    return _user_field(u, "userName", "screenName", "screen_name").lstrip("@")


def _user_followers(u: dict) -> int:
    for n in ("followers_count", "followersCount", "followers"):
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


def _meta(u: dict, source: str) -> dict:
    return {
        "followers": _user_followers(u),
        "name": _user_field(u, "name"),
        "bio": _user_field(u, "description", "bio")[:280],
        "source": source,
    }


def _seed_handles() -> list[str]:
    raw = os.environ.get("ACCOUNTS_SEED", "")
    return [h.strip().lstrip("@") for h in raw.replace(",", " ").split() if h.strip()]


def harvest(cfg: Config, tw: Twitter) -> tuple[dict, str]:
    """Returns (accounts_dict, note). Falls back to the existing list if the API gives nothing."""
    existing = store.load_accounts()
    if not tw.has_key():
        return existing, "no twitterapi.io key — kept existing accounts"

    seed_follows, status = tw.user_followings(cfg.seed_handle, max_results=600)
    if not seed_follows:
        if existing:
            return existing, f"followings fetch empty (status {status}) — kept {len(existing)} existing"
        return existing, f"followings fetch empty (status {status}) and no existing list"

    accounts: dict = {}
    # tier 0 — the HL accounts the seed itself follows
    tier0: list[str] = []
    for u in seed_follows:
        if _relevant(u):
            h = _user_handle(u)
            if h:
                accounts[h] = _meta(u, f"{cfg.seed_handle}-followings")
                tier0.append(h)

    # tier 1 — lateral hop: the HL accounts that tier-0 accounts follow
    for hub in tier0[:LATERAL_SEED_CAP]:
        hub_follows, _ = tw.user_followings(hub, max_results=200)
        for u in hub_follows:
            if _relevant(u):
                h = _user_handle(u)
                if h and h not in accounts:
                    accounts[h] = _meta(u, f"lateral:{hub}")

    # explicit env seeds — always watched
    for handle in _seed_handles():
        accounts.setdefault(handle, {"followers": 0, "name": "", "bio": "", "source": "env-seed"})

    # keep the most-followed up to the cap
    if len(accounts) > cfg.max_accounts:
        top = sorted(accounts.items(), key=lambda kv: kv[1].get("followers", 0), reverse=True)[: cfg.max_accounts]
        accounts = dict(top)

    if not accounts:
        return existing, f"no Hyperliquid accounts among {len(seed_follows)} followings — kept existing"

    store.save_accounts(accounts)
    note = (
        f"harvested {len(accounts)} HL accounts: {len(tier0)} direct from @{cfg.seed_handle}, "
        f"the rest lateral from {min(len(tier0), LATERAL_SEED_CAP)} hubs"
    )
    log.info(note)
    return accounts, note


def ensure_accounts(cfg: Config, tw: Twitter) -> tuple[dict, str]:
    existing = store.load_accounts()
    if existing:
        return existing, f"{len(existing)} accounts loaded from disk"
    return harvest(cfg, tw)
