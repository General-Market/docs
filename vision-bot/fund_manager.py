#!/usr/bin/env python3
"""Fund Manager — one bot, many vaults, source-specific strategies."""

from __future__ import annotations

import json
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from framework.core import encode_bitmap, hash_bitmap, load_strategy
from framework.chain import (
    BatchNotFoundError,
    BitmapSubmitError,
    Executor,
    VaultExecutor,
    discover_oracles,
    fetch_batch_config,
    fetch_batches,
    fetch_markets,
    submit_bitmap,
)
from framework.bitmap_store import drop_bitmap, load_bitmap, save_bitmap
from framework.feed import VisionFeed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("fund-manager")
DECIMALS = 18
# Mirror of Vision.MIN_STAKE_PER_TICK — joins below this revert.
MIN_DEPOSIT_WEI = 10**17  # 0.1 USDC
# Mirror of VisionVault.MAX_BATCH_BPS — anything above this reverts.
MAX_BATCH_BPS = 500  # 5% of totalAssets per batch

STATE_FILE = os.environ.get("STATE_FILE", "/app/pnl-data/fund-manager-state.json")
VISION_DB_URL = os.environ.get("VISION_DB_URL", "")
SNAPSHOT_INTERVAL = 1  # write snapshots every cycle. At poll_interval=30s
# that's a snapshot per vault per 30s — 183 inserts per cycle, ~6/s, well
# within postgres throughput. Higher resolution gives the NAV chart enough
# points to draw a real trading line within minutes of deploy. Previous
# values (10 cycles = 5 min) made fresh vaults look frozen.

# Auto-seed config — turns vaults that have zero idle capital (because nobody
# has deposited) into real participants by depositing a small float from the
# manager EOA. Feature-gated; default off because it's the manager's money.
#   AUTO_SEED_USDC=5            seed each empty vault with 5 USDC
#   AUTO_SEED_BUDGET_USDC=50    abort once total seeded across funds hits 50
#   AUTO_SEED_MAX_ATTEMPTS=2    give up on a fund after this many failed seeds
AUTO_SEED_USDC = float(os.environ.get("AUTO_SEED_USDC", "0"))
AUTO_SEED_BUDGET_USDC = float(os.environ.get("AUTO_SEED_BUDGET_USDC", "50"))
AUTO_SEED_MAX_ATTEMPTS = int(os.environ.get("AUTO_SEED_MAX_ATTEMPTS", "2"))


def _wait_for_join(executor, batch_id: int, player: str, timeout: float = 10.0) -> bool:
    """Poll on-chain getPosition until the join is visible.

    The bitmap submission below races the oracle's view of PlayerJoined.
    Without this gate, oracles return "Player not found" for the first ~1s
    after a successful join tx, the two-shot retry exhausts before quorum,
    and the vault sits joined-but-unbacked-on-bitmap forever.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            pos = executor.get_player_position(batch_id, player)
            if pos.get("joinTimestamp", 0) > 0:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


# ── Config ─────────────────────────────────────────────────────


def load_funds_config(path="funds.toml"):
    try:
        import tomllib
    except ImportError:
        import tomli as tomllib  # type: ignore[no-redef]
    with open(path, "rb") as f:
        return tomllib.load(f)


def _load_source_aliases(path: str = "source-aliases.json") -> dict[str, list[str]]:
    """Load alias map: canonical fund.source -> list of legacy names.

    Lets operators map old batch names to renamed sources without redeploying.
    Missing file = empty dict, which is fine — fund-manager still hashes the
    canonical names. Any fund.source without a legacy alias still works via
    the straight keccak(name_vN) path.

    JSON schema:
        {
          "aliases": {
            "defillama": ["defi"],
            "treasury": ["bonds"],
            "gtfs_rt":   ["gtfs_transit"]
          }
        }
    """
    import os

    search_paths = [
        path,
        os.path.join(os.path.dirname(__file__), path),
        "/app/" + path,
    ]
    for p in search_paths:
        try:
            with open(p) as f:
                import json as _json
                data = _json.load(f)
                return {k: list(v) for k, v in data.get("aliases", {}).items()}
        except (FileNotFoundError, PermissionError):
            continue
        except Exception as e:
            log.warning("source-aliases.json unreadable at %s: %s", p, e)
            return {}
    return {}


def build_source_id_map(fund_sources):
    """Build keccak256(source_name_vN) -> canonical fund source.

    On-chain sourceId = keccak256(name + "_v2") (or _v1, etc.). We hash every
    plausible version for every canonical source, plus every known legacy
    alias (from source-aliases.json), so batches registered under an older
    naming scheme still resolve to the canonical fund source. This is what
    makes a renamed source (defi -> defillama) keep trading without forcing
    a batch redeploy.
    """
    from web3 import Web3

    aliases = _load_source_aliases()
    mapping: dict[str, str] = {}

    def _add(name_for_hashing: str, canonical: str) -> None:
        for version in ["v1", "v2", "v3", "v4"]:
            h = Web3.keccak(text=f"{name_for_hashing}_{version}").hex()
            h = h if h.startswith("0x") else "0x" + h
            mapping[h] = canonical
        # Plain hash fallback (no version suffix).
        h = Web3.keccak(text=name_for_hashing).hex()
        h = h if h.startswith("0x") else "0x" + h
        mapping[h] = canonical

    for canonical in fund_sources:
        _add(canonical, canonical)
        for legacy in aliases.get(canonical, []):
            _add(legacy, canonical)

    if aliases:
        log.info(
            "source_id_map: %d hash entries (%d canonical + %d aliases)",
            len(mapping), len(fund_sources), sum(len(v) for v in aliases.values()),
        )
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
        # Per-fund allocation multiplier. Multiplies the manager-level
        # allocation_bps. Default 1.0 — vaults that should bet more (e.g.
        # daily-tick vaults that get one shot per day) override this.
        try:
            self.allocation_multiplier = float(fund_cfg.get("allocation_multiplier", 1.0))
        except (TypeError, ValueError):
            self.allocation_multiplier = 1.0
        self.active_batches: dict[int, int] = {}   # batch_id -> deposit_wei
        self.joined_batch_ids: set[int] = set()
        self.joined_total: int = 0
        self.reconciled_total: int = 0
        self.reconcile_retries: dict[int, int] = {}  # batch_id -> failure count
        # Static vault metadata, read once at startup and cached forever.
        self.static_meta: dict = {}
        # Per-cycle pending join total (wei). The cycle loop tracks how much
        # idle balance has already been earmarked so two batches in the same
        # cycle don't both pass has_idle() against the same balance.
        self._pending_join_amount: int = 0
        # Map of batch_id -> block number at which the join was sent.
        # Used as the from_block when reading PlayerSettled events so we
        # don't scan the entire chain or miss the event.
        self.join_blocks: dict[int, int] = {}
        # Auto-seed bookkeeping. Counts attempts (success or failure) so a
        # broken vault doesn't get hammered every cycle.
        self._seed_attempts: int = 0

    def matches_source(self, source_name):
        if not self.sources:
            return True  # empty = trade all
        return source_name in self.sources


# ── State persistence ──────────────────────────────────────────


def _atomic_write_json(path: str, payload: dict) -> None:
    """Atomic JSON write: tmp file + fsync + os.replace.

    A bot that runs for months will eventually be killed mid-write. The
    half-flushed JSON it leaves behind is then unparseable on the next
    boot, and we lose all batch tracking. Atomic replace removes that
    failure mode entirely.
    """
    tmp = path + ".tmp"
    parent = os.path.dirname(path) or "."
    os.makedirs(parent, exist_ok=True)
    with open(tmp, "w") as f:
        json.dump(payload, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def save_state(funds, vault_info_cache=None, state_file=STATE_FILE):
    """Persist fund state atomically.

    ``vault_info_cache`` (optional): per-cycle dict[fund.name] -> info, so
    we don't re-issue 9 RPC reads per fund just to write a snapshot.
    """
    state = {
        "last_cycle": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "funds": {},
    }
    for fund in funds:
        info = None
        if vault_info_cache is not None:
            info = vault_info_cache.get(fund.name)
        if info is None:
            try:
                info = fund.vault.get_vault_info()
            except Exception:
                info = {}
        total_assets = info.get("total_assets", 0) if info else 0
        total_supply = max(info.get("total_supply", 1) if info else 1, 1)
        nav = (total_assets / total_supply) if total_supply else 0.0

        # Persist active_batches as full {batch_id_str: deposit_wei_str}
        # so deposit values survive restarts. JSON can't key by int, so
        # we coerce to string here and back to int on load.
        active_batches_serialized = {
            str(bid): str(dep) for bid, dep in fund.active_batches.items()
        }
        reconcile_retries_serialized = {
            str(bid): n for bid, n in fund.reconcile_retries.items()
        }
        join_blocks_serialized = {
            str(bid): blk for bid, blk in fund.join_blocks.items()
        }

        state["funds"][fund.name] = {
            "vault": fund.vault_addr,
            "active_batches": active_batches_serialized,
            "reconcile_retries": reconcile_retries_serialized,
            "join_blocks": join_blocks_serialized,
            "joined_total": fund.joined_total,
            "reconciled_total": fund.reconciled_total,
            "total_assets_usdc": round(total_assets / 1e18, 4),
            "nav": round(nav, 6),
        }
    try:
        _atomic_write_json(state_file, state)
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

        raw_active = fund_state.get("active_batches", {})
        # Backward-compat: old state files stored a list of ids without
        # deposits. Coerce both shapes into the int->int dict we want.
        if isinstance(raw_active, list):
            for bid in raw_active:
                try:
                    bid_int = int(bid)
                except (TypeError, ValueError):
                    continue
                fund.active_batches[bid_int] = 0
                fund.joined_batch_ids.add(bid_int)
        elif isinstance(raw_active, dict):
            for bid_str, dep in raw_active.items():
                try:
                    bid_int = int(bid_str)
                    dep_int = int(dep) if dep is not None else 0
                except (TypeError, ValueError):
                    continue
                fund.active_batches[bid_int] = dep_int
                fund.joined_batch_ids.add(bid_int)

        raw_retries = fund_state.get("reconcile_retries", {}) or {}
        for bid_str, n in raw_retries.items():
            try:
                fund.reconcile_retries[int(bid_str)] = int(n)
            except (TypeError, ValueError):
                continue

        raw_blocks = fund_state.get("join_blocks", {}) or {}
        for bid_str, blk in raw_blocks.items():
            try:
                fund.join_blocks[int(bid_str)] = int(blk)
            except (TypeError, ValueError):
                continue

        fund.joined_total = fund_state.get("joined_total", 0)
        fund.reconciled_total = fund_state.get("reconciled_total", 0)
        log.info(
            "[%s] Resumed: %d active batches, %d joined total",
            fund.name,
            len(fund.active_batches),
            fund.joined_total,
        )


def bootstrap_joined_from_chain(funds, executor):
    """Seed joined_batch_ids / active_batches from the data-node DB on startup.

    The persisted state file is incomplete after any unclean shutdown — the
    bot then rediscovers its own joins one AlreadyJoined() revert at a time.
    The data-node indexes every BatchJoined event into vision_positions;
    join against vision_batches to keep only batches still active on chain
    (settled rounds have balance>0 rows for pending withdrawals but joining
    is no longer a valid action). The per-cycle pre-check still re-verifies
    each batch on chain before any join tx, so a slightly stale DB is safe.

    Falls back gracefully: no DB URL, no DB connection, or DB error → log
    and return. The bot still works without this; bootstrap just stops the
    thundering herd of reverts on first cycle.
    """
    if not VISION_DB_URL:
        log.info("Chain-bootstrap: VISION_DB_URL not set — skipping")
        return
    try:
        import psycopg2
    except Exception as e:
        log.warning("Chain-bootstrap: psycopg2 import failed: %s", e)
        return

    # Index fund vaults by lower-cased address so we can demultiplex one
    # bulk query result. Per-fund queries are ~3s each cold → 20 min for
    # 421 funds; one query with player = ANY(%s) is a few hundred ms.
    fund_by_addr = {f.vault_addr.lower(): f for f in funds}
    addrs = list(fund_by_addr.keys())
    if not addrs:
        return

    seeded_total = 0
    seeded_funds = 0
    try:
        with psycopg2.connect(VISION_DB_URL, connect_timeout=10) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT LOWER(vp.player), vp.batch_id, vp.total_deposited::text "
                    "FROM vision_positions vp "
                    "JOIN vision_batches vb ON vb.id = vp.batch_id "
                    "WHERE LOWER(vp.player) = ANY(%s) "
                    "  AND vp.balance > 0 "
                    "  AND vb.state = 'active'",
                    (addrs,),
                )
                rows = cur.fetchall()
    except Exception as e:
        log.warning("Chain-bootstrap: postgres query failed: %s", e)
        return

    per_fund_seeded: dict[str, int] = {}
    for player_lower, bid_raw, dep_raw in rows:
        fund = fund_by_addr.get(player_lower)
        if fund is None:
            continue
        bid = int(bid_raw)
        if bid in fund.joined_batch_ids:
            continue
        fund.joined_batch_ids.add(bid)
        fund.active_batches.setdefault(bid, int(dep_raw or 0))
        per_fund_seeded[fund.name] = per_fund_seeded.get(fund.name, 0) + 1
        seeded_total += 1

    for name, n in sorted(per_fund_seeded.items()):
        log.info("[%s] Chain-bootstrap: seeded %d joined batches from DB", name, n)
        seeded_funds += 1

    log.info("Chain-bootstrap complete: %d batches seeded across %d funds",
             seeded_total, seeded_funds)


# ── Reconciliation ─────────────────────────────────────────────


def _remove_from_active(fund, bid: int) -> None:
    """Drop a batch from all tracking structures. Idempotent."""
    fund.active_batches.pop(bid, None)
    fund.joined_batch_ids.discard(bid)
    fund.reconcile_retries.pop(bid, None)
    fund.join_blocks.pop(bid, None)
    # Prune the bitmap so the on-disk store doesn't accrete one entry per
    # batch forever. Settled batches will never be revealed again.
    try:
        drop_bitmap(fund.vault_addr, bid)
    except Exception:
        pass


def reconcile_settled_batches(fund, executor):
    """Check all tracked batches and reconcile any that have settled on-chain."""
    # Read latest block once per call so the from_block fallback for
    # get_settlement_payout doesn't issue an extra RPC per batch.
    try:
        latest_block = executor.w3.eth.block_number
    except Exception:
        latest_block = 0

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
                _remove_from_active(fund, bid)
            continue

        # Only reconcile batches that Vision has actually settled.
        if not batch_info.get("settled", False):
            continue

        # Verify vault still has an active deposit to reconcile.
        try:
            dep = fund.vault.get_active_deposit(bid)
        except Exception:
            continue
        if dep == 0:
            log.info("[%s] Batch %d already reconciled — clearing", fund.name, bid)
            _remove_from_active(fund, bid)
            continue

        # Fetch settlement payout from PlayerSettled event for accurate PnL.
        # The new chain.py refuses to scan from block 0; pass either the join
        # block (if we tracked it) or a sensible recent window.
        from_block = fund.join_blocks.get(bid)
        if from_block is None:
            from_block = max(0, latest_block - 100_000) if latest_block else None
        payout = 0
        try:
            payout = executor.get_settlement_payout(bid, fund.vault_addr, from_block=from_block)
        except Exception as e:
            log.debug("[%s] Could not read payout for batch %d: %s", fund.name, bid, e)

        # Settled on-chain, vault has active deposit — reconcile now.
        try:
            fund.vault.reconcile(bid, payout)
            deposited = fund.active_batches.get(bid, 0)
            pnl = (payout - deposited) / 1e18 if deposited else 0
            log.info(
                "[%s] Reconciled batch %d — payout=%.4f deposited=%.4f pnl=%.4f",
                fund.name, bid, payout / 1e18, deposited / 1e18, pnl,
            )
            fund.reconciled_total += 1
            _remove_from_active(fund, bid)
            continue
        except Exception as e:
            err = str(e)
            # 0x4c03a47b = BatchAlreadyReconciled()
            if "BatchAlreadyReconciled" in err or "4c03a47b" in err:
                log.info("[%s] Batch %d already reconciled — clearing", fund.name, bid)
                fund.reconciled_total += 1
                _remove_from_active(fund, bid)
                continue

            retries = fund.reconcile_retries.get(bid, 0) + 1
            fund.reconcile_retries[bid] = retries
            if retries >= MAX_RECONCILE_RETRIES:
                log.warning(
                    "[%s] Evicting batch %d after %d failed reconcile attempts: %s",
                    fund.name, bid, retries, e,
                )
                _remove_from_active(fund, bid)
                continue

            log.warning(
                "[%s] Reconcile %d failed (attempt %d/%d): %s",
                fund.name, bid, retries, MAX_RECONCILE_RETRIES, e,
            )
            # Leave in active_batches, retry next cycle.
            continue


# ── NAV table ──────────────────────────────────────────────────


def log_nav_table(funds, vault_info_cache=None):
    """Log a compact NAV summary across all vaults.

    ``vault_info_cache`` (optional): per-cycle dict[fund.name] -> info, so
    we don't trigger another wave of reads when a cycle just finished.
    """
    lines = ["NAV summary:"]
    for fund in funds:
        info = None
        if vault_info_cache is not None:
            info = vault_info_cache.get(fund.name)
        if info is None:
            try:
                info = fund.vault.get_vault_info()
            except Exception as e:
                lines.append("  %-20s  (read error: %s)" % (fund.name, e))
                continue
        try:
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
            lines.append("  %-20s  (format error: %s)" % (fund.name, e))
    log.info("\n".join(lines))


# ── Vault snapshots ───────────────────────────────────────────


def write_vault_snapshots(funds, vault_info_cache=None):
    """Write NAV snapshots to oracle postgres for historical charts.

    Uses the per-cycle cache when available so 183 funds × 9 RPC reads
    don't fire a second time just to write a row to postgres.
    """
    if not VISION_DB_URL:
        return
    try:
        import psycopg2
    except Exception as e:
        log.warning("psycopg2 import failed: %s", e)
        return
    try:
        with psycopg2.connect(VISION_DB_URL) as conn:
            with conn.cursor() as cur:
                rows = 0
                for fund in funds:
                    info = None
                    if vault_info_cache is not None:
                        info = vault_info_cache.get(fund.name)
                    if info is None:
                        try:
                            info = fund.vault.get_vault_info()
                        except Exception:
                            continue
                    try:
                        total_assets = info.get("total_assets", 0)
                        total_supply = info.get("total_supply", 0)
                        # NAV is a float in USDC. Both totalAssets and totalSupply
                        # are 18-decimal wei integers, so the ratio is unitless.
                        # If totalSupply is zero (no shares minted yet) NAV is
                        # undefined — write 1.0 as the canonical genesis value
                        # rather than dividing by 1 wei and storing 1e22.
                        if total_supply > 0:
                            nav = total_assets / total_supply
                        else:
                            nav = 1.0
                        tvl = total_assets / 1e18
                        cur.execute(
                            "INSERT INTO vault_snapshots "
                            "(vault_address, total_assets, total_supply, nav_per_share, tvl_usd) "
                            "VALUES (%s, %s, %s, %s, %s)",
                            (
                                fund.vault_addr.lower(),
                                str(total_assets),
                                str(total_supply),
                                nav,
                                tvl,
                            ),
                        )
                        rows += 1
                    except Exception:
                        continue
                log.info("Vault snapshots: %d rows written", rows)
    except Exception as e:
        log.warning("Vault snapshot write failed: %s", e)


# ── Heartbeat ──────────────────────────────────────────────────


def _heartbeat_path() -> str:
    return os.environ.get("HEARTBEAT_FILE", "/app/pnl-data/heartbeat.json")


def _write_heartbeat(updates: dict) -> None:
    """Read-modify-write the heartbeat file with atomic rename.

    Preserves prior fields (notably ``source_match``) so that liveness
    pings written mid-cycle don't blank out the last good cycle summary
    and trip the Docker HEALTHCHECK assert. Atomic rename also avoids
    EACCES when the existing file was created by a different uid (a
    classic bind-mount rot pattern).
    """
    path = _heartbeat_path()
    payload: dict = {}
    try:
        with open(path) as hb:
            payload = json.load(hb) or {}
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    except Exception as e:
        log.debug("Heartbeat read failed (will overwrite): %s", e)
    payload.update(updates)
    tmp = path + ".tmp"
    try:
        with open(tmp, "w") as hb:
            json.dump(payload, hb)
        os.replace(tmp, path)
    except Exception as e:
        log.warning("Heartbeat write failed: %s", e)
        try:
            os.unlink(tmp)
        except OSError:
            pass


# ── Main cycle ─────────────────────────────────────────────────


def _maybe_seed_empty_vault(fund, cache: dict, executor, seed_state: dict) -> bool:
    """Seed an empty vault from the manager EOA so it can start participating.

    Only fires when AUTO_SEED_USDC > 0 and the vault has zero deposited capital.
    Respects a global per-process budget so the manager doesn't get drained.
    Returns True if a seed deposit landed and the cache was refreshed.
    """
    if AUTO_SEED_USDC <= 0:
        return False
    if fund._seed_attempts >= AUTO_SEED_MAX_ATTEMPTS:
        return False

    info = _read_vault_info_cached(fund, cache)
    if info is None:
        return False
    # Only seed truly empty vaults — never top up a vault that has any user
    # capital, idle or active. The seed is for cold starts, not maintenance.
    if info.get("total_assets", 0) > 0 or info.get("idle_usdc", 0) > 0:
        return False

    seed_wei = int(AUTO_SEED_USDC * 10**18)
    spent_so_far = seed_state.get("spent_wei", 0)
    budget_wei = int(AUTO_SEED_BUDGET_USDC * 10**18)
    if spent_so_far + seed_wei > budget_wei:
        log.warning(
            "[%s] Skipping seed — would exceed AUTO_SEED_BUDGET_USDC (%.2f spent, %.2f cap)",
            fund.name, spent_so_far / 1e18, AUTO_SEED_BUDGET_USDC,
        )
        return False

    # Confirm the manager actually has the USDC before attempting the deposit.
    try:
        bot_balance = executor.usdc.functions.balanceOf(executor.bot_addr).call()
    except Exception as e:
        log.warning("[%s] Could not read manager USDC balance: %s", fund.name, e)
        return False
    if bot_balance < seed_wei:
        log.warning(
            "[%s] Manager has %.4f USDC, need %.4f to seed — top up the manager EOA",
            fund.name, bot_balance / 1e18, AUTO_SEED_USDC,
        )
        fund._seed_attempts += 1
        return False

    fund._seed_attempts += 1
    log.info(
        "[%s] Seeding empty vault %s with %.2f USDC from manager",
        fund.name, fund.vault_addr, AUTO_SEED_USDC,
    )
    try:
        fund.vault.deposit_to_vault(seed_wei)
    except Exception as e:
        log.error("[%s] Vault seed failed: %s", fund.name, e)
        return False

    seed_state["spent_wei"] = spent_so_far + seed_wei
    # Drop the stale cache entry so the next read sees the real post-seed balances.
    cache.pop(fund.name, None)
    return True


def _read_vault_info_cached(fund, cache: dict) -> dict | None:
    """Read vault info once per cycle. Subsequent calls return the cached copy.

    Returns None on failure so callers can decide whether to skip or default.
    Negative cache: once a read fails for a fund this cycle, we don't retry.
    """
    if fund.name in cache:
        return cache[fund.name]
    try:
        info = fund.vault.get_vault_info()
    except Exception as e:
        log.debug("[%s] vault info read failed: %s", fund.name, e)
        cache[fund.name] = None  # negative cache for the rest of the cycle
        return None
    cache[fund.name] = info
    return info


def run_cycle(
    funds,
    executor,
    oracle_urls,
    feed,
    cfg,
    source_id_map,
    cycle_number=0,
    feed_subscriptions: set | None = None,
):
    """One cycle: join new batches per fund, reconcile settled ones.

    ``feed_subscriptions``: caller-owned set of currently-subscribed batch IDs
    (as strings). The cycle adds to it on subscribe and prunes stale entries
    against active_batches at the start. Passing None disables tracking.
    """
    # Per-cycle vault info cache. Each fund's get_vault_info issues 9 RPC
    # reads — calling it 3+ times per fund × 183 funds gobbles minutes per
    # cycle. Read each fund once, share the result downstream.
    vault_info_cache: dict[str, dict | None] = {}

    # Reset per-fund pending join counters at the top of every cycle.
    for fund in funds:
        fund._pending_join_amount = 0

    # Optional auto-seed pass: deposit a small float from the manager into
    # any vault that has zero capital, so empty-vault sources (no user has
    # deposited yet) can start playing. Disabled unless AUTO_SEED_USDC > 0.
    if AUTO_SEED_USDC > 0:
        seed_state = {"spent_wei": 0}
        for fund in funds:
            _maybe_seed_empty_vault(fund, vault_info_cache, executor, seed_state)
        if seed_state["spent_wei"] > 0:
            log.info(
                "Auto-seed: deposited %.2f USDC across vaults this cycle",
                seed_state["spent_wei"] / 1e18,
            )

    all_batches = fetch_batches(cfg["vision_api"], executor=executor)
    # Filter: only batches with known market count (skip legacy batches without config)
    batches = [b for b in all_batches if b.get("market_count", 0) > 0]
    if not batches:
        # Fallback: try all batches (market count will be resolved from data-node)
        batches = all_batches

    # Build the set of batches we still care about, and unsubscribe any
    # feed entries that no longer correspond to a tracked batch.
    if feed_subscriptions is not None:
        needed = set()
        for fund in funds:
            for bid in fund.active_batches:
                needed.add(str(bid))
        stale = feed_subscriptions - needed
        if stale:
            try:
                feed.unsubscribe(list(stale))
            except Exception as e:
                log.warning("Feed unsubscribe failed: %s", e)
            feed_subscriptions -= stale

    # Risk management: bet alloc_bps of vault assets per batch.
    # One amount per join — the two-number accounting that orphaned capital
    # in the contract is gone.
    alloc_bps = int(cfg.get("allocation_bps", 500))  # 500 = 5%

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

        matched_funds = [
            f for f in funds
            if f.matches_source(source_name) and batch_id not in f.joined_batch_ids
        ]
        if matched_funds:
            matched_any_source = True
        else:
            continue

        # Filter by idle capital — each fund bets alloc_bps% of its total assets,
        # scaled by the per-fund allocation_multiplier (1.0 by default), floored
        # at MIN_DEPOSIT_WEI so the contract doesn't reject the deposit.
        # Use the per-cycle cached info AND subtract any joins already queued
        # in the same cycle so two batches don't double-spend the same balance.
        def has_idle(f):
            info = _read_vault_info_cached(f, vault_info_cache)
            if not info:
                return False
            idle = info.get("idle_usdc", 0) - f._pending_join_amount
            total = info.get("total_assets", 0)
            effective_bps = min(int(alloc_bps * f.allocation_multiplier), MAX_BATCH_BPS)
            deposit = max((total * effective_bps) // 10000, MIN_DEPOSIT_WEI)
            return idle >= deposit

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

        # Get prices ONCE per batch. Subscribe lazily and remember.
        bid_str = str(batch_id)
        if feed_subscriptions is None or bid_str not in feed_subscriptions:
            try:
                feed.subscribe([bid_str])
                if feed_subscriptions is not None:
                    feed_subscriptions.add(bid_str)
            except Exception as e:
                log.warning("Feed subscribe failed for %s: %s", bid_str, e)
        raw_prices = feed.prices(bid_str)
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

        log.info(
            "Batch %d source=%s: %d funds, %d markets",
            batch_id, source_name, len(matched_funds), market_count,
        )

        # Per-fund: predict, join, submit bitmap
        for fund in matched_funds:
            # Persisted bitmap is authoritative. If we have one on disk for
            # this (vault, batch_id) — from an earlier cycle, an earlier
            # process, anything — reuse it verbatim. Recomputing from a
            # fresh predict() is how the on-chain commitment and the bytes
            # we reveal drift apart and every oracle returns 400.
            cached = load_bitmap(fund.vault_addr, batch_id)
            if cached is not None:
                bitmap, bm_hash = cached
                bets = None  # decoded counts would be cosmetic; skip
            else:
                # Strategy predict — each fund has its own strategy
                if hasattr(fund.strategy, "predict_with_context"):
                    bets = fund.strategy.predict_with_context(
                        markets, feed=feed, batch_id=bid_str,
                    )
                else:
                    bets = fund.strategy.predict(markets)

                # If a strategy under-delivers, that's a bug in the strategy —
                # don't paper over it with random coin flips. Pad with DOWN as
                # a deterministic placeholder and shout about it.
                if len(bets) < market_count:
                    log.warning(
                        "[%s] Strategy %s returned %d bets for batch %d (expected %d) — padding with DOWN",
                        fund.name,
                        type(fund.strategy).__name__,
                        len(bets),
                        batch_id,
                        market_count,
                    )
                    bets = list(bets) + ["DOWN"] * (market_count - len(bets))

                bitmap = encode_bitmap(bets, market_count)
                bm_hash = hash_bitmap(bitmap)

            # Compute deposit: alloc_bps × per-fund multiplier of current total
            # assets, floored at the contract minimum. Reuse the cached info —
            # no extra RPC roundtrip.
            info = _read_vault_info_cached(fund, vault_info_cache)
            if not info:
                continue
            total = info.get("total_assets", 0)
            effective_bps = min(int(alloc_bps * fund.allocation_multiplier), MAX_BATCH_BPS)
            deposit_wei = max((total * effective_bps) // 10000, MIN_DEPOSIT_WEI)
            if deposit_wei <= 0:
                continue
            log.info(
                "[%s] sizing batch %d: total=%.2f USDC bps=%d (mult=%.2f) → deposit=%.4f USDC",
                fund.name, batch_id, total / 1e18, effective_bps,
                fund.allocation_multiplier, deposit_wei / 1e18,
            )

            # Pre-check on chain. In-memory joined_batch_ids drifts on
            # restart and after reconcile races; without this guard we burn
            # a tx and a nonce on a guaranteed AlreadyJoined() revert.
            #
            # Three outcomes from get_player_position:
            #   1. returns dict, joinTimestamp > 0  → already joined, skip
            #   2. returns dict, joinTimestamp == 0 → not joined, proceed
            #   3. raises BatchNotFoundError        → batch not on chain yet,
            #      skip this cycle and try again later
            #   4. raises anything else (RPC hiccup, decode error, etc.)
            #      → we DON'T KNOW. Skip. Assuming "not joined" and falling
            #      through is what burned 150+ AlreadyJoined() reverts per
            #      10 minutes during the 2026-05-15 sequencer trouble.
            already_joined = False
            try:
                existing = executor.get_player_position(batch_id, fund.vault_addr)
            except BatchNotFoundError:
                # Chain hasn't surfaced this batch yet. Try next cycle.
                continue
            except Exception as e:
                log.warning(
                    "[%s] get_player_position(batch=%d) failed: %s — skipping this cycle",
                    fund.name, batch_id, e,
                )
                continue

            if existing.get("joinTimestamp", 0) > 0:
                fund.joined_batch_ids.add(batch_id)
                fund.active_batches.setdefault(
                    batch_id, existing.get("totalDeposited", deposit_wei),
                )
                already_joined = True

            if not already_joined:
                # Join via vault. _sign_and_send waits for the receipt — by the
                # time we return here, the tx is mined.
                try:
                    fund.vault.join_batch(
                        batch_id, config_hash, deposit_wei, bm_hash,
                    )
                    # Persist ONLY after a successful commit. Saving before
                    # the join would poison the store with bytes whose hash
                    # does not match any on-chain commitment — exactly the
                    # failure mode we are trying to extinguish.
                    if cached is None:
                        save_bitmap(fund.vault_addr, batch_id, bitmap, bm_hash)
                    fund.joined_batch_ids.add(batch_id)
                    fund.active_batches[batch_id] = deposit_wei
                    fund.joined_total += 1
                    joined_this_cycle += 1
                    # Earmark capital so subsequent batches in the same cycle
                    # see the reduced effective idle balance.
                    fund._pending_join_amount += deposit_wei
                    # Track the join block so reconciliation can pass a precise
                    # from_block to get_settlement_payout instead of scanning
                    # the entire chain.
                    try:
                        fund.join_blocks[batch_id] = executor.w3.eth.block_number
                    except Exception:
                        pass
                    up_count = bets.count("UP") if bets is not None else -1
                    down_count = bets.count("DOWN") if bets is not None else -1
                    log.info(
                        "[%s] Joined batch %d (%s) — %d markets, %d UP / %d DOWN",
                        fund.name, batch_id, source_name, market_count,
                        up_count, down_count,
                    )
                except Exception as e:
                    log.warning("[%s] Batch %d join failed: %s", fund.name, batch_id, e)
                    continue
            elif cached is not None:
                log.debug(
                    "[%s] Batch %d already joined on-chain — resubmitting cached bitmap",
                    fund.name, batch_id,
                )
            else:
                # Joined by an earlier process that didn't persist its bitmap.
                # We can't reconstruct what was committed; submitting a fresh
                # bitmap would just hash-mismatch again. Skip.
                log.debug(
                    "[%s] Batch %d joined pre-fix without a saved bitmap — skipping submit",
                    fund.name, batch_id,
                )
                continue

            # Wait until the oracle can see the PlayerJoined event before
            # we POST the bitmap. Otherwise the first wave of submissions
            # all 404 with "Player not found" and the two-shot retry runs
            # out before quorum, leaving the vault joined-but-bitmap-less.
            if not _wait_for_join(executor, batch_id, fund.vault_addr, timeout=10):
                log.warning(
                    "[%s] Batch %d join not visible on-chain after 10s — "
                    "submitting bitmap anyway, retry path is the safety net",
                    fund.name, batch_id,
                )

            # Submit bitmap to oracles. BitmapSubmitError is the typed quorum
            # failure from the new chain.py — log it and move on rather than
            # crashing the cycle.
            try:
                submit_bitmap(
                    oracle_urls, fund.vault_addr, batch_id,
                    bitmap, bm_hash, retries=5,
                )
            except BitmapSubmitError as e:
                log.warning(
                    "[%s] Batch %d bitmap quorum failed (%d/%d): %s",
                    fund.name, batch_id, e.accepted, e.total, e.last_error,
                )
            except Exception as e:
                log.warning(
                    "[%s] Batch %d bitmap submit failed: %s",
                    fund.name, batch_id, e,
                )

    # Reconcile settled batches
    for fund in funds:
        reconcile_settled_batches(fund, executor)

        # Log per-fund vault state from the per-cycle cache. If the cache
        # has no entry (fund had no batches matched this cycle), we accept
        # one read here — that's still O(funds), not O(funds × batches).
        info = _read_vault_info_cached(fund, vault_info_cache)
        if info:
            try:
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
        log_nav_table(funds, vault_info_cache=vault_info_cache)
        write_vault_snapshots(funds, vault_info_cache=vault_info_cache)

    # Health summary — detect silent failures
    log.info(
        "Cycle %d: %d joined, source_match=%s",
        cycle_number, joined_this_cycle, matched_any_source,
    )
    if len(batches) > 0 and not matched_any_source:
        log.error(
            "HEALTH ALERT: %d batches processed, ZERO source matches. "
            "Source matching is broken — no funds will ever join. "
            "Check batch API source_id format vs fund sources in funds.toml.",
            len(batches),
        )

    _write_heartbeat({
        "cycle": cycle_number,
        "ts": time.time(),
        "joined": joined_this_cycle,
        "source_match": matched_any_source,
        "batches": len(batches),
        "phase": "complete",
    })

    # Persist state at the end of the cycle, reusing the cache so we don't
    # fire another wave of vault reads.
    try:
        save_state(funds, vault_info_cache=vault_info_cache)
    except Exception as e:
        log.warning("End-of-cycle save_state failed: %s", e)

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
        "rpc_url", os.environ.get("L3_RPC_URL", "https://rpc.generalmarket.io/"),
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

    # Cache static vault metadata once. name/manager/perf_fee_rate never
    # change after deployment — re-reading them every cycle would be a
    # ritual paid for in nine RPC roundtrips per fund per cycle.
    for fund in funds:
        try:
            info = fund.vault.get_vault_info()
            fund.static_meta = {
                "name": info.get("name"),
                "manager": info.get("manager"),
                "perf_fee_rate": info.get("perf_fee_rate"),
            }
        except Exception as e:
            log.warning("[%s] Could not read static metadata: %s", fund.name, e)

    # Build source name → sourceId (keccak256) reverse map
    all_source_names = set()
    for fund in funds:
        all_source_names.update(fund.sources)
    source_id_map = build_source_id_map(all_source_names)
    log.info("Source ID map: %d sources → keccak256 hashes", len(source_id_map) // 2)

    # Oracle discovery
    oracle_urls_raw = manager_cfg.get("oracle_urls", [])
    oracle_discovery = manager_cfg.get("oracle_discovery", "static")
    oracle_registry_addr = manager_cfg.get("oracle_registry_address", "")

    def oracle_urls_fn():
        if oracle_discovery == "dynamic":
            return discover_oracles(
                "dynamic", oracle_urls_raw, executor.w3, registry_addr=oracle_registry_addr,
            )
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

    # Rebuild joined_batch_ids from chain truth. The persisted state file
    # is whatever the last graceful shutdown wrote; the bot would otherwise
    # rediscover its own joins one AlreadyJoined() revert at a time.
    try:
        bootstrap_joined_from_chain(funds, executor)
    except Exception as e:
        log.warning("Chain-bootstrap raised — continuing without it: %s", e)

    # Caller-owned tracking set so run_cycle can unsubscribe stale entries
    # without re-asking the feed for its private state.
    feed_subscriptions: set[str] = set()
    all_known_batch_ids = set()
    for fund in funds:
        all_known_batch_ids.update(str(bid) for bid in fund.active_batches)
    if all_known_batch_ids:
        feed.subscribe(list(all_known_batch_ids))
        feed_subscriptions.update(all_known_batch_ids)
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
            log.info(
                "Startup self-test: %d/%d sampled batches match funds",
                test_matched, min(20, len(test_batches)),
            )
    except SystemExit:
        raise
    except Exception as e:
        log.warning("Startup self-test skipped (API unavailable): %s", e)

    log.info("Fund Manager started: %d funds", len(funds))

    # Signal-driven shutdown. The handler MUST NOT do I/O — Python signal
    # handlers run on whichever thread happens to be holding the GIL when
    # the signal arrives, and a save_state() call here can deadlock against
    # any lock the main thread is already holding (psycopg2, web3, json).
    # Set a flag, return, let the main loop notice it at a safe point.
    shutdown_flag = {"set": False}

    def _signal_handler(signum, frame):
        shutdown_flag["set"] = True

    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)

    def _do_shutdown():
        log.info("Shutting down...")
        try:
            save_state(funds)
        except Exception as e:
            log.warning("Final save_state failed: %s", e)
        try:
            log_nav_table(funds)
        except Exception as e:
            log.warning("Final NAV table failed: %s", e)
        try:
            feed.close()
        except Exception as e:
            log.warning("Feed close failed: %s", e)
        log.info("Fund Manager stopped. State saved.")

    # One-shot mode
    if "--once" in sys.argv:
        urls = oracle_urls_fn()
        run_cycle(
            funds, executor, urls, feed, shared_cfg, source_id_map,
            cycle_number=0, feed_subscriptions=feed_subscriptions,
        )
        save_state(funds)
        feed.close()
        return

    cycle = 0
    try:
        while not shutdown_flag["set"]:
            cycle_failed = False
            # Liveness ping at cycle start so the staleness assert doesn't
            # fire during long cycles (60-90s with 183 funds). Uses
            # read-modify-write so the prior cycle's source_match field
            # survives — the start-of-cycle write is a heartbeat, not a
            # state reset.
            _write_heartbeat({"cycle": cycle, "ts": time.time(), "phase": "starting"})
            try:
                urls = oracle_urls_fn()
                run_cycle(
                    funds, executor, urls, feed, shared_cfg, source_id_map,
                    cycle_number=cycle, feed_subscriptions=feed_subscriptions,
                )
            except Exception as e:
                cycle_failed = True
                log.error("Cycle error: %s", e, exc_info=True)
                _write_heartbeat({"cycle": cycle, "ts": time.time(), "error": str(e), "phase": "error"})
            # Increment outside the try so an exception doesn't desync the
            # counter from the actual number of attempted cycles.
            cycle += 1
            if cycle_failed:
                # Persist whatever state we managed to mutate even if the
                # cycle blew up — better a partial snapshot than nothing.
                try:
                    save_state(funds)
                except Exception as e:
                    log.warning("Post-failure save_state failed: %s", e)
            # Sleep in small slices so SIGTERM is honored within ~1s.
            slept = 0.0
            while slept < poll_interval and not shutdown_flag["set"]:
                time.sleep(min(1.0, poll_interval - slept))
                slept += 1.0
    except KeyboardInterrupt:
        pass
    finally:
        _do_shutdown()


if __name__ == "__main__":
    main()
