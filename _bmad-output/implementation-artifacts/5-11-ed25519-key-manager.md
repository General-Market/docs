# Story 5.11: Ed25519 Key Manager

Status: done

## Story

As an **issuer**,
I want **to manage Ed25519 keys for Solana**,
so that **I can sign Squads proposals for Solana custody operations**.

## Acceptance Criteria

1. **Given** a need to create a new Solana keypair
   **When** I call `generate_keypair()`
   **Then** a new Ed25519 keypair is created and returned

2. **Given** a valid Ed25519 private key and a message
   **When** I call `sign(privateKey, message)`
   **Then** a valid Ed25519 signature is produced

3. **Given** a public key, message, and signature
   **When** I call `verify(publicKey, message, signature)`
   **Then** the method returns true for valid signatures and false for invalid ones

4. **Given** a private key
   **When** I store it via the key manager
   **Then** the key is encrypted at rest using a configurable encryption method

5. **Given** an Ed25519 key manager
   **When** I configure storage separate from BLS keys
   **Then** the Ed25519 keys are stored in a separate file/location from BLS keys

6. **Given** a keypair
   **When** I call `export_pubkey()`
   **Then** the method returns the public key in Solana-format (Base58 encoded)

7. **Given** unit tests for Ed25519 operations
   **When** running the test suite
   **Then** all tests pass covering keypair generation, signing, and verification

## Tasks / Subtasks

- [x] Task 1: Create Ed25519 key manager module structure (AC: #5)
  - [x] Create `common/src/keys/mod.rs` module
  - [x] Create `common/src/keys/ed25519.rs` for Ed25519 operations
  - [x] Define `Ed25519KeyManager` struct
  - [x] Define `Ed25519Keypair` struct with private/public key storage
  - [x] Add module to `common/src/lib.rs` exports

- [x] Task 2: Implement keypair generation (AC: #1)
  - [x] Implement `generate_keypair()` → `Ed25519Keypair`
  - [x] Use `ed25519-dalek` crate for Ed25519 operations
  - [x] Use OS-provided cryptographically secure RNG (`OsRng`)
  - [x] Return keypair with both signing key and verifying key

- [x] Task 3: Implement signing (AC: #2)
  - [x] Implement `sign(private_key: &SigningKey, message: &[u8])` → `Signature`
  - [x] Use `ed25519-dalek` signing implementation
  - [x] Return 64-byte signature
  - [x] Handle error cases (invalid key)

- [x] Task 4: Implement verification (AC: #3)
  - [x] Implement `verify(public_key: &VerifyingKey, message: &[u8], signature: &Signature)` → `bool`
  - [x] Use `ed25519-dalek` verification implementation
  - [x] Return false on any verification failure (no panics)

- [x] Task 5: Implement encrypted key storage (AC: #4, #5)
  - [x] Define `Ed25519KeyStorage` trait for pluggable storage backends
  - [x] Implement `EncryptedFileStorage` using AES-256-GCM encryption
  - [x] Key derivation from password using Argon2id
  - [x] Store in separate file from BLS keys (default: `~/.index/keys/ed25519.enc`)
  - [x] Implement `load_keypair()` and `save_keypair()` methods
  - [x] Never log private keys or encryption passwords

- [x] Task 6: Implement Solana public key export (AC: #6)
  - [x] Implement `export_pubkey()` → `String` (Base58 encoded)
  - [x] Use `bs58` crate for Base58 encoding
  - [x] Match Solana CLI public key format exactly
  - [x] Implement `from_base58(s: &str)` for public key parsing

- [x] Task 7: Write unit tests (AC: #7)
  - [x] Test keypair generation produces valid keys
  - [x] Test signing produces verifiable signatures
  - [x] Test verification rejects invalid signatures
  - [x] Test verification rejects wrong public key
  - [x] Test verification rejects tampered messages
  - [x] Test Base58 export/import roundtrip
  - [x] Test encrypted storage save/load roundtrip
  - [x] Test key isolation (Ed25519 ≠ BLS paths)

## Dev Notes

### Architecture Compliance

**From architecture.md Section 13 (Multi-Chain Custody):**
- Solana custody uses Squads Multisig with Ed25519 signatures
- Each of 20 issuers generates an Ed25519 keypair
- Same 11/20 threshold as BLS, different key type
- Squads v4 is audited, battle-tested for Solana

**From architecture.md Section 16 (Key Management):**
- Issuers hold TWO key types:
  - BLS (BN254) for all EVM chains
  - Ed25519 for Solana Squads
- Compromise of one doesn't affect the other (isolation principle)
- Storage progression: Encrypted file → Cloud KMS → HSM (production)

**From architecture.md Key Types Table:**
| Key Type | Curve | Usage | Storage |
|----------|-------|-------|---------|
| Ed25519 | Ed25519 | Solana Squads multisig only | Separate encrypted file |

### Technical Requirements

**Ed25519 Specification:**
- Curve: Ed25519 (Curve25519 with Edwards coordinates)
- Signature size: 64 bytes
- Public key size: 32 bytes
- Private key size: 32 bytes (expanded to 64 bytes internally)
- Algorithm: EdDSA (RFC 8032)

**Solana Key Format:**
- Public keys are Base58-encoded 32 bytes
- Example: `4K3Dyjzvzp8eMZFZw2qepWH8rMAzCGMTcB2EscMTHX9j`
- Must match output of `solana-keygen pubkey` command

**Encryption Requirements (Phase 1):**
- Algorithm: AES-256-GCM (authenticated encryption)
- Key derivation: Argon2id (memory-hard, resistant to GPU attacks)
- Nonce: 12 bytes, randomly generated per encryption
- Password from: environment variable `ED25519_KEY_PASSWORD`

### Dependencies

Add to `common/Cargo.toml`:
```toml
ed25519-dalek = { version = "2.1", features = ["rand_core"] }
bs58 = "0.5"
aes-gcm = "0.10"
argon2 = "0.5"
rand = "0.8"
zeroize = { version = "1.7", features = ["derive"] }
```

**Crate Purposes:**
- `ed25519-dalek` - Ed25519 signing/verification (same library Solana uses internally)
- `bs58` - Base58 encoding for Solana public key format
- `aes-gcm` - AES-256-GCM authenticated encryption
- `argon2` - Password-based key derivation
- `rand` - Cryptographically secure random number generation
- `zeroize` - Secure memory cleanup for private keys

### File Structure

```
common/src/
├── lib.rs                    # Add: pub mod keys;
├── keys/
│   ├── mod.rs               # Keys module with Ed25519 and storage exports
│   ├── ed25519.rs           # Ed25519 keypair, sign, verify, export
│   └── storage.rs           # Encrypted key storage implementation
```

### Security Considerations

**CRITICAL - Key Isolation:**
- Ed25519 keys MUST be stored in separate file from BLS keys
- Different encryption keys for each key type
- Compromise of BLS key should NOT expose Ed25519 key

**NEVER:**
- Log private keys or key material
- Log encryption passwords
- Store keys in plaintext
- Use weak random number generators

**Memory Safety:**
- Use `zeroize` crate to clear private keys from memory
- Implement `Drop` trait to zeroize on cleanup
- Avoid cloning private keys unnecessarily

### Integration Points

**Story 5.10 (Squads v4 SDK Integration):**
- Uses `Ed25519KeyManager` to sign Squads proposals
- `sign()` method called with proposal transaction bytes

**Story 5.12 (Jupiter Aggregator Client):**
- Uses `Ed25519KeyManager` for transaction signing
- `export_pubkey()` used to derive Solana wallet address

**Story 6.9 (Squads Integration Test):**
- Tests full flow: generate key → sign proposal → verify execution

### Example Usage

```rust
use common::keys::{Ed25519KeyManager, EncryptedFileStorage};

// Initialize key manager with encrypted storage
let storage = EncryptedFileStorage::new(
    "~/.index/keys/ed25519.enc",
    std::env::var("ED25519_KEY_PASSWORD")?,
)?;
let key_manager = Ed25519KeyManager::new(storage)?;

// Generate new keypair (or load existing)
let keypair = key_manager.load_or_generate()?;

// Export public key for Squads multisig setup
let pubkey_base58 = keypair.export_pubkey();
println!("Solana pubkey: {}", pubkey_base58);

// Sign a Squads proposal
let message = b"proposal_transaction_bytes";
let signature = keypair.sign(message);

// Verify signature (typically done by Squads on-chain)
assert!(keypair.verify(message, &signature));
```

### Testing Standards

**Unit Tests:**
- No network calls
- No file system access (use in-memory storage for tests)
- Test vectors from Ed25519 RFC 8032
- Property-based tests for sign/verify roundtrip

**Test Vectors (RFC 8032):**
```
Secret Key (32 bytes, hex):
9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60

Public Key (32 bytes, hex):
d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a

Message: (empty)
Signature (64 bytes, hex):
e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b
```

### Previous Story Patterns

From Story 5.1 (Bitget Order Placement):
- Module structure: `services/external/bitget/` pattern
- Error handling: typed error enum with `thiserror`
- Testing: unit tests with mocked responses

This story follows similar patterns but lives in `common/src/keys/` since it's shared infrastructure.

### Project Structure Notes

- This module lives in `common/src/keys/` as shared infrastructure
- Used by both Issuer (for Squads signing) and potentially AP (for Solana operations)
- Separate from BLS keys in `common/src/bls/` (if exists) or similar
- Key storage defaults to `~/.index/keys/` directory

### References

- [Source: architecture.md#13-multi-chain-collateral--custody] - Solana uses Squads with Ed25519
- [Source: architecture.md#16-security--recovery] - Key types and storage requirements
- [Source: architecture.md#Solana-Custody-Squads-Multisig] - Squads setup and execution flow
- [Source: epics.md#Story-5.11] - Ed25519 Key Manager story definition
- [Ed25519 RFC 8032: https://datatracker.ietf.org/doc/html/rfc8032]
- [Solana Key Format: https://docs.solana.com/cli/conventions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- Implemented complete Ed25519 key management module in `common/src/keys/`
- Created `Ed25519Keypair` struct with `ZeroizeOnDrop` for secure memory cleanup
- Implemented `generate()`, `sign()`, `verify()`, `export_pubkey()` methods
- Created `Ed25519KeyStorage` trait for pluggable storage backends
- Implemented `InMemoryStorage` for testing (no encryption)
- Implemented `EncryptedFileStorage` using AES-256-GCM with Argon2id key derivation
- Storage file format: 16-byte salt + 12-byte nonce + 48-byte ciphertext (32 key + 16 auth tag)
- Unix file permissions set to 0o600 for encrypted key files
- Added `pubkey_from_base58()` for parsing Solana public keys
- Added `verify_signature()` standalone function for verification without full keypair
- All 17 unit tests pass including RFC 8032 test vectors
- Pre-existing test failures in `price_math` module are unrelated to this story

### File List

- common/src/keys/mod.rs (new)
- common/src/keys/ed25519.rs (new)
- common/src/keys/storage.rs (new)
- common/src/lib.rs (modified - added keys module export)
- common/Cargo.toml (modified - added ed25519-dalek, aes-gcm, argon2, zeroize, tempfile deps)

## Senior Developer Review (AI)

**Reviewer:** max | **Date:** 2026-01-30 | **Model:** Claude Opus 4.5

### Issues Found: 4 High, 3 Medium, 3 Low

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| H1 | HIGH | All changes uncommitted, mixed with other stories | NOTED (process) |
| H2 | HIGH | Password stored as plaintext String, never zeroized | FIXED |
| H3 | HIGH | thread_rng() for crypto salt/nonce instead of OsRng | FIXED |
| H4 | HIGH | Doc comment says 64 bytes, actual file is 76 bytes | FIXED |
| M1 | MEDIUM | Double-construction of keypair in load_or_generate | FIXED |
| M2 | MEDIUM | test_key_isolation_paths is meaningless (compares literals) | FIXED |
| M3 | MEDIUM | unwrap() in decrypt for try_into conversions | FIXED |
| L1 | LOW | bs58 dependency already present from Solana deps | NOTED |
| L2 | LOW | delete() zero-overwrite is best-effort on modern FS/SSD | NOTED |
| L3 | LOW | No safe Debug/Display for Ed25519Keypair | NOTED |

### Fixes Applied

- **H2**: Wrapped `password` field in `Zeroizing<String>` so it is cleared from memory on drop
- **H3**: Replaced `rand::thread_rng()` with `OsRng` for salt/nonce generation in `encrypt()`
- **H4**: Corrected doc comment from "64 bytes" to "76 bytes"
- **M1**: Changed `load_or_generate()` to reload from storage instead of double-constructing from bytes
- **M2**: Replaced string-literal comparison test with real test that verifies two separate storage instances maintain independent keys
- **M3**: Replaced `unwrap()` calls in `decrypt()` with proper `map_err` error handling

### Outcome: CHANGES APPLIED

All HIGH and MEDIUM code issues fixed. H1 (uncommitted changes) is a process issue requiring commit. LOW issues noted for future improvement.

## Change Log

- 2026-01-30: Code review - fixed 6 issues (H2, H3, H4, M1, M2, M3); noted H1 process issue + 3 LOW items
- 2026-01-29: Implemented Ed25519 key manager with encrypted storage (all 7 tasks completed)
