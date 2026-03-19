#!/usr/bin/env python3
"""
seed-lending.sh — Buy ITPs, supply as collateral, borrow random USDC amounts.
Seeds the MetaMorpho vault with borrow activity so supply APY > 0.

Usage:
  ./scripts/seed-lending.sh [--buy-only] [--borrow-only] [--max-buy 100] [--max-borrow 100]
"""
import subprocess, json, sys, os, time, random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RPC = os.environ.get("L3_RPC_URL", "http://142.132.164.24/")
KEY = os.environ.get("DEPLOYER_KEY", "0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537")
MAX_UINT = "0x" + "f" * 64

# Parse args
buy_only = "--buy-only" in sys.argv
borrow_only = "--borrow-only" in sys.argv
max_buy = 100
max_borrow = 100
for i, a in enumerate(sys.argv):
    if a == "--max-buy" and i + 1 < len(sys.argv): max_buy = int(sys.argv[i + 1])
    if a == "--max-borrow" and i + 1 < len(sys.argv): max_borrow = int(sys.argv[i + 1])

# Load config
with open(f"{ROOT}/frontend/lib/contracts/deployment.json") as f:
    deploy = json.load(f)
with open(f"{ROOT}/frontend/lib/contracts/batch-markets.json") as f:
    batch = json.load(f)

INDEX = deploy["contracts"]["Index"]
L3_USDC = deploy["contracts"]["L3_WUSDC"]
MORPHO = batch["infrastructure"]["MORPHO"]
LOAN = batch["infrastructure"]["SETTLEMENT_USDC"]
markets = batch["markets"]

def cast_call(to, sig, *args):
    cmd = ["cast", "call", to, sig] + list(args) + ["--rpc-url", RPC]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return r.stdout.strip()
    except:
        return ""

def cast_send(to, sig, *args, gas=500000):
    cmd = ["cast", "send", to, sig] + list(args) + [
        "--private-key", KEY, "--rpc-url", RPC, "--gas-limit", str(gas)
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return "0x1" in r.stdout or "status" in r.stdout
    except:
        return False

DEPLOYER = subprocess.run(["cast", "wallet", "address", KEY],
                          capture_output=True, text=True).stdout.strip()

print(f"=== Seed Lending ===")
print(f"Deployer:    {DEPLOYER}")
print(f"Markets:     {len(markets)}")
print(f"Max buy:     ${max_buy}")
print(f"Max borrow:  ${max_borrow}")
print()

# Build vault → itpId map
itp_count = int(cast_call(INDEX, "getItpCount()(uint256)").split()[0])
print(f"ITPs on-chain: {itp_count}")

vault_to_itp = {}
for i in range(1, itp_count + 1):
    itp_id = f"0x{i:064x}"
    vault = cast_call(INDEX, "itpVaults(bytes32)(address)", itp_id)
    if vault and vault != "0x0000000000000000000000000000000000000000":
        vault_to_itp[vault.lower()] = itp_id

print(f"Vaults mapped: {len(vault_to_itp)}")

# Check which markets have working oracles
valid_markets = []
for i, m in enumerate(markets):
    oracle = m["oracle"]
    code_size = int(subprocess.run(
        ["cast", "codesize", oracle, "--rpc-url", RPC],
        capture_output=True, text=True, timeout=10
    ).stdout.strip() or "0")
    if code_size > 0:
        valid_markets.append((i, m))
    # silently skip broken oracles

print(f"Markets with working oracles: {len(valid_markets)} / {len(markets)}")
print()

# ═══════════════════════════════════════════════════════════
# PHASE 1: Buy ITPs
# ═══════════════════════════════════════════════════════════
if not borrow_only:
    print("══ Phase 1: Buy ITPs ══")

    # Mint L3 USDC
    total_mint = max_buy * len(valid_markets) * 3 * 10**18
    cast_send(L3_USDC, "mint(address,uint256)", DEPLOYER, str(total_mint), gas=100000)
    cast_send(L3_USDC, "approve(address,uint256)", INDEX, MAX_UINT, gas=100000)
    print("USDC minted + approved")

    deadline = str(int(time.time()) + 86400)
    limit = str(10 * 10**18)
    submitted = 0

    for idx, m in valid_markets:
        coll = m["collateralToken"]
        itp_id = vault_to_itp.get(coll.lower())
        if not itp_id:
            continue

        # Skip if already has shares
        bal = cast_call(coll, "balanceOf(address)(uint256)", DEPLOYER)
        bal_val = bal.split()[0] if bal else "0"
        if bal_val != "0":
            continue

        rand_buy = random.randint(1, max_buy)
        rand_wei = str(rand_buy * 10**18)
        num = int(itp_id, 16)

        ok = cast_send(INDEX, "submitOrder(bytes32,uint8,uint256,uint256,uint256,uint256)",
                       itp_id, "0", rand_wei, limit, "1", deadline)
        status = "OK" if ok else "FAIL"
        print(f"  ITP #{num}: ${rand_buy} — {status}")
        if ok:
            submitted += 1

    print(f"\nSubmitted {submitted} buy orders")

    if buy_only:
        print("Done (--buy-only). Run again with --borrow-only after fills.")
        sys.exit(0)

    # Wait for fills
    print("Waiting for oracle fills...")
    for elapsed in range(0, 300, 15):
        filled = 0
        for idx, m in valid_markets:
            bal = cast_call(m["collateralToken"], "balanceOf(address)(uint256)", DEPLOYER)
            val = bal.split()[0] if bal else "0"
            if val != "0":
                filled += 1
        print(f"  {elapsed}s: {filled}/{len(valid_markets)} have collateral")
        if filled >= submitted:
            print("All filled!")
            break
        time.sleep(15)
    print()

# ═══════════════════════════════════════════════════════════
# PHASE 2: Supply collateral + Borrow
# ═══════════════════════════════════════════════════════════
print("══ Phase 2: Supply Collateral + Borrow ══")

# Mint loan token USDC
if LOAN.lower() != L3_USDC.lower():
    cast_send(LOAN, "mint(address,uint256)", DEPLOYER, str(10**24), gas=100000)
    cast_send(LOAN, "approve(address,uint256)", MORPHO, MAX_UINT, gas=100000)
    print("Loan USDC minted + approved")

supplied = 0
borrowed = 0
total_borrow_usd = 0.0

for idx, m in valid_markets:
    coll = m["collateralToken"]
    oracle = m["oracle"]
    irm = m["irm"]
    lltv = m["lltv"]
    mp = f"({LOAN},{coll},{oracle},{irm},{lltv})"

    # Check collateral balance
    bal = cast_call(coll, "balanceOf(address)(uint256)", DEPLOYER)
    bal_val = int(bal.split()[0]) if bal else 0
    if bal_val < 10**16:  # less than 0.01 tokens
        continue

    # Random borrow 1-max_borrow, capped at 50% of collateral
    rand_borrow = random.randint(1, max_borrow)
    borrow_wei = rand_borrow * 10**18
    max_safe = bal_val * 50 // 100
    borrow_wei = min(borrow_wei, max_safe)
    if borrow_wei < 10**16:
        borrow_wei = 10**16  # minimum 0.01

    borrow_usd = borrow_wei / 10**18

    # Approve collateral
    cast_send(coll, "approve(address,uint256)", MORPHO, MAX_UINT, gas=100000)

    # Supply collateral
    ok = cast_send(MORPHO,
        "supplyCollateral((address,address,address,address,uint256),uint256,address,bytes)",
        mp, str(bal_val), DEPLOYER, "0x")

    if not ok:
        print(f"  [{idx}] supply FAILED")
        continue
    supplied += 1

    # Borrow
    ok2 = cast_send(MORPHO,
        "borrow((address,address,address,address,uint256),uint256,uint256,address,address)",
        mp, str(borrow_wei), "0", DEPLOYER, DEPLOYER)

    if ok2:
        borrowed += 1
        total_borrow_usd += borrow_usd
        print(f"  [{idx}] supplied + borrowed ${borrow_usd:.0f}")
    else:
        print(f"  [{idx}] supplied, borrow FAILED (${borrow_usd:.0f})")

# Final stats
print()
print("═══ Summary ═══")
print(f"Supplied collateral: {supplied} / {len(valid_markets)} markets")
print(f"Borrowed USDC:       {borrowed} markets, ${total_borrow_usd:,.0f} total")

# Check vault state
total_supply = 0
total_borrow = 0
vault = batch["infrastructure"]["METAMORPHO_VAULT"]
wq_len = int(cast_call(vault, "withdrawQueueLength()(uint256)").split()[0])
for qi in range(wq_len):
    mid = cast_call(vault, "withdrawQueue(uint256)(bytes32)", str(qi))
    market = cast_call(MORPHO, "market(bytes32)(uint128,uint128,uint128,uint128,uint128,uint128)", mid)
    lines = market.split("\n")
    s = int(lines[0].split()[0]) if lines[0] else 0
    b = int(lines[2].split()[0]) if len(lines) > 2 else 0
    total_supply += s
    total_borrow += b

util = (total_borrow / total_supply * 100) if total_supply > 0 else 0
print(f"\nVault state:")
print(f"  Supply:      ${total_supply / 10**18:,.0f}")
print(f"  Borrow:      ${total_borrow / 10**18:,.0f}")
print(f"  Utilization: {util:.1f}%")
