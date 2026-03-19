from __future__ import annotations

import json
import logging
import os
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

    def check_rounds(self):
        """Round-based mode: join current betting batch for each subscription."""
        urls = self._oracle_urls_fn()
        if not urls:
            return
        for source, timeframe in self._config.get("round_subscriptions", []):
            try:
                resp = requests.get(
                    f"{urls[0]}/vision/rounds/active",
                    params={"source": source, "timeframe": timeframe},
                    timeout=10,
                )
                if not resp.ok:
                    continue
                batches = resp.json().get("rounds", [])
                for batch in batches:
                    bid = batch["batchId"]
                    if bid in self.active_ids:
                        continue
                    self._join_round(batch)
            except Exception as e:
                log.warning("Round check failed for %s/%d: %s", source, timeframe, e)

    def _join_round(self, batch: dict):
        """Join a round-based batch: approve USDC, call joinBatchDirect, submit bitmap."""
        batch_id = batch["batchId"]
        config_hash = batch.get("configHash", b"\x00" * 32)
        deposit = self._config.get("deposit", 10) * 10**18
        stake = self._config.get("stake", 1) * 10**18

        # Generate predictions
        from framework.core import encode_bitmap, hash_bitmap
        market_count = batch.get("marketCount", 10)
        # Use the strategy to predict (or random fallback)
        bets = ["UP"] * market_count  # placeholder — real impl calls strategy.predict()
        bitmap = encode_bitmap(bets, market_count)
        bitmap_hash = hash_bitmap(bitmap)

        # On-chain: approve + join
        self._executor.approve_usdc(deposit)
        if isinstance(config_hash, str):
            config_hash = bytes.fromhex(config_hash.replace("0x", ""))
        self._executor.join_batch_direct(batch_id, config_hash, deposit, stake, bitmap_hash)

        # Submit bitmap to oracles
        from framework.chain import submit_bitmap
        urls = self._oracle_urls_fn()
        submit_bitmap(urls, self._executor.bot_addr, batch_id, bitmap, bitmap_hash)

        # Track
        self.on_join(batch_id, deposit, bitmap, bets, bitmap_hash=bitmap_hash)
        log.info("Joined round %d (%d markets)", batch_id, market_count)

    def _try_claim(self, batch_id: int, pos: dict):
        """
        GET /vision/balance/{batch_id}/{player} -- check for bls_sig.
        If present: read on-chain position for tick range, call executor.claim_rewards()
        If absent: log and skip
        """
        urls = self._oracle_urls_fn()
        if not urls:
            return
        try:
            player = self._executor.bot_addr
            resp = requests.get(f"{urls[0]}/vision/balance/{batch_id}/{player}", timeout=10)
            if not resp.ok:
                return
            data = resp.json()
            bls_sig = data.get("bls_sig", "")
            if not bls_sig:
                log.info("Batch %d: claim ready, waiting for BLS proofs", batch_id)
                return
            signer_bitmap = int(data.get("signer_bitmap", "0"))

            # Read on-chain position for correct tick range
            on_chain = self._executor.get_position(batch_id)
            last_claimed = on_chain["lastClaimedTick"]
            start_tick = on_chain["startTick"]
            from_tick = last_claimed + 1 if last_claimed > 0 else start_tick + 1

            to_tick = int(data.get("tick_id", 0))
            if to_tick == 0 or to_tick < from_tick:
                log.info("Batch %d: no new ticks to claim (from=%d, oracle_tick=%d)", batch_id, from_tick, to_tick)
                return

            new_balance = int(data.get("balance", pos["balance"]))
            ref_nonce = self._executor.last_snapshot_nonce()

            self._executor.claim_rewards(
                batch_id,
                from_tick,
                to_tick,
                new_balance,
                bytes.fromhex(bls_sig.replace("0x", "")),
                ref_nonce,
                signer_bitmap,
            )
            pos["last_claimed_tick"] = to_tick
            pos["balance"] = new_balance
            log.info("Batch %d: claimed ticks %d-%d", batch_id, from_tick, to_tick)
        except Exception as e:
            log.warning("Batch %d: claim failed: %s", batch_id, e)

    def _try_withdraw(self, batch_id: int, pos: dict) -> bool:
        """Same pattern as claim but calls executor.withdraw(). Returns True if withdrawn."""
        urls = self._oracle_urls_fn()
        if not urls:
            return False
        try:
            player = self._executor.bot_addr
            resp = requests.get(f"{urls[0]}/vision/balance/{batch_id}/{player}", timeout=10)
            if not resp.ok:
                return False
            data = resp.json()
            bls_sig = data.get("bls_sig", "")
            if not bls_sig:
                log.info("Batch %d: withdraw ready, waiting for BLS proofs", batch_id)
                return False
            signer_bitmap = int(data.get("signer_bitmap", "0"))
            final_balance = int(data.get("balance", pos["balance"]))
            ref_nonce = self._executor.last_snapshot_nonce()
            self._executor.withdraw(
                batch_id,
                final_balance,
                bytes.fromhex(bls_sig.replace("0x", "")),
                ref_nonce,
                signer_bitmap,
            )
            pos["balance"] = 0
            log.info("Batch %d: withdrawn (final: %d)", batch_id, final_balance)
            return True
        except Exception as e:
            log.warning("Batch %d: withdraw failed: %s", batch_id, e)
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

    # Keccak256 of empty bytes — the null bitmap hash produced when a position
    # was joined without a real bitmap. Positions with this hash cannot be
    # recovered: the oracle will never accept any non-empty bitmap for them.
    _NULL_BITMAP_HASH = "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"

    def recover_bitmaps(self, strategy, data_node_url: str, oracle_urls: List[str]) -> List[int]:
        """
        For every active position that has no bitmap or was joined with the
        null bitmap hash, determine whether it can be recovered or must be
        abandoned (flagged for withdrawal and rejoin).

        Returns list of batch_ids that are poisoned (null-hash join) and
        should be withdrawn and re-joined by the caller.

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
                # Check if this position was joined with the null bitmap hash.
                # If so, no valid bitmap can ever satisfy the oracle — must withdraw.
                on_chain_pos = self._executor.get_position(batch_id)
                on_chain_hash = on_chain_pos.get("bitmapHash", b"")
                if isinstance(on_chain_hash, bytes):
                    on_chain_hash_hex = on_chain_hash.hex()
                else:
                    on_chain_hash_hex = str(on_chain_hash).lstrip("0x")

                if on_chain_hash_hex == self._NULL_BITMAP_HASH or on_chain_hash == b"\x00" * 32:
                    log.warning(
                        "Batch %d: joined with null bitmap hash — position is unrecoverable, marking for withdrawal",
                        batch_id,
                    )
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
                        elif on_chain_hash_hex == Tracker._NULL_BITMAP_HASH:
                            log.warning(
                                "Batch %d: joined with null bitmap hash — marking poisoned",
                                batch_id,
                            )
                            pos["poisoned"] = True
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
