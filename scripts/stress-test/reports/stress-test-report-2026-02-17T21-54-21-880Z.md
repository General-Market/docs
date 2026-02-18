# Stress Test Report

**Timestamp**: 2026-02-17T21:47:14.591Z
**Duration**: 427.3s

## No Breaking Points Found

## Phase 6: Chaos Fuzz Test

### Operations Summary

| Tier | Duration | Ops Total | Succeeded | Failed | Buy | Sell | Create | Rebalance | Liquidate | Breaking Point |
|------|----------|-----------|-----------|--------|-----|------|--------|-----------|-----------|----------------|
| Light | 63446ms | 60 | 36 | 24 | 19 | 19 | 3 | 12 | 7 | — |
| Medium | 130609ms | 700 | 367 | 333 | 237 | 169 | 75 | 105 | 114 | — |
| Heavy | 121758ms | 600 | 282 | 318 | 231 | 140 | 68 | 82 | 79 | — |

### Fuzz Validation

| Tier | Fuzz Ops | Correct Reverts | INCORRECT Successes | Correct Successes | Incorrect Reverts |
|------|----------|-----------------|---------------------|-------------------|-----------|
| Light | 2 | 2 | 0 | 36 | 1 |
| Medium | 87 | 87 | 0 | 367 | 7 |
| Heavy | 157 | 157 | 0 | 282 | 11 |

### Reconciliation

| Tier | Block Range | Orders | Fills | Creates | Rebalances | Fees | Stuck | Escrow Leaks | Mismatches |
|------|-------------|--------|-------|---------|------------|------|-------|--------------|------------|
| Light | 6992→7105 | 25 | 25 | 2 | 0 | 0 | 0 | 0 | 0 |
| Medium | 7105→7355 | 213 | 114 | 9 | 0 | 0 | 99 | 0 | 1 |
| Heavy | 7356→7619 | 173 | 0 | 16 | 0 | 0 | 272 | 0 | 1 |

## Health Monitor Summary

- Duration: 427.3s
- Total samples: 1688
- Anomalies: 0

