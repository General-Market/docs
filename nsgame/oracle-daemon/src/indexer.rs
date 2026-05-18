//! Indexer-backed candidate discovery.
//!
//! Replaces the program-wide `getProgramAccounts` filter scans in
//! [`crate::scanner::Scanner`] with cheap indexed SQL against the
//! event-indexer Postgres. Helius free tier rejects the bulk read with
//! 429 once the on-chain account count grows past ~1000; the indexer
//! happily returns the same candidate set in milliseconds because every
//! row was streamed in via `logsSubscribe` exactly once.
//!
//! What stays on the chain: per-market `getMultipleAccounts` for the
//! candidate set returned here. That call is a per-tx flat cost and
//! survives the free tier.
//!
//! Source of truth: `prediction_market.market_instantiated`,
//! `market_closed`, `market_resolved`, `bet_placed`, `claimed`.

use anyhow::{Context, Result};
use solana_pubkey::Pubkey;
use std::str::FromStr;
use tokio_postgres::{Client, NoTls};

#[derive(Debug, Clone)]
pub struct MarketCandidate {
    pub address: Pubkey,
    pub source_id: u32,
    pub close_time: i64,
    pub settlement_time: i64,
    pub threshold_bps: i32,
}

#[derive(Debug, Clone)]
pub struct PositionCandidate {
    pub market: Pubkey,
    pub owner: Pubkey,
}

pub struct IndexerClient {
    client: Client,
    schema: String,
}

impl IndexerClient {
    pub async fn connect(url: &str, schema: String) -> Result<Self> {
        let (client, conn) = tokio_postgres::connect(url, NoTls)
            .await
            .context("connect to indexer postgres")?;
        // Drive the connection in the background. If it dies, log loud —
        // every subsequent query will return an error so the scheduler
        // falls back to its on-chain path automatically.
        tokio::spawn(async move {
            if let Err(e) = conn.await {
                tracing::error!(error = %e, "indexer postgres connection lost");
            }
        });
        Ok(Self { client, schema })
    }

    /// Markets whose `close_time` has passed and which the indexer has
    /// not yet seen a `market_closed` event for. Limit caps the per-tick
    /// work; the next tick picks up the rest.
    pub async fn markets_needing_close(
        &self,
        now: i64,
        limit: i64,
    ) -> Result<Vec<MarketCandidate>> {
        let sql = format!(
            "SELECT mi.market, mi.source_id, mi.close_time, mi.settlement_time, mi.threshold_bps
               FROM {schema}.market_instantiated mi
               LEFT JOIN {schema}.market_closed mc ON mc.market = mi.market
              WHERE mc.market IS NULL
                AND mi.close_time <= $1
              ORDER BY mi.close_time
              LIMIT $2",
            schema = self.schema,
        );
        let rows = self
            .client
            .query(sql.as_str(), &[&now, &limit])
            .await
            .context("query markets_needing_close")?;
        Self::rows_to_market_candidates(rows)
    }

    /// Markets that have been closed (baseline written) but not yet
    /// resolved, whose `settlement_time` has passed.
    pub async fn markets_needing_resolve(
        &self,
        now: i64,
        limit: i64,
    ) -> Result<Vec<MarketCandidate>> {
        let sql = format!(
            "SELECT mi.market, mi.source_id, mi.close_time, mi.settlement_time, mi.threshold_bps
               FROM {schema}.market_instantiated mi
               JOIN {schema}.market_closed mc ON mc.market = mi.market
               LEFT JOIN {schema}.market_resolved mr ON mr.market = mi.market
              WHERE mr.market IS NULL
                AND mi.settlement_time <= $1
              ORDER BY mi.settlement_time
              LIMIT $2",
            schema = self.schema,
        );
        let rows = self
            .client
            .query(sql.as_str(), &[&now, &limit])
            .await
            .context("query markets_needing_resolve")?;
        Self::rows_to_market_candidates(rows)
    }

    /// `(market, owner)` pairs where the wallet placed at least one bet
    /// on a resolved market and has not yet claimed. The Position PDA is
    /// deterministic from `(market, owner)` so the cranker can derive it
    /// without a second round-trip to the indexer.
    pub async fn positions_needing_claim(
        &self,
        limit: i64,
    ) -> Result<Vec<PositionCandidate>> {
        let sql = format!(
            "SELECT bp.market, bp.owner
               FROM {schema}.bet_placed bp
               JOIN {schema}.market_resolved mr ON mr.market = bp.market
               LEFT JOIN {schema}.claimed c
                      ON c.market = bp.market AND c.owner = bp.owner
              WHERE c.signature IS NULL
              GROUP BY bp.market, bp.owner
              LIMIT $1",
            schema = self.schema,
        );
        let rows = self
            .client
            .query(sql.as_str(), &[&limit])
            .await
            .context("query positions_needing_claim")?;
        let mut out = Vec::with_capacity(rows.len());
        for row in rows {
            let market: String = row.get(0);
            let owner: String = row.get(1);
            out.push(PositionCandidate {
                market: Pubkey::from_str(&market).context("parse market pubkey")?,
                owner: Pubkey::from_str(&owner).context("parse owner pubkey")?,
            });
        }
        Ok(out)
    }

    fn rows_to_market_candidates(
        rows: Vec<tokio_postgres::Row>,
    ) -> Result<Vec<MarketCandidate>> {
        let mut out = Vec::with_capacity(rows.len());
        for row in rows {
            let market: String = row.get(0);
            // source_id is bigint in the schema (i64), even though the
            // on-chain type is u32. Cast on read.
            let source_id: i64 = row.get(1);
            let close_time: i64 = row.get(2);
            let settlement_time: i64 = row.get(3);
            let threshold_bps: i32 = row.get(4);
            out.push(MarketCandidate {
                address: Pubkey::from_str(&market).context("parse market pubkey")?,
                source_id: source_id as u32,
                close_time,
                settlement_time,
                threshold_bps,
            });
        }
        Ok(out)
    }
}
