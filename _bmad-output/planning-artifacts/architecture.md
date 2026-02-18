---
title: Index L3 Architecture
version: 2.1
date: 2026-02-01
status: READY FOR IMPLEMENTATION
changelog: |
  v2.1 - Cross-chain ITP creation via BridgeProxy (Story 6.21):
  - Added BridgeProxy, BridgedItpFactory, BridgedITP contracts to Section 4 & 5
  - Added cross-chain ITP creation flow to Section 11 (ITP Management)
  - Added ITP_CREATION_PROPOSAL/SIGN to P2P message types
  - Added ITP creation consensus to Section 22 threshold table
  - BridgeProxy on Arbitrum handles: ITP creation, token bridging, BridgedITP deployment
  - Added Stateless ITP Creation Processing section (per-cycle chain queries, no in-memory state)
  v2.0 - Architecture compliance audit (code-vs-spec sync):
  - Updated Section 5 directory tree to match actual code (TypesLib consolidation, BLSCustody/ITP in core/, AssetPairRegistry, Governance.sol, extra interfaces)
  - Updated Section 4 contract architecture to reflect actual multi-contract structure (registries, custody, Governance)
  - Updated OrderStatus enum: added BATCHED, CANCELLED, EXPIRED values
  - Renamed processBatch → confirmBatch in BLS replay protection (Section 16)
  - Renamed RotationRequest → KeyRotation, STUCK_ROTATION_THRESHOLD → ADMIN_FORCE_WINDOW in key rotation (Section 17)
  - Updated pendingUpgrade to separate fields (pendingUpgradeImpl, pendingUpgradeProposedAt, pendingUpgradeIsEmergency)
  - Replaced isRotationSafe() standalone function with inline safe period check
  - Updated Section 20 project structure: removed frontend/, added common/ crate
  - Logged genuine code gaps to backlog.md: netting steps 3/7, minBuyAmount, SELL orders, BLS mocks, NAV stub, peer discovery
  v1.9 - Validated proposals from adversarial review:
  - REMOVED inter-custody debt system (always bridge for cross-chain, simpler accounting)
  - Two-phase bridge with source lock verification (lock→verify→release)
  - Bridge reversal with 15/20 threshold after 1-hour timeout
  - Key rotation safe period with 10-cycle grace for old key
  - 48-hour stuck rotation admin escape hatch
  - Fusion+ uses standard AP retry pattern (60s timeout, 3 retries)
  - Emergency withdrawal is manual admin process only
  v1.8 - Security hardening from adversarial review:
  - AP Accountability with limit order enforcement (no slashing, suspension only)
  - Bridge Timeout Handling (60 min timeout, unlock mechanism)
  - Swap Rollback Protocol (30 min timeout, auto-refund on failure)
  - Custody Whitelist Management (BLS-controlled add/remove with timelock)
  - Custody UUPS Upgrade Pattern (15/20 + 7-day timelock)
  - Price Staleness Check (10s CEX, 30s DEX, 60s low-liquidity)
  - 1inch API Rate Limit Strategy (multiple keys, backoff, caching, fallback)
  - Order Deadline Enforcement (auto-refund expired orders)
  - Cross-Chain ITP Purchase from Arbitrum (buy ITP without bridging to L3)
  v1.7 - Merged crosschain-swap-flow.md decisions:
  - Multi-chain BLS Custody (Arbitrum, Ethereum, Base, Optimism, Solana/Squads)
  - BLS-Piloted Issuer Bridge (always bridge, no debt)
  - Unified Netting Engine (7-step pipeline)
  - All orders are limit orders (no market orders)
  - Split execution with pair merging + slippage tiers
  - Issuer key rotation with 10/19 approval + safe period
  - Stateless collateral tracking via on-chain registry
---

# Index L3 - System Architecture

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Network & Infrastructure](#2-network--infrastructure)
3. [Actors & Roles](#3-actors--roles)
4. [Technology Stack](#4-technology-stack)
5. [Smart Contract Architecture](#5-smart-contract-architecture)
6. [Order System](#6-order-system)
7. [Issuer Cycle](#7-issuer-cycle-1-second)
8. [Unified Netting Engine](#8-unified-netting-engine)
9. [AP Buffer Strategy](#9-ap-buffer-strategy)
10. [Throughput & Priority](#10-throughput--priority)
11. [ITP Management](#11-itp-management)
12. [Asset Listing & Pair System](#12-asset-listing--pair-system)
13. [Multi-Chain Collateral & Custody](#13-multi-chain-collateral--custody)
14. [Order Routing & Cross-Chain Execution](#14-order-routing--cross-chain-execution)
15. [Economics](#15-economics)
16. [Security & Recovery](#16-security--recovery)
17. [Issuer Key Management](#17-issuer-key-management)
18. [Governance & Policies](#18-governance--policies)
19. [Implementation Priority](#19-implementation-priority)
20. [Project Structure & Local Testing](#20-project-structure--local-testing)
21. [Operations](#21-operations)
22. [Issuer Consensus Reference](#22-issuer-consensus-reference)
23. [Visual References](#23-visual-references)
24. [Open Items (Future)](#24-open-items-future)

**Appendices:**
- [A: Flow Diagrams](#appendix-a-flow-diagrams)
- [B: Data Structures](#appendix-b-data-structures)
- [C: Partial Fill Handling](#appendix-c-partial-fill-handling)
- [D: Issuer State Reconstruction](#appendix-d-issuer-state-reconstruction)
- [E: Cross-Chain Execution Examples](#appendix-e-cross-chain-execution-examples)

---

## 1. SYSTEM OVERVIEW

**Purpose:** Decentralized index fund platform on Index L3 (Orbit chain) enabling users to trade Index Token Products (ITPs) backed by real assets through coordinated Issuer Network, Authorized Participants (APs), and on-chain custody.

**Core Principles:**
- Decentralized & trustless (as much as possible)
- Stateless issuer nodes (rebootable from on-chain state)
- BLS signature consensus for all critical operations
- ERC4626 standard for ITPs

---

## 2. NETWORK & INFRASTRUCTURE

| Parameter | Value |
|-----------|-------|
| Network | Index L3 (Arbitrum Orbit) |
| Chain ID | 111222333 |
| RPC | https://index.rpc.zeeve.net |
| Gas Token | IND (free for issuers) |
| Collateral | Bridged USDC |
| Block Time | ~250ms |
| Cycle Time | 1 second |
| USDC Decimals (Arbitrum) | 6 |
| USDC Decimals (L3 Internal) | 18 |
| Decimal Conversion Factor | 10^12 |

### 2.1 USDC Decimal Handling (Story 7-6b)

The protocol uses different decimal representations for USDC on different chains:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DECIMAL CONVERSION FLOW                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ARBITRUM (Real USDC = 6 decimals)                 │    │
│  │                                                                      │    │
│  │   User: 100 USDC = 100_000_000 (6 dec)                              │    │
│  │                         │                                            │    │
│  │   ArbBridgeCustody ─────┼───── ENTRY POINT                          │    │
│  │   IssuerCustodyArb      │      (buyITPFromArbitrum)                  │    │
│  │                         ▼                                            │    │
│  │              ┌──────────────────────┐                               │    │
│  │              │  NORMALIZE (×10^12)  │                               │    │
│  │              │  6 dec → 18 dec      │                               │    │
│  │              └──────────────────────┘                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    INDEX L3 (Internal = 18 decimals)                 │    │
│  │                                                                      │    │
│  │   100 USDC = 100_000_000_000_000_000_000 (18 dec)                   │    │
│  │                                                                      │    │
│  │   - Index.sol orders                                                │    │
│  │   - ITP vaults (ERC4626)                                            │    │
│  │   - L3Usdc (18 decimals)                                            │    │
│  │   - All issuer internal calculations                                │    │
│  │   - P2P message amounts                                             │    │
│  │   - BLS signature message hashes                                    │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ARBITRUM (Real USDC = 6 decimals)                 │    │
│  │                                                                      │    │
│  │              ┌──────────────────────┐                               │    │
│  │              │ DENORMALIZE (÷10^12) │                               │    │
│  │              │  18 dec → 6 dec      │                               │    │
│  │              └──────────────────────┘                               │    │
│  │                         │                                            │    │
│  │   ArbBridgeCustody ─────┼───── EXIT POINT                           │    │
│  │   IssuerCustodyArb      │      (completeBridge, execute)            │    │
│  │   MockBitgetVault       ▼                                            │    │
│  │                                                                      │    │
│  │   User receives: 100 USDC = 100_000_000 (6 dec)                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Implementation Details:**
- **DecimalLib.sol**: Solidity library with `toInternal()` and `toUsdc()` functions
- **common/decimals.rs**: Rust module with `to_internal()` and `to_usdc()` functions
- **Dust Handling**: When converting 18→6 decimals, any remainder (< 10^12) is truncated. Max loss per transaction: ~$0.000001
- **Contract Validation**: L3BridgeCustody and Index.sol validate USDC has 18 decimals on initialization
- **Suspicious Amount Detection**: Issuer warns if amount < 10^12 (likely 6-decimal value used by mistake)

---

## 3. ACTORS & ROLES

| Actor | On-Chain Permissions | Off-Chain Access |
|-------|---------------------|------------------|
| **User** | Submit orders | None |
| **Issuer Network** (20 nodes) | Batch, fill orders, update inventory | View-only Bitget API |
| **AP/Keeper** | Push BLS-signed txs, execute trades | Trade on Bitget |
| **Asset Manager** | Propose ITP, propose rebalance | None |
| **Admin** | Elect issuers, emergency pause | Full governance |

### Issuer Network Details
- **Count:** 20 nodes
- **Leader Election:** `hash(lastAcceptedBLSSignature) mod numIssuers`
- **Discovery:** On-chain registry with IPs
- **Removal:** BLS vote to kick, triggers key recomputation
- **Addition:** Admin adds, triggers BLS key recomputation
- **Minimum to operate:** 3 issuers

### AP/Keeper Distinction
- Same entity, different roles
- **AP:** Unique per source (e.g., one AP for Bitget)
- **Keeper:** Can have multiple, pushes on-chain txs

### Issuer ↔ AP Communication Model

**CRITICAL: Issuers and APs DO NOT communicate directly.**

```
┌─────────────┐                    ┌─────────────┐
│   ISSUERS   │  ──── NO P2P ────  │     AP      │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  BLS-signed batch               │  Read TradeRequest events
       ▼                                  ▼
┌─────────────────────────────────────────────────┐
│                   BLOCKCHAIN                     │
│  - TradeRequest events (issuers emit)           │
│  - Withdrawal events (issuers emit)             │
│  - Fill confirmations (issuers verify & emit)   │
└─────────────────────────────────────────────────┘
```

**AP Responsibilities (on-chain only):**
1. Monitor blockchain for `TradeRequest` events
2. Execute trades on CEX (Bitget)
3. Monitor blockchain for `WithdrawalRequest` events
4. Push withdrawals to CEX
5. **NO direct communication with issuers**

**Issuer Fill Verification:**
1. Issuers have read-only Bitget API access
2. Issuers poll Bitget trade history directly (not via AP)
3. Issuers compare expected fills vs actual Bitget trades
4. If fills match → emit BLS-signed `FillConfirmation`
5. If mismatch → flag AP, continue monitoring
6. After N mismatches → issuers vote to suspend AP

---

## 4. TECHNOLOGY STACK

### Smart Contracts
| Component | Technology |
|-----------|------------|
| Language | Solidity |
| Framework | Foundry |
| Pattern | Morpho-style (minimal core + libraries) |
| Upgrades | UUPS Proxy (OpenZeppelin) |
| Storage | Simple mappings (Proposal A) |

### Contract Architecture (UUPS Proxy Pattern)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         UUPS PROXY PATTERN (All Contracts)                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  CORE (Index L3):                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Governance   │  │  Index.sol   │  │   ITP.sol    │  │ BLSCustody   │     │
│  │ +UUPS        │  │ +UUPS        │  │ +UUPS        │  │ +UUPS        │     │
│  │ - admin      │  │ - ITPs       │  │ - ERC4626    │  │ - execute    │     │
│  │ - pause      │  │ - orders     │  │ - onlyIndex  │  │ - whitelist  │     │
│  │ - upgrade    │  │ - batching   │  │ - mint/burn  │  │ - nonce map  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                                               │
│  REGISTRIES:                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ IssuerReg    │  │CollateralReg │  │   FeeReg     │  │AssetPairReg  │     │
│  │ +UUPS        │  │ +UUPS        │  │ +UUPS        │  │ +UUPS        │     │
│  │ - BLS keys   │  │ - per ITP    │  │ - fee calc   │  │ - pair defs  │     │
│  │ - rotation   │  │ - per chain  │  │ - distribute │  │ - routing    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                                               │
│  CUSTODY (Bridge):                                                           │
│  ┌──────────────┐  ┌──────────────┐                                          │
│  │L3BridgeCust  │  │ArbBridgeCust │                                          │
│  │ +UUPS        │  │ +UUPS        │                                          │
│  │ - lock/init  │  │ - verify/rel │                                          │
│  └──────────────┘  └──────────────┘                                          │
│                                                                               │
│  BRIDGE (Arbitrum - Cross-Chain ITP):                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                        │
│  │ BridgeProxy  │  │BridgedItpFac │  │  BridgedITP  │                        │
│  │ +UUPS        │  │              │  │  (per ITP)   │                        │
│  │ - ITP create │  │ - deploy ITP │  │ - ERC20      │                        │
│  │ - bridge tok │  │ - only proxy │  │ - mint/burn  │                        │
│  └──────────────┘  └──────────────┘  └──────────────┘                        │
│                                                                               │
│  No separate ProxyAdmin needed (upgrade logic in impl)                       │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Governance.sol** - Admin & access control:
- Admin functions (single EOA Phase 1, multisig later)
- Emergency pause/unpause
- Upgrade authorization (`_authorizeUpgrade`)

**Index.sol** - Core order system:
- ITP creation, weights, inventory
- Order submission (`submitOrder`) and batch confirmation (`confirmBatch`)
- Fill confirmation (`confirmFills`) and expired order refunds (`refundExpiredOrder`)
- Price updates (BLS-signed)
- References Governance for auth checks

**IssuerRegistry.sol** - Issuer management (separated from Governance):
- Issuer addresses, IPs, BLS pubkeys
- Aggregated BLS public key management (ecAdd/ecNegate)
- Key rotation with timelock + safe period + grace cycles

**Why UUPS:**
- No separate ProxyAdmin contract to manage
- Cheaper deployment (~24k gas saved vs Transparent)
- Upgrade logic in implementation = you control it
- OpenZeppelin battle-tested
- Single admin model fits Phase 1

### Off-Chain Services
| Component | Technology |
|-----------|------------|
| Issuer Nodes | Rust |
| AP/Keeper | Rust |
| P2P Protocol | TCP + TLS + MessagePack |
| BLS Curve | BN254 (precompile available) |

### Issuer P2P Message Types

| Message Type | Sender | Receiver | Timeout | Retry |
|--------------|--------|----------|---------|-------|
| `CYCLE_START` | Leader | All | - | - |
| `PRICE_PROPOSAL` | Leader | All | 200ms | 1 |
| `PRICE_VOTE` | All | Leader | 300ms | 0 |
| `BATCH_PROPOSAL` | Leader | All | 200ms | 1 |
| `BATCH_SIGN` | All | Leader | 300ms | 0 |
| `HEARTBEAT` | All | All | 1000ms | - |
| `KICK_VOTE` | Any | All | 500ms | 0 |
| `ITP_CREATION_PROPOSAL` | Leader | All | 200ms | 1 |
| `ITP_CREATION_SIGN` | All | Leader | 300ms | 0 |

### BLS Configuration
| Aspect | Decision |
|--------|----------|
| Efficiency | Option C: Batched Multi-Message |
| On-Chain Verification | BN254 precompile (~100-150k gas) |
| Key Storage | Phase 1: Software wallet (encrypted file) |
| Key Rotation | Via add/remove issuer (see below) |

### BLS Key Recreation Algorithm

For BN254 BLS, the aggregated public key is:
```
AggPubKey = PubKey_1 + PubKey_2 + ... + PubKey_n (elliptic curve addition)
```

**Add New Issuer:**
```
1. Admin calls IssuerRegistry.addIssuer(address, ip, pubKey)
2. On-chain:
   new_agg_pubkey = ecAdd(current_agg_pubkey, new_issuer_pubkey)
   store new_agg_pubkey
   emit IssuerAdded(address, pubKey, new_agg_pubkey)
3. All issuers see event, update local state
4. New issuer syncs from on-chain state, connects to peers

Gas: ~50k for ecAdd precompile + storage
```

**Remove Issuer:**
```
1. Trigger: BLS vote to kick OR admin removal
2. On-chain (subtract = add negation):
   neg_pubkey = ecNegate(removed_issuer_pubkey)
   new_agg_pubkey = ecAdd(current_agg_pubkey, neg_pubkey)
   mark issuer as inactive
   emit IssuerRemoved(address, new_agg_pubkey)
3. Remaining issuers continue with new aggregate
4. Leader election recalculated with new issuer count
```

**Key Compromise Recovery:**
```
1. Compromised issuer initiates: rotateKey(old_pubkey, new_pubkey, proof)
2. Proof = signature with OLD key (or admin override)
3. On-chain:
   temp_agg = ecAdd(current_agg, ecNegate(old_pubkey))
   new_agg = ecAdd(temp_agg, new_pubkey)
   emit KeyRotated(issuer, old_pubkey, new_pubkey)
```

**BN254 Helpers (Solidity):**
```solidity
function ecAdd(uint256[2] memory p1, uint256[2] memory p2)
    internal view returns (uint256[2] memory)
{
    uint256[4] memory input = [p1[0], p1[1], p2[0], p2[1]];
    uint256[2] memory result;
    assembly {
        if iszero(staticcall(gas(), 0x06, input, 128, result, 64)) {
            revert(0, 0)
        }
    }
    return result;
}

function ecNegate(uint256[2] memory p)
    internal pure returns (uint256[2] memory)
{
    // BN254: -P = (P.x, -P.y mod p)
    uint256 p_mod = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47;
    return [p[0], p_mod - p[1]];
}
```

---

## 5. SMART CONTRACT ARCHITECTURE

```
contracts/src/
├── core/
│   ├── Index.sol              # Main entry point (~625 lines) - orders, batching, fills
│   ├── IndexStorage.sol       # Storage layout (base contract)
│   ├── ITP.sol                # ERC4626 Index Token Product (onlyIndex modifier)
│   └── BLSCustody.sol         # Multi-chain BLS-piloted custody (UUPS upgradeable)
├── libraries/
│   ├── TypesLib.sol           # Consolidated types (OrderStatus, LimitOrder, ITPCore, KeyRotation, etc.)
│   ├── ErrorsLib.sol          # Custom errors (E001-E033+)
│   ├── EventsLib.sol          # Event definitions
│   └── BLSLib.sol             # BLS utilities (BN254 ecAdd, ecNegate, verifyBLS)
├── custody/
│   ├── L3BridgeCustody.sol    # Bridge initiator on L3 (two-phase lock→verify→release)
│   └── ArbBridgeCustody.sol   # Bridge receiver on Arbitrum (template for other chains)
├── bridge/
│   ├── BridgeProxy.sol        # Cross-chain ITP creation + token bridging (Arbitrum, UUPS)
│   ├── BridgedItpFactory.sol  # Deploys BridgedITP tokens (only callable by BridgeProxy)
│   └── BridgedITP.sol         # ERC20 representation of L3 ITP on Arbitrum (mint/burn by proxy)
├── registry/
│   ├── IssuerRegistry.sol     # Issuer management, BLS key aggregation, key rotation
│   ├── CollateralRegistry.sol # On-chain collateral tracking per ITP per chain
│   ├── FeeRegistry.sol        # Fee calculation and distribution
│   └── AssetPairRegistry.sol  # Asset pair definitions and routing
├── Governance.sol             # Admin, pause/unpause, upgrade authorization
├── interfaces/
│   ├── IIndex.sol
│   ├── IITP.sol
│   ├── IBLSCustody.sol
│   ├── ICollateralRegistry.sol
│   ├── IArbBridgeCustody.sol
│   ├── IL3BridgeCustody.sol
│   ├── IBridgeProxy.sol         # Cross-chain ITP creation interface
│   ├── IBridgedItpFactory.sol   # BridgedITP deployment interface
│   ├── IBridgedITP.sol          # Bridged token interface
│   └── IGovernance.sol
└── mocks/                     # Test mocks (not deployed)
    ├── MockERC20.sol
    ├── MockGovernance.sol
    └── MockIssuerRegistry.sol
```

> **Implementation Note:** The original spec called for separate `IndexGetters.sol`, `IndexInternal.sol`, `ConstantsLib.sol`, `MathLib.sol`, `OrderLib.sol`, and `WeightLib.sol`. During implementation, getters and internal logic were inlined into `Index.sol` for simplicity, and the four separate library files were consolidated into `TypesLib.sol` which contains all shared types, structs, and enums. `BLSCustody.sol` was placed in `core/` (alongside Index.sol) rather than `custody/` since it is the primary custody contract on each chain. `ITP.sol` was placed in `core/` with an `onlyIndex` modifier for tight integration.

### Multi-Chain Custody Deployment

| Chain | Contract | Controls | Key Type |
|-------|----------|----------|----------|
| **Index L3** | BLSCustody + L3BridgeCustody | Master USDC, ITP logic, bridge init | BLS (BN254) |
| **Arbitrum** | BLSCustody + ArbBridgeCustody + BridgeProxy | USDC inventory, 1inch swap hub, cross-chain ITP creation | BLS (BN254) |
| **Ethereum** | BLSCustody | ETH, AAVE, UNI, LINK | BLS (BN254) |
| **Base** | BLSCustody | AERO, cbBTC | BLS (BN254) |
| **Optimism** | BLSCustody | OP, VELO | BLS (BN254) |
| **Solana** | Squads Multisig | SOL, memecoins, PumpFun tokens | Ed25519 |

**All EVM chains controlled by same BLS public key** = same 11/20 issuer threshold.

**BridgeProxy (Arbitrum):** Handles cross-chain ITP creation and token bridging. Deploys `BridgedITP` tokens that represent L3 ITPs on Arbitrum.

### BLSCustody.sol (Multi-Chain)

```solidity
// SAME CONTRACT deployed on Arbitrum, Ethereum, Base, Optimism, etc.
contract BLSCustody {
    bytes public blsPublicKey;  // Same across all chains

    // Nonce bitmap (prevents gaps from locking contract)
    mapping(uint256 => uint256) public usedNonces;

    mapping(address => bool) public whitelistedTargets;

    function execute(
        address target,
        bytes calldata data,
        bytes calldata blsSignature,
        uint256 nonce
    ) external {
        // Nonce bitmap check (not sequential - prevents gap attacks)
        uint256 wordIndex = nonce / 256;
        uint256 bitIndex = nonce % 256;
        uint256 word = usedNonces[wordIndex];
        uint256 mask = 1 << bitIndex;
        require(word & mask == 0, "Nonce already used");
        usedNonces[wordIndex] = word | mask;

        // Include chainId in signed message - CRITICAL for cross-chain safety
        bytes32 message = keccak256(abi.encode(
            block.chainid,
            address(this),
            target,
            data,
            nonce
        ));

        require(whitelistedTargets[target], "Target not whitelisted");
        require(verifyBLS(blsPublicKey, message, blsSignature), "Invalid BLS");

        (bool success,) = target.call(data);
        require(success, "Execution failed");

        emit Executed(target, data, nonce);
    }
}
```

### Whitelisted Actions per Chain

| Chain | Action | Target Contract | Purpose |
|-------|--------|-----------------|---------|
| Arbitrum | Swap | 1inch Aggregation Router V6 | Execute swaps |
| Arbitrum | Approve | ERC20 tokens | Approve 1inch to spend |
| Arbitrum | Bridge | BLS Bridge contract | Transfer USDC between custodies |
| Arbitrum | Swap (Fusion) | 1inch Fusion Settlement | Intent-based swaps |
| All EVM | Bridge | Chain-specific bridge contract | Cross-chain USDC |
| Solana | Swap | Jupiter aggregator program | SOL ecosystem swaps |
| Solana | Bridge | Wormhole/1inch settlement | Cross-chain to Solana |

### Custody Whitelist Management

**CRITICAL:** Custody contracts need ability to update whitelists (add new 1inch versions, new tokens).

```solidity
// In BLSCustody.sol (deployed on each chain)

// Pending whitelist changes (timelock)
mapping(address => uint256) public pendingWhitelist;  // target => activation time
uint256 public constant WHITELIST_TIMELOCK = 2 days;
uint256 public constant WHITELIST_APPROVAL_THRESHOLD = 11;  // 11/20
uint256 public constant EMERGENCY_REMOVAL_THRESHOLD = 15;   // 15/20

event WhitelistProposed(address indexed target, uint256 activationTime);
event WhitelistActivated(address indexed target);
event WhitelistRemoved(address indexed target, bool emergency);

function proposeWhitelist(
    address target,
    bytes calldata blsSignature  // 11/20 threshold
) external {
    bytes32 message = keccak256(abi.encode(
        "PROPOSE_WHITELIST", block.chainid, address(this), target, whitelistNonce++
    ));
    require(verifyBLS(blsPublicKey, message, blsSignature), "Invalid BLS");

    pendingWhitelist[target] = block.timestamp + WHITELIST_TIMELOCK;
    emit WhitelistProposed(target, pendingWhitelist[target]);
}

function activateWhitelist(address target) external {
    require(pendingWhitelist[target] != 0, "Not proposed");
    require(block.timestamp >= pendingWhitelist[target], "Timelock active");

    whitelistedTargets[target] = true;
    delete pendingWhitelist[target];
    emit WhitelistActivated(target);
}

function emergencyRemoveWhitelist(
    address target,
    bytes calldata blsSignature  // 15/20 threshold (higher)
) external {
    bytes32 message = keccak256(abi.encode(
        "EMERGENCY_REMOVE_WHITELIST", block.chainid, address(this), target, whitelistNonce++
    ));
    // Note: Uses higher threshold verification
    require(verifyBLS15(blsPublicKey, message, blsSignature), "Invalid BLS 15/20");

    whitelistedTargets[target] = false;
    emit WhitelistRemoved(target, true);
}
```

### Custody UUPS Upgrade Pattern

**All BLSCustody contracts deployed as UUPS proxies** for upgradability.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CUSTODY UUPS UPGRADE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   DEPLOYMENT (per chain):                                               │
│   ───────────────────────                                               │
│   1. Deploy BLSCustodyImpl.sol (implementation)                         │
│   2. Deploy ERC1967Proxy pointing to impl                               │
│   3. Proxy address = custody address used everywhere                    │
│                                                                          │
│   UPGRADE REQUIREMENTS:                                                 │
│   ─────────────────────                                                 │
│   Standard upgrade: 15/20 BLS + 7-day timelock                          │
│   Emergency upgrade: 17/20 BLS + 24-hour timelock                       │
│                                                                          │
│   UPGRADE FLOW:                                                         │
│   ────────────                                                          │
│   1. Deploy new implementation                                          │
│   2. proposeUpgrade(newImpl) with 15/20 BLS                            │
│   3. Wait 7 days                                                        │
│   4. executeUpgrade() - anyone can call after timelock                  │
│                                                                          │
│   SOLIDITY:                                                             │
│   ─────────                                                             │
│   contract BLSCustody is UUPSUpgradeable {                              │
│       address public pendingUpgradeImpl;                                │
│       uint256 public pendingUpgradeProposedAt;                          │
│       bool public pendingUpgradeIsEmergency;                            │
│       uint256 public constant UPGRADE_TIMELOCK = 7 days;                │
│       uint256 public constant EMERGENCY_UPGRADE_TIMELOCK = 24 hours;    │
│                                                                          │
│       function _authorizeUpgrade(address newImpl)                       │
│           internal override                                             │
│       {                                                                  │
│           uint256 timelock = pendingUpgradeIsEmergency                  │
│               ? EMERGENCY_UPGRADE_TIMELOCK : UPGRADE_TIMELOCK;          │
│           uint256 unlockTime = pendingUpgradeProposedAt + timelock;     │
│           require(block.timestamp >= unlockTime, "Timelock active");    │
│           require(pendingUpgradeImpl == newImpl, "Impl mismatch");      │
│       }                                                                  │
│   }                                                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### ITP.sol (ERC4626)
```solidity
// Read-only views (for DeFi integrations)
function totalAssets() → computed from inventory * prices
function convertToShares(assets) → standard ERC4626
function convertToAssets(shares) → standard ERC4626

// Write functions (only via Index.sol + BLS)
function mint(to, shares) → only callable by Index.sol
function burn(from, shares) → only callable by Index.sol

// Prices updated by issuers via BLS
mapping(address => uint256) public assetPrices;
```

---

## 6. ORDER SYSTEM

### Order Structure
```solidity
struct LimitOrder {
    uint256 id;              // Global unique ID across all ITPs
    address user;
    bytes32 pairId;          // Identifies asset + source (see Section 12)
    Side side;               // BUY or SELL
    uint256 amount;          // USDC amount (quote currency)
    uint256 limitPrice;      // Worst acceptable price (18 decimals)
    uint256 slippageTier;    // 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%)
    uint256 deadline;        // Unix timestamp - order expires after this
    bytes32 itpId;           // Which ITP this order belongs to
    uint256 timestamp;       // Order creation time
    OrderStatus status;      // PENDING → BATCHED → FILLED | CANCELLED | EXPIRED
}

enum Side { BUY, SELL }
enum OrderStatus { PENDING, BATCHED, FILLED, CANCELLED, EXPIRED }
```

**CRITICAL DESIGN DECISION:** All orders are limit orders. No market orders.

This ensures:
- Users always have price protection
- Predictable execution costs
- No surprise slippage on volatile markets
- Simpler fill verification (price must be within limit)

### Slippage Tiers

| Tier | Max Slippage | Use Case |
|------|--------------|----------|
| 0 - Strict | ≤0.3% | Stablecoins, large caps, tight spread |
| 1 - Normal | ≤1.0% | Most assets, default tier |
| 2 - Relaxed | ≤3.0% | Memecoins, low liquidity, urgent fills |

**Tier Execution Rule:** Orders only filled if execution spread ≤ tier limit.
- Tier 0 orders excluded if spread > 0.3%
- Excluded orders queued for next cycle
- Users in higher tiers get filled first in illiquid conditions

### Limit Price Calculation

```
For BUY orders:
  limitPrice = currentPrice × (1 + slippageLimit)
  User accepts paying UP TO this price

For SELL orders:
  limitPrice = currentPrice × (1 - slippageLimit)
  User accepts receiving AT LEAST this price
```

### Order Policies

| Policy | Decision |
|--------|----------|
| Order Type | **Limit orders ONLY** - no market orders |
| Partial Fills | NO - on interrupt, fill what's acquired, mint proportional ITP |
| Cancel | NO - never allowed (simplest) |
| Limit Validation | Within 50% of current price at submission |
| Limit Tolerance | 0.1% (accept fills slightly worse than limit) |
| Slippage Protection | Built into slippage tier system |
| Minimum Order | 0.001 USDC (admin upgradable) |
| Maximum Order | None (queue depth handles overload) |
| USDC Custody | Transferred to Index.sol on order submission |
| Deadline | Max 24 hours from submission |

### Loss Allocation Rule

**CRITICAL:** Single user always takes losses for their orders, never the global pool.
- If partial fill occurs, user receives proportionally less ITP
- Rounding errors, slippage, and execution costs borne by individual order
- Global inventory must never subsidize individual orders
- Bridge/gas fees distributed proportionally to order size (see Section 8)

### Order Lifecycle

```
PENDING → BATCHED → FILLED  (or EXPIRED/CANCELLED)

1. User submits LimitOrder with pairId, amount, limitPrice, slippageTier
2. USDC transferred to Index.sol custody
3. Order included in next batch (based on priority - Section 10)
4. Netting engine merges with same-pair orders (Section 8)
5. If spread ≤ slippageTier limit → include in execution
6. If spread > slippageTier limit → defer to next cycle
7. Execution via CEX (AP) or DEX (BLS Custody)
8. Issuers verify fill price ≤ limitPrice
9. Mark FILLED, mint ITP tokens

No lock step. Orders auto-lock when included in batch.
Single on-chain tx per cycle (confirm fills only).
```

### Order Deadline Enforcement

**CRITICAL:** Orders must not remain pending indefinitely. Deadline enforced at multiple stages.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ORDER DEADLINE ENFORCEMENT                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   DEADLINE RULES:                                                       │
│   ───────────────                                                       │
│   • Max deadline: 24 hours from submission                              │
│   • User can specify shorter deadline                                   │
│   • Deadline stored on-chain with order                                 │
│                                                                          │
│   ENFORCEMENT POINTS:                                                   │
│   ───────────────────                                                   │
│   1. BATCH INCLUSION (each cycle):                                      │
│      if order.deadline < block.timestamp:                               │
│          SKIP order, mark as EXPIRED                                    │
│          Queue auto-refund                                              │
│                                                                          │
│   2. EXECUTION (after batch signed):                                    │
│      if order.deadline < block.timestamp:                               │
│          DO NOT execute                                                 │
│          Refund USDC to user                                            │
│                                                                          │
│   3. FILL CONFIRMATION:                                                 │
│      Even if AP filled after deadline:                                  │
│          REJECT fill, reverse trade if possible                         │
│          Log incident for AP review                                     │
│                                                                          │
│   AUTO-REFUND FLOW:                                                     │
│   ─────────────────                                                     │
│   1. Issuer detects expired order                                       │
│   2. BLS-sign refund: RefundOrder(orderId, user, amount)               │
│   3. On-chain: Transfer USDC from Index.sol back to user               │
│   4. Emit OrderExpired(orderId, user, amount)                          │
│                                                                          │
│   ON-CHAIN:                                                             │
│   ─────────                                                             │
│   function refundExpiredOrder(                                          │
│       uint256 orderId,                                                  │
│       bytes calldata blsSignature                                       │
│   ) external {                                                          │
│       Order storage order = orders[orderId];                            │
│       require(order.status == PENDING, "Not pending");                  │
│       require(block.timestamp > order.deadline, "Not expired");         │
│       // Verify BLS, refund user                                        │
│       order.status = FILLED;                                            │
│       usdc.transfer(order.user, order.amount);                          │
│       emit OrderRefunded(orderId, order.user, order.amount);            │
│   }                                                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### CEX vs DEX Execution

| Source | Execution Method | Fill Verification |
|--------|------------------|-------------------|
| **CEX (Bitget)** | AP reads LimitOrderRequest event, places limit order | Issuers verify via Bitget read-only API |
| **DEX (1inch)** | BLS-signed swap with minReturn from limitPrice | On-chain - swap reverts if slippage exceeded |

```
CEX Flow:
1. On-chain: Emit LimitOrderRequest(order)
2. AP places limit order on Bitget at order.limitPrice
3. AP reports fill
4. Issuers verify via Bitget read-only API
5. If fillPrice worse than limitPrice → AP slashed

DEX Flow:
1. Build 1inch swap with minReturn from limitPrice
2. BLS-sign the swap calldata
3. Execute via BLSCustody
4. If reverts (slippage exceeded) → Order fails, retry next cycle
```

### Cross-Chain ITP Purchase (from Arbitrum)

**Feature:** Users can buy ITPs directly from Arbitrum without manually bridging to L3 first.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CROSS-CHAIN ITP PURCHASE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   USER FLOW (from Arbitrum):                                            │
│   ──────────────────────────                                            │
│   1. User has USDC on Arbitrum                                          │
│   2. User calls ArbBridgeCustody.buyITPFromArbitrum(itpId, amount)     │
│   3. USDC locked in Arbitrum Custody                                    │
│   4. Event: CrossChainBuyRequest(user, itpId, amount, sourceChain)     │
│   5. Issuers observe event                                              │
│   6. Issuers process as normal order (already has USDC on Arb)         │
│   7. ITP minted on L3 to user's address                                │
│   8. User can bridge ITP to Arbitrum if desired (separate tx)          │
│                                                                          │
│   CONTRACT (on Arbitrum Custody):                                       │
│   ────────────────────────────────                                      │
│   function buyITPFromArbitrum(                                          │
│       bytes32 itpId,                                                    │
│       uint256 amount,                                                   │
│       uint256 limitPrice,                                               │
│       uint256 slippageTier,                                             │
│       uint256 deadline                                                  │
│   ) external {                                                          │
│       // Transfer USDC from user to this custody                        │
│       usdc.transferFrom(msg.sender, address(this), amount);             │
│                                                                          │
│       // Emit event for issuers                                         │
│       emit CrossChainBuyRequest(                                        │
│           msg.sender,                                                   │
│           itpId,                                                        │
│           amount,                                                       │
│           limitPrice,                                                   │
│           slippageTier,                                                 │
│           deadline,                                                     │
│           block.chainid  // Source chain                                │
│       );                                                                │
│   }                                                                     │
│                                                                          │
│   ISSUER HANDLING:                                                      │
│   ────────────────                                                      │
│   1. Monitor CrossChainBuyRequest events on all custody contracts       │
│   2. Create internal order (same as L3 order)                           │
│   3. No bridge needed - USDC already on Arbitrum                        │
│   4. Execute swaps as normal                                            │
│   5. Mint ITP on L3 to user address                                     │
│                                                                          │
│   BENEFITS:                                                             │
│   ─────────                                                             │
│   • Better UX - one tx from Arbitrum                                    │
│   • No user bridge fees                                                 │
│   • USDC stays on Arb (often needed for swaps anyway)                  │
│                                                                          │
│   SUPPORTED CHAINS:                                                     │
│   ─────────────────                                                     │
│   • Arbitrum (primary)                                                  │
│   • Ethereum (if custody deployed)                                      │
│   • Base (if custody deployed)                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. ISSUER CYCLE (1 second)

```
┌──────────────────────────────────────────────────────────────────┐
│                         CYCLE N                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  PHASE 1: Process Previous Fills                                  │
│  ├─ Check CEX (Bitget API) for fills from Cycle N-1             │
│  ├─ Check DEX (on-chain events) for completed swaps             │
│  ├─ Verify fill prices within limit orders                       │
│  ├─ Mark orders as FILLED with execution price                   │
│  ├─ Update CollateralRegistry (per ITP per chain)               │
│  └─ Calculate shares to mint/burn                                │
│                                                                   │
│  PHASE 2: Unified Netting Engine (see Section 8)                 │
│  ├─ Collect all pending orders (user + rebalance)               │
│  ├─ STEP 1: Pair Netting - merge same-pair orders               │
│  ├─ STEP 2: Fill Priority - check liquidity at 25/50/75/100%    │
│  ├─ STEP 3: Slippage Filter - exclude orders above tier limit   │
│  ├─ STEP 4: Chain Grouping - batch by destination chain         │
│  ├─ STEP 5: Bridge Netting - net opposite-direction bridges     │
│  ├─ STEP 6: USDT Netting - net USDC↔USDT swaps                  │
│  └─ STEP 7: Fee Allocation - distribute costs proportionally    │
│                                                                   │
│  PHASE 3: Inventory Check                                         │
│  ├─ Check custody inventory on each destination chain            │
│  ├─ If inventory sufficient → use directly (no bridge)          │
│  └─ If inventory insufficient → queue bridge from L3             │
│                                                                   │
│  PHASE 4: Generate Execution Batch                                │
│  ├─ Create merged limit orders (one per pair)                    │
│  ├─ Include limit prices from weighted slippage                  │
│  ├─ Include deadlines                                            │
│  └─ Track source orders for fill allocation                      │
│                                                                   │
│  PHASE 5: BLS Sign & Submit                                       │
│  ├─ Leader creates message: {fills, execution_batch, fees}      │
│  ├─ All issuers sign                                             │
│  ├─ Leader aggregates (11/20 threshold)                          │
│  ├─ Submit on-chain (emit TradeRequest events)                  │
│  └─ Update CollateralRegistry with movements                     │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Phase 2 Detail: Unified Netting Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    NETTING PIPELINE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT: All pending orders from all ITPs                        │
│         ↓                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ STEP 1: PAIR NETTING                                     │    │
│  │ Group by pairId, net buys vs sells                       │    │
│  │ ITP-A: +$10k BTC, ITP-B: -$3k BTC → Net: +$7k BTC       │    │
│  └─────────────────────────────────────────────────────────┘    │
│         ↓                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ STEP 2: FILL PRIORITY CHECK                              │    │
│  │ Query liquidity at 25%, 50%, 75%, 100%                   │    │
│  │ Liquid pairs: execute 100%                               │    │
│  │ Illiquid pairs: partial fill, defer rest                │    │
│  └─────────────────────────────────────────────────────────┘    │
│         ↓                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ STEP 3: SLIPPAGE TIER FILTER                             │    │
│  │ If spread=0.8%: Include Tier 1+2, exclude Tier 0        │    │
│  │ Excluded orders → queue for next cycle                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│         ↓                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ STEP 4: CHAIN GROUPING                                   │    │
│  │ Arbitrum batch: $22k, Solana batch: $4k                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│         ↓                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ STEP 5: BRIDGE NETTING                                   │    │
│  │ L3→Arb $30k, Arb→L3 $20k → Net: $10k L3→Arb            │    │
│  └─────────────────────────────────────────────────────────┘    │
│         ↓                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ STEP 6: USDT NETTING                                     │    │
│  │ USDT buys: -$300, sells: +$150 → Swap only $150         │    │
│  │ DEPEG CHECK: If |1-rate|>0.5% → disable netting         │    │
│  └─────────────────────────────────────────────────────────┘    │
│         ↓                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ STEP 7: FEE ALLOCATION                                   │    │
│  │ Bridge/gas fees distributed by order size               │    │
│  │ User A ($1k/20%): pays 20% of fees                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│         ↓                                                        │
│  OUTPUT: Execution batch ready for BLS signing                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Time Synchronization
- Method: Wall Clock + NTP (off-chain)
- Tolerance: ±200ms between issuers
- Leader announces cycle start

### Leader Timeout & Failover
```
If leader doesn't submit within 500ms:
  1. Next issuer in hash order becomes leader
  2. New leader collects signatures and submits
  3. Original leader marked as "missed" (tracked locally)
  4. After 3 consecutive misses → propose kick vote
```

### Price Validation
| Parameter | Value |
|-----------|-------|
| Source | Bitget view API |
| Tolerance | Fixed per-asset (e.g., 0.5% stables, 2% BTC/ETH) |
| Consensus Threshold | If ≥20% of issuers disagree → cancel round, retry |
| Disagreement | Issuer's price vs leader's price outside tolerance |
| Repeat Offender | Issuer disagrees >50% of rounds → investigate/kick |

**Price validation flow:**
```
1. Leader broadcasts prices for all assets
2. Each issuer compares to their own Bitget feed
3. If difference > asset_tolerance → vote DISAGREE
4. If ≥4/20 issuers (20%) vote DISAGREE → cancel round
5. Retry with fresh prices (max 3 retries)
6. After 3 failed retries → emergency pause
```

### Price Staleness Check

**CRITICAL:** Prices must be fresh. Trading on stale prices enables arbitrage attacks.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRICE STALENESS VALIDATION                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   STALENESS LIMITS BY ASSET TYPE:                                       │
│   ────────────────────────────────                                      │
│   CEX pairs (Bitget):     10 seconds                                    │
│   DEX pairs (1inch):      30 seconds                                    │
│   Low-liquidity assets:   60 seconds                                    │
│                                                                          │
│   PRICE STRUCTURE:                                                      │
│   ────────────────                                                      │
│   struct Price {                                                        │
│       uint256 price;        // 18 decimals                              │
│       uint256 timestamp;    // When price was fetched                   │
│       uint256 assetIndex;                                               │
│   }                                                                     │
│                                                                          │
│   VALIDATION (each cycle):                                              │
│   ────────────────────────                                              │
│   for each price in batch:                                              │
│       staleness = block.timestamp - price.timestamp                     │
│       limit = STALENESS_LIMITS[assetType]                               │
│       if staleness > limit:                                             │
│           REJECT batch, refetch prices                                  │
│                                                                          │
│   ISSUER IMPLEMENTATION:                                                │
│   ──────────────────────                                                │
│   1. Fetch prices with timestamp from source                            │
│   2. Include timestamp in price message                                 │
│   3. Leader includes oldest timestamp in batch                          │
│   4. Other issuers verify: oldest_timestamp within limit                │
│   5. If ANY price stale → vote REJECT                                   │
│                                                                          │
│   STALENESS_LIMITS (configurable by admin):                             │
│   ─────────────────────────────────────────                             │
│   mapping(uint256 => uint256) public stalenessLimits; // assetType => s │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. UNIFIED NETTING ENGINE

All netting operations combined into one unified flow that runs every cycle.

### Netting Types Summary

| # | Netting Type | What It Nets | Savings |
|---|--------------|--------------|---------|
| 1 | Pair Netting | Same-pair buys vs sells across ITPs | Fewer orders |
| 2 | Bridge Netting | Opposite-direction bridges | 50-80% fewer bridges |
| 3 | USDT Netting | USDT buys vs USDT sells | 50%+ fewer stablecoin swaps |
| 4 | Chain Netting | Orders to same chain batched | Gas savings |
| 5 | Fee Netting | Bridge fees shared across users | Fair distribution |

### Fill Algorithm: Split Execution with Pair Merging

Each ITP executes at its own optimal fill level, but **all orders for the same pair are merged into one order**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SPLIT EXECUTION WITH PAIR MERGING                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   STEP 1: COLLECT ALL ORDERS                                            │
│   ──────────────────────────                                            │
│   ITP-001 needs: +$10k BTC (Bitget), +$5k ETH (1inch-Arb)              │
│   ITP-002 needs: +$8k BTC (Bitget), -$3k ETH (1inch-Arb)               │
│   ITP-003 needs: +$2k BTC (Bitget), +$4k BONK (1inch-Sol)              │
│                                                                          │
│   STEP 2: MERGE BY PAIR (critical for CEX efficiency)                  │
│   ───────────────────────────────────────────────────                   │
│   Bitget.BTCUSDC: $10k + $8k + $2k = ONE ORDER for $20k BTC            │
│   1inch-Arb.ETH:  $5k - $3k = ONE ORDER for $2k ETH (net buy)          │
│   1inch-Sol.BONK: $4k = ONE ORDER for $4k BONK                         │
│                                                                          │
│   STEP 3: CHECK LIQUIDITY PER MERGED ORDER                              │
│   ────────────────────────────────────────                              │
│   For each merged order, query spread at fill levels:                   │
│                                                                          │
│   Bitget.BTCUSDC ($20k):                                                │
│     25%: 0.05% spread                                                   │
│     50%: 0.08% spread                                                   │
│     75%: 0.12% spread                                                   │
│     100%: 0.15% spread  ← All within tolerance, execute 100%           │
│                                                                          │
│   1inch-Sol.BONK ($4k):                                                 │
│     25%: 0.8% spread                                                    │
│     50%: 2.5% spread                                                    │
│     75%: 6% spread      ← Exceeds 3% tolerance                         │
│     100%: 12% spread                                                    │
│     → Execute at 50% ($2k), defer $2k to next cycle                    │
│                                                                          │
│   STEP 4: EXECUTE MERGED ORDERS                                         │
│   ─────────────────────────────                                         │
│   ONE limit order to Bitget for $20k BTC                               │
│   ONE 1inch swap for $2k ETH                                           │
│   ONE 1inch swap for $2k BONK (50% of requested)                       │
│                                                                          │
│   STEP 5: ALLOCATE FILLS BACK TO ITPS                                  │
│   ───────────────────────────────────                                   │
│   BTC fill allocated proportionally:                                    │
│     ITP-001: 10/20 = 50% of fill                                       │
│     ITP-002: 8/20 = 40% of fill                                        │
│     ITP-003: 2/20 = 10% of fill                                        │
│                                                                          │
│   BONK partial fill (only 50% executed):                               │
│     ITP-003: Gets 50% of requested BONK                                │
│     Remaining 50% → Queued for next cycle                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Slippage-Based Fill Grouping

Users have different slippage tolerances. Orders are grouped by tier to ensure no user gets filled at slippage exceeding their limit.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SLIPPAGE TIERED BUCKETS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   PROBLEM: Users have different slippage tolerances                     │
│   ────────────────────────────────────────────────                      │
│   User A: BTC buy $5k, max slippage 0.3%                               │
│   User B: BTC buy $5k, max slippage 1%                                 │
│   User C: BTC buy $5k, max slippage 3%                                 │
│                                                                          │
│   If merged order executes at 0.8% slippage:                           │
│   → User A SHOULD NOT be filled (exceeds their limit)                  │
│   → User B and C SHOULD be filled                                      │
│                                                                          │
│   SOLUTION: TIERED SLIPPAGE BUCKETS                                    │
│   ─────────────────────────────────                                    │
│   Tier 0: ≤0.3% (strict)                                               │
│   Tier 1: ≤1% (normal)                                                 │
│   Tier 2: ≤3% (relaxed)                                                │
│                                                                          │
│   ALGORITHM:                                                           │
│   ──────────                                                           │
│   1. Group orders by slippage tolerance tier                           │
│   2. For each pair, calculate spread at merged amount                  │
│   3. Include orders ONLY from tiers where spread ≤ tier_limit:         │
│        Spread = 0.8% → Include Tier 1 + Tier 2 only                   │
│        Spread = 0.2% → Include all tiers                               │
│   4. Users in excluded tiers → Queued for next cycle                   │
│                                                                          │
│   FAIR COST DISTRIBUTION:                                              │
│   ───────────────────────                                              │
│   Execution cost (slippage) distributed proportionally to order size:  │
│                                                                          │
│   Example: $10k merged order, 0.5% slippage = $50 cost                 │
│   - User B ($5k): pays $25 slippage cost                              │
│   - User C ($5k): pays $25 slippage cost                              │
│   - User A: NOT FILLED (would exceed 0.3% limit)                      │
│                                                                          │
│   Each included user gets fill at SAME effective price (fair)          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Netting Algorithm (Rust)

```rust
fn execute_cycle(all_orders: Vec<LimitOrder>) -> ExecutionResult {
    // STEP 1: Group by pair (merge all same-pair orders)
    let merged_orders: HashMap<PairId, MergedOrder> = merge_by_pair(all_orders);

    // STEP 2: Check liquidity for each merged order
    let mut execution_plan = Vec::new();

    for (pair_id, merged) in merged_orders {
        let spreads = query_spreads_at_levels(pair_id, merged.net_amount, [25, 50, 75, 100]);
        let max_slippage = merged.weighted_avg_slippage();

        // Find highest fill level within tolerance
        let fill_pct = find_max_fillable_level(spreads, max_slippage);

        execution_plan.push(ExecutionItem {
            pair_id,
            amount: merged.net_amount * fill_pct / 100,
            limit_price: calculate_limit_price(pair_id, max_slippage),
            source_orders: merged.source_orders,  // For allocation later
        });

        // Queue remainder for next cycle
        if fill_pct < 100 {
            queue_for_next_cycle(pair_id, merged.net_amount * (100 - fill_pct) / 100);
        }
    }

    // STEP 3: Execute merged orders
    for item in execution_plan {
        match get_source_type(item.pair_id) {
            CEX => emit_limit_order_to_ap(item),
            DEX => execute_1inch_swap(item),
        }
    }

    // STEP 4: Allocate fills back to ITPs
    allocate_fills_proportionally(execution_plan)
}

fn merge_by_pair(orders: Vec<LimitOrder>) -> HashMap<PairId, MergedOrder> {
    let mut merged = HashMap::new();

    for order in orders {
        let entry = merged.entry(order.pair_id).or_insert(MergedOrder::default());

        // Net buys and sells
        if order.side == Buy {
            entry.net_amount += order.amount;
        } else {
            entry.net_amount -= order.amount;
        }

        // Track source orders for allocation
        entry.source_orders.push(order);

        // Weighted average slippage
        entry.total_slippage_weight += order.amount * order.slippage_limit;
        entry.total_amount += order.amount;
    }

    // Determine final side based on net
    for (_, merged) in merged.iter_mut() {
        merged.side = if merged.net_amount >= 0 { Buy } else { Sell };
        merged.net_amount = merged.net_amount.abs();
    }

    merged
}
```

### Fee Sharing (Stateless Compatible)

Fees calculated at execution time, recorded on-chain.

```
┌─────────────────────────────────────────────────────────────────────────┐
│              FEE SHARING (STATELESS COMPATIBLE)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   FEE CALCULATION (proportional to order size):                         │
│   ─────────────────────────────────────────────                         │
│   If bridge happens with $5k minimum threshold:                         │
│     User A order: $1000 (20%) → pays 20% of bridge fee                 │
│     User B order: $3000 (60%) → pays 60% of bridge fee                 │
│     User C order: $1000 (20%) → pays 20% of bridge fee                 │
│                                                                          │
│   EXECUTION FLOW:                                                       │
│   ───────────────                                                       │
│   User deposits $1000 for ITP                                           │
│   ↓                                                                     │
│   Issuers batch orders, calculate:                                      │
│     - Bridge needed: yes                                                │
│     - User's share of bridge fee: $1.50                                │
│     - Gas estimate: $0.30                                              │
│     - Total fee: $1.80                                                 │
│   ↓                                                                     │
│   BLS-signed execution includes:                                        │
│     effectiveAmount = $1000 - $1.80 = $998.20                          │
│   ↓                                                                     │
│   On-chain records:                                                     │
│     - ITP minted for $998.20 worth                                     │
│     - FeeCharged(user, itpId, $1.80, "BRIDGE+GAS")                     │
│                                                                          │
│   MINI ORDER PROTECTION:                                                │
│   ──────────────────────                                                │
│   If fee > 2% of order amount → Warn user before execution             │
│   UI: "Your $50 order has $1.50 fees (3%). Continue?"                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### USDT Netting with Depeg Circuit Breaker

```
┌─────────────────────────────────────────────────────────────────────────┐
│           USDT NETTING (with depeg circuit breaker)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   NORMAL OPERATION:                                                     │
│   ─────────────────                                                     │
│   USDC Buys: -$500, Sells: +$400 → Net: -$100                          │
│   USDT Buys: -$300, Sells: +$150 → Net: -$150                          │
│   → Swap only $150 USDC → USDT (not $300)                              │
│                                                                          │
│   DEPEG CIRCUIT BREAKER:                                                │
│   ──────────────────────                                                │
│   Monitor USDC/USDT rate (via 1inch quote)                              │
│   If |1 - rate| > 0.5%:                                                │
│     - DISABLE netting                                                   │
│     - Execute all USDT swaps at market rate                            │
│     - Alert: "DEPEG_DETECTED"                                          │
│   Resume when |1 - rate| < 0.3% for 1 hour                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. AP BUFFER STRATEGY

### On-Chain Min Buy Configuration
```solidity
// In Index.sol - governs minimum order sizes per asset
mapping(address => uint256) public minBuyAmount;  // asset => min USDC value

// Updated by issuers via BLS (reflects Bitget minimums)
// Example: minBuyAmount[BTC] = 5e18 ($5 minimum)
```

### Buffer Management
```
AP maintains buffer:
  buffer_usdc: $1000 (initial)
  buffer_assets: small amounts per traded asset

Small orders (< minBuyAmount[asset]):
  → Fill from buffer instantly
  → Track delta (buffer can go into debt)

Buffer debt handling:
  → AP can go into debt on buffer
  → Continue filling small orders from debt
  → When accumulated debt >= minBuyAmount:
    → Place single Bitget order to replenish
  → Self-replenishing through normal trade flow

Example:
  minBuyAmount[BTC] = $5
  User orders: $2 + $1 + $3 = $6 accumulated
  → Once debt >= $5, AP places $6 buy on Bitget
  → Buffer replenished, debt cleared
```

### Excess Inventory Tracking
```
target_inventory[asset] = Σ(itp_weights * itp_value)
actual_inventory[asset] = custody_balance[asset]
excess = actual - target

If |excess| > threshold:
  → Include corrective trade in next batch
```

---

## 10. THROUGHPUT & PRIORITY

### Constraints
- Bitget: ~10 orders/sec
- Effective capacity: ~20 user orders/cycle (with netting)
- Per day: ~1.7M orders

### Priority Algorithm (Queue with Fair Share)
```
if rebalance_active:
    slots = {rebalance: 50%, user: 50%}
else:
    slots = {user: 100%}

User order buckets:
    small (<$100): 30%
    medium ($100-$1000): 30%
    large ($1000-$10000): 20%
    xl (>$10000): 20%

Within bucket: FIFO (oldest first)
```

### Overload Handling
```
If order age > 1 hour:
  → Auto-fail with refund

Queue monitoring:
  depth > 100: WARNING
  depth > 500: CRITICAL (pause new orders)
```

---

## 11. ITP MANAGEMENT

### Creation
| Aspect | Rule |
|--------|------|
| Who | Permissionless (anyone) |
| Approval | Issuers approve via BLS consensus (11/20) |
| Initial Capital | None (starts empty) |
| Gas | User pays |
| Weights | Must sum to 1.0 |
| Min Weight | 0.25% per asset |
| Methodology | Link to hosted document |

### Cross-Chain ITP Creation Flow

Users create ITPs from Arbitrum. The process requires BLS consensus from issuers.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CROSS-CHAIN ITP CREATION                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ARBITRUM                              INDEX L3                          │
│  ─────────                             ────────                          │
│                                                                          │
│  1. User calls BridgeProxy                                               │
│     .requestCreateItp(name, symbol, weights, assets)                    │
│     → validates weights sum to 1e18                                     │
│     → stores PendingItpCreation[nonce]                                  │
│     → emits CreateItpRequested(admin, nonce, ...)                       │
│                                                                          │
│  2. Issuers detect CreateItpRequested event (Arbitrum RPC)              │
│     → validate: weights, assets, not already completed                  │
│     → leader broadcasts ITP_CREATION_PROPOSAL                           │
│     → followers respond with ITP_CREATION_SIGN (BLS partial sig)        │
│     → leader aggregates (11/20 threshold)                               │
│                                                                          │
│  3. Leader calls Index.createITP() ─────────────────>  ITP created      │
│     on L3 (gets orbitItpId)                             (orbitItpId)    │
│                                                                          │
│  4. Leader calls BridgeProxy.completeCreateItp(                         │
│        nonce, orbitItpId, blsSignature                                  │
│     )                                                                    │
│     → verifies BLS signature against IssuerRegistry                     │
│     → deploys BridgedITP via BridgedItpFactory                          │
│     → stores mapping: orbitItpId ↔ bridgedItpAddress                    │
│     → emits ItpCreated(orbitItpId, bridgedItpAddress, nonce)           │
│                                                                          │
│  RESULT:                                                                 │
│  - ITP.sol deployed on L3 (real ITP, ERC4626)                          │
│  - BridgedITP.sol deployed on Arbitrum (ERC20 representation)          │
│  - User can buy ITP on L3, bridge tokens to Arbitrum                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Contracts Involved:**
| Contract | Chain | Purpose |
|----------|-------|---------|
| BridgeProxy | Arbitrum | Request/complete ITP creation, token bridging |
| BridgedItpFactory | Arbitrum | Deploy BridgedITP tokens (only BridgeProxy can call) |
| BridgedITP | Arbitrum | ERC20 representation of L3 ITP (mint/burn by BridgeProxy) |
| Index.sol | L3 | Creates actual ITP (ERC4626) |
| IssuerRegistry | Both | BLS public key for signature verification |

**BridgedITP vs L3 ITP:**
- L3 ITP (ITP.sol): Full ERC4626 vault, holds actual assets, mint/burn via Index.sol
- BridgedITP: Simple ERC20, represents locked ITP on L3, mint/burn via BridgeProxy

### Stateless ITP Creation Processing

Issuers process ITP creation requests statelessly using a per-cycle approach:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STATELESS PER-CYCLE PATTERN                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  DESIGN PRINCIPLE: No in-memory state tracking.                         │
│  All state is queried from on-chain each cycle.                         │
│                                                                          │
│  EACH CYCLE (1 second):                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  1. Query BridgeProxy.nextCreationNonce()                        │   │
│  │     → Get total number of ITP creation requests ever submitted   │   │
│  │                                                                   │   │
│  │  2. For each nonce 0..nextCreationNonce:                        │   │
│  │     → Query BridgeProxy.isPending(nonce)                        │   │
│  │     → If pending: fetch full PendingItpCreation[nonce]          │   │
│  │                                                                   │   │
│  │  3. For each pending request:                                    │   │
│  │     → Am I leader? (hash(lastBLSSig) mod numIssuers)            │   │
│  │     → If leader: broadcast ITP_CREATION_PROPOSAL                │   │
│  │     → If follower: respond with ITP_CREATION_SIGN               │   │
│  │                                                                   │   │
│  │  4. Process responses (within same cycle or next):              │   │
│  │     → Aggregate partial signatures (11/20 threshold)            │   │
│  │     → Submit to L3 + complete on Arbitrum                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  WHY STATELESS:                                                         │
│  • Issuers can reboot at any time without losing state               │
│  • New issuers join and immediately know pending requests             │
│  • No consensus drift from in-memory state divergence                 │
│  • Chain is single source of truth                                     │
│                                                                          │
│  OPTIMIZATION:                                                          │
│  • Use indexed events for faster historical queries                   │
│  • Cache nonce range to avoid full scan each cycle                    │
│  • Skip nonces that are already completed (marked on-chain)           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**On-Chain State Queries per Cycle:**
| Query | Contract | Purpose |
|-------|----------|---------|
| `nextCreationNonce()` | BridgeProxy | Total requests submitted |
| `isPending(nonce)` | BridgeProxy | Check if request needs processing |
| `pendingCreations[nonce]` | BridgeProxy | Full request details |
| `itpExists(orbitItpId)` | Index.sol | Verify ITP not already created on L3 |

### Weight Formulas
```
NAV Calculation:
  NAV = Σ(quantity[i] * price[i]) / totalSupply

User Buy:
  shares_to_mint = deposit_amount / NAV
  Calculated off-chain by issuers, submitted via BLS

User Sell:
  usdc_to_return = shares * NAV
  Calculated off-chain by issuers, submitted via BLS
```

### Rebalance Flow
```
1. Asset manager proposes new weights
2. Queue rebalances (batch them)
3. Issuers vote to approve each
4. Signal "execute batch"
5. Calculate net trades across all rebalances
6. Execute in patches based on liquidity
7. Update weights on completion
```

### Rebalance Netting Algorithm

**Phase 1: Collect Rebalance Proposals**
```
rebalance_queue = []

When asset_manager proposes:
  rebalance_queue.append({
    itp, old_weights, new_weights
  })

Wait for:
  - All expected rebalances submitted, OR
  - Timeout (e.g., 1 hour), OR
  - Admin signals "execute batch"
```

**Phase 2: Calculate Net Trades**
```
For each asset across all rebalances:
  net_delta[asset] = 0

  For each rebalance in queue:
    itp_value = get_itp_total_value(rebalance.itp)
    old_amount = itp_value * old_weights[asset]
    new_amount = itp_value * new_weights[asset]
    delta = new_amount - old_amount
    net_delta[asset] += delta

Result example:
  net_delta[BTC] = -$10,000 (net sell)
  net_delta[ETH] = +$15,000 (net buy)
```

**Phase 3: Execute Net Trades**
```
execute_trades([
  {SELL, BTC, $10,000},
  {BUY, ETH, $15,000}
])

Allocate fills pro-rata to each ITP based on their delta.
```

**Phase 4: Update Weights**
```
For each rebalance:
  update_weights(itp, new_weights)
  emit RebalanceComplete(itp)
```

**Netting Benefit Example:**
```
ITP-A: BTC 50%→30% (value $100k) → sell $20k BTC
ITP-B: BTC 40%→60% (value $50k)  → buy $10k BTC

Net: Sell $10k BTC (instead of $30k volume)
ITP-A "sells to" ITP-B internally
```

---

## 12. ASSET LISTING & PAIR SYSTEM

### Core Concept: Pairs, Not Just Assets

BTC can be traded on Bitget (CEX) or via 1inch (DEX). Each is a different **Pair** with a unique `pairId`.

```solidity
// pairId = keccak256(asset, source, quoteToken, chainId)
// This uniquely identifies WHERE and HOW an asset is traded
```

### Pair Registry

| Pair ID | Asset | Source | Quote | Chain | Type |
|---------|-------|--------|-------|-------|------|
| 0x000...001 | BTC | Bitget | USDC | N/A (CEX) | CEX |
| 0x000...002 | BTC | Bitget | USDT | N/A (CEX) | CEX |
| 0x226...abc | WBTC | 1inch | USDC | Arbitrum | DEX |
| 0xc02...def | WETH | 1inch | USDC | Ethereum | DEX |
| 0x123...ghi | SOL | 1inch-Fusion+ | USDC | Solana | DEX |
| 0x456...jkl | BONK | 1inch-Fusion+ | USDC | Solana | DEX |

### Source Types & Execution

| Source Type | Execution Method | Custody | Fill Verification |
|-------------|------------------|---------|-------------------|
| **CEX (Bitget)** | AP reads TradeRequest event, places limit order | CEX account (AP-controlled) | Issuers verify via Bitget read-only API |
| **DEX (1inch same-chain)** | BLS-piloted custody calls 1inch Aggregation Router | BLSCustody on that chain | On-chain - swap events |
| **DEX (1inch Fusion+)** | BLS-piloted custody initiates intent-based swap | BLSCustody on Arbitrum hub | 1inch settlement contract |

### Global Asset List
- Issuers maintain whitelist of tradeable assets
- New assets: Issuers propose + approve (11/20 BLS)
- Each asset can have multiple pairs (different sources/quotes)
- Delisting: Affects new ITP creations only (not rebalance)

### Pair Whitelist Requirements

Before a pair can be used:
1. **Asset whitelisted** - in global asset registry
2. **Source approved** - CEX account or DEX router whitelisted
3. **Liquidity check** - minimum $10k daily volume
4. **Price feed available** - Bitget API or 1inch quote accessible

### Per-ITP Pair Configuration

Each ITP specifies which pairs it uses for each asset:

```solidity
struct ITPPairConfig {
    bytes32[] pairIds;           // List of pairs this ITP can trade
    mapping(address => bytes32) preferredPair;  // asset => preferred pairId
}
```

**Rules:**
- ITP can only trade pairs it has configured
- If preferred pair unavailable, fallback to secondary
- If all pairs for an asset unavailable → ITP paused for that asset

---

## 13. MULTI-CHAIN COLLATERAL & CUSTODY

### Overview

The system maintains BLS-piloted custody wallets across multiple chains. All controlled by the same 11/20 issuer threshold.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTI-CHAIN CUSTODY ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   INDEX L3 (ORBIT CHAIN)                                                │
│   ──────────────────────                                                │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                      BLSCustody.sol                               │  │
│   │                                                                   │  │
│   │  • Holds all user USDC deposits (master pool)                    │  │
│   │  • BLS-signed actions ONLY                                       │  │
│   │  • Whitelisted: bridge to other chains, internal transfers       │  │
│   │                                                                   │  │
│   └───────────────────────────┬──────────────────────────────────────┘  │
│                               │                                          │
│                               │ BLS-Piloted Issuer Bridge               │
│                               │ (Fast: ~seconds, always bridges USDC)   │
│                               ▼                                          │
│   ARBITRUM (HUB CHAIN)                                                  │
│   ────────────────────                                                  │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                   BLSCustody (Arbitrum)                           │  │
│   │                                                                   │  │
│   │  • USDC inventory for swaps                                      │  │
│   │  • Controlled by BLS signatures (same issuer set)                │  │
│   │  • Whitelisted actions:                                          │  │
│   │    - Swap via 1inch Router                                       │  │
│   │    - Bridge back to L3                                           │  │
│   │    - Approve tokens for 1inch                                    │  │
│   │                                                                   │  │
│   └───────────────────────────┬──────────────────────────────────────┘  │
│                               │                                          │
│                               │ 1inch Fusion+ API                        │
│                               ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                      1INCH FUSION+                                │  │
│   │                                                                   │  │
│   │  Cross-chain atomic swaps to:                                    │  │
│   │  ├─ Ethereum (UNI, AAVE, LINK, etc.)                            │  │
│   │  ├─ Optimism (OP, VELO)                                         │  │
│   │  ├─ Base (AERO, cbBTC)                                          │  │
│   │  ├─ Polygon (MATIC ecosystem)                                   │  │
│   │  ├─ BSC (BNB, CAKE)                                             │  │
│   │  ├─ Avalanche (AVAX ecosystem)                                  │  │
│   │  └─ Solana (SOL, memecoins, PumpFun tokens)                     │  │
│   │                                                                   │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### BLS-Piloted Issuer Bridge (Two-Phase with Verification)

Native Orbit bridge has ~10 min delay. BLS-piloted bridge is faster with source lock verification.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TWO-PHASE BRIDGE WITH VERIFICATION                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   PHASE 1: LOCK ON SOURCE                                               │
│   ───────────────────────                                               │
│                                                                          │
│   L3 CUSTODY                                                            │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │  1. Issuers BLS-sign: BRIDGE_LOCK(amount, destChain, nonce)      │  │
│   │  2. Contract locks USDC in escrow                                 │  │
│   │  3. Emit BridgeLockConfirmed(amount, destChain, nonce, blockHash)│  │
│   │  4. Lock includes: block.number, blockhash(block.number - 1)     │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   PHASE 2: VERIFY AND RELEASE ON DESTINATION                            │
│   ──────────────────────────────────────────────                        │
│                                                                          │
│   ARBITRUM CUSTODY                                                       │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │  5. Issuers observe BridgeLockConfirmed event via multiple RPCs  │  │
│   │  6. Wait for finality (N confirmations on L3)                    │  │
│   │  7. Build release proof:                                          │  │
│   │     - Source tx hash                                              │  │
│   │     - Source block number + hash                                  │  │
│   │  8. BLS-sign: BRIDGE_RELEASE(amount, nonce, sourceProof)         │  │
│   │  9. Contract verifies:                                            │  │
│   │     a. BLS signature valid                                        │  │
│   │     b. Nonce not used                                             │  │
│   │     c. Source proof matches expected format                       │  │
│   │  10. Release USDC to destination                                  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   TIMEOUT HANDLING                                                       │
│   ────────────────                                                       │
│   If release not completed within 1 hour:                               │
│   - Source lock can be reversed by BLS vote                            │
│   - Requires 15/20 (higher threshold for reversal)                     │
│   - Funds returned to source custody                                    │
│                                                                          │
│   REVERSE (Arb → L3): Same flow, opposite direction                    │
│                                                                          │
│   TIMING: ~1-2 blocks on each chain (seconds, not minutes)             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Bridge Contracts (Two-Phase)

```solidity
// L3 Source Contract
contract L3BridgeCustody {
    struct PendingLock {
        uint256 amount;
        uint256 destChainId;
        uint256 lockedAt;
        uint256 lockedBlock;
        bytes32 lockedBlockHash;
        bool released;
        bool reversed;
    }

    mapping(uint256 => PendingLock) public pendingLocks;
    uint256 public bridgeNonce;

    uint256 public constant LOCK_TIMEOUT = 1 hours;
    uint256 public constant REVERSAL_THRESHOLD = 15;  // 15/20

    function initiateBridge(
        uint256 destChainId,
        uint256 amount,
        bytes calldata blsSignature
    ) external returns (uint256 nonce) {
        bytes32 message = keccak256(abi.encode(
            "BRIDGE_LOCK",
            block.chainid,
            destChainId,
            amount,
            bridgeNonce
        ));
        require(verifyBLS(blsSignature, message), "Invalid BLS");

        usdc.transferFrom(msg.sender, address(this), amount);

        nonce = bridgeNonce++;
        pendingLocks[nonce] = PendingLock({
            amount: amount,
            destChainId: destChainId,
            lockedAt: block.timestamp,
            lockedBlock: block.number,
            lockedBlockHash: blockhash(block.number - 1),
            released: false,
            reversed: false
        });

        emit BridgeLockConfirmed(
            amount,
            destChainId,
            nonce,
            block.number,
            blockhash(block.number - 1)
        );

        return nonce;
    }

    function markReleased(
        uint256 nonce,
        bytes32 destTxHash,
        bytes calldata blsSignature
    ) external {
        bytes32 message = keccak256(abi.encode("BRIDGE_RELEASED", nonce, destTxHash));
        require(verifyBLS(blsSignature, message), "Invalid BLS");
        pendingLocks[nonce].released = true;
        emit BridgeReleaseConfirmed(nonce, destTxHash);
    }

    function reverseLock(
        uint256 nonce,
        bytes calldata blsSignature,
        uint256 signerCount
    ) external {
        PendingLock storage lock = pendingLocks[nonce];
        require(!lock.released, "Already released");
        require(!lock.reversed, "Already reversed");
        require(block.timestamp >= lock.lockedAt + LOCK_TIMEOUT, "Timeout not reached");

        bytes32 message = keccak256(abi.encode("BRIDGE_REVERSE", nonce));
        require(verifyBLSWithCount(blsSignature, message, signerCount), "Invalid BLS");
        require(signerCount >= REVERSAL_THRESHOLD, "Need 15/20");

        lock.reversed = true;
        usdc.transfer(address(custody), lock.amount);
        emit BridgeReversed(nonce, lock.amount);
    }
}

// Arbitrum Destination Contract
contract ArbBridgeCustody {
    struct ReleaseProof {
        uint256 sourceChainId;
        uint256 sourceBlockNumber;
        bytes32 sourceBlockHash;
        bytes32 sourceTxHash;
    }

    mapping(uint256 => mapping(uint256 => bool)) public bridgeCompleted;

    function completeBridge(
        uint256 sourceChainId,
        uint256 amount,
        uint256 nonce,
        ReleaseProof calldata proof,
        bytes calldata blsSignature
    ) external {
        require(!bridgeCompleted[sourceChainId][nonce], "Already completed");

        bytes32 message = keccak256(abi.encode(
            "BRIDGE_RELEASE",
            sourceChainId,
            block.chainid,
            amount,
            nonce,
            proof.sourceBlockNumber,
            proof.sourceBlockHash,
            proof.sourceTxHash
        ));
        require(verifyBLS(blsSignature, message), "Invalid BLS");

        bridgeCompleted[sourceChainId][nonce] = true;
        usdc.transfer(msg.sender, amount);
        emit BridgeCompleted(sourceChainId, amount, nonce, proof.sourceTxHash);
    }
}
```

### Issuer Bridge Verification (Rust)

```rust
async fn process_bridge_release(
    &self,
    lock_event: BridgeLockConfirmed,
) -> Result<(), BridgeError> {
    // Verify lock via multiple RPCs (2/3 agreement)
    let confirmed = self.multi_rpc.confirm_event(
        lock_event.source_chain,
        lock_event.tx_hash,
        lock_event.block_number,
        12,  // confirmations
    ).await?;

    if !confirmed {
        return Err(BridgeError::LockNotConfirmed);
    }

    // Verify block hash
    let block = self.multi_rpc.get_block(
        lock_event.source_chain,
        lock_event.block_number,
    ).await?;

    if block.parent_hash != lock_event.locked_block_hash {
        return Err(BridgeError::BlockHashMismatch);
    }

    // Build proof and sign release
    let proof = ReleaseProof {
        source_chain_id: lock_event.source_chain,
        source_block_number: lock_event.block_number,
        source_block_hash: block.hash,
        source_tx_hash: lock_event.tx_hash,
    };

    let signature = self.bls_sign(encode_release_message(&proof)).await?;
    self.dest_custody.complete_bridge(proof, signature).await
}
```

### Bridge Security Properties

| Attack | Mitigation |
|--------|------------|
| Mint without lock | Release requires issuers to verify lock event via multiple RPCs |
| Double release | Nonce bitmap prevents replay |
| Fake lock event | 2/3 RPC agreement + N confirmations |
| Stuck funds | 1-hour timeout + 15/20 reversal |
| Cross-chain replay | Both chain IDs in signed message |

### Swap Rollback Protocol

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SWAP ROLLBACK PROTOCOL                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   PROBLEM: Swap fails AFTER bridging to destination chain               │
│   USDC is on Arbitrum, swap failed, user has no ITP                     │
│   ───────────────────────────────────────────────────────               │
│                                                                          │
│   CONSTANTS:                                                            │
│   ──────────                                                            │
│   MAX_SWAP_TIMEOUT = 30 minutes                                         │
│                                                                          │
│   TRACKING (off-chain by issuers):                                      │
│   ─────────────────────────────────                                     │
│   struct PendingSwap {                                                  │
│       bytes32 orderId;                                                  │
│       uint256 chainId;                                                  │
│       uint256 amount;                                                   │
│       uint256 deadline;        // timestamp + MAX_SWAP_TIMEOUT          │
│       SwapStatus status;       // PENDING, COMPLETED, FAILED, ROLLEDBACK│
│   }                                                                     │
│                                                                          │
│   ROLLBACK FLOW:                                                        │
│   ──────────────                                                        │
│   1. Swap initiated on destination chain (e.g., 1inch on Arbitrum)     │
│   2. Issuers monitor for completion                                     │
│   3. If swap doesn't complete within MAX_SWAP_TIMEOUT:                  │
│      a. Mark order as "FAILED_SWAP"                                     │
│      b. BLS-sign bridge back: destination → L3                          │
│      c. Return USDC to user on L3                                       │
│      d. No ITP minted                                                   │
│   4. Emit SwapRollback(orderId, reason, usdcReturned)                   │
│                                                                          │
│   ON-CHAIN EVENT:                                                       │
│   ───────────────                                                       │
│   event SwapRollback(                                                   │
│       bytes32 indexed orderId,                                          │
│       string reason,           // "TIMEOUT", "SLIPPAGE", "REVERTED"    │
│       uint256 usdcReturned,                                             │
│       address user                                                      │
│   );                                                                    │
│                                                                          │
│   PARTIAL SWAP ROLLBACK:                                                │
│   ──────────────────────                                                │
│   If ITP requires multiple swaps and one fails:                         │
│   1. Reverse all completed swaps for this order                         │
│   2. Bridge all USDC back to L3                                         │
│   3. Refund user in full                                                │
│   4. Atomic: either all swaps succeed or none do                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Stateless Collateral Tracking

Issuers are stateless and reconstruct state from chain. All collateral tracking is on-chain.

```solidity
contract CollateralRegistry {
    // Current collateral per ITP per chain
    mapping(bytes32 => mapping(uint256 => uint256)) public itpCollateralByChain;

    event CollateralMoved(
        bytes32 indexed itpId,
        uint256 indexed fromChain,
        uint256 indexed toChain,
        uint256 amount,
        bytes32 txType  // "BRIDGE", "SWAP_IN", "SWAP_OUT", "BUY"
    );

    function recordCollateralMove(
        bytes32 itpId,
        uint256 fromChain,
        uint256 toChain,
        uint256 amount,
        bytes32 txType,
        bytes calldata blsSignature
    ) external {
        bytes32 message = keccak256(abi.encode(
            "COLLATERAL_MOVE", itpId, fromChain, toChain, amount, txType, nonce++
        ));
        require(verifyBLS(blsSignature, message), "Invalid BLS");

        if (fromChain != 0) {
            itpCollateralByChain[itpId][fromChain] -= amount;
        }
        if (toChain != 0) {
            itpCollateralByChain[itpId][toChain] += amount;
        }

        emit CollateralMoved(itpId, fromChain, toChain, amount, txType);
    }
}
```

### Solana Custody: Squads Multisig

Solana doesn't have BN254 precompiles, so we use Squads v4 multisig.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SOLANA: SQUADS MULTISIG                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   WHY SQUADS (not BLS):                                                 │
│   • Solana doesn't have BN254 precompiles                               │
│   • Squads v4 is audited, battle-tested                                 │
│   • Same 11/20 threshold, different key type (Ed25519)                  │
│                                                                          │
│   SETUP:                                                                │
│   ──────                                                                │
│   1. Each of 20 issuers generates Ed25519 keypair                       │
│   2. Public keys collected via secure channel (PGP-signed)              │
│   3. Squads multisig deployed with all 20 pubkeys                       │
│   4. Threshold set: 11/20                                               │
│   5. Test transaction: $1 USDC transfer, all verify                     │
│                                                                          │
│   EXECUTION FLOW:                                                       │
│   ───────────────                                                       │
│   1. Issuers agree on action (e.g., swap SOL → USDC via Jupiter)       │
│   2. One issuer creates Squads proposal with transaction                │
│   3. 10 other issuers approve (sign)                                    │
│   4. Anyone executes once threshold reached                             │
│                                                                          │
│   WHITELISTING:                                                         │
│   ─────────────                                                         │
│   • Jupiter aggregator program                                          │
│   • Wormhole/1inch settlement program                                   │
│   • Specific token mints (SPL tokens)                                   │
│                                                                          │
│   KEY MANAGEMENT:                                                       │
│   ───────────────                                                       │
│   Issuers hold TWO key types:                                           │
│   • BLS (BN254) for all EVM chains                                      │
│   • Ed25519 for Solana Squads                                           │
│   Compromise of one doesn't affect the other                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Custody Flow (Updated)

```
User deposits USDC → L3 BLSCustody (master pool)
↓
Issuers run netting engine → determine destination chains
↓
If inventory sufficient on destination:
  → Use local inventory directly
If inventory insufficient:
  → BLS-sign bridge request (two-phase lock→verify→release)
  → Lock USDC on L3
  → Release USDC on destination
↓
Execute trades (CEX via AP, DEX via BLSCustody)
↓
Update CollateralRegistry with movements
↓
Fills confirmed → ITP tokens minted
```

---

## 14. ORDER ROUTING & CROSS-CHAIN EXECUTION

### Overview

ITPs can contain assets with:
- Different quote currencies (USDC, USDT)
- Multiple liquidity sources (Bitget CEX, 1inch DEX)
- Assets on different chains (Arbitrum, Ethereum, Base, Solana)

The routing system optimizes for:
1. **Minimal bridges** - use local inventory when available, bridge when needed
2. **Minimal swaps** - net USDT flows before swapping
3. **Minimal slippage** - pair merging reduces market impact
4. **Fair fees** - proportional to order size

### Routing Decision Tree

```
For each merged order in batch:
│
├─ Is pairId a CEX pair (Bitget)?
│   └─ YES → Route to AP via TradeRequest event
│
├─ Is pairId a DEX pair on Arbitrum?
│   └─ YES → Check Arbitrum inventory
│       ├─ Sufficient → Execute directly via BLSCustody
│       └─ Insufficient → Bridge from L3 (two-phase)
│
├─ Is pairId a cross-chain DEX pair (1inch Fusion+)?
│   └─ YES → Route through Arbitrum hub
│       ├─ Bridge to Arbitrum (if needed)
│       └─ Execute Fusion+ swap via BLSCustody
│
└─ Is pairId a Solana pair?
    └─ YES → Route through Squads multisig
        ├─ 1inch Fusion+ from Arbitrum
        └─ OR direct Jupiter swap if USDC already on Solana
```

### Collateral Routing: Inventory-First with On-Demand Bridging

Use local inventory when available. When insufficient, bridge from L3 master pool (no debt tracking between custodies).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     HYBRID COLLATERAL POOLS                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   INDEX L3 MASTER POOL                                                   │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  Master Pool: USDC reserve                                      │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│              ┌───────────────┼───────────────┐                          │
│              ▼               ▼               ▼                          │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│   │ Bitget Pool  │  │ Arbitrum Pool│  │ Ethereum Pool│                  │
│   │ $XXk USDC    │  │ $XXk USDC    │  │ $XXk USDC    │                  │
│   └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                          │
│   NORMAL: Use pool (instant)                                            │
│   OVERFLOW: On-demand transfer from master                              │
│   REBALANCE: Periodic bulk transfers                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Hybrid Pool Algorithm

```rust
fn process_cycle_hybrid(
    orders: Vec<Order>,
    venue_pools: &mut HashMap<VenueId, VenuePool>
) -> RoutingPlan {
    let venue_batches = group_by_venue(orders);

    let mut immediate_trades = Vec::new();
    let mut deferred_trades = Vec::new();
    let mut transfers = Vec::new();

    for (venue_id, batch) in venue_batches {
        let pool = venue_pools.get_mut(&venue_id).unwrap();
        let total_needed: U256 = batch.iter().map(|o| o.amount).sum();

        if pool.current_balance >= total_needed {
            // Pool sufficient - execute immediately
            pool.current_balance -= total_needed;
            immediate_trades.push(TradeRequest { venue_id, orders: batch });
        } else if pool.current_balance > U256::zero() {
            // Pool partial - split batch
            let (immediate, deferred) = split_orders_by_amount(batch, pool.current_balance);

            pool.current_balance = U256::zero();
            immediate_trades.push(TradeRequest { venue_id, orders: immediate });

            // Deferred needs on-demand transfer
            let overflow = total_needed - pool.current_balance;
            transfers.push(create_transfer(venue_id, overflow));
            deferred_trades.push(DeferredTrade { venue_id, orders: deferred });
        } else {
            // Pool empty - all deferred
            transfers.push(create_transfer(venue_id, total_needed));
            deferred_trades.push(DeferredTrade { venue_id, orders: batch });
        }

        // Trigger replenishment if pool below threshold
        if pool.current_balance < pool.min_threshold {
            transfers.push(CollateralTransfer {
                venue_id,
                amount: pool.target_balance,
                priority: Priority::Background,
            });
        }
    }

    RoutingPlan { immediate_trades, deferred_trades, collateral_transfers: transfers }
}
```

#### Pool Configuration

```solidity
struct VenuePool {
    uint256 targetBalance;     // Target USDC balance
    uint256 currentBalance;    // Current USDC balance
    uint256 minThreshold;      // Trigger replenish below this
    uint256 lastRebalance;     // Timestamp
}

mapping(uint256 => VenuePool) public venuePools;  // venueId => pool

event PoolRebalanceNeeded(uint256 indexed venueId, uint256 amount);
event PoolRebalanceComplete(uint256 indexed venueId, uint256 amount);
```

### Quote Currency Routing: On-Demand Swap + USDT Netting

Some pairs are USDC, some are USDT. Net the flows before swapping.

```
┌─────────────────────────────────────────────────────────────────────────┐
│           QUOTE CURRENCY: ON-DEMAND SWAP + USDT NETTING                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   STEP 1: CLASSIFY ORDERS                                               │
│   ───────────────────────                                               │
│   USDC pairs: BTC/USDC, ETH/USDC, AAVE/USDC                            │
│   USDT pairs: SOL/USDT, LINK/USDT                                       │
│                                                                          │
│   STEP 2: CALCULATE NET FLOWS                                           │
│   ───────────────────────────                                           │
│   USDC flow:                                                            │
│   • Buys consume:  -$700                                                │
│   • Sells produce: +$400                                                │
│   • NET: -$300 (need $300 USDC)                                         │
│                                                                          │
│   USDT flow:                                                            │
│   • Buys consume:  -$300                                                │
│   • Sells produce: +$150                                                │
│   • NET: -$150 (need $150 USDT)                                         │
│                                                                          │
│   STEP 3: SWAP ONLY NET DIFFERENCE                                      │
│   ────────────────────────────────                                      │
│   Swap $150 USDC → USDT (not $300!)                                     │
│   Netting saved 50% of swap volume                                      │
│                                                                          │
│   STEP 4: EXECUTE TRADES                                                │
│   ──────────────────────                                                │
│   Sells first (produce quote currency)                                  │
│   Then buys (consume quote currency)                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2-Step Execution Flow

```
STEP 1: PREPARE COLLATERAL
────────────────────────────
1a. Calculate net USDC/USDT needs across all orders
1b. Execute swap for NET difference only (on L3 DEX)
1c. Route collateral to destination venue pools

STEP 2: EXECUTE TRADES
──────────────────────
2a. Execute SELL orders first (produces quote currency)
2b. Execute BUY orders (consumes quote currency)
```

### Cross-Chain Strategy: 1inch via Arbitrum Hub

All cross-chain swaps route through Arbitrum as hub, using BLS-piloted Custody.

```
┌─────────────────────────────────────────────────────────────────────────┐
│              1INCH VIA ARBITRUM HUB (BLS CUSTODY)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   INDEX L3                                                               │
│   ┌──────────────┐                                                       │
│   │ Custody.sol  │ ← BLS-signed actions only                            │
│   │ (holds USDC) │                                                       │
│   └──────┬───────┘                                                       │
│          │                                                               │
│          │ 1. Bridge USDC (native L3→Arbitrum)                          │
│          ▼                                                               │
│   ARBITRUM (HUB)                                                         │
│   ┌──────────────┐                                                       │
│   │ Custody      │ ← BLS-piloted, whitelisted actions                   │
│   │ (Arb wallet) │                                                       │
│   └──────┬───────┘                                                       │
│          │                                                               │
│          │ 2. Swap via 1inch (BLS-signed tx)                            │
│          ▼                                                               │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                      1INCH FUSION/FUSION+                         │  │
│   │                                                                   │  │
│   │  Supported chains via Fusion+:                                   │  │
│   │  • EVM: Ethereum, Optimism, Base, Polygon, BSC, Avalanche       │  │
│   │  • Non-EVM: Solana (1M+ tokens including memecoins)             │  │
│   │                                                                   │  │
│   │  Cross-chain atomic swaps, no bridges needed                     │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**BLS-Piloted Custody:**
- Custody.sol on L3 and Arbitrum controlled by issuer BLS signatures
- Whitelisted actions: swap via 1inch, bridge to/from L3
- No direct external calls without BLS consensus

**Why Arbitrum as Hub:**
- Best 1inch liquidity
- Fast native bridge from L3 (Orbit → Arbitrum)
- All 1inch Fusion+ routes accessible from Arbitrum

### Provider Fees

| Operation | Provider | Fee | Speed |
|-----------|----------|-----|-------|
| Quote (100 assets) | 1inch Business | API cost | 2.5 sec |
| L3 → Arbitrum bridge | Native Orbit | ~0% | ~10 min |
| Same-chain swap | 1inch Fusion | ~0.3% | Instant |
| Cross-chain swap | 1inch Fusion+ | ~0.2% | 1-5 min |
| Solana swap | 1inch Fusion+ | ~0.2% | 1-5 min |

### 1inch API Rate Limit Strategy

**CRITICAL:** 1inch APIs have rate limits. System must handle gracefully.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    1INCH API RATE LIMIT HANDLING                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   STRATEGY 1: MULTIPLE API KEYS                                         │
│   ─────────────────────────────                                         │
│   • Each issuer uses own 1inch API key                                  │
│   • 20 issuers = 20x rate limit capacity                                │
│   • Leader rotates which issuer fetches quotes                          │
│                                                                          │
│   STRATEGY 2: EXPONENTIAL BACKOFF                                       │
│   ────────────────────────────────                                      │
│   On 429 (rate limit) response:                                         │
│     Attempt 1: wait 1 second → retry                                    │
│     Attempt 2: wait 2 seconds → retry                                   │
│     Attempt 3: wait 4 seconds → retry                                   │
│     Attempt 4: wait 8 seconds → retry                                   │
│     Attempt 5: wait 16 seconds → retry                                  │
│     Max retries: 5                                                      │
│     After 5 failures: use fallback                                      │
│                                                                          │
│   STRATEGY 3: QUOTE CACHING                                             │
│   ─────────────────────────                                             │
│   • Cache quotes for 5 seconds                                          │
│   • Multiple orders in same cycle reuse cached quote                    │
│   • Reduces API calls by 60-80%                                         │
│                                                                          │
│   STRATEGY 4: ON-CHAIN FALLBACK                                         │
│   ─────────────────────────────                                         │
│   If 1inch API completely unavailable:                                  │
│   1. Read DEX pool reserves directly (Uniswap, Sushiswap)              │
│   2. Calculate quote from reserves                                      │
│   3. Higher latency but functional                                      │
│   4. Flag: "DEGRADED_QUOTES" in batch                                  │
│                                                                          │
│   ISSUER IMPLEMENTATION:                                                │
│   ──────────────────────                                                │
│   struct QuoteCache {                                                   │
│       bytes32 pairId;                                                   │
│       uint256 quote;                                                    │
│       uint256 timestamp;                                                │
│   }                                                                     │
│   HashMap<PairId, QuoteCache> quote_cache;                              │
│                                                                          │
│   fn get_quote(pair_id) -> Quote {                                      │
│       if cache[pair_id].timestamp > now() - 5s:                         │
│           return cache[pair_id].quote;                                  │
│       return fetch_with_backoff(pair_id);                               │
│   }                                                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fusion+ Execution Retry (Same as AP Pattern)

Fusion+ cross-chain swaps use the same retry mechanism as AP/Bitget orders:

```
FUSION+ EXECUTION RETRY:
────────────────────────

1. Submit Fusion+ intent via 1inch API
2. Timeout: 60 seconds (same as Bitget order timeout)
3. If not settled within timeout → Flag, retry next cycle
4. After 3 failed attempts → Defer order
5. If deferred >3 cycles → Auto-refund user USDC

MONITORING:
───────────
- Track via 1inch settlement events on destination chain
- Issuers verify settlement completion via multiple RPCs
- Same violation tracking as AP (3 consecutive failures = investigate)

NO SPECIAL FALLBACK: Standard retry + defer + refund flow applies.
```

### Sell Flow (Reverse)

Assets on destination chains → USDC back to L3:

```
NORMAL (90%): Use destination chain pools
──────────────────────────────────────────
• Sell asset locally → USDC stays in pool
• No bridge needed
• Pools rebalance periodically

OVERFLOW: Cross-chain swap
──────────────────────────
• 1inch Fusion+ or Across
• Asset (Eth) → USDC (L3)
```

---

## 15. ECONOMICS

| Fee Type | Details |
|----------|---------|
| Trading Fees | Collected in pot |
| Management Fees | Daily, annualized 0-10%, set by deployer |
| ITP Deployer Share | 70% (changeable) |
| Issuer Compensation | From fee pot, admin splits later |
| Gas (issuers) | Free IND tokens provided |
| Gas (users) | User pays for order submission |

---

## 16. SECURITY & RECOVERY

### BLS Signature Requirements
- Order batch confirmations
- Trade lists for AP
- Rebalance approvals
- Node kick votes
- Inventory updates
- Weight updates

### Issuer Consensus
- Threshold: Majority (11/20)
- Minimum issuers to operate: 3 (below 3 = emergency pause)
- Threshold when <20 issuers: 2/3 majority
- Price disagreement: See Section 7 Price Validation
- Track wrong answers locally per issuer

### BLS Replay Protection

**Two-Layer Protection:**

1. **Cycle-based (Index L3):** Every batch includes `cycleNumber`
2. **Nonce Bitmap (Multi-chain Custody):** Non-sequential nonces prevent gap attacks

```solidity
// Index L3 - cycle-based protection
mapping(uint256 => bool) public cycleProcessed;

function confirmBatch(uint256 cycle, bytes calldata data, bytes calldata blsSig) external {
    require(!cycleProcessed[cycle], "Cycle already processed");
    require(cycle == currentCycle, "Wrong cycle");
    cycleProcessed[cycle] = true;
    // process batch, emit TradeRequest events per order...
}

// Multi-chain Custody - nonce bitmap protection
mapping(uint256 => uint256) public usedNonces;  // Bitmap

function execute(..., uint256 nonce, ...) external {
    // Nonce can be ANY unused value (not sequential)
    // Prevents "gap attack" where attacker delays nonce N to block N+1
    uint256 wordIndex = nonce / 256;
    uint256 bitIndex = nonce % 256;
    uint256 word = usedNonces[wordIndex];
    uint256 mask = 1 << bitIndex;
    require(word & mask == 0, "Nonce already used");
    usedNonces[wordIndex] = word | mask;
    // ...
}
```

### Cross-Chain Replay Protection

**CRITICAL:** All custody contracts on different chains use same BLS public key. Messages MUST include `chainId` to prevent cross-chain replay.

```
Signed message includes:
• block.chainid (42161 for Arbitrum, 1 for Ethereum, etc.)
• address(this) (custody address - different per chain)
• nonce (bitmap-tracked)
• action data

→ Signature valid on Arbitrum is INVALID on Ethereum
→ Signature valid on one custody is INVALID on another custody (same chain)
```

| Risk | Mitigation |
|------|------------|
| Replay same chain | Nonce bitmap |
| Replay cross-chain | chainId in message |
| Replay to different custody | address(this) in message |
| Nonce gap attack | Bitmap (not sequential) |

### Issuer Griefing Protection
Track invalid signatures locally:
```
1. Issuer sends invalid data/signature
2. Other issuers detect and log locally
3. After 3 strikes in 1 hour → propose kick vote
4. Kick vote requires 11/20 BLS signatures
```

### BLS Key Storage
| Phase | Method |
|-------|--------|
| Phase 1 | .env file on issuer's disk |
| Phase 2 | Encrypted cloud backup (AWS/GCP) |
| Production | HSM (Hardware Security Module) |

**Key loss recovery:**
1. Issuer reports key loss to admin
2. Admin removes issuer from registry (recalculates agg pubkey)
3. Issuer generates new keypair
4. Admin re-adds issuer with new pubkey

### Emergency Pause
- Triggered by: Issuer consensus (11/20)
- Effect: Stops all new orders system-wide
- Recovery: Admin + issuer consensus to resume

### Emergency User Withdrawal (Manual Admin Process)

**During system pause, user withdrawals are handled manually by admin.**

- No automated time-locked exit mechanism
- Users must contact support to request emergency withdrawal
- Admin evaluates each case individually
- Admin can execute manual USDC transfers from custody if justified
- Pro-rata share based on ITP holdings and available L3 custody USDC

**Note:** This is a safety valve for extended pauses. Normal operations should resume via issuer consensus.

### Per-ITP Pause
- Triggered by: Issuer consensus (11/20)
- Effect: Stops new orders for specific ITP only
- Reasons: Source offline, asset delisting, suspicious activity
- Recovery: Issuer consensus to resume

### Asset Delisting Flow
```
1. Issuer proposes delist (reason: Bitget delisted, security issue)
2. 11/20 issuers approve via BLS
3. Asset marked "DELISTING" on-chain
4. Affected ITPs identified automatically
5. For each affected ITP:
   a. Pause new orders for that ITP
   b. Queue forced rebalance: delisted asset weight → 0%
   c. Scale other weights proportionally to sum = 100%
6. Forced rebalance executes over N cycles (liquidity-dependent)
7. Once all ITPs have 0% of delisted asset:
   a. Asset removed from global whitelist
   b. ITPs resumed
8. New ITP creation cannot include delisted assets
```

### AP Accountability (Limit Order Enforcement)

**Principle:** Limit orders protect users. AP cannot fill at worse price. No slashing - suspension only.

```
┌─────────────────────────────────────────────────────────────────────────┐
│          AP ACCOUNTABILITY: LIMIT ORDER ENFORCEMENT                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   FLOW:                                                                  │
│   1. Issuers emit LimitOrderRequest(pairId, side, amount, limitPrice)   │
│   2. AP MUST place limit order on Bitget at limitPrice                  │
│   3. If market doesn't reach limitPrice → Order doesn't fill            │
│   4. Issuers verify via Bitget read-only API:                           │
│      - Order was placed at correct limitPrice                           │
│      - Fill price ≤ limitPrice (for buys)                               │
│      - Fill price ≥ limitPrice (for sells)                              │
│                                                                          │
│   VIOLATION DETECTION:                                                   │
│   ────────────────────                                                   │
│   IF AP places market order OR wrong price:                             │
│   - Issuers detect mismatch via Bitget read-only API                    │
│   - Flag AP, log incident with timestamp                                │
│   - After 3 violations in 24h → Vote to suspend AP (11/20 BLS)         │
│   - Suspended AP cannot submit fills until admin review                 │
│                                                                          │
│   VERIFICATION CHECKS (every fill):                                     │
│   ─────────────────────────────────                                     │
│   1. Order exists on Bitget at expected price                           │
│   2. Fill timestamp within expected window                              │
│   3. Fill amount matches or explains partial                            │
│   4. Fill price respects limit (not worse)                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Rogue AP Detection

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Timeout | Order not filled in 60 seconds | Flag, log incident |
| Bad price | Fill worse than limitPrice | Flag, log incident |
| Mismatch | Reported fill doesn't match Bitget API | Flag, log incident |
| Repeated violations | 3 violations in 24h | BLS vote to suspend |
| Extended offline | 5 minutes no fills | Auto-pause AP |

### AP Suspension & Restoration

```
SUSPENSION (triggered by 11/20 BLS vote OR auto-pause):
1. AP marked as SUSPENDED in issuer state
2. Issuers stop emitting TradeRequest for this AP
3. Pending orders queue (wait for restoration or timeout)
4. Alert admin via monitoring system

RESTORATION (admin only):
1. Admin reviews incident logs
2. Admin verifies AP issue resolved
3. Admin calls restoreAP() or issues command to issuers
4. AP metrics reset
5. AP resumes receiving TradeRequest events
```

### AP Complete Failure
```
1. AP goes offline
2. Orders queue (issuers keep emitting TradeRequest events)
3. AP comes back → processes queued requests in order
4. If AP offline >5 minutes:
   - Pause new orders for that source
   - Existing orders wait up to 1h
   - After 1h: auto-refund pending orders
5. Alert admin for manual intervention
```

### AP Buffer Management
| Aspect | Decision |
|--------|----------|
| Funding | Protocol funds buffer (not AP) |
| Tracking | Off-chain only (no Solidity tracking) |
| Fee arrangement | Separate deal between protocol and AP |
| Buffer size | Managed by AP, not enforced on-chain |

### Trade Request Flow
```
1. Issuers batch orders and emit TradeRequest event
2. AP reads events from chain (no direct P2P)
3. AP executes on Bitget respecting rate limits
4. If no new TradeRequest, AP completes existing queue
5. Issuers track AP progress via Bitget view API
6. Rate limiting is issuer responsibility (batch sizing)
```

### All Issuers Reboot
```
1. Nodes boot, read IssuerRegistry
2. Wait for quorum (14/20 or 2/3 if <20)
3. Run state reconstruction algorithm (see Appendix D)
4. Restore BLS key from .env
5. Wait 1 cycle observing (don't sign)
6. Resume participating from next cycle
7. Stale batches (>1h): auto-cancel, refund
```

### New Issuer Join
```
1. Admin adds issuer to registry (address, IP, BLS pubkey)
2. On-chain: agg_pubkey updated via ecAdd
3. New issuer runs state reconstruction (Appendix D)
4. New issuer waits 1 cycle observing
5. New issuer starts participating
```

---

## 17. ISSUER KEY MANAGEMENT

### Overview

Issuers hold cryptographic keys to sign BLS messages. Key management is critical for security and operational continuity.

### Key Types per Issuer

| Key Type | Curve | Usage | Storage |
|----------|-------|-------|---------|
| **BLS (BN254)** | BN254 | All EVM chain operations | Encrypted file → HSM (production) |
| **Ed25519** | Ed25519 | Solana Squads multisig only | Separate encrypted file |
| **ETH Signer** | secp256k1 | Submit transactions to chains | Standard wallet |

**Isolation Principle:** Compromise of one key type doesn't affect others.

### Individual Key Rotation (with Safe Period)

Individual issuers can rotate their keys without rotating all keys. This is critical for:
- Compromised key recovery
- Regular security hygiene
- Issuer hardware upgrades

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ISSUER KEY ROTATION (WITH SAFE PERIOD)                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ROTATION FLOW:                                                        │
│   ──────────────                                                        │
│   1. Issuer #7 wants to rotate key                                      │
│   2. Issuer #7 generates new BLS keypair                               │
│   3. Issuer #7 signs rotation request with OLD key                     │
│   4. Submit to L3 IssuerRegistry                                        │
│   5. 10/19 OTHER issuers approve (prevents rogue rotation)             │
│   6. After approval + 24h timelock:                                     │
│      - Wait for SAFE PERIOD (no pending batches)                       │
│      - Execute rotation                                                 │
│      - Old key valid for 10 more cycles (grace period)                 │
│                                                                          │
│   SAFE PERIOD CHECK:                                                    │
│   ──────────────────                                                    │
│   Rotation only executes when:                                          │
│   • Previous cycle fully confirmed                                      │
│   • No pending cross-chain settlements                                  │
│   • Current cycle is IDLE (not mid-batch)                              │
│                                                                          │
│   GRACE PERIOD:                                                         │
│   ─────────────                                                         │
│   • Old key remains valid for 10 cycles (10 seconds)                   │
│   • Allows any in-flight signatures to complete                        │
│   • After grace period: old key fully invalidated                      │
│                                                                          │
│   SECURITY:                                                             │
│   ─────────                                                             │
│   • Rotating issuer CANNOT approve their own rotation                   │
│   • 10/19 threshold prevents single issuer from hijacking              │
│   • 24h timelock allows time to detect malicious rotations             │
│   • Safe period prevents signature invalidation mid-batch              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Rotation Contract (with Safe Period)

```solidity
contract IssuerRegistry {
    mapping(uint256 => bytes) public issuerPubkeys;  // Individual keys
    bytes public aggregatedPubkey;                    // Combined for verification
    mapping(bytes32 => uint256) public keyGracePeriod;  // keyHash => validUntilCycle

    uint256 public constant ROTATION_TIMELOCK = 24 hours;
    uint256 public constant ROTATION_GRACE_CYCLES = 10;
    uint256 public constant ADMIN_FORCE_WINDOW = 48 hours;
    uint256 public constant ROTATION_APPROVAL_THRESHOLD = 10;  // 10/19 other issuers
    uint256 public constant SAFE_PERIOD = 1 hours;  // Wait after last approval

    struct KeyRotation {
        bytes newPubkey;
        uint256 approvalCount;
        uint256 requestedAt;
        bool executed;
        mapping(uint256 => bool) hasApproved;
    }

    mapping(uint256 => KeyRotation) private _pendingRotations;

    function requestKeyRotation(
        uint256 issuerId,
        bytes calldata newPubkey,
        bytes calldata signatureWithOldKey
    ) external {
        bytes32 message = keccak256(abi.encode("ROTATE", issuerId, newPubkey));
        require(verifyIndividualBLS(issuerPubkeys[issuerId], message, signatureWithOldKey));

        KeyRotation storage rotation = _pendingRotations[issuerId];
        rotation.newPubkey = newPubkey;
        rotation.approvalCount = 0;
        rotation.requestedAt = block.timestamp;
        rotation.executed = false;

        emit KeyRotationRequested(issuerId, newPubkey);
    }

    function approveRotation(
        uint256 rotatingIssuerId,
        uint256 approvingIssuerId,
        bytes calldata approverSignature
    ) external {
        require(rotatingIssuerId != approvingIssuerId, "Cannot self-approve");

        KeyRotation storage rotation = _pendingRotations[rotatingIssuerId];
        require(rotation.requestedAt != 0, "No rotation pending");
        require(!rotation.executed, "Already executed");
        require(!rotation.hasApproved[approvingIssuerId], "Already approved");

        bytes32 message = keccak256(abi.encode(
            "APPROVE_ROTATION", rotatingIssuerId, rotation.newPubkey
        ));
        require(verifyIndividualBLS(
            issuerPubkeys[approvingIssuerId], message, approverSignature
        ));

        rotation.hasApproved[approvingIssuerId] = true;
        rotation.approvalCount++;

        emit KeyRotationApproved(rotatingIssuerId, approvingIssuerId, rotation.approvalCount);
    }

    function executeRotation(uint256 issuerId) external {
        KeyRotation storage rotation = _pendingRotations[issuerId];
        require(rotation.requestedAt != 0, "No rotation pending");
        require(!rotation.executed, "Already executed");
        require(rotation.approvalCount >= ROTATION_APPROVAL_THRESHOLD, "Insufficient approvals");
        require(block.timestamp >= rotation.requestedAt + ROTATION_TIMELOCK, "Timelock");

        // Safe period check: 1h since last approval (unless force window enabled)
        // Inline check replaces standalone isRotationSafe() for simplicity
        if (!_forceWindowEnabled[issuerId]) {
            require(
                block.timestamp >= _lastApprovalTime[issuerId] + SAFE_PERIOD,
                "Safe period not elapsed"
            );
        }

        // Update keys with grace period for old key
        bytes memory oldPubkey = issuerPubkeys[issuerId];
        issuerPubkeys[issuerId] = rotation.newPubkey;
        aggregatedPubkey = recomputeAggregatedKey(oldPubkey, rotation.newPubkey);

        // Old key valid for 10 more cycles
        keyGracePeriod[keccak256(oldPubkey)] = currentCycle + ROTATION_GRACE_CYCLES;

        rotation.executed = true;
        if (_forceWindowEnabled[issuerId]) {
            _forceWindowEnabled[issuerId] = false;
        }

        emit KeyRotationExecuted(issuerId, oldPubkey, rotation.newPubkey);
    }

    // Emergency escape for stuck rotations (admin only)
    function forceRotationWindow(uint256 issuerId) external onlyAdmin {
        KeyRotation storage rotation = _pendingRotations[issuerId];
        require(rotation.requestedAt != 0, "No rotation pending");
        require(!rotation.executed, "Already executed");
        require(
            block.timestamp >= rotation.requestedAt + ADMIN_FORCE_WINDOW,
            "Not stuck yet (need 48h)"
        );

        _forceWindowEnabled[issuerId] = true;
        emit EmergencyRotationWindowOpened(issuerId);
    }

    function recomputeAggregatedKey(
        bytes memory oldKey,
        bytes memory newKey
    ) internal view returns (bytes memory) {
        uint256[2] memory negOld = ecNegate(bytesToPoint(oldKey));
        uint256[2] memory temp = ecAdd(bytesToPoint(aggregatedPubkey), negOld);
        uint256[2] memory newAgg = ecAdd(temp, bytesToPoint(newKey));
        return pointToBytes(newAgg);
    }
}
```

### Solana Key Rotation (Squads)

Squads multisig handles key rotation differently:

```
1. Create "Update Authority" proposal in Squads
2. New signer added to multisig
3. 11/20 approve the addition
4. Old signer removed (separate proposal)
5. Threshold remains 11/20

Squads manages this natively - no custom contract needed.
```

### Key Storage Progression

| Phase | BLS Key Storage | Ed25519 Storage | Recovery |
|-------|-----------------|-----------------|----------|
| **Phase 1** | Encrypted .env file | Encrypted .env file | Admin removes + re-adds |
| **Phase 2** | Cloud KMS (AWS/GCP) | Cloud KMS | Automated recovery |
| **Production** | HSM (Hardware Security Module) | HSM | Multi-party recovery |

### Emergency Key Compromise Response

```
IF single issuer key compromised:
1. Other issuers detect suspicious signatures
2. Initiate kick vote (11/20)
3. Remove compromised issuer from registry
4. Aggregated key recalculated (excludes bad key)
5. System continues with 19 issuers
6. New issuer onboarded when ready

IF multiple keys suspected compromised:
1. Emergency pause (any 11/20)
2. Admin investigation
3. Rotate all suspected keys via individual rotation
4. Resume after security audit

IF >9 keys compromised (threshold at risk):
1. Emergency pause
2. Admin initiates full key ceremony
3. All issuers generate new keys
4. New aggregated key deployed
5. All custody contracts updated
6. Historical signatures become invalid
```

---

## 18. GOVERNANCE & POLICIES

### Admin Path
| Phase | Model |
|-------|-------|
| Phase 1 | Single admin (EOA) |
| Phase 2+ | Multisig DAO |

### Issuer Misbehavior
| Policy | Decision |
|--------|----------|
| **Slashing** | NO - kick only, no financial penalty |
| **Kick Trigger** | BLS vote OR admin removal |
| **Effect** | Remove from registry, recalculate BLS aggregate key |

### Front-Running Protection
| Status | Details |
|--------|---------|
| Phase 1 | Not implemented (not a concern for ITP batched orders) |
| Future | Commit-reveal if needed |

### Bridge Details
| Aspect | Specification |
|--------|---------------|
| Type | Custom BLS bridge (NOT native Arbitrum bridge) |
| Fast Withdrawals | Via issuer BLS consensus |
| Path | L1 → Arbitrum → L3 → Bitget custody |
| Security | Issuer quorum required for all transfers |

### Gas Token (IND)
| Actor | Gas Policy |
|-------|------------|
| Issuers | Protocol provides IND |
| Users | Pay IND for order submission |
| Keeper | Protocol provides IND |
| AP | Protocol provides IND |

All protocol actors receive sufficient IND allocation. No on-chain tracking of gas spending.

### Front-Running Mitigations
| Mitigation | Details |
|------------|---------|
| L3 Sequencer | Controlled sequencer, no public mempool |
| Batched Execution | Single user can't predict fill price |
| VWAP Pricing | Multiple orders averaged |
| Future (if needed) | Commit-reveal for large orders (>$10k) |

### Monitoring

**Key Metrics:**
- Orders per second (incoming)
- Queue depth
- Average fill time
- Unfilled inventory (should be ~0)
- AP response time
- Issuer consensus time

**Dashboard:**
- Live view of unfilled inventory
- Order queue visualization
- Fill time tracking
- Issuer health status

---

## 19. IMPLEMENTATION PRIORITY

| Priority | Component | Reasoning |
|----------|-----------|-----------|
| **1** | Core Contracts (Index.sol, ITP.sol, Custody.sol) | Foundation |
| **2** | BLS library (Rust + Solidity) | Critical for consensus |
| **3** | Issuer node software (Rust) | Test consensus |
| **4** | Simple test AP (mock Bitget) | Integration testing |
| **5** | Weight/Rebalance logic | Core product |
| **6** | Real AP (Bitget integration) | Mock → real |
| **7** | Keeper service | Can be manual initially |
| **8** | Frontend | Scripts/CLI first |

---

## 20. PROJECT STRUCTURE & LOCAL TESTING

### Folder Structure
```
index/
├── Cargo.toml                  # Rust workspace root (members: common, issuer, ap)
├── contracts/                  # Solidity (Foundry) - includes bridge logic
│   ├── src/                    # Contract source (core/, libraries/, custody/, registry/, interfaces/)
│   ├── test/                   # Foundry tests
│   ├── script/                 # Deploy scripts
│   └── foundry.toml
├── common/                     # Rust - shared crate (BLS, integrations, keys, rate limiting)
│   ├── src/
│   │   ├── bls/               # BN254 BLS signer, verifier, aggregation
│   │   ├── integrations/      # Bitget, 1inch (swap + Fusion+), Jupiter, Squads, on-chain quote
│   │   ├── keys/              # Ed25519 + AES-256-GCM + Argon2id key storage
│   │   └── rate_limit/        # Sliding window rate limiter
│   └── Cargo.toml
├── issuer/                     # Rust - issuer node (consensus, cycle, netting, P2P)
│   ├── src/
│   │   ├── cycle/             # 5-phase cycle manager
│   │   ├── consensus/         # BLS consensus protocol
│   │   ├── netting/           # Netting engine pipeline
│   │   ├── leader/            # Leader election
│   │   ├── p2p/               # TCP + TLS + MessagePack transport
│   │   ├── price/             # Price validation
│   │   ├── state/             # On-chain state reconstruction
│   │   ├── batcher/           # Order batching
│   │   └── slippage/          # Slippage filter & fill allocation
│   └── Cargo.toml
├── ap/                         # Rust - AP/Keeper service
│   ├── src/
│   │   ├── buffer/            # Buffer manager with debt tracking
│   │   ├── queue/             # Priority queue (4 buckets)
│   │   ├── fill/              # Fill execution with retry
│   │   ├── timeout/           # Timeout handler (60s, max 3 retries)
│   │   └── source_failure/    # Source state machine (Active/Paused/Suspended)
│   └── Cargo.toml
└── scripts/                    # CLI tools, deployment, utilities
    └── ...
```

**Design Decisions:**
- **No separate backend** - Issuer nodes ARE the backend (stateless, event-sourced from chain)
- **No separate bridge folder** - Bridge contract lives in `contracts/`, bridge signing logic in `issuer/`
- **Foundry for contracts** - `forge build`, `forge test`, `anvil` for local chain
- **Rust workspace** - `common` crate shared by `issuer` and `ap` for BLS, integrations, keys
- **No frontend/ yet** - CLI scripts first, web UI is later priority

### Local Testing (start.sh)
```bash
#!/bin/bash
# start.sh - Launch full local environment

# 1. Start local Anvil chain
anvil --chain-id 111222333 &

# 2. Deploy contracts
cd contracts && forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545

# 3. Launch issuer nodes (configurable count)
for i in {1..3}; do
  cd ../issuer && cargo run -- --node-id $i --port $((9000 + i)) &
done

# 4. Launch AP with mock Bitget
cd ../ap && cargo run -- --mock-bitget &

# 5. Tail all logs
tail -f logs/*.log
```

**Testing Flow:**
1. `./start.sh` - spins up everything
2. Use CLI scripts or frontend to submit orders
3. Watch issuer consensus + AP execution in logs
4. All nodes restartable independently (stateless design)

---

## 21. OPERATIONS

### Monitoring Thresholds

| Metric | WARNING | CRITICAL | Action |
|--------|---------|----------|--------|
| Orders per second | >100 | >500 | Scale alert |
| Queue depth | >100 | >500 | Pause new orders |
| Average fill time | >30s | >5min | Investigate AP |
| Unfilled inventory delta | >$1000 | >$10000 | Investigate |
| AP response time | >10s | >60s | AP health check |
| Issuer consensus time | >500ms | >2s | Network issue |
| Issuers online | <18/20 | <14/20 | Quorum risk |
| Buffer balance | <$500 | <$100 | Refill buffer |

**UI Panel Required:** Dashboard displaying all metrics in real-time.

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| E001 | ORDER_BELOW_MIN | Order amount below 0.001 USDC minimum |
| E002 | INSUFFICIENT_BALANCE | User doesn't have enough USDC |
| E003 | ITP_PAUSED | This ITP is currently paused |
| E004 | SYSTEM_PAUSED | System is in emergency pause |
| E005 | LIMIT_OUT_OF_BOUNDS | Limit price >50% from current at submission |
| E006 | ITP_NOT_FOUND | Invalid ITP ID |
| E007 | ASSET_DELISTING | Asset in this ITP is being delisted |
| E008 | SOURCE_UNAVAILABLE | Liquidity source offline |
| E009 | ORDER_EXPIRED | Order auto-cancelled after 1h |
| E010 | FILL_INCOMPLETE | Partial fill, remainder refunded |

### Log Specification

**Log Levels:**
- ERROR: Failures requiring attention
- WARN: Unusual conditions, degraded state
- INFO: Normal operations (cycle start, fills)
- DEBUG: Detailed debugging (off in production)

**Retention:**
- ERROR/WARN: 90 days
- INFO: 30 days
- DEBUG: 7 days (if enabled)

**Required Fields (JSON):**
```json
{
  "timestamp": "ISO 8601",
  "level": "INFO|WARN|ERROR|DEBUG",
  "cycle_number": 12345,
  "issuer_id": "0x...",
  "order_id": 67890,
  "itp_id": 42,
  "message": "Order filled",
  "details": {}
}
```

---

## 22. ISSUER CONSENSUS REFERENCE

Consolidated reference for all issuer consensus rules (referenced from Sections 3, 7, 15).

### Consensus Thresholds

| Action | Threshold | Quorum Required | Notes |
|--------|-----------|-----------------|-------|
| Price batch approval | Majority (11/20) | 14/20 online | 20% disagree → cancel round |
| Order batch approval | Majority (11/20) | 14/20 online | - |
| Fill confirmation | Majority (11/20) | 14/20 online | Via Bitget read-only API |
| Emergency system pause | Majority (11/20) | 3 min issuers | Below 3 → auto-pause |
| Per-ITP pause | Majority (11/20) | - | Source offline, suspicious activity |
| Kick issuer | Majority (11/20) | - | Recalculates aggregated BLS key |
| Rebalance approval | Majority (11/20) | - | - |
| Weight update | Majority (11/20) | - | After rebalance complete |
| Asset delisting | Majority (11/20) | - | Triggers forced rebalance |
| ITP creation | Majority (11/20) | - | Cross-chain: creates L3 ITP + Arbitrum BridgedITP |

### Threshold Adjustments

| Active Issuers | Threshold | Notes |
|----------------|-----------|-------|
| 20 | 11/20 (55%) | Standard operation |
| 15-19 | 2/3 majority | Degraded but operational |
| 4-14 | 2/3 majority | High risk, monitor closely |
| 3 | 2/3 (2 of 3) | Minimum viable |
| <3 | N/A | **Emergency pause triggered** |

### Price Disagreement Resolution

| Round | Action |
|-------|--------|
| 1 | Disagreement detected → retry with fresh prices |
| 2 | Still disagree → exclude worst outlier, proceed with 19 |
| 3 | Still disagree → emergency pause, alert admin |

**Tolerance:** Fixed per-asset (e.g., 0.5% stables, 2% BTC/ETH)

---

## 23. VISUAL REFERENCES

### System Overview (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INDEX L3 SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   USERS                    BLOCKCHAIN                  EXTERNAL          │
│   ─────                    ──────────                  ────────          │
│                                                                          │
│   ┌─────────┐         ┌──────────────────┐         ┌─────────────┐      │
│   │  User   │────────>│   Index.sol      │         │   Bitget    │      │
│   │ Wallet  │ orders  │   - Orders       │         │    CEX      │      │
│   └─────────┘         │   - ITPs         │         └──────┬──────┘      │
│                       │   - Prices       │                │              │
│                       │   - Inventory    │                │              │
│                       └────────┬─────────┘                │              │
│                                │                          │              │
│                    ┌───────────┼───────────┐              │              │
│                    │           │           │              │              │
│                    ▼           ▼           ▼              │              │
│            ┌───────────┐ ┌───────────┐ ┌───────────┐     │              │
│            │ Issuer 1  │ │ Issuer 2  │ │ Issuer N  │     │              │
│            │  (Rust)   │ │  (Rust)   │ │  (Rust)   │     │              │
│            └─────┬─────┘ └─────┬─────┘ └─────┬─────┘     │              │
│                  │             │             │            │              │
│                  └──────┬──────┴──────┬──────┘            │              │
│                         │    P2P      │                   │              │
│                         │  TCP+TLS    │ read-only API     │              │
│                         │             └───────────────────┤              │
│                         │                                 │              │
│                    ┌────┴────┐                            │              │
│                    │   AP    │────────────────────────────┘              │
│                    │ (Rust)  │  trades                                   │
│                    └─────────┘                                           │
│                         │                                                │
│                         │ reads events                                   │
│                         ▼                                                │
│                    BLOCKCHAIN                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### BLS Signing Flow (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BLS SIGNATURE FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   LEADER                    ISSUERS                   ON-CHAIN           │
│   ──────                    ───────                   ────────           │
│                                                                          │
│   ┌─────────┐                                                            │
│   │ Create  │                                                            │
│   │ Message │ ─────────────────┐                                         │
│   │ (batch) │                  │                                         │
│   └────┬────┘                  │                                         │
│        │                       ▼                                         │
│        │              ┌─────────────────┐                                │
│        │              │ Broadcast to    │                                │
│        │              │ all issuers     │                                │
│        │              └────────┬────────┘                                │
│        │                       │                                         │
│        │         ┌─────────────┼─────────────┐                           │
│        │         ▼             ▼             ▼                           │
│        │   ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│        │   │ Sign     │  │ Sign     │  │ Sign     │                     │
│        │   │ (BLS)    │  │ (BLS)    │  │ (BLS)    │                     │
│        │   └────┬─────┘  └────┬─────┘  └────┬─────┘                     │
│        │        │             │             │                            │
│        │        └──────┬──────┴──────┬──────┘                            │
│        │               │    sigs     │                                   │
│        │               ▼             │                                   │
│        │        ┌──────────────┐     │                                   │
│        └───────>│  Aggregate   │<────┘                                   │
│                 │  Signatures  │                                         │
│                 └──────┬───────┘                                         │
│                        │                                                 │
│                        ▼                                                 │
│                 ┌──────────────┐      ┌──────────────┐                   │
│                 │   Submit     │─────>│  Verify BLS  │                   │
│                 │   to Chain   │      │  on-chain    │                   │
│                 └──────────────┘      └──────────────┘                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### AP Communication Model (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────┐
│              ISSUER ↔ AP COMMUNICATION (NO DIRECT P2P)                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ISSUERS                  BLOCKCHAIN                    AP              │
│   ───────                  ──────────                    ──              │
│                                                                          │
│   ┌─────────┐                                       ┌─────────┐         │
│   │ Batch   │                                       │ Monitor │         │
│   │ Orders  │                                       │ Events  │         │
│   └────┬────┘                                       └────┬────┘         │
│        │                                                 │               │
│        │ BLS sign                                        │               │
│        ▼                                                 │               │
│   ┌─────────┐     ┌───────────────────────┐             │               │
│   │ Submit  │────>│  TradeRequest Event   │─────────────┤               │
│   │ Batch   │     │  (on-chain)           │             │               │
│   └─────────┘     └───────────────────────┘             │               │
│                                                          │               │
│                                                          ▼               │
│                                                    ┌─────────┐          │
│                   ┌───────────────────────┐        │ Execute │          │
│                   │     Bitget CEX        │<───────│ Trades  │          │
│                   └───────────┬───────────┘        └─────────┘          │
│                               │                                          │
│        ┌──────────────────────┤                                          │
│        │ read-only API        │                                          │
│        ▼                      │                                          │
│   ┌─────────┐                 │                                          │
│   │ Verify  │                 │                                          │
│   │ Fills   │<────────────────┘                                          │
│   └────┬────┘                                                            │
│        │                                                                 │
│        │ BLS sign                                                        │
│        ▼                                                                 │
│   ┌─────────┐     ┌───────────────────────┐                              │
│   │ Confirm │────>│  FillConfirmation     │                              │
│   │ Fills   │     │  (on-chain)           │                              │
│   └─────────┘     └───────────────────────┘                              │
│                                                                          │
│   KEY: Issuers verify fills via Bitget API directly, NOT via AP          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Additional flow diagrams in Appendix A:**
- A1. User Buy Order Flow
- A2. Rebalance Flow

---

## 24. OPEN ITEMS (Future)

- [ ] Threshold BLS for decentralized key management
- [ ] HSM support for production issuers
- [ ] Multiple APs per source (redundancy)
- [ ] Auto-delister for Bitget delistings
- [ ] DAO governance for admin functions
- [ ] Dispute resolution system
- [ ] Public transparency dashboard
- [ ] Commit-reveal for large orders (>$10k)

---

## APPENDIX A: FLOW DIAGRAMS

**Key Design Principle:** AP reads on-chain events. NO direct issuer→AP communication.

### A1. User Buy Order Flow (Corrected)

```
User                     Index.sol                Issuers              AP/Bitget
  │                          │                       │                     │
  │── submitOrder(ITP-A, ───>│                       │                     │
  │   BUY, $1000)            │                       │                     │
  │                          │── lock USDC ─────────>│ (Custody)           │
  │                          │                       │                     │
  │                          │                       │── read pending      │
  │                          │                       │   orders            │
  │                          │                       │── batch + net       │
  │                          │                       │── BLS sign          │
  │                          │                       │                     │
  │                          │<── confirmBatch ──────│                     │
  │                          │    (BLS signed)       │                     │
  │                          │                       │                     │
  │                          │── emit TradeRequest ─────────────────────>│
  │                          │   event               │                     │
  │                          │                       │                     │── AP reads
  │                          │                       │                     │   event
  │                          │                       │                     │── execute
  │                          │                       │                     │   on Bitget
  │                          │                       │                     │
  │                          │                       │── read Bitget       │
  │                          │                       │   fills (view API)  │
  │                          │                       │                     │
  │                          │<── confirmFills ──────│                     │
  │                          │    (BLS signed)       │                     │
  │                          │                       │                     │
  │                          │── mint ITP tokens ───>│ (to user)           │
  │<── OrderFilled ──────────│                       │                     │
```

**Critical Flow Points:**
1. Issuers submit BLS-signed batch → emits `TradeRequest` event
2. AP reads `TradeRequest` events from chain (no direct P2P)
3. AP executes on Bitget
4. Issuers verify fills via Bitget read-only API
5. Issuers submit BLS-signed fill confirmation
6. All state changes go through on-chain BLS-signed transactions

### A2. Rebalance Flow (Corrected)

```
AssetManager             Index.sol                Issuers              AP
     │                       │                       │                   │
     │── proposeRebalance ──>│                       │                   │
     │   (ITP-A: 50/50→40/60)│                       │                   │
     │                       │                       │                   │
     │                       │                       │── validate        │
     │                       │                       │── queue           │
     │                       │                       │                   │
     │── signalExecute ─────>│                       │                   │
     │                       │                       │                   │
     │                       │                       │── net all deltas  │
     │                       │                       │── check depth     │
     │                       │                       │   (leader only,   │
     │                       │                       │    not on-chain)  │
     │                       │                       │── BLS approve     │
     │                       │                       │                   │
     │                       │<── confirmBatch ──────│                   │
     │                       │    (BLS signed)       │                   │
     │                       │                       │                   │
     │                       │── emit TradeRequest ───────────────────>│
     │                       │                       │                   │── AP reads
     │                       │                       │                   │   event
     │                       │                       │                   │── execute
     │                       │                       │                   │   patches
     │                       │                       │                   │
     │                       │                       │── read fills ────>│ (view API)
     │                       │                       │                   │
     │                       │<── confirmFills ──────│                   │
     │                       │    (BLS signed)       │                   │
     │                       │                       │                   │
     │                       │<── updateWeights ─────│                   │
     │                       │    (BLS signed)       │                   │
     │<── RebalanceComplete ─│                       │                   │
```

**Orderbook Depth Handling:**
- Leader includes depth for decision-making (patch sizing)
- NOT stored on-chain
- Issuers verify fill prices match expectations

---

## APPENDIX B: DATA STRUCTURES

### Design Decision: uint256 for All Values

**Rationale:** Use `uint256` universally for simplicity and safety.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| All numeric storage | `uint256` | EVM native word size, no casting overhead |
| Prices | `uint256` | 18 decimals standard, no overflow risk |
| Amounts | `uint256` | Handles any token amount |
| Indices | `uint256` | Future-proof, no artificial limits |
| Timestamps | `uint256` | Consistent with `block.timestamp` |

**Why NOT pack smaller types:**
- Gas savings from packing are marginal on L3 (cheap gas)
- Casting between types adds complexity and bug surface
- Solidity 0.8+ overflow checks work best with uint256
- Simpler code = fewer bugs = safer protocol

### Index.sol Storage Layout

```solidity
contract Index {
    // ============ GLOBAL ASSET REGISTRY ============
    // Shared across all ITPs - single source of truth

    address[] public assets;                            // Global asset list
    mapping(address => uint256) public assetIndex;      // asset => index in array
    uint256 public assetCount;

    mapping(uint256 => uint256) public prices;          // assetIndex => price (18 decimals)
    uint256 public pricesBlock;                         // Last update block

    // ============ ITP STORAGE ============

    struct ITPCore {
        address creator;
        uint256 createdAt;
        uint256 feeRate;          // Basis points (10000 = 100%)
        uint256 status;           // 0=inactive, 1=active, 2=paused, 3=delisting
        uint256 totalSupply;
        uint256 totalValue;       // Cached NAV * supply
        uint256 assetCount;
    }

    mapping(uint256 => ITPCore) public itps;            // itpId => core data
    uint256 public nextItpId;

    // Per-ITP arrays (sparse - only assets this ITP holds)
    mapping(uint256 => uint256[]) internal _itpAssetIndices;
    mapping(uint256 => uint256[]) internal _itpWeights;      // 18 decimals, sum = 1e18
    mapping(uint256 => uint256[]) internal _itpInventory;    // Actual quantities

    // ============ REBALANCE TRACKING ============

    struct PendingRebalance {
        uint256[] targetWeights;
        uint256 startedAt;
        bool active;
    }
    mapping(uint256 => PendingRebalance) public pendingRebalances;

    // ============ ORDER STORAGE ============

    struct Order {
        address user;
        uint256 timestamp;
        uint256 orderType;        // 0=BUY_LIMIT, 1=SELL_LIMIT
        uint256 status;           // 0=PENDING, 1=FILLED
        uint256 itpId;
        uint256 amount;           // USDC amount (18 decimals)
        uint256 limitPrice;       // 0 for market orders
    }

    mapping(uint256 => Order) public orders;
    uint256 public nextOrderId;
    uint256 public lastProcessedOrderId;

    // ============ GLOBAL INVENTORY TRACKING ============

    mapping(address => uint256) public globalTarget;    // Sum of all ITP targets
    mapping(address => uint256) public globalActual;    // Actual custody balance

    // ============ MIN BUY CONFIGURATION ============

    mapping(address => uint256) public minBuyAmount;    // asset => min USDC value

    // ============ CYCLE TRACKING ============

    uint256 public currentCycle;
    uint256 public lastCycleTimestamp;

    // ============ ACCESSORS ============

    function getPrice(uint256 assetIdx) public view returns (uint256) {
        return prices[assetIdx];
    }

    function batchGetPrices(uint256[] calldata indices)
        external view returns (uint256[] memory)
    {
        uint256[] memory result = new uint256[](indices.length);
        for (uint256 i = 0; i < indices.length; i++) {
            result[i] = prices[indices[i]];
        }
        return result;
    }

    function getITPState(uint256 itpId) external view returns (
        address creator,
        uint256 totalSupply,
        uint256 nav,
        uint256[] memory assetIndices,
        uint256[] memory weights,
        uint256[] memory inventory
    ) {
        ITPCore storage core = itps[itpId];
        return (
            core.creator,
            core.totalSupply,
            core.totalSupply > 0 ? core.totalValue / core.totalSupply : 1e18,
            _itpAssetIndices[itpId],
            _itpWeights[itpId],
            _itpInventory[itpId]
        );
    }

    function getPendingRebalance(uint256 itpId) external view returns (
        bool active,
        uint256[] memory targetWeights,
        uint256 startedAt
    ) {
        PendingRebalance storage pr = pendingRebalances[itpId];
        return (pr.active, pr.targetWeights, pr.startedAt);
    }
}
```

### ITP.sol (ERC4626 Wrapper)

```solidity
contract ITP is ERC4626 {
    uint256 public immutable itpId;
    IIndex public immutable index;

    // All state is in Index.sol
    // ITP.sol is a thin ERC4626 facade

    function totalAssets() public view override returns (uint256) {
        // Query Index.sol for computed value
        (,, uint256 nav,,,) = index.getITPState(itpId);
        return nav * totalSupply();
    }

    // mint/burn only callable by Index.sol
    function mint(address to, uint256 shares) external onlyIndex {
        _mint(to, shares);
    }

    function burn(address from, uint256 shares) external onlyIndex {
        _burn(from, shares);
    }
}
```

### Gas Estimates (Hybrid vs Naive)

| Operation | Naive | Hybrid | Savings |
|-----------|-------|--------|---------|
| Create ITP (10 assets) | ~200k | ~80k | 60% |
| Read ITP state | ~25k | ~8k | 68% |
| Update prices (10) | ~50k | ~15k | 70% |
| Process order | ~50k | ~12k | 76% |
| Batch 50 orders | ~2.5M | ~300k | 88% |

### Transient Storage (EIP-1153) for Batch Processing

```solidity
// Used during processCycle - auto-cleared after tx
// ~100 gas vs ~20,000 gas for regular storage

function processCycle(bytes calldata blsSignedData) external {
    // 1. Load prices to transient (single read from storage)
    // 2. Process all orders (reads/writes to transient = cheap)
    // 3. Commit final state (single storage write)
}
```

---

## APPENDIX C: PARTIAL FILL HANDLING

When an order is interrupted mid-fill across multiple assets:

**Algorithm: Stop at Minimum Fill % to Match ITP Weights**
```
Given: ITP with BTC (40%), ETH (40%), SOL (20%)
User deposits $1000

Fill execution progress:
  BTC: 100% filled ($400 target → $400 acquired)
  ETH: 50% filled ($400 target → $200 acquired)
  SOL: 0% filled ($200 target → $0 acquired)

Calculation:
  1. Find fill percentage for each asset:
     BTC: 400/400 = 100%
     ETH: 200/400 = 50%
     SOL: 0/200 = 0%

  2. Find minimum non-zero fill percentage: min(100%, 50%) = 50%
     (Skip 0% assets - they haven't started)

  3. Stop at 50% level to maintain weight ratios

  4. Calculate what user gets at 50% fill:
     BTC: 50% × $400 = $200 (sell back excess $200)
     ETH: 50% × $400 = $200 (already at this level)
     SOL: 50% × $200 = $100 (still need to fill)

  5. If SOL cannot be filled:
     → Reduce to next lowest common %
     → Continue until weights match

Result:
  - User gets ITP worth $500 (50% of $1000)
  - Weights match ITP target ratios: 40%/40%/20%
  - Remaining $500 refunded
  - Excess acquired assets sold back

Rule: Fill until acquired assets match ITP weight ratios exactly.
Never mint ITP with mismatched weights.
```

**Key Principle:** The ITP shares minted must always represent assets in the correct weight proportions. Stop at whatever fill level allows weight matching.

**Loss Allocation:** User always bears losses from partial fills. Never subsidize from global pool.

---

## APPENDIX D: ISSUER STATE RECONSTRUCTION

When an issuer boots (fresh start or reboot), it reconstructs full state from on-chain data.

### Required On-Chain Data

| Data | Contract | Method |
|------|----------|--------|
| Current cycle | Index.sol | `currentCycle()` |
| Next order ID | Index.sol | `nextOrderId()` |
| Last processed order | Index.sol | `lastProcessedOrderId()` |
| Asset prices | Index.sol | `getPrice(assetIdx)` |
| Asset count | Index.sol | `assetCount()` |
| ITP count | Index.sol | `nextItpId()` |
| ITP state | Index.sol | `getITPState(itpId)` |
| Pending rebalance | Index.sol | `getPendingRebalance(itpId)` |
| Order details | Index.sol | `orders(orderId)` |
| Issuer registry | Governance.sol | `getIssuers()` |
| **Collateral per ITP per chain** | CollateralRegistry.sol | `itpCollateralByChain(itpId, chainId)` |
| **Chain inventory** | BLSCustody (per chain) | `usdc.balanceOf(custody)` |

### Reconstruction Algorithm (Rust)

```rust
use ethers::types::U256;

struct IssuerState {
    pending_orders: Vec<LimitOrder>,
    itps: HashMap<U256, ITPState>,
    current_cycle: U256,
    prices: HashMap<U256, U256>,  // asset_index => price (18 decimals)
    // Multi-chain state
    chain_inventories: HashMap<U256, U256>,  // chainId => USDC balance
    collateral_by_chain: HashMap<(Bytes32, U256), U256>,  // (itpId, chainId) => amount
}

struct ITPState {
    current_weights: Vec<U256>,      // 18 decimals, sum = 1e18
    current_inventory: Vec<U256>,
    target_weights: Option<Vec<U256>>,
    rebalance_progress: f64,         // 0.0 to 1.0
    // Cross-chain collateral
    collateral_by_chain: HashMap<U256, U256>,  // chainId => USDC value
}

fn reconstruct_state(rpc: &RpcClient) -> IssuerState {
    // STEP 1: Read global state
    let current_cycle: U256 = rpc.call("currentCycle", []);
    let next_order_id: U256 = rpc.call("nextOrderId", []);
    let last_processed: U256 = rpc.call("lastProcessedOrderId", []);

    // STEP 2: Read all prices
    let asset_count: U256 = rpc.call("assetCount", []);
    let mut prices = HashMap::new();
    let mut i = U256::zero();
    while i < asset_count {
        prices.insert(i, rpc.call("getPrice", [i]));
        i += U256::one();
    }

    // STEP 3: Read pending orders
    let mut pending_orders = Vec::new();
    let mut order_id = last_processed + U256::one();
    while order_id < next_order_id {
        let order = rpc.call("orders", [order_id]);
        if order.status == U256::zero() {  // PENDING = 0
            pending_orders.push(order);
        }
        order_id += U256::one();
    }

    // STEP 4: Read all ITPs and compute rebalance progress
    let next_itp_id: U256 = rpc.call("nextItpId", []);
    let mut itps = HashMap::new();

    let mut itp_id = U256::zero();
    while itp_id < next_itp_id {
        let itp_state = reconstruct_itp(rpc, itp_id, &prices);
        itps.insert(itp_id, itp_state);
        itp_id += U256::one();
    }

    IssuerState { pending_orders, itps, current_cycle, prices }
}

fn reconstruct_itp(rpc: &RpcClient, itp_id: U256, prices: &HashMap<U256, U256>) -> ITPState {
    // Read current state
    let (_, _, _, asset_indices, weights, inventory): (
        Address, U256, U256, Vec<U256>, Vec<U256>, Vec<U256>
    ) = rpc.call("getITPState", [itp_id]);

    // Read pending rebalance
    let (active, target_weights, _): (bool, Vec<U256>, U256) =
        rpc.call("getPendingRebalance", [itp_id]);

    if !active {
        return ITPState {
            current_weights: weights,
            current_inventory: inventory,
            target_weights: None,
            rebalance_progress: 1.0,
        };
    }

    // COMPUTE REBALANCE PROGRESS from inventory
    let total_value: U256 = asset_indices.iter()
        .zip(inventory.iter())
        .map(|(idx, qty)| *qty * prices[idx])
        .fold(U256::zero(), |acc, x| acc + x);

    let mut progress_sum = 0.0;
    let mut weight_sum = 0.0;
    let one_e18 = 1e18_f64;

    for i in 0..asset_indices.len() {
        let current_alloc = (inventory[i] * prices[&asset_indices[i]]).as_u128() as f64
                           / total_value.as_u128() as f64;
        let start_alloc = weights[i].as_u128() as f64 / one_e18;
        let target_alloc = target_weights[i].as_u128() as f64 / one_e18;

        if (target_alloc - start_alloc).abs() < 0.0001 { continue; }

        let progress = if target_alloc > start_alloc {
            ((current_alloc - start_alloc) / (target_alloc - start_alloc))
                .clamp(0.0, 1.0)
        } else {
            ((start_alloc - current_alloc) / (start_alloc - target_alloc))
                .clamp(0.0, 1.0)
        };

        let change_magnitude = (target_alloc - start_alloc).abs();
        progress_sum += progress * change_magnitude;
        weight_sum += change_magnitude;
    }

    ITPState {
        current_weights: weights,
        current_inventory: inventory,
        target_weights: Some(target_weights),
        rebalance_progress: if weight_sum > 0.0 { progress_sum / weight_sum } else { 1.0 },
    }
}
```

### New Issuer Join Flow

```
1. Admin adds issuer to Governance.sol (address, IP, BLS pubkey)
2. On-chain: aggregated BLS pubkey updated via ecAdd
3. New issuer runs reconstruct_state()
4. New issuer connects to peer issuers via TCP
5. New issuer observes 1 full cycle (don't sign)
6. New issuer starts participating in cycle N+2
```

### Key Points

- **Rebalance progress is computed, not stored** - derived from inventory vs target weights
- **No historical data needed** - current on-chain state is sufficient
- **Observation period** - 1 cycle before participating (safety margin)
- **BLS key** - loaded from local .env file
- **Multi-chain state** - read CollateralRegistry for collateral per ITP per chain
- **Chain inventories** - query USDC balance on each custody contract

---

## APPENDIX E: CROSS-CHAIN EXECUTION EXAMPLES

### Example 1: Buy ITP with Solana Memecoin

User wants to buy $1000 of "Degen Index" ITP which contains 20% BONK (Solana).

```
CYCLE N:
─────────
1. User submits LimitOrder: BUY $1000 Degen Index, slippageTier=2 (3%)

2. Issuers calculate component trades:
   - $200 BTC (Bitget) - CEX pair
   - $300 ETH (1inch-Arb) - DEX pair
   - $300 AAVE (1inch-Eth) - DEX pair
   - $200 BONK (1inch-Sol) - Solana pair

3. Netting engine (assume no other orders):
   - Pair netting: No netting (single order)
   - Check Arbitrum inventory: $50k available ✓
   - Check liquidity: All pairs liquid at $200-300

4. Routing decisions:
   - BTC → AP places limit order on Bitget
   - ETH → Use Arb inventory, BLS-sign 1inch swap
   - AAVE → Use Arb inventory, BLS-sign 1inch Fusion+ to Eth
   - BONK → Use Arb inventory, BLS-sign 1inch Fusion+ to Solana

5. Inventory consumed:
   - Arbitrum inventory: -$800 USDC (ETH + AAVE + BONK all used Arb inventory)
   - If inventory was insufficient, bridge from L3 would be queued first

6. Execute:
   - Emit TradeRequest for BTC
   - BLS-sign and submit 1inch swap for ETH on Arbitrum
   - BLS-sign and submit Fusion+ for AAVE (Arb → Eth)
   - BLS-sign and submit Fusion+ for BONK (Arb → Sol)

CYCLE N+1:
──────────
7. Verify fills:
   - BTC: Bitget API confirms fill at $99,500 (within limit)
   - ETH: On-chain swap event shows $3,280/ETH (within limit)
   - AAVE: Fusion+ settlement confirms 1.2 AAVE received
   - BONK: Fusion+ settlement confirms 8M BONK received

8. Update CollateralRegistry:
   - emit CollateralMoved(itpId, 0, SOLANA_CHAIN, $200, "BUY")
   - emit CollateralMoved(itpId, 0, ETH_CHAIN, $300, "BUY")
   - emit CollateralMoved(itpId, 0, ARB_CHAIN, $300, "BUY") // ETH held on Arb
   - BTC tracked differently (CEX custody)

9. Mint ITP:
   - User receives 1000 Degen Index tokens
   - Fees deducted: $1.50 (bridge estimate) → $998.50 effective
```

### Example 2: Sell ITP Back to USDC

User sells $5000 of Degen Index.

```
CYCLE N:
─────────
1. User submits LimitOrder: SELL $5000 Degen Index, slippageTier=1 (1%)

2. Issuers calculate component trades (reverse weights):
   - Sell $1000 BTC worth
   - Sell $1500 ETH worth
   - Sell $1500 AAVE worth
   - Sell $1000 BONK worth

3. Check inventory needs:
   - BTC: AP sells on Bitget → USDC to CEX custody
   - ETH: Already on Arbitrum (bought there), swap to USDC
   - AAVE: On Ethereum, need to convert
   - BONK: On Solana, need to convert

4. Routing:
   - BTC → AP limit sell on Bitget
   - ETH → BLS-sign 1inch swap on Arbitrum
   - AAVE → BLS-sign 1inch Fusion+ (Eth AAVE → Arb USDC)
   - BONK → BLS-sign Squads Jupiter swap (BONK → USDC)

5. Execution:
   - All swaps return USDC
   - USDC accumulates on each chain's custody

6. Inventory update:
   - Arbitrum inventory: +$3000 USDC (ETH + AAVE proceeds)
   - Solana inventory: +$1000 USDC (BONK proceeds)
   - Bitget custody: +$1000 USDC (BTC proceeds)

7. Inventory rebalance check:
   - Arbitrum now has $3k more than needed
   - If total Arb inventory > $60k, queue background bridge to L3

CYCLE N+1:
──────────
8. Confirm all sells, burn ITP, release $5000 USDC to user
```

### Example 3: Netting Across ITPs

Two users in same cycle:
- User A: BUY $10k "BTC Max" ITP (100% BTC)
- User B: SELL $3k "Crypto Blend" ITP (40% BTC)

```
CYCLE N:
─────────
1. Collect orders:
   - User A needs: +$10k BTC
   - User B sells: -$1.2k BTC (40% of $3k)

2. Pair netting:
   - Bitget.BTCUSDC: $10k - $1.2k = NET $8.8k BTC buy
   - Internal match: $1.2k BTC transfers from User B to User A

3. Execution:
   - ONE limit order to Bitget for $8.8k BTC
   - Internal: Move $1.2k worth from "Crypto Blend" inventory to "BTC Max"

4. Savings:
   - Without netting: $10k buy + $1.2k sell = $11.2k volume
   - With netting: $8.8k buy only = 21% reduction
   - Both users get better price (less market impact)
```

### Example 4: Slippage Tier Filtering

Three users want to buy BONK in same cycle:
- User A: $5k BONK, slippageTier=0 (0.3%)
- User B: $5k BONK, slippageTier=1 (1%)
- User C: $5k BONK, slippageTier=2 (3%)

```
CYCLE N:
─────────
1. Merged order: $15k BONK

2. Query 1inch for spread at execution amounts:
   - $3.75k (25%): 0.2% spread
   - $7.5k (50%): 0.8% spread
   - $11.25k (75%): 1.8% spread
   - $15k (100%): 3.5% spread

3. Slippage tier filtering:
   - Tier 0 (0.3%): Only $3.75k qualifies
   - Tier 1 (1%): Only $7.5k qualifies
   - Tier 2 (3%): Only $11.25k qualifies (not 100% due to 3.5%)

4. Decision:
   - Execute $10k at 1.8% spread (User B + User C only)
   - Include: User B ($5k) + User C ($5k)
   - Defer: User A entirely ($5k) - spread 1.8% exceeds tier 0 limit (0.3%)

5. Allocation:
   - User A: Entire $5k queued for next cycle (tier 0 excluded)
   - User B: Gets full $5k BONK at 1.8% slippage
   - User C: Gets full $5k BONK at 1.8% slippage

CYCLE N+1:
──────────
6. User A's remaining $3.75k:
   - Check spread again
   - If spread now 0.25% → execute
   - If spread still high → queue again
```

---

*Document generated: 2026-01-28, updated 2026-01-30*
*Version: 2.0 - Architecture compliance audit: synced spec with actual code structure, naming, and types*
*Status: Ready for implementation*
