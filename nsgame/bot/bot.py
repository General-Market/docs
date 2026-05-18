"""
nsgame load bot — devnet only.

Places random bets on every open PvP cohort. Sweeps once when a cohort
rotates, micro-bets between sweeps. Refills its own SOL via airdrop and
its own USDC by signing mint-to with the admin keypair. Persists progress
across restarts. Refuses to run on anything but devnet.

Architecture is small:
- one AsyncClient, reused
- one event loop, three tasks: sweep, micro, watchdog
- a small token bucket throttles RPC to <= 2 calls/sec average
- state.json is the only persistent surface

The bot is loud on purpose. The chain is empty without it.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from solders.hash import Hash
from solders.instruction import AccountMeta, Instruction
from solders.keypair import Keypair
from solders.message import MessageV0
from solders.pubkey import Pubkey
from solders.system_program import ID as SYSTEM_PROGRAM_ID
from solders.transaction import VersionedTransaction

import httpx
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed

from solders.system_program import transfer as system_transfer, TransferParams as SystemTransferParams

from fleet import (
    FLEET_FUND_SOL_LAMPORTS,
    FLEET_FUND_USDC_RAW,
    FLEET_REVIEW_PERIOD,
    FLEET_SOL_TOPUP_AMOUNT,
    FLEET_SOL_TOPUP_THRESHOLD,
    FLEET_SPAWN_INTERVAL_SECS,
    FLEET_TARGET_SIZE,
    FLEET_USDC_TOPUP_AMOUNT,
    FLEET_USDC_TOPUP_THRESHOLD,
    Fleet,
    Member,
    Personality,
    build_spl_transfer_ix,
    fleet_state_path,
    load_fleet,
    random_personality,
    random_retire_at,
    save_fleet,
)
from solana.rpc.types import TxOpts


# ----------------------------------------------------------------------------- #
# Constants                                                                     #
# ----------------------------------------------------------------------------- #

DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
PUBLIC_DEVNET_RPC = "https://api.devnet.solana.com"

TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
SYSVAR_RENT_PUBKEY = Pubkey.from_string("SysvarRent111111111111111111111111111111111")

# place_bet discriminator from the IDL.
PLACE_BET_DISC = bytes([222, 62, 67, 220, 63, 166, 126, 33])
CLAIM_DISC = bytes([62, 198, 214, 193, 213, 159, 108, 210])

# spl-token mint_to discriminator — instruction tag 7.
TOKEN_INSTR_MINT_TO = 7
# associated-token-account create_idempotent — instruction tag 1.
ATA_INSTR_CREATE_IDEMPOTENT = 1

LAMPORTS_PER_SOL = 1_000_000_000
USDC_DECIMALS_RAW = 1_000_000  # six decimals
MIN_SOL_LAMPORTS = 50_000_000  # 0.05 SOL
MIN_USDC_RAW = 200 * USDC_DECIMALS_RAW
REFILL_USDC_RAW = 100_000 * USDC_DECIMALS_RAW

# Bet sizing + cadence. The user dialled this down after observing the
# bot melt through ~1.8 SOL/hour at the prior settings — most of which
# was rent on freshly-instantiated Market PDAs (the bot is the first
# bettor on every cohort, so the bot pays the rent). Smaller sweeps,
# longer micro intervals, lighter total burn.
SWEEP_BET_MIN = 1.0
SWEEP_BET_MAX = 25.0
MICRO_BET_MIN = 0.1
MICRO_BET_MAX = 2.0
MICRO_SLEEP_MIN = 90
MICRO_SLEEP_MAX = 180
BET_QUANTUM = 0.1

WATCHDOG_PERIOD = 60
SUMMARY_PERIOD = 1800

RPC_RATE_LIMIT_PER_SEC = 1.0
RETRY_BASE_SLEEP = 5
RETRY_MAX_SLEEP = 600


# ----------------------------------------------------------------------------- #
# Logging                                                                       #
# ----------------------------------------------------------------------------- #

def _setup_logging() -> logging.Logger:
    level_name = os.environ.get("RUST_LOG", "info").lower()
    level = {
        "trace": logging.DEBUG,
        "debug": logging.DEBUG,
        "info": logging.INFO,
        "warn": logging.WARNING,
        "error": logging.ERROR,
    }.get(level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        stream=sys.stdout,
    )
    return logging.getLogger("nsgame-bot")


log = _setup_logging()


# ----------------------------------------------------------------------------- #
# Config                                                                        #
# ----------------------------------------------------------------------------- #

@dataclass(frozen=True)
class BotConfig:
    bot_keypair_path: Path
    admin_keypair_path: Path
    rpc_url: str
    program_id: Pubkey
    stake_mint: Pubkey
    max_daily_usdc_mint: int  # raw stake-units
    min_airdrop_interval: int  # seconds
    pairs_path: Path
    state_path: Path

    @classmethod
    def from_env(cls) -> "BotConfig":
        here = Path(__file__).resolve().parent
        bot_kp = os.environ.get("NSGAME_BOT_KEYPAIR_PATH")
        if not bot_kp:
            raise SystemExit("NSGAME_BOT_KEYPAIR_PATH unset.")
        admin_kp = os.environ.get("NSGAME_ADMIN_KEYPAIR_PATH")
        if not admin_kp:
            raise SystemExit("NSGAME_ADMIN_KEYPAIR_PATH unset.")
        rpc = os.environ.get("NSGAME_SOLANA_RPC_URL")
        if not rpc:
            raise SystemExit("NSGAME_SOLANA_RPC_URL unset.")
        program_id_s = os.environ.get(
            "NSGAME_PROGRAM_ID",
            "DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA",
        )
        stake_s = os.environ.get(
            "NSGAME_STAKE_MINT",
            "5BNaj6SeidyLp9PKRFTEKCTGsww9SQmsTp7yEqgHiEkT",
        )
        return cls(
            bot_keypair_path=Path(bot_kp),
            admin_keypair_path=Path(admin_kp),
            rpc_url=rpc,
            program_id=Pubkey.from_string(program_id_s),
            stake_mint=Pubkey.from_string(stake_s),
            max_daily_usdc_mint=int(
                os.environ.get("NSGAME_MAX_DAILY_USDC_MINT", "1000000")
            ) * USDC_DECIMALS_RAW,
            min_airdrop_interval=int(
                os.environ.get("NSGAME_MIN_AIRDROP_INTERVAL", "3600")
            ),
            pairs_path=here / "pairs.json",
            state_path=here / "state.json",
        )


# ----------------------------------------------------------------------------- #
# State                                                                         #
# ----------------------------------------------------------------------------- #

@dataclass
class BotState:
    bet_count: int = 0
    failure_count: int = 0
    last_error: str = ""
    last_cohort_starts: dict[str, int] = field(default_factory=dict)  # pair_index -> close
    last_airdrop_at: float = 0.0
    daily_minted_raw: int = 0
    daily_minted_day: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "bet_count": self.bet_count,
            "failure_count": self.failure_count,
            "last_error": self.last_error,
            "last_cohort_starts": self.last_cohort_starts,
            "last_airdrop_at": self.last_airdrop_at,
            "daily_minted_raw": self.daily_minted_raw,
            "daily_minted_day": self.daily_minted_day,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "BotState":
        return cls(
            bet_count=int(d.get("bet_count", 0)),
            failure_count=int(d.get("failure_count", 0)),
            last_error=str(d.get("last_error", "")),
            last_cohort_starts={
                str(k): int(v) for k, v in (d.get("last_cohort_starts") or {}).items()
            },
            last_airdrop_at=float(d.get("last_airdrop_at", 0.0)),
            daily_minted_raw=int(d.get("daily_minted_raw", 0)),
            daily_minted_day=str(d.get("daily_minted_day", "")),
        )


def _load_state(path: Path) -> BotState:
    if not path.exists():
        return BotState()
    try:
        return BotState.from_dict(json.loads(path.read_text()))
    except Exception as exc:
        log.warning("[state] could not parse %s: %s. starting fresh.", path, exc)
        return BotState()


def _save_state(path: Path, state: BotState) -> None:
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state.to_dict(), indent=2))
    tmp.replace(path)


# ----------------------------------------------------------------------------- #
# RPC throttle                                                                  #
# ----------------------------------------------------------------------------- #

class TokenBucket:
    """Smoothed rate limit. One token per (1 / rate) seconds."""

    def __init__(self, rate_per_sec: float) -> None:
        self._interval = 1.0 / rate_per_sec
        self._next_at = 0.0
        self._lock = asyncio.Lock()

    async def take(self) -> None:
        async with self._lock:
            now = time.monotonic()
            wait = self._next_at - now
            if wait > 0:
                await asyncio.sleep(wait)
                now = time.monotonic()
            self._next_at = max(now, self._next_at) + self._interval


# ----------------------------------------------------------------------------- #
# PDA derivation                                                                #
# ----------------------------------------------------------------------------- #
#
# Seeds match nsgame/lib/markets/slots.ts byte-for-byte:
#   market   = [b"market", source_id_le_u32, close_le_i64, settle_le_i64, threshold_le_i32]
#   position = [b"position", market.to_bytes(), user.to_bytes()]
#   vault    = [b"vault", market.to_bytes()]
#   config   = [b"config"]
#   source   = [b"source", source_id_le_u32]

def _u32_le(n: int) -> bytes:
    return int(n).to_bytes(4, "little", signed=False)


def _i32_le(n: int) -> bytes:
    return int(n).to_bytes(4, "little", signed=True)


def _i64_le(n: int) -> bytes:
    return int(n).to_bytes(8, "little", signed=True)


def derive_market_pda(
    program_id: Pubkey,
    *,
    source_id: int,
    close_time: int,
    settlement_time: int,
    threshold_bps: int,
) -> Pubkey:
    seeds = [
        b"market",
        _u32_le(source_id),
        _i64_le(close_time),
        _i64_le(settlement_time),
        _i32_le(threshold_bps),
    ]
    pda, _bump = Pubkey.find_program_address(seeds, program_id)
    return pda


def derive_position_pda(program_id: Pubkey, market: Pubkey, user: Pubkey) -> Pubkey:
    pda, _ = Pubkey.find_program_address(
        [b"position", bytes(market), bytes(user)], program_id
    )
    return pda


def derive_vault_pda(program_id: Pubkey, market: Pubkey) -> Pubkey:
    pda, _ = Pubkey.find_program_address([b"vault", bytes(market)], program_id)
    return pda


def derive_config_pda(program_id: Pubkey) -> Pubkey:
    pda, _ = Pubkey.find_program_address([b"config"], program_id)
    return pda


def derive_fee_vault_pda(program_id: Pubkey) -> Pubkey:
    pda, _ = Pubkey.find_program_address([b"fee_vault"], program_id)
    return pda


def derive_source_pda(program_id: Pubkey, source_id: int) -> Pubkey:
    pda, _ = Pubkey.find_program_address(
        [b"source", _u32_le(source_id)], program_id
    )
    return pda


def derive_ata(owner: Pubkey, mint: Pubkey) -> Pubkey:
    pda, _ = Pubkey.find_program_address(
        [bytes(owner), bytes(TOKEN_PROGRAM_ID), bytes(mint)],
        ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    return pda


# ----------------------------------------------------------------------------- #
# Pair / cohort logic                                                           #
# ----------------------------------------------------------------------------- #

@dataclass(frozen=True)
class Pair:
    pair_index: int
    board: str
    source_id: int
    # window_secs = full cohort cycle (when fresh cohorts open).
    # bet_window_secs = how long bets accept from cohort start.
    # Stars: window=14400, bet_window=3600 (1 h open / 3 h locked).
    # Cams: window=120, bet_window=120 (full window, no lock phase).
    window_secs: int
    bet_window_secs: int
    settle_delay_secs: int
    slug_a: str
    slug_b: str
    audience_a: int = 0
    audience_b: int = 0

    @property
    def threshold_bps(self) -> int:
        return self.pair_index

    @property
    def audience_prior_yes(self) -> float:
        # Probability of betting side A ("yes"), clamped so the underdog
        # side never starves. Without the clamp the heaviest favourites
        # would attract every bet and the loser pool would round to zero.
        total = self.audience_a + self.audience_b
        if total <= 0:
            return 0.5
        raw = self.audience_a / total
        return max(0.20, min(0.80, raw))


def load_pairs(path: Path) -> list[Pair]:
    raw = json.loads(path.read_text())
    pairs: list[Pair] = []
    for r in raw:
        pairs.append(
            Pair(
                pair_index=int(r["pair_index"]),
                board=str(r["board"]),
                source_id=int(r["source_id"]),
                window_secs=int(r["window_secs"]),
                bet_window_secs=int(r.get("bet_window_secs", r["window_secs"])),
                settle_delay_secs=int(r["settle_delay_secs"]),
                slug_a=str(r["slug_a"]),
                slug_b=str(r["slug_b"]),
                audience_a=int(r.get("audience_a", 0) or 0),
                audience_b=int(r.get("audience_b", 0) or 0),
            )
        )
    if len(pairs) != 25:
        log.warning("[bot] expected 25 pairs, got %d", len(pairs))
    return pairs


def cohort_for(pair: Pair, now_secs: int) -> tuple[int, int]:
    """Return (close_time, settlement_time) for pair's CURRENT cohort.

    Cohort start aligns to wall-clock multiples of window_secs. Bets
    accept from cohort_start through cohort_start + bet_window_secs;
    settlement lands at close + settle_delay_secs. We never advance to
    a future cohort — callers check whether `close > now + 10` before
    placing. During the lock phase (close in the past, settlement
    pending), `close < now` and the caller skips. This keeps the bot
    out of the next cohort until its bet window actually opens; the
    user spec is "1 h open / 3 h locked" and the bot honours it.
    """
    cohort_start = (now_secs // pair.window_secs) * pair.window_secs
    close = cohort_start + pair.bet_window_secs
    if close % 60 != 0:  # program enforces 60s grid
        close = (close + 59) // 60 * 60
    settle = close + pair.settle_delay_secs
    return close, settle


def is_bet_window_open(pair: Pair, now_secs: int) -> bool:
    """True if a bet placed now would land before the cohort's close.

    The program rejects with `BadTime` if `close - now < 10`. We use
    the same cushion so the bot doesn't burn a tx on a guaranteed
    rejection during the last ten seconds of the bet window.
    """
    close, _ = cohort_for(pair, now_secs)
    return close - now_secs >= 10


# ----------------------------------------------------------------------------- #
# Instruction encoders                                                          #
# ----------------------------------------------------------------------------- #

def _encode_place_bet_args(
    *,
    source_id: int,
    close_time: int,
    settlement_time: int,
    threshold_bps: int,
    side: str,  # "yes" | "no"
    amount_raw: int,
) -> bytes:
    """Borsh layout of PlaceBetArgs, prefixed by the 8-byte discriminator."""
    if side not in ("yes", "no"):
        raise ValueError(f"bad side: {side}")
    side_idx = 0 if side == "yes" else 1
    return b"".join([
        PLACE_BET_DISC,
        _u32_le(source_id),
        _i64_le(close_time),
        _i64_le(settlement_time),
        _i32_le(threshold_bps),
        bytes([side_idx]),
        int(amount_raw).to_bytes(8, "little", signed=False),
    ])


def build_place_bet_ix(
    *,
    program_id: Pubkey,
    user: Pubkey,
    stake_mint: Pubkey,
    source_id: int,
    close_time: int,
    settlement_time: int,
    threshold_bps: int,
    side: str,
    amount_raw: int,
) -> Instruction:
    config_pda = derive_config_pda(program_id)
    source_pda = derive_source_pda(program_id, source_id)
    market_pda = derive_market_pda(
        program_id,
        source_id=source_id,
        close_time=close_time,
        settlement_time=settlement_time,
        threshold_bps=threshold_bps,
    )
    position_pda = derive_position_pda(program_id, market_pda, user)
    vault_pda = derive_vault_pda(program_id, market_pda)
    user_ata = derive_ata(user, stake_mint)

    metas = [
        AccountMeta(config_pda, is_signer=False, is_writable=False),
        AccountMeta(source_pda, is_signer=False, is_writable=False),
        AccountMeta(market_pda, is_signer=False, is_writable=True),
        AccountMeta(position_pda, is_signer=False, is_writable=True),
        AccountMeta(vault_pda, is_signer=False, is_writable=True),
        AccountMeta(stake_mint, is_signer=False, is_writable=False),
        AccountMeta(user_ata, is_signer=False, is_writable=True),
        AccountMeta(user, is_signer=True, is_writable=True),
        AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
        AccountMeta(ASSOCIATED_TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
        AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        AccountMeta(SYSVAR_RENT_PUBKEY, is_signer=False, is_writable=False),
    ]
    data = _encode_place_bet_args(
        source_id=source_id,
        close_time=close_time,
        settlement_time=settlement_time,
        threshold_bps=threshold_bps,
        side=side,
        amount_raw=amount_raw,
    )
    return Instruction(program_id, data, metas)


def build_claim_ix(
    *,
    program_id: Pubkey,
    market: Pubkey,
    owner: Pubkey,
    stake_mint: Pubkey,
    cranker: Pubkey,
) -> Instruction:
    # claim() takes no args. The program looks up the position via PDA,
    # pays out the winning side (or refunds a stranded market), and
    # closes the position account.
    config_pda = derive_config_pda(program_id)
    position_pda = derive_position_pda(program_id, market, owner)
    vault_pda = derive_vault_pda(program_id, market)
    fee_vault_pda = derive_fee_vault_pda(program_id)
    owner_ata = derive_ata(owner, stake_mint)

    metas = [
        AccountMeta(config_pda,    is_signer=False, is_writable=False),
        AccountMeta(market,        is_signer=False, is_writable=True),
        AccountMeta(position_pda,  is_signer=False, is_writable=True),
        AccountMeta(vault_pda,     is_signer=False, is_writable=True),
        AccountMeta(fee_vault_pda, is_signer=False, is_writable=True),
        AccountMeta(owner,         is_signer=False, is_writable=True),
        AccountMeta(owner_ata,     is_signer=False, is_writable=True),
        AccountMeta(stake_mint,    is_signer=False, is_writable=False),
        AccountMeta(cranker,       is_signer=True,  is_writable=True),
        AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
        AccountMeta(ASSOCIATED_TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
        AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        AccountMeta(SYSVAR_RENT_PUBKEY, is_signer=False, is_writable=False),
    ]
    return Instruction(program_id, CLAIM_DISC, metas)


def build_create_ata_idempotent_ix(
    *, payer: Pubkey, owner: Pubkey, mint: Pubkey
) -> Instruction:
    ata = derive_ata(owner, mint)
    metas = [
        AccountMeta(payer, is_signer=True, is_writable=True),
        AccountMeta(ata, is_signer=False, is_writable=True),
        AccountMeta(owner, is_signer=False, is_writable=False),
        AccountMeta(mint, is_signer=False, is_writable=False),
        AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
    ]
    return Instruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        bytes([ATA_INSTR_CREATE_IDEMPOTENT]),
        metas,
    )


def build_mint_to_ix(
    *, mint: Pubkey, dest_ata: Pubkey, authority: Pubkey, amount_raw: int
) -> Instruction:
    metas = [
        AccountMeta(mint, is_signer=False, is_writable=True),
        AccountMeta(dest_ata, is_signer=False, is_writable=True),
        AccountMeta(authority, is_signer=True, is_writable=False),
    ]
    data = bytes([TOKEN_INSTR_MINT_TO]) + int(amount_raw).to_bytes(
        8, "little", signed=False
    )
    return Instruction(TOKEN_PROGRAM_ID, data, metas)


# ----------------------------------------------------------------------------- #
# Tx send                                                                       #
# ----------------------------------------------------------------------------- #

def _is_rate_limit(exc: BaseException) -> bool:
    # solana-py raises SolanaRpcException() with no message body when
    # Helius returns 429 — repr() is the bare class name and str() is
    # empty, so keyword matching never fires. Match by class name too.
    name = type(exc).__name__
    s = f"{exc!r} {exc!s}".lower()
    if "rpcexception" in name.lower() or "httpstatuserror" in name.lower():
        return True
    return "429" in s or "too many requests" in s or "rate limit" in s


async def _send_versioned_tx(
    client: AsyncClient,
    bucket: TokenBucket,
    payer: Keypair,
    instructions: list[Instruction],
    extra_signers: list[Keypair] | None = None,
    *,
    max_attempts: int = 5,
) -> str:
    extra = extra_signers or []
    last_exc: BaseException | None = None
    for attempt in range(max_attempts):
        try:
            await bucket.take()
            bh_resp = await client.get_latest_blockhash(commitment=Confirmed)
            blockhash: Hash = bh_resp.value.blockhash
            msg = MessageV0.try_compile(
                payer=payer.pubkey(),
                instructions=instructions,
                address_lookup_table_accounts=[],
                recent_blockhash=blockhash,
            )
            signers = [payer] + [s for s in extra if s.pubkey() != payer.pubkey()]
            tx = VersionedTransaction(msg, signers)
            await bucket.take()
            resp = await client.send_transaction(
                tx,
                opts=TxOpts(skip_preflight=False, preflight_commitment=Confirmed),
            )
            return str(resp.value)
        except Exception as exc:
            last_exc = exc
            if not _is_rate_limit(exc) or attempt == max_attempts - 1:
                raise
            # Exponential backoff with jitter: 2s, 4s, 8s, 16s. Free-tier
            # send-tx caps recover within seconds — patience costs nothing.
            delay = (2 ** (attempt + 1)) + random.uniform(0, 1.5)
            log.warning(
                "[bot] rate-limited, retry %d/%d in %.1fs",
                attempt + 1, max_attempts - 1, delay,
            )
            await asyncio.sleep(delay)
    assert last_exc is not None
    raise last_exc


# ----------------------------------------------------------------------------- #
# Funding helpers                                                               #
# ----------------------------------------------------------------------------- #

def _load_keypair(path: Path) -> Keypair:
    raw = json.loads(path.read_text())
    if not isinstance(raw, list) or len(raw) != 64:
        raise SystemExit(f"keypair at {path} is not a 64-byte JSON array")
    return Keypair.from_bytes(bytes(raw))


def _today_utc_str() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime())


async def request_airdrop(
    client: AsyncClient, bucket: TokenBucket, pubkey: Pubkey, lamports: int
) -> bool:
    """Try Helius (the configured RPC). Fall through to public devnet on failure."""
    try:
        await bucket.take()
        resp = await client.request_airdrop(pubkey, lamports)
        sig = resp.value
        await bucket.take()
        await client.confirm_transaction(sig, commitment=Confirmed)
        log.info("[bot] airdrop ok via primary rpc. sig %s", str(sig)[:16])
        return True
    except Exception as exc:
        log.warning("[bot] primary airdrop failed: %s. trying public devnet.", exc)
    try:
        async with AsyncClient(PUBLIC_DEVNET_RPC) as fallback:
            resp = await fallback.request_airdrop(pubkey, lamports)
            sig = resp.value
            await fallback.confirm_transaction(sig, commitment=Confirmed)
        log.info("[bot] airdrop ok via public devnet. sig %s", str(sig)[:16])
        return True
    except Exception as exc:
        log.error("[bot] public devnet airdrop also failed: %s", exc)
    return False


async def ensure_sol(
    cfg: BotConfig,
    state: BotState,
    client: AsyncClient,
    bucket: TokenBucket,
    bot_pk: Pubkey,
    admin_kp: Keypair | None = None,
) -> None:
    await bucket.take()
    bal = (await client.get_balance(bot_pk, commitment=Confirmed)).value
    if bal >= MIN_SOL_LAMPORTS:
        return
    now = time.time()
    if now - state.last_airdrop_at >= cfg.min_airdrop_interval:
        log.info(
            "[bot] sol balance %.4f. requesting airdrop.", bal / LAMPORTS_PER_SOL
        )
        ok = await request_airdrop(client, bucket, bot_pk, LAMPORTS_PER_SOL)
        if ok:
            state.last_airdrop_at = now
            _save_state(cfg.state_path, state)
            return
    # Airdrops are capped (1/hr) and devnet drops often refuse outright.
    # The admin keypair has been loaded specifically for USDC mint-to —
    # reuse it as a SOL backstop. Each cohort instantiates ~10 market
    # PDAs at ~0.002 SOL of rent each; a one-shot top-up keeps the bot
    # alive until the next airdrop cooldown clears.
    if admin_kp is None:
        log.warning(
            "[bot] sol low (%.4f), airdrop on cooldown, no admin backstop.",
            bal / LAMPORTS_PER_SOL,
        )
        return
    topup = LAMPORTS_PER_SOL  # 1 SOL — covers ~500 PDA instantiations
    log.warning(
        "[bot] sol low (%.4f). transferring %.2f SOL from admin.",
        bal / LAMPORTS_PER_SOL,
        topup / LAMPORTS_PER_SOL,
    )
    try:
        from solders.system_program import transfer, TransferParams
        ix = transfer(TransferParams(
            from_pubkey=admin_kp.pubkey(),
            to_pubkey=bot_pk,
            lamports=topup,
        ))
        sig = await _send_versioned_tx(client, bucket, admin_kp, [ix])
        log.info("[bot] admin top-up sent. sig %s", str(sig)[:16])
    except Exception as exc:
        log.error("[bot] admin top-up failed: %s", repr(exc))


async def usdc_balance_raw(
    client: AsyncClient, bucket: TokenBucket, ata: Pubkey
) -> int:
    try:
        await bucket.take()
        resp = await client.get_token_account_balance(ata, commitment=Confirmed)
        return int(resp.value.amount)
    except Exception:
        return 0  # no ATA yet, or transient — caller decides


async def ensure_usdc(
    cfg: BotConfig,
    state: BotState,
    client: AsyncClient,
    bucket: TokenBucket,
    bot_kp: Keypair,
    admin_kp: Keypair,
) -> None:
    bot_ata = derive_ata(bot_kp.pubkey(), cfg.stake_mint)
    bal_raw = await usdc_balance_raw(client, bucket, bot_ata)
    if bal_raw >= MIN_USDC_RAW:
        return

    today = _today_utc_str()
    if state.daily_minted_day != today:
        state.daily_minted_day = today
        state.daily_minted_raw = 0

    if state.daily_minted_raw + REFILL_USDC_RAW > cfg.max_daily_usdc_mint:
        log.warning(
            "[bot] daily mint cap hit (%d / %d). pausing 1h.",
            state.daily_minted_raw,
            cfg.max_daily_usdc_mint,
        )
        await asyncio.sleep(3600)
        return

    # Re-verify cluster before every mint. The startup gate is not enough —
    # operators rotate RPC URLs in env files and forget to restart. Mainnet
    # mint authority signing a mainnet transaction would be irreversible.
    resp = await client.get_genesis_hash()
    if str(resp.value) != DEVNET_GENESIS_HASH:
        log.error(
            "[bot] mint refused. cluster genesis %s is not devnet. shutting down.",
            resp.value,
        )
        raise SystemExit(2)

    log.info(
        "[bot] usdc low (%.2f). minting %d via admin keypair.",
        bal_raw / USDC_DECIMALS_RAW,
        REFILL_USDC_RAW // USDC_DECIMALS_RAW,
    )
    ix_create = build_create_ata_idempotent_ix(
        payer=admin_kp.pubkey(), owner=bot_kp.pubkey(), mint=cfg.stake_mint
    )
    ix_mint = build_mint_to_ix(
        mint=cfg.stake_mint,
        dest_ata=bot_ata,
        authority=admin_kp.pubkey(),
        amount_raw=REFILL_USDC_RAW,
    )
    sig = await _send_versioned_tx(
        client, bucket, admin_kp, [ix_create, ix_mint], extra_signers=[admin_kp]
    )
    log.info("[bot] mint sig %s", sig[:16])
    state.daily_minted_raw += REFILL_USDC_RAW
    _save_state(cfg.state_path, state)


# ----------------------------------------------------------------------------- #
# Bet placement                                                                 #
# ----------------------------------------------------------------------------- #

def _snap_amount(usdc: float) -> int:
    """Snap to BET_QUANTUM and return raw stake-units (6 decimals)."""
    quanta = max(1, round(usdc / BET_QUANTUM))
    snapped = quanta * BET_QUANTUM
    return int(round(snapped * USDC_DECIMALS_RAW))


def _random_bet(
    pair: Pair, now_secs: int, *, lo: float, hi: float
) -> tuple[int, int, int, str, int]:
    close, settle = cohort_for(pair, now_secs)
    # Side selection follows the audience prior, not a coin flip. Uniform
    # randomness over hundreds of bets per market drags every pool to
    # 50/50 — every multiplier ends up at ~1.99×, and the board reads as
    # a wall of indifference. Audience-weighted bets let the odds breathe.
    side = "yes" if random.random() < pair.audience_prior_yes else "no"
    amount = _snap_amount(random.uniform(lo, hi))
    return close, settle, pair.threshold_bps, side, amount


async def place_one_bet(
    cfg: BotConfig,
    client: AsyncClient,
    bucket: TokenBucket,
    bot_kp: Keypair,
    pair: Pair,
    *,
    lo: float,
    hi: float,
    tag: str,
) -> str | None:
    now_secs = int(time.time())
    close, settle, threshold, side, amount_raw = _random_bet(
        pair, now_secs, lo=lo, hi=hi
    )
    ix = build_place_bet_ix(
        program_id=cfg.program_id,
        user=bot_kp.pubkey(),
        stake_mint=cfg.stake_mint,
        source_id=pair.source_id,
        close_time=close,
        settlement_time=settle,
        threshold_bps=threshold,
        side=side,
        amount_raw=amount_raw,
    )
    try:
        sig = await _send_versioned_tx(client, bucket, bot_kp, [ix])
    except Exception as exc:
        log.error(
            "[%s] pair #%02d %s %.1f USDC failed: %s",
            tag,
            pair.pair_index,
            side,
            amount_raw / USDC_DECIMALS_RAW,
            repr(exc) or type(exc).__name__,
        )
        return None
    log.info(
        "[%s] %s %.1f USDC on pair #%02d. sig %s",
        tag,
        side,
        amount_raw / USDC_DECIMALS_RAW,
        pair.pair_index,
        sig[:16],
    )
    return sig


async def open_pool_two_sided(
    cfg: BotConfig,
    client: AsyncClient,
    bucket: TokenBucket,
    bot_kp: Keypair,
    pair: Pair,
    *,
    lo: float,
    hi: float,
    tag: str,
) -> str | None:
    """Bootstrap a fresh cohort with bets on BOTH sides in a single tx.

    The bot is the first bettor on every cohort, and a one-sided pool
    reads as a "refund" verdict on the UI even though it's just empty
    on one side. Opening the pool two-sided in one atomic tx means
    every card immediately shows real pool-implied odds — no audience
    fallback, no refund pill, no '—'.

    Both PlaceBet ixs touch the same Market/Position/Vault/Config
    PDAs (Position is keyed by owner+market, side lives in the ix
    args), so the account list dedups to ~9 unique pubkeys and the
    whole tx fits well under the 1232-byte legacy wire limit.
    """
    now_secs = int(time.time())
    close, settle = cohort_for(pair, now_secs)
    yes_usdc = random.uniform(lo, hi)
    no_usdc = random.uniform(lo, hi)
    yes_raw = _snap_amount(yes_usdc)
    no_raw = _snap_amount(no_usdc)
    if yes_raw <= 0 or no_raw <= 0:
        # Snapping rounded one side to zero — fall through to single-side.
        return await place_one_bet(cfg, client, bucket, bot_kp, pair, lo=lo, hi=hi, tag=tag)

    common = dict(
        program_id=cfg.program_id,
        user=bot_kp.pubkey(),
        stake_mint=cfg.stake_mint,
        source_id=pair.source_id,
        close_time=close,
        settlement_time=settle,
        threshold_bps=pair.threshold_bps,
    )
    ix_yes = build_place_bet_ix(side="yes", amount_raw=yes_raw, **common)
    ix_no = build_place_bet_ix(side="no", amount_raw=no_raw, **common)
    try:
        sig = await _send_versioned_tx(client, bucket, bot_kp, [ix_yes, ix_no])
    except Exception as exc:
        log.error(
            "[%s] pair #%02d open_pool failed (yes=%.1f no=%.1f): %s",
            tag,
            pair.pair_index,
            yes_raw / USDC_DECIMALS_RAW,
            no_raw / USDC_DECIMALS_RAW,
            repr(exc) or type(exc).__name__,
        )
        return None
    log.info(
        "[%s] OPEN pair #%02d yes=%.1f no=%.1f USDC. sig %s",
        tag,
        pair.pair_index,
        yes_raw / USDC_DECIMALS_RAW,
        no_raw / USDC_DECIMALS_RAW,
        sig[:16],
    )
    return sig


# ----------------------------------------------------------------------------- #
# Tasks                                                                         #
# ----------------------------------------------------------------------------- #

async def sweep_loop(
    cfg: BotConfig,
    state: BotState,
    client: AsyncClient,
    bucket: TokenBucket,
    bot_kp: Keypair,
    pairs: list[Pair],
) -> None:
    """When a pair rotates into a fresh cohort, place one bet on it."""
    backoff = RETRY_BASE_SLEEP
    while True:
        try:
            now_secs = int(time.time())
            placed_any = False
            for pair in pairs:
                close, _ = cohort_for(pair, now_secs)
                # Skip pairs whose bet window has passed (lock phase). The
                # next sweep will pick them up at the next cohort_start.
                if not is_bet_window_open(pair, now_secs):
                    continue
                key = str(pair.pair_index)
                last = state.last_cohort_starts.get(key)
                if last == close:
                    continue
                # Open the cohort two-sided in a single atomic tx —
                # one yes leg and one no leg — so the pool is never
                # one-sided and the UI never falls back to "refund"
                # or audience-prior odds. Subsequent fleet members
                # add asymmetry on top of this floor.
                sig = await open_pool_two_sided(
                    cfg, client, bucket, bot_kp, pair,
                    lo=SWEEP_BET_MIN, hi=SWEEP_BET_MAX, tag="sweep",
                )
                if sig:
                    state.last_cohort_starts[key] = close
                    state.bet_count += 2  # two bets in the bootstrap tx
                    placed_any = True
                else:
                    state.failure_count += 1
            if placed_any:
                _save_state(cfg.state_path, state)
                log.info(
                    "[sweep] cohort batch done. total bets %d.", state.bet_count
                )
            backoff = RETRY_BASE_SLEEP
            # Re-check every 5s — fast enough for the 2-minute cams cohort.
            await asyncio.sleep(5)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            state.last_error = f"sweep: {exc}"[:240]
            state.failure_count += 1
            log.exception("[sweep] error: %s", exc)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, RETRY_MAX_SLEEP)


async def micro_loop(
    cfg: BotConfig,
    state: BotState,
    client: AsyncClient,
    bucket: TokenBucket,
    bot_kp: Keypair,
    pairs: list[Pair],
) -> None:
    backoff = RETRY_BASE_SLEEP
    while True:
        try:
            await asyncio.sleep(random.uniform(MICRO_SLEEP_MIN, MICRO_SLEEP_MAX))
            pair = random.choice(pairs)
            sig = await place_one_bet(
                cfg, client, bucket, bot_kp, pair,
                lo=MICRO_BET_MIN, hi=MICRO_BET_MAX, tag="micro",
            )
            if sig:
                state.bet_count += 1
                _save_state(cfg.state_path, state)
            else:
                state.failure_count += 1
            backoff = RETRY_BASE_SLEEP
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            state.last_error = f"micro: {exc}"[:240]
            state.failure_count += 1
            log.exception("[micro] error: %s", exc)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, RETRY_MAX_SLEEP)


CLAIM_API_BASE = os.environ.get(
    "NSGAME_API_BASE", "https://nsgame.org"
).rstrip("/")
CLAIM_BATCH = 20            # claim up to N markets per cycle
CLAIM_PERIOD = 90           # seconds between claim sweeps
CLAIM_FETCH_PAGE = 200      # positions per indexer page


async def fetch_unclaimed_resolved(wallet: Pubkey) -> list[str]:
    """Hit nsgame's positions API with the unclaimed-only filter. Server
    returns just the resolved-without-claim rows in slot-DESC order, up
    to limit per page. We keep dedup client-side because the bot can
    have multiple bets on the same market (yes + no), and we only need
    one claim per market to settle both sides."""
    out: list[str] = []
    seen: set[str] = set()
    async with httpx.AsyncClient(timeout=20.0) as http:
        for offset in (0, CLAIM_FETCH_PAGE, CLAIM_FETCH_PAGE * 2):
            url = (
                f"{CLAIM_API_BASE}/api/positions/{wallet}"
                f"?unclaimed=1&limit={CLAIM_FETCH_PAGE}&offset={offset}"
            )
            try:
                resp = await http.get(url)
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                log.warning("[claim] positions fetch failed: %s", exc)
                return out
            positions = data.get("positions") or []
            for p in positions:
                market = p.get("market")
                if market and market not in seen:
                    seen.add(market)
                    out.append(market)
            if len(positions) < CLAIM_FETCH_PAGE:
                break
    return out


async def claim_loop(
    cfg: BotConfig,
    state: BotState,
    client: AsyncClient,
    bucket: TokenBucket,
    bot_kp: Keypair,
) -> None:
    """Drain the bot's pending claims so its leaderboard PnL stops
    looking like the slow death of a small empire. Each Claim ix
    settles one market: pays out the winning side (or refunds a stranded
    market) and closes the position account, returning rent."""
    backoff = RETRY_BASE_SLEEP
    while True:
        try:
            markets = await fetch_unclaimed_resolved(bot_kp.pubkey())
            if not markets:
                await asyncio.sleep(CLAIM_PERIOD)
                continue
            log.info("[claim] %d unclaimed resolved markets in queue.", len(markets))
            claimed_this_pass = 0
            for raw in markets[:CLAIM_BATCH]:
                try:
                    market = Pubkey.from_string(raw)
                except Exception:
                    continue
                ix = build_claim_ix(
                    program_id=cfg.program_id,
                    market=market,
                    owner=bot_kp.pubkey(),
                    stake_mint=cfg.stake_mint,
                    cranker=bot_kp.pubkey(),
                )
                try:
                    sig = await _send_versioned_tx(client, bucket, bot_kp, [ix])
                except Exception as exc:
                    # Position already closed (raced with another claim),
                    # market still settling, or the program rejected for
                    # some other reason. Surface the full message — the
                    # truncation that hid an Anchor error code earlier
                    # cost an evening of guessing.
                    log.warning(
                        "[claim] %s failed: %s", raw[:12], repr(exc)[:600],
                    )
                    continue
                claimed_this_pass += 1
                state.bet_count += 0  # claim is not a bet — keep counters honest
                log.info("[claim] %s settled. sig %s", raw[:12], sig[:16])
            if claimed_this_pass:
                _save_state(cfg.state_path, state)
            backoff = RETRY_BASE_SLEEP
            await asyncio.sleep(CLAIM_PERIOD)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            state.last_error = f"claim: {exc}"[:240]
            log.exception("[claim] loop error: %s", exc)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, RETRY_MAX_SLEEP)


# ----------------------------------------------------------------------------- #
# Fleet — varied personalities betting at varied cadences                       #
# ----------------------------------------------------------------------------- #

def _pick_pair_for_personality(
    pairs: list[Pair], rng: random.Random, personality: Personality,
) -> Pair | None:
    # Honest random for now. Personality is expressed via bet size,
    # cadence, and side bias — not pair selection. Could later filter
    # by board (whales avoid cams?), but that drifts into theatre.
    if not pairs:
        return None
    return rng.choice(pairs)


def _side_for_personality(
    pair: Pair, rng: random.Random, personality: Personality,
) -> str:
    # Blend the audience prior with the personality's side bias.
    # bias = 0   -> always underdog
    # bias = 0.5 -> follow the audience prior verbatim
    # bias = 1   -> always favorite
    favourite_yes = pair.audience_a >= pair.audience_b
    bias = personality.side_bias
    if bias <= 0.0:
        # underdog
        return "no" if favourite_yes else "yes"
    if bias >= 1.0:
        return "yes" if favourite_yes else "no"
    # Mix: tilt audience prior toward favorite by `bias` strength.
    prior_yes = pair.audience_prior_yes
    tilted = (1 - 2 * bias) * 0.5 + 2 * bias * (prior_yes if favourite_yes else (1 - prior_yes))
    # Above maps bias=0.5 → prior, bias=0 → 1-prior, bias=1 → prior.
    # Clamp gently to keep underdog pool alive.
    tilted = max(0.15, min(0.85, tilted))
    return "yes" if rng.random() < tilted else "no"


async def spawn_member(
    cfg: BotConfig,
    state: BotState,
    client: AsyncClient,
    bucket: TokenBucket,
    admin_kp: Keypair,
    rng: random.Random,
    label: str,
) -> Member | None:
    """Mint a fresh wallet, fund it from admin, return a populated Member.
    On any funding failure, return None — the supervisor will try again
    on the next pass."""
    member_kp = Keypair()
    member_pk = member_kp.pubkey()
    personality = random_personality(rng)
    now = time.time()
    log.info(
        "[fleet] spawning %s as %s (%s, bet=$%.1f-$%.1f, sleep=%ds-%ds)",
        label, personality.name, member_pk,
        personality.bet_min, personality.bet_max,
        int(personality.sleep_min), int(personality.sleep_max),
    )

    member_ata = derive_ata(member_pk, cfg.stake_mint)
    ix_sol = system_transfer(SystemTransferParams(
        from_pubkey=admin_kp.pubkey(),
        to_pubkey=member_pk,
        lamports=FLEET_FUND_SOL_LAMPORTS,
    ))
    ix_create_ata = build_create_ata_idempotent_ix(
        payer=admin_kp.pubkey(), owner=member_pk, mint=cfg.stake_mint,
    )
    ix_mint = build_mint_to_ix(
        mint=cfg.stake_mint, dest_ata=member_ata,
        authority=admin_kp.pubkey(), amount_raw=FLEET_FUND_USDC_RAW,
    )

    try:
        sig = await _send_versioned_tx(
            client, bucket, admin_kp,
            [ix_sol, ix_create_ata, ix_mint],
        )
    except Exception as exc:
        log.error("[fleet] spawn %s failed during funding: %s", label, repr(exc)[:240])
        return None

    log.info("[fleet] %s funded. sig %s", label, sig[:16])
    member = Member(
        label=label,
        secret_bytes=list(bytes(member_kp)),
        pubkey=str(member_pk),
        personality=personality,
        created_at=now,
        retire_at=random_retire_at(rng, now),
    )
    return member


async def topup_member(
    cfg: BotConfig,
    member: Member,
    client: AsyncClient,
    bucket: TokenBucket,
    admin_kp: Keypair,
) -> None:
    """Replenish a member's SOL or USDC if it has fallen below the
    threshold. Quiet on the happy path; logs the transfer when it fires."""
    member_pk = member.keypair().pubkey()
    member_ata = derive_ata(member_pk, cfg.stake_mint)

    # SOL
    await bucket.take()
    sol_bal = (await client.get_balance(member_pk, commitment=Confirmed)).value
    if sol_bal < FLEET_SOL_TOPUP_THRESHOLD:
        ix = system_transfer(SystemTransferParams(
            from_pubkey=admin_kp.pubkey(),
            to_pubkey=member_pk,
            lamports=FLEET_SOL_TOPUP_AMOUNT,
        ))
        try:
            await _send_versioned_tx(client, bucket, admin_kp, [ix])
            log.info("[fleet] %s sol top-up sent.", member.label)
        except Exception as exc:
            log.warning("[fleet] %s sol top-up failed: %s", member.label, repr(exc)[:120])

    # USDC
    usdc_bal = await usdc_balance_raw(client, bucket, member_ata)
    if usdc_bal < FLEET_USDC_TOPUP_THRESHOLD:
        ix = build_mint_to_ix(
            mint=cfg.stake_mint, dest_ata=member_ata,
            authority=admin_kp.pubkey(), amount_raw=FLEET_USDC_TOPUP_AMOUNT,
        )
        try:
            await _send_versioned_tx(client, bucket, admin_kp, [ix])
            log.info("[fleet] %s usdc top-up minted.", member.label)
        except Exception as exc:
            log.warning("[fleet] %s usdc top-up failed: %s", member.label, repr(exc)[:120])


async def drain_member(
    cfg: BotConfig,
    member: Member,
    client: AsyncClient,
    bucket: TokenBucket,
    admin_kp: Keypair,
) -> None:
    """Send remaining USDC and SOL back to admin, then mark retired.
    Best-effort. Failures are logged but do not block retirement —
    the alternative is a member that lives forever past its lifespan."""
    member_kp = member.keypair()
    member_pk = member_kp.pubkey()
    member_ata = derive_ata(member_pk, cfg.stake_mint)
    admin_ata = derive_ata(admin_kp.pubkey(), cfg.stake_mint)

    # USDC drain
    usdc_bal = await usdc_balance_raw(client, bucket, member_ata)
    if usdc_bal > 0:
        ix_create = build_create_ata_idempotent_ix(
            payer=member_kp.pubkey(), owner=admin_kp.pubkey(), mint=cfg.stake_mint,
        )
        ix_xfer = build_spl_transfer_ix(
            source_ata=member_ata, dest_ata=admin_ata,
            owner=member_pk, amount_raw=usdc_bal,
        )
        try:
            await _send_versioned_tx(client, bucket, member_kp, [ix_create, ix_xfer])
            log.info("[fleet] %s usdc drained ($%.2f).", member.label, usdc_bal / USDC_DECIMALS_RAW)
        except Exception as exc:
            log.warning("[fleet] %s usdc drain failed: %s", member.label, repr(exc)[:120])

    # SOL drain — leave 5,000 lamports for the final-tx fee.
    await bucket.take()
    sol_bal = (await client.get_balance(member_pk, commitment=Confirmed)).value
    keep = 10_000
    if sol_bal > keep:
        ix = system_transfer(SystemTransferParams(
            from_pubkey=member_pk,
            to_pubkey=admin_kp.pubkey(),
            lamports=sol_bal - keep,
        ))
        try:
            await _send_versioned_tx(client, bucket, member_kp, [ix])
            log.info("[fleet] %s sol drained (%.4f).", member.label, (sol_bal - keep) / LAMPORTS_PER_SOL)
        except Exception as exc:
            log.warning("[fleet] %s sol drain failed: %s", member.label, repr(exc)[:120])


async def member_loop(
    cfg: BotConfig,
    member: Member,
    client: AsyncClient,
    bucket: TokenBucket,
    pairs: list[Pair],
    fleet_path: Path,
    fleet: Fleet,
    rng: random.Random,
) -> None:
    """One member, one async task. Sleeps for personality-defined gaps,
    sometimes skips, picks a pair, picks a side, places a bet. Exits
    when retire_at is past — the supervisor handles the drain."""
    member_kp = member.keypair()
    while time.time() < member.retire_at:
        try:
            sleep_for = rng.uniform(member.personality.sleep_min, member.personality.sleep_max)
            await asyncio.sleep(sleep_for)
            if time.time() >= member.retire_at:
                break
            if rng.random() < member.personality.cohort_skip_prob:
                continue
            pair = _pick_pair_for_personality(pairs, rng, member.personality)
            if pair is None:
                continue
            now_secs = int(time.time())
            if not is_bet_window_open(pair, now_secs):
                continue  # cohort is locked; nothing to bet on
            close, settle = cohort_for(pair, now_secs)
            side = _side_for_personality(pair, rng, member.personality)
            usdc_amount = rng.uniform(member.personality.bet_min, member.personality.bet_max)
            amount_raw = _snap_amount(usdc_amount)
            ix = build_place_bet_ix(
                program_id=cfg.program_id,
                user=member_kp.pubkey(),
                stake_mint=cfg.stake_mint,
                source_id=pair.source_id,
                close_time=close,
                settlement_time=settle,
                threshold_bps=pair.threshold_bps,
                side=side,
                amount_raw=amount_raw,
            )
            try:
                sig = await _send_versioned_tx(client, bucket, member_kp, [ix])
                member.bet_count += 1
                member.last_bet_at = time.time()
                log.info(
                    "[fleet:%s] %s %.1f USDC pair #%02d. sig %s",
                    member.label, side, amount_raw / USDC_DECIMALS_RAW,
                    pair.pair_index, sig[:16],
                )
            except Exception as exc:
                # Quiet on the common failures (insufficient funds, etc).
                msg = repr(exc)[:160]
                log.debug("[fleet:%s] bet failed: %s", member.label, msg)
                # If it's a fund issue, the supervisor's top-up pass will fix it.
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning("[fleet:%s] loop error: %s", member.label, repr(exc)[:120])
            await asyncio.sleep(30)
    log.info("[fleet:%s] retire_at reached. exiting loop.", member.label)


async def fleet_supervisor(
    cfg: BotConfig,
    state: BotState,
    client: AsyncClient,
    bucket: TokenBucket,
    admin_kp: Keypair,
    pairs: list[Pair],
) -> None:
    """The supervisor owns the fleet's lifecycle. On each pass it
    retires expired members, spawns replacements (with a min interval
    between births so the fleet doesn't all flash into existence),
    and tops up the survivors. Member tasks are tracked here so we can
    cancel them on retirement."""
    rng = random.Random()
    fleet_path = fleet_state_path(cfg.state_path)
    fleet = load_fleet(fleet_path)
    log.info(
        "[fleet] loaded %d active, %d retired members.",
        len(fleet.members), len(fleet.retired),
    )

    member_tasks: dict[str, asyncio.Task] = {}

    def start_member_task(m: Member) -> None:
        if m.label in member_tasks:
            return
        t = asyncio.create_task(
            member_loop(cfg, m, client, bucket, pairs, fleet_path, fleet, rng),
            name=f"member-{m.label}",
        )
        member_tasks[m.label] = t

    for m in list(fleet.members):
        start_member_task(m)

    next_label_n = max(
        (int(m.label.split("-")[-1]) for m in fleet.members + fleet.retired
         if m.label.startswith("fleet-")),
        default=0,
    )

    while True:
        try:
            now = time.time()

            # Retire expired members.
            expired = [m for m in fleet.members if m.retire_at <= now]
            for m in expired:
                log.info("[fleet] retiring %s (lived %.1fh).",
                         m.label, (now - m.created_at) / 3600)
                t = member_tasks.pop(m.label, None)
                if t and not t.done():
                    t.cancel()
                    try:
                        await asyncio.wait_for(t, timeout=5)
                    except (asyncio.CancelledError, asyncio.TimeoutError):
                        pass
                await drain_member(cfg, m, client, bucket, admin_kp)
                fleet.members.remove(m)
                fleet.retired.append(m)
            if expired:
                save_fleet(fleet_path, fleet)

            # Top up the survivors.
            for m in list(fleet.members):
                try:
                    await topup_member(cfg, m, client, bucket, admin_kp)
                except Exception as exc:
                    log.warning("[fleet] %s topup error: %s", m.label, repr(exc)[:120])

            # Spawn replacements — gradual drip, not a flood. Up to
            # 5 births per supervisor pass (every FLEET_REVIEW_PERIOD),
            # spaced FLEET_SPAWN_INTERVAL_SECS apart inside the pass.
            spawned = 0
            while len(fleet.members) < FLEET_TARGET_SIZE and spawned < 5:
                next_label_n += 1
                label = f"fleet-{next_label_n:04d}"
                m = await spawn_member(cfg, state, client, bucket, admin_kp, rng, label)
                if not m:
                    break
                fleet.members.append(m)
                fleet.last_birth_at = time.time()
                start_member_task(m)
                save_fleet(fleet_path, fleet)
                spawned += 1
                # Pace successive births so the chain doesn't see a
                # synchronous burst of new wallets all at once.
                if len(fleet.members) < FLEET_TARGET_SIZE and spawned < 5:
                    await asyncio.sleep(FLEET_SPAWN_INTERVAL_SECS)

            log.info(
                "[fleet] active=%d/%d, retired=%d. (spawned %d this pass)",
                len(fleet.members), FLEET_TARGET_SIZE, len(fleet.retired), spawned,
            )
            await asyncio.sleep(FLEET_REVIEW_PERIOD)
        except asyncio.CancelledError:
            log.info("[fleet] supervisor cancelled.")
            for t in member_tasks.values():
                t.cancel()
            raise
        except Exception as exc:
            log.exception("[fleet] supervisor error: %s", exc)
            await asyncio.sleep(60)


async def watchdog_loop(
    cfg: BotConfig,
    state: BotState,
    client: AsyncClient,
    bucket: TokenBucket,
    bot_kp: Keypair,
    admin_kp: Keypair,
) -> None:
    last_summary = 0.0
    while True:
        try:
            await ensure_sol(cfg, state, client, bucket, bot_kp.pubkey(), admin_kp)
            await ensure_usdc(cfg, state, client, bucket, bot_kp, admin_kp)
            now = time.time()
            if now - last_summary >= SUMMARY_PERIOD:
                bot_ata = derive_ata(bot_kp.pubkey(), cfg.stake_mint)
                await bucket.take()
                sol_bal = (
                    await client.get_balance(bot_kp.pubkey(), commitment=Confirmed)
                ).value
                usdc_bal = await usdc_balance_raw(client, bucket, bot_ata)
                log.info(
                    "[health] %d bets placed. %d failures. sol %.4f. usdc %.2f.",
                    state.bet_count,
                    state.failure_count,
                    sol_bal / LAMPORTS_PER_SOL,
                    usdc_bal / USDC_DECIMALS_RAW,
                )
                last_summary = now
            await asyncio.sleep(WATCHDOG_PERIOD)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.exception("[health] error: %s", exc)
            await asyncio.sleep(WATCHDOG_PERIOD)


# ----------------------------------------------------------------------------- #
# Bootstrap                                                                     #
# ----------------------------------------------------------------------------- #

async def assert_devnet(client: AsyncClient, bucket: TokenBucket) -> None:
    await bucket.take()
    resp = await client.get_genesis_hash()
    genesis = str(resp.value)
    if genesis != DEVNET_GENESIS_HASH:
        raise SystemExit(
            f"[bot] refusing to run. genesis hash {genesis} is not devnet."
        )
    log.info("[bot] devnet genesis verified.")


async def run() -> None:
    cfg = BotConfig.from_env()
    state = _load_state(cfg.state_path)
    pairs = load_pairs(cfg.pairs_path)
    bot_kp = _load_keypair(cfg.bot_keypair_path)
    admin_kp = _load_keypair(cfg.admin_keypair_path)
    log.info("[bot] bot pubkey %s", bot_kp.pubkey())
    log.info("[bot] admin pubkey %s", admin_kp.pubkey())
    log.info("[bot] program id %s", cfg.program_id)
    log.info("[bot] stake mint %s", cfg.stake_mint)
    log.info("[bot] %d pairs loaded.", len(pairs))

    bucket = TokenBucket(RPC_RATE_LIMIT_PER_SEC)
    async with AsyncClient(cfg.rpc_url, commitment=Confirmed) as client:
        await assert_devnet(client, bucket)
        # Front-load funding before either loop starts placing bets.
        await ensure_sol(cfg, state, client, bucket, bot_kp.pubkey())
        await ensure_usdc(cfg, state, client, bucket, bot_kp, admin_kp)

        tasks = [
            asyncio.create_task(
                sweep_loop(cfg, state, client, bucket, bot_kp, pairs),
                name="sweep",
            ),
            asyncio.create_task(
                claim_loop(cfg, state, client, bucket, bot_kp),
                name="claim",
            ),
            asyncio.create_task(
                fleet_supervisor(cfg, state, client, bucket, admin_kp, pairs),
                name="fleet",
            ),
            asyncio.create_task(
                watchdog_loop(cfg, state, client, bucket, bot_kp, admin_kp),
                name="watchdog",
            ),
        ]
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            log.info("[bot] cancelled. saving state.")
            _save_state(cfg.state_path, state)
            for t in tasks:
                t.cancel()
            raise


def main() -> None:
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        log.info("[bot] interrupted. exiting.")


if __name__ == "__main__":
    main()
