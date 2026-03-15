//! Arbitration event listener
//!
//! Polls CollateralVault for `ArbitrationRequested` events.
//! Uses ethers Provider (same pattern as oracle's chain reader).

use ethers::providers::{Http, Middleware, Provider};
use ethers::types::{Address, Filter, H256, U256, U64};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info, warn};

use super::types::ArbitrationRequest;

/// Listens for `ArbitrationRequested` events from CollateralVault.
///
/// Runs as a long-lived async task. Each poll cycle queries new blocks
/// for the event topic, parses minimal data (bet_id) from the log, and
/// forwards an `ArbitrationRequest` stub through the channel.
/// The downstream processor is responsible for enriching the stub by
/// reading full bet details from the contract.
pub struct ArbitrationListener {
    provider: Arc<Provider<Http>>,
    vault_address: Address,
    poll_interval_secs: u64,
    last_block: U64,
    request_tx: mpsc::UnboundedSender<ArbitrationRequest>,
}

impl ArbitrationListener {
    pub fn new(
        provider: Arc<Provider<Http>>,
        vault_address: Address,
        poll_interval_secs: u64,
        request_tx: mpsc::UnboundedSender<ArbitrationRequest>,
    ) -> Self {
        Self {
            provider,
            vault_address,
            poll_interval_secs,
            last_block: U64::zero(),
            request_tx,
        }
    }

    /// Run the listener loop until the shutdown flag is set.
    pub async fn run(mut self, shutdown: Arc<std::sync::atomic::AtomicBool>) {
        info!(
            vault = %self.vault_address,
            interval = self.poll_interval_secs,
            "ArbitrationListener started"
        );

        // Seed the cursor at the current chain tip so we only look at new events.
        match self.provider.get_block_number().await {
            Ok(block) => self.last_block = block,
            Err(e) => {
                error!("Failed to get initial block number: {}", e);
                return;
            }
        }

        loop {
            if shutdown.load(std::sync::atomic::Ordering::Relaxed) {
                info!("ArbitrationListener shutting down");
                break;
            }

            tokio::time::sleep(std::time::Duration::from_secs(self.poll_interval_secs)).await;

            match self.poll_events().await {
                Ok(count) => {
                    if count > 0 {
                        info!(count, "Processed arbitration events");
                    }
                }
                Err(e) => {
                    warn!("Failed to poll arbitration events: {}", e);
                }
            }
        }
    }

    /// Poll for new `ArbitrationRequested` events since `last_block`.
    async fn poll_events(&mut self) -> Result<usize, Box<dyn std::error::Error>> {
        let current_block = self.provider.get_block_number().await?;
        if current_block <= self.last_block {
            return Ok(0);
        }

        // ArbitrationRequested(uint256 indexed betId, address indexed requestedBy)
        let event_sig = ethers::utils::keccak256(b"ArbitrationRequested(uint256,address)");
        let filter = Filter::new()
            .address(self.vault_address)
            .topic0(H256::from(event_sig))
            .from_block(self.last_block + 1)
            .to_block(current_block);

        let logs = self.provider.get_logs(&filter).await?;
        let count = logs.len();

        for log in &logs {
            if let Some(request) = self.parse_event(log) {
                info!(bet_id = %request.bet_id, "New arbitration request");
                if self.request_tx.send(request).is_err() {
                    error!("Arbitration request channel closed");
                    break;
                }
            }
        }

        self.last_block = current_block;
        Ok(count)
    }

    /// Parse a single log into an `ArbitrationRequest` stub.
    ///
    /// Only the `bet_id` is available from the indexed topic. The remaining
    /// fields (`trades_root`, `creator`, `filler`, amounts, `deadline`) are
    /// left as zero and must be filled by the processor reading
    /// `CollateralVault.bets(betId)`.
    fn parse_event(&self, log: &ethers::types::Log) -> Option<ArbitrationRequest> {
        let bet_id = U256::from(log.topics.get(1)?.as_bytes());
        Some(ArbitrationRequest {
            bet_id,
            trades_root: H256::zero(),
            creator: Address::zero(),
            filler: Address::zero(),
            creator_amount: U256::zero(),
            filler_amount: U256::zero(),
            deadline: U256::zero(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::{Log, H160};

    #[test]
    fn test_parse_event_extracts_bet_id() {
        let provider = Arc::new(Provider::<Http>::try_from("http://localhost:8545").unwrap());
        let (tx, _rx) = mpsc::unbounded_channel();
        let listener = ArbitrationListener::new(
            provider,
            H160::from([0x11u8; 20]),
            30,
            tx,
        );

        // Build a fake log with two indexed topics
        let event_sig = H256::from(ethers::utils::keccak256(
            b"ArbitrationRequested(uint256,address)",
        ));
        let mut bet_id_bytes = [0u8; 32];
        U256::from(42u64).to_big_endian(&mut bet_id_bytes);
        let bet_id_topic = H256::from(bet_id_bytes);

        let log = Log {
            topics: vec![event_sig, bet_id_topic],
            ..Default::default()
        };

        let result = listener.parse_event(&log);
        assert!(result.is_some());
        let req = result.unwrap();
        assert_eq!(req.bet_id, U256::from(42u64));
        // Stub fields should be zero
        assert_eq!(req.trades_root, H256::zero());
        assert_eq!(req.creator, Address::zero());
    }

    #[test]
    fn test_parse_event_returns_none_for_missing_topic() {
        let provider = Arc::new(Provider::<Http>::try_from("http://localhost:8545").unwrap());
        let (tx, _rx) = mpsc::unbounded_channel();
        let listener = ArbitrationListener::new(
            provider,
            H160::from([0x11u8; 20]),
            30,
            tx,
        );

        // Log with only one topic (no bet_id)
        let log = Log {
            topics: vec![H256::zero()],
            ..Default::default()
        };

        assert!(listener.parse_event(&log).is_none());
    }
}
