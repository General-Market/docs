#!/usr/bin/env python3
"""Dump the full transcript as readable, timestamped script."""
import json
from pathlib import Path

OUT = Path("/tmp/full-script.txt")
ALIGNED = "/tmp/anticheat-aligned-merged.json"

data = json.load(open(ALIGNED))
segs = data["segments"]

lines = []
lines.append(f"# AntiCheat — full transcript (raw, untrimmed)")
lines.append(f"# {len(segs)} WhisperX segments, two recording sessions merged")
lines.append(f"# Session order: 16:29 (0–82.99 s, intro) | 15:58 (82.99 s+, main take)")
lines.append("")

def fmt(t):
    m, s = divmod(t, 60)
    return f"{int(m):02d}:{s:05.2f}"

for i, s in enumerate(segs):
    start = float(s.get("start", 0))
    end = float(s.get("end", 0))
    text = s.get("text", "").strip()
    lines.append(f"[{fmt(start)} → {fmt(end)}]  {text}")

OUT.write_text("\n".join(lines))
print(f"-> {OUT}  ({len(lines)} lines)")
print()
print("FIRST 60 LINES:")
print()
for ln in lines[:60]:
    print(ln)
