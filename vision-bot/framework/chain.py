"""
Chain interaction layer for Vision bots.

All on-chain reads/writes, oracle discovery, bitmap submission,
and data-node fetching live here.
"""

from __future__ import annotations

import functools
import json
import logging
import math
import os
import random
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from web3 import Web3

logger = logging.getLogger("vision-bot")


# ── Typed exceptions ───────────────────────────────────────────


class BitmapSubmitError(RuntimeError):
    """Raised when bitmap submission fails to reach oracle quorum."""

    def __init__(self, accepted: int, total: int, last_error: str = ""):
        self.accepted = accepted
        self.total = total
        self.last_error = last_error
        super().__init__(
            f"Bitmap quorum not reached: {accepted}/{total} oracles accepted"
            + (f" (last error: {last_error})" if last_error else "")
        )


class VisionRevertError(RuntimeError):
    """Base class for decoded Vision custom errors."""


class BatchNotFoundError(VisionRevertError):
    pass


class BatchPausedError(VisionRevertError):
    pass


class UnauthorizedError(VisionRevertError):
    pass


class InsufficientDepositError(VisionRevertError):
    pass


class StakeBelowMinimumError(VisionRevertError):
    pass


class AlreadyJoinedError(VisionRevertError):
    pass


class NotJoinedError(VisionRevertError):
    pass


class InvalidTickDurationError(VisionRevertError):
    pass


class InvalidLockOffsetError(VisionRevertError):
    pass


class LockOffsetTooLargeError(VisionRevertError):
    pass


class InsolventPayoutError(VisionRevertError):
    pass


class BotAlreadyRegisteredError(VisionRevertError):
    pass


class BotNotRegisteredError(VisionRevertError):
    pass


class TickLockedError(VisionRevertError):
    pass


class InvalidBLSSignatureError(VisionRevertError):
    pass


class InvalidArrayLengthError(VisionRevertError):
    pass


class BatchAlreadySettledError(VisionRevertError):
    pass


# ── Custom error selectors ─────────────────────────────────────

# Map first 4 bytes of keccak256(error signature) → typed exception class.
# Computed once at module load. Selectors are immutable per signature.
def _build_revert_selector_map() -> dict:
    sigs = [
        ("BatchNotFound()", BatchNotFoundError, "BatchNotFound"),
        ("BatchPaused()", BatchPausedError, "BatchPaused"),
        ("Unauthorized()", UnauthorizedError, "Unauthorized"),
        ("InsufficientDeposit()", InsufficientDepositError, "InsufficientDeposit"),
        ("StakeBelowMinimum()", StakeBelowMinimumError, "StakeBelowMinimum"),
        ("AlreadyJoined()", AlreadyJoinedError, "AlreadyJoined"),
        ("NotJoined()", NotJoinedError, "NotJoined"),
        ("InvalidTickDuration()", InvalidTickDurationError, "InvalidTickDuration"),
        ("InvalidLockOffset()", InvalidLockOffsetError, "InvalidLockOffset"),
        ("LockOffsetTooLarge()", LockOffsetTooLargeError, "LockOffsetTooLarge"),
        ("InsolventPayout()", InsolventPayoutError, "InsolventPayout"),
        ("BotAlreadyRegistered()", BotAlreadyRegisteredError, "BotAlreadyRegistered"),
        ("BotNotRegistered()", BotNotRegisteredError, "BotNotRegistered"),
        ("TickLocked()", TickLockedError, "TickLocked"),
        ("InvalidBLSSignature()", InvalidBLSSignatureError, "InvalidBLSSignature"),
        ("InvalidArrayLength()", InvalidArrayLengthError, "InvalidArrayLength"),
        ("BatchAlreadySettled()", BatchAlreadySettledError, "BatchAlreadySettled"),
    ]
    out: dict = {}
    for sig, cls, name in sigs:
        selector = Web3.keccak(text=sig)[:4]
        out[selector] = (cls, name)
    return out


_REVERT_SELECTORS = _build_revert_selector_map()


def _decode_revert(revert_data) -> tuple:
    """Decode the first 4 bytes of revert data into (exception_class, name).

    Accepts bytes, bytearray, or hex string. Returns (None, "") if unrecognized.
    """
    if revert_data is None:
        return (None, "")
    if isinstance(revert_data, str):
        s = revert_data.removeprefix("0x")
        try:
            revert_data = bytes.fromhex(s)
        except ValueError:
            return (None, "")
    if not isinstance(revert_data, (bytes, bytearray)) or len(revert_data) < 4:
        return (None, "")
    selector = bytes(revert_data[:4])
    return _REVERT_SELECTORS.get(selector, (None, ""))


def _extract_revert_data(err: Exception) -> bytes:
    """Best-effort extract of revert data bytes from a web3/RPC exception."""
    # web3.py ContractCustomError carries .data; ContractLogicError carries .data too
    data = getattr(err, "data", None)
    if isinstance(data, str):
        s = data.removeprefix("0x")
        try:
            return bytes.fromhex(s)
        except ValueError:
            pass
    elif isinstance(data, (bytes, bytearray)):
        return bytes(data)
    # Fallback: scrape hex blob from string repr
    msg = str(err)
    # Look for 0x followed by at least 8 hex chars
    import re
    m = re.search(r"0x[0-9a-fA-F]{8,}", msg)
    if m:
        try:
            return bytes.fromhex(m.group(0)[2:])
        except ValueError:
            return b""
    return b""


def _raise_decoded_revert(err: Exception, tx_hash_hex: str = ""):
    """If err contains a known custom error selector, raise the typed variant.
    Otherwise raise a generic RuntimeError preserving the original message.
    """
    data = _extract_revert_data(err)
    cls, name = _decode_revert(data)
    prefix = f"tx={tx_hash_hex} " if tx_hash_hex else ""
    if cls is not None:
        raise cls(f"{prefix}Vision revert: {name}()") from err
    raise RuntimeError(f"{prefix}Transaction reverted: {err}") from err

# ── ABI fragments ──────────────────────────────────────────────

ERC20_ABI = [
    {
        "name": "approve",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

VISION_ABI = [
    {
        "name": "joinBatchDirect",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "configHash", "type": "bytes32"},
            {"name": "depositAmount", "type": "uint256"},
            {"name": "bitmapHash", "type": "bytes32"},
        ],
        "outputs": [],
    },
    {
        "name": "getPosition",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "player", "type": "address"},
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "components": [
                    {"name": "bitmapHash", "type": "bytes32"},
                    {"name": "configHash", "type": "bytes32"},
                    {"name": "joinTimestamp", "type": "uint256"},
                    {"name": "totalDeposited", "type": "uint256"},
                ],
            }
        ],
    },
    {
        "name": "registerBot",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "endpoint", "type": "string"},
            {"name": "pubkeyHash", "type": "bytes32"},
        ],
        "outputs": [],
    },
    {
        "name": "getBatch",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "batchId", "type": "uint256"}],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "components": [
                    {"name": "creator", "type": "address"},
                    {"name": "sourceId", "type": "bytes32"},
                    {"name": "configHash", "type": "bytes32"},
                    {"name": "tickDuration", "type": "uint256"},
                    {"name": "lockOffset", "type": "uint256"},
                    {"name": "createdAtTick", "type": "uint256"},
                    {"name": "paused", "type": "bool"},
                    {"name": "settled", "type": "bool"},
                ],
            }
        ],
    },
    {
        "name": "nextBatchId",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "updateBitmap",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "configHash", "type": "bytes32"},
            {"name": "newHash", "type": "bytes32"},
        ],
        "outputs": [],
    },
    {
        "name": "PlayerSettled",
        "type": "event",
        "inputs": [
            {"name": "batchId", "type": "uint256", "indexed": True},
            {"name": "player", "type": "address", "indexed": True},
            {"name": "payout", "type": "uint256", "indexed": False},
            {"name": "fee", "type": "uint256", "indexed": False},
        ],
    },
]

ORACLE_REGISTRY_ABI = [
    {
        "name": "getActiveOracleEndpoints",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "bytes32[]"}],
    },
    {
        "name": "lastSnapshotNonce",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

# ── Deployment loader ──────────────────────────────────────────


def load_deployment() -> dict:
    """Load deployment addresses from the active deployment file."""
    paths = [
        "deployments/active-deployment.json",
        "../deployments/active-deployment.json",
        os.path.join(
            os.path.dirname(__file__), "..", "deployments", "active-deployment.json"
        ),
    ]
    for p in paths:
        if os.path.exists(p):
            with open(p) as f:
                return json.load(f)
    raise FileNotFoundError("Cannot find active-deployment.json")


# ── Faucet ─────────────────────────────────────────────────────


DEFAULT_FAUCET_URL = "https://generalmarket.io/api/bot/faucet"


def request_faucet(
    address: str,
    faucet_url: str = DEFAULT_FAUCET_URL,
    timeout: float = 60.0,
) -> dict:
    """Claim L3 GM + L3 USDC from the bot faucet. One claim per IP per 24h.

    Returns the faucet response on success. Raises RuntimeError on 429 (rate
    limited), 503 (faucet disabled), or any other non-2xx. Idempotent only in
    the sense that the faucet server deduplicates — a second call from the
    same IP within 24h will 429, not double-drip.
    """
    resp = requests.post(faucet_url, json={"address": address}, timeout=timeout)
    if resp.status_code == 429:
        raise RuntimeError(
            f"Faucet rate-limited: {resp.json().get('error', 'try again later')}"
        )
    if resp.status_code == 503:
        raise RuntimeError(
            f"Faucet unavailable: {resp.json().get('error', 'no rate limiter configured')}"
        )
    resp.raise_for_status()
    return resp.json()


# ── Executor ───────────────────────────────────────────────────


class Executor:
    """Handles all on-chain reads and writes for a single bot wallet."""

    def __init__(
        self,
        rpc_url: str,
        private_key: str,
        vision_addr: str,
        usdc_addr: str,
        oracle_registry_addr: str = "",
    ):
        # 30s socket timeout — RPCs that wedge silently are the slow death of bots.
        self.w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
        self.vision = self.w3.eth.contract(
            address=Web3.to_checksum_address(vision_addr), abi=VISION_ABI
        )
        self.usdc = self.w3.eth.contract(
            address=Web3.to_checksum_address(usdc_addr), abi=ERC20_ABI
        )
        self._oracle_registry = None
        if oracle_registry_addr:
            self._oracle_registry = self.w3.eth.contract(
                address=Web3.to_checksum_address(oracle_registry_addr),
                abi=ORACLE_REGISTRY_ABI,
            )
        self.account = self.w3.eth.account.from_key(private_key)
        self.bot_addr: str = self.account.address
        # Lazy: fetched on first tx build to avoid an RPC call in __init__.
        self._chain_id: int | None = None
        # Local nonce tracker — refetched on errors.
        self._next_nonce: int | None = None
        # Per-(batch_id, player) cache for settlement events. Once the event
        # exists it is immutable, so we can cache it forever.
        self._settlement_cache: dict = {}

    # ── internal ──

    def _refresh_nonce(self) -> int:
        """Refetch nonce from chain ('latest', not 'pending') and store it."""
        self._next_nonce = self.w3.eth.get_transaction_count(self.bot_addr, "latest")
        return self._next_nonce

    def _build_tx(self, gas: int = 300_000) -> dict:
        if self._next_nonce is None:
            self._refresh_nonce()
        if self._chain_id is None:
            self._chain_id = self.w3.eth.chain_id
        return {
            "from": self.bot_addr,
            "gas": gas,
            "gasPrice": self.w3.eth.gas_price,
            "nonce": self._next_nonce,
            "chainId": self._chain_id,
        }

    def _send_raw(self, tx: dict) -> bytes:
        """Sign and broadcast — no receipt wait. Returns tx hash."""
        signed = self.account.sign_transaction(tx)
        return self.w3.eth.send_raw_transaction(signed.raw_transaction)

    def _wait_receipt(self, tx_hash: bytes, timeout: int = 60):
        """Wait for receipt, decoding any revert into a typed exception."""
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)
        if receipt["status"] == 0:
            try:
                # Replay the call to extract revert data.
                tx_obj = self.w3.eth.get_transaction(tx_hash)
                call_tx = {
                    "from": tx_obj["from"],
                    "to": tx_obj["to"],
                    "data": tx_obj["input"],
                    "value": tx_obj.get("value", 0),
                    "gas": tx_obj.get("gas", 0),
                }
                self.w3.eth.call(call_tx, receipt["blockNumber"])
            except Exception as e:
                logger.error("Revert reason: %s", e)
                _raise_decoded_revert(e, tx_hash.hex())
            raise RuntimeError(f"Transaction reverted with status 0: {tx_hash.hex()}")
        return receipt

    def _sign_and_send(self, tx: dict, max_retries: int = 3) -> bytes:
        """Sign, broadcast, wait. Retries on nonce/underpriced/timeout problems.

        - nonce too low: refetch nonce, rebuild, retry (up to max_retries)
        - replacement underpriced: bump gasPrice 20%, retry once
        - already known: idempotent — wait on the same hash
        - TimeExhausted: poll mempool; if pending, wait 30s more; else resend with bumped gas
        """
        underpriced_retried = False
        for attempt in range(max_retries):
            try:
                tx_hash = self._send_raw(tx)
            except Exception as e:
                msg = str(e).lower()
                # Idempotent: tx is already in the mempool — wait on its hash.
                if "already known" in msg or "alreadyknown" in msg:
                    # Recover the hash by signing locally — same payload → same hash.
                    signed = self.account.sign_transaction(tx)
                    tx_hash = signed.hash
                    receipt = self._wait_receipt(tx_hash)
                    self._next_nonce = (self._next_nonce or 0) + 1
                    return tx_hash
                if "nonce too low" in msg or "nonce is too low" in msg:
                    logger.warning("Nonce too low, refetching (attempt %d)", attempt + 1)
                    self._refresh_nonce()
                    tx["nonce"] = self._next_nonce
                    continue
                if "replacement transaction underpriced" in msg or "underpriced" in msg:
                    if underpriced_retried:
                        raise
                    underpriced_retried = True
                    bumped = int(tx.get("gasPrice", self.w3.eth.gas_price) * 12 // 10)
                    logger.warning("Underpriced, bumping gasPrice → %d", bumped)
                    tx["gasPrice"] = bumped
                    continue
                # Unknown send failure — bubble up.
                raise

            # Sent successfully. Now wait for the receipt.
            try:
                self._wait_receipt(tx_hash)
                self._next_nonce = (self._next_nonce or 0) + 1
                return tx_hash
            except Exception as e:
                # Re-raise typed reverts immediately — retrying won't help.
                if isinstance(e, VisionRevertError):
                    raise
                msg = str(e).lower()
                if "timeexhausted" in msg or "time exhausted" in msg or "not in the chain" in msg:
                    logger.warning("wait_for_receipt timed out — checking mempool")
                    try:
                        pending = self.w3.eth.get_transaction(tx_hash)
                    except Exception:
                        pending = None
                    if pending is not None:
                        # Pending in mempool — wait 30 more seconds.
                        try:
                            self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
                            self._next_nonce = (self._next_nonce or 0) + 1
                            return tx_hash
                        except Exception:
                            pass
                    # Dropped from mempool — bump gas and resend (counts as a retry).
                    bumped = int(tx.get("gasPrice", self.w3.eth.gas_price) * 12 // 10)
                    logger.warning("Tx dropped — resending with gasPrice=%d", bumped)
                    tx["gasPrice"] = bumped
                    continue
                raise
        raise RuntimeError(f"_sign_and_send: exhausted {max_retries} retries")

    # ── read methods ──

    def last_snapshot_nonce(self) -> int:
        """Read lastSnapshotNonce from OracleRegistry (for BLS verification)."""
        if self._oracle_registry is None:
            return 0
        return self._oracle_registry.functions.lastSnapshotNonce().call()

    def usdc_balance(self) -> int:
        """Return USDC balance of this bot (raw wei)."""
        return self.usdc.functions.balanceOf(self.bot_addr).call()

    def get_position(self, batch_id: int) -> dict:
        """Read on-chain position for this bot in a batch.

        Raises BatchNotFoundError if the batch does not exist (creator == 0x0).
        Caller can distinguish "no batch" from "batch exists but not joined"
        (the latter returns totalDeposited=0 with no exception).
        """
        info = self.vision.functions.getBatch(batch_id).call()
        # info[0] is `creator`. Zero address means batch doesn't exist.
        if int(info[0], 16) == 0:
            raise BatchNotFoundError(f"Batch {batch_id} does not exist")
        raw = self.vision.functions.getPosition(batch_id, self.bot_addr).call()
        return {
            "bitmapHash": raw[0],
            "configHash": raw[1],
            "joinTimestamp": raw[2],
            "totalDeposited": raw[3],
        }

    def get_batch_info(self, batch_id: int) -> dict:
        """Read batch struct from chain."""
        info = self.vision.functions.getBatch(batch_id).call()
        return {
            "creator": info[0],
            "sourceId": info[1],
            "configHash": info[2],
            "tickDuration": info[3],
            "lockOffset": info[4],
            "createdAtTick": info[5],
            "paused": info[6],
            "settled": info[7],
        }

    def next_batch_id(self) -> int:
        """Return the next batch ID (= total count of batches)."""
        return self.vision.functions.nextBatchId().call()

    def is_tick_locked(self, batch_id: int) -> bool:
        """Check if a batch is currently in its lock window (last N seconds of the tick).

        Returns True if joining would revert with TickLocked(). Adds a 10-second
        safety cushion — block timestamps and node clocks lie just often enough
        to matter when you're submitting at the edge of a window.
        """
        info = self.get_batch_info(batch_id)
        tick_duration = info["tickDuration"]
        lock_offset = info["lockOffset"]
        if lock_offset == 0:
            return False
        block = self.w3.eth.get_block("latest")
        ts = block["timestamp"]
        current_abs_tick = ts // tick_duration
        tick_end = (current_abs_tick + 1) * tick_duration
        # 10s cushion: better to skip a tick than to burn gas on a guaranteed revert.
        return ts >= tick_end - lock_offset - 10

    # ── write: join flow ──

    def approve_usdc(self, amount: int):
        """Approve the Vision contract to spend USDC."""
        tx = self.usdc.functions.approve(
            Web3.to_checksum_address(self.vision.address), amount
        ).build_transaction(self._build_tx(gas=200_000))
        self._sign_and_send(tx)
        logger.info("USDC approved: %d", amount)

    def join_batch_direct(
        self, batch_id: int, config_hash: bytes, deposit: int, bitmap_hash: bytes
    ):
        """Join a batch with direct USDC transfer (approve first).

        One amount per join. The previous two-amount API leaked the difference
        between deposit and stake into a forgotten corner of the contract —
        the parimutuel only saw the stake, the wallet only saw the deposit,
        and the gap belonged to no one. Now there is just deposit.
        """
        tx = self.vision.functions.joinBatchDirect(
            batch_id, config_hash, deposit, bitmap_hash
        ).build_transaction(self._build_tx(gas=500_000))
        tx_hash = self._sign_and_send(tx)
        logger.info("Joined batch %d direct (tx: %s)", batch_id, tx_hash.hex()[:16])

    def register_bot(self, endpoint: str = "", pubkey_hash: bytes = b""):
        """Register as a bot on the Vision contract.

        Idempotent: if the bot is already registered, swallow the revert
        and return without raising. All other reverts propagate.
        """
        if not endpoint:
            endpoint = f"http://bot-{self.bot_addr[:8]}"
        if not pubkey_hash:
            pubkey_hash = Web3.keccak(text=f"bot-{self.bot_addr}")
        tx = self.vision.functions.registerBot(
            endpoint, pubkey_hash
        ).build_transaction(self._build_tx(gas=200_000))
        try:
            tx_hash = self._sign_and_send(tx)
        except BotAlreadyRegisteredError:
            logger.info("Bot already registered — skipping")
            return
        logger.info("Bot registered (tx: %s)", tx_hash.hex()[:16])

    # ── write: bitmap ──

    def update_bitmap(self, batch_id: int, config_hash: bytes, new_hash: bytes):
        """Update bitmap hash on-chain."""
        tx = self.vision.functions.updateBitmap(
            batch_id, config_hash, new_hash
        ).build_transaction(self._build_tx(gas=300_000))
        tx_hash = self._sign_and_send(tx)
        logger.info(
            "Bitmap updated batch=%d (tx: %s)", batch_id, tx_hash.hex()[:16]
        )

    # ── read: settlement events ──

    def get_settlement_payout(
        self, batch_id: int, player: str, from_block: int | None = None
    ) -> int:
        """Query PlayerSettled event to find the net payout for a player in a batch.

        Returns the payout amount (uint256) or 0 if no event found.

        ``from_block``: the earliest block to scan. Callers should pass the join
        block (or batch creation block). If None, defaults to ``latest - 100_000``,
        which is roughly 28 hours of L3 history at 1s blocks. Scanning from 0 on
        a long-lived chain will eventually hang the bot — refuse that path here.

        Results are cached per (batch_id, player) — once a non-zero payout is
        observed, the event is immutable and we never re-query.
        """
        player_cs = Web3.to_checksum_address(player)
        cache_key = (batch_id, player_cs)
        cached = self._settlement_cache.get(cache_key)
        if cached:
            return cached

        if from_block is None:
            try:
                latest = self.w3.eth.block_number
            except Exception:
                latest = 0
            from_block = max(0, latest - 100_000)

        try:
            logs = self.vision.events.PlayerSettled.get_logs(
                argument_filters={
                    "batchId": batch_id,
                    "player": player_cs,
                },
                fromBlock=from_block,
            )
            if logs:
                payout = logs[-1]["args"]["payout"]
                if payout:
                    self._settlement_cache[cache_key] = payout
                return payout
        except Exception as e:
            logger.debug("Failed to read PlayerSettled for batch %d: %s", batch_id, e)
        return 0


# ── Oracle discovery ───────────────────────────────────────────

# Module-level cache — shared across all calls in the process. Mutable
# default arguments are a 2007 mistake we don't repeat in 2026.
_ORACLE_DISCOVERY_CACHE: dict = {"urls": [], "ts": 0.0}
_ORACLE_DISCOVERY_TTL = 60  # 60s — short enough to react to rotations


def _probe_oracle(url: str, timeout: float = 3.0) -> bool:
    """Cheap reachability check. HEAD on root, treat any HTTP response as alive."""
    try:
        resp = requests.head(url, timeout=timeout, allow_redirects=True)
        return resp.status_code < 500
    except requests.RequestException:
        # Some oracles reject HEAD; try GET on a known-cheap path.
        try:
            resp = requests.get(url, timeout=timeout)
            return resp.status_code < 500
        except requests.RequestException:
            return False


def discover_oracles(
    mode: str,
    static_urls: list[str],
    w3=None,
    registry_addr: str = "",
    force_refresh: bool = False,
) -> list[str]:
    """
    Return list of oracle endpoint URLs.

    mode="static": return static_urls directly.
    mode="dynamic": call OracleRegistry.getActiveOracleEndpoints() on-chain,
                    cache for 60s, fallback to static_urls on error.

    Pass ``force_refresh=True`` after a bitmap submission failure to bypass
    the cache. The list is validated by probing one URL — if none respond,
    we return ``static_urls`` rather than the dead list.
    """
    if mode == "static":
        return static_urls

    now = time.time()
    cache = _ORACLE_DISCOVERY_CACHE
    if not force_refresh and cache.get("urls") and now - cache.get("ts", 0.0) < _ORACLE_DISCOVERY_TTL:
        return list(cache["urls"])

    try:
        if w3 is None:
            raise RuntimeError("w3 not provided for dynamic discovery")
        registry = w3.eth.contract(
            address=Web3.to_checksum_address(registry_addr),
            abi=ORACLE_REGISTRY_ABI,
        )
        raw_endpoints = registry.functions.getActiveOracleEndpoints().call()
        urls = []
        for ep in raw_endpoints:
            url = ep.rstrip(b"\x00").decode("utf-8", errors="ignore")
            if url:
                urls.append(url)

        if not urls:
            logger.warning("Registry returned 0 oracles — falling back to static")
            return static_urls

        # Probe one — if every URL is dead, the registry is lying. Use static.
        if not any(_probe_oracle(u) for u in urls[:3]):
            logger.warning("All probed oracles unreachable — falling back to static")
            return static_urls

        cache["urls"] = urls
        cache["ts"] = now
        logger.info("Discovered %d oracles from registry", len(urls))
        return list(urls)
    except Exception as e:
        logger.warning("Dynamic oracle discovery failed: %s — falling back to static", e)
        return static_urls


# ── Bitmap submission ──────────────────────────────────────────


def _post_bitmap_one(
    url: str,
    payload: dict,
    retries: int,
    timeout: float = 10.0,
) -> tuple:
    """POST a single bitmap to one oracle with retry logic.

    Returns (accepted: bool, last_error: str). Retries on:
      - connection errors / timeouts
      - HTTP 408, 429, 5xx
      - HTTP 404 (oracle hasn't seen the batch yet — give it a moment)

    Treats other 4xx as permanent failures.

    Backoff: exponential (1s, 2s, 4s) + jitter in [0.5, 1.5).
    """
    last_error = ""
    endpoint = f"{url}/vision/bitmap"
    for attempt in range(retries):
        try:
            resp = requests.post(endpoint, json=payload, timeout=timeout)
            if resp.ok:
                return (True, "")
            status = resp.status_code
            body = resp.text[:200] if resp.text else ""
            last_error = f"HTTP {status} {body}"
            transient = status in (404, 408, 429) or 500 <= status < 600
            if not transient:
                logger.warning("Bitmap rejected by %s (permanent): %s", url, last_error)
                return (False, last_error)
            logger.warning(
                "Bitmap rejected by %s (transient, attempt %d/%d): %s",
                url, attempt + 1, retries, last_error,
            )
        except (requests.Timeout, requests.ConnectionError) as e:
            last_error = f"{type(e).__name__}: {e}"
            logger.warning(
                "Bitmap POST to %s failed (attempt %d/%d): %s",
                url, attempt + 1, retries, last_error,
            )
        except requests.RequestException as e:
            last_error = f"{type(e).__name__}: {e}"
            logger.warning("Bitmap POST to %s failed (permanent): %s", url, last_error)
            return (False, last_error)

        if attempt < retries - 1:
            backoff = (2 ** attempt) * random.uniform(0.5, 1.5)
            time.sleep(backoff)

    return (False, last_error)


def submit_bitmap(
    oracle_urls: list[str],
    player: str,
    batch_id: int,
    bitmap: bytes,
    bitmap_hash: bytes,
    retries: int = 3,
    enforce_quorum: bool = True,
) -> int:
    """POST /vision/bitmap to each oracle in parallel. Returns acceptance count.

    Raises ``BitmapSubmitError`` if fewer than ``ceil(2/3 * N)`` oracles accept
    (BFT quorum). Set ``enforce_quorum=False`` to suppress the raise — silent
    partial acceptance is the worst possible outcome and the default refuses it.
    """
    total = len(oracle_urls)
    if total == 0:
        raise BitmapSubmitError(0, 0, "no oracle URLs provided")

    payload = {
        "player": player,
        "batch_id": batch_id,
        "bitmap_hex": "0x" + bitmap.hex(),
        "expected_hash": "0x" + bitmap_hash.hex(),
    }

    accepted = 0
    last_error = ""
    # Fan out — one slow oracle should never block the others.
    with ThreadPoolExecutor(max_workers=total) as pool:
        futures = {
            pool.submit(_post_bitmap_one, url, payload, retries): url
            for url in oracle_urls
        }
        for fut in as_completed(futures):
            url = futures[fut]
            try:
                ok, err = fut.result()
            except Exception as e:
                ok, err = False, f"executor error: {e}"
            if ok:
                accepted += 1
            elif err:
                last_error = err

    quorum = math.ceil(2 * total / 3)
    logger.info(
        "Bitmap submitted to %d/%d oracles (quorum=%d)",
        accepted, total, quorum,
    )
    if enforce_quorum and accepted < quorum:
        raise BitmapSubmitError(accepted, total, last_error)
    return accepted


# ── Batch fetching ─────────────────────────────────────────────


def load_batch_mapping() -> dict:
    """Load vision-batches.json produced by DeployAllVisionBatches."""
    paths = [
        "deployments/vision-batches.json",
        "../deployments/vision-batches.json",
        os.path.join(os.path.dirname(__file__), "..", "..", "deployments", "vision-batches.json"),
    ]
    for p in paths:
        if os.path.exists(p):
            with open(p) as f:
                return json.load(f)
    return {}


def fetch_batches(api_url: str, executor=None) -> list[dict]:
    """
    Get available batches. Tries oracle API first, then falls back to
    vision-batches.json + on-chain reads.
    """
    # Try oracle API
    try:
        resp = requests.get(f"{api_url}/vision/batches", timeout=10)
        if resp.ok:
            data = resp.json()
            batches = data.get("batches", data if isinstance(data, list) else [])
            if batches:
                return batches
    except requests.RequestException:
        pass

    # Fallback: vision-batches.json (always available after DeployAllVisionBatches)
    mapping = load_batch_mapping()
    if mapping and mapping.get("batches"):
        batches = []
        for source_name, entry in mapping["batches"].items():
            if source_name.startswith("e2e_test_"):
                continue  # skip E2E test batches
            batches.append({
                "id": entry["batchId"],
                "batch_id": entry["batchId"],
                "source_name": source_name,
                "config_hash": entry["configHash"],
                "market_count": 0,  # unknown — bot MUST fetch from data-node by config_hash
                "paused": False,
            })
        if batches:
            logger.info("Loaded %d batches from vision-batches.json", len(batches))
            return batches

    # Last resort: on-chain scan
    if executor:
        try:
            count = executor.next_batch_id()
            batches = []
            for i in range(count):
                try:
                    info = executor.get_batch_info(i)
                    if info["creator"] != "0x" + "0" * 40 and not info["paused"]:
                        batches.append({
                            "id": i,
                            "batch_id": i,
                            "config_hash": "0x" + info["configHash"].hex(),
                            "market_count": 0,  # unknown — bot MUST fetch from data-node
                            "paused": False,
                        })
                except Exception:
                    pass
            if batches:
                logger.info("Loaded %d batches from chain", len(batches))
                return batches
        except Exception as e:
            logger.warning("On-chain batch scan failed: %s", e)

    return []


# ── Batch config fetching ─────────────────────────────────────

# Config hashes are keccak256 of immutable content — they never change.
# LRU bounds the cache so it cannot grow forever in a long-running bot.


class _ConfigMissError(Exception):
    """Internal sentinel — fetch failed, do not cache the miss."""


@functools.lru_cache(maxsize=1024)
def _fetch_batch_config_cached(data_node_url: str, config_hash: str) -> dict:
    """LRU-bounded fetch — only successful responses enter the cache.

    Raises ``_ConfigMissError`` on failure so the LRU does not memoize None.
    """
    try:
        resp = requests.get(
            f"{data_node_url}/batches/config/{config_hash}", timeout=10
        )
        if resp.ok:
            return resp.json()
        raise _ConfigMissError(f"HTTP {resp.status_code}")
    except requests.RequestException as e:
        logger.debug("Failed to fetch config %s: %s", config_hash[:18], e)
        raise _ConfigMissError(str(e)) from e


def fetch_batch_config(data_node_url: str, config_hash: str):
    """
    Fetch batch config from data-node by configHash.
    Returns dict with 'markets' (list of asset dicts) and 'sourceId', or None on failure.

    Bounded by LRU cache (maxsize=1024). Config hashes are immutable so any
    cache hit is always correct. Misses are never memoized — the next call
    retries the data-node.
    """
    if not config_hash:
        return None
    if not config_hash.startswith("0x"):
        config_hash = "0x" + config_hash
    try:
        return _fetch_batch_config_cached(data_node_url, config_hash)
    except _ConfigMissError:
        return None


# ── Market data fetching ──────────────────────────────────────


def fetch_markets(data_node_url: str, market_ids: list[str]) -> list[dict]:
    """
    GET /vision/snapshot from data-node.
    Returns list of dicts matching Strategy.predict() input format.

    Data-node returns: {"snapshots": [{"asset_id": ..., "value": ..., "change_pct": ..., ...}]}
    """
    default = [
        {"id": mid, "price": 0, "change": None, "volume": None, "market_cap": None}
        for mid in market_ids
    ]
    try:
        resp = requests.get(f"{data_node_url}/vision/snapshot", timeout=10)
        if resp.ok:
            data = resp.json()
            # Data-node uses "snapshots" key with "asset_id" field (not "markets"/"id")
            snapshots = data.get("snapshots", data.get("markets", []))
            by_id = {}
            for m in snapshots:
                aid = m.get("asset_id", m.get("id", ""))
                if aid:
                    by_id[aid] = m
            result = []
            matched = 0
            for mid in market_ids:
                if mid in by_id:
                    m = by_id[mid]
                    # Map data-node fields to strategy format:
                    # value → price, change_pct → change, volume_24h → volume
                    price = m.get("value", m.get("price", 0))
                    if isinstance(price, str):
                        try:
                            price = float(price)
                        except ValueError:
                            price = 0
                    change = m.get("change_pct", m.get("change"))
                    if isinstance(change, str):
                        try:
                            change = float(change)
                        except ValueError:
                            change = None
                    result.append(
                        {
                            "id": mid,
                            "price": price,
                            "change": change,
                            "volume": m.get("volume_24h", m.get("volume")),
                            "market_cap": m.get("market_cap"),
                        }
                    )
                    matched += 1
                else:
                    result.append(
                        {
                            "id": mid,
                            "price": 0,
                            "change": None,
                            "volume": None,
                            "market_cap": None,
                        }
                    )
            if matched > 0:
                logger.info("Fetched %d/%d market prices from data-node", matched, len(market_ids))
            return result
    except requests.RequestException as e:
        logger.debug("Snapshot fetch failed: %s", e)
    return default


# ── Vault ABIs ────────────────────────────────────────────────

VAULT_ABI = [
    # Read
    {"type": "function", "name": "name", "inputs": [], "outputs": [{"type": "string"}], "stateMutability": "view"},
    {"type": "function", "name": "totalAssets", "inputs": [], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    {"type": "function", "name": "totalSupply", "inputs": [], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    {"type": "function", "name": "highWaterMark", "inputs": [], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    {"type": "function", "name": "totalActiveCapital", "inputs": [], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    {"type": "function", "name": "idleUSDC", "inputs": [], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    {"type": "function", "name": "balanceOf", "inputs": [{"type": "address"}], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    {"type": "function", "name": "manager", "inputs": [], "outputs": [{"type": "address"}], "stateMutability": "view"},
    {"type": "function", "name": "performanceFeeRate", "inputs": [], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    {"type": "function", "name": "activeBatchDeposits", "inputs": [{"type": "uint256"}], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    # Write
    {"type": "function", "name": "requestDeposit", "inputs": [{"type": "uint256"}, {"type": "address"}, {"type": "address"}], "outputs": [{"type": "uint256"}], "stateMutability": "nonpayable"},
    {"type": "function", "name": "claimDeposit", "inputs": [{"type": "address"}, {"type": "address"}], "outputs": [{"type": "uint256"}], "stateMutability": "nonpayable"},
    {"type": "function", "name": "requestRedeem", "inputs": [{"type": "uint256"}, {"type": "address"}, {"type": "address"}], "outputs": [{"type": "uint256"}], "stateMutability": "nonpayable"},
    {"type": "function", "name": "claimRedeem", "inputs": [{"type": "address"}, {"type": "address"}], "outputs": [{"type": "uint256"}], "stateMutability": "nonpayable"},
    {"type": "function", "name": "joinBatch", "inputs": [{"type": "uint256"}, {"type": "bytes32"}, {"type": "uint256"}, {"type": "bytes32"}], "outputs": [], "stateMutability": "nonpayable"},
    {"type": "function", "name": "updateBitmap", "inputs": [{"type": "uint256"}, {"type": "bytes32"}, {"type": "bytes32"}], "outputs": [], "stateMutability": "nonpayable"},
    {"type": "function", "name": "reconcile", "inputs": [{"type": "uint256"}], "outputs": [], "stateMutability": "nonpayable"},
]

FACTORY_ABI = [
    {"type": "function", "name": "createVault", "inputs": [{"type": "string"}, {"type": "string"}, {"type": "uint256"}, {"type": "address"}], "outputs": [{"type": "address"}], "stateMutability": "nonpayable"},
    {"type": "function", "name": "getAllVaults", "inputs": [], "outputs": [{"type": "address[]"}], "stateMutability": "view"},
    {"type": "function", "name": "getVaultsByManager", "inputs": [{"type": "address"}], "outputs": [{"type": "address[]"}], "stateMutability": "view"},
]


# ── VaultExecutor ─────────────────────────────────────────────


class VaultExecutor:
    """Wraps Executor for vault-mode trading. Calls VisionVault instead of Vision directly."""

    def __init__(self, executor: Executor, vault_addr: str, factory_addr: str = ""):
        self.executor = executor
        self.w3 = executor.w3
        self.account = executor.account
        self.bot_addr = executor.bot_addr
        self.vault_addr = Web3.to_checksum_address(vault_addr)
        self.vault = self.w3.eth.contract(address=self.vault_addr, abi=VAULT_ABI)
        self._factory = None
        if factory_addr:
            self._factory = self.w3.eth.contract(
                address=Web3.to_checksum_address(factory_addr), abi=FACTORY_ABI
            )

    def _build_tx(self, gas: int = 500_000) -> dict:
        return self.executor._build_tx(gas)

    def _sign_and_send(self, tx: dict) -> bytes:
        return self.executor._sign_and_send(tx)

    # ── factory ──

    @classmethod
    def create_vault(
        cls,
        executor: Executor,
        factory_addr: str,
        name: str,
        symbol: str,
        perf_fee_bps: int,
    ) -> "VaultExecutor":
        """Deploy a new vault via factory. Returns a VaultExecutor bound to the new vault."""
        factory = executor.w3.eth.contract(
            address=Web3.to_checksum_address(factory_addr), abi=FACTORY_ABI
        )
        tx = factory.functions.createVault(
            name, symbol, perf_fee_bps, executor.bot_addr
        ).build_transaction(executor._build_tx(gas=2_000_000))
        tx_hash = executor._sign_and_send(tx)
        receipt = executor.w3.eth.get_transaction_receipt(tx_hash)
        # Parse vault address from return value — read the last created vault
        vaults = factory.functions.getVaultsByManager(executor.bot_addr).call()
        if not vaults:
            raise RuntimeError("createVault succeeded but no vault found for manager")
        vault_addr = vaults[-1]
        logger.info("Vault created: %s (tx: %s)", vault_addr, tx_hash.hex()[:16])
        return cls(executor, vault_addr, factory_addr)

    # ── deposits / withdrawals ──

    def deposit_to_vault(self, amount: int):
        """Approve USDC to vault, requestDeposit, then claimDeposit."""
        # Approve USDC to the vault contract
        tx = self.executor.usdc.functions.approve(
            self.vault_addr, amount
        ).build_transaction(self._build_tx(gas=200_000))
        self._sign_and_send(tx)

        # requestDeposit(amount, receiver, controller)
        tx = self.vault.functions.requestDeposit(
            amount, self.bot_addr, self.bot_addr
        ).build_transaction(self._build_tx(gas=500_000))
        self._sign_and_send(tx)

        # claimDeposit(receiver, controller)
        tx = self.vault.functions.claimDeposit(
            self.bot_addr, self.bot_addr
        ).build_transaction(self._build_tx(gas=500_000))
        tx_hash = self._sign_and_send(tx)
        logger.info("Deposited %d to vault %s (tx: %s)", amount, self.vault_addr[:10], tx_hash.hex()[:16])

    def withdraw_from_vault(self, shares: int):
        """requestRedeem then claimRedeem."""
        tx = self.vault.functions.requestRedeem(
            shares, self.bot_addr, self.bot_addr
        ).build_transaction(self._build_tx(gas=500_000))
        self._sign_and_send(tx)

        tx = self.vault.functions.claimRedeem(
            self.bot_addr, self.bot_addr
        ).build_transaction(self._build_tx(gas=500_000))
        tx_hash = self._sign_and_send(tx)
        logger.info("Withdrew %d shares from vault (tx: %s)", shares, tx_hash.hex()[:16])

    # ── trading ──

    def join_batch(
        self, batch_id: int, config_hash: bytes, deposit: int, bitmap_hash: bytes
    ):
        """Call vault.joinBatch — vault handles USDC internally.

        One amount per join. See Executor.join_batch_direct for the autopsy
        of the previous two-amount design.
        """
        tx = self.vault.functions.joinBatch(
            batch_id, config_hash, deposit, bitmap_hash
        ).build_transaction(self._build_tx(gas=800_000))
        tx_hash = self._sign_and_send(tx)
        logger.info("Vault joined batch %d (tx: %s)", batch_id, tx_hash.hex()[:16])

    def update_bitmap(self, batch_id: int, config_hash: bytes, new_hash: bytes):
        """Call vault.updateBitmap."""
        tx = self.vault.functions.updateBitmap(
            batch_id, config_hash, new_hash
        ).build_transaction(self._build_tx(gas=300_000))
        tx_hash = self._sign_and_send(tx)
        logger.info("Vault bitmap updated batch=%d (tx: %s)", batch_id, tx_hash.hex()[:16])

    def reconcile(self, batch_id: int, settlement_payout: int = 0):
        """Call vault.reconcile after settlement.

        The deployed VisionVault uses the single-arg signature reconcile(uint256).
        settlement_payout is accepted for backwards compatibility but ignored —
        the contract derives PnL from totalAssets() before/after the decrement.
        """
        tx = self.vault.functions.reconcile(
            batch_id
        ).build_transaction(self._build_tx(gas=500_000))
        tx_hash = self._sign_and_send(tx)
        logger.info("Vault reconciled batch %d (tx: %s)", batch_id, tx_hash.hex()[:16])

    # ── reads ──

    def get_vault_info(self) -> dict:
        """Read vault state in one shot."""
        return {
            "address": self.vault_addr,
            "name": self.vault.functions.name().call(),
            "total_assets": self.vault.functions.totalAssets().call(),
            "total_supply": self.vault.functions.totalSupply().call(),
            "hwm": self.vault.functions.highWaterMark().call(),
            "active_capital": self.vault.functions.totalActiveCapital().call(),
            "idle_usdc": self.vault.functions.idleUSDC().call(),
            "manager": self.vault.functions.manager().call(),
            "manager_shares": self.vault.functions.balanceOf(self.bot_addr).call(),
            "perf_fee_rate": self.vault.functions.performanceFeeRate().call(),
        }

    def get_active_deposit(self, batch_id: int) -> int:
        """Read how much capital is locked in a specific batch."""
        return self.vault.functions.activeBatchDeposits(batch_id).call()
