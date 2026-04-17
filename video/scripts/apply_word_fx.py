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

# ── FX chains — subtle tails only. All sit 10–13 dB under the original voice.
# The goal is *presence*, not a second voice.
FX = {
    "tail-short": Pedalboard([
        Delay(delay_seconds=0.14, feedback=0.12, mix=0.25),
        Gain(gain_db=-13),
    ]),
    "room": Pedalboard([
        Reverb(room_size=0.40, wet_level=0.20, damping=0.45),
        Gain(gain_db=-12),
    ]),
    "hall": Pedalboard([
        Reverb(room_size=0.65, wet_level=0.30, damping=0.30),
        Gain(gain_db=-11),
    ]),
}

# ── Word cues — four words only. Each gets a subtle tail that whispers.
# If this still feels heavy, drop the gain by another 3–4 dB per chain.
CUES = [
    {"start": 26.021, "end": 27.141, "fx": "tail-short", "label": "exchanges were RIGGED"},
    {"start": 28.501, "end": 28.901, "fx": "room",       "label": "general market"},
    {"start": 52.821, "end": 53.701, "fx": "hall",       "label": "500"},
    {"start": 66.341, "end": 66.581, "fx": "hall",       "label": "WIN"},
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
