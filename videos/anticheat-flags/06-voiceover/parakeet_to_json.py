#!/usr/bin/env python3
"""Run parakeet_transcribe on a wav file and save word-level timing JSON.

Usage: parakeet_to_json.py <input.wav> <output.json>

Wraps the project's existing parakeet ONNX pipeline at
video/scripts/parakeet_transcribe.py so we get JSON instead of stdout.

Input must be 16kHz mono wav. The wrapped script assumes those parameters
when the input ends in .wav (no internal resampling on that path).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, "/Users/maxguillabert/Downloads/index/video/scripts")
from parakeet_transcribe import transcribe  # noqa: E402


def main() -> int:
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <input.wav> <output.json>", file=sys.stderr)
        return 2

    audio_path = sys.argv[1]
    out_path = Path(sys.argv[2])

    words = transcribe(audio_path)
    payload = {
        "source": audio_path,
        "word_count": len(words),
        "words": words,
    }
    out_path.write_text(json.dumps(payload, indent=2))
    print(f"Saved {len(words)} words → {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
