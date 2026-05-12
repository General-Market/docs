#!/usr/bin/env python3
"""Vision vault manager bot.

One process, one strategy module, one vault. The strategy turns a list of
market_ids into a list of UP/DOWN bets. The runner packs them into the
canonical big-endian bitmap, hashes, and calls VisionVault.joinBatch.
"""

import importlib
import json
import math
import os
import time
from pathlib import Path

import requests
from web3 import Web3
from eth_account import Account


# -- Config -------------------------------------------------------------------

STRATEGY = os.environ["STRATEGY"]
SOURCE_ID = os.environ["SOURCE_ID"]
VAULT_ADDRESS = Web3.to_checksum_address(os.environ["VAULT_ADDRESS"])
MANAGER_PRIVATE_KEY = os.environ["MANAGER_PRIVATE_KEY"]
L3_RPC_URL = os.environ["L3_RPC_URL"]
VISION_ADDRESS = Web3.to_checksum_address(os.environ["VISION_ADDRESS"])
BATCH_VERSION = os.environ.get("BATCH_VERSION", "binance-v1")
DEPOSIT_BPS = int(os.environ.get("DEPOSIT_BPS", "500"))
POLL_SECS = int(os.environ.get("POLL_SECS", "30"))
DATA_NODE_BASE = os.environ.get("DATA_NODE_BASE", "https://api.generalmarket.io")
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"

VISION_ABI = [
    {"type": "function", "name": "latestBatchForSource",
     "inputs": [{"name": "sourceId", "type": "bytes32"}],
     "outputs": [{"name": "", "type": "uint256"}],
     "stateMutability": "view"},
    {"type": "function", "name": "getBatch",
     "inputs": [{"name": "batchId", "type": "uint256"}],
     "outputs": [{"components": [
         {"name": "creator", "type": "address"},
         {"name": "sourceId", "type": "bytes32"},
         {"name": "configHash", "type": "bytes32"},
         {"name": "tickDuration", "type": "uint256"},
         {"name": "lockOffset", "type": "uint256"},
         {"name": "settlementGrace", "type": "uint256"},
         {"name": "createdAtTick", "type": "uint256"},
         {"name": "paused", "type": "bool"},
         {"name": "settled", "type": "bool"},
     ], "name": "", "type": "tuple"}],
     "stateMutability": "view"},
    {"type": "function", "name": "getPosition",
     "inputs": [{"name": "batchId", "type": "uint256"},
                {"name": "player", "type": "address"}],
     "outputs": [{"components": [
         {"name": "bitmapHash", "type": "bytes32"},
         {"name": "configHash", "type": "bytes32"},
         {"name": "joinTimestamp", "type": "uint256"},
         {"name": "totalDeposited", "type": "uint256"},
     ], "name": "", "type": "tuple"}],
     "stateMutability": "view"},
]
SOURCE_ID_BYTES32 = Web3.keccak(text=f"{SOURCE_ID}_{BATCH_VERSION}")


# -- ABI (joinBatch, totalAssets, idleUSDC) -----------------------------------

ABI_PATH = Path(__file__).parent / "vision_vault_abi.json"
if ABI_PATH.exists():
    VISION_VAULT_ABI = json.loads(ABI_PATH.read_text())
else:
    VISION_VAULT_ABI = [
        {"type": "function", "name": "joinBatch",
         "inputs": [{"name": "batchId", "type": "uint256"},
                    {"name": "configHash", "type": "bytes32"},
                    {"name": "depositAmount", "type": "uint256"},
                    {"name": "bitmapHash", "type": "bytes32"}],
         "outputs": [], "stateMutability": "nonpayable"},
        {"type": "function", "name": "totalAssets", "inputs": [],
         "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view"},
        {"type": "function", "name": "idleUSDC", "inputs": [],
         "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view"},
    ]


# -- Setup --------------------------------------------------------------------

strategy_mod = importlib.import_module(f"strategies.{STRATEGY}")

w3 = Web3(Web3.HTTPProvider(L3_RPC_URL))
account = Account.from_key(MANAGER_PRIVATE_KEY)
vault = w3.eth.contract(address=VAULT_ADDRESS, abi=VISION_VAULT_ABI)
vision = w3.eth.contract(address=VISION_ADDRESS, abi=VISION_ABI)


def encode_bitmap(bets: list[bool]) -> bytes:
    """Big-endian within each byte. Bit 0 = MSB of byte 0. Matches
    examples/vision-bitmap-encoder/encode.py — the canonical encoding the
    Vision oracle expects when bitmaps are revealed post-batch."""
    byte_count = math.ceil(len(bets) / 8)
    bitmap = bytearray(byte_count)
    for i, bet in enumerate(bets):
        if bet:
            bitmap[i // 8] |= 1 << (7 - (i % 8))
    return bytes(bitmap)


def send_tx(fn_call) -> str:
    tx = fn_call.build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 800_000,
        "gasPrice": w3.eth.gas_price,
        "chainId": w3.eth.chain_id,
    })
    signed = account.sign_transaction(tx)
    raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
    tx_hash = w3.eth.send_raw_transaction(raw)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    if receipt.status != 1:
        raise RuntimeError(f"tx reverted: {tx_hash.hex()} (gasUsed={receipt.gasUsed})")
    return tx_hash.hex()


def fetch_active_batch() -> dict | None:
    """Read batchId + configHash from on-chain Vision. Markets come from the
    data-node's lookup-by-hash endpoint, which returns the exact market list
    bound to that configHash at batch creation time. Anything else drifts."""
    try:
        batch_id = vision.functions.latestBatchForSource(SOURCE_ID_BYTES32).call()
        if batch_id == 0:
            return None
        batch = vision.functions.getBatch(batch_id).call()
        # tuple order: creator, sourceId, configHash, tickDuration, lockOffset,
        # settlementGrace, createdAtTick, paused, settled
        config_hash_bytes = batch[2]
        settled = batch[8]
        if settled:
            return None
        config_hash_hex = "0x" + config_hash_bytes.hex()
        r = requests.get(
            f"{DATA_NODE_BASE}/batches/config/{config_hash_hex}",
            timeout=10,
        )
        if not r.ok:
            print(f"[fetch_err] /batches/config/{config_hash_hex} → {r.status_code}", flush=True)
            return None
        cfg = r.json()
        markets = cfg.get("markets") or []
        market_ids = [m["assetId"] if isinstance(m, dict) else m for m in markets]
        return {
            "batchId": batch_id,
            "configHash": config_hash_hex,
            "market_ids": market_ids,
        }
    except Exception as e:
        print(f"[fetch_err] {type(e).__name__}: {e}", flush=True)
        return None


def main():
    print(
        f"[init] strategy={STRATEGY} source={SOURCE_ID} vault={VAULT_ADDRESS} "
        f"manager={account.address} chain={w3.eth.chain_id} dry_run={DRY_RUN}",
        flush=True,
    )

    last_batch_id = None

    while True:
        try:
            batch = fetch_active_batch()
            if not batch:
                time.sleep(POLL_SECS)
                continue

            batch_id = batch.get("batchId") or batch.get("batch_id")
            config_hash_hex = batch.get("configHash") or batch.get("config_hash")
            market_ids = batch.get("market_ids") or batch.get("marketIds") or []

            if batch_id is None or config_hash_hex is None or not market_ids:
                print(f"[skip] malformed batch payload: {batch}", flush=True)
                time.sleep(POLL_SECS)
                continue

            if batch_id == last_batch_id:
                time.sleep(POLL_SECS)
                continue

            # On-chain check: skip if the vault already joined this batch.
            # In-memory last_batch_id resets on container restart; this guard
            # survives restarts.
            position = vision.functions.getPosition(int(batch_id), VAULT_ADDRESS).call()
            if position[3] != 0:  # totalDeposited != 0
                print(f"[skip {batch_id}] vault already joined (deposited={position[3]})", flush=True)
                last_batch_id = batch_id
                time.sleep(POLL_SECS)
                continue

            bets = strategy_mod.generate_bets(market_ids)
            assert len(bets) == len(market_ids), (
                f"strategy {STRATEGY} returned {len(bets)} bets for "
                f"{len(market_ids)} markets — refusing to submit"
            )

            bitmap = encode_bitmap(bets)
            bitmap_hash = Web3.keccak(bitmap)
            config_hash = (
                bytes.fromhex(config_hash_hex[2:])
                if config_hash_hex.startswith("0x")
                else bytes.fromhex(config_hash_hex)
            )

            total_assets = vault.functions.totalAssets().call()
            deposit_amount = total_assets * DEPOSIT_BPS // 10000

            ups = sum(bets)
            print(
                f"[batch {batch_id}] markets={len(market_ids)} ups={ups} "
                f"downs={len(bets)-ups} deposit={deposit_amount} "
                f"bitmap_hash=0x{bitmap_hash.hex()}",
                flush=True,
            )

            if DRY_RUN:
                last_batch_id = batch_id
                time.sleep(POLL_SECS)
                continue

            if deposit_amount == 0:
                print("[skip] deposit_amount=0 (vault empty or DEPOSIT_BPS=0)", flush=True)
                last_batch_id = batch_id
                time.sleep(POLL_SECS)
                continue

            tx_hash = send_tx(
                vault.functions.joinBatch(
                    int(batch_id), config_hash, int(deposit_amount), bitmap_hash
                )
            )
            print(f"[joined {batch_id}] tx={tx_hash}", flush=True)
            last_batch_id = batch_id

        except AssertionError as e:
            print(f"[abort] {e}", flush=True)
        except Exception as e:
            print(f"[err] {type(e).__name__}: {e}", flush=True)

        time.sleep(POLL_SECS)


if __name__ == "__main__":
    main()
