//! Bridge orchestration module for cross-chain USDC bridging
//!
//! This module implements BLS consensus-based bridging from Arbitrum to L3:
//! - `BridgeOrchestrator` - orchestrates the bridge flow with BLS consensus
//! - `BridgeConfig` - configuration for bridge contracts and timeouts
//! - `SignatureCollector` - collects follower signatures for threshold aggregation
//! - `CrossChainOrderReader` - trait for reading orders from Arbitrum
//!
//! Story 7.2: Bridge USDC Orchestrator (Arb→L3)
//! Story 7.3: Submit Order for User
//! Story 7.4: Batch and Fill Orchestration
//! Story 7.5: Bridge USDC L3 to Arbitrum
//! Story 7.6: Custody Release to MockBitgetVault

mod orchestrator;
mod types;
pub mod watchdog;

pub use orchestrator::{BridgeOrchestrator, CrossChainOrderReader};
pub use types::{
    // Story 7.2: Bridge Arb→L3
    build_bridge_arb_to_l3_hash, BridgeConfig, BridgeError, BridgeOrderStatus, BridgeProposal,
    BridgeResult, SignatureCollector,
    // Cross-chain sell from Arb
    build_sell_bridge_hash, SellBridgeProposal, build_complete_sell_order_calldata,
    build_complete_sell_order_consensus_hash, SellSubmitOrderResult, CompleteSellOrderResult,
    CompleteSellProposal,
    // Story 7.3: Submit Order for User
    build_erc20_approve_calldata, build_submit_order_calldata, build_submit_order_hash,
    OrderMapping, SubmitOrderProposal, SubmitOrderResult,
    // Story 7.4: Batch and Fill Orchestration
    build_confirm_batch_calldata, build_confirm_batch_hash, build_confirm_fills_calldata,
    build_confirm_fills_hash, BatchProposal, BatchResult, Fill, FillsProposal, FillsResult,
    // Story 7.5: Bridge USDC L3 to Arbitrum
    build_bridge_l3_to_arb_hash, BridgeL3ToArbProposal, BridgeL3ToArbResult,
    // Story 7.6: Custody Release to MockBitgetVault
    build_erc20_transfer_calldata, build_release_to_vault_hash, ReleaseToVaultProposal,
    ReleaseToVaultResult,
    // Story 7-6b: USDC Decimal Conversion
    build_usdc_transfer_calldata, build_usdc_transfer_calldata_with_amount,
    // Story 7-14: Rebalance consensus
    build_rebalance_batch_hash, build_confirm_rebalance_batch_calldata,
    build_update_weights_hash, build_update_weights_calldata,
    RebalanceBatchResult, UpdateWeightsResult,
    // Single-phase rebalance (replaces 2-phase for on-chain call)
    build_rebalance_hash, build_rebalance_calldata, RebalanceResult,
    // NAV push
    build_set_itp_nav_calldata, build_set_itp_nav_hash, SetItpNavResult,
    // Issuer-driven per-asset settlement
    AssetTrade, AssetTradesProposal, AssetTradesResult,
    build_emit_asset_trades_hash, build_emit_asset_trades_calldata,
    // Cross-chain buy completion
    build_complete_buy_order_hash, CompleteBuyOrderResult,
    // 8-step bridge: RecordCollateralMove + MintBridgedShares
    build_record_collateral_move_hash, build_record_collateral_move_calldata,
    RecordCollateralMoveProposal, RecordCollateralMoveResult,
    build_mint_bridged_shares_hash, build_mint_bridged_shares_calldata,
    MintBridgedSharesProposal, MintBridgedSharesResult,
};
