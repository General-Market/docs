# Stress Test Report

**Timestamp**: 2026-02-17T20:11:56.649Z
**Duration**: 133.8s

## Breaking Points Found

- Chaos Light: 1 fuzz ops succeeded that should have reverted

## Phase 6: Chaos Fuzz Test

### Operations Summary

| Tier | Duration | Ops Total | Succeeded | Failed | Buy | Sell | Create | Rebalance | Liquidate | Breaking Point |
|------|----------|-----------|-----------|--------|-----|------|--------|-----------|-----------|----------------|
| Light | 85263ms | 390 | 222 | 168 | 120 | 102 | 44 | 59 | 65 | 1 fuzz ops succeeded that should have reverted |

### Fuzz Validation

| Tier | Fuzz Ops | Correct Reverts | INCORRECT Successes | Correct Successes | Incorrect Reverts |
|------|----------|-----------------|---------------------|-------------------|-----------|
| Light | 11 | 10 | 1 | 221 | 1 |

### Reconciliation

| Tier | Block Range | Orders | Fills | Creates | Rebalances | Fees | Stuck | Escrow Leaks | Mismatches |
|------|-------------|--------|-------|---------|------------|------|-------|--------------|------------|
| Light | 459→700 | 123 | 123 | 9 | 0 | 0 | 0 | 0 | 1 |

### Critical Mismatches

| Category | Description | Expected | Actual |
|----------|-------------|----------|--------|
| fuzz-validation | Fuzz op rebalance:weights-dont-sum succeeded but should have reverted (account=0x265188114eb5d5536bc8654d8e9710fe72c28c4d, itpId=0x0000000000000000000000000000000000000000000000000000000000000001) | revert | success |

## Health Monitor Summary

- Duration: 133.8s
- Total samples: 524
- Anomalies: 0

