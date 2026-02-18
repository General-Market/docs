# Story 2.4: Index.sol - Batch & Fill Confirmation

Status: done

## Story

As an **issuer**,
I want **to confirm order batches and fills via BLS signatures**,
So that **users receive their ITP tokens after trades execute**.

## Acceptance Criteria

1. `confirmBatch(cycleNumber, orderIds[], blsSignature)` marks orders as batched
2. `confirmFills(cycleNumber, fills[], blsSignature)` processes fills
3. fills include: orderId, fillPrice, fillAmount
4. BLS signature verified against aggregated public key (mock for Phase 1)
5. cycle number prevents replay (cycleProcessed mapping)
6. TradeRequest event emitted for AP to read
7. FillConfirmed event emitted per fill
8. ITP tokens minted to user based on fill
9. Foundry tests cover happy path and replay protection

## Tasks / Subtasks

- [x] Task 1: Implement confirmBatch function (AC: 1, 4, 5, 6)
  - [x] 1.1 Add cycleProcessed mapping to IndexStorage.sol for replay protection
  - [x] 1.2 Build message for BLS verification: keccak256(abi.encode(chainid, this, cycleNumber, orderIds))
  - [x] 1.3 Verify BLS signature against aggregatedPubkey from IssuerRegistry (mock bypass for Phase 1)
  - [x] 1.4 Loop through orderIds, validate each exists and is PENDING status
  - [x] 1.5 Mark each order as BATCHED status
  - [x] 1.6 Emit TradeRequest event per order for AP to read
  - [x] 1.7 Mark cycle as processed in cycleProcessed mapping
  - [x] 1.8 Emit BatchConfirmed event with cycleNumber, orderIds, blsSignature

- [x] Task 2: Implement confirmFills function (AC: 2, 3, 4, 7, 8)
  - [x] 2.1 Build message for BLS verification: keccak256(abi.encode(chainid, this, cycleNumber, fills))
  - [x] 2.2 Verify BLS signature (mock bypass for Phase 1)
  - [x] 2.3 Loop through fills, validate each order exists and is in BATCHED status
  - [x] 2.4 Validate fillAmount doesn't exceed order.amount
  - [x] 2.5 Mark order as FILLED status
  - [x] 2.6 For BUY orders: calculate shares = fillAmount * 1e18 / fillPrice
  - [x] 2.7 Update ITP totalSupply and totalValue
  - [x] 2.8 Mint ITP tokens to user if vault is set
  - [x] 2.9 For SELL orders: transfer USDC back to user, update ITP supply/value
  - [x] 2.10 Emit FillConfirmed event per fill

- [x] Task 3: Implement refundExpiredOrder function (bonus)
  - [x] 3.1 Validate order exists and is expired (deadline < block.timestamp)
  - [x] 3.2 Validate order is in PENDING or BATCHED status
  - [x] 3.3 Build message for BLS verification
  - [x] 3.4 Mark order as EXPIRED status
  - [x] 3.5 Transfer USDC back to user

- [x] Task 4: Add new error codes to ErrorsLib.sol
  - [x] 4.1 E019_CycleAlreadyProcessed(cycleNumber)
  - [x] 4.2 E020_InvalidBLSSignature()
  - [x] 4.3 E021_OrderAlreadyBatched(orderId)
  - [x] 4.4 E022_OrderNotFound(orderId)
  - [x] 4.5 E023_FillExceedsOrder(orderId, fillAmount, orderAmount)
  - [x] 4.6 E024_InvalidOrderStatus(orderId, currentStatus, requiredStatus)

- [x] Task 5: Write comprehensive Foundry tests (AC: 9)
  - [x] 5.1 Test confirmBatch happy path - orders marked BATCHED
  - [x] 5.2 Test confirmBatch emits TradeRequest and BatchConfirmed events
  - [x] 5.3 Test confirmBatch reverts on cycle already processed
  - [x] 5.4 Test confirmBatch reverts on order not found
  - [x] 5.5 Test confirmBatch reverts on order already batched
  - [x] 5.6 Test confirmBatch with multiple orders in same cycle
  - [x] 5.7 Test confirmBatch with empty orderIds array
  - [x] 5.8 Test confirmFills happy path - order marked FILLED, ITP supply updated
  - [x] 5.9 Test confirmFills emits FillConfirmed event
  - [x] 5.10 Test confirmFills reverts on order not found
  - [x] 5.11 Test confirmFills reverts on order not batched
  - [x] 5.12 Test confirmFills reverts on fill exceeds order
  - [x] 5.13 Test confirmFills with multiple fills
  - [x] 5.14 Test confirmFills partial fill
  - [x] 5.15 Test confirmFills with different fill prices
  - [x] 5.16 Test refundExpiredOrder happy path
  - [x] 5.17 Test refundExpiredOrder reverts if not expired
  - [x] 5.18 Test refundExpiredOrder reverts on order not found
  - [x] 5.19 Test refundExpiredOrder reverts if already filled
  - [x] 5.20 Test refundExpiredOrder batched order can be refunded
  - [x] 5.21 Fuzz test confirmBatch with valid cycle numbers
  - [x] 5.22 Fuzz test confirmFills with valid fill amounts

## Dev Notes

### Architecture Compliance

**Contract Location:** `contracts/src/core/Index.sol`

**Pattern:** UUPS Proxy (OpenZeppelin)
- All BLS-signed functions require aggregated public key verification
- Phase 1 uses mock BLS verification (skip if issuerRegistry not set or pubkey empty)
- Cycle number used as replay protection (cycleProcessed mapping)

**Storage Design (from IndexStorage.sol):**
```solidity
// Cycle replay protection
mapping(uint256 => bool) public cycleProcessed;

// IssuerRegistry reference for BLS pubkey
IIssuerRegistry public issuerRegistry;

// ITP vault addresses for minting
mapping(bytes32 => address) public itpVaults;
```

### Technical Requirements

**BLS Message Format:**
```solidity
// confirmBatch message
bytes32 message = keccak256(abi.encode(block.chainid, address(this), cycleNumber, orderIds));

// confirmFills message
bytes32 message = keccak256(abi.encode(block.chainid, address(this), cycleNumber, fills));

// refundExpiredOrder message
bytes32 message = keccak256(abi.encode(block.chainid, address(this), "refund", orderId));
```

**Fill Struct (from TypesLib.sol):**
```solidity
struct Fill {
    uint256 orderId;
    uint256 fillPrice;
    uint256 fillAmount;
    uint256 cycleNumber;
    bytes32 txHash;
}
```

### Order Status Flow

```
PENDING → BATCHED → FILLED
    ↓         ↓
    └─────────┴───→ EXPIRED (if deadline passed)
```

### ITP Token Minting Calculation

For BUY orders:
```solidity
uint256 shares = (fill.fillAmount * 1e18) / fill.fillPrice;
itp.totalSupply += shares;
itp.totalValue += fill.fillAmount;
```

For SELL orders:
```solidity
uint256 sharesBurned = (fill.fillAmount * 1e18) / fill.fillPrice;
itp.totalSupply -= sharesBurned;
itp.totalValue -= fill.fillAmount;
// Transfer USDC back to user
usdc.safeTransfer(order.user, fill.fillAmount);
```

### Events Emitted

**On confirmBatch:**
- `TradeRequest(cycleNumber, pairId, side, amount, limitPrice)` - per order
- `BatchConfirmed(cycleNumber, orderIds[], blsSignature)`

**On confirmFills:**
- `FillConfirmed(orderId, cycleNumber, fillPrice, fillAmount)` - per fill

### SELL Order Limitation

SELL orders are currently blocked with `E033_SellOrdersNotSupported()`. SELL orders require escrowing ITP tokens (not USDC) which requires ITP vault integration. The `confirmFills` function for SELL orders is implemented but cannot be triggered until SELL order submission is enabled.

### Project Structure Notes

**Files modified/created:**
- `contracts/src/core/Index.sol` - Main implementation with confirmBatch, confirmFills, refundExpiredOrder
- `contracts/src/core/IndexStorage.sol` - Added cycleProcessed mapping, issuerRegistry, itpVaults
- `contracts/src/libraries/ErrorsLib.sol` - Added E019-E024 errors
- `contracts/test/IndexBatchFillConfirmation.t.sol` - Comprehensive test suite

**Dependencies:**
- Story 2.2 (Index.sol Storage & ITP Creation) - for ITP existence and storage
- Story 2.3 (Index.sol Order Submission) - for orders mapping and submitOrder
- Story 2.6 (BLS Library Solidity) - for BLSLib.verifyBLS (mock for Phase 1)
- IssuerRegistry (Story 2.12) - for aggregatedPubkey (optional, can be null)

### Testing Standards

1. Use Foundry's `forge test` with verbose output
2. Test contract: `IndexBatchFillConfirmation.t.sol`
3. Use `vm.expectRevert()` for error testing
4. Use `vm.expectEmit()` for event testing
5. Use `vm.warp()` for time-dependent tests (deadline expiry)
6. Fuzz tests for cycle numbers and fill amounts

### References

- [Source: architecture.md#1-3-actors-roles] - Issuer ↔ AP communication model
- [Source: architecture.md#7-issuer-cycle] - Cycle phases and BLS signing
- [Source: architecture.md#appendix-a-flow-diagrams] - Order → Fill → Mint flow
- [Source: epics.md#story-24] - Original acceptance criteria
- [Source: contracts/src/interfaces/IIndex.sol] - confirmBatch, confirmFills interface
- [Source: contracts/src/libraries/TypesLib.sol:95-107] - Fill struct definition
- [Source: contracts/src/libraries/EventsLib.sol:33-68] - BatchConfirmed, FillConfirmed, TradeRequest events
- [Source: contracts/src/libraries/ErrorsLib.sol:106-134] - E019-E024 error codes

### Previous Story Intelligence (Story 2.2, 2.3)

From Story 2.2 (Index.sol Storage & ITP Creation):
- Index.sol inherits IndexStorage.sol for storage layout
- _itps mapping stores ITPCore data
- _itpExists mapping for ITP existence checks
- createITP validates weights and assets

From Story 2.3 (Index.sol Order Submission):
- orders mapping stores LimitOrder structs
- nextOrderId counter for order ID generation
- submitOrder validates all inputs and transfers USDC
- getOrder returns order by ID

### Git Intelligence

Recent commits show Stories 2.2 and 2.3 are complete:
- 2-2-index-storage-itp-creation.md status: done
- 2-3-index-order-submission.md status: review (all tests passing)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- No debug issues encountered; implementation was pre-existing and complete

### Completion Notes List

- ✅ All tasks (1-5) and subtasks verified complete
- ✅ All 24/25 tests passing (1 properly skipped for SELL order - not yet supported)
- ✅ Fixed test suite to properly skip `test_confirmFills_sellOrder` instead of failing
- ✅ Full regression suite passing (306 tests, 0 failures, 1 skip)
- ✅ Implementation satisfies all 9 Acceptance Criteria

### File List

**Implementation files:**
- `contracts/src/core/Index.sol` - confirmBatch, confirmFills, refundExpiredOrder implemented
- `contracts/src/core/IndexStorage.sol` - cycleProcessed, issuerRegistry, itpVaults added
- `contracts/src/libraries/ErrorsLib.sol` - E019-E024 errors added, plus E034-E037 from code review
- `contracts/src/libraries/EventsLib.sol` - OrderRefunded event added from code review
- `contracts/src/libraries/BLSLib.sol` - verifyBLS function (mock for Phase 1)

**Test files:**
- `contracts/test/IndexBatchFillConfirmation.t.sol` - 27 tests (26 passing, 1 skipped)

**Modified during code review (2026-01-30):**
- `contracts/src/core/Index.sol` - Added MIN_SHARES constant, _verifyBLSSignature(), partial fill refund, cycle validation
- `contracts/src/libraries/ErrorsLib.sol` - Added E034_OrderNotYetExpired, E035_IssuerRegistryNotSet, E036_FillCycleMismatch, E037_ZeroSharesCalculated
- `contracts/src/libraries/EventsLib.sol` - Added OrderRefunded event
- `contracts/test/IndexBatchFillConfirmation.t.sol` - Added 2 new tests, updated 3 existing tests

## Change Log

- 2026-01-30: Story validated and marked for review. Fixed test to properly skip instead of fail for SELL orders (E033_SellOrdersNotSupported is expected). All 24 tests pass, 306 tests pass in full suite.
- 2026-01-30: **Code Review Fixes Applied** - Resolved 3 HIGH and 4 MEDIUM issues:
  - H-1: Added shared `_verifyBLSSignature()` internal function with security comments about production requirements
  - H-2: Added partial fill remainder refund - USDC now returned to user when fillAmount < order.amount
  - H-3: Added MIN_SHARES constant (1e12) and E037_ZeroSharesCalculated error to prevent dust attacks
  - M-1: BLS verification now uses consistent pattern across all three functions
  - M-2: Added fill.cycleNumber validation with E036_FillCycleMismatch error
  - M-3: Replaced confusing E009_OrderExpired with new E034_OrderNotYetExpired for non-expired refund attempts
  - M-4: Added OrderRefunded event emission in refundExpiredOrder
  - Added 2 new tests: test_confirmFills_revertsOnCycleMismatch, test_confirmFills_revertsOnZeroShares
  - Updated test_confirmFills_partialFill to verify remainder refund
  - Updated test_refundExpiredOrder_happyPath to verify OrderRefunded event
  - All 26 tests pass (1 skipped), 315 full suite tests pass

## Test Results

```
26 tests passing, 1 skipped (SELL orders not yet supported)
- confirmBatch: 7 tests passing
- confirmFills: 9 tests passing (including 2 new validation tests)
- refundExpiredOrder: 6 tests passing
- fuzz tests: 2 passing
- SKIP: test_confirmFills_sellOrder (E033_SellOrdersNotSupported - by design)

Full Suite: 315 passed, 0 failed, 1 skipped
```
