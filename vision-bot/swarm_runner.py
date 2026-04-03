#!/usr/bin/env python3
"""
Multi-bot runner — hosts N vision bots in separate processes.

Replaces 10 separate Docker containers with 1 container running 10 processes.
Each process runs its own bot with a unique private key, strategy, and PNL file.
Processes share nothing — no GIL, no shared web3 instances, no logging deadlocks.

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
import multiprocessing
import os
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [swarm-main] %(message)s",
    datefmt="%H:%M:%S",
)


def run_single_bot(bot_id: int, private_key: str, strategy: str, stake: float, pnl_file: str, base_env: dict):
    """Run a single bot in its own process. Each process gets its own Python
    interpreter, web3 instance, HTTP pool, and WebSocket connection."""
    # With 'spawn' start method the child is a fresh interpreter.
    # Populate its environment from the parent snapshot + per-bot key.
    os.environ.clear()
    os.environ.update(base_env)
    os.environ["BOT_PRIVATE_KEY"] = private_key

    # Reconfigure logging for this child process.
    logging.basicConfig(
        level=logging.INFO,
        format=f"%(asctime)s [%(levelname)s] [bot-{bot_id}] %(message)s",
        datefmt="%H:%M:%S",
        force=True,
    )
    log = logging.getLogger(f"swarm-{bot_id}")

    # print() bypasses logging buffers — guaranteed visible in docker logs
    # even if the process dies before logging flushes.
    print(f"[bot-{bot_id}] process started (pid={os.getpid()})", flush=True)

    try:
        from framework.core import RiskCheck, encode_bitmap, hash_bitmap, load_config, load_strategy
        from framework.chain import Executor, discover_oracles, fetch_batches, fetch_batch_config, fetch_markets, load_deployment, submit_bitmap
        from framework.feed import VisionFeed
        from framework.tracker import Tracker

        print(f"[bot-{bot_id}] imports done", flush=True)

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
        cfg["pnl_file"] = pnl_file
        tracker = Tracker(executor, cfg, oracle_urls_fn)

        feed = VisionFeed(
            ws_url=cfg["data_node"].replace("http://", "ws://").replace("https://", "wss://") + "/vision/ws",
            http_url=cfg["data_node"],
        )

        log.info("Running: strategy=%s, stake=%.2f, addr=%s", strategy, stake, executor.bot_addr)

        try:
            executor.register_bot()
        except Exception as e:
            log.warning("Registration failed: %s", e)

        from bot import run_cycle
        print(f"[bot-{bot_id}] entering main loop", flush=True)
        while True:
            try:
                run_cycle(cfg, executor, tracker, strat, risk, oracle_urls_fn, feed)
            except Exception as e:
                log.error("Cycle error: %s", e)
            time.sleep(cfg["poll_interval"])

    except Exception as e:
        print(f"[bot-{bot_id}] FATAL: {e}", flush=True)
        log.error("Bot %d fatal: %s", bot_id, e, exc_info=True)
    except BaseException as e:
        print(f"[bot-{bot_id}] BASE_EXCEPTION: {e}", flush=True)
        log.error("Bot %d BaseException: %s", bot_id, e, exc_info=True)


def _spawn(bot_id, key, strategy, stake, pnl_file, base_env):
    """Create and start a Process for one bot."""
    p = multiprocessing.Process(
        target=run_single_bot,
        args=(bot_id, key, strategy, stake, pnl_file, base_env),
        daemon=False,
        name=f"bot-{bot_id}",
    )
    p.start()
    return p


def main():
    bot_count = int(os.environ.get("BOT_COUNT", "10"))
    stagger = float(os.environ.get("STAGGER_SECS", "3"))
    pnl_dir = os.environ.get("PNL_DIR", "/app/pnl-data")

    # Parse keys — BOT_KEYS csv takes priority, falls back to SWARM_BOT_{i}_KEY
    keys_csv = os.environ.get("BOT_KEYS", "")
    parsed = [k.strip() for k in keys_csv.split(",") if k.strip()] if keys_csv else []
    if len(parsed) >= bot_count:
        keys = parsed
    else:
        keys = [os.environ.get(f"SWARM_BOT_{i}_KEY", "") for i in range(bot_count)]

    # Parse strategies
    strategies_csv = os.environ.get("BOT_STRATEGIES", "momentum,contrarian,random,bullish,bearish,momentum,contrarian,random,bullish,bearish")
    strategies = [s.strip() for s in strategies_csv.split(",")]

    # Parse stakes
    stakes_csv = os.environ.get("BOT_STAKES", "1.5,1.3,1.2,1.4,1.6,1.1,1.7,1.8,1.9,1.15")
    stakes = [float(s.strip()) for s in stakes_csv.split(",")]

    # Pad to bot_count
    while len(strategies) < bot_count:
        strategies.append("random")
    while len(stakes) < bot_count:
        stakes.append(0.5)

    os.makedirs(pnl_dir, exist_ok=True)

    # Snapshot environment BEFORE spawning — each child gets a clean copy.
    # Remove BOT_PRIVATE_KEY so children don't inherit a stale value.
    base_env = dict(os.environ)
    base_env.pop("BOT_PRIVATE_KEY", None)

    log = logging.getLogger("swarm")
    log.info("Starting %d bots as separate processes", bot_count)

    # Each entry: (bot_id, key, strategy, stake, pnl_file, process)
    children = []
    for i in range(bot_count):
        if not keys[i]:
            log.warning("No key for bot %d, skipping", i)
            continue

        pnl_file = os.path.join(pnl_dir, f"pnl-{i}.json")
        p = _spawn(i, keys[i], strategies[i], stakes[i], pnl_file, base_env)
        children.append((i, keys[i], strategies[i], stakes[i], pnl_file, p))
        log.info("Bot %d started (pid=%d, strategy=%s)", i, p.pid, strategies[i])

        if i < bot_count - 1:
            time.sleep(stagger)

    log.info("All %d bots launched", len(children))
    sys.stdout.flush()
    sys.stderr.flush()

    # Monitor loop: restart dead children.
    try:
        while True:
            time.sleep(30)
            alive = 0
            for idx, (bot_id, key, strategy, stake, pnl_file, proc) in enumerate(children):
                if proc.is_alive():
                    alive += 1
                else:
                    exit_code = proc.exitcode
                    log.warning("Bot %d (pid=%d) died with exit code %s — restarting", bot_id, proc.pid, exit_code)
                    new_proc = _spawn(bot_id, key, strategy, stake, pnl_file, base_env)
                    children[idx] = (bot_id, key, strategy, stake, pnl_file, new_proc)
                    log.info("Bot %d restarted (new pid=%d)", bot_id, new_proc.pid)
                    alive += 1

            log.info("Alive check: %d/%d processes", alive, len(children))
            sys.stdout.flush()

            if len(children) == 0:
                log.error("No bots configured — exiting")
                sys.exit(1)
    except KeyboardInterrupt:
        log.info("Shutting down — terminating children")
        for _, _, _, _, _, proc in children:
            if proc.is_alive():
                proc.terminate()
        for _, _, _, _, _, proc in children:
            proc.join(timeout=5)
        log.info("All children stopped")


if __name__ == "__main__":
    # 'spawn' creates a fresh Python interpreter per child.
    # 'fork' inherits file descriptors, locks, and urllib3 connection pools —
    # exactly the shared state that caused the silent threading deadlock.
    multiprocessing.set_start_method("spawn")
    main()
