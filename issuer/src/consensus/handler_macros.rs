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
//! call site, giving them call-site syntax context. They are ALSO captured
//! via `leader = ($lid, $lsig)` so that `verify_leader_bls()` can reference
//! them with call-site context (bare identifiers in macro body have macro
//! context and cannot see `$pname`-expanded function params).

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
        leader = ($lid:ident, $lsig:ident),
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
            self.verify_leader_bls(&$lid, &message_hash_internal, &$lsig, $label)?;

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
        leader = ($lid:ident, $lsig:ident),
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
            self.verify_leader_bls(&$lid, &message_hash_internal, &$lsig, $label)?;

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
        leader = ($lid:ident, $lsig:ident),
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
            self.verify_leader_bls(&$lid, &message_hash_internal, &$lsig, $label)?;

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
        leader = ($lid:ident, $lsig:ident),
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
            self.verify_leader_bls(&$lid, &message_hash_internal, &$lsig, $label)?;

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
