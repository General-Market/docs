#!/usr/bin/env python3
"""
Rebuild the cut list cleanly, at the word level, to kill all rollbacks.

Start from the human-curated beats (anticheat-cuts.before-stutter-clean.json),
then for the whole timeline:

  1. Walk beats in order. Assign each transcript word to AT MOST ONE beat —
     a word already consumed by an earlier beat can never replay. This kills
     cross-segment rollbacks (the "…BPS. / BPS. But every exchange" echoes).

  2. Inside each beat, drop stutter runs: find the longest repeated phrase
     (3–6 words, no clause punctuation between repeats = not anaphora, and
     dropping < 4s), and remove everything from the FIRST occurrence up to
     the LAST occurrence. Keeps only the final take. This kills the
     "…priority in / in some exchanges" and "all 13 and / and this is all"
     echoes because the duplicate words are deleted, not split onto a seam.

  3. Split the surviving words wherever there's a silence gap > 1.2s, so no
     dead air longer than that survives inside a segment.

  4. Snap every segment to word boundaries with a tiny, asymmetric pad
     (0.06s lead, 0.12s tail) — no partial/orphan words.

Writes cuts.json.
"""
import json
import re
import shutil
from difflib import SequenceMatcher
from pathlib import Path

SRC_BEATS = Path("/tmp/anticheat-cuts.before-stutter-clean.json")
ALIGNED   = Path("/tmp/anticheat-aligned-merged.json")
CUTS      = Path("/Users/maxguillabert/Downloads/index/video/src/compositions/anticheat-edit/cuts.json")
CARDS     = Path("/tmp/title-cards/cards.json")

LEAD_PAD = 0.10             # capture word onsets — 0.06 was clipping ("of", sentence starts)
TAIL_PAD = 0.12              # mid-sentence tail: tight, trims hesitations
SENT_END_PAD = 0.30         # breath kept at a sentence end (don't feel rushed)
HESITATION_GAP = 0.70       # trim only LONGER pauses — 0.45 confettied halting sentences
HARD_SPLIT = 2.5
MIN_SEG = 0.30

MIN_PHRASE_LEN = 2          # catch short stutters: "than this", "it's like", "and and"
MAX_PHRASE_LEN = 6
TAIL_RATIO_TRIGGER = 1.8
MIN_LAST_TAIL_WORDS = 2
MAX_DROP_SECS = 4.0
RESTART_GAP_WORDS = 3       # if >this many words sit between 2 occurrences, it's
                            # only a stutter if the continuations match (else it's
                            # two parallel clauses — e.g. "you have a strategy …
                            # you have a market maker" — and must NOT be dropped)

PUNCT_RX = re.compile(r"[^\w']+", re.UNICODE)
CLAUSE_END_RX = re.compile(r"[,;.?!:]$")


def norm(w):
    return PUNCT_RX.sub("", w.lower())


def collect_words(aligned):
    out = []
    for s in aligned["segments"]:
        for w in s.get("words", []):
            if "start" in w and "end" in w and "word" in w:
                out.append({
                    "word": w["word"],
                    "start": float(w["start"]),
                    "end": float(w["end"]),
                    "punct": bool(CLAUSE_END_RX.search(w["word"].strip())),
                    "sent_end": bool(re.search(r"[.!?]$", w["word"].strip())),
                })
    return out


def find_stutter_drop(ws):
    """Return (first_idx, last_idx) to drop [first_idx, last_idx) keeping the
    last occurrence, or None. Same logic as the standalone cleaner."""
    n = len(ws)
    if n < MIN_PHRASE_LEN * 2 + MIN_LAST_TAIL_WORDS:
        return None
    nw = [norm(w["word"]) for w in ws]
    best = None
    # Check ALL phrase lengths; rank by occurrence count first, then length,
    # so a 3× short phrase beats a 2× longer one (otherwise we'd drop only
    # two of three repeated takes and leave the first stranded).
    for L in range(MAX_PHRASE_LEN, MIN_PHRASE_LEN - 1, -1):
        positions = {}
        for i in range(n - L + 1):
            ph = tuple(nw[i:i + L])
            if not all(ph):
                continue
            positions.setdefault(ph, []).append(i)
        for ph, pos in positions.items():
            if len(pos) < 2:
                continue
            # Anaphora guard: clause punctuation between repeats → skip.
            anaphora = False
            for k in range(len(pos) - 1):
                if any(w["punct"] for w in ws[pos[k] + L: pos[k + 1]]):
                    anaphora = True
                    break
            if anaphora:
                continue
            tails = []
            for k, p in enumerate(pos):
                a = p + L
                b = pos[k + 1] if k + 1 < len(pos) else n
                tails.append(max(0, b - a))
            last_tail, earlier = tails[-1], tails[:-1]
            if not earlier or last_tail < MIN_LAST_TAIL_WORDS:
                continue
            avg = sum(earlier) / len(earlier)
            if avg > 0 and last_tail < TAIL_RATIO_TRIGGER * avg:
                continue
            # Occurrences dominate, then phrase length, then tail ratio.
            score = len(pos) * 1000 + L * 10 + last_tail / max(1, avg)
            cand = (score, pos[0], pos[-1], len(pos))
            if best is None or cand[0] > best[0]:
                best = cand
    if not best:
        return None
    _, first, last, n_occ = best
    L = last - first  # not the phrase length, but words spanned; recompute phrase len:
    # Recover phrase length from the matched candidate via the gap structure.
    # (first and last are start indices of the first/last occurrence.)
    phrase_len = None
    nw = [norm(w["word"]) for w in ws]
    for cand_L in range(MAX_PHRASE_LEN, MIN_PHRASE_LEN - 1, -1):
        if nw[first:first + cand_L] == nw[last:last + cand_L] and all(nw[first:first + cand_L]):
            phrase_len = cand_L
            break
    if phrase_len is None:
        return None

    # Drop guard uses *speech* time, not wall-clock.
    dropped_speech = sum(w["end"] - w["start"] for w in ws[first:last])

    if n_occ == 2:
        gap_words = last - (first + phrase_len)
        # When lots of content sits between the two occurrences, this is only a
        # real restart if what FOLLOWS each occurrence is similar. If the
        # continuations differ, it's two parallel clauses ("you have a strategy"
        # / "you have a market maker") — dropping would butcher the sentence.
        if gap_words > RESTART_GAP_WORDS:
            after_first = nw[first + phrase_len: first + phrase_len + 4]
            after_last = nw[last + phrase_len: last + phrase_len + 4]
            sim = SequenceMatcher(None, after_first, after_last).ratio()
            if sim < 0.5:
                return None
        if dropped_speech > MAX_DROP_SECS:
            return None
    return first, last


def collapse_immediate_repeats(ws):
    """Remove ADJACENT duplicate phrases: words[i:i+k] == words[i+k:i+2k].
    Catches "than this than this", "it's like it's like", "and you will be and
    you will be", "maxing out advantages, maxing out advantages", "and and".
    (find_stutter_drop only handles scattered/progressive restarts, not these.)"""
    nw = [norm(w["word"]) for w in ws]
    out, i, n = [], 0, len(ws)
    SINGLE_OK = {"and", "the", "is", "that", "to", "a", "it's", "its", "you", "of", "so", "i"}
    while i < n:
        collapsed = False
        for k in range(4, 0, -1):
            if i + 2 * k > n:
                continue
            if not all(nw[i:i + k]):
                continue
            if nw[i:i + k] == nw[i + k:i + 2 * k]:
                if k == 1 and nw[i] not in SINGLE_OK:
                    continue
                i += k  # drop the first copy; keep the (identical) second
                collapsed = True
                break
        if not collapsed:
            out.append(ws[i]); i += 1
    return out


def collapse_near_repeats(ws):
    """Drop CLOSE reformulations: a phrase (>=3 words) that repeats within a
    small word-gap with NO clause punctuation between (so not anaphora). Keep
    the second take. Catches "to react to the market AND SO YOU WILL FIRST to
    react to the market" — which find_stutter_drop's tail-ratio test rejects."""
    nw = [norm(w["word"]) for w in ws]
    n = len(ws)
    changed = True
    while changed and n >= 6:
        changed = False
        for L in range(6, 2, -1):
            for i in range(n - L + 1):
                a = nw[i:i + L]
                if not all(a):
                    continue
                hit = None
                for j in range(i + L, min(i + L + 9, n - L + 1)):
                    if nw[j:j + L] == a:
                        # anaphora guard: clause punctuation between → keep both
                        if any(ws[k].get("punct") for k in range(i + L, j)):
                            break
                        hit = j
                        break
                if hit is not None:
                    ws = ws[:i] + ws[hit:]
                    nw = [norm(w["word"]) for w in ws]
                    n = len(ws)
                    changed = True
                    break
            if changed:
                break
    return ws


def runs_from_words(words):
    """Split a word list into runs at every inter-word pause > HESITATION_GAP.
    Each split becomes a segment boundary; because segments are concatenated in
    the bake, the pause itself is trimmed to LEAD_PAD+tail. Mid-sentence pauses
    get a tight tail (hesitation removed); sentence-end pauses keep a breath
    (SENT_END_PAD) so the talk doesn't feel rushed. The per-boundary tail is
    decided in main() from each run's last-word sent_end flag."""
    if not words:
        return []
    runs, cur = [], [words[0]]
    for prev, w in zip(words, words[1:]):
        if w["start"] - prev["end"] > HESITATION_GAP:
            runs.append(cur)
            cur = []
        cur.append(w)
    runs.append(cur)
    return runs


TITLE_FILLER = {"the", "a", "an", "unfair", "and", "fair", "giant", "of"}
# words the speaker tacks onto a spoken title that aren't in the card text
TITLE_TAIL = {"boundary", "quirks", "moves", "program", "programs", "flows"}


def title_content(name):
    toks = [norm(t) for t in re.split(r"[\s&\-/]+", name)]
    return [t for t in toks if t and t not in TITLE_FILLER]


def trim_slide_repeats(segs, words):
    """After each title card, if the segment that plays opens by restating the
    card title, advance its start past that title phrase (the slide already
    shows it). If the whole segment is just the title, drop it (MIN_SEG)."""
    if not CARDS.exists():
        return segs
    cards = json.load(open(CARDS))["cards"]
    for c in cards:
        title_toks = set(title_content(c["name"]))
        if not title_toks:
            continue
        for seg in segs:
            if seg["start"] < c["trigger"] - 0.01:
                continue
            sw = [w for w in words
                  if seg["start"] - 0.05 <= 0.5 * (w["start"] + w["end"]) <= seg["end"] + 0.05]
            if not sw:
                break
            snw = [norm(w["word"]) for w in sw]
            # The segment must OPEN with a title word (within first 4) to qualify.
            if not any(snw[k] in title_toks for k in range(min(4, len(snw)))):
                break
            # Walk past the leading run of title words + light fillers.
            j, saw_title = 0, False
            while j < len(snw):
                t = snw[j]
                if t in title_toks:
                    saw_title = True; j += 1; continue
                if t in TITLE_FILLER:
                    j += 1; continue
                if saw_title and t in TITLE_TAIL:
                    j += 1; continue
                break
            if saw_title and 0 < j < len(sw):
                new_start = sw[j]["start"] - LEAD_PAD
                if new_start > seg["start"] + 0.05:
                    seg["start"] = round(new_start, 3)
            elif saw_title and j >= len(sw):
                seg["start"] = seg["end"]  # whole segment is the title → drop
            break
    return [s for s in segs if s["end"] - s["start"] >= MIN_SEG]


BARE_DROP = {"and", "or", "but", "so", "the", "a", "to", "for", "if", "than"}
DANGLING_TAIL = {"for", "but", "or"}
SECTION_BREATH = 0.40       # extra breath before a spoken section title / CTA


def polish_boundaries(segs, words):
    """Generic cut-seam cleanup applied whole-video:
       1. drop a segment whose entire text is one bare conjunction ("and", "or")
       2. drop a segment's LAST word if it equals the NEXT segment's first word
          (doubled across the cut: "…The" + "The reason")
       3. drop a trailing clearly-abandoned conjunction (for/but/or)."""
    def seg_words(s):
        return [w for w in words
                if s["start"] - 0.05 <= 0.5 * (w["start"] + w["end"]) <= s["end"] + 0.05]

    # Pass 1: drop bare single-conjunction segments.
    kept = []
    for s in segs:
        nws = [norm(w["word"]) for w in seg_words(s) if norm(w["word"])]
        if len(nws) <= 1 and (not nws or nws[0] in BARE_DROP):
            continue
        kept.append(s)
    segs = kept

    # Pass 2 + 3: trim trailing doubled word / dangling conjunction.
    for i in range(len(segs)):
        sw = seg_words(segs[i])
        if len(sw) < 2:
            continue
        last = norm(sw[-1]["word"])
        drop_tail = False
        if i + 1 < len(segs):
            nxt = seg_words(segs[i + 1])
            if nxt and last and norm(nxt[0]["word"]) == last:
                drop_tail = True
        if not drop_tail and last in DANGLING_TAIL:
            drop_tail = True
        if drop_tail:
            # Stop before the dropped word — don't let the tail pad bleed into
            # it (e.g. "myself" and "The" only 0.02s apart).
            new_end = min(sw[-2]["end"] + TAIL_PAD, sw[-1]["start"] - 0.03)
            segs[i]["end"] = round(new_end, 3)

    return [s for s in segs if s["end"] - s["start"] >= MIN_SEG]


def add_section_breath(segs):
    """Add breath before each spoken section title (card triggers) + the CTA, so
    transitions don't run together."""
    if not CARDS.exists():
        return segs
    triggers = [c["trigger"] for c in json.load(open(CARDS))["cards"]]
    for trig in triggers:
        # the title segment is the first with start >= trigger; add breath to the
        # segment BEFORE it.
        for i in range(1, len(segs)):
            if segs[i]["start"] >= trig - 0.01:
                segs[i - 1]["end"] = round(segs[i - 1]["end"] + SECTION_BREATH, 3)
                break
    return segs


def main():
    beats = json.load(open(SRC_BEATS))["segments"]
    aligned = json.load(open(ALIGNED))
    words = collect_words(aligned)

    consumed_until = -1.0   # source time already used by an earlier segment
    out_segments = []

    for beat in beats:
        bs, be = float(beat["start"]), float(beat["end"])
        # Words whose midpoint is inside the beat AND not already consumed.
        ws = [w for w in words
              if bs - 0.05 <= 0.5 * (w["start"] + w["end"]) <= be + 0.05
              and w["start"] >= consumed_until]
        if len(ws) < 1:
            continue

        # Collapse adjacent duplicate phrases first ("than this than this").
        ws = collapse_immediate_repeats(ws)
        # Then drop CLOSE reformulations ("…to react to the market AND SO YOU
        # WILL FIRST to react to the market") — the rollback class.
        ws = collapse_near_repeats(ws)
        # Then drop scattered/progressive restarts (keep the last take).
        drop = find_stutter_drop(ws)
        if drop:
            first, last = drop
            ws = ws[:first] + ws[last:]

        # Split into runs at hesitation gaps; trim each pause tight, but keep a
        # breath where a sentence actually ended.
        for run in runs_from_words(ws):
            if not run:
                continue
            s = max(0.0, run[0]["start"] - LEAD_PAD, consumed_until)
            tail = SENT_END_PAD if run[-1].get("sent_end") else TAIL_PAD
            e = run[-1]["end"] + tail
            if e - s < MIN_SEG:
                continue
            out_segments.append({
                "start": round(s, 3),
                "end":   round(e, 3),
                "text":  " ".join(w["word"] for w in run).strip()[:90],
            })
            consumed_until = e

    # Final safety: enforce strictly increasing, non-overlapping ranges.
    cleaned = []
    for seg in out_segments:
        if cleaned and seg["start"] < cleaned[-1]["end"]:
            seg["start"] = round(cleaned[-1]["end"] + 0.001, 3)
        if seg["end"] - seg["start"] >= MIN_SEG:
            cleaned.append(seg)

    # Slide-repeat trim DISABLED — keep spoken titles (visual card is a Remotion
    # overlay now, not baked, so the spoken title isn't redundant).
    # Generic seam cleanup: doubled words, bare orphans, dangling conjunctions.
    cleaned = polish_boundaries(cleaned, words)
    # Re-enforce non-overlap after trims, then add section/CTA breath.
    fixed = []
    for seg in cleaned:
        if fixed and seg["start"] < fixed[-1]["end"]:
            seg["start"] = round(fixed[-1]["end"] + 0.001, 3)
        if seg["end"] - seg["start"] >= MIN_SEG:
            fixed.append(seg)
    cleaned = add_section_breath(fixed)

    kept = sum(s["end"] - s["start"] for s in cleaned)
    src_total = max(s["end"] for s in cleaned)
    out = {
        "source": "anticheat-edit/source.mp4",
        "duration_source": round(src_total, 3),
        "duration_cut": round(kept, 3),
        "ratio": round(kept / src_total, 3) if src_total else 0,
        "segments": cleaned,
        "stats": {
            "method": "word-level clean rebuild — rollbacks, hesitations, slide-repeats removed",
            "lead_pad": LEAD_PAD, "tail_pad": TAIL_PAD, "sent_end_pad": SENT_END_PAD,
            "hesitation_gap_s": HESITATION_GAP,
        },
    }
    json.dump(out, open(CUTS, "w"), indent=2, ensure_ascii=False)

    # Verify no overlaps remain.
    overlaps = sum(1 for a, b in zip(cleaned, cleaned[1:]) if b["start"] < a["end"])
    print(f"segments: {len(cleaned)}  (overlaps remaining: {overlaps})")
    print(f"kept: {kept:.1f}s before speedup ({kept/1.2:.1f}s at 1.2x = {kept/1.2/60:.1f} min)")
    print(f"-> {CUTS}")

    # ── VERIFICATION GATE: no phrase may replay within 4s of playback ─────────
    # (rollback protection — fails loudly so a bad cut never ships silently.)
    rolls = verify_no_close_repeats(cleaned, words)
    if rolls:
        print(f"\n!! ROLLBACK CHECK FAILED: {len(rolls)} phrase(s) replay within 4s:")
        for t1, t2, ph in rolls[:20]:
            print(f"   {t1}–{t2}  \"{ph}\"")
    else:
        print("rollback check: PASS (no phrase replays within 4s)")


def verify_no_close_repeats(segs, words, window_s=4.0, L=5):
    """Return list of (play1, play2, phrase) where a >=L-word phrase replays
    within window_s of playback. Anaphora (comma-separated) is exempted."""
    from collections import defaultdict
    RATE = 1.2
    play = 0.0
    stream = []
    for s in segs:
        sw = [w for w in words
              if s["start"] - 0.05 <= 0.5 * (w["start"] + w["end"]) <= s["end"] + 0.05]
        for w in sw:
            stream.append({
                "n": norm(w["word"]),
                "punct": bool(CLAUSE_END_RX.search(w["word"].strip())),
                "play": play + max(0.0, (w["start"] - s["start"]) / RATE),
            })
        play += (s["end"] - s["start"]) / RATE

    def fmt(t):
        return f"{int(t // 60)}:{t % 60:05.2f}"

    toks = [x["n"] for x in stream]
    seen = defaultdict(list)
    for i in range(len(toks) - L + 1):
        g = tuple(toks[i:i + L])
        if all(g):
            seen[g].append(i)
    rolls = []
    for g, pos in seen.items():
        for a, b in zip(pos, pos[1:]):
            if stream[b]["play"] - stream[a]["play"] <= window_s:
                # exempt anaphora: clause punctuation between the two
                if any(stream[k]["punct"] for k in range(a + L, b)):
                    continue
                rolls.append((fmt(stream[a]["play"]), fmt(stream[b]["play"]), " ".join(g)))
    return rolls


if __name__ == "__main__":
    main()
