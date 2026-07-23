#!/usr/bin/env python3
"""Pull the 12 source chart images out of the session JSONL and write them to public/source-charts/."""
import base64
import json
import sys
from pathlib import Path

SESSION = Path(
    "/Users/maxguillabert/.claude/projects/"
    "-Users-maxguillabert-Downloads-index/"
    "f3670f14-3ad5-40a2-b32f-351ec05be8d1.jsonl"
)
OUT = Path(__file__).resolve().parent.parent / "public" / "source-charts"
OUT.mkdir(parents=True, exist_ok=True)


def main():
    with SESSION.open() as f:
        for line in f:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            msg = row.get("message", row)
            content = msg.get("content", [])
            if not isinstance(content, list):
                continue
            imgs = [c for c in content if isinstance(c, dict) and c.get("type") == "image"]
            if len(imgs) == 12 and msg.get("role") == "user":
                for i, c in enumerate(imgs, start=1):
                    src = c.get("source", {})
                    if src.get("type") != "base64":
                        print(f"skip {i}: source type {src.get('type')}", file=sys.stderr)
                        continue
                    data = base64.b64decode(src["data"])
                    out = OUT / f"source-{i:02d}.png"
                    out.write_bytes(data)
                    print(f"wrote {out.relative_to(out.parent.parent.parent)} ({len(data):,} bytes)")
                return
    print("could not find a user message with exactly 12 images", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
