#!/usr/bin/env python3
"""
Per-word FX overlays — mixes short accent snippets on top of a clean voice track.

For each cue, extract the word segment, run it through a quick FX chain
(delay tail, reverb, pitch-drop doubling), and mix the result back onto the
base track ADDITIVELY. The original word still hits clean; the overlay adds
tail / texture / punch.

All timings are in composition-time (voice-file time), already past the
1.92s insert splice. A final limiter prevents overlay clipping.

Usage:
  python3 scripts/apply_word_fx.py <in.wav> <out.wav>
"""
import sys
import numpy as np
from pedalboard import (
    Pedalboard,
    Reverb,
    PitchShift,
    Compressor,
    Gain,
    Distortion,
    Delay,
    HighpassFilter,
    LowpassFilter,
    Limiter,
)
from pedalboard.io import AudioFile

# ── FX chains — each layered UNDER the original voice, never replacing it ───
FX = {
    "slap": Pedalboard([
        Delay(delay_seconds=0.06, feedback=0.15, mix=0.55),
        Gain(gain_db=-4),
    ]),
    "echo-short": Pedalboard([
        Delay(delay_seconds=0.12, feedback=0.30, mix=0.55),
        Gain(gain_db=-4),
    ]),
    "echo-verdict": Pedalboard([
        Delay(delay_seconds=0.18, feedback=0.45, mix=0.65),
        Reverb(room_size=0.45, wet_level=0.30, damping=0.35),
        Gain(gain_db=-3),
    ]),
    "pitch-drop": Pedalboard([
        PitchShift(semitones=-3),
        Delay(delay_seconds=0.08, feedback=0.35, mix=0.55),
        LowpassFilter(cutoff_frequency_hz=4500),
        Gain(gain_db=-4),
    ]),
    "reverb-medium": Pedalboard([
        Reverb(room_size=0.55, wet_level=0.45, damping=0.35),
        Gain(gain_db=-4),
    ]),
    "reverb-big": Pedalboard([
        Reverb(room_size=0.80, wet_level=0.55, damping=0.20),
        Delay(delay_seconds=0.22, feedback=0.30, mix=0.40),
        Gain(gain_db=-3),
    ]),
    "saturated-double": Pedalboard([
        PitchShift(semitones=-7),  # octave-ish down — creates a sub body
        HighpassFilter(cutoff_frequency_hz=80),
        LowpassFilter(cutoff_frequency_hz=2500),
        Distortion(drive_db=3),
        Gain(gain_db=-5),
    ]),
}

# ── Word cues — composition-time (already shifted past the 1.92s insert) ────
CUES = [
    {"start": 1.28,   "end": 1.76,   "fx": "slap",             "label": "booming"},
    {"start": 6.661,  "end": 7.301,  "fx": "echo-short",       "label": "banality"},
    {"start": 10.581, "end": 11.301, "fx": "pitch-drop",       "label": "never winning"},
    {"start": 13.301, "end": 14.181, "fx": "saturated-double", "label": "70%"},
    {"start": 26.021, "end": 27.141, "fx": "echo-verdict",     "label": "exchanges were RIGGED"},
    {"start": 28.501, "end": 28.901, "fx": "reverb-medium",    "label": "general market"},
    {"start": 42.181, "end": 43.301, "fx": "echo-short",       "label": "batches of thousands"},
    {"start": 49.381, "end": 50.261, "fx": "reverb-medium",    "label": "Quantity has protection"},
    {"start": 52.821, "end": 53.701, "fx": "reverb-big",       "label": "500"},
    {"start": 63.461, "end": 64.261, "fx": "slap",             "label": "Never pay spread"},
    {"start": 66.341, "end": 66.581, "fx": "reverb-big",       "label": "WIN"},
]


def main():
    if len(sys.argv) < 3:
        print("Usage: apply_word_fx.py <in.wav> <out.wav>")
        sys.exit(1)
    in_file = sys.argv[1]
    out_file = sys.argv[2]

    with AudioFile(in_file) as f:
        audio = f.read(f.frames)
        sr = f.samplerate

    # audio shape: (channels, samples)
    out = audio.copy()
    total_samples = audio.shape[1]

    for cue in CUES:
        s = int(cue["start"] * sr)
        e = int(cue["end"] * sr)
        if s >= total_samples:
            print(f"  skip  {cue['label']:28}  (out of bounds)")
            continue
        e = min(e, total_samples)

        seg = audio[:, s:e].copy()

        board = FX[cue["fx"]]
        fx_seg = board(seg, sr)

        # fx_seg can be longer than the source segment (reverb tail extends)
        fx_len = fx_seg.shape[1]
        overlay_end = min(s + fx_len, total_samples)
        overlay_len = overlay_end - s

        # 5ms fade in/out to avoid edge clicks
        fade = int(0.005 * sr)
        if overlay_len > fade * 2:
            in_ramp = np.linspace(0, 1, fade).astype(fx_seg.dtype)
            out_ramp = np.linspace(1, 0, fade).astype(fx_seg.dtype)
            fx_seg[:, :fade] *= in_ramp
            fx_seg[:, overlay_len - fade : overlay_len] *= out_ramp

        out[:, s:overlay_end] += fx_seg[:, :overlay_len]

        print(
            f"  +fx   {cue['label']:28}  {cue['fx']:18}  @ {cue['start']:6.2f}s"
        )

    # Protect against overlay peaks
    limiter = Pedalboard([Limiter(threshold_db=-0.8, release_ms=100)])
    out = limiter(out, sr)

    with AudioFile(out_file, "w", sr, out.shape[0]) as f:
        f.write(out)

    print(f"\nwrote {out_file}")


if __name__ == "__main__":
    main()
