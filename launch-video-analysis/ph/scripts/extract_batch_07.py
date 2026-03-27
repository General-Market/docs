#!/usr/bin/env python3
"""
Extract 200 dimensions from Product Hunt launch video transcripts.
Batch 07 — 85 transcripts.
Uses heuristic NLP analysis with semantic understanding.
"""

import json
import re
import math
from collections import Counter

# ── Helpers ──────────────────────────────────────────────────────────────

def clean_transcript(text):
    """Remove production markers but count them first."""
    return text

def count_production_markers(text):
    return len(re.findall(r'\[(?:Music|Applause|Laughter|Sound|Noise|Clapping)\]', text, re.IGNORECASE))

def strip_markers(text):
    """Remove [Music], [Applause] etc for analysis."""
    return re.sub(r'\[(?:Music|Applause|Laughter|Sound|Noise|Clapping|Foreign)\]', '', text, flags=re.IGNORECASE).strip()

def sentences(text):
    """Split text into sentences. For spoken transcripts with minimal punctuation,
    also split on long clauses."""
    text = strip_markers(text)
    # Split on sentence-ending punctuation
    sents = re.split(r'(?<=[.!?])\s+', text)
    # For segments that are very long (spoken transcript, no punctuation),
    # split on commas, "and", "so", "but" etc as clause boundaries
    result = []
    for s in sents:
        s = s.strip()
        if not s:
            continue
        w = s.split()
        if len(w) > 40:
            # Split long unpunctuated segments into clause-like chunks
            sub_sents = re.split(r'(?:,\s+|\s+(?:and|but|so|because|then|or|also|now|which|where|when|if|that|because)\s+)', s)
            for ss in sub_sents:
                ss = ss.strip()
                if ss:
                    result.append(ss)
        else:
            result.append(s)
    return result if result else [text]

def words(text):
    """Extract words from text."""
    text = strip_markers(text)
    return re.findall(r"[a-zA-Z0-9']+(?:-[a-zA-Z0-9']+)*", text.lower())

def syllable_count(word):
    """Estimate syllable count for a word."""
    word = word.lower()
    if len(word) <= 3:
        return 1
    count = 0
    vowels = 'aeiouy'
    if word[0] in vowels:
        count += 1
    for i in range(1, len(word)):
        if word[i] in vowels and word[i-1] not in vowels:
            count += 1
    if word.endswith('e'):
        count -= 1
    if word.endswith('le') and len(word) > 2 and word[-3] not in vowels:
        count += 1
    return max(count, 1)

def flesch_kincaid(word_list, sent_list):
    if not sent_list or not word_list:
        return 0.0
    total_syllables = sum(syllable_count(w) for w in word_list)
    return 0.39 * (len(word_list) / max(len(sent_list),1)) + 11.8 * (total_syllables / max(len(word_list),1)) - 15.59

def count_pattern(text, patterns):
    """Count occurrences of regex patterns in text."""
    total = 0
    for p in patterns:
        total += len(re.findall(p, text, re.IGNORECASE))
    return total

def first_sentence(text):
    text = strip_markers(text).strip()
    # Find first sentence boundary
    m = re.search(r'[.!?]', text)
    if m:
        return text[:m.end()].strip()
    # No punctuation — take first ~30 words
    w = text.split()[:30]
    return ' '.join(w)

def get_sections(text, n=4):
    """Divide text into n roughly equal sections."""
    w = words(text)
    if not w:
        return [[] for _ in range(n)]
    chunk = max(len(w) // n, 1)
    return [w[i*chunk:(i+1)*chunk] for i in range(n)]

def position_of_first_match(text, patterns):
    """Return position (0-1) of first match, or -1 if not found."""
    text_lower = text.lower()
    total_len = max(len(text_lower), 1)
    earliest = total_len + 1
    for p in patterns:
        m = re.search(p, text_lower)
        if m:
            earliest = min(earliest, m.start())
    if earliest > total_len:
        return -1.0
    return earliest / total_len

def position_of_last_match(text, patterns):
    """Return position (0-1) of last match, or -1 if not found."""
    text_lower = text.lower()
    total_len = max(len(text_lower), 1)
    latest = -1
    for p in patterns:
        for m in re.finditer(p, text_lower):
            latest = max(latest, m.start())
    if latest == -1:
        return -1.0
    return latest / total_len


# ── Main extraction ─────────────────────────────────────────────────────

def extract_dimensions(item):
    tid = item["id"]
    raw = item.get("transcript", "")
    text = strip_markers(raw)
    text_lower = text.lower()
    w = words(text)
    word_count = len(w)
    sent_list = sentences(text)
    sent_count = len(sent_list)
    fs = first_sentence(raw)
    fs_words = words(fs)

    # Avoid division by zero
    wc = max(word_count, 1)
    sc = max(sent_count, 1)

    # Word frequency
    word_freq = Counter(w)
    unique_words = len(word_freq)

    # ── V1: OPENING ──

    # hook_type detection
    fs_lower = fs.lower()
    if re.search(r'^(hey|hi|hello|what\'?s up|greetings|good morning|good afternoon|welcome)', fs_lower):
        hook_type = "greeting"
    elif re.search(r'^(we\'?re? (excited|thrilled|proud|happy)|announcing|introducing|we just|we launched|today we)', fs_lower):
        hook_type = "announcement"
    elif re.search(r'\?$|\?', fs_lower):
        hook_type = "question"
    elif re.search(r'^(imagine|picture|think about|what if)', fs_lower):
        hook_type = "bold_claim"
    elif re.search(r'(tired|frustrated|hate|broken|struggle|annoying|painful|sick of|fed up)', fs_lower):
        hook_type = "pain_point"
    elif re.search(r'(I was|my story|when I|years ago|back in|I used to|I remember)', fs_lower):
        hook_type = "founder_story"
    elif re.search(r'(let me show|click|watch|demo|walkthrough|i\'ll show)', fs_lower):
        hook_type = "demo_instruction"
    elif re.search(r'\d+%|\d+x|\d+ (million|billion|thousand|users|customers)', fs_lower):
        hook_type = "stat_number"
    elif re.search(r'^(so |basically |this is |it\'s |we built|we created|we made|our product)', fs_lower):
        hook_type = "product_statement"
    else:
        hook_type = "descriptive"

    first_person_opener = 1 if re.match(r'^\s*(i |i\'|we |we\')', fs_lower) else 0
    has_negative_opener = 1 if re.search(r'(broken|tired|hate|frustrated|problem|struggle|annoying|painful|fed up|sick of|difficult|hard|waste|mess|chaos|nightmare)', fs_lower) else 0
    first_sentence_words = len(fs_words)

    # hook_quality (1-5) — how attention-grabbing is the opening?
    hq = 3.0
    if hook_type in ("pain_point", "bold_claim", "question"):
        hq += 1.5
    elif hook_type in ("stat_number", "founder_story"):
        hq += 1.0
    elif hook_type in ("announcement", "demo_instruction"):
        hq += 0.5
    elif hook_type == "product_statement":
        hq -= 0.5
    elif hook_type == "descriptive":
        hq -= 0.5
    # greeting is neutral — don't penalize it, since most PH videos start this way
    # Instead, look at what FOLLOWS the greeting in the first 2 sentences
    if hook_type == "greeting":
        first_2 = ' '.join(sent_list[:2]).lower() if len(sent_list) >= 2 else fs_lower
        if re.search(r'(problem|challenge|frustrat|tired|struggle|pain|hate)', first_2):
            hq += 0.5
        elif re.search(r'(excited|introducing|proud|launch|release|built)', first_2):
            hq += 0.5
        elif re.search(r'(imagine|what if|picture|have you)', first_2):
            hq += 1.0
    if has_negative_opener:
        hq += 0.5
    if first_sentence_words < 5 and word_count < 30:
        hq -= 1  # too short to judge
    if first_sentence_words > 25:
        hq -= 0.5  # too long for a hook
    if re.search(r'(imagine|what if|picture this)', fs_lower):
        hq += 1
    if re.search(r'(have you ever|do you|are you|ever (tried|wished|wanted|wondered))', fs_lower):
        hq += 0.5
    if word_count > 300 and first_sentence_words < 12:
        hq += 0.5  # concise opener on a substantial transcript
    hook_quality = max(1, min(5, round(hq)))

    # ── V1: LENGTH & READABILITY ──
    avg_sentence_length = round(wc / sc, 1)
    fk_grade = round(flesch_kincaid(w, sent_list), 1)
    word_diversity = round(unique_words / wc, 3) if wc > 0 else 0
    syllable_dens = round(sum(syllable_count(wd) for wd in w) / wc, 2) if wc > 0 else 0

    # ── V1: PRONOUNS & VOICE ──
    we_count = count_pattern(text, [r'\bwe\b', r'\bour\b', r'\bus\b'])
    you_count = count_pattern(text, [r'\byou\b', r'\byour\b', r"\byou're\b", r"\byou've\b", r"\byou'll\b"])

    if we_count > you_count * 1.5:
        pronoun_strategy = "mostly_we"
    elif you_count > we_count * 1.5:
        pronoun_strategy = "mostly_you"
    elif we_count + you_count < 3:
        pronoun_strategy = "neutral"
    else:
        pronoun_strategy = "balanced"

    hedge_count = count_pattern(text, [r'\bmaybe\b', r'\bperhaps\b', r'\bmight\b', r'\bkind of\b', r'\bsort of\b', r'\barguably\b', r'\bprobably\b', r'\bi think\b', r'\bi guess\b'])
    filler_count = count_pattern(text, [r'\bum\b', r'\buh\b', r'\blike\b(?!\s+(?:a|an|the|this|that))', r'\bbasically\b', r'\bactually\b', r'\bliterally\b', r'\bso yeah\b', r'\byou know\b'])

    # ── V1: NARRATIVE ARC ──
    # Determine problem vs solution portions
    problem_words = count_pattern(text, [r'\bproblem\b', r'\bchallenge\b', r'\bstruggle\b', r'\bfrustrat', r'\bpain\b', r'\bdifficult\b', r'\bhard\b', r'\bcomplex\b', r'\bconfus', r'\bwaste\b', r'\bmanual', r'\btedious\b', r'\btime.?consuming\b', r'\bbroken\b', r'\bmess\b', r'\bchaos\b'])
    solution_words = count_pattern(text, [r'\bsolution\b', r'\bsolve\b', r'\bfix\b', r'\bhelp\b', r'\benable\b', r'\ballow\b', r'\bautomat', r'\bsimplif', r'\bstreamline\b', r'\bour (?:tool|product|platform|app|software)\b', r'\bintroduc', r'\bbuilt\b', r'\bcreated\b', r'\bfeature\b'])

    total_ps = max(problem_words + solution_words, 1)
    problem_pct = round(problem_words / total_ps * 100, 1)
    solution_pct = round(solution_words / total_ps * 100, 1)

    if word_count < 30:
        narrative_arc = "too_short"
    elif problem_pct > 60:
        narrative_arc = "problem_heavy"
    elif solution_pct > 70 and problem_pct < 15:
        narrative_arc = "solution_first"
    elif problem_words > 0 and solution_words > 0:
        # Check if problem comes before solution
        first_problem_pos = position_of_first_match(text, [r'\bproblem\b', r'\bchallenge\b', r'\bstruggle\b', r'\bfrustrat', r'\bpain\b', r'\bdifficult\b'])
        first_solution_pos = position_of_first_match(text, [r'\bsolution\b', r'\bsolve\b', r'\bour (?:tool|product|platform)\b', r'\bintroduc', r'\bbuilt\b'])
        if first_problem_pos >= 0 and first_solution_pos >= 0 and first_problem_pos < first_solution_pos:
            narrative_arc = "problem_solution"
        elif first_solution_pos >= 0 and (first_problem_pos < 0 or first_solution_pos < first_problem_pos):
            narrative_arc = "solution_first"
        else:
            narrative_arc = "neutral_flat"
    else:
        narrative_arc = "neutral_flat"

    # Check for traction-first
    traction_patterns = [r'\b\d+[,.]?\d*\s*(users|customers|companies|teams|downloads)', r'\b\d+[kKmM]\b', r'\$\d+', r'\bARR\b', r'\brevenue\b', r'\bgrowth\b']
    first_traction = position_of_first_match(text, traction_patterns)
    if first_traction >= 0 and first_traction < 0.15 and narrative_arc == "neutral_flat":
        narrative_arc = "traction_first"

    # topic_transitions
    transition_markers = count_pattern(text, [r'\bbut\b', r'\bhowever\b', r'\bnow\b(?!\s+let)', r'\bso\b(?!\s+yeah)', r'\blet me\b', r'\bmoving on\b', r'\bnext\b', r'\balso\b', r'\banother\b', r'\bon top of\b', r'\baddition', r'\bbesides\b', r'\bfurthermore\b'])
    topic_transitions = min(transition_markers, 15)

    # declining_arc
    sections = get_sections(text, 4)
    last_section_text = ' '.join(sections[-1]) if sections[-1] else ''
    declining_arc = 1 if re.search(r'(hurry|limited|don\'t miss|act now|before it\'s too late|running out|last chance|urgency)', last_section_text) else 0

    # ── V1: METRICS & TRACTION ──
    numbers = re.findall(r'\b\d+[,.]?\d*%?\b', text)
    number_count = len(numbers)
    number_density = round(number_count / wc * 100, 2) if wc > 0 else 0

    # metric_placement
    quarter = max(len(text) // 4, 1)
    front_nums = len(re.findall(r'\b\d+[,.]?\d*%?\b', text[:quarter]))
    mid_nums = len(re.findall(r'\b\d+[,.]?\d*%?\b', text[quarter:3*quarter]))
    back_nums = len(re.findall(r'\b\d+[,.]?\d*%?\b', text[3*quarter:]))
    if number_count == 0:
        metric_placement = "none"
    elif front_nums >= mid_nums and front_nums >= back_nums:
        metric_placement = "front"
    elif back_nums >= mid_nums:
        metric_placement = "back"
    else:
        metric_placement = "middle"

    before_after_total = count_pattern(text, [r'\bbefore\b.*\bafter\b', r'\bused to\b.*\bnow\b', r'\binstead of\b', r'\bwent from\b', r'\bfrom\b.*\bto\b.*\b\d+', r'\bcompare\b'])
    success_users = count_pattern(text, [r'\b\d+[,.]?\d*[kKmM]?\s*(users|customers|companies|teams|people|members|creators|developers|businesses)\b'])
    success_revenue = count_pattern(text, [r'\$\d+[,.]?\d*[kKmM]?\s*(ARR|MRR|revenue|sales)?', r'\bARR\b', r'\bMRR\b', r'\brevenue\b'])
    success_cost_savings = count_pattern(text, [r'\bsav(e|es|ed|ing)\b.*\$', r'\breduc(e|es|ed|ing)\b.*cost', r'\bcost\b.*\b(less|lower|reduc|sav)', r'\bcheaper\b'])
    success_growth = count_pattern(text, [r'\b\d+[xX%]\b.*\b(growth|increase|more|faster|improvement)\b', r'\bgrow(th|ing|n)\b', r'\bscal(e|ed|ing)\b'])

    # ── V1: SOCIAL PROOF ──
    # Brand detection - look for capitalized words that look like brands
    brand_patterns = re.findall(r'\b[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?\b', text)
    # Filter common non-brand capitals
    non_brands = {'I', 'The', 'This', 'That', 'It', 'We', 'So', 'But', 'And', 'Or', 'If', 'My', 'Our', 'Your', 'Now', 'Here', 'There', 'What', 'How', 'Why', 'When', 'Where', 'Who', 'Can', 'Will', 'Just', 'Let', 'Hey', 'Hi', 'Hello', 'Okay', 'Right', 'Well', 'Oh', 'Yes', 'No', 'Not', 'All', 'Also', 'Even', 'First', 'Second', 'Third', 'Next', 'Then', 'After', 'Before', 'About', 'With', 'From', 'Into', 'Over', 'Like', 'Every', 'Each', 'Any', 'Some', 'Other', 'More', 'Most', 'Much', 'Many', 'Very', 'Really', 'Actually', 'Basically', 'Pretty'}
    known_brands = set()
    for b in brand_patterns:
        if b not in non_brands and len(b) > 2:
            known_brands.add(b)
    # Also check for known tech brands
    tech_brands = ['Google', 'Amazon', 'Microsoft', 'Apple', 'Facebook', 'Meta', 'Slack', 'Notion', 'Figma', 'GitHub', 'Stripe', 'Shopify', 'Salesforce', 'HubSpot', 'Zapier', 'Jira', 'Trello', 'Asana', 'Discord', 'Zoom', 'ChatGPT', 'OpenAI', 'AWS', 'Azure', 'Vercel', 'Netlify', 'Twitter', 'LinkedIn', 'Instagram', 'TikTok', 'YouTube', 'Spotify', 'Netflix', 'Uber', 'Airbnb', 'Dropbox', 'Airtable', 'Intercom', 'Segment', 'Twilio', 'SendGrid', 'Mailchimp', 'WordPress', 'Webflow', 'Canva', 'Loom', 'Miro', 'Linear', 'Supabase', 'Firebase', 'MongoDB', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'Terraform', 'React', 'Angular', 'Vue', 'Svelte', 'Next', 'Nuxt', 'Chrome', 'Safari', 'Firefox', 'Excel', 'PowerPoint', 'Photoshop', 'Illustrator', 'Confluence', 'Monday']
    found_brands = set()
    for tb in tech_brands:
        if re.search(r'\b' + re.escape(tb) + r'\b', text, re.IGNORECASE):
            found_brands.add(tb)
    brand_count = len(found_brands)

    has_investor_mention = 1 if re.search(r'\b(investor|funded|raised|seed|series [a-c]|vc |venture|backed by|yc |y combinator|angel)', text_lower) else 0
    has_testimonial = 1 if re.search(r'(\"[^\"]{10,}\"|\u201c|\btestimoni|\bsaid\b|\baccording to\b|\bone user\b|\bcustomer said\b|\btold us\b)', text_lower) else 0
    trusted_by = 1 if re.search(r'\btrusted by\b', text_lower) else 0
    has_partnership = 1 if re.search(r'\bpartner(ship|ed|ing)?\b|\bintegrat(e|ed|ion)\b.*\bwith\b|\bcollaborat', text_lower) else 0
    has_credential = 1 if re.search(r'\b(ex-|former)\s*(google|meta|facebook|amazon|apple|microsoft|stripe|uber|airbnb)|\bphd\b|\bstanford\b|\bmit\b|\bharvard\b|\byc\b|\by combinator\b|\b\d+ years? (of )?experience\b', text_lower) else 0

    social_proof_claims = has_investor_mention + has_testimonial + trusted_by + has_partnership + has_credential + min(success_users, 1) + min(brand_count, 1)

    platform_mentions = brand_count

    competitive_total = count_pattern(text, [r'\bunlike\b', r'\bcompared to\b', r'\bcompetitor', r'\balternative\b', r'\bbetter than\b', r'\bvs\b', r'\bversus\b', r'\bother (?:tools|platforms|solutions)\b'])
    replacement_total = count_pattern(text, [r'\breplace\b', r'\bswitch from\b', r'\binstead of\b.*(?:using|paying)', r'\bforget\b.*\babout\b', r'\bstop using\b', r'\bno more\b.*(?:manual|spreadsheet|email)'])

    # ── V1: CATEGORY & POSITIONING ──
    category_creation_total = count_pattern(text, [r'\bthe first\b', r'\bthe only\b', r'\ba new kind\b', r'\bwe invented\b', r'\bnever been done\b', r'\bfirst of its kind\b', r'\bpioneering\b', r'\bworld\'?s first\b'])
    ai_count = count_pattern(text, [r'\bai\b', r'\bartificial intelligence\b', r'\bmachine learning\b', r'\bml\b', r'\bdeep learning\b', r'\bneural\b', r'\bgpt\b', r'\bllm\b', r'\blarge language model\b', r'\bnatural language\b'])
    ai_density = round(ai_count / wc * 100, 2) if wc > 0 else 0
    buzzword_count = count_pattern(text, [r'\brevolution', r'\bgame.?chang', r'\bcutting.?edge\b', r'\bnext.?gen', r'\bworld.?class\b', r'\bstate.?of.?the.?art\b', r'\bseamless\b', r'\bfrictionless\b', r'\bdisrupt', r'\binnovati', r'\btransform', r'\bbreakthrough\b', r'\bunprecedented\b', r'\bholistic\b', r'\bsynerg', r'\bparadigm\b', r'\bscalable\b'])

    # ── V1: CTA & CLOSING ──
    last_section = text[-(min(len(text), 300)):]
    last_lower = last_section.lower()

    cta_patterns = {
        'waitlist': r'\bwaitlist\b|\bwait list\b|\bjoin.*wait',
        'join': r'\bjoin\b',
        'sign_up': r'\bsign up\b|\bsign.?up\b|\bregister\b',
        'try': r'\btry\b|\btry it\b|\bgive it a try\b',
        'get_started': r'\bget started\b',
        'book_demo': r'\bbook.*demo\b|\bschedule.*demo\b|\brequest.*demo\b',
        'free': r'\bfree\b.*\b(trial|tier|plan|version|today)\b|\bfor free\b',
        'beta': r'\bbeta\b',
        'limited': r'\blimited\b.*\b(access|spots|time)\b'
    }

    primary_cta = "none"
    for cta_name, cta_pat in cta_patterns.items():
        if re.search(cta_pat, text_lower):
            primary_cta = cta_name
            break

    # cta_position
    cta_found_pos = position_of_first_match(text, [v for v in cta_patterns.values()])
    if cta_found_pos < 0:
        cta_position = "none"
    elif cta_found_pos < 0.25:
        cta_position = "start"
    elif cta_found_pos < 0.75:
        cta_position = "middle"
    else:
        cta_position = "end"

    has_discount = 1 if re.search(r'\bdiscount\b|\b\d+%\s*off\b|\bdeal\b|\boffer\b|\bcoupon\b|\bpromo\b|\bspecial\b.*\bpric', text_lower) else 0
    has_scarcity = 1 if re.search(r'\blimited\b|\bexclusive\b|\bonly \d+ spots\b|\bfirst \d+ \b|\binvite only\b|\bearly access\b|\bbeta\b', text_lower) else 0
    has_pricing = 1 if re.search(r'\$\d|\bpric(e|ing)\b|\b(free|premium|pro|enterprise) (plan|tier)\b|\bper month\b|\b/mo\b|\bsubscription\b|\bfree tier\b|\bfree plan\b', text_lower) else 0
    has_url = 1 if re.search(r'\b\w+\.(com|io|co|ai|app|dev|org|net)\b|https?://', text_lower) else 0

    closing_has_cta = 1 if re.search(r'\b(try|sign up|get started|join|visit|check out|download|start|go to|head over)\b', last_lower) else 0
    closing_has_thanks = 1 if re.search(r'\b(thank|thanks|bye|goodbye|cheers|appreciate)\b', last_lower) else 0

    # ── V1: CONTENT SIGNALS ──
    storytelling = 1 if re.search(r'\b(one day|story|remember when|back in|years? ago|I was|we were|it all started|one of our|customer.*told|user.*shared|there was|imagine|picture|let me tell you|journey|experience|when we first|our team|we started|I started|we decided|the idea)\b', text_lower) else 0
    humor = 1 if re.search(r'\b(haha|lol|just kidding|joke|funny|laugh|😂|😄|hilarious|spoiler|plot twist|no pun intended|but seriously|I know right|pretty cool|sounds crazy|crazy right|wild right|not bad)\b', text_lower) or (text.count('!') > 5 and filler_count > 2) else 0
    demo_instructions = count_pattern(text, [r'\bclick\b', r'\blet me show\b', r'\btap\b', r'\bselect\b', r'\bdrag\b', r'\btype\b.*\bhere\b', r'\bpress\b', r'\benter\b.*\bhere\b'])
    screen_narration = count_pattern(text, [r'\bhere you can see\b', r'\bon the (left|right|top|bottom)\b', r'\bas you can see\b', r'\byou\'ll see\b', r'\byou\'ll notice\b', r'\bthis is\b.*\bpage\b', r'\bon (?:this|the) screen\b', r'\bover here\b', r'\bright here\b', r'\bdown here\b'])
    data_viz_cues = count_pattern(text, [r'\bchart\b', r'\bgraph\b', r'\bdata\b', r'\banalytics\b', r'\bdashboard\b', r'\bmetric\b', r'\breport\b', r'\bvisuali'])
    energy_markers = text.count('!') + count_pattern(text, [r'\bamazing\b', r'\bincredible\b', r'\bawesome\b', r'\bfantastic\b', r'\bwow\b', r'\bexcit', r'\blove\b', r'\bbeautiful\b', r'\bpowerful\b', r'\bcool\b', r'\bgreat\b'])
    feature_list_markers = count_pattern(text, [r'\bfirst(ly)?\b', r'\bsecond(ly)?\b', r'\bthird(ly)?\b', r'\bnumber one\b', r'\bnumber two\b', r'\balso\b', r'\badditionally\b', r'\bmoreover\b', r'\bfurthermore\b', r'\bon top of\b', r'\bplus\b', r'\band then\b'])
    production_markers = count_production_markers(raw)

    # Speaker changes
    speaker_changes = count_pattern(raw, [r'\n[A-Z][a-z]+:', r'\bspeaker \d\b', r'\bhost\b.*:', r'\bguest\b.*:'])
    if production_markers > 5:
        speaker_changes = max(speaker_changes, 1)

    action_verb_count = count_pattern(text, [r'\bbuild\b', r'\bcreate\b', r'\blaunch\b', r'\bship\b', r'\bdeploy\b', r'\bconnect\b', r'\bgenerate\b', r'\bautomate\b', r'\banalyze\b', r'\btrack\b', r'\bmonitor\b', r'\bsend\b', r'\bsync\b', r'\btransform\b', r'\bmanage\b', r'\boptimize\b', r'\bcustomize\b', r'\bintegrate\b', r'\bscale\b', r'\bscan\b'])
    feature_words = count_pattern(text, [r'\bfeature\b', r'\bfunctionalit', r'\bcapabilit', r'\bmodule\b', r'\btool\b', r'\bwidget\b', r'\bcomponent\b', r'\binterface\b', r'\bsystem\b', r'\bengine\b', r'\bpipeline\b', r'\bworkflow\b', r'\btemplate\b', r'\bapi\b', r'\bsdk\b', r'\bplugin\b'])
    benefit_words = count_pattern(text, [r'\bsave\b', r'\breduce\b', r'\bimprove\b', r'\bincrease\b', r'\bboost\b', r'\benhance\b', r'\bfaster\b', r'\beasier\b', r'\bsimpler\b', r'\bbetter\b', r'\bmore efficient\b', r'\bproductiv', r'\bsecure\b', r'\breliable\b', r'\baccurate\b', r'\baffordable\b'])
    benefit_ratio = round(benefit_words / max(benefit_words + feature_words, 1), 2)
    question_count = text.count('?')
    passive_voice_count = count_pattern(text, [r'\b(is|are|was|were|been|being)\s+(being\s+)?\w+ed\b', r'\bget(s|ting)?\s+\w+ed\b'])

    # ── V1: SENTIMENT ──
    pos_words = count_pattern(text, [r'\blove\b', r'\bgreat\b', r'\bamazing\b', r'\bawesome\b', r'\bbeautiful\b', r'\bpowerful\b', r'\bfantastic\b', r'\bexcellent\b', r'\bincredible\b', r'\bwonderful\b', r'\bperfect\b', r'\bbest\b', r'\bhappy\b', r'\bexcit', r'\bimpress'])
    neg_words = count_pattern(text, [r'\bhate\b', r'\bterribl\b', r'\bawful\b', r'\bpain\b', r'\bfrustrat', r'\bstruggle\b', r'\bwaste\b', r'\bannoy', r'\bboring\b', r'\bbad\b', r'\bworst\b', r'\bfail'])
    if pos_words > neg_words * 2:
        sentiment = "positive"
    elif neg_words > pos_words:
        sentiment = "negative"
    else:
        sentiment = "positive" if pos_words > 2 else "neutral"

    confidence_count = count_pattern(text, [r'\bwill\b', r'\bdefinitely\b', r'\bguarantee', r'\bproven\b', r'\bcertain(ly)?\b', r'\babsolutely\b', r'\bwithout (a )?doubt\b', r'\bundoubtedly\b'])

    # Product name detection - first capitalized multi-word or repeated proper noun
    # Heuristic: look at first 100 chars for product name
    product_name_candidates = re.findall(r'\b[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?\b', text[:200])
    product_name_candidates = [p for p in product_name_candidates if p not in non_brands and len(p) > 2]
    product_name = product_name_candidates[0] if product_name_candidates else ""
    product_name_repeats = 0
    if product_name:
        product_name_repeats = len(re.findall(re.escape(product_name), text, re.IGNORECASE))

    # ── V2: A. STORY ARCHITECTURE ──

    inciting_incident = 1 if re.search(r'(one day|last (week|month|year|tuesday|monday)|when I (was|realized|noticed|found|discovered|saw)|I remember|it all started|the moment|sitting in|watching.*struggle|woke up|that\'s when|I was working|we noticed|we realized|we found|we saw|I kept|we kept|every time|I got tired|we were frustrated|I spent|we spent|after years|after months)', text_lower) else 0

    villain_named = 1 if re.search(r'(spreadsheet|email|manual|excel|pdf|slack|meetings|complexity|legacy|old (way|system|tool)|bureaucra|information overload|copy.?paste|repetiti|tedious|clunky|outdated|broken)', text_lower) else 0
    villain_count_val = count_pattern(text, [r'\bspreadsheet', r'\bemail\b', r'\bmanual\b', r'\bexcel\b', r'\bpdf\b', r'\bmeetings?\b', r'\bcomplexity\b', r'\blegacy\b', r'\bold (way|system|tool)\b', r'\bcopy.?paste\b', r'\btedious\b', r'\bclunky\b', r'\boutdated\b', r'\bbroken\b', r'\brepetiti', r'\bslack\b(?!.*integrat)', r'\binformation overload\b'])
    villain_count = min(villain_count_val, 10)

    stakes_escalation = 0
    if word_count > 80:
        sections4 = get_sections(text, 4)
        sec_problems = []
        for sec in sections4:
            sec_text = ' '.join(sec)
            sec_problems.append(count_pattern(sec_text, [r'cost', r'lose', r'waste', r'hours', r'burnout', r'miss', r'fail', r'risk', r'money', r'customer', r'churn', r'revenue']))
        if len(sec_problems) >= 3 and any(sec_problems[i+1] > sec_problems[i] for i in range(min(2, len(sec_problems)-1))):
            stakes_escalation = 1

    transformation_promise = 1 if re.search(r'(go from|become|transform|never again|turn (your|you)|evolve|reimagine|rethink|shift from|move from)', text_lower) else 0
    transformation_pos = position_of_first_match(text, [r'go from', r'become', r'transform', r'never again', r'turn (?:your|you)', r'evolve'])
    transformation_position = round(transformation_pos, 2) if transformation_pos >= 0 else -1.0

    # pivot_sharpness
    ps = 3
    if re.search(r'(so we built|introducing|that\'s why we|enter |meet |here\'s |presenting|we created|we made|that\'s where .* comes in)', text_lower):
        ps = 5
    elif re.search(r'(and that\'s|which is why|this is where|with .* you can|now you can|now with)', text_lower):
        ps = 4
    elif problem_words == 0 and solution_words > 0:
        ps = 2  # no problem = no pivot
    elif problem_words > 0 and solution_words == 0:
        ps = 1  # problem but no solution = no pivot
    elif problem_words == 0 and solution_words == 0:
        ps = 1
    if word_count < 50:
        ps = min(ps, 3)
    # Spread: if we have both problem and solution words but no sharp transition
    if problem_words > 0 and solution_words > 0 and ps == 3:
        ps = 3  # genuine middle ground
    pivot_sharpness = max(1, min(5, ps))

    nested_stories = 1 if re.search(r'(one of our (users|customers|clients)|for example.*they|case study|a team at|a founder|a developer|one company|let me tell you about)', text_lower) else 0

    temporal_anchors = count_pattern(text, [r'\b\d+ (years?|months?|weeks?|days?|hours?|minutes?|seconds?)\b', r'\blast (year|month|week|quarter)\b', r'\bin \d{4}\b', r'\brecently\b', r'\byears? ago\b', r'\bwithin minutes\b', r'\bin (30 |5 |10 )?seconds?\b', r'\breal.?time\b', r'\binstant(ly)?\b'])

    imagine_device = count_pattern(text, [r'\bimagine\b', r'\bpicture this\b', r'\bwhat if you could\b', r'\bthink about\b', r'\benvision\b', r'\bwhat if\b'])

    cliffhanger_beats = count_pattern(text, [r'\bbut here\'?s the thing\b', r'\band then\b.*\bchange\b', r'\bwait until\b', r'\bthe best part\b', r'\byou won\'?t believe\b', r'\bhere\'?s where\b', r'\bhere\'?s the\b.*\bpart\b', r'\bguess what\b', r'\bbut wait\b'])

    why_now = 1 if re.search(r'(now that|thanks to (ai|gpt|new)|the time is right|market is|finally possible|technology (now|finally)|regulation|cultural shift|pandemic|remote work|with the rise)', text_lower) else 0

    # journey_vs_destination
    journey_words = count_pattern(text, [r'\btake(s)? you\b', r'\bguide(s)?\b', r'\bjourney\b', r'\bfrom.*to\b', r'\bpath\b', r'\bstep(s)?\b', r'\bprocess\b', r'\bworkflow\b', r'\bpipeline\b'])
    destination_words = count_pattern(text, [r'\bthe (solution|answer|tool|platform)\b', r'\ball.?in.?one\b', r'\bone (place|platform|tool)\b', r'\bsingle source\b', r'\byour .* hub\b'])
    jvd = max(journey_words + destination_words, 1)
    journey_vs_destination = round(journey_words / jvd, 2)

    # emotional_bookend_match
    first_20 = text[:max(len(text)//5, 50)].lower()
    last_20 = text[-max(len(text)//5, 50):].lower()
    first_neg = bool(re.search(r'(frustrat|pain|struggle|problem|difficult|hate|broken|waste|challenge|tired)', first_20))
    last_pos = bool(re.search(r'(try|start|love|enjoy|excit|better|transform|grow|success|easy|simple|free)', last_20))
    first_pos = bool(re.search(r'(excit|love|amazing|great|welcome|happy)', first_20))
    last_pos2 = bool(re.search(r'(thank|hope|try|start|enjoy|love)', last_20))
    emotional_bookend_match = 1 if (first_neg and last_pos) or (first_pos and last_pos2) else 0

    unsaid_problem = count_pattern(text, [r'\byou know (that|the|how)\b', r'\bwe\'?ve all been\b', r'\bsound familiar\b', r'\byou know how\b', r'\bever (had|felt|been|wished)\b', r'\bwe all know\b', r'\blet\'?s face it\b', r'\blet\'?s be honest\b'])

    # resolution_completeness
    if problem_words == 0:
        resolution_completeness = 1.0  # No problems raised = nothing to resolve
    elif solution_words == 0:
        resolution_completeness = 0.0
    else:
        resolution_completeness = round(min(solution_words / max(problem_words, 1), 1.0), 2)

    # story_compression
    time_refs = count_pattern(text, [r'\b\d+ years?\b', r'\bmonths?\b', r'\bweeks?\b', r'\bdays?\b', r'\bhours?\b', r'\bminutes?\b', r'\bseconds?\b', r'\bdecade', r'\bcentur', r'\bovernight\b', r'\binstant'])
    sc_val = min(max(round(time_refs / max(sc, 1) * 10, 0), 1), 5)
    story_compression = sc_val

    # ── V2: B. EMOTIONAL MECHANICS ──

    # frustration_vocabulary_breadth (computed first since emotion_specificity depends on it)
    frust_concepts = set()
    frust_map = {
        'time': [r'\bwaste.*time\b', r'\bhours\b', r'\btime.?consuming\b', r'\bslow\b'],
        'money': [r'\bcost\b', r'\bexpensive\b', r'\bwaste.*money\b', r'\bpaying\b'],
        'complexity': [r'\bcomplex\b', r'\bcomplicated\b', r'\bconfus', r'\bhard to\b'],
        'tedium': [r'\btedious\b', r'\brepetiti', r'\bmanual\b', r'\bboring\b'],
        'error': [r'\berror\b', r'\bmistake\b', r'\bbug\b', r'\bbreak\b', r'\bfail'],
        'scaling': [r'\bscal\b', r'\bgrow\b.*\bcan\'?t\b', r'\blimit'],
        'collaboration': [r'\bsilo\b', r'\bteam\b.*\bstruggle\b', r'\bcommunicat', r'\bmisalign'],
        'fragmentation': [r'\bscattered\b', r'\bfragment\b', r'\bmultiple tools\b', r'\btab\b'],
        'quality': [r'\bquality\b', r'\binconsisten', r'\bunreliabl'],
        'security': [r'\bsecur', r'\bprivac', r'\bvulnerab', r'\brisk\b']
    }
    for concept, pats in frust_map.items():
        for p in pats:
            if re.search(p, text_lower):
                frust_concepts.add(concept)
                break
    frustration_vocabulary_breadth = len(frust_concepts)

    # emotion_specificity
    vivid_emotions = count_pattern(text, [r'feeling when', r'that moment', r'at 2\s?am', r'sinking feeling', r'rush when', r'panic', r'sleepless', r'dread', r'relief', r'night before', r'friday (afternoon|night)', r'monday morning', r'staring at', r'banging.*head', r'tired of', r'sick of', r'fed up', r'love it when', r'hate it when', r'nothing worse than', r'best feeling', r'worst part'])
    es = 1
    if vivid_emotions >= 3:
        es = 5
    elif vivid_emotions >= 2:
        es = 4
    elif vivid_emotions >= 1:
        es = 3
    elif problem_words > 2 or frustration_vocabulary_breadth >= 2:
        es = 3
    elif problem_words > 0 or neg_words > 0 or pos_words > 2:
        es = 2
    emotion_specificity = max(1, min(5, es))

    # relief_distance
    first_prob_pos = position_of_first_match(text, [r'problem', r'challenge', r'struggle', r'frustrat', r'pain', r'difficult', r'waste', r'tedious'])
    first_sol_pos = position_of_first_match(text, [r'solution', r'solve', r'fix', r'help', r'built', r'created', r'introducing', r'our (tool|product|platform)'])
    if first_prob_pos >= 0 and first_sol_pos >= 0 and first_sol_pos > first_prob_pos:
        relief_distance = max(1, min(10, round((first_sol_pos - first_prob_pos) * sc)))
    else:
        relief_distance = 0

    pride_trigger = count_pattern(text, [r'\byou already know\b', r'\bas a\b.*\byou\b', r'\bsmart\b', r'\byou understand\b', r'\byou\'?re the kind\b', r'\bsavvy\b', r'\bexpert\b.*\byou\b', r'\byour expertise\b'])

    fomo_construction = count_pattern(text, [r'\bcompetitor', r'\bmarket is moving\b', r'\beveryone is\b', r'\bdon\'?t get left\b', r'\byour competitors\b', r'\bwhile you\'?re still\b', r'\balready (using|switching|moving)\b', r'\bfalling behind\b', r'\bmissing out\b', r'\bleading (companies|teams)\b'])

    empathy_firsthand = 1 if re.search(r'\b(?:i|we)\b.{0,8}\b(?:built|created|made|developed|designed|started|decided|realized|noticed|found|wanted|needed|struggled|tried|worked|thought|knew|saw|experienced|couldn|hated|spent|wasted|failed|searched|looked for|dealt with|went through|faced|used to)\b', text_lower) else 0
    empathy_observed = 1 if re.search(r'(teams? (struggle|spend|waste)|developers? (spend|waste|struggle)|companies (waste|spend|lose)|people (struggle|spend|waste)|users? (struggle|complain|hate|spend)|most .*(spend|waste|struggle)|everyone (knows?|has|struggles?)|many .*(still|have to|waste|spend)|\bthey (spend|waste|struggle|have to|need to)\b|\b(designers?|marketers?|founders?|engineers?|managers?|creators?) (spend|waste|struggle|need|have to)\b)', text_lower) else 0

    # joy_velocity_shift
    jvs = 3
    if re.search(r'(but now|but with|introducing|enter |and boom|and just like that|and that\'s it|problem solved)', text_lower):
        jvs = 4
    if re.search(r'(instantly|immediately|in seconds|one click|boom|done|that\'s it)', text_lower):
        jvs = 5
    if not villain_named and not problem_words:
        jvs = 2
    joy_velocity_shift = max(1, min(5, jvs))

    vulnerability_moment = 1 if re.search(r'(first version was|almost gave up|got.*wrong|not perfect|honestly|we failed|we struggled|we learned|our mistake|it wasn\'t easy|to be honest)', text_lower) else 0

    anticipatory_emotion = count_pattern(text, [r'\bwait until you see\b', r'\byou\'?re going to love\b', r'\bhere\'?s the (exciting|cool|best|interesting) part\b', r'\bwatch this\b', r'\bcheck this out\b', r'\blet me show you\b', r'\bpretty cool\b', r'\bthe best part\b', r'\bhere\'?s where it gets\b'])

    social_belonging = count_pattern(text, [r'\bjoin \d+', r'\bcommunity of\b', r'\bthousands? of (teams?|users?|companies|developers?)\b', r'\byou\'?re in good company\b', r'\bfellow (founders?|developers?|creators?)\b', r'\bgrowing community\b', r'\btrusted by\b'])

    # loss_aversion_framing
    gain_words = count_pattern(text, [r'\bsave\b', r'\bgain\b', r'\bboost\b', r'\bincrease\b', r'\bimprove\b', r'\beach\b', r'\bgrow\b', r'\bearn\b'])
    loss_words = count_pattern(text, [r'\blos(e|ing)\b', r'\bwast(e|ing)\b', r'\bmiss(ing)?\b', r'\brisk\b', r'\bcost\b.*\byou\b', r'\bfalling behind\b', r'\bleav(e|ing) money\b'])
    total_gl = max(gain_words + loss_words, 1)
    loss_aversion_framing = round(loss_words / total_gl, 2)

    surprise_delight = count_pattern(text, [r'\boh and\b', r'\bbonus\b', r'\bdid I mention\b', r'\bcherry on top\b', r'\band it also\b', r'\band on top of that\b', r'\bwhat\'?s more\b', r'\beven better\b', r'\band the best part\b'])

    # confidence_gradient
    cg = 3
    first_half = text[:len(text)//2].lower()
    second_half = text[len(text)//2:].lower()
    conf_first = count_pattern(first_half, [r'\bwill\b', r'\bdefinitely\b', r'\babsolutely\b', r'\bguarantee', r'\bproven\b'])
    conf_second = count_pattern(second_half, [r'\bwill\b', r'\bdefinitely\b', r'\babsolutely\b', r'\bguarantee', r'\bproven\b'])
    hedge_first = count_pattern(first_half, [r'\bmaybe\b', r'\bperhaps\b', r'\bmight\b', r'\bkind of\b', r'\bsort of\b'])
    hedge_second = count_pattern(second_half, [r'\bmaybe\b', r'\bperhaps\b', r'\bmight\b', r'\bkind of\b', r'\bsort of\b'])
    if conf_second > conf_first + 1 and hedge_second <= hedge_first:
        cg = 4
    elif conf_second > conf_first + 2:
        cg = 5
    elif conf_first > conf_second + 1:
        cg = 2
    confidence_gradient = max(1, min(5, cg))

    # emotional_contrast_ratio
    ecr = 2
    if neg_words > 0 and pos_words > 0:
        ecr = min(5, 2 + neg_words + pos_words)
    elif pos_words > 3:
        ecr = 3
    elif neg_words > 0 or pos_words > 0:
        ecr = 2
    else:
        ecr = 1
    emotional_contrast_ratio = max(1, min(5, ecr))

    finally_signal = count_pattern(text, [r'\bfinally\b', r'\bat last\b', r'\bno more\b', r'\bnever again\b', r'\bsay goodbye\b', r'\bthe wait is over\b', r'\bput an end\b', r'\bonce and for all\b', r'\bgoodbye\b.*\bmanual\b'])

    # empathy_depth
    ed = 1
    if empathy_firsthand and empathy_observed:
        ed = 4
    elif empathy_firsthand:
        ed = 3
    elif empathy_observed:
        ed = 3
    elif problem_words > 2:
        ed = 2
    elif villain_named or you_count > 5:
        ed = 2
    if emotion_specificity >= 4:
        ed = min(5, ed + 1)
    if frustration_vocabulary_breadth >= 3:
        ed = min(5, ed + 1)
    if frustration_vocabulary_breadth >= 2 and ed < 3:
        ed = max(ed, 2)
    if you_count > 10 and benefit_words > 3:
        ed = max(ed, 3)  # heavy "you" address with benefits = empathy signal
    empathy_depth = max(1, min(5, ed))

    # ── V2: C. PRODUCT PRESENTATION ──

    # feature_intro_velocity — 1=crammed, 5=each feature breathes
    feat_mentions = count_pattern(text, [r'\bfeature\b', r'\byou can\b', r'\bit (lets|allows|enables)\b', r'\b(built.?in|comes with|includes)\b', r'\bwith \w+\b.*\byou\b'])
    if feat_mentions == 0:
        fiv = 3  # no features = neutral
    else:
        words_per_feature = wc / max(feat_mentions, 1)
        if words_per_feature > 80:
            fiv = 5  # lots of space per feature
        elif words_per_feature > 50:
            fiv = 4
        elif words_per_feature > 30:
            fiv = 3
        elif words_per_feature > 15:
            fiv = 2
        else:
            fiv = 1  # crammed
    feature_intro_velocity = max(1, min(5, fiv))

    # orphaned_features
    total_feats = feature_words
    feats_with_benefit = min(benefit_words, total_feats)
    orphaned_features = round(1 - feats_with_benefit / max(total_feats, 1), 2) if total_feats > 0 else 0.5

    demo_voice_present_tense = 1 if re.search(r'(I click|I drag|watch as|see how it|I type|you see|I select|now I|let me|here I)', text_lower) else 0

    # concrete_vs_abstract
    concrete_signals = count_pattern(text, [r'\b\d+%\b', r'\$\d+', r'\b\d+ (seconds?|minutes?|hours?|steps?|clicks?|lines?)\b', r'\bspecifically\b', r'\bfor example\b', r'\blike\b.*\bfor instance\b'])
    abstract_signals = count_pattern(text, [r'\bpowerful\b', r'\bseamless\b', r'\brobust\b', r'\bscalable\b', r'\bflexible\b', r'\badvanced\b', r'\bcomprehensive\b', r'\bholistic\b', r'\bintuitive\b'])
    if concrete_signals > abstract_signals * 2:
        concrete_vs_abstract = 5
    elif concrete_signals > abstract_signals:
        concrete_vs_abstract = 4
    elif abstract_signals > concrete_signals * 2:
        concrete_vs_abstract = 1
    elif abstract_signals > concrete_signals:
        concrete_vs_abstract = 2
    else:
        concrete_vs_abstract = 3

    # magic_moment_position
    wow_pos = position_of_last_match(text, [r'the (best|cool|amazing|incredible|wow|impressive|magic) (part|thing|feature)', r'you won\'t believe', r'watch this', r'check this out', r'this is where', r'here\'s the magic', r'boom'])
    magic_moment_position = round(wow_pos, 2) if wow_pos >= 0 else 0.5

    speed_claims = count_pattern(text, [r'\bin seconds?\b', r'\binstant(ly)?\b', r'\b\d+x faster\b', r'\breal.?time\b', r'\blightning\b', r'\bfast\b', r'\bquick(ly)?\b', r'\brapid(ly)?\b', r'\b10x\b', r'\b100x\b'])

    effort_reduction_specific = 1 if re.search(r'(\d+\s*(hours?|minutes?|steps?|days?|clicks?).*\b(to|now|instead)\b.*\d+|\bfrom \d+.*to \d+\b|\b\d+x (faster|less|fewer))', text_lower) else 0
    effort_reduction_vague = 1 if re.search(r'(saves? time|easier|simpler|streamline|less effort|more efficient|reduce.*time|faster|quicker|simplif)', text_lower) else 0

    # integration_count
    integration_names = set()
    int_list = ['slack', 'notion', 'zapier', 'github', 'gitlab', 'jira', 'trello', 'asana', 'discord', 'zoom', 'google (sheets|docs|drive|calendar|workspace|analytics)', 'microsoft (teams|365|office)', 'shopify', 'stripe', 'hubspot', 'salesforce', 'airtable', 'figma', 'linear', 'intercom', 'segment', 'twilio', 'sendgrid', 'mailchimp', 'wordpress', 'webflow', 'supabase', 'firebase', 'aws', 'azure', 'vercel', 'netlify', 'heroku', 'datadog', 'sentry', 'pagerduty', 'jenkins', 'circleci', 'docker', 'kubernetes', 'terraform', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'snowflake', 'bigquery', 'tableau', 'power bi', 'dropbox', 'box', 'confluence', 'clickup', 'monday', 'basecamp', 'freshdesk', 'zendesk', 'pipedrive', 'chrome', 'vscode', 'vs code', 'xcode', 'android studio']
    for intg in int_list:
        if re.search(r'\b' + intg + r'\b', text_lower):
            integration_names.add(intg.split()[0])
    integration_count = len(integration_names)

    progressive_disclosure = 1 if re.search(r'(simple|basic|easy).*\b(but|and)\b.*(advanced|power|pro|complex|custom|enterprise|scale)', text_lower) else 0

    one_more_thing = 1 if re.search(r'(one more thing|oh and|bonus|cherry on top|and one more|last thing|almost forgot|did I mention)', last_lower) else 0

    simplicity_signals = count_pattern(text, [r'\bsimple\b', r'\beasy\b', r'\bintuitive\b', r'\bno (learning|setup|code|install)', r'\bone click\b', r'\bdrag and drop\b', r'\bjust\b.*\b(click|drag|type|press|connect|add|select|upload)\b', r'\bno.?code\b', r'\blow.?code\b', r'\bplug and play\b', r'\buser.?friendly\b', r'\bstraightforward\b'])

    under_the_hood = 1 if re.search(r'(built (on|with|using)|powered by|uses? (gpt|openai|llm|ai|ml|vector|embedding|transformer|neural|bert|claude|gemini|mistral|llama|stable diffusion)|\bunder the hood\b|\barchitecture\b|\btech stack\b|\binfrastructure\b)', text_lower) else 0

    # use_case_count
    use_case_patterns = [r'\bfor (developers?|designers?|marketers?|founders?|startups?|enterprises?|teams?|agencies?|freelancers?|creators?|writers?|educators?|students?|managers?|engineers?|product managers?|PMs?|CEOs?|CTOs?|sales|marketing|customer (success|support)|hr|recruiting|finance|legal|operations|DevOps|data (scientists?|analysts?|engineers?))\b']
    uc_matches = set()
    for p in use_case_patterns:
        for m in re.finditer(p, text_lower):
            uc_matches.add(m.group())
    use_case_count = max(len(uc_matches), 1)

    # liveness_score
    ls = 3
    if demo_voice_present_tense and demo_instructions > 2:
        ls = 5
    elif demo_instructions > 0 or screen_narration > 0:
        ls = 4
    elif filler_count > 3:
        ls = 4  # filler words suggest spontaneity
    elif production_markers > 3:
        ls = 1
    elif filler_count == 0 and demo_instructions == 0:
        ls = 2
    liveness_score = max(1, min(5, ls))

    onboarding_time_claim = 1 if re.search(r'(up and running in|deploy in|set up in|start in|running in|ready in|install in|onboard in|get started in)\s*\d+\s*(second|minute|hour|day)', text_lower) else 0
    if not onboarding_time_claim:
        onboarding_time_claim = 1 if re.search(r'(\d+\s*(second|minute)s?\s*(setup|onboarding|to (get started|set up|deploy|install)))', text_lower) else 0

    comparison_moment = 1 if re.search(r'(before.*after|old way.*new way|on the left.*on the right|here\'?s (how|what).*here\'?s|without.*with |traditional.*vs|side by side|compare)', text_lower) else 0

    # ── V2: D. WORDING & RHETORIC ──

    # verb_energy
    active_verbs = count_pattern(text, [r'\bship\b', r'\bcrush\b', r'\bbuild\b', r'\blaunch\b', r'\bsend\b', r'\bfire\b', r'\bkill\b', r'\bsmash\b', r'\bnail\b', r'\brock\b', r'\bblast\b', r'\bdrive\b', r'\bpower\b', r'\bfuel\b'])
    passive_verbs = count_pattern(text, [r'\butilize\b', r'\bfacilitate\b', r'\bleverage\b', r'\boptimize\b', r'\bsynthesize\b', r'\bimplement\b', r'\boperationalize\b'])
    ve = 3
    if active_verbs > passive_verbs * 2:
        ve = 4
    if active_verbs > 5:
        ve = 5
    if passive_verbs > active_verbs:
        ve = 2
    if passive_verbs > 3 and active_verbs == 0:
        ve = 1
    verb_energy = max(1, min(5, ve))

    # sentence_rhythm_variance
    sent_lengths = [len(words(s)) for s in sent_list]
    if len(sent_lengths) > 2:
        mean_sl = sum(sent_lengths) / len(sent_lengths)
        variance = sum((sl - mean_sl) ** 2 for sl in sent_lengths) / len(sent_lengths)
        std_dev = variance ** 0.5
        srv = min(5, max(1, round(std_dev / max(mean_sl, 1) * 5)))
    else:
        srv = 2
    sentence_rhythm_variance = max(1, min(5, srv))

    # power_word_cluster_density — 1=scattered, 5=dense clusters
    power_words_list = [r'\bfree\b', r'\binstant\b', r'\bguarantee', r'\bproven\b', r'\bunlimited\b', r'\bexclusive\b', r'\bsecret\b', r'\bdiscover\b', r'\bnew\b', r'\bnow\b', r'\bfast\b', r'\beasy\b', r'\bsave\b', r'\bresult\b', r'\bamazing\b', r'\bpowerful\b', r'\bsimple\b', r'\bautomati', r'\binstantly\b', r'\bperfect\b', r'\bbest\b', r'\bultimate\b', r'\bboost\b', r'\bmaster\b', r'\bunlock\b', r'\blaunch\b', r'\bcrush\b', r'\bdominate\b']
    power_words = count_pattern(text, power_words_list)
    pw_density = power_words / max(wc, 1) * 100
    if pw_density > 5:
        pwcd = 5
    elif pw_density > 3:
        pwcd = 4
    elif pw_density > 1.5:
        pwcd = 3
    elif pw_density > 0.5:
        pwcd = 2
    else:
        pwcd = 1
    power_word_cluster_density = max(1, min(5, pwcd))

    # jargon_distribution_shape
    jargon_pats = [r'\bapi\b', r'\bsdk\b', r'\bml\b', r'\bai\b', r'\bgpt\b', r'\bllm\b', r'\bsaas\b', r'\bb2b\b', r'\bb2c\b', r'\bcloud\b', r'\binfrastructure\b', r'\bbackend\b', r'\bfrontend\b', r'\bdeployment\b', r'\bcontainer\b', r'\bmicroservice\b', r'\borchestrat', r'\bpipeline\b', r'\bci/cd\b', r'\bdevops\b', r'\bkubernetes\b', r'\bdocker\b', r'\bvector\b', r'\bembedding\b', r'\btoken\b', r'\blatency\b', r'\bthroughput\b', r'\bendpoint\b', r'\bwebhook\b']
    sections3 = get_sections(text, 3)
    jargon_sections = []
    for sec in sections3:
        sec_text = ' '.join(sec)
        jargon_sections.append(sum(1 for p in jargon_pats if re.search(p, sec_text)))
    total_jargon = sum(jargon_sections)
    if total_jargon == 0:
        jargon_distribution_shape = "minimal"
    elif jargon_sections[0] > jargon_sections[1] and jargon_sections[0] > jargon_sections[2]:
        jargon_distribution_shape = "front_heavy"
    elif jargon_sections[2] > jargon_sections[0] and jargon_sections[2] > jargon_sections[1]:
        jargon_distribution_shape = "back_heavy"
    elif jargon_sections[1] > jargon_sections[0] and jargon_sections[1] > jargon_sections[2]:
        jargon_distribution_shape = "middle_heavy"
    else:
        jargon_distribution_shape = "even"

    anaphora_count = count_pattern(text, [r'(?:^|\. )(no more\b.*\. no more\b)', r'(?:^|\. )(you can\b.*\. you can\b)', r'(?:^|\. )(we\b.*\. we\b)', r'(?:^|\. )(it\b.*\. it\b)'])
    # Better heuristic: look for repeated sentence starts
    if sent_count > 3:
        starts = [s.split()[0].lower() if s.split() else '' for s in sent_list]
        start_counts = Counter(starts)
        anaphora_count = sum(c - 1 for c in start_counts.values() if c > 2)

    just_minimizer = count_pattern(text, [r'\bjust (click|drag|type|press|connect|add|select|upload|copy|paste|drop|enter|tap|toggle|switch|sign|log|import|export)\b'])

    # superlative_density
    superlatives = count_pattern(text, [r'\bbest\b', r'\bmost\b', r'\bfastest\b', r'\bonly\b', r'\bfirst\b', r'\b#1\b', r'\bnumber one\b', r'\blargest\b', r'\bsmallest\b', r'\beasiest\b', r'\bsimplest\b'])
    superlative_density = round(superlatives / wc * 100, 2) if wc > 0 else 0

    question_answer_pairs = count_pattern(text, [r'\?\s*(simple|easy|because|it\'?s|we|the answer|three|two|one|here|well)', r'\?\s*[A-Z][a-z]+\.'])

    # transition_sophistication
    fancy_trans = count_pattern(text, [r'\bhere\'?s where\b', r'\bthe (real )?magic\b', r'\bhere\'?s the thing\b', r'\bbut it gets better\b', r'\bthat\'?s not all\b', r'\bnow here\'?s\b', r'\bbut the (real|best|cool)\b', r'\blet\'?s (talk about|look at|dive|explore)\b', r'\bthe cool (thing|part)\b', r'\bwhat\'?s (great|cool|interesting)\b', r'\bnot only\b.*\bbut also\b', r'\bon top of that\b', r'\bwhat makes\b.*\b(special|different|unique)\b', r'\bthe beauty\b', r'\bbut here is\b'])
    basic_trans = count_pattern(text, [r'\band\b', r'\balso\b', r'\bso\b', r'\bbut\b', r'\bthen\b'])
    ts = 3
    if fancy_trans > 3:
        ts = 5
    elif fancy_trans >= 2:
        ts = 4
    elif fancy_trans == 1:
        ts = 3
    elif basic_trans > 5 and fancy_trans == 0:
        ts = 2
    elif wc < 50:
        ts = 1
    elif basic_trans <= 2:
        ts = 2  # few transitions at all
    transition_sophistication = max(1, min(5, ts))

    negation_as_benefit = count_pattern(text, [r'\bno .{1,20} needed\b', r'\bwithout .{1,20}\b', r'\bzero (setup|config|code|hassle|install)\b', r'\bnever worry\b', r'\beliminate', r'\bno (setup|config|code|install|download|sign.?up|credit card|learning curve)\b', r'\bforget about\b'])

    # specificity_index
    specific_signals = number_count + count_pattern(text, [r'\bspecifically\b', r'\bexactly\b', r'\bprecisely\b', r'\bfor example\b', r'\bsuch as\b', r'\bincluding\b'])
    vague_signals = count_pattern(text, [r'\bmany\b', r'\bsignificant\b', r'\bvarious\b', r'\bnumerous\b', r'\bseveral\b', r'\ba lot\b', r'\bsome\b', r'\bgreat\b', r'\bvery\b'])
    si = 3
    if specific_signals > vague_signals * 2:
        si = 5
    elif specific_signals > vague_signals:
        si = 4
    elif vague_signals > specific_signals * 2:
        si = 1
    elif vague_signals > specific_signals:
        si = 2
    specificity_index = max(1, min(5, si))

    you_insertion_rate = round(you_count / wc * 100, 2) if wc > 0 else 0

    cliche_count = count_pattern(text, [r'\bgame.?chang', r'\bone.?stop.?shop\b', r'\bseamless\b', r'\bfrictionless\b', r'\bempower\b', r'\bunlock\b', r'\bleverage\b', r'\breimagine\b', r'\bdisrupt\b', r'\bnext.?gen\b', r'\bcutting.?edge\b', r'\bstate.?of.?the.?art\b', r'\bworld.?class\b', r'\bsynerg', r'\bparadigm\b', r'\bholistic\b', r'\bend.?to.?end\b', r'\bturnkey\b', r'\bplug.?and.?play\b'])

    conditional_density = round(count_pattern(text, [r'\bif you\b', r'\bwhether you\b', r'\bin case\b', r'\bwhenever you\b', r'\bwhen you\b']) / wc * 100, 2) if wc > 0 else 0

    parallel_structure = count_pattern(text, [r'(\b\w+ \w+er\b.*){2,}', r'(build\b.*ship\b.*scale\b)', r'(faster\b.*smarter\b.*better\b)'])
    # Look for "X. Y. Z." patterns with similar structure
    if sent_count > 3:
        for i in range(len(sent_list) - 2):
            s1, s2, s3 = sent_list[i], sent_list[i+1], sent_list[i+2]
            w1, w2, w3 = len(words(s1)), len(words(s2)), len(words(s3))
            if abs(w1 - w2) <= 2 and abs(w2 - w3) <= 2 and w1 < 8:
                parallel_structure += 1

    imperative_density = round(count_pattern(text, [r'\b(try|check|sign up|join|visit|start|stop|get|go|click|download|discover|explore|see|watch|learn|read|build|create|make|use|switch|upgrade|choose)\b']) / wc * 100, 2) if wc > 0 else 0

    # ── V2: E. PERSUASION PSYCHOLOGY ──

    # word_rarity_score — 1=basic vocab, 5=sophisticated
    common_1000 = set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'or', 'if', 'it', 'its', 'you', 'your', 'we', 'our', 'they', 'them', 'their', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'he', 'she', 'him', 'her', 'his', 'what', 'which', 'who', 'whom', 'about', 'up', 'like', 'just', 'get', 'go', 'going', 'know', 'want', 'need', 'make', 'made', 'think', 'see', 'look', 'come', 'give', 'take', 'use', 'find', 'tell', 'say', 'said', 'work', 'try', 'new', 'way', 'thing', 'things', 'time', 'people', 'good', 'really', 'right', 'much', 'first', 'also', 'now', 'back', 'even', 'well', 'because', 'any', 'still', 'something', 'let', 'help', 'start', 'kind', 'able', 'actually', 'different', 'lot', 'data', 'tool', 'product', 'app', 'create', 'build', 'click', 'add', 'show', 'set', 'change', 'put', 'run', 'keep', 'turn', 'open', 'close', 'check', 'point', 'number', 'part', 'place', 'case', 'day', 'long', 'great', 'little', 'own', 'old', 'big', 'high', 'small', 'next', 'last', 'sure', 'real', 'pretty', 'cool', 'amazing', 'whole', 'important', 'done', 'better', 'using', 'feature', 'platform', 'website', 'page', 'content', 'team', 'user', 'users', 'simple', 'easy', 'free', 'best', 'full', 'top', 'left', 'side', 'bottom', 'everything', 'anything', 'everyone', 'already', 'always', 'never', 'maybe', 'enough', 'example'])
    rare_count = sum(1 for wd in w if wd not in common_1000 and len(wd) > 7)
    rare_pct = rare_count / max(wc, 1)
    if rare_pct > 0.12:
        wrs = 5
    elif rare_pct > 0.08:
        wrs = 4
    elif rare_pct > 0.05:
        wrs = 3
    elif rare_pct > 0.02:
        wrs = 2
    else:
        wrs = 1
    word_rarity_score = max(1, min(5, wrs))

    qualifying_retreat = count_pattern(text, [r'(best|most|first|only|biggest).{0,20}(well|at least|one of|arguably|sort of|kind of)', r'(revolutionary|incredible|amazing).{0,20}(or at least|I mean|sort of)'])

    # conclusive_finality
    cf = 3
    last_sent = sent_list[-1].lower() if sent_list else ''
    last_2_sents = ' '.join(s.lower() for s in sent_list[-2:]) if len(sent_list) >= 2 else last_sent
    if re.search(r'(try it|get started|sign up|join|visit|check out|download|start|go to|head over)\b', last_2_sents):
        cf = 5
    elif re.search(r'(the future|just the beginning|much more|stay tuned|wait until|we\'?re just getting started)', last_2_sents):
        cf = 4
    elif re.search(r'\.(com|io|ai|co|app)\b', last_2_sents):
        cf = 5
    elif re.search(r'(thank you|thanks for|appreciate|thanks)', last_2_sents):
        cf = 3
    elif re.search(r'(so yeah|that\'?s (it|all|about it|pretty much)|um|uh|bye|see you)', last_2_sents):
        cf = 1
    elif word_count < 30:
        cf = 2
    conclusive_finality = max(1, min(5, cf))

    # social_proof_stacking_order
    proof_positions = {}
    num_pos = position_of_first_match(text, [r'\b\d+[kKmM]?\s*(users|customers|companies|teams)\b'])
    brand_pos = position_of_first_match(text, [r'\b(' + '|'.join(re.escape(b) for b in found_brands) + r')\b'] if found_brands else [r'XXXXXXXXNOMATCH'])
    quote_pos = position_of_first_match(text, [r'\"[^\"]{10,}\"', r'\btestimoni'])
    if num_pos >= 0:
        proof_positions['numbers_first'] = num_pos
    if brand_pos >= 0:
        proof_positions['brands_first'] = brand_pos
    if quote_pos >= 0:
        proof_positions['quotes_first'] = quote_pos
    if proof_positions:
        social_proof_stacking_order = min(proof_positions, key=proof_positions.get)
    else:
        social_proof_stacking_order = "none"

    # authority_type
    if has_credential:
        authority_type = "technical"
    elif success_users > 0 or trusted_by:
        authority_type = "market"
    elif re.search(r'\b\d+ years?\b.*\bexperience\b|\bexpert\b|\bspecialist\b|\bveteran\b', text_lower):
        authority_type = "domain"
    elif has_credential and (success_users > 0 or has_investor_mention):
        authority_type = "mixed"
    else:
        authority_type = "none"

    reciprocity_trigger = 1 if re.search(r'(free (tier|plan|trial|version|template|forever)|open source|no credit card|free to (use|try|start)|it\'?s free|completely free|100% free|freemium)', text_lower) else 0

    anchor_contrast_pricing = 1 if re.search(r'(\$\d+.*\$\d+|cost.*\$\d+.*we.*\$\d+|enterprise.*\$.*our.*\$|spend.*\$.*only\s*\$|usually.*\$.*now.*\$)', text_lower) else 0

    contrast_pairs = count_pattern(text, [r'\binstead of\b', r'\bnot\b.*\bbut\b', r'\bunlike\b', r'\bwhile others\b', r'\brather than\b', r'\btraditional\b.*\bour\b', r'\bold\b.*\bnew\b', r'\bmanual\b.*\bautomat'])

    # certainty_ratio
    certain_words = count_pattern(text, [r'\bwill\b', r'\bdefinitely\b', r'\babsolutely\b', r'\bguarantee', r'\bproven\b', r'\bcertainly\b', r'\bundoubtedly\b', r'\balways\b', r'\bevery\b'])
    uncertain_words = count_pattern(text, [r'\bmaybe\b', r'\bperhaps\b', r'\bmight\b', r'\bcould\b', r'\bpossibly\b', r'\bprobably\b', r'\bsometimes\b', r'\bkind of\b', r'\bsort of\b'])
    certainty_ratio = round(certain_words / max(certain_words + uncertain_words, 1), 2)

    in_group_language = count_pattern(text, [r'\bas (developers?|founders?|engineers?|designers?|creators?|builders?) we\b', r'\bfellow (developers?|founders?)\b', r'\bif you\'?re like (us|me)\b', r'\bwe\'?ve all been\b', r'\bwe all know\b', r'\byou\'?re one of\b'])

    objection_preempt = count_pattern(text, [r'\byou might (be )?wonder', r'\band yes\b', r'\bdon\'?t worry\b', r'\byou\'?re probably thinking\b', r'\bbut what about\b', r'\bno (hidden|extra)\b', r'\bno strings\b', r'\bno catch\b', r'\bworks (offline|on mobile|on all|with any)\b', r'\bprivacy\b', r'\bsecure\b', r'\bencrypt'])

    # scarcity_type
    if re.search(r'\b(today only|limited time|this week|expires|deadline)\b', text_lower):
        scarcity_type = "time"
    elif re.search(r'\b(limited spots|only \d+ spots|first \d+|limited seats)\b', text_lower):
        scarcity_type = "quantity"
    elif re.search(r'\b(invite only|exclusive access|waitlist|early access|beta)\b', text_lower):
        scarcity_type = "access"
    elif re.search(r'\b(the only|only tool|only platform|first to)\b', text_lower):
        scarcity_type = "capability"
    else:
        scarcity_type = "none"

    # bandwagon_gradient
    bandwagon_gradient = 0
    user_numbers = re.findall(r'(\d+[,.]?\d*[kKmM]?)\s*(users?|customers?|companies|teams?|people|developers?|businesses)', text)
    if len(user_numbers) >= 2:
        # Check if numbers increase
        bandwagon_gradient = 1

    # choice_architecture
    tier_mentions = count_pattern(text, [r'\bfree (plan|tier)\b', r'\bpro (plan|tier)\b', r'\bpremium\b', r'\benterprise\b', r'\bstarter\b', r'\bbusiness\b.*\bplan\b', r'\bper month\b', r'\bpricing\b.*\b(plan|tier)\b'])
    choice_architecture = min(tier_mentions, 5)

    cognitive_ease = count_pattern(text, [r'\bone click\b', r'\bautomatic(ally)?\b', r'\bzero (config|setup|code)\b', r'\bplug and play\b', r'\bset it and forget\b', r'\binstant\b', r'\bno (setup|config|code|install|download|learning curve)\b', r'\bout of the box\b', r'\bready to (use|go)\b', r'\bturnkey\b'])

    everyone_else_maneuver = count_pattern(text, [r'\bmost (teams?|companies|developers?)\b', r'\bindustry standard\b', r'\byour competitors?\b', r'\bleading (companies|teams?|brands?)\b', r'\bused by\b.*\b(top|leading)\b', r'\beveryone (else|is)\b', r'\bstandard practice\b'])

    future_self_projection = count_pattern(text, [r'\byou\'?ll become\b', r'\bimagine yourself\b', r'\bbe the (one|person) who\b', r'\byour future\b', r'\btransform (your|how you)\b', r'\bnever (again|go back)\b', r'\bbecome\b.*\bwho\b'])

    # ── V2: F. STRUCTURE & TIMING ──

    # info_density_shape
    sections4 = get_sections(text, 4)
    section_densities = []
    for sec in sections4:
        sec_text = ' '.join(sec)
        density = count_pattern(sec_text, [r'\b\d+\b', r'\bfeature\b', r'\byou can\b', r'\bwith\b', r'\bintegrat', r'\bautomat', r'\bpowerful\b', r'\bsimple\b', r'\bfast\b'])
        section_densities.append(density)

    if not any(section_densities):
        info_density_shape = "even"
    elif section_densities[0] > section_densities[-1] * 1.5:
        info_density_shape = "front_loaded"
    elif section_densities[-1] > section_densities[0] * 1.5:
        info_density_shape = "back_loaded"
    elif section_densities[1] + section_densities[2] > (section_densities[0] + section_densities[3]) * 1.5:
        info_density_shape = "middle_peak"
    else:
        info_density_shape = "even"

    # breathing_room — how much space between ideas
    # Use word count per topic transition as a proxy
    ideas_per_100_words = (topic_transitions + 1) / max(wc, 1) * 100
    br = 3
    if ideas_per_100_words > 8:
        br = 1  # relentless
    elif ideas_per_100_words > 5:
        br = 2
    elif ideas_per_100_words < 2:
        br = 5  # very spacious
    elif ideas_per_100_words < 3:
        br = 4
    # Also check avg sentence length (after improved splitting)
    if avg_sentence_length > 20:
        br = max(1, br - 1)  # dense long sentences = less breathing room
    elif avg_sentence_length < 8:
        br = min(5, br + 1)  # short sentences = more space
    breathing_room = max(1, min(5, br))

    # cold_open_words
    product_mention_pos = position_of_first_match(text, [r'\bour (tool|product|platform|app|software|solution)\b', r'\bintroduc', r'\bbuilt\b', r'\bcreated\b', r'\bwe (built|created|made|developed)\b', r'\bwelcome to\b'])
    if product_mention_pos >= 0:
        cold_open_words = round(product_mention_pos * wc)
    else:
        cold_open_words = 0

    callback_count = count_pattern(text, [r'\bremember\b.*\b(mentioned|said|showed)\b', r'\bgoing back\b', r'\bearlier I\b', r'\bas I (mentioned|said|showed)\b', r'\bties back\b', r'\blike I said\b', r'\bas we (discussed|saw|mentioned)\b'])

    # section_length_cv
    if len(sent_lengths) > 3:
        mean_sl2 = sum(sent_lengths) / len(sent_lengths)
        var2 = sum((sl - mean_sl2) ** 2 for sl in sent_lengths) / len(sent_lengths)
        cv = (var2 ** 0.5) / max(mean_sl2, 1)
        slcv = min(5, max(1, round(cv * 3)))
    else:
        slcv = 3
    section_length_cv = max(1, min(5, slcv))

    # promise_proof_push
    has_promise = 1 if (solution_words > 0 or feature_words > 0 or benefit_words > 0) else 0
    has_proof = 1 if (social_proof_claims > 0 or number_count > 2 or has_testimonial) else 0
    has_push = 1 if (closing_has_cta or primary_cta != "none") else 0
    promise_proof_push = float(has_promise + has_proof + has_push)

    # first_feature_position
    ffp = position_of_first_match(text, [r'\byou can\b', r'\bfeature\b', r'\bit (lets|allows|enables)\b', r'\b(built.?in|comes with|includes)\b', r'\bclick\b', r'\blet me show\b'])
    first_feature_position = round(ffp, 2) if ffp >= 0 else 0.3

    parenthetical_credibility = count_pattern(text, [r'\b(by the way|incidentally|oh and|casually)\b.*\b\d+', r'\b\d+[kKmM]?\s*(users|customers)\b(?!.*\b(proud|excited|happy)\b)'])

    section_boundary_markers = count_pattern(text, [r'\bnumber (one|two|three|four|five)\b', r'\bfirst(ly)?\b,', r'\bsecond(ly)?\b', r'\bthird(ly)?\b', r'\bnext\b', r'\bfinally\b', r'\blast(ly)?\b', r'\blet\'?s move\b', r'\bmoving on\b', r'\bthe (first|second|third|next|last) thing\b'])

    # setup_payoff_distance
    spd = 2
    if relief_distance > 5:
        spd = 5
    elif relief_distance > 3:
        spd = 4
    elif relief_distance > 1:
        spd = 3
    elif relief_distance == 0:
        spd = 1
    setup_payoff_distance = float(max(1, min(5, spd)))

    # multi_persona_address
    persona_patterns = [r'\bfor (developers?|designers?|marketers?|founders?|startups?|enterprises?|teams?|agencies?|freelancers?|creators?|writers?|educators?|students?|managers?|engineers?|product managers?)\b', r'\bwhether you\'?re a\b', r'\bif you\'?re a\b']
    persona_matches = set()
    for p in persona_patterns:
        for m in re.finditer(p, text_lower):
            persona_matches.add(m.group())
    multi_persona_address = len(persona_matches)

    # voice_consistency
    i_count = count_pattern(text, [r'\bI\b'])
    voice_shifts = 0
    for i in range(len(sent_list) - 1):
        s1 = sent_list[i].lower()
        s2 = sent_list[i+1].lower()
        s1_we = bool(re.search(r'\bwe\b', s1))
        s2_you = bool(re.search(r'\byou\b', s2))
        s1_you = bool(re.search(r'\byou\b', s1))
        s2_we = bool(re.search(r'\bwe\b', s2))
        if (s1_we and s2_you and not s1_you) or (s1_you and s2_we and not s1_we):
            voice_shifts += 1
    vc = 4
    if voice_shifts > 5:
        vc = 1
    elif voice_shifts > 3:
        vc = 2
    elif voice_shifts > 1:
        vc = 3
    elif voice_shifts == 0:
        vc = 5
    voice_consistency = max(1, min(5, vc))

    counterfactual_count = count_pattern(text, [r'\bwhat if\b', r'\bwithout this\b', r'\bimagine not\b', r'\bif you didn\'?t\b', r'\bwhat would happen\b', r'\bwithout \w+\b.*\byou\'?d\b'])

    # closing_velocity
    last_3_sents = sent_list[-3:] if len(sent_list) >= 3 else sent_list
    last_3_lens = [len(words(s)) for s in last_3_sents]
    cv_val = 3
    if last_3_lens:
        avg_last = sum(last_3_lens) / len(last_3_lens)
        if avg_last < 6:
            cv_val = 5
        elif avg_last < 10:
            cv_val = 4
        elif avg_last > 20:
            cv_val = 1
        elif avg_last > 15:
            cv_val = 2
    closing_velocity = max(1, min(5, cv_val))

    open_loop_closing = 1 if re.search(r'(just the beginning|much more to come|stay tuned|wait until|exciting things|more features|v2|coming soon|roadmap|next version|more to come)', last_lower) else 0
    definitive_closing = 1 if re.search(r'(try it|get started|sign up|visit|check out|download|start|go to|\.(com|io|ai|co)\b)', last_lower) else 0

    # ── Build result ──
    return {
        "id": str(tid),
        # V1: Opening
        "hook_type": hook_type,
        "first_person_opener": first_person_opener,
        "has_negative_opener": has_negative_opener,
        "first_sentence_words": first_sentence_words,
        "hook_quality": hook_quality,
        # V1: Length & Readability
        "word_count": word_count,
        "sentence_count": sent_count,
        "avg_sentence_length": avg_sentence_length,
        "flesch_kincaid_grade": fk_grade,
        "word_diversity": word_diversity,
        "syllable_density": syllable_dens,
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
        "feature_words": feature_words,
        "benefit_words": benefit_words,
        "benefit_ratio": benefit_ratio,
        "question_count": question_count,
        "passive_voice_count": passive_voice_count,
        # V1: Sentiment
        "sentiment": sentiment,
        "confidence_count": confidence_count,
        "product_name_repeats": product_name_repeats,
        # V2: A. Story Architecture
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
        # V2: B. Emotional Mechanics
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
        # V2: C. Product Presentation
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
        # V2: D. Wording & Rhetoric
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
        # V2: E. Persuasion Psychology
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
        # V2: F. Structure & Timing
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


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    input_path = "launch-video-analysis/ph/v2-llm-parts/input_batch_07.json"
    output_path = "launch-video-analysis/ph/v2-llm-parts/output_batch_07.json"

    with open(input_path) as f:
        data = json.load(f)

    print(f"Processing {len(data)} transcripts...")

    results = []
    for i, item in enumerate(data):
        try:
            result = extract_dimensions(item)
            results.append(result)
            if (i + 1) % 10 == 0:
                print(f"  Processed {i + 1}/{len(data)}")
        except Exception as e:
            print(f"  ERROR on id={item.get('id','?')}: {e}")
            # Still produce a result with defaults
            result = {"id": str(item.get("id", "")), "error": str(e)}
            results.append(result)

    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"Done. Wrote {len(results)} results to {output_path}")

    # Verify dimension count
    if results:
        keys = [k for k in results[0].keys() if k != 'id']
        print(f"Dimensions per transcript: {len(keys)}")


if __name__ == "__main__":
    main()
