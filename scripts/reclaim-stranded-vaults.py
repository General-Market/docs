#!/usr/bin/env python3
"""Reclaim USDC from the 258 wrong-Vision vaults deployed under the
broken factory (0xe54D...58D0). Manager owns all shares; the redeem
queue fulfills synchronously when idleUSDC covers it, which it does
(no batches were joined — they all reverted with BatchNotFound).

Reads deployments/vault-redeploy-2026-05-17-v1-forensic.json for the
list of wrong vaults. For each:
  1. requestRedeem(shareBalance, manager, manager)
  2. claimRedeem(manager, manager)

Persists progress to deployments/reclaim-progress.json so a crash or
nonce conflict can resume cleanly.
"""
import json
import os
import sys
from pathlib import Path
from web3 import Web3

RPC = os.environ.get("L3_RPC_URL", "https://rpc.generalmarket.io/")
KEY = os.environ["FUND_MANAGER_KEY"]

ROOT = Path(__file__).resolve().parent.parent
FORENSIC = ROOT / "deployments" / "vault-redeploy-2026-05-17-v1-forensic.json"
PROGRESS = ROOT / "deployments" / "reclaim-progress.json"

VAULT_ABI = [
    {"type": "function", "name": "balanceOf", "inputs": [{"type": "address"}],
     "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    {"type": "function", "name": "idleUSDC", "inputs": [],
     "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    {"type": "function", "name": "requestRedeem",
     "inputs": [{"type": "uint256"}, {"type": "address"}, {"type": "address"}],
     "outputs": [{"type": "uint256"}], "stateMutability": "nonpayable"},
    {"type": "function", "name": "claimRedeem",
     "inputs": [{"type": "address"}, {"type": "address"}],
     "outputs": [{"type": "uint256"}], "stateMutability": "nonpayable"},
]


def build_tx(w3, sender, gas):
    return {"from": sender, "gas": gas, "gasPrice": w3.eth.gas_price,
            "nonce": w3.eth.get_transaction_count(sender, "pending"),
            "chainId": w3.eth.chain_id}


def send(w3, account, tx, label):
    signed = account.sign_transaction(tx)
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    r = w3.eth.wait_for_transaction_receipt(h, timeout=120)
    if r["status"] != 1:
        raise RuntimeError(f"{label} reverted: {h.hex()}")
    return r


def main():
    forensic = json.loads(FORENSIC.read_text())
    wrong_vaults = [(m["symbol"], m["new_vault"]) for m in forensic["mapping"]]
    progress = json.loads(PROGRESS.read_text()) if PROGRESS.exists() else {}

    w3 = Web3(Web3.HTTPProvider(RPC))
    account = w3.eth.account.from_key(KEY)
    addr = account.address
    print(f"Operator: {addr}", flush=True)
    print(f"Wrong vaults to drain: {len(wrong_vaults)}", flush=True)
    print(f"Already drained: {sum(1 for v in progress.values() if v.get('drained'))}", flush=True)

    total_reclaimed = 0
    for i, (symbol, vault_addr) in enumerate(wrong_vaults, 1):
        state = progress.get(symbol, {})
        if state.get("drained"):
            print(f"[{i}/{len(wrong_vaults)}] {symbol}: already drained", flush=True)
            total_reclaimed += int(state.get("reclaimed_wei", 0))
            continue

        vault_addr_cs = Web3.to_checksum_address(vault_addr)
        vault = w3.eth.contract(address=vault_addr_cs, abi=VAULT_ABI)

        try:
            shares = vault.functions.balanceOf(addr).call()
            idle = vault.functions.idleUSDC().call()
        except Exception as e:
            print(f"[{i}/{len(wrong_vaults)}] {symbol}: VIEW FAILED ({e})", flush=True)
            continue

        if shares == 0:
            progress[symbol] = {"drained": True, "reclaimed_wei": 0, "reason": "no shares"}
            PROGRESS.write_text(json.dumps(progress, indent=2))
            print(f"[{i}/{len(wrong_vaults)}] {symbol}: no shares — skip", flush=True)
            continue

        if idle < shares:
            print(f"[{i}/{len(wrong_vaults)}] {symbol}: idle {idle/1e18:,.0f} < shares {shares/1e18:,.0f} — queued, not draining now", flush=True)
            continue

        try:
            tx = vault.functions.requestRedeem(shares, addr, addr).build_transaction(
                build_tx(w3, addr, gas=500_000))
            send(w3, account, tx, f"requestRedeem[{symbol}]")
            tx = vault.functions.claimRedeem(addr, addr).build_transaction(
                build_tx(w3, addr, gas=500_000))
            send(w3, account, tx, f"claimRedeem[{symbol}]")
            progress[symbol] = {"drained": True, "reclaimed_wei": shares}
            PROGRESS.write_text(json.dumps(progress, indent=2))
            total_reclaimed += shares
            print(f"[{i}/{len(wrong_vaults)}] {symbol:6s} reclaimed {shares/1e18:,.0f} USDC", flush=True)
        except Exception as e:
            print(f"[{i}/{len(wrong_vaults)}] {symbol}: FAILED — {e}", flush=True)

    print(f"\nTotal reclaimed: {total_reclaimed/1e18:,.0f} USDC", flush=True)


if __name__ == "__main__":
    main()
