"""Batch C — Product dimensions (35-51).

Feature pacing, demo narration, concreteness, integrations,
use cases, liveness, and comparison moments.
"""

import re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from shared_utils import (
    load_transcripts, sentences, words, word_count,
    save_results, count_pattern, has_pattern, median
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FEATURE_MARKERS = [
    r'\bfeature\b', r'\byou can also\b', r'\banother\b', r'\bnext\b',
    r'\balso\b', r'\bplus\b', r'\badditionally\b', r'\bon top of that\b',
    r'\bnumber one\b', r'\bnumber two\b', r'\bnumber three\b',
    r'\bnumber four\b', r'\bnumber five\b',
    r'\bfirst\b', r'\bsecond\b', r'\bthird\b', r'\bfourth\b', r'\bfifth\b',
]

BENEFIT_WORDS = [
    r'\bsave\b', r'\bsaves\b', r'\bsaving\b',
    r'\bfaster\b', r'\beasier\b', r'\breduce\b', r'\breduces\b',
    r'\bimprove\b', r'\bimproves\b', r'\bhelp\b', r'\bhelps\b',
    r'\bboost\b', r'\bincrease\b', r'\bbetter\b',
    r'\bwithout\b', r'\bnever\b',
]

PRESENT_TENSE_DEMO = [
    r'\bi click\b', r'\byou see\b', r'\bit shows\b',
    r'\bhere we have\b', r'\bthis is\b', r'\blet me show\b',
    r'\bi select\b', r'\bi type\b', r'\bi drag\b', r'\bi open\b',
    r'\byou click\b', r'\byou type\b',
]

DEMO_SENTENCE_MARKERS = [
    r'\bclick\b', r'\bshow\b', r'\bsee\b', r'\bdemo\b', r'\bscreen\b',
    r'\binterface\b', r'\bdashboard\b', r'\bbutton\b', r'\bpage\b',
    r'\btab\b', r'\btype\b', r'\bdrag\b', r'\bselect\b',
]

CONCRETE_PATTERNS = [
    r'\d+',                          # specific numbers
    r'\bclick the\b', r'\bpress the\b', r'\btap the\b',
    r'\bsee the\b', r'\bdrag the\b',
    r'\bbutton\b', r'\bchart\b', r'\bcard\b', r'\btable\b',
    r'\bdashboard\b', r'\bsidebar\b', r'\btoolbar\b', r'\bmenu\b',
    r'\bdropdown\b', r'\bcheckbox\b', r'\btoggle\b', r'\bslider\b',
    r'\bfield\b', r'\binput\b', r'\bcolumn\b', r'\brow\b',
]

ABSTRACT_PATTERNS = [
    r'\bpowerful\b', r'\brobust\b', r'\bcomprehensive\b',
    r'\badvanced\b', r'\bcutting.edge\b', r'\bstate of the art\b',
    r'\bworld.class\b', r'\binnovative\b', r'\bseamless\b',
    r'\bnext.gen(?:eration)?\b', r'\bscalable\b', r'\bflexible\b',
]

POWER_WORDS = [
    r'\bincredible\b', r'\bamazing\b', r'\binstantly\b',
    r'\bautomatically\b', r'\bmagic\b', r'\bwow\b',
    r'\bgame.changing\b', r'\brevolutionary\b',
    r'\bunbelievable\b', r'\binsane\b', r'\bmind.blowing\b',
]

SUPERLATIVES = [
    r'\bbest\b', r'\bfastest\b', r'\beasiest\b', r'\bmost\b',
    r'\bbiggest\b', r'\bsmallest\b', r'\bcheapest\b',
]

SPEED_PATTERNS = [
    r'\bin seconds\b', r'\binstantly\b', r'\breal.time\b',
    r'\d+x faster\b', r'\bin minutes\b', r'\blightning\b',
    r'\bblazing\b', r'\brapid\b', r'\bquick\b', r'\bimmediate\b',
    r'\bspeed\b', r'\bmilliseconds\b',
]

EFFORT_SPECIFIC = [
    r'what took .{1,30} now takes',
    r'from \d+ .{1,20} to \d+',
    r'reduce .{1,30} by \d+%',
    r'\d+ hours? .{0,20} \d+ minutes?',
    r'\d+ steps? .{0,20} \d+ steps?',
    r'\d+x (?:less|fewer)',
]

EFFORT_VAGUE = [
    r'\bsaves? time\b', r'\breduces? effort\b', r'\bless work\b',
    r'\beasier\b', r'\bsimpler\b', r'\bstreamline\b', r'\bstreamlines\b',
    r'\bno hassle\b', r'\beffortless\b',
]

INTEGRATION_NAMES = [
    'slack', 'notion', 'zapier', 'github', 'jira', 'google',
    'salesforce', 'hubspot', 'stripe', 'shopify', 'figma',
    'linear', 'asana', 'trello', 'airtable', 'discord',
    'teams', 'zoom', 'confluence', 'dropbox', 'drive',
    'aws', 'azure', 'gcp', 'vercel', 'supabase', 'firebase',
    'twilio', 'sendgrid', 'mailchimp', 'intercom', 'segment',
    'datadog', 'postgres', 'mysql', 'redis', 'mongodb',
    'openai', 'anthropic', 'gitlab', 'bitbucket', 'heroku',
    'netlify', 'cloudflare', 'wordpress', 'webflow',
]

PROGRESSIVE_EARLY = [r'\bbasic\b', r'\bsimple\b', r'\bstart with\b', r'\bfirst\b']
PROGRESSIVE_LATE = [
    r'\badvanced\b', r'\bpowerful\b', r'\bscale to\b', r'\bscale up\b',
    r'\bpower users?\b', r"doesn't stop there\b", r'\bdoesn.t stop there\b',
]

ONE_MORE_THING = [
    r'\bone more thing\b', r'\bbonus\b', r'\boh and\b',
    r'\balmost forgot\b', r'\band finally\b', r'\blast but not least\b',
    r'\bcherry on top\b', r'\bbut wait\b', r'\bthere.s more\b',
]

SIMPLICITY = [
    r'\bsimple\b', r'\beasy\b', r'\bjust\b',
    r'\bno learning curve\b', r'\bintuitive\b', r'\bstraightforward\b',
    r'\bno setup\b', r'\bzero config\b', r'\bone click\b',
    r'\bplug and play\b', r'\bout of the box\b',
    r'\bno code needed\b', r'\bdrag and drop\b', r'\bno.code\b',
]

UNDER_HOOD = [
    r'\bbuilt on\b', r'\bpowered by\b', r'\buses gpt\b',
    r'\bvector\b', r'\bllm\b', r'\btransformer\b',
    r'\bapi\b', r'\bunder the hood\b', r'\barchitecture\b',
    r'\binfrastructure\b', r'\bengine\b', r'\balgorithm\b',
    r'\bneural\b', r'\bfine.tuned\b', r'\btrained on\b',
    r'\bmachine learning\b', r'\bdeep learning\b',
]

USE_CASE_TRIGGERS = [
    r'\bfor (?:the )?(?:marketer|developer|designer|pm|manager|founder|'
    r'sales|support|hr|teacher|student|creator|writer|analyst|engineer|'
    r'team|startup|enterprise|freelancer|agency|consultant)s?\b',
    r'\bwhether you.re\b', r"\bif you're a\b", r'\bif you are a\b',
    r'\bperfect for\b', r'\bideal for\b', r'\bgreat for\b',
    r'\bdesigned for\b', r'\bworks for\b',
]

ROLE_WORDS = [
    'marketer', 'developer', 'designer', 'pm', 'manager', 'founder',
    'sales', 'support', 'hr', 'teacher', 'student', 'creator',
    'writer', 'analyst', 'engineer', 'freelancer', 'agency',
    'consultant', 'entrepreneur', 'cto', 'ceo', 'product manager',
    'data scientist', 'researcher', 'editor', 'photographer',
]

LIVENESS = [
    r'\blet me show\b', r'\bwatch this\b', r"\bi'll click\b",
    r'\bas you can see\b', r'\bhere you can see\b',
    r'\bright here\b', r'\blike this\b', r'\bnotice how\b',
    r'\bsee how\b', r'\blook at this\b', r'\bover here\b',
    r'\bas you see\b', r'\bhere we\b',
]

ONBOARDING_TIME = [
    r'\bup and running in\b', r'\bset up in\b', r'\bget started in\b',
    r'\btakes? \d+ minutes?\b', r'\bdeploy in\b', r'\binstall in\b',
    r'\bready in\b', r'\bin \d+ (?:minutes?|seconds?|hours?)\b',
]

COMPARISON = [
    r"\bhere's the old way\b", r'\bbefore and after\b',
    r'\bon the left\b', r'\bon the right\b', r'\bversus\b',
    r'\bcompared to\b', r'\bside by side\b', r'\bthe difference\b',
    r'\blook at the difference\b', r'\bvs\.?\b',
]


# ---------------------------------------------------------------------------
# Per-transcript extractors
# ---------------------------------------------------------------------------

def feature_marker_positions(text):
    """Return word-index of each feature marker match."""
    wds = words(text)
    text_lower = text.lower()
    # Build a mapping from character offset to word index
    positions = []
    for pat in FEATURE_MARKERS:
        for m in re.finditer(pat, text_lower):
            # Convert char offset to approximate word index
            prefix = text_lower[:m.start()]
            word_idx = len(re.findall(r"[a-zA-Z']+", prefix))
            positions.append(word_idx)
    positions.sort()
    return positions


def dim35_feature_intro_velocity(text):
    """Average words between consecutive feature markers."""
    positions = feature_marker_positions(text)
    if len(positions) < 2:
        return 0.0
    gaps = [positions[i+1] - positions[i] for i in range(len(positions)-1)]
    return sum(gaps) / len(gaps)


def dim36_orphaned_features(text):
    """Ratio of features NOT followed by a benefit within 2 sentences."""
    sents = sentences(text)
    if not sents:
        return 0.0

    # Identify sentences that contain a feature marker
    feature_indices = []
    for i, s in enumerate(sents):
        if has_pattern(s, FEATURE_MARKERS):
            feature_indices.append(i)

    if not feature_indices:
        return 0.0

    orphaned = 0
    for fi in feature_indices:
        # Check this sentence and next 2 for benefit words
        found_benefit = False
        for offset in range(3):  # current + 2 ahead
            idx = fi + offset
            if idx < len(sents):
                if has_pattern(sents[idx], BENEFIT_WORDS):
                    found_benefit = True
                    break
        if not found_benefit:
            orphaned += 1

    return orphaned / len(feature_indices)


def dim37_demo_voice_present_tense(text):
    """Ratio of present-tense demo narration to total demo-like sentences."""
    sents = sentences(text)
    if not sents:
        return 0.0

    demo_sents = [s for s in sents if has_pattern(s, DEMO_SENTENCE_MARKERS)]
    if not demo_sents:
        return 0.0

    present_count = sum(1 for s in demo_sents if has_pattern(s, PRESENT_TENSE_DEMO))
    return present_count / len(demo_sents)


def dim38_concrete_vs_abstract(text):
    """Ratio of concrete to abstract language. Higher = more concrete."""
    concrete = count_pattern(text, CONCRETE_PATTERNS)
    abstract = count_pattern(text, ABSTRACT_PATTERNS)
    total = concrete + abstract
    if total == 0:
        return 0.5
    return concrete / total


def dim39_magic_moment_position(text):
    """Position (0-1) of the most impressive-sounding sentence."""
    sents = sentences(text)
    if not sents:
        return 0.5

    best_score = -1
    best_idx = 0
    for i, s in enumerate(sents):
        score = 0
        score += count_pattern(s, POWER_WORDS)
        score += count_pattern(s, SUPERLATIVES)
        score += s.count('!')
        if score > best_score:
            best_score = score
            best_idx = i

    return best_idx / max(len(sents) - 1, 1)


def dim40_speed_claims(text):
    return count_pattern(text, SPEED_PATTERNS)


def dim41_effort_reduction_specific(text):
    return 1 if has_pattern(text, EFFORT_SPECIFIC) else 0


def dim42_effort_reduction_vague(text):
    return 1 if has_pattern(text, EFFORT_VAGUE) else 0


def dim43_integration_count(text):
    """Count distinct named integrations."""
    text_lower = text.lower()
    found = set()
    for name in INTEGRATION_NAMES:
        # Use word boundary to avoid false positives
        if re.search(r'\b' + re.escape(name) + r'\b', text_lower):
            found.add(name)
    return len(found)


def dim44_progressive_disclosure(text):
    """1 if transcript layers simple→advanced."""
    sents = sentences(text)
    if len(sents) < 4:
        return 0
    mid = len(sents) // 2
    first_half = ' '.join(sents[:mid]).lower()
    second_half = ' '.join(sents[mid:]).lower()

    has_early = has_pattern(first_half, PROGRESSIVE_EARLY)
    has_late = has_pattern(second_half, PROGRESSIVE_LATE)

    # Also check numbered features (1, 2, 3 or "number one", etc.)
    numbered = len(re.findall(
        r'(?:number (?:one|two|three|four|five)|'
        r'(?:first|second|third|fourth|fifth)(?:ly)?)',
        text.lower()
    ))

    return 1 if (has_early and has_late) or numbered >= 3 else 0


def dim45_one_more_thing(text):
    """Bonus reveal in last 20% of transcript."""
    sents = sentences(text)
    if not sents:
        return 0
    cutoff = max(1, int(len(sents) * 0.8))
    tail = ' '.join(sents[cutoff:])
    return 1 if has_pattern(tail, ONE_MORE_THING) else 0


def dim46_simplicity_signals(text):
    return count_pattern(text, SIMPLICITY)


def dim47_under_the_hood(text):
    return 1 if has_pattern(text, UNDER_HOOD) else 0


def dim48_use_case_count(text):
    """Count distinct use cases / role mentions."""
    text_lower = text.lower()
    # Count trigger phrases
    trigger_count = count_pattern(text, USE_CASE_TRIGGERS)
    # Count distinct role words
    found_roles = set()
    for role in ROLE_WORDS:
        if re.search(r'\b' + re.escape(role) + r's?\b', text_lower):
            found_roles.add(role)
    return max(trigger_count, len(found_roles))


def dim49_liveness_score(text):
    """Live demo markers per 100 words."""
    wc = word_count(text)
    if wc == 0:
        return 0.0
    hits = count_pattern(text, LIVENESS)
    return round(hits / wc * 100, 3)


def dim50_onboarding_time_claim(text):
    return 1 if has_pattern(text, ONBOARDING_TIME) else 0


def dim51_comparison_moment(text):
    return 1 if has_pattern(text, COMPARISON) else 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def process(item):
    t = item["transcript"]
    return {
        "id": item["id"],
        "feature_intro_velocity": round(dim35_feature_intro_velocity(t), 2),
        "orphaned_features": round(dim36_orphaned_features(t), 3),
        "demo_voice_present_tense": round(dim37_demo_voice_present_tense(t), 3),
        "concrete_vs_abstract": round(dim38_concrete_vs_abstract(t), 3),
        "magic_moment_position": round(dim39_magic_moment_position(t), 3),
        "speed_claims": dim40_speed_claims(t),
        "effort_reduction_specific": dim41_effort_reduction_specific(t),
        "effort_reduction_vague": dim42_effort_reduction_vague(t),
        "integration_count": dim43_integration_count(t),
        "progressive_disclosure": dim44_progressive_disclosure(t),
        "one_more_thing": dim45_one_more_thing(t),
        "simplicity_signals": dim46_simplicity_signals(t),
        "under_the_hood": dim47_under_the_hood(t),
        "use_case_count": dim48_use_case_count(t),
        "liveness_score": round(dim49_liveness_score(t), 3),
        "onboarding_time_claim": dim50_onboarding_time_claim(t),
        "comparison_moment": dim51_comparison_moment(t),
    }


if __name__ == "__main__":
    data = load_transcripts()
    print(f"Processing {len(data)} transcripts...")

    results = [process(item) for item in data]
    save_results("batch_c_product", results)

    # ---------- Summary stats ----------
    dims = [k for k in results[0] if k != "id"]
    print(f"\n{'Dimension':<30} {'Mean':>8} {'Median':>8} {'Min':>8} {'Max':>8} {'StdDev':>8}")
    print("-" * 78)

    for dim in dims:
        vals = [r[dim] for r in results]
        n = len(vals)
        mean_v = sum(vals) / n
        med_v = median(vals)
        min_v = min(vals)
        max_v = max(vals)
        variance = sum((v - mean_v) ** 2 for v in vals) / n
        std_v = variance ** 0.5
        print(f"{dim:<30} {mean_v:>8.3f} {med_v:>8.3f} {min_v:>8.3f} {max_v:>8.3f} {std_v:>8.3f}")

    print(f"\nSaved {len(results)} rows to v2-parts/batch_c_product.json")
