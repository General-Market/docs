#!/usr/bin/env python3
"""For vaults where pendingDeposit > totalAssets, top up the difference
+ a small buffer so claimDeposit can succeed without underflow, then claim.
"""
import json, os, sys, logging
from pathlib import Path
from web3 import Web3

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("heal2")

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

ERC20_ABI = [
    {"name": "transfer", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}],
     "outputs": [{"name": "", "type": "bool"}]},
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
    account = w3.eth.account.from_key(key)
    deployer = account.address
    log.info(f"Deployer: {deployer}")

    catalog = json.loads(BRANDING_PATH.read_text())
    vaults = [(f["symbol"], f["name"], f["vault"]) for f in catalog["funds"] if f.get("vault")]
    log.info(f"Vaults: {len(vaults)}")

    usdc = w3.eth.contract(address=USDC, abi=ERC20_ABI)
    fixed = 0
    skipped = 0
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

        # Healthy: skip.
        if pending == 0:
            skipped += 1
            continue

        # Existing-assets check matches the contract math:
        # existingAssets = totalAssets() - pending. If negative, underflow.
        if ta >= pending:
            # Pending is claimable as-is. Try the claim and move on.
            log.info(f"[CLAIM] {sym}: ta={ta/1e18:.2f} pending={pending/1e18:.2f}")
            try:
                tx = vault.functions.claimDeposit(deployer, deployer).build_transaction(build(w3, deployer))
                send(w3, account, tx)
                fixed += 1
            except Exception as e:
                log.error(f"  claim FAILED: {e}")
                failed += 1
            continue

        # Underflow case: contract holds less than the pending request.
        # Transfer the gap directly into the vault as raw USDC. The vault's
        # totalAssets() reads usdc.balanceOf(this) so a plain transfer
        # increases totalAssets without going through requestDeposit.
        gap = pending - ta + 10**16  # +0.01 USDC buffer
        log.info(f"[FILL] {sym}: ta={ta/1e18:.2f} pending={pending/1e18:.2f} -> transfer {gap/1e18:.4f} USDC")
        try:
            tx = usdc.functions.transfer(vaddr, gap).build_transaction(build(w3, deployer, gas=200_000))
            send(w3, account, tx)
            log.info(f"  filled. claiming...")
            tx = vault.functions.claimDeposit(deployer, deployer).build_transaction(build(w3, deployer))
            send(w3, account, tx)
            ts2 = vault.functions.totalSupply().call()
            ta2 = vault.functions.totalAssets().call()
            log.info(f"  -> ts={ts2/1e18:.2f} ta={ta2/1e18:.2f}")
            fixed += 1
        except Exception as e:
            log.error(f"  FAILED: {e}")
            failed += 1

    log.info(f"Done: {fixed} fixed, {skipped} healthy, {failed} failed")


if __name__ == "__main__":
    main()
