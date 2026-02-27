# Vision Points System Design

## Goal

Incentivize early users to trade across all Vision batches. Points accumulate toward a future airdrop and power a public leaderboard.

## Core Mechanic

Each batch emits **100 points per tick** (every ~10 minutes). Points are split proportionally by dollar share among all participants in that batch.

```
your_points_per_tick = 100 × (your_deposit / total_batch_deposits)
```

**80 batches × 100 pts × 144 ticks/day = 1,152,000 points emitted daily across the protocol.**

### Examples

| Scenario | Your deposit | Batch TVL | Your pts/tick | Pts/hour |
|----------|-------------|-----------|---------------|----------|
| Solo in a batch | $10 | $10 | 100 | 600 |
| Half the batch | $50 | $100 | 50 | 300 |
| Small fish | $5 | $500 | 1 | 6 |

Early users who spread across empty batches earn massively more per dollar.

## Implementation

**Frontend-only.** No backend or contract changes.

1. Read on-chain `JoinBatch` / `Deposit` / `Withdraw` events from Vision.sol
2. Reconstruct each batch's participant list + balances at each tick boundary
3. Compute points per address per tick, accumulate total
4. Display: user's total points + leaderboard sorted by total points

### Data Flow

```
Vision.sol events (Arbitrum)
    → frontend reads via RPC / subgraph
    → reconstruct per-tick snapshots: { batchId → { address → balance } }
    → for each tick, for each batch:
        points[address] += 100 × (balance / totalBatchBalance)
    → sum across all ticks → total points per address
    → render leaderboard + personal score
```

### Tick Boundaries

A tick boundary = `batch.createdAt + (tickNumber × tickDuration)`. The frontend computes which tick number the current block falls in and rolls forward.

### Caching

Computing points from genesis on every page load is expensive. Options:
- **localStorage**: cache computed points up to last processed block, only process new events on refresh
- **Static JSON snapshot**: periodically publish a snapshot of points (e.g. hourly cron that writes to a public JSON endpoint or IPFS), frontend uses snapshot + computes delta from snapshot block to current block

## What Points Are For

- **Leaderboard ranking** — public, social incentive
- **Future airdrop** — points → token conversion ratio TBD at token launch

## Scope Exclusions

- No multipliers, streaks, badges, or tiers
- No winning/accuracy bonus — points reward participation, not prediction skill
- No point decay or expiry
- No referral bonuses
- No backend/contract changes
