#!/usr/bin/env python3
"""
Scrape Product Hunt launches via GraphQL API.
Resumable via checkpoint file.

Requires a PH developer token:
  1. Go to https://api.producthunt.com/v2/docs
  2. Create an app → get a Developer Token
  3. Set PH_TOKEN env var or pass as --token argument

Usage:
  PH_TOKEN=xxx python3 scripts/scrape_producthunt.py
  python3 scripts/scrape_producthunt.py --token xxx
"""

import csv
import json
import os
import sys
import time
import urllib.request

API_URL = "https://api.producthunt.com/v2/api/graphql"
OUTPUT_CSV = "ph_launches.csv"
OUTPUT_JSON = "ph_launches.json"
CHECKPOINT = "ph_checkpoint.json"

# GraphQL query: fetch posts with media (including videoUrl)
QUERY = """
query($cursor: String) {
  posts(first: 20, after: $cursor, order: NEWEST) {
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
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


def graphql_request(token, cursor=None):
    variables = {}
    if cursor:
        variables["cursor"] = cursor

    payload = json.dumps({"query": QUERY, "variables": variables}).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_checkpoint():
    if os.path.exists(CHECKPOINT):
        return json.load(open(CHECKPOINT))
    return {"cursor": None, "posts": [], "seen_ids": []}


def save_checkpoint(data):
    with open(CHECKPOINT + ".tmp", "w") as f:
        json.dump(data, f)
    os.replace(CHECKPOINT + ".tmp", CHECKPOINT)


def main():
    token = os.environ.get("PH_TOKEN", "J4rH7W8fS58ybNJHTNFQYS_j3Ki05gV9Ao_ugk31dpY")

    # Check for --token arg
    for i, arg in enumerate(sys.argv):
        if arg == "--token" and i + 1 < len(sys.argv):
            token = sys.argv[i + 1]

    if not token:
        print("Error: No Product Hunt token provided.")
        print("Get one at https://api.producthunt.com/v2/docs")
        print("Then: PH_TOKEN=xxx python3 scripts/scrape_producthunt.py")
        sys.exit(1)

    # Load checkpoint
    ckpt = load_checkpoint()
    cursor = ckpt["cursor"]
    posts = ckpt["posts"]
    seen_ids = set(ckpt["seen_ids"])

    print("Checkpoint: %d posts already fetched" % len(posts))
    print("Fetching Product Hunt launches...\n")

    max_posts = 5000  # Safety limit
    page = 0

    while len(posts) < max_posts:
        try:
            result = graphql_request(token, cursor)
        except Exception as e:
            print("API error: %s" % str(e)[:300])
            print("Saving checkpoint and exiting. Rerun to resume.")
            save_checkpoint({"cursor": cursor, "posts": posts, "seen_ids": list(seen_ids)})
            break

        if "errors" in result:
            print("GraphQL errors: %s" % json.dumps(result["errors"])[:500])
            print("Saving checkpoint. Rerun to resume.")
            save_checkpoint({"cursor": cursor, "posts": posts, "seen_ids": list(seen_ids)})
            break

        data = result["data"]["posts"]
        edges = data["edges"]
        page_info = data["pageInfo"]

        if not edges:
            print("No more results.")
            break

        for edge in edges:
            node = edge["node"]
            if node["id"] in seen_ids:
                continue
            seen_ids.add(node["id"])

            # Extract video URLs from media
            video_urls = []
            for m in (node.get("media") or []):
                if m.get("videoUrl"):
                    video_urls.append(m["videoUrl"])
            if node.get("thumbnail", {}) and node["thumbnail"].get("videoUrl"):
                video_urls.append(node["thumbnail"]["videoUrl"])

            # Deduplicate
            video_urls = list(dict.fromkeys(video_urls))

            topics = [t["node"]["name"] for t in (node.get("topics", {}).get("edges") or [])]
            makers = [m["name"] for m in (node.get("makers") or [])]

            posts.append({
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

        page += 1
        cursor = page_info["endCursor"]

        if page % 5 == 0:
            save_checkpoint({"cursor": cursor, "posts": posts, "seen_ids": list(seen_ids)})

        print("  Page %d: %d posts total (%d this page, has_next=%s)" % (
            page, len(posts), len(edges), page_info["hasNextPage"]))

        if not page_info["hasNextPage"]:
            print("Reached end of results.")
            break

        time.sleep(1.0)  # PH rate limit: 450 req / 15 min

    # Final save
    save_checkpoint({"cursor": cursor, "posts": posts, "seen_ids": list(seen_ids)})

    # Write CSV
    fieldnames = [
        "id", "name", "tagline", "description", "website", "url",
        "created_at", "featured_at", "votes", "comments", "rating",
        "topics", "makers", "video_urls", "has_video",
    ]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(posts)

    with open(OUTPUT_JSON, "w") as f:
        json.dump(posts, f, indent=2, ensure_ascii=False)

    with_video = sum(1 for p in posts if p["has_video"])
    print("\nDone!")
    print("  Total posts: %d" % len(posts))
    print("  With video: %d" % with_video)
    print("  CSV: %s" % OUTPUT_CSV)
    print("  JSON: %s" % OUTPUT_JSON)
    print("  Checkpoint: %s (delete to start fresh)" % CHECKPOINT)


if __name__ == "__main__":
    main()
