# Story 6.9: Squads Integration Test

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **issuer**,
I want **Squads v4 multisig working end-to-end on Solana devnet**,
so that **Solana custody operations (vault creation, proposal lifecycle, Jupiter swaps) are verified before mainnet deployment**.

## Acceptance Criteria

1. **Given** the Squads client from Story 5.10 and Ed25519 keys from Story 5.11
   **When** I create a Squads vault with 20 issuer Ed25519 pubkeys on Solana devnet
   **Then** the vault deploys with threshold 11/20 and all 20 members are registered

2. **Given** a deployed Squads vault with 11/20 threshold
   **When** I create a proposal (e.g., SPL token transfer)
   **Then** the proposal is created on-chain and returns a valid proposal public key

3. **Given** a pending proposal
   **When** 11 issuers approve via Ed25519 signatures
   **Then** execution succeeds and the underlying transaction completes

4. **Given** a pending proposal
   **When** only 10 issuers approve
   **Then** execution fails with `ThresholdNotReached` error

5. **Given** the Jupiter client from Story 5.12
   **When** a Jupiter swap is built and submitted as a Squads proposal
   **Then** 11 issuers approve and the swap executes via Squads vault on devnet

6. **Given** all tests targeting Solana devnet
   **When** running the integration test suite
   **Then** all tests pass with proper devnet setup, airdrop, and cleanup

## Tasks / Subtasks

- [x] Task 1: Create integration test infrastructure (AC: #6)
  - [x] Create `common/tests/squads_integration.rs` with `#[ignore]` attribute for manual/CI execution
  - [x] Implement devnet setup helper: connect to `https://api.devnet.solana.com`
  - [x] Implement airdrop helper: request SOL from devnet faucet for test wallets
  - [x] Generate 20 Ed25519 keypairs using `Ed25519Keypair::generate()` from Story 5.11
  - [x] Convert Ed25519Keypair to solana-sdk `Keypair` for RPC operations
  - [x] Add timeout handling for devnet operations (30s per operation)
  - [x] Add retry logic for devnet RPC rate limits (429 responses)

- [x] Task 2: Implement Squads vault creation test (AC: #1)
  - [x] Build `multisig_create` instruction with all 20 issuer pubkeys
  - [x] Set threshold to 11 (matching BLS 11/20 on EVM)
  - [x] Set all members with full permissions (INITIATE=1 | VOTE=2 | EXECUTE=4 = 7)
  - [x] Submit vault creation transaction signed by the first keypair
  - [x] Verify vault PDA matches `derive_multisig_pda()` from `squads/pda.rs`
  - [x] Verify `verify_threshold()` returns `(11, 20)`
  - [x] Verify all 20 members via `get_member_pubkeys()`
  - [x] Store vault address for subsequent tests

- [x] Task 3: Implement proposal lifecycle test (AC: #2, #3, #4)
  - [x] Create an SPL token transfer proposal via `create_proposal()`
  - [x] Verify proposal status is Active with 0 approvals via `get_proposal_status()`
  - [x] Have 10 issuers approve via `approve_proposal()` - verify threshold NOT reached
  - [x] Attempt execution with 10 approvals - verify `ThresholdNotReached` error
  - [x] Have 11th issuer approve - verify threshold IS reached (approval_count == 11)
  - [x] Execute proposal via `execute_proposal()` - verify success
  - [x] Verify proposal status is Executed via `get_proposal_status()`
  - [x] Verify the SPL transfer occurred on-chain

- [x] Task 4: Implement Jupiter swap via Squads test (AC: #5)
  - [x] Use `JupiterClient` to fetch a quote: SOL -> USDC (small amount, e.g., 0.01 SOL)
  - [x] Build swap transaction via `build_swap_tx()` with Squads vault as `user_pubkey`
  - [x] Wrap Jupiter instruction using `squads_client.build_swap_tx(jupiter_ix)`
  - [x] Create Squads proposal with the wrapped Jupiter instruction
  - [x] Have 11 issuers approve the proposal
  - [x] Execute the proposal
  - [x] Verify swap completed (check USDC balance of vault increased, or at minimum no error)
  - [x] Note: This test may fail if devnet Jupiter liquidity is insufficient - handle gracefully

- [x] Task 5: Implement edge case and error handling tests (AC: #3, #4)
  - [x] Test duplicate approval rejection (same issuer approves twice)
  - [x] Test non-member approval rejection
  - [x] Test proposal expiry handling (if applicable on devnet)
  - [x] Test execution idempotency (execute already-executed proposal)
  - [x] Test with maximum transaction size boundary

- [x] Task 6: Test cleanup and documentation (AC: #6)
  - [x] Add test documentation with setup instructions (devnet SOL faucet, etc.)
  - [x] Add environment variable configuration docs (SOLANA_DEVNET_URL override)
  - [x] Ensure tests are idempotent (each run creates fresh vault)
  - [x] Add CI integration notes (how to run these tests in CI pipeline)
  - [x] Verify all tests have descriptive names and failure messages

## Dev Notes

### Architecture Compliance

**From architecture.md Section 13 (Solana Custody: Squads Multisig):**
- Solana doesn't have BN254 precompiles, so we use Squads v4 multisig
- Same 11/20 threshold, different key type (Ed25519)
- Setup: 20 issuers generate Ed25519 keypairs, Squads deployed with all 20 pubkeys, threshold 11
- Test transaction: $1 USDC transfer, all verify
- Execution flow: issuers agree -> one creates proposal -> 10 others approve -> anyone executes

**From architecture.md Section 14 (Routing Decision Tree):**
- Solana pairs route through Squads multisig
- Options: 1inch Fusion+ from Arbitrum OR direct Jupiter swap if USDC already on Solana

**From architecture.md Appendix E:**
- BONK (Solana memecoin) swaps use `BLS-sign Squads Jupiter swap (BONK -> USDC)`
- Jupiter aggregator program is whitelisted in Squads

### Technical Requirements

**Existing Module APIs to Use:**

1. **SquadsClient** (`common/src/integrations/squads/client.rs`):
   - `SquadsClient::new(config)` - Initialize with devnet cluster
   - `create_proposal(keypair, instruction)` - Returns `CreateProposalResult`
   - `approve_proposal(keypair, proposal_id)` - Returns signature
   - `execute_proposal(keypair, proposal_id)` - Returns `ExecuteProposalResult`
   - `get_proposal_status(proposal_id)` - Returns `ProposalStatus`
   - `verify_threshold()` - Returns `(threshold, member_count)`
   - `get_member_pubkeys()` - Returns `Vec<Pubkey>`
   - `build_swap_tx(jupiter_ix)` - Wraps Jupiter instruction for Squads
   - `build_transfer_tx(transfer)` - Builds SPL token transfer instruction

2. **Ed25519Keypair** (`common/src/keys/ed25519.rs`):
   - `Ed25519Keypair::generate()` - Generate via OsRng
   - `export_pubkey()` - Base58 Solana format
   - `public_key_bytes()` - Raw 32 bytes for Solana Pubkey conversion
   - `private_key_bytes()` - Raw 32 bytes for solana-sdk Keypair conversion

3. **JupiterClient** (`common/src/integrations/jupiter/client.rs`):
   - `JupiterClient::new(config)` - Initialize with API config
   - `get_quote(input_mint, output_mint, amount, slippage_bps)` - Fetch swap quote
   - `build_swap_tx(quote, user_pubkey)` - Build serialized swap transaction
   - `deserialize_transaction(swap)` - Parse VersionedTransaction

**PDA Derivation (from `squads/pda.rs`):**
```
Multisig PDA: seeds = ["multisig", "multisig", create_key]
Vault PDA: seeds = ["multisig", multisig_pda, "vault", vault_index]
Transaction PDA: seeds = ["multisig", multisig_pda, "transaction", transaction_index]
Proposal PDA: seeds = ["multisig", multisig_pda, "transaction", transaction_index, "proposal"]
```

**Squads v4 Program ID:** `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`

**Key Constants:**
- Threshold: 11 (EXPECTED_THRESHOLD)
- Members: 20 (EXPECTED_MEMBERS)
- Member permissions: INITIATE(1) | VOTE(2) | EXECUTE(4) = 7

**Solana Devnet Configuration:**
- Cluster URL: `https://api.devnet.solana.com`
- Override: `SOLANA_DEVNET_URL` env var
- Airdrop: 2 SOL per test wallet (enough for transaction fees)
- Rate limit: Be mindful of devnet rate limits; add retry with backoff

**Ed25519 to Solana Keypair Conversion:**
The `Ed25519Keypair` from Story 5.11 stores raw 32-byte private keys. Convert to solana-sdk `Keypair` via:
```rust
let ed25519_kp = Ed25519Keypair::generate();
let solana_kp = solana_sdk::signer::keypair::Keypair::from_bytes(
    &[ed25519_kp.private_key_bytes(), ed25519_kp.public_key_bytes()].concat()
)?;
```
Note: `solana-sdk::Keypair::from_bytes` expects 64 bytes (32 private + 32 public).

**Well-Known Token Mints (devnet):**
- SOL (wrapped): `So11111111111111111111111111111111111111112`
- USDC (devnet): May differ from mainnet - use devnet USDC mint or create test SPL token
- For Jupiter devnet testing, verify that devnet API supports swap quotes

### Dependencies

All dependencies already present in `common/Cargo.toml`:
- `solana-sdk = "2"` - Keypair, Pubkey, Transaction, Instruction
- `solana-client = "2"` - RpcClient for devnet
- `ed25519-dalek = "2.1"` - Ed25519 operations
- `bs58 = "0.5"` - Base58 encoding
- `tokio` - Async runtime
- `reqwest` - HTTP client (for Jupiter API)

May need to add as dev-dependency:
- `spl-token` or `spl-associated-token-account` if testing SPL transfers directly

### File Structure

```
common/tests/
├── squads_integration.rs     # NEW - Integration tests for this story
```

All tests go in a single `squads_integration.rs` file with `#[ignore]` attribute so they only run when explicitly invoked via `cargo test --test squads_integration -- --ignored`.

### Testing Pattern

Follow established patterns from existing integration tests:
- `common/tests/squads_test.rs` - Unit tests (no network) using in-memory test data
- `common/tests/jupiter_test.rs` - Uses wiremock for HTTP mocking

This story's tests differ: they make REAL devnet RPC calls.

**Test Structure:**
```rust
#[tokio::test]
#[ignore] // Requires Solana devnet - run manually or in CI
async fn test_squads_vault_creation() {
    // 1. Setup: generate 20 keypairs, airdrop SOL
    // 2. Create multisig vault
    // 3. Verify vault state
}
```

**Devnet Airdrop Pattern:**
```rust
async fn airdrop_sol(client: &RpcClient, pubkey: &Pubkey, lamports: u64) -> Result<()> {
    let sig = client.request_airdrop(pubkey, lamports).await?;
    // Confirm transaction with retries
    loop {
        if client.confirm_transaction(&sig).await? { break; }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    Ok(())
}
```

### Previous Story Intelligence

**From Story 5.10 (Squads v4 SDK Integration) - Code Review Record:**
- CRITICAL FIX: Program ID was v3, corrected to v4 (`SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`)
- CRITICAL FIX: All PDA derivations were missing `"multisig"` prefix seed
- CRITICAL FIX: All account/instruction discriminators were verified against actual Squads v4 IDL
- 71 tests pass (42 unit + 29 integration)
- All discriminators and PDA seeds verified against actual Squads v4 IDL

**From Story 5.11 (Ed25519 Key Manager) - Code Review Record:**
- Password field wrapped in Zeroizing<String>
- OsRng used for salt/nonce generation
- 17 unit tests pass including RFC 8032 test vectors
- Key isolation: Ed25519 and BLS stored separately

**From Story 5.12 (Jupiter Aggregator Client) - Code Review Record:**
- InvalidPubkey error variant added for pubkey validation
- Retry-After header parsed from HTTP response
- Tests use wiremock for HTTP mocking
- Full quote/swap/route API implemented

### Critical Implementation Notes

1. **Squads vault creation is NOT part of SquadsClient API** - The existing client assumes a pre-existing vault. You need to build the `multisig_create` instruction directly using Squads v4 IDL instruction format. Use the discriminator from `squads/instructions.rs`.

2. **Devnet Jupiter may have limited liquidity** - The Jupiter swap test (Task 4) may fail on devnet due to insufficient liquidity pools. Handle this gracefully: catch the error and mark the test as skipped rather than failed. Consider using a mock or very small amount.

3. **Devnet airdrop rate limits** - Solana devnet faucet has rate limits. Generate all 20 keypairs but only airdrop SOL to the ones that need to sign transactions (the proposer + 11 approvers). The vault creation signer needs the most SOL.

4. **Ed25519Keypair to solana-sdk Keypair** - The Ed25519Keypair from Story 5.11 uses `ed25519-dalek` types. To interact with Solana RPC, convert to `solana_sdk::signer::keypair::Keypair` by concatenating private + public bytes into 64-byte array.

5. **Transaction confirmation** - Devnet can be slow. Use `commitment: Confirmed` (not `Finalized`) and implement retry loops for confirmation with reasonable timeouts (30s).

6. **Vault PDA vs Multisig PDA** - The multisig account PDA is derived with `["multisig", "multisig", create_key]`. The vault (treasury) PDA is `["multisig", multisig_pda, "vault", vault_index]`. The vault is where assets are held and what should be used as `user_pubkey` in Jupiter swaps.

### Project Structure Notes

- Integration test file: `common/tests/squads_integration.rs`
- Existing Squads unit tests: `common/tests/squads_test.rs` (not to be modified)
- Existing Jupiter unit tests: `common/tests/jupiter_test.rs` (not to be modified)
- Squads module: `common/src/integrations/squads/` (not to be modified unless bug found)
- Jupiter module: `common/src/integrations/jupiter/` (not to be modified unless bug found)
- Ed25519 module: `common/src/keys/` (not to be modified)

### References

- [Source: architecture.md#13-Solana-Custody-Squads-Multisig] - Setup, execution flow, whitelisting
- [Source: architecture.md#14-Routing-Decision-Tree] - Solana pair routing through Squads
- [Source: architecture.md#Appendix-E] - Cross-chain examples with BONK via Squads Jupiter
- [Source: architecture.md#22-Issuer-Consensus-Reference] - 11/20 threshold for all actions
- [Source: epics.md#Story-6.9] - Squads Integration Test acceptance criteria
- [Source: 5-10-squads-v4-sdk-integration.md] - Squads client API, PDA seeds, discriminators
- [Source: 5-11-ed25519-key-manager.md] - Ed25519 keypair generation and signing
- [Source: 5-12-jupiter-aggregator-client.md] - Jupiter quote/swap API, SOL/USDC mints

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Pre-existing compilation errors in `rpc_chain_writer.rs` (TypedTransaction import) do not affect integration tests
- Pre-existing warnings: unused import in ed25519.rs (Zeroize), unused variable in chain.rs (filter_address)
- Build verified: `cargo check --test squads_integration -p common` succeeds with 0 errors, 0 warnings from test file
- Regression check: 47 squads_test + 24 jupiter_test all passing

### Completion Notes List

- **Task 1**: Created `squads_integration.rs` with full test infrastructure: `create_devnet_client()`, `generate_issuer_keypairs()`, `airdrop_sol()`, `with_retry()`. All tests use `#[ignore]` + `#[tokio::test]`. Ed25519 to solana-sdk Keypair conversion via 64-byte concatenation. Retry logic with exponential backoff for 429s.
- **Task 2**: `test_squads_vault_creation()` — builds `multisig_create_v2` instruction directly (SquadsClient assumes pre-existing vault). Derives discriminator via `sha256("global:multisig_create_v2")[0..8]`. Creates vault with 20 members at 11/20 threshold, all with permissions mask=7. Verifies PDA derivation, account deserialization, member list, and threshold on-chain.
- **Task 3**: `test_proposal_lifecycle()` — full proposal lifecycle: create proposal, verify Active status, approve with 10 members, attempt execution (ThresholdNotReached), 11th approval, execute. `test_threshold_not_reached_with_10_approvals()` separately tests the 10-approval threshold enforcement.
- **Task 4**: `test_jupiter_swap_via_squads()` — fetches Jupiter quote (SOL->USDC), builds swap tx with vault as user_pubkey, extracts instructions from VersionedTransaction, wraps via `build_swap_tx()`, creates Squads proposal, 11 approvals, execution. Gracefully handles devnet limitations (no liquidity, API unavailable) by skipping rather than failing.
- **Task 5**: `test_duplicate_approval_rejection()`, `test_non_member_approval_rejection()`, `test_execute_already_executed_proposal()`, `test_transaction_size_boundary()` — covers duplicate votes, non-member rejection, execution idempotency, and transaction size limits. Proposal expiry is N/A for Squads v4 (no built-in expiry).
- **Task 6**: Module-level rustdoc with setup instructions, env var docs, CI integration notes. All tests create fresh vaults (idempotent). Descriptive test names and assertion messages throughout.

### File List

- `common/tests/squads_integration.rs` — NEW: Squads v4 devnet integration test suite (all 6 tasks)

### Change Log

- 2026-01-30: Story 6.9 implementation complete — 10 integration tests covering vault creation, proposal lifecycle, Jupiter swap via Squads, edge cases (duplicate approval, non-member, idempotency, tx size), test infrastructure with devnet helpers
