//! P2P message topic classification.
//!
//! The transport is a single TCP fabric, not pubsub. "Topic" here is a
//! receive-side routing tag: it lets the dispatcher fan messages out to
//! parallel worker tasks so that vision co-signs do not queue behind a slow
//! ITP/mirror/price handler.
//!
//! Two classes:
//! - [`Topic::Consensus`] — prices, batches, fills, bridge, mirror, ITP NAV.
//! - [`Topic::Vision`]    — `VisionCreateBatch*` and `NavOracle*`.
//!
//! The split is purely about *who runs the handler*. Wire format, signing,
//! quorum math are unchanged.
//!
//! Names match the deferred-mode spec for the two gossipsub topics that would
//! exist if this were libp2p: `gm-consensus` and `gm-vision`. The strings are
//! kept in [`Topic::name`] so logs and metrics align with that vocabulary.

use common::types::P2PMessage;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Topic {
    Consensus,
    Vision,
}

impl Topic {
    pub const fn name(&self) -> &'static str {
        match self {
            Topic::Consensus => "gm-consensus",
            Topic::Vision => "gm-vision",
        }
    }
}

/// Classify a P2P message by routing topic.
///
/// Vision topic: every surviving `Vision*` proposal/sign plus the per-ITP
/// `NavOracle*` cycle. NavOracle rides on vision because it is independent
/// of bridge/batch hot paths — folding it here keeps the consensus worker
/// focused on price + bridge + mirror.
///
/// The round-only purge stripped the old `VisionTick*`, `VisionCreditBalance*`,
/// deposit/refund/withdraw, balance-proof, and bitmap-gossip variants. What
/// remains on the vision side is the `createBatch` co-sign and NAV oracle —
/// exactly the messages that were missing their 15s window.
///
/// Consensus topic: everything else.
pub fn topic_for(msg: &P2PMessage) -> Topic {
    match msg {
        P2PMessage::VisionCreateBatchProposal { .. }
        | P2PMessage::VisionCreateBatchSign { .. }
        | P2PMessage::NavOracleProposal { .. }
        | P2PMessage::NavOracleSign { .. } => Topic::Vision,
        _ => Topic::Consensus,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::types::{BLSSignature, PeerId};
    use ethers::types::{Address, H256};

    fn peer() -> PeerId {
        [0u8; 32]
    }

    #[test]
    fn price_messages_route_to_consensus() {
        let m = P2PMessage::PriceProposal {
            cycle_number: 1,
            prices: vec![],
            reference_nonce: 0,
            proposer_signature: BLSSignature(vec![]),
        };
        assert_eq!(topic_for(&m), Topic::Consensus);
        assert_eq!(Topic::Consensus.name(), "gm-consensus");
    }

    #[test]
    fn vision_create_batch_routes_to_vision() {
        let m = P2PMessage::VisionCreateBatchProposal {
            leader_id: peer(),
            source_name: "x".into(),
            source_id: H256::zero(),
            config_hash: H256::zero(),
            tick_duration: 0,
            lock_offset: 0,
            settlement_grace: 0,
            message_hash: H256::zero(),
            leader_signature: BLSSignature(vec![]),
            reference_nonce: 0,
        };
        assert_eq!(topic_for(&m), Topic::Vision);
        assert_eq!(Topic::Vision.name(), "gm-vision");
    }

    #[test]
    fn nav_oracle_routes_to_vision() {
        let m = P2PMessage::NavOracleSign {
            signer_id: peer(),
            signer_index: 0,
            itp_address: Address::zero(),
            signature: BLSSignature(vec![]),
        };
        assert_eq!(topic_for(&m), Topic::Vision);
    }

    #[test]
    fn batch_sign_routes_to_consensus() {
        let m = P2PMessage::BatchSign {
            cycle_number: 0,
            signer_id: peer(),
            signature: BLSSignature(vec![]),
        };
        assert_eq!(topic_for(&m), Topic::Consensus);
    }
}
