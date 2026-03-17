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

    def on_join(self, batch_id: int, deposit_wei: int, bitmap: bytes, bets: list[str]):
        """Record a new join."""
        self._positions[batch_id] = {
            "batch_id": batch_id,
            "deposited": deposit_wei,
            "balance": deposit_wei,
            "pnl": 0,
            "bitmap": bitmap,
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
        self.on_join(batch_id, deposit, bitmap, bets)
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

    def _load_history(self):
        """Load from pnl.json."""
        path = self._config.get("pnl_file", "pnl.json")
        try:
            if os.path.exists(path):
                with open(path) as f:
                    data = json.load(f)
                self._history = data.get("history", [])
                # Restore active positions
                for pos in data.get("active", []):
                    # Convert bitmap back from hex if stored
                    if "bitmap_hex" in pos:
                        pos["bitmap"] = bytes.fromhex(pos["bitmap_hex"])
                        del pos["bitmap_hex"]
                    self._positions[pos["batch_id"]] = pos
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
                active.append(p)
            with open(path, "w") as f:
                json.dump({"active": active, "history": self._history}, f, indent=2)
        except Exception:
            pass
