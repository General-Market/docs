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
# Mirror of Vision.MIN_STAKE_PER_TICK — joins below this revert.
MIN_STAKE_WEI = 10**17  # 0.1 USDC

STATE_FILE = os.environ.get("STATE_FILE", "/app/pnl-data/fund-manager-state.json")
VISION_DB_URL = os.environ.get("VISION_DB_URL", "")
SNAPSHOT_INTERVAL = 10  # write snapshots every N cycles


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


MAX_RECONCILE_RETRIES = 5


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
        self.reconcile_retries: dict[int, int] = {}  # batch_id -> failure count

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
        # Check batch exists on-chain and read its settled flag.
        try:
            batch_info = executor.get_batch_info(bid)
            if batch_info.get("paused"):
                continue
        except Exception:
            # Batch doesn't exist on-chain (likely from previous deployment).
            # Count retries — evict after MAX_RECONCILE_RETRIES.
            retries = fund.reconcile_retries.get(bid, 0) + 1
            fund.reconcile_retries[bid] = retries
            if retries >= MAX_RECONCILE_RETRIES:
                log.warning(
                    "[%s] Evicting stale batch %d — not found on-chain after %d attempts",
                    fund.name, bid, retries,
                )
                fund.active_batches.pop(bid, None)
                fund.joined_batch_ids.discard(bid)
                fund.reconcile_retries.pop(bid, None)
            continue

        # Only reconcile batches that Vision has actually settled.
        if not batch_info.get("settled", False):
            continue

        # Verify vault still has an active deposit to reconcile
        try:
            dep = fund.vault.get_active_deposit(bid)
            if dep == 0:
                # Already reconciled — clean up tracking
                log.info("[%s] Batch %d already reconciled — clearing", fund.name, bid)
                fund.active_batches.pop(bid, None)
                fund.joined_batch_ids.discard(bid)
                fund.reconcile_retries.pop(bid, None)
                continue
        except Exception:
            continue

        # Fetch settlement payout from PlayerSettled event for accurate PnL
        payout = 0
        try:
            payout = executor.get_settlement_payout(bid, fund.vault_addr)
        except Exception as e:
            log.debug("[%s] Could not read payout for batch %d: %s", fund.name, bid, e)

        # Settled on-chain, vault has active deposit — reconcile now.
        try:
            fund.vault.reconcile(bid, payout)
            deposited = fund.active_batches.get(bid, 0)
            pnl = (payout - deposited) / 1e18 if deposited else 0
            log.info("[%s] Reconciled batch %d — payout=%.4f deposited=%.4f pnl=%.4f",
                     fund.name, bid, payout / 1e18, deposited / 1e18, pnl)
            fund.reconciled_total += 1
        except Exception as e:
            err = str(e)
            # 0x4c03a47b = BatchAlreadyReconciled()
            if "BatchAlreadyReconciled" in err or "4c03a47b" in err:
                log.info("[%s] Batch %d already reconciled — clearing", fund.name, bid)
                fund.reconciled_total += 1
            else:
                retries = fund.reconcile_retries.get(bid, 0) + 1
                fund.reconcile_retries[bid] = retries
                if retries >= MAX_RECONCILE_RETRIES:
                    log.warning(
                        "[%s] Evicting batch %d after %d failed reconcile attempts: %s",
                        fund.name, bid, retries, e,
                    )
                else:
                    log.warning(
                        "[%s] Reconcile %d failed (attempt %d/%d): %s",
                        fund.name, bid, retries, MAX_RECONCILE_RETRIES, e,
                    )
                    continue  # leave in active_batches, retry next cycle

        fund.active_batches.pop(bid, None)
        fund.joined_batch_ids.discard(bid)
        fund.reconcile_retries.pop(bid, None)


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


# ── Vault snapshots ───────────────────────────────────────────


def write_vault_snapshots(funds):
    """Write NAV snapshots to oracle postgres for historical charts."""
    if not VISION_DB_URL:
        return
    try:
        import psycopg2
        conn = psycopg2.connect(VISION_DB_URL)
        cur = conn.cursor()
        rows = 0
        for fund in funds:
            try:
                info = fund.vault.get_vault_info()
                total_assets = info.get("total_assets", 0)
                total_supply = max(info.get("total_supply", 1), 1)
                nav = total_assets / total_supply
                tvl = total_assets / 1e18
                cur.execute(
                    "INSERT INTO vault_snapshots (vault_address, total_assets, total_supply, nav_per_share, tvl_usd) "
                    "VALUES (%s, %s, %s, %s, %s)",
                    (fund.vault_addr.lower(), str(total_assets), str(total_supply), nav, tvl),
                )
                rows += 1
            except Exception:
                pass
        conn.commit()
        cur.close()
        conn.close()
        log.info("Vault snapshots: %d rows written", rows)
    except Exception as e:
        log.warning("Vault snapshot write failed: %s", e)


# ── Main cycle ─────────────────────────────────────────────────


def run_cycle(funds, executor, oracle_urls, feed, cfg, source_id_map, cycle_number=0):
    """One cycle: join new batches per fund, reconcile settled ones."""
    all_batches = fetch_batches(cfg["vision_api"], executor=executor)
    # Filter: only batches with known market count (skip legacy batches without config)
    batches = [b for b in all_batches if b.get("market_count", 0) > 0]
    if not batches:
        # Fallback: try all batches (market count will be resolved from data-node)
        batches = all_batches

    # Risk management: bet 5% of vault assets per batch, not a flat amount.
    # stake_per_tick is the per-tick cost within a batch (usually = deposit).
    alloc_bps = int(cfg.get("allocation_bps", 500))  # 500 = 5%
    stake_wei = int(cfg.get("stake_per_tick", 1) * 10**DECIMALS)

    joined_this_cycle = 0
    matched_any_source = False
    log.info("Processing %d batches across %d funds...", len(batches), len(funds))
    for batch in batches:
        batch_id = batch.get("id", batch.get("batch_id"))
        if batch_id is None or batch.get("paused"):
            continue

        # Source name: try direct name first, then hash lookup for hex source IDs.
        # The API returns plain-text source_ids (e.g. "crypto") for round-based
        # batches — only legacy batches use keccak256 hashes.
        source_name = batch.get("source_name") or batch.get("sourceName") or ""
        if not source_name:
            raw_sid = batch.get("source_id") or batch.get("sourceId") or ""
            if raw_sid.startswith("0x"):
                source_name = source_id_map.get(raw_sid, "")
            else:
                source_name = raw_sid

        matched_funds = [f for f in funds if f.matches_source(source_name) and batch_id not in f.joined_batch_ids]
        if matched_funds:
            matched_any_source = True
        else:
            continue

        # Filter by idle capital — each fund bets alloc_bps% of its total assets,
        # floored at MIN_STAKE_WEI so the contract doesn't reject the deposit.
        def has_idle(f):
            try:
                info = f.vault.get_vault_info()
                idle = info.get("idle_usdc", 0)
                total = info.get("total_assets", 0)
                deposit = max((total * alloc_bps) // 10000, MIN_STAKE_WEI)
                return idle >= deposit
            except Exception:
                return False
        matched_funds = [f for f in matched_funds if has_idle(f)]
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

            # Compute deposit: alloc_bps% of current total assets, floored at the
            # contract minimum stake so tiny vaults still meet MIN_STAKE_PER_TICK.
            try:
                info = fund.vault.get_vault_info()
                total = info.get("total_assets", 0)
                deposit_wei = max((total * alloc_bps) // 10000, MIN_STAKE_WEI)
                if deposit_wei <= 0:
                    continue
                # stake_per_tick = deposit (bet everything each tick within the batch)
                stake_for_batch = min(stake_wei, deposit_wei)
                if stake_for_batch < MIN_STAKE_WEI:
                    stake_for_batch = MIN_STAKE_WEI
            except Exception:
                continue

            # Join via vault
            try:
                fund.vault.join_batch(
                    batch_id, config_hash, deposit_wei, stake_for_batch, bm_hash,
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

    # Periodic NAV table + vault snapshots every 10 cycles
    if cycle_number % SNAPSHOT_INTERVAL == 0:
        log_nav_table(funds)
        write_vault_snapshots(funds)

    # Health summary — detect silent failures
    log.info("Cycle %d: %d joined, source_match=%s", cycle_number, joined_this_cycle, matched_any_source)
    if len(batches) > 0 and not matched_any_source:
        log.error(
            "HEALTH ALERT: %d batches processed, ZERO source matches. "
            "Source matching is broken — no funds will ever join. "
            "Check batch API source_id format vs fund sources in funds.toml.",
            len(batches),
        )

    # Write heartbeat for Docker HEALTHCHECK
    heartbeat_path = os.environ.get("HEARTBEAT_FILE", "/app/pnl-data/heartbeat.json")
    try:
        import json as _json
        _json.dump({
            "cycle": cycle_number,
            "ts": time.time(),
            "joined": joined_this_cycle,
            "source_match": matched_any_source,
            "batches": len(batches),
        }, open(heartbeat_path, "w"))
    except Exception:
        pass

    return joined_this_cycle


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
        "allocation_bps": manager_cfg.get("allocation_bps", 500),  # 5% of vault assets per batch
        "stake_per_tick": manager_cfg.get("stake_per_tick", 1.0),
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

    # Purge stale batch IDs from previous vault deployments.
    # If the vault was redeployed, old batch IDs have no active deposit.
    for fund in funds:
        stale = []
        for bid in list(fund.active_batches.keys()):
            try:
                dep = fund.vault.get_active_deposit(bid)
                if dep == 0:
                    stale.append(bid)
            except Exception:
                stale.append(bid)
        for bid in stale:
            log.warning(
                "[%s] Purging batch %d — no active deposit (stale from previous vault)",
                fund.name, bid,
            )
            fund.active_batches.pop(bid, None)
            fund.joined_batch_ids.discard(bid)
        if stale:
            log.info("[%s] Purged %d stale batches on startup", fund.name, len(stale))

    all_known_batch_ids = set()
    for fund in funds:
        all_known_batch_ids.update(str(bid) for bid in fund.active_batches)
    if all_known_batch_ids:
        feed.subscribe(list(all_known_batch_ids))
        log.info("Pre-subscribed to %d known batch feeds", len(all_known_batch_ids))

    # ── Startup self-test: verify source matching works ──
    # If this fails, the fund-manager would run forever joining nothing.
    try:
        test_batches = fetch_batches(shared_cfg["vision_api"], executor=executor)
        if test_batches:
            test_matched = 0
            for b in test_batches[:20]:
                sname = b.get("source_name") or b.get("sourceName") or ""
                if not sname:
                    raw = b.get("source_id") or b.get("sourceId") or ""
                    sname = source_id_map.get(raw, "") if raw.startswith("0x") else raw
                if any(f.matches_source(sname) for f in funds):
                    test_matched += 1
            if test_matched == 0:
                log.error(
                    "STARTUP FAIL: sampled %d batches, ZERO matched any fund. "
                    "Source IDs from API: %s. Fund sources: %s. "
                    "Source matching is broken — fix before continuing.",
                    min(20, len(test_batches)),
                    [b.get("source_id", "?") for b in test_batches[:5]],
                    sorted(all_source_names)[:10],
                )
                sys.exit(1)
            log.info("Startup self-test: %d/%d sampled batches match funds ✓", test_matched, min(20, len(test_batches)))
    except SystemExit:
        raise
    except Exception as e:
        log.warning("Startup self-test skipped (API unavailable): %s", e)

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
