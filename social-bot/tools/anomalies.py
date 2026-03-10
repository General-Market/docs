import json
import db
from engine.detector import run_detection

def get_anomalies(source: str = None, limit: int = 20) -> list[dict]:
    """Get pending anomaly candidates."""
    if source:
        rows = db.query("""
            SELECT id, source, asset_id, raw_data, context, suggested_account,
                   suggested_headline, suggested_outcome, created_at
            FROM social_anomalies WHERE status = 'pending' AND source = %s
            ORDER BY created_at DESC LIMIT %s
        """, (source, limit))
    else:
        rows = db.query("""
            SELECT id, source, asset_id, raw_data, context, suggested_account,
                   suggested_headline, suggested_outcome, created_at
            FROM social_anomalies WHERE status = 'pending'
            ORDER BY created_at DESC LIMIT %s
        """, (limit,))
    for row in rows:
        row["raw_data"] = row["raw_data"] if isinstance(row["raw_data"], dict) else json.loads(row["raw_data"])
        row["context"] = row["context"] if isinstance(row["context"], dict) else json.loads(row["context"])
        row["created_at"] = str(row["created_at"])
    return rows

def skip_anomaly(anomaly_id: str, reason: str) -> dict:
    """Mark an anomaly as skipped."""
    db.execute("""
        UPDATE social_anomalies SET status = 'skipped', skip_reason = %s WHERE id = %s
    """, (reason, anomaly_id))
    return {"skipped": anomaly_id, "reason": reason}
