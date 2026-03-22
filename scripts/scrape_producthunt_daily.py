#!/usr/bin/env python3
"""
Scrape Product Hunt daily top products via GraphQL API.
Fetches the top products for each day going back N days.
Resumable via checkpoint file.
"""

import csv
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timedelta

API_URL = "https://api.producthunt.com/v2/api/graphql"
PH_TOKEN = "J4rH7W8fS58ybNJHTNFQYS_j3Ki05gV9Ao_ugk31dpY"
OUTPUT_CSV = "ph_daily_top.csv"
OUTPUT_JSON = "ph_daily_top.json"
CHECKPOINT = "ph_daily_checkpoint.json"

# Fetch top products posted on a specific date
QUERY = """
query($postedAfter: DateTime!, $postedBefore: DateTime!, $cursor: String) {
  posts(first: 5, order: VOTES, postedAfter: $postedAfter, postedBefore: $postedBefore) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        name
        tagline
        description
        slug
        url
        createdAt
        featuredAt
        votesCount
        commentsCount
        reviewsRating
        website
        media {
          type
          url
          videoUrl
        }
        thumbnail {
          type
          url
          videoUrl
        }
        topics {
          edges {
            node {
              name
            }
          }
        }
        makers {
          name
        }
      }
    }
  }
}
"""


def graphql_request(variables):
    payload = json.dumps({"query": QUERY, "variables": variables}).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Authorization": "Bearer " + PH_TOKEN,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_checkpoint():
    if os.path.exists(CHECKPOINT):
        return json.load(open(CHECKPOINT))
    return {"dates_done": [], "posts": []}


def save_checkpoint(data):
    with open(CHECKPOINT + ".tmp", "w") as f:
        json.dump(data, f)
    os.replace(CHECKPOINT + ".tmp", CHECKPOINT)


def fetch_day(date_str):
    """Fetch top products for a given date (YYYY-MM-DD). Returns list of posts."""
    posted_after = date_str + "T00:00:00Z"
    posted_before = date_str + "T23:59:59Z"

    posts = []
    cursor = None

    while True:
        variables = {
            "postedAfter": posted_after,
            "postedBefore": posted_before,
        }
        if cursor:
            variables["cursor"] = cursor

        result = graphql_request(variables)

        if "errors" in result:
            print("  GraphQL error: %s" % json.dumps(result["errors"])[:200])
            return posts

        data = result["data"]["posts"]
        edges = data["edges"]

        for edge in edges:
            node = edge["node"]
            video_urls = []
            for m in (node.get("media") or []):
                if m.get("videoUrl"):
                    video_urls.append(m["videoUrl"])
            if node.get("thumbnail", {}) and node["thumbnail"].get("videoUrl"):
                video_urls.append(node["thumbnail"]["videoUrl"])
            video_urls = list(dict.fromkeys(video_urls))

            topics = [t["node"]["name"] for t in (node.get("topics", {}).get("edges") or [])]
            makers = [m["name"] for m in (node.get("makers") or [])]

            posts.append({
                "date": date_str,
                "rank": len(posts) + 1,
                "id": node["id"],
                "name": node["name"],
                "tagline": node.get("tagline", ""),
                "description": node.get("description", ""),
                "slug": node.get("slug", ""),
                "url": node.get("url", ""),
                "website": node.get("website", ""),
                "created_at": node.get("createdAt", ""),
                "featured_at": node.get("featuredAt", ""),
                "votes": node.get("votesCount", 0),
                "comments": node.get("commentsCount", 0),
                "rating": node.get("reviewsRating", 0),
                "topics": ", ".join(topics),
                "makers": ", ".join(makers),
                "video_urls": " | ".join(video_urls),
                "has_video": len(video_urls) > 0,
            })

        # Only fetch first page (top 5) per day
        break

    return posts


def main():
    days_back = 365 * 3  # 3 years of history
    ckpt = load_checkpoint()
    dates_done = set(ckpt["dates_done"])
    all_posts = ckpt["posts"]

    print("Checkpoint: %d days done, %d posts" % (len(dates_done), len(all_posts)))

    today = datetime.utcnow().date()
    total_days = 0
    fetched_days = 0

    for i in range(days_back):
        date = today - timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")

        if date_str in dates_done:
            continue

        total_days += 1

        try:
            posts = fetch_day(date_str)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print("  Rate limited at %s. Saving checkpoint. Rerun to resume." % date_str)
                save_checkpoint({"dates_done": list(dates_done), "posts": all_posts})
                break
            raise

        all_posts.extend(posts)
        dates_done.add(date_str)
        fetched_days += 1

        top = posts[0]["name"] if posts else "none"
        top_votes = posts[0]["votes"] if posts else 0
        print("  %s: %d products (top: %s — %d votes)" % (date_str, len(posts), top, top_votes))

        if fetched_days % 10 == 0:
            save_checkpoint({"dates_done": list(dates_done), "posts": all_posts})

        time.sleep(1)  # Stay under rate limit

    save_checkpoint({"dates_done": list(dates_done), "posts": all_posts})

    # Write CSV
    fieldnames = [
        "date", "rank", "id", "name", "tagline", "description", "website", "url",
        "created_at", "featured_at", "votes", "comments", "rating",
        "topics", "makers", "video_urls", "has_video",
    ]
    all_posts.sort(key=lambda p: (p["date"], p["rank"]), reverse=True)

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_posts)

    with open(OUTPUT_JSON, "w") as f:
        json.dump(all_posts, f, indent=2, ensure_ascii=False)

    with_video = sum(1 for p in all_posts if p["has_video"])
    print("\nDone!")
    print("  Days fetched: %d" % len(dates_done))
    print("  Total posts: %d" % len(all_posts))
    print("  With video: %d" % with_video)
    print("  CSV: %s" % OUTPUT_CSV)
    print("  Checkpoint: %s (rerun to continue)" % CHECKPOINT)


if __name__ == "__main__":
    main()
