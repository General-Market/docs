import json
import uuid
from datetime import datetime
import db
from engine.thresholds import load_thresholds, evaluate_rules
from engine.context import compute_context
from engine.dedup import is_duplicate, is_pending

def run_detection():
    """Main detection loop. Scans market_prices_latest against thresholds."""
    thresholds = load_thresholds()
    candidates = []

    for source_name, source_config in thresholds.items():
        source_candidates = _detect_source(source_name, source_config)
        candidates.extend(source_candidates)

    return candidates

def _detect_source(source_name: str, config: dict) -> list[dict]:
    """Detect anomalies for a single source."""
    db_sources = config.get("sources", [source_name])
    candidates = []

    for db_source in db_sources:
        rows = db.query("""
            SELECT asset_id, symbol, name, value, change_pct, volume_24h,
                   market_cap, category, fetched_at
            FROM market_prices_latest
            WHERE source = %s
        """, (db_source,))

        for row in rows:
            data = _row_to_eval_data(row, db_source, config)
            match = evaluate_rules(config, data)
            if match is None:
                continue

            # Build dedup key
            dedup_template = config.get("dedup", "source+asset+day")
            dedup_key = _build_dedup_key(dedup_template, db_source, row)

            if is_duplicate(dedup_key) or is_pending(dedup_key):
                continue

            # Compute context
            context = compute_context(
                db_source, row["asset_id"], float(row["value"]),
                match.get("context_priority", [])
            )

            # Log event
            db.execute("""
                INSERT INTO social_event_log (source, event_type, region, value, occurred_at, asset_id)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (db_source, row["asset_id"], row.get("category"), row["value"], datetime.utcnow(), row["asset_id"]))

            candidate_id = f"{db_source}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:4]}"
            account = config.get("account", "GeneralMarket")

            candidate = {
                "id": candidate_id,
                "source": db_source,
                "asset_id": row["asset_id"],
                "raw_data": {
                    "symbol": row["symbol"],
                    "name": row["name"],
                    "value": str(row["value"]),
                    "change_pct": str(row["change_pct"]) if row["change_pct"] else None,
                    "volume_24h": str(row["volume_24h"]) if row["volume_24h"] else None,
                    "market_cap": str(row["market_cap"]) if row["market_cap"] else None,
                    "category": row["category"],
                },
                "context": context,
                "suggested_account": account,
                "suggested_headline": _generate_suggestion(db_source, row, context, match["outcome"]),
                "suggested_outcome": match["outcome"],
            }

            # Store in DB
            db.execute("""
                INSERT INTO social_anomalies (id, source, asset_id, raw_data, context,
                    suggested_account, suggested_headline, suggested_outcome)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                candidate_id, db_source, row["asset_id"],
                json.dumps(candidate["raw_data"]), json.dumps(context),
                account, candidate["suggested_headline"], match["outcome"]
            ))

            candidates.append(candidate)

    return candidates

def _row_to_eval_data(row: dict, source: str, config: dict) -> dict:
    """Convert a DB row + source metadata into a flat dict for rule evaluation."""
    data = {
        "value": float(row["value"]),
        "change_pct": float(row["change_pct"]) if row["change_pct"] else 0,
        "volume_24h": float(row["volume_24h"]) if row["volume_24h"] else 0,
        "market_cap": float(row["market_cap"]) if row["market_cap"] else 0,
    }
    field_map = {
        "earthquake": {"magnitude": "value"},
        "power_outages": {"customers": "value"},
        "ioda": {"connectivity": "value"},
        "spaceweather": {"kp": "value"},
        "wildfire": {"hotspots_6h": "value"},
        "sec": {"trade_value": "value"},
        "finra": {"short_volume_pct": "value"},
        "mcbroken": {"city_pct": "value"},
        "airnow": {"aqi": "value"},
        "cbp_border": {"wait_hours": "value"},
        "queue_times": {"wait_min": "value"},
        "congress": {"trade_value": "value"},
    }
    if source in field_map:
        for alias, field in field_map[source].items():
            data[alias] = data.get(field, data.get("value", 0))
    return data

def _build_dedup_key(template: str, source: str, row: dict) -> str:
    """Build dedup key from template like 'region+day' or 'source+asset+day'."""
    parts = template.split("+")
    key_parts = []
    for part in parts:
        if part == "source":
            key_parts.append(source)
        elif part == "day":
            key_parts.append(datetime.utcnow().strftime("%Y-%m-%d"))
        elif part == "week":
            key_parts.append(datetime.utcnow().strftime("%Y-W%W"))
        elif part == "month":
            key_parts.append(datetime.utcnow().strftime("%Y-%m"))
        elif part == "asset":
            key_parts.append(row.get("asset_id") or "")
        elif part == "region":
            key_parts.append(row.get("category") or "")
        else:
            key_parts.append(row.get(part) or part)
    return ":".join(key_parts)

def _generate_suggestion(source: str, row: dict, context: dict, outcome: str) -> str:
    """Generate a basic headline suggestion. Claude will rewrite this."""
    name = row.get("name") or row.get("symbol") or row.get("asset_id")
    value = row["value"]
    ctx_parts = [v for v in context.values() if v]
    ctx_str = " — ".join(ctx_parts) if ctx_parts else ""
    return f"[{outcome}] {source}: {name} at {value}. {ctx_str}".strip()
