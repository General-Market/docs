# Solidity Merger Plan: Vision (from AA/AgiArena)

> **Target directory:** `contracts/src/vision/` (new, from AA bilateral contracts)

**Goal:** Import AA's bilateral P2P trading contracts into the Index monorepo under the name "Vision". These contracts handle bilateral bets, keeper arbitration, bot discovery, and referral rewards - all using WIND as collateral on the same L3 chain.

---

## Current State (AA Stack)

### Source Contracts to Import
| AA File | New Location | Action |
|---|---|---|
| `src/bilateral/CollateralVault.sol` | `src/vision/CollateralVault.sol` | **Import + adapt** |
| `src/bilateral/BotRegistry.sol` | `src/vision/BotRegistry.sol` | **Import + adapt** |
| `src/bilateral/KeeperRegistry.sol` | `src/vision/KeeperRegistry.sol` | **Import + adapt** |
| `src/bilateral/ReferralVault.sol` | `src/vision/ReferralVault.sol` | **Import + adapt** |

### Libraries to Merge (not duplicate)
| AA File | Action |
|---|---|
| `src/libraries/BLSLib.sol` | **DROP** - Index already has a superset (`BLSLib.sol` + `BLSVerifier.sol`) |
| `src/libraries/BLS.sol` | **DROP** - Alternate impl, not needed |
| `src/libraries/BettingLib.sol` | `src/libraries/BettingLib.sol` - **Import** (new, Vision-specific) |
| `src/libraries/MerkleProof.sol` | `src/libraries/VisionMerkleProof.sol` - **Import + rename** (avoid OZ collision) |

### Mocks
| AA File | Action |
|---|---|
| `src/mocks/WIND.sol` | **DROP** - Already deployed at `0x4e5b65FB12d4165E22f5861D97A33BA45c006114` |
| `src/mocks/MockERC20.sol` | **DROP** - Index already has one |

### Legacy (DO NOT import)
| AA File | Action |
|---|---|
| `src/dao/ResolutionDAO.sol` | **DROP** - Deprecated, replaced by KeeperRegistry |

---

## Adaptation Tasks

### Task 1: Create `src/vision/` directory structure

```
contracts/src/vision/
├── CollateralVault.sol     # Bilateral P2P custody + settlement
├── BotRegistry.sol         # Bot peer discovery
├── KeeperRegistry.sol      # Keeper governance + BLS key rotation
└── ReferralVault.sol       # Merkle-based referral rewards
```

### Task 2: Adapt CollateralVault.sol

**Key changes from AA -> Index merged stack:**

1. **BLS library switch**: Replace AA's `BLSLib` import with Index's `BLSVerifier` mixin
   ```solidity
   // AA (before):
   import {BLSLib} from "../libraries/BLSLib.sol";
   // ...
   BLSLib.verifyBLS(...)

   // Index merged (after):
   import {BLSVerifier} from "../libraries/BLSVerifier.sol";
   contract CollateralVault is BLSVerifier, ReentrancyGuard {
       // Uses _verifyBLS() from mixin
   ```

2. **IssuerRegistry integration**: Instead of standalone keeper BLS verification, use the shared `IssuerRegistry` for aggregated pubkey reads
   ```solidity
   // Add constructor param:
   IIssuerRegistry public immutable issuerRegistry;
   ```

3. **Error codes**: Replace inline revert strings with `ErrorsLib` codes (E100+ range)

4. **Events**: Replace inline events with `EventsLib` references

5. **Types**: Move `Bet`, `BetStatus` structs to `TypesLib.sol`

6. **Collateral token**: Change from generic `IERC20` to explicit WIND token address (same as BotRegistry/KeeperRegistry)

### Task 3: Adapt BotRegistry.sol

**Key changes:**

1. **Stake amount fix**: Tests show `MIN_STAKE` mismatch (1e18 vs 1e20). Verify contract uses correct value and align tests.

2. **Import paths**: Update OZ imports to match Index's remapping:
   ```solidity
   // AA: import "@openzeppelin/contracts/..."
   // Index: same, but verify foundry.toml remapping
   ```

3. **Error codes**: Replace inline reverts with ErrorsLib E-codes

### Task 4: Adapt KeeperRegistry.sol

**Key changes:**

1. **BLS pubkey format**: AA uses 128-byte G2 pubkeys. Index's `BLSVerifier` also uses G2. Verify compatibility.
   - AA: `bytes blsPubkey` (128 bytes, validated in contract)
   - Index: `bytes` (128 bytes for G2 in `IssuerRegistry`)
   - **Compatible** - same BN254 curve, same encoding

2. **Key rotation**: AA has its own rotation (2-of-3 threshold). Index has `IssuerRegistry` with more sophisticated rotation (timelock + approval).
   - **Decision needed**: Keep KeeperRegistry's own rotation for Vision keepers (separate set from Investment issuers) OR unify into IssuerRegistry.
   - **Recommendation**: Keep separate. Keepers (2-of-3, lightweight) serve a different role than Issuers (11/20, heavy consensus). KeeperRegistry manages Vision-specific keeper set.

3. **InvalidPubkey test failures**: Contract likely changed pubkey validation (now requires 128 bytes). Tests still send 64-byte dummy keys. Fix test fixtures.

4. **Error codes**: Migrate to ErrorsLib

### Task 5: Adapt ReferralVault.sol

**Minimal changes needed:**
1. Update import paths
2. Move to ErrorsLib error codes
3. No BLS dependency - simple Merkle + admin pattern

### Task 6: Import BettingLib.sol

**Copy as-is** to `src/libraries/BettingLib.sol`. Pure utility, no external dependencies except keccak256.

### Task 7: Import & Rename MerkleProof.sol

**Copy** to `src/libraries/VisionMerkleProof.sol`:
- Rename to avoid collision with OpenZeppelin's `MerkleProof`
- Contains Vision-specific `Trade` struct and resolution logic
- `resolveTradeOutcome()` for price/binary/drop/pump methods

---

## BLS Unification Strategy

The two stacks have different BLS models:

| Aspect | Investment (Index) | Vision (AA) |
|---|---|---|
| **Signer set** | 20 Issuers | 3 Keepers |
| **Threshold** | 11/20 (standard), 15/20 (emergency) | 2/3 (majority) |
| **Key storage** | IssuerRegistry (aggregated G2) | KeeperRegistry (individual G2) |
| **Verification** | BLSVerifier mixin | Inline BLSLib calls |
| **Curve** | BN254 (alt_bn128) | BN254 (alt_bn128) - **SAME** |

**Unification plan:**
1. **Share `BLSLib.sol`** - Same curve, same precompiles, one implementation
2. **Share `BLSVerifier.sol` mixin** - Vision contracts inherit it
3. **Keep registries separate** - `IssuerRegistry` for Investment, `KeeperRegistry` for Vision
4. CollateralVault reads keeper pubkeys from `KeeperRegistry` (not IssuerRegistry)
5. Both registries live on L3, both use the same BLS library

---

## Interface Contracts

### New Interfaces to Create
| File | Purpose |
|---|---|
| `src/interfaces/ICollateralVault.sol` | Vision vault interface |
| `src/interfaces/IBotRegistry.sol` | Bot discovery interface |
| `src/interfaces/IKeeperRegistry.sol` | Keeper governance interface |
| `src/interfaces/IReferralVault.sol` | Referral rewards interface |

---

## Governance Integration

Extend `Governance.sol` to cover Vision:
```solidity
// Add to Governance.sol:
mapping(address => bool) private _visionPaused;  // per-contract pause

function pauseVisionContract(address target) external onlyAdmin { ... }
function unpauseVisionContract(address target) external onlyAdmin { ... }
```

---

## Foundry Configuration

Update `foundry.toml` to match:
```toml
# Both stacks use Solidity 0.8.24 (Index)
# AA uses 0.8.20 - bump to 0.8.24 for consistency
solc = "0.8.24"
```

No new remappings needed - Vision contracts use the same OZ and forge-std dependencies.

---

## Test Migration

### Import from AA (adapt paths + fixtures)
| AA Test | New Location |
|---|---|
| `tests/bilateral/CollateralVault.t.sol` | `test/vision/CollateralVault.t.sol` |
| `tests/bilateral/BotRegistry.t.sol` | `test/vision/BotRegistry.t.sol` |
| `tests/bilateral/KeeperRegistry.t.sol` | `test/vision/KeeperRegistry.t.sol` |
| `tests/bilateral/ReferralVault.t.sol` | `test/vision/ReferralVault.t.sol` |
| `tests/BettingLib.t.sol` | `test/libraries/BettingLib.t.sol` |
| `tests/MerkleProof.t.sol` | `test/libraries/VisionMerkleProof.t.sol` |

### Fix Pre-Existing Test Failures
1. **BotRegistry**: Fix `MIN_STAKE` assertion (1e18 vs 1e20)
2. **KeeperRegistry**: Fix pubkey test fixtures (need 128-byte G2 points, not 64-byte dummies)
3. **KeeperRegistry**: Fix constants test (`PUBKEY_LENGTH` 128 vs 64)

---

## Deploy Script

### New: `script/DeployVision.s.sol`
```solidity
// Deploy order:
// 1. BotRegistry (WIND address)
// 2. KeeperRegistry (WIND address, admin)
// 3. CollateralVault (WIND address, KeeperRegistry address)
// 4. ReferralVault (WIND address, admin)
```

### New: `script/DeployFullSystem.s.sol` (unified)
```solidity
// Deploy Investment stack
// Deploy Vision stack
// Link shared Governance
// Register keeper BLS keys
```

---

## Deployed Contract Addresses (Reference)

These AA contracts are already deployed on L3. The merge creates new consolidated deployments:

| Contract | Current Address | Status |
|---|---|---|
| BotRegistry | `0x9dF23e34ac13A7145ebA1164660E701839197B1b` | Active (will redeploy) |
| CollateralVault | `0x5F0053e7F8D70d14aa0Ec7590b99aa5f919dB607` | Active (will redeploy) |
| KeeperRegistry | `0xE80FB0E8974EFE237fEf83B0df470664fc51fa99` | Active (will redeploy) |
| ReferralVault | `0xFebF79624d74eEAb1Cde0655264801D46369d9a9` | Active (will redeploy) |
| WIND | `0x4e5b65FB12d4165E22f5861D97A33BA45c006114` | Keep (native wrapper) |

---

## Estimated Scope

- **New files:** 4 contracts + 4 interfaces + 2 libraries = 10 files
- **Adapted from AA:** CollateralVault (major), BotRegistry (minor), KeeperRegistry (moderate), ReferralVault (minimal)
- **Tests migrated:** 6 test files
- **Deploy scripts:** 2 new
- **Shared infra changes:** TypesLib, ErrorsLib, EventsLib extensions (done in Investment plan)
- **Key decision:** Keep KeeperRegistry separate from IssuerRegistry (recommended)
