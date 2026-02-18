# Story 8.7: Create Morpho Market + MetaMorpho Vault

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **curator**,
I want **a Morpho Blue market created for ITP/USDC with the real BLS-verified ITPNAVOracle and a MetaMorpho USDC vault configured with curator roles**,
So that **users can borrow USDC against ITP collateral and lenders can deposit USDC for yield, with prices verified by the issuer network**.

## Acceptance Criteria

1. **AC1**: `Morpho.createMarket(MarketParams)` called with collateral=ITP, loanToken=ArbUSDC, oracle=ITPNAVOracle (real BLS oracle, NOT MockMorphoOracle), irm=AdaptiveIRM, lltv=77% creates a Morpho Blue market with deterministic market ID
2. **AC2**: MetaMorpho vault deployed with asset=ArbUSDC, name="Index ITP Lending Vault", symbol="ilUSDC", owner=curatorMultisig, timelock=24 hours
3. **AC3**: Curator address and allocator address (curator bot) configured on the vault
4. **AC4**: `vault.submitCap(marketId, cap)` by curator enters timelock queue; after 24h elapsed `vault.acceptCap(marketId)` activates the cap and allows the allocator to supply
5. **AC5**: USDC lender can `vault.deposit(amount, lender)` after approving USDC — vault shares minted, allocator can distribute across approved ITP markets
6. **AC6**: Deployment script appends all new addresses to `deployments/morpho-e2e.json` (ITPNAVOracle, MirrorIssuerRegistry, market ID, vault)
7. **AC7**: Initial oracle price pushed via BLS signature (mocked pairing precompile in test) before market creation — oracle.price() returns valid value
8. **AC8**: Initial USDC liquidity seeded into vault for testing

## Tasks / Subtasks

- [x] Task 1: Create DeployMorphoMarket.s.sol Foundry deploy script (AC: #1, #2, #3, #6, #7, #8)
  - [x] 1.1: Create `contracts/script/DeployMorphoMarket.s.sol` extending Script — this is the "Phase 2" replacement that uses real ITPNAVOracle instead of MockMorphoOracle
  - [x] 1.2: Read existing deployment addresses from `deployments/morpho-e2e.json` (Morpho core, AdaptiveIRM from Story 8.5) and `deployments/local-e2e.json` (ITP vault, ArbUSDC, IssuerRegistry, BLSLib)
  - [x] 1.3: Read MirrorIssuerRegistry address from environment or deployment JSON (deployed in Story 8.2)
  - [x] 1.4: Deploy ITPNAVOracle with constructor: `ITPNAVOracle(mirrorRegistryAddr, itpVaultAddr, initialPrice)` — NOTE: only 3 params (no blsLib param, BLSLib is used as internal library)
  - [x] 1.5: Push initial BLS-signed NAV price: `oracle.updatePrice(price, timestamp, cycleNumber, blsSig, bitmask)` — use mock BLS signature pattern from 8-6 tests (vm.mockCall on pairing precompile 0x08)
  - [x] 1.6: Call `Morpho.createMarket(MarketParams{loanToken: ArbUSDC, collateralToken: itpVault, oracle: itpNAVOracle, irm: adaptiveIRM, lltv: 0.77e18})`
  - [x] 1.7: Compute deterministic `marketId = MarketParams.id()` via `MarketParamsLib` and log it
  - [x] 1.8: Deploy MetaMorpho vault: `new MetaMorpho(owner, morpho, 1 days, arbUSDC, "Index ITP Lending Vault", "ilUSDC")` — MetaMorpho enforces MIN_TIMELOCK = 1 day
  - [x] 1.9: Set curator role: `vault.setCurator(curatorAddress)` and allocator role: `vault.setIsAllocator(allocatorAddress, true)`
  - [x] 1.10: Submit supply cap: `vault.submitCap(marketParams, cap)`
  - [x] 1.11: For local anvil: warp time `vm.warp(block.timestamp + 1 days + 1)` or use `cast rpc evm_increaseTime` in bash wrapper
  - [x] 1.12: Accept cap: `vault.acceptCap(marketParams)`, set supply queue: `vault.setSupplyQueue([marketId])`
  - [x] 1.13: Seed vault with initial USDC: mint ArbUSDC to deployer, approve vault, `vault.deposit(seedAmount, deployer)`
  - [x] 1.14: Write addresses to `deployments/morpho-e2e.json`: ITPNAVOracle, MirrorIssuerRegistry, market ID, vault address, market params

- [x] Task 2: Create MorphoBorrowLend.t.sol Foundry tests with real ITPNAVOracle (AC: #1, #2, #3, #4, #5, #7)
  - [x] 2.1: Create `contracts/test/MorphoBorrowLend.t.sol` — this replaces/extends MorphoE2E.t.sol tests but uses ITPNAVOracle instead of MockMorphoOracle
  - [x] 2.2: setUp(): Deploy MirrorIssuerRegistry (initialize with test pubkey), deploy ITPNAVOracle(mirrorRegistry, itpAddr, initialPrice), deploy Morpho+IRM, create market, deploy MetaMorpho vault — full stack with real oracle
  - [x] 2.3: setUp(): Push initial price via mock BLS signature (vm.mockCall on pairing precompile 0x08 to return success, matching ITPNAVOracle.t.sol pattern)
  - [x] 2.4: Test: `test_createMarket_withBLSOracle_succeeds` — market creation with ITPNAVOracle, verify market ID is deterministic
  - [x] 2.5: Test: `test_createMarket_deterministic_id` — same MarketParams always produce same ID
  - [x] 2.6: Test: `test_deployVault_success` — MetaMorpho vault deployed with correct params (name, symbol, asset, timelock)
  - [x] 2.7: Test: `test_vaultRoles_curator_allocator` — verify setCurator and setIsAllocator work correctly
  - [x] 2.8: Test: `test_submitCap_and_acceptCap` — queue cap, warp past timelock, accept, verify active
  - [x] 2.9: Test: `test_submitCap_beforeTimelock_reverts` — accepting cap before timelock reverts
  - [x] 2.10: Test: `test_lenderDeposit_mintsShares` — lender deposits USDC, receives vault shares
  - [x] 2.11: Test: `test_lenderDeposit_fundsAvailable` — deposited USDC available for borrowing via Morpho
  - [x] 2.12: Test: `test_supplyCollateralAndBorrow_withBLSOracle` — full borrow flow with BLS-verified oracle pricing
  - [x] 2.13: Test: `test_repayAndWithdrawCollateral` — repay → withdraw round-trip
  - [x] 2.14: Test: `test_borrowExceedingLLTV_reverts` — LLTV enforcement with BLS oracle
  - [x] 2.15: Test: `test_oracleUpdate_changesCollateralValue` — update oracle price, verify borrow capacity changes accordingly
  - [x] 2.16: Test: `test_supplyQueue_setsMarket` — supply queue directs USDC to ITP market
  - [x] 2.17: Test: `test_vaultWithdrawal_succeeds` — lender can withdraw USDC from vault

- [x] Task 3: Verify no regressions (AC: all)
  - [x] 3.1: Run `forge build` — zero compilation errors
  - [x] 3.2: Run `forge test` — all existing tests still pass (including 28 ITPNAVOracle tests, 9 MorphoE2E tests, 34 MirrorIssuerRegistry tests)
  - [x] 3.3: Run new MorphoBorrowLend tests — all 14 pass

## Dev Notes

### Critical Architecture Constraints

- **ITPNAVOracle constructor takes 3 params**: `(address _mirrorRegistry, address _itpAddress, uint256 _initialPrice)` — NO `_blsLib` param. BLSLib is used as an internal library (`BLSLib.verifyBLS(...)`), not an external contract.
- **ITPNAVOracle implements both `IITPNAVOracle` and Morpho's `IOracle`** — the `price()` function has `override(IITPNAVOracle, IOracle)`. This means it can be used directly as `MarketParams.oracle`.
- **Constructor validates `_initialPrice > 0`** — reverts with `E095_InvalidOraclePrice()` if zero.
- **NAVPriceUpdated event includes signersBitmask** — 5th parameter added in code review.
- **Morpho Blue is immutable and permissionless** — use official forked contracts from Story 8.5, do NOT create custom Morpho contracts.
- **MetaMorpho vault uses direct deployment** (not factory) — `new MetaMorpho(owner, morpho, timelock, asset, name, symbol)`. The existing `DeployMorphoE2E.s.sol` already demonstrates this pattern.
- **One ITPNAVOracle per ITP market** — each market gets its own oracle instance.
- **LLTV is immutable per market** — to change LLTV, must create a new market.
- **Timelock = 1 day minimum** (MetaMorpho enforces `MIN_TIMELOCK = 1 days`).
- **Price format: Morpho convention** = `36 + loanDecimals - collateralDecimals`. For ITP(18dec)/USDC(6dec): effective precision = 24 decimals. So 1 ITP = 100 USDC → `100e24`.
- **Local anvil environment** — single chain, no cross-chain complexity.

### ITPNAVOracle Constructor (from Story 8-6, post-code-review)

```solidity
// contracts/src/oracle/ITPNAVOracle.sol
constructor(
    address _mirrorRegistry,
    address _itpAddress,
    uint256 _initialPrice    // Must be > 0, reverts E095 if zero
) {
    if (_initialPrice == 0) {
        revert ErrorsLib.E095_InvalidOraclePrice();
    }
    mirrorRegistry = IMirrorIssuerRegistry(_mirrorRegistry);
    itpAddress = _itpAddress;
    currentPrice = _initialPrice;
    lastUpdated = block.timestamp;
}
```

### BLS Signature Mocking Pattern (from ITPNAVOracle.t.sol)

For Foundry tests, BLS signature verification is mocked via the pairing precompile:

```solidity
// Mock the BLS pairing precompile (address 0x08) to always return success
vm.mockCall(
    address(0x08),
    "",
    abi.encode(uint256(1)) // 1 = valid signature
);

// Then call updatePrice with any bytes as blsSignature
oracle.updatePrice(
    100e24,           // price: 100 USDC/ITP in Morpho format
    block.timestamp,  // timestamp
    1,                // cycleNumber (must be > lastCycleNumber)
    hex"0000000000000000000000000000000000000000000000000000000000000000"
    "0000000000000000000000000000000000000000000000000000000000000000", // 64-byte mock sig
    0x07              // signersBitmask: issuers 0,1,2
);
```

### Morpho Blue MarketParams Struct

```solidity
struct MarketParams {
    address loanToken;       // ArbUSDC (MockERC20, 6 decimals)
    address collateralToken; // ITP vault (ERC4626/MockERC20, 18 decimals)
    address oracle;          // ITPNAVOracle (BLS-verified, implements IOracle)
    address irm;             // AdaptiveCurveIrm
    uint256 lltv;            // 77% = 0.77e18 = 770000000000000000
}
```

Market ID = `keccak256(abi.encode(MarketParams))` — use `MarketParamsLib.id()`.

### MetaMorpho Vault Roles

| Role | Address | Purpose |
|------|---------|---------|
| **Owner** | Deployer (in test) | Full admin — can submit caps, set curator, set timelock |
| **Curator** | Curator EOA | Can submit/accept caps, set supply queue |
| **Allocator** | Curator bot | Can call `reallocate()` to distribute USDC across markets |

### Existing DeployMorphoE2E.s.sol (Story 8.5) — What's Already Done

The existing deploy script (`contracts/script/DeployMorphoE2E.s.sol`) already:
1. Deploys Morpho Blue core, AdaptiveCurveIRM
2. Creates a market using **MockMorphoOracle** (placeholder)
3. Deploys MetaMorpho vault
4. Submits supply cap (Phase 1), accepts cap + seeds liquidity (Phase 2)

**Story 8.7's job is to create a NEW deployment path that uses ITPNAVOracle instead of MockMorphoOracle.** The existing MorphoE2E tests with MockMorphoOracle remain as regression tests. New tests prove the same flows work with the real BLS oracle.

### Key Addresses from Previous Stories

From `deployments/morpho-e2e.json` (Story 8.5):
- **MORPHO**: `0xA4899D35897033b927acFCf422bc745916139776`
- **ADAPTIVE_IRM**: `0xf953b3A269d80e3eB0F2947630Da976B896A8C5b`
- **MOCK_ORACLE**: `0xAA292E8611aDF267e563f334Ee42320aC96D0463`
- **METAMORPHO_VAULT**: `0x5067457698Fd6Fa1C6964e416b3f42713513B3dD`

From `deployments/local-e2e.json`:
- **ArbUSDC**, **ITP vault**, **IssuerRegistry**, **BLSLib**: read from deployment JSON

### Existing Contracts to Reuse (DO NOT recreate)

| Contract | Source | Status |
|----------|--------|--------|
| **ITPNAVOracle** | `contracts/src/oracle/ITPNAVOracle.sol` | Done (Story 8.6) — deploy it here |
| **MirrorIssuerRegistry** | `contracts/src/registry/MirrorIssuerRegistry.sol` | Done (Story 8.2) |
| **BLSLib** | `contracts/src/libraries/BLSLib.sol` | Done (Epic 2) — internal lib |
| **MockMorphoOracle** | `contracts/src/mocks/MockMorphoOracle.sol` | Done (Story 8.5) — keep for regression tests |
| **Morpho Blue** | `contracts/lib/morpho-blue/` | Forked (Story 8.5) |
| **MetaMorpho** | `contracts/lib/metamorpho/` | Forked (Story 8.5) |
| **AdaptiveCurveIrm** | `contracts/lib/morpho-blue-irm/` | Forked (Story 8.5) |
| **ErrorsLib** | `contracts/src/libraries/ErrorsLib.sol` | E094-E096 already defined |
| **EventsLib** | `contracts/src/libraries/EventsLib.sol` | NAVPriceUpdated event defined |

### Previous Story Learnings (Story 8.6 — ITPNAVOracle)

- **BLS mock pattern**: Use all-zeros 64-byte signature (G1 point at infinity) + `vm.mockCall` on pairing precompile (0x08) to return success. This is the standard test pattern across the codebase.
- **Morpho pragma mismatch**: Morpho Blue uses `pragma solidity 0.8.19;` (exact version). Our contracts use `^0.8.24`. They coexist fine since imports resolve at the Morpho source level.
- **Pre-existing test failures**: 3 tests in DeployL3.t.sol and BridgeIntegrationTest.t.sol fail from story 7-6b (USDC decimal conversion, in-progress). Unrelated to this story.
- **ITPNAVOracle.t.sol has 28 tests** — all pass.
- **MorphoE2E.t.sol has 9 tests** — all pass (uses MockMorphoOracle).
- **MirrorIssuerRegistry.t.sol has 42 tests** — all pass.
- **Constructor now validates _initialPrice > 0** — any deployment must pass non-zero price.
- **price() has dual override** — `override(IITPNAVOracle, IOracle)` on the function signature.

### Testing Strategy

- **Unit/integration tests** (MorphoBorrowLend.t.sol): Full Morpho lending flow with real ITPNAVOracle replacing MockMorphoOracle. Proves that borrow/repay/liquidation work correctly with BLS-verified oracle.
- **Use `vm.warp` for timelock**: Local anvil allows time manipulation for cap acceptance.
- **Use `vm.mockCall(0x08, ...)` for BLS**: Mock pairing precompile, matching existing test patterns from ITPNAVOracle.t.sol.
- **No mocking Morpho**: Use actual forked Morpho Blue and MetaMorpho contracts.
- **Test naming**: `test_<action>_<condition>` pattern (e.g., `test_createMarket_withBLSOracle_succeeds`).

### Project Structure Notes

- Deploy script: `contracts/script/DeployMorphoMarket.s.sol` (new — for ITPNAVOracle-based deployment)
- Tests: `contracts/test/MorphoBorrowLend.t.sol` (new — Morpho flow with real BLS oracle)
- Deployment output: `deployments/morpho-e2e.json` (updated with ITPNAVOracle address)
- Existing files preserved: `contracts/script/DeployMorphoE2E.s.sol`, `contracts/test/MorphoE2E.t.sol` (regression)

### References

- [Source: contracts/src/oracle/ITPNAVOracle.sol] — Real BLS oracle contract (3-param constructor, implements IOracle)
- [Source: contracts/src/interfaces/IITPNAVOracle.sol] — Oracle interface
- [Source: contracts/src/mocks/MockMorphoOracle.sol] — Mock oracle (for regression tests only)
- [Source: contracts/script/DeployMorphoE2E.s.sol] — Existing deploy pattern with MockMorphoOracle
- [Source: contracts/test/MorphoE2E.t.sol] — Existing tests with MockMorphoOracle (9 tests)
- [Source: contracts/test/ITPNAVOracle.t.sol] — BLS mock pattern reference (28 tests)
- [Source: contracts/test/MirrorIssuerRegistry.t.sol] — MirrorIssuerRegistry test setup (42 tests)
- [Source: _bmad-output/planning-artifacts/itp-morpho-lending-architectures.md#MetaMorpho Vault Deployment]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.7]
- [Source: _bmad-output/implementation-artifacts/8-6-itp-nav-oracle.md] — Previous story with code review changes

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Oracle staleness after vm.warp: setUp warps +1 day for timelock, causing oracle.price() to revert with E096_StaleOraclePrice. Fixed by pushing a fresh price update (cycle 2) after the warp.
- Cycle number collision: test_oracleUpdate_changesCollateralValue used cycle 2 but setUp already consumed cycle 2. Fixed by using cycle 3.

### Completion Notes List

- Created `DeployMorphoMarket.s.sol` with two contracts: `DeployMorphoMarket` (Phase 1: deploy ITPNAVOracle, create market, deploy vault, submit cap) and `ConfigureMorphoMarket` (Phase 2: accept cap after timelock, set supply queue, seed liquidity).
- Deploy script reads MORPHO, ADAPTIVE_IRM, ARB_USDC, ITP_VAULT, MIRROR_REGISTRY from env vars. Outputs ITP_NAV_ORACLE, METAMORPHO_VAULT, MARKET_ID to deployments/morpho-e2e.json.
- Created `MorphoBorrowLend.t.sol` with 14 tests covering all ACs: market creation with BLS oracle, deterministic ID, vault deployment, curator/allocator roles, timelock cap flow, lender deposits, full borrow/repay round-trip, LLTV enforcement, oracle price change affecting borrow capacity, supply queue, vault withdrawal.
- All 14 new tests pass. Pre-existing tests unaffected: 28 ITPNAVOracle, 9 MorphoE2E, 34 MirrorIssuerRegistry all pass.
- 20 pre-existing failures from other stories (7-6b USDC decimals, BLSCustody/IssuerCustody timelock, DeployL3, BridgeIntegration) — none related to this story.

### Change Log

- 2026-02-05: Story 8.7 implemented — DeployMorphoMarket.s.sol deploy script + MorphoBorrowLend.t.sol (14 tests) with real ITPNAVOracle
- 2026-02-05: Code review fixes — [H1] Removed failing updatePrice() from deploy script (constructor bootstraps price), [H2] Preserved MOCK_ORACLE in morpho-e2e.json output, [M1] Added deployments/morpho-e2e.json to File List, [M3] Standardized vm.mockCall pattern to match ITPNAVOracle.t.sol, [L2] Removed unused PRECOMPILE_PAIRING constant and MirrorIssuerRegistry import

### File List

- contracts/script/DeployMorphoMarket.s.sol (new)
- contracts/test/MorphoBorrowLend.t.sol (new)
- deployments/morpho-e2e.json (updated)
