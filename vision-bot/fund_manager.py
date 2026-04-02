#!/usr/bin/env python3
"""Fund Manager — one bot, many vaults, source-specific strategies."""

import logging
import os
import random
import sys
import time

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


def load_funds_config(path="funds.toml"):
    try:
        import tomllib
    except ImportError:
        import tomli as tomllib  # type: ignore[no-redef]
    with open(path, "rb") as f:
        return tomllib.load(f)


def resolve_source_ids(batches):
    """Build sourceId (hex) -> source_name mapping from active batches."""
    mapping = {}
    for b in batches:
        sid = b.get("source_id") or b.get("sourceId")
        name = b.get("source_name") or b.get("sourceName", "")
        if sid and name:
            mapping[sid] = name
    return mapping


class FundState:
    """Per-fund runtime state."""

    def __init__(self, fund_cfg, vault_executor, strategy):
        self.name = fund_cfg["name"]
        self.symbol = fund_cfg["symbol"]
        self.vault_addr = fund_cfg["vault"]
        self.sources = set(fund_cfg.get("sources", []))
        self.vault = vault_executor
        self.strategy = strategy
        self.active_batches = {}   # batch_id -> deposit_wei
        self.joined_batch_ids = set()

    def matches_source(self, source_name):
        if not self.sources:
            return True  # empty = trade all
        return source_name in self.sources


def run_cycle(funds, executor, oracle_urls, feed, cfg):
    """One cycle: join new batches per fund, reconcile settled ones."""
    batches = fetch_batches(cfg["vision_api"], executor=executor)
    source_map = resolve_source_ids(batches)

    deposit_wei = int(cfg.get("deposit_per_batch", 10) * 10**DECIMALS)
    stake_wei = int(cfg.get("stake_per_tick", 10) * 10**DECIMALS)

    for batch in batches:
        batch_id = batch.get("id", batch.get("batch_id"))
        if batch_id is None or batch.get("paused"):
            continue

        source_name = source_map.get(
            batch.get("source_id") or batch.get("sourceId"), ""
        )

        for fund in funds:
            if not fund.matches_source(source_name):
                continue
            if batch_id in fund.joined_batch_ids:
                continue

            # Check idle capital
            try:
                idle = fund.vault.get_vault_info().get("idle_usdc", 0)
                if idle < deposit_wei:
                    continue
            except Exception:
                continue

            # Get config hash from chain
            try:
                info = executor.get_batch_info(batch_id)
                config_hash = info["configHash"]
            except Exception as e:
                log.warning(
                    "[%s] Batch %d: cannot read configHash: %s",
                    fund.name, batch_id, e,
                )
                continue

            # Get market config from data-node
            if isinstance(config_hash, bytes):
                ch_hex = "0x" + config_hash.hex()
            elif isinstance(config_hash, str):
                ch_hex = config_hash if config_hash.startswith("0x") else "0x" + config_hash
            else:
                ch_hex = ""

            batch_cfg = fetch_batch_config(cfg["data_node"], ch_hex)
            if not batch_cfg or not batch_cfg.get("markets"):
                continue
            market_ids = [m["assetId"] for m in batch_cfg["markets"]]
            market_count = len(market_ids)

            # Get prices
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

            # Strategy predict
            bets = fund.strategy.predict(markets)
            while len(bets) < market_count:
                bets.append(random.choice(["UP", "DOWN"]))

            bitmap = encode_bitmap(bets, market_count)
            bm_hash = hash_bitmap(bitmap)

            # Skip if tick locked
            try:
                if executor.is_tick_locked(batch_id):
                    continue
            except Exception:
                pass

            # Join via vault
            try:
                fund.vault.join_batch(
                    batch_id, config_hash, deposit_wei, stake_wei, bm_hash,
                )
                fund.joined_batch_ids.add(batch_id)
                fund.active_batches[batch_id] = deposit_wei
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
        settled = []
        for bid in list(fund.active_batches.keys()):
            try:
                dep = fund.vault.get_active_deposit(bid)
                if dep > 0:
                    continue
            except Exception:
                pass

            try:
                fund.vault.reconcile(bid)
                settled.append(bid)
                log.info("[%s] Reconciled batch %d", fund.name, bid)
            except Exception as e:
                if "BatchAlreadyReconciled" in str(e):
                    settled.append(bid)
                else:
                    log.debug(
                        "[%s] Batch %d reconcile skipped: %s",
                        fund.name, bid, e,
                    )

        for bid in settled:
            fund.active_batches.pop(bid, None)

        # Log vault state
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

    log.info("Fund Manager started: %d funds", len(funds))

    # Oracle discovery
    oracle_urls_raw = manager_cfg.get("oracle_urls", [])
    oracle_discovery = manager_cfg.get("oracle_discovery", "static")

    def oracle_urls_fn():
        if oracle_discovery == "dynamic":
            return discover_oracles("dynamic", oracle_urls_raw, executor.w3)
        return oracle_urls_raw

    # Feed
    if not ws_url and data_node:
        ws_url = (
            data_node.replace("http://", "ws://")
            .replace("https://", "wss://")
            + "/vision/ws"
        )
    feed = VisionFeed(ws_url=ws_url, http_url=data_node)

    # Main loop
    if "--once" in sys.argv:
        urls = oracle_urls_fn()
        run_cycle(funds, executor, urls, feed, shared_cfg)
        feed.close()
        return

    try:
        while True:
            try:
                urls = oracle_urls_fn()
                run_cycle(funds, executor, urls, feed, shared_cfg)
            except Exception as e:
                log.error("Cycle error: %s", e, exc_info=True)
            time.sleep(poll_interval)
    except KeyboardInterrupt:
        pass
    finally:
        feed.close()
        log.info("Fund Manager stopped")


if __name__ == "__main__":
    main()
