//! Consensus message handling
//!
//! Routes incoming P2P messages to appropriate consensus handlers.

use common::types::{BLSSignature as P2PBLSSignature, P2PMessage, PeerId};
use ethers::types::{Address, H256, U256};
use tracing::{debug, trace, warn};

use super::state::ConsensusPhase;

/// Handler for consensus-related P2P messages
#[derive(Debug, Default)]
pub struct ConsensusMessageHandler {
    /// Messages received for future cycles (buffer for out-of-order delivery)
    pending_messages: Vec<(PeerId, P2PMessage, u64)>, // (from, message, cycle_number)
}

impl ConsensusMessageHandler {
    /// Create a new message handler
    pub fn new() -> Self {
        Self {
            pending_messages: Vec::new(),
        }
    }

    /// Handle an incoming P2P message for consensus
    ///
    /// Returns the appropriate action to take based on message type and current state.
    pub fn handle_message(
        &mut self,
        from: PeerId,
        message: P2PMessage,
        current_cycle: u64,
        current_phase: ConsensusPhase,
    ) -> MessageHandleResult {
        match message {
            P2PMessage::PriceProposal { cycle_number, .. } => {
                self.handle_price_proposal(from, message, cycle_number, current_cycle, current_phase)
            }
            P2PMessage::PriceVote { cycle_number, .. } => {
                self.handle_price_vote(from, message, cycle_number, current_cycle, current_phase)
            }
            P2PMessage::BatchProposal { cycle_number, .. } => {
                self.handle_batch_proposal(from, message, cycle_number, current_cycle, current_phase)
            }
            P2PMessage::BatchSign { cycle_number, .. } => {
                self.handle_batch_sign(from, message, cycle_number, current_cycle, current_phase)
            }
            P2PMessage::ItpCreationProposal {
                leader_id,
                admin,
                nonce,
                name,
                symbol,
                weights,
                assets,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    nonce = %nonce,
                    "Received ItpCreationProposal"
                );
                MessageHandleResult::ProcessItpCreationProposal {
                    from,
                    leader_id,
                    admin,
                    nonce,
                    name,
                    symbol,
                    weights,
                    assets,
                    leader_signature,
                }
            }
            P2PMessage::ItpCreationSign { signer_id, signer_index, nonce, signature } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    nonce = %nonce,
                    "Received ItpCreationSign"
                );
                // Use signer_id from message for identification
                MessageHandleResult::ProcessItpCreationSign {
                    from: signer_id,
                    signer_index,
                    nonce,
                    signature,
                }
            }
            // Story 7.2: Bridge Settlement→L3 orchestration messages
            P2PMessage::BridgeSettlementToL3Proposal {
                leader_id,
                order_id,
                itp_id,
                user,
                amount,
                deadline,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    order_id = %order_id,
                    itp_id = ?itp_id,
                    "Received BridgeSettlementToL3Proposal"
                );
                MessageHandleResult::ProcessBridgeSettlementToL3Proposal {
                    from,
                    leader_id,
                    order_id,
                    itp_id,
                    user,
                    amount,
                    deadline,
                    leader_signature,
                }
            }
            P2PMessage::BridgeSettlementToL3Sign {
                signer_id,
                signer_index,
                order_id,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    order_id = %order_id,
                    "Received BridgeSettlementToL3Sign"
                );
                // Use signer_id from message for identification
                MessageHandleResult::ProcessBridgeSettlementToL3Sign {
                    from: signer_id,
                    signer_index,
                    order_id,
                    signature,
                }
            }
            // Story 7.3: Submit Order for User messages
            P2PMessage::SubmitOrderForUserProposal {
                leader_id,
                settlement_order_id,
                itp_id,
                user,
                amount,
                limit_price,
                slippage_tier,
                deadline,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    settlement_order_id = %settlement_order_id,
                    itp_id = ?itp_id,
                    "Received SubmitOrderForUserProposal"
                );
                MessageHandleResult::ProcessSubmitOrderForUserProposal {
                    from,
                    leader_id,
                    settlement_order_id,
                    itp_id,
                    user,
                    amount,
                    limit_price,
                    slippage_tier,
                    deadline,
                    leader_signature,
                }
            }
            P2PMessage::SubmitOrderForUserSign {
                signer_id,
                signer_index,
                settlement_order_id,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    settlement_order_id = %settlement_order_id,
                    "Received SubmitOrderForUserSign"
                );
                // Use signer_id from message for identification
                MessageHandleResult::ProcessSubmitOrderForUserSign {
                    from: signer_id,
                    signer_index,
                    settlement_order_id,
                    signature,
                }
            }
            // Story 7.4: Batch and Fill confirmation messages
            P2PMessage::ConfirmBatchProposal {
                leader_id,
                cycle_number,
                order_ids,
                prices,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    cycle_number,
                    num_orders = order_ids.len(),
                    "Received ConfirmBatchProposal"
                );
                MessageHandleResult::ProcessConfirmBatchProposal {
                    from,
                    leader_id,
                    cycle_number,
                    order_ids,
                    prices,
                    leader_signature,
                }
            }
            P2PMessage::ConfirmBatchSign {
                signer_id,
                signer_index,
                cycle_number,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    cycle_number,
                    "Received ConfirmBatchSign"
                );
                // Use signer_id from message for identification
                MessageHandleResult::ProcessConfirmBatchSign {
                    from: signer_id,
                    signer_index,
                    cycle_number,
                    signature,
                }
            }
            P2PMessage::ConfirmFillsProposal {
                leader_id,
                cycle_number,
                fills,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    cycle_number,
                    num_fills = fills.len(),
                    "Received ConfirmFillsProposal"
                );
                MessageHandleResult::ProcessConfirmFillsProposal {
                    from,
                    leader_id,
                    cycle_number,
                    fills,
                    leader_signature,
                }
            }
            P2PMessage::ConfirmFillsSign {
                signer_id,
                signer_index,
                cycle_number,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    cycle_number,
                    "Received ConfirmFillsSign"
                );
                // Use signer_id from message for identification
                MessageHandleResult::ProcessConfirmFillsSign {
                    from: signer_id,
                    signer_index,
                    cycle_number,
                    signature,
                }
            }
            // Story 7.5: Bridge L3→Settlement messages
            P2PMessage::BridgeL3ToSettlementProposal {
                leader_id,
                cycle_number,
                order_ids,
                total_amount,
                destination,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    cycle_number,
                    num_orders = order_ids.len(),
                    total_amount = %total_amount,
                    "Received BridgeL3ToSettlementProposal"
                );
                MessageHandleResult::ProcessBridgeL3ToSettlementProposal {
                    from,
                    leader_id,
                    cycle_number,
                    order_ids,
                    total_amount,
                    destination,
                    leader_signature,
                }
            }
            P2PMessage::BridgeL3ToSettlementSign {
                signer_id,
                signer_index,
                cycle_number,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    cycle_number,
                    "Received BridgeL3ToSettlementSign"
                );
                // Use signer_id from message for identification
                MessageHandleResult::ProcessBridgeL3ToSettlementSign {
                    from: signer_id,
                    signer_index,
                    cycle_number,
                    signature,
                }
            }
            // Story 7.6: Custody release to vault messages
            P2PMessage::ReleaseToVaultProposal {
                leader_id,
                cycle_number,
                order_ids,
                total_amount,
                vault_address,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    cycle_number,
                    num_orders = order_ids.len(),
                    total_amount = %total_amount,
                    ?vault_address,
                    "Received ReleaseToVaultProposal"
                );
                MessageHandleResult::ProcessReleaseToVaultProposal {
                    from,
                    leader_id,
                    cycle_number,
                    order_ids,
                    total_amount,
                    vault_address,
                    leader_signature,
                }
            }
            P2PMessage::ReleaseToVaultSign {
                signer_id,
                signer_index,
                cycle_number,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    cycle_number,
                    "Received ReleaseToVaultSign"
                );
                // Use signer_id from message for identification
                MessageHandleResult::ProcessReleaseToVaultSign {
                    from: signer_id,
                    signer_index,
                    cycle_number,
                    signature,
                }
            }
            // Story 7-14: Rebalance batch messages
            P2PMessage::RebalanceBatchProposal {
                leader_id,
                cycle_number,
                itp_ids,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    cycle_number,
                    num_itps = itp_ids.len(),
                    "Received RebalanceBatchProposal"
                );
                MessageHandleResult::ProcessRebalanceBatchProposal {
                    from,
                    leader_id,
                    cycle_number,
                    itp_ids,
                    leader_signature,
                }
            }
            P2PMessage::RebalanceBatchSign {
                signer_id,
                signer_index,
                cycle_number,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    cycle_number,
                    "Received RebalanceBatchSign"
                );
                MessageHandleResult::ProcessRebalanceBatchSign {
                    from: signer_id,
                    signer_index,
                    cycle_number,
                    signature,
                }
            }
            // Story 7-14: Update weights messages
            P2PMessage::UpdateWeightsProposal {
                leader_id,
                itp_id,
                new_weights,
                new_inventory,
                nav,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    ?itp_id,
                    num_weights = new_weights.len(),
                    num_inventory = new_inventory.len(),
                    nav = %nav,
                    "Received UpdateWeightsProposal"
                );
                MessageHandleResult::ProcessUpdateWeightsProposal {
                    from,
                    leader_id,
                    itp_id,
                    new_weights,
                    new_inventory,
                    nav,
                    leader_signature,
                }
            }
            P2PMessage::UpdateWeightsSign {
                signer_id,
                signer_index,
                itp_id,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    ?itp_id,
                    "Received UpdateWeightsSign"
                );
                MessageHandleResult::ProcessUpdateWeightsSign {
                    from: signer_id,
                    signer_index,
                    itp_id,
                    signature,
                }
            }
            // Single-phase rebalance messages
            P2PMessage::RebalanceProposal {
                leader_id,
                itp_id,
                remove_indices,
                add_assets,
                new_weights,
                prices,
                quote_tokens,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    ?itp_id,
                    weight_count = new_weights.len(),
                    "Received RebalanceProposal"
                );
                MessageHandleResult::ProcessRebalanceProposal {
                    from,
                    leader_id,
                    itp_id,
                    remove_indices,
                    add_assets,
                    new_weights,
                    prices,
                    quote_tokens,
                    leader_signature,
                }
            }
            P2PMessage::RebalanceSign {
                signer_id,
                signer_index,
                itp_id,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    ?itp_id,
                    "Received RebalanceSign"
                );
                MessageHandleResult::ProcessRebalanceSign {
                    from: signer_id,
                    signer_index,
                    itp_id,
                    signature,
                }
            }
            P2PMessage::AssetTradesProposal {
                leader_id,
                cycle_number,
                trades_data,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    cycle_number,
                    trade_count = trades_data.len(),
                    "Received AssetTradesProposal"
                );
                MessageHandleResult::ProcessAssetTradesProposal {
                    from,
                    leader_id,
                    cycle_number,
                    trades_data,
                    leader_signature,
                }
            }
            P2PMessage::AssetTradesSign {
                signer_id,
                signer_index,
                cycle_number,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    cycle_number,
                    "Received AssetTradesSign"
                );
                MessageHandleResult::ProcessAssetTradesSign {
                    from: signer_id,
                    signer_index,
                    cycle_number,
                    signature,
                }
            }
            // Cross-chain sell flow messages
            P2PMessage::SubmitSellOrderProposal {
                leader_id,
                order_id,
                itp_id,
                user,
                bridged_itp_address,
                amount,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    order_id = %order_id,
                    itp_id = ?itp_id,
                    "Received SubmitSellOrderProposal"
                );
                MessageHandleResult::ProcessSubmitSellOrderProposal {
                    from,
                    leader_id,
                    order_id,
                    itp_id,
                    user,
                    bridged_itp_address,
                    amount,
                    leader_signature,
                }
            }
            P2PMessage::SubmitSellOrderSign {
                signer_id,
                signer_index,
                order_id,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    order_id = %order_id,
                    "Received SubmitSellOrderSign"
                );
                MessageHandleResult::ProcessSubmitSellOrderSign {
                    from: signer_id,
                    signer_index,
                    order_id,
                    signature,
                }
            }
            P2PMessage::CompleteSellOrderProposal {
                leader_id,
                order_id,
                usdc_proceeds,
                vault,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    order_id = %order_id,
                    usdc_proceeds = %usdc_proceeds,
                    ?vault,
                    "Received CompleteSellOrderProposal"
                );
                MessageHandleResult::ProcessCompleteSellOrderProposal {
                    from,
                    leader_id,
                    order_id,
                    usdc_proceeds,
                    vault,
                    leader_signature,
                }
            }
            P2PMessage::CompleteSellOrderSign {
                signer_id,
                signer_index,
                order_id,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    order_id = %order_id,
                    "Received CompleteSellOrderSign"
                );
                MessageHandleResult::ProcessCompleteSellOrderSign {
                    from: signer_id,
                    signer_index,
                    order_id,
                    signature,
                }
            }
            P2PMessage::BurnSellOrderProposal {
                leader_id,
                order_id,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?leader_id,
                    ?order_id,
                    "Received burn sell order proposal"
                );
                MessageHandleResult::ProcessBurnSellOrderProposal {
                    from,
                    leader_id,
                    order_id,
                    leader_signature,
                }
            }
            P2PMessage::BurnSellOrderSign {
                signer_id,
                signer_index,
                order_id,
                signature,
            } => {
                debug!(
                    ?signer_id,
                    signer_index,
                    ?order_id,
                    "Received burn sell order signature"
                );
                MessageHandleResult::ProcessBurnSellOrderSign {
                    from: signer_id,
                    signer_index,
                    order_id,
                    signature,
                }
            }
            // 8-step bridge: RecordCollateralMove consensus messages
            P2PMessage::RecordCollateralMoveProposal {
                leader_id,
                cycle_number,
                itp_id,
                from_chain,
                to_chain,
                amount,
                tx_type,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    cycle_number,
                    itp_id = ?itp_id,
                    "Received RecordCollateralMoveProposal"
                );
                MessageHandleResult::ProcessRecordCollateralMoveProposal {
                    from,
                    leader_id,
                    cycle_number,
                    itp_id,
                    from_chain,
                    to_chain,
                    amount,
                    tx_type,
                    leader_signature,
                }
            }
            P2PMessage::RecordCollateralMoveSign {
                signer_id,
                signer_index,
                cycle_number,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    cycle_number,
                    "Received RecordCollateralMoveSign"
                );
                MessageHandleResult::ProcessRecordCollateralMoveSign {
                    from: signer_id,
                    signer_index,
                    cycle_number,
                    signature,
                }
            }
            // 8-step bridge: MintBridgedShares consensus messages
            P2PMessage::MintBridgedSharesProposal {
                leader_id,
                cycle_number,
                itp_id,
                user,
                amount,
                order_id,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    cycle_number,
                    itp_id = ?itp_id,
                    "Received MintBridgedSharesProposal"
                );
                MessageHandleResult::ProcessMintBridgedSharesProposal {
                    from,
                    leader_id,
                    cycle_number,
                    itp_id,
                    user,
                    amount,
                    order_id,
                    leader_signature,
                }
            }
            P2PMessage::MintBridgedSharesSign {
                signer_id,
                signer_index,
                cycle_number,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    cycle_number,
                    "Received MintBridgedSharesSign"
                );
                MessageHandleResult::ProcessMintBridgedSharesSign {
                    from: signer_id,
                    signer_index,
                    cycle_number,
                    signature,
                }
            }
            // completeBuyOrder BLS consensus messages
            P2PMessage::CompleteBuyOrderProposal {
                leader_id,
                cycle_number,
                order_id,
                vault,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    cycle_number,
                    order_id = %order_id,
                    "Received CompleteBuyOrderProposal"
                );
                MessageHandleResult::ProcessCompleteBuyOrderProposal {
                    from,
                    leader_id,
                    cycle_number,
                    order_id,
                    vault,
                    leader_signature,
                }
            }
            P2PMessage::CompleteBuyOrderSign {
                signer_id,
                signer_index,
                cycle_number,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    cycle_number,
                    "Received CompleteBuyOrderSign"
                );
                MessageHandleResult::ProcessCompleteBuyOrderSign {
                    from: signer_id,
                    signer_index,
                    cycle_number,
                    signature,
                }
            }
            // Rebalance NAV consensus: setItpNav
            P2PMessage::SetItpNavProposal {
                leader_id,
                itp_id,
                nav,
                reference_nonce: _,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    ?itp_id,
                    nav = %nav,
                    "Received SetItpNavProposal"
                );
                MessageHandleResult::ProcessSetItpNavProposal {
                    from,
                    leader_id,
                    itp_id,
                    nav,
                    leader_signature,
                }
            }
            P2PMessage::SetItpNavSign {
                signer_id,
                signer_index,
                itp_id,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    ?itp_id,
                    "Received SetItpNavSign"
                );
                MessageHandleResult::ProcessSetItpNavSign {
                    from: signer_id,
                    signer_index,
                    itp_id,
                    signature,
                }
            }
            // NAV oracle price update (Settlement ITPNAVOracle)
            P2PMessage::NavOracleProposal {
                leader_id,
                itp_address,
                oracle_address,
                nav_price,
                timestamp,
                cycle_number,
                chain_id,
                reference_nonce,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    ?itp_address,
                    nav_price = %nav_price,
                    cycle_number,
                    "Received NavOracleProposal"
                );
                MessageHandleResult::ProcessNavOracleProposal {
                    from,
                    leader_id,
                    itp_address,
                    oracle_address,
                    nav_price,
                    timestamp,
                    cycle_number,
                    chain_id,
                    reference_nonce,
                    leader_signature,
                }
            }
            P2PMessage::NavOracleSign {
                signer_id,
                signer_index,
                itp_address,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    ?itp_address,
                    "Received NavOracleSign"
                );
                MessageHandleResult::ProcessNavOracleSign {
                    from: signer_id,
                    signer_index,
                    itp_address,
                    signature,
                }
            }
            // MirrorOracleRegistry sync (Step 12)
            P2PMessage::MirrorSyncProposal {
                leader_id,
                nonce,
                oracle_pubkeys,
                oracle_ids,
                active_bitmask,
                active_count,
                threshold,
                chain_id,
                mirror_address,
                reference_nonce,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    nonce,
                    active_count,
                    "Received MirrorSyncProposal"
                );
                MessageHandleResult::ProcessMirrorSyncProposal {
                    from,
                    leader_id,
                    nonce,
                    oracle_pubkeys,
                    oracle_ids,
                    active_bitmask,
                    active_count,
                    threshold,
                    chain_id,
                    mirror_address,
                    reference_nonce,
                    leader_signature,
                }
            }
            P2PMessage::MirrorSyncSign {
                signer_id,
                signer_index,
                nonce,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    nonce,
                    "Received MirrorSyncSign"
                );
                MessageHandleResult::ProcessMirrorSyncSign {
                    from: signer_id,
                    signer_index,
                    nonce,
                    signature,
                }
            }
            // Vision deposit/withdraw consensus messages
            P2PMessage::VisionCreditBalanceProposal {
                leader_id,
                order_id,
                user,
                amount,
                message_hash,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    order_id,
                    ?user,
                    amount = %amount,
                    "Received VisionCreditBalanceProposal"
                );
                MessageHandleResult::ProcessVisionCreditBalanceProposal {
                    from,
                    leader_id,
                    order_id,
                    user,
                    amount,
                    message_hash,
                    leader_signature,
                }
            }
            P2PMessage::VisionCreditBalanceSign {
                signer_id,
                signer_index,
                order_id,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    order_id,
                    "Received VisionCreditBalanceSign"
                );
                MessageHandleResult::ProcessVisionCreditBalanceSign {
                    from: signer_id,
                    signer_id,
                    signer_index,
                    order_id,
                    signature,
                }
            }
            P2PMessage::VisionCompleteDepositProposal {
                leader_id,
                order_id,
                message_hash,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    order_id,
                    "Received VisionCompleteDepositProposal"
                );
                MessageHandleResult::ProcessVisionCompleteDepositProposal {
                    from,
                    leader_id,
                    order_id,
                    message_hash,
                    leader_signature,
                }
            }
            P2PMessage::VisionCompleteDepositSign {
                signer_id,
                signer_index,
                order_id,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    order_id,
                    "Received VisionCompleteDepositSign"
                );
                MessageHandleResult::ProcessVisionCompleteDepositSign {
                    from: signer_id,
                    signer_id,
                    signer_index,
                    order_id,
                    signature,
                }
            }
            P2PMessage::VisionRefundDepositProposal {
                leader_id,
                order_id,
                message_hash,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    order_id,
                    "Received VisionRefundDepositProposal"
                );
                MessageHandleResult::ProcessVisionRefundDepositProposal {
                    from,
                    leader_id,
                    order_id,
                    message_hash,
                    leader_signature,
                }
            }
            P2PMessage::VisionRefundDepositSign {
                signer_id,
                signer_index,
                order_id,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    order_id,
                    "Received VisionRefundDepositSign"
                );
                MessageHandleResult::ProcessVisionRefundDepositSign {
                    from: signer_id,
                    signer_id,
                    signer_index,
                    order_id,
                    signature,
                }
            }
            P2PMessage::VisionCompleteWithdrawProposal {
                leader_id,
                withdraw_id,
                user,
                amount,
                message_hash,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    withdraw_id,
                    ?user,
                    amount = %amount,
                    "Received VisionCompleteWithdrawProposal"
                );
                MessageHandleResult::ProcessVisionCompleteWithdrawProposal {
                    from,
                    leader_id,
                    withdraw_id,
                    user,
                    amount,
                    message_hash,
                    leader_signature,
                }
            }
            P2PMessage::VisionCompleteWithdrawSign {
                signer_id,
                signer_index,
                withdraw_id,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    withdraw_id,
                    "Received VisionCompleteWithdrawSign"
                );
                MessageHandleResult::ProcessVisionCompleteWithdrawSign {
                    from: signer_id,
                    signer_id,
                    signer_index,
                    withdraw_id,
                    signature,
                }
            }
            P2PMessage::VisionCreateBatchProposal {
                leader_id,
                source_name,
                source_id,
                config_hash,
                tick_duration,
                lock_offset,
                message_hash,
                leader_signature,
                reference_nonce,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    %source_name,
                    ?source_id,
                    "Received VisionCreateBatchProposal"
                );
                MessageHandleResult::ProcessVisionCreateBatchProposal {
                    from,
                    leader_id,
                    source_name,
                    source_id,
                    config_hash,
                    tick_duration,
                    lock_offset,
                    message_hash,
                    leader_signature,
                    reference_nonce,
                }
            }
            P2PMessage::VisionCreateBatchSign {
                signer_id,
                signer_index,
                source_id,
                message_hash,
                signature,
            } => {
                debug!(
                    ?from,
                    ?signer_id,
                    signer_index,
                    ?source_id,
                    "Received VisionCreateBatchSign"
                );
                MessageHandleResult::ProcessVisionCreateBatchSign {
                    from: signer_id,
                    signer_id,
                    signer_index,
                    source_id,
                    message_hash,
                    signature,
                }
            }
            P2PMessage::VisionBalanceProofsBatch {
                batch_id,
                tick_id,
                proofs,
                signer_index,
            } => {
                debug!(
                    ?from,
                    batch_id,
                    tick_id,
                    num_proofs = proofs.len(),
                    signer_index,
                    "Received VisionBalanceProofsBatch"
                );
                MessageHandleResult::ProcessVisionBalanceProofsBatch {
                    from,
                    batch_id,
                    tick_id,
                    proofs,
                    signer_index,
                }
            }
            // AA keeper arbitration messages — forward to arbitration subsystem
            P2PMessage::ArbitrationPriceProposal { .. }
            | P2PMessage::ArbitrationPriceVote { .. }
            | P2PMessage::ArbitrationResolutionSign { .. } => {
                debug!(?from, "Forwarding arbitration message to subsystem");
                MessageHandleResult::ForwardToArbitration(message)
            }
            // Vision bitmap gossip — forward to bitmap gossip handler
            P2PMessage::BitmapGossip {
                batch_id,
                player,
                bitmap_hash,
                config_hash,
                target_tick_id,
            } => {
                debug!(
                    ?from,
                    batch_id,
                    ?player,
                    ?bitmap_hash,
                    "Received BitmapGossip"
                );
                MessageHandleResult::ProcessBitmapGossip {
                    from,
                    batch_id,
                    player,
                    bitmap_hash,
                    config_hash,
                    target_tick_id,
                }
            }
            P2PMessage::BitmapRequest {
                batch_id,
                player,
                bitmap_hash,
            } => {
                debug!(
                    ?from,
                    batch_id,
                    ?player,
                    ?bitmap_hash,
                    "Received BitmapRequest"
                );
                MessageHandleResult::ProcessBitmapRequest {
                    from,
                    batch_id,
                    player,
                    bitmap_hash,
                }
            }
            P2PMessage::BitmapResponse {
                batch_id,
                player,
                bitmap,
                bitmap_hash,
                config_hash,
                target_tick_id,
            } => {
                debug!(
                    ?from,
                    batch_id,
                    ?player,
                    ?bitmap_hash,
                    bitmap_len = bitmap.len(),
                    "Received BitmapResponse"
                );
                MessageHandleResult::ProcessBitmapResponse {
                    from,
                    batch_id,
                    player,
                    bitmap,
                    bitmap_hash,
                    config_hash,
                    target_tick_id,
                }
            }
            _ => {
                trace!(?from, "Non-consensus message received");
                MessageHandleResult::Ignored
            }
        }
    }

    fn handle_price_proposal(
        &mut self,
        from: PeerId,
        message: P2PMessage,
        msg_cycle: u64,
        current_cycle: u64,
        current_phase: ConsensusPhase,
    ) -> MessageHandleResult {
        debug!(
            ?from,
            msg_cycle,
            current_cycle,
            ?current_phase,
            "Received PriceProposal"
        );

        // Check cycle number
        if msg_cycle < current_cycle {
            debug!(msg_cycle, current_cycle, "Stale PriceProposal, discarding");
            return MessageHandleResult::Stale;
        }

        if msg_cycle > current_cycle {
            debug!(
                msg_cycle,
                current_cycle, "Future PriceProposal, buffering"
            );
            self.pending_messages.push((from, message, msg_cycle));
            return MessageHandleResult::Buffered;
        }

        // Message is for current cycle
        if let P2PMessage::PriceProposal {
            cycle_number,
            prices,
            proposer_signature,
            ..
        } = message
        {
            MessageHandleResult::ProcessPriceProposal {
                from,
                cycle_number,
                prices,
                proposer_signature,
            }
        } else {
            MessageHandleResult::Ignored
        }
    }

    fn handle_price_vote(
        &mut self,
        from: PeerId,
        message: P2PMessage,
        msg_cycle: u64,
        current_cycle: u64,
        current_phase: ConsensusPhase,
    ) -> MessageHandleResult {
        debug!(
            ?from,
            msg_cycle,
            current_cycle,
            ?current_phase,
            "Received PriceVote"
        );

        // Check cycle number
        if msg_cycle != current_cycle {
            if msg_cycle < current_cycle {
                debug!(msg_cycle, current_cycle, "Stale PriceVote, discarding");
                return MessageHandleResult::Stale;
            } else {
                debug!(msg_cycle, current_cycle, "Future PriceVote, buffering");
                self.pending_messages.push((from, message, msg_cycle));
                return MessageHandleResult::Buffered;
            }
        }

        // Check phase
        if current_phase != ConsensusPhase::PriceVoting
            && current_phase != ConsensusPhase::PriceProposal
        {
            debug!(
                ?current_phase,
                "PriceVote received in unexpected phase"
            );
            return MessageHandleResult::UnexpectedPhase;
        }

        if let P2PMessage::PriceVote {
            voter_id,
            approved,
            signature,
            ..
        } = message
        {
            MessageHandleResult::ProcessPriceVote {
                from: voter_id,
                approved,
                signature,
            }
        } else {
            MessageHandleResult::Ignored
        }
    }

    fn handle_batch_proposal(
        &mut self,
        from: PeerId,
        message: P2PMessage,
        msg_cycle: u64,
        current_cycle: u64,
        current_phase: ConsensusPhase,
    ) -> MessageHandleResult {
        debug!(
            ?from,
            msg_cycle,
            current_cycle,
            ?current_phase,
            "Received BatchProposal"
        );

        // Check cycle number
        if msg_cycle != current_cycle {
            if msg_cycle < current_cycle {
                debug!(msg_cycle, current_cycle, "Stale BatchProposal, discarding");
                return MessageHandleResult::Stale;
            } else {
                debug!(
                    msg_cycle,
                    current_cycle, "Future BatchProposal, buffering"
                );
                self.pending_messages.push((from, message, msg_cycle));
                return MessageHandleResult::Buffered;
            }
        }

        if let P2PMessage::BatchProposal {
            order_ids,
            fills,
            proposer_signature,
            ..
        } = message
        {
            MessageHandleResult::ProcessBatchProposal {
                from,
                order_ids,
                fills,
                proposer_signature,
            }
        } else {
            MessageHandleResult::Ignored
        }
    }

    fn handle_batch_sign(
        &mut self,
        from: PeerId,
        message: P2PMessage,
        msg_cycle: u64,
        current_cycle: u64,
        current_phase: ConsensusPhase,
    ) -> MessageHandleResult {
        debug!(
            ?from,
            msg_cycle,
            current_cycle,
            ?current_phase,
            "Received BatchSign"
        );

        // Check cycle number
        if msg_cycle != current_cycle {
            if msg_cycle < current_cycle {
                debug!(msg_cycle, current_cycle, "Stale BatchSign, discarding");
                return MessageHandleResult::Stale;
            } else {
                debug!(msg_cycle, current_cycle, "Future BatchSign, buffering");
                self.pending_messages.push((from, message, msg_cycle));
                return MessageHandleResult::Buffered;
            }
        }

        // Check phase
        if current_phase != ConsensusPhase::BatchSigning
            && current_phase != ConsensusPhase::BatchProposal
        {
            warn!(?current_phase, "BatchSign received in unexpected phase");
            return MessageHandleResult::UnexpectedPhase;
        }

        if let P2PMessage::BatchSign {
            signer_id,
            signature,
            ..
        } = message
        {
            MessageHandleResult::ProcessBatchSign {
                from: signer_id,
                signature,
            }
        } else {
            MessageHandleResult::Ignored
        }
    }

    /// Get buffered messages for a specific cycle
    pub fn get_buffered_for_cycle(&mut self, cycle: u64) -> Vec<(PeerId, P2PMessage)> {
        let (for_cycle, rest): (Vec<_>, Vec<_>) = self
            .pending_messages
            .drain(..)
            .partition(|(_, _, msg_cycle)| *msg_cycle == cycle);

        self.pending_messages = rest;

        for_cycle
            .into_iter()
            .map(|(from, msg, _)| (from, msg))
            .collect()
    }

    /// Clear all buffered messages older than the given cycle
    pub fn clear_stale_messages(&mut self, current_cycle: u64) {
        self.pending_messages
            .retain(|(_, _, cycle)| *cycle >= current_cycle);
    }

    /// Get count of buffered messages
    pub fn buffered_count(&self) -> usize {
        self.pending_messages.len()
    }
}

/// Result of handling a consensus message
#[derive(Debug)]
pub enum MessageHandleResult {
    /// Message was ignored (not a consensus message)
    Ignored,
    /// Message was stale (for a past cycle)
    Stale,
    /// Message was buffered for a future cycle
    Buffered,
    /// Message received in unexpected phase
    UnexpectedPhase,
    /// Process a price proposal from the leader
    ProcessPriceProposal {
        from: PeerId,
        cycle_number: u64,
        prices: Vec<(u32, ethers::types::U256)>,
        proposer_signature: P2PBLSSignature,
    },
    /// Process a price vote from a follower
    ProcessPriceVote {
        from: PeerId,
        approved: bool,
        signature: P2PBLSSignature,
    },
    /// Process a batch proposal from the leader
    ProcessBatchProposal {
        from: PeerId,
        order_ids: Vec<u64>,
        fills: Vec<common::Fill>,
        proposer_signature: P2PBLSSignature,
    },
    /// Process a batch signature from a follower
    ProcessBatchSign {
        from: PeerId,
        signature: P2PBLSSignature,
    },
    /// Process an ITP creation proposal from the leader (Story 6.21)
    ProcessItpCreationProposal {
        from: PeerId,
        leader_id: PeerId,
        admin: Address,
        nonce: U256,
        name: String,
        symbol: String,
        weights: Vec<U256>,
        assets: Vec<Address>,
        leader_signature: P2PBLSSignature,
    },
    /// Process an ITP creation signature from a follower (Story 6.21)
    ProcessItpCreationSign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        nonce: U256,
        signature: P2PBLSSignature,
    },
    /// Process a bridge Settlement→L3 proposal from the leader (Story 7.2)
    ProcessBridgeSettlementToL3Proposal {
        from: PeerId,
        leader_id: PeerId,
        order_id: U256,
        itp_id: H256,
        user: Address,
        amount: U256,
        deadline: U256,
        leader_signature: P2PBLSSignature,
    },
    /// Process a bridge Settlement→L3 signature from a follower (Story 7.2)
    ProcessBridgeSettlementToL3Sign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        order_id: U256,
        signature: P2PBLSSignature,
    },
    /// Process a submit order proposal from the leader (Story 7.3)
    ProcessSubmitOrderForUserProposal {
        from: PeerId,
        leader_id: PeerId,
        settlement_order_id: U256,
        itp_id: H256,
        user: Address,
        amount: U256,
        limit_price: U256,
        slippage_tier: U256,
        deadline: U256,
        leader_signature: P2PBLSSignature,
    },
    /// Process a submit order signature from a follower (Story 7.3)
    ProcessSubmitOrderForUserSign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        settlement_order_id: U256,
        signature: P2PBLSSignature,
    },
    /// Process a confirm batch proposal from the leader (Story 7.4)
    ProcessConfirmBatchProposal {
        from: PeerId,
        leader_id: PeerId,
        cycle_number: u64,
        order_ids: Vec<U256>,
        prices: Vec<U256>,
        leader_signature: P2PBLSSignature,
    },
    /// Process a confirm batch signature from a follower (Story 7.4)
    ProcessConfirmBatchSign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        cycle_number: u64,
        signature: P2PBLSSignature,
    },
    /// Process a confirm fills proposal from the leader (Story 7.4)
    ProcessConfirmFillsProposal {
        from: PeerId,
        leader_id: PeerId,
        cycle_number: u64,
        fills: Vec<common::types::OrderFill>,
        leader_signature: P2PBLSSignature,
    },
    /// Process a confirm fills signature from a follower (Story 7.4)
    ProcessConfirmFillsSign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        cycle_number: u64,
        signature: P2PBLSSignature,
    },
    /// Process a bridge L3→Settlement proposal from the leader (Story 7.5)
    ProcessBridgeL3ToSettlementProposal {
        from: PeerId,
        leader_id: PeerId,
        cycle_number: u64,
        order_ids: Vec<U256>,
        total_amount: U256,
        destination: Address,
        leader_signature: P2PBLSSignature,
    },
    /// Process a bridge L3→Settlement signature from a follower (Story 7.5)
    ProcessBridgeL3ToSettlementSign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        cycle_number: u64,
        signature: P2PBLSSignature,
    },
    /// Process a custody release to vault proposal from the leader (Story 7.6)
    ProcessReleaseToVaultProposal {
        from: PeerId,
        leader_id: PeerId,
        cycle_number: u64,
        order_ids: Vec<U256>,
        total_amount: U256,
        vault_address: Address,
        leader_signature: P2PBLSSignature,
    },
    /// Process a custody release to vault signature from a follower (Story 7.6)
    ProcessReleaseToVaultSign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        cycle_number: u64,
        signature: P2PBLSSignature,
    },
    /// Process a rebalance batch proposal from the leader (Story 7-14)
    ProcessRebalanceBatchProposal {
        from: PeerId,
        leader_id: PeerId,
        cycle_number: u64,
        itp_ids: Vec<H256>,
        leader_signature: P2PBLSSignature,
    },
    /// Process a rebalance batch signature from a follower (Story 7-14)
    ProcessRebalanceBatchSign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        cycle_number: u64,
        signature: P2PBLSSignature,
    },
    /// Process an update weights proposal from the leader (Story 7-14)
    ProcessUpdateWeightsProposal {
        from: PeerId,
        leader_id: PeerId,
        itp_id: H256,
        new_weights: Vec<U256>,
        new_inventory: Vec<U256>,
        nav: U256,
        leader_signature: P2PBLSSignature,
    },
    /// Process an update weights signature from a follower (Story 7-14)
    ProcessUpdateWeightsSign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        itp_id: H256,
        signature: P2PBLSSignature,
    },
    /// Process a single-phase rebalance proposal from the leader
    ProcessRebalanceProposal {
        from: PeerId,
        leader_id: PeerId,
        itp_id: H256,
        remove_indices: Vec<U256>,
        add_assets: Vec<Address>,
        new_weights: Vec<U256>,
        prices: Vec<U256>,
        quote_tokens: Vec<Address>,
        leader_signature: P2PBLSSignature,
    },
    /// Process a single-phase rebalance signature from a follower
    ProcessRebalanceSign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        itp_id: H256,
        signature: P2PBLSSignature,
    },
    /// Process an asset trades proposal from the leader (oracle-driven settlement)
    ProcessAssetTradesProposal {
        from: PeerId,
        leader_id: PeerId,
        cycle_number: u64,
        trades_data: Vec<(Address, u8, U256, U256, Address)>,
        leader_signature: P2PBLSSignature,
    },
    /// Process an asset trades signature from a follower (oracle-driven settlement)
    ProcessAssetTradesSign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        cycle_number: u64,
        signature: P2PBLSSignature,
    },
    /// Process a submit sell order proposal from the leader (cross-chain sell)
    ProcessSubmitSellOrderProposal {
        from: PeerId,
        leader_id: PeerId,
        order_id: U256,
        itp_id: H256,
        user: Address,
        bridged_itp_address: Address,
        amount: U256,
        leader_signature: P2PBLSSignature,
    },
    /// Process a submit sell order signature from a follower (cross-chain sell)
    ProcessSubmitSellOrderSign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        order_id: U256,
        signature: P2PBLSSignature,
    },
    /// Process a complete sell order proposal from the leader (cross-chain sell)
    ProcessCompleteSellOrderProposal {
        from: PeerId,
        leader_id: PeerId,
        order_id: U256,
        usdc_proceeds: U256,
        vault: Address,
        leader_signature: P2PBLSSignature,
    },
    /// Process a complete sell order signature from a follower (cross-chain sell)
    ProcessCompleteSellOrderSign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        order_id: U256,
        signature: P2PBLSSignature,
    },
    /// Process a burn sell order proposal
    ProcessBurnSellOrderProposal {
        from: PeerId,
        leader_id: PeerId,
        order_id: U256,
        leader_signature: P2PBLSSignature,
    },
    /// Process a burn sell order signature
    ProcessBurnSellOrderSign {
        from: PeerId,
        /// Signer's index in the oracle set (for bitmap calculation)
        signer_index: u8,
        order_id: U256,
        signature: P2PBLSSignature,
    },
    // 8-step bridge: RecordCollateralMove
    ProcessRecordCollateralMoveProposal {
        from: PeerId,
        leader_id: PeerId,
        cycle_number: u64,
        itp_id: H256,
        from_chain: U256,
        to_chain: U256,
        amount: U256,
        tx_type: u8,
        leader_signature: P2PBLSSignature,
    },
    ProcessRecordCollateralMoveSign {
        from: PeerId,
        signer_index: u8,
        cycle_number: u64,
        signature: P2PBLSSignature,
    },
    // 8-step bridge: MintBridgedShares
    ProcessMintBridgedSharesProposal {
        from: PeerId,
        leader_id: PeerId,
        cycle_number: u64,
        itp_id: H256,
        user: Address,
        amount: U256,
        order_id: U256,
        leader_signature: P2PBLSSignature,
    },
    ProcessMintBridgedSharesSign {
        from: PeerId,
        signer_index: u8,
        cycle_number: u64,
        signature: P2PBLSSignature,
    },
    // completeBuyOrder BLS consensus
    ProcessCompleteBuyOrderProposal {
        from: PeerId,
        leader_id: PeerId,
        cycle_number: u64,
        order_id: U256,
        vault: Address,
        leader_signature: P2PBLSSignature,
    },
    ProcessCompleteBuyOrderSign {
        from: PeerId,
        signer_index: u8,
        cycle_number: u64,
        signature: P2PBLSSignature,
    },
    /// Process a setItpNav proposal from the leader (rebalance NAV consensus)
    ProcessSetItpNavProposal {
        from: PeerId,
        leader_id: PeerId,
        itp_id: H256,
        nav: U256,
        leader_signature: P2PBLSSignature,
    },
    /// Process a setItpNav signature from a follower (rebalance NAV consensus)
    ProcessSetItpNavSign {
        from: PeerId,
        signer_index: u8,
        itp_id: H256,
        signature: P2PBLSSignature,
    },
    /// Process a NAV oracle proposal from the leader (Settlement ITPNAVOracle)
    ProcessNavOracleProposal {
        from: PeerId,
        leader_id: PeerId,
        itp_address: Address,
        oracle_address: Address,
        nav_price: U256,
        timestamp: u64,
        cycle_number: u64,
        chain_id: u64,
        reference_nonce: u64,
        leader_signature: P2PBLSSignature,
    },
    /// Process a NAV oracle signature from a follower (Settlement ITPNAVOracle)
    ProcessNavOracleSign {
        from: PeerId,
        signer_index: u8,
        itp_address: Address,
        signature: P2PBLSSignature,
    },
    /// Process a MirrorOracleRegistry sync proposal from the leader (Step 12)
    ProcessMirrorSyncProposal {
        from: PeerId,
        leader_id: PeerId,
        nonce: u64,
        oracle_pubkeys: Vec<Vec<u8>>,
        oracle_ids: Vec<u64>,
        active_bitmask: U256,
        active_count: u64,
        threshold: u64,
        chain_id: u64,
        mirror_address: Address,
        reference_nonce: u64,
        leader_signature: P2PBLSSignature,
    },
    /// Process a MirrorOracleRegistry sync signature from a follower (Step 12)
    ProcessMirrorSyncSign {
        from: PeerId,
        signer_index: u8,
        nonce: u64,
        signature: P2PBLSSignature,
    },
    // Vision deposit/withdraw consensus
    ProcessVisionCreditBalanceProposal {
        from: PeerId,
        leader_id: PeerId,
        order_id: u64,
        user: Address,
        amount: U256,
        message_hash: H256,
        leader_signature: P2PBLSSignature,
    },
    ProcessVisionCreditBalanceSign {
        from: PeerId,
        signer_id: PeerId,
        signer_index: u8,
        order_id: u64,
        signature: P2PBLSSignature,
    },
    ProcessVisionCompleteDepositProposal {
        from: PeerId,
        leader_id: PeerId,
        order_id: u64,
        message_hash: H256,
        leader_signature: P2PBLSSignature,
    },
    ProcessVisionCompleteDepositSign {
        from: PeerId,
        signer_id: PeerId,
        signer_index: u8,
        order_id: u64,
        signature: P2PBLSSignature,
    },
    ProcessVisionRefundDepositProposal {
        from: PeerId,
        leader_id: PeerId,
        order_id: u64,
        message_hash: H256,
        leader_signature: P2PBLSSignature,
    },
    ProcessVisionRefundDepositSign {
        from: PeerId,
        signer_id: PeerId,
        signer_index: u8,
        order_id: u64,
        signature: P2PBLSSignature,
    },
    ProcessVisionCompleteWithdrawProposal {
        from: PeerId,
        leader_id: PeerId,
        withdraw_id: u64,
        user: Address,
        amount: U256,
        message_hash: H256,
        leader_signature: P2PBLSSignature,
    },
    ProcessVisionCompleteWithdrawSign {
        from: PeerId,
        signer_id: PeerId,
        signer_index: u8,
        withdraw_id: u64,
        signature: P2PBLSSignature,
    },
    ProcessVisionBalanceProofsBatch {
        from: PeerId,
        batch_id: u64,
        tick_id: u64,
        proofs: Vec<(Address, U256, P2PBLSSignature)>,
        signer_index: u8,
    },
    ProcessVisionCreateBatchProposal {
        from: PeerId,
        leader_id: PeerId,
        source_name: String,
        source_id: H256,
        config_hash: H256,
        tick_duration: u64,
        lock_offset: u64,
        message_hash: H256,
        leader_signature: P2PBLSSignature,
        reference_nonce: u64,
    },
    ProcessVisionCreateBatchSign {
        from: PeerId,
        signer_id: PeerId,
        signer_index: u8,
        source_id: H256,
        message_hash: H256,
        signature: P2PBLSSignature,
    },
    /// Forward arbitration message to arbitration subsystem
    ForwardToArbitration(P2PMessage),
    /// Process a BitmapGossip announcement from a peer.
    /// Receiver checks if it already has the bitmap and, if not, issues a BitmapRequest.
    ProcessBitmapGossip {
        from: PeerId,
        batch_id: u64,
        player: Address,
        bitmap_hash: H256,
        config_hash: H256,
        target_tick_id: u64,
    },
    /// Process a BitmapRequest from a peer that wants our bitmap bytes.
    ProcessBitmapRequest {
        from: PeerId,
        batch_id: u64,
        player: Address,
        bitmap_hash: H256,
    },
    /// Process a BitmapResponse — full bitmap sent by a peer after our BitmapRequest.
    ProcessBitmapResponse {
        from: PeerId,
        batch_id: u64,
        player: Address,
        bitmap: Vec<u8>,
        bitmap_hash: H256,
        config_hash: H256,
        target_tick_id: u64,
    },
}

impl MessageHandleResult {
    /// Extract the sender PeerId if this is a proposal variant (leader-originated message).
    ///
    /// Returns `Some(peer_id)` for all `Process*Proposal` variants, `None` for votes,
    /// signatures, and non-actionable results (Stale, Buffered, etc.).
    /// Used by `ConsensusProtocol::handle_message` to verify leader identity before processing.
    pub fn proposal_sender(&self) -> Option<PeerId> {
        match self {
            Self::ProcessPriceProposal { from, .. } => Some(*from),
            Self::ProcessBatchProposal { from, .. } => Some(*from),
            Self::ProcessItpCreationProposal { from, .. } => Some(*from),
            Self::ProcessBridgeSettlementToL3Proposal { from, .. } => Some(*from),
            Self::ProcessSubmitOrderForUserProposal { from, .. } => Some(*from),
            Self::ProcessConfirmBatchProposal { from, .. } => Some(*from),
            Self::ProcessConfirmFillsProposal { from, .. } => Some(*from),
            Self::ProcessBridgeL3ToSettlementProposal { from, .. } => Some(*from),
            Self::ProcessReleaseToVaultProposal { from, .. } => Some(*from),
            Self::ProcessRebalanceBatchProposal { from, .. } => Some(*from),
            Self::ProcessUpdateWeightsProposal { from, .. } => Some(*from),
            Self::ProcessRebalanceProposal { from, .. } => Some(*from),
            Self::ProcessAssetTradesProposal { from, .. } => Some(*from),
            Self::ProcessSubmitSellOrderProposal { from, .. } => Some(*from),
            Self::ProcessCompleteSellOrderProposal { from, .. } => Some(*from),
            Self::ProcessBurnSellOrderProposal { from, .. } => Some(*from),
            Self::ProcessRecordCollateralMoveProposal { from, .. } => Some(*from),
            Self::ProcessMintBridgedSharesProposal { from, .. } => Some(*from),
            Self::ProcessCompleteBuyOrderProposal { from, .. } => Some(*from),
            Self::ProcessSetItpNavProposal { from, .. } => Some(*from),
            Self::ProcessNavOracleProposal { from, .. } => Some(*from),
            Self::ProcessMirrorSyncProposal { from, .. } => Some(*from),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::BLSSignature as TestBLSSignature;
    use ethers::types::U256;

    fn test_peer_id(n: u8) -> PeerId {
        let mut id = [0u8; 32];
        id[0] = n;
        id
    }

    fn make_price_proposal(cycle: u64) -> P2PMessage {
        P2PMessage::PriceProposal {
            cycle_number: cycle,
            prices: vec![(1, U256::from(1000))],
            reference_nonce: 0,
            proposer_signature: TestBLSSignature(vec![0; 64]),
        }
    }

    fn make_price_vote(cycle: u64, approved: bool) -> P2PMessage {
        P2PMessage::PriceVote {
            cycle_number: cycle,
            voter_id: test_peer_id(1),
            approved,
            signature: TestBLSSignature(vec![0; 64]),
        }
    }

    fn make_batch_proposal(cycle: u64) -> P2PMessage {
        P2PMessage::BatchProposal {
            cycle_number: cycle,
            order_ids: vec![1, 2, 3],
            fills: vec![],
            reference_nonce: 0,
            proposer_signature: TestBLSSignature(vec![0; 64]),
        }
    }

    fn make_batch_sign(cycle: u64) -> P2PMessage {
        P2PMessage::BatchSign {
            cycle_number: cycle,
            signer_id: test_peer_id(1),
            signature: TestBLSSignature(vec![0; 64]),
        }
    }

    #[test]
    fn test_handle_price_proposal_current_cycle() {
        let mut handler = ConsensusMessageHandler::new();
        let msg = make_price_proposal(10);

        let result = handler.handle_message(
            test_peer_id(1),
            msg,
            10,
            ConsensusPhase::Idle,
        );

        assert!(matches!(
            result,
            MessageHandleResult::ProcessPriceProposal { .. }
        ));
    }

    #[test]
    fn test_handle_price_proposal_stale() {
        let mut handler = ConsensusMessageHandler::new();
        let msg = make_price_proposal(5);

        let result = handler.handle_message(
            test_peer_id(1),
            msg,
            10,
            ConsensusPhase::Idle,
        );

        assert!(matches!(result, MessageHandleResult::Stale));
    }

    #[test]
    fn test_handle_price_proposal_future() {
        let mut handler = ConsensusMessageHandler::new();
        let msg = make_price_proposal(15);

        let result = handler.handle_message(
            test_peer_id(1),
            msg,
            10,
            ConsensusPhase::Idle,
        );

        assert!(matches!(result, MessageHandleResult::Buffered));
        assert_eq!(handler.buffered_count(), 1);
    }

    #[test]
    fn test_handle_price_vote_current_cycle() {
        let mut handler = ConsensusMessageHandler::new();
        let msg = make_price_vote(10, true);

        let result = handler.handle_message(
            test_peer_id(1),
            msg,
            10,
            ConsensusPhase::PriceVoting,
        );

        assert!(matches!(
            result,
            MessageHandleResult::ProcessPriceVote { approved: true, .. }
        ));
    }

    #[test]
    fn test_handle_price_vote_wrong_phase() {
        let mut handler = ConsensusMessageHandler::new();
        let msg = make_price_vote(10, true);

        let result = handler.handle_message(
            test_peer_id(1),
            msg,
            10,
            ConsensusPhase::BatchSigning,
        );

        assert!(matches!(result, MessageHandleResult::UnexpectedPhase));
    }

    #[test]
    fn test_handle_batch_proposal() {
        let mut handler = ConsensusMessageHandler::new();
        let msg = make_batch_proposal(10);

        let result = handler.handle_message(
            test_peer_id(1),
            msg,
            10,
            ConsensusPhase::BatchProposal,
        );

        assert!(matches!(
            result,
            MessageHandleResult::ProcessBatchProposal { .. }
        ));
    }

    #[test]
    fn test_handle_batch_sign() {
        let mut handler = ConsensusMessageHandler::new();
        let msg = make_batch_sign(10);

        let result = handler.handle_message(
            test_peer_id(1),
            msg,
            10,
            ConsensusPhase::BatchSigning,
        );

        assert!(matches!(
            result,
            MessageHandleResult::ProcessBatchSign { .. }
        ));
    }

    #[test]
    fn test_get_buffered_for_cycle() {
        let mut handler = ConsensusMessageHandler::new();

        // Buffer messages for different cycles
        handler.handle_message(
            test_peer_id(1),
            make_price_proposal(15),
            10,
            ConsensusPhase::Idle,
        );
        handler.handle_message(
            test_peer_id(2),
            make_price_proposal(15),
            10,
            ConsensusPhase::Idle,
        );
        handler.handle_message(
            test_peer_id(3),
            make_price_proposal(20),
            10,
            ConsensusPhase::Idle,
        );

        assert_eq!(handler.buffered_count(), 3);

        // Get messages for cycle 15
        let msgs = handler.get_buffered_for_cycle(15);
        assert_eq!(msgs.len(), 2);

        // Only cycle 20 message remains
        assert_eq!(handler.buffered_count(), 1);
    }

    #[test]
    fn test_clear_stale_messages() {
        let mut handler = ConsensusMessageHandler::new();

        // Add messages manually to pending
        handler.pending_messages.push((
            test_peer_id(1),
            make_price_proposal(5),
            5,
        ));
        handler.pending_messages.push((
            test_peer_id(2),
            make_price_proposal(10),
            10,
        ));
        handler.pending_messages.push((
            test_peer_id(3),
            make_price_proposal(15),
            15,
        ));

        handler.clear_stale_messages(10);

        assert_eq!(handler.buffered_count(), 2); // cycles 10 and 15 remain
    }

    #[test]
    fn test_non_consensus_message_ignored() {
        let mut handler = ConsensusMessageHandler::new();
        let msg = P2PMessage::Heartbeat {
            sender_id: test_peer_id(1),
            timestamp: 12345,
        };

        let result = handler.handle_message(
            test_peer_id(1),
            msg,
            10,
            ConsensusPhase::Idle,
        );

        assert!(matches!(result, MessageHandleResult::Ignored));
    }
}
