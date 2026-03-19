#!/usr/bin/env python3
"""Fix null bitmap hashes for all bot positions by calling Vision.updateBitmap().

Run inside a bot container or with BOT_PRIVATE_KEY set:
  docker exec swarm-bot-0 python3 /app/scripts/fix-null-bitmaps.py
"""
import os, sys, time, random, hashlib
sys.path.insert(0, "/app")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from web3 import Web3
from eth_account import Account

RPC = os.environ.get("L3_RPC_URL", "http://142.132.164.24/")
VISION_ADDR = os.environ.get("VISION_ADDRESS", "0xd5ec37ffa8c40b5dbaf7ffe9d9878c3a387ad47a")
ORACLE_URLS = ["http://localhost:10001", "http://localhost:10002", "http://localhost:10003"]
PRIVATE_KEY = os.environ.get("BOT_PRIVATE_KEY", "")

if not PRIVATE_KEY:
    print("BOT_PRIVATE_KEY required")
    sys.exit(1)

w3 = Web3(Web3.HTTPProvider(RPC))
acct = Account.from_key(PRIVATE_KEY)
print(f"Bot: {acct.address}")
print(f"Vision: {VISION_ADDR}")

VISION_ABI = [
    {"name": "nextBatchId", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint256"}]},
    {"name": "getPosition", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "batchId", "type": "uint256"}, {"name": "player", "type": "address"}],
     "outputs": [
         {"name": "bitmapHash", "type": "bytes32"}, {"name": "configHash", "type": "bytes32"},
         {"name": "stakePerTick", "type": "uint256"}, {"name": "startTick", "type": "uint256"},
         {"name": "balance", "type": "uint256"}, {"name": "lastClaimedTick", "type": "uint256"},
         {"name": "joinTimestamp", "type": "uint256"}, {"name": "totalDeposited", "type": "uint256"},
         {"name": "totalClaimed", "type": "uint256"},
     ]},
    {"name": "updateBitmap", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "batchId", "type": "uint256"}, {"name": "configHash", "type": "bytes32"}, {"name": "newBitmapHash", "type": "bytes32"}],
     "outputs": []},
    {"name": "getBatch", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "batchId", "type": "uint256"}],
     "outputs": [{"name": "creator", "type": "address"}, {"name": "sourceId", "type": "bytes32"}, {"name": "configHash", "type": "bytes32"}, {"name": "nextConfigHash", "type": "bytes32"}, {"name": "tickDuration", "type": "uint256"}, {"name": "lockOffset", "type": "uint256"}, {"name": "nextLockOffset", "type": "uint256"}, {"name": "createdAtTick", "type": "uint256"}, {"name": "lastPromotionTick", "type": "uint256"}, {"name": "paused", "type": "bool"}]},
]

vision = w3.eth.contract(address=Web3.to_checksum_address(VISION_ADDR), abi=VISION_ABI)
NULL_HASH = bytes.fromhex("c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")

batch_count = vision.functions.nextBatchId().call()
print(f"Total batches: {batch_count}")

# Generate a deterministic bitmap per batch using bot key as seed
key_seed = int(hashlib.sha256(PRIVATE_KEY.encode()).hexdigest(), 16) % (2**32)
rng = random.Random(key_seed)

fixed = 0
skipped = 0
for batch_id in range(batch_count):
    try:
        pos = vision.functions.getPosition(batch_id, acct.address).call()
        bitmap_hash = pos[0]  # bytes32
        join_ts = pos[6]

        if join_ts == 0:
            continue  # not joined

        if bitmap_hash == NULL_HASH or bitmap_hash == b'\x00' * 32:
            # Generate random bitmap and hash it
            market_count = 20  # reasonable default
            bitmap_bytes = bytes([rng.randint(0, 255) for _ in range((market_count + 7) // 8)])
            new_hash = Web3.keccak(bitmap_bytes)

            # Read the batch's active configHash from chain
            batch_info = vision.functions.getBatch(batch_id).call()
            config_hash = batch_info[2]  # configHash is 3rd field

            print(f"Batch {batch_id}: null hash → updating (configHash={config_hash.hex()[:16]}...)...")

            nonce = w3.eth.get_transaction_count(acct.address)
            tx = vision.functions.updateBitmap(batch_id, config_hash, new_hash).build_transaction({
                'from': acct.address,
                'nonce': nonce,
                'gas': 200000,
                'gasPrice': w3.eth.gas_price,
            })
            signed = acct.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)

            if receipt.status == 1:
                # Submit bitmap to oracles
                import requests
                for url in ORACLE_URLS:
                    try:
                        resp = requests.post(f"{url}/vision/bitmap", json={
                            "player": acct.address,
                            "batch_id": batch_id,
                            "bitmap_hex": "0x" + bitmap_bytes.hex(),
                            "expected_hash": "0x" + new_hash.hex(),
                        }, timeout=10)
                        if resp.ok:
                            print(f"  Oracle {url}: accepted")
                        else:
                            print(f"  Oracle {url}: {resp.status_code} {resp.text[:80]}")
                    except Exception as e:
                        print(f"  Oracle {url}: {e}")
                fixed += 1
            else:
                print(f"  TX REVERTED: {tx_hash.hex()}")

            time.sleep(0.5)  # avoid nonce issues
        else:
            skipped += 1
    except Exception as e:
        print(f"Batch {batch_id}: error — {e}")

print(f"\nDone: {fixed} fixed, {skipped} already ok")
