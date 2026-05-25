#!/usr/bin/env python3
"""Turn a list of vague timestamps into a clean worklist.

You write a spec the way you'd jot it down:

    0:02 to 0:04  background of trader, multiscreens
    0:19 to 0:21  orderbook zoomed
    1:39 to 1:40  NYC skyline
    # blank lines and #comments are ignored

prep.py detects every cut once, snaps each vague range to the nearest real
cuts, and renders one labelled montage per clip. It prints a table with a
ready-to-run extract.py command per clip — you (or an agent) read each montage,
correct the in/out to the exact frame, and run it.

    python3 prep.py "<video>" spec.txt --workdir /tmp/broll/qfex \
        --out-dir <project>/public/broll/qfex-quant-interview
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from _util import fmt_ts, parse_ts, probe, slug
from detect_cuts import detect
from montage import window_montage

_TS = r"\d+:\d+(?::\d+)?(?:\.\d+)?"
_RANGE = re.compile(rf"^\s*({_TS})\s*(?:to|-|–|→)\s*({_TS})\s+(.+?)\s*$")
_POINT = re.compile(rf"^\s*({_TS})\s+(.+?)\s*$")


def parse_spec(path: str) -> list[dict]:
    """Each line is either a range ('M:SS to M:SS desc') or a point ('M:SS desc').
    A point marks a frame inside the shot; prep brackets it with the cuts on
    either side to grab the whole insert."""
    entries, used = [], set()
    for raw in Path(path).read_text().splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        rng = _RANGE.match(raw)
        pt = _POINT.match(raw)
        if rng:
            a, b, desc = rng.groups()
            vin, vout = parse_ts(a), parse_ts(b)
        elif pt:
            a, desc = pt.groups()
            vin, vout = parse_ts(a), None
        else:
            print(f"  ! could not parse: {raw!r}")
            continue
        base = slug(desc)
        s, k = base, 2
        while s in used:  # guarantee a globally unique filename
            s, k = f"{base}-{k}", k + 1
        used.add(s)
        entries.append({"slug": s, "desc": desc.strip(), "vague_in": vin, "vague_out": vout})
    return entries


def nearest_cut(cuts: list[float], t: float, tol: float) -> float | None:
    near = [c for c in cuts if abs(c - t) <= tol]
    return min(near, key=lambda c: abs(c - t)) if near else None


def main() -> None:
    ap = argparse.ArgumentParser(description="Vague timestamps → snapped worklist + montages.")
    ap.add_argument("video")
    ap.add_argument("spec", help="text file of 'M:SS to M:SS description' lines")
    ap.add_argument("--workdir", required=True, help="scratch dir for cuts.json + montages")
    ap.add_argument("--out-dir", required=True, help="where extracted clips will land (for the printed commands)")
    ap.add_argument("--threshold", type=float, default=0.18)
    ap.add_argument("--tol", type=float, default=2.5, help="max snap distance to a cut (seconds)")
    ap.add_argument("--pad", type=float, default=1.0, help="montage lead-in before the cut")
    ap.add_argument("--tail", type=float, default=1.5, help="montage lead-out after the cut")
    ap.add_argument("--force", action="store_true", help="re-detect cuts even if cached")
    args = ap.parse_args()

    wd = Path(args.workdir)
    (wd / "montages").mkdir(parents=True, exist_ok=True)
    pr = probe(args.video)

    cuts_json = wd / "cuts.json"
    if cuts_json.exists() and not args.force:
        cuts = [c["t"] for c in json.loads(cuts_json.read_text())["cuts"]]
        print(f"cuts: {len(cuts)} (cached {cuts_json})")
    else:
        full = detect(args.video, args.threshold)
        cuts_json.write_text(json.dumps(
            {"video": args.video, "fps": pr.fps, "duration": pr.duration, "cuts": full}, indent=2))
        cuts = [c["t"] for c in full]
        print(f"cuts: {len(cuts)} → {cuts_json}")

    entries = parse_spec(args.spec)
    work = []
    print(f"\n{'#':>2}  {'slug':22} {'vague':>13}  {'snapped in→out':>22}  montage")
    for i, e in enumerate(entries, 1):
        ok = True
        if e["vague_out"] is None:  # point mark — bracket the shot containing the point
            t = e["vague_in"]
            prev = [c for c in cuts if c <= t + 0.05]
            nxt = [c for c in cuts if c > t + 0.05]
            cut_in = max(prev) if prev else 0.0
            cut_out = min(nxt) if nxt else pr.duration
            vague_disp = fmt_ts(t)
        else:                       # range — snap each end to a real cut
            ci = nearest_cut(cuts, e["vague_in"], args.tol)
            cut_in = ci if ci is not None else e["vague_in"]
            co = nearest_cut([c for c in cuts if c > cut_in + 1e-3], e["vague_out"], args.tol)
            cut_out = co if co is not None else max(e["vague_out"], cut_in + 1.0)
            ok = ci is not None and co is not None
            vague_disp = f"{fmt_ts(e['vague_in'])}→{fmt_ts(e['vague_out'])}"
        win_start = max(0.0, cut_in - args.pad)
        win_dur = min(pr.duration - win_start, (cut_out - cut_in) + args.pad + args.tail, 14.0)
        mont = wd / "montages" / f"{i:02d}_{e['slug']}.png"
        window_montage(args.video, win_start, win_dur, str(mont))
        flag = "" if ok else "  ⚠ no nearby cut — widen --tol or eyeball"
        print(f"{i:2d}  {e['slug']:22} {vague_disp:>15}  "
              f"{fmt_ts(cut_in)+'→'+fmt_ts(cut_out):>22}  {mont.name}{flag}")
        work.append({**e, "cut_in": round(cut_in, 3), "cut_out": round(cut_out, 3),
                     "win_start": round(win_start, 3), "win_dur": round(win_dur, 3),
                     "montage": str(mont)})

    (wd / "worklist.json").write_text(json.dumps(work, indent=2))
    print(f"\nworklist → {wd / 'worklist.json'}")
    print("\nNext: read each montage, pin exact in/out frame, then per clip:")
    for w in work:
        print(f'  python3 extract.py "{args.video}" --in {w["cut_in"]} --out {w["cut_out"]} '
              f'--name {w["slug"]} --dir "{args.out_dir}"')


if __name__ == "__main__":
    main()
