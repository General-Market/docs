#!/usr/bin/env python3
"""Score repeatable account-level outliers from cached tweets.

Outputs:
- niches/<cell>/outliers.json
- niches/<cell>/outliers.md

The key score is not raw virality. It rewards repeatable account-format pairs:
repeat count, share of account posts, median engagement, and engagement per
1,000 followers. Single-post outliers are reported separately.
"""
from __future__ import annotations

import json
import math
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from format_miner import classify

ROOT = Path(__file__).resolve().parent
TWEETS = ROOT / "cache" / "tweets.jsonl"
PROFILES = ROOT / "cache" / "profiles.jsonl"
CELLS = ["trenches-en", "trenches-cn", "perps-en", "perps-cn", "perps-jp", "perps-kr"]


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    if not path.exists():
        return rows
    for line in path.read_text().split("\n"):
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def engagement(t: dict) -> int:
    return (t.get("favorites") or 0) + 3 * (t.get("retweets") or 0) + 2 * (t.get("replies") or 0) + 4 * (t.get("quotes") or 0)


def percentile(xs: list[float], pct: float) -> float:
    if not xs:
        return 0.0
    xs = sorted(xs)
    idx = min(len(xs) - 1, max(0, int(math.ceil((pct / 100) * len(xs))) - 1))
    return xs[idx]


def snippet(text: str, n: int = 170) -> str:
    return " ".join((text or "").split())[:n].replace("|", " ")


def score_pair(repeats: int, share: float, median_eng: float, followers: int, median_views: float) -> float:
    follower_base = max(followers or 0, 1_000)
    eng_per_1k = median_eng / follower_base * 1_000
    view_per_1k = median_views / follower_base * 1_000 if median_views else 0
    return round((math.log1p(repeats) * (0.5 + share) * (eng_per_1k + 0.03 * view_per_1k + math.log1p(median_eng))), 3)


def analyze_cell(cell: str, tweets: list[dict], profiles: dict[str, dict]) -> dict:
    rows = [t for t in tweets if t.get("cell") == cell]
    by_author: dict[str, list[dict]] = defaultdict(list)
    for t in rows:
        author = (t.get("screen_name") or "").lower()
        if author:
            by_author[author].append(t)

    repeated = []
    singles = []
    for author, ts in by_author.items():
        profile = profiles.get(author, {})
        followers = profile.get("followers_count") or 0
        if followers > 2_000_000:
            continue
        format_rows: dict[str, list[dict]] = defaultdict(list)
        for t in ts:
            for fmt in classify(t.get("text") or ""):
                format_rows[fmt].append(t)
        for fmt, fts in format_rows.items():
            if fmt in {"other", "meme_short"}:
                continue
            repeats = len(fts)
            if repeats < 2:
                continue
            engs = [engagement(t) for t in fts]
            views = [t.get("views") or 0 for t in fts]
            share = repeats / max(1, len(ts))
            med = statistics.median(engs)
            p90 = percentile(engs, 90)
            med_views = statistics.median(views)
            best = max(fts, key=engagement)
            repeated.append({
                "author": author,
                "followers": followers,
                "format": fmt,
                "repeats": repeats,
                "account_posts": len(ts),
                "share": round(share, 3),
                "median_eng": med,
                "p90_eng": p90,
                "median_views": med_views,
                "eng_per_1k_followers": round(med / max(followers or 0, 1000) * 1000, 3),
                "score": score_pair(repeats, share, med, followers, med_views),
                "best_url": best.get("url"),
                "best_eng": engagement(best),
                "pattern_clue": snippet(best.get("text") or ""),
            })

        for t in ts:
            e = engagement(t)
            follower_base = max(followers or 0, 1000)
            per_1k = e / follower_base * 1000
            if e >= 150 or per_1k >= 50:
                singles.append({
                    "author": author,
                    "followers": followers,
                    "eng": e,
                    "views": t.get("views") or 0,
                    "eng_per_1k_followers": round(per_1k, 3),
                    "url": t.get("url"),
                    "formats": classify(t.get("text") or ""),
                    "text": snippet(t.get("text") or ""),
                })

    repeated.sort(key=lambda r: (r["score"], r["median_eng"], r["repeats"]), reverse=True)
    singles.sort(key=lambda r: (r["eng_per_1k_followers"], r["eng"]), reverse=True)
    return {
        "cell": cell,
        "tweet_count": len(rows),
        "author_count": len(by_author),
        "format_counts": Counter(fmt for t in rows for fmt in classify(t.get("text") or "")),
        "repeatable_outliers": repeated[:80],
        "single_post_outliers": singles[:80],
    }


def write_report(cell: str, result: dict) -> None:
    outdir = ROOT / "niches" / cell
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "outliers.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))

    lines = [
        f"# {cell} — second-pass outlier stats",
        "",
        f"TL;DR: {len(result['repeatable_outliers'])} repeatable account-format outliers found from {result['tweet_count']} cached tweets and {result['author_count']} authors.",
        "",
        "## Repeatable Account-Format Outliers",
        "",
        "| score | account | format | repeats/share | median/p90 eng | eng/1k followers | best example | pattern clue |",
        "|---:|---|---|---:|---:|---:|---|---|",
    ]
    for r in result["repeatable_outliers"][:25]:
        lines.append(
            f"| {r['score']} | @{r['author']} ({r['followers']}) | {r['format']} | "
            f"{r['repeats']}/{r['account_posts']} ({r['share']:.0%}) | {r['median_eng']}/{r['p90_eng']} | "
            f"{r['eng_per_1k_followers']} | [link]({r['best_url']}) ({r['best_eng']}) | {r['pattern_clue']} |"
        )
    lines += [
        "",
        "## Single-Post Outliers",
        "",
        "| eng/1k followers | account | eng/views | formats | example | clue |",
        "|---:|---|---:|---|---|---|",
    ]
    for r in result["single_post_outliers"][:25]:
        lines.append(
            f"| {r['eng_per_1k_followers']} | @{r['author']} ({r['followers']}) | {r['eng']}/{r['views']} | "
            f"{','.join(r['formats'])} | [link]({r['url']}) | {r['text']} |"
        )
    lines += [
        "",
        "## Format Counts",
        "",
        "| format | tweets |",
        "|---|---:|",
    ]
    for fmt, n in result["format_counts"].most_common():
        lines.append(f"| {fmt} | {n} |")
    (outdir / "outliers.md").write_text("\n".join(lines) + "\n")


def main() -> None:
    cells = sys.argv[1:] or CELLS
    tweets = load_jsonl(TWEETS)
    profiles = {(p.get("screen_name") or "").lower(): p for p in load_jsonl(PROFILES)}
    for cell in cells:
        result = analyze_cell(cell, tweets, profiles)
        write_report(cell, result)
        print(f"wrote niches/{cell}/outliers.json + outliers.md ({len(result['repeatable_outliers'])} repeatable)")


if __name__ == "__main__":
    main()
