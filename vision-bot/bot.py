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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("vision-bot")

DECIMALS = 18


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

        # Re-submit bitmaps only for RECENT positions (joined in last 10 min).
        # Old positions already have their bitmaps accepted by oracles.
        round_player = vault_executor.vault_addr if vault_mode else executor.bot_addr
        cutoff = time.time() - 600
        recent_ids = [bid for bid in tracker.active_ids
                      if tracker.positions.get(bid, {}).get("joined_at", 0) > cutoff]
        for bid in recent_ids:
            pos = tracker.positions.get(bid)
            if not pos or not pos.get("bitmap") or pos.get("poisoned"):
                continue
            bm = pos["bitmap"]
            bm_hash = pos.get("bitmap_hash") or hash_bitmap(bm)
            pos["bitmap_hash"] = bm_hash
            submit_bitmap(
                oracle_urls, round_player, bid,
                bm, bm_hash, retries=1,
            )

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

        # Fetch real market config from data-node to get actual market count.
        # The config_hash is immutable per batch — the data-node response is
        # the ONLY authoritative source for bitmap sizing.
        if isinstance(config_hash, bytes):
            config_hash_hex = "0x" + config_hash.hex()
        elif isinstance(config_hash, str):
            config_hash_hex = config_hash if config_hash.startswith("0x") else "0x" + config_hash
        else:
            config_hash_hex = ""
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

        # Defensive: pad bets if strategy returned fewer than market_count
        import random as _rng
        while len(bets) < market_count:
            bets.append(_rng.choice(["UP", "DOWN"]))

        bitmap = encode_bitmap(bets, market_count)
        bm_hash = hash_bitmap(bitmap)

        log.info(
            "Batch %d: %d markets, %d UP / %d DOWN",
            batch_id, market_count, bets.count("UP"), bets.count("DOWN"),
        )

        # Skip batches in lock window to avoid TickLocked() reverts
        try:
            if executor.is_tick_locked(batch_id):
                log.debug("Batch %d: tick locked, skipping", batch_id)
                continue
        except Exception:
            pass  # proceed if check fails

        stake_wei = int(cfg["stake"] * 10**DECIMALS)
        if vault_mode:
            vault_executor.join_batch(batch_id, config_hash, deposit_wei, stake_wei, bm_hash)
        else:
            executor.approve_usdc(deposit_wei)
            executor.join_batch_direct(batch_id, config_hash, deposit_wei, stake_wei, bm_hash)

        time.sleep(2)  # initial wait for block confirmation
        # In vault mode the player address is the vault, not the bot EOA
        player_addr = vault_executor.vault_addr if vault_mode else executor.bot_addr
        submit_bitmap(oracle_urls, player_addr, batch_id, bitmap, bm_hash, retries=5)

        tracker.on_join(batch_id, deposit_wei, bitmap, bets, bitmap_hash=bm_hash)
        risk.record_join(batch_id, deposit_wei)

    # Re-submit bitmaps for all active positions (survives oracle restarts)
    player_for_bitmap = vault_executor.vault_addr if vault_mode else executor.bot_addr
    for bid in list(tracker.active_ids):
        pos = tracker.positions.get(bid)
        if not pos or not pos.get("bitmap") or pos.get("poisoned"):
            continue
        bm = pos["bitmap"]
        bm_hash = pos.get("bitmap_hash") or hash_bitmap(bm)
        pos["bitmap_hash"] = bm_hash
        submit_bitmap(
            oracle_urls, player_for_bitmap, bid,
            bm, bm_hash, retries=1,
        )

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

    # Run
    if "--once" in sys.argv:
        run_cycle(cfg, executor, tracker, strategy, risk, oracle_urls_fn, feed, vault_executor)
        feed.close()
        return

    try:
        while True:
            try:
                run_cycle(cfg, executor, tracker, strategy, risk, oracle_urls_fn, feed, vault_executor)
            except Exception as e:
                log.error("Cycle error: %s", e)
            time.sleep(cfg["poll_interval"])
    except KeyboardInterrupt:
        log.info("Shutting down...")
    finally:
        feed.close()


if __name__ == "__main__":
    main()
