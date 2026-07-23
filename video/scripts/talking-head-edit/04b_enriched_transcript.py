#!/usr/bin/env python3
"""
Step 4b input builder. Writes an enriched word-level transcript of the current
cut for editorial disfluency review (by subagents — see PROTOCOL.md §4b).

Each segment block lists its words in play order with:
  [GAP x.xs]                 inter-word pause (flag mid-sentence ones ≥ 0.45s)
  >>> SLIDE CARD NN: "X" <<<  a title slide (flag spoken re-reads of X)

Reads the aligned transcript, the current cuts.json, and the title-card config.
Writes /tmp/enriched-cut.txt (+ a copy in ~/Downloads for eyeballing).
"""
import json
import shutil
from pathlib import Path

ALIGNED = "/tmp/anticheat-aligned-merged.json"
CUTS = "/Users/maxguillabert/Downloads/index/video/src/compositions/anticheat-edit/cuts.json"
CARDS = "/tmp/title-cards/cards.json"
RATE = 1.2
GAP_FLAG = 0.45

aligned = json.load(open(ALIGNED))
segs = json.load(open(CUTS))["segments"]
cards = json.load(open(CARDS))["cards"]

allw = []
for s in aligned["segments"]:
    for w in s.get("words", []):
        if "start" in w and "end" in w and "word" in w:
            allw.append({"w": w["word"], "s": float(w["start"]), "e": float(w["end"])})
allw.sort(key=lambda x: x["s"])

def fmt(t):
    m, s = divmod(t, 60); return f"{int(m):02d}:{s:05.2f}"

card_before = {}
for c in sorted(cards, key=lambda x: x["trigger"]):
    for i, s in enumerate(segs):
        if s["start"] >= c["trigger"]:
            card_before.setdefault(i, []).append(c); break

out = ["ANTICHEAT — ENRICHED WORD-LEVEL CUT (play order)",
       'Markers: [GAP x.xs] inter-word pause; >>> SLIDE CARD <<< title slide.',
       f"Flag mid-sentence gaps >= {GAP_FLAG}s. =" + "=" * 60, ""]
play = 0.0
for i, seg in enumerate(segs):
    for c in card_before.get(i, []):
        out.append(f'>>> SLIDE CARD {c["num"]:02d}: "{c["name"]}" <<<')
        play += 1.5
    a, b = seg["start"], seg["end"]
    sw = [w for w in allw if a - 0.05 <= 0.5 * (w["s"] + w["e"]) <= b + 0.05]
    if not sw:
        continue
    parts = []
    for k, w in enumerate(sw):
        if k > 0:
            gap = w["s"] - sw[k - 1]["e"]
            if gap > GAP_FLAG:
                parts.append(f"[GAP {gap:.2f}s]")
        parts.append(w["w"])
    out.append(f"SEG {i:3d} | play {fmt(play)} | src {fmt(a)}-{fmt(b)}")
    out.append("   " + " ".join(parts))
    out.append("")
    play += (b - a) / RATE

p = Path("/tmp/enriched-cut.txt")
p.write_text("\n".join(out))
shutil.copy(p, Path.home() / "Downloads" / "AntiCheat-enriched-cut.txt")
print(f"wrote {p} (+ ~/Downloads copy), {len(segs)} segments")
