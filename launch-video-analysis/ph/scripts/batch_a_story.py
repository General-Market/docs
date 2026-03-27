"""Batch A — Story dimensions (1-17) for PH launch transcripts."""

import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))

from shared_utils import (
    load_transcripts, sentences, words, word_count,
    thirds, median, save_results, count_pattern, has_pattern
)

# ── Pattern banks ──────────────────────────────────────────────────

INCITING_PATTERNS = [
    r"\blast (week|month|year|quarter|night|summer|winter|spring|fall)\b",
    r"\bone day\b",
    r"\bwhen (i|we) (realized|noticed|discovered|found out|saw|tried)\b",
    r"\bafter spending\b",
    r"\bi was\b.{0,40}\b(struggling|frustrated|stuck|tired|annoyed)\b",
    r"\b(back in|in) (20\d\d|january|february|march|april|may|june|july|august|september|october|november|december)\b",
    r"\bi remember\b",
    r"\bit all started\b",
    r"\bthat('s| is) when\b",
    r"\b(three|four|five|six|seven|eight|nine|ten|\d+) (years?|months?|weeks?|hours?) ago\b",
    r"\bmidnight\b",
    r"\bat \d+\s*(am|pm|a\.m|p\.m)\b",
    r"\bwe were\b.{0,30}\b(working|building|trying|struggling)\b",
]

VILLAIN_PATTERNS = [
    r"\bspreadsheet(s)?\b", r"\bexcel\b", r"\bmanual(ly)?\b",
    r"\bthe old way\b", r"\blegacy\b", r"\btraditional\b",
    r"\bemail chain(s)?\b", r"\bmeeting(s)?\b.{0,15}\b(endless|back.?to.?back|too many)\b",
    r"\bcopy.?paste\b", r"\bcopy and paste\b",
    r"\bswitching between\b", r"\btab(s)?\b.{0,10}\b(switching|juggling|dozens|multiple)\b",
    r"\boutdated\b", r"\bbroken (system|process|workflow)\b",
    r"\bclunky\b", r"\bslow (process|system|tool)\b",
    r"\bpaper(work)?\b.{0,10}\b(pile|stack|manual|tedious)\b",
    r"\bslack\b.{0,15}\b(notification|overload|noise|mess)\b",
    r"\b(google docs?|notion|trello|jira|asana|airtable|zapier|hubspot|salesforce|intercom|zendesk)\b",
]

TRANSFORMATION_PATTERNS = [
    r"\bgo from .{1,40} to\b",
    r"\bbecome\b", r"\btransform\b",
    r"\bturn(s|ing)? you(r)?\b.{0,20}\b(into|from)\b",
    r"\bnever again\b", r"\bno longer\b",
    r"\bstop .{0,20} start\b",
    r"\binstead of\b.{5,50}\byou (can|will|get)\b",
    r"\bfrom .{1,30} to .{1,30} in\b",
]

PIVOT_PATTERNS = [
    r"\bso (we|i) (built|created|made|designed|developed)\b",
    r"\bthat'?s? why (we|i) (built|created|made|started)\b",
    r"\bintroducing\b",
    r"\bmeet [A-Z]",
    r"\benter [A-Z]",
    r"\bhere'?s? (the|our) (solution|answer|tool)\b",
    r"\bwe (decided|set out) to\b",
    r"\bthat'?s? (where|when) .{0,20} (comes?|steps?) in\b",
    r"\bwelcome to\b",
    r"\bsay (hello|goodbye|hey) to\b",
]

NESTED_STORY_PATTERNS = [
    r"\bone of (our|my) (users?|customers?|clients?|beta testers?)\b",
    r"\b(a|our) (customer|user|client|founder|friend|colleague) (told|said|mentioned|shared)\b",
    r"\bmy friend\b",
    r"\bfor example,? [A-Z][a-z]+\b",
    r"\b(sarah|john|mike|alex|maria|david|james|anna|emily|mark|lisa|tom|chris|jessica|dan|sam)\b.{0,30}\b(told|said|was|had|needed)\b",
    r'"[^"]{10,}"',  # quoted speech
    r"\breal.?world example\b",
    r"\blet me (tell|share|give) you\b",
]

TEMPORAL_PATTERNS = [
    r"\b20[12]\d\b",
    r"\blast (month|quarter|week|year)\b",
    r"\bin Q[1-4]\b",
    r"\bin (\d+) (seconds?|minutes?|hours?|days?|weeks?|months?)\b",
    r"\b(january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2}\b",
    r"\bwithin (seconds?|minutes?|hours?)\b",
    r"\b\d+ (seconds?|minutes?|hours?) (later|ago|flat)\b",
]

IMAGINE_PATTERNS = [
    r"\bimagine\b",
    r"\bpicture this\b",
    r"\bwhat if you could\b",
    r"\bthink about\b",
    r"\benvision\b",
    r"\bwhat if\b.{0,5}\byou\b",
]

CLIFFHANGER_PATTERNS = [
    r"\bbut here'?s? the (thing|catch|twist|kicker)\b",
    r"\band then\b",
    r"\bwhat if i told you\b",
    r"\bwait until you see\b",
    r"\bbut wait\b",
    r"\bhere'?s? where it gets\b",
    r"\bthe best part\b",
    r"\byou won'?t believe\b",
    r"\bhere'?s? the (secret|trick|magic)\b",
    r"\bhold on\b",
    r"\bguess what\b",
]

WHY_NOW_PATTERNS = [
    r"\bwith the rise of\b",
    r"\bnow that\b.{0,30}\b(exist|available|possible|here)\b",
    r"\bthe market is\b",
    r"\b(ai|gpt|llm|chatgpt|openai|generative)\b.{0,20}\b(revolution|era|age|wave|boom|explosion|breakthrough)\b",
    r"\bregulat(ion|ory)\b",
    r"\b(gdpr|hipaa|sox|ccpa|dora)\b",
    r"\btiming\b",
    r"\bright now\b.{0,20}\b(is the|there'?s? a)\b",
    r"\b(trend|shift|movement|wave) (toward|in|of)\b",
    r"\bnew (era|age|wave|paradigm)\b",
]

JOURNEY_PATTERNS = [
    r"\bhelps you\b", r"\benables\b", r"\blets you\b",
    r"\btakes you\b", r"\bempowers you\b", r"\bguides you\b",
    r"\ballows you to\b", r"\bmakes it easy to\b",
]

DESTINATION_PATTERNS = [
    r"\bthe (solution|answer|platform|tool|app) (for|to|that)\b",
    r"\ball.?in.?one\b",
    r"\bthe (only|best|fastest|simplest|ultimate)\b",
    r"\byour .{0,15} (hub|dashboard|cockpit|command center|headquarters)\b",
    r"\beverything you need\b",
]

UNSAID_PATTERNS = [
    r"\byou know (that|the) feeling\b",
    r"\bwe'?ve all been there\b",
    r"\bsound(s)? familiar\b",
    r"\byou know how\b",
    r"\bever had to\b",
    r"\bever tried to\b",
    r"\byou'?ve (probably|likely|definitely)\b",
    r"\blet'?s? be honest\b",
    r"\blet'?s? face it\b",
    r"\bwe all know\b",
]

PROBLEM_WORDS = {
    "problem", "struggle", "pain", "issue", "challenge", "difficult",
    "tedious", "manual", "broken", "slow", "frustrating", "frustrated",
    "painful", "annoying", "complicated", "confusing", "overwhelming",
    "nightmare", "chaos", "mess", "hassle", "headache", "bottleneck",
    "inefficient", "clunky", "error", "errors", "bug", "bugs",
}

SOLUTION_WORDS = {
    "solve", "fix", "automate", "simplify", "streamline", "eliminate",
    "remove", "reduce", "save", "improve", "optimize", "enhance",
    "faster", "easier", "simpler", "automated", "seamless", "effortless",
    "instant", "instantly", "powerful", "efficient",
}

COMPRESSION_MARKERS = [
    r"\bthen\b", r"\bnext\b", r"\bafter\b", r"\bbefore\b",
    r"\bfinally\b", r"\bfirst\b", r"\beventually\b", r"\blater\b",
    r"\bonce\b", r"\bsecond(ly)?\b", r"\bthird(ly)?\b",
    r"\bstep \d\b", r"\bmeanwhile\b", r"\bsubsequently\b",
]

NEGATIVE_WORDS = {
    "problem", "struggle", "pain", "issue", "difficult", "tedious",
    "slow", "frustrating", "broken", "failing", "waste", "lost",
    "never", "wrong", "bad", "worse", "worst", "hate", "annoying",
    "nightmare", "chaos", "mess", "risk", "danger", "crisis",
    "stress", "stressful", "overwhelming", "confusing", "complicated",
}

POSITIVE_WORDS = {
    "great", "amazing", "love", "perfect", "beautiful", "awesome",
    "powerful", "fast", "easy", "simple", "elegant", "smooth",
    "brilliant", "incredible", "fantastic", "excellent", "wonderful",
    "happy", "success", "win", "growth", "improve", "better", "best",
}

# ── Sentiment helper ───────────────────────────────────────────────

def sentiment_score(text):
    """Simple positive-negative word ratio."""
    ws = set(words(text))
    pos = len(ws & POSITIVE_WORDS)
    neg = len(ws & NEGATIVE_WORDS)
    return pos - neg


# ── Extraction ─────────────────────────────────────────────────────

def extract(tx):
    t = tx["transcript"]
    t_lower = t.lower()
    wds = words(t)
    wc = len(wds)
    sents = sentences(t)
    tds = thirds(sents)

    row = {"id": tx["id"]}

    # 1. inciting_incident (0/1)
    row["inciting_incident"] = 1 if has_pattern(t, INCITING_PATTERNS) else 0

    # 2. villain_named (0/1)
    row["villain_named"] = 1 if has_pattern(t, VILLAIN_PATTERNS) else 0

    # 3. villain_count (int)
    row["villain_count"] = count_pattern(t, VILLAIN_PATTERNS)

    # 4. stakes_escalation (0/1)
    # Compare negative words in first half vs second half
    if wc > 10:
        mid = wc // 2
        first_half = " ".join(wds[:mid])
        second_half = " ".join(wds[mid:])
        neg_first = sum(1 for w in wds[:mid] if w in NEGATIVE_WORDS)
        neg_second = sum(1 for w in wds[mid:] if w in NEGATIVE_WORDS)
        row["stakes_escalation"] = 1 if neg_second > neg_first else 0
    else:
        row["stakes_escalation"] = 0

    # 5. transformation_promise (0/1)
    row["transformation_promise"] = 1 if has_pattern(t, TRANSFORMATION_PATTERNS) else 0

    # 6. transformation_position (float 0-1, -1 if absent)
    tp_pos = -1.0
    for p in TRANSFORMATION_PATTERNS:
        for m in re.finditer(p, t_lower):
            # position as fraction of transcript length
            pos = m.start() / max(len(t_lower), 1)
            if tp_pos < 0 or pos < tp_pos:
                tp_pos = pos
    row["transformation_position"] = round(tp_pos, 3)

    # 7. pivot_sharpness (int)
    row["pivot_sharpness"] = count_pattern(t, PIVOT_PATTERNS)

    # 8. nested_stories (0/1)
    row["nested_stories"] = 1 if has_pattern(t, NESTED_STORY_PATTERNS) else 0

    # 9. temporal_anchors (int)
    row["temporal_anchors"] = count_pattern(t, TEMPORAL_PATTERNS)

    # 10. imagine_device (int)
    row["imagine_device"] = count_pattern(t, IMAGINE_PATTERNS)

    # 11. cliffhanger_beats (int)
    row["cliffhanger_beats"] = count_pattern(t, CLIFFHANGER_PATTERNS)

    # 12. why_now (0/1)
    row["why_now"] = 1 if has_pattern(t, WHY_NOW_PATTERNS) else 0

    # 13. journey_vs_destination (float)
    journey = count_pattern(t, JOURNEY_PATTERNS)
    destination = count_pattern(t, DESTINATION_PATTERNS)
    denom = journey + destination
    row["journey_vs_destination"] = round(journey / denom, 3) if denom > 0 else 0.5

    # 14. emotional_bookend_match (0/1)
    if len(sents) >= 4:
        opening = " ".join(sents[:2])
        closing = " ".join(sents[-2:])
        open_sent = sentiment_score(opening)
        close_sent = sentiment_score(closing)
        # Match = same sign (both positive, both negative, or both neutral)
        row["emotional_bookend_match"] = 1 if (open_sent >= 0 and close_sent >= 0) or (open_sent < 0 and close_sent < 0) else 0
    else:
        row["emotional_bookend_match"] = 0

    # 15. unsaid_problem (int)
    row["unsaid_problem"] = count_pattern(t, UNSAID_PATTERNS)

    # 16. resolution_completeness (float)
    problem_ct = sum(1 for w in wds if w in PROBLEM_WORDS)
    solution_ct = sum(1 for w in wds if w in SOLUTION_WORDS)
    total_ps = problem_ct + solution_ct
    row["resolution_completeness"] = round(solution_ct / total_ps, 3) if total_ps > 0 else 0.5

    # 17. story_compression (float) — markers per 100 words
    comp_count = count_pattern(t, COMPRESSION_MARKERS)
    row["story_compression"] = round((comp_count / max(wc, 1)) * 100, 3)

    return row


# ── Main ───────────────────────────────────────────────────────────

def main():
    transcripts = load_transcripts(min_words=20)
    print(f"Loaded {len(transcripts)} transcripts")

    results = []
    for tx in transcripts:
        results.append(extract(tx))

    save_results("batch_a_story", results)
    print(f"Saved {len(results)} results to v2-parts/batch_a_story.json")

    # ── Summary stats ──────────────────────────────────────────────
    dims = [k for k in results[0].keys() if k != "id"]
    print(f"\n{'Dimension':<30} {'Mean':>8} {'Median':>8} {'Min':>8} {'Max':>8}")
    print("-" * 70)
    for dim in dims:
        vals = [r[dim] for r in results]
        avg = sum(vals) / len(vals)
        med = median(vals)
        lo = min(vals)
        hi = max(vals)
        print(f"{dim:<30} {avg:>8.3f} {med:>8.3f} {lo:>8.3f} {hi:>8.3f}")

    print(f"\nTranscripts processed: {len(results)}")


if __name__ == "__main__":
    main()
