#!/usr/bin/env python3
"""
Deploy MockERC20 tokens for ALL Bitget USDC+USDT pairs.
Generates a forge script, runs it, and updates data/symbol-map.json.

Usage:
    python3 scripts/deploy-all-bitget-tokens.py
"""

import json
import os
import subprocess
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTRACTS_DIR = os.path.join(ROOT, "contracts")
DATA_DIR = os.path.join(ROOT, "data")
SYMBOL_MAP_PATH = os.path.join(DATA_DIR, "symbol-map.json")
ALL_PAIRS_PATH = os.path.join(DATA_DIR, "bitget-all-pairs.json")
FOUNDRY_BIN = os.path.expanduser("~/.foundry/bin")
DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
BATCH_SIZE = 80  # tokens per forge script call (avoid gas/stack limits)
FORGE_TIMEOUT = 600  # seconds per batch (80 deploys can be slow on Anvil)

def _parse_rpc_url():
    """Parse --rpc-url from CLI args, fall back to RPC_URL env, then default."""
    for i, arg in enumerate(sys.argv):
        if arg == "--rpc-url" and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return os.environ.get("RPC_URL", "http://localhost:8545")

RPC_URL = _parse_rpc_url()

def load_existing_map():
    if os.path.exists(SYMBOL_MAP_PATH):
        with open(SYMBOL_MAP_PATH) as f:
            return json.load(f)
    return {}

def fetch_bitget_pairs():
    """Fetch all USDC+USDT pairs from Bitget API and save to file."""
    print("  Fetching live pairs from Bitget API...")
    url = "https://api.bitget.com/api/v2/spot/market/tickers"
    req = urllib.request.Request(url, headers={"User-Agent": "IndexL3/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
    tickers = data.get("data", [])
    pairs = sorted(
        t["symbol"] for t in tickers
        if (t["symbol"].endswith("USDC") or t["symbol"].endswith("USDT"))
        and float(t.get("usdtVolume") or "0") > 0
    )
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(ALL_PAIRS_PATH, "w") as f:
        json.dump(pairs, f, indent=2)
    print(f"  Found {len(pairs)} USDC+USDT pairs")
    return pairs

def load_all_pairs():
    """Always fetch fresh from Bitget API (volume filter requires live data)."""
    return fetch_bitget_pairs()

def find_new_pairs(existing_map, all_pairs):
    existing_symbols = set()
    for v in existing_map.values():
        if isinstance(v, dict):
            existing_symbols.add(v.get("pair", ""))
        else:
            existing_symbols.add(v)
    return [p for p in all_pairs if p not in existing_symbols]

def generate_forge_script(pairs, script_path):
    """Generate a Solidity script that deploys MockERC20 for each pair."""
    lines = [
        '// SPDX-License-Identifier: MIT',
        'pragma solidity ^0.8.20;',
        '',
        'import "forge-std/Script.sol";',
        'import "../src/mocks/MockERC20.sol";',
        '',
        'contract BatchDeploy is Script {',
        '    function run() external {',
        f'        uint256 key = {DEPLOYER_KEY.replace("0x", "0x")};',
        '        vm.startBroadcast(key);',
    ]

    for symbol in pairs:
        # Derive a readable name: BTCUSDT -> Mock BTC
        base = symbol.replace("USDC", "").replace("USDT", "")
        name = f"Mock {base}"
        lines.append(f'        {{ MockERC20 t = new MockERC20("{name}", "{symbol}", 18); console.log("{symbol}", address(t)); }}')

    lines += [
        '        vm.stopBroadcast();',
        '    }',
        '}',
    ]

    with open(script_path, 'w') as f:
        f.write('\n'.join(lines) + '\n')

def run_forge_script(script_path):
    """Run a forge script and capture deployed addresses from console.log output."""
    env = os.environ.copy()
    env["PATH"] = f"{FOUNDRY_BIN}:{env.get('PATH', '')}"

    result = subprocess.run(
        [
            "forge", "script", script_path,
            "--rpc-url", RPC_URL,
            "--broadcast",
        ],
        capture_output=True,
        text=True,
        cwd=CONTRACTS_DIR,
        env=env,
        timeout=FORGE_TIMEOUT,
    )

    if result.returncode != 0:
        print(f"STDERR: {result.stderr[-2000:]}", file=sys.stderr)
        raise RuntimeError(f"Forge script failed with exit code {result.returncode}")

    # Parse addresses from console.log output
    # Format: "  BTCUSDT 0x1234...abcd"
    addresses = {}
    for line in result.stderr.split('\n') + result.stdout.split('\n'):
        # Match lines like: "  SYMBOL 0xADDRESS"
        m = re.search(r'\s+(\w+USDC|\w+USDT)\s+(0x[0-9a-fA-F]{40})', line)
        if m:
            symbol = m.group(1)
            addr = m.group(2).lower()
            addresses[addr] = symbol

    return addresses

def main():
    print("=== Batch Deploy All Bitget Tokens ===")

    existing = load_existing_map()
    all_pairs = load_all_pairs()
    new_pairs = find_new_pairs(existing, all_pairs)

    print(f"Existing tokens: {len(existing)}")
    print(f"All Bitget pairs: {len(all_pairs)}")
    print(f"New to deploy: {len(new_pairs)}")

    if not new_pairs:
        print("Nothing to deploy!")
        return

    # Deploy in batches
    all_deployed = {}
    batches = [new_pairs[i:i+BATCH_SIZE] for i in range(0, len(new_pairs), BATCH_SIZE)]

    for batch_idx, batch in enumerate(batches):
        print(f"\n--- Batch {batch_idx + 1}/{len(batches)} ({len(batch)} tokens) ---")
        script_path = os.path.join(CONTRACTS_DIR, "script", f"_batch_{batch_idx}.s.sol")
        try:
            generate_forge_script(batch, script_path)
            addresses = run_forge_script(script_path)
            all_deployed.update(addresses)
            print(f"  Deployed: {len(addresses)} tokens")
        finally:
            # Clean up temp script
            if os.path.exists(script_path):
                os.remove(script_path)

    print(f"\nTotal newly deployed: {len(all_deployed)}")

    # Merge with existing map (use dict format for consistency)
    merged = dict(existing)
    for addr, symbol in all_deployed.items():
        merged[addr] = {"pair": symbol, "source": "bitget"}

    # Save updated symbol map
    with open(SYMBOL_MAP_PATH, 'w') as f:
        json.dump(merged, f, indent=2)
    print(f"Updated {SYMBOL_MAP_PATH}: {len(merged)} entries")

    # Also save the full deployment record
    record_path = os.path.join(DATA_DIR, "deployed-tokens-all.json")
    with open(record_path, 'w') as f:
        json.dump(all_deployed, f, indent=2)
    print(f"Deployment record: {record_path}")

    # Write frontend/public/deployed-assets.json for CreateItpSection dynamic loading
    deployed_assets = []
    def _get_pair(v):
        return v.get("pair", "") if isinstance(v, dict) else v
    for addr, val in sorted(merged.items(), key=lambda x: _get_pair(x[1])):
        symbol = _get_pair(val)
        base = symbol.replace("USDC", "").replace("USDT", "")
        deployed_assets.append({"address": addr, "symbol": base})
    frontend_path = os.path.join(ROOT, "frontend", "public", "deployed-assets.json")
    os.makedirs(os.path.dirname(frontend_path), exist_ok=True)
    with open(frontend_path, 'w') as f:
        json.dump(deployed_assets, f, indent=2)
    print(f"Frontend assets: {frontend_path} ({len(deployed_assets)} entries)")

if __name__ == "__main__":
    main()
