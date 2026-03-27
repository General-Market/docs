from __future__ import annotations

import json
import logging
import os
import random
import time
from typing import Dict, List, Optional, Set

import requests

log = logging.getLogger("vision-bot")


class Tracker:
    """Tracks active positions, PnL, and handles auto-claim/withdraw."""

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
        self._skip_ids: set[int] = set()  # batch IDs that reverted — never retry
        self._load_history()

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
                pos["pnl"] = balance - pos["deposited"]

            # Auto-claim check
            claim_threshold = self._config.get("claim_above", 5) * 10**18
            if self._config.get("auto_claim", True) and pos["pnl"] > claim_threshold:
                self._try_claim(batch_id, pos)

            # Auto-withdraw check
            withdraw_threshold = self._config.get("withdraw_below", 2) * 10**18
            if self._config.get("auto_withdraw", True) and pos["balance"] < withdraw_threshold:
                withdrawn = self._try_withdraw(batch_id, pos)
                if withdrawn:
                    to_remove.append(batch_id)

        for bid in to_remove:
            pos = self._positions.pop(bid)
            self._history.append(pos)

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
            # Fetch all non-paused batches from oracle
            resp = requests.get(f"{urls[0]}/vision/batches", timeout=10)
            if not resp.ok:
                return
            all_batches = resp.json().get("batches", [])
            # Filter: non-paused, has markets, not already joined
            # Deduplicate: only the LATEST batch per source (highest ID = most recent round)
            by_source = {}
            for b in all_batches:
                if b.get("paused") or b.get("market_count", 0) == 0:
                    continue
                src = b.get("source_id", "")
                if src not in by_source or b.get("id", 0) > by_source[src].get("id", 0):
                    by_source[src] = b
            active = list(by_source.values())
            max_per_cycle = 5  # Don't flood with joins — 5 per cycle max
            joined = 0
            for batch in active:
                bid = batch.get("id", -1)
                if bid in self.active_ids or bid in self._skip_ids or bid < 0:
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
                            "joined_at": pos["joinTimestamp"],
                            "last_claimed_tick": 0,
                        }
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
                except Exception as e:
                    log.warning("Failed to join batch %d: %s", bid, e)
                    # Permanent skip: don't retry batches that revert
                    self._skip_ids.add(bid)
        except Exception as e:
            log.warning("Round check failed: %s", e)

    def _join_round(self, batch: dict, strategy=None):
        """Join a round-based batch: approve USDC, call joinBatchDirect, submit bitmap."""
        batch_id = batch.get("batchId", batch.get("id"))
        config_hash = batch.get("configHash", batch.get("config_hash", b"\x00" * 32))
        deposit = int(self._config.get("deposit", 10) * 10**18)
        stake = int(self._config.get("stake", 1) * 10**18)

        # Generate predictions using real market data from data-node
        from framework.core import encode_bitmap, hash_bitmap
        from framework.chain import fetch_batch_config, fetch_markets
        market_count = batch.get("marketCount", batch.get("market_count", 10))

        # Try to fetch real market config and prices for informed predictions
        market_ids = []
        config_hash_hex = ""
        if isinstance(config_hash, bytes):
            config_hash_hex = "0x" + config_hash.hex()
        elif isinstance(config_hash, str):
            config_hash_hex = config_hash if config_hash.startswith("0x") else "0x" + config_hash

        if config_hash_hex:
            batch_cfg = fetch_batch_config(self._config.get("data_node", ""), config_hash_hex)
            if batch_cfg and batch_cfg.get("markets"):
                market_ids = [m["assetId"] for m in batch_cfg["markets"]]
                market_count = len(market_ids)

        if market_ids:
            markets = fetch_markets(self._config.get("data_node", ""), market_ids)
        else:
            markets = [{"id": f"m{i}", "price": 0, "change": None, "volume": None, "market_cap": None} for i in range(market_count)]

        bets = strategy.predict(markets) if strategy else [random.choice(["UP", "DOWN"]) for _ in range(market_count)]
        ups = sum(1 for b in bets if b == "UP")
        log.info("Batch %d: strategy=%s, %d UP / %d DOWN (real_data=%s)",
                 batch_id, getattr(strategy, 'name', '?'), ups, len(bets) - ups, bool(market_ids))
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
        self._executor.join_batch_direct(batch_id, config_hash, deposit, stake, bitmap_hash)

        # Wait for block confirmation before submitting bitmap to oracles
        # (oracles need to index the PlayerJoined event first)
        time.sleep(2)

        # Submit bitmap to oracles
        from framework.chain import submit_bitmap
        urls = self._oracle_urls_fn()
        submit_bitmap(urls, self._executor.bot_addr, batch_id, bitmap, bitmap_hash)

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
        urls = self._oracle_urls_fn()
        if not urls:
            return False
        try:
            player = self._executor.bot_addr
            resp = requests.get(f"{urls[0]}/vision/balance/{batch_id}/{player}", timeout=10)
            if not resp.ok:
                return False
            data = resp.json()
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
        """GET /vision/balance/{batch_id}/{player} from first oracle."""
        urls = self._oracle_urls_fn()
        if not urls:
            return None
        try:
            player = self._executor.bot_addr
            resp = requests.get(f"{urls[0]}/vision/balance/{batch_id}/{player}", timeout=10)
            if resp.ok:
                val = resp.json().get("balance")
                return int(val) if val is not None else None
        except requests.RequestException:
            pass
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
            h = str(hash_bytes).lstrip("0x")
        return h == Tracker._NULL_BITMAP_HASH or h == Tracker._ZERO_HASH or not h

    def recover_bitmaps(self, strategy, data_node_url: str, oracle_urls: List[str]) -> List[int]:
        """
        For every active position that has no bitmap or was joined with the
        null bitmap hash, attempt recovery:

        1. If the position has a real on-chain bitmapHash (not null), regenerate
           the bitmap and try to match.  If hash matches → recovered.
        2. If the position has a NULL on-chain bitmapHash (bytes32(0)), call
           updateBitmap on-chain to fix it, then submit to oracle. This is
           recoverable — the contract allows updating a null hash.

        Returns list of batch_ids that are truly unrecoverable (chain errors,
        hash mismatch with real hash on-chain, etc.) and need withdrawal + rejoin.

        Called once per bot startup, after _load_history.
        """
        from framework.chain import fetch_batch_config, submit_bitmap
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

                if self._is_null_hash(on_chain_hash):
                    # Null hash on-chain: position was joined without a bitmap.
                    # updateBitmap() can fix this — the contract allows replacing
                    # a null hash with a real one. Generate a fresh bitmap and
                    # update on-chain, then submit to oracle.
                    log.info(
                        "Batch %d: null bitmap hash on-chain — attempting recovery via updateBitmap",
                        batch_id,
                    )

                    info = self._executor.get_batch_info(batch_id)
                    config_hash = info["configHash"]

                    batch_cfg = fetch_batch_config(data_node_url, config_hash if isinstance(config_hash, str)
                                                   else "0x" + config_hash.hex())
                    if batch_cfg and batch_cfg.get("markets"):
                        market_count = len(batch_cfg["markets"])
                        market_ids = [m["assetId"] for m in batch_cfg["markets"]]
                        markets = [
                            {"id": mid, "price": 0, "change": None, "volume": None, "market_cap": None}
                            for mid in market_ids
                        ]
                        bets = strategy.predict(markets)
                    else:
                        market_count = pos.get("market_count", 10)
                        dummy = [{"id": f"m{i}", "price": 0, "change": None, "volume": None, "market_cap": None}
                                 for i in range(market_count)]
                        bets = strategy.predict(dummy)

                    bitmap = encode_bitmap(bets, market_count)
                    bm_hash = hash_bitmap(bitmap)

                    config_hash_bytes = config_hash if isinstance(config_hash, bytes) else bytes.fromhex(
                        config_hash.lstrip("0x"))

                    try:
                        self._executor.update_bitmap(batch_id, config_hash_bytes, bm_hash)
                        log.info("Batch %d: updateBitmap OK — submitting to oracle", batch_id)

                        if oracle_urls:
                            submit_bitmap(oracle_urls, self._executor.bot_addr, batch_id, bitmap, bm_hash, retries=3)

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

                # Hash is real — we lost the bitmap bytes but can regenerate predictions.
                # The new bitmap won't match the original hash, but this is better than silence.
                # The oracle will reject it, so log a warning instead of spamming retries.
                info = self._executor.get_batch_info(batch_id)
                config_hash = info["configHash"]
                if isinstance(config_hash, bytes):
                    config_hash_hex = "0x" + config_hash.hex()
                else:
                    config_hash_hex = config_hash if config_hash.startswith("0x") else "0x" + config_hash

                batch_cfg = fetch_batch_config(data_node_url, config_hash_hex)
                if batch_cfg and batch_cfg.get("markets"):
                    market_count = len(batch_cfg["markets"])
                    market_ids = [m["assetId"] for m in batch_cfg["markets"]]
                    markets = [
                        {"id": mid, "price": 0, "change": None, "volume": None, "market_cap": None}
                        for mid in market_ids
                    ]
                    bets = strategy.predict(markets)
                else:
                    market_count = pos.get("market_count", 10)
                    dummy = [{"id": f"m{i}", "price": 0, "change": None, "volume": None, "market_cap": None} for i in range(market_count)]
                    bets = strategy.predict(dummy)

                bitmap = encode_bitmap(bets, market_count)
                bm_hash = hash_bitmap(bitmap)

                # Check if regenerated hash matches on-chain commitment
                if isinstance(bm_hash, bytes):
                    new_hash_hex = bm_hash.hex()
                else:
                    new_hash_hex = str(bm_hash).lstrip("0x")

                if new_hash_hex != on_chain_hash_hex:
                    log.warning(
                        "Batch %d: original bitmap lost and hash mismatch (on-chain: %s) — marking for withdrawal",
                        batch_id, on_chain_hash_hex[:16],
                    )
                    pos["poisoned"] = True
                    poisoned.append(batch_id)
                    continue

                pos["bitmap"] = bitmap
                pos["bitmap_hash"] = bm_hash
                pos["bets"] = bets

                if oracle_urls:
                    submit_bitmap(oracle_urls, self._executor.bot_addr, batch_id, bitmap, bm_hash, retries=3)

                recovered += 1
                log.info("Recovered bitmap for batch %d (%d markets)", batch_id, market_count)
            except Exception as e:
                log.warning("Batch %d: bitmap recovery failed: %s", batch_id, e)

        if recovered or poisoned:
            self._save_history()
            log.info(
                "Bitmap recovery complete: %d recovered, %d poisoned (need withdrawal)",
                recovered, len(poisoned),
            )

        return poisoned

    def _load_history(self):
        """Load from pnl.json, validating persisted positions against chain."""
        path = self._config.get("pnl_file", "pnl.json")
        try:
            if os.path.exists(path):
                with open(path) as f:
                    data = json.load(f)
                self._history = data.get("history", [])
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
                            on_chain_hash_hex = str(on_chain_bm_hash).lstrip("0x")
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
        except Exception:
            pass

    def _save_history(self):
        """Save to pnl.json, fail silently."""
        path = self._config.get("pnl_file", "pnl.json")
        try:
            # Prepare active positions (convert bitmap bytes to hex for JSON)
            active = []
            for pos in self._positions.values():
                p = dict(pos)
                if isinstance(p.get("bitmap"), bytes):
                    p["bitmap_hex"] = p.pop("bitmap").hex()
                if isinstance(p.get("bitmap_hash"), bytes):
                    p["bitmap_hash_hex"] = p.pop("bitmap_hash").hex()
                active.append(p)
            with open(path, "w") as f:
                json.dump({"active": active, "history": self._history}, f, indent=2)
        except Exception:
            pass
