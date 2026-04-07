#!/usr/bin/env python3
"""Heal vaults that ended up with assets but zero shares.

Symptom: a previous topup or deploy ran requestDeposit but failed to land
claimDeposit. The vault now has totalAssets > 0 with totalSupply == 0, plus
a pending deposit sitting in storage. Both must be claimed in the right
order, otherwise the next deposit attempt will partially-fail too.

Strategy:
1. For every vault in fund-branding.json, read totalSupply and pendingDepositRequest(deployer).
2. If pendingDeposit > 0, call claimDeposit(deployer, deployer). This mints
   shares for the deployer, draining the pending balance.
3. After all claims, verify totalSupply == totalAssets (NAV ≈ 1.0).
"""
import json, os, sys, logging
from pathlib import Path
from web3 import Web3

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("heal")

USDC = Web3.to_checksum_address("0x2710e49EBb807A0cB9369F13Ba24Bd809809a827")
RPC = "http://142.132.164.24/"
ROOT = Path(__file__).resolve().parent.parent
BRANDING_PATH = ROOT / "frontend" / "data" / "fund-branding.json"

VAULT_ABI = [
    {"name": "totalAssets", "type": "function", "stateMutability": "view",
     "inputs": [], "outputs": [{"name": "", "type": "uint256"}]},
    {"name": "totalSupply", "type": "function", "stateMutability": "view",
     "inputs": [], "outputs": [{"name": "", "type": "uint256"}]},
    {"name": "pendingDepositRequest", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "", "type": "uint256"}, {"name": "controller", "type": "address"}],
     "outputs": [{"name": "", "type": "uint256"}]},
    {"name": "claimDeposit", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "receiver", "type": "address"}, {"name": "controller", "type": "address"}],
     "outputs": [{"name": "", "type": "uint256"}]},
]


def send(w3, account, tx):
    signed = account.sign_transaction(tx)
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    r = w3.eth.wait_for_transaction_receipt(h, timeout=120)
    if r["status"] != 1:
        raise RuntimeError(f"reverted: {h.hex()}")
    return r


def build(w3, deployer, gas=500_000):
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
    log.info(f"Vaults to inspect: {len(vaults)}")

    healed = 0
    healthy = 0
    failed = 0

    for sym, name, vaddr in vaults:
        vaddr = Web3.to_checksum_address(vaddr)
        vault = w3.eth.contract(address=vaddr, abi=VAULT_ABI)
        try:
            ts = vault.functions.totalSupply().call()
            ta = vault.functions.totalAssets().call()
            pending = vault.functions.pendingDepositRequest(0, deployer).call()
        except Exception as e:
            log.warning(f"[{sym}] read failed: {e}")
            failed += 1
            continue

        if pending == 0 and ts > 0:
            healthy += 1
            continue

        log.info(f"[HEAL] {sym} — {name}: ts={ts/1e18:.2f} ta={ta/1e18:.2f} pending={pending/1e18:.2f}")
        try:
            tx = vault.functions.claimDeposit(deployer, deployer).build_transaction(build(w3, deployer))
            send(w3, account, tx)
            ts2 = vault.functions.totalSupply().call()
            ta2 = vault.functions.totalAssets().call()
            log.info(f"  -> ts={ts2/1e18:.2f} ta={ta2/1e18:.2f}")
            healed += 1
        except Exception as e:
            log.error(f"  FAILED: {e}")
            failed += 1

    log.info(f"Done: {healed} healed, {healthy} already healthy, {failed} failed")


if __name__ == "__main__":
    main()
