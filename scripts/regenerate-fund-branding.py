#!/usr/bin/env python3
"""Rewire frontend/data/fund-branding.json against the new VisionVaultFactory.

Positional remap by source: the first fund-branding entry for source X gets
new_vault[0] for X, second gets new_vault[1], etc. Old funds beyond what the
new layout supports (5 per source) are dropped. Sources without a prior
brand keep nothing — pure remap, no synthesised branding.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRANDING_PATH = ROOT / "frontend" / "data" / "fund-branding.json"
# active-deployment.json's sourceVaults is the merged source-of-truth (73
# sources after the second deploy round). The receipt-only file lags behind
# the script that just rewrites it on each invocation.
DEPLOYMENT_PATH = ROOT / "envs" / "testnet" / "active-deployment.json"


def main() -> int:
    with open(BRANDING_PATH) as f:
        data = json.load(f)
    funds = data["funds"]

    with open(DEPLOYMENT_PATH) as f:
        deployment = json.load(f)
    new_vaults_by_source: dict[str, list[str]] = deployment["sourceVaults"]

    # Source renames: data-node retired some legacy aliases (defillama→defi, etc).
    # The frontend URL slug is the original name (matches sources-display.json),
    # so we keep `fund.source` as the user-facing name AND also use it to look
    # up vaults via the alias map.
    alias = {
        "defillama": "defi",
        "finra": "finra_short_vol",
        "sec": "sec_13f",
    }

    by_source: dict[str, list[dict]] = {}
    for fund in funds:
        src = fund.get("source")
        if not src:
            continue
        # Keep fund.source as-is (frontend reads it for URL matching).
        # Use the aliased name only as the vault-map key.
        by_source.setdefault(src, []).append(fund)

    # Build a lookup that handles aliases: when we ask for "defillama",
    # check both that key and "defi".
    def vaults_for(src: str) -> list[str]:
        if src in new_vaults_by_source:
            return new_vaults_by_source[src]
        if src in alias and alias[src] in new_vaults_by_source:
            return new_vaults_by_source[alias[src]]
        return []

    new_funds: list[dict] = []
    dropped_no_source = 0
    dropped_overflow = 0
    for source, fund_list in by_source.items():
        new_vaults = vaults_for(source)
        if not new_vaults:
            dropped_no_source += len(fund_list)
            continue
        for i, fund in enumerate(fund_list):
            if i >= len(new_vaults):
                dropped_overflow += 1
                continue
            updated = dict(fund)
            updated["vault"] = new_vaults[i]
            new_funds.append(updated)

    backup = BRANDING_PATH.with_suffix(".json.bak.preredeploy")
    if not backup.exists():
        shutil.copy2(BRANDING_PATH, backup)
        print(f"Backed up to {backup}")

    with open(BRANDING_PATH, "w") as f:
        json.dump({"funds": new_funds}, f, indent=2)

    print(f"Funds remapped: {len(new_funds)}")
    print(f"Funds dropped (source missing from receipt): {dropped_no_source}")
    print(f"Funds dropped (overflow past 5/source): {dropped_overflow}")
    print(f"Wrote {BRANDING_PATH}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
