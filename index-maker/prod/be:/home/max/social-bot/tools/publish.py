import db

def approve_anomaly(anomaly_id: str, final_tweet: str, account: str,
                    outcome_tag: str, virality_score: int) -> dict:
    """Mark an anomaly as approved in the DB. Does NOT post — the local
    /loop writes to scheduled.csv, and poster.py does the actual posting."""
    anomaly = db.query_one("SELECT * FROM social_anomalies WHERE id = %s", (anomaly_id,))
    if not anomaly:
        return {"error": f"Anomaly {anomaly_id} not found"}
    if anomaly["status"] in ("posted", "approved"):
        return {"error": f"Already {anomaly['status']}"}

    db.execute("""
        UPDATE social_anomalies SET status = 'approved', final_tweet = %s,
            outcome_tag = %s, virality_score = %s
        WHERE id = %s
    """, (final_tweet, outcome_tag, virality_score, anomaly_id))

    return {"approved": anomaly_id, "account": account, "tweet": final_tweet}

def get_last_posted(account: str = None, limit: int = 10) -> list[dict]:
    """Recent tweets per account."""
    if account:
        rows = db.query("""
            SELECT id, account, tweet_text, outcome_tag, virality_score, posted_at
            FROM social_posted WHERE account = %s
            ORDER BY posted_at DESC LIMIT %s
        """, (account, limit))
    else:
        rows = db.query("""
            SELECT id, account, tweet_text, outcome_tag, virality_score, posted_at
            FROM social_posted ORDER BY posted_at DESC LIMIT %s
        """, (limit,))
    for row in rows:
        row["posted_at"] = str(row["posted_at"])
    return rows

def get_posted(days: int = 1) -> list[dict]:
    """All tweets posted in N days."""
    rows = db.query("""
        SELECT id, account, tweet_text, tweet_id, outcome_tag, virality_score, posted_at
        FROM social_posted WHERE posted_at > NOW() - INTERVAL '%s days'
        ORDER BY posted_at DESC
    """, (days,))
    for row in rows:
        row["posted_at"] = str(row["posted_at"])
    return rows
