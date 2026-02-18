# Stress Test Report

**Timestamp**: 2026-02-17T17:34:40.527Z
**Duration**: 4442.0s

## Breaking Points Found

- ITP Scaling E: Failed at ITP #1: Transaction reverted: 0x609593d857613a449331c7c2e6943b642ec90c69b2cef6687d9b0aa0b5720d04

## Phase 0: Netting Correctness

| Test | Passed | Duration | Details |
|------|--------|----------|----------|
| 0a | PASS | 25268ms | Buy: FILLED, Sell: FILLED, TradeRequests: 2, AssetTradeRequests: 100, Netting verified: true |
| 0b | PASS | 28957ms | Buy(A): FILLED, Sell(B): FILLED, AssetTradeRequests: 3, T2/T3 overlap should show reduced net volume (check issuer logs) |
| 0c | PASS | 23252ms | Buy: FILLED, Sell: FILLED, Net should be BUY ~$700 (not $1300 gross), AssetTradeRequests: 0 |
| 0d | PASS | 12622ms | Buy: FILLED, AssetTradeRequests: 100, Rebalance sell should partially offset user buy (check issuer logs) |

## Phase 1: ITP Creation Scaling

| Tier | Label | ITPs Created | Avg Gas | Wall Time | getItpCount | getItpState | Breaking Point |
|------|-------|-------------|---------|-----------|-------------|-------------|----------------|
| A | Baseline gas/timing | 100 | 545745 | 20416ms | 0.3ms | 0.3ms | — |
| B | Storage growth | 1000 | 545769 | 204106ms | 0.3ms | 0.3ms | — |
| C | RPC latency under large state | 10000 | 545793 | 2219047ms | 24.8ms | 1.5ms | — |
| D | O(N²) duplicate check gas | 100 | 9649461 | 38880ms | 1.7ms | 3.6ms | — |
| E | Max-assets gas ceiling (250 fits 30M block limit) | 0 | 0 | 1148ms | 0.4ms | 0.0ms | Failed at ITP #1: Transaction reverted: 0x609593d857613a449331c7c2e6943b642ec90c69b2cef6687d9b0aa0b5720d04 |

## Phase 2: Issuer Relay Stress

| Level | Requests | Send Time | Completion Time | Rate (req/s) | Health Stable | Breaking Point |
|-------|----------|-----------|-----------------|--------------|---------------|----------------|
| A | 10 | 264ms | 60403ms | 0.12 | Yes | — |
| B | 50 | 3760ms | 181266ms | 0.09 | Yes | — |
| C | 100 | 2116ms | 330359ms | 0.01 | Yes | — |

## Phase 3: Order Flood

| Tier | Orders | Failed | Filled | Submit Rate | P50 | P95 | P99 | Queue Full | Breaking Point |
|------|--------|--------|--------|-------------|-----|-----|-----|------------|----------------|
| A | 50 | 0 | 0 | 13.5/s | 0ms | 0ms | 0ms | No | — |
| B | 200 | 0 | 0 | 2.8/s | 0ms | 0ms | 0ms | No | — |
| C | 450 | 0 | 0 | 5.0/s | 0ms | 0ms | 0ms | No | — |
| D | 501 | 0 | 50 | 3.3/s | 206648ms | 208360ms | 208751ms | No | — |

## Phase 4: Rebalance Storm

| Tier | Attempted | Completed | Avg Latency | Max Latency | NAV Preserved | NAV Drift | Breaking Point |
|------|-----------|-----------|-------------|-------------|---------------|-----------|----------------|
| A | 3 | 3 | 634ms | 837ms | Yes | 0.0000% | — |
| B | 10 | 10 | 916ms | 1018ms | Yes | 0.0000% | — |
| C | 50 | 50 | 693ms | 846ms | Yes | 0.0000% | — |

## Phase 5: Combined Load

| Rate | Duration | Buys | Sells | Rebalances | Creates | Fills | P50 | P95 | P99 | Health Drops | Breaking Point |
|------|----------|------|-------|------------|---------|-------|-----|-----|-----|-------------|----------------|
| Low | 66291ms | 27 | 11 | 0 | 1 | 8 | 63476ms | 65813ms | 65813ms | 0 | — |
| Medium | 69575ms | 131 | 52 | 1 | 3 | 8 | 63597ms | 69278ms | 69278ms | 0 | — |
| High | 67880ms | 2958 | 1183 | 13 | 14 | 0 | 0ms | 0ms | 0ms | 0 | — |

## Health Monitor Summary

- Duration: 4442.0s
- Total samples: 17436
- Anomalies: 0

