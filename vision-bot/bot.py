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
from framework.tracker import Tracker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("vision-bot")

DECIMALS = 6


def run_cycle(cfg, executor, tracker, strategy, risk, issuer_urls_fn):
    """One poll cycle: join new batches, then check existing positions."""
    issuer_urls = issuer_urls_fn()
    batches = fetch_batches(cfg["vision_api"])

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

        # Get market data and predict
        market_ids = batch.get("market_ids", [])
        markets = fetch_markets(cfg["data_node"], market_ids)
        bets = strategy.predict(markets)

        # Encode, hash, approve, join, submit
        market_count = len(market_ids) if market_ids else batch.get("market_count", 10)
        bitmap = encode_bitmap(bets, market_count)
        bm_hash = hash_bitmap(bitmap)

        log.info(
            "Batch %d: %d markets, %d UP / %d DOWN",
            batch_id, market_count, bets.count("UP"), bets.count("DOWN"),
        )

        executor.approve_usdc(deposit_wei)
        stake_wei = cfg["stake"] * 10**DECIMALS
        executor.join_batch(batch_id, deposit_wei, stake_wei, bm_hash)

        time.sleep(6)  # wait for block confirmation
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

    # Run
    if "--once" in sys.argv:
        run_cycle(cfg, executor, tracker, strategy, risk, issuer_urls_fn)
        return

    while True:
        try:
            run_cycle(cfg, executor, tracker, strategy, risk, issuer_urls_fn)
        except Exception as e:
            log.error("Cycle error: %s", e)
        time.sleep(cfg["poll_interval"])


if __name__ == "__main__":
    main()
