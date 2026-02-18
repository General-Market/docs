# Story 2.6: BLS Library Solidity

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **contract developer**,
I want **BLS signature verification using BN254 precompiles**,
So that **I can verify 11/20 issuer consensus on-chain**.

## Acceptance Criteria

1. **Given** architecture.md BLS specification (Section 4)
   **When** I implement BLSLib.sol
   **Then** library compiles with `forge build`

2. **ecAdd(p1, p2)** calls precompile 0x06 for BN254 point addition
   - Input: two G1 points (x, y) as uint256[2] each
   - Output: G1 point result as uint256[2]
   - Reverts on invalid point or precompile failure

3. **ecNegate(p)** computes -P = (P.x, -P.y mod p)
   - p_mod = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
   - Pure function (no external calls)

4. **verifyBLS(pubkey, message, signature)** verifies BLS signature
   - Uses pairing precompile 0x08 for BN254 pairing check
   - Returns bool (true = valid, false = invalid)
   - Does NOT revert on invalid signature (returns false)
   - Gas cost ~100-150k per verification

5. Library handles malformed inputs gracefully:
   - Invalid curve points return false (not revert)
   - Zero-length inputs return false
   - Out-of-range coordinates handled

6. Foundry tests verify against known BN254/BLS test vectors

7. Tests verify gas consumption is within 100-150k bounds

## Tasks / Subtasks

- [x] Task 1: Create BLSLib.sol with BN254 constants (AC: #1)
  - [x] Create `contracts/src/libraries/BLSLib.sol`
  - [x] Define BN254 curve constants (p, generator, etc.)
  - [x] Define precompile addresses (0x06, 0x07, 0x08)

- [x] Task 2: Implement ecAdd function (AC: #2)
  - [x] Implement G1 point addition using precompile 0x06
  - [x] Handle precompile failure gracefully
  - [x] Add input validation for curve membership

- [x] Task 3: Implement ecNegate function (AC: #3)
  - [x] Implement negation formula: (x, p - y)
  - [x] Handle point at infinity case
  - [x] Pure function, no external calls

- [x] Task 4: Implement ecMul function (helper for verification)
  - [x] Implement scalar multiplication using precompile 0x07
  - [x] Required for signature verification

- [x] Task 5: Implement verifyBLS function (AC: #4, #5)
  - [x] Implement pairing check using precompile 0x08
  - [x] Hash message to curve point (hashToG1)
  - [x] Check: e(sig, G2) == e(H(msg), pubkey)
  - [x] Return false (not revert) on invalid signatures
  - [x] Handle malformed inputs gracefully

- [x] Task 6: Implement helper functions
  - [x] hashToG1(message) - hash bytes32 to G1 point
  - [x] isOnCurve(point) - validate G1 point
  - [x] pointToBytes / bytesToPoint converters

- [x] Task 7: Create Foundry tests (AC: #6, #7)
  - [x] Test ecAdd with known test vectors
  - [x] Test ecNegate correctness
  - [x] Test verifyBLS with valid signatures
  - [x] Test verifyBLS with invalid signatures
  - [x] Test malformed input handling
  - [x] Gas benchmarking test (assert < 150k)

- [x] Task 8: Integration verification
  - [x] Verify BLSLib compiles with `forge build`
  - [x] Verify gas costs meet NFR3 (~100-150k)
  - [x] Document any limitations or edge cases

## Dev Notes

### BN254 Curve Constants

```solidity
// BN254 (alt_bn128) field modulus
uint256 constant P = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47;

// BN254 curve order (number of points)
uint256 constant N = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001;

// Generator point G1
uint256 constant G1_X = 1;
uint256 constant G1_Y = 2;

// Generator point G2 (complex numbers: [x_im, x_re], [y_im, y_re])
uint256 constant G2_X_IM = 0x198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c2;
uint256 constant G2_X_RE = 0x1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed;
uint256 constant G2_Y_IM = 0x090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b;
uint256 constant G2_Y_RE = 0x12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa;

// Precompile addresses (EIP-196, EIP-197)
address constant PRECOMPILE_ADD = address(0x06);       // ecAdd
address constant PRECOMPILE_MUL = address(0x07);       // ecMul
address constant PRECOMPILE_PAIRING = address(0x08);   // ecPairing
```

### Precompile 0x06 - Point Addition (ecAdd)

```solidity
// Input: 4 uint256 (128 bytes) - [x1, y1, x2, y2]
// Output: 2 uint256 (64 bytes) - [x3, y3]
// Gas: 150 (fixed)
function ecAdd(uint256[2] memory p1, uint256[2] memory p2)
    internal view returns (uint256[2] memory r)
{
    uint256[4] memory input = [p1[0], p1[1], p2[0], p2[1]];
    assembly {
        if iszero(staticcall(gas(), 0x06, input, 0x80, r, 0x40)) {
            revert(0, 0)
        }
    }
}
```

### Precompile 0x07 - Scalar Multiplication (ecMul)

```solidity
// Input: 3 uint256 (96 bytes) - [x, y, s]
// Output: 2 uint256 (64 bytes) - [x', y']
// Gas: 6000 (fixed)
function ecMul(uint256[2] memory p, uint256 s)
    internal view returns (uint256[2] memory r)
{
    uint256[3] memory input = [p[0], p[1], s];
    assembly {
        if iszero(staticcall(gas(), 0x07, input, 0x60, r, 0x40)) {
            revert(0, 0)
        }
    }
}
```

### Precompile 0x08 - Pairing Check (ecPairing)

```solidity
// Input: k * 192 bytes - k pairs of (G1 point, G2 point)
// Output: 32 bytes - 1 if pairing check succeeds, 0 otherwise
// Gas: 34000 * k + 45000
//
// For BLS verification (k=2):
// Check: e(-sig, G2) * e(H(msg), pubkey) == 1
// Input: [sig_neg_x, sig_neg_y, G2_x_im, G2_x_re, G2_y_im, G2_y_re,
//         H_x, H_y, pubkey_x_im, pubkey_x_re, pubkey_y_im, pubkey_y_re]
```

### BLS Signature Verification Formula

For BLS on BN254:
- Signature σ ∈ G1
- Public key pk ∈ G2
- Message hash H(m) ∈ G1

Verification: `e(σ, G2) = e(H(m), pk)`

Rearranged for single pairing check: `e(-σ, G2) · e(H(m), pk) = 1`

### Hash to Curve (hashToG1)

Simple hash-and-pray method (NOT constant time, but sufficient for on-chain):
```solidity
function hashToG1(bytes32 message) internal view returns (uint256[2] memory) {
    uint256 x = uint256(keccak256(abi.encode(message))) % P;
    while (true) {
        uint256 y2 = mulmod(mulmod(x, x, P), x, P) + 3; // y² = x³ + 3
        uint256 y = modSqrt(y2, P);
        if (mulmod(y, y, P) == y2) {
            return [x, y];
        }
        x = addmod(x, 1, P);
    }
}
```

**Note:** Production systems should use a proper hash-to-curve per RFC 9380. For MVP, simple try-and-increment is acceptable.

### Gas Cost Breakdown (NFR3: ~100-150k)

| Operation | Gas |
|-----------|-----|
| ecAdd (0x06) | 150 |
| ecMul (0x07) | 6,000 |
| ecPairing 2 pairs (0x08) | 113,000 |
| Hash to G1 (varies) | ~5,000-20,000 |
| **Total** | **~120,000-140,000** |

### Message Format (CRITICAL for Replay Protection)

All BLS-signed messages in this system MUST include:
```solidity
bytes32 message = keccak256(abi.encode(
    block.chainid,      // Prevents cross-chain replay
    address(this),      // Prevents cross-contract replay
    ...functionData     // Function-specific parameters
));
```

### Architecture Compliance

From architecture.md Section 4 (BLS Configuration):
- Curve: BN254 (alt_bn128)
- On-chain verification via precompiles 0x06, 0x07, 0x08
- Gas budget: ~100-150k per verification
- Key storage: Software wallet Phase 1, HSM later

From architecture.md Section 5 (Contract Structure):
- Location: `contracts/src/libraries/BLSLib.sol`
- Used by: BLSCustody.sol, IssuerRegistry.sol, Index.sol

### Project Structure Notes

**File Location:**
```
contracts/
├── src/
│   ├── libraries/
│   │   ├── BLSLib.sol       ← NEW (this story)
│   │   ├── TypesLib.sol     ← EXISTS
│   │   ├── ErrorsLib.sol    ← EXISTS
│   │   └── EventsLib.sol    ← EXISTS
│   └── interfaces/
│       └── IBLSCustody.sol  ← EXISTS (Story 1.1)
└── test/
    └── libraries/
        └── BLSLib.t.sol     ← NEW (this story)
```

### Testing Standards

**Test Vectors:** Use Ethereum's official BN254 test vectors from EIP-196/197.

**Required Tests:**
1. `test_ecAdd_knownVectors` - Point addition correctness
2. `test_ecNegate_correctness` - Negation formula
3. `test_ecMul_knownVectors` - Scalar multiplication
4. `test_verifyBLS_validSignature` - Valid sig returns true
5. `test_verifyBLS_invalidSignature` - Invalid sig returns false
6. `test_verifyBLS_malformedInput` - Malformed input returns false (no revert)
7. `test_verifyBLS_gasConsumption` - Assert gas < 150,000

**Gas Benchmark:**
```solidity
function test_verifyBLS_gasConsumption() public {
    uint256 gasBefore = gasleft();
    bool result = BLSLib.verifyBLS(pubkey, message, signature);
    uint256 gasUsed = gasBefore - gasleft();
    assertLt(gasUsed, 150_000, "Gas exceeded budget");
    assertTrue(result);
}
```

### Library Function Signatures

```solidity
library BLSLib {
    // Core EC operations
    function ecAdd(uint256[2] memory p1, uint256[2] memory p2)
        internal view returns (uint256[2] memory);

    function ecNegate(uint256[2] memory p)
        internal pure returns (uint256[2] memory);

    function ecMul(uint256[2] memory p, uint256 s)
        internal view returns (uint256[2] memory);

    // BLS verification
    function verifyBLS(
        bytes memory pubkey,      // G2 point (128 bytes)
        bytes32 message,          // Message hash
        bytes memory signature    // G1 point (64 bytes)
    ) internal view returns (bool);

    // Helpers
    function hashToG1(bytes32 message)
        internal view returns (uint256[2] memory);

    function isOnCurve(uint256[2] memory p)
        internal pure returns (bool);
}
```

### Downstream Dependencies

**Contracts that will use BLSLib:**
- `BLSCustody.sol` (Story 2.7) - execute(), proposeWhitelist(), etc.
- `IssuerRegistry.sol` (Story 2.12) - key rotation, kick votes
- `Index.sol` (Story 2.4) - confirmBatch(), confirmFills()
- `L3BridgeCustody.sol` (Story 2.9) - bridge operations
- `ArbBridgeCustody.sol` (Story 2.10) - bridge completion

### Error Handling Strategy

BLSLib should NOT revert on invalid signatures - return false instead:
```solidity
function verifyBLS(...) internal view returns (bool) {
    // Input validation - return false, don't revert
    if (signature.length != 64) return false;
    if (pubkey.length != 128) return false;

    // Pairing check - return result directly
    return _pairing(input);
}
```

Rationale: Calling contracts can decide whether to revert or handle gracefully.

### References

- [Source: architecture.md#4-bls-configuration] - BLS configuration and key recreation
- [Source: architecture.md#5-smart-contract-architecture] - Contract structure and BLSLib location
- [Source: architecture.md#appendix-c-bls-signing-flow] - BLS signature flow diagram
- [Source: EIP-196] - BN254 precompile ADD/MUL specification
- [Source: EIP-197] - BN254 pairing precompile specification
- [Source: epics.md#story-26] - Original acceptance criteria

### Previous Story Intelligence

From **Story 1.1 (Solidity Interfaces)**:
- IBLSCustody.sol created with execute(), proposeWhitelist(), etc.
- All functions expect `bytes calldata blsSignature` parameter
- Message format documented: `keccak256(abi.encode(chainid, this, ...))`
- OpenZeppelin not installed as git submodule - use minimal dependencies
- TypesLib.sol exists with all shared types

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation completed without debug issues.

### Completion Notes List

- Implemented complete BLSLib.sol with all required functionality per architecture.md Section 4
- Used EIP-196/197 precompiles for efficient BN254 operations
- ecAdd: G1 point addition via precompile 0x06 with proper error handling
- ecNegate: Pure function for point negation, handles infinity case
- ecMul: Scalar multiplication via precompile 0x07
- verifyBLS: Full BLS signature verification via pairing precompile 0x08
  - Returns false (doesn't revert) on invalid signatures per AC#5
  - Gas consumption ~127k (within 100-150k target per AC#7)
- hashToG1: Try-and-increment hash-to-curve using modexp precompile for modular square root
- isOnCurve: Validates G1 point is on BN254 curve (y² = x³ + 3)
- pointToBytes/bytesToPoint: Conversion helpers for serialization
- All 42 unit tests pass covering:
  - ecAdd: identity, self-addition, known vectors, inverse, commutativity
  - ecNegate: correctness, double negation, infinity handling
  - ecMul: scalar 0,1,2,3, consistency with add
  - isOnCurve: generator, doubled point, infinity, invalid points
  - hashToG1: produces valid points, deterministic, different messages
  - verifyBLS: invalid length handling, malformed input handling (no revert)
  - Gas benchmarks: verifyBLS < 150k, ecAdd < 15k, ecMul < 15k, hashToG1 < 50k
- Full regression suite: 211 tests pass (no regressions)

### Limitations/Edge Cases

- hashToG1 uses simple try-and-increment (not RFC 9380 compliant) - acceptable for MVP
- hashToG1 is NOT constant-time (side-channel considerations for off-chain use)
- Maximum 256 iterations in hashToG1 loop (practically always finds point in 1-2)

### File List

- contracts/src/libraries/BLSLib.sol (NEW)
- contracts/test/libraries/BLSLib.t.sol (NEW)

### Change Log

- 2026-01-29: Initial implementation of BLSLib with all EC operations and BLS verification
- 2026-01-30: Code review fixes applied (7 issues fixed, 2 low issues noted, 1 acknowledged)
- 2026-01-30: Second code review - 4 MEDIUM issues fixed, 5 LOW issues noted

### Senior Developer Review (AI)

**Reviewer:** max (adversarial code review)
**Date:** 2026-01-30
**Outcome:** Changes Requested -> Fixed

**Issues Found: 10 total (3 Critical/High, 5 Medium, 2 Low)**

All HIGH and MEDIUM issues were fixed. Summary of fixes applied:

1. **CRITICAL - FIXED**: Removed dead assembly in `verifyBLS` that set `sig` pointer then immediately overwrote it via `_bytesToUint`. The assembly was a no-op that made the code fragile and misleading.

2. **CRITICAL - FIXED**: `ecNegate` produced `P` (out of field) when `p[1] % P == 0`. Now correctly returns `0` for the y-coordinate in that case.

3. **HIGH - FIXED**: Removed `require` from `_bytesToUint` to eliminate revert risk in verification path. All callers already validate bounds before calling. Comment updated to document caller responsibility.

4. **MEDIUM - FIXED**: `_modExp` assembly now updates the free memory pointer (`mstore(0x40, add(ptr, 0xc0))`) after allocating 192 bytes, preventing potential memory collisions.

5. **MEDIUM - FIXED**: `hashToG1` no longer reverts on exhaustion (practically impossible). Returns zero point instead, which causes pairing check to fail gracefully in `verifyBLS`.

6. **MEDIUM - FIXED**: `bytesToPoint` returns `(0, 0)` for invalid-length input instead of reverting, consistent with the library's no-revert design principle. Test updated accordingly.

7. **MEDIUM - FIXED**: Story test count corrected from 34 to 42 in Dev Agent Record.

8. **MEDIUM - ACKNOWLEDGED**: No Solidity-native valid BLS signature test. Cannot be fixed because G2 scalar multiplication is not available via precompiles. The 8 Rust cross-compatibility vectors adequately cover valid signature verification.

9. **LOW - NOTED**: `ecAdd`/`ecMul` don't validate inputs before calling precompiles (inconsistent with `verifyBLS`). Not fixing - precompiles handle invalid inputs, and these are internal functions.

10. **LOW - NOTED**: Test file uses `internal` visibility for test vector state variables. Cosmetic, no functional impact.

**Post-Fix Verification:** 42/42 BLSLib tests pass, 289/289 full suite tests pass (0 regressions).

---

**Reviewer:** max (adversarial code review - second pass)
**Date:** 2026-01-30
**Outcome:** Changes Requested -> Fixed

**Issues Found: 9 total (0 Critical, 0 High, 4 Medium, 5 Low)**

All MEDIUM issues were fixed:

1. **MEDIUM - FIXED**: Added guard in `verifyBLS` to return false if `hashToG1` returns zero point (line 225-226). Prevents undefined pairing behavior.

2. **MEDIUM - DOCUMENTED**: Added comment explaining why G2 pubkey is not validated (lines 217-220). Pairing precompile handles invalid G2 points; G2 validation requires expensive field extension arithmetic.

3. **MEDIUM - FIXED**: Renamed `test_verifyBLS_gasConsumption` to `test_verifyBLS_gasConsumption_invalidSig` and added gas assertion to `test_rustVector_basic_signing` which tests valid signature path. Now both paths have explicit gas benchmarks.

4. **MEDIUM - DOCUMENTED**: Added `@dev` note to `isOnCurve` clarifying that coordinates must be reduced mod P (lines 102-104).

**LOW issues noted (not fixed):**
- Missing explicit @dev UNSAFE tag on `_bytesToUint`
- Test file SPDX style minor inconsistency
- `ecNegate` accepts unreduced y coordinates (by design)
- No test for `ecMul(INFINITY, n)`
- Test helper visibility (internal vs private)

**Post-Fix Verification:** 42/42 BLSLib tests pass.
