#!/usr/bin/env python3
"""
Scrape all YC Launch posts via Algolia and export to CSV.
Extracts: title, tagline, company, batch, industry, website, body text,
video URLs, launch URL, date, votes.
"""

import csv
import json
import re
import sys
import time
import urllib.request
import urllib.parse

ALGOLIA_APP_ID = "45BWZJ1SGC"
ALGOLIA_API_KEY = (
    "OTVkZDMwZDlkNWY4MGE2MDcwZmY2ZTE4N2MyYWQ2NjhmMWNjMGE5M2FlNzU1"
    "NzIzMGE3Y2M4NWQ3ODk5NWEyN2FuYWx5dGljc1RhZ3M9eWNkYyZyZXN0cmljdEluZGljZXM9"
    "TGF1bmNoZXNfcHJvZHVjdGlvbiUyQ0xhdW5jaGVzX2J5X2RhdGVfcHJvZHVjdGlvbiZ0YWdG"
    "aWx0ZXJzPSU1QiUyMnljZGNfcHVibGljJTIyJTVE"
)
INDEX = "Launches_production"
HITS_PER_PAGE = 100
OUTPUT_CSV = "yc_launches.csv"
OUTPUT_JSON = "yc_launches.json"

# Regex to find video URLs in markdown body
VIDEO_PATTERNS = [
    r'https?://(?:www\.)?youtube\.com/watch\?v=[^\s\)\"]+',
    r'https?://youtu\.be/[^\s\)\"]+',
    r'https?://(?:www\.)?loom\.com/share/[^\s\)\"]+',
    r'https?://(?:www\.)?vimeo\.com/[^\s\)\"]+',
    r'https?://(?:www\.)?wistia\.com/[^\s\)\"]+',
    r'https?://player\.vimeo\.com/[^\s\)\"]+',
]


def extract_video_urls(text: str) -> list[str]:
    urls = []
    for pattern in VIDEO_PATTERNS:
        urls.extend(re.findall(pattern, text))
    # Deduplicate preserving order
    seen = set()
    result = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            result.append(u)
    return result


def strip_markdown(text: str) -> str:
    """Strip markdown formatting for plain text column."""
    # Remove images
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    # Remove links but keep text
    text = re.sub(r'\[([^\]]*)\]\([^\)]*\)', r'\1', text)
    # Remove headers
    text = re.sub(r'#{1,6}\s*\**', '', text)
    # Remove bold/italic markers
    text = re.sub(r'\*{1,3}', '', text)
    # Remove horizontal rules
    text = re.sub(r'^---+$', '', text, flags=re.MULTILINE)
    # Collapse whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def fetch_page(page: int, filters: str = "") -> dict:
    url = f"https://{ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/{INDEX}/query"
    params_dict = {
        "query": "",
        "hitsPerPage": HITS_PER_PAGE,
        "page": page,
    }
    if filters:
        params_dict["filters"] = filters
    params = urllib.parse.urlencode(params_dict)
    data = json.dumps({"params": params}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "X-Algolia-Application-Id": ALGOLIA_APP_ID,
            "X-Algolia-API-Key": ALGOLIA_API_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_all_with_filter(filters: str, label: str) -> list:
    """Fetch all hits for a given filter, paginating up to Algolia's 1000 limit."""
    hits = []
    result = fetch_page(0, filters)
    total = result["nbHits"]
    nb_pages = min(result["nbPages"], 10)  # Algolia caps at page*hitsPerPage < 1000
    hits.extend(result["hits"])
    print(f"  [{label}] {total} hits, {nb_pages} pages")

    for page in range(1, nb_pages):
        result = fetch_page(page, filters)
        hits.extend(result["hits"])
        time.sleep(0.05)

    return hits


def main():
    # First, discover how many total and what date range we need to partition
    result = fetch_page(0)
    total = result["nbHits"]
    print(f"Total launches in index: {total}")
    print(f"Algolia caps search at 1000 results. Partitioning by date ranges.\n")

    # Partition by year-based date ranges to stay under 1000 per partition
    # created_at is a string like "2025-11-05T23:24:34.432Z"
    # Algolia numeric filters won't work on strings, so we use facet filters on batch
    # But batch might not cover all. Instead, use multiple queries with ID ranges.
    #
    # Strategy: fetch with id numeric filters. IDs are integers.
    # First get min/max ID range, then split into chunks.

    # Get a sample to find ID range
    result_asc = fetch_page(0)  # default sort
    all_ids = [h["id"] for h in result_asc["hits"]]

    # Try to get the oldest entries too
    # Use the Launches_by_date_production index to get date-sorted results
    # Actually, let's just partition by ID ranges. IDs seem to be sequential.
    # From our sample: IDs around 83000-95000+. Let's probe the range.

    # Simpler: partition by filtering on batch field
    # First, get all unique batches
    known_batches = [
        "Winter 2020", "Summer 2020",
        "Winter 2021", "Summer 2021",
        "Winter 2022", "Summer 2022",
        "Winter 2023", "Summer 2023",
        "Winter 2024", "Summer 2024", "Fall 2024",
        "Winter 2025", "Spring 2025", "Summer 2025", "Fall 2025",
        "Winter 2026", "Spring 2026", "Summer 2026",
    ]

    all_hits = []
    seen_ids = set()

    for batch in known_batches:
        hits = fetch_all_with_filter(f'company.batch:"{batch}"', batch)
        new_hits = [h for h in hits if h["id"] not in seen_ids]
        for h in new_hits:
            seen_ids.add(h["id"])
        all_hits.extend(new_hits)
        time.sleep(0.1)

    # Also fetch any without a known batch (edge cases)
    # Use a NOT filter for all known batches
    print(f"\n  Fetched {len(all_hits)} from known batches. Checking for stragglers...")

    # Fetch without batch filter but paginate to get extras
    # We'll do a broad sweep and dedup
    for page in range(10):
        result = fetch_page(page)
        new_hits = [h for h in result["hits"] if h["id"] not in seen_ids]
        for h in new_hits:
            seen_ids.add(h["id"])
        all_hits.extend(new_hits)
        time.sleep(0.05)

    print(f"\nTotal unique launches fetched: {len(all_hits)}")

    # Extract and write CSV
    rows = []
    video_count = 0
    for hit in all_hits:
        body = hit.get("body", "")
        videos = extract_video_urls(body)
        if videos:
            video_count += 1

        company = hit.get("company", {})
        rows.append({
            "id": hit.get("id", ""),
            "title": hit.get("title", ""),
            "tagline": hit.get("tagline", ""),
            "company_name": company.get("name", ""),
            "company_url": company.get("url", ""),
            "batch": company.get("batch", ""),
            "industry": company.get("industry", ""),
            "created_at": hit.get("created_at", ""),
            "votes": hit.get("total_vote_count", 0),
            "launch_url": f"https://www.ycombinator.com/launches/{hit.get('slug', '')}",
            "video_urls": " | ".join(videos),
            "body_text": strip_markdown(body),
            "body_markdown": body,
        })

    # Sort by date descending
    rows.sort(key=lambda r: r["created_at"], reverse=True)

    # Write CSV
    fieldnames = [
        "id", "title", "tagline", "company_name", "company_url",
        "batch", "industry", "created_at", "votes", "launch_url",
        "video_urls", "body_text",
    ]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    # Write full JSON (includes markdown body)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)

    print(f"\nResults:")
    print(f"  Total launches: {len(rows)}")
    print(f"  With video URLs: {video_count}")
    print(f"  CSV: {OUTPUT_CSV}")
    print(f"  JSON: {OUTPUT_JSON}")

    # Quick stats
    batches = {}
    for r in rows:
        b = r["batch"] or "Unknown"
        batches[b] = batches.get(b, 0) + 1
    print(f"\nTop batches:")
    for b, c in sorted(batches.items(), key=lambda x: -x[1])[:15]:
        print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
