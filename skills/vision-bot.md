# Vision Bot

> Step-by-step instructions for an AI agent to build and run an autonomous Vision prediction market bot.

## Required Environment

```
RPC_URL=http://142.132.164.24/
VISION_API_URL=https://generalmarket.io/api/vision
VISION_ADDRESS=0x4F1BDD073932828bf2822F6dCAD1121Da41ED1Ef
BOT_PRIVATE_KEY=<wallet private key with funded WUSDC>
USDC_ADDRESS=<WUSDC address from deployments/vision-deployment.json>
CHAIN_ID=111222333
```

## CRITICAL: WUSDC on L3 uses 18 decimals (not 6)

```
0.1  USDC =       100_000_000_000_000_000   (1e17)
1    USDC =     1_000_000_000_000_000_000   (1e18)
10   USDC =    10_000_000_000_000_000_000   (1e19)
100  USDC =   100_000_000_000_000_000_000   (1e20)
```

Min stake per tick: 100000000000000000 (0.1 USDC, 1e17).

## Dependencies

Python: `pip install web3 requests`
TypeScript: `npm install viem ethers`

## Step 1: Initialize Web3 and Contracts

```python
from web3 import Web3
import requests
import os

w3 = Web3(Web3.HTTPProvider(os.environ["RPC_URL"]))
account = w3.eth.account.from_key(os.environ["BOT_PRIVATE_KEY"])
bot_address = account.address

VISION_ADDRESS = Web3.to_checksum_address(os.environ["VISION_ADDRESS"])
USDC_ADDRESS = Web3.to_checksum_address(os.environ["USDC_ADDRESS"])
API_URL = os.environ.get("VISION_API_URL", "https://generalmarket.io/api/vision")

VISION_ABI = [
    {
        "name": "joinBatch",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "depositAmount", "type": "uint256"},
            {"name": "stakePerTick", "type": "uint256"},
            {"name": "bitmapHash", "type": "bytes32"},
        ],
        "outputs": [],
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
            {
                "name": "",
                "type": "tuple",
                "components": [
                    {"name": "bitmapHash", "type": "bytes32"},
                    {"name": "stakePerTick", "type": "uint256"},
                    {"name": "startTick", "type": "uint256"},
                    {"name": "balance", "type": "uint256"},
                    {"name": "lastClaimedTick", "type": "uint256"},
                    {"name": "joinTimestamp", "type": "uint256"},
                    {"name": "totalDeposited", "type": "uint256"},
                    {"name": "totalClaimed", "type": "uint256"},
                ],
            }
        ],
    },
    {
        "name": "registerBot",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "endpoint", "type": "string"},
            {"name": "pubkeyHash", "type": "bytes32"},
        ],
        "outputs": [],
    },
    {
        "name": "updateBitmap",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "newBitmapHash", "type": "bytes32"},
        ],
        "outputs": [],
    },
]

ERC20_ABI = [
    {
        "name": "approve",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

vision = w3.eth.contract(address=VISION_ADDRESS, abi=VISION_ABI)
usdc = w3.eth.contract(address=USDC_ADDRESS, abi=ERC20_ABI)
```

## Step 2: Register Bot (one-time)

```python
def register_bot():
    endpoint = "https://my-bot.example.com"
    pubkey_hash = Web3.keccak(text=f"bot-{bot_address}")
    tx = vision.functions.registerBot(endpoint, pubkey_hash).build_transaction({
        "from": bot_address,
        "gas": 200_000,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(bot_address),
    })
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    w3.eth.wait_for_transaction_receipt(tx_hash)
```

If `BotAlreadyRegistered` error: bot is already registered, skip this step.

## Step 3: Poll Active Batches

```python
def fetch_batches():
    resp = requests.get(f"{API_URL}/vision/batches", timeout=10)
    resp.raise_for_status()
    return resp.json()["batches"]

batches = fetch_batches()
# Each batch: { id, creator, market_ids, market_count, tick_duration, player_count, tvl, paused }
```

Filter out `paused: true` batches. Check if already joined by calling `getPosition`.

## Step 4: Encode Bitmap

```python
import math

def encode_bitmap(predictions: list[bool]) -> bytes:
    """Encode UP/DOWN predictions. True=UP(1), False=DOWN(0). Big-endian bit packing."""
    byte_count = math.ceil(len(predictions) / 8)
    bitmap = bytearray(byte_count)
    for i, is_up in enumerate(predictions):
        if is_up:
            byte_idx = i // 8
            bit_idx = 7 - (i % 8)  # big-endian: bit 0 = MSB
            bitmap[byte_idx] |= (1 << bit_idx)
    return bytes(bitmap)

def hash_bitmap(bitmap: bytes) -> bytes:
    return Web3.keccak(bitmap)

# Example: 5 markets, predict [UP, DOWN, UP, UP, DOWN]
predictions = [True, False, True, True, False]
bitmap = encode_bitmap(predictions)
bitmap_hash = hash_bitmap(bitmap)
bitmap_hex = "0x" + bitmap.hex()
```

See [vision-bitmap.md](./vision-bitmap.md) for full encoding spec.

## Step 5: Approve USDC + Join Batch

```python
DEPOSIT = 10_000_000_000_000_000_000   # 10 WUSDC (18 decimals on L3)
STAKE   = 1_000_000_000_000_000_000    # 1 WUSDC per tick per market

def sign_and_send(tx):
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return receipt

def join_batch(batch_id, market_count):
    # Generate predictions (replace with your strategy)
    predictions = [True] * market_count  # all UP as default
    bitmap = encode_bitmap(predictions)
    bitmap_hash = hash_bitmap(bitmap)
    bitmap_hex = "0x" + bitmap.hex()

    # 1. Approve USDC
    approve_tx = usdc.functions.approve(VISION_ADDRESS, DEPOSIT).build_transaction({
        "from": bot_address,
        "gas": 200_000,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(bot_address),
    })
    sign_and_send(approve_tx)

    # 2. Join on-chain (commits bitmap hash)
    join_tx = vision.functions.joinBatch(
        batch_id, DEPOSIT, STAKE, bitmap_hash
    ).build_transaction({
        "from": bot_address,
        "gas": 500_000,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(bot_address),
    })
    sign_and_send(join_tx)

    return bitmap_hex, "0x" + bitmap_hash.hex()
```

## Step 6: Submit Bitmap to Oracles

Must happen AFTER on-chain join is confirmed. Wait a few seconds for chain indexer to detect the join event.

```python
import time

def submit_bitmap(batch_id, bitmap_hex, expected_hash):
    time.sleep(5)  # wait for chain indexer

    resp = requests.post(
        f"{API_URL}/vision/bitmap",
        json={
            "player": bot_address,
            "batch_id": batch_id,
            "bitmap_hex": bitmap_hex,
            "expected_hash": expected_hash,
        },
        timeout=10,
    )
    resp.raise_for_status()
    result = resp.json()
    assert result["accepted"], f"Bitmap rejected: {result}"
    return result
```

If bitmap rejected (400):
- `expected_hash does not match on-chain commitment`: re-check keccak256(bitmap) matches what you passed to joinBatch
- `Player is not registered` (404): chain indexer has not detected your join yet, retry after 5 more seconds

## Step 7: Update Bitmap (for subsequent ticks)

To change predictions without leaving the batch:

```python
def update_bitmap(batch_id, new_predictions):
    bitmap = encode_bitmap(new_predictions)
    new_hash = hash_bitmap(bitmap)
    bitmap_hex = "0x" + bitmap.hex()

    # 1. Update hash on-chain
    tx = vision.functions.updateBitmap(batch_id, new_hash).build_transaction({
        "from": bot_address,
        "gas": 200_000,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(bot_address),
    })
    sign_and_send(tx)

    # 2. Submit new bitmap to oracles
    submit_bitmap(batch_id, bitmap_hex, "0x" + new_hash.hex())
```

## Step 8: Claim Rewards

Requires BLS-signed balance proof from oracles. The claim flow:

```python
def check_balance(batch_id):
    resp = requests.get(
        f"{API_URL}/vision/balance/{batch_id}/{bot_address}",
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()

# Response: { batch_id, player, balance, stake_per_tick }
# In production, also returns bls_signature for on-chain claim.
```

On-chain claim requires aggregated BLS signatures from 2/3+ oracles:

```python
# When BLS proofs are available:
# vision.functions.claimRewards(batchId, fromTick, toTick, newBalance, aggregatedBlsSig)
```

## Full Loop

```python
import time

POLL_INTERVAL = 30  # seconds

joined_batches = set()

while True:
    batches = fetch_batches()
    for batch in batches:
        if batch["paused"] or batch["id"] in joined_batches:
            continue

        # Check if already joined
        pos = vision.functions.getPosition(batch["id"], bot_address).call()
        if pos[3] > 0:  # balance > 0
            joined_batches.add(batch["id"])
            continue

        # Join
        bitmap_hex, bitmap_hash = join_batch(batch["id"], batch["market_count"])
        submit_bitmap(batch["id"], bitmap_hex, bitmap_hash)
        joined_batches.add(batch["id"])

    # Check balances for joined batches
    for batch_id in joined_batches:
        balance_info = check_balance(batch_id)
        balance_usdc = int(balance_info["balance"]) / 1e18
        print(f"Batch {batch_id}: {balance_usdc:.2f} USDC")

    time.sleep(POLL_INTERVAL)
```

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `AlreadyJoined` | Already in batch | Use `deposit()` to add funds or `updateBitmap()` to change predictions |
| `InsufficientDeposit` | depositAmount < stakePerTick | Increase deposit amount |
| `StakeBelowMinimum` | stakePerTick < 1e17 | Set stake >= 0.1 USDC (1e17) |
| `BatchNotFound` | Invalid batch ID | Re-fetch batches from API |
| `BatchPaused` | Batch suspended | Skip this batch, try another |
| `BotAlreadyRegistered` | Already registered | Skip registration step |
| Bitmap 404 | Chain indexer lag | Wait 5-10 seconds after join, retry |
| Bitmap 400 hash mismatch | Hash mismatch | Verify keccak256(bitmap_bytes) == on-chain commitment |
