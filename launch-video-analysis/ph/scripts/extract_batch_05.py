#!/usr/bin/env python3
"""
Extract 200 dimensions from Product Hunt launch video transcripts.
Batch 05 processor.
"""

import json
import re
import math
from collections import Counter

# ─────────────────────────────────────────────────────────
# Utility functions
# ─────────────────────────────────────────────────────────

def tokenize(text):
    """Split text into words."""
    return re.findall(r"[a-zA-Z0-9']+(?:-[a-zA-Z0-9']+)*", text)

def sentences(text):
    """Split text into sentences."""
    # Handle >> as sentence boundaries (speaker changes)
    text = text.replace(">>", ".")
    # Split on sentence-ending punctuation
    sents = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in sents if s.strip() and len(s.strip()) > 1]

def count_syllables(word):
    """Estimate syllable count."""
    word = word.lower()
    if len(word) <= 3:
        return 1
    count = 0
    vowels = "aeiouy"
    prev_vowel = False
    for char in word:
        is_vowel = char in vowels
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel
    if word.endswith("e") and count > 1:
        count -= 1
    return max(1, count)

def flesch_kincaid(words_per_sent, syllables_per_word):
    """Estimate FK grade level."""
    return 0.39 * words_per_sent + 11.8 * syllables_per_word - 15.59

def relative_position(text, pattern_or_index):
    """Return 0-1 position of first occurrence in text."""
    if isinstance(pattern_or_index, int):
        return pattern_or_index / max(len(text), 1)
    m = re.search(pattern_or_index, text, re.IGNORECASE)
    if m:
        return m.start() / max(len(text), 1)
    return -1

def count_pattern(text, pattern, flags=re.IGNORECASE):
    """Count regex pattern matches."""
    return len(re.findall(pattern, text, flags))

def has_pattern(text, pattern, flags=re.IGNORECASE):
    """Check if regex pattern exists."""
    return 1 if re.search(pattern, text, flags) else 0

def first_sentence(text):
    """Get the first sentence."""
    sents = sentences(text)
    return sents[0] if sents else text[:100]

def last_n_sentences(text, n=3):
    """Get last n sentences."""
    sents = sentences(text)
    return " ".join(sents[-n:]) if sents else text[-200:]

def word_position(text, pattern):
    """Get position of pattern as fraction 0-1. -1 if absent."""
    m = re.search(pattern, text, re.IGNORECASE)
    if not m:
        return -1
    return m.start() / max(len(text), 1)

def count_in_region(text, pattern, start_frac, end_frac):
    """Count pattern matches in a region of text."""
    start = int(len(text) * start_frac)
    end = int(len(text) * end_frac)
    region = text[start:end]
    return count_pattern(region, pattern)


# ─────────────────────────────────────────────────────────
# Main extraction function
# ─────────────────────────────────────────────────────────

def extract_dimensions(item):
    """Extract all 200 dimensions from a transcript."""
    tid = item["id"]
    name = item.get("name", "")
    text = item.get("transcript", "")

    if not text or len(text.strip()) < 10:
        # Return defaults for empty/very short transcripts
        return make_default(tid, text, name)

    words = tokenize(text)
    word_count = len(words)
    sents = sentences(text)
    sent_count = max(len(sents), 1)
    lower_text = text.lower()
    first_sent = first_sentence(text)
    last_portion = last_n_sentences(text, 3)

    # Word frequencies
    word_freq = Counter(w.lower() for w in words)
    unique_words = len(word_freq)

    # Syllable computation
    total_syllables = sum(count_syllables(w) for w in words)
    avg_syllables = total_syllables / max(word_count, 1)

    # Avg sentence length
    words_per_sent = word_count / sent_count

    # FK grade
    fk = flesch_kincaid(words_per_sent, avg_syllables)

    # Product name detection
    product_name = name.lower().strip() if name else ""
    product_name_words = product_name.split()

    result = {"id": str(tid)}

    # ═══════════════════════════════════════════════════════
    # V1 DIMENSIONS (80)
    # ═══════════════════════════════════════════════════════

    # ─── Opening (6) ───
    result["hook_type"] = classify_hook(first_sent, text)
    result["first_person_opener"] = 1 if re.match(r"^\s*(I |I'|We |We')", text) else 0
    result["has_negative_opener"] = has_pattern(first_sent, r"\b(broken|tired|hate|frustrated|problem|struggle|pain|annoying|terrible|worst|sick of|fed up|nightmare|mess|chaos|failing|waste)\b")
    result["first_sentence_words"] = len(tokenize(first_sent))
    result["hook_quality"] = rate_hook_quality(first_sent, text)

    # ─── Length & Readability (6) ───
    result["word_count"] = word_count
    result["sentence_count"] = sent_count
    result["avg_sentence_length"] = round(words_per_sent, 1)
    result["flesch_kincaid_grade"] = round(max(0, fk), 1)
    result["word_diversity"] = round(unique_words / max(word_count, 1), 3)
    result["syllable_density"] = round(avg_syllables, 2)

    # ─── Pronouns & Voice (5) ───
    we_count = count_pattern(lower_text, r"\b(we|our|us)\b")
    you_count = count_pattern(lower_text, r"\b(you|your|you're|you've|you'll|you'd)\b")
    result["we_count"] = we_count
    result["you_count"] = you_count
    if we_count == 0 and you_count == 0:
        result["pronoun_strategy"] = "neutral"
    elif we_count > you_count * 1.5:
        result["pronoun_strategy"] = "mostly_we"
    elif you_count > we_count * 1.5:
        result["pronoun_strategy"] = "mostly_you"
    else:
        result["pronoun_strategy"] = "balanced"
    result["hedge_count"] = count_pattern(lower_text, r"\b(maybe|perhaps|might|kind of|sort of|arguably|probably|possibly|somewhat)\b")
    result["filler_count"] = count_pattern(lower_text, r"\b(um|uh|like|basically|actually|literally|so yeah|you know|i mean)\b")

    # ─── Narrative Arc (5) ───
    result["narrative_arc"] = classify_narrative_arc(text, lower_text, word_count)
    result["topic_transitions"] = count_topic_transitions(text)
    problem_pct, solution_pct = estimate_problem_solution_pct(text, lower_text)
    result["problem_pct"] = round(problem_pct, 1)
    result["solution_pct"] = round(solution_pct, 1)
    result["declining_arc"] = detect_declining_arc(text, sents)

    # ─── Metrics & Traction (8) ───
    numbers = re.findall(r'\b\d[\d,.]*\b', text)
    result["number_count"] = len(numbers)
    result["number_density"] = round(len(numbers) / max(word_count, 1) * 100, 2)
    result["metric_placement"] = classify_metric_placement(text, numbers)
    result["before_after_total"] = count_pattern(lower_text, r"\b(before|after|used to|now with|previously|compared to|went from|from .{1,30} to)\b")
    result["success_users"] = count_pattern(lower_text, r"\b(\d[\d,.]* (users|customers|teams|companies|people|businesses|clients|members|subscribers|downloads))\b")
    result["success_revenue"] = count_pattern(lower_text, r"\b(revenue|arr|mrr|\$[\d,.]+[mk]?|\d+[mk] arr|\d+[mk] revenue)\b")
    result["success_cost_savings"] = count_pattern(lower_text, r"\b(sav(e|es|ed|ing) .*?\$|\$.*?less|reduc(e|ed|es|ing) cost|cut cost|cheaper)\b")
    result["success_growth"] = count_pattern(lower_text, r"\b(\d+x growth|\d+% (growth|increase|more)|growing|doubled|tripled|10x|100x)\b")

    # ─── Social Proof (10) ───
    brands = extract_brands(text)
    result["brand_count"] = len(brands)
    result["has_investor_mention"] = has_pattern(lower_text, r"\b(investor|funded|raised|yc|y combinator|sequoia|a16z|andreessen|backing|backed by|venture|seed round|series [a-d])\b")
    result["has_testimonial"] = has_pattern(lower_text, r'(".*?".*?(said|says|told|shared|mentioned|wrote)|testimonial|user feedback|one of our (users|customers).*?said)')
    result["trusted_by"] = has_pattern(lower_text, r"\b(trusted by|used by|loved by|chosen by|relied on by|adopted by)\b")
    result["has_partnership"] = has_pattern(lower_text, r"\b(partner(ship|ed|ing)?|collaborat(e|ion|ing)|working with|teamed up|integrated with)\b")
    result["has_credential"] = has_pattern(lower_text, r"\b(ex-|former(ly)?|phd|doctor|professor|stanford|mit|harvard|google|meta|facebook|amazon|apple|microsoft|serial entrepreneur|years of experience)\b")
    result["social_proof_claims"] = count_pattern(lower_text, r"\b(trusted by|used by|loved by|\d[\d,.]* (users|teams|companies)|featured|award|recognized|top-rated)\b")
    result["platform_mentions"] = count_platform_mentions(lower_text)
    result["competitive_total"] = count_pattern(lower_text, r"\b(unlike|compared to|better than|faster than|instead of|versus|vs\.?|competitor|alternative to|other (tools|platforms|solutions))\b")
    result["replacement_total"] = count_pattern(lower_text, r"\b(replace|replaces|replacing|ditch|stop using|switch from|move away from|goodbye to|forget about)\b")

    # ─── Category & Positioning (4) ───
    result["category_creation_total"] = count_pattern(lower_text, r"\b(the first|the only|a new (kind|type|way|category)|we invented|we created|never been done|world's first|first ever|pioneering)\b")
    ai_count = count_pattern(lower_text, r"\b(ai|artificial intelligence|machine learning|ml|gpt|llm|large language model|neural|deep learning|generative|copilot)\b")
    result["ai_count"] = ai_count
    result["ai_density"] = round(ai_count / max(word_count, 1) * 100, 2)
    result["buzzword_count"] = count_pattern(lower_text, r"\b(revolutionary|game.?chang|cutting.?edge|disrupt|next.?gen|paradigm|synergy|holistic|scalable|robust|empower|leverage|unlock|supercharge|turbocharge|state.?of.?the.?art)\b")

    # ─── CTA & Closing (8) ───
    result["primary_cta"] = classify_cta(lower_text, last_portion)
    result["cta_position"] = classify_cta_position(lower_text)
    result["has_discount"] = has_pattern(lower_text, r"\b(discount|\d+% off|deal|offer|coupon|promo|special price|sale|savings)\b")
    result["has_scarcity"] = has_pattern(lower_text, r"\b(limited|exclusive|only \d+ spots|scarce|invite only|early access|before it's gone|don't miss|act now|hurry)\b")
    result["has_pricing"] = has_pattern(lower_text, r"\b(\$\d|pricing|price|free plan|free tier|per month|per year|\/mo|\/yr|starts at|starting at|costs? \$)\b")
    result["has_url"] = has_pattern(lower_text, r"\b(\.com|\.io|\.ai|\.co|\.dev|\.app|\.org|\.net|www\.|https?://|check out our website|visit us at)\b")
    result["closing_has_cta"] = has_pattern(last_portion.lower(), r"\b(try|sign up|get started|join|check.?out|visit|download|subscribe|start|book a demo|go to|head over|click)\b")
    result["closing_has_thanks"] = has_pattern(last_portion.lower(), r"\b(thank|thanks|bye|goodbye|cheers|appreciate|grateful)\b")

    # ─── Content Signals (15) ───
    result["storytelling"] = has_pattern(lower_text, r"\b(story|once upon|remember when|back (when|in)|one day|there was|imagine|picture this|let me tell you|it all started|years ago|it happened)\b")
    result["humor"] = has_pattern(lower_text, r"\b(haha|lol|joke|funny|laugh|😂|🤣|just kidding|no pun intended|spoiler alert|plot twist|humble brag)\b") or has_pattern(text, r"[!?]{2,}")
    result["demo_instructions"] = count_pattern(lower_text, r"\b(click here|let me show|i'll show|watch (me|this|as)|let's (see|look|try)|here i|i'm going to (show|demo|click|open)|check this out)\b")
    result["screen_narration"] = count_pattern(lower_text, r"\b(here you can see|on the (left|right|top|bottom|screen)|as you can see|you'll (see|notice)|over here|right here|this (part|section|area|panel)|looking at)\b")
    result["data_viz_cues"] = count_pattern(lower_text, r"\b(chart|graph|dashboard|visualization|data|analytics|metrics|plot|diagram|table|report)\b")
    result["energy_markers"] = count_pattern(text, r"[!]") + count_pattern(lower_text, r"\b(wow|amazing|incredible|awesome|fantastic|insane|crazy|love|exciting|beautiful|super|absolutely|extremely|unbelievable)\b")
    result["feature_list_markers"] = count_pattern(lower_text, r"\b(first(ly)?|second(ly)?|third(ly)?|fourth|fifth|also|another|in addition|plus|moreover|furthermore|next|and then|on top of that|number (one|two|three))\b")
    result["production_markers"] = count_pattern(text, r"\[(Music|Applause|MUSIC|WHIRRING|SNAP|THUD|KNOCKS|Sound|Laughter)\]|♪|🎵")
    result["speaker_changes"] = count_pattern(text, r">>") + count_pattern(text, r"\n\s*-\s") + count_pattern(text, r"\[Speaker \d\]")
    result["action_verb_count"] = count_pattern(lower_text, r"\b(build|create|launch|ship|deploy|automate|generate|analyze|transform|convert|integrate|connect|sync|monitor|track|manage|optimize|streamline)\b")
    result["feature_words"] = count_pattern(lower_text, r"\b(feature|function|capability|tool|mode|option|setting|module|component|widget|extension|plugin|integration|api|sdk)\b")
    result["benefit_words"] = count_pattern(lower_text, r"\b(save|fast|quick|easy|simple|efficient|productive|better|improve|reduce|eliminate|boost|enhance|grow|scale|free|secure|reliable|accurate)\b")
    fw = result["feature_words"]
    bw = result["benefit_words"]
    result["benefit_ratio"] = round(bw / max(bw + fw, 1), 2)
    result["question_count"] = count_pattern(text, r"\?")
    result["passive_voice_count"] = count_pattern(lower_text, r"\b(is|are|was|were|been|being|be) (built|made|designed|created|used|powered|developed|driven|integrated|optimized|generated|managed|handled)\b")

    # ─── Sentiment (3) ───
    pos_words = count_pattern(lower_text, r"\b(great|good|best|love|amazing|awesome|excellent|wonderful|fantastic|beautiful|brilliant|perfect|incredible|outstanding|powerful|impressive)\b")
    neg_words = count_pattern(lower_text, r"\b(bad|worst|terrible|horrible|awful|hate|broken|fail|pain|problem|issue|bug|error|frustrat|annoy|struggle|mess|chaos|nightmare)\b")
    if pos_words > neg_words * 2:
        result["sentiment"] = "positive"
    elif neg_words > pos_words * 2:
        result["sentiment"] = "negative"
    else:
        result["sentiment"] = "neutral" if (pos_words + neg_words < 3) else "positive"
    result["confidence_count"] = count_pattern(lower_text, r"\b(will|definitely|guaranteed|proven|certainly|absolutely|always|every time|100%|without fail|no doubt)\b")
    # Product name repeats
    if product_name and len(product_name) > 1:
        result["product_name_repeats"] = count_pattern(lower_text, r"\b" + re.escape(product_name) + r"\b")
        # Also try individual significant words
        if result["product_name_repeats"] == 0 and len(product_name_words) > 0:
            main_word = max(product_name_words, key=len)
            if len(main_word) > 2:
                result["product_name_repeats"] = count_pattern(lower_text, r"\b" + re.escape(main_word) + r"\b")
    else:
        result["product_name_repeats"] = 0

    # ═══════════════════════════════════════════════════════
    # V2 DIMENSIONS (100) — Deep semantic analysis
    # ═══════════════════════════════════════════════════════

    # ─── A. Story Architecture (17) ───
    result["inciting_incident"] = detect_inciting_incident(lower_text)
    result["villain_named"] = has_pattern(lower_text, r"\b(spreadsheet|email|manual|legacy|old (way|tool|system)|competitor|excel|slack|jira|complex|tedious|repetitive|bureaucra|red tape|status quo|current (solution|tool))\b")
    result["villain_count"] = count_villains(lower_text)
    result["stakes_escalation"] = detect_stakes_escalation(text, sents)
    result["transformation_promise"] = has_pattern(lower_text, r"\b(go from|transform|become|never again|turn you into|elevate|reimagine|rethink|change (how|the way)|revolution)\b")
    tp_pos = word_position(lower_text, r"\b(go from|transform|become|never again|turn you into|change (how|the way))\b")
    result["transformation_position"] = round(tp_pos, 2)
    result["pivot_sharpness"] = rate_pivot_sharpness(text, lower_text)
    result["nested_stories"] = has_pattern(lower_text, r"\b(one of our (users|customers|clients)|for example.{0,50}(was|had|needed|wanted)|case study|real.?world example|let me share|true story)\b")
    result["temporal_anchors"] = count_pattern(lower_text, r"\b(\d+ (years?|months?|weeks?|days?|hours?|minutes?|seconds?)|last (year|month|quarter|week)|in \d{4}|yesterday|today|tomorrow|right now|in (real.?time|seconds|minutes))\b")
    result["imagine_device"] = count_pattern(lower_text, r"\b(imagine|picture this|what if (you|we) could|think about|envision|wouldn't it be|how (great|cool|nice) would it be)\b")
    result["cliffhanger_beats"] = count_pattern(lower_text, r"\b(but here's the (thing|kicker|catch)|and then|wait (until|till)|the best part|you won't believe|but wait|here's where|and it gets better|guess what)\b")
    result["why_now"] = has_pattern(lower_text, r"\b(now that|for the first time|finally possible|new (era|age|technology)|the (time|moment) (is|has) (right|come)|thanks to (recent|new|ai|gpt)|market (is|has) (shifted|changed|evolved))\b")
    result["journey_vs_destination"] = estimate_journey_vs_destination(lower_text)
    result["emotional_bookend_match"] = detect_bookend_match(text, sents)
    result["unsaid_problem"] = count_pattern(lower_text, r"\b(you know (that|the|how)|we've all (been|experienced)|sound familiar|we all know|everyone knows|you've been there|ring a bell|tell me if this sounds)\b")
    result["resolution_completeness"] = estimate_resolution_completeness(text, lower_text)
    result["story_compression"] = rate_story_compression(text, sents, word_count)

    # ─── B. Emotional Mechanics (17) ───
    result["emotion_specificity"] = rate_emotion_specificity(lower_text)
    result["relief_distance"] = estimate_relief_distance(text, sents)
    result["pride_trigger"] = count_pattern(lower_text, r"\b(you already know|as a (developer|designer|founder|engineer|pm|manager|professional)|smart (teams|people|companies)|you're the kind|you understand|you get it|savvy)\b")
    result["fomo_construction"] = count_pattern(lower_text, r"\b(competitors? (are|is|already)|market is (moving|shifting)|everyone is (switch|mov|adopt)|don't get left|while you're still|falling behind|being left behind|missing out)\b")
    result["empathy_firsthand"] = has_pattern(lower_text, r"\b(i (spent|was|had|used|tried|worked|built|struggled|experienced)|we (spent|were|had|used|tried|built|struggled|experienced)|my (own|personal)|ourselves|i personally)\b")
    result["empathy_observed"] = has_pattern(lower_text, r"\b((teams|developers|companies|people|founders|businesses|users|managers|engineers) (struggle|spend|waste|lose|face|deal with|suffer|are frustrated|have to))\b")
    result["frustration_vocabulary_breadth"] = count_frustration_facets(lower_text)
    result["joy_velocity_shift"] = rate_joy_velocity(text, lower_text)
    result["vulnerability_moment"] = has_pattern(lower_text, r"\b(we (failed|almost gave up|got it wrong|struggled|messed up|were wrong)|our first (version|attempt|try) was|honestly|to be (honest|fair|transparent)|not perfect|we learned|it wasn't easy)\b")
    result["anticipatory_emotion"] = count_pattern(lower_text, r"\b(wait (until|till) you (see|hear)|you're going to love|here's the (exciting|cool|interesting|best) part|watch this|check this out|let me show you something|you'll love)\b")
    result["social_belonging"] = count_pattern(lower_text, r"\b(join (\d[\d,.]*)? ?(developers|teams|companies|users|founders|community)|community of|thousands of (teams|users)|you're in good company|fellow (founders|developers|builders)|part of)\b")
    result["loss_aversion_framing"] = estimate_loss_aversion(lower_text)
    result["surprise_delight"] = count_pattern(lower_text, r"\b(oh and|bonus|did (i|we) mention|cherry on top|and (it )?also|one more thing|on top of that|but that's not all|plus|and the best part)\b")
    result["confidence_gradient"] = rate_confidence_gradient(text, sents)
    result["emotional_contrast_ratio"] = rate_emotional_contrast(text, sents)
    result["finally_signal"] = count_pattern(lower_text, r"\b(finally|at last|no more|never again|say goodbye|put an end|the wait is over|stop (wasting|spending|worrying)|done with|forget about|goodbye to|end of)\b")
    result["empathy_depth"] = rate_empathy_depth(result)

    # ─── C. Product Presentation (17) ───
    result["feature_intro_velocity"] = rate_feature_intro_velocity(text, lower_text, word_count)
    result["orphaned_features"] = estimate_orphaned_features(text, lower_text)
    result["demo_voice_present_tense"] = has_pattern(lower_text, r"\b(i (click|drag|type|scroll|open|tap|hover|select)|watch as i|see how (it|this)|here (i|we) (go|are)|let me (just )?(click|show|open|navigate))\b")
    result["concrete_vs_abstract"] = rate_concrete_vs_abstract(lower_text)
    result["magic_moment_position"] = estimate_magic_moment_position(text, lower_text)
    result["speed_claims"] = count_pattern(lower_text, r"\b(in seconds|instantly|10x faster|real.?time|lightning fast|milliseconds|immediate|in minutes|within (seconds|minutes)|blazing|instant(ly)?|\dx faster|\d+x (faster|quicker|speed))\b")
    result["effort_reduction_specific"] = has_pattern(lower_text, r"\b(what took \d|from \d+ .{0,20}to \d|reduc.{0,20}\d+ .{0,20}to \d|\d+ (steps?|hours?|minutes?|clicks?) .{0,20}(to|into) \d|\d+% (less|fewer|reduction))\b")
    result["effort_reduction_vague"] = has_pattern(lower_text, r"\b(saves? time|easier|simpler|streamline|simplif|more efficient|less effort|cuts? down|speed up|accelerate|faster)\b")
    result["integration_count"] = count_integrations(lower_text)
    result["progressive_disclosure"] = detect_progressive_disclosure(text, lower_text)
    result["one_more_thing"] = detect_one_more_thing(text, lower_text, sents)
    result["simplicity_signals"] = count_pattern(lower_text, r"\b(simple|easy|intuitive|no learning curve|one click|drag and drop|just (click|drag|type|connect|add|install|paste|drop|upload)|out of the box|zero config|plug and play|no code|no.?code|low.?code)\b")
    result["under_the_hood"] = has_pattern(lower_text, r"\b(built (on|with)|powered by|under the hood|behind the scenes|architecture|infrastructure|tech stack|using (gpt|llm|openai|anthropic|claude|vector|embedding)|backbone)\b")
    result["use_case_count"] = count_use_cases(lower_text)
    result["liveness_score"] = rate_liveness(text, lower_text)
    result["onboarding_time_claim"] = has_pattern(lower_text, r"\b(up and running|deploy in|set up in|get started in|install in|running in|onboard in|live in|launch in) .{0,20}(seconds|minutes|hours|day)\b") or has_pattern(lower_text, r"\b(\d+ (second|minute|hour|day) (setup|install|onboarding|deployment))\b")
    result["comparison_moment"] = has_pattern(lower_text, r"\b(here's the old|on the left|on the right|side by side|before.{0,30}after|compare|traditional way|the old way|vs\.?|versus|without .{0,30} with )\b")

    # ─── D. Wording & Rhetoric (16) ───
    result["verb_energy"] = rate_verb_energy(lower_text)
    result["sentence_rhythm_variance"] = rate_sentence_rhythm(sents)
    result["power_word_cluster_density"] = rate_power_word_clusters(text, sents)
    result["jargon_distribution_shape"] = classify_jargon_distribution(text, lower_text)
    result["anaphora_count"] = count_anaphora(text, sents)
    result["just_minimizer"] = count_pattern(lower_text, r"\bjust (click|drag|type|connect|add|install|paste|drop|upload|open|tap|select|set|press|enter|write|scan|copy|import|link|sign|toggle|turn|pick|choose|plug|start|hit|run|do)\b")
    result["superlative_density"] = round(count_pattern(lower_text, r"\b(best|most|fastest|only|first|#1|number one|top|largest|biggest|smallest|cheapest|easiest|simplest|quickest)\b") / max(word_count, 1) * 100, 2)
    result["question_answer_pairs"] = count_qa_pairs(text, sents)
    result["transition_sophistication"] = rate_transition_sophistication(lower_text)
    result["negation_as_benefit"] = count_pattern(lower_text, r"\b(no (setup|config|code|install|download|credit card|sign.?up|learning curve|maintenance|hassle)|without (any|the need|having to|worry)|zero (setup|config|maintenance|effort|downtime)|never (worry|think|have to)|eliminates?|no need)\b")
    result["specificity_index"] = rate_specificity(lower_text, result["number_count"], word_count)
    result["you_insertion_rate"] = round(you_count / max(word_count, 1) * 100, 2)
    result["cliche_count"] = count_pattern(lower_text, r"\b(game.?changer|one.?stop.?shop|seamless|frictionless|empower|unlock|leverage|reimagine|disrupt|synergy|paradigm shift|bleeding edge|move the needle|low.?hanging fruit|best in class|world.?class|next level|take .+ to the next level)\b")
    result["conditional_density"] = round(count_pattern(lower_text, r"\b(if you (need|want|have|are)|whether you|in case you|when you (need|want))\b") / max(word_count, 1) * 100, 2)
    result["parallel_structure"] = count_parallel_structures(text, sents)
    result["imperative_density"] = round(count_pattern(lower_text, r"\b(try it|check (this|it) out|stop (wasting|spending)|sign up|get started|start (now|today|building|using)|join (now|us|today)|download|subscribe|go to|head over|click|visit|explore|discover)\b") / max(word_count, 1) * 100, 2)

    # ─── E. Persuasion Psychology (17) ───
    result["word_rarity_score"] = rate_word_rarity(words)
    result["qualifying_retreat"] = count_pattern(lower_text, r"\b(well,? (maybe|perhaps|at least|one of|not exactly)|or (at least|rather|maybe|perhaps)|i (should|might) say|to be fair)\b")
    result["conclusive_finality"] = rate_conclusive_finality(last_portion, sents)
    result["social_proof_stacking_order"] = classify_social_proof_order(text, lower_text)
    result["authority_type"] = classify_authority_type(lower_text)
    result["reciprocity_trigger"] = has_pattern(lower_text, r"\b(free (tier|plan|trial|version|template|access|forever)|open source|no credit card|free to (use|try|start)|complimentary|on us|at no cost|freebie)\b")
    result["anchor_contrast_pricing"] = has_pattern(lower_text, r"(\$\d[\d,.]*.*?(\$\d[\d,.]*|free)|cost.{0,50}(but|only|just|we).{0,30}\$|enterprise.{0,50}\$|instead of \$|compared to \$)")
    result["contrast_pairs"] = count_pattern(lower_text, r"\b(instead of|not .{1,20} but|unlike|while others|where .{1,30} we|traditional .{1,30} (vs|versus|but)|the old way .{1,30} (now|our))\b")

    # Certainty ratio
    certain_words = count_pattern(lower_text, r"\b(will|always|definitely|guaranteed|proven|certainly|absolutely|every time|without fail|100%|undoubtedly)\b")
    uncertain_words = count_pattern(lower_text, r"\b(maybe|perhaps|might|could|possibly|potentially|probably|arguably|somewhat|kind of|sort of)\b")
    result["certainty_ratio"] = round(certain_words / max(certain_words + uncertain_words, 1), 2)

    result["in_group_language"] = count_pattern(lower_text, r"\b(as (developers|founders|designers|engineers|teams|builders|creators) we|fellow (developers|founders|builders|engineers)|if you're like (us|me)|we've all (been|experienced|felt)|you know (how|what) it's like|one of us)\b")
    result["objection_preempt"] = count_pattern(lower_text, r"\b(you might (be wondering|think|ask)|don't worry|and yes|but what about|concerned about|rest assured|no need to worry|you're probably (thinking|wondering)|the good news)\b")
    result["scarcity_type"] = classify_scarcity_type(lower_text)
    result["bandwagon_gradient"] = detect_bandwagon_gradient(text, lower_text)
    result["choice_architecture"] = count_choice_tiers(lower_text)
    result["cognitive_ease"] = count_pattern(lower_text, r"\b(one click|automatic(ally)?|zero (config|setup|effort)|plug and play|set it and forget|instant|effortless|hands.?free|auto.?magic|out of the box|turnkey|self.?serv|no.?touch)\b")
    result["everyone_else_maneuver"] = count_pattern(lower_text, r"\b(most (teams|companies|developers)|industry standard|your competitors|leading (companies|teams|brands)|already (using|adopted|switched)|standard practice|the new (normal|standard))\b")
    result["future_self_projection"] = count_pattern(lower_text, r"\b(you'll become|imagine yourself|be the (one|person|team) who|your future|you'll be (able|the)|picture yourself|transform (yourself|your)|level up|next.?level you)\b")

    # ─── F. Structure & Timing (16) ───
    result["info_density_shape"] = classify_info_density(text, sents)
    result["breathing_room"] = rate_breathing_room(sents, word_count)
    result["cold_open_words"] = estimate_cold_open_words(text, lower_text, name, words)
    result["callback_count"] = count_pattern(lower_text, r"\b(remember (that|when|what|the)|going back to|as (i|we) (mentioned|said|showed)|earlier (i|we)|this ties back|like (i|we) said|as (i|we) saw)\b")
    result["section_length_cv"] = rate_section_length_variance(text, sents)

    # Promise proof push
    has_promise = 1 if has_pattern(lower_text, r"\b(helps? you|allows? you|enables?|lets? you|makes? it|gives? you|provides?|designed to|built (for|to))\b") else 0
    has_proof = 1 if (result["brand_count"] > 0 or result["success_users"] > 0 or result["has_testimonial"] or result["has_investor_mention"]) else 0
    has_push = 1 if result["closing_has_cta"] else 0
    result["promise_proof_push"] = round(has_promise + has_proof + has_push, 1)

    result["first_feature_position"] = estimate_first_feature_position(text, lower_text)
    result["parenthetical_credibility"] = count_pattern(lower_text, r"\b(by the way|incidentally|oh and|which (happens to|is)|did (i|we) mention|as (a|an) (aside|footnote))\b") + min(2, count_pattern(lower_text, r"\b(\d[\d,]+ (users|customers|companies|downloads))\b"))
    result["section_boundary_markers"] = count_pattern(lower_text, r"\b(number (one|two|three|four|five)|first(ly)?|second(ly)?|third(ly)?|next|finally|last(ly)?|let's move on|moving on|the (second|third|fourth|last) (thing|feature|point))\b")
    result["setup_payoff_distance"] = rate_setup_payoff_distance(text, sents)
    result["multi_persona_address"] = count_pattern(lower_text, r"\b(for (developers|designers|pms|managers|founders|engineers|marketers|teams|creators|analysts|writers|students|freelancers|agencies|startups|enterprises)|whether you're a|if you're (a|an))\b")
    result["voice_consistency"] = rate_voice_consistency(text, sents)
    result["counterfactual_count"] = count_pattern(lower_text, r"\b(what if|without (this|it|us)|imagine not|if you (didn't|don't|couldn't)|wouldn't it be|how would you)\b")
    result["closing_velocity"] = rate_closing_velocity(sents)
    result["open_loop_closing"] = has_pattern(last_portion.lower(), r"\b(just the beginning|much more to come|stay tuned|wait (until|till) you see|this is (only|just) (the start|v1|version one)|more (features|updates) coming|we're just getting started|roadmap)\b")
    result["definitive_closing"] = has_pattern(last_portion.lower(), r"\b(try it (today|now)|get started (today|now)|sign up (today|now)|visit|go to|check (it )?out|download (now|today)|start (now|today|your|building))\b") or has_pattern(last_portion.lower(), r"\.(com|io|ai|co|dev|app)\b")

    return result


# ─────────────────────────────────────────────────────────
# Classification / Rating helper functions
# ─────────────────────────────────────────────────────────

def classify_hook(first_sent, text):
    fs = first_sent.lower()
    if re.search(r"\?", first_sent):
        return "question"
    if re.search(r"^(hi |hey |hello|welcome|good (morning|afternoon|evening)|what's up)", fs):
        return "greeting"
    if re.search(r"(tired|frustrated|broken|hate|pain|problem|struggle|annoying|sick of|fed up|nightmare|mess)", fs):
        return "pain_point"
    if re.search(r"(let me show|here's how|watch|demo|i'll walk|let's (look|see|dive)|i'm going to show|check this out|let me walk)", fs):
        return "demo_instruction"
    if re.search(r"(\d+%|\d+x|\$\d|\d[\d,]*\+? (million|billion|thousand|users|companies|developers|teams|people|downloads))", fs):
        return "stat_number"
    if re.search(r"(the (only|first|best|most)|never before|world's|revolutionary|imagine|what if|picture this|every(one|thing)|no more)", fs):
        return "bold_claim"
    if re.search(r"^(i |i'|my )", fs):
        return "founder_story"
    if re.search(r"^(we |we'|our )", fs):
        if re.search(r"(announc|launch|releas|introduc|present|excited|proud|happy to|glad to|just (launched|released|shipped|built)|today we|are thrilled)", fs):
            return "announcement"
        return "product_statement"
    if re.search(r"(announc|launch|releas|introduc|present|today|new|just (launched|released|shipped))", fs):
        return "announcement"
    # Descriptive: starts with a noun phrase describing the product
    if re.search(r"^[A-Z][a-zA-Z]+ (is|are|was|has|does|can|lets|helps|makes|gives|enables|provides|allows|turns|brings|combines|offers|works|uses|takes|puts|runs|connects|integrates|transforms|converts|generates|creates|supports)", fs):
        return "descriptive"
    # Check for general product statement or description
    if re.search(r"(this is|meet |introducing|say hello|here is|here's )", fs):
        return "product_statement"
    return "descriptive"

def rate_hook_quality(first_sent, text):
    score = 2.5  # baseline slightly above midpoint
    fs = first_sent.lower()
    words = tokenize(first_sent)
    # Specificity boost
    if re.search(r"\d", first_sent):
        score += 0.7
    # Question or bold claim
    if re.search(r"\?", first_sent):
        score += 0.8
    if re.search(r"(imagine|picture|what if)", fs):
        score += 1.0
    # Short and punchy (sweet spot 5-15 words)
    if 5 <= len(words) <= 15:
        score += 0.5
    elif len(words) <= 4:
        score += 0.2
    # Pain point hook
    if re.search(r"(broken|frustrated|tired|hate|problem|nightmare|struggle|pain|mess|chaos|failing|waste|sick of|fed up)", fs):
        score += 1.0
    # Vivid/concrete opener
    if re.search(r"(picture this|every|million|billion|spent \d|lost \d|\$\d|2 a\.?m|midnight|last night|one day|remember)", fs):
        score += 0.8
    # Product name or bold statement
    if re.search(r"(the (only|first|fastest|most)|world'?s|never (before|again)|introducing|meet )", fs):
        score += 0.5
    # Generic/boring opener penalty
    if re.search(r"^(hi |hey |hello|so |um |uh |okay so|alright )", fs):
        score -= 1.0
    # Very short/empty
    if len(words) < 3:
        score -= 0.5
    # This is [product] — generic
    if re.search(r"^this is ", fs):
        score -= 0.3
    return max(1, min(5, round(score)))

def classify_narrative_arc(text, lower_text, word_count):
    if word_count < 20:
        return "too_short"
    # Check first third vs last two thirds
    third = len(text) // 3
    first_third = text[:third].lower()
    rest = text[third:].lower()

    problem_words_front = len(re.findall(r"\b(problem|issue|struggle|pain|broken|frustrat|difficult|challenge|waste|tedious|manual|slow|complex|error|fail)\b", first_third))
    solution_words_front = len(re.findall(r"\b(solution|solve|fix|help|tool|platform|feature|build|create|launch|enables?|allows?)\b", first_third))
    problem_words_back = len(re.findall(r"\b(problem|issue|struggle|pain|broken|frustrat|difficult|challenge|waste|tedious|manual|slow|complex|error|fail)\b", rest))
    solution_words_back = len(re.findall(r"\b(solution|solve|fix|help|tool|platform|feature|build|create|launch|enables?|allows?)\b", rest))

    traction_front = len(re.findall(r"\b(\d[\d,.]* (users|customers|teams|downloads)|revenue|\$\d|funded|raised)\b", first_third))

    if traction_front > 0 and problem_words_front < 2:
        return "traction_first"
    if problem_words_front > solution_words_front and solution_words_back > problem_words_back:
        return "problem_solution"
    if solution_words_front > problem_words_front * 2:
        return "solution_first"
    if problem_words_front + problem_words_back > solution_words_front + solution_words_back:
        return "problem_heavy"
    return "neutral_flat"

def count_topic_transitions(text):
    markers = count_pattern(text, r"\b(but|however|now|so|moving on|next|also|another|in addition|the (second|third|other|next)|speaking of|when it comes to|let's talk about)\b", re.IGNORECASE)
    speaker_changes = count_pattern(text, r">>")
    return min(markers + speaker_changes, 15)

def estimate_problem_solution_pct(text, lower_text):
    total_len = max(len(text), 1)

    # Find problem regions
    problem_chars = 0
    for m in re.finditer(r"(problem|issue|struggle|pain|broken|frustrat|difficult|challenge|waste|tedious|manual|slow|complex|error|fail|nightmare|mess|annoying|tired of|hate|hard to)[^.!?]{0,200}[.!?]", lower_text):
        problem_chars += len(m.group())

    # Find solution regions
    solution_chars = 0
    for m in re.finditer(r"(solution|solve|fix|help|feature|tool|platform|build|create|enables?|allows?|introduces?|designed to|built for|with our|using our|we (built|created|made|developed))[^.!?]{0,200}[.!?]", lower_text):
        solution_chars += len(m.group())

    problem_pct = min(problem_chars / total_len * 100, 80)
    solution_pct = min(solution_chars / total_len * 100, 80)

    # Ensure they don't sum to more than 100
    total = problem_pct + solution_pct
    if total > 100:
        ratio = 100 / total
        problem_pct *= ratio
        solution_pct *= ratio

    return problem_pct, solution_pct

def detect_declining_arc(text, sents):
    if len(sents) < 4:
        return 0
    last_quarter = " ".join(sents[-len(sents)//4:]).lower()
    has_urgency = bool(re.search(r"\b(hurry|act now|don't miss|limited|running out|before it's (too late|gone)|last chance|now or never|time is|deadline)\b", last_quarter))
    return 1 if has_urgency else 0

def classify_metric_placement(text, numbers):
    if not numbers:
        return "none"
    # Find position of first number
    first_num_match = re.search(r'\b\d[\d,.]*\b', text)
    if not first_num_match:
        return "none"
    pos = first_num_match.start() / max(len(text), 1)
    if pos < 0.33:
        return "front"
    elif pos < 0.66:
        return "middle"
    else:
        return "back"

def extract_brands(text):
    """Extract likely brand names (capitalized multi-word or known brands)."""
    known_brands = set()
    brand_patterns = [
        r"\b(Google|Apple|Microsoft|Amazon|Meta|Facebook|Slack|Notion|Figma|GitHub|Vercel|Stripe|Shopify|Salesforce|HubSpot|Zapier|Airtable|Asana|Jira|Trello|Linear|Discord|Twitter|Reddit|YouTube|TikTok|Instagram|LinkedIn|Pinterest|Spotify|Netflix|Uber|Airbnb|Dropbox|Zoom|ChatGPT|OpenAI|Anthropic|Claude|AWS|Azure|GCP|Firebase|Supabase|MongoDB|PostgreSQL|MySQL|Redis|Docker|Kubernetes|Terraform|Datadog|Snowflake|Databricks|Twilio|SendGrid|Mailchimp|Intercom|Zendesk|Confluent|Kafka|Retool|Webflow|WordPress|Squarespace|Canva|Adobe|Photoshop|Illustrator|InDesign|Premiere|Y Combinator|Sequoia|Andreessen|Greylock|Benchmark|Accel|Kleiner|Index Ventures|Lightspeed|Tiger Global|Coinbase|Binance|Plaid|Square|PayPal|Brex|Rippling|Deel|Gusto|Mercury)\b"
    ]
    for pat in brand_patterns:
        for m in re.finditer(pat, text):
            known_brands.add(m.group().lower())
    return known_brands

def count_platform_mentions(lower_text):
    platforms = [
        "slack", "notion", "figma", "github", "vercel", "stripe", "shopify",
        "salesforce", "hubspot", "zapier", "airtable", "asana", "jira", "trello",
        "linear", "discord", "google", "apple", "microsoft", "amazon", "meta",
        "facebook", "twitter", "reddit", "youtube", "tiktok", "instagram",
        "linkedin", "pinterest", "spotify", "netflix", "aws", "azure", "gcp",
        "firebase", "supabase", "mongodb", "postgresql", "mysql", "redis",
        "docker", "kubernetes", "datadog", "snowflake", "twilio", "sendgrid",
        "mailchimp", "intercom", "zendesk", "retool", "webflow", "wordpress",
        "squarespace", "canva", "adobe", "chatgpt", "openai", "anthropic",
        "chrome", "safari", "firefox", "excel", "powerpoint", "outlook",
        "gmail", "dropbox", "zoom", "confluence", "bitbucket", "gitlab",
        "heroku", "netlify", "railway", "render", "fly.io", "planetscale",
        "prisma", "drizzle", "next.js", "nextjs", "react", "vue", "angular",
        "svelte", "tailwind", "bootstrap"
    ]
    count = 0
    for p in platforms:
        if re.search(r"\b" + re.escape(p) + r"\b", lower_text):
            count += 1
    return count

def classify_cta(lower_text, last_portion):
    lp = last_portion.lower()
    combined = lower_text + " " + lp  # weight last portion

    if re.search(r"\b(waitlist|wait list|join the (waitlist|wait list)|sign up for (early access|waitlist))\b", combined):
        return "waitlist"
    if re.search(r"\b(join (us|now|today|our)|join\b)", lp):
        return "join"
    if re.search(r"\b(sign up|signup|register)\b", combined):
        return "sign_up"
    if re.search(r"\b(book (a )?demo|schedule (a )?demo|request (a )?demo)\b", combined):
        return "book_demo"
    if re.search(r"\b(free|for free|at no cost|free (plan|tier|trial|version|forever))\b", combined):
        return "free"
    if re.search(r"\b(try (it|us|now|today|for free))\b", combined):
        return "try"
    if re.search(r"\b(get started|start (now|today|building|using|your))\b", combined):
        return "get_started"
    if re.search(r"\b(beta|early access|alpha)\b", combined):
        return "beta"
    if re.search(r"\b(limited|exclusive|only \d+ spots)\b", combined):
        return "limited"
    if re.search(r"\b(check (it )?out|visit|go to|head over|download|explore)\b", lp):
        return "try"
    return "none"

def classify_cta_position(lower_text):
    cta_pattern = r"\b(try|sign up|get started|join|check out|visit|download|book a demo|start now|start today|head over|go to|subscribe|register|waitlist)\b"
    matches = list(re.finditer(cta_pattern, lower_text))
    if not matches:
        return "none"
    first_pos = matches[0].start() / max(len(lower_text), 1)
    if first_pos < 0.2:
        return "start"
    elif first_pos < 0.7:
        return "middle"
    else:
        return "end"

def detect_inciting_incident(lower_text):
    # Look for specific, concrete moments
    patterns = [
        r"(one day|one night|last (tuesday|monday|week|month|year)|i was sitting|i was in a meeting|i remember when|the moment (i|we)|it all started when|it hit me when|i realized when|that's when|woke up|at \d+ (am|pm|a\.m\.|p\.m\.))",
        r"(my .{0,30} bill was \$|spent \d+ hours|after \d+ failed|when (i|we) (tried|attempted|discovered|noticed|saw|found|hit|ran into))",
        r"(staring at|looking at .{0,30} and (realized|thought|knew))"
    ]
    for p in patterns:
        if re.search(p, lower_text):
            return 1
    return 0

def count_villains(lower_text):
    villains = set()
    villain_patterns = [
        (r"\bspreadsheet", "spreadsheets"),
        (r"\bemail", "email"),
        (r"\bmanual(ly)?", "manual_work"),
        (r"\blegacy", "legacy"),
        (r"\bexcel\b", "excel"),
        (r"\bslack\b", "slack_overload"),
        (r"\bjira\b", "jira"),
        (r"\bcomplex(ity)?", "complexity"),
        (r"\btedious", "tedium"),
        (r"\brepetitive", "repetition"),
        (r"\bbureaucra", "bureaucracy"),
        (r"\bsilo", "silos"),
        (r"\bcontext switch", "context_switching"),
        (r"\bcopy.?past", "copy_paste"),
        (r"\bboilerplate", "boilerplate"),
        (r"\btechnical debt", "tech_debt"),
        (r"\bmeeting", "meetings"),
        (r"\bstatus quo", "status_quo"),
        (r"\binformation overload", "info_overload"),
        (r"\bdata (entry|input)", "data_entry"),
    ]
    for pat, label in villain_patterns:
        if re.search(pat, lower_text):
            villains.add(label)
    return len(villains)

def detect_stakes_escalation(text, sents):
    if len(sents) < 3:
        return 0
    # Check if problem language intensifies
    problem_words = r"\b(problem|issue|struggle|pain|cost|waste|lose|fail|break|error|frustrat|burn|crisis|disaster|catastroph|millions|hours|days)\b"
    first_half = " ".join(sents[:len(sents)//2]).lower()
    second_half = " ".join(sents[len(sents)//2:]).lower()
    early_count = len(re.findall(problem_words, first_half))
    late_count = len(re.findall(problem_words, second_half))
    # Also check for escalating consequences
    has_escalation = bool(re.search(r"\b(worse|even more|not only .{0,30} but also|and (on top|to make|it gets)|costs? (you|your|the)|leading to|which (means|leads|causes|results))\b", second_half))
    return 1 if (late_count > early_count or has_escalation) else 0

def rate_pivot_sharpness(text, lower_text):
    # Look for sharp transitions
    sharp_markers = count_pattern(lower_text, r"\b(so we built|introducing|that's why we (built|created|made)|meet |enter |here's |welcome to|this is where|and that's (exactly )?why)\b")
    medium_markers = count_pattern(lower_text, r"\b(our (solution|answer|tool|platform)|we (decided|thought|realized) (to|we)|the answer is|this is)\b")

    if sharp_markers >= 2:
        return 5
    elif sharp_markers == 1:
        return 4
    elif medium_markers >= 1:
        return 3
    elif count_pattern(lower_text, r"\b(so|and so|which is why)\b") > 0:
        return 2
    return 1

def estimate_journey_vs_destination(lower_text):
    journey_words = count_pattern(lower_text, r"\b(from .{1,30} to|journey|step by step|workflow|process|pipeline|takes you|guides you|walks you through|along the way|path|progression|evolve)\b")
    destination_words = count_pattern(lower_text, r"\b(the (solution|answer|tool|platform) for|all.?in.?one|everything you need|complete|comprehensive|hub|central|single (source|place|platform))\b")
    total = journey_words + destination_words
    if total == 0:
        return 0.5
    return round(journey_words / total, 2)

def detect_bookend_match(text, sents):
    if len(sents) < 4:
        return 0
    first_two = " ".join(sents[:2]).lower()
    last_two = " ".join(sents[-2:]).lower()

    # Check for emotional contrast/mirror
    neg_start = bool(re.search(r"\b(problem|pain|struggle|frustrat|broken|tired|waste|hate|nightmare|mess)\b", first_two))
    pos_end = bool(re.search(r"\b(solution|solv|better|easy|simple|fast|love|enjoy|happy|success|finally|relief)\b", last_two))

    pos_start = bool(re.search(r"\b(great|amazing|love|exciting|powerful|incredible)\b", first_two))
    pos_end_too = bool(re.search(r"\b(great|amazing|love|exciting|powerful|incredible|try|start|join)\b", last_two))

    return 1 if (neg_start and pos_end) or (pos_start and pos_end_too) else 0

def estimate_resolution_completeness(text, lower_text):
    problems = count_pattern(lower_text, r"\b(problem|issue|struggle|pain|challenge|frustrat|waste|tedious|manual|slow|complex|error|difficult|hard to|annoying)\b")
    solutions = count_pattern(lower_text, r"\b(solve|fix|help|solution|feature|enables?|allows?|automate|simplif|streamline|eliminat|reduc)\b")
    if problems == 0:
        return 0.8  # No problems raised = default high
    return round(min(solutions / max(problems, 1), 1.0), 2)

def rate_story_compression(text, sents, word_count):
    temporal_refs = count_pattern(text.lower(), r"\b(\d+ (years?|months?|weeks?|days?|hours?)|last (year|month|quarter)|in \d{4}|ago|back (when|in)|over the (years|months|past))\b")
    if word_count < 50:
        return 1.0
    ratio = temporal_refs / max(len(sents), 1)
    if ratio > 0.3:
        return 5
    elif ratio > 0.2:
        return 4
    elif ratio > 0.1:
        return 3
    elif ratio > 0.05:
        return 2
    return 1

def rate_emotion_specificity(lower_text):
    # Vivid: situated, concrete emotional descriptions
    vivid = count_pattern(lower_text, r"(that (sinking|awful|terrible|amazing|incredible|frustrating|nagging|dreaded) (feeling|moment)|at \d+ (am|pm|a\.m|p\.m)|on a (friday|monday|weekend|sunday|saturday|tuesday)|watching .{1,30} (struggle|fail|break|crash)|the (rush|thrill|relief|dread|panic|joy|excitement|frustration) (when|of)|staring at|pulling (my|your|their) hair|losing sleep|up all night|can't sleep|in the middle of|scrambling|drowning in|buried under|overwhelmed by|juggling|burning (out|the midnight)|spending hours|wasting hours|digging through|scrolling through|copy.?pasting|tab.?switching|context.?switch)")
    # Moderately specific: scenario-based emotional framing
    moderate = count_pattern(lower_text, r"(when you (need|have|want|try|forget|realize|discover|notice|see|get|open|start|finish|run into|face|deal with|encounter|struggle|are stuck|look at)|every time (you|we|i|they)|you know (that|when|how)|the moment (you|when)|imagine (having|being|getting|trying|working|sitting|waking)|picture this|think about|what happens when|you've been|we've all|sound familiar|ring a bell|been there|know the feeling)")
    # Scenario markers: describes specific situations
    scenario = count_pattern(lower_text, r"(your (team|inbox|dashboard|workflow|pipeline|code|data|spreadsheet|project|deadline|client|meeting|report|budget)|monday morning|end of (the day|quarter|sprint|month)|middle of (a|the)|during (a |the )|after (hours|work|a long|spending)|before (you|the|a)|instead of|rather than|while (you|your|they|we))")
    # Generic emotions
    generic = count_pattern(lower_text, r"\b(frustrated|happy|sad|angry|excited|worried|stressed|anxious|tired|annoyed|confused|overwhelmed|delighted|thrilled|disappointed|relieved|painful|tedious|boring|annoying|love|hate|enjoy)\b")

    total = vivid * 3 + moderate * 2 + scenario + generic * 0.5
    if total >= 12:
        return 5
    elif total >= 8:
        return 4
    elif total >= 5:
        return 3
    elif total >= 2:
        return 2
    return 1

def estimate_relief_distance(text, sents):
    # Find first problem mention, then first solution mention after it
    problem_idx = -1
    solution_idx = -1
    for i, s in enumerate(sents):
        sl = s.lower()
        if problem_idx == -1 and re.search(r"\b(problem|issue|struggle|pain|frustrat|broken|waste|tedious|manual|difficult|challenge)\b", sl):
            problem_idx = i
        if problem_idx >= 0 and solution_idx == -1 and re.search(r"\b(so we|introducing|solution|our (tool|platform|product)|we (built|created|made)|that's why|with .{1,30} you can|now you can)\b", sl):
            solution_idx = i

    if problem_idx == -1 or solution_idx == -1:
        return 0
    return min(solution_idx - problem_idx, 10)

def count_frustration_facets(lower_text):
    facets = set()
    facet_map = {
        "time_waste": r"\b(waste time|time.?consuming|hours spent|takes forever|slow)\b",
        "money_waste": r"\b(expensive|costly|waste money|overpriced|costs? too much|budget)\b",
        "complexity": r"\b(complex|complicated|confusing|overwhelming|hard to (understand|use|learn))\b",
        "manual_effort": r"\b(manual|tedious|repetitive|boring|mundane|busywork)\b",
        "errors": r"\b(error|bug|mistake|inaccurate|unreliable|breaks?|crash|fail)\b",
        "scale": r"\b(doesn't scale|can't (handle|keep up)|bottleneck|capacity)\b",
        "fragmentation": r"\b(scattered|silo|fragment|disconnect|multiple tools|tab|switch between)\b",
        "lack_visibility": r"\b(blind spot|no visibility|can't see|don't know|no insight|black box)\b",
        "collaboration": r"\b(collaborate|team|coordination|alignment|communication|sync)\b",
        "security": r"\b(security|privacy|vulnerable|breach|risk|compliance)\b",
    }
    for label, pat in facet_map.items():
        if re.search(pat, lower_text):
            facets.add(label)
    return len(facets)

def rate_joy_velocity(text, lower_text):
    # How quickly does tone shift from negative to positive?
    neg_end = -1
    pos_start = -1
    for m in re.finditer(r"\b(problem|issue|struggle|pain|frustrat|broken|waste|tedious|manual|difficult|hard|mess|chaos|nightmare)\b", lower_text):
        neg_end = m.end()
    for m in re.finditer(r"\b(solution|solv|now (you can|with)|introducing|built|easy|simple|fast|instant|automat|one click|magic)\b", lower_text):
        if pos_start == -1 or m.start() < pos_start:
            if neg_end > -1 and m.start() > neg_end - 200:
                pos_start = m.start()
                break

    if neg_end == -1 or pos_start == -1:
        return 2
    distance = pos_start - neg_end
    if distance < 50:
        return 5
    elif distance < 150:
        return 4
    elif distance < 300:
        return 3
    elif distance < 500:
        return 2
    return 1

def estimate_loss_aversion(lower_text):
    gain = count_pattern(lower_text, r"\b(save|gain|earn|get|win|grow|increase|boost|improve|achieve|unlock)\b")
    loss = count_pattern(lower_text, r"\b(lose|losing|waste|wasting|miss(ing)?|cost(ing)?|spend(ing)?|drain|bleed|hemorrhage|leak|sacrifice)\b")
    total = gain + loss
    if total == 0:
        return 0.5
    return round(loss / total, 2)

def rate_confidence_gradient(text, sents):
    if len(sents) < 4:
        return 3  # Default middle for short texts
    first_half = " ".join(sents[:len(sents)//2]).lower()
    second_half = " ".join(sents[len(sents)//2:]).lower()

    confidence_words = r"\b(will|always|definitely|guaranteed|proven|certainly|absolutely|every time|best|most powerful|ensure|promise|never fails|100%|hands down|no doubt|without (question|fail)|undoubtedly|clearly)\b"
    # Also count assertive phrasing
    assertive = r"\b(is the|are the|does|makes|ensures|delivers|transforms|powers|drives|enables|solves|eliminates)\b"

    early_conf = len(re.findall(confidence_words, first_half)) + len(re.findall(assertive, first_half)) * 0.5
    late_conf = len(re.findall(confidence_words, second_half)) + len(re.findall(assertive, second_half)) * 0.5

    tentative_words = r"\b(maybe|perhaps|might|could|we think|we hope|we believe|trying to|working on|exploring|not sure|we're still|kind of|sort of)\b"
    early_tent = len(re.findall(tentative_words, first_half))
    late_tent = len(re.findall(tentative_words, second_half))

    # CTA at end = confidence climax
    has_cta_end = bool(re.search(r"\b(try|sign up|get started|join|start|visit|go to|check out)\b", second_half[-200:] if len(second_half) > 200 else second_half))

    if early_tent > early_conf and late_conf > late_tent:
        return 5
    elif late_conf > early_conf * 1.5 or (late_conf > early_conf and has_cta_end):
        return 4
    elif early_conf > 0 and late_conf > 0:
        return 3  # Consistently confident
    elif early_conf > late_conf * 1.5:
        return 2  # Starts confident, fizzles
    return 2

def rate_emotional_contrast(text, sents):
    if len(sents) < 3:
        return 1
    lower = text.lower()
    # Negative emotional language (broader)
    neg_count = count_pattern(lower, r"\b(problem|pain|struggle|frustrat|broken|terrible|nightmare|waste|disaster|horrible|worst|tedious|hate|ugh|mess|chaos|annoying|boring|slow|complex|confusing|overwhelming|expensive|costly|manual|repetitive|error|bug|fail|hard|difficult|impossible|stuck|drowning|buried|lost|wrong|bad|ugly|clunky|outdated|legacy)\b")
    # Positive emotional language (broader)
    pos_count = count_pattern(lower, r"\b(amazing|incredible|love|beautiful|brilliant|perfect|wonderful|outstanding|fantastic|best|revolutionary|transform|magic|delight|joy|powerful|elegant|fast|instant|easy|simple|clean|sleek|smooth|intuitive|effortless|beautiful|gorgeous|stunning|great|awesome|cool|sweet|nice|neat|exciting|impressive|remarkable)\b")

    if neg_count >= 5 and pos_count >= 5:
        return 5
    elif neg_count >= 3 and pos_count >= 3:
        return 4
    elif neg_count >= 2 and pos_count >= 2:
        return 3
    elif (neg_count >= 1 and pos_count >= 1):
        return 2
    return 1

def rate_empathy_depth(result):
    score = 1
    if result.get("empathy_firsthand"):
        score += 1.5
    if result.get("empathy_observed"):
        score += 1
    if result.get("emotion_specificity", 1) >= 3:
        score += 0.5
    if result.get("frustration_vocabulary_breadth", 0) >= 3:
        score += 1
    return max(1, min(5, round(score)))

def rate_feature_intro_velocity(text, lower_text, word_count):
    features = count_pattern(lower_text, r"\b(feature|function|capability|tool|mode|integration|module|you can|it (can|lets|allows|enables|helps)|with our)\b")
    if features == 0:
        return 3
    density = features / max(word_count, 1) * 100
    if density > 5:
        return 1  # Crammed
    elif density > 3:
        return 2
    elif density > 2:
        return 3
    elif density > 1:
        return 4
    return 5

def estimate_orphaned_features(text, lower_text):
    features = re.findall(r"\b(feature|function|capability|tool|mode|integration|module|api|sdk|plugin|extension)\b", lower_text)
    benefits = re.findall(r"\b(so (that|you)|which (means|allows|enables|helps|lets|gives)|saving|making it|this (means|helps|allows|ensures)|benefit|advantage|result)\b", lower_text)

    feat_count = len(features)
    benefit_count = len(benefits)

    if feat_count == 0:
        return 0.3
    return round(1 - min(benefit_count / max(feat_count, 1), 1.0), 2)

def rate_concrete_vs_abstract(lower_text):
    # Concrete markers: numbers, specific examples, named things
    concrete = count_pattern(lower_text, r"(\d+%|\$\d|\d+ (seconds|minutes|hours|users|customers|lines|clicks|steps|pages|files|rows|columns|projects|tasks|integrations)|specific|example|for instance|such as|like when|here's (how|an example|a)|for example|in this case|let's say|e\.g\.)")
    # Named tools/services count as concrete
    concrete += count_pattern(lower_text, r"\b(slack|notion|figma|github|google|excel|jira|stripe|shopify|salesforce|hubspot|zapier|aws|discord|linear|vercel)\b")
    # Abstract: vague qualitative language
    abstract = count_pattern(lower_text, r"\b(powerful|robust|scalable|flexible|comprehensive|innovative|advanced|intelligent|smart|state.?of.?the.?art|next.?gen|world.?class|enterprise.?grade|best.?in.?class|seamless|frictionless|efficient|effective|optimal|dynamic|holistic|sophisticated|cutting.?edge|beautiful|elegant)\b")

    total = concrete + abstract
    if total == 0:
        return 3

    # Weighted ratio: each concrete marker worth more when there are many
    ratio = concrete / (concrete + abstract * 1.5)  # Weight abstract slightly more since it's easier to detect
    if ratio > 0.75:
        return 5
    elif ratio > 0.55:
        return 4
    elif ratio > 0.35:
        return 3
    elif ratio > 0.15:
        return 2
    return 1

def estimate_magic_moment_position(text, lower_text):
    # Look for "wow" moments
    wow_patterns = [
        r"\b(watch (this|what happens)|check this out|here's (the|where) (magic|the magic happens)|the (best|cool|incredible|amazing) (part|thing)|and boom|voila|ta.?da|just like that|automatically|in (just )?(seconds|one click|real.?time))\b"
    ]
    last_pos = -1
    for pat in wow_patterns:
        for m in re.finditer(pat, lower_text):
            pos = m.start() / max(len(lower_text), 1)
            if last_pos == -1 or pos > last_pos:
                last_pos = pos

    # If no explicit wow marker, estimate based on most feature-dense region
    if last_pos == -1:
        return 0.5  # Default middle
    return round(last_pos, 2)

def count_integrations(lower_text):
    integrations = [
        "slack", "notion", "figma", "github", "vercel", "stripe", "shopify",
        "salesforce", "hubspot", "zapier", "airtable", "asana", "jira", "trello",
        "linear", "discord", "google (sheets|docs|drive|workspace|calendar|analytics)",
        "aws", "azure", "gcp", "firebase", "supabase", "mongodb", "postgresql",
        "mysql", "redis", "docker", "kubernetes", "datadog", "snowflake",
        "twilio", "sendgrid", "mailchimp", "intercom", "zendesk", "confluence",
        "bitbucket", "gitlab", "heroku", "netlify", "webflow", "wordpress",
        "dropbox", "zoom", "teams", "outlook", "gmail", "chrome", "vscode",
        "excel", "powerpoint", "tableau", "mixpanel", "segment", "amplitude",
        "pagerduty", "opsgenie", "grafana", "prometheus", "elasticsearch",
        "jenkins", "circleci", "github actions", "terraform", "ansible",
        "sentry", "new relic", "splunk", "okta", "auth0"
    ]
    count = 0
    for i in integrations:
        if re.search(r"\b" + i + r"\b", lower_text):
            count += 1
    return count

def detect_progressive_disclosure(text, lower_text):
    # Check for simple→intermediate→advanced pattern
    simple = bool(re.search(r"\b(simple|basic|easy|start with|first|getting started|beginner)\b", lower_text[:len(lower_text)//2]))
    advanced = bool(re.search(r"\b(advanced|power user|pro|expert|customize|extend|api|sdk|complex|sophisticated)\b", lower_text[len(lower_text)//2:]))
    return 1 if (simple and advanced) else 0

def detect_one_more_thing(text, lower_text, sents):
    if len(sents) < 3:
        return 0
    last_few = " ".join(sents[-3:]).lower()
    return 1 if re.search(r"\b(one more thing|oh and|bonus|cherry on top|but that's not all|and (if that wasn't enough|one more|the cherry)|last but not least|did (i|we) mention)\b", last_few) else 0

def count_use_cases(lower_text):
    personas = set()
    persona_patterns = [
        (r"\b(developer|engineer|coder|programmer)s?\b", "developer"),
        (r"\b(designer|ux|ui)s?\b", "designer"),
        (r"\b(product manager|pm|product owner)s?\b", "pm"),
        (r"\b(marketer|marketing team)s?\b", "marketer"),
        (r"\b(founder|ceo|entrepreneur|startup)s?\b", "founder"),
        (r"\b(data (scientist|analyst|engineer))s?\b", "data"),
        (r"\b(sales|account executive|sdr)s?\b", "sales"),
        (r"\b(writer|content creator|copywriter)s?\b", "writer"),
        (r"\b(teacher|educator|student|learner)s?\b", "education"),
        (r"\b(freelancer|agency|consultant)s?\b", "freelancer"),
        (r"\b(team lead|manager|executive|director)s?\b", "manager"),
        (r"\b(customer support|support team|help desk)s?\b", "support"),
        (r"\b(devops|sre|infra|ops)s?\b", "devops"),
        (r"\b(researcher|scientist|academic)s?\b", "researcher"),
    ]
    for pat, label in persona_patterns:
        if re.search(pat, lower_text):
            personas.add(label)
    return max(len(personas), 1)  # At least 1 implicit use case

def rate_liveness(text, lower_text):
    live_markers = count_pattern(lower_text, r"\b(let me (show|click|open|type|drag|navigate)|here (i|we) (go|are)|watch (as|me)|i'm (going to|clicking|typing|opening)|oops|oh wait|let's (see|try|go)|here we go|okay so|right here|bear with me)\b")
    production_markers = count_pattern(text, r"\[(Music|Applause|MUSIC)\]|♪")

    if live_markers >= 5:
        return 5
    elif live_markers >= 3:
        return 4
    elif live_markers >= 1:
        return 3
    elif production_markers >= 1:
        return 1
    return 2

def rate_verb_energy(lower_text):
    # High-energy verbs
    high_energy = count_pattern(lower_text, r"\b(ship|crush|build|launch|deploy|smash|nail|kill|ace|blast|rocket|supercharge|turbocharge|fire|ignite|unleash|dominate|conquer|demolish|destroy|skip|ditch|drop|grab|spin up|whip|hack|crank|slam|rip|tear|zap|nuke|annihilate)\b")
    # Medium-energy verbs (still active and clear)
    medium_energy = count_pattern(lower_text, r"\b(create|generate|automate|transform|convert|analyze|monitor|track|connect|sync|integrate|streamline|accelerate|boost|scale|cut|reduce|eliminate|simplify|manage|detect|scan|extract|capture|pull|push|drag|click|type|plug|wire|power|drive|handle|process|deliver|serve|support)\b")
    # Corporate/passive verbs
    passive = count_pattern(lower_text, r"\b(utilize|facilitate|leverage|synergize|operationalize|empower|optimize|maximize|actualize|endeavor|implement|establish|maintain|provide|offer|ensure|enable)\b")

    total_active = high_energy * 2 + medium_energy
    if total_active >= 15:
        return 5
    elif total_active >= 10:
        return 4
    elif total_active >= 5:
        return 3
    elif passive >= 3 and total_active < 3:
        return 1
    return 2

def rate_sentence_rhythm(sents):
    if len(sents) < 3:
        return 1
    lengths = [len(tokenize(s)) for s in sents]
    if len(lengths) < 2:
        return 1
    mean_len = sum(lengths) / len(lengths)
    variance = sum((l - mean_len) ** 2 for l in lengths) / len(lengths)
    std = math.sqrt(variance)
    cv = std / max(mean_len, 1)

    # Also check for short/long alternation pattern
    alternations = 0
    for i in range(1, len(lengths)):
        if (lengths[i] > mean_len and lengths[i-1] < mean_len) or \
           (lengths[i] < mean_len and lengths[i-1] > mean_len):
            alternations += 1
    alt_ratio = alternations / max(len(lengths) - 1, 1)

    # Has very short sentences (punchy)?
    has_punchy = sum(1 for l in lengths if l <= 5) >= 2
    has_long = sum(1 for l in lengths if l >= 20) >= 1

    combined = cv + (alt_ratio * 0.3) + (0.2 if has_punchy and has_long else 0)

    if combined > 0.7:
        return 5
    elif combined > 0.5:
        return 4
    elif combined > 0.35:
        return 3
    elif combined > 0.2:
        return 2
    return 1

def rate_power_word_clusters(text, sents):
    power_words = r"\b(amazing|incredible|powerful|revolutionary|transform|game.?chang|breakthrough|ultimate|massive|huge|critical|essential|dramatic|explosive|stunning|extraordinary|remarkable|phenomenal|unbelievable|insane|crazy|mind.?blow)\b"
    max_cluster = 0
    for s in sents:
        count = len(re.findall(power_words, s, re.IGNORECASE))
        max_cluster = max(max_cluster, count)

    if max_cluster >= 4:
        return 5
    elif max_cluster >= 3:
        return 4
    elif max_cluster >= 2:
        return 3
    elif max_cluster >= 1:
        return 2
    return 1

def classify_jargon_distribution(text, lower_text):
    jargon = r"\b(api|sdk|cli|oauth|webhook|endpoint|microservice|kubernetes|docker|ci/?cd|devops|sre|latency|throughput|scalab|infrastructure|deployment|containeriz|orchestrat|middleware|backend|frontend|fullstack|serverless|lambda|cdn|dns|ssl|tls|tcp|http|rest|graphql|grpc|websocket|oauth|jwt|saml|ldap|rbac|sso|mfa|crud|orm|sql|nosql|etl|elt|dag|mlops|aiops|devsecops|vector|embedding|token|prompt|rag|fine.?tun|inference|neural|gradient|transformer|llm|gpt|bert|diffusion)\b"

    text_len = max(len(lower_text), 1)
    third = text_len // 3

    front = len(re.findall(jargon, lower_text[:third]))
    middle = len(re.findall(jargon, lower_text[third:2*third]))
    back = len(re.findall(jargon, lower_text[2*third:]))

    total = front + middle + back
    if total < 2:
        return "minimal"

    if front >= middle and front >= back and front > total * 0.45:
        return "front_heavy"
    elif back >= middle and back >= front and back > total * 0.45:
        return "back_heavy"
    elif middle >= front and middle >= back and middle > total * 0.45:
        return "middle_heavy"
    return "even"

def count_anaphora(text, sents):
    count = 0
    if len(sents) < 2:
        return 0

    # Check for repeated sentence starters
    starters = []
    for s in sents:
        words = tokenize(s)
        if len(words) >= 2:
            starters.append(words[0].lower() + " " + words[1].lower())
        elif len(words) == 1:
            starters.append(words[0].lower())

    # Count consecutive matching starters
    for i in range(1, len(starters)):
        if starters[i] == starters[i-1]:
            count += 1

    # Also check for "No more X. No more Y." pattern etc.
    anaphora_patterns = [
        r"(No more [^.!?]+[.!?]\s*No more)",
        r"(You can [^.!?]+[.!?]\s*You can)",
        r"(Whether you [^.!?]+[.!?]\s*Whether you)",
        r"(From [^.!?]+[.!?]\s*From)",
        r"(It's [^.!?]+[.!?]\s*It's)",
        r"(Stop [^.!?]+[.!?]\s*Stop)",
    ]
    for pat in anaphora_patterns:
        count += len(re.findall(pat, text, re.IGNORECASE))

    return count

def count_qa_pairs(text, sents):
    count = 0
    for i in range(len(sents) - 1):
        if "?" in sents[i] and len(tokenize(sents[i+1])) < 15:
            count += 1
    return count

def rate_transition_sophistication(lower_text):
    # High sophistication transitions
    high = count_pattern(lower_text, r"\b(here's where it gets (interesting|exciting|good|better|real)|but the (real )?magic is|and here's the (thing|kicker|best part|catch)|what makes (this|us) (different|special|unique)|let's talk about|the beauty of|the key (insight|difference|takeaway) is|that's (why|where|when|how)|this is where|the (best|cool|interesting) part|here's (what|why|how)|but it gets (better|worse|more))\b")
    # Medium sophistication
    medium = count_pattern(lower_text, r"\b(speaking of|when it comes to|the (thing|part|reason) (is|about)|not only .{1,30} but|what's more|on top of that|beyond (that|this)|the (real|other|bigger) (question|issue|challenge|benefit) is|let me (show|explain|walk)|now (here's|imagine|let's|picture|think about))\b")
    # Basic transitions
    basic = count_pattern(lower_text, r"\b(and then|also|so|but|then|next|plus|moreover|furthermore|additionally|in addition|another thing)\b")

    score = high * 3 + medium * 2 + basic * 0.3
    if score >= 8:
        return 5
    elif score >= 5:
        return 4
    elif score >= 3:
        return 3
    elif score >= 1:
        return 2
    return 1

def rate_specificity(lower_text, number_count, word_count):
    specific = number_count + count_pattern(lower_text, r"\b(for (example|instance)|such as|like|specifically|exactly|precisely|\d+%|\$\d)\b")
    vague = count_pattern(lower_text, r"\b(many|some|several|various|significant|great|good|nice|a lot|lots of|plenty|numerous|substantial|considerable)\b")

    density = specific / max(word_count, 1) * 100
    if density > 5 and specific > vague * 2:
        return 5
    elif density > 3:
        return 4
    elif density > 2:
        return 3
    elif density > 1:
        return 2
    return 1

def count_parallel_structures(text, sents):
    count = 0
    # Look for "X. Y. Z." patterns with similar structure
    patterns = [
        r"(\w+ \w+er\. \w+ \w+er\.)",  # "Build faster. Ship smarter."
        r"(More \w+\. More \w+\.)",
        r"(Less \w+\. Less \w+\.)",
        r"(Better \w+\. Better \w+\.)",
        r"(\w+ it\. \w+ it\.)",
    ]
    for pat in patterns:
        count += len(re.findall(pat, text, re.IGNORECASE))

    # Also count enumerated parallel items (comma-separated with similar structure)
    count += count_pattern(text, r"(\w+ \w+, \w+ \w+, and \w+ \w+)")

    return count

def rate_word_rarity(words):
    common_words = set("the a an is are was were be been being have has had do does did will would shall should can could may might must need ought dare to of in for on with at by from up about into through during before after above below between out off over under again further then once here there when where why how all each every both few more most other some such no not only own same so than too very just because but and or if while although though".split())

    total = len(words)
    if total == 0:
        return 1

    uncommon = 0
    for w in words:
        wl = w.lower()
        if wl not in common_words and len(wl) > 6:
            uncommon += 1

    ratio = uncommon / total
    if ratio > 0.15:
        return 5
    elif ratio > 0.10:
        return 4
    elif ratio > 0.07:
        return 3
    elif ratio > 0.04:
        return 2
    return 1

def rate_conclusive_finality(last_portion, sents):
    lp = last_portion.lower()

    # Strong endings
    if re.search(r"\b(try it (today|now)|get started|sign up|visit|the future|welcome to|this is (just the beginning|our|the))\b", lp):
        if re.search(r"\b(so yeah|that's (it|about it)|um|anyway|i guess|thanks (for|bye))\b", lp):
            return 2
        return 4

    # Decisive closing
    if re.search(r"\b(start|join|build|ship|launch|create|transform|change) (now|today|your)\b", lp):
        return 5

    # Trailing off
    if re.search(r"\b(so yeah|that's (it|about it|all)|um|anyway|i guess|i think that's|so that's)\b", lp):
        return 1

    # Thanks + CTA
    if re.search(r"\b(thank|thanks|cheers)\b", lp) and re.search(r"\b(check|try|visit|sign|start)\b", lp):
        return 3

    # Just thanks
    if re.search(r"\b(thank|thanks|bye|cheers)\b", lp):
        return 2

    return 3

def classify_social_proof_order(text, lower_text):
    # Find positions of different proof types
    numbers_pos = -1
    brands_pos = -1
    quotes_pos = -1

    m = re.search(r"\b\d[\d,.]* (users|customers|teams|companies|downloads)\b", lower_text)
    if m:
        numbers_pos = m.start()

    brand_pat = r"\b(Google|Apple|Microsoft|Amazon|Meta|Slack|Notion|Stripe|Shopify|Y Combinator)\b"
    m = re.search(brand_pat, text)
    if m:
        brands_pos = m.start()

    m = re.search(r'"[^"]{10,}"', text)
    if m:
        quotes_pos = m.start()

    positions = {}
    if numbers_pos >= 0:
        positions["numbers_first"] = numbers_pos
    if brands_pos >= 0:
        positions["brands_first"] = brands_pos
    if quotes_pos >= 0:
        positions["quotes_first"] = quotes_pos

    if not positions:
        return "none"

    return min(positions, key=positions.get)

def classify_authority_type(lower_text):
    technical = bool(re.search(r"\b(ex-?(google|meta|facebook|amazon|apple|microsoft|stripe)|phd|doctor|professor|stanford|mit|harvard|berkeley|cmu|engineer(ed|ing)? at|built at|worked at)\b", lower_text))
    market = bool(re.search(r"\b(\d[\d,.]* (users|customers|teams|companies|downloads)|revenue|\$\d+[mk]|arr|mrr)\b", lower_text))
    domain = bool(re.search(r"\b(\d+ years? (of|in|experience)|decade|veteran|expert|specialist|senior|seasoned|industry|background in)\b", lower_text))

    types = []
    if technical:
        types.append("technical")
    if market:
        types.append("market")
    if domain:
        types.append("domain")

    if len(types) >= 2:
        return "mixed"
    elif len(types) == 1:
        return types[0]
    return "none"

def classify_scarcity_type(lower_text):
    if re.search(r"\b(today only|limited time|this week|ends? (soon|today|tomorrow)|for a limited time|act (fast|now)|expires?|deadline)\b", lower_text):
        return "time"
    if re.search(r"\b(limited (spots|seats|capacity|availability)|only \d+ (spots|seats|left)|sold out|almost (full|gone)|running out)\b", lower_text):
        return "quantity"
    if re.search(r"\b(invite only|invitation|exclusive access|private beta|closed beta|whitelist|allowlist|waitlist)\b", lower_text):
        return "access"
    if re.search(r"\b(the only (tool|platform|solution)|only (one|tool|platform) that|nobody else|unique|first to|the first)\b", lower_text):
        return "capability"
    return "none"

def detect_bandwagon_gradient(text, lower_text):
    # Check if social proof numbers increase through the text
    numbers_with_pos = []
    for m in re.finditer(r"(\d[\d,]*)\s*(users?|customers?|teams?|companies?|people|downloads?|businesses?)", lower_text):
        try:
            num = int(m.group(1).replace(",", ""))
            pos = m.start() / max(len(lower_text), 1)
            numbers_with_pos.append((pos, num))
        except:
            pass

    if len(numbers_with_pos) < 2:
        return 0

    # Check if numbers generally increase
    for i in range(1, len(numbers_with_pos)):
        if numbers_with_pos[i][1] > numbers_with_pos[i-1][1]:
            return 1
    return 0

def count_choice_tiers(lower_text):
    # Pricing tiers
    tier_patterns = [
        r"\b(free|basic|starter|hobby|personal)\b.*\b(pro|professional|business|team|growth)\b",
        r"\b(pro|professional|business|team|growth)\b.*\b(enterprise|unlimited|custom)\b",
        r"\b(free plan|basic plan|starter plan|pro plan|enterprise plan|premium plan)\b",
        r"\b(\$\d[\d,.]*\/?mo|\$\d[\d,.]*\/?yr|\$\d[\d,.]*\/month)\b",
    ]

    tiers = set()
    for m in re.finditer(r"\b(free|basic|starter|hobby|personal|pro|professional|business|team|growth|enterprise|unlimited|custom|premium)\b\s*(plan|tier|pricing)?", lower_text):
        tiers.add(m.group(1))

    if len(tiers) >= 3:
        return 3
    elif len(tiers) >= 2:
        return 2
    elif len(tiers) >= 1:
        return 1
    return 0

def classify_info_density(text, sents):
    if len(sents) < 4:
        return "even"

    third = len(sents) // 3
    front = sents[:third]
    middle = sents[third:2*third]
    back = sents[2*third:]

    info_pattern = r"\b(feature|function|capability|integration|api|tool|built|designed|enables?|allows?|supports?|includes?|provides?|offers?|you can)\b"

    front_density = sum(len(re.findall(info_pattern, s, re.IGNORECASE)) for s in front) / max(len(front), 1)
    middle_density = sum(len(re.findall(info_pattern, s, re.IGNORECASE)) for s in middle) / max(len(middle), 1)
    back_density = sum(len(re.findall(info_pattern, s, re.IGNORECASE)) for s in back) / max(len(back), 1)

    densities = {"front_loaded": front_density, "middle_peak": middle_density, "back_loaded": back_density}
    max_section = max(densities, key=densities.get)

    # Check if relatively even
    all_d = [front_density, middle_density, back_density]
    if max(all_d) < min(all_d) * 1.5 + 0.5:
        return "even"

    return max_section

def rate_breathing_room(sents, word_count):
    if len(sents) == 0:
        return 3
    avg_len = word_count / len(sents)

    # Short transcripts inherently have more breathing room
    if word_count < 80:
        return 5
    elif word_count < 150:
        return 4

    # For longer transcripts, use avg sentence length as proxy
    # Also factor in feature density — more features = less breathing room
    if avg_len > 25:
        return 1
    elif avg_len > 20:
        return 2
    elif avg_len > 15:
        return 3
    elif avg_len > 10:
        return 4
    return 5

def estimate_cold_open_words(text, lower_text, name, words):
    # Find first product mention or feature description
    product_lower = name.lower() if name else ""

    # Look for product name
    if product_lower and len(product_lower) > 2:
        m = re.search(re.escape(product_lower), lower_text)
        if m:
            before = lower_text[:m.start()]
            return len(tokenize(before))

    # Look for first feature/product mention
    m = re.search(r"\b(feature|tool|platform|product|app|software|solution|service|built|designed|introduces?|our|we (built|created|made))\b", lower_text)
    if m:
        before = lower_text[:m.start()]
        return len(tokenize(before))

    return min(len(words), 50)

def rate_section_length_variance(text, sents):
    if len(sents) < 6:
        return 2

    # Split into rough sections by transition markers
    section_sizes = []
    current = 0
    for s in sents:
        current += 1
        if re.search(r"\b(but|however|now|so|next|also|another thing|moving on|the (second|next|other)|finally|last)\b", s, re.IGNORECASE):
            section_sizes.append(current)
            current = 0
    if current > 0:
        section_sizes.append(current)

    if len(section_sizes) < 2:
        return 2

    mean_size = sum(section_sizes) / len(section_sizes)
    variance = sum((s - mean_size) ** 2 for s in section_sizes) / len(section_sizes)
    cv = math.sqrt(variance) / max(mean_size, 1)

    if cv > 1.0:
        return 5
    elif cv > 0.7:
        return 4
    elif cv > 0.4:
        return 3
    elif cv > 0.2:
        return 2
    return 1

def estimate_first_feature_position(text, lower_text):
    m = re.search(r"\b(feature|you can|it (can|lets|allows|enables|helps|makes)|with (our|this)|built.?in|supports?|includes?|comes with|provides?|offers?)\b", lower_text)
    if m:
        return round(m.start() / max(len(lower_text), 1), 2)
    return 0.3

def rate_setup_payoff_distance(text, sents):
    # Look for questions and their answers
    question_indices = [i for i, s in enumerate(sents) if "?" in s]
    if not question_indices:
        return 2

    distances = []
    for qi in question_indices:
        # Find next declarative/answer sentence
        for j in range(qi + 1, min(qi + 6, len(sents))):
            if "?" not in sents[j]:
                distances.append(j - qi)
                break

    if not distances:
        return 2

    avg_dist = sum(distances) / len(distances)
    if avg_dist >= 4:
        return 5
    elif avg_dist >= 3:
        return 4
    elif avg_dist >= 2:
        return 3
    elif avg_dist >= 1:
        return 2
    return 1

def rate_voice_consistency(text, sents):
    if len(sents) < 3:
        return 3

    i_we_sents = 0
    you_sents = 0
    neutral_sents = 0

    for s in sents:
        sl = s.lower()
        has_iwe = bool(re.search(r"\b(i|we|our|us|my)\b", sl))
        has_you = bool(re.search(r"\b(you|your|you're)\b", sl))

        if has_iwe and not has_you:
            i_we_sents += 1
        elif has_you and not has_iwe:
            you_sents += 1
        else:
            neutral_sents += 1

    total = len(sents)
    dominant = max(i_we_sents, you_sents, neutral_sents)
    ratio = dominant / total

    if ratio > 0.8:
        return 5
    elif ratio > 0.6:
        return 4
    elif ratio > 0.4:
        return 3
    elif ratio > 0.25:
        return 2
    return 1

def rate_closing_velocity(sents):
    if len(sents) < 3:
        return 3

    last_n = min(5, len(sents))
    last_sents = sents[-last_n:]
    lengths = [len(tokenize(s)) for s in last_sents]

    if len(lengths) < 2:
        return 3

    # Check if sentence lengths decrease (getting punchier)
    decreasing = sum(1 for i in range(1, len(lengths)) if lengths[i] < lengths[i-1])
    avg_last = sum(lengths) / len(lengths)

    # Check for imperative/CTA density at end
    last_text = " ".join(last_sents).lower()
    has_rapid_cta = bool(re.search(r"\b(try|sign up|get started|join|start|visit|go to|check|download|subscribe|head over)\b", last_text))
    has_exclamation = "!" in " ".join(last_sents)

    score = 3  # baseline
    if avg_last < 8:
        score += 1
    elif avg_last > 20:
        score -= 1
    if decreasing >= len(lengths) * 0.6:
        score += 1
    elif decreasing <= 1:
        score -= 0.5
    if has_rapid_cta:
        score += 0.5
    if has_exclamation:
        score += 0.3
    # Trailing off penalty
    if re.search(r"\b(so yeah|that's it|that's about it|anyway|i guess|um)\b", last_text):
        score -= 1

    return max(1, min(5, round(score)))


def make_default(tid, text, name):
    """Return default values for empty/very short transcripts."""
    d = {"id": str(tid)}

    # V1 defaults
    d["hook_type"] = "too_short" if len(text or "") < 30 else "product_statement"
    d["first_person_opener"] = 0
    d["has_negative_opener"] = 0
    d["first_sentence_words"] = len(tokenize(text or ""))
    d["hook_quality"] = 1
    d["word_count"] = len(tokenize(text or ""))
    d["sentence_count"] = max(1, len(sentences(text or "")))
    d["avg_sentence_length"] = round(d["word_count"] / d["sentence_count"], 1)
    d["flesch_kincaid_grade"] = 0.0
    d["word_diversity"] = 0.0
    d["syllable_density"] = 0.0
    d["pronoun_strategy"] = "neutral"
    d["we_count"] = 0
    d["you_count"] = 0
    d["hedge_count"] = 0
    d["filler_count"] = 0
    d["narrative_arc"] = "too_short"
    d["topic_transitions"] = 0
    d["problem_pct"] = 0.0
    d["solution_pct"] = 0.0
    d["declining_arc"] = 0
    d["number_count"] = 0
    d["number_density"] = 0.0
    d["metric_placement"] = "none"
    d["before_after_total"] = 0
    d["success_users"] = 0
    d["success_revenue"] = 0
    d["success_cost_savings"] = 0
    d["success_growth"] = 0
    d["brand_count"] = 0
    d["has_investor_mention"] = 0
    d["has_testimonial"] = 0
    d["trusted_by"] = 0
    d["has_partnership"] = 0
    d["has_credential"] = 0
    d["social_proof_claims"] = 0
    d["platform_mentions"] = 0
    d["competitive_total"] = 0
    d["replacement_total"] = 0
    d["category_creation_total"] = 0
    d["ai_count"] = 0
    d["ai_density"] = 0.0
    d["buzzword_count"] = 0
    d["primary_cta"] = "none"
    d["cta_position"] = "none"
    d["has_discount"] = 0
    d["has_scarcity"] = 0
    d["has_pricing"] = 0
    d["has_url"] = 0
    d["closing_has_cta"] = 0
    d["closing_has_thanks"] = 0
    d["storytelling"] = 0
    d["humor"] = 0
    d["demo_instructions"] = 0
    d["screen_narration"] = 0
    d["data_viz_cues"] = 0
    d["energy_markers"] = 0
    d["feature_list_markers"] = 0
    d["production_markers"] = 0
    d["speaker_changes"] = 0
    d["action_verb_count"] = 0
    d["feature_words"] = 0
    d["benefit_words"] = 0
    d["benefit_ratio"] = 0.0
    d["question_count"] = 0
    d["passive_voice_count"] = 0
    d["sentiment"] = "neutral"
    d["confidence_count"] = 0
    d["product_name_repeats"] = 0

    # V2 defaults
    d["inciting_incident"] = 0
    d["villain_named"] = 0
    d["villain_count"] = 0
    d["stakes_escalation"] = 0
    d["transformation_promise"] = 0
    d["transformation_position"] = -1.0
    d["pivot_sharpness"] = 1
    d["nested_stories"] = 0
    d["temporal_anchors"] = 0
    d["imagine_device"] = 0
    d["cliffhanger_beats"] = 0
    d["why_now"] = 0
    d["journey_vs_destination"] = 0.5
    d["emotional_bookend_match"] = 0
    d["unsaid_problem"] = 0
    d["resolution_completeness"] = 0.5
    d["story_compression"] = 1.0
    d["emotion_specificity"] = 1
    d["relief_distance"] = 0
    d["pride_trigger"] = 0
    d["fomo_construction"] = 0
    d["empathy_firsthand"] = 0
    d["empathy_observed"] = 0
    d["frustration_vocabulary_breadth"] = 0
    d["joy_velocity_shift"] = 2
    d["vulnerability_moment"] = 0
    d["anticipatory_emotion"] = 0
    d["social_belonging"] = 0
    d["loss_aversion_framing"] = 0.5
    d["surprise_delight"] = 0
    d["confidence_gradient"] = 2
    d["emotional_contrast_ratio"] = 1
    d["finally_signal"] = 0
    d["empathy_depth"] = 1
    d["feature_intro_velocity"] = 3
    d["orphaned_features"] = 0.5
    d["demo_voice_present_tense"] = 0
    d["concrete_vs_abstract"] = 3
    d["magic_moment_position"] = 0.5
    d["speed_claims"] = 0
    d["effort_reduction_specific"] = 0
    d["effort_reduction_vague"] = 0
    d["integration_count"] = 0
    d["progressive_disclosure"] = 0
    d["one_more_thing"] = 0
    d["simplicity_signals"] = 0
    d["under_the_hood"] = 0
    d["use_case_count"] = 1
    d["liveness_score"] = 2
    d["onboarding_time_claim"] = 0
    d["comparison_moment"] = 0
    d["verb_energy"] = 2
    d["sentence_rhythm_variance"] = 1
    d["power_word_cluster_density"] = 1
    d["jargon_distribution_shape"] = "minimal"
    d["anaphora_count"] = 0
    d["just_minimizer"] = 0
    d["superlative_density"] = 0.0
    d["question_answer_pairs"] = 0
    d["transition_sophistication"] = 2
    d["negation_as_benefit"] = 0
    d["specificity_index"] = 1
    d["you_insertion_rate"] = 0.0
    d["cliche_count"] = 0
    d["conditional_density"] = 0.0
    d["parallel_structure"] = 0
    d["imperative_density"] = 0.0
    d["word_rarity_score"] = 1
    d["qualifying_retreat"] = 0
    d["conclusive_finality"] = 1
    d["social_proof_stacking_order"] = "none"
    d["authority_type"] = "none"
    d["reciprocity_trigger"] = 0
    d["anchor_contrast_pricing"] = 0
    d["contrast_pairs"] = 0
    d["certainty_ratio"] = 0.5
    d["in_group_language"] = 0
    d["objection_preempt"] = 0
    d["scarcity_type"] = "none"
    d["bandwagon_gradient"] = 0
    d["choice_architecture"] = 0
    d["cognitive_ease"] = 0
    d["everyone_else_maneuver"] = 0
    d["future_self_projection"] = 0
    d["info_density_shape"] = "even"
    d["breathing_room"] = 3
    d["cold_open_words"] = 0
    d["callback_count"] = 0
    d["section_length_cv"] = 2
    d["promise_proof_push"] = 0.0
    d["first_feature_position"] = 0.3
    d["parenthetical_credibility"] = 0
    d["section_boundary_markers"] = 0
    d["setup_payoff_distance"] = 2.0
    d["multi_persona_address"] = 0
    d["voice_consistency"] = 3
    d["counterfactual_count"] = 0
    d["closing_velocity"] = 3
    d["open_loop_closing"] = 0
    d["definitive_closing"] = 0

    return d


# ─────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────

def main():
    import sys

    input_path = "/Users/maxguillabert/Downloads/index/launch-video-analysis/ph/v2-llm-parts/input_batch_05.json"
    output_path = "/Users/maxguillabert/Downloads/index/launch-video-analysis/ph/v2-llm-parts/output_batch_05.json"

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
            print(f"  ERROR on id={item.get('id', '?')}: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            # Still produce a default result
            results.append(make_default(item.get("id", "?"), item.get("transcript", ""), item.get("name", "")))

    # Verify all dimension counts
    expected_dims = 169  # prompt says 200 but only defines 169 distinct keys
    for r in results:
        actual = len(r) - 1  # minus "id"
        if actual != expected_dims:
            print(f"  WARNING: id={r['id']} has {actual} dimensions (expected {expected_dims})")

    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"Done. Wrote {len(results)} results to {output_path}")

    # Final dimension count check
    if results:
        print(f"Dimensions per record: {len(results[0]) - 1}")
        print(f"Sample keys: {list(results[0].keys())[:10]}...")

if __name__ == "__main__":
    main()
