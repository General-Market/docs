#!/usr/bin/env python3
"""Experiment harness — list, run, summarize tube-data probes.

Every experiment writes to experiments/{id}/ with:
  - raw.jsonl / raw.csv (data collected)
  - result.json         (structured findings)
  - summary.txt         (human-readable one-pager)

Analysis experiments read prior collector data and are instant.
Short/long probes collect fresh data and are designed for nohup.

Run:
  python3 experiments.py --list
  python3 experiments.py --run A1
  python3 experiments.py --run-all-analysis
  python3 experiments.py --run-all-short
  python3 experiments.py --summary
"""
from __future__ import annotations
import argparse, json, re, sys, time, urllib.request, os
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict, Counter

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

ROOT = Path(__file__).parent
OUT_ROOT = ROOT  # experiments sit next to the script
COLLECTOR_JSONL = ROOT.parent / 'collect-48h' / 'run-20260418-0939' / 'events.jsonl'

# ============================================================================
# Shared helpers
# ============================================================================

def fetch(url: str, timeout: int = 15) -> str | None:
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f'  [err] {url}: {e}', flush=True)
        return None

def ensure_dir(exp_id: str) -> Path:
    d = OUT_ROOT / exp_id
    d.mkdir(parents=True, exist_ok=True)
    return d

def write_result(exp_id: str, result: dict, summary_lines: list[str]) -> None:
    d = ensure_dir(exp_id)
    (d / 'result.json').write_text(json.dumps(result, indent=2, default=str))
    (d / 'summary.txt').write_text('\n'.join(summary_lines) + '\n')

def load_collector_rows() -> list[dict]:
    if not COLLECTOR_JSONL.exists():
        raise FileNotFoundError(f'collector data missing: {COLLECTOR_JSONL}')
    return [json.loads(l) for l in open(COLLECTOR_JSONL)]

def parse_scaled(raw: str) -> int | None:
    s = raw.strip()
    mult = 1
    if s.endswith('B'): mult, s = 1_000_000_000, s[:-1]
    elif s.endswith('M'): mult, s = 1_000_000, s[:-1]
    elif s.endswith('K') or s.endswith('k'): mult, s = 1_000, s[:-1]
    s = s.replace(',', '')
    try: return int(float(s) * mult)
    except ValueError: return None

# ============================================================================
# ANALYSIS EXPERIMENTS (instant, read existing collector data)
# ============================================================================

def exp_A1_tick_histogram():
    """Per-star tick-interval stats across 48h collector data."""
    rows = load_collector_rows()
    lines = ['A1 — Per-star tick interval histogram', '=' * 60, '']
    result: dict = {'xv_stars': {}, 'xn_stars': {}}

    for field, label, key in [('xv_stars', 'Xvideos', 'slug'), ('xn_stars', 'Xnxx', 'path')]:
        series: dict[str, list[tuple[int, int]]] = {}
        for i, r in enumerate(rows):
            for s in r['a'][field]:
                if s.get('views') is None: continue
                k = s[key]
                series.setdefault(k, []).append((i, s['views']))
        intervals_by_key = {}
        for k, obs in series.items():
            ivs = []
            for i in range(1, len(obs)):
                if obs[i][1] != obs[i-1][1]:
                    ivs.append((obs[i][0] - obs[i-1][0]) * 5)  # minutes
            intervals_by_key[k] = ivs

        def q(xs, p):
            if not xs: return None
            xs = sorted(xs)
            return xs[int((len(xs)-1)*p)]

        lines.append(f'--- {label} ---')
        lines.append(f'{"slug":<42} {"samples":>8} {"ticks":>6} {"min":>5} {"p50":>5} {"p90":>5} {"max":>5}')
        for k, ivs in sorted(intervals_by_key.items()):
            n_samples = len(series[k])
            n_ticks = len(ivs)
            if ivs:
                lines.append(f'{k:<42} {n_samples:>8} {n_ticks:>6} {min(ivs):>5} {q(ivs,0.5):>5} {q(ivs,0.9):>5} {max(ivs):>5}')
            else:
                lines.append(f'{k:<42} {n_samples:>8} {0:>6}   flat (no ticks in {len(rows)*5}min window)')
            result[field][k] = {'samples': n_samples, 'ticks': n_ticks,
                                'min_min': min(ivs) if ivs else None,
                                'p50_min': q(ivs,0.5),
                                'p90_min': q(ivs,0.9),
                                'max_min': max(ivs) if ivs else None}
        lines.append('')

    write_result('A1', result, lines)
    print('\n'.join(lines))

def exp_A2_rollover_timing():
    """Detect top-10 composition changes (rollovers) in the 48h data."""
    rows = load_collector_rows()
    lines = ['A2 — Rollover timing in /best/last-24', '=' * 60, '']

    prev_top10: set[str] = set()
    rollovers: list[dict] = []
    for i, r in enumerate(rows):
        cur = set(v['vid'] for v in r['a']['xv_trend'][:10])
        if prev_top10 and cur != prev_top10:
            overlap = len(cur & prev_top10)
            if overlap < len(cur) * 0.5:  # major reshuffle
                ts = r['a']['ts']
                dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                rollovers.append({
                    'cycle': i,
                    'utc': dt.isoformat(),
                    'hour': dt.hour, 'minute': dt.minute,
                    'overlap_with_prev': overlap,
                    'new_entries': sorted(cur - prev_top10)[:5],
                })
        prev_top10 = cur

    lines.append(f'cycles scanned: {len(rows)}')
    lines.append(f'rollovers detected: {len(rollovers)}')
    for ro in rollovers:
        lines.append(f'  cycle {ro["cycle"]:>4}  {ro["utc"]}  '
                     f'UTC hour={ro["hour"]:02d}:{ro["minute"]:02d}  '
                     f'overlap {ro["overlap_with_prev"]}/10  new[:5]={ro["new_entries"]}')
    if len(rollovers) >= 2:
        gaps = []
        for i in range(1, len(rollovers)):
            t1 = datetime.fromisoformat(rollovers[i-1]['utc'].replace('Z','+00:00'))
            t2 = datetime.fromisoformat(rollovers[i]['utc'].replace('Z','+00:00'))
            gaps.append((t2 - t1).total_seconds() / 3600)
        lines.append(f'gaps between rollovers (hours): {[f"{g:.1f}" for g in gaps]}')

    write_result('A2', {'rollovers': rollovers}, lines)
    print('\n'.join(lines))

def exp_A3_daily_pattern():
    """Hour-of-day distribution of star tick events."""
    rows = load_collector_rows()
    lines = ['A3 — Daily pattern of star updates', '=' * 60, '']
    by_hour_xv: Counter[int] = Counter()
    by_hour_xn: Counter[int] = Counter()

    def count(field, target):
        prev: dict[str, int] = {}
        for r in rows:
            ts = r['a']['ts']
            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
            for s in r['a'][field]:
                k = s.get('slug') or s.get('path')
                v = s.get('views')
                if v is None: continue
                if k in prev and prev[k] != v:
                    target[dt.hour] += 1
                prev[k] = v

    count('xv_stars', by_hour_xv)
    count('xn_stars', by_hour_xn)

    lines.append(f'{"hour_utc":>8} {"xv ticks":>10} {"xn ticks":>10}')
    for h in range(24):
        lines.append(f'{h:>8} {by_hour_xv[h]:>10} {by_hour_xn[h]:>10}')
    total_xv = sum(by_hour_xv.values()); total_xn = sum(by_hour_xn.values())
    lines.append(f'total ticks: xv={total_xv} xn={total_xn}')
    if total_xv:
        peak_xv = max(by_hour_xv, key=by_hour_xv.get)
        lines.append(f'peak hour xv: {peak_xv}:00 UTC ({by_hour_xv[peak_xv]} ticks)')
    if total_xn:
        peak_xn = max(by_hour_xn, key=by_hour_xn.get)
        lines.append(f'peak hour xn: {peak_xn}:00 UTC ({by_hour_xn[peak_xn]} ticks)')

    write_result('A3', {'xv_by_hour': dict(by_hour_xv), 'xn_by_hour': dict(by_hour_xn)}, lines)
    print('\n'.join(lines))

def exp_A4_bot_confirmation():
    """Confirm lockstep behaviour of the four suspected xnxx bot accounts."""
    rows = load_collector_rows()
    bots = ['/pornstar/candice-price-model', '/pornstar/cedric-extra-model',
            '/pornstar/johnny-liberty-model', '/pornstar/violet-haze-extra-model']
    lines = ['A4 — XNXX bot-cluster confirmation', '=' * 60, '']
    series: dict[str, list[tuple[int, int]]] = {b: [] for b in bots}
    for i, r in enumerate(rows):
        for s in r['a']['xn_stars']:
            if s['path'] in series and s.get('views') is not None:
                series[s['path']].append((i, s['views']))

    # Compute tick events per bot
    tick_events: dict[str, list[tuple[int, int]]] = {}  # path -> [(cycle, delta)]
    for b, obs in series.items():
        te = []
        for i in range(1, len(obs)):
            if obs[i][1] != obs[i-1][1]:
                te.append((obs[i][0], obs[i][1] - obs[i-1][1]))
        tick_events[b] = te

    lines.append('Per-bot tick events (cycle, delta):')
    for b in bots:
        lines.append(f'  {b}: {tick_events[b]}')

    # Check lockstep: all bots tick at the same cycle with the same delta?
    all_cycles = set()
    for te in tick_events.values():
        all_cycles |= set(c for c, _ in te)
    lockstep_cycles = []
    for c in sorted(all_cycles):
        deltas = [next((d for cc, d in tick_events[b] if cc == c), None) for b in bots]
        if all(d is not None and d == deltas[0] for d in deltas):
            lockstep_cycles.append((c, deltas[0]))
    lines.append(f'lockstep cycles (all 4 bots tick same cycle, same delta): {lockstep_cycles}')
    lines.append(f'verdict: {"CONFIRMED bot cluster" if lockstep_cycles else "no lockstep in this window"}')

    write_result('A4', {'tick_events': {k: v for k, v in tick_events.items()},
                         'lockstep_cycles': lockstep_cycles}, lines)
    print('\n'.join(lines))

def exp_A5_cdn_flip_rate():
    """Fraction of double-samples with A != B per signal."""
    rows = load_collector_rows()
    lines = ['A5 — CDN flip rate per signal', '=' * 60, '']

    counters: dict[str, list[int]] = {'xv_stars': [0,0], 'xn_stars': [0,0],
                                       'xv_trend': [0,0], 'xn_trend': [0,0]}
    for r in rows:
        for sa, sb in zip(r['a']['xv_stars'], r['b']['xv_stars']):
            counters['xv_stars'][0] += 1
            if sa.get('views') != sb.get('views'): counters['xv_stars'][1] += 1
        for sa, sb in zip(r['a']['xn_stars'], r['b']['xn_stars']):
            counters['xn_stars'][0] += 1
            if sa.get('views') != sb.get('views'): counters['xn_stars'][1] += 1
        a_map = {v['vid']: v.get('views_raw') for v in r['a']['xv_trend']}
        b_map = {v['vid']: v.get('views_raw') for v in r['b']['xv_trend']}
        for vid in set(a_map) & set(b_map):
            counters['xv_trend'][0] += 1
            if a_map[vid] != b_map[vid]: counters['xv_trend'][1] += 1
        a_list = [v['vid'] for v in r['a']['xn_trend']]
        b_list = [v['vid'] for v in r['b']['xn_trend']]
        counters['xn_trend'][0] += 1
        if a_list != b_list: counters['xn_trend'][1] += 1

    lines.append(f'{"signal":<12} {"samples":>10} {"flips":>8} {"rate":>8}')
    for k, (n, f) in counters.items():
        rate = f / n if n else 0
        lines.append(f'{k:<12} {n:>10} {f:>8} {rate*100:>7.2f}%')

    write_result('A5', counters, lines)
    print('\n'.join(lines))

# ============================================================================
# SHORT PROBES
# ============================================================================

# ---- S1: Video page raw view count cadence ----
XV_LIST_URL = 'https://www.xvideos.com/best/last-24'
XV_VID_VIEWS_RE = re.compile(r'<strong[^>]*>([\d,]+)</strong>')

def exp_S1_video_cadence(duration_min: int = 60, interval_sec: int = 120,
                         double_delay_sec: int = 5, top_n: int = 5):
    """Poll top-N trending video pages every interval for duration. Double-sampled."""
    exp_id = 'S1'
    d = ensure_dir(exp_id)
    raw_path = d / 'raw.jsonl'
    log_path = d / 'run.log'
    log = open(log_path, 'a')
    def p(msg):
        ts = datetime.utcnow().isoformat()
        line = f'[{ts}] {msg}'
        print(line, flush=True); log.write(line + '\n'); log.flush()

    p(f'S1 start: {top_n} videos, {duration_min}min, {interval_sec}s poll, {double_delay_sec}s double-delay')

    # Discover top-N from listing
    html = fetch(XV_LIST_URL)
    urls = []
    if html:
        for m in re.finditer(r'href="(/video\.[a-zA-Z0-9]+/[^"]+)"', html):
            u = 'https://www.xvideos.com' + m.group(1)
            if u not in urls: urls.append(u)
            if len(urls) >= top_n: break
    if not urls:
        p('ERR: no videos discovered')
        return
    p(f'tracking: {[u.split("/")[-2][:16] for u in urls]}')

    def one_sample():
        out = []
        for u in urls:
            h = fetch(u)
            v = None
            if h:
                # Grab the first raw-int <strong> that's near the word "views"
                # The page markup puts the view count as: <strong>N,NNN,NNN</strong> ... views
                # Use a stricter regex anchored near "views".
                m = re.search(r'<strong[^>]*>([\d,]+)</strong>[^<]*(?:<[^>]+>[^<]*)*?views?', h, re.I)
                if not m:
                    m = re.search(r'<strong[^>]*>([\d,]+)</strong>', h)
                if m:
                    try: v = int(m.group(1).replace(',', ''))
                    except ValueError: pass
            out.append({'url': u, 'views': v})
        return {'ts': time.time(), 'items': out}

    t0 = time.time()
    cycle = 0
    f = open(raw_path, 'a')
    while time.time() - t0 < duration_min * 60:
        cycle_start = time.time()
        a = one_sample()
        time.sleep(double_delay_sec)
        b = one_sample()
        f.write(json.dumps({'cycle': cycle, 'a': a, 'b': b}) + '\n'); f.flush()
        cycle += 1
        p(f'cycle {cycle} t+{int(time.time()-t0)}s ok')
        sleep_for = interval_sec - (time.time() - cycle_start)
        if sleep_for > 0: time.sleep(sleep_for)
    f.close()

    # Immediately analyze
    rows = [json.loads(l) for l in open(raw_path)]
    result = {}
    lines = ['S1 — Video page raw view cadence', '=' * 60, '']
    for idx, u in enumerate(urls):
        series = [(r['cycle'], r['a']['items'][idx].get('views')) for r in rows
                  if r['a']['items'][idx].get('views') is not None]
        if not series: continue
        transitions = [series[i][1] - series[i-1][1] for i in range(1, len(series))
                       if series[i][1] != series[i-1][1]]
        # Count CDN flips within cycle
        flips = sum(1 for r in rows
                    if r['a']['items'][idx].get('views') != r['b']['items'][idx].get('views'))
        slug = u.split('/')[-2][:20]
        first, last = series[0][1], series[-1][1]
        lines.append(f'{slug:<22} samples={len(series):>3} '
                     f'ticks={len(transitions):>3} '
                     f'Δ={last-first:>9,} '
                     f'flips={flips}/{len(rows)}')
        result[slug] = {'url': u, 'samples': len(series), 'ticks': len(transitions),
                        'total_delta': last - first, 'cdn_flips': flips,
                        'first': first, 'last': last}

    write_result(exp_id, result, lines)
    log.close()

# ---- S5: Pornhub / Eporner recovery check ----
def exp_S5_recovery_check():
    lines = ['S5 — Pornhub / Eporner recovery check', '=' * 60, '']
    targets = [
        ('pornhub top', 'https://www.pornhub.com/pornstars?o=t', 'performerCard', 'SSR'),
        ('pornhub alpha', 'https://www.pornhub.com/pornstars?o=a', 'performerCard', 'SSR'),
        ('pornhub trend video', 'https://www.pornhub.com/video?o=tr', 'pcVideoListItem', 'SSR'),
        ('pornhub fr', 'https://fr.pornhub.com/pornstars', 'performerCard', 'SSR'),
        ('eporner stars', 'https://www.eporner.com/pornstars/', '/pornstar/', 'SSR'),
        ('eporner top-videos', 'https://www.eporner.com/top-rated/', '/video-', 'SSR'),
        ('xvideos trend', 'https://www.xvideos.com/best/last-24', 'thumb-block', 'SSR'),
        ('xnxx trend', 'https://www.xnxx.com/best/last-year', 'thumb-block', 'SSR'),
    ]
    result = {}
    lines.append(f'{"target":<28} {"bytes":>8} {"hits":>6} {"verdict":>18}')
    for name, url, marker, expected in targets:
        h = fetch(url)
        if h is None:
            verdict = 'FETCH FAILED'; bytes_ = 0; hits = 0
        else:
            bytes_ = len(h); hits = h.count(marker)
            if hits > 0: verdict = 'SSR OK'
            elif 'Just a moment' in h[:2000] or 'challenge' in h[:2000]: verdict = 'CF CHALLENGE'
            elif 'Age Verif' in h[:2000] or 'age_ver' in h[:2000]: verdict = 'AGE GATE'
            elif bytes_ < 60_000: verdict = 'JS SHELL / EMPTY'
            else: verdict = 'UNKNOWN (no marker)'
        lines.append(f'{name:<28} {bytes_:>8} {hits:>6} {verdict:>18}')
        result[name] = {'url': url, 'bytes': bytes_, 'hits': hits, 'verdict': verdict}

    write_result('S5', result, lines)
    print('\n'.join(lines))

# ============================================================================
# ENTRY
# ============================================================================

EXPERIMENTS = {
    'A1': ('analysis',   exp_A1_tick_histogram,     'Per-star tick-interval histogram'),
    'A2': ('analysis',   exp_A2_rollover_timing,    'Rollover timing in /best/last-24'),
    'A3': ('analysis',   exp_A3_daily_pattern,      'Daily pattern of star updates'),
    'A4': ('analysis',   exp_A4_bot_confirmation,   'XNXX bot-cluster confirmation'),
    'A5': ('analysis',   exp_A5_cdn_flip_rate,      'CDN flip rate per signal'),
    'S1': ('short',      exp_S1_video_cadence,      'Video page raw view cadence (60 min)'),
    'S5': ('short',      exp_S5_recovery_check,     'Pornhub / Eporner recovery check'),
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--run', type=str, help='run a specific experiment by id (A1, S1, ...)')
    ap.add_argument('--run-all-analysis', action='store_true', help='run all A* experiments')
    ap.add_argument('--run-all-short', action='store_true', help='run all S* experiments (in series)')
    ap.add_argument('--summary', action='store_true', help='aggregate finished results')
    args = ap.parse_args()

    if args.list:
        print(f'{"id":<4} {"type":<10} {"desc"}')
        for eid, (etype, fn, desc) in EXPERIMENTS.items():
            status = '✓' if (OUT_ROOT / eid / 'result.json').exists() else ' '
            print(f'{eid:<4} {etype:<10} [{status}] {desc}')
        return 0

    if args.run:
        if args.run not in EXPERIMENTS:
            print(f'unknown experiment: {args.run}'); return 1
        _, fn, _ = EXPERIMENTS[args.run]
        print(f'=== Running {args.run} ===')
        fn()
        return 0

    if args.run_all_analysis:
        for eid, (etype, fn, _) in EXPERIMENTS.items():
            if etype == 'analysis':
                print(f'\n### {eid}')
                try: fn()
                except Exception as e: print(f'  FAILED: {e}')
        return 0

    if args.run_all_short:
        for eid, (etype, fn, _) in EXPERIMENTS.items():
            if etype == 'short':
                print(f'\n### {eid}')
                try: fn()
                except Exception as e: print(f'  FAILED: {e}')
        return 0

    if args.summary:
        print('=== Experiment status summary ===')
        for eid, (etype, fn, desc) in EXPERIMENTS.items():
            summary = OUT_ROOT / eid / 'summary.txt'
            if summary.exists():
                print(f'\n--- {eid}: {desc} ---')
                print(summary.read_text())
            else:
                print(f'\n--- {eid}: {desc} ---\n(not yet run)')
        return 0

    ap.print_help()
    return 1

if __name__ == '__main__':
    sys.exit(main())
