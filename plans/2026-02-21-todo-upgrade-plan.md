# TODO Upgrade Plan — Frontend, Data-Node, AP

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all legitimate TODO items across frontend, data-node, and AP (issuer excluded per user request).

**Architecture:** Backend-first — add data-node endpoints/pollers, then wire frontend hooks to consume them. AP cleanup is independent.

**Tech Stack:** Rust (data-node, AP), TypeScript/React (frontend), ethers-rs, SQLite/Postgres

---

### Task 1: Add `/fill-speed` endpoint to data-node

The FillSpeedChart component shows an empty stub ("No order data yet"). The `trades` table already has `order_timestamp` and `fill_timestamp` columns — we just need an endpoint.

**Files:**
- Modify: `data-node/src/api.rs`

**Step 1: Add the endpoint handler**

Add route `.route("/fill-speed", get(fill_speed))` alongside the other routes.

Add handler:

```rust
#[derive(Serialize)]
struct FillSpeedEntry {
    order_id: i64,
    side: i16,
    amount: String,
    submit_time: String, // ISO 8601
    fill_time: Option<String>, // ISO 8601, null if unfilled
    fill_latency_secs: Option<f64>,
    fill_price: Option<String>,
    fill_amount: Option<String>,
}

async fn fill_speed(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<FillSpeedEntry>>, (StatusCode, String)> {
    // Return last 200 orders (all users, global view)
    let rows = sqlx::query_as::<_, (i64, i16, String, chrono::NaiveDateTime, Option<chrono::NaiveDateTime>, Option<String>, Option<String>)>(
        "SELECT order_id, side, amount, order_timestamp, fill_timestamp, fill_price, fill_amount \
         FROM trades ORDER BY order_timestamp DESC LIMIT 200"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let entries: Vec<FillSpeedEntry> = rows.into_iter().map(|(oid, side, amt, submit, fill_ts, fp, fa)| {
        let latency = fill_ts.map(|ft| (ft - submit).num_milliseconds() as f64 / 1000.0);
        FillSpeedEntry {
            order_id: oid,
            side,
            amount: amt,
            submit_time: submit.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            fill_time: fill_ts.map(|ft| ft.format("%Y-%m-%dT%H:%M:%SZ").to_string()),
            fill_latency_secs: latency,
            fill_price: fp,
            fill_amount: fa,
        }
    }).collect();

    Ok(Json(entries))
}
```

**Step 2: Verify**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p data-node`
Expected: compiles

**Step 3: Commit**

```bash
git add data-node/src/api.rs
git commit -m "feat(data-node): add /fill-speed global order flow endpoint"
```

---

### Task 2: Wire FillSpeedChart to `/fill-speed` endpoint

**Files:**
- Modify: `frontend/components/domain/FillSpeedChart.tsx`

**Step 1: Replace the stub with a real fetch**

Uncomment the `DATA_NODE_URL` import. Replace the TODO stub in `fetchData` with:

```ts
import { DATA_NODE_URL } from '@/lib/config'

// In fetchData:
const res = await fetch(`${DATA_NODE_URL}/fill-speed`)
if (!res.ok) throw new Error(`HTTP ${res.status}`)
const entries: Array<{
  order_id: number
  side: number
  amount: string
  submit_time: string
  fill_time: string | null
  fill_latency_secs: number | null
  fill_price: string | null
  fill_amount: string | null
}> = await res.json()

const points: OrderDataPoint[] = entries.map(e => ({
  time: Math.floor(new Date(e.submit_time).getTime() / 1000),
  timeLabel: formatTime(Math.floor(new Date(e.submit_time).getTime() / 1000)),
  buyAmount: e.side === 0 ? parseFloat(e.amount) / 1e6 : null,
  sellAmount: e.side === 1 ? parseFloat(e.amount) / 1e18 : null,
  orderId: e.order_id,
  filled: e.fill_time !== null,
  fillTime: e.fill_latency_secs ?? undefined,
}))

setData(points)
const filled = points.filter(p => p.fillTime !== undefined)
setAvgFillTime(filled.length > 0 ? filled.reduce((s, p) => s + (p.fillTime ?? 0), 0) / filled.length : 0)
```

Remove all `// TODO: re-enable` comments and uncomment the `TradeEntry` interface (or delete it if unused).

**Step 2: Verify**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add frontend/components/domain/FillSpeedChart.tsx
git commit -m "feat(frontend): wire FillSpeedChart to /fill-speed endpoint"
```

---

### Task 3: Add CuratorRateIRM borrow rate to data-node poller

The Morpho APY is currently `utilization * 0.15` (fabricated). Need to poll the actual borrow rate from the CuratorRateIRM contract.

**Files:**
- Modify: `data-node/src/chain_cache.rs` — add `borrow_rate_ray` to `OracleSnapshot`
- Modify: `data-node/src/chain_pollers.rs` — add IRM rate read in `poll_oracle`

**Step 1: Extend OracleSnapshot**

In `chain_cache.rs`, add field to `OracleSnapshot`:

```rust
pub struct OracleSnapshot {
    pub price: String,
    pub last_updated: u64,
    pub last_cycle: u64,
    pub borrow_rate_ray: String,  // NEW: 1-ray borrow rate from CuratorRateIRM
}
```

**Step 2: Add IRM polling in poll_oracle**

In `chain_pollers.rs`, add abigen:

```rust
abigen!(
    IrmReader,
    r#"[
        function rates(bytes32 marketId) external view returns (uint256)
    ]"#
);
```

In `poll_oracle_once`, after the existing oracle reads, add:

```rust
// Read borrow rate from CuratorRateIRM (falls back to "0" if not deployed)
let irm_addr_str = state.morpho_deployment["contracts"].get("CURATOR_RATE_IRM")
    .or_else(|| state.morpho_deployment["contracts"].get("ADAPTIVE_IRM"))
    .and_then(|v| v.as_str())
    .unwrap_or("0x0000000000000000000000000000000000000000");
let irm_addr: Address = irm_addr_str.parse().unwrap_or_default();

let market_id_str = state.morpho_deployment["contracts"]["MARKET_ID"]
    .as_str()
    .unwrap_or("0x0000000000000000000000000000000000000000000000000000000000000000");
let market_id_hex = market_id_str.strip_prefix("0x").unwrap_or(market_id_str);
let market_id_bytes = hex::decode(market_id_hex).unwrap_or_else(|_| vec![0u8; 32]);
let mut market_id_arr = [0u8; 32];
let len = market_id_bytes.len().min(32);
market_id_arr[..len].copy_from_slice(&market_id_bytes[..len]);

let borrow_rate_ray = if irm_addr != Address::zero() {
    let irm = IrmReader::new(irm_addr, Arc::clone(&state.arb_provider));
    irm.rates(market_id_arr).call().await.unwrap_or_default().to_string()
} else {
    "0".to_string()
};
```

Update the cache write to include `borrow_rate_ray`.

**Step 3: Update SSE serialization**

In `api.rs`, the SSE `oracle-prices` event already serializes from `OracleSnapshot`. The new field will automatically appear in the JSON since OracleSnapshot derives Serialize.

**Step 4: Verify**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p data-node`
Expected: compiles

**Step 5: Commit**

```bash
git add data-node/src/chain_cache.rs data-node/src/chain_pollers.rs
git commit -m "feat(data-node): poll CuratorRateIRM borrow rate in oracle poller"
```

---

### Task 4: Wire Morpho APY to real borrow rate from SSE

**Files:**
- Modify: `frontend/hooks/useSSE.tsx` — add `borrow_rate_ray` to OracleSnapshot type
- Modify: `frontend/hooks/useMorphoMarkets.ts` — compute APY from real rate

**Step 1: Update SSE oracle type**

In `useSSE.tsx`, update `OracleSnapshot`:

```ts
export interface OracleSnapshot {
  price: string
  last_updated: number
  last_cycle: number
  borrow_rate_ray: string  // NEW
}
```

**Step 2: Replace fabricated APY**

In `useMorphoMarkets.ts`, replace the TODO block (lines 94-96):

```ts
// Compute APY from CuratorRateIRM rate (1-ray = 1e27 per second)
const borrowApy = sseOracle?.borrow_rate_ray
  ? (() => {
      const ratePerSec = Number(BigInt(sseOracle.borrow_rate_ray)) / 1e27
      // APY = (1 + ratePerSec)^(365.25*86400) - 1, approximated for small rates
      return ratePerSec * 365.25 * 86400
    })()
  : utilization * 0.15 // fallback if rate not available
```

Remove the two TODO comments at lines 33-34 and 94.

**Step 3: Verify**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npx tsc --noEmit`
Expected: no errors

**Step 4: Commit**

```bash
git add frontend/hooks/useSSE.tsx frontend/hooks/useMorphoMarkets.ts
git commit -m "feat(frontend): replace fabricated Morpho APY with real IRM rate"
```

---

### Task 5: Add `/morpho-history` endpoint to data-node

The `useMorphoHistory` hook returns an empty array. Need a REST endpoint that queries Morpho events from the DB (or scans incrementally).

**Files:**
- Modify: `data-node/src/api.rs`

**Step 1: Add the endpoint**

Add route `.route("/morpho-history", get(morpho_history))`.

The simplest approach: scan Morpho events on-demand from chain (cached per-user with TTL), since these events are infrequent.

```rust
#[derive(Deserialize)]
struct MorphoHistoryQuery {
    address: String,
}

#[derive(Serialize)]
struct MorphoHistoryEntry {
    event_type: String, // "deposit", "withdraw", "borrow", "repay"
    amount: String,
    token: String,
    tx_hash: String,
    block_number: u64,
}

async fn morpho_history(
    State(state): State<Arc<AppState>>,
    Query(q): Query<MorphoHistoryQuery>,
) -> Result<Json<Vec<MorphoHistoryEntry>>, (StatusCode, String)> {
    // Parse user address
    let user: Address = q.address.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid address".to_string()))?;

    let morpho_addr = deployment_addr(&state.morpho_deployment, "MORPHO")
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // Scan last 10000 blocks for Morpho events (SupplyCollateral, WithdrawCollateral, Borrow, Repay)
    // These are indexed by user address (topic2)
    let latest_block = state.arb_provider.get_block_number().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .as_u64();
    let from_block = latest_block.saturating_sub(10_000);

    // Use raw log queries with topic filtering
    let filter = ethers::types::Filter::new()
        .address(morpho_addr)
        .topic2(user)
        .from_block(from_block)
        .to_block(latest_block);

    let logs = state.arb_provider.get_logs(&filter).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Map event signatures to types
    // SupplyCollateral(bytes32 id, address caller, address onBehalf, uint256 assets)
    // WithdrawCollateral(bytes32 id, address caller, address onBehalf, address receiver, uint256 assets)
    // Borrow(bytes32 id, address caller, address onBehalf, address receiver, uint256 assets, uint256 shares)
    // Repay(bytes32 id, address caller, address onBehalf, uint256 assets, uint256 shares)
    let supply_sig = ethers::utils::keccak256("SupplyCollateral(bytes32,address,address,uint256)");
    let withdraw_sig = ethers::utils::keccak256("WithdrawCollateral(bytes32,address,address,address,uint256)");
    let borrow_sig = ethers::utils::keccak256("Borrow(bytes32,address,address,address,uint256,uint256)");
    let repay_sig = ethers::utils::keccak256("Repay(bytes32,address,address,uint256,uint256)");

    let mut entries = Vec::new();
    for log in &logs {
        if log.topics.is_empty() { continue; }
        let sig = log.topics[0].as_bytes();
        let event_type = if sig == supply_sig { "deposit" }
            else if sig == withdraw_sig { "withdraw" }
            else if sig == borrow_sig { "borrow" }
            else if sig == repay_sig { "repay" }
            else { continue };

        // Amount is in the data portion (first 32 bytes after any non-indexed params)
        let amount = if log.data.len() >= 32 {
            U256::from_big_endian(&log.data[..32]).to_string()
        } else {
            "0".to_string()
        };

        let token = match event_type {
            "deposit" | "withdraw" => "ITP",
            _ => "USDC",
        };

        entries.push(MorphoHistoryEntry {
            event_type: event_type.to_string(),
            amount,
            token: token.to_string(),
            tx_hash: format!("{:?}", log.transaction_hash.unwrap_or_default()),
            block_number: log.block_number.map(|b| b.as_u64()).unwrap_or(0),
        });
    }

    Ok(Json(entries))
}
```

**Step 2: Verify**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p data-node`
Expected: compiles

**Step 3: Commit**

```bash
git add data-node/src/api.rs
git commit -m "feat(data-node): add /morpho-history endpoint for lending events"
```

---

### Task 6: Wire useMorphoHistory to `/morpho-history` endpoint

**Files:**
- Modify: `frontend/hooks/useMorphoHistory.ts`

**Step 1: Replace the empty stub**

```ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { DATA_NODE_URL } from '@/lib/config'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

export interface MorphoTx {
  type: 'deposit' | 'withdraw' | 'borrow' | 'repay'
  amount: string
  token: string
  txHash: string
  blockNumber: bigint
  timestamp: number
}

export function useMorphoHistory(_market: MorphoMarketEntry | undefined) {
  const { address } = useAccount()
  const [txs, setTxs] = useState<MorphoTx[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    try {
      const res = await fetch(`${DATA_NODE_URL}/morpho-history?address=${address}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const entries: Array<{
        event_type: string
        amount: string
        token: string
        tx_hash: string
        block_number: number
      }> = await res.json()

      setTxs(entries.map(e => ({
        type: e.event_type as MorphoTx['type'],
        amount: e.amount,
        token: e.token,
        txHash: e.tx_hash,
        blockNumber: BigInt(e.block_number),
        timestamp: 0,
      })))
    } catch {
      // Silently fail — lending history is non-critical
    } finally {
      setIsLoading(false)
    }
  }, [address])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  return { txs, isLoading, refetch: fetchHistory }
}
```

**Step 2: Verify**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add frontend/hooks/useMorphoHistory.ts
git commit -m "feat(frontend): wire useMorphoHistory to data-node REST endpoint"
```

---

### Task 7: Add arbAddress to NAV SSE payload

ItpCard currently does a per-card `useReadContract` to resolve `BridgedItpFactory.deployedItps(itpId)`. This should come from the NAV poller instead.

**Files:**
- Modify: `data-node/src/chain_cache.rs` — add `arb_address` to NavSnapshot
- Modify: `data-node/src/chain_pollers.rs` — resolve arbAddress in poll_nav
- Modify: `frontend/hooks/useSSE.tsx` — add `arb_address` to NavSnapshot type
- Modify: `frontend/components/domain/ItpListing.tsx` — use SSE arbAddress, remove useReadContract

**Step 1: Extend NavSnapshot in cache**

In `chain_cache.rs`:

```rust
pub struct NavSnapshot {
    pub itp_id: String,
    pub nav_per_share: f64,
    pub total_supply: String,
    pub aum_usd: f64,
    pub arb_address: Option<String>,  // NEW: bridged ERC20 on Arbitrum
}
```

**Step 2: Resolve arbAddress in poll_nav**

In `chain_pollers.rs` `poll_nav_once`, after reading ITP state, resolve the bridged address:

```rust
let bridge_proxy_addr = crate::api::deployment_addr(&state.deployment, "BridgeProxy")?;
let bridge_proxy = BridgeProxyPoller::new(bridge_proxy_addr, Arc::clone(&state.arb_provider));

// ... in the for loop, after reading ITP state:
let arb_address = match bridge_proxy.get_bridged_itp(id_bytes.into()).call().await {
    Ok(addr) if addr != Address::zero() => Some(format!("{:?}", addr)),
    _ => None,
};

snapshots.push(NavSnapshot {
    // ... existing fields ...
    arb_address,
});
```

**Step 3: Update frontend types**

In `useSSE.tsx`:

```ts
export interface NavSnapshot {
  itp_id: string
  nav_per_share: number
  total_supply: string
  aum_usd: number
  arb_address: string | null  // NEW
}
```

**Step 4: Use SSE arbAddress in ItpListing**

In `ItpListing.tsx`, add `arbAddress` to `ItpInfo` population in `navSnapshotsToItpInfos`:

```ts
arbAddress: nav.arb_address ?? undefined,
```

In `ItpCard`, remove the `useReadContract` call for `deployedItps` (lines 433-441) and use `itp.arbAddress` directly:

```ts
const effectiveArbAddress = itp.arbAddress ?? undefined
```

Remove the `BRIDGED_ITP_FACTORY_ABI` import if no longer used. Remove the `resolvedArbAddress` state and the `useReadContract` hook.

**Step 5: Verify**

Run both:
- `cd /Users/maxguillabert/Downloads/index && cargo check -p data-node`
- `cd /Users/maxguillabert/Downloads/index/frontend && npx tsc --noEmit`

Expected: both compile

**Step 6: Commit**

```bash
git add data-node/src/chain_cache.rs data-node/src/chain_pollers.rs frontend/hooks/useSSE.tsx frontend/components/domain/ItpListing.tsx
git commit -m "feat: add arbAddress to SSE NAV payload, remove per-card chain read"
```

---

### Task 8: Delete Jupiter dead code from common/

The Jupiter client in `common/src/integrations/jupiter.rs` is a stub with zero callers.

**Files:**
- Delete: `common/src/integrations/jupiter.rs`
- Modify: `common/src/integrations/mod.rs` — remove `pub mod jupiter;`

**Step 1: Verify no callers**

Run: `grep -r "jupiter" --include="*.rs" . | grep -v "target/" | grep -v "integrations/jupiter.rs" | grep -v "mod.rs"`

Expected: zero matches (or only comments)

**Step 2: Delete the file and remove the module declaration**

Remove `pub mod jupiter;` from `common/src/integrations/mod.rs`.
Delete `common/src/integrations/jupiter.rs`.

**Step 3: Verify**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p common`
Expected: compiles

**Step 4: Commit**

```bash
git add -A common/src/integrations/
git commit -m "cleanup(common): delete unused Jupiter/Solana stub"
```

---

### Task 9: Consolidate BitgetVaultFill type in AP

Duplicate struct defined in both `ap/src/external/bitget_vault.rs` and `common/src/adapters/bitget_vault_reader.rs`.

**Files:**
- Modify: `ap/src/external/bitget_vault.rs` — remove local struct, import from common
- Modify: `ap/src/lib.rs` — update re-export if needed

**Step 1: Check the common definition**

Verify `common::adapters::bitget_vault_reader::BitgetVaultFill` has the same fields.

**Step 2: Replace local struct with import**

In `ap/src/external/bitget_vault.rs`, remove the local `BitgetVaultFill` struct definition (and its TODO comment). Add:

```rust
use common::adapters::bitget_vault_reader::BitgetVaultFill;
```

Update any `pub use` in `ap/src/lib.rs` to re-export from common instead.

**Step 3: Verify**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p ap`
Expected: compiles

**Step 4: Commit**

```bash
git add ap/src/external/bitget_vault.rs ap/src/lib.rs
git commit -m "cleanup(ap): consolidate BitgetVaultFill type, import from common"
```

---

### Task 10: Clean up resolved TODO comments

Several TODOs are either done or trivial to close.

**Files:**
- Modify: `data-node/src/chain_pollers.rs:213` — remove `// TODO: add nonce reading if needed`
- Modify: `frontend/components/domain/ItpListing.tsx:25` — remove holder migration TODO (per-card detail, low value)
- Modify: `frontend/components/domain/ItpListing.tsx:459` — remove duplicate holder migration TODO

**Step 1: Remove stale TODO comments**

- `chain_pollers.rs:213`: The nonce is not needed by any frontend consumer. Remove the TODO comment, keep `itp_nonce: 0`.
- `ItpListing.tsx:25` and `:459`: These TODOs about migrating holder balance reads to data-node REST are valid future work but not actionable now. Add `(low priority)` to clarify they're not forgotten.

**Step 2: Verify**

Run both cargo check and tsc --noEmit.

**Step 3: Commit**

```bash
git add data-node/src/chain_pollers.rs frontend/components/domain/ItpListing.tsx
git commit -m "cleanup: remove stale TODO comments, annotate low-priority ones"
```

---

## Files Summary

| File | Action | Task |
|------|--------|------|
| `data-node/src/api.rs` | Modify — `/fill-speed` + `/morpho-history` | 1, 5 |
| `data-node/src/chain_cache.rs` | Modify — `borrow_rate_ray`, `arb_address` | 3, 7 |
| `data-node/src/chain_pollers.rs` | Modify — IRM read, arbAddress, cleanup | 3, 7, 10 |
| `frontend/components/domain/FillSpeedChart.tsx` | Modify — wire to endpoint | 2 |
| `frontend/hooks/useSSE.tsx` | Modify — new fields | 4, 7 |
| `frontend/hooks/useMorphoMarkets.ts` | Modify — real APY | 4 |
| `frontend/hooks/useMorphoHistory.ts` | Rewrite — REST endpoint | 6 |
| `frontend/components/domain/ItpListing.tsx` | Modify — SSE arbAddress | 7, 10 |
| `common/src/integrations/jupiter.rs` | Delete | 8 |
| `common/src/integrations/mod.rs` | Modify — remove jupiter | 8 |
| `ap/src/external/bitget_vault.rs` | Modify — import from common | 9 |
| `ap/src/lib.rs` | Modify — update re-export | 9 |

## Verification

1. `cargo check -p data-node` — compiles
2. `cargo check -p common` — compiles
3. `cargo check -p ap` — compiles
4. `cd frontend && npx tsc --noEmit` — no TS errors
5. `grep -rn "TODO.*fabricated\|TODO.*fill-speed\|TODO.*morpho-history\|TODO.*CuratorRateIRM" frontend/` — zero matches
6. `grep -rn "jupiter" common/src/ --include="*.rs"` — zero matches (except maybe comments)
