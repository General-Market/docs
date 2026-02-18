# Stress Test Report

**Timestamp**: 2026-02-17T20:36:42.021Z
**Duration**: 424.2s

## No Breaking Points Found

## Phase 6: Chaos Fuzz Test

### Operations Summary

| Tier | Duration | Ops Total | Succeeded | Failed | Buy | Sell | Create | Rebalance | Liquidate | Breaking Point |
|------|----------|-----------|-----------|--------|-----|------|--------|-----------|-----------|----------------|
| Light | 66639ms | 120 | 72 | 48 | 38 | 36 | 14 | 19 | 13 | — |
| Medium | 122491ms | 150 | 83 | 67 | 48 | 42 | 13 | 27 | 20 | — |
| Heavy | 123517ms | 1000 | 442 | 558 | 351 | 242 | 97 | 148 | 162 | — |

### Fuzz Validation

| Tier | Fuzz Ops | Correct Reverts | INCORRECT Successes | Correct Successes | Incorrect Reverts |
|------|----------|-----------------|---------------------|-------------------|-----------|
| Light | 3 | 3 | 0 | 72 | 1 |
| Medium | 10 | 10 | 0 | 83 | 2 |
| Heavy | 270 | 270 | 0 | 442 | 24 |

### Reconciliation

| Tier | Block Range | Orders | Fills | Creates | Rebalances | Fees | Stuck | Escrow Leaks | Mismatches |
|------|-------------|--------|-------|---------|------------|------|-------|--------------|------------|
| Light | 2591→2747 | 40 | 40 | 12 | 0 | 0 | 0 | 0 | 0 |
| Medium | 2747→2954 | 46 | 46 | 14 | 0 | 0 | 0 | 0 | 0 |
| Heavy | 2954→3237 | 267 | 200 | 16 | 0 | 0 | 67 | 0 | 1 |

## Health Monitor Summary

- Duration: 424.2s
- Total samples: 1676
- Anomalies: 0

