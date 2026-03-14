# Vision Continuous Betting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace lock-window + multiplier betting with continuous next-tick betting, dynamic source registry from data-node, and automatic batch lifecycle.

**Architecture:** Contract gets minor additions (tickDuration param, MAX_BATCHES cap). Issuer gets a two-slot bitmap model (pending/active with per-bitmap config_hash), multiplier removal, fixed-point price pipeline, and batch auto-creation. Data-node gets lock removal, integer-scaled prices, source registry endpoint, and BLS verification. Frontend removes all hardcoded sources/batches, switches to dynamic API data, and removes multiplier UI.

**Tech Stack:** Solidity (Foundry), Rust (issuer + data-node), TypeScript/React (Next.js frontend)

**Spec:** `docs/superpowers/specs/2026-03-14-vision-continuous-betting-design.md`

**Dependency order:** Contract → Data-node → Issuer → Frontend → Migration

---

## Chunk 1: Contract Changes

### Task 1: Add `tickDuration` parameter to `updateBatchConfig()`

**Files:**
- Modify: `contracts/src/vision/Vision.sol:270-312`
- Modify: `contracts/test/Vision.t.sol` (add tests)

**Context:** Currently `updateBatchConfig()` accepts `(batchId, configHash, lockOffset, blsSignature, referenceNonce, signersBitmask)`. The `tickDuration` is immutable after `createBatch()`. The spec requires dynamic tick pacing — each config update can change the tick duration.

- [ ] **Step 1: Write failing test — updateBatchConfig with tickDuration**

```solidity
function test_updateBatchConfig_changesTickDuration() public {
    // Create batch with tickDuration=600
    uint256 batchId = _createTestBatch(600, 0);

    // Update config with new tickDuration=300
    bytes32 newConfigHash = keccak256("new-config");
    bytes memory blsSig = _signUpdateConfig(batchId, newConfigHash, 0, 300);
    vision.updateBatchConfig(batchId, newConfigHash, 0, 300, blsSig, _nextNonce(), 7);

    // Verify staged (not yet promoted)
    (,, uint256 tickDuration,,,,) = vision.getBatchInfo(batchId);
    assertEq(tickDuration, 600); // still old

    // Advance time past tick boundary to trigger promotion
    vm.warp(block.timestamp + 601);
    vision.updateBatchConfig(batchId, newConfigHash, 0, 300, blsSig, _nextNonce(), 7); // triggers promote

    (,, uint256 newTickDuration,,,,) = vision.getBatchInfo(batchId);
    assertEq(newTickDuration, 300);
}
```

Run: `cd contracts && forge test --match-test test_updateBatchConfig_changesTickDuration -vvv`
Expected: FAIL — function signature mismatch

- [ ] **Step 2: Add tickDuration parameter to updateBatchConfig()**

In `Vision.sol`, change the function signature at line 270:

```solidity
function updateBatchConfig(
    uint256 batchId,
    bytes32 configHash,
    uint256 lockOffset,
    uint256 tickDuration,      // NEW
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external {
    _promoteConfigIfNeeded(batchId);
    _requireNotLocked(batchId);

    Batch storage b = _batches[batchId];
    if (b.configHash == configHash && b.nextConfigHash == bytes32(0)) return;

    require(tickDuration > 0 && tickDuration <= MAX_TICK_DURATION, "InvalidTickDuration");
    require(lockOffset < tickDuration || lockOffset == 0, "LockOffsetTooLarge");

    bytes32 messageHash = keccak256(abi.encode(
        block.chainid,
        address(this),
        "UPDATE_BATCH_CONFIG",
        batchId,
        configHash,
        lockOffset,
        tickDuration          // NEW: include in BLS message
    ));
    _verifyBLS(messageHash, blsSignature, referenceNonce, signersBitmask);

    b.nextConfigHash = configHash;
    b.nextLockOffset = lockOffset;
    b.nextTickDuration = tickDuration;  // NEW: stage for promotion

    emit BatchConfigUpdated(batchId, configHash, lockOffset, tickDuration);
}
```

Add `nextTickDuration` to Batch struct storage. Update `_promoteConfigIfNeeded()` to promote tickDuration:

```solidity
function _promoteConfigIfNeeded(uint256 batchId) internal {
    Batch storage b = _batches[batchId];
    if (b.nextConfigHash == bytes32(0)) return;

    uint256 currentTick = block.timestamp / b.tickDuration;
    if (currentTick > b.lastPromotionTick) {
        bytes32 oldHash = b.configHash;
        b.configHash = b.nextConfigHash;
        b.lockOffset = b.nextLockOffset;
        if (b.nextTickDuration > 0) {
            b.tickDuration = b.nextTickDuration;
        }
        b.lastPromotionTick = currentTick;
        b.nextConfigHash = bytes32(0);
        b.nextLockOffset = 0;
        b.nextTickDuration = 0;
        emit BatchConfigPromoted(batchId, oldHash, b.configHash, currentTick);
    }
}
```

- [ ] **Step 3: Run test**

Run: `cd contracts && forge test --match-test test_updateBatchConfig_changesTickDuration -vvv`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add contracts/src/vision/Vision.sol contracts/test/Vision.t.sol
git commit -m "feat(contract): add tickDuration param to updateBatchConfig"
```

---

### Task 2: Add MAX_BATCHES cap to _createBatch()

**Files:**
- Modify: `contracts/src/vision/Vision.sol:216-267`
- Modify: `contracts/test/Vision.t.sol`

- [ ] **Step 1: Write failing test**

```solidity
function test_createBatch_revertsAtMaxBatches() public {
    // Create MAX_BATCHES batches
    for (uint256 i = 0; i < 200; i++) {
        bytes32 sourceId = keccak256(abi.encodePacked("source_", i));
        _createTestBatchWithSource(sourceId, 600, 0);
    }

    // 201st should revert
    bytes32 overflowSource = keccak256("overflow");
    vm.expectRevert("TooManyBatches");
    _createTestBatchWithSource(overflowSource, 600, 0);
}
```

Run: `cd contracts && forge test --match-test test_createBatch_revertsAtMaxBatches -vvv`
Expected: FAIL — no cap exists

- [ ] **Step 2: Add MAX_BATCHES constant and check**

In `Vision.sol`, add constant and check in `_createBatch()`:

```solidity
uint256 public constant MAX_BATCHES = 200;

function _createBatch(...) internal returns (uint256 batchId) {
    if (sourceIdHasBatch[sourceId]) return sourceIdToBatchId[sourceId];

    require(nextBatchId < MAX_BATCHES, "TooManyBatches");
    // ... rest of creation logic
}
```

- [ ] **Step 3: Run tests**

Run: `cd contracts && forge test --match-test test_createBatch -vvv`
Expected: PASS

- [ ] **Step 4: Update all callers of updateBatchConfig in tests/scripts**

Search all Solidity files that call `updateBatchConfig` and add the `tickDuration` parameter.

Run: `cd contracts && forge build`
Expected: Compiles clean

- [ ] **Step 5: Commit**

```bash
git add contracts/
git commit -m "feat(contract): add MAX_BATCHES=200 cap, update all callers for tickDuration param"
```

---

## Chunk 2: Data-Node Changes

### Task 3: Remove lock period freeze from batch_engine

**Files:**
- Modify: `data-node/src/batch_engine.rs:441-462`

**Context:** `generate_batch_config()` returns `None` during lock periods. With `lockOffset = 0`, this is dead code — remove it.

- [ ] **Step 1: Remove lock period check from generate_batch_config()**

In `batch_engine.rs`, remove the block at lines 441-462:

```rust
// DELETE THIS BLOCK:
// let elapsed = now_epoch % tick_duration;
// let remaining = tick_duration - elapsed;
// if remaining <= lock_offset {
//     info!(..., "Lock period — freezing batch config");
//     return None;
// }
```

- [ ] **Step 2: Force lockOffset=0 in generated configs**

In `generate_batch_config()`, replace the `lock_offset_for_interval()` call:

```rust
let lock_offset = 0u64; // Continuous betting: no lock window
```

- [ ] **Step 3: Run data-node tests**

Run: `cd data-node && cargo test batch_engine`
Expected: PASS (or fix any tests that assert lock behavior)

- [ ] **Step 4: Commit**

```bash
git add data-node/src/batch_engine.rs
git commit -m "feat(data-node): remove lock period freeze, force lockOffset=0"
```

---

### Task 4: Add GET /sources/registry endpoint

**Files:**
- Create: `data-node/src/source_registry.rs`
- Modify: `data-node/src/api.rs` (add route)
- Create: `data-node/config/sources-display.json` (display metadata)

**Context:** Frontend currently hardcodes 75+ sources in `sources.ts`. This endpoint replaces all hardcoded source metadata with a single API call.

- [ ] **Step 1: Create sources-display.json with migrated metadata**

Migrate all entries from `frontend/lib/vision/sources.ts` VISION_SOURCES array into a JSON config file. Each entry needs: `sourceId`, `name`, `description`, `category`, `logo`, `brandBg`, `prefixes`, `valueLabel`, `valueUnit`, `isPrice`.

```json
{
  "sources": [
    {
      "sourceId": "stocks",
      "name": "US Stocks",
      "description": "NYSE & NASDAQ equities via Finnhub",
      "category": "finance",
      "logo": "/logos/finnhub.svg",
      "brandBg": "#D4A574",
      "prefixes": ["stock_"],
      "valueLabel": "Price",
      "valueUnit": "USD",
      "isPrice": true
    }
  ],
  "categories": [
    { "key": "finance", "label": "Finance", "order": 0 },
    { "key": "economic", "label": "Economics & Rates", "order": 1 },
    { "key": "regulatory", "label": "Regulatory & Policy", "order": 2 },
    { "key": "tech", "label": "Tech & Dev", "order": 3 },
    { "key": "predictions", "label": "Predictions", "order": 4 },
    { "key": "entertainment", "label": "Entertainment & Gaming", "order": 5 },
    { "key": "weather", "label": "Weather & Environment", "order": 6 },
    { "key": "transport", "label": "Transport & Tourism", "order": 7 },
    { "key": "science", "label": "Science & Space", "order": 8 },
    { "key": "social", "label": "Social & Community", "order": 9 }
  ]
}
```

Populate from current `VISION_SOURCES` in `frontend/lib/vision/sources.ts` — all 75+ entries.

- [ ] **Step 2: Create source_registry.rs**

```rust
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceDisplay {
    pub source_id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub logo: String,
    pub brand_bg: String,
    pub prefixes: Vec<String>,
    pub value_label: String,
    pub value_unit: String,
    pub is_price: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryDisplay {
    pub key: String,
    pub label: String,
    pub order: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceRegistry {
    pub sources: Vec<SourceDisplay>,
    pub categories: Vec<CategoryDisplay>,
}

impl SourceRegistry {
    pub fn load(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let data = std::fs::read_to_string(path)?;
        Ok(serde_json::from_str(&data)?)
    }
}
```

- [ ] **Step 3: Add route in api.rs**

```rust
// In router setup:
.route("/sources/registry", get(sources_registry))

async fn sources_registry(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let registry = &state.source_registry;
    Json(serde_json::to_value(registry).unwrap())
}
```

Load the registry in AppState initialization from `config/sources-display.json`.

- [ ] **Step 4: Test endpoint**

Run: `cd data-node && cargo test sources_registry`
Expected: PASS

Run manually: `curl http://localhost:8080/sources/registry | jq '.sources | length'`
Expected: 75+ sources

- [ ] **Step 5: Commit**

```bash
git add data-node/src/source_registry.rs data-node/src/api.rs data-node/config/sources-display.json
git commit -m "feat(data-node): add GET /sources/registry endpoint for dynamic source metadata"
```

---

### Task 5: Integer-scaled prices in snapshot response

**Files:**
- Modify: `data-node/src/api.rs` (snapshot endpoint)
- Modify: `data-node/src/batch_engine.rs` (config generation)

**Context:** Issuers currently parse prices as f64, then convert `(price * 1e8) as u128` — non-deterministic across hardware. Data-node must return integer-scaled values so issuers parse directly to u128.

- [ ] **Step 1: Add `price_scaled` field to snapshot response**

In the snapshot endpoint, alongside the existing `value` field (kept for backward compat), add `value_scaled` as a string:

```rust
// For each market in the snapshot response:
let value_f64: f64 = /* existing price */;
let value_scaled: u128 = (value_f64 * 1e8).round() as u128;
market_json["value_scaled"] = serde_json::Value::String(value_scaled.to_string());
market_json["price_scale"] = serde_json::json!(100_000_000u64);
```

The rounding happens ONCE at the data-node (single source of truth), then all issuers parse the same string → identical u128 values.

- [ ] **Step 2: Test snapshot response includes value_scaled**

Run: `curl http://localhost:8080/vision/snapshot/stocks | jq '.markets[0] | {value, value_scaled, price_scale}'`
Expected: `{ "value": 195.42, "value_scaled": "19542000000", "price_scale": 100000000 }`

- [ ] **Step 3: Commit**

```bash
git add data-node/src/api.rs
git commit -m "feat(data-node): add integer-scaled prices (value_scaled) to snapshot response"
```

---

### Task 6: HMAC hard-fail + BLS verification on POST /batches/signed

**Files:**
- Modify: `data-node/src/api.rs:5466-5580` (store_signed_batch)

**Context:** Two security fixes: (1) HMAC missing header must be an error when secret is configured, (2) POST /batches/signed should verify BLS signature before storing.

- [ ] **Step 1: HMAC hard-fail — issuer-side change**

This is an issuer change, not data-node. Flag for Task in Chunk 4. The data-node change here is BLS verification.

- [ ] **Step 2: Add BLS signature verification to store_signed_batch**

In `store_signed_batch()`, after the admin auth check and hash verification, add BLS sig check:

```rust
// After DN-1 hash verification succeeds:
if let Some(ref agg_pubkey) = state.bls_aggregate_pubkey {
    let message_hash = compute_update_config_bls_hash(
        state.chain_id,
        state.vision_address,
        &payload.config_hash,
        payload.lock_offset_secs,
        payload.tick_duration_secs,
    );
    if !verify_bls_signature(agg_pubkey, &message_hash, &payload.bls_signature) {
        tracing::warn!("BLS signature verification failed for signed batch");
        return StatusCode::BAD_REQUEST;
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add data-node/src/api.rs
git commit -m "feat(data-node): add BLS sig verification on POST /batches/signed"
```

---

## Chunk 3: Issuer — Two-Slot Bitmap Model

### Task 7: SlottedBitmap struct + two-slot BitmapStore

**Files:**
- Modify: `issuer/src/vision/types.rs` — add SlottedBitmap
- Rewrite: `issuer/src/vision/bitmap_store.rs` — two-slot model

**Context:** The current BitmapStore has a single `HashMap<(u64, Address), StoredBitmap>`. The new model needs `pending_bitmaps` and `active_bitmaps` per batch, each storing config_hash and target_tick_id alongside bitmap data.

- [ ] **Step 1: Add SlottedBitmap to types.rs**

```rust
#[derive(Clone, Debug)]
pub struct SlottedBitmap {
    pub player: Address,
    pub batch_id: u64,
    pub bitmap: Vec<u8>,
    pub hash: H256,
    pub config_hash: H256,
    pub target_tick_id: u64,
    pub received_at: u64,
}
```

- [ ] **Step 2: Write failing test for two-slot store**

```rust
#[tokio::test]
async fn test_two_slot_store_and_flip() {
    let store = BitmapStore::new();
    let player = Address::from_low_u64_be(1);
    let batch_id = 100;
    let config_hash = H256::from_low_u64_be(42);
    let bitmap = vec![0b10101010];
    let hash = keccak256(&bitmap);

    // Store goes to pending
    store.store_pending(player, batch_id, bitmap.clone(), hash, config_hash, 5).await.unwrap();

    // Active should be empty
    assert!(store.get_active(batch_id, player).await.is_none());

    // Pending should have it
    assert!(store.get_pending(batch_id, player).await.is_some());

    // Flip
    store.flip(batch_id).await;

    // Now active has it, pending is empty
    let active = store.get_active(batch_id, player).await.unwrap();
    assert_eq!(active.config_hash, config_hash);
    assert_eq!(active.target_tick_id, 5);
    assert!(store.get_pending(batch_id, player).await.is_none());
}

#[tokio::test]
async fn test_flip_clears_previous_active() {
    let store = BitmapStore::new();
    let player = Address::from_low_u64_be(1);
    let batch_id = 100;

    // Submit for tick 5, flip → active
    store.store_pending(player, batch_id, vec![0xFF], H256::zero(), H256::zero(), 5).await.unwrap();
    store.flip(batch_id).await;

    // Submit for tick 6
    store.store_pending(player, batch_id, vec![0x00], H256::zero(), H256::zero(), 6).await.unwrap();

    // Flip again — old active (tick 5) is gone, new active is tick 6
    store.flip(batch_id).await;
    let active = store.get_active(batch_id, player).await.unwrap();
    assert_eq!(active.bitmap, vec![0x00]);
    assert_eq!(active.target_tick_id, 6);
}

#[tokio::test]
async fn test_no_pending_means_sit_out() {
    let store = BitmapStore::new();
    let player = Address::from_low_u64_be(1);
    let batch_id = 100;

    // No submission → flip → no active
    store.flip(batch_id).await;
    assert!(store.get_active(batch_id, player).await.is_none());
}
```

Run: `cd issuer && cargo test test_two_slot -v`
Expected: FAIL — methods don't exist

- [ ] **Step 3: Implement two-slot BitmapStore**

```rust
pub struct BitmapStore {
    pending: RwLock<HashMap<(u64, Address), SlottedBitmap>>,
    active: RwLock<HashMap<(u64, Address), SlottedBitmap>>,
}

impl BitmapStore {
    pub fn new() -> Self {
        Self {
            pending: RwLock::new(HashMap::new()),
            active: RwLock::new(HashMap::new()),
        }
    }

    pub async fn store_pending(
        &self,
        player: Address,
        batch_id: u64,
        bitmap: Vec<u8>,
        expected_hash: H256,
        config_hash: H256,
        target_tick_id: u64,
    ) -> Result<(), BitmapStoreError> {
        let computed = keccak256(&bitmap);
        if computed != expected_hash {
            return Err(BitmapStoreError::HashMismatch { expected: expected_hash, computed });
        }
        let entry = SlottedBitmap {
            player, batch_id, bitmap, hash: computed,
            config_hash, target_tick_id,
            received_at: now_epoch(),
        };
        self.pending.write().await.insert((batch_id, player), entry);
        Ok(())
    }

    pub async fn get_active(&self, batch_id: u64, player: Address) -> Option<SlottedBitmap> {
        self.active.read().await.get(&(batch_id, player)).cloned()
    }

    pub async fn get_pending(&self, batch_id: u64, player: Address) -> Option<SlottedBitmap> {
        self.pending.read().await.get(&(batch_id, player)).cloned()
    }

    pub async fn get_all_active_for_batch(&self, batch_id: u64) -> Vec<SlottedBitmap> {
        self.active.read().await.iter()
            .filter(|((bid, _), _)| *bid == batch_id)
            .map(|(_, v)| v.clone())
            .collect()
    }

    pub async fn flip(&self, batch_id: u64) {
        let mut pending = self.pending.write().await;
        let mut active = self.active.write().await;

        // Remove old active for this batch
        active.retain(|(bid, _), _| *bid != batch_id);

        // Move pending → active for this batch
        let to_move: Vec<_> = pending.iter()
            .filter(|((bid, _), _)| *bid == batch_id)
            .map(|(k, v)| (*k, v.clone()))
            .collect();

        for (key, val) in to_move {
            pending.remove(&key);
            active.insert(key, val);
        }
    }

    pub async fn remove(&self, batch_id: u64, player: Address) {
        self.pending.write().await.remove(&(batch_id, player));
        self.active.write().await.remove(&(batch_id, player));
    }
}
```

- [ ] **Step 4: Run tests**

Run: `cd issuer && cargo test test_two_slot -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add issuer/src/vision/types.rs issuer/src/vision/bitmap_store.rs
git commit -m "feat(issuer): two-slot bitmap store with pending/active and config_hash tracking"
```

---

### Task 8: DB schema migration for bitmap slots

**Files:**
- Create: `issuer/migrations/YYYYMMDDHHMMSS_bitmap_slots.sql`
- Modify: `issuer/src/vision/bitmap_store.rs` — persist_to_db and load_from_db

- [ ] **Step 1: Write migration SQL**

```sql
-- Add slot tracking to vision_bitmaps
ALTER TABLE vision_bitmaps ADD COLUMN slot TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE vision_bitmaps ADD COLUMN target_tick_id BIGINT NOT NULL DEFAULT 0;
ALTER TABLE vision_bitmaps ADD COLUMN config_hash TEXT NOT NULL DEFAULT '';

-- Drop old unique constraint, add new one with slot
ALTER TABLE vision_bitmaps DROP CONSTRAINT IF EXISTS vision_bitmaps_pkey;
ALTER TABLE vision_bitmaps DROP CONSTRAINT IF EXISTS vision_bitmaps_batch_id_player_key;
ALTER TABLE vision_bitmaps ADD PRIMARY KEY (batch_id, player, slot);

-- Batch state table for crash recovery
CREATE TABLE IF NOT EXISTS vision_batch_state (
    batch_id BIGINT PRIMARY KEY,
    current_tick_id BIGINT NOT NULL DEFAULT 0,
    last_resolved_tick_id BIGINT NOT NULL DEFAULT 0,
    active_config_hash TEXT NOT NULL DEFAULT ''
);
```

- [ ] **Step 2: Update persist_to_db for slots**

```rust
pub async fn persist_pending_to_db(&self, pool: &PgPool, batch_id: u64, player: Address, bitmap: &SlottedBitmap) {
    sqlx::query(
        "INSERT INTO vision_bitmaps (batch_id, player, bitmap, bitmap_hash, slot, target_tick_id, config_hash)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6)
         ON CONFLICT (batch_id, player, slot) DO UPDATE SET
           bitmap = EXCLUDED.bitmap, bitmap_hash = EXCLUDED.bitmap_hash,
           target_tick_id = EXCLUDED.target_tick_id, config_hash = EXCLUDED.config_hash"
    )
    .bind(batch_id as i64)
    .bind(format!("{:?}", player))
    .bind(&bitmap.bitmap)
    .bind(format!("{:?}", bitmap.hash))
    .bind(bitmap.target_tick_id as i64)
    .bind(format!("{:?}", bitmap.config_hash))
    .execute(pool).await.ok();
}

pub async fn persist_flip_to_db(&self, pool: &PgPool, batch_id: u64) {
    // Delete old active, rename pending → active
    sqlx::query("DELETE FROM vision_bitmaps WHERE batch_id = $1 AND slot = 'active'")
        .bind(batch_id as i64).execute(pool).await.ok();
    sqlx::query("UPDATE vision_bitmaps SET slot = 'active' WHERE batch_id = $1 AND slot = 'pending'")
        .bind(batch_id as i64).execute(pool).await.ok();
}
```

- [ ] **Step 3: Update load_from_db for slot awareness**

```rust
pub async fn load_from_db(&self, pool: &PgPool) -> Result<(), sqlx::Error> {
    let rows = sqlx::query_as::<_, BitmapRow>(
        "SELECT batch_id, player, bitmap, bitmap_hash, slot, target_tick_id, config_hash FROM vision_bitmaps"
    ).fetch_all(pool).await?;

    let mut pending = self.pending.write().await;
    let mut active = self.active.write().await;

    for row in rows {
        let entry = SlottedBitmap {
            player: row.player.parse().unwrap(),
            batch_id: row.batch_id as u64,
            bitmap: row.bitmap,
            hash: row.bitmap_hash.parse().unwrap(),
            config_hash: row.config_hash.parse().unwrap_or_default(),
            target_tick_id: row.target_tick_id as u64,
            received_at: 0,
        };
        let key = (entry.batch_id, entry.player);
        match row.slot.as_str() {
            "pending" => { pending.insert(key, entry); }
            "active" => { active.insert(key, entry); }
            _ => {}
        }
    }
    Ok(())
}
```

- [ ] **Step 4: Run tests**

Run: `cd issuer && cargo test bitmap_store -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add issuer/migrations/ issuer/src/vision/bitmap_store.rs
git commit -m "feat(issuer): bitmap DB schema with slot/tick_id/config_hash, crash recovery"
```

---

## Chunk 4: Issuer — Resolver + Engine Changes

### Task 9: Remove multiplier from resolver

**Files:**
- Modify: `issuer/src/vision/resolver.rs:121-144, 238`
- Delete: `issuer/src/vision/multiplier.rs`
- Modify: `issuer/src/vision/types.rs` — remove PlayerMultiplier, join_timestamp, num_committed_ticks
- Modify: `issuer/src/vision/mod.rs` — remove `pub mod multiplier`

- [ ] **Step 1: Write test — resolver uses flat stakePerTick**

```rust
#[tokio::test]
async fn test_resolve_tick_flat_weighting() {
    // Setup: 2 players, same stake, different join times
    // Old behavior: early joiner gets higher multiplier
    // New behavior: both get equal weight
    let (resolver, batch, players, prices, configs) = setup_test_resolution();

    let result = resolver.resolve_tick(&batch, 1, &players, &prices, now(), &configs).await.unwrap();

    // Both players should have identical effective_stake = stake_per_tick
    // (no multiplier amplification)
    for pb in &result.player_balances {
        // Verify no multiplier field in result
        // Verify deltas are based on flat stake, not weighted
    }
}
```

- [ ] **Step 2: Remove multiplier computation from resolve_tick()**

In `resolver.rs`, replace lines 121-144 (multiplier computation block) with flat stake:

```rust
// OLD: let multipliers = multiplier::compute_all_multipliers(...);
// NEW: Use raw stake_per_tick directly
let per_market_stake = |player: &PlayerPosition| -> U256 {
    if market_configs.is_empty() { return U256::zero(); }
    player.stake_per_tick / U256::from(market_configs.len())
};
```

Update line 238 where `mult.effective_stake` is used to use `per_market_stake(player)` instead.

- [ ] **Step 3: Delete multiplier.rs**

```bash
rm issuer/src/vision/multiplier.rs
```

Remove from `mod.rs`:
```rust
// DELETE: pub mod multiplier;
```

Remove from `types.rs`:
```rust
// DELETE PlayerMultiplier struct
// DELETE join_timestamp from PlayerPosition
// DELETE num_committed_ticks from PlayerPosition
```

Remove all `use super::multiplier` imports from `resolver.rs` and `engine.rs`.

- [ ] **Step 4: Fix compilation**

Run: `cd issuer && cargo build 2>&1 | head -50`
Fix any remaining references to multiplier, join_timestamp, num_committed_ticks.

- [ ] **Step 5: Run tests**

Run: `cd issuer && cargo test resolver -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A issuer/src/vision/
git commit -m "feat(issuer): remove multiplier system, use flat stakePerTick weighting"
```

---

### Task 10: Flat bitmap indexing + config_hash-aware decoding

**Files:**
- Modify: `issuer/src/vision/resolver.rs:227-245`

**Context:** Current bitmap uses tick-major indexing: `bit_index = tick_offset * num_markets + market_idx`. New model: single tick per bitmap, so `bit_index = market_idx`.

Each active bitmap stores the `config_hash` it was encoded against. The resolver must fetch the market list for THAT config, not the batch's current config.

- [ ] **Step 1: Write test for flat indexing**

```rust
#[tokio::test]
async fn test_flat_bitmap_indexing() {
    // Bitmap: 0b10110000 = markets [UP, DOWN, UP, UP, ...]
    let bitmap = vec![0b10110000];

    // Flat indexing: bit 0 = market 0, bit 1 = market 1, ...
    assert_eq!(get_bitmap_bit(&bitmap, 0), Some(true));   // UP
    assert_eq!(get_bitmap_bit(&bitmap, 1), Some(false));  // DOWN
    assert_eq!(get_bitmap_bit(&bitmap, 2), Some(true));   // UP
    assert_eq!(get_bitmap_bit(&bitmap, 3), Some(true));   // UP
    assert_eq!(get_bitmap_bit(&bitmap, 4), Some(false));  // DOWN
}
```

- [ ] **Step 2: Change bitmap indexing to flat**

In `resolver.rs`, replace lines 227-230:

```rust
// OLD:
// let tick_offset = tick_id.saturating_sub(player.start_tick) as usize;
// let bit_index = tick_offset * market_configs.len() + market_idx;

// NEW: flat indexing — one bitmap = one tick
let bit_index = market_idx;
```

- [ ] **Step 3: Use bitmap's config_hash for market lookup**

In `resolve_tick()`, change bitmap fetching to use the active slot and decode with the bitmap's own config:

```rust
// Fetch active bitmaps (not all bitmaps)
let active_bitmaps = self.bitmap_store.get_all_active_for_batch(batch.id).await;

// For each active bitmap, look up the market configs it was encoded against
for ab in &active_bitmaps {
    let bitmap_market_configs = config_cache.get_or_fetch(&ab.config_hash).await?;
    // Decode using bitmap_market_configs, not the batch's current market_configs
}
```

- [ ] **Step 4: Run tests**

Run: `cd issuer && cargo test resolver -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add issuer/src/vision/resolver.rs
git commit -m "feat(issuer): flat bitmap indexing + config_hash-aware decoding"
```

---

### Task 11: Bitmap flip in engine + remove degraded mode

**Files:**
- Modify: `issuer/src/vision/engine.rs:1265-1460`

- [ ] **Step 1: Add bitmap flip after resolution in engine**

In the resolution loop (after BLS consensus succeeds), add:

```rust
// After successful tick resolution + BLS consensus:

// 1. Flip bitmaps: active = pending, pending = cleared
bitmap_store.flip(batch_id).await;
bitmap_store.persist_flip_to_db(&db_pool, batch_id).await;

// 2. Config promotion (if pending) — new config applies to future submissions only
// (handled by chain listener via BatchConfigPromoted event, no engine action needed)
```

- [ ] **Step 2: Remove degraded-mode balance application**

Replace lines 1378-1394:

```rust
// OLD:
// Err(e) => {
//     tracing::error!("Failed to create tick consensus proposal — applying directly (degraded)");
//     apply_balances(&scheduler, &db_pool, batch_id, tick_id, &result.player_balances).await;
// }

// NEW:
Err(e) => {
    tracing::error!(
        batch_id,
        tick_id,
        error = %e,
        "CRITICAL: Failed to create tick consensus proposal — SKIPPING tick (no balance changes applied)"
    );
    // Do NOT apply balances without BLS consensus
    // Do NOT flip bitmaps — tick will be retried on next poll
    continue;
}
```

- [ ] **Step 3: Add bitmap_set_hash to BLS consensus message**

Before creating the tick consensus proposal, compute the bitmap set hash:

```rust
let active_bitmaps = bitmap_store.get_all_active_for_batch(batch_id).await;
let mut bitmap_set: Vec<(Address, H256)> = active_bitmaps.iter()
    .map(|b| (b.player, b.hash))
    .collect();
bitmap_set.sort_by_key(|(addr, _)| *addr);
let bitmap_set_hash = keccak256(&bitmap_set.abi_encode());

// Include in tick consensus proposal
let proposal = tc.create_proposal(&result, bitmap_set_hash).await?;
```

- [ ] **Step 4: Add first-tick skip for new batches**

```rust
// Before resolution, check if this is the first tick for the batch
let is_first_tick = scheduler.get_last_resolved(batch_id).await.is_none();
if is_first_tick {
    tracing::info!(batch_id, tick_id, "First tick for batch — establishing reference prices only, skipping resolution");
    // Store reference prices, mark tick as resolved, but don't compute PnL
    update_reference_prices(&mut reference_prices, batch_id, &market_prices);
    scheduler.mark_resolved_with_db(&db_pool, batch_id, tick_id).await;
    continue;
}
```

- [ ] **Step 5: Run tests**

Run: `cd issuer && cargo test engine -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add issuer/src/vision/engine.rs
git commit -m "feat(issuer): bitmap flip in resolution, remove degraded mode, first-tick skip, bitmap_set_hash"
```

---

### Task 12: Fixed-point price parsing + HMAC hard-fail

**Files:**
- Modify: `issuer/src/vision/engine.rs:322-332` (price parsing)
- Modify: `issuer/src/vision/engine.rs:284-286` (HMAC)
- Modify: `issuer/src/vision/resolver.rs:200-203` (price conversion)

- [ ] **Step 1: Parse integer-scaled prices from data-node**

In `engine.rs`, update `parse_snapshot_data()` to prefer `value_scaled`:

```rust
let value: u128 = if let Some(scaled) = snap.get("value_scaled").and_then(|v| v.as_str()) {
    scaled.parse::<u128>().unwrap_or(0)
} else if let Some(f) = snap.get("value").and_then(|v| v.as_f64()) {
    // Legacy fallback — round once here
    (f * 1e8).round() as u128
} else {
    0
};
```

- [ ] **Step 2: Update resolver to use pre-scaled prices**

In `resolver.rs`, replace lines 200-203:

```rust
// OLD:
// let start_price_scaled = (start_price * 1e8) as u128;
// let end_price_scaled = (end_price * 1e8) as u128;

// NEW: prices are already scaled to 1e8 integers
let start_price_scaled = start_price; // u128, already scaled
let end_price_scaled = end_price;     // u128, already scaled
```

Update `MarketPrices` to store `u128` instead of `f64`.

- [ ] **Step 3: HMAC hard-fail**

In `engine.rs`, replace lines 284-286:

```rust
// OLD:
// tracing::warn!("Snapshot response missing X-Snapshot-HMAC header");

// NEW:
if self.config.snapshot_hmac_secret.is_some() {
    return Err(anyhow!("Snapshot HMAC header missing — rejecting unauthenticated data"));
}
// If no secret configured, proceed (HMAC not expected)
```

- [ ] **Step 4: Run tests**

Run: `cd issuer && cargo test -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add issuer/src/vision/engine.rs issuer/src/vision/resolver.rs
git commit -m "feat(issuer): fixed-point price parsing from data-node, HMAC hard-fail"
```

---

### Task 13: Fix i64 overflow in apply_tick_balances_with_db

**Files:**
- Modify: `issuer/src/vision/tick_scheduler.rs:174`

- [ ] **Step 1: Fix the overflow**

```rust
// OLD:
// .bind(pb.new_balance.as_u128() as i64)

// NEW: store as text to avoid i64 overflow (L3 USDC = 18 decimals, >9.22 USDC overflows i64)
.bind(pb.new_balance.to_string())
```

Update the DB column type or use TEXT for balance storage. Match the approach already used in `store_balance_proof` which uses `balance.to_string()`.

- [ ] **Step 2: Update load_from_db to parse TEXT balance**

```rust
// In load_from_db, parse balance from string:
let balance = U256::from_dec_str(&row.balance_str).unwrap_or_default();
```

- [ ] **Step 3: Commit**

```bash
git add issuer/src/vision/tick_scheduler.rs
git commit -m "fix(issuer): use TEXT for balance persistence, prevent i64 overflow"
```

---

## Chunk 5: Issuer — Config Orchestrator + Batch Auto-Creation

### Task 14: Remove lock period checks from orchestrator

**Files:**
- Modify: `issuer/src/vision/batch_config_orchestrator.rs:158-169, 320, 357`

- [ ] **Step 1: Remove is_in_lock_period() and all callers**

Delete `is_in_lock_period()` function (lines 158-169).
Remove the check in `run_leader_round()` (line 235).
Remove the check in `publish_to_data_node()` (line 320).
Remove the check in `replicate_to_own_data_node()` (line 357).

- [ ] **Step 2: Run tests**

Run: `cd issuer && cargo test orchestrator -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add issuer/src/vision/batch_config_orchestrator.rs
git commit -m "feat(issuer): remove lock period checks from config orchestrator"
```

---

### Task 15: Add batch auto-creation + safeguards

**Files:**
- Modify: `issuer/src/vision/batch_config_orchestrator.rs`

- [ ] **Step 1: Add auto-creation in leader round**

In `run_leader_round()`, after fetching recommended batches:

```rust
// Check for sources with no on-chain batch
for recommended in &recommended_batches {
    let source_id = H256::from(keccak256(recommended.source_id.as_bytes()));
    if !scheduler.has_batch_for_source(source_id).await {
        // Rate limit: max 3 new batches per hour
        if self.recent_creations.len() >= 3 {
            tracing::warn!("Rate limit: skipping auto-creation for {}", recommended.source_id);
            continue;
        }
        // Min healthy assets check
        if recommended.markets.len() < 5 {
            tracing::warn!("Too few markets ({}) for auto-creation: {}", recommended.markets.len(), recommended.source_id);
            continue;
        }
        // Propose createBatchAndJoin via BLS
        self.propose_batch_creation(recommended).await?;
        self.recent_creations.push(Instant::now());
    }
}
// Expire old creation timestamps
self.recent_creations.retain(|t| t.elapsed() < Duration::from_secs(3600));
```

- [ ] **Step 2: Tighten follower verification tolerances**

In `verify_single_source()`, update constants:

```rust
// OLD:
// const THRESHOLD_TOLERANCE: f64 = 0.50;
// const ASSET_COUNT_TOLERANCE: f64 = 0.50;
// const UNKNOWN_ASSET_TOLERANCE: f64 = 0.20;

// NEW:
const THRESHOLD_TOLERANCE: f64 = 0.20;
const ASSET_COUNT_TOLERANCE: f64 = 0.30;
const UNKNOWN_ASSET_TOLERANCE: f64 = 0.05;
```

Also change unknown source handling (line 294-296):

```rust
// OLD: None => { accept_count += 1; }
// NEW: Unknown sources are rejections, not acceptances
None => { reject_count += 1; }
```

- [ ] **Step 3: Update updateBatchConfig call signature**

The orchestrator calls `updateBatchConfig` on-chain. Update to include `tickDuration` parameter:

```rust
// When building the on-chain call:
let call = vision.update_batch_config(
    batch_id,
    config_hash,
    lock_offset,     // 0
    tick_duration,   // NEW: from recommended config
    bls_signature,
    reference_nonce,
    signers_bitmask,
);
```

Also update the BLS message hash to match the new contract domain:

```rust
let message = ethers::abi::encode(&[
    Token::Uint(chain_id.into()),
    Token::Address(vision_address),
    Token::String("UPDATE_BATCH_CONFIG".into()),
    Token::Uint(batch_id.into()),
    Token::FixedBytes(config_hash.as_bytes().to_vec()),
    Token::Uint(lock_offset.into()),
    Token::Uint(tick_duration.into()),  // NEW
]);
```

- [ ] **Step 4: Run tests**

Run: `cd issuer && cargo test orchestrator -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add issuer/src/vision/batch_config_orchestrator.rs
git commit -m "feat(issuer): batch auto-creation with rate limit, tightened follower verification"
```

---

## Chunk 6: Frontend — Remove Static Dependencies

### Task 16: Remove vision-batches.json from API proxy route

**Files:**
- Modify: `frontend/app/api/vision/batches/route.ts`

**Context:** This route builds a `configHashToSource` reverse map from vision-batches.json. Instead, the issuer API response should include sourceId directly.

- [ ] **Step 1: Remove static import and build reverse map from API response**

```typescript
// DELETE: import batchConfig from '@/lib/contracts/vision-batches.json'

export async function GET() {
  const res = await fetch(`${ISSUER_API_URL}/vision/batches`)
  const data = await res.json()

  // Issuer API now includes source_id per batch — no reverse lookup needed
  // Deduplicate: keep latest batch per source
  const latestPerSource = new Map<string, any>()
  for (const batch of data.batches) {
    const existing = latestPerSource.get(batch.source_id)
    if (!existing || batch.batch_id > existing.batch_id) {
      latestPerSource.set(batch.source_id, batch)
    }
  }

  return Response.json({ batches: Array.from(latestPerSource.values()) })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/api/vision/batches/route.ts
git commit -m "feat(frontend): remove vision-batches.json from API proxy, use issuer source_id"
```

---

### Task 17: Remove vision-batches.json from tick.ts

**Files:**
- Modify: `frontend/lib/vision/tick.ts`

- [ ] **Step 1: Remove static imports and getAllBatches()**

Remove `import batchConfig from '@/lib/contracts/vision-batches.json'`.
Remove `getAllBatches()` function.
Remove `getMultiplier()` function.
Remove `LOCK_OFFSET` constant.
Keep `getBatchTickState()` but remove lockOffset parameter — always 0.

```typescript
export function getBatchTickState(tickDuration: number, createdAtTick?: number) {
  const now = Math.floor(Date.now() / 1000)
  const elapsed = now % tickDuration
  const remaining = tickDuration - elapsed
  return { elapsed, remaining, tickDuration }
  // No isLocked, no lockOffset
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/vision/tick.ts
git commit -m "feat(frontend): remove multiplier/lock/static-batch from tick.ts"
```

---

### Task 18: Remove static fallbacks from BatchEntryPanel, SourceDetail, MarketsTable

**Files:**
- Modify: `frontend/components/domain/vision/detail/BatchEntryPanel.tsx`
- Modify: `frontend/components/domain/vision/detail/SourceDetail.tsx`
- Modify: `frontend/components/domain/vision/detail/MarketsTable.tsx`

- [ ] **Step 1: Remove all `import batchConfig` lines**

In each file, remove:
```typescript
// DELETE: import batchConfig from '@/lib/contracts/vision-batches.json'
```

- [ ] **Step 2: Remove static fallback logic from BatchEntryPanel**

Remove `staticEntry` lookup and fallback batch construction (lines 57-85). If API returns no batch, show "No active batch" message.

Remove multiplier display: delete `getMultiplier()` calls and multiplier UI elements.

Remove lock state warnings and "LOCKED" disabled state.

- [ ] **Step 3: Remove static fallback from SourceDetail**

Same pattern: remove `staticEntry` lookup, remove multiplier column from batch status bar, remove lock styling.

- [ ] **Step 4: Remove static configHash lookup from MarketsTable**

Switch from `batchConfig.batches[key].configHash` to live batch data from `useBatches()` or `useSignedBatches()`.

- [ ] **Step 5: Fix compilation**

Run: `cd frontend && pnpm build 2>&1 | head -50`
Fix remaining references.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/domain/vision/detail/
git commit -m "feat(frontend): remove static batch fallbacks and multiplier from detail components"
```

---

### Task 19: Delete hardcoded source registries

**Files:**
- Delete contents of: `frontend/lib/vision/sources.ts` (keep file, export empty/hooks)
- Delete contents of: `frontend/lib/vision/source-categories.ts`
- Delete contents of: `frontend/lib/vision/market-categories.ts`
- Modify: `frontend/components/domain/vision/VisionMarketsGrid.tsx` — remove CATEGORY_GROUPS

- [ ] **Step 1: Replace sources.ts with re-exports from hook**

Replace the 272-line file with a thin compatibility layer that imports from the new hook:

```typescript
// All source metadata now comes from data-node API via useSourceRegistry() hook.
// This file kept for backward compatibility during migration.
// Functions that need source data should use useSourceRegistry() directly.

export type SourceCategory = string
export interface VisionSource {
  id: string
  name: string
  description: string
  category: string
  logo: string
  brandBg: string
  prefixes: string[]
  valueLabel: string
  valueUnit: string
  isPrice: boolean
}

// Empty — all data comes from API now
export const VISION_SOURCES: VisionSource[] = []
```

- [ ] **Step 2: Gut source-categories.ts and market-categories.ts**

Replace with API-driven equivalents:

```typescript
// source-categories.ts
export function getSourcesByCategory(sources: VisionSource[], category: string) {
  return sources.filter(s => s.category === category)
}
```

```typescript
// market-categories.ts
export function getCategory(marketId: string, prefixes: Map<string, string>): string {
  for (const [prefix, category] of prefixes) {
    if (marketId.startsWith(prefix)) return category
  }
  return 'other'
}

export function formatMarketName(marketId: string, prefixes: string[]): string {
  for (const prefix of prefixes) {
    if (marketId.startsWith(prefix)) return marketId.slice(prefix.length)
  }
  return marketId
}
```

- [ ] **Step 3: Remove CATEGORY_GROUPS from VisionMarketsGrid**

Delete the hardcoded 14-group array and `SOURCE_DISPLAY_OVERRIDES`, `COUNT_SOURCES`. The grid will derive categories from the source registry API.

- [ ] **Step 4: Fix compilation**

Run: `cd frontend && pnpm build 2>&1 | head -50`

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/vision/ frontend/components/domain/vision/VisionMarketsGrid.tsx
git commit -m "feat(frontend): remove hardcoded VISION_SOURCES, CATEGORY_GROUPS, PREFIX_MAP"
```

---

## Chunk 7: Frontend — Dynamic Source Registry + Continuous UX

### Task 20: useSourceRegistry hook + proxy route

**Files:**
- Create: `frontend/hooks/vision/useSourceRegistry.ts`
- Create: `frontend/app/api/vision/sources/route.ts`

- [ ] **Step 1: Create proxy route**

```typescript
// frontend/app/api/vision/sources/route.ts
import { DATA_NODE_URL } from '@/lib/config'

export async function GET() {
  try {
    const res = await fetch(`${DATA_NODE_URL}/sources/registry`, { next: { revalidate: 300 } })
    if (!res.ok) return Response.json({ sources: [], categories: [] }, { status: 502 })
    const data = await res.json()
    return Response.json(data)
  } catch {
    return Response.json({ sources: [], categories: [] }, { status: 502 })
  }
}
```

- [ ] **Step 2: Create useSourceRegistry hook**

```typescript
// frontend/hooks/vision/useSourceRegistry.ts
'use client'

import useSWR from 'swr'

interface SourceDisplay {
  sourceId: string
  name: string
  description: string
  category: string
  logo: string
  brandBg: string
  prefixes: string[]
  valueLabel: string
  valueUnit: string
  isPrice: boolean
}

interface CategoryDisplay {
  key: string
  label: string
  order: number
}

interface SourceRegistry {
  sources: SourceDisplay[]
  categories: CategoryDisplay[]
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useSourceRegistry(): SourceRegistry & { isLoading: boolean } {
  const { data, isLoading } = useSWR<SourceRegistry>('/api/vision/sources', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000, // 5 min
    fallbackData: { sources: [], categories: [] },
  })

  return {
    sources: data?.sources ?? [],
    categories: data?.categories ?? [],
    isLoading,
  }
}

// Helper: find source by ID
export function findSource(sources: SourceDisplay[], sourceId: string) {
  return sources.find(s => s.sourceId === sourceId)
}

// Helper: get category for a market ID using source prefixes
export function getCategoryForMarket(sources: SourceDisplay[], marketId: string): string {
  for (const source of sources) {
    for (const prefix of source.prefixes) {
      if (marketId.startsWith(prefix)) return source.category
    }
  }
  return 'other'
}

// Helper: format market name by stripping known prefix
export function formatMarketDisplay(sources: SourceDisplay[], marketId: string): string {
  for (const source of sources) {
    for (const prefix of source.prefixes) {
      if (marketId.startsWith(prefix)) {
        return marketId.slice(prefix.length).replace(/_/g, ' ')
      }
    }
  }
  return marketId.replace(/_/g, ' ')
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/hooks/vision/useSourceRegistry.ts frontend/app/api/vision/sources/route.ts
git commit -m "feat(frontend): useSourceRegistry hook + proxy for dynamic source metadata"
```

---

### Task 21: Update VisionMarketsGrid to use dynamic registry

**Files:**
- Modify: `frontend/components/domain/vision/VisionMarketsGrid.tsx`

- [ ] **Step 1: Replace hardcoded categories with hook data**

```typescript
import { useSourceRegistry, getCategoryForMarket, formatMarketDisplay } from '@/hooks/vision/useSourceRegistry'

// Inside component:
const { sources, categories, isLoading } = useSourceRegistry()

// Build category groups dynamically from API data
const categoryGroups = useMemo(() => {
  return categories
    .sort((a, b) => a.order - b.order)
    .map(cat => ({
      key: cat.key,
      label: cat.label,
      sources: sources.filter(s => s.category === cat.key),
    }))
    .filter(g => g.sources.length > 0)
}, [sources, categories])
```

- [ ] **Step 2: Update source display to use API metadata**

Replace all `getSource(sourceId)` calls with `findSource(sources, sourceId)`.
Replace `getCategory(marketId)` with `getCategoryForMarket(sources, marketId)`.
Replace `formatMarketName(marketId)` with `formatMarketDisplay(sources, marketId)`.

- [ ] **Step 3: Fix compilation and verify**

Run: `cd frontend && pnpm build`
Expected: Compiles clean

- [ ] **Step 4: Commit**

```bash
git add frontend/components/domain/vision/VisionMarketsGrid.tsx
git commit -m "feat(frontend): VisionMarketsGrid uses dynamic source registry from API"
```

---

### Task 22: Continuous betting UX — BatchEntryPanel + SourceDetail

**Files:**
- Modify: `frontend/components/domain/vision/detail/BatchEntryPanel.tsx`
- Modify: `frontend/components/domain/vision/detail/SourceDetail.tsx`

- [ ] **Step 1: Update BatchEntryPanel for continuous betting**

- Always open (no locked/disabled state)
- Header: "Set predictions for next tick"
- Add config freshness check before submit:

```typescript
// Before calling updateBitmap():
const freshConfig = await fetch('/api/vision/batches').then(r => r.json())
const freshBatch = freshConfig.batches.find(b => b.source_id === sourceId)
if (freshBatch && freshBatch.config_hash !== currentConfigHash) {
  // Config changed — re-encode bitmap with new config
  toast.warning('Config updated — re-encoding your predictions')
  // Re-fetch market list, re-encode bitmap, then submit
  return
}
```

- After submit: "Your bets are set for tick N+1"
- Show: "You have active bets on tick N" when active bitmap exists
- Show: "No bets set — sitting out this tick" when no active bitmap

- [ ] **Step 2: Update SourceDetail**

- Remove MULTIPLIER column from batch bar
- Remove lock styling (red timer, "LOCKED" text)
- Timer is just countdown, no lock phase
- Add "ACTIVE BETTORS" count (from API)

- [ ] **Step 3: Commit**

```bash
git add frontend/components/domain/vision/detail/
git commit -m "feat(frontend): continuous betting UX — always-open panel, no multiplier, config freshness check"
```

---

### Task 23: Update remaining components + cleanup

**Files:**
- Modify: `frontend/components/domain/vision/sources/NextBatches.tsx` — remove lockOffset prop
- Modify: `frontend/hooks/vision/useSignedBatches.ts` — remove lockOffset references
- Modify: `frontend/components/domain/vision/ExpandedBatch.tsx` — remove static imports if any
- Modify: `frontend/e2e/helpers/vision-api.ts` — remove static file scanning
- Clean up any remaining imports of deleted functions

- [ ] **Step 1: Clean up all remaining references**

Use grep to find remaining references:
```bash
cd frontend && grep -r "vision-batches" --include="*.ts" --include="*.tsx" -l
cd frontend && grep -r "getMultiplier\|lockOffset\|VISION_SOURCES\|CATEGORY_GROUPS\|PREFIX_MAP" --include="*.ts" --include="*.tsx" -l
```

Fix each file.

- [ ] **Step 2: Build verification**

Run: `cd frontend && pnpm build`
Expected: Compiles clean with no references to deleted code

- [ ] **Step 3: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): clean up all remaining static source/multiplier/lock references"
```

---

## Chunk 8: Migration + Deployment

### Task 24: Create migration script

**Files:**
- Create: `contracts/script/MigrateContinuousBetting.s.sol`

**Context:** Push `lockOffset=0` + `tickDuration` for all existing batches via BLS-signed `updateBatchConfig()` calls. Set `activation_tick_id` per batch.

- [ ] **Step 1: Write migration script**

```solidity
contract MigrateContinuousBetting is Script {
    function run() external {
        Vision vision = Vision(vm.envAddress("VISION_ADDRESS"));
        uint256 referenceNonce = IIssuerRegistry(vision.blsIssuerRegistry()).lastSnapshotNonce();

        // For each batch, push lockOffset=0 with current tickDuration
        string memory json = vm.readFile("frontend/lib/contracts/vision-batches.json");
        string[] memory sources = vm.parseJsonKeys(json, ".batches");

        for (uint256 i = 0; i < sources.length; i++) {
            string memory key = string.concat(".batches.", sources[i]);
            uint256 batchId = vm.parseJsonUint(json, string.concat(key, ".batchId"));
            bytes32 configHash = vm.parseJsonBytes32(json, string.concat(key, ".configHash"));
            uint256 tickDuration = vm.parseJsonUint(json, string.concat(key, ".tickDuration"));

            // BLS sign: UPDATE_BATCH_CONFIG with lockOffset=0
            bytes32 messageHash = keccak256(abi.encode(
                block.chainid, address(vision), "UPDATE_BATCH_CONFIG",
                batchId, configHash, uint256(0), tickDuration
            ));
            bytes memory sig = vm.ffi(_blsSign(messageHash));

            vision.updateBatchConfig(batchId, configHash, 0, tickDuration, sig, referenceNonce + i, 7);
        }
    }
}
```

- [ ] **Step 2: Test on local Anvil**

Run: `cd contracts && forge script script/MigrateContinuousBetting.s.sol --fork-url http://localhost:8545 --broadcast`
Expected: All 43 batches updated, no reverts

- [ ] **Step 3: Commit**

```bash
git add contracts/script/MigrateContinuousBetting.s.sol
git commit -m "feat(contracts): migration script for lockOffset=0 on all batches"
```

---

### Task 25: Deploy sequence

**No code changes — operational steps:**

- [ ] **Step 1: Deploy contract changes** (tickDuration param + MAX_BATCHES)
- [ ] **Step 2: Deploy data-node changes** (lock removal, /sources/registry, integer prices)
- [ ] **Step 3: Deploy ALL issuer instances simultaneously** (stop all 3, deploy new code, start all 3)
- [ ] **Step 4: Run migration script** (push lockOffset=0 for all batches)
- [ ] **Step 5: Deploy frontend** (`cd frontend && vercel --prod`)
- [ ] **Step 6: Verify** — check Vision source pages load, no multiplier shown, bets work, tick resolution succeeds

---

## Summary

| Chunk | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-2 | Contract: tickDuration param, MAX_BATCHES cap |
| 2 | 3-6 | Data-node: lock removal, source registry, integer prices, BLS verification |
| 3 | 7-8 | Issuer: two-slot bitmap model + DB schema |
| 4 | 9-13 | Issuer: resolver/engine (multiplier removal, flat indexing, bitmap flip, fixed-point prices) |
| 5 | 14-15 | Issuer: orchestrator (lock removal, auto-creation, tolerances) |
| 6 | 16-19 | Frontend: remove static deps (vision-batches.json, VISION_SOURCES, CATEGORY_GROUPS) |
| 7 | 20-23 | Frontend: dynamic registry + continuous betting UX |
| 8 | 24-25 | Migration script + deploy sequence |
