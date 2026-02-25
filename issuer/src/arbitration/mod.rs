//! Arbitration subsystem
//!
//! Runs as an async task alongside the 1-second trading cycle.
//! Listens for ArbitrationRequested events from CollateralVault,
//! runs 4-phase consensus per bet, and submits resolution on-chain.

pub mod types;
pub mod resolution;
pub mod market_data;
pub mod listener;
pub mod consensus;
pub mod processor;

use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info, warn};

use common::bls::BLSKeyPair;
use common::traits::P2PTransport;
use common::types::P2PMessage;
use ethers::providers::{Http, Middleware, Provider};

use crate::EthersChainWriter;

use self::listener::ArbitrationListener;
use self::processor::ArbitrationProcessor;
use self::types::{ArbitrationConfig, ArbitrationRequest};

/// Channel for forwarding arbitration P2P messages from consensus handler
pub type ArbitrationMessageSender = mpsc::UnboundedSender<P2PMessage>;
pub type ArbitrationMessageReceiver = mpsc::UnboundedReceiver<P2PMessage>;

/// Create a channel pair for arbitration message forwarding
pub fn arbitration_channel() -> (ArbitrationMessageSender, ArbitrationMessageReceiver) {
    mpsc::unbounded_channel()
}

/// Top-level arbitration subsystem
///
/// Orchestrates the ArbitrationListener (event polling) and ArbitrationProcessor
/// (4-phase consensus state machine). The subsystem:
/// 1. Spawns a listener that polls CollateralVault for ArbitrationRequested events
/// 2. Routes incoming P2P messages to the processor
/// 3. Kicks off consensus when the listener detects a new request
/// 4. Submits settlement on-chain when consensus completes
pub struct ArbitrationSubsystem {
    config: ArbitrationConfig,
    message_rx: ArbitrationMessageReceiver,
    p2p: Arc<dyn P2PTransport>,
    chain_writer: Arc<EthersChainWriter>,
    bls_keypair: BLSKeyPair,
    issuer_index: u8,
    rpc_url: String,
}

impl ArbitrationSubsystem {
    pub fn new(
        config: ArbitrationConfig,
        message_rx: ArbitrationMessageReceiver,
        p2p: Arc<dyn P2PTransport>,
        chain_writer: Arc<EthersChainWriter>,
        bls_keypair: BLSKeyPair,
        issuer_index: u8,
        rpc_url: String,
    ) -> Self {
        Self {
            config,
            message_rx,
            p2p,
            chain_writer,
            bls_keypair,
            issuer_index,
            rpc_url,
        }
    }

    /// Run the arbitration subsystem (blocks until shutdown)
    pub async fn run(mut self, shutdown: Arc<std::sync::atomic::AtomicBool>) {
        info!(
            vault = %self.config.collateral_vault,
            threshold = self.config.signature_threshold,
            poll_interval = self.config.poll_interval_secs,
            "Arbitration subsystem started"
        );

        // Create request channel (listener -> subsystem)
        let (request_tx, mut request_rx) = mpsc::unbounded_channel::<ArbitrationRequest>();

        // Spawn the ArbitrationListener to poll CollateralVault events
        let listener_provider = match Provider::<Http>::try_from(&self.rpc_url) {
            Ok(p) => Arc::new(p),
            Err(e) => {
                error!(error = %e, "Failed to create provider for ArbitrationListener");
                return;
            }
        };

        // Query chain ID from provider and inject into config
        match listener_provider.get_chainid().await {
            Ok(cid) => {
                self.config.chain_id = cid.as_u64();
                info!(chain_id = self.config.chain_id, "Arbitration chain ID from provider");
            }
            Err(e) => {
                error!(error = %e, "Failed to query chain ID from provider, aborting arbitration");
                return;
            }
        }

        let listener = ArbitrationListener::new(
            listener_provider,
            self.config.collateral_vault,
            self.config.poll_interval_secs,
            request_tx,
        );
        let listener_shutdown = shutdown.clone();
        tokio::spawn(async move {
            listener.run(listener_shutdown).await;
        });

        // Create the processor with all dependencies
        let mut processor = ArbitrationProcessor::new(
            self.config.clone(),
            self.p2p.clone(),
            self.bls_keypair.clone(),
            self.issuer_index,
        );

        let settlement_contract = self.config.settlement_contract;

        // Main run loop with 3 select branches
        let mut drain_interval = tokio::time::interval(std::time::Duration::from_secs(1));

        loop {
            if shutdown.load(std::sync::atomic::Ordering::Relaxed) {
                info!("Arbitration subsystem shutting down");
                break;
            }

            tokio::select! {
                // Branch 1: P2P messages from consensus handler
                Some(msg) = self.message_rx.recv() => {
                    processor.handle_message(msg);
                }

                // Branch 2: New arbitration requests from listener
                Some(request) = request_rx.recv() => {
                    let bet_id = request.bet_id;
                    if processor.has_active_consensus(&bet_id) {
                        warn!(bet_id = %bet_id, "Ignoring duplicate arbitration request");
                        continue;
                    }
                    processor.start_consensus(request).await;
                }

                // Branch 3: Periodic drain of completed results + chain submission
                _ = drain_interval.tick() => {
                    let results = processor.drain_completed();
                    for result in results {
                        info!(
                            bet_id = %result.bet_id,
                            creator_wins = result.creator_wins,
                            signers = result.signer_count,
                            "Submitting arbitration settlement"
                        );
                        // TODO(consensus-hardening): pass real reference_nonce from arbitration result
                        match self.chain_writer.submit_settlement(
                            settlement_contract,
                            result.bet_id,
                            result.creator_wins,
                            result.aggregated_signature,
                            0, // reference_nonce placeholder
                            result.signer_bitmap,
                        ).await {
                            Ok(tx_hash) => {
                                info!(
                                    bet_id = %result.bet_id,
                                    tx_hash = ?tx_hash,
                                    "Settlement submitted"
                                );
                            }
                            Err(e) => {
                                error!(
                                    bet_id = %result.bet_id,
                                    error = %e,
                                    "Settlement submission failed"
                                );
                            }
                        }
                    }
                }
            }
        }
    }
}
