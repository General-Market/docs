#!/usr/bin/env python3
"""Build the per-sentence edit manifest from script + two retake-aware alignments.

The manifest is the single source of truth for the Remotion composition.
Every cut decision lives here. To resync any sentence later, edit one row
and re-render — the composition has no hidden state.

Per-sentence shape:
  {
    "id": "p1_s1",
    "paragraph": "P1",
    "rhythm": "slow",
    "text": "Last October, a trader called 0xQuaza...",
    "source": "A" | "B",
    "sourceA": { chosen: {...}, candidateCount: 1 },
    "sourceB": { chosen: {...}, candidateCount: 2 },
    "autoPick": "A",
    "pickReason": "...",
    "overridden": false,
    "broll": null
  }

Auto-pick rules:
  • If both takes have a chosen candidate, default to A unless B is materially
    better — score advantage ≥ 0.15, OR A's chosen has very low score (<0.7).
  • If only one take aligned, use that one.
  • If neither aligned (chosen=None on both), flag for manual review.

Usage:
    build_manifest.py <script-sentences.json> <align-A.json> <align-B.json> [overrides.json] <output.json>
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def pick_take(a: dict | None, b: dict | None) -> tuple[str, str]:
    ca = a.get("chosen") if a else None
    cb = b.get("chosen") if b else None

    if ca is None and cb is None:
        return ("A", "neither take aligned — manual review needed")
    if ca is None:
        return ("B", f"take A had no match (B score {cb['score']:.0%})")
    if cb is None:
        return ("A", f"take B had no match (A score {ca['score']:.0%})")

    a_score = ca["score"]
    b_score = cb["score"]
    a_dur = ca["duration"]
    b_dur = cb["duration"]
    a_cands = a.get("candidateCount", 0)
    b_cands = b.get("candidateCount", 0)

    # Strong B advantage on score
    if b_score >= a_score + 0.15:
        return ("B", f"B score {b_score:.0%} materially beats A {a_score:.0%}")
    # A had low absolute score and B is acceptable
    if a_score < 0.7 and b_score >= a_score + 0.05:
        return ("B", f"A weak ({a_score:.0%}), B better ({b_score:.0%})")
    # A had massive stumble (2× B's duration suggests filler)
    if b_dur > 0 and a_dur > 2 * b_dur and b_score >= 0.7:
        return ("B", f"A duration {a_dur:.1f}s vs B {b_dur:.1f}s — A likely stumbled")
    return (
        "A",
        f"default A (A {a_score:.0%}/{a_cands}c vs B {b_score:.0%}/{b_cands}c)",
    )


def main() -> int:
    args = sys.argv[1:]
    if len(args) < 4:
        print(
            f"Usage: {sys.argv[0]} <script-sentences.json> <align-A.json> <align-B.json> [overrides.json] <output.json>",
            file=sys.stderr,
        )
        return 2

    script_path = Path(args[0])
    align_a_path = Path(args[1])
    align_b_path = Path(args[2])
    overrides_path = Path(args[3]) if len(args) >= 5 else None
    out_path = Path(args[-1])

    script = json.loads(script_path.read_text())
    align_a = json.loads(align_a_path.read_text())
    align_b = json.loads(align_b_path.read_text())
    overrides: dict[str, str] = {}
    if overrides_path and overrides_path.exists():
        overrides = json.loads(overrides_path.read_text())

    manifest_sentences = []
    chosen_a = chosen_b = overridden = unmatched = retakes_a = retakes_b = 0

    for sentence in script["sentences"]:
        sid = sentence["id"]
        a = align_a["sentences"].get(sid)
        b = align_b["sentences"].get(sid)
        auto, reason = pick_take(a, b)
        manual = overrides.get(sid)
        chosen = manual if manual in ("A", "B") else auto
        if manual:
            overridden += 1
        if chosen == "A":
            chosen_a += 1
        else:
            chosen_b += 1
        if (a is None or a.get("chosen") is None) and (b is None or b.get("chosen") is None):
            unmatched += 1
        if a and a.get("candidateCount", 0) > 1:
            retakes_a += 1
        if b and b.get("candidateCount", 0) > 1:
            retakes_b += 1

        manifest_sentences.append({
            "id": sid,
            "paragraph": sentence["paragraph"],
            "rhythm": sentence["rhythm"],
            "text": sentence["text"],
            "source": chosen,
            "sourceA": {
                "chosen": (a or {}).get("chosen"),
                "candidateCount": (a or {}).get("candidateCount", 0),
                "candidates": (a or {}).get("candidates", []),
            },
            "sourceB": {
                "chosen": (b or {}).get("chosen"),
                "candidateCount": (b or {}).get("candidateCount", 0),
                "candidates": (b or {}).get("candidates", []),
            },
            "autoPick": auto,
            "pickReason": reason,
            "overridden": bool(manual),
            "broll": None,
        })

    manifest = {
        "version": 1,
        "fps": 30,
        "width": 1920,
        "height": 1080,
        "videoOffsetSeconds": 0.0,
        "takeAVideoSrc": "anticheat-takes/take-A-video.mp4",
        "takeAAudioSrc": "anticheat-takes/take-A-clean.wav",
        "takeBAudioSrc": "anticheat-takes/take-B-clean.wav",
        "sentences": manifest_sentences,
        "summary": {
            "totalSentences": len(manifest_sentences),
            "chosenA": chosen_a,
            "chosenB": chosen_b,
            "manualOverrides": overridden,
            "unmatched": unmatched,
            "retakesDetectedInA": retakes_a,
            "retakesDetectedInB": retakes_b,
        },
    }
    out_path.write_text(json.dumps(manifest, indent=2))
    print(
        f"Manifest written: {len(manifest_sentences)} sentences "
        f"(A: {chosen_a}, B: {chosen_b}, overrides: {overridden}, unmatched: {unmatched}) → {out_path}"
    )
    print(
        f"Retakes detected — take A: {retakes_a} sentences had ≥2 attempts; "
        f"take B: {retakes_b} sentences had ≥2 attempts."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
