#!/usr/bin/env python3
"""
Extract 200 dimensions from Product Hunt launch video transcripts.
Uses NLP heuristics and semantic analysis — not just keyword matching.
"""

import json
import re
import math
from collections import Counter

# ─── Helpers ───────────────────────────────────────────────────────────────────

def sentences(text):
    """Split text into sentences."""
    # Remove production markers for sentence splitting
    clean = re.sub(r'\[.*?\]', '', text)
    # Split on sentence-ending punctuation
    parts = re.split(r'(?<=[.!?])\s+', clean.strip())
    return [s.strip() for s in parts if s.strip() and len(s.strip()) > 1]

def words(text):
    """Extract words from text."""
    clean = re.sub(r'\[.*?\]', '', text)
    return re.findall(r"[a-zA-Z']+", clean)

def syllable_count(word):
    """Estimate syllable count for a word."""
    word = word.lower()
    if len(word) <= 3:
        return 1
    count = len(re.findall(r'[aeiouy]+', word))
    if word.endswith('e') and not word.endswith('le'):
        count -= 1
    return max(1, count)

def flesch_kincaid(total_words, total_sentences, total_syllables):
    """Compute Flesch-Kincaid grade level."""
    if total_sentences == 0 or total_words == 0:
        return 0.0
    return 0.39 * (total_words / total_sentences) + 11.8 * (total_syllables / total_words) - 15.59

def is_passive(sentence):
    """Simple passive voice detection."""
    patterns = [
        r'\b(?:is|are|was|were|been|being|be)\s+\w+ed\b',
        r'\b(?:is|are|was|were|been|being|be)\s+\w+en\b',
        r'\bget(?:s|ting)?\s+\w+ed\b',
    ]
    for p in patterns:
        if re.search(p, sentence, re.I):
            return True
    return False

def count_pattern(text, patterns):
    """Count occurrences of any pattern in text."""
    total = 0
    for p in patterns:
        total += len(re.findall(p, text, re.I))
    return total

def has_pattern(text, patterns):
    """Check if any pattern exists in text."""
    for p in patterns:
        if re.search(p, text, re.I):
            return 1
    return 0

def find_first_position(text, patterns):
    """Find the earliest position (0-1) of any pattern in text. Returns -1 if not found."""
    text_len = len(text)
    if text_len == 0:
        return -1
    earliest = text_len
    for p in patterns:
        m = re.search(p, text, re.I)
        if m and m.start() < earliest:
            earliest = m.start()
    if earliest == text_len:
        return -1
    return round(earliest / text_len, 2)

def find_position_normalized(text, patterns):
    """Find position (0-1) of pattern. Returns 0.5 if not found."""
    pos = find_first_position(text, patterns)
    return pos if pos >= 0 else 0.5

def get_product_name(text):
    """Try to extract the product name from text."""
    # Look for common patterns
    patterns = [
        r'(?:introducing|meet|welcome to|this is|called|named|we built|we created|launch(?:ing)?)\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)',
        r"(?:I'm|we're|we are)\s+(?:the )?(?:founder|co-founder|CEO|creator|maker)s?\s+(?:of|at|behind)\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)",
        r'([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)\s+(?:is|helps|lets|allows|enables|makes)',
    ]
    for p in patterns:
        m = re.search(p, text)
        if m:
            name = m.group(1).strip()
            # Filter out common words
            if name.lower() not in ('the', 'this', 'that', 'we', 'our', 'my', 'your', 'it', 'so', 'and', 'but', 'hey', 'hi', 'hello', 'today', 'now', 'here', 'product', 'hunt'):
                return name
    return None

# ─── Brand/Company Detection ──────────────────────────────────────────────────

KNOWN_BRANDS = {
    'google', 'facebook', 'meta', 'apple', 'amazon', 'microsoft', 'aws', 'azure',
    'slack', 'notion', 'github', 'gitlab', 'jira', 'trello', 'asana', 'linear',
    'figma', 'sketch', 'adobe', 'canva', 'stripe', 'shopify', 'salesforce',
    'hubspot', 'zoom', 'teams', 'discord', 'telegram', 'whatsapp', 'twitter',
    'linkedin', 'instagram', 'tiktok', 'youtube', 'spotify', 'netflix',
    'openai', 'anthropic', 'gpt', 'chatgpt', 'claude', 'gemini', 'midjourney',
    'vercel', 'netlify', 'heroku', 'supabase', 'firebase', 'mongodb',
    'postgres', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'snowflake',
    'databricks', 'airflow', 'kafka', 'docker', 'kubernetes',
    'react', 'angular', 'vue', 'nextjs', 'webpack', 'vite',
    'zapier', 'make', 'ifttt', 'airtable', 'basecamp',
    'dropbox', 'box', 'onedrive', 'icloud',
    'intercom', 'zendesk', 'freshdesk', 'mailchimp', 'sendgrid',
    'twilio', 'segment', 'amplitude', 'mixpanel', 'datadog',
    'sentry', 'pagerduty', 'grafana', 'prometheus',
    'uber', 'lyft', 'airbnb', 'doordash',
    'y combinator', 'yc', 'techstars', 'sequoia', 'a16z', 'andreessen',
    'grammarly', 'jasper', 'copy.ai', 'writesonic',
    'cursor', 'copilot', 'replit', 'codespace', 'stackblitz',
    'loom', 'cal.com', 'calendly', 'typeform',
    'webflow', 'wordpress', 'wix', 'squarespace',
    'confluence', 'coda', 'roam', 'obsidian', 'bear',
    'postman', 'insomnia', 'swagger',
    'tableau', 'looker', 'metabase', 'power bi', 'powerbi',
    'redshift', 'bigquery',
    'pinecone', 'weaviate', 'qdrant', 'milvus', 'chromadb',
    'langchain', 'llamaindex',
    'excel', 'powerpoint', 'word', 'outlook',
    'chrome', 'safari', 'firefox', 'edge',
    'polymarket', 'robinhood', 'coinbase', 'binance',
    'producthunt', 'product hunt', 'hacker news',
    'cap cut', 'capcut', 'premiere', 'davinci',
}

INTEGRATION_NAMES = {
    'slack', 'notion', 'github', 'gitlab', 'jira', 'trello', 'asana', 'linear',
    'figma', 'stripe', 'shopify', 'salesforce', 'hubspot', 'zoom', 'teams',
    'discord', 'telegram', 'whatsapp', 'zapier', 'make', 'airtable',
    'dropbox', 'google drive', 'onedrive', 'intercom', 'zendesk', 'mailchimp',
    'sendgrid', 'twilio', 'segment', 'amplitude', 'mixpanel', 'datadog',
    'sentry', 'pagerduty', 'vercel', 'netlify', 'supabase', 'firebase',
    'mongodb', 'postgres', 'postgresql', 'mysql', 'redis', 'snowflake',
    'bigquery', 'redshift', 'elasticsearch', 'docker', 'kubernetes',
    'aws', 'azure', 'gcp', 'google cloud', 'heroku',
    'openai', 'anthropic', 'claude', 'gpt', 'gemini',
    'cal.com', 'calendly', 'typeform', 'webflow', 'wordpress',
    'confluence', 'coda', 'postman', 'chrome', 'safari',
    'excel', 'google sheets', 'power bi',
    'pinecone', 'weaviate', 'qdrant', 'milvus',
    'langchain', 'llamaindex', 'open router', 'openrouter',
}

def count_brands(text, product_name=None):
    """Count distinct brand names in text."""
    text_lower = text.lower()
    found = set()
    for brand in KNOWN_BRANDS:
        if brand in text_lower:
            # Don't count the product itself as a brand
            if product_name and brand.lower() == product_name.lower():
                continue
            found.add(brand)
    return len(found)

def count_integrations(text, product_name=None):
    """Count distinct integration names in text."""
    text_lower = text.lower()
    found = set()
    for name in INTEGRATION_NAMES:
        if name in text_lower:
            if product_name and name.lower() == product_name.lower():
                continue
            found.add(name)
    return len(found)

def count_platforms(text, product_name=None):
    """Count platform/tool mentions."""
    text_lower = text.lower()
    found = set()
    for brand in KNOWN_BRANDS:
        if brand in text_lower:
            if product_name and brand.lower() == product_name.lower():
                continue
            found.add(brand)
    return len(found)


# ─── Main Extraction ──────────────────────────────────────────────────────────

def extract_all(transcript_obj):
    """Extract all 200 dimensions from a transcript."""
    tid = transcript_obj['id']
    text = transcript_obj['transcript']

    # Basic text processing
    sents = sentences(text)
    wds = words(text)
    word_count = len(wds)
    sent_count = len(sents)
    text_lower = text.lower()

    if word_count == 0:
        word_count = 1  # avoid division by zero
    if sent_count == 0:
        sent_count = 1

    # Product name detection
    product_name = get_product_name(text)

    # ── V1 DIMENSIONS ─────────────────────────────────────────────────────

    # === Opening (6 dims) ===
    first_sent = sents[0] if sents else text[:100]
    first_sent_lower = first_sent.lower().strip()

    # hook_type
    hook_type = "descriptive"
    if re.match(r'^(hey|hi|hello|what\'s up|yo|welcome)', first_sent_lower):
        # Distinguish greeting that transitions to founder story or announcement
        if re.search(r'(i\'m|we\'re|i am|we are|my name|we built|i built|i\'ve been|we\'ve been|i founded|we founded|co-founder|founder)', first_sent_lower):
            hook_type = "founder_story"
        elif re.search(r'(introducing|launch|announcing|excited|release|presenting|today we)', first_sent_lower):
            hook_type = "announcement"
        elif re.search(r'(product hunt|PH)', first_sent_lower, re.I):
            hook_type = "greeting"
        else:
            hook_type = "greeting"
    elif re.match(r'^(i |i\'m|i\'ve|we |we\'re|we\'ve|my |our )', first_sent_lower):
        hook_type = "founder_story"
    elif '?' in first_sent:
        hook_type = "question"
    elif re.search(r'(tired|frustrated|broken|hate|problem|struggle|sick of|spending hours)', first_sent_lower):
        hook_type = "pain_point"
    elif re.search(r'(introducing|launch|announcing|release|excited to)', first_sent_lower):
        hook_type = "announcement"
    elif re.search(r'(let me show|click|demo|i\'m going to show)', first_sent_lower):
        hook_type = "demo_instruction"
    elif re.search(r'(\d+%|\d+ million|\d+x|every|always|never)', first_sent_lower):
        hook_type = "stat_number"
    elif re.search(r'(the (best|only|first|most)|no one|nobody|nothing)', first_sent_lower):
        hook_type = "bold_claim"
    elif product_name and product_name.lower() in first_sent_lower:
        hook_type = "product_statement"

    # first_person_opener
    first_person_opener = 1 if re.match(r'^(i |i\'m|i\'ve|we |we\'re|we\'ve|my |our )', first_sent_lower) else 0

    # has_negative_opener
    has_negative_opener = 1 if re.search(r'(broken|tired|hate|frustrated|problem|struggle|sick|annoying|painful|nightmare|waste|losing|lost|fail|never|worst)', first_sent_lower) else 0

    # first_sentence_words
    first_sentence_words = len(words(first_sent))

    # hook_quality (1-5)
    hook_quality = 3
    if hook_type in ("pain_point", "bold_claim", "stat_number"):
        hook_quality = 4
    if hook_type == "question":
        hook_quality = 4
    if hook_type == "founder_story":
        # Founder stories with credentials are stronger
        if re.search(r'(built|founded|created|grew|million|years)', first_sent_lower):
            hook_quality = 4
        else:
            hook_quality = 3
    if hook_type == "product_statement":
        hook_quality = 3
    if has_negative_opener:
        hook_quality = min(5, hook_quality + 1)
    if hook_type == "greeting":
        # Plain greeting = weak, but greeting with substance = ok
        if first_sentence_words > 12:
            hook_quality = 3
        else:
            hook_quality = 2
    if hook_type == "announcement":
        hook_quality = 3
    if hook_type == "demo_instruction":
        hook_quality = 2
    if hook_type == "descriptive":
        # Descriptive can be good if it's punchy
        if first_sentence_words <= 10:
            hook_quality = 3
        elif first_sentence_words <= 20:
            hook_quality = 2
        else:
            hook_quality = 2
    if first_sentence_words > 30:
        hook_quality = max(1, hook_quality - 1)
    # Check raw text for production markers at start (before sentence cleaning strips them)
    raw_start = text[:100].lower()
    if re.search(r'\[music\]|\[applause\]|\[laughter\]', first_sent_lower) or re.match(r'\s*\[', raw_start):
        hook_quality = 1
    # Short, punchy openers get a boost
    if first_sentence_words <= 8 and hook_type in ("pain_point", "bold_claim", "question"):
        hook_quality = 5
    # Vivid, specific openers
    if re.search(r'(\d+ (hours?|minutes?|%)|every time|tired of|spending|wasting|still|your .{3,15} just)', first_sent_lower):
        hook_quality = min(5, hook_quality + 1)

    # === Length & Readability (6 dims) ===
    avg_sentence_length = round(word_count / sent_count, 1)

    total_syllables = sum(syllable_count(w) for w in wds)
    fk_grade = round(flesch_kincaid(word_count, sent_count, total_syllables), 1)

    unique_words = len(set(w.lower() for w in wds))
    word_diversity = round(unique_words / word_count, 3)

    syl_density = round(total_syllables / word_count, 2) if word_count > 0 else 1.0

    # === Pronouns & Voice (5 dims) ===
    we_count = len(re.findall(r'\b(we|our|us)\b', text_lower))
    you_count = len(re.findall(r'\b(you|your|you\'re|you\'ll|you\'ve)\b', text_lower))

    if we_count > you_count * 1.5:
        pronoun_strategy = "mostly_we"
    elif you_count > we_count * 1.5:
        pronoun_strategy = "mostly_you"
    elif we_count + you_count < 3:
        pronoun_strategy = "neutral"
    else:
        pronoun_strategy = "balanced"

    hedge_count = count_pattern(text_lower, [r'\bmaybe\b', r'\bperhaps\b', r'\bmight\b', r'\bkind of\b', r'\bsort of\b', r'\barguably\b', r'\bpossibly\b', r'\bprobably\b'])
    filler_count = count_pattern(text_lower, [r'\bum\b', r'\buh\b', r'\blike\b(?=\s)', r'\bbasically\b', r'\bactually\b', r'\bliterally\b', r'\bso yeah\b'])

    # === Narrative Arc (5 dims) ===
    # Determine problem and solution portions
    problem_keywords = r'(problem|issue|struggle|pain|frustrat|difficult|challenge|broken|waste|losing|manual|tedious|complex|confus|slow|expensive|error|bug|tired|annoying|hate|suffer|mess|nightmare|chaos|headache)'
    solution_keywords = r'(solution|solv|fix|help(s|ed|ing)?\s+(you|teams|users)|enabl|automat|simplif|streamlin|introduc|built\s+(for|to|a)|meet\s+[A-Z]|presenting|tool\s+(that|for|to)|platform\s+(that|for|to)|feature|dashboard|workspace|assistant)'

    # Split into thirds
    third = len(text) // 3
    first_third = text_lower[:third]
    mid_third = text_lower[third:2*third]
    last_third = text_lower[2*third:]

    prob_first = len(re.findall(problem_keywords, first_third))
    prob_mid = len(re.findall(problem_keywords, mid_third))
    prob_last = len(re.findall(problem_keywords, last_third))
    sol_first = len(re.findall(solution_keywords, first_third))
    sol_mid = len(re.findall(solution_keywords, mid_third))
    sol_last = len(re.findall(solution_keywords, last_third))

    total_prob = prob_first + prob_mid + prob_last
    total_sol = sol_first + sol_mid + sol_last
    total_sig = total_prob + total_sol

    if word_count < 30:
        narrative_arc = "too_short"
    elif total_prob == 0 and total_sol == 0:
        narrative_arc = "neutral_flat"
    elif prob_first > sol_first and sol_mid + sol_last > prob_mid + prob_last:
        narrative_arc = "problem_solution"
    elif sol_first > prob_first and total_prob < total_sol:
        narrative_arc = "solution_first"
    elif total_prob > total_sol * 2:
        narrative_arc = "problem_heavy"
    elif prob_first == 0 and sol_first == 0 and (total_sol > 0 or total_prob > 0):
        # Check for traction first
        traction_patterns = r'(\d+\s*(users|customers|companies|teams|downloads|stars)|revenue|arr|raised|funding|grew|growth)'
        if re.search(traction_patterns, first_third):
            narrative_arc = "traction_first"
        else:
            narrative_arc = "neutral_flat"
    else:
        # Default classification
        if total_prob > 0 and total_sol > 0:
            narrative_arc = "problem_solution"
        else:
            narrative_arc = "neutral_flat"

    topic_transitions = 0
    for i in range(1, len(sents)):
        prev_lower = sents[i-1].lower()
        curr_lower = sents[i].lower()
        # Detect topic shifts via transition words or drastic content change
        if re.search(r'\b(but|however|now|next|also|another|moving on|let\'s|so |additionally|furthermore|on top of that|beyond that|speaking of|let me)\b', curr_lower[:30]):
            topic_transitions += 1

    problem_pct = round((total_prob / max(total_sig, 1)) * 100, 1)
    solution_pct = round((total_sol / max(total_sig, 1)) * 100, 1)

    # declining_arc
    # Check if tone shifts from positive early to urgent/dark late
    urgency_late = count_pattern(last_third, [r'\b(hurry|now|today|don\'t miss|limited|running out|last chance|before it\'s|act now)\b'])
    positive_early = count_pattern(first_third, [r'\b(great|love|amazing|awesome|fantastic|wonderful|incredible|beautiful|perfect)\b'])
    declining_arc = 1 if urgency_late > 0 and positive_early > urgency_late else 0

    # === Metrics & Traction (8 dims) ===
    numbers = re.findall(r'\b\d[\d,.]*\b', text)
    number_count = len(numbers)
    number_density = round(number_count / word_count * 100, 2)

    # metric_placement
    nums_first = len(re.findall(r'\b\d[\d,.]*\b', first_third))
    nums_mid = len(re.findall(r'\b\d[\d,.]*\b', mid_third))
    nums_last = len(re.findall(r'\b\d[\d,.]*\b', last_third))
    if number_count == 0:
        metric_placement = "none"
    elif nums_first >= nums_mid and nums_first >= nums_last:
        metric_placement = "front"
    elif nums_last >= nums_first and nums_last >= nums_mid:
        metric_placement = "back"
    else:
        metric_placement = "middle"

    before_after_total = count_pattern(text_lower, [
        r'before.*?after', r'used to.*?now', r'went from.*?to',
        r'was.*?now it\'s', r'old way.*?new way', r'instead of.*?now',
        r'what took.*?now takes', r'from.*?to\s+\d', r'previously.*?now',
    ])

    success_users = count_pattern(text_lower, [
        r'\d[\d,]*\+?\s*(users|customers|companies|teams|organizations|businesses|people|developers|creators|clients|subscribers|members)',
        r'(users|customers|teams)\s*:\s*\d',
    ])

    success_revenue = count_pattern(text_lower, [
        r'(\$\d|\d+\s*(revenue|arr|mrr|annual|monthly recurring))',
        r'(revenue|arr|mrr)\s*of\s*\$',
    ])

    success_cost_savings = count_pattern(text_lower, [
        r'(sav(e|es|ed|ing)\s*(you|teams|companies)?\s*\$?\d)',
        r'(reduc(e|es|ed|ing)\s*costs?)',
        r'(\d+%\s*(less|cheaper|reduction|savings?))',
        r'(cut\s*(costs?|spending|expenses?))',
    ])

    success_growth = count_pattern(text_lower, [
        r'(\d+x\s*(growth|faster|more|increase))',
        r'(grew|growth|growing)\s*(by\s*)?\d',
        r'(\d+%\s*(growth|increase|improvement|boost|uplift))',
    ])

    # === Social Proof (10 dims) ===
    brand_count = count_brands(text, product_name)

    has_investor_mention = has_pattern(text_lower, [
        r'\b(investor|funded|funding|raised|backed by|venture|seed|series [a-d]|capital|vc|angel|yc|y combinator|techstars)\b',
    ])

    has_testimonial = has_pattern(text_lower, [
        r'(said|told us|according to|quote|".*?".*?said)', r'(loved|loves) (it|the|our|this)',
        r'(testimonial|review|feedback|story)', r'(one of our (users|customers|clients) said)',
    ])

    trusted_by = has_pattern(text_lower, [r'trusted by', r'used by', r'loved by', r'chosen by', r'relied on by'])

    has_partnership = has_pattern(text_lower, [
        r'\b(partner|partnership|partnered|collaboration|collaborated|working with|teamed up|alliance)\b',
    ])

    has_credential = has_pattern(text_lower, [
        r'\b(ex-|former|previously at|worked at|built at|from google|from meta|from facebook|from apple|from amazon|from microsoft)\b',
        r'\b(phd|doctorate|professor|stanford|mit|harvard|berkeley|oxford|cambridge)\b',
        r'\b(years? (of )?experience|decade|veteran)\b',
    ])

    social_proof_claims = has_investor_mention + has_testimonial + trusted_by + has_partnership + has_credential + min(1, success_users) + min(1, brand_count)

    platform_mentions = count_platforms(text, product_name)

    competitive_total = count_pattern(text_lower, [
        r'\b(unlike|compared to|better than|faster than|cheaper than|more than|vs\.?|versus|competitor|alternative)\b',
        r'\b(other tools?|other platforms?|existing solutions?|traditional)\b',
    ])

    replacement_total = count_pattern(text_lower, [
        r'\b(replace|replacing|replacement|instead of|switch from|ditch|drop|stop using|no more|forget about|say goodbye)\b',
    ])

    # === Category & Positioning (4 dims) ===
    category_creation_total = count_pattern(text_lower, [
        r'\b(the first|the only|world\'s first|we invented|a new kind|new category|pioneering|never been done)\b',
        r'\b(first ever|only platform|only tool|only solution|nobody else)\b',
    ])

    ai_count = len(re.findall(r'\b(ai|artificial intelligence|machine learning|ml|deep learning|neural|llm|gpt|large language model|gen\s?ai|generative ai)\b', text_lower))
    ai_density = round(ai_count / word_count * 100, 2)

    buzzword_count = count_pattern(text_lower, [
        r'\b(revolutionary|game.?chang|cutting.?edge|disruptive|paradigm|synergy|leverage|unlock|empower|seamless|frictionless|next.?gen|state.?of.?the.?art|bleeding.?edge|world.?class|best.?in.?class)\b',
    ])

    # === CTA & Closing (8 dims) ===
    last_sents = ' '.join(sents[-3:]).lower() if len(sents) >= 3 else text_lower

    cta_patterns = {
        'waitlist': r'\b(waitlist|wait list|waiting list)\b',
        'join': r'\b(join|join us|join today)\b',
        'sign_up': r'\b(sign up|signup|register|create an account)\b',
        'try': r'\b(try|try it|give it a try|test it)\b',
        'get_started': r'\b(get started|start now|start today|start building)\b',
        'book_demo': r'\b(book|schedule|request)\s*(a\s*)?(demo|call|meeting)\b',
        'free': r'\b(free|for free|no cost|free trial|free plan|free tier)\b',
        'beta': r'\b(beta|early access|preview)\b',
        'limited': r'\b(limited|exclusive|invite only|invite-only)\b',
    }

    primary_cta = "none"
    cta_position = "none"

    # Check for CTA in different positions
    for name, pattern in cta_patterns.items():
        if re.search(pattern, text_lower):
            primary_cta = name
            # Find position
            m = re.search(pattern, text_lower)
            if m:
                pos = m.start() / len(text_lower)
                if pos < 0.2:
                    cta_position = "start"
                elif pos < 0.7:
                    cta_position = "middle"
                else:
                    cta_position = "end"
            break

    # Check last sentences for CTA
    for name, pattern in cta_patterns.items():
        if re.search(pattern, last_sents):
            primary_cta = name
            cta_position = "end"
            break

    has_discount = has_pattern(text_lower, [r'\b(discount|deal|offer|% off|\d+% off|coupon|promo|special price|sale)\b'])

    has_scarcity = has_pattern(text_lower, [
        r'\b(limited|exclusive|only \d+ spots|invite only|invite-only|early access|first \d+ users|running out|last chance)\b',
    ])

    has_pricing = has_pattern(text_lower, [
        r'\$\d', r'\b(pricing|price|cost|per month|per year|/mo|/yr|subscription|plan|tier|free plan|paid plan|premium)\b',
    ])

    has_url = has_pattern(text, [
        r'(https?://|www\.|\.com|\.io|\.ai|\.dev|\.app|\.co\b|\.org)',
    ])

    closing_has_cta = has_pattern(last_sents, [
        r'\b(try|sign up|get started|check|visit|head over|download|join|start|book|subscribe|waitlist)\b',
    ])

    closing_has_thanks = has_pattern(last_sents, [
        r'\b(thanks|thank you|bye|goodbye|cheers|appreciate|grateful)\b',
    ])

    # === Content Signals (15 dims) ===
    storytelling = has_pattern(text_lower, [
        r'\b(one day|last year|months ago|years ago|back when|i remember|story|told me|happened|journey|started|began)\b',
        r'\b(i was|we were|when i|when we)\b.*\b(realized|discovered|noticed|found)\b',
    ])

    humor = has_pattern(text_lower, [
        r'\b(haha|lol|just kidding|joke|funny|humor|laugh|hilarious|spoiler|plot twist)\b',
        r'😂|🤣|😄',
        r'\[laughter\]',
    ])

    demo_instructions = count_pattern(text_lower, [
        r'\b(click|tap|press|drag|drop|select|choose|open|type|enter|paste|copy)\s+(here|this|that|the|on)',
        r'\b(let me show|i\'ll show|watch|look at|check out|as you can see)\b',
        r'\b(head over|go to|navigate to|run the|install|clone|set up|configure|test it|try it)\b',
    ])

    screen_narration = count_pattern(text_lower, [
        r'\b(here you can see|on the (left|right|top|bottom|screen)|as you can see|what you see|you\'ll see|you\'ll notice|on this page|on this screen|in front of you|right here)\b',
    ])

    data_viz_cues = count_pattern(text_lower, [
        r'\b(chart|graph|dashboard|visualization|plot|metrics|data|analytics|table|report|spreadsheet|heatmap)\b',
    ])

    energy_markers = text.count('!') + count_pattern(text_lower, [
        r'\b(amazing|awesome|incredible|fantastic|wow|love|brilliant|beautiful|powerful|stunning|gorgeous|insane|crazy good|super)\b',
    ])

    feature_list_markers = count_pattern(text_lower, [
        r'\b(first(ly)?|second(ly)?|third(ly)?|fourth|fifth|number one|number two|number three|also|additionally|another|plus|on top of|furthermore|moreover|next up|finally|lastly)\b',
    ])

    production_markers = len(re.findall(r'\[.*?\]', text))

    speaker_changes = text.count('>>') + count_pattern(text, [r'\n\s*[-–—]\s*[A-Z]', r'\b[A-Z][a-z]+:\s'])

    action_verbs = count_pattern(text_lower, [
        r'\b(build|create|launch|ship|deploy|install|connect|integrate|automate|generate|analyze|monitor|track|manage|optimize|transform|convert|boost|accelerate|scale|streamline|simplify|eliminate|reduce|cut|slash|save|protect|secure|detect|discover|unlock|enable)\b',
    ])

    feature_words = count_pattern(text_lower, [
        r'\b(feature|capability|functionality|integration|api|sdk|plugin|extension|module|component|dashboard|interface|tool|widget|endpoint|webhook|pipeline|workflow|template|preset|automation|connector|adapter)\b',
    ])

    benefit_words = count_pattern(text_lower, [
        r'\b(save|faster|easier|better|simpler|cheaper|efficient|productive|powerful|accurate|reliable|secure|scalable|flexible|intuitive|seamless|instant|automatic|effortless|painless|worry-free|hassle-free|time-saving|cost-effective)\b',
    ])

    benefit_ratio = round(benefit_words / max(benefit_words + feature_words, 1), 2)

    question_count = text.count('?')

    passive_voice_count = sum(1 for s in sents if is_passive(s))

    # === Sentiment (3 dims) ===
    pos_words = count_pattern(text_lower, [
        r'\b(great|love|amazing|awesome|fantastic|wonderful|incredible|beautiful|perfect|excellent|brilliant|outstanding|remarkable|impressive|delightful|enjoy|happy|excited|glad|pleased|thrilled)\b',
    ])
    neg_words = count_pattern(text_lower, [
        r'\b(bad|terrible|awful|horrible|worst|hate|frustrat|annoy|painful|broken|fail|error|bug|mess|nightmare|chaos|struggle|suffer|waste|lose|lost|destroy|damage|ruin|toxic)\b',
    ])

    if pos_words > neg_words * 2:
        sentiment = "positive"
    elif neg_words > pos_words * 2:
        sentiment = "negative"
    else:
        sentiment = "neutral" if pos_words + neg_words < 3 else ("positive" if pos_words >= neg_words else "negative")

    confidence_count = count_pattern(text_lower, [
        r'\b(will|definitely|guaranteed|proven|always|certainly|absolutely|undoubtedly|clearly|obviously|without doubt|for sure|no question)\b',
    ])

    product_name_repeats = 0
    if product_name:
        product_name_repeats = len(re.findall(re.escape(product_name.lower()), text_lower))

    # ── V2 DIMENSIONS ─────────────────────────────────────────────────────

    # === A. Story Architecture (17 dims) ===

    inciting_incident = has_pattern(text_lower, [
        r'\b(one day|last (year|month|week|tuesday|time)|when i was|i was sitting|i remember|that moment|the day|it happened|i realized|we discovered|we noticed|it hit me|it struck me|that\'s when|i found myself|we found ourselves)\b',
        r'\b(my .{3,30} bill was|spent \d+ hours?|wasted \d+|lost \d+|cost us)\b',
    ])

    villain_named = has_pattern(text_lower, [
        r'\b(spreadsheet|excel|email|manual|copy.?paste|legacy|traditional|outdated|old.?school|slack|jira|the old way)\b',
        r'\b(complexity|information overload|context switching|tab switching|tool sprawl|data silos|fragmented|disorganized)\b',
    ])

    villain_count_val = 0
    villain_patterns = [
        r'\b(spreadsheets?)\b', r'\b(emails?)\b', r'\b(manual (process|work|effort|entry))\b',
        r'\b(copy.?past(e|ing))\b', r'\b(legacy (system|tool|software))\b',
        r'\b(complexity)\b', r'\b(context switching)\b', r'\b(data silos?)\b',
        r'\b(fragmented|disorganized|chaotic)\b', r'\b(slow|tedious|repetitive)\b',
    ]
    for vp in villain_patterns:
        if re.search(vp, text_lower):
            villain_count_val += 1

    stakes_escalation = 0
    # Check if problem severity increases across the text
    severity_words_first_half = count_pattern(text_lower[:len(text)//2], [r'\b(annoying|tedious|slow|difficult)\b'])
    severity_words_second_half = count_pattern(text_lower[len(text)//2:], [r'\b(costs?|losing|waste|critical|dangerous|risk|failure|disaster|burnout|expensive|revenue|customers leave)\b'])
    if severity_words_first_half > 0 and severity_words_second_half > 0:
        stakes_escalation = 1

    transformation_promise = has_pattern(text_lower, [
        r'\b(go from .{3,40} to)\b', r'\b(become|transform|turn into|evolve|reimagine|reinvent)\b',
        r'\b(never again|no longer|stop being|start being)\b',
        r'\b(transform how you|change the way|revolutionize your)\b',
    ])

    transformation_patterns = [
        r'(go from|become|transform|turn into|never again|change the way|reimagine|reinvent)',
    ]
    transformation_position = find_first_position(text_lower, transformation_patterns)
    if transformation_position < 0:
        transformation_position = -1

    # pivot_sharpness (1-5)
    pivot_markers = count_pattern(text_lower, [
        r'\b(so we built|that\'s why we|introducing|meet |enter )\b',
        r'\b(here\'s|the solution|our answer|we created|we made|we developed)\b',
    ])
    sharp_pivot = count_pattern(text_lower, [
        r'\bintroducing\b', r'\bmeet\b', r'\benter\b', r'\bthat\'s why\b',
    ])

    if sharp_pivot > 0 and total_prob > 0:
        pivot_sharpness = 5
    elif pivot_markers > 0 and total_prob > 0:
        pivot_sharpness = 4
    elif total_prob > 0 and total_sol > 0:
        pivot_sharpness = 3
    elif total_sol > 0:
        pivot_sharpness = 2
    else:
        pivot_sharpness = 1

    nested_stories = has_pattern(text_lower, [
        r'\b(one of our (users?|customers?|clients?))\b',
        r'\b(for example|case study|real.?world|in practice|here\'s a story|let me tell|customer told|user said)\b',
        r'\b(a team at|a company|one developer|a founder)\b.{5,80}\b(used|tried|built|discovered|found)\b',
    ])

    temporal_anchors = count_pattern(text_lower, [
        r'\b(\d+ (years?|months?|weeks?|days?|hours?|minutes?|seconds?))\b',
        r'\b(last (year|month|week|quarter))\b',
        r'\b(in \d+ (seconds?|minutes?|hours?))\b',
        r'\b(within (minutes?|hours?|days?|seconds?))\b',
        r'\b(\d+ (years?|months?) ago)\b',
        r'\b(today|yesterday|tomorrow|this (year|month|week))\b',
    ])

    imagine_device = count_pattern(text_lower, [
        r'\b(imagine|picture this|what if you could|think about|envision|visualize|consider a world)\b',
    ])

    cliffhanger_beats = count_pattern(text_lower, [
        r'\b(but here\'s the thing|and then|something changed|wait until|the best part|you won\'t believe|here\'s where|but wait|and that\'s not all|gets better|gets even better|here\'s the kicker|plot twist)\b',
    ])

    why_now = has_pattern(text_lower, [
        r'\b(now that|thanks to|with the (rise|advent|emergence)|finally possible|now (possible|feasible)|recent (advances?|breakthrough)|ai (makes?|enables?|allows?))\b',
        r'\b(the time is|market is (ready|ripe)|technology (has|now)|couldn\'t be done before)\b',
    ])

    # journey_vs_destination (0-1)
    journey_words = count_pattern(text_lower, [r'\b(takes you|guides you|walks you|helps you go from|journey|process|step by step|along the way|path|road|workflow)\b'])
    destination_words = count_pattern(text_lower, [r'\b(the (solution|platform|tool|answer)|all-in-one|everything you need|complete|comprehensive|one-stop)\b'])
    jvd_total = journey_words + destination_words
    journey_vs_destination = round(journey_words / max(jvd_total, 1), 2)

    # emotional_bookend_match
    first_quarter = text_lower[:len(text)//4]
    last_quarter = text_lower[3*len(text)//4:]
    pain_start = count_pattern(first_quarter, [r'\b(problem|frustrat|pain|struggle|tired|broken|hate|waste)\b'])
    relief_end = count_pattern(last_quarter, [r'\b(easy|simple|fast|solved|love|enjoy|free|powerful|better|great|done)\b'])
    emotional_bookend_match = 1 if (pain_start > 0 and relief_end > 0) else 0

    unsaid_problem = count_pattern(text_lower, [
        r'\b(you know (that|the|how)|we\'ve all been|sound familiar|we all know|been there|know the feeling|all too familiar)\b',
    ])

    # resolution_completeness
    problems_raised = total_prob
    solutions_offered = total_sol
    resolution_completeness = round(min(solutions_offered / max(problems_raised, 1), 1.0), 2)

    # story_compression (1-5)
    time_span_mentions = count_pattern(text_lower, [r'\b(years?|months?|decade|century|generation|era|history|since \d{4})\b'])
    if time_span_mentions > 3 and sent_count < 30:
        story_compression = 5.0
    elif time_span_mentions > 1:
        story_compression = 3.0
    elif word_count < 200:
        story_compression = 4.0
    else:
        story_compression = 2.0

    # === B. Emotional Mechanics (17 dims) ===

    # emotion_specificity (1-5)
    specific_emotions = count_pattern(text_lower, [
        r'(that feeling when|that moment when|the rush|sinking feeling|pit in your stomach|2am|friday night|monday morning|at 3am|in the middle of|during a meeting|on a call)',
        r'(\d+ (hours?|minutes?) of|staring at|waiting for|watching .{3,20} fail)',
    ])
    generic_emotions = count_pattern(text_lower, [r'\b(frustrated|happy|sad|angry|confused|worried|stressed|anxious|excited|tired|overwhelmed|annoyed|painful|tedious)\b'])
    # Situational emotion markers — scenarios that imply emotional context
    situational_emotions = count_pattern(text_lower, [
        r'(spending hours|wasting time|losing (focus|time|customers)|chasing|juggling|drowning in|buried under|struggling with|pulling your hair)',
        r'(every time you|again and again|over and over|day after day|week after week|constantly|endlessly)',
        r'(imagine|picture|think about|what if|when you|the moment)',
    ])

    emotion_total = specific_emotions * 3 + generic_emotions + situational_emotions
    if emotion_total >= 8:
        emotion_specificity = 5
    elif emotion_total >= 5:
        emotion_specificity = 4
    elif emotion_total >= 3:
        emotion_specificity = 3
    elif emotion_total >= 1:
        emotion_specificity = 2
    else:
        emotion_specificity = 1

    # relief_distance: sentences between problem introduction and solution
    first_problem_sent = -1
    first_solution_sent = -1
    for i, s in enumerate(sents):
        s_lower = s.lower()
        if first_problem_sent < 0 and re.search(problem_keywords, s_lower):
            first_problem_sent = i
        if first_solution_sent < 0 and first_problem_sent >= 0 and re.search(solution_keywords, s_lower):
            first_solution_sent = i
            break

    if first_problem_sent >= 0 and first_solution_sent >= 0:
        relief_distance = first_solution_sent - first_problem_sent
    else:
        relief_distance = 0

    pride_trigger = count_pattern(text_lower, [
        r'\b(you already know|as a (developer|designer|founder|engineer|pm|marketer)|smart teams?|you understand|you\'re the kind|savvy|experienced|expert)\b',
    ])

    fomo_construction = count_pattern(text_lower, [
        r'\b(competitors? (are|already|is)|market is moving|everyone is|don\'t (get|be) left|while you\'re still|your competitors?|falling behind|catching up|getting ahead)\b',
    ])

    empathy_firsthand = has_pattern(text_lower, [
        r'\b(i (spent|wasted|struggled|experienced|dealt|lived)|when i was|i used to|we experienced|we spent|i found myself|we found ourselves|personally|my own|our own)\b',
    ])

    empathy_observed = has_pattern(text_lower, [
        r'\b(teams? (struggle|spend|waste)|developers? (spend|struggle|hate)|companies? (waste|spend|lose)|people (spend|struggle|waste)|users? (struggle|complain|hate))\b',
    ])

    # frustration_vocabulary_breadth
    frustration_facets = set()
    facet_patterns = {
        'time_waste': r'\b(waste time|hours spent|takes forever|slow|time-consuming)\b',
        'complexity': r'\b(complex|complicated|confusing|overwhelming|steep learning)\b',
        'cost': r'\b(expensive|costly|overpriced|waste money|paying too much)\b',
        'error_prone': r'\b(errors?|bugs?|mistakes?|broken|fails?|crash)\b',
        'tedium': r'\b(tedious|repetitive|boring|manual|mundane|drudgery)\b',
        'fragmented': r'\b(fragmented|scattered|siloed|disconnected|spread across)\b',
        'context_switch': r'\b(switch|switching|tab|back and forth|copy.?paste)\b',
        'scale': r'\b(doesn\'t scale|can\'t scale|scaling|bottleneck|limitation)\b',
        'collaboration': r'\b(misalign|miscommunicat|out of sync|not on same page)\b',
        'security': r'\b(insecure|vulnerability|risk|breach|unsafe|exposed)\b',
    }
    for facet, pattern in facet_patterns.items():
        if re.search(pattern, text_lower):
            frustration_facets.add(facet)
    frustration_vocabulary_breadth = len(frustration_facets)

    # joy_velocity_shift (1-5)
    if sharp_pivot > 0:
        joy_velocity_shift = 4
    elif pivot_markers > 0:
        joy_velocity_shift = 3
    elif total_prob > 0 and total_sol > 0:
        joy_velocity_shift = 2
    else:
        joy_velocity_shift = 1
    if total_prob == 0:
        joy_velocity_shift = 1

    vulnerability_moment = has_pattern(text_lower, [
        r'\b(our first (version|attempt|try)|we almost (gave up|quit)|we got (this|it) wrong|we (failed|struggled)|honestly|to be honest|not perfect|we\'re still|i\'ll admit|i admit|embarrass)\b',
    ])

    anticipatory_emotion = count_pattern(text_lower, [
        r'\b(wait until|you\'re going to love|here\'s the (exciting|cool|best)|watch this|check this out|let me show you something|you\'ll love|get ready)\b',
    ])

    social_belonging = count_pattern(text_lower, [
        r'\b(join \d|community|thousands of|hundreds of|fellow (founders?|developers?|builders?|creators?|engineers?)|you\'re in good company|together|growing community)\b',
    ])

    # loss_aversion_framing (0-1)
    gain_frames = count_pattern(text_lower, [r'\b(save|gain|earn|win|get|receive|achieve|boost|improve|increase|grow)\b'])
    loss_frames = count_pattern(text_lower, [r'\b(lose|losing|lost|waste|wasting|miss|missing|cost you|costing|spend|spending|bleed|drain)\b'])
    laf_total = gain_frames + loss_frames
    loss_aversion_framing = round(loss_frames / max(laf_total, 1), 2)

    surprise_delight = count_pattern(text_lower, [
        r'\b(oh and|bonus|did i mention|cherry on top|and it also|not only|on top of that|and the best|and here\'s the thing|and wait|plus it|also does|even does)\b',
    ])

    # confidence_gradient (1-5) — does certainty grow?
    confidence_first_half = count_pattern(text_lower[:len(text)//2], [r'\b(might|maybe|could|possibly|try|hope|think|believe)\b'])
    confidence_second_half = count_pattern(text_lower[len(text)//2:], [r'\b(will|definitely|guaranteed|proven|always|certainly|absolutely|clearly)\b'])
    if confidence_second_half > confidence_first_half * 2 and confidence_second_half > 1:
        confidence_gradient = 5
    elif confidence_second_half > confidence_first_half:
        confidence_gradient = 4
    elif confidence_first_half > 0 or confidence_second_half > 0:
        confidence_gradient = 3
    else:
        confidence_gradient = 2

    # emotional_contrast_ratio (1-5)
    if neg_words > 2 and pos_words > 2:
        emotional_contrast_ratio = 5
    elif neg_words > 0 and pos_words > 0:
        emotional_contrast_ratio = 3
    elif neg_words > 0 or pos_words > 0:
        emotional_contrast_ratio = 2
    else:
        emotional_contrast_ratio = 1

    finally_signal = count_pattern(text_lower, [
        r'\b(finally|at last|no more|never again|say goodbye|the wait is over|put an end|done with|stop|eliminate|end of)\b',
    ])

    # empathy_depth (1-5)
    emp_score = 0
    if empathy_firsthand:
        emp_score += 2
    if empathy_observed:
        emp_score += 1
    if emotion_specificity >= 3:
        emp_score += 1
    elif emotion_specificity >= 2:
        emp_score += 0.5
    if frustration_vocabulary_breadth >= 3:
        emp_score += 1.5
    elif frustration_vocabulary_breadth >= 2:
        emp_score += 1
    elif frustration_vocabulary_breadth >= 1:
        emp_score += 0.5
    # Bonus: if the transcript addresses user pain at all
    if total_prob > 0:
        emp_score += 0.5
    # Bonus: uses "you" a lot with problem framing
    if you_count > 3 and total_prob > 0:
        emp_score += 0.5
    empathy_depth = max(1, min(5, round(emp_score)))

    # === C. Product Presentation (17 dims) ===

    # feature_intro_velocity (1-5)
    feature_mentions = count_pattern(text_lower, [r'\b(feature|can also|also (supports?|includes?|has|does|offers?)|another|plus|and it|additionally|on top of|not only|you can also)\b'])
    if word_count < 100:
        feature_intro_velocity = 3
    elif feature_mentions > 0:
        words_per_feature = word_count / max(feature_mentions, 1)
        if words_per_feature > 80:
            feature_intro_velocity = 5
        elif words_per_feature > 50:
            feature_intro_velocity = 4
        elif words_per_feature > 30:
            feature_intro_velocity = 3
        elif words_per_feature > 15:
            feature_intro_velocity = 2
        else:
            feature_intro_velocity = 1
    else:
        feature_intro_velocity = 3

    # orphaned_features (0-1)
    if feature_words == 0:
        orphaned_features = 0.0
    else:
        orphaned_features = round(max(0, 1 - benefit_ratio), 2)

    demo_voice_present_tense = has_pattern(text_lower, [
        r'\b(i click|i drag|i type|i select|watch as|see how|notice how|here i|now i|let me click|let me drag|as i type|when i click)\b',
        r'\b(you\'ll see|you can see|it (shows?|displays?|generates?|creates?|pulls? up))\b',
    ])

    # concrete_vs_abstract (1-5)
    concrete_markers = count_pattern(text_lower, [
        r'\$\d',
        r'\b(click|button|page|screen|tab|field|form|row|column|cell|pixel|endpoint)\b',
        r'\b(email|file|document|image|video|photo|invoice|report|dashboard|spreadsheet|template)\b',
        r'\b(slack|notion|github|jira|stripe|zapier|google|chrome|api|sdk|webhook|url|json|csv|sql)\b',
    ])
    # Don't count generic numbers as concrete — only contextual ones
    concrete_markers += count_pattern(text_lower, [
        r'\d+\s*(users?|customers?|teams?|seconds?|minutes?|hours?|steps?|clicks?|%)\b',
        r'\$\d[\d,.]*',
    ])
    abstract_markers = count_pattern(text_lower, [
        r'\b(powerful|robust|scalable|flexible|elegant|seamless|intuitive|smart|intelligent|advanced|comprehensive|innovative|cutting-edge|state-of-the-art|next-gen|world-class|best-in-class|enterprise-grade|production-ready)\b',
        r'\b(transform|revolutionize|reimagine|disrupt|empower|unlock|optimize|enhance|supercharge|accelerate|streamline|modernize)\b',
    ])
    ca_total = concrete_markers + abstract_markers
    if ca_total == 0:
        concrete_vs_abstract = 3
    else:
        # Normalize by transcript length — longer texts naturally have more of both
        concrete_per_100 = concrete_markers / word_count * 100
        abstract_per_100 = abstract_markers / word_count * 100
        if abstract_per_100 == 0 and concrete_per_100 == 0:
            concrete_vs_abstract = 3
        elif abstract_per_100 == 0:
            concrete_vs_abstract = 5 if concrete_per_100 > 3 else 4
        elif concrete_per_100 == 0:
            concrete_vs_abstract = 1
        else:
            ratio = concrete_per_100 / (concrete_per_100 + abstract_per_100)
            if ratio > 0.85:
                concrete_vs_abstract = 5
            elif ratio > 0.70:
                concrete_vs_abstract = 4
            elif ratio > 0.45:
                concrete_vs_abstract = 3
            elif ratio > 0.25:
                concrete_vs_abstract = 2
            else:
                concrete_vs_abstract = 1

    # magic_moment_position (0-1) — where is the most impressive capability?
    wow_patterns = [r'\b(instantly|automatically|one click|real.?time|magic|boom|there it is|just like that|in seconds|that\'s it)\b']
    magic_moment_position = find_position_normalized(text_lower, wow_patterns)

    speed_claims = count_pattern(text_lower, [
        r'\b(in seconds?|instantly?|real.?time|10x|100x|\dx faster|lightning|blazing|rapid|immediate|milliseconds?)\b',
    ])

    effort_reduction_specific = has_pattern(text_lower, [
        r'(what took \d+|from \d+ (hours?|minutes?|steps?|clicks?) to \d+|\d+ (hours?|minutes?) to \d+ (minutes?|seconds?))',
        r'(\d+ steps? to \d+|reduc(e|es|ed) (from )?\d+ to \d+)',
    ])

    effort_reduction_vague = has_pattern(text_lower, [
        r'\b(saves? time|easier|simpler|streamlines?|simplif|cuts? down|reduces? effort|less work|less time|faster|quicker)\b',
    ])

    integration_count_val = count_integrations(text, product_name)

    progressive_disclosure = has_pattern(text_lower, [
        r'\b(start with|basic|simple|first|then|advanced|power user|pro tip|for more|deeper|complex|customize|configure)\b.*\b(advanced|power|pro|complex|customize|configure|deeper)\b',
    ])

    one_more_thing = 0
    if len(sents) > 5:
        last_20pct = ' '.join(sents[int(len(sents)*0.8):]).lower()
        one_more_thing = has_pattern(last_20pct, [
            r'\b(one more thing|bonus|oh and|cherry on top|did i mention|and it also|the best part|and here\'s|last but not least|but wait there\'s more)\b',
        ])

    simplicity_signals = count_pattern(text_lower, [
        r'\b(simple|easy|intuitive|no learning curve|one click|drag and drop|zero config|plug and play|no setup|no code|low code|straightforward|effortless|hassle.?free)\b',
        r'\bjust\s+(click|drag|type|paste|connect|add|select|tap|drop|enter|upload|import|install|run)\b',
    ])

    under_the_hood = has_pattern(text_lower, [
        r'\b(built on|powered by|uses? (gpt|llm|vector|embedding|transformer|neural|bert)|under the hood|behind the scenes|architecture|infrastructure|tech stack|open.?source)\b',
    ])

    # use_case_count
    use_case_patterns = [
        r'\b(for (developers?|designers?|marketers?|founders?|engineers?|PMs?|product managers?|managers?|freelancers?|creators?|writers?|agencies?|startups?|enterprises?|small business|teams?|students?|educators?|researchers?))\b',
        r'\b(whether you\'re|if you\'re a|perfect for|ideal for|great for|designed for|built for|made for)\b',
    ]
    use_cases = set()
    for p in use_case_patterns:
        for m in re.finditer(p, text_lower):
            use_cases.add(m.group(0)[:30])
    use_case_count = max(1, len(use_cases)) if use_cases else 0

    # liveness_score (1-5)
    live_signals = count_pattern(text_lower, [
        r'\b(let me|i\'ll click|watch me|here i go|right now|as you can see|let\'s see|clicking|typing|oops|hold on|bear with me)\b',
    ])
    prerecorded_signals = count_pattern(text_lower, [
        r'\[music\]', r'\[applause\]', r'\b(voice.?over|narrator|narration)\b',
    ])
    if live_signals > 3 and prerecorded_signals == 0:
        liveness_score = 5
    elif live_signals > 1:
        liveness_score = 4
    elif live_signals > 0 and prerecorded_signals == 0:
        liveness_score = 3
    elif prerecorded_signals > 0:
        liveness_score = 1
    else:
        liveness_score = 2

    onboarding_time_claim = has_pattern(text_lower, [
        r'\b(up and running in|deploy in|set up in|get started in|install in|ready in|within (minutes?|seconds?|hours?))\b',
        r'\b(\d+ (minute|second|hour) setup|quick setup|instant setup|zero setup)\b',
    ])

    comparison_moment = has_pattern(text_lower, [
        r'\b(on the left|on the right|side by side|before and after|the old way|the new way|compare|comparison|versus|vs\.?)\b',
        r'\b(here\'s how .{3,30} works?|here\'s .{3,30} without|here\'s .{3,30} with)\b',
    ])

    # === D. Wording & Rhetoric (16 dims) ===

    # verb_energy (1-5)
    punchy_verbs = count_pattern(text_lower, [
        r'\b(ship|crush|build|launch|fire|blast|smash|nail|kill|hack|slash|cut|rip|drop|push|pull|grab|snap|pop|zip|zap|boost|supercharge|ignite|unleash|power|accelerate|dominate|conquer|crack|break)\b',
    ])
    active_verbs = count_pattern(text_lower, [
        r'\b(create|connect|deploy|install|start|try|run|click|type|drag|show|send|get|set|make|find|track|save|move|use)\b',
    ])
    corporate_verbs = count_pattern(text_lower, [
        r'\b(utilize|facilitate|leverage|implement|optimize|streamline|synergize|orchestrate|operationalize|monetize|enhance|ensure|enable|provide|deliver)\b',
    ])
    passive_generic = count_pattern(text_lower, [
        r'\b(is designed|was built|has been|are provided|can be used|is available|is intended)\b',
    ])
    energy_score = punchy_verbs * 3 + active_verbs - corporate_verbs * 2 - passive_generic * 2
    words_factor = max(word_count / 100, 1)
    normalized_energy = energy_score / words_factor
    if normalized_energy > 8:
        verb_energy = 5
    elif normalized_energy > 4:
        verb_energy = 4
    elif normalized_energy > 1:
        verb_energy = 3
    elif normalized_energy > -2:
        verb_energy = 2
    else:
        verb_energy = 1

    # sentence_rhythm_variance (1-5)
    sent_lengths = [len(words(s)) for s in sents]
    if len(sent_lengths) > 2:
        mean_len = sum(sent_lengths) / len(sent_lengths)
        variance = sum((l - mean_len) ** 2 for l in sent_lengths) / len(sent_lengths)
        std_dev = math.sqrt(variance)
        cv = std_dev / max(mean_len, 1)
        if cv > 0.9:
            sentence_rhythm_variance = 5
        elif cv > 0.7:
            sentence_rhythm_variance = 4
        elif cv > 0.5:
            sentence_rhythm_variance = 3
        elif cv > 0.3:
            sentence_rhythm_variance = 2
        else:
            sentence_rhythm_variance = 1
    else:
        sentence_rhythm_variance = 1

    # power_word_cluster_density (1-5)
    power_words = count_pattern(text_lower, [
        r'\b(free|instant|proven|guaranteed|unlimited|exclusive|powerful|fast|easy|simple|secure|automatic|real-time|effortless|breakthrough|ultimate|essential|critical|massive|incredible|revolutionary)\b',
    ])
    if power_words > 10:
        power_word_cluster_density = 5
    elif power_words > 6:
        power_word_cluster_density = 4
    elif power_words > 3:
        power_word_cluster_density = 3
    elif power_words > 1:
        power_word_cluster_density = 2
    else:
        power_word_cluster_density = 1

    # jargon_distribution_shape
    tech_jargon = r'\b(api|sdk|llm|ml|ai|neural|vector|embedding|kubernetes|docker|microservice|lambda|serverless|webhook|graphql|rest|oauth|jwt|saas|paas|iaas|devops|ci/cd|cdn|dns|ssl|tcp|gpu|cpu|ram|cli|gui|orm|nosql|sql)\b'
    jargon_first = len(re.findall(tech_jargon, first_third, re.I))
    jargon_mid = len(re.findall(tech_jargon, mid_third, re.I))
    jargon_last = len(re.findall(tech_jargon, last_third, re.I))
    jargon_total = jargon_first + jargon_mid + jargon_last

    if jargon_total <= 1:
        jargon_distribution_shape = "minimal"
    elif jargon_first > jargon_mid and jargon_first > jargon_last:
        jargon_distribution_shape = "front_heavy"
    elif jargon_last > jargon_first and jargon_last > jargon_mid:
        jargon_distribution_shape = "back_heavy"
    elif jargon_mid > jargon_first and jargon_mid > jargon_last:
        jargon_distribution_shape = "middle_heavy"
    else:
        jargon_distribution_shape = "even"

    anaphora_count_val = 0
    for i in range(1, len(sents)):
        # Check if consecutive sentences start with the same word(s)
        words_prev = words(sents[i-1])
        words_curr = words(sents[i])
        if len(words_prev) >= 2 and len(words_curr) >= 2:
            if words_prev[0].lower() == words_curr[0].lower() and words_prev[1].lower() == words_curr[1].lower():
                anaphora_count_val += 1
            elif words_prev[0].lower() == words_curr[0].lower() and words_prev[0].lower() in ('no', 'you', 'we', 'every', 'stop', 'never', 'always', 'from'):
                anaphora_count_val += 1

    just_minimizer = count_pattern(text_lower, [
        r'\bjust\s+(click|drag|type|paste|connect|add|select|tap|drop|enter|upload|import|install|run|plug|sign|hit|press|copy|open|set)\b',
    ])

    # superlative_density
    superlatives = count_pattern(text_lower, [r'\b(best|most|fastest|only|first|#1|number one|top|greatest|highest|lowest|cheapest|easiest|simplest|smartest|biggest)\b'])
    superlative_density = round(superlatives / word_count * 100, 2)

    question_answer_pairs = 0
    for i in range(len(sents) - 1):
        if '?' in sents[i] and len(words(sents[i+1])) < 10:
            question_answer_pairs += 1

    # transition_sophistication (1-5)
    sophisticated_transitions = count_pattern(text_lower, [
        r'\b(here\'s where|but the (real|best) (magic|part|thing)|the beauty|what makes .{3,20} (special|different|unique)|and here\'s the (thing|kicker|best part)|let me show you|now here\'s|this is where)\b',
    ])
    basic_transitions = count_pattern(text_lower, [r'\b(and|also|so|but|then|next|now)\b'])
    if sophisticated_transitions > 3:
        transition_sophistication = 5
    elif sophisticated_transitions > 1:
        transition_sophistication = 4
    elif sophisticated_transitions > 0:
        transition_sophistication = 3
    elif basic_transitions > 5:
        transition_sophistication = 2
    else:
        transition_sophistication = 1

    negation_as_benefit = count_pattern(text_lower, [
        r'\b(no .{1,15} (needed|required)|without .{1,15}(ing|tion)|zero (setup|config|code|maintenance)|never (worry|think) about|eliminates?|no more|no need)\b',
    ])

    # specificity_index (1-5)
    specific_markers = number_count + count_pattern(text_lower, [
        r'\b\d+%\b', r'\$\d', r'\b(on|in) \d{4}\b',
    ])
    if specific_markers > 10:
        specificity_index = 5
    elif specific_markers > 6:
        specificity_index = 4
    elif specific_markers > 3:
        specificity_index = 3
    elif specific_markers > 0:
        specificity_index = 2
    else:
        specificity_index = 1

    you_insertion_rate = round(you_count / word_count * 100, 2)

    cliche_count_val = count_pattern(text_lower, [
        r'\b(game.?chang|one.?stop.?shop|seamless|frictionless|empower|unlock|leverage|reimagine|disrupt|synerg|paradigm|holistic|ecosystem|end.?to.?end|best.?in.?class|world.?class|state.?of.?the.?art|next.?gen|bleeding.?edge|deep.?dive)\b',
    ])

    conditional_density = round(count_pattern(text_lower, [r'\b(if you (need|want|have|are)|whether you|in case you|should you|whenever you)\b']) / word_count * 100, 2)

    parallel_structure = count_pattern(text, [
        r'(\w+) \w+\.\s+(\w+) \w+\.\s+(\w+) \w+\.',  # X verb. Y verb. Z verb.
    ]) + anaphora_count_val

    imperative_density = round(count_pattern(text_lower, [
        r'\b(try|check|visit|sign up|start|stop|get|go|click|download|join|subscribe|book|create|build|deploy|connect|install|run|use|head over|discover|explore)\b(?=\s)',
    ]) / word_count * 100, 2)

    # === E. Persuasion Psychology (17 dims) ===

    # word_rarity_score (1-5)
    rare_words = count_pattern(text_lower, [
        r'\b(paradigm|ephemeral|ubiquitous|agnostic|idempotent|heuristic|deterministic|asynchronous|orthogonal|composable|declarative|polymorphic|isomorphic|bespoke|meticulous|pristine|curated|nuanced|granular|provenance|immutable|canonical)\b',
    ])
    if rare_words > 4:
        word_rarity_score = 5
    elif rare_words > 2:
        word_rarity_score = 4
    elif rare_words > 0:
        word_rarity_score = 3
    elif word_diversity > 0.65:
        word_rarity_score = 2
    else:
        word_rarity_score = 1

    qualifying_retreat = count_pattern(text_lower, [
        r'\b(well,?\s*(one of|maybe|perhaps|at least|kind of|sort of))\b',
        r'\b(the best|revolutionary|the only).{0,20}(well|or at least|maybe|perhaps|kind of|or rather)\b',
    ])

    # conclusive_finality (1-5)
    if len(sents) > 0:
        last_sent = sents[-1].lower()
        if re.search(r'\b(try|sign up|get started|visit|check|download|join|start)\b', last_sent):
            conclusive_finality = 5
        elif re.search(r'\b(thank|bye|goodbye|cheers)\b', last_sent):
            conclusive_finality = 3
        elif re.search(r'\b(so yeah|that\'s (it|about it|all)|anyway|um)\b', last_sent):
            conclusive_finality = 1
        elif re.search(r'\b(future|beginning|stay tuned|coming soon|more to come)\b', last_sent):
            conclusive_finality = 4
        else:
            conclusive_finality = 2
    else:
        conclusive_finality = 1

    # social_proof_stacking_order
    proof_positions = {}
    num_proof_pos = find_first_position(text_lower, [r'\d[\d,]*\+?\s*(users|customers|companies|teams|downloads)'])
    brand_proof_pos = find_first_position(text_lower, [r'\b(trusted by|used by|loved by|chosen by)\b'])
    quote_proof_pos = find_first_position(text_lower, [r'"[^"]{10,}"'])

    if num_proof_pos >= 0:
        proof_positions['numbers_first'] = num_proof_pos
    if brand_proof_pos >= 0:
        proof_positions['brands_first'] = brand_proof_pos
    if quote_proof_pos >= 0:
        proof_positions['quotes_first'] = quote_proof_pos

    if not proof_positions:
        social_proof_stacking_order = "none"
    else:
        social_proof_stacking_order = min(proof_positions, key=proof_positions.get)

    # authority_type
    has_technical_auth = has_pattern(text_lower, [r'\b(ex-|former|google|meta|facebook|apple|amazon|microsoft|phd|stanford|mit|harvard|engineer)\b'])
    has_market_auth = 1 if success_users > 0 else 0
    has_domain_auth = has_pattern(text_lower, [r'\b(\d+ years?|decade|experience|veteran|industry|expert|specialist|professional)\b'])

    if has_technical_auth and has_market_auth:
        authority_type = "mixed"
    elif has_technical_auth:
        authority_type = "technical"
    elif has_market_auth:
        authority_type = "market"
    elif has_domain_auth:
        authority_type = "domain"
    else:
        authority_type = "none"

    reciprocity_trigger = has_pattern(text_lower, [
        r'\b(free (tier|plan|trial|version|template|tool)|open source|no credit card|free forever|free to use|try for free|completely free|100% free)\b',
    ])

    anchor_contrast_pricing = has_pattern(text_lower, [
        r'(\$\d[\d,]*.*?(?:but|we\'re|only|just)\s*\$\d[\d,]*)',
        r'(enterprise|competitor|typical|usually|normally)\s*(?:costs?|charges?|pricing)\s*.*?\$\d[\d,]*.*?(?:we|our|just|only)\s*\$',
        r'(\d+%\s*(less|cheaper|of the (cost|price)))',
    ])

    contrast_pairs = count_pattern(text_lower, [
        r'\b(instead of|not\s+\w+\s+but|unlike|while others|rather than|versus|vs\.?|compared to|traditional .{3,30} vs)\b',
    ])

    # certainty_ratio (0-1)
    certain_words = count_pattern(text_lower, [r'\b(will|always|definitely|guaranteed|proven|certainly|absolutely|clearly|undoubtedly|never|every|all)\b'])
    uncertain_words = count_pattern(text_lower, [r'\b(might|maybe|could|possibly|perhaps|probably|sometimes|often|usually|may|likely)\b'])
    cert_total = certain_words + uncertain_words
    certainty_ratio = round(certain_words / max(cert_total, 1), 2)

    in_group_language = count_pattern(text_lower, [
        r'\b(as (developers?|founders?|engineers?|builders?|creators?|designers?|marketers?) we)\b',
        r'\b(fellow (founders?|developers?|builders?|creators?))\b',
        r'\b(if you\'re like (us|me)|we\'ve all (been|experienced|felt)|you know how)\b',
    ])

    objection_preempt = count_pattern(text_lower, [
        r'\b(you might (be wondering|ask|think)|don\'t worry|and yes|no need to worry|rest assured|but what about|you\'re probably wondering|concerned about|security|privacy|compliance|enterprise.?ready|soc.?2|gdpr|hipaa)\b',
    ])

    # scarcity_type
    if has_pattern(text_lower, [r'\b(today only|this week|limited time|for a limited|ends? (today|soon|tomorrow))\b']):
        scarcity_type = "time"
    elif has_pattern(text_lower, [r'\b(limited spots?|only \d+ (spots?|seats?|places?)|running out|sold out|cap(ped)?)\b']):
        scarcity_type = "quantity"
    elif has_pattern(text_lower, [r'\b(invite only|invite-only|waitlist|exclusive access|private beta|closed beta)\b']):
        scarcity_type = "access"
    elif has_pattern(text_lower, [r'\b(only (tool|platform|solution|app)|no one else|the only)\b']):
        scarcity_type = "capability"
    else:
        scarcity_type = "none"

    # bandwagon_gradient
    bandwagon_gradient = 0
    # Check if social proof numbers escalate
    number_matches = list(re.finditer(r'(\d[\d,]*)\s*(users?|customers?|companies?|teams?|downloads?|stars?|developers?|businesses?)', text_lower))
    if len(number_matches) >= 2:
        nums = []
        for m in number_matches:
            try:
                nums.append(int(m.group(1).replace(',', '')))
            except:
                pass
        if len(nums) >= 2 and nums[-1] > nums[0]:
            bandwagon_gradient = 1

    # choice_architecture
    pricing_tiers = count_pattern(text_lower, [
        r'\b(free plan|starter|basic|pro|premium|enterprise|business|team|individual|personal|standard|professional|growth|scale)\b',
    ])
    choice_architecture = min(3, pricing_tiers)

    cognitive_ease = count_pattern(text_lower, [
        r'\b(one click|automatic|zero config|plug and play|set it and forget|instant|no setup|zero setup|auto|autopilot|hands.?free|out of the box|turnkey|preconfigured|ready.?made)\b',
    ])

    everyone_else_maneuver = count_pattern(text_lower, [
        r'\b(most teams?|most companies?|industry standard|your competitors?|leading companies?|top companies?|forward.?thinking|smart teams?|everyone else|everyone is|already using|already switched)\b',
    ])

    future_self_projection = count_pattern(text_lower, [
        r'\b(you\'ll become|imagine yourself|be the one who|your future|you\'ll never|you\'ll finally|you\'ll be|you can become|transform yourself|level up|next level)\b',
    ])

    # === F. Structure & Timing (16 dims) ===

    # info_density_shape
    info_first = len(re.findall(r'\b\w{5,}\b', first_third))
    info_mid = len(re.findall(r'\b\w{5,}\b', mid_third))
    info_last = len(re.findall(r'\b\w{5,}\b', last_third))

    if info_first > info_mid and info_first > info_last:
        info_density_shape = "front_loaded"
    elif info_last > info_first and info_last > info_mid:
        info_density_shape = "back_loaded"
    elif info_mid > info_first and info_mid > info_last:
        info_density_shape = "middle_peak"
    else:
        info_density_shape = "even"

    # breathing_room (1-5)
    if avg_sentence_length < 8:
        breathing_room = 5
    elif avg_sentence_length < 12:
        breathing_room = 4
    elif avg_sentence_length < 18:
        breathing_room = 3
    elif avg_sentence_length < 25:
        breathing_room = 2
    else:
        breathing_room = 1

    # cold_open_words: words before first product mention
    if product_name:
        first_mention = text_lower.find(product_name.lower())
        if first_mention >= 0:
            cold_open_words = len(words(text[:first_mention]))
        else:
            cold_open_words = word_count
    else:
        # Estimate: words before first feature/solution keyword
        fm = re.search(solution_keywords, text_lower)
        if fm:
            cold_open_words = len(words(text[:fm.start()]))
        else:
            cold_open_words = 0

    callback_count = count_pattern(text_lower, [
        r'\b(remember (that|what|the|when|earlier)|going back to|as (i|we) (mentioned|showed|said)|this ties back|earlier (i|we)|like (i|we) (said|mentioned|showed))\b',
    ])

    # section_length_cv (1-5) — how uneven are sections
    if sentence_rhythm_variance >= 4:
        section_length_cv = 4
    elif sentence_rhythm_variance >= 3:
        section_length_cv = 3
    elif sentence_rhythm_variance >= 2:
        section_length_cv = 2
    else:
        section_length_cv = 1
    # Adjust: if one third dominates word count heavily
    thirds_counts = [len(words(first_third)), len(words(mid_third)), len(words(last_third))]
    max_third = max(thirds_counts)
    min_third = max(min(thirds_counts), 1)
    if max_third / min_third > 3:
        section_length_cv = max(section_length_cv, 4)
    elif max_third / min_third > 2:
        section_length_cv = max(section_length_cv, 3)

    # promise_proof_push (0-3)
    has_promise = 1 if total_sol > 0 else 0
    has_proof = 1 if (success_users > 0 or has_testimonial or brand_count > 0 or has_investor_mention) else 0
    has_push = 1 if (primary_cta != "none" or closing_has_cta) else 0
    promise_proof_push = float(has_promise + has_proof + has_push)

    # first_feature_position (0-1)
    feature_pattern = r'\b(feature|can|lets you|helps you|allows you|enables you|with .{3,20} you can|supports?|includes?|provides?|offers?|comes with|built-in|integration)\b'
    first_feature_pos = find_first_position(text_lower, [feature_pattern])
    first_feature_position = first_feature_pos if first_feature_pos >= 0 else 0.5

    parenthetical_credibility = count_pattern(text_lower, [
        r'\b(by the way|incidentally|oh and|in case you\'re wondering|fun fact)\b',
        r'(\(.{5,40}\))',  # parenthetical asides
    ])

    section_boundary_markers = count_pattern(text_lower, [
        r'\b(number (one|two|three|four|five)|first(ly)?|second(ly)?|third(ly)?|next|finally|lastly|let\'s move (on|to)|the (first|second|third|next|last|final) (thing|step|feature|point))\b',
    ])

    # setup_payoff_distance (1-5)
    if relief_distance > 5:
        setup_payoff_distance = 5.0
    elif relief_distance > 3:
        setup_payoff_distance = 4.0
    elif relief_distance > 1:
        setup_payoff_distance = 3.0
    elif relief_distance > 0:
        setup_payoff_distance = 2.0
    else:
        setup_payoff_distance = 1.0

    # multi_persona_address
    persona_patterns = [
        r'\bfor (developers?|engineers?)\b', r'\bfor (designers?|creatives?)\b',
        r'\bfor (marketers?|marketing)\b', r'\bfor (founders?|CEOs?|CTOs?)\b',
        r'\bfor (PMs?|product managers?)\b', r'\bfor (teams?|organizations?)\b',
        r'\bfor (freelancers?|solopreneurs?)\b', r'\bfor (agencies?|consultants?)\b',
        r'\bfor (students?|educators?)\b', r'\bfor (sales|support)\b',
        r'\bfor (small business|enterprise|startups?)\b', r'\bfor (writers?|content)\b',
        r'\bfor (researchers?|scientists?)\b', r'\bfor (analysts?|data)\b',
    ]
    personas_found = set()
    for pp in persona_patterns:
        if re.search(pp, text_lower):
            personas_found.add(pp)
    multi_persona_address = len(personas_found)

    # voice_consistency (1-5)
    # Check how consistently the voice stays in one pronoun strategy
    we_in_first = len(re.findall(r'\b(we|our|us)\b', first_third))
    you_in_first = len(re.findall(r'\b(you|your)\b', first_third))
    we_in_last = len(re.findall(r'\b(we|our|us)\b', last_third))
    you_in_last = len(re.findall(r'\b(you|your)\b', last_third))

    first_half_strategy = "we" if we_in_first > you_in_first else ("you" if you_in_first > we_in_first else "neutral")
    second_half_strategy = "we" if we_in_last > you_in_last else ("you" if you_in_last > we_in_last else "neutral")

    if first_half_strategy == second_half_strategy:
        voice_consistency = 5
    elif first_half_strategy == "neutral" or second_half_strategy == "neutral":
        voice_consistency = 3
    else:
        voice_consistency = 2
    if speaker_changes > 2:
        voice_consistency = max(1, voice_consistency - 1)

    counterfactual_count = count_pattern(text_lower, [
        r'\b(what if|what would|imagine (not|if)|without (this|our|it)|if you didn\'t|you\'d still be|otherwise you)\b',
    ])

    # closing_velocity (1-5)
    if len(sents) >= 3:
        last_3_avg_len = sum(len(words(s)) for s in sents[-3:]) / 3
        overall_avg = avg_sentence_length
        if last_3_avg_len < overall_avg * 0.6:
            closing_velocity = 5
        elif last_3_avg_len < overall_avg * 0.8:
            closing_velocity = 4
        elif last_3_avg_len < overall_avg * 1.2:
            closing_velocity = 3
        elif last_3_avg_len < overall_avg * 1.5:
            closing_velocity = 2
        else:
            closing_velocity = 1
    else:
        closing_velocity = 3

    open_loop_closing = has_pattern(last_sents, [
        r'\b(just the beginning|much more to come|stay tuned|wait until|v2|coming soon|more features?|roadmap|what\'s next|in the future|we\'re working on|exciting things|watch this space)\b',
    ])

    definitive_closing = has_pattern(last_sents, [
        r'\b(try it|get started|sign up|check it out|visit|download|head over|start now|join today|available now|go to)\b',
        r'(\.com|\.io|\.ai|\.dev|\.app)',
    ])

    # ── Build result ──────────────────────────────────────────────────────

    result = {
        "id": str(tid),
        # V1 Opening
        "hook_type": hook_type,
        "first_person_opener": first_person_opener,
        "has_negative_opener": has_negative_opener,
        "first_sentence_words": first_sentence_words,
        "hook_quality": hook_quality,
        # V1 Length & Readability
        "word_count": word_count,
        "sentence_count": sent_count,
        "avg_sentence_length": avg_sentence_length,
        "flesch_kincaid_grade": fk_grade,
        "word_diversity": word_diversity,
        "syllable_density": syl_density,
        # V1 Pronouns & Voice
        "pronoun_strategy": pronoun_strategy,
        "we_count": we_count,
        "you_count": you_count,
        "hedge_count": hedge_count,
        "filler_count": filler_count,
        # V1 Narrative Arc
        "narrative_arc": narrative_arc,
        "topic_transitions": topic_transitions,
        "problem_pct": problem_pct,
        "solution_pct": solution_pct,
        "declining_arc": declining_arc,
        # V1 Metrics & Traction
        "number_count": number_count,
        "number_density": number_density,
        "metric_placement": metric_placement,
        "before_after_total": before_after_total,
        "success_users": success_users,
        "success_revenue": success_revenue,
        "success_cost_savings": success_cost_savings,
        "success_growth": success_growth,
        # V1 Social Proof
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
        # V1 Category & Positioning
        "category_creation_total": category_creation_total,
        "ai_count": ai_count,
        "ai_density": ai_density,
        "buzzword_count": buzzword_count,
        # V1 CTA & Closing
        "primary_cta": primary_cta,
        "cta_position": cta_position,
        "has_discount": has_discount,
        "has_scarcity": has_scarcity,
        "has_pricing": has_pricing,
        "has_url": has_url,
        "closing_has_cta": closing_has_cta,
        "closing_has_thanks": closing_has_thanks,
        # V1 Content Signals
        "storytelling": storytelling,
        "humor": humor,
        "demo_instructions": demo_instructions,
        "screen_narration": screen_narration,
        "data_viz_cues": data_viz_cues,
        "energy_markers": energy_markers,
        "feature_list_markers": feature_list_markers,
        "production_markers": production_markers,
        "speaker_changes": speaker_changes,
        "action_verb_count": action_verbs,
        "feature_words": feature_words,
        "benefit_words": benefit_words,
        "benefit_ratio": benefit_ratio,
        "question_count": question_count,
        "passive_voice_count": passive_voice_count,
        # V1 Sentiment
        "sentiment": sentiment,
        "confidence_count": confidence_count,
        "product_name_repeats": product_name_repeats,
        # V2 A. Story Architecture
        "inciting_incident": inciting_incident,
        "villain_named": villain_named,
        "villain_count": villain_count_val,
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
        # V2 B. Emotional Mechanics
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
        # V2 C. Product Presentation
        "feature_intro_velocity": feature_intro_velocity,
        "orphaned_features": orphaned_features,
        "demo_voice_present_tense": demo_voice_present_tense,
        "concrete_vs_abstract": concrete_vs_abstract,
        "magic_moment_position": magic_moment_position,
        "speed_claims": speed_claims,
        "effort_reduction_specific": effort_reduction_specific,
        "effort_reduction_vague": effort_reduction_vague,
        "integration_count": integration_count_val,
        "progressive_disclosure": progressive_disclosure,
        "one_more_thing": one_more_thing,
        "simplicity_signals": simplicity_signals,
        "under_the_hood": under_the_hood,
        "use_case_count": use_case_count,
        "liveness_score": liveness_score,
        "onboarding_time_claim": onboarding_time_claim,
        "comparison_moment": comparison_moment,
        # V2 D. Wording & Rhetoric
        "verb_energy": verb_energy,
        "sentence_rhythm_variance": sentence_rhythm_variance,
        "power_word_cluster_density": power_word_cluster_density,
        "jargon_distribution_shape": jargon_distribution_shape,
        "anaphora_count": anaphora_count_val,
        "just_minimizer": just_minimizer,
        "superlative_density": superlative_density,
        "question_answer_pairs": question_answer_pairs,
        "transition_sophistication": transition_sophistication,
        "negation_as_benefit": negation_as_benefit,
        "specificity_index": specificity_index,
        "you_insertion_rate": you_insertion_rate,
        "cliche_count": cliche_count_val,
        "conditional_density": conditional_density,
        "parallel_structure": parallel_structure,
        "imperative_density": imperative_density,
        # V2 E. Persuasion Psychology
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
        # V2 F. Structure & Timing
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

    return result


def main():
    with open('/Users/maxguillabert/Downloads/index/launch-video-analysis/ph/v2-llm-parts/input_batch_00.json') as f:
        data = json.load(f)

    results = []
    for item in data:
        result = extract_all(item)
        results.append(result)

    with open('/Users/maxguillabert/Downloads/index/launch-video-analysis/ph/v2-llm-parts/output_batch_00.json', 'w') as f:
        json.dump(results, f, indent=2)

    print(f"Processed {len(results)} transcripts")
    print(f"Dimensions per transcript: {len(results[0]) - 1}")  # -1 for id

    # Validate all dimensions present
    expected_dims = 200
    actual_dims = len(results[0]) - 1
    print(f"Expected: {expected_dims}, Actual: {actual_dims}")

    # Print keys for verification
    keys = [k for k in results[0].keys() if k != 'id']
    print(f"\nAll dimension keys ({len(keys)}):")
    for i, k in enumerate(keys):
        print(f"  {i+1}. {k}")


if __name__ == '__main__':
    main()
