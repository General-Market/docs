#!/usr/bin/env python3
"""Separate a music track into stems (vocals, drums, bass, other) using Demucs.

This lets AI use only the parts it needs:
  - Just drums during action scenes
  - Just melody during calm moments
  - Remove vocals to use as instrumental
  - Isolate vocals for subtitle sync

Usage:
  python3 separate_stems.py <audio_file> [output_dir]
  python3 separate_stems.py music.mp3
  python3 separate_stems.py music.mp3 public/stems/
"""
import sys
import subprocess
import os


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 separate_stems.py <audio_file> [output_dir]")
        print("\nSeparates into: vocals.wav, drums.wav, bass.wav, other.wav")
        print("Uses Meta's Demucs v4 (htdemucs) AI model.")
        sys.exit(1)

    audio_file = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "separated"

    print(f"Separating: {audio_file}")
    print(f"Output dir: {output_dir}")
    print("This may take a few minutes on first run (downloads model)...")

    cmd = [
        "python3", "-m", "demucs",
        "--out", output_dir,
        "--name", "htdemucs",
        audio_file,
    ]

    subprocess.run(cmd, check=True)

    # Find output files
    basename = os.path.splitext(os.path.basename(audio_file))[0]
    stem_dir = os.path.join(output_dir, "htdemucs", basename)

    print(f"\nStems saved to: {stem_dir}/")
    for f in sorted(os.listdir(stem_dir)):
        filepath = os.path.join(stem_dir, f)
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        print(f"  {f} ({size_mb:.1f} MB)")

    print(f"\nUse in Remotion:")
    print(f'  <Audio src={{staticFile("stems/{basename}/drums.wav")}} />')
    print(f'  <Audio src={{staticFile("stems/{basename}/bass.wav")}} />')
    print(f'  <Audio src={{staticFile("stems/{basename}/other.wav")}} />')
    print(f'  <Audio src={{staticFile("stems/{basename}/vocals.wav")}} />')


if __name__ == "__main__":
    main()
