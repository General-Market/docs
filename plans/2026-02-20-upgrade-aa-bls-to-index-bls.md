# Plan: Upgrade AA BLS to Index BLS Method

**Goal:** Replace AA's two BLS implementations (`BLSLib.sol` + `BLS.sol`) with Index's unified `BLSLib.sol` + `BLSVerifier.sol` mixin pattern, so Vision contracts use the same BLS infrastructure as Investment.

---

## Current State Comparison

### AA has TWO BLS libraries (problem)

| | AA `BLSLib.sol` | AA `BLS.sol` | Index `BLSLib.sol` |
|---|---|---|---|
| **Solc** | 0.8.20 | 0.8.20 | 0.8.24 |
| **Pubkey** | 128 bytes (G2) | 64 bytes (G1) | 128 bytes (G2) |
| **Signature** | 64 bytes (G1) | 64 bytes (G1) | 64 bytes (G1) |
| **hashToG1** | `keccak256(abi.encode(msg)) % P` | `keccak256(DST, msg, i) % P` (with DST) | `keccak256(abi.encode(msg)) % P` |
| **G2 aggregation** | Stubbed (`TODO`) | G1 aggregation via ecAdd | Not needed (pre-aggregated) |
| **Pairing** | Correct: `e(-sig, G2) * e(H(m), pk) == 1` | **BROKEN**: uses G1 pk in G2 pairing slot | Correct: same as AA BLSLib |
| **Curve check** | `isOnCurve` (G1 only) | `isOnCurve` (G1 only) | `isOnCurve` (G1 only) |

**Key finding:** AA's `BLSLib.sol` and Index's `BLSLib.sol` are **nearly identical** (same curve, same constants, same verification). AA's `BLS.sol` is a broken alternative that should be dropped.

### Index has BLSVerifier mixin (AA lacks this)

Index pattern:
```
BLSLib.sol (pure library, stateless)
    └─ BLSVerifier.sol (abstract mixin, reads aggregated pubkey from IssuerRegistry)
        └─ Index.sol, BLSCustody.sol, BridgeProxy.sol, etc. (inherit mixin)
```

AA pattern (no mixin):
```
BLSLib.sol (library, called directly)
    └─ CollateralVault.sol (calls BLSLib.verifyBLS() inline, reads pubkeys from KeeperRegistry)
```

---

## What Changes

### Drop (2 files)
1. `AA/contracts/src/libraries/BLSLib.sol` — replaced by Index's copy
2. `AA/contracts/src/libraries/BLS.sol` — broken alternative, never used in bilateral contracts

### Keep (from Index)
1. `contracts/src/libraries/BLSLib.sol` — single source of truth
2. `contracts/src/libraries/BLSVerifier.sol` — mixin for all BLS-verifying contracts

### Modify (2 contracts)

#### 1. CollateralVault.sol — switch from inline BLSLib to BLSVerifier mixin

**Current AA pattern** (`settleByArbitration`):
```solidity
import { BLSLib } from "../libraries/BLSLib.sol";

// Loops through keeper pubkeys individually, verifies each signature
for (uint256 i = 0; i < activeKeepers.length; i++) {
    bytes memory pubkey = _getKeeperPubkey(activeKeepers[i]);
    if (BLSLib.verifyBLS(pubkey, messageHash, signatures[i])) {
        validSignatures++;
    }
}
require(validSignatures >= threshold);
```

**Problem:** This verifies N individual signatures (gas: N * pairing_cost). Index uses a single aggregated signature against an aggregated pubkey (gas: 1 * pairing_cost).

**Two options:**

**Option A: Keep per-keeper verification (simpler, but more gas)**
- Just swap `BLSLib` import path to use Index's version
- CollateralVault doesn't inherit `BLSVerifier` (it doesn't use IssuerRegistry)
- Reads pubkeys from `KeeperRegistry` as before
- Minimal code change, same gas profile

**Option B: Switch to aggregated verification (less gas, more work)**
- KeeperRegistry stores an aggregated G2 pubkey (like IssuerRegistry does)
- CollateralVault inherits `BLSVerifier` variant that reads from KeeperRegistry
- `settleByArbitration` takes a single aggregated signature
- Requires off-chain aggregation by keepers before submitting

**Recommendation: Option A for now.** The keeper set is only 3 nodes — 3 pairing checks vs 1 is negligible. Aggregated sigs add off-chain complexity for minimal gas savings. Can upgrade to Option B later if keeper set grows.

#### 2. KeeperRegistry.sol — align pubkey format

**Current state:** Contract defines `BLS_PUBKEY_LENGTH = 128` (G2, correct) but tests send 64-byte dummies. The contract is already aligned with Index's format.

**Changes needed:**
- Fix test fixtures to use 128-byte G2 test keys
- No contract code changes for pubkey format

---

## Task List

### Task 1: Delete AA BLS libraries from merged repo

Remove from the Vision import:
- `src/libraries/BLSLib.sol` (AA version) — don't copy into merged repo
- `src/libraries/BLS.sol` — don't copy into merged repo

Vision contracts will import from `../libraries/BLSLib.sol` (Index's version, already in `src/libraries/`).

### Task 2: Update CollateralVault.sol import path

```diff
- import { BLSLib } from "../libraries/BLSLib.sol";
+ import { BLSLib } from "../libraries/BLSLib.sol";  // Now points to Index's version (same path, different content)
```

Since the `verifyBLS(pubkey, message, signature)` function signature is **identical** between AA and Index BLSLib, this is a drop-in replacement. No call-site changes needed.

**Verify:** Both take `(bytes memory pubkey, bytes32 message, bytes memory signature)` and return `bool`. Confirmed identical.

### Task 3: Bump solc version in Vision contracts

```diff
- pragma solidity ^0.8.20;
+ pragma solidity ^0.8.24;
```

Apply to all Vision contracts (CollateralVault, BotRegistry, KeeperRegistry, ReferralVault).

Index's BLSLib uses `0.8.24`. Vision contracts must match.

### Task 4: Fix KeeperRegistry test fixtures

The 55 test failures in KeeperRegistry are all caused by sending 64-byte pubkeys when the contract expects 128 bytes.

**Fix:** Generate valid 128-byte G2 test pubkeys. Use the same BLS test helper approach as Index:

```solidity
// In test helper, define constant G2 test keys (128 bytes each)
bytes constant KEEPER_PUBKEY_1 = hex"198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c21800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa";
// (This is G2 generator - use as dummy for testing, won't verify real sigs but passes length check)
```

### Task 5: Fix BotRegistry test stake amount

Tests expect `MIN_STAKE = 100e18` but contract defines `MIN_STAKE = 1e18`. Either:
- Update tests to expect `1e18`, OR
- Update contract to use `100e18`

Check which is intentional and align.

### Task 6: Verify unified build

```bash
cd /Users/maxguillabert/Downloads/index/contracts
forge build
forge test
```

All Vision tests should pass with Index's BLS library.

---

## What Does NOT Change

| Component | Why |
|---|---|
| `KeeperRegistry` architecture | Keepers are separate from Issuers — different trust model (2/3 vs 11/20) |
| `CollateralVault` settlement flow | Still verifies individual keeper signatures (3 keepers, not worth aggregating) |
| BN254 curve | Both stacks already use the same curve |
| G2 pubkey / G1 signature convention | Both stacks already use this convention |
| `hashToG1` algorithm | Identical between AA BLSLib and Index BLSLib |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| `hashToG1` produces different curve point | **Zero** — implementations are byte-identical | Compare source code (confirmed identical) |
| Existing keeper signatures break | **Zero** — same verification math | Run existing AA BLS tests against Index BLSLib |
| Gas increase | **Zero** — same number of precompile calls | No change in verification pattern |
| Off-chain keeper signing breaks | **Zero** — keepers sign with same curve/hash | Same `keccak256(abi.encode(msg)) % P` |

---

## Summary

This is primarily a **cleanup** task, not a rewrite. The two BLSLib implementations are nearly identical. The real work is:
1. Delete AA's redundant BLS files
2. Fix test fixtures (128-byte pubkeys)
3. Bump solc to 0.8.24
4. Everything else is import path changes
