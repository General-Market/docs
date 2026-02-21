# Solidity Merger Plan: Investment (from Index)

> **Target file:** `contracts/src/core/Investment.sol` (renamed from Index.sol)

**Goal:** Rename and consolidate the Index Solidity stack under the name "Investment" as part of the AA + Index merger. This covers the ETF/ITP order system, NAV pricing, batch fills, and all supporting infrastructure.

---

## Current State (Index Stack)

### Core Contracts (keep all, rename root)
| Current File | New Name | Action |
|---|---|---|
| `src/core/Index.sol` | `src/core/Investment.sol` | **Rename contract + all refs** |
| `src/core/IndexStorage.sol` | `src/core/InvestmentStorage.sol` | **Rename** |
| `src/core/ITP.sol` | `src/core/ITP.sol` | Keep as-is (ITP = Index Token Product stays) |
| `src/core/BLSCustody.sol` | `src/core/BLSCustody.sol` | Keep as-is |

### Registry Contracts (keep all, no rename)
| File | Action |
|---|---|
| `src/registry/IssuerRegistry.sol` | Keep - shared with Vision |
| `src/registry/MirrorIssuerRegistry.sol` | Keep - shared with Vision |
| `src/registry/CollateralRegistry.sol` | Keep - Investment-specific |
| `src/registry/FeeRegistry.sol` | Keep - Investment-specific |
| `src/registry/AssetPairRegistry.sol` | Keep - Investment-specific |

### Bridge Contracts (keep all, no rename)
| File | Action |
|---|---|
| `src/bridge/BridgeProxy.sol` | Keep |
| `src/bridge/BridgedITP.sol` | Keep |
| `src/bridge/BridgedItpFactory.sol` | Keep |

### Custody Contracts (keep all, no rename)
| File | Action |
|---|---|
| `src/custody/L3BridgeCustody.sol` | Keep |
| `src/custody/ArbBridgeCustody.sol` | Keep |

### Governance & Oracle (keep all)
| File | Action |
|---|---|
| `src/Governance.sol` | Keep - extends to cover Vision too |
| `src/oracle/ITPNAVOracle.sol` | Keep |
| `src/irm/CuratorRateIRM.sol` | Keep |

### Libraries (keep all, update refs)
| File | Action |
|---|---|
| `src/libraries/TypesLib.sol` | **Extend** - add Vision types |
| `src/libraries/BLSLib.sol` | Keep - shared |
| `src/libraries/BLSVerifier.sol` | Keep - shared |
| `src/libraries/DecimalLib.sol` | Keep - shared |
| `src/libraries/RebalanceLib.sol` | Keep - Investment-specific |
| `src/libraries/ErrorsLib.sol` | **Extend** - add Vision error codes |
| `src/libraries/EventsLib.sol` | **Extend** - add Vision events |
| `src/libraries/AdminLib.sol` | Keep |

### Interfaces (rename + extend)
| Current | New | Action |
|---|---|---|
| `src/interfaces/IIndex.sol` | `src/interfaces/IInvestment.sol` | **Rename** |
| All others | Keep | No change |

---

## Rename Tasks

### Task 1: Rename Index.sol -> Investment.sol

**Files to modify:**
- `src/core/Index.sol` -> `src/core/Investment.sol`
  - `contract Index is ...` -> `contract Investment is ...`
  - All internal references

- `src/core/IndexStorage.sol` -> `src/core/InvestmentStorage.sol`
  - `abstract contract IndexStorage` -> `abstract contract InvestmentStorage`

- `src/interfaces/IIndex.sol` -> `src/interfaces/IInvestment.sol`
  - `interface IIndex` -> `interface IInvestment`

**Ripple changes (all files importing Index):**
- `src/core/ITP.sol` - reads `indexContract` immutable (keep variable name for ERC4626 compatibility, just update import)
- `src/bridge/BridgeProxy.sol` - references Index contract
- `src/custody/ArbBridgeCustody.sol` - references `l3Index`
- `src/oracle/ITPNAVOracle.sol` - references Index for NAV
- All test files importing Index
- All deploy scripts referencing Index

### Task 2: Update TypesLib.sol for unified types

Add to `TypesLib.sol`:
```solidity
// ===== Vision (AA) Types =====
enum BetStatus { None, Active, InArbitration, Settled, CustomPayout }

struct Bet {
    bytes32 tradesRoot;
    address creator;
    address filler;
    uint256 creatorAmount;
    uint256 fillerAmount;
    uint256 deadline;
    BetStatus status;
}

struct Keeper {
    address addr;
    bytes32 ip;
    bytes blsPubkey;
    KeeperStatus status;
    uint256 registeredAt;
    uint256 stakedAmount;
}

enum KeeperStatus { Inactive, Active, Suspended }
```

### Task 3: Extend ErrorsLib.sol

Add Vision-specific error codes (E100+ range to avoid collision with Investment E001-E095):
```solidity
// ===== Vision Errors (E100+) =====
error E100_InsufficientCollateral();
error E101_BetAlreadyActive();
error E102_InvalidSignature();
error E103_ArbitrationNotRequested();
error E104_DeadlineNotPassed();
error E105_InvalidKeeperStake();
error E106_KeeperAlreadyRegistered();
error E107_KeeperSuspended();
error E108_InvalidBLSPubkey();
error E109_RotationNotPending();
error E110_ThresholdNotMet();
```

### Task 4: Extend EventsLib.sol

Add Vision-specific events:
```solidity
// ===== Vision Events =====
event BetCommitted(bytes32 indexed betId, address indexed creator, address indexed filler);
event BetSettled(bytes32 indexed betId, address winner, uint256 amount);
event ArbitrationRequested(bytes32 indexed betId, address requester);
event KeeperRegistered(address indexed keeper, bytes32 ip);
event KeeperSuspended(address indexed keeper);
event BotRegistered(address indexed bot, string endpoint);
event BotDeregistered(address indexed bot);
```

---

## Shared Infrastructure (used by both Investment + Vision)

These contracts become the **shared layer** for the unified protocol:

| Contract | Used By |
|---|---|
| `BLSLib.sol` | Both - BLS verification is universal |
| `BLSVerifier.sol` | Both - mixin for all BLS-verifying contracts |
| `IssuerRegistry.sol` | Both - issuer management shared |
| `MirrorIssuerRegistry.sol` | Both - cross-chain registry shared |
| `Governance.sol` | Both - system pause/unpause shared |
| `DecimalLib.sol` | Both - decimal handling shared |

---

## Storage Compatibility

**No backward compatibility concern** (per CLAUDE.md). The rename from `Index` to `Investment` is a breaking change to the ABI and deployment, requiring full redeployment.

**UUPS upgrade path:** Not applicable - this is a fresh deployment with the merged contract set. The storage layout in `InvestmentStorage.sol` remains unchanged (just renamed).

---

## Test Plan

1. Rename all test files importing `Index` to import `Investment`
2. Update `TestHelper.sol` and `BLSTestHelper.sol` to deploy `Investment` instead of `Index`
3. Run full test suite: `forge test`
4. All 1304 passing tests should continue passing (MockBitgetVault failures are pre-existing)

---

## Deploy Script Updates

- `script/Deploy.s.sol` -> deploy `Investment` instead of `Index`
- `scripts/deploy/DeployL3.s.sol` -> same
- All E2E deploy scripts -> update contract name

---

## Estimated Scope

- **Renames:** 3 core files + 1 interface
- **Extends:** 3 library files (TypesLib, ErrorsLib, EventsLib)
- **Ripple updates:** ~60 files (tests, scripts, imports)
- **New code:** 0 (all Investment logic is existing Index logic)
