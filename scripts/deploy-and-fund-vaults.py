#!/usr/bin/env python3
"""Deploy + fund Vision vaults, one batch per source.

Reads `deployments/vision-batches.json` for the source list. For each source,
creates N vaults (default 5) via the VisionVaultFactory and seeds each with
10,000 USDC (configurable). Writes the resulting addresses into
`envs/testnet/active-deployment.json` under `whitelistedVaults` (flat) and
`sourceVaults` (keyed by source id).

Intended to run as phase [6b/14] of testnet.sh, after `DeployAllVisionBatches`
has written vision-batches.json. Everything this script needs — factory
address, USDC address, RPC URL — comes from the deployment JSON. No hardcoded
constants. No fund-branding.json.

Example:
    python3 scripts/deploy-and-fund-vaults.py --per-source 5 --seed-amount 10000
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from pathlib import Path

from web3 import Web3

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("deploy-fund")

ROOT = Path(__file__).resolve().parent.parent
VISION_BATCHES_PATH = ROOT / "deployments" / "vision-batches.json"
# testnet.sh writes the authoritative deploy state to deployments/active-deployment.json
# during deploy (DEPLOYMENT_FILE in testnet.sh). envs/testnet/ copies get synced later.
ACTIVE_DEPLOYMENT_PATH = ROOT / "deployments" / "active-deployment.json"
FRONTEND_DEPLOYMENT_PATH = ROOT / "frontend" / "lib" / "contracts" / "deployment.json"
ENVS_DEPLOYMENT_PATH = ROOT / "envs" / "testnet" / "active-deployment.json"

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


def prettify_source(source_id: str) -> str:
    """`sec_13f` -> `Sec 13F`, `mil_aircraft` -> `Mil Aircraft`."""
    parts = source_id.replace("-", "_").split("_")
    return " ".join(p.upper() if len(p) <= 3 and any(c.isdigit() for c in p) else p.capitalize() for p in parts)


def source_symbol(source_id: str) -> str:
    """`sec_13f` -> `SEC13F`. Strip non-alphanumeric, uppercase, cap at 10 chars."""
    cleaned = re.sub(r"[^A-Za-z0-9]", "", source_id).upper()
    return cleaned[:10] if cleaned else "FUND"


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


def load_deployment():
    if not ACTIVE_DEPLOYMENT_PATH.exists():
        log.error(f"Missing {ACTIVE_DEPLOYMENT_PATH}")
        sys.exit(1)
    return json.loads(ACTIVE_DEPLOYMENT_PATH.read_text())


def resolve_addr(deployment: dict, *keys: str) -> str:
    contracts = deployment.get("contracts", deployment)
    for key in keys:
        val = contracts.get(key)
        if val:
            return Web3.to_checksum_address(val)
    raise KeyError(f"None of {keys} found in deployment JSON")


def write_deployment(deployment: dict, whitelisted: list, source_vaults: dict, *, merge: bool = False):
    """Persist vault metadata into the deployment JSONs.

    `merge=True` preserves any existing entries — required when running for
    only a subset of sources, otherwise the rest of the deployment vanishes.
    """
    for path in (ACTIVE_DEPLOYMENT_PATH, FRONTEND_DEPLOYMENT_PATH, ENVS_DEPLOYMENT_PATH):
        if not path.exists():
            continue
        data = json.loads(path.read_text())
        if merge:
            existing_white = data.get("whitelistedVaults") or []
            existing_src = data.get("sourceVaults") or {}
            merged_white = list({*(existing_white), *whitelisted})
            merged_src = {**existing_src, **source_vaults}
            data["whitelistedVaults"] = merged_white
            data["sourceVaults"] = merged_src
        else:
            data["whitelistedVaults"] = whitelisted
            data["sourceVaults"] = source_vaults
        path.write_text(json.dumps(data, indent=2) + "\n")
        log.info(
            f"Updated {path} ({len(data['whitelistedVaults'])} vaults total, "
            f"{len(data['sourceVaults'])} sources total)"
        )


def main():
    parser = argparse.ArgumentParser(description="Deploy + fund Vision vaults per source")
    parser.add_argument("--per-source", type=int, default=5, help="Vaults per Vision source (default 5)")
    parser.add_argument("--seed-amount", type=float, default=10_000, help="USDC per vault (default 10000)")
    parser.add_argument("--fee-bps", type=int, default=1000, help="Performance fee in bps (default 1000 = 10%%)")
    parser.add_argument("--rpc", default=os.environ.get("L3_RPC_URL", "http://142.132.164.24/"))
    parser.add_argument("--key", default=os.environ.get("DEPLOYER_KEY"), help="Deployer private key (env: DEPLOYER_KEY)")
    parser.add_argument("--dry-run", action="store_true", help="Print plan, do nothing")
    parser.add_argument(
        "--sources", default="",
        help="Comma-separated source filter (e.g. crypto,stocks,esports). When set, "
             "only these sources are deployed and the deployment JSONs are merged "
             "into rather than replaced.",
    )
    parser.add_argument(
        "--allow-missing-batches", action="store_true",
        help="Allow deploying for sources that aren't in vision-batches.json. The "
             "oracle's lifecycle still creates rounds via data-node /batches/recommended; "
             "the static file is just a fallback.",
    )
    args = parser.parse_args()

    if not args.key:
        log.error("DEPLOYER_KEY env var or --key required")
        sys.exit(1)

    deployment = load_deployment()
    factory = resolve_addr(deployment, "VisionVaultFactory")
    usdc = resolve_addr(deployment, "L3_USDC", "USDC_ADDRESS", "USDC")

    if not VISION_BATCHES_PATH.exists():
        if not args.allow_missing_batches:
            log.error(f"Missing {VISION_BATCHES_PATH} — run Vision batches deploy first")
            sys.exit(1)
        batches = {"batches": {}}
    else:
        batches = json.loads(VISION_BATCHES_PATH.read_text())
    sources = sorted(batches.get("batches", {}).keys())

    if args.sources:
        requested = [s.strip() for s in args.sources.split(",") if s.strip()]
        if not args.allow_missing_batches:
            missing = [s for s in requested if s not in sources]
            if missing:
                log.error(
                    f"Sources not in vision-batches.json: {missing}. "
                    f"Pass --allow-missing-batches to deploy anyway "
                    f"(oracle uses data-node /batches/recommended at runtime)."
                )
                sys.exit(1)
        sources = requested
        log.info(f"Sources filter active: {sources}")

    if not sources:
        log.error("No sources to deploy for")
        sys.exit(1)

    total = len(sources) * args.per_source
    seed_wei = int(args.seed_amount * 10**18)
    log.info(f"Plan: {len(sources)} sources x {args.per_source} vaults = {total} vaults")
    log.info(f"Seed: {args.seed_amount:,.0f} USDC each -> {total * args.seed_amount:,.0f} USDC total")
    log.info(f"Factory: {factory}")
    log.info(f"USDC:    {usdc}")

    if args.dry_run:
        for src in sources:
            names = [f"{prettify_source(src)} Fund {i+1}" for i in range(args.per_source)]
            log.info(f"  {src}: {names}")
        return

    w3 = Web3(Web3.HTTPProvider(args.rpc, request_kwargs={"timeout": 60}))
    if not w3.is_connected():
        log.error(f"Cannot reach {args.rpc}")
        sys.exit(1)
    account = w3.eth.account.from_key(args.key)
    deployer = account.address
    log.info(f"Deployer: {deployer}  (chain_id={w3.eth.chain_id})")

    factory_c = w3.eth.contract(address=factory, abi=FACTORY_ABI)
    usdc_c = w3.eth.contract(address=usdc, abi=ERC20_ABI)

    bal = usdc_c.functions.balanceOf(deployer).call()
    need = total * seed_wei
    log.info(f"USDC balance: {bal / 1e18:,.2f} | need: {need / 1e18:,.2f}")
    if bal < need:
        log.error("Insufficient USDC. Mint more to deployer before running.")
        sys.exit(1)

    source_vaults: dict = {}
    all_vaults: list = []

    # Phase 1: deploy
    for src in sources:
        symbol = source_symbol(src)
        pretty = prettify_source(src)
        source_vaults[src] = []
        for i in range(args.per_source):
            name = f"{pretty} Fund {i+1}"
            sym = f"{symbol}{i+1}"
            log.info(f"[DEPLOY] {src} #{i+1} -> {sym} ({name})")
            try:
                tx = factory_c.functions.createVault(
                    name, sym, args.fee_bps, deployer
                ).build_transaction(build_tx(w3, deployer, gas=5_000_000))
                rcpt = send_tx(w3, account, tx)
                vault = extract_vault_from_logs(rcpt, factory)
                if not vault:
                    log.error("  no VaultCreated event in receipt")
                    continue
                source_vaults[src].append(vault)
                all_vaults.append(vault)
                log.info(f"  -> {vault} (gas={rcpt['gasUsed']})")
            except Exception as e:
                log.error(f"  FAILED: {e}")
            time.sleep(0.2)

    log.info(f"Deployed {len(all_vaults)}/{total} vaults")

    # Phase 2: fund
    funded = 0
    for vault in all_vaults:
        vault_c = w3.eth.contract(address=vault, abi=VAULT_ABI)
        try:
            existing = vault_c.functions.totalAssets().call()
            if existing > 0:
                log.info(f"[SKIP] {vault} already has {existing / 1e18:.2f} USDC")
                continue
        except Exception:
            pass

        try:
            if usdc_c.functions.allowance(deployer, vault).call() < seed_wei:
                tx = usdc_c.functions.approve(vault, seed_wei).build_transaction(
                    build_tx(w3, deployer, gas=100_000)
                )
                send_tx(w3, account, tx)
            tx = vault_c.functions.requestDeposit(seed_wei, deployer, deployer).build_transaction(
                build_tx(w3, deployer, gas=500_000)
            )
            send_tx(w3, account, tx)
            tx = vault_c.functions.claimDeposit(deployer, deployer).build_transaction(
                build_tx(w3, deployer, gas=500_000)
            )
            send_tx(w3, account, tx)
            funded += 1
            log.info(f"[FUND] {vault} -> {args.seed_amount:,.0f} USDC")
        except Exception as e:
            log.error(f"  FAILED funding {vault}: {e}")
        time.sleep(0.15)

    log.info(f"Funded {funded}/{len(all_vaults)} vaults")

    # Phase 3: persist. Merge mode preserves the rest of the deployment
    # JSONs when only a subset of sources was deployed.
    write_deployment(
        deployment, all_vaults, source_vaults, merge=bool(args.sources),
    )

    receipt_path = ROOT / "scripts" / "vault-deploy-receipt.json"
    receipt_path.write_text(json.dumps({
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "deployer": deployer,
        "factory": factory,
        "per_source": args.per_source,
        "seed_amount_usdc": args.seed_amount,
        "fee_bps": args.fee_bps,
        "total_deployed": len(all_vaults),
        "total_funded": funded,
        "source_vaults": source_vaults,
    }, indent=2) + "\n")
    log.info(f"Receipt: {receipt_path}")


if __name__ == "__main__":
    main()
