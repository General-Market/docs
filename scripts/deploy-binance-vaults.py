#!/usr/bin/env python3
"""Deploy + seed twelve Binance Vision vaults.

Specializes scripts/deploy-and-fund-vaults.py to a fixed roster of twelve
vaults across three Binance Vision sources (spot, futures funding, options).
Each vault gets a hardcoded name/symbol pair and a manager loaded from
`envs/testnet/keys/binance-<label>.json`. The deployer seeds 10,000 USDC
into every vault via requestDeposit + claimDeposit (L3 USDC is 18-dec).

Reads:
  envs/testnet/active-deployment.json       contracts.VisionVaultFactory,
                                            contracts.USDC, deployer key
  envs/testnet/keys/binance-<label>.json     {"address": "0x..."} per vault

Writes:
  envs/testnet/active-deployment.json   .whitelistedVaults (appended),
                                        .sourceVaults["binance_*"] (appended)

Required env or CLI:
  DEPLOYER_KEY        deployer private key (or --key)
  L3_RPC_URL          L3 RPC (or --rpc)

Both fall back to active-deployment.json's `deployerPrivateKey` /
`rpcUrls.l3` when present, matching the convention in the parent script.

Example:
    DEPLOYER_KEY=0x... L3_RPC_URL=https://rpc.generalmarket.io/ \
        python3 scripts/deploy-binance-vaults.py
"""

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path

from web3 import Web3

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("deploy-binance-vaults")

ROOT = Path(__file__).resolve().parent.parent
ENVS_DEPLOYMENT_PATH = ROOT / "envs" / "testnet" / "active-deployment.json"
KEYS_DIR = ROOT / "envs" / "testnet" / "keys"

VAULTS = [
    # binance_spot — 4 vaults
    {"label": "spot-mom-5",  "source": "binance_spot",
     "name": "Binance Spot Momentum 5",   "symbol": "vBSPOT-M5"},
    {"label": "spot-rev-5",  "source": "binance_spot",
     "name": "Binance Spot Reversion 5",  "symbol": "vBSPOT-R5"},
    {"label": "spot-mom-20", "source": "binance_spot",
     "name": "Binance Spot Momentum 20",  "symbol": "vBSPOT-M20"},
    {"label": "spot-rev-20", "source": "binance_spot",
     "name": "Binance Spot Reversion 20", "symbol": "vBSPOT-R20"},
    # binance_futures_funding — 4 vaults
    {"label": "fund-rev",     "source": "binance_futures_funding",
     "name": "Binance Funding Reversion",    "symbol": "vBFUND-R"},
    {"label": "fund-mom",     "source": "binance_futures_funding",
     "name": "Binance Funding Continuation", "symbol": "vBFUND-M"},
    {"label": "fund-flip",    "source": "binance_futures_funding",
     "name": "Binance Funding Sign Flip",    "symbol": "vBFUND-F"},
    {"label": "fund-extreme", "source": "binance_futures_funding",
     "name": "Binance Funding Extreme",      "symbol": "vBFUND-X"},
    # binance_options — 4 vaults
    {"label": "opt-mom-all",   "source": "binance_options",
     "name": "Binance Options Momentum All",   "symbol": "vBOPT-MA"},
    {"label": "opt-rev-all",   "source": "binance_options",
     "name": "Binance Options Reversion All",  "symbol": "vBOPT-RA"},
    {"label": "opt-mom-calls", "source": "binance_options",
     "name": "Binance Options Calls Momentum", "symbol": "vBOPT-MC"},
    {"label": "opt-mom-puts",  "source": "binance_options",
     "name": "Binance Options Puts Momentum",  "symbol": "vBOPT-MP"},
]

FEE_BPS = 1000          # 10% performance fee
SEED_USDC = 10_000      # whole USDC per vault
SEED_WEI = SEED_USDC * 10**18  # L3 USDC is 18-dec

FACTORY_ABI = [
    {
        "name": "createVault", "type": "function", "stateMutability": "nonpayable",
        "inputs": [
            {"name": "name", "type": "string"},
            {"name": "symbol", "type": "string"},
            {"name": "performanceFeeRate", "type": "uint256"},
            {"name": "manager", "type": "address"},
        ],
        "outputs": [{"name": "vault", "type": "address"}],
    },
    {
        "name": "VaultCreated", "type": "event",
        "inputs": [
            {"name": "vault", "type": "address", "indexed": True},
            {"name": "manager", "type": "address", "indexed": True},
            {"name": "name", "type": "string", "indexed": False},
            {"name": "symbol", "type": "string", "indexed": False},
            {"name": "performanceFeeRate", "type": "uint256", "indexed": False},
        ],
    },
]

VAULT_ABI = [
    {
        "name": "requestDeposit", "type": "function", "stateMutability": "nonpayable",
        "inputs": [
            {"name": "assets", "type": "uint256"},
            {"name": "controller", "type": "address"},
            {"name": "owner", "type": "address"},
        ],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "claimDeposit", "type": "function", "stateMutability": "nonpayable",
        "inputs": [
            {"name": "receiver", "type": "address"},
            {"name": "controller", "type": "address"},
        ],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "totalAssets", "type": "function", "stateMutability": "view",
        "inputs": [], "outputs": [{"name": "", "type": "uint256"}],
    },
]

ERC20_ABI = [
    {
        "name": "approve", "type": "function", "stateMutability": "nonpayable",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "balanceOf", "type": "function", "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "allowance", "type": "function", "stateMutability": "view",
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
        ],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]


def load_deployment() -> dict:
    if not ENVS_DEPLOYMENT_PATH.exists():
        log.error(f"Missing {ENVS_DEPLOYMENT_PATH}")
        sys.exit(1)
    return json.loads(ENVS_DEPLOYMENT_PATH.read_text())


def resolve_addr(deployment: dict, *keys: str) -> str:
    contracts = deployment.get("contracts", deployment)
    for key in keys:
        val = contracts.get(key)
        if val:
            return Web3.to_checksum_address(val)
    raise KeyError(f"None of {keys} found in deployment JSON")


def load_manager(label: str) -> str:
    path = KEYS_DIR / f"binance-{label}.json"
    if not path.exists():
        log.error(f"Missing manager key file: {path}")
        sys.exit(1)
    blob = json.loads(path.read_text())
    addr = blob.get("address")
    if not addr:
        log.error(f"{path} has no .address field")
        sys.exit(1)
    return Web3.to_checksum_address(addr)


def send_tx(w3, account, tx_dict):
    signed = account.sign_transaction(tx_dict)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
    if receipt["status"] != 1:
        raise RuntimeError(f"tx reverted: {tx_hash.hex()}")
    return receipt


def build_tx(w3, deployer, gas=300_000):
    return {
        "from": deployer,
        "gas": gas,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(deployer, "pending"),
        "chainId": w3.eth.chain_id,
    }


def extract_vault_from_logs(receipt, factory_addr: str):
    factory_lower = factory_addr.lower()
    for entry in receipt.get("logs", []):
        if entry["address"].lower() != factory_lower:
            continue
        if len(entry["topics"]) < 2:
            continue
        raw = entry["topics"][1]
        if isinstance(raw, bytes):
            return Web3.to_checksum_address("0x" + raw[-20:].hex())
        return Web3.to_checksum_address("0x" + raw.hex()[-40:])
    return None


def merge_deployment(created: list[dict]) -> None:
    """Append vault addresses into whitelistedVaults + sourceVaults, in order."""
    data = json.loads(ENVS_DEPLOYMENT_PATH.read_text())
    existing_white = data.get("whitelistedVaults") or []
    existing_src = data.get("sourceVaults") or {}

    seen = {a.lower() for a in existing_white}
    for c in created:
        if c["vault"].lower() not in seen:
            existing_white.append(c["vault"])
            seen.add(c["vault"].lower())

    for c in created:
        bucket = existing_src.setdefault(c["source"], [])
        if c["vault"] not in bucket:
            bucket.append(c["vault"])

    data["whitelistedVaults"] = existing_white
    data["sourceVaults"] = existing_src
    ENVS_DEPLOYMENT_PATH.write_text(json.dumps(data, indent=2) + "\n")
    log.info(
        f"Merged into {ENVS_DEPLOYMENT_PATH} "
        f"({len(existing_white)} whitelisted, {len(existing_src)} sources)"
    )


def main():
    parser = argparse.ArgumentParser(description="Deploy + seed 12 Binance Vision vaults")
    parser.add_argument("--rpc", default=os.environ.get("L3_RPC_URL"))
    parser.add_argument("--key", default=os.environ.get("DEPLOYER_KEY"),
                        help="Deployer private key (env: DEPLOYER_KEY)")
    parser.add_argument("--dry-run", action="store_true", help="Print plan, do nothing")
    args = parser.parse_args()

    deployment = load_deployment()

    rpc_url = args.rpc or (deployment.get("rpcUrls") or {}).get("l3")
    if not rpc_url:
        log.error("L3 RPC URL not provided (env L3_RPC_URL, --rpc, or deployment.rpcUrls.l3)")
        sys.exit(1)

    deployer_key = args.key or deployment.get("deployerPrivateKey")
    if not deployer_key:
        log.error("Deployer key not provided (env DEPLOYER_KEY, --key, or deployment.deployerPrivateKey)")
        sys.exit(1)

    factory = resolve_addr(deployment, "VisionVaultFactory")
    usdc = resolve_addr(deployment, "USDC", "L3_USDC", "USDC_ADDRESS")

    # Resolve managers up front so we fail fast if any key file is missing.
    managers: dict[str, str] = {}
    for v in VAULTS:
        managers[v["label"]] = load_manager(v["label"])

    total = len(VAULTS)
    need_wei = total * SEED_WEI

    log.info(f"Plan: {total} vaults, seed {SEED_USDC:,} USDC each ({total * SEED_USDC:,} total)")
    log.info(f"Factory: {factory}")
    log.info(f"USDC:    {usdc}")

    if args.dry_run:
        for v in VAULTS:
            log.info(f"  {v['label']:<14} {v['symbol']:<12} source={v['source']:<24} "
                     f"manager={managers[v['label']]}")
        return

    w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 60}))
    if not w3.is_connected():
        log.error(f"Cannot reach {rpc_url}")
        sys.exit(1)
    account = w3.eth.account.from_key(deployer_key)
    deployer = account.address
    log.info(f"Deployer: {deployer}  (chain_id={w3.eth.chain_id})")

    factory_c = w3.eth.contract(address=factory, abi=FACTORY_ABI)
    usdc_c = w3.eth.contract(address=usdc, abi=ERC20_ABI)

    bal = usdc_c.functions.balanceOf(deployer).call()
    log.info(f"USDC balance: {bal / 1e18:,.2f} | need: {need_wei / 1e18:,.2f}")
    if bal < need_wei:
        log.error(
            f"Insufficient USDC. Have {bal / 1e18:,.2f}, need {need_wei / 1e18:,.2f}. "
            "Mint more to deployer before running."
        )
        sys.exit(1)

    created: list[dict] = []

    # Phase 1: deploy
    for v in VAULTS:
        label, source, name, sym = v["label"], v["source"], v["name"], v["symbol"]
        manager = managers[label]
        log.info(f"[DEPLOY] {label:<14} {sym:<12} ({name}) manager={manager}")
        try:
            tx = factory_c.functions.createVault(
                name, sym, FEE_BPS, manager
            ).build_transaction(build_tx(w3, deployer, gas=5_000_000))
            rcpt = send_tx(w3, account, tx)
            vault = extract_vault_from_logs(rcpt, factory)
            if not vault:
                log.error("  no VaultCreated event in receipt")
                continue
            created.append({"label": label, "source": source, "name": name,
                            "symbol": sym, "manager": manager, "vault": vault})
            log.info(f"  -> {vault} (gas={rcpt['gasUsed']})")
        except Exception as e:
            log.error(f"  FAILED: {e}")
        time.sleep(0.2)

    log.info(f"Deployed {len(created)}/{total} vaults")

    # Phase 2: fund
    funded = 0
    for c in created:
        vault = c["vault"]
        vault_c = w3.eth.contract(address=vault, abi=VAULT_ABI)
        try:
            existing = vault_c.functions.totalAssets().call()
            if existing > 0:
                log.info(f"[SKIP] {vault} already has {existing / 1e18:.2f} USDC")
                continue
        except Exception:
            pass

        try:
            if usdc_c.functions.allowance(deployer, vault).call() < SEED_WEI:
                tx = usdc_c.functions.approve(vault, SEED_WEI).build_transaction(
                    build_tx(w3, deployer, gas=100_000)
                )
                send_tx(w3, account, tx)
            tx = vault_c.functions.requestDeposit(SEED_WEI, deployer, deployer).build_transaction(
                build_tx(w3, deployer, gas=500_000)
            )
            send_tx(w3, account, tx)
            tx = vault_c.functions.claimDeposit(deployer, deployer).build_transaction(
                build_tx(w3, deployer, gas=500_000)
            )
            send_tx(w3, account, tx)
            funded += 1
            log.info(f"[FUND] {vault} -> {SEED_USDC:,} USDC")
        except Exception as e:
            log.error(f"  FAILED funding {vault}: {e}")
        time.sleep(0.15)

    log.info(f"Funded {funded}/{len(created)} vaults")

    # Phase 3: persist into envs/testnet/active-deployment.json
    if created:
        merge_deployment(created)

    receipt_path = ROOT / "scripts" / "binance-vault-deploy-receipt.json"
    receipt_path.write_text(json.dumps({
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "deployer": deployer,
        "factory": factory,
        "fee_bps": FEE_BPS,
        "seed_amount_usdc": SEED_USDC,
        "total_deployed": len(created),
        "total_funded": funded,
        "vaults": created,
    }, indent=2) + "\n")
    log.info(f"Receipt: {receipt_path}")

    # Summary
    print()
    print(f"Created {len(created)} vaults:")
    for c in created:
        print(f"  {c['label']:<14} {c['vault']} manager {c['manager']} source {c['source']}")


if __name__ == "__main__":
    main()
