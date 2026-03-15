# ITP Backing Enforcement System

## Problem

Shares can be minted on L3 without verifying the AP (Authorized Participant) actually holds the underlying tokens. No independent verification layer exists between `completeBuyOrder` (USDC released to AP) and `confirmFills` (shares minted). Rebalances change inventory without confirming AP executed the trades.

## Architecture

```
┌─────────────┐  SSE (holdings)  ┌───────────┐  SSE (holdings)  ┌──────────────────┐
│  Mock AP    │ ───────────────→ │ Data-Node │ ───────────────→ │  Oracle Node     │
│  (sidecar)  │                  │ (1..N)    │                  │                  │
│             │                  │           │                  │ backing/ module  │
│ spot balance│                  │  live AP   │                  │  ├ tracker.rs     │
│ per token   │                  │  holdings  │                  │  ├ ledger.rs      │
└─────────────┘                  │  cache     │                  │  └ cache.rs       │
                                 └───────────┘                  │                  │
                                                                │ consensus/       │
                                                                │  └ checks fill   │
                                                                │    via cache     │
                                                                └──────────────────┘
```

Three layers:
1. **Mock AP** — exposes token holdings via SSE stream (replaced by Bitget API later)
2. **Data-node(s)** — subscribe to AP SSE, cache live holdings, re-broadcast via own SSE
3. **Oracle `backing/` module** — subscribes to data-node SSE, maintains always-on cache, gates fill signing

## Backing Ledger

**Required backing** (from on-chain state):
```
For each ITP:
  required[token] = inventory_qty[token] × totalSupply

Summed across all ITPs per token.
```

**Actual holdings** (from data-node SSE):
```
actual[token] = AP spot balance
```

**Deficit check** (per token):
```
deficit[token] = required[token] - actual[token]
deficit_usd[token] = deficit[token] × price[token]

if deficit_usd[token] > $10 → BLOCK buys for any ITP containing that token
```

## Always-On Cache

The backing check is a cache lookup — never blocks the consensus hot path.

```
BackingCache (Arc<RwLock<...>>)

  actual_holdings: HashMap<Token, f64>     ← SSE listener (background task)
  required_backing: HashMap<Token, f64>    ← on-chain event listener (background task)
  blocked_itps: HashSet<ItpId>             ← recomputed on every update
  rebalance_pending: HashSet<ItpId>        ← set/cleared by rebalance detector

  fn can_sign_fill(itp_id) → bool          ← O(1) lookup
  fn simulate_fill(itp_id, shares) → bool  ← checks if fill would push over $10
```

Two background tasks feed the cache:
1. **SSE listener** — receives AP holdings from data-node, updates `actual_holdings`, recomputes `blocked_itps`
2. **On-chain listener** — watches `confirmFills`/`confirmBatch`/rebalance events, updates `required_backing`, recomputes `blocked_itps`

**Staleness protection:** If SSE drops, cache marks all ITPs as blocked (fail-closed). Resumes on reconnect.

## Fill Gating

Both leader and followers independently check before signing:

```rust
// In confirmFills signing — zero latency, no network call
if !backing_cache.can_sign_fill(itp_id) {
    return SignDecision::Refuse;
}
```

- **Buys**: Refused if any token in the ITP has deficit > $10
- **Sells**: Always allowed (burns shares → reduces required → heals deficit)
- **Simulate**: Before signing, simulate "if these shares mint, does any token breach $10?" — refuse if yes

## Rebalance Handling

Strictest mode — block ALL minting for the ITP during rebalance:

1. Detect `proposeRebalance` event → mark ITP as `RebalancePending`
2. Block all buys for that ITP
3. Monitor AP holdings via SSE — wait for holdings to reflect new inventory quantities
4. Once new inventory is backed (within $10 cap) → clear `RebalancePending`, resume buys

## Graceful Recovery

When deficit detected:
1. Block buys for affected ITPs
2. Allow sells — each sell burns shares, reducing `required[token]`
3. Deficit shrinks as sells come in
4. When `deficit_usd[token] <= $10` for all tokens in an ITP → buys resume automatically
5. No operator intervention needed

## Mock AP Service

Sidecar process (replaced by Bitget API adapter later):
- `HashMap<token, balance>` — initialized from config or on-chain reads
- Updates balances on `completeBuyOrder` events (USDC in → tokens acquired)
- Exposes SSE stream: emits full holdings snapshot on every change
- Same SSE interface that Bitget adapter will implement later

## Per-Token Deficit Cap

- **Cap**: $10 USD per token
- **Calculation**: `deficit_usd = deficit_qty × current_price`
- **Scope**: Aggregated across all ITPs (single Bitget account holds everything)

## Key Invariants

- Cache is always warm — background tasks continuously update
- Fail-closed on SSE disconnect — block all minting until reconnected
- Leader AND followers both verify independently — double security
- Sells never blocked — natural recovery mechanism
- Rebalance = full freeze for that ITP until AP holdings confirmed
