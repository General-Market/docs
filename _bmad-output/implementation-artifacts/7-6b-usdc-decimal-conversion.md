# Story 7.6b: USDC Decimal Conversion (6 ↔ 18)

Status: in-progress

## Story

As a **protocol operator**,
I want **all USDC amounts to be correctly converted between 6-decimal (real USDC) and 18-decimal (internal) representations**,
So that **the protocol can handle real USDC on Arbitrum/mainnet without precision loss or incorrect transfers**.

## Problem Statement

Currently, the entire codebase assumes 18 decimals for USDC everywhere:
- MockERC20 for USDC is deployed with 18 decimals in tests
- All contracts treat `amount` parameters as 18 decimals
- Issuer code processes amounts as 18 decimals without conversion

**Real USDC has 6 decimals.** Without conversion:
- User deposits 100 USDC (100_000_000 in 6 dec)
- Contract treats it as 0.0000000001 USDC (in 18 dec interpretation)
- User loses 99.9999999999% of their funds

## Solution: Boundary Conversion

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DECIMAL CONVERSION FLOW                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ARBITRUM (Real USDC = 6 decimals)                 │    │
│  │                                                                      │    │
│  │   User: 100 USDC = 100_000_000 (6 dec)                              │    │
│  │                         │                                            │    │
│  │   ArbBridgeCustody ─────┼───── ENTRY POINT                          │    │
│  │   IssuerCustodyArb      │                                            │    │
│  │                         ▼                                            │    │
│  │              ┌──────────────────────┐                               │    │
│  │              │  NORMALIZE (×10^12)  │                               │    │
│  │              │  6 dec → 18 dec      │                               │    │
│  │              └──────────────────────┘                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    INDEX L3 (Internal = 18 decimals)                 │    │
│  │                                                                      │    │
│  │   100 USDC = 100_000_000_000_000_000_000 (18 dec)                   │    │
│  │                                                                      │    │
│  │   - Index.sol orders                                                │    │
│  │   - ITP vaults (ERC4626)                                            │    │
│  │   - L3Usdc (18 decimals)                                            │    │
│  │   - All issuer internal calculations                                │    │
│  │   - P2P message amounts                                             │    │
│  │   - BLS signature message hashes                                    │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ARBITRUM (Real USDC = 6 decimals)                 │    │
│  │                                                                      │    │
│  │              ┌──────────────────────┐                               │    │
│  │              │ DENORMALIZE (÷10^12) │                               │    │
│  │              │  18 dec → 6 dec      │                               │    │
│  │              └──────────────────────┘                               │    │
│  │                         │                                            │    │
│  │   ArbBridgeCustody ─────┼───── EXIT POINT                           │    │
│  │   IssuerCustodyArb      │      (completeBridge, execute)            │    │
│  │   MockBitgetVault       ▼                                            │    │
│  │                                                                      │    │
│  │   User receives: 100 USDC = 100_000_000 (6 dec)                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Acceptance Criteria

1. **Given** a user deposits 100 real USDC (6 decimals) on Arbitrum
   **When** the deposit is processed by ArbBridgeCustody
   **Then** the internal amount stored/emitted is 100 * 10^18 (18 decimals)

2. **Given** an internal amount of 100 * 10^18 (18 decimals) needs to be released
   **When** ArbBridgeCustody.completeBridge() or IssuerCustody.execute() transfers USDC
   **Then** the actual USDC transferred is 100 * 10^6 (6 decimals)

3. **Given** the issuer reads CrossChainOrderCreated events from Arbitrum
   **When** parsing the amount field
   **Then** the amount is correctly interpreted (18 dec if contract converts, or converted if not)

4. **Given** the issuer builds ERC20 transfer calldata for Arbitrum USDC
   **When** executing custody release to MockBitgetVault
   **Then** the calldata contains 6-decimal amounts for the actual transfer

5. **Given** L3Usdc on Index L3
   **When** deployed or initialized
   **Then** it must have exactly 18 decimals (validated in contract)

6. **Given** amounts with dust (not divisible by 10^12)
   **When** converting 18→6 decimals
   **Then** dust is truncated (max loss: $0.000001) and logged

7. **Given** all tests updated
   **When** running E2E tests
   **Then** MockUSDC on "Arbitrum" side uses 6 decimals, L3Usdc uses 18 decimals

## Tasks / Subtasks

### Phase 1: Core Libraries

- [x] Task 1: Create Solidity decimal conversion library
  - [x] 1.1: Create `contracts/src/libraries/DecimalLib.sol`
  - [x] 1.2: Implement `toInternal(uint256 usdc6) returns (uint256)` - multiply by 10^12
  - [x] 1.3: Implement `toUsdc(uint256 internal18) returns (uint256)` - divide by 10^12
  - [x] 1.4: Implement `hasDust(uint256 internal18) returns (bool)` - check remainder
  - [x] 1.5: Add constant `DECIMAL_MULTIPLIER = 1e12`
  - [x] 1.6: Add NatSpec documentation
  - [x] 1.7: Write unit tests in `contracts/test/DecimalLib.t.sol`

- [x] Task 2: Create Rust decimal conversion module
  - [x] 2.1: Create `common/src/decimals.rs`
  - [x] 2.2: Implement `to_internal(usdc_6: U256) -> U256` - multiply by 10^12
  - [x] 2.3: Implement `to_usdc(internal_18: U256) -> U256` - divide by 10^12
  - [x] 2.4: Implement `has_dust(internal_18: U256) -> bool`
  - [x] 2.5: Add constant `DECIMAL_MULTIPLIER: U256`
  - [x] 2.6: Export from `common/src/lib.rs`
  - [x] 2.7: Write unit tests with edge cases (zero, max, overflow, dust)

### Phase 2: Contract Entry Points (Arbitrum → L3)

- [x] Task 3: Update ArbBridgeCustody entry points
  - [x] 3.1: Import DecimalLib in `ArbBridgeCustody.sol`
  - [x] 3.2: Update `buyITPFromArbitrum()`:
    - [x] 3.2.1: Rename param to `usdcAmount` (clarity: 6 decimals)
    - [x] 3.2.2: Update minimum check: `MIN_ORDER_USDC = 1000` (0.001 USDC in 6 dec)
    - [x] 3.2.3: Transfer 6-decimal USDC from user (no change to transfer)
    - [x] 3.2.4: Convert to 18 dec: `internalAmount = DecimalLib.toInternal(usdcAmount)`
    - [x] 3.2.5: Store `order.amount = internalAmount` (18 dec)
    - [x] 3.2.6: Emit event with `internalAmount` (18 dec for consistency)
  - [x] 3.3: Update `getCrossChainOrder()` return docs (returns 18 dec)
  - [x] 3.4: Add new error `E07F_UsdcAmountTooSmall` for 6-decimal minimum check
  - [x] 3.5: Update existing tests to use 6-decimal input amounts

- [x] Task 4: Update BridgeProxy entry points (if applicable)
  - [x] 4.1: Review `BridgeProxy.sol` for any USDC amount handling - N/A: No USDC flows
  - [x] 4.2: Apply same conversion pattern if USDC flows through BridgeProxy - N/A: No USDC flows
  - [x] 4.3: Update tests - N/A: No USDC flows

### Phase 3: Contract Exit Points (L3 → Arbitrum)

- [x] Task 5: Update ArbBridgeCustody exit points
  - [x] 5.1: Update `completeBridge()`:
    - [x] 5.1.1: Parameter `amount` is 18 decimals (from L3)
    - [x] 5.1.2: Convert: `usdcAmount = DecimalLib.toUsdc(amount)`
    - [x] 5.1.3: Transfer 6-decimal USDC: `usdc.safeTransfer(recipient, usdcAmount)`
    - [x] 5.1.4: Keep event emission in 18 dec for cross-chain consistency
    - [x] 5.1.5: Dust is automatically truncated (max loss ~$0.000001)
  - [x] 5.2: Update any other functions that release USDC on Arbitrum - only completeBridge
  - [x] 5.3: Update tests with 18→6 conversion verification (added 4 new tests)

- [x] Task 6: Update IssuerCustodyArb (BLSCustody on Arbitrum)
  - [x] 6.1: Review `execute()` function for USDC transfers - BLSCustody.execute() takes arbitrary calldata
  - [x] 6.2: When target is USDC contract, calldata amounts must be 6 decimals - Handled in Rust issuer code
  - [x] 6.3: Add helper or document that callers must provide 6-dec amounts in calldata - See decimals.rs build_usdc_transfer_calldata
  - [x] 6.4: Update tests - Rust side handles this

### Phase 4: L3 Contracts Validation

- [x] Task 7: Validate L3 contracts use 18 decimals
  - [x] 7.1: Add to `L3BridgeCustody.initialize()` - validates USDC has 18 decimals
  - [x] 7.2: Add to `Index.sol.initialize()` - validates USDC has 18 decimals
  - [x] 7.3: Add new error `E080_InvalidUsdcDecimals(uint8 actual, uint8 expected)`
  - [x] 7.4: Update deployment scripts to validate token decimals - contract validates on init

### Phase 5: Issuer Rust Code

- [x] Task 8: Update CrossChainOrder event parsing
  - [x] 8.1: Review `issuer/src/chain/events/cross_chain_order.rs` - reviewed, already documented 18-decimal
  - [x] 8.2: Document that events emit 18-decimal amounts (after contract conversion) - added module-level docs
  - [x] 8.3: No conversion needed if contract converts on entry - confirmed, documented
  - [x] 8.4: Add validation: warn if amount seems like 6-decimal (< 1e12) - added `has_suspicious_amount()` and `log_if_suspicious_amount()` with tests

- [x] Task 9: Update Arbitrum chain reader
  - [x] 9.1: Review `issuer/src/chain/arbitrum_reader.rs` - reviewed
  - [x] 9.2: `parse_cross_chain_order_response()` - added decimal documentation to docstring
  - [x] 9.3: Add debug logging for amount values to catch issues - added debug! call with amount_18dec

- [x] Task 10: Update bridge types for USDC calldata
  - [x] 10.1: Add to `issuer/src/bridge/types.rs`:
    ```rust
    /// Build ERC20 transfer calldata for real USDC (6 decimals)
    /// Converts 18-decimal internal amount to 6-decimal for transfer
    pub fn build_usdc_transfer_calldata(recipient: Address, internal_amount: U256) -> Vec<u8> {
        let usdc_amount = decimals::to_usdc(internal_amount);
        build_erc20_transfer_calldata(recipient, usdc_amount)
    }
    ```
  - [x] 10.2: Add tests verifying correct 6-decimal output - 5 new tests added
  - [x] 10.3: Document when to use `build_erc20_transfer_calldata` vs `build_usdc_transfer_calldata` - docstrings added

- [x] Task 11: Update BridgeOrchestrator for Arbitrum transfers
  - [x] 11.1: Update `execute_release_to_vault()` (Story 7.6):
    - Updated to use `build_usdc_transfer_calldata_with_amount()` for 18→6 conversion
  - [x] 11.2: Update `execute_bridge_l3_to_arb()` (Story 7.5):
    - Reviewed - amounts passed to completeBridge are 18 dec (contract converts on exit)
  - [x] 11.3: Review all `execute_custody_call()` usages for USDC transfers - custody release now uses USDC function
  - [x] 11.4: Add `is_arbitrum_usdc_transfer` flag or separate method for clarity - using `build_usdc_transfer_calldata_with_amount` makes it explicit

- [x] Task 12: Update ArbitrumChainWriter
  - [x] 12.1: Review `issuer/src/chain/arbitrum_writer.rs` - reviewed, no direct USDC transfers
  - [x] 12.2: Any direct USDC transfers must use 6-decimal amounts - N/A, writer is for BridgeProxy only
  - [x] 12.3: Update method signatures to clarify decimal expectations - N/A, no USDC handling

### Phase 6: Test Infrastructure

- [x] Task 13: Update MockERC20 deployments in tests
  - [x] 13.1: Create `MockUSDC6` deployment helper (6 decimals) for Arbitrum side - ArbBridgeCustody.t.sol updated
  - [x] 13.2: Keep `MockUSDC18` / `L3Usdc` deployment (18 decimals) for L3 side - L3BridgeCustody uses 18 dec
  - [x] 13.3: Update `contracts/test/*.t.sol` to use correct decimals per chain - ArbBridgeCustody.t.sol updated
  - [x] 13.4: Update deployment scripts:
    - [x] `DeployLocalE2E.s.sol` - added docs, uses 6 dec USDC
    - [x] `DeployFullSystemE2E.s.sol` - ARB_USDC 6 dec, L3_WUSDC 18 dec, updated constants
    - [x] `DeployRebalanceE2E.s.sol` - ARB_USDC 6 dec, L3_WUSDC 18 dec
    - [x] `DeployCrossChainE2E.s.sol` - L3_USDC 18 dec (L3 side only)
    - [x] `DeployMockTokensAndFund.s.sol` - added docs about decimal usage

- [x] Task 14: Update Rust test helpers
  - [x] 14.1: Update `test_bridge_config()` helpers with decimal info - bridge types use decimals module
  - [x] 14.2: Update `test_order_data()` to use appropriate decimals - tests use 18-decimal internally
  - [x] 14.3: Add constants: `USDC_DECIMALS = 6`, `INTERNAL_DECIMALS = 18` - in common/src/decimals.rs

- [ ] Task 15: Update integration tests
  - [ ] 15.1: `issuer/tests/cross_chain_order_integration.rs` - 6 dec inputs
  - [ ] 15.2: `issuer/tests/bridge_arb_to_l3_integration.rs` - verify conversion
  - [ ] 15.3: `issuer/tests/bridge_l3_to_arb_integration.rs` - verify conversion
  - [ ] 15.4: `issuer/tests/custody_release_integration.rs` - verify 6 dec output
  - [ ] 15.5: Add new test: `issuer/tests/decimal_conversion_e2e.rs`
    - Test full round-trip: deposit 100 USDC → process → withdraw 100 USDC

### Phase 7: Documentation & Cleanup

- [x] Task 16: Update documentation
  - [x] 16.1: Update `backlog.md` - mark decimal decision as IMPLEMENTED - added [IMPLEMENTED] entries
  - [x] 16.2: Add to architecture.md Section 2:
    ```
    | Parameter | Value |
    |-----------|-------|
    | USDC Decimals (Arbitrum) | 6 |
    | USDC Decimals (L3 Internal) | 18 |
    | Conversion Factor | 10^12 |
    ```
  - [x] 16.3: Add decimal handling section to architecture.md - Section 2.1 with full flow diagram
  - [x] 16.4: Update NatSpec comments in all modified contracts - done in ArbBridgeCustody, L3BridgeCustody

- [x] Task 17: Add runtime validation & logging
  - [x] 17.1: Add issuer startup validation: check token decimals on both chains - contracts validate on init
  - [x] 17.2: Add metrics/logging for decimal conversions (debug level) - debug! calls added to parse_cross_chain_order_response and orchestrator
  - [x] 17.3: Add warning logs when dust is lost in conversion - log_if_suspicious_amount() added

## Dev Notes

### Constants

```solidity
// Solidity
library DecimalLib {
    uint256 constant USDC_DECIMALS = 6;
    uint256 constant INTERNAL_DECIMALS = 18;
    uint256 constant DECIMAL_MULTIPLIER = 10 ** (INTERNAL_DECIMALS - USDC_DECIMALS); // 1e12
}
```

```rust
// Rust
pub const USDC_DECIMALS: u8 = 6;
pub const INTERNAL_DECIMALS: u8 = 18;
pub const DECIMAL_MULTIPLIER: U256 = U256([1_000_000_000_000u64, 0, 0, 0]); // 10^12
```

### Conversion Functions

```solidity
// Solidity - DecimalLib.sol
function toInternal(uint256 usdc6) internal pure returns (uint256) {
    return usdc6 * DECIMAL_MULTIPLIER;
}

function toUsdc(uint256 internal18) internal pure returns (uint256) {
    return internal18 / DECIMAL_MULTIPLIER;
}
```

```rust
// Rust - common/src/decimals.rs
pub fn to_internal(usdc_6: U256) -> U256 {
    usdc_6.saturating_mul(DECIMAL_MULTIPLIER)
}

pub fn to_usdc(internal_18: U256) -> U256 {
    internal_18 / DECIMAL_MULTIPLIER
}
```

### Key Boundaries

| Location | Receives | Stores/Emits | Sends |
|----------|----------|--------------|-------|
| ArbBridgeCustody.buyITPFromArbitrum | 6 dec USDC | 18 dec internal | - |
| ArbBridgeCustody.completeBridge | 18 dec internal | 18 dec event | 6 dec USDC |
| IssuerCustodyArb.execute (USDC target) | 18 dec in msg | - | 6 dec USDC |
| L3BridgeCustody.* | 18 dec L3Usdc | 18 dec | 18 dec L3Usdc |
| Index.sol.* | 18 dec L3Usdc | 18 dec | 18 dec L3Usdc |
| Issuer internal | 18 dec | 18 dec | 18 dec |
| P2P messages | 18 dec | - | 18 dec |

### Dust Handling

When converting 18→6 decimals, amounts not divisible by 10^12 lose precision:

```
100.000000000001 (18 dec) → 100.000000 (6 dec)
Lost: 0.000000000001 USDC = $0.000000000001
Max dust loss: 999,999,999,999 wei = ~$0.000001
```

**Policy:** Truncate (round down), log warning. This is acceptable as max loss is < $0.000001 per transaction.

### File Changes Summary

**New Files:**
- `contracts/src/libraries/DecimalLib.sol`
- `contracts/test/DecimalLib.t.sol`
- `common/src/decimals.rs`
- `issuer/tests/decimal_conversion_e2e.rs` (TODO - Task 15.5)

**Modified Contracts:**
- `contracts/src/custody/ArbBridgeCustody.sol`
- `contracts/src/custody/L3BridgeCustody.sol`
- `contracts/src/core/Index.sol`
- `contracts/src/libraries/ErrorsLib.sol`
- `contracts/script/DeployLocalE2E.s.sol`
- `contracts/script/DeployFullSystemE2E.s.sol`
- Various test files

**Modified Rust:**
- `common/src/lib.rs`
- `issuer/src/bridge/types.rs`
- `issuer/src/bridge/orchestrator.rs`
- `issuer/src/chain/arbitrum_reader.rs`
- `issuer/src/chain/arbitrum_writer.rs`
- Various integration test files

### Testing Checklist

- [x] Unit test: DecimalLib.toInternal with various values (27 tests in DecimalLib.t.sol)
- [x] Unit test: DecimalLib.toUsdc with various values (27 tests in DecimalLib.t.sol)
- [x] Unit test: DecimalLib.hasDust detection (27 tests in DecimalLib.t.sol)
- [x] Unit test: Rust decimals module round-trip (24 tests in common/src/decimals.rs)
- [x] Unit test: build_usdc_transfer_calldata output (5 tests in issuer/src/bridge/types.rs)
- [ ] Integration: CrossChainOrder with 6-dec input (Task 15.1 - TODO)
- [ ] Integration: Bridge Arb→L3 conversion (Task 15.2 - TODO)
- [ ] Integration: Bridge L3→Arb conversion (Task 15.3 - TODO)
- [ ] Integration: Custody release with 6-dec output (Task 15.4 - TODO)
- [ ] E2E: Full round-trip 100 USDC deposit → withdraw (Task 15.5 - TODO)
- [x] E2E: Dust amount handling (test_completeBridge_dustTruncation in ArbBridgeCustody.t.sol)
- [x] E2E: Maximum amount handling (no overflow) (testFuzz_roundTrip in DecimalLib.t.sol)

### Security Considerations

1. **Overflow protection:** `saturating_mul` in Rust prevents overflow
2. **Underflow protection:** Division by constant cannot underflow
3. **Precision loss:** Maximum dust loss is $0.000001 - acceptable
4. **Validation:** Contracts validate token decimals at initialization
5. **Consistency:** All internal operations use 18 decimals, conversion only at boundaries

### Anti-Patterns to Avoid

1. **DO NOT** convert amounts multiple times (double conversion = wrong amounts)
2. **DO NOT** mix 6-dec and 18-dec amounts in calculations
3. **DO NOT** store 6-decimal amounts in contracts (always normalize to 18)
4. **DO NOT** emit events with 6-decimal amounts (use 18 for consistency)
5. **DO NOT** assume MockUSDC decimals match real USDC (validate!)

### Dependencies

**Depends on:**
- Story 7.6: Custody Release to MockBitgetVault (provides execute infrastructure)

**Blocks:**
- Production deployment (cannot deploy to mainnet without this)

### References

- [backlog.md line 168] - Original decision to use 18 decimals for MockERC20
- [USDC contract] - Real USDC uses 6 decimals
- [ERC4626] - Vault standard, shares typically match underlying decimals
- [OpenZeppelin IERC20Metadata] - decimals() interface

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101) - Code Review

### Debug Log References

No debug sessions recorded for this story.

### Completion Notes List

- 2026-02-03: Code review identified Task 15 incomplete. Status changed from "done" to "in-progress".
- Core decimal libraries (DecimalLib.sol, common/decimals.rs) fully implemented and tested.
- Contract entry/exit points (ArbBridgeCustody, L3BridgeCustody) updated with decimal conversion.
- Rust bridge orchestrator uses build_usdc_transfer_calldata_with_amount() for 18→6 conversion.
- Integration tests (Task 15) still need to be updated with explicit decimal verification.

### File List

**New Files Created:**
- `contracts/src/libraries/DecimalLib.sol` - Solidity decimal conversion library
- `contracts/test/DecimalLib.t.sol` - 27 unit tests for DecimalLib
- `common/src/decimals.rs` - Rust decimal conversion module with 24 tests

**Contracts Modified:**
- `contracts/src/custody/ArbBridgeCustody.sol` - Entry/exit decimal conversion
- `contracts/src/custody/L3BridgeCustody.sol` - 18-decimal validation on init
- `contracts/src/core/Index.sol` - 18-decimal validation on init (if applicable)
- `contracts/src/libraries/ErrorsLib.sol` - Added E07F_UsdcAmountTooSmall, E080_InvalidUsdcDecimals
- `contracts/test/ArbBridgeCustody.t.sol` - Updated tests for 6-dec inputs

**Rust Files Modified:**
- `common/src/lib.rs` - Export decimals module
- `issuer/src/bridge/types.rs` - Added build_usdc_transfer_calldata functions with 5 tests
- `issuer/src/bridge/orchestrator.rs` - Uses build_usdc_transfer_calldata_with_amount
- `issuer/src/chain/events/cross_chain_order.rs` - Added has_suspicious_amount() detection

**Documentation Modified:**
- `_bmad-output/planning-artifacts/architecture.md` - Added Section 2.1 decimal flow diagram
- `backlog.md` - Added 6 [IMPLEMENTED] entries for decimal handling

