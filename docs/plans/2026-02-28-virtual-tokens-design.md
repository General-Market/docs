# Virtual Tokens: Eliminate Slow Bitget Token Deployment

**Date:** 2026-02-28
**Status:** Design
**Session:** 20260228-1500-vt01

## Problem

`start.sh` step 4 runs `deploy-all-bitget-tokens.py`, which deploys ~529 MockERC20 contracts on-chain via Forge. This takes **15-30 minutes** and frequently gets **OOM-killed** (exit -9). It's the single biggest bottleneck in local dev startup.

## Key Insight

Most consumers use token addresses purely as **address → symbol map keys**. The one exception is `MockBitgetVault.executeTrade()` which calls `.mint()` / `.burn()` — but we fix this by making the vault gracefully skip mint/burn for virtual tokens (no bytecode) and rely on its existing `netPosition` internal accounting.

| Token | Currently needs real contract? | After this change |
|-------|-------------------------------|-------------------|
| USDC (L3_WUSDC, ARB_USDC) | **YES** — `.balanceOf()`, `.transfer()` in Investment.sol | Unchanged |
| MockUSDT | **YES** — `.burn()`, `.mint()` in vault stablecoin swaps | Unchanged |
| ITP vault token | **YES** — ERC4626 `.mint()` / `.burn()` in Investment._processFill() | Unchanged |
| 100 ITP tokens (BTC, ETH, SOL...) | **YES** — `IMockERC20(token).burn()/.mint()` in vault | Still real, but vault would work without them too |
| ~529 Bitget catalog tokens | **YES** (currently deployed) | **Virtual** — vault skips mint/burn, uses `netPosition` |

### The MockBitgetVault problem (and fix)

`MockBitgetVault.sol:423`: `IMockERC20(sellToken).burn(address(this), burnSellAmount);`
`MockBitgetVault.sol:432`: `IMockERC20(buyToken).mint(address(this), mintBuyAmount);`

Users can create ITPs from **any** catalog token via the frontend. When someone buys that ITP, the oracle decomposes into per-asset trades, and the AP calls `executeTrade()` with those token addresses. If they're virtual (no bytecode), the mint/burn reverts.

**Fix:** Check `token.code.length` before calling mint/burn. Virtual tokens are tracked via the vault's existing `netPosition` mapping (line 435-436), which already runs for all tokens regardless.

---

## Architecture: Who Uses What

### symbol-map.json consumers

| Component | File | How it uses addresses | Needs real contracts? |
|-----------|------|----------------------|----------------------|
| **Oracle** | `oracle/src/price/symbol_map.rs:116` | `HashMap<Address, String>` — looks up Bitget symbol for price fetch | NO |
| **AP** | `ap/src/main.rs:586-646` | `HashMap<String, String>` — looks up symbol for data-node price query | NO |
| **Data-node** | `data-node/src/api.rs:281-297` | `HashMap<String, String>` — extracts Bitget symbols for kline collection | NO |
| **Frontend** | `frontend/public/deployed-assets.json` | Array of `{address, symbol}` for CreateITP asset picker UI | NO |
| **AP settlement** | `ap/src/external/bitget_vault.rs` | Passes addresses to `MockBitgetVault.executeTrade(sellToken, buyToken, ...)` | NO (after vault fix) — vault skips mint/burn for virtual tokens |

### Price pipeline (no on-chain token calls)

```
symbol-map.json
  ↓ address → "BTCUSDC"
Bitget API (https://api.bitget.com/api/v2/spot/market/tickers)
  ↓ price
Oracle NAV calculation: Σ(qty[i] * price[i]) / 1e18
  ↓ BLS-signed
Investment.sol._itpNavs[itpId] = nav
```

### On-chain storage (stores addresses, never calls them)

```solidity
// InvestmentStorage.sol:40-46
mapping(bytes32 => address[]) internal _itpAssets;     // just address arrays
mapping(bytes32 => uint256[]) internal _itpWeights;    // weight values
mapping(bytes32 => uint256[]) internal _itpInventory;  // qty per share
```

`Investment.sol._getCurrentPrice()` returns `_itpNavs[itpId]` (pre-pushed by BLS). It **never** calls any method on the token addresses.

---

## Changes

### Task 1: Create `scripts/generate-virtual-tokens.py`

Replaces on-chain deployment with deterministic address generation. Runtime: <2s.

**Address generation:** `sha256("index-virtual-token:{pair}")[12:]` — deterministic, collision-free, produces valid 20-byte Ethereum addresses.

```python
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
```

### Task 2: Update `start.sh` step 4 (lines 554-561)

Replace the `deploy-all-bitget-tokens.py` call with `generate-virtual-tokens.py`. The ITP merge logic (lines 566-684) stays **exactly as-is** — it reads on-chain ITP state and patches symbol-map.json with real addresses for the 100 ITP tokens.

**Before:**
```bash
# ============ STEP 4: All Bitget tokens ============
echo -e "${BLUE}[4/$TOTAL_STEPS] Deploying Bitget pair tokens (fetching live pairs from API)...${NC}"

if ! python3 scripts/deploy-all-bitget-tokens.py --rpc-url $ARB_RPC_URL > logs/deploy-bitget-tokens.log 2>&1; then
    echo -e "${RED}Error: Bitget token deployment failed${NC}"
    tail -20 logs/deploy-bitget-tokens.log
    exit 1
fi
```

**After:**
```bash
# ============ STEP 4: Virtual Bitget tokens ============
echo -e "${BLUE}[4/$TOTAL_STEPS] Generating virtual Bitget token addresses...${NC}"

if ! python3 scripts/generate-virtual-tokens.py > logs/generate-virtual-tokens.log 2>&1; then
    echo -e "${RED}Error: Virtual token generation failed${NC}"
    tail -20 logs/generate-virtual-tokens.log
    exit 1
fi
```

**Everything after line 563 stays unchanged:**
- Line 563: `TOKEN_COUNT=$(python3 -c "import json; print(len(json.load(open('data/symbol-map.json'))))")` — works identically
- Lines 566-630: ITP merge — reads on-chain state, patches symbol-map.json with real ITP token addresses
- Lines 632-657: Regenerate `assets.json` from symbol-map
- Lines 659-684: Regenerate `frontend/public/deployed-assets.json` from symbol-map

### Task 3: MockBitgetVault — skip mint/burn for virtual tokens

**File:** `contracts/src/mocks/MockBitgetVault.sol` (lines 416-433)

The vault already tracks `netPosition[token]` for all tokens. The mint/burn is redundant accounting that keeps ERC20 balances in sync. For virtual tokens (no bytecode), skip the ERC20 calls.

**Before:**
```solidity
IMockERC20(sellToken).burn(address(this), burnSellAmount);
emit VaultBurned(sellToken, burnSellAmount);

uint256 mintBuyAmount = actualBuyAmount;
// ... decimal conversion ...
IMockERC20(buyToken).mint(address(this), mintBuyAmount);
emit VaultMinted(buyToken, mintBuyAmount, msg.sender);
```

**After:**
```solidity
if (sellToken.code.length > 0) {
    IMockERC20(sellToken).burn(address(this), burnSellAmount);
}
emit VaultBurned(sellToken, burnSellAmount);

uint256 mintBuyAmount = actualBuyAmount;
// ... decimal conversion ...
if (buyToken.code.length > 0) {
    IMockERC20(buyToken).mint(address(this), mintBuyAmount);
}
emit VaultMinted(buyToken, mintBuyAmount, msg.sender);
```

Events still fire for all tokens (virtual or real). `netPosition` tracking (line 435-436) still runs for all tokens. The only difference: virtual tokens don't get actual ERC20 state changes (which nobody reads anyway).

Same pattern for `swapStable()` (lines 458+) and `settle()` if they call mint/burn on arbitrary tokens — but those only operate on USDC/USDT (always real contracts), so no change needed there.

### Task 4: Delete `scripts/deploy-all-bitget-tokens.py`

Fully replaced by `generate-virtual-tokens.py`.

---

## Files Changed

| File | Change |
|------|--------|
| `scripts/generate-virtual-tokens.py` | **NEW** — deterministic virtual addresses |
| `scripts/deploy-all-bitget-tokens.py` | **DELETE** |
| `start.sh` (lines 554-561 only) | Replace deploy call with generate call |
| `contracts/src/mocks/MockBitgetVault.sol` | Skip mint/burn for virtual tokens (code.length check) |

## Files NOT Changed

| File | Why unchanged |
|------|---------------|
| `oracle/src/price/symbol_map.rs` | Reads `symbol-map.json` format identically — `HashMap<Address, String>` |
| `oracle/src/bootstrap/price.rs` | Passes symbol map to BitgetPriceFetcher unchanged |
| `oracle/src/api/nav.rs` | NAV = Σ(qty * price) / 1e18 — only needs address→symbol mapping |
| `oracle/src/main.rs:654-677` | Builds `quote_tokens` map from symbol suffixes — works with virtual addresses |
| `ap/src/main.rs` | Loads `HashMap<String, String>` from symbol-map.json unchanged |
| `ap/src/external/bitget_vault.rs` | Passes addresses to vault — no ERC20 calls from AP side |
| `data-node/src/api.rs` | `load_symbol_map()` reads same JSON format |
| `data-node/src/kline_collector.rs` | Extracts Bitget pair symbols from symbol-map values |
| `contracts/src/core/Investment.sol` | `_itpAssets` stores addresses, never calls them |
| `contracts/src/core/InvestmentStorage.sol` | Storage layout unchanged |
| `contracts/script/Deploy100AssetITP.s.sol` | Deploys real 100 ITP tokens — unchanged, still needed |
| `frontend/components/domain/CreateItpSection.tsx` | Reads `deployed-assets.json` format unchanged |
| `frontend/components/domain/RebalanceModal.tsx` | Reads `deployed-assets.json` format unchanged |
| `start.sh` (lines 563-684) | ITP merge + assets.json + deployed-assets.json regen — all unchanged |

---

## Why This Works

### 1. Oracle price pipeline
`oracle/src/price/symbol_map.rs:49`: `get_symbol(&asset)` returns `Option<&str>`. A virtual address maps to "BTCUSDC" the same way a deployed address does. The oracle then fetches the price from Bitget API using the symbol string.

### 2. AP settlement + MockBitgetVault
`ap/src/main.rs:586-646`: Loads symbol-map into `HashMap<String, String>`. Used for data-node price lookups. The AP passes token addresses to `MockBitgetVault.executeTrade()` — the vault now skips mint/burn for virtual tokens and tracks everything via `netPosition`.

### 3. Data-node kline collection
`data-node/src/kline_collector.rs`: Extracts unique Bitget pair symbols from symbol-map **values** (the strings like "BTCUSDC"). Doesn't care what the address keys are.

### 4. Frontend asset picker
`CreateItpSection.tsx:93`: `fetch('/deployed-assets.json')` loads `[{address, symbol}]`. UI displays symbols for selection. When user creates an ITP, the selected addresses go on-chain — but these catalog addresses are never called as contracts.

### 5. On-chain invariant
`Investment.sol:707-711`: `_itpAssets[itpId].push(_assets[i])` stores any address. `_getCurrentPrice()` returns the BLS-pushed NAV from `_itpNavs`, not from calling token contracts.

### 6. New ITPs from virtual catalog tokens
User creates ITP from frontend → selects virtual catalog tokens → `createITP()` stores virtual addresses in `_itpAssets` → oracle decomposes buys/sells → AP calls `MockBitgetVault.executeTrade()` with virtual addresses → vault skips mint/burn (no bytecode), tracks via `netPosition` → trade succeeds.

---

## Performance Impact

| Metric | Before | After |
|--------|--------|-------|
| Step 4 duration | 15-30 min | <2 sec |
| OOM risk | High (Forge compiling 529 contracts) | None (pure Python, no compilation) |
| On-chain state | 529 contract deployments | 0 deployments |
| symbol-map.json entries | ~629 (100 ITP + 529 catalog) | ~629 (100 ITP + ~529 virtual) |
| Functional change | None | Virtual tokens trade via `netPosition` instead of mint/burn |

---

## Verification

```bash
# 1. Full restart
bash stop.sh && bash start.sh --vision --no-tail --no-test

# 2. Step 4 should complete in <5s (check logs)
grep "virtual" logs/generate-virtual-tokens.log

# 3. Verify symbol-map.json has entries
python3 -c "import json; sm=json.load(open('data/symbol-map.json')); print(f'{len(sm)} entries')"

# 4. Verify oracle loaded symbol map
grep "Loaded custom symbol map" logs/oracle-1.log

# 5. Verify prices are flowing
grep "Price fetch" logs/oracle-1.log | head -5

# 6. Verify frontend assets
python3 -c "import json; a=json.load(open('frontend/public/deployed-assets.json')); print(f'{len(a)} assets')"

# 7. E2E buy test (exercises full pipeline including MockBitgetVault with real ITP tokens)
cd frontend && npx playwright test e2e/tests/02-buy-itp.spec.ts
```
