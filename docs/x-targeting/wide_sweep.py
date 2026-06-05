#!/usr/bin/env python3
"""Run broad combined query banks for repeatability discovery.

Rows are TSV:
  query<TAB>types<TAB>note

types = Top | Latest | Both.
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import twapi

ROOT = Path(__file__).resolve().parent


def load_bank(cell: str) -> list[tuple[str, str, str]]:
    path = ROOT / "niches" / cell / "wide_queries.tsv"
    rows: list[tuple[str, str, str]] = []
    for line in path.read_text().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t")
        q = parts[0].strip()
        types = (parts[1].strip() if len(parts) > 1 else "Top") or "Top"
        note = parts[2].strip() if len(parts) > 2 else ""
        rows.append((q, types, note))
    return rows


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: wide_sweep.py CELL [--top-pages N] [--latest-pages N] [--since-days N]", file=sys.stderr)
        sys.exit(1)
    cell = sys.argv[1]
    top_pages = int(sys.argv[sys.argv.index("--top-pages") + 1]) if "--top-pages" in sys.argv else 1
    latest_pages = int(sys.argv[sys.argv.index("--latest-pages") + 1]) if "--latest-pages" in sys.argv else 1
    since_days = int(sys.argv[sys.argv.index("--since-days") + 1]) if "--since-days" in sys.argv else 60
    since = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%Y-%m-%d")

    bank = load_bank(cell)
    print(f"[{cell}] {len(bank)} wide queries since:{since}", file=sys.stderr)
    for i, (q, types, note) in enumerate(bank, 1):
        query = f"{q} since:{since}"
        print(f"[{cell}] {i}/{len(bank)} {types} {note}: {q}", file=sys.stderr)
        if types in ("Top", "Both"):
            twapi.cmd_advsearch(query, "Top", cell=cell, pages=top_pages)
        if types in ("Latest", "Both"):
            twapi.cmd_advsearch(query, "Latest", cell=cell, pages=latest_pages)


if __name__ == "__main__":
    main()
