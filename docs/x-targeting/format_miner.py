#!/usr/bin/env python3
"""Mine replicable content formats from cached tweets. Zero API cost.

Classifies each cached tweet into structural format signatures, then ranks
formats by median engagement within a cell. Output: which forms win, with
exemplars.

Usage:
  format_miner.py CELL
  format_miner.py CELL --min-n 3
"""
from __future__ import annotations

import json
import re
import statistics
import sys
from pathlib import Path

ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
TWEETS = ROOT / "cache" / "tweets.jsonl"
PROFILES = ROOT / "cache" / "profiles.jsonl"

SIGNATURES: list[tuple[str, callable]] = []


def sig(name):
    def reg(fn):
        SIGNATURES.append((name, fn))
        return fn
    return reg


NUM_ITEM = re.compile(r"(?m)^\s*(?:\d{1,2}\s*[\.\)、/]|[1-9]️?⃣|[①-⑩])")
TICKER = re.compile(r"\$[A-Za-z][A-Za-z0-9]{1,9}\b")
SOL_CA = re.compile(r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b")
PCT_OR_X = re.compile(r"(?:[+\-]?\d[\d,]*(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?x\b|\d+\s*倍)")
MONEY = re.compile(r"[$￥¥₩][\d,]+|\d[\d,]*\s*(?:USD|U\b|만원|円|刀)")
RECAP_WORD = re.compile(r"(?i)(today|daily|recap|wrap|复盘|今日|今天|本日|今日の|まとめ|오늘|데일리|정리)")
DATA_WORD = re.compile(r"(?i)(volume|tvl|funding|open interest|\bOI\b|liquidat|交易量|资金费|持仓|爆仓|出来高|資金調達率|清算|거래량|펀딩|청산)")
TUTORIAL = re.compile(r"(?i)(how to|guide|step[- ]by|tutorial|教程|教学|方法|攻略|やり方|手順|초보|방법|가이드)")
THREAD = re.compile(r"(?:🧵|👇|a thread|繼續|スレッド|쓰레드|스레드)\s*$|\bthread\b", re.IGNORECASE)
QUESTION = re.compile(r"[?？]\s*$")
PNL_WORD = re.compile(r"(?i)(pnl|profit|gain|bag|赚|盈利|益|利確|손익|수익)")


@sig("numbered_list")
def _numbered(t):
    return len(NUM_ITEM.findall(t)) >= 3


@sig("token_call")
def _call(t):
    return bool(TICKER.search(t)) and (bool(SOL_CA.search(t)) or "CA" in t.upper())


@sig("pnl_flex")
def _pnl(t):
    return bool(PCT_OR_X.search(t)) and (bool(MONEY.search(t)) or bool(PNL_WORD.search(t)))


@sig("daily_recap")
def _recap(t):
    return bool(RECAP_WORD.search(t)) and (len(NUM_ITEM.findall(t)) >= 2 or len(TICKER.findall(t)) >= 2)


@sig("data_drop")
def _data(t):
    return bool(DATA_WORD.search(t)) and len(re.findall(r"\d", t)) >= 6


@sig("tutorial")
def _tut(t):
    return bool(TUTORIAL.search(t))


@sig("thread_hook")
def _thread(t):
    return bool(THREAD.search(t))


@sig("question_bait")
def _q(t):
    return bool(QUESTION.search(t)) and len(t) < 160


@sig("meme_short")
def _meme(t):
    return len(t) < 120 and "http" not in t and not TICKER.search(t) and not NUM_ITEM.search(t)


def classify(text: str) -> list[str]:
    text = text or ""
    return [name for name, fn in SIGNATURES if fn(text)] or ["other"]


def load_jsonl(p: Path) -> list[dict]:
    if not p.exists():
        return []
    out = []
    for line in p.read_text().split("\n"):
        if not line.strip():
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def engagement(t: dict) -> int:
    return (t.get("favorites") or 0) + 3 * (t.get("retweets") or 0) \
        + 2 * (t.get("replies") or 0) + 4 * (t.get("quotes") or 0)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cell = sys.argv[1]
    min_n = int(sys.argv[sys.argv.index("--min-n") + 1]) if "--min-n" in sys.argv else 5
    followers = {(p.get("screen_name") or "").lower(): p.get("followers_count") or 0
                 for p in load_jsonl(PROFILES)}
    rows = [t for t in load_jsonl(TWEETS) if t.get("cell") == cell]
    if not rows:
        print(f"no tweets tagged cell={cell} — run the sweep first", file=sys.stderr)
        sys.exit(1)
    buckets: dict[str, list[dict]] = {}
    for t in rows:
        for tag in classify(t.get("text") or ""):
            buckets.setdefault(tag, []).append(t)
    report = []
    for tag, ts in buckets.items():
        if len(ts) < min_n:
            continue
        engs = sorted((engagement(t) for t in ts), reverse=True)
        exemplars = sorted(ts, key=engagement, reverse=True)[:3]
        report.append({
            "format": tag,
            "n": len(ts),
            "median_eng": statistics.median(engs),
            "p90_eng": engs[max(0, len(engs) // 10 - 1)] if len(engs) >= 10 else engs[0],
            "exemplars": [{
                "url": e.get("url"),
                "author": e.get("screen_name"),
                "author_followers": followers.get((e.get("screen_name") or "").lower(), 0),
                "eng": engagement(e),
                "views": e.get("views"),
                "text": (e.get("text") or "")[:280],
            } for e in exemplars],
        })
    report.sort(key=lambda r: r["median_eng"], reverse=True)
    outdir = ROOT / "niches" / cell
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "formats.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    lines = [f"# {cell} — format ranking ({len(rows)} tweets mined)", ""]
    lines.append("| format | n | median eng | p90 eng | top exemplar |")
    lines.append("|---|---|---|---|---|")
    for r in report:
        ex = r["exemplars"][0]
        lines.append(f"| {r['format']} | {r['n']} | {r['median_eng']} | {r['p90_eng']} | "
                     f"[@{ex['author']}]({ex['url']}) ({ex['eng']} eng) |")
    lines.append("")
    for r in report:
        lines.append(f"## {r['format']} (n={r['n']}, median {r['median_eng']})")
        for ex in r["exemplars"]:
            lines.append(f"- **{ex['eng']} eng** @{ex['author']} ({ex['author_followers']} fo) — "
                         f"{(ex['text'] or '').splitlines()[0][:120]} — {ex['url']}")
        lines.append("")
    (outdir / "formats.md").write_text("\n".join(lines))
    print(f"wrote {outdir}/formats.json + formats.md  ({len(report)} formats qualified)")


if __name__ == "__main__":
    main()
