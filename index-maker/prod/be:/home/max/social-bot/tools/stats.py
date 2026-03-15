import db

def get_stats() -> dict:
    """Dashboard stats."""
    pending = db.query_one("SELECT COUNT(*) as c FROM social_anomalies WHERE status = 'pending'")
    posted_today = db.query("""
        SELECT account, COUNT(*) as c FROM social_posted
        WHERE posted_at > CURRENT_DATE GROUP BY account
    """)
    skipped_today = db.query_one("""
        SELECT COUNT(*) as c FROM social_anomalies
        WHERE status = 'skipped' AND created_at > CURRENT_DATE
    """)
    total_posted = db.query_one("SELECT COUNT(*) as c FROM social_posted")

    return {
        "pending_anomalies": pending["c"] if pending else 0,
        "posted_today": {row["account"]: row["c"] for row in posted_today} if posted_today else {},
        "skipped_today": skipped_today["c"] if skipped_today else 0,
        "total_posted_all_time": total_posted["c"] if total_posted else 0,
    }
