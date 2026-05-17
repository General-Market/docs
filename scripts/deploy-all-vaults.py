#!/usr/bin/env python3
"""Redeploy all vaults from fund-branding.json with 10K TVL and 5% perf fee.

Outputs new-vault-addresses.json mapping symbol → new vault address.
Run on VPS where the L3 RPC is reachable and FUND_MANAGER_KEY is set.
"""

import json
import os
import sys
import time
from pathlib import Path

from web3 import Web3

RPC = os.environ.get("L3_RPC_URL", "http://159.195.79.153:3001/")
USDC_ADDR = os.environ.get("USDC_ADDR", "0xaddB799BC1499b224DC4368e92b9042a54908553")
FACTORY_ADDR = os.environ.get("FACTORY_ADDR", "0xe54DB21b61FD50d5F1191C3BCb70AD184F4D58D0")
DEPOSIT_AMOUNT = int(os.environ.get("DEPOSIT_AMOUNT_WHOLE", "10000")) * 10**18
PERF_FEE_BPS = int(os.environ.get("PERF_FEE_BPS", "500"))  # 5%

FACTORY_ABI = [
    {"type": "function", "name": "createVault",
     "inputs": [{"type": "string", "name": "name"}, {"type": "string", "name": "symbol"},
                {"type": "uint256", "name": "performanceFeeRate"}, {"type": "address", "name": "manager"}],
     "outputs": [{"type": "address"}], "stateMutability": "nonpayable"},
    {"type": "event", "name": "VaultCreated",
     "inputs": [{"type": "address", "name": "vault", "indexed": True},
                {"type": "address", "name": "manager", "indexed": True},
                {"type": "string", "name": "name", "indexed": False},
                {"type": "string", "name": "symbol", "indexed": False},
                {"type": "uint256", "name": "performanceFeeRate", "indexed": False}],
     "anonymous": False},
]

VAULT_ABI = [
    {"type": "function", "name": "totalAssets", "inputs": [], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    {"type": "function", "name": "idleUSDC", "inputs": [], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    {"type": "function", "name": "requestDeposit",
     "inputs": [{"type": "uint256"}, {"type": "address"}, {"type": "address"}],
     "outputs": [{"type": "uint256"}], "stateMutability": "nonpayable"},
    {"type": "function", "name": "claimDeposit",
     "inputs": [{"type": "address"}, {"type": "address"}],
     "outputs": [{"type": "uint256"}], "stateMutability": "nonpayable"},
]

ERC20_ABI = [
    {"type": "function", "name": "approve",
     "inputs": [{"type": "address"}, {"type": "uint256"}],
     "outputs": [{"type": "bool"}], "stateMutability": "nonpayable"},
    {"type": "function", "name": "balanceOf",
     "inputs": [{"type": "address"}], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
]


def build_tx(w3, sender, gas):
    return {
        "from": sender,
        "gas": gas,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(sender, "pending"),
        "chainId": w3.eth.chain_id,
    }


def send(w3, account, tx, label=""):
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt["status"] != 1:
        raise RuntimeError(f"{label} reverted: {tx_hash.hex()}")
    return receipt


def main():
    key = os.environ.get("FUND_MANAGER_KEY", "")
    if not key:
        print("ERROR: FUND_MANAGER_KEY not set", flush=True)
        sys.exit(1)

    branding_path = Path(__file__).resolve().parent.parent / "frontend" / "data" / "fund-branding.json"
    branding = json.loads(branding_path.read_text())
    funds = branding["funds"]

    # Allow scoping via env var: DEPLOY_ONLY=symbol1,symbol2
    only = os.environ.get("DEPLOY_ONLY", "")
    if only:
        wanted = {s.strip() for s in only.split(",")}
        funds = [f for f in funds if f["symbol"] in wanted]

    skip_existing = os.environ.get("SKIP_EXISTING", "0") == "1"
    out_path = Path(__file__).resolve().parent.parent / "deployments" / "new-vault-addresses.json"
    out_path.parent.mkdir(exist_ok=True)
    if skip_existing and out_path.exists():
        existing = json.loads(out_path.read_text())
    else:
        existing = {}

    w3 = Web3(Web3.HTTPProvider(RPC))
    account = w3.eth.account.from_key(key)
    addr = account.address

    factory = w3.eth.contract(address=Web3.to_checksum_address(FACTORY_ADDR), abi=FACTORY_ABI)
    usdc = w3.eth.contract(address=Web3.to_checksum_address(USDC_ADDR), abi=ERC20_ABI)

    funded_path = Path(__file__).resolve().parent.parent / "deployments" / "funded-vaults.json"
    funded = json.loads(funded_path.read_text()) if funded_path.exists() else {}

    bal = usdc.functions.balanceOf(addr).call()
    unfunded = [f for f in funds if f["symbol"] not in funded]
    needed = len(unfunded) * DEPOSIT_AMOUNT
    print(f"Operator: {addr}", flush=True)
    print(f"USDC balance: {bal/1e18:,.2f}", flush=True)
    print(f"Funds total: {len(funds)} (unfunded: {len(unfunded)})", flush=True)
    print(f"USDC needed: {needed/1e18:,.0f}", flush=True)
    if bal < needed:
        print(f"ERROR: insufficient USDC. Need {needed/1e18:,.0f}, have {bal/1e18:,.0f}", flush=True)
        sys.exit(1)

    new_addresses = dict(existing)

    # ── Phase 1: createVault for each fund ──
    print("\n=== PHASE 1: CREATE VAULTS ===", flush=True)
    for i, fund in enumerate(funds, 1):
        symbol = fund["symbol"]
        if symbol in new_addresses:
            print(f"[{i}/{len(funds)}] {symbol}: skip (already deployed at {new_addresses[symbol]})", flush=True)
            continue
        name = fund["name"]
        fee_bps = int(fund.get("fee", PERF_FEE_BPS))
        try:
            tx = factory.functions.createVault(name, symbol, fee_bps, addr).build_transaction(
                build_tx(w3, addr, gas=2_500_000)
            )
            receipt = send(w3, account, tx, f"createVault[{symbol}]")
            # Parse VaultCreated event from logs
            vault_addr = None
            for log in receipt["logs"]:
                if log["address"].lower() == FACTORY_ADDR.lower() and len(log["topics"]) >= 2:
                    # VaultCreated(vault indexed, manager indexed, ...)
                    vault_addr = "0x" + log["topics"][1].hex()[-40:]
                    vault_addr = Web3.to_checksum_address(vault_addr)
                    break
            if not vault_addr:
                raise RuntimeError("VaultCreated event not found in receipt")
            new_addresses[symbol] = vault_addr
            print(f"[{i}/{len(funds)}] {symbol:6s} {name[:25]:25s} → {vault_addr}", flush=True)
            # Persist after each create so a crash doesn't lose progress
            out_path.write_text(json.dumps(new_addresses, indent=2))
        except Exception as e:
            print(f"[{i}/{len(funds)}] {symbol}: FAILED — {e}", flush=True)

    # ── Phase 2: fund each vault with 10K USDC ──
    print("\n=== PHASE 2: FUND VAULTS (10,000 USDC EACH) ===", flush=True)

    for i, fund in enumerate(funds, 1):
        symbol = fund["symbol"]
        vault_addr = new_addresses.get(symbol)
        if not vault_addr:
            print(f"[{i}/{len(funds)}] {symbol}: no address, skipping fund", flush=True)
            continue
        if symbol in funded:
            print(f"[{i}/{len(funds)}] {symbol}: already funded", flush=True)
            continue
        try:
            vault = w3.eth.contract(address=vault_addr, abi=VAULT_ABI)
            # 1) approve
            tx = usdc.functions.approve(vault_addr, DEPOSIT_AMOUNT).build_transaction(
                build_tx(w3, addr, gas=200_000)
            )
            send(w3, account, tx, f"approve[{symbol}]")
            # 2) requestDeposit
            tx = vault.functions.requestDeposit(DEPOSIT_AMOUNT, addr, addr).build_transaction(
                build_tx(w3, addr, gas=500_000)
            )
            send(w3, account, tx, f"requestDeposit[{symbol}]")
            # 3) claimDeposit
            tx = vault.functions.claimDeposit(addr, addr).build_transaction(
                build_tx(w3, addr, gas=500_000)
            )
            send(w3, account, tx, f"claimDeposit[{symbol}]")
            total = vault.functions.totalAssets().call()
            idle = vault.functions.idleUSDC().call()
            print(f"[{i}/{len(funds)}] {symbol:6s} funded — total={total/1e18:,.0f}  idle={idle/1e18:,.0f}", flush=True)
            funded[symbol] = vault_addr
            funded_path.write_text(json.dumps(funded, indent=2))
        except Exception as e:
            print(f"[{i}/{len(funds)}] {symbol}: FUND FAILED — {e}", flush=True)

    print(f"\n=== DONE ===", flush=True)
    print(f"Created: {len(new_addresses)}/{len(funds)}", flush=True)
    print(f"Funded:  {len(funded)}/{len(funds)}", flush=True)
    print(f"Addresses written to: {out_path}", flush=True)


if __name__ == "__main__":
    main()
