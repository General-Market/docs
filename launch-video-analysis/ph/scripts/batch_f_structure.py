"""Batch F — Structural dimensions (85-100) for PH launch transcripts."""

import sys, os, re, math
sys.path.insert(0, os.path.dirname(__file__))

from shared_utils import (
    load_transcripts, sentences, words, word_count,
    thirds, median, save_results, count_pattern, has_pattern
)

# ── Constants ─────────────────────────────────────────────────────────

COMMON_SENTENCE_STARTERS = {
    "i", "we", "the", "a", "an", "this", "that", "it", "there", "here",
    "my", "our", "these", "those", "what", "how", "why", "when", "where",
    "if", "so", "and", "but", "or", "now", "then", "for", "with", "in",
    "on", "at", "to", "is", "are", "was", "were", "do", "does", "did",
    "can", "could", "will", "would", "should", "have", "has", "had",
    "let", "just", "well", "okay", "right", "sure", "yes", "no", "not",
    "all", "every", "each", "some", "any", "most", "many", "much",
    "first", "second", "third", "one", "two", "three",
}

FEATURE_TRIGGERS = [
    r"\blets you\b", r"\bhelps you\b", r"\byou can\b",
    r"\btool\b", r"\bplatform\b", r"\bapp\b", r"\bsoftware\b",
    r"\bdashboard\b", r"\bfeature\b", r"\bintegrat",
]

CONNECTIVE_STARTERS = [
    r"^so\b", r"^and\b", r"^now\b", r"^but\b", r"^also\b",
]

CONNECTIVE_CONTAINS = [
    r"\blet's\b", r"\blet me\b", r"\bmoving on\b", r"\bnext up\b",
]

CALLBACK_PATTERNS = [
    r"\bremember when i said\b",
    r"\bas i mentioned\b",
    r"\bgoing back to\b",
    r"\blike i showed\b",
    r"\bthat .{1,30} we talked about\b",
    r"\bthis ties back\b",
    r"\bearlier i mentioned\b",
    r"\brecall that\b",
    r"\bas i (said|showed|demonstrated)\b",
    r"\blike i (said|mentioned)\b",
    r"\bremember (that|the)\b",
    r"\bi mentioned (earlier|before)\b",
]

SECTION_MARKERS = [
    r"\bnow\b", r"\bnext\b", r"\balso\b", r"\banother\b",
    r"\bmoving on\b", r"\blet's talk about\b", r"\bon top of\b",
    r"\badditionally\b",
]

PROMISE_PATTERNS = [
    r"\byou can\b", r"\bwill\b", r"\bhelps\b", r"\benables\b",
    r"\blets you\b", r"\ballows you\b", r"\bempowers\b",
    r"\bimagine\b", r"\bwhat if\b",
]

PROOF_PATTERNS = [
    r"\bused by\b", r"\bcustomer(s)?\b", r"\bteam(s)?\b",
    r"\bcompan(y|ies)\b", r"\bbrand(s)?\b", r"\buser(s)?\b",
    r"\d{2,}", r"\bcase stud(y|ies)\b", r"\btestimoni",
]

PUSH_PATTERNS = [
    r"\btry\b", r"\bstart\b", r"\bjoin\b", r"\bsign up\b",
    r"\bget started\b", r"\bfree trial\b", r"\bcheck it out\b",
    r"\bvisit\b", r"\bdownload\b", r"\bwww\b", r"\.com\b",
    r"\.io\b", r"\bgo to\b",
]

FEATURE_SPECIFIC = [
    r"\b(drag.and.drop|real.?time|one.?click|auto(matic|mated)|built.?in|custom(izable)?)\b",
    r"\b(api|sdk|integration|workflow|template|dashboard|analytics|report)\b",
    r"\b(upload|export|import|sync|connect|generate|create|manage|track|monitor)\b",
    r"\byou can .{3,50}\b",
    r"\blets you .{3,50}\b",
    r"\ballows you to\b",
    r"\bwith .{1,20} you (can|get)\b",
]

EMPHASIS_WORDS = [
    r"\bamazing\b", r"\bincredible\b", r"\binsane\b", r"\bawesome\b",
    r"\bmassive\b", r"\bhuge\b", r"\bpowerful\b", r"\bground.?breaking\b",
    r"\brev?olutionary\b", r"\bblown away\b", r"\bmind.?blowing\b",
]

BRAND_PATTERN = re.compile(r"\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b")

SECTION_BOUNDARY_PATTERNS = [
    r"\[music\]",
    r"\bnow\b", r"\bnext\b", r"\bmoving on\b",
    r"\blet's\b", r"\bfinally\b", r"\band lastly\b",
    r"\bnumber (one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b",
    r"\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)(ly)?\b",
    r"\bpart (one|two|three|four|five|\d+)\b",
    r"\bstep (one|two|three|four|five|\d+)\b",
]

PERSONA_PATTERNS = [
    r"\bfor developers?\b", r"\bfor marketers?\b", r"\bfor designers?\b",
    r"\bfor teams?\b", r"\bfor founders?\b", r"\bfor managers?\b",
    r"\bfor creators?\b", r"\bfor students?\b", r"\bfor enterprise\b",
    r"\bfor (small )?business(es)?\b", r"\bfor freelancers?\b",
    r"\bfor engineers?\b", r"\bfor product (managers?|teams?)\b",
    r"\bfor startups?\b", r"\bfor agencies\b", r"\bfor writers?\b",
    r"\bfor editors?\b", r"\bfor analysts?\b", r"\bfor sales\b",
    r"\bfor (content )?creators?\b", r"\bfor (non.?)?technical\b",
    r"\bif you'?re a [a-z]+\b",
]

COUNTERFACTUAL_PATTERNS = [
    r"\bwhat if\b",
    r"\bwithout .{1,30} you would\b",
    r"\bimagine not having\b",
    r"\bif you didn'?t\b",
    r"\bwhat would happen\b",
    r"\bhow would you\b",
    r"\bthink about what happens when you don'?t\b",
    r"\bwithout .{1,20} you'?d\b",
    r"\bimagine (having to|trying to|doing)\b",
]

OPEN_LOOP_PATTERNS = [
    r"\bjust getting started\b",
    r"\bthis is just the beginning\b",
    r"\bmuch more to come\b",
    r"\bstay tuned\b",
    r"\bexciting things ahead\b",
    r"\bwe'?re only scratching the surface\b",
    r"\bwait until you see\b",
    r"\bv2 is coming\b",
    r"\bjust the start\b",
    r"\bso much more\b",
    r"\bmore features? coming\b",
    r"\bwe'?re just beginning\b",
    r"\bonly the beginning\b",
    r"\bwhat'?s next\b",
    r"\bcoming soon\b",
]

DEFINITIVE_CLOSE_PATTERNS = [
    r"\btry it today\b", r"\bget started now\b", r"\bthank you\b",
    r"\bthanks for\b", r"\bcheck it out\b", r"\bvisit\b",
    r"\bsign up\b", r"\bwww\.", r"\.com\b", r"\.io\b",
    r"\bgo to\b", r"\bstart (your|a) free\b", r"\bdownload\b",
    r"\bgive it a try\b", r"\bhead over to\b", r"\blink (in|below)\b",
]


# ── Dimension extractors ─────────────────────────────────────────────

def extract_info_density_shape(transcript):
    """85. Front-loaded vs back-loaded information density across 5 segments."""
    ws = re.findall(r"\S+", transcript)
    if len(ws) < 10:
        return 0.5

    segment_size = len(ws) // 5
    if segment_size == 0:
        return 0.5

    segments = []
    for i in range(5):
        start = i * segment_size
        end = start + segment_size if i < 4 else len(ws)
        segments.append(ws[start:end])

    # Track "new information" — unique nouns, numbers, proper nouns first seen
    seen = set()
    densities = []
    for seg in segments:
        new_count = 0
        for w in seg:
            clean = re.sub(r"[^a-zA-Z0-9]", "", w)
            if not clean:
                continue
            low = clean.lower()
            # Is it a number?
            is_num = bool(re.match(r"^\d+", clean))
            # Is it a proper noun (capitalized, not common)?
            is_proper = clean[0].isupper() and low not in COMMON_SENTENCE_STARTERS and len(clean) > 1
            # Is it a substantive word (longer, likely noun)?
            is_noun_like = len(clean) > 4 and not is_num

            if (is_num or is_proper or is_noun_like) and low not in seen:
                new_count += 1
                seen.add(low)
        densities.append(new_count)

    # Shape = position of densest segment normalized 0-1
    max_density = max(densities)
    if max_density == 0:
        return 0.5
    densest_idx = densities.index(max_density)
    return round(densest_idx / 4.0, 3)


def extract_breathing_room(transcript):
    """86. Ratio of connective/transitional sentences to info-carrying ones."""
    sents = sentences(transcript)
    if not sents:
        return 0.5

    connective = 0
    info_carrying = 0

    for s in sents:
        s_lower = s.lower().strip()
        is_connective = False
        for p in CONNECTIVE_STARTERS:
            if re.match(p, s_lower):
                is_connective = True
                break
        if not is_connective:
            for p in CONNECTIVE_CONTAINS:
                if re.search(p, s_lower):
                    is_connective = True
                    break

        # Info-carrying: contains numbers, features, benefits, technical terms
        has_info = bool(
            re.search(r"\d+", s) or
            has_pattern(s, FEATURE_TRIGGERS) or
            has_pattern(s, FEATURE_SPECIFIC[:3])
        )

        if is_connective:
            connective += 1
        if has_info:
            info_carrying += 1

    if info_carrying == 0:
        return 1.0
    return round(connective / info_carrying, 3)


def extract_cold_open_words(transcript):
    """87. Words before first product name or feature mention."""
    ws_raw = re.findall(r"\S+", re.sub(r'\[.*?\]', '', transcript))
    if not ws_raw:
        return 0

    for i, w in enumerate(ws_raw):
        clean = re.sub(r"[^a-zA-Z']", "", w)
        if not clean:
            continue

        # Check for capitalized word that isn't a common sentence starter
        if clean[0].isupper() and clean.lower() not in COMMON_SENTENCE_STARTERS and len(clean) > 1:
            return i

        # Check for feature/capability language in surrounding context
        context = " ".join(ws_raw[max(0, i):min(len(ws_raw), i + 4)]).lower()
        for p in FEATURE_TRIGGERS:
            if re.search(p, context):
                return i

    return len(ws_raw)


def extract_callback_count(transcript):
    """88. Internal cross-references."""
    return count_pattern(transcript, CALLBACK_PATTERNS)


def extract_section_length_cv(transcript):
    """89. Coefficient of variation of section lengths."""
    text_lower = transcript.lower()
    # Find split positions based on section markers
    split_positions = [0]
    for p in SECTION_MARKERS:
        for m in re.finditer(p, text_lower):
            split_positions.append(m.start())
    split_positions.append(len(text_lower))
    split_positions = sorted(set(split_positions))

    if len(split_positions) < 3:
        return 0.0

    section_lengths = []
    for i in range(len(split_positions) - 1):
        chunk = text_lower[split_positions[i]:split_positions[i + 1]]
        wc = len(re.findall(r"\S+", chunk))
        if wc > 0:
            section_lengths.append(wc)

    if len(section_lengths) < 2:
        return 0.0

    mean = sum(section_lengths) / len(section_lengths)
    if mean == 0:
        return 0.0
    variance = sum((x - mean) ** 2 for x in section_lengths) / len(section_lengths)
    stdev = math.sqrt(variance)
    return round(stdev / mean, 3)


def extract_promise_proof_push(transcript):
    """90. Score 0-3 for promise/proof/push framework adherence."""
    sents = sentences(transcript)
    t1, t2, t3 = thirds(sents)

    score = 0.0
    first_text = " ".join(t1).lower()
    mid_text = " ".join(t2).lower()
    last_text = " ".join(t3).lower()

    if has_pattern(first_text, PROMISE_PATTERNS):
        score += 1.0
    if has_pattern(mid_text, PROOF_PATTERNS):
        score += 1.0
    if has_pattern(last_text, PUSH_PATTERNS):
        score += 1.0

    return score


def extract_first_feature_position(transcript):
    """91. Normalized position of first concrete feature mention."""
    ws_raw = re.findall(r"\S+", re.sub(r'\[.*?\]', '', transcript))
    total = len(ws_raw)
    if total == 0:
        return 1.0

    text_lower = transcript.lower()
    earliest = total  # default: end

    for p in FEATURE_SPECIFIC:
        m = re.search(p, text_lower)
        if m:
            # Count words before this position
            prefix = text_lower[:m.start()]
            pos = len(re.findall(r"\S+", prefix))
            earliest = min(earliest, pos)

    return round(earliest / total, 3)


def extract_parenthetical_credibility(transcript):
    """92. Casual impressive drops without emphasis framing."""
    sents = sentences(transcript)
    count = 0

    for s in sents:
        s_lower = s.lower()
        # Has a number > 100 or a brand name?
        has_big_number = bool(re.search(r"\b\d{3,}\b", s))
        has_brand = bool(BRAND_PATTERN.search(s))

        if not (has_big_number or has_brand):
            continue

        # Does NOT have emphasis or framing language
        has_emphasis = has_pattern(s, EMPHASIS_WORDS)
        has_framing = bool(re.search(
            r"\b(trusted by|used by|loved by|backed by|chosen by|preferred by)\b",
            s_lower
        ))

        if not has_emphasis and not has_framing:
            count += 1

    return count


def extract_section_boundary_markers(transcript):
    """93. Count explicit structural signposting."""
    return count_pattern(transcript, SECTION_BOUNDARY_PATTERNS)


def extract_setup_payoff_distance(transcript):
    """94. Average sentences between a question and its answer."""
    sents = sentences(transcript)
    if len(sents) < 2:
        return 0.0

    distances = []
    for i, s in enumerate(sents):
        if "?" in s:
            # Find next declarative sentence (no question mark, > 3 words)
            for j in range(i + 1, min(i + 10, len(sents))):
                if "?" not in sents[j] and len(sents[j].split()) > 3:
                    distances.append(j - i)
                    break

    if not distances:
        return 0.0
    return round(sum(distances) / len(distances), 3)


def extract_multi_persona_address(transcript):
    """95. Count of distinct persona/role addresses."""
    text_lower = transcript.lower()
    found = set()
    for p in PERSONA_PATTERNS:
        matches = re.findall(p, text_lower)
        if matches:
            found.add(p)
    return len(found)


def extract_voice_consistency(transcript):
    """96. 1 - (pronoun transitions / sentence count). Fewer shifts = higher."""
    sents = sentences(transcript)
    if len(sents) < 2:
        return 1.0

    def dominant_voice(s):
        s_lower = s.lower()
        i_we = len(re.findall(r"\b(i|we|my|our|me|us)\b", s_lower))
        you = len(re.findall(r"\b(you|your|yours|yourself)\b", s_lower))
        if i_we > you:
            return "iwe"
        elif you > i_we:
            return "you"
        return "neutral"

    voices = [dominant_voice(s) for s in sents]
    transitions = 0
    prev = None
    for v in voices:
        if v == "neutral":
            continue
        if prev is not None and v != prev:
            transitions += 1
        prev = v

    return round(1.0 - (transitions / len(sents)), 3)


def extract_counterfactual_count(transcript):
    """97. 'What if' scenarios and counterfactual language."""
    return count_pattern(transcript, COUNTERFACTUAL_PATTERNS)


def extract_closing_velocity(transcript):
    """98. Last 20% avg sentence length / first 80% avg sentence length."""
    sents = sentences(transcript)
    if len(sents) < 5:
        return 1.0

    split_point = int(len(sents) * 0.8)
    first_80 = sents[:split_point]
    last_20 = sents[split_point:]

    if not first_80 or not last_20:
        return 1.0

    avg_first = sum(len(s.split()) for s in first_80) / len(first_80)
    avg_last = sum(len(s.split()) for s in last_20) / len(last_20)

    if avg_first == 0:
        return 1.0
    return round(avg_last / avg_first, 3)


def extract_open_loop_closing(transcript):
    """99. Unfinished/forward-looking close (0/1)."""
    sents = sentences(transcript)
    if not sents:
        return 0

    # Check last 20% of sentences
    tail = sents[max(0, len(sents) - max(3, len(sents) // 5)):]
    tail_text = " ".join(tail).lower()
    return 1 if has_pattern(tail_text, OPEN_LOOP_PATTERNS) else 0


def extract_definitive_closing(transcript):
    """100. Clean definitive close (0/1)."""
    sents = sentences(transcript)
    if not sents:
        return 0

    # Check last 20% of sentences
    tail = sents[max(0, len(sents) - max(3, len(sents) // 5)):]
    tail_text = " ".join(tail).lower()
    return 1 if has_pattern(tail_text, DEFINITIVE_CLOSE_PATTERNS) else 0


# ── Main ──────────────────────────────────────────────────────────────

def process_one(item):
    t = item["transcript"]
    return {
        "id": item["id"],
        "info_density_shape": extract_info_density_shape(t),
        "breathing_room": extract_breathing_room(t),
        "cold_open_words": extract_cold_open_words(t),
        "callback_count": extract_callback_count(t),
        "section_length_cv": extract_section_length_cv(t),
        "promise_proof_push": extract_promise_proof_push(t),
        "first_feature_position": extract_first_feature_position(t),
        "parenthetical_credibility": extract_parenthetical_credibility(t),
        "section_boundary_markers": extract_section_boundary_markers(t),
        "setup_payoff_distance": extract_setup_payoff_distance(t),
        "multi_persona_address": extract_multi_persona_address(t),
        "voice_consistency": extract_voice_consistency(t),
        "counterfactual_count": extract_counterfactual_count(t),
        "closing_velocity": extract_closing_velocity(t),
        "open_loop_closing": extract_open_loop_closing(t),
        "definitive_closing": extract_definitive_closing(t),
    }


def print_summary(results):
    dims = [k for k in results[0] if k != "id"]
    print(f"\n{'─' * 70}")
    print(f"  BATCH F — Structure Dimensions (85-100)")
    print(f"  {len(results)} transcripts processed")
    print(f"{'─' * 70}")
    print(f"  {'Dimension':<30} {'Mean':>8} {'Median':>8} {'Min':>8} {'Max':>8} {'StdDev':>8}")
    print(f"  {'─' * 70}")

    for d in dims:
        vals = [r[d] for r in results]
        n = len(vals)
        mean_v = sum(vals) / n
        med_v = median(vals)
        min_v = min(vals)
        max_v = max(vals)
        var_v = sum((x - mean_v) ** 2 for x in vals) / n
        std_v = math.sqrt(var_v)
        print(f"  {d:<30} {mean_v:>8.3f} {med_v:>8.3f} {min_v:>8.3f} {max_v:>8.3f} {std_v:>8.3f}")

    print(f"{'─' * 70}")


if __name__ == "__main__":
    data = load_transcripts()
    print(f"Loaded {len(data)} transcripts")

    results = [process_one(item) for item in data]
    save_results("batch_f_structure", results)

    print_summary(results)
    print(f"\nSaved to v2-parts/batch_f_structure.json")
