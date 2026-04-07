#!/usr/bin/env python3
"""Vision Bot — strategy-driven prediction with auto lifecycle."""

import logging
import os
import signal
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
    BitmapSubmitError,
    Executor,
    VaultExecutor,
    discover_oracles,
    fetch_batch_config,
    fetch_batches,
    fetch_markets,
    load_deployment,
    submit_bitmap,
)
from framework.feed import VisionFeed
from framework.tracker import Tracker

# Global shutdown flag set by signal handlers. Checked between cycles so the
# main loop exits cleanly instead of being killed mid-bitmap-submit.
_shutdown_flag = False

# How long an oracle ack is considered fresh before we re-submit. Five minutes
# is enough to survive an oracle restart and short enough that a partial
# acceptance gets repaired before settlement.
_BITMAP_REFRESH_SECS = 300

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("vision-bot")

DECIMALS = 18


def _resubmit_if_stale(pos, oracle_urls, player, bid, refresh_secs=_BITMAP_REFRESH_SECS):
    """Re-submit a bitmap iff it has gone stale or its last submission failed.

    Without this gate, every poll cycle hammered every oracle for every active
    position — five POSTs per second at scale, for no benefit. The oracle
    remembers an accepted bitmap; the resubmit only matters when the oracle
    forgot (restart) or never knew (prior failure).
    """
    if not pos or not pos.get("bitmap") or pos.get("poisoned"):
        return
    last_ack = pos.get("last_oracle_ack_at", 0)
    needs_refresh = (time.time() - last_ack) > refresh_secs
    failed_last = pos.get("bitmap_submit_failed", False)
    if not (needs_refresh or failed_last):
        return
    bm = pos["bitmap"]
    bm_hash = pos.get("bitmap_hash") or hash_bitmap(bm)
    pos["bitmap_hash"] = bm_hash
    try:
        submit_bitmap(oracle_urls, player, bid, bm, bm_hash, retries=1)
        pos["last_oracle_ack_at"] = time.time()
        pos["bitmap_submit_failed"] = False
    except BitmapSubmitError as e:
        log.warning("Batch %d: bitmap resubmit below quorum: %s", bid, e)
        pos["bitmap_submit_failed"] = True
    except Exception as e:
        log.warning("Batch %d: bitmap resubmit error: %s", bid, e)
        pos["bitmap_submit_failed"] = True


def _wait_for_join(executor, batch_id, timeout=10):
    """Poll on-chain getPosition until the join is visible. Returns True on
    success. False after timeout — caller should continue regardless; the
    bitmap retry path is the safety net."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            pos = executor.get_position(batch_id)
            if pos.get("joinTimestamp", 0) > 0:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def run_cycle(cfg, executor, tracker, strategy, risk, oracle_urls_fn, feed, vault_executor=None):
    """One poll cycle: join new batches, then check existing positions."""
    oracle_urls = oracle_urls_fn()
    vault_mode = vault_executor is not None

    # Round-based mode: lifecycle manager creates batches. Skip static batch discovery.
    if cfg.get("round_based", False):
        # Approve max once at the start (not needed in vault mode — vault manages USDC)
        if not vault_mode and not getattr(tracker, '_usdc_approved', False):
            executor.approve_usdc(2**256 - 1)
            tracker._usdc_approved = True
        tracker.check_rounds(strategy=strategy)

        # Re-submit bitmaps only when stale or last submission failed.
        # The oracle holds accepted bitmaps; we hammer it only when memory
        # was lost or never written.
        round_player = vault_executor.vault_addr if vault_mode else executor.bot_addr
        for bid in list(tracker.active_ids):
            pos = tracker.positions.get(bid)
            _resubmit_if_stale(pos, oracle_urls, round_player, bid)

        exited = tracker.check_all()
        for bid in exited:
            risk.record_exit(bid)
            if vault_mode and cfg.get("vault_auto_reconcile", True):
                try:
                    payout = executor.get_settlement_payout(bid, vault_executor.vault_addr)
                    vault_executor.reconcile(bid, payout)
                except Exception as e:
                    log.warning("Vault reconcile batch %d failed: %s", bid, e)
        if vault_mode:
            info = tracker.check_vault_state(vault_executor)
            if info:
                tracker.save_vault_state(info)
        return

    batches = fetch_batches(cfg["vision_api"], executor=executor)

    for batch in batches:
        batch_id = batch.get("id", batch.get("batch_id"))
        if batch_id is None:
            continue
        if batch_id < cfg.get("min_batch_id", 0):
            continue
        if batch_id in tracker.active_ids:
            continue
        if cfg["batch_ids"] and batch_id not in cfg["batch_ids"]:
            continue
        if batch.get("paused"):
            continue
        if tracker.active_count >= cfg["max_batches"]:
            break

        # Skip if already joined on-chain (e.g. from a previous run)
        try:
            pos = executor.get_position(batch_id)
            if pos["joinTimestamp"] > 0:
                log.debug("Batch %d: already joined on-chain, skipping", batch_id)
                continue
        except Exception:
            pass  # batch may not exist yet, proceed

        deposit_wei = cfg["deposit"] * 10**DECIMALS
        if not risk.can_join(deposit_wei):
            continue
        if executor.usdc_balance() < deposit_wei:
            log.warning("Insufficient USDC for batch %d", batch_id)
            continue

        # Get configHash from on-chain getBatch() — MUST match exactly or joinBatch reverts.
        # Data-node/WS config hashes drift as market data changes; only the chain value works.
        try:
            info = executor.get_batch_info(batch_id)
            config_hash = info["configHash"]
        except Exception as e:
            log.warning("Batch %d: cannot read configHash from chain: %s", batch_id, e)
            continue

        # Skip batches in lock window BEFORE doing the expensive market fetch
        # and strategy work. A locked tick wastes a data-node round-trip and a
        # CPU spike for nothing — the join will revert.
        try:
            if executor.is_tick_locked(batch_id):
                log.debug("Batch %d: tick locked, skipping", batch_id)
                continue
        except Exception:
            pass  # proceed if check fails

        # Validate config_hash byte width. A 31-byte hash from a malformed
        # JSON cache will collide with a 32-byte buffer in the contract and
        # the join will revert in a way that costs gas and tells you nothing.
        if isinstance(config_hash, bytes):
            if len(config_hash) != 32:
                log.error(
                    "Batch %d: configHash is %d bytes, expected 32 — skipping",
                    batch_id, len(config_hash),
                )
                continue
            config_hash_hex = "0x" + config_hash.hex()
        elif isinstance(config_hash, str):
            config_hash_hex = config_hash if config_hash.startswith("0x") else "0x" + config_hash
            if len(config_hash_hex) != 66:  # 0x + 64 hex chars = 32 bytes
                log.error(
                    "Batch %d: configHash hex is %d chars, expected 66 — skipping",
                    batch_id, len(config_hash_hex),
                )
                continue
        else:
            log.error("Batch %d: configHash type unrecognised — skipping", batch_id)
            continue

        # Fetch real market config from data-node to get actual market count.
        # The config_hash is immutable per batch — the data-node response is
        # the ONLY authoritative source for bitmap sizing.
        batch_cfg = fetch_batch_config(cfg["data_node"], config_hash_hex)
        if batch_cfg and batch_cfg.get("markets"):
            market_ids = [m["assetId"] for m in batch_cfg["markets"]]
            market_count = len(market_ids)
        else:
            # Cannot determine real market list — skip this batch entirely.
            # A bitmap built on a guessed count is a bet with the wrong anatomy.
            log.warning(
                "Batch %d: cannot fetch market config from data-node "
                "(config_hash=%s) — skipping to avoid short bitmap",
                batch_id, config_hash_hex[:18],
            )
            continue

        # market_ids is always populated here (early continue above if not)
        # Subscribe to batch if not already subscribed
        feed.subscribe([str(batch_id)], history_days=7)

        # Freshness gate: refuse to bet on a stale feed. A bot that joins on
        # a frozen WebSocket is a bot that joins on yesterday's prices —
        # a quiet way to bleed. Two ticks of slack covers reconnect jitter.
        tick_duration = info.get("tickDuration") or cfg.get("poll_interval", 30)
        if not feed.is_fresh(str(batch_id), max_age_secs=2 * tick_duration):
            log.warning(
                "Batch %d: feed not fresh (>%ds since last message) — skipping join",
                batch_id, 2 * tick_duration,
            )
            continue

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
        # Canonical strategy hook — predict_with_context delegates to predict
        # for simple strategies and uses feed history for the history-aware ones.
        bets = strategy.predict_with_context(
            markets, feed=feed, batch_id=str(batch_id),
        )

        # Defensive: pad bets if strategy returned fewer than market_count.
        # Use the strategy's own RNG so the padding is reproducible across
        # restarts and not seeded from process state.
        pad_rng = getattr(strategy, "_rng", None)
        while len(bets) < market_count:
            if pad_rng is not None:
                bets.append(pad_rng.choice(["UP", "DOWN"]))
            else:
                bets.append("DOWN")  # last-resort default

        bitmap = encode_bitmap(bets, market_count)
        bm_hash = hash_bitmap(bitmap)

        log.info(
            "Batch %d: %d markets, %d UP / %d DOWN",
            batch_id, market_count, bets.count("UP"), bets.count("DOWN"),
        )

        if vault_mode:
            vault_executor.join_batch(batch_id, config_hash, deposit_wei, bm_hash)
        else:
            executor.approve_usdc(deposit_wei)
            executor.join_batch_direct(batch_id, config_hash, deposit_wei, bm_hash)

        # Wait for the join to be visible on-chain instead of guessing with
        # a fixed sleep. The bitmap submission below depends on the oracle
        # seeing the join; submitting before then is wasted retries.
        if not _wait_for_join(executor, batch_id, timeout=10):
            log.warning(
                "Batch %d: join not visible on-chain after 10s — proceeding "
                "anyway, bitmap retry will catch up",
                batch_id,
            )

        # In vault mode the player address is the vault, not the bot EOA
        player_addr = vault_executor.vault_addr if vault_mode else executor.bot_addr
        bitmap_ack_at = 0.0
        bitmap_failed = False
        try:
            submit_bitmap(oracle_urls, player_addr, batch_id, bitmap, bm_hash, retries=5)
            bitmap_ack_at = time.time()
        except BitmapSubmitError as e:
            log.warning(
                "Batch %d: bitmap submission below quorum (%s) — will retry next cycle",
                batch_id, e,
            )
            bitmap_failed = True
        except Exception as e:
            log.warning("Batch %d: bitmap submission error: %s — will retry", batch_id, e)
            bitmap_failed = True

        tracker.on_join(batch_id, deposit_wei, bitmap, bets, bitmap_hash=bm_hash)
        risk.record_join(batch_id, deposit_wei)
        # Stamp the position so the resubmit gate knows when to re-fire.
        new_pos = tracker.positions.get(batch_id)
        if new_pos is not None:
            new_pos["last_oracle_ack_at"] = bitmap_ack_at
            new_pos["bitmap_submit_failed"] = bitmap_failed

    # Re-submit bitmaps only when stale or previously failed (survives oracle restarts).
    player_for_bitmap = vault_executor.vault_addr if vault_mode else executor.bot_addr
    for bid in list(tracker.active_ids):
        pos = tracker.positions.get(bid)
        _resubmit_if_stale(pos, oracle_urls, player_for_bitmap, bid)

    # Round-based mode: poll oracle for active rounds, join new ones
    if cfg.get("round_based", False):
        tracker.check_rounds(strategy=strategy)

    # Lifecycle: check balances, auto-claim, auto-withdraw
    exited = tracker.check_all()
    for bid in exited:
        risk.record_exit(bid)
        if vault_mode and cfg.get("vault_auto_reconcile", True):
            try:
                payout = executor.get_settlement_payout(bid, vault_executor.vault_addr)
                vault_executor.reconcile(bid, payout)
            except Exception as e:
                log.warning("Vault reconcile batch %d failed: %s", bid, e)

    # Periodic vault state check
    if vault_mode:
        info = tracker.check_vault_state(vault_executor)
        if info:
            tracker.save_vault_state(info)


def _install_signal_handlers():
    """Set SIGTERM and SIGINT to flip the shutdown flag.

    Children killed mid-cycle drop in-flight state — pnl files unflushed,
    feeds half-disconnected, futures abandoned. The flag lets the main loop
    exit between cycles, after the current bitmap submission has settled.
    """
    def _handler(signum, _frame):
        global _shutdown_flag
        log.info("Received signal %d — draining current cycle then exiting", signum)
        _shutdown_flag = True

    signal.signal(signal.SIGTERM, _handler)
    signal.signal(signal.SIGINT, _handler)


def main():
    _install_signal_handlers()

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
    # Vision.sol now lives on L3, uses its own immutable USDC (may differ from L3_WUSDC)
    deploy = load_deployment()
    vision_addr = deploy["contracts"]["Vision"]
    # Read USDC from the Vision contract (not deployment JSON — may differ after redeploy)
    from web3 import Web3
    _w3 = Web3(Web3.HTTPProvider(cfg["rpc_url"]))
    _vision = _w3.eth.contract(address=Web3.to_checksum_address(vision_addr), abi=[{"name":"USDC","type":"function","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}]}])
    try:
        usdc_addr = _vision.functions.USDC().call()
        log.info("USDC from Vision contract: %s", usdc_addr)
    except Exception:
        usdc_addr = deploy["contracts"]["L3_WUSDC"]
        log.warning("Falling back to L3_WUSDC from deployment: %s", usdc_addr)
    oracle_registry_addr = deploy["contracts"].get("OracleRegistry", "")

    executor = Executor(cfg["rpc_url"], private_key, vision_addr, usdc_addr, oracle_registry_addr)
    risk = RiskCheck(cfg["max_batches"], cfg["max_exposure"] * 10**DECIMALS)
    oracle_urls_fn = lambda: discover_oracles(
        cfg["oracle_discovery"], cfg["oracle_urls"], executor.w3
    )
    tracker = Tracker(executor, cfg, oracle_urls_fn)

    # Startup info
    log.info("Vision Bot starting")
    log.info("  Strategy:     %s", cfg["strategy"])
    log.info("  Bot address:  %s", executor.bot_addr)
    log.info("  RPC:          %s", cfg["rpc_url"])
    log.info("  Deposit:      %d USDC", cfg["deposit"])
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

    # Vault mode initialization
    vault_executor = None
    if cfg.get("vault_mode", False):
        factory_addr = cfg.get("vault_factory_address", "")
        vault_addr = cfg.get("vault_address", "")

        if vault_addr:
            vault_executor = VaultExecutor(executor, vault_addr, factory_addr)
            log.info("  Vault mode:   using existing vault %s", vault_addr)
        elif factory_addr:
            log.info("  Vault mode:   creating new vault via factory %s", factory_addr[:16])
            vault_executor = VaultExecutor.create_vault(
                executor,
                factory_addr,
                cfg.get("vault_name", "Vision Bot Fund"),
                cfg.get("vault_symbol", "vbFUND"),
                cfg.get("vault_perf_fee", 2000),
            )
            log.info("  Vault:        %s", vault_executor.vault_addr)
        else:
            log.error("vault_mode enabled but no vault_address or vault_factory_address set")
            sys.exit(1)

        # Seed capital
        seed = int(cfg.get("vault_seed_deposit", 0) * 10**DECIMALS)
        if seed > 0:
            bot_balance = executor.usdc_balance()
            if bot_balance >= seed:
                vault_executor.deposit_to_vault(seed)
                log.info("  Seed deposit: %d USDC", seed // 10**DECIMALS)
            else:
                log.warning(
                    "Insufficient USDC for seed deposit (have %d, need %d)",
                    bot_balance // 10**DECIMALS, seed // 10**DECIMALS,
                )

        # Log vault state
        try:
            info = vault_executor.get_vault_info()
            log.info(
                "  Vault assets: %d USDC | shares: %d | HWM: %d",
                info["total_assets"] // 10**DECIMALS,
                info["total_supply"] // 10**DECIMALS,
                info["hwm"] // 10**DECIMALS,
            )
        except Exception as e:
            log.warning("Cannot read vault state: %s", e)

    # Create WebSocket feed with HTTP fallback
    feed = VisionFeed(
        ws_url=cfg["data_node"].replace("http://", "ws://").replace("https://", "wss://") + "/vision/ws",
        http_url=cfg["data_node"],
    )

    # Recover bitmaps for any positions loaded from pnl.json that have no stored bitmap.
    # Positions joined with the null bitmap hash are unrecoverable — mark poisoned and skip.
    poisoned = tracker.recover_bitmaps(strategy, cfg["data_node"], oracle_urls_fn())
    if poisoned:
        log.info(
            "%d positions have unrecoverable null-hash bitmaps — marked poisoned, will skip",
            len(poisoned),
        )

    # Run. The try/finally guarantees state is flushed regardless of how the
    # loop exits — KeyboardInterrupt, SIGTERM, an unrecoverable error, or
    # the once-only path. Save the history first; the feed close is best-effort.
    try:
        if "--once" in sys.argv:
            run_cycle(cfg, executor, tracker, strategy, risk, oracle_urls_fn, feed, vault_executor)
            return

        while not _shutdown_flag:
            try:
                run_cycle(cfg, executor, tracker, strategy, risk, oracle_urls_fn, feed, vault_executor)
            except Exception as e:
                log.error("Cycle error: %s", e)
            # Sleep in small chunks so a SIGTERM during sleep is honoured promptly.
            slept = 0
            while slept < cfg["poll_interval"] and not _shutdown_flag:
                time.sleep(min(1, cfg["poll_interval"] - slept))
                slept += 1
        log.info("Shutdown flag set — exiting main loop")
    except KeyboardInterrupt:
        log.info("KeyboardInterrupt — shutting down")
    finally:
        try:
            tracker._save_history()
        except Exception as e:
            log.warning("Final history save failed: %s", e)
        try:
            feed.close()
        except Exception as e:
            log.warning("Feed close failed: %s", e)


if __name__ == "__main__":
    main()
