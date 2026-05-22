#!/usr/bin/env python3
"""Parse 05-script.md into a flat list of sentences with stable IDs.

Each paragraph is split into sentences on terminal punctuation. Words are
normalised (lowercase, surrounding punctuation stripped, contractions kept).
Stage directions in [brackets] and (beat) notes are excluded — they are not
spoken.

Output JSON shape:
{
  "paragraphs": [
    { "id": "P1", "rhythm": "slow", "sentences": ["p1_s1", "p1_s2"] }
  ],
  "sentences": [
    {
      "id": "p1_s1",
      "paragraph": "P1",
      "rhythm": "slow",
      "text": "Last October, a trader called 0xQuaza wrote down…",
      "words": ["last", "october", "a", "trader", …]
    }
  ]
}
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Markdown / stage direction strippers, in order of application
STRIP_PATTERNS = [
    # Stage directions: [anything], including multi-line
    (re.compile(r"\[[^\]]*\]", re.DOTALL), " "),
    # Parenthetical beats: (beat), (beat. beat.), (slow), etc.
    (re.compile(r"\(beat[^)]*\)", re.IGNORECASE), " "),
    (re.compile(r"\(slow[^)]*\)", re.IGNORECASE), " "),
    (re.compile(r"\(slower[^)]*\)", re.IGNORECASE), " "),
    (re.compile(r"\(fast[^)]*\)", re.IGNORECASE), " "),
    # Markdown emphasis markers
    (re.compile(r"\*\*"), ""),
    (re.compile(r"\*"), ""),
    (re.compile(r"_"), ""),
    # Block quote markers at line start
    (re.compile(r"^>\s*", re.MULTILINE), ""),
    # Smart quotes → plain
    (re.compile(r"[‘’]"), "'"),
    (re.compile(r"[“”]"), '"'),
    # Em/en dashes → spaces (they're pauses, not text)
    (re.compile(r"\s*[—–]+\s*"), " "),
    # Ellipses → period
    (re.compile(r"\.\.\.+"), "."),
    (re.compile(r"…"), "."),
    # Multiple whitespace → single space
    (re.compile(r"\s+"), " "),
]

PARAGRAPH_HEADER_RE = re.compile(r"^###\s+P(\d+)\s*[—\-]\s*\*?\[?([^\]\*]+?)\]?\*?\s*$")

# Sentence boundary: terminal punctuation (optionally followed by a closing
# quote) then whitespace then an uppercase letter or an opening quote. Python
# lookbehind needs fixed width, so we alternate two fixed-width branches.
SENTENCE_SPLIT_RE = re.compile(
    r"(?:(?<=[.!?])|(?<=[.!?][\"']))\s+(?=[\"'A-Z])"
)

# Word normaliser: keep letters, digits, apostrophes, hyphens
WORD_CHARS_RE = re.compile(r"[A-Za-z0-9']+(?:-[A-Za-z0-9']+)*")


def normalise_word(word: str) -> str:
    word = word.lower().strip()
    word = word.replace("’", "'")
    word = word.strip("'\"-.,!?;:()")
    return word


def clean_paragraph(text: str) -> str:
    out = text
    for pat, repl in STRIP_PATTERNS:
        out = pat.sub(repl, out)
    return out.strip()


def split_sentences(paragraph_text: str) -> list[str]:
    cleaned = clean_paragraph(paragraph_text)
    if not cleaned:
        return []
    raw = [s.strip() for s in SENTENCE_SPLIT_RE.split(cleaned) if s.strip()]
    return raw


def words_of(sentence: str) -> list[str]:
    return [normalise_word(m.group(0)) for m in WORD_CHARS_RE.finditer(sentence) if normalise_word(m.group(0))]


def parse_script(path: Path) -> dict:
    text = path.read_text()

    paragraphs: list[dict] = []
    sentences: list[dict] = []

    current_id: str | None = None
    current_rhythm: str | None = None
    buffer: list[str] = []

    def flush():
        nonlocal current_id, current_rhythm, buffer
        if current_id is None:
            buffer = []
            return
        body = "\n".join(buffer).strip()
        sentence_texts = split_sentences(body)
        sentence_ids: list[str] = []
        for idx, sent in enumerate(sentence_texts, start=1):
            sid = f"{current_id.lower()}_s{idx}"
            words = words_of(sent)
            if not words:
                continue
            sentence_ids.append(sid)
            sentences.append({
                "id": sid,
                "paragraph": current_id,
                "rhythm": current_rhythm,
                "text": sent,
                "words": words,
            })
        paragraphs.append({
            "id": current_id,
            "rhythm": current_rhythm,
            "sentences": sentence_ids,
        })
        buffer = []

    in_script = False
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        # The script body begins at the first --- divider and ends at the next one
        if line.strip() == "---":
            if not in_script:
                in_script = True
                continue
            flush()
            current_id = None
            current_rhythm = None
            in_script = False  # stop processing body after the second ---
            # But the script has multiple sections; keep going for chapter headers
            in_script = True
            continue
        if not in_script:
            continue
        if line.startswith("## "):
            # Chapter heading — flush current paragraph, then ignore
            flush()
            current_id = None
            current_rhythm = None
            continue
        if line.startswith("## Audit"):
            # Hit the audit section; we are done with the script body
            flush()
            break
        m = PARAGRAPH_HEADER_RE.match(line)
        if m:
            flush()
            current_id = f"P{m.group(1)}"
            current_rhythm = m.group(2).strip().lower()
            # Normalise the rhythm tag (e.g. "silent → slow" → "silent")
            current_rhythm = re.split(r"[ ,/→]", current_rhythm)[0]
            continue
        # Skip footer-like lines after the body
        if line.startswith("## "):
            flush()
            current_id = None
            continue
        buffer.append(line)

    flush()

    # The audit section may have leaked in if the second --- wasn't detected;
    # filter to P1..P39
    valid_paragraphs = [p for p in paragraphs if p["id"] and p["id"].startswith("P")]

    return {
        "paragraphs": valid_paragraphs,
        "sentences": sentences,
    }


def main() -> int:
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <script.md> <output.json>", file=sys.stderr)
        return 2

    script_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    parsed = parse_script(script_path)

    out_path.write_text(json.dumps(parsed, indent=2))
    print(
        f"Parsed {len(parsed['paragraphs'])} paragraphs, "
        f"{len(parsed['sentences'])} sentences, "
        f"{sum(len(s['words']) for s in parsed['sentences'])} words → {out_path}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
