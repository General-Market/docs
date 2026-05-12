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

/// Advisory-lock key used to serialize concurrent migrators.
/// 42 is preserved for backward compatibility with already-running services.
const MIGRATION_LOCK_KEY: i64 = 42;

/// Run all SQL migrations in `migrations_dir` that haven't been applied yet.
/// Tracks applied migrations in `_applied_migrations` table.
///
/// **Concurrency model.** Each migration is applied inside its own
/// `BEGIN .. COMMIT`. The transaction starts with `pg_advisory_xact_lock(42)`,
/// which serializes concurrent migrators and auto-releases on commit/rollback.
///
/// This pattern is mandatory when fronted by PgBouncer in `pool_mode = transaction`:
/// session-scoped advisory locks would silently leak — `pg_advisory_lock` acquires
/// on one backend, the unlock arrives at a different backend, and the original
/// backend stays idle in the pool holding the lock indefinitely, blocking every
/// future migrator forever.
///
/// Returns the number of newly applied migrations.
pub async fn run_migrations(pool: &PgPool, migrations_dir: &Path) -> Result<usize, MigrationError> {
    // Create tracking table outside any lock — idempotent, safe under race.
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _applied_migrations (
            name TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        )"
    )
    .execute(pool)
    .await?;

    // Read all .sql files, sorted by name.
    let mut entries: Vec<_> = std::fs::read_dir(migrations_dir)?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "sql").unwrap_or(false))
        .collect();
    entries.sort_by_key(|e| e.file_name());

    let mut count = 0;
    for entry in entries {
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip without acquiring the lock if obviously already applied.
        let already_applied: Option<String> = sqlx::query_scalar(
            "SELECT name FROM _applied_migrations WHERE name = $1"
        )
        .bind(&name)
        .fetch_optional(pool)
        .await?;
        if already_applied.is_some() {
            continue;
        }

        let sql = std::fs::read_to_string(entry.path())?;
        if apply_one(pool, &name, &sql).await? {
            count += 1;
        }
    }

    if count > 0 {
        info!("Applied {count} new migration(s)");
    }
    Ok(count)
}

/// Apply a single migration inside one transaction guarded by an
/// xact-scoped advisory lock. Returns true if the migration ran; false if
/// another instance applied it first while we were waiting on the lock.
async fn apply_one(pool: &PgPool, name: &str, sql: &str) -> Result<bool, MigrationError> {
    let mut tx = pool.begin().await?;

    // Pin the transaction's backend and serialize against other migrators.
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(MIGRATION_LOCK_KEY)
        .execute(&mut *tx)
        .await?;

    // Re-check: a concurrent migrator may have applied this between our
    // earlier optimistic check and lock acquisition.
    let already: Option<String> = sqlx::query_scalar(
        "SELECT name FROM _applied_migrations WHERE name = $1"
    )
    .bind(name)
    .fetch_optional(&mut *tx)
    .await?;
    if already.is_some() {
        tx.commit().await?;
        return Ok(false);
    }

    info!("Applying migration: {name}");

    for statement in sql.split(';') {
        let trimmed = statement.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Err(e) = sqlx::query(trimmed).execute(&mut *tx).await {
            warn!(
                "Migration {name} statement failed: {e}. Statement: {}",
                &trimmed[..trimmed.len().min(100)]
            );
            // "already exists" is treated as success for idempotency. Anything
            // else aborts the transaction; the xact_lock is released automatically.
            if !e.to_string().contains("already exists") {
                return Err(MigrationError::Sql(e));
            }
        }
    }

    sqlx::query("INSERT INTO _applied_migrations (name) VALUES ($1)")
        .bind(name)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    info!("Migration applied: {name}");
    Ok(true)
}
