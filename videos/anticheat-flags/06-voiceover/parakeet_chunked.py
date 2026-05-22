#!/usr/bin/env python3
"""Transcribe a long audio file by chunking it.

The parakeet ONNX model has an internal length cap (the encoder's positional
embeddings cap at ~9999 frames). Audio above ~100 seconds at the model's
internal frame rate can trip a broadcast error. This script chunks the wav
into N-second slices, transcribes each, and concatenates the words with
adjusted timestamps.

A small overlap between chunks lets us drop the first/last word of the
boundary region to avoid mid-word splits.

The ONNX models are loaded once and reused across all chunks.

Usage:
    parakeet_chunked.py <input.wav> <output.json> [chunk_seconds] [overlap_seconds]
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

sys.path.insert(0, "/Users/maxguillabert/Downloads/index/video/scripts")
from parakeet_transcribe import (  # noqa: E402
    load_sessions,
    load_vocab,
    load_audio,
    greedy_decode_tdt,
    tokens_to_words,
)


def wav_duration(path: str) -> float:
    with wave.open(path, "rb") as wf:
        return wf.getnframes() / wf.getframerate()


def slice_wav(src: str, start: float, duration: float, dst: str) -> None:
    """Cut [start, start+duration) from src into dst (16k mono pcm_s16le wav)."""
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-ss", f"{start:.3f}", "-t", f"{duration:.3f}",
            "-i", src,
            "-vn", "-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le",
            dst,
        ],
        check=True,
    )


def main() -> int:
    if len(sys.argv) < 3:
        print(
            f"Usage: {sys.argv[0]} <input.wav> <output.json> [chunk_seconds=120] [overlap=5]",
            file=sys.stderr,
        )
        return 2

    src = sys.argv[1]
    out_path = Path(sys.argv[2])
    chunk_s = float(sys.argv[3]) if len(sys.argv) > 3 else 120.0
    overlap_s = float(sys.argv[4]) if len(sys.argv) > 4 else 5.0

    print(f"Loading ONNX sessions…")
    mel_sess, enc_sess, dec_sess = load_sessions()
    vocab = load_vocab()
    print(f"Models loaded.")

    total = wav_duration(src)
    print(f"Audio duration: {total:.1f}s. Chunk: {chunk_s}s, overlap: {overlap_s}s")

    merged: list[dict] = []
    chunk_index = 0
    start = 0.0
    tmp_dir = Path(tempfile.mkdtemp(prefix="parakeet_chunks_"))

    try:
        while start < total:
            end = min(total, start + chunk_s)
            drop_leading = overlap_s if chunk_index > 0 else 0.0
            drop_trailing = overlap_s if end < total else 0.0
            chunk_duration = end - start

            chunk_wav = tmp_dir / f"chunk_{chunk_index:03d}.wav"
            slice_wav(src, start, chunk_duration, str(chunk_wav))

            audio = load_audio(str(chunk_wav))
            tokens = greedy_decode_tdt(mel_sess, enc_sess, dec_sess, audio, vocab)
            words = tokens_to_words(tokens)

            keep_start = drop_leading
            keep_end = chunk_duration - drop_trailing
            kept = 0
            for w in words:
                if w["start"] < keep_start or w["start"] >= keep_end:
                    continue
                merged.append({
                    "word": w["word"],
                    "start": round(w["start"] + start, 3),
                    "end": round(w["end"] + start, 3),
                })
                kept += 1

            print(
                f"  chunk {chunk_index}: {start:6.1f}s..{end:6.1f}s "
                f"→ {len(words):3d} raw / {kept:3d} kept "
                f"(running total: {len(merged):5d})"
            )
            chunk_wav.unlink()
            chunk_index += 1
            start = end - overlap_s if end < total else end
    finally:
        for p in tmp_dir.iterdir():
            p.unlink()
        tmp_dir.rmdir()

    out_path.write_text(json.dumps({
        "source": src,
        "duration": total,
        "chunk_count": chunk_index,
        "word_count": len(merged),
        "words": merged,
    }, indent=2))
    print(f"\nSaved {len(merged)} words from {chunk_index} chunks → {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
