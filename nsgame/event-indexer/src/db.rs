//! Postgres pool + idempotent schema bootstrap. The SQL is shipped as a
//! literal include; the schema name is interpolated by string substitution
//! because Postgres does not accept identifier placeholders.

use anyhow::{Context, Result};
use deadpool_postgres::{Config as PgConfig, ManagerConfig, Pool, RecyclingMethod, Runtime};
use std::str::FromStr;
use tokio_postgres::{config::Config as ClientConfig, NoTls};
use tracing::info;

const SCHEMA_SQL: &str = include_str!("schema.sql");

pub async fn build_pool(postgres_url: &str) -> Result<Pool> {
    // Parse the url once to populate the deadpool config. tokio-postgres
    // takes a libpq-style connection string; we mirror that surface so
    // operators can paste the same URL they use elsewhere.
    let client_cfg = ClientConfig::from_str(postgres_url)
        .context("POSTGRES_URL is not a valid tokio-postgres connection string")?;

    let mut cfg = PgConfig::new();
    cfg.host = Some(client_cfg.get_hosts().iter().filter_map(|h| match h {
        tokio_postgres::config::Host::Tcp(s) => Some(s.clone()),
        _ => None,
    }).next().unwrap_or_else(|| "localhost".to_string()));
    cfg.port = client_cfg.get_ports().first().copied();
    cfg.user = client_cfg.get_user().map(|s| s.to_string());
    cfg.password = client_cfg.get_password()
        .and_then(|b| std::str::from_utf8(b).ok())
        .map(|s| s.to_string());
    cfg.dbname = client_cfg.get_dbname().map(|s| s.to_string());
    cfg.manager = Some(ManagerConfig { recycling_method: RecyclingMethod::Fast });

    let pool = cfg.create_pool(Some(Runtime::Tokio1), NoTls)
        .context("failed to build postgres pool")?;

    // Touch the pool once so a broken connection string fails at boot
    // rather than on first write.
    let _ = pool.get().await.context("unable to connect to postgres")?;
    Ok(pool)
}

/// Apply the schema. Runs every boot; every statement is `IF NOT EXISTS`
/// or `OR REPLACE`. Running twice is a no-op.
pub async fn ensure_schema(pool: &Pool, schema: &str) -> Result<()> {
    validate_schema_name(schema)?;
    let sql = SCHEMA_SQL.replace("__SCHEMA__", schema);
    let client = pool.get().await.context("postgres checkout failed")?;
    client.batch_execute(&sql).await
        .context("failed to apply schema.sql")?;
    info!(schema = %schema, "schema applied");
    Ok(())
}

/// The newest signature we've durably written. Returned as `(signature, slot)`.
/// `None` means the indexer has never written a row — a fresh install.
pub async fn load_cursor(pool: &Pool, schema: &str) -> Result<Option<(String, u64)>> {
    validate_schema_name(schema)?;
    let client = pool.get().await.context("postgres checkout failed")?;
    let sql = format!(
        "SELECT tx_signature, slot FROM {schema}.indexer_cursor WHERE id = 1",
        schema = schema,
    );
    let row = client.query_opt(&sql, &[]).await.context("load_cursor query failed")?;
    Ok(row.map(|r| {
        let sig: String = r.get(0);
        let slot: i64 = r.get(1);
        (sig, slot as u64)
    }))
}

/// Move the cursor forward. Called after every successful write batch. The
/// `ON CONFLICT` clause turns the first write into an INSERT and every
/// subsequent write into an UPDATE, keeping the table at exactly one row.
///
/// Only moves forward — a write for an older slot (possible during backfill
/// reordering) is ignored. The guard preserves the invariant that the cursor
/// always points at the newest durably-written signature.
pub async fn save_cursor(pool: &Pool, schema: &str, signature: &str, slot: u64) -> Result<()> {
    validate_schema_name(schema)?;
    let client = pool.get().await.context("postgres checkout failed")?;
    let sql = format!(
        "INSERT INTO {schema}.indexer_cursor (id, tx_signature, slot, updated_at) \
         VALUES (1, $1, $2, NOW()) \
         ON CONFLICT (id) DO UPDATE SET \
             tx_signature = EXCLUDED.tx_signature, \
             slot = EXCLUDED.slot, \
             updated_at = EXCLUDED.updated_at \
         WHERE {schema}.indexer_cursor.slot < EXCLUDED.slot",
        schema = schema,
    );
    client
        .execute(&sql, &[&signature.to_string(), &(slot as i64)])
        .await
        .context("save_cursor upsert failed")?;
    Ok(())
}

/// Reject anything but `[A-Za-z0-9_]`. We are interpolating into DDL —
/// a stray quote would be a disaster.
fn validate_schema_name(schema: &str) -> Result<()> {
    if schema.is_empty() || !schema.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        anyhow::bail!("POSTGRES_SCHEMA must match [A-Za-z0-9_]+ — got {schema:?}");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schema_name_validation() {
        assert!(validate_schema_name("prediction_market").is_ok());
        assert!(validate_schema_name("pm_v2").is_ok());
        assert!(validate_schema_name("").is_err());
        assert!(validate_schema_name("drop table;").is_err());
        assert!(validate_schema_name("bad-name").is_err());
    }
}
