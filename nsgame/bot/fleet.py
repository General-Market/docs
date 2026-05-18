"""Fleet of pseudonymous bettors. The original bot guarantees baseline
liquidity by sweeping every cohort. This module shapes the surface above
that floor — many small wallets with their own personalities, each
betting at its own pace, some lasting weeks, some only an hour. Without
it the leaderboard reads like one machine. With it the tape breathes.

Members are minted from the admin keypair: SOL for rent, USDC for
stake. On retirement they drain back. The supervisor maintains the
target headcount and never forces a mass-spawn — gradual rotation is
the whole point.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

from solders.instruction import AccountMeta, Instruction
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.system_program import transfer, TransferParams

if TYPE_CHECKING:
    from bot import BotConfig, Pair, TokenBucket
    from solana.rpc.async_api import AsyncClient

log = logging.getLogger("nsgame.fleet")

LAMPORTS_PER_SOL = 1_000_000_000
USDC_DECIMALS_RAW = 1_000_000

# --- Tunables ---
FLEET_TARGET_SIZE = 25
FLEET_REVIEW_PERIOD = 600           # 10 min between supervisor passes
FLEET_SPAWN_INTERVAL_SECS = 90      # Min seconds between successive births
FLEET_FUND_SOL_LAMPORTS = 60_000_000     # 0.06 SOL — covers ATA + a handful of positions
FLEET_FUND_USDC_RAW = 1_000 * USDC_DECIMALS_RAW  # $1000 starting bankroll
FLEET_USDC_TOPUP_THRESHOLD = 50 * USDC_DECIMALS_RAW    # mint more if below $50
FLEET_USDC_TOPUP_AMOUNT = 500 * USDC_DECIMALS_RAW      # $500 top-up
FLEET_SOL_TOPUP_THRESHOLD = 20_000_000   # 0.02 SOL
FLEET_SOL_TOPUP_AMOUNT = 50_000_000      # 0.05 SOL


# --- Personalities ---

@dataclass
class Personality:
    name: str
    bet_min: float          # USDC
    bet_max: float
    sleep_min: float        # secs between bets
    sleep_max: float
    side_bias: float        # 0 underdog only, 0.5 uniform, 1 favorite only
    cohort_skip_prob: float # probability of skipping any given attempt

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Personality":
        return cls(**d)


_PERSONALITY_TABLE: list[tuple[str, tuple[float, float], tuple[float, float], float, float, float]] = [
    # name,         bet range,       sleep range,    side_bias, skip, weight
    ("whale",       (20.0, 150.0),   (600,  1800),   0.50,      0.50, 0.05),
    ("fish",        (0.5,  8.0),     (60,   240),    0.55,      0.65, 0.40),
    ("gambler",     (2.0,  30.0),    (30,   120),    0.50,      0.40, 0.20),
    ("contrarian",  (1.0,  15.0),    (120,  600),    0.20,      0.55, 0.10),
    ("homer",       (1.0,  12.0),    (120,  600),    0.85,      0.55, 0.10),
    ("tourist",     (0.1,  5.0),     (900,  3600),   0.50,      0.85, 0.15),
]


def random_personality(rng: random.Random) -> Personality:
    weights = [p[5] for p in _PERSONALITY_TABLE]
    name, bet, sleep, side, skip, _ = rng.choices(_PERSONALITY_TABLE, weights=weights, k=1)[0]
    return Personality(
        name=name,
        bet_min=bet[0], bet_max=bet[1],
        sleep_min=sleep[0], sleep_max=sleep[1],
        side_bias=side, cohort_skip_prob=skip,
    )


def random_retire_at(rng: random.Random, created_at: float) -> float:
    """Power-law-ish lifespan. A few last weeks, most last days, some hours."""
    p = rng.random()
    if p < 0.20:   # OG
        return created_at + rng.uniform(15, 60) * 86_400
    if p < 0.70:   # regular
        return created_at + rng.uniform(1, 7) * 86_400
    return created_at + rng.uniform(1, 24) * 3_600  # tourist


# --- Member ---

@dataclass
class Member:
    label: str
    secret_bytes: list[int]    # 64-byte secret, json-friendly
    pubkey: str
    personality: Personality
    created_at: float
    retire_at: float
    last_bet_at: float | None = None
    bet_count: int = 0

    def keypair(self) -> Keypair:
        return Keypair.from_bytes(bytes(self.secret_bytes))

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["personality"] = self.personality.to_dict()
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Member":
        d = dict(d)
        d["personality"] = Personality.from_dict(d["personality"])
        return cls(**d)


@dataclass
class Fleet:
    members: list[Member] = field(default_factory=list)
    retired: list[Member] = field(default_factory=list)
    last_birth_at: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "members": [m.to_dict() for m in self.members],
            "retired": [m.to_dict() for m in self.retired],
            "last_birth_at": self.last_birth_at,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Fleet":
        return cls(
            members=[Member.from_dict(m) for m in d.get("members", [])],
            retired=[Member.from_dict(m) for m in d.get("retired", [])],
            last_birth_at=float(d.get("last_birth_at", 0.0)),
        )


# --- Persistence ---

def fleet_state_path(state_path: Path) -> Path:
    """Sit next to bot.state.json; share its directory."""
    return state_path.parent / "fleet.json"


def load_fleet(path: Path) -> Fleet:
    if not path.exists():
        return Fleet()
    try:
        return Fleet.from_dict(json.loads(path.read_text()))
    except Exception as exc:
        log.warning("[fleet] state load failed (%s); starting empty.", exc)
        return Fleet()


def save_fleet(path: Path, fleet: Fleet) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(fleet.to_dict(), indent=2))
    tmp.replace(path)


# --- SPL transfer (used to drain on retirement) ---

TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
TOKEN_INSTR_TRANSFER = 3


def build_spl_transfer_ix(
    *, source_ata: Pubkey, dest_ata: Pubkey, owner: Pubkey, amount_raw: int
) -> Instruction:
    metas = [
        AccountMeta(source_ata, is_signer=False, is_writable=True),
        AccountMeta(dest_ata,   is_signer=False, is_writable=True),
        AccountMeta(owner,      is_signer=True,  is_writable=False),
    ]
    data = bytes([TOKEN_INSTR_TRANSFER]) + int(amount_raw).to_bytes(8, "little", signed=False)
    return Instruction(TOKEN_PROGRAM_ID, data, metas)
