# Story 3.9: BLS Library Rust

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **issuer**,
I want **BLS signing and aggregation in Rust**,
So that **I can participate in consensus**.

## Acceptance Criteria

1. `generate_keypair()` creates new BLS keypair
2. `sign(privateKey, message)` produces BLS signature
3. `aggregate_signatures(signatures[])` combines into single signature
4. `verify(publicKey, message, signature)` verifies signature
5. `aggregate_pubkeys(pubkeys[])` combines public keys
6. Key serialization/deserialization for storage
7. Compatible with Solidity BLSLib (same test vectors pass)
8. Unit tests verify signing, aggregation, verification

## Tasks / Subtasks

- [x] Task 1: Add BN254 BLS dependencies (AC: #7)
  - [x] 1.1 Add `rust-bls-bn254` crate to `common/Cargo.toml` (or alternative: `ark-bn254` + `ark-ec`)
  - [x] 1.2 Add `ark-serialize` for key serialization
  - [x] 1.3 Verify version compatibility with Solidity BN254 precompile (curve order 21888242871839275222246405745257275088548364400416034343698204186575808495617)

- [x] Task 2: Implement BLS key generation (AC: #1, #6)
  - [x] 2.1 Create `common/src/bls/mod.rs` module
  - [x] 2.2 Implement `BLSKeyPair` struct with `private_key` and `public_key` fields
  - [x] 2.3 Implement `BLSKeyPair::generate()` using secure random
  - [x] 2.4 Implement `BLSKeyPair::from_bytes()` for deserialization
  - [x] 2.5 Implement `BLSKeyPair::to_bytes()` for serialization
  - [x] 2.6 Implement `BLSKeyPair::from_seed(seed: &[u8])` for deterministic key generation (testing)

- [x] Task 3: Implement BLS signing (AC: #2)
  - [x] 3.1 Implement `Bn254BLSSigner` struct that implements `BLSSigner` trait
  - [x] 3.2 Implement `sign(private_key, message)` using BN254 curve
  - [x] 3.3 Hash message to curve point using hash-to-curve (RFC 9380 compatible or Ethereum-compatible)
  - [x] 3.4 Return signature as G1 point serialized to 64 bytes (or 96 bytes compressed)

- [x] Task 4: Implement BLS aggregation (AC: #3, #5)
  - [x] 4.1 Implement `aggregate_signatures(signatures[])` - point addition on G1
  - [x] 4.2 Implement `aggregate_pubkeys(pubkeys[])` - point addition on G2
  - [x] 4.3 Handle empty input arrays gracefully (return error)
  - [x] 4.4 Handle single signature/pubkey (return unchanged)

- [x] Task 5: Implement BLS verification (AC: #4)
  - [x] 5.1 Implement `verify(public_key, message, signature)` using pairing check
  - [x] 5.2 Pairing equation: e(signature, G2) == e(H(message), pubkey)
  - [x] 5.3 Return `Result<bool, Error>` - true if valid, false if invalid signature format

- [x] Task 6: Generate and verify Solidity test vectors (AC: #7)
  - [x] 6.1 Create test vectors with known private keys
  - [x] 6.2 Sign test messages and record signatures
  - [x] 6.3 Create corresponding Solidity tests in `contracts/test/BLSLib.t.sol`
  - [x] 6.4 Verify Rust signatures pass Solidity verification
  - [x] 6.5 Document test vectors in `common/src/bls/test_vectors.rs`

- [x] Task 7: Add comprehensive unit tests (AC: #8)
  - [x] 7.1 Test key generation randomness (multiple keys are different)
  - [x] 7.2 Test signing determinism (same key + message = same signature)
  - [x] 7.3 Test signature aggregation (2, 11, 20 signatures)
  - [x] 7.4 Test public key aggregation
  - [x] 7.5 Test verification with valid and invalid signatures
  - [x] 7.6 Test cross-compatibility with Solidity test vectors
  - [x] 7.7 Test serialization round-trip
  - [x] 7.8 Test error handling (empty inputs, malformed data)

## Dev Notes

### Architecture Compliance

- **Technology Stack**: Rust using arkworks ecosystem (ark-bn254) or rust-bls-bn254
- **Curve**: BN254 (same as Ethereum precompile 0x06 for ecAdd, 0x07 for ecMul, 0x08 for pairing)
- **Project Structure**: Implementation in `common/src/bls/` module
- **Trait**: Implements existing `BLSSigner` trait from `common/src/traits/bls_signer.rs`
- **Dependencies**: Use workspace deps pattern, add to `common/Cargo.toml`

### Existing Implementation Status

The project **already has**:
- ✅ `BLSSigner` trait defined at `common/src/traits/bls_signer.rs`
- ✅ `BLSSignature` and `BLSPublicKey` types at `common/src/types/p2p.rs`
- ✅ `MockIssuer` with mock BLS implementation (XOR-based, not cryptographically valid)
- ✅ P2P message types using BLS signatures

### Missing Implementation

The following items need to be created:
1. **Real BN254 BLS implementation**: Replace mock XOR-based signing with real BLS
2. **Key generation**: Currently MockIssuer uses deterministic seeds
3. **Proper aggregation**: Current mock just XORs bytes together
4. **Pairing-based verification**: Mock always returns true
5. **Solidity compatibility**: Must match on-chain BLSLib.sol verification

### Technical Requirements

**BN254 Curve Parameters:**
```
Field modulus (p): 21888242871839275222246405745257275088696311157297823662689037894645226208583
Curve order (r): 21888242871839275222246405745257275088548364400416034343698204186575808495617
Generator G1: (1, 2)
```

**Key Sizes:**
- Private key: 32 bytes (scalar field element)
- Public key: 64 bytes (G2 point, uncompressed) or 96 bytes (compressed)
- Signature: 64 bytes (G1 point, uncompressed) or 48 bytes (compressed)

**Message Hashing:**
- Hash message to G1 point (hash-to-curve)
- Must match Solidity implementation for cross-chain compatibility

### Library/Framework Requirements

**Primary Option: rust-bls-bn254**
```toml
# common/Cargo.toml
rust-bls-bn254 = "0.2"
```
- Purpose-built for BLS on BN254
- MIT licensed
- Built on arkworks

**Alternative Option: arkworks directly**
```toml
# common/Cargo.toml
ark-bn254 = "0.5"
ark-ec = "0.5"
ark-ff = "0.5"
ark-serialize = "0.5"
ark-std = "0.5"
```
- More control, more code to write
- Better for custom hash-to-curve

**Utility Dependencies:**
```toml
sha2 = "0.10"  # For message hashing
hex = "0.4"    # For test vector encoding
```

### File Structure Requirements

```
common/
├── Cargo.toml                    # Add BLS dependencies
└── src/
    ├── lib.rs                    # Add pub mod bls
    ├── bls/
    │   ├── mod.rs                # NEW - Module exports
    │   ├── signer.rs             # NEW - Bn254BLSSigner implementation
    │   ├── keypair.rs            # NEW - BLSKeyPair struct
    │   ├── utils.rs              # NEW - Hash-to-curve, serialization helpers
    │   └── test_vectors.rs       # NEW - Known test vectors for cross-language testing
    └── traits/
        └── bls_signer.rs         # EXISTS - Trait definition (no changes needed)
```

### Solidity Compatibility Notes

**From architecture.md Section 4 (BLS Configuration):**
- On-chain verification uses BN254 precompile (~100-150k gas)
- BLSLib.sol uses `ecAdd` (precompile 0x06), `ecNegate`, `verifyBLS`
- Message format: `keccak256(abi.encode(...))` - must match Rust encoding

**Cross-Chain Replay Protection:**
- All messages MUST include `chainId`
- Message format: `keccak256(abi.encode("ACTION_NAME", block.chainid, address(this), ...params, nonce))`

**Aggregated Public Key:**
```
AggPubKey = PubKey_1 + PubKey_2 + ... + PubKey_n (elliptic curve addition)
```

### Testing Requirements

- **Unit tests**: `cargo test -p common --lib bls`
- **Cross-language tests**: Generate vectors in Rust, verify in Solidity foundry tests
- **Test coverage**: Key gen, signing, aggregation, verification, serialization, errors

### Previous Story Intelligence

From **3-1-binary-skeleton-cli.md**:
- Issuer binary already handles BLS key paths via `--config` (field: `bls_key_path`)
- Config priority: CLI > ENV > Config file > Defaults
- Key file format should be simple bytes (hex or raw)

From **MockIssuer** (`common/src/mocks/issuer.rs`):
- Current mock uses 32-byte private keys, 48-byte public keys
- `sign_internal` XORs message with private key
- `aggregate_signatures` XORs signature bytes
- `verify` always returns true
- Leader election: `hash(lastAcceptedBLSSignature) mod numIssuers`

### Git Intelligence

Recent commits show Epic 1 foundation work with:
- Trait definitions completed
- Mock implementations in place
- P2P message types using BLSSignature type
- Error types for BLS operations already defined in `common/src/error.rs`

### Latest Tech Information

**rust-bls-bn254 (v0.2.1)**: Implements BLS signatures using BN254 from arkworks. MIT licensed.
- Source: https://crates.io/crates/rust-bls-bn254

**ark-bn254 (v0.5.0)**: The arkworks implementation of BN254 curve.
- Same as bn256/bn128 used in Ethereum
- WARNING: BN254 no longer provides 128-bit security (acceptable for this use case with 11/20 threshold)
- Source: https://docs.rs/ark-bn254/latest/ark_bn254/

**Arkworks Ecosystem**: Highly optimized with assembly implementations for x86_64 (30-70% speedup).

### Project Structure Notes

- Alignment: BLS module goes in `common/` crate (shared between issuer and ap)
- Naming: `Bn254BLSSigner` for the concrete implementation
- Workspace: Uses workspace dependencies pattern

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#BLS-Configuration] - BLS curve and key management specs
- [Source: _bmad-output/planning-artifacts/architecture.md#BLS-Key-Recreation-Algorithm] - Aggregated pubkey calculation
- [Source: _bmad-output/planning-artifacts/architecture.md#BLS-Signing-Flow] - Consensus signing flow
- [Source: _bmad-output/planning-artifacts/epics.md#story-39-bls-library-rust] - Original acceptance criteria
- [Source: common/src/traits/bls_signer.rs] - Existing BLSSigner trait to implement
- [Source: common/src/types/p2p.rs] - BLSSignature and BLSPublicKey types
- [Source: common/src/mocks/issuer.rs] - Mock BLS implementation patterns to replace

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed hash-to-curve to match Solidity: `keccak256(abi.encode(message))` instead of direct keccak256

### Completion Notes List

- Implemented real BN254 BLS using arkworks ecosystem (ark-bn254, ark-ec, ark-ff, ark-serialize, ark-std)
- `BLSKeyPair` supports: generate(), from_seed(), from_bytes(), private_key_bytes(), public_key_bytes()
- `Bn254BLSSigner` implements `BLSSigner` trait with sign(), aggregate_signatures(), verify()
- Public keys are 128-byte G2 points, signatures are 64-byte G1 points
- Hash-to-curve uses try-and-increment matching Solidity BLSLib.hashToG1
- Full cross-language compatibility verified with 8 Solidity tests (5 single + 3 aggregated)
- 93 total Rust tests pass (36 BLS-specific + 57 other common crate tests)
- 42 Solidity tests pass including Rust cross-compatibility vectors

### File List

- common/Cargo.toml (modified - added ark-bn254, ark-ec, ark-ff, ark-serialize, ark-std, sha2, hex)
- common/src/lib.rs (modified - added pub mod bls and exports)
- common/src/bls/mod.rs (new - module exports)
- common/src/bls/keypair.rs (new - BLSKeyPair struct and G2 serialization)
- common/src/bls/signer.rs (new - Bn254BLSSigner implementing BLSSigner trait)
- common/src/bls/utils.rs (new - hash-to-curve, G1 serialization, aggregation)
- common/src/bls/test_vectors.rs (new - cross-language test vectors)
- contracts/test/libraries/BLSLib.t.sol (modified - added Rust cross-compatibility tests)

## Change Log

- 2026-01-29: Story 3.9 implementation complete - BLS Library Rust with full Solidity compatibility
- 2026-01-30: Code review fixes applied:
  - Added documentation clarifying hash-to-curve compatibility with Solidity BLSLib
  - Added documentation explaining BN254 G1 subgroup membership (prime order, no check needed)
  - Added documentation about 256 iteration limit probability (~2^-256 failure chance)
  - Added security documentation for rogue-key attack prevention (requires PoP at protocol level)
  - Added note about duplicate write_bigint_be functions (intentional for module independence)
