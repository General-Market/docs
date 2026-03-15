import db

MIGRATIONS = [
    """
    CREATE TABLE IF NOT EXISTS social_anomalies (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        asset_id TEXT,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        raw_data JSONB NOT NULL,
        context JSONB DEFAULT '{}',
        suggested_account TEXT,
        suggested_headline TEXT,
        suggested_outcome TEXT,
        status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, skipped, posted
        final_tweet TEXT,
        outcome_tag TEXT,
        virality_score INT,
        skip_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS social_posted (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        account TEXT NOT NULL,
        tweet_text TEXT NOT NULL,
        tweet_id TEXT,
        outcome_tag TEXT,
        virality_score INT,
        dedup_key TEXT,
        posted_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS social_event_log (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        event_type TEXT NOT NULL,
        region TEXT,
        value DECIMAL(30,10),
        occurred_at TIMESTAMPTZ NOT NULL,
        asset_id TEXT,
        metadata JSONB DEFAULT '{}'
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_social_anomalies_status ON social_anomalies(status)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_social_posted_account ON social_posted(account, posted_at DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_social_posted_dedup ON social_posted(dedup_key)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_social_event_log_source ON social_event_log(source, occurred_at DESC)
    """,
]

def migrate():
    for sql in MIGRATIONS:
        db.execute(sql)
    print(f"Ran {len(MIGRATIONS)} migrations")

if __name__ == "__main__":
    migrate()
