#!/usr/bin/env python3
"""Mine strong repeatable motifs from cached tweets.

A strong motif is a content skeleton that appears across many accounts and
dates, not just a broad topic label.

Outputs:
- docs/x-targeting/repeatable_motifs.json
- docs/x-targeting/repeatable_motifs.md
"""
from __future__ import annotations

import json
import re
import statistics
from collections import Counter
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parent
TWEETS = ROOT / "cache" / "tweets.jsonl"
OUT_JSON = ROOT / "repeatable_motifs.json"
OUT_MD = ROOT / "repeatable_motifs.md"
CELLS = {"trenches-en", "trenches-cn", "perps-en", "perps-cn", "perps-jp", "perps-kr"}

EXCLUDE = re.compile(
    r"(?i)(giveaway|airdrop|rt \+|retweet|repost|follow .* win|drop your|"
    r"drop .* address|sol address|addy|抽奖|开奖|转发|关注.*抽|"
    r"フォロー.*RT|プレゼント企画|리트윗|팔로우.*추첨|추첨)"
)


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


def created_day(t: dict) -> str | None:
    try:
        return parsedate_to_datetime(t.get("created_at")).date().isoformat()
    except Exception:
        return None


def numbered(text: str) -> bool:
    return bool(
        re.search(
            r"(?s)(?:^|\n|\s)(?:1[\.\)、]|1️⃣|①).{0,500}"
            r"(?:^|\n|\s)(?:2[\.\)、]|2️⃣|②).{0,500}"
            r"(?:^|\n|\s)(?:3[\.\)、]|3️⃣|③)",
            text,
        )
    )


MotifFn = Callable[[str], bool]


MOTIFS: list[tuple[str, str, MotifFn]] = [
    (
        "venue_risk_data_drop",
        "Venue or product post tied to a hard market/risk metric such as OI, funding, margin, liquidation, TVL, fees, revenue, or points.",
        lambda t: bool(
            re.search(
                r"(?i)(perp dex|hyperliquid|lighter|edgeX|gmx|dydx|Aster|Backpack|TermMax|Gate|Bitget|Binance|"
                r"币安|合约|永续|하이퍼리퀴드|무기한|先物|無期限|perps|HYPE)",
                t,
            )
            and re.search(
                r"(?i)(volume|OI\b|open interest|funding|TVL|fee|collateral|margin|liquidat|revenue|points|"
                r"交易量|资金费|持仓|保证金|抵押|清算|爆仓|펀딩|청산|거래량|証拠金|出来高)",
                t,
            )
            and not EXCLUDE.search(t)
        ),
    ),
    (
        "wallet_tool_signal",
        "Wallet/tool signal posts: tracker, smart money, top holder, insider, sniper, bundle, or terminal workflow.",
        lambda t: bool(
            re.search(
                r"(?i)(wallet tracker|smart money|top holder|bundle check|sniper|insider|GMGN|Axiom|Photon|BullX|"
                r"钱包|聪明钱|狙击|老鼠仓|貔貅|ウォレット|スマートマネー|지갑)",
                t,
            )
            and not EXCLUDE.search(t)
        ),
    ),
    (
        "bounded_downside_mechanic",
        "Posts that contrast trading with no liquidation, fixed risk, max loss, premium-only downside, or bounded loss.",
        lambda t: bool(
            re.search(
                r"(?i)(no liquidation|without liquidation|bounded|max loss|fixed risk|no forced|worst case|premium|option|put|call|"
                r"权利金|最大亏损|没有爆仓|没有清算|有限亏损|청산.*없|ロスカ.*ない|清算.*ない)",
                t,
            )
            and not EXCLUDE.search(t)
        ),
    ),
    (
        "liquidation_trigger_card",
        "Liquidation, margin-call, or heatmap post with a traded asset, level, long/short, OI, map, cluster, or trigger.",
        lambda t: bool(
            re.search(r"(?i)(liquidat|liq\b|heatmap|清算|爆仓|ロスカ|追証|청산)", t)
            and re.search(
                r"(?i)(BTC|ETH|HYPE|price|level|long|short|OI|open interest|funding|map|cluster|"
                r"트리거|가격|롱|숏|価格|水準|ライン|上値|下値|多单|空单|持仓)",
                t,
            )
            and not EXCLUDE.search(t)
        ),
    ),
    (
        "numbered_market_rule",
        "Numbered market/trading rule or checklist with at least three items.",
        lambda t: bool(
            numbered(t)
            and re.search(
                r"(?i)(trade|trading|market|crypto|BTC|ETH|SOL|perp|HYPE|funding|liquidat|wallet|token|"
                r"币|合约|交易|行情|链上|清算|爆仓|トレード|仮想通貨|先物|투자|코인|매매|손절|시장|펀딩)",
                t,
            )
            and not EXCLUDE.search(t)
        ),
    ),
    (
        "copytrade_teacher_group",
        "Copy-trade, teacher, trading journal, recap, or group-following content.",
        lambda t: bool(
            re.search(r"(?i)(copy trade|copytrading|跟单|带单|老师|리딩방|카피트레이딩|trading journal|매매일지|복기)", t)
            and not EXCLUDE.search(t)
        ),
    ),
]


def load_tweets() -> list[dict]:
    rows = []
    for line in TWEETS.read_text().split("\n"):
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get("cell") in CELLS:
            rows.append(row)
    return rows


def analyze() -> list[dict]:
    rows = load_tweets()
    out = []
    for name, desc, fn in MOTIFS:
        hits = [t for t in rows if fn(norm_text(t))]
        authors = {(t.get("screen_name") or "").lower() for t in hits if t.get("screen_name")}
        days = {created_day(t) for t in hits if created_day(t)}
        engs = [engagement(t) for t in hits]
        views = [int_value(t.get("views")) for t in hits]
        top = sorted(hits, key=engagement, reverse=True)[:12]
        out.append(
            {
                "motif": name,
                "description": desc,
                "posts": len(hits),
                "authors": len(authors),
                "days": len(days),
                "date_start": min(days) if days else None,
                "date_end": max(days) if days else None,
                "cells": dict(Counter(t.get("cell") for t in hits)),
                "median_engagement": statistics.median(engs) if engs else 0,
                "median_views": statistics.median(views) if views else 0,
                "p90_engagement": sorted(engs)[int(0.9 * (len(engs) - 1))] if engs else 0,
                "strong_bar": len(hits) >= 50 and len(authors) >= 20 and len(days) >= 10,
                "examples": [
                    {
                        "cell": t.get("cell"),
                        "author": t.get("screen_name"),
                        "created_at": t.get("created_at"),
                        "engagement": engagement(t),
                        "views": int_value(t.get("views")),
                        "url": t.get("url"),
                        "text": norm_text(t)[:220],
                    }
                    for t in top
                ],
            }
        )
    return sorted(out, key=lambda r: (r["strong_bar"], r["posts"], r["authors"]), reverse=True)


def write_report(rows: list[dict]) -> None:
    OUT_JSON.write_text(json.dumps({"generated_at": datetime.utcnow().isoformat() + "Z", "motifs": rows}, indent=2, ensure_ascii=False))
    lines = ["# Repeatable motifs — 50+ post validation", ""]
    lines.append("A motif passes the strong bar when it has at least 50 posts, 20 accounts, and 10 dates.")
    lines.append("")
    lines.append("| motif | strong | posts | accounts | dates | date range | cells | median eng/views |")
    lines.append("|---|---|---:|---:|---:|---|---|---:|")
    for r in rows:
        cells = ", ".join(f"{k}:{v}" for k, v in sorted(r["cells"].items()))
        strong = "yes" if r["strong_bar"] else "no"
        lines.append(
            f"| {r['motif']} | {strong} | {r['posts']} | {r['authors']} | {r['days']} | "
            f"{r['date_start']} → {r['date_end']} | {cells} | {r['median_engagement']} / {r['median_views']} |"
        )
    for r in rows:
        lines.extend(["", f"## {r['motif']}", "", r["description"], ""])
        lines.append("| eng | cell | account | example | clue |")
        lines.append("|---:|---|---|---|---|")
        for ex in r["examples"][:8]:
            clue = (ex["text"] or "").replace("|", "/")
            lines.append(f"| {ex['engagement']} | {ex['cell']} | @{ex['author']} | [post]({ex['url']}) | {clue} |")
    OUT_MD.write_text("\n".join(lines))


def main() -> None:
    rows = analyze()
    write_report(rows)
    print(f"wrote {OUT_JSON} + {OUT_MD} ({len(rows)} motifs)")


if __name__ == "__main__":
    main()
