"""Batch B — Emotional dimensions 18-34.

Regex, word lists, sentence-level analysis. No LLM calls. All numeric.
"""

import sys, re
sys.path.insert(0, "launch-video-analysis/ph/scripts")
from shared_utils import (
    load_transcripts, sentences, words, thirds,
    count_pattern, has_pattern, save_results, median,
)


# ── Word lists ──────────────────────────────────────────────────────────

SPECIFIC_EMOTIONS = [
    r"that sinking feeling",
    r"the rush when",
    r"the dread of",
    r"pit in (?:my|your|the) stomach",
    r"heart sinks?",
    r"eyes light up",
    r"gut[- ]wrenching",
    r"a wave of relief",
    r"sense of dread",
    r"burst of joy",
    r"knot in (?:my|your) (?:stomach|chest)",
    r"weight off (?:my|your) shoulders",
    r"rush of adrenaline",
    r"cold sweat",
    r"sick to (?:my|your) stomach",
    r"breath of fresh air",
    r"sigh of relief",
    r"moment of panic",
    r"spark of hope",
    r"feeling of dread",
    r"feeling of relief",
    r"moment of clarity",
    r"pang of guilt",
    r"sense of urgency",
    r"that aha moment",
    r"light at the end of the tunnel",
    r"butterflies in (?:my|your) stomach",
    r"on cloud nine",
    r"pulling (?:my|your) hair out",
    r"tearing (?:my|your) hair out",
    r"banging (?:my|your) head",
    r"losing (?:my|your) mind",
    r"going crazy",
    r"drove me (?:crazy|nuts|insane)",
    r"makes? (?:me|you) want to scream",
    r"wanted to cry",
    r"wanted to throw",
    r"a nightmare to",
    r"felt like pulling teeth",
]

GENERIC_EMOTIONS = [
    r"\bfrustrat\w*\b",
    r"\bhappy\b",
    r"\bsad\b",
    r"\bannoyed\b",
    r"\bangry\b",
    r"\bexcited\b",
    r"\bbored\b",
    r"\bscared\b",
    r"\bstressed\b",
    r"\banxious\b",
    r"\bupset\b",
    r"\bdisappointed\b",
    r"\bconfused\b",
    r"\boverwhelmed\b",
    r"\brelieved\b",
    r"\bsatisfied\b",
    r"\bdelighted\b",
    r"\bpleased\b",
    r"\bworried\b",
    r"\bnervous\b",
]

NEGATIVE_WORDS = {
    "problem", "pain", "struggle", "frustrat", "difficult", "hard", "broken",
    "slow", "confusing", "overwhelming", "tedious", "painful", "annoying",
    "hate", "waste", "lose", "losing", "lost", "fail", "failing", "failed",
    "error", "bug", "crash", "nightmare", "headache", "mess", "chaos",
    "complicated", "clunky", "cumbersome", "manual", "repetitive", "stressful",
    "terrible", "horrible", "awful", "worst", "suffer", "suffering", "dread",
    "boring", "blocker", "bottleneck", "outdated", "inefficient",
}

POSITIVE_WORDS = {
    "solution", "solve", "fix", "easy", "fast", "simple", "beautiful",
    "powerful", "seamless", "smart", "elegant", "smooth", "effortless",
    "automatic", "delightful", "intuitive", "clean", "love", "amazing",
    "great", "better", "best", "instant", "quick", "save", "saving",
    "perfect", "wonderful", "incredible", "awesome", "brilliant", "enjoy",
    "happy", "relief", "finally", "freedom", "empower",
}

PRIDE_PATTERNS = [
    r"you already know",
    r"as an expert",
    r"smart teams?",
    r"\bsavvy\b",
    r"you'?re the kind of",
    r"sophisticated",
    r"you understand",
    r"you'?re smart enough",
    r"talented",
    r"experienced",
    r"as a (?:professional|pro)\b",
    r"top teams?",
    r"best teams?",
    r"like you",
    r"people like you",
    r"you'?re already",
    r"you know how",
    r"you know what",
]

FOMO_PATTERNS = [
    r"competitors? are already",
    r"market is moving",
    r"don'?t get left behind",
    r"the future is",
    r"everyone is switching",
    r"falling behind",
    r"your competitors?",
    r"while you'?re still",
    r"already using",
    r"ahead of",
    r"don'?t miss",
    r"before (?:it'?s|its) too late",
    r"moving fast",
    r"the world is (?:moving|changing)",
    r"getting left behind",
    r"catch up",
    r"staying ahead",
    r"early adopter",
    r"first mover",
]

EMPATHY_FIRSTHAND_PATTERNS = [
    r"\bi spent\b",
    r"\bi was frustrat",
    r"\bwe struggled\b",
    r"\bi personally\b",
    r"\bi used to\b",
    r"\bi had to\b",
    r"\bwhen i was\b",
    r"\bi tried\b",
    r"\bi realized\b",
    r"\bi found myself\b",
    r"\bi couldn'?t\b",
    r"\bi knew\b",
    r"\bmy own\b",
    r"\bi experienced\b",
    r"\bi dealt with\b",
    r"\bi went through\b",
    r"\bi remember\b",
    r"\bwe faced\b",
    r"\bwe had to\b",
    r"\bwe were spending\b",
    r"\bwe built this because\b",
    r"\bi built\b",
    r"\bi was tired\b",
    r"\bwe were tired\b",
    r"\bi hated\b",
    r"\bwe hated\b",
]

EMPATHY_OBSERVED_PATTERNS = [
    r"teams? struggle",
    r"people spend",
    r"companies waste",
    r"users? hate",
    r"developers? face",
    r"teams? spend",
    r"people waste",
    r"everyone (?:knows?|hates?|struggles?)",
    r"most (?:teams?|people|companies|developers?)",
    r"many (?:teams?|people|companies|developers?)",
    r"(?:teams?|people|companies) (?:are|is) (?:spending|wasting|struggling)",
    r"you'?ve (?:probably|likely)",
    r"we'?ve all",
    r"you know (?:how|that) (?:feeling|frustrat|pain)",
    r"if you'?ve ever",
    r"sound familiar",
]

FRUSTRATION_VOCAB = [
    "tedious", "painful", "broken", "slow", "confusing", "overwhelming",
    "repetitive", "clunky", "messy", "annoying", "cumbersome", "complicated",
    "error-prone", "time-consuming", "manual", "boring", "frustrating",
    "stressful", "chaotic", "nightmare", "headache", "bottleneck", "blocker",
    "outdated", "inefficient",
]

JOY_WORDS = {
    "fast", "easy", "beautiful", "powerful", "simple", "instant", "seamless",
    "smart", "elegant", "smooth", "effortless", "automatic", "delightful",
    "intuitive", "clean",
}

VULNERABILITY_PATTERNS = [
    r"we tried and failed",
    r"it wasn'?t easy",
    r"we made mistakes",
    r"not perfect",
    r"we struggled",
    r"honestly",
    r"to be transparent",
    r"we learned the hard way",
    r"i'?ll be honest",
    r"truth is",
    r"i'?ll admit",
    r"we were wrong",
    r"we failed",
    r"it broke",
    r"we didn'?t know",
    r"in hindsight",
    r"looking back",
    r"our mistake",
    r"it'?s not perfect",
    r"we'?re still (?:learning|working|figuring)",
]

ANTICIPATORY_PATTERNS = [
    r"wait (?:until|till) you see",
    r"you'?re going to love",
    r"here'?s the (?:exciting|cool|best|fun) part",
    r"get ready",
    r"the magic happens?",
    r"watch this",
    r"check this out",
    r"let me show you (?:something|what|how)",
    r"you won'?t believe",
    r"wait for it",
    r"here'?s where (?:it|things) get",
    r"this is where",
    r"the cool (?:thing|part)",
    r"but here'?s the (?:thing|kicker|trick)",
    r"you'?ll (?:love|see|notice)",
    r"and here'?s",
]

SOCIAL_BELONGING_PATTERNS = [
    r"join \w+ (?:developers?|teams?|users?|companies|people|founders?|creators?)",
    r"community of",
    r"thousands of (?:teams?|users?|companies|people|developers?)",
    r"join the movement",
    r"part of",
    r"\bfellow\b",
    r"like-?minded",
    r"\btribe\b",
    r"family of (?:users?|teams?|customers?)",
    r"growing community",
    r"trusted by",
    r"used by (?:\d|thousands|hundreds|millions)",
    r"loved by",
    r"built for teams?",
    r"together",
]

LOSS_WORDS = [
    r"\blosing\b", r"\bwasting\b", r"\bmissing out\b", r"\bcosting you\b",
    r"\bthrowing away\b", r"\bbleeding\b", r"\blost\b", r"\bwaste\b",
    r"\blose\b", r"\bcost(?:s|ing)?\b", r"\bmiss(?:ed|ing)?\b",
]

GAIN_WORDS = [
    r"\bsaving\b", r"\bearning\b", r"\bgaining\b", r"\bwinning\b",
    r"\bgetting\b", r"\bachieving\b", r"\bsave\b", r"\bearn\b",
    r"\bgain\b", r"\bwin\b", r"\bget\b", r"\bachieve\b",
]

SURPRISE_PATTERNS = [
    r"oh and it also",
    r"\bbonus\b",
    r"cherry on top",
    r"one more thing",
    r"but that'?s not all",
    r"and the best part",
    r"did i mention",
    r"\bplus\b",
    r"and on top of (?:that|it)",
    r"but wait",
    r"there'?s more",
    r"and it (?:also|even)",
    r"not only that",
    r"as if that (?:wasn|weren)",
    r"oh and",
]

CONFIDENCE_WORDS = [
    r"\bwill\b", r"\balways\b", r"\bdefinitely\b", r"\bguaranteed?\b",
    r"\babsolutely\b", r"\bclearly\b", r"\bobviously\b", r"\bcertainly\b",
    r"\bproven\b", r"\bensures?\b", r"\bnever\b", r"\bevery\b",
    r"\bwithout (?:a )?doubt\b", r"\bno question\b",
]

FINALLY_PATTERNS = [
    r"\bfinally\b",
    r"\bat last\b",
    r"it'?s about time",
    r"\bno more\b",
    r"\bnever again\b",
    r"say goodbye to",
    r"the wait is over",
    r"put an end to",
    r"once and for all",
    r"goodbye to",
    r"done with",
    r"forget about",
    r"stop (?:wasting|spending|losing|worrying)",
    r"end of",
]


# ── Helpers ─────────────────────────────────────────────────────────────

def _sent_has_negative(sent):
    w = sent.lower()
    for nw in NEGATIVE_WORDS:
        if nw in w:
            return True
    return False


def _sent_has_positive(sent):
    w = sent.lower()
    for pw in POSITIVE_WORDS:
        if pw in w:
            return True
    return False


def _count_wordset_in(text, wordset):
    """Count how many words from wordset appear in text."""
    wlist = words(text)
    return sum(1 for w in wlist if w in wordset)


def _count_patterns_in(text, patterns):
    """Count total pattern matches in text."""
    t = text.lower()
    total = 0
    for p in patterns:
        total += len(re.findall(p, t))
    return total


# ── Dimension extractors ────────────────────────────────────────────────

def dim_emotion_specificity(transcript):
    """18. Ratio of specific to generic emotional language."""
    t = transcript.lower()
    specific = sum(len(re.findall(p, t)) for p in SPECIFIC_EMOTIONS)
    generic = sum(len(re.findall(p, t)) for p in GENERIC_EMOTIONS)
    return round(specific / (specific + generic + 1), 4)


def dim_relief_distance(transcript):
    """19. Avg sentences between tension and relief."""
    sents = sentences(transcript)
    if len(sents) < 2:
        return 0.0
    distances = []
    last_negative_idx = None
    for i, s in enumerate(sents):
        if _sent_has_negative(s):
            last_negative_idx = i
        elif _sent_has_positive(s) and last_negative_idx is not None:
            distances.append(i - last_negative_idx)
            last_negative_idx = None  # consume it
    if not distances:
        return 0.0
    return round(sum(distances) / len(distances), 4)


def dim_pride_trigger(transcript):
    """20. Count of flattery/capability language."""
    return count_pattern(transcript, PRIDE_PATTERNS)


def dim_fomo_construction(transcript):
    """21. Fear of being left behind."""
    return count_pattern(transcript, FOMO_PATTERNS)


def dim_empathy_firsthand(transcript):
    """22. First-person suffering (0/1)."""
    return 1 if has_pattern(transcript, EMPATHY_FIRSTHAND_PATTERNS) else 0


def dim_empathy_observed(transcript):
    """23. Third-person suffering (0/1)."""
    return 1 if has_pattern(transcript, EMPATHY_OBSERVED_PATTERNS) else 0


def dim_frustration_vocabulary_breadth(transcript):
    """24. Count of DISTINCT frustration words used."""
    t = transcript.lower()
    found = set()
    for word in FRUSTRATION_VOCAB:
        # Handle multi-word entries like "error-prone", "time-consuming"
        if re.search(r'\b' + re.escape(word) + r'\b', t):
            found.add(word)
    return len(found)


def dim_joy_velocity_shift(transcript):
    """25. Positive word density in second half minus first half."""
    wlist = words(transcript)
    n = len(wlist)
    if n < 10:
        return 0.0
    mid = n // 2
    first_half = wlist[:mid]
    second_half = wlist[mid:]
    first_pos = sum(1 for w in first_half if w in JOY_WORDS)
    second_pos = sum(1 for w in second_half if w in JOY_WORDS)
    # Normalize by respective word counts
    first_rate = first_pos / len(first_half) if first_half else 0
    second_rate = second_pos / len(second_half) if second_half else 0
    return round(second_rate - first_rate, 6)


def dim_vulnerability_moment(transcript):
    """26. Speaker admits failure/limitation (0/1)."""
    return 1 if has_pattern(transcript, VULNERABILITY_PATTERNS) else 0


def dim_anticipatory_emotion(transcript):
    """27. Dopamine priming count."""
    return count_pattern(transcript, ANTICIPATORY_PATTERNS)


def dim_social_belonging(transcript):
    """28. Community/tribe language count."""
    return count_pattern(transcript, SOCIAL_BELONGING_PATTERNS)


def dim_loss_aversion_framing(transcript):
    """29. Ratio of loss to gain language. 0.5 = balanced."""
    loss_count = _count_patterns_in(transcript, LOSS_WORDS)
    gain_count = _count_patterns_in(transcript, GAIN_WORDS)
    total = loss_count + gain_count
    if total == 0:
        return 0.5
    return round(loss_count / total, 4)


def dim_surprise_delight(transcript):
    """30. Late reveals count."""
    return count_pattern(transcript, SURPRISE_PATTERNS)


def dim_confidence_gradient(transcript):
    """31. Confidence words in last third minus first third, normalized."""
    sents = sentences(transcript)
    t = thirds(sents)
    first_text = " ".join(t[0])
    last_text = " ".join(t[2])
    first_wc = max(len(words(first_text)), 1)
    last_wc = max(len(words(last_text)), 1)
    first_conf = _count_patterns_in(first_text, CONFIDENCE_WORDS)
    last_conf = _count_patterns_in(last_text, CONFIDENCE_WORDS)
    return round(last_conf / last_wc - first_conf / first_wc, 6)


def dim_emotional_contrast_ratio(transcript):
    """32. Max negative sentence vs max positive sentence spread."""
    sents = sentences(transcript)
    if not sents:
        return 0.0
    max_neg = 0
    max_pos = 0
    for s in sents:
        wlist = words(s)
        if not wlist:
            continue
        neg = sum(1 for w in wlist if w in NEGATIVE_WORDS)
        pos = sum(1 for w in wlist if w in POSITIVE_WORDS)
        max_neg = max(max_neg, neg)
        max_pos = max(max_pos, pos)
    return float(max_neg + max_pos)


def dim_finally_signal(transcript):
    """33. Long-awaited relief count."""
    return count_pattern(transcript, FINALLY_PATTERNS)


def dim_empathy_depth(firsthand, observed, frustration_breadth):
    """34. Composite: (firsthand*2 + observed*1 + breadth/25) / 3."""
    return round((firsthand * 2 + observed * 1 + frustration_breadth / 25) / 3, 4)


# ── Main ────────────────────────────────────────────────────────────────

def extract_all(item):
    t = item["transcript"]
    firsthand = dim_empathy_firsthand(t)
    observed = dim_empathy_observed(t)
    frust_breadth = dim_frustration_vocabulary_breadth(t)

    return {
        "id": item["id"],
        "emotion_specificity": dim_emotion_specificity(t),
        "relief_distance": dim_relief_distance(t),
        "pride_trigger": dim_pride_trigger(t),
        "fomo_construction": dim_fomo_construction(t),
        "empathy_firsthand": firsthand,
        "empathy_observed": observed,
        "frustration_vocabulary_breadth": frust_breadth,
        "joy_velocity_shift": dim_joy_velocity_shift(t),
        "vulnerability_moment": dim_vulnerability_moment(t),
        "anticipatory_emotion": dim_anticipatory_emotion(t),
        "social_belonging": dim_social_belonging(t),
        "loss_aversion_framing": dim_loss_aversion_framing(t),
        "surprise_delight": dim_surprise_delight(t),
        "confidence_gradient": dim_confidence_gradient(t),
        "emotional_contrast_ratio": dim_emotional_contrast_ratio(t),
        "finally_signal": dim_finally_signal(t),
        "empathy_depth": dim_empathy_depth(firsthand, observed, frust_breadth),
    }


def main():
    items = load_transcripts()
    print(f"Processing {len(items)} transcripts...")

    results = []
    for item in items:
        results.append(extract_all(item))

    save_results("batch_b_emotion", results)
    print(f"Saved {len(results)} results to v2-parts/batch_b_emotion.json")

    # ── Summary stats ───────────────────────────────────────────────
    dims = [k for k in results[0].keys() if k != "id"]
    print(f"\n{'Dimension':<35} {'Min':>8} {'Med':>8} {'Max':>8} {'Mean':>8} {'>0':>6}")
    print("-" * 80)
    for dim in dims:
        vals = [r[dim] for r in results]
        mn = min(vals)
        mx = max(vals)
        med = median(vals)
        avg = sum(vals) / len(vals)
        nonzero = sum(1 for v in vals if v > 0)
        print(f"{dim:<35} {mn:>8.3f} {med:>8.3f} {mx:>8.3f} {avg:>8.3f} {nonzero:>6}")


if __name__ == "__main__":
    main()
