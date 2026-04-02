#!/usr/bin/env python3
"""
extract-broadcast-addresses.py — Parse a forge broadcast JSON into a clean address map.

Reads the transactions array from a forge broadcast run-latest.json and produces
a JSON object mapping contract names to their deployed addresses.

Handles:
  - CREATE and CREATE2 transactions
  - ERC1967Proxy → implementation name matching (proxy inherits impl's name)
  - MockERC20 disambiguation via constructor args (symbol)
  - Duplicate contract names (last deployed wins, or suffixed with _2, _3, ...)

Usage:
    python3 extract-broadcast-addresses.py <broadcast.json> [--raw]

    Default output: {"Index": "0x...", "OracleRegistry": "0x...", ...}
    With --raw:     includes implementation addresses separately as <Name>_impl

Exit 0 on success, 1 on error.
"""

import json
import sys
import os


def extract_addresses(broadcast_path: str, raw: bool = False) -> dict:
    with open(broadcast_path) as f:
        data = json.load(f)

    transactions = data.get("transactions", [])

    # First pass: collect all CREATE/CREATE2 deployments
    # impl_addr_lower -> impl_name (for proxy matching)
    implementations = {}
    # impl_name -> proxy_addr (proxy replaces the impl in final output)
    proxy_map = {}
    # contract_name -> list of {address, args}
    creates = {}
    # Track all contract addresses for dedup
    all_addresses = {}

    for tx in transactions:
        tx_type = tx.get("transactionType", "")
        if tx_type not in ("CREATE", "CREATE2"):
            continue

        name = tx.get("contractName", "")
        addr = tx.get("contractAddress", "")
        args = tx.get("arguments") or []

        if not name or not addr:
            continue

        if name == "ERC1967Proxy":
            # The first argument to ERC1967Proxy is always the implementation address.
            # Match it to the implementation's name so the proxy inherits that name.
            if args:
                impl_addr = args[0]
                if isinstance(impl_addr, str):
                    impl_lower = impl_addr.lower()
                    if impl_lower in implementations:
                        impl_name = implementations[impl_lower]
                        proxy_map[impl_name] = addr
        else:
            implementations[addr.lower()] = name
            if name not in creates:
                creates[name] = []
            creates[name].append({"address": addr, "args": args})

    # Build the output map
    result = {}

    # 1. Proxied contracts: use proxy address, keyed by implementation name
    for impl_name, proxy_addr in proxy_map.items():
        # Map certain implementation names to their canonical deployment key
        key = _canonical_key(impl_name)
        result[key] = proxy_addr

        # Optionally include the raw implementation address
        if raw:
            for entry in creates.get(impl_name, []):
                result[f"{key}_impl"] = entry["address"]
                break  # Only first impl

    # 2. Non-proxied contracts
    for name, entries in creates.items():
        if name in proxy_map:
            # Already handled as proxy — skip the bare implementation
            continue

        if name == "MockERC20":
            # Disambiguate by symbol (second constructor arg)
            for entry in entries:
                args = entry.get("args", [])
                symbol = args[1] if len(args) >= 2 else ""
                key = _mock_erc20_key(symbol)
                if key:
                    result[key] = entry["address"]
                else:
                    # Unknown symbol — use generic name
                    result[f"MockERC20_{symbol}"] = entry["address"]
        elif len(entries) == 1:
            # Unique contract — use its canonical key
            key = _canonical_key(name)
            result[key] = entries[0]["address"]
        else:
            # Multiple deploys of the same contract (not a proxy scenario).
            # Keep all with suffixes.
            for i, entry in enumerate(entries):
                suffix = "" if i == 0 else f"_{i + 1}"
                key = _canonical_key(name)
                result[f"{key}{suffix}"] = entry["address"]

    return result


def _canonical_key(impl_name: str) -> str:
    """Map forge contract names to deployment JSON keys."""
    mapping = {
        "Investment": "Index",
        "Governance": "Governance",
        "OracleRegistry": "OracleRegistry",
        "L3BridgeCustody": "L3BridgeCustody",
        "SettlementBridgeCustody": "SettlementBridgeCustody",
        "BLSCustody": "BLSCustody",
        "BridgeProxy": "BridgeProxy",
        "CollateralRegistry": "CollateralRegistry",
        "MockBitgetVault": "MockBitgetVault",
        "BridgedItpFactory": "BridgedItpFactory",
        "Vision": "Vision",
        "VisionReserve": "VisionReserve",
    }
    return mapping.get(impl_name, impl_name)


def _mock_erc20_key(symbol: str) -> str:
    """Map MockERC20 symbols to deployment JSON keys."""
    if not symbol:
        return ""
    s = symbol.upper()
    if "L3_WUSDC" in s or "WUSDC" in s:
        return "L3_WUSDC"
    if "SETTLEMENT_USDC" in s:
        return "SETTLEMENT_USDC"
    if "MOCK_USDT" in s or s == "USDT":
        return "MOCK_USDT"
    # Return the symbol as-is for unknown tokens
    return symbol


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <broadcast.json> [--raw]", file=sys.stderr)
        sys.exit(1)

    broadcast_path = sys.argv[1]
    raw = "--raw" in sys.argv

    if not os.path.isfile(broadcast_path):
        print(f"File not found: {broadcast_path}", file=sys.stderr)
        sys.exit(1)

    try:
        addresses = extract_addresses(broadcast_path, raw=raw)
    except (json.JSONDecodeError, KeyError) as e:
        print(f"Failed to parse broadcast JSON: {e}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(addresses, indent=2))


if __name__ == "__main__":
    main()
