#!/usr/bin/env python3
"""
Extract 200 dimensions from Product Hunt launch video transcripts.
Batch 11 - 85 transcripts.
"""
import json
import re
import math

def count_words(text):
    return len(text.split())

def count_sentences(text):
    # Split on sentence-ending punctuation
    sents = re.split(r'[.!?]+', text)
    return max(1, len([s for s in sents if s.strip()]))

def get_first_sentence(text):
    m = re.match(r'^(.*?[.!?])', text)
    if m:
        return m.group(1).strip()
    # No punctuation — take first 30 words
    words = text.split()[:30]
    return ' '.join(words)

def count_pattern(text, patterns):
    count = 0
    tl = text.lower()
    for p in patterns:
        count += len(re.findall(r'\b' + p + r'\b', tl))
    return count

def count_unique_brands(text):
    # Look for capitalized multi-word names or known brand patterns
    brands = set()
    known = ['google','slack','notion','zapier','github','stripe','hubspot',
             'shopify','wordpress','figma','airtable','microsoft','amazon','aws',
             'openai','gpt','chatgpt','linkedin','twitter','facebook','instagram',
             'tiktok','youtube','discord','zoom','dropbox','salesforce','jira',
             'linear','vercel','netlify','heroku','digital ocean','digitalocean',
             'vscode','vs code','chrome','firefox','safari','excel','powerpoint',
             'quickbooks','revenue cat','revenuecat','mixpanel','posthog',
             'intercom','zendesk','mailchimp','sendgrid','twilio','anthropic',
             'claude','descript','canva','webflow','framer','supabase','firebase',
             'mongodb','postgresql','redis','docker','kubernetes','terraform',
             'jenkins','circleci','travisci','datadog','grafana','sentry',
             'segment','amplitude','heap','hotjar','loom','calendly','typeform',
             'surveymonkey','asana','monday','clickup','basecamp','trello',
             'confluence','bitbucket','gitlab','codespace','codespaces',
             'whatsapp','telegram','signal','pinterest','reddit','quora',
             'medium','substack','producthunt','product hunt','hacker news',
             'ycombinator','y combinator','techcrunch','crunchbase',
             'angel list','angellist','indie hackers','gumroad','lemonsqueezy',
             'paddle','chargebee','recurly','braintree','paypal','wise',
             'revolut','plaid','coinbase','binance','robinhood','vanguard',
             'morning brew','the hustle','hbr','forbes','bloomberg',
             'wall street journal','nyt','new york times','bbc','cnn',
             'reuters','associated press','apple','meta','nvidia','intel',
             'ibm','oracle','sap','adobe','autodesk','atlassian',
             'hubspot','marketo','pardot','drift','outreach','salesloft',
             'gong','chorus','clari','apollo','zoominfo','clearbit',
             'lusha','hunter','snov','lemlist','woodpecker','reply.io',
             'mailshake','instantly','smartlead','warmbox','mailtrap',
             'postmark','amazon ec2','google cloud','volter','dino','deno',
             'node','react','angular','vue','svelte','next.js','nuxt',
             'remix','astro','tailwind','bootstrap','material ui',
             'chakra','ant design','storybook','cypress','playwright',
             'jest','vitest','mocha','pytest','selenium','puppeteer',
             'webpack','vite','rollup','esbuild','turbopack','bun',
             'pnpm','npm','yarn','pip','cargo','maven','gradle',
             'cocoapods','swift','kotlin','flutter','react native',
             'expo','ionic','capacitor','electron','tauri','wasm',
             'rust','go','python','java','ruby','php','elixir','scala',
             'haskell','clojure','erlang','lua','perl','r','julia',
             'matlab','fortran','cobol','assembly','c++','c#',
             'typescript','javascript','sql','graphql','rest','grpc',
             'websocket','mqtt','kafka','rabbitmq','celery','airflow',
             'luigi','prefect','dagster','dbt','snowflake','databricks',
             'bigquery','redshift','clickhouse','timescale','influxdb',
             'prometheus','opensearch','elasticsearch','solr','algolia',
             'meilisearch','typesense','pinecone','weaviate','qdrant',
             'chroma','langchain','llamaindex','autogen','crewai',
             'streamlit','gradio','jupyter','colab','kaggle','hugging face',
             'replicate','modal','banana','runpod','lambda labs',
             'paperspace','vast.ai','together.ai','anyscale','ray',
             'mlflow','wandb','neptune','comet','clearml','bentoml',
             'seldon','kubeflow','sagemaker','vertex ai','azure ml',
             'bedrock','palm','gemini','llama','mistral','cohere',
             'ai21','aleph alpha','stability ai','midjourney','dall-e',
             'whisper','eleven labs','play.ht','murf','descript',
             'runway','pika','sora','heygen','synthesia','d-id',
             'colossyan','elai','rephrase','tavus','bhuman',
             'windsor','sendspark','vidyard','loom','tella','mmhmm',
             'screencast','obs','camtasia','screenflow','snagit','notion']
    tl = text.lower()
    for b in known:
        if b in tl:
            brands.add(b)
    return len(brands)

def syllable_count(word):
    word = word.lower().strip()
    if not word:
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
    if count == 0:
        count = 1
    return count

def avg_syllables(text):
    words = re.findall(r'[a-zA-Z]+', text.lower())
    if not words:
        return 1.0
    return sum(syllable_count(w) for w in words) / len(words)

def flesch_kincaid(text):
    words = re.findall(r'[a-zA-Z]+', text.lower())
    wc = len(words) if words else 1
    sc = count_sentences(text)
    syls = sum(syllable_count(w) for w in words) if words else 1
    return 0.39 * (wc / sc) + 11.8 * (syls / wc) - 15.59

def word_diversity(text):
    words = re.findall(r'[a-zA-Z]+', text.lower())
    if not words:
        return 0.0
    return round(len(set(words)) / len(words), 3)

def extract_dimensions(tid, transcript):
    t = transcript
    tl = t.lower()
    words = t.split()
    wc = len(words)
    
    # Handle music-only / nonsensical transcripts
    is_music_only = wc < 20 or (count_pattern(tl, [r'\[music\]', r'\[applause\]']) > wc * 0.3)
    
    sc = count_sentences(t)
    first_sent = get_first_sentence(t)
    first_sent_words = len(first_sent.split())
    
    # V1: Opening
    first_words_lower = ' '.join(words[:15]).lower() if words else ''
    
    # hook_type detection
    if re.search(r'^(hi|hey|hello|welcome|what\'?s up)', first_words_lower):
        hook_type = "greeting"
    elif re.search(r'^(imagine|have you ever|what if|are you)', first_words_lower):
        hook_type = "question"
    elif re.search(r'^(introducing|meet|we\'?re excited|announcing|we just|today we)', first_words_lower):
        hook_type = "announcement"
    elif re.search(r'^(i was|when i|my name|i\'?m |we were|our story)', first_words_lower):
        hook_type = "founder_story"
    elif re.search(r'(tired|frustrated|broken|struggling|overwhelm|complex|difficult|problem|challenge|slow|suck)', first_words_lower):
        hook_type = "pain_point"
    elif re.search(r'(let me show|click|here you|in this video|in this demo)', first_words_lower):
        hook_type = "demo_instruction"
    elif re.search(r'(the first|the only|the best|the most|revolutionary|never before)', first_words_lower):
        hook_type = "bold_claim"
    elif re.search(r'(\d+%|\d+ million|\d+ billion|\d+x|\$\d+)', first_words_lower):
        hook_type = "stat_number"
    elif re.search(r'^(sales|managing|creating|building|for decades|videos are|in the)', first_words_lower):
        hook_type = "descriptive"
    else:
        hook_type = "product_statement"
    
    if is_music_only:
        hook_type = "descriptive"
    
    first_person_opener = 1 if re.match(r'^(i |i\'|we |we\'|my |our )', first_words_lower) else 0
    has_negative_opener = 1 if re.search(r'(broken|tired|hate|frustrated|problem|overwhelm|difficult|complex|suck|challenge|slow|no |never |stop)', first_words_lower) else 0
    
    # hook_quality 
    if is_music_only:
        hook_quality = 1
    elif hook_type in ("pain_point", "question", "bold_claim", "stat_number"):
        hook_quality = 4
    elif hook_type == "founder_story":
        hook_quality = 3
    elif hook_type in ("greeting", "demo_instruction"):
        hook_quality = 2
    else:
        hook_quality = 3
    
    # Adjust hook_quality based on specifics
    if re.search(r'(what if|imagine|have you ever)', first_words_lower):
        hook_quality = min(5, hook_quality + 1)
    if wc < 30:
        hook_quality = max(1, hook_quality - 1)
    
    # Length & Readability
    avg_sent_len = round(wc / max(1, sc), 1)
    fk_grade = round(flesch_kincaid(t), 1)
    wd = word_diversity(t)
    syl_density = round(avg_syllables(t), 2)
    
    # Pronouns & Voice
    we_count = count_pattern(tl, ['we', 'our', 'us', "we're", "we've", "we'll"])
    you_count = count_pattern(tl, ['you', 'your', "you're", "you'll", "you've"])
    
    if we_count > you_count * 1.5:
        pronoun_strategy = "mostly_we"
    elif you_count > we_count * 1.5:
        pronoun_strategy = "mostly_you"
    elif we_count + you_count < 3:
        pronoun_strategy = "neutral"
    else:
        pronoun_strategy = "balanced"
    
    hedge_count = count_pattern(tl, ['maybe', 'perhaps', 'might', 'kind of', 'sort of', 'arguably', 'possibly', 'probably'])
    filler_count = count_pattern(tl, ['um', 'uh', 'like', 'basically', 'actually', 'literally', 'so yeah'])
    
    # Narrative Arc
    # Split into halves
    half = wc // 2
    first_half = ' '.join(words[:half]).lower()
    second_half = ' '.join(words[half:]).lower()
    
    problem_words = ['problem', 'challenge', 'difficult', 'struggle', 'pain', 'frustrat', 'tedious', 'complex', 'overwhelm', 'slow', 'manual', 'broken', 'waste', 'expensive', 'tired', 'hard', 'issue', 'suck']
    solution_words = ['solution', 'introducing', 'built', 'created', 'designed', 'helps', 'allows', 'enables', 'provides', 'offers', 'makes it easy', 'automat', 'seamless', 'powerful', 'feature', 'tool']
    
    prob_first = sum(1 for w in problem_words if w in first_half)
    prob_second = sum(1 for w in problem_words if w in second_half)
    sol_first = sum(1 for w in solution_words if w in first_half)
    sol_second = sum(1 for w in solution_words if w in second_half)
    
    total_prob = prob_first + prob_second
    total_sol = sol_first + sol_second
    
    if wc < 50:
        narrative_arc = "too_short"
    elif prob_first > sol_first and sol_second > prob_second:
        narrative_arc = "problem_solution"
    elif sol_first > prob_first and prob_first <= 1:
        narrative_arc = "solution_first"
    elif total_prob > total_sol * 2:
        narrative_arc = "problem_heavy"
    elif re.search(r'(\d+ users|\d+ customers|\d+ companies|funded|revenue|growth)', first_half):
        narrative_arc = "traction_first"
    else:
        narrative_arc = "neutral_flat"
    
    # topic_transitions - count major shifts
    transition_markers = count_pattern(tl, ['now let', 'moving on', 'next', 'the next', 'also', 'another', 'finally', 'last', 'but wait', 'on top', 'in addition', 'furthermore', 'moreover', 'the second', 'the third', 'number one', 'number two', 'first', 'second', 'third'])
    topic_transitions = min(transition_markers, 15)
    
    problem_pct = round(total_prob / max(1, total_prob + total_sol) * 100, 1) if not is_music_only else 0.0
    solution_pct = round(total_sol / max(1, total_prob + total_sol) * 100, 1) if not is_music_only else 0.0
    
    declining_arc = 1 if re.search(r'(hurry|limited time|don\'t miss|act now|before it\'s too late|running out)', second_half) else 0
    
    # Metrics & Traction
    numbers = re.findall(r'\b\d+[\d,]*\.?\d*\b', t)
    number_count = len(numbers)
    number_density = round(number_count / max(1, wc) * 100, 2)
    
    # metric_placement
    first_third = ' '.join(words[:wc//3])
    mid_third = ' '.join(words[wc//3:2*wc//3])
    last_third = ' '.join(words[2*wc//3:])
    nums_first = len(re.findall(r'\b\d+\b', first_third))
    nums_mid = len(re.findall(r'\b\d+\b', mid_third))
    nums_last = len(re.findall(r'\b\d+\b', last_third))
    
    if number_count == 0:
        metric_placement = "none"
    elif nums_first >= nums_mid and nums_first >= nums_last:
        metric_placement = "front"
    elif nums_last >= nums_first and nums_last >= nums_mid:
        metric_placement = "back"
    else:
        metric_placement = "middle"
    
    before_after_total = count_pattern(tl, ['before and after', 'before.*after', 'used to.*now', 'was averaging.*now', 'went from.*to', 'from.*to', 'before.*with'])
    # Cap the before_after due to greedy matching
    before_after_total = min(before_after_total, 5)
    
    success_users = count_pattern(tl, [r'\d+\s*(users|customers|clients|teams|companies|merchants|developers|people)', 'thousands of', 'millions of'])
    success_revenue = count_pattern(tl, [r'\$\d+', 'revenue', 'arr', 'mrr', 'funding', 'million', 'billion', 'trillion'])
    success_cost_savings = count_pattern(tl, [r'\d+%\s*(less|cheaper|savings|reduction|lower)', 'save.*\$', 'costs?\s*\d+%', 'reduce.*cost', '96% less', '91% lower', '80% on time', '95% of your time', '50%'])
    success_growth = count_pattern(tl, ['growth', r'\d+x', 'doubled', 'tripled', 'grew', 'scale', 'scaling', 'accelerat'])
    
    # Social Proof
    brand_count = count_unique_brands(t)
    has_investor_mention = 1 if re.search(r'(investor|funding|funded|raised|series [a-z]|seed round|venture|vc|angel)', tl) else 0
    has_testimonial = 1 if re.search(r'(said|told us|according to|quote|testimonial|".*")', tl) else 0
    trusted_by = 1 if re.search(r'(trusted by|used by|relied on by|chosen by|loved by)', tl) else 0
    has_partnership = 1 if re.search(r'(partner|partnership|collaboration|collaborated|in collaboration)', tl) else 0
    has_credential = 1 if re.search(r'(ex-|former|phd|professor|expert|years? of experience|from google|from facebook|from meta|from amazon|stanford|mit|harvard|yale|co-?founder|founder|head of|ceo|cto|vp of)', tl) else 0
    
    social_proof_claims = success_users + has_investor_mention + has_testimonial + trusted_by + has_partnership + has_credential
    platform_mentions = brand_count
    
    competitive_total = count_pattern(tl, ['unlike', 'compared to', 'versus', 'vs', 'better than', 'faster than', 'competitors?', 'competing', 'alternative', 'instead of', 'traditional', 'other tools', 'other solutions', 'existing solutions', 'most.*tools', 'most.*platforms', '99% of'])
    replacement_total = count_pattern(tl, ['replace', 'replacing', 'switch from', 'goodbye to', 'no more', 'say goodbye', 'forget about', 'ditch', 'drop', 'stop using'])
    
    # Category & Positioning
    category_creation_total = count_pattern(tl, ['the first', 'the only', 'a new kind', 'new way', 'new era', 'we invented', 'first of', 'never been', 'reimagine', 'reinvent', 'revolutionize', 'next generation', 'the future of'])
    ai_count = count_pattern(tl, ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural', 'gpt', 'llm', 'large language model', 'generative'])
    ai_density = round(ai_count / max(1, wc) * 100, 2)
    buzzword_count = count_pattern(tl, ['revolutionary', 'game.?chang', 'cutting.?edge', 'disrupt', 'paradigm', 'synergy', 'leverage', 'empower', 'unlock', 'seamless', 'frictionless', 'world.?class', 'best.?in.?class', 'state.?of.?the.?art', 'bleeding edge', 'groundbreaking'])
    
    # CTA & Closing
    last_50 = ' '.join(words[-50:]).lower() if wc > 50 else tl
    
    cta_patterns = {
        'waitlist': r'(waitlist|wait list|waiting list)',
        'join': r'(join us|join our|join the|join now)',
        'sign_up': r'(sign up|signup|register|create.*account)',
        'try': r'(try it|try us|try .* today|try .* now|try .* free)',
        'get_started': r'(get started|start your|start today|start now)',
        'book_demo': r'(book.*demo|schedule.*demo|request.*demo)',
        'free': r'(for free|free trial|free access|free tier|no credit card)',
        'beta': r'(beta|early access)',
        'limited': r'(limited|exclusive|only \d+ spots)'
    }
    
    primary_cta = "none"
    for cta_name, pattern in cta_patterns.items():
        if re.search(pattern, tl):
            primary_cta = cta_name
    
    # cta_position
    cta_anywhere = any(re.search(p, tl) for p in cta_patterns.values())
    cta_in_end = any(re.search(p, last_50) for p in cta_patterns.values())
    cta_in_start = any(re.search(p, first_words_lower) for p in cta_patterns.values())
    
    if not cta_anywhere:
        cta_position = "none"
    elif cta_in_end:
        cta_position = "end"
    elif cta_in_start:
        cta_position = "start"
    else:
        cta_position = "middle"
    
    has_discount = 1 if re.search(r'(discount|deal|offer|coupon|% off|sale price|promo)', tl) else 0
    has_scarcity = 1 if re.search(r'(limited|exclusive|only \d+ spots|first \d+|running out|don\'t miss|last chance)', tl) else 0
    has_pricing = 1 if re.search(r'(\$\d+|pricing|price|plan|per month|/mo|subscription|free plan|free tier|\d+ bucks)', tl) else 0
    has_url = 1 if re.search(r'(\.com|\.io|\.dev|\.ai|\.co|\.net|\.org|website|our site|check out|head over)', tl) else 0
    
    closing_has_cta = 1 if cta_in_end else 0
    closing_has_thanks = 1 if re.search(r'(thank|thanks|bye|farewell|see you|cheers|cheerio|peace)', last_50) else 0
    
    # Content Signals
    storytelling = 1 if re.search(r'(story|one day|back in|i was|we were|imagine|once upon|remember when|anecdote|journey)', tl) else 0
    humor = 1 if re.search(r'(haha|lol|joke|funny|kidding|just kidding|humor|laugh|chuckle|seriously\?|no seriously|cats|puppies|capibara|terminator|kung fu|cat videos)', tl) else 0
    
    demo_instructions = count_pattern(tl, ['click here', 'click on', 'let me show', 'i\'ll show', 'let\'s', 'press the', 'click this', 'tap on', 'go to', 'open the', 'i\'m going to'])
    screen_narration = count_pattern(tl, ['here you can see', 'you can see', 'on the left', 'on the right', 'as you can see', 'notice that', 'you\'ll see', 'you will see', 'here we have', 'over here', 'right here', 'this is where', 'this is the', 'on this page'])
    data_viz_cues = count_pattern(tl, ['chart', 'graph', 'dashboard', 'analytics', 'visualization', 'data', 'metrics', 'statistics', 'plot', 'report'])
    energy_markers = len(re.findall(r'!', t)) + count_pattern(tl, ['amazing', 'awesome', 'incredible', 'fantastic', 'wonderful', 'exciting', 'excellent', 'brilliant', 'gorgeous', 'beautiful', 'superb', 'super', 'boom', 'bam', 'whabam', 'magic', 'hell yeah', 'whoop', 'sick'])
    feature_list_markers = count_pattern(tl, ['first', 'second', 'third', 'fourth', 'fifth', 'also', 'another', 'in addition', 'furthermore', 'moreover', 'plus', 'on top of', 'not only', 'number one', 'number two'])
    production_markers = count_pattern(tl, [r'\[music\]', r'\[applause\]', r'\[sound\]', r'\[laughter\]'])
    
    # speaker_changes
    speaker_changes = len(re.findall(r'[A-Z][a-z]+:', t))
    
    action_verb_count = count_pattern(tl, ['build', 'create', 'launch', 'ship', 'deploy', 'generate', 'automate', 'transform', 'connect', 'integrate', 'track', 'manage', 'analyze', 'discover', 'capture', 'save', 'send', 'export', 'import', 'download', 'upload', 'record', 'share', 'publish', 'customize', 'configure', 'set up', 'install', 'run', 'start', 'scale', 'grow', 'drive'])
    
    feature_words = count_pattern(tl, ['feature', 'function', 'capability', 'tool', 'module', 'component', 'interface', 'dashboard', 'editor', 'plugin', 'extension', 'api', 'integration', 'widget', 'setting', 'option', 'mode', 'view', 'template', 'workflow', 'automation', 'bot', 'agent'])
    
    benefit_words = count_pattern(tl, ['save time', 'save money', 'faster', 'easier', 'simpler', 'more efficient', 'reduce', 'eliminate', 'streamline', 'boost', 'improve', 'enhance', 'increase', 'maximize', 'optimize', 'empower', 'accelerate', 'productivity', 'growth', 'revenue', 'engagement', 'conversion', 'performance', 'success', 'peace of mind', 'without', 'no more', 'never again'])
    
    benefit_ratio = round(benefit_words / max(1, benefit_words + feature_words), 2)
    
    question_count = t.count('?')
    passive_voice_count = count_pattern(tl, ['is being', 'are being', 'was being', 'were being', 'has been', 'have been', 'had been', 'will be', 'being done', 'been created', 'been built', 'been designed', 'been made', 'was built', 'was created', 'was designed', 'is designed', 'is built', 'is powered', 'is integrated'])
    
    # Sentiment
    pos_words = count_pattern(tl, ['love', 'great', 'amazing', 'awesome', 'fantastic', 'excellent', 'wonderful', 'incredible', 'perfect', 'best', 'happy', 'excited', 'enjoy', 'beautiful', 'powerful', 'easy', 'simple', 'fast', 'free', 'fun', 'cool', 'super', 'brilliant'])
    neg_words = count_pattern(tl, ['hate', 'terrible', 'awful', 'broken', 'frustrat', 'struggle', 'pain', 'problem', 'difficult', 'complex', 'slow', 'waste', 'expensive', 'tedious', 'boring', 'overwhelm', 'confus', 'annoying', 'nightmare', 'suck'])
    
    if pos_words > neg_words * 2:
        sentiment = "positive"
    elif neg_words > pos_words:
        sentiment = "negative"
    else:
        sentiment = "neutral" if is_music_only else "positive"
    
    confidence_count = count_pattern(tl, ['will', 'definitely', 'guaranteed', 'proven', 'ensure', 'certainly', 'absolutely', 'without a doubt', 'undoubtedly', 'clearly'])
    
    # product_name_repeats - try to find the product name
    # Look for capitalized words that appear multiple times
    product_name_repeats = 0
    cap_words = re.findall(r'\b[A-Z][a-z]{2,}\b', t)
    if cap_words:
        from collections import Counter
        cap_freq = Counter(cap_words)
        # Filter out common English words
        common = {'The', 'This', 'That', 'What', 'When', 'Where', 'How', 'Who', 'Why', 'Which',
                 'And', 'But', 'For', 'Not', 'All', 'Can', 'Had', 'Her', 'Was', 'One',
                 'Our', 'Out', 'Are', 'Has', 'His', 'Now', 'Old', 'See', 'Way', 'May',
                 'Say', 'She', 'Two', 'Use', 'Boy', 'Did', 'Get', 'Let', 'Put', 'Too',
                 'Its', 'New', 'Just', 'Here', 'With', 'From', 'They', 'Been', 'Have',
                 'More', 'Than', 'Some', 'Into', 'Over', 'Such', 'Also', 'Your', 'Will',
                 'Each', 'Make', 'Like', 'Long', 'Look', 'Many', 'Then', 'Them', 'Same',
                 'Well', 'Back', 'Even', 'Give', 'Most', 'Find', 'Very', 'After', 'Before',
                 'Going', 'About', 'Could', 'Would', 'Should', 'Music', 'Applause', 'Click',
                 'Next', 'Start', 'First', 'Last', 'Every', 'Still', 'Other'}
        for word, freq in cap_freq.most_common(5):
            if word not in common and freq >= 2:
                product_name_repeats = freq
                break
    
    # ============ V2 DIMENSIONS ============
    
    # A. Story Architecture
    inciting_incident = 1 if re.search(r'(last (year|month|week|tuesday|night)|one day|i was sitting|when i|i remember|back in \d|that moment|the day|i realized|we noticed|we saw|we experienced|i spent \d|around \d+ months ago)', tl) else 0
    
    villain_named = 1 if re.search(r'(spreadsheet|email|manual|google form|complex cod|node.?module|traditional|excel|the old way|existing solution|current tool|other platforms|competitor|cms|headless)', tl) else 0
    
    villain_list = []
    villain_candidates = ['spreadsheet', 'email', 'manual process', 'complex coding', 'traditional', 'the old way', 'existing solution', 'node modules', 'excel', 'google form', 'slow', 'expensive tool', 'multiple tools', 'switching between', 'copy paste', 'tedious', 'data silos']
    for v in villain_candidates:
        if v in tl:
            villain_list.append(v)
    villain_count = len(villain_list)
    
    stakes_escalation = 0
    if total_prob > 1:
        # Check if problem words escalate 
        if prob_second >= prob_first or re.search(r'(cost|lose|waste|fail|burn|hour|day|week|month|million|billion)', second_half):
            stakes_escalation = 1
    
    transformation_promise = 1 if re.search(r'(go from|transform|become|never again|revolutionize|reimagine|redefine|elevate|new era|turn .* into|convert .* into|takes you from)', tl) else 0
    
    # transformation_position
    if transformation_promise:
        for i, w in enumerate(words):
            if re.search(r'(transform|become|never|revolutionize|reimagine|redefine|elevate)', w.lower()):
                transformation_position = round(i / max(1, wc), 2)
                break
        else:
            transformation_position = 0.5
    else:
        transformation_position = -1
    
    # pivot_sharpness
    if re.search(r'(so we built|that\'s why we|introducing|meet |and that\'s where|enter )', tl):
        pivot_sharpness = 4
    elif re.search(r'(we created|we designed|we made|here\'s|this is where)', tl):
        pivot_sharpness = 3
    elif narrative_arc == "solution_first":
        pivot_sharpness = 2
    elif is_music_only or wc < 50:
        pivot_sharpness = 1
    else:
        pivot_sharpness = 3
    
    nested_stories = 1 if re.search(r'(one of our users|a customer|a user|like oli|like medy|like robert|like adam|like mike|like max|a team|this developer|emily)', tl) else 0
    
    temporal_anchors = count_pattern(tl, [r'\d+ year', r'\d+ month', r'\d+ week', r'\d+ day', r'\d+ hour', r'\d+ minute', r'\d+ second', 'last year', 'last month', 'last quarter', 'last week', 'in 2\d{3}', 'since \d', 'ago', 'within minutes', 'in seconds', 'real.?time', 'instantly', 'immediately'])
    
    imagine_device = count_pattern(tl, ['imagine', 'picture this', 'what if you could', 'what if you', 'think about', 'envision', 'what would happen'])
    
    cliffhanger_beats = count_pattern(tl, ['but here\'s the thing', 'but here\'s the kicker', 'and then', 'wait until', 'the best part', 'you won\'t believe', 'but wait', 'there\'s more', 'and it gets', 'but it gets', 'hold on', 'but that\'s not all', 'and the cherry', 'and guess what'])
    
    why_now = 1 if re.search(r'(now that|in 2024|in 2023|the market|industry|regulation|finally|emerging|now you can|new technology|ai (has|can|enables|makes)|with ai)', tl) else 0
    
    # journey_vs_destination
    journey_phrases = count_pattern(tl, ['takes you from', 'journey', 'step by step', 'walkthrough', 'workflow', 'process', 'pipeline', 'guide you', 'walk you through'])
    destination_phrases = count_pattern(tl, ['the solution', 'the tool', 'the platform', 'the app', 'your assistant', 'your partner', 'all in one', 'one stop'])
    jvd_total = journey_phrases + destination_phrases
    journey_vs_destination = round(journey_phrases / max(1, jvd_total), 2)
    
    emotional_bookend_match = 0
    if wc > 50:
        first_20 = ' '.join(words[:20]).lower()
        last_20 = ' '.join(words[-20:]).lower()
        # Check for pain->relief pattern
        has_pain_start = any(w in first_20 for w in ['problem', 'frustrat', 'challenge', 'difficult', 'tired', 'struggle', 'overwhelm', 'suck'])
        has_relief_end = any(w in last_20 for w in ['try', 'start', 'enjoy', 'experience', 'discover', 'future', 'better', 'easy', 'free', 'thank'])
        # Or matching positive tones
        has_pos_start = any(w in first_20 for w in ['welcome', 'exciting', 'love', 'great', 'hello'])
        has_pos_end = any(w in last_20 for w in ['thank', 'excited', 'hope', 'love', 'enjoy', 'welcome'])
        if (has_pain_start and has_relief_end) or (has_pos_start and has_pos_end):
            emotional_bookend_match = 1
    
    unsaid_problem = count_pattern(tl, ['you know that feeling', 'we\'ve all been there', 'sound familiar', 'you know how', 'we all know', 'you probably', 'if you\'re like', 'we\'ve all', 'am i right', 'you already know'])
    
    # resolution_completeness
    if total_prob == 0:
        resolution_completeness = 1.0
    else:
        resolution_completeness = round(min(1.0, total_sol / max(1, total_prob)), 2)
    
    # story_compression
    if wc < 50:
        story_compression = 1.0
    elif temporal_anchors > 5:
        story_compression = 4.0
    elif temporal_anchors > 2:
        story_compression = 3.0
    else:
        story_compression = 2.0
    
    # B. Emotional Mechanics
    if re.search(r'(sinking feeling|2am|friday|deploy fails|first user signs up|watching everyone|sitting in a meeting|staring at|hours of|i was sitting|i remember the day|i spent \d+ (month|hour|day|week))', tl):
        emotion_specificity = 5
    elif re.search(r'(lonely journey|nine out of 10|no views no replies|talking to a wall|felt overwhelmed|drowning in|half of the internet|copy.?paste|tinkering|tediously researching|500 millisecond)', tl):
        emotion_specificity = 4
    elif re.search(r'(frustrated|overwhelm|tired|stressed|excited|challenge|struggle|pain point|headache|chaos|burden)', tl):
        emotion_specificity = 3
    elif re.search(r'(difficult|hard|complex|slow|expensive|time consuming)', tl):
        emotion_specificity = 2
    elif is_music_only:
        emotion_specificity = 1
    else:
        emotion_specificity = 2
    
    # relief_distance
    prob_positions = []
    sol_positions = []
    for i, w in enumerate(words):
        wl = w.lower()
        if any(p in wl for p in ['problem', 'challenge', 'difficult', 'frustrat', 'struggle', 'pain', 'overwhelm', 'manual', 'tedious']):
            prob_positions.append(i)
        if any(s in wl for s in ['introducing', 'solution', 'built', 'created', 'helps', 'enables']):
            sol_positions.append(i)
    
    if prob_positions and sol_positions:
        first_prob = prob_positions[0]
        first_sol = next((s for s in sol_positions if s > first_prob), sol_positions[0])
        sent_approx = max(0, (first_sol - first_prob) // max(1, int(avg_sent_len)))
        relief_distance = min(10, sent_approx)
    else:
        relief_distance = 0
    
    pride_trigger = count_pattern(tl, ['you already know', 'as a', 'you understand', 'smart teams', 'you\'re the kind', 'experienced user', 'if you\'re familiar', 'as developers we', 'fellow founder'])
    
    fomo_construction = count_pattern(tl, ['competitors are', 'the market is', 'everyone is', 'don\'t get left', 'your competitors', 'while you\'re still', 'most teams already', 'industry standard', 'leading companies', 'already using', 'already switched', 'golden era'])
    
    empathy_firsthand = 1 if re.search(r'(i spent|i was|when i|i had to|i realized|we experienced|we noticed|i personally|we struggled|we built.*because|i\'ve set up|i said no more)', tl) else 0
    empathy_observed = 1 if re.search(r'(teams struggle|developers spend|companies waste|businesses? (struggle|face|deal)|users? (struggle|face|spend)|people feel|employees? (feel|do not|don\'t))', tl) else 0
    
    frustration_facets = set()
    frust_map = {
        'time': ['slow', 'hours', 'days', 'weeks', 'time consuming', 'tedious', 'manual'],
        'cost': ['expensive', 'cost', 'waste money', 'spending'],
        'complexity': ['complex', 'complicated', 'difficult', 'hard', 'overwhelming', 'confusing'],
        'reliability': ['broken', 'fails', 'errors', 'bugs', 'unreliable', 'inconsistent'],
        'scale': ['can\'t scale', 'doesn\'t scale', 'limited', 'doesn\'t work for'],
        'fragmentation': ['multiple tools', 'switching between', 'silos', 'disconnected', 'scattered'],
        'quality': ['generic', 'low quality', 'mediocre', 'outdated', 'hallucinated'],
        'isolation': ['lonely', 'isolated', 'alone', 'disconnected'],
        'control': ['no control', 'locked in', 'limited', 'can\'t customize'],
        'risk': ['security', 'risk', 'vulnerable', 'unsafe', 'data loss']
    }
    for facet, patterns_list in frust_map.items():
        for p in patterns_list:
            if p in tl:
                frustration_facets.add(facet)
                break
    frustration_vocabulary_breadth = len(frustration_facets)
    
    # joy_velocity_shift
    if pivot_sharpness >= 4:
        joy_velocity_shift = 4
    elif pivot_sharpness >= 3:
        joy_velocity_shift = 3
    elif is_music_only:
        joy_velocity_shift = 1
    else:
        joy_velocity_shift = 2
    
    vulnerability_moment = 1 if re.search(r'(first version was|almost gave up|not perfect|got this wrong|our mistake|we failed|we learned|honestly|wasn\'t great|rough start)', tl) else 0
    
    anticipatory_emotion = count_pattern(tl, ['wait until you see', 'you\'re going to love', 'here\'s the exciting', 'watch this', 'check this out', 'let me show you', 'you\'ll love', 'you won\'t believe', 'want to see', 'want to know', 'ready to see', 'the cool thing', 'pretty incredible', 'exciting part'])
    
    social_belonging = count_pattern(tl, ['join', 'community', 'thousands of', 'fellow', 'builders', 'developers', 'makers', 'creators', 'family', 'club', 'together', 'our users', 'our customers', 'our team'])
    
    # loss_aversion_framing
    loss_phrases = count_pattern(tl, ['you\'re losing', 'wasting', 'missing out', 'costs you', 'losing money', 'losing time', 'every month', 'every day', 'every hour', 'left behind', 'falling behind'])
    gain_phrases = count_pattern(tl, ['save', 'gain', 'earn', 'get', 'receive', 'achieve', 'improve', 'boost', 'increase', 'grow'])
    lag_total = loss_phrases + gain_phrases
    loss_aversion_framing = round(loss_phrases / max(1, lag_total), 2)
    
    surprise_delight = count_pattern(tl, ['oh and it also', 'bonus', 'did i mention', 'cherry on top', 'oh and', 'on top of that', 'not only that', 'but it gets even', 'and there\'s more', 'there\'s so much more', 'and the best part', 'one more thing', 'haven\'t we mentioned'])
    
    # confidence_gradient
    if wc < 50:
        confidence_gradient = 1
    else:
        # Check if tone builds
        first_q = ' '.join(words[:wc//4]).lower()
        last_q = ' '.join(words[3*wc//4:]).lower()
        cert_first = count_pattern(first_q, ['will', 'definitely', 'ensure', 'guaranteed', 'proven', 'always'])
        cert_last = count_pattern(last_q, ['will', 'definitely', 'ensure', 'guaranteed', 'proven', 'always', 'best', 'fastest', 'most'])
        if cert_last > cert_first + 1:
            confidence_gradient = 4
        elif cert_last > cert_first:
            confidence_gradient = 3
        else:
            confidence_gradient = 2
    
    # emotional_contrast_ratio
    if is_music_only:
        emotional_contrast_ratio = 1
    elif total_prob > 2 and total_sol > 2:
        emotional_contrast_ratio = 4
    elif total_prob > 0 and total_sol > 0:
        emotional_contrast_ratio = 3
    else:
        emotional_contrast_ratio = 2
    
    finally_signal = count_pattern(tl, ['finally', 'at last', 'no more', 'never again', 'say goodbye', 'the wait is over', 'put an end', 'forget about', 'goodbye to', 'stop worrying', 'no longer'])
    
    # empathy_depth
    empathy_score = empathy_firsthand * 2 + empathy_observed + frustration_vocabulary_breadth + (1 if emotion_specificity >= 3 else 0)
    if empathy_score >= 5:
        empathy_depth = 5
    elif empathy_score >= 3:
        empathy_depth = 4
    elif empathy_score >= 2:
        empathy_depth = 3
    elif empathy_score >= 1:
        empathy_depth = 2
    else:
        empathy_depth = 1
    
    # C. Product Presentation
    # feature_intro_velocity
    if wc < 100:
        feature_intro_velocity = 3
    elif feature_words > wc / 30:
        feature_intro_velocity = 2  # features crammed
    else:
        feature_intro_velocity = 3
    if demo_instructions > 5 and feature_words > 3:
        feature_intro_velocity = max(1, feature_intro_velocity - 1)
    if screen_narration > 5:
        feature_intro_velocity = min(5, feature_intro_velocity + 1)
    
    # orphaned_features
    if feature_words == 0:
        orphaned_features = 0.0
    else:
        orphaned_features = round(max(0.0, 1.0 - benefit_ratio), 2)
    
    demo_voice_present_tense = 1 if re.search(r'(i click|i\'m clicking|watch as|see how|i drag|i type|i press|i select|let me|i open|i go|here i)', tl) else 0
    
    # concrete_vs_abstract
    concrete_indicators = count_pattern(tl, [r'\d+', 'click', 'button', 'page', 'screen', 'url', 'email', 'csv', 'pdf', 'api', 'dollar', 'minute', 'hour', 'step', 'field', 'form', 'column', 'row', 'pixel', 'slide'])
    abstract_indicators = count_pattern(tl, ['powerful', 'revolutionary', 'seamless', 'innovative', 'cutting edge', 'world class', 'premium', 'advanced', 'robust', 'comprehensive', 'holistic', 'dynamic', 'elegant'])
    
    ca_ratio = concrete_indicators / max(1, concrete_indicators + abstract_indicators)
    if is_music_only:
        concrete_vs_abstract = 1
    elif ca_ratio > 0.9 and concrete_indicators > 10:
        concrete_vs_abstract = 5
    elif ca_ratio > 0.8 and concrete_indicators > 5:
        concrete_vs_abstract = 4
    elif ca_ratio > 0.6:
        concrete_vs_abstract = 3
    elif ca_ratio > 0.4:
        concrete_vs_abstract = 2
    else:
        concrete_vs_abstract = 1
    
    # magic_moment_position - find the most impressive claim's position
    wow_patterns = ['and that\'s it', 'boom', 'bam', 'magic', 'whabam', 'incredible', 'amazing', 'powerful', 'just like that', 'that\'s how', 'pretty incredible', 'and it works', 'voila', 'there you go', 'and it\'s done']
    last_wow = 0.5
    for i, w in enumerate(words):
        if any(p in ' '.join(words[max(0,i-2):i+3]).lower() for p in wow_patterns):
            last_wow = round(i / max(1, wc), 2)
    magic_moment_position = last_wow
    
    speed_claims = count_pattern(tl, ['in seconds', 'instantly', 'instant', r'\d+x faster', 'real.?time', 'lightning fast', 'in minutes', 'within minutes', 'in a matter of', 'super fast', 'quickly', 'rapid', 'immediate'])
    
    effort_reduction_specific = 1 if re.search(r'(\d+ (hour|minute|step|day|week)s? (to|now|instead|vs|down to|reduced)|what took .* now takes|from \d+ to \d+|saves? \d+ (hour|minute|step)|96% less|91% lower|80%|95%|70%|50%)', tl) else 0
    effort_reduction_vague = 1 if re.search(r'(saves? time|easier|simpler|streamline|effortless|hassle.?free|no hassle|smooth)', tl) else 0
    
    # integration_count
    integration_names = ['slack', 'notion', 'zapier', 'github', 'hubspot', 'stripe', 'shopify', 'wordpress', 'figma', 'airtable', 'google sheets', 'google docs', 'google cloud', 'aws', 'azure', 'digital ocean', 'linear', 'jira', 'crm', 'erp', 'quickbooks', 'mixpanel', 'revenue cat', 'chrome', 'vs code', 'vscode', 'jupyter', 'docker']
    integration_count = sum(1 for n in integration_names if n in tl)
    
    progressive_disclosure = 1 if re.search(r'(start with|basic|beginner|then.*advanced|power user|pro tip|for advanced|for expert|simple.*first|complex.*later|building on|level up)', tl) else 0
    one_more_thing = 1 if re.search(r'(one more thing|bonus|oh and|last but not least|cherry on top|the best part|and finally|and there\'s more|the biggest showstopper)', tl) else 0
    
    simplicity_signals = count_pattern(tl, ['simple', 'easy', 'intuitive', 'no learning curve', 'one click', 'drag and drop', 'just click', 'just type', 'just press', 'just select', 'just enter', 'just share', 'just scan', 'just open', 'user.?friendly', 'no code', 'no coding', 'no complex', 'effortless', 'straightforward', 'plug and play'])
    
    under_the_hood = 1 if re.search(r'(built on|powered by|uses? (gpt|vector|embedding|llm|transformer|neural)|open source|architecture|infrastructure|algorithm|under the hood|behind the scenes|tech stack|typescript|python|rust|deno|tailwind|docker|custom model|wire ?guard|ssh|precompile|hardware|our own)', tl) else 0
    
    # use_case_count
    use_cases = set()
    uc_map = {
        'developer': ['developer', 'engineer', 'coder', 'programmer'],
        'designer': ['designer', 'figma', 'design'],
        'marketer': ['marketing', 'marketer', 'seo', 'content creator'],
        'sales': ['sales', 'prospecting', 'crm', 'leads'],
        'manager': ['manager', 'pm', 'product manager', 'project manager'],
        'student': ['student', 'learn', 'study', 'education'],
        'founder': ['founder', 'entrepreneur', 'startup', 'solopreneur'],
        'finance': ['finance', 'cfo', 'accounting', 'budget'],
        'support': ['customer success', 'support', 'help desk'],
        'hr': ['hr', 'employee', 'team management'],
        'creator': ['content creator', 'youtuber', 'creator', 'influencer'],
        'photographer': ['photography', 'photographer', 'photo'],
        'writer': ['writer', 'writing', 'blog', 'article'],
        'analyst': ['analyst', 'analytics', 'data analyst', 'spreadsheet'],
    }
    for uc, patterns_list in uc_map.items():
        for p in patterns_list:
            if p in tl:
                use_cases.add(uc)
                break
    use_case_count = len(use_cases)
    
    # liveness_score
    if demo_instructions > 5 and screen_narration > 3:
        liveness_score = 4
    elif demo_instructions > 2:
        liveness_score = 3
    elif production_markers > 2:
        liveness_score = 1
    elif re.search(r'(let me show|watch|demo)', tl):
        liveness_score = 3
    else:
        liveness_score = 2
    
    onboarding_time_claim = 1 if re.search(r'(up and running in|deploy in|set up in|start in|within \d+ minute|in \d+ minute|in just \d+|takes \d+ minute|2 minutes|5 minutes|60 seconds|one minute)', tl) else 0
    comparison_moment = 1 if re.search(r'(here\'s the old|on the left.*on the right|before.*after|side by side|compared|versus|traditional.*vs)', tl) else 0
    
    # D. Wording & Rhetoric
    # verb_energy
    punchy_verbs = count_pattern(tl, ['ship', 'crush', 'build', 'launch', 'deploy', 'create', 'generate', 'blast', 'fire', 'smash', 'nail', 'hack', 'crack', 'dive', 'jump', 'rock', 'boost', 'drive', 'power', 'fuel', 'ignite', 'spark'])
    corporate_verbs = count_pattern(tl, ['utilize', 'facilitate', 'leverage', 'implement', 'optimize', 'strategize', 'synergize', 'operationalize', 'incentivize'])
    
    if punchy_verbs > corporate_verbs * 3:
        verb_energy = 4
    elif punchy_verbs > corporate_verbs:
        verb_energy = 3
    elif corporate_verbs > punchy_verbs:
        verb_energy = 2
    else:
        verb_energy = 3
    
    # sentence_rhythm_variance
    sents = [s.strip() for s in re.split(r'[.!?]+', t) if s.strip()]
    if len(sents) < 3:
        sentence_rhythm_variance = 1
    else:
        lens = [len(s.split()) for s in sents]
        if lens:
            mean_len = sum(lens) / len(lens)
            variance = sum((l - mean_len) ** 2 for l in lens) / len(lens)
            std = math.sqrt(variance)
            cv = std / max(1, mean_len)
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
            sentence_rhythm_variance = 2
    
    # power_word_cluster_density
    power_words = ['free', 'new', 'now', 'instant', 'guaranteed', 'proven', 'exclusive', 'limited', 'easy', 'fast', 'simple', 'powerful', 'ultimate', 'best', 'first', 'only', 'save', 'discover', 'transform', 'boost', 'crush', 'dominate', 'rocket', 'turbocharge', 'supercharge', 'skyrocket', 'explode', 'massive', 'incredible']
    pw_count = count_pattern(tl, power_words)
    pw_density = pw_count / max(1, wc) * 100
    if pw_density > 3:
        power_word_cluster_density = 5
    elif pw_density > 2:
        power_word_cluster_density = 4
    elif pw_density > 1:
        power_word_cluster_density = 3
    elif pw_density > 0.5:
        power_word_cluster_density = 2
    else:
        power_word_cluster_density = 1
    
    # jargon_distribution_shape
    jargon_words = ['api', 'sdk', 'webhook', 'endpoint', 'oauth', 'jwt', 'cors', 'crud', 'graphql', 'rest', 'dns', 'ssl', 'cdn', 'saas', 'paas', 'iaas', 'devops', 'cicd', 'ci/cd', 'kubernetes', 'docker', 'microservice', 'serverless', 'lambda', 'terraform', 'ansible', 'prometheus', 'elasticsearch', 'redis', 'kafka', 'grpc', 'protobuf', 'wasm', 'bytecode', 'runtime', 'compiler', 'debugger', 'linter', 'transpiler', 'bundler']
    jargon_first = count_pattern(first_half, jargon_words)
    jargon_second = count_pattern(second_half, jargon_words)
    total_jargon = jargon_first + jargon_second
    
    if total_jargon <= 1:
        jargon_distribution_shape = "minimal"
    elif jargon_first > jargon_second * 1.5:
        jargon_distribution_shape = "front_heavy"
    elif jargon_second > jargon_first * 1.5:
        jargon_distribution_shape = "back_heavy"
    else:
        jargon_distribution_shape = "even"
    
    anaphora_count = 0
    for i in range(1, len(sents)):
        if sents[i] and sents[i-1]:
            w1 = sents[i].split()[:2]
            w0 = sents[i-1].split()[:2]
            if w1 and w0 and w1[0].lower() == w0[0].lower():
                anaphora_count += 1
    
    just_minimizer = count_pattern(tl, ['just click', 'just type', 'just drag', 'just press', 'just connect', 'just enter', 'just share', 'just scan', 'just open', 'just select', 'just start', 'just give', 'just choose', 'just say', 'just use', 'just go', 'just ask', 'just upload', 'just describe', 'just set'])
    
    # superlative_density
    superlatives = count_pattern(tl, ['best', 'most', 'fastest', 'only', 'first', '#1', 'number one', 'largest', 'biggest', 'smallest', 'highest', 'lowest', 'easiest', 'simplest', 'smartest', 'strongest'])
    superlative_density = round(superlatives / max(1, wc) * 100, 2)
    
    question_answer_pairs = 0
    qmarks = [m.start() for m in re.finditer(r'\?', t)]
    for qi in qmarks:
        # Check if followed by a short answer within ~30 chars
        after = t[qi+1:qi+50].strip()
        if after and len(after.split()) < 10 and not after.startswith('?'):
            question_answer_pairs += 1
    question_answer_pairs = min(question_answer_pairs, 10)
    
    # transition_sophistication
    fancy_transitions = count_pattern(tl, ['here\'s where it gets', 'the real magic', 'but the best part', 'now here\'s the thing', 'let me explain', 'here\'s how', 'the exciting part', 'but it gets even', 'and that\'s where', 'this is where'])
    basic_transitions = count_pattern(tl, ['^and ', '^also', '^so ', '^then', '^next'])
    if fancy_transitions > 3:
        transition_sophistication = 5
    elif fancy_transitions > 1:
        transition_sophistication = 4
    elif fancy_transitions >= 1:
        transition_sophistication = 3
    else:
        transition_sophistication = 2
    
    negation_as_benefit = count_pattern(tl, ['no .* needed', 'without', 'zero setup', 'zero config', 'never worry', 'eliminat', 'no code', 'no coding', 'no credit card', 'no learning curve', 'no more', 'no human input', 'no hassle'])
    
    # specificity_index
    specific_items = number_count + count_pattern(tl, [r'\$\d+', r'\d+%', r'\d+x'])
    if specific_items > 10:
        specificity_index = 5
    elif specific_items > 5:
        specificity_index = 4
    elif specific_items > 2:
        specificity_index = 3
    elif specific_items > 0:
        specificity_index = 2
    else:
        specificity_index = 1
    
    you_insertion_rate = round(you_count / max(1, wc) * 100, 2)
    
    cliche_count = count_pattern(tl, ['game.?changer', 'one.?stop shop', 'seamless', 'frictionless', 'empower', 'unlock', 'leverage', 'reimagine', 'disrupt', 'paradigm', 'synergy', 'holistic', 'cutting.?edge', 'best.?in.?class', 'world.?class', 'state.?of.?the.?art', 'next.?gen', 'bleeding edge', 'groundbreaking'])
    
    conditional_density = round(count_pattern(tl, ['if you', 'whether you', 'in case you', 'if you\'re', 'if you need', 'whether it', 'if your', 'depending on']) / max(1, wc) * 100, 2)
    
    parallel_structure = count_pattern(tl, ['build faster.*ship', 'save time.*save money', 'create.*share.*publish', 'find.*organize.*share', 'plan.*create.*share', 'search.*find.*use', 'capture.*organize.*share'])
    # Also check for repeated sentence starts
    parallel_structure += anaphora_count
    
    imperative_density = round(count_pattern(tl, ['try it', 'check .* out', 'sign up', 'get started', 'download', 'join', 'discover', 'explore', 'start', 'head over', 'visit', 'click', 'stop wasting', 'stop using', 'experience', 'embrace']) / max(1, wc) * 100, 2)
    
    # E. Persuasion Psychology
    # word_rarity_score
    rare_words = count_pattern(tl, ['bespoke', 'artisan', 'paradigm', 'salient', 'panacea', 'ubiquitous', 'ephemeral', 'nuance', 'alchemy', 'manifesto', 'ethos', 'zenith', 'apex', 'vanguard', 'propel', 'usher', 'herald', 'tapestry', 'mosaic', 'renaissance', 'catalyst', 'crucible', 'enigma', 'quintessential', 'meticulous', 'unparalleled', 'unprecedented', 'transcend', 'formidable', 'proliferat', 'consolidat', 'amalgamat', 'cultivat', 'orchestrat', 'capibara', 'mythology', 'serendipity', 'astounding'])
    if rare_words > 3:
        word_rarity_score = 5
    elif rare_words > 1:
        word_rarity_score = 4
    elif rare_words > 0:
        word_rarity_score = 3
    else:
        word_rarity_score = 2
    
    qualifying_retreat = count_pattern(tl, ['well.*one of', 'or at least', 'so to speak', 'in a way', 'not exactly', 'kind of like', 'you could say'])
    
    # conclusive_finality
    if re.search(r'(try it|get started|sign up|download|join|experience|start now|start today|check it out|go to|head over|visit|let\'s go|thank you|thanks|bye|cheerio|peace)', last_50):
        conclusive_finality = 4
    elif re.search(r'(this is just the beginning|more to come|stay tuned|that\'s it|so yeah)', last_50):
        conclusive_finality = 2
    elif is_music_only:
        conclusive_finality = 1
    else:
        conclusive_finality = 3
    # Boost for strong decisive closing
    if re.search(r'(today|now|right now|this instant)', last_50) and closing_has_cta:
        conclusive_finality = min(5, conclusive_finality + 1)
    
    # social_proof_stacking_order
    if success_users and has_testimonial:
        social_proof_stacking_order = "numbers_first"
    elif brand_count > 0 and success_users:
        social_proof_stacking_order = "brands_first"
    elif has_testimonial:
        social_proof_stacking_order = "quotes_first"
    else:
        social_proof_stacking_order = "none"
    
    # authority_type
    if re.search(r'(ex-|former|google|amazon|meta|phd|professor|stanford|mit|harvard)', tl):
        authority_type = "technical"
    elif re.search(r'(\d+.*(users|customers|companies|teams)|widely adopted|thousands of)', tl):
        authority_type = "market"
    elif re.search(r'(\d+ years?|decade|extensive experience|expert in|specialist)', tl):
        authority_type = "domain"
    elif has_credential and success_users:
        authority_type = "mixed"
    else:
        authority_type = "none"
    
    reciprocity_trigger = 1 if re.search(r'(free|no credit card|open source|free tier|free plan|free trial|free access|free template|free credits|free.*forever|generous free)', tl) else 0
    anchor_contrast_pricing = 1 if re.search(r'(enterprise.*\$.*we\'re|costs?\s*\$\d+.*\$\d+|91% lower price|96% less|traditional.*\$)', tl) else 0
    
    contrast_pairs = count_pattern(tl, ['instead of', 'not .* but', 'unlike', 'while others', 'rather than', 'traditional', 'the old way', 'other tools', 'before.*now', 'used to.*now'])
    
    # certainty_ratio
    certain_words = count_pattern(tl, ['will', 'definitely', 'always', 'guaranteed', 'ensure', 'certainly', 'proven', 'absolutely', 'without a doubt'])
    uncertain_words = count_pattern(tl, ['might', 'maybe', 'perhaps', 'could', 'possibly', 'probably', 'arguably'])
    cert_total = certain_words + uncertain_words
    certainty_ratio = round(certain_words / max(1, cert_total), 2)
    
    in_group_language = count_pattern(tl, ['as developers', 'as founders', 'fellow', 'if you\'re like us', 'we\'ve all been', 'we all know', 'our community', 'like-minded', 'same boat', 'you and your team'])
    
    objection_preempt = count_pattern(tl, ['you might be wondering', 'don\'t worry', 'and yes', 'you may think', 'but what about', 'concerned about', 'rest assured', 'fear not', 'no worries', 'you might think', 'worried about', 'and of course'])
    
    # scarcity_type
    if re.search(r'(today only|limited time|this week|for \d+ hours)', tl):
        scarcity_type = "time"
    elif re.search(r'(limited spots|only \d+ spots|first \d+ users)', tl):
        scarcity_type = "quantity"
    elif re.search(r'(invite only|exclusive|beta access|early access|waitlist)', tl):
        scarcity_type = "access"
    elif re.search(r'(the only|the first|only tool|only platform)', tl):
        scarcity_type = "capability"
    else:
        scarcity_type = "none"
    
    bandwagon_gradient = 0
    # Check if numbers grow through transcript
    nums_in_first = re.findall(r'(\d+)', first_half)
    nums_in_second = re.findall(r'(\d+)', second_half)
    if nums_in_first and nums_in_second:
        try:
            max_first = max(int(n) for n in nums_in_first if len(n) < 10)
            max_second = max(int(n) for n in nums_in_second if len(n) < 10)
            if max_second > max_first * 2:
                bandwagon_gradient = 1
        except:
            pass
    
    choice_architecture = 0
    if re.search(r'(three plans|3 plans|two plans|2 plans|free plan.*pro|starter.*pro|basic.*premium|lite.*standard|light plan|pricing)', tl):
        choice_architecture = 3
    elif re.search(r'(two options|either.*or|plan)', tl):
        choice_architecture = 2
    elif has_pricing:
        choice_architecture = 1
    
    cognitive_ease = count_pattern(tl, ['one click', 'automatic', 'zero config', 'plug and play', 'set it and forget', 'instant', 'instantly', 'effortless', 'no setup', 'out of the box', 'click and', 'magic', 'automat'])
    
    everyone_else_maneuver = count_pattern(tl, ['most teams', 'industry standard', 'your competitors', 'leading companies', 'top companies', 'already using', 'companies across', 'thousands of companies', 'widely adopted', 'most popular'])
    
    future_self_projection = count_pattern(tl, ['you\'ll become', 'imagine yourself', 'be the one', 'your future', 'you\'ll never', 'envision a world', 'picture yourself', 'you can become', 'you\'ll be able'])
    
    # F. Structure & Timing
    # info_density_shape
    fw = count_words(first_half)
    sw = count_words(second_half)
    info_first = concrete_indicators_first = len(re.findall(r'\b\d+\b', first_half)) + count_pattern(first_half, ['feature', 'function', 'tool', 'click', 'button'])
    info_second = len(re.findall(r'\b\d+\b', second_half)) + count_pattern(second_half, ['feature', 'function', 'tool', 'click', 'button'])
    
    if info_first > info_second * 1.5:
        info_density_shape = "front_loaded"
    elif info_second > info_first * 1.5:
        info_density_shape = "back_loaded"
    else:
        info_density_shape = "even"
    
    # breathing_room
    if wc < 100:
        breathing_room = 3
    elif avg_sent_len > 30:
        breathing_room = 2
    elif avg_sent_len < 15:
        breathing_room = 4
    else:
        breathing_room = 3
    if production_markers > 0:
        breathing_room = min(5, breathing_room + 1)
    
    # cold_open_words
    product_mention_patterns = ['introducing', 'meet ', 'welcome to', 'this is']
    cold_open = wc  # default: never mentions
    for i, w in enumerate(words[:min(50, wc)]):
        chunk = ' '.join(words[max(0,i-2):i+3]).lower()
        if any(p in chunk for p in product_mention_patterns) or re.search(r'[A-Z][a-z]+\s+(is|are|was|lets|helps|allows|enables)', ' '.join(words[max(0,i):i+5])):
            cold_open = i
            break
    cold_open_words = cold_open
    
    callback_count = count_pattern(tl, ['remember', 'going back', 'as i mentioned', 'earlier', 'ties back', 'as i said', 'like i showed', 'as we saw', 'back to'])
    
    # section_length_cv
    if len(sents) < 5:
        section_length_cv = 1
    else:
        sect_lens = [len(s.split()) for s in sents if s.strip()]
        if sect_lens:
            mean_sl = sum(sect_lens) / len(sect_lens)
            var_sl = sum((l - mean_sl)**2 for l in sect_lens) / len(sect_lens)
            cv_sl = math.sqrt(var_sl) / max(1, mean_sl)
            section_length_cv = min(5, max(1, round(cv_sl * 5)))
        else:
            section_length_cv = 2
    
    # promise_proof_push
    has_promise = 1.0 if total_sol > 0 or re.search(r'(helps|allows|enables|lets you|makes)', tl) else 0.0
    has_proof = 1.0 if social_proof_claims > 0 or success_users > 0 or has_testimonial else 0.0
    has_push = 1.0 if closing_has_cta or primary_cta != "none" else 0.0
    promise_proof_push = has_promise + has_proof + has_push
    
    # first_feature_position
    feature_patterns = ['feature', 'you can', 'allows you', 'helps you', 'enables', 'lets you', 'with .* you', 'click', 'dashboard', 'editor']
    first_feat_pos = 0.5
    for i, w in enumerate(words[:wc]):
        chunk = ' '.join(words[max(0,i-1):i+3]).lower()
        if any(p in chunk for p in feature_patterns):
            first_feat_pos = round(i / max(1, wc), 2)
            break
    first_feature_position = first_feat_pos
    
    parenthetical_credibility = count_pattern(tl, ['by the way', 'incidentally', 'which, by the way', 'fun fact', 'in passing', 'oh and'])
    
    section_boundary_markers = count_pattern(tl, ['number one', 'number two', 'number three', 'first', 'second', 'third', 'fourth', 'finally', 'lastly', 'let\'s move on', 'moving on', 'next up', 'next feature', 'the next'])
    
    # setup_payoff_distance
    if relief_distance > 5:
        setup_payoff_distance = 4.0
    elif relief_distance > 2:
        setup_payoff_distance = 3.0
    elif relief_distance > 0:
        setup_payoff_distance = 2.0
    else:
        setup_payoff_distance = 1.0
    
    multi_persona_address = 0
    persona_patterns = ['for developer', 'for designer', 'for marketer', 'for founder', 'for entrepreneur', 'for team', 'for business', 'for student', 'for sales', 'for support', 'for hr', 'for finance', 'for creator', 'for writer', 'for analyst', 'for pm', 'whether you\'re', 'if you\'re a']
    for p in persona_patterns:
        if p in tl:
            multi_persona_address += 1
    multi_persona_address = min(multi_persona_address, 8)
    
    # voice_consistency
    i_count = count_pattern(tl, [r'\bi\b', r'\bi\'m\b', r'\bi\'ll\b', r'\bi\'ve\b'])
    voice_shifts = abs(we_count - you_count) + abs(i_count - we_count)
    if voice_shifts < 3:
        voice_consistency = 5
    elif voice_shifts < 8:
        voice_consistency = 4
    elif voice_shifts < 15:
        voice_consistency = 3
    else:
        voice_consistency = 2
    
    counterfactual_count = count_pattern(tl, ['what if', 'without this', 'imagine not', 'if you didn\'t', 'what would happen', 'if you had to', 'what if you could'])
    
    # closing_velocity
    last_sents = sents[-5:] if len(sents) >= 5 else sents
    if last_sents:
        avg_last = sum(len(s.split()) for s in last_sents) / len(last_sents)
        if avg_last < 8:
            closing_velocity = 5
        elif avg_last < 12:
            closing_velocity = 4
        elif avg_last < 18:
            closing_velocity = 3
        else:
            closing_velocity = 2
    else:
        closing_velocity = 3
    
    open_loop_closing = 1 if re.search(r'(just the beginning|much more to come|stay tuned|wait until|more features|exciting plans|road ?map|coming soon|we\'re constantly|we\'ll be|look forward)', last_50) else 0
    definitive_closing = 1 if re.search(r'(try it today|get started now|sign up today|download now|check it out|visit|go to|\.com|\.io|\.ai|\.dev|start your|join us)', last_50) else 0
    
    # Build result
    result = {
        "id": str(tid),
        # V1: Opening
        "hook_type": hook_type,
        "first_person_opener": first_person_opener,
        "has_negative_opener": has_negative_opener,
        "first_sentence_words": first_sent_words,
        "hook_quality": hook_quality,
        # V1: Length & Readability
        "word_count": wc,
        "sentence_count": sc,
        "avg_sentence_length": avg_sent_len,
        "flesch_kincaid_grade": fk_grade,
        "word_diversity": wd,
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
        "definitive_closing": definitive_closing,
    }
    
    return result


def main():
    with open('/Users/maxguillabert/Downloads/index/launch-video-analysis/ph/v2-llm-parts/input_batch_11.json') as f:
        data = json.load(f)
    
    results = []
    for item in data:
        tid = item['id']
        transcript = item.get('transcript', '')
        r = extract_dimensions(tid, transcript)
        results.append(r)
        print(f"  Processed ID {tid}: {len(transcript)} chars, {r['word_count']} words")
    
    with open('/Users/maxguillabert/Downloads/index/launch-video-analysis/ph/v2-llm-parts/output_batch_11.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nDone. Processed {len(results)} transcripts. Output written.")
    
    # Verify all 200 dimensions
    if results:
        keys = set(results[0].keys())
        keys.discard('id')
        print(f"Dimensions extracted: {len(keys)}")
        if len(keys) != 200:
            print(f"WARNING: Expected 200 dimensions, got {len(keys)}")
            # List what we have
            expected = 200
            print(f"  Missing {expected - len(keys)} dimensions" if len(keys) < expected else f"  Extra {len(keys) - expected} dimensions")

if __name__ == '__main__':
    main()
