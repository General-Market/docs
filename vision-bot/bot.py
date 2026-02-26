#!/usr/bin/env python3
"""Vision Bot — strategy-driven prediction with auto lifecycle."""

import logging
import os
import sys
import time

from framework.core import (
    RiskCheck,
    encode_bitmap,
    hash_bitmap,
    load_config,
    load_strategy,
)
from framework.chain import (
    Executor,
    discover_issuers,
    fetch_batches,
    fetch_markets,
    load_deployment,
    submit_bitmap,
)
from framework.feed import VisionFeed
from framework.tracker import Tracker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("vision-bot")

DECIMALS = 6


def run_cycle(cfg, executor, tracker, strategy, risk, issuer_urls_fn, feed):
    """One poll cycle: join new batches, then check existing positions."""
    issuer_urls = issuer_urls_fn()
    batches = fetch_batches(cfg["vision_api"], executor=executor)

    for batch in batches:
        batch_id = batch.get("id", batch.get("batch_id"))
        if batch_id is None:
            continue
        if batch_id in tracker.active_ids:
            continue
        if cfg["batch_ids"] and batch_id not in cfg["batch_ids"]:
            continue
        if batch.get("paused"):
            continue
        if tracker.active_count >= cfg["max_batches"]:
            break

        deposit_wei = cfg["deposit"] * 10**DECIMALS
        if not risk.can_join(deposit_wei):
            continue
        if executor.usdc_balance() < deposit_wei:
            log.warning("Insufficient USDC for batch %d", batch_id)
            continue

        # Get configHash — from batch data or read from chain
        config_hash = batch.get("config_hash")
        if config_hash and isinstance(config_hash, str):
            config_hash = bytes.fromhex(config_hash.replace("0x", ""))
        if not config_hash:
            try:
                info = executor.get_batch_info(batch_id)
                config_hash = info["configHash"]
            except Exception as e:
                log.warning("Batch %d: cannot read configHash: %s", batch_id, e)
                continue

        # Predict with strategy (market_count from batch or default)
        market_count = batch.get("market_count", cfg.get("market_count", 10))
        market_ids = batch.get("market_ids", [])
        if market_ids:
            # Subscribe to batch if not already subscribed
            feed.subscribe([str(batch_id)], history_days=7)
            # Get latest prices from live feed
            raw_prices = feed.prices(str(batch_id))
            if raw_prices:
                markets = [
                    {
                        "id": mid,
                        "price": raw_prices.get(mid, {}).get("price", 0),
                        "change": raw_prices.get(mid, {}).get("change_pct"),
                        "volume": raw_prices.get(mid, {}).get("volume_24h"),
                        "market_cap": None,
                    }
                    for mid in market_ids
                ]
            else:
                # Fallback to HTTP if WS hasn't received data yet
                markets = fetch_markets(cfg["data_node"], market_ids)
            bets = strategy.predict(markets)
        else:
            # Hash-based design: no market_ids, generate bets for market_count
            dummy_markets = [{"id": f"m{i}", "price": 0, "change": None, "volume": None, "market_cap": None} for i in range(market_count)]
            bets = strategy.predict(dummy_markets)

        bitmap = encode_bitmap(bets, market_count)
        bm_hash = hash_bitmap(bitmap)

        log.info(
            "Batch %d: %d markets, %d UP / %d DOWN",
            batch_id, market_count, bets.count("UP"), bets.count("DOWN"),
        )

        executor.approve_usdc(deposit_wei)
        stake_wei = cfg["stake"] * 10**DECIMALS
        executor.join_batch(batch_id, config_hash, deposit_wei, stake_wei, bm_hash)

        time.sleep(2)  # wait for block confirmation
        submit_bitmap(issuer_urls, executor.bot_addr, batch_id, bitmap, bm_hash)

        tracker.on_join(batch_id, deposit_wei, bitmap, bets)
        risk.record_join(batch_id, deposit_wei)

    # Lifecycle: check balances, auto-claim, auto-withdraw
    tracker.check_all()


def main():
    # Parse --config flag
    config_path = None
    if "--config" in sys.argv:
        idx = sys.argv.index("--config")
        if idx + 1 < len(sys.argv):
            config_path = sys.argv[idx + 1]

    cfg = load_config(config_path)
    strategy = load_strategy(cfg["strategy"])
    private_key = os.environ.get("BOT_PRIVATE_KEY", "")
    if not private_key:
        log.error("BOT_PRIVATE_KEY env var required")
        sys.exit(1)

    # Load deployment addresses
    deploy = load_deployment()
    vision_addr = deploy["contracts"]["Vision"]
    usdc_addr = deploy["contracts"]["ARB_USDC"]

    executor = Executor(cfg["rpc_url"], private_key, vision_addr, usdc_addr)
    risk = RiskCheck(cfg["max_batches"], cfg["max_exposure"] * 10**DECIMALS)
    issuer_urls_fn = lambda: discover_issuers(
        cfg["issuer_discovery"], cfg["issuer_urls"], executor.w3
    )
    tracker = Tracker(executor, cfg, issuer_urls_fn)

    # Startup info
    log.info("Vision Bot starting")
    log.info("  Strategy:     %s", cfg["strategy"])
    log.info("  Bot address:  %s", executor.bot_addr)
    log.info("  RPC:          %s", cfg["rpc_url"])
    log.info("  Deposit:      %d USDC", cfg["deposit"])
    log.info("  Stake/tick:   %d USDC", cfg["stake"])
    log.info("  Max batches:  %d", cfg["max_batches"])

    # Check connectivity
    try:
        chain_id = executor.w3.eth.chain_id
        log.info("  Chain ID:     %d", chain_id)
    except Exception as e:
        log.error("Cannot connect to RPC: %s", e)
        sys.exit(1)

    # Check balance
    balance = executor.usdc_balance()
    log.info("  USDC balance: %d", balance // 10**DECIMALS)

    # Register bot
    try:
        executor.register_bot()
    except Exception as e:
        log.warning("Bot registration failed: %s", e)

    # Create WebSocket feed with HTTP fallback
    feed = VisionFeed(
        ws_url=cfg["data_node"].replace("http://", "ws://").replace("https://", "wss://") + "/vision/ws",
        http_url=cfg["data_node"],
    )

    # Run
    if "--once" in sys.argv:
        run_cycle(cfg, executor, tracker, strategy, risk, issuer_urls_fn, feed)
        feed.close()
        return

    try:
        while True:
            try:
                run_cycle(cfg, executor, tracker, strategy, risk, issuer_urls_fn, feed)
            except Exception as e:
                log.error("Cycle error: %s", e)
            time.sleep(cfg["poll_interval"])
    except KeyboardInterrupt:
        log.info("Shutting down...")
    finally:
        feed.close()


if __name__ == "__main__":
    main()
