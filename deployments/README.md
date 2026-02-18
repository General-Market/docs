# Deployment Guide

## Overview

BLSCustody is deployed on multiple EVM chains using a UUPS proxy pattern. Each chain gets its own Governance, IssuerRegistry, and BLSCustody contracts (or can reuse an existing IssuerRegistry).

## Supported Chains

| Chain | Chain ID | Deployment File | Shell Script |
|-------|----------|-----------------|--------------|
| Index L3 (Orbit) | 111222333 | `l3-testnet.json` | `scripts/deploy-l3.sh` |
| Arbitrum One | 42161 | `arbitrum.json` | `scripts/deploy-arbitrum.sh` |
| Ethereum | 1 | `ethereum.json` | `scripts/deploy-ethereum.sh` |
| Base | 8453 | `base.json` | `scripts/deploy-base.sh` |
| Optimism | 10 | `optimism.json` | `scripts/deploy-optimism.sh` |

## Deployment Procedure

### Prerequisites

- [Foundry](https://getfoundry.sh) installed (`forge`, `cast`)
- Private key with sufficient native gas token on the target chain
- RPC URL for the target chain

### Step 1: Deploy Contracts

Each chain has a dedicated shell script. Example for Ethereum:

```bash
export PRIVATE_KEY=0x...
export ETHEREUM_RPC_URL=https://...
export ETHERSCAN_API_KEY=...  # Optional: for contract verification

# Optional: reuse an existing IssuerRegistry
# export ISSUER_REGISTRY_ADDRESS=0x...

./scripts/deploy-ethereum.sh
```

This deploys:
1. **Governance** (UUPS proxy) - admin set to deployer
2. **IssuerRegistry** (UUPS proxy) - linked to Governance
3. **BLSCustody** (UUPS proxy) - linked to IssuerRegistry

If `ISSUER_REGISTRY_ADDRESS` is set, steps 1-2 are skipped.

### Step 2: Propose Whitelist Targets

```bash
export PRIVATE_KEY=0x...
export RPC_URL=https://...
export BLSCUSTODY_ADDRESS=0x...  # From deployment output
export CHAIN=ethereum  # ethereum|base|optimism|arbitrum

./scripts/setup-whitelist.sh
```

This proposes:
- **1inch Aggregation Router V6** (`0x111111125421cA6dc452d289314280a0f8842A65`)
- **USDC** (chain-specific address)

**Note:** `proposeWhitelist()` requires BLS signature verification. In Phase 1 with an empty aggregated pubkey (no issuers registered), verification is skipped. Once issuers are registered, whitelist proposals must be BLS-signed by the issuer network.

### Step 3: Activate Whitelist (after 2-day timelock)

After 2 days (172800 seconds) from proposal:

```bash
cast send $BLSCUSTODY_ADDRESS \
    "activateWhitelist(address)" \
    0x111111125421cA6dc452d289314280a0f8842A65 \
    --private-key $PRIVATE_KEY \
    --rpc-url $RPC_URL

cast send $BLSCUSTODY_ADDRESS \
    "activateWhitelist(address)" \
    $USDC_ADDRESS \
    --private-key $PRIVATE_KEY \
    --rpc-url $RPC_URL
```

## Post-Deployment Verification

After deployment, verify:

1. **IssuerRegistry set correctly:**
   ```bash
   cast call $BLSCUSTODY_ADDRESS "issuerRegistry()" --rpc-url $RPC_URL
   ```

2. **Nonce is 0 (no used nonces):**
   ```bash
   cast call $BLSCUSTODY_ADDRESS "nonce()" --rpc-url $RPC_URL
   ```

3. **Re-initialization blocked:**
   ```bash
   # This should revert
   cast call $BLSCUSTODY_ADDRESS "initialize(address)" 0x0000000000000000000000000000000000000001 --rpc-url $RPC_URL
   ```

4. **ChainId in message hash (replay protection):**
   BLSCustody.execute() includes `block.chainid` in the signed message hash, preventing cross-chain replay attacks. This is inherent in the contract (line 106 of BLSCustody.sol).

## Chain-Specific Addresses

### 1inch Aggregation Router V6
Same on all EVM chains: `0x111111125421cA6dc452d289314280a0f8842A65`

### USDC
| Chain | Address |
|-------|---------|
| Ethereum | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Optimism | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` |
| Arbitrum | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |

## JSON Output Schema

Each deployment writes a JSON file to `deployments/<chain>.json`:

```json
{
  "chainId": 1,
  "deployer": "0x...",
  "timestamp": 1234567890,
  "contracts": {
    "Governance": {
      "proxy": "0x...",
      "implementation": "0x..."
    },
    "IssuerRegistry": {
      "proxy": "0x...",
      "implementation": "0x..."
    },
    "BLSCustody": {
      "proxy": "0x...",
      "implementation": "0x..."
    }
  }
}
```

When using an existing IssuerRegistry (`ISSUER_REGISTRY_ADDRESS`), only `IssuerRegistry.proxy`, `BLSCustody.proxy`, and `BLSCustody.implementation` are included (Governance is omitted).

## IssuerRegistry on Non-L3 Chains

The canonical IssuerRegistry lives on L3. For other chains, the current approach deploys a full IssuerRegistry per chain. The same issuer set must be configured on each chain to ensure the same aggregated BLS public key is used everywhere. Future enhancements may use cross-chain messaging to sync the aggregated key.
