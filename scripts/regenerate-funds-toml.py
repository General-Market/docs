#!/usr/bin/env python3
"""Rebuild vision-bot/funds.toml against the new VisionVaultFactory.

Old funds.toml has 666 named funds (Sterling, Threadneedle, ...) bound to
vault addresses on the OLD factory. The redeploy created a new factory with
235 vaults at fresh addresses. Mapping old → new is positional within each
source: the first old fund for source X gets new_vault[0] for X, second gets
new_vault[1], etc. Old funds beyond index 4 (since 5 vaults per source) get
dropped — the new layout is 5-per-source by design.

Reads:
  - vision-bot/funds.toml (source → ordered fund list with metadata)
  - scripts/vault-deploy-receipt.json (source → 5 new vault addresses)
  - deployments/active-deployment.json (factory + Vision + USDC + registry)

Writes:
  - vision-bot/funds.toml (in place; old version backed up)
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

try:
    import tomllib  # 3.11+
except ImportError:
    import tomli as tomllib  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
TOML_PATH = ROOT / "vision-bot" / "funds.toml"
# Use envs/testnet/active-deployment.json for sourceVaults — it's the merged
# 73-source map. The scripts/vault-deploy-receipt.json gets overwritten by
# each --sources subset run and only reflects the last batch.
DEPLOY_PATH = ROOT / "envs" / "testnet" / "active-deployment.json"


def main() -> int:
    with open(TOML_PATH, "rb") as f:
        old = tomllib.load(f)
    with open(DEPLOY_PATH) as f:
        deploy = json.load(f)

    new_vaults_by_source: dict[str, list[str]] = deploy["sourceVaults"]
    contracts = deploy["contracts"]
    factory_new = contracts.get("VisionVaultFactory") or contracts.get("visionVaultFactory")
    vision_new = contracts["Vision"]
    usdc_new = contracts.get("L3_WUSDC") or contracts["USDC"]
    registry_new = contracts["OracleRegistry"]

    funds_old: list[dict] = old.get("funds", [])

    # Group by primary source. Multi-source funds keyed by first source.
    by_source: dict[str, list[dict]] = {}
    for f in funds_old:
        sources = f.get("sources", [])
        if not sources:
            continue
        by_source.setdefault(sources[0], []).append(f)

    # Reassign vault addresses positionally.
    funds_new: list[dict] = []
    skipped_unknown_source = 0
    for source, funds_list in by_source.items():
        new_vaults = new_vaults_by_source.get(source, [])
        if not new_vaults:
            skipped_unknown_source += len(funds_list)
            continue
        for i, fund in enumerate(funds_list):
            if i >= len(new_vaults):
                break  # we have fewer new vaults than old funds for this source
            updated = dict(fund)
            updated["vault"] = new_vaults[i]
            funds_new.append(updated)

    # Sources in receipt but not in old funds.toml — give each a default
    # momentum fund so every new vault gets exercised.
    extra_funds = 0
    used_new_vaults = {f["vault"] for f in funds_new}
    for source, vaults in new_vaults_by_source.items():
        for idx, vault in enumerate(vaults):
            if vault in used_new_vaults:
                continue
            funds_new.append({
                "name": f"{source.capitalize()} {idx+1}",
                "symbol": f"{source.upper()[:6]}{idx+1}",
                "vault": vault,
                "sources": [source],
                "strategy": "momentum",
                "params": {},
            })
            extra_funds += 1

    print(f"Funds carried forward (positional remap): {len(funds_new) - extra_funds}")
    print(f"Default funds appended for new-only sources: {extra_funds}")
    print(f"Old funds skipped (source missing from receipt): {skipped_unknown_source}")
    print(f"Total funds in new toml: {len(funds_new)}")

    # Backup
    backup = TOML_PATH.with_suffix(".toml.bak.preredeploy")
    if not backup.exists():
        shutil.copy2(TOML_PATH, backup)
        print(f"Backed up to {backup}")

    # Write new toml. Preserve original [manager] block but with updated
    # addresses, then dump the funds list.
    manager = dict(old.get("manager", {}))
    manager["factory"] = factory_new
    manager["vision_address"] = vision_new
    manager["usdc_address"] = usdc_new
    manager["oracle_registry_address"] = registry_new

    with open(TOML_PATH, "w") as f:
        f.write("[manager]\n")
        for k, v in manager.items():
            if isinstance(v, str):
                f.write(f'{k} = "{v}"\n')
            elif isinstance(v, list):
                items = ", ".join(f'"{x}"' for x in v)
                f.write(f"{k} = [{items}]\n")
            else:
                f.write(f"{k} = {v}\n")
        f.write("\n")

        for fund in funds_new:
            f.write("[[funds]]\n")
            f.write(f'name = "{fund["name"]}"\n')
            f.write(f'symbol = "{fund["symbol"]}"\n')
            f.write(f'vault = "{fund["vault"]}"\n')
            srcs = ", ".join(f'"{s}"' for s in fund.get("sources", []))
            f.write(f"sources = [{srcs}]\n")
            f.write(f'strategy = "{fund.get("strategy", "momentum")}"\n')
            params = fund.get("params", {})
            if params:
                f.write("[funds.params]\n")
                for pk, pv in params.items():
                    if isinstance(pv, str):
                        f.write(f'{pk} = "{pv}"\n')
                    elif isinstance(pv, bool):
                        f.write(f"{pk} = {'true' if pv else 'false'}\n")
                    else:
                        f.write(f"{pk} = {pv}\n")
            else:
                f.write("[funds.params]\n")
            f.write("\n")

    print(f"Wrote {TOML_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
