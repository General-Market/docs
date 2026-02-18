# Story 8.12: Permissionless Liquidation Test

Status: done

## Story

As a **protocol user or external liquidator**,
I want **to independently perform the full liquidation flow (sync mirror registry, refresh oracle, liquidate) without depending on the curator bot**,
So that **the protocol has no single point of failure for liquidations and positions can always be unwound**.

## Acceptance Criteria

1. **Given** a MirrorIssuerRegistry that is stale (behind L3 IssuerRegistry)
   **When** an independent liquidator collects BLS-signed registry sync proofs from issuers via `GET /api/registry-sync`
   **Then** the liquidator can aggregate the proofs and call `mirrorRegistry.sync()` successfully
   **And** the mirror registry is now up to date

2. **Given** an ITPNAVOracle with a stale price
   **When** an independent liquidator collects BLS-signed NAV from issuers via `GET /api/nav-sign`
   **Then** the liquidator can aggregate signatures and call `oracle.updatePrice()` successfully
   **And** the oracle reflects the fresh price

3. **Given** an updated oracle showing a position with health factor < 1.0
   **When** the independent liquidator (not the curator) calls `morpho.liquidate()` with their own USDC
   **Then** the liquidation succeeds
   **And** the liquidator receives seized ITP + liquidation incentive
   **And** the liquidator can sell the ITP via BridgeProxy

4. **Given** local E2E test environment with 3 issuers running
   **When** a test script performs the full permissionless flow as a non-curator address:
   1. Sync mirror registry (if stale)
   2. Push fresh NAV to oracle
   3. Partial liquidate on Morpho
   4. Sell seized ITP via BridgeProxy
   **Then** every step succeeds without any curator involvement
   **And** the test proves no access control restricts these operations

5. **Given** both the curator bot and an independent liquidator attempt to liquidate the same position
   **When** the curator liquidates first
   **Then** the independent liquidator's subsequent call either succeeds (if position still unhealthy) or reverts gracefully (if position is now healthy)
   **And** no race condition causes fund loss

## Tasks / Subtasks

- [x] Task 1: Permissionless Mirror Registry Sync Test (AC: #1)
  - [x] 1.1 Create `contracts/test/MorphoPermissionlessLiquidation.t.sol` extending `MorphoTestHelper`
  - [x] 1.2 Deploy MirrorIssuerRegistry with initial state (nonce=1, 3 issuers)
  - [x] 1.3 Simulate registry state change on L3 (add issuer → nonce=2)
  - [x] 1.4 Test: non-curator address calls `mirrorRegistry.sync()` with mocked BLS signature → succeeds
  - [x] 1.5 Assert: registryNonce incremented, aggregatedPubkey updated, RegistrySynced event emitted

- [x] Task 2: Permissionless Oracle Price Push Test (AC: #2)
  - [x] 2.1 Test: non-curator address calls `oracle.updatePrice()` with valid BLS signature → succeeds
  - [x] 2.2 Test: pushed price with cycleNumber > lastCycleNumber → accepted
  - [x] 2.3 Test: pushed price with cycleNumber <= lastCycleNumber → reverts
  - [x] 2.4 Assert: currentPrice updated, lastUpdated refreshed, PriceUpdated event emitted

- [x] Task 3: Permissionless Liquidation Execution Test (AC: #3)
  - [x] 3.1 Set up borrower position: deposit ITP collateral, borrow USDC (health > 1.0)
  - [x] 3.2 Drop oracle price to make position unhealthy (health < 1.0)
  - [x] 3.3 Test: non-curator liquidator calls `morpho.liquidate()` with own USDC → succeeds
  - [x] 3.4 Assert: liquidator receives seized ITP (collateral_amount * incentive_factor)
  - [x] 3.5 Assert: borrower's debt reduced proportionally
  - [x] 3.6 Verify liquidation incentive ~7.41% (741 bps for LLTV=77%)

- [x] Task 4: Full Permissionless Flow E2E Test (AC: #4)
  - [x] 4.1 Create comprehensive test `test_fullPermissionlessFlow` combining all steps:
    1. Deploy full Morpho stack with borrower position
    2. Make position unhealthy via oracle price drop
    3. Non-curator syncs mirror registry (mocked BLS)
    4. Non-curator pushes fresh NAV to oracle (mocked BLS)
    5. Non-curator liquidates partial position
    6. Simulate ITP sell via USDC minting (BridgeProxy proceeds)
  - [x] 4.2 Assert: every step uses a different address from the curator/admin
  - [x] 4.3 Assert: no `onlyAdmin` or `onlyCurator` modifiers block any operation
  - [x] 4.4 Assert: liquidator ends with more USDC than started (profitable)

- [x] Task 5: Concurrent Liquidation Race Test (AC: #5)
  - [x] 5.1 Set up unhealthy position accessible to both curator and independent liquidator
  - [x] 5.2 Test: curator liquidates first → succeeds
  - [x] 5.3 Test: independent liquidator liquidates same position after curator:
    - If still unhealthy → second liquidation succeeds
    - If now healthy → reverts with appropriate error (not panic)
  - [x] 5.4 Assert: total seized collateral <= borrower's original collateral (no double-seize)
  - [x] 5.5 Assert: borrower's debt reflects both partial liquidations if both succeed

- [x] Task 6: Access Control Verification Tests (AC: #4)
  - [x] 6.1 Test: `ITPNAVOracle.updatePrice()` callable by any address (no onlyOwner/onlyAdmin)
  - [x] 6.2 Test: `MirrorIssuerRegistry.sync()` callable by any address (no access restriction)
  - [x] 6.3 Test: `Morpho.liquidate()` callable by any address (Morpho Blue is permissionless by design)
  - [x] 6.4 Test: random EOA with no prior roles can perform entire flow

- [x] Task 7: Edge Cases and Error Handling
  - [x] 7.1 Test: liquidation with stale oracle price reverts (MAX_STALENESS = 24 hours exceeded)
  - [x] 7.2 Test: liquidation on healthy position reverts cleanly
  - [x] 7.3 Test: oracle update with invalid BLS signature reverts
  - [x] 7.4 Test: mirror registry sync with wrong nonce reverts
  - [x] 7.5 Test: liquidation with zero USDC repay amount reverts

- [x] Task 8: Update Story Status
  - [x] 8.1 Mark all tasks complete
  - [x] 8.2 Verify all tests pass with `forge test --match-contract MorphoPermissionlessLiquidation`
  - [x] 8.3 Run full regression: `forge test` (expect 0 new failures)

## Dev Notes

### Scope: Foundry Test-Only

This story is purely a Foundry Solidity test file. No new contracts, no Rust code, no modifications to existing contracts. All tests verify that existing contracts have no unintended access controls blocking permissionless liquidation.

### Key Contracts to Test Against

| Contract | File | Key Function |
|----------|------|-------------|
| ITPNAVOracle | `contracts/src/oracle/ITPNAVOracle.sol` | `updatePrice()` — permissionless by design |
| MirrorIssuerRegistry | `contracts/src/registry/MirrorIssuerRegistry.sol` | `sync()` — permissionless by design |
| Morpho Blue | `contracts/lib/morpho-blue/src/Morpho.sol` | `liquidate()` — permissionless by design |
| MorphoTestHelper | `contracts/test/helpers/MorphoTestHelper.sol` | `_deployMorphoStack()` — reuse for setup |

### Reuse MorphoTestHelper

Extend `MorphoTestHelper` (NOT `TestHelper` directly). It provides:
- `_deployMorphoStack()` — deploys ITP, USDC, MirrorIssuerRegistry, ITPNAVOracle, Morpho Blue, AdaptiveCurveIrm, creates market (77% LLTV), seeds 1M USDC liquidity, mints 1000 ITP to borrower
- Pre-configured addresses: `borrower`, `lender`, `admin`
- Market params: `marketParams` with oracle, IRM, LLTV all wired
- BLS precompile mock via `vm.mockCall` on address `0x08`

### BLS Mocking Pattern

Follow the pattern from Story 8-11 (`MorphoLiquidationLoop.t.sol`):
```solidity
// Mock BLS precompile to always return success
vm.mockCall(
    address(0x08),
    abi.encodeWithSelector(bytes4(0)),
    abi.encode(true)
);
```
This makes all BLS signature verification pass, simulating valid aggregated signatures.

### Oracle Price Manipulation Pattern

From `MorphoLiquidationLoop.t.sol`, use `updatePrice()` directly with mocked BLS:
```solidity
// Push new price to oracle (anyone can call — this is what we test)
oracle.updatePrice(newPrice, block.timestamp, nextCycleNumber, blsSig, signersBitmask);
```
- Price is 36 decimals (Morpho convention): 1 ITP = 1 USDC → `1e24` (since USDC is 6 decimals, ITP is 18: 36 - 18 + 6 = 24)
- Cycle number must be strictly increasing
- `blsSig` = any bytes (mocked precompile accepts all)
- `signersBitmask` = `0x07` for issuers 0,1,2

### Liquidation Mechanics (Morpho Blue)

```solidity
// Morpho.liquidate(MarketParams, borrower, seizedAssets, repaidShares, data)
// OR: Morpho.liquidate(MarketParams, borrower, seizedAssets, 0, "") for asset-based
morpho.liquidate(marketParams, borrower, seizedAmount, 0, "");
```

- Liquidation incentive factor: `1 / (1 - LIQUIDATION_CURSOR * (1 - LLTV))`
- For LLTV=77%: incentive ≈ 7.41% (741 bps)
- Liquidator provides USDC, receives ITP collateral at oracle price + incentive
- Morpho is fully permissionless — no access control on `liquidate()`

### ITP Sale Simulation

ITP seized by liquidator cannot be directly sold in a Foundry test (would require real bridge flow). Simulate by:
```solidity
// Simulate BridgeProxy sell: mint USDC equivalent to seized ITP value
uint256 usdcProceeds = (seizedItp * oraclePrice) / 1e36; // scale to 6 decimals
deal(address(usdc), liquidator, usdcProceeds);
```
This matches the pattern in Story 8-11 `MorphoLiquidationLoop.t.sol`.

### Test Address Strategy

Use `vm.addr()` or `makeAddr()` to create distinct addresses:
```solidity
address curator = makeAddr("curator");
address independentLiquidator = makeAddr("independentLiquidator");
address randomUser = makeAddr("randomUser");
```
The key assertion is that `independentLiquidator` (never given any roles) can perform the entire flow.

### Health Factor Calculation

```
healthFactor = (collateral * oraclePrice * LLTV) / debt
```
- Position is liquidatable when healthFactor < 1.0
- Drop oracle price to ~70% of original to create a clearly unhealthy position

### Previous Story Intelligence (8-11)

From Story 8-11 code review:
- MorphoTestHelper has `vm.warp(1)` in setUp — tests run at timestamp=1
- BLS precompile mock must be set up BEFORE any oracle/registry calls
- `vm.mockCall` on `0x08` must be global (not per-test) — set in `setUp()`
- Interest accrual requires `vm.warp()` to advance time
- Use `vm.prank(address)` to execute as specific caller
- `deal()` function for giving tokens to test addresses

### Project Structure Notes

- Test file: `contracts/test/MorphoPermissionlessLiquidation.t.sol`
- Extends: `MorphoTestHelper` from `contracts/test/helpers/MorphoTestHelper.sol`
- Imports: Morpho Blue interfaces from `contracts/lib/morpho-blue/`
- No new contracts or libraries needed
- No Rust code changes

### References

- [Source: _bmad-output/planning-artifacts/itp-morpho-lending-architectures.md#Liquidation Loop]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.12]
- [Source: contracts/src/oracle/ITPNAVOracle.sol — updatePrice() is public, no access control]
- [Source: contracts/src/registry/MirrorIssuerRegistry.sol — sync() is public, no access control]
- [Source: contracts/test/MorphoLiquidationLoop.t.sol — Story 8-11 patterns]
- [Source: contracts/test/helpers/MorphoTestHelper.sol — _deployMorphoStack()]
- [Source: _bmad-output/implementation-artifacts/8-11-partial-liquidation-loop.md]
- [Source: _bmad-output/implementation-artifacts/8-10-oracle-bls-collector.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Initial compilation errors: EventsLib import missing, `admin` variable undefined — fixed
- `_generateNewAggPubkey()` uint8 overflow at seed=200+i causing panic — fixed with modulo 256
- `test_concurrentLiquidation_secondRevertsIfHealthy` failing due to position being healthy from start — fixed by adjusting borrow amount and price to create reliably unhealthy position

### Completion Notes List

- **Task 1**: Created `MorphoPermissionlessLiquidation.t.sol` with 3 tests for permissionless mirror registry sync: `test_mirrorRegistrySync_permissionless`, `test_mirrorRegistrySync_randomUserCanSync`, `test_mirrorRegistrySync_emitsEvent`
- **Task 2**: 4 tests for permissionless oracle price push: `test_oracleUpdatePrice_permissionless`, `test_oracleUpdatePrice_acceptsHigherCycleNumber`, `test_oracleUpdatePrice_rejectsStaleCycleNumber`, `test_oracleUpdatePrice_emitsEvent`
- **Task 3**: 3 tests for permissionless liquidation: `test_liquidation_permissionless`, `test_liquidation_liquidatorReceivesIncentive` (verified 741 bps incentive), `test_liquidation_borrowerDebtReduced`
- **Task 4**: 2 comprehensive E2E tests: `test_fullPermissionlessFlow` (verified profitable liquidation with net profit logged), `test_fullPermissionlessFlow_noAdminRoles`
- **Task 5**: 3 concurrent liquidation tests: `test_concurrentLiquidation_curatorFirst`, `test_concurrentLiquidation_secondRevertsIfHealthy`, `test_concurrentLiquidation_noDoubleSeize`
- **Task 6**: 4 access control verification tests: `test_accessControl_oracleUpdatePrice_noRestriction`, `test_accessControl_mirrorRegistrySync_noRestriction`, `test_accessControl_morphoLiquidate_noRestriction`, `test_accessControl_randomEOA_fullFlow`
- **Task 7**: 5 edge case tests: `test_edgeCase_staleOraclePrice_reverts`, `test_edgeCase_healthyPosition_revertsCleanly`, `test_edgeCase_invalidBLSSignature_reverts`, `test_edgeCase_wrongNonce_reverts`, `test_edgeCase_zeroRepayAmount_reverts`
- **Task 8**: All 25 tests pass (including new deterministic concurrent liquidation test). Full regression has 20 pre-existing failures (unrelated to this story), 0 new failures introduced.

### File List

- `contracts/test/MorphoPermissionlessLiquidation.t.sol` (new) — 25 Foundry tests for permissionless liquidation flow
- `contracts/test/helpers/MorphoTestHelper.sol` (dependency) — Inherited test helper providing `_deployMorphoStack()`, `_setupBorrowPosition()`, market configuration

### Senior Developer Review (AI)

**Reviewed:** 2026-02-05
**Reviewer:** Claude Opus 4.5
**Result:** APPROVED with fixes applied

**Issues Found & Fixed:**
1. **M1** (MEDIUM): ITP sale simulation lacked documentation explaining why cross-chain sell flow is simulated → Added detailed comment explaining Index sell order flow complexity
2. **M2** (MEDIUM): `_isPositionHealthy()` helper approximation differed from Morpho's internal logic → Added warning comment about approximation and recommended approach
3. **M3** (MEDIUM): `test_concurrentLiquidation_secondRevertsIfHealthy` had non-deterministic if-else path → Added new deterministic test `test_concurrentLiquidation_secondRevertsIfHealthy_deterministic`
4. **M4** (MEDIUM): File List missing MorphoTestHelper.sol dependency → Added to File List

**Verification:**
- All 25 tests pass
- No new regressions introduced
- All ACs covered by tests
- Code quality acceptable
