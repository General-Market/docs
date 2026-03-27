#!/usr/bin/env python3
"""
Extract 200 dimensions from Product Hunt launch video transcripts.
Batch 10 processing. Uses semantic heuristics — no external LLM calls.
"""

import json
import re
import math
from collections import Counter

# ── helpers ──────────────────────────────────────────────────────────

def clean_text(t):
    """Remove production markers but remember them."""
    return re.sub(r'\[.*?\]|\(.*?\)', '', t).strip()

def sentences(t):
    """Split into sentences. Handles unpunctuated spoken transcripts."""
    # Handle abbreviations and common patterns
    t2 = re.sub(r'\b(Mr|Mrs|Ms|Dr|Prof|Inc|Ltd|Jr|Sr|vs|etc|e\.g|i\.e)\.',
                lambda m: m.group(0).replace('.', '<DOT>'), t)
    parts = re.split(r'[.!?]+', t2)
    result = [s.replace('<DOT>', '.').strip() for s in parts if s.strip() and len(s.strip()) > 2]

    # If we got very few sentences but have a lot of words, the transcript
    # is likely unpunctuated spoken text. Split on clause boundaries instead.
    total_words = len(re.findall(r"[a-zA-Z']+", t))
    if len(result) <= 3 and total_words > 50:
        # Split on common spoken clause boundaries
        # These patterns approximate sentence boundaries in speech
        clause_splits = re.split(
            r'\b(?:so |and then |but |because |also |now |then |next |'
            r'another |additionally |furthermore |however |although |'
            r'meanwhile |basically |anyway |and (?:the |our |we |you |it |this |that |here |there |if ))',
            t2, flags=re.IGNORECASE
        )
        result = [s.replace('<DOT>', '.').strip() for s in clause_splits if s.strip() and len(s.strip()) > 10]

        # If still too few, split approximately by word count chunks (~15-20 words)
        if len(result) <= 3 and total_words > 50:
            all_words = t2.split()
            chunk_size = 18
            result = []
            for i in range(0, len(all_words), chunk_size):
                chunk = ' '.join(all_words[i:i+chunk_size])
                if len(chunk.strip()) > 10:
                    result.append(chunk.strip())

    return result

def words(t):
    """Extract words."""
    return re.findall(r"[a-zA-Z']+", t.lower())

def syllable_count(word):
    """Estimate syllables in a word."""
    word = word.lower()
    if len(word) <= 3:
        return 1
    count = len(re.findall(r'[aeiouy]+', word))
    if word.endswith('e') and not word.endswith('le'):
        count -= 1
    if word.endswith('ed') and len(word) > 4:
        count -= 1
    return max(1, count)

def flesch_kincaid(total_words, total_sentences, total_syllables):
    if total_sentences == 0 or total_words == 0:
        return 0.0
    return 0.39 * (total_words / max(total_sentences, 1)) + 11.8 * (total_syllables / max(total_words, 1)) - 15.59

def count_pattern(text, patterns):
    """Count occurrences of any pattern in text (case-insensitive)."""
    total = 0
    tl = text.lower()
    for p in patterns:
        total += len(re.findall(p, tl))
    return total

def has_pattern(text, patterns):
    tl = text.lower()
    for p in patterns:
        if re.search(p, tl):
            return 1
    return 0

def relative_position(text, patterns):
    """Find relative position (0-1) of first match of any pattern."""
    tl = text.lower()
    earliest = len(tl)
    for p in patterns:
        m = re.search(p, tl)
        if m:
            earliest = min(earliest, m.start())
    if earliest == len(tl):
        return -1.0
    return round(earliest / max(len(tl), 1), 2)

def get_first_sentence(text):
    s = sentences(text)
    return s[0] if s else ""

def detect_hook_type(first_sent, text):
    fl = first_sent.lower()
    if re.search(r'^(hi|hey|hello|welcome|good morning|good afternoon|greetings)', fl):
        return "greeting"
    if re.search(r'\?$', first_sent.strip()):
        return "question"
    if re.search(r'(i was|i used to|my story|when i|i remember|years ago.*i|i started)', fl):
        return "founder_story"
    if re.search(r'(broken|tired|hate|frustrated|problem|struggle|pain|annoying|sucks|sick of)', fl):
        return "pain_point"
    if re.search(r'(introducing|announcing|launch|meet |presenting|excited to)', fl):
        return "announcement"
    if re.search(r'(let me show|click|watch|here you|in this demo|i\'ll walk)', fl):
        return "demo_instruction"
    if re.search(r'(\d+%|\d+ million|\d+x|\d+ billion|\$\d)', fl):
        return "stat_number"
    if re.search(r'(the (best|only|first|most|fastest)|will change|transform|never)', fl):
        return "bold_claim"
    if re.search(r'(is a|is the|is an|are a|provides|helps|enables|allows|lets you)', fl):
        return "product_statement"
    return "descriptive"

def detect_narrative_arc(text, sents):
    if len(sents) < 3:
        return "too_short"
    tl = text.lower()
    third = len(tl) // 3
    first_third = tl[:third]
    last_third = tl[2*third:]

    problem_words = r'(problem|issue|struggle|pain|broken|frustrated|challenge|difficult|hard|waste|slow|manual|tedious|complicated|expensive|confusing)'
    solution_words = r'(solution|solve|fix|build|create|introduce|launch|tool|platform|app|feature|automat|simplif|streamlin)'
    traction_words = r'(users|customers|companies|teams|revenue|growth|raised|funding|downloads|sign.?ups)'

    prob_first = len(re.findall(problem_words, first_third))
    sol_first = len(re.findall(solution_words, first_third))
    trac_first = len(re.findall(traction_words, first_third))

    prob_total = len(re.findall(problem_words, tl))
    sol_total = len(re.findall(solution_words, tl))
    trac_total = len(re.findall(traction_words, tl))

    if trac_first > 2 and trac_first >= prob_first and trac_first >= sol_first:
        return "traction_first"
    if prob_first > sol_first and prob_total > sol_total:
        return "problem_heavy"
    if sol_first > prob_first:
        return "solution_first"
    if prob_total > 0 and sol_total > 0:
        return "problem_solution"
    return "neutral_flat"

def detect_pronoun_strategy(we_c, you_c):
    if we_c == 0 and you_c == 0:
        return "neutral"
    if we_c > you_c * 1.5:
        return "mostly_we"
    if you_c > we_c * 1.5:
        return "mostly_you"
    return "balanced"

def detect_primary_cta(text):
    tl = text.lower()
    last_quarter = tl[3*len(tl)//4:]

    cta_map = [
        ("waitlist", r'wait\s*list'),
        ("book_demo", r'book.{0,10}demo|schedule.{0,10}demo|request.{0,10}demo'),
        ("beta", r'\bbeta\b'),
        ("limited", r'limited\s+(time|access|spots|offer)|exclusive\s+access'),
        ("free", r'\bfree\b.*\b(try|start|sign|get|plan)\b|\b(try|start|sign|get|plan)\b.*\bfree\b|free\s+trial|free\s+plan|for\s+free'),
        ("sign_up", r'sign\s*up'),
        ("get_started", r'get\s+started'),
        ("try", r'\btry\b.*\b(it|now|today|out)\b|\btry\s+\w+\s+(today|now|for)\b'),
        ("join", r'\bjoin\b'),
    ]

    for name, pat in cta_map:
        if re.search(pat, last_quarter):
            return name
    for name, pat in cta_map:
        if re.search(pat, tl):
            return name
    return "none"

def detect_cta_position(text):
    tl = text.lower()
    cta_pats = [r'sign\s*up', r'try\b', r'get\s+started', r'join', r'wait\s*list', r'book.{0,10}demo', r'visit', r'check.{0,10}out', r'download', r'start.{0,10}free', r'go to']

    positions = []
    for p in cta_pats:
        for m in re.finditer(p, tl):
            positions.append(m.start() / max(len(tl), 1))

    if not positions:
        return "none"
    avg = sum(positions) / len(positions)
    if avg < 0.25:
        return "start"
    if avg < 0.65:
        return "middle"
    return "end"

def detect_sentiment(text):
    tl = text.lower()
    pos = count_pattern(tl, [r'\b(great|amazing|awesome|love|best|excellent|wonderful|fantastic|perfect|beautiful|powerful|incredible|brilliant)\b'])
    neg = count_pattern(tl, [r'\b(bad|terrible|awful|hate|worst|broken|frustrat|annoy|pain|struggle|problem|fail|difficult|tedious|slow|complicated)\b'])
    if pos > neg * 2:
        return "positive"
    if neg > pos * 2:
        return "negative"
    if pos > neg:
        return "positive"
    return "neutral"

def detect_metric_placement(text):
    tl = text.lower()
    nums = list(re.finditer(r'\d+', tl))
    if not nums:
        return "none"
    positions = [m.start() / max(len(tl), 1) for m in nums]
    avg = sum(positions) / len(positions)
    if avg < 0.33:
        return "front"
    if avg < 0.66:
        return "middle"
    return "back"

def count_brands(text):
    """Count distinct brand/company names — capitalized multi-word or known brands."""
    known = ['google', 'apple', 'microsoft', 'amazon', 'facebook', 'meta', 'slack', 'notion',
             'zapier', 'github', 'gitlab', 'stripe', 'shopify', 'figma', 'canva', 'vercel',
             'openai', 'gpt', 'chatgpt', 'claude', 'anthropic', 'aws', 'azure', 'heroku',
             'hubspot', 'salesforce', 'zoom', 'discord', 'twitter', 'linkedin', 'instagram',
             'youtube', 'tiktok', 'reddit', 'dropbox', 'trello', 'asana', 'jira', 'confluence',
             'airtable', 'monday', 'basecamp', 'intercom', 'mailchimp', 'sendgrid', 'twilio',
             'firebase', 'supabase', 'postgres', 'mongodb', 'redis', 'docker', 'kubernetes',
             'react', 'angular', 'vue', 'nextjs', 'next.js', 'tailwind', 'typescript',
             'wordpress', 'wix', 'squarespace', 'webflow', 'framer', 'linear', 'loom',
             'calendly', 'typeform', 'chrome', 'safari', 'firefox', 'ios', 'android',
             'spotify', 'netflix', 'uber', 'airbnb', 'tesla', 'nike', 'adobe', 'photoshop',
             'illustrator', 'premiere', 'excel', 'powerpoint', 'word', 'outlook', 'teams',
             'copilot', 'gemini', 'bard', 'midjourney', 'dall-e', 'dalle', 'stable diffusion',
             'whatsapp', 'telegram', 'signal', 'pinterest', 'snapchat', 'producthunt',
             'product hunt', 'y combinator', 'techcrunch', 'crunchbase', 'g2', 'capterra',
             'mailgun', 'datadog', 'sentry', 'mixpanel', 'amplitude', 'segment', 'snowflake',
             'databricks', 'tableau', 'power bi', 'looker', 'grafana', 'elastic', 'splunk',
             'pagerduty', 'okta', 'auth0', 'twitch', 'bing', 'duckduckgo', 'brave',
             'grammarly', 'deepl', 'perplexity', 'cursor']
    tl = text.lower()
    found = set()
    for b in known:
        if b in tl:
            found.add(b)
    return len(found)

def count_integrations(text):
    """Count distinct named tool/service integrations."""
    integrations = ['slack', 'notion', 'zapier', 'github', 'gitlab', 'stripe', 'shopify',
                    'hubspot', 'salesforce', 'zoom', 'discord', 'google drive', 'google sheets',
                    'google docs', 'gmail', 'outlook', 'jira', 'confluence', 'trello', 'asana',
                    'airtable', 'monday', 'intercom', 'mailchimp', 'twilio', 'firebase',
                    'supabase', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'vercel',
                    'heroku', 'netlify', 'wordpress', 'webflow', 'figma', 'canva',
                    'dropbox', 'onedrive', 'box', 'linear', 'clickup', 'basecamp',
                    'sendgrid', 'segment', 'mixpanel', 'amplitude', 'datadog', 'sentry',
                    'pagerduty', 'okta', 'auth0', 'calendly', 'typeform', 'chrome',
                    'whatsapp', 'telegram', 'twitter', 'instagram', 'facebook', 'linkedin',
                    'tiktok', 'youtube', 'pinterest', 'reddit', 'api', 'rest api', 'graphql',
                    'webhook', 'csv', 'excel', 'google calendar']
    tl = text.lower()
    found = set()
    for integ in integrations:
        if integ in tl:
            found.add(integ)
    return len(found)

def detect_product_name(text, name):
    """Try to find the product name and count repeats."""
    if not name:
        return 0
    nl = name.lower()
    tl = text.lower()
    return tl.count(nl)

def is_too_short(text):
    """Check if transcript is essentially empty/music-only."""
    cleaned = clean_text(text)
    w = words(cleaned)
    return len(w) < 20

def detect_info_density_shape(text):
    tl = text.lower()
    quarter = len(tl) // 4
    if quarter == 0:
        return "even"
    # Count information-bearing words in each quarter
    info_pats = r'(feature|tool|platform|app|api|data|integration|workflow|automat|analytic|dashboard|report|custom|config|setting|option|function)'
    q1 = len(re.findall(info_pats, tl[:quarter]))
    q2 = len(re.findall(info_pats, tl[quarter:2*quarter]))
    q3 = len(re.findall(info_pats, tl[2*quarter:3*quarter]))
    q4 = len(re.findall(info_pats, tl[3*quarter:]))

    first_half = q1 + q2
    second_half = q3 + q4

    if first_half > second_half * 1.5:
        return "front_loaded"
    if second_half > first_half * 1.5:
        return "back_loaded"
    mid = q2 + q3
    edges = q1 + q4
    if mid > edges * 1.5:
        return "middle_peak"
    return "even"

def detect_jargon_distribution(text):
    tl = text.lower()
    third = len(tl) // 3
    if third == 0:
        return "minimal"
    jargon = r'(api|sdk|backend|frontend|deploy|infrastructure|latency|throughput|scalab|microservice|containeriz|kubernetes|docker|pipeline|endpoint|webhook|middleware|oauth|jwt|ssl|tls|dns|cdn|ci.?cd|devops|saas|paas|iaas|ml|nlp|neural|algorithm|vector|embedding|token|gpu|cloud|server|database|sql|nosql|schema|query|cache|socket|protocol|encryption|hash|binary|runtime|compiler|framework)'

    t1 = len(re.findall(jargon, tl[:third]))
    t2 = len(re.findall(jargon, tl[third:2*third]))
    t3 = len(re.findall(jargon, tl[2*third:]))
    total = t1 + t2 + t3

    if total <= 1:
        return "minimal"
    if t1 > t2 and t1 > t3:
        return "front_heavy"
    if t2 > t1 and t2 > t3:
        return "middle_heavy"
    if t3 > t1 and t3 > t2:
        return "back_heavy"
    return "even"

def detect_authority_type(text):
    tl = text.lower()
    tech = has_pattern(tl, [r'(ex.?(google|facebook|meta|apple|amazon|microsoft|stripe|uber|airbnb)|phd|doctorate|stanford|mit|harvard|berkeley|carnegie|caltech|oxford|cambridge|computer science|engineering degree)'])
    market = has_pattern(tl, [r'(\d+[,.]?\d*\s*(users|customers|companies|teams|downloads|installs)|million\s+users)'])
    domain = has_pattern(tl, [r'(\d+\s+years?\s+(of\s+)?experience|decade|veteran|spent\s+\d+\s+years|worked\s+for\s+\d+)'])

    types = []
    if tech: types.append("technical")
    if market: types.append("market")
    if domain: types.append("domain")

    if len(types) >= 2: return "mixed"
    if len(types) == 1: return types[0]
    return "none"

def detect_scarcity_type(text):
    tl = text.lower()
    if has_pattern(tl, [r'(today only|this week|limited time|ends soon|for a limited|hours left)']):
        return "time"
    if has_pattern(tl, [r'(limited spots|only \d+ spots|first \d+ users|limited capacity)']):
        return "quantity"
    if has_pattern(tl, [r'(invite only|exclusive access|private beta|waitlist|by invitation)']):
        return "access"
    if has_pattern(tl, [r'(only tool|only platform|only solution|the only|uniquely)']):
        return "capability"
    return "none"

def detect_social_proof_stacking(text):
    tl = text.lower()
    # Find first occurrence of each type
    num_pos = -1
    brand_pos = -1
    quote_pos = -1

    m = re.search(r'\d+[,.]?\d*\s*(users|customers|companies|teams)', tl)
    if m: num_pos = m.start()

    m = re.search(r'(trusted by|used by|chosen by|loved by)', tl)
    if m: brand_pos = m.start()

    m = re.search(r'(".*?"|\u201c.*?\u201d|said\s|told\s|according to)', tl)
    if m: quote_pos = m.start()

    positions = []
    if num_pos >= 0: positions.append(("numbers_first", num_pos))
    if brand_pos >= 0: positions.append(("brands_first", brand_pos))
    if quote_pos >= 0: positions.append(("quotes_first", quote_pos))

    if not positions:
        return "none"
    positions.sort(key=lambda x: x[1])
    return positions[0][0]


# ── Main extraction function ─────────────────────────────────────────

def extract_dimensions(item):
    """Extract all 200 dimensions from a single transcript item."""
    transcript = item.get('transcript', '')
    name = item.get('name', '')
    tid = str(item.get('id', ''))

    cleaned = clean_text(transcript)
    w = words(cleaned)
    sents = sentences(cleaned)
    word_count = len(w)
    sentence_count = len(sents)

    too_short = is_too_short(transcript)

    # Word frequency
    word_freq = Counter(w)
    unique_words = len(word_freq)

    # Syllables
    total_syllables = sum(syllable_count(wd) for wd in w) if w else 0

    # Production markers
    prod_markers = len(re.findall(r'\[.*?\]|\(.*?\)', transcript))

    # Speaker changes
    speaker_changes = len(re.findall(r'(?:^|\n)\s*[A-Z][a-z]+\s*:', transcript))

    first_sent = get_first_sentence(cleaned)
    first_sent_words = len(words(first_sent))

    tl = cleaned.lower()

    # ── V1: Opening ──
    hook_type = detect_hook_type(first_sent, cleaned) if not too_short else "descriptive"
    first_person_opener = 1 if re.match(r'\s*(i |i\'|we |we\')', tl) else 0
    has_negative_opener = has_pattern(first_sent.lower(), [r'(broken|tired|hate|frustrated|problem|struggle|pain|annoying|sick of|fed up|worst|terrible|waste|nobody|nothing)'])
    hook_quality = 1
    if not too_short:
        hq = 2
        if hook_type in ("pain_point", "founder_story", "stat_number", "bold_claim", "question"):
            hq += 1
        if has_negative_opener:
            hq += 1
        if first_sent_words > 5 and first_sent_words < 25:
            hq += 1
        if has_pattern(first_sent.lower(), [r'(\d+%|\$\d|\d+x|million|billion)']):
            hq += 1
        hook_quality = min(5, hq)

    # ── V1: Length & Readability ──
    avg_sent_len = round(word_count / max(sentence_count, 1), 1)
    fk_grade = round(flesch_kincaid(word_count, sentence_count, total_syllables), 1)
    word_div = round(unique_words / max(word_count, 1), 2)
    syll_density = round(total_syllables / max(word_count, 1), 2)

    # ── V1: Pronouns ──
    we_count = count_pattern(tl, [r'\b(we|our|us)\b'])
    you_count = count_pattern(tl, [r'\b(you|your|you\'re|you\'ll|you\'ve|yourself)\b'])
    pronoun_strategy = detect_pronoun_strategy(we_count, you_count)
    hedge_count = count_pattern(tl, [r'\b(maybe|perhaps|might|kind of|sort of|arguably|possibly|probably|i think|i guess|could be)\b'])
    filler_count = count_pattern(tl, [r'\b(um|uh|like|basically|actually|literally|so yeah|you know|i mean|right)\b'])

    # ── V1: Narrative Arc ──
    narrative_arc = detect_narrative_arc(cleaned, sents) if not too_short else "too_short"

    # Topic transitions
    transition_markers = count_pattern(tl, [r'\b(but|however|now|next|also|another|additionally|furthermore|moving on|let\'s talk about|speaking of|on top of|beyond that)\b'])
    topic_transitions = max(0, transition_markers // 2)

    # Problem/solution pct
    prob_sents = sum(1 for s in sents if re.search(r'(problem|issue|struggle|pain|broken|frustrated|challenge|difficult|hard|waste|slow|manual|tedious|complicated|expensive|confusing|annoying)', s.lower()))
    sol_sents = sum(1 for s in sents if re.search(r'(solution|solve|fix|build|create|tool|platform|app|feature|automat|simplif|streamlin|helps|enables|allows)', s.lower()))
    problem_pct = round(prob_sents / max(sentence_count, 1) * 100, 1)
    solution_pct = round(sol_sents / max(sentence_count, 1) * 100, 1)

    # Declining arc
    if sentence_count >= 4:
        last_quarter_sents = sents[3*len(sents)//4:]
        last_q_text = ' '.join(last_quarter_sents).lower()
        declining_arc = 1 if has_pattern(last_q_text, [r'(hurry|limited|don\'t miss|before it\'s|running out|last chance|act now|time is)']) else 0
    else:
        declining_arc = 0

    # ── V1: Metrics & Traction ──
    numbers = re.findall(r'\b\d+[,.]?\d*\b', cleaned)
    number_count = len(numbers)
    number_density = round(number_count / max(word_count, 1) * 100, 2)
    metric_placement = detect_metric_placement(cleaned)

    before_after_total = count_pattern(tl, [r'(before.*after|from.*to\s+\d|used to.*now|was.*now is|went from|compared to|instead of)', r'(old way.*new way|traditional.*vs|without.*with\s+\w+)'])
    success_users = count_pattern(tl, [r'\d+[,.]?\d*\s*(users|customers|clients|subscribers|members|teams|companies|people use|downloads|installs)'])
    success_revenue = count_pattern(tl, [r'(\$\d|revenue|arr|mrr|sales of|earning|income|profit)'])
    success_cost_savings = count_pattern(tl, [r'(save[ds]?\s+\$|cost\s+saving|reduc\w+\s+cost|cheaper|cut\s+cost|save[ds]?\s+\d+%|fraction of the cost)'])
    success_growth = count_pattern(tl, [r'(grow\w+\s+\d|grew\s+\d|\d+%\s+growth|\d+x\s+growth|doubled|tripled|increased\s+by|year over year)'])

    # ── V1: Social Proof ──
    brand_count = count_brands(cleaned)
    has_investor_mention = has_pattern(tl, [r'(investor|funded|raised|backed by|vc|venture|seed|series [a-d]|angel|y combinator|yc|techstars|accelerator)'])
    has_testimonial = has_pattern(tl, [r'(".*?".*said|testimonial|one (user|customer) said|here\'s what|feedback|review|they told us)'])
    trusted_by = has_pattern(tl, [r'(trusted by|relied on by|used by|chosen by|loved by|endorsed by)'])
    has_partnership = has_pattern(tl, [r'(partner|partnership|partnered|collaborate|collaboration|working with|teamed up|in partnership)'])
    has_credential = has_pattern(tl, [r'(ex.?(google|facebook|meta|apple|amazon|microsoft|stripe|uber|airbnb|netflix)|phd|doctorate|stanford|mit|harvard|yale|princeton|ex\s+cto|ex\s+ceo|former\s+(head|director|vp|engineer|lead)|years?\s+at\s+(google|facebook|meta|apple|amazon)|navy seal|master chief|neuroscien|psycholog)'])

    social_proof_claims = has_investor_mention + has_testimonial + trusted_by + has_partnership + has_credential + min(success_users, 1) + min(success_revenue, 1)
    platform_mentions = count_integrations(cleaned)

    competitive_total = count_pattern(tl, [r'(unlike|compared to|better than|faster than|cheaper than|vs\b|versus|competitor|alternative to|instead of using|switch from|replace|traditional)', r'(other tools|other platforms|other solutions|existing)'])
    replacement_total = count_pattern(tl, [r'(replace|replaces|replacing|switch from|ditch|stop using|forget about|say goodbye to|no more\s+\w+\s+\w+ing|drop\s+\w+\s+and)'])

    # ── V1: Category & Positioning ──
    category_creation_total = count_pattern(tl, [r'(the first|the only|world\'s first|we invented|a new kind|a new way|first ever|first of its kind|never been done|no one else|pioneering|revolutionary approach)'])
    ai_count = count_pattern(tl, [r'\b(ai|artificial intelligence|machine learning|ml|deep learning|neural|gpt|llm|language model|openai|chatgpt|copilot|generative)\b'])
    ai_density = round(ai_count / max(word_count, 1) * 100, 2)
    buzzword_count = count_pattern(tl, [r'\b(revolutionary|game.?chang|cutting.?edge|disrupt|paradigm|synergy|empower|unlock|leverage|next.?gen|state.?of.?the.?art|world.?class|best.?in.?class|reimagine|transform|groundbreaking|breakthrough)\b'])

    # ── V1: CTA & Closing ──
    primary_cta = detect_primary_cta(cleaned)
    cta_position = detect_cta_position(cleaned)
    has_discount = has_pattern(tl, [r'(discount|deal|offer|coupon|promo|% off|\d+% off|save \$|special price|lifetime deal)'])
    has_scarcity = has_pattern(tl, [r'(limited|exclusive|only \d+ spots|early access|first \d+ users|invite only|spots (are )?filling|running out)'])
    has_pricing = has_pattern(tl, [r'(\$\d+|pricing|price|cost|plan|tier|free plan|premium|pro plan|enterprise|per month|per year|annually|monthly|per user|per seat)'])
    has_url = has_pattern(tl, [r'(\.com|\.io|\.co|\.app|\.dev|\.ai|\.org|www\.|http|visit\s+\w+\.\w+|go to\s+\w+\.\w+|check out\s+\w+\.\w+)'])

    last_two_sents = ' '.join(sents[-2:]).lower() if len(sents) >= 2 else tl[-200:]
    closing_has_cta = has_pattern(last_two_sents, [r'(sign up|try|get started|join|visit|check out|download|start|go to|head over|click|link)'])
    closing_has_thanks = has_pattern(last_two_sents, [r'(thank|thanks|bye|goodbye|see you|cheers|appreciate)'])

    # ── V1: Content Signals ──
    storytelling = has_pattern(tl, [r'(one day|i remember|back when|years ago|there was a time|it all started|let me tell you|story|imagine|picture this|i was sitting)'])
    humor = has_pattern(tl, [r'(haha|lol|funny|joke|laugh|comedian|humor|spoiler|just kidding|plot twist|pun intended|no pun|don\'t worry)'])
    demo_instructions = count_pattern(tl, [r'(click here|let me show|let me walk|i\'ll show|watch this|as you can see|if i click|when i click|here i|i\'ll demonstrate)'])
    screen_narration = count_pattern(tl, [r'(here you can see|on the left|on the right|at the top|at the bottom|on this screen|on the screen|you\'ll see|you\'ll notice|as shown|this is the|this is our|this is where|here we have|over here|down here|up here)'])
    data_viz_cues = count_pattern(tl, [r'(chart|graph|dashboard|visualization|plot|analytics|metrics|data|report|statistics|numbers show|table|histogram|pie chart|bar chart)'])
    energy_markers = len(re.findall(r'!', transcript)) + count_pattern(tl, [r'\b(amazing|incredible|awesome|wow|exciting|fantastic|love|great|brilliant|phenomenal|insane|crazy good)\b'])
    feature_list_markers = count_pattern(tl, [r'\b(first|second|third|fourth|fifth|number one|number two|number three|also|additionally|another|next|finally|lastly|moreover|furthermore|plus|on top of that)\b'])

    speaker_ch = max(speaker_changes, len(re.findall(r'(?:narrator|speaker|host|guest|interviewer)', tl)))

    action_verbs = count_pattern(tl, [r'\b(build|create|launch|ship|deploy|automate|connect|integrate|generate|track|manage|monitor|analyze|optimize|customize|configure|schedule|publish|share|collaborate|design|discover|explore|search|filter|sort|export|import|sync|transform|convert|process|run|execute|test|debug|scale|grow|boost|accelerate|simplify|streamline|eliminate|reduce|save|cut|improve|enhance|upgrade|maximize|minimize)\b'])

    feature_words = count_pattern(tl, [r'\b(feature|function|capability|module|component|tool|integration|api|endpoint|widget|plugin|extension|add.?on|setting|option|mode|template|preset|workflow|automation|notification|alert|filter|view|panel|sidebar|tab|button|dashboard|report|chart|export|import|sync|search|sort)\b'])

    benefit_words = count_pattern(tl, [r'\b(save time|save money|faster|easier|simpler|efficient|productive|accurate|reliable|secure|scalable|flexible|intuitive|powerful|seamless|smooth|instant|real.?time|automatic|effortless|hassle.?free|stress.?free|peace of mind|focus|grow|boost|improve|increase|reduce|eliminate|avoid|prevent|protect|ensure|guarantee)\b'])

    benefit_ratio = round(benefit_words / max(benefit_words + feature_words, 1), 2)

    question_count = len(re.findall(r'\?', cleaned))

    # Passive voice (rough estimate)
    passive_voice_count = count_pattern(tl, [r'\b(is|are|was|were|been|being)\s+(made|built|created|designed|developed|used|known|called|considered|expected|required|needed|done|given|taken|shown|found|said|told|seen|heard|thought|felt|left|kept|held|brought|set|run|cut|put|let|paid)\b'])

    # ── V1: Sentiment ──
    sentiment = detect_sentiment(cleaned)
    confidence_count = count_pattern(tl, [r'\b(will|definitely|guaranteed|proven|ensure|certainly|absolutely|undoubtedly|without a doubt|for sure|100%|always)\b'])
    product_name_repeats = detect_product_name(cleaned, name)

    # ════════════════════════════════════════════════════════════════
    # V2 DIMENSIONS
    # ════════════════════════════════════════════════════════════════

    # ── A. Story Architecture (17) ──
    inciting_incident = has_pattern(tl, [
        r'(one day|last (tuesday|month|year|week)|i was (sitting|working|trying|looking|struggling)|when i (realized|discovered|found|noticed)|it hit me|that\'s when|the moment i|i remember when|it all started when|that was the day|three years ago|back in \d{4})',
        r'(i spent \d|i wasted \d|my \w+ bill was|i lost \d|we lost \d|our team spent|after \d+ hours)'
    ])

    villain_named = has_pattern(tl, [
        r'(spreadsheet|excel|email|slack|manual|copy.?paste|legacy|traditional|old.?school|outdated|clunky|broken)',
        r'(complexity|information overload|context switch|data silo|bottleneck|bureaucra|red tape|meetings|zoom fatigue)',
        r'(competitor|existing (tool|solution|platform)|the old way|the current|incumbents)'
    ])

    villain_count_val = 0
    villain_patterns = [
        r'spreadsheet', r'excel', r'email', r'slack', r'manual\s+\w+', r'copy.?paste',
        r'legacy', r'traditional\s+\w+', r'outdated', r'clunky', r'broken\s+\w+',
        r'complexity', r'information overload', r'context switch', r'data silo',
        r'bottleneck', r'bureaucra', r'meetings', r'zoom', r'chaos', r'mess'
    ]
    for vp in villain_patterns:
        if re.search(vp, tl):
            villain_count_val += 1
    villain_count_val = min(villain_count_val, 8)

    stakes_escalation = 0
    if sentence_count >= 4:
        prob_pat = r'(cost|lose|waste|hours|days|fail|miss|risk|expensive|frustrat|burn|overwhelm|drown|crash|break|damage|hurt)'
        first_half_stakes = count_pattern(' '.join(sents[:len(sents)//2]).lower(), [prob_pat])
        second_half_stakes = count_pattern(' '.join(sents[len(sents)//2:]).lower(), [prob_pat])
        # Check if second half intensifies
        if first_half_stakes > 0 and second_half_stakes > first_half_stakes:
            stakes_escalation = 1
        # Also check for escalation words
        if has_pattern(tl, [r'(even worse|not only.*but also|on top of that|and it gets worse|what\'s worse|the real cost|the bigger problem)']):
            stakes_escalation = 1

    transformation_promise = has_pattern(tl, [
        r'(go from .* to|become|transform|never again|turn .* into|evolve|level up|upgrade your|reimagine|reinvent|change the way|change how|shift from|transition from)',
        r'(be the .* who|future of|next level|new era|new chapter|redefine)'
    ])

    transformation_position_val = relative_position(tl, [
        r'(go from .* to|become|transform|never again|turn .* into|change the way|change how|redefine|reimagine|new era)'
    ])

    # Pivot sharpness
    pivot_pats = [r'(so we built|introducing|that\'s why we|enter |meet |here\'s |and that\'s when|the solution|we created|we built|and then we|this is where)',
                  r'(now imagine|but what if|there\'s a better way|what if you could|that\'s where \w+ comes in)']
    pivot_pos = relative_position(tl, pivot_pats)
    has_pivot = has_pattern(tl, pivot_pats)
    if too_short:
        pivot_sharpness = 1
    elif has_pivot:
        # Check how abrupt the transition is
        pivot_m = None
        for pp in pivot_pats:
            pivot_m = re.search(pp, tl)
            if pivot_m:
                break
        if pivot_m:
            before = tl[max(0, pivot_m.start()-50):pivot_m.start()].strip()
            has_problem_before = has_pattern(before, [r'(problem|issue|struggle|pain|broken|frustrated|waste|slow|manual|tedious)'])
            if has_problem_before:
                pivot_sharpness = 4
            else:
                pivot_sharpness = 3
        else:
            pivot_sharpness = 2
    else:
        pivot_sharpness = 2
    if has_pattern(tl, [r'(so we built|introducing|enter \w+|meet \w+|that\'s where \w+ comes in)']):
        pivot_sharpness = min(5, pivot_sharpness + 1)

    nested_stories = has_pattern(tl, [
        r'(one of our (users|customers|clients)|for example.*she|for example.*he|a .* told us|case study|let me tell you about|take .* for example|here\'s .*\'s story|customer .* said)',
        r'(when .* first (used|tried|started)|imagine .* named|meet .*,\s*(a|an|the)|there was this)'
    ])

    temporal_anchors = count_pattern(tl, [
        r'\b(\d+\s+(years?|months?|weeks?|days?|hours?|minutes?|seconds?))\b',
        r'(last (quarter|month|year|week|tuesday|monday|wednesday|thursday|friday)|in \d{4}|within (minutes|seconds|hours|days)|ago|since \d{4}|by \d{4}|in (30|60|90) (seconds|minutes|days))'
    ])

    imagine_device = count_pattern(tl, [r'(imagine|picture this|what if you could|think about what|envision|what if there was|what if instead|wouldn\'t it be)'])

    cliffhanger_beats = count_pattern(tl, [r'(but here\'s the thing|and then something|wait until you see|the best part|you won\'t believe|here\'s where it gets|but wait|and here\'s the kicker|guess what|and that\'s not all|but that\'s not all|the magic happens|here\'s the (cool|exciting|interesting) part)'])

    why_now = has_pattern(tl, [
        r'(now that (ai|gpt|llm)|thanks to (ai|new|recent)|with the (rise|advent|emergence)|finally possible|now possible|for the first time|the time is (right|now)|market is (ready|ripe)|technology (finally|now) (allows|enables|makes)|2023|2024|in today\'s)',
        r'(the world (has changed|is changing)|new regulation|new law|shift in|pandemic|post.?covid|remote work|hybrid work)'
    ])

    # Journey vs destination
    journey_signals = count_pattern(tl, [r'(takes you from|guides you|walk you through|step by step|journey|path|roadmap|process|workflow|pipeline|from .* to|along the way)'])
    destination_signals = count_pattern(tl, [r'(the (solution|answer|platform|tool|app) for|all.?in.?one|single source|one place|one stop|one platform|hub for|central|everything you need)'])
    if journey_signals + destination_signals == 0:
        journey_vs_destination = 0.5
    else:
        journey_vs_destination = round(journey_signals / max(journey_signals + destination_signals, 1), 2)

    # Emotional bookend match
    if sentence_count >= 4:
        first_2 = ' '.join(sents[:2]).lower()
        last_2 = ' '.join(sents[-2:]).lower()
        first_neg = has_pattern(first_2, [r'(problem|pain|struggle|frustrated|broken|hate|tired|waste)'])
        last_pos = has_pattern(last_2, [r'(try|join|start|love|better|easy|simple|fast|free|great|finally)'])
        first_pos = has_pattern(first_2, [r'(welcome|introducing|excited|happy|glad|meet|presenting)'])
        last_pos2 = has_pattern(last_2, [r'(thank|welcome|try|join|love|start|enjoy)'])
        emotional_bookend_match = 1 if (first_neg and last_pos) or (first_pos and last_pos2) else 0
    else:
        emotional_bookend_match = 0

    unsaid_problem = count_pattern(tl, [r'(you know (that|the|how)|we\'ve all been there|sound familiar|you know what i mean|we all (know|hate|struggle)|ever had that|you\'ve probably|if you\'re like me|we\'ve all (experienced|dealt))'])

    # Resolution completeness
    if too_short:
        resolution_completeness = 0.0
    else:
        probs_raised = prob_sents
        probs_resolved = min(probs_raised, sol_sents)
        resolution_completeness = round(probs_resolved / max(probs_raised, 1), 2)

    # Story compression
    if too_short:
        story_compression = 1.0
    else:
        time_refs = temporal_anchors
        if time_refs == 0:
            story_compression = 2.0
        elif time_refs > 5:
            story_compression = 4.0
        elif time_refs > 2:
            story_compression = 3.0
        else:
            story_compression = 2.0

    # ── B. Emotional Mechanics (17) ──

    # Emotion specificity
    specific_emotions = count_pattern(tl, [r'(sinking feeling|that moment when|2am|friday night|deadline|the rush|the thrill|heart sinks|stomach drops|eyes light up|can\'t sleep|staring at|drowning in|buried under|pulling hair|tearing your hair|sweating)'])
    generic_emotions = count_pattern(tl, [r'\b(frustrated|happy|sad|angry|excited|worried|stressed|anxious|confused|overwhelmed)\b'])
    if too_short:
        emotion_specificity = 1
    elif specific_emotions >= 3:
        emotion_specificity = 5
    elif specific_emotions >= 2:
        emotion_specificity = 4
    elif specific_emotions >= 1:
        emotion_specificity = 3
    elif generic_emotions >= 2:
        emotion_specificity = 2
    else:
        emotion_specificity = 1

    # Relief distance
    first_problem = -1
    first_solution = -1
    for i_s, s in enumerate(sents):
        sl = s.lower()
        if first_problem == -1 and re.search(r'(problem|issue|struggle|pain|broken|frustrated|waste|slow|manual|tedious|complicated)', sl):
            first_problem = i_s
        if first_solution == -1 and first_problem >= 0 and re.search(r'(solution|solve|fix|build|create|introducing|that\'s why|so we|meet \w+|enter \w+|helps|enables|tool|platform)', sl):
            first_solution = i_s
    relief_distance = max(0, first_solution - first_problem) if first_problem >= 0 and first_solution >= 0 else 0

    pride_trigger = count_pattern(tl, [r'(you already know|as a \w+ you understand|smart (teams|people|companies)|you\'re the kind|savvy|power user|expert|professional|sophisticated)'])

    fomo_construction = count_pattern(tl, [r'(competitors are|market is moving|everyone is (switching|using|adopting)|don\'t get left|your competitors|while you\'re still|falling behind|missing out|left behind|ahead of the curve|early adopter|first mover)'])

    empathy_firsthand = has_pattern(tl, [r'(i spent \d|i (personally|myself)|when i was a|i had to|i used to|we experienced|i was frustrated|i struggled|i wasted|we faced|i know (firsthand|first.?hand|from experience)|we\'ve been there|i\'ve been|as a (developer|designer|founder|engineer|marketer|pm) myself)'])

    empathy_observed = has_pattern(tl, [r'(teams struggle|developers spend|companies waste|people are (tired|frustrated|struggling)|users (hate|dislike|complain)|marketers (spend|waste)|founders (struggle|face)|engineers (waste|spend)|designers (struggle|spend)|everyone (knows|hates|struggles))'])

    # Frustration vocabulary breadth
    frust_concepts = set()
    frust_map = {
        'time_waste': r'(waste time|hours spent|time.?consuming|takes too long|slow)',
        'money_waste': r'(expensive|cost|waste money|overpriced|pay too much)',
        'complexity': r'(complex|complicated|confusing|overwhelming|steep learning)',
        'manual_work': r'(manual|repetitive|tedious|copy.?paste|grunt work)',
        'fragmentation': r'(scattered|fragmented|siloed|disconnected|multiple tools)',
        'errors': r'(error|mistake|bug|wrong|inaccurate|unreliable)',
        'friction': r'(friction|hassle|pain|struggle|difficult|hard to)',
        'scale': r'(doesn\'t scale|can\'t keep up|bottleneck|overwhelm)',
        'communication': r'(miscommunic|lost in translation|context lost|out of the loop)',
        'visibility': r'(no visibility|can\'t see|don\'t know|lack of insight|blind spot)',
    }
    for concept, pat in frust_map.items():
        if re.search(pat, tl):
            frust_concepts.add(concept)
    frustration_vocabulary_breadth = len(frust_concepts)

    # Joy velocity shift
    if too_short:
        joy_velocity_shift = 1
    elif has_pivot and pivot_sharpness >= 4:
        joy_velocity_shift = 4
    elif has_pivot:
        joy_velocity_shift = 3
    elif has_pattern(tl, [r'(instantly|immediately|in seconds|right away|one click)']):
        joy_velocity_shift = 3
    else:
        joy_velocity_shift = 2

    vulnerability_moment = has_pattern(tl, [
        r'(our first version was|we almost gave up|we\'re not perfect|honestly.*wrong|we got.*wrong|we failed|it wasn\'t easy|we struggled|i\'ll admit|to be honest|full disclosure|we made mistakes|it took us.*to figure|we learned the hard way)'
    ])

    anticipatory_emotion = count_pattern(tl, [r'(wait until you see|you\'re going to love|here\'s the (exciting|cool|best|fun) part|watch this|check this out|let me show you something|you\'ll love|the magic is|here comes the|brace yourself)'])

    social_belonging = count_pattern(tl, [r'(join \d+|community of|thousands of|fellow (founder|developer|designer|creator|builder)|you\'re in good company|join the|growing community|part of a|tribe of|network of)'])

    # Loss aversion framing
    gain_frames = count_pattern(tl, [r'(save|gain|earn|get|achieve|unlock|access|receive|win|improve|boost|increase|grow|maximize)'])
    loss_frames = count_pattern(tl, [r'(lose|losing|wast|miss|fall behind|left behind|leak|bleed|drain|cost you|costing|spend|spending|burning|hemorrhag)'])
    if gain_frames + loss_frames == 0:
        loss_aversion_framing = 0.5
    else:
        loss_aversion_framing = round(loss_frames / max(gain_frames + loss_frames, 1), 2)

    surprise_delight = count_pattern(tl, [r'(oh and it also|bonus|did i mention|cherry on top|and it gets better|wait there\'s more|and that\'s not all|on top of that|as a bonus|the icing|plus you also get|and here\'s the best part)'])

    # Confidence gradient
    if too_short:
        confidence_gradient = 1
    else:
        first_half_conf = count_pattern(' '.join(sents[:len(sents)//2]).lower() if sents else '', [r'\b(will|definitely|guaranteed|proven|certainly|absolutely)\b'])
        second_half_conf = count_pattern(' '.join(sents[len(sents)//2:]).lower() if sents else '', [r'\b(will|definitely|guaranteed|proven|certainly|absolutely)\b'])
        if second_half_conf > first_half_conf + 1:
            confidence_gradient = 4
        elif second_half_conf > first_half_conf:
            confidence_gradient = 3
        else:
            confidence_gradient = 2

    # Emotional contrast ratio
    if too_short:
        emotional_contrast_ratio = 1
    else:
        neg_intensity = count_pattern(tl, [r'(terrible|awful|nightmare|disaster|painful|miserable|horrible|dread|hate|suffering|hell|chaos|crisis|drowning|exhausted)'])
        pos_intensity = count_pattern(tl, [r'(amazing|incredible|fantastic|brilliant|beautiful|love|perfect|extraordinary|magical|delightful|revolutionary|breakthrough|phenomenal|stunning)'])
        contrast = neg_intensity + pos_intensity
        if contrast >= 6:
            emotional_contrast_ratio = 5
        elif contrast >= 4:
            emotional_contrast_ratio = 4
        elif contrast >= 2:
            emotional_contrast_ratio = 3
        elif contrast >= 1:
            emotional_contrast_ratio = 2
        else:
            emotional_contrast_ratio = 1

    finally_signal = count_pattern(tl, [r'\b(finally|at last|no more|never again|say goodbye to|the wait is over|put an end to|once and for all|kiss.*goodbye|done with|end of|goodbye to|farewell to)\b'])

    # Empathy depth
    if too_short:
        empathy_depth = 1
    else:
        ed = 1
        if empathy_firsthand: ed += 1
        if empathy_observed: ed += 1
        if emotion_specificity >= 3: ed += 1
        if frustration_vocabulary_breadth >= 3: ed += 1
        empathy_depth = min(5, ed)

    # ── C. Product Presentation (17) ──

    # Feature intro velocity (higher = more breathing room)
    if too_short:
        feature_intro_velocity = 3
    else:
        feat_mentions = feature_words + count_pattern(tl, [r'\b(feature|can also|you can|allows you|enables|lets you|supports|includes|comes with|built.?in|offers)\b'])
        if word_count > 0 and feat_mentions > 0:
            words_per_feature = word_count / max(feat_mentions, 1)
            if words_per_feature > 30:
                feature_intro_velocity = 5
            elif words_per_feature > 20:
                feature_intro_velocity = 4
            elif words_per_feature > 12:
                feature_intro_velocity = 3
            elif words_per_feature > 6:
                feature_intro_velocity = 2
            else:
                feature_intro_velocity = 1
        else:
            feature_intro_velocity = 3

    # Orphaned features
    if feature_words == 0:
        orphaned_features = 0.0
    else:
        orphaned_features = round(max(0, 1.0 - (benefit_words / max(feature_words, 1))), 2)
        orphaned_features = min(1.0, orphaned_features)

    demo_voice_present_tense = has_pattern(tl, [r'(i click|i drag|i type|watch as i|see how it|here i|let me click|if i go|when i press|as i scroll|i select|i choose|here you see|now i|now let\'s)'])

    # Concrete vs abstract
    concrete_signals = count_pattern(tl, [r'(\d+%|\$\d|\d+ (hours|minutes|seconds|steps|clicks)|specific|exactly|precisely|for example|for instance|such as|like when|let\'s say|in this case)'])
    abstract_signals = count_pattern(tl, [r'(powerful|robust|comprehensive|innovative|smart|intelligent|advanced|modern|elegant|flexible|dynamic|next.?gen|state.?of.?the.?art|world.?class|enterprise.?grade|scalable|seamless)'])
    if too_short:
        concrete_vs_abstract = 3
    elif concrete_signals > abstract_signals * 2:
        concrete_vs_abstract = 5
    elif concrete_signals > abstract_signals:
        concrete_vs_abstract = 4
    elif abstract_signals > concrete_signals * 2:
        concrete_vs_abstract = 1
    elif abstract_signals > concrete_signals:
        concrete_vs_abstract = 2
    else:
        concrete_vs_abstract = 3

    # Magic moment position (where is the wow moment)
    wow_pats = [r'(the (best|coolest|most impressive|most powerful|magic|amazing) (part|thing|feature)|watch this|check this out|this is where|here\'s the magic|the real power|the killer feature|my favorite|what really sets)']
    magic_pos = relative_position(tl, wow_pats)
    magic_moment_position = magic_pos if magic_pos >= 0 else 0.5

    speed_claims = count_pattern(tl, [r'(in seconds|instantly|10x faster|real.?time|lightning fast|blazing fast|in minutes|faster than|speed|quick|rapid|within seconds|in just \d|takes \d+ seconds|milliseconds|\dx faster)'])

    effort_reduction_specific = has_pattern(tl, [r'(what took \d|from \d+ (hours|minutes|steps|days) to \d|reduces \d+ (steps|hours|minutes) to|instead of \d+ (hours|minutes|steps)|\d+ (hours|minutes|steps) (down|reduced) to|\d+% (less|fewer|reduction))'])

    effort_reduction_vague = has_pattern(tl, [r'(saves? time|easier|simpler|streamline|simplif|less effort|reduce effort|effortless|hassle.?free|no.?brainer|quick|fast|convenient)'])

    integration_count = count_integrations(cleaned)

    progressive_disclosure = has_pattern(tl, [r'(basic|simple|easy).*?(advanced|power|complex|pro|expert)', r'(start with|begin with|at first|basic).*?(then|next|also|plus|for advanced|power users|for pros)'])

    one_more_thing = 0
    if sentence_count >= 5:
        last_20pct = ' '.join(sents[int(len(sents)*0.8):]).lower()
        one_more_thing = has_pattern(last_20pct, [r'(one more thing|oh and|bonus|did i mention|cherry on top|and it gets better|and that\'s not all|also|plus|on top of|last but not least)'])

    simplicity_signals = count_pattern(tl, [r'\b(simple|easy|intuitive|no learning curve|one click|drag and drop|no code|no.?code|low.?code|zero setup|plug and play|out of the box|just \w+|in (one|a single|1) click|with a click|straightforward|user.?friendly|beginner.?friendly)\b'])

    under_the_hood = has_pattern(tl, [r'(built on|powered by|uses? (gpt|openai|llama|mistral|claude|vector|embedding|transformer|bert)|under the hood|behind the scenes|our (engine|algorithm|architecture|model|infrastructure|stack|backend|system)|runs on|leverages? (ai|ml|deep learning)|trained on|fine.?tuned)'])

    # Use case count
    use_case_pats = [
        r'(for (developers|designers|marketers|founders|engineers|managers|teams|companies|startups|enterprises|creators|writers|analysts|researchers|students|teachers|freelancers|agencies|sales|support|hr|product|ops|finance|legal|healthcare|e.?commerce|real estate|saas))',
        r'(whether you\'re a|if you\'re a|perfect for|ideal for|great for|designed for|built for|made for|tailored for|use case|scenario)'
    ]
    use_case_count = count_pattern(tl, use_case_pats)
    use_case_count = min(use_case_count, 10)

    # Liveness score
    live_signals = count_pattern(tl, [r'(let me|i\'m going to|watch me|here i|now i\'ll|as you can see|right here|over here|i\'ll click|let\'s go|here we go|there we go|and boom|voila|ta.?da)'])
    if too_short:
        liveness_score = 1
    elif live_signals >= 5:
        liveness_score = 5
    elif live_signals >= 3:
        liveness_score = 4
    elif live_signals >= 1:
        liveness_score = 3
    elif prod_markers >= 3:
        liveness_score = 1
    else:
        liveness_score = 2

    onboarding_time_claim = has_pattern(tl, [r'(up and running in|deploy in|set up in|start in|get started in|minutes to|seconds to set|ready in|install in|onboard in|import in|connect in|integrate in \d)'])

    comparison_moment = has_pattern(tl, [r'(here\'s the old|here\'s the new|on the left.*on the right|before.*after|side by side|compare|versus|vs|the (old|traditional) way.*the (new|our) way|without.*with \w+)'])

    # ── D. Wording & Rhetoric (16) ──

    # Verb energy
    punchy_verbs = count_pattern(tl, [r'\b(ship|crush|build|launch|nail|smash|blast|slash|hack|automate|fire|blast|kill|dominate|power|rocket|supercharge|turbocharge|skyrocket|explode|ignite)\b'])
    corporate_verbs = count_pattern(tl, [r'\b(utilize|facilitate|leverage|synergize|strategize|operationalize|implement|optimize|maximize|streamline|incentivize|onboard|align|prioritize)\b'])
    if too_short:
        verb_energy = 3
    elif punchy_verbs > corporate_verbs * 2:
        verb_energy = 5
    elif punchy_verbs > corporate_verbs:
        verb_energy = 4
    elif corporate_verbs > punchy_verbs * 2:
        verb_energy = 1
    elif corporate_verbs > punchy_verbs:
        verb_energy = 2
    else:
        verb_energy = 3

    # Sentence rhythm variance
    if sentence_count < 3:
        sentence_rhythm_variance = 1
    else:
        sent_lengths = [len(words(s)) for s in sents]
        if sent_lengths:
            mean_len = sum(sent_lengths) / len(sent_lengths)
            variance = sum((l - mean_len) ** 2 for l in sent_lengths) / len(sent_lengths)
            std = math.sqrt(variance)
            cv = std / max(mean_len, 1)
            if cv > 0.7:
                sentence_rhythm_variance = 5
            elif cv > 0.5:
                sentence_rhythm_variance = 4
            elif cv > 0.3:
                sentence_rhythm_variance = 3
            elif cv > 0.15:
                sentence_rhythm_variance = 2
            else:
                sentence_rhythm_variance = 1
        else:
            sentence_rhythm_variance = 1

    # Power word cluster density
    power_words = r'\b(free|instant|proven|guarantee|exclusive|premium|ultimate|essential|secret|powerful|incredible|amazing|transform|discover|master|unlock|breakthrough|dominate|crush|explode|skyrocket|revolutionary|effortless|automatic)\b'
    pw_positions = [m.start() for m in re.finditer(power_words, tl)]
    clusters = 0
    if len(pw_positions) >= 3:
        for i in range(len(pw_positions) - 2):
            # 3 power words within 100 chars
            if pw_positions[i+2] - pw_positions[i] < 100:
                clusters += 1
    if clusters >= 3:
        power_word_cluster_density = 5
    elif clusters >= 2:
        power_word_cluster_density = 4
    elif clusters >= 1:
        power_word_cluster_density = 3
    elif len(pw_positions) >= 3:
        power_word_cluster_density = 2
    else:
        power_word_cluster_density = 1

    jargon_distribution_shape = detect_jargon_distribution(cleaned)

    anaphora_count_val = 0
    # Look for repeated starts
    if sentence_count >= 3:
        starts = [s.strip().split()[:2] for s in sents if len(s.strip().split()) >= 2]
        start_strs = [' '.join(s).lower() for s in starts]
        start_counter = Counter(start_strs)
        for start, cnt in start_counter.items():
            if cnt >= 2:
                anaphora_count_val += cnt - 1
    # Also check for explicit patterns
    anaphora_count_val += count_pattern(tl, [r'(no more .+\.\s*no more|you can .+\.\s*you can|we .+\.\s*we |every .+\.\s*every |with .+\.\s*with |from .+\.\s*from |stop .+\.\s*stop )'])

    just_minimizer = count_pattern(tl, [r'\bjust (click|drag|drop|connect|type|paste|select|choose|enter|add|tap|press|set|upload|import|install|sign|log|open|hit)\b'])

    # Superlative density
    superlatives = count_pattern(tl, [r'\b(best|most|fastest|only|first|number one|#1|top|greatest|largest|smallest|easiest|simplest|cheapest|smartest|newest|latest)\b'])
    superlative_density = round(superlatives / max(word_count, 1) * 100, 2)

    question_answer_pairs = count_pattern(tl, [r'(\?\s*(simple|easy|well|it\'s|we|our|the answer|here\'s how|by|with|just|because|three|two|one|yes|no|absolutely|exactly)\b)'])

    # Transition sophistication
    basic_transitions = count_pattern(tl, [r'\b(and|also|so|but|then|plus|next)\b'])
    crafted_transitions = count_pattern(tl, [r'(here\'s where|the (real|best|cool) (part|thing|magic)|but (the real|what|here\'s)|now here\'s|and this is where|that\'s (where|when|why)|the beauty|the genius)'])
    if too_short:
        transition_sophistication = 1
    elif crafted_transitions >= 3:
        transition_sophistication = 5
    elif crafted_transitions >= 2:
        transition_sophistication = 4
    elif crafted_transitions >= 1:
        transition_sophistication = 3
    elif basic_transitions >= 5:
        transition_sophistication = 2
    else:
        transition_sophistication = 1

    negation_as_benefit = count_pattern(tl, [r'(no .+ (needed|required)|without .+ing|zero (setup|config|code|cost|effort|maintenance)|never (worry|think|have to)|eliminat|no need (to|for)|don\'t (need|have) to|you don\'t|no more|forget about|skip the|avoid)'])

    # Specificity index
    specific_signals = count_pattern(tl, [r'(\d+%|\$[\d,]+|\d+\.\d|\d+ (users|customers|companies|teams|hours|minutes|seconds|days|months|years|steps|clicks|integrations)|\d+x|\d+ million|\d+ billion|in \d{4})'])
    vague_signals = count_pattern(tl, [r'\b(many|much|significant|great|various|numerous|lots of|a lot|plenty|substantial|considerable|vast|huge|massive|tremendous|enormous)\b'])
    if too_short:
        specificity_index = 1
    elif specific_signals > vague_signals * 3:
        specificity_index = 5
    elif specific_signals > vague_signals * 1.5:
        specificity_index = 4
    elif specific_signals > vague_signals:
        specificity_index = 3
    elif vague_signals > specific_signals:
        specificity_index = 2
    else:
        specificity_index = 2

    you_insertion_rate = round(you_count / max(word_count, 1) * 100, 2)

    cliche_count_val = count_pattern(tl, [r'\b(game.?chang|one.?stop.?shop|seamless|frictionless|empower|unlock|leverage|reimagine|disrupt|paradigm|synerg|holistic|end.?to.?end|turnkey|best.?in.?class|world.?class|next.?gen|state.?of.?the.?art|cutting.?edge|bleeding.?edge|thought leader|low.?hanging fruit|move the needle|circle back|double.?click|deep dive|north star)\b'])

    conditional_density = round(count_pattern(tl, [r'(if you (need|want|have|are|use)|whether you|in case you|when you (need|want|have)|depending on|based on your|for those who)']).real / max(word_count, 1) * 100, 2)

    parallel_structure = count_pattern(tl, [r'(\w+ faster.+\w+ smarter|\w+ more.+\w+ less|build .+\. ship .+\. (scale|grow|launch)|stop .+\. start .+|less .+\. more .+)'])
    parallel_structure += anaphora_count_val  # anaphora is a form of parallel structure

    imperative_count = count_pattern(tl, [r'(?:^|\.\s+)(try |check |stop |start |sign |get |join |visit |download |click |go to |head |look |see |watch |imagine |picture |think |discover |explore |build |create |make |use |set |run |open |find |grab |take |book |schedule )\b'])
    imperative_density = round(imperative_count / max(word_count, 1) * 100, 2)

    # ── E. Persuasion Psychology (17) ──

    # Word rarity score
    common_words = set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
                        'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
                        'on', 'with', 'at', 'by', 'from', 'up', 'about', 'into', 'through',
                        'during', 'before', 'after', 'above', 'below', 'between', 'out',
                        'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
                        'there', 'when', 'where', 'why', 'how', 'all', 'both', 'each',
                        'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
                        'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'don',
                        'now', 'and', 'but', 'or', 'if', 'because', 'as', 'until', 'while',
                        'it', 'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
                        'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their',
                        'what', 'which', 'who', 'whom', 'get', 'got', 'like', 'also', 'one',
                        'make', 'go', 'going', 'know', 'see', 'want', 'come', 'think', 'look',
                        'use', 'find', 'give', 'tell', 'say', 'said', 'take', 'put', 'let',
                        'way', 'thing', 'really', 'well', 'even', 'new', 'good', 'right',
                        'still', 'much', 'time', 'day', 'work', 'need', 'help'])
    if word_count < 10:
        word_rarity_score = 1
    else:
        rare = sum(1 for wd in w if wd not in common_words and len(wd) > 6)
        rare_ratio = rare / max(word_count, 1)
        if rare_ratio > 0.15:
            word_rarity_score = 5
        elif rare_ratio > 0.10:
            word_rarity_score = 4
        elif rare_ratio > 0.06:
            word_rarity_score = 3
        elif rare_ratio > 0.03:
            word_rarity_score = 2
        else:
            word_rarity_score = 1

    qualifying_retreat = count_pattern(tl, [r'(well.{0,15}(one of|at least|or rather|kind of|in a way)|the best.{0,10}well|revolutionary.{0,15}(or|well|at least)|actually.{0,15}(more like|sort of))'])

    # Conclusive finality
    if too_short:
        conclusive_finality = 1
    else:
        last_sent = sents[-1].lower() if sents else ''
        has_decisive_close = has_pattern(last_sent, [r'(try it|get started|sign up|join|visit|today|now|don\'t wait|start|the future|welcome to|go to|check out|download)'])
        has_trailing = has_pattern(last_sent, [r'(so yeah|that\'s it|thanks|bye|okay|um|uh|yeah)'])
        if has_decisive_close and not has_trailing:
            conclusive_finality = 5
        elif has_decisive_close:
            conclusive_finality = 4
        elif closing_has_cta:
            conclusive_finality = 3
        elif has_trailing:
            conclusive_finality = 1
        else:
            conclusive_finality = 2

    social_proof_stacking_order = detect_social_proof_stacking(cleaned)

    authority_type = detect_authority_type(cleaned)

    reciprocity_trigger = has_pattern(tl, [r'(free (tier|plan|trial|version|template|tool|resource)|open source|no credit card|free to (use|try|start)|completely free|100% free|free forever|generous free|free account)'])

    anchor_contrast_pricing = has_pattern(tl, [r'(\$\d+.{0,30}\$\d+|cost.{0,30}we.{0,15}\$|enterprise.{0,30}\$|typically.{0,20}\$|usually.{0,20}\$|compared to.{0,20}\$|fraction of)'])

    contrast_pairs = count_pattern(tl, [r'(instead of|not .{1,20} but|unlike|while others|where .{1,20} we|rather than|opposed to|in contrast|on the other hand|whereas|the difference is)'])

    # Certainty ratio
    certain_words = count_pattern(tl, [r'\b(will|definitely|guaranteed|proven|ensure|certainly|absolutely|always|every time|without fail|100%|undoubtedly|for sure|no doubt)\b'])
    uncertain_words = count_pattern(tl, [r'\b(maybe|perhaps|might|could|possibly|probably|potentially|sometimes|occasionally|in some cases|depending|if|whether)\b'])
    if certain_words + uncertain_words == 0:
        certainty_ratio = 0.5
    else:
        certainty_ratio = round(certain_words / max(certain_words + uncertain_words, 1), 2)

    in_group_language = count_pattern(tl, [r'(as (developers|designers|founders|engineers|marketers|builders|creators) we|fellow (founder|developer|designer|engineer|creator|builder)|if you\'re like (us|me)|we\'ve all|you know (how|what) it\'s like|as someone who|in our (community|industry|space|field))'])

    objection_preempt = count_pattern(tl, [r'(you might be wondering|you might think|don\'t worry|and yes|but what about|concerned about|worried about|security|privacy|compliance|gdpr|soc|hipaa|enterprise.?ready|enterprise.?grade|99\.\d+% uptime|encrypted|secure)'])

    scarcity_type = detect_scarcity_type(cleaned)

    # Bandwagon gradient
    bandwagon_gradient = 0
    social_proof_positions = []
    for m in re.finditer(r'\d+[,.]?\d*\s*(users|customers|companies|teams|developers|downloads)', tl):
        social_proof_positions.append(m.start() / max(len(tl), 1))
    if len(social_proof_positions) >= 2:
        if social_proof_positions[-1] > social_proof_positions[0]:
            bandwagon_gradient = 1

    # Choice architecture
    tier_signals = count_pattern(tl, [r'(free plan|pro plan|premium|enterprise|basic|starter|professional|business|team plan|individual|personal|standard|advanced|ultimate)'])
    choice_architecture = min(tier_signals, 5)

    cognitive_ease = count_pattern(tl, [r'(one click|automatic|zero config|plug and play|set it and forget|instant|effortless|no setup|no install|no download|no sign.?up|no login|no registration|works out of the box|auto.?pilot|hands.?free|turnkey|ready.?made|pre.?built)'])

    everyone_else_maneuver = count_pattern(tl, [r'(most (teams|companies|people|developers)|industry standard|your competitors|leading companies|top (companies|teams|brands)|everyone (is|has)|the (industry|market) (is|has)|already (using|adopted)|don\'t get left|while you\'re still)'])

    future_self_projection = count_pattern(tl, [r'(you\'ll become|imagine yourself|be the (one|person) who|your future (self|team|company)|you\'ll (never|finally|be able)|picture yourself|envision your|you will be|where you\'ll be)'])

    # ── F. Structure & Timing (16) ──

    info_density_shape = detect_info_density_shape(cleaned)

    # Breathing room
    if too_short:
        breathing_room = 3
    elif word_count == 0:
        breathing_room = 3
    else:
        words_per_sent = word_count / max(sentence_count, 1)
        if words_per_sent > 25:
            breathing_room = 2  # Dense sentences
        elif words_per_sent > 18:
            breathing_room = 3
        elif words_per_sent > 12:
            breathing_room = 4
        else:
            breathing_room = 3  # Could be too choppy
        # Adjust for feature density
        feat_density = feature_words / max(word_count, 1)
        if feat_density > 0.05:
            breathing_room = max(1, breathing_room - 1)
        elif feat_density < 0.01:
            breathing_room = min(5, breathing_room + 1)

    # Cold open words
    product_mention_pat = r'(our (tool|platform|app|product|solution)|introducing|meet \w+|welcome to|called \w+|named \w+)'
    if name:
        product_mention_pat = f'({name.lower()}|{product_mention_pat})'
    cold_open_m = re.search(product_mention_pat, tl)
    if cold_open_m:
        cold_open_text = tl[:cold_open_m.start()]
        cold_open_words = len(words(cold_open_text))
    else:
        cold_open_words = word_count  # Product never mentioned by pattern

    callback_count = count_pattern(tl, [r'(remember (that|when|earlier|what)|going back to|as i (mentioned|said|showed)|earlier (i|we)|this ties back|back to what|recall (that|when)|like i said|as we (discussed|saw))'])

    # Section length CV
    if too_short or sentence_count < 4:
        section_length_cv = 1
    else:
        # Divide transcript into sections by transition markers
        section_markers = list(re.finditer(r'\b(but|however|now|next|also|another|additionally|furthermore|moving on|first|second|third|finally)\b', tl))
        if len(section_markers) >= 2:
            section_sizes = []
            prev = 0
            for sm in section_markers:
                section_sizes.append(sm.start() - prev)
                prev = sm.start()
            section_sizes.append(len(tl) - prev)
            if section_sizes:
                mean_s = sum(section_sizes) / len(section_sizes)
                var_s = sum((s - mean_s) ** 2 for s in section_sizes) / len(section_sizes)
                cv_s = math.sqrt(var_s) / max(mean_s, 1)
                if cv_s > 1.0:
                    section_length_cv = 5
                elif cv_s > 0.7:
                    section_length_cv = 4
                elif cv_s > 0.4:
                    section_length_cv = 3
                elif cv_s > 0.2:
                    section_length_cv = 2
                else:
                    section_length_cv = 1
            else:
                section_length_cv = 1
        else:
            section_length_cv = 2

    # Promise proof push
    has_promise = 1 if has_pattern(tl, [r'(helps|enables|allows|lets you|saves|reduces|improves|automates|simplifies|streamlines|transforms|makes|gives you|provides|delivers|offers)']) else 0
    has_proof = 1 if (success_users > 0 or success_revenue > 0 or has_testimonial or trusted_by or has_credential) else 0
    has_push = 1 if (closing_has_cta or primary_cta != "none") else 0
    promise_proof_push = float(has_promise + has_proof + has_push)

    # First feature position
    feature_pats = [r'(feature|you can|allows you|enables you|lets you|with our|using our|our (tool|platform|app)|the (tool|platform|app) (can|will|lets|allows|enables))']
    first_feat_pos = relative_position(tl, feature_pats)
    first_feature_position = first_feat_pos if first_feat_pos >= 0 else 0.3

    parenthetical_credibility = count_pattern(tl, [r'(by the way|incidentally|oh and|which (happens to|also)|as (it happens|you may know)|\(.*?(users|customers|companies|revenue|funded|raised|backed).*?\))'])

    section_boundary_markers = count_pattern(tl, [r'\b(number one|number two|number three|first(ly)?|second(ly)?|third(ly)?|fourth|fifth|next|finally|lastly|let\'s move on|moving on|the (first|second|third|next|last) (thing|feature|benefit|reason))\b'])

    # Setup payoff distance
    if too_short:
        setup_payoff_distance = 1.0
    elif relief_distance >= 5:
        setup_payoff_distance = 5.0
    elif relief_distance >= 3:
        setup_payoff_distance = 4.0
    elif relief_distance >= 2:
        setup_payoff_distance = 3.0
    elif relief_distance >= 1:
        setup_payoff_distance = 2.0
    else:
        setup_payoff_distance = 1.0

    multi_persona_address = count_pattern(tl, [r'(for (developers|designers|marketers|founders|engineers|managers|teams|companies|startups|enterprises|creators|writers|analysts|researchers|students|agencies|sales|support|product managers|freelancers|solopreneurs)|whether you\'re a|if you\'re a)'])
    multi_persona_address = min(multi_persona_address, 8)

    # Voice consistency
    if too_short:
        voice_consistency = 3
    else:
        i_count = count_pattern(tl, [r'\bi\b'])
        shifts = 0
        prev_voice = None
        for s in sents:
            sl = s.lower()
            has_i = bool(re.search(r'\bi\b', sl))
            has_we_s = bool(re.search(r'\bwe\b', sl))
            has_you_s = bool(re.search(r'\byou\b', sl))
            if has_i and not has_we_s:
                voice = 'i'
            elif has_we_s and not has_i:
                voice = 'we'
            elif has_you_s:
                voice = 'you'
            else:
                voice = None
            if voice and prev_voice and voice != prev_voice:
                shifts += 1
            if voice:
                prev_voice = voice
        shift_rate = shifts / max(sentence_count, 1)
        if shift_rate > 0.4:
            voice_consistency = 1
        elif shift_rate > 0.3:
            voice_consistency = 2
        elif shift_rate > 0.2:
            voice_consistency = 3
        elif shift_rate > 0.1:
            voice_consistency = 4
        else:
            voice_consistency = 5

    counterfactual_count = count_pattern(tl, [r'(what if you (didn\'t|could|had)|without this|imagine not|if you (had|didn\'t)|what would happen|how would you|where would you be)'])

    # Closing velocity
    if too_short or sentence_count < 3:
        closing_velocity = 3
    else:
        last_third_sents = sents[2*len(sents)//3:]
        if last_third_sents:
            last_sent_lens = [len(words(s)) for s in last_third_sents]
            avg_last = sum(last_sent_lens) / max(len(last_sent_lens), 1)
            all_sent_lens = [len(words(s)) for s in sents]
            avg_all = sum(all_sent_lens) / max(len(all_sent_lens), 1)
            if avg_last < avg_all * 0.6:
                closing_velocity = 5
            elif avg_last < avg_all * 0.8:
                closing_velocity = 4
            elif avg_last < avg_all * 1.0:
                closing_velocity = 3
            elif avg_last < avg_all * 1.2:
                closing_velocity = 2
            else:
                closing_velocity = 1
        else:
            closing_velocity = 3

    open_loop_closing = 0
    definitive_closing_val = 0
    if sents:
        last_sent_text = sents[-1].lower() if sents else ''
        last_2_text = ' '.join(sents[-2:]).lower() if len(sents) >= 2 else last_sent_text
        open_loop_closing = has_pattern(last_2_text, [r'(just the beginning|much more to come|stay tuned|wait until|v2|coming soon|more features|more to come|roadmap|future|we\'re just getting started|this is only|the beginning)'])
        definitive_closing_val = has_pattern(last_2_text, [r'(try it|get started|sign up|join|visit|today|now|download|check out|head over|go to|\.com|\.io|\.ai|start your|create your|begin your)'])

    # ── Assemble result ──
    result = {
        "id": tid,
        # V1: Opening
        "hook_type": hook_type,
        "first_person_opener": first_person_opener,
        "has_negative_opener": has_negative_opener,
        "first_sentence_words": first_sent_words,
        "hook_quality": hook_quality,
        # V1: Length & Readability
        "word_count": word_count,
        "sentence_count": sentence_count,
        "avg_sentence_length": avg_sent_len,
        "flesch_kincaid_grade": fk_grade,
        "word_diversity": word_div,
        "syllable_density": syll_density,
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
        "production_markers": prod_markers,
        "speaker_changes": speaker_ch,
        "action_verb_count": action_verbs,
        "feature_words": feature_words,
        "benefit_words": benefit_words,
        "benefit_ratio": benefit_ratio,
        "question_count": question_count,
        "passive_voice_count": passive_voice_count,
        # V1: Sentiment
        "sentiment": sentiment,
        "confidence_count": confidence_count,
        "product_name_repeats": product_name_repeats,
        # V2 A: Story Architecture
        "inciting_incident": inciting_incident,
        "villain_named": villain_named,
        "villain_count": villain_count_val,
        "stakes_escalation": stakes_escalation,
        "transformation_promise": transformation_promise,
        "transformation_position": transformation_position_val,
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
        # V2 B: Emotional Mechanics
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
        # V2 C: Product Presentation
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
        # V2 D: Wording & Rhetoric
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
        # V2 E: Persuasion Psychology
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
        # V2 F: Structure & Timing
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
        "definitive_closing": definitive_closing_val,
    }

    return result


# ── Main ─────────────────────────────────────────────────────────────

def main():
    input_path = 'launch-video-analysis/ph/v2-llm-parts/input_batch_10.json'
    output_path = 'launch-video-analysis/ph/v2-llm-parts/output_batch_10.json'

    with open(input_path) as f:
        data = json.load(f)

    results = []
    for item in data:
        result = extract_dimensions(item)
        results.append(result)

    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"Processed {len(results)} transcripts")
    print(f"Dimensions per transcript: {len(results[0]) - 1}")  # -1 for id
    print(f"Output written to {output_path}")

if __name__ == '__main__':
    main()
