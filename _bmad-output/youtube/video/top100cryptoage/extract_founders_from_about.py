#!/usr/bin/env python3
"""
Extract founder names from CoinGecko 'about' field for top 2000 crypto tokens.

Parses the about text using regex patterns to find founder/creator mentions,
validates names, and outputs a JSON file.
"""

import csv
import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent
INPUT_CSV = BASE_DIR / "top2000_crypto_coingecko.csv"
OUTPUT_JSON = BASE_DIR / "cg_founders_extracted.json"

# Words that indicate this is NOT a person name (lowercase)
NON_PERSON_WORDS = {
    "protocol", "foundation", "network", "labs", "lab", "finance", "team", "dao",
    "exchange", "capital", "group", "community", "blockchain", "technologies",
    "digital", "global", "inc", "ltd", "corp", "token", "coin", "crypto",
    "project", "platform", "system", "systems", "ventures", "holdings",
    "solutions", "software", "institute", "association", "council", "alliance",
    "company", "ecosystem", "technology", "research", "studio", "studios",
    "media", "entertainment", "games", "gaming", "chain", "bridge", "swap",
    "defi", "nft", "web3", "metaverse", "wallet", "mining", "staking",
    "the", "a", "an", "and", "or", "of", "in", "for", "with", "by",
    "is", "was", "are", "were", "its", "their", "this", "that",
    "open", "source", "decentralized", "distributed", "autonomous",
    "market", "maker", "oracle", "algorithm", "module", "service",
    "proactive", "satoshi", "ai", "university", "college", "school",
    "it", "he", "she", "we", "they", "who", "what", "which",
    "sir", "lord", "professor", "prof",
}

# Common English words that start with uppercase at sentence boundaries
COMMON_NON_NAME_WORDS = {
    "One", "Two", "Three", "New", "Old", "Big", "Small",
    "High", "Low", "First", "Last", "Next", "Other",
    "More", "Most", "Some", "Any", "All", "Each",
    "Every", "Both", "Such", "Same", "Own", "Another",
    "Much", "Many", "Several", "Few", "Various",
    "Since", "After", "Before", "While", "Until",
    "During", "Through", "Between", "Among", "Within",
    "Without", "Beyond", "Into", "Onto", "Upon",
    "About", "Above", "Below", "Under", "Over",
    "Like", "Unlike", "Near", "Around", "Along",
    "However", "Therefore", "Furthermore", "Moreover",
    "Consequently", "Meanwhile", "Nevertheless",
    "Peer", "Smart", "Contract", "Cross", "Layer",
    "What", "Which", "Where", "When", "Why", "How",
    "Their", "There", "These", "Those", "Than",
    "Then", "Just", "Also", "Still", "Already",
    "Even", "Only", "Very", "Real", "True", "False",
    "Proof", "Work", "Stake", "Hash", "Block",
    "Being", "Here", "They", "With", "From",
    "Find", "Made", "Make", "Built", "Using",
    "Its", "The", "This", "That", "Such",
    "Not", "But", "Yet", "Now", "So",
}

# Name word: starts with uppercase, at least 2 chars
NAME_WORD_RE = r"[A-Z][a-zA-Z]+"
NAME_INITIAL_RE = r"[A-Z]\."
NAME_PATTERN = rf"((?:{NAME_INITIAL_RE}\s+)?{NAME_WORD_RE}(?:\s+(?:{NAME_INITIAL_RE}\s+)?{NAME_WORD_RE}){{1,3}})"

# Optional honorific prefix
TITLE_PREFIX = r"(?:(?:Dr|Prof|Mr|Mrs|Ms)\.?\s+)?"


def ci_word(word):
    """Make a word case-insensitive without re.IGNORECASE flag."""
    return "".join(f"[{c.upper()}{c.lower()}]" if c.isalpha() else re.escape(c) for c in word)


CI_COFOUNDED = ci_word("co-founded")
CI_FOUNDED = ci_word("founded")
CI_CREATED = ci_word("created")
CI_BUILT = ci_word("built")
CI_DEVELOPED = ci_word("developed")
CI_LAUNCHED = ci_word("launched")
CI_COFOUNDER = ci_word("co-founder")
CI_FOUNDER = ci_word("founder")
CI_BY = ci_word("by")


def is_valid_person_name(name: str, project_name: str) -> bool:
    """Check if extracted text looks like a real person name."""
    words = name.split()

    if len(words) < 2 or len(words) > 4:
        return False

    if not all(w[0].isupper() for w in words):
        return False

    for w in words:
        wl = w.lower().rstrip(".")
        if wl in NON_PERSON_WORDS:
            return False

    if any(w.rstrip(".") in COMMON_NON_NAME_WORDS for w in words):
        return False

    if name.lower() == project_name.lower():
        return False

    proj_words = set(project_name.lower().split())
    name_words_lower = set(w.lower() for w in words)
    if name_words_lower.issubset(proj_words):
        return False

    has_real_word = any(len(w.rstrip(".")) >= 3 for w in words)
    if not has_real_word:
        return False

    for w in words:
        ws = w.rstrip(".")
        if len(ws) >= 2 and ws.isupper():
            return False

    name_lower = name.lower() + " "
    company_suffixes = ["lab ", "labs ", "inc ", "ltd ", "corp ", "llc ",
                        " dao ", " protocol ", " network ", " foundation "]
    for suf in company_suffixes:
        if suf in name_lower:
            return False

    return True


def get_sentence_context(text: str, match_start: int, match_end: int) -> str:
    """Extract the sentence containing the match for context."""
    start = match_start
    while start > 0 and text[start - 1] not in ".!?\n":
        start -= 1
    end = match_end
    while end < len(text) and text[end] not in ".!?\n":
        end += 1
    if end < len(text):
        end += 1

    sentence = text[start:end].strip()
    if len(sentence) > 250:
        mid = (match_start + match_end) // 2 - start
        s = max(0, mid - 125)
        e = min(len(sentence), mid + 125)
        sentence = ("..." if s > 0 else "") + sentence[s:e] + ("..." if e < len(sentence) else "")
    return sentence


def clean_name(name: str) -> str:
    """Clean up extracted name string."""
    name = name.strip()
    name = re.sub(r"[.,;:!?]+$", "", name)
    trailing = {"from", "in", "at", "on", "to", "as", "who", "which", "that", "and", "or"}
    words = name.split()
    while words and words[-1].lower() in trailing:
        words.pop()
    return " ".join(words)


def extract_founders(about: str, project_name: str) -> list:
    """Extract founder names from about text using multiple regex patterns."""
    if not about or len(about.strip()) < 20:
        return []

    founders = []
    seen_names = set()

    def add_founder(name: str, role: str, m_start: int, m_end: int):
        name = clean_name(name)
        if is_valid_person_name(name, project_name) and name not in seen_names:
            context = get_sentence_context(about, m_start, m_end)
            founders.append({"name": name, "role": role, "context": context})
            seen_names.add(name)

    # --- Pattern Group 1: "VERB by [Title] Name" ---
    verb_by_patterns = [
        (CI_COFOUNDED + r"\s+" + CI_BY + r"\s+" + TITLE_PREFIX + NAME_PATTERN, "Co-Founder"),
        (CI_FOUNDED + r"\s+" + CI_BY + r"\s+" + TITLE_PREFIX + NAME_PATTERN, "Founder"),
        (CI_CREATED + r"\s+" + CI_BY + r"\s+" + TITLE_PREFIX + NAME_PATTERN, "Creator"),
        (CI_BUILT + r"\s+" + CI_BY + r"\s+" + TITLE_PREFIX + NAME_PATTERN, "Developer"),
        (CI_DEVELOPED + r"\s+" + CI_BY + r"\s+" + TITLE_PREFIX + NAME_PATTERN, "Developer"),
        (CI_LAUNCHED + r"\s+" + CI_BY + r"\s+" + TITLE_PREFIX + NAME_PATTERN, "Founder"),
    ]

    for pattern, role in verb_by_patterns:
        for m in re.finditer(pattern, about):
            add_founder(m.group(1), role, m.start(), m.end())

            # Check for "and Name" immediately after, or with up to 60 chars in between
            # e.g., "Billy Markus from Portland, Oregon and Jackson Palmer"
            rest = about[m.end():]
            # Immediate: ", Name" or "and Name"
            and_pat = r"\s*(?:and|,\s*and|,)\s+" + TITLE_PREFIX + NAME_PATTERN
            and_match = re.match(and_pat, rest)
            if and_match:
                add_founder(and_match.group(1), role, m.start(), m.end() + and_match.end())
            else:
                # Flexible: skip up to 60 chars of non-sentence-ending text, then "and Name"
                flex_pat = r"[^.!?\n]{1,60}\s+and\s+" + TITLE_PREFIX + NAME_PATTERN
                flex_match = re.match(flex_pat, rest)
                if flex_match:
                    add_founder(flex_match.group(1), role, m.start(), m.end() + flex_match.end())

    # --- Pattern Group 2: "Name VERB" ---
    name_verb_patterns = [
        (NAME_PATTERN + r"\s+" + CI_COFOUNDED, "Co-Founder"),
        (NAME_PATTERN + r"\s+" + CI_FOUNDED, "Founder"),
        (NAME_PATTERN + r"\s+" + CI_CREATED, "Creator"),
    ]

    for pattern, role in name_verb_patterns:
        for m in re.finditer(pattern, about):
            add_founder(m.group(1), role, m.start(), m.end())

    # --- Pattern Group 3: "role [Title] Name" ---
    role_name_patterns = [
        (CI_COFOUNDER + r",?\s+" + TITLE_PREFIX + NAME_PATTERN, "Co-Founder"),
        (r"(?<!\w)" + CI_FOUNDER + r",?\s+" + TITLE_PREFIX + NAME_PATTERN, "Founder"),
    ]

    for pattern, role in role_name_patterns:
        for m in re.finditer(pattern, about):
            add_founder(m.group(1), role, m.start(), m.end())

    # --- Pattern Group 4: "CEO/CTO Name" or "Name, CEO/CTO" ---
    title_patterns = [
        (r"\bCEO\s+" + NAME_PATTERN, "CEO"),
        (r"\bCTO\s+" + NAME_PATTERN, "CTO"),
        (r"\bCOO\s+" + NAME_PATTERN, "COO"),
        (NAME_PATTERN + r",?\s+(?:the\s+)?CEO\b", "CEO"),
        (NAME_PATTERN + r",?\s+(?:the\s+)?CTO\b", "CTO"),
        (NAME_PATTERN + r",?\s+(?:the\s+)?COO\b", "COO"),
    ]

    for pattern, role in title_patterns:
        for m in re.finditer(pattern, about):
            add_founder(m.group(1), role, m.start(), m.end())

    # --- Pattern Group 5: possessive founder: "X's founder Name" ---
    poss_pat = r"(?:'s|s')\s+(?:" + CI_COFOUNDER + r"|" + CI_FOUNDER + r"),?\s+" + TITLE_PREFIX + NAME_PATTERN
    for m in re.finditer(poss_pat, about):
        role = "Co-Founder" if "co-founder" in m.group(0).lower() else "Founder"
        add_founder(m.group(1), role, m.start(), m.end())

    # --- Pattern Group 6: combo roles ---
    combo_patterns = [
        (r"CEO\s+and\s+" + CI_COFOUNDER + r",?\s+" + TITLE_PREFIX + NAME_PATTERN, "CEO & Co-Founder"),
        (r"CEO\s+and\s+" + CI_FOUNDER + r",?\s+" + TITLE_PREFIX + NAME_PATTERN, "CEO & Founder"),
        (CI_COFOUNDER + r"\s+and\s+CEO,?\s+" + TITLE_PREFIX + NAME_PATTERN, "Co-Founder & CEO"),
        (CI_FOUNDER + r"\s+and\s+CEO,?\s+" + TITLE_PREFIX + NAME_PATTERN, "Founder & CEO"),
    ]

    for pattern, role in combo_patterns:
        for m in re.finditer(pattern, about):
            add_founder(m.group(1), role, m.start(), m.end())

    # --- Pattern Group 7: "created/founded by [longer phrase], Name" ---
    long_by_verbs = [CI_COFOUNDED, CI_FOUNDED, CI_CREATED, CI_LAUNCHED]
    for verb in long_by_verbs:
        pat = verb + r"\s+" + CI_BY + r"\s+[^.!?\n]{5,120}?,\s+" + TITLE_PREFIX + NAME_PATTERN
        for m in re.finditer(pat, about):
            txt = m.group(0).lower()
            if "co-found" in txt:
                role = "Co-Founder"
            elif "found" in txt:
                role = "Founder"
            elif "creat" in txt:
                role = "Creator"
            else:
                role = "Founder"
            add_founder(m.group(1), role, m.start(), m.end())

    # Limit to max 2 founders per project
    return founders[:2]


def main():
    print(f"Reading: {INPUT_CSV}")
    print(f"Output:  {OUTPUT_JSON}")
    print()

    rows = []
    with open(INPUT_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    print(f"Loaded {len(rows)} tokens from CSV")
    print()

    results = []
    total_founders = 0

    for row in rows:
        rank = row.get("rank", "")
        cg_id = row.get("id", "")
        cg_name = row.get("name", "")
        cg_symbol = row.get("symbol", "")
        about = row.get("about", "")

        founders = extract_founders(about, cg_name)

        if founders:
            entry = {
                "cg_rank": int(rank) if rank.isdigit() else 0,
                "cg_id": cg_id,
                "cg_name": cg_name,
                "cg_symbol": cg_symbol,
                "founders": founders,
            }
            results.append(entry)
            total_founders += len(founders)

    # Sort by rank
    results.sort(key=lambda x: x["cg_rank"])

    # Write output
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    # Print stats
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"Total tokens processed:       {len(rows)}")
    print(f"Projects with founders found: {len(results)}")
    print(f"Total founders extracted:     {total_founders}")
    print(f"Output written to:            {OUTPUT_JSON}")
    print()

    # Show first 20 examples
    print("-" * 60)
    print("FIRST 20 EXAMPLES:")
    print("-" * 60)
    for entry in results[:20]:
        rank = entry["cg_rank"]
        name = entry["cg_name"]
        symbol = entry["cg_symbol"]
        founders_str = ", ".join(
            f'{f["name"]} ({f["role"]})' for f in entry["founders"]
        )
        print(f"  #{rank:>4} {symbol:<8} {name:<25} -> {founders_str}")

    print()
    print("Done.")


if __name__ == "__main__":
    main()
