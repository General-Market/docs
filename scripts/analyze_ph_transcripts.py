#!/usr/bin/env python3
"""
PH Transcript Analysis — 86 dimensions across 2,160 transcripts.
Outputs:
  - ph_transcript_analysis_results.json  (per-product structured analysis)
  - ph_transcript_analysis_report.md     (aggregate findings + temporal shifts)
"""

import json
import re
import math
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime

# ─── Config ──────────────────────────────────────────────────────────────────

INPUT_FILE = "ph_daily_top_with_transcripts.json"
OUTPUT_JSON = "ph_transcript_analysis_results.json"
OUTPUT_REPORT = "ph_transcript_analysis_report.md"
MIN_WORDS = 20  # skip transcripts shorter than this


# ─── Helpers ─────────────────────────────────────────────────────────────────

def words(text):
    return text.split()

def sentences(text):
    return [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]

def syllable_count(word):
    word = word.lower().strip(".,!?;:'\"")
    if len(word) <= 2:
        return 1
    count = len(re.findall(r'[aeiouy]+', word))
    if word.endswith('e') and not word.endswith('le'):
        count -= 1
    return max(count, 1)

def flesch_kincaid(text):
    w = words(text)
    s = sentences(text)
    if not w or not s:
        return 0
    total_syl = sum(syllable_count(word) for word in w)
    return 0.39 * (len(w) / len(s)) + 11.8 * (total_syl / len(w)) - 15.59

def quarter(date_str):
    y, m = date_str[:4], int(date_str[5:7])
    q = (m - 1) // 3 + 1
    return f"{y}-Q{q}"

def year(date_str):
    return date_str[:4]

def median(lst):
    if not lst:
        return 0
    s = sorted(lst)
    n = len(s)
    if n % 2 == 0:
        return (s[n//2 - 1] + s[n//2]) / 2
    return s[n//2]

def mean(lst):
    return sum(lst) / len(lst) if lst else 0

def spearman_r(x, y):
    """Simple Spearman rank correlation."""
    if len(x) < 5:
        return 0, 1.0
    n = len(x)
    def rank(arr):
        sorted_idx = sorted(range(n), key=lambda i: arr[i])
        ranks = [0] * n
        i = 0
        while i < n:
            j = i
            while j < n - 1 and arr[sorted_idx[j]] == arr[sorted_idx[j+1]]:
                j += 1
            avg_rank = (i + j) / 2 + 1
            for k in range(i, j + 1):
                ranks[sorted_idx[k]] = avg_rank
            i = j + 1
        return ranks
    rx, ry = rank(x), rank(y)
    d2 = sum((rx[i] - ry[i])**2 for i in range(n))
    r = 1 - (6 * d2) / (n * (n*n - 1))
    # approximate p-value
    t = r * math.sqrt((n - 2) / (1 - r*r + 1e-10))
    # rough two-tailed p from t
    p = 2 * (1 - min(0.9999, abs(t) / math.sqrt(abs(t)**2 + n - 2)))
    return r, p


# ─── Word lists ──────────────────────────────────────────────────────────────

NEGATIVE_OPENERS = {"broken", "tired", "hate", "frustrated", "sick", "annoyed",
                    "struggling", "painful", "problem", "wrong", "fail", "nightmare"}

HEDGE_WORDS = {"maybe", "might", "perhaps", "possibly", "probably", "somewhat",
               "sort of", "kind of", "more or less", "arguably", "potentially"}

CONFIDENCE_WORDS = {"will", "does", "always", "guaranteed", "proven", "definitely",
                    "certainly", "absolutely", "ensure", "ensures"}

BUZZWORDS = {"disruptive", "game-changing", "next-gen", "revolutionary",
             "groundbreaking", "innovative", "cutting-edge", "state-of-the-art",
             "paradigm", "synergy", "leverage", "unlock"}

ACTION_VERBS = {"eliminate", "automate", "simplify", "streamline", "reduce",
                "accelerate", "transform", "replace", "optimize", "cut",
                "remove", "destroy", "save", "boost", "supercharge"}

FILLER_WORDS = {"basically", "actually", "just", "really", "literally",
                "honestly", "obviously", "essentially", "simply"}

BRANDS = {"google", "microsoft", "apple", "amazon", "meta", "facebook",
          "stripe", "slack", "notion", "figma", "shopify", "salesforce",
          "hubspot", "openai", "chatgpt", "github", "aws", "azure",
          "twilio", "datadog", "vercel", "supabase", "firebase",
          "mongodb", "postgresql", "postgres", "redis", "docker",
          "kubernetes", "terraform", "airbnb", "uber", "dropbox",
          "zoom", "discord", "twitter", "linkedin", "instagram",
          "tiktok", "youtube", "netflix", "spotify"}

CTA_PATTERNS = {
    "waitlist": r"\b(waitlist|wait list|waiting list|join the waitlist)\b",
    "join": r"\b(join us|join now|join today|join)\b",
    "sign_up": r"\b(sign up|signup|register|create.*account)\b",
    "try": r"\b(try it|try now|try for free|give it a try|check it out)\b",
    "get_started": r"\b(get started|start now|start free|start today)\b",
    "book_demo": r"\b(book a demo|schedule a demo|request a demo|demo)\b",
    "free": r"\b(free|no credit card|free trial|free tier|free plan)\b",
    "beta": r"\b(beta|early access|private beta|public beta)\b",
    "limited": r"\b(limited|exclusive|invitation|invite only|spots)\b",
}

KEY_PHRASES = {
    "10x": r"\b10x\b",
    "no_code": r"\b(no[- ]code|nocode|low[- ]code)\b",
    "ai": r"\bai\b|\bartificial intelligence\b",
    "gpt": r"\bgpt\b|\bchatgpt\b|\bgpt-?\d\b",
    "automate": r"\bautomat\w*\b",
    "open_source": r"\b(open[- ]source|oss)\b",
    "privacy": r"\bprivacy\b|\bprivate\b",
    "all_in_one": r"\ball[- ]in[- ]one\b",
    "dashboard": r"\bdashboard\b",
    "api": r"\bapi\b",
    "workflow": r"\bworkflow\b",
    "integration": r"\bintegrat\w*\b",
    "real_time": r"\breal[- ]time\b",
    "saas": r"\bsaas\b",
    "enterprise": r"\benterprise\b",
    "startup": r"\bstartup\b|\bstart-up\b",
    "developer": r"\bdeveloper\w*\b|\bdev\b|\bdevs\b",
}

COMP_PHRASES = {
    "alternative_to": r"\balternative to\b",
    "better_than": r"\bbetter than\b",
    "faster_than": r"\bfaster than\b",
    "cheaper_than": r"\bcheaper than\b",
    "replaces": r"\breplaces?\b",
    "unlike": r"\bunlike\b",
    "compared_to": r"\bcompared to\b",
}

CATEGORY_CREATION = {
    "the_first": r"\bthe first\b",
    "the_only": r"\bthe only\b",
    "a_new_kind": r"\ba new kind of\b",
    "we_invented": r"\bwe invented\b|\bwe built\b|\bwe created\b",
}

REPLACEMENT_FRAMING = {
    "no_more": r"\bno more\b",
    "replace_your": r"\breplace your\b",
    "forget_about": r"\bforget about\b",
    "stop_using": r"\bstop using\b",
}

BEFORE_AFTER = {
    "cut_by": r"\bcut\w*\s+\w+\s+by\s+\d",
    "reduced_by": r"\breduced?\s+\w+\s+by\s+\d",
    "saves_hours": r"\bsaves?\s+\d+\s+(hours?|minutes?|days?|weeks?)\b",
    "from_to": r"\bfrom\s+\d[\d,.]*\s+to\s+\d",
    "x_faster": r"\b\d+x\s+(faster|quicker|more)\b",
    "percent_improvement": r"\b\d+%\s+(faster|better|more|less|reduction|increase|improvement)\b",
}

SUCCESS_CLAIMS = {
    "enterprise_wins": r"\b(trusted by|used by|powering|serving)\s+\d",
    "market_validation": r"\b(waitlist|signed up|pre-orders?|reservations?)\s+\d",
    "cost_savings": r"\b(saves?|saving|saved)\s+\$?\d",
    "revenue": r"\b(revenue|arr|mrr|recurring)\b",
    "users": r"\b\d[\d,]*\+?\s*(users?|customers?|teams?|companies|businesses)\b",
    "growth": r"\b\d+%\s*(growth|increase|month[- ]over|MoM|YoY)\b",
}

TRACTION_WORDS = {"users", "customers", "clients", "companies", "businesses",
                  "teams", "developers", "downloads", "installs"}


# ─── Analysis functions ──────────────────────────────────────────────────────

def classify_hook(transcript):
    """Classify the opening hook type."""
    first_sentence = sentences(transcript)[0] if sentences(transcript) else ""
    fl = first_sentence.lower().strip()

    if re.match(r"^(hi|hey|hello|good morning|good afternoon|welcome|greetings)", fl):
        return "greeting"
    if re.match(r"^(introducing|meet |say hello|announcing|we.re excited|we are excited|we.re thrilled)", fl):
        return "announcement"
    if fl.endswith("?") or fl.startswith(("what if", "have you", "do you", "are you", "how many", "how much", "why do", "why are", "ever ", "imagine")):
        return "question"
    if re.search(r"^\d|million|billion|percent|\d+%|\d+x", fl):
        return "stat_number"
    if any(w in fl for w in ["tired", "frustrated", "sick of", "hate", "broken", "struggling", "pain", "problem", "annoying", "nightmare"]):
        return "pain_point"
    if re.match(r"^(i |we |my |our )", fl):
        if any(w in fl for w in ["built", "created", "started", "founded", "spent", "worked"]):
            return "founder_story"
        return "product_statement"
    if any(w in fl for w in ["fastest", "most powerful", "world's", "never before", "only", "first ever"]):
        return "bold_claim"
    if re.search(r"^(so |this is |here.s |let me |today |in this)", fl):
        return "demo_instruction"

    return "descriptive"

def analyze_pronouns(text):
    """Classify pronoun strategy."""
    w = text.lower().split()
    we_count = sum(1 for x in w if x in ("we", "we're", "we've", "our", "us"))
    you_count = sum(1 for x in w if x in ("you", "you're", "you've", "your", "yours"))
    total = we_count + you_count
    if total == 0:
        return "neutral", 0, 0
    ratio = we_count / total
    if ratio > 0.6:
        return "mostly_we", we_count, you_count
    elif ratio < 0.4:
        return "mostly_you", we_count, you_count
    return "balanced", we_count, you_count

def classify_narrative_arc(transcript):
    """Classify narrative arc into segments."""
    sents = sentences(transcript)
    if len(sents) < 3:
        return "too_short"

    third = max(1, len(sents) // 3)
    segments = [sents[:third], sents[third:2*third], sents[2*third:]]

    def segment_type(seg_text):
        text = " ".join(seg_text).lower()
        problem_words = sum(1 for w in ["problem", "issue", "challenge", "difficult", "hard",
                                         "pain", "frustrat", "broken", "wrong", "fail",
                                         "struggle", "waste", "lose", "lost", "miss"] if w in text)
        solution_words = sum(1 for w in ["solution", "solve", "fix", "build", "creat",
                                          "platform", "tool", "product", "feature", "help",
                                          "enable", "allow", "provid", "offer", "design"] if w in text)
        traction_words = sum(1 for w in ["users", "customers", "revenue", "growth", "raised",
                                          "million", "thousand", "companies", "download",
                                          "sign up", "waitlist", "trusted"] if w in text)
        scores = {"problem": problem_words, "solution": solution_words, "traction": traction_words}
        winner = max(scores, key=scores.get)
        if scores[winner] == 0:
            return "neutral"
        return winner

    types = [segment_type(s) for s in segments]
    arc = "→".join(types)

    if types == ["problem", "solution", "traction"]:
        return "textbook"
    elif types[0] == "solution":
        return "solution_first"
    elif types[0] == "problem" and types.count("problem") >= 2:
        return "problem_heavy"
    elif types[0] == "traction":
        return "traction_first"
    elif types[0] == "neutral" and "solution" in types:
        return "neutral_to_solution"
    return arc

def count_topic_transitions(transcript):
    """Estimate topic transition count by detecting sentence topic shifts."""
    sents = sentences(transcript)
    if len(sents) < 3:
        return 0

    transitions = 0
    topic_markers = [
        r"\b(but|however|on the other hand|instead|meanwhile|also|additionally|furthermore)\b",
        r"\b(now|next|then|first|second|third|finally|let me|here.s|another)\b",
        r"\b(so|that.s why|because of|this means|the result)\b",
    ]
    for i, s in enumerate(sents[1:], 1):
        sl = s.lower()
        if any(re.search(p, sl) for p in topic_markers):
            transitions += 1
    return transitions

def count_pattern_matches(text, patterns_dict):
    """Count matches for each pattern in dict."""
    tl = text.lower()
    results = {}
    for name, pattern in patterns_dict.items():
        results[name] = len(re.findall(pattern, tl))
    return results

def extract_numbers(text):
    """Extract all numbers from text."""
    return re.findall(r'\b\d[\d,.]*\b', text)

def detect_demo_walkthrough(text):
    """Detect imperative demo instructions."""
    sents = sentences(text)
    imperative_count = 0
    imperative_patterns = [
        r"^(click|tap|go to|open|select|choose|enter|type|drag|scroll|navigate|look at|check|see|watch|notice)",
        r"^(let.s|let me|now|here|first|next|then)\s+(click|go|open|select|show|see|look|add|create)",
    ]
    for s in sents:
        sl = s.lower().strip()
        if any(re.match(p, sl) for p in imperative_patterns):
            imperative_count += 1
    return imperative_count

def problem_solution_ratio(text):
    """Estimate % of transcript devoted to problem vs solution."""
    sents = sentences(text)
    if not sents:
        return 0, 0
    problem_sents = 0
    solution_sents = 0
    for s in sents:
        sl = s.lower()
        if any(w in sl for w in ["problem", "issue", "challenge", "difficult", "pain",
                                  "frustrat", "broken", "wrong", "fail", "struggle",
                                  "waste", "lose", "miss", "hate", "tired", "annoying"]):
            problem_sents += 1
        if any(w in sl for w in ["solution", "solve", "fix", "build", "platform",
                                  "tool", "product", "feature", "help", "enable",
                                  "allow", "provid", "we built", "we created",
                                  "how it works", "what it does"]):
            solution_sents += 1
    total = len(sents)
    return round(problem_sents / total * 100, 1), round(solution_sents / total * 100, 1)

def has_pricing(text):
    """Detect pricing mentions."""
    return bool(re.search(r"\$\d|\bpric\w+\b|\bplan\b|\bfree tier\b|\bmonth\b.*\$|\bper month\b|\bper year\b", text.lower()))

def count_passive_voice(text):
    """Rough passive voice detector."""
    passive_pattern = r"\b(is|are|was|were|been|being)\s+\w+ed\b"
    return len(re.findall(passive_pattern, text.lower()))

def first_person_opener(text):
    """Check if transcript starts with first person."""
    first_words = text.lower().split()[:3]
    return any(w in ("i", "i'm", "i've", "we", "we're", "we've", "my", "our") for w in first_words)


# ─── Main analysis ───────────────────────────────────────────────────────────

def analyze_transcript(product):
    """Analyze a single product's transcript across all 66 dimensions."""
    transcript = product["transcript"]
    w = words(transcript)
    s = sentences(transcript)
    word_count = len(w)
    sent_count = len(s)
    text_lower = transcript.lower()

    # I. Opening & Hook
    hook_type = classify_hook(transcript)
    first_sentence = s[0] if s else ""
    first_sent_words = len(words(first_sentence))
    fp_opener = first_person_opener(transcript)
    neg_opener_words = [nw for nw in NEGATIVE_OPENERS if nw in first_sentence.lower().split()[:15]]

    # II. Length & Structure
    avg_sent_len = word_count / sent_count if sent_count else 0
    transitions = count_topic_transitions(transcript)
    arc = classify_narrative_arc(transcript)

    # III. Linguistic
    fk_grade = flesch_kincaid(transcript)
    total_syllables = sum(syllable_count(word) for word in w)
    syl_density = total_syllables / word_count if word_count else 0
    unique_words = len(set(ww.lower().strip(".,!?;:'\"") for ww in w))
    word_diversity = unique_words / word_count if word_count else 0
    pronoun_strategy, we_count, you_count = analyze_pronouns(transcript)
    hedge_count = sum(1 for hw in HEDGE_WORDS if hw in text_lower)
    confidence_count = sum(1 for cw in CONFIDENCE_WORDS if f" {cw} " in f" {text_lower} ")
    filler_count = sum(1 for fw in FILLER_WORDS if f" {fw} " in f" {text_lower} ")
    passive_count = count_passive_voice(transcript)

    # IV. Traction & Metrics
    numbers = extract_numbers(transcript)
    number_density = len(numbers) / (word_count / 100) if word_count else 0
    before_after = count_pattern_matches(transcript, BEFORE_AFTER)
    before_after_total = sum(before_after.values())
    success_claims = count_pattern_matches(transcript, SUCCESS_CLAIMS)
    success_total = sum(success_claims.values())

    # Metric placement (front-loaded vs back-loaded)
    if numbers and word_count > 20:
        first_number_pos = None
        for i, ww in enumerate(w):
            if re.match(r'\d', ww):
                first_number_pos = i / word_count
                break
        metric_placement = "front" if first_number_pos and first_number_pos < 0.33 else "middle" if first_number_pos and first_number_pos < 0.66 else "back"
    else:
        metric_placement = "none"

    # V. Social Proof
    brand_mentions = [b for b in BRANDS if b in text_lower]
    credential_patterns = {
        "ex_faang": bool(re.search(r"\bex[- ]?(google|meta|facebook|apple|amazon|microsoft)\b", text_lower)),
        "university": bool(re.search(r"\b(stanford|mit|harvard|yale|berkeley|oxford|cambridge)\b", text_lower)),
        "phd": bool(re.search(r"\bph\.?d\b", text_lower)),
    }
    investor_mentions = count_pattern_matches(transcript, {
        "raised": r"\braised\b",
        "backed_by": r"\bbacked by\b",
        "funded": r"\bfunded\b",
        "investors": r"\binvestors?\b",
        "vc": r"\bvc\b|\bventure\b",
    })
    has_testimonial = bool(re.search(r'["\u201c].{10,}["\u201d]', transcript)) or "said" in text_lower
    trusted_by = bool(re.search(r"\b(trusted by|used by|loved by|chosen by)\b", text_lower))
    partnership = bool(re.search(r"\b(partner\w*|collaborat\w*|teamed up)\b", text_lower))

    # VI. Competitive Framing
    comp_matches = count_pattern_matches(transcript, COMP_PHRASES)
    comp_total = sum(comp_matches.values())
    category_matches = count_pattern_matches(transcript, CATEGORY_CREATION)
    category_total = sum(category_matches.values())
    replacement_matches = count_pattern_matches(transcript, REPLACEMENT_FRAMING)
    replacement_total = sum(replacement_matches.values())

    # VII. CTA
    cta_matches = count_pattern_matches(transcript, CTA_PATTERNS)
    primary_cta = max(cta_matches, key=cta_matches.get) if any(cta_matches.values()) else "none"
    has_discount = bool(re.search(r"\b(free|% off|discount|no credit card|lifetime deal|coupon)\b", text_lower))
    has_scarcity = bool(re.search(r"\b(limited|exclusive|spots|only \d+|invite only|early access|beta)\b", text_lower))

    # CTA position
    cta_position = "none"
    for cta_name, cta_pat in CTA_PATTERNS.items():
        m = list(re.finditer(cta_pat, text_lower))
        if m:
            last_pos = m[-1].start() / len(text_lower) if len(text_lower) > 0 else 0
            if last_pos > 0.7:
                cta_position = "end"
            elif last_pos < 0.3:
                cta_position = "start"
            else:
                cta_position = "middle"
            break

    # VIII. Power Words
    buzzword_count = sum(1 for bw in BUZZWORDS if bw in text_lower)
    action_verb_count = sum(1 for av in ACTION_VERBS if av in text_lower)
    key_phrases = count_pattern_matches(transcript, KEY_PHRASES)
    ai_count = key_phrases.get("ai", 0)
    ai_density = ai_count / (word_count / 100) if word_count else 0

    # Sentiment (simple positive/negative word ratio)
    pos_words = sum(1 for pw in ["great", "amazing", "love", "best", "powerful", "fast",
                                  "easy", "simple", "beautiful", "incredible", "awesome",
                                  "perfect", "excellent", "wonderful"] if pw in text_lower)
    neg_words = sum(1 for nw in ["problem", "issue", "pain", "difficult", "hard", "slow",
                                  "broken", "frustrat", "hate", "terrible", "worst",
                                  "nightmare", "struggle", "fail"] if nw in text_lower)
    if pos_words > neg_words * 2:
        sentiment = "positive"
    elif neg_words > pos_words:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    # IX. PH-Specific
    demo_instructions = detect_demo_walkthrough(transcript)
    problem_pct, solution_pct = problem_solution_ratio(transcript)
    pricing = has_pricing(transcript)
    platform_mentions = sum(1 for pm in ["chrome", "firefox", "safari", "ios", "android",
                                          "windows", "mac", "linux", "slack", "notion",
                                          "figma", "github", "vscode", "vs code",
                                          "shopify", "wordpress", "zapier"] if pm in text_lower)

    # X. Video-Script Dimensions (from 200-dim visual analysis → transcript equivalents)

    # Before/after narrative structure (not just "cut X by Y%", but narrative "before" → "after" flow)
    before_after_narrative = bool(re.search(
        r"\b(before|without|used to|traditionally|the old way|the problem|imagine|picture this)"
        r".{10,300}"
        r"\b(now|with|after|instead|but with|here.s|that.s where|enter|meet|introducing)",
        text_lower, re.DOTALL
    ))

    # Declining emotional arc (positive start → urgency/problem at end)
    if len(s) >= 4:
        first_half = " ".join(s[:len(s)//2]).lower()
        second_half = " ".join(s[len(s)//2:]).lower()
        fh_pos = sum(1 for pw in ["great", "amazing", "love", "easy", "simple", "powerful",
                                    "beautiful", "fast", "awesome", "incredible"] if pw in first_half)
        sh_neg = sum(1 for nw in ["but", "however", "don't miss", "hurry", "limited",
                                    "before", "risk", "lose", "miss out", "waiting",
                                    "stop", "enough", "no more"] if nw in second_half)
        declining_arc = fh_pos >= 2 and sh_neg >= 1
    else:
        declining_arc = False

    # URL / website mention
    has_url = bool(re.search(r"\b(www\.|\.com|\.io|\.ai|\.co|\.dev|\.app|our website|visit us|check us out|go to our)\b", text_lower))

    # Questions throughout (not just opener)
    question_count = text_lower.count("?")
    questions_throughout = len(re.findall(r'[^.!?]*\?', transcript))

    # Data visualization cues ("as you can see", "this chart", "this graph", "the data shows")
    data_viz_cues = len(re.findall(
        r"\b(as you can see|this chart|this graph|the data|these numbers|this metric|look at|notice how|here you see|the results show)\b",
        text_lower
    ))

    # Narrating screen actions (pointing at what's visible)
    screen_narration = len(re.findall(
        r"\b(here you can see|on the left|on the right|at the top|at the bottom|in this view|this screen|this page|this section|right here|over here|down here|up here)\b",
        text_lower
    ))

    # Benefit-to-feature ratio (proper count)
    benefit_words = sum(1 for bw in ["save", "saves", "saving", "faster", "easier",
                                      "simpler", "better", "reduce", "reduces", "improve",
                                      "improves", "grow", "boost", "increase", "maximize",
                                      "minimize", "eliminate", "avoid", "prevent",
                                      "without", "no need", "never again", "stop wasting",
                                      "more time", "less time", "hours back"] if bw in text_lower)
    feature_words = sum(1 for fw in ["api", "sdk", "integration", "plugin", "module",
                                      "dashboard", "endpoint", "webhook", "oauth",
                                      "database", "backend", "frontend", "algorithm",
                                      "machine learning", "neural", "model", "pipeline",
                                      "microservice", "container", "kubernetes", "docker",
                                      "rest", "graphql", "typescript", "python"] if fw in text_lower)
    benefit_ratio = benefit_words / (benefit_words + feature_words) if (benefit_words + feature_words) > 0 else 0.5

    # Pacing / energy markers ("let me show you", "here's the best part", "and it gets better")
    energy_markers = len(re.findall(
        r"\b(let me show|here.s the (best|cool|interesting)|and it gets|but wait|"
        r"even better|the best part|but here.s|watch this|check this out|"
        r"and that.s not all|one more thing|here.s where it gets|"
        r"now here.s|pretty cool right|isn.t that|amazing right)\b",
        text_lower
    ))

    # Multiple speaker detection (name introductions, voice changes)
    speaker_changes = len(re.findall(
        r"\b(hi i.m|hey i.m|my name is|i.m [A-Z]|thanks [A-Z]|over to|back to you)\b",
        transcript.lower()
    ))
    # Also check for [Music], [Applause] etc. which indicate production elements
    production_markers = len(re.findall(r'\[(?:Music|Applause|Laughter|Sound)\]', transcript, re.IGNORECASE))

    # Feature count (explicit feature listing: "first...", "second...", "also...", "another...")
    feature_list_markers = len(re.findall(
        r"\b(first of all|first,|second,|secondly|third,|thirdly|also,|another|"
        r"number one|number two|number three|feature \d|the first feature|"
        r"additionally|furthermore|on top of that|what.s more|plus,|and also)\b",
        text_lower
    ))

    # Storytelling (personal anecdote markers)
    storytelling = bool(re.search(
        r"\b(i remember|we were|one day|last year|a few months ago|"
        r"when i was|back when|i used to|we started|the story|"
        r"it all started|it began|funny story|true story|"
        r"i was sitting|we realized|that.s when)\b",
        text_lower
    ))

    # Humor / lightness markers
    humor = bool(re.search(
        r"\b(just kidding|no pun intended|spoiler alert|plot twist|"
        r"not gonna lie|i know what you.re thinking|"
        r"believe it or not|fun fact|pro tip)\b",
        text_lower
    )) or "[Laughter]" in transcript or "[laughter]" in transcript

    # Social proof density (mentions of specific companies/users AS users, not just brand drops)
    social_proof_claims = len(re.findall(
        r"\b(companies like|teams at|used by|trusted by|loved by|"
        r"powering|serving|helping|supporting|working with)\s+\d*\s*\w+",
        text_lower
    ))

    # Closing strength (what the last 2 sentences contain)
    last_sents = " ".join(s[-2:]).lower() if len(s) >= 2 else text_lower[-100:]
    closing_has_cta = bool(re.search(r"\b(try|sign up|join|visit|check|get started|download|start)\b", last_sents))
    closing_has_url = bool(re.search(r"\b(www\.|\.com|\.io|\.ai|website|link)\b", last_sents))
    closing_has_thanks = bool(re.search(r"\b(thank|thanks|cheers|bye|see you)\b", last_sents))

    # Product name repetition (how many times does product name appear?)
    product_name_lower = product["name"].lower().split()[0]  # first word of product name
    if len(product_name_lower) >= 3:
        product_name_repeats = text_lower.count(product_name_lower)
    else:
        product_name_repeats = 0
    product_name_density = product_name_repeats / (word_count / 100) if word_count else 0

    return {
        # Meta
        "id": product["id"],
        "name": product["name"],
        "date": product["date"],
        "year": year(product["date"]),
        "quarter": quarter(product["date"]),
        "votes": product["votes"],
        "comments": product["comments"],
        "rank": product["rank"],
        "topics": product.get("topics", ""),
        "makers_count": len(product.get("makers", "").split(",")) if product.get("makers") else 0,

        # I. Opening & Hook
        "hook_type": hook_type,
        "first_sentence": first_sentence[:200],
        "first_sentence_words": first_sent_words,
        "first_person_opener": fp_opener,
        "negative_opener_words": neg_opener_words,
        "has_negative_opener": len(neg_opener_words) > 0,

        # II. Length & Structure
        "word_count": word_count,
        "sentence_count": sent_count,
        "avg_sentence_length": round(avg_sent_len, 1),
        "topic_transitions": transitions,
        "narrative_arc": arc,

        # III. Linguistic
        "flesch_kincaid_grade": round(fk_grade, 1),
        "syllable_density": round(syl_density, 2),
        "word_diversity": round(word_diversity, 3),
        "pronoun_strategy": pronoun_strategy,
        "we_count": we_count,
        "you_count": you_count,
        "hedge_count": hedge_count,
        "confidence_count": confidence_count,
        "filler_count": filler_count,
        "passive_voice_count": passive_count,

        # IV. Traction & Metrics
        "number_count": len(numbers),
        "number_density": round(number_density, 2),
        "metric_placement": metric_placement,
        "before_after": before_after,
        "before_after_total": before_after_total,
        "success_claims": success_claims,
        "success_total": success_total,

        # V. Social Proof
        "brand_mentions": brand_mentions,
        "brand_count": len(brand_mentions),
        "credentials": credential_patterns,
        "has_credential": any(credential_patterns.values()),
        "investor_mentions": investor_mentions,
        "has_investor_mention": sum(investor_mentions.values()) > 0,
        "has_testimonial": has_testimonial,
        "trusted_by": trusted_by,
        "has_partnership": partnership,

        # VI. Competitive Framing
        "competitive_phrases": comp_matches,
        "competitive_total": comp_total,
        "category_creation": category_matches,
        "category_creation_total": category_total,
        "replacement_framing": replacement_matches,
        "replacement_total": replacement_total,

        # VII. CTA
        "cta_matches": cta_matches,
        "primary_cta": primary_cta,
        "has_discount": has_discount,
        "has_scarcity": has_scarcity,
        "cta_position": cta_position,

        # VIII. Power Words
        "buzzword_count": buzzword_count,
        "action_verb_count": action_verb_count,
        "key_phrases": key_phrases,
        "ai_count": ai_count,
        "ai_density": round(ai_density, 2),
        "sentiment": sentiment,

        # IX. PH-Specific
        "demo_instructions": demo_instructions,
        "problem_pct": problem_pct,
        "solution_pct": solution_pct,
        "has_pricing": pricing,
        "platform_mentions": platform_mentions,

        # X. Video-Script Dimensions (from visual analysis → script equivalents)
        "before_after_narrative": before_after_narrative,
        "declining_arc": declining_arc,
        "has_url": has_url,
        "question_count": question_count,
        "questions_throughout": questions_throughout,
        "data_viz_cues": data_viz_cues,
        "screen_narration": screen_narration,
        "benefit_ratio": round(benefit_ratio, 3),
        "benefit_words": benefit_words,
        "feature_words": feature_words,
        "energy_markers": energy_markers,
        "speaker_changes": speaker_changes,
        "production_markers": production_markers,
        "feature_list_markers": feature_list_markers,
        "storytelling": storytelling,
        "humor": humor,
        "social_proof_claims": social_proof_claims,
        "closing_has_cta": closing_has_cta,
        "closing_has_url": closing_has_url,
        "closing_has_thanks": closing_has_thanks,
        "product_name_repeats": product_name_repeats,
        "product_name_density": round(product_name_density, 2),
    }


# ─── Aggregation & Report ───────────────────────────────────────────────────

def bucket(value, breaks):
    """Place value into a labeled bucket."""
    for i, (lo, hi, label) in enumerate(breaks):
        if lo <= value < hi:
            return label
    return breaks[-1][2]

WORD_BUCKETS = [
    (0, 50, "0-50"), (50, 100, "50-100"), (100, 150, "100-150"),
    (150, 200, "150-200"), (200, 300, "200-300"), (300, 500, "300-500"),
    (500, 99999, "500+"),
]

def generate_report(results):
    """Generate the full analysis report with temporal shifts."""
    lines = []
    L = lines.append

    L("# PH Transcript Analysis — Complete Findings")
    L("")
    L(f"**Dataset:** {len(results)} Product Hunt transcripts with ≥{MIN_WORDS} words.")
    L(f"**Date range:** {min(r['date'] for r in results)} to {max(r['date'] for r in results)}")
    L(f"**Vote range:** {min(r['votes'] for r in results)} to {max(r['votes'] for r in results)}")
    L(f"**Median votes:** {median([r['votes'] for r in results])}")
    L("")
    years_present = sorted(set(r['year'] for r in results))
    for y in years_present:
        yr = [r for r in results if r['year'] == y]
        L(f"- {y}: {len(yr)} transcripts, median {median([r['votes'] for r in yr])} votes")
    L("")
    L("---")
    L("")

    # ── 1. Opening Hooks ──
    L("## 1. Opening Hooks")
    L("")
    hook_groups = defaultdict(list)
    for r in results:
        hook_groups[r["hook_type"]].append(r["votes"])
    L("| Hook Type | n | Median Votes | Mean Votes |")
    L("|---|---|---|---|")
    for ht in sorted(hook_groups, key=lambda x: -median(hook_groups[x])):
        v = hook_groups[ht]
        L(f"| **{ht}** | {len(v)} | {median(v):.0f} | {mean(v):.0f} |")
    L("")

    # Temporal shift for hooks
    L("### Hook Type Shifts by Year")
    L("")
    L("| Hook Type | " + " | ".join(years_present) + " |")
    L("|---|" + "|".join(["---"] * len(years_present)) + "|")
    for ht in sorted(hook_groups, key=lambda x: -len(hook_groups[x]))[:8]:
        row = f"| {ht} |"
        for y in years_present:
            yr_hooks = [r["votes"] for r in results if r["year"] == y and r["hook_type"] == ht]
            if yr_hooks:
                row += f" {median(yr_hooks):.0f} (n={len(yr_hooks)}) |"
            else:
                row += " — |"
        L(row)
    L("")

    # First-person opener
    L("### First-Person Opener")
    L("")
    fp = [r["votes"] for r in results if r["first_person_opener"]]
    nfp = [r["votes"] for r in results if not r["first_person_opener"]]
    L(f"| | n | Median | Mean |")
    L(f"|---|---|---|---|")
    L(f"| First-person (I/We) | {len(fp)} | {median(fp):.0f} | {mean(fp):.0f} |")
    L(f"| Other | {len(nfp)} | {median(nfp):.0f} | {mean(nfp):.0f} |")
    L("")

    # Negative openers
    L("### Negative Opener Words")
    L("")
    for nw in ["broken", "tired", "hate", "frustrated", "problem", "struggle"]:
        hits = [r["votes"] for r in results if nw in [x.lower() for x in r.get("negative_opener_words", [])]]
        if hits:
            L(f"- **\"{nw}\"**: n={len(hits)}, median={median(hits):.0f}, mean={mean(hits):.0f}")
    L("")

    # Opening sentence length
    L("### Opening Sentence Length")
    L("")
    short_open = [r["votes"] for r in results if r["first_sentence_words"] <= 10]
    long_open = [r["votes"] for r in results if r["first_sentence_words"] > 10]
    L(f"| Length | n | Median |")
    L(f"|---|---|---|")
    L(f"| Short (≤10 words) | {len(short_open)} | {median(short_open):.0f} |")
    L(f"| Long (>10 words) | {len(long_open)} | {median(long_open):.0f} |")
    L("")

    L("---")
    L("")

    # ── 2. Transcript Length ──
    L("## 2. Transcript Length")
    L("")
    wc_groups = defaultdict(list)
    for r in results:
        b = bucket(r["word_count"], WORD_BUCKETS)
        wc_groups[b].append(r["votes"])

    L("| Word Count | n | Median | Mean |")
    L("|---|---|---|---|")
    for b_label in ["0-50", "50-100", "100-150", "150-200", "200-300", "300-500", "500+"]:
        v = wc_groups.get(b_label, [])
        if v:
            L(f"| {b_label} | {len(v)} | {median(v):.0f} | {mean(v):.0f} |")
    L("")

    # Correlation
    r_val, p_val = spearman_r([r["word_count"] for r in results], [r["votes"] for r in results])
    L(f"**Spearman r = {r_val:.3f}** (word count vs votes)")
    L("")

    # Temporal shift
    L("### Optimal Length by Year")
    L("")
    for y in years_present:
        yr = [r for r in results if r["year"] == y]
        wc_yr = defaultdict(list)
        for r in yr:
            b = bucket(r["word_count"], WORD_BUCKETS)
            wc_yr[b].append(r["votes"])
        best = max(wc_yr, key=lambda x: median(wc_yr[x])) if wc_yr else "—"
        best_med = median(wc_yr[best]) if best in wc_yr else 0
        L(f"- **{y}**: Best bucket = {best} (median {best_med:.0f})")
    L("")

    L("---")
    L("")

    # ── 3. Linguistic Patterns ──
    L("## 3. Linguistic Patterns")
    L("")

    # Sentence length correlation
    r_sl, _ = spearman_r([r["avg_sentence_length"] for r in results], [r["votes"] for r in results])
    L(f"- Avg sentence length vs votes: r = {r_sl:.3f}")

    # Word diversity
    r_wd, _ = spearman_r([r["word_diversity"] for r in results], [r["votes"] for r in results])
    L(f"- Word diversity vs votes: r = {r_wd:.3f}")

    # FK grade
    r_fk, _ = spearman_r([r["flesch_kincaid_grade"] for r in results], [r["votes"] for r in results])
    L(f"- Flesch-Kincaid grade vs votes: r = {r_fk:.3f}")
    L("")

    # Pronoun strategy
    L("### Pronoun Strategy")
    L("")
    pron_groups = defaultdict(list)
    for r in results:
        pron_groups[r["pronoun_strategy"]].append(r["votes"])
    L("| Strategy | n | Median |")
    L("|---|---|---|")
    for ps in sorted(pron_groups, key=lambda x: -median(pron_groups[x])):
        v = pron_groups[ps]
        L(f"| {ps} | {len(v)} | {median(v):.0f} |")
    L("")

    # Hedge words
    L("### Hedge Words")
    L("")
    has_hedge = [r["votes"] for r in results if r["hedge_count"] > 0]
    no_hedge = [r["votes"] for r in results if r["hedge_count"] == 0]
    L(f"| | n | Median |")
    L(f"|---|---|---|")
    L(f"| Has hedge words | {len(has_hedge)} | {median(has_hedge):.0f} |")
    L(f"| No hedge words | {len(no_hedge)} | {median(no_hedge):.0f} |")
    L("")

    # Filler words
    L("### Filler Words")
    L("")
    r_fill, _ = spearman_r([r["filler_count"] for r in results], [r["votes"] for r in results])
    L(f"Spearman r = {r_fill:.3f} (filler count vs votes)")
    L("")

    L("---")
    L("")

    # ── 4. Narrative Arc ──
    L("## 4. Narrative Arc")
    L("")
    arc_groups = defaultdict(list)
    for r in results:
        arc_groups[r["narrative_arc"]].append(r["votes"])
    L("| Arc | n | Median | Mean |")
    L("|---|---|---|---|")
    for a in sorted(arc_groups, key=lambda x: -median(arc_groups[x]))[:10]:
        v = arc_groups[a]
        if len(v) >= 5:
            L(f"| {a} | {len(v)} | {median(v):.0f} | {mean(v):.0f} |")
    L("")

    # Topic transitions
    L("### Topic Transitions")
    L("")
    trans_groups = defaultdict(list)
    for r in results:
        t = r["topic_transitions"]
        if t <= 2:
            trans_groups["focused (≤2)"].append(r["votes"])
        elif t <= 5:
            trans_groups["mid (3-5)"].append(r["votes"])
        else:
            trans_groups["choppy (≥6)"].append(r["votes"])
    L("| Density | n | Median |")
    L("|---|---|---|")
    for td in ["focused (≤2)", "mid (3-5)", "choppy (≥6)"]:
        v = trans_groups.get(td, [])
        if v:
            L(f"| {td} | {len(v)} | {median(v):.0f} |")
    L("")

    # Problem/Solution ratio
    L("### Problem vs Solution Time")
    L("")
    r_prob, _ = spearman_r([r["problem_pct"] for r in results], [r["votes"] for r in results])
    r_sol, _ = spearman_r([r["solution_pct"] for r in results], [r["votes"] for r in results])
    L(f"- Problem % vs votes: r = {r_prob:.3f}")
    L(f"- Solution % vs votes: r = {r_sol:.3f}")
    L("")

    L("---")
    L("")

    # ── 5. Traction & Metrics ──
    L("## 5. Traction & Metrics")
    L("")

    # Number density
    r_nd, _ = spearman_r([r["number_density"] for r in results], [r["votes"] for r in results])
    L(f"Number density vs votes: r = {r_nd:.3f}")
    L("")

    # Metric count buckets
    L("### Metric Count")
    L("")
    mc_groups = defaultdict(list)
    for r in results:
        nc = r["number_count"]
        if nc == 0:
            mc_groups["0"].append(r["votes"])
        elif nc <= 2:
            mc_groups["1-2"].append(r["votes"])
        elif nc <= 5:
            mc_groups["3-5"].append(r["votes"])
        else:
            mc_groups["6+"].append(r["votes"])
    L("| Metrics | n | Median |")
    L("|---|---|---|")
    for mc in ["0", "1-2", "3-5", "6+"]:
        v = mc_groups.get(mc, [])
        if v:
            L(f"| {mc} | {len(v)} | {median(v):.0f} |")
    L("")

    # Metric placement
    L("### Metric Placement")
    L("")
    mp_groups = defaultdict(list)
    for r in results:
        mp_groups[r["metric_placement"]].append(r["votes"])
    L("| Position | n | Median |")
    L("|---|---|---|")
    for mp in ["front", "middle", "back", "none"]:
        v = mp_groups.get(mp, [])
        if v:
            L(f"| {mp} | {len(v)} | {median(v):.0f} |")
    L("")

    # Before/after claims
    L("### Before/After Claims")
    L("")
    has_ba = [r["votes"] for r in results if r["before_after_total"] > 0]
    no_ba = [r["votes"] for r in results if r["before_after_total"] == 0]
    L(f"| | n | Median |")
    L(f"|---|---|---|")
    L(f"| Has before/after | {len(has_ba)} | {median(has_ba):.0f} |")
    L(f"| No before/after | {len(no_ba)} | {median(no_ba):.0f} |")
    L("")

    # Success claims by type
    L("### Success Claim Types")
    L("")
    for sc_type in SUCCESS_CLAIMS:
        has_sc = [r["votes"] for r in results if r["success_claims"].get(sc_type, 0) > 0]
        if len(has_sc) >= 5:
            L(f"- **{sc_type}**: n={len(has_sc)}, median={median(has_sc):.0f}")
    L("")

    L("---")
    L("")

    # ── 6. Social Proof ──
    L("## 6. Social Proof & Credibility")
    L("")

    # Brand mentions
    has_brand = [r["votes"] for r in results if r["brand_count"] > 0]
    no_brand = [r["votes"] for r in results if r["brand_count"] == 0]
    L(f"| | n | Median |")
    L(f"|---|---|---|")
    L(f"| Has brand mention | {len(has_brand)} | {median(has_brand):.0f} |")
    L(f"| No brands | {len(no_brand)} | {median(no_brand):.0f} |")
    L("")

    # Top brands
    L("### Top Brands by Median Votes")
    L("")
    brand_votes = defaultdict(list)
    for r in results:
        for b in r["brand_mentions"]:
            brand_votes[b].append(r["votes"])
    L("| Brand | n | Median |")
    L("|---|---|---|")
    for b in sorted(brand_votes, key=lambda x: -median(brand_votes[x]))[:15]:
        v = brand_votes[b]
        if len(v) >= 5:
            L(f"| {b} | {len(v)} | {median(v):.0f} |")
    L("")

    # Investor mentions
    has_inv = [r["votes"] for r in results if r["has_investor_mention"]]
    no_inv = [r["votes"] for r in results if not r["has_investor_mention"]]
    L(f"Investor mention: has={len(has_inv)} (median {median(has_inv):.0f}), no={len(no_inv)} (median {median(no_inv):.0f})")
    L("")

    # Trusted by
    has_trust = [r["votes"] for r in results if r["trusted_by"]]
    no_trust = [r["votes"] for r in results if not r["trusted_by"]]
    L(f"\"Trusted by\": has={len(has_trust)} (median {median(has_trust):.0f}), no={len(no_trust)} (median {median(no_trust):.0f})")
    L("")

    L("---")
    L("")

    # ── 7. Competitive Framing ──
    L("## 7. Competitive Framing")
    L("")
    for cp_name in COMP_PHRASES:
        has_cp = [r["votes"] for r in results if r["competitive_phrases"].get(cp_name, 0) > 0]
        if len(has_cp) >= 3:
            L(f"- **{cp_name}**: n={len(has_cp)}, median={median(has_cp):.0f}")
    L("")

    # Category creation
    L("### Category Creation Language")
    L("")
    for cc_name in CATEGORY_CREATION:
        has_cc = [r["votes"] for r in results if r["category_creation"].get(cc_name, 0) > 0]
        if len(has_cc) >= 3:
            L(f"- **{cc_name}**: n={len(has_cc)}, median={median(has_cc):.0f}")
    L("")

    # Replacement framing
    L("### Replacement Framing")
    L("")
    has_rep = [r["votes"] for r in results if r["replacement_total"] > 0]
    no_rep = [r["votes"] for r in results if r["replacement_total"] == 0]
    L(f"Has replacement framing: n={len(has_rep)}, median={median(has_rep):.0f}")
    L(f"No replacement framing: n={len(no_rep)}, median={median(no_rep):.0f}")
    L("")

    L("---")
    L("")

    # ── 8. Call to Action ──
    L("## 8. Call to Action")
    L("")
    cta_groups = defaultdict(list)
    for r in results:
        cta_groups[r["primary_cta"]].append(r["votes"])
    L("| CTA Type | n | Median |")
    L("|---|---|---|")
    for ct in sorted(cta_groups, key=lambda x: -median(cta_groups[x])):
        v = cta_groups[ct]
        if len(v) >= 5:
            L(f"| {ct} | {len(v)} | {median(v):.0f} |")
    L("")

    # Discount
    has_disc = [r["votes"] for r in results if r["has_discount"]]
    no_disc = [r["votes"] for r in results if not r["has_discount"]]
    L(f"Discount language: has={len(has_disc)} (median {median(has_disc):.0f}), no={len(no_disc)} (median {median(no_disc):.0f})")
    L("")

    # Scarcity
    has_scar = [r["votes"] for r in results if r["has_scarcity"]]
    no_scar = [r["votes"] for r in results if not r["has_scarcity"]]
    L(f"Scarcity language: has={len(has_scar)} (median {median(has_scar):.0f}), no={len(no_scar)} (median {median(no_scar):.0f})")
    L("")

    # CTA position
    L("### CTA Position")
    L("")
    cp_groups = defaultdict(list)
    for r in results:
        cp_groups[r["cta_position"]].append(r["votes"])
    L("| Position | n | Median |")
    L("|---|---|---|")
    for cp in ["start", "middle", "end", "none"]:
        v = cp_groups.get(cp, [])
        if v:
            L(f"| {cp} | {len(v)} | {median(v):.0f} |")
    L("")

    L("---")
    L("")

    # ── 9. Key Phrases ──
    L("## 9. Key Phrases & Power Words")
    L("")
    L("| Phrase | n | Median | Diff vs Rest |")
    L("|---|---|---|---|")
    overall_med = median([r["votes"] for r in results])
    for kp in sorted(KEY_PHRASES.keys()):
        has_kp = [r["votes"] for r in results if r["key_phrases"].get(kp, 0) > 0]
        if len(has_kp) >= 5:
            diff = median(has_kp) - overall_med
            L(f"| {kp} | {len(has_kp)} | {median(has_kp):.0f} | {diff:+.0f} |")
    L("")

    # Buzzwords
    L("### Buzzwords")
    L("")
    has_buzz = [r["votes"] for r in results if r["buzzword_count"] > 0]
    no_buzz = [r["votes"] for r in results if r["buzzword_count"] == 0]
    L(f"Has buzzwords: n={len(has_buzz)}, median={median(has_buzz):.0f}")
    L(f"No buzzwords: n={len(no_buzz)}, median={median(no_buzz):.0f}")
    L("")

    # Action verbs
    L("### Action Verbs")
    L("")
    r_av, _ = spearman_r([r["action_verb_count"] for r in results], [r["votes"] for r in results])
    L(f"Action verb count vs votes: r = {r_av:.3f}")
    L("")

    # AI density
    L("### AI Mention Density")
    L("")
    has_ai = [r["votes"] for r in results if r["ai_count"] > 0]
    no_ai = [r["votes"] for r in results if r["ai_count"] == 0]
    L(f"Mentions AI: n={len(has_ai)}, median={median(has_ai):.0f}")
    L(f"No AI mention: n={len(no_ai)}, median={median(no_ai):.0f}")
    L("")

    # Temporal AI shift
    L("### AI Mention by Year")
    L("")
    for y in years_present:
        yr_ai = [r["votes"] for r in results if r["year"] == y and r["ai_count"] > 0]
        yr_noai = [r["votes"] for r in results if r["year"] == y and r["ai_count"] == 0]
        pct = len(yr_ai) / (len(yr_ai) + len(yr_noai)) * 100 if (yr_ai or yr_noai) else 0
        L(f"- {y}: {pct:.0f}% mention AI | with AI median={median(yr_ai):.0f}, without={median(yr_noai):.0f}")
    L("")

    L("---")
    L("")

    # ── 10. Sentiment ──
    L("## 10. Sentiment")
    L("")
    sent_groups = defaultdict(list)
    for r in results:
        sent_groups[r["sentiment"]].append(r["votes"])
    L("| Sentiment | n | Median |")
    L("|---|---|---|")
    for s in ["positive", "neutral", "negative"]:
        v = sent_groups.get(s, [])
        if v:
            L(f"| {s} | {len(v)} | {median(v):.0f} |")
    L("")

    L("---")
    L("")

    # ── 11. Demo & Pricing ──
    L("## 11. Demo Walkthrough & Pricing")
    L("")
    has_demo = [r["votes"] for r in results if r["demo_instructions"] > 0]
    no_demo = [r["votes"] for r in results if r["demo_instructions"] == 0]
    L(f"Has demo walkthrough: n={len(has_demo)}, median={median(has_demo):.0f}")
    L(f"No demo: n={len(no_demo)}, median={median(no_demo):.0f}")
    L("")

    has_price = [r["votes"] for r in results if r["has_pricing"]]
    no_price = [r["votes"] for r in results if not r["has_pricing"]]
    L(f"Mentions pricing: n={len(has_price)}, median={median(has_price):.0f}")
    L(f"No pricing: n={len(no_price)}, median={median(no_price):.0f}")
    L("")

    L("---")
    L("")

    # ═══════════════════════════════════════════════════════════════════════
    # VIDEO-SCRIPT DIMENSIONS (from 200-dim visual analysis)
    # ═══════════════════════════════════════════════════════════════════════

    L("## 12. Video-Script Dimensions")
    L("")
    L("These dimensions translate the 200 visual/audio findings into script-level patterns.")
    L("")

    # Before/after narrative
    has_ban = [r["votes"] for r in results if r["before_after_narrative"]]
    no_ban = [r["votes"] for r in results if not r["before_after_narrative"]]
    L(f"### Before/After Narrative Structure")
    L(f"Has before→after flow: n={len(has_ban)}, median={median(has_ban):.0f}")
    L(f"No before/after: n={len(no_ban)}, median={median(no_ban):.0f}")
    L("")

    # Declining arc
    has_dec = [r["votes"] for r in results if r["declining_arc"]]
    no_dec = [r["votes"] for r in results if not r["declining_arc"]]
    L(f"### Declining Emotional Arc (positive start → urgency at end)")
    L(f"Has declining arc: n={len(has_dec)}, median={median(has_dec):.0f}")
    L(f"No declining arc: n={len(no_dec)}, median={median(no_dec):.0f}")
    L("")

    # URL mention
    has_u = [r["votes"] for r in results if r["has_url"]]
    no_u = [r["votes"] for r in results if not r["has_url"]]
    L(f"### URL/Website Mention")
    L(f"Mentions URL: n={len(has_u)}, median={median(has_u):.0f}")
    L(f"No URL: n={len(no_u)}, median={median(no_u):.0f}")
    L("")

    # Questions throughout
    r_qt, _ = spearman_r([r["question_count"] for r in results], [r["votes"] for r in results])
    L(f"### Questions Throughout Script")
    L(f"Question marks vs votes: r = {r_qt:.3f}")
    L("")

    # Data viz
    r_dv, _ = spearman_r([r["data_viz_cues"] for r in results], [r["votes"] for r in results])
    L(f"### Data Visualization Narration")
    L(f"Data viz cues vs votes: r = {r_dv:.3f}")
    L("")

    # Screen narration
    r_sn, _ = spearman_r([r["screen_narration"] for r in results], [r["votes"] for r in results])
    L(f"### Screen Narration ('here you can see', 'on the left')")
    L(f"Screen narration vs votes: r = {r_sn:.3f}")
    L("")

    # Benefit ratio
    r_br, _ = spearman_r([r["benefit_ratio"] for r in results], [r["votes"] for r in results])
    L(f"### Benefit-to-Feature Ratio")
    L(f"Benefit ratio vs votes: r = {r_br:.3f}")
    br_groups = defaultdict(list)
    for r in results:
        if r["benefit_ratio"] >= 0.7:
            br_groups["benefit-heavy (≥70%)"].append(r["votes"])
        elif r["benefit_ratio"] <= 0.3:
            br_groups["feature-heavy (≤30%)"].append(r["votes"])
        else:
            br_groups["balanced"].append(r["votes"])
    L("| Ratio | n | Median |")
    L("|---|---|---|")
    for br_label in ["benefit-heavy (≥70%)", "balanced", "feature-heavy (≤30%)"]:
        v = br_groups.get(br_label, [])
        if v:
            L(f"| {br_label} | {len(v)} | {median(v):.0f} |")
    L("")

    # Energy markers
    r_em, _ = spearman_r([r["energy_markers"] for r in results], [r["votes"] for r in results])
    L(f"### Energy/Pacing Markers")
    L(f"Energy markers vs votes: r = {r_em:.3f}")
    L("")

    # Storytelling
    has_story = [r["votes"] for r in results if r["storytelling"]]
    no_story = [r["votes"] for r in results if not r["storytelling"]]
    L(f"### Storytelling/Anecdote")
    L(f"Has storytelling: n={len(has_story)}, median={median(has_story):.0f}")
    L(f"No storytelling: n={len(no_story)}, median={median(no_story):.0f}")
    L("")

    # Humor
    has_humor = [r["votes"] for r in results if r["humor"]]
    no_humor = [r["votes"] for r in results if not r["humor"]]
    L(f"### Humor/Lightness")
    L(f"Has humor: n={len(has_humor)}, median={median(has_humor):.0f}")
    L(f"No humor: n={len(no_humor)}, median={median(no_humor):.0f}")
    L("")

    # Feature list markers
    r_fl, _ = spearman_r([r["feature_list_markers"] for r in results], [r["votes"] for r in results])
    L(f"### Feature Listing ('first...', 'second...', 'also...')")
    L(f"Feature list markers vs votes: r = {r_fl:.3f}")
    L("")

    # Speaker changes
    has_multi = [r["votes"] for r in results if r["speaker_changes"] > 1]
    no_multi = [r["votes"] for r in results if r["speaker_changes"] <= 1]
    L(f"### Multiple Speakers")
    L(f"Multiple speakers: n={len(has_multi)}, median={median(has_multi):.0f}")
    L(f"Single speaker: n={len(no_multi)}, median={median(no_multi):.0f}")
    L("")

    # Product name density
    r_pn, _ = spearman_r([r["product_name_density"] for r in results], [r["votes"] for r in results])
    L(f"### Product Name Repetition")
    L(f"Name density vs votes: r = {r_pn:.3f}")
    pn_groups = defaultdict(list)
    for r in results:
        pnd = r["product_name_density"]
        if pnd == 0:
            pn_groups["0 mentions"].append(r["votes"])
        elif pnd < 2:
            pn_groups["light (0-2/100w)"].append(r["votes"])
        elif pnd < 5:
            pn_groups["moderate (2-5/100w)"].append(r["votes"])
        else:
            pn_groups["heavy (5+/100w)"].append(r["votes"])
    L("| Density | n | Median |")
    L("|---|---|---|")
    for pn_label in ["0 mentions", "light (0-2/100w)", "moderate (2-5/100w)", "heavy (5+/100w)"]:
        v = pn_groups.get(pn_label, [])
        if v:
            L(f"| {pn_label} | {len(v)} | {median(v):.0f} |")
    L("")

    # Closing patterns
    L("### Closing Patterns (last 2 sentences)")
    L("")
    close_dims = [
        ("closing_has_cta", "CTA in closing"),
        ("closing_has_url", "URL in closing"),
        ("closing_has_thanks", "Thanks/bye in closing"),
    ]
    L("| Closing Element | Has (n, median) | Without (n, median) |")
    L("|---|---|---|")
    for ck, cn in close_dims:
        has_c = [r["votes"] for r in results if r[ck]]
        no_c = [r["votes"] for r in results if not r[ck]]
        L(f"| {cn} | {len(has_c)}, {median(has_c):.0f} | {len(no_c)}, {median(no_c):.0f} |")
    L("")

    # Social proof claims
    r_sp, _ = spearman_r([r["social_proof_claims"] for r in results], [r["votes"] for r in results])
    L(f"### Social Proof Claims ('companies like X', 'used by Y')")
    L(f"Social proof claims vs votes: r = {r_sp:.3f}")
    L("")

    # Production markers
    has_prod = [r["votes"] for r in results if r["production_markers"] > 0]
    no_prod = [r["votes"] for r in results if r["production_markers"] == 0]
    L(f"### Production Elements ([Music], [Applause])")
    L(f"Has production markers: n={len(has_prod)}, median={median(has_prod):.0f}")
    L(f"No markers: n={len(no_prod)}, median={median(no_prod):.0f}")
    L("")

    L("---")
    L("")

    # ═══════════════════════════════════════════════════════════════════════
    # TEMPORAL ANALYSIS — THE BIG SHIFTS
    # ═══════════════════════════════════════════════════════════════════════

    L("## 13. TEMPORAL SHIFTS — What Changed Year Over Year")
    L("")
    L("This is the core finding: which dimensions are shifting over time on PH.")
    L("")

    # Compute per-year correlations for each numeric dimension
    numeric_dims = [
        ("word_count", "Transcript Length"),
        ("avg_sentence_length", "Avg Sentence Length"),
        ("word_diversity", "Word Diversity"),
        ("flesch_kincaid_grade", "Reading Level (FK)"),
        ("hedge_count", "Hedge Words"),
        ("confidence_count", "Confidence Words"),
        ("filler_count", "Filler Words"),
        ("number_density", "Number Density"),
        ("before_after_total", "Before/After Claims"),
        ("brand_count", "Brand Mentions"),
        ("competitive_total", "Competitive Phrases"),
        ("buzzword_count", "Buzzwords"),
        ("action_verb_count", "Action Verbs"),
        ("ai_count", "AI Mentions"),
        ("ai_density", "AI Density"),
        ("demo_instructions", "Demo Instructions"),
        ("problem_pct", "Problem %"),
        ("solution_pct", "Solution %"),
        ("platform_mentions", "Platform Mentions"),
        ("passive_voice_count", "Passive Voice"),
        ("we_count", "We-Pronouns"),
        ("you_count", "You-Pronouns"),
        ("topic_transitions", "Topic Transitions"),
        ("success_total", "Success Claims"),
        # X. Video-Script dimensions
        ("question_count", "Questions Throughout"),
        ("questions_throughout", "Question Sentences"),
        ("data_viz_cues", "Data Viz Narration"),
        ("screen_narration", "Screen Narration"),
        ("benefit_ratio", "Benefit Ratio"),
        ("benefit_words", "Benefit Words"),
        ("feature_words", "Feature Words"),
        ("energy_markers", "Energy/Pacing Markers"),
        ("speaker_changes", "Speaker Changes"),
        ("feature_list_markers", "Feature List Markers"),
        ("social_proof_claims", "Social Proof Claims"),
        ("product_name_repeats", "Product Name Repeats"),
        ("product_name_density", "Product Name Density"),
        ("production_markers", "Production Markers ([Music] etc)"),
    ]

    # Per-year correlation table
    L("### Per-Year Spearman Correlations (dimension vs votes)")
    L("")
    L("| Dimension | " + " | ".join(years_present) + " | Shift (first→last) |")
    L("|---|" + "|".join(["---"] * len(years_present)) + "|---|")

    shifts = []
    for dim_key, dim_name in numeric_dims:
        row = f"| {dim_name} |"
        year_rs = {}
        for y in years_present:
            yr = [r for r in results if r["year"] == y]
            if len(yr) >= 20:
                r_val, _ = spearman_r([r[dim_key] for r in yr], [r["votes"] for r in yr])
                year_rs[y] = r_val
                star = "*" if abs(r_val) > 0.1 else ""
                row += f" {r_val:+.3f}{star} |"
            else:
                row += " — |"
        if len(year_rs) >= 2:
            first_y = min(year_rs.keys())
            last_y = max(year_rs.keys())
            shift = year_rs[last_y] - year_rs[first_y]
            shifts.append((dim_name, shift, year_rs))
            row += f" {shift:+.3f} |"
        else:
            row += " — |"
        L(row)
    L("")
    L("\\* = |r| > 0.10 (directionally meaningful)")
    L("")

    # Top shifts
    L("### Biggest Shifts (sorted by |shift|)")
    L("")
    shifts.sort(key=lambda x: -abs(x[1]))
    L("| Dimension | Shift | Direction | Interpretation |")
    L("|---|---|---|---|")
    for dim_name, shift_val, yr_rs in shifts[:15]:
        direction = "↑ growing" if shift_val > 0 else "↓ declining"
        first_y = min(yr_rs.keys())
        last_y = max(yr_rs.keys())
        L(f"| {dim_name} | {shift_val:+.3f} | {direction} | {yr_rs.get(first_y, 0):+.3f} ({first_y}) → {yr_rs.get(last_y, 0):+.3f} ({last_y}) |")
    L("")

    # ── Boolean dimension shifts ──
    L("### Boolean Dimension Shifts")
    L("")
    bool_dims = [
        ("first_person_opener", "First-Person Opener"),
        ("has_negative_opener", "Negative Opener"),
        ("has_discount", "Discount Language"),
        ("has_scarcity", "Scarcity Language"),
        ("has_pricing", "Pricing Mention"),
        ("has_testimonial", "Testimonial/Quote"),
        ("trusted_by", "Trusted-By Pattern"),
        ("has_investor_mention", "Investor Mention"),
        ("has_credential", "Founder Credential"),
        ("has_partnership", "Partnership Mention"),
        # X. Video-Script booleans
        ("before_after_narrative", "Before/After Narrative"),
        ("declining_arc", "Declining Emotional Arc"),
        ("has_url", "URL/Website Mention"),
        ("storytelling", "Storytelling/Anecdote"),
        ("humor", "Humor/Lightness"),
        ("closing_has_cta", "CTA in Closing"),
        ("closing_has_url", "URL in Closing"),
        ("closing_has_thanks", "Thanks/Bye in Closing"),
    ]

    L("| Dimension | " + " | ".join(years_present) + " |")
    L("|---|" + "|".join(["---"] * len(years_present)) + "|")
    for dim_key, dim_name in bool_dims:
        row = f"| {dim_name} |"
        for y in years_present:
            yr = [r for r in results if r["year"] == y]
            has = [r for r in yr if r[dim_key]]
            no = [r for r in yr if not r[dim_key]]
            pct = len(has) / len(yr) * 100 if yr else 0
            med_diff = median([r["votes"] for r in has]) - median([r["votes"] for r in no]) if has and no else 0
            row += f" {pct:.0f}% ({med_diff:+.0f}) |"
        L(row)
    L("")
    L("Format: usage% (median vote lift vs without)")
    L("")

    # ── Hook type shifts ──
    L("### Hook Type Market Share by Year")
    L("")
    L("| Hook | " + " | ".join(years_present) + " |")
    L("|---|" + "|".join(["---"] * len(years_present)) + "|")
    all_hooks = sorted(set(r["hook_type"] for r in results))
    for ht in all_hooks:
        row = f"| {ht} |"
        for y in years_present:
            yr = [r for r in results if r["year"] == y]
            ht_yr = [r for r in yr if r["hook_type"] == ht]
            pct = len(ht_yr) / len(yr) * 100 if yr else 0
            row += f" {pct:.0f}% |"
        L(row)
    L("")

    # ── CTA shifts ──
    L("### CTA Type Shifts")
    L("")
    L("| CTA | " + " | ".join(years_present) + " |")
    L("|---|" + "|".join(["---"] * len(years_present)) + "|")
    all_ctas = sorted(set(r["primary_cta"] for r in results))
    for ct in all_ctas:
        row = f"| {ct} |"
        for y in years_present:
            yr = [r for r in results if r["year"] == y]
            ct_yr = [r for r in yr if r["primary_cta"] == ct]
            pct = len(ct_yr) / len(yr) * 100 if yr else 0
            med = median([r["votes"] for r in ct_yr]) if ct_yr else 0
            row += f" {pct:.0f}% (med {med:.0f}) |"
        L(row)
    L("")

    # ── Narrative arc shifts ──
    L("### Narrative Arc Shifts")
    L("")
    L("| Arc | " + " | ".join(years_present) + " |")
    L("|---|" + "|".join(["---"] * len(years_present)) + "|")
    top_arcs = [a for a, v in arc_groups.items() if len(v) >= 20]
    for a in sorted(top_arcs):
        row = f"| {a} |"
        for y in years_present:
            yr = [r for r in results if r["year"] == y]
            a_yr = [r for r in yr if r["narrative_arc"] == a]
            pct = len(a_yr) / len(yr) * 100 if yr else 0
            med = median([r["votes"] for r in a_yr]) if a_yr else 0
            row += f" {pct:.0f}% (med {med:.0f}) |"
        L(row)
    L("")

    # ── Sentiment shifts ──
    L("### Sentiment Shift")
    L("")
    L("| Sentiment | " + " | ".join(years_present) + " |")
    L("|---|" + "|".join(["---"] * len(years_present)) + "|")
    for s in ["positive", "neutral", "negative"]:
        row = f"| {s} |"
        for y in years_present:
            yr = [r for r in results if r["year"] == y]
            s_yr = [r for r in yr if r["sentiment"] == s]
            pct = len(s_yr) / len(yr) * 100 if yr else 0
            med = median([r["votes"] for r in s_yr]) if s_yr else 0
            row += f" {pct:.0f}% (med {med:.0f}) |"
        L(row)
    L("")

    L("---")
    L("")

    # ═══════════════════════════════════════════════════════════════════════
    # QUARTERLY DEEP DIVE
    # ═══════════════════════════════════════════════════════════════════════

    L("## 14. Quarterly Deep Dive")
    L("")
    quarters_present = sorted(set(r["quarter"] for r in results))

    # Key metrics per quarter
    L("| Quarter | n | Med Votes | Avg Words | AI % | Demo % | FP Opener % | Neg Opener % | Scarcity % |")
    L("|---|---|---|---|---|---|---|---|---|")
    for q in quarters_present:
        qr = [r for r in results if r["quarter"] == q]
        if len(qr) < 5:
            continue
        med_v = median([r["votes"] for r in qr])
        avg_w = mean([r["word_count"] for r in qr])
        ai_pct = sum(1 for r in qr if r["ai_count"] > 0) / len(qr) * 100
        demo_pct = sum(1 for r in qr if r["demo_instructions"] > 0) / len(qr) * 100
        fp_pct = sum(1 for r in qr if r["first_person_opener"]) / len(qr) * 100
        neg_pct = sum(1 for r in qr if r["has_negative_opener"]) / len(qr) * 100
        scar_pct = sum(1 for r in qr if r["has_scarcity"]) / len(qr) * 100
        L(f"| {q} | {len(qr)} | {med_v:.0f} | {avg_w:.0f} | {ai_pct:.0f}% | {demo_pct:.0f}% | {fp_pct:.0f}% | {neg_pct:.0f}% | {scar_pct:.0f}% |")
    L("")

    L("---")
    L("")

    # ═══════════════════════════════════════════════════════════════════════
    # TOP PERFORMERS
    # ═══════════════════════════════════════════════════════════════════════

    L("## 15. Top 1% Deep Dive")
    L("")
    sorted_results = sorted(results, key=lambda x: -x["votes"])
    top_pct = max(1, len(results) // 100)
    top = sorted_results[:top_pct]

    L(f"**Top {top_pct} products** (top 1% by votes)")
    L("")
    L("| Name | Votes | Hook | Arc | Words | AI | CTA |")
    L("|---|---|---|---|---|---|---|")
    for r in top[:20]:
        L(f"| {r['name']} | {r['votes']} | {r['hook_type']} | {r['narrative_arc']} | {r['word_count']} | {r['ai_count']} | {r['primary_cta']} |")
    L("")

    # Top 1% trait comparison
    L("### Top 1% vs Dataset")
    L("")
    all_med_words = median([r["word_count"] for r in results])
    top_med_words = median([r["word_count"] for r in top])
    L(f"| Trait | Top 1% | Dataset |")
    L(f"|---|---|---|")
    L(f"| Median word count | {top_med_words:.0f} | {all_med_words:.0f} |")
    L(f"| AI mention % | {sum(1 for r in top if r['ai_count'] > 0) / len(top) * 100:.0f}% | {sum(1 for r in results if r['ai_count'] > 0) / len(results) * 100:.0f}% |")
    L(f"| Has metrics | {sum(1 for r in top if r['number_count'] > 0) / len(top) * 100:.0f}% | {sum(1 for r in results if r['number_count'] > 0) / len(results) * 100:.0f}% |")
    L(f"| First-person opener | {sum(1 for r in top if r['first_person_opener']) / len(top) * 100:.0f}% | {sum(1 for r in results if r['first_person_opener']) / len(results) * 100:.0f}% |")
    L(f"| Has brand mention | {sum(1 for r in top if r['brand_count'] > 0) / len(top) * 100:.0f}% | {sum(1 for r in results if r['brand_count'] > 0) / len(results) * 100:.0f}% |")
    L(f"| Has scarcity | {sum(1 for r in top if r['has_scarcity']) / len(top) * 100:.0f}% | {sum(1 for r in results if r['has_scarcity']) / len(results) * 100:.0f}% |")
    L(f"| Has discount | {sum(1 for r in top if r['has_discount']) / len(top) * 100:.0f}% | {sum(1 for r in results if r['has_discount']) / len(results) * 100:.0f}% |")
    L(f"| Demo walkthrough | {sum(1 for r in top if r['demo_instructions'] > 0) / len(top) * 100:.0f}% | {sum(1 for r in results if r['demo_instructions'] > 0) / len(results) * 100:.0f}% |")
    L("")

    # Top openers
    L("### Best Openers")
    L("")
    for r in sorted_results[:10]:
        L(f"- **{r['name']}** ({r['votes']}v): *\"{r['first_sentence'][:120]}\"*")
    L("")

    L("---")
    L("")

    # ═══════════════════════════════════════════════════════════════════════
    # BOTTOM 10% ANTI-PATTERNS
    # ═══════════════════════════════════════════════════════════════════════

    L("## 16. Bottom 10% Anti-Patterns")
    L("")
    bottom_pct = max(1, len(results) // 10)
    bottom = sorted_results[-bottom_pct:]

    L(f"**Bottom {bottom_pct} products** (bottom 10%)")
    L("")
    L(f"| Trait | Bottom 10% | Top 10% | Gap |")
    L(f"|---|---|---|---|")
    top10 = sorted_results[:bottom_pct]
    traits_compare = [
        ("Has AI mention", lambda r: r["ai_count"] > 0),
        ("Has metrics", lambda r: r["number_count"] > 0),
        ("First-person opener", lambda r: r["first_person_opener"]),
        ("Has discount", lambda r: r["has_discount"]),
        ("Has buzzwords", lambda r: r["buzzword_count"] > 0),
        ("Demo walkthrough", lambda r: r["demo_instructions"] > 0),
        ("Has scarcity", lambda r: r["has_scarcity"]),
        ("Has brand mention", lambda r: r["brand_count"] > 0),
        ("Negative opener", lambda r: r["has_negative_opener"]),
    ]
    for trait_name, trait_fn in traits_compare:
        bot_pct = sum(1 for r in bottom if trait_fn(r)) / len(bottom) * 100
        top_pct_val = sum(1 for r in top10 if trait_fn(r)) / len(top10) * 100
        gap = top_pct_val - bot_pct
        L(f"| {trait_name} | {bot_pct:.0f}% | {top_pct_val:.0f}% | {gap:+.0f}pp |")
    L("")

    L("---")
    L("")

    # ═══════════════════════════════════════════════════════════════════════
    # CROSS-CORRELATIONS
    # ═══════════════════════════════════════════════════════════════════════

    L("## 17. Cross-Correlations — All Dimensions vs Votes")
    L("")
    L("| Dimension | Spearman r | p-approx | Direction |")
    L("|---|---|---|---|")
    all_corrs = []
    for dim_key, dim_name in numeric_dims:
        vals = [r[dim_key] for r in results]
        votes = [r["votes"] for r in results]
        r_val, p_val = spearman_r(vals, votes)
        all_corrs.append((dim_name, r_val, p_val))

    all_corrs.sort(key=lambda x: -abs(x[1]))
    for dim_name, r_val, p_val in all_corrs:
        direction = "+" if r_val > 0 else "−"
        star = "**" if abs(r_val) > 0.05 else ""
        L(f"| {star}{dim_name}{star} | {r_val:+.3f} | {p_val:.4f} | {direction} |")
    L("")

    L("---")
    L("")
    L(f"*Analysis generated {datetime.now().strftime('%Y-%m-%d %H:%M')}*")
    L(f"*{len(results)} transcripts analyzed across 66 dimensions*")

    return "\n".join(lines)


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print(f"Loading {INPUT_FILE}...")
    with open(INPUT_FILE) as f:
        data = json.load(f)

    # Filter to valid transcripts
    transcripts = [
        d for d in data
        if d.get("transcript") and d["transcript"].strip()
        and d.get("transcript_status") == "ok"
        and len(d["transcript"].split()) >= MIN_WORDS
    ]
    print(f"Analyzing {len(transcripts)} transcripts (≥{MIN_WORDS} words)...")

    # Analyze each
    results = []
    for i, product in enumerate(transcripts):
        if (i + 1) % 200 == 0:
            print(f"  {i+1}/{len(transcripts)}...")
        result = analyze_transcript(product)
        results.append(result)

    # Save structured results
    print(f"Saving {OUTPUT_JSON}...")
    with open(OUTPUT_JSON, "w") as f:
        json.dump(results, f, indent=2, default=str)

    # Generate report
    print(f"Generating {OUTPUT_REPORT}...")
    report = generate_report(results)
    with open(OUTPUT_REPORT, "w") as f:
        f.write(report)

    print(f"Done. {len(results)} products analyzed.")
    print(f"  → {OUTPUT_JSON} ({os.path.getsize(OUTPUT_JSON) / 1024 / 1024:.1f} MB)")
    print(f"  → {OUTPUT_REPORT} ({os.path.getsize(OUTPUT_REPORT) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
