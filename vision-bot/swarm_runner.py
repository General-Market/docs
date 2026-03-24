#!/usr/bin/env python3
"""
Multi-bot runner — hosts N vision bots in a single process using threads.

Replaces 10 separate Docker containers with 1 container running 10 threads.
Each thread runs its own bot with a unique private key, strategy, and PNL file.

Environment:
  BOT_COUNT          — number of bots to run (default: 10)
  BOT_KEYS           — comma-separated private keys
  BOT_STRATEGIES     — comma-separated strategies (momentum,contrarian,random,etc.)
  BOT_STAKES         — comma-separated stake amounts per tick
  PNL_DIR            — directory for PNL files (default: /app/pnl-data)
  STAGGER_SECS       — delay between bot starts (default: 3)

Falls back to SWARM_BOT_{i}_KEY env vars if BOT_KEYS is not set.
"""

import logging
import os
import sys
import threading
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [bot-%(bot_id)s] %(message)s",
    datefmt="%H:%M:%S",
)


def run_single_bot(bot_id: int, private_key: str, strategy: str, stake: float, pnl_file: str):
    """Run a single bot in this thread. Imports are done here to avoid shared state."""
    log = logging.getLogger(f"swarm-{bot_id}")
    log = logging.LoggerAdapter(log, {"bot_id": str(bot_id)})

    # Set env vars that bot.py expects
    os.environ["BOT_PRIVATE_KEY"] = private_key
    # We can't set per-thread env vars, so we import and configure directly.

    try:
        from framework.core import RiskCheck, encode_bitmap, hash_bitmap, load_config, load_strategy
        from framework.chain import Executor, discover_oracles, fetch_batches, fetch_batch_config, fetch_markets, load_deployment, submit_bitmap
        from framework.feed import VisionFeed
        from framework.tracker import Tracker

        cfg = load_config()
        cfg["strategy"] = strategy
        cfg["stake"] = stake

        strat = load_strategy(strategy)

        deploy = load_deployment()
        vision_addr = deploy["contracts"]["Vision"]

        from web3 import Web3
        _w3 = Web3(Web3.HTTPProvider(cfg["rpc_url"]))
        _vision = _w3.eth.contract(
            address=Web3.to_checksum_address(vision_addr),
            abi=[{"name": "USDC", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "address"}]}]
        )
        try:
            usdc_addr = _vision.functions.USDC().call()
        except Exception:
            usdc_addr = deploy["contracts"]["L3_WUSDC"]

        oracle_registry_addr = deploy["contracts"].get("OracleRegistry", "")
        executor = Executor(cfg["rpc_url"], private_key, vision_addr, usdc_addr, oracle_registry_addr)
        risk = RiskCheck(cfg["max_batches"], cfg["max_exposure"] * 10**18)
        oracle_urls_fn = lambda: discover_oracles(cfg["oracle_discovery"], cfg["oracle_urls"], executor.w3)
        tracker = Tracker(executor, cfg, oracle_urls_fn, pnl_path=pnl_file)

        feed = VisionFeed(
            ws_url=cfg["data_node"].replace("http://", "ws://").replace("https://", "wss://") + "/vision/ws",
            http_url=cfg["data_node"],
        )

        log.info("Started: strategy=%s, stake=%.2f, addr=%s", strategy, stake, executor.bot_addr)

        try:
            executor.register_bot()
        except Exception as e:
            log.warning("Registration failed: %s", e)

        from bot import run_cycle
        while True:
            try:
                run_cycle(cfg, executor, tracker, strat, risk, oracle_urls_fn, feed)
            except Exception as e:
                log.error("Cycle error: %s", e)
            time.sleep(cfg["poll_interval"])

    except Exception as e:
        log.error("Bot %d fatal: %s", bot_id, e, exc_info=True)


def main():
    bot_count = int(os.environ.get("BOT_COUNT", "10"))
    stagger = float(os.environ.get("STAGGER_SECS", "3"))
    pnl_dir = os.environ.get("PNL_DIR", "/app/pnl-data")

    # Parse keys
    keys_csv = os.environ.get("BOT_KEYS", "")
    if keys_csv:
        keys = [k.strip() for k in keys_csv.split(",")]
    else:
        keys = [os.environ.get(f"SWARM_BOT_{i}_KEY", "") for i in range(bot_count)]

    # Parse strategies
    strategies_csv = os.environ.get("BOT_STRATEGIES", "momentum,contrarian,random,bullish,bearish,momentum,contrarian,random,bullish,bearish")
    strategies = [s.strip() for s in strategies_csv.split(",")]

    # Parse stakes
    stakes_csv = os.environ.get("BOT_STAKES", "0.5,0.3,0.2,0.4,0.6,0.1,0.7,0.8,0.9,0.15")
    stakes = [float(s.strip()) for s in stakes_csv.split(",")]

    # Pad to bot_count
    while len(strategies) < bot_count:
        strategies.append("random")
    while len(stakes) < bot_count:
        stakes.append(0.5)

    os.makedirs(pnl_dir, exist_ok=True)

    logging.getLogger().info("Starting %d bots in single process", bot_count)

    threads = []
    for i in range(bot_count):
        if not keys[i]:
            logging.getLogger().warning("No key for bot %d, skipping", i)
            continue

        pnl_file = os.path.join(pnl_dir, f"pnl-{i}.json")
        t = threading.Thread(
            target=run_single_bot,
            args=(i, keys[i], strategies[i], stakes[i], pnl_file),
            daemon=True,
            name=f"bot-{i}",
        )
        threads.append(t)
        t.start()
        logging.getLogger().info("Bot %d started (strategy=%s)", i, strategies[i])

        if i < bot_count - 1:
            time.sleep(stagger)

    logging.getLogger().info("All %d bots running", len(threads))

    # Wait forever (threads are daemons, so main exit kills them)
    try:
        while True:
            alive = sum(1 for t in threads if t.is_alive())
            if alive == 0:
                logging.getLogger().error("All bots died")
                sys.exit(1)
            time.sleep(60)
    except KeyboardInterrupt:
        logging.getLogger().info("Shutting down...")


if __name__ == "__main__":
    main()
