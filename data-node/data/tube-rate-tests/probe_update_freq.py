#!/usr/bin/env python3
"""Probe how often pornstar view counts change upstream.

Polls 5 top stars on each of 4 sites at 5-second intervals for a fixed
duration. Logs every observed view count. At the end, reports per-star:

- samples taken
- number of observed changes (a "tick")
- total view delta over the window
- fastest, mean, slowest interval between ticks

Answers: is polling at 5s meaningful, or does each site batch-update its
counter at a coarser cadence?

Run from the repo root:
    python3 data-node/data/tube-rate-tests/probe_update_freq.py \
        --duration 240 --interval 5
"""

from __future__ import annotations
import argparse
import csv
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.request import Request, urlopen

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

@dataclass
class Target:
    site: str
    slug: str
    url: str
    regex: re.Pattern[str]

def parse_scaled(raw: str) -> int | None:
    s = raw.strip()
    mult = 1
    if s.endswith("B"): mult, s = 1_000_000_000, s[:-1]
    elif s.endswith("M"): mult, s = 1_000_000, s[:-1]
    elif s.endswith("K"): mult, s = 1_000, s[:-1]
    s = s.replace(",", "")
    try:
        return int(float(s) * mult)
    except ValueError:
        return None

def fetch(url: str, timeout: int = 15) -> str | None:
    req = Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    try:
        with urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  fetch error {url}: {e}", file=sys.stderr)
        return None

# ---------------------------------------------------------------------------
# Site probes
# ---------------------------------------------------------------------------

PH_SLUG = re.compile(r'href="/pornstar/([a-z0-9\-_]+)"')
PH_NAME = re.compile(r'class="performerName"[^>]*>\s*([^<]+?)\s*</a>', re.DOTALL)
PH_VIEWS_RE = re.compile(r'class="viewsCount performerCount">\s*([\d.]+[KMB]?)')
PH_CARD_SPLIT = 'class="performerCard"'
XV_VIEWS = re.compile(r'<span class="mobile-hide">([\d,]+)</span>[^<]*<span[^>]*>[^<]+</span>\s*video views')
XN_VIEWS = re.compile(r'class="views">\s*<span[^>]*></span>\s*([\d,]+)\s*video views')
EP_VIEWS = re.compile(r'Video views:<span>([\d,]+)</span>')
XV_LIST = re.compile(r'href="/pornstars/([a-zA-Z0-9_\-\.]+)"')
XN_LIST = re.compile(r'href="(/pornstar/[^"]+)"')
EP_LIST = re.compile(r'href="(/pornstar/[^"]+)"')

def _iter_pornhub_cards(html: str):
    """Yield (slug, name, views_raw) for each performer card, one card at a
    time. Splits on the performerCard class boundary so lazy regex quantifiers
    can't backtrack across cards."""
    for chunk in html.split(PH_CARD_SPLIT)[1:]:
        slug_m = PH_SLUG.search(chunk)
        views_m = PH_VIEWS_RE.search(chunk)
        if not (slug_m and views_m):
            continue
        name_m = PH_NAME.search(chunk)
        yield (slug_m.group(1), (name_m.group(1).strip() if name_m else ""), views_m.group(1))

def discover_pornhub(top_n: int) -> list[Target]:
    html = fetch("https://www.pornhub.com/pornstars?o=t")
    if not html: return []
    targets = []
    for slug, _name, _views in _iter_pornhub_cards(html):
        targets.append(Target(
            site="pornhub",
            slug=slug,
            url=f"https://www.pornhub.com/pornstar/{slug}",
            regex=PH_VIEWS_RE,  # unused — PH uses listing
        ))
        if len(targets) >= top_n: break
    return targets

def discover_xvideos(top_n: int) -> list[Target]:
    html = fetch("https://www.xvideos.com/pornstars")
    if not html: return []
    seen = set()
    out = []
    for m in XV_LIST.finditer(html):
        slug = m.group(1)
        if slug in seen: continue
        seen.add(slug)
        out.append(Target(
            site="xvideos",
            slug=slug,
            url=f"https://www.xvideos.com/pornstars/{slug}",
            regex=XV_VIEWS,
        ))
        if len(out) >= top_n: break
    return out

def discover_xnxx(top_n: int) -> list[Target]:
    html = fetch("https://www.xnxx.com/pornstars")
    if not html: return []
    seen = set()
    out = []
    for m in XN_LIST.finditer(html):
        path = m.group(1)
        if path in seen: continue
        seen.add(path)
        slug = path.rsplit("/", 1)[-1]
        out.append(Target(
            site="xnxx",
            slug=slug,
            url=f"https://www.xnxx.com{path}",
            regex=XN_VIEWS,
        ))
        if len(out) >= top_n: break
    return out

def discover_eporner(top_n: int) -> list[Target]:
    html = fetch("https://www.eporner.com/pornstars/")
    if not html: return []
    seen = set()
    out = []
    for m in EP_LIST.finditer(html):
        path = m.group(1)
        if path in seen: continue
        seen.add(path)
        slug = path.strip("/").rsplit("/", 1)[-1]
        out.append(Target(
            site="eporner",
            slug=slug,
            url=f"https://www.eporner.com{path}",
            regex=EP_VIEWS,
        ))
        if len(out) >= top_n: break
    return out

# ---------------------------------------------------------------------------
# Polling
# ---------------------------------------------------------------------------

def fetch_view_count(t: Target) -> int | None:
    if t.site == "pornhub":
        # One listing fetch per cycle handles all pornhub stars — the caller
        # collapses this. Individual call path here is a fallback.
        html = fetch(t.url)
        if not html: return None
        # Profile page doesn't expose aggregate; use listing instead.
        return None
    html = fetch(t.url)
    if not html: return None
    m = t.regex.search(html)
    if not m: return None
    return parse_scaled(m.group(1))

def fetch_pornhub_batch(targets: list[Target]) -> dict[str, int]:
    """One request, all pornhub stars — listing carries views."""
    html = fetch("https://www.pornhub.com/pornstars?o=t")
    if not html: return {}
    out = {}
    for slug, _name, views_raw in _iter_pornhub_cards(html):
        v = parse_scaled(views_raw)
        if v is not None:
            out[slug] = v
    return out

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def summarize(rows: list[tuple[float, str, str, int]]) -> str:
    """rows: [(ts, site, slug, views), ...]"""
    by_star: dict[tuple[str, str], list[tuple[float, int]]] = {}
    for ts, site, slug, views in rows:
        by_star.setdefault((site, slug), []).append((ts, views))

    lines = [
        "site,slug,samples,changes,first_views,last_views,total_delta,first_change_s,fastest_tick_s,mean_tick_s,slowest_tick_s"
    ]
    for (site, slug), samples in sorted(by_star.items()):
        samples.sort()
        if not samples: continue
        first_ts, first_v = samples[0]
        last_ts, last_v = samples[-1]
        changes = []
        prev_ts, prev_v = first_ts, first_v
        first_change_ts = None
        for ts, v in samples[1:]:
            if v != prev_v:
                changes.append((ts - prev_ts, v - prev_v))
                if first_change_ts is None:
                    first_change_ts = ts - first_ts
                prev_ts, prev_v = ts, v
        n_changes = len(changes)
        total_delta = last_v - first_v
        if n_changes > 0:
            intervals = [c[0] for c in changes]
            fastest = min(intervals)
            slowest = max(intervals)
            mean = sum(intervals) / len(intervals)
            first_s = f"{first_change_ts:.1f}" if first_change_ts else ""
            lines.append(
                f"{site},{slug},{len(samples)},{n_changes},{first_v},{last_v},{total_delta},"
                f"{first_s},{fastest:.1f},{mean:.1f},{slowest:.1f}"
            )
        else:
            lines.append(
                f"{site},{slug},{len(samples)},0,{first_v},{last_v},0,,,,"
            )
    return "\n".join(lines)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--duration", type=int, default=240, help="total seconds to run")
    ap.add_argument("--interval", type=int, default=5, help="seconds between polls")
    ap.add_argument("--stars-per-site", type=int, default=5)
    ap.add_argument("--output-dir", default="data-node/data/tube-rate-tests")
    args = ap.parse_args()

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_csv = out_dir / "update-freq-raw.csv"
    summary_csv = out_dir / "update-freq-summary.csv"

    print(f"Discovering top {args.stars_per_site} per site...")
    pornhub = discover_pornhub(args.stars_per_site)
    xvideos = discover_xvideos(args.stars_per_site)
    xnxx = discover_xnxx(args.stars_per_site)
    eporner = discover_eporner(args.stars_per_site)
    print(f"  pornhub: {len(pornhub)}  xvideos: {len(xvideos)}  xnxx: {len(xnxx)}  eporner: {len(eporner)}")

    ph_slugs = {t.slug for t in pornhub}
    profile_targets = xvideos + xnxx + eporner

    rows: list[tuple[float, str, str, int]] = []
    t0 = time.time()
    deadline = t0 + args.duration
    cycle = 0
    while time.time() < deadline:
        cycle_start = time.time()
        ts = cycle_start
        # Pornhub: one request, all stars
        if pornhub:
            ph_views = fetch_pornhub_batch(pornhub)
            for slug in ph_slugs:
                if slug in ph_views:
                    rows.append((ts, "pornhub", slug, ph_views[slug]))
        # Others: per-profile
        for t in profile_targets:
            v = fetch_view_count(t)
            if v is not None:
                rows.append((time.time(), t.site, t.slug, v))
        cycle += 1
        print(f"  cycle {cycle} done at t={int(time.time()-t0)}s, rows={len(rows)}")
        elapsed = time.time() - cycle_start
        sleep_for = max(0.0, args.interval - elapsed)
        time.sleep(sleep_for)

    # Write raw CSV
    with open(raw_csv, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ts_epoch", "site", "slug", "views"])
        for r in rows:
            w.writerow([f"{r[0]:.3f}", r[1], r[2], r[3]])
    print(f"Raw samples written: {raw_csv}")

    summary = summarize(rows)
    with open(summary_csv, "w") as f:
        f.write(summary + "\n")
    print(f"Summary written: {summary_csv}")
    print()
    print(summary)
    return 0

if __name__ == "__main__":
    sys.exit(main())
