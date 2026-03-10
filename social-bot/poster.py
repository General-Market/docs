#!/usr/bin/env python3
"""
Local poster script. Watches scheduled.csv and posts pending tweets to X.
Runs on Mac only. Reads credentials from .twitter-creds.json.
"""

import csv
import json
import time
import sys
from datetime import datetime, timedelta
from pathlib import Path

import tweepy

SCRIPT_DIR = Path(__file__).parent
CREDS_FILE = SCRIPT_DIR / ".twitter-creds.json"
CSV_FILE = SCRIPT_DIR / "scheduled.csv"
MIN_SPACING_SECS = 1800  # 30 min between posts per account
MAX_DAILY = 15

# Track last post time per account
_last_posted: dict[str, datetime] = {}
_daily_counts: dict[str, int] = {}
_daily_reset: str = ""


def load_creds() -> dict:
    with open(CREDS_FILE) as f:
        return json.load(f)


def get_client(account: str, creds: dict) -> tweepy.Client:
    c = creds[account]
    return tweepy.Client(
        consumer_key=c["api_key"],
        consumer_secret=c["api_secret"],
        access_token=c["access_token"],
        access_token_secret=c["access_secret"],
    )


def can_post(account: str, outcome_tag: str) -> tuple[bool, str]:
    global _daily_counts, _daily_reset

    # Reset daily counts at midnight
    today = datetime.utcnow().strftime("%Y-%m-%d")
    if today != _daily_reset:
        _daily_counts = {}
        _daily_reset = today

    # Daily limit
    if _daily_counts.get(account, 0) >= MAX_DAILY:
        return False, f"Daily limit ({MAX_DAILY}) reached for {account}"

    # Spacing (FEAR bypasses)
    if outcome_tag != "FEAR" and account in _last_posted:
        elapsed = (datetime.utcnow() - _last_posted[account]).total_seconds()
        if elapsed < MIN_SPACING_SECS:
            wait = int(MIN_SPACING_SECS - elapsed)
            return False, f"Too soon for {account}, wait {wait}s"

    return True, ""


def read_csv() -> list[dict]:
    if not CSV_FILE.exists():
        return []
    with open(CSV_FILE, newline="") as f:
        return list(csv.DictReader(f))


def write_csv(rows: list[dict]):
    if not rows:
        return
    fieldnames = ["id", "account", "tweet_text", "outcome_tag", "virality_score", "scheduled_at", "status"]
    with open(CSV_FILE, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def run_once(creds: dict):
    rows = read_csv()
    if not rows:
        return

    changed = False
    for row in rows:
        if row.get("status") != "pending":
            continue

        account = row["account"]
        outcome_tag = row.get("outcome_tag", "")
        tweet_text = row["tweet_text"]

        ok, reason = can_post(account, outcome_tag)
        if not ok:
            print(f"[skip] {reason}")
            continue

        try:
            client = get_client(account, creds)
            response = client.create_tweet(text=tweet_text)
            tweet_id = response.data["id"]
            row["status"] = "posted"
            _last_posted[account] = datetime.utcnow()
            _daily_counts[account] = _daily_counts.get(account, 0) + 1
            print(f"[posted] @{account}: {tweet_text[:60]}... (id: {tweet_id})")
            changed = True
        except Exception as e:
            row["status"] = "failed"
            print(f"[error] @{account}: {e}")
            changed = True

    if changed:
        write_csv(rows)


def main():
    if not CREDS_FILE.exists():
        print(f"Missing {CREDS_FILE} -- copy from .twitter-creds.example.json and fill in keys")
        sys.exit(1)

    creds = load_creds()
    print(f"[poster] Watching {CSV_FILE} (polling every 30s)")
    print(f"[poster] Loaded credentials for: {', '.join(creds.keys())}")

    while True:
        try:
            run_once(creds)
        except Exception as e:
            print(f"[poster] Error: {e}")
        time.sleep(30)


if __name__ == "__main__":
    main()
