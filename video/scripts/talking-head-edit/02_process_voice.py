#!/usr/bin/env python3
"""
Replicate the GarageBand "Narration Vocal" strip in Pedalboard, then duck
breaths between words using WhisperX timestamps.

Plug-in order matches the GB screenshot exactly:
   Noise Gate → DeEsser → Channel EQ → Compressor → Channel EQ →
   Compressor → Channel EQ → Exciter   +  light reverb send

EQ curve replicates the screenshot: HPF at 80 Hz (steep below 50 Hz),
gentle presence shelf 200 Hz–6 kHz, soft rolloff above 10 kHz.

Breath removal: every inter-word gap from the WhisperX transcript that
is shorter than the silence-cut threshold but louder than the room
floor is ducked by BREATH_DUCK_DB. Word timestamps survive the chain
because Pedalboard is sample-aligned.

Usage:
   python3 process_voice.py INPUT.wav OUTPUT.wav [aligned.json] [--offset SECONDS]
"""
import argparse
import json
import sys

import numpy as np
import soundfile as sf
from pedalboard import (
    Pedalboard, HighpassFilter, NoiseGate, Compressor,
    LowShelfFilter, HighShelfFilter, PeakFilter, Limiter, Reverb,
)

BREATH_DUCK_DB = -28.0      # how hard to attenuate breath segments
BREATH_PAD = 0.04           # crossfade pad either side of the ducked gap
MIN_DUCK_GAP = 0.10         # don't bother with gaps under this
MAX_DUCK_GAP = 0.80         # gaps longer than this are real silences
DUCK_FADE_MS = 25           # raised-cosine fade to avoid clicks

def db_to_lin(db: float) -> float:
    return float(10 ** (db / 20.0))

def build_board() -> Pedalboard:
    # Podcast strip — low-tone, present, dry. Aim: voice that sits *behind*
    # the listener's ear instead of in front of it. Less reverb, more body
    # in the 100–250 Hz region, smoothed top.
    return Pedalboard([
        # Light HPF — kills sub-60 Hz only; we want to keep low body.
        HighpassFilter(cutoff_frequency_hz=60.0),

        # Noise Gate — same floor as before.
        NoiseGate(threshold_db=-42.0, ratio=4.0, attack_ms=5.0, release_ms=120.0),

        # DeEsser (peak-boost → narrow comp → peak-cut around 6 kHz).
        PeakFilter(cutoff_frequency_hz=6000.0, gain_db=6.0, q=2.0),
        Compressor(threshold_db=-22.0, ratio=4.0, attack_ms=3.0, release_ms=70.0),
        PeakFilter(cutoff_frequency_hz=6000.0, gain_db=-6.0, q=2.0),

        # Channel EQ #1 — low-shelf BOOST for warmth, mud cut at 350 Hz.
        LowShelfFilter(cutoff_frequency_hz=110.0, gain_db=+2.0, q=0.7),
        PeakFilter(cutoff_frequency_hz=350.0, gain_db=-1.5, q=1.0),

        # Compressor #1 — slow, present — the "always there" podcast feel.
        # Was 5:1 @ -24 dB: stacked under DeEsser + glue comp + limiter it
        # crushed the voice to ~2 LU of range and printed inter-sample peaks
        # over 0 dBTP, which reads as saturation on loud syllables. Softened to
        # 3:1 @ -20 dB — still present, no longer slammed.
        Compressor(threshold_db=-20.0, ratio=3.0, attack_ms=15.0, release_ms=200.0),

        # Channel EQ #2 — body lift at 200 Hz, gentle softening at 3 kHz
        # to take edge off harshness (more low-tone, less spitty).
        PeakFilter(cutoff_frequency_hz=200.0, gain_db=+2.5, q=0.9),
        PeakFilter(cutoff_frequency_hz=3000.0, gain_db=-1.5, q=0.9),

        # Compressor #2 — glue compression, gentle ratio.
        Compressor(threshold_db=-18.0, ratio=2.5, attack_ms=20.0, release_ms=250.0),

        # Channel EQ #3 — smooth top: high-shelf cut above 9 kHz so the
        # voice never gets bright/aggressive.
        HighShelfFilter(cutoff_frequency_hz=9000.0, gain_db=-3.0, q=0.7),

        # NO Exciter — exciter brightens, opposite of "podcast low tone".

        # Reverb — much drier than before (wet ≈ 0.02). Tiny room only,
        # keeps the voice feeling intimate, not in a hall.
        Reverb(room_size=0.10, damping=0.6, wet_level=0.02, dry_level=0.98,
               width=1.0, freeze_mode=0.0),

        # Final limiter — -1.5 dBFS ceiling. The extra 0.5 dB of headroom keeps
        # inter-sample peaks under 0 dBTP after the bake's atempo + AAC re-encode,
        # which is where the audible saturation was coming from.
        Limiter(threshold_db=-1.5, release_ms=120.0),
    ])


def duck_breaths(audio: np.ndarray, sr: int, aligned_path: str,
                 time_offset: float = 0.0) -> tuple[np.ndarray, int]:
    """
    Read WhisperX aligned JSON and duck inter-word gaps.

    `time_offset` is subtracted from every word time before mapping into
    `audio` — use it when audio represents only a sub-range of the transcript.
    """
    data = json.load(open(aligned_path))
    words = []
    for s in data["segments"]:
        for w in s.get("words", []):
            if "start" in w and "end" in w:
                ws = float(w["start"]) - time_offset
                we = float(w["end"]) - time_offset
                if 0 <= ws < len(audio) / sr:
                    words.append((ws, we))
    words.sort()

    if not words:
        return audio, 0

    duck_lin = db_to_lin(BREATH_DUCK_DB)
    fade = int(sr * DUCK_FADE_MS / 1000.0)

    # Build a per-sample gain envelope — start at 1.0 everywhere, then for
    # each breath gap dip to duck_lin with a raised-cosine fade on each side.
    gain = np.ones(len(audio), dtype=np.float32)
    ducked = 0
    for (_, prev_end), (next_start, _) in zip(words, words[1:]):
        gap = next_start - prev_end
        if gap < MIN_DUCK_GAP or gap > MAX_DUCK_GAP:
            continue
        # Mid 70% of the gap gets ducked, with `fade` samples of taper either side.
        a = int((prev_end + BREATH_PAD) * sr)
        b = int((next_start - BREATH_PAD) * sr)
        if b - a < fade * 2:
            continue
        # Build raised-cosine taper from 1 → duck_lin
        in_fade = 0.5 * (1.0 - np.cos(np.linspace(0, np.pi, fade))) * (1.0 - duck_lin)
        in_fade = 1.0 - in_fade  # 1 → duck_lin
        out_fade = in_fade[::-1]
        gain[a:a+fade] = np.minimum(gain[a:a+fade], in_fade)
        gain[a+fade:b-fade] = duck_lin
        gain[b-fade:b] = np.minimum(gain[b-fade:b], out_fade)
        ducked += 1

    # Apply per-channel.
    if audio.ndim == 2:
        gain = gain[:, None]
    return (audio * gain).astype(np.float32), ducked


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--aligned", help="WhisperX aligned JSON for breath ducking")
    ap.add_argument("--offset", type=float, default=0.0,
                    help="subtract this from word times before applying to input")
    ap.add_argument("--no-breath", action="store_true")
    args = ap.parse_args()

    print(f"loading {args.input}", flush=True)
    audio, sr = sf.read(args.input, always_2d=False, dtype="float32")
    print(f"  shape={audio.shape} sr={sr}", flush=True)

    if args.aligned and not args.no_breath:
        print(f"ducking breath gaps from {args.aligned}", flush=True)
        audio, ducked = duck_breaths(audio, sr, args.aligned, args.offset)
        print(f"  ducked {ducked} gaps", flush=True)

    print("running pedalboard chain…", flush=True)
    board = build_board()
    out = board(audio, sample_rate=sr)
    sf.write(args.output, out, sr)
    print(f"-> {args.output}", flush=True)


if __name__ == "__main__":
    main()
