import db
from datetime import datetime, timedelta

def compute_context(source: str, asset_id: str, current_value: float, context_priority: list[str]) -> dict:
    """Compute context fields based on priority list from threshold rules."""
    context = {}
    for field in context_priority:
        if field == "frequency":
            context["frequency"] = _compute_frequency(source, asset_id)
        elif field == "comparison":
            context["comparison"] = _compute_comparison(source, asset_id, current_value)
        elif field == "trend":
            context["trend"] = _compute_trend(source, asset_id)
        elif field == "delta":
            context["delta"] = _compute_delta(source, asset_id, current_value)
        elif field == "human_scale":
            context["human_scale"] = None  # Populated from raw_data metadata
    return {k: v for k, v in context.items() if v is not None}

def _compute_frequency(source: str, asset_id: str) -> str | None:
    """How many similar events in the last 7 days."""
    row = db.query_one("""
        SELECT COUNT(*) as cnt FROM social_event_log
        WHERE source = %s AND event_type = %s
        AND occurred_at > NOW() - INTERVAL '7 days'
    """, (source, asset_id))
    if row and row["cnt"] > 1:
        n = row["cnt"]
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n if n < 4 else 0, "th")
        return f"{n}{suffix} this week"
    return None

def _compute_comparison(source: str, asset_id: str, current_value: float) -> str | None:
    """When was the last time the value was this high/low."""
    row = db.query_one("""
        SELECT MAX(fetched_at) as last_time FROM market_prices
        WHERE source = %s AND asset_id = %s AND value >= %s
        AND fetched_at < NOW() - INTERVAL '30 days'
    """, (source, asset_id, current_value))
    if row and row["last_time"]:
        return f"highest since {row['last_time'].strftime('%B %Y')}"
    # Check if it's an all-time high in our data
    row2 = db.query_one("""
        SELECT MAX(value) as max_val FROM market_prices
        WHERE source = %s AND asset_id = %s
    """, (source, asset_id))
    if row2 and row2["max_val"] and current_value > float(row2["max_val"]):
        return "all-time high in our records"
    return None

def _compute_trend(source: str, asset_id: str) -> str | None:
    """Consecutive days of increase/decrease."""
    rows = db.query("""
        SELECT DATE(fetched_at) as day, AVG(value) as avg_val
        FROM market_prices
        WHERE source = %s AND asset_id = %s
        AND fetched_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(fetched_at)
        ORDER BY day DESC
        LIMIT 30
    """, (source, asset_id))
    if len(rows) < 2:
        return None
    direction = "rising" if rows[0]["avg_val"] > rows[1]["avg_val"] else "falling"
    streak = 1
    for i in range(1, len(rows) - 1):
        if direction == "rising" and rows[i]["avg_val"] > rows[i+1]["avg_val"]:
            streak += 1
        elif direction == "falling" and rows[i]["avg_val"] < rows[i+1]["avg_val"]:
            streak += 1
        else:
            break
    if streak >= 3:
        return f"{direction} for {streak} consecutive days"
    return None

def _compute_delta(source: str, asset_id: str, current_value: float) -> str | None:
    """Percentage change vs 30-day average."""
    row = db.query_one("""
        SELECT AVG(value) as avg_30d FROM market_prices
        WHERE source = %s AND asset_id = %s
        AND fetched_at > NOW() - INTERVAL '30 days'
    """, (source, asset_id))
    if row and row["avg_30d"] and float(row["avg_30d"]) > 0:
        pct = ((current_value - float(row["avg_30d"])) / float(row["avg_30d"])) * 100
        if abs(pct) >= 50:
            direction = "above" if pct > 0 else "below"
            return f"{abs(pct):.0f}% {direction} 30-day average"
    return None
