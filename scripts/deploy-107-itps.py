#!/usr/bin/env python3
"""
Generate 2 Solidity forge scripts to deploy all ITPs on Index L3.

Token deployment is handled separately by deploy-all-tokens.py.
This script generates:
  1. Deploy107ITPs_Create.s.sol — Create 96 ITPs
  2. Deploy107ITPs_Vaults.s.sol — Deploy 96 ITP vaults

Also generates:
  - scripts/deploy-107-itps.sh — Shell script to run both in sequence
"""

import json
import os
import urllib.request
from Crypto.Hash import keccak

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST_PATH = os.path.join(REPO_ROOT, "itp-bot/manifest.json")
BACKTEST_PATH = os.path.join(REPO_ROOT, "docs/itp-backtest-results.json")
CREATION_PRICES_PATH = os.path.join(REPO_ROOT, "data/creation-prices.json")
SOL_DIR = os.path.join(REPO_ROOT, "contracts/script")
SHELL_SCRIPT_PATH = os.path.join(REPO_ROOT, "scripts/deploy-107-itps.sh")

MIN_WEIGHT = 25 * 10**14
WEIGHT_SCALE = 10**18


def load_json(path):
    with open(path) as f:
        return json.load(f)


def checksum(address):
    addr = address.lower().replace("0x", "")
    k = keccak.new(digest_bits=256)
    k.update(addr.encode("ascii"))
    h = k.hexdigest()
    return "0x" + "".join(
        c.upper() if int(h[i], 16) >= 8 and c.isalpha() else c
        for i, c in enumerate(addr)
    )


def get_price(symbol, prices):
    for s in ["USDC", "USDT"]:
        k = symbol + s
        if k in prices:
            return k, prices[k]
    return None, None


def normalize_weights(holdings, prices):
    raw = []
    for h in holdings:
        w18 = int(h["weight_pct"] * 1e16)
        pair, pw = get_price(h["symbol"], prices)
        if pair is None or w18 < MIN_WEIGHT:
            continue
        raw.append((h["symbol"], w18, pw, pair))
    if not raw:
        return []
    total = sum(w for _, w, _, _ in raw)
    n = len(raw)
    norm = [[s, max((w * WEIGHT_SCALE) // total, MIN_WEIGHT), p, pr]
            for s, w, p, pr in raw]
    for _ in range(5):
        cs, urs = 0, 0
        for i in range(n):
            if (raw[i][1] * WEIGHT_SCALE) // total < MIN_WEIGHT:
                norm[i][1] = MIN_WEIGHT
                cs += MIN_WEIGHT
            else:
                urs += raw[i][1]
        rem = WEIGHT_SCALE - cs
        if urs > 0 and rem > 0:
            for i in range(n):
                if (raw[i][1] * WEIGHT_SCALE) // total >= MIN_WEIGHT:
                    norm[i][1] = (raw[i][1] * rem) // urs
    diff = WEIGHT_SCALE - sum(w for _, w, _, _ in norm)
    if diff:
        norm[max(range(n), key=lambda i: norm[i][1])][1] += diff
    assert sum(w for _, w, _, _ in norm) == WEIGHT_SCALE
    for s, w, _, _ in norm:
        assert w >= MIN_WEIGHT
    return [(s, w, p, pr) for s, w, p, pr in norm]


# ============================================================
# Script 1: Create ITPs
# ============================================================
def gen_create_script(itps, sym_idx, all_sorted, N):
    L = []
    a = L.append

    a("// SPDX-License-Identifier: MIT")
    a("// AUTO-GENERATED -- DO NOT EDIT")
    a("pragma solidity ^0.8.20;")
    a("")
    a('import "forge-std/Script.sol";')
    a('import "forge-std/console.sol";')
    a('import "../src/core/Investment.sol";')
    a("")
    a(f"/// @title Deploy107ITPs_Create - Create {len(itps)} ITPs")
    a("contract Deploy107ITPs_Create is Script {")
    a(f"    uint256 constant N = {N};")
    a("")

    a("    function run() external {")
    a('        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d));')
    a('        address idx = vm.envAddress("INDEX_ADDRESS");')
    a("")
    a("        // Load token addresses from Phase 1 output")
    a('        string memory csv = vm.readFile("../data/all-token-addresses.csv");')
    a("        address[] memory t = new address[](N);")
    a("        _parseTokens(csv, t);")
    a("")

    BATCH = 6
    batches = [itps[i:i+BATCH] for i in range(0, len(itps), BATCH)]

    a("        // Create ITPs")
    a("        vm.startBroadcast(pk);")
    for bi in range(len(batches)):
        a(f"        _batch{bi}(idx, t);")
    a("        vm.stopBroadcast();")
    a(f'        console.log("Created {len(itps)} ITPs");')
    a("    }")
    a("")

    # Token parser: reads "index,address\n" format
    a("    function _parseTokens(string memory csv, address[] memory t) internal pure {")
    a("        bytes memory b = bytes(csv);")
    a("        uint256 start = 0;")
    a("        for (uint256 i = 0; i < b.length; i++) {")
    a('            if (b[i] == "\\n") {')
    a("                // Parse one line: idx,address")
    a("                uint256 comma = start;")
    a('                while (comma < i && b[comma] != ",") comma++;')
    a("                // Parse index")
    a("                uint256 idx_ = 0;")
    a("                for (uint256 j = start; j < comma; j++) {")
    a("                    idx_ = idx_ * 10 + (uint8(b[j]) - 48);")
    a("                }")
    a("                // Parse address (42 chars: 0x + 40 hex)")
    a("                bytes memory addrBytes = new bytes(42);")
    a("                for (uint256 j = 0; j < 42 && comma + 1 + j < i; j++) {")
    a("                    addrBytes[j] = b[comma + 1 + j];")
    a("                }")
    a("                t[idx_] = vm.parseAddress(string(addrBytes));")
    a("                start = i + 1;")
    a("            }")
    a("        }")
    a("    }")
    a("")

    # Batch functions
    for bi, batch in enumerate(batches):
        a(f"    function _batch{bi}(address idx, address[] memory t) internal {{")
        for ji, itp in enumerate(batch):
            gi = bi * BATCH + ji
            t_ = itp["ticker"]
            n_ = itp["name"].replace('"', '\\"')
            h = itp["holdings"]
            num = len(h)

            a(f"        {{ // {t_} [{num}]")
            a(f"            uint256[] memory w = new uint256[]({num});")
            a(f"            address[] memory a = new address[]({num});")
            a(f"            uint256[] memory p = new uint256[]({num});")
            for hi, (sym, weight, pw, pair) in enumerate(h):
                si = sym_idx[sym]
                a(f"            w[{hi}] = {weight}; a[{hi}] = t[{si}]; p[{hi}] = {pw};")
            a(f'            Investment(idx).createITP("{n_}", "{t_}", w, a, p, type(uint256).max);')
            a("        }")

        a("    }")
        a("")

    a("}")
    return "\n".join(L)


# ============================================================
# Script 2: Deploy Vaults
# ============================================================
def gen_vaults_script(itps):
    L = []
    a = L.append

    a("// SPDX-License-Identifier: MIT")
    a("// AUTO-GENERATED -- DO NOT EDIT")
    a("pragma solidity ^0.8.20;")
    a("")
    a('import "forge-std/Script.sol";')
    a('import "forge-std/console.sol";')
    a('import "../src/core/Investment.sol";')
    a('import "../src/core/ITP.sol";')
    a('import "@openzeppelin/contracts/token/ERC20/IERC20.sol";')
    a("")
    a(f"/// @title Deploy107ITPs_Vaults - Deploy {len(itps)} ITP vaults")
    a("contract Deploy107ITPs_Vaults is Script {")
    a("")

    a("    function run() external {")
    a('        uint256 ak = vm.envOr("ADMIN_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));')
    a('        address idx = vm.envAddress("INDEX_ADDRESS");')
    a('        IERC20 wusdc = IERC20(vm.envAddress("L3_WUSDC"));')
    a("")

    # ITP IDs are sequential: 0x02, 0x03, ... (0x01 is the existing 100-asset ITP)
    # Actually, we don't know the ITP IDs ahead of time. They depend on contract state.
    # Need to read from the contract: getITPCount() or enumerate.
    # Better approach: read ITP IDs from Investment contract.
    a("        // Read ITP count to find our starting ID")
    a("        // ITP IDs are assigned sequentially. We need IDs for ITPs 2..97")
    a("        // (ITP 1 is the existing 100-asset ITP)")
    a("        vm.startBroadcast(ak);")

    BATCH = 12
    batches = [itps[i:i+BATCH] for i in range(0, len(itps), BATCH)]

    for bi in range(len(batches)):
        a(f"        _vaultBatch{bi}(idx, wusdc);")

    a("        vm.stopBroadcast();")
    a(f'        console.log("Deployed {len(itps)} vaults");')
    a("    }")
    a("")

    # We need to compute ITP IDs. They're bytes32 from a counter.
    # Looking at createITP: itpId = bytes32(uint256(++_itpCount))
    # So if current ITP count is 1, new ITPs will be 2, 3, 4, ...
    for bi, batch in enumerate(batches):
        a(f"    function _vaultBatch{bi}(address idx, IERC20 wusdc) internal {{")
        for ji, itp in enumerate(batch):
            gi = bi * BATCH + ji
            itp_num = gi + 1  # Fresh deploy: ITPs start at ID 1
            t_ = itp["ticker"]
            n_ = itp["name"].replace('"', '\\"')
            a(f"        {{ // {t_}")
            a(f"            bytes32 id = bytes32(uint256({itp_num}));")
            a(f'            ITP v = new ITP(id, idx, "{n_}", "{t_}", wusdc);')
            a(f"            Investment(idx).setITPVault(id, address(v));")
            a("        }")
        a("    }")
        a("")

    a("}")
    return "\n".join(L)


# ============================================================
# Shell script
# ============================================================
def gen_shell_script(itps):
    return f"""#!/bin/bash
# Deploy ITPs - 2-phase deployment (tokens handled by deploy-all-tokens.py)
# Generated by scripts/deploy-107-itps.py
set -e
cd "$(dirname "$0")/.."

RPC="${{RPC_URL:-http://localhost:8545}}"
echo "=== Phase 1: Create {len(itps)} ITPs ==="
cd contracts
forge script script/Deploy107ITPs_Create.s.sol:Deploy107ITPs_Create \\
    --rpc-url "$RPC" --broadcast --slow -vv
cd ..
echo ""

echo "=== Phase 2: Deploy {len(itps)} ITP vaults ==="
cd contracts
forge script script/Deploy107ITPs_Vaults.s.sol:Deploy107ITPs_Vaults \\
    --rpc-url "$RPC" --broadcast --slow -vv
cd ..
echo ""

echo "=== ALL DONE ==="
"""


FALLBACK_SYMBOLS = {
    "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "DOT", "LINK", "AVAX",
    "TRX", "SHIB", "MATIC", "LTC", "UNI", "ATOM", "XLM", "ETC", "FIL", "HBAR",
    "APT", "ARB", "OP", "NEAR", "ICP", "VET", "ALGO", "FTM", "SAND", "MANA",
    "AXS", "AAVE", "GRT", "EOS", "XTZ", "EGLD", "FLOW", "THETA", "CHZ", "ENJ",
    "CRV", "COMP", "MKR", "SNX", "ZEC", "DASH", "IOTA", "NEO", "WAVES", "KAVA",
    "ONE", "CELO", "ZIL", "RVN", "HOT", "BAT", "STORJ", "SC", "DGB", "KSM",
    "SUI", "SEI", "TIA", "INJ", "WLD", "PYTH", "JTO", "BONK", "PEPE", "WIF",
}


def fetch_valid_bitget_symbols():
    """Fetch tradeable spot symbols from Bitget. Returns set of base symbols (e.g. 'BTC')."""
    url = "https://api.bitget.com/api/v2/spot/public/products"
    try:
        resp = urllib.request.urlopen(url, timeout=10)
        products = json.loads(resp.read())["data"]
        # Each product has a 'symbol' field like 'BTCUSDT'. Extract base by stripping quote.
        valid = set()
        for p in products:
            sym = p.get("symbol", "")
            for quote in ("USDT", "USDC"):
                if sym.endswith(quote):
                    valid.add(sym[: -len(quote)])
                    break
        print(f"Fetched {len(valid)} valid Bitget base symbols")
        return valid
    except Exception as e:
        print(f"Warning: Could not fetch Bitget pairs: {e}")
        print(f"Falling back to {len(FALLBACK_SYMBOLS)} hardcoded symbols")
        return FALLBACK_SYMBOLS


def main():
    print("Loading...")
    manifest = load_json(MANIFEST_PATH)
    backtest = load_json(BACKTEST_PATH)
    prices = load_json(CREATION_PRICES_PATH)

    # Load symbol index from deploy-all-tokens.py output
    symbols_json = os.path.join(REPO_ROOT, "data/all-token-symbols.json")
    if not os.path.exists(symbols_json):
        print("ERROR: data/all-token-symbols.json not found. Run scripts/deploy-all-tokens.py first.")
        exit(1)
    sym_idx = load_json(symbols_json)
    N = len(sym_idx)
    print(f"  {len(manifest)} ITPs, {N} tokens (from all-token-symbols.json), {len(prices)} prices")

    # Validate symbols against Bitget tradeable pairs before building ITPs
    valid_bitget_symbols = fetch_valid_bitget_symbols()

    bt_map = {i["ticker"]: i for i in backtest["itps"]}

    itps = []
    for m in manifest:
        bt = bt_map.get(m["ticker"])
        if not bt or not bt.get("current_holdings"):
            print(f"SKIP {m['ticker']}: 0 holdings")
            continue
        filtered_holdings = [
            hld for hld in bt["current_holdings"]
            if hld.get("symbol") in valid_bitget_symbols
        ]
        removed = len(bt["current_holdings"]) - len(filtered_holdings)
        if removed:
            dropped = [hld["symbol"] for hld in bt["current_holdings"] if hld.get("symbol") not in valid_bitget_symbols]
            print(f"  {m['ticker']}: dropped {removed} non-Bitget symbols: {dropped}")
        h = normalize_weights(filtered_holdings, prices)
        if not h:
            print(f"SKIP {m['ticker']}: empty after filter")
            continue
        # Verify all symbols exist in token index
        missing = [s for s, *_ in h if s not in sym_idx]
        if missing:
            print(f"SKIP {m['ticker']}: missing tokens {missing}")
            continue
        name = m["name"]
        if len(name) > 32:
            print(f"ERROR: {m['ticker']} name '{name}' is {len(name)} chars (max 32). Fix in manifest.")
            exit(1)
        if len(m["ticker"]) > 32:
            print(f"ERROR: {m['ticker']} ticker is {len(m['ticker'])} chars (max 32). Fix in manifest.")
            exit(1)
        itps.append({"ticker": m["ticker"], "name": name, "holdings": h})

    print(f"\n{len(itps)} ITPs, {N} tokens")

    # Generate Script 1: Create ITPs (no token deploy — handled by deploy-all-tokens.py)
    sol1 = gen_create_script(itps, sym_idx, None, N)
    path1 = os.path.join(SOL_DIR, "Deploy107ITPs_Create.s.sol")
    with open(path1, "w") as f:
        f.write(sol1)
    print(f"Wrote {path1} ({sol1.count(chr(10))} lines)")

    # Generate Script 2: Vaults
    sol2 = gen_vaults_script(itps)
    path2 = os.path.join(SOL_DIR, "Deploy107ITPs_Vaults.s.sol")
    with open(path2, "w") as f:
        f.write(sol2)
    print(f"Wrote {path2} ({sol2.count(chr(10))} lines)")

    # Generate shell script (2 phases: create + vaults)
    sh = gen_shell_script(itps)
    with open(SHELL_SCRIPT_PATH, "w") as f:
        f.write(sh)
    os.chmod(SHELL_SCRIPT_PATH, 0o755)
    print(f"Wrote {SHELL_SCRIPT_PATH}")


if __name__ == "__main__":
    main()
