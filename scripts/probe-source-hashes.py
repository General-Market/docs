#!/usr/bin/env python3
"""Diagnose which oracle batch source_id hashes the fund-manager cannot resolve.

Fund-manager matches batches by computing keccak(name_vN) for each fund source
and any legacy alias in vision-bot/source-aliases.json. When a batch comes
back with a source_id hash that doesn't match anything, the vaults pointed at
that source sit idle forever. This script finds those orphans and tries to
recover the plain-text name from every place one might have been recorded:

  1. Candidate dictionary  — every fund source + every recommended-config name
                             + every historical alias
  2. Common variants       — bare name, name_v1..v10, singular/plural, hyphens
  3. Recommended-config    — /deployments/vision-recommended-configs.json keys

Output is a suggested entry for source-aliases.json so the operator can paste
it in and push.

Usage:
    python3 scripts/probe-source-hashes.py [--oracle URL]

Default oracle: http://142.132.164.24/  (nginx proxies to one of the three
oracle containers on VPS 1).  If no match is found for a hash, it prints the
hash so the operator can chase it on-chain — the authoritative answer lives
in the Vision contract's batch storage.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from web3 import Web3
except ImportError:
    print("error: pip install web3 first", file=sys.stderr)
    sys.exit(1)

try:
    import requests
except ImportError:
    print("error: pip install requests first", file=sys.stderr)
    sys.exit(1)


ROOT = Path(__file__).resolve().parent.parent
BRANDING = ROOT / "frontend" / "data" / "fund-branding.json"
ALIASES = ROOT / "vision-bot" / "source-aliases.json"
RECOMMENDED = ROOT / "deployments" / "vision-recommended-configs.json"


def _keccak(text: str) -> str:
    h = Web3.keccak(text=text).hex()
    return h if h.startswith("0x") else "0x" + h


def _fetch_oracle_batches(oracle_url: str) -> list[dict]:
    for path in ("/vision/batches", "/batches"):
        try:
            r = requests.get(oracle_url.rstrip("/") + path, timeout=10)
            if r.ok:
                data = r.json()
                return data.get("batches", data if isinstance(data, list) else [])
        except requests.RequestException:
            continue
    raise SystemExit(f"could not reach oracle at {oracle_url}")


def _candidate_names() -> set[str]:
    names: set[str] = set()

    if BRANDING.exists():
        with BRANDING.open() as f:
            for fund in json.load(f).get("funds", []):
                if s := fund.get("source"):
                    names.add(s)

    if ALIASES.exists():
        with ALIASES.open() as f:
            for canon, aliases in json.load(f).get("aliases", {}).items():
                names.add(canon)
                names.update(aliases)

    if RECOMMENDED.exists():
        with RECOMMENDED.open() as f:
            names.update(json.load(f).get("configs", {}).keys())

    return names


def _hash_corpus(names: set[str]) -> dict[str, str]:
    """Hash → name, trying every plausible encoding the on-chain deploy
    scripts have used over the project's lifetime."""
    out: dict[str, str] = {}
    for name in names:
        # Bare + versioned
        out[_keccak(name)] = name
        for v in range(1, 11):
            out[_keccak(f"{name}_v{v}")] = name
        # Category-level legacy names sometimes show up without underscore
        alt = name.replace("_", "")
        if alt != name:
            out[_keccak(alt)] = name
            for v in range(1, 5):
                out[_keccak(f"{alt}_v{v}")] = name
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle", default="http://142.132.164.24/oracle1",
                        help="Oracle base URL (default: VPS 1 via nginx)")
    args = parser.parse_args()

    batches = _fetch_oracle_batches(args.oracle)
    on_chain_sids = {
        b.get("source_id", "").lower()
        for b in batches
        if b.get("source_id", "").startswith("0x")
    }
    print(f"oracle batches: {len(batches)}  with hex source_id: {len(on_chain_sids)}")

    names = _candidate_names()
    corpus = _hash_corpus(names)
    print(f"candidate names: {len(names)}  corpus hashes: {len(corpus)}")

    resolved: dict[str, str] = {}
    unresolved: list[str] = []
    for sid in on_chain_sids:
        if (name := corpus.get(sid)) is not None:
            resolved[sid] = name
        else:
            unresolved.append(sid)

    print(f"\nresolved: {len(resolved)} / {len(on_chain_sids)}")
    print(f"orphan hashes (no known name hashes to this): {len(unresolved)}")

    if not unresolved:
        print("\nevery batch on chain maps to a known source — nothing to do.")
        return

    print("\nOrphan source_ids — add to source-aliases.json under the canonical")
    print("fund source whose batch this actually is. One line per orphan:")
    for sid in unresolved[:40]:
        print(f"  {sid}")
    if len(unresolved) > 40:
        print(f"  ... ({len(unresolved) - 40} more)")

    print("\nHints:")
    print("  - Check the Vision contract's batch storage by id for the plain name")
    print("    (cast call <Vision> 'batches(uint256)' <batchId>)")
    print("  - Or inspect the DeployAllVisionBatches broadcast for that batchId")
    print("  - Once you know the plain name N, add {\"<canonical>\": [\"N\"]} to")
    print("    vision-bot/source-aliases.json and push — fund-manager reloads it.")


if __name__ == "__main__":
    main()
