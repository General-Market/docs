#!/usr/bin/env python3
"""Fund Manager — one bot, many vaults, source-specific strategies."""

import json
import logging
import os
import random
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from framework.core import Strategy, encode_bitmap, hash_bitmap, load_strategy
from framework.chain import (
    Executor,
    VaultExecutor,
    discover_oracles,
    fetch_batch_config,
    fetch_batches,
    fetch_markets,
    submit_bitmap,
)
from framework.feed import VisionFeed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("fund-manager")
DECIMALS = 18

STATE_FILE = "fund-manager-state.json"


# ── Config ─────────────────────────────────────────────────────


def load_funds_config(path="funds.toml"):
    try:
        import tomllib
    except ImportError:
        import tomli as tomllib  # type: ignore[no-redef]
    with open(path, "rb") as f:
        return tomllib.load(f)


def build_source_id_map(fund_sources):
    """Build keccak256(source_name_vN) -> source_name for all fund sources.

    On-chain sourceId = keccak256(name + "_v2") (or _v1, etc.).
    We map all plausible versions so the API hex matches our fund sources.
    """
    from web3 import Web3

    mapping = {}
    for name in fund_sources:
        for version in ["v1", "v2", "v3"]:
            key = f"{name}_{version}"
            source_hash = Web3.keccak(text=key).hex()
            h = source_hash if source_hash.startswith("0x") else "0x" + source_hash
            mapping[h] = name
        # Also map plain keccak256(name) as fallback
        plain = Web3.keccak(text=name).hex()
        h = plain if plain.startswith("0x") else "0x" + plain
        mapping[h] = name
    return mapping


# ── Fund state ─────────────────────────────────────────────────


class FundState:
    """Per-fund runtime state."""

    def __init__(self, fund_cfg, vault_executor, strategy):
        self.name = fund_cfg["name"]
        self.symbol = fund_cfg["symbol"]
        self.vault_addr = fund_cfg["vault"]
        self.sources = set(fund_cfg.get("sources", []))
        self.vault = vault_executor
        self.strategy = strategy
        self.active_batches: dict[int, int] = {}   # batch_id -> deposit_wei
        self.joined_batch_ids: set[int] = set()
        self.joined_total: int = 0
        self.reconciled_total: int = 0

    def matches_source(self, source_name):
        if not self.sources:
            return True  # empty = trade all
        return source_name in self.sources


# ── State persistence ──────────────────────────────────────────


def save_state(funds, state_file=STATE_FILE):
    state = {
        "last_cycle": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "funds": {},
    }
    for fund in funds:
        try:
            info = fund.vault.get_vault_info()
            total_assets = info.get("total_assets", 0)
            total_supply = max(info.get("total_supply", 1), 1)
            nav = total_assets / total_supply
        except Exception:
            nav = 0.0
            total_assets = 0

        state["funds"][fund.name] = {
            "vault": fund.vault_addr,
            "active_batches": list(fund.active_batches.keys()),
            "joined_total": fund.joined_total,
            "reconciled_total": fund.reconciled_total,
            "total_assets_usdc": round(total_assets / 1e18, 4),
            "nav": round(nav, 6),
        }
    try:
        with open(state_file, "w") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        log.warning("State save failed: %s", e)


def load_state(funds, state_file=STATE_FILE):
    if not Path(state_file).exists():
        return
    try:
        with open(state_file) as f:
            state = json.load(f)
    except Exception as e:
        log.warning("State load failed: %s", e)
        return

    for fund in funds:
        fund_state = state.get("funds", {}).get(fund.name)
        if not fund_state:
            continue
        for bid in fund_state.get("active_batches", []):
            fund.joined_batch_ids.add(bid)
            fund.active_batches.setdefault(bid, 0)
        fund.joined_total = fund_state.get("joined_total", 0)
        fund.reconciled_total = fund_state.get("reconciled_total", 0)
        log.info(
            "[%s] Resumed: %d active batches, %d joined total",
            fund.name,
            len(fund.active_batches),
            fund.joined_total,
        )


# ── Reconciliation ─────────────────────────────────────────────


def reconcile_settled_batches(fund, executor):
    """Check all tracked batches and reconcile any that have settled on-chain."""
    for bid in list(fund.active_batches.keys()):
        # First check: is the batch settled? The contract marks it via activeDeposits=0.
        # The old approach checked get_active_deposit()==0 and tried to reconcile,
        # but that fires too early (batch is still live, just empty). Now we ask the
        # chain directly for batch state, then confirm via active deposit.
        try:
            batch_info = executor.get_batch_info(bid)
            if batch_info.get("paused"):
                # Paused is not settled — skip.
                continue
        except Exception:
            continue

        # get_active_deposit == 0 means either settled or was never joined.
        # We only track batches we joined, so 0 means settled.
        try:
            dep = fund.vault.get_active_deposit(bid)
            if dep > 0:
                continue  # still active
        except Exception:
            continue

        # Settled. Try to reconcile.
        try:
            fund.vault.reconcile(bid)
            log.info("[%s] Reconciled batch %d", fund.name, bid)
            fund.reconciled_total += 1
        except Exception as e:
            if "BatchAlreadyReconciled" in str(e):
                fund.reconciled_total += 1  # already done, count it
            else:
                log.warning("[%s] Reconcile %d failed: %s", fund.name, bid, e)
                continue  # leave in active_batches, retry next cycle

        fund.active_batches.pop(bid, None)
        fund.joined_batch_ids.discard(bid)


# ── NAV table ──────────────────────────────────────────────────


def log_nav_table(funds):
    """Log a compact NAV summary across all vaults."""
    lines = ["NAV summary:"]
    for fund in funds:
        try:
            info = fund.vault.get_vault_info()
            total = info.get("total_assets", 0)
            supply = max(info.get("total_supply", 1), 1)
            nav = total / supply
            idle = info.get("idle_usdc", 0) / 1e18
            active = info.get("active_capital", 0) / 1e18
            lines.append(
                "  %-20s  NAV=%.5f  total=%.2f  active=%.2f  idle=%.2f  batches=%d"
                % (
                    fund.name,
                    nav,
                    total / 1e18,
                    active,
                    idle,
                    len(fund.active_batches),
                )
            )
        except Exception as e:
            lines.append("  %-20s  (read error: %s)" % (fund.name, e))
    log.info("\n".join(lines))


# ── Main cycle ─────────────────────────────────────────────────


def run_cycle(funds, executor, oracle_urls, feed, cfg, source_id_map, cycle_number=0):
    """One cycle: join new batches per fund, reconcile settled ones."""
    all_batches = fetch_batches(cfg["vision_api"], executor=executor)
    # Filter: only batches with known market count (skip legacy batches without config)
    batches = [b for b in all_batches if b.get("market_count", 0) > 0]
    if not batches:
        # Fallback: try all batches (market count will be resolved from data-node)
        batches = all_batches

    deposit_wei = int(cfg.get("deposit_per_batch", 10) * 10**DECIMALS)
    stake_wei = int(cfg.get("stake_per_tick", 10) * 10**DECIMALS)

    # Skip vault idle pre-cache on first cycles — too many RPC calls.
    # Assume idle = seed amount (50 USDC) if no batches active.
    SEED = 50 * 10**DECIMALS

    joined_this_cycle = 0
    log.info("Processing %d batches across %d funds...", len(batches), len(funds))
    for batch in batches:
        batch_id = batch.get("id", batch.get("batch_id"))
        if batch_id is None or batch.get("paused"):
            continue

        # Source name: try direct name first (from vision-batches.json fallback),
        # then try keccak256 hash lookup (from API)
        source_name = batch.get("source_name") or batch.get("sourceName") or ""
        if not source_name:
            raw_sid = batch.get("source_id") or batch.get("sourceId") or ""
            source_name = source_id_map.get(raw_sid, "")

        matched_funds = [f for f in funds if f.matches_source(source_name) and batch_id not in f.joined_batch_ids]
        if not matched_funds:
            continue

        # Filter by idle capital
        matched_funds = [f for f in matched_funds if (SEED - sum(f.active_batches.values())) >= deposit_wei]
        if not matched_funds:
            continue

        # Fetch batch config ONCE per batch (not per fund)
        config_hash = batch.get("config_hash") or batch.get("configHash") or ""
        if not config_hash:
            try:
                info = executor.get_batch_info(batch_id)
                config_hash = info["configHash"]
            except Exception as e:
                log.warning("Batch %d: cannot read configHash: %s", batch_id, e)
                continue

        if isinstance(config_hash, bytes):
            ch_hex = "0x" + config_hash.hex()
        elif isinstance(config_hash, str):
            ch_hex = config_hash if config_hash.startswith("0x") else "0x" + config_hash
        else:
            continue

        batch_cfg = fetch_batch_config(cfg["data_node"], ch_hex)
        if not batch_cfg or not batch_cfg.get("markets"):
            log.debug("Batch %d: no market config from data-node", batch_id)
            continue
        market_ids = [m["assetId"] for m in batch_cfg["markets"]]
        market_count = len(market_ids)

        # Get prices ONCE per batch
        feed.subscribe([str(batch_id)])
        raw_prices = feed.prices(str(batch_id))
        if raw_prices:
            markets = [
                {
                    "id": mid,
                    "price": raw_prices.get(mid, {}).get("price", 0),
                    "change": raw_prices.get(mid, {}).get("change_pct"),
                    "volume": raw_prices.get(mid, {}).get("volume_24h"),
                }
                for mid in market_ids
            ]
        else:
            markets = fetch_markets(cfg["data_node"], market_ids)

        # Check tick lock once per batch
        try:
            if executor.is_tick_locked(batch_id):
                continue
        except Exception:
            pass

        log.info("Batch %d source=%s: %d funds, %d markets", batch_id, source_name, len(matched_funds), market_count)

        # Per-fund: predict, join, submit bitmap
        for fund in matched_funds:
            # Strategy predict — each fund has its own strategy
            if hasattr(fund.strategy, "predict_with_context"):
                bets = fund.strategy.predict_with_context(
                    markets, feed=feed, batch_id=str(batch_id),
                )
            else:
                bets = fund.strategy.predict(markets)

            while len(bets) < market_count:
                bets.append(random.choice(["UP", "DOWN"]))

            bitmap = encode_bitmap(bets, market_count)
            bm_hash = hash_bitmap(bitmap)

            # Join via vault
            try:
                fund.vault.join_batch(
                    batch_id, config_hash, deposit_wei, stake_wei, bm_hash,
                )
                fund.joined_batch_ids.add(batch_id)
                fund.active_batches[batch_id] = deposit_wei
                fund.joined_total += 1
                joined_this_cycle += 1
                log.info(
                    "[%s] Joined batch %d (%s) — %d markets, %d UP / %d DOWN",
                    fund.name, batch_id, source_name, market_count,
                    bets.count("UP"), bets.count("DOWN"),
                )
            except Exception as e:
                log.warning("[%s] Batch %d join failed: %s", fund.name, batch_id, e)
                continue

            time.sleep(1)

            # Submit bitmap
            try:
                submit_bitmap(
                    oracle_urls, fund.vault_addr, batch_id,
                    bitmap, bm_hash, retries=2,
                )
            except Exception as e:
                log.warning(
                    "[%s] Batch %d bitmap submit failed: %s",
                    fund.name, batch_id, e,
                )

    # Reconcile settled batches
    for fund in funds:
        reconcile_settled_batches(fund, executor)

        # Log per-fund vault state
        try:
            info = fund.vault.get_vault_info()
            nav = info.get("total_assets", 0) / max(info.get("total_supply", 1), 1)
            log.info(
                "[%s] NAV: %.4f | Assets: %.2f | Active: %.2f | Idle: %.2f",
                fund.name,
                nav,
                info.get("total_assets", 0) / 1e18,
                info.get("active_capital", 0) / 1e18,
                info.get("idle_usdc", 0) / 1e18,
            )
        except Exception:
            pass

    # Periodic NAV table every 10 cycles
    if cycle_number % 10 == 0:
        log_nav_table(funds)


# ── Main ───────────────────────────────────────────────────────


def main():
    config_path = sys.argv[1] if len(sys.argv) > 1 else "funds.toml"
    cfg = load_funds_config(config_path)
    manager_cfg = cfg.get("manager", {})

    private_key_env = manager_cfg.get("private_key_env", "FUND_MANAGER_KEY")
    private_key = os.environ.get(private_key_env, "")
    if not private_key:
        log.error("Private key env var %s not set", private_key_env)
        sys.exit(1)

    rpc_url = manager_cfg.get(
        "rpc_url", os.environ.get("L3_RPC_URL", "http://142.132.164.24/"),
    )
    factory_addr = manager_cfg.get("factory", "")
    vision_api = manager_cfg.get(
        "vision_api", os.environ.get("VISION_API_URL", ""),
    )
    data_node = manager_cfg.get(
        "data_node", os.environ.get("DATA_NODE_URL", ""),
    )
    ws_url = manager_cfg.get("ws_url", "")
    poll_interval = manager_cfg.get("poll_interval", 30)

    shared_cfg = {
        "vision_api": vision_api,
        "data_node": data_node,
        "deposit_per_batch": manager_cfg.get("deposit_per_batch", 10.0),
        "stake_per_tick": manager_cfg.get("stake_per_tick", 10.0),
    }

    executor = Executor(
        rpc_url,
        private_key,
        manager_cfg.get("vision_address", ""),
        manager_cfg.get("usdc_address", ""),
        manager_cfg.get("oracle_registry_address", ""),
    )

    # Initialize funds
    funds = []
    for fund_cfg in cfg.get("funds", []):
        vault_addr = fund_cfg.get("vault", "")
        if not vault_addr:
            log.warning(
                "Fund %s has no vault address — skipping", fund_cfg.get("name"),
            )
            continue
        vault_exec = VaultExecutor(executor, vault_addr, factory_addr)
        strategy = load_strategy(fund_cfg["strategy"], fund_cfg.get("params"))
        state = FundState(fund_cfg, vault_exec, strategy)
        funds.append(state)
        log.info(
            "Fund loaded: %s (%s) — vault=%s strategy=%s sources=%s",
            fund_cfg["name"],
            fund_cfg["symbol"],
            vault_addr[:10] + "..." if len(vault_addr) > 10 else vault_addr,
            fund_cfg["strategy"],
            fund_cfg.get("sources", ["all"]),
        )

    if not funds:
        log.error("No funds with vault addresses — nothing to manage")
        sys.exit(1)

    # Build source name → sourceId (keccak256) reverse map
    all_source_names = set()
    for fund in funds:
        all_source_names.update(fund.sources)
    source_id_map = build_source_id_map(all_source_names)
    log.info("Source ID map: %d sources → keccak256 hashes", len(source_id_map) // 2)

    # Oracle discovery
    oracle_urls_raw = manager_cfg.get("oracle_urls", [])
    oracle_discovery = manager_cfg.get("oracle_discovery", "static")

    def oracle_urls_fn():
        if oracle_discovery == "dynamic":
            return discover_oracles("dynamic", oracle_urls_raw, executor.w3)
        return oracle_urls_raw

    # Feed — connect early so history accumulates before first predict
    if not ws_url and data_node:
        ws_url = (
            data_node.replace("http://", "ws://")
            .replace("https://", "wss://")
            + "/vision/ws"
        )
    feed = VisionFeed(ws_url=ws_url, http_url=data_node)

    # Subscribe to any batch IDs we already know about from persisted state
    load_state(funds, STATE_FILE)
    all_known_batch_ids = set()
    for fund in funds:
        all_known_batch_ids.update(str(bid) for bid in fund.active_batches)
    if all_known_batch_ids:
        feed.subscribe(list(all_known_batch_ids))
        log.info("Pre-subscribed to %d known batch feeds", len(all_known_batch_ids))

    log.info("Fund Manager started: %d funds", len(funds))

    def shutdown(signum=None, frame=None):
        log.info("Shutting down...")
        save_state(funds)
        log_nav_table(funds)
        feed.close()
        log.info("Fund Manager stopped. State saved.")
        sys.exit(0)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    # One-shot mode
    if "--once" in sys.argv:
        urls = oracle_urls_fn()
        run_cycle(funds, executor, urls, feed, shared_cfg, source_id_map, cycle_number=0)
        save_state(funds)
        feed.close()
        return

    cycle = 0
    try:
        while True:
            try:
                urls = oracle_urls_fn()
                run_cycle(funds, executor, urls, feed, shared_cfg, source_id_map, cycle_number=cycle)
                save_state(funds)
                cycle += 1
            except Exception as e:
                log.error("Cycle error: %s", e, exc_info=True)
            time.sleep(poll_interval)
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    main()
