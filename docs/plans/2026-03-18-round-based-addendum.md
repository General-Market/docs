# Round-Based Vision — Addendum: E2E, Leaderboard, Points

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Add testnet deployment support, E2E tests, leaderboard win%/PnL, and points system updates for round-based Vision batches.

**Depends on:** `docs/plans/2026-03-17-round-based-implementation.md` (contract + oracle + bot + frontend foundation)

---

## A. Testnet Deployment (`testnet.sh`)

### Task A1: Update testnet.sh for round-based batches

**Files:**
- Modify: `testnet.sh`
- Modify: `contracts/script/DeployAllVisionBatches.s.sol`

**Changes:**

1. `DeployAllVisionBatches.s.sol` currently creates permanent batches with `createBatch()`. For round-based mode, the oracle's `BatchLifecycleManager` creates batches at runtime. The deploy script should:
   - Still deploy Vision contract (unchanged)
   - Create ONE seed batch per source for backward compatibility (existing tests need it)
   - Set `round_based_enabled = true` in oracle config
   - The lifecycle manager will create round batches on top of the seed batches

2. `testnet.sh` deploy step needs:
   - After Vision deploy, sync `vision-deployment.json` to VPS
   - Oracle config update: add `round_based_enabled = true` and `round_sources` array
   - Oracle restart after config change

3. Add a `testnet.sh round-status` command that checks:
   - Oracle lifecycle manager running (`docker logs oracle-1 | grep -i lifecycle`)
   - Active round count per source (`curl oracle:8080/vision/rounds/active`)
   - Latest settled round (`curl oracle:8080/vision/rounds?limit=1`)

---

## B. E2E Tests for Round-Based Flow

### Task B1: Add round-based Vision E2E helper functions

**Files:**
- Modify: `frontend/e2e/helpers/vision-api.ts`

Add to the existing helpers:

```typescript
// ── Round-based helpers ──────────────────────────────────────────

/** Fetch active rounds from oracle, optionally filtered by source */
export async function getActiveRounds(source?: string): Promise<RoundInfo[]> {
  const params = source ? `?source=${source}` : ''
  const res = await fetch(`${VISION_API}/vision/rounds/active${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.rounds ?? []
}

/** Fetch round results (bitmaps + outcomes + PnL) */
export async function getRoundResults(batchId: number): Promise<RoundResults | null> {
  const res = await fetch(`${VISION_API}/vision/rounds/${batchId}/results`)
  if (!res.ok) return null
  return res.json()
}

/** Fetch decoded bitmaps for a round */
export async function getRoundBitmaps(batchId: number): Promise<RoundBitmaps | null> {
  const res = await fetch(`${VISION_API}/vision/rounds/${batchId}/bitmaps`)
  if (!res.ok) return null
  return res.json()
}

/** Wait for a round to be settled (oracle auto-settles) */
export async function waitForRoundSettled(
  batchId: number,
  timeoutMs = CONSENSUS_TIMEOUT,
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${VISION_API}/vision/rounds/${batchId}/results`)
    if (res.ok) {
      const data = await res.json()
      if (data.players?.length > 0) return true
    }
    await new Promise(r => setTimeout(r, 5000))
  }
  return false
}

/** Join a round-based batch using joinBatchDirect (direct USDC deposit) */
export async function joinRoundDirect(
  player: `0x${string}`,
  playerKey: `0x${string}`,
  batchId: number,
  configHash: `0x${string}`,
  depositAmount: bigint,
  stakePerTick: bigint,
  bets: BetDirection[],
  marketCount: number,
): Promise<void> {
  // 1. Approve USDC
  await approveUsdc(player, playerKey, depositAmount)
  // 2. Call joinBatchDirect
  const bitmapHash = computeBitmapHash(bets, marketCount)
  await sendTx(player, playerKey, VISION_ADDRESS, 'joinBatchDirect', [
    batchId, configHash, depositAmount, stakePerTick, bitmapHash,
  ])
  // 3. Submit bitmap to oracle
  await submitBitmapToOracle(player, batchId, bets, marketCount, bitmapHash)
}

/** Get player's round history from oracle */
export async function getPlayerRounds(
  player: string,
  limit = 20,
): Promise<PlayerRound[]> {
  const res = await fetch(`${VISION_API}/vision/player/${player}/rounds?limit=${limit}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.rounds ?? []
}

// Types
interface RoundInfo {
  batchId: number
  sourceId: string
  timeframeSecs: number
  status: 'betting' | 'locked' | 'settling' | 'settled'
  playerCount: number
  bettingEnd: string
}

interface RoundResults {
  batchId: number
  players: {
    player: string
    deposited: string
    payout: string
    pnl: string
    correctCount: number
    totalMarkets: number
  }[]
}

interface RoundBitmaps {
  batchId: number
  markets: string[]
  players: {
    player: string
    predictions: boolean[]
  }[]
}

interface PlayerRound {
  batchId: number
  deposited: string
  payout: string
  pnl: string
  correctCount: number
  totalMarkets: number
}
```

### Task B2: E2E test — full round lifecycle

**Files:**
- Create: `frontend/e2e/tests/41-vision-round-lifecycle.spec.ts`

```typescript
import { test, expect } from '../fixtures/wallet'
import {
  getActiveRounds, joinRoundDirect, waitForRoundSettled,
  getRoundResults, getRoundBitmaps, getPlayerRounds,
  PLAYER1, PLAYER2, VISION_PLAYER_KEY, PLAYER2_KEY,
  ensureUsdcBalance, randomBets, oppositeBets,
  getVisionRealBalance,
} from '../helpers/vision-api'
import { CONSENSUS_TIMEOUT } from '../env'

const DEPOSIT = 10n * 10n ** 18n  // 10 USDC (18 dec on L3)
const STAKE = 1n * 10n ** 18n     // 1 USDC per tick

test.describe('Vision Round Lifecycle', () => {

  test('41a: active round exists for at least one source', async () => {
    const rounds = await getActiveRounds()
    expect(rounds.length).toBeGreaterThan(0)
    expect(rounds[0].status).toBe('betting')
    expect(rounds[0].batchId).toBeGreaterThan(0)
  })

  test('41b: two players join round with opposite bets', async () => {
    // Find an active round
    const rounds = await getActiveRounds()
    const round = rounds[0]
    const batchId = round.batchId

    // Ensure both players have USDC
    await ensureUsdcBalance(PLAYER1, DEPOSIT * 2n)
    await ensureUsdcBalance(PLAYER2, DEPOSIT * 2n)

    // Player 1: random bets
    const marketCount = 14 // default
    const bets1 = randomBets(marketCount)
    await joinRoundDirect(PLAYER1, VISION_PLAYER_KEY, batchId, round.configHash, DEPOSIT, STAKE, bets1, marketCount)

    // Player 2: opposite bets
    const bets2 = oppositeBets(bets1)
    await joinRoundDirect(PLAYER2, PLAYER2_KEY, batchId, round.configHash, DEPOSIT, STAKE, bets2, marketCount)
  })

  test('41c: round auto-settles after betting window', async () => {
    // Wait for the round from 41b to settle (oracle settles automatically)
    const rounds = await getActiveRounds()
    // The round from 41b should now be in settling or settled state
    // Wait up to CONSENSUS_TIMEOUT for settlement
    const settled = await waitForRoundSettled(rounds[0].batchId, CONSENSUS_TIMEOUT)
    expect(settled).toBe(true)
  })

  test('41d: settlement results show correct predictions and PnL', async () => {
    const rounds = await getPlayerRounds(PLAYER1, 1)
    expect(rounds.length).toBeGreaterThan(0)

    const result = rounds[0]
    expect(Number(result.deposited)).toBeGreaterThan(0)
    expect(Number(result.payout)).toBeGreaterThanOrEqual(0)
    expect(result.correctCount).toBeGreaterThanOrEqual(0)
    expect(result.totalMarkets).toBeGreaterThan(0)

    // With opposite bets, one player should profit and one should lose
    const p2Rounds = await getPlayerRounds(PLAYER2, 1)
    const p1Pnl = Number(result.pnl)
    const p2Pnl = Number(p2Rounds[0].pnl)
    // Parimutuel: sum of PnL should be ~0 (minus fees)
    expect(Math.abs(p1Pnl + p2Pnl)).toBeLessThan(Number(DEPOSIT) * 0.01) // within 1%
  })

  test('41e: bitmaps are transparent after settlement', async () => {
    const rounds = await getPlayerRounds(PLAYER1, 1)
    const bitmaps = await getRoundBitmaps(rounds[0].batchId)
    expect(bitmaps).not.toBeNull()
    expect(bitmaps!.markets.length).toBeGreaterThan(0)
    expect(bitmaps!.players.length).toBe(2) // two players joined
    // Each player has predictions array matching market count
    for (const p of bitmaps!.players) {
      expect(p.predictions.length).toBe(bitmaps!.markets.length)
    }
  })

  test('41f: settled funds returned to Vision balance', async () => {
    // After settlement, player's realBalance should have the payout
    const balance = await getVisionRealBalance(PLAYER1)
    expect(balance).toBeGreaterThan(0n)
    // Player can withdraw to wallet via existing withdrawBalance()
  })

  test('41g: new round created automatically after settlement', async () => {
    // The lifecycle manager should have created a new betting round
    const rounds = await getActiveRounds()
    expect(rounds.length).toBeGreaterThan(0)
    expect(rounds[0].status).toBe('betting')
  })
})
```

### Task B3: E2E test — leaderboard with win% and PnL

**Files:**
- Create: `frontend/e2e/tests/42-vision-leaderboard.spec.ts`

```typescript
import { test, expect } from '../fixtures/wallet'
import { VISION_API } from '../env'

test.describe('Vision Leaderboard', () => {

  test('42a: leaderboard returns win rate and PnL fields', async () => {
    const res = await fetch(`${VISION_API}/vision/leaderboard`)
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.entries?.length).toBeGreaterThanOrEqual(0)

    if (data.entries.length > 0) {
      const entry = data.entries[0]
      // Required fields
      expect(entry).toHaveProperty('walletAddress')
      expect(entry).toHaveProperty('pnl')
      expect(entry).toHaveProperty('winRate')
      expect(entry).toHaveProperty('roi')
      expect(entry).toHaveProperty('totalVolume')
      expect(entry).toHaveProperty('roundsPlayed')
      expect(entry).toHaveProperty('roundsWon')
      // Win rate should be 0-100
      expect(entry.winRate).toBeGreaterThanOrEqual(0)
      expect(entry.winRate).toBeLessThanOrEqual(100)
    }
  })

  test('42b: leaderboard includes round-based batch results', async () => {
    // After the round lifecycle tests, players should appear on leaderboard
    const res = await fetch(`${VISION_API}/vision/leaderboard`)
    const data = await res.json()
    const entries = data.entries ?? []

    // Find our test players
    const p1 = entries.find((e: any) => e.walletAddress.toLowerCase().includes(process.env.VISION_PLAYER_ADDRESS?.toLowerCase() ?? ''))
    // If found, their data should reflect the round they played
    if (p1) {
      expect(p1.roundsPlayed).toBeGreaterThanOrEqual(1)
      expect(typeof p1.pnl).toBe('number')
    }
  })
})
```

---

## C. Leaderboard: Win% and PnL from Round-Based Batches

### Task C1: Oracle — aggregate round results into leaderboard

**Files:**
- Modify: `oracle/src/vision/api.rs` (leaderboard handler, ~lines 986-1063)

**Changes:**

The current leaderboard aggregates from in-memory scheduler (active batches only). For round-based batches, settled results live in `vision_round_players` table. Merge both sources:

```rust
// In the leaderboard handler, after the existing in-memory aggregation:

// Also aggregate settled round results from Postgres
let round_stats: Vec<(String, String, String, String, i64, i64)> = sqlx::query_as(
    "SELECT player,
            SUM(payout::numeric)::text as total_payout,
            SUM(deposited::numeric)::text as total_deposited,
            SUM(CASE WHEN pnl::numeric > 0 THEN 1 ELSE 0 END)::text as wins,
            COUNT(*)::bigint as rounds_played,
            SUM(correct_count)::bigint as total_correct
     FROM vision_round_players
     GROUP BY player"
)
.fetch_all(pool).await.unwrap_or_default();

// Merge round stats into the player HashMap
for (player, total_payout, total_deposited, wins, rounds_played, total_correct) in &round_stats {
    let addr: Address = player.parse().unwrap_or_default();
    let entry = players.entry(addr).or_insert_with(|| PlayerStats::default());
    entry.total_balance += U256::from_dec_str(total_payout).unwrap_or_default();
    entry.total_deposited += U256::from_dec_str(total_deposited).unwrap_or_default();
    entry.rounds_played += *rounds_played as u64;
    entry.rounds_won += wins.parse::<u64>().unwrap_or(0);
    entry.batches_joined += *rounds_played as u64;
}
```

Add new fields to the leaderboard response:
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LeaderboardEntry {
    rank: usize,
    wallet_address: String,
    pnl: f64,
    win_rate: f64,           // existing
    roi: f64,                // existing
    total_volume: f64,       // existing
    portfolio_bets: usize,   // existing (rename to rounds_played)
    rounds_played: u64,      // NEW: total rounds completed
    rounds_won: u64,         // NEW: rounds with positive PnL
    avg_correct_pct: f64,    // NEW: average % of markets predicted correctly
}
```

### Task C2: Frontend — display win% and PnL on leaderboard

**Files:**
- Modify: `frontend/hooks/vision/useVisionLeaderboard.ts`
- Modify: `frontend/components/domain/VisionLeaderboard.tsx`

**Changes to hook:**
Map new fields from oracle response: `roundsPlayed`, `roundsWon`, `avgCorrectPct`.

**Changes to component:**
Add columns:
- "Rounds" — `entry.roundsPlayed` (total completed rounds)
- "Win%" — `entry.winRate.toFixed(1)%` (already exists, ensure it uses round data)
- "Correct%" — `entry.avgCorrectPct.toFixed(1)%` (new: average prediction accuracy)
- "PnL" — already displayed, ensure it includes round-based results

---

## D. Points System Update for Round-Based Vision

### Task D1: Update points calculation for round-based batches

**Files:**
- Modify: `frontend/hooks/vision/useVisionPoints.ts`

**Current logic:** Points = `POINTS_PER_TICK_PER_BATCH * myShare * ticksElapsed` — based on continuous batches with ticks.

**Round-based change:** Each round IS one tick. Points per round = `100 * (myDeposit / batchTVL)`. Settled rounds contribute their full points immediately.

```typescript
// For round-based batches (identified by having settleBatch results):
// Points = sum over all completed rounds of (100 * myShare)
// Where myShare = myDeposit / totalDeposited for that round

// Fetch completed rounds from oracle
const { data: playerRounds } = useSWR(
  address ? `/api/vision/player/${address}/rounds?limit=100` : null,
  fetcher,
)

// Calculate points from settled rounds
const roundPoints = useMemo(() => {
  if (!playerRounds?.rounds) return 0
  return playerRounds.rounds.reduce((sum: number, round: any) => {
    const myDeposit = parseFloat(formatUnits(BigInt(round.deposited), 18))
    // Approximate TVL from payout conservation: sum(payouts) ≈ sum(deposits)
    // For precision, oracle should return TVL in round results
    const pointsPerRound = 100 // flat 100 points per round participated
    return sum + pointsPerRound
  }, 0)
}, [playerRounds])

// Total points = continuous batch points + round-based points
const totalPoints = continuousBatchPoints + roundPoints
```

### Task D2: Add round participation to points page

**Files:**
- Modify: `frontend/app/[locale]/points/PointsPageClient.tsx`

Add a "Round Points" section showing:
- Rounds completed
- Points earned from rounds
- Average accuracy (correctCount / totalMarkets)
- Points earning rate (rounds per hour * 100 pts)

---

## E. Frontend Round Endpoints

Already covered by Task 15 in the main plan (proxy routes created). The E2E tests (B1-B3) validate them end-to-end.

Additional endpoint needed:

### Task E1: Oracle — add round stats to leaderboard endpoint

**Files:**
- Modify: `oracle/src/vision/api.rs`

Add query param `?include_rounds=true` to existing `/vision/leaderboard` endpoint. When set, merge `vision_round_players` aggregation into the response. Default to `true` once round-based mode is active.

---

## Dependency Graph

```
Independent streams (all can run in parallel):

Stream 1: E2E Tests
  B1 (helpers) → B2 (lifecycle test) → B3 (leaderboard test)

Stream 2: Leaderboard
  C1 (oracle aggregation) → C2 (frontend display)

Stream 3: Points
  D1 (points calculation) → D2 (points page)

Stream 4: Testnet
  A1 (testnet.sh update)

Stream 5: Oracle endpoint
  E1 (round stats in leaderboard)

C1 and E1 can be combined (both modify oracle api.rs leaderboard handler).
B3 depends on C1 (leaderboard test needs round data in response).
```
