#!/usr/bin/env python3
"""
Extract 169 dimensions from Product Hunt launch video transcripts.
Batch 09 processor - semantic extraction with NLP heuristics.
"""

import json
import re
import math
from collections import Counter

def count_syllables(word):
    word = word.lower().strip()
    if len(word) <= 2:
        return 1
    count = 0
    vowels = 'aeiouy'
    prev_vowel = False
    for ch in word:
        is_vowel = ch in vowels
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel
    if word.endswith('e') and count > 1:
        count -= 1
    return max(1, count)

def get_sentences(text):
    """Split text into sentences — handles transcripts without punctuation."""
    clean = re.sub(r'\[.*?\]', '', text).strip()
    if not clean:
        return [""]
    # First try standard sentence splitting
    sents = re.split(r'(?<=[.!?])\s+', clean)
    sents = [s.strip() for s in sents if s.strip() and len(s.strip()) > 2]
    # If very few sentences but long text, split on clauses
    if len(sents) <= 1 and len(clean) > 200:
        # Split on common clause boundaries for spoken transcripts
        sents = re.split(r'(?:,\s+(?:and|but|so|then|now|because|which|where|when|while|if|or)\s+|\s+(?:and|but|so|then|now|because)\s+)', clean)
        sents = [s.strip() for s in sents if s.strip() and len(s.strip()) > 5]
    if not sents:
        sents = [clean]
    return sents

def get_words(text):
    clean = re.sub(r'\[.*?\]', '', text)
    words = re.findall(r"[a-zA-Z']+", clean)
    return [w.lower() for w in words if len(w) > 0]

def count_pattern(text, patterns):
    total = 0
    text_lower = text.lower()
    for p in patterns:
        total += len(re.findall(p, text_lower))
    return total

def analyze_transcript(item):
    tid = str(item['id'])
    text = item.get('transcript', '')

    clean_text = re.sub(r'\[.*?\]', '', text).strip()
    words = get_words(text)
    word_count = max(1, len(words))
    sentences = get_sentences(text)
    sentence_count = max(1, len(sentences))

    text_lower = clean_text.lower()

    # ==================== V1 DIMENSIONS ====================

    # --- Opening (5 dims) ---
    first_sent = sentences[0] if sentences else ""
    first_sent_lower = first_sent.lower().strip()
    first_sent_words_list = get_words(first_sent)
    first_sentence_words = len(first_sent_words_list)
    # Cap first_sentence_words for transcripts without punctuation
    if first_sentence_words > 50:
        # Approximate: take first ~15 words as the "opening"
        approx_first = ' '.join(words[:15]).lower()
        first_sent_lower = approx_first
        first_sentence_words = min(first_sentence_words, 15)

    hook_type = "descriptive"
    if re.match(r'^(hi|hey|hello|welcome|good morning|good afternoon|greetings)', first_sent_lower):
        hook_type = "greeting"
    elif '?' in first_sent:
        hook_type = "question"
    elif re.search(r'(tired of|frustrated|struggling|problem|broken|hate|sick of|boring|tedious|overwhelming|sifting|another bad)', first_sent_lower):
        hook_type = "pain_point"
    elif re.search(r'(introducing|announcing|meet |presenting|launch|just launched)', first_sent_lower):
        hook_type = "announcement"
    elif re.search(r'(let me show|click|watch|here you can see|i\'ll demonstrate|i\'m going to show|let me walk)', first_sent_lower):
        hook_type = "demo_instruction"
    elif re.search(r'\d+%|\d+x|\$\d+|\d+ (million|billion|thousand|users|customers)|\d+% of', first_sent_lower):
        hook_type = "stat_number"
    elif re.search(r'(the (best|only|first|most)|never before|revolutionary|the future of|a new)', first_sent_lower):
        hook_type = "bold_claim"
    elif re.search(r'^(i |i\'m|we |we\'re|my |our )', first_sent_lower):
        if re.search(r'(built|created|started|founded|launched|co-founder|worked|spent)', first_sent_lower):
            hook_type = "founder_story"
        else:
            hook_type = "product_statement"
    elif re.search(r'(what would|what if|imagine|picture this|have you ever)', first_sent_lower):
        hook_type = "question"

    first_person_opener = 1 if re.match(r'^(i |i\'m|we |we\'re|my |our )', first_sent_lower) else 0
    has_negative_opener = 1 if re.search(r'(broken|tired|hate|frustrated|problem|struggle|difficult|challenging|overwhelming|boring|tedious|bad|sifting|chaos|nightmare|damag)', first_sent_lower) else 0

    # hook_quality (1-5) — use full range
    hook_quality = 2
    if hook_type == "pain_point":
        hook_quality = 4
        if has_negative_opener and re.search(r'(you|your)', first_sent_lower):
            hook_quality = 5
    elif hook_type == "question":
        hook_quality = 4
        if re.search(r'(what would it feel|have you ever|imagine)', first_sent_lower):
            hook_quality = 5
    elif hook_type == "stat_number":
        hook_quality = 4
    elif hook_type == "bold_claim":
        hook_quality = 4
    elif hook_type == "founder_story":
        hook_quality = 3
    elif hook_type == "announcement":
        hook_quality = 3
    elif hook_type == "greeting":
        hook_quality = 2
        if re.search(r'excited|thrilled|incredible', first_sent_lower):
            hook_quality = 3
    elif hook_type == "demo_instruction":
        hook_quality = 2
    elif hook_type == "descriptive":
        hook_quality = 2
        if re.search(r'(you\'ve|you |your)', first_sent_lower):
            hook_quality = 3
    elif hook_type == "product_statement":
        hook_quality = 2
    if word_count < 30:
        hook_quality = max(1, hook_quality - 1)

    # --- Length & Readability (6 dims) ---
    avg_sentence_length = round(word_count / sentence_count, 1)
    total_syllables = sum(count_syllables(w) for w in words)
    fk_grade = round(0.39 * (word_count / sentence_count) + 11.8 * (total_syllables / word_count) - 15.59, 1)
    fk_grade = max(1.0, min(18.0, fk_grade))
    unique_words = set(words)
    word_diversity = round(len(unique_words) / word_count, 3)
    syllable_density = round(total_syllables / word_count, 2)

    # --- Pronouns & Voice (5 dims) ---
    we_count = len(re.findall(r'\b(we|our|us|we\'re|we\'ve|we\'ll)\b', text_lower))
    you_count = len(re.findall(r'\b(you|your|you\'re|you\'ve|you\'ll|yours|yourself)\b', text_lower))

    if we_count > you_count * 1.5 and we_count >= 3:
        pronoun_strategy = "mostly_we"
    elif you_count > we_count * 1.5 and you_count >= 3:
        pronoun_strategy = "mostly_you"
    elif we_count + you_count < 3:
        pronoun_strategy = "neutral"
    else:
        pronoun_strategy = "balanced"

    hedge_count = count_pattern(text, [r'\bmaybe\b', r'\bperhaps\b', r'\bmight\b', r'\bkind of\b', r'\bsort of\b', r'\barguably\b', r'\bprobably\b'])
    filler_count = count_pattern(text, [r'\bum\b', r'\buh\b', r'\bbasically\b', r'\bactually\b', r'\bliterally\b', r'\bso yeah\b'])

    # --- Narrative Arc (5 dims) ---
    problem_words = ['problem', 'challenge', 'struggle', 'difficult', 'hard', 'frustrated', 'pain', 'tedious',
                     'overwhelming', 'complicated', 'broken', 'waste', 'tired', 'sifting', 'endless', 'chaos',
                     'nightmare', 'manual', 'repetitive', 'boring', 'clunky', 'fragmented', 'hassle',
                     'annoying', 'costly', 'expensive', 'confusing', 'messy', 'stuck', 'slow']
    solution_words_list = ['solution', 'introducing', 'meet', 'built', 'created', 'feature', 'tool', 'platform',
                      'allows', 'enables', 'helps', 'automat', 'powered', 'simple', 'easy', 'with',
                      'just', 'click', 'dashboard', 'seamless', 'generate']

    third = max(1, len(sentences) // 3)
    first_third = ' '.join(sentences[:third]).lower()
    mid_third = ' '.join(sentences[third:2*third]).lower()
    last_third = ' '.join(sentences[2*third:]).lower()

    prob_first = sum(1 for w in problem_words if w in first_third)
    prob_mid = sum(1 for w in problem_words if w in mid_third)
    prob_last = sum(1 for w in problem_words if w in last_third)
    sol_first = sum(1 for w in solution_words_list if w in first_third)
    sol_mid = sum(1 for w in solution_words_list if w in mid_third)
    sol_last = sum(1 for w in solution_words_list if w in last_third)

    total_prob = prob_first + prob_mid + prob_last
    total_sol = sol_first + sol_mid + sol_last

    # Traction check
    traction_patterns = re.findall(r'\b(\d+[,.]?\d*)\s*(users|customers|clients|companies|teams|downloads|active|paying|businesses)', text_lower)
    traction_early = False
    if traction_patterns:
        first_match = re.search(r'\d+[,.]?\d*\s*(users|customers|clients|companies|teams)', text_lower)
        if first_match and first_match.start() < len(text_lower) * 0.3:
            traction_early = True

    if word_count < 30:
        narrative_arc = "too_short"
    elif traction_early:
        narrative_arc = "traction_first"
    elif hook_type == "pain_point" and total_sol > 0:
        narrative_arc = "problem_solution"
    elif prob_first >= 2 and prob_first > sol_first and (sol_mid + sol_last) > (prob_mid + prob_last):
        narrative_arc = "problem_solution"
    elif prob_first >= 1 and sol_first <= 1 and total_prob > total_sol * 0.5 and (sol_mid + sol_last) > 0:
        narrative_arc = "problem_solution"
    elif has_negative_opener and total_sol > 0:
        narrative_arc = "problem_solution"
    elif total_prob > total_sol and prob_first > (sol_first * 0.5):
        narrative_arc = "problem_heavy"
    elif sol_first >= 2 and prob_first == 0:
        narrative_arc = "solution_first"
    elif sol_first > prob_first and total_sol > total_prob:
        narrative_arc = "solution_first"
    elif total_prob == 0 and total_sol == 0:
        narrative_arc = "neutral_flat"
    elif total_prob <= 1 and total_sol <= 2:
        narrative_arc = "neutral_flat"
    else:
        # Check flow: if problem appears before solution
        first_problem_pos = None
        first_solution_pos = None
        for w in problem_words:
            m = re.search(r'\b' + re.escape(w) + r'\b', text_lower)
            if m and (first_problem_pos is None or m.start() < first_problem_pos):
                first_problem_pos = m.start()
        for w in ['introducing', 'meet ', 'built', 'our tool', 'our platform', 'with our', 'we created']:
            m = re.search(w, text_lower)
            if m and (first_solution_pos is None or m.start() < first_solution_pos):
                first_solution_pos = m.start()

        if first_problem_pos is not None and first_solution_pos is not None and first_problem_pos < first_solution_pos:
            narrative_arc = "problem_solution"
        elif first_solution_pos is not None and (first_problem_pos is None or first_solution_pos < first_problem_pos):
            narrative_arc = "solution_first"
        else:
            narrative_arc = "neutral_flat"

    transition_markers = count_pattern(text, [r'\bbut\b', r'\bnow\b', r'\bhowever\b', r'\bnext\b',
                                               r'\balso\b', r'\badditionally\b', r'\bmoreover\b', r'\bfurthermore\b',
                                               r'\band then\b', r'\bmoving on\b', r'\blet\'s\b'])
    topic_transitions = min(transition_markers // 2, 10)

    total_markers = total_prob + total_sol
    if total_markers > 0:
        problem_pct = round((total_prob / total_markers) * 100, 1)
        solution_pct = round((total_sol / total_markers) * 100, 1)
    else:
        problem_pct = 0.0
        solution_pct = 100.0 if word_count > 30 else 0.0

    last_portion = ' '.join(sentences[-3:]).lower() if len(sentences) >= 3 else text_lower
    declining_arc = 1 if re.search(r'(hurry|limited|don\'t miss|before it\'s too late|last chance|running out|won\'t last|selling out|this deal)', last_portion) else 0

    # --- Metrics & Traction (8 dims) ---
    numbers = re.findall(r'\b\d+[,.]?\d*\b', clean_text)
    number_count = len(numbers)
    number_density = round(number_count / word_count * 100, 2)

    if number_count == 0:
        metric_placement = "none"
    else:
        first_num_pos = re.search(r'\b\d+', clean_text)
        if first_num_pos:
            pos_ratio = first_num_pos.start() / max(1, len(clean_text))
            if pos_ratio < 0.3:
                metric_placement = "front"
            elif pos_ratio < 0.6:
                metric_placement = "middle"
            else:
                metric_placement = "back"
        else:
            metric_placement = "none"

    before_after_total = count_pattern(text, [r'before.*after', r'used to.*now', r'what took.*now takes',
                                               r'went from.*to', r'from \d.*to \d', r'old way.*new way'])

    success_users = len(re.findall(r'\b\d+[,.]?\d*\s*(users|customers|clients|companies|teams|businesses|subscribers|creators|people|members)', text_lower))
    success_revenue = len(re.findall(r'(\$\d+|revenue|arr|mrr|\bsales\b.*\d|profit|income)', text_lower))
    success_cost_savings = len(re.findall(r'(sav(e|es|ing|ings)\s+\$|cost (reduction|saving)|saves? (time|money|hours)|\d+%\s*(less|cheaper|reduction|saving))', text_lower))
    success_growth = len(re.findall(r'(grow(th|ing|n)|increas(e|ed|ing)\s+(by|to|\d)|\bscal(e|ing)\b|\d+x\b|\d+%\s*(growth|increase|more))', text_lower))

    # --- Social Proof (10 dims) ---
    known_brands = ['google', 'slack', 'notion', 'salesforce', 'hubspot', 'stripe', 'zapier', 'github',
                    'linkedin', 'twitter', 'facebook', 'instagram', 'youtube', 'tiktok', 'amazon', 'microsoft',
                    'apple', 'openai', 'chatgpt', 'gpt', 'shopify', 'figma', 'canva', 'asana', 'jira',
                    'trello', 'zoom', 'teams', 'gmail', 'chrome', 'whatsapp', 'telegram', 'discord',
                    'wordpress', 'wix', 'vercel', 'aws', 'azure', 'ibm', 'oracle', 'sap',
                    'pinterest', 'reddit', 'quora', 'medium', 'substack', 'bmw', 'eventbrite',
                    'pipedrive', 'airtable', 'monday', 'clickup', 'basecamp',
                    'mailchimp', 'sendgrid', 'twilio', 'loom', 'dropbox', 'intercom']
    brands_found = set()
    for b in known_brands:
        if re.search(r'\b' + re.escape(b) + r'\b', text_lower):
            brands_found.add(b)
    brand_count = len(brands_found)

    has_investor_mention = 1 if re.search(r'(invest(or|ment|ed)|funding|funded|raised|backing|backed by|venture|vc\b|seed round|series [a-d])', text_lower) else 0
    has_testimonial = 1 if re.search(r'(said|told us|testimonial|here\'s what .*(say|think)|our (users|customers|clients) (say|love|report)|\".*\")', text_lower) else 0
    trusted_by = 1 if re.search(r'(trusted by|used by|loved by|chosen by|preferred by)', text_lower) else 0
    has_partnership = 1 if re.search(r'(partner(ship|ed|ing)|collaborat(e|ion)|integrated? with|works with .*(slack|notion|google|stripe|shopify|hubspot))', text_lower) else 0
    has_credential = 1 if re.search(r'(ex-|former |previously at |phd|doctorate|professor|\d+ years?.* experience|serial entrepreneur|co-founder|cto and|ceo and|worked at (google|meta|amazon|microsoft|apple))', text_lower) else 0

    social_proof_claims = has_investor_mention + has_testimonial + trusted_by + has_partnership + has_credential + min(2, success_users)
    platform_mentions = brand_count

    competitive_total = count_pattern(text, [r'(unlike|compared to|versus|vs\.?|better than|faster than|cheaper than|instead of|while others|traditional|other (tools|platforms|solutions)|competitor|competition|alternative)'])
    replacement_total = count_pattern(text, [r'(replace|switch from|stop using|ditch|say goodbye to|no more .*(spreadsheet|email|tool|platform))'])

    # --- Category & Positioning (4 dims) ---
    category_creation_total = count_pattern(text, [r'\bthe (first|only|one and only)\b', r'\ba new (kind|way|type|approach|era|category)\b',
                                                    r'\bwe invented\b', r'\bnever before\b', r'\bfirst of its kind\b',
                                                    r'\bpioneering\b', r'\bthe future of\b', r'\bnew standard\b'])

    ai_mentions = re.findall(r'\b(ai|artificial intelligence|machine learning|ml\b|deep learning|neural|gpt|llm|generative ai)\b', text_lower)
    ai_count = len(ai_mentions)
    ai_density = round(ai_count / word_count * 100, 2)

    buzzword_list = ['revolutionary', 'game.chang', 'cutting.edge', 'disrupt', 'reimagine',
                     'next.gen', 'state.of.the.art', 'world.class', 'bleeding edge', 'paradigm',
                     'synergy', 'empower']
    buzzword_count = sum(1 for b in buzzword_list if re.search(b, text_lower))

    # --- CTA & Closing (8 dims) ---
    primary_cta = "none"
    if re.search(r'(try it|try .* free|give .* try|try .*today)', text_lower):
        primary_cta = "try"
    elif re.search(r'(sign up|signup|register)', text_lower):
        primary_cta = "sign_up"
    elif re.search(r'get started', text_lower):
        primary_cta = "get_started"
    elif re.search(r'free (trial|plan|tier|version)|for free|completely free', text_lower):
        primary_cta = "free"
    elif re.search(r'(book a demo|schedule a demo|request a demo)', text_lower):
        primary_cta = "book_demo"
    elif re.search(r'(waitlist|wait list|waiting list)', text_lower):
        primary_cta = "waitlist"
    elif re.search(r'\bjoin\b', text_lower):
        primary_cta = "join"
    elif re.search(r'\bbeta\b', text_lower):
        primary_cta = "beta"
    elif re.search(r'\blimited\b', text_lower):
        primary_cta = "limited"
    elif re.search(r'(visit|check .* out|download|start)', last_portion):
        primary_cta = "try"

    cta_generic = r'(try|sign up|get started|join|visit|download|book|check .* out|give .* try|start (your|a)|explore)'
    cta_positions_list = [(m.start() / max(1, len(clean_text))) for m in re.finditer(cta_generic, text_lower)]
    if not cta_positions_list:
        cta_position = "none"
    elif cta_positions_list[-1] > 0.7:
        cta_position = "end"
    elif cta_positions_list[0] < 0.3:
        cta_position = "start"
    else:
        cta_position = "middle"

    has_discount = 1 if re.search(r'(discount|% off|\d+% off|deal|special offer|coupon|promo code|half price|50% off)', text_lower) else 0
    has_scarcity = 1 if re.search(r'(limited|exclusive|only \d+ spots|invite only|running out|won\'t last|selling out|hurry)', text_lower) else 0
    has_pricing = 1 if re.search(r'(\$\d+|pricing|price|per month|/mo|per year|/yr|free (tier|plan)|paid plan|cost)', text_lower) else 0
    has_url = 1 if re.search(r'(\.com|\.io|\.ai|\.app|\.co\b|visit .*(website|site|page)|www\.)', text_lower) else 0

    last_sents = ' '.join(sentences[-3:]).lower() if len(sentences) >= 3 else text_lower
    closing_has_cta = 1 if re.search(cta_generic, last_sents) else 0
    closing_has_thanks = 1 if re.search(r'(thank|thanks|bye|goodbye|see you|cheers)', last_sents) else 0

    # --- Content Signals (15 dims) ---
    storytelling = 1 if re.search(r'(one day|once upon|I remember|story|anecdote|imagine|back in|years ago|there was a time|let me tell you|meet \w+[,.]? (like|she|he|they)|I\'ve seen this look|hey man|what is that|let me show you so|mr |bring me a|come on sing)', text_lower) else 0
    humor = 1 if re.search(r'(haha|lol|funny|joke|laugh|humor|just kidding|abra|dabra|hot cakes|counting sheep|embarrassing|circle .* don\'t want tickets|sing with me|beep it|all of these options suck|what is that|please no|implo|juggle with fireballs)', text_lower) else 0

    demo_instructions = count_pattern(text, [r'(click here|let me show|I\'ll show|watch as|I\'m going to show|let me walk|let me demonstrate|I\'ll walk|click on|follow along|let\'s see|I\'m going to demo)'])
    screen_narration = count_pattern(text, [r'(here you can see|on the (left|right|top|bottom)|as you can see|you can see here|on (this|the) (screen|page|dashboard)|you\'ll see|notice (here|that|how)|looking at|over here|right here)'])
    data_viz_cues = count_pattern(text, [r'(chart|graph|dashboard|visualization|data point|metric|analytics|report|plot|diagram)'])
    energy_markers = len(re.findall(r'!', clean_text)) + count_pattern(text, [r'\b(amazing|incredible|awesome|exciting|fantastic|love|thrilled|super excited|wow|boom|beautiful|brilliant)\b'])
    feature_list_markers = count_pattern(text, [r'\b(first(ly)?|second(ly)?|third(ly)?|also|additionally|moreover|furthermore|another|plus|next up|on top of that)\b'])
    production_markers = len(re.findall(r'\[(?:Music|Applause|music|applause|Sound|Laughter|soft music)[^\]]*\]', text))
    speaker_changes_explicit = len(re.findall(r'\[.*?speaking\]', text))
    speaker_changes_implicit = max(0, len(re.findall(r'(my name is|I\'m [A-Z]\w+ |hi I\'m)', text)) - 1)
    speaker_changes = max(speaker_changes_explicit, speaker_changes_implicit)

    action_verbs = count_pattern(text, [r'\b(build|ship|launch|create|deploy|automate|generate|transform|boost|accelerate|optimize|streamline|simplify|connect|sync|integrate|scale|craft|design|deliver)\b'])
    feature_words = count_pattern(text, [r'\b(feature|function|capability|tool|module|integration|api|dashboard|widget|extension|plugin|setting|option|mode)\b'])
    benefit_words = count_pattern(text, [r'\b(save|fast|easy|simple|efficient|productive|powerful|reliable|secure|accurate|better|improve|reduce|increase|grow|profit|time|money|free|quick)\b'])
    benefit_ratio = round(benefit_words / max(1, benefit_words + feature_words), 2)

    question_count = len(re.findall(r'\?', clean_text))
    passive_constructions = count_pattern(text, [r'\b(is|are|was|were|been|being)\s+\w+ed\b'])

    # --- Sentiment (3 dims) ---
    positive_words = count_pattern(text, [r'\b(great|amazing|love|best|beautiful|excellent|wonderful|fantastic|incredible|brilliant|powerful|perfect|impressive|excited|happy|enjoy|delightful|stunning)\b'])
    negative_words_count = count_pattern(text, [r'\b(problem|challenge|struggle|difficult|hard|frustrated|pain|tedious|overwhelming|complicated|broken|waste|nightmare|chaos|annoying|costly|confusing)\b'])

    if positive_words > negative_words_count * 2 and positive_words >= 2:
        sentiment = "positive"
    elif negative_words_count > positive_words and negative_words_count >= 2:
        sentiment = "negative"
    elif positive_words >= 3:
        sentiment = "positive"
    else:
        sentiment = "neutral"

    confidence_count = count_pattern(text, [r'\b(will|definitely|guaranteed|proven|ensure|certainly|undoubtedly)\b'])

    # Product name detection
    product_name = None
    for pat in [r'(?:introducing|welcome to|meet|called|named|this is)\s+([A-Z][a-zA-Z]+)',
                r'(?:with|using|try)\s+([A-Z][a-zA-Z]+)\b']:
        m = re.search(pat, clean_text)
        if m and len(m.group(1)) > 2 and m.group(1).lower() not in ('the', 'our', 'your', 'this', 'that', 'here', 'now', 'what'):
            product_name = m.group(1)
            break

    product_name_repeats = len(re.findall(re.escape(product_name), clean_text, re.IGNORECASE)) if product_name else 0

    # ==================== V2 DIMENSIONS ====================

    # --- A. Story Architecture (17 dims) ---

    inciting_incident = 0
    if re.search(r'(one day|last (week|month|year|tuesday|monday)|I was (sitting|working|doing)|specific moment|I realized|it hit me|that\'s when|the moment|when I was)', text_lower):
        inciting_incident = 1
    if re.search(r'(my (api|bill|cost) was \$|spent \d+ (hours|months|years)|I was in a meeting|while I was|years ago .*(I|we))', text_lower):
        inciting_incident = 1
    if re.search(r'(working in finance|was the PM|when I worked|in my previous)', text_lower):
        inciting_incident = 1

    villain_named = 1 if re.search(r'(spreadsheet|email chaos|manual|complexity|information overload|copy.paste|legacy|existing (tools|solutions)|traditional|old way|fragmented|multiple (tools|tabs)|juggling|clunky|messy kitchen)', text_lower) else 0

    villains = set()
    for v_name, v_pat in [
        ('spreadsheets', r'spreadsheet'), ('email', r'\bemail\b.{0,30}(chaos|mess|tedious|hassle|cluttered|thread|endless)'),
        ('manual_work', r'(manual(ly)?|repetitive|by hand|tedious)'), ('complexity', r'(complex|complicated|overwhelming)'),
        ('fragmentation', r'(fragment|scattered|silos|multiple (tools|tabs|platforms)|juggling)'),
        ('time_waste', r'(waste|wasting|hours spent|time.consuming)'), ('legacy', r'(legacy|outdated|old.fashioned|traditional)'),
        ('cost', r'(expensive|costly|overpriced|burn.* hole|set you back)'),
        ('competitors', r'(competitor|other (tools|platform)|alternative)'),
        ('popups', r'(popup|annoying|intrusive|untimely)'),
    ]:
        if re.search(v_pat, text_lower):
            villains.add(v_name)
    villain_count = len(villains)

    problem_mentions_positions = [(m.start(), m.group()) for m in re.finditer(r'(cost|lose|waste|fail|risk|damage|breach|hurt|expensive|hours|frustrat|nightmare|overwhelm)', text_lower)]
    stakes_escalation = 0
    if len(problem_mentions_positions) >= 3:
        positions = [p[0]/max(1, len(text_lower)) for p in problem_mentions_positions]
        if positions[-1] > positions[0] + 0.15:
            stakes_escalation = 1
    elif len(problem_mentions_positions) >= 2:
        positions = [p[0]/max(1, len(text_lower)) for p in problem_mentions_positions]
        if positions[-1] > positions[0] + 0.25:
            stakes_escalation = 1

    transformation_promise = 1 if re.search(r'(go from .* to|become (a |someone|the )|transform (how|the way|your)|never again|reimagine|change the way|revolution|turn .* into|convert .* into)', text_lower) else 0

    tp_match = re.search(r'(go from .* to|become|transform|never again|reimagine|change the way|revolution|turn .* into)', text_lower)
    transformation_position = round(tp_match.start() / max(1, len(text_lower)), 2) if tp_match else -1.0

    # pivot_sharpness (1-5) — improved detection
    pivot_sharpness = 2  # default
    sharp_pivots = re.search(r'(so we built|that\'s why we|introducing\b|meet \w|enter \w)', text_lower)
    medium_pivots = re.search(r'(that\'s (what|where)|here\'s (how|where|what)|now (you can|with)|this is where|and so we)', text_lower)

    if sharp_pivots:
        before = text_lower[:sharp_pivots.start()]
        has_problem = any(w in before for w in problem_words[:15])
        if has_problem:
            pivot_sharpness = 5 if re.search(r'(so we built|that\'s why we (built|created))', text_lower) else 4
        else:
            pivot_sharpness = 3
    elif medium_pivots:
        before = text_lower[:medium_pivots.start()]
        has_problem = any(w in before for w in problem_words[:15])
        if has_problem:
            pivot_sharpness = 3
        else:
            pivot_sharpness = 2
    elif narrative_arc in ("problem_solution",):
        pivot_sharpness = 3
    elif narrative_arc == "solution_first":
        pivot_sharpness = 1
    elif narrative_arc == "neutral_flat":
        pivot_sharpness = 1

    nested_stories = 1 if re.search(r'(one of our (users|customers|clients)|for example .*(he|she|they)|let me share|case study|meet \w+[,.]? (like|she|he)|a (customer|user|team) .*(was|had|used)|jenny|brian|casey|jake|jane)', text_lower) else 0

    temporal_anchors = count_pattern(text, [r'\b\d+\s*(years?|months?|weeks?|days?|hours?|minutes?|seconds?)\b',
                                            r'\b(last (quarter|year|month|week))\b', r'\b(in \d+ (seconds?|minutes?))\b',
                                            r'\b(\d+ years? ago|months? ago)\b', r'\brecently\b', r'\b(today|yesterday)\b'])

    imagine_device = count_pattern(text, [r'\bimagine\b', r'\bpicture this\b', r'\bwhat if you could\b',
                                          r'\bthink about (what|how)\b', r'\benvision\b', r'\bwhat would it (feel|be) like\b',
                                          r'\bwhat if there\b', r'\bwhat if you\b'])

    cliffhanger_beats = count_pattern(text, [r'(but here\'s the thing|and then something|wait until you see|the best part|you won\'t believe|but wait|here\'s where|and it gets better|but that\'s not all|there\'s more|but for|guess what|and guess what)'])

    why_now = 1 if re.search(r'(now that|thanks to (ai|new|recent)|finally possible|for the first time|the (rise|emergence|advent) of|in (today|this).*(era|age|world)|ai (has|is)|with ai|generative ai)', text_lower) else 0

    journey_markers = count_pattern(text, [r'(take you from|journey|step.by.step|walk you through|guide you|along the way|path to|from .* to|process)'])
    destination_markers = count_pattern(text, [r'(the solution|your (platform|tool|answer)|all.in.one|everything you need|one.stop|single (platform|tool))'])
    journey_vs_destination = round(journey_markers / max(1, journey_markers + destination_markers), 2)

    if len(sentences) >= 4:
        open_tone = ' '.join(sentences[:2]).lower()
        close_tone = ' '.join(sentences[-2:]).lower()
        open_neg = any(w in open_tone for w in ['problem', 'struggle', 'tired', 'frustrated', 'challenge', 'difficult', 'boring', 'tedious', 'broken'])
        open_quest = '?' in sentences[0]
        close_pos = any(w in close_tone for w in ['try', 'start', 'free', 'today', 'love', 'excited', 'join', 'ready', 'thank', 'get started'])
        emotional_bookend_match = 1 if ((open_neg or open_quest) and close_pos) else 0
    else:
        emotional_bookend_match = 0

    unsaid_problem = count_pattern(text, [r'(you know that feeling|we\'ve all been there|sound familiar|you know how it is|we all know|you\'ve been there|how many times have you|notice how)'])

    if total_prob > 0:
        resolution_completeness = round(min(1.0, total_sol / max(1, total_prob)), 2)
    else:
        resolution_completeness = 1.0 if total_sol > 0 else 0.5

    if sentence_count <= 3:
        story_compression = 2.0
    elif temporal_anchors >= 4 and sentence_count < 20:
        story_compression = 5.0
    elif temporal_anchors >= 3:
        story_compression = 4.0
    elif temporal_anchors >= 1:
        story_compression = 3.0
    else:
        story_compression = 2.0

    # --- B. Emotional Mechanics (17 dims) ---

    specific_emotion_markers = count_pattern(text, [
        r'(sinking feeling|rush when|that moment when|at 2am|on a friday|in a meeting|watching everyone)',
        r'(staring at|scrolling through|waiting for|pulling)',
        r'(remember the (time|feeling)|picture yourself)',
        r'(sitting in|working late|every damn day|counting sheep|tooth and nail|bloody digital chaos)',
        r'(I was .*(frustrated|tired|struggling|sitting|working))',
        r'(look .* before|I\'ve seen this look)',
        r'(rude awakening|felt like)'
    ])
    if specific_emotion_markers >= 3:
        emotion_specificity = 5
    elif specific_emotion_markers >= 2:
        emotion_specificity = 4
    elif specific_emotion_markers >= 1:
        emotion_specificity = 3
    elif negative_words_count >= 2 or positive_words >= 3:
        emotion_specificity = 2
    else:
        emotion_specificity = 1

    first_problem_match = re.search(r'(problem|challenge|struggle|frustrated|tired|difficult|overwhelming|tedious|boring|chaos|hassle|waste|hard|broken|messy)', text_lower)
    first_solution_match = re.search(r'(introducing|solution|meet |built |created |our (tool|platform|product)|that\'s (why|what)|with \w+ you)', text_lower)
    if first_problem_match and first_solution_match and first_solution_match.start() > first_problem_match.start():
        between = text[first_problem_match.start():first_solution_match.start()]
        relief_distance = max(1, len(get_sentences(between)))
    else:
        relief_distance = 0

    pride_trigger = count_pattern(text, [r'(you already know|as a \w+ you understand|smart teams|you\'re the kind of|savvy|sophisticated|as developers we|professional|experts like you)'])
    fomo_construction = count_pattern(text, [r'(competitors? (are|is) already|market is moving|everyone is switching|don\'t get left behind|your competitor|while you\'re still|others are already|leading companies|the future is here|stay ahead)'])

    empathy_firsthand = 1 if re.search(r'(i (spent|had to|used to|struggled|was frustrated|experienced|was the|was working|hated)|we (experienced|lived|went through|had to|were|got)|when i was|my own|personally|biggest issues?\s+i (had|faced)|i was .*(frustrated|stuck|struggling|sifting|dealing|fighting)|i (had|have) always been|i discovered|i didn\'t\s+have|was a real pain|i was in a)', text_lower) else 0
    empathy_observed = 1 if re.search(r'(teams struggle|developers spend|companies waste|users (face|struggle)|people (spend|waste)|organizations (struggle|face)|approximately \d+% of|brands .* face|businesses .* struggle)', text_lower) else 0

    frust_map = {
        'time': r'(waste time|hours spent|time.consuming|slow|takes? (hours|weeks))',
        'complexity': r'(complex|complicated|overwhelming|confusing)',
        'cost': r'(expensive|costly|burning|overpriced|price|set .* back|hole in .* pocket)',
        'fragmentation': r'(fragment|scattered|multiple (tools|tabs)|silos|juggling|between tabs)',
        'manual': r'(manual|repetitive|tedious|boring|by hand)',
        'errors': r'(error|mistake|bug|inaccurat|broken link)',
        'frustration': r'(frustrat|annoying|painful|hate|sick of|tired of)',
        'overwhelm': r'(overwhelm|too (many|much)|endless|flood|sifting)',
        'inefficiency': r'(inefficien|unproductive|clunky|slow|hassle)',
    }
    frustration_concepts = set()
    for concept, pattern in frust_map.items():
        if re.search(pattern, text_lower):
            frustration_concepts.add(concept)
    frustration_vocabulary_breadth = len(frustration_concepts)

    if pivot_sharpness >= 4:
        joy_velocity_shift = 4
    elif pivot_sharpness == 3:
        joy_velocity_shift = 3
    elif frustration_vocabulary_breadth >= 2:
        joy_velocity_shift = 3
    else:
        joy_velocity_shift = 2
    if re.search(r'(boom|just like that|instantly|in seconds|magic)', text_lower) and pivot_sharpness >= 3:
        joy_velocity_shift = min(5, joy_velocity_shift + 1)

    vulnerability_moment = 1 if re.search(r'(first version was|almost gave up|not perfect|got this wrong|made mistakes|we failed|honestly|we were wrong|rude awakening|I can\'t believe|we didn\'t)', text_lower) else 0

    anticipatory_emotion = count_pattern(text, [r'(wait until you see|you\'re going to love|here\'s the (exciting|cool|fun) part|watch this|check this out|let me show you|I\'m excited to show|I\'m going to show|can\'t wait|excited to (share|show|present|announce|introduce)|let me show|so excited)'])

    social_belonging = count_pattern(text, [r'(join \d+|community of|thousands of (teams|users|developers)|you\'re in good company|fellow (founders|developers|builders|creators)|part of|tribe)'])

    loss_markers = count_pattern(text, [r'(you\'re losing|wasting|missing out|falling behind|leaving money|throwing away|every day you don\'t|costing you|set you back|losing \$|losing time)'])
    gain_markers = count_pattern(text, [r'(save|gain|earn|boost|increase|grow|improve|get more|profit|maximize)'])
    loss_aversion_framing = round(loss_markers / max(1, loss_markers + gain_markers), 2)

    surprise_delight = count_pattern(text, [r'(oh and it also|bonus|did I mention|cherry on top|and the best part|oh wait|on top of that|and there\'s more|what\'s more|not only.*but also|and it gets better|but that\'s not all)'])

    # confidence_gradient
    first_half = text_lower[:len(text_lower)//2]
    second_half = text_lower[len(text_lower)//2:]
    uncertain_first = sum(1 for w in ['might', 'maybe', 'perhaps', 'could', 'think'] if w in first_half)
    certain_second = sum(1 for w in ['will', 'definitely', 'proven', 'guaranteed', 'ensure'] if w in second_half)
    if uncertain_first > 0 and certain_second > 0:
        confidence_gradient = 5
    elif certain_second > uncertain_first:
        confidence_gradient = 4
    elif certain_second > 0 or uncertain_first == 0:
        confidence_gradient = 3
    else:
        confidence_gradient = 2

    if frustration_vocabulary_breadth >= 3 and positive_words >= 3:
        emotional_contrast_ratio = 5
    elif frustration_vocabulary_breadth >= 2 and positive_words >= 2:
        emotional_contrast_ratio = 4
    elif frustration_vocabulary_breadth >= 1 and positive_words >= 1:
        emotional_contrast_ratio = 3
    elif negative_words_count > 0 or positive_words > 0:
        emotional_contrast_ratio = 2
    else:
        emotional_contrast_ratio = 1

    finally_signal = count_pattern(text, [r'\b(finally|at last|no more|never again|say goodbye to|the wait is over|put an end to|stop .*and start|for the first time)\b'])

    empathy_score = 0
    if empathy_firsthand: empathy_score += 2
    if empathy_observed: empathy_score += 1
    if emotion_specificity >= 3: empathy_score += 1
    if frustration_vocabulary_breadth >= 2: empathy_score += 1
    if inciting_incident: empathy_score += 1
    empathy_depth = min(5, max(1, empathy_score))

    # --- C. Product Presentation (17 dims) ---

    if feature_list_markers > 8 and word_count < 300:
        feature_intro_velocity = 1
    elif feature_list_markers > 6:
        feature_intro_velocity = 2
    elif feature_list_markers > 4:
        feature_intro_velocity = 3
    elif feature_list_markers > 2:
        feature_intro_velocity = 4
    else:
        feature_intro_velocity = 5 if word_count > 100 else 3

    if feature_words > 0:
        orphaned_features = round(max(0, 1 - (benefit_words / max(1, feature_words * 1.5))), 2)
        orphaned_features = min(1.0, max(0.0, orphaned_features))
    else:
        orphaned_features = 0.0

    demo_voice_present_tense = 1 if re.search(r'(I click|I\'m clicking|watch as I|see how it|I drag|I type|I select|I can|let me|here I|I\'m going to|I\'ll just|I can just)', text_lower) else 0

    concrete_markers = len(re.findall(r'\b\d+\b', clean_text)) + count_pattern(text, [r'(click|tap|drag|type|select|upload|download)',
                                            r'(screenshot|page|button|field|tab|menu|dashboard|popup)',
                                            r'(\$\d+|\d+%|\d+ (minutes?|seconds?|hours?))'])
    abstract_markers = count_pattern(text, [r'(powerful|seamless|innovative|robust|scalable|enterprise.grade|world.class|cutting.edge|state.of.the.art|comprehensive|holistic)'])
    if concrete_markers > abstract_markers * 4:
        concrete_vs_abstract = 5
    elif concrete_markers > abstract_markers * 2:
        concrete_vs_abstract = 4
    elif concrete_markers > abstract_markers:
        concrete_vs_abstract = 3
    elif abstract_markers > concrete_markers:
        concrete_vs_abstract = 2
    else:
        concrete_vs_abstract = 3

    wow_patterns = r'(boom|just like that|watch this|look at that|in seconds|instantly|amazing|incredible|wow|beautiful|voila|there you go|that\'s it|magic|there we go|brilliant)'
    wow_matches = [(m.start() / max(1, len(text_lower))) for m in re.finditer(wow_patterns, text_lower)]
    magic_moment_position = round(max(wow_matches), 2) if wow_matches else 0.5

    speed_claims = count_pattern(text, [r'(in (seconds?|minutes?|a (few )?(seconds?|minutes?|clicks?))|instantly|real.time|10x faster|\dx faster|lightning|blazing|rapid(ly)?|within (seconds?|minutes?)|in (one|a single) click)'])

    effort_reduction_specific = 1 if re.search(r'(what (took|takes) \d+.*now (takes?|in)|from \d+ (steps?|hours?|minutes?).*to \d+|\d+x (faster|less|fewer)|reduce(s|d)? \d+.*to \d+|30 seconds|5 minutes|in minutes)', text_lower) else 0
    effort_reduction_vague = 1 if re.search(r'(saves? time|easier|simpler|streamline|simplif|effortless|hassle.free|without the hassle|minus the hassle|no more.*manual)', text_lower) else 0

    integration_list_check = ['slack', 'notion', 'zapier', 'github', 'salesforce', 'hubspot', 'stripe', 'jira',
                        'google', 'gmail', 'chrome', 'figma', 'asana', 'trello', 'airtable', 'monday',
                        'clickup', 'discord', 'whatsapp', 'telegram', 'teams', 'zoom', 'linkedin',
                        'twitter', 'facebook', 'instagram', 'youtube', 'tiktok', 'shopify', 'wordpress',
                        'mailchimp', 'sendgrid', 'twilio', 'aws', 'azure', 'vercel', 'netlify',
                        'pipedrive', 'intercom', 'zendesk', 'freshdesk', 'loom', 'dropbox', 'quora']
    integration_count = sum(1 for integ in integration_list_check if re.search(r'\b' + re.escape(integ) + r'\b', text_lower))

    progressive_disclosure = 0
    if re.search(r'(basic|simple|getting started|first|start with|begin)', first_third) and re.search(r'(advanced|power|pro|enterprise|beyond|further|more powerful)', last_third):
        progressive_disclosure = 1

    one_more_thing = 1 if re.search(r'(one more thing|but wait|there\'s more|bonus|oh and|cherry on top|and the best part|but that\'s not all|and it gets better)', last_third) else 0

    simplicity_signals = count_pattern(text, [r'\b(simple|easy|intuitive|no.?learning curve|one.click|drag.and.drop|effortless|seamless|straightforward|no.?code|no.?setup)\b',
                                               r'\bjust (click|drag|connect|type|tap|press|select|upload|add|enter|paste|hit|open)\b'])

    under_the_hood = 1 if re.search(r'(built on|powered by|uses? (gpt|vector|neural|transformer|llm)|architecture|under the hood|tech stack|engineered|fine.tuning|open.?source|proprietary)', text_lower) else 0

    persona_patterns_found = set()
    for p_name, p_pat in [('developer', r'(developer|engineer|coder)'), ('designer', r'(designer)'),
                           ('marketer', r'(marketer|marketing)'), ('founder', r'(founder|entrepreneur|startup)'),
                           ('pm', r'(product manager|pm\b)'), ('sales', r'(\bsales\b|revenue|seller)'),
                           ('enterprise', r'(enterprise)'), ('creator', r'(creator|influencer|content creator)'),
                           ('student', r'(student|learner)'), ('freelancer', r'(freelancer|solo)'),
                           ('publisher', r'(publisher|brand)'), ('agency', r'(agency|agencies)')]:
        if re.search(p_pat, text_lower):
            persona_patterns_found.add(p_name)
    use_case_count = max(1, len(persona_patterns_found))

    live_markers = count_pattern(text, [r'(I\'m (clicking|going to|typing|just)|let me|right here|as you can see|let\'s see|right now|watch me|I can just|I\'ll just|here we go|there we go|let\'s go)'])
    if live_markers >= 6:
        liveness_score = 5
    elif live_markers >= 4:
        liveness_score = 4
    elif live_markers >= 2:
        liveness_score = 3
    elif production_markers >= 3 or speaker_changes >= 2:
        liveness_score = 1
    else:
        liveness_score = 2

    onboarding_time_claim = 1 if re.search(r'(up and running in|deploy in|start in|set up in|minutes to (setup|start|deploy)|(5|10|30|few|2|3) (minutes?|seconds?).*set|get.*started.*minutes|in minutes)', text_lower) else 0

    comparison_moment = 1 if re.search(r'(here\'s the old way|on the left.*on the right|before.*after|side by side|compare|old way.*new way|traditional.*vs|this is what most|same name.*different)', text_lower) else 0

    # --- D. Wording & Rhetoric (16 dims) ---

    punchy_verbs = count_pattern(text, [r'\b(ship|crush|build|launch|deploy|boost|slash|nail|ace|rock|smash|blast|power|fuel|fire|drop|grab|craft|kick|roll|dive|conquer)\b'])
    corporate_verbs = count_pattern(text, [r'\b(utilize|facilitate|leverage|enable|empower|optimize|streamline|implement|execute|maintain|orchestrat)\b'])
    if punchy_verbs > corporate_verbs * 2:
        verb_energy = 5
    elif punchy_verbs > corporate_verbs:
        verb_energy = 4
    elif punchy_verbs == corporate_verbs and punchy_verbs > 0:
        verb_energy = 3
    elif corporate_verbs > punchy_verbs * 2:
        verb_energy = 1
    elif corporate_verbs > punchy_verbs:
        verb_energy = 2
    else:
        verb_energy = 3

    if len(sentences) >= 4:
        sent_lengths = [len(get_words(s)) for s in sentences]
        avg_len = sum(sent_lengths) / len(sent_lengths)
        variance = sum((l - avg_len) ** 2 for l in sent_lengths) / len(sent_lengths)
        std_dev = math.sqrt(variance)
        if std_dev > 12:
            sentence_rhythm_variance = 5
        elif std_dev > 8:
            sentence_rhythm_variance = 4
        elif std_dev > 5:
            sentence_rhythm_variance = 3
        elif std_dev > 2:
            sentence_rhythm_variance = 2
        else:
            sentence_rhythm_variance = 1
    else:
        sentence_rhythm_variance = 1

    power_words_count = count_pattern(text, [r'\b(free|instant|proven|exclusive|guaranteed|unlimited|breakthrough|secret|powerful|ultimate|essential|incredible|massive|revolutionary|amazing|supercharg)\b'])
    if power_words_count >= 8:
        power_word_cluster_density = 5
    elif power_words_count >= 5:
        power_word_cluster_density = 4
    elif power_words_count >= 3:
        power_word_cluster_density = 3
    elif power_words_count >= 1:
        power_word_cluster_density = 2
    else:
        power_word_cluster_density = 1

    jargon_total = count_pattern(text, [r'\b(api|sdk|saas|b2b|b2c|crm|erp|roi|kpi|ml\b|nlp|llm|ux|ui|ci.?cd|devops|microservice|serverless|kubernetes|docker|terraform|webhook|endpoint|smtp|cicd|vector|embedding|neural)\b'])
    if jargon_total == 0:
        jargon_distribution_shape = "minimal"
    else:
        jargon_first = count_pattern(first_third, [r'\b(api|sdk|saas|crm|ml|llm|ai|smtp|ux|ui)\b'])
        jargon_mid = count_pattern(mid_third, [r'\b(api|sdk|saas|crm|ml|llm|ai|smtp|ux|ui)\b'])
        jargon_last = count_pattern(last_third, [r'\b(api|sdk|saas|crm|ml|llm|ai|smtp|ux|ui)\b'])
        if jargon_first > jargon_mid and jargon_first > jargon_last:
            jargon_distribution_shape = "front_heavy"
        elif jargon_last > jargon_first and jargon_last > jargon_mid:
            jargon_distribution_shape = "back_heavy"
        elif jargon_mid > jargon_first and jargon_mid > jargon_last:
            jargon_distribution_shape = "middle_heavy"
        else:
            jargon_distribution_shape = "even"

    anaphora_count = 0
    for i in range(1, len(sentences)):
        w_prev = get_words(sentences[i-1])
        w_curr = get_words(sentences[i])
        if w_prev and w_curr and w_prev[0] == w_curr[0] and w_prev[0] not in ('the', 'a', 'an', 'it', 'this', 'that', 'and', 'but', 'so', 'i', 'we'):
            anaphora_count += 1
    anaphora_count += len(re.findall(r'(no more \w+[.\s]+no more|you can \w+[.\s]+you can \w+|we choose[.\s]+we choose)', text_lower))

    just_minimizer = len(re.findall(r'\bjust (click|drag|connect|type|tap|press|select|upload|add|enter|paste|hit|open|drop|pick|set|plug|ask|start|choose|answer|go|send|put)', text_lower))

    superlatives = count_pattern(text, [r'\b(best|most|fastest|easiest|only|first|#1|number one|top|biggest|largest|smallest|cheapest|richest|greatest)\b'])
    superlative_density = round(superlatives / word_count * 100, 2)

    qa_pairs = len(re.findall(r'\?\s*(yes|no|simple|exactly|well|it\'s|that\'s|three things|here\'s how|the answer|absolutely|of course)', text_lower))

    sophisticated_transitions = count_pattern(text, [r'(here\'s where|but the real|the best part|now here\'s|and this is where|what makes this|the beauty of|the magic is|here\'s the (thing|kicker|cool part))'])
    basic_transitions_count = count_pattern(text, [r'\b(and|also|so|but|then|next|plus)\b'])
    if sophisticated_transitions >= 3:
        transition_sophistication = 5
    elif sophisticated_transitions >= 2:
        transition_sophistication = 4
    elif sophisticated_transitions >= 1:
        transition_sophistication = 3
    elif basic_transitions_count > 5:
        transition_sophistication = 2
    else:
        transition_sophistication = 1

    negation_as_benefit = count_pattern(text, [r'(no \w+ (needed|required|necessary)|without \w+|zero (setup|config|code|cost)|never worry|eliminat|no need to|don\'t have to|no more|no (coding|code|design) (required|needed)|no credit card)'])

    specific_numbers = number_count + len(re.findall(r'(\$\d+|\d+%|\d+ (users|customers|minutes|seconds|hours|days))', text_lower))
    if specific_numbers >= 12:
        specificity_index = 5
    elif specific_numbers >= 7:
        specificity_index = 4
    elif specific_numbers >= 3:
        specificity_index = 3
    elif specific_numbers >= 1:
        specificity_index = 2
    else:
        specificity_index = 1

    you_insertion_rate = round(you_count / word_count * 100, 2)

    cliche_list = ['game.changer', 'one.stop shop', 'seamless', 'frictionless', 'empower', 'unlock',
                   'leverage', 'reimagine', 'disrupt', 'synergy', 'paradigm', 'next.level',
                   'take .* to the next level', 'best.in.class', 'world.class']
    cliche_count_val = sum(1 for c in cliche_list if re.search(c, text_lower))

    conditional_count = count_pattern(text, [r'(if you (need|want|have|are)|whether you|in case you|when you (need|want)|\bif your\b)'])
    conditional_density = round(conditional_count / word_count * 100, 2)

    parallel_structure = len(re.findall(r'(\w+er\.\s+\w+er\.|\w+ faster.*\w+ smarter|build \w+\.\s*ship \w+)', text_lower))
    parallel_structure += len(re.findall(r'(\w+,\s+\w+,\s+and \w+)', text_lower))

    imperative_count = 0
    imperative_verbs = ['try', 'start', 'sign', 'join', 'visit', 'check', 'get', 'click', 'download',
                         'book', 'explore', 'discover', 'create', 'build', 'stop', 'imagine', 'experience',
                         'boost', 'transform', 'connect', 'automate', 'meet', 'say', 'unlock', 'master',
                         'break', 'dive', 'ready', 'hire', 'set', 'pick', 'navigate', 'enjoy']
    for s in sentences:
        s_words = get_words(s)
        if s_words and s_words[0] in imperative_verbs:
            imperative_count += 1
    imperative_density = round(imperative_count / word_count * 100, 2)

    # --- E. Persuasion Psychology (17 dims) ---

    rare_words_count = count_pattern(text, [r'\b(meticulous|orchestrat|paradigm|ubiquitous|ephemeral|dichotomy|myriad|quintessential|juxtaposition|arbitr|nuanc|bespoke|curated|holistic|agnostic|esoteric|proprietary|apocalyptic|maelstrom|autonomously)\b'])
    if rare_words_count >= 3:
        word_rarity_score = 5
    elif rare_words_count >= 2:
        word_rarity_score = 4
    elif rare_words_count >= 1:
        word_rarity_score = 3
    elif syllable_density > 1.6:
        word_rarity_score = 2
    else:
        word_rarity_score = 1

    qualifying_retreat = count_pattern(text, [r'(the best.{0,15}(well|or at least|one of)|revolutionary.{0,15}(or at least|or maybe)|the only.{0,15}well|fastest.{0,15}(or maybe|well))'])

    last_sent = sentences[-1].lower() if sentences else ""
    if re.search(r'(try it|sign up|get started|visit|start your|today|now|\.com|\.io)', last_sent) and len(last_sent.split()) < 15:
        conclusive_finality = 5
    elif re.search(r'(try it|sign up|get started|visit|download|start)', last_sent):
        conclusive_finality = 4
    elif re.search(r'(thank|thanks|bye|cheers|see you)', last_sent):
        conclusive_finality = 3
    elif re.search(r'(so yeah|that\'s it|that\'s all|anyway|yeah)', last_sent):
        conclusive_finality = 1
    else:
        conclusive_finality = 2

    proof_positions = {}
    num_match = re.search(r'\b\d+[,.]?\d*\s*(users|customers|companies|teams)', text_lower)
    brand_match_sp = re.search(r'\b(' + '|'.join(known_brands[:20]) + r')\b', text_lower)
    quote_match = re.search(r'(".*?"|\bsaid\b|\btestimonial\b)', text_lower)
    if num_match: proof_positions['numbers_first'] = num_match.start()
    if brand_match_sp: proof_positions['brands_first'] = brand_match_sp.start()
    if quote_match: proof_positions['quotes_first'] = quote_match.start()
    social_proof_stacking_order = min(proof_positions, key=proof_positions.get) if proof_positions else "none"

    if has_credential and re.search(r'(ex-|former |google|meta|amazon|microsoft|phd|doctorate)', text_lower):
        authority_type = "technical"
    elif success_users > 0 and has_credential:
        authority_type = "mixed"
    elif success_users > 0:
        authority_type = "market"
    elif re.search(r'(\d+ years|decade|veteran|experienced)', text_lower):
        authority_type = "domain"
    elif has_credential:
        authority_type = "technical"
    else:
        authority_type = "none"

    reciprocity_trigger = 1 if re.search(r'(free (tier|plan|trial|version|forever|to use)|open.?source|no credit card|free template|completely free|100% free|\bfree\b.*today)', text_lower) else 0
    anchor_contrast_pricing = 1 if re.search(r'(\$\d+.{0,30}\$\d+|cost \$\d+.{0,20}we.re \$\d+|comparable.*\$\d+.*free|up to \$\d+.*free|per month.*free|set you back.*\$\d+.*free)', text_lower) else 0

    contrast_pairs = count_pattern(text, [r'(instead of|not \w+ but|unlike|while others|rather than|versus|traditional.*vs|old way.*new way|not just.*but)'])

    certain_words = count_pattern(text, [r'\b(will|always|definitely|guaranteed|proven|ensure|certainly|every|never)\b'])
    uncertain_words = count_pattern(text, [r'\b(might|maybe|perhaps|probably|could|possibly|sometimes)\b'])
    certainty_ratio = round(certain_words / max(1, certain_words + uncertain_words), 2)

    in_group_language = count_pattern(text, [r'(as (developers|founders|marketers|designers|engineers) we|fellow (founders|developers|builders|creators)|if you\'re like (us|me)|we\'ve all been there|as a (developer|founder|designer|marketer)|you know how it)'])

    objection_preempt = count_pattern(text, [r'(you might be wondering|and yes|don\'t worry|no need to worry|rest assured|you\'re probably thinking|but what about|and before you ask|works offline|no.*required|compatible with)'])

    if re.search(r'(today only|this week|limited time|for a limited|won\'t last forever)', text_lower):
        scarcity_type = "time"
    elif re.search(r'(limited spots|only \d+ (spots|seats|slots)|selling out|like hot cakes)', text_lower):
        scarcity_type = "quantity"
    elif re.search(r'(invite only|exclusive access|early access|beta access)', text_lower):
        scarcity_type = "access"
    elif re.search(r'(the only (tool|platform)|only solution|only product|first .* to)', text_lower):
        scarcity_type = "capability"
    else:
        scarcity_type = "none"

    number_mentions_bw = [(m.start(), m.group()) for m in re.finditer(r'\b(\d+[,.]?\d*)\s*(users|customers|companies|teams|people|businesses)', text_lower)]
    bandwagon_gradient = 0
    if len(number_mentions_bw) >= 2:
        try:
            nums = [int(re.search(r'\d+', nm[1]).group()) for nm in number_mentions_bw]
            if nums[-1] > nums[0]:
                bandwagon_gradient = 1
        except:
            pass

    pricing_tiers = count_pattern(text, [r'(free plan|pro plan|enterprise|basic plan|premium|starter|professional|business plan|tier)'])
    choice_architecture = min(3, pricing_tiers) if pricing_tiers > 0 else 0

    cognitive_ease = count_pattern(text, [r'(one.click|automatic(ally)?|zero (config|setup|code)|plug and play|set it and forget|instant(ly)?|no.brainer|out of the box|drag.and.drop|in a (click|tap|snap)|without (any |coding|writing)|a few clicks|few clicks|couple of clicks)'])

    everyone_else_maneuver = count_pattern(text, [r'(most teams already|industry standard|your competitors|leading companies|top companies|enterprises use|thousands of|millions of|everyone is|67% of organizations)'])

    future_self_projection = count_pattern(text, [r'(you\'ll become|imagine yourself|be the one who|your future self|become a better|transform (yourself|your)|take your .* to the next|become someone|inner superhero)'])

    # --- F. Structure & Timing (16 dims) ---

    words_first = len(get_words(first_third))
    words_mid = len(get_words(mid_third))
    words_last = len(get_words(last_third))
    if words_first > words_last * 1.3 and words_first > words_mid:
        info_density_shape = "front_loaded"
    elif words_last > words_first * 1.3 and words_last > words_mid:
        info_density_shape = "back_loaded"
    elif words_mid > words_first * 1.1 and words_mid > words_last * 1.1:
        info_density_shape = "middle_peak"
    else:
        info_density_shape = "even"

    if word_count < 80:
        breathing_room = 5
    elif avg_sentence_length > 25:
        breathing_room = 1
    elif avg_sentence_length > 20:
        breathing_room = 2
    elif avg_sentence_length > 15:
        breathing_room = 3
    elif avg_sentence_length > 10:
        breathing_room = 4
    else:
        breathing_room = 4
    if feature_list_markers > 6 and breathing_room > 1:
        breathing_room -= 1

    product_mention_match = re.search(r'(introducing|meet |our (product|tool|platform|app|software)|we (built|created)|is a|called \w+)', text_lower)
    cold_open_words = len(get_words(text[:product_mention_match.start()])) if product_mention_match else min(word_count, 20)

    callback_count = count_pattern(text, [r'(remember (that|what|earlier|when)|going back to|I mentioned|as I (said|showed|mentioned)|this ties back|earlier I)'])

    if len(sentences) >= 4:
        quarter = max(1, len(sentences) // 4)
        section_sizes = []
        for i in range(4):
            start = i * quarter
            end = (i + 1) * quarter if i < 3 else len(sentences)
            section_sizes.append(sum(len(get_words(s)) for s in sentences[start:end]))
        avg_section = sum(section_sizes) / 4
        if avg_section > 0:
            cv = math.sqrt(sum((s - avg_section)**2 for s in section_sizes) / 4) / avg_section
            if cv > 0.5: section_length_cv = 5
            elif cv > 0.35: section_length_cv = 4
            elif cv > 0.2: section_length_cv = 3
            elif cv > 0.1: section_length_cv = 2
            else: section_length_cv = 1
        else:
            section_length_cv = 1
    else:
        section_length_cv = 1

    has_promise = 1 if re.search(r'(helps? you|allows? you|enables? you|you can|we (help|allow|enable)|solution for|designed to|built to|makes? it easy)', text_lower) else 0
    has_proof = 1 if (success_users > 0 or has_testimonial or brand_count > 1 or has_investor_mention) else 0
    has_push = 1 if closing_has_cta else 0
    promise_proof_push = float(has_promise + has_proof + has_push)

    feature_first_match = re.search(r'(feature|you can|allows you to|enables you|with .{2,20} you can|it (does|can|will)|our (tool|platform))', text_lower)
    first_feature_position = round(feature_first_match.start() / max(1, len(text_lower)), 2) if feature_first_match else 0.3

    parenthetical_credibility = count_pattern(text, [r'(by the way|oh and|incidentally|as it happens|fun fact|worth mentioning|I should mention)'])

    section_boundary_markers = count_pattern(text, [r'(number (one|two|three|four|five)|first(ly)?[,:]|second(ly)?[,:]|third(ly)?[,:]|next[,:]|finally[,:]|let\'s move on|the (second|third|fourth|last) (thing|feature)|step (one|two|three|\d)|\bmethod (one|two|three)\b)'])

    if question_count > 0 and qa_pairs > 0:
        setup_payoff_distance = 2.0
    elif question_count > 2 and qa_pairs == 0:
        setup_payoff_distance = 4.0
    elif question_count > 0 and qa_pairs == 0:
        setup_payoff_distance = 3.0
    elif relief_distance >= 4:
        setup_payoff_distance = 4.0
    elif relief_distance >= 2:
        setup_payoff_distance = 3.0
    else:
        setup_payoff_distance = 2.0

    multi_persona_address = len(persona_patterns_found)

    if pronoun_strategy in ("mostly_we", "mostly_you"):
        voice_consistency = 4
    elif pronoun_strategy == "neutral":
        voice_consistency = 5
    elif pronoun_strategy == "balanced":
        voice_consistency = 3
    else:
        voice_consistency = 3
    if speaker_changes >= 3:
        voice_consistency = max(1, voice_consistency - 2)
    elif speaker_changes >= 1:
        voice_consistency = max(1, voice_consistency - 1)

    counterfactual_count = count_pattern(text, [r'(what if you (didn\'t|could|don\'t)|without this you|imagine not having|if you don\'t|what would happen|what if there was|what if you changed)'])

    if len(sentences) >= 3:
        last_3_avg = sum(len(get_words(s)) for s in sentences[-3:]) / 3
        overall_avg = word_count / sentence_count
        if last_3_avg < overall_avg * 0.5:
            closing_velocity = 5
        elif last_3_avg < overall_avg * 0.7:
            closing_velocity = 4
        elif last_3_avg < overall_avg * 0.9:
            closing_velocity = 3
        elif last_3_avg < overall_avg * 1.2:
            closing_velocity = 2
        else:
            closing_velocity = 1
    else:
        closing_velocity = 2

    open_loop_closing = 1 if re.search(r'(this is just the beginning|much more to come|stay tuned|wait until you see|coming soon|exciting new features|in the (coming|next) (weeks|months)|we\'re just getting started|more to come)', last_sents) else 0
    definitive_closing = 1 if re.search(r'(try it today|get started now|sign up|visit .*\.(com|io|ai)|start your|download now|join us|\.com|\.io|\.ai|for free today|today for free)', last_sents) else 0

    return {
        "id": tid,
        "hook_type": hook_type,
        "first_person_opener": first_person_opener,
        "has_negative_opener": has_negative_opener,
        "first_sentence_words": first_sentence_words,
        "hook_quality": hook_quality,
        "word_count": word_count,
        "sentence_count": sentence_count,
        "avg_sentence_length": avg_sentence_length,
        "flesch_kincaid_grade": fk_grade,
        "word_diversity": word_diversity,
        "syllable_density": syllable_density,
        "pronoun_strategy": pronoun_strategy,
        "we_count": we_count,
        "you_count": you_count,
        "hedge_count": hedge_count,
        "filler_count": filler_count,
        "narrative_arc": narrative_arc,
        "topic_transitions": topic_transitions,
        "problem_pct": problem_pct,
        "solution_pct": solution_pct,
        "declining_arc": declining_arc,
        "number_count": number_count,
        "number_density": number_density,
        "metric_placement": metric_placement,
        "before_after_total": before_after_total,
        "success_users": success_users,
        "success_revenue": success_revenue,
        "success_cost_savings": success_cost_savings,
        "success_growth": success_growth,
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
        "category_creation_total": category_creation_total,
        "ai_count": ai_count,
        "ai_density": ai_density,
        "buzzword_count": buzzword_count,
        "primary_cta": primary_cta,
        "cta_position": cta_position,
        "has_discount": has_discount,
        "has_scarcity": has_scarcity,
        "has_pricing": has_pricing,
        "has_url": has_url,
        "closing_has_cta": closing_has_cta,
        "closing_has_thanks": closing_has_thanks,
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
        "passive_voice_count": passive_constructions,
        "sentiment": sentiment,
        "confidence_count": confidence_count,
        "product_name_repeats": product_name_repeats,
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
        "cliche_count": cliche_count_val,
        "conditional_density": conditional_density,
        "parallel_structure": parallel_structure,
        "imperative_density": imperative_density,
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
    import os
    base = '/Users/maxguillabert/Downloads/index'
    input_path = os.path.join(base, 'launch-video-analysis/ph/v2-llm-parts/input_batch_09.json')
    output_path = os.path.join(base, 'launch-video-analysis/ph/v2-llm-parts/output_batch_09.json')

    with open(input_path) as f:
        data = json.load(f)

    print(f"Processing {len(data)} transcripts...")
    results = []
    for i, item in enumerate(data):
        result = analyze_transcript(item)
        results.append(result)
        if (i + 1) % 10 == 0:
            print(f"  Processed {i + 1}/{len(data)}")

    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"Done. Wrote {len(results)} results to {output_path}")
    dim_count = len(results[0]) - 1  # minus "id"
    print(f"Dimensions per transcript: {dim_count}")


if __name__ == '__main__':
    main()
