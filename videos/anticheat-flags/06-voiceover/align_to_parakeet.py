#!/usr/bin/env python3
"""Find the best span for each script sentence inside a parakeet transcript,
accounting for retakes within the same take.

The speaker reads the script in one pass, and stumbles. They restart. Some
sentences appear two, three times in the parakeet output. The keeper is the
*best attempt* — usually the latest, but not always. This script finds *all*
candidate spans per sentence and picks the best one per take.

Algorithm — for each script sentence S of N words:
  1. Slide every starting position in parakeet.
  2. From each start, greedily match S's words against parakeet (allowing
     small skips for filler/hesitations).
  3. Score = matched_words / N.
  4. Drop candidates below min_score (default 0.6).
  5. Dedupe overlapping spans — when two spans cover roughly the same
     parakeet region, keep the higher-scoring one.
  6. Among the kept candidates, pick the *best*: highest score, with a soft
     preference for *later* candidates (the speaker's correction).

The picker output for each sentence:
  - chosen   — the best candidate (start, end, score, duration in seconds)
  - candidates — all surviving candidates (for review / manual override)

Usage:
    align_to_parakeet.py <script-sentences.json> <parakeet-words.json> <output.json>
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

WORD_CHARS_RE = re.compile(r"[A-Za-z0-9']+(?:-[A-Za-z0-9']+)*")

# Tuning knobs
MIN_SCORE = 0.5           # candidate must match at least 50% of sentence words
MAX_LOOKAHEAD = 4         # parakeet words to skip when looking for next sentence word
WINDOW_MULTIPLIER = 2.5   # max window size as multiple of sentence length
OVERLAP_TOL = 3           # candidates whose ranges overlap by <= this many words deduped
LEAD_TOLERANCE = 3        # allow first 0..LEAD_TOLERANCE sentence words to be skipped at start


def normalise(word: str) -> str:
    word = word.lower().strip()
    word = word.replace("’", "'")
    word = word.strip("'\"-.,!?;:()")
    m = WORD_CHARS_RE.search(word)
    return m.group(0).lower() if m else ""


def find_candidates(sentence_words: list[str], parakeet_words: list[dict]) -> list[dict]:
    N = len(sentence_words)
    if N == 0 or not parakeet_words:
        return []

    parakeet_norm = [w["word_norm"] for w in parakeet_words]
    M = len(parakeet_norm)
    max_window = max(int(N * WINDOW_MULTIPLIER), N + 10)

    candidates: list[dict] = []

    # Quick filter — only consider starting positions where parakeet's word
    # matches one of the sentence's first LEAD_TOLERANCE+1 words. This still
    # lets us pick up matches when parakeet mistranscribed the very first
    # word (e.g. "he'd" → "it"), but skips most irrelevant positions.
    head_set = set(sentence_words[:LEAD_TOLERANCE + 1])

    for start in range(M):
        if parakeet_norm[start] not in head_set:
            continue
        # Figure out which sentence word index parakeet's `start` matches —
        # the greedy loop below begins from that sentence position.
        sent_start = 0
        for lookback in range(LEAD_TOLERANCE + 1):
            if lookback < N and parakeet_norm[start] == sentence_words[lookback]:
                sent_start = lookback
                break
        end_limit = min(M, start + max_window)
        matched: list[int] = []
        sent_i = sent_start
        para_i = start
        while sent_i < N and para_i < end_limit:
            sw = sentence_words[sent_i]
            pw = parakeet_norm[para_i]
            if sw == pw:
                matched.append(para_i)
                sent_i += 1
                para_i += 1
                continue
            # Look ahead in parakeet for the next sentence word (handle inserts)
            advanced = False
            for skip in range(1, MAX_LOOKAHEAD + 1):
                if para_i + skip < end_limit and parakeet_norm[para_i + skip] == sw:
                    para_i += skip + 1
                    matched.append(para_i - 1)
                    sent_i += 1
                    advanced = True
                    break
            if not advanced:
                # Skip the sentence word (handle parakeet miss)
                sent_i += 1

        score = len(matched) / N
        if score < MIN_SCORE or not matched:
            continue
        candidates.append({
            "start_idx": matched[0],
            "end_idx": matched[-1],
            "matched": len(matched),
            "total": N,
            "score": round(score, 3),
        })

    # Dedupe overlapping candidates. Sort by start, then keep the highest score
    # within each overlap cluster.
    candidates.sort(key=lambda c: (c["start_idx"], -c["score"]))
    deduped: list[dict] = []
    for c in candidates:
        if deduped and c["start_idx"] <= deduped[-1]["end_idx"] + OVERLAP_TOL:
            if c["score"] > deduped[-1]["score"]:
                deduped[-1] = c
            elif c["score"] == deduped[-1]["score"] and c["end_idx"] > deduped[-1]["end_idx"]:
                deduped[-1] = c
        else:
            deduped.append(c)
    return deduped


def pick_best(candidates: list[dict]) -> dict | None:
    if not candidates:
        return None
    # Prefer high score. If two are close (within 0.1), prefer the LATER one
    # (the speaker's correction is the keeper).
    best = candidates[0]
    for c in candidates[1:]:
        if c["score"] > best["score"] + 0.05:
            best = c
        elif c["score"] >= best["score"] - 0.1 and c["start_idx"] > best["start_idx"]:
            # Soft preference for later in time
            best = c
    return best


def enrich_candidate(cand: dict, parakeet_words: list[dict]) -> dict:
    start_w = parakeet_words[cand["start_idx"]]
    end_w = parakeet_words[cand["end_idx"]]
    text = " ".join(parakeet_words[i]["word"] for i in range(cand["start_idx"], cand["end_idx"] + 1))
    # Parakeet's TDT decoder can inflate a word's end-time to absorb the
    # silence before the next word. Clip the chosen end to just before the
    # next parakeet word's start so we don't drag silence into the slice.
    raw_end = end_w["end"]
    clipped_end = raw_end
    next_idx = cand["end_idx"] + 1
    if next_idx < len(parakeet_words):
        next_start = parakeet_words[next_idx]["start"]
        if next_start < raw_end:
            # The next word's start is *before* the previous word's stated end —
            # the previous end was inflated. Use the next word's start as the cap.
            clipped_end = max(start_w["start"] + 0.2, next_start - 0.05)
        else:
            # Normal case: clip to whichever is smaller (the natural word-end or
            # the next-word-start minus a 50 ms breathing pad).
            clipped_end = min(raw_end, next_start - 0.05)
    return {
        "start": round(start_w["start"], 3),
        "end": round(clipped_end, 3),
        "duration": round(clipped_end - start_w["start"], 3),
        "matched": cand["matched"],
        "total": cand["total"],
        "score": cand["score"],
        "parakeetText": text[:200],
        "parakeetWordCount": cand["end_idx"] - cand["start_idx"] + 1,
        "startIdx": cand["start_idx"],
        "endIdx": cand["end_idx"],
    }


def main() -> int:
    if len(sys.argv) < 4:
        print(
            f"Usage: {sys.argv[0]} <script-sentences.json> <parakeet-words.json> <output.json>",
            file=sys.stderr,
        )
        return 2

    script = json.loads(Path(sys.argv[1]).read_text())
    parakeet = json.loads(Path(sys.argv[2]).read_text())
    out_path = Path(sys.argv[3])

    # Normalise parakeet words once
    parakeet_words = []
    for w in parakeet["words"]:
        wn = normalise(w["word"])
        if not wn:
            continue
        parakeet_words.append({
            "word": w["word"],
            "word_norm": wn,
            "start": w["start"],
            "end": w["end"],
        })

    sentences_out: dict[str, dict] = {}
    total_with_match = 0
    total_with_multiple = 0

    for sentence in script["sentences"]:
        sid = sentence["id"]
        sentence_words = [normalise(w) for w in sentence["words"] if normalise(w)]
        cands = find_candidates(sentence_words, parakeet_words)
        best = pick_best(cands)

        sentences_out[sid] = {
            "chosen": enrich_candidate(best, parakeet_words) if best else None,
            "candidates": [enrich_candidate(c, parakeet_words) for c in cands],
            "candidateCount": len(cands),
        }
        if best is not None:
            total_with_match += 1
        if len(cands) > 1:
            total_with_multiple += 1

    out = {
        "source": sys.argv[2],
        "totalSentences": len(sentences_out),
        "sentencesWithMatch": total_with_match,
        "sentencesWithMultipleCandidates": total_with_multiple,
        "tuning": {
            "minScore": MIN_SCORE,
            "maxLookahead": MAX_LOOKAHEAD,
            "windowMultiplier": WINDOW_MULTIPLIER,
        },
        "sentences": sentences_out,
    }
    out_path.write_text(json.dumps(out, indent=2))
    print(
        f"Aligned {total_with_match}/{len(sentences_out)} sentences. "
        f"{total_with_multiple} have multiple candidates (retakes detected). "
        f"Wrote {out_path}"
    )
    weak = [sid for sid, v in sentences_out.items() if v["chosen"] is None]
    if weak:
        print(f"Sentences with no match: {len(weak)} — {', '.join(weak[:10])}{'…' if len(weak)>10 else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
