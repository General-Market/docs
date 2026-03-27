"""Batch D — Wording dimensions (52-67) for PH launch transcripts."""

import sys, os, re, math
sys.path.insert(0, os.path.dirname(__file__))

from shared_utils import (
    load_transcripts, sentences, words, word_count,
    thirds, median, save_results, count_pattern, has_pattern
)

# ── Word banks ────────────────────────────────────────────────────

HIGH_ENERGY_VERBS = {
    "launch", "crush", "ship", "build", "create", "power", "drive",
    "boost", "supercharge", "accelerate", "transform", "unleash",
    "ignite", "dominate", "conquer", "smash", "nail", "tackle",
}

LOW_ENERGY_VERBS = {
    "utilize", "implement", "facilitate", "leverage", "optimize",
    "enable", "provide", "offer", "deliver", "manage", "maintain",
    "support", "handle", "process", "assist",
}

POWER_WORDS = {
    "instantly", "free", "new", "proven", "easy", "save", "discover",
    "results", "powerful", "beautiful", "fast", "secure", "unlimited",
    "exclusive", "complete", "smart", "automatic", "custom",
}

JARGON_WORDS = {
    "api", "sdk", "llm", "vector", "database", "algorithm", "pipeline",
    "infrastructure", "deployment", "microservice", "serverless",
    "webhook", "endpoint", "schema", "middleware", "runtime",
    "container", "gpu", "latency", "throughput", "cache", "token",
    "embedding",
}

SUPERLATIVES = [
    r"\bbest\b", r"\bmost\b", r"\bfastest\b", r"\bonly\b", r"\bfirst\b",
    r"\blargest\b", r"\bbiggest\b", r"\btop\b", r"\bleading\b",
    r"\bnumber one\b", r"#1", r"\bworld'?s\b", r"\bultimate\b",
    r"\bunmatched\b", r"\bunparalleled\b",
]

RICH_TRANSITIONS = [
    r"\bhere'?s? where it gets interesting\b",
    r"\bnow let'?s? talk about\b",
    r"\bthe real magic is\b",
    r"\bwhat makes this special\b",
    r"\bthis is where\b",
    r"\bbut the story doesn'?t end\b",
]

BASIC_TRANSITIONS = [
    r"^but\b", r"^and\b", r"^also\b", r"^so\b",
    r"^now\b", r"^next\b", r"^then\b",
]

NEGATION_BENEFIT_PATTERNS = [
    r"\bno \w+ needed\b",
    r"\bno \w+ required\b",
    r"\bwithout \w+\b",
    r"\bnever worry about\b",
    r"\bzero \w+\b",
    r"\beliminates? \w+\b",
    r"\bno more \w+\b",
    r"\bforget about \w+\b",
    r"\bsay goodbye to\b",
    r"\bno setup\b",
    r"\bno code\b",
    r"\bno learning curve\b",
]

VAGUE_QUALIFIERS = {
    "many", "a lot", "significant", "various", "several", "some",
    "multiple", "numerous", "great", "amazing",
}
# For multi-word matching we handle "a lot" separately
VAGUE_SINGLE = {
    "many", "significant", "various", "several", "some",
    "multiple", "numerous", "great", "amazing",
}

CLICHE_PATTERNS = [
    r"\bgame.?changer\b",
    r"\bone.?stop shop\b",
    r"\bend.?to.?end\b",
    r"\bbest.?in.?class\b",
    r"\bnext.?generation\b",
    r"\bcutting.?edge\b",
    r"\bstate of the art\b",
    r"\bseamless\b",
    r"\bfrictionless\b",
    r"\bholistic\b",
    r"\bsynergy\b",
    r"\bparadigm\b",
    r"\bdisrupt\b",
    r"\bleverage\b",
    r"\bunlock\b",
    r"\bempower\b",
    r"\brevolutionize\b",
    r"\breimagine\b",
]

CONDITIONAL_PATTERNS = [
    r"\bif you need\b",
    r"\bif you want\b",
    r"\bif you'?re looking for\b",
    r"\bwhether you\b",
    r"\bin case\b",
    r"\bwhen you need\b",
]

IMPERATIVE_STARTERS = {
    "try", "check", "visit", "see", "look", "click", "discover",
    "explore", "start", "join", "sign", "get", "download", "watch",
    "go", "stop", "imagine", "think", "create", "build", "use",
}

JUST_MINIMIZER_PATTERNS = [
    r"\bjust (click|drag|connect|add|type|select|paste|upload)\b",
    # Also catch "just" + any verb (broader): just + common verb
    r"\bjust [a-z]+(s|ed|ing)?\b",
]


# ── Helpers ───────────────────────────────────────────────────────

def stdev(vals):
    """Population standard deviation."""
    if len(vals) < 2:
        return 0.0
    mu = sum(vals) / len(vals)
    return math.sqrt(sum((v - mu) ** 2 for v in vals) / len(vals))


def mean(vals):
    if not vals:
        return 0.0
    return sum(vals) / len(vals)


def robust_sentences(text):
    """Sentence splitter that handles unpunctuated transcripts.
    Falls back to clause-level splitting when punctuation is absent."""
    sents = sentences(text)
    if len(sents) > 1:
        return sents
    # Unpunctuated transcript: split on conjunctions/clause boundaries
    # Split on common clause boundaries: commas, "and", "but", "so", "because", "when", "if", "or"
    # Use commas first if present
    if "," in text:
        parts = [p.strip() for p in text.split(",") if len(p.strip()) > 5]
        if len(parts) > 2:
            return parts
    # Otherwise split into ~10-word chunks (approximate spoken sentence length)
    wds = text.split()
    if len(wds) < 6:
        return sents
    chunk_size = 10
    chunks = []
    for i in range(0, len(wds), chunk_size):
        chunk = " ".join(wds[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks


# ── Extraction ────────────────────────────────────────────────────

def extract(tx):
    t = tx["transcript"]
    t_lower = t.lower()
    wds = words(t)
    wc = len(wds)
    sents = sentences(t)
    tds = thirds(sents)

    row = {"id": tx["id"]}

    # 52. verb_energy — ratio of high-energy verbs to (high + low + 1)
    high = sum(1 for w in wds if w in HIGH_ENERGY_VERBS)
    low = sum(1 for w in wds if w in LOW_ENERGY_VERBS)
    row["verb_energy"] = round(high / (high + low + 1), 4)

    # 53. sentence_rhythm_variance — stdev(sent_lengths) / mean(sent_lengths)
    # Use robust splitter to handle unpunctuated transcripts
    r_sents = robust_sentences(t)
    sent_lens = [len(words(s)) for s in r_sents]
    sent_lens = [sl for sl in sent_lens if sl > 0]
    if len(sent_lens) >= 2 and mean(sent_lens) > 0:
        row["sentence_rhythm_variance"] = round(stdev(sent_lens) / mean(sent_lens), 4)
    else:
        row["sentence_rhythm_variance"] = 0.0

    # 54. power_word_cluster_density — clusters of 3+ power words in 10-word windows, per 100 words
    cluster_count = 0
    if wc >= 10:
        for i in range(wc - 9):
            window = wds[i:i + 10]
            pw_in_window = sum(1 for w in window if w in POWER_WORDS)
            if pw_in_window >= 3:
                cluster_count += 1
    # Normalize: per 100 words
    row["power_word_cluster_density"] = round((cluster_count / max(wc, 1)) * 100, 4)

    # 55. jargon_distribution_shape — position of max jargon density (0.0, 0.5, 1.0)
    jargon_densities = []
    for third_sents in tds:
        if not third_sents:
            jargon_densities.append(0.0)
            continue
        total_jargon = 0
        for s in third_sents:
            s_words = words(s)
            total_jargon += sum(1 for w in s_words if w in JARGON_WORDS)
        jargon_densities.append(total_jargon / max(len(third_sents), 1))

    max_jd = max(jargon_densities)
    if max_jd == 0:
        row["jargon_distribution_shape"] = 0.5  # no jargon, default middle
    else:
        max_idx = jargon_densities.index(max_jd)
        row["jargon_distribution_shape"] = [0.0, 0.5, 1.0][max_idx]

    # 56. anaphora_count — sequences of 2+ consecutive sentences starting with same word/phrase
    anaphora = 0
    if len(sents) >= 2:
        i = 0
        while i < len(sents) - 1:
            s_words_i = words(sents[i])
            if not s_words_i:
                i += 1
                continue
            # Check first 1-3 words
            prefix = s_words_i[0]
            run = 1
            j = i + 1
            while j < len(sents):
                s_words_j = words(sents[j])
                if s_words_j and s_words_j[0] == prefix:
                    run += 1
                    j += 1
                else:
                    break
            if run >= 2:
                anaphora += 1
                i = j  # skip past the run
            else:
                i += 1
    row["anaphora_count"] = anaphora

    # 57. just_minimizer — "just" followed by a verb
    # More precise: "just" + verb from a common set
    just_verb_pattern = r"\bjust\s+(click|drag|connect|add|type|select|paste|upload|open|press|hit|tap|drop|enter|write|pick|choose|set|put|plug|turn|flip|switch|send|copy|run|do|go|say|ask|tell|take|make|give|move|start|try|use|check|grab|pull|push|scan|snap|swipe|share|link|sign|log)\b"
    row["just_minimizer"] = len(re.findall(just_verb_pattern, t_lower))

    # 58. superlative_density — superlatives per 100 words
    sup_count = count_pattern(t, SUPERLATIVES)
    row["superlative_density"] = round((sup_count / max(wc, 1)) * 100, 4)

    # 59. question_answer_pairs — question followed by short answer (<=8 words)
    qa_pairs = 0
    for i in range(len(sents) - 1):
        if sents[i].rstrip().endswith("?"):
            answer_words = len(words(sents[i + 1]))
            if 0 < answer_words <= 8:
                qa_pairs += 1
    row["question_answer_pairs"] = qa_pairs

    # 60. transition_sophistication — rich transitions / (rich + basic + 1)
    rich_ct = count_pattern(t, RICH_TRANSITIONS)
    # For basic transitions, check sentence starts
    basic_ct = 0
    for s in sents:
        s_low = s.lower().strip()
        for pat in BASIC_TRANSITIONS:
            if re.match(pat, s_low):
                basic_ct += 1
                break
    row["transition_sophistication"] = round(rich_ct / (rich_ct + basic_ct + 1), 4)

    # 61. negation_as_benefit
    row["negation_as_benefit"] = count_pattern(t, NEGATION_BENEFIT_PATTERNS)

    # 62. specificity_index — specific tokens / (specific + vague + 1)
    # Specific: numbers, capitalized words (proper nouns), percentages, dollar amounts
    numbers = len(re.findall(r"\b\d+[\d,.]*\b", t))
    percentages = len(re.findall(r"\d+%", t))
    dollars = len(re.findall(r"\$[\d,.]+", t))
    # Capitalized words (not sentence starts) — rough proxy for proper nouns
    cap_words = 0
    for s in sents:
        s_tokens = s.split()
        for tok_idx, tok in enumerate(s_tokens):
            if tok_idx == 0:
                continue  # skip sentence start
            if tok and tok[0].isupper() and tok.isalpha() and len(tok) > 1:
                cap_words += 1
    specific = numbers + percentages + dollars + cap_words

    # Vague qualifiers
    vague_ct = sum(1 for w in wds if w in VAGUE_SINGLE)
    vague_ct += len(re.findall(r"\ba lot\b", t_lower))

    row["specificity_index"] = round(specific / (specific + vague_ct + 1), 4)

    # 63. you_insertion_rate — "you/your/you're/you'll/you've" per 100 words
    you_patterns = re.findall(r"\b(you|your|you're|you'll|you've)\b", t_lower)
    row["you_insertion_rate"] = round((len(you_patterns) / max(wc, 1)) * 100, 4)

    # 64. cliche_count
    row["cliche_count"] = count_pattern(t, CLICHE_PATTERNS)

    # 65. conditional_density — conditional phrases per 100 words
    cond_ct = count_pattern(t, CONDITIONAL_PATTERNS)
    row["conditional_density"] = round((cond_ct / max(wc, 1)) * 100, 4)

    # 66. parallel_structure — comma/semicolon separated lists of 3+ items with similar word counts
    parallel = 0
    for s in sents:
        # Split by commas or semicolons
        parts = re.split(r'[;,]', s)
        parts = [p.strip() for p in parts if p.strip()]
        if len(parts) >= 3:
            # Check if word counts are similar (within 2 of each other)
            part_lens = [len(words(p)) for p in parts]
            if not part_lens:
                continue
            avg_len = sum(part_lens) / len(part_lens)
            if avg_len > 0:
                # All items within 50% of average or within +/- 2 words
                similar = all(
                    abs(pl - avg_len) <= max(2, avg_len * 0.5)
                    for pl in part_lens
                )
                if similar:
                    parallel += 1
    row["parallel_structure"] = parallel

    # 67. imperative_density — sentences starting with a command verb, per 100 words
    imperative_ct = 0
    for s in sents:
        s_words = words(s)
        if s_words and s_words[0] in IMPERATIVE_STARTERS:
            imperative_ct += 1
    # Also catch "sign up" as two-word starter
    for s in sents:
        s_low = s.lower().strip()
        if s_low.startswith("sign up"):
            imperative_ct += 1
    row["imperative_density"] = round((imperative_ct / max(wc, 1)) * 100, 4)

    return row


# ── Main ──────────────────────────────────────────────────────────

def main():
    transcripts = load_transcripts(min_words=20)
    print(f"Loaded {len(transcripts)} transcripts")

    results = []
    for tx in transcripts:
        results.append(extract(tx))

    save_results("batch_d_wording", results)
    print(f"Saved {len(results)} results to v2-parts/batch_d_wording.json")

    # ── Summary stats ─────────────────────────────────────────────
    dims = [k for k in results[0].keys() if k != "id"]
    print(f"\n{'Dimension':<32} {'Mean':>8} {'Median':>8} {'Min':>8} {'Max':>8}")
    print("-" * 74)
    for dim in dims:
        vals = [r[dim] for r in results]
        avg = sum(vals) / len(vals)
        med = median(vals)
        lo = min(vals)
        hi = max(vals)
        print(f"{dim:<32} {avg:>8.3f} {med:>8.3f} {lo:>8.3f} {hi:>8.3f}")

    print(f"\nTranscripts processed: {len(results)}")


if __name__ == "__main__":
    main()
