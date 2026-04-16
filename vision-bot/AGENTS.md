# Vision Bot -- AI Agent Instructions

> You are building an autonomous prediction market bot for General Market Vision.
> Read this file completely before writing any code.

## What is Vision?

Vision is a sealed parimutuel prediction market on Arbitrum. Players predict UP/DOWN on thousands of markets simultaneously (crypto, weather, stocks, sports, etc.) using a bitmap encoding. Every tick (5 minutes), predictions are resolved against real market data. Better predictors win money from worse predictors.

## Available Markets

The full list of live markets is served by the API:

```python
import requests
markets = requests.get("https://generalmarket.io/api/vision/markets", timeout=10).json()["markets"]
# Each: { market_id, symbol, display_name }
```

Or list active batches — each batch already has its market IDs bound:

```python
batches = requests.get("https://generalmarket.io/api/vision/batches", timeout=10).json()["batches"]
```

Markets span crypto, equities, weather, sports, macro, and more. Prefix conventions: `crypto_*`, `equity_*`, `weather_*`, etc.

## Environment

```
# Local development (default — the frontend must be running at localhost:3000)
VISION_API_URL=http://localhost:3000/api
FAUCET_URL=http://localhost:3000/api/bot/faucet

# Chain — unchanged in any environment
RPC_URL=http://142.132.164.24/
VISION_ADDRESS=0x94d540bb45975bd5a0c7ba9a15a0d34e378f6c61
USDC_ADDRESS=0xaddb799bc1499b224dc4368e92b9042a54908553
CHAIN_ID=111222333

# Wallet — generate a fresh one, then fund it via the faucet
BOT_PRIVATE_KEY=<fresh private key>
```

When the production deployment is live, swap both URL env vars to `https://generalmarket.io/...` — nothing else changes.

All Vision endpoints live under `${VISION_API_URL}/vision/...` — the base URL ends in `/api`, not `/api/vision`. The double prefix is the most common first mistake.

## Step 0: Fund the bot

The bot needs two things: L3 GM for gas and L3 USDC for stakes. Both arrive from a single faucet call, rate-limited to one request per IP per 24h.

Start the frontend dev server first (in a separate terminal inside `frontend/`):

```bash
npm run dev   # serves http://localhost:3000
```

Then from your bot script:

```python
import os, requests
from eth_account import Account

FAUCET_URL = os.environ.get("FAUCET_URL", "http://localhost:3000/api/bot/faucet")

# Generate (or load) a wallet.
account = Account.create()  # or: Account.from_key(os.environ["BOT_PRIVATE_KEY"])
print(f"BOT_PRIVATE_KEY={account.key.hex()}")
print(f"Bot address: {account.address}")

# Ask the faucet for gas + USDC. One call, both tokens.
resp = requests.post(FAUCET_URL, json={"address": account.address}, timeout=60)
resp.raise_for_status()
print(resp.json())  # { success, usdc, l3Gas, ... }
```

Response codes:
- `200` — dripped 100 USDC + 1 GM.
- `429` — this IP or address already claimed. Wait 24h.
- `503` — in production, means Upstash env vars are missing. In local dev, the route falls back to an in-memory throttle automatically, so you will not hit this.

## CRITICAL: USDC uses 18 decimals on L3

Vision now lives on Arbitrum Orbit L3, where USDC is deployed at 18 decimals. Treat every USDC value as wei with an implicit 10^18 multiplier — the same units as ether.

```
0.1  USDC =                 100_000_000_000_000_000   (1e17)
1    USDC =               1_000_000_000_000_000_000   (1e18)
10   USDC =              10_000_000_000_000_000_000   (1e19)
100  USDC =             100_000_000_000_000_000_000   (1e20)
```

Min deposit per join: 1e17 wei = 0.1 USDC.

## Contract Details

- **Vision:** `0x94d540bb45975bd5a0c7ba9a15a0d34e378f6c61`
- **USDC (L3):** `0xaddb799bc1499b224dc4368e92b9042a54908553`
- **Chain ID:** `111222333` (Arbitrum Orbit L3)
- **RPC:** `http://142.132.164.24/`
- **USDC decimals:** 18
- **Gas token:** GM (native, 18 decimals)
- **Fee:** 0.05% on profits

## Dependencies

Python: `pip install web3 requests`

## API Reference

Base URL: `https://generalmarket.io/api` (paths below include the `/vision/` prefix — concatenate as-is).

No authentication required.

### Endpoints

```
GET  /vision/batches                          -> { batches: BatchSummary[] }
GET  /vision/markets                          -> { markets: Market[] }
GET  /vision/snapshot                         -> { prices: AssetPrice[] }  (see Step 3b)
GET  /vision/snapshot?source={name}           -> scoped to a single data source
GET  /vision/config/by-hash/{config_hash}     -> { markets: BatchMarket[], sourceId, ... }
GET  /vision/batch/{id}/state                 -> BatchStateResponse
POST /vision/bitmap                           -> { acceptedCount, totalCount, results[] }
     Body: { player, batch_id, bitmap_hex, expected_hash }
     Success when: 200 response AND acceptedCount >= ceil(2 * totalCount / 3) (BFT quorum)
GET  /vision/balance/{batch_id}/{player}      -> { batch_id, player, balance, total_deposited }
GET  /vision/batch/{id}/history               -> { history: TickHistoryEntry[] }
GET  /vision/reveal/{batch_id}/{tick_id}      -> { batch_id, tick_id, bitmaps: RevealedBitmap[] }
POST /vision/backtest                         -> { win_rate, pnl_curve, total_pnl }
     Body: { batch_id, bitmap_hex, code?, ticks? }
GET  /vision/leaderboard                      -> { leaderboard: LeaderboardEntry[], updatedAt }
```

### Types

```
BatchSummary {
  id: number
  creator: string                 // Ethereum address
  config_hash: string             // bytes32 hex — REQUIRED for joinBatchDirect AND for looking up markets (see below)
  source_id: string               // bytes32 hex — may be empty string on the list endpoint
  market_count: number            // 0 means no tradeable markets — skip these
  tick_duration: number           // seconds
  current_tick: number            // Unix timestamp of the current tick boundary
  player_count: number
  tvl: string                     // wei
  paused: boolean
}

// NOTE: market_ids are NOT in BatchSummary — the list endpoint omits them.
// Resolve them from the config hash:
//     GET /vision/config/by-hash/{config_hash} -> { markets: BatchMarket[], ... }

BatchMarket {
  assetId: string                 // e.g. "flight_africa", "crypto_btc"
  resolutionType: string          // "up_x", "flat_x", etc.
  thresholdBps: number
  thresholdSource: string
}

Market {
  market_id: string               // e.g. "BTC-USD"
  symbol: string                  // e.g. "BTC"
  display_name: string            // e.g. "Bitcoin / USD"
}

BatchStateResponse {
  id: number
  creator: string
  market_ids: string[]
  tick_duration: number
  created_at_tick: number
  paused: boolean
  player_count: number
  next_tick: number               // Unix timestamp
  players: PlayerState[]
}

PlayerState {
  address: string
  total_deposited: string         // wei
  balance: string                 // wei
  has_bitmap: boolean
}

TickHistoryEntry {
  batch_id: number
  tick_id: number
  resolved_at: string | null      // ISO 8601
  player_count: number | null
  total_matched: string | null    // wei
  results_json: {
    markets: MarketResult[]
  } | null
}

MarketResult {
  market_id: string
  outcome: "Up" | "Down"
  pct_change: number
}

RevealedBitmap {
  player: string
  bitmap_hex: string
  hash: string                    // keccak256
}

LeaderboardEntry {
  rank: number
  walletAddress: string
  pnl: number                    // USDC
  winRate: number                // 0.0 to 1.0
  roi: number                   // percentage
  totalVolume: number            // USDC
  portfolioBets: number
  avgPortfolioSize: number
  largestPortfolio: number
}
```

### Token Encoding

All `balance`, `tvl`, `total_deposited`, `total_matched` fields are string-encoded wei.
L3 USDC uses 18 decimals: 1 USDC = "1000000000000000000".

### Error Format

```
{ "error": "Human-readable error message" }
```

Status codes: 200 (success), 400 (bad request), 403 (forbidden), 404 (not found), 500 (server error).

## Bot Lifecycle

### Step 1: Initialize Web3 and Contracts

```python
from web3 import Web3
import requests
import os

w3 = Web3(Web3.HTTPProvider(os.environ["RPC_URL"]))
account = w3.eth.account.from_key(os.environ["BOT_PRIVATE_KEY"])
bot_address = account.address
CHAIN_ID = int(os.environ.get("CHAIN_ID", "111222333"))  # required in every tx on Orbit L3

VISION_ADDRESS = Web3.to_checksum_address(os.environ["VISION_ADDRESS"])
USDC_ADDRESS = Web3.to_checksum_address(os.environ["USDC_ADDRESS"])
API_URL = os.environ.get("VISION_API_URL", "http://localhost:3000/api")

VISION_ABI = [
    {
        "name": "joinBatchDirect",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "configHash", "type": "bytes32"},
            {"name": "depositAmount", "type": "uint256"},
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
                    {"name": "configHash", "type": "bytes32"},
                    {"name": "joinTimestamp", "type": "uint256"},
                    {"name": "totalDeposited", "type": "uint256"},
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

### Step 2: Register Bot (optional)

Registration is only needed if you intend to expose a bot endpoint for oracle callbacks. Skipping this step does not prevent joining batches or submitting bitmaps — the `joinBatchDirect` path works for unregistered wallets.

```python
def register_bot():
    endpoint = "https://my-bot.example.com"
    pubkey_hash = Web3.keccak(text=f"bot-{bot_address}")
    tx = vision.functions.registerBot(endpoint, pubkey_hash).build_transaction({
        "from": bot_address,
        "gas": 200_000,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(bot_address),
        "chainId": CHAIN_ID,
    })
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    w3.eth.wait_for_transaction_receipt(tx_hash)
```

If `BotAlreadyRegistered` error: bot is already registered, skip this step.

### Step 3: Poll Active Batches

```python
def fetch_batches():
    resp = requests.get(f"{API_URL}/vision/batches", timeout=10)
    resp.raise_for_status()
    return resp.json()["batches"]

batches = fetch_batches()
# Each batch: { id, creator, config_hash, source_id, market_ids, market_count,
#               tick_duration, current_tick, player_count, tvl, paused }
```

Filter out:
- `paused: true` — suspended batches
- `market_count == 0` — degenerate batches with no tradeable markets (they exist; joining one reverts with a zero-byte bitmap)
- Batches where `getPosition` already shows a non-zero deposit for your wallet

### Step 3b: Fetch market data

Before you can predict, you need two things:

1. **The list of markets in this batch.** `GET /vision/batches` does not include market ids — fetch them from the config:
   ```python
   def fetch_markets_for_batch(config_hash: str) -> list[dict]:
       resp = requests.get(f"{API_URL}/vision/config/by-hash/{config_hash}", timeout=15)
       resp.raise_for_status()
       return resp.json()["markets"]  # list of BatchMarket, length == market_count
   ```

2. **Current prices for those markets.** The snapshot endpoint returns the current value and recent change for every asset:

```
GET /vision/snapshot
  -> { generatedAt, totalAssets, prices: [ AssetPrice, ... ] }

AssetPrice {
  source: string        // e.g. "coingecko"
  assetId: string       // matches market_ids entries
  symbol: string
  name: string
  value: string         // current price — string-encoded decimal, parse to float
  changePct: string | null   // percent change — string, parse to float ("0.0145" = +1.45%)
  volume24h: string | null
  marketCap: string | null
  fetchedAt: string
}
```

Every numeric field comes back as a string. Parse before comparing.

```python
def _as_float(x):
    try: return float(x) if x is not None else None
    except (TypeError, ValueError): return None

def fetch_prices_for(market_ids: list[str]) -> dict:
    resp = requests.get(f"{API_URL}/vision/snapshot", timeout=30)
    resp.raise_for_status()
    by_id = {p["assetId"]: p for p in resp.json()["prices"]}
    out = {}
    for mid in market_ids:
        p = by_id.get(mid)
        if p is None:
            out[mid] = None
            continue
        out[mid] = {
            "assetId": p["assetId"],
            "value": _as_float(p.get("value")),
            "changePct": _as_float(p.get("changePct")),
        }
    return out
```

If `changePct` is `None`, the source has not reported movement yet — your strategy must pick a default (e.g. predict UP, predict DOWN, or skip the bit with `False`).

### Step 3c: Design a strategy

This is not a copy-paste step. The protocol rewards predictions that beat the crowd; a bot that predicts all-UP on every market will lose 0.05% to fees plus whatever the crowd knew that it did not. You must write a real predicate.

Three starting shapes — none optimal, all honest:

```python
def momentum(prices: dict) -> list[bool]:
    """Ride the trend. Predict UP when recent change is positive.
    prices: dict keyed by market_id; values may be None or {assetId, value, changePct}."""
    return [
        ((prices[mid] or {}).get("changePct") or 0.0) >= 0
        for mid in prices
    ]

def mean_reversion(prices: dict, threshold: float = 0.02) -> list[bool]:
    """Fade extremes. If an asset just moved up a lot, predict DOWN next tick.
    threshold is in the same units as changePct (0.02 = 2%)."""
    return [
        ((prices[mid] or {}).get("changePct") or 0.0) < threshold
        for mid in prices
    ]

def time_biased(prices: dict) -> list[bool]:
    """Night rallies, day fades — one market folklore made programmatic."""
    from datetime import datetime, timezone
    hour = datetime.now(timezone.utc).hour
    is_night = hour >= 22 or hour < 6
    return [is_night for _ in prices]
```

Combine, ensemble, or replace. Write your own. The strategy is the only thing this document cannot give you.

### Step 4: Encode Bitmap

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

**Bitmap encoding details:**
- Each market gets one bit: 1 = UP, 0 = DOWN
- Bits are packed big-endian: market 0 is the MSB of byte 0
- The bitmap must have exactly `ceil(market_count / 8)` bytes
- The bitmap hash is `keccak256(bitmap_bytes)`

### Step 5: Approve USDC + Join Batch

```python
DEPOSIT = 10 * 10**18  # 10 USDC (L3 = 18 decimals)

def sign_and_send(tx):
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return receipt

def join_batch(batch, strategy):
    """batch is the dict returned by GET /vision/batches — it carries config_hash
    and market_count. The market IDs come from /vision/config/by-hash/{hash}.

    `strategy` is a function `(prices: dict) -> list[bool]` of length market_count.
    See Step 3c for examples. Do not pass `[True] * n` — that is not a strategy."""
    batch_id = batch["id"]
    market_count = batch["market_count"]
    config_hash_hex = batch["config_hash"]
    config_hash_bytes = bytes.fromhex(config_hash_hex.removeprefix("0x"))

    markets = fetch_markets_for_batch(config_hash_hex)
    market_ids = [m["assetId"] for m in markets]
    assert len(market_ids) == market_count, \
        f"config has {len(market_ids)} markets, batch claims {market_count}"

    prices = fetch_prices_for(market_ids)
    predictions = strategy(prices)
    assert len(predictions) == market_count, \
        f"strategy returned {len(predictions)} bits, expected {market_count}"

    bitmap = encode_bitmap(predictions)
    bitmap_hash = hash_bitmap(bitmap)
    bitmap_hex = "0x" + bitmap.hex()

    # 1. Approve USDC
    approve_tx = usdc.functions.approve(VISION_ADDRESS, DEPOSIT).build_transaction({
        "from": bot_address,
        "gas": 200_000,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(bot_address),
        "chainId": CHAIN_ID,
    })
    sign_and_send(approve_tx)

    # 2. Join on-chain (commits bitmap hash)
    join_tx = vision.functions.joinBatchDirect(
        batch_id, config_hash_bytes, DEPOSIT, bitmap_hash
    ).build_transaction({
        "from": bot_address,
        "gas": 500_000,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(bot_address),
        "chainId": CHAIN_ID,
    })
    sign_and_send(join_tx)

    return bitmap_hex, "0x" + bitmap_hash.hex()
```

### Step 6: Submit Bitmap to Oracles

Must happen AFTER on-chain join is confirmed. Wait a few seconds for chain indexer to detect the join event.

```python
import time

import math

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
    result = resp.json()  # { acceptedCount, totalCount, results: [...] }
    accepted = result.get("acceptedCount", 0)
    total = result.get("totalCount", 0)
    quorum = math.ceil(2 * total / 3) if total else 1
    assert accepted >= quorum, f"Bitmap below quorum: {accepted}/{total}, details={result}"
    return result
```

If bitmap rejected (400):
- `expected_hash does not match on-chain commitment`: re-check keccak256(bitmap) matches what you passed to joinBatch
- `Player is not registered` (404): chain indexer has not detected your join yet, retry after 5 more seconds

### Step 7: Update Bitmap (for subsequent ticks)

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
        "chainId": CHAIN_ID,
    })
    sign_and_send(tx)

    # 2. Submit new bitmap to oracles
    submit_bitmap(batch_id, bitmap_hex, "0x" + new_hash.hex())
```

### Step 8: Claim Rewards

Requires BLS-signed balance proof from oracles. The claim flow:

```python
def check_balance(batch_id):
    resp = requests.get(
        f"{API_URL}/vision/balance/{batch_id}/{bot_address}",
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()

# Response: { batch_id, player, balance, total_deposited }
# In production, also returns bls_signature for on-chain claim.
```

On-chain claim requires aggregated BLS signatures from 2/3+ oracles:

```python
# When BLS proofs are available:
# vision.functions.claimRewards(batchId, fromTick, toTick, newBalance, aggregatedBlsSig)
```

### Full Loop

```python
import time

POLL_INTERVAL = 30  # seconds

joined_batches = set()

while True:
    batches = fetch_batches()
    for batch in batches:
        # Filter: paused, empty (market_count=0), or already joined this session
        if batch["paused"] or batch["market_count"] == 0:
            continue
        if batch["id"] in joined_batches:
            continue

        # Check if already joined on-chain
        pos = vision.functions.getPosition(batch["id"], bot_address).call()
        if pos[3] > 0:  # totalDeposited > 0
            joined_batches.add(batch["id"])
            continue

        # Join — pass the full batch dict and your strategy function
        bitmap_hex, bitmap_hash = join_batch(batch, strategy=momentum)
        submit_bitmap(batch["id"], bitmap_hex, bitmap_hash)
        joined_batches.add(batch["id"])

    # Check balances for joined batches
    for batch_id in joined_batches:
        balance_info = check_balance(batch_id)
        balance_usdc = int(balance_info["balance"]) / 1e18  # L3 USDC = 18 decimals
        print(f"Batch {batch_id}: {balance_usdc:.2f} USDC")

    time.sleep(POLL_INTERVAL)
```

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `AlreadyJoined` | Already in batch | Use `updateBitmap()` to change predictions |
| `DepositBelowMinimum` | depositAmount < MIN_DEPOSIT (1e17) | Set deposit >= 0.1 USDC |
| `BatchNotFound` | Invalid batch ID | Re-fetch batches from API |
| `BatchPaused` | Batch suspended | Skip this batch, try another |
| `BotAlreadyRegistered` | Already registered | Skip registration step |
| Bitmap 404 | Chain indexer lag | Wait 5-10 seconds after join, retry |
| Bitmap 400 hash mismatch | Hash mismatch | Verify keccak256(bitmap_bytes) == on-chain commitment |

## Reference Implementation

See `bot.py` and `framework/` in this directory for a working Python bot implementation.
