# Story 8.9: User Repay Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **ITP borrower**,
I want **to repay my USDC debt and withdraw my ITP collateral from Morpho Blue**,
So that **I can close my lending position and recover my ITP tokens**.

## Acceptance Criteria

1. **AC1 — Repay USDC Debt**: Given a user has an active borrow position with USDC debt and ITP collateral locked, when the user approves Morpho to spend USDC and calls `morpho.repay(marketParams, usdcAmount, 0, user, "")`, then USDC is transferred from user to the vault and the user's debt is reduced by the repaid amount.
2. **AC2 — Withdraw Collateral After Full Repay**: Given a user has fully repaid their USDC debt (borrow shares = 0), when the user calls `morpho.withdrawCollateral(marketParams, itpAmount, user, user)`, then ITP tokens are transferred from Morpho back to the user and the user's collateral balance in Morpho is reduced to 0.
3. **AC3 — Withdraw Blocked When Unhealthy**: Given a user has partial debt remaining, when the user attempts to withdraw all collateral, then the transaction reverts (Morpho enforces health factor).
4. **AC4 — Partial Withdraw With Healthy Position**: Given a user has partial debt remaining, when the user withdraws only enough collateral to keep health factor above 1.0, then the withdrawal succeeds and partial collateral is returned.
5. **AC5 — Full Round-Trip With Interest**: Given Foundry test environment, when a test runs the complete round-trip: deposit → borrow → (time passes) → repay → withdraw, then the user ends with their original ITP balance restored, the user's USDC balance is reduced by accrued interest, and the vault's USDC balance reflects the interest earned.

## Tasks / Subtasks

- [x] Task 1: Create MorphoRepayFlow.t.sol test file (AC: #1, #2, #3, #4, #5)
  - [x] 1.1: Create `contracts/test/MorphoRepayFlow.t.sol` extending `MorphoTestHelper` (from `contracts/test/helpers/MorphoTestHelper.sol`) — reuse `_deployMorphoStack()` for full Morpho deployment
  - [x] 1.2: Import `SharesMathLib` and `MathLib` from `@morpho-blue/libraries/` for share-to-asset conversion in interest calculations
  - [x] 1.3: Create helper function `_setupBorrowPosition(uint256 collateral, uint256 borrow)` that does approve → supplyCollateral → borrow for the `borrower` address — reused across all tests

- [x] Task 2: Implement AC1 — Repay USDC tests (AC: #1)
  - [x] 2.1: `test_repay_assetBased_reducesDebt()` — repay a fixed USDC amount via `morpho.repay(marketParams, usdcAmount, 0, borrower, "")`, verify borrow shares decrease, verify USDC transferred from borrower to Morpho
  - [x] 2.2: `test_repay_shareBased_clearsAllDebt()` — repay via shares: `morpho.repay(marketParams, 0, borrowShares, borrower, "")`, verify borrow shares go to zero
  - [x] 2.3: `test_repay_partial_reducesDebtProportionally()` — repay half of debt, verify borrow shares reduced, verify remaining debt still tracked
  - [x] 2.4: `test_repay_usdcTransferredFromUser()` — verify user USDC balance decreases by exact repay amount

- [x] Task 3: Implement AC2 — Withdraw collateral after full repay (AC: #2)
  - [x] 3.1: `test_withdrawCollateral_afterFullRepay_succeeds()` — share-based full repay → withdrawCollateral for full amount → verify ITP returned to user, verify collateral position = 0
  - [x] 3.2: `test_withdrawCollateral_itpBalancesCorrect()` — verify `itp.balanceOf(borrower)` increases by withdrawn amount and `itp.balanceOf(morpho)` decreases
  - [x] 3.3: `test_withdrawCollateral_positionCleared()` — after full repay + full withdraw, verify `morpho.position(marketId, borrower)` returns (0, 0, 0)

- [x] Task 4: Implement AC3 — Withdraw blocked when unhealthy (AC: #3)
  - [x] 4.1: `test_withdrawCollateral_allWithDebt_reverts()` — borrow 50 USDC against 100 ITP, try `withdrawCollateral(100 ITP)` without repaying → should revert
  - [x] 4.2: `test_withdrawCollateral_exceedsHealthFactor_reverts()` — borrow near LLTV, try to withdraw enough collateral to push health factor below 1.0 → should revert

- [x] Task 5: Implement AC4 — Partial withdraw with healthy position (AC: #4)
  - [x] 5.1: `test_withdrawCollateral_partial_withinHealthFactor_succeeds()` — borrow 50 USDC against 100 ITP (at 1:1 price, health factor = 1.54), withdraw 30 ITP (drops to ~1.08), verify succeeds and ITP returned
  - [x] 5.2: `test_withdrawCollateral_partial_positionUpdated()` — after partial withdraw, verify `morpho.position()` reflects reduced collateral but same borrow shares
  - [x] 5.3: `test_withdrawCollateral_partial_thenRepayAndWithdrawRest()` — partial withdraw → full repay → withdraw remaining collateral → verify all ITP returned

- [x] Task 6: Implement AC5 — Full round-trip with interest (AC: #5)
  - [x] 6.1: `test_fullRoundTrip_depositBorrowRepayWithdraw()` — deposit 500 ITP → borrow 200 USDC → `vm.warp(7 days)` → accrue interest → share-based full repay → withdraw all collateral → verify ITP balance restored, verify USDC balance reduced by interest
  - [x] 6.2: `test_fullRoundTrip_interestAccrues()` — borrow → warp 7 days → call `morpho.accrueInterest()` → verify `totalBorrowAssets` increased above original borrow amount → verify share-based repay costs more USDC than originally borrowed
  - [x] 6.3: `test_fullRoundTrip_marketAccountingConsistent()` — after full repay, verify market's `totalBorrowAssets == 0` and `totalSupplyAssets >= LENDER_USDC` (supply includes earned interest)

- [x] Task 7: Run full test suite (AC: all)
  - [x] 7.1: `forge test --match-contract MorphoRepayFlow -vvv` — all new tests pass
  - [x] 7.2: `forge test` — verify zero regressions across entire test suite
  - [x] 7.3: `forge build` — clean compilation, no warnings in project contracts

## Dev Notes

### Critical Context: Stories 8.5-8.8 Are DONE

All Morpho infrastructure exists. **DO NOT** create new Solidity contracts. This story is purely test-focused.

| Artifact | File | Status |
|----------|------|--------|
| Morpho Blue submodule | `contracts/lib/morpho-blue/` | Done (8.5) |
| MetaMorpho submodule | `contracts/lib/metamorpho/` | Done (8.5) |
| morpho-blue-irm submodule | `contracts/lib/morpho-blue-irm/` | Done (8.5) |
| ITPNAVOracle | `contracts/src/oracle/ITPNAVOracle.sol` | Done (8.6) |
| MirrorIssuerRegistry | `contracts/src/registry/MirrorIssuerRegistry.sol` | Done (8.2) |
| MockMorphoOracle | `contracts/src/mocks/MockMorphoOracle.sol` | Done (8.5) |
| MorphoTestHelper | `contracts/test/helpers/MorphoTestHelper.sol` (146 lines) | Done (8.7) |
| MorphoBorrowLend.t.sol | `contracts/test/MorphoBorrowLend.t.sol` (385 lines, 14 tests) | Done (8.7) |
| MorphoBorrowFlow.t.sol | `contracts/test/MorphoBorrowFlow.t.sol` (389 lines, 14 tests) | Done (8.8) |
| MorphoE2E.t.sol | `contracts/test/MorphoE2E.t.sol` (224 lines, 9 tests) | Done (8.5) |

### MorphoTestHelper — MUST Reuse

`contracts/test/helpers/MorphoTestHelper.sol` provides `_deployMorphoStack()` which deploys the full stack:
- MockERC20 tokens: `itp` (18 dec), `usdc` (6 dec)
- MirrorIssuerRegistry (UUPS proxy) with test pubkey
- ITPNAVOracle (real BLS-verified oracle, constructor bootstraps initial price)
- Morpho Blue core + AdaptiveCurveIrm
- Enables IRM + LLTV (77%)
- Creates market with `MarketParams{loanToken: usdc, collateralToken: itp, oracle: oracle, irm: irm, lltv: 0.77e18}`
- Seeds 1M USDC liquidity (lender supplies directly to Morpho market via `morpho.supply()`)
- Mints 1,000 ITP to borrower

**Test addresses:**
- `morphoOwner = address(0xAA)`
- `lender = address(0xBB)`
- `borrower = address(0xCC)`
- `mirrorAdmin = address(0xDD)`

**Constants:**
- `LLTV = 0.77e18` (77%)
- `ORACLE_PRICE = 1e24` (1 ITP = 1 USDC in Morpho format)
- `LENDER_USDC = 1_000_000e6`
- `BORROWER_ITP = 1_000e18`

**Public state:** `morpho`, `irm`, `oracle`, `mirrorRegistry`, `itp`, `usdc`, `marketParams`, `marketId`

**Accessor functions:** `getMorpho()`, `getIrm()`, `getOracle()`, `getMirrorRegistry()`, `getItp()`, `getUsdc()`, `getMarketParams()`, `getMarketId()`

**IMPORTANT:** MorphoTestHelper uses `morpho.supply()` to seed USDC directly into the Morpho market (NOT via MetaMorpho vault). No vault is deployed. Interest testing should use market-level accounting (`morpho.market(marketId).totalBorrowAssets` vs `totalSupplyAssets`), not vault shares.

### Key Morpho Blue Functions for Repay/Withdraw

```solidity
// Repay USDC debt (asset-based — repay exact USDC amount)
morpho.repay(MarketParams, uint256 assets, uint256 shares, address onBehalf, bytes data)
// Asset-based: morpho.repay(marketParams, amount, 0, borrower, "")
// Share-based: morpho.repay(marketParams, 0, shares, borrower, "")
// Returns: (uint256 assetsRepaid, uint256 sharesRepaid)

// Withdraw ITP collateral
morpho.withdrawCollateral(MarketParams, uint256 assets, address onBehalf, address receiver)
// Call: morpho.withdrawCollateral(marketParams, itpAmount, borrower, borrower)

// Trigger interest accrual (also called internally by supply/borrow/repay/withdraw)
morpho.accrueInterest(MarketParams)

// Query position
morpho.position(Id marketId, address user) returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)

// Query market state (for interest verification)
morpho.market(Id id) returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)
```

### Share-Based vs Asset-Based Repay — CRITICAL

When interest accrues (after `vm.warp`), the exact USDC amount to clear all debt changes. **Always use share-based repay for full debt clearing:**

```solidity
// CORRECT — clears exact debt regardless of interest accrual
(, uint128 borrowShares,) = morpho.position(marketId, borrower);
usdc.approve(address(morpho), type(uint256).max); // approve max to cover interest
morpho.repay(marketParams, 0, borrowShares, borrower, "");

// WRONG — may leave dust debt due to rounding/interest
morpho.repay(marketParams, borrowAmount, 0, borrower, ""); // original borrow amount
```

This pattern is established in `MorphoBorrowLend.t.sol:test_repayAndWithdrawCollateral()` (lines 301-304).

### Interest Accrual Mechanics

Morpho Blue accrues interest when any interaction occurs (`supply`, `borrow`, `repay`, `withdraw`, `accrueInterest`). After `vm.warp(duration)`:
1. Call `morpho.accrueInterest(marketParams)` to trigger accrual
2. `totalBorrowAssets` increases by accrued interest
3. `totalSupplyAssets` increases by the same amount (lenders earn interest)
4. Each borrower's debt in USDC = `borrowShares * totalBorrowAssets / totalBorrowShares`

To verify interest:
```solidity
// Before
(uint128 supplyBefore,,uint128 borrowBefore,,,) = morpho.market(marketId);

vm.warp(block.timestamp + 7 days);
morpho.accrueInterest(marketParams); // trigger accrual

// After
(uint128 supplyAfter,,uint128 borrowAfter,,,) = morpho.market(marketId);
uint256 interestAccrued = borrowAfter - borrowBefore;
assertGt(interestAccrued, 0, "Interest should accrue");
```

### Health Factor & Collateral Withdrawal Math

With ORACLE_PRICE = 1e24 (1 ITP = 1 USDC) and LLTV = 0.77e18:

| Scenario | Collateral | Debt | Collateral Value (USDC) | Max Debt (77%) | Health Factor | Can Withdraw? |
|----------|-----------|------|------------------------|----------|---------------|---------------|
| Initial borrow | 100 ITP | 50 USDC | 100 | 77 | 1.54 | Partial OK |
| After partial withdraw (30 ITP) | 70 ITP | 50 USDC | 70 | 53.9 | 1.078 | Yes (HF > 1) |
| After partial withdraw (36+ ITP) | 64 ITP | 50 USDC | 64 | 49.28 | 0.986 | NO (HF < 1) |
| After full repay | 100 ITP | 0 USDC | 100 | N/A | infinity | Full OK |

Morpho reverts on `withdrawCollateral` if resulting `borrowValue > collateralValue * LLTV * price`. The boundary for 50 USDC debt is ~64.9 ITP collateral (`50 / 0.77 = 64.93`), so withdrawing more than ~35 ITP from 100 should fail.

### Decimal Scaling — Critical

| Token | Decimals | Example 1 unit |
|-------|----------|----------------|
| ITP | 18 | `1e18` |
| USDC | 6 | `1e6` |
| Oracle price (Morpho) | 36 + 6 - 18 = 24 | `1e24` for 1:1 price |

### Oracle Staleness and vm.warp

MorphoTestHelper does NOT mock the oracle staleness check. The ITPNAVOracle has `MAX_STALENESS = 24 hours` and the constructor sets `lastUpdated = block.timestamp`.

**For tests that warp < 24 hours:** No issue, oracle remains fresh.

**For tests that warp >= 24 hours:** The oracle's `price()` will revert with `E096_StaleOraclePrice`. However, `morpho.repay()` and `morpho.withdrawCollateral()` do NOT call `oracle.price()` — Morpho only calls the oracle during `borrow()` and `liquidate()` to check health factors. For repay/withdraw after full repay, oracle staleness should not be an issue. For partial withdraw (which checks health factor), it WILL call `oracle.price()`.

**If you need to refresh the oracle after a warp:**
```solidity
vm.mockCall(address(0x08), bytes(""), abi.encode(uint256(1)));
oracle.updatePrice(ORACLE_PRICE, block.timestamp, nextCycleNumber, new bytes(64), 0x07);
```

**Recommendation:** Keep `vm.warp` to 7 days for interest tests. This is safely under the 24-hour oracle staleness for the repay operations that don't check oracle, but if testing partial withdraw after warp, refresh the oracle price first.

### Existing Repay Tests to Study (DO NOT duplicate)

`MorphoBorrowLend.t.sol:test_repayAndWithdrawCollateral()` (lines 289-318) — covers the basic happy-path: setup borrow → share-based repay → full withdraw. This story needs comprehensive coverage **beyond** that single test:
- Partial repay
- Asset-based vs share-based repay
- Withdraw blocked by health factor
- Partial withdraw with healthy position
- Interest accrual verification
- Full round-trip with interest accounting

### What NOT To Do

- **DO NOT** create new Solidity contracts — all infrastructure exists
- **DO NOT** modify `MorphoTestHelper.sol` — it's stable and proven
- **DO NOT** modify existing test files (MorphoBorrowLend.t.sol, MorphoBorrowFlow.t.sol, MorphoE2E.t.sol)
- **DO NOT** install Morpho submodules (done in 8.5)
- **DO NOT** modify foundry.toml remappings (done in 8.5)
- **DO NOT** add new error codes to ErrorsLib (none needed — Morpho handles all revert logic)

### What TO Do

1. Create `contracts/test/MorphoRepayFlow.t.sol` extending `MorphoTestHelper`
2. Write comprehensive tests for all 5 ACs (repay, withdraw, blocked withdraw, partial withdraw, round-trip with interest)
3. Use `vm.warp()` for interest accrual tests (keep to 7 days max)
4. Use share-based repay (`morpho.repay(marketParams, 0, shares, ...)`) for exact debt clearing
5. Use `vm.expectRevert()` for AC3 health factor enforcement
6. Run `forge test` and verify zero regressions

### BLS Mock Pattern (if needed for oracle refresh after warp)

```solidity
// Mock BLS pairing precompile
vm.mockCall(address(0x08), bytes(""), abi.encode(uint256(1)));

// Push fresh price with new cycle number
oracle.updatePrice(
    ORACLE_PRICE,       // 1e24 (1 ITP = 1 USDC)
    block.timestamp,    // current timestamp after warp
    nextCycleNumber,    // must be > previous cycle number
    new bytes(64),      // mock BLS signature (all zeros)
    0x07                // signersBitmask: issuers 0,1,2
);
```

### Pre-Existing Test Failures (Non-Blocking)

20 pre-existing test failures documented in Story 8.8:
- BLSCustody timelock mismatches (3)
- DeployL3 setUp (1)
- IssuerCustodyArb/L3 timelock issues (14)
- BridgeIntegration decimal issues from 7.6b (2)

**None are related to this story.**

### vm.mockCall Pattern for BLS (from MorphoBorrowFlow.t.sol)

`MorphoBorrowFlow.t.sol` uses `bytes("")` (not `""`) for the mock call data to avoid the `vm.mockCall` overload ambiguity with newer Forge versions. Follow this pattern:
```solidity
vm.mockCall(address(0x08), bytes(""), abi.encode(uint256(1)));
```

### Project Structure Notes

- New test file: `contracts/test/MorphoRepayFlow.t.sol`
- No new contracts created
- No modifications to existing files
- Pragma: `^0.8.20` for consistency
- Test naming: `test_<scenario>_<expectedBehavior>()`
- Use `vm.prank()`/`vm.startPrank()` for multi-actor
- Use `vm.expectRevert()` for revert tests
- Use `vm.warp()` for time-dependent tests

### References

- [Source: contracts/test/helpers/MorphoTestHelper.sol] — Reusable Morpho deploy helper (146 lines)
- [Source: contracts/test/MorphoBorrowLend.t.sol] — Story 8.7 tests — has `test_repayAndWithdrawCollateral()` (basic repay pattern)
- [Source: contracts/test/MorphoBorrowFlow.t.sol] — Story 8.8 borrow tests (14 tests, naming patterns)
- [Source: contracts/test/MorphoE2E.t.sol] — Story 8.5 E2E sanity tests (9 tests)
- [Source: contracts/src/oracle/ITPNAVOracle.sol] — BLS-verified oracle (staleness check at 24h)
- [Source: contracts/src/registry/MirrorIssuerRegistry.sol] — Mirror registry (UUPS proxy)
- [Source: contracts/foundry.toml] — Remappings and compiler settings
- [Source: _bmad-output/planning-artifacts/itp-morpho-lending-architectures.md] — Full lending architecture
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.9] — Epic story definition
- [Source: _bmad-output/implementation-artifacts/8-8-deposit-itp-borrow-usdc.md] — Previous story (borrow flow audit)
- [Source: _bmad-output/implementation-artifacts/8-7-create-morpho-market.md] — Market + vault creation with BLS oracle

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Initial run: 3 interest tests failed due to borrower having insufficient USDC to cover accrued interest. Fixed by minting 1 USDC buffer before setting up the borrow position in all three interest-related tests.

### Completion Notes List

- Created `contracts/test/MorphoRepayFlow.t.sol` with 16 tests covering all 5 ACs
- AC1 (5 tests): Asset-based repay, share-based full repay, partial repay proportionality, USDC transfer verification, overpayment revert
- AC2 (3 tests): Full withdraw after repay, ITP balance correctness at both user/Morpho, position fully cleared to (0,0,0)
- AC3 (2 tests): Withdraw all collateral with debt reverts, withdraw exceeding health factor reverts
- AC4 (3 tests): Partial withdraw within health factor succeeds, position reflects reduced collateral, multi-step partial withdraw → repay → withdraw rest
- AC5 (3 tests): Full round-trip with 7-day interest accrual (25,156 wei interest on 200 USDC), interest accrual verification via totalBorrowAssets, market accounting consistency after repay
- Interest tests use `usdc.mint(borrower, 1e6)` to ensure borrower has enough USDC to cover interest on repay
- Share-based repay pattern used for all full-debt-clearing operations per Dev Notes guidance
- No modifications to any existing files (MorphoTestHelper, MorphoBorrowLend, MorphoBorrowFlow, MorphoE2E)
- No new contracts created — purely test-focused as specified
- 1168 tests pass, 20 pre-existing failures (documented, unrelated), 0 new regressions

### Change Log

- 2026-02-05: Story 8.9 implemented — 15 repay/withdraw tests in MorphoRepayFlow.t.sol, all ACs verified
- 2026-02-05: Code review — removed unused imports (SharesMathLib, MathLib), removed console.log debug statements, added interest bound assertions to AC5 tests, added overpayment revert test (M1), added clarifying comment on fragile assertion (M2). 16 tests total, all pass.

### File List

- `contracts/test/MorphoRepayFlow.t.sol` (NEW) — 16 tests for repay USDC and withdraw ITP collateral flow
