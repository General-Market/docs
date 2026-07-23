#!/usr/bin/env python3
"""Measure community liveness per cashtag: pull recent tweets mentioning each
cashtag and compute posting velocity (tweets/hour) + unique authors.
A live community = high velocity + many distinct authors searching/posting the tag."""
import json
from datetime import datetime, timezone
import twapi

def parse_dt(s):
    for fmt in ("%a %b %d %H:%M:%S %z %Y", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            d = datetime.strptime(s, fmt)
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None

for tag in ["$TURTLE", "$TRILLION", "$CHANCE"]:
    body = twapi.metered_call(
        f"advsearch:{tag}", "/twitter/tweet/advanced_search",
        {"query": tag, "queryType": "Latest"}, estimate=100,
    )
    tweets = body.get("tweets") or (body.get("data", {}) or {}).get("tweets") or []
    dts = [parse_dt(t.get("createdAt") or "") for t in tweets]
    dts = [d for d in dts if d]
    authors = {t.get("author", {}).get("userName") or (t.get("author") or {}).get("screen_name") for t in tweets}
    if len(dts) >= 2:
        span_min = (max(dts) - min(dts)).total_seconds() / 60.0
        vel = (len(dts) - 1) / (span_min / 60.0) if span_min > 0 else float('inf')
        print(f"{tag:<12} {len(tweets):>3} tweets span {span_min:7.1f} min  ->  {vel:8.1f} tweets/hr  | {len(authors)} unique authors")
    else:
        print(f"{tag:<12} {len(tweets):>3} tweets (too few to measure velocity) | {len(authors)} authors")
