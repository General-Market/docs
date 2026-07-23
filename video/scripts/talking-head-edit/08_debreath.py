#!/usr/bin/env python3
"""
De-breath a baked voice track the way RX Breath Control / Waves DeBreath do:
find the non-speech regions and pull the inhale (and the little voiced "mm"
fillers that sit with it) down toward the room floor, while leaving every
spoken word untouched.

We don't classify breath-vs-speech spectrally — that is the part that fools a
blind gate. Instead we use a word-level transcript (parakeet/WhisperX) as
ground truth for where SPEECH is, merge the tokens into PHRASES (so the micro-
gaps between syllables are never touched), and only attenuate the gaps BETWEEN
phrases. The pads are asymmetric: we keep more room after a phrase (protect the
word's tail) and reach closer to the next phrase's onset (that is where the
inhale sits). A high speech ceiling is the safety net — if a "gap" is loud, the
transcript missed a word there and we leave it alone.

The companion verifier (run after) re-transcribes the output and confirms the
word sequence is unchanged — that is the proof no speech was eaten.

Usage:
   python3 08_debreath.py INPUT.wav TRANSCRIPT.json OUTPUT.wav
"""
import argparse
import json

import numpy as np
import soundfile as sf

PHRASE_MERGE_S   = 0.25  # tokens closer than this are one phrase (no gap between)
MIN_GAP_S        = 0.10  # only duck inter-phrase gaps at least this long
TAIL_PAD_S       = 0.04  # protect the tail of the phrase that just ended
ONSET_PAD_S      = 0.015 # reach to here before the next phrase (catch the inhale)
FADE_MS          = 22.0  # raised-cosine taper into/out of the duck
TARGET_DBFS      = -50.0 # pull the breath peak down toward the room floor
MAX_ATTEN_DB     = -38.0 # never attenuate a gap by more than this
SPEECH_CEILING_DB = -8.0 # a gap louder than this is speech the transcript missed
ATTEN_FLOOR_DB   = 2.0   # skip gaps needing less than this much attenuation


def db_to_lin(db: float) -> float:
    return float(10.0 ** (db / 20.0))


def load_tokens(path: str):
    d = json.load(open(path))
    toks = []
    if "sentences" in d:
        for s in d["sentences"]:
            for t in s.get("tokens", []):
                st = float(t["start"])
                toks.append((st, st + float(t.get("duration", 0.0))))
    else:
        for s in d.get("segments", []):
            for w in s.get("words", []):
                if "start" in w and "end" in w:
                    toks.append((float(w["start"]), float(w["end"])))
    toks.sort()
    return toks


def phrases_from_tokens(toks, merge_gap):
    """Merge tokens whose gap is below merge_gap into [start, end] phrases."""
    if not toks:
        return []
    out = [list(toks[0])]
    for st, en in toks[1:]:
        if st - out[-1][1] < merge_gap:
            out[-1][1] = max(out[-1][1], en)
        else:
            out.append([st, en])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("transcript")
    ap.add_argument("output")
    ap.add_argument("--target", type=float, default=TARGET_DBFS)
    ap.add_argument("--max-atten", type=float, default=MAX_ATTEN_DB)
    ap.add_argument("--ceiling", type=float, default=SPEECH_CEILING_DB)
    args = ap.parse_args()

    audio, sr = sf.read(args.input, always_2d=False, dtype="float32")
    mono = audio if audio.ndim == 1 else audio.mean(axis=1)
    n = len(mono)
    phrases = phrases_from_tokens(load_tokens(args.transcript), PHRASE_MERGE_S)
    if not phrases:
        raise SystemExit("no word timestamps in transcript")

    fade = max(1, int(sr * FADE_MS / 1000.0))
    tail_pad = int(sr * TAIL_PAD_S)
    onset_pad = int(sr * ONSET_PAD_S)
    max_atten_lin = db_to_lin(args.max_atten)

    gain = np.ones(n, dtype=np.float32)
    ducked = 0
    total = 0.0

    for (_, prev_end), (next_start, _) in zip(phrases, phrases[1:]):
        if next_start - prev_end < MIN_GAP_S:
            continue
        a = int(prev_end * sr) + tail_pad
        b = int(next_start * sr) - onset_pad
        if b - a < fade * 2 + 1:
            continue
        peak_db = 20.0 * np.log10(float(np.max(np.abs(mono[a:b]))) + 1e-9)
        if peak_db > args.ceiling:        # loud => speech the transcript missed
            continue
        atten_db = args.target - peak_db
        if atten_db >= -ATTEN_FLOOR_DB:   # already near the floor
            continue
        atten_lin = max(max_atten_lin, db_to_lin(atten_db))
        ramp = 0.5 * (1.0 - np.cos(np.linspace(0, np.pi, fade)))   # 0->1
        in_fade = 1.0 - ramp * (1.0 - atten_lin)                   # 1->atten
        gain[a:a + fade] = np.minimum(gain[a:a + fade], in_fade)
        gain[a + fade:b - fade] = np.minimum(gain[a + fade:b - fade], atten_lin)
        gain[b - fade:b] = np.minimum(gain[b - fade:b], in_fade[::-1])
        ducked += 1
        total += atten_db

    g = gain if audio.ndim == 1 else gain[:, None]
    sf.write(args.output, (audio * g).astype(np.float32), sr)
    print(f"ducked {ducked} inter-phrase gaps, mean atten "
          f"{total / max(1, ducked):.1f} dB -> {args.output}")


if __name__ == "__main__":
    main()
