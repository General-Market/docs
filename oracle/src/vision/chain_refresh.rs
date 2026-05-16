//! On-demand chain re-fetch for stale player commitments.
//!
//! The bitmap-submission handler trusts an in-memory cache (`TickScheduler::players`)
//! to learn what each `(batch_id, player)` has committed on-chain. The cache is fed
//! by `chain_listener::handle_player_joined` and `handle_bitmap_updated`. If either
//! event is dropped, missed during a reorg, or arrives out of order, the cache
//! drifts away from the contract. The bot then submits a bitmap whose hash matches
//! the chain — and the oracle rejects it because the cache still holds the previous
//! commitment.
//!
//! Fund-manager vaults exposed this in production: every `joinBatch` from a vault
//! produces a fresh `PlayerJoined` event, but the cache for that `(batchId, vault)`
//! was sometimes holding a stale value from a prior submission cycle. 100 % of
//! vault bitmap submissions were rejected on first attempt.
//!
//! Rather than chase every possible drift source, we trust the chain. When the
//! cache disagrees with the bot, we re-fetch `Vision.getPosition(batchId, player)`
//! directly, repopulate the cache, and re-compare. A per-pair cooldown bounds the
//! RPC load.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use ethers::abi::{self, Token};
use ethers::providers::{Http, Middleware, Provider};
use ethers::types::{Address, H256, U256};
use tokio::sync::Mutex;
use tracing::warn;

use super::types::PlayerPosition;

/// Default minimum interval between chain re-fetches for the same (batch, player).
/// Ten seconds is enough to absorb any reasonable burst of resubmissions without
/// hammering the RPC if a misbehaving client retries in a tight loop.
const DEFAULT_COOLDOWN: Duration = Duration::from_secs(10);

/// On-demand chain re-fetcher for player positions.
pub struct ChainRefresher {
    provider: Arc<Provider<Http>>,
    vision_address: Address,
    cooldown: Duration,
    last_attempt: Mutex<HashMap<(u64, Address), Instant>>,
}

impl ChainRefresher {
    pub fn new(provider: Arc<Provider<Http>>, vision_address: Address) -> Self {
        Self {
            provider,
            vision_address,
            cooldown: DEFAULT_COOLDOWN,
            last_attempt: Mutex::new(HashMap::new()),
        }
    }

    /// Re-fetch `(batch_id, player)` from chain if the per-pair cooldown has
    /// elapsed. Returns `None` if the cooldown is still active or the RPC
    /// call fails. Returns `Some(PlayerPosition)` only when the contract
    /// reports a non-empty deposit, i.e. the player actually joined.
    pub async fn refresh_if_allowed(
        &self,
        batch_id: u64,
        player: Address,
    ) -> Option<PlayerPosition> {
        // Cooldown gate.
        {
            let mut last = self.last_attempt.lock().await;
            let now = Instant::now();
            if let Some(prev) = last.get(&(batch_id, player)) {
                if now.duration_since(*prev) < self.cooldown {
                    return None;
                }
            }
            last.insert((batch_id, player), now);
        }

        self.fetch_position(batch_id, player).await
    }

    /// Encode and call `Vision.getPosition(uint256,address)`. Decodes the
    /// returned `PlayerPosition` tuple and extracts the fields the scheduler
    /// cares about (bitmapHash, totalDeposited).
    ///
    /// Returns `None` for unjoined players (totalDeposited == 0), RPC errors,
    /// or decode failures.
    async fn fetch_position(
        &self,
        batch_id: u64,
        player: Address,
    ) -> Option<PlayerPosition> {
        let selector = &ethers::utils::keccak256(b"getPosition(uint256,address)")[..4];
        let encoded_args = abi::encode(&[
            Token::Uint(U256::from(batch_id)),
            Token::Address(player),
        ]);

        let mut calldata = Vec::with_capacity(4 + encoded_args.len());
        calldata.extend_from_slice(selector);
        calldata.extend_from_slice(&encoded_args);

        let tx = ethers::types::TransactionRequest::new()
            .to(self.vision_address)
            .data(calldata);

        let result = match self.provider.call(&tx.into(), None).await {
            Ok(r) => r,
            Err(e) => {
                warn!(
                    batch_id,
                    player = %player,
                    error = %e,
                    "ChainRefresher: getPosition call failed"
                );
                return None;
            }
        };

        // Vision.getPosition returns the full PlayerPosition struct:
        // (bytes32 bitmapHash, bytes32 configHash, uint256 deposit, uint256 startTick,
        //  uint256 balance, uint256 lastClaimedTick, uint256 joinTimestamp,
        //  uint256 totalDeposited, uint256 totalClaimed)
        // We only need bitmapHash and totalDeposited.
        let tokens = match abi::decode(
            &[abi::ParamType::Tuple(vec![
                abi::ParamType::FixedBytes(32), // bitmapHash
                abi::ParamType::FixedBytes(32), // configHash
                abi::ParamType::Uint(256),      // deposit (formerly stakePerTick)
                abi::ParamType::Uint(256),      // startTick
                abi::ParamType::Uint(256),      // balance
                abi::ParamType::Uint(256),      // lastClaimedTick
                abi::ParamType::Uint(256),      // joinTimestamp
                abi::ParamType::Uint(256),      // totalDeposited
                abi::ParamType::Uint(256),      // totalClaimed
            ])],
            &result,
        ) {
            Ok(t) => t,
            Err(e) => {
                warn!(
                    batch_id,
                    player = %player,
                    error = %e,
                    "ChainRefresher: failed to decode getPosition result"
                );
                return None;
            }
        };

        let tuple = match tokens.into_iter().next()? {
            Token::Tuple(t) => t,
            _ => return None,
        };

        let bitmap_hash = match &tuple[0] {
            Token::FixedBytes(b) if b.len() == 32 => H256::from_slice(b),
            _ => return None,
        };
        let total_deposited = match &tuple[7] {
            Token::Uint(v) => *v,
            _ => return None,
        };

        if total_deposited.is_zero() {
            // Player has not joined this batch on-chain.
            return None;
        }

        Some(PlayerPosition {
            player,
            bitmap_hash,
            deposit: total_deposited,
        })
    }
}
