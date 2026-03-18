# Vision: Round-Based Batch Architecture

> Each batch is a single round with a betting phase and a settlement phase.
> Multiple rounds run in parallel for the same source at different timeframes.
> Settlement is automatic. Players must exit and re-enter each round explicitly.

## Model

```
Batch N:    [====betting====][==========settlement==========]
Batch N+1:                   [====betting====][==========settlement==========]
Batch N+2:                                    [====betting====][============
            0───────────────T───────────────2T──────────────3T──────────────4T
```

- **Betting window**: `T` seconds (the batch's `tickDuration`)
- **Settlement window**: `2T` seconds — oracle fetches prices, reaches BLS consensus, settles on-chain
- **Overlap**: one batch accepting bets while the previous one settles
- **No continuous balance** — each batch is self-contained. Player deposits into a batch, gets paid out at settlement, must explicitly join the next batch with a fresh deposit.

A "crypto 5min" source creates a new batch every 5 minutes. A "weather 1hr" source creates one every hour. Both can coexist for the same underlying data source.

---

## Player Flow

Each round is a complete cycle. No balance carries over.

```
Round N:
  1. Player calls joinBatch(N, configHash, deposit, stake, bitmapHash)
     → USDC transferred from player wallet into batch position
  2. Player submits bitmap to oracle (predictions)
  3. Betting window closes (lockOffset)
  4. Oracle resolves: fetches prices, computes outcomes
  5. Oracle calls settleBatch(N, players[], payouts[])
     → USDC transferred from contract back to player wallet
  6. Batch N is done. Position deleted.

Round N+1:
  1. Player calls joinBatch(N+1, ...) with fresh deposit
     → Same cycle repeats
```

No `realBalance`/`virtualBalance` intermediary for round-based batches. Direct USDC in, direct USDC out. Simpler mental model — each round is a standalone bet.

---

## Contract Changes

### 1. Remove source uniqueness constraint

Currently `_createBatch()` enforces one batch per source via `sourceIdHasBatch`. Delete the idempotency check. Replace with a mapping that tracks the **latest** batch per source (for UI lookups) but does not block creation.

```solidity
// Replace:
//   mapping(bytes32 => uint256) public sourceIdToBatchId;
//   mapping(bytes32 => bool) public sourceIdHasBatch;
// With:
mapping(bytes32 => uint256) public latestBatchForSource; // latest, not unique
```

In `_createBatch()`:
- Remove the `if (sourceIdHasBatch[sourceId]) return` check
- Always create a new batch
- Update `latestBatchForSource[sourceId] = batchId`

### 2. Raise MAX_BATCHES

From 200 to 10,000. Ephemeral rounds accumulate. At one batch per source per 5 minutes across 70 sources, that's ~20k/day. Either raise the cap or add a garbage-collection mechanism for settled batches (reclaim storage by zeroing settled batch structs).

### 3. Add `settleBatch()` — bulk oracle settlement with direct USDC payout

One BLS verification for all players in a batch. Settles everyone and transfers USDC directly back to player wallets.

```solidity
function settleBatch(
    uint256 batchId,
    address[] calldata players,
    uint256[] calldata payouts,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external nonReentrant {
    Batch storage b = _batches[batchId];
    if (b.paused) revert BatchPaused(); // already settled
    if (players.length != payouts.length) revert InvalidArrayLength();

    // Single BLS check for all players
    bytes32 payoutsHash = keccak256(abi.encode(players, payouts));
    bytes32 message = keccak256(abi.encode(
        block.chainid,
        address(this),
        "SETTLE_BATCH",
        batchId,
        payoutsHash
    ));
    _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

    // Settle every player — transfer USDC directly to their wallet
    for (uint256 i = 0; i < players.length; i++) {
        PlayerPosition storage pos = _positions[batchId][players[i]];
        if (pos.stakePerTick == 0) continue; // skip non-existent

        uint256 payout = payouts[i];

        // Fee on profit only
        uint256 totalDeposited = pos.totalDeposited;
        uint256 profit = payout > totalDeposited ? payout - totalDeposited : 0;
        uint256 fee = (profit * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netPayout = payout - fee;

        // Delete position before transfer (CEI)
        delete _positions[batchId][players[i]];

        // Accumulate fees
        accumulatedRealFees += fee;

        // Transfer USDC directly to player wallet
        collateral.safeTransfer(players[i], netPayout);

        emit PlayerSettled(batchId, players[i], netPayout, fee);
    }

    b.paused = true;
    emit BatchSettled(batchId, players.length);
}
```

### 4. Modify `joinBatch()` for direct deposit mode

Currently `joinBatch` pulls from `realBalance`/`virtualBalance` (dual-balance). For round-based batches, players deposit USDC directly:

```solidity
function joinBatchDirect(
    uint256 batchId,
    bytes32 configHash,
    uint256 depositAmount,
    uint256 stakePerTick,
    bytes32 bitmapHash
) external nonReentrant {
    _promoteConfigIfNeeded(batchId);
    _requireNotLocked(batchId);

    Batch storage b = _batches[batchId];
    if (b.configHash != configHash) revert BatchNotFound();
    if (stakePerTick < MIN_STAKE_PER_TICK) revert StakeTooLow();
    if (depositAmount < stakePerTick) revert DepositTooLow();

    // Transfer USDC from player wallet directly into contract
    collateral.safeTransferFrom(msg.sender, address(this), depositAmount);

    PlayerPosition storage pos = _positions[batchId][msg.sender];
    pos.bitmapHash = bitmapHash;
    pos.configHash = configHash;
    pos.stakePerTick = stakePerTick;
    pos.startTick = _currentTickId(batchId);
    pos.balance = depositAmount;
    pos.totalDeposited = depositAmount;
    pos.joinTimestamp = block.timestamp;
    pos.isVirtual = false;

    emit PlayerJoined(batchId, msg.sender, stakePerTick, bitmapHash, configHash);
}
```

Player approves USDC once to Vision contract, then each `joinBatchDirect` pulls the deposit. Settlement sends USDC back to wallet. Clean in/out cycle per round.

### 5. Events

```solidity
event PlayerSettled(uint256 indexed batchId, address indexed player, uint256 payout, uint256 fee);
event BatchSettled(uint256 indexed batchId, uint256 playerCount);
```

---

## Oracle Changes

### New component: `BatchLifecycleManager`

Runs per source on a `tickDuration` heartbeat.

```
Every T seconds per (source, timeframe):
  1. CREATE   — createBatch(sourceId, configHash, tickDuration, lockOffset, blsSig)
               Fresh configHash from data-node (latest markets, thresholds, resolution types)
  2. RESOLVE  — for the PREVIOUS batch (betting just ended)
               Fetch prices at betting-end timestamp
               Compute outcomes per market (parimutuel matching)
               Compute final payout per player
  3. SIGN     — all oracles independently compute same results
               Aggregate BLS signatures over (players[], payouts[])
  4. SETTLE   — settleBatch(prevBatchId, players[], payouts[], blsSig, nonce, bitmap)
               One tx. USDC sent directly to each player's wallet.
```

### Timing

For a source with `tickDuration = 300` (5 min):

| Time | Action |
|------|--------|
| 0:00 | Create batch 1. Betting opens. |
| 4:15 | Lock offset (45s before end). No more bets. |
| 5:00 | Betting ends. Create batch 2. Start resolving batch 1. |
| 5:00–10:00 | Oracle resolves batch 1 (price fetch, consensus, BLS aggregation). |
| ~6:00 | Oracle calls `settleBatch(batch1, ...)`. USDC returned to players. |
| 9:15 | Lock offset for batch 2. |
| 10:00 | Betting ends for batch 2. Create batch 3. Start resolving batch 2. |

Settlement has `2T` budget but typically completes in seconds. The extra time is safety margin for slow price feeds or BLS stragglers.

### Config per round

Each batch gets a **fresh configHash** from the data-node at creation time. If new assets appeared since the last round, they're included. If an asset's data went stale, it's excluded. Resolution types and thresholds adapt to recent volatility.

Two batches for the same source with different timeframes get the **same markets** (same source data) but potentially different **thresholds** (the data-node tunes thresholds by tick duration — shorter ticks get tighter thresholds).

### Oracle database

New table to track the lifecycle:

```sql
CREATE TABLE vision_batch_lifecycle (
    batch_id            BIGINT PRIMARY KEY,
    source_id           TEXT NOT NULL,
    timeframe_secs      INTEGER NOT NULL,       -- tickDuration
    config_hash         TEXT NOT NULL,
    betting_start       TIMESTAMPTZ NOT NULL,
    betting_end         TIMESTAMPTZ NOT NULL,
    settlement_deadline TIMESTAMPTZ NOT NULL,    -- betting_end + 2 * tickDuration
    settled_at          TIMESTAMPTZ,             -- NULL until settled
    settle_tx_hash      TEXT,                    -- on-chain tx hash
    player_count        INTEGER DEFAULT 0,
    total_deposited     TEXT DEFAULT '0',        -- sum of all deposits (uint256 string)
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_batch_lifecycle_source ON vision_batch_lifecycle(source_id, timeframe_secs);
CREATE INDEX idx_batch_lifecycle_unsettled ON vision_batch_lifecycle(settled_at) WHERE settled_at IS NULL;
CREATE INDEX idx_batch_lifecycle_betting ON vision_batch_lifecycle(betting_end) WHERE settled_at IS NULL;
```

---

## Bot Changes

### Per-round join cycle

The bot must explicitly join each new round. No balance carry-over.

```python
# In tracker.py — round-based mode
def check_rounds(self):
    """For each subscribed (source, timeframe), join the current betting batch."""
    for source, timeframe in self._subscriptions:
        current = self._fetch_current_betting_batch(source, timeframe)
        if not current:
            continue
        batch_id = current["id"]
        if batch_id in self.active_ids:
            continue  # already in this round

        # Check if we have USDC in wallet for the deposit
        balance = self._executor.usdc_balance()
        deposit = self._config["deposit"] * 10**18
        if balance < deposit:
            log.warning("Insufficient USDC for round %d", batch_id)
            continue

        # Approve + join
        self._executor.approve_usdc(deposit)
        # ... generate bitmap, join batch, submit bitmap to oracle
        self._join_round(current)
```

Settlement happens automatically via oracle. The bot just needs to:
1. Watch for new betting batches
2. Approve USDC + join
3. Submit bitmap
4. Wait — USDC comes back to wallet after settlement
5. Repeat

---

## Frontend Changes

### Batch list grouped by source + timeframe

```
┌─ Crypto ──────────────────────────────────────────────┐
│  5min   │ ● Betting  │ 142 players │ 14 markets │ 2:31│
│  1hr    │ ◐ Settling │  89 players │ 14 markets │ done│
│  24hr   │ ● Betting  │  31 players │ 14 markets │ 18h │
├─ Weather ─────────────────────────────────────────────┤
│  1hr    │ ● Betting  │  23 players │  8 markets │ 41m │
│  24hr   │ ◐ Settling │  12 players │  8 markets │ done│
└───────────────────────────────────────────────────────┘
```

### Batch states

- **Betting** (green) — accepting joins and bitmap submissions
- **Locked** (yellow) — in lock window, no more bets
- **Settling** (orange) — oracle resolving
- **Settled** (grey) — done, USDC returned to wallets

### Player flow (per round)

1. Pick a source + timeframe
2. Approve USDC (one-time, or per round)
3. Call `joinBatchDirect(batchId, configHash, deposit, stake, bitmapHash)`
4. Submit bitmap to oracle
5. Wait for settlement
6. USDC arrives back in wallet (minus fees on profit)
7. Join next round if desired

### "Auto-join" toggle (frontend convenience)

Frontend watches for `BatchSettled` event on the current round. When it fires:
1. Fetch the new betting batch for same source/timeframe
2. Prompt player: "Round settled. +$X.XX profit. Join next round?"
3. If auto-join enabled: submit `joinBatchDirect` tx automatically

This is a frontend UX feature — the contract doesn't know about continuity.

### API changes

Oracle API:
- `GET /vision/rounds?source=crypto&timeframe=300` — list rounds for a source/timeframe
- `GET /vision/rounds/active` — all rounds currently in betting phase
- `GET /vision/rounds/settling` — all rounds in settlement phase
- `GET /vision/rounds/:batchId/results` — settlement results (player payouts, market outcomes)
- `GET /vision/rounds/:batchId/bitmaps` — all player bitmaps decoded as true/false per market (see below)

---

## Bitmap Transparency: True/False Per Market

After the betting window closes (reveal window), anyone can fetch the decoded bitmaps for a batch — each player's prediction per market as a boolean array.

### Oracle API

```
GET /vision/rounds/:batchId/bitmaps

Response:
{
  "batchId": 42,
  "tickId": 0,
  "configHash": "0xabc...",
  "markets": ["BTC", "ETH", "SOL", ...],
  "players": [
    {
      "player": "0x1234...",
      "predictions": [true, false, true, ...],
      "stakePerTick": "1000000000000000000"
    },
    {
      "player": "0x5678...",
      "predictions": [false, true, true, ...],
      "stakePerTick": "500000000000000000"
    }
  ],
  "revealedAt": "2026-03-17T14:05:00Z"
}
```

- `predictions[i] = true` means player bet UP on `markets[i]`
- `predictions[i] = false` means player bet DOWN on `markets[i]`
- Only available after reveal window passes (oracle enforces timing)
- During betting: returns 403 "Reveal window not passed"

### Oracle API: single player bitmap

```
GET /vision/rounds/:batchId/bitmaps/:player

Response:
{
  "player": "0x1234...",
  "predictions": [true, false, true, ...],
  "markets": ["BTC", "ETH", "SOL", ...],
  "stakePerTick": "1000000000000000000"
}
```

### Oracle API: settlement results with outcomes

```
GET /vision/rounds/:batchId/results

Response:
{
  "batchId": 42,
  "settled": true,
  "markets": [
    {
      "assetId": "BTC",
      "outcome": "UP",
      "changeBps": 150,
      "thresholdBps": 30,
      "resolutionType": "up_x"
    },
    {
      "assetId": "ETH",
      "outcome": "DOWN",
      "changeBps": -200,
      "thresholdBps": 30,
      "resolutionType": "up_x"
    }
  ],
  "players": [
    {
      "player": "0x1234...",
      "predictions": [true, false, true, ...],
      "correct": [true, true, false, ...],
      "deposited": "1000000000000000000",
      "payout": "1400000000000000000",
      "pnl": "400000000000000000"
    }
  ]
}
```

Each player's `correct[i]` = whether `predictions[i]` matched `markets[i].outcome`. Combined with the bitmap, this gives full transparency: what everyone bet, what happened, who won.

### Frontend: batch detail view

```
┌─ Round #42 — Crypto 5min ─────────────────────────┐
│ Status: Settled                                     │
│                                                     │
│ Markets    Outcome   You    Alice    Bob            │
│ BTC        ▲ UP      ✓ UP   ✗ DOWN  ✓ UP           │
│ ETH        ▼ DOWN    ✓ DOWN ✓ DOWN  ✗ UP            │
│ SOL        ▲ UP      ✗ DOWN ✓ UP    ✓ UP            │
│ AVAX       ─ FLAT    ✗ UP   ✗ DOWN  ✗ UP            │
│                                                     │
│ Your PnL: +$0.40  │  Alice: +$0.20  │  Bob: -$0.30 │
└─────────────────────────────────────────────────────┘
```

### Bot: fetch results for analysis

```python
def fetch_round_results(self, batch_id: int) -> dict:
    """Fetch full round results including all bitmaps and outcomes."""
    resp = requests.get(f"{self._oracle_url}/vision/rounds/{batch_id}/results", timeout=10)
    if resp.ok:
        return resp.json()
    return {}
```

Bots use this to analyze past rounds — track which strategies worked, adapt predictions.

### Oracle implementation

The oracle already stores bitmaps in `bitmap_store.rs` and reveals them via `GET /vision/reveal/:batch_id/:tick_id` after the reveal window. The new endpoints are wrappers that:

1. Decode the raw bitmap bytes into per-market booleans using the batch's config (market count from configHash)
2. Annotate with market names from the data-node config
3. For results: merge with resolved outcomes from `vision_tick_results`

No new oracle storage needed — this is a read path over existing data.

---

## Tracking: Frontend + Bots

### Frontend: "My Rounds" history

Player's dashboard shows all rounds they participated in, with full detail:

```
GET /vision/player/:address/rounds?page=1&limit=20

Response:
{
  "rounds": [
    {
      "batchId": 42,
      "source": "crypto",
      "timeframe": 300,
      "status": "settled",
      "deposited": "1000000000000000000",
      "payout": "1400000000000000000",
      "pnl": "+400000000000000000",
      "correctCount": 10,
      "totalMarkets": 14,
      "bettingEnd": "2026-03-17T14:00:00Z",
      "settledAt": "2026-03-17T14:01:30Z"
    },
    ...
  ],
  "totalRounds": 156,
  "winRate": 0.62,
  "totalPnl": "12400000000000000000"
}
```

### Frontend: source history

All rounds for a source, regardless of player:

```
GET /vision/rounds?source=crypto&timeframe=300&limit=50

Response:
{
  "rounds": [
    {
      "batchId": 42,
      "status": "settled",
      "playerCount": 142,
      "totalDeposited": "142000000000000000000",
      "bettingStart": "2026-03-17T13:55:00Z",
      "bettingEnd": "2026-03-17T14:00:00Z",
      "settledAt": "2026-03-17T14:01:30Z",
      "marketCount": 14
    },
    {
      "batchId": 43,
      "status": "betting",
      "playerCount": 89,
      "totalDeposited": "89000000000000000000",
      "bettingStart": "2026-03-17T14:00:00Z",
      "bettingEnd": "2026-03-17T14:05:00Z",
      "settledAt": null,
      "marketCount": 14
    }
  ]
}
```

### Bot: track all rounds for a source

```python
def fetch_source_history(self, source: str, timeframe: int, limit: int = 50) -> list:
    """Fetch all rounds for a source/timeframe pair."""
    resp = requests.get(
        f"{self._oracle_url}/vision/rounds",
        params={"source": source, "timeframe": timeframe, "limit": limit},
        timeout=10,
    )
    return resp.json().get("rounds", []) if resp.ok else []
```

### Oracle DB: player round history

```sql
-- Populated at settlement time by the oracle
CREATE TABLE vision_round_players (
    batch_id        BIGINT NOT NULL,
    player          TEXT NOT NULL,
    deposited       TEXT NOT NULL,       -- uint256 string
    payout          TEXT NOT NULL,       -- uint256 string (after fees)
    pnl             TEXT NOT NULL,       -- signed int string
    correct_count   INTEGER NOT NULL,    -- how many markets predicted correctly
    total_markets   INTEGER NOT NULL,
    bitmap_hex      TEXT,                -- raw bitmap for full transparency
    settled_at      TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (batch_id, player)
);

CREATE INDEX idx_round_players_player ON vision_round_players(player);
CREATE INDEX idx_round_players_settled ON vision_round_players(settled_at);
```

---

## Migration

### From current model

Current batches (permanent, one per source) continue to work unchanged. The contract changes are additive:
- Old batches use `joinBatch` (dual-balance) and `claimRewards`/`withdraw` (manual)
- New round-based batches use `joinBatchDirect` (direct USDC) and `settleBatch` (oracle-driven)

Both coexist in the same contract.

### Deploy sequence

1. Deploy updated Vision contract (remove source uniqueness, add `settleBatch` + `joinBatchDirect`, raise `MAX_BATCHES`)
2. Update oracle with `BatchLifecycleManager`
3. Update frontend to show round-based view (grouped by source + timeframe)
4. Update bots with per-round join cycle
5. Gradually migrate sources from permanent batches to round-based

---

## Invariants

1. **One BLS verification per settlement** — `settleBatch` hashes all players+payouts into one message. One signature check, N transfers.
2. **USDC conservation** — every USDC that enters via `joinBatchDirect` exits via `settleBatch` (minus fees). No balance left stranded.
3. **No cross-batch state** — each batch is fully independent. No balance carry-over, no position migration, no shared state.
4. **Deterministic resolution** — all oracles compute identical results from pinned prices + config hash. BLS consensus proves agreement.
5. **Clean lifecycle** — each batch moves through exactly one path: `created → betting → locked → settling → settled`. No re-entry, no resurrection.
6. **Player must act** — joining each round requires an explicit transaction. Auto-join is a frontend convenience, not a contract feature.
