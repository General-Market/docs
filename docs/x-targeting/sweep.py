#!/usr/bin/env python3
"""Run a cell's query bank through twapi advsearch with explicit time windows.

Usage:
  sweep.py CELL --validate
  sweep.py CELL
  sweep.py CELL --since YYYY-MM-DD

Reads niches/CELL/queries.tsv with columns:
  query<TAB>types<TAB>note
where types is Top, Latest, or Both.
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import twapi

ROOT = Path(__file__).resolve().parent


def load_bank(cell: str) -> list[tuple[str, str, str]]:
    path = ROOT / "niches" / cell / "queries.tsv"
    rows = []
    for line in path.read_text().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t")
        q = parts[0].strip()
        types = (parts[1].strip() if len(parts) > 1 else "Both") or "Both"
        note = parts[2].strip() if len(parts) > 2 else ""
        rows.append((q, types, note))
    return rows


def main():
    cell = sys.argv[1]
    validate = "--validate" in sys.argv
    since_override = None
    if "--since" in sys.argv:
        since_override = sys.argv[sys.argv.index("--since") + 1]
    today = datetime.now(timezone.utc)
    since_top = since_override or (today - timedelta(days=30)).strftime("%Y-%m-%d")
    since_latest = since_override or (today - timedelta(days=7)).strftime("%Y-%m-%d")
    bank = load_bank(cell)
    print(f"[{cell}] {len(bank)} queries, validate={validate}", file=sys.stderr)
    for i, (q, types, note) in enumerate(bank):
        if validate:
            twapi.cmd_advsearch(f"{q} since:{since_latest}", "Latest", cell=f"{cell}", pages=1)
            continue
        if types in ("Top", "Both"):
            twapi.cmd_advsearch(f"{q} since:{since_top}", "Top", cell=cell, pages=3)
        if types in ("Latest", "Both"):
            twapi.cmd_advsearch(f"{q} since:{since_latest}", "Latest", cell=cell, pages=1)
        if i % 5 == 4:
            spent = twapi.project_spent_credits()
            print(f"  [budget] project spent ${spent/100000:.2f}", file=sys.stderr)


if __name__ == "__main__":
    main()
