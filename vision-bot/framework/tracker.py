from __future__ import annotations

import json
import logging
import os
import random
import time
from typing import Dict, List, Optional, Set

import requests

from framework.chain import AlreadyJoinedError, BitmapSubmitError

log = logging.getLogger("vision-bot")


class Tracker:
    """Tracks active positions, PnL, and handles auto-claim/withdraw."""

    # Cap history growth — pnl.json is not a journal, it is a tombstone.
    MAX_HISTORY = 1000
    # Number of consecutive failures before a batch is permanently skipped.
    MAX_SKIP_RETRIES = 5

    def __init__(self, executor, config: dict, oracle_urls_fn):
        """
        executor: framework.chain.Executor instance
        config: flat dict from config.toml (keys: auto_claim, auto_withdraw, claim_above, withdraw_below, pnl_file)
        oracle_urls_fn: callable that returns list[str] of oracle URLs
        """
        self._executor = executor
        self._config = config
        self._oracle_urls_fn = oracle_urls_fn
        self._positions: dict[int, dict] = {}  # batch_id -> position info
        self._history: list[dict] = []  # completed positions
        # Per-batch retry counters. Replaces a binary blacklist that turned
        # any transient hiccup into a permanent grave.
        self._skip_retries: dict[int, int] = {}
        # Round-robin cursor across oracle URLs — never trust a single endpoint
        # to remain alive for the months this bot is supposed to run.
        self._oracle_cursor = 0
        # USDC decimals — read once from the contract. L3 USDC is 18 decimals,
        # but assuming so without asking is the kind of mistake that costs money.
        self._usdc_decimals = self._read_usdc_decimals()
        self._usdc_unit = 10 ** self._usdc_decimals
        self._load_history()

    def _read_usdc_decimals(self) -> int:
        """Read USDC decimals from the contract once. Default 18 on failure."""
        try:
            usdc = getattr(self._executor, "usdc", None)
            if usdc is not None:
                return int(usdc.functions.decimals().call())
        except Exception as e:
            log.warning("Failed to read USDC decimals from contract: %s — defaulting to 18", e)
        return 18

    def _oracle_get(self, path: str, timeout: float = 10):
        """GET path against oracle URLs in round-robin order until one responds 2xx.

        Returns the parsed JSON dict, or None if every oracle failed.
        Path must start with '/'. The cursor advances on every call so load
        spreads across the cluster instead of pinning the unlucky first entry.
        """
        urls = self._oracle_urls_fn()
        if not urls:
            return None
        n = len(urls)
        start = self._oracle_cursor % n
        self._oracle_cursor = (self._oracle_cursor + 1) % n
        order = [urls[(start + i) % n] for i in range(n)]
        for url in order:
            try:
                resp = requests.get(f"{url}{path}", timeout=timeout)
                if resp.ok:
                    return resp.json()
                log.debug("Oracle %s returned %d for %s", url, resp.status_code, path)
            except requests.RequestException as e:
                log.debug("Oracle %s unreachable for %s: %s", url, path, e)
                continue
        return None

    def on_join(self, batch_id: int, deposit_wei: int, bitmap: bytes, bets: list[str], bitmap_hash: bytes | None = None):
        """Record a new join."""
        self._positions[batch_id] = {
            "batch_id": batch_id,
            "deposited": deposit_wei,
            "balance": deposit_wei,
            "pnl": 0,
            "bitmap": bitmap,
            "bitmap_hash": bitmap_hash,
            "bets": bets,
            "joined_at": time.time(),
            "last_claimed_tick": 0,
        }
        self._save_history()
        log.info("Tracking batch %d (deposit: %d)", batch_id, deposit_wei)

    def check_all(self):
        """
        Called each poll cycle. For each active position:
        1. Fetch balance from oracle API
        2. Compute PnL
        3. If auto_claim and profitable enough -> try claim
        4. If auto_withdraw and balance too low -> try withdraw
        5. Save history
        6. Log summary
        """
        if not self._positions:
            return []

        to_remove = []
        for batch_id, pos in list(self._positions.items()):
            balance = self._fetch_balance(batch_id)
            if balance is not None:
                pos["balance"] = balance
                # The oracle's /vision/balance endpoint reports the running NET
                # balance: initial deposit plus the cumulative sum of tick wins
                # and losses (see oracle/src/vision/resolver.rs — player_balances
                # is computed as deposit + delta where delta absorbs both wins
                # and stake decay). Therefore PnL = balance - deposited is exact.
                # If you ever change the oracle to report gross balance, this
                # formula becomes wrong and the bot will look richer than it is.
                pos["pnl"] = balance - pos["deposited"]

            # Auto-claim check
            claim_threshold = self._config.get("claim_above", 5) * self._usdc_unit
            if self._config.get("auto_claim", True) and pos["pnl"] > claim_threshold:
                self._try_claim(batch_id, pos)

            # Auto-withdraw check
            withdraw_threshold = self._config.get("withdraw_below", 2) * self._usdc_unit
            if self._config.get("auto_withdraw", True) and pos["balance"] < withdraw_threshold:
                withdrawn = self._try_withdraw(batch_id, pos)
                if withdrawn:
                    to_remove.append(batch_id)

        for bid in to_remove:
            pos = self._positions.pop(bid)
            self._history.append(pos)
        # Trim history — bookkeeping that grows without bound becomes a corpse.
        if len(self._history) > self.MAX_HISTORY:
            self._history = self._history[-self.MAX_HISTORY:]

        self._save_history()

        # Log summary
        if self._positions:
            total_pnl = sum(p["pnl"] for p in self._positions.values())
            log.info("Tracking %d positions, total PnL: %d", len(self._positions), total_pnl)

        return to_remove

    def check_rounds(self, strategy=None):
        """Round-based mode: join ALL active batches from the oracle API."""
        urls = self._oracle_urls_fn()
        if not urls:
            return
        try:
            # Fetch all non-paused batches — round-robin so a single dead
            # oracle does not blind the bot for hours.
            data = self._oracle_get("/vision/batches")
            if data is None:
                return
            all_batches = data.get("batches", [])
            # Filter: non-paused, has markets, not already joined
            # Deduplicate: only the LATEST batch per source (highest ID = most recent round)
            by_source = {}
            for b in all_batches:
                if b.get("paused"):
                    continue
                src = b.get("source_id", "")
                if src not in by_source or b.get("id", 0) > by_source[src].get("id", 0):
                    by_source[src] = b
            active = list(by_source.values())
            max_per_cycle = 100  # Join all sources in one cycle
            joined = 0
            for batch in active:
                bid = batch.get("id", -1)
                if bid < 0 or bid in self.active_ids:
                    continue
                if self._skip_retries.get(bid, 0) >= self.MAX_SKIP_RETRIES:
                    continue

                # On-chain guard: if already joined, track the position and skip.
                # Prevents AlreadyJoined() reverts when tracker state was lost
                # (process restart, pnl.json out of sync, etc.)
                try:
                    pos = self._executor.get_position(bid)
                    if pos["joinTimestamp"] > 0:
                        log.debug("Batch %d: already joined on-chain, adding to tracker", bid)
                        self._positions[bid] = {
                            "batch_id": bid,
                            "deposited": pos["totalDeposited"],
                            "balance": pos["totalDeposited"],
                            "pnl": 0,
                            "bitmap": None,
                            "bitmap_hash": pos.get("bitmapHash"),
                            "bets": [],
                            # Authoritative chain timestamp — survives clock skew
                            # and matches what the contract sees.
                            "joined_at": pos["joinTimestamp"],
                            "last_claimed_tick": 0,
                        }
                        # The position exists; clear any retry counter for it.
                        self._skip_retries.pop(bid, None)
                        continue
                except Exception:
                    pass  # chain read failed, proceed with join attempt

                if joined >= max_per_cycle:
                    break
                try:
                    # Adapt oracle batch format to what _join_round expects
                    round_info = {
                        "batchId": bid,
                        "configHash": batch.get("config_hash", ""),
                        "marketCount": batch.get("market_count", 0),
                    }
                    self._join_round(round_info, strategy=strategy)
                    joined += 1
                    # Success — forgive past sins.
                    self._skip_retries.pop(bid, None)
                except AlreadyJoinedError:
                    # Chain says we already joined this batch. Trust it,
                    # reconcile the tracker, and stop re-trying. The pre-check
                    # above can miss this if get_position raised, if the bot
                    # restarted mid-cycle, or if a sibling process joined first.
                    log.info("Batch %d: AlreadyJoined — reconciling tracker with chain", bid)
                    try:
                        pos = self._executor.get_position(bid)
                        if pos["joinTimestamp"] > 0:
                            self._positions[bid] = {
                                "batch_id": bid,
                                "deposited": pos["totalDeposited"],
                                "balance": pos["totalDeposited"],
                                "pnl": 0,
                                "bitmap": None,
                                "bitmap_hash": pos.get("bitmapHash"),
                                "bets": [],
                                "joined_at": pos["joinTimestamp"],
                                "last_claimed_tick": 0,
                            }
                    except Exception as e:
                        log.warning("Batch %d: AlreadyJoined but get_position failed: %s", bid, e)
                    self._skip_retries.pop(bid, None)
                except BitmapSubmitError as e:
                    log.warning("Batch %d: bitmap quorum not reached: %s", bid, e)
                    self._skip_retries[bid] = self._skip_retries.get(bid, 0) + 1
                except Exception as e:
                    log.warning("Failed to join batch %d: %s", bid, e)
                    self._skip_retries[bid] = self._skip_retries.get(bid, 0) + 1
                    if self._skip_retries[bid] >= self.MAX_SKIP_RETRIES:
                        log.warning(
                            "Batch %d: failed %d times — permanent skip until restart-with-success",
                            bid, self._skip_retries[bid],
                        )
        except Exception as e:
            log.warning("Round check failed: %s", e)

    def _join_round(self, batch: dict, strategy=None):
        """Join a round-based batch: approve USDC, call joinBatchDirect, submit bitmap."""
        batch_id = batch.get("batchId", batch.get("id"))
        config_hash = batch.get("configHash", batch.get("config_hash", b"\x00" * 32))
        deposit = int(self._config.get("deposit", 10) * self._usdc_unit)

        # Generate predictions using real market data from data-node.
        # The ONLY trustworthy source of market count is fetch_batch_config
        # (keyed by config_hash, which is immutable per batch). The oracle
        # API's market_count is a stale echo from creation time — never use
        # it for bitmap sizing. A short bitmap means uncovered markets,
        # concentrated risk, and amplified losses.
        from framework.core import encode_bitmap, hash_bitmap
        from framework.chain import fetch_batch_config, fetch_markets

        # Fetch the authoritative market list from data-node by config hash
        market_ids = []
        config_hash_hex = ""
        if isinstance(config_hash, bytes):
            config_hash_hex = "0x" + config_hash.hex()
        elif isinstance(config_hash, str):
            config_hash_hex = config_hash if config_hash.startswith("0x") else "0x" + config_hash

        if config_hash_hex:
            batch_cfg = fetch_batch_config(self._config.get("data_node", ""), config_hash_hex)
            if batch_cfg and batch_cfg.get("markets"):
                # Defensive: only keep markets that actually carry an assetId.
                market_ids = [
                    m["assetId"] for m in batch_cfg["markets"]
                    if isinstance(m, dict) and m.get("assetId")
                ]

        # Refuse to join if we cannot determine the real market list.
        # A bitmap built on a guess is worse than no bitmap at all —
        # it is a bet with the wrong number of limbs.
        if not market_ids:
            log.warning(
                "Batch %d: cannot determine market list from data-node "
                "(config_hash=%s) — refusing to join with unreliable count",
                batch_id, config_hash_hex[:18],
            )
            return

        market_count = len(market_ids)
        markets = fetch_markets(self._config.get("data_node", ""), market_ids) or []
        # Validate market structure before handing it to a strategy.
        # A strategy that receives None or malformed entries will produce
        # garbage predictions and call them confidence.
        markets = [m if isinstance(m, dict) else {"id": None} for m in markets]

        bets = strategy.predict(markets) if strategy else [random.choice(["UP", "DOWN"]) for _ in range(market_count)]

        # Defensive: ensure bets list covers every market.
        # Strategies return one prediction per input market, but if a strategy
        # is buggy and returns fewer, pad with random to avoid a short bitmap.
        while len(bets) < market_count:
            bets.append(random.choice(["UP", "DOWN"]))

        ups = sum(1 for b in bets if b == "UP")
        log.info("Batch %d: strategy=%s, %d UP / %d DOWN (%d markets, verified)",
                 batch_id, getattr(strategy, 'name', '?'), ups, len(bets) - ups, market_count)
        bitmap = encode_bitmap(bets, market_count)
        bitmap_hash = hash_bitmap(bitmap)

        # Skip batches in lock window to avoid TickLocked() reverts
        try:
            if self._executor.is_tick_locked(batch_id):
                log.debug("Batch %d: tick locked, skipping", batch_id)
                return
        except Exception:
            pass  # proceed if check fails

        # On-chain: approve max once (not per-join — multiple joins in one cycle exhaust allowance)
        MAX_UINT = 2**256 - 1
        if not getattr(self, '_usdc_approved', False):
            self._executor.approve_usdc(MAX_UINT)
            self._usdc_approved = True
        if isinstance(config_hash, str):
            config_hash = bytes.fromhex(config_hash.replace("0x", ""))
        self._executor.join_batch_direct(batch_id, config_hash, deposit, bitmap_hash)

        # Wait for block confirmation before submitting bitmap to oracles
        # (oracles need to index the PlayerJoined event first)
        time.sleep(2)

        # Submit bitmap to oracles. The new chain.submit_bitmap raises
        # BitmapSubmitError on quorum failure — we propagate so check_rounds
        # can mark the batch for retry rather than silently track an unbacked
        # commitment.
        from framework.chain import submit_bitmap
        urls = self._oracle_urls_fn()
        try:
            submit_bitmap(urls, self._executor.bot_addr, batch_id, bitmap, bitmap_hash)
        except BitmapSubmitError:
            # The on-chain join already happened — record the position so we
            # can retry bitmap submission on subsequent cycles. Without this,
            # the position lives on-chain but the tracker forgets it.
            self.on_join(batch_id, deposit, bitmap, bets, bitmap_hash=bitmap_hash)
            raise

        # Track
        self.on_join(batch_id, deposit, bitmap, bets, bitmap_hash=bitmap_hash)
        log.info("Joined round %d (%d markets)", batch_id, market_count)

    def _try_claim(self, batch_id: int, pos: dict):
        """Round-based settlement handles claims automatically via oracle consensus.
        This is a no-op in the current contract — kept as stub for future use."""
        log.debug("Batch %d: auto-claim not available (round-based settlement)", batch_id)

    def _try_withdraw(self, batch_id: int, pos: dict) -> bool:
        """Round-based settlement handles withdrawals automatically.
        Check oracle for position status and mark inactive if settled."""
        try:
            player = self._executor.bot_addr
            data = self._oracle_get(f"/vision/balance/{batch_id}/{player}")
            if data is None:
                return False
            # If oracle reports position settled, mark as exited
            if data.get("settled", False):
                pos["balance"] = int(data.get("balance", 0))
                log.info("Batch %d: settled (final: %d)", batch_id, pos["balance"])
                return True
            return False
        except Exception as e:
            log.warning("Batch %d: withdraw check failed: %s", batch_id, e)
            return False

    def _fetch_balance(self, batch_id: int) -> int | None:
        """GET /vision/balance/{batch_id}/{player}, round-robin across oracles."""
        player = self._executor.bot_addr
        data = self._oracle_get(f"/vision/balance/{batch_id}/{player}")
        if data is None:
            return None
        val = data.get("balance")
        try:
            return int(val) if val is not None else None
        except (TypeError, ValueError):
            return None

    @property
    def active_ids(self) -> set[int]:
        return set(self._positions.keys())

    @property
    def active_count(self) -> int:
        return len(self._positions)

    @property
    def positions(self) -> dict[int, dict]:
        return self._positions

    def get_summary(self) -> dict:
        """Return aggregate PnL stats."""
        active_pnl = sum(p["pnl"] for p in self._positions.values())
        history_pnl = sum(p.get("pnl", 0) for p in self._history)
        return {
            "active_batches": len(self._positions),
            "active_pnl": active_pnl,
            "completed_batches": len(self._history),
            "completed_pnl": history_pnl,
            "total_pnl": active_pnl + history_pnl,
        }

    # ── Vault state ──

    def check_vault_state(self, vault_executor) -> dict | None:
        """Read and log current vault metrics. Returns info dict or None on failure."""
        try:
            info = vault_executor.get_vault_info()
            dec = self._usdc_unit
            log.info(
                "Vault %s | assets=%d | supply=%d | hwm=%d | idle=%d | shares=%d",
                info["address"][:10],
                info["total_assets"] // dec,
                info["total_supply"] // dec,
                info["hwm"] // dec,
                info["idle_usdc"] // dec,
                info["manager_shares"] // dec,
            )
            return info
        except Exception as e:
            log.warning("Vault state read failed: %s", e)
            return None

    # Keccak256 of empty bytes — produced when joining without a real bitmap.
    _NULL_BITMAP_HASH = "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    # bytes32(0) — the zero hash
    _ZERO_HASH = "0" * 64

    @staticmethod
    def _is_null_hash(hash_bytes) -> bool:
        """Return True if the on-chain bitmapHash is null (bytes32(0) or keccak256(empty))."""
        if isinstance(hash_bytes, bytes):
            h = hash_bytes.hex()
        else:
            # removeprefix only strips the literal "0x" — lstrip would chew
            # any leading 0/x characters and silently mangle real hashes.
            h = str(hash_bytes).removeprefix("0x")
        return h == Tracker._NULL_BITMAP_HASH or h == Tracker._ZERO_HASH or not h

    def recover_bitmaps(self, strategy, data_node_url: str, oracle_urls: List[str]) -> List[int]:
        """
        For every active position that has no stored bitmap, attempt recovery:

        1. NULL on-chain hash: the position was joined without a real commitment.
           Fetch real market data, generate a fresh bitmap, call updateBitmap on
           chain, then submit to oracles. The contract permits replacing a null
           hash exactly once.

        2. REAL on-chain hash (bitmap bytes lost): there is nothing to do. The
           hash is fixed, and a regenerated bitmap will not collide with it.
           Pretending otherwise — by feeding strategies fake price=0 data and
           hoping for the best — turns the bot into a roulette machine. Mark
           the position poisoned and let the operator withdraw it.

        Returns list of batch_ids that are unrecoverable (chain errors, real
        hash with no stored bytes, missing market data) and need withdrawal.

        Called once per bot startup, after _load_history.
        """
        from framework.chain import fetch_batch_config, fetch_markets, submit_bitmap
        from framework.core import encode_bitmap, hash_bitmap

        missing = [
            (bid, pos)
            for bid, pos in self._positions.items()
            if not pos.get("bitmap")
        ]
        if not missing:
            return []

        log.info(
            "Checking %d positions with no stored bitmap", len(missing)
        )

        poisoned: List[int] = []
        recovered = 0

        for batch_id, pos in missing:
            try:
                on_chain_pos = self._executor.get_position(batch_id)
                on_chain_hash = on_chain_pos.get("bitmapHash", b"")
                # Normalise the on-chain hash to a hex string ONCE, at the top
                # of the loop body. The previous code defined this only inside
                # one branch and then referenced it from another — a NameError
                # swallowed by a broad except, which silently disabled the
                # most important recovery path for months.
                if isinstance(on_chain_hash, bytes):
                    on_chain_hash_hex = on_chain_hash.hex()
                else:
                    on_chain_hash_hex = str(on_chain_hash).removeprefix("0x")

                if self._is_null_hash(on_chain_hash):
                    # Null hash on-chain: position was joined without a bitmap.
                    # updateBitmap() can fix this — the contract allows replacing
                    # a null hash with a real one. Fetch real market data first;
                    # never feed strategies zero-price placeholders.
                    log.info(
                        "Batch %d: null bitmap hash on-chain — attempting recovery via updateBitmap",
                        batch_id,
                    )

                    info = self._executor.get_batch_info(batch_id)
                    config_hash = info["configHash"]
                    if isinstance(config_hash, bytes):
                        config_hash_hex = "0x" + config_hash.hex()
                    else:
                        config_hash_hex = config_hash if config_hash.startswith("0x") else "0x" + config_hash

                    batch_cfg = fetch_batch_config(data_node_url, config_hash_hex)
                    if not (batch_cfg and batch_cfg.get("markets")):
                        log.warning(
                            "Batch %d: cannot fetch market config for recovery — marking poisoned",
                            batch_id,
                        )
                        pos["poisoned"] = True
                        poisoned.append(batch_id)
                        continue

                    market_ids = [
                        m["assetId"] for m in batch_cfg["markets"]
                        if isinstance(m, dict) and m.get("assetId")
                    ]
                    if not market_ids:
                        log.warning(
                            "Batch %d: batch_cfg has no usable assetIds — marking poisoned",
                            batch_id,
                        )
                        pos["poisoned"] = True
                        poisoned.append(batch_id)
                        continue

                    market_count = len(market_ids)
                    # Fetch REAL market data — strategies fed price=0 collapse
                    # to coin flips, and recovery turns into vandalism.
                    markets = fetch_markets(data_node_url, market_ids) or []
                    if len(markets) < market_count:
                        log.warning(
                            "Batch %d: data-node returned %d/%d markets — refusing to recover with partial data",
                            batch_id, len(markets), market_count,
                        )
                        pos["poisoned"] = True
                        poisoned.append(batch_id)
                        continue

                    bets = strategy.predict(markets)
                    while len(bets) < market_count:
                        bets.append(random.choice(["UP", "DOWN"]))

                    bitmap = encode_bitmap(bets, market_count)
                    bm_hash = hash_bitmap(bitmap)

                    config_hash_bytes = config_hash if isinstance(config_hash, bytes) else bytes.fromhex(
                        config_hash.removeprefix("0x"))

                    try:
                        self._executor.update_bitmap(batch_id, config_hash_bytes, bm_hash)
                        log.info("Batch %d: updateBitmap OK — submitting to oracle", batch_id)

                        if oracle_urls:
                            try:
                                submit_bitmap(oracle_urls, self._executor.bot_addr, batch_id, bitmap, bm_hash, retries=3)
                            except BitmapSubmitError as e:
                                # On-chain hash is now correct but oracle quorum
                                # missed the submission. The next cycle will
                                # retry. Do not mark poisoned.
                                log.warning(
                                    "Batch %d: updateBitmap landed on-chain but oracle quorum failed: %s",
                                    batch_id, e,
                                )

                        pos["bitmap"] = bitmap
                        pos["bitmap_hash"] = bm_hash
                        pos["bets"] = bets
                        pos.pop("poisoned", None)
                        recovered += 1
                        log.info("Batch %d: recovered via updateBitmap (%d markets)", batch_id, market_count)
                    except Exception as e:
                        log.warning("Batch %d: updateBitmap failed: %s — marking poisoned", batch_id, e)
                        pos["poisoned"] = True
                        poisoned.append(batch_id)
                    continue

                # Hash is REAL but we lost the bitmap bytes. There is no honest
                # way back: a fresh bitmap will not collide with the committed
                # hash, and submitting random predictions guarantees losses.
                # Refuse to play. Mark for operator withdrawal.
                log.warning(
                    "Batch %d: real on-chain hash (%s...) with no stored bitmap — "
                    "marking poisoned for withdrawal. Random regeneration is forbidden.",
                    batch_id, on_chain_hash_hex[:16],
                )
                pos["poisoned"] = True
                poisoned.append(batch_id)
            except Exception as e:
                # Log the traceback so silent NameErrors stop hiding here.
                log.warning("Batch %d: bitmap recovery failed: %s", batch_id, e, exc_info=True)

        if recovered or poisoned:
            self._save_history()
            log.info(
                "Bitmap recovery complete: %d recovered, %d poisoned (need withdrawal)",
                recovered, len(poisoned),
            )

        return poisoned

    @staticmethod
    def _serialize_pos(pos: dict) -> dict:
        """Convert a position dict into a JSON-safe shape.

        bytes values become hex strings under suffixed keys, so the original
        position object is never mutated and reload symmetry is preserved.
        """
        out = {}
        for k, v in pos.items():
            if isinstance(v, (bytes, bytearray)):
                if k == "bitmap":
                    out["bitmap_hex"] = bytes(v).hex()
                elif k == "bitmap_hash":
                    out["bitmap_hash_hex"] = bytes(v).hex()
                else:
                    out[k + "_hex"] = bytes(v).hex()
            else:
                out[k] = v
        return out

    def _load_history(self):
        """Load from pnl.json, validating persisted positions against chain."""
        path = self._config.get("pnl_file", "pnl.json")
        try:
            if not os.path.exists(path):
                return
            with open(path) as f:
                data = json.load(f)
            self._history = data.get("history", [])
            # Trim history on load too, in case the file predates the cap.
            if len(self._history) > self.MAX_HISTORY:
                self._history = self._history[-self.MAX_HISTORY:]
            # Restore skip retry counters — int keys come back as strings via JSON.
            raw_skip = data.get("skip_retries", {}) or {}
            self._skip_retries = {}
            for k, v in raw_skip.items():
                try:
                    self._skip_retries[int(k)] = int(v)
                except (TypeError, ValueError):
                    continue
            # Restore active positions, purging stale ones from old deployments
            stale = []
            for pos in data.get("active", []):
                if "bitmap_hex" in pos:
                    pos["bitmap"] = bytes.fromhex(pos["bitmap_hex"])
                    del pos["bitmap_hex"]
                if "bitmap_hash_hex" in pos:
                    pos["bitmap_hash"] = bytes.fromhex(pos["bitmap_hash_hex"])
                    del pos["bitmap_hash_hex"]
                batch_id = pos["batch_id"]
                # Validate against chain: joinTimestamp == 0 means this
                # position doesn't exist on the current contract
                try:
                    on_chain = self._executor.get_position(batch_id)
                    if on_chain["joinTimestamp"] == 0:
                        stale.append(batch_id)
                        continue
                    # Check if stored bitmap hash matches on-chain commitment.
                    # A mismatch means the original bitmap was lost and replaced
                    # with a regenerated one — the oracle will reject it every cycle.
                    # Mark as poisoned so the re-submit loop skips it and startup
                    # can trigger a withdrawal.
                    on_chain_bm_hash = on_chain.get("bitmapHash", b"")
                    if isinstance(on_chain_bm_hash, bytes):
                        on_chain_hash_hex = on_chain_bm_hash.hex()
                    else:
                        on_chain_hash_hex = str(on_chain_bm_hash).removeprefix("0x")
                    stored_bm_hash = pos.get("bitmap_hash")
                    if isinstance(stored_bm_hash, bytes):
                        stored_hash_hex = stored_bm_hash.hex()
                    else:
                        stored_hash_hex = ""
                    if on_chain_hash_hex and stored_hash_hex and on_chain_hash_hex != stored_hash_hex:
                        log.warning(
                            "Batch %d: stored bitmap hash mismatch (on-chain: %s, stored: %s) — marking poisoned",
                            batch_id, on_chain_hash_hex[:16], stored_hash_hex[:16],
                        )
                        pos["poisoned"] = True
                    elif Tracker._is_null_hash(on_chain_bm_hash):
                        # Null hash is recoverable via updateBitmap() — do not
                        # pre-emptively mark poisoned here.  recover_bitmaps()
                        # will attempt the on-chain fix on startup.
                        log.info(
                            "Batch %d: null bitmap hash on-chain — will attempt recovery via updateBitmap",
                            batch_id,
                        )
                        # Clear any stale poisoned flag so recover_bitmaps sees it
                        pos.pop("poisoned", None)
                except Exception:
                    # Chain read failed — position is suspect, purge it
                    stale.append(batch_id)
                    continue
                self._positions[batch_id] = pos
            if stale:
                log.warning(
                    "Purged %d stale positions (old deployment): %s",
                    len(stale), stale,
                )
                self._save_history()
        except Exception as e:
            log.warning("Failed to load history from %s: %s", path, e, exc_info=True)

    def _save_history(self):
        """Atomically write pnl.json. Loud on failure — silence is the killer."""
        path = self._config.get("pnl_file", "pnl.json")
        try:
            # Serialise both active positions and history through the same
            # helper. The history list contains completed positions which
            # carry bitmap bytes — without serialisation, json.dump raised
            # TypeError, the silent except swallowed it, and every save after
            # the first settled position became a no-op. State loss on the
            # next restart followed inevitably.
            active = [self._serialize_pos(p) for p in self._positions.values()]
            history = [self._serialize_pos(p) if isinstance(p, dict) else p
                       for p in self._history]
            data = {
                "active": active,
                "history": history,
                "skip_retries": {str(k): v for k, v in self._skip_retries.items()},
            }
            if hasattr(self, "_vault_state") and self._vault_state:
                data["vault"] = self._vault_state

            tmp = path + ".tmp"
            # Compact JSON — pnl.json is machine-readable, not a poem.
            with open(tmp, "w") as f:
                json.dump(data, f, separators=(",", ":"))
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, path)
        except Exception as e:
            log.warning("Failed to save history to %s: %s", path, e, exc_info=True)

    def save_vault_state(self, vault_info: dict):
        """Cache vault state for persistence."""
        self._vault_state = {
            "address": vault_info.get("address", ""),
            "total_assets": vault_info.get("total_assets", 0),
            "total_supply": vault_info.get("total_supply", 0),
            "hwm": vault_info.get("hwm", 0),
            "manager_shares": vault_info.get("manager_shares", 0),
            "perf_fee_rate": vault_info.get("perf_fee_rate", 0),
        }
        self._save_history()
