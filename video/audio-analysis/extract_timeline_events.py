#!/usr/bin/env python3
"""Map music events to timeline frames for AntiCheatFull.

Audio plays from file-second 66.4 (= file-frame 1992) onward. Timeline
frame 0 = audio file-frame 1992. Mapping:

  timeline_frame T  <->  audio_seconds (T + 1992) / 30
  audio_seconds S   ->   timeline_frame round(S * 30) - 1992
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
WINDOW_START_S = 66.4
WINDOW_END_S = 106.83
FPS = 30
START_FROM_FILE_FRAME = 1992  # = WINDOW_START_S * 30


def to_tf(audio_s: float) -> int:
    return int(round(audio_s * FPS)) - START_FROM_FILE_FRAME


def main():
    with open(os.path.join(HERE, "dagored-march.json"), encoding="utf-8") as f:
        data = json.load(f)

    beats = data["beat_timestamps"]
    onsets = data["onset_timestamps"]
    peaks = data["energy_peaks"]
    energy = data["energy_curve"]

    # Beats inside the playing window
    playing_beats = [b for b in beats if WINDOW_START_S <= b <= WINDOW_END_S + 1.0]
    print(f"Beats in window: {len(playing_beats)}")
    print("Beats (audio_s -> timeline_frame):")
    for b in playing_beats:
        print(f"  {b:7.3f}s -> tf {to_tf(b):4d}")

    # Energy peaks (peak_starts only) inside window
    print("\nEnergy peak starts in window:")
    for p in peaks:
        if p["type"] == "peak_start" and WINDOW_START_S <= p["time"] <= WINDOW_END_S + 1.0:
            print(f"  {p['time']:7.2f}s e={p['energy']:.3f} -> tf {to_tf(p['time']):4d}")

    # Strongest 1-second-bin energy values inside window
    print("\nEnergy curve (windowed):")
    for e in energy:
        if WINDOW_START_S - 1 <= e["time"] <= WINDOW_END_S + 1:
            tf = to_tf(e["time"])
            bar = "#" * int(e["energy"] * 40)
            print(f"  {e['time']:6.1f}s  tf={tf:4d}  e={e['energy']:.3f}  {bar}")

    # Spike anchor verification
    SPIKE_FILE_FRAME = 3087
    spike_audio_s = SPIKE_FILE_FRAME / FPS
    spike_tf = to_tf(spike_audio_s)
    print(f"\nMusic spike at file-frame {SPIKE_FILE_FRAME} = {spike_audio_s:.3f}s -> tf {spike_tf}")

    # Onsets in window (only show every nth to keep it readable)
    print("\nOnsets in window (timeline frames):")
    in_window_onsets = [o for o in onsets if WINDOW_START_S <= o <= WINDOW_END_S + 1.0]
    print(f"  count: {len(in_window_onsets)}")
    print("  frames:", ", ".join(str(to_tf(o)) for o in in_window_onsets[:80]))


if __name__ == "__main__":
    main()
