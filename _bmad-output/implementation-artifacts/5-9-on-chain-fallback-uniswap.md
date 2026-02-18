# Story 5.9: On-Chain Fallback (Uniswap Reserves)

Status: in-progress

## Story

As an **issuer**,
I want **fallback pricing from on-chain reserves when 1inch API is unavailable**,
so that **pricing continues to function and orders can still be processed, even during API degradation events**.

## Acceptance Criteria

1. **Given** the 1inch API is unavailable or rate-limited
   **When** I call `get_quote_onchain(pair, amount)`
   **Then** the method reads Uniswap V3 pool reserves directly from the blockchain

2. **Given** a Uniswap V3 pool address
   **When** I query the pool
   **Then** the method calculates price from `sqrtPriceX96` using the formula: `price = (sqrtPriceX96 / 2^96)^2`

3. **Given** multiple DEX sources on Arbitrum
   **When** I implement the fallback
   **Then** it supports both Uniswap V3 and Sushiswap on Arbitrum

4. **Given** a quote obtained via on-chain fallback
   **When** the quote is returned
   **Then** it includes a `DEGRADED_QUOTES` flag indicating fallback pricing is in use

5. **Given** fallback pricing is active
   **When** measuring latency
   **Then** higher latency is acceptable (1-2s vs 100ms for 1inch API)

6. **Given** various token pairs
   **When** calculating prices
   **Then** unit tests verify price calculation accuracy against known pool states

## Tasks / Subtasks

- [x] Task 1: Create on-chain quote module structure (AC: #1)
  - [x] Create `external/onchain_quote/mod.rs` module in issuer crate
  - [x] Define `OnchainQuoteClient` struct with RPC configuration
  - [x] Define `OnchainQuoteConfig` for chain-specific settings (RPC URLs, pool factories)
  - [x] Add Arbitrum as primary supported chain

- [x] Task 2: Implement Uniswap V3 pool reader (AC: #2)
  - [x] Define Uniswap V3 pool ABI bindings (slot0, liquidity)
  - [x] Implement `get_pool_state(pool_address)` to read `sqrtPriceX96` and `tick`
  - [x] Implement `calculate_price_from_sqrt(sqrtPriceX96, token0_decimals, token1_decimals)`
  - [x] Handle token order (token0/token1) correctly for price direction
  - [x] Add decimal normalization for different token decimal places

- [x] Task 3: Implement Uniswap V3 factory lookup (AC: #1, #3)
  - [x] Implement `get_pool_address(token_a, token_b, fee_tier)` via factory
  - [x] Support fee tiers: 0.05% (500), 0.30% (3000), 1.00% (10000)
  - [x] Cache pool addresses to avoid repeated lookups
  - [x] Constants for Uniswap V3 factory address on Arbitrum: `0x1F98431c8aD98523631AE4a59f267346ea31F984`

- [x] Task 4: Implement Sushiswap support (AC: #3)
  - [x] Define Sushiswap V3 pool ABI bindings (same interface as Uniswap V3)
  - [x] Add Sushiswap V3 factory address on Arbitrum: `0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e`
  - [x] Implement pool selection logic (prefer Uniswap, fallback to Sushi)
  - [x] Compare liquidity between pools for best quote

- [x] Task 5: Implement quote aggregation (AC: #1, #4)
  - [x] Implement `get_quote_onchain(pair, amount)` main entry point
  - [x] Query multiple pools (Uniswap + Sushiswap) for best price
  - [x] Calculate price impact based on pool liquidity
  - [x] Return `OnchainQuote` struct with:
    - `price: Decimal`
    - `source: QuoteSource::Onchain { dex: DexType }`
    - `degraded: bool = true`
    - `liquidity: U256`
    - `price_impact_bps: u16`

- [x] Task 6: Implement DEGRADED_QUOTES flagging (AC: #4)
  - [x] Define `QuoteStatus` enum: `Fresh`, `Cached`, `Degraded`
  - [x] Add `is_degraded()` method to quote struct
  - [x] Emit warning log when fallback is used
  - [x] Track degraded quote metrics: `degraded_quotes_count`, `degraded_quote_latency_ms`

- [x] Task 7: Implement latency-aware execution (AC: #5)
  - [x] Add configurable timeout for on-chain reads (default 5s)
  - [x] Implement parallel pool queries to reduce latency
  - [x] Add retry logic for RPC failures (3 retries, 500ms delay)
  - [x] Track latency metrics: `onchain_quote_latency_ms`

- [x] Task 8: Write unit tests (AC: #6)
  - [x] Test sqrtPriceX96 price calculation with known values
  - [x] Test token order handling (token0 vs token1)
  - [x] Test decimal normalization (6 decimals USDC vs 18 decimals ETH)
  - [x] Test pool address caching
  - [x] Test fallback selection logic
  - [x] Mock RPC responses for deterministic testing

- [x] Task 9: Write integration tests
  - [x] Create `tests/onchain_quote_integration.rs` with `#[ignore]` attribute
  - [x] Test against Arbitrum RPC (Alchemy/Infura)
  - [x] Verify price matches 1inch quote within 0.5% tolerance
  - [x] Document expected test conditions in comments

### Review Follow-ups (AI Code Review)

- [x] [AI-Review][HIGH] Commit all onchain_quote files to git - committed as 7a67b6d
- [ ] [AI-Review][MEDIUM] Wire integration with Story 5.8 rate limit handler - **BLOCKED**: Story 5.8 is `ready-for-dev`, integration will be done when 5.8 is implemented
- [x] [AI-Review][MEDIUM] Add mock RPC tests with realistic responses for error paths (retry, timeout, pool not found) - committed as 835b8f6
- [x] [AI-Review][LOW] Consider making token addresses configurable instead of hardcoded - added TokenRegistry, committed as 835b8f6

## Dev Notes

### Architecture Compliance

**From architecture.md Section 14 (1inch API Rate Limit Strategy):**
> STRATEGY 4: ON-CHAIN FALLBACK
> If 1inch API completely unavailable:
> 1. Read DEX pool reserves directly (Uniswap, Sushiswap)
> 2. Calculate quote from reserves
> 3. Higher latency but functional
> 4. Flag: "DEGRADED_QUOTES" in batch

**From architecture.md Section 7 (Price Staleness Check):**
- DEX pairs: 30 second staleness limit
- Low-liquidity assets: 60 second staleness limit

**From architecture.md Section 4 (Technology Stack):**
- Off-chain services implemented in Rust
- Issuer nodes are Rust services

### Technical Requirements

**Uniswap V3 Price Calculation:**
```
sqrtPriceX96 = sqrt(price) * 2^96

To get price:
price = (sqrtPriceX96 / 2^96)^2

For token1/token0 price:
price = (sqrtPriceX96)^2 / 2^192

With decimals adjustment:
adjusted_price = price * 10^(token0_decimals - token1_decimals)
```

**Uniswap V3 Pool slot0 ABI:**
```solidity
function slot0() external view returns (
    uint160 sqrtPriceX96,
    int24 tick,
    uint16 observationIndex,
    uint16 observationCardinality,
    uint16 observationCardinalityNext,
    uint8 feeProtocol,
    bool unlocked
);
```

**Pool Address Calculation (CREATE2):**
```
pool_address = CREATE2(
    factory_address,
    keccak256(abi.encode(token0, token1, fee)),
    POOL_INIT_CODE_HASH
)
```

**Arbitrum DEX Addresses:**
| DEX | Factory Address | Init Code Hash |
|-----|-----------------|----------------|
| Uniswap V3 | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54` |
| Sushiswap V3 | `0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e` | Same as Uniswap V3 |

**Common Token Addresses (Arbitrum):**
| Token | Address | Decimals |
|-------|---------|----------|
| USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 6 |
| USDC.e | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` | 6 |
| WETH | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | 18 |
| WBTC | `0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f` | 8 |
| ARB | `0x912CE59144191C1204E64559FE8253a0e49E6548` | 18 |
| USDT | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | 6 |

### Dependencies

- `ethers` - Ethereum RPC client and contract bindings
- `ethers-contract` - Contract ABI encoding/decoding
- `rust_decimal` - Precise decimal arithmetic for price calculations
- `tokio` - Async runtime (already in common)
- `thiserror` - Error type derivation
- `tracing` - Structured logging for degraded quote warnings

### File Structure

```
common/src/
├── integrations/
│   ├── mod.rs                    # External integrations module
│   ├── onchain_quote/
│   │   ├── mod.rs               # On-chain quote module
│   │   ├── client.rs            # OnchainQuoteClient implementation
│   │   ├── uniswap_v3.rs        # Uniswap V3 pool interaction
│   │   ├── sushiswap.rs         # Sushiswap V3 pool interaction
│   │   ├── price_math.rs        # sqrtPriceX96 calculations
│   │   ├── types.rs             # OnchainQuote, QuoteStatus types
│   │   └── error.rs             # OnchainQuoteError types
```

### Testing Standards

**Unit Tests:**
- Use known sqrtPriceX96 values from real pools for calculation verification
- Test edge cases: very low/high prices, different decimal combinations
- Mock RPC provider for deterministic tests
- No actual network calls in unit tests

**Integration Tests:**
- Mark with `#[ignore]` for manual execution
- Use environment variable for RPC URL: `ARBITRUM_RPC_URL`
- Compare results with 1inch API (should match within 0.5%)
- Document expected price ranges in test comments

### Error Handling

Define `OnchainQuoteError` enum:
```rust
pub enum OnchainQuoteError {
    /// Pool not found for the given token pair
    PoolNotFound { token_a: Address, token_b: Address },
    /// RPC call failed
    RpcError { source: ProviderError },
    /// Pool has zero liquidity
    NoLiquidity { pool: Address },
    /// Price calculation overflow
    MathOverflow { context: String },
    /// All retry attempts exhausted
    MaxRetriesExceeded { attempts: u32 },
    /// Configuration error
    InvalidConfig { message: String },
}
```

### Integration Points

- **Story 5.4 (1inch Quote API Client):** This fallback is triggered when 1inch API fails
- **Story 5.5 (1inch Quote Cache):** Cache should also store fallback quotes
- **Story 5.8 (1inch Rate Limit Handler):** Rate limit handler triggers fallback after max retries
- **Story 3.13 (Price Fetching & Staleness):** Fallback quotes must pass staleness validation

### Performance Considerations

- **Latency Target:** 1-2 seconds acceptable (vs 100ms for 1inch)
- **RPC Calls:** Minimize by caching pool addresses
- **Parallel Queries:** Query Uniswap + Sushiswap in parallel
- **Connection Pooling:** Reuse RPC connections for efficiency

### Security Considerations

- **Price Manipulation:** On-chain prices can be manipulated via flash loans
- **Mitigation:** Compare multiple pools, flag large deviations
- **TWAP Alternative:** Consider using Uniswap V3 TWAP oracle for more manipulation-resistant prices (future enhancement)

### Project Structure Notes

- This module lives in `common/src/integrations/onchain_quote/`
- The issuer needs this for price fetching fallback (Epic 3)
- Will be triggered by the rate limit handler from Story 5.8
- Integrates with the price validation logic from Story 3.13

### References

- [Source: architecture.md#14-order-routing--cross-chain-execution] - 1inch API Rate Limit Strategy, STRATEGY 4
- [Source: architecture.md#7-issuer-cycle] - Price Staleness Check requirements
- [Source: epics.md#Story-5.9] - On-Chain Fallback (Uniswap Reserves)
- [Uniswap V3 Docs: https://docs.uniswap.org/contracts/v3/reference/core/UniswapV3Pool]
- [Sushiswap V3 Docs: https://docs.sushi.com/docs/Products/V3%20AMM/Core/Pool]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Build system had bincode v3.0.0 conflict from Solana dependencies - resolved by forcing v1.3

### Completion Notes List

- Implemented on-chain quote fallback module in `common/src/integrations/onchain_quote/`
- Created Uniswap V3 pool reader with ABI bindings via ethers abigen macro
- Implemented sqrtPriceX96 price calculation with decimal normalization
- Added Sushiswap V3 support (same interface as Uniswap V3)
- Quote aggregation queries multiple pools and returns best price
- DEGRADED_QUOTES flag always set for on-chain quotes
- Metrics tracking: degraded_quotes_count, latency tracking
- Retry logic with configurable timeout (default 5s) and retries (3 with 500ms delay)
- Pool address caching via CREATE2 computation
- Integration tests created with `#[ignore]` for live RPC testing

### Code Review Fixes Applied (2026-01-30)

- Fixed story documentation: updated file paths from `issuer/src/external/` to `common/src/integrations/`
- Refactored `get_best_quote_internal` to query all pools in PARALLEL using `futures::future::join_all`
- Added warning logs when defaulting to 18 decimals for unknown tokens
- Added debug logging for individual pool quotes and best quote selection
- Added detailed WARNING documentation to `estimate_price_impact_bps` about its limitations
- Created action items for remaining issues: git commit, Story 5.8 integration, mock RPC tests

### Code Review Fixes Applied (2026-01-30, Session 2)

- Added `TokenRegistry` struct for configurable token addresses and decimals (types.rs:239-298)
- Added builder methods: `with_token_registry()`, `with_token()` on `OnchainQuoteConfig` (types.rs:324-337)
- Updated client to use `config.token_registry.decimals()` instead of hardcoded `arbitrum_tokens::decimals()` (client.rs:188-207)
- Added 6 new mock RPC error path tests in client.rs (lines 622-708):
  - `test_short_timeout_config_is_applied`
  - `test_pool_not_found_for_unknown_tokens`
  - `test_retry_count_respected`
  - `test_error_is_retryable`
  - `test_max_retries_exceeded_error`
- Added 11 new TokenRegistry tests in types.rs (lines 489-585)
- Remaining blocked item: Story 5.8 integration (5.8 is still `ready-for-dev`)

### File List

**New files:**
- common/src/integrations/onchain_quote/mod.rs
- common/src/integrations/onchain_quote/client.rs
- common/src/integrations/onchain_quote/error.rs
- common/src/integrations/onchain_quote/types.rs
- common/src/integrations/onchain_quote/price_math.rs
- common/src/integrations/onchain_quote/uniswap_v3.rs
- common/src/integrations/onchain_quote/sushiswap.rs
- common/tests/onchain_quote_integration.rs

**Modified files:**
- common/src/integrations/mod.rs (added onchain_quote module)
- common/Cargo.toml (added rust_decimal, hex-literal, dashmap, tracing dependencies)
- Cargo.toml (added bincode workspace dependency)
