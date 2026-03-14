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

function test_promoteConfig_recomputesLastPromotionTick() public {
    // Create batch with tickDuration=600
    uint256 batchId = _createTestBatch(600, 0);

    // Update config with tickDuration=300
    bytes32 newConfigHash = keccak256("new-config");
    bytes memory blsSig = _signUpdateConfig(batchId, newConfigHash, 0, 300);
    vision.updateBatchConfig(batchId, newConfigHash, 0, 300, blsSig, _nextNonce(), 7);

    // Advance 601s to trigger promotion
    vm.warp(block.timestamp + 601);
    // Any call that triggers _promoteConfigIfNeeded
    vision.updateBatchConfig(batchId, newConfigHash, 0, 300, blsSig, _nextNonce(), 7);

    // After promotion, lastPromotionTick should be block.timestamp / 300 (NEW duration)
    // NOT block.timestamp / 600 (OLD duration)
    (,,,,, uint256 lastPromotionTick,) = vision.getBatchInfo(batchId);
    assertEq(lastPromotionTick, block.timestamp / 300);
}
```

Run: `cd contracts && forge test --match-test test_updateBatchConfig_changesTickDuration -vvv`
Run: `cd contracts && forge test --match-test test_promoteConfig_recomputesLastPromotionTick -vvv`
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

    if (tickDuration == 0 || tickDuration > MAX_TICK_DURATION) revert InvalidTickDuration();
    if (lockOffset >= tickDuration && lockOffset != 0) revert LockOffsetTooLarge();

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
        // CRITICAL FIX: recompute lastPromotionTick with NEW tickDuration
        // If we stored currentTick (computed with old tickDuration), the next
        // check `block.timestamp / newTickDuration` would produce a different
        // tick number — causing instant re-promotion or permanent freeze.
        b.lastPromotionTick = block.timestamp / b.tickDuration;
        b.nextConfigHash = bytes32(0);
        b.nextLockOffset = 0;
        b.nextTickDuration = 0;
        emit BatchConfigPromoted(batchId, oldHash, b.configHash, b.lastPromotionTick);
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
// SECURITY FIX: Single RwLock wrapping both maps to prevent deadlock.
// Two separate RwLocks can deadlock if flip() holds one lock while another
// method holds the other and both try to acquire the second.
struct BitmapSlots {
    pending: HashMap<(u64, Address), SlottedBitmap>,
    active: HashMap<(u64, Address), SlottedBitmap>,
}

pub struct BitmapStore {
    slots: RwLock<BitmapSlots>,
}

impl BitmapStore {
    pub fn new() -> Self {
        Self {
            slots: RwLock::new(BitmapSlots {
                pending: HashMap::new(),
                active: HashMap::new(),
            }),
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
        self.slots.write().await.pending.insert((batch_id, player), entry);
        Ok(())
    }

    pub async fn get_active(&self, batch_id: u64, player: Address) -> Option<SlottedBitmap> {
        self.slots.read().await.active.get(&(batch_id, player)).cloned()
    }

    pub async fn get_pending(&self, batch_id: u64, player: Address) -> Option<SlottedBitmap> {
        self.slots.read().await.pending.get(&(batch_id, player)).cloned()
    }

    pub async fn get_all_active_for_batch(&self, batch_id: u64) -> Vec<SlottedBitmap> {
        self.slots.read().await.active.iter()
            .filter(|((bid, _), _)| *bid == batch_id)
            .map(|(_, v)| v.clone())
            .collect()
    }

    pub async fn flip(&self, batch_id: u64) {
        let mut slots = self.slots.write().await;

        // Remove old active for this batch
        slots.active.retain(|(bid, _), _| *bid != batch_id);

        // Move pending → active for this batch
        let to_move: Vec<_> = slots.pending.iter()
            .filter(|((bid, _), _)| *bid == batch_id)
            .map(|(k, v)| (*k, v.clone()))
            .collect();

        for (key, val) in to_move {
            slots.pending.remove(&key);
            slots.active.insert(key, val);
        }
    }

    /// Clean up stale active bitmaps whose target_tick_id < current_tick_id.
    /// Call before flip to prevent unbounded growth.
    pub async fn cleanup_stale(&self, batch_id: u64, current_tick_id: u64) {
        let mut slots = self.slots.write().await;
        slots.active.retain(|(bid, _), bm| {
            *bid != batch_id || bm.target_tick_id >= current_tick_id
        });
    }

    pub async fn remove(&self, batch_id: u64, player: Address) {
        let mut slots = self.slots.write().await;
        slots.pending.remove(&(batch_id, player));
        slots.active.remove(&(batch_id, player));
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
pub async fn persist_pending_to_db(&self, pool: &PgPool, batch_id: u64, player: Address, bitmap: &SlottedBitmap) -> Result<(), sqlx::Error> {
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
    .execute(pool).await?;
    Ok(())
}

/// SECURITY FIX: Use a transaction for atomic flip. The DELETE+UPDATE must
/// succeed together or not at all. Without a transaction, a crash between
/// DELETE and UPDATE loses all bitmaps. Also propagate errors instead of
/// swallowing with .ok().
pub async fn persist_flip_to_db(&self, pool: &PgPool, batch_id: u64) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM vision_bitmaps WHERE batch_id = $1 AND slot = 'active'")
        .bind(batch_id as i64).execute(&mut *tx).await?;
    sqlx::query("UPDATE vision_bitmaps SET slot = 'active' WHERE batch_id = $1 AND slot = 'pending'")
        .bind(batch_id as i64).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
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

- [ ] **Step 3: Implement ConfigCache for config_hash → market list lookup**

The resolver needs to decode bitmaps using the config they were encoded against, not the batch's current config. Create a cache:

```rust
// New file: issuer/src/vision/config_cache.rs
use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct ConfigCache {
    cache: RwLock<HashMap<H256, Vec<MarketConfig>>>,
    data_node_url: String,
}

impl ConfigCache {
    pub fn new(data_node_url: String) -> Self {
        Self { cache: RwLock::new(HashMap::new()), data_node_url }
    }

    pub async fn get_or_fetch(&self, config_hash: &H256) -> Result<Vec<MarketConfig>> {
        if let Some(configs) = self.cache.read().await.get(config_hash) {
            return Ok(configs.clone());
        }
        let url = format!("{}/batches/config/{:?}", self.data_node_url, config_hash);
        let resp = reqwest::get(&url).await?.json::<Vec<MarketConfig>>().await?;
        self.cache.write().await.insert(*config_hash, resp.clone());
        Ok(resp)
    }

    /// Insert known config (e.g. from signed batch responses)
    pub async fn insert(&self, config_hash: H256, configs: Vec<MarketConfig>) {
        self.cache.write().await.insert(config_hash, configs);
    }
}
```

Wire into AppState and pass to resolver. Add `pub mod config_cache;` to `mod.rs`.

- [ ] **Step 4: Use bitmap's config_hash for market lookup**

In `resolve_tick()`, change bitmap fetching to use the active slot and decode with the bitmap's own config:

```rust
// Fetch active bitmaps (not all bitmaps)
let active_bitmaps = self.bitmap_store.get_all_active_for_batch(batch.id).await;

// For each active bitmap, look up the market configs it was encoded against
for ab in &active_bitmaps {
    let bitmap_market_configs = self.config_cache.get_or_fetch(&ab.config_hash).await?;
    // Decode using bitmap_market_configs, not the batch's current market_configs
    // This ensures players who bet on config X are scored against config X's markets
}
```

- [ ] **Step 5: Run tests**

Run: `cd issuer && cargo test resolver -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add issuer/src/vision/resolver.rs issuer/src/vision/config_cache.rs issuer/src/vision/mod.rs
git commit -m "feat(issuer): flat bitmap indexing, config cache, config_hash-aware decoding"
```

---

### Task 11: Bitmap flip in engine + remove degraded mode

**Files:**
- Modify: `issuer/src/vision/engine.rs:1265-1460`

- [ ] **Step 1: Add bitmap flip after resolution in engine**

In the resolution loop, add bitmap flip AFTER consensus completes successfully (not after `create_proposal()` — consensus involves all 3 issuers signing):

```rust
// CRITICAL: Flip happens AFTER consensus.wait_for_completion() succeeds.
// If we flip after create_proposal() but before consensus completes,
// and consensus fails, the bitmaps are lost — players who submitted
// predictions would be silently dropped from the next tick.

// Step 1: Compute bitmap_set_hash (see Step 3 below)
// Step 2: Create proposal
let proposal = tc.create_proposal(&result, bitmap_set_hash).await?;
// Step 3: Wait for BLS consensus (all issuers sign)
let consensus_result = proposal.wait_for_completion().await?;
// Step 4: Submit on-chain
submit_tick_resolution(consensus_result).await?;
// Step 5: NOW flip bitmaps — consensus succeeded, on-chain tx submitted
bitmap_store.cleanup_stale(batch_id, current_tick_id).await;
bitmap_store.flip(batch_id).await;
bitmap_store.persist_flip_to_db(&db_pool, batch_id).await?;
// If persist_flip_to_db fails, log critical error but don't panic —
// in-memory state is correct, DB will be inconsistent until restart
// which triggers load_from_db recovery.

// Config promotion is handled by chain listener via BatchConfigPromoted event
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

Also update the BLS message hash to match the new contract domain. Solidity `abi.encode` treats string literals as **dynamic `string` types** (offset pointer + length prefix + padded data), NOT as `bytes32`. Use `Token::String(...)` to match — this is the pattern used everywhere in the existing codebase (see `tick_consensus.rs:52`, `engine.rs:588`, `deposit_watcher.rs:1331`):

```rust
let message = ethers::abi::encode(&[
    Token::Uint(chain_id.into()),
    Token::Address(vision_address),
    Token::String("UPDATE_BATCH_CONFIG".to_string()),  // dynamic string, matches abi.encode
    Token::Uint(batch_id.into()),
    Token::FixedBytes(config_hash.as_bytes().to_vec()),
    Token::Uint(lock_offset.into()),
    Token::Uint(tick_duration.into()),  // NEW
]);
```

**WARNING:** Do NOT use `Token::FixedBytes(keccak256("UPDATE_BATCH_CONFIG"))` — this produces completely different bytes than what the Solidity contract computes and would break BLS verification on every call.

**Verification:** Write a cross-language test: compute message hash in Rust, compare to Solidity output from a forge test. BLS messages MUST match byte-for-byte.

- [ ] **Step 4: Run tests**

Run: `cd issuer && cargo test orchestrator -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add issuer/src/vision/batch_config_orchestrator.rs
git commit -m "feat(issuer): batch auto-creation with rate limit, tightened follower verification"
```

---

### Task 16: Activation tick dual-mode mechanism

**Files:**
- Modify: `issuer/src/vision/engine.rs`
- Modify: `issuer/src/vision/types.rs`

**Context:** During migration, not all issuers update simultaneously. An `activation_tick_id` ensures the new bitmap model only activates after a coordinated tick boundary, preventing mixed old/new code consensus failures.

- [ ] **Step 1: Add activation_tick_id to batch config**

```rust
// In types.rs, add to BatchConfig or a new MigrationConfig:
pub struct BatchMigration {
    /// Tick ID at which new bitmap model activates. 0 = not yet set.
    pub activation_tick_id: u64,
}
```

- [ ] **Step 2: Add dual-mode resolution in engine**

```rust
// In engine.rs resolution loop:
let current_tick_id = compute_tick_id(batch.tick_duration);

if current_tick_id < batch.activation_tick_id {
    // OLD MODE: Use legacy single-bitmap resolution
    // This keeps consensus working with old-code issuers
    resolve_tick_legacy(batch, current_tick_id, &players, &prices).await?;
} else {
    // NEW MODE: Two-slot bitmap resolution
    let active_bitmaps = bitmap_store.get_all_active_for_batch(batch.id).await;
    resolve_tick_continuous(batch, current_tick_id, &active_bitmaps, &prices).await?;
}
```

- [ ] **Step 3: Set activation_tick_id via BLS consensus**

Add a new BLS-signed message type `SET_ACTIVATION_TICK` that all issuers must agree on:

```rust
// Leader proposes activation after confirming all issuers are on new code:
// 1. Leader pings all issuers for version (existing P2P health check)
// 2. If all 3 report new version, propose activation_tick_id = current_tick + 2
// 3. BLS-sign and store activation_tick_id per batch
```

- [ ] **Step 4: Run tests**

Run: `cd issuer && cargo test activation -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add issuer/src/vision/engine.rs issuer/src/vision/types.rs
git commit -m "feat(issuer): activation_tick_id dual-mode for safe migration"
```

---

### Task 17: Cross-issuer bitmap gossip

**Files:**
- Modify: `issuer/src/vision/engine.rs`
- Modify: `issuer/src/p2p/` (message types)

**Context:** If a player reveals their bitmap to only one issuer, the other two won't have it for consensus. Cross-issuer gossip ensures bitmap availability. This is a security requirement from the spec.

- [ ] **Step 1: Add bitmap gossip P2P message**

```rust
// New P2P message type:
pub enum VisionP2PMessage {
    // ... existing variants ...
    BitmapGossip {
        batch_id: u64,
        player: Address,
        bitmap_hash: H256,  // Don't gossip raw bitmap — just the hash
        config_hash: H256,
        target_tick_id: u64,
    },
}
```

- [ ] **Step 2: Gossip on bitmap receipt**

When an issuer receives a bitmap reveal from a player, gossip the hash to other issuers:

```rust
// In bitmap reveal handler:
bitmap_store.store_pending(player, batch_id, bitmap, hash, config_hash, tick_id).await?;
bitmap_store.persist_pending_to_db(&db_pool, batch_id, player, &entry).await?;

// Gossip to other issuers (hash only, not raw bitmap)
p2p.broadcast(VisionP2PMessage::BitmapGossip {
    batch_id,
    player,
    bitmap_hash: hash,
    config_hash,
    target_tick_id: tick_id,
}).await;
```

- [ ] **Step 3: Handle gossip receipt**

```rust
// When receiving gossip, if we don't have this bitmap, request it from the sender:
VisionP2PMessage::BitmapGossip { batch_id, player, bitmap_hash, .. } => {
    if bitmap_store.get_pending(batch_id, player).await.is_none() {
        // Request full bitmap from sender
        p2p.request_bitmap(sender_id, batch_id, player, bitmap_hash).await;
    }
}
```

- [ ] **Step 4: Add resolution_type exact match in follower verification**

When a follower verifies a leader's tick resolution proposal, verify that the `resolution_type` (legacy vs continuous) matches what the follower would compute:

```rust
// In follower verification:
let expected_resolution_type = if current_tick_id < batch.activation_tick_id {
    ResolutionType::Legacy
} else {
    ResolutionType::Continuous
};
if proposal.resolution_type != expected_resolution_type {
    return Err(anyhow!("Resolution type mismatch: leader={:?}, follower={:?}",
        proposal.resolution_type, expected_resolution_type));
}
```

- [ ] **Step 5: Run tests**

Run: `cd issuer && cargo test gossip -v && cargo test follower_verification -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add issuer/src/vision/ issuer/src/p2p/
git commit -m "feat(issuer): cross-issuer bitmap gossip + resolution_type verification"
```

---

## Chunk 6: Frontend — Remove Static Dependencies

### Task 18: Remove vision-batches.json from API proxy route

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

### Task 19: Remove vision-batches.json from tick.ts

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

### Task 20: Remove static fallbacks from BatchEntryPanel, SourceDetail, MarketsTable

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

### Task 21: Delete hardcoded source registries

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

### Task 22: useSourceRegistry hook + proxy route

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

### Task 23: Update VisionMarketsGrid to use dynamic registry

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

### Task 24: Continuous betting UX — BatchEntryPanel + SourceDetail

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

### Task 25: Update remaining components + cleanup

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

### Task 26: Create migration script

**Files:**
- Create: `contracts/script/MigrateContinuousBetting.s.sol`

**Context:** Push `lockOffset=0` + `tickDuration` for all existing batches. BLS signing must happen through the issuer consensus flow, NOT via Foundry FFI (which has no access to BLS keys and `vm.ffi(_blsSign())` is undefined).

**Migration strategy:** Issuer-driven, not script-driven. The issuers already have the BLS signing pipeline. We add a one-shot migration mode that pushes `lockOffset=0` for all existing batches through the normal BLS consensus flow.

- [ ] **Step 1: Add migration mode to issuer orchestrator**

```rust
// In batch_config_orchestrator.rs, add migration function:
pub async fn run_migration_round(&mut self) -> Result<()> {
    let batches = self.scheduler.get_all_batches().await;

    for batch in &batches {
        // Skip batches already at lockOffset=0
        if batch.lock_offset == 0 {
            continue;
        }

        // Push same configHash but with lockOffset=0 and current tickDuration
        let message_hash = compute_update_config_hash(
            self.chain_id,
            self.vision_address,
            batch.id,
            batch.config_hash,
            0, // lockOffset = 0
            batch.tick_duration,
        );

        // This goes through normal BLS consensus — all 3 issuers sign
        self.propose_config_update(batch.id, batch.config_hash, 0, batch.tick_duration, message_hash).await?;

        // Rate limit: 1 per 5 seconds to avoid nonce contention
        tokio::time::sleep(Duration::from_secs(5)).await;
    }

    tracing::info!("Migration complete: all batches set to lockOffset=0");
    Ok(())
}
```

- [ ] **Step 2: Add CLI flag to trigger migration**

```rust
// In main.rs or config:
if config.run_migration {
    orchestrator.run_migration_round().await?;
    // Continue normal operation after migration
}
```

- [ ] **Step 3: Test on local Anvil**

Deploy issuers with `--run-migration` flag. Verify all 43 batches get `lockOffset=0` pushed through BLS consensus.

Run: SSH to VPS, start issuer with migration flag, check logs for "Migration complete"

- [ ] **Step 4: Commit**

```bash
git add issuer/src/vision/batch_config_orchestrator.rs issuer/src/main.rs
git commit -m "feat(issuer): BLS-driven migration for lockOffset=0 on all batches"
```

---

### Task 27: Deploy sequence

**No code changes — operational steps. CRITICAL: deploy ordering matters.**

The contract's new `updateBatchConfig()` requires a `tickDuration` parameter. Old issuers don't send it. If we deploy the contract first, issuers can't push config updates until they're also updated. Deploy issuers first — they can tolerate the old contract (just pass tickDuration=0 which gets ignored by old contract).

- [ ] **Step 1: Deploy data-node changes** (lock removal, /sources/registry, integer prices, BLS verification)

Data-node changes are backward compatible — old issuers can still read responses (they ignore `value_scaled` field).

- [ ] **Step 2: Deploy ALL issuer instances simultaneously** (stop all 3, deploy new code with `activation_tick_id=0` / migration mode disabled, start all 3)

New issuers with `activation_tick_id=0` run in legacy mode — they produce identical consensus as old issuers. Verify consensus still works.

- [ ] **Step 3: Deploy contract changes** (tickDuration param + MAX_BATCHES)

Now issuers can use the new `updateBatchConfig()` signature.

- [ ] **Step 4: Run issuer migration** (restart issuers with `--run-migration` flag)

Issuers push `lockOffset=0` for all 43 batches through BLS consensus. Verify on-chain.

- [ ] **Step 5: Activate new bitmap mode**

Leader proposes `activation_tick_id = current_tick + 2` via BLS consensus. All issuers switch to continuous mode at the agreed tick.

- [ ] **Step 6: Deploy frontend** (`cd frontend && vercel --prod`)

- [ ] **Step 7: Verify**
- Check Vision source pages load dynamically from `/sources/registry`
- No multiplier shown anywhere
- Bets work (submit prediction, wait for tick, see resolution)
- Tick resolution succeeds in continuous mode
- Check issuer logs for any BLS failures or bitmap mismatches

---

## Summary

| Chunk | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-2 | Contract: tickDuration param, MAX_BATCHES cap |
| 2 | 3-6 | Data-node: lock removal, source registry, integer prices, BLS verification |
| 3 | 7-8 | Issuer: two-slot bitmap model (single RwLock) + DB schema (atomic transactions) |
| 4 | 9-13 | Issuer: resolver/engine (multiplier removal, flat indexing, config cache, bitmap flip after consensus, fixed-point prices) |
| 5 | 14-17 | Issuer: orchestrator (lock removal, auto-creation, tolerances) + activation_tick_id + bitmap gossip |
| 6 | 18-21 | Frontend: remove static deps (vision-batches.json, VISION_SOURCES, CATEGORY_GROUPS) |
| 7 | 22-25 | Frontend: dynamic registry + continuous betting UX |
| 8 | 26-27 | Issuer-driven migration + deploy sequence (data-node → issuers → contract → activate → frontend) |
