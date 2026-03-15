#!/usr/bin/env python3
"""Sync fresh on-chain token addresses from DeployAllTokens output into assets.json and deployed-assets.json."""

import json
import re

syms = json.load(open("data/all-token-symbols.json"))

# Read CSV: index,address
addr_by_idx = {}
for line in open("data/all-token-addresses.csv"):
    line = line.strip()
    if not line:
        continue
    idx, addr = line.split(",", 1)
    addr_by_idx[int(idx)] = addr

# Build symbol -> address
sym_to_addr = {sym: addr_by_idx[idx] for sym, idx in syms.items() if idx in addr_by_idx}

# Update assets.json
assets = json.load(open("assets.json"))
for a in assets:
    sym = re.sub(r"(USDT|USDC)$", "", a["bitget"])
    if sym in sym_to_addr:
        a["address"] = sym_to_addr[sym]
with open("assets.json", "w") as f:
    json.dump(assets, f, indent=2)

# Update deployed-assets.json
deployed = [{"address": sym_to_addr[sym], "symbol": sym} for sym in sorted(sym_to_addr)]
with open("frontend/public/deployed-assets.json", "w") as f:
    json.dump(deployed, f, indent=2)

print(f"Updated {len(sym_to_addr)} addresses in assets.json + deployed-assets.json")
