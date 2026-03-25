#!/usr/bin/env python3
"""Fill all pending L3 orders using BLS-signed confirmFills.
Reads orders, signs with bls-tool, submits one-by-one."""
import json, subprocess, sys, os, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

RPC = os.environ.get("L3_RPC", "http://142.132.164.24/")
KEY = os.environ.get("DEPLOYER_KEY", "0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537")
CHAIN_ID = 111222333
BLS_TOOL = "target/release/bls-tool"

deploy = json.load(open("deployments/active-deployment.json"))
INDEX = deploy["contracts"]["Index"]
REGISTRY = deploy["contracts"]["OracleRegistry"]

def cast(cmd, *args, timeout=15):
    r = subprocess.run(["cast"] + list(cmd) + list(args), capture_output=True, text=True, timeout=timeout)
    return r.stdout.strip()

def cast_send(to, sig, *args, gas=2000000):
    r = subprocess.run(
        ["cast", "send", to, sig] + list(args) +
        ["--private-key", KEY, "--rpc-url", RPC, "--gas-limit", str(gas)],
        capture_output=True, text=True, timeout=30
    )
    return r.returncode == 0, r.stderr[:200] if r.returncode != 0 else ""

# Get registry nonce
reg_nonce = cast(["call", REGISTRY, "registryNonce()(uint256)", "--rpc-url", RPC]).split()[0]
print(f"Registry nonce: {reg_nonce}")

# Get next order ID
next_order = int(cast(["call", INDEX, "nextOrderId()(uint256)", "--rpc-url", RPC]).split()[0])
print(f"Orders: 1..{next_order - 1}")

# Scan pending orders (batch via multicall would be faster but cast doesn't support it)
print("Scanning pending orders...")
pending = []
for i in range(1, next_order):
    try:
        raw = cast(["call", INDEX,
            "getOrder(uint256)(uint256,address,bytes32,uint8,uint256,uint256,uint256,uint256,bytes32,uint256,uint8)",
            str(i), "--rpc-url", RPC])
        lines = raw.strip().split("\n")
        if len(lines) >= 11:
            status = int(lines[10].strip())
            if status == 0:  # PENDING
                amount = lines[4].strip().split()[0]
                itp_id = lines[8].strip()
                pending.append({"id": i, "amount": amount, "itp_id": itp_id})
    except:
        pass
    if i % 50 == 0:
        print(f"  scanned {i}/{next_order - 1}, found {len(pending)} pending")

print(f"Found {len(pending)} pending orders")
if not pending:
    print("Nothing to fill")
    sys.exit(0)

# Fill orders one by one (each needs unique cycle + BLS sig)
filled = 0
failed = 0
base_cycle = 2000000

for order in pending:
    oid = order["id"]
    amount = order["amount"]
    cycle = base_cycle + oid
    fill_price = "1000000000000000000"  # $1 NAV

    fills_sol = f"[({oid},{amount},{fill_price},{cycle})]"

    # ABI encode message
    try:
        encoded = cast(["abi-encode",
            "f(uint256,address,uint256,(uint256,uint256,uint256,uint256)[])",
            str(CHAIN_ID), INDEX, str(cycle), fills_sol])
        msg_hash = cast(["keccak", encoded])
    except Exception as e:
        print(f"  Order {oid}: encode failed — {e}")
        failed += 1
        continue

    # BLS sign
    try:
        sig = subprocess.run(
            [BLS_TOOL, "sign", "--seed-indices", "0,1,2", "--message-hash", msg_hash],
            capture_output=True, text=True, timeout=5
        ).stdout.strip()
    except:
        sig = ""

    if not sig:
        print(f"  Order {oid}: BLS sign failed")
        failed += 1
        continue

    # Submit confirmFills
    ok, err = cast_send(INDEX,
        "confirmFills(uint256,(uint256,uint256,uint256,uint256)[],bytes,uint256,uint256)",
        str(cycle), fills_sol, sig, reg_nonce, "7",
        gas=1500000)

    if ok:
        filled += 1
        if filled % 10 == 0 or filled == 1:
            print(f"  Filled {filled} orders (latest: #{oid})")
    else:
        failed += 1
        if failed <= 5:
            print(f"  Order {oid}: FAILED — {err[:100]}")

print(f"\nDone: {filled} filled, {failed} failed out of {len(pending)}")
remaining = cast(["call", INDEX, "pendingOrderCount()(uint256)", "--rpc-url", RPC])
print(f"Remaining pending: {remaining}")
