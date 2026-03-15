# Consensus Protocol Deduplication Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate ~3,000 lines of copy-paste boilerplate in the oracle's BLS consensus handler code by extracting shared logic into a macro + helpers, while preserving exact security semantics.

**Architecture:** One declarative macro `bridge_proposal_handler!` generates each `handle_*_proposal()` method body, taking per-phase expressions for hash building, optional validation, and signing. A second macro `bridge_sign_handler!` generates each `handle_*_sign()` method body. A helper function `verify_leader_bls()` extracts the 25-line BLS verification block shared by ALL handlers. The macro supports all 4 current patterns via parameters.

**Tech Stack:** Rust declarative macros, async/await, BLS (BN254), ethers, tokio RwLock

**Security audit findings incorporated (Round 3 — 3-researcher consensus, 2 rounds):**

Round 1 fixes:
- C1-fix: Handlers #13 and #14 reclassified as Pattern AC (validate + direct BLS sign). Validation NOT dropped.
- C2-fix: Deleted incorrect H2 note about `H256::zero()`. Both handlers compute real hashes.
- C3-fix: Task 10 creates 3 separate signature collections (nav_sigs, nav_oracle_sigs, mirror_sync_sigs).
- H1-fix: Macro holds single read lock across validate+sign for Pattern A (matches original code).
- H2-fix: Macro invocations pass pre-computed `message_hash` into proposal structs instead of recomputing from fresh config.
- H3-fix: `complete_buy_order` added to Task 8 inline handler list.
- H4-fix: Pattern C macro arm skips unnecessary orch lock during sign step.
- H5-fix: `bridge_sign_handler!` logs `from` in debug statement (forensic visibility).
- H6-fix: Classification table shows full hash config for all handlers.

Round 2 fixes:
- C4-fix: Macro hygiene — `leader_id` and `leader_signature` moved into `params` list so they have call-site syntax context. `message_hash` bridged to call-site context via `$vmh`/`$smh` captured identifiers.
- C5-fix: `bridge_sign_handler!` — `signer_index` and `signature` bridged via `$si`/`$sig` captured identifiers.
- C6-fix: Task 10 explicitly enumerates ALL leader-side call sites (start_collection, check_threshold) that need migration.
- H7-fix: `from` included in sign handler debug log (avoids unused warning + preserves forensics).
- H8-fix: Macro doc clarifies hash guarantee is only for Pattern C/AC (direct BLS sign), not Pattern B (orch sign may recompute).

---

## Reference: Handler Classification

| # | Handler | Pattern | validate? | sign via | hash config |
|---|---------|---------|-----------|----------|-------------|
| 1 | bridge_settlement_to_l3 | A | yes | `orch.sign_bridge_proposal()` | `settlement_chain_id` |
| 2 | bridge_l3_to_settlement | A | yes | `orch.sign_bridge_l3_to_settlement_proposal()` | `l3_chain_id` |
| 3 | release_to_vault | A | yes | `orch.sign_release_proposal()` | `settlement_chain_id` + `oracle_custody_settlement` |
| 4 | submit_order | A | yes | `orch.sign_submit_order_proposal()` | `l3_chain_id` |
| 5 | confirm_batch | A | yes | `orch.sign_batch_proposal()` | `l3_chain_id` + `index_address` |
| 6 | confirm_fills | A | yes | `orch.sign_fills_proposal()` | `l3_chain_id` + `index_address` |
| 7 | submit_sell_order | A | yes | `orch.sign_submit_sell_order_proposal()` | `settlement_chain_id` |
| 8 | complete_sell_order | A | yes | `orch.sign_complete_sell_order_proposal()` | `settlement_chain_id` + `settlement_custody_address` |
| 9 | rebalance_batch | B | no | `orch.sign_rebalance_batch()` | `l3_chain_id` + `index_address` |
| 10 | update_weights | B | no | `orch.sign_update_weights()` | `l3_chain_id` + `index_address` |
| 11 | rebalance | C | no | `self.bls_signer.sign_message_hash()` | `l3_chain_id` + `index_address` |
| 12 | set_itp_nav | C | no | `self.bls_signer.sign_message_hash()` | `l3_chain_id` + `index_address` |
| 13 | record_collateral_move | AC | **yes** | `self.bls_signer.sign_message_hash()` | `l3_chain_id` + `collateral_registry` |
| 14 | mint_bridged_shares | AC | **yes** | `self.bls_signer.sign_message_hash()` | `settlement_chain_id` + `bridge_proxy` |
| — | nav_oracle | D | no | direct | message params (no orch) |
| — | mirror_sync | D | no | direct | message params (no orch) |
| — | asset_trades | inline | no | `orch.sign_asset_trades_proposal()` | inline in dispatch |
| — | complete_buy_order | inline | no | `self.bls_signer.sign_message_hash()` | inline in dispatch |

**Handlers 1-14**: macro-generated (4 macro arms). **nav_oracle, mirror_sync, asset_trades, complete_buy_order**: stay hand-written but get `verify_leader_bls()`.

**Pattern key:**
- **A**: validate + orch sign (single lock across validate+sign)
- **B**: no validate + orch sign
- **C**: no validate + direct BLS sign (no orch lock for sign step)
- **AC**: validate + direct BLS sign (lock for validate, no lock for sign)

---

## Macro Hygiene Design (Critical)

Rust `macro_rules!` hygiene: identifiers defined inside the macro body (e.g., `leader_id` as a function parameter, `message_hash` as a local `let`) have **macro syntax context** and are invisible to call-site expressions.

**Solution:**
1. `leader_id: PeerId` and `leader_signature: BLSSignature` are included in the `params = (...)` list at the call site, so they become `$pname` tokens with **call-site context**.
2. `message_hash` (computed inside the macro body) is bridged to call-site context via `$`-captured identifiers in the closure syntax: `validate = |$vorch, $vmh| ...` where the macro does `let $vmh = message_hash_internal;`.
3. In `bridge_sign_handler!`, `signer_index` and `signature` are bridged via `add_sig = |$orch, $si, $sig| ...`.

The function signature generated by the macro is:
```rust
pub async fn $fn_name(&self, from: PeerId, $($pname: $pty,)*) -> Result<(), Error>
```

So `leader_id` and `leader_signature` appear in their natural positions within `$pname`.

---

### Task 1: Extract `verify_leader_bls()` Helper

**Files:**
- Modify: `oracle/src/consensus/protocol.rs`

This helper replaces the 25-line BLS verification block that's identical in ALL 17+ handlers. We extract it first because it's zero-risk and immediately usable by both macro-generated and hand-written handlers.

**Step 1: Add the helper method**

Add this method to `impl ConsensusProtocol` (right after `handle_message` method, before the first `handle_*_proposal`):

```rust
/// Verify a leader's BLS signature on a pre-hashed message.
///
/// Returns Ok(()) if valid. Returns Err(BlsVerification) if:
/// - Leader not in key registry (unknown oracle)
/// - Signature invalid (tampered or wrong key)
/// - Verification failed (BLS error)
fn verify_leader_bls(
    &self,
    leader_id: &PeerId,
    message_hash: &H256,
    leader_signature: &BLSSignature,
    label: &str,
) -> Result<(), Error> {
    let leader_pubkey = self.key_registry.get_public_key(leader_id).ok_or_else(|| {
        warn!(
            code = "INFRA-007",
            ?leader_id,
            label,
            "Leader public key not found in registry, REJECTING proposal"
        );
        Error::BlsVerification(format!(
            "Leader {:?} not found in key registry -- refusing to sign {}",
            leader_id, label
        ))
    })?;

    let hash_bytes: [u8; 32] = (*message_hash).into();
    match self
        .bls_signer
        .verify_message_hash(&leader_pubkey, &hash_bytes, leader_signature)
    {
        Ok(true) => Ok(()),
        Ok(false) => {
            warn!(
                code = "INFRA-007",
                label,
                "Invalid leader signature on proposal"
            );
            Err(Error::BlsVerification(format!(
                "Invalid leader signature on {} proposal",
                label
            )))
        }
        Err(e) => {
            warn!(
                code = "INFRA-007",
                label,
                error = %e,
                "Failed to verify leader signature"
            );
            Err(e)
        }
    }
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check --manifest-path oracle/Cargo.toml 2>&1 | tail -5`
Expected: compiles (unused method warning OK)

**Step 3: Commit**

```bash
git add oracle/src/consensus/protocol.rs
git commit -m "refactor(oracle): extract verify_leader_bls() helper"
```

---

### Task 2: Write the `bridge_proposal_handler!` and `bridge_sign_handler!` Macros

**Files:**
- Create: `oracle/src/consensus/handler_macros.rs`
- Modify: `oracle/src/consensus/mod.rs`

**Step 1: Create the macro file**

The macro has 4 arms matching the 4 patterns. All call-site expressions receive variables through `$`-captured identifiers to satisfy Rust's macro hygiene rules.

```rust
//! Declarative macros for generating BLS consensus handler boilerplate.
//!
//! These macros generate the repeated pattern used by 14 bridge consensus phases:
//! get orchestrator → verify leader BLS → (optional) validate → sign → respond.
//!
//! Security invariants preserved by the macro:
//! - BLS verification failure → Err (hard reject, peer scoring)
//! - Validation failure → Ok(()) (silent skip, no signing)
//! - Signing failure → Err (propagated)
//! - For Patterns C/AC (direct BLS sign): hash used for signing is the SAME hash
//!   that was BLS-verified (no TOCTOU). For Patterns A/B (orch sign): the orch
//!   sign method may recompute hash from its own config (pre-existing behavior).
//! - Pattern A holds single read lock across validate+sign (matches original code)
//!
//! ## Macro Hygiene
//!
//! All identifiers that call-site expressions need to reference MUST be passed
//! through `$`-captured parameters (e.g., `$vorch`, `$vmh`, `$si`, `$sig`).
//! Variables defined inside the macro body (via `let` or as function params
//! without `$` capture) are invisible to call-site expressions due to Rust's
//! macro hygiene rules.
//!
//! `leader_id` and `leader_signature` are included in the `params` list at the
//! call site, giving them call-site syntax context.

/// Generate a `handle_*_proposal()` method for a BLS consensus phase (follower side).
///
/// # Hygiene
///
/// Call-site expressions in `hash`, `validate`, `sign`, `respond` can reference:
/// - Any identifier from `params` (call-site context via `$pname`)
/// - Captured closure variables (`$vorch`, `$vmh`, `$sorch`, `$smh`, etc.)
/// - `self` (special Rust hygiene — always accessible)
///
/// They CANNOT reference: `from`, `message_hash_internal`, or any other
/// identifier defined inside the macro body.
macro_rules! bridge_proposal_handler {
    // =========================================================
    // Pattern A: WITH validate, orch sign
    // Single read lock across validate+sign (TOCTOU-safe)
    // =========================================================
    (
        $fn_name:ident,
        label = $label:expr,
        params = ( $( $pname:ident : $pty:ty ),* $(,)? ),
        hash = |$cfg:ident| $hash_expr:expr,
        validate = |$vorch:ident, $vmh:ident| $validate_expr:expr,
        sign = |$sorch:ident, $smh:ident| $sign_expr:expr,
        respond = |$rself:ident, $rsig:ident| $respond_expr:expr $(,)?
    ) => {
        pub async fn $fn_name(
            &self,
            from: PeerId,
            $( $pname : $pty, )*
        ) -> Result<(), Error> {
            // Step 1: Get bridge orchestrator
            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            let bridge_orch = match bridge_orch_guard.as_ref() {
                Some(orch) => orch,
                None => {
                    warn!(code = "INFRA-007", concat!("BridgeOrchestrator not configured for ", $label));
                    return Ok(());
                }
            };

            // Step 2: Compute hash and verify leader BLS signature
            let message_hash_internal = {
                let $cfg = bridge_orch.read().await;
                let $cfg = $cfg.config();
                $hash_expr
            };
            self.verify_leader_bls(&leader_id, &message_hash_internal, &leader_signature, $label)?;

            // Step 3+4: Validate and sign under SINGLE read lock (TOCTOU-safe)
            // message_hash_internal was BLS-verified in step 2. Bridge to call-site context.
            let signature = {
                let orch_guard = bridge_orch.read().await;
                // Bridge hash to call-site context for validate expression
                let $vmh = message_hash_internal;
                let $vorch = &*orch_guard;
                match $validate_expr {
                    Ok(true) => {}
                    Ok(false) => {
                        warn!(code = "INFRA-007", concat!($label, " proposal validation failed"));
                        return Ok(());
                    }
                    Err(e) => {
                        warn!(code = "INFRA-007", error = %e, concat!($label, " proposal validation error"));
                        return Ok(());
                    }
                }
                // Bridge hash to call-site context for sign expression
                let $smh = message_hash_internal;
                let $sorch = &*orch_guard;
                match $sign_expr {
                    Ok(sig) => sig,
                    Err(e) => {
                        warn!(code = "INFRA-007", error = %e, concat!("Failed to sign ", $label, " proposal"));
                        return Err(Error::BlsVerification(format!(
                            "Failed to sign {} proposal: {}", $label, e
                        )));
                    }
                }
            };

            // Step 5: Release locks, send signature to leader
            drop(bridge_orch_guard);

            let $rself = self;
            let $rsig = signature;
            self.p2p.send_to(from, $respond_expr).await
        }
    };

    // =========================================================
    // Pattern B: WITHOUT validate, orch sign
    // NOTE: orch sign methods may recompute hash from their own config.
    // This is pre-existing behavior faithfully preserved.
    // =========================================================
    (
        $fn_name:ident,
        label = $label:expr,
        params = ( $( $pname:ident : $pty:ty ),* $(,)? ),
        hash = |$cfg:ident| $hash_expr:expr,
        sign = |$sorch:ident, $shash:ident| $sign_expr:expr,
        respond = |$rself:ident, $rsig:ident| $respond_expr:expr $(,)?
    ) => {
        pub async fn $fn_name(
            &self,
            from: PeerId,
            $( $pname : $pty, )*
        ) -> Result<(), Error> {
            // Step 1: Get bridge orchestrator
            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            let bridge_orch = match bridge_orch_guard.as_ref() {
                Some(orch) => orch,
                None => {
                    warn!(code = "INFRA-007", concat!("BridgeOrchestrator not configured for ", $label));
                    return Ok(());
                }
            };

            // Step 2: Compute hash and verify leader BLS signature
            let message_hash_internal = {
                let $cfg = bridge_orch.read().await;
                let $cfg = $cfg.config();
                $hash_expr
            };
            self.verify_leader_bls(&leader_id, &message_hash_internal, &leader_signature, $label)?;

            // Step 3: Sign (no validate for this pattern)
            let signature = {
                let $sorch = bridge_orch.read().await;
                let $shash: [u8; 32] = message_hash_internal.into();
                match $sign_expr {
                    Ok(sig) => sig,
                    Err(e) => {
                        warn!(code = "INFRA-007", error = %e, concat!("Failed to sign ", $label, " proposal"));
                        return Err(Error::BlsVerification(format!(
                            "Failed to sign {} proposal: {}", $label, e
                        )));
                    }
                }
            };

            // Step 4: Release locks, send signature to leader
            drop(bridge_orch_guard);

            let $rself = self;
            let $rsig = signature;
            self.p2p.send_to(from, $respond_expr).await
        }
    };

    // =========================================================
    // Pattern C: WITHOUT validate, direct BLS sign (NO orch lock for sign)
    // Hash used for signing is the SAME hash that was BLS-verified.
    // =========================================================
    (
        $fn_name:ident,
        label = $label:expr,
        params = ( $( $pname:ident : $pty:ty ),* $(,)? ),
        hash = |$cfg:ident| $hash_expr:expr,
        direct_sign = true,
        respond = |$rself:ident, $rsig:ident| $respond_expr:expr $(,)?
    ) => {
        pub async fn $fn_name(
            &self,
            from: PeerId,
            $( $pname : $pty, )*
        ) -> Result<(), Error> {
            // Step 1: Get bridge orchestrator
            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            let bridge_orch = match bridge_orch_guard.as_ref() {
                Some(orch) => orch,
                None => {
                    warn!(code = "INFRA-007", concat!("BridgeOrchestrator not configured for ", $label));
                    return Ok(());
                }
            };

            // Step 2: Compute hash and verify leader BLS signature
            let message_hash_internal = {
                let cfg_guard = bridge_orch.read().await;
                let $cfg = cfg_guard.config();
                $hash_expr
            };
            self.verify_leader_bls(&leader_id, &message_hash_internal, &leader_signature, $label)?;

            // Step 3: Sign directly with BLS signer (no orch lock needed)
            // Uses the BLS-verified hash from step 2 — intentionally NOT re-reading config.
            let hash_bytes: [u8; 32] = message_hash_internal.into();
            let signature = self
                .bls_signer
                .sign_message_hash(&self.bls_keypair, &hash_bytes)
                .map_err(|e| {
                    warn!(code = "INFRA-007", error = %e, concat!("Failed to sign ", $label, " proposal"));
                    Error::BlsVerification(format!("Failed to sign {} proposal: {}", $label, e))
                })?;

            // Step 4: Release locks, send signature to leader
            drop(bridge_orch_guard);

            let $rself = self;
            let $rsig = signature;
            self.p2p.send_to(from, $respond_expr).await
        }
    };

    // =========================================================
    // Pattern AC: WITH validate, direct BLS sign
    // Validate under orch lock, sign outside lock with pre-computed hash.
    // Used by record_collateral_move (#13) and mint_bridged_shares (#14).
    // Hash used for signing is the SAME hash that was BLS-verified.
    // =========================================================
    (
        $fn_name:ident,
        label = $label:expr,
        params = ( $( $pname:ident : $pty:ty ),* $(,)? ),
        hash = |$cfg:ident| $hash_expr:expr,
        validate = |$vorch:ident, $vmsg_hash:ident| $validate_expr:expr,
        direct_sign = true,
        respond = |$rself:ident, $rsig:ident| $respond_expr:expr $(,)?
    ) => {
        pub async fn $fn_name(
            &self,
            from: PeerId,
            $( $pname : $pty, )*
        ) -> Result<(), Error> {
            // Step 1: Get bridge orchestrator
            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            let bridge_orch = match bridge_orch_guard.as_ref() {
                Some(orch) => orch,
                None => {
                    warn!(code = "INFRA-007", concat!("BridgeOrchestrator not configured for ", $label));
                    return Ok(());
                }
            };

            // Step 2: Compute hash and verify leader BLS signature
            let message_hash_internal = {
                let cfg_guard = bridge_orch.read().await;
                let $cfg = cfg_guard.config();
                $hash_expr
            };
            self.verify_leader_bls(&leader_id, &message_hash_internal, &leader_signature, $label)?;

            // Step 3: Validate under orch lock (dedup check, hash consistency)
            {
                let $vorch = bridge_orch.read().await;
                let $vmsg_hash = message_hash_internal;
                match $validate_expr {
                    Ok(true) => {}
                    Ok(false) => {
                        warn!(code = "INFRA-007", concat!($label, " proposal validation failed"));
                        return Ok(());
                    }
                    Err(e) => {
                        warn!(code = "INFRA-007", error = %e, concat!($label, " proposal validation error"));
                        return Ok(());
                    }
                }
            }

            // Step 4: Sign directly with BLS signer (no orch lock needed)
            // Uses the BLS-verified hash from step 2 — same hash that passed validation.
            let hash_bytes: [u8; 32] = message_hash_internal.into();
            let signature = self
                .bls_signer
                .sign_message_hash(&self.bls_keypair, &hash_bytes)
                .map_err(|e| {
                    warn!(code = "INFRA-007", error = %e, concat!("Failed to sign ", $label, " proposal"));
                    Error::BlsVerification(format!("Failed to sign {} proposal: {}", $label, e))
                })?;

            // Step 5: Release locks, send signature to leader
            drop(bridge_orch_guard);

            let $rself = self;
            let $rsig = signature;
            self.p2p.send_to(from, $respond_expr).await
        }
    };
}

/// Generate a `handle_*_sign()` method for a BLS consensus phase (leader side).
///
/// # Hygiene
///
/// `signer_index` and `signature` (function params defined in macro body) are
/// bridged to call-site context via `$si` and `$sig` captured identifiers.
/// `from` is used directly in the macro body's debug log (macro context).
macro_rules! bridge_sign_handler {
    (
        $fn_name:ident,
        label = $label:expr,
        key_param = ( $kname:ident : $kty:ty ),
        add_sig = |$orch:ident, $si:ident, $sig:ident| $add_expr:expr $(,)?
    ) => {
        pub async fn $fn_name(
            &self,
            from: PeerId,
            signer_index: u8,
            $kname: $kty,
            signature: BLSSignature,
        ) -> Result<(), Error> {
            debug!(
                ?from,
                signer_index,
                concat!("Leader: Received ", $label, " signature")
            );

            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            let bridge_orch = match bridge_orch_guard.as_ref() {
                Some(orch) => orch,
                None => {
                    warn!(concat!("BridgeOrchestrator not configured, ignoring ", $label, " signature"));
                    return Ok(());
                }
            };

            // Bridge macro-context params to call-site context
            let $si = signer_index;
            let $sig = signature;
            let $orch = bridge_orch.write().await;
            match $add_expr {
                Ok(Some(result)) => {
                    info!(
                        signature_count = result.signature_count,
                        concat!($label, " signature threshold reached"),
                    );
                }
                Ok(None) => {
                    debug!(
                        concat!($label, " signature added, threshold not yet reached"),
                    );
                }
                Err(e) => {
                    warn!(
                        code = "INFRA-007",
                        error = %e,
                        concat!("Failed to add ", $label, " signature"),
                    );
                }
            }

            Ok(())
        }
    };
}

pub(crate) use bridge_proposal_handler;
pub(crate) use bridge_sign_handler;
```

**Step 2: Register in consensus/mod.rs**

Add `pub(crate) mod handler_macros;` to `oracle/src/consensus/mod.rs`.

**Step 3: Verify it compiles**

Run: `cargo check --manifest-path oracle/Cargo.toml 2>&1 | tail -5`
Expected: compiles (unused macros OK)

**Step 4: Commit**

```bash
git add oracle/src/consensus/handler_macros.rs oracle/src/consensus/mod.rs
git commit -m "refactor(oracle): add bridge_proposal_handler! and bridge_sign_handler! macros (4 arms)"
```

---

### Task 3: Migrate First Handler — `bridge_settlement_to_l3` (Pattern A)

**Files:**
- Modify: `oracle/src/consensus/protocol.rs`

This is the proof: migrate one handler, verify compilation + tests, then batch the rest.

**Step 1: Add macro import at top of protocol.rs**

Add near other `use super::` imports:
```rust
use super::handler_macros::{bridge_proposal_handler, bridge_sign_handler};
```

**Step 2: Replace `handle_bridge_settlement_to_l3_proposal` (lines ~4599-4770)**

Delete the entire method and replace with. Note: `leader_id` and `leader_signature` are inside `params` (call-site context). `mh` is the `$vmh`/`$smh` captured hash (bridged from macro-internal `message_hash_internal`).

```rust
bridge_proposal_handler!(
    handle_bridge_settlement_to_l3_proposal,
    label = "bridge_settlement_to_l3",
    params = (leader_id: PeerId, order_id: U256, itp_id: H256, user: Address, amount: U256, deadline: U256, leader_signature: BLSSignature),
    hash = |cfg| build_bridge_settlement_to_l3_hash(
        cfg.settlement_chain_id, order_id, itp_id, user, amount, deadline,
    ),
    validate = |orch, mh| orch.validate_bridge_proposal(&BridgeProposal {
        leader_id, order_id, itp_id, user, amount, deadline,
        leader_signature: leader_signature.clone(),
        message_hash: mh,
    }).await,
    sign = |orch, mh| orch.sign_bridge_proposal(&BridgeProposal {
        leader_id, order_id, itp_id, user, amount, deadline,
        leader_signature: leader_signature.clone(),
        message_hash: mh,
    }),
    respond = |s, sig| P2PMessage::BridgeSettlementToL3Sign {
        signer_id: s.config.peer_id,
        signer_index: s.runtime_config.oracle_registry_index(),
        order_id,
        signature: common::types::BLSSignature(sig.0),
    },
);
```

**Step 3: Replace `handle_bridge_settlement_to_l3_sign` (lines ~4775-4830)**

Delete and replace with:

```rust
bridge_sign_handler!(
    handle_bridge_settlement_to_l3_sign,
    label = "bridge_settlement_to_l3",
    key_param = (order_id: U256),
    add_sig = |orch, si, sig| orch.add_follower_signature(order_id, si, sig).await,
);
```

**Step 4: Verify it compiles**

Run: `cargo check --manifest-path oracle/Cargo.toml 2>&1 | tail -10`
Expected: compiles. If macro hygiene issues, fix the macro in handler_macros.rs.

**Step 5: Run tests**

Run: `cargo test --manifest-path oracle/Cargo.toml 2>&1 | tail -20`
Expected: all existing tests pass

**Step 6: Commit**

```bash
git add oracle/src/consensus/protocol.rs
git commit -m "refactor(oracle): migrate bridge_settlement_to_l3 to macro handler"
```

---

### Task 4: Migrate All Pattern A Handlers (7 remaining)

**Files:**
- Modify: `oracle/src/consensus/protocol.rs`

For each handler, delete the old method and replace with macro invocation. Do all 7 in one batch since the pattern is proven.

**CRITICAL: `leader_id: PeerId` and `leader_signature: BLSSignature` MUST be in the `params` list. Use `mh` (the captured hash) in proposal structs, never `orch.config()` to recompute.**

**The 7 Pattern A migrations:**

```rust
// 2. bridge_l3_to_settlement
bridge_proposal_handler!(
    handle_bridge_l3_to_settlement_proposal,
    label = "bridge_l3_to_settlement",
    params = (leader_id: PeerId, cycle_number: u64, order_ids: Vec<U256>, total_amount: U256, destination: Address, leader_signature: BLSSignature),
    hash = |cfg| build_bridge_l3_to_settlement_hash(
        cfg.l3_chain_id, cycle_number, &order_ids, total_amount, destination,
    ),
    validate = |orch, mh| orch.validate_bridge_l3_to_settlement_proposal(
        &BridgeL3ToSettlementProposal {
            leader_id, cycle_number, order_ids: order_ids.clone(), total_amount, destination,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }
    ).await,
    sign = |orch, mh| orch.sign_bridge_l3_to_settlement_proposal(
        &BridgeL3ToSettlementProposal {
            leader_id, cycle_number, order_ids: order_ids.clone(), total_amount, destination,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }
    ),
    respond = |s, sig| P2PMessage::BridgeL3ToSettlementSign {
        signer_id: s.config.peer_id,
        signer_index: s.runtime_config.oracle_registry_index(),
        cycle_number,
        signature: common::types::BLSSignature(sig.0),
    },
);

// 3. release_to_vault — cfg.settlement_chain_id + cfg.oracle_custody_settlement
// 4. submit_order — cfg.l3_chain_id
// 5. confirm_batch — cfg.l3_chain_id + cfg.index_address
// 6. confirm_fills — cfg.l3_chain_id + cfg.index_address
// 7. submit_sell_order — cfg.settlement_chain_id
// 8. complete_sell_order — cfg.settlement_chain_id + cfg.settlement_custody_address
```

Follow the exact same structure for each. Read each handler's actual hash builder call to get the correct config fields. **Always include `leader_id: PeerId` first and `leader_signature: BLSSignature` last in `params`. Always use `mh` for `message_hash` in proposal structs.**

**Also replace all 7 corresponding `handle_*_sign` methods** with `bridge_sign_handler!` invocations using `|orch, si, sig|`.

**Step 1: Replace all 7 proposal handlers + 7 sign handlers**

Read each handler before replacing to verify the hash builder params match.

**Step 2: Verify it compiles**

Run: `cargo check --manifest-path oracle/Cargo.toml 2>&1 | tail -10`

**Step 3: Run tests**

Run: `cargo test --manifest-path oracle/Cargo.toml 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add oracle/src/consensus/protocol.rs
git commit -m "refactor(oracle): migrate all Pattern A handlers to macro (8 proposal + 8 sign)"
```

---

### Task 5: Migrate Pattern B Handlers (2 — orch sign, no validate)

**Files:**
- Modify: `oracle/src/consensus/protocol.rs`

Pattern B uses the macro WITHOUT the `validate` parameter (second arm). `leader_id` and `leader_signature` are still in `params`.

```rust
// 9. rebalance_batch
bridge_proposal_handler!(
    handle_rebalance_batch_proposal,
    label = "rebalance_batch",
    params = (leader_id: PeerId, cycle_number: u64, itp_ids: Vec<H256>, leader_signature: BLSSignature),
    hash = |cfg| build_rebalance_batch_hash(
        cfg.l3_chain_id, cfg.index_address, cycle_number, &itp_ids,
    ),
    sign = |orch, _hb| orch.sign_rebalance_batch(cycle_number, &itp_ids),
    respond = |s, sig| P2PMessage::RebalanceBatchSign {
        signer_id: s.config.peer_id,
        signer_index: s.runtime_config.oracle_registry_index(),
        cycle_number,
        signature: sig,
    },
);

// 10. update_weights — similar, build_update_weights_hash, orch.sign_update_weights
```

**Step 1: Replace 2 proposal handlers + 2 sign handlers**

**Step 2: `cargo check` + `cargo test`**

**Step 3: Commit**

```bash
git add oracle/src/consensus/protocol.rs
git commit -m "refactor(oracle): migrate Pattern B handlers to macro (rebalance_batch, update_weights)"
```

---

### Task 6: Migrate Pattern C Handlers (2 — direct BLS sign, no validate)

**Files:**
- Modify: `oracle/src/consensus/protocol.rs`

Pattern C uses `direct_sign = true` and does NOT acquire an orch lock for the sign step. Only 2 handlers: rebalance (#11) and set_itp_nav (#12). `leader_id` and `leader_signature` are in `params`.

```rust
// 11. rebalance (single-phase)
bridge_proposal_handler!(
    handle_rebalance_proposal,
    label = "rebalance",
    params = (leader_id: PeerId, itp_id: H256, remove_indices: Vec<U256>, add_assets: Vec<Address>,
              new_weights: Vec<U256>, prices: Vec<U256>, quote_tokens: Vec<Address>, leader_signature: BLSSignature),
    hash = |cfg| build_rebalance_hash(
        cfg.l3_chain_id, cfg.index_address, itp_id,
        &remove_indices, &add_assets, &new_weights, &prices, &quote_tokens,
    ),
    direct_sign = true,
    respond = |s, sig| P2PMessage::RebalanceSign {
        signer_id: s.config.peer_id,
        signer_index: s.runtime_config.oracle_registry_index(),
        itp_id,
        signature: sig,
    },
);

// 12. set_itp_nav — cfg.l3_chain_id + cfg.index_address, direct_sign = true
```

**Step 1: Replace 2 proposal handlers + 2 sign handlers**

**Step 2: `cargo check` + `cargo test`**

**Step 3: Commit**

```bash
git add oracle/src/consensus/protocol.rs
git commit -m "refactor(oracle): migrate Pattern C handlers to macro (rebalance, set_itp_nav)"
```

---

### Task 7: Migrate Pattern AC Handlers (2 — validate + direct BLS sign)

**Files:**
- Modify: `oracle/src/consensus/protocol.rs`

Pattern AC uses `validate` + `direct_sign = true`. The validate expression receives `orch` (the read guard) AND `msg_hash` (the pre-computed hash bridged from macro context).

```rust
// 13. record_collateral_move
bridge_proposal_handler!(
    handle_record_collateral_move_proposal,
    label = "record_collateral_move",
    params = (leader_id: PeerId, cycle_number: u64, itp_id: H256, from_chain: U256,
              to_chain: U256, amount: U256, tx_type: u8, leader_signature: BLSSignature),
    hash = |cfg| build_record_collateral_move_hash(
        cfg.l3_chain_id, cfg.collateral_registry,
        itp_id, from_chain, to_chain, amount, tx_type,
    ),
    validate = |orch, msg_hash| orch.validate_record_collateral_move_proposal(
        &RecordCollateralMoveProposal {
            leader_id, cycle_number, itp_id, from_chain, to_chain, amount, tx_type,
            leader_signature: leader_signature.clone(),
            message_hash: msg_hash,
        },
        orch.config().collateral_registry,
    ).await,
    direct_sign = true,
    respond = |s, sig| P2PMessage::RecordCollateralMoveSign {
        signer_id: s.config.peer_id,
        signer_index: s.runtime_config.oracle_registry_index(),
        cycle_number,
        signature: sig,
    },
);

// 14. mint_bridged_shares
bridge_proposal_handler!(
    handle_mint_bridged_shares_proposal,
    label = "mint_bridged_shares",
    params = (leader_id: PeerId, cycle_number: u64, itp_id: H256, user: Address,
              amount: U256, order_id: U256, leader_signature: BLSSignature),
    hash = |cfg| build_mint_bridged_shares_hash(
        cfg.settlement_chain_id, cfg.bridge_proxy,
        itp_id, user, amount, order_id,
    ),
    validate = |orch, msg_hash| orch.validate_mint_bridged_shares_proposal(
        &MintBridgedSharesProposal {
            leader_id, cycle_number, itp_id, user, amount, order_id,
            leader_signature: leader_signature.clone(),
            message_hash: msg_hash,
        },
        orch.config().bridge_proxy,
    ).await,
    direct_sign = true,
    respond = |s, sig| P2PMessage::MintBridgedSharesSign {
        signer_id: s.config.peer_id,
        signer_index: s.runtime_config.oracle_registry_index(),
        cycle_number,
        signature: sig,
    },
);
```

**Step 1: Replace 2 proposal handlers + 2 sign handlers**

**Step 2: `cargo check` + `cargo test`**

**Step 3: Commit**

```bash
git add oracle/src/consensus/protocol.rs
git commit -m "refactor(oracle): migrate Pattern AC handlers to macro (collateral_move, mint_shares)"
```

---

### Task 8: Update Hand-Written Handlers to Use `verify_leader_bls()`

**Files:**
- Modify: `oracle/src/consensus/protocol.rs`

The 4 remaining hand-written handlers (nav_oracle, mirror_sync, asset_trades, **complete_buy_order**) still have the 25-line inline BLS verification block. Replace each with a call to `self.verify_leader_bls()`.

**Step 1: Update `handle_nav_oracle_proposal` (line ~7750)**

Replace the `if let Some(leader_pubkey)...` block with:
```rust
self.verify_leader_bls(&leader_id, &message_hash, &leader_signature, "nav_oracle")?;
```

**Step 2: Update `handle_mirror_sync_proposal` (line ~7865)**

Same replacement with label `"mirror_sync"`.

**Step 3: Update `asset_trades` inline handler (line ~2244)**

Same replacement with label `"asset_trades"`.

**Step 4: Update `complete_buy_order` inline handler (line ~2611)**

Replace the `if let Some(leader_pubkey)...` block (lines ~2611-2652) with:
```rust
self.verify_leader_bls(&leader_id, &message_hash, &leader_signature, "complete_buy_order")?;
```

**Step 5: `cargo check` + `cargo test`**

**Step 6: Commit**

```bash
git add oracle/src/consensus/protocol.rs
git commit -m "refactor(oracle): use verify_leader_bls() in all 4 remaining hand-written handlers"
```

---

### Task 9: Delete Dead Code + Clean Imports

**Files:**
- Modify: `oracle/src/consensus/protocol.rs`

**Step 1: Remove any now-unused imports**

After the macro migration, some `use` statements for types only used in deleted handler bodies may be dead. Run `cargo check` and fix unused import warnings.

**Step 2: Verify line count reduction**

Run: `wc -l oracle/src/consensus/protocol.rs`
Expected: ~6,500-7,000 lines (down from 9,690)

**Step 3: `cargo check` + `cargo test`**

**Step 4: Commit**

```bash
git add oracle/src/consensus/protocol.rs
git commit -m "refactor(oracle): clean up imports after macro migration"
```

---

### Task 10: Separate All Three Shared Signature Collections

**Files:**
- Modify: `oracle/src/bridge/orchestrator.rs`
- Modify: `oracle/src/consensus/protocol.rs`

Currently `nav_sigs: SignatureCollectionManager<H256>` is shared by three handlers:
- `handle_set_itp_nav_sign` (key: `itp_id: H256` — keccak256 hash)
- `handle_nav_oracle_sign` (key: `H256::from(itp_address)` — zero-padded address)
- `handle_mirror_sync_sign` (key: `H256::from_low_u64_be(nonce)` — zero-padded u64)

These key spaces can collide, enabling cross-contamination of signature collections.

**Step 1: Add separate fields to BridgeOrchestrator**

```rust
/// Signature manager for NavOracle proposals (keyed by itp_address as H256)
nav_oracle_sigs: SignatureCollectionManager<H256>,
/// Signature manager for MirrorOracleRegistry sync proposals (keyed by nonce as H256)
mirror_sync_sigs: SignatureCollectionManager<H256>,
// nav_sigs stays for SetItpNav ONLY (keyed by itp_id)
```

Initialize in constructor:
```rust
nav_oracle_sigs: SignatureCollectionManager::new("nav_oracle"),
mirror_sync_sigs: SignatureCollectionManager::new("mirror_sync"),
```

**Step 2: Add methods for each new collection**

```rust
// NavOracle
pub async fn start_nav_oracle_signature_collection(&self, key: H256, leader_signature: BLSSignature) {
    self.nav_oracle_sigs.start_collection(key, self.node_index, leader_signature).await;
}
pub async fn add_nav_oracle_signature(
    &self, key: H256, signer_index: u8, signature: BLSSignature,
) -> Result<Option<SignedConsensusResult>, BridgeError> {
    self.nav_oracle_sigs.add_follower_signature(key, signer_index, signature).await
}
pub async fn check_nav_oracle_threshold(&self, key: &H256) -> Option<SignedConsensusResult> {
    self.nav_oracle_sigs.check_threshold(key).await
}

// MirrorSync
pub async fn start_mirror_sync_signature_collection(&self, key: H256, leader_signature: BLSSignature) {
    self.mirror_sync_sigs.start_collection(key, self.node_index, leader_signature).await;
}
pub async fn add_mirror_sync_signature(
    &self, key: H256, signer_index: u8, signature: BLSSignature,
) -> Result<Option<SignedConsensusResult>, BridgeError> {
    self.mirror_sync_sigs.add_follower_signature(key, signer_index, signature).await
}
pub async fn check_mirror_sync_threshold(&self, key: &H256) -> Option<SignedConsensusResult> {
    self.mirror_sync_sigs.check_threshold(key).await
}
```

**Step 3: Migrate ALL call sites (follower + leader)**

Follower-side (protocol.rs handlers):
- `handle_nav_oracle_sign`: `orch.add_nav_signature(itp_key, ...)` → `orch.add_nav_oracle_signature(itp_key, ...)`
- `handle_mirror_sync_sign`: `orch.add_nav_signature(sync_key, ...)` → `orch.add_mirror_sync_signature(sync_key, ...)`
- `handle_set_itp_nav_sign`: keep using `orch.add_nav_signature(itp_id, ...)` (only user now)

Leader-side (protocol.rs run_* methods) — **ALL of these MUST be migrated or consensus deadlocks**:
- NavOracle leader start: `orch.start_nav_signature_collection(key, ...)` → `orch.start_nav_oracle_signature_collection(key, ...)`
- NavOracle leader poll: `orch.check_nav_threshold(key)` → `orch.check_nav_oracle_threshold(key)`
- NavOracle leader self-add: `orch.add_nav_signature(key, ...)` → `orch.add_nav_oracle_signature(key, ...)`
- MirrorSync leader start: `orch.start_nav_signature_collection(key, ...)` → `orch.start_mirror_sync_signature_collection(key, ...)`
- MirrorSync leader poll: `orch.check_nav_threshold(key)` → `orch.check_mirror_sync_threshold(key)`
- MirrorSync leader self-add: `orch.add_nav_signature(key, ...)` → `orch.add_mirror_sync_signature(key, ...)`

**Step 4: Verify no remaining references to old shared methods for nav_oracle/mirror_sync**

Run: `grep -rn "add_nav_signature\|start_nav_signature_collection\|check_nav_threshold" oracle/src/ | grep -v "set_itp_nav"`
Expected: no results (only `set_itp_nav` should still use `nav_sigs`)

**Step 5: `cargo check` + `cargo test`**

**Step 6: Commit**

```bash
git add oracle/src/bridge/orchestrator.rs oracle/src/consensus/protocol.rs
git commit -m "security(oracle): separate nav_oracle and mirror_sync signature collections from nav_sigs"
```

---

### Task 11: PhaseState<K> Consolidation in Orchestrator

**Files:**
- Create: `oracle/src/bridge/phase_state.rs`
- Modify: `oracle/src/bridge/orchestrator.rs`
- Modify: `oracle/src/bridge/mod.rs`

**Step 1: Create PhaseState struct**

```rust
//! Consolidated state for a BLS consensus phase.

use std::collections::HashMap;
use std::hash::Hash;
use ethers::types::H256;
use tokio::sync::RwLock;
use super::signature_manager::SignatureCollectionManager;

/// Bundles a SignatureCollectionManager with its dedup map.
///
/// Replaces the repeated pattern of:
///   x_sigs: SignatureCollectionManager<K>,
///   confirmed_x: RwLock<HashMap<K, H256>>,
pub struct PhaseState<K: Hash + Eq> {
    pub sigs: SignatureCollectionManager<K>,
    pub confirmed: RwLock<HashMap<K, H256>>,
}

impl<K: Hash + Eq + Clone + std::fmt::Display + Send + Sync + 'static> PhaseState<K> {
    pub fn new(label: &'static str) -> Self {
        Self {
            sigs: SignatureCollectionManager::new(label),
            confirmed: RwLock::new(HashMap::new()),
        }
    }

    pub async fn is_confirmed(&self, key: &K) -> bool {
        self.confirmed.read().await.contains_key(key)
    }

    pub async fn mark_confirmed(&self, key: K, tx_hash: H256) {
        self.confirmed.write().await.insert(key, tx_hash);
    }
}
```

**Step 2: Replace the 8 matching pairs in BridgeOrchestrator**

Only consolidate fields that ARE actually (sigs + confirmed) pairs. Do NOT consolidate:
- `order_mappings`, `order_amounts`, `order_limit_prices` (metadata, not phase state)
- `order_status`, `sell_order_status` (lifecycle tracking)
- `watchdog` (not a phase)
- `submit_order_signatures` (special case with extra fields)

Consolidate these 8:
```rust
// Before: 16 fields
batch_sigs + confirmed_batches → batch_phase: PhaseState<u64>
fills_sigs + confirmed_fills → fills_phase: PhaseState<u64>
l3_to_settlement_sigs + confirmed_l3_to_settlement → l3_to_settlement_phase: PhaseState<u64>
release_sigs + confirmed_releases → release_phase: PhaseState<u64>
rebalance_batch_sigs + confirmed_rebalance_batches → rebalance_batch_phase: PhaseState<u64>
asset_trades_sigs + confirmed_asset_trades → asset_trades_phase: PhaseState<u64>
collateral_move_sigs + confirmed_collateral_moves → collateral_move_phase: PhaseState<u64>
mint_shares_sigs + confirmed_mint_shares → mint_shares_phase: PhaseState<u64>
```

**Step 3: Update all references**

For each consolidated pair, search and replace:
- `self.batch_sigs.` → `self.batch_phase.sigs.`
- `self.confirmed_batches.read().await.contains_key(` → `self.batch_phase.is_confirmed(`
- `self.confirmed_batches.write().await.insert(` → `self.batch_phase.mark_confirmed(`

**Step 4: `cargo check` + `cargo test`**

**Step 5: Commit**

```bash
git add oracle/src/bridge/phase_state.rs oracle/src/bridge/orchestrator.rs oracle/src/bridge/mod.rs
git commit -m "refactor(oracle): consolidate orchestrator state with PhaseState<K>"
```

---

## Expected Results

| File | Before | After | Saved |
|------|--------|-------|-------|
| `consensus/protocol.rs` | 9,690 | ~6,600 | ~3,090 |
| `consensus/handler_macros.rs` | 0 | ~280 | — |
| `bridge/orchestrator.rs` | 4,954 | ~4,500 | ~450 |
| `bridge/phase_state.rs` | 0 | ~40 | — |
| **Net** | **14,644** | **~11,420** | **~3,220 lines (~22%)** |

The real win: adding a new consensus phase goes from copy-pasting ~230 lines to writing a ~15-line macro invocation.

## What Was NOT Changed (by design)

- `P2PMessage` enum — wire format untouched
- `MessageHandleResult` enum — dispatch untouched (arms are thin)
- `equivocation.rs` — untouched
- `connection.rs` `get_sender_id()` — untouched
- `bridge/types.rs` hash builders — untouched (signature variation too high for macro)
- Orchestrator `validate_*()` methods — each has unique logic, untouched
- Orchestrator `sign_*()` methods — some skip hash check, untouched (macro calls them as-is)
