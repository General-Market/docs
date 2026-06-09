#!/usr/bin/env python3
"""Emit a by-likes ranking of a niche's native X Articles.

The main engine (find_native_x_articles.py) ranks its report.md by author-average
outlier lift. This companion ranks the same articles.jsonl strictly by raw likes —
the view asked for when the brief is "top articles by likes".

Run:
  python3 docs/x-targeting/x_articles/rank_by_likes.py --niche hyperliquid-30d --date 2026-06-09
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

OUT_ROOT = Path(__file__).resolve().parent


def load_rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def esc(value: str) -> str:
    return (value or "").replace("|", "\\|").replace("\n", " ").strip()


SORTS = {
    "likes": lambda r: (r.get("likes", 0), r.get("retweets", 0), r.get("views", 0)),
    "views": lambda r: (r.get("views", 0), r.get("likes", 0), r.get("retweets", 0)),
}


def render(rows: list[dict], niche: str, date: str, window: str, sort: str) -> str:
    total_likes = sum(r.get("likes", 0) for r in rows)
    total_views = sum(r.get("views", 0) for r in rows)
    lines = [
        f"# Native X Articles — {niche} — by {sort} — {date}",
        "",
        "## TL;DR",
        "",
        f"**{len(rows)} native X Articles** on this niche over the **{window}**, ranked by raw {sort}.",
        f"Combined: **{total_likes:,} likes**, **{total_views:,} views**. Native X Article = a tweet whose payload carries a non-null `article` object (the long-form `x.com/i/article/...` format), not an external link.",
        "",
        "| rank | views | likes | RTs | replies | author (followers) | X Article |",
        "|---:|---:|---:|---:|---:|---|---|",
    ]
    for idx, r in enumerate(rows, 1):
        title = esc(r.get("title") or r.get("article_url") or "(untitled)")
        url = r.get("article_url") or r.get("tweet_url") or ""
        author = r.get("author") or "?"
        followers = r.get("author_followers", 0)
        lines.append(
            f"| {idx} | {r.get('views', 0):,} | {r.get('likes', 0):,} | {r.get('retweets', 0):,} | "
            f"{r.get('replies', 0):,} | [@{author}](https://x.com/{author}) ({followers:,}) | [{title}]({url}) |"
        )

    lines.extend([
        "",
        "## Ranking rule",
        "",
        f"- Sorted by raw {sort}; the other engagement axes break ties.",
        "- Same niche surface and freshness rules as `report.md` (≥4h old, deduped by normalized title).",
        "- For outlier lift (views vs the author's own baseline) read the sibling `report.md`.",
        "- Views and likes diverge hard on announcement-style Articles (a 29M-view Article can carry 3k likes) — read both tables.",
    ])
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--niche", required=True)
    parser.add_argument("--date", required=True)
    parser.add_argument("--top", type=int, default=100)
    parser.add_argument("--window", default="last 30 days")
    parser.add_argument("--sort", choices=sorted(SORTS), default="likes")
    args = parser.parse_args()

    in_dir = OUT_ROOT / args.date / args.niche
    rows = load_rows(in_dir / "articles.jsonl")
    rows.sort(key=SORTS[args.sort], reverse=True)
    rows = rows[: args.top]

    out_path = in_dir / f"by-{args.sort}.md"
    out_path.write_text(render(rows, args.niche, args.date, args.window, args.sort))
    print(f"wrote {out_path} ({len(rows)} articles)")


if __name__ == "__main__":
    main()
