#!/usr/bin/env python3
"""
One-shot keeper that reconciles every (vault, batchId) pair where the
vault still has `activeBatchDeposits[batchId] > 0` even though Vision
already settled the batch and pushed (or withheld) the payout.

This is the phantom-active capital cleanup: the earlier `refund-stuck-
batches.py` job only saw rows where `vision_positions.balance > 0`. For
phantom cases, Vision cleared the position on settle, so that query
returns zero — but the vault-side accounting is still inflated.

Candidate source: `vision_round_players` — one row per settled batch
participation, columns include the actual `payout` Vision pushed.

Per (vault, batch):
  1. read vault.activeBatchDeposits[batch]; skip if zero (already clean)
  2. call vault.reconcile(batch, payout_from_db)
       - permissionless, only updates accounting (no USDC movement)
       - reverts with BatchAlreadyReconciled if a race already cleared it

Idempotent: progress file at deployments/reconcile-phantom-2026-05-17.json
holds done/failed/skipped_zero keys across reruns.
"""
from __future__ import annotations

import json
import os
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import psycopg2
import requests
from web3 import Web3
from web3.exceptions import ContractLogicError

# Force line-buffered stdout so nohup tails are useful.
sys.stdout.reconfigure(line_buffering=True)

# ─── config ──────────────────────────────────────────────────────────────
RPC_URL = os.environ.get("L3_RPC", "https://rpc.generalmarket.io/")
CHAIN_ID = int(os.environ.get("L3_CHAIN_ID", "111222333"))
KEEPER_KEY = os.environ.get(
    "FUND_MANAGER_KEY",
    "0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537",
)

PG_DSN = dict(
    host=os.environ.get("PGHOST", "localhost"),
    port=int(os.environ.get("PGPORT", "5432")),
    user=os.environ.get("PGUSER", "max"),
    password=os.environ.get("PGPASSWORD", "m_f310f8cc478d54483105863917900d31"),
    dbname=os.environ.get("PGDATABASE", "index_prices"),
)

ROOT = Path(__file__).resolve().parents[1]
VAULT_LIST_PATH = ROOT / "frontend/data/fund-branding.json"
PROGRESS_PATH = ROOT / "deployments/reconcile-phantom-2026-05-17.json"

SECONDS_PER_TX = float(os.environ.get("RECONCILE_THROTTLE", "0.15"))  # ~7 tx/s
GAS_LIMIT = int(os.environ.get("RECONCILE_GAS_LIMIT", "300000"))
PRECHECK_WORKERS = int(os.environ.get("RECONCILE_PRECHECK_WORKERS", "16"))

# Selectors
SEL_ACTIVE = "0xa30f30f2"      # activeBatchDeposits(uint256)
SEL_TOTAL_ACTIVE = "0x564b1f42"  # totalActiveCapital()
SEL_RECONCILE = "0x49e27d69"   # reconcile(uint256,uint256)

# Custom-error selectors
ERR_BATCH_ALREADY_RECONCILED = "0x4c03a47b"


def selector(sig: str) -> str:
    h = Web3.keccak(text=sig).hex()
    if h.startswith("0x"):
        h = h[2:]
    return "0x" + h[:8]


def load_vaults() -> list[str]:
    data = json.loads(VAULT_LIST_PATH.read_text())
    out: list[str] = []
    seen: set[str] = set()
    for fund in data.get("funds", []):
        v = fund.get("vault")
        if v and v.lower() not in seen:
            out.append(v.lower())
            seen.add(v.lower())
    return out


def load_candidates(vaults: list[str]) -> list[tuple[str, int, int, int]]:
    """Return (vault_lower, batch_id, payout_wei, deposited_wei) for every
    settled-round participation by one of our vaults. Newest first."""
    with psycopg2.connect(**PG_DSN) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT LOWER(player), batch_id, payout, deposited
            FROM vision_round_players
            WHERE LOWER(player) = ANY(%s)
            ORDER BY settled_at DESC, batch_id DESC
            """,
            (vaults,),
        )
        return [(r[0], int(r[1]), int(r[2]), int(r[3])) for r in cur.fetchall()]


def load_progress() -> dict:
    if PROGRESS_PATH.exists():
        return json.loads(PROGRESS_PATH.read_text())
    return {
        "done": [],
        "failed": [],
        "skipped_zero": [],
        "started_at": None,
        "stats": {
            "reconciled_count": 0,
            "phantom_wei_cleared": "0",  # sum of deposited values
        },
    }


def save_progress(p: dict) -> None:
    PROGRESS_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = PROGRESS_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(p, indent=2))
    tmp.replace(PROGRESS_PATH)


def key_of(vault: str, batch: int) -> str:
    return f"{vault.lower()}|{batch}"


def active_deposit(w3: Web3, vault: str, batch: int) -> int:
    data = SEL_ACTIVE + f"{batch:064x}"
    raw = w3.eth.call({"to": Web3.to_checksum_address(vault), "data": data})
    return int.from_bytes(raw, "big")


def raw_eth_call(session: requests.Session, to: str, data: str) -> int:
    """Direct JSON-RPC eth_call; cheaper than web3.py round-trips when fanning out."""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_call",
        "params": [{"to": Web3.to_checksum_address(to), "data": data}, "latest"],
    }
    r = session.post(RPC_URL, json=payload, timeout=30)
    r.raise_for_status()
    res = r.json().get("result", "0x")
    if res == "0x" or not res:
        return 0
    return int(res, 16)


def total_active_capital(session: requests.Session, vault: str) -> int:
    return raw_eth_call(session, vault, SEL_TOTAL_ACTIVE)


def active_deposit_raw(session: requests.Session, vault: str, batch: int) -> int:
    return raw_eth_call(session, vault, SEL_ACTIVE + f"{batch:064x}")


def revert_selector(err: Exception) -> str | None:
    s = str(err)
    for token in s.replace("'", " ").replace('"', " ").split():
        token = token.strip(",.")
        if token.startswith("0x") and len(token) >= 10:
            return token[:10].lower()
    return None


def encode_call(selector_4: str, *uint256_args: int) -> str:
    out = selector_4
    for a in uint256_args:
        out += f"{a:064x}"
    return out


def main() -> int:
    # Sanity: verify the constant selectors match keccak
    if SEL_RECONCILE != selector("reconcile(uint256,uint256)"):
        print(
            f"[fatal] selector mismatch: const={SEL_RECONCILE} "
            f"keccak={selector('reconcile(uint256,uint256)')}",
            file=sys.stderr,
        )
        return 1
    if SEL_ACTIVE != selector("activeBatchDeposits(uint256)"):
        print(
            f"[fatal] selector mismatch: const={SEL_ACTIVE} "
            f"keccak={selector('activeBatchDeposits(uint256)')}",
            file=sys.stderr,
        )
        return 1

    w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 30}))
    if not w3.is_connected():
        print(f"[fatal] cannot connect to {RPC_URL}", file=sys.stderr)
        return 1

    acct = w3.eth.account.from_key(KEEPER_KEY)
    keeper = acct.address
    print(f"[init] keeper={keeper} chain_id={w3.eth.chain_id} rpc={RPC_URL}")

    vaults = load_vaults()
    print(f"[init] {len(vaults)} vaults in fund-branding")

    candidates = load_candidates(vaults)
    print(f"[init] {len(candidates)} candidate (vault, batch) pairs from postgres")

    progress = load_progress()
    done_keys: set[str] = set(progress.get("done", []))
    failed_keys: set[str] = {row["key"] for row in progress.get("failed", [])} if progress.get("failed") else set()
    skipped_keys: set[str] = set(progress.get("skipped_zero", []))
    if progress.get("started_at") is None:
        progress["started_at"] = int(time.time())

    stats = progress.setdefault("stats", {"reconciled_count": 0, "phantom_wei_cleared": "0"})
    phantom_wei_cleared = int(stats.get("phantom_wei_cleared", "0"))
    reconciled_count = int(stats.get("reconciled_count", 0))

    nonce = w3.eth.get_transaction_count(keeper, "pending")
    gas_price = w3.eth.gas_price
    print(f"[init] start nonce={nonce} gas_price={gas_price}")
    print(f"[init] resume: done={len(done_keys)} skipped={len(skipped_keys)} failed={len(failed_keys)}")

    # Phase A: read totalActiveCapital per vault. Vaults with TAC==0 cannot have
    # any phantom — skip their entire candidate set.
    session = requests.Session()
    session.headers["Content-Type"] = "application/json"

    vault_set = {row[0] for row in candidates}
    print(f"[precheck] reading totalActiveCapital for {len(vault_set)} vaults ...")
    tac: dict[str, int] = {}
    with ThreadPoolExecutor(max_workers=PRECHECK_WORKERS) as ex:
        futs = {ex.submit(total_active_capital, session, v): v for v in vault_set}
        for f in as_completed(futs):
            v = futs[f]
            try:
                tac[v] = f.result()
            except Exception as e:
                print(f"[precheck] {v} TAC err={e}")
                tac[v] = -1  # mark error; will retry serially later
    live_vaults = {v for v, t in tac.items() if t > 0}
    dead_vaults = {v for v, t in tac.items() if t == 0}
    err_vaults = {v for v, t in tac.items() if t < 0}
    print(f"[precheck] vaults with TAC>0: {len(live_vaults)}  TAC=0: {len(dead_vaults)}  err: {len(err_vaults)}")
    if live_vaults:
        live_sum = sum(tac[v] for v in live_vaults) / 1e18
        print(f"[precheck] sum TAC across live vaults: {live_sum:.2f} USDC")

    # Pre-filter candidates: keep only those whose vault is live (or err — retry there).
    keep_vaults = live_vaults | err_vaults
    filtered = [(v, b, p, d) for (v, b, p, d) in candidates if v in keep_vaults]
    print(f"[precheck] candidates after vault filter: {len(filtered)} / {len(candidates)}")

    # Bulk drop already-resolved (TAC==0) vault rows into skipped_keys so we
    # don't probe them next run.
    if dead_vaults:
        bulk_skip = 0
        for v, b, _p, _d in candidates:
            if v in dead_vaults:
                k = key_of(v, b)
                if k not in skipped_keys and k not in done_keys:
                    skipped_keys.add(k)
                    bulk_skip += 1
        if bulk_skip:
            progress["skipped_zero"] = sorted(skipped_keys)
            save_progress(progress)
            print(f"[precheck] bulk-skipped {bulk_skip} rows from dead vaults")

    # Phase B: parallel `activeBatchDeposits(batch)` precheck for the remaining
    # candidates. The phantom set is typically thousands, not 93k.
    print(f"[precheck] probing activeBatchDeposits for {len(filtered)} rows ...")
    phantom_rows: list[tuple[str, int, int, int, int]] = []  # vault, batch, payout, deposited, on_chain
    started = time.time()
    with ThreadPoolExecutor(max_workers=PRECHECK_WORKERS) as ex:
        futs = {}
        for (v, b, p, d) in filtered:
            k = key_of(v, b)
            if k in done_keys or k in skipped_keys or k in failed_keys:
                continue
            futs[ex.submit(active_deposit_raw, session, v, b)] = (v, b, p, d)
        processed = 0
        for f in as_completed(futs):
            v, b, p, d = futs[f]
            processed += 1
            try:
                on_chain = f.result()
            except Exception as e:
                print(f"[precheck] {v[:10]}.. b={b} err={e}")
                continue
            k = key_of(v, b)
            if on_chain == 0:
                skipped_keys.add(k)
            else:
                phantom_rows.append((v, b, p, d, on_chain))
            if processed % 5000 == 0:
                progress["skipped_zero"] = sorted(skipped_keys)
                save_progress(progress)
                rate = processed / (time.time() - started)
                eta = (len(futs) - processed) / max(rate, 1)
                print(f"[precheck] {processed}/{len(futs)} phantom={len(phantom_rows)} rate={rate:.1f}/s eta={eta:.0f}s")
    progress["skipped_zero"] = sorted(skipped_keys)
    save_progress(progress)
    print(f"[precheck] DONE  phantoms={len(phantom_rows)}")
    if phantom_rows:
        total_phantom = sum(r[4] for r in phantom_rows) / 1e18
        print(f"[precheck] sum on-chain phantom-active: {total_phantom:.2f} USDC")

    new_skipped = 0
    new_failed = 0

    for i, (vault, batch, payout_wei, deposited_wei, on_chain) in enumerate(phantom_rows, 1):
        k = key_of(vault, batch)
        if k in done_keys or k in failed_keys:
            continue

        # Phantom-active capital found — reconcile with Vision's payout.
        data = encode_call(SEL_RECONCILE, batch, payout_wei)
        tx = {
            "from": keeper,
            "to": Web3.to_checksum_address(vault),
            "data": data,
            "nonce": nonce,
            "gas": GAS_LIMIT,
            "gasPrice": gas_price,
            "chainId": CHAIN_ID,
            "value": 0,
        }

        try:
            est = w3.eth.estimate_gas(tx)
            tx["gas"] = max(GAS_LIMIT, int(est * 12 // 10))
        except ContractLogicError as e:
            sel = revert_selector(e)
            if sel == ERR_BATCH_ALREADY_RECONCILED:
                # Race with another caller — count as done.
                done_keys.add(k)
                continue
            print(f"[{i}/{len(phantom_rows)}] {k} reconcile revert sel={sel} ({e})")
            failed_keys.add(k)
            progress.setdefault("failed", []).append(
                {"key": k, "vault": vault, "batch": batch,
                 "reason": f"reconcile_revert:{sel}"}
            )
            new_failed += 1
            save_progress(progress)
            continue
        except Exception as e:
            print(f"[{i}/{len(phantom_rows)}] {k} estimate err={e}")
            time.sleep(1.0)
            continue

        # Send with nonce-collision retry.
        tx_hash = None
        for _ in range(8):
            tx["nonce"] = nonce
            signed = acct.sign_transaction(tx)
            try:
                tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
                break
            except Exception as e:
                msg = str(e).lower()
                if "nonce too low" in msg or "already known" in msg:
                    try:
                        new_nonce = w3.eth.get_transaction_count(keeper, "pending")
                        if new_nonce > nonce:
                            nonce = new_nonce
                            continue
                    except Exception:
                        pass
                    nonce += 1
                    time.sleep(0.1)
                    continue
                print(f"[{i}/{len(phantom_rows)}] {k} send err={e}")
                tx_hash = None
                break

        if tx_hash is None:
            print(f"[{i}/{len(phantom_rows)}] {k} send: gave up after retries")
            time.sleep(0.5)
            continue

        try:
            rcpt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        except Exception as e:
            print(f"[{i}/{len(phantom_rows)}] {k} receipt err={e} tx={tx_hash.hex()}")
            time.sleep(1.0)
            continue

        if rcpt.status == 1:
            done_keys.add(k)
            phantom_wei_cleared += on_chain
            reconciled_count += 1
            print(
                f"[{i}/{len(phantom_rows)}] OK {k} "
                f"deposit={on_chain/1e18:.4f} payout={payout_wei/1e18:.4f} "
                f"gas={rcpt.gasUsed} tx={tx_hash.hex()}"
            )
        else:
            failed_keys.add(k)
            progress.setdefault("failed", []).append(
                {"key": k, "vault": vault, "batch": batch,
                 "reason": "reconcile_status=0", "tx": tx_hash.hex()}
            )
            new_failed += 1
            print(f"[{i}/{len(phantom_rows)}] FAIL {k} tx={tx_hash.hex()}")

        nonce += 1

        if reconciled_count > 0 and reconciled_count % 25 == 0:
            stats["reconciled_count"] = reconciled_count
            stats["phantom_wei_cleared"] = str(phantom_wei_cleared)
            progress["done"] = sorted(done_keys)
            progress["skipped_zero"] = sorted(skipped_keys)
            save_progress(progress)
            print(
                f"[checkpoint] reconciled={reconciled_count} "
                f"usdc_cleared={phantom_wei_cleared/1e18:.2f} "
                f"skipped_zero={new_skipped} failed={new_failed}"
            )

        time.sleep(SECONDS_PER_TX)

    stats["reconciled_count"] = reconciled_count
    stats["phantom_wei_cleared"] = str(phantom_wei_cleared)
    progress["done"] = sorted(done_keys)
    progress["skipped_zero"] = sorted(skipped_keys)
    save_progress(progress)
    print(
        f"[done] reconciled={reconciled_count} "
        f"usdc_cleared={phantom_wei_cleared/1e18:.2f} "
        f"skipped_zero={new_skipped} failed={new_failed} "
        f"total_done_keys={len(done_keys)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
