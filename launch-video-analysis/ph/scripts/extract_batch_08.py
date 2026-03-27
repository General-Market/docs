#!/usr/bin/env python3
"""
Extract 200 dimensions from Product Hunt launch video transcripts.
Batch 08 — 85 transcripts.
Uses heuristic semantic analysis for all dimensions.
"""

import json
import re
import math
from collections import Counter

def count_syllables(word):
    word = word.lower().strip()
    if not word:
        return 0
    count = 0
    vowels = 'aeiouy'
    if word[0] in vowels:
        count += 1
    for i in range(1, len(word)):
        if word[i] in vowels and word[i-1] not in vowels:
            count += 1
    if word.endswith('e') and count > 1:
        count -= 1
    if word.endswith('le') and len(word) > 2 and word[-3] not in vowels:
        count += 1
    return max(count, 1)

def split_sentences(text):
    # Handle transcripts without punctuation by splitting on common patterns
    if '.' in text or '!' in text or '?' in text:
        sents = re.split(r'(?<=[.!?])\s+', text)
        sents = [s.strip() for s in sents if s.strip()]
        if len(sents) > 1:
            return sents
    # Fallback: split on common phrase boundaries for unpunctuated transcripts
    # Use approximate sentence splitting
    parts = re.split(r'\s+(?:so|and then|but|however|also|now|then|next|first|second|finally|alright|all right|okay|well|um|uh)\s+', text, flags=re.IGNORECASE)
    if len(parts) < 3:
        # Split roughly every 20 words
        words = text.split()
        parts = []
        for i in range(0, len(words), 20):
            parts.append(' '.join(words[i:i+20]))
    return [p.strip() for p in parts if p.strip()]

def get_words(text):
    return re.findall(r'[a-zA-Z\']+', text.lower())

def extract_dimensions(tid, transcript):
    text = transcript.strip()
    text_lower = text.lower()
    words = get_words(text)
    word_count = len(words)
    if word_count == 0:
        word_count = 1
    sentences = split_sentences(text)
    sentence_count = max(len(sentences), 1)

    first_sentence = sentences[0] if sentences else text[:100]
    first_words = get_words(first_sentence)
    last_quarter = text_lower[int(len(text_lower)*0.75):]
    first_quarter = text_lower[:int(len(text_lower)*0.25)]
    first_half = text_lower[:int(len(text_lower)*0.5)]
    second_half = text_lower[int(len(text_lower)*0.5):]
    mid_section = text_lower[int(len(text_lower)*0.25):int(len(text_lower)*0.75)]

    # ========== V1 DIMENSIONS ==========

    # --- Opening (6 dims) ---
    first_words_lower = ' '.join(first_words[:15])

    # hook_type
    if re.search(r'^(hi|hello|hey|welcome|what\'?s up|greetings)', first_words_lower):
        hook_type = "greeting"
    elif re.search(r'^(we\'?re excited|today we|i\'?m excited|we are launching|introducing|announcing|we just)', first_words_lower):
        hook_type = "announcement"
    elif re.search(r'\?', first_sentence):
        hook_type = "question"
    elif re.search(r'^(ever |have you ever|are you |do you |if you)', first_words_lower):
        hook_type = "pain_point"
    elif re.search(r'^(i |my name|i\'?m |we |our )', first_words_lower):
        if re.search(r'(built|started|founded|created|spent|was working)', first_words_lower):
            hook_type = "founder_story"
        else:
            hook_type = "founder_story"
    elif re.search(r'^(let me show|in this video|here|click|watch)', first_words_lower):
        hook_type = "demo_instruction"
    elif re.search(r'(the first|the only|the best|the most|the future|revolutionary)', first_words_lower):
        hook_type = "bold_claim"
    elif re.search(r'^\d|million|billion|percent|%', first_words_lower):
        hook_type = "stat_number"
    elif re.search(r'(overwhelmed|broken|tired|hate|frustrated|struggle|difficult|problem|chaos|pain)', first_words_lower):
        hook_type = "pain_point"
    elif re.search(r'^(here\'?s|this is|meet )', first_words_lower):
        hook_type = "product_statement"
    else:
        hook_type = "descriptive"

    # first_person_opener
    first_person_opener = 1 if re.match(r'^(i |i\'|we |we\'|my |our )', first_words_lower) else 0

    # has_negative_opener
    has_negative_opener = 1 if re.search(r'(broken|tired|hate|frustrated|problem|overwhelmed|struggle|difficult|chaos|pain|annoyed|confus|drag|stumble|fumble)', first_words_lower[:100]) else 0

    # first_sentence_words
    first_sentence_words = len(first_words)

    # hook_quality (1-5)
    hq = 2
    if hook_type in ("pain_point", "question", "bold_claim", "stat_number"):
        hq += 1
    if has_negative_opener:
        hq += 1
    if first_sentence_words < 15 and first_sentence_words > 3:
        hq += 1
    if re.search(r'(imagine|what if|ever dreamed|picture this)', first_words_lower):
        hq += 1
    hook_quality = min(max(hq, 1), 5)

    # --- Length & Readability (6 dims) ---
    avg_sentence_length = round(word_count / sentence_count, 1)

    unique_words = set(words)
    word_diversity = round(len(unique_words) / word_count, 3) if word_count > 0 else 0

    total_syllables = sum(count_syllables(w) for w in words)
    syllable_density = round(total_syllables / word_count, 2) if word_count > 0 else 0

    # Flesch-Kincaid Grade Level
    fk = 0.39 * (word_count / sentence_count) + 11.8 * (total_syllables / word_count) - 15.59
    flesch_kincaid_grade = round(max(fk, 1), 1)

    # --- Pronouns & Voice (5 dims) ---
    we_count = len(re.findall(r'\b(we|our|us)\b', text_lower))
    you_count = len(re.findall(r'\b(you|your|you\'re|you\'ll|you\'ve|yourself)\b', text_lower))

    if we_count > you_count * 1.5:
        pronoun_strategy = "mostly_we"
    elif you_count > we_count * 1.5:
        pronoun_strategy = "mostly_you"
    elif we_count + you_count < 5:
        pronoun_strategy = "neutral"
    else:
        pronoun_strategy = "balanced"

    hedge_count = len(re.findall(r'\b(maybe|perhaps|might|kind of|sort of|arguably|probably|possibly)\b', text_lower))
    filler_count = len(re.findall(r'\b(um|uh|like|basically|actually|literally|so yeah|you know)\b', text_lower))

    # --- Narrative Arc (5 dims) ---
    problem_words = len(re.findall(r'\b(problem|pain|struggle|difficult|hard|challenge|issue|broken|waste|lose|lost|tired|frustrated|overwhelming|annoying|tedious|cumbersome|chaos|confus|complicated|manual|hours|expensive|costly|slow)\b', text_lower))
    solution_words = len(re.findall(r'\b(solution|solve|fix|help|automat|easy|simple|fast|quick|instant|seamless|streamline|efficient|powerful|smart|intelligen|built|designed|created|introducing|platform|tool|app|product)\b', text_lower))

    problem_pct = round(min(problem_words / max(word_count, 1) * 500, 60), 1)
    solution_pct = round(min(solution_words / max(word_count, 1) * 500, 70), 1)

    # Detect arc
    first_third = text_lower[:len(text_lower)//3]
    last_third = text_lower[2*len(text_lower)//3:]
    prob_first = len(re.findall(r'\b(problem|pain|struggle|difficult|issue|broken|waste)\b', first_third))
    sol_first = len(re.findall(r'\b(solution|solve|fix|introducing|tool|platform)\b', first_third))

    # Detect if the opening section focuses on a problem
    has_problem_opening = bool(re.search(r'(overwhelm|struggle|pain|problem|frustrat|tired|broken|chaos|difficult|tedious|waste|annoy|confus|ever (felt|dreamed|tried|wondered)|have you ever|are you (tired|struggling|overwhelmed))', first_quarter))
    has_solution_intro = bool(re.search(r'(introducing|presenting|say hello|meet |we built|we created|here\'?s|that\'?s why we|so we built)', text_lower))

    if word_count < 60:
        narrative_arc = "too_short"
    elif has_problem_opening and has_solution_intro:
        narrative_arc = "problem_solution"
    elif has_problem_opening and problem_pct > problem_pct * 0.6:
        # Mostly problem focused with some solution
        if solution_pct > problem_pct * 0.5:
            narrative_arc = "problem_solution"
        else:
            narrative_arc = "problem_heavy"
    elif re.search(r'(users|customers|companies|teams|people)\s+(use|trust|love|rely)', first_third):
        narrative_arc = "traction_first"
    elif not has_problem_opening and has_solution_intro:
        narrative_arc = "solution_first"
    elif not has_problem_opening and re.search(r'(let me show|as you can see|click here|click on|here you can|I\'ll show)', text_lower):
        narrative_arc = "solution_first"
    elif problem_pct < 1 and solution_pct > 3:
        narrative_arc = "solution_first"
    else:
        narrative_arc = "neutral_flat"

    topic_transitions = max(1, len(re.findall(r'\b(now|next|also|another|furthermore|moving on|let\'?s|finally|secondly|first|but also|in addition|and then|the next|the second|the third|one more)\b', text_lower)) // 2)
    topic_transitions = min(topic_transitions, 12)

    declining_arc = 1 if re.search(r'(don\'t miss|hurry|limited|don\'t wait|before it\'s|sign up now|what are you waiting)', last_quarter) else 0

    # --- Metrics & Traction (8 dims) ---
    numbers = re.findall(r'\b\d[\d,]*\.?\d*\b', text)
    number_count = len(numbers)
    number_density = round(number_count / word_count * 100, 2) if word_count > 0 else 0

    # metric_placement
    nums_first = len(re.findall(r'\b\d[\d,]*\.?\d*\b', text[:len(text)//3]))
    nums_mid = len(re.findall(r'\b\d[\d,]*\.?\d*\b', text[len(text)//3:2*len(text)//3]))
    nums_last = len(re.findall(r'\b\d[\d,]*\.?\d*\b', text[2*len(text)//3:]))
    if number_count == 0:
        metric_placement = "none"
    elif nums_first >= nums_mid and nums_first >= nums_last:
        metric_placement = "front"
    elif nums_last >= nums_mid:
        metric_placement = "back"
    else:
        metric_placement = "middle"

    before_after_total = len(re.findall(r'(before|after|used to|now you|what took|compared to|instead of|went from|went to|from \d|to \d|rather than|old way|new way)', text_lower))

    success_users = len(re.findall(r'(\d[\d,]*\+?\s*(users|customers|teams|companies|people|businesses|clients|developers|creators|makers|organizations|members))', text_lower))
    success_revenue = len(re.findall(r'(\$[\d,]+|revenue|arr|mrr|gmv|sales)', text_lower))
    success_cost_savings = len(re.findall(r'(save|saving|saved|reduces? cost|cut cost|cheaper|less expensive|cost.?effective|free)', text_lower))
    success_growth = len(re.findall(r'(growth|grew|increase|doubled|tripled|10x|100x|x faster|times faster|percent increase|% increase|more engagement)', text_lower))

    # --- Social Proof (10 dims) ---
    brand_patterns = re.findall(r'\b(Google|Amazon|Meta|Facebook|Microsoft|Apple|Netflix|Slack|Notion|Jira|Zapier|GitHub|LinkedIn|Twitter|Shopify|Stripe|Vercel|AWS|Uber|Airbnb|Tesla|OpenAI|ChatGPT|GPT|Salesforce|HubSpot|Figma|Adobe|Chrome|Spotify|Instagram|TikTok|YouTube|Samsung|Snap|Pinterest|Confluence|Asana|Linear|Discord|WhatsApp|Intercom|Zendesk|Zoom|WordPress|Canva|Loom|Sourcegraph|Postman|Tinybird|Tremor)\b', text, re.IGNORECASE)
    brand_count = len(set(b.lower() for b in brand_patterns))

    has_investor_mention = 1 if re.search(r'(investor|funding|raised|venture|seed|series [a-d]|capital|backed by|investment)', text_lower) else 0
    has_testimonial = 1 if re.search(r'(said|told us|one user|customer.{0,20}said|testimonial|quote|"[^"]{10,}"|hear what|listen to what)', text_lower) else 0
    trusted_by = 1 if re.search(r'(trusted by|used by|loved by|relied on by|enjoyed by|chosen by)', text_lower) else 0
    has_partnership = 1 if re.search(r'(partner|partnership|collaborated|integration with|integrated with|working with)', text_lower) else 0
    has_credential = 1 if re.search(r'(ex-|former|previously at|decade|years of experience|phd|stanford|mit|harvard|yale|carnegie|berkeley|century of|from the likes of|worked at|alumni)', text_lower) else 0

    social_proof_claims = has_investor_mention + has_testimonial + trusted_by + has_partnership + has_credential + min(success_users, 3)

    platform_mentions = len(set(re.findall(r'\b(slack|notion|jira|zapier|github|gitlab|trello|asana|linear|figma|adobe|chrome|google drive|dropbox|confluence|hubspot|salesforce|stripe|shopify|wordpress|vercel|aws|gcp|azure|bitbucket|intercom|zendesk|freshdesk|monday|airtable|basecamp|clickup|miro|canva|mailchimp)\b', text_lower)))

    competitive_total = len(re.findall(r'(unlike|compared to|better than|instead of|while others|competitors|competitive|alternative to|replace|versus|vs\.?)', text_lower))
    replacement_total = len(re.findall(r'(replace|alternative to|goodbye to|say goodbye|no more|stop using|ditch|switch from|move from|instead of using)', text_lower))

    # --- Category & Positioning (4 dims) ---
    category_creation_total = len(re.findall(r'(the first|the only|a new kind|we invented|first ever|first of its kind|pioneering|world\'?s first|never been done|first platform|first tool|the future of|redefin)', text_lower))
    ai_count = len(re.findall(r'\b(ai|artificial intelligence|machine learning|ml|deep learning|neural|gpt|llm|large language model|nlp|natural language)\b', text_lower))
    ai_density = round(ai_count / word_count * 100, 2) if word_count > 0 else 0
    buzzword_count = len(re.findall(r'\b(revolutionary|game.?chang|cutting.?edge|disruptive|next.?gen|paradigm|synergy|innovative|groundbreaking|unprecedented|world.?class|state.?of.?the.?art|best.?in.?class|empower|unlock|leverage|reimagine|transform|superpower|mindblowing|mind.?blow|quantum.?leap|light.?years|catapult|revolutioniz|unleash|prowess|game changer)\b', text_lower))

    # --- CTA & Closing (8 dims) ---
    cta_patterns = {
        'waitlist': r'(waitlist|wait list|waiting list)',
        'join': r'(join us|join our|join the)',
        'sign_up': r'(sign up|signup|register|create.{0,10}account)',
        'try': r'(try it|give it a try|try now|try .{0,10} free|try .{0,10} today|try this|try out)',
        'get_started': r'(get started|start now|start your|get going)',
        'book_demo': r'(book a|schedule a|book demo|demo call)',
        'free': r'(free trial|for free|it\'?s free|completely free|start free)',
        'beta': r'(beta|early access)',
        'limited': r'(limited|exclusive|only \d+ spots)',
    }

    primary_cta = "none"
    # Check closing text first for CTA, then full text
    for cta_name, pattern in cta_patterns.items():
        if re.search(pattern, last_quarter):
            primary_cta = cta_name
            break
    if primary_cta == "none":
        for cta_name, pattern in cta_patterns.items():
            if re.search(pattern, text_lower):
                primary_cta = cta_name
                break
    # Fallback: detect "start" CTAs
    if primary_cta == "none" and re.search(r'(start (building|now|your|today)|download (now|the app|today)|check it out|head to|visit|tap now|don\'?t miss out)', last_quarter):
        primary_cta = "get_started"

    # cta_position
    has_cta_start = bool(re.search(r'(try|sign up|join|get started|download|check out)', first_quarter))
    has_cta_end = bool(re.search(r'(try|sign up|join|get started|download|check out|visit|head to|go to)', last_quarter))
    has_cta_mid = bool(re.search(r'(try|sign up|join|get started|download|check out)', mid_section))

    if primary_cta == "none":
        cta_position = "none"
    elif has_cta_end:
        cta_position = "end"
    elif has_cta_start:
        cta_position = "start"
    elif has_cta_mid:
        cta_position = "middle"
    else:
        cta_position = "end"

    has_discount = 1 if re.search(r'(discount|deal|offer|coupon|promo|% off|\d+% off|percent off|half.?price|special price)', text_lower) else 0
    has_scarcity = 1 if re.search(r'(limited|exclusive|only \d+|first \d+ |invite only|early access|spots left|don\'t miss|don\'t wait)', text_lower) else 0
    has_pricing = 1 if re.search(r'(\$\d|pricing|price|cost|per month|\/mo|per year|plan|subscription|tier|free plan|premium|pro plan|enterprise)', text_lower) else 0
    has_url = 1 if re.search(r'(\.com|\.io|\.ai|\.co|\.org|\.net|\.app|visit our|head to|go to|check out)', text_lower) else 0

    closing_text = ' '.join(sentences[-2:]) if len(sentences) >= 2 else sentences[-1] if sentences else ''
    closing_lower = closing_text.lower()
    closing_has_cta = 1 if re.search(r'(try|sign up|join|get started|download|check out|visit|head to|go to|start|don\'t miss|what are you waiting)', closing_lower) else 0
    closing_has_thanks = 1 if re.search(r'(thank|thanks|bye|goodbye|see you|cheers|appreciate|peace)', closing_lower) else 0

    # --- Content Signals (15 dims) ---
    storytelling = 1 if re.search(r'(one day|story|once upon|remember when|back when|there was a|I was|we were|last year|ago|I remember|let me tell|the other day|met|bumps? in|what\'?s the plan|hey are you|walked into|spotted|overjoyed|bro how are you|what are you doing|you look confused)', text_lower) else 0
    humor = 1 if re.search(r'(haha|lol|joke|funny|laugh|😂|humor|hilarious|wait what|just kidding|plot twist|bro|nightmare|god damn|crazy|insane|11x.*one better|skit|wouldn\'?t have happened|so yeah.*that\'?s it|snoop|wait why|what the hell|chia chow|hold on a second)', text_lower) else 0
    demo_instructions = len(re.findall(r'(click here|click on|let me show|let me walk|as you can see|you can see|click the|press the|drag and drop|tap on|type in|enter your|paste|I\'ll show|watch how|watch as)', text_lower))
    screen_narration = len(re.findall(r'(here you can see|on the left|on the right|at the top|at the bottom|over here|right here|this is where|this section|this page|this button|this tab|in this view|on the screen|you will see|you\'ll see)', text_lower))
    data_viz_cues = len(re.findall(r'(chart|graph|dashboard|analytics|visualization|report|metric|stat|data|insight|overview|tracking|monitor)', text_lower))
    energy_markers = len(re.findall(r'(!|amazing|awesome|incredible|fantastic|wow|cool|super|exciting|pumped|thrilled|love|magic|beautiful|powerful|gorgeous)', text_lower))
    feature_list_markers = len(re.findall(r'(first|second|third|number one|number two|number three|also|another|next|furthermore|additionally|in addition|lastly|finally|and then|one more|the next|on top of)', text_lower))
    production_markers = len(re.findall(r'(\[music\]|\[applause\]|\[laughter\]|foreign)', text_lower))

    # Count distinct speaker introductions and dialogue patterns
    speaker_intros = re.findall(r'(hi i\'?m |my name is |i\'?m .{2,15} and )', text_lower)
    dialogue_turns = len(re.findall(r'(said|says|told me|asked me|she said|he said|they said|oh I\'m|yay|hey |what\'?s up|how\'?d|are you|congrats|wow |bro |dude )', text_lower))
    speaker_changes = min(max(len(speaker_intros), dialogue_turns // 3), 8)

    action_verbs = len(re.findall(r'\b(build|create|launch|ship|deploy|connect|integrate|automate|generate|transform|track|monitor|analyze|design|craft|upload|download|install|configure|manage|optimize|scale|customize|personalize|streamline)\b', text_lower))

    feature_words_count = len(re.findall(r'\b(feature|functionality|capability|integration|dashboard|api|plugin|extension|template|widget|module|interface|tool|platform|system|engine|algorithm|model|database)\b', text_lower))
    benefit_words_count = len(re.findall(r'\b(save|faster|easier|better|improve|increase|reduce|efficient|productive|convenient|simple|quick|instant|seamless|powerful|smart|accurate|reliable|secure|free|affordable|accessible)\b', text_lower))

    benefit_ratio = round(benefit_words_count / max(benefit_words_count + feature_words_count, 1), 2)

    question_count = len(re.findall(r'\?', text)) + len(re.findall(r'\b(what if|have you ever|are you|do you|how do you|isn\'t|don\'t you|wouldn\'t|couldn\'t|can you|ever felt|ever tried|ever dreamed|sound familiar)\b', text_lower))
    question_count = min(question_count, 20)

    passive_voice_count = len(re.findall(r'\b(is|are|was|were|been|being)\s+(made|built|designed|created|used|generated|powered|stored|hosted|delivered|sent|produced|optimized|automated|rendered|processed)\b', text_lower))

    # --- Sentiment (3 dims) ---
    pos_words = len(re.findall(r'\b(great|love|amazing|awesome|incredible|fantastic|excellent|wonderful|beautiful|cool|excited|happy|joy|thrilled|delighted|impressed|proud|best|perfect|superb|brilliant)\b', text_lower))
    neg_words = len(re.findall(r'\b(bad|terrible|horrible|awful|hate|worst|ugly|broken|failed|pain|struggle|frustrated|annoyed|confused|overwhelmed|expensive|waste|tedious|boring|complicated)\b', text_lower))

    if pos_words > neg_words * 2:
        sentiment = "positive"
    elif neg_words > pos_words:
        sentiment = "negative"
    else:
        sentiment = "positive" if pos_words > 3 else "neutral"

    confidence_count = len(re.findall(r'\b(will|definitely|guaranteed|proven|certainly|absolutely|ensure|ensures|always|without a doubt|100%|for sure)\b', text_lower))

    # Product name detection - find most repeated capitalized multi-word or single word
    cap_words = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
    if cap_words:
        name_counts = Counter(cap_words)
        most_common = name_counts.most_common(3)
        product_name_repeats = most_common[0][1] if most_common else 0
    else:
        product_name_repeats = 0
    product_name_repeats = min(product_name_repeats, 20)

    # ========== V2 DIMENSIONS ==========

    # --- A. Story Architecture (17 dims) ---
    inciting_incident = 1 if re.search(r'(one day|I was |we were |I spent|when I|last (year|month|week|tuesday|monday)|ago when|sitting in|watching|I realized|I noticed|the moment|it hit me|I remember|we started|that\'?s when|it all started)', text_lower) else 0

    villain_named = 1 if re.search(r'(spreadsheet|email|manual|excel|google docs|the old way|legacy|traditional|existing tools|complicated|clutter|chaos|spam|broken|outdated|slow|expensive agencies|freelancer|billable hour)', text_lower) else 0

    villain_list = re.findall(r'(spreadsheet|email|manual process|excel|google docs|the old way|legacy software|traditional method|existing tool|complicated tool|clutter|chaos|spam folder|broken system|outdated|slow process|copy.?paste|duct.?tape|expensive agenc|unreliable freelancer|billable hour|guesswork|information overload|multiple tools|disconnected tool)', text_lower)
    villain_count = len(set(villain_list))

    stakes_escalation = 0
    if problem_words > 2:
        # Check if problem language intensifies
        first_half_prob = len(re.findall(r'\b(problem|issue|difficult|hard)\b', first_half))
        second_half_prob = len(re.findall(r'\b(waste|lose|cost|burn|expensive|thousand|million|trillion|hours|days|weeks)\b', second_half))
        if second_half_prob > first_half_prob:
            stakes_escalation = 1

    transformation_promise = 1 if re.search(r'(go from .{2,30} to|become|never again|transform|reinvent|redefin|revolutioniz|change the way|future of|new era|game.?chang|10x|unleash|superpower|reimagin)', text_lower) else 0

    # transformation_position
    tp_match = re.search(r'(go from .{2,30} to|become|never again|transform|reinvent|redefin|revolutioniz|change the way|future of|new era)', text_lower)
    if tp_match:
        transformation_position = round(tp_match.start() / max(len(text_lower), 1), 2)
    else:
        transformation_position = -1

    # pivot_sharpness
    pivot_matches = re.findall(r'(so we built|introducing|that\'?s why|enter |meet |here\'?s |presenting|say hello|well with|with .{3,20} you can|the solution)', text_lower)
    if len(pivot_matches) > 0:
        pivot_sharpness = 4 if re.search(r'(introducing|say hello|presenting|meet )', text_lower) else 3
    elif problem_pct > 20 and solution_pct > 20:
        pivot_sharpness = 3
    elif problem_pct < 5:
        pivot_sharpness = 2
    else:
        pivot_sharpness = 2

    nested_stories = 1 if re.search(r'(one of our (users|customers)|a user|customer.{0,20}(said|told|shared)|for example.{0,30}(john|sarah|team|company)|case study|listen to what|meet jacob|meet kate|let me tell you about)', text_lower) else 0

    temporal_anchors = len(re.findall(r'(\d+ (year|month|week|day|hour|minute|second|quarter)s?|last (year|month|week|quarter)|in \d+ (second|minute|hour|day)|within (minute|second|hour)|three years|four weeks|30 seconds|over a decade|for the last)', text_lower))

    imagine_device = len(re.findall(r'(imagine|picture this|what if you could|think about|envision|what if you|what if I told)', text_lower))

    cliffhanger_beats = len(re.findall(r'(but here\'?s the thing|and then|wait until|the best part|you won\'?t believe|but that\'?s not all|but wait|and guess what|here\'?s where|the real magic|here\'?s the exciting|and the cherry|but we\'?re not stopping)', text_lower))

    why_now = 1 if re.search(r'(now that|today|finally|just released|just launched|the time has come|we\'?re ready|in beta|with (this|the) release|new (technology|ai|feature)|recently|it\'?s time|now you can|now available)', text_lower) else 0

    # journey_vs_destination
    journey_signals = len(re.findall(r'(step by step|journey|process|workflow|from .{2,20} to|takes you|guide|walk you through|along the way)', text_lower))
    destination_signals = len(re.findall(r'(the (solution|tool|platform|app)|everything you need|all.?in.?one|one.?stop|your .{2,15} (solution|answer|tool))', text_lower))
    total_jd = journey_signals + destination_signals
    journey_vs_destination = round(journey_signals / max(total_jd, 1), 2)

    # emotional_bookend_match
    first_emotion = bool(re.search(r'(pain|struggle|problem|frustrated|overwhelmed|tired|chaos|difficult)', first_quarter))
    last_emotion = bool(re.search(r'(thank|excited|love|enjoy|great|happy|hope|welcome|try|start|join|transform)', last_quarter))
    emotional_bookend_match = 1 if (first_emotion and last_emotion) or (not first_emotion and not last_emotion) else 0

    unsaid_problem = len(re.findall(r'(you know (that|how|the)|we\'?ve all been|sound familiar|we all know|we get it|you\'?ve been there|been there|let\'?s face it|let\'?s be honest)', text_lower))

    # resolution_completeness
    prob_mentions = max(problem_words, 1)
    sol_mentions = max(solution_words, 1)
    resolution_completeness = round(min(sol_mentions / (prob_mentions + sol_mentions), 1.0), 2)

    # story_compression
    if temporal_anchors > 3 and word_count < 500:
        story_compression = 4.0
    elif temporal_anchors > 1:
        story_compression = 3.0
    elif word_count > 1500:
        story_compression = 2.0
    else:
        story_compression = 2.5

    # --- B. Emotional Mechanics (17 dims) ---

    # emotion_specificity
    vivid_emotions = len(re.findall(r'(that (sinking|rush|feeling|moment)|at 2am|on a friday|watching everyone|in a meeting|staring at|scrolling through|sinking feeling|late at night|overwhelmed by)', text_lower))
    generic_emotions = len(re.findall(r'\b(frustrated|happy|sad|angry|confused|excited|stressed)\b', text_lower))
    if vivid_emotions >= 2:
        emotion_specificity = 4
    elif vivid_emotions >= 1:
        emotion_specificity = 3
    elif generic_emotions >= 2:
        emotion_specificity = 2
    else:
        emotion_specificity = 1

    # relief_distance
    prob_match = re.search(r'(problem|pain|struggle|difficult|overwhelm|frustrat|broken|chaos|waste)', text_lower)
    sol_match = re.search(r'(introducing|solution|solve|fix|with .{3,20} you|here\'?s|presenting|say hello)', text_lower)
    if prob_match and sol_match and sol_match.start() > prob_match.start():
        intervening = text[prob_match.end():sol_match.start()]
        relief_distance = min(len(split_sentences(intervening)), 8)
    else:
        relief_distance = 0

    pride_trigger = len(re.findall(r'(you already know|as a |smart teams|you\'re the kind|you understand|you know how|your expertise|you\'re a)', text_lower))

    fomo_construction = len(re.findall(r'(competitors are|market is moving|everyone is|don\'?t get left|your competitors|while you\'re still|left behind|miss out|don\'t miss|going to be left|industry standard|leading companies)', text_lower))

    empathy_firsthand = 1 if re.search(r'(I spent|I was|I had to|we experienced|we struggled|I personally|we were|we noticed|we heard|we kept hearing|we saw|we learned|we realized|I remember|we started|I\'ve been)', text_lower) else 0
    empathy_observed = 1 if re.search(r'(teams struggle|developers spend|companies waste|people spend|managers|founders|creators|users (are|have|spend|struggle|need)|you (spend|waste|struggle))', text_lower) else 0

    frustration_vocab = set(re.findall(r'\b(overwhelm|frustrat|confus|tedious|cumbersome|painful|annoying|waste|slow|expensive|manual|clutter|chaos|messy|broken|complicated|hard|struggle|difficult|boring|drag|stumble|fumble|hassle)\b', text_lower))
    frustration_vocabulary_breadth = len(frustration_vocab)

    # joy_velocity_shift
    if pivot_sharpness >= 4:
        joy_velocity_shift = 4
    elif pivot_sharpness >= 3:
        joy_velocity_shift = 3
    elif problem_pct > 20:
        joy_velocity_shift = 3
    else:
        joy_velocity_shift = 2

    vulnerability_moment = 1 if re.search(r'(our first|we almost|we\'?re not perfect|honestly|we got this wrong|it\'s a beta|work in progress|not (the )?perfect|we\'re still|we know it\'s not|isn\'t perfect|this is just|first version)', text_lower) else 0

    anticipatory_emotion = len(re.findall(r'(wait until you see|you\'re going to love|here\'?s the exciting|watch this|check this out|let me show you|wait for it|the cool thing|and guess what|the best part|here\'?s where it gets|you\'ll love)', text_lower))

    social_belonging = len(re.findall(r'(join \d|community|thousands of|millions of|fellow|we\'re in this|you\'re in good|growing community|part of|tribe|together|along with)', text_lower))

    # loss_aversion_framing
    gain_frames = len(re.findall(r'(save|gain|earn|get|win|benefit|improve|increase|boost|grow|unlock|achieve)', text_lower))
    loss_frames = len(re.findall(r'(lose|losing|waste|wasting|miss|missing|cost you|spending|burn|drain|behind)', text_lower))
    total_frames = gain_frames + loss_frames
    loss_aversion_framing = round(loss_frames / max(total_frames, 1), 2)

    surprise_delight = len(re.findall(r'(oh and|bonus|did I mention|cherry on top|and it also|it even|not only .{5,30} but also|on top of (this|that)|and the best part|wait there\'?s more|and that\'?s not all|and guess what)', text_lower))

    # confidence_gradient - check if language gets more assertive
    first_half_hedge = len(re.findall(r'\b(maybe|might|could|possibly|try|hope)\b', first_half))
    second_half_assert = len(re.findall(r'\b(will|definitely|guaranteed|proven|always|ensure|trust|reliable)\b', second_half))
    if second_half_assert > first_half_hedge + 2:
        confidence_gradient = 4
    elif second_half_assert > first_half_hedge:
        confidence_gradient = 3
    else:
        confidence_gradient = 2

    # emotional_contrast_ratio
    ecr = 2
    if has_negative_opener and closing_has_cta:
        ecr = 4
    elif problem_pct > 20 and energy_markers > 5:
        ecr = 4
    elif problem_pct > 10 and energy_markers > 3:
        ecr = 3
    elif problem_pct < 5 and energy_markers < 3:
        ecr = 1
    emotional_contrast_ratio = ecr

    finally_signal = len(re.findall(r'(finally|at last|no more|never again|say goodbye|the wait is over|put an end|forget|stop .{2,15}ing|done with|goodbye to|farewell to)', text_lower))

    # empathy_depth
    empathy_score = 1
    if empathy_firsthand:
        empathy_score += 2
    if empathy_observed:
        empathy_score += 1
    if emotion_specificity >= 3:
        empathy_score += 1
    empathy_depth = min(empathy_score, 5)

    # --- C. Product Presentation (17 dims) ---

    # feature_intro_velocity
    if feature_list_markers > 8 and word_count < 500:
        feature_intro_velocity = 1
    elif feature_list_markers > 5:
        feature_intro_velocity = 2
    elif word_count > 1000 and feature_list_markers > 2:
        feature_intro_velocity = 4
    elif word_count > 500:
        feature_intro_velocity = 3
    else:
        feature_intro_velocity = 3

    # orphaned_features
    orphaned = max(0, feature_words_count - benefit_words_count) / max(feature_words_count, 1)
    orphaned_features = round(min(orphaned, 1.0), 2)

    demo_voice_present_tense = 1 if re.search(r'(I click|I drag|watch as I|see how it|I\'m going to|let me|I\'ll just|I select|I paste|I type|I enter|I open|I go to|here I|I can see|as you can see|let\'s|let me show)', text_lower) else 0

    # concrete_vs_abstract
    concrete_signals = len(re.findall(r'(\d+%|\$\d|per (second|minute|hour|day)|step|click|button|page|screen|tab|menu|field|dashboard|inbox|notification)', text_lower))
    abstract_signals = len(re.findall(r'(powerful|robust|seamless|innovative|cutting-edge|scalable|enterprise-grade|world-class|state-of-the-art|next-gen|advanced|comprehensive|holistic)', text_lower))
    if concrete_signals > abstract_signals * 2:
        concrete_vs_abstract = 4
    elif concrete_signals > abstract_signals:
        concrete_vs_abstract = 3
    elif abstract_signals > concrete_signals * 2:
        concrete_vs_abstract = 2
    else:
        concrete_vs_abstract = 3
    if demo_instructions > 5:
        concrete_vs_abstract = min(concrete_vs_abstract + 1, 5)

    # magic_moment_position
    wow_patterns = [
        r'(and voila|magic|the best part|incredible|amazing|wow|the real|impressive|pretty cool|the cherry|game.?chang|mind.?blow|unbelievable)',
    ]
    wow_match = None
    for pat in wow_patterns:
        m = re.search(pat, text_lower)
        if m:
            wow_match = m
            break
    magic_moment_position = round(wow_match.start() / max(len(text_lower), 1), 2) if wow_match else 0.5

    speed_claims = len(re.findall(r'(in seconds|instantly|10x|100x|x faster|times faster|real.?time|lightning|within minutes|within seconds|in no time|30 seconds|5 minutes|in minutes|super fast|blazing|in under)', text_lower))

    effort_reduction_specific = 1 if re.search(r'(what took \d|from \d.{2,20} to \d|\d+ (hours|minutes|days|steps).{2,30}\d+ (hours|minutes|days|steps)|reduces? \d|save \d+ (hours|minutes)|12 times|18 times|85 percent|60%|30%)', text_lower) else 0
    effort_reduction_vague = 1 if re.search(r'(saves? time|easier|simpler|streamline|more efficient|less effort|simplif|convenient|hassle.?free|on autopilot|automat)', text_lower) else 0

    integration_mentions = set(re.findall(r'\b(slack|notion|jira|zapier|github|gitlab|trello|asana|linear|figma|adobe|chrome|google drive|dropbox|confluence|hubspot|salesforce|stripe|shopify|wordpress|vercel|aws|gcp|azure|intercom|zendesk|freshdesk|monday|airtable|basecamp|clickup|make\.com|google sheets|excel|outlook|gmail|linkedin|twitter|facebook|instagram|tiktok|youtube|zoom|teams|calendar)\b', text_lower))
    integration_count = len(integration_mentions)

    progressive_disclosure = 1 if re.search(r'(start with|begin with|first.{5,30}then.{5,30}(advanced|power|pro)|basic.{5,30}then|simple.{5,30}then|for beginners.{5,30}for advanced|but if you want|take it a step further|and if that\'?s not enough|for power users)', text_lower) else 0

    one_more_thing = 1 if re.search(r'(oh and|one more|bonus|cherry on top|did I mention|last but not least|and also|and that\'?s not all|wait there\'?s more|one last|and finally)', last_quarter) else 0

    simplicity_signals = len(re.findall(r'(simple|easy|intuitive|no learning curve|one click|drag and drop|just (click|drag|connect|type|press|add|paste|select|tap)|no code|zero setup|plug and play|straightforward|user.?friendly|it\'?s that easy|effortless)', text_lower))

    under_the_hood = 1 if re.search(r'(built on|powered by|uses? (gpt|openai|ai|vector|embedding|llm|machine learning|neural|kubernetes|docker|react|aws|vercel)|(gpt|openai|llm|api|architecture|backend|infrastructure|engine|algorithm))', text_lower) else 0

    # use_case_count
    use_cases = set(re.findall(r'(for (developer|designer|marketer|founder|creator|manager|freelancer|engineer|team|business|enterprise|startup|student|professional|educator|content creator|sales|product manager|pm|cto|ceo|writer|blogger|agency|investor)s?|whether you\'?re a)', text_lower))
    use_case_count = max(len(use_cases), 1)

    # liveness_score
    if demo_instructions > 5 and demo_voice_present_tense:
        liveness_score = 4
    elif demo_instructions > 2 and demo_voice_present_tense:
        liveness_score = 3
    elif production_markers > 1:
        liveness_score = 2
    elif filler_count > 3:
        liveness_score = 4
    else:
        liveness_score = 3

    onboarding_time_claim = 1 if re.search(r'(up and running|in \d+ minutes|deploy in|setup in|get started in|within minutes|in under \d|30 seconds|5 minutes|in minutes|in no time|seconds to set|quick setup)', text_lower) else 0

    comparison_moment = 1 if re.search(r'(old way|new way|before.{2,30}after|on the left.{2,30}on the right|here\'?s the old|here\'?s ours|side by side|compared|vs\.?|versus|used to be|now it\'?s|from this.{2,20}to this)', text_lower) else 0

    # --- D. Wording & Rhetoric (16 dims) ---

    # verb_energy
    corporate_verbs = len(re.findall(r'\b(utilize|facilitate|leverage|implement|optimize|integrate|streamline|synergize|operationalize)\b', text_lower))
    punchy_verbs = len(re.findall(r'\b(build|create|ship|crush|launch|smash|nail|kill|hack|blast|slash|snap|dive|grab|hit|slam|drop|fire|rip|plug)\b', text_lower))
    if punchy_verbs > corporate_verbs * 2:
        verb_energy = 4
    elif punchy_verbs > corporate_verbs:
        verb_energy = 3
    elif corporate_verbs > punchy_verbs:
        verb_energy = 2
    else:
        verb_energy = 3

    # sentence_rhythm_variance
    sent_lengths = [len(get_words(s)) for s in sentences]
    if len(sent_lengths) > 2:
        mean_len = sum(sent_lengths) / len(sent_lengths)
        variance = sum((l - mean_len) ** 2 for l in sent_lengths) / len(sent_lengths)
        std_dev = variance ** 0.5
        if std_dev > 10:
            sentence_rhythm_variance = 5
        elif std_dev > 7:
            sentence_rhythm_variance = 4
        elif std_dev > 4:
            sentence_rhythm_variance = 3
        elif std_dev > 2:
            sentence_rhythm_variance = 2
        else:
            sentence_rhythm_variance = 1
    else:
        sentence_rhythm_variance = 2

    # power_word_cluster_density
    power_words = re.findall(r'\b(free|new|instant|proven|exclusive|guaranteed|discover|amazing|incredible|transform|unleash|revolutionary|breakthrough|powerful|ultimate|secret|massive|epic|shocking|critical|urgent)\b', text_lower)
    if len(power_words) > 10:
        power_word_cluster_density = 4
    elif len(power_words) > 5:
        power_word_cluster_density = 3
    elif len(power_words) > 2:
        power_word_cluster_density = 2
    else:
        power_word_cluster_density = 1

    # jargon_distribution_shape
    tech_jargon = r'\b(api|sdk|oauth|kubernetes|docker|graphql|webhook|endpoint|microservice|saas|ci/cd|devops|gpu|cpu|ram|dns|ssl|http|json|yaml|sql|nosql|vpc|iot|blockchain|mqtt|grpc|tcp|udp|regex|schema|mutex|daemon)\b'
    jargon_first = len(re.findall(tech_jargon, first_quarter))
    jargon_mid = len(re.findall(tech_jargon, mid_section))
    jargon_last = len(re.findall(tech_jargon, last_quarter))
    total_jargon = jargon_first + jargon_mid + jargon_last
    if total_jargon < 2:
        jargon_distribution_shape = "minimal"
    elif jargon_first > jargon_mid and jargon_first > jargon_last:
        jargon_distribution_shape = "front_heavy"
    elif jargon_last > jargon_mid and jargon_last > jargon_first:
        jargon_distribution_shape = "back_heavy"
    elif jargon_mid > jargon_first and jargon_mid > jargon_last:
        jargon_distribution_shape = "middle_heavy"
    else:
        jargon_distribution_shape = "even"

    anaphora_count = len(re.findall(r'(no more .{3,30}\.\s*no more|you can .{3,30}\.\s*you can|we .{3,30}\.\s*we |it .{3,30}\.\s*it |just .{3,30}\.\s*just )', text_lower))
    # Also check for repeated sentence starters
    if len(sentences) > 3:
        starters = [' '.join(get_words(s)[:2]) for s in sentences if get_words(s)]
        starter_counts = Counter(starters)
        for s, c in starter_counts.items():
            if c >= 3:
                anaphora_count += 1

    just_minimizer = len(re.findall(r'\bjust (click|drag|connect|type|press|add|paste|select|tap|enter|ask|send|sign|upload|download|install|copy|one|search|do|set|pick|write|put|tell|give|hit)\b', text_lower))

    superlatives = re.findall(r'\b(best|most|fastest|only|first|#1|number one|largest|biggest|highest|easiest|smartest|ultimate|top)\b', text_lower)
    superlative_density = round(len(superlatives) / word_count * 100, 2) if word_count > 0 else 0

    question_answer_pairs = len(re.findall(r'\?\s*(simple|easy|yes|well|it\'?s|the answer|here\'?s|just|three|one word|absolutely|of course)', text_lower))

    # transition_sophistication
    basic_trans = len(re.findall(r'\b(and|also|so|then|but|now|next)\b', text_lower))
    crafted_trans = len(re.findall(r'(here\'?s where|but the real|here\'?s the thing|the best part|what\'?s interesting|what makes this|let me show|now here\'?s|the cool thing|but wait|and this is where)', text_lower))
    if crafted_trans > 3:
        transition_sophistication = 4
    elif crafted_trans > 1:
        transition_sophistication = 3
    elif crafted_trans > 0:
        transition_sophistication = 2
    else:
        transition_sophistication = 1

    negation_as_benefit = len(re.findall(r'(no .{2,20} needed|without .{2,20}|zero (setup|config|code|hassle|effort)|never worry|eliminat|no more|no need|don\'t need|doesn\'t require|no additional|no credit card|without any|without ever|without having)', text_lower))

    # specificity_index
    specific_numbers = len(re.findall(r'\b\d+\b', text))
    specific_names = brand_count
    if specific_numbers > 10 and specific_names > 3:
        specificity_index = 5
    elif specific_numbers > 5 or specific_names > 2:
        specificity_index = 4
    elif specific_numbers > 2:
        specificity_index = 3
    elif specific_numbers > 0:
        specificity_index = 2
    else:
        specificity_index = 1

    you_insertion_rate = round(you_count / word_count * 100, 2) if word_count > 0 else 0

    cliche_count = len(re.findall(r'\b(game.?chang|one.?stop.?shop|seamless|frictionless|empower|unlock|leverage|reimagine|disrupt|scalable|robust|cutting.?edge|best.?in.?class|state.?of.?the.?art|next.?gen|paradigm|synergy|holistic|end.?to.?end|turnkey|all.?in.?one)\b', text_lower))

    conditional_density = round(len(re.findall(r'(if you (need|want|have|are|like|prefer)|whether you|in case you|when you need|should you|for those who)', text_lower)) / word_count * 100, 2) if word_count > 0 else 0

    parallel_structure = len(re.findall(r'(\w+ faster\.?\s*\w+ smarter|\w+ more\.?\s*\w+ less|build .{3,15}\. ship .{3,15}\. scale|no more .{3,15}\.\s*no more|say goodbye .{3,15}\.\s*say hello|from .{3,15} to .{3,15} to )', text_lower))

    imperative_density = round(len(re.findall(r'\b(try|check|sign|join|visit|download|start|stop|get|head|click|tap|go |don\'?t|discover|experience|imagine|unlock|unleash|explore|dive|grab|use)\b', text_lower)) / word_count * 100, 2) if word_count > 0 else 0

    # --- E. Persuasion Psychology (17 dims) ---

    # word_rarity_score
    rare_words = len(re.findall(r'\b(paradigm|ubiquitous|cognit|heuristic|empirical|nuance|dichotomy|ephemeral|quintessential|juxtaposit|proliferat|arbitrag|bespoke|proactiv|catapult|amalgamat|meticulous|repertoire|facet|reson)\b', text_lower))
    if rare_words > 3:
        word_rarity_score = 4
    elif rare_words > 1:
        word_rarity_score = 3
    elif syllable_density > 1.7:
        word_rarity_score = 3
    elif syllable_density > 1.5:
        word_rarity_score = 2
    else:
        word_rarity_score = 1

    qualifying_retreat = len(re.findall(r'(well.{2,10}(one of|at least|sort of)|the best.{2,10}(well|or)|revolutionary.{2,10}(or|at least))', text_lower))

    # conclusive_finality
    if re.search(r'(try it today|get started now|sign up now|don\'t miss|download now|visit .{3,30}\.(com|io|ai)|join us today|start your|what are you waiting|start now)', closing_lower):
        conclusive_finality = 4
    elif re.search(r'(thanks|thank you|bye|cheers|see you)', closing_lower):
        conclusive_finality = 2
    elif re.search(r'(so yeah|that\'s it|anyway|that\'?s about it|yep)', closing_lower):
        conclusive_finality = 1
    else:
        conclusive_finality = 3

    # social_proof_stacking_order
    if success_users > 0 and brand_count > 0:
        # Find which comes first
        num_match = re.search(r'\d[\d,]*\+?\s*(users|customers|teams|companies)', text_lower)
        brand_match = re.search(r'\b(Google|Amazon|Microsoft|Slack|Notion)\b', text, re.IGNORECASE)
        if num_match and brand_match:
            if num_match.start() < brand_match.start():
                social_proof_stacking_order = "numbers_first"
            else:
                social_proof_stacking_order = "brands_first"
        elif num_match:
            social_proof_stacking_order = "numbers_first"
        else:
            social_proof_stacking_order = "brands_first"
    elif has_testimonial:
        social_proof_stacking_order = "quotes_first"
    elif success_users > 0:
        social_proof_stacking_order = "numbers_first"
    elif brand_count > 0:
        social_proof_stacking_order = "brands_first"
    else:
        social_proof_stacking_order = "none"

    # authority_type
    if has_credential and success_users > 0:
        authority_type = "mixed"
    elif has_credential:
        authority_type = "technical"
    elif success_users > 0 or trusted_by:
        authority_type = "market"
    elif re.search(r'(years? of experience|\d+ years|decade|century of|veteran|seasoned|expert)', text_lower):
        authority_type = "domain"
    else:
        authority_type = "none"

    reciprocity_trigger = 1 if re.search(r'(free (tier|trial|version|plan|account|for)|open source|no credit card|free to use|completely free|for free|it\'?s free|free forever|free (chrome )?extension)', text_lower) else 0

    anchor_contrast_pricing = 1 if re.search(r'(\$\d[\d,]*.{2,30}\$\d[\d,]*|cost.{2,30}we\'?re|expensive.{5,40}(free|\$\d)|thousands.{5,40}\$\d|hundreds.{5,40}free)', text_lower) else 0

    contrast_pairs = len(re.findall(r'(instead of|not .{2,15} but|unlike|while others|compared to|versus|vs\.?|rather than|traditional.{2,20}(our|we)|old .{2,15} new)', text_lower))

    # certainty_ratio
    certain_words = len(re.findall(r'\b(will|always|definitely|guaranteed|proven|ensures?|certainly|absolutely|100%|every|all|never)\b', text_lower))
    uncertain_words = len(re.findall(r'\b(maybe|might|could|possibly|perhaps|sometimes|probably|try|hope|aim)\b', text_lower))
    total_cert = certain_words + uncertain_words
    certainty_ratio = round(certain_words / max(total_cert, 1), 2)

    in_group_language = len(re.findall(r'(as (developer|founder|creator|engineer|designer|marketer)s? we|fellow|if you\'?re like us|we\'?ve all|we know|we get it|we understand|we hear you)', text_lower))

    objection_preempt = len(re.findall(r'(you might (be |wonder)|don\'?t worry|and yes|no (credit card|setup|installation|code|hardware)|it (also|even) works|worried about|concerned about|what about|but what if)', text_lower))

    # scarcity_type
    if re.search(r'(today only|this week|limited time|expir)', text_lower):
        scarcity_type = "time"
    elif re.search(r'(limited spots|only \d+ |first \d+)', text_lower):
        scarcity_type = "quantity"
    elif re.search(r'(invite only|exclusive|private beta|early access|waitlist)', text_lower):
        scarcity_type = "access"
    elif re.search(r'(the only|only (tool|platform|solution)|first ever|first of its kind|only one)', text_lower):
        scarcity_type = "capability"
    else:
        scarcity_type = "none"

    # bandwagon_gradient
    bandwagon_gradient = 0
    num_mentions = list(re.finditer(r'\d[\d,]*\+?\s*(users|customers|teams|people|companies|businesses)', text_lower))
    if len(num_mentions) >= 2:
        bandwagon_gradient = 1

    # choice_architecture
    tier_mentions = len(re.findall(r'(free (plan|tier|version)|pro|premium|enterprise|basic|starter|professional|business plan|team plan|individual plan)', text_lower))
    choice_architecture = min(tier_mentions, 4)

    cognitive_ease = len(re.findall(r'(one click|automatic|zero config|plug and play|set it and forget|instant|no setup|no code|no learning curve|out of the box|turn.?key|ready to use|pre.?built|pre.?made|auto.?magic|autopilot)', text_lower))

    everyone_else_maneuver = len(re.findall(r'(most (teams|companies|developers)|industry standard|your competitors|leading companies|everyone (is|else)|thousands of|millions of|top companies|best teams)', text_lower))

    future_self_projection = len(re.findall(r'(you\'?ll become|imagine yourself|be the one who|your future|you will be|transform (your|the way)|never (again|be the person)|go from .{3,20} to|redefine)', text_lower))

    # --- F. Structure & Timing (16 dims) ---

    # info_density_shape
    first_third_info = len(re.findall(r'\b(feature|tool|platform|api|integration|dashboard|setting|option|button|click|function)\b', first_third))
    mid_third = text_lower[len(text_lower)//3:2*len(text_lower)//3]
    mid_third_info = len(re.findall(r'\b(feature|tool|platform|api|integration|dashboard|setting|option|button|click|function)\b', mid_third))
    last_third_info = len(re.findall(r'\b(feature|tool|platform|api|integration|dashboard|setting|option|button|click|function)\b', last_third))

    if first_third_info > mid_third_info and first_third_info > last_third_info:
        info_density_shape = "front_loaded"
    elif last_third_info > first_third_info and last_third_info > mid_third_info:
        info_density_shape = "back_loaded"
    elif mid_third_info > first_third_info and mid_third_info > last_third_info:
        info_density_shape = "middle_peak"
    else:
        info_density_shape = "even"

    # breathing_room
    if word_count < 200:
        breathing_room = 3
    elif word_count / sentence_count > 30:
        breathing_room = 1
    elif word_count / sentence_count > 20:
        breathing_room = 2
    elif word_count / sentence_count < 12:
        breathing_room = 4
    else:
        breathing_room = 3
    if production_markers > 0:
        breathing_room = min(breathing_room + 1, 5)

    # cold_open_words
    product_mention = re.search(r'(introducing|presenting|our (product|tool|platform|app)|called |is a |it\'?s a |we built|we created|here\'?s )', text_lower)
    if product_mention:
        cold_open_words = len(get_words(text_lower[:product_mention.start()]))
    else:
        cold_open_words = 0

    callback_count = len(re.findall(r'(remember|going back|as I (mentioned|said|showed)|earlier|ties back|this connects|as we (discussed|saw))', text_lower))

    # section_length_cv
    if len(sentences) < 4:
        section_length_cv = 2
    else:
        thirds = [
            len(get_words(' '.join(sentences[:len(sentences)//3]))),
            len(get_words(' '.join(sentences[len(sentences)//3:2*len(sentences)//3]))),
            len(get_words(' '.join(sentences[2*len(sentences)//3:])))
        ]
        mean_t = sum(thirds) / 3
        if mean_t > 0:
            cv = (sum((t - mean_t)**2 for t in thirds) / 3) ** 0.5 / mean_t
            if cv > 0.5:
                section_length_cv = 5
            elif cv > 0.3:
                section_length_cv = 4
            elif cv > 0.15:
                section_length_cv = 3
            elif cv > 0.05:
                section_length_cv = 2
            else:
                section_length_cv = 1
        else:
            section_length_cv = 2

    # promise_proof_push
    has_promise = 1 if (solution_words > 2 or benefit_words_count > 2) else 0
    has_proof = 1 if (success_users > 0 or brand_count > 0 or has_testimonial or has_credential) else 0
    has_push_cta = 1 if closing_has_cta else 0
    promise_proof_push = float(has_promise + has_proof + has_push_cta)

    # first_feature_position
    feature_match = re.search(r'(feature|you can|it (can|will|does)|allows? you|lets? you|enables?|with .{3,20} you can|click|dashboard|api|setting)', text_lower)
    if feature_match:
        first_feature_position = round(feature_match.start() / max(len(text_lower), 1), 2)
    else:
        first_feature_position = 0.1

    parenthetical_credibility = len(re.findall(r'(by the way|incidentally|oh and|which (by the way|incidentally)|fun fact|worth noting|as it happens)', text_lower))

    section_boundary_markers = len(re.findall(r'(number one|number two|number three|first(ly)?|second(ly)?|third(ly)?|next|finally|let\'?s move|moving on|the (second|third|next|last|final) (thing|step|feature|tool|point))', text_lower))

    # setup_payoff_distance
    if relief_distance > 4:
        setup_payoff_distance = 4.0
    elif relief_distance > 2:
        setup_payoff_distance = 3.0
    elif relief_distance > 0:
        setup_payoff_distance = 2.0
    else:
        setup_payoff_distance = 1.0

    multi_persona_address = len(set(re.findall(r'for (developer|designer|marketer|founder|creator|manager|freelancer|engineer|team|business|enterprise|startup|student|professional|educator|content creator|sales|product manager)s?', text_lower)))

    # voice_consistency
    i_count = len(re.findall(r'\bi\b', text_lower))
    voice_shifts = abs(we_count - you_count) + abs(i_count - we_count)
    if voice_shifts < 5:
        voice_consistency = 4
    elif voice_shifts < 10:
        voice_consistency = 3
    elif voice_shifts < 20:
        voice_consistency = 2
    else:
        voice_consistency = 1

    counterfactual_count = len(re.findall(r'(what if (you|we)|without this|imagine not|if you didn\'?t|you\'?d still be|what would happen)', text_lower))

    # closing_velocity
    if closing_has_cta and len(get_words(closing_text)) < 30:
        closing_velocity = 4
    elif closing_has_cta:
        closing_velocity = 3
    elif closing_has_thanks and len(get_words(closing_text)) < 20:
        closing_velocity = 3
    else:
        closing_velocity = 2

    open_loop_closing = 1 if re.search(r'(this is just the beginning|much more to come|stay tuned|wait until|v2|more features|keep adding|keep watching|constantly evolving|we will be|coming soon|in the future)', closing_lower) or re.search(r'(this is just the beginning|much more to come|stay tuned|wait until|v2|more features|keep adding|keep watching|constantly evolving|we will be|coming soon|in the future)', last_quarter) else 0

    definitive_closing = 1 if re.search(r'(try it today|get started now|sign up|download now|visit .{3,30}\.(com|io|ai)|check it out|start your|don\'t miss|join)', closing_lower) else 0

    return {
        "id": str(tid),
        # Opening
        "hook_type": hook_type,
        "first_person_opener": first_person_opener,
        "has_negative_opener": has_negative_opener,
        "first_sentence_words": first_sentence_words,
        "hook_quality": hook_quality,
        # Length & Readability
        "word_count": word_count,
        "sentence_count": sentence_count,
        "avg_sentence_length": avg_sentence_length,
        "flesch_kincaid_grade": flesch_kincaid_grade,
        "word_diversity": word_diversity,
        "syllable_density": syllable_density,
        # Pronouns & Voice
        "pronoun_strategy": pronoun_strategy,
        "we_count": we_count,
        "you_count": you_count,
        "hedge_count": hedge_count,
        "filler_count": filler_count,
        # Narrative Arc
        "narrative_arc": narrative_arc,
        "topic_transitions": topic_transitions,
        "problem_pct": problem_pct,
        "solution_pct": solution_pct,
        "declining_arc": declining_arc,
        # Metrics & Traction
        "number_count": number_count,
        "number_density": number_density,
        "metric_placement": metric_placement,
        "before_after_total": before_after_total,
        "success_users": success_users,
        "success_revenue": success_revenue,
        "success_cost_savings": success_cost_savings,
        "success_growth": success_growth,
        # Social Proof
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
        # Category & Positioning
        "category_creation_total": category_creation_total,
        "ai_count": ai_count,
        "ai_density": ai_density,
        "buzzword_count": buzzword_count,
        # CTA & Closing
        "primary_cta": primary_cta,
        "cta_position": cta_position,
        "has_discount": has_discount,
        "has_scarcity": has_scarcity,
        "has_pricing": has_pricing,
        "has_url": has_url,
        "closing_has_cta": closing_has_cta,
        "closing_has_thanks": closing_has_thanks,
        # Content Signals
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
        "feature_words": feature_words_count,
        "benefit_words": benefit_words_count,
        "benefit_ratio": benefit_ratio,
        "question_count": question_count,
        "passive_voice_count": passive_voice_count,
        # Sentiment
        "sentiment": sentiment,
        "confidence_count": confidence_count,
        "product_name_repeats": product_name_repeats,
        # V2 - Story Architecture
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
        # V2 - Emotional Mechanics
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
        # V2 - Product Presentation
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
        # V2 - Wording & Rhetoric
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
        # V2 - Persuasion Psychology
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
        # V2 - Structure & Timing
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
    input_path = '/Users/maxguillabert/Downloads/index/launch-video-analysis/ph/v2-llm-parts/input_batch_08.json'
    output_path = '/Users/maxguillabert/Downloads/index/launch-video-analysis/ph/v2-llm-parts/output_batch_08.json'

    with open(input_path) as f:
        data = json.load(f)

    results = []
    for item in data:
        tid = item['id']
        transcript = item.get('transcript', '')
        result = extract_dimensions(tid, transcript)
        results.append(result)

    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"Processed {len(results)} transcripts")
    print(f"Dimensions per transcript: {len(results[0]) if results else 0}")
    print(f"Output written to: {output_path}")

if __name__ == '__main__':
    main()
