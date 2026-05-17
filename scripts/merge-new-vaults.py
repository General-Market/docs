#!/usr/bin/env python3
"""Merge new-vault-addresses.json into fund-branding.json and funds.toml.

Symbol-keyed merge (not positional). Backs up both files to *.bak.<ts>.
Writes deployments/vault-redeploy-<date>.json with full old→new mapping.

The factory + Vision + USDC + OracleRegistry in funds.toml are left as-is
since this redeploy reuses the live factory (no contract redeploy, just
new vault clones under it).
"""
from __future__ import annotations

import datetime as dt
import json
import re
import shutil
import sys
from pathlib import Path

try:
    import tomllib
except ImportError:
    import tomli as tomllib  # type: ignore

import os

ROOT = Path(__file__).resolve().parent.parent
BRANDING = ROOT / "frontend" / "data" / "fund-branding.json"
TOML = ROOT / "vision-bot" / "funds.toml"
ADDR_FILE = os.environ.get("ADDR_FILE", "new-vault-addresses-2026-05-18.json")
FUNDED_FILE = os.environ.get("FUNDED_FILE", "funded-vaults-2026-05-18.json")
NEW_ADDRS = ROOT / "deployments" / ADDR_FILE
FUNDED = ROOT / "deployments" / FUNDED_FILE
REDEPLOY_LOG = ROOT / "deployments" / f"vault-redeploy-{dt.date.today().isoformat()}.json"


def write_toml(path: Path, manager: dict, funds: list[dict]) -> None:
    with open(path, "w") as f:
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
        for fund in funds:
            f.write("[[funds]]\n")
            f.write(f'name = "{fund["name"]}"\n')
            f.write(f'symbol = "{fund["symbol"]}"\n')
            f.write(f'vault = "{fund["vault"]}"\n')
            srcs = ", ".join(f'"{s}"' for s in fund.get("sources", []))
            f.write(f"sources = [{srcs}]\n")
            f.write(f'strategy = "{fund.get("strategy", "momentum")}"\n')
            params = fund.get("params", {}) or {}
            f.write("[funds.params]\n")
            for pk, pv in params.items():
                if isinstance(pv, str):
                    f.write(f'{pk} = "{pv}"\n')
                elif isinstance(pv, bool):
                    f.write(f"{pk} = {'true' if pv else 'false'}\n")
                else:
                    f.write(f"{pk} = {pv}\n")
            f.write("\n")


def main() -> int:
    if not NEW_ADDRS.exists():
        print(f"ERROR: {NEW_ADDRS} not found — run deploy-all-vaults.py first", flush=True)
        return 1

    new = json.loads(NEW_ADDRS.read_text())  # symbol → new address
    funded = json.loads(FUNDED.read_text()) if FUNDED.exists() else {}

    ts = dt.datetime.now().strftime("%Y%m%d-%H%M%S")

    # ── fund-branding.json ──
    branding = json.loads(BRANDING.read_text())
    old_funds = branding["funds"]
    mapping: list[dict] = []
    skipped = 0
    unfunded = 0
    new_funds: list[dict] = []
    for fund in old_funds:
        symbol = fund["symbol"]
        new_vault = new.get(symbol)
        if not new_vault:
            skipped += 1
            continue
        if symbol not in funded:
            unfunded += 1
            # Still rewire to the new vault; the bot will skip a 0-balance vault
            # but its address is at least valid for the frontend listing.
        old_vault = fund.get("vault")
        mapping.append({
            "symbol": symbol,
            "name": fund["name"],
            "old_vault": old_vault,
            "new_vault": new_vault,
            "funded": symbol in funded,
        })
        updated = dict(fund)
        updated["vault"] = new_vault
        new_funds.append(updated)

    bkup_branding = BRANDING.with_name(f"fund-branding.json.bak.{ts}")
    shutil.copy2(BRANDING, bkup_branding)
    BRANDING.write_text(json.dumps({"funds": new_funds}, indent=2) + "\n")
    print(f"fund-branding.json: {len(new_funds)} funds rewired (skipped {skipped} without new vault, {unfunded} unfunded but still rewired)", flush=True)
    print(f"  backup: {bkup_branding.name}", flush=True)

    # ── vision-bot/funds.toml ──
    # Drive directly from fund-branding.json (the authoritative catalogue).
    # Preserve [manager] block from the old toml. Normalize strategy names
    # that drift from the bot's registered set.
    with open(TOML, "rb") as f:
        toml_data = tomllib.load(f)
    manager = dict(toml_data.get("manager", {}))

    STRATEGY_ALIASES = {
        "mean-reversion": "mean_reversion",
        "reversion": "mean_reversion",
        "threshold": "momentum_threshold",
    }
    REGISTERED = {
        "bullish", "bearish", "cluster", "adoption_curve", "contrarian",
        "mean_reversion", "home_field", "momentum", "momentum_noise",
        "momentum_threshold", "regime", "random", "polymarket_consensus",
        "polymarket_extreme_fade", "time_of_day", "volatility_fade",
    }

    toml_new: list[dict] = []
    strategy_fixes = 0
    for fund in new_funds:  # iterate the freshly rewired branding list
        symbol = fund["symbol"]
        strategy = fund.get("strategy", "momentum")
        if strategy in STRATEGY_ALIASES:
            strategy = STRATEGY_ALIASES[strategy]
            strategy_fixes += 1
        if strategy not in REGISTERED:
            print(f"  WARN: {symbol} has unknown strategy {strategy!r} — defaulting to momentum", flush=True)
            strategy = "momentum"
            strategy_fixes += 1
        source = fund.get("source") or ""
        sources = [source] if source else []
        toml_new.append({
            "name": fund["name"],
            "symbol": symbol,
            "vault": fund["vault"],
            "sources": sources,
            "strategy": strategy,
            "params": fund.get("params") or {},
        })

    bkup_toml = TOML.with_name(f"funds.toml.bak.{ts}")
    shutil.copy2(TOML, bkup_toml)
    write_toml(TOML, manager, toml_new)
    print(f"funds.toml: {len(toml_new)} funds rewired from fund-branding.json (strategy normalizations: {strategy_fixes})", flush=True)
    print(f"  backup: {bkup_toml.name}", flush=True)

    # ── forensic log ──
    REDEPLOY_LOG.write_text(json.dumps({
        "timestamp": dt.datetime.now().isoformat(),
        "factory": manager.get("factory"),
        "vision": manager.get("vision_address"),
        "usdc": manager.get("usdc_address"),
        "deposit_per_vault": "1000 USDC (18-dec)",
        "funded_count": len(funded),
        "mapping": mapping,
    }, indent=2))
    print(f"forensic log: {REDEPLOY_LOG.name} ({len(mapping)} entries)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
