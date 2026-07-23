#!/usr/bin/env python3
"""
Reconstruct what the FINAL cut actually says, in playback order, by mapping
each cuts.json segment back to the words it contains. Also flag:
  - long internal silences (gap > GAP_FLAG between consecutive words in a kept segment)
  - very short segments that may be orphan fragments
  - low-value filler lines (heuristic: short, hedging, or repeated connective)

Writes /tmp/cut-transcript.txt and prints a summary.
"""
import json
import re
from pathlib import Path

ALIGNED = "/tmp/anticheat-aligned-merged.json"
CUTS    = "/Users/maxguillabert/Downloads/index/video/src/compositions/anticheat-edit/cuts.json"
OUT     = Path("/tmp/cut-transcript.txt")

GAP_FLAG = 1.2          # seconds of silence inside a kept segment worth flagging
SHORT_SEG = 1.2         # segments shorter than this in source seconds
RATE = 1.2


def collect_words(aligned):
    out = []
    for s in aligned["segments"]:
        for w in s.get("words", []):
            if "start" in w and "end" in w and "word" in w:
                out.append({"word": w["word"], "start": float(w["start"]), "end": float(w["end"])})
    return out


def words_in(words, a, b):
    return [w for w in words if a - 0.05 <= 0.5 * (w["start"] + w["end"]) <= b + 0.05]


def fmt(t):
    m, s = divmod(t, 60)
    return f"{int(m):02d}:{s:05.2f}"


def main():
    aligned = json.load(open(ALIGNED))
    cuts = json.load(open(CUTS))
    words = collect_words(aligned)
    segs = cuts["segments"]

    lines = []
    playback = 0.0          # cumulative final.mp4 time (after 1.2x)
    flags = {"long_gap": [], "short_seg": [], "filler": []}

    FILLER_RX = re.compile(
        r"^\s*(so|and|but|um|uh|okay|ok|let'?s see|you know|i mean|like)[\s.,]*$",
        re.I,
    )

    for idx, seg in enumerate(segs):
        s, e = float(seg["start"]), float(seg["end"])
        dur_src = e - s
        dur_play = dur_src / RATE
        ws = words_in(words, s, e)
        text = " ".join(w["word"] for w in ws).strip()

        # Internal silence detection.
        max_gap = 0.0
        gap_at = None
        for p, q in zip(ws, ws[1:]):
            g = q["start"] - p["end"]
            if g > max_gap:
                max_gap, gap_at = g, p["end"]
        gap_note = ""
        if max_gap > GAP_FLAG:
            gap_note = f"  ⟂ {max_gap:.1f}s silence @ src {fmt(gap_at)}"
            flags["long_gap"].append((idx, max_gap, gap_at, text[:50]))

        short_note = ""
        if dur_src < SHORT_SEG:
            short_note = "  ◦ short"
            flags["short_seg"].append((idx, dur_src, text[:50]))

        if FILLER_RX.match(text) or (len(ws) <= 2 and dur_src < 1.5):
            flags["filler"].append((idx, text[:50]))

        lines.append(
            f"[{idx:3d}] play {fmt(playback)}  (src {fmt(s)}–{fmt(e)}, {dur_play:.1f}s)"
            f"{gap_note}{short_note}\n      {text}"
        )
        playback += dur_play

    OUT.write_text("\n".join(lines))

    print(f"final length: {fmt(playback)}  ({len(segs)} segments)")
    print(f"-> {OUT}\n")

    print(f"⟂ LONG INTERNAL SILENCES (> {GAP_FLAG}s) — {len(flags['long_gap'])}:")
    for idx, g, at, txt in sorted(flags["long_gap"], key=lambda x: -x[1]):
        print(f"   seg {idx:3d}  {g:4.1f}s @ src {fmt(at)}   \"{txt}…\"")

    print(f"\n◦ SHORT SEGMENTS (< {SHORT_SEG}s) — {len(flags['short_seg'])}:")
    for idx, d, txt in flags["short_seg"]:
        print(f"   seg {idx:3d}  {d:.2f}s   \"{txt}\"")

    print(f"\n∅ POSSIBLE FILLER — {len(flags['filler'])}:")
    for idx, txt in flags["filler"]:
        print(f"   seg {idx:3d}  \"{txt}\"")


if __name__ == "__main__":
    main()
