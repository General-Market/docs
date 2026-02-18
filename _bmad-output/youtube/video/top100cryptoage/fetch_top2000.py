#!/usr/bin/env python3
"""
Fetch top 2000 crypto tokens from CoinGecko Pro API.
Outputs CSV with: market cap, website, all links, social media, chains,
categories, exchanges, about section.
"""

import requests
import csv
import time
import json
import os
import sys
from datetime import datetime

API_KEY = "CG-bRYVgxBJ29Vthwj4sZbWMJY6"
BASE_URL = "https://pro-api.coingecko.com/api/v3"
HEADERS = {"x-cg-pro-api-key": API_KEY}
OUTPUT_DIR = "/Users/maxguillabert/Downloads/index/_bmad-output/youtube/video/top100cryptoage"

# Rate limiting: Pro = 500 calls/min ≈ 8.3/sec, stay safe at 7/sec
MIN_INTERVAL = 1.0 / 7.0
last_call_time = 0
call_count = 0


def rate_limited_get(url, params=None, retries=3):
    global last_call_time, call_count
    elapsed = time.time() - last_call_time
    wait = MIN_INTERVAL - elapsed
    if wait > 0:
        time.sleep(wait)

    for attempt in range(retries):
        try:
            response = requests.get(url, headers=HEADERS, params=params, timeout=30)
            last_call_time = time.time()
            call_count += 1

            if response.status_code == 429:
                retry_after = int(response.headers.get("Retry-After", 60))
                print(f"  Rate limited! Waiting {retry_after}s...")
                time.sleep(retry_after)
                continue

            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            if attempt < retries - 1:
                print(f"  Retry {attempt+1}/{retries} after error: {e}")
                time.sleep(5 * (attempt + 1))
            else:
                raise
    return None


def fetch_top_coins(n=2000):
    """Fetch top N coins from /coins/markets endpoint."""
    coins = []
    per_page = 250
    pages = (n + per_page - 1) // per_page

    for page in range(1, pages + 1):
        print(f"Fetching markets page {page}/{pages}...")
        data = rate_limited_get(f"{BASE_URL}/coins/markets", {
            "vs_currency": "usd",
            "order": "market_cap_desc",
            "per_page": per_page,
            "page": page,
            "sparkline": "false",
            "price_change_percentage": "24h,7d,30d"
        })
        if data:
            coins.extend(data)
            print(f"  Got {len(data)} coins (total: {len(coins)})")
        else:
            print(f"  ERROR on page {page}")

    return coins[:n]


def fetch_coin_detail(coin_id):
    """Fetch detailed info for a single coin."""
    return rate_limited_get(f"{BASE_URL}/coins/{coin_id}", {
        "localization": "false",
        "tickers": "true",
        "market_data": "true",
        "community_data": "true",
        "developer_data": "false",
        "sparkline": "false"
    })


def extract_row(market_info, detail):
    """Extract all fields from market + detail data into a flat dict."""
    links = detail.get("links", {})

    # Websites
    homepages = [h for h in links.get("homepage", []) if h]

    # Doc / explorer links
    blockchain_sites = [b for b in links.get("blockchain_site", []) if b]
    whitepaper = links.get("whitepaper", "") or ""
    announcements = [a for a in links.get("announcement_url", []) if a]
    forums = [f for f in links.get("official_forum_url", []) if f]

    # Social media
    twitter = links.get("twitter_screen_name", "") or ""
    telegram = links.get("telegram_channel_identifier", "") or ""
    facebook = links.get("facebook_username", "") or ""
    subreddit = links.get("subreddit_url", "") or ""

    # Chat URLs (Discord, etc.)
    chat_urls = [c for c in links.get("chat_url", []) if c]
    discord = ""
    other_chats = []
    for url in chat_urls:
        if "discord" in url.lower():
            discord = url
        else:
            other_chats.append(url)

    # Repos
    repos = links.get("repos_url", {})
    github = [g for g in repos.get("github", []) if g]
    bitbucket = [b for b in repos.get("bitbucket", []) if b]

    # Platforms / chains
    platforms = detail.get("platforms", {})
    chains_list = []
    for chain, addr in (platforms or {}).items():
        if chain:
            chains_list.append(f"{chain}" + (f" ({addr})" if addr else ""))
    chains = " | ".join(chains_list) if chains_list else ""

    # Categories
    categories = " | ".join([c for c in (detail.get("categories", []) or []) if c])

    # Exchanges from tickers
    tickers = detail.get("tickers", [])
    exchanges = sorted(set(
        t.get("market", {}).get("name", "")
        for t in tickers
        if t.get("market", {}).get("name")
    ))

    # Description / about
    description = (detail.get("description", {}) or {}).get("en", "") or ""
    # Clean up HTML tags
    import re
    description_clean = re.sub(r'<[^>]+>', '', description).strip()

    # Market data from detail (more complete)
    md = detail.get("market_data", {}) or {}

    return {
        "rank": market_info.get("market_cap_rank", ""),
        "id": detail.get("id", ""),
        "symbol": (detail.get("symbol", "") or "").upper(),
        "name": detail.get("name", ""),
        "market_cap_usd": md.get("market_cap", {}).get("usd", market_info.get("market_cap", "")),
        "current_price_usd": md.get("current_price", {}).get("usd", market_info.get("current_price", "")),
        "total_volume_usd": md.get("total_volume", {}).get("usd", ""),
        "circulating_supply": md.get("circulating_supply", ""),
        "total_supply": md.get("total_supply", ""),
        "max_supply": md.get("max_supply", ""),
        "ath_usd": md.get("ath", {}).get("usd", ""),
        "ath_date": md.get("ath_date", {}).get("usd", ""),
        "price_change_24h_pct": md.get("price_change_percentage_24h", ""),
        "price_change_7d_pct": md.get("price_change_percentage_7d", ""),
        "price_change_30d_pct": md.get("price_change_percentage_30d", ""),
        "website": " | ".join(homepages),
        "whitepaper": whitepaper,
        "blockchain_explorers": " | ".join(blockchain_sites),
        "announcements": " | ".join(announcements),
        "official_forums": " | ".join(forums),
        "github_repos": " | ".join(github),
        "bitbucket_repos": " | ".join(bitbucket),
        "twitter": f"https://twitter.com/{twitter}" if twitter else "",
        "telegram": f"https://t.me/{telegram}" if telegram else "",
        "facebook": f"https://facebook.com/{facebook}" if facebook else "",
        "reddit": subreddit,
        "discord": discord,
        "other_chat_urls": " | ".join(other_chats),
        "chains_platforms": chains,
        "categories": categories,
        "exchanges_listed": " | ".join(exchanges),
        "exchanges_count": len(exchanges),
        "genesis_date": detail.get("genesis_date", ""),
        "country_origin": detail.get("country_origin", ""),
        "hashing_algorithm": detail.get("hashing_algorithm", ""),
        "sentiment_up_pct": detail.get("sentiment_votes_up_percentage", ""),
        "sentiment_down_pct": detail.get("sentiment_votes_down_percentage", ""),
        "coingecko_url": f"https://www.coingecko.com/en/coins/{detail.get('web_slug', detail.get('id', ''))}",
        "about": description_clean,
    }


def main():
    progress_file = os.path.join(OUTPUT_DIR, "progress.json")
    output_file = os.path.join(OUTPUT_DIR, "top2000_crypto_coingecko.csv")
    markets_cache = os.path.join(OUTPUT_DIR, "markets_cache.json")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Step 1: Fetch or load market data
    if os.path.exists(markets_cache):
        print("Loading cached market data...")
        with open(markets_cache) as f:
            coins = json.load(f)
        print(f"Loaded {len(coins)} coins from cache")
    else:
        print("=" * 60)
        print("STEP 1: Fetching top 2000 coins by market cap")
        print("=" * 60)
        coins = fetch_top_coins(2000)
        with open(markets_cache, "w") as f:
            json.dump(coins, f)
        print(f"Saved {len(coins)} coins to cache")

    # Build lookup by id
    market_lookup = {c["id"]: c for c in coins}

    # Step 2: Load progress
    completed = {}
    if os.path.exists(progress_file):
        with open(progress_file) as f:
            completed = json.load(f)
        print(f"Resuming from progress: {len(completed)}/{len(coins)} coins done")

    # Step 3: Fetch details
    print("=" * 60)
    print("STEP 2: Fetching detail for each coin")
    print("=" * 60)

    remaining = [c for c in coins if c["id"] not in completed]
    print(f"{len(remaining)} coins remaining to fetch")

    start_time = time.time()
    errors = []

    for i, coin in enumerate(remaining):
        coin_id = coin["id"]
        total_done = len(completed)
        elapsed = time.time() - start_time
        rate = (i + 1) / elapsed if elapsed > 0 else 0
        eta = (len(remaining) - i - 1) / rate if rate > 0 else 0

        print(f"[{total_done + 1}/{len(coins)}] {coin_id} "
              f"({rate:.1f}/s, ETA: {eta/60:.1f}min)")

        try:
            detail = fetch_coin_detail(coin_id)
            if detail:
                row = extract_row(coin, detail)
                completed[coin_id] = row
            else:
                print(f"  SKIP: No data returned for {coin_id}")
                errors.append(coin_id)
        except Exception as e:
            print(f"  ERROR: {e}")
            errors.append(coin_id)

        # Save progress every 25 coins
        if (total_done + 1) % 25 == 0:
            with open(progress_file, "w") as f:
                json.dump(completed, f)
            print(f"  >> Progress saved ({len(completed)} coins)")
            sys.stdout.flush()

    # Final progress save
    with open(progress_file, "w") as f:
        json.dump(completed, f)

    # Step 4: Write CSV (preserving market cap rank order)
    print("=" * 60)
    print("STEP 3: Writing CSV")
    print("=" * 60)

    rows = []
    for coin in coins:
        if coin["id"] in completed:
            rows.append(completed[coin["id"]])

    if rows:
        fieldnames = list(rows[0].keys())
        with open(output_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for row in rows:
                writer.writerow(row)

        print(f"CSV saved: {output_file}")
        print(f"Total rows: {len(rows)}")
        print(f"Total API calls: {call_count}")
        if errors:
            print(f"Errors ({len(errors)}): {', '.join(errors[:20])}")
            with open(os.path.join(OUTPUT_DIR, "errors.json"), "w") as f:
                json.dump(errors, f)
    else:
        print("No data to write!")


if __name__ == "__main__":
    main()
