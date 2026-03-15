#!/usr/bin/env python3
"""Generate itp-bot/manifest.json from docs/itp-ideas.md."""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
ITP_IDEAS = ROOT / "docs" / "itp-ideas.md"
OUTPUT = ROOT / "itp-bot" / "manifest.json"


def parse_itp_ideas(md_path: str) -> list[dict]:
    with open(md_path) as f:
        content = f.read()

    itps = []
    current_section = ""

    section_re = re.compile(r'^## \d+\.\s+(.+)$', re.MULTILINE)
    itp_re = re.compile(r'^### (\d+)\.\s+(.+?)\s+\((\w+)\)\s*$', re.MULTILINE)
    thesis_re = re.compile(r'^\*\*Thesis:\*\*\s+(.+)$', re.MULTILINE)
    config_re = re.compile(
        r'^\*\*Config:\*\*\s+`([^`]+)`\s*\|\s*top\s+`(\d+)`\s*\|\s*`([^`]+)`\s*\|\s*rebalance\s+`(\d+)d`',
        re.MULTILINE,
    )
    overlay_re = re.compile(r'^\*\*Overlays?:\*\*\s+(.+)$', re.MULTILINE)

    lines = content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]

        sm = section_re.match(line)
        if sm:
            current_section = sm.group(1).strip()
            i += 1
            continue

        im = itp_re.match(line)
        if im:
            itp_num = int(im.group(1))
            name = im.group(2).strip()
            ticker = im.group(3).strip()

            thesis = ""
            config = None
            overlays = {}

            for j in range(i + 1, min(i + 8, len(lines))):
                tl = lines[j]
                if tl.startswith('### ') or tl.startswith('## '):
                    break

                tm = thesis_re.match(tl)
                if tm:
                    thesis = tm.group(1).strip()

                cm = config_re.match(tl)
                if cm:
                    config = {
                        "category_id": cm.group(1),
                        "top_n": int(cm.group(2)),
                        "weighting": cm.group(3),
                        "rebalance_days": int(cm.group(4)),
                    }

                om = overlay_re.match(tl)
                if om:
                    for pair in re.findall(r'(\w+)=([^\s,]+)', om.group(1)):
                        overlays[pair[0]] = pair[1]

            if config:
                itps.append({
                    "id": itp_num,
                    "ticker": ticker,
                    "name": name,
                    "thesis": thesis,
                    "section": current_section,
                    "config": config,
                    "overlays": overlays if overlays else None,
                    "on_chain": {
                        "itp_id": None,
                        "vault_address": None,
                        "deployed_at": None,
                    },
                })

            i += 1
            continue

        i += 1

    return itps


def main():
    itps = parse_itp_ideas(str(ITP_IDEAS))
    print(f"Parsed {len(itps)} ITPs from {ITP_IDEAS}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(itps, f, indent=2)

    print(f"Written to {OUTPUT}")


if __name__ == "__main__":
    main()
