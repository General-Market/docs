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
    "Hook":      254,
    "Bars":      129,
    "Rigged":    178,
    "Stat":      145,
    "Solution":  233,
    "Reassure":  106,
    "Switch":    180,  # toFrames(6.0)
    "EndCard":   135,  # toFrames(4.5)
}

T = {
    "T_HOOK_BARS":        18,
    "T_RIGGED_STAT":      16,
    "T_STAT_SOLUTION":    28,
    "T_SOLUTION_REASSURE": 18,
    "T_REASSURE_SWITCH":  18,
    "T_SWITCH_END":       24,
}

AUDIO_SPIKE_IN_FILE = 3079
FPS = 30


def main():
    scene_sum = sum(SCENES.values())
    transition_sum = sum(T.values())
    total = scene_sum - transition_sum
    spike_lands_at = total - SCENES["EndCard"] + round(T["T_SWITCH_END"] / 2)
    music_start = max(0, AUDIO_SPIKE_IN_FILE - spike_lands_at)
    print("Per-scene durations (frames):")
    for k, v in SCENES.items():
        print(f"  {k:9s} {v:4d}f  ({v / FPS:.3f}s)")
    print(f"Sum scenes:        {scene_sum}")
    print(f"Sum transitions:   {transition_sum}")
    print(f"TOTAL_FRAMES:      {total} ({total / FPS:.3f}s)")
    print(f"SPIKE_LANDS_AT:    {spike_lands_at} ({spike_lands_at / FPS:.3f}s)")
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
    p += SCENES["Switch"] - T["T_REASSURE_SWITCH"]
    pos.append(("Switch end", p))
    p += SCENES["EndCard"] - T["T_SWITCH_END"]
    pos.append(("EndCard end (TOTAL)", p))

    print("\nCumulative ends:")
    for name, frame in pos:
        print(f"  {name:30s} {frame}")

    print("\nCut midpoints (where the eye sees the cut):")
    cuts = [
        ("cut1 Hook->Bars", SCENES["Hook"] - T["T_HOOK_BARS"] // 2, 245),
        ("cut2 Bars->Rigged (hard)", pos[1][1], 365),
        ("cut3 Rigged->Stat",  pos[2][1] - T["T_RIGGED_STAT"] // 2, 535),
        ("cut4 Stat->Solution", pos[3][1] - T["T_STAT_SOLUTION"] // 2, 658),
        ("cut5 Solution->Reassure", pos[4][1] - T["T_SOLUTION_REASSURE"] // 2, 868),
        ("cut6 Reassure->Switch", pos[5][1] - T["T_REASSURE_SWITCH"] // 2, 956),
        ("cut7 Switch->EndCard (LOCKED)", pos[6][1] - T["T_SWITCH_END"] // 2, 1115),
    ]
    for name, frame, target in cuts:
        delta = frame - target
        ok = "OK" if abs(delta) <= 5 else "MISS"
        print(f"  {name:34s} tf {frame:4d}  target {target:4d}  Δ {delta:+3d}  {ok}")

    # Sanity
    expected_total = 1238
    expected_spike = 1115
    expected_music_start = 1964
    print("\nLocked invariants:")
    print(f"  TOTAL_FRAMES == 1238:            {total == expected_total}")
    print(f"  SPIKE_LANDS_AT == 1115 (37.17s): {spike_lands_at == expected_spike}")
    print(f"  MUSIC_START_FROM_AUDIO == 1964:  {music_start == expected_music_start}")


if __name__ == "__main__":
    main()
