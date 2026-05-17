#!/usr/bin/env python3
"""Heal Vision vault idle balances by direct USDC transfer.

Background: every vault's `totalActiveCapital` is stale (old batches never
reconciled), so `totalAssets()` is inflated. The bot sizes bets at 175 bps
of `totalAssets()`, but only the actual `idleUSDC()` is usable. Most vaults
have $2-10 idle against $9k inflated total — they can't bet.

Fix: transfer USDC straight to the vault. That bumps `idleUSDC()` (and
`totalAssets()` further, but that's fine — NAV stays inflated, vault trades).
Do NOT call reconcile() — that would expose the stale accounting and crash
the displayed NAV to near zero.

Sizing per vault:
  min_bet      = totalAssets * 175 / 10000   (one 1.75% bet)
  target_idle  = min_bet * 5                  (room for ~5 bets)
  topup        = target_idle - current_idle   (if idle < min_bet * 3)
  cap          = $5000 per vault (log outliers, don't dump megabucks)

Idempotent: re-reads the progress file at start and skips already-topped
vaults that are still healthy.
"""

import json
import logging
import os
import sys
import time
from pathlib import Path

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("topup")

ROOT = Path(__file__).resolve().parent.parent
BRANDING_PATH = ROOT / "frontend" / "data" / "fund-branding.json"
PROGRESS_PATH = ROOT / "deployments" / "vault-topup-2026-05-17.json"

RPC = "https://rpc.generalmarket.io/"
CHAIN_ID = 111222333
USDC = Web3.to_checksum_address("0xaddB799BC1499b224DC4368e92b9042a54908553")

# Sizing knobs
TOPUP_THRESHOLD_MULT = 3   # if idle < min_bet * 3, top up
TARGET_IDLE_MULT = 5       # bring idle to min_bet * 5
CAP_PER_VAULT_USDC = 5_000  # max topup per vault
MIN_TOPUP_USDC = 10         # don't bother sending dust
TX_SLEEP_SEC = 0.15         # ~6 tx/s
TX_GAS = 150_000            # ERC20.transfer is ~50k, generous buffer

VAULT_ABI = [
    {"name": "totalAssets", "type": "function", "stateMutability": "view",
     "inputs": [], "outputs": [{"name": "", "type": "uint256"}]},
    {"name": "idleUSDC", "type": "function", "stateMutability": "view",
     "inputs": [], "outputs": [{"name": "", "type": "uint256"}]},
]

ERC20_ABI = [
    {"name": "transfer", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}],
     "outputs": [{"name": "", "type": "bool"}]},
    {"name": "balanceOf", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "", "type": "address"}], "outputs": [{"name": "", "type": "uint256"}]},
]


def load_progress():
    if PROGRESS_PATH.exists():
        return json.loads(PROGRESS_PATH.read_text())
    return {"entries": {}, "totals": {"topped_up": 0, "skipped": 0, "failed": 0, "usdc_added": 0}}


def save_progress(progress):
    PROGRESS_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROGRESS_PATH.write_text(json.dumps(progress, indent=2, default=str))


def compute_topup(total_assets_wei: int, idle_wei: int) -> int:
    """Return topup amount in wei, or 0 if no topup needed."""
    min_bet = (total_assets_wei * 175) // 10_000
    threshold = min_bet * TOPUP_THRESHOLD_MULT
    if idle_wei >= threshold:
        return 0
    target = min_bet * TARGET_IDLE_MULT
    topup = target - idle_wei
    cap_wei = CAP_PER_VAULT_USDC * 10**18
    if topup > cap_wei:
        topup = cap_wei
    if topup < MIN_TOPUP_USDC * 10**18:
        return 0
    return topup


def main():
    key = os.environ.get(
        "FUND_MANAGER_KEY",
        "0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537",
    )
    w3 = Web3(Web3.HTTPProvider(RPC, request_kwargs={"timeout": 60}))
    try:
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    except Exception:
        pass
    if not w3.is_connected():
        log.error("RPC down")
        sys.exit(1)
    if w3.eth.chain_id != CHAIN_ID:
        log.error(f"wrong chain: {w3.eth.chain_id}")
        sys.exit(1)

    account = w3.eth.account.from_key(key)
    funder = account.address
    log.info(f"Funder: {funder}")
    log.info(f"Block:  {w3.eth.block_number}")

    usdc = w3.eth.contract(address=USDC, abi=ERC20_ABI)
    funder_bal = usdc.functions.balanceOf(funder).call()
    log.info(f"Funder USDC: {funder_bal / 1e18:,.2f}")

    catalog = json.loads(BRANDING_PATH.read_text())
    funds = [(f["symbol"], f["name"], f["source"], Web3.to_checksum_address(f["vault"]))
             for f in catalog["funds"] if f.get("vault")]
    log.info(f"Funds in catalog: {len(funds)} (will dedupe by vault)")

    seen = set()
    vaults = []
    for sym, name, source, addr in funds:
        if addr in seen:
            continue
        seen.add(addr)
        vaults.append((sym, name, source, addr))
    log.info(f"Unique vaults: {len(vaults)}")

    progress = load_progress()
    entries = progress["entries"]

    # We refetch the pending nonce before every tx to survive concurrent senders.
    gas_price = w3.eth.gas_price
    log.info(f"Starting nonce (pending): {w3.eth.get_transaction_count(funder, 'pending')}")

    topped = 0
    skipped = 0
    failed = 0
    total_added_wei = 0
    nav_liars = []  # totalActiveCapital > $20k while real USDC < $10

    for i, (sym, name, source, vaddr) in enumerate(vaults, 1):
        vault = w3.eth.contract(address=vaddr, abi=VAULT_ABI)

        try:
            total_assets = vault.functions.totalAssets().call()
            idle = vault.functions.idleUSDC().call()
            real_balance = usdc.functions.balanceOf(vaddr).call()
        except Exception as e:
            log.warning(f"[{sym:6}] read failed: {e}")
            entries[vaddr] = {
                "symbol": sym, "name": name, "source": source,
                "status": "read_failed", "error": str(e),
            }
            failed += 1
            continue

        active_capital = total_assets - real_balance  # stale active
        topup_wei = compute_topup(total_assets, idle)

        # detect NAV liars: stale active > $20k while real USDC < $10
        if active_capital > 20_000 * 10**18 and real_balance < 10 * 10**18:
            nav_liars.append((sym, name, active_capital / 1e18, real_balance / 1e18))

        if topup_wei == 0:
            log.info(f"[{i:3}/{len(vaults)}] [SKIP] {sym:6} {source:14} idle=${idle/1e18:9.2f} ta=${total_assets/1e18:11.2f} (healthy)")
            entries[vaddr] = {
                "symbol": sym, "name": name, "source": source,
                "totalAssets_before": total_assets / 1e18,
                "idle_before": idle / 1e18,
                "real_balance_before": real_balance / 1e18,
                "active_capital_before": active_capital / 1e18,
                "topup_amount": 0,
                "idle_after": idle / 1e18,
                "status": "skipped_healthy",
            }
            skipped += 1
            if i % 20 == 0:
                save_progress(progress)
            continue

        # Send transfer
        min_bet = (total_assets * 175) // 10_000
        log.info(
            f"[{i:3}/{len(vaults)}] [TOPUP] {sym:6} {source:14} "
            f"idle=${idle/1e18:9.2f} ta=${total_assets/1e18:11.2f} "
            f"min_bet=${min_bet/1e18:7.2f} +${topup_wei/1e18:7.2f}"
        )

        success = False
        last_err = None
        receipt_hash = None
        new_idle = idle
        for attempt in range(3):
            try:
                # Refetch pending nonce on every attempt — survives concurrent senders
                nonce = w3.eth.get_transaction_count(funder, "pending")
                tx = usdc.functions.transfer(vaddr, topup_wei).build_transaction({
                    "from": funder,
                    "gas": TX_GAS,
                    "gasPrice": gas_price,
                    "nonce": nonce,
                    "chainId": CHAIN_ID,
                })
                signed = account.sign_transaction(tx)
                h = w3.eth.send_raw_transaction(signed.raw_transaction)
                r = w3.eth.wait_for_transaction_receipt(h, timeout=120)
                if r["status"] != 1:
                    raise RuntimeError(f"reverted: {h.hex()}")
                receipt_hash = h.hex()
                new_idle = vault.functions.idleUSDC().call()
                success = True
                break
            except Exception as e:
                last_err = e
                msg = str(e).lower()
                if "nonce" in msg or "underpriced" in msg or "already known" in msg:
                    log.warning(f"  [{sym}] retry {attempt+1}/3 due to: {e}")
                    time.sleep(0.5)
                    continue
                # non-nonce error: don't retry
                break

        if success:
            topped += 1
            total_added_wei += topup_wei
            entries[vaddr] = {
                "symbol": sym, "name": name, "source": source,
                "totalAssets_before": total_assets / 1e18,
                "idle_before": idle / 1e18,
                "real_balance_before": real_balance / 1e18,
                "active_capital_before": active_capital / 1e18,
                "topup_amount": topup_wei / 1e18,
                "idle_after": new_idle / 1e18,
                "tx": receipt_hash,
                "status": "topped_up",
            }
            if i % 5 == 0:
                save_progress(progress)
            time.sleep(TX_SLEEP_SEC)
        else:
            log.error(f"  [{sym}] FAILED: {last_err}")
            entries[vaddr] = {
                "symbol": sym, "name": name, "source": source,
                "totalAssets_before": total_assets / 1e18,
                "idle_before": idle / 1e18,
                "real_balance_before": real_balance / 1e18,
                "active_capital_before": active_capital / 1e18,
                "topup_amount": topup_wei / 1e18,
                "status": "failed",
                "error": str(last_err),
            }
            failed += 1

    progress["totals"] = {
        "unique_vaults": len(vaults),
        "topped_up": topped,
        "skipped": skipped,
        "failed": failed,
        "usdc_added": total_added_wei / 1e18,
        "nav_liars": [{"symbol": s, "name": n, "stale_active": a, "real_balance": r}
                       for s, n, a, r in nav_liars],
        "completed_at": int(time.time()),
    }
    save_progress(progress)

    log.info("=" * 70)
    log.info(f"Topped up: {topped}")
    log.info(f"Already healthy: {skipped}")
    log.info(f"Failed: {failed}")
    log.info(f"Total USDC injected: ${total_added_wei/1e18:,.2f}")
    log.info(f"NAV liars (stale active >$20k, real USDC <$10): {len(nav_liars)}")
    for sym, name, active, real in nav_liars[:20]:
        log.info(f"  {sym:6} {name:30} stale=${active:11,.2f} real=${real:6.2f}")
    if len(nav_liars) > 20:
        log.info(f"  ... and {len(nav_liars)-20} more")


if __name__ == "__main__":
    main()
