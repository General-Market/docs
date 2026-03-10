import db

def search_assets(query: str, source: str = None, days: int = 90) -> list[dict]:
    """Search all market_assets by name/symbol, including archived ones."""
    if source:
        rows = db.query("""
            SELECT a.source, a.asset_id, a.symbol, a.name, a.category, a.is_active,
                   l.value as last_value, l.fetched_at as last_updated
            FROM market_assets a
            LEFT JOIN market_prices_latest l ON a.source = l.source AND a.asset_id = l.asset_id
            WHERE a.source = %s AND (a.name ILIKE %s OR a.symbol ILIKE %s OR a.asset_id ILIKE %s)
            ORDER BY l.fetched_at DESC NULLS LAST
            LIMIT 50
        """, (source, f"%{query}%", f"%{query}%", f"%{query}%"))
    else:
        rows = db.query("""
            SELECT a.source, a.asset_id, a.symbol, a.name, a.category, a.is_active,
                   l.value as last_value, l.fetched_at as last_updated
            FROM market_assets a
            LEFT JOIN market_prices_latest l ON a.source = l.source AND a.asset_id = l.asset_id
            WHERE a.name ILIKE %s OR a.symbol ILIKE %s OR a.asset_id ILIKE %s
            ORDER BY l.fetched_at DESC NULLS LAST
            LIMIT 50
        """, (f"%{query}%", f"%{query}%", f"%{query}%"))
    for row in rows:
        row["last_value"] = str(row["last_value"]) if row["last_value"] else None
        row["last_updated"] = str(row["last_updated"]) if row["last_updated"] else None
    return rows

def get_history(source: str, asset_id: str, days: int = 30) -> list[dict]:
    """Full price history for any asset (including archived)."""
    rows = db.query("""
        SELECT value, change_pct, volume_24h, fetched_at
        FROM market_prices
        WHERE source = %s AND asset_id = %s
        AND fetched_at > NOW() - INTERVAL '%s days'
        ORDER BY fetched_at DESC
        LIMIT 5000
    """, (source, asset_id, days))
    return [{"value": str(r["value"]), "change_pct": str(r["change_pct"]),
             "fetched_at": str(r["fetched_at"])} for r in rows]

def get_frequency(source: str, event_type: str, region: str = None, days: int = 7) -> dict:
    """Count events of a type in a time window."""
    if region:
        row = db.query_one("""
            SELECT COUNT(*) as count FROM social_event_log
            WHERE source = %s AND event_type ILIKE %s AND region ILIKE %s
            AND occurred_at > NOW() - INTERVAL '%s days'
        """, (source, f"%{event_type}%", f"%{region}%", days))
    else:
        row = db.query_one("""
            SELECT COUNT(*) as count FROM social_event_log
            WHERE source = %s AND event_type ILIKE %s
            AND occurred_at > NOW() - INTERVAL '%s days'
        """, (source, f"%{event_type}%", days))
    count = row["count"] if row else 0

    avg_row = db.query_one("""
        SELECT COUNT(*) as total FROM social_event_log
        WHERE source = %s AND event_type ILIKE %s
        AND occurred_at > NOW() - INTERVAL '90 days'
    """, (source, f"%{event_type}%"))
    total_90d = avg_row["total"] if avg_row else 0
    avg_per_period = (total_90d / 90) * days if total_90d else 0

    return {
        "count": count,
        "period_days": days,
        "avg_per_period": round(avg_per_period, 1),
        "is_unusual": count > avg_per_period * 2 if avg_per_period > 0 else count > 0,
    }

def get_compare(source: str, asset_id: str) -> dict:
    """Current value vs rolling statistics."""
    current = db.query_one("""
        SELECT value FROM market_prices_latest
        WHERE source = %s AND asset_id = %s
    """, (source, asset_id))
    if not current:
        return {"error": "Asset not found in latest prices"}

    stats = db.query_one("""
        SELECT
            AVG(value) FILTER (WHERE fetched_at > NOW() - INTERVAL '7 days') as avg_7d,
            AVG(value) FILTER (WHERE fetched_at > NOW() - INTERVAL '30 days') as avg_30d,
            AVG(value) FILTER (WHERE fetched_at > NOW() - INTERVAL '90 days') as avg_90d,
            AVG(value) as avg_1y,
            MIN(value) FILTER (WHERE fetched_at > NOW() - INTERVAL '30 days') as min_30d,
            MAX(value) FILTER (WHERE fetched_at > NOW() - INTERVAL '30 days') as max_30d,
            MIN(value) as min_1y,
            MAX(value) as max_1y
        FROM market_prices
        WHERE source = %s AND asset_id = %s
    """, (source, asset_id))

    last_this_high = db.query_one("""
        SELECT MAX(fetched_at) as last_time FROM market_prices
        WHERE source = %s AND asset_id = %s AND value >= %s
        AND fetched_at < NOW() - INTERVAL '7 days'
    """, (source, asset_id, current["value"]))

    result = {"current": str(current["value"])}
    if stats:
        for key in ["avg_7d", "avg_30d", "avg_90d", "avg_1y", "min_30d", "max_30d", "min_1y", "max_1y"]:
            result[key] = str(stats[key]) if stats[key] else None
    result["last_time_this_high"] = str(last_this_high["last_time"]) if last_this_high and last_this_high["last_time"] else None
    return result

def list_assets(source: str, from_date: str = None, to_date: str = None, active_only: bool = True) -> list[dict]:
    """List assets that existed in a time range."""
    if from_date and to_date:
        rows = db.query("""
            SELECT DISTINCT ON (a.source, a.asset_id) a.source, a.asset_id, a.symbol, a.name, a.category, a.is_active
            FROM market_assets a
            JOIN market_prices p ON a.source = p.source AND a.asset_id = p.asset_id
            WHERE a.source = %s AND p.fetched_at BETWEEN %s AND %s
            ORDER BY a.source, a.asset_id
            LIMIT 500
        """, (source, from_date, to_date))
    elif active_only:
        rows = db.query("""
            SELECT source, asset_id, symbol, name, category, is_active
            FROM market_assets WHERE source = %s AND is_active = TRUE
            ORDER BY symbol LIMIT 500
        """, (source,))
    else:
        rows = db.query("""
            SELECT source, asset_id, symbol, name, category, is_active
            FROM market_assets WHERE source = %s
            ORDER BY symbol LIMIT 500
        """, (source,))
    return rows
