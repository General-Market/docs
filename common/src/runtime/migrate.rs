use sqlx::PgPool;
use std::path::Path;
use tracing::{info, warn};

#[derive(Debug, thiserror::Error)]
pub enum MigrationError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("SQL error: {0}")]
    Sql(#[from] sqlx::Error),
}

/// Run all SQL migrations in `migrations_dir` that haven't been applied yet.
/// Tracks applied migrations in `_applied_migrations` table.
///
/// Uses `pg_advisory_lock(42)` to serialize concurrent instances (e.g., multiple
/// oracle containers starting simultaneously). This prevents race conditions where
/// two instances both see a migration as unapplied and try to run it.
///
/// **CRITICAL:** The advisory lock is acquired on a single pooled connection, and ALL
/// migration queries run on that SAME connection. Advisory locks are per-connection --
/// acquiring on one connection and querying on another (which `pool.execute()` may do)
/// would defeat the lock entirely.
///
/// Returns the number of newly applied migrations.
pub async fn run_migrations(pool: &PgPool, migrations_dir: &Path) -> Result<usize, MigrationError> {
    // Acquire a single connection -- advisory lock is bound to this connection
    let mut conn = pool.acquire().await?;

    // Acquire advisory lock on THIS connection
    sqlx::query("SELECT pg_advisory_lock(42)")
        .execute(&mut *conn)
        .await?;

    let result = run_migrations_inner(&mut conn, migrations_dir).await;

    // Always release the lock on the SAME connection, even on error
    let _ = sqlx::query("SELECT pg_advisory_unlock(42)")
        .execute(&mut *conn)
        .await;

    // conn drops here, returning to pool
    result
}

async fn run_migrations_inner(
    conn: &mut sqlx::pool::PoolConnection<sqlx::Postgres>,
    migrations_dir: &Path,
) -> Result<usize, MigrationError> {
    // Create tracking table if not exists
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _applied_migrations (
            name TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        )"
    )
    .execute(&mut **conn)
    .await?;

    // Read all .sql files, sorted by name
    let mut entries: Vec<_> = std::fs::read_dir(migrations_dir)?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "sql").unwrap_or(false))
        .collect();
    entries.sort_by_key(|e| e.file_name());

    // Get already applied -- uses same connection that holds the lock
    let applied: Vec<String> = sqlx::query_scalar("SELECT name FROM _applied_migrations")
        .fetch_all(&mut **conn)
        .await?;

    let mut count = 0;
    for entry in entries {
        let name = entry.file_name().to_string_lossy().to_string();
        if applied.contains(&name) {
            continue;
        }

        let sql = std::fs::read_to_string(entry.path())?;
        info!("Applying migration: {name}");

        // Split on semicolons for multi-statement migrations.
        // Run directly on the locked connection -- advisory lock serializes access.
        for statement in sql.split(';') {
            let trimmed = statement.trim();
            if !trimmed.is_empty() {
                if let Err(e) = sqlx::query(trimmed).execute(&mut **conn).await {
                    warn!("Migration {name} statement failed: {e}. Statement: {}", &trimmed[..trimmed.len().min(100)]);
                    // Don't fail on IF NOT EXISTS errors
                    if !e.to_string().contains("already exists") {
                        return Err(MigrationError::Sql(e));
                    }
                }
            }
        }

        sqlx::query("INSERT INTO _applied_migrations (name) VALUES ($1)")
            .bind(&name)
            .execute(&mut **conn)
            .await?;

        count += 1;
        info!("Migration applied: {name}");
    }

    if count > 0 {
        info!("Applied {count} new migration(s)");
    }

    Ok(count)
}
