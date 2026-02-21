# SSE Chain Reads Migration — Design

## Problem

The frontend makes 21 direct blockchain reads (wagmi `useReadContract`, viem `publicClient.readContract`, `getLogs`). This causes:
- Unreliable UX (RPC timeouts, rate limits, wallet-dependent provider quality)
- Duplicate work (every browser tab polls the same chain state independently)
- Heavy event scans (cost-basis, fill-speed scan ALL blocks on every load)
- No centralized caching (same data fetched repeatedly)

## Decision

**Single multiplexed SSE stream** (Approach C). One `EventSource` per client. Server multiplexes all subscribed topics into one connection. Client demultiplexes by event type.

## Architecture

### SSE Endpoint

```
GET /sse/stream?topics=system,nav,balances,orders&address=0xABC...
```

- `topics`: comma-separated list of data channels
- `address`: required for user-specific topics (balances, orders, positions)
- Each SSE event carries a `type` field for client-side routing

### Event Types & Intervals

| Topic | Event Type | Data | Interval |
|-------|-----------|------|----------|
| `system` | `system-status` | issuers, orders, block numbers, health | 2s |
| `nav` | `itp-nav` | NAV/share, total supply, AUM | 1s |
| `prices` | `market-prices` | all asset prices | 1s |
| `balances` | `user-balances` | USDC, ITP shares, bridged ITP | 1s |
| `allowances` | `user-allowances` | USDC approval, ITP approval | 3s |
| `orders` | `user-orders` | active orders, fill status | 1s |
| `positions` | `user-positions` | Morpho position, vault balances | 3s |
| `cost-basis` | `user-cost-basis` | historical fills for PnL | 5s |
| `oracle` | `oracle-prices` | on-chain oracle prices | 2s |

**Change detection**: Only push when values differ from last push. Wire stays quiet when nothing moves.

### Backend (data-node)

```
┌─────────────────────────────────────────────┐
│  ChainCache (Arc<RwLock<HashMap>>)           │
│                                              │
│  Global:                                     │
│    system_status: SystemStatus               │
│    itp_navs: HashMap<ItpId, NavSnapshot>     │
│    oracle_prices: HashMap<Asset, Price>       │
│    market_prices: HashMap<Symbol, Price>      │
│                                              │
│  Per-User (HashMap<Address, UserCache>):      │
│    balances: {usdc, itp_shares, bridged_itp} │
│    allowances: {usdc, itp}                   │
│    orders: Vec<Order>                        │
│    positions: MorphoPosition                 │
│    cost_basis: Vec<Fill>                     │
└─────────────────────────────────────────────┘
         ▲                          │
         │ write                    │ read + diff
   ┌─────┴──────┐          ┌───────▼────────┐
   │ Pollers    │          │ SSE Dispatcher  │
   │ (tokio     │          │ per-client task │
   │  intervals)│          │ sends only diffs│
   └────────────┘          └────────────────┘
```

**Pollers**: Separate tokio tasks per topic, each at its configured interval. Read chain state, update cache, bump generation counter.

**SSE Dispatcher**: Per-client tokio task. Loops over subscribed topics, compares generation counter to last-sent, serializes + pushes if changed.

**User cache lifecycle**: Created on first `/sse/stream?address=0x...` connection, dropped 30s after last client for that address disconnects. Avoids polling chain for users who left.

### Frontend

**Single shared hook** via React context:

```ts
const { data } = useSSE({
  topics: ['nav', 'balances', 'orders'],
  address: userAddress,
})

const nav = data.itpNav
const bal = data.userBalances
const orders = data.userOrders
```

- `SSEProvider` at app root holds the `EventSource`
- Components subscribe to specific event types via selectors
- Only re-renders when the selected slice changes
- Reconnect with exponential backoff on disconnect

### Chain Reads Being Replaced

**wagmi useReadContract (12 occurrences)**:
- `useUsdcBalance` — USDC balanceOf → `user-balances`
- `useUserItpShares` — ITP balanceOf → `user-balances`
- `useUsdcApproval` — USDC allowance → `user-allowances`
- `useItpApproval` — ITP allowance → `user-allowances`
- `useOraclePrice` — oracle currentPrice → `oracle-prices`
- `useEscrowedAmount` — vault escrow → `user-positions`
- `useMetaMorphoVault` — vault totalAssets/supply → `user-positions`
- `useMorphoPosition` — Morpho position → `user-positions`
- `useNonceCheck` — ITP nonce → `user-balances`
- `BuyItpModal` — inline reads → `user-balances`
- `SellItpModal` — inline reads → `user-balances`
- `RebalanceModal` — inline reads → `user-orders`

**viem publicClient (8 occurrences)**:
- `useOrderStatus` — getOrder → `user-orders`
- `usePortfolio` — bridged ITP balance → `user-balances`
- `useItpCostBasis` — FillConfirmed getLogs → `user-cost-basis`
- `FillSpeedChart` — FillConfirmed getLogs → precomputed in backend
- `useMorphoHistory` — Morpho event getLogs → `user-positions`
- `ActiveOrdersSection` — getOrder → `user-orders`
- `KeeperSignatureList` — event getLogs → `system-status`
- `useFillDetails` — FillConfirmed getLogs → `user-orders`

**Heavy event scans (eliminate entirely)**:
- `useItpCostBasis` scans all blocks for FillConfirmed events → data-node caches fills in DB, pushes via `user-cost-basis`
- `FillSpeedChart` scans all blocks → data-node precomputes fill speed stats
- `useMorphoHistory` scans all blocks → data-node caches Morpho events

## Migration Strategy

Incremental — one hook at a time, old and new coexist:

1. **Data-node**: Build ChainCache + pollers + `/sse/stream` endpoint
2. **Frontend**: Build `SSEProvider` + `useSSE` hook + context
3. **Migrate hooks**: Replace chain reads with SSE selectors one by one
4. **Cleanup**: Remove viem publicClient creation, wagmi contract reads, unused ABIs

Each step independently deployable. No big-bang cutover.
