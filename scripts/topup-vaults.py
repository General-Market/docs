#!/usr/bin/env python3
"""Top up every Vision vault from its current balance to 10,000 USDC.
Reads vault addresses from frontend/data/fund-branding.json (the deploy script
just updated this with the live addresses). For each vault, computes
target - current and runs requestDeposit + claimDeposit for the delta.
"""
import json, os, sys, time, logging
from pathlib import Path
from web3 import Web3

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("topup")

TARGET = 10_000 * 10**18  # 10,000 USDC
USDC = Web3.to_checksum_address("0xADDb799BC1499b224DC4368E92b9042a54908553")
RPC = "http://142.132.164.24/"
ROOT = Path(__file__).resolve().parent.parent
BRANDING_PATH = ROOT / "frontend" / "data" / "fund-branding.json"

VAULT_ABI = [
    {"name": "totalAssets", "type": "function", "stateMutability": "view",
     "inputs": [], "outputs": [{"name": "", "type": "uint256"}]},
    {"name": "requestDeposit", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "assets", "type": "uint256"}, {"name": "controller", "type": "address"}, {"name": "owner", "type": "address"}],
     "outputs": [{"name": "", "type": "uint256"}]},
    {"name": "claimDeposit", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "receiver", "type": "address"}, {"name": "controller", "type": "address"}],
     "outputs": [{"name": "", "type": "uint256"}]},
]

ERC20_ABI = [
    {"name": "approve", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
     "outputs": [{"name": "", "type": "bool"}]},
    {"name": "balanceOf", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "", "type": "address"}], "outputs": [{"name": "", "type": "uint256"}]},
]


def send(w3, account, tx):
    signed = account.sign_transaction(tx)
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    r = w3.eth.wait_for_transaction_receipt(h, timeout=120)
    if r["status"] != 1:
        raise RuntimeError(f"reverted: {h.hex()}")
    return r


def build(w3, deployer, gas=300_000):
    return {
        "from": deployer,
        "gas": gas,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(deployer, "pending"),
        "chainId": w3.eth.chain_id,
    }


def main():
    key = os.environ.get(
        "DEPLOYER_KEY",
        "0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537",
    )
    w3 = Web3(Web3.HTTPProvider(RPC, request_kwargs={"timeout": 60}))
    if not w3.is_connected():
        log.error("RPC down")
        sys.exit(1)

    account = w3.eth.account.from_key(key)
    deployer = account.address
    log.info(f"Deployer: {deployer}")

    catalog = json.loads(BRANDING_PATH.read_text())
    vaults = [(f["symbol"], f["name"], f["vault"]) for f in catalog["funds"] if f.get("vault")]
    log.info(f"Vaults to top up: {len(vaults)}")

    usdc = w3.eth.contract(address=USDC, abi=ERC20_ABI)
    bal = usdc.functions.balanceOf(deployer).call()
    log.info(f"Deployer USDC: {bal / 1e18:,.2f}")

    topped = 0
    skipped = 0
    failed = 0
    total_added = 0

    for sym, name, vaddr in vaults:
        vaddr = Web3.to_checksum_address(vaddr)
        vault = w3.eth.contract(address=vaddr, abi=VAULT_ABI)
        try:
            current = vault.functions.totalAssets().call()
        except Exception as e:
            log.warning(f"[{sym}] totalAssets read failed: {e}")
            failed += 1
            continue

        if current >= TARGET:
            skipped += 1
            continue

        delta = TARGET - current
        log.info(f"[TOPUP] {sym} — {name}: {current/1e18:.2f} -> 10000.00 (+{delta/1e18:.2f})")

        try:
            # approve
            tx = usdc.functions.approve(vaddr, delta).build_transaction(build(w3, deployer))
            send(w3, account, tx)
            # requestDeposit
            tx = vault.functions.requestDeposit(delta, deployer, deployer).build_transaction(build(w3, deployer, gas=500_000))
            send(w3, account, tx)
            # claimDeposit
            tx = vault.functions.claimDeposit(deployer, deployer).build_transaction(build(w3, deployer, gas=500_000))
            send(w3, account, tx)
            topped += 1
            total_added += delta
        except Exception as e:
            log.error(f"[{sym}] FAILED: {e}")
            failed += 1

    log.info(f"Done: {topped} topped, {skipped} skipped, {failed} failed, +{total_added/1e18:,.2f} USDC added")


if __name__ == "__main__":
    main()
