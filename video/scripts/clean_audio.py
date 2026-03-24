#!/usr/bin/env python3
"""Clean audio using DeepFilterNet - removes background noise from voice recordings."""
import sys
import os

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 clean_audio.py <input.wav> [output.wav]")
        print("  Cleans background noise from audio using AI (DeepFilterNet)")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace(".wav", "_clean.wav")

    from df.enhance import enhance, init_df, load_audio, save_audio

    print(f"Loading DeepFilterNet model...")
    model, df_state, _ = init_df()

    print(f"Cleaning: {input_file}")
    audio, _ = load_audio(input_file, sr=df_state.sr())
    enhanced = enhance(model, df_state, audio)
    save_audio(output_file, enhanced, df_state.sr())

    print(f"Saved: {output_file}")

if __name__ == "__main__":
    main()
