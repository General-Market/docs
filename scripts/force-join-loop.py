#!/usr/bin/env python3
"""Continuously join new Vision batches with all bot wallets + submit bitmaps."""
import json, os, random, subprocess, time, requests, sys
from eth_account import Account
from eth_hash.auto import keccak

VISION_ADDR = json.load(open('deployments/active-deployment.json'))['contracts']['Vision']
USDC_ADDR = json.load(open('deployments/active-deployment.json'))['contracts']['L3_WUSDC']
RPC = "http://142.132.164.24/"
ORACLE_URLS = ["http://116.203.156.98/oracle1", "http://116.203.156.98/oracle2", "http://116.203.156.98/oracle3"]

KEYS = [
    "0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537",
    "0x38739a2db125ac51f610150b0082699d19439cc42151747ca4001a864e35d3a1",
    "0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61",
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
    "0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1",
    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
    "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
    "0x87f16cedf01e8b8ad1d4f08b206ff5e9bc5823fd0655d6a05c061c8e764b267c",
    "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
    "0x102300a6bae5865f4c236ff820951e320c4fe798043262db594643b8f6d8d160",
    "0x2e0d579dce0d8dc1bd5e6f5cef3ad1699f78b78a1bd5f5de924a0834b7012104",
]

joined_batches = set()  # Track which (batch_id, addr) we already joined

def cast(args, timeout=30):
    r = subprocess.run(["cast"] + args, capture_output=True, text=True, timeout=timeout)
    return r.returncode == 0

def get_active_batches():
    try:
        r = requests.get(f"{ORACLE_URLS[0]}/vision/batches", timeout=10)
        if r.ok:
            return [b for b in r.json().get("batches", []) if not b.get("paused") and b.get("market_count", 0) > 0]
    except:
        pass
    return []

def join_and_submit(key, batch):
    acct = Account.from_key(key)
    addr = acct.address
    bid = batch["id"]
    config_hash = batch.get("config_hash", "0x" + "00" * 32)
    market_count = max(batch.get("market_count", 10), 1)

    pair = (bid, addr)
    if pair in joined_batches:
        return False

    # Generate random bitmap
    num_bytes = (market_count + 7) // 8
    bitmap = bytes([random.randint(0, 255) for _ in range(num_bytes)])
    bitmap_hash = "0x" + keccak(bitmap).hex()

    # Join on-chain
    ok = cast(["send", "--private-key", key, "--rpc-url", RPC, "--chain", "111222333",
        VISION_ADDR, "joinBatchDirect(uint256,bytes32,uint256,uint256,bytes32)",
        str(bid), config_hash,
        "500000000000000000", "500000000000000000",  # 0.5 USDC deposit + stake
        bitmap_hash,
        "--legacy", "--gas-price", "200000000"])

    if not ok:
        # Might already be joined — try updateBitmap instead
        ok = cast(["send", "--private-key", key, "--rpc-url", RPC, "--chain", "111222333",
            VISION_ADDR, "updateBitmap(uint256,bytes32)", str(bid), bitmap_hash,
            "--legacy", "--gas-price", "200000000"])

    if not ok:
        joined_batches.add(pair)  # Don't retry
        return False

    # Submit bitmap to oracles
    bitmap_hex = "0x" + bitmap.hex()
    submitted = 0
    for url in ORACLE_URLS:
        try:
            resp = requests.post(f"{url}/vision/bitmap", json={
                "player": addr, "batchId": bid,
                "bitmap": bitmap_hex, "bitmapHash": bitmap_hash,
            }, timeout=5)
            if resp.ok:
                submitted += 1
        except:
            pass

    joined_batches.add(pair)
    print(f"  {addr[:10]}... joined batch {bid} ({market_count} markets, bitmap→{submitted}/3 oracles)")
    return True

print(f"Force-join loop started with {len(KEYS)} wallets")
print(f"Vision: {VISION_ADDR}")

# Approve max USDC for all wallets (once)
print("Approving USDC for all wallets...")
for key in KEYS:
    cast(["send", "--private-key", key, "--rpc-url", RPC, "--chain", "111222333",
        USDC_ADDR, "approve(address,uint256)", VISION_ADDR, str(2**256-1),
        "--legacy", "--gas-price", "200000000"])
print("Approvals done")

cycle = 0
while True:
    cycle += 1
    batches = get_active_batches()

    # Deduplicate by source — only latest per source
    by_source = {}
    for b in sorted(batches, key=lambda x: -x["id"]):
        src = b.get("source_id", "")
        if src not in by_source:
            by_source[src] = b
    active = list(by_source.values())

    new_joins = 0
    for batch in active:
        for key in KEYS:
            if join_and_submit(key, batch):
                new_joins += 1

    if new_joins > 0:
        print(f"Cycle {cycle}: {new_joins} new joins across {len(active)} batches")

    time.sleep(30)
