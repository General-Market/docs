# Story 5.12: Jupiter Aggregator Client

Status: done

## Story

As an **issuer**,
I want **to execute swaps on Solana via Jupiter aggregator**,
so that **Solana assets (SOL, memecoins, PumpFun tokens) can be traded efficiently for ITP holdings**.

## Acceptance Criteria

1. **Given** Jupiter V6 API availability
   **When** I call `get_quote(input_mint, output_mint, amount)`
   **Then** the client returns a quote with expected output amount, price impact, and route details

2. **Given** a valid quote response
   **When** I call `build_swap_tx(quote, user_pubkey)`
   **Then** the client returns a serialized Solana transaction ready for signing

3. **Given** the need to find optimal routing
   **When** I call `get_route(input_mint, output_mint)`
   **Then** the client returns the best route information including DEXes used and expected slippage

4. **Given** any SPL token including memecoins and PumpFun tokens
   **When** I request quotes or swaps
   **Then** the client supports all SPL tokens on Solana ecosystem

5. **Given** Jupiter's versioned transaction format
   **When** the client builds swap transactions
   **Then** the transactions use Versioned Transactions with Address Lookup Tables

6. **Given** unit tests with mocked HTTP responses
   **When** testing quote fetching, transaction building, and error handling
   **Then** all tests pass with proper coverage

## Tasks / Subtasks

- [x] Task 1: Create Jupiter client module structure (AC: #1, #4)
  - [x] Create `services/external/jupiter/mod.rs` module
  - [x] Define `JupiterClient` struct with configuration
  - [x] Implement `JupiterConfig` for endpoint and API key configuration
  - [x] Add endpoint constants for Jupiter V6 API (`https://api.jup.ag/swap/v1`)

- [x] Task 2: Implement quote fetching (AC: #1, #4)
  - [x] Implement `get_quote(input_mint, output_mint, amount, slippage_bps)` method
  - [x] Define `QuoteRequest` struct with all parameters
  - [x] Define `QuoteResponse` struct matching Jupiter API response
  - [x] Parse route plan and price impact from response
  - [x] Support `restrictIntermediateTokens` for safer routing

- [x] Task 3: Implement swap transaction building (AC: #2, #5)
  - [x] Implement `build_swap_tx(quote, user_pubkey)` method
  - [x] Define `SwapRequest` struct for POST /swap endpoint
  - [x] Define `SwapResponse` struct containing serialized transaction
  - [x] Handle versioned transaction deserialization
  - [x] Support `asLegacyTransaction` fallback option

- [x] Task 4: Implement route fetching (AC: #3)
  - [x] Implement `get_route(input_mint, output_mint)` method
  - [x] Extract route information from quote response
  - [x] Return `Route` struct with: DEXes used, intermediate tokens, expected fees
  - [x] Support `onlyDirectRoutes` parameter for simple swaps

- [x] Task 5: Implement error handling (AC: #1-5)
  - [x] Define `JupiterError` enum with variants:
    - `RateLimited { retry_after_ms: Option<u64> }`
    - `InvalidMint { mint: String }`
    - `InsufficientLiquidity { input_mint: String, output_mint: String }`
    - `SlippageExceeded { expected: u64, actual: u64 }`
    - `TransactionTooLarge { accounts: usize, limit: usize }`
    - `NetworkError { source: reqwest::Error }`
    - `ApiError { message: String }`
  - [x] Map Jupiter API error responses to typed errors
  - [x] Implement `Display` and `Error` traits

- [x] Task 6: Implement Solana types integration (AC: #2, #5)
  - [x] Add `solana-sdk` dependency for Pubkey and Transaction types
  - [x] Implement Pubkey parsing and validation for mint addresses
  - [x] Handle versioned transaction deserialization from base64
  - [x] Provide helper to extract transaction for signing via Squads

- [x] Task 7: Write unit tests with mocked responses (AC: #6)
  - [x] Test quote fetching with mock success response
  - [x] Test transaction building with mock swap response
  - [x] Test error handling for each error variant
  - [x] Test route parsing and DEX identification
  - [x] Test versioned transaction deserialization
  - [x] Use `mockito` or `wiremock` for HTTP mocking

## Dev Notes

### Architecture Compliance

**From architecture.md Section 13 (Multi-Chain Collateral & Custody):**
- Solana custody uses Squads v4 multisig (not BLS)
- 11/20 threshold matches EVM BLS threshold
- Jupiter aggregator program is whitelisted target

**From architecture.md Section 13 (Solana Custody: Squads Multisig):**
- Squads executes Jupiter swaps: `swap SOL → USDC via Jupiter`
- Jupiter aggregator program must be whitelisted in Squads
- Specific token mints (SPL tokens) must be whitelisted

**From architecture.md Section 14 (Order Routing):**
- Solana pairs route through Squads multisig
- Options: 1inch Fusion+ from Arbitrum OR direct Jupiter swap if USDC already on Solana

**From architecture.md Appendix E (Cross-Chain Execution Examples):**
- Example: BONK (Solana memecoin) swaps via `BLS-sign Squads Jupiter swap (BONK → USDC)`
- Solana inventory tracking: `Solana inventory: +$1000 USDC (BONK proceeds)`

### Technical Requirements

**Jupiter V6 API Specifics:**
- Base URL: `https://api.jup.ag/swap/v1`
- Quote endpoint: `GET /quote`
- Swap endpoint: `POST /swap`
- Swap instructions endpoint: `POST /swap-instructions`

**Quote Request Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| inputMint | string | Yes | Input token mint address |
| outputMint | string | Yes | Output token mint address |
| amount | number | Yes | Raw/atomic amount (before decimals) |
| slippageBps | number | Yes | Slippage tolerance in basis points |
| restrictIntermediateTokens | boolean | No | Use only highly liquid intermediates |
| asLegacyTransaction | boolean | No | For non-versioned wallet support |
| onlyDirectRoutes | boolean | No | Single market only |
| maxAccounts | number | No | Limit transaction size (default: 64) |

**Quote Response Format:**
```json
{
  "inputMint": "So11111111111111111111111111111111111111112",
  "inAmount": "100000000",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "outAmount": "25000000",
  "otherAmountThreshold": "24875000",
  "swapMode": "ExactIn",
  "slippageBps": 50,
  "priceImpactPct": "0.01",
  "routePlan": [{
    "swapInfo": {
      "ammKey": "...",
      "label": "Raydium",
      "inputMint": "...",
      "outputMint": "...",
      "inAmount": "100000000",
      "outAmount": "25000000"
    },
    "percent": 100
  }],
  "contextSlot": 123456789,
  "timeTaken": 0.5
}
```

**Swap Request Format:**
```json
{
  "userPublicKey": "...",
  "quoteResponse": { ... },
  "wrapAndUnwrapSol": true,
  "dynamicComputeUnitLimit": true,
  "prioritizationFeeLamports": "auto"
}
```

**Swap Response Format:**
```json
{
  "swapTransaction": "<base64-encoded-versioned-transaction>",
  "lastValidBlockHeight": 123456789
}
```

**Common Token Mint Addresses:**
- SOL (wrapped): `So11111111111111111111111111111111111111112`
- USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- USDT: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- BONK: `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`

### Dependencies

- `reqwest` - HTTP client with async support
- `serde` + `serde_json` - Request/response serialization
- `solana-sdk` - Solana primitives (Pubkey, Transaction, VersionedTransaction)
- `bs58` - Base58 encoding for Solana addresses
- `base64` - Transaction encoding/decoding
- `thiserror` - Error type derivation
- `tokio` - Async runtime (already in common)

### File Structure

```
common/src/integrations/
├── mod.rs                    # External integrations module
├── jupiter/
│   ├── mod.rs               # Jupiter client module exports
│   ├── client.rs            # JupiterClient implementation
│   ├── types.rs             # Request/response types (QuoteRequest, QuoteResponse, etc.)
│   ├── error.rs             # JupiterError types
│   └── route.rs             # Route parsing and DEX identification
```

### Testing Standards

**Unit Tests:**
- Use `mockito` or `wiremock` for HTTP mocking
- Test quote parsing with realistic response data
- Test versioned transaction deserialization
- Test error code mappings from Jupiter API
- No network calls in unit tests

**Integration Tests:**
- Mark with `#[ignore]` for manual execution
- Use Solana devnet/mainnet-beta for testing
- Test with real token pairs (SOL/USDC)
- Clean up by not signing/submitting transactions

### Project Structure Notes

- This module lives in `common/src/integrations/jupiter/` following the established pattern from Story 5.1
- Integrates with Squads SDK from Story 5.10 (Squads submits Jupiter transactions)
- Integrates with Ed25519 key manager from Story 5.11 (for signing)
- Used by Story 6.9 (Squads Integration Test) for full Solana flow testing

### Integration with Squads

The Jupiter client builds transactions, but execution goes through Squads:

```
1. Issuer calls jupiter.get_quote(BONK, USDC, amount)
2. Issuer calls jupiter.build_swap_tx(quote, squads_vault_pubkey)
3. Transaction wrapped in Squads proposal via squads.create_proposal(jupiter_tx)
4. 11/20 issuers approve via squads.approve_proposal(...)
5. Anyone executes via squads.execute_proposal(...)
```

### Key Differences from EVM Integrations

| Aspect | EVM (1inch) | Solana (Jupiter) |
|--------|-------------|------------------|
| Transaction type | Calldata bytes | Versioned Transaction |
| Signing | BLS aggregate signature | Ed25519 via Squads |
| Custody | BLSCustody.sol | Squads v4 multisig |
| Execution | BLSCustody.execute() | Squads proposal approval |
| Address format | 0x... (20 bytes) | Base58 (32 bytes) |

### References

- [Source: architecture.md#13-multi-chain-collateral--custody] - Solana Squads custody
- [Source: architecture.md#14-order-routing--cross-chain-execution] - Solana pair routing
- [Source: architecture.md#appendix-e-cross-chain-execution-examples] - BONK swap example
- [Source: epics.md#Story-5.12] - Jupiter Aggregator Client requirements
- [Jupiter V6 Swap API Docs](https://dev.jup.ag/docs/swap/get-quote)
- [Jupiter Rust Client](https://github.com/jup-ag/jupiter-swap-api-client)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Build locks from concurrent cargo processes caused delays in verification

### Completion Notes List

- Created Jupiter V6 API client following established patterns from 1inch and Squads integrations
- Implemented full quote fetching with route plan parsing and price impact calculation
- Implemented swap transaction building with versioned transaction support
- Added comprehensive error handling with retryable error detection
- Created Route type for extracting DEX and routing information from quotes
- Added well-known token mint constants (SOL, USDC, USDT, BONK)
- Added bincode dependency for transaction deserialization
- Written comprehensive unit tests using wiremock for HTTP mocking
- All tests cover: quote success/errors, swap building, route parsing, error variants

### File List

- common/src/integrations/jupiter/mod.rs (new)
- common/src/integrations/jupiter/client.rs (new)
- common/src/integrations/jupiter/types.rs (new)
- common/src/integrations/jupiter/error.rs (new)
- common/src/integrations/jupiter/route.rs (new)
- common/src/integrations/mod.rs (modified - added jupiter module)
- common/Cargo.toml (modified - added bincode dependency)
- common/tests/jupiter_test.rs (new)

## Change Log

- 2026-01-29: Created Jupiter client module with full API support (Tasks 1-7)
- 2026-01-30: Code review fixes applied — H1: Added InvalidPubkey error variant for pubkey validation; H2: Fixed unsafe env var test; H3: Parse Retry-After header from HTTP response; M1: Corrected file path references; M2: Simplified query building via serde serialization; M4: Added API key header verification tests
