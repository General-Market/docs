#!/usr/bin/env python3
"""Apply voice effects using Spotify's Pedalboard library."""
import sys
from pedalboard import (
    Pedalboard, Reverb, PitchShift, Compressor, Gain,
    Distortion, Delay, Chorus, HighpassFilter, LowpassFilter,
    Limiter, Phaser
)
from pedalboard.io import AudioFile

PRESETS = {
    "clean-voice": [
        HighpassFilter(cutoff_frequency_hz=80),
        Compressor(threshold_db=-18, ratio=3),
        Gain(gain_db=3),
        Limiter(threshold_db=-1),
    ],
    "deep-voice": [
        PitchShift(semitones=-4),
        Compressor(threshold_db=-20, ratio=2),
        Reverb(room_size=0.2, wet_level=0.1),
    ],
    "chipmunk": [
        PitchShift(semitones=6),
        Gain(gain_db=2),
    ],
    "radio": [
        HighpassFilter(cutoff_frequency_hz=300),
        LowpassFilter(cutoff_frequency_hz=3000),
        Compressor(threshold_db=-15, ratio=6),
        Distortion(drive_db=5),
        Gain(gain_db=4),
    ],
    "cinematic": [
        Compressor(threshold_db=-20, ratio=2.5),
        Reverb(room_size=0.6, wet_level=0.25, damping=0.7),
        Gain(gain_db=2),
    ],
    "echo": [
        Delay(delay_seconds=0.3, feedback=0.4, mix=0.3),
        Reverb(room_size=0.4, wet_level=0.15),
    ],
    "robot": [
        Chorus(rate_hz=5, depth=0.8, mix=0.7),
        Distortion(drive_db=10),
        Compressor(threshold_db=-10, ratio=8),
    ],
    "warm": [
        HighpassFilter(cutoff_frequency_hz=60),
        LowpassFilter(cutoff_frequency_hz=12000),
        Compressor(threshold_db=-18, ratio=2),
        Reverb(room_size=0.15, wet_level=0.08),
        Gain(gain_db=2),
    ],
    "phone": [
        HighpassFilter(cutoff_frequency_hz=500),
        LowpassFilter(cutoff_frequency_hz=2000),
        Compressor(threshold_db=-10, ratio=6),
        Distortion(drive_db=3),
    ],
    "underwater": [
        LowpassFilter(cutoff_frequency_hz=600),
        Chorus(rate_hz=0.5, depth=0.6, mix=0.5),
        Reverb(room_size=0.8, wet_level=0.6),
    ],
}

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 voice_effects.py <preset> <input.wav> [output.wav]")
        print(f"\nPresets: {', '.join(PRESETS.keys())}")
        print("\nExamples:")
        print("  python3 voice_effects.py clean-voice recording.wav")
        print("  python3 voice_effects.py cinematic recording.wav output.wav")
        print("  python3 voice_effects.py deep-voice narration.wav deep.wav")
        sys.exit(1)

    preset_name = sys.argv[1]
    input_file = sys.argv[2]
    output_file = sys.argv[3] if len(sys.argv) > 3 else f"{preset_name}-{input_file}"

    if preset_name not in PRESETS:
        print(f"Unknown preset: {preset_name}")
        print(f"Available: {', '.join(PRESETS.keys())}")
        sys.exit(1)

    board = Pedalboard(PRESETS[preset_name])

    with AudioFile(input_file) as f:
        audio = f.read(f.frames)
        sr = f.samplerate

    effected = board(audio, sr)

    with AudioFile(output_file, "w", sr, effected.shape[0]) as f:
        f.write(effected)

    print(f"Applied '{preset_name}' -> {output_file}")

if __name__ == "__main__":
    main()
