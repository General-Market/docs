"""Batch E — Persuasion dimensions (68-84) for PH launch transcripts."""

import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))

from shared_utils import (
    load_transcripts, sentences, words,
    thirds, median, save_results, count_pattern, has_pattern
)

# ── Stop words for word rarity ────────────────────────────────────

STOP_WORDS = {
    "the", "a", "is", "in", "to", "and", "of", "for", "it", "that",
    "this", "with", "on", "at", "by", "from", "or", "an", "be", "as",
    "are", "was", "were", "been", "has", "have", "had", "do", "does",
    "did", "will", "would", "can", "could", "shall", "should", "may",
    "might", "must", "not", "but", "if", "so", "we", "you", "i",
    "they", "he", "she", "my", "your", "our", "their", "his", "her",
    "its", "just", "also", "about", "up", "out", "all", "more", "some",
    "than", "then", "very", "there", "what", "when", "how", "which",
    "who", "no", "don", "t", "s", "re", "ve", "ll", "d", "m",
}

# ── Pattern banks ─────────────────────────────────────────────────

# 69. qualifying_retreat — superlative then hedge in same sentence
SUPERLATIVE_WORDS = [
    r"\bthe best\b", r"\bthe fastest\b", r"\bthe only\b",
    r"\bthe most\b", r"\brevolutionary\b", r"\bthe first\b",
    r"\bthe biggest\b", r"\bthe easiest\b", r"\bthe smartest\b",
    r"\bthe ultimate\b", r"\bgame.?changing\b", r"\bthe greatest\b",
]
HEDGE_WORDS = [
    r"\bwell\b", r"\bmaybe\b", r"\barguably\b", r"\bperhaps\b",
    r"\bkind of\b", r"\bsort of\b", r"\balmost\b", r"\bat least\b",
    r"\bone of\b", r"\bnot the only\b", r"\bokay\b",
]

# 70. conclusive_finality
DECISIVE_WORDS = [
    "today", "now", "start", "go", "try", "join", "get", "sign",
    "launch", "build", "create", "check", "visit", "download",
]
TRAILING_PATTERNS = [
    r"\bso yeah\b", r"\banyway\b", r"\bthanks\b", r"\bbye\b",
    r"\bthat'?s? it\b", r"\bthat'?s? all\b", r"\bokay\b",
    r"\bum\b", r"\bhope you\b", r"\byeah\b",
]

# 71. social proof classification
PROOF_USERS = r"\d+[\s,]*\d*\s*\+?\s*(users?|teams?|companies|customers?|businesses|clients?|people|developers?|organizations?|startups?)"
PROOF_BRANDS = r"(used by|trusted by|loved by|backed by|chosen by|supported by|adopted by)"
PROOF_QUOTES = r'("[^"]{8,}"|\bsaid\b|\btold us\b|\baccording to\b)'

# 72. authority_type
AUTHORITY_TECHNICAL = [
    r"\bex[- ]?(google|facebook|meta|amazon|apple|microsoft|stripe|airbnb|uber|netflix)\b",
    r"\bphd\b", r"\bbuilt at\b", r"\bengineers? from\b",
    r"\bstanford\b", r"\bmit\b", r"\bharvard\b", r"\byale\b",
    r"\bberkeley\b", r"\bcarnegie mellon\b", r"\bcaltech\b",
    r"\bformer(ly)? at\b", r"\bworked at\b",
    r"\byc\b.{0,5}\b(backed|alumni|batch)\b", r"\by combinator\b",
]
AUTHORITY_MARKET = [
    r"\d+[\s,]*\d*\s*\+?\s*(users?|companies|customers?|teams?|businesses|downloads?)",
    r"\b\d+[kmb]\+?\s*(users?|downloads?|installs?)\b",
    r"\b(millions?|thousands?|hundreds?) of (users?|customers?)\b",
]
AUTHORITY_DOMAIN = [
    r"\byears? of experience\b",
    r"\bexperts? in\b",
    r"\bdecades? of\b",
    r"\bindustry veterans?\b",
    r"\b\d+\+?\s*years?\b.{0,20}\b(experience|building|working)\b",
    r"\bdeep expertise\b",
    r"\bspecialists? in\b",
]

# 73. reciprocity_trigger
RECIPROCITY_PATTERNS = [
    r"\bfree (template|tier|plan|version|trial|resource|tool|account|access|download)\b",
    r"\bopen[- ]?source[d]?\b",
    r"\bwe open[- ]?sourced\b",
    r"\bcomplimentary\b",
    r"\bno credit card\b",
    r"\bfree forever\b",
    r"\bfree to (use|try|start|get started)\b",
    r"\b100% free\b",
    r"\bcompletely free\b",
    r"\bfree and open\b",
    r"\bno (cost|charge|fee|payment)\b",
    r"\bfree for (individuals?|personal|small teams?|startups?|developers?)\b",
]

# 74. anchor_contrast_pricing — checked via function

# 75. contrast_pairs
CONTRAST_PATTERNS = [
    r"\binstead of\b", r"\bnot\b.{1,20}\bbut\b",
    r"\bunlike\b", r"\bwhile others?\b",
    r"\bthe hard way\b", r"\bvs\.?\b",
    r"\bversus\b", r"\bmanual vs\b", r"\bcomplex vs\b",
    r"\bold way\b", r"\bnew way\b",
    r"\btraditional\b.{0,20}\bvs\b",
    r"\bwithout .{1,30} with\b",
    r"\brather than\b", r"\bas opposed to\b",
    r"\bcompared to\b",
]

# 76. certainty/uncertainty
CERTAIN_WORDS = [
    r"\bwill\b", r"\balways\b", r"\bguaranteed?\b", r"\bdefinitely\b",
    r"\babsolutely\b", r"\bensures?\b", r"\bproven\b", r"\b100%\b",
    r"\bevery time\b", r"\bcertainly\b", r"\bwithout fail\b",
    r"\bno doubt\b",
]
UNCERTAIN_WORDS = [
    r"\bmight\b", r"\bcould\b", r"\bpotentially\b", r"\bpossibly\b",
    r"\bmaybe\b", r"\bperhaps\b", r"\bsometimes\b", r"\bprobably\b",
    r"\blikely\b",
]

# 77. in_group_language
INGROUP_PATTERNS = [
    r"\bas (developers?|engineers?|designers?|founders?|marketers?|creators?|builders?|makers?|product people|teams?|professionals?) we\b",
    r"\bif you'?re like (us|me)\b",
    r"\bfellow (developers?|engineers?|designers?|founders?|marketers?|creators?|builders?)\b",
    r"\bwe all know\b",
    r"\bas a (developer|engineer|designer|founder|marketer|creator|builder) you\b",
    r"\bwe'?ve all (been|experienced|felt|had|dealt)\b",
    r"\byou and (i|me|us)\b",
    r"\bas (a team|builders|creators) we\b",
    r"\bpeople like (us|you)\b",
    r"\bour community\b",
]

# 78. objection_preempt
OBJECTION_PATTERNS = [
    r"\byou might be wondering\b",
    r"\byou might think\b",
    r"\bi know what you'?re thinking\b",
    r"\bbut what about\b",
    r"\bdon'?t worry about\b",
    r"\bconcerned about\b",
    r"\bthe good news is\b",
    r"\brest assured\b",
    r"\band yes\b.{0,10}\b(it'?s?|it|we|there)\b",
    r"\byou'?re (probably )?wondering\b",
    r"\b(no|don'?t) need to worry\b",
    r"\byou don'?t (have to|need to) (worry|stress)\b",
    r"\bworried about\b",
    r"\bsounds too good\b",
]

# 79. scarcity_type
SCARCITY_TIME = [
    r"\btoday only\b", r"\blaunch (week|day|special|offer|price|discount)\b",
    r"\blimited time\b", r"\bfor a limited\b", r"\bending soon\b",
    r"\bthis week only\b", r"\bhurry\b", r"\bwhile (it|the offer) lasts?\b",
]
SCARCITY_QUANTITY = [
    r"\blimited spots?\b", r"\bfirst \d+\b", r"\bonly \d+ (spots?|seats?|slots?|left)\b",
    r"\blimited (seats?|slots?|spots?|capacity)\b",
]
SCARCITY_ACCESS = [
    r"\binvite[- ]?only\b", r"\bwaitlist\b", r"\bexclusive\b",
    r"\bearly access\b", r"\bbeta (access|users?|testers?|program)\b",
    r"\bprivate (beta|access|preview)\b", r"\bclosed (beta|alpha)\b",
    r"\bapply (for|to) (access|join)\b",
]
SCARCITY_CAPABILITY = [
    r"\bno one else\b", r"\bthe only (tool|platform|solution|app|product)\b",
    r"\bunique(ly)?\b", r"\bfirst of its kind\b",
    r"\bnothing else (can|does|like)\b", r"\bcan'?t find anywhere\b",
]

# 82. cognitive_ease
EASE_PATTERNS = [
    r"\bone[- ]?click\b", r"\bautomatic(ally)?\b",
    r"\bzero[- ]?config\b", r"\bworks? out of the box\b",
    r"\bplug[- ]?and[- ]?play\b", r"\bno[- ]?setup\b",
    r"\bno[- ]?installation\b", r"\bset it and forget it\b",
    r"\bhands[- ]?off\b", r"\bautopilot\b",
    r"\bno[- ]?maintenance\b", r"\bself[- ]?service\b",
    r"\binstant(ly)?\b", r"\bno coding\b", r"\bno[- ]?code\b",
    r"\bone minute\b", r"\bseconds?\b.{0,10}\b(setup|install|start)\b",
    r"\bjust (click|press|tap|drag|type)\b",
    r"\bzero effort\b", r"\bno learning curve\b",
    r"\bready to (use|go)\b",
]

# 83. everyone_else_maneuver
EVERYONE_ELSE_PATTERNS = [
    r"\bmost (teams?|companies|startups?|developers?) already\b",
    r"\beveryone is (switching|moving|using|adopting)\b",
    r"\bcompanies like yours? already\b",
    r"\bindustry standard\b",
    r"\byour competitors? (use|already|are)\b",
    r"\bdon'?t fall behind\b",
    r"\bthe smart move\b",
    r"\btop companies\b",
    r"\bleading (teams?|companies|brands?|startups?)\b",
    r"\bthe world'?s? (best|top|leading)\b",
    r"\bother (teams?|companies) are already\b",
    r"\bmodern (teams?|companies)\b.{0,10}\b(use|already|have)\b",
]

# 84. future_self_projection
FUTURE_SELF_PATTERNS = [
    r"\byou'?ll be the one who\b",
    r"\bbecome a\b", r"\bturn into\b",
    r"\bimagine yourself\b", r"\byou'?ll finally\b",
    r"\bthe team that\b", r"\bbe the first\b",
    r"\bbe known for\b", r"\byour future self\b",
    r"\byou'?ll never (have to|go back|need to)\b",
    r"\btransform (your|yourself)\b",
    r"\byou'?ll become\b", r"\byou'?ll (look|feel|sound|seem) like\b",
    r"\bgo from .{1,30} to\b",
    r"\bleverage your\b",
]


# ── Helpers ───────────────────────────────────────────────────────

def content_words(text):
    """Return list of words excluding stop words."""
    wds = words(text)
    return [w for w in wds if w not in STOP_WORDS and len(w) > 1]


def word_rarity_score(text):
    """Average word length of content words — proxy for lexical sophistication."""
    cw = content_words(text)
    if not cw:
        return 0.0
    return round(sum(len(w) for w in cw) / len(cw), 3)


def qualifying_retreat(text):
    """Count bold claim → hedge within same sentence."""
    sents = sentences(text)
    count = 0
    for s in sents:
        sl = s.lower()
        has_superlative = False
        for p in SUPERLATIVE_WORDS:
            if re.search(p, sl):
                has_superlative = True
                break
        if has_superlative:
            for p in HEDGE_WORDS:
                if re.search(p, sl):
                    count += 1
                    break
    return count


def conclusive_finality(text):
    """Score the last sentence for decisiveness vs trailing off."""
    sents = sentences(text)
    if not sents:
        return 0.0
    last = sents[-1].lower()
    last_words_list = words(last)

    score = 0
    for w in DECISIVE_WORDS:
        if w in last_words_list:
            score += 1

    for p in TRAILING_PATTERNS:
        if re.search(p, last):
            score -= 1

    # Normalize to [-1, 1]
    if score == 0:
        return 0.0
    return round(max(-1.0, min(1.0, score / max(abs(score), 1))), 3)


def social_proof_stacking_order(text):
    """Which type of social proof appears first? 0=none, 1=numbers, 2=brands, 3=quotes."""
    tl = text.lower()

    first_users = None
    for m in re.finditer(PROOF_USERS, tl):
        first_users = m.start()
        break

    first_brands = None
    for m in re.finditer(PROOF_BRANDS, tl):
        first_brands = m.start()
        break

    first_quotes = None
    for m in re.finditer(PROOF_QUOTES, tl):
        first_quotes = m.start()
        break

    positions = {}
    if first_users is not None:
        positions[1] = first_users
    if first_brands is not None:
        positions[2] = first_brands
    if first_quotes is not None:
        positions[3] = first_quotes

    if not positions:
        return 0
    return min(positions, key=positions.get)


def authority_type(text):
    """0=none, 1=technical, 2=market, 3=domain."""
    tl = text.lower()

    positions = {}
    for p in AUTHORITY_TECHNICAL:
        m = re.search(p, tl)
        if m:
            positions[1] = min(positions.get(1, float('inf')), m.start())
    for p in AUTHORITY_MARKET:
        m = re.search(p, tl)
        if m:
            positions[2] = min(positions.get(2, float('inf')), m.start())
    for p in AUTHORITY_DOMAIN:
        m = re.search(p, tl)
        if m:
            positions[3] = min(positions.get(3, float('inf')), m.start())

    if not positions:
        return 0
    # Return the type that appears first
    return min(positions, key=positions.get)


def anchor_contrast_pricing(text):
    """High price then lower price or 'free' within 30 words."""
    tl = text.lower()
    # Find dollar amounts
    dollar_matches = list(re.finditer(r'\$[\d,]+(?:\.\d+)?', tl))
    if len(dollar_matches) >= 2:
        for i in range(len(dollar_matches) - 1):
            val1_str = dollar_matches[i].group().replace('$', '').replace(',', '')
            val2_str = dollar_matches[i + 1].group().replace('$', '').replace(',', '')
            try:
                val1 = float(val1_str)
                val2 = float(val2_str)
                # Second is smaller and within ~200 chars (~30 words)
                gap = dollar_matches[i + 1].start() - dollar_matches[i].end()
                if val1 > val2 and gap < 200:
                    return 1
            except ValueError:
                continue

    # Dollar amount followed by "free" within 30 words
    for dm in dollar_matches:
        after = tl[dm.end():dm.end() + 200]
        if re.search(r'\bfree\b', after):
            return 1

    # "cost" or "spend" followed by "free" or lower price
    cost_matches = list(re.finditer(r'\b(costs?|spend|expensive|pric(?:e|y|ing))\b', tl))
    for cm in cost_matches:
        after = tl[cm.end():cm.end() + 200]
        if re.search(r'\bfree\b', after) or re.search(r'\$\d', after):
            return 1

    return 0


def certainty_ratio(text):
    """Ratio of certain to uncertain language."""
    tl = text.lower()
    certain = 0
    for p in CERTAIN_WORDS:
        certain += len(re.findall(p, tl))
    uncertain = 0
    for p in UNCERTAIN_WORDS:
        uncertain += len(re.findall(p, tl))
    return round(certain / (certain + uncertain + 1), 3)


def bandwagon_gradient(text):
    """Do numeric proof claims escalate through the transcript?"""
    tl = text.lower()
    wds = words(text)
    mid = len(tl) // 2

    # Extract all numbers near social proof words
    proof_context = r'(\d[\d,]*)\s*\+?\s*(users?|teams?|companies|customers?|downloads?|installs?|businesses|people|developers?|projects?|organizations?|startups?|clients?)'
    matches = list(re.finditer(proof_context, tl))

    if len(matches) < 2:
        return 0.0

    first_half_max = 0
    second_half_max = 0
    for m in matches:
        val_str = m.group(1).replace(',', '')
        try:
            val = int(val_str)
        except ValueError:
            continue
        if m.start() < mid:
            first_half_max = max(first_half_max, val)
        else:
            second_half_max = max(second_half_max, val)

    if first_half_max == 0:
        return 0.0
    return round(second_half_max / first_half_max, 3)


def choice_architecture(text):
    """Detect pricing/option structure. 0=none, 1=single, 2=binary, 3=multiple tiers, 4=à la carte."""
    tl = text.lower()

    # Count tier mentions
    tier_words = re.findall(r'\b(free|starter|basic|pro|premium|enterprise|business|team|personal|hobby|growth|scale|plus|unlimited)\s*(plan|tier|pricing|version|edition|package)?\b', tl)
    # Also catch "$X/month" patterns
    price_points = re.findall(r'\$\d+[\d,]*\s*/?\s*(month|year|mo|yr|annually|per)', tl)
    # "free or pro", "free and paid"
    binary = re.findall(r'\bfree (or|and|vs) (pro|paid|premium)\b', tl)
    # "à la carte", "pay per", "pay as you"
    alacarte = re.findall(r'\b(pay per|pay as you|à la carte|a la carte|per seat|per user|usage.?based|metered)\b', tl)

    distinct_tiers = len(set(w[0] for w in tier_words))
    n_prices = len(price_points)

    if alacarte:
        return 4
    if distinct_tiers >= 3 or n_prices >= 3:
        return 3
    if distinct_tiers == 2 or n_prices == 2 or binary:
        return 2
    if distinct_tiers == 1 or n_prices == 1:
        # Single path: "just try it", "get started"
        return 1
    # Check for single-path CTA
    if re.search(r'\b(just (try|use|start|sign up)|get started|try it)\b', tl):
        return 1
    return 0


# ── Extraction ────────────────────────────────────────────────────

def extract(tx):
    t = tx["transcript"]
    tl = t.lower()
    wds = words(t)
    sents = sentences(t)

    row = {"id": tx["id"]}

    # 68. word_rarity_score
    row["word_rarity_score"] = word_rarity_score(t)

    # 69. qualifying_retreat
    row["qualifying_retreat"] = qualifying_retreat(t)

    # 70. conclusive_finality
    row["conclusive_finality"] = conclusive_finality(t)

    # 71. social_proof_stacking_order
    row["social_proof_stacking_order"] = social_proof_stacking_order(t)

    # 72. authority_type
    row["authority_type"] = authority_type(t)

    # 73. reciprocity_trigger
    row["reciprocity_trigger"] = 1 if has_pattern(t, RECIPROCITY_PATTERNS) else 0

    # 74. anchor_contrast_pricing
    row["anchor_contrast_pricing"] = anchor_contrast_pricing(t)

    # 75. contrast_pairs
    row["contrast_pairs"] = count_pattern(t, CONTRAST_PATTERNS)

    # 76. certainty_ratio
    row["certainty_ratio"] = certainty_ratio(t)

    # 77. in_group_language
    row["in_group_language"] = count_pattern(t, INGROUP_PATTERNS)

    # 78. objection_preempt
    row["objection_preempt"] = count_pattern(t, OBJECTION_PATTERNS)

    # 79. scarcity_type
    if has_pattern(t, SCARCITY_TIME):
        row["scarcity_type"] = 1
    elif has_pattern(t, SCARCITY_QUANTITY):
        row["scarcity_type"] = 2
    elif has_pattern(t, SCARCITY_ACCESS):
        row["scarcity_type"] = 3
    elif has_pattern(t, SCARCITY_CAPABILITY):
        row["scarcity_type"] = 4
    else:
        row["scarcity_type"] = 0

    # 80. bandwagon_gradient
    row["bandwagon_gradient"] = bandwagon_gradient(t)

    # 81. choice_architecture
    row["choice_architecture"] = choice_architecture(t)

    # 82. cognitive_ease
    row["cognitive_ease"] = count_pattern(t, EASE_PATTERNS)

    # 83. everyone_else_maneuver
    row["everyone_else_maneuver"] = count_pattern(t, EVERYONE_ELSE_PATTERNS)

    # 84. future_self_projection
    row["future_self_projection"] = count_pattern(t, FUTURE_SELF_PATTERNS)

    return row


# ── Main ──────────────────────────────────────────────────────────

def main():
    transcripts = load_transcripts(min_words=20)
    print(f"Loaded {len(transcripts)} transcripts")

    results = []
    for tx in transcripts:
        results.append(extract(tx))

    save_results("batch_e_persuasion", results)
    print(f"Saved {len(results)} results to v2-parts/batch_e_persuasion.json")

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
