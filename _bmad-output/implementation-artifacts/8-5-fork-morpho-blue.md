# Story 8.5: Fork Morpho Blue + MetaMorpho to Local Anvil

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **Morpho Blue and MetaMorpho contracts forked and deployed on the local anvil chain alongside the existing vital-test contracts**,
So that **lending/borrowing functionality can be tested in the same environment as the Index protocol without cross-chain complexity**.

## Acceptance Criteria

1. **AC1**: Morpho Blue core (`Morpho.sol`) is deployed on the "Mock Arbitrum" side of the local anvil via a Forge deploy script
2. **AC2**: MetaMorpho vault can be deployed via the MetaMorpho factory or directly, with USDC (ArbUSDC, 6 decimals) as the loan token
3. **AC3**: AdaptiveCurveIRM (interest rate model) is deployed and enabled on Morpho
4. **AC4**: `Morpho.createMarket()` succeeds with valid MarketParams (loanToken=ArbUSDC, collateralToken=ITP, oracle=mock, irm=AdaptiveCurveIRM, lltv=77%)
5. **AC5**: All Morpho contract addresses are written to `deployments/morpho-e2e.json`
6. **AC6**: `forge build` compiles without errors after adding Morpho dependencies
7. **AC7**: Existing vital-test Foundry tests still pass (no regressions)
8. **AC8**: A Foundry test verifies: deploy Morpho → create market → deposit USDC into vault → supply ITP collateral → borrow USDC (round-trip sanity check)
9. **AC9**: The deploy script references existing ArbUSDC (MockERC20, 6 decimals) and existing ITP vault tokens as collateral — no new tokens created

## Tasks / Subtasks

- [x] Task 1: Add Morpho Blue dependencies via forge install (AC: #6)
  - [x] 1.1: Run `forge install morpho-org/morpho-blue` in `contracts/` directory
  - [x] 1.2: Run `forge install morpho-org/morpho-blue-irm` for AdaptiveCurveIRM
  - [x] 1.3: Run `forge install morpho-org/metamorpho` for MetaMorpho vault
  - [x] 1.4: Add remappings to `contracts/foundry.toml`:
    ```
    "@morpho-blue/=lib/morpho-blue/src/",
    "@morpho-blue-irm/=lib/morpho-blue-irm/src/",
    "@metamorpho/=lib/metamorpho/src/"
    ```
  - [x] 1.5: Run `forge build` — resolve any compilation issues (version conflicts, missing deps)
  - [x] 1.6: Verify existing tests still compile: `forge test --no-match-test "Fork" -q`

- [x] Task 2: Handle Solidity version compatibility (AC: #6, #7)
  - [x] 2.1: Morpho Blue uses `pragma solidity 0.8.19`, project uses `solc = "0.8.24"` — verify forge handles multi-version compilation via `auto_detect_solc = true` or adjust foundry.toml
  - [x] 2.2: If Morpho's strict `0.8.19` pragma conflicts, add `via_ir = false` or use `solc_version` per-file config in foundry.toml
  - [x] 2.3: Verify MetaMorpho and morpho-blue-irm pragmas are compatible
  - [x] 2.4: If needed, add Morpho's own OpenZeppelin dependency path to remappings to avoid conflicts with project's OZ v5.1.0

- [x] Task 3: Create DeployMorphoE2E.s.sol deploy script (AC: #1, #2, #3, #4, #5)
  - [x] 3.1: Create `contracts/script/DeployMorphoE2E.s.sol` extending `forge-std/Script.sol`
  - [x] 3.2: Deploy Morpho.sol core with `msg.sender` as owner
  - [x] 3.3: Deploy AdaptiveCurveIRM
  - [x] 3.4: Deploy a simple MockMorphoOracle that implements `IOracle` (returns configurable 36-decimal price) — this is a placeholder until Story 8.6 (ITPNAVOracle)
  - [x] 3.5: Call `morpho.enableIrm(address(irm))` to whitelist the IRM
  - [x] 3.6: Call `morpho.enableLltv(0.77e18)` to whitelist 77% LLTV (Tier A per architecture)
  - [x] 3.7: Create market via `morpho.createMarket(MarketParams({loanToken: arbUSDC, collateralToken: itpVault, oracle: mockOracle, irm: irm, lltv: 0.77e18}))`
  - [x] 3.8: Deploy MetaMorpho vault with asset=ArbUSDC, name="Index ITP Lending Vault", symbol="ilUSDC"
  - [x] 3.9: Configure vault: set curator, set allocator, submit market cap
  - [x] 3.10: Seed vault with initial USDC liquidity for testing (mint + deposit)
  - [x] 3.11: Write all addresses to `deployments/morpho-e2e.json` matching existing JSON format
  - [x] 3.12: Console.log all deployed addresses

- [x] Task 4: Create MockMorphoOracle.sol (AC: #4, #8)
  - [x] 4.1: Create `contracts/src/mocks/MockMorphoOracle.sol`
  - [x] 4.2: Implement Morpho's `IOracle` interface: single `price() external view returns (uint256)` function
  - [x] 4.3: Add `setPrice(uint256 newPrice)` admin function for testing
  - [x] 4.4: Price format: 36 decimals as required by Morpho Blue
  - [x] 4.5: Initialize with a sensible default price (e.g., 1e36 for 1:1 ITP-to-USDC peg)
  - [x] 4.6: Use `pragma solidity ^0.8.20` matching project conventions

- [x] Task 5: Foundry integration test (AC: #8)
  - [x] 5.1: Create `contracts/test/MorphoE2E.t.sol`
  - [x] 5.2: Test setup: deploy Morpho, IRM, oracle, create market
  - [x] 5.3: Test: lender deposits USDC into MetaMorpho vault → vault shares minted
  - [x] 5.4: Test: user approves ITP → supplyCollateral → borrow USDC → verify balances
  - [x] 5.5: Test: user repays USDC → withdrawCollateral → verify ITP returned
  - [x] 5.6: Test: borrow exceeding LLTV reverts
  - [x] 5.7: Test: createMarket with valid params succeeds, market ID queryable

- [x] Task 6: Verify no regressions (AC: #7)
  - [x] 6.1: Run `forge test` in contracts/ — all existing tests pass
  - [x] 6.2: Run `forge build` — clean compilation
  - [x] 6.3: Verify `local-e2e-deploy.sh` still works with new dependencies present
  - [x] 6.4: Check that git submodule additions don't break anything

- [x] Task 7: Update deploy orchestration (AC: #5, #9)
  - [x] 7.1: Add Morpho deploy step to `scripts/local-e2e-deploy.sh` (runs AFTER vital-test contracts are deployed)
  - [x] 7.2: Extract ArbUSDC and ITP vault addresses from existing deployment for use in Morpho deploy
  - [x] 7.3: Write `deployments/morpho-e2e.json` with: morpho, irm, oracle, vault, marketId addresses

## Dev Notes

### Architecture Context

This is **Story 8.5** in **Epic 8: ITP-Morpho Lending Protocol**, Phase 2 (Core Morpho Deployment). This story establishes the foundation for all subsequent Morpho stories (8.6-8.9) by getting the Morpho Blue + MetaMorpho contracts compiled and deployed locally.

**Dependencies completed:**
- Story 8.1: RegistryStateChanged event added to IssuerRegistry (done)
- Story 8.2: MirrorIssuerRegistry deployed on Arbitrum side (done)
- Story 8.3: Issuer nav-sign endpoint (done)
- Story 8.4: Issuer registry-sync endpoint (review)

**What this story unlocks:**
- Story 8.6: ITPNAVOracle (BLS-verified) — replaces MockMorphoOracle
- Story 8.7: Create production Morpho market + MetaMorpho vault
- Story 8.8: User borrow flow
- Story 8.9: User repay flow

### Morpho Blue Technical Details

**Repos to install:**
- `morpho-org/morpho-blue` — Core Morpho.sol (~650 lines, immutable, permissionless)
- `morpho-org/morpho-blue-irm` — AdaptiveCurveIRM (auto-targeting ~90% utilization)
- `morpho-org/metamorpho` — MetaMorpho vault framework

**IOracle interface** (the only thing Morpho needs from oracle):
```solidity
interface IOracle {
    /// @notice Returns price scaled by 1e36.
    /// Precision = 36 + loanTokenDecimals - collateralTokenDecimals
    function price() external view returns (uint256);
}
```

**MarketParams struct:**
```solidity
struct MarketParams {
    address loanToken;        // ArbUSDC (6 decimals)
    address collateralToken;  // ITP vault token (18 decimals)
    address oracle;           // IOracle implementation
    address irm;             // AdaptiveCurveIRM
    uint256 lltv;            // 0.77e18 (77%)
}
```

**Market creation requires two owner-only setup calls first:**
```solidity
morpho.enableIrm(address(irm));    // Whitelist the IRM
morpho.enableLltv(0.77e18);         // Whitelist the LLTV
morpho.createMarket(marketParams);   // Anyone can call this
```

**Morpho Blue uses `pragma solidity 0.8.19`** — the project uses `solc = "0.8.24"`. Forge handles multi-version compilation automatically with `auto_detect_solc` (default true). The strict pragma in Morpho's contracts means Forge will compile them with 0.8.19 and the project's contracts with 0.8.24. This should work out of the box, but verify.

### Price Format for Oracle

For ITP (18 decimals) as collateral and ArbUSDC (6 decimals) as loan token:
- Precision = 36 + 6 - 18 = 24 decimals
- If 1 ITP = 1 USDC, then `price()` returns `1e24`
- If 1 ITP = 100 USDC, then `price()` returns `100e24` = `100 * 10^24`

**CRITICAL**: Get the decimal math right in MockMorphoOracle. Wrong decimals will cause borrow amounts to be wildly wrong.

### MetaMorpho Vault Deployment

MetaMorpho can be deployed either:
1. Via MetaMorpho factory (CREATE2, deterministic) — more production-like
2. Direct deployment — simpler for E2E testing

For this story, **use direct deployment** (simpler). The factory can be used in Story 8.15 (E2E deploy script).

MetaMorpho vault constructor/initialize params:
- `owner`: curator multisig (use deployer for E2E)
- `asset`: ArbUSDC address
- `name`: "Index ITP Lending Vault"
- `symbol`: "ilUSDC"
- `timelock`: 0 for testing (skip timelock in E2E), or 24 hours for production-like

**After deployment, curator setup:**
```solidity
vault.submitCap(marketId, supplyCap);  // Submit market cap
// If timelock > 0, wait, then:
vault.acceptCap(marketId);
vault.setSupplyQueue([marketId]);       // Set supply order
vault.setWithdrawQueue([marketId]);     // Set withdraw order
```

For E2E with timelock=0, `submitCap` + `acceptCap` can be called in same tx.

### Existing Contract Addresses (from local-e2e deployment)

The Morpho deploy script must reference existing contracts from `deployments/local-e2e.json`:
- **ArbUSDC**: `contracts.ARB_USDC` — MockERC20 with 6 decimals (loan token)
- **ITP Vault**: `itps.CryptoBlend.vault` or create via Index.sol
- **IssuerRegistry**: `contracts.ISSUER_REGISTRY` — for future BLS oracle (Story 8.6)

**The deploy script should accept these addresses as constructor args or read from deployment JSON.**

### Deployment JSON Format

Follow existing pattern from `deployments/local-e2e.json`:
```json
{
  "chainId": 1234567890,
  "deployer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "timestamp": <unix_timestamp>,
  "contracts": {
    "MORPHO": "0x...",
    "ADAPTIVE_IRM": "0x...",
    "MOCK_ORACLE": "0x...",
    "METAMORPHO_VAULT": "0x...",
    "MARKET_ID": "0x..."
  },
  "marketParams": {
    "loanToken": "0x...",
    "collateralToken": "0x...",
    "oracle": "0x...",
    "irm": "0x...",
    "lltv": "770000000000000000"
  }
}
```

### Solidity Version Strategy

| Contract | Pragma | Compiled With |
|----------|--------|---------------|
| Morpho.sol | `0.8.19` (strict) | solc 0.8.19 |
| AdaptiveCurveIRM | `0.8.19` (strict) | solc 0.8.19 |
| MetaMorpho | varies | auto-detect |
| MockMorphoOracle | `^0.8.20` | solc 0.8.24 |
| DeployMorphoE2E | `^0.8.20` | solc 0.8.24 |
| MorphoE2E.t.sol | `^0.8.20` | solc 0.8.24 |

Forge `auto_detect_solc = true` (default) will handle this. If compilation fails, explicitly set `auto_detect_solc = true` in foundry.toml.

### Potential Pitfalls

1. **OpenZeppelin version conflict**: Morpho Blue may depend on a different OZ version than the project's v5.1.0. Check Morpho's `lib/` after install. May need separate remapping for Morpho's OZ.
2. **Solidity version**: Morpho uses strict `0.8.19`, project uses `0.8.24`. Auto-detect should handle it but verify.
3. **Gas token**: Local anvil uses ETH as gas. No issue.
4. **USDC decimals**: ArbUSDC is 6 decimals. Oracle price must account for `36 + 6 - 18 = 24` decimal precision. Wrong math = wrong borrow amounts.
5. **MetaMorpho dependencies**: MetaMorpho may pull in additional deps. Check for circular dependencies.
6. **Forge remapping conflicts**: If Morpho and project both have `@openzeppelin/` remappings pointing to different versions, specify full paths.

### Existing Patterns to Follow

- **Deploy scripts**: See `contracts/script/DeployLocalE2E.s.sol` — uses `vm.startBroadcast()`, deploys contracts, console.log addresses, no JSON export from Solidity (done in bash wrapper)
- **Mock contracts**: See `contracts/src/mocks/MockERC20.sol` — simple, minimal, owner-controlled
- **Error codes**: Use `ErrorsLib` pattern if adding custom errors
- **Test files**: See `contracts/test/Index.t.sol` for test patterns — setUp deploys all deps

### Project Structure Notes

New files to create:
- `contracts/script/DeployMorphoE2E.s.sol` — Morpho deployment script
- `contracts/src/mocks/MockMorphoOracle.sol` — Placeholder oracle implementing IOracle
- `contracts/test/MorphoE2E.t.sol` — Integration tests for Morpho deployment

Files to modify:
- `contracts/foundry.toml` — Add Morpho remappings
- `scripts/local-e2e-deploy.sh` — Add Morpho deploy step (optional, can be separate script)

New dependencies (git submodules):
- `contracts/lib/morpho-blue/`
- `contracts/lib/morpho-blue-irm/`
- `contracts/lib/metamorpho/`

### References

- [Source: _bmad-output/planning-artifacts/itp-morpho-lending-architectures.md#Test Environment: Forked Morpho on Local L3]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.5: Fork Morpho Blue + MetaMorpho to Local Anvil]
- [Source: contracts/foundry.toml] — Existing forge config (solc 0.8.24, remappings)
- [Source: contracts/script/DeployLocalE2E.s.sol] — Deploy script pattern
- [Source: contracts/src/mocks/MockERC20.sol] — Mock contract pattern
- [Source: deployments/local-e2e.json] — Deployment JSON format
- [Morpho Blue GitHub](https://github.com/morpho-org/morpho-blue) — Core protocol
- [MetaMorpho GitHub](https://github.com/morpho-org/metamorpho) — Vault framework
- [Morpho Blue IRM GitHub](https://github.com/morpho-org/morpho-blue-irm) — Interest rate models
- [Morpho Blue Oracle Interface](https://docs.morpho.org/get-started/resources/contracts/oracles) — IOracle docs
- [Morpho Blue Creating a Market](https://docs.morpho.org/curate/tutorials-market-v1/creating-market/) — Market creation guide

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

Session: 20260204-2226-m8f5

### Completion Notes List

- Tasks 1-4 (dependencies, version compatibility, deploy script, mock oracle) were implemented in a prior session. All submodules installed, remappings configured, `forge build` passes.
- `auto_detect_solc = false` in foundry.toml with `solc = "0.8.24"` — Morpho Blue's strict `0.8.19` pragma compiles successfully because Forge resolves via foundry.lock. MetaMorpho deployed via `deployCode()` to avoid via_ir conflicts.
- Task 5 (MorphoE2E.t.sol): Fixed `test_createMarket_succeeds` — was asserting `totalSupplyAssets == 0` but setUp() deposits 1M USDC into vault, so supply is non-zero. Changed to `assertGt(totalSupplyAssets, 0)`. All 8 tests pass.
- Task 6 (regression check): `forge build` exits 0. 1129 existing tests pass. 20 pre-existing failures in IssuerCustodyArb/L3 (timelock), DeployL3 (timelock drift), BridgeIntegration (USDC decimal conversion) — all from Story 7-6b (in-progress). No new regressions from Morpho additions.
- Task 7 (deploy orchestration): Added conditional Morpho deploy step to `scripts/local-e2e-deploy.sh` after ITP creation (step 4b). Extracts ArbUSDC and ITP vault addresses from environment. Writes `deployments/morpho-e2e.json` via the Forge script. Conditional on ITP vault being deployed.
- MetaMorpho uses MIN_TIMELOCK = 1 day (enforced by contract). Deploy script handles this via `evm_increaseTime` for anvil. Test uses `vm.warp()`.
- Oracle price for ITP(18dec)/USDC(6dec): precision = 36 + 6 - 18 = 24 decimals. Default: 100e24 (1 ITP = 100 USDC).
- morpho-blue-irm and metamorpho now registered as proper git submodules (previously existed as plain directories). Strict pragmas (`0.8.19`, `0.8.21`) changed to `>=` ranges for compatibility with project's solc 0.8.24 (auto_detect_solc=false). All 9 MorphoE2E tests pass, 1138 existing tests pass (20 pre-existing failures from Story 7-6b unchanged).

### File List

- contracts/test/MorphoE2E.t.sol (new — Morpho integration tests, 9 tests)
- contracts/src/mocks/MockMorphoOracle.sol (new — mock oracle implementing IOracle, with transferOwnership)
- contracts/script/DeployMorphoE2E.s.sol (new — Morpho deployment script, uses `new MetaMorpho()`)
- contracts/foundry.toml (modified — added Morpho remappings, dependency path overrides, pragma patch note)
- contracts/lib/morpho-blue/ (git submodule — morpho-org/morpho-blue, pragma patched to >=0.8.19)
- contracts/lib/morpho-blue-irm/ (git submodule — morpho-org/morpho-blue-irm, pragma patched to >=0.8.19)
- contracts/lib/metamorpho/ (git submodule — morpho-org/metamorpho, pragma patched to >=0.8.21)
- scripts/local-e2e-deploy.sh (modified — added Morpho deploy step 4b with fallback collateral)
- scripts/patch-vendor-pragmas.sh (new — re-applies pragma patches after git submodule update)

## Change Log

- 2026-02-04: Fixed test_createMarket_succeeds assertion (totalSupplyAssets > 0 instead of == 0). Added Morpho deploy step to local-e2e-deploy.sh. All 8 MorphoE2E tests pass, 1129 existing tests pass (20 pre-existing failures from Story 7-6b). Session: 20260204-2226-m8f5
- 2026-02-04: **Code Review fixes** — (1) H1: Fixed dead Morpho deploy in local-e2e-deploy.sh — removed ITP_VAULT guard, added fallback mock ITP collateral token creation; (2) H2: morpho-blue-irm and metamorpho must be registered as git submodules (manual step required); (3) H3: Fixed File List descriptions — corrected "modified"/"existing" to "new" for untracked files; (4) M3: Added test_vaultWithdrawal_succeeds to MorphoE2E.t.sol (verifies lender withdrawal round-trip); (5) M4: Changed deploy script JSON output path from CWD-relative to vm.projectRoot()-based. Review downgraded M1 (setWithdrawQueue not needed — MetaMorpho auto-adds on acceptCap) and M2 (auto_detect_solc=false works because Morpho uses >=0.8.19 not strict 0.8.19).
- 2026-02-04: **H2 resolved** — morpho-blue-irm and metamorpho registered as git submodules via `git submodule add`. Strict pragmas (`0.8.19`, `0.8.21`) in 4 files changed to `>=` ranges for solc 0.8.24 compatibility. All 9 MorphoE2E tests pass, 1138 tests succeed (20 pre-existing failures unchanged). Session: 20260204-cont.
- 2026-02-04: **Code Review #2 fixes** — (1) H1: Added `scripts/patch-vendor-pragmas.sh` to robustly re-apply pragma patches after submodule updates; added comment to foundry.toml documenting the requirement. Tested `auto_detect_solc=true` — fails due to incompatible version graph (Morpho 0.8.19 + MetaMorpho 0.8.21 + project ^0.8.20), confirming pragma hack is necessary. (2) H2: Replaced `deployCode("MetaMorpho.sol:MetaMorpho", ...)` with `new MetaMorpho(...)` in DeployMorphoE2E.s.sol — consistent with test deployment, since `via_ir=true` is already in foundry.toml. Removed unused IERC4626 import. (3) M1: Added `transferOwnership()` to MockMorphoOracle for multi-step deployment flexibility. (4) M3: Changed `test_repayAndWithdrawCollateral` to use share-based repay (robust against interest accrual). All 9 tests pass.
- 2026-02-05: **Code Review #3 fixes** — (1) M1: Fixed `scripts/patch-vendor-pragmas.sh` to be cross-platform (macOS + Linux) via sedi() helper that detects GNU vs BSD sed. (2) H4: Updated `docs/error-codes.md` range table to include E065-E096 (was stale at E064). All 9 MorphoE2E tests still pass.
