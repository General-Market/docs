#!/usr/bin/env python3
"""
Parakeet TDT v3 int8 ONNX inference with word-level timestamps.
Model: parakeet-tdt-0.6b-v3-int8 (NeMo Conformer-TDT)
Vocab: 8193 tokens (0-8192), blank=8192
Decoder output: 8198 = 8193 vocab + 5 duration bins
"""
from __future__ import annotations

import numpy as np
import onnxruntime as ort
import subprocess
import sys
import json
import wave
from pathlib import Path
from typing import List, Optional

MODEL_DIR = Path("/Users/maxguillabert/Library/Application Support/com.pais.handy/models/parakeet-tdt-0.6b-v3-int8")
SAMPLE_RATE = 16000
SUBSAMPLING_FACTOR = 8
HOP_LENGTH = 160

VOCAB_SIZE = 8193
BLANK_ID = 8192
NUM_DURATIONS = 5
TOTAL_OUTPUT = VOCAB_SIZE + NUM_DURATIONS  # 8198


def load_sessions():
    opts = ort.SessionOptions()
    opts.inter_op_num_threads = 4
    opts.intra_op_num_threads = 4
    mel = ort.InferenceSession(str(MODEL_DIR / "nemo128.onnx"), opts)
    enc = ort.InferenceSession(str(MODEL_DIR / "encoder-model.int8.onnx"), opts)
    dec = ort.InferenceSession(str(MODEL_DIR / "decoder_joint-model.int8.onnx"), opts)
    return mel, enc, dec


def load_audio(path: str) -> np.ndarray:
    wav_path = path
    if not path.endswith('.wav'):
        wav_path = "/tmp/parakeet_input.wav"
        subprocess.run([
            "ffmpeg", "-y", "-i", path,
            "-vn", "-acodec", "pcm_s16le", "-ar", str(SAMPLE_RATE), "-ac", "1",
            wav_path
        ], capture_output=True, timeout=30)
    with wave.open(wav_path, 'rb') as wf:
        frames = wf.readframes(wf.getnframes())
        return np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0


def load_vocab():
    vocab = {}
    with open(MODEL_DIR / "vocab.txt", 'r') as f:
        for line in f:
            parts = line.strip().rsplit(' ', 1)
            if len(parts) == 2:
                vocab[int(parts[1])] = parts[0]
    return vocab


def frame_to_sec(frame: int) -> float:
    return frame * HOP_LENGTH * SUBSAMPLING_FACTOR / SAMPLE_RATE


def greedy_decode_tdt(mel_sess, enc_sess, dec_sess, audio: np.ndarray, vocab: dict) -> List[dict]:
    """Full TDT greedy decode pipeline."""

    # Mel features
    waveform = audio.reshape(1, -1).astype(np.float32)
    waveform_lens = np.array([len(audio)], dtype=np.int64)
    features, feat_lens = mel_sess.run(None, {
        "waveforms": waveform, "waveforms_lens": waveform_lens
    })

    # Encode
    enc_out, enc_lens = enc_sess.run(None, {
        "audio_signal": features, "length": feat_lens
    })

    T = int(enc_lens[0])
    batch = 1

    # Decoder LSTM states
    state1 = np.zeros((2, batch, 640), dtype=np.float32)
    state2 = np.zeros((2, batch, 640), dtype=np.float32)

    # Start with blank
    last_token = BLANK_ID
    target = np.array([[last_token]], dtype=np.int32)
    target_len = np.array([1], dtype=np.int32)

    tokens = []
    t = 0
    max_blanks = 0

    while t < T:
        enc_frame = enc_out[:, :, t:t+1]

        try:
            outputs, _, new_s1, new_s2 = dec_sess.run(None, {
                "encoder_outputs": enc_frame,
                "targets": target,
                "target_length": target_len,
                "input_states_1": state1,
                "input_states_2": state2,
            })
        except Exception:
            t += 1
            continue

        # outputs: [1, 1, 1, 8198] — squeeze to [8198]
        logits = outputs.flatten()

        if len(logits) != TOTAL_OUTPUT:
            # Unexpected shape — try to handle
            if len(logits) >= VOCAB_SIZE:
                token_logits = logits[:VOCAB_SIZE]
                token_id = int(np.argmax(token_logits))
                dur = 1
            else:
                t += 1
                continue
        else:
            # Split into vocab logits and duration logits
            token_logits = logits[:VOCAB_SIZE]
            dur_logits = logits[VOCAB_SIZE:VOCAB_SIZE + NUM_DURATIONS]

            token_id = int(np.argmax(token_logits))
            dur = int(np.argmax(dur_logits))

        if token_id == BLANK_ID:
            # Blank — advance by predicted duration
            t += max(1, dur)
            max_blanks += 1
            if max_blanks > T * 2:
                break
            continue

        max_blanks = 0

        # Get token string
        tok_str = vocab.get(token_id, "")
        if not tok_str or (tok_str.startswith("<") and tok_str.endswith(">")):
            # Special token — skip
            t += max(1, dur)
            continue

        tokens.append({
            "token": tok_str,
            "token_id": token_id,
            "time": frame_to_sec(t),
            "frame": t,
        })

        # Update decoder state
        state1 = new_s1
        state2 = new_s2
        last_token = token_id
        target = np.array([[token_id]], dtype=np.int32)

        # Advance by duration
        t += max(1, dur)

    return tokens


def tokens_to_words(tokens: List[dict]) -> List[dict]:
    """Merge SentencePiece tokens into words."""
    words = []
    current_word = ""
    current_start = 0.0

    for i, tok in enumerate(tokens):
        text = tok["token"]

        if text.startswith("\u2581"):  # ▁ = word boundary
            if current_word:
                words.append({
                    "word": current_word,
                    "start": current_start,
                    "end": tok["time"],
                })
            current_word = text[1:]  # strip ▁
            current_start = tok["time"]
        else:
            current_word += text

    if current_word:
        end_time = tokens[-1]["time"] + 0.3 if tokens else current_start + 0.5
        words.append({"word": current_word, "start": current_start, "end": end_time})

    return words


def transcribe(audio_path: str) -> List[dict]:
    mel_sess, enc_sess, dec_sess = load_sessions()
    vocab = load_vocab()
    audio = load_audio(audio_path)
    tokens = greedy_decode_tdt(mel_sess, enc_sess, dec_sess, audio, vocab)
    return tokens_to_words(tokens)


def find_insider_trading(words: List[dict]) -> Optional[dict]:
    for i in range(len(words) - 1):
        w1 = words[i]["word"].lower().strip().rstrip(".,!?;:'\"")
        w2 = words[i + 1]["word"].lower().strip().rstrip(".,!?;:'\"")
        if w1 == "insider" and w2 == "trading":
            return {
                "insider_start": words[i]["start"],
                "insider_end": words[i]["end"],
                "trading_start": words[i + 1]["start"],
                "trading_end": words[i + 1]["end"],
            }
    return None


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <audio_or_video_file>")
        sys.exit(1)

    words = transcribe(sys.argv[1])
    print(f"Transcription ({len(words)} words):")
    for w in words:
        print(f"  [{w['start']:.3f}s - {w['end']:.3f}s] {w['word']}")

    result = find_insider_trading(words)
    if result:
        print(f"\nFOUND 'insider trading':")
        print(f"  insider: {result['insider_start']:.3f}s - {result['insider_end']:.3f}s")
        print(f"  trading: {result['trading_start']:.3f}s - {result['trading_end']:.3f}s")
    else:
        print("\n'insider trading' NOT FOUND")
