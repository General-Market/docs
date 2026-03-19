#!/usr/bin/env python3
"""
Recover poisoned Vision positions — those joined with bitmapHash = bytes32(0).

The oracle will never accept a bitmap for a position whose on-chain bitmapHash
is bytes32(0) (or keccak256(b"")). This script:

  1. For each bot wallet (read from SWARM_BOT_N_KEY env vars),
     scans all batches for positions with null bitmap hash.
  2. Calls updateBitmap(batchId, configHash=0, newHash) on-chain to
     replace the null hash with a real bitmap commitment.
  3. Submits the bitmap bytes to the oracle API so tick resolution can proceed.

Usage:
    # Dry run (no transactions)
    python3 scripts/recover-poisoned-positions.py --dry-run

    # Live run with all bots
    python3 scripts/recover-poisoned-positions.py

    # Single bot key
    BOT_PRIVATE_KEY=0x... python3 scripts/recover-poisoned-positions.py

Environment (read from swarm.env or individual vars):
    SWARM_BOT_0_KEY ... SWARM_BOT_9_KEY  — bot private keys
    BOT_PRIVATE_KEY                       — single bot key (overrides swarm)
    L3_RPC_URL                            — L3 RPC (default: http://142.132.164.24/)
    VISION_API_URL                        — oracle API (default: http://116.203.156.98/oracle1)
"""

import argparse
import json
import os
import sys
import time

import requests
from eth_abi.packed import encode_packed
from eth_utils import keccak

try:
    from web3 import Web3
except ImportError:
    print("ERROR: web3 not installed. Run: pip install web3")
    sys.exit(1)

# ── Config ──────────────────────────────────────────────────────────────────

NULL_HASH_BYTES32 = b"\x00" * 32
NULL_KECCAK_HEX = "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"

DEFAULT_RPC = "http://142.132.164.24/"
DEFAULT_ORACLE_URLS = [
    "http://116.203.156.98/oracle1",
    "http://116.203.156.98/oracle2",
    "http://116.203.156.98/oracle3",
]

# ── Minimal ABI ─────────────────────────────────────────────────────────────

VISION_ABI = [
    {
        "name": "nextBatchId",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"type": "uint256"}],
    },
    {
        "name": "getPosition",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "player", "type": "address"},
        ],
        "outputs": [
            {"name": "bitmapHash", "type": "bytes32"},
            {"name": "configHash", "type": "bytes32"},
            {"name": "stakePerTick", "type": "uint256"},
            {"name": "startTick", "type": "uint256"},
            {"name": "balance", "type": "uint256"},
            {"name": "lastClaimedTick", "type": "uint256"},
            {"name": "joinTimestamp", "type": "uint256"},
            {"name": "totalDeposited", "type": "uint256"},
            {"name": "isVirtual", "type": "bool"},
        ],
    },
    {
        "name": "getBatch",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "batchId", "type": "uint256"}],
        "outputs": [
            {"name": "creator", "type": "address"},
            {"name": "sourceId", "type": "bytes32"},
            {"name": "configHash", "type": "bytes32"},
            {"name": "nextConfigHash", "type": "bytes32"},
            {"name": "tickDuration", "type": "uint256"},
            {"name": "lockOffset", "type": "uint256"},
            {"name": "nextLockOffset", "type": "uint256"},
            {"name": "nextTickDuration", "type": "uint256"},
            {"name": "epochOffset", "type": "int256"},
            {"name": "createdAtTick", "type": "uint256"},
            {"name": "lastPromotionTick", "type": "uint256"},
            {"name": "paused", "type": "bool"},
        ],
    },
    {
        "name": "updateBitmap",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "configHash", "type": "bytes32"},
            {"name": "newHash", "type": "bytes32"},
        ],
        "outputs": [],
    },
]


def load_deployment():
    paths = [
        "envs/testnet/deployment.json",
        "deployments/active-deployment.json",
        os.path.join(os.path.dirname(__file__), "..", "envs", "testnet", "deployment.json"),
    ]
    for p in paths:
        if os.path.exists(p):
            with open(p) as f:
                return json.load(f)
    raise FileNotFoundError("Cannot find deployment.json")


def get_bot_keys():
    """Collect bot private keys from environment."""
    single = os.environ.get("BOT_PRIVATE_KEY")
    if single:
        return [single]

    keys = []
    for i in range(10):
        k = os.environ.get(f"SWARM_BOT_{i}_KEY")
        if k:
            keys.append(k)

    if not keys:
        print("ERROR: No bot keys found. Set BOT_PRIVATE_KEY or SWARM_BOT_0_KEY..SWARM_BOT_9_KEY")
        sys.exit(1)

    return keys


def encode_bitmap(market_count: int) -> bytes:
    """Generate a simple all-UP bitmap for recovery purposes."""
    # All 1 bits = predict UP for all markets
    # Length: ceil(market_count / 8) bytes
    byte_count = (market_count + 7) // 8
    return b"\xff" * byte_count


def hash_bitmap(bitmap: bytes) -> bytes:
    """keccak256 of bitmap bytes."""
    return keccak(bitmap)


def submit_bitmap_to_oracle(oracle_url: str, player: str, batch_id: int,
                             bitmap: bytes, bitmap_hash: bytes) -> bool:
    """Submit bitmap to oracle API. Returns True on success."""
    try:
        resp = requests.post(
            f"{oracle_url}/vision/bitmap",
            json={
                "player": player,
                "batch_id": batch_id,
                "bitmap_hex": "0x" + bitmap.hex(),
                "expected_hash": "0x" + bitmap_hash.hex(),
            },
            timeout=10,
        )
        if resp.status_code == 200:
            return True
        else:
            print(f"    Oracle {oracle_url}: HTTP {resp.status_code} — {resp.text[:100]}")
            return False
    except Exception as e:
        print(f"    Oracle {oracle_url}: {e}")
        return False


def is_null_hash(hash_bytes: bytes) -> bool:
    """Return True if the hash is bytes32(0) or keccak256(empty)."""
    if hash_bytes == NULL_HASH_BYTES32:
        return True
    if hash_bytes.hex() == NULL_KECCAK_HEX:
        return True
    return False


def recover_bot(private_key: str, vision_addr: str, rpc_url: str,
                oracle_urls: list, dry_run: bool):
    """Scan and recover all poisoned positions for one bot."""
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    account = w3.eth.account.from_key(private_key)
    bot_addr = account.address
    vision = w3.eth.contract(address=Web3.to_checksum_address(vision_addr), abi=VISION_ABI)

    print(f"\nBot: {bot_addr}")

    total_batches = vision.functions.nextBatchId().call()
    print(f"  Scanning {total_batches} batches...")

    poisoned = []
    for batch_id in range(total_batches):
        pos = vision.functions.getPosition(batch_id, bot_addr).call()
        stake_per_tick = pos[2]
        bitmap_hash_bytes = pos[0]  # bytes32
        join_timestamp = pos[6]

        # Not in this batch
        if join_timestamp == 0 or stake_per_tick == 0:
            continue

        if is_null_hash(bitmap_hash_bytes):
            config_hash_bytes = pos[1]  # configHash from position
            balance = pos[4]
            print(
                f"  Batch {batch_id}: POISONED"
                f" (balance={balance / 1e18:.2f} USDC,"
                f" configHash=0x{config_hash_bytes.hex()[:16]}...)"
            )
            poisoned.append((batch_id, config_hash_bytes, balance))
        else:
            print(f"  Batch {batch_id}: OK (bitmapHash=0x{bitmap_hash_bytes.hex()[:16]}...)")

    if not poisoned:
        print("  No poisoned positions found.")
        return

    print(f"\n  Found {len(poisoned)} poisoned positions. Recovering...")

    for batch_id, config_hash_bytes, balance in poisoned:
        print(f"\n  Batch {batch_id}:")

        # Determine market count from oracle API (try first oracle)
        market_count = 10  # fallback
        for oracle_url in oracle_urls:
            try:
                resp = requests.get(f"{oracle_url}/vision/batch/{batch_id}/state", timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    mc = data.get("market_count", 0)
                    if mc > 0:
                        market_count = mc
                        print(f"    Market count: {market_count}")
                        break
            except Exception:
                pass

        # Generate recovery bitmap (all-UP is fine — it's a valid commitment)
        bitmap = encode_bitmap(market_count)
        bitmap_hash = hash_bitmap(bitmap)
        print(f"    Recovery bitmap: {len(bitmap)} bytes, hash=0x{bitmap_hash.hex()[:16]}...")

        if dry_run:
            print(f"    [DRY RUN] Would call updateBitmap({batch_id}, 0x{config_hash_bytes.hex()[:16]}..., 0x{bitmap_hash.hex()[:16]}...)")
            print(f"    [DRY RUN] Would submit bitmap to {len(oracle_urls)} oracles")
            continue

        # Step 1: Update bitmap hash on-chain
        try:
            tx = vision.functions.updateBitmap(
                batch_id, config_hash_bytes, bitmap_hash
            ).build_transaction({
                "from": bot_addr,
                "gas": 300_000,
                "gasPrice": w3.eth.gas_price,
                "nonce": w3.eth.get_transaction_count(bot_addr),
            })
            signed = account.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
            if receipt["status"] == 0:
                print(f"    updateBitmap REVERTED: {tx_hash.hex()}")
                continue
            print(f"    updateBitmap OK: {tx_hash.hex()[:16]}...")
        except Exception as e:
            print(f"    updateBitmap FAILED: {e}")
            continue

        # Brief pause for block propagation
        time.sleep(2)

        # Step 2: Submit bitmap to all oracles
        submitted = 0
        for oracle_url in oracle_urls:
            ok = submit_bitmap_to_oracle(
                oracle_url, bot_addr, batch_id, bitmap, bitmap_hash
            )
            if ok:
                submitted += 1
                print(f"    Submitted to {oracle_url}")
            else:
                print(f"    Failed to submit to {oracle_url}")

        if submitted > 0:
            print(f"    RECOVERED: bitmap accepted by {submitted}/{len(oracle_urls)} oracles")
        else:
            print(f"    WARNING: bitmap update done on-chain but no oracles accepted it")

        # Avoid hammering RPC
        time.sleep(1)


def main():
    parser = argparse.ArgumentParser(description="Recover poisoned Vision positions")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done, no transactions")
    parser.add_argument("--rpc", default=None, help="L3 RPC URL")
    parser.add_argument("--oracle", action="append", help="Oracle URL (can repeat)")
    args = parser.parse_args()

    rpc_url = args.rpc or os.environ.get("L3_RPC_URL", DEFAULT_RPC)
    oracle_urls = args.oracle or DEFAULT_ORACLE_URLS

    deploy = load_deployment()
    vision_addr = deploy["contracts"]["Vision"]
    print(f"Vision contract: {vision_addr}")
    print(f"RPC: {rpc_url}")
    print(f"Oracles: {oracle_urls}")
    if args.dry_run:
        print("DRY RUN MODE — no transactions will be sent\n")

    keys = get_bot_keys()
    print(f"Processing {len(keys)} bot(s)...")

    for key in keys:
        recover_bot(key, vision_addr, rpc_url, oracle_urls, dry_run=args.dry_run)

    print("\nDone.")


if __name__ == "__main__":
    main()
