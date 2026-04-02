#!/usr/bin/env python3
"""Deploy and fund all Vision vaults from fund-branding.json.

Reads the fund catalog, deploys vaults for any fund missing one,
seeds each vault with 50 USDC, and updates all config files.
"""

import json, os, sys, time, logging
from pathlib import Path
from web3 import Web3

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("deploy-fund")

# ── Constants ────────────────────────────────────────────────────────

SEED_AMOUNT = 50 * 10**18  # 50 USDC (18 decimals on L3)
FACTORY = Web3.to_checksum_address("0xbc418956A20DB5C343b56b6AE947AF4896b23A1e")
USDC = Web3.to_checksum_address("0x2710e49EBb807A0cB9369F13Ba24Bd809809a827")
RPC = "http://142.132.164.24/"

ROOT = Path(__file__).resolve().parent.parent
BRANDING_PATH = ROOT / "frontend" / "data" / "fund-branding.json"
DEPLOYMENT_PATH = ROOT / "frontend" / "lib" / "contracts" / "deployment.json"
DEPLOYMENT_TESTNET_PATH = ROOT / "envs" / "testnet" / "deployment.json"
FUNDS_TOML_PATH = ROOT / "vision-bot" / "funds.toml"

# ── ABIs ─────────────────────────────────────────────────────────────

FACTORY_ABI = [
    {
        "name": "createVault", "type": "function", "stateMutability": "nonpayable",
        "inputs": [
            {"name": "name", "type": "string"}, {"name": "symbol", "type": "string"},
            {"name": "performanceFeeRate", "type": "uint256"}, {"name": "manager", "type": "address"},
        ],
        "outputs": [{"name": "vault", "type": "address"}],
    },
    {
        "name": "getVaultCount", "type": "function", "stateMutability": "view",
        "inputs": [], "outputs": [{"name": "", "type": "uint256"}],
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
            {"name": "assets", "type": "uint256"}, {"name": "controller", "type": "address"},
            {"name": "owner", "type": "address"},
        ],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "claimDeposit", "type": "function", "stateMutability": "nonpayable",
        "inputs": [
            {"name": "receiver", "type": "address"}, {"name": "controller", "type": "address"},
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
        "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "balanceOf", "type": "function", "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "allowance", "type": "function", "stateMutability": "view",
        "inputs": [{"name": "owner", "type": "address"}, {"name": "spender", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]


# ── Helpers ──────────────────────────────────────────────────────────

def send_tx(w3, account, tx_dict):
    """Sign, send, and wait for a transaction. Returns the receipt."""
    signed = account.sign_transaction(tx_dict)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt["status"] != 1:
        raise RuntimeError(f"tx reverted: {tx_hash.hex()}")
    return receipt


def next_nonce(w3, address):
    return w3.eth.get_transaction_count(address, "pending")


def build_tx(w3, deployer, gas=300_000):
    return {
        "from": deployer,
        "gas": gas,
        "gasPrice": w3.eth.gas_price,
        "nonce": next_nonce(w3, deployer),
        "chainId": w3.eth.chain_id,
    }


# ── Strategy/source mapping for funds.toml ──────────────────────────

STRATEGY_MAP = {
    "Momentum": "momentum",
    "Contrarian": "contrarian",
    "Bullish": "bullish",
    "Home Field": "home_field",
}


def write_funds_toml(catalog):
    """Update vault addresses in funds.toml in-place; append new funds at end.

    The toml has hand-curated params (min_change_pct, source names, comments)
    that fund-branding.json doesn't carry. So we surgically update vault lines
    for existing symbols and only append truly new funds.
    """
    import re

    content = FUNDS_TOML_PATH.read_text()
    lines = content.splitlines()

    # Build symbol -> vault map from catalog
    vault_by_symbol = {f["symbol"]: f.get("vault", "") for f in catalog["funds"]}

    # Track which symbols exist in the toml already
    existing_symbols = set()

    # Pass 1: update vault lines for existing [[funds]] entries
    current_symbol = None
    for i, line in enumerate(lines):
        m = re.match(r'^symbol\s*=\s*"([^"]+)"', line)
        if m:
            current_symbol = m.group(1)
            existing_symbols.add(current_symbol)
        elif current_symbol and re.match(r'^vault\s*=\s*"', line):
            new_vault = vault_by_symbol.get(current_symbol, "")
            if new_vault:
                lines[i] = f'vault = "{new_vault}"'
            current_symbol = None

    # Pass 2: append new funds not already in the toml
    new_funds = [f for f in catalog["funds"] if f["symbol"] not in existing_symbols and f.get("vault")]
    if new_funds:
        lines.append("")
        lines.append("# ── NEW FUNDS (auto-generated) ──────────────────────────────")
        lines.append("")
        for idx, fund in enumerate(new_funds, len(existing_symbols) + 1):
            strategy_raw = fund.get("strategy", "momentum")
            strategy = STRATEGY_MAP.get(strategy_raw, strategy_raw.lower())
            sources = fund.get("sources", [])
            lines.append(f"# {idx}. {fund['name']}")
            lines.append("[[funds]]")
            lines.append(f'name = "{fund["name"]}"')
            lines.append(f'symbol = "{fund["symbol"]}"')
            lines.append(f'vault = "{fund["vault"]}"')
            lines.append(f'sources = {json.dumps(sources)}')
            lines.append(f'strategy = "{strategy}"')
            lines.append("[funds.params]")
            lines.append("")

    FUNDS_TOML_PATH.write_text("\n".join(lines) + "\n")
    log.info(f"Updated {FUNDS_TOML_PATH} ({len(existing_symbols)} existing, {len(new_funds)} new)")


def update_deployment_json(catalog):
    """Update whitelistedVaults in both deployment.json copies."""
    vaults = [f["vault"] for f in catalog["funds"] if f.get("vault")]

    for path in [DEPLOYMENT_PATH, DEPLOYMENT_TESTNET_PATH]:
        data = json.loads(path.read_text())
        data["whitelistedVaults"] = vaults
        path.write_text(json.dumps(data, indent=2) + "\n")
        log.info(f"Updated {path} ({len(vaults)} vaults)")


# ── Main ─────────────────────────────────────────────────────────────

def main():
    key = os.environ.get(
        "DEPLOYER_KEY",
        "0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537",
    )
    w3 = Web3(Web3.HTTPProvider(RPC, request_kwargs={"timeout": 60}))
    if not w3.is_connected():
        log.error("Cannot connect to RPC")
        sys.exit(1)

    account = w3.eth.account.from_key(key)
    deployer = account.address
    log.info(f"Deployer: {deployer}")
    log.info(f"Chain ID: {w3.eth.chain_id}")

    catalog = json.loads(BRANDING_PATH.read_text())
    total = len(catalog["funds"])
    log.info(f"Fund catalog: {total} funds")

    factory = w3.eth.contract(address=FACTORY, abi=FACTORY_ABI)
    usdc = w3.eth.contract(address=USDC, abi=ERC20_ABI)

    balance = usdc.functions.balanceOf(deployer).call()
    log.info(f"USDC balance: {balance / 1e18:,.2f}")

    needs_deploy = [f for f in catalog["funds"] if not f.get("vault")]
    needs_fund = []  # will be populated after deploy phase
    log.info(f"Vaults to deploy: {len(needs_deploy)}")

    # ── Phase 1: Deploy missing vaults ───────────────────────────────

    deployed_count = 0
    for fund in needs_deploy:
        name = fund["name"]
        symbol = fund["symbol"]
        fee = fund["fee"]

        log.info(f"[DEPLOY] {symbol} — {name} (fee={fee})")
        try:
            tx = factory.functions.createVault(
                name, symbol, fee, deployer
            ).build_transaction(build_tx(w3, deployer, gas=5_000_000))
            receipt = send_tx(w3, account, tx)

            # Extract vault address from logs — the VaultCreated event has vault as first indexed topic
            vault_addr = None
            for entry in receipt.get("logs", []):
                if entry["address"].lower() == FACTORY.lower() and len(entry["topics"]) >= 2:
                    # topic[0] = event sig, topic[1] = vault (indexed address)
                    raw = entry["topics"][1]
                    if isinstance(raw, bytes):
                        vault_addr = Web3.to_checksum_address("0x" + raw[-20:].hex())
                    else:
                        vault_addr = Web3.to_checksum_address("0x" + raw.hex()[-40:])
                    break
            if not vault_addr:
                log.error(f"  No vault address in logs for {symbol}")
                continue
            fund["vault"] = vault_addr
            deployed_count += 1
            log.info(f"  -> {vault_addr} (gas={receipt['gasUsed']})")

            # Save progress every 10 deploys
            if deployed_count % 10 == 0:
                BRANDING_PATH.write_text(json.dumps(catalog, indent=2) + "\n")
                log.info(f"  [checkpoint] saved {deployed_count} new vaults")

        except Exception as e:
            log.error(f"  FAILED: {e}")
            # Save what we have so far
            BRANDING_PATH.write_text(json.dumps(catalog, indent=2) + "\n")
            continue

        time.sleep(0.5)

    if deployed_count > 0:
        BRANDING_PATH.write_text(json.dumps(catalog, indent=2) + "\n")
        log.info(f"Deployed {deployed_count} new vaults")

    # ── Phase 2: Fund all vaults with seed USDC ──────────────────────

    funded_count = 0
    skipped_count = 0
    failed_count = 0

    fundable = [f for f in catalog["funds"] if f.get("vault")]
    log.info(f"Vaults to check/fund: {len(fundable)}")

    # Re-check balance
    balance = usdc.functions.balanceOf(deployer).call()
    needed = len(fundable) * SEED_AMOUNT
    log.info(f"USDC balance: {balance / 1e18:,.2f} | needed (max): {needed / 1e18:,.2f}")

    for fund in fundable:
        name = fund["name"]
        symbol = fund["symbol"]
        vault_addr = Web3.to_checksum_address(fund["vault"])
        vault = w3.eth.contract(address=vault_addr, abi=VAULT_ABI)

        # Check if already funded
        try:
            assets = vault.functions.totalAssets().call()
            if assets > 0:
                log.info(f"[SKIP] {symbol} — already funded ({assets / 1e18:.2f} USDC)")
                skipped_count += 1
                continue
        except Exception:
            pass

        log.info(f"[FUND] {symbol} — {name} @ {vault_addr}")

        try:
            # Step 1: Approve USDC spend
            allowance = usdc.functions.allowance(deployer, vault_addr).call()
            if allowance < SEED_AMOUNT:
                log.info(f"  approve {SEED_AMOUNT / 1e18:.0f} USDC")
                tx = usdc.functions.approve(vault_addr, SEED_AMOUNT).build_transaction(
                    build_tx(w3, deployer, gas=100_000)
                )
                send_tx(w3, account, tx)

            # Step 2: requestDeposit
            log.info(f"  requestDeposit")
            tx = vault.functions.requestDeposit(
                SEED_AMOUNT, deployer, deployer
            ).build_transaction(build_tx(w3, deployer, gas=500_000))
            send_tx(w3, account, tx)

            # Step 3: claimDeposit
            log.info(f"  claimDeposit")
            tx = vault.functions.claimDeposit(deployer, deployer).build_transaction(
                build_tx(w3, deployer, gas=500_000)
            )
            send_tx(w3, account, tx)

            funded_count += 1
            log.info(f"  -> funded {SEED_AMOUNT / 1e18:.0f} USDC")

        except Exception as e:
            log.error(f"  FAILED: {e}")
            failed_count += 1
            continue

        time.sleep(0.3)

    # ── Phase 3: Update config files ─────────────────────────────────

    BRANDING_PATH.write_text(json.dumps(catalog, indent=2) + "\n")
    log.info(f"Saved {BRANDING_PATH}")

    update_deployment_json(catalog)
    write_funds_toml(catalog)

    # ── Receipt ──────────────────────────────────────────────────────

    receipt_path = ROOT / "scripts" / "vault-deploy-receipt.json"
    receipt_data = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "deployer": deployer,
        "total_funds": total,
        "deployed": deployed_count,
        "funded": funded_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "vaults": {
            f["symbol"]: f.get("vault", "")
            for f in catalog["funds"]
        },
    }
    receipt_path.write_text(json.dumps(receipt_data, indent=2) + "\n")
    log.info(f"Receipt: {receipt_path}")

    log.info(f"Done: {deployed_count} deployed, {funded_count} funded, {skipped_count} skipped, {failed_count} failed")


if __name__ == "__main__":
    main()
