# Story 5.1: Bitget API Client - Order Placement

Status: done

## Story

As an **AP (Authorized Participant)**,
I want **to place orders on Bitget programmatically via authenticated API calls**,
so that **user orders from the Index L3 chain can be executed on the centralized exchange**.

## Acceptance Criteria

1. **Given** valid Bitget API credentials (api_key, api_secret, passphrase)
   **When** I call `authenticate(apiKey, apiSecret, passphrase)`
   **Then** the client stores credentials and is ready for authenticated requests

2. **Given** an authenticated client
   **When** I call `place_limit_order(pair, side, amount, price)`
   **Then** the method places a limit order on Bitget and returns the Bitget order ID on success

3. **Given** a limit order request
   **When** the request is sent to Bitget
   **Then** the request is signed per Bitget specification (HMAC-SHA256) with correct headers

4. **Given** an API error response from Bitget
   **When** the error occurs
   **Then** the client handles it with appropriate typed error variants (RateLimited, InvalidCredentials, InsufficientBalance, etc.)

5. **Given** Bitget's testnet and mainnet endpoints
   **When** I configure the client
   **Then** the client supports both testnet (`https://api.bitget.com/api/spot/v1`) and mainnet endpoints via configuration

6. **Given** an integration test
   **When** running against Bitget testnet (manual run)
   **Then** the test demonstrates successful order placement and retrieval

7. **Given** unit tests
   **When** testing with mocked HTTP responses
   **Then** all tests pass covering authentication, order placement, and error handling

## Tasks / Subtasks

- [x] Task 1: Create Bitget client module structure (AC: #1, #5)
  - [x] Create `external/bitget/mod.rs` module
  - [x] Define `BitgetClient` struct with credentials storage
  - [x] Implement `BitgetConfig` for testnet/mainnet configuration
  - [x] Add endpoint constants for testnet and mainnet URLs

- [x] Task 2: Implement HMAC-SHA256 request signing (AC: #3)
  - [x] Implement signature generation per Bitget API specification
  - [x] Handle timestamp generation (milliseconds)
  - [x] Build signature base string: `timestamp + method + requestPath + body`
  - [x] Add required headers: `ACCESS-KEY`, `ACCESS-SIGN`, `ACCESS-TIMESTAMP`, `ACCESS-PASSPHRASE`

- [x] Task 3: Implement authentication and client initialization (AC: #1)
  - [x] Implement `BitgetClient::new(config)` constructor
  - [x] Implement `authenticate(api_key, api_secret, passphrase)` method
  - [x] Store credentials securely (no logging of secrets)
  - [x] Validate credentials format before storage

- [x] Task 4: Implement limit order placement (AC: #2)
  - [x] Implement `place_limit_order(pair, side, amount, price)` method
  - [x] Map internal pair format to Bitget symbol format (e.g., "BTC/USDC" → "BTCUSDC")
  - [x] Map side enum to Bitget side string ("buy"/"sell")
  - [x] Parse order response and extract order ID
  - [x] Handle partial fills (return order ID for monitoring)

- [x] Task 5: Implement error handling (AC: #4)
  - [x] Define `BitgetError` enum with variants:
    - `RateLimited { retry_after_ms: u64 }`
    - `InvalidCredentials`
    - `InsufficientBalance { asset: String, required: Decimal, available: Decimal }`
    - `InvalidSymbol { symbol: String }`
    - `OrderRejected { code: String, message: String }`
    - `NetworkError { source: reqwest::Error }`
    - `ApiError { code: i32, message: String }`
  - [x] Map Bitget API error codes to typed errors
  - [x] Implement `Display` and `Error` traits

- [x] Task 6: Write unit tests with mocked responses (AC: #7)
  - [x] Test signature generation with known test vectors
  - [x] Test order placement with mock success response
  - [x] Test error handling for each error variant
  - [x] Test header construction correctness
  - [x] Use `mockito` or `wiremock` for HTTP mocking

- [x] Task 7: Write integration test for testnet (AC: #6)
  - [x] Create `tests/bitget_integration.rs` with `#[ignore]` attribute
  - [x] Test order placement on Bitget testnet
  - [x] Document manual test execution steps in comments
  - [x] Add environment variable support for credentials

## Dev Notes

### Architecture Compliance

**From architecture.md Section 3 (Actors & Roles):**
- AP reads TradeRequest events from blockchain and executes on Bitget
- AP has trade access on Bitget (order placement)
- Issuers have read-only Bitget API access (separate from this story - Story 5.2)

**From architecture.md Section 4 (Technology Stack):**
- Off-chain services implemented in Rust
- AP/Keeper is Rust service

**From architecture.md Section 16 (AP Accountability):**
- All orders are limit orders - AP must place limit orders at order.limitPrice
- Limit tolerance: 0.1% (accept fills slightly worse than limit)
- Violations logged for review

### Technical Requirements

**Bitget API Specifics:**
- Base URL (testnet): `https://api.bitget.com/api/spot/v1`
- Base URL (mainnet): `https://api.bitget.com/api/spot/v1`
- Authentication: HMAC-SHA256 signature
- Rate limit: 10 orders/second (NFR4 from PRD)

**Request Signing Algorithm:**
```
timestamp = current_time_ms()
pre_hash = timestamp + method + requestPath + body
signature = HMAC_SHA256(secret_key, pre_hash)
signature_b64 = base64_encode(signature)

Headers:
  ACCESS-KEY: api_key
  ACCESS-SIGN: signature_b64
  ACCESS-TIMESTAMP: timestamp
  ACCESS-PASSPHRASE: passphrase
  Content-Type: application/json
```

**Order Placement Endpoint:**
```
POST /api/spot/v1/trade/orders
{
  "symbol": "BTCUSDC",
  "side": "buy",
  "orderType": "limit",
  "price": "42000.50",
  "size": "0.001",
  "force": "gtc"
}
```

**Response Format:**
```json
{
  "code": "00000",
  "msg": "success",
  "data": {
    "orderId": "1234567890",
    "clientOrderId": "optional_client_id"
  }
}
```

### Dependencies

- `reqwest` - HTTP client with async support
- `hmac` + `sha2` - HMAC-SHA256 signature generation
- `base64` - Signature encoding
- `serde` + `serde_json` - Request/response serialization
- `rust_decimal` - Precise decimal arithmetic for prices/amounts
- `thiserror` - Error type derivation
- `tokio` - Async runtime (already in common)

### File Structure

```
services/external/
├── mod.rs                    # External integrations module
├── bitget/
│   ├── mod.rs               # Bitget client module
│   ├── client.rs            # BitgetClient implementation
│   ├── auth.rs              # Authentication and signing
│   ├── types.rs             # Request/response types
│   └── error.rs             # BitgetError types
```

### Testing Standards

**Unit Tests:**
- Use `mockito` or `wiremock` for HTTP mocking
- Test signature generation with known test vectors from Bitget docs
- Test all error code mappings
- No network calls in unit tests

**Integration Tests:**
- Mark with `#[ignore]` for manual execution
- Use environment variables for credentials: `BITGET_API_KEY`, `BITGET_API_SECRET`, `BITGET_PASSPHRASE`
- Only run on testnet
- Clean up orders after test

### Project Structure Notes

- This module lives in `services/external/bitget/` following the established pattern
- Integrates with `APClient` trait from Epic 1 (Story 1.2)
- Will be used by Story 4.3 (Order Queue Manager) and Story 6.4 (Wire AP to Real Bitget)

### Security Considerations

- **NEVER log API secrets or passphrases**
- Store credentials via environment variables, not config files
- Validate API key format before making requests
- Use TLS for all API calls (HTTPS)
- Implement request timeout (30 seconds default)

### References

- [Source: architecture.md#3-actors--roles] - AP role and Bitget access
- [Source: architecture.md#4-technology-stack] - Rust for off-chain services
- [Source: architecture.md#16-security--recovery] - AP accountability
- [Source: epics.md#Story-5.1] - Bitget API Client - Order Placement
- [Bitget API Docs: https://www.bitget.com/api-doc/spot/trade/Place-Order]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Implementation completed without blocking issues.

### Completion Notes List

- **Task 1-5 Complete**: Implemented full Bitget API client in `ap/src/external/bitget/` module with:
  - `BitgetClient` struct with `authenticate()` and `place_limit_order()` methods
  - `BitgetConfig` supporting testnet/mainnet endpoints with configurable timeout
  - HMAC-SHA256 request signing per Bitget API spec
  - `BitgetCredentials` with secure handling (Debug impl redacts secrets)
  - Comprehensive `BitgetError` enum with typed variants for all common API errors
  - Error code mapping for Bitget-specific error codes

- **Task 6 Complete**: 34 unit tests passing covering:
  - Signature generation with deterministic test vectors
  - Order placement with mocked HTTP responses (using `wiremock`)
  - All error variants (rate limiting, invalid credentials, insufficient balance, invalid symbol, order rejected)
  - Header construction verification
  - Request/response serialization

- **Task 7 Complete**: Integration tests created in `ap/tests/bitget_integration.rs` with:
  - All tests marked `#[ignore]` for manual execution
  - Environment variable support for credentials (`BITGET_API_KEY`, `BITGET_API_SECRET`, `BITGET_PASSPHRASE`)
  - Comprehensive documentation on running tests against Bitget testnet
  - Tests for buy/sell orders, invalid symbols, and invalid credentials

- **Dependencies Added**: `reqwest`, `hmac`, `sha2`, `base64`, `rust_decimal` to AP Cargo.toml; `wiremock` as dev-dependency

### Change Log

- 2026-01-29: Story 5.1 implementation complete - Bitget API client for order placement
- 2026-01-29: Code review fixes applied (7 issues fixed: response logging, error info preservation, input validation, test coverage, documentation)

### File List

**New Files:**
- `ap/src/external/mod.rs` - External integrations module
- `ap/src/external/bitget/mod.rs` - Bitget module entry point
- `ap/src/external/bitget/client.rs` - BitgetClient implementation
- `ap/src/external/bitget/auth.rs` - Authentication and HMAC-SHA256 signing
- `ap/src/external/bitget/types.rs` - Request/response types (OrderSide, PlaceOrderRequest, etc.)
- `ap/src/external/bitget/error.rs` - BitgetError enum and error mapping
- `ap/src/external/bitget/tests.rs` - Mock HTTP tests using wiremock
- `ap/tests/bitget_integration.rs` - Integration tests for Bitget testnet

**Modified Files:**
- `ap/Cargo.toml` - Added dependencies for Bitget client
- `ap/src/lib.rs` - Added `external` module and re-exports

### Senior Developer Review (AI)

**Review Date:** 2026-01-29
**Reviewer:** Claude Opus 4.5

**Issues Found:** 4 HIGH, 3 MEDIUM, 2 LOW

**Fixes Applied:**
1. ✅ [HIGH] Response logging no longer leaks full API response - now logs only response length
2. ✅ [HIGH] InsufficientBalance error now preserves original message via new `InsufficientBalanceRaw` variant
3. ✅ [HIGH] Added input validation for amount/price - must be positive
4. ✅ [HIGH] Added 4 tests for zero/negative amount and price edge cases
5. ✅ [MEDIUM] Fixed passphrase validation docs - clarified that passphrase only needs to be non-empty
6. ✅ [MEDIUM] Added `try_new()` fallible constructor, documented panic conditions on `new()`
7. ✅ [MEDIUM] Added timeout test using wiremock delay

**Issues Not Fixed (LOW - accepted):**
- Testnet/mainnet config comments are acceptable as-is
- Clone not implemented for BitgetClient - acceptable for single-owner pattern

**Verdict:** APPROVED after fixes
