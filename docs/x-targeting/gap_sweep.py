#!/usr/bin/env python3
"""Run a focused paid gap-fill query bank.

Rows are TSV:
  cell<TAB>query<TAB>types<TAB>note

types = Top | Latest | Both.
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import twapi

ROOT = Path(__file__).resolve().parent


def load_bank(path: Path) -> list[tuple[str, str, str, str]]:
    rows: list[tuple[str, str, str, str]] = []
    for line in path.read_text().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            raise ValueError(f"bad row in {path}: {line!r}")
        cell = parts[0].strip()
        query = parts[1].strip()
        types = (parts[2].strip() if len(parts) > 2 else "Top") or "Top"
        note = parts[3].strip() if len(parts) > 3 else ""
        rows.append((cell, query, types, note))
    return rows


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: gap_sweep.py QUERY_FILE [--top-pages N] [--latest-pages N] [--since-days N]", file=sys.stderr)
        sys.exit(1)
    path = Path(sys.argv[1])
    if not path.is_absolute():
        path = ROOT / path
    top_pages = int(sys.argv[sys.argv.index("--top-pages") + 1]) if "--top-pages" in sys.argv else 1
    latest_pages = int(sys.argv[sys.argv.index("--latest-pages") + 1]) if "--latest-pages" in sys.argv else 1
    since_days = int(sys.argv[sys.argv.index("--since-days") + 1]) if "--since-days" in sys.argv else 120
    since = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%Y-%m-%d")

    bank = load_bank(path)
    print(f"[gap] {path.name}: {len(bank)} queries since:{since}", file=sys.stderr)
    for i, (cell, q, types, note) in enumerate(bank, 1):
        query = f"{q} since:{since}"
        print(f"[gap] {path.name} {i}/{len(bank)} {cell} {types} {note}: {q}", file=sys.stderr)
        if types in ("Top", "Both"):
            twapi.cmd_advsearch(query, "Top", cell=cell, pages=top_pages)
        if types in ("Latest", "Both"):
            twapi.cmd_advsearch(query, "Latest", cell=cell, pages=latest_pages)


if __name__ == "__main__":
    main()
