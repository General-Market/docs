#!/usr/bin/env python3
"""
Map a SOURCE-second in the talk to its FINAL.mp4 second.

The cuts.json on disk no longer matches the baked final.mp4, so the cut is
not re-derivable from it. Instead we calibrate against ground truth: the 13
title cards are baked into final.mp4 as 1.5s full-screen graphics, and ffmpeg
scene-detection locates their exact start-seconds. Each card start maps to a
known source trigger (cards.json). Between anchors we interpolate linearly;
the tail (after card 13) interpolates to the file end.

  ffmpeg scene cuts come in 1.5s pairs -> card START seconds (verified):
    24.354 92.560 161.608 204.410 237.397 290.417 320.798
    354.863 398.128 432.156 446.123 464.802 537.805
"""
import json
from pathlib import Path

COMP = Path("/Users/maxguillabert/Downloads/index/video/src/compositions/anticheat-edit")
CARDS = sorted(json.load(open("/tmp/title-cards/cards.json"))["cards"], key=lambda c: c["trigger"])
CARD_FINAL_STARTS = [24.354, 92.560, 161.608, 204.410, 237.397, 290.417, 320.798,
                     354.863, 398.128, 432.156, 446.123, 464.802, 537.805]
FINAL_END = 916.416
SRC_END = 1824.168

# (source_trigger, final_card_start) anchors + the file-end anchor.
ANCHORS = sorted(
    [(c["trigger"], f) for c, f in zip(CARDS, CARD_FINAL_STARTS)] + [(SRC_END, FINAL_END)]
)


def final_time(src: float) -> float:
    if src <= ANCHORS[0][0]:
        # before card 1: scale from 0 proportionally to the first anchor
        s0, f0 = ANCHORS[0]
        return max(0.0, f0 * (src / s0)) if s0 else 0.0
    for (s0, f0), (s1, f1) in zip(ANCHORS, ANCHORS[1:]):
        if s0 <= src <= s1:
            frac = (src - s0) / (s1 - s0)
            return f0 + frac * (f1 - f0)
    return ANCHORS[-1][1]


if __name__ == "__main__":
    print("anchors (src -> final):")
    for s, f in ANCHORS:
        print(f"   {s:8.1f} -> {f:7.2f}")
    print()
    BEATS = [
        ("listing_insider", 691.23, "some insider knows which token will be promoted -> frontrun"),
        ("frontrun", 695.49, "can frontrun you based on that"),
        ("flow_buy_access", 751.79, "participants buy access to this data"),
        ("zero_fees_study", 878.62, "studies: zero-fee exchanges cost more in spread"),
        ("colocation_proof", 420.81, "here you have all the proof every exchange does"),
        ("bigproof_start", 1596.88, "read the long list of everything on all exchanges"),
        ("court_only", 1615.62, "only the part that went to court"),
        ("every_exchange", 1628.66, "it happened on every exchange"),
        ("polymarket_case", 1682.25, "a case recently on Polymarket, 0.04% get 70%"),
    ]
    for name, src, note in BEATS:
        print(f"{name:18s} src {src:8.2f} -> final {final_time(src):7.2f}   ({note})")
