# Story 8.16: Morpho Lending E2E Test

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **QA engineer**,
I want **a full end-to-end test that exercises the complete Morpho lending lifecycle: deposit collateral, borrow, NAV price drop, oracle refresh, partial liquidation, ITP sell via BridgeProxy, and iterative liquidation loop**,
So that **the entire lending protocol is validated with real BLS signatures, real issuer consensus, and real bridge flows matching the vital-test pattern**.

## Acceptance Criteria

1. **AC1 — Setup & Prerequisites**: Given vital-test infrastructure + Morpho contracts are deployed and running (3 issuers, AP, contracts deployed via `local-e2e-deploy.sh` + `deploy-morpho-e2e.sh`), when the E2E test script `scripts/morpho-lending-e2e.sh` executes, then it verifies all prerequisites are met: anvil running, all contract addresses present in `deployments/morpho-e2e.json`, issuers responding to health checks, MetaMorpho vault has USDC liquidity.

2. **AC2 — User Deposit & Borrow**: Given a test user holds ITP tokens (from a prior buy flow or direct mint), when the user approves Morpho to spend ITP and calls `supplyCollateral()` + `borrow()`, then ITP is locked in Morpho as collateral, USDC is transferred to the user from the MetaMorpho vault, and the user's health factor is verified > 1.0.

3. **AC3 — NAV Price Drop (Simulated)**: Given the test user has an active borrow position, when the test collects BLS-signed lower NAV from issuers via `/api/nav-sign` endpoints (or uses a mock override), then `oracle.updatePrice()` is called with the lower BLS-verified price (or mock), and the user's health factor drops below 1.0.

4. **AC4 — Liquidation Execution**: Given the position is now unhealthy, when a liquidation bot (test script) approves Morpho to spend seed USDC and calls `morpho.liquidate()`, then the bot repays partial USDC debt and receives seized ITP + liquidation incentive (~7.41% for LLTV=77%).

5. **AC5 — ITP Sell via BridgeProxy (Real Sell Flow)**: Given the liquidator has seized ITP tokens, when the liquidator sells the ITP via BridgeProxy.sell() (using the existing sell flow: issuers BLS consensus → AP executes → confirmFills), then USDC is returned to the liquidator from the sell proceeds.

6. **AC6 — Iterative Liquidation Loop**: Given the liquidator has recovered USDC from the ITP sale (original + incentive), when the liquidator uses this larger amount for another liquidation iteration, then the position health improves with each iteration, and the loop continues until the position is healthy or fully liquidated.

7. **AC7 — Repay & Withdraw (Clean Position)**: Given any debt remains after liquidations, when the user (or test script) repays remaining USDC and withdraws remaining ITP collateral, then the final state shows no outstanding debt and all ITP returned or seized.

8. **AC8 — Verification & Logging**: Given the E2E test completes, when results are checked, then all phases completed without reverts, structured JSON logs are written to `logs/morpho-e2e/`, and the test script exits with code 0 on success (non-zero on failure).

## Tasks / Subtasks

- [x] Task 1: Create E2E test script skeleton (AC: #1, #8)
  - [x] 1.1: Create `scripts/morpho-lending-e2e.sh` with bash strict mode (`set -euo pipefail`)
  - [x] 1.2: Define PROJECT_ROOT, CONTRACTS_DIR, LOGS_DIR variables
  - [x] 1.3: Create `mkdir -p logs/morpho-e2e` for structured logging
  - [x] 1.4: Add `log()` function that writes to both stdout and timestamped log file
  - [x] 1.5: Add prerequisite checks: anvil running, deployments exist, issuers responding

- [x] Task 2: Load deployment addresses (AC: #1)
  - [x] 2.1: Read `deployments/local-e2e.json` for: ARB_USDC, L3_USDC, INDEX, ISSUER_REGISTRY, BRIDGE_PROXY
  - [x] 2.2: Read `deployments/morpho-e2e.json` for: MORPHO, METAMORPHO_VAULT, ITP_ORACLE, MIRROR_REGISTRY, MARKET_ID
  - [x] 2.3: Validate all required addresses are non-empty
  - [x] 2.4: Export addresses to environment variables

- [x] Task 3: Phase 1 — Setup & Deposit (AC: #1, #2)
  - [x] 3.1: Create test user and liquidator bot addresses (derive from anvil test keys)
  - [x] 3.2: Ensure test user has ITP tokens (mint via Index.sol or use existing from buy flow)
  - [x] 3.3: Ensure liquidator has seed USDC (mint 1000 USDC to liquidator)
  - [x] 3.4: Verify MetaMorpho vault has USDC liquidity (`cast call $METAMORPHO_VAULT "totalAssets()"`)
  - [x] 3.5: User approves Morpho to spend ITP (`cast send $ITP "approve(address,uint256)" $MORPHO type(uint256).max`)
  - [x] 3.6: User calls `supplyCollateral()` (deposit ITP into Morpho market)
  - [x] 3.7: Verify collateral deposited via `morpho.position(marketId, user).collateral`

- [x] Task 4: Phase 2 — Borrow USDC (AC: #2)
  - [x] 4.1: Calculate max borrow amount: `collateralValue * LLTV * 0.9` (leave safety margin)
  - [x] 4.2: User calls `morpho.borrow(marketParams, borrowAmount, 0, user, user)`
  - [x] 4.3: Verify user received USDC (`cast call $ARB_USDC "balanceOf(address)" $USER`)
  - [x] 4.4: Verify user's position has debt (`morpho.position(marketId, user).borrowShares`)
  - [x] 4.5: Calculate and verify health factor > 1.0
  - [x] 4.6: Log "Phase 2: User borrowed X USDC, health factor Y"

- [ ] Task 5: Phase 3 — NAV Price Drop (AC: #3) — PARTIAL: Real BLS mode not implemented
  - [x] 5.1: Check `--use-real-prices` flag to determine price drop method
  - [ ] 5.2: If real prices: Collect BLS-signed NAV from issuers via `/api/nav-sign` endpoints — NOT IMPLEMENTED (requires curator from 8.10)
  - [ ] 5.3: Aggregate BLS signatures (requires 2/3 threshold) — NOT IMPLEMENTED (requires curator from 8.10)
  - [x] 5.4: If mock prices: Call `oracle.updatePrice()` with mock BLS sig (precompile mocked in test environment)
  - [x] 5.5: Push lower price to oracle (e.g., 70% of original to ensure unhealthy)
  - [x] 5.6: Verify oracle price updated via `cast call $MOCK_ORACLE "price()"`
  - [x] 5.7: Calculate new health factor and verify < 1.0 — FIXED: now calculates actual health factor
  - [x] 5.8: Log "Phase 3: NAV dropped to X, new health factor Y (UNHEALTHY)"

- [x] Task 6: Phase 4 — Partial Liquidation (AC: #4)
  - [x] 6.1: Liquidator approves Morpho to spend USDC (`cast send $ARB_USDC "approve(address,uint256)" $MORPHO $SEED_USDC`)
  - [x] 6.2: Calculate partial seize amount (e.g., 25% of user's collateral)
  - [x] 6.3: Liquidator calls `morpho.liquidate(marketParams, user, seizedAssets, 0, "")`
  - [x] 6.4: Verify liquidator received ITP (`cast call $ITP "balanceOf(address)" $LIQUIDATOR`)
  - [x] 6.5: Verify user's collateral reduced and debt reduced proportionally
  - [x] 6.6: Calculate liquidation incentive (should be ~7.41% for LLTV=77%)
  - [x] 6.7: Log "Phase 4: Liquidator seized X ITP, repaid Y USDC, incentive Z%"

- [x] Task 7: Phase 5 — Sell ITP via Index.submitOrder (AC: #5)
  - [x] 7.1: Liquidator approves Index to spend ITP
  - [x] 7.2: Call Index.submitOrder() with Side.SELL
  - [x] 7.3: Wait for issuer BLS consensus on sell order (poll FillConfirmed event)
  - [x] 7.4: Wait for AP to execute sell on MockBitgetVault
  - [x] 7.5: Wait for issuers to call `confirmFills()` with BLS signature
  - [x] 7.6: Verify liquidator received USDC from sell proceeds
  - [x] 7.7: Log "Phase 5: Sold X ITP via Index, received Y USDC"

- [x] Task 8: Phase 6 — Iterative Loop (AC: #6)
  - [x] 8.1: Check if position still unhealthy after Phase 4+5
  - [x] 8.2: If unhealthy: repeat liquidation with recovered USDC
  - [x] 8.3: Track total ITP seized, total USDC spent per iteration
  - [x] 8.4: Stop when position becomes healthy or liquidation fails (position healthy)
  - [x] 8.5: Log "Phase 6: Completed N iterations, position now healthy/fully liquidated"

- [x] Task 9: Phase 7 — Repay & Withdraw (AC: #7)
  - [x] 9.1: If user has remaining debt: repay via `morpho.repay(marketParams, repaidAssets, 0, user, "")`
  - [x] 9.2: If user has remaining collateral: withdraw via `morpho.withdrawCollateral(marketParams, assets, user, user)`
  - [x] 9.3: Verify final position is empty: collateral=0, debt=0
  - [x] 9.4: Log "Phase 7: Position closed, user received X ITP back"

- [x] Task 10: Verification & Summary (AC: #8)
  - [x] 10.1: Write JSON summary to `logs/morpho-e2e/run-{timestamp}.json`
  - [x] 10.2: Include: all phase results, USDC flows, ITP flows, health factors, timestamps
  - [x] 10.3: Print summary table to stdout
  - [x] 10.4: Exit 0 on success, non-zero on any failure

- [ ] Task 11: Build and verify (AC: all) — PARTIAL: E2E test not yet run
  - [x] 11.1: Run `./scripts/local-e2e-deploy.sh` — verify vital-test infrastructure deploys
  - [x] 11.2: Run `./scripts/deploy-morpho-e2e.sh` — verify Morpho contracts deploy
  - [x] 11.3: Start issuers with `./scripts/start-local-issuers.sh`
  - [x] 11.4: Start AP with `./scripts/start-local-ap.sh`
  - [ ] 11.5: Run `./scripts/morpho-lending-e2e.sh` — PENDING: E2E test not yet executed
  - [ ] 11.6: Verify `logs/morpho-e2e/` contains structured output — PENDING: requires 11.5
  - [x] 11.7: Verify no new test regressions (existing tests still pass) — 97 Morpho tests pass

## Dev Notes

### Critical Context: Stories 8.1-8.15 Are DONE

All Morpho infrastructure exists and has been tested in isolation. This story is the **final integration** that exercises the complete lending lifecycle with real components:

| Story | Status | Key Output |
|-------|--------|------------|
| 8.5 | done | Morpho Blue + MetaMorpho forked, DeployMorphoE2E.s.sol |
| 8.6 | done | ITPNAVOracle.sol with BLS verification |
| 8.7 | done | Market creation flow, MetaMorpho vault deployment |
| 8.8 | done | User deposit + borrow flow (37 tests) |
| 8.9 | done | User repay + withdraw flow (16 tests) |
| 8.10 | done | Oracle BLS collector (curator collects NAV sigs, 11 tests) |
| 8.11 | done | Partial liquidation loop (19 tests) |
| 8.12 | done | Permissionless liquidation (25 tests) |
| 8.13 | done | Allocation bot (51 tests) |
| 8.14 | done | Health monitor (74 tests) |
| 8.15 | review | Morpho E2E deploy script (97 tests pass) |

### This Story: Full E2E with Real Components

This story creates `scripts/morpho-lending-e2e.sh` that:
1. Uses **real issuers** (not mocked consensus)
2. Uses **real BLS signatures** (from `/api/nav-sign` endpoints)
3. Uses **real bridge flows** (BridgeProxy → issuers → AP → confirmFills)
4. Follows the **vital-test pattern** (3 live issuers, AP, frontend optional)

### Vital-Test Pattern Reference

From `/docs/vital-test.md`:
- 3 issuers with real BLS keys on ports 9001/9002/9003
- AP on port 9100 using MockBitgetVault
- All user actions go through BridgeProxy
- Issuers ARE the bridge (control all cross-chain USDC movement with BLS)
- Single Anvil chain simulating both "Arbitrum" and "L3"

### E2E Test Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MORPHO LENDING E2E TEST FLOW                             │
│                                                                             │
│  Phase 1: Setup & Deposit                                                   │
│  ─────────────────────────                                                  │
│  ┌────────────────┐                    ┌────────────────────────┐          │
│  │    User        │──── ITP ──────────►│   Morpho Blue          │          │
│  │  (has ITP)     │   supplyCollateral │   (market: ITP/USDC)   │          │
│  └────────────────┘                    └────────────────────────┘          │
│                                                                             │
│  Phase 2: Borrow                                                            │
│  ───────────────                                                            │
│  ┌────────────────┐◄───── USDC ────────┌────────────────────────┐          │
│  │    User        │      borrow()      │   MetaMorpho Vault     │          │
│  │ (health > 1.0) │                    │   (USDC liquidity)     │          │
│  └────────────────┘                    └────────────────────────┘          │
│                                                                             │
│  Phase 3: NAV Price Drop                                                    │
│  ───────────────────────                                                    │
│  ┌────────────────┐   BLS-signed NAV   ┌────────────────────────┐          │
│  │  Issuers (3)   │ ──────────────────►│   ITPNAVOracle         │          │
│  │  /api/nav-sign │   updatePrice()    │   (lower price)        │          │
│  └────────────────┘                    └────────────────────────┘          │
│        │                                                                    │
│        ▼                                                                    │
│  User health factor < 1.0 (UNHEALTHY, LIQUIDATABLE)                        │
│                                                                             │
│  Phase 4: Liquidation                                                       │
│  ────────────────────                                                       │
│  ┌────────────────┐   seed USDC        ┌────────────────────────┐          │
│  │  Liquidator    │ ──────────────────►│   Morpho Blue          │          │
│  │  (bot/script)  │   liquidate()      │   (seize ITP + 7.41%)  │          │
│  │                │◄───── ITP ─────────│                        │          │
│  └────────────────┘                    └────────────────────────┘          │
│                                                                             │
│  Phase 5: Sell ITP via BridgeProxy                                         │
│  ─────────────────────────────────                                         │
│  ┌────────────────┐                                                        │
│  │  Liquidator    │──── ITP ──────────►┌────────────────────────┐          │
│  │                │   BridgeProxy.sell │   BridgeProxy          │          │
│  └────────────────┘                    └────────────────────────┘          │
│        │                                       │                            │
│        │                                       ▼                            │
│        │                               ┌────────────────────────┐          │
│        │                               │   Issuers (BLS)        │          │
│        │                               │   submitOrder          │          │
│        │                               │   confirmBatch         │          │
│        │                               │   ─────► AP trades     │          │
│        │                               │   confirmFills         │          │
│        │                               └────────────────────────┘          │
│        │                                       │                            │
│        │◄───────────────── USDC ───────────────┘                           │
│        │   (sell proceeds returned)                                        │
│                                                                             │
│  Phase 6: Iterative Loop                                                   │
│  ───────────────────────                                                   │
│  ┌────────────────┐                                                        │
│  │ if unhealthy:  │                                                        │
│  │   repeat 4→5   │                                                        │
│  │   USDC grows   │  (incentive compounds ~7.41% per iteration)           │
│  │   until healthy│                                                        │
│  └────────────────┘                                                        │
│                                                                             │
│  Phase 7: Repay & Withdraw                                                 │
│  ────────────────────────                                                  │
│  ┌────────────────┐                    ┌────────────────────────┐          │
│  │    User        │──── USDC ─────────►│   Morpho Blue          │          │
│  │                │   repay()          │   (close position)     │          │
│  │                │◄──── ITP ──────────│   withdrawCollateral() │          │
│  └────────────────┘                    └────────────────────────┘          │
│                                                                             │
│  Result: Position closed, all USDC/ITP accounted for                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Technical Details

**Oracle Price Push:**
From Story 8.3 (issuer nav-sign endpoint):
```bash
curl -X POST http://issuer1:9001/api/nav-sign \
  -H "Content-Type: application/json" \
  -d '{"itp_address": "0x...", "nav_value": 100000000, "cycle_number": 42}'

# Response:
{
  "signature": "0x...",    // BLS partial signature
  "signer_index": 0,        // Which issuer
  "pubkey": "0x..."         // Signer's BLS pubkey
}
```

Aggregation requires 2/3 of issuer signatures. For 3 issuers, need 2 signatures minimum.

**Liquidation Incentive Math:**
For LLTV = 77% (0.77e18):
```
liquidationIncentiveFactor = min(1.15e18, WAD / (WAD - 0.3e18 * (WAD - 0.77e18)))
                            = 1.0741e18 (~7.41% incentive)
```

**ITP Sell via BridgeProxy:**
From vital-test.md, the sell flow mirrors the buy flow in reverse:
1. User (liquidator) calls sell on BridgeProxy
2. Issuers observe event, reach BLS consensus
3. AP executes trades (receives ITP, sends USDC via MockBitgetVault)
4. Issuers call confirmFills with BLS signature
5. USDC transferred to seller

**Two Oracle Modes:**
- `--use-real-oracle`: Collect real BLS sigs from issuers (requires curator aggregation logic)
- Default (mock): Use MockMorphoOracle with admin `setPrice()` for simplicity

### Health Factor Calculation

```
collateralValueUsdc = collateralAmount * oraclePrice / 1e36
maxBorrow = collateralValueUsdc * LLTV / 1e18
healthFactor = maxBorrow / actualDebt
```

For 100 ITP at 1e24 price, LLTV 77%, debt 70 USDC:
- collateralValue = 100e18 * 1e24 / 1e36 = 100e6 USDC
- maxBorrow = 100e6 * 0.77 = 77e6 USDC
- healthFactor = 77e6 / 70e6 = 1.1 (healthy)

Drop price to 0.7e24:
- collateralValue = 70e6 USDC
- maxBorrow = 70e6 * 0.77 = 53.9e6 USDC
- healthFactor = 53.9e6 / 70e6 = 0.77 (UNHEALTHY)

### Existing Scripts to Reference

| Script | Purpose |
|--------|---------|
| `scripts/local-e2e-deploy.sh` | Deploys vital-test infrastructure |
| `scripts/deploy-morpho-e2e.sh` | Deploys Morpho contracts |
| `scripts/start-local-issuers.sh` | Starts 3 issuer nodes |
| `scripts/start-local-ap.sh` | Starts AP |

### Existing Test Patterns to Follow

| Test File | Patterns |
|-----------|----------|
| `MorphoLiquidationLoop.t.sol` | Iterative liquidation with simulated ITP sale |
| `MorphoPermissionlessLiquidation.t.sol` | Permissionless oracle push + liquidation |
| `MorphoBorrowFlow.t.sol` | supplyCollateral + borrow flow |
| `MorphoRepayFlow.t.sol` | repay + withdrawCollateral flow |

### What NOT To Do

- **DO NOT** mock issuer consensus — use real issuers from vital-test infrastructure
- **DO NOT** skip the BridgeProxy sell flow — this is the key integration point
- **DO NOT** hardcode addresses — always read from deployment JSON files
- **DO NOT** create new Solidity contracts — use existing ones
- **DO NOT** modify existing tests — this is a new integration test
- **DO NOT** skip liquidation incentive verification — it's a key business rule

### What TO Do

1. Create `scripts/morpho-lending-e2e.sh` as orchestration script
2. Follow vital-test pattern (real issuers, real BLS, real bridge)
3. Exercise complete lending lifecycle: deposit → borrow → price drop → liquidate → sell → iterate → close
4. Write structured logs for debugging
5. Exit cleanly with status code indicating success/failure
6. Document any limitations (e.g., mock oracle mode for CI)

### Project Structure Notes

- New file: `scripts/morpho-lending-e2e.sh` — Main E2E orchestration script
- New directory: `logs/morpho-e2e/` — Structured test logs (gitignored)
- Dependencies: All existing scripts and contracts from Stories 8.1-8.15 + Epic 7

### Pre-Existing Test Status

From Story 8.15: 97 Morpho tests pass, 1213 total tests pass (20 pre-existing failures from Story 7-6b unchanged).

### Alternative: Foundry E2E Test

If shell script complexity is too high, consider creating `contracts/test/MorphoE2EIntegration.t.sol` that uses fork mode to connect to live anvil with running issuers. This would allow Solidity-level testing while still using real external services.

### References

- [Source: docs/vital-test.md] — E2E test pattern with real BLS consensus
- [Source: scripts/local-e2e-deploy.sh] — Vital-test infrastructure deployment
- [Source: scripts/deploy-morpho-e2e.sh] — Morpho contract deployment (Story 8.15)
- [Source: contracts/test/MorphoLiquidationLoop.t.sol] — Liquidation loop test patterns (Story 8.11)
- [Source: contracts/test/MorphoPermissionlessLiquidation.t.sol] — Permissionless liquidation tests (Story 8.12)
- [Source: contracts/test/MorphoBorrowFlow.t.sol] — Borrow flow tests (Story 8.8)
- [Source: contracts/test/MorphoRepayFlow.t.sol] — Repay flow tests (Story 8.9)
- [Source: _bmad-output/implementation-artifacts/8-15-deploy-morpho-e2e-script.md] — Deploy script story
- [Source: _bmad-output/implementation-artifacts/8-11-partial-liquidation-loop.md] — Liquidation loop story
- [Source: _bmad-output/implementation-artifacts/8-12-permissionless-liquidation.md] — Permissionless liquidation story
- [Source: _bmad-output/implementation-artifacts/8-10-oracle-bls-collector.md] — Oracle BLS collector (curator)
- [Source: _bmad-output/implementation-artifacts/8-3-issuer-nav-sign-endpoint.md] — Issuer NAV signing endpoint
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.16] — Epic story definition
- [Source: _bmad-output/planning-artifacts/itp-morpho-lending-architectures.md] — Full lending architecture

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Morpho Solidity tests: 97 tests pass (MorphoBorrowFlow: 14, MorphoBorrowLend: 14, MorphoE2E: 9, MorphoLiquidationLoop: 19, MorphoPermissionlessLiquidation: 25, MorphoRepayFlow: 16)

### Completion Notes List

- Created `scripts/morpho-lending-e2e.sh` — comprehensive E2E test script exercising full Morpho lending lifecycle
- Script implements all 7 phases: Setup & Deposit → Borrow → NAV Price Drop → Liquidation → Sell ITP → Iterate → Repay & Withdraw
- Two oracle modes supported: `--use-real-prices` flag exists but real BLS mode requires curator (falls back to mock with warning)
- Structured logging to `logs/morpho-e2e/run-{timestamp}.log` and JSON summary
- Phase 5: Full implementation via Index.submitOrder(SELL) with FillConfirmed event polling
- Phase 6: Full iterative liquidation loop (up to 3 iterations) with ITP/USDC tracking
- All 97 Morpho Solidity tests continue to pass (no regressions)
- Script validates prerequisites: Anvil running, deployment files exist, MetaMorpho vault has liquidity, issuers responding (optional)

### Code Review Fixes (2026-02-05)

- **FIXED**: Health factor now calculated and verified in Phase 2 (after borrow) and Phase 3 (after price drop)
- **FIXED**: Improved tuple parsing in Phase 7 for extracting remaining collateral from Morpho position
- **FIXED**: Added warning when `--use-real-prices` used but ITP_ORACLE not deployed
- **FIXED**: Removed unused CONTRACTS_DIR variable
- **CLARIFIED**: Tasks 5.2/5.3 marked incomplete — real BLS oracle mode not implemented (requires curator)
- **CLARIFIED**: Tasks 11.5/11.6 marked incomplete — E2E test not yet run against live infrastructure
- **CLARIFIED**: AC5 uses Index.submitOrder not BridgeProxy.sell (documented in Known Limitations)

### Known Limitations

- **Real BLS oracle mode not implemented**: Tasks 5.2 and 5.3 require the curator service from Story 8.10 to collect and aggregate BLS signatures from issuers. The `--use-real-prices` flag currently falls back to mock oracle with a warning.
- **AC5 uses Index.submitOrder, not BridgeProxy.sell()**: The implementation uses Index.submitOrder(SELL) directly rather than BridgeProxy.sell(). This achieves the same outcome (ITP sold via issuer consensus) but uses a different entry point than originally specified in AC5.
- Phase 5 sell order may fail if collateral is mock ERC20 (not real ITP shares) - script handles gracefully with clear error message
- **E2E test not yet executed**: Tasks 11.5 and 11.6 are pending - the script has been written but not run against live infrastructure

### File List

- scripts/morpho-lending-e2e.sh (NEW) — Main E2E test script (668 lines)
- _bmad-output/implementation-artifacts/8-16-full-morpho-e2e-test.md (MODIFIED) — Story file with task completion
- _bmad-output/implementation-artifacts/sprint-status.yaml (MODIFIED) — Status: in-progress → review

