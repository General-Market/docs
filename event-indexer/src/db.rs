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
