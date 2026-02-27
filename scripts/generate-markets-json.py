#!/usr/bin/env python3
"""Generate vision-bot/markets.json from frontend/lib/vision/sources.ts."""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

SOURCES_TS = Path(__file__).resolve().parent.parent / "frontend" / "lib" / "vision" / "sources.ts"
OUTPUT = Path(__file__).resolve().parent.parent / "vision-bot" / "markets.json"


def parse_sources() -> list[dict]:
    """Extract VISION_SOURCES array entries from TypeScript source."""
    text = SOURCES_TS.read_text()

    # Match each { ... } object inside VISION_SOURCES array
    pattern = re.compile(
        r"\{\s*"
        r"id:\s*'([^']+)'\s*,\s*"
        r"name:\s*'([^']+)'\s*,\s*"
        r"description:\s*'([^']+)'\s*,\s*"
        r"category:\s*'([^']+)'\s*,\s*"
        r"logo:\s*'[^']*'\s*,\s*"
        r"brandBg:\s*(?:'[^']*'|\"[^\"]*\")\s*,\s*"
        r"prefixes:\s*\[([^\]]*)\]",
        re.DOTALL,
    )

    sources = []
    for m in pattern.finditer(text):
        prefixes_raw = m.group(5)
        prefixes = re.findall(r"'([^']+)'", prefixes_raw)
        sources.append({
            "id": m.group(1),
            "name": m.group(2),
            "category": m.group(4),
            "prefixes": prefixes,
            "description": m.group(3),
        })
    return sources


def main():
    sources = parse_sources()
    categories = sorted(set(s["category"] for s in sources))

    output = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_sources": len(sources),
        "categories": categories,
        "sources": sources,
    }

    OUTPUT.write_text(json.dumps(output, indent=2) + "\n")
    print(f"Wrote {len(sources)} sources to {OUTPUT}")


if __name__ == "__main__":
    main()
