# Story 8.11: Partial Liquidation Loop

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **curator liquidation bot**,
I want **to perform iterative partial liquidations on unhealthy Morpho positions by seizing ITP collateral, selling it via BridgeProxy, and using the recovered USDC to liquidate more**,
So that **the lending protocol remains solvent and bad debt is minimized through a self-funding liquidation cycle**.

## Acceptance Criteria

1. **AC1 — Partial Liquidation On Unhealthy Position**: Given a Morpho Blue position with health factor below 1.0 (due to NAV price drop), when the liquidation bot calls `morpho.liquidate(marketParams, borrower, seizedAssets, 0, "")` with a partial `seizedAssets` amount, then the bot repays proportional USDC debt, and the bot receives the seized ITP tokens plus the liquidation incentive (~7.41% for 77% LLTV).

2. **AC2 — Sell Seized ITP Via BridgeProxy (Existing Sell Flow)**: Given the bot has seized ITP tokens from a partial liquidation, when the bot sells the seized ITP via `BridgeProxy.sell()` (existing sell flow), then the sell order is processed by issuers (BLS consensus → AP executes → confirmFills), and USDC is returned to the bot.

3. **AC3 — Self-Funding Liquidation Loop**: Given the bot has recovered USDC from selling seized ITP, when the recovered USDC (original repayment + liquidation incentive) is available, then the bot can use this larger USDC amount to liquidate a bigger portion of the same position, and the loop continues until the position is healthy or fully liquidated.

4. **AC4 — Iterative USDC Growth**: Given a position that requires multiple liquidation iterations, when the bot runs the full loop (liquidate → sell → recover → liquidate more), then the bot's USDC grows by approximately the liquidation incentive percentage (~7.41%) each iteration, and the position's health factor improves with each iteration.

5. **AC5 — Seed USDC Approval**: Given the bot starts with seed USDC capital, when it begins the first iteration, then it approves Morpho to spend its USDC before calling `liquidate()`, and it tracks the total USDC spent, ITP seized, and USDC recovered per iteration.

6. **AC6 — Position Healthy Stop Condition**: Given the position becomes healthy (health factor >= 1.0) mid-loop, when the bot checks position health after an iteration, then it stops liquidating and logs the final state, and no further liquidation calls are made.

7. **AC7 — Healthy Position Revert**: Given the bot attempts to liquidate a position with health factor >= 1.0, when `morpho.liquidate()` is called, then the transaction reverts with `HEALTHY_POSITION` (Morpho enforces health check), and the bot handles the revert gracefully.

8. **AC8 — Foundry E2E Liquidation Loop Test**: Given Foundry test environment, when a test simulates: deposit ITP → borrow USDC → push lower NAV (BLS-signed) → partial liquidate → sell ITP → iterate, then the full liquidation loop executes successfully, and the borrower's debt is reduced proportionally, and the vault's USDC balance is restored from the sold ITP.

## Tasks / Subtasks

- [x] Task 1: Create test file and extend MorphoTestHelper (AC: all)
  - [x] 1.1: Create `contracts/test/MorphoLiquidationLoop.t.sol` extending `MorphoTestHelper`
  - [x] 1.2: Add `address public liquidator = address(0xEE);` as the liquidation bot address
  - [x] 1.3: Add `uint256 public constant SEED_USDC = 100e6;` (100 USDC seed capital)
  - [x] 1.4: Add helper `_setupBorrowPosition(uint256 collateral, uint256 borrow)` — same pattern as MorphoRepayFlow
  - [x] 1.5: Add helper `_pushLowerPrice(uint256 newPrice)` — pushes a lower NAV via oracle.updatePrice() with mock BLS sig, auto-incrementing cycle number
  - [x] 1.6: Add helper `_isPositionHealthy(address user) returns (bool)` — computes health factor from position data and oracle price

- [x] Task 2: Test single partial liquidation on unhealthy position (AC: #1)
  - [x] 2.1: `test_partialLiquidation_unhealthyPosition()` — deposit 100 ITP, borrow 70 USDC, drop oracle price to 0.8e24, verify position unhealthy, seize 20 ITP, verify liquidator receives ITP, verify borrower debt reduced
  - [x] 2.2: `test_partialLiquidation_liquidatorReceivesITPPlusIncentive()` — verify seized ITP value > USDC repaid (liquidation incentive = profit margin)
  - [x] 2.3: `test_partialLiquidation_borrowerDebtReduced()` — verify borrower's borrow shares decrease after partial liquidation

- [x] Task 3: Test healthy position revert (AC: #7)
  - [x] 3.1: `test_liquidation_healthyPosition_reverts()` — healthy position liquidation reverts with "position is healthy"
  - [x] 3.2: `test_liquidation_afterPriceRecoversToHealthy_reverts()` — first liquidation succeeds, price recovers, second liquidation reverts

- [x] Task 4: Test liquidation incentive math (AC: #4)
  - [x] 4.1: `test_liquidationIncentive_profitableForLiquidator()` — seized ITP value exceeds USDC cost
  - [x] 4.2: `test_liquidationIncentive_approximately7Percent()` — incentive verified at 741 bps (7.41%) for LLTV=77%

- [x] Task 5: Test iterative partial liquidation loop (AC: #3, #4, #5)
  - [x] 5.1: `test_iterativeLiquidationLoop_twoIterations()` — 2-iteration loop with simulated sell, USDC growth verified per iteration
  - [x] 5.2: `test_iterativeLiquidationLoop_stopsWhenHealthy()` — loop stops after 3 iterations when position becomes healthy (200 ITP, 150 USDC borrow, 0.95e24 price drop)
  - [x] 5.3: `test_iterativeLiquidationLoop_fullLiquidation()` — 5 iterations, all 100 ITP seized, 0 remaining collateral

- [x] Task 6: Test oracle price manipulation for unhealthy positions (AC: #1)
  - [x] 6.1: `test_priceDropMakesPositionUnhealthy()` — healthy at 1e24, unhealthy at 0.8e24
  - [x] 6.2: `test_priceDropSeverity_affectsLiquidationSize()` — lower price = lower USDC repaid for same ITP seized
  - [x] 6.3: `test_priceDropToZero_prevented()` — oracle rejects zero price (E095_InvalidOraclePrice)

- [x] Task 7: Test seed USDC approval and tracking (AC: #5)
  - [x] 7.1: `test_seedUsdcApproval_beforeLiquidation()` — reverts without approval, succeeds with approval
  - [x] 7.2: `test_seedUsdcTracking_perIteration()` — 3 iterations tracked: total recovered (42M) > total spent (39.1M), net profit 2.9M USDC

- [x] Task 8: Build and verify (AC: all)
  - [x] 8.1: `cd contracts && forge build` — compilation successful, zero test-file warnings
  - [x] 8.2: `cd contracts && forge test --match-path test/MorphoLiquidationLoop.t.sol -vvv` — all 15 tests pass
  - [x] 8.3: `cd contracts && forge test` — 1184 pass, 20 pre-existing failures (unchanged), zero new regressions

## Dev Notes

### Critical Context: Stories 8.1-8.10 Are DONE

All Morpho infrastructure exists. This story is purely **Solidity test-focused** — testing the Morpho Blue liquidation function in the context of our ITP/USDC markets.

| Artifact | File | Status |
|----------|------|--------|
| MorphoTestHelper | `contracts/test/helpers/MorphoTestHelper.sol` (152 lines) | Done (8.7) |
| TestHelper | `contracts/test/helpers/TestHelper.sol` (45 lines) | Done |
| MorphoBorrowFlow tests | `contracts/test/MorphoBorrowFlow.t.sol` (389 lines) | Done (8.8) |
| MorphoRepayFlow tests | `contracts/test/MorphoRepayFlow.t.sol` (412 lines) | Done (8.9) |
| ITPNAVOracle | `contracts/src/oracle/ITPNAVOracle.sol` (121 lines) | Done (8.6) |
| Morpho Blue (forked) | `contracts/lib/morpho-blue/src/Morpho.sol` | Done (8.5) |
| Curator crate | `curator/` | Done (8.10) |

### This Story Is TEST-ONLY

**No new smart contracts.** No modifications to existing contracts. No Rust code. This story validates the liquidation loop purely through Foundry tests using existing Morpho Blue infrastructure.

The ITP sell via BridgeProxy (AC2) is **simulated in tests** by minting USDC to the liquidator. The real sell flow (BridgeProxy → issuers → AP → USDC) is already tested in Epic 7 and will be wired end-to-end in Story 8.16.

### Morpho Blue Liquidation Function Signature

```solidity
// From contracts/lib/morpho-blue/src/Morpho.sol:347
function liquidate(
    MarketParams memory marketParams,
    address borrower,
    uint256 seizedAssets,      // collateral to seize (ITP amount, 18 decimals)
    uint256 repaidShares,      // OR share-based (set one to 0, the other non-zero)
    bytes calldata data         // callback data (empty string "")
) external returns (uint256 seizedAssets, uint256 repaidAssets);
```

**Key behavior:**
- `seizedAssets > 0, repaidShares == 0` → asset-based: specify how much ITP to seize, Morpho computes repaid USDC
- `seizedAssets == 0, repaidShares > 0` → share-based: specify debt shares to repay, Morpho computes ITP to seize
- Reverts with `"HEALTHY_POSITION"` if borrower's health factor >= 1.0

### Liquidation Incentive Calculation

For LLTV = 77% (0.77e18):
```
LIQUIDATION_CURSOR = 0.3e18
MAX_LIQUIDATION_INCENTIVE_FACTOR = 1.15e18

liquidationIncentiveFactor = min(1.15e18, WAD / (WAD - 0.3e18 * (WAD - 0.77e18)))
                            = min(1.15e18, 1e18 / (1e18 - 0.3e18 * 0.23e18))
                            = min(1.15e18, 1e18 / (1e18 - 0.069e18))
                            = min(1.15e18, 1e18 / 0.931e18)
                            = min(1.15e18, 1.0741e18)
                            = 1.0741e18 (~7.41% incentive)
```

**In practice:** if the liquidator seizes 100 ITP worth 80 USDC, the liquidator repays ~74.5 USDC of debt. The 5.5 USDC difference is the liquidator's profit.

### Health Factor Calculation

```
collateralValueUsdc = collateralAmount * oraclePrice / 1e36
maxBorrow = collateralValueUsdc * LLTV / 1e18
healthFactor = (maxBorrow * 1e18) / actualDebt    // in WAD (1e18)
```

For 100 ITP at oracle price 1e24, LLTV 77%:
- `collateralValueUsdc = 100e18 * 1e24 / 1e36 = 100e6` (100 USDC)
- `maxBorrow = 100e6 * 0.77e18 / 1e18 = 77e6`
- If debt = 70e6: `healthFactor = 77e6 * 1e18 / 70e6 = 1.1e18` (healthy)
- If price drops to 0.8e24: `collateralValueUsdc = 80e6`, `maxBorrow = 61.6e6`, `healthFactor = 61.6e6 * 1e18 / 70e6 = 0.88e18` (UNHEALTHY → liquidatable)

### Oracle Price Drop for Testing

Use `_pushLowerPrice()` helper that calls `oracle.updatePrice()` with a mock BLS signature. The MorphoTestHelper already mocks the BLS precompile:
```solidity
// In setUp() via _deployMorphoStack():
vm.mockCall(PRECOMPILE_PAIRING, bytes(""), abi.encode(uint256(1)));
```

This means **any** BLS signature will be accepted in tests. To push a lower price:
```solidity
bytes memory mockSig = new bytes(64);
oracle.updatePrice(0.8e24, block.timestamp, nextCycleNumber, mockSig, 0x07);
```

**CRITICAL:** increment `cycleNumber` for each price push (oracle enforces `cycleNumber > lastCycleNumber`).

### Test Pattern — Extend MorphoRepayFlow Patterns

Follow the established test patterns from MorphoRepayFlow.t.sol and MorphoBorrowFlow.t.sol:
- Use `_setupBorrowPosition(collateral, borrow)` helper
- Use `vm.startPrank(liquidator)` for liquidation calls
- Query position with `morpho.position(marketId, borrower)`
- Query market state with `morpho.market(marketId)`

### Simulating ITP Sell in Tests

The sell via BridgeProxy (AC2) involves issuers, AP, and bridging — not testable in a pure Foundry test. Instead, **simulate the sell** by:
1. After `morpho.liquidate()`, liquidator has seized ITP
2. Calculate ITP value at oracle price → `itpValue = seizedITP * oraclePrice / 1e36`
3. Mint USDC to liquidator: `usdc.mint(liquidator, itpValue)`
4. This simulates the BridgeProxy sell flow returning USDC

This is acceptable because:
- The BridgeProxy sell flow is already tested in Epic 7 (Stories 7.1-7.14)
- Story 8.16 will test the full E2E flow with real bridging
- This story focuses on the liquidation loop mechanics

### Morpho Blue Constants (from ConstantsLib.sol)

```solidity
uint256 constant ORACLE_PRICE_SCALE = 1e36;
uint256 constant LIQUIDATION_CURSOR = 0.3e18;
uint256 constant MAX_LIQUIDATION_INCENTIVE_FACTOR = 1.15e18;
```

### Pre-Existing Test Failures (Non-Blocking)

20 pre-existing test failures documented in Stories 8.8/8.9:
- BLSCustody timelock mismatches (3)
- DeployL3 setUp (1)
- IssuerCustodyArb/L3 timelock issues (14)
- BridgeIntegration decimal issues from 7.6b (2)

**None are related to this story.**

### What NOT To Do

- **DO NOT** modify `ITPNAVOracle.sol` — stable, 28 tests passing
- **DO NOT** modify `MorphoTestHelper.sol` — stable, used by 8.7/8.8/8.9 tests
- **DO NOT** modify any Morpho Blue library code — forked and stable
- **DO NOT** attempt to test real BridgeProxy sell flow — simulate with USDC minting
- **DO NOT** write Rust code — this story is purely Foundry/Solidity tests
- **DO NOT** create new contracts — only test files

### What TO Do

1. Create `contracts/test/MorphoLiquidationLoop.t.sol`
2. Extend `MorphoTestHelper` for full Morpho stack
3. Add helper functions for price drops and health checks
4. Test single partial liquidation on unhealthy positions
5. Test healthy position revert guard
6. Test iterative liquidation loop with simulated sell
7. Test stop conditions (position healthy, fully liquidated)
8. Verify all tests pass with zero regressions

### Project Structure Notes

- New file: `contracts/test/MorphoLiquidationLoop.t.sol`
- No Solidity contracts created or modified
- No Rust code changes
- Consistent with existing test patterns in `contracts/test/MorphoBorrowFlow.t.sol` and `contracts/test/MorphoRepayFlow.t.sol`

### References

- [Source: contracts/test/helpers/MorphoTestHelper.sol] — Reusable Morpho stack deployment (Morpho, IRM, Oracle, market, USDC seeding)
- [Source: contracts/test/helpers/TestHelper.sol] — Base test helper with generateTestPubkey()
- [Source: contracts/test/MorphoBorrowFlow.t.sol] — Borrow flow test patterns (supplyCollateral, borrow, health factor)
- [Source: contracts/test/MorphoRepayFlow.t.sol] — Repay flow test patterns (_setupBorrowPosition helper, share-based repay)
- [Source: contracts/src/oracle/ITPNAVOracle.sol] — Oracle contract with updatePrice() and price()
- [Source: contracts/lib/morpho-blue/src/Morpho.sol:347] — liquidate() function implementation
- [Source: contracts/lib/morpho-blue/src/libraries/ConstantsLib.sol:11] — LIQUIDATION_CURSOR = 0.3e18, MAX_LIQUIDATION_INCENTIVE_FACTOR = 1.15e18
- [Source: contracts/lib/morpho-blue/src/interfaces/IMorpho.sol:257] — liquidate() interface with seizedAssets/repaidShares
- [Source: _bmad-output/planning-artifacts/itp-morpho-lending-architectures.md#Liquidation] — Architecture: iterative partial liquidation via BridgeProxy
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.11] — Epic story definition with 8 BDD acceptance criteria
- [Source: _bmad-output/implementation-artifacts/8-10-oracle-bls-collector.md] — Previous story context (curator crate, NavCollector)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed `test_iterativeLiquidationLoop_stopsWhenHealthy` — original params (200 ITP, 100 USDC borrow, 0.85e24 drop) resulted in a healthy position. Adjusted to 150 USDC borrow and 0.95e24 drop to create a barely-unhealthy position that becomes healthy after 3 partial liquidations.
- Fixed `console.log` with 5+ arguments — Foundry's console.log only supports up to 4 arguments. Split multi-argument logs into separate calls.
- Cleaned up unused variable warnings: replaced `(uint256 seized, uint256 repaid)` with `(uint256 seized,)` or `(, uint256 repaid)` where one value was unused.
- Morpho Blue revert string is `"position is healthy"` (not `"HEALTHY_POSITION"` as noted in story AC7 — the error constant name is `HEALTHY_POSITION` but the string value is different).
- `_pushLowerPrice` helper auto-increments cycle number internally rather than taking it as a parameter (simpler API, oracle enforces strictly increasing).

### Completion Notes List

- Created `contracts/test/MorphoLiquidationLoop.t.sol` (700+ lines) with 19 Foundry tests covering all 8 ACs
- All tests pass: 19/19 in test file
- Liquidation incentive verified at exactly 741 bps (7.41%) matching the theoretical calculation for LLTV=77%
- Iterative loop tests demonstrate self-funding mechanics with simulated ITP sell via USDC minting
- No contracts modified, no Rust code changed — purely test-only story as designed
- Code review added 4 edge case tests: zero collateral, slippage, insufficient USDC, concurrent liquidators

### File List

- `contracts/test/MorphoLiquidationLoop.t.sol` (NEW) — 15 Foundry tests for partial liquidation loop

### Change Log

- 2026-02-05: Created MorphoLiquidationLoop.t.sol with 15 tests covering partial liquidation, healthy position revert, incentive math, iterative loop, oracle price manipulation, and USDC tracking. All tests pass, zero regressions.
- 2026-02-05: Code review fixes — added 4 new edge case tests (19 total): zero collateral liquidation, slippage profitability, insufficient seed USDC, concurrent liquidators. Added documentation for BLS bitmap and health check rounding. Made iterative loop test more robust with dynamic threshold calculation.
