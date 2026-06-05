#!/usr/bin/env python3
"""Find regular funding-arbitrage accounts from cached tweets.

Regular means >=3 cached posts. The report separates broad funding-rate
mentioners from clean funding-arbitrage accounts.

Outputs:
- docs/x-targeting/funding_arb_accounts.json
- docs/x-targeting/funding_arb_accounts.md
"""
from __future__ import annotations

import json
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TWEETS = ROOT / "cache" / "tweets.jsonl"
PROFILES = ROOT / "cache" / "profiles.jsonl"
OUT_JSON = ROOT / "funding_arb_accounts.json"
OUT_MD = ROOT / "funding_arb_accounts.md"

LANG_PATTERNS = {
    "en": re.compile(r"(?i)(funding (rate )?(arbitrage|arb)|basis trade|cash and carry|delta neutral|negative funding|positive funding|funding flipped|funding rates?)"),
    "zh": re.compile(r"(资金费率|资金费|费率套利|资金费套利|资金费率套利|搬砖|基差交易|正套|反套|Delta\s*中性|德尔塔中性|负资金费率)"),
    "ja": re.compile(r"(資金調達率|資金調達率套利|資金調達|デルタニュートラル|裁定|アービトラージ|マイナス資金調達率|資金調達率マイナス)"),
    "ko": re.compile(r"(펀딩비|펀딩비 차익|펀딩비 차익거래|펀딩비 아비트라지|델타 ?중립|베이시스|마이너스 펀딩비)"),
}

TRUE_ARB = re.compile(
    r"(?i)(arbitrage|arb|basis|cash and carry|delta neutral|negative funding|positive funding|"
    r"套利|搬砖|基差|正套|反套|中性|裁定|アービトラージ|デルタニュートラル|차익|델타 ?중립|베이시스)"
)

CLEAN_ARB = {
    "en": re.compile(
        r"(?i)(funding (rate )?(arbitrage|arb)|cross[- ]exchange funding|basis trade|cash and carry|"
        r"delta[- ]?neutral|market[- ]?neutral|perp.*spot|spot.*perp|hedg)"
    ),
    "zh": re.compile(r"(资金费.*(套利|搬砖)|费率套利|资金费率套利|基差交易|正套|反套|Delta\s*中性|德尔塔中性|市场中性)"),
    "ja": re.compile(r"(資金調達.*(裁定|アービトラージ)|デルタニュートラル|現物.*先物.*裁定|先物.*現物.*裁定)"),
    "ko": re.compile(
        r"(펀딩비.{0,80}(차익|아비트라지)|델타 ?중립|"
        r"현물.{0,80}선물.{0,80}차익|선물.{0,80}현물.{0,80}차익|현선물.{0,80}(괴리|차익))"
    ),
}


def load_jsonl(path: Path) -> list[dict]:
    out = []
    if not path.exists():
        return out
    for line in path.read_text().split("\n"):
        if not line.strip():
            continue
        out.append(json.loads(line))
    return out


def engagement(t: dict) -> int:
    return (t.get("favorites") or 0) + 3 * (t.get("retweets") or 0) + 2 * (t.get("replies") or 0) + 4 * (t.get("quotes") or 0)


def norm_text(t: dict) -> str:
    return " ".join((t.get("text") or "").split())


def int_value(v: object) -> int:
    if isinstance(v, int):
        return v
    if isinstance(v, str):
        try:
            return int(v.replace(",", ""))
        except ValueError:
            return 0
    return 0


def day(t: dict) -> str | None:
    try:
        return parsedate_to_datetime(t.get("created_at")).date().isoformat()
    except Exception:
        return None


def load_profiles() -> dict[str, dict]:
    return {(p.get("screen_name") or "").lower(): p for p in load_jsonl(PROFILES)}


def classify_language(text: str, cell: str) -> str | None:
    if cell.endswith("-en"):
        return "en"
    if cell.endswith("-cn"):
        return "zh"
    if cell.endswith("-jp"):
        return "ja"
    if cell.endswith("-kr"):
        return "ko"
    for lang, rx in LANG_PATTERNS.items():
        if rx.search(text):
            return lang
    return None


def analyze() -> dict:
    profiles = load_profiles()
    buckets: dict[str, dict[str, list[dict]]] = {lang: defaultdict(list) for lang in LANG_PATTERNS}
    for t in load_jsonl(TWEETS):
        text = norm_text(t)
        cell = t.get("cell") or ""
        lang = classify_language(text, cell)
        if lang and LANG_PATTERNS[lang].search(text):
            buckets[lang][(t.get("screen_name") or "").lower()].append(t)

    report = {"generated_at": datetime.utcnow().isoformat() + "Z", "languages": {}}
    for lang, by_account in buckets.items():
        accounts = []
        for account, ts in by_account.items():
            if len(ts) < 2:
                continue
            days = sorted({day(t) for t in ts if day(t)})
            engs = [engagement(t) for t in ts]
            views = [int_value(t.get("views")) for t in ts]
            true_count = sum(1 for t in ts if TRUE_ARB.search(norm_text(t)))
            clean_count = sum(1 for t in ts if CLEAN_ARB[lang].search(norm_text(t)))
            regular = len(ts) >= 3
            clean_regular = clean_count >= 3
            strong = clean_count >= 5
            confidence = "high" if clean_regular else "medium" if regular else "near-miss"
            profile = profiles.get(account, {})
            top = sorted(ts, key=engagement, reverse=True)[:5]
            accounts.append(
                {
                    "account": account,
                    "followers": profile.get("followers_count") or 0,
                    "posts": len(ts),
                    "true_arb_posts": true_count,
                    "clean_arb_posts": clean_count,
                    "regular": regular,
                    "clean_regular": clean_regular,
                    "strong": strong,
                    "confidence": confidence,
                    "days": len(days),
                    "date_start": days[0] if days else None,
                    "date_end": days[-1] if days else None,
                    "cells": dict(Counter(t.get("cell") or "-" for t in ts)),
                    "median_engagement": statistics.median(engs) if engs else 0,
                    "median_views": statistics.median(views) if views else 0,
                    "examples": [
                        {
                            "cell": t.get("cell") or "-",
                            "created_at": t.get("created_at"),
                            "engagement": engagement(t),
                            "views": int_value(t.get("views")),
                            "url": t.get("url"),
                            "text": norm_text(t)[:240],
                        }
                        for t in top
                    ],
                }
            )
        accounts.sort(
            key=lambda r: (r["clean_regular"], r["regular"], r["clean_arb_posts"], r["posts"], r["median_engagement"]),
            reverse=True,
        )
        report["languages"][lang] = {
            "matching_posts": sum(len(v) for v in by_account.values()),
            "matching_accounts": len(by_account),
            "regular_mention_accounts": sum(1 for a in accounts if a["regular"]),
            "clean_regular_accounts": sum(1 for a in accounts if a["clean_regular"]),
            "strong_accounts": sum(1 for a in accounts if a["strong"]),
            "accounts": accounts,
        }
    return report


def write_report(report: dict) -> None:
    OUT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    lines = ["# Funding-arbitrage accounts — regular posters", ""]
    lines.append("Regular mentioners have at least 3 cached funding-rate posts. Clean regular accounts have at least 3 cached posts with funding-arb, basis, cash-and-carry, delta-neutral, or market-neutral language.")
    lines.append("")
    lines.append("| language | matching posts | accounts | regular mentioners | clean regular accounts | strong clean accounts |")
    lines.append("|---|---:|---:|---:|---:|---:|")
    for lang, data in report["languages"].items():
        lines.append(
            f"| {lang} | {data['matching_posts']} | {data['matching_accounts']} | "
            f"{data['regular_mention_accounts']} | {data['clean_regular_accounts']} | {data['strong_accounts']} |"
        )

    for lang, data in report["languages"].items():
        lines.extend(["", f"## {lang}", ""])
        lines.append("| account | posts | broad arb | clean arb | dates | median eng/views | confidence | examples |")
        lines.append("|---|---:|---:|---:|---:|---:|---|---|")
        for account in data["accounts"][:15]:
            examples = " ".join(f"[{i + 1}]({ex['url']})" for i, ex in enumerate(account["examples"][:3]))
            lines.append(
                f"| @{account['account']} ({account['followers']}) | {account['posts']} | {account['true_arb_posts']} | "
                f"{account['clean_arb_posts']} | {account['days']} | {account['median_engagement']} / {account['median_views']} | "
                f"{account['confidence']} | {examples} |"
            )
        for account in data["accounts"][:8]:
            lines.extend(["", f"### @{account['account']}", ""])
            lines.append("| eng | cell | example | clue |")
            lines.append("|---:|---|---|---|")
            for ex in account["examples"][:3]:
                clue = (ex["text"] or "").replace("|", "/")
                lines.append(f"| {ex['engagement']} | {ex['cell']} | [post]({ex['url']}) | {clue} |")
    OUT_MD.write_text("\n".join(lines))


def main() -> None:
    report = analyze()
    write_report(report)
    print(f"wrote {OUT_JSON} + {OUT_MD}")


if __name__ == "__main__":
    main()
