#!/usr/bin/env python3
"""Reconcile stuck Twitch vault capital + deposit 10,000 USDC into each vault."""

import os, sys, time
from web3 import Web3

RPC = "http://142.132.164.24/"
USDC_ADDR = "0x2710e49EBb807A0cB9369F13Ba24Bd809809a827"
DEPOSIT_AMOUNT = 10_000 * 10**18  # 10,000 USDC (18 decimals on L3)

TWITCH_VAULTS = [
    ("Prime Time", "0x4b265cfeB35bd47019Beec50b20275CE42532D54"),
    ("Offline",    "0x9b3aA5025D62e25c9E33579055f5FA7AC277E02C"),
    ("Subscribe",  "0xceEfA5c26591E4DaBA3A0D8b3a4A20fb3eeEa4b9"),
    ("Host",       "0x10F9035B305E9c510D96156A35191D9d2414BAb2"),
]

VAULT_ABI = [
    {"type":"function","name":"totalAssets","inputs":[],"outputs":[{"type":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"totalActiveCapital","inputs":[],"outputs":[{"type":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"idleUSDC","inputs":[],"outputs":[{"type":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"activeBatchDeposits","inputs":[{"type":"uint256"}],"outputs":[{"type":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"reconcile","inputs":[{"type":"uint256"},{"type":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"requestDeposit","inputs":[{"type":"uint256"},{"type":"address"},{"type":"address"}],"outputs":[{"type":"uint256"}],"stateMutability":"nonpayable"},
    {"type":"function","name":"claimDeposit","inputs":[{"type":"address"},{"type":"address"}],"outputs":[{"type":"uint256"}],"stateMutability":"nonpayable"},
]

ERC20_ABI = [
    {"type":"function","name":"approve","inputs":[{"type":"address"},{"type":"uint256"}],"outputs":[{"type":"bool"}],"stateMutability":"nonpayable"},
    {"type":"function","name":"balanceOf","inputs":[{"type":"address"}],"outputs":[{"type":"uint256"}],"stateMutability":"view"},
]


def build_tx(w3, sender, gas=500_000):
    return {
        "from": sender,
        "gas": gas,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(sender),
        "chainId": w3.eth.chain_id,
    }


def send(w3, account, tx):
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    if receipt["status"] != 1:
        raise RuntimeError(f"TX reverted: {tx_hash.hex()}")
    return tx_hash


def main():
    key = os.environ.get("FUND_MANAGER_KEY", "")
    if not key:
        print("ERROR: FUND_MANAGER_KEY not set")
        sys.exit(1)

    w3 = Web3(Web3.HTTPProvider(RPC))
    account = w3.eth.account.from_key(key)
    addr = account.address
    usdc = w3.eth.contract(address=Web3.to_checksum_address(USDC_ADDR), abi=ERC20_ABI)

    print(f"Operator: {addr}")
    print(f"USDC balance: {usdc.functions.balanceOf(addr).call() / 1e18:.0f}")
    print()

    # ── Phase 1: Reconcile stuck batches ──
    print("=== PHASE 1: RECONCILE STUCK BATCHES ===")
    # Scan batch IDs 10000-18000 for each vault
    for name, vault_addr in TWITCH_VAULTS:
        vault_addr = Web3.to_checksum_address(vault_addr)
        vault = w3.eth.contract(address=vault_addr, abi=VAULT_ABI)
        active = vault.functions.totalActiveCapital().call()
        if active == 0:
            print(f"[{name}] No stuck capital, skipping reconcile scan")
            continue

        print(f"[{name}] Active capital: {active/1e18:.2f} — scanning for stuck batches...")
        reconciled = 0
        for bid in range(10000, 18500, 1):
            dep = vault.functions.activeBatchDeposits(bid).call()
            if dep > 0:
                print(f"  Batch {bid}: {dep/1e18:.2f} USDC stuck — reconciling...")
                try:
                    tx = vault.functions.reconcile(bid, 0).build_transaction(
                        build_tx(w3, addr, gas=500_000)
                    )
                    send(w3, account, tx)
                    reconciled += 1
                    print(f"  Batch {bid}: reconciled OK")
                except Exception as e:
                    err = str(e)
                    if "BatchAlreadyReconciled" in err or "4c03a47b" in err:
                        print(f"  Batch {bid}: already reconciled")
                    else:
                        print(f"  Batch {bid}: reconcile failed: {err[:80]}")
                time.sleep(0.3)

        new_active = vault.functions.totalActiveCapital().call()
        new_idle = vault.functions.idleUSDC().call()
        print(f"[{name}] After reconcile: active={new_active/1e18:.2f} idle={new_idle/1e18:.2f} (freed {reconciled} batches)")
        print()

    # ── Phase 2: Fund vaults with 10,000 USDC each ──
    print("=== PHASE 2: FUND VAULTS (10,000 USDC EACH) ===")
    for name, vault_addr in TWITCH_VAULTS:
        vault_addr = Web3.to_checksum_address(vault_addr)
        vault = w3.eth.contract(address=vault_addr, abi=VAULT_ABI)

        print(f"[{name}] Approving {DEPOSIT_AMOUNT/1e18:.0f} USDC...")
        tx = usdc.functions.approve(vault_addr, DEPOSIT_AMOUNT).build_transaction(
            build_tx(w3, addr, gas=200_000)
        )
        send(w3, account, tx)

        print(f"[{name}] requestDeposit...")
        tx = vault.functions.requestDeposit(DEPOSIT_AMOUNT, addr, addr).build_transaction(
            build_tx(w3, addr, gas=500_000)
        )
        send(w3, account, tx)

        print(f"[{name}] claimDeposit...")
        tx = vault.functions.claimDeposit(addr, addr).build_transaction(
            build_tx(w3, addr, gas=500_000)
        )
        send(w3, account, tx)

        new_total = vault.functions.totalAssets().call()
        new_idle = vault.functions.idleUSDC().call()
        print(f"[{name}] Funded. Total: {new_total/1e18:.0f} | Idle: {new_idle/1e18:.0f}")
        print()

    print("=== DONE ===")
    bal = usdc.functions.balanceOf(addr).call()
    print(f"Remaining USDC balance: {bal/1e18:.0f}")


if __name__ == "__main__":
    main()
