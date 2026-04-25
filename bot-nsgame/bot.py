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

from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed
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

# spl-token mint_to discriminator — instruction tag 7.
TOKEN_INSTR_MINT_TO = 7
# associated-token-account create_idempotent — instruction tag 1.
ATA_INSTR_CREATE_IDEMPOTENT = 1

LAMPORTS_PER_SOL = 1_000_000_000
USDC_DECIMALS_RAW = 1_000_000  # six decimals
MIN_SOL_LAMPORTS = 50_000_000  # 0.05 SOL
MIN_USDC_RAW = 200 * USDC_DECIMALS_RAW
REFILL_USDC_RAW = 100_000 * USDC_DECIMALS_RAW

SWEEP_BET_MIN = 1.0
SWEEP_BET_MAX = 100.0
MICRO_BET_MIN = 0.1
MICRO_BET_MAX = 5.0
MICRO_SLEEP_MIN = 20
MICRO_SLEEP_MAX = 50
BET_QUANTUM = 0.1

WATCHDOG_PERIOD = 60
SUMMARY_PERIOD = 1800

RPC_RATE_LIMIT_PER_SEC = 2.0
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
    window_secs: int
    settle_delay_secs: int
    slug_a: str
    slug_b: str

    @property
    def threshold_bps(self) -> int:
        return self.pair_index


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
                settle_delay_secs=int(r["settle_delay_secs"]),
                slug_a=str(r["slug_a"]),
                slug_b=str(r["slug_b"]),
            )
        )
    if len(pairs) != 25:
        log.warning("[bot] expected 25 pairs, got %d", len(pairs))
    return pairs


def cohort_for(pair: Pair, now_secs: int) -> tuple[int, int]:
    """Return (close_time, settlement_time) for pair's current cohort."""
    close = (now_secs + pair.window_secs - 1) // pair.window_secs * pair.window_secs
    if close <= now_secs:  # boundary case — push to the next stride
        close += pair.window_secs
    if close % 60 != 0:  # program enforces 60s grid
        close = (close + 59) // 60 * 60
    settle = close + pair.settle_delay_secs
    return close, settle


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

async def _send_versioned_tx(
    client: AsyncClient,
    bucket: TokenBucket,
    payer: Keypair,
    instructions: list[Instruction],
    extra_signers: list[Keypair] | None = None,
) -> str:
    extra = extra_signers or []
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
) -> None:
    await bucket.take()
    bal = (await client.get_balance(bot_pk, commitment=Confirmed)).value
    if bal >= MIN_SOL_LAMPORTS:
        return
    now = time.time()
    if now - state.last_airdrop_at < cfg.min_airdrop_interval:
        log.warning(
            "[bot] sol low (%.4f) but airdrop cooldown holds. waiting.",
            bal / LAMPORTS_PER_SOL,
        )
        return
    log.info(
        "[bot] sol balance %.4f. requesting airdrop.", bal / LAMPORTS_PER_SOL
    )
    ok = await request_airdrop(client, bucket, bot_pk, LAMPORTS_PER_SOL)
    state.last_airdrop_at = now if ok else state.last_airdrop_at
    _save_state(cfg.state_path, state)


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
    side = "yes" if random.random() < 0.5 else "no"
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
            exc,
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
                key = str(pair.pair_index)
                last = state.last_cohort_starts.get(key)
                if last == close:
                    continue
                sig = await place_one_bet(
                    cfg, client, bucket, bot_kp, pair,
                    lo=SWEEP_BET_MIN, hi=SWEEP_BET_MAX, tag="sweep",
                )
                if sig:
                    state.last_cohort_starts[key] = close
                    state.bet_count += 1
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
            await ensure_sol(cfg, state, client, bucket, bot_kp.pubkey())
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
                micro_loop(cfg, state, client, bucket, bot_kp, pairs),
                name="micro",
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
