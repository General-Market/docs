#!/usr/bin/env python3
"""
One-shot keeper that unsticks every overdue/settled-but-never-reconciled
batch across the fund-branding vault fleet.

Strategy per (vault, batch):
  1. read vault.activeBatchDeposits[batch]; skip if zero (already done)
  2. estimate vault.refundStuckBatch(batch). if ok → send. This is the
     true "rescue" path — Vision still holds the deposit.
  3. if step 2 reverts with BatchAlreadySettled(0x9f8e1a9c), Vision already
     paid out at settlement and the USDC sits in the vault's balance; we
     just need to fix the accounting. call vault.reconcile(batch, deposit).
  4. other reverts → log and skip; rerun-safe.

Source of truth: postgres on VPS 1 gives the candidate (vault, batch_id)
pairs; the chain is queried right before each tx because the indexer lags.

Idempotent. Reruns skip work that landed (progress file + on-chain precheck).
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import psycopg2
from web3 import Web3
from web3.exceptions import ContractLogicError

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
PROGRESS_PATH = ROOT / "deployments/refund-progress-2026-05-17.json"

# Throttle: target ~3 tx/s. L3 nginx upstream can pool but we don't want to
# stress the sequencer when there is no hurry.
SECONDS_PER_TX = float(os.environ.get("REFUND_THROTTLE", "0.35"))
GAS_LIMIT = int(os.environ.get("REFUND_GAS_LIMIT", "300000"))  # 80k typical, headroom for queue sweep
MAX_RETRIES = 2

# Selectors — keccak first 4 bytes. Computed by hand because web3.py's .hex()
# behaviour around the '0x' prefix has changed across versions.
#   activeBatchDeposits(uint256)  -> a30f30f2bf10...
#   refundStuckBatch(uint256)     -> 810894b9ff49...
#   reconcile(uint256,uint256)    -> 49e27d69...    (matches oracle writer.rs)
SEL_ACTIVE = "0xa30f30f2"
SEL_REFUND = "0x810894b9"
SEL_RECONCILE = "0x49e27d69"

# Custom-error selectors observed.
ERR_BATCH_ALREADY_SETTLED = "0x9f8e1a9c"
ERR_BATCH_ALREADY_RECONCILED = "0x4c03a47b"

# ─── helpers ─────────────────────────────────────────────────────────────


def selector(sig: str) -> str:
    h = Web3.keccak(text=sig).hex()
    if h.startswith("0x"):
        h = h[2:]
    return "0x" + h[:8]


def load_vaults() -> set[str]:
    data = json.loads(VAULT_LIST_PATH.read_text())
    out: set[str] = set()
    for fund in data.get("funds", []):
        v = fund.get("vault")
        if v:
            out.add(v.lower())
    return out


def load_candidates(vaults: set[str]) -> list[tuple[str, int, int]]:
    """Return (vault_lower, batch_id, db_balance_wei) for every position
    where balance>0, batch not settled, settlement_deadline in the past, and
    vault is in our fleet."""
    with psycopg2.connect(**PG_DSN) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT LOWER(vp.player), vp.batch_id, vp.balance::text
            FROM vision_positions vp
            JOIN vision_batch_lifecycle vbl ON vbl.batch_id = vp.batch_id
            WHERE vp.balance > 0
              AND vbl.settled_at IS NULL
              AND vbl.settlement_deadline < NOW()
              AND LOWER(vp.player) = ANY(%s)
            ORDER BY vbl.settlement_deadline ASC
            """,
            (list(vaults),),
        )
        return [(r[0], int(r[1]), int(r[2])) for r in cur.fetchall()]


def load_progress() -> dict:
    if PROGRESS_PATH.exists():
        return json.loads(PROGRESS_PATH.read_text())
    return {"done": [], "failed": [], "skipped_zero": [], "started_at": None}


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


def revert_selector(err: Exception) -> str | None:
    """Extract the 4-byte selector from a ContractLogicError, if present."""
    # web3.py exposes `.data` on ContractLogicError in newer versions, but the
    # str representation is the most reliable across versions.
    s = str(err)
    # patterns we have seen: "0x9f8e1a9c" embedded
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


# ─── main ────────────────────────────────────────────────────────────────


def main() -> int:
    sel_refund = SEL_REFUND
    # Sanity: prove the constant selector matches keccak — bail loudly if not.
    if sel_refund != selector("refundStuckBatch(uint256)"):
        print(
            f"[fatal] selector mismatch: const={sel_refund} "
            f"keccak={selector('refundStuckBatch(uint256)')}",
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

    nonce = w3.eth.get_transaction_count(keeper, "pending")
    gas_price = w3.eth.gas_price
    print(f"[init] start nonce={nonce} gas_price={gas_price}")

    refunded_count = 0           # refundStuckBatch successes
    reconciled_count = 0         # reconcile successes
    refunded_wei = 0
    new_skipped = 0
    new_failed = 0

    for i, (vault, batch, db_balance) in enumerate(candidates, 1):
        k = key_of(vault, batch)
        if k in done_keys:
            continue
        if k in skipped_keys:
            continue

        # Chain precheck — DB lags, many of these are already reconciled.
        try:
            on_chain = active_deposit(w3, vault, batch)
        except Exception as e:
            print(f"[{i}/{len(candidates)}] {k} active_deposit err={e}")
            continue

        if on_chain == 0:
            skipped_keys.add(k)
            new_skipped += 1
            progress["skipped_zero"] = sorted(skipped_keys)
            if new_skipped % 25 == 0:
                save_progress(progress)
                print(f"[{i}/{len(candidates)}] skipped_zero so far={new_skipped}")
            continue

        # Decide the path. Estimate refundStuckBatch first; on BatchAlreadySettled
        # fall back to reconcile(batch, deposited).
        method = "refund"
        data = encode_call(SEL_REFUND, batch)
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
            if sel == ERR_BATCH_ALREADY_SETTLED:
                # Already settled — USDC is in the vault, just clear accounting.
                method = "reconcile"
                data = encode_call(SEL_RECONCILE, batch, on_chain)
                tx["data"] = data
                try:
                    est = w3.eth.estimate_gas(tx)
                    tx["gas"] = max(GAS_LIMIT, int(est * 12 // 10))
                except ContractLogicError as e2:
                    sel2 = revert_selector(e2)
                    print(
                        f"[{i}/{len(candidates)}] {k} reconcile revert sel={sel2} ({e2})"
                    )
                    failed_keys.add(k)
                    progress.setdefault("failed", []).append(
                        {"key": k, "vault": vault, "batch": batch,
                         "reason": f"reconcile_revert:{sel2}"}
                    )
                    new_failed += 1
                    save_progress(progress)
                    continue
                except Exception as e2:
                    print(f"[{i}/{len(candidates)}] {k} reconcile estimate err={e2}")
                    time.sleep(1.0)
                    continue
            elif sel == ERR_BATCH_ALREADY_RECONCILED:
                # Race with another keeper / fund-manager — treat as done.
                done_keys.add(k)
                progress["done"] = sorted(done_keys)
                continue
            else:
                print(f"[{i}/{len(candidates)}] {k} refund revert sel={sel} ({e})")
                failed_keys.add(k)
                progress.setdefault("failed", []).append(
                    {"key": k, "vault": vault, "batch": batch,
                     "reason": f"refund_revert:{sel}"}
                )
                new_failed += 1
                save_progress(progress)
                continue
        except Exception as e:
            print(f"[{i}/{len(candidates)}] {k} estimate err={e}")
            time.sleep(1.0)
            continue

        # Send with retry on "nonce too low" — the fund-manager bot shares
        # the keeper key and races us on every cycle.
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
                    # Refresh nonce and try again; the bot is using ours.
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
                print(f"[{i}/{len(candidates)}] {k} send err={e}")
                tx_hash = None
                break

        if tx_hash is None:
            print(f"[{i}/{len(candidates)}] {k} send: gave up after retries")
            time.sleep(0.5)
            continue

        try:
            rcpt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        except Exception as e:
            print(f"[{i}/{len(candidates)}] {k} receipt err={e} tx={tx_hash.hex()}")
            time.sleep(1.0)
            continue

        if rcpt.status == 1:
            done_keys.add(k)
            refunded_wei += on_chain
            if method == "refund":
                refunded_count += 1
            else:
                reconciled_count += 1
            progress["done"] = sorted(done_keys)
            print(
                f"[{i}/{len(candidates)}] OK[{method}] {k} "
                f"deposited={on_chain/1e18:.4f} gas_used={rcpt.gasUsed} "
                f"tx={tx_hash.hex()}"
            )
        else:
            failed_keys.add(k)
            progress.setdefault("failed", []).append(
                {"key": k, "vault": vault, "batch": batch,
                 "reason": f"{method}_status=0", "tx": tx_hash.hex()}
            )
            new_failed += 1
            print(f"[{i}/{len(candidates)}] FAIL[{method}] {k} tx={tx_hash.hex()}")

        nonce += 1

        total_ok = refunded_count + reconciled_count
        if total_ok > 0 and total_ok % 10 == 0:
            save_progress(progress)
            print(
                f"[checkpoint] refund={refunded_count} reconcile={reconciled_count} "
                f"usdc={refunded_wei/1e18:.4f} skipped_zero={new_skipped} "
                f"failed={new_failed}"
            )

        time.sleep(SECONDS_PER_TX)

    save_progress(progress)
    print(
        f"[done] refund={refunded_count} reconcile={reconciled_count} "
        f"reclaimed_usdc={refunded_wei/1e18:.4f} skipped_zero={new_skipped} "
        f"failed={new_failed} total_done_keys={len(done_keys)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
