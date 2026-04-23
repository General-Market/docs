//! Stateless chain scanner.
//!
//! On each wake the daemon asks three questions via `getProgramAccounts`:
//!   1. Markets where `baseline_price == 0 && close_time <= now` — need close.
//!   2. Markets where `baseline_price > 0 && !resolved && settlement_time <= now`
//!      — need resolve.
//!   3. Positions attached to resolved markets — need claim.
//!
//! Position has no `claimed` flag; `claim` closes the account. So the mere
//! existence of a Position under a resolved Market is work to do (SA21).
//!
//! We do NOT use memcmp on time fields — the RPC has no "<=" operator, so we
//! fetch the candidate set by discriminator + cheap equality filters (e.g.
//! `resolved` byte == 0) and apply the time predicates in memory.

use anchor_lang::{AccountDeserialize, Discriminator};
use anyhow::{Context, Result};
use prediction_market::state::{Market, Position};
use solana_account_decoder_client_types::UiAccountEncoding;
use solana_pubkey::Pubkey;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use solana_rpc_client_api::config::{RpcAccountInfoConfig, RpcProgramAccountsConfig};
use solana_rpc_client_api::filter::{Memcmp, RpcFilterType};
use tracing::debug;

// --- Field offsets inside Market account data, after 8-byte discriminator ---
// Pinned to Market::LEN layout in programs-solana/.../state.rs. A drift in
// either side means silent wrong filtering; the unit test below cross-checks
// the arithmetic against Market::LEN to catch structure changes fast.
const MARKET_OFFSET_SOURCE_ID: u64 = 8;
const MARKET_OFFSET_CLOSE_TIME: u64 = MARKET_OFFSET_SOURCE_ID + 4;
const MARKET_OFFSET_SETTLEMENT_TIME: u64 = MARKET_OFFSET_CLOSE_TIME + 8;
const MARKET_OFFSET_THRESHOLD_BPS: u64 = MARKET_OFFSET_SETTLEMENT_TIME + 8;
const MARKET_OFFSET_TOTAL_YES: u64 = MARKET_OFFSET_THRESHOLD_BPS + 4;
const MARKET_OFFSET_TOTAL_NO: u64 = MARKET_OFFSET_TOTAL_YES + 8;
const MARKET_OFFSET_RESOLVED: u64 = MARKET_OFFSET_TOTAL_NO + 8;
const MARKET_OFFSET_BASELINE: u64 = MARKET_OFFSET_RESOLVED + 1 + 1; // + outcome_yes

// Position offsets.
const POSITION_OFFSET_MARKET: u64 = 8;

/// Addressable market + its inlined state. The daemon never persists this —
/// it re-reads every wake. Chain is memory.
#[derive(Clone)]
pub struct MarketRecord {
    pub address: Pubkey,
    pub market: Market,
}

/// Resolved market + one of its still-open Position accounts.
#[derive(Clone)]
pub struct PositionRecord {
    pub address: Pubkey,
    pub market_address: Pubkey,
    pub position: Position,
}

pub struct Scanner {
    rpc: std::sync::Arc<RpcClient>,
    program_id: Pubkey,
}

impl Scanner {
    pub fn new(rpc: std::sync::Arc<RpcClient>, program_id: Pubkey) -> Self {
        Self { rpc, program_id }
    }

    async fn get_markets_with_filters(
        &self,
        extra_filters: Vec<RpcFilterType>,
    ) -> Result<Vec<MarketRecord>> {
        let mut filters = Vec::with_capacity(1 + extra_filters.len());
        filters.push(RpcFilterType::Memcmp(Memcmp::new_raw_bytes(
            0,
            Market::DISCRIMINATOR.to_vec(),
        )));
        filters.extend(extra_filters);

        let cfg = RpcProgramAccountsConfig {
            filters: Some(filters),
            account_config: RpcAccountInfoConfig {
                encoding: Some(UiAccountEncoding::Base64),
                data_slice: None,
                commitment: Some(self.rpc.commitment()),
                min_context_slot: None,
            },
            with_context: Some(false),
            sort_results: None,
        };
        // TODO: migrate to get_program_ui_accounts_with_config (returns UiAccount, non-trivial reshape).
        #[allow(deprecated)]
        let accounts = self
            .rpc
            .get_program_accounts_with_config(&self.program_id, cfg)
            .await
            .context("getProgramAccounts(Market)")?;

        let mut out = Vec::with_capacity(accounts.len());
        for (pk, acct) in accounts {
            match Market::try_deserialize(&mut acct.data.as_slice()) {
                Ok(m) => out.push(MarketRecord { address: pk, market: m }),
                Err(e) => debug!(address = %pk, error = %e, "skipped un-deserializable Market"),
            }
        }
        Ok(out)
    }

    /// Markets past close_time with no baseline (needs `close_market`).
    pub async fn markets_needing_close(&self, now: i64) -> Result<Vec<MarketRecord>> {
        // Baseline u128 == 0: 16 zero bytes.
        let zero_baseline = RpcFilterType::Memcmp(Memcmp::new_raw_bytes(
            MARKET_OFFSET_BASELINE as usize,
            vec![0u8; 16],
        ));
        let candidates = self.get_markets_with_filters(vec![zero_baseline]).await?;
        Ok(candidates
            .into_iter()
            .filter(|r| r.market.close_time <= now)
            .collect())
    }

    /// Markets with a baseline past settlement_time still unresolved.
    pub async fn markets_needing_resolve(&self, now: i64) -> Result<Vec<MarketRecord>> {
        // resolved == false (single 0 byte).
        let unresolved = RpcFilterType::Memcmp(Memcmp::new_raw_bytes(
            MARKET_OFFSET_RESOLVED as usize,
            vec![0u8],
        ));
        let candidates = self.get_markets_with_filters(vec![unresolved]).await?;
        Ok(candidates
            .into_iter()
            .filter(|r| r.market.baseline_price > 0 && r.market.settlement_time <= now)
            .collect())
    }

    /// Positions attached to resolved markets — cranker should claim each.
    ///
    /// Two-phase scan:
    ///   1. `getProgramAccounts(Market, resolved=1)` — returns only markets
    ///      whose positions are claimable right now.
    ///   2. For each such market, `getProgramAccounts(Position, market=..)`
    ///      using a memcmp on offset 8. Returns only the positions that
    ///      belong to that one market.
    ///
    /// Work is proportional to the number of unclaimed markets, not the
    /// total lifetime count of positions on the program. The old
    /// program-wide Position sweep survives as a test-only fallback; see
    /// `positions_needing_claim_legacy`.
    pub async fn positions_needing_claim(&self) -> Result<Vec<PositionRecord>> {
        let resolved_flag = RpcFilterType::Memcmp(Memcmp::new_raw_bytes(
            MARKET_OFFSET_RESOLVED as usize,
            vec![1u8],
        ));
        let resolved = self.get_markets_with_filters(vec![resolved_flag]).await?;
        if resolved.is_empty() {
            return Ok(Vec::new());
        }

        let mut out = Vec::new();
        for market in &resolved {
            let positions = self.positions_for_market(&market.address).await?;
            out.extend(positions);
        }
        Ok(out)
    }

    /// Fetch every Position account whose `market` field matches the given
    /// pubkey. One `getProgramAccounts` call, filtered by discriminator +
    /// memcmp on the market pubkey at offset 8.
    async fn positions_for_market(
        &self,
        market: &Pubkey,
    ) -> Result<Vec<PositionRecord>> {
        let filters = vec![
            RpcFilterType::Memcmp(Memcmp::new_raw_bytes(
                0,
                Position::DISCRIMINATOR.to_vec(),
            )),
            RpcFilterType::Memcmp(Memcmp::new_raw_bytes(
                POSITION_OFFSET_MARKET as usize,
                market.to_bytes().to_vec(),
            )),
        ];
        let cfg = RpcProgramAccountsConfig {
            filters: Some(filters),
            account_config: RpcAccountInfoConfig {
                encoding: Some(UiAccountEncoding::Base64),
                data_slice: None,
                commitment: Some(self.rpc.commitment()),
                min_context_slot: None,
            },
            with_context: Some(false),
            sort_results: None,
        };
        // TODO: migrate to get_program_ui_accounts_with_config (returns UiAccount, non-trivial reshape).
        #[allow(deprecated)]
        let accounts = self
            .rpc
            .get_program_accounts_with_config(&self.program_id, cfg)
            .await
            .with_context(|| format!("getProgramAccounts(Position, market={market})"))?;

        let mut out = Vec::with_capacity(accounts.len());
        for (pk, acct) in accounts {
            match Position::try_deserialize(&mut acct.data.as_slice()) {
                Ok(p) => out.push(PositionRecord {
                    address: pk,
                    market_address: *market,
                    position: p,
                }),
                Err(e) => debug!(address = %pk, error = %e, "skipped un-deserializable Position"),
            }
        }
        Ok(out)
    }

    /// Legacy single-round-trip scan: pull every Position for the program,
    /// filter in memory against the resolved-market set. Kept for
    /// comparison in tests; production code uses `positions_needing_claim`.
    #[cfg(test)]
    #[allow(dead_code)]
    pub async fn positions_needing_claim_legacy(&self) -> Result<Vec<PositionRecord>> {
        let resolved_flag = RpcFilterType::Memcmp(Memcmp::new_raw_bytes(
            MARKET_OFFSET_RESOLVED as usize,
            vec![1u8],
        ));
        let resolved = self.get_markets_with_filters(vec![resolved_flag]).await?;
        if resolved.is_empty() {
            return Ok(Vec::new());
        }
        let resolved_set: std::collections::HashSet<Pubkey> =
            resolved.iter().map(|m| m.address).collect();

        let filters = vec![RpcFilterType::Memcmp(Memcmp::new_raw_bytes(
            0,
            Position::DISCRIMINATOR.to_vec(),
        ))];
        let cfg = RpcProgramAccountsConfig {
            filters: Some(filters),
            account_config: RpcAccountInfoConfig {
                encoding: Some(UiAccountEncoding::Base64),
                data_slice: None,
                commitment: Some(self.rpc.commitment()),
                min_context_slot: None,
            },
            with_context: Some(false),
            sort_results: None,
        };
        #[allow(deprecated)]
        let accounts = self
            .rpc
            .get_program_accounts_with_config(&self.program_id, cfg)
            .await
            .context("getProgramAccounts(Position)")?;

        let mut out = Vec::new();
        for (pk, acct) in accounts {
            let data = &acct.data;
            if data.len() < (POSITION_OFFSET_MARKET as usize + 32) {
                continue;
            }
            let market_bytes: [u8; 32] = match data
                [POSITION_OFFSET_MARKET as usize..POSITION_OFFSET_MARKET as usize + 32]
                .try_into()
            {
                Ok(b) => b,
                Err(_) => continue,
            };
            let market_address = Pubkey::from(market_bytes);
            if !resolved_set.contains(&market_address) {
                continue;
            }
            match Position::try_deserialize(&mut data.as_slice()) {
                Ok(p) => out.push(PositionRecord {
                    address: pk,
                    market_address,
                    position: p,
                }),
                Err(e) => debug!(address = %pk, error = %e, "skipped un-deserializable Position"),
            }
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn market_offsets_sum_to_struct_len() {
        // Trip if anyone rearranges Market fields without updating offsets.
        // LEN from state.rs: 8 + 4 + 8 + 8 + 4 + 8 + 8 + 1 + 1 + 16 + 16 + 32 + 1 = 115.
        assert_eq!(Market::LEN, 115);
        // Last field (bump: u8) lives at offset 114 (0-indexed).
        assert_eq!(MARKET_OFFSET_BASELINE, 50);
        assert_eq!(MARKET_OFFSET_RESOLVED, 48);
    }

    #[test]
    fn position_offsets_sum_to_struct_len() {
        // LEN = 8 + 32 + 32 + 8 + 8 + 1 = 89.
        assert_eq!(Position::LEN, 89);
    }

    #[test]
    fn market_discriminator_exists() {
        let d = Market::DISCRIMINATOR;
        assert_eq!(d.len(), 8);
    }

    #[test]
    fn position_discriminator_exists() {
        let d = Position::DISCRIMINATOR;
        assert_eq!(d.len(), 8);
    }
}
