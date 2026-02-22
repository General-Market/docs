#!/usr/bin/env python3
"""Vision Bot -- Joins prediction market batches with random bets on Arbitrum."""

import math
import os
import random
import sys
import time

import requests
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

# -- Config -------------------------------------------------------------------

RPC_URL = os.environ.get("RPC_URL", "https://arb1.arbitrum.io/rpc")
VISION_API_URL = os.environ.get("VISION_API_URL", "https://generalmarket.io/api/vision")
VISION_ADDRESS = Web3.to_checksum_address(os.environ["VISION_ADDRESS"])
USDC_ADDRESS = Web3.to_checksum_address(os.environ["USDC_ADDRESS"])
BOT_PRIVATE_KEY = os.environ["BOT_PRIVATE_KEY"]
DEPOSIT_AMOUNT = int(os.environ.get("DEPOSIT_AMOUNT", "10"))
STAKE_PER_TICK = int(os.environ.get("STAKE_PER_TICK", "1"))
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "30"))

USDC_DECIMALS = 6
DEPOSIT_WEI = DEPOSIT_AMOUNT * 10**USDC_DECIMALS
STAKE_WEI = STAKE_PER_TICK * 10**USDC_DECIMALS

# -- ABIs (minimal) -----------------------------------------------------------

VISION_ABI = [
    {"type": "function", "name": "registerBot", "inputs": [{"name": "endpoint", "type": "string"}, {"name": "pubkeyHash", "type": "bytes32"}], "outputs": []},
    {"type": "function", "name": "joinBatch", "inputs": [{"name": "batchId", "type": "uint256"}, {"name": "depositAmount", "type": "uint256"}, {"name": "stakePerTick", "type": "uint256"}, {"name": "bitmapHash", "type": "bytes32"}], "outputs": []},
    {"type": "function", "name": "claimRewards", "inputs": [{"name": "batchId", "type": "uint256"}, {"name": "fromTick", "type": "uint256"}, {"name": "toTick", "type": "uint256"}, {"name": "newBalance", "type": "uint256"}, {"name": "blsSignature", "type": "bytes"}], "outputs": []},
    {"type": "function", "name": "withdraw", "inputs": [{"name": "batchId", "type": "uint256"}, {"name": "finalBalance", "type": "uint256"}, {"name": "blsSignature", "type": "bytes"}], "outputs": []},
]

ERC20_ABI = [
    {"type": "function", "name": "approve", "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}], "outputs": [{"name": "", "type": "bool"}]},
]

# -- Helpers ------------------------------------------------------------------

w3 = Web3(Web3.HTTPProvider(RPC_URL))
account = w3.eth.account.from_key(BOT_PRIVATE_KEY)
vision = w3.eth.contract(address=VISION_ADDRESS, abi=VISION_ABI)
usdc = w3.eth.contract(address=USDC_ADDRESS, abi=ERC20_ABI)
joined: set[int] = set()


def send_tx(tx: dict) -> str:
    tx["nonce"] = w3.eth.get_transaction_count(account.address)
    tx["gasPrice"] = w3.eth.gas_price
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    w3.eth.wait_for_transaction_receipt(tx_hash)
    return tx_hash.hex()


def encode_bitmap(bets: list[bool]) -> bytes:
    """Encode bets into big-endian packed bitmap. True=UP(1), False=DOWN(0)."""
    byte_count = math.ceil(len(bets) / 8)
    bitmap = bytearray(byte_count)
    for i, bet in enumerate(bets):
        if bet:
            bitmap[i // 8] |= 1 << (7 - (i % 8))
    return bytes(bitmap)


def random_bets(n: int) -> list[bool]:
    return [random.choice([True, False]) for _ in range(n)]


# -- Bot lifecycle ------------------------------------------------------------

def register():
    """Register bot on-chain (idempotent -- reverts if already registered)."""
    endpoint = "https://my-bot.example.com"
    pubkey_hash = Web3.keccak(text=f"bot-{account.address}")
    try:
        tx = vision.functions.registerBot(endpoint, pubkey_hash).build_transaction(
            {"from": account.address, "gas": 200_000}
        )
        send_tx(tx)
        print(f"[+] Registered bot {account.address}")
    except Exception as e:
        print(f"[*] Registration skipped: {e}")


def join_batch(batch_id: int, market_count: int):
    bets = random_bets(market_count)
    bitmap = encode_bitmap(bets)
    bitmap_hash = Web3.keccak(bitmap)

    ups = sum(bets)
    print(f"[>] Batch {batch_id}: {market_count} markets, {ups} UP / {market_count - ups} DOWN")

    # 1. Approve USDC
    tx = usdc.functions.approve(VISION_ADDRESS, DEPOSIT_WEI).build_transaction(
        {"from": account.address, "gas": 100_000}
    )
    send_tx(tx)

    # 2. Join on-chain
    tx = vision.functions.joinBatch(batch_id, DEPOSIT_WEI, STAKE_WEI, bitmap_hash).build_transaction(
        {"from": account.address, "gas": 500_000}
    )
    send_tx(tx)

    # 3. Wait for indexer to detect the join
    print("[*] Waiting 6s for chain indexer...")
    time.sleep(6)

    # 4. Submit bitmap to API
    resp = requests.post(
        f"{VISION_API_URL}/vision/bitmap",
        json={
            "player": account.address,
            "batch_id": batch_id,
            "bitmap_hex": "0x" + bitmap.hex(),
            "expected_hash": "0x" + bitmap_hash.hex(),
        },
        timeout=10,
    )
    if resp.ok:
        print(f"[+] Bitmap accepted for batch {batch_id}")
    else:
        print(f"[!] Bitmap rejected: {resp.status_code} {resp.text[:200]}")

    joined.add(batch_id)


def check_claims():
    """Check and claim any available rewards."""
    for batch_id in joined:
        try:
            resp = requests.get(
                f"{VISION_API_URL}/vision/balance/{batch_id}/{account.address}", timeout=10
            )
            if not resp.ok:
                continue
            data = resp.json()
            if data.get("claimable", 0) > 0 and data.get("bls_signature"):
                tx = vision.functions.claimRewards(
                    batch_id, data["from_tick"], data["to_tick"],
                    data["new_balance"], bytes.fromhex(data["bls_signature"][2:]),
                ).build_transaction({"from": account.address, "gas": 300_000})
                send_tx(tx)
                print(f"[+] Claimed rewards for batch {batch_id}")
        except Exception as e:
            print(f"[!] Claim check failed for batch {batch_id}: {e}")


# -- Main loop ----------------------------------------------------------------

def main():
    print(f"Vision Bot | {account.address} | chain {w3.eth.chain_id}")
    register()

    while True:
        try:
            resp = requests.get(f"{VISION_API_URL}/vision/batches", timeout=10)
            batches = resp.json().get("batches", []) if resp.ok else []

            for batch in batches:
                bid = batch.get("id", batch.get("batch_id"))
                if bid is None or bid in joined or batch.get("paused"):
                    continue
                market_count = batch.get("market_count", len(batch.get("market_ids", [])))
                if market_count > 0:
                    join_batch(bid, market_count)

            check_claims()
        except Exception as e:
            print(f"[!] Error: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
