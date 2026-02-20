//! Arbitration subsystem
//!
//! Runs as an async task alongside the 1-second trading cycle.
//! Listens for ArbitrationRequested events from CollateralVault,
//! runs 4-phase consensus per bet, and submits resolution on-chain.

pub mod types;
pub mod resolution;
pub mod market_data;
pub mod listener;

use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, warn};

use common::types::P2PMessage;
use types::ArbitrationConfig;

/// Channel for forwarding arbitration P2P messages from consensus handler
pub type ArbitrationMessageSender = mpsc::UnboundedSender<P2PMessage>;
pub type ArbitrationMessageReceiver = mpsc::UnboundedReceiver<P2PMessage>;

/// Create a channel pair for arbitration message forwarding
pub fn arbitration_channel() -> (ArbitrationMessageSender, ArbitrationMessageReceiver) {
    mpsc::unbounded_channel()
}

/// Top-level arbitration subsystem
pub struct ArbitrationSubsystem {
    config: ArbitrationConfig,
    message_rx: ArbitrationMessageReceiver,
}

impl ArbitrationSubsystem {
    pub fn new(config: ArbitrationConfig, message_rx: ArbitrationMessageReceiver) -> Self {
        Self { config, message_rx }
    }

    /// Run the arbitration subsystem (blocks until shutdown)
    pub async fn run(mut self, shutdown: Arc<std::sync::atomic::AtomicBool>) {
        info!(
            vault = %self.config.collateral_vault,
            threshold = self.config.signature_threshold,
            poll_interval = self.config.poll_interval_secs,
            "Arbitration subsystem started"
        );

        loop {
            if shutdown.load(std::sync::atomic::Ordering::Relaxed) {
                info!("Arbitration subsystem shutting down");
                break;
            }

            tokio::select! {
                Some(msg) = self.message_rx.recv() => {
                    match msg {
                        P2PMessage::ArbitrationPriceProposal { bet_id, .. } => {
                            info!(bet_id = %bet_id, "Received arbitration price proposal");
                        }
                        P2PMessage::ArbitrationPriceVote { bet_id, .. } => {
                            info!(bet_id = %bet_id, "Received arbitration price vote");
                        }
                        P2PMessage::ArbitrationResolutionSign { bet_id, .. } => {
                            info!(bet_id = %bet_id, "Received arbitration resolution signature");
                        }
                        _ => {
                            warn!("Unexpected message type in arbitration channel");
                        }
                    }
                }
                _ = tokio::time::sleep(std::time::Duration::from_secs(1)) => {
                    // Periodic tick for future listener polling
                }
            }
        }
    }
}
