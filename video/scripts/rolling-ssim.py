#!/usr/bin/env python3
"""Rolling-window SSIM triage.

Reads an ffmpeg ssim per-frame log (`ssim=stats_file=...`, one line per frame:
`n:123 Y:0.98 U:0.99 V:0.99 All:0.973 (15.7)`) and ranks the worst
rolling-window means. The worst sustained valleys — not isolated bad
keyframes — are where the next round's points live.

Usage:
  rolling-ssim.py <ssim_log.txt> [--fps 25] [--window-sec 2] [--top 12]

To produce the log without a verify run (from a saved attempt render):
  ffmpeg -i <ref.mp4> -i <attempt.mp4> -lavfi "ssim=stats_file=frame_ssim.txt" -f null -
"""
import argparse
import re
import sys

def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("log")
    p.add_argument("--fps", type=float, default=25.0)
    p.add_argument("--window-sec", type=float, default=2.0)
    p.add_argument("--top", type=int, default=12)
    a = p.parse_args()

    pat = re.compile(r"n:(\d+).*All:([0-9.]+)")
    ssim: list[float] = []
    with open(a.log) as f:
        for line in f:
            m = pat.search(line)
            if m:
                ssim.append(float(m.group(2)))
    if not ssim:
        sys.exit(f"no per-frame SSIM lines parsed from {a.log}")

    w = max(1, int(round(a.window_sec * a.fps)))
    # prefix sums -> rolling mean at each window start
    pref = [0.0]
    for v in ssim:
        pref.append(pref[-1] + v)
    windows = [
        (i, (pref[i + w] - pref[i]) / w)
        for i in range(0, len(ssim) - w + 1)
    ]

    # greedy non-overlapping worst windows
    windows.sort(key=lambda t: t[1])
    taken: list[tuple[int, float]] = []
    for start, mean in windows:
        if all(abs(start - s) >= w for s, _ in taken):
            taken.append((start, mean))
            if len(taken) >= a.top:
                break

    total = sum(ssim) / len(ssim)
    print(f"frames={len(ssim)} fps={a.fps:g} window={w}f ({a.window_sec:g}s) "
          f"global_mean={total:.4f}")
    print(f"{'rank':>4} {'frames':>15} {'t(s)':>13} {'mean':>7}")
    for rank, (start, mean) in enumerate(sorted(taken, key=lambda t: t[1]), 1):
        t0, t1 = start / a.fps, (start + w) / a.fps
        print(f"{rank:>4} {start:>7}-{start + w:<7} {t0:>6.1f}-{t1:<6.1f} {mean:>7.4f}")

if __name__ == "__main__":
    main()
