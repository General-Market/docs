#!/usr/bin/env python3
"""Report repeated account-level content formats from cached tweets.

Zero API cost. Uses format_miner.classify() and cached tweets/profiles to answer:
which accounts repeat the same structure often enough that the format is
copyable?

Outputs:
  marketing/niche-research/replicability-report.md
  docs/x-targeting/niches/<cell>/replicability.md
"""
from __future__ import annotations

import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

from format_miner import classify, engagement

ROOT = Path("/Users/maxguillabert/Downloads/index")
XROOT = ROOT / "docs" / "x-targeting"
TWEETS = XROOT / "cache" / "tweets.jsonl"
PROFILES = XROOT / "cache" / "profiles.jsonl"
OUT = ROOT / "marketing" / "niche-research" / "replicability-report.md"

CELLS = ["trenches-en", "trenches-cn", "perps-en", "perps-cn", "perps-jp", "perps-kr"]
FORMAT_EASE = {
    "meme_short": ("easy", "~5 min"),
    "question_bait": ("easy", "~5 min"),
    "token_call": ("easy", "~10 min"),
    "data_drop": ("easy", "~15 min"),
    "numbered_list": ("medium", "~20 min"),
    "daily_recap": ("medium", "~25 min"),
    "pnl_flex": ("medium", "~20 min"),
    "tutorial": ("hard", "~35 min"),
    "thread_hook": ("hard", "~45 min"),
    "other": ("avoid", "varies"),
}
ACTIONABLE_FORMATS = {
    "data_drop",
    "numbered_list",
    "daily_recap",
    "pnl_flex",
    "token_call",
    "tutorial",
    "thread_hook",
}


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


def median(values: list[int]) -> float:
    return float(statistics.median(values)) if values else 0.0


def p90(values: list[int]) -> int:
    if not values:
        return 0
    ordered = sorted(values, reverse=True)
    return ordered[max(0, len(ordered) // 10 - 1)] if len(ordered) >= 10 else ordered[0]


def first_line(text: str, limit: int = 120) -> str:
    line = " ".join((text or "").split())
    return line[:limit]


def fmt_num(n: float) -> str:
    if int(n) == n:
        return str(int(n))
    return f"{n:.1f}"


def profile_index(rows: list[dict]) -> dict[str, dict]:
    return {(r.get("screen_name") or "").lower(): r for r in rows if r.get("screen_name")}


def cluster_rows(tweets: list[dict], profiles: dict[str, dict]) -> list[dict]:
    cell_author_total: dict[tuple[str, str], int] = defaultdict(int)
    grouped: dict[tuple[str, str, str], list[dict]] = defaultdict(list)

    for tweet in tweets:
        cell = tweet.get("cell")
        if cell not in CELLS:
            continue
        author = (tweet.get("screen_name") or "").lower()
        if not author:
            continue
        cell_author_total[(cell, author)] += 1
        for tag in classify(tweet.get("text") or ""):
            grouped[(cell, author, tag)].append(tweet)

    rows = []
    for (cell, author, tag), ts in grouped.items():
        if len(ts) < 2:
            continue
        engs = [engagement(t) for t in ts]
        total = cell_author_total[(cell, author)]
        share = len(ts) / max(1, total)
        prof = profiles.get(author, {})
        examples = sorted(ts, key=engagement, reverse=True)[:3]
        followers = prof.get("followers_count") or 0
        # Score rewards recurrence, focus, and engagement without hiding the raw columns.
        score = len(ts) * (0.5 + share) * math.log10(max(10, median(engs) + 10))
        ease, effort = FORMAT_EASE.get(tag, ("unknown", "unknown"))
        rows.append({
            "cell": cell,
            "author": author,
            "format": tag,
            "n": len(ts),
            "author_cell_tweets": total,
            "share": share,
            "median_eng": median(engs),
            "p90_eng": p90(engs),
            "top_eng": max(engs),
            "followers": followers,
            "score": score,
            "ease": ease,
            "effort": effort,
            "examples": [{
                "url": e.get("url"),
                "eng": engagement(e),
                "views": e.get("views") or 0,
                "text": first_line(e.get("text") or ""),
            } for e in examples],
        })
    rows.sort(key=lambda r: (r["score"], r["n"], r["median_eng"]), reverse=True)
    return rows


def render_table(rows: list[dict], limit: int = 20) -> list[str]:
    lines = [
        "| account | format | repeats | share | median/p90 eng | ease | best example | pattern clue |",
        "|---|---|---:|---:|---:|---|---|---|",
    ]
    for r in rows[:limit]:
        ex = r["examples"][0]
        lines.append(
            f"| @{r['author']} ({r['followers']:,}) | {r['format']} | {r['n']}/{r['author_cell_tweets']} | "
            f"{r['share']:.0%} | {fmt_num(r['median_eng'])}/{r['p90_eng']} | {r['ease']} {r['effort']} | "
            f"[{ex['eng']} eng]({ex['url']}) | {ex['text']} |"
        )
    return lines


def render_cell(cell: str, rows: list[dict]) -> str:
    cell_rows = [r for r in rows if r["cell"] == cell]
    recurring = [r for r in cell_rows if r["format"] != "other"]
    actionable = [r for r in recurring if r["format"] in ACTIONABLE_FORMATS]
    highly_repeatable = [
        r for r in actionable
        if r["n"] >= 5 and r["share"] >= 0.35 and r["median_eng"] >= 25
    ]
    easy_wins = [
        r for r in actionable
        if r["ease"] in {"easy", "medium"} and r["n"] >= 3 and r["median_eng"] >= 25
    ]
    by_format: dict[str, int] = defaultdict(int)
    for r in recurring:
        by_format[r["format"]] += r["n"]

    lines = [
        f"# {cell} — account-level replicability",
        "",
        f"TL;DR: {len(highly_repeatable)} account-format pairs repeat at least 5 times and make up at least 35% of that account's harvested posts in this cell.",
        "",
        "## Fastest Copyable Patterns",
        "",
        *render_table(easy_wins, limit=15),
        "",
        "## Highest Signal-Grade Recurrence By Account",
        "",
        *render_table(actionable, limit=25),
        "",
        "## Format Recurrence Totals",
        "",
        "| format | repeated posts by clustered accounts |",
        "|---|---:|",
    ]
    for tag, n in sorted(by_format.items(), key=lambda kv: kv[1], reverse=True):
        lines.append(f"| {tag} | {n} |")
    lines.extend([
        "",
        "## How To Read This",
        "",
        "- `repeats` = posts from the same account in the same structural format.",
        "- `share` = how much of that account's harvested cell output uses that format.",
        "- A high-repeat, high-share row is easier to copy than a one-off viral post.",
        "- `meme_short` and `other` are excluded from the top tables because they are often reply spam, off-topic shock, or personality posts. They remain in recurrence totals.",
        "",
    ])
    return "\n".join(lines)


def render_global(rows: list[dict]) -> str:
    recurring = [r for r in rows if r["format"] != "other"]
    actionable = [r for r in recurring if r["format"] in ACTIONABLE_FORMATS]
    copyable = [
        r for r in actionable
        if r["ease"] in {"easy", "medium"} and r["n"] >= 3 and r["median_eng"] >= 25
    ]
    strongest = [
        r for r in actionable
        if r["n"] >= 5 and r["share"] >= 0.35 and r["median_eng"] >= 25
    ]

    format_cell_counts: dict[tuple[str, str], int] = defaultdict(int)
    for r in recurring:
        format_cell_counts[(r["format"], r["cell"])] += r["n"]
    by_format: dict[str, dict[str, int]] = defaultdict(dict)
    for (tag, cell), n in format_cell_counts.items():
        by_format[tag][cell] = n

    lines = [
        "# Replicability report — repeated formats by account",
        "",
        "Conclusion: the easiest recurring formats to copy are data drops, numbered lists, token/venue calls, daily recaps, and PNL/risk stories because multiple accounts repeat them in the harvest. One-off viral posts and reply spam are less useful than accounts that run the same structure again and again.",
        "",
        "## TL;DR",
        "",
        "| metric | value |",
        "|---|---:|",
        f"| account-format pairs with >=2 repeats, excluding `other` | {len(recurring)} |",
        f"| signal-grade account-format pairs | {len(actionable)} |",
        f"| high-repeat + high-share + median >=25 pairs | {len(strongest)} |",
        f"| easy/medium pairs with >=3 repeats and median >=25 | {len(copyable)} |",
        "",
        "## Best Recurrent Patterns To Copy First",
        "",
        *render_table(copyable, limit=30),
        "",
        "## Strongest Signal-Grade Account Habits",
        "",
        *render_table(strongest, limit=30),
        "",
        "## Repeated Format Volume By Cell",
        "",
        "| format | trenches-en | trenches-cn | perps-en | perps-cn | perps-jp | perps-kr |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for tag, counts in sorted(by_format.items(), key=lambda kv: sum(kv[1].values()), reverse=True):
        vals = [counts.get(cell, 0) for cell in CELLS]
        lines.append(f"| {tag} | " + " | ".join(str(v) for v in vals) + " |")
    lines.extend([
        "",
        "## Per-Cell Reports",
        "",
    ])
    for cell in CELLS:
        lines.append(f"- [{cell}](../../docs/x-targeting/niches/{cell}/replicability.md) (~4 min)")
    lines.extend([
        "",
        "## Method",
        "",
        "- Zero API calls. The report uses `cache/tweets.jsonl`, `cache/profiles.jsonl`, and `format_miner.classify()`.",
        "- A row is an account using the same structural format at least twice in one cell.",
        "- `score = repeats * (0.5 + share) * log10(median_eng + 10)`. It is only for sorting; use the visible columns for decisions.",
        "- `meme_short` and `other` are kept out of main rankings because they often capture reply spam, off-topic shock, or personality posts rather than a clean research format.",
        "- They still appear in the repeated-volume table so you can see where the harvest was noisy.",
        "",
    ])
    return "\n".join(lines)


def main() -> None:
    tweets = load_jsonl(TWEETS)
    profiles = profile_index(load_jsonl(PROFILES))
    rows = cluster_rows(tweets, profiles)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(render_global(rows))
    for cell in CELLS:
        path = XROOT / "niches" / cell / "replicability.md"
        path.write_text(render_cell(cell, rows))
    print(f"wrote {OUT}")
    for cell in CELLS:
        print(f"wrote {XROOT / 'niches' / cell / 'replicability.md'}")


if __name__ == "__main__":
    main()
