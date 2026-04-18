#!/usr/bin/env python3
"""Continuous tube data collector — 48h, 5-min cadence, double-sampled.

Polls six signals every INTERVAL_SECS. Each cycle double-samples: poll
once, wait DOUBLE_DELAY_SECS, poll again. The A/B pair lets us distinguish
real upstream movement from CDN cache alternation (where the same URL
returns two stale values depending on which edge node answers).

Output: one JSONL file, appended per cycle. Designed for nohup. Resumes
cleanly on relaunch by appending to the same file.

Env vars (all optional):
  INTERVAL_SECS       (default 300)
  DOUBLE_DELAY_SECS   (default 10)
  TOP_N               (default 10)
  DURATION_SECS       (default 172800 = 48h)
  OUT_DIR             (default data-node/data/tube-rate-tests/collect-48h)
"""
from __future__ import annotations
import json, os, re, sys, time, urllib.request
from pathlib import Path

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
INTERVAL = int(os.environ.get('INTERVAL_SECS', '300'))
DELAY = int(os.environ.get('DOUBLE_DELAY_SECS', '10'))
TOP_N = int(os.environ.get('TOP_N', '10'))
DURATION = int(os.environ.get('DURATION_SECS', str(48 * 3600)))
OUT_DIR = Path(os.environ.get('OUT_DIR',
    'data-node/data/tube-rate-tests/collect-48h'))

OUT_DIR.mkdir(parents=True, exist_ok=True)
EVENTS = OUT_DIR / 'events.jsonl'

# ---- Regexes (empirically verified against live pages) ----------------------
PH_CARD_SPLIT = 'class="performerCard"'
PH_SLUG = re.compile(r'href="/pornstar/([a-z0-9\-_]+)"')
PH_NAME = re.compile(r'class="performerName"[^>]*>\s*([^<]+?)\s*</a>', re.DOTALL)
PH_VIEWS = re.compile(r'class="viewsCount performerCount">\s*([\d.]+[KMB]?)')
PH_RANK = re.compile(r'class="rankNumber">(\d+)</span>')
XV_STAR_LIST = re.compile(r'href="/pornstars/([a-zA-Z0-9_\-\.]+)"')
XV_STAR_VIEWS = re.compile(r'<span class="mobile-hide">([\d,]+)</span>[^<]*<span[^>]*>[^<]+</span>\s*video views')
XN_STAR_LIST = re.compile(r'href="(/pornstar/[^"]+)"')
XN_STAR_VIEWS = re.compile(r'class="views">\s*<span[^>]*></span>\s*([\d,]+)\s*video views')
EP_STAR_LIST = re.compile(r'href="(/pornstar/[^"]+)"')
EP_STAR_VIEWS = re.compile(r'Video views:<span>([\d,]+)</span>')
XV_TREND = re.compile(r'href="/video\.([a-zA-Z0-9]+)/[^"]+".*?<span class="views-count">([^<]+)</span>', re.DOTALL)
XN_TREND = re.compile(r'href="/(video-[a-zA-Z0-9]+)/[^"]+"')

# ---- Fetch helpers ----------------------------------------------------------
def fetch(url: str) -> str | None:
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f'  err {url}: {e}', flush=True)
        return None

def parse_ph(html: str | None, n: int) -> list[dict]:
    if not html: return []
    out = []
    for chunk in html.split(PH_CARD_SPLIT)[1:]:
        s = PH_SLUG.search(chunk); v = PH_VIEWS.search(chunk); r = PH_RANK.search(chunk)
        if not (s and v): continue
        na = PH_NAME.search(chunk)
        out.append({
            'slug': s.group(1),
            'name': (na.group(1).strip() if na else ''),
            'views_raw': v.group(1),
            'rank': int(r.group(1)) if r else None,
        })
        if len(out) >= n: break
    return out

def discover_slugs(url: str, rx: re.Pattern[str], n: int, retries: int = 4) -> list[str]:
    """Discover top-N slugs from a listing page. Retries on transient failure
    with exponential backoff — startup SSL handshake timeouts happen."""
    for attempt in range(retries):
        h = fetch(url)
        if h:
            seen: set[str] = set(); out: list[str] = []
            for m in rx.finditer(h):
                val = m.group(1)
                if val in seen: continue
                seen.add(val); out.append(val)
                if len(out) >= n: break
            if out:
                return out
        backoff = 2 ** attempt
        print(f'  discover retry {attempt + 1}/{retries} for {url} in {backoff}s', flush=True)
        time.sleep(backoff)
    return []

def fetch_profile_views(url: str, rx: re.Pattern[str]) -> int | None:
    h = fetch(url)
    if not h: return None
    m = rx.search(h)
    if not m: return None
    try:
        return int(m.group(1).replace(',', ''))
    except ValueError:
        return None

def fetch_xv_trend(n: int) -> list[dict]:
    h = fetch('https://www.xvideos.com/best/last-24')
    if not h: return []
    seen = set(); out = []
    for m in XV_TREND.finditer(h):
        vid = m.group(1)
        if vid in seen: continue
        seen.add(vid)
        out.append({'vid': vid, 'views_raw': m.group(2).strip(), 'rank': len(out) + 1})
        if len(out) >= n: break
    return out

def fetch_xn_trend(n: int) -> list[dict]:
    h = fetch('https://www.xnxx.com/best/last-year')
    if not h: return []
    seen = set(); out = []
    for m in XN_TREND.finditer(h):
        vid = m.group(1)
        if vid in seen: continue
        seen.add(vid)
        out.append({'vid': vid, 'rank': len(out) + 1})
        if len(out) >= n: break
    return out

# ---- Cycle ------------------------------------------------------------------
def one_sample(xv_stars: list[str], xn_stars: list[str], ep_stars: list[str]) -> dict:
    # Pornhub migrated /pornstars to a client-rendered SPA; server-rendered
    # HTML no longer contains cards. Skipped; kept as [] for schema stability.
    return {
        'ts': time.time(),
        'ph_listing': [],
        'xv_stars': [{'slug': s, 'views': fetch_profile_views(
            f'https://www.xvideos.com/pornstars/{s}', XV_STAR_VIEWS)} for s in xv_stars],
        'xn_stars': [{'path': p, 'views': fetch_profile_views(
            f'https://www.xnxx.com{p}', XN_STAR_VIEWS)} for p in xn_stars],
        'ep_stars': [{'path': p, 'views': fetch_profile_views(
            f'https://www.eporner.com{p}', EP_STAR_VIEWS)} for p in ep_stars],
        'xv_trend': fetch_xv_trend(TOP_N),
        'xn_trend': fetch_xn_trend(TOP_N),
    }

def main() -> int:
    print(f'[{time.strftime("%Y-%m-%d %H:%M:%S")}] collector start', flush=True)
    print(f'  interval={INTERVAL}s delay={DELAY}s top_n={TOP_N} duration={DURATION}s', flush=True)
    print(f'  out: {EVENTS}', flush=True)

    print('Discovering stars per site...', flush=True)
    xv_stars = discover_slugs('https://www.xvideos.com/pornstars', XV_STAR_LIST, TOP_N)
    xn_stars = discover_slugs('https://www.xnxx.com/pornstars', XN_STAR_LIST, TOP_N)
    # Eporner now serves an age-gate wall to unauthenticated clients; skipped.
    ep_stars: list[str] = []
    print(f'  xv: {len(xv_stars)}  xn: {len(xn_stars)}  ep: {len(ep_stars)} (skipped)', flush=True)
    if not (xv_stars and xn_stars):
        print('WARN: star list empty for at least one site', flush=True)

    t0 = time.time()
    cycle = 0
    last_redisco = time.time()
    REDISCO_SECS = 6 * 3600  # re-try any empty star lists every 6h
    while time.time() - t0 < DURATION:
        cycle_start = time.time()
        # Periodically retry any star list that failed at startup or shrank
        if time.time() - last_redisco > REDISCO_SECS:
            if not xv_stars:
                xv_stars = discover_slugs('https://www.xvideos.com/pornstars', XV_STAR_LIST, TOP_N)
                if xv_stars: print(f'  late-discovered {len(xv_stars)} xv_stars', flush=True)
            if not xn_stars:
                xn_stars = discover_slugs('https://www.xnxx.com/pornstars', XN_STAR_LIST, TOP_N)
                if xn_stars: print(f'  late-discovered {len(xn_stars)} xn_stars', flush=True)
            last_redisco = time.time()
        try:
            a = one_sample(xv_stars, xn_stars, ep_stars)
            time.sleep(DELAY)
            b = one_sample(xv_stars, xn_stars, ep_stars)
            rec = {'cycle': cycle, 'a': a, 'b': b}
            with open(EVENTS, 'a') as f:
                f.write(json.dumps(rec) + '\n')
            cycle += 1
            elapsed = int(time.time() - t0)
            print(f'[{time.strftime("%H:%M:%S")}] cycle {cycle} t+{elapsed}s ok', flush=True)
        except Exception as e:
            print(f'[{time.strftime("%H:%M:%S")}] cycle err: {e}', flush=True)
        # Sleep until next interval boundary
        sleep_for = INTERVAL - (time.time() - cycle_start)
        if sleep_for > 0:
            time.sleep(sleep_for)

    print(f'[{time.strftime("%H:%M:%S")}] collector done after {cycle} cycles', flush=True)
    return 0

if __name__ == '__main__':
    sys.exit(main())
