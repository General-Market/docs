#!/usr/bin/env python3
"""Generate virtual token addresses for Bitget pairs (no on-chain deployment)."""

import hashlib, json, os, urllib.request, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
SYMBOL_MAP_PATH = os.path.join(DATA_DIR, "symbol-map.json")

def virtual_address(symbol: str) -> str:
    """Deterministic address: sha256("index-virtual-token:{symbol}")[12:]"""
    h = hashlib.sha256(f"index-virtual-token:{symbol}".encode()).hexdigest()
    return "0x" + h[24:]  # take last 20 bytes (40 hex chars)

def fetch_bitget_pairs() -> list[str]:
    """Fetch all USDC+USDT pairs from Bitget API."""
    url = "https://api.bitget.com/api/v2/spot/market/tickers"
    req = urllib.request.Request(url, headers={"User-Agent": "IndexL3/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
    return sorted(
        t["symbol"] for t in data.get("data", [])
        if (t["symbol"].endswith("USDC") or t["symbol"].endswith("USDT"))
        and float(t.get("usdtVolume") or "0") > 0
    )

def base_symbol(pair: str) -> str:
    for suffix in ("USDC", "USDT"):
        if pair.endswith(suffix):
            return pair[:-len(suffix)]
    return pair

def main():
    print("=== Generate Virtual Token Addresses ===")
    existing = json.load(open(SYMBOL_MAP_PATH)) if os.path.exists(SYMBOL_MAP_PATH) else {}

    all_pairs = fetch_bitget_pairs()

    # Deduplicate: one address per base symbol, prefer USDC
    existing_bases = set()
    for v in existing.values():
        pair = v.get("pair", "") if isinstance(v, dict) else v
        existing_bases.add(base_symbol(pair))
    seen_bases = set(existing_bases)
    new_count = 0

    for pair in sorted(all_pairs):  # USDC sorts before USDT
        base = base_symbol(pair)
        if base in seen_bases:
            continue
        seen_bases.add(base)
        addr = virtual_address(pair)
        existing[addr] = {"pair": pair, "source": "bitget"}
        new_count += 1

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(SYMBOL_MAP_PATH, "w") as f:
        json.dump(existing, f, indent=2)
    print(f"  {new_count} new virtual addresses, {len(existing)} total in symbol-map.json")

    # Generate frontend/public/deployed-assets.json
    by_sym = {}
    for addr, info in sorted(existing.items()):
        if not isinstance(info, dict):
            continue
        pair = info.get("pair", "")
        sym = base_symbol(pair)
        if sym in by_sym and by_sym[sym]["_pair"].endswith("USDC"):
            continue
        by_sym[sym] = {"address": addr, "symbol": sym, "_pair": pair}
    assets = [{"address": v["address"], "symbol": v["symbol"]}
              for v in sorted(by_sym.values(), key=lambda x: x["symbol"])]
    frontend_path = os.path.join(ROOT, "frontend", "public", "deployed-assets.json")
    os.makedirs(os.path.dirname(frontend_path), exist_ok=True)
    with open(frontend_path, "w") as f:
        json.dump(assets, f, indent=2)
    print(f"  {len(assets)} unique assets in deployed-assets.json")

if __name__ == "__main__":
    main()
