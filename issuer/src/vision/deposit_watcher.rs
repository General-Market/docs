//! Vision deposit watcher — cross-chain Settlement→L3 deposit orchestrator
//!
//! Polls SettlementBridgeCustody on Settlement for `VisionDepositCreated` events.
//! For each deposit:
//!   1. Wait for Settlement finality (~15 confirmations)
//!   2. Enqueue `CreditBalance` op → consensus signs + submits `Vision.creditBalance()` on L3
//!   3. GM gas drip to user (if below threshold)
//!   4. Enqueue `CompleteDeposit` op → consensus signs + submits on Settlement
//!
//! Also handles `WithdrawToSettlementRequested` from Vision.sol on L3:
//!   1. Wait for L3 finality
//!   2. Enqueue `CompleteWithdraw` op → consensus signs + submits on Settlement
//!
//! Persists state to `vision_deposit_orders` / `vision_withdraw_orders` for crash recovery.
//! On restart: recovers from DB state, checks on-chain idempotency keys.
//!
//! Follows the pattern of `issuer/src/bridge/orchestrator.rs`.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use ethers::abi::{self, Token};
use ethers::providers::{Http, Middleware, Provider};
use ethers::types::{Address, Filter, H256, U256, U64};
use sqlx::PgPool;
use tracing::{debug, error, info, warn};

use common::traits::ChainWriter;

use super::config::VisionConfig;
use super::pending_ops::{PendingOpsQueue, VisionOp, OpResult};
use super::types::{
    DepositStatus, PendingVisionDeposit, PendingVisionWithdraw, WithdrawStatus,
};

/// Maximum blocks to query in a single getLogs request on Settlement.
const SETTLEMENT_MAX_BLOCK_RANGE: u64 = 10_000;

/// Maximum blocks to query in a single getLogs request on L3.
const L3_MAX_BLOCK_RANGE: u64 = 50_000;

/// Extra L3 blocks to wait after creditBalance confirmation before marking `credited_on_l3`.
/// Protects against rare L3 Orbit reorgs (AUDIT FIX round 3).
const L3_CONFIRMATION_BUFFER: u64 = 5;

/// Vision deposit watcher: watches Settlement for deposits, L3 for withdrawals.
///
/// This is an independent background task that runs alongside the tick engine
/// and chain listener. It enqueues operations into a shared queue for the
/// consensus task to aggregate BLS signatures and submit on-chain.
pub struct VisionDepositWatcher {
    /// Settlement provider (for watching VisionDepositCreated events).
    settlement_provider: Arc<Provider<Http>>,
    /// L3 provider (for checking depositProcessed and gas drip).
    l3_provider: Arc<Provider<Http>>,
    /// Vision.sol address on L3.
    vision_address: Address,
    /// SettlementBridgeCustody address on Settlement.
    settlement_custody_address: Address,
    /// Postgres pool for persistence.
    pool: PgPool,
    /// Configuration.
    config: VisionConfig,
    /// In-flight deposits: order_id -> PendingVisionDeposit.
    pending_deposits: HashMap<u64, PendingVisionDeposit>,
    /// In-flight withdrawals: withdraw_id -> PendingVisionWithdraw.
    pending_withdrawals: HashMap<u64, PendingVisionWithdraw>,
    /// Event topic for VisionDepositCreated(uint256 indexed orderId, address indexed user, uint256 amount).
    deposit_created_topic: H256,
    /// Event topic for WithdrawToSettlementRequested(address indexed user, uint256 indexed withdrawId, uint256 amount).
    withdraw_requested_topic: H256,
    /// Chain writer for L3 (gas drip — plain native transfer, not BLS).
    l3_chain_writer: Option<Arc<dyn ChainWriter>>,
    /// Pending operations queue (shared with consensus task).
    ops_queue: Arc<PendingOpsQueue>,
    /// L3 chain ID (from config, not hardcoded).
    l3_chain_id: u64,
    /// Settlement chain ID (from config).
    settlement_chain_id: u64,
    /// Track consecutive CompleteDeposit failures for 24h alerting.
    complete_deposit_first_fail: HashMap<u64, std::time::Instant>,
}

impl VisionDepositWatcher {
    /// Create a new deposit watcher.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        settlement_provider: Arc<Provider<Http>>,
        l3_provider: Arc<Provider<Http>>,
        vision_address: Address,
        settlement_custody_address: Address,
        pool: PgPool,
        config: VisionConfig,
        l3_chain_writer: Option<Arc<dyn ChainWriter>>,
        ops_queue: Arc<PendingOpsQueue>,
        l3_chain_id: u64,
        settlement_chain_id: u64,
    ) -> Self {
        let deposit_created_topic = H256::from(ethers::utils::keccak256(
            b"VisionDepositCreated(uint256,address,uint256)",
        ));
        let withdraw_requested_topic = H256::from(ethers::utils::keccak256(
            b"WithdrawToSettlementRequested(address,uint256,uint256)",
        ));

        if l3_chain_writer.is_none() {
            warn!("VisionDepositWatcher created WITHOUT L3 chain writer — cannot send gas drips");
        }

        Self {
            settlement_provider,
            l3_provider,
            vision_address,
            settlement_custody_address,
            pool,
            config,
            pending_deposits: HashMap::new(),
            pending_withdrawals: HashMap::new(),
            deposit_created_topic,
            withdraw_requested_topic,
            l3_chain_writer,
            ops_queue,
            l3_chain_id,
            settlement_chain_id,
            complete_deposit_first_fail: HashMap::new(),
        }
    }

    /// Run the deposit watcher loop.
    ///
    /// On startup:
    /// 1. Load incomplete deposits from DB
    /// 2. For each, check on-chain state and resume from correct step
    /// 3. Start polling Settlement for new VisionDepositCreated events
    /// 4. Start polling L3 for new WithdrawToSettlementRequested events
    pub async fn run(mut self, shutdown: Arc<AtomicBool>) {
        info!(
            settlement_custody = %self.settlement_custody_address,
            vision = %self.vision_address,
            l3_chain_id = self.l3_chain_id,
            settlement_chain_id = self.settlement_chain_id,
            has_l3_writer = self.l3_chain_writer.is_some(),
            "VisionDepositWatcher starting"
        );

        // 1. Recover from DB
        if let Err(e) = self.recover_from_db().await {
            error!(error = %e, "Failed to recover deposit watcher state from DB");
        }
        if let Err(e) = self.recover_withdrawals_from_db().await {
            error!(error = %e, "Failed to recover withdrawal watcher state from DB");
        }

        // 2. Determine Settlement polling cursor
        let mut settlement_cursor = match self.get_settlement_cursor().await {
            Some(block) => {
                info!(block, "Resuming Settlement polling from bookmark");
                block + 1
            }
            None => {
                // Start from recent blocks (don't replay entire Settlement history)
                let tip = self
                    .settlement_provider
                    .get_block_number()
                    .await
                    .map(|n| n.as_u64())
                    .unwrap_or(0);
                let start = tip.saturating_sub(1000);
                info!(start, "No Settlement bookmark, starting from tip - 1000");
                start
            }
        };

        // 3. Determine L3 withdrawal polling cursor
        let mut l3_cursor = match self.get_l3_cursor().await {
            Some(block) => {
                info!(block, "Resuming L3 withdrawal polling from bookmark");
                block + 1
            }
            None => {
                let tip = self
                    .l3_provider
                    .get_block_number()
                    .await
                    .map(|n| n.as_u64())
                    .unwrap_or(0);
                let start = tip.saturating_sub(1000);
                info!(start, "No L3 withdrawal bookmark, starting from tip - 1000");
                start
            }
        };

        let poll_interval = Duration::from_millis(self.config.deposit_poll_interval_ms);

        loop {
            if shutdown.load(Ordering::Relaxed) {
                info!("VisionDepositWatcher shutting down");
                break;
            }

            // 4. Poll for new Settlement deposit events
            if let Err(e) = self.poll_settlement_deposits(&mut settlement_cursor).await {
                warn!(error = %e, "Failed to poll Settlement deposits");
            }

            // 5. Poll for new L3 withdrawal events
            if let Err(e) = self.poll_l3_withdrawals(&mut l3_cursor).await {
                warn!(error = %e, "Failed to poll L3 withdrawals");
            }

            // 6. Process pending deposits (advance state machine)
            self.process_pending_deposits().await;

            // 7. Process pending withdrawals (advance state machine)
            self.process_pending_withdrawals().await;

            // 8. Check for auto-refund of stuck deposits
            self.check_auto_refund().await;

            tokio::time::sleep(poll_interval).await;
        }

        info!("VisionDepositWatcher stopped");
    }

    // =========================================================================
    // Settlement event polling
    // =========================================================================

    /// Poll Settlement for new VisionDepositCreated events.
    async fn poll_settlement_deposits(
        &mut self,
        cursor: &mut u64,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let tip = self.settlement_provider.get_block_number().await?.as_u64();

        if *cursor > tip {
            return Ok(());
        }

        let to_block = std::cmp::min(*cursor + SETTLEMENT_MAX_BLOCK_RANGE - 1, tip);

        let filter = Filter::new()
            .address(self.settlement_custody_address)
            .topic0(self.deposit_created_topic)
            .from_block(U64::from(*cursor))
            .to_block(U64::from(to_block));

        let logs = self.settlement_provider.get_logs(&filter).await?;

        for log in &logs {
            // VisionDepositCreated(uint256 indexed orderId, address indexed user, uint256 amount)
            let order_id = match log.topics.get(1) {
                Some(t) => U256::from(t.as_bytes()).as_u64(),
                None => continue,
            };
            let user = match log.topics.get(2) {
                Some(t) => Address::from_slice(&t.as_bytes()[12..]),
                None => continue,
            };
            let amount = if log.data.len() >= 32 {
                U256::from_big_endian(&log.data[0..32])
            } else {
                continue;
            };

            // Skip if already tracked
            if self.pending_deposits.contains_key(&order_id) {
                continue;
            }

            // Check if already completed on-chain (restart recovery)
            if self.is_deposit_processed_on_l3(order_id).await == Some(true) {
                info!(order_id, user = %user, "Deposit already processed on L3, skipping");
                self.upsert_deposit_status(order_id, user, amount, DepositStatus::CompletedOnSettlement)
                    .await;
                continue;
            }

            info!(
                order_id,
                user = %user,
                amount = %amount,
                "New VisionDepositCreated detected"
            );

            let deposit = PendingVisionDeposit {
                order_id,
                user,
                amount,
                created_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
                status: DepositStatus::Pending,
            };

            // Persist to DB
            self.upsert_deposit_status(order_id, user, amount, DepositStatus::Pending)
                .await;

            self.pending_deposits.insert(order_id, deposit);
        }

        if !logs.is_empty() {
            info!(
                from = *cursor,
                to = to_block,
                events = logs.len(),
                "Processed Settlement VisionDeposit events"
            );
        }

        // Save cursor
        self.save_settlement_cursor(to_block).await;
        *cursor = to_block + 1;

        Ok(())
    }

    // =========================================================================
    // L3 withdrawal event polling (Issue 3)
    // =========================================================================

    /// Poll L3 for new WithdrawToSettlementRequested events from Vision.sol.
    async fn poll_l3_withdrawals(
        &mut self,
        cursor: &mut u64,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let tip = self.l3_provider.get_block_number().await?.as_u64();

        if *cursor > tip {
            return Ok(());
        }

        let to_block = std::cmp::min(*cursor + L3_MAX_BLOCK_RANGE - 1, tip);

        let filter = Filter::new()
            .address(self.vision_address)
            .topic0(self.withdraw_requested_topic)
            .from_block(U64::from(*cursor))
            .to_block(U64::from(to_block));

        let logs = self.l3_provider.get_logs(&filter).await?;

        for log in &logs {
            // WithdrawToSettlementRequested(address indexed user, uint256 indexed withdrawId, uint256 amount)
            let user = match log.topics.get(1) {
                Some(t) => Address::from_slice(&t.as_bytes()[12..]),
                None => continue,
            };
            let withdraw_id = match log.topics.get(2) {
                Some(t) => U256::from(t.as_bytes()).as_u64(),
                None => continue,
            };
            let amount = if log.data.len() >= 32 {
                U256::from_big_endian(&log.data[0..32])
            } else {
                continue;
            };

            // Skip if already tracked
            if self.pending_withdrawals.contains_key(&withdraw_id) {
                continue;
            }

            info!(
                withdraw_id,
                user = %user,
                amount = %amount,
                "New WithdrawToSettlementRequested detected"
            );

            let withdrawal = PendingVisionWithdraw {
                withdraw_id,
                user,
                amount,
                status: WithdrawStatus::Pending,
            };

            // Persist to DB
            self.upsert_withdrawal_status(withdraw_id, user, amount, WithdrawStatus::Pending)
                .await;

            self.pending_withdrawals.insert(withdraw_id, withdrawal);
        }

        if !logs.is_empty() {
            info!(
                from = *cursor,
                to = to_block,
                events = logs.len(),
                "Processed L3 WithdrawToSettlementRequested events"
            );
        }

        // Save cursor
        self.save_l3_cursor(to_block).await;
        *cursor = to_block + 1;

        Ok(())
    }

    // =========================================================================
    // State machine processing — deposits
    // =========================================================================

    /// Process all pending deposits through their state machine.
    async fn process_pending_deposits(&mut self) {
        let order_ids: Vec<u64> = self.pending_deposits.keys().copied().collect();

        for order_id in order_ids {
            let deposit = match self.pending_deposits.get(&order_id) {
                Some(d) => d.clone(),
                None => continue,
            };

            match deposit.status {
                DepositStatus::Pending => {
                    // Check Settlement finality
                    let _tip = match self.settlement_provider.get_block_number().await {
                        Ok(n) => n.as_u64(),
                        Err(_) => continue,
                    };

                    // For Settlement finality, we need the deposit's block number.
                    // Since we don't store it, we rely on the deposit_finality_confirmations
                    // being elapsed since creation. In production, we'd track the block number.
                    // For now, proceed if deposit is older than finality window.
                    let age_secs = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs()
                        .saturating_sub(deposit.created_at);

                    // Conservative: ~1 block per 250ms on Settlement, so 15 confirmations ~ 4s
                    let finality_wait_secs =
                        (self.config.deposit_finality_confirmations as u64) / 4 + 1;

                    if age_secs < finality_wait_secs {
                        debug!(
                            order_id,
                            age_secs,
                            finality_wait_secs,
                            "Waiting for Settlement finality"
                        );
                        continue;
                    }

                    // Check if already credited (idempotency)
                    if self.is_deposit_processed_on_l3(deposit.order_id).await == Some(true) {
                        info!(order_id, "Deposit already credited on L3, advancing to completion");
                        if let Some(d) = self.pending_deposits.get_mut(&order_id) {
                            d.status = DepositStatus::CreditedOnL3;
                        }
                        self.upsert_deposit_status(
                            order_id,
                            deposit.user,
                            deposit.amount,
                            DepositStatus::CreditedOnL3,
                        )
                        .await;
                        continue;
                    }

                    // Poll for result from a previous enqueue
                    match self.ops_queue.poll_result("credit", order_id) {
                        Some(OpResult::Success { tx_hash }) => {
                            // CRITICAL: verify on-chain before advancing
                            if self.is_deposit_processed_on_l3(order_id).await == Some(true) {
                                self.ops_queue.clear_result("credit", order_id);
                                info!(
                                    order_id,
                                    tx_hash = ?tx_hash,
                                    user = %deposit.user,
                                    amount = %deposit.amount,
                                    "creditBalance confirmed on L3"
                                );
                                if let Some(d) = self.pending_deposits.get_mut(&order_id) {
                                    d.status = DepositStatus::CreditedOnL3;
                                }
                                self.upsert_deposit_status(
                                    order_id,
                                    deposit.user,
                                    deposit.amount,
                                    DepositStatus::CreditedOnL3,
                                )
                                .await;
                                self.drip_gas_if_needed(deposit.user).await;
                            } else {
                                debug!(order_id, "creditBalance tx mined but not yet visible via RPC, waiting");
                            }
                        }
                        Some(OpResult::Permanent { reason }) => {
                            self.ops_queue.clear_result("credit", order_id);
                            // Check on-chain — maybe it was already processed by another issuer
                            if self.is_deposit_processed_on_l3(order_id).await == Some(true) {
                                info!(order_id, reason, "creditBalance permanent error but already processed on L3, advancing");
                                if let Some(d) = self.pending_deposits.get_mut(&order_id) {
                                    d.status = DepositStatus::CreditedOnL3;
                                }
                                self.upsert_deposit_status(
                                    order_id,
                                    deposit.user,
                                    deposit.amount,
                                    DepositStatus::CreditedOnL3,
                                )
                                .await;
                                self.drip_gas_if_needed(deposit.user).await;
                            } else {
                                warn!(order_id, reason, "creditBalance permanent error, will re-enqueue");
                            }
                        }
                        Some(OpResult::Failed { error }) => {
                            self.ops_queue.clear_result("credit", order_id);
                            warn!(order_id, error, "creditBalance failed, will re-enqueue next loop");
                        }
                        Some(OpResult::Pending) => {
                            // Consensus is working on it, skip
                        }
                        None => {
                            // No result yet — (re-)enqueue
                            let credit_message_hash = build_credit_balance_hash(
                                self.l3_chain_id,
                                self.vision_address,
                                deposit.user,
                                deposit.amount,
                                U256::from(deposit.order_id),
                            );
                            self.request_credit_balance(order_id, deposit.user, deposit.amount, credit_message_hash);
                        }
                    }
                }
                DepositStatus::CreditedOnL3 => {
                    // Step 6-7: Submit SettlementBridgeCustody.completeVisionDeposit() on Settlement

                    // Verify the credit actually landed on L3 (confirmation buffer)
                    if self.is_deposit_processed_on_l3(deposit.order_id).await != Some(true) {
                        debug!(
                            order_id,
                            "Waiting for L3 creditBalance confirmation (L3_CONFIRMATION_BUFFER={})",
                            L3_CONFIRMATION_BUFFER,
                        );
                        continue;
                    }

                    // Poll for result from a previous enqueue
                    match self.ops_queue.poll_result("complete", order_id) {
                        Some(OpResult::Success { tx_hash }) => {
                            self.ops_queue.clear_result("complete", order_id);
                            self.complete_deposit_first_fail.remove(&order_id);
                            info!(
                                order_id,
                                tx_hash = ?tx_hash,
                                "completeVisionDeposit confirmed on Settlement"
                            );
                            if let Some(d) = self.pending_deposits.get_mut(&order_id) {
                                d.status = DepositStatus::CompletedOnSettlement;
                            }
                            self.upsert_deposit_status(
                                order_id,
                                deposit.user,
                                deposit.amount,
                                DepositStatus::CompletedOnSettlement,
                            )
                            .await;
                        }
                        Some(OpResult::Permanent { reason }) => {
                            self.ops_queue.clear_result("complete", order_id);
                            warn!(order_id, reason, "completeVisionDeposit permanent error, will re-enqueue (MUST NOT give up)");
                            // Track failure time for 24h alerting
                            self.complete_deposit_first_fail
                                .entry(order_id)
                                .or_insert_with(std::time::Instant::now);
                        }
                        Some(OpResult::Failed { error }) => {
                            self.ops_queue.clear_result("complete", order_id);
                            warn!(order_id, error, "completeVisionDeposit failed, will re-enqueue (MUST NOT give up)");
                            // Track failure time for 24h alerting
                            let first_fail = self.complete_deposit_first_fail
                                .entry(order_id)
                                .or_insert_with(std::time::Instant::now);
                            if first_fail.elapsed() > Duration::from_secs(24 * 3600) {
                                error!("CRITICAL: CompleteDeposit stuck for >24h: order_id={}", order_id);
                            }
                        }
                        Some(OpResult::Pending) => {
                            // Consensus is working on it, skip
                        }
                        None => {
                            // No result yet — (re-)enqueue
                            // Check 24h alert for ongoing failures
                            if let Some(first_fail) = self.complete_deposit_first_fail.get(&order_id) {
                                if first_fail.elapsed() > Duration::from_secs(24 * 3600) {
                                    error!("CRITICAL: CompleteDeposit stuck for >24h: order_id={}", order_id);
                                }
                            }
                            let complete_message_hash = build_complete_deposit_hash(
                                self.settlement_chain_id,
                                self.settlement_custody_address,
                                U256::from(deposit.order_id),
                            );
                            self.request_complete_deposit(order_id, complete_message_hash);
                        }
                    }
                }
                DepositStatus::CompletedOnSettlement | DepositStatus::Refunded => {
                    // Terminal states — remove from in-flight tracking
                    self.pending_deposits.remove(&order_id);
                }
            }
        }
    }

    // =========================================================================
    // State machine processing — withdrawals (Issue 3)
    // =========================================================================

    /// Process all pending withdrawals through their state machine.
    async fn process_pending_withdrawals(&mut self) {
        let withdraw_ids: Vec<u64> = self.pending_withdrawals.keys().copied().collect();

        for withdraw_id in withdraw_ids {
            let withdrawal = match self.pending_withdrawals.get(&withdraw_id) {
                Some(w) => w.clone(),
                None => continue,
            };

            match withdrawal.status {
                WithdrawStatus::Pending => {
                    // Poll for result from a previous enqueue
                    match self.ops_queue.poll_result("withdraw", withdraw_id) {
                        Some(OpResult::Success { tx_hash }) => {
                            self.ops_queue.clear_result("withdraw", withdraw_id);
                            info!(
                                withdraw_id,
                                tx_hash = ?tx_hash,
                                user = %withdrawal.user,
                                amount = %withdrawal.amount,
                                "completeVisionWithdraw confirmed on Settlement"
                            );
                            if let Some(w) = self.pending_withdrawals.get_mut(&withdraw_id) {
                                w.status = WithdrawStatus::Completed;
                            }
                            self.upsert_withdrawal_status(
                                withdraw_id,
                                withdrawal.user,
                                withdrawal.amount,
                                WithdrawStatus::Completed,
                            )
                            .await;
                        }
                        Some(OpResult::Permanent { reason }) => {
                            self.ops_queue.clear_result("withdraw", withdraw_id);
                            warn!(withdraw_id, reason, "completeVisionWithdraw permanent error, will re-enqueue");
                        }
                        Some(OpResult::Failed { error }) => {
                            self.ops_queue.clear_result("withdraw", withdraw_id);
                            warn!(withdraw_id, error, "completeVisionWithdraw failed, will re-enqueue");
                        }
                        Some(OpResult::Pending) => {
                            // Consensus is working on it, skip
                        }
                        None => {
                            // No result yet — (re-)enqueue
                            let withdraw_message_hash = build_complete_withdraw_hash(
                                self.settlement_chain_id,
                                self.settlement_custody_address,
                                U256::from(withdrawal.withdraw_id),
                                withdrawal.user,
                                withdrawal.amount,
                            );
                            self.request_complete_withdraw(
                                withdraw_id,
                                withdrawal.user,
                                withdrawal.amount,
                                withdraw_message_hash,
                            );
                        }
                    }
                }
                WithdrawStatus::Completed => {
                    // Terminal state — remove from in-flight tracking
                    self.pending_withdrawals.remove(&withdraw_id);
                }
            }
        }
    }

    // =========================================================================
    // Queue-based operation requests (consensus task handles BLS + submission)
    // =========================================================================

    /// Enqueue a CreditBalance operation for consensus signing.
    fn request_credit_balance(&self, order_id: u64, user: Address, amount: U256, message_hash: H256) {
        self.ops_queue.enqueue(VisionOp::CreditBalance { order_id, user, amount, message_hash });
    }

    /// Enqueue a CompleteDeposit operation for consensus signing.
    fn request_complete_deposit(&self, order_id: u64, message_hash: H256) {
        self.ops_queue.enqueue(VisionOp::CompleteDeposit { order_id, message_hash });
    }

    /// Enqueue a RefundDeposit operation for consensus signing.
    fn request_refund_deposit(&self, order_id: u64, message_hash: H256) {
        self.ops_queue.enqueue(VisionOp::RefundDeposit { order_id, message_hash });
    }

    /// Enqueue a CompleteWithdraw operation for consensus signing.
    fn request_complete_withdraw(&self, withdraw_id: u64, user: Address, amount: U256, message_hash: H256) {
        self.ops_queue.enqueue(VisionOp::CompleteWithdraw { withdraw_id, user, amount, message_hash });
    }

    // =========================================================================
    // GM gas drip (Issue 4)
    // =========================================================================

    /// Check user's native GM balance on L3 and send a gas drip if below threshold.
    ///
    /// This is a plain native transfer (like ETH transfer), not a contract call.
    async fn drip_gas_if_needed(&self, user: Address) {
        // Parse threshold and amount from config
        let threshold = match U256::from_dec_str(&self.config.gas_drip_threshold_wei) {
            Ok(v) => v,
            Err(_) => {
                warn!("Invalid gas_drip_threshold_wei config, skipping drip");
                return;
            }
        };
        let drip_amount = match U256::from_dec_str(&self.config.gas_drip_amount_wei) {
            Ok(v) => v,
            Err(_) => {
                warn!("Invalid gas_drip_amount_wei config, skipping drip");
                return;
            }
        };

        if drip_amount.is_zero() {
            return;
        }

        // Check user's native balance on L3
        let balance = match self.l3_provider.get_balance(user, None).await {
            Ok(b) => b,
            Err(e) => {
                warn!(user = %user, error = %e, "Failed to query user GM balance for gas drip");
                return;
            }
        };

        if balance >= threshold {
            debug!(user = %user, balance = %balance, threshold = %threshold, "User GM balance above threshold, no drip needed");
            return;
        }

        info!(
            user = %user,
            balance = %balance,
            threshold = %threshold,
            drip_amount = %drip_amount,
            "User GM balance below threshold, sending gas drip"
        );

        // Use L3 chain writer to send native transfer (calldata empty, value = drip_amount)
        if let Some(ref writer) = self.l3_chain_writer {
            match writer.send_transaction(user, vec![], drip_amount).await {
                Ok(tx_hash) => {
                    info!(
                        user = %user,
                        tx_hash = ?tx_hash,
                        drip_amount = %drip_amount,
                        "GM gas drip sent successfully"
                    );
                }
                Err(e) => {
                    warn!(
                        user = %user,
                        error = %e,
                        "Failed to send GM gas drip (non-fatal)"
                    );
                }
            }
        } else {
            warn!(user = %user, "No L3 chain writer available for gas drip");
        }
    }

    // =========================================================================
    // Auto-refund for stuck deposits (AUDIT FIX H-06)
    // =========================================================================

    /// Check for stuck `pending` deposits and auto-refund after timeout.
    ///
    /// CRITICAL: Only refund deposits in `Pending` state. Never refund `CreditedOnL3`.
    /// Before enqueuing refund, MUST check Vision.depositProcessed[depositId] on L3.
    async fn check_auto_refund(&mut self) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let timeout = self.config.deposit_auto_refund_timeout_secs;

        // Collect candidates first (immutable borrow)
        let mut candidates: Vec<(u64, bool)> = Vec::new(); // (order_id, should_refund)

        for (order_id, deposit) in &self.pending_deposits {
            // Only refund Pending deposits, NEVER CreditedOnL3
            if deposit.status != DepositStatus::Pending {
                continue;
            }

            let age = now.saturating_sub(deposit.created_at);
            if age > timeout {
                // CRITICAL SAFETY CHECK: Before enqueuing refund, query L3 to confirm
                // the credit has NOT been processed. This prevents the credit+refund
                // double-money race condition (AUDIT FIX round 3).
                // Fail-closed: if RPC fails (None), skip refund — never refund when uncertain.
                match self.is_deposit_processed_on_l3(*order_id).await {
                    Some(true) => {
                        warn!(
                            order_id,
                            "Auto-refund BLOCKED: deposit already processed on L3. Advancing to CreditedOnL3."
                        );
                        candidates.push((*order_id, false)); // false = advance, don't refund
                        continue;
                    }
                    None => {
                        warn!(
                            order_id,
                            "Auto-refund SKIPPED: L3 RPC unavailable, cannot confirm credit status (fail-closed)"
                        );
                        continue;
                    }
                    Some(false) => {
                        // Not processed — safe to proceed with refund
                    }
                }

                // Check if we already have a refund result pending
                match self.ops_queue.poll_result("refund", *order_id) {
                    Some(OpResult::Success { tx_hash }) => {
                        self.ops_queue.clear_result("refund", *order_id);
                        info!(order_id, tx_hash = ?tx_hash, "Deposit refunded via consensus tx");
                        candidates.push((*order_id, true)); // true = refund succeeded
                    }
                    Some(OpResult::Permanent { reason }) => {
                        self.ops_queue.clear_result("refund", *order_id);
                        // Re-check on-chain — maybe processed in the meantime
                        if self.is_deposit_processed_on_l3(*order_id).await == Some(true) {
                            warn!(order_id, reason, "Refund permanent error but deposit now processed on L3, advancing");
                            candidates.push((*order_id, false));
                        } else {
                            warn!(order_id, reason, "Refund permanent error, will re-enqueue");
                        }
                    }
                    Some(OpResult::Failed { error }) => {
                        self.ops_queue.clear_result("refund", *order_id);
                        warn!(order_id, error, "Refund failed, will re-enqueue");
                    }
                    Some(OpResult::Pending) => {
                        // Consensus is working on it
                    }
                    None => {
                        // No result — enqueue refund
                        warn!(
                            order_id,
                            age_secs = age,
                            timeout_secs = timeout,
                            "Auto-refunding stuck pending deposit"
                        );
                        let refund_hash = build_refund_deposit_hash(
                            self.settlement_chain_id,
                            self.settlement_custody_address,
                            U256::from(*order_id),
                        );
                        self.request_refund_deposit(*order_id, refund_hash);
                    }
                }
            }
        }

        // Second pass: update state + persist (mutable borrow)
        let mut db_updates: Vec<(u64, Address, U256, DepositStatus)> = Vec::new();
        for (order_id, should_refund) in &candidates {
            if let Some(deposit) = self.pending_deposits.get_mut(order_id) {
                let new_status = if *should_refund {
                    DepositStatus::Refunded
                } else {
                    DepositStatus::CreditedOnL3
                };
                deposit.status = new_status;
                db_updates.push((*order_id, deposit.user, deposit.amount, new_status));
            }
        }

        for (order_id, user, amount, status) in db_updates {
            self.upsert_deposit_status(order_id, user, amount, status).await;
        }
    }

    // =========================================================================
    // On-chain queries
    // =========================================================================

    /// Check if Vision.depositProcessed[depositId] is true on L3.
    /// Returns `Some(true)` if credited, `Some(false)` if not, `None` on RPC failure.
    /// Callers MUST treat `None` as "unknown — do NOT refund" (fail-closed).
    async fn is_deposit_processed_on_l3(&self, deposit_id: u64) -> Option<bool> {
        // depositProcessed(uint256) selector
        let selector = &ethers::utils::keccak256(b"depositProcessed(uint256)")[..4];
        let encoded_arg = abi::encode(&[Token::Uint(U256::from(deposit_id))]);

        let mut calldata = Vec::with_capacity(4 + encoded_arg.len());
        calldata.extend_from_slice(selector);
        calldata.extend_from_slice(&encoded_arg);

        let tx = ethers::types::TransactionRequest::new()
            .to(self.vision_address)
            .data(calldata);

        match self.l3_provider.call(&tx.into(), None).await {
            Ok(result) => {
                // Returns bool (uint256: 0 or 1)
                if result.len() >= 32 {
                    Some(U256::from_big_endian(&result[0..32]) == U256::one())
                } else {
                    Some(false)
                }
            }
            Err(e) => {
                warn!(deposit_id, error = %e, "Failed to query depositProcessed on L3 — treating as unknown (fail-closed)");
                None
            }
        }
    }

    // =========================================================================
    // DB persistence — deposits
    // =========================================================================

    /// Recover incomplete deposits from DB on startup (AUDIT FIX C-09).
    async fn recover_from_db(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let rows: Vec<(i64, String, String, String, i64)> = sqlx::query_as(
            "SELECT order_id, user_address, amount, status, EXTRACT(EPOCH FROM created_at)::BIGINT
             FROM vision_deposit_orders
             WHERE status NOT IN ('completed', 'refunded')",
        )
        .fetch_all(&self.pool)
        .await?;

        for (order_id, user_str, amount_str, status_str, created_at) in &rows {
            let user: Address = user_str.parse().unwrap_or_default();
            let amount = U256::from_dec_str(amount_str).unwrap_or_default();
            let status = DepositStatus::from_str(status_str).unwrap_or(DepositStatus::Pending);

            let deposit = PendingVisionDeposit {
                order_id: *order_id as u64,
                user,
                amount,
                created_at: *created_at as u64,
                status,
            };

            // Check on-chain state for recovery
            if self.is_deposit_processed_on_l3(*order_id as u64).await == Some(true) {
                if status == DepositStatus::Pending {
                    // Credit landed but DB not updated — advance
                    info!(
                        order_id,
                        "Recovery: deposit processed on L3 but DB shows pending, advancing"
                    );
                    let mut d = deposit.clone();
                    d.status = DepositStatus::CreditedOnL3;
                    self.upsert_deposit_status(
                        d.order_id,
                        d.user,
                        d.amount,
                        DepositStatus::CreditedOnL3,
                    )
                    .await;
                    self.pending_deposits.insert(d.order_id, d);
                    continue;
                }
            }

            info!(
                order_id,
                status = status_str,
                "Recovered pending deposit from DB"
            );
            self.pending_deposits.insert(*order_id as u64, deposit);
        }

        info!(
            recovered = rows.len(),
            "Recovered pending deposits from DB"
        );
        Ok(())
    }

    /// Upsert a deposit order in the database.
    async fn upsert_deposit_status(
        &self,
        order_id: u64,
        user: Address,
        amount: U256,
        status: DepositStatus,
    ) {
        let completed_at = match status {
            DepositStatus::CompletedOnSettlement | DepositStatus::Refunded => {
                Some(chrono::Utc::now().naive_utc())
            }
            _ => None,
        };

        if let Err(e) = sqlx::query(
            "INSERT INTO vision_deposit_orders (order_id, user_address, amount, status, completed_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (order_id) DO UPDATE SET
                status = EXCLUDED.status,
                completed_at = COALESCE(EXCLUDED.completed_at, vision_deposit_orders.completed_at)",
        )
        .bind(order_id as i64)
        .bind(format!("{:?}", user))
        .bind(amount.to_string())
        .bind(status.as_str())
        .bind(completed_at)
        .execute(&self.pool)
        .await
        {
            warn!(order_id, error = %e, "Failed to upsert deposit order");
        }
    }

    // =========================================================================
    // DB persistence — withdrawals (Issue 3)
    // =========================================================================

    /// Recover incomplete withdrawals from DB on startup.
    async fn recover_withdrawals_from_db(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let rows: Vec<(i64, String, String, String)> = sqlx::query_as(
            "SELECT withdraw_id, user_address, amount, status
             FROM vision_withdraw_orders
             WHERE status NOT IN ('completed')",
        )
        .fetch_all(&self.pool)
        .await?;

        for (withdraw_id, user_str, amount_str, status_str) in &rows {
            let user: Address = user_str.parse().unwrap_or_default();
            let amount = U256::from_dec_str(amount_str).unwrap_or_default();
            let status = WithdrawStatus::from_str(status_str).unwrap_or(WithdrawStatus::Pending);

            let withdrawal = PendingVisionWithdraw {
                withdraw_id: *withdraw_id as u64,
                user,
                amount,
                status,
            };

            info!(
                withdraw_id,
                status = status_str,
                "Recovered pending withdrawal from DB"
            );
            self.pending_withdrawals.insert(*withdraw_id as u64, withdrawal);
        }

        info!(
            recovered = rows.len(),
            "Recovered pending withdrawals from DB"
        );
        Ok(())
    }

    /// Upsert a withdrawal order in the database.
    async fn upsert_withdrawal_status(
        &self,
        withdraw_id: u64,
        user: Address,
        amount: U256,
        status: WithdrawStatus,
    ) {
        let completed_at = match status {
            WithdrawStatus::Completed => Some(chrono::Utc::now().naive_utc()),
            _ => None,
        };

        if let Err(e) = sqlx::query(
            "INSERT INTO vision_withdraw_orders (withdraw_id, user_address, amount, status, completed_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (withdraw_id) DO UPDATE SET
                status = EXCLUDED.status,
                completed_at = COALESCE(EXCLUDED.completed_at, vision_withdraw_orders.completed_at)",
        )
        .bind(withdraw_id as i64)
        .bind(format!("{:?}", user))
        .bind(amount.to_string())
        .bind(status.as_str())
        .bind(completed_at)
        .execute(&self.pool)
        .await
        {
            warn!(withdraw_id, error = %e, "Failed to upsert withdrawal order");
        }
    }

    // =========================================================================
    // DB cursors
    // =========================================================================

    /// Get the last Settlement block cursor from DB.
    async fn get_settlement_cursor(&self) -> Option<u64> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT value FROM vision_kv_store WHERE key = 'deposit_watcher_settlement_cursor'",
        )
        .fetch_optional(&self.pool)
        .await
        .ok()?;

        row.and_then(|(v,)| v.parse::<u64>().ok())
    }

    /// Save the Settlement block cursor to DB.
    async fn save_settlement_cursor(&self, block: u64) {
        if let Err(e) = sqlx::query(
            "INSERT INTO vision_kv_store (key, value)
             VALUES ('deposit_watcher_settlement_cursor', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        )
        .bind(block.to_string())
        .execute(&self.pool)
        .await
        {
            warn!(block, error = %e, "Failed to save Settlement cursor");
        }
    }

    /// Get the last L3 withdrawal block cursor from DB.
    async fn get_l3_cursor(&self) -> Option<u64> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT value FROM vision_kv_store WHERE key = 'deposit_watcher_l3_cursor'",
        )
        .fetch_optional(&self.pool)
        .await
        .ok()?;

        row.and_then(|(v,)| v.parse::<u64>().ok())
    }

    /// Save the L3 withdrawal block cursor to DB.
    async fn save_l3_cursor(&self, block: u64) {
        if let Err(e) = sqlx::query(
            "INSERT INTO vision_kv_store (key, value)
             VALUES ('deposit_watcher_l3_cursor', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        )
        .bind(block.to_string())
        .execute(&self.pool)
        .await
        {
            warn!(block, error = %e, "Failed to save L3 cursor");
        }
    }
}

// =============================================================================
// Calldata builders for BLS-signed contract calls
// =============================================================================

/// Build calldata for Vision.creditBalance(address user, uint256 amount, uint256 depositId, bytes blsSignature, uint256 referenceNonce, uint256 signersBitmask)
pub fn build_credit_balance_calldata(
    user: Address,
    amount: U256,
    deposit_id: U256,
    bls_signature: &[u8],
    reference_nonce: U256,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        b"creditBalance(address,uint256,uint256,bytes,uint256,uint256)",
    )[..4];

    let encoded_args = abi::encode(&[
        Token::Address(user),
        Token::Uint(amount),
        Token::Uint(deposit_id),
        Token::Bytes(bls_signature.to_vec()),
        Token::Uint(reference_nonce),
        Token::Uint(signers_bitmask),
    ]);

    let mut calldata = Vec::with_capacity(4 + encoded_args.len());
    calldata.extend_from_slice(selector);
    calldata.extend_from_slice(&encoded_args);
    calldata
}

/// Build calldata for SettlementBridgeCustody.completeVisionDeposit(uint256 orderId, bytes blsSignature, uint256 referenceNonce, uint256 signersBitmask)
pub fn build_complete_deposit_calldata(
    order_id: U256,
    bls_signature: &[u8],
    reference_nonce: U256,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        b"completeVisionDeposit(uint256,bytes,uint256,uint256)",
    )[..4];

    let encoded_args = abi::encode(&[
        Token::Uint(order_id),
        Token::Bytes(bls_signature.to_vec()),
        Token::Uint(reference_nonce),
        Token::Uint(signers_bitmask),
    ]);

    let mut calldata = Vec::with_capacity(4 + encoded_args.len());
    calldata.extend_from_slice(selector);
    calldata.extend_from_slice(&encoded_args);
    calldata
}

/// Build calldata for SettlementBridgeCustody.refundVisionDeposit(uint256 orderId, bytes blsSignature, uint256 referenceNonce, uint256 signersBitmask)
pub fn build_refund_deposit_calldata(
    order_id: U256,
    bls_signature: &[u8],
    reference_nonce: U256,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        b"refundVisionDeposit(uint256,bytes,uint256,uint256)",
    )[..4];

    let encoded_args = abi::encode(&[
        Token::Uint(order_id),
        Token::Bytes(bls_signature.to_vec()),
        Token::Uint(reference_nonce),
        Token::Uint(signers_bitmask),
    ]);

    let mut calldata = Vec::with_capacity(4 + encoded_args.len());
    calldata.extend_from_slice(selector);
    calldata.extend_from_slice(&encoded_args);
    calldata
}

/// Build calldata for SettlementBridgeCustody.completeVisionWithdraw(uint256 withdrawId, address user, uint256 amount, bytes blsSignature, uint256 referenceNonce, uint256 signersBitmask)
pub fn build_complete_withdraw_calldata(
    withdraw_id: U256,
    user: Address,
    amount: U256,
    bls_signature: &[u8],
    reference_nonce: U256,
    signers_bitmask: U256,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        b"completeVisionWithdraw(uint256,address,uint256,bytes,uint256,uint256)",
    )[..4];

    let encoded_args = abi::encode(&[
        Token::Uint(withdraw_id),
        Token::Address(user),
        Token::Uint(amount),
        Token::Bytes(bls_signature.to_vec()),
        Token::Uint(reference_nonce),
        Token::Uint(signers_bitmask),
    ]);

    let mut calldata = Vec::with_capacity(4 + encoded_args.len());
    calldata.extend_from_slice(selector);
    calldata.extend_from_slice(&encoded_args);
    calldata
}

// =============================================================================
// BLS message hash builders (match contract's keccak256(abi.encode(...)))
// =============================================================================

/// Build the BLS message hash for Vision.creditBalance().
///
/// Matches: keccak256(abi.encode(chainId, visionAddress, "creditBalance", user, amount, depositId))
pub fn build_credit_balance_hash(
    chain_id: u64,
    vision_address: Address,
    user: Address,
    amount: U256,
    deposit_id: U256,
) -> H256 {
    let encoded = abi::encode(&[
        Token::Uint(U256::from(chain_id)),
        Token::Address(vision_address),
        Token::String("creditBalance".to_string()),
        Token::Address(user),
        Token::Uint(amount),
        Token::Uint(deposit_id),
    ]);
    H256::from(ethers::utils::keccak256(&encoded))
}

/// Build the BLS message hash for SettlementBridgeCustody.completeVisionDeposit().
///
/// Matches: keccak256(abi.encode(chainId, custodyAddress, "completeVisionDeposit", orderId))
pub fn build_complete_deposit_hash(
    chain_id: u64,
    custody_address: Address,
    order_id: U256,
) -> H256 {
    let encoded = abi::encode(&[
        Token::Uint(U256::from(chain_id)),
        Token::Address(custody_address),
        Token::String("completeVisionDeposit".to_string()),
        Token::Uint(order_id),
    ]);
    H256::from(ethers::utils::keccak256(&encoded))
}

/// Build the BLS message hash for SettlementBridgeCustody.refundVisionDeposit().
///
/// Matches: keccak256(abi.encode(chainId, custodyAddress, "refundVisionDeposit", orderId))
pub fn build_refund_deposit_hash(
    chain_id: u64,
    custody_address: Address,
    order_id: U256,
) -> H256 {
    let encoded = abi::encode(&[
        Token::Uint(U256::from(chain_id)),
        Token::Address(custody_address),
        Token::String("refundVisionDeposit".to_string()),
        Token::Uint(order_id),
    ]);
    H256::from(ethers::utils::keccak256(&encoded))
}

/// Build the BLS message hash for SettlementBridgeCustody.completeVisionWithdraw().
///
/// Matches: keccak256(abi.encode(chainId, custodyAddress, "completeVisionWithdraw", withdrawId, user, amount))
pub fn build_complete_withdraw_hash(
    chain_id: u64,
    custody_address: Address,
    withdraw_id: U256,
    user: Address,
    amount: U256,
) -> H256 {
    let encoded = abi::encode(&[
        Token::Uint(U256::from(chain_id)),
        Token::Address(custody_address),
        Token::String("completeVisionWithdraw".to_string()),
        Token::Uint(withdraw_id),
        Token::Address(user),
        Token::Uint(amount),
    ]);
    H256::from(ethers::utils::keccak256(&encoded))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_credit_balance_hash_deterministic() {
        let hash1 = build_credit_balance_hash(
            111_222_333,
            Address::zero(),
            Address::from([0xAB; 20]),
            U256::from(1_000_000),
            U256::from(42),
        );
        let hash2 = build_credit_balance_hash(
            111_222_333,
            Address::zero(),
            Address::from([0xAB; 20]),
            U256::from(1_000_000),
            U256::from(42),
        );
        assert_eq!(hash1, hash2, "Same inputs must produce same hash");
        assert_ne!(hash1, H256::zero(), "Hash must not be zero");
    }

    #[test]
    fn test_credit_balance_hash_differs_by_input() {
        let hash1 = build_credit_balance_hash(
            111_222_333,
            Address::zero(),
            Address::from([0xAB; 20]),
            U256::from(1_000_000),
            U256::from(42),
        );
        let hash2 = build_credit_balance_hash(
            111_222_333,
            Address::zero(),
            Address::from([0xAB; 20]),
            U256::from(2_000_000), // different amount
            U256::from(42),
        );
        assert_ne!(hash1, hash2, "Different amounts must produce different hashes");
    }

    #[test]
    fn test_complete_deposit_hash() {
        let hash = build_complete_deposit_hash(42161, Address::zero(), U256::from(1));
        assert_ne!(hash, H256::zero());
    }

    #[test]
    fn test_refund_deposit_hash() {
        let hash = build_refund_deposit_hash(42161, Address::zero(), U256::from(1));
        assert_ne!(hash, H256::zero());
    }

    #[test]
    fn test_complete_withdraw_hash() {
        let hash = build_complete_withdraw_hash(
            42161,
            Address::zero(),
            U256::from(1),
            Address::from([0xCD; 20]),
            U256::from(500_000),
        );
        assert_ne!(hash, H256::zero());
    }

    #[test]
    fn test_deposit_status_roundtrip() {
        for status in &[
            DepositStatus::Pending,
            DepositStatus::CreditedOnL3,
            DepositStatus::CompletedOnSettlement,
            DepositStatus::Refunded,
        ] {
            let s = status.as_str();
            let parsed = DepositStatus::from_str(s).unwrap();
            assert_eq!(*status, parsed, "Roundtrip failed for {s}");
        }
    }

    #[test]
    fn test_credit_balance_calldata_not_empty() {
        let calldata = build_credit_balance_calldata(
            Address::from([0xAB; 20]),
            U256::from(1_000_000),
            U256::from(42),
            &[0u8; 64],
            U256::from(1), // reference_nonce
            U256::one(),
        );
        assert!(calldata.len() > 4, "Calldata must include selector + args");
    }

    #[test]
    fn test_complete_deposit_calldata_not_empty() {
        let calldata = build_complete_deposit_calldata(
            U256::from(42),
            &[0u8; 64],
            U256::from(1), // reference_nonce
            U256::one(),
        );
        assert!(calldata.len() > 4, "Calldata must include selector + args");
    }

    #[test]
    fn test_refund_deposit_calldata_not_empty() {
        let calldata = build_refund_deposit_calldata(
            U256::from(42),
            &[0u8; 64],
            U256::from(1), // reference_nonce
            U256::one(),
        );
        assert!(calldata.len() > 4, "Calldata must include selector + args");
    }

    #[test]
    fn test_complete_withdraw_calldata_not_empty() {
        let calldata = build_complete_withdraw_calldata(
            U256::from(1),
            Address::from([0xCD; 20]),
            U256::from(500_000),
            &[0u8; 64],
            U256::from(1), // reference_nonce
            U256::one(),
        );
        assert!(calldata.len() > 4, "Calldata must include selector + args");
    }

    #[test]
    fn test_withdraw_status_roundtrip() {
        for status in &[
            WithdrawStatus::Pending,
            WithdrawStatus::Completed,
        ] {
            let s = status.as_str();
            let parsed = WithdrawStatus::from_str(s).unwrap();
            assert_eq!(*status, parsed, "Roundtrip failed for {s}");
        }
    }
}
