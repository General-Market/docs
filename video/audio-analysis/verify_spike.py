#!/usr/bin/env python3
"""Verify the spike anchor lands at the locked target.

Reads the durationInFrames from each meta file and computes the same
math as AntiCheatFull.tsx. Compares against tf 1095 / file-frame 3087.
"""
import re
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent / "src" / "compositions" / "anticheat"

# Per-scene constants (extracted by hand to mirror what each meta
# resolves to). If a scene file changes, update these. Keep in sync
# with the meta exports.
SCENES = {
    "Hook":      255,  # toFrames(8.5)
    "Bars":      120,  # toFrames(4.0)
    "Rigged":    193,  # 193/FPS
    "Stat":      135,  # toFrames(4.5)
    "Solution":  240,  # toFrames(8.0)
    "Reassure":  137,  # 137/FPS
    "Bridge":    180,  # toFrames(6.0)
    "EndCard":   135,  # toFrames(4.5)
}

T = {
    "T_HOOK_BARS":        26,
    "T_RIGGED_STAT":      24,
    "T_STAT_SOLUTION":    42,
    "T_SOLUTION_REASSURE": 28,
    "T_REASSURE_BRIDGE":  28,
    "T_BRIDGE_END":       34,
}

AUDIO_SPIKE_IN_FILE = 3087
FPS = 30


def main():
    scene_sum = sum(SCENES.values())
    transition_sum = sum(T.values())
    total = scene_sum - transition_sum
    spike_lands_at = total - SCENES["EndCard"] + round(T["T_BRIDGE_END"] / 2)
    music_start = max(0, AUDIO_SPIKE_IN_FILE - spike_lands_at)
    print("Per-scene durations (frames):")
    for k, v in SCENES.items():
        print(f"  {k:9s} {v:4d}f  ({v / FPS:.3f}s)")
    print(f"Sum scenes:        {scene_sum}")
    print(f"Sum transitions:   {transition_sum}")
    print(f"TOTAL_FRAMES:      {total} ({total / FPS:.3f}s)")
    print(f"SPIKE_LANDS_AT:    {spike_lands_at}")
    print(f"MUSIC_START_FROM_AUDIO: {music_start} (audio second {music_start / FPS:.3f})")

    # Cuts
    pos = []
    p = 0
    p += SCENES["Hook"]
    pos.append(("Hook end", p))
    p += SCENES["Bars"] - T["T_HOOK_BARS"]
    pos.append(("Bars end (cut2 hard)", p))
    p += SCENES["Rigged"]
    pos.append(("Rigged end", p))
    p += SCENES["Stat"] - T["T_RIGGED_STAT"]
    pos.append(("Stat end", p))
    p += SCENES["Solution"] - T["T_STAT_SOLUTION"]
    pos.append(("Solution end", p))
    p += SCENES["Reassure"] - T["T_SOLUTION_REASSURE"]
    pos.append(("Reassure end", p))
    p += SCENES["Bridge"] - T["T_REASSURE_BRIDGE"]
    pos.append(("Bridge end", p))
    p += SCENES["EndCard"] - T["T_BRIDGE_END"]
    pos.append(("EndCard end (TOTAL)", p))

    print("\nCumulative ends:")
    for name, frame in pos:
        print(f"  {name:30s} {frame}")

    print("\nCut midpoints (where the eye sees the cut):")
    cuts = [
        ("cut1 Hook->Bars", SCENES["Hook"] - T["T_HOOK_BARS"] // 2, 246),
        ("cut2 Bars->Rigged (hard)", pos[1][1], 349),
        ("cut3 Rigged->Stat",  pos[2][1] - T["T_RIGGED_STAT"] // 2, 530),
        ("cut4 Stat->Solution", pos[3][1] - T["T_STAT_SOLUTION"] // 2, 632),
        ("cut5 Solution->Reassure", pos[4][1] - T["T_SOLUTION_REASSURE"] // 2, 838),
        ("cut6 Reassure->Bridge", pos[5][1] - T["T_REASSURE_BRIDGE"] // 2, 941),
        ("cut7 Bridge->EndCard (LOCKED)", pos[6][1] - T["T_BRIDGE_END"] // 2, 1095),
    ]
    for name, frame, target in cuts:
        delta = frame - target
        ok = "OK" if abs(delta) <= 5 else "MISS"
        print(f"  {name:34s} tf {frame:4d}  target {target:4d}  Δ {delta:+3d}  {ok}")

    # Sanity
    expected_total = 1213
    expected_spike = 1095
    expected_music_start = 1992
    print("\nLocked invariants:")
    print(f"  TOTAL_FRAMES == 1213:           {total == expected_total}")
    print(f"  SPIKE_LANDS_AT == 1095:          {spike_lands_at == expected_spike}")
    print(f"  MUSIC_START_FROM_AUDIO == 1992:  {music_start == expected_music_start}")


if __name__ == "__main__":
    main()
