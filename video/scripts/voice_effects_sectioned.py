"""
Multi-section voice effects processor for Short-01.

Consistent cinematic reverb on first 3 sections, clean close.

Sections:
  Hook    (0-19s)   → cinematic: HP80 + comp + room 0.55/wet 0.20
  Money   (19-41s)  → cinematic-warm: HP60 + LP12k + comp + room 0.55/wet 0.20
  Flip    (41-52s)  → cinematic: comp + room 0.55/wet 0.20
  Close   (52-end)  → clean+punchy: HP80 + comp + presence boost + limiter

Usage: python3 scripts/voice_effects_sectioned.py
"""

import numpy as np
from pedalboard import (
    Pedalboard,
    Compressor,
    HighpassFilter,
    LowpassFilter,
    Reverb,
    Limiter,
    Gain,
    Chorus,
    Delay,
)
from pedalboard.io import AudioFile

INPUT = "public/shorts/short-01/voice-surgery-v4-trimmed.wav"
OUTPUT = "public/shorts/short-01/voice-processed.wav"

# Section boundaries in seconds — all with cinematic-level reverb
SECTIONS = [
    {
        "name": "hook",
        "start": 0.0,
        "end": 19.0,
        "board": Pedalboard([
            HighpassFilter(cutoff_frequency_hz=80),
            Compressor(threshold_db=-18, ratio=3.0, attack_ms=5, release_ms=80),
            Reverb(room_size=0.55, wet_level=0.20, dry_level=1.0, damping=0.6),
            Limiter(threshold_db=-1.0),
        ]),
    },
    {
        "name": "money",
        "start": 19.0,
        "end": 41.0,
        "board": Pedalboard([
            HighpassFilter(cutoff_frequency_hz=60),
            LowpassFilter(cutoff_frequency_hz=12000),
            Compressor(threshold_db=-18, ratio=3.0, attack_ms=5, release_ms=80),
            Reverb(room_size=0.55, wet_level=0.20, dry_level=1.0, damping=0.6),
            Limiter(threshold_db=-1.0),
        ]),
    },
    {
        "name": "flip",
        "start": 41.0,
        "end": 52.0,
        "board": Pedalboard([
            HighpassFilter(cutoff_frequency_hz=80),
            Compressor(threshold_db=-18, ratio=3.0, attack_ms=5, release_ms=80),
            Reverb(room_size=0.55, wet_level=0.20, dry_level=1.0, damping=0.6),
            Limiter(threshold_db=-1.0),
        ]),
    },
    {
        "name": "close",
        "start": 52.0,
        "end": None,  # to end of file
        "board": Pedalboard([
            HighpassFilter(cutoff_frequency_hz=80),
            Compressor(threshold_db=-16, ratio=3.5, attack_ms=3, release_ms=60),
            Gain(gain_db=1.5),
            Limiter(threshold_db=-1.0),
        ]),
    },
]

CROSSFADE_SAMPLES_MS = 50  # 50ms crossfade between sections


def process():
    with AudioFile(INPUT) as f:
        sr = f.samplerate
        audio = f.read(f.frames)  # shape: (channels, samples)
        channels = audio.shape[0]

    total_samples = audio.shape[1]
    xfade = int(sr * CROSSFADE_SAMPLES_MS / 1000)
    output = np.zeros_like(audio)

    for i, sec in enumerate(SECTIONS):
        start_s = int(sec["start"] * sr)
        end_s = int(sec["end"] * sr) if sec["end"] else total_samples

        # Grab with extra margin for crossfade + reverb context
        grab_start = max(0, start_s - xfade)
        grab_end = min(total_samples, end_s + xfade)

        chunk = audio[:, grab_start:grab_end].copy()
        processed = sec["board"](chunk, sr)

        # Offset into processed buffer for the section's actual start
        offset = start_s - grab_start
        write_len = min(end_s, total_samples) - start_s
        avail = processed.shape[1] - offset
        n = min(write_len, avail)

        if n <= 0:
            print(f"  WARNING: section {sec['name']} produced no output")
            continue

        segment = processed[:, offset:offset + n]

        # Crossfade at section start (blend with previous section's output)
        if i > 0 and n > xfade:
            fade_in = np.linspace(0, 1, xfade, dtype=np.float32)
            fade_out = 1.0 - fade_in
            output[:, start_s:start_s + xfade] = (
                output[:, start_s:start_s + xfade] * fade_out +
                segment[:, :xfade] * fade_in
            )
            # Write the rest after crossfade
            output[:, start_s + xfade:start_s + n] = segment[:, xfade:n]
        else:
            output[:, start_s:start_s + n] = segment

    # Write output
    with AudioFile(OUTPUT, "w", samplerate=sr, num_channels=channels) as f:
        f.write(output)

    duration = total_samples / sr
    print(f"Processed {duration:.2f}s voice with {len(SECTIONS)} sections")
    print(f"  Crossfade: {CROSSFADE_SAMPLES_MS}ms between sections")
    for sec in SECTIONS:
        end_str = f"{sec['end']}s" if sec['end'] else "end"
        print(f"  {sec['name']}: {sec['start']}s -> {end_str}")
    print(f"Output: {OUTPUT}")


if __name__ == "__main__":
    process()
