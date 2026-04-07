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
  BOT_DEPOSITS       — comma-separated deposit amounts per join (USDC)
  PNL_DIR            — directory for PNL files (default: /app/pnl-data)
  STAGGER_SECS       — delay between bot starts (default: 3)

Falls back to SWARM_BOT_{i}_KEY env vars if BOT_KEYS is not set.
"""

import logging
import multiprocessing
import os
import signal
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [swarm-main] %(message)s",
    datefmt="%H:%M:%S",
)

# Restart-storm guards. Backoff doubles per restart, capped. After enough
# restarts in a window, the bot is declared dead and left alone.
_RESTART_BACKOFF_CAP_SECS = 600
_RESTART_DEAD_THRESHOLD = 10
_RESTART_DEAD_WINDOW_SECS = 3600

# Status file the orchestrator can read to see which bots have been quarantined.
_STATUS_DIR_ENV = "SWARM_STATUS_DIR"


def run_single_bot(bot_id: int, private_key: str, strategy: str, deposit: float, pnl_file: str, base_env: dict):
    """Run a single bot in its own process. Each process gets its own Python
    interpreter, web3 instance, HTTP pool, and WebSocket connection."""
    # With 'spawn' start method the child is a fresh interpreter.
    # Layer the parent's environment on top of whatever the child started
    # with. Do NOT clear os.environ — spawn-mode Python relies on internal
    # variables (PYTHONPATH, PYTHONHOME, PYTHONHASHSEED, PYTHONIOENCODING)
    # which clearing would obliterate. Update is enough.
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
        cfg["deposit"] = deposit

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

        log.info("Running: strategy=%s, deposit=%.2f, addr=%s", strategy, deposit, executor.bot_addr)

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


def _spawn(bot_id, key, strategy, deposit, pnl_file, base_env):
    """Create and start a Process for one bot."""
    p = multiprocessing.Process(
        target=run_single_bot,
        args=(bot_id, key, strategy, deposit, pnl_file, base_env),
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

    # Parse per-bot deposit amounts (USDC). One join, one number.
    deposits_csv = os.environ.get("BOT_DEPOSITS", "10,10,10,10,10,10,10,10,10,10")
    deposits = [float(s.strip()) for s in deposits_csv.split(",")]

    # Pad to bot_count
    while len(strategies) < bot_count:
        strategies.append("random")
    while len(deposits) < bot_count:
        deposits.append(10.0)

    os.makedirs(pnl_dir, exist_ok=True)

    # Snapshot environment BEFORE spawning — each child gets a clean copy.
    # Remove BOT_PRIVATE_KEY so children don't inherit a stale value.
    base_env = dict(os.environ)
    base_env.pop("BOT_PRIVATE_KEY", None)

    log = logging.getLogger("swarm")
    log.info("Starting %d bots as separate processes", bot_count)

    status_dir = os.environ.get(_STATUS_DIR_ENV, "")
    if status_dir:
        os.makedirs(status_dir, exist_ok=True)

    def _write_status(bot_id: int, state: str, detail: str = ""):
        if not status_dir:
            return
        try:
            path = os.path.join(status_dir, f"bot-{bot_id}.status")
            with open(path, "w") as f:
                f.write(f"{state}\n{detail}\n{time.time()}\n")
        except Exception as e:
            log.warning("Status write failed for bot %d: %s", bot_id, e)

    # Each entry is a dict so we can mutate fields in place without unpacking.
    children = []
    for i in range(bot_count):
        if not keys[i]:
            log.warning("No key for bot %d, skipping", i)
            continue

        pnl_file = os.path.join(pnl_dir, f"pnl-{i}.json")
        p = _spawn(i, keys[i], strategies[i], deposits[i], pnl_file, base_env)
        children.append({
            "bot_id": i,
            "key": keys[i],
            "strategy": strategies[i],
            "deposit": deposits[i],
            "pnl_file": pnl_file,
            "proc": p,
            "restart_count": 0,
            "restart_history": [],  # timestamps of recent restarts
            "dead": False,
            "next_restart_at": 0.0,
        })
        log.info("Bot %d started (pid=%d, strategy=%s)", i, p.pid, strategies[i])
        _write_status(i, "running")

        if i < bot_count - 1:
            time.sleep(stagger)

    log.info("All %d bots launched", len(children))
    sys.stdout.flush()
    sys.stderr.flush()

    # Shutdown handlers — flip a local flag instead of dying mid-iteration.
    shutdown = {"flag": False}
    def _shutdown_handler(signum, _frame):
        log.info("swarm received signal %d — shutting down", signum)
        shutdown["flag"] = True
    signal.signal(signal.SIGTERM, _shutdown_handler)
    signal.signal(signal.SIGINT, _shutdown_handler)

    # Monitor loop: restart dead children, with backoff and a quarantine.
    try:
        while not shutdown["flag"]:
            # Sleep in 1s chunks so SIGTERM during the wait is honoured fast.
            for _ in range(30):
                if shutdown["flag"]:
                    break
                time.sleep(1)
            if shutdown["flag"]:
                break

            alive = 0
            now = time.time()
            for child in children:
                if child["dead"]:
                    continue
                proc = child["proc"]
                if proc.is_alive():
                    alive += 1
                    continue

                # Process is dead. Decide whether to restart.
                exit_code = proc.exitcode
                bot_id = child["bot_id"]

                # Trim restart history to the last hour.
                cutoff = now - _RESTART_DEAD_WINDOW_SECS
                child["restart_history"] = [
                    t for t in child["restart_history"] if t >= cutoff
                ]

                if len(child["restart_history"]) >= _RESTART_DEAD_THRESHOLD:
                    log.warning(
                        "Bot %d crossed %d restarts in %ds — quarantined, will not restart",
                        bot_id, _RESTART_DEAD_THRESHOLD, _RESTART_DEAD_WINDOW_SECS,
                    )
                    child["dead"] = True
                    _write_status(bot_id, "quarantined", f"exit={exit_code}")
                    continue

                # Backoff: 1, 2, 4, 8, ... seconds, capped.
                if now < child["next_restart_at"]:
                    # Still in backoff window — skip this tick, try again later.
                    continue

                backoff = min(2 ** child["restart_count"], _RESTART_BACKOFF_CAP_SECS)
                log.warning(
                    "Bot %d (pid=%s) died with exit code %s — restart #%d after %ds backoff",
                    bot_id, proc.pid, exit_code, child["restart_count"] + 1, backoff,
                )
                child["next_restart_at"] = now + backoff
                child["restart_count"] += 1
                child["restart_history"].append(now)

                new_proc = _spawn(
                    bot_id, child["key"], child["strategy"],
                    child["deposit"], child["pnl_file"], base_env,
                )
                child["proc"] = new_proc
                log.info("Bot %d restarted (new pid=%d)", bot_id, new_proc.pid)
                _write_status(bot_id, "restarted", f"count={child['restart_count']}")
                alive += 1

            log.info(
                "Alive check: %d/%d processes (quarantined: %d)",
                alive, len(children),
                sum(1 for c in children if c["dead"]),
            )
            sys.stdout.flush()

            if len(children) == 0:
                log.error("No bots configured — exiting")
                sys.exit(1)
    except KeyboardInterrupt:
        log.info("KeyboardInterrupt — shutting down")
    finally:
        # Drain children. Send SIGTERM, give each up to 30s to exit cleanly
        # (the bots now install their own SIGTERM handlers and flush state),
        # then SIGKILL the survivors.
        log.info("Sending SIGTERM to all children")
        for child in children:
            proc = child["proc"]
            if proc.is_alive():
                try:
                    proc.terminate()
                except Exception as e:
                    log.warning("Bot %d terminate failed: %s", child["bot_id"], e)

        deadline = time.time() + 30
        for child in children:
            proc = child["proc"]
            if not proc.is_alive():
                continue
            remaining = max(0, deadline - time.time())
            proc.join(timeout=remaining)

        for child in children:
            proc = child["proc"]
            if proc.is_alive():
                log.warning(
                    "Bot %d did not exit cleanly within 30s — sending SIGKILL",
                    child["bot_id"],
                )
                try:
                    proc.kill()
                    proc.join(timeout=5)
                except Exception as e:
                    log.warning("Bot %d kill failed: %s", child["bot_id"], e)

        log.info("All children stopped")


if __name__ == "__main__":
    # 'spawn' creates a fresh Python interpreter per child.
    # 'fork' inherits file descriptors, locks, and urllib3 connection pools —
    # exactly the shared state that caused the silent threading deadlock.
    multiprocessing.set_start_method("spawn")
    main()
