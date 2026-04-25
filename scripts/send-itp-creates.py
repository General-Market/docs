#!/usr/bin/env python3
"""
Send createITP() calls directly via web3.py.

Bypasses forge — forge's `--slow` deadlocks during simulation when 96
createITP calls run sequentially through Orbit L3's RPC. This sender
manages nonce locally, sends each tx independently, retries on failure.

Reads the same data sources as scripts/deploy-107-itps.py and emits
the same ITP definitions, then calls them through web3.py.

Env required:
  L3_RPC_URL, DEPLOYER_KEY, INDEX_ADDRESS
Optional:
  GAS_PRICE_WEI (default 10 gwei)
  GAS_LIMIT     (default 30M)
"""

import json
import os
import sys
import time
from pathlib import Path

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

# Re-use generator's data-loading
sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module
gen = import_module('deploy-107-itps')

REPO = Path(__file__).resolve().parent.parent

RPC_URL = os.environ.get('L3_RPC_URL', 'http://142.132.164.24/')
DEPLOYER_KEY = os.environ.get('DEPLOYER_KEY', '0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537')
INDEX_ADDRESS = os.environ['INDEX_ADDRESS']
GAS_PRICE_WEI = int(os.environ.get('GAS_PRICE_WEI', 10_000_000_000))
GAS_LIMIT = int(os.environ.get('GAS_LIMIT', 30_000_000))
CHAIN_ID = 111222333

# Investment.createITP signature
CREATE_ITP_ABI = {
    "name": "createITP",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
        {"name": "name", "type": "string"},
        {"name": "symbol", "type": "string"},
        {"name": "weights", "type": "uint256[]"},
        {"name": "assets", "type": "address[]"},
        {"name": "prices", "type": "uint256[]"},
        {"name": "maxAmountIn", "type": "uint256"},
    ],
    "outputs": [{"name": "itpId", "type": "bytes32"}],
}

TOTAL_ITPS_ABI = {
    "name": "totalITPs",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
}


def load_addresses():
    addrs = {}
    with open(REPO / 'data/all-token-addresses.csv') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            idx_s, addr = line.split(',', 1)
            addrs[int(idx_s)] = Web3.to_checksum_address(addr)
    return addrs


def main():
    print(f"RPC: {RPC_URL}")
    print(f"Index: {INDEX_ADDRESS}")
    print(f"Gas price: {GAS_PRICE_WEI / 1e9:.1f} gwei")

    w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={'timeout': 30}))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    assert w3.is_connected(), "RPC unreachable"
    assert w3.eth.chain_id == CHAIN_ID, f"chain {w3.eth.chain_id} != {CHAIN_ID}"

    deployer = w3.eth.account.from_key(DEPLOYER_KEY)
    print(f"Deployer: {deployer.address}")

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(INDEX_ADDRESS),
        abi=[CREATE_ITP_ABI, TOTAL_ITPS_ABI],
    )

    # Already created?
    try:
        existing = contract.functions.totalITPs().call()
    except Exception:
        existing = 0
    print(f"Existing ITPs on Index: {existing}")

    # Load ITP definitions (re-use generator data loading)
    print("Loading ITP definitions...")
    manifest = gen.load_json(gen.MANIFEST_PATH)
    backtest = gen.load_json(gen.BACKTEST_PATH)
    prices = gen.load_json(gen.CREATION_PRICES_PATH)
    sym_idx = gen.load_json(REPO / 'data/all-token-symbols.json')
    valid_bitget = gen.fetch_valid_bitget_symbols()
    bt_map = {i["ticker"]: i for i in backtest["itps"]}

    itps = []
    for m in manifest:
        bt = bt_map.get(m["ticker"])
        if not bt or not bt.get("current_holdings"):
            continue
        filtered = [h for h in bt["current_holdings"] if h.get("symbol") in valid_bitget]
        if len(filtered) < 2:
            continue
        h = gen.normalize_weights(filtered, prices)
        if not h:
            continue
        if any(s not in sym_idx for s, *_ in h):
            continue
        if len(m["name"]) > 32 or len(m["ticker"]) > 32:
            continue
        itps.append({"ticker": m["ticker"], "name": m["name"], "holdings": h})

    print(f"  Will create {len(itps)} ITPs (skipping first {existing})")

    addrs = load_addresses()
    nonce = w3.eth.get_transaction_count(deployer.address)
    print(f"Starting nonce: {nonce}")

    sent = []
    skipped = 0
    failed = []
    for i, itp in enumerate(itps):
        if i < existing:
            skipped += 1
            continue
        weights = [int(w) for _, w, _, _ in itp["holdings"]]
        assets = [addrs[sym_idx[s]] for s, *_ in itp["holdings"]]
        # price is stored as quoted (string), already 18-dec scaled? Check format.
        # Python generator uses pw directly — copy that. The Solidity has `p[hi] = {pw};`
        # raw int.
        prices_arr = [int(pw) for _, _, pw, _ in itp["holdings"]]

        try:
            tx = contract.functions.createITP(
                itp["name"], itp["ticker"], weights, assets, prices_arr,
                2**256 - 1,
            ).build_transaction({
                'from': deployer.address,
                'nonce': nonce,
                'gas': GAS_LIMIT,
                'gasPrice': GAS_PRICE_WEI,
                'chainId': CHAIN_ID,
            })
            signed = w3.eth.account.sign_transaction(tx, DEPLOYER_KEY)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            sent.append((i, itp["ticker"], tx_hash.hex(), nonce))
            print(f"  [{i+1}/{len(itps)}] {itp['ticker']:>10s}  nonce={nonce}  tx={tx_hash.hex()[:12]}...")
            nonce += 1
        except Exception as e:
            print(f"  [{i+1}/{len(itps)}] {itp['ticker']:>10s}  FAILED: {e}")
            failed.append((i, itp["ticker"], str(e)))
            # Re-sync nonce on failure
            try:
                nonce = w3.eth.get_transaction_count(deployer.address)
            except Exception:
                pass
            time.sleep(2)

    print(f"\nSent {len(sent)} txs, skipped {skipped}, failed {len(failed)}")

    if failed:
        print("FAILED:")
        for i, tkr, err in failed[:10]:
            print(f"  {i+1} {tkr}: {err[:200]}")

    # Wait for receipts
    print("Waiting for confirmations...")
    confirmed = 0
    for idx, tkr, tx_hash, nonce in sent:
        try:
            r = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            if r.status == 1:
                confirmed += 1
            else:
                print(f"  [{idx+1}] {tkr} REVERTED tx={tx_hash}")
                failed.append((idx, tkr, 'revert'))
        except Exception as e:
            print(f"  [{idx+1}] {tkr} receipt timeout: {e}")
            failed.append((idx, tkr, 'timeout'))

    print(f"Confirmed: {confirmed}/{len(sent)}")
    if failed:
        sys.exit(1)


if __name__ == '__main__':
    main()
