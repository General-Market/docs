# Story 8.8: Deposit ITP, Borrow USDC

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **ITP holder**,
I want **to deposit my ITP tokens as collateral on Morpho Blue and borrow USDC against them**,
So that **I can access liquidity without selling my ITP position**.

## Acceptance Criteria

1. **AC1 — Supply Collateral**: Given a Morpho Blue market (ITP/USDC) is live with USDC liquidity in the vault and a fresh oracle price, when a user approves Morpho to spend their ITP tokens and calls `morpho.supplyCollateral(marketParams, amount, user, "")`, then ITP tokens are transferred from user to Morpho and the user's collateral balance is recorded in Morpho.
2. **AC2 — Borrow USDC**: Given a user has deposited ITP collateral, when the user calls `morpho.borrow(marketParams, usdcAmount, 0, user, user)` with an amount within their LLTV allowance, then USDC is transferred from the vault to the user, a borrow position (debt) is recorded, and the user's health factor is above 1.0.
3. **AC3 — LLTV Enforcement**: Given a user has deposited ITP collateral, when the user attempts to borrow USDC exceeding their LLTV limit, then the transaction reverts (Morpho enforces LLTV).
4. **AC4 — Position Query**: Given a user has an active borrow position, when `morpho.position(marketId, user)` is queried, then the collateral amount and borrow shares are returned correctly.
5. **AC5 — Full E2E Test**: Given Foundry test environment with full Morpho deployment, when a test runs the complete borrow flow (approve ITP → supplyCollateral → borrow USDC), then user ends with USDC in their wallet, ITP locked in Morpho, debt recorded, and the market's available liquidity (totalSupplyAssets − totalBorrowAssets) decreased by the borrowed amount.

## Tasks / Subtasks

- [x] Task 1: Extend MorphoTestHelper with borrow-specific utilities (AC: #1, #2, #5)
  - [x] 1.1: Read existing `contracts/test/helpers/MorphoTestHelper.sol` — it already deploys the full Morpho stack (Morpho, IRM, ITPNAVOracle, MirrorIssuerRegistry, MockERC20 tokens, creates market, seeds USDC). **DO NOT recreate any of this.**
  - [x] 1.2: If any helper functions are missing for borrow flow testing (e.g., `_supplyCollateral`, `_borrow`), add them to `MorphoTestHelper.sol`
  - [x] 1.3: Verify `MorphoTestHelper._deployMorphoStack()` still works after 8-7 changes

- [x] Task 2: Update `MorphoBorrowFlow.t.sol` test file (AC: #1, #2, #3, #4, #5)
  - [x] 2.1: Read existing `contracts/test/MorphoBorrowFlow.t.sol` (389 lines, 14 tests) — this file already exists from a prior attempt. **Audit it against ACs below.**
  - [x] 2.2: Verify all 14 existing tests compile and pass with the latest 8-5/8-6/8-7 contract changes
  - [x] 2.3: Fix any compilation or logic errors from upstream changes

- [x] Task 3: Verify AC1 — supplyCollateral tests (AC: #1)
  - [x] 3.1: Confirm `test_supplyCollateral_depositsITP()` verifies ITP transferred from user to Morpho
  - [x] 3.2: Confirm `test_supplyCollateral_multipleDeposits()` verifies cumulative collateral
  - [x] 3.3: Confirm `test_supplyCollateral_balancesCorrect()` verifies `itp.balanceOf(morpho)` increased and `itp.balanceOf(user)` decreased

- [x] Task 4: Verify AC2 — borrow tests (AC: #2)
  - [x] 4.1: Confirm `test_borrow_withinLLTV()` verifies USDC transferred to user and borrow shares recorded
  - [x] 4.2: Confirm `test_borrow_usdcBalanceIncreases()` verifies user USDC balance
  - [x] 4.3: Confirm `test_borrow_vaultSupplyDecreases()` verifies vault total supply accounting
  - [x] 4.4: Confirm `test_borrow_healthFactorAboveOne()` calculates and verifies health factor > 1.0

- [x] Task 5: Verify AC3 — LLTV enforcement tests (AC: #3)
  - [x] 5.1: Confirm `test_borrow_exceedsLLTV_reverts()` with vm.expectRevert
  - [x] 5.2: Confirm `test_borrow_exactlyAtLLTV()` boundary test
  - [x] 5.3: Confirm `test_borrow_oneWeiOverLLTV_reverts()` precision test

- [x] Task 6: Verify AC4 — position query tests (AC: #4)
  - [x] 6.1: Confirm `test_position_query()` verifies collateral and borrowShares match
  - [x] 6.2: Confirm `test_position_zeroBeforeInteraction()` returns zero initial state

- [x] Task 7: Verify AC5 — full E2E integration tests (AC: #5)
  - [x] 7.1: Confirm `test_fullBorrowFlow_e2e()` runs approve → supplyCollateral → borrow → verifies all balances
  - [x] 7.2: Confirm `test_fullBorrowFlow_vaultAccountingConsistent()` verifies vault accounting

- [x] Task 8: Run full test suite (AC: all)
  - [x] 8.1: `forge test --match-contract MorphoBorrowFlow -vvv` — all tests pass
  - [x] 8.2: `forge test` — verify zero regressions across entire test suite
  - [x] 8.3: `forge build` — clean compilation, no warnings in project contracts

## Dev Notes

### Critical Context: Stories 8.5-8.7 Are DONE

Stories 8.5, 8.6, and 8.7 are **complete**. All infrastructure exists:

| Artifact | File | Status |
|----------|------|--------|
| Morpho Blue submodule | `contracts/lib/morpho-blue/` | Installed |
| MetaMorpho submodule | `contracts/lib/metamorpho/` | Installed |
| morpho-blue-irm submodule | `contracts/lib/morpho-blue-irm/` | Installed |
| ITPNAVOracle | `contracts/src/oracle/ITPNAVOracle.sol` (121 lines) | Done (8.6) |
| MirrorIssuerRegistry | `contracts/src/registry/MirrorIssuerRegistry.sol` (196 lines) | Done (8.2) |
| MockMorphoOracle | `contracts/src/mocks/MockMorphoOracle.sol` | Done (8.5) |
| MorphoTestHelper | `contracts/test/helpers/MorphoTestHelper.sol` (146 lines) | Done (8.7) |
| MorphoBorrowLend.t.sol | `contracts/test/MorphoBorrowLend.t.sol` (385 lines, 14 tests) | Done (8.7) |
| MorphoE2E.t.sol | `contracts/test/MorphoE2E.t.sol` (224 lines, 9 tests) | Done (8.5) |
| MorphoBorrowFlow.t.sol | `contracts/test/MorphoBorrowFlow.t.sol` (389 lines, 14 tests) | **Exists — needs audit** |
| DeployMorphoE2E.s.sol | `contracts/script/DeployMorphoE2E.s.sol` (182 lines) | Done (8.5) |
| DeployMorphoMarket.s.sol | `contracts/script/DeployMorphoMarket.s.sol` (204 lines) | Done (8.7) |
| foundry.toml remappings | `contracts/foundry.toml` | Done (8.5) |
| deployments/morpho-e2e.json | `deployments/morpho-e2e.json` | Done (8.5) |

**DO NOT recreate any of these files.** This story's scope is narrowed to:
1. Verifying existing `MorphoBorrowFlow.t.sol` compiles and passes against latest 8.5-8.7 changes
2. Fixing any issues found
3. Ensuring all 5 ACs have proper test coverage

### MorphoTestHelper — Reuse This

`contracts/test/helpers/MorphoTestHelper.sol` provides `_deployMorphoStack()` which deploys:
- MockERC20 tokens (ITP 18 dec, USDC 6 dec)
- MirrorIssuerRegistry (UUPS proxy)
- ITPNAVOracle (real BLS-verified oracle)
- Morpho Blue core
- AdaptiveCurveIrm
- Enables IRM + LLTV (77%)
- Creates market
- Seeds 1M USDC liquidity (lender supply)
- Mints 1K ITP to borrower

**Test addresses:**
- `morphoOwner = 0xAA`
- `lender = 0xBB`
- `borrower = 0xCC`
- `mirrorAdmin = 0xDD`

**Constants:**
- `LLTV = 0.77e18` (77%)
- `ORACLE_PRICE = 1e24` (1 ITP = 1 USDC in 24-decimal Morpho format)
- `LENDER_USDC = 1_000_000e6`
- `BORROWER_ITP = 1_000e18`

**Accessor functions:** `getMorpho()`, `getIrm()`, `getOracle()`, `getMirrorRegistry()`, `getItp()`, `getUsdc()`, `getMarketParams()`, `getMarketId()`

### ITPNAVOracle — Constructor Is 3 Params

From Story 8.6, the ITPNAVOracle constructor takes **exactly 3 parameters**:
```solidity
constructor(address _mirrorRegistry, address _itpAddress, uint256 _initialPrice)
```
BLSLib is an **internal library** (linked at compile time), not passed as a constructor param.

### BLS Mocking Pattern for Tests

All Morpho tests mock the BN254 precompile to bypass real BLS verification:
```solidity
vm.mockCall(address(0x08), "", abi.encode(uint256(1)));
oracle.updatePrice(100e24, block.timestamp, cycleNum, hex"0000...0000", 0x07);
```
This pattern is established in MorphoTestHelper and must be followed.

### Decimal Scaling — Critical

| Token | Decimals | Example 1 unit |
|-------|----------|----------------|
| ITP | 18 | `1e18` |
| USDC | 6 | `1e6` |
| Oracle price (Morpho) | 36 | `price = value * 10^(36 + 6 - 18) = value * 10^24` |

For 1 ITP = 1 USDC: oracle price = `1e24`
For 1 ITP = 100 USDC: oracle price = `100e24`

**Get this wrong and all LLTV calculations break.**

### Key Morpho Blue Functions

```solidity
// Deposit ITP as collateral
morpho.supplyCollateral(MarketParams, uint256 assets, address onBehalf, bytes data)

// Borrow USDC
morpho.borrow(MarketParams, uint256 assets, uint256 shares, address onBehalf, address receiver)

// Query position
morpho.position(Id marketId, address user) returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)

// Query market state
morpho.market(Id id) returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)
```

### Health Factor Calculation

```
healthFactor = (collateralValue * LLTV) / debtValue
collateralValue = collateralAmount * oraclePrice / 10^PRICE_DECIMALS
debtValue = borrowedAmount (in USDC terms)
```

Position is liquidatable when healthFactor < 1.0. Morpho enforces this natively — it reverts on borrow if the resulting position would have healthFactor < 1.0.

### Foundry Remappings (Already Configured)

```toml
@morpho-blue/=lib/morpho-blue/src/
@morpho-blue-irm/=lib/morpho-blue-irm/src/
@metamorpho/=lib/metamorpho/src/
```

### What NOT To Do

- **DO NOT** install Morpho submodules (already done in 8.5)
- **DO NOT** create ITPNAVOracle (already done in 8.6)
- **DO NOT** create MirrorIssuerRegistry (already done in 8.2)
- **DO NOT** create MorphoTestHelper (already done in 8.7)
- **DO NOT** create deploy scripts (already done in 8.5/8.7)
- **DO NOT** modify foundry.toml remappings (already done in 8.5)
- **DO NOT** add new error codes to ErrorsLib (E094-E096 already added in 8.6)

### What TO Do

1. Read `MorphoBorrowFlow.t.sol` — it was created in a prior attempt and may have issues
2. Verify it compiles against the latest 8.5-8.7 artifacts
3. Fix any compilation errors (e.g., constructor signatures, import paths)
4. Verify all 14 tests pass
5. If any AC has missing test coverage, add the missing tests
6. Run full regression (`forge test`)

### Project Structure Notes

- All test files in `contracts/test/`
- Test helpers in `contracts/test/helpers/`
- Oracle contracts in `contracts/src/oracle/`
- Pragma: `^0.8.20` for consistency
- Test naming: `test_<scenario>_<expectedBehavior>()`
- Use `vm.prank()`/`vm.startPrank()` for multi-actor
- Use `vm.expectRevert()` for revert tests

### References

- [Source: contracts/test/MorphoBorrowFlow.t.sol] — Existing borrow flow tests (audit target)
- [Source: contracts/test/helpers/MorphoTestHelper.sol] — Reusable Morpho deploy helper
- [Source: contracts/test/MorphoBorrowLend.t.sol] — Story 8.7 borrow/lend tests (patterns to follow)
- [Source: contracts/test/MorphoE2E.t.sol] — Story 8.5 E2E sanity tests
- [Source: contracts/src/oracle/ITPNAVOracle.sol] — BLS-verified oracle (3-param constructor)
- [Source: contracts/src/registry/MirrorIssuerRegistry.sol] — Mirror registry (UUPS proxy)
- [Source: contracts/src/interfaces/IITPNAVOracle.sol] — Oracle interface
- [Source: contracts/src/interfaces/IMirrorIssuerRegistry.sol] — Mirror registry interface
- [Source: contracts/src/libraries/ErrorsLib.sol] — Error codes (E094-E096 for oracle)
- [Source: contracts/src/libraries/EventsLib.sol] — Events (NAVPriceUpdated)
- [Source: contracts/foundry.toml] — Remappings and compiler settings
- [Source: _bmad-output/planning-artifacts/itp-morpho-lending-architectures.md] — Full lending architecture
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.8] — Epic story definition

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- MorphoBorrowLend.t.sol had pre-existing compilation error: `vm.mockCall` overload ambiguity with `""` literal. Fixed by casting to `bytes("")` (4 occurrences). This was a Story 8.7 issue, not 8.8.
- Pre-existing test failures (20 total): BLSCustody timelock mismatches (3), DeployL3 setUp (1), IssuerCustodyArb/L3 timelock issues (14), BridgeIntegration decimal issues from 7.6b (2). None related to this story.

### Completion Notes List

- MorphoTestHelper.sol reviewed — already has all necessary infrastructure for borrow flow testing. No helper additions needed; tests call `morpho.supplyCollateral()` and `morpho.borrow()` directly.
- MorphoBorrowFlow.t.sol (14 tests) audited and verified against all 5 ACs. All tests compile and pass against latest 8.5/8.6/8.7 changes with zero modifications needed to the file.
- Fixed pre-existing `vm.mockCall` overload ambiguity in MorphoBorrowLend.t.sol (Story 8.7 artifact) — cast `""` to `bytes("")` to resolve Solidity compiler error with newer Forge versions.
- Full test suite: 1153 pass, 20 pre-existing failures (documented), 0 new regressions. `forge build` compiles cleanly.
- AC coverage verified: AC1 (3 supplyCollateral tests), AC2 (4 borrow tests), AC3 (3 LLTV enforcement tests), AC4 (2 position query tests), AC5 (2 full E2E tests).

### Change Log

- 2026-02-05: Story 8.8 audit complete — all 14 MorphoBorrowFlow tests verified passing. Fixed MorphoBorrowLend.t.sol mockCall overload (pre-existing 8.7 issue). 0 new regressions.
- 2026-02-05: Code review fixes — MorphoTestHelper: added vm.warp + BLS precompile mock + oracle.updatePrice() for realistic timestamps. MorphoBorrowFlow: added specific revert selectors for LLTV tests. AC5 wording corrected. All 37 Morpho tests pass, 0 new regressions.

### File List

- contracts/test/MorphoBorrowFlow.t.sol — Audited + fixed: added `bytes("insufficient collateral")` revert selectors to 2 LLTV tests
- contracts/test/MorphoBorrowLend.t.sol — Fixed vm.mockCall overload ambiguity (4 occurrences: `""` → `bytes("")`)
- contracts/test/helpers/MorphoTestHelper.sol — Fixed: added `vm.warp(1_700_000_000)`, BLS precompile mock, and `oracle.updatePrice()` to `_deployMorphoStack()`
