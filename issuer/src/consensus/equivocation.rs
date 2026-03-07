//! Equivocation detection for consensus messages.
//!
//! Detects when a peer sends conflicting messages for the same
//! (cycle_number, phase) — e.g. voting approve on one proposal and
//! reject on another in the same round. This is Byzantine behaviour
//! and triggers a double penalty via the peer scorer.

use dashmap::DashMap;
use sha2::{Digest, Sha256};

use common::types::{P2PMessage, PeerId};

use super::state::ConsensusPhase;

/// Key type for equivocation tracking: (peer_id, cycle_number, phase, msg_variant_tag, round_type).
/// The variant tag ensures different message types within the same phase
/// (e.g. BatchSign vs ConfirmBatchSign during BatchSigning) are tracked independently.
/// The round_type ("price" vs "bridge") ensures price-only and bridge consensus
/// rounds don't false-positive on each other when running concurrently.
type DetectorKey = (PeerId, u64, ConsensusPhase, &'static str, &'static str);

/// Tracks the first message content hash seen from each peer per
/// (cycle_number, phase, msg_variant, round_type). If a second, *different* hash arrives for
/// the same key, an equivocation is flagged.
pub struct EquivocationDetector {
    /// Key: (peer_id, cycle_number, phase, variant_tag, round_type)
    /// Value: sha256 hash of first message content
    seen: DashMap<DetectorKey, [u8; 32]>,
}

impl EquivocationDetector {
    pub fn new() -> Self {
        Self {
            seen: DashMap::new(),
        }
    }

    /// Returns `true` if equivocation detected (different content for same key).
    pub fn check(
        &self,
        peer: &PeerId,
        cycle: u64,
        phase: ConsensusPhase,
        variant_tag: &'static str,
        round_type: &'static str,
        content_hash: [u8; 32],
    ) -> bool {
        let key = (*peer, cycle, phase, variant_tag, round_type);
        match self.seen.entry(key) {
            dashmap::mapref::entry::Entry::Vacant(e) => {
                e.insert(content_hash);
                false
            }
            dashmap::mapref::entry::Entry::Occupied(e) => *e.get() != content_hash,
        }
    }

    /// Cleanup entries from old cycles. Retains the current cycle and
    /// up to 2 prior cycles to handle in-flight messages.
    pub fn gc(&self, current_cycle: u64) {
        self.seen
            .retain(|&(_, cycle, _, _, _), _| cycle >= current_cycle.saturating_sub(2));
    }

    /// Size-based GC: if entries exceed `max_entries`, drop the oldest
    /// cycle entirely.
    pub fn gc_by_size(&self, max_entries: usize) {
        if self.seen.len() > max_entries {
            let min_cycle = self.seen.iter().map(|r| r.key().1).min().unwrap_or(0);
            self.seen.retain(|&(_, cycle, _, _, _), _| cycle > min_cycle);
        }
    }

    /// Number of tracked entries (for observability).
    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.seen.len()
    }
}

/// Compute a SHA-256 content hash over the *semantic* fields of a P2PMessage,
/// deliberately EXCLUDING BLS signature fields so that equivocation detection
/// compares the payload (what was voted on) not the cryptographic proof.
///
/// IMPORTANT: This match is **exhaustive** (no `_ =>` fallback).
/// Adding a new `P2PMessage` variant will cause a compile error here,
/// forcing the author to decide how to hash it.
pub fn content_hash(msg: &P2PMessage) -> [u8; 32] {
    let mut h = Sha256::new();

    match msg {
        // ── Core consensus (cycle-based) ────────────────────────
        P2PMessage::CycleStart {
            cycle_number,
            leader_id,
        } => {
            h.update(b"CycleStart");
            h.update(cycle_number.to_le_bytes());
            h.update(leader_id);
        }
        P2PMessage::PriceProposal {
            cycle_number,
            prices,
            reference_nonce: _, // exclude from equivocation hash
            proposer_signature: _, // exclude BLS sig
        } => {
            h.update(b"PriceProposal");
            h.update(cycle_number.to_le_bytes());
            for (idx, price) in prices {
                h.update(idx.to_le_bytes());
                let mut buf = [0u8; 32];
                price.to_little_endian(&mut buf);
                h.update(buf);
            }
        }
        P2PMessage::PriceVote {
            cycle_number,
            voter_id,
            approved,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"PriceVote");
            h.update(cycle_number.to_le_bytes());
            h.update(voter_id);
            h.update([*approved as u8]);
        }
        P2PMessage::BatchProposal {
            cycle_number,
            order_ids,
            fills,
            reference_nonce: _, // exclude from equivocation hash
            proposer_signature: _, // exclude BLS sig
        } => {
            h.update(b"BatchProposal");
            h.update(cycle_number.to_le_bytes());
            for oid in order_ids {
                h.update(oid.to_le_bytes());
            }
            // Hash fill data
            let fill_bytes = rmp_serde::to_vec(fills).unwrap_or_default();
            h.update(fill_bytes);
        }
        P2PMessage::BatchSign {
            cycle_number,
            signer_id,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"BatchSign");
            h.update(cycle_number.to_le_bytes());
            h.update(signer_id);
        }
        P2PMessage::Heartbeat {
            sender_id,
            timestamp,
        } => {
            h.update(b"Heartbeat");
            h.update(sender_id);
            h.update(timestamp.to_le_bytes());
        }
        P2PMessage::KickVote {
            target_id,
            voter_id,
            reason,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"KickVote");
            h.update(target_id);
            h.update(voter_id);
            h.update(reason.as_bytes());
        }

        // ── ITP creation ────────────────────────────────────────
        P2PMessage::ItpCreationProposal {
            leader_id,
            admin,
            nonce,
            name,
            symbol,
            weights,
            assets,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"ItpCreationProposal");
            h.update(leader_id);
            h.update(admin.as_bytes());
            let mut buf = [0u8; 32];
            nonce.to_little_endian(&mut buf);
            h.update(buf);
            h.update(name.as_bytes());
            h.update(symbol.as_bytes());
            for w in weights {
                let mut wbuf = [0u8; 32];
                w.to_little_endian(&mut wbuf);
                h.update(wbuf);
            }
            for a in assets {
                h.update(a.as_bytes());
            }
        }
        P2PMessage::ItpCreationSign {
            signer_id,
            signer_index,
            nonce,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"ItpCreationSign");
            h.update(signer_id);
            h.update([*signer_index]);
            let mut buf = [0u8; 32];
            nonce.to_little_endian(&mut buf);
            h.update(buf);
        }

        // ── Rebalance request ───────────────────────────────────
        P2PMessage::RebalanceRequestProposal {
            leader_id,
            deployer,
            itp_id,
            nonce,
            new_weights,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"RebalanceRequestProposal");
            h.update(leader_id);
            h.update(deployer.as_bytes());
            h.update(itp_id.as_bytes());
            let mut buf = [0u8; 32];
            nonce.to_little_endian(&mut buf);
            h.update(buf);
            for w in new_weights {
                let mut wbuf = [0u8; 32];
                w.to_little_endian(&mut wbuf);
                h.update(wbuf);
            }
        }
        P2PMessage::RebalanceRequestSign {
            signer_id,
            signer_index,
            nonce,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"RebalanceRequestSign");
            h.update(signer_id);
            h.update([*signer_index]);
            let mut buf = [0u8; 32];
            nonce.to_little_endian(&mut buf);
            h.update(buf);
        }

        // ── Bridge Settlement→L3 ──────────────────────────────────────
        P2PMessage::BridgeSettlementToL3Proposal {
            leader_id,
            order_id,
            itp_id,
            user,
            amount,
            deadline,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"BridgeSettlementToL3Proposal");
            h.update(leader_id);
            let mut buf = [0u8; 32];
            order_id.to_little_endian(&mut buf);
            h.update(buf);
            h.update(itp_id.as_bytes());
            h.update(user.as_bytes());
            amount.to_little_endian(&mut buf);
            h.update(buf);
            deadline.to_little_endian(&mut buf);
            h.update(buf);
        }
        P2PMessage::BridgeSettlementToL3Sign {
            signer_id,
            signer_index,
            order_id,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"BridgeSettlementToL3Sign");
            h.update(signer_id);
            h.update([*signer_index]);
            let mut buf = [0u8; 32];
            order_id.to_little_endian(&mut buf);
            h.update(buf);
        }

        // ── Submit order for user ───────────────────────────────
        P2PMessage::SubmitOrderForUserProposal {
            leader_id,
            settlement_order_id,
            itp_id,
            user,
            amount,
            limit_price,
            slippage_tier,
            deadline,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"SubmitOrderForUserProposal");
            h.update(leader_id);
            let mut buf = [0u8; 32];
            settlement_order_id.to_little_endian(&mut buf);
            h.update(buf);
            h.update(itp_id.as_bytes());
            h.update(user.as_bytes());
            amount.to_little_endian(&mut buf);
            h.update(buf);
            limit_price.to_little_endian(&mut buf);
            h.update(buf);
            slippage_tier.to_little_endian(&mut buf);
            h.update(buf);
            deadline.to_little_endian(&mut buf);
            h.update(buf);
        }
        P2PMessage::SubmitOrderForUserSign {
            signer_id,
            signer_index,
            settlement_order_id,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"SubmitOrderForUserSign");
            h.update(signer_id);
            h.update([*signer_index]);
            let mut buf = [0u8; 32];
            settlement_order_id.to_little_endian(&mut buf);
            h.update(buf);
        }

        // ── Confirm batch / fills ───────────────────────────────
        P2PMessage::ConfirmBatchProposal {
            leader_id,
            cycle_number,
            order_ids,
            prices,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"ConfirmBatchProposal");
            h.update(leader_id);
            h.update(cycle_number.to_le_bytes());
            for oid in order_ids {
                let mut buf = [0u8; 32];
                oid.to_little_endian(&mut buf);
                h.update(buf);
            }
            for p in prices {
                let mut buf = [0u8; 32];
                p.to_little_endian(&mut buf);
                h.update(buf);
            }
        }
        P2PMessage::ConfirmBatchSign {
            signer_id,
            signer_index,
            cycle_number,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"ConfirmBatchSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(cycle_number.to_le_bytes());
        }
        P2PMessage::ConfirmFillsProposal {
            leader_id,
            cycle_number,
            fills,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"ConfirmFillsProposal");
            h.update(leader_id);
            h.update(cycle_number.to_le_bytes());
            let fill_bytes = rmp_serde::to_vec(fills).unwrap_or_default();
            h.update(fill_bytes);
        }
        P2PMessage::ConfirmFillsSign {
            signer_id,
            signer_index,
            cycle_number,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"ConfirmFillsSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(cycle_number.to_le_bytes());
        }

        // ── Bridge L3→Settlement ──────────────────────────────────────
        P2PMessage::BridgeL3ToSettlementProposal {
            leader_id,
            cycle_number,
            order_ids,
            total_amount,
            destination,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"BridgeL3ToSettlementProposal");
            h.update(leader_id);
            h.update(cycle_number.to_le_bytes());
            for oid in order_ids {
                let mut buf = [0u8; 32];
                oid.to_little_endian(&mut buf);
                h.update(buf);
            }
            let mut buf = [0u8; 32];
            total_amount.to_little_endian(&mut buf);
            h.update(buf);
            h.update(destination.as_bytes());
        }
        P2PMessage::BridgeL3ToSettlementSign {
            signer_id,
            signer_index,
            cycle_number,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"BridgeL3ToSettlementSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(cycle_number.to_le_bytes());
        }

        // ── Release to vault ────────────────────────────────────
        P2PMessage::ReleaseToVaultProposal {
            leader_id,
            cycle_number,
            order_ids,
            total_amount,
            vault_address,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"ReleaseToVaultProposal");
            h.update(leader_id);
            h.update(cycle_number.to_le_bytes());
            for oid in order_ids {
                let mut buf = [0u8; 32];
                oid.to_little_endian(&mut buf);
                h.update(buf);
            }
            let mut buf = [0u8; 32];
            total_amount.to_little_endian(&mut buf);
            h.update(buf);
            h.update(vault_address.as_bytes());
        }
        P2PMessage::ReleaseToVaultSign {
            signer_id,
            signer_index,
            cycle_number,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"ReleaseToVaultSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(cycle_number.to_le_bytes());
        }

        // ── Rebalance batch ─────────────────────────────────────
        P2PMessage::RebalanceBatchProposal {
            leader_id,
            cycle_number,
            itp_ids,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"RebalanceBatchProposal");
            h.update(leader_id);
            h.update(cycle_number.to_le_bytes());
            for itp in itp_ids {
                h.update(itp.as_bytes());
            }
        }
        P2PMessage::RebalanceBatchSign {
            signer_id,
            signer_index,
            cycle_number,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"RebalanceBatchSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(cycle_number.to_le_bytes());
        }

        // ── Update weights ──────────────────────────────────────
        P2PMessage::UpdateWeightsProposal {
            leader_id,
            itp_id,
            new_weights,
            new_inventory,
            nav,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"UpdateWeightsProposal");
            h.update(leader_id);
            h.update(itp_id.as_bytes());
            for w in new_weights {
                let mut buf = [0u8; 32];
                w.to_little_endian(&mut buf);
                h.update(buf);
            }
            for inv in new_inventory {
                let mut buf = [0u8; 32];
                inv.to_little_endian(&mut buf);
                h.update(buf);
            }
            let mut buf = [0u8; 32];
            nav.to_little_endian(&mut buf);
            h.update(buf);
        }
        P2PMessage::UpdateWeightsSign {
            signer_id,
            signer_index,
            itp_id,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"UpdateWeightsSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(itp_id.as_bytes());
        }

        // ── Single-phase rebalance ──────────────────────────────
        P2PMessage::RebalanceProposal {
            leader_id,
            itp_id,
            remove_indices,
            add_assets,
            new_weights,
            prices,
            quote_tokens,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"RebalanceProposal");
            h.update(leader_id);
            h.update(itp_id.as_bytes());
            for ri in remove_indices {
                let mut buf = [0u8; 32];
                ri.to_little_endian(&mut buf);
                h.update(buf);
            }
            for a in add_assets {
                h.update(a.as_bytes());
            }
            for w in new_weights {
                let mut buf = [0u8; 32];
                w.to_little_endian(&mut buf);
                h.update(buf);
            }
            for p in prices {
                let mut buf = [0u8; 32];
                p.to_little_endian(&mut buf);
                h.update(buf);
            }
            for qt in quote_tokens {
                h.update(qt.as_bytes());
            }
        }
        P2PMessage::RebalanceSign {
            signer_id,
            signer_index,
            itp_id,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"RebalanceSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(itp_id.as_bytes());
        }

        // ── Cross-chain sell flow ───────────────────────────────
        P2PMessage::SubmitSellOrderProposal {
            leader_id,
            order_id,
            itp_id,
            user,
            bridged_itp_address,
            amount,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"SubmitSellOrderProposal");
            h.update(leader_id);
            let mut buf = [0u8; 32];
            order_id.to_little_endian(&mut buf);
            h.update(buf);
            h.update(itp_id.as_bytes());
            h.update(user.as_bytes());
            h.update(bridged_itp_address.as_bytes());
            amount.to_little_endian(&mut buf);
            h.update(buf);
        }
        P2PMessage::SubmitSellOrderSign {
            signer_id,
            signer_index,
            order_id,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"SubmitSellOrderSign");
            h.update(signer_id);
            h.update([*signer_index]);
            let mut buf = [0u8; 32];
            order_id.to_little_endian(&mut buf);
            h.update(buf);
        }
        P2PMessage::CompleteSellOrderProposal {
            leader_id,
            order_id,
            usdc_proceeds,
            vault,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"CompleteSellOrderProposal");
            h.update(leader_id);
            let mut buf = [0u8; 32];
            order_id.to_little_endian(&mut buf);
            h.update(buf);
            usdc_proceeds.to_little_endian(&mut buf);
            h.update(buf);
            h.update(vault.as_bytes());
        }
        P2PMessage::CompleteSellOrderSign {
            signer_id,
            signer_index,
            order_id,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"CompleteSellOrderSign");
            h.update(signer_id);
            h.update([*signer_index]);
            let mut buf = [0u8; 32];
            order_id.to_little_endian(&mut buf);
            h.update(buf);
        }

        // ── Asset trades ────────────────────────────────────────
        P2PMessage::AssetTradesProposal {
            leader_id,
            cycle_number,
            trades_data,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"AssetTradesProposal");
            h.update(leader_id);
            h.update(cycle_number.to_le_bytes());
            for (addr, side, usdc_amt, price, qt) in trades_data {
                h.update(addr.as_bytes());
                h.update([*side]);
                let mut buf = [0u8; 32];
                usdc_amt.to_little_endian(&mut buf);
                h.update(buf);
                price.to_little_endian(&mut buf);
                h.update(buf);
                h.update(qt.as_bytes());
            }
        }
        P2PMessage::AssetTradesSign {
            signer_id,
            signer_index,
            cycle_number,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"AssetTradesSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(cycle_number.to_le_bytes());
        }

        // ── 8-step bridge: RecordCollateralMove ─────────────────
        P2PMessage::RecordCollateralMoveProposal {
            leader_id,
            cycle_number,
            itp_id,
            from_chain,
            to_chain,
            amount,
            tx_type,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"RecordCollateralMoveProposal");
            h.update(leader_id);
            h.update(cycle_number.to_le_bytes());
            h.update(itp_id.as_bytes());
            let mut buf = [0u8; 32];
            from_chain.to_little_endian(&mut buf);
            h.update(buf);
            to_chain.to_little_endian(&mut buf);
            h.update(buf);
            amount.to_little_endian(&mut buf);
            h.update(buf);
            h.update([*tx_type]);
        }
        P2PMessage::RecordCollateralMoveSign {
            signer_id,
            signer_index,
            cycle_number,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"RecordCollateralMoveSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(cycle_number.to_le_bytes());
        }

        // ── 8-step bridge: MintBridgedShares ────────────────────
        P2PMessage::MintBridgedSharesProposal {
            leader_id,
            cycle_number,
            itp_id,
            user,
            amount,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"MintBridgedSharesProposal");
            h.update(leader_id);
            h.update(cycle_number.to_le_bytes());
            h.update(itp_id.as_bytes());
            h.update(user.as_bytes());
            let mut buf = [0u8; 32];
            amount.to_little_endian(&mut buf);
            h.update(buf);
        }
        P2PMessage::MintBridgedSharesSign {
            signer_id,
            signer_index,
            cycle_number,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"MintBridgedSharesSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(cycle_number.to_le_bytes());
        }

        // ── completeBuyOrder ────────────────────────────────────
        P2PMessage::CompleteBuyOrderProposal {
            leader_id,
            cycle_number,
            order_id,
            vault,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"CompleteBuyOrderProposal");
            h.update(leader_id);
            h.update(cycle_number.to_le_bytes());
            let mut buf = [0u8; 32];
            order_id.to_little_endian(&mut buf);
            h.update(buf);
            h.update(vault.as_bytes());
        }
        P2PMessage::CompleteBuyOrderSign {
            signer_id,
            signer_index,
            cycle_number,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"CompleteBuyOrderSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(cycle_number.to_le_bytes());
        }

        // ── setItpNav (pre-rebalance) ───────────────────────────
        P2PMessage::SetItpNavProposal {
            leader_id,
            itp_id,
            nav,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"SetItpNavProposal");
            h.update(leader_id);
            h.update(itp_id.as_bytes());
            let mut buf = [0u8; 32];
            nav.to_little_endian(&mut buf);
            h.update(buf);
        }
        P2PMessage::SetItpNavSign {
            signer_id,
            signer_index,
            itp_id,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"SetItpNavSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(itp_id.as_bytes());
        }

        // ── Arbitration ─────────────────────────────────────────
        P2PMessage::ArbitrationPriceProposal {
            leader_id,
            bet_id,
            prices,
            timestamp,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"ArbitrationPriceProposal");
            h.update(leader_id);
            let mut buf = [0u8; 32];
            bet_id.to_little_endian(&mut buf);
            h.update(buf);
            for (idx, sym, price) in prices {
                h.update(idx.to_le_bytes());
                h.update(sym.as_bytes());
                h.update(price.to_le_bytes());
            }
            h.update(timestamp.to_le_bytes());
        }
        P2PMessage::ArbitrationPriceVote {
            voter_id,
            voter_index,
            bet_id,
            accept,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"ArbitrationPriceVote");
            h.update(voter_id);
            h.update([*voter_index]);
            let mut buf = [0u8; 32];
            bet_id.to_little_endian(&mut buf);
            h.update(buf);
            h.update([*accept as u8]);
        }
        P2PMessage::ArbitrationResolutionSign {
            signer_id,
            signer_index,
            bet_id,
            outcome_hash,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"ArbitrationResolutionSign");
            h.update(signer_id);
            h.update([*signer_index]);
            let mut buf = [0u8; 32];
            bet_id.to_little_endian(&mut buf);
            h.update(buf);
            h.update(outcome_hash.as_bytes());
        }
        // ── NAV oracle (ITPNAVOracle on Settlement) ──────────────────────
        P2PMessage::NavOracleProposal {
            leader_id,
            itp_address,
            oracle_address,
            nav_price,
            timestamp,
            cycle_number,
            chain_id,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"NavOracleProposal");
            h.update(leader_id);
            h.update(itp_address.as_bytes());
            h.update(oracle_address.as_bytes());
            let mut buf = [0u8; 32];
            nav_price.to_little_endian(&mut buf);
            h.update(buf);
            h.update(timestamp.to_le_bytes());
            h.update(cycle_number.to_le_bytes());
            h.update(chain_id.to_le_bytes());
        }
        P2PMessage::NavOracleSign {
            signer_id,
            signer_index,
            itp_address,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"NavOracleSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(itp_address.as_bytes());
        }

        // Batch config orchestrator (independent from settlement cycle)
        P2PMessage::BatchConfigProposal {
            round,
            configs: _, // large payload, hash by composite_hash only
            composite_hash,
        } => {
            h.update(b"BatchConfigProposal");
            h.update(round.to_le_bytes());
            h.update(composite_hash.as_bytes());
        }
        P2PMessage::BatchConfigSign {
            round,
            composite_hash,
            bls_signature: _, // exclude BLS sig
            accepted,
            reject_reason: _,
        } => {
            h.update(b"BatchConfigSign");
            h.update(round.to_le_bytes());
            h.update(composite_hash.as_bytes());
            h.update([*accepted as u8]);
        }

        // ── MirrorIssuerRegistry sync (Step 12) ────────────────
        P2PMessage::MirrorSyncProposal {
            leader_id,
            nonce,
            issuer_pubkeys,
            issuer_ids,
            active_bitmask,
            active_count,
            threshold,
            chain_id,
            mirror_address,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"MirrorSyncProposal");
            h.update(leader_id);
            h.update(nonce.to_le_bytes());
            for pk in issuer_pubkeys {
                h.update(pk);
            }
            for id in issuer_ids {
                h.update(id.to_le_bytes());
            }
            let mut buf = [0u8; 32];
            active_bitmask.to_little_endian(&mut buf);
            h.update(buf);
            h.update(active_count.to_le_bytes());
            h.update(threshold.to_le_bytes());
            h.update(chain_id.to_le_bytes());
            h.update(mirror_address.as_bytes());
        }
        P2PMessage::MirrorSyncSign {
            signer_id,
            signer_index,
            nonce,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"MirrorSyncSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(nonce.to_le_bytes());
        }
        // ── Vision tick consensus (T-32) ──────────────────────────
        P2PMessage::VisionTickProposal {
            leader_id,
            batch_id,
            tick_id,
            result_hash,
            player_balances,
            reference_nonce: _, // exclude from equivocation hash
            leader_signature: _, // exclude BLS sig
        } => {
            h.update(b"VisionTickProposal");
            h.update(leader_id);
            h.update(batch_id.to_le_bytes());
            h.update(tick_id.to_le_bytes());
            h.update(result_hash.as_bytes());
            for (addr, bal) in player_balances {
                h.update(addr.as_bytes());
                let mut buf = [0u8; 32];
                bal.to_little_endian(&mut buf);
                h.update(buf);
            }
        }
        P2PMessage::VisionTickSign {
            signer_id,
            signer_index,
            batch_id,
            tick_id,
            signature: _, // exclude BLS sig
        } => {
            h.update(b"VisionTickSign");
            h.update(signer_id);
            h.update([*signer_index]);
            h.update(batch_id.to_le_bytes());
            h.update(tick_id.to_le_bytes());
        }
    }

    h.finalize().into()
}

/// Returns a static tag identifying the P2PMessage variant. Used as part
/// of the equivocation detector key so different message types within the
/// same (cycle, phase) are tracked independently.
pub fn msg_variant_tag(msg: &P2PMessage) -> &'static str {
    match msg {
        P2PMessage::CycleStart { .. } => "CycleStart",
        P2PMessage::PriceProposal { .. } => "PriceProposal",
        P2PMessage::PriceVote { .. } => "PriceVote",
        P2PMessage::BatchProposal { .. } => "BatchProposal",
        P2PMessage::BatchSign { .. } => "BatchSign",
        P2PMessage::ItpCreationProposal { .. } => "ItpCreationProposal",
        P2PMessage::ItpCreationSign { .. } => "ItpCreationSign",
        P2PMessage::RebalanceRequestProposal { .. } => "RebalanceRequestProposal",
        P2PMessage::RebalanceRequestSign { .. } => "RebalanceRequestSign",
        P2PMessage::BridgeSettlementToL3Proposal { .. } => "BridgeSettlementToL3Proposal",
        P2PMessage::BridgeSettlementToL3Sign { .. } => "BridgeSettlementToL3Sign",
        P2PMessage::SubmitOrderForUserProposal { .. } => "SubmitOrderForUserProposal",
        P2PMessage::SubmitOrderForUserSign { .. } => "SubmitOrderForUserSign",
        P2PMessage::ConfirmBatchProposal { .. } => "ConfirmBatchProposal",
        P2PMessage::ConfirmBatchSign { .. } => "ConfirmBatchSign",
        P2PMessage::ConfirmFillsProposal { .. } => "ConfirmFillsProposal",
        P2PMessage::ConfirmFillsSign { .. } => "ConfirmFillsSign",
        P2PMessage::BridgeL3ToSettlementProposal { .. } => "BridgeL3ToSettlementProposal",
        P2PMessage::BridgeL3ToSettlementSign { .. } => "BridgeL3ToSettlementSign",
        P2PMessage::ReleaseToVaultProposal { .. } => "ReleaseToVaultProposal",
        P2PMessage::ReleaseToVaultSign { .. } => "ReleaseToVaultSign",
        P2PMessage::RebalanceBatchProposal { .. } => "RebalanceBatchProposal",
        P2PMessage::RebalanceBatchSign { .. } => "RebalanceBatchSign",
        P2PMessage::UpdateWeightsProposal { .. } => "UpdateWeightsProposal",
        P2PMessage::UpdateWeightsSign { .. } => "UpdateWeightsSign",
        P2PMessage::RebalanceProposal { .. } => "RebalanceProposal",
        P2PMessage::RebalanceSign { .. } => "RebalanceSign",
        P2PMessage::SubmitSellOrderProposal { .. } => "SubmitSellOrderProposal",
        P2PMessage::SubmitSellOrderSign { .. } => "SubmitSellOrderSign",
        P2PMessage::CompleteSellOrderProposal { .. } => "CompleteSellOrderProposal",
        P2PMessage::CompleteSellOrderSign { .. } => "CompleteSellOrderSign",
        P2PMessage::AssetTradesProposal { .. } => "AssetTradesProposal",
        P2PMessage::AssetTradesSign { .. } => "AssetTradesSign",
        P2PMessage::RecordCollateralMoveProposal { .. } => "RecordCollateralMoveProposal",
        P2PMessage::RecordCollateralMoveSign { .. } => "RecordCollateralMoveSign",
        P2PMessage::MintBridgedSharesProposal { .. } => "MintBridgedSharesProposal",
        P2PMessage::MintBridgedSharesSign { .. } => "MintBridgedSharesSign",
        P2PMessage::CompleteBuyOrderProposal { .. } => "CompleteBuyOrderProposal",
        P2PMessage::CompleteBuyOrderSign { .. } => "CompleteBuyOrderSign",
        P2PMessage::SetItpNavProposal { .. } => "SetItpNavProposal",
        P2PMessage::SetItpNavSign { .. } => "SetItpNavSign",
        P2PMessage::NavOracleProposal { .. } => "NavOracleProposal",
        P2PMessage::NavOracleSign { .. } => "NavOracleSign",
        P2PMessage::Heartbeat { .. } => "Heartbeat",
        P2PMessage::KickVote { .. } => "KickVote",
        P2PMessage::ArbitrationPriceProposal { .. } => "ArbitrationPriceProposal",
        P2PMessage::ArbitrationPriceVote { .. } => "ArbitrationPriceVote",
        P2PMessage::ArbitrationResolutionSign { .. } => "ArbitrationResolutionSign",
        P2PMessage::BatchConfigProposal { .. } => "BatchConfigProposal",
        P2PMessage::BatchConfigSign { .. } => "BatchConfigSign",
        P2PMessage::MirrorSyncProposal { .. } => "MirrorSyncProposal",
        P2PMessage::MirrorSyncSign { .. } => "MirrorSyncSign",
        P2PMessage::VisionTickProposal { .. } => "VisionTickProposal",
        P2PMessage::VisionTickSign { .. } => "VisionTickSign",
    }
}

/// Returns `true` if the message is a vote or sign variant (not a proposal
/// or control message). Equivocation checks apply only to these.
pub fn is_vote_or_sign(msg: &P2PMessage) -> bool {
    matches!(
        msg,
        P2PMessage::PriceVote { .. }
            | P2PMessage::BatchSign { .. }
            | P2PMessage::ItpCreationSign { .. }
            | P2PMessage::RebalanceRequestSign { .. }
            | P2PMessage::BridgeSettlementToL3Sign { .. }
            | P2PMessage::SubmitOrderForUserSign { .. }
            | P2PMessage::ConfirmBatchSign { .. }
            | P2PMessage::ConfirmFillsSign { .. }
            | P2PMessage::BridgeL3ToSettlementSign { .. }
            | P2PMessage::ReleaseToVaultSign { .. }
            | P2PMessage::RebalanceBatchSign { .. }
            | P2PMessage::UpdateWeightsSign { .. }
            | P2PMessage::RebalanceSign { .. }
            | P2PMessage::SubmitSellOrderSign { .. }
            | P2PMessage::CompleteSellOrderSign { .. }
            | P2PMessage::AssetTradesSign { .. }
            | P2PMessage::RecordCollateralMoveSign { .. }
            | P2PMessage::MintBridgedSharesSign { .. }
            | P2PMessage::CompleteBuyOrderSign { .. }
            | P2PMessage::SetItpNavSign { .. }
            | P2PMessage::NavOracleSign { .. }
            | P2PMessage::ArbitrationPriceVote { .. }
            | P2PMessage::ArbitrationResolutionSign { .. }
            | P2PMessage::BatchConfigSign { .. }
            | P2PMessage::MirrorSyncSign { .. }
            | P2PMessage::VisionTickSign { .. }
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::types::BLSSignature;
    use ethers::types::U256;

    #[test]
    fn same_vote_no_equivocation() {
        let det = EquivocationDetector::new();
        let peer = [1u8; 32];

        let msg = P2PMessage::PriceVote {
            cycle_number: 10,
            voter_id: peer,
            approved: true,
            signature: BLSSignature(vec![0xAA]),
        };

        let hash = content_hash(&msg);
        assert!(!det.check(&peer, 10, ConsensusPhase::PriceVoting, "PriceVote", "price", hash));
        // Same message again: not equivocation
        assert!(!det.check(&peer, 10, ConsensusPhase::PriceVoting, "PriceVote", "price", hash));
    }

    #[test]
    fn different_vote_is_equivocation() {
        let det = EquivocationDetector::new();
        let peer = [2u8; 32];

        let msg1 = P2PMessage::PriceVote {
            cycle_number: 10,
            voter_id: peer,
            approved: true,
            signature: BLSSignature(vec![0xAA]),
        };
        let msg2 = P2PMessage::PriceVote {
            cycle_number: 10,
            voter_id: peer,
            approved: false, // different vote!
            signature: BLSSignature(vec![0xBB]),
        };

        let h1 = content_hash(&msg1);
        let h2 = content_hash(&msg2);
        assert_ne!(h1, h2);

        assert!(!det.check(&peer, 10, ConsensusPhase::PriceVoting, "PriceVote", "price", h1));
        // Second different hash → equivocation
        assert!(det.check(&peer, 10, ConsensusPhase::PriceVoting, "PriceVote", "price", h2));
    }

    #[test]
    fn different_cycles_are_independent() {
        let det = EquivocationDetector::new();
        let peer = [3u8; 32];

        let hash_a = [0xAAu8; 32];
        let hash_b = [0xBBu8; 32];

        assert!(!det.check(&peer, 10, ConsensusPhase::PriceVoting, "PriceVote", "price", hash_a));
        // Different cycle → independent, not equivocation
        assert!(!det.check(&peer, 11, ConsensusPhase::PriceVoting, "PriceVote", "price", hash_b));
    }

    #[test]
    fn gc_removes_old_entries() {
        let det = EquivocationDetector::new();
        let peer = [4u8; 32];

        det.check(&peer, 5, ConsensusPhase::PriceVoting, "PriceVote", "price", [0xAA; 32]);
        det.check(&peer, 10, ConsensusPhase::PriceVoting, "PriceVote", "price", [0xBB; 32]);
        assert_eq!(det.len(), 2);

        det.gc(10);
        // cycle 5 is older than 10-2=8 → removed
        assert_eq!(det.len(), 1);
    }

    #[test]
    fn signature_excluded_from_hash() {
        // Two messages with same semantic content but different BLS signatures
        // should produce the same content hash.
        let msg1 = P2PMessage::PriceVote {
            cycle_number: 42,
            voter_id: [5u8; 32],
            approved: true,
            signature: BLSSignature(vec![0x01, 0x02, 0x03]),
        };
        let msg2 = P2PMessage::PriceVote {
            cycle_number: 42,
            voter_id: [5u8; 32],
            approved: true,
            signature: BLSSignature(vec![0xFF, 0xFE, 0xFD]),
        };
        assert_eq!(content_hash(&msg1), content_hash(&msg2));
    }

    #[test]
    fn is_vote_or_sign_correct() {
        let vote = P2PMessage::PriceVote {
            cycle_number: 1,
            voter_id: [0u8; 32],
            approved: true,
            signature: BLSSignature(vec![]),
        };
        assert!(is_vote_or_sign(&vote));

        let proposal = P2PMessage::PriceProposal {
            cycle_number: 1,
            prices: vec![],
            reference_nonce: 0,
            proposer_signature: BLSSignature(vec![]),
        };
        assert!(!is_vote_or_sign(&proposal));

        let heartbeat = P2PMessage::Heartbeat {
            sender_id: [0u8; 32],
            timestamp: 0,
        };
        assert!(!is_vote_or_sign(&heartbeat));
    }

    #[test]
    fn batch_sign_hash_differs_by_cycle() {
        let msg1 = P2PMessage::BatchSign {
            cycle_number: 10,
            signer_id: [6u8; 32],
            signature: BLSSignature(vec![0x01]),
        };
        let msg2 = P2PMessage::BatchSign {
            cycle_number: 11,
            signer_id: [6u8; 32],
            signature: BLSSignature(vec![0x01]),
        };
        assert_ne!(content_hash(&msg1), content_hash(&msg2));
    }

    #[test]
    fn gc_by_size_drops_oldest_cycle() {
        let det = EquivocationDetector::new();
        let peer = [7u8; 32];

        // Insert entries in 3 different cycles
        det.check(&peer, 1, ConsensusPhase::PriceVoting, "PriceVote", "price", [0x01; 32]);
        det.check(&peer, 2, ConsensusPhase::PriceVoting, "PriceVote", "price", [0x02; 32]);
        det.check(&peer, 3, ConsensusPhase::PriceVoting, "PriceVote", "price", [0x03; 32]);
        assert_eq!(det.len(), 3);

        // gc_by_size with max_entries=2 should drop cycle 1
        det.gc_by_size(2);
        assert_eq!(det.len(), 2);
    }

    #[test]
    fn content_hash_proposal_and_sign_differ() {
        // Even for the same ITP ID, proposal and sign should hash differently
        let proposal = P2PMessage::SetItpNavProposal {
            leader_id: [1u8; 32],
            itp_id: ethers::types::H256::from([0xAB; 32]),
            nav: U256::from(1_000_000_000_000_000_000u64),
            reference_nonce: 0,
            leader_signature: BLSSignature(vec![]),
        };
        let sign = P2PMessage::SetItpNavSign {
            signer_id: [1u8; 32],
            signer_index: 0,
            itp_id: ethers::types::H256::from([0xAB; 32]),
            signature: BLSSignature(vec![]),
        };
        assert_ne!(content_hash(&proposal), content_hash(&sign));
    }
}
