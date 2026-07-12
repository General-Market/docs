#!/usr/bin/env python3
"""Melody-onset analysis for syncing Remotion motion to a music track.

Reports, in COMPOSITION frames, the audible melodic hits (the notes you tap
to), energy drops/lulls, and the bright/dark pitch contour — so word
entrances and payoffs can be placed on real notes, not just a BPM grid.
librosa's loader crashes on this Mac (x86/arm samplerate mismatch); we decode
with ffmpeg and run the STFT in numpy. Method: .claude/rules/music-sync-method.md.

Usage:
  python3 scripts/melody-onsets.py TRACK.mp3 --offset 88.0 --fps 30 --frames 1600
    --offset  audio seconds playing at composition frame 0 (== audioStartFrom/fps)
    --fps     composition fps
    --frames  composition frames to analyze — set PAST your cut end (the music
              usually keeps going; you want to see the outro/resolution)
    --grid    optional "phase,period" in frames to check a beat grid vs real hits
"""
import argparse, io, subprocess, wave
import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("track")
    ap.add_argument("--offset", type=float, default=0.0)
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--frames", type=int, default=900)
    ap.add_argument("--sr", type=int, default=22050)
    ap.add_argument("--grid", type=str, default=None, help='"phase,period" in frames')
    a = ap.parse_args()

    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", str(a.offset), "-t", str(a.frames / a.fps + 1),
         "-i", a.track, "-ac", "1", "-ar", str(a.sr), "-f", "wav", "-"],
        capture_output=True).stdout
    w = wave.open(io.BytesIO(raw))
    y = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768.0

    hop = int(a.sr / a.fps); win = hop * 2
    n = min(a.frames, (len(y) - win) // hop)
    fr = np.stack([y[i * hop:i * hop + win] for i in range(n)])
    spec = np.abs(np.fft.rfft(fr * np.hanning(win), axis=1))
    freqs = np.fft.rfftfreq(win, 1 / a.sr)
    rms = np.sqrt((fr ** 2).mean(1))
    cent = (spec * freqs).sum(1) / (spec.sum(1) + 1e-9)
    d = np.diff(spec, axis=0)
    mb = (freqs >= 200) & (freqs <= 4000)           # melodic band = note attacks
    mflux = np.zeros(n); mflux[1:] = np.maximum(d[:, mb], 0).sum(1)
    sm = np.convolve(rms, np.ones(9) / 9, mode="same")

    def peaks(sig, minsep, thr_pct):
        thr = np.percentile(sig[sig > 0], thr_pct); out = []; i = 1
        while i < len(sig) - 1:
            if sig[i] == max(sig[max(0, i - 4):i + 5]) and sig[i] > thr:
                out.append((i, sig[i])); i += minsep
            else:
                i += 1
        return out

    ons = peaks(mflux, 6, 60); mx = max(s for _, s in ons)
    print(f"# {a.track}  audio[{a.offset}s..]  comp f0..{n} @ {a.fps}fps")
    print("# MELODIC ONSETS (the notes you tap to) — place payoff words HERE, strength 0..1:")
    line = ""
    for f, s in ons:
        if s / mx > 0.40:
            line += f"f{f}({s/mx:.2f}) "
            if len(line) > 108: print("  " + line); line = ""
    if line: print("  " + line)
    biggest = sorted(ons, key=lambda o: -o[1])[:6]
    print("  BIGGEST hits (never leave these in a scene gap): " +
          " ".join(f"f{f}({s/mx:.2f})" for f, s in biggest))

    thr = np.percentile(sm, 28)
    print(f"\n# DROPS (energy surges) and LULLS (quiet breakdowns):")
    wd = 20; rise = np.zeros(n)
    for i in range(wd, n): rise[i] = sm[i] - sm[i - wd]
    cand = []; i = wd
    while i < n:
        if rise[i] == max(rise[max(0, i - 12):i + 12]) and rise[i] > np.percentile(rise[rise > 0], 75):
            cand.append(i); i += 25
        else: i += 1
    print("  drops: " + " ".join(f"f{c}" for c in cand))
    i = 0
    while i < n:
        if sm[i] < thr:
            j = i
            while j < n and sm[j] < thr: j += 1
            if j - i >= 15: print(f"  LULL f{i}..{j} ({i/a.fps:.1f}s..{j/a.fps:.1f}s)")
            i = j
        else: i += 1

    med = np.median(cent)
    print(f"\n# PITCH contour (centroid median={med:.0f}Hz; melody lives in the bright/HIGH windows):")
    st = cent > med * 1.15; i = 0
    while i < n:
        s = st[i]; j = i
        while j < n and st[j] == s: j += 1
        if j - i >= 20 and s:
            print(f"  HIGH f{i}..{j} ({i/a.fps:.1f}s..{j/a.fps:.1f}s) ~{cent[i:j].mean():.0f}Hz")
        i = j

    if a.grid:
        ph, per = (float(x) for x in a.grid.split(","))
        offs = []
        m = 0
        while ph + m * per < n:
            g = ph + m * per
            near = [o for o in ons if abs(o[0] - g) <= 6 and o[1] / mx > 0.4]
            if near: offs.append(min(near, key=lambda o: abs(o[0] - g))[0] - g)
            m += 1
        if offs:
            print(f"\n# GRID CHECK: {len(offs)} grid points have a strong onset within 6f; "
                  f"mean phase offset {np.mean(offs):+.1f}f (real hit vs grid). "
                  f"Near 0 = grid sits on the hits; large = the grid is NOT the melody.")


if __name__ == "__main__":
    main()
