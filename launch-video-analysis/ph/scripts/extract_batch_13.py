#!/usr/bin/env python3
"""
Extract 200 dimensions from Product Hunt launch video transcripts.
Batch 13 — 85 transcripts.
"""

import json
import re
import math
from collections import Counter

def syllable_count(word):
    """Estimate syllable count for a word."""
    word = word.lower().strip()
    if not word:
        return 0
    if len(word) <= 3:
        return 1
    word = re.sub(r'(?:[^laeiouy]es|ed|[^laeiouy]e)$', '', word)
    word = re.sub(r'^y', '', word)
    vowel_groups = re.findall(r'[aeiouy]+', word)
    return max(1, len(vowel_groups))


def count_passive_voice(sentences):
    """Count passive voice constructions."""
    count = 0
    passive_re = re.compile(r'\b(?:is|are|was|were|been|being|be)\s+\w+(?:ed|en|t)\b', re.I)
    for s in sentences:
        if passive_re.search(s):
            count += 1
    return count


def flesch_kincaid(words, sentences, syllables):
    """Compute Flesch-Kincaid grade level."""
    if sentences == 0 or words == 0:
        return 0.0
    return 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59


def get_sentences(text):
    """Split text into sentences. Handles auto-transcribed text with minimal punctuation."""
    # First try standard punctuation splitting
    sents = re.split(r'[.!?]+', text)
    sents = [s.strip() for s in sents if s.strip() and len(s.strip().split()) >= 2]

    # If we got very few sentences relative to word count, the text likely lacks punctuation
    # (auto-transcribed). Split on natural speech boundaries instead.
    word_count = len(text.split())
    if len(sents) <= 2 and word_count > 40:
        # Split on common speech transition patterns
        chunks = re.split(
            r'\b(?:so |and then |but |however |now |also |then |because |'
            r'which |when |where |while |if you |once you |'
            r'another |the next |additionally |first |second |third |'
            r'for example |in addition |on top of |basically |'
            r'essentially |the way |what we |let me |here you |'
            r'you can also |we also |it also |this is |that is |'
            r'this means |that means )',
            text, flags=re.I
        )
        # Filter and ensure reasonable lengths
        result = []
        for chunk in chunks:
            chunk = chunk.strip()
            if len(chunk.split()) >= 4:
                # Further split very long chunks (~every 15-25 words)
                words = chunk.split()
                if len(words) > 30:
                    for i in range(0, len(words), 20):
                        sub = ' '.join(words[i:i+20])
                        if len(sub.split()) >= 4:
                            result.append(sub)
                else:
                    result.append(chunk)
        return result if result else [text]

    return sents if sents else [text]


def get_words(text):
    """Get list of words from text."""
    return re.findall(r"[a-zA-Z']+", text.lower())


def word_in_first_pct(text, word_list, pct):
    """Check if any word from word_list appears in first pct% of text."""
    cutoff = int(len(text) * pct)
    segment = text[:cutoff].lower()
    return any(w in segment for w in word_list)


def find_position(text, patterns):
    """Find normalized position (0-1) of first match of any pattern."""
    text_lower = text.lower()
    best = -1
    for p in patterns:
        idx = text_lower.find(p.lower())
        if idx >= 0:
            pos = idx / max(len(text), 1)
            if best < 0 or pos < best:
                best = pos
    return best if best >= 0 else -1


def count_pattern(text, patterns):
    """Count occurrences of any pattern in text (case insensitive)."""
    total = 0
    text_lower = text.lower()
    for p in patterns:
        total += text_lower.count(p.lower())
    return total


def extract_dimensions(item):
    """Extract all 200 dimensions from a single transcript."""
    tid = item["id"]
    name = item.get("name", "")
    transcript = item.get("transcript", "")

    if not transcript or len(transcript.strip()) < 10:
        # Return defaults for empty/near-empty transcripts
        return make_empty(tid)

    text = transcript
    text_lower = text.lower()
    words = get_words(text)
    word_count = len(words)
    sentences = get_sentences(text)
    sentence_count = max(len(sentences), 1)

    # Precompute
    word_freq = Counter(words)
    unique_words = len(word_freq)
    total_syllables = sum(syllable_count(w) for w in words)

    first_sentence = sentences[0] if sentences else ""
    first_sentence_words_list = first_sentence.split()
    last_sentences = sentences[-3:] if len(sentences) >= 3 else sentences
    last_text = " ".join(last_sentences).lower()

    # Product name detection
    product_name = name.lower().strip()
    product_name_words = product_name.split()

    # ========== V1 DIMENSIONS ==========

    # --- Opening (6 dims) ---
    hook_type = classify_hook(first_sentence, text_lower)

    first_words_lower = first_sentence.lower() if first_sentence else ""
    first_person_opener = 1 if re.match(r"^(i |i'|we |we')", first_words_lower) else 0

    neg_words = ["broken", "tired", "hate", "frustrated", "problem", "struggle", "pain", "annoying", "sick of", "fed up", "waste", "fail", "terrible", "awful", "worst"]
    has_negative_opener = 1 if any(w in first_words_lower for w in neg_words) else 0

    first_sentence_word_count = len(first_sentence_words_list)

    hook_quality = rate_hook_quality(first_sentence, hook_type, word_count)

    # --- Length & Readability (6 dims) ---
    avg_sentence_length = round(word_count / sentence_count, 1)
    fk_grade = round(flesch_kincaid(word_count, sentence_count, total_syllables), 1)
    word_diversity = round(unique_words / max(word_count, 1), 3)
    syll_density = round(total_syllables / max(word_count, 1), 2)

    # --- Pronouns & Voice (5 dims) ---
    we_words = ["we", "our", "us", "we're", "we've", "we'll", "ourselves"]
    you_words = ["you", "your", "you're", "you've", "you'll", "yourself", "yourselves"]
    we_count = sum(word_freq.get(w, 0) for w in we_words)
    you_count = sum(word_freq.get(w, 0) for w in you_words)

    if we_count > you_count * 1.5:
        pronoun_strategy = "mostly_we"
    elif you_count > we_count * 1.5:
        pronoun_strategy = "mostly_you"
    elif we_count + you_count < 3:
        pronoun_strategy = "neutral"
    else:
        pronoun_strategy = "balanced"

    hedge_words = ["maybe", "perhaps", "might", "kind of", "sort of", "arguably", "possibly", "potentially"]
    hedge_count = count_pattern(text, hedge_words)

    filler_words_list = ["um", "uh", "basically", "actually", "literally", "so yeah", "you know"]
    filler_count = count_pattern(text, filler_words_list)
    # Also count "like" used as filler (rough heuristic: "like" not preceded by "looks/feel/would/")
    like_count = text_lower.count(" like ")
    filler_count += max(0, like_count - 2)  # Allow a couple non-filler uses

    # --- Narrative Arc (5 dims) ---
    problem_keywords = ["problem", "issue", "challenge", "struggle", "pain", "difficult", "hard", "frustrated", "broken", "waste", "tedious", "manual", "time-consuming", "complex", "complicated"]
    solution_keywords = ["solution", "solve", "fix", "build", "create", "introduce", "launch", "product", "tool", "platform", "app", "feature", "allows", "enables", "helps"]

    # Split text into thirds
    third = max(len(text) // 3, 1)
    first_third = text_lower[:third]
    mid_third = text_lower[third:2*third]
    last_third = text_lower[2*third:]

    prob_first = sum(first_third.count(w) for w in problem_keywords)
    prob_mid = sum(mid_third.count(w) for w in problem_keywords)
    prob_last = sum(last_third.count(w) for w in problem_keywords)
    sol_first = sum(first_third.count(w) for w in solution_keywords)
    sol_mid = sum(mid_third.count(w) for w in solution_keywords)
    sol_last = sum(last_third.count(w) for w in solution_keywords)

    total_prob = prob_first + prob_mid + prob_last
    total_sol = sol_first + sol_mid + sol_last

    if word_count < 30:
        narrative_arc = "too_short"
    elif total_prob == 0 and total_sol == 0:
        narrative_arc = "neutral_flat"
    elif prob_first > sol_first and sol_mid + sol_last > prob_mid + prob_last:
        narrative_arc = "problem_solution"
    elif sol_first >= prob_first and total_sol > total_prob:
        narrative_arc = "solution_first"
    elif total_prob > total_sol * 2:
        narrative_arc = "problem_heavy"
    elif sol_first > 0 and prob_first == 0 and total_sol > total_prob:
        narrative_arc = "traction_first"
    else:
        narrative_arc = "neutral_flat"

    topic_transitions = estimate_topic_transitions(sentences)

    problem_pct = round(total_prob / max(total_prob + total_sol, 1) * 100, 1)
    solution_pct = round(total_sol / max(total_prob + total_sol, 1) * 100, 1)

    # declining_arc: starts positive, ends urgent/dark
    positive_start = any(w in first_third for w in ["great", "amazing", "love", "exciting", "happy", "wonderful"])
    dark_end = any(w in last_third for w in ["hurry", "limited", "don't miss", "before it's too late", "running out", "last chance", "urgent"])
    declining_arc = 1 if positive_start and dark_end else 0

    # --- Metrics & Traction (8 dims) ---
    numbers = re.findall(r'\b\d[\d,.]*\b', text)
    number_count = len(numbers)
    number_density = round(number_count / max(word_count, 1) * 100, 2)

    # metric_placement
    nums_first = len(re.findall(r'\b\d[\d,.]*\b', first_third))
    nums_mid = len(re.findall(r'\b\d[\d,.]*\b', mid_third))
    nums_last = len(re.findall(r'\b\d[\d,.]*\b', last_third))
    if number_count == 0:
        metric_placement = "none"
    elif nums_first >= nums_mid and nums_first >= nums_last:
        metric_placement = "front"
    elif nums_mid >= nums_first and nums_mid >= nums_last:
        metric_placement = "middle"
    else:
        metric_placement = "back"

    before_after_patterns = ["before and after", "before/after", "used to.*now", "went from.*to", "was.*now it's", "compared to before", "previously.*now"]
    before_after_total = sum(1 for p in before_after_patterns if re.search(p, text_lower))

    user_patterns = [r'\b\d[\d,]*\+?\s*(?:users|customers|teams|companies|clients|subscribers|members|people use)', r'trusted by \d', r'used by \d']
    success_users = sum(1 for p in user_patterns if re.search(p, text_lower))

    revenue_patterns = [r'\$[\d,.]+[kmb]?\s*(?:arr|mrr|revenue|sales)', r'revenue of', r'making \$', r'generating \$', r'arr of']
    success_revenue = sum(1 for p in revenue_patterns if re.search(p, text_lower))

    cost_patterns = ["save.*\$", "saving.*\$", "reduce.*cost", "cut.*cost", "cheaper", "cost saving", "saves.*money"]
    success_cost_savings = sum(1 for p in cost_patterns if re.search(p, text_lower))

    growth_patterns = [r'\d+[x%]\s*(?:growth|increase|faster|more|improvement)', "grew by", "growing at", "month over month", "year over year", "doubled", "tripled"]
    success_growth = sum(1 for p in growth_patterns if re.search(p, text_lower))

    # --- Social Proof (10 dims) ---
    known_brands = ["google", "apple", "microsoft", "amazon", "meta", "facebook", "netflix", "spotify", "slack", "notion", "figma", "stripe", "shopify", "salesforce", "hubspot", "zoom", "github", "gitlab", "aws", "azure", "gcp", "openai", "anthropic", "uber", "airbnb", "dropbox", "twitter", "linkedin", "instagram", "tiktok", "youtube", "twitch", "discord", "reddit", "pinterest", "snapchat", "whatsapp", "telegram", "signal", "asana", "trello", "jira", "confluence", "monday", "clickup", "linear", "vercel", "netlify", "heroku", "docker", "kubernetes", "terraform", "datadog", "splunk", "snowflake", "databricks", "tableau", "power bi", "looker", "mixpanel", "amplitude", "segment", "intercom", "zendesk", "freshdesk", "mailchimp", "sendgrid", "twilio", "plaid", "airtable", "coda", "webflow", "wordpress", "squarespace", "wix", "canva", "adobe", "photoshop", "illustrator", "premiere", "after effects", "chatgpt", "midjourney", "stable diffusion", "claude", "gemini", "copilot", "tesla", "samsung", "sony", "nvidia", "intel", "amd"]
    brand_count = sum(1 for b in known_brands if b in text_lower and b != product_name)

    investor_patterns = ["investor", "funded", "funding", "raised", "venture", "capital", "vc ", "seed round", "series a", "series b", "backed by", "y combinator", "yc ", "techstars", "angels"]
    has_investor_mention = 1 if any(p in text_lower for p in investor_patterns) else 0

    testimonial_patterns = ["said", "told us", "quote", "according to", "one user said", "a customer", "they said", "\""]
    has_testimonial = 1 if (any(p in text_lower for p in testimonial_patterns) and "user" in text_lower or "customer" in text_lower) else 0
    # Also check for quoted speech
    if '"' in text or "'" in text:
        # Check if it looks like a testimonial
        if re.search(r'(?:user|customer|client|team|company)\s+(?:said|told|mentioned|shared)', text_lower):
            has_testimonial = 1

    trusted_by = 1 if "trusted by" in text_lower else 0

    partnership_words = ["partner", "partnership", "partnered", "integration with", "integrated with", "works with", "collaborat"]
    has_partnership = 1 if any(p in text_lower for p in partnership_words) else 0

    credential_patterns = ["ex-google", "ex-meta", "ex-facebook", "ex-amazon", "ex-apple", "ex-microsoft", "formerly at", "worked at google", "worked at meta", "phd", "ph.d", "stanford", "mit ", "harvard", "berkeley", "oxford", "cambridge", "professor", "years of experience", "years in"]
    has_credential = 1 if any(p in text_lower for p in credential_patterns) else 0

    social_proof_claims = has_investor_mention + has_testimonial + trusted_by + has_partnership + has_credential + min(brand_count, 3) + success_users

    # platform_mentions: count distinct tool/platform names
    platform_mentions = brand_count

    competitive_patterns = ["unlike", "compared to", "better than", "faster than", "cheaper than", "more than", "instead of using", "alternative to", "competitor", "vs ", "versus"]
    competitive_total = count_pattern(text, competitive_patterns)

    replacement_patterns = ["replace", "replaces", "replacing", "switch from", "stop using", "ditch", "forget about", "say goodbye to", "no more.*using"]
    replacement_total = sum(1 for p in replacement_patterns if re.search(p, text_lower))

    # --- Category & Positioning (4 dims) ---
    category_patterns = ["the first", "the only", "a new kind", "we invented", "world's first", "first ever", "first of its kind", "never been done", "pioneering", "groundbreaking"]
    category_creation_total = count_pattern(text, category_patterns)

    ai_terms = ["artificial intelligence", " ai ", " ai.", " ai,", "machine learning", " ml ", "neural network", "deep learning", "language model", "llm", "gpt", "chatgpt", "openai", "generative ai", "gen ai"]
    ai_count = count_pattern(text, ai_terms)
    ai_density = round(ai_count / max(word_count, 1) * 100, 2)

    buzzwords = ["revolutionary", "game-changing", "game changer", "cutting-edge", "cutting edge", "disruptive", "next-generation", "next generation", "next gen", "paradigm shift", "synergy", "blockchain", "web3", "metaverse", "quantum leap"]
    buzzword_count = count_pattern(text, buzzwords)

    # --- CTA & Closing (8 dims) ---
    cta_map = {
        "waitlist": ["waitlist", "wait list", "waiting list"],
        "join": ["join us", "join today", "join now"],
        "sign_up": ["sign up", "signup", "register"],
        "try": ["try it", "try now", "try for free", "give it a try"],
        "get_started": ["get started", "start now", "start today", "start free"],
        "book_demo": ["book a demo", "schedule a demo", "request a demo"],
        "free": ["for free", "it's free", "free to use", "free plan", "free tier", "no credit card"],
        "beta": ["beta", "early access"],
        "limited": ["limited", "exclusive access", "only.*spots"]
    }

    primary_cta = "none"
    for cta_type, patterns in cta_map.items():
        if any(p in text_lower for p in patterns):
            primary_cta = cta_type
            break

    # cta_position
    cta_all_patterns = []
    for patterns in cta_map.values():
        cta_all_patterns.extend(patterns)

    cta_pos = find_position(text, cta_all_patterns)
    if cta_pos < 0:
        cta_position = "none"
    elif cta_pos < 0.25:
        cta_position = "start"
    elif cta_pos < 0.75:
        cta_position = "middle"
    else:
        cta_position = "end"

    has_discount = 1 if any(w in text_lower for w in ["discount", "% off", "deal", "offer", "coupon", "promo", "special price", "sale price"]) else 0

    has_scarcity = 1 if any(w in text_lower for w in ["limited", "exclusive", "only.*spots", "running out", "last chance", "hurry", "before it's gone", "invite only"]) else 0
    if re.search(r"only \d+ spots", text_lower):
        has_scarcity = 1

    has_pricing = 1 if any(w in text_lower for w in ["pricing", "price", "per month", "/month", "/year", "per year", "free plan", "pro plan", "enterprise plan", "starts at", "starting at", "$"]) else 0

    has_url = 1 if re.search(r'(?:\.com|\.io|\.ai|\.co|\.app|\.dev|\.org|\.net|www\.)', text_lower) else 0

    closing_has_cta_val = 1 if any(p in last_text for p in cta_all_patterns) else 0

    thanks_patterns = ["thank", "thanks", "bye", "goodbye", "see you", "cheers", "appreciate"]
    closing_has_thanks = 1 if any(p in last_text for p in thanks_patterns) else 0

    # --- Content Signals (15 dims) ---
    storytelling = 1 if any(w in text_lower for w in ["one day", "i remember", "story", "back when", "years ago", "there was a time", "i was working", "when i was", "it all started", "the moment"]) else 0

    humor = 1 if any(w in text_lower for w in ["haha", "lol", "funny", "joke", "laugh", "hilarious", "ridiculous", "absurd"]) else 0
    # Check for light humor markers
    if text.count("!") > 3 and any(w in text_lower for w in ["crazy", "insane", "wild", "nuts"]):
        humor = 1

    demo_patterns = ["click here", "let me show you", "as you can see", "i'll show you", "let me demonstrate", "watch how", "watch as", "here I", "here i"]
    demo_instructions = count_pattern(text, demo_patterns)

    screen_patterns = ["here you can see", "on the left", "on the right", "at the top", "at the bottom", "on this screen", "on the screen", "right here", "over here", "this button", "this panel", "this section", "this page", "this tab"]
    screen_narration = count_pattern(text, screen_patterns)

    data_viz_patterns = ["chart", "graph", "dashboard", "visualization", "data viz", "plot", "metrics", "analytics dashboard", "report"]
    data_viz_cues = count_pattern(text, data_viz_patterns)

    energy_markers = text.count("!") + count_pattern(text, ["amazing", "awesome", "incredible", "fantastic", "brilliant", "love it", "wow", "boom", "super"])

    feature_list_patterns = ["first", "second", "third", "fourth", "also", "in addition", "furthermore", "moreover", "another", "next up", "on top of that", "plus"]
    feature_list_markers = count_pattern(text, feature_list_patterns)

    production_markers_patterns = ["[music]", "[applause]", "[laughter]", "[sound]", "[video]", "[screen", "[intro]", "[outro]"]
    production_markers = count_pattern(text, production_markers_patterns)

    # Speaker changes
    speaker_change_patterns = [r'\b[A-Z][a-z]+:', r'\bSpeaker \d']
    speaker_changes = sum(len(re.findall(p, text)) for p in speaker_change_patterns)
    # Also check for clear dialogue shifts
    if "interviewer" in text_lower or "host" in text_lower:
        speaker_changes = max(speaker_changes, 2)

    action_verbs = ["build", "create", "launch", "ship", "deploy", "automate", "generate", "transform", "connect", "integrate", "analyze", "track", "manage", "monitor", "optimize", "scale", "sync", "import", "export", "customize", "configure", "design", "develop", "test", "run", "execute"]
    action_verb_count = sum(word_freq.get(v, 0) for v in action_verbs)

    feature_descriptors = ["feature", "functionality", "capability", "module", "component", "api", "endpoint", "sdk", "plugin", "extension", "widget", "dashboard", "interface", "tool", "editor", "builder"]
    feature_words = count_pattern(text, feature_descriptors)

    benefit_descriptors = ["save time", "increase", "improve", "reduce", "boost", "faster", "easier", "simpler", "better", "more efficient", "productivity", "streamline", "automate", "eliminate", "save money", "grow", "scale", "convert", "retain"]
    benefit_words = count_pattern(text, benefit_descriptors)

    benefit_ratio = round(benefit_words / max(benefit_words + feature_words, 1), 2)

    question_count = text.count("?")

    passive_voice_count = count_passive_voice(sentences)

    # --- Sentiment (3 dims) ---
    pos_words = ["great", "amazing", "awesome", "love", "best", "excellent", "wonderful", "fantastic", "incredible", "beautiful", "powerful", "brilliant", "perfect", "outstanding"]
    neg_words_sent = ["bad", "terrible", "awful", "worst", "hate", "broken", "failed", "frustrating", "annoying", "painful", "nightmare", "horrible"]
    pos_count = count_pattern(text, pos_words)
    neg_count = count_pattern(text, neg_words_sent)

    if pos_count > neg_count * 2:
        sentiment = "positive"
    elif neg_count > pos_count * 2:
        sentiment = "negative"
    else:
        sentiment = "neutral" if pos_count + neg_count < 3 else "positive"

    confidence_words = ["will", "definitely", "guaranteed", "proven", "absolutely", "certainly", "undoubtedly", "without a doubt", "100%"]
    confidence_count = count_pattern(text, confidence_words)

    # product_name_repeats
    if product_name and len(product_name) > 1:
        product_name_repeats = text_lower.count(product_name)
        # Also try without spaces for compound names
        for pw in product_name_words:
            if len(pw) > 2:
                product_name_repeats = max(product_name_repeats, text_lower.count(pw))
    else:
        product_name_repeats = 0

    # ========== V2 DIMENSIONS ==========

    # --- A. Story Architecture (17 dims) ---

    inciting_incident_patterns = ["one day", "i remember when", "it all started", "that's when", "the moment i", "last year", "back in", "i was sitting", "i was working", "i realized", "it hit me", "that day", "my.*bill was", "i noticed", "we discovered"]
    inciting_incident = 1 if any(p in text_lower for p in inciting_incident_patterns) else 0

    villain_patterns = ["spreadsheet", "excel", "email", "manual", "legacy", "old way", "the problem with", "traditional", "outdated", "broken system", "status quo", "existing tool", "current solution", "copy.paste", "copy and paste"]
    villain_named = 1 if any(p in text_lower for p in villain_patterns) else 0
    villain_count = sum(1 for p in villain_patterns if p in text_lower)
    villain_count = min(villain_count, 5)  # Cap

    stakes_patterns = ["costs money", "loses customer", "waste hours", "burnout", "losing", "costing", "risk", "dangerous", "expensive", "millions", "hours wasted"]
    stakes_escalation = 0
    if total_prob > 0:
        # Check if problem intensity increases through the text
        if prob_last > prob_first or any(p in last_third for p in stakes_patterns):
            stakes_escalation = 1

    transform_patterns = ["go from.*to", "become", "transform how", "never again", "turn you into", "from.*to.*in", "change the way"]
    transformation_promise = 1 if any(re.search(p, text_lower) for p in transform_patterns) else 0

    if transformation_promise:
        transform_pos = -1
        for p in transform_patterns:
            m = re.search(p, text_lower)
            if m:
                pos = m.start() / max(len(text), 1)
                if transform_pos < 0 or pos < transform_pos:
                    transform_pos = pos
                break
        transformation_position = round(transform_pos, 2)
    else:
        transformation_position = -1

    # pivot_sharpness
    pivot_phrases = ["so we built", "introducing", "that's why we", "enter ", "meet ", "here's where", "the solution", "that's where.*comes in"]
    pivot_found = any(re.search(p, text_lower) for p in pivot_phrases)
    if not pivot_found:
        pivot_sharpness = 2
    elif total_prob > 0 and total_sol > 0:
        pivot_sharpness = 4
    else:
        pivot_sharpness = 3
    # Adjust based on narrative structure
    if narrative_arc == "problem_solution":
        pivot_sharpness = min(5, pivot_sharpness + 1)
    elif narrative_arc == "solution_first":
        pivot_sharpness = max(1, pivot_sharpness - 1)

    nested_stories = 1 if any(p in text_lower for p in ["one of our users", "a customer of ours", "one of our customers", "for example.*told us", "case study", "a team at", "one company"]) else 0

    time_patterns = [r'\b\d+\s*(?:year|month|week|day|hour|minute|second)s?\b', r'\blast (?:year|month|week|quarter)\b', r'\bin \d{4}\b', r'\b\d+ years? ago\b', r'\bwithin \w+\b']
    temporal_anchors = sum(len(re.findall(p, text_lower)) for p in time_patterns)

    imagine_patterns = ["imagine", "picture this", "what if you could", "think about", "envision", "consider a world"]
    imagine_device = count_pattern(text, imagine_patterns)

    cliffhanger_patterns = ["but here's the thing", "and then", "wait until", "the best part", "you won't believe", "here's where it gets", "but wait", "and here's the kicker", "and that's not all"]
    cliffhanger_beats = count_pattern(text, cliffhanger_patterns)

    why_now_patterns = ["now that", "for the first time", "finally possible", "with the rise of", "in today's", "the market is", "now with ai", "thanks to", "recent advances", "new technology", "now more than ever"]
    why_now = 1 if any(p in text_lower for p in why_now_patterns) else 0

    # journey_vs_destination
    journey_words = ["takes you", "guides you", "walks you through", "journey", "path", "road to", "step by step", "from.*to"]
    destination_words = ["the solution", "the tool", "the platform", "the app for", "your.*hub", "the answer", "everything you need"]
    j_count = sum(1 for p in journey_words if re.search(p, text_lower))
    d_count = count_pattern(text, destination_words)
    if j_count + d_count == 0:
        journey_vs_destination = 0.5
    else:
        journey_vs_destination = round(j_count / (j_count + d_count), 2)

    # emotional_bookend_match
    if len(sentences) >= 4:
        opening_tone = "positive" if any(w in sentences[0].lower() for w in pos_words) else ("negative" if any(w in sentences[0].lower() for w in neg_words_sent + neg_words) else "neutral")
        closing_tone = "positive" if any(w in last_text for w in pos_words + ["try", "start", "join", "free"]) else ("negative" if any(w in last_text for w in neg_words_sent) else "neutral")
        emotional_bookend_match = 1 if (opening_tone == "negative" and closing_tone == "positive") or (opening_tone == closing_tone and opening_tone != "neutral") else 0
    else:
        emotional_bookend_match = 0

    unsaid_patterns = ["you know that feeling", "we've all been there", "sound familiar", "you know how it is", "we all know", "you know what i mean", "isn't it"]
    unsaid_problem = count_pattern(text, unsaid_patterns)

    # resolution_completeness
    if total_prob == 0:
        resolution_completeness = 1.0
    elif total_sol == 0:
        resolution_completeness = 0.0
    else:
        resolution_completeness = round(min(total_sol / max(total_prob, 1), 1.0), 2)

    # story_compression: how much narrative time per sentence? 1-5
    # High = covering years in few words, Low = minute-by-minute
    if word_count < 30:
        story_compression = 1.0
    elif temporal_anchors >= 4 and word_count < 500:
        story_compression = 5.0  # Many time references compressed into short text
    elif temporal_anchors >= 3 and word_count < 800:
        story_compression = 4.0
    elif temporal_anchors >= 2:
        story_compression = 3.0
    elif demo_instructions > 2 or screen_narration > 2:
        story_compression = 1.0  # Step-by-step walkthrough = low compression
    elif storytelling:
        story_compression = 3.0
    elif word_count > 500:
        story_compression = 2.0  # Long without time markers = detailed
    else:
        story_compression = 2.0

    # --- B. Emotional Mechanics (17 dims) ---

    # emotion_specificity: 1=generic, 5=vivid situated emotions
    specific_emotion_patterns = ["that feeling when", "sinking feeling", "rush when", "relief of", "dread of", "joy of", "frustration of waiting", "panic when", "at 2am", "on a friday", "monday morning", "you know the pain", "that moment when", "picture yourself", "late at night", "staring at", "waking up to", "middle of the night"]
    spec_count = sum(1 for p in specific_emotion_patterns if p in text_lower)
    generic_emotion = count_pattern(text, ["frustrated", "happy", "sad", "angry", "excited", "love", "hate", "amazing", "great", "terrible", "painful", "annoying", "overwhelming"])
    situated_emotion = count_pattern(text, ["when you", "every time you", "imagine having", "remember when", "you've been", "you know how", "have you ever", "we all know", "you've probably", "tired of", "sick of", "fed up"])
    # Scenarios that paint a picture
    scenario_emotion = count_pattern(text, ["let's say you", "picture this", "imagine you", "what if your", "think about when", "say you're", "suppose you"])

    total_emotion_signals = spec_count * 3 + scenario_emotion * 2 + situated_emotion + generic_emotion * 0.5
    if total_emotion_signals >= 6:
        emotion_specificity = 5
    elif total_emotion_signals >= 4:
        emotion_specificity = 4
    elif total_emotion_signals >= 2.5:
        emotion_specificity = 3
    elif total_emotion_signals >= 1:
        emotion_specificity = 2
    else:
        emotion_specificity = 1

    # relief_distance
    prob_positions = []
    sol_positions = []
    for i, s in enumerate(sentences):
        s_low = s.lower()
        if any(w in s_low for w in problem_keywords[:8]):
            prob_positions.append(i)
        if any(w in s_low for w in solution_keywords[:8]):
            sol_positions.append(i)

    if prob_positions and sol_positions:
        first_prob = prob_positions[0]
        first_sol = next((s for s in sol_positions if s > first_prob), sol_positions[0])
        relief_distance = max(0, first_sol - first_prob)
    else:
        relief_distance = 0

    pride_patterns = ["you already know", "as a.*you understand", "smart teams", "you're the kind of", "savvy", "sophisticated", "like you"]
    pride_trigger = count_pattern(text, pride_patterns)

    fomo_patterns = ["competitors are already", "the market is moving", "everyone is switching", "don't get left behind", "your competitors", "while you're still", "others are already", "industry is moving"]
    fomo_construction = count_pattern(text, fomo_patterns)

    empathy_first_patterns = ["i spent", "i used to", "when i was", "i personally", "we experienced", "i had to", "i was frustrated", "we struggled", "i've been", "i know what it's like"]
    empathy_firsthand = 1 if any(p in text_lower for p in empathy_first_patterns) else 0

    empathy_obs_patterns = ["teams struggle", "developers spend", "companies waste", "people spend hours", "users have to", "businesses lose", "marketers struggle", "designers spend"]
    empathy_observed = 1 if any(p in text_lower for p in empathy_obs_patterns) else 0

    frustration_concepts = ["slow", "tedious", "manual", "repetitive", "complex", "confusing", "expensive", "unreliable", "fragmented", "disconnected", "siloed", "overwhelming", "time-consuming", "error-prone", "clunky", "outdated"]
    frustration_vocabulary_breadth = sum(1 for w in frustration_concepts if w in text_lower)

    # Compute finally_signal early (also used by joy_velocity_shift)
    finally_patterns = ["finally", "at last", "no more", "never again", "say goodbye to", "the wait is over", "put an end to"]
    finally_signal = count_pattern(text, finally_patterns)

    # joy_velocity_shift
    if pivot_sharpness >= 4 and finally_signal > 0:
        joy_velocity_shift = 5
    elif pivot_sharpness >= 4:
        joy_velocity_shift = 4
    elif pivot_sharpness >= 3 or (narrative_arc == "problem_solution" and benefit_words > 3):
        joy_velocity_shift = 3
    elif narrative_arc in ("solution_first", "neutral_flat") and benefit_words > 0:
        joy_velocity_shift = 2
    else:
        joy_velocity_shift = 1

    vulnerability_patterns = ["our first version", "we almost gave up", "we're not perfect", "honestly", "we got this wrong", "it wasn't easy", "we failed", "our mistake", "we learned", "to be honest"]
    vulnerability_moment = 1 if any(p in text_lower for p in vulnerability_patterns) else 0

    anticipatory_patterns = ["wait until you see", "you're going to love", "here's the exciting part", "watch this", "check this out", "let me show you something", "you'll love this", "here's the best part", "get ready"]
    anticipatory_emotion = count_pattern(text, anticipatory_patterns)

    social_belonging_patterns = ["join.*developers", "join.*community", "community of", "thousands of teams", "you're in good company", "fellow founders", "join.*users", "part of a"]
    social_belonging = sum(1 for p in social_belonging_patterns if re.search(p, text_lower))

    # loss_aversion_framing
    gain_framing = count_pattern(text, ["save", "gain", "earn", "get", "achieve", "unlock", "boost"])
    loss_framing = count_pattern(text, ["losing", "wasting", "missing", "costing you", "you're losing", "every day without", "hemorrhaging"])
    if gain_framing + loss_framing == 0:
        loss_aversion_framing = 0.3  # Default slightly toward gain
    else:
        loss_aversion_framing = round(loss_framing / (gain_framing + loss_framing), 2)

    surprise_patterns = ["oh and it also", "bonus", "did i mention", "cherry on top", "and one more thing", "as a bonus", "but that's not all", "and guess what"]
    surprise_delight = count_pattern(text, surprise_patterns)

    # confidence_gradient - does certainty grow?
    # Also check energy/enthusiasm growth
    first_half_text = text_lower[:len(text_lower)//2]
    second_half_text = text_lower[len(text_lower)//2:]
    fh_conf = count_pattern(first_half_text, confidence_words + ["can", "will", "definitely"])
    sh_conf = count_pattern(second_half_text, confidence_words + ["can", "will", "definitely"])
    fh_energy = count_pattern(first_half_text, ["amazing", "incredible", "powerful", "best", "love"])
    sh_energy = count_pattern(second_half_text, ["amazing", "incredible", "powerful", "best", "love", "try", "start", "join"])

    conf_growth = (sh_conf - fh_conf) + (sh_energy - fh_energy)
    if conf_growth >= 4:
        confidence_gradient = 5
    elif conf_growth >= 2:
        confidence_gradient = 4
    elif conf_growth >= 1:
        confidence_gradient = 3
    elif conf_growth >= 0:
        confidence_gradient = 2
    else:
        confidence_gradient = 1

    # emotional_contrast_ratio
    has_neg = any(w in text_lower for w in ["problem", "frustrated", "struggle", "pain", "difficult", "waste", "broken", "terrible", "hate", "annoying"])
    has_pos = any(w in text_lower for w in ["amazing", "love", "great", "powerful", "beautiful", "incredible", "easy", "simple", "fast", "free"])
    if has_neg and has_pos and (neg_count >= 2 and pos_count >= 2):
        emotional_contrast_ratio = 5
    elif has_neg and has_pos:
        emotional_contrast_ratio = 4
    elif (neg_count >= 2 or pos_count >= 3) and narrative_arc == "problem_solution":
        emotional_contrast_ratio = 3
    elif pos_count >= 2 or neg_count >= 1:
        emotional_contrast_ratio = 2
    else:
        emotional_contrast_ratio = 1

    # finally_signal already computed above (before joy_velocity_shift)

    # empathy_depth — combine all empathy signals including problem understanding
    empathy_score = 0
    empathy_score += empathy_firsthand * 2
    empathy_score += empathy_observed * 1.5
    empathy_score += min(frustration_vocabulary_breadth, 4) * 0.5
    empathy_score += min(spec_count + situated_emotion, 3) * 0.5
    empathy_score += (1 if total_prob > 2 else 0)
    empathy_score += (1 if you_count > 5 and any(w in text_lower for w in ["your time", "your team", "your data", "your workflow", "your business"]) else 0)
    if empathy_score >= 5:
        empathy_depth = 5
    elif empathy_score >= 3.5:
        empathy_depth = 4
    elif empathy_score >= 2:
        empathy_depth = 3
    elif empathy_score >= 1:
        empathy_depth = 2
    else:
        empathy_depth = 1

    # --- C. Product Presentation (17 dims) ---

    # feature_intro_velocity: 1=crammed rapid-fire, 5=each feature gets breathing room
    features_per_100w = feature_words / max(word_count, 1) * 100
    # Also count feature enumeration signals
    enum_density = feature_list_markers / max(word_count, 1) * 100
    combined_feature_density = features_per_100w + enum_density

    if word_count < 50:
        feature_intro_velocity = 3
    elif combined_feature_density > 4:
        feature_intro_velocity = 1
    elif combined_feature_density > 2.5:
        feature_intro_velocity = 2
    elif combined_feature_density > 1.5:
        feature_intro_velocity = 3
    elif combined_feature_density > 0.5:
        feature_intro_velocity = 4
    else:
        feature_intro_velocity = 5 if word_count > 200 else 3

    # orphaned_features
    if feature_words == 0:
        orphaned_features = 0.0
    else:
        orphaned_features = round(max(0, 1.0 - benefit_ratio), 2)

    demo_voice_patterns = ["i click", "watch as i", "see how it", "i'll drag", "let me click", "i type", "i select", "as i type", "here i"]
    demo_voice_present_tense = 1 if any(p in text_lower for p in demo_voice_patterns) else 0
    if demo_instructions > 1 or screen_narration > 2:
        demo_voice_present_tense = 1

    # concrete_vs_abstract
    concrete_patterns = [r'\d+%', r'\$\d', r'\d+ hour', r'\d+ minute', r'\d+ second', r'\d+ user', r'\d+ customer', r'\d+ team']
    abstract_patterns = ["powerful", "robust", "scalable", "flexible", "comprehensive", "state of the art", "world-class", "enterprise-grade"]
    concrete_count = sum(len(re.findall(p, text_lower)) for p in concrete_patterns)
    abstract_count = count_pattern(text, abstract_patterns)

    # Combine demo narration as mild concrete evidence (1 point per 2 occurrences)
    concrete_count += (demo_instructions + screen_narration) // 2

    # Normalize both by word count for fair comparison
    concrete_per_100 = concrete_count / max(word_count, 1) * 100
    abstract_per_100 = abstract_count / max(word_count, 1) * 100

    if concrete_per_100 > 1.5 and abstract_per_100 < 0.5:
        concrete_vs_abstract = 5
    elif concrete_per_100 > abstract_per_100 * 2 and concrete_per_100 > 0.5:
        concrete_vs_abstract = 4
    elif concrete_per_100 >= abstract_per_100:
        concrete_vs_abstract = 3
    elif abstract_per_100 > concrete_per_100 * 2:
        concrete_vs_abstract = 2
    else:
        concrete_vs_abstract = 1

    # magic_moment_position
    wow_patterns = ["the best part", "magic", "watch this", "the real power", "most impressive", "you'll love", "here's where"]
    mm_pos = find_position(text, wow_patterns)
    magic_moment_position = round(mm_pos, 2) if mm_pos >= 0 else 0.5

    speed_patterns = ["in seconds", "instantly", "real-time", "real time", "lightning fast", "blazing fast", "super fast", "10x faster", "100x faster", "milliseconds"]
    speed_claims = count_pattern(text, speed_patterns)
    # Also match "Nx faster" pattern
    speed_claims += len(re.findall(r'\d+x\s*faster', text_lower))

    effort_reduction_specific = 1 if re.search(r'(?:took|takes?|used to take)\s+\d+\s*\w+.*(?:now|just|only)\s+\d+', text_lower) else 0
    if re.search(r'\d+\s*(?:step|click|hour|minute)s?\s+(?:to|into)\s+\d+', text_lower):
        effort_reduction_specific = 1

    effort_vague_patterns = ["saves time", "easier", "simpler", "streamline", "simplif", "more efficient", "less effort", "speeds up"]
    effort_reduction_vague = 1 if any(p in text_lower for p in effort_vague_patterns) else 0

    # integration_count
    integration_names = ["slack", "notion", "zapier", "github", "gitlab", "jira", "confluence", "asana", "trello", "monday", "clickup", "linear", "vercel", "netlify", "heroku", "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "stripe", "shopify", "salesforce", "hubspot", "mailchimp", "twilio", "segment", "mixpanel", "amplitude", "datadog", "snowflake", "postgres", "mysql", "mongodb", "redis", "elasticsearch", "kafka", "rabbitmq", "google sheets", "airtable", "excel", "google drive", "dropbox", "figma", "sketch", "adobe", "canva", "webflow", "wordpress", "squarespace", "wix", "intercom", "zendesk", "freshdesk", "chrome", "firefox", "safari", "vscode", "vs code", "visual studio"]
    integration_count = sum(1 for name in integration_names if name in text_lower)

    progressive_disclosure = 0
    if any(p in text_lower for p in ["basic", "simple use case", "getting started", "first"]) and any(p in text_lower for p in ["advanced", "power user", "pro", "enterprise", "for teams"]):
        progressive_disclosure = 1

    one_more_thing = 0
    last_20_pct = text_lower[int(len(text)*0.8):]
    if any(p in last_20_pct for p in ["one more thing", "bonus", "oh and", "cherry on top", "but wait", "there's more", "also", "and finally"]):
        one_more_thing = 1

    simplicity_patterns = ["simple", "easy", "intuitive", "no learning curve", "one click", "drag and drop", "just click", "just drag", "just type", "just connect", "just add", "plug and play", "no setup", "zero config"]
    simplicity_signals = count_pattern(text, simplicity_patterns)

    under_the_hood_patterns = ["built on", "powered by", "uses.*model", "built with", "running on", "architecture", "under the hood", "behind the scenes", "tech stack", "vector", "embedding", "infrastructure"]
    under_the_hood = 1 if any(p in text_lower for p in under_the_hood_patterns) or any(re.search(p, text_lower) for p in [r"built (?:on|with) \w+"]) else 0

    # use_case_count
    persona_patterns = ["for developer", "for designer", "for marketer", "for pm", "for product manager", "for engineer", "for founder", "for startup", "for enterprise", "for team", "for freelancer", "for agency", "for creator", "for writer", "for student", "for researcher", "for analyst", "for sales", "for hr", "for recruiter", "for educator", "for teacher", "whether you're"]
    use_case_count = sum(1 for p in persona_patterns if p in text_lower)
    use_case_count = max(use_case_count, 1) if word_count > 30 else 0

    # liveness_score: 1=clearly pre-recorded/narrated, 5=live spontaneous clicking
    live_signals = 0
    live_signals += min(demo_instructions, 3)
    live_signals += min(screen_narration, 3)
    live_signals += (1 if demo_voice_present_tense else 0)
    live_signals += min(filler_count // 2, 2)  # Fillers = spontaneous

    scripted_signals = 0
    scripted_signals += (1 if production_markers > 0 else 0)
    scripted_signals += (1 if any(w in text_lower for w in ["[music]", "[applause]"]) else 0)
    scripted_signals += (1 if word_count < 100 and filler_count == 0 else 0)

    net = live_signals - scripted_signals
    if net >= 5:
        liveness_score = 5
    elif net >= 3:
        liveness_score = 4
    elif net >= 1:
        liveness_score = 3
    elif net >= 0:
        liveness_score = 2
    else:
        liveness_score = 1

    onboarding_patterns = ["up and running in", "deploy in", "get started in", "setup in", "minutes to set up", "seconds to set up", "ready in", "install in"]
    onboarding_time_claim = 1 if any(p in text_lower for p in onboarding_patterns) else 0
    if re.search(r'(?:set up|setup|start|deploy|install).*(?:in|within)\s+\d+\s*(?:second|minute)', text_lower):
        onboarding_time_claim = 1

    comparison_patterns = ["here's the old way", "on the left", "on the right", "before and after", "side by side", "compared to", "the traditional way", "the old way.*our way", "without.*with"]
    comparison_moment = 1 if any(p in text_lower for p in comparison_patterns) else 0

    # --- D. Wording & Rhetoric (16 dims) ---

    # verb_energy: 1=passive/corporate, 5=active/punchy
    passive_corporate = ["utilize", "facilitate", "leverage", "implement", "optimize", "synergize", "strategize", "streamline", "empower", "enable", "enhance", "ensure"]
    high_energy = ["ship", "crush", "build", "launch", "nail", "hack", "smash", "kill", "blast", "fire", "boost", "grab", "snap", "push", "plug", "drop"]
    medium_energy = ["create", "make", "run", "start", "stop", "get", "try", "click", "drag", "add", "set", "connect", "deploy", "track", "design", "test", "send"]
    pc_count = sum(word_freq.get(v, 0) for v in passive_corporate)
    he_count = sum(word_freq.get(v, 0) for v in high_energy)
    me_count = sum(word_freq.get(v, 0) for v in medium_energy)

    # Also check imperative mood
    imperative_openers = sum(1 for s in sentences if s.strip().split() and s.strip().split()[0].lower() in ["try", "check", "stop", "start", "get", "join", "discover", "explore", "click", "visit", "build", "create", "download", "install"])

    if he_count >= 3 and pc_count == 0:
        verb_energy = 5
    elif he_count >= 2 or (imperative_openers >= 3 and pc_count == 0):
        verb_energy = 4
    elif me_count > pc_count and he_count >= 1:
        verb_energy = 3
    elif pc_count >= 2 and he_count == 0:
        verb_energy = 1
    elif pc_count > 0:
        verb_energy = 2
    else:
        verb_energy = 3

    # sentence_rhythm_variance
    # For auto-transcribed text, use a different approach: look at clause lengths
    # Split on common clause boundaries to get rhythm
    clauses = re.split(r'\b(?:and|but|so|then|because|which|where|when|if|while|that)\b', text)
    clause_lengths = [len(c.split()) for c in clauses if len(c.split()) >= 3]

    if len(clause_lengths) >= 4:
        mean_cl = sum(clause_lengths) / len(clause_lengths)
        if mean_cl > 0:
            variance = sum((l - mean_cl)**2 for l in clause_lengths) / len(clause_lengths)
            std_dev = variance ** 0.5
            cv = std_dev / mean_cl
            has_short = any(l <= 5 for l in clause_lengths)
            has_long = any(l >= 15 for l in clause_lengths)
            if cv > 0.8 and has_short and has_long:
                sentence_rhythm_variance = 5
            elif cv > 0.6:
                sentence_rhythm_variance = 4
            elif cv > 0.4:
                sentence_rhythm_variance = 3
            elif cv > 0.2:
                sentence_rhythm_variance = 2
            else:
                sentence_rhythm_variance = 1
        else:
            sentence_rhythm_variance = 1
    elif len(clause_lengths) >= 2:
        sentence_rhythm_variance = 2
    else:
        sentence_rhythm_variance = 1

    # power_word_cluster_density
    power_words = ["free", "new", "instant", "now", "proven", "easy", "save", "discover", "results", "guarantee", "powerful", "exclusive", "limited", "secret", "breakthrough", "amazing", "incredible"]
    pw_positions = []
    for i, w in enumerate(words):
        if w in power_words:
            pw_positions.append(i)

    # Check for clusters (3+ power words within 10-word window)
    clusters = 0
    for i in range(len(pw_positions)):
        window = [p for p in pw_positions if abs(p - pw_positions[i]) <= 10]
        if len(window) >= 3:
            clusters += 1

    if clusters >= 3:
        power_word_cluster_density = 5
    elif clusters >= 2:
        power_word_cluster_density = 4
    elif clusters >= 1:
        power_word_cluster_density = 3
    elif len(pw_positions) > 3:
        power_word_cluster_density = 2
    else:
        power_word_cluster_density = 1

    # jargon_distribution_shape
    jargon_words = ["api", "sdk", "saas", "b2b", "b2c", "crm", "erp", "mvp", "kpi", "roi", "seo", "cicd", "devops", "microservice", "containeriz", "kubernetes", "docker", "webhook", "endpoint", "latency", "throughput", "scalab", "deploy", "infrastructure", "pipeline", "algorithm", "neural", "vector", "embedding", "token", "inference"]
    j_first = sum(1 for w in jargon_words if w in first_third)
    j_mid = sum(1 for w in jargon_words if w in mid_third)
    j_last = sum(1 for w in jargon_words if w in last_third)
    j_total = j_first + j_mid + j_last

    if j_total == 0:
        jargon_distribution_shape = "minimal"
    elif j_first > j_mid and j_first > j_last:
        jargon_distribution_shape = "front_heavy"
    elif j_mid > j_first and j_mid > j_last:
        jargon_distribution_shape = "middle_heavy"
    elif j_last > j_first and j_last > j_mid:
        jargon_distribution_shape = "back_heavy"
    else:
        jargon_distribution_shape = "even"

    # anaphora_count
    anaphora_count = 0
    for i in range(1, len(sentences)):
        w1 = sentences[i-1].split()[:3]
        w2 = sentences[i].split()[:3]
        if w1 and w2 and w1[0].lower() == w2[0].lower() and len(w1[0]) > 2:
            anaphora_count += 1

    # just_minimizer
    just_patterns = ["just click", "just drag", "just connect", "just type", "just add", "just select", "just paste", "just upload", "just press", "just open", "just scan", "just use"]
    just_minimizer = count_pattern(text, just_patterns)

    # superlative_density
    superlatives = ["best", "most", "fastest", "only", "first", "#1", "number one", "top", "greatest", "easiest", "simplest", "smartest"]
    sup_count = count_pattern(text, superlatives)
    superlative_density = round(sup_count / max(word_count, 1) * 100, 2)

    # question_answer_pairs
    qa_pairs = 0
    for i in range(len(sentences) - 1):
        if "?" in sentences[i]:
            # Check if next sentence is short / looks like an answer
            next_words = len(sentences[i+1].split())
            if next_words <= 10:
                qa_pairs += 1

    # transition_sophistication: 1=basic, 5=crafted
    basic_transitions = count_pattern(text, [" and then ", " also ", " so then ", " then we ", " but then ", " and also "])
    medium_transitions = count_pattern(text, ["for example", "in addition", "on top of", "not only", "the next thing", "another thing", "moving on", "let's talk about", "speaking of", "more importantly", "what's more", "better yet", "even better", "the cool thing", "the nice thing", "one thing", "another feature", "the other thing"])
    crafted_transitions = count_pattern(text, ["here's where", "the real magic", "but the best part", "now here's the thing", "what's interesting", "the beauty of", "where it gets interesting", "but here's the kicker", "the exciting part", "let me show you why", "and that's not all", "but wait", "here's the cool part", "now the fun part"])

    total_transitions = basic_transitions + medium_transitions + crafted_transitions
    if crafted_transitions >= 2:
        transition_sophistication = 5
    elif crafted_transitions >= 1:
        transition_sophistication = 4
    elif medium_transitions >= 3:
        transition_sophistication = 3
    elif medium_transitions >= 1 or total_transitions >= 3:
        transition_sophistication = 2
    else:
        transition_sophistication = 1

    # negation_as_benefit
    negation_patterns = ["no.*needed", "no.*required", "without", "zero setup", "zero config", "never worry", "eliminates", "no more", "no need to", "don't need to", "without any"]
    negation_as_benefit = sum(1 for p in negation_patterns if re.search(p, text_lower))

    # specificity_index: 1=all vague, 5=packed with specifics
    # Combine numbers, concrete patterns, named entities
    specificity_signals = number_count + concrete_count + brand_count + integration_count
    specificity_per_100 = specificity_signals / max(word_count, 1) * 100

    vague_words = count_pattern(text, ["many", "significant", "great", "various", "multiple", "several", "numerous", "a lot", "tons of", "plenty"])

    if specificity_per_100 > 3 and vague_words == 0:
        specificity_index = 5
    elif specificity_per_100 > 2 or (number_count > 5 and word_count < 500):
        specificity_index = 4
    elif specificity_per_100 > 1 or number_count > 3:
        specificity_index = 3
    elif number_count > 0 or brand_count > 0:
        specificity_index = 2
    else:
        specificity_index = 1

    # you_insertion_rate
    you_insertion_rate = round(you_count / max(word_count, 1) * 100, 2)

    # cliche_count
    cliches = ["game-changer", "game changer", "one-stop shop", "one stop shop", "seamless", "frictionless", "empower", "unlock", "leverage", "reimagine", "disrupt", "paradigm", "synergy", "holistic", "end-to-end", "best-in-class", "turnkey", "bleeding edge"]
    cliche_count = count_pattern(text, cliches)

    # conditional_density
    conditionals = ["if you need", "whether you", "in case you", "if you want", "if you're", "when you need", "should you"]
    cond_count = count_pattern(text, conditionals)
    conditional_density = round(cond_count / max(word_count, 1) * 100, 2)

    # parallel_structure
    parallel_structure = 0
    for i in range(len(sentences) - 2):
        w1 = sentences[i].split()
        w2 = sentences[i+1].split()
        w3 = sentences[i+2].split() if i+2 < len(sentences) else []
        if w1 and w2 and w3:
            if w1[0].lower() == w2[0].lower() == w3[0].lower():
                parallel_structure += 1
    parallel_structure += anaphora_count // 2

    # imperative_density
    imperative_words = ["try", "check", "stop", "sign up", "start", "get", "join", "discover", "explore", "learn", "download", "install", "create", "build", "click", "visit"]
    imp_count = 0
    for s in sentences:
        s_words = s.strip().split()
        if s_words and s_words[0].lower() in imperative_words:
            imp_count += 1
    imperative_density = round(imp_count / max(word_count, 1) * 100, 2)

    # --- E. Persuasion Psychology (17 dims) ---

    # word_rarity_score: 1=basic/simple vocab, 5=sophisticated/unusual choices
    # Expand common words to include typical product launch vocabulary
    common_words = set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "shall", "can", "need", "dare", "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "through", "during", "before", "after", "above", "below", "between", "out", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "just", "because", "but", "and", "or", "if", "while", "that", "this", "it", "i", "you", "he", "she", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "its", "our", "their", "what", "which", "who",
    # Common tech/product vocabulary (not rare)
    "feature", "product", "platform", "website", "application", "software", "project", "customer", "business", "company", "actually", "basically", "different", "something", "everything", "anything", "another", "example", "process", "problem", "solution", "important", "information", "possible", "whatever", "generate", "automate", "configure", "dashboard", "integrate", "analytics", "workflow", "template", "customize", "collaborate", "notifications", "interface", "settings", "automatically", "directly", "completely", "available", "multiple", "specific", "powerful", "building", "creating", "starting", "without", "through", "because", "already", "together", "between", "whether"])
    # Count truly unusual words (>8 chars, not in expanded common set)
    rare_count = sum(1 for w in words if w not in common_words and len(w) > 8)
    rare_ratio = rare_count / max(word_count, 1)
    if rare_ratio > 0.08:
        word_rarity_score = 5
    elif rare_ratio > 0.05:
        word_rarity_score = 4
    elif rare_ratio > 0.03:
        word_rarity_score = 3
    elif rare_ratio > 0.015:
        word_rarity_score = 2
    else:
        word_rarity_score = 1

    # qualifying_retreat
    retreat_patterns = ["well, ", "or at least", "to be fair", "that said", "I mean", "sort of", "in a way"]
    qualifying_retreat = count_pattern(text, retreat_patterns)

    # conclusive_finality: use last ~50 words of transcript
    last_50_words = ' '.join(text_lower.split()[-50:])
    if any(p in last_50_words for p in ["try it", "get started", "sign up", "join us", "start now", "check it out", "visit us"]):
        conclusive_finality = 5
    elif any(p in last_50_words for p in [".com", ".io", ".ai", ".co", "today", "start free", "for free", "download"]):
        conclusive_finality = 4
    elif any(p in last_50_words for p in ["thank", "thanks", "bye", "appreciate"]):
        conclusive_finality = 3
    elif any(p in last_50_words for p in ["future", "more to come", "stay tuned", "coming soon", "roadmap"]):
        conclusive_finality = 2
    elif any(p in last_50_words for p in ["so yeah", "that's it", "that's about it", "yeah"]):
        conclusive_finality = 1
    else:
        conclusive_finality = 2

    # social_proof_stacking_order
    if success_users and brand_count:
        social_proof_stacking_order = "numbers_first" if find_position(text, [str(success_users)]) < find_position(text, known_brands[:5]) else "brands_first"
    elif success_users:
        social_proof_stacking_order = "numbers_first"
    elif brand_count:
        social_proof_stacking_order = "brands_first"
    elif has_testimonial:
        social_proof_stacking_order = "quotes_first"
    else:
        social_proof_stacking_order = "none"

    # authority_type
    if has_credential:
        authority_type = "technical"
    elif success_users:
        authority_type = "market"
    elif any(p in text_lower for p in ["years of experience", "years in", "decade", "veteran"]):
        authority_type = "domain"
    elif has_credential and success_users:
        authority_type = "mixed"
    else:
        authority_type = "none"

    # reciprocity_trigger
    reciprocity_patterns = ["free tier", "free plan", "open source", "free template", "no credit card", "free trial", "free forever", "free to use", "free version", "try for free"]
    reciprocity_trigger = 1 if any(p in text_lower for p in reciprocity_patterns) else 0

    # anchor_contrast_pricing
    anchor_contrast_pricing = 1 if re.search(r'(?:\$[\d,]+.*(?:we|our|just|only)\s*\$[\d,]+|cost.*\$.*(?:we|but|only|just))', text_lower) else 0

    # contrast_pairs
    contrast_patterns_rhet = ["instead of", "not.*but", "unlike", "while others", "rather than", "whereas", "on the other hand"]
    contrast_pairs = sum(1 for p in contrast_patterns_rhet if re.search(p, text_lower))

    # certainty_ratio
    certain_words = ["will", "definitely", "absolutely", "guaranteed", "proven", "always", "certainly", "undoubtedly"]
    uncertain_words = ["maybe", "perhaps", "might", "could", "possibly", "potentially", "probably"]
    cert_count = count_pattern(text, certain_words)
    uncert_count = count_pattern(text, uncertain_words)
    certainty_ratio = round(cert_count / max(cert_count + uncert_count, 1), 2)

    # in_group_language
    ingroup_patterns = ["as developers", "as founders", "as engineers", "as designers", "fellow", "if you're like us", "we've all been there", "as a.*you know", "like us"]
    in_group_language = sum(1 for p in ingroup_patterns if re.search(p, text_lower))

    # objection_preempt
    objection_patterns = ["you might be wondering", "don't worry about", "and yes.*works", "you might think", "concerned about", "no need to worry", "rest assured", "you don't need to", "it's secure", "completely safe"]
    objection_preempt = sum(1 for p in objection_patterns if re.search(p, text_lower))

    # scarcity_type
    if any(w in text_lower for w in ["today only", "this week only", "limited time"]):
        scarcity_type = "time"
    elif any(w in text_lower for w in ["limited spots", "only.*spots", "limited seats"]):
        scarcity_type = "quantity"
    elif any(w in text_lower for w in ["invite only", "exclusive access", "waitlist", "early access"]):
        scarcity_type = "access"
    elif any(w in text_lower for w in ["only tool", "the only", "first and only"]):
        scarcity_type = "capability"
    else:
        scarcity_type = "none"

    # bandwagon_gradient
    bandwagon_gradient = 0
    number_matches = list(re.finditer(r'\b(\d[\d,]*)\b', text))
    if len(number_matches) >= 2:
        nums = []
        for m in number_matches:
            try:
                n = int(m.group().replace(",", ""))
                if n > 10:
                    nums.append((m.start(), n))
            except:
                pass
        if len(nums) >= 2 and nums[-1][1] > nums[0][1]:
            bandwagon_gradient = 1

    # choice_architecture
    tier_patterns = ["free plan", "pro plan", "enterprise", "basic", "premium", "starter", "business plan", "team plan"]
    choice_architecture = sum(1 for p in tier_patterns if p in text_lower)

    # cognitive_ease
    ease_patterns = ["one click", "automatic", "zero config", "plug and play", "set it and forget it", "instant", "no setup", "effortless", "hands-free", "autopilot", "automat"]
    cognitive_ease = count_pattern(text, ease_patterns)

    # everyone_else_maneuver
    everyone_patterns = ["most teams", "industry standard", "your competitors", "leading companies", "top companies", "everyone else", "the rest of the industry"]
    everyone_else_maneuver = count_pattern(text, everyone_patterns)

    # future_self_projection
    future_patterns = ["you'll become", "imagine yourself", "be the one who", "your future", "you'll be able to", "you'll never have to", "you'll finally"]
    future_self_projection = count_pattern(text, future_patterns)

    # --- F. Structure & Timing (16 dims) ---

    # info_density_shape
    # Approximate by word density per third
    w_first = len(first_third.split())
    w_mid = len(mid_third.split())
    w_last = len(last_third.split())

    # Use feature/info keywords as proxy for density
    info_words = ["feature", "tool", "click", "button", "page", "dashboard", "api", "data", "report", "analytics", "integration", "automat", "custom", "config", "setting"]
    d_first = sum(first_third.count(w) for w in info_words)
    d_mid = sum(mid_third.count(w) for w in info_words)
    d_last = sum(last_third.count(w) for w in info_words)

    if d_first > d_mid and d_first > d_last:
        info_density_shape = "front_loaded"
    elif d_last > d_first and d_last > d_mid:
        info_density_shape = "back_loaded"
    elif d_mid > d_first and d_mid > d_last:
        info_density_shape = "middle_peak"
    else:
        info_density_shape = "even"

    # breathing_room: 1=relentless info, 5=generous space
    # Use feature/info density + raw word density
    info_per_100w = (feature_words + action_verb_count + number_count) / max(word_count, 1) * 100
    words_per_minute_est = word_count / max(1, word_count / 150)  # ~150 wpm speaking

    if word_count < 50:
        breathing_room = 2  # Short = dense by nature
    elif info_per_100w > 6:
        breathing_room = 1
    elif info_per_100w > 4:
        breathing_room = 2
    elif info_per_100w > 2:
        breathing_room = 3
    elif info_per_100w > 1:
        breathing_room = 4
    else:
        breathing_room = 3  # Low info density might mean shallow, not generous

    # Storytelling = more breathing room
    if storytelling:
        breathing_room = min(5, breathing_room + 1)
    # Music/pauses = breathing room
    if production_markers > 1:
        breathing_room = min(5, breathing_room + 1)
    # Very feature-dense short transcripts = cramped
    if feature_list_markers > 5 and word_count < 400:
        breathing_room = max(1, breathing_room - 1)

    # cold_open_words
    product_lower = product_name.lower()
    product_variants = [product_lower] + product_name_words
    cold_open_words = 0
    for i, w in enumerate(words):
        if any(pv in w for pv in product_variants if len(pv) > 2):
            cold_open_words = i
            break
        if any(fw in w for fw in ["feature", "tool", "app", "platform", "product", "software"]):
            cold_open_words = i
            break
    else:
        cold_open_words = min(word_count, 50)

    # callback_count
    callback_patterns = ["remember", "going back to", "as i mentioned", "earlier i", "this ties back", "as we saw", "like i said", "recall"]
    callback_count = count_pattern(text, callback_patterns)

    # section_length_cv: 1=all sections equal, 5=wildly uneven
    # Compare density of the three thirds
    thirds_lens = [len(first_third.split()), len(mid_third.split()), len(last_third.split())]
    if max(thirds_lens) > 0:
        thirds_cv = (max(thirds_lens) - min(thirds_lens)) / max(sum(thirds_lens)/3, 1)
    else:
        thirds_cv = 0
    # Also factor in topic transitions
    if thirds_cv > 0.8 or topic_transitions > 6:
        section_length_cv = 5
    elif thirds_cv > 0.5 or topic_transitions > 4:
        section_length_cv = 4
    elif thirds_cv > 0.3 or topic_transitions > 2:
        section_length_cv = 3
    elif thirds_cv > 0.1 or topic_transitions > 1:
        section_length_cv = 2
    else:
        section_length_cv = 1

    # promise_proof_push
    has_promise = 1 if total_sol > 0 or benefit_words > 0 else 0
    has_proof = 1 if social_proof_claims > 0 or success_users > 0 or number_count > 2 else 0
    has_push = 1 if primary_cta != "none" or closing_has_cta_val else 0
    promise_proof_push = float(has_promise + has_proof + has_push)

    # first_feature_position
    feature_words_search = ["feature", "allows you", "enables", "you can", "with.*you", "lets you", "helps you"]
    ff_pos = -1
    for p in feature_words_search:
        pos = find_position(text, [p])
        if pos >= 0:
            ff_pos = pos if ff_pos < 0 else min(ff_pos, pos)
    first_feature_position = round(ff_pos, 2) if ff_pos >= 0 else 0.1

    # parenthetical_credibility
    paren_patterns = ["by the way", "incidentally", "oh and", "which by the way"]
    parenthetical_credibility = count_pattern(text, paren_patterns)

    # section_boundary_markers
    boundary_patterns = ["number one", "number two", "first", "second", "third", "next", "finally", "let's move on", "moving on", "the second thing", "the third", "another thing", "lastly"]
    section_boundary_markers = count_pattern(text, boundary_patterns)

    # setup_payoff_distance: how far between setup and resolution?
    # Use text position: where does the problem end vs where does the solution start?
    # For auto-transcribed text, look at word positions of problem vs solution language
    problem_positions = [m.start() / max(len(text), 1) for w in problem_keywords[:8] for m in re.finditer(re.escape(w), text_lower)]
    solution_positions = [m.start() / max(len(text), 1) for w in solution_keywords[:8] for m in re.finditer(re.escape(w), text_lower)]

    if problem_positions and solution_positions:
        avg_prob_pos = sum(problem_positions) / len(problem_positions)
        avg_sol_pos = sum(solution_positions) / len(solution_positions)
        gap = avg_sol_pos - avg_prob_pos
        if gap > 0.4:
            setup_payoff_distance = 5.0
        elif gap > 0.25:
            setup_payoff_distance = 4.0
        elif gap > 0.15:
            setup_payoff_distance = 3.0
        elif gap > 0.05:
            setup_payoff_distance = 2.0
        else:
            setup_payoff_distance = 1.0
    elif problem_positions:
        setup_payoff_distance = 3.0  # Problem without clear solution = suspended
    else:
        setup_payoff_distance = 1.0

    # multi_persona_address
    multi_persona_address = use_case_count

    # voice_consistency: check pronoun strategy consistency across text segments
    # Split text into 5 equal segments and check pronoun dominance in each
    seg_len = max(len(text_lower) // 5, 1)
    segments = [text_lower[i*seg_len:(i+1)*seg_len] for i in range(5)]
    seg_voices = []
    for seg in segments:
        seg_we = sum(seg.count(w) for w in [" we ", " our ", " us "])
        seg_you = sum(seg.count(w) for w in [" you ", " your "])
        if seg_we > seg_you * 2:
            seg_voices.append("we")
        elif seg_you > seg_we * 2:
            seg_voices.append("you")
        elif seg_we + seg_you < 2:
            seg_voices.append("neutral")
        else:
            seg_voices.append("mixed")

    # Count shifts
    shifts = sum(1 for i in range(1, len(seg_voices)) if seg_voices[i] != seg_voices[i-1] and "neutral" not in (seg_voices[i], seg_voices[i-1]))
    dominant_voice = max(set(seg_voices), key=seg_voices.count) if seg_voices else "neutral"
    consistency = seg_voices.count(dominant_voice) / max(len(seg_voices), 1)

    if consistency >= 0.8 and shifts <= 1:
        voice_consistency = 5
    elif consistency >= 0.6:
        voice_consistency = 4
    elif shifts <= 2:
        voice_consistency = 3
    elif shifts <= 3:
        voice_consistency = 2
    else:
        voice_consistency = 1

    # counterfactual_count
    counterfactual_patterns = ["what if you didn't", "without this", "imagine not having", "what would happen if", "if you didn't have", "what if there was"]
    counterfactual_count = sum(1 for p in counterfactual_patterns if re.search(p, text_lower))

    # closing_velocity: 1=slow reflective, 5=rapid-fire punchy
    # Check the closing 15% of text for rapid-fire patterns
    closing_segment = text_lower[int(len(text_lower)*0.85):]
    closing_words = closing_segment.split()
    has_rapid_cta = any(p in closing_segment for p in ["try it", "sign up", "get started", "check it out", "visit", "download", "join", "start now"])
    has_enumeration = any(p in closing_segment for p in ["and ", "plus ", "also "])
    closing_exclamations = closing_segment.count("!")

    if has_rapid_cta and (closing_exclamations > 0 or len(closing_words) < 30):
        closing_velocity = 5
    elif has_rapid_cta:
        closing_velocity = 4
    elif closing_has_thanks or any(p in closing_segment for p in ["thank", "appreciate", "hope you"]):
        closing_velocity = 2
    elif any(p in closing_segment for p in ["so yeah", "that's it", "that's about it"]):
        closing_velocity = 1
    elif has_enumeration and len(closing_words) < 50:
        closing_velocity = 4
    else:
        closing_velocity = 3

    # open_loop_closing
    open_loop_patterns = ["just the beginning", "much more to come", "stay tuned", "wait until", "more features coming", "coming soon", "v2", "roadmap"]
    open_loop_closing = 1 if any(p in last_text for p in open_loop_patterns) else 0

    # definitive_closing
    definitive_patterns = ["try it today", "get started now", "sign up", ".com", ".io", ".ai", "visit us", "check it out"]
    definitive_closing = 1 if any(p in last_text for p in definitive_patterns) else 0

    return {
        "id": tid,
        # V1 - Opening
        "hook_type": hook_type,
        "first_person_opener": first_person_opener,
        "has_negative_opener": has_negative_opener,
        "first_sentence_words": first_sentence_word_count,
        "hook_quality": hook_quality,
        # V1 - Length & Readability
        "word_count": word_count,
        "sentence_count": sentence_count,
        "avg_sentence_length": avg_sentence_length,
        "flesch_kincaid_grade": fk_grade,
        "word_diversity": word_diversity,
        "syllable_density": syll_density,
        # V1 - Pronouns & Voice
        "pronoun_strategy": pronoun_strategy,
        "we_count": we_count,
        "you_count": you_count,
        "hedge_count": hedge_count,
        "filler_count": filler_count,
        # V1 - Narrative Arc
        "narrative_arc": narrative_arc,
        "topic_transitions": topic_transitions,
        "problem_pct": problem_pct,
        "solution_pct": solution_pct,
        "declining_arc": declining_arc,
        # V1 - Metrics & Traction
        "number_count": number_count,
        "number_density": number_density,
        "metric_placement": metric_placement,
        "before_after_total": before_after_total,
        "success_users": success_users,
        "success_revenue": success_revenue,
        "success_cost_savings": success_cost_savings,
        "success_growth": success_growth,
        # V1 - Social Proof
        "brand_count": brand_count,
        "has_investor_mention": has_investor_mention,
        "has_testimonial": has_testimonial,
        "trusted_by": trusted_by,
        "has_partnership": has_partnership,
        "has_credential": has_credential,
        "social_proof_claims": social_proof_claims,
        "platform_mentions": platform_mentions,
        "competitive_total": competitive_total,
        "replacement_total": replacement_total,
        # V1 - Category & Positioning
        "category_creation_total": category_creation_total,
        "ai_count": ai_count,
        "ai_density": ai_density,
        "buzzword_count": buzzword_count,
        # V1 - CTA & Closing
        "primary_cta": primary_cta,
        "cta_position": cta_position,
        "has_discount": has_discount,
        "has_scarcity": has_scarcity,
        "has_pricing": has_pricing,
        "has_url": has_url,
        "closing_has_cta": closing_has_cta_val,
        "closing_has_thanks": closing_has_thanks,
        # V1 - Content Signals
        "storytelling": storytelling,
        "humor": humor,
        "demo_instructions": demo_instructions,
        "screen_narration": screen_narration,
        "data_viz_cues": data_viz_cues,
        "energy_markers": energy_markers,
        "feature_list_markers": feature_list_markers,
        "production_markers": production_markers,
        "speaker_changes": speaker_changes,
        "action_verb_count": action_verb_count,
        "feature_words": feature_words,
        "benefit_words": benefit_words,
        "benefit_ratio": benefit_ratio,
        "question_count": question_count,
        "passive_voice_count": passive_voice_count,
        # V1 - Sentiment
        "sentiment": sentiment,
        "confidence_count": confidence_count,
        "product_name_repeats": product_name_repeats,
        # V2 - A. Story Architecture
        "inciting_incident": inciting_incident,
        "villain_named": villain_named,
        "villain_count": villain_count,
        "stakes_escalation": stakes_escalation,
        "transformation_promise": transformation_promise,
        "transformation_position": transformation_position,
        "pivot_sharpness": pivot_sharpness,
        "nested_stories": nested_stories,
        "temporal_anchors": temporal_anchors,
        "imagine_device": imagine_device,
        "cliffhanger_beats": cliffhanger_beats,
        "why_now": why_now,
        "journey_vs_destination": journey_vs_destination,
        "emotional_bookend_match": emotional_bookend_match,
        "unsaid_problem": unsaid_problem,
        "resolution_completeness": resolution_completeness,
        "story_compression": story_compression,
        # V2 - B. Emotional Mechanics
        "emotion_specificity": emotion_specificity,
        "relief_distance": relief_distance,
        "pride_trigger": pride_trigger,
        "fomo_construction": fomo_construction,
        "empathy_firsthand": empathy_firsthand,
        "empathy_observed": empathy_observed,
        "frustration_vocabulary_breadth": frustration_vocabulary_breadth,
        "joy_velocity_shift": joy_velocity_shift,
        "vulnerability_moment": vulnerability_moment,
        "anticipatory_emotion": anticipatory_emotion,
        "social_belonging": social_belonging,
        "loss_aversion_framing": loss_aversion_framing,
        "surprise_delight": surprise_delight,
        "confidence_gradient": confidence_gradient,
        "emotional_contrast_ratio": emotional_contrast_ratio,
        "finally_signal": finally_signal,
        "empathy_depth": empathy_depth,
        # V2 - C. Product Presentation
        "feature_intro_velocity": feature_intro_velocity,
        "orphaned_features": orphaned_features,
        "demo_voice_present_tense": demo_voice_present_tense,
        "concrete_vs_abstract": concrete_vs_abstract,
        "magic_moment_position": magic_moment_position,
        "speed_claims": speed_claims,
        "effort_reduction_specific": effort_reduction_specific,
        "effort_reduction_vague": effort_reduction_vague,
        "integration_count": integration_count,
        "progressive_disclosure": progressive_disclosure,
        "one_more_thing": one_more_thing,
        "simplicity_signals": simplicity_signals,
        "under_the_hood": under_the_hood,
        "use_case_count": use_case_count,
        "liveness_score": liveness_score,
        "onboarding_time_claim": onboarding_time_claim,
        "comparison_moment": comparison_moment,
        # V2 - D. Wording & Rhetoric
        "verb_energy": verb_energy,
        "sentence_rhythm_variance": sentence_rhythm_variance,
        "power_word_cluster_density": power_word_cluster_density,
        "jargon_distribution_shape": jargon_distribution_shape,
        "anaphora_count": anaphora_count,
        "just_minimizer": just_minimizer,
        "superlative_density": superlative_density,
        "question_answer_pairs": qa_pairs,
        "transition_sophistication": transition_sophistication,
        "negation_as_benefit": negation_as_benefit,
        "specificity_index": specificity_index,
        "you_insertion_rate": you_insertion_rate,
        "cliche_count": cliche_count,
        "conditional_density": conditional_density,
        "parallel_structure": parallel_structure,
        "imperative_density": imperative_density,
        # V2 - E. Persuasion Psychology
        "word_rarity_score": word_rarity_score,
        "qualifying_retreat": qualifying_retreat,
        "conclusive_finality": conclusive_finality,
        "social_proof_stacking_order": social_proof_stacking_order,
        "authority_type": authority_type,
        "reciprocity_trigger": reciprocity_trigger,
        "anchor_contrast_pricing": anchor_contrast_pricing,
        "contrast_pairs": contrast_pairs,
        "certainty_ratio": certainty_ratio,
        "in_group_language": in_group_language,
        "objection_preempt": objection_preempt,
        "scarcity_type": scarcity_type,
        "bandwagon_gradient": bandwagon_gradient,
        "choice_architecture": choice_architecture,
        "cognitive_ease": cognitive_ease,
        "everyone_else_maneuver": everyone_else_maneuver,
        "future_self_projection": future_self_projection,
        # V2 - F. Structure & Timing
        "info_density_shape": info_density_shape,
        "breathing_room": breathing_room,
        "cold_open_words": cold_open_words,
        "callback_count": callback_count,
        "section_length_cv": section_length_cv,
        "promise_proof_push": promise_proof_push,
        "first_feature_position": first_feature_position,
        "parenthetical_credibility": parenthetical_credibility,
        "section_boundary_markers": section_boundary_markers,
        "setup_payoff_distance": setup_payoff_distance,
        "multi_persona_address": multi_persona_address,
        "voice_consistency": voice_consistency,
        "counterfactual_count": counterfactual_count,
        "closing_velocity": closing_velocity,
        "open_loop_closing": open_loop_closing,
        "definitive_closing": definitive_closing,
    }


def classify_hook(first_sentence, full_text_lower):
    """Classify the opening hook type. Uses first ~20 words for auto-transcribed text."""
    # Use the opening portion, not the full sentence (which may be the entire transcript)
    opening = ' '.join(first_sentence.split()[:20]).lower()
    fs = opening

    if re.match(r'^(hi |hey |hello |welcome|good morning|good afternoon)', fs):
        return "greeting"
    if "?" in first_sentence.split(".")[:1][0] if "." in first_sentence else "?" in first_sentence[:200]:
        # Check for question in opening
        if "?" in ' '.join(first_sentence.split()[:30]):
            return "question"
    if re.match(r'^(i |i\'m|we |my |our )', fs):
        if any(w in fs for w in ["story", "started", "founded", "built", "remember", "years ago", "back in", "was working"]):
            return "founder_story"
        if any(w in fs for w in ["tired", "frustrated", "hate", "problem", "struggle", "annoyed", "sick"]):
            return "pain_point"
        return "product_statement"
    if re.match(r'^(introducing|announcing|meet |presenting|today we|we are launch)', fs):
        return "announcement"
    if any(w in fs for w in ["let me show", "watch", "click", "demo", "i'll show", "here's how"]):
        return "demo_instruction"
    if any(w in fs for w in ["imagine", "what if", "picture this", "the future"]):
        return "bold_claim"
    if re.search(r'\b\d[\d,.]*[%xX]?\b', fs):
        return "stat_number"
    if any(w in fs for w in ["broken", "problem", "challenge", "tired", "frustrated", "waste", "struggling", "every day", "how many times"]):
        return "pain_point"
    if any(w in fs for w in ["the best", "the only", "the first", "revolutionary", "world's first", "the most"]):
        return "bold_claim"
    # Check if it's a product name/description opener
    if any(w in fs for w in [" is a ", " is an ", " is the "]):
        return "product_statement"
    return "descriptive"


def rate_hook_quality(first_sentence, hook_type, word_count):
    """Rate hook quality 1-5. Use full range."""
    if word_count < 20:
        return 1

    score = 3  # baseline is average

    # Hook type bonuses/penalties
    if hook_type in ["pain_point", "bold_claim", "stat_number"]:
        score += 1
    elif hook_type in ["question", "founder_story"]:
        score += 1
    elif hook_type == "greeting":
        score -= 1
    elif hook_type == "descriptive":
        score -= 1  # Generic description is below average
    elif hook_type == "demo_instruction":
        pass  # neutral

    # Evaluate the actual opening words (first ~20 words of transcript)
    opening_words = ' '.join(first_sentence.split()[:20]).lower()

    # Short punchy openers are better
    first_clause_len = len(opening_words.split())
    if first_clause_len <= 8 and first_clause_len >= 3:
        score += 1

    # Emotional/vivid/specific language
    vivid = ["imagine", "picture", "what if", "tired of", "frustrated", "love", "hate", "never again",
             "finally", "every day", "every time", "have you ever", "stop", "the problem", "why"]
    if any(v in opening_words for v in vivid):
        score += 1

    # Generic/boring openers
    boring = ["this is a", "this video", "in this video", "today i want", "today we're going",
              "welcome to", "thank you for", "so basically"]
    if any(b in opening_words for b in boring):
        score -= 1

    return max(1, min(5, score))


def estimate_topic_transitions(sentences):
    """Estimate major topic shifts."""
    if len(sentences) < 3:
        return 0

    transitions = 0
    transition_words = ["but", "however", "now", "so", "also", "another", "next", "additionally", "furthermore", "meanwhile", "on the other hand", "let's talk about", "moving on", "speaking of"]

    for s in sentences:
        s_low = s.lower().strip()
        first_word = s_low.split()[0] if s_low.split() else ""
        if first_word in transition_words or any(s_low.startswith(tw) for tw in transition_words):
            transitions += 1

    return min(transitions, len(sentences) // 3)


def make_empty(tid):
    """Return a default-valued result for empty/too-short transcripts."""
    return {
        "id": tid,
        "hook_type": "descriptive", "first_person_opener": 0, "has_negative_opener": 0,
        "first_sentence_words": 0, "hook_quality": 1,
        "word_count": 0, "sentence_count": 0, "avg_sentence_length": 0,
        "flesch_kincaid_grade": 0, "word_diversity": 0, "syllable_density": 0,
        "pronoun_strategy": "neutral", "we_count": 0, "you_count": 0,
        "hedge_count": 0, "filler_count": 0,
        "narrative_arc": "too_short", "topic_transitions": 0, "problem_pct": 0,
        "solution_pct": 0, "declining_arc": 0,
        "number_count": 0, "number_density": 0, "metric_placement": "none",
        "before_after_total": 0, "success_users": 0, "success_revenue": 0,
        "success_cost_savings": 0, "success_growth": 0,
        "brand_count": 0, "has_investor_mention": 0, "has_testimonial": 0,
        "trusted_by": 0, "has_partnership": 0, "has_credential": 0,
        "social_proof_claims": 0, "platform_mentions": 0, "competitive_total": 0,
        "replacement_total": 0,
        "category_creation_total": 0, "ai_count": 0, "ai_density": 0,
        "buzzword_count": 0,
        "primary_cta": "none", "cta_position": "none", "has_discount": 0,
        "has_scarcity": 0, "has_pricing": 0, "has_url": 0,
        "closing_has_cta": 0, "closing_has_thanks": 0,
        "storytelling": 0, "humor": 0, "demo_instructions": 0,
        "screen_narration": 0, "data_viz_cues": 0, "energy_markers": 0,
        "feature_list_markers": 0, "production_markers": 0, "speaker_changes": 0,
        "action_verb_count": 0, "feature_words": 0, "benefit_words": 0,
        "benefit_ratio": 0, "question_count": 0, "passive_voice_count": 0,
        "sentiment": "neutral", "confidence_count": 0, "product_name_repeats": 0,
        "inciting_incident": 0, "villain_named": 0, "villain_count": 0,
        "stakes_escalation": 0, "transformation_promise": 0,
        "transformation_position": -1, "pivot_sharpness": 1,
        "nested_stories": 0, "temporal_anchors": 0, "imagine_device": 0,
        "cliffhanger_beats": 0, "why_now": 0, "journey_vs_destination": 0.5,
        "emotional_bookend_match": 0, "unsaid_problem": 0,
        "resolution_completeness": 0, "story_compression": 1.0,
        "emotion_specificity": 1, "relief_distance": 0, "pride_trigger": 0,
        "fomo_construction": 0, "empathy_firsthand": 0, "empathy_observed": 0,
        "frustration_vocabulary_breadth": 0, "joy_velocity_shift": 1,
        "vulnerability_moment": 0, "anticipatory_emotion": 0,
        "social_belonging": 0, "loss_aversion_framing": 0.3,
        "surprise_delight": 0, "confidence_gradient": 1,
        "emotional_contrast_ratio": 1, "finally_signal": 0, "empathy_depth": 1,
        "feature_intro_velocity": 3, "orphaned_features": 0,
        "demo_voice_present_tense": 0, "concrete_vs_abstract": 3,
        "magic_moment_position": 0.5, "speed_claims": 0,
        "effort_reduction_specific": 0, "effort_reduction_vague": 0,
        "integration_count": 0, "progressive_disclosure": 0,
        "one_more_thing": 0, "simplicity_signals": 0, "under_the_hood": 0,
        "use_case_count": 0, "liveness_score": 1, "onboarding_time_claim": 0,
        "comparison_moment": 0,
        "verb_energy": 3, "sentence_rhythm_variance": 1,
        "power_word_cluster_density": 1, "jargon_distribution_shape": "minimal",
        "anaphora_count": 0, "just_minimizer": 0, "superlative_density": 0,
        "question_answer_pairs": 0, "transition_sophistication": 1,
        "negation_as_benefit": 0, "specificity_index": 1, "you_insertion_rate": 0,
        "cliche_count": 0, "conditional_density": 0, "parallel_structure": 0,
        "imperative_density": 0,
        "word_rarity_score": 1, "qualifying_retreat": 0,
        "conclusive_finality": 1, "social_proof_stacking_order": "none",
        "authority_type": "none", "reciprocity_trigger": 0,
        "anchor_contrast_pricing": 0, "contrast_pairs": 0,
        "certainty_ratio": 0.5, "in_group_language": 0,
        "objection_preempt": 0, "scarcity_type": "none",
        "bandwagon_gradient": 0, "choice_architecture": 0,
        "cognitive_ease": 0, "everyone_else_maneuver": 0,
        "future_self_projection": 0,
        "info_density_shape": "even", "breathing_room": 3,
        "cold_open_words": 0, "callback_count": 0, "section_length_cv": 1,
        "promise_proof_push": 0.0, "first_feature_position": 0.0,
        "parenthetical_credibility": 0, "section_boundary_markers": 0,
        "setup_payoff_distance": 1.0, "multi_persona_address": 0,
        "voice_consistency": 3, "counterfactual_count": 0,
        "closing_velocity": 3, "open_loop_closing": 0, "definitive_closing": 0,
    }


def main():
    import sys

    with open("launch-video-analysis/ph/v2-llm-parts/input_batch_13.json") as f:
        data = json.load(f)

    print(f"Processing {len(data)} transcripts...", file=sys.stderr)

    results = []
    for i, item in enumerate(data):
        try:
            result = extract_dimensions(item)
            results.append(result)
            if (i + 1) % 10 == 0:
                print(f"  Processed {i+1}/{len(data)}", file=sys.stderr)
        except Exception as e:
            print(f"  ERROR on transcript {item['id']}: {e}", file=sys.stderr)
            results.append(make_empty(item["id"]))

    # Validate: all results have same keys
    expected_keys = set(results[0].keys())
    for r in results:
        missing = expected_keys - set(r.keys())
        extra = set(r.keys()) - expected_keys
        if missing or extra:
            print(f"  Key mismatch for {r['id']}: missing={missing}, extra={extra}", file=sys.stderr)

    print(f"\nDimension count: {len(expected_keys)} (including 'id')", file=sys.stderr)
    print(f"Total transcripts processed: {len(results)}", file=sys.stderr)

    with open("launch-video-analysis/ph/v2-llm-parts/output_batch_13.json", "w") as f:
        json.dump(results, f, indent=2)

    print("Done. Output written to output_batch_13.json", file=sys.stderr)


if __name__ == "__main__":
    main()
