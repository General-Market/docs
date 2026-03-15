import db

def is_duplicate(dedup_key: str) -> bool:
    """Check if we already posted a tweet with this dedup key."""
    row = db.query_one(
        "SELECT 1 FROM social_posted WHERE dedup_key = %s", (dedup_key,)
    )
    return row is not None

def is_pending(dedup_key: str) -> bool:
    """Check if there's already a pending anomaly with this dedup key."""
    row = db.query_one(
        "SELECT 1 FROM social_anomalies WHERE id LIKE %s AND status = 'pending'",
        (f"%{dedup_key}%",)
    )
    return row is not None
