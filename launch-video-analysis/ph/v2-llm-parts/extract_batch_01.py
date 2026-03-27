#!/usr/bin/env python3
"""
Extract 200 dimensions from Product Hunt launch video transcripts.
Semantic analysis + NLP heuristics for each dimension.
"""

import json
import re
import math
from collections import Counter

# ─── Helpers ───

def sentences(text):
    """Split text into sentences."""
    # Remove production markers for sentence analysis
    clean = re.sub(r'\[.*?\]', '', text)
    clean = re.sub(r'\s+', ' ', clean).strip()
    # Split on sentence-ending punctuation
    sents = re.split(r'(?<=[.!?])\s+', clean)
    return [s.strip() for s in sents if s.strip() and len(s.strip()) > 2]

def words(text):
    """Extract words from text."""
    clean = re.sub(r'\[.*?\]', '', text)
    return re.findall(r"[a-zA-Z']+", clean.lower())

def syllable_count(word):
    """Estimate syllable count."""
    word = word.lower()
    if len(word) <= 3:
        return 1
    count = len(re.findall(r'[aeiouy]+', word))
    if word.endswith('e') and not word.endswith('le'):
        count -= 1
    return max(1, count)

def flesch_kincaid(total_words, total_sentences, total_syllables):
    if total_sentences == 0 or total_words == 0:
        return 0.0
    return 0.39 * (total_words / total_sentences) + 11.8 * (total_syllables / total_words) - 15.59

def position_in_text(text, pattern, flags=re.IGNORECASE):
    """Return position 0-1 of first match, or -1."""
    m = re.search(pattern, text, flags)
    if not m:
        return -1.0
    return m.start() / max(len(text), 1)

def count_pattern(text, pattern, flags=re.IGNORECASE):
    return len(re.findall(pattern, text, flags))

def has_pattern(text, pattern, flags=re.IGNORECASE):
    return 1 if re.search(pattern, text, flags) else 0

def relative_position(text, pattern, flags=re.IGNORECASE):
    """Return 'front', 'middle', 'back', or 'none'."""
    m = re.search(pattern, text, flags)
    if not m:
        return "none"
    pos = m.start() / max(len(text), 1)
    if pos < 0.33:
        return "front"
    elif pos < 0.66:
        return "middle"
    else:
        return "back"

def clamp(val, lo, hi):
    return max(lo, min(hi, val))

# ─── Brand/product detection ───

KNOWN_BRANDS = {
    'google', 'apple', 'microsoft', 'amazon', 'meta', 'facebook', 'slack', 'notion',
    'figma', 'github', 'gitlab', 'jira', 'asana', 'trello', 'zapier', 'stripe',
    'shopify', 'salesforce', 'hubspot', 'airtable', 'monday', 'discord', 'twitter',
    'linkedin', 'youtube', 'instagram', 'tiktok', 'pinterest', 'reddit', 'openai',
    'chatgpt', 'gpt', 'claude', 'anthropic', 'vercel', 'netlify', 'aws', 'azure',
    'heroku', 'docker', 'kubernetes', 'postgres', 'mongodb', 'firebase', 'supabase',
    'twilio', 'sendgrid', 'mailchimp', 'intercom', 'zendesk', 'canva', 'adobe',
    'photoshop', 'illustrator', 'wordpress', 'webflow', 'framer', 'linear', 'loom',
    'zoom', 'teams', 'dropbox', 'confluence', 'datadog', 'sentry', 'mixpanel',
    'segment', 'amplitude', 'postman', 'insomnia', 'vscode', 'chrome', 'safari',
    'firefox', 'copilot', 'midjourney', 'dall-e', 'stable diffusion', 'excel',
    'powerpoint', 'gmail', 'outlook', 'calendly', 'typeform', 'survey monkey',
    'grammarly', 'notion', 'obsidian', 'roam', 'bear', 'evernote', 'todoist',
    'clickup', 'basecamp', 'freshdesk', 'pipedrive', 'zoho', 'wix', 'squarespace',
    'bubble', 'retool', 'appsmith', 'n8n', 'make', 'ifttt', 'raycast', 'arc',
    'spotify', 'netflix', 'uber', 'airbnb', 'coinbase', 'robinhood', 'plaid',
    'twitch', 'snapchat', 'whatsapp', 'telegram', 'signal', 'paypal', 'venmo',
    'wise', 'revolut', 'tableau', 'looker', 'snowflake', 'databricks', 'dbt',
    'terraform', 'ansible', 'jenkins', 'circleci', 'railway', 'render', 'fly.io',
    'planetscale', 'neon', 'upstash', 'redis', 'elasticsearch', 'algolia',
    'cloudflare', 'fastly', 'akamai', 'twilio', 'auth0', 'okta', 'clerk',
    'posthog', 'hotjar', 'heap', 'fullstory', 'logrocket', 'pendo', 'gainsight',
    'productboard', 'coda', 'pitch', 'miro', 'figjam', 'whimsical', 'lucidchart'
}

BUZZWORDS = {
    'revolutionary', 'game-changing', 'game changer', 'cutting-edge', 'cutting edge',
    'next-generation', 'next generation', 'next gen', 'disruptive', 'paradigm',
    'synergy', 'ecosystem', 'holistic', 'robust', 'scalable', 'enterprise-grade',
    'world-class', 'best-in-class', 'state-of-the-art', 'bleeding edge',
    'transformative', 'groundbreaking', 'innovative', 'unprecedented'
}

CLICHES = {
    'game-changer', 'game changer', 'one-stop shop', 'one stop shop', 'seamless',
    'frictionless', 'empower', 'empowers', 'empowering', 'unlock', 'unlocks',
    'unlocking', 'leverage', 'leverages', 'leveraging', 'reimagine', 'reimagines',
    'reimagining', 'disrupt', 'disrupts', 'disrupting', 'synergy', 'synergies',
    'ecosystem', 'paradigm shift', 'move the needle', 'low-hanging fruit',
    'deep dive', 'circle back', 'touch base', 'pivot', 'north star'
}

HEDGE_WORDS = {'maybe', 'perhaps', 'might', 'kind of', 'sort of', 'arguably', 'possibly', 'potentially', 'somewhat'}
FILLER_WORDS = {'um', 'uh', 'like', 'basically', 'actually', 'literally', 'so yeah', 'you know', 'i mean', 'right'}
CONFIDENCE_WORDS = {'will', 'definitely', 'guaranteed', 'proven', 'certainly', 'absolutely', 'undoubtedly', 'without doubt'}
SIMPLICITY_WORDS = ['simple', 'easy', 'intuitive', 'no learning curve', 'one click', 'one-click', 'drag and drop', 'drag-and-drop', 'straightforward', 'effortless', 'hassle-free', 'hassle free']
COGNITIVE_EASE = ['one click', 'one-click', 'automatic', 'automatically', 'zero config', 'zero configuration', 'plug and play', 'plug-and-play', 'set it and forget it', 'instant', 'instantly', 'no setup', 'no code', 'no-code', 'out of the box']
FINALLY_SIGNALS = ['finally', 'at last', 'no more', 'never again', 'say goodbye to', 'the wait is over', 'put an end to', 'stop wasting', 'done with', 'forget about']
SPEED_CLAIMS = ['in seconds', 'instantly', 'real-time', 'real time', 'realtime', 'lightning fast', 'lightning-fast', 'blazing fast', 'blazing-fast', 'in minutes', '10x faster', '100x faster', '5x faster', '2x faster', '3x faster', 'in a flash', 'immediate', 'immediately']

ACTION_VERBS = {
    'build', 'ship', 'launch', 'create', 'deploy', 'automate', 'generate', 'analyze',
    'track', 'monitor', 'manage', 'optimize', 'scale', 'integrate', 'connect',
    'transform', 'convert', 'export', 'import', 'sync', 'share', 'collaborate',
    'design', 'customize', 'configure', 'install', 'run', 'execute', 'test',
    'measure', 'discover', 'explore', 'search', 'filter', 'sort', 'organize',
    'plan', 'schedule', 'assign', 'notify', 'alert', 'publish', 'distribute',
    'collect', 'gather', 'aggregate', 'visualize', 'report', 'predict', 'recommend',
    'personalize', 'segment', 'target', 'engage', 'retain', 'acquire', 'boost',
    'accelerate', 'streamline', 'simplify', 'eliminate', 'reduce', 'cut', 'crush',
    'dominate', 'win', 'capture', 'unlock', 'enable', 'power', 'fuel', 'drive'
}

FEATURE_WORDS = {
    'feature', 'features', 'functionality', 'capability', 'capabilities', 'module',
    'tool', 'tools', 'dashboard', 'panel', 'interface', 'api', 'endpoint', 'widget',
    'plugin', 'extension', 'integration', 'template', 'workflow', 'automation',
    'algorithm', 'engine', 'system', 'platform', 'framework', 'library', 'sdk',
    'component', 'setting', 'option', 'mode', 'view', 'filter', 'search',
    'notification', 'alert', 'report', 'analytics', 'chart', 'graph'
}

BENEFIT_WORDS = {
    'save', 'saves', 'saving', 'faster', 'quicker', 'easier', 'simpler', 'better',
    'improve', 'improves', 'improvement', 'increase', 'increases', 'boost', 'boosts',
    'reduce', 'reduces', 'reduction', 'eliminate', 'eliminates', 'grow', 'grows',
    'growth', 'revenue', 'profit', 'productivity', 'efficiency', 'performance',
    'quality', 'accuracy', 'reliable', 'reliable', 'secure', 'security', 'peace of mind',
    'confidence', 'clarity', 'insight', 'insights', 'freedom', 'flexibility',
    'control', 'focus', 'time', 'money', 'cost', 'effort', 'stress', 'risk',
    'error', 'mistake', 'hassle', 'friction', 'bottleneck', 'pain', 'struggle'
}

# ─── Main extraction ───

def extract_dimensions(item):
    """Extract all 200 dimensions from a single transcript."""
    tid = item['id']
    name = item.get('name', '')
    transcript = item.get('transcript', '')
    text = transcript
    text_lower = text.lower()

    sents = sentences(text)
    wds = words(text)
    word_count = len(wds)
    sentence_count = len(sents)

    if word_count == 0:
        word_count = 1  # avoid division by zero
    if sentence_count == 0:
        sentence_count = 1

    # Word frequency
    word_freq = Counter(wds)
    unique_words = len(set(wds))

    # Total syllables
    total_syllables = sum(syllable_count(w) for w in wds)

    # ─── V1: OPENING ───
    first_sent = sents[0] if sents else ""
    first_sent_lower = first_sent.lower().strip()
    first_sent_words = len(first_sent.split())

    # hook_type classification
    def classify_hook():
        fs = first_sent_lower
        if re.search(r'^(hi|hey|hello|welcome|good morning|good afternoon|what\'?s up)', fs):
            return "greeting"
        if '?' in first_sent:
            return "question"
        if re.search(r'\b(i was|i used to|i remember|my story|when i|i grew up|i started|years ago.*i)\b', fs):
            return "founder_story"
        if re.search(r'\b(annoying|frustrated|broken|tired|hate|sick of|problem|pain|struggle|difficult)\b', fs):
            return "pain_point"
        if re.search(r'\b(introducing|announcing|launching|excited to|proud to|today we)\b', fs):
            return "announcement"
        if re.search(r'\b(let me show|click|watch|demo|i\'ll walk|let\'s take a look)\b', fs):
            return "demo_instruction"
        if re.search(r'\b(the (best|only|first|fastest|most)|never before|nobody|no one has)\b', fs):
            return "bold_claim"
        if re.search(r'\b\d+[%xX]?\b', fs) or re.search(r'\$\d+', fs):
            return "stat_number"
        if re.search(r'\b(is a|is the|is an|that|which)\b', fs) and len(fs.split()) < 20:
            return "product_statement"
        return "descriptive"

    hook_type = classify_hook()

    first_person_opener = 1 if re.match(r'\s*(i |i\'|we |we\')', first_sent_lower) else 0
    has_negative_opener = 1 if re.search(r'\b(broken|tired|hate|frustrated|problem|annoying|sick|struggle|difficult|pain|nightmare|terrible|horrible|worst)\b', first_sent_lower) else 0

    # hook_quality (1-5)
    hq = 3
    if hook_type in ('pain_point', 'bold_claim', 'stat_number', 'question', 'founder_story'):
        hq += 1
    if has_negative_opener:
        hq += 0.5
    if first_sent_words < 5 and hook_type == 'greeting':
        hq -= 1
    if first_sent_words > 8 and first_sent_words < 25:
        hq += 0.5
    if re.search(r'\b(imagine|what if|picture this)\b', first_sent_lower):
        hq += 1
    # Check for production markers dominating the opening
    if re.search(r'^\[', first_sent.strip()):
        hq -= 1
    hook_quality = clamp(round(hq), 1, 5)

    # ─── V1: LENGTH & READABILITY ───
    avg_sentence_length = round(word_count / sentence_count, 1)
    fk_grade = round(flesch_kincaid(word_count, sentence_count, total_syllables), 1)
    word_diversity = round(unique_words / word_count, 3) if word_count > 0 else 0.0
    syl_density = round(total_syllables / word_count, 2) if word_count > 0 else 0.0

    # ─── V1: PRONOUNS & VOICE ───
    we_count = count_pattern(text, r'\b(we|our|us)\b')
    you_count = count_pattern(text, r'\b(you|your|you\'re|you\'ll|you\'ve|yours)\b')

    if we_count > you_count * 1.5:
        pronoun_strategy = "mostly_we"
    elif you_count > we_count * 1.5:
        pronoun_strategy = "mostly_you"
    elif we_count + you_count < 3:
        pronoun_strategy = "neutral"
    else:
        pronoun_strategy = "balanced"

    hedge_count = 0
    for hw in HEDGE_WORDS:
        hedge_count += len(re.findall(r'\b' + re.escape(hw) + r'\b', text_lower))

    filler_count = 0
    for fw in FILLER_WORDS:
        filler_count += len(re.findall(r'\b' + re.escape(fw) + r'\b', text_lower))

    # ─── V1: NARRATIVE ARC ───
    problem_patterns = r'\b(problem|issue|challenge|struggle|pain|broken|frustrated|annoying|difficult|hard to|waste|losing|tired of|sick of|hate|nightmare|complex|complicated|manual|tedious|slow|expensive|costly|inefficient|error|mistake|fail|failure|mess|chaos|overwhelming|confusing|scatter|fragmented|disconnect|gap)\b'
    solution_patterns = r'\b(solution|solve|fix|help|easy|simple|fast|quick|automate|automatic|streamline|efficient|powerful|smart|intelligent|seamless|instant|magic|beautiful|elegant|intuitive|designed|built|created|introducing|meet|presenting|welcome)\b'

    # Estimate problem vs solution percentages
    prob_matches = count_pattern(text, problem_patterns)
    sol_matches = count_pattern(text, solution_patterns)
    total_sig = prob_matches + sol_matches
    if total_sig == 0:
        problem_pct = 20.0
        solution_pct = 30.0
    else:
        problem_pct = round(prob_matches / total_sig * 60, 1)  # Scale to rough percentage
        solution_pct = round(sol_matches / total_sig * 60, 1)

    # Determine narrative arc
    first_third = text_lower[:len(text_lower)//3]
    last_third = text_lower[2*len(text_lower)//3:]
    prob_early = len(re.findall(problem_patterns, first_third))
    sol_early = len(re.findall(solution_patterns, first_third))
    prob_late = len(re.findall(problem_patterns, last_third))
    sol_late = len(re.findall(solution_patterns, last_third))

    if word_count < 30:
        narrative_arc = "too_short"
    elif prob_early > sol_early and sol_late > prob_late:
        narrative_arc = "problem_solution"
    elif sol_early > prob_early * 2:
        narrative_arc = "solution_first"
    elif prob_early > sol_early * 3:
        narrative_arc = "problem_heavy"
    elif re.search(r'\b(users|customers|companies|teams|downloads|revenue|arr|mrr)\b', first_third) and prob_early < 3:
        narrative_arc = "traction_first"
    else:
        narrative_arc = "neutral_flat"

    # Topic transitions
    transition_markers = count_pattern(text, r'\b(but|however|now|next|also|another|moving on|let\'s talk|speaking of|in addition|furthermore|on top of that|besides|meanwhile|shifting|turning to)\b')
    topic_transitions = clamp(transition_markers // 2, 0, 20)

    declining_arc = 1 if (re.search(r'\b(hurry|limited|don\'t miss|before it\'s|running out|last chance|act now|time is)\b', last_third)) else 0

    # ─── V1: METRICS & TRACTION ───
    numbers = re.findall(r'\b\d[\d,.]*\b', text)
    number_count = len(numbers)
    number_density = round(number_count / word_count * 100, 2) if word_count > 0 else 0.0

    # Metric placement
    num_first = len(re.findall(r'\b\d[\d,.]*\b', first_third))
    num_last = len(re.findall(r'\b\d[\d,.]*\b', last_third))
    if number_count == 0:
        metric_placement = "none"
    elif num_first > num_last:
        metric_placement = "front"
    elif num_last > num_first:
        metric_placement = "back"
    else:
        metric_placement = "middle"

    before_after_total = count_pattern(text, r'\b(before|after|used to|now we|went from|previously|compared to|instead of)\b')
    success_users = count_pattern(text, r'\b(\d[\d,.]* (users|customers|teams|companies|people|businesses|organizations|clients|subscribers|members))\b')
    success_revenue = count_pattern(text, r'\b(revenue|ARR|MRR|\$\d[\d,.]*[MmKkBb]?)\b')
    success_cost_savings = count_pattern(text, r'\b(sav(e|es|ed|ing) \$|cost (reduction|saving)|cut costs?|reduc(e|ed|ing) costs?)\b')
    success_growth = count_pattern(text, r'\b(\d+[%xX] (growth|increase|more|faster|better|improvement)|grew|doubled|tripled|10x|100x)\b')

    # ─── V1: SOCIAL PROOF ───
    found_brands = set()
    for brand in KNOWN_BRANDS:
        if re.search(r'\b' + re.escape(brand) + r'\b', text_lower):
            found_brands.add(brand)
    brand_count = len(found_brands)

    has_investor_mention = has_pattern(text, r'\b(investor|funded|funding|raised|backing|backed by|series [a-z]|seed round|vc|venture capital|yc|y combinator|techstars|500 startups)\b')
    has_testimonial = has_pattern(text, r'(said|says|told us|according to|quote|\".*\".*said|\btestimoni)')
    trusted_by = has_pattern(text, r'\b(trusted by|used by|loved by|chosen by|preferred by)\b')
    has_partnership = has_pattern(text, r'\b(partner|partnership|partnered|teamed up|collaboration|collaborated|working with)\b')
    has_credential = has_pattern(text, r'\b(ex-|former|phd|doctorate|professor|stanford|mit|harvard|yale|princeton|berkeley|oxford|cambridge|google|facebook|meta|apple|amazon|microsoft|mckinsey|goldman|bain|bcg|deloitte)\b')

    social_proof_claims = has_investor_mention + has_testimonial + trusted_by + has_partnership + has_credential + min(brand_count, 3) + min(success_users, 2)
    platform_mentions = brand_count  # platforms ~ brands
    competitive_total = count_pattern(text, r'\b(unlike|compared to|better than|faster than|cheaper than|instead of using|replace|competitor|competition|alternative to|vs\.?|versus)\b')
    replacement_total = count_pattern(text, r'\b(replace|replacing|replaces|ditch|switch from|stop using|forget|say goodbye to|no more)\b')

    # ─── V1: CATEGORY & POSITIONING ───
    category_creation_total = count_pattern(text, r'\b(the first|the only|a new kind|we invented|never been done|first ever|one of a kind|pioneering|category|redefin)\b')
    ai_count = count_pattern(text, r'\b(ai|a\.i\.|artificial intelligence|machine learning|ml|deep learning|neural|gpt|llm|large language model|generative|copilot)\b')
    ai_density = round(ai_count / word_count * 100, 2) if word_count > 0 else 0.0
    buzzword_count = sum(1 for bw in BUZZWORDS if bw in text_lower)

    # ─── V1: CTA & CLOSING ───
    last_sents = sents[-3:] if len(sents) >= 3 else sents
    last_text = ' '.join(last_sents).lower()

    cta_patterns = {
        'waitlist': r'\b(waitlist|wait list|waiting list)\b',
        'join': r'\b(join|join us|join today)\b',
        'sign_up': r'\b(sign up|signup|register)\b',
        'try': r'\b(try|try it|give it a try|test it)\b',
        'get_started': r'\b(get started|start now|start today|start using|start building)\b',
        'book_demo': r'\b(book a demo|schedule a demo|request a demo|demo)\b',
        'free': r'\b(free|for free|free trial|free tier|free plan|free forever)\b',
        'beta': r'\b(beta|early access|preview)\b',
        'limited': r'\b(limited|exclusive|invite only|invite-only)\b',
    }

    primary_cta = "none"
    for cta_name, cta_pat in cta_patterns.items():
        if re.search(cta_pat, text_lower):
            primary_cta = cta_name
            break

    # CTA position
    cta_general = r'\b(try|sign up|join|get started|book|download|subscribe|start|check out|visit|go to|head to|click)\b'
    cta_position = relative_position(text, cta_general)
    if cta_position == "none" and primary_cta != "none":
        cta_position = "end"

    has_discount = has_pattern(text, r'\b(discount|deal|offer|coupon|promo|promotion|sale|off|% off|save \$)\b')
    has_scarcity = has_pattern(text, r'\b(limited|exclusive|only \d+|spots left|running out|last chance|while (supplies|it) last|invite only)\b')
    has_pricing = has_pattern(text, r'\b(pricing|price|plan|tier|\$\d|per month|per year|monthly|annually|subscription|free plan|starter|pro plan|enterprise)\b')
    has_url = has_pattern(text, r'\b(\.com|\.io|\.co|\.app|\.ai|\.dev|\.org|www\.|http|visit us at|check out|go to)\b')
    closing_has_cta = has_pattern(last_text, cta_general)
    closing_has_thanks = has_pattern(last_text, r'\b(thanks|thank you|bye|goodbye|cheers|appreciate|see you)\b')

    # ─── V1: CONTENT SIGNALS ───
    storytelling = has_pattern(text, r'\b(one day|once upon|story|remember when|back in|years ago|there was a time|i recall|it all started|the moment)\b')
    humor = has_pattern(text, r'\b(haha|lol|joke|funny|laugh|kidding|just kidding|nah|nope|spoiler|plot twist)\b')
    demo_instructions = count_pattern(text, r'\b(click here|let me show|watch this|i\'ll demo|i\'ll walk you|let me walk|check this out|here\'s how|let me demonstrate)\b')
    screen_narration = count_pattern(text, r'\b(here you (can )?see|on the (left|right|top|bottom|screen)|as you can see|right here|over here|this area|this section|this panel|this tab|this button)\b')
    data_viz_cues = count_pattern(text, r'\b(chart|graph|dashboard|visualization|visualize|data|metric|analytics|report|table|plot)\b')
    energy_markers = len(re.findall(r'!', text)) + count_pattern(text, r'\b(amazing|awesome|incredible|wow|fantastic|love|exciting|cool|great)\b')
    feature_list_markers = count_pattern(text, r'\b(first|second|third|fourth|also|another|next|finally|additionally|furthermore|on top of that|plus|and then)\b')
    production_markers = len(re.findall(r'\[.*?\]', text))

    # Speaker changes
    speaker_changes = len(re.findall(r'(>>|SPEAKER|Speaker \d|:\s)', text))

    action_verb_count = sum(1 for w in wds if w in ACTION_VERBS)
    feature_word_count = sum(1 for w in wds if w in FEATURE_WORDS)
    benefit_word_count = sum(1 for w in wds if w in BENEFIT_WORDS)
    benefit_ratio = round(benefit_word_count / max(benefit_word_count + feature_word_count, 1), 2)
    question_count = text.count('?')

    # Passive voice estimation
    passive_voice_count = count_pattern(text, r'\b(is|are|was|were|been|being|be) (being )?\w+ed\b')

    # ─── V1: SENTIMENT ───
    pos_words = count_pattern(text, r'\b(great|good|best|love|amazing|awesome|fantastic|wonderful|excellent|beautiful|perfect|powerful|fast|easy|simple|elegant|brilliant|impressive|incredible|outstanding|remarkable|exceptional|superior|delightful)\b')
    neg_words = count_pattern(text, r'\b(bad|worst|hate|terrible|horrible|awful|broken|pain|frustrat|annoying|difficult|hard|slow|expensive|costly|waste|struggle|nightmare|mess|chaos|confus|complex|complicat|tedious|boring|ugly|clunky)\b')

    if pos_words > neg_words * 2:
        sentiment = "positive"
    elif neg_words > pos_words * 2:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    confidence_count = 0
    for cw in CONFIDENCE_WORDS:
        confidence_count += count_pattern(text, r'\b' + re.escape(cw) + r'\b')

    # Product name repeats
    product_name = name.lower().split()[0] if name else ""
    product_name_repeats = 0
    if product_name and len(product_name) > 2:
        product_name_repeats = count_pattern(text, r'\b' + re.escape(product_name) + r'\b')

    # ─── V2: STORY ARCHITECTURE ───
    inciting_incident = has_pattern(text, r'(one day|last (week|month|year|tuesday|monday)|i was (sitting|working|trying|looking)|when i (realized|noticed|discovered|found|saw)|it hit me|the moment|that\'s when|i remember|the day|woke up|3 am|2 am|a[tm] \d|suddenly|it all started when|\$\d[\d,.]+ (bill|invoice|cost))')
    villain_named = has_pattern(text, r'\b(spreadsheet|excel|email|slack|manual|copy.?paste|meetings|jira|powerpoint|legacy|old.?way|traditional|status quo|current tools?|existing solutions?|other (tools|platforms|solutions)|competitors?)\b')

    villain_count = 0
    villain_list = ['spreadsheet', 'excel', 'email', 'slack', 'manual process', 'copy paste', 'meetings', 'jira',
                    'powerpoint', 'legacy', 'old way', 'traditional', 'complexity', 'information overload',
                    'technical debt', 'silos', 'fragmentation', 'bureaucracy']
    for v in villain_list:
        if re.search(r'\b' + re.escape(v) + r'\b', text_lower):
            villain_count += 1
    # Also count named competitors
    comp_mentions = count_pattern(text, r'\b(unlike \w+|compared to \w+|better than \w+|instead of \w+)\b')
    villain_count += min(comp_mentions, 3)

    stakes_escalation = 0
    if prob_early > 0 and prob_late > 0:
        # Check if later problem descriptions are more severe
        severe_late = count_pattern(last_third, r'\b(lose|losing|cost|costing|waste|wasting|burn|burning|miss|missing|risk|failure|fails|bankrupt|shutdown)\b')
        mild_early = count_pattern(first_third, r'\b(annoying|tedious|slow|manual|difficult|hard)\b')
        if severe_late > 0 and mild_early > 0:
            stakes_escalation = 1
    # Also check for escalation patterns
    if re.search(r'(not just|worse|even more|and that|which means|which leads|the result|the consequence|on top of that|and then)', text_lower):
        if prob_matches > 2:
            stakes_escalation = 1

    transformation_promise = has_pattern(text, r'\b(go from .* to|become|transform|never again|turn you into|stop being|start being|from .* to .*|reimagine yourself|change how you|change the way)\b')

    # transformation_position
    tp_match = re.search(r'\b(go from .* to|become|transform|never again|turn you into|from .* to)', text_lower)
    transformation_position = round(tp_match.start() / max(len(text_lower), 1), 2) if tp_match else -1.0

    # pivot_sharpness
    pivot_patterns = [r'\b(so we built|introducing|meet|that\'s why|enter|here comes|the answer|the solution)\b',
                      r'\b(but now|but what if|but imagine|until now)\b']
    pivot_count = sum(count_pattern(text, p) for p in pivot_patterns)
    if pivot_count >= 2:
        pivot_sharpness = 4
    elif pivot_count == 1:
        pivot_sharpness = 3
    elif narrative_arc == "problem_solution":
        pivot_sharpness = 3
    elif narrative_arc == "solution_first":
        pivot_sharpness = 2
    else:
        pivot_sharpness = 2
    # Check for very sharp pivots
    if re.search(r'(\.|\?|!)\s*(So we built|Introducing|Meet|Enter|That\'s why we)', text):
        pivot_sharpness = min(5, pivot_sharpness + 1)

    nested_stories = has_pattern(text, r'\b(one of our (users|customers|clients|teams)|a (customer|user|client|team) (told|said|shared|reported)|case study|for example,? (one|a)|real.?world example|let me tell you about|take \w+ for instance)\b')
    temporal_anchors = count_pattern(text, r'\b(\d+ (years?|months?|weeks?|days?|hours?|minutes?|seconds?) (ago|later|before|after)|last (year|month|week|quarter|tuesday|monday)|in \d+ (seconds?|minutes?|hours?)|within (minutes?|hours?|seconds?)|since \d{4}|\d{4})\b')
    imagine_device = count_pattern(text, r'\b(imagine|picture this|what if you could|think about|envision|what would it look like|wouldn\'t it be)\b')
    cliffhanger_beats = count_pattern(text, r'\b(but here\'s the thing|and then|wait until|the best part|you won\'t believe|here\'s where it gets|but wait|and guess what|the kicker|plot twist|the secret is|here\'s the catch|here\'s the magic)\b')
    why_now = has_pattern(text, r'\b(now that|finally possible|new technology|ai (makes|enables|allows)|the time is|market is|world (has|is) chang|never been possible|wasn\'t possible|until recently|with the advent|with recent|emergence of)\b')

    # journey_vs_destination
    journey_signals = count_pattern(text, r'\b(journey|process|workflow|step by step|take you from|guide you|walk you through|path|road|evolve|grow|progress|transform)\b')
    destination_signals = count_pattern(text, r'\b(the (solution|answer|tool|platform|app)|is a|is the|is an|designed for|built for|made for)\b')
    jvd_total = journey_signals + destination_signals
    journey_vs_destination = round(journey_signals / max(jvd_total, 1), 2)

    # emotional_bookend_match
    first_two = ' '.join(sents[:2]).lower() if len(sents) >= 2 else first_sent_lower
    last_two = ' '.join(sents[-2:]).lower() if len(sents) >= 2 else last_text
    open_neg = bool(re.search(r'\b(problem|pain|frustrat|broken|struggle|annoying|tired|hate)\b', first_two))
    close_pos = bool(re.search(r'\b(try|enjoy|love|better|solution|finally|start|discover|transform)\b', last_two))
    open_pos = bool(re.search(r'\b(great|exciting|welcome|hey|introducing)\b', first_two))
    close_pos2 = bool(re.search(r'\b(thanks|try|start|join|visit|check out)\b', last_two))
    emotional_bookend_match = 1 if (open_neg and close_pos) or (open_pos and close_pos2) else 0

    unsaid_problem = count_pattern(text, r'\b(you know (that|the|how)|we\'ve all|sound familiar|been there|you\'ve been|we\'ve all been|you get it|right\?|amirite)\b')

    # resolution_completeness
    if prob_matches == 0:
        resolution_completeness = 0.5
    else:
        resolution_completeness = round(min(sol_matches / max(prob_matches, 1), 1.0), 2)

    # story_compression
    if sentence_count < 5:
        story_compression = 2.0
    else:
        time_refs = temporal_anchors
        if time_refs > 3:
            story_compression = 4.0
        elif time_refs > 1:
            story_compression = 3.0
        else:
            story_compression = 2.0

    # ─── V2: EMOTIONAL MECHANICS ───
    # emotion_specificity
    vivid_emotions = count_pattern(text, r'(feeling when|that moment|at \d+ ?[ap]m|on a friday|sinking feeling|rush when|nightmare of|dread of|joy of|panic|anxiety|relief|euphoria|that (sinking|sickening|overwhelming|crushing|liberating))')
    generic_emotions = count_pattern(text, r'\b(frustrated|happy|sad|angry|excited|worried|stressed|overwhelmed)\b')
    if vivid_emotions >= 2:
        emotion_specificity = 5
    elif vivid_emotions == 1:
        emotion_specificity = 4
    elif generic_emotions >= 3:
        emotion_specificity = 3
    elif generic_emotions >= 1:
        emotion_specificity = 2
    else:
        emotion_specificity = 1

    # relief_distance: sentences between first problem mention and first solution
    first_prob_idx = -1
    first_sol_idx = -1
    for i, s in enumerate(sents):
        sl = s.lower()
        if first_prob_idx == -1 and re.search(problem_patterns, sl):
            first_prob_idx = i
        if first_sol_idx == -1 and first_prob_idx >= 0 and re.search(solution_patterns, sl):
            first_sol_idx = i
            break
    relief_distance = max(0, first_sol_idx - first_prob_idx) if first_prob_idx >= 0 and first_sol_idx >= 0 else 0

    pride_trigger = count_pattern(text, r'\b(you already know|as a \w+|smart (teams?|developers?|founders?|companies)|you understand|savvy|sophisticated|the kind of (person|team|company))\b')
    fomo_construction = count_pattern(text, r'\b(competitors? (are|already|will)|market is (moving|shifting)|everyone (is|else)|don\'t (get )?left behind|falling behind|your competitors|while you\'re still|already (using|switching|adopting))\b')

    empathy_firsthand = has_pattern(text, r'\b(i (spent|wasted|struggled|tried|experienced|dealt|suffered|built|used to)|when i was|as a (founder|developer|designer|pm|engineer|marketer|teacher)|we (experienced|went through|faced|dealt|struggled)|my own|ourselves|our team spent|i personally)\b')
    empathy_observed = has_pattern(text, r'\b(teams? (struggle|spend|waste|face|deal)|developers? (spend|waste|hate)|companies (waste|lose|spend|struggle)|people (struggle|spend|waste)|users (struggle|hate|spend))\b')

    # frustration_vocabulary_breadth
    frustration_concepts = set()
    frust_map = {
        'time': r'\b(waste time|slow|hours|takes forever|time.?consuming)\b',
        'money': r'\b(expensive|costly|waste money|overpriced|budget)\b',
        'complexity': r'\b(complex|complicated|confusing|overwhelming|steep learning)\b',
        'manual': r'\b(manual|repetitive|tedious|boring|mundane)\b',
        'errors': r'\b(errors?|bugs?|mistakes?|broken|crash|fail)\b',
        'fragmentation': r'\b(scattered|fragmented|silos?|disconnected|separate tools)\b',
        'scale': r'\b(doesn\'t scale|can\'t scale|bottleneck|limitation)\b',
        'quality': r'\b(inconsistent|unreliable|inaccurate|poor quality)\b',
        'collaboration': r'\b(miscommunication|misalign|out of sync|different pages)\b',
        'workflow': r'\b(context switching|back and forth|copy.?paste|tab switching)\b',
    }
    for concept, pat in frust_map.items():
        if re.search(pat, text_lower):
            frustration_concepts.add(concept)
    frustration_vocabulary_breadth = len(frustration_concepts)

    # joy_velocity_shift
    if narrative_arc == "problem_solution" and pivot_sharpness >= 4:
        joy_velocity_shift = 4
    elif pivot_sharpness >= 3:
        joy_velocity_shift = 3
    elif narrative_arc == "solution_first":
        joy_velocity_shift = 2
    else:
        joy_velocity_shift = 2
    if re.search(r'(instantly|immediately|in seconds|just like that|boom|voila|magic)', text_lower):
        joy_velocity_shift = min(5, joy_velocity_shift + 1)

    vulnerability_moment = has_pattern(text, r'\b(our first (version|attempt|try)|we (almost|nearly) (gave up|failed|quit)|we (got|were) (wrong|confused|lost)|honestly|to be (honest|frank|transparent)|i\'ll admit|not perfect|we\'re still (working|improving|learning)|early days|humble beginnings|mistake|lesson learned)\b')

    anticipatory_emotion = count_pattern(text, r'\b(wait (until|till) you (see|hear)|you\'re going to love|here\'s the (exciting|best|cool) part|watch this|check this out|let me show you|you won\'t believe|get ready|brace yourself|the magic happens)\b')

    social_belonging = count_pattern(text, r'\b(join (\d[\d,.]* )?(developers?|teams?|companies|founders?|users?|creators?|builders?|professionals?)|community of|thousands of|fellow (founders?|developers?|builders?)|you\'re in good company|growing community|family of)\b')

    # loss_aversion_framing
    gain_frames = count_pattern(text, r'\b(save|gain|earn|win|get|achieve|unlock|discover|enjoy|benefit)\b')
    loss_frames = count_pattern(text, r'\b(lose|losing|waste|wasting|miss|missing|cost you|spending|burning|bleeding|leaving money)\b')
    total_frames = gain_frames + loss_frames
    loss_aversion_framing = round(loss_frames / max(total_frames, 1), 2)

    surprise_delight = count_pattern(text, r'\b(oh and|bonus|did i mention|cherry on top|and it also|best of all|on top of that|and the best part|icing on the cake|wait there\'s more|but that\'s not all)\b')

    # confidence_gradient
    first_half_conf = count_pattern(text[:len(text)//2], r'\b(maybe|perhaps|might|could|think|believe|hope|try)\b')
    second_half_conf = count_pattern(text[len(text)//2:], r'\b(will|definitely|guaranteed|proven|absolutely|clearly|obviously|without doubt)\b')
    if second_half_conf > first_half_conf:
        confidence_gradient = 4
    elif first_half_conf > second_half_conf:
        confidence_gradient = 2
    else:
        confidence_gradient = 3

    # emotional_contrast_ratio
    neg_intensity = count_pattern(text, r'\b(nightmare|terrible|horrible|worst|hate|despair|pain|suffering|broken|chaos|disaster)\b')
    pos_intensity = count_pattern(text, r'\b(amazing|incredible|beautiful|perfect|love|magical|brilliant|outstanding|life.?changing)\b')
    contrast = neg_intensity + pos_intensity
    if contrast >= 4:
        emotional_contrast_ratio = 5
    elif contrast >= 3:
        emotional_contrast_ratio = 4
    elif contrast >= 2:
        emotional_contrast_ratio = 3
    elif contrast >= 1:
        emotional_contrast_ratio = 2
    else:
        emotional_contrast_ratio = 1

    finally_signal = 0
    for fs in FINALLY_SIGNALS:
        finally_signal += count_pattern(text, r'\b' + re.escape(fs) + r'\b')

    # empathy_depth
    ed = 1
    if empathy_firsthand:
        ed += 1.5
    if empathy_observed:
        ed += 1
    if emotion_specificity >= 3:
        ed += 0.5
    if frustration_vocabulary_breadth >= 3:
        ed += 0.5
    empathy_depth = clamp(round(ed), 1, 5)

    # ─── V2: PRODUCT PRESENTATION ───

    # feature_intro_velocity
    feature_mentions = count_pattern(text, r'\b(feature|features|can also|also (lets?|allows?|enables?)|another (thing|feature|tool)|you can also|plus|additionally)\b')
    if feature_mentions == 0:
        feature_intro_velocity = 3
    elif word_count / max(feature_mentions, 1) > 100:
        feature_intro_velocity = 5
    elif word_count / max(feature_mentions, 1) > 50:
        feature_intro_velocity = 4
    elif word_count / max(feature_mentions, 1) > 25:
        feature_intro_velocity = 3
    elif word_count / max(feature_mentions, 1) > 10:
        feature_intro_velocity = 2
    else:
        feature_intro_velocity = 1

    # orphaned_features
    total_features_mentioned = feature_word_count + feature_mentions
    features_with_benefit = count_pattern(text, r'\b(so (that|you)|which (means|lets|allows|enables|helps)|to (help|save|reduce|improve|increase|make)|meaning|this (means|helps|allows|saves)|result|benefit)\b')
    if total_features_mentioned == 0:
        orphaned_features = 0.5
    else:
        orphaned_features = round(1.0 - min(features_with_benefit / max(total_features_mentioned * 0.5, 1), 1.0), 2)

    demo_voice_present_tense = has_pattern(text, r'\b(i (click|drag|type|select|tap|scroll|open|navigate)|watch (as|me)|see how (it|the)|here (i|we) (go|click|select|drag)|let me (click|drag|type|show))\b')

    # concrete_vs_abstract
    concrete = count_pattern(text, r'(\d+%|\$\d|specific|exactly|precisely|\d+ (users?|customers?|minutes?|seconds?|hours?|clicks?|steps?))')
    abstract = count_pattern(text, r'\b(powerful|robust|scalable|enterprise|flexible|comprehensive|holistic|seamless|innovative|cutting.?edge|state.?of.?the.?art)\b')
    if concrete > abstract * 2:
        concrete_vs_abstract = 5
    elif concrete > abstract:
        concrete_vs_abstract = 4
    elif abstract > concrete * 2:
        concrete_vs_abstract = 1
    elif abstract > concrete:
        concrete_vs_abstract = 2
    else:
        concrete_vs_abstract = 3

    # magic_moment_position: where is the most impressive capability
    wow_patterns = r'\b(watch this|here\'s the magic|the best part|incredible|amazing|wow|boom|instantly|automatically|one click|that\'s it|just like that|voila|mind.?blowing)\b'
    magic_pos = position_in_text(text, wow_patterns)
    magic_moment_position = round(magic_pos, 2) if magic_pos >= 0 else 0.5

    speed_claims = 0
    for sc in SPEED_CLAIMS:
        speed_claims += count_pattern(text, re.escape(sc))

    effort_reduction_specific = has_pattern(text, r'(what (took|used to take|takes) .* (now takes?|in|becomes?)|from \d+ .* to \d+|\d+ (steps?|hours?|minutes?|clicks?) (to|into|becomes?) \d+|reduc\w+ (from|by) \d+)')
    effort_reduction_vague = has_pattern(text, r'\b(saves? time|easier|simpler|streamline|simplif|less effort|more efficient|faster|quicker|no hassle)\b')

    # integration_count
    integration_brands = set()
    integration_list = ['slack', 'notion', 'zapier', 'github', 'gitlab', 'jira', 'asana', 'trello',
                       'google (sheets|docs|drive|calendar|analytics|workspace)', 'microsoft (teams|365)',
                       'salesforce', 'hubspot', 'stripe', 'shopify', 'wordpress', 'webflow',
                       'figma', 'sketch', 'linear', 'discord', 'intercom', 'zendesk', 'airtable',
                       'clickup', 'monday', 'confluence', 'dropbox', 'twilio', 'sendgrid',
                       'mailchimp', 'segment', 'mixpanel', 'amplitude', 'datadog', 'sentry',
                       'vercel', 'netlify', 'aws', 'azure', 'gcp', 'firebase', 'supabase',
                       'postgres', 'mongodb', 'redis', 'elasticsearch']
    for intg in integration_list:
        if re.search(r'\b' + intg + r'\b', text_lower):
            integration_brands.add(intg.split('(')[0].strip())
    integration_count = len(integration_brands)

    progressive_disclosure = has_pattern(text, r'\b(start with|basic|simple use case|but (if|for|when) you|power users?|advanced|for more complex|take it further|next level|going deeper|under the hood)\b')
    one_more_thing = 0
    if len(sents) > 3:
        last_quarter = ' '.join(sents[-max(len(sents)//4, 1):]).lower()
        one_more_thing = has_pattern(last_quarter, r'\b(one more thing|oh and|bonus|did i mention|cherry on|and (it|we) also|best of all|icing on)\b')

    simplicity_signals = 0
    for ss in SIMPLICITY_WORDS:
        simplicity_signals += count_pattern(text, r'\b' + re.escape(ss) + r'\b')
    # Count "just [verb]" as simplicity
    simplicity_signals += count_pattern(text, r'\bjust (click|drag|type|connect|add|select|tap|upload|paste|enter|pick)\b')

    under_the_hood = has_pattern(text, r'\b(built (on|with)|powered by|uses? (gpt|llm|openai|claude|vector|neural|transformer|bert|embedding|blockchain|kubernetes|react|next|rust|python)|under the hood|architecture|infrastructure|tech stack|engine|algorithm)\b')

    # use_case_count
    use_case_markers = count_pattern(text, r'\b(for (developers?|designers?|marketers?|founders?|teams?|managers?|creators?|writers?|engineers?|product managers?|PMs?|CTOs?|CEOs?|freelancers?|agencies?|startups?|enterprises?|small businesses?|students?|educators?|researchers?))\b')
    # Also check "whether you're a X or Y" patterns
    whether_pattern = count_pattern(text, r'\b(whether you\'re|if you\'re a|for anyone who|for those who)\b')
    use_case_count = max(use_case_markers, whether_pattern, count_pattern(text, r'\b(use case|scenario|example|for instance)\b'))
    use_case_count = clamp(use_case_count, 0, 10)

    # liveness_score
    live_signals = count_pattern(text, r'\b(let me (show|click|demonstrate|walk)|watch (as|me|this)|i\'m (going to|gonna)|here (we|i) go|right now|in real.?time|live)\b')
    scripted_signals = production_markers + count_pattern(text, r'\b(music|applause)\b')
    if live_signals >= 3:
        liveness_score = 4
    elif live_signals >= 1:
        liveness_score = 3
    elif scripted_signals >= 3:
        liveness_score = 2
    elif word_count < 50:
        liveness_score = 1
    else:
        liveness_score = 3

    onboarding_time_claim = has_pattern(text, r'\b(up and running in|setup in|deploy in|start in|get started in|ready in|running in|install in|configured in) \d+ (minutes?|seconds?|hours?)\b')
    if not onboarding_time_claim:
        onboarding_time_claim = has_pattern(text, r'\b(\d+ (minute|second|hour) setup|instant setup|one.?click (setup|install|deploy))\b')

    comparison_moment = has_pattern(text, r'\b(on the left|on the right|side by side|before and after|here\'s the old|here\'s (our|the new)|compare|comparison|versus|vs)\b')

    # ─── V2: WORDING & RHETORIC ───

    # verb_energy
    passive_corporate = count_pattern(text, r'\b(utilize|facilitate|leverage|implement|optimize|streamline|synergize|operationalize|incentivize)\b')
    active_punchy = count_pattern(text, r'\b(ship|crush|build|launch|smash|nail|hack|boost|slash|kill|dominate|own|rock|fire|blast|drop|slam|rip)\b')
    if active_punchy > passive_corporate * 2:
        verb_energy = 5
    elif active_punchy > passive_corporate:
        verb_energy = 4
    elif passive_corporate > active_punchy * 2:
        verb_energy = 1
    elif passive_corporate > active_punchy:
        verb_energy = 2
    else:
        verb_energy = 3

    # sentence_rhythm_variance
    if sentence_count < 3:
        sentence_rhythm_variance = 1
    else:
        sent_lengths = [len(s.split()) for s in sents[:20]]  # Sample first 20
        if len(sent_lengths) > 1:
            mean_len = sum(sent_lengths) / len(sent_lengths)
            variance = sum((l - mean_len)**2 for l in sent_lengths) / len(sent_lengths)
            cv = math.sqrt(variance) / max(mean_len, 1)
            if cv > 0.8:
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

    # power_word_cluster_density
    power_words = r'\b(free|instant|guaranteed|proven|secret|new|now|you|save|easy|love|discover|results|fast|amazing|transform|exclusive|unlock|breakthrough|powerful|ultimate|revolutionary)\b'
    pw_positions = [m.start() for m in re.finditer(power_words, text_lower)]
    clusters = 0
    for i in range(len(pw_positions) - 2):
        # 3 power words within 100 chars
        if pw_positions[i+2] - pw_positions[i] < 100:
            clusters += 1
    power_word_cluster_density = clamp(clusters + 1, 1, 5)

    # jargon_distribution_shape
    jargon_pat = r'\b(api|sdk|saas|b2b|b2c|crm|erp|etl|ci/cd|devops|kubernetes|docker|microservices?|serverless|machine learning|deep learning|neural network|blockchain|web3|oauth|graphql|rest api|sql|nosql|cdn|ssl|tls|webhook|middleware|backend|frontend|fullstack|stack|framework|library|runtime|compiler|repository|deployment|containeriz|orchestrat|pipeline)\b'
    jargon_first = len(re.findall(jargon_pat, first_third, re.IGNORECASE))
    mid_third = text_lower[len(text_lower)//3:2*len(text_lower)//3]
    jargon_mid = len(re.findall(jargon_pat, mid_third, re.IGNORECASE))
    jargon_last = len(re.findall(jargon_pat, last_third, re.IGNORECASE))
    jargon_total = jargon_first + jargon_mid + jargon_last

    if jargon_total <= 1:
        jargon_distribution_shape = "minimal"
    elif jargon_first > jargon_mid and jargon_first > jargon_last:
        jargon_distribution_shape = "front_heavy"
    elif jargon_last > jargon_mid and jargon_last > jargon_first:
        jargon_distribution_shape = "back_heavy"
    elif jargon_mid > jargon_first and jargon_mid > jargon_last:
        jargon_distribution_shape = "middle_heavy"
    else:
        jargon_distribution_shape = "even"

    anaphora_count = count_pattern(text, r'(\. |^)(No more \w|You can \w|We \w+\.|It \w+\.|Stop \w|Start \w|Get \w|Build \w|Create \w|With \w)')
    # Count repeated sentence starts
    if len(sents) > 2:
        starts = [s.split()[0].lower() if s.split() else '' for s in sents]
        start_counts = Counter(starts)
        for word, cnt in start_counts.items():
            if cnt >= 3 and word not in ('the', 'a', 'and', 'but', 'so', 'it', 'this', 'that', 'i', 'we'):
                anaphora_count += cnt - 2

    just_minimizer = count_pattern(text, r'\bjust (click|drag|type|connect|add|select|tap|upload|paste|enter|pick|hit|press|scan|drop|say|ask|tell|write|plug|set|open|sign|log|import|export)\b')

    # superlative_density
    superlatives = count_pattern(text, r'\b(best|most|fastest|only|first|#1|number one|top|greatest|highest|lowest|biggest|smallest|cheapest|easiest|simplest|smartest|strongest)\b')
    superlative_density = round(superlatives / word_count * 100, 2) if word_count > 0 else 0.0

    question_answer_pairs = count_pattern(text, r'\?\s*(Simple|Easy|Just|One|Two|Three|It\'s|We|Yes|No|Because|Here|That|The answer)\b')

    # transition_sophistication
    basic_trans = count_pattern(text, r'\b(and|also|so|then|next|but|or)\b')
    crafted_trans = count_pattern(text, r'\b(here\'s where|but the (real|best)|what makes this|the (cool|interesting|exciting|best) (thing|part)|and here\'s the (kicker|twist|thing)|but that\'s not all|there\'s more)\b')
    if crafted_trans >= 3:
        transition_sophistication = 5
    elif crafted_trans >= 2:
        transition_sophistication = 4
    elif crafted_trans >= 1:
        transition_sophistication = 3
    elif basic_trans > 5:
        transition_sophistication = 2
    else:
        transition_sophistication = 1

    negation_as_benefit = count_pattern(text, r'\b(no (\w+ )?needed|without (any )?(\w+ )?|zero (setup|config|code|cost|effort|hassle|downtime)|never (worry|think) about|eliminates?|no more|no need (to|for))\b')

    # specificity_index
    specific_markers = count_pattern(text, r'(\d+%|\$\d|\d+ (users|minutes|seconds|hours|customers|teams|companies|clicks|steps|integrations)|\d{4})')
    vague_markers = count_pattern(text, r'\b(many|significant|great|various|multiple|several|some|lots of|a lot|bunch|tons)\b')
    if specific_markers > vague_markers * 3:
        specificity_index = 5
    elif specific_markers > vague_markers * 1.5:
        specificity_index = 4
    elif specific_markers > vague_markers:
        specificity_index = 3
    elif vague_markers > specific_markers:
        specificity_index = 2
    else:
        specificity_index = 3
    if word_count < 30:
        specificity_index = 1

    you_insertion_rate = round(you_count / word_count * 100, 2) if word_count > 0 else 0.0

    cliche_count = 0
    for cl in CLICHES:
        cliche_count += count_pattern(text, r'\b' + re.escape(cl) + r'\b')

    conditional_density = round(count_pattern(text, r'\b(if you (need|want|have|are|like)|whether you|in case you|should you|when you (need|want))\b') / word_count * 100, 2) if word_count > 0 else 0.0

    parallel_structure = count_pattern(text, r'(\w+ (faster|better|smarter|easier|simpler)\.\s*\w+ (faster|better|smarter|easier|simpler)\.|\w+\.\s*\w+\.\s*\w+\.)')
    # Also check for "X. Y. Z." short parallel sentences
    if len(sents) > 2:
        for i in range(len(sents) - 2):
            lens = [len(sents[j].split()) for j in range(i, min(i+3, len(sents)))]
            if all(2 <= l <= 6 for l in lens) and max(lens) - min(lens) <= 2:
                parallel_structure += 1

    imperative_density = round(count_pattern(text, r'\b(try|check|visit|sign up|start|join|get|download|subscribe|click|stop|build|create|discover|explore|learn|read|watch|see|look|go|head|switch|upgrade|book|grab|claim)\b') / word_count * 100, 2) if word_count > 0 else 0.0

    # ─── V2: PERSUASION PSYCHOLOGY ───

    # word_rarity_score
    common_pct = sum(1 for w in wds if w in {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or', 'not', 'no', 'so', 'if', 'then', 'than', 'that', 'this', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'just', 'about', 'up', 'out'}) / max(word_count, 1)
    if common_pct > 0.6:
        word_rarity_score = 1
    elif common_pct > 0.5:
        word_rarity_score = 2
    elif common_pct > 0.4:
        word_rarity_score = 3
    elif common_pct > 0.3:
        word_rarity_score = 4
    else:
        word_rarity_score = 5

    qualifying_retreat = count_pattern(text, r'(the best.{0,10}(well|or at least|one of)|revolutionary.{0,10}(or|at least|sort of)|the only.{0,10}(well|almost|practically)|the first.{0,10}(ok|well|at least))')

    # conclusive_finality
    last_sent = sents[-1].lower() if sents else ""
    if re.search(r'\b(so yeah|that\'s (it|about it|all)|thanks|thank you|bye)\b', last_sent) and not re.search(r'\b(try|start|join|visit|sign up|get started)\b', last_sent):
        conclusive_finality = 2
    elif re.search(r'\b(try|start|join|visit|sign up|get started|check out|discover|transform|build|create|the future)\b', last_sent):
        conclusive_finality = 4
    elif re.search(r'\b(today|now|right now)\b', last_sent):
        conclusive_finality = 4
    elif word_count < 30:
        conclusive_finality = 1
    else:
        conclusive_finality = 3
    if len(last_sent.split()) <= 8 and re.search(r'[.!]$', last_sent.strip()):
        conclusive_finality = min(5, conclusive_finality + 1)

    # social_proof_stacking_order
    if success_users and brand_count:
        sp_num_pos = position_in_text(text, r'\b\d[\d,.]* (users|customers|teams)\b')
        sp_brand_pos = -1
        for brand in found_brands:
            bp = position_in_text(text, r'\b' + re.escape(brand) + r'\b')
            if bp >= 0:
                sp_brand_pos = bp
                break
        if sp_num_pos >= 0 and sp_brand_pos >= 0:
            social_proof_stacking_order = "numbers_first" if sp_num_pos < sp_brand_pos else "brands_first"
        elif sp_num_pos >= 0:
            social_proof_stacking_order = "numbers_first"
        else:
            social_proof_stacking_order = "brands_first"
    elif has_testimonial:
        social_proof_stacking_order = "quotes_first"
    elif success_users or success_revenue or success_growth:
        social_proof_stacking_order = "numbers_first"
    elif brand_count:
        social_proof_stacking_order = "brands_first"
    else:
        social_proof_stacking_order = "none"

    # authority_type
    has_tech_auth = has_pattern(text, r'\b(ex-|former (google|facebook|meta|apple|amazon|microsoft|stripe)|phd|doctorate|engineer at|built at|worked at)\b')
    has_market_auth = bool(success_users or success_revenue)
    has_domain_auth = has_pattern(text, r'\b(\d+ years? (of|in)|decade|veteran|expert|experienced|seasoned|industry)\b')

    if has_tech_auth and (has_market_auth or has_domain_auth):
        authority_type = "mixed"
    elif has_tech_auth:
        authority_type = "technical"
    elif has_market_auth:
        authority_type = "market"
    elif has_domain_auth:
        authority_type = "domain"
    else:
        authority_type = "none"

    reciprocity_trigger = has_pattern(text, r'\b(free (tier|plan|trial|forever|version)|open source|no credit card|free template|free (tool|resource)|completely free|100% free|free to use|no cost|at no charge)\b')
    anchor_contrast_pricing = has_pattern(text, r'(\$\d[\d,.]+.{0,50}\$\d[\d,.]+|cost.{0,30}(but|only|just) \$|enterprise.{0,30}(but|only|just) \$|hundreds.{0,30}(but|only|just)|thousands.{0,30}(but|only|just))')

    contrast_pairs = count_pattern(text, r'\b(instead of|not .{1,20} but|unlike|while others|while (most|many)|rather than|compared to|versus|vs\.?)\b')

    # certainty_ratio
    certain_count = count_pattern(text, r'\b(will|definitely|guaranteed|proven|certainly|absolutely|always|every time|without fail|undoubtedly|clearly|obviously)\b')
    uncertain_count = count_pattern(text, r'\b(maybe|perhaps|might|could|possibly|potentially|sometimes|often|usually|probably|likely|arguably)\b')
    certainty_ratio = round(certain_count / max(certain_count + uncertain_count, 1), 2)

    in_group_language = count_pattern(text, r'\b(as (developers?|founders?|engineers?|designers?|creators?|builders?) we|fellow (founders?|developers?|builders?|creators?)|if you\'re like (us|me)|we\'ve all been|you know (how|what|the))\b')

    objection_preempt = count_pattern(text, r'\b(you might (be )?wonder|you might (think|ask|say)|and yes|don\'t worry|no need to worry|rest assured|but what about|concerned about|worried about|sounds too good|you\'re (probably )?thinking)\b')

    # scarcity_type
    if has_pattern(text, r'\b(today only|limited time|this week|ending soon|expires|24 hours|48 hours)\b'):
        scarcity_type = "time"
    elif has_pattern(text, r'\b(limited (spots?|seats?|places?)|only \d+ (spots?|seats?)|first \d+ (users?|customers?))\b'):
        scarcity_type = "quantity"
    elif has_pattern(text, r'\b(invite only|invite-only|exclusive access|waitlist|early access|private beta)\b'):
        scarcity_type = "access"
    elif has_pattern(text, r'\b(only (tool|platform|solution|app)|the only|no other)\b'):
        scarcity_type = "capability"
    else:
        scarcity_type = "none"

    # bandwagon_gradient
    num_refs = [(m.start(), m.group()) for m in re.finditer(r'\b(\d[\d,]*)\s+(users?|customers?|teams?|companies?|developers?|downloads?)\b', text_lower)]
    bandwagon_gradient = 0
    if len(num_refs) >= 2:
        first_num = int(re.sub(r'[,.]', '', num_refs[0][1].split()[0]))
        last_num = int(re.sub(r'[,.]', '', num_refs[-1][1].split()[0]))
        if last_num > first_num:
            bandwagon_gradient = 1

    # choice_architecture
    tier_mentions = count_pattern(text, r'\b(free plan|starter|pro |premium|enterprise|basic|professional|business|team plan|individual|personal)\b')
    pricing_tiers = count_pattern(text, r'\$\d')
    choice_architecture = clamp(max(tier_mentions, pricing_tiers), 0, 5)

    cognitive_ease_count = 0
    for ce in COGNITIVE_EASE:
        cognitive_ease_count += count_pattern(text, re.escape(ce))

    everyone_else_maneuver = count_pattern(text, r'\b(most (teams?|companies|developers?|organizations?) (already|are)|industry standard|your competitors? (use|are|have)|leading (companies|teams?|organizations?)|top (companies|teams?|organizations?)|everyone (is|else)|thousands already)\b')

    future_self_projection = count_pattern(text, r'\b(you\'ll become|imagine yourself|be the (one|person|team) who|your future (self|team)|picture yourself|envision yourself|what (would|will) you|see yourself|become the)\b')

    # ─── V2: STRUCTURE & TIMING ───

    # info_density_shape
    first_q_words = len(words(text[:len(text)//4]))
    mid_q_words = len(words(text[len(text)//4:3*len(text)//4]))
    last_q_words = len(words(text[3*len(text)//4:]))
    # Info density by keyword richness
    first_q_info = len(re.findall(r'\b\w{6,}\b', text[:len(text)//4]))
    mid_q_info = len(re.findall(r'\b\w{6,}\b', text[len(text)//4:3*len(text)//4]))
    last_q_info = len(re.findall(r'\b\w{6,}\b', text[3*len(text)//4:]))

    if first_q_info > mid_q_info and first_q_info > last_q_info:
        info_density_shape = "front_loaded"
    elif last_q_info > mid_q_info and last_q_info > first_q_info:
        info_density_shape = "back_loaded"
    elif mid_q_info > first_q_info and mid_q_info > last_q_info:
        info_density_shape = "middle_peak"
    else:
        info_density_shape = "even"

    # breathing_room
    if word_count < 30:
        breathing_room = 1
    elif avg_sentence_length < 10:
        breathing_room = 4
    elif avg_sentence_length < 15:
        breathing_room = 3
    elif avg_sentence_length < 20:
        breathing_room = 2
    else:
        breathing_room = 1
    # Adjust for transition markers that create pauses
    if crafted_trans >= 2:
        breathing_room = min(5, breathing_room + 1)

    # cold_open_words
    product_name_lower = name.lower() if name else ""
    first_mention = -1
    for i, w in enumerate(wds):
        if product_name_lower and w == product_name_lower.split()[0].lower():
            first_mention = i
            break
        if re.match(r'(feature|tool|platform|app|product|solution|software|introducing|meet)', w):
            first_mention = i
            break
    cold_open_words = first_mention if first_mention >= 0 else min(word_count, 20)

    callback_count = count_pattern(text, r'\b(remember (that|when|what|how|earlier)|going back to|as (i|we) (mentioned|showed|said)|this ties back|earlier (i|we)|like (i|we) said|recall)\b')

    # section_length_cv
    if len(sents) < 5:
        section_length_cv = 1
    else:
        # Split into ~4 sections
        section_size = len(sents) // 4
        sections = []
        for i in range(4):
            start = i * section_size
            end = start + section_size if i < 3 else len(sents)
            section_words = sum(len(s.split()) for s in sents[start:end])
            sections.append(section_words)
        mean_s = sum(sections) / len(sections)
        var_s = sum((s - mean_s)**2 for s in sections) / len(sections)
        cv_s = math.sqrt(var_s) / max(mean_s, 1)
        if cv_s > 0.6:
            section_length_cv = 5
        elif cv_s > 0.4:
            section_length_cv = 4
        elif cv_s > 0.25:
            section_length_cv = 3
        elif cv_s > 0.1:
            section_length_cv = 2
        else:
            section_length_cv = 1

    # promise_proof_push
    has_promise = 1.0 if (sol_matches > 0 or has_pattern(text, r'\b(helps?|enables?|allows?|lets?|makes?|gives?|provides?)\b')) else 0.0
    has_proof = 1.0 if (social_proof_claims > 0 or success_users or success_revenue or has_testimonial or brand_count > 0) else 0.0
    has_push = 1.0 if (closing_has_cta or primary_cta != "none") else 0.0
    promise_proof_push = has_promise + has_proof + has_push

    # first_feature_position
    feature_pat = r'\b(feature|you can|it (lets|allows|enables|helps)|with .*? you|automatically|dashboard|integration|api|tool|click|drag|upload|import|export|generate|analyze|track|monitor|manage|create|build|deploy)\b'
    ff_pos = position_in_text(text, feature_pat)
    first_feature_position = round(max(ff_pos, 0), 2)

    parenthetical_credibility = count_pattern(text, r'(\(.*?(users?|customers?|funded|backed|raised|%|year|award|prize).*?\)|—.*?(users?|customers?|funded).*?—|by the way.*?(users?|customers?))')
    # Also count casual impressive number drops
    parenthetical_credibility += count_pattern(text, r'\b(oh and we have|we now have|with over|serving|powering)\b')

    section_boundary_markers = count_pattern(text, r'\b(number one|number two|number three|first|second|third|fourth|fifth|next|finally|let\'s move on|the (second|third|next) (thing|feature|part)|moving on|now let\'s talk|step \d)\b')

    # setup_payoff_distance
    if relief_distance >= 5:
        setup_payoff_distance = 5.0
    elif relief_distance >= 3:
        setup_payoff_distance = 4.0
    elif relief_distance >= 2:
        setup_payoff_distance = 3.0
    elif relief_distance >= 1:
        setup_payoff_distance = 2.0
    else:
        setup_payoff_distance = 1.0

    multi_persona_address = count_pattern(text, r'\b(for (developers?|designers?|marketers?|founders?|engineers?|managers?|creators?|writers?|PMs?|CTOs?|CEOs?|freelancers?|agencies?|startups?|enterprises?|small businesses?|students?|educators?|teams?|individuals?))\b')
    multi_persona_address = clamp(multi_persona_address, 0, 10)

    # voice_consistency
    i_count = count_pattern(text, r'\b(i |i\')\b')
    total_pronouns = we_count + you_count + i_count
    if total_pronouns < 3:
        voice_consistency = 3
    else:
        # Check if pronoun usage is consistent
        dominant = max(we_count, you_count, i_count)
        voice_consistency = clamp(round(dominant / max(total_pronouns * 0.4, 1)), 1, 5)

    counterfactual_count = count_pattern(text, r'\b(what if|without this|imagine (not|if)|wouldn\'t it|what would happen|how would you|if you (didn\'t|couldn\'t|hadn\'t))\b')

    # closing_velocity
    if len(sents) >= 3:
        last_3_avg = sum(len(s.split()) for s in sents[-3:]) / 3
        overall_avg = avg_sentence_length
        if last_3_avg < overall_avg * 0.6:
            closing_velocity = 5
        elif last_3_avg < overall_avg * 0.8:
            closing_velocity = 4
        elif last_3_avg > overall_avg * 1.3:
            closing_velocity = 1
        else:
            closing_velocity = 3
    else:
        closing_velocity = 3

    open_loop_closing = has_pattern(last_text, r'\b(just the beginning|much more to come|stay tuned|wait until|v2|coming soon|roadmap|we\'re just getting started|more features|watch this space|this is only)\b')
    definitive_closing = has_pattern(last_text, r'\b(try it|get started|sign up|visit|check out|download|start now|join|\.com|\.io|go to|head to|today)\b')

    # ─── Assemble result ───
    return {
        "id": tid,
        # V1: Opening
        "hook_type": hook_type,
        "first_person_opener": first_person_opener,
        "has_negative_opener": has_negative_opener,
        "first_sentence_words": first_sent_words,
        "hook_quality": hook_quality,
        # V1: Length & Readability
        "word_count": len(wds),
        "sentence_count": len(sents),
        "avg_sentence_length": avg_sentence_length,
        "flesch_kincaid_grade": fk_grade,
        "word_diversity": word_diversity,
        "syllable_density": syl_density,
        # V1: Pronouns & Voice
        "pronoun_strategy": pronoun_strategy,
        "we_count": we_count,
        "you_count": you_count,
        "hedge_count": hedge_count,
        "filler_count": filler_count,
        # V1: Narrative Arc
        "narrative_arc": narrative_arc,
        "topic_transitions": topic_transitions,
        "problem_pct": problem_pct,
        "solution_pct": solution_pct,
        "declining_arc": declining_arc,
        # V1: Metrics & Traction
        "number_count": number_count,
        "number_density": number_density,
        "metric_placement": metric_placement,
        "before_after_total": before_after_total,
        "success_users": success_users,
        "success_revenue": success_revenue,
        "success_cost_savings": success_cost_savings,
        "success_growth": success_growth,
        # V1: Social Proof
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
        # V1: Category & Positioning
        "category_creation_total": category_creation_total,
        "ai_count": ai_count,
        "ai_density": ai_density,
        "buzzword_count": buzzword_count,
        # V1: CTA & Closing
        "primary_cta": primary_cta,
        "cta_position": cta_position,
        "has_discount": has_discount,
        "has_scarcity": has_scarcity,
        "has_pricing": has_pricing,
        "has_url": has_url,
        "closing_has_cta": closing_has_cta,
        "closing_has_thanks": closing_has_thanks,
        # V1: Content Signals
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
        "feature_words": feature_word_count,
        "benefit_words": benefit_word_count,
        "benefit_ratio": benefit_ratio,
        "question_count": question_count,
        "passive_voice_count": passive_voice_count,
        # V1: Sentiment
        "sentiment": sentiment,
        "confidence_count": confidence_count,
        "product_name_repeats": product_name_repeats,
        # V2: Story Architecture
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
        # V2: Emotional Mechanics
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
        # V2: Product Presentation
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
        # V2: Wording & Rhetoric
        "verb_energy": verb_energy,
        "sentence_rhythm_variance": sentence_rhythm_variance,
        "power_word_cluster_density": power_word_cluster_density,
        "jargon_distribution_shape": jargon_distribution_shape,
        "anaphora_count": anaphora_count,
        "just_minimizer": just_minimizer,
        "superlative_density": superlative_density,
        "question_answer_pairs": question_answer_pairs,
        "transition_sophistication": transition_sophistication,
        "negation_as_benefit": negation_as_benefit,
        "specificity_index": specificity_index,
        "you_insertion_rate": you_insertion_rate,
        "cliche_count": cliche_count,
        "conditional_density": conditional_density,
        "parallel_structure": parallel_structure,
        "imperative_density": imperative_density,
        # V2: Persuasion Psychology
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
        "cognitive_ease": cognitive_ease_count,
        "everyone_else_maneuver": everyone_else_maneuver,
        "future_self_projection": future_self_projection,
        # V2: Structure & Timing
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


def main():
    input_path = '/Users/maxguillabert/Downloads/index/launch-video-analysis/ph/v2-llm-parts/input_batch_01.json'
    output_path = '/Users/maxguillabert/Downloads/index/launch-video-analysis/ph/v2-llm-parts/output_batch_01.json'

    with open(input_path) as f:
        data = json.load(f)

    print(f"Processing {len(data)} transcripts...")
    results = []
    for i, item in enumerate(data):
        try:
            result = extract_dimensions(item)
            results.append(result)
            if (i + 1) % 10 == 0:
                print(f"  Processed {i+1}/{len(data)}")
        except Exception as e:
            print(f"  ERROR on {item.get('id', '?')}: {e}")
            import traceback
            traceback.print_exc()
            # Still add a minimal result
            results.append({"id": item.get("id", "?"), "error": str(e)})

    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"Done. Wrote {len(results)} results to {output_path}")

    # Verify all dimensions present
    if results and 'error' not in results[0]:
        dim_count = len([k for k in results[0].keys() if k != 'id'])
        print(f"Dimensions per transcript: {dim_count}")

        # Verify all IDs processed
        input_ids = set(item['id'] for item in data)
        output_ids = set(r['id'] for r in results)
        missing = input_ids - output_ids
        if missing:
            print(f"WARNING: Missing IDs: {missing}")
        else:
            print(f"All {len(input_ids)} transcripts processed successfully.")


if __name__ == '__main__':
    main()
