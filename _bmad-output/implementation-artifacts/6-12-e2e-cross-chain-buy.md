# Story 6.12: E2E Test - Cross-Chain Buy

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user on Arbitrum**,
I want **to buy ITPs without bridging to L3 first**,
so that **I have better UX by calling buyITPFromArbitrum on Arbitrum and receiving ITP tokens minted on L3**.

## Acceptance Criteria

1. **AC1:** User calls `ArbBridgeCustody.buyITPFromArbitrum()` on Arbitrum
   - User provides: itpId, amount, limitPrice, slippageTier, deadline
   - USDC transferred from user to ArbBridgeCustody via `safeTransferFrom`
   - `CrossChainOrderCreated` event emitted with orderId, itpId, user, amount
   - Order stored in `crossChainOrders[orderId]` with all parameters

2. **AC2:** Issuers observe the CrossChainOrderCreated event and process the order
   - Issuers read cross-chain order via `getCrossChainOrder(orderId)` on ArbBridgeCustody
   - Issuers create a corresponding order on L3 Index.sol via `submitOrder()`
   - Order batched and confirmed via `confirmBatch()` on L3

3. **AC3:** AP executes the trade (simulated via mock/direct calls in E2E)
   - TradeRequest event emitted on L3 for AP consumption
   - Fill confirmed via `confirmFills()` on L3
   - ITP tokens minted on L3 to the user's address

4. **AC4:** ITP minted on L3 corresponds to user's cross-chain buy from Arbitrum
   - User's ITP balance on L3 increases by `fillAmount * 1e18 / fillPrice`
   - Order on L3 transitions to FILLED status
   - Cross-chain order on Arbitrum remains stored (immutable record)

5. **AC5:** Foundry integration test at `contracts/test/integration/E2ECrossChainBuy.t.sol`
   - Tests the full flow: buyITPFromArbitrum on Arb -> issuers process -> ITP minted on L3
   - Uses vm.chainId() switching pattern from BridgeIntegrationTest
   - Uses MockIssuerRegistry with empty BLS signatures (Phase 1 bypass)
   - Verifies all events, balances, and state transitions
   - Covers edge cases: expired deadline, invalid slippage tier, zero amount

6. **AC6:** E2E test script at `scripts/e2e-crosschain-buy.sh`
   - Orchestrates the cross-chain buy flow against local Anvil
   - Returns 0 on success, 1 on failure with diagnostic output
   - Validates USDC locked on Arb, ITP minted on L3, order status transitions

## Tasks / Subtasks

- [x] Task 1: Create Foundry E2E integration test (AC: #1, #2, #3, #4, #5)
  - [x] 1.1: Create `contracts/test/integration/E2ECrossChainBuy.t.sol` combining patterns from E2EOrderToMint and BridgeIntegrationTest
  - [x] 1.2: `setUp()` — Deploy dual-chain stack:
    - L3: MockGovernance, Index (UUPS proxy), ITP vault, MockERC20 (USDC)
    - Arbitrum: MockIssuerRegistry, ArbBridgeCustody (UUPS proxy), MockERC20 (USDC)
    - Wire Index with ITP vault and initial price
    - Fund ArbBridgeCustody and test users with USDC
  - [x] 1.3: `test_e2e_crosschain_buy_happy_path()` — Full flow:
    - Switch to ARB_CHAIN_ID
    - User approves USDC to ArbBridgeCustody
    - User calls `buyITPFromArbitrum(itpId, amount, limitPrice, slippageTier, deadline)`
    - Verify `CrossChainOrderCreated` event
    - Verify USDC transferred from user to ArbBridgeCustody
    - Verify `getCrossChainOrder(orderId)` returns correct data
    - Switch to L3_CHAIN_ID
    - Admin submits matching order on L3 Index via `submitOrder()` (simulating issuer behavior)
    - Confirm batch via `confirmBatch()`
    - Confirm fill via `confirmFills()`
    - Verify ITP minted to user on L3
    - Verify order status == FILLED on L3
  - [x] 1.4: `test_e2e_crosschain_buy_multiple_users()` — 3 users buy from Arb, all processed in single L3 batch
  - [x] 1.5: `test_e2e_crosschain_buy_expired_deadline()` — Order with past deadline reverts
  - [x] 1.6: `test_e2e_crosschain_buy_invalid_slippage_tier()` — Tier > 2 reverts with E011
  - [x] 1.7: `test_e2e_crosschain_buy_zero_amount()` — Zero amount reverts with E059
  - [x] 1.8: `test_e2e_crosschain_buy_zero_itpId()` — Zero itpId reverts with E060
  - [x] 1.9: `test_e2e_crosschain_buy_insufficient_usdc()` — User without enough USDC approved fails
  - [x] 1.10: `test_e2e_crosschain_buy_order_stored_correctly()` — Verify all CrossChainOrder fields match input
  - [x] 1.11: `test_e2e_crosschain_buy_sequential_order_ids()` — Multiple orders get sequential IDs (0, 1, 2...)
  - [x] 1.12: `test_e2e_crosschain_buy_higher_fill_price()` — Fill at $2/share yields fewer ITP tokens
  - [x] 1.13: `test_e2e_crosschain_buy_usdc_custody_balances()` — Verify USDC in ArbBridgeCustody and L3 Index after complete flow

- [x] Task 2: Create shell-based E2E test script (AC: #6)
  - [x] 2.1: Create `scripts/e2e-crosschain-buy.sh` following `e2e-order-mint.sh` pattern
  - [x] 2.2: Pre-checks: verify `cast`, `jq` available; verify Anvil running or start it
  - [x] 2.3: Deploy minimal contract stack via `cast send --create`:
    - ArbBridgeCustody with MockIssuerRegistry (Arb side)
    - Index with MockGovernance and ITP vault (L3 side)
    - MockERC20 (USDC) for both chains
  - [x] 2.4: Mint and approve USDC to test user on "Arbitrum" chain
  - [x] 2.5: Call `buyITPFromArbitrum()` via `cast send` — verify CrossChainOrderCreated event
  - [x] 2.6: Simulate issuer processing: submit corresponding order on L3 Index via admin `cast send`
  - [x] 2.7: Confirm batch and fills on L3 via admin `cast send`
  - [x] 2.8: Verify ITP balance of user on L3 via `cast call`
  - [x] 2.9: Verify cross-chain order stored on ArbBridgeCustody via `cast call getCrossChainOrder`
  - [x] 2.10: Print summary and return exit code 0/1

- [x] Task 3: Verify cross-chain order retrieval (AC: #2)
  - [x] 3.1: Verify `getCrossChainOrder()` returns all stored fields correctly
  - [x] 3.2: Verify `currentOrderId()` increments properly
  - [x] 3.3: Verify event data matches stored order data

## Dev Notes

### Cross-Chain Buy Flow (Architecture Reference)

Per architecture.md Section 6 (Cross-Chain ITP Purchase):

```
User (Arbitrum) → ArbBridgeCustody.buyITPFromArbitrum()
  ↓
ArbBridgeCustody: transferFrom(user, custody, amount)
  ↓
ArbBridgeCustody: store CrossChainOrder, emit CrossChainOrderCreated
  ↓
Issuers: observe CrossChainOrderCreated event on Arbitrum
  ↓
Issuers: create matching order on L3 Index.submitOrder()
  ↓
Standard L3 flow: submitOrder → confirmBatch → TradeRequest → AP executes → confirmFills → ITP mint
  ↓
ITP minted on L3 to user address (same address across chains)
```

**Key design decision:** The cross-chain buy locks USDC on Arbitrum, then issuers create a corresponding order on L3. The USDC on Arbitrum stays in ArbBridgeCustody (it becomes inventory for future bridge operations). The ITP is minted using L3 USDC reserves.

### Contract Function Signatures (EXACT -- from ArbBridgeCustody.sol)

```solidity
// ArbBridgeCustody.sol (contracts/src/custody/ArbBridgeCustody.sol)
function buyITPFromArbitrum(
    bytes32 itpId,
    uint256 amount,
    uint256 limitPrice,
    uint256 slippageTier,
    uint256 deadline
) external returns (uint256 orderId);

function getCrossChainOrder(uint256 orderId)
    external view returns (TypesLib.CrossChainOrder memory);

function currentOrderId() external view returns (uint256);
function isNonceUsed(uint256 sourceChainId, uint256 nonce) external view returns (bool);
```

### CrossChainOrder Struct (EXACT -- from TypesLib.sol)

```solidity
struct CrossChainOrder {
    bytes32 itpId;
    address user;
    uint256 amount;
    uint256 limitPrice;
    uint256 deadline;
    uint256 createdAt;   // block.timestamp at creation
}
```

**Note:** No `slippageTier` or `blockNumber` field in the struct. The `slippageTier` is validated at submission but NOT stored in the order. The `createdAt` field stores `block.timestamp` (not `block.number`).

### ArbBridgeCustody Validation Rules

From the contract source:
- `itpId != bytes32(0)` -- reverts E060_ZeroITPId
- `amount != 0` -- reverts E059_CrossChainOrderZeroAmount
- `slippageTier <= 2` -- reverts E011_InvalidSlippageTier
- `deadline > block.timestamp && deadline <= block.timestamp + 24 hours` -- reverts E058_InvalidDeadline
- USDC `safeTransferFrom(msg.sender, address(this), amount)` -- requires prior approval

### ArbBridgeCustody Events

```solidity
// From IArbBridgeCustody interface
event CrossChainOrderCreated(uint256 indexed orderId, bytes32 indexed itpId, address user, uint256 amount);
```

### Index.sol Function Signatures (L3 side)

```solidity
function submitOrder(
    bytes32 itpId,
    TypesLib.Side side,     // Side.BUY for cross-chain buy
    uint256 amount,
    uint256 limitPrice,
    uint256 slippageTier,
    uint256 deadline
) external returns (uint256 orderId);

function confirmBatch(
    uint256 cycleNumber,
    uint256[] calldata orderIds,
    bytes calldata blsSignature
) external;

function confirmFills(
    uint256 cycleNumber,
    TypesLib.Fill[] calldata fills,
    bytes calldata blsSignature
) external;

function createITP(
    string calldata name,
    string calldata symbol,
    uint256[] calldata weights,
    address[] calldata assets
) external returns (bytes32 itpId);

function setITPVault(bytes32 itpId, address vault) external;
function setPrice(uint256 assetIndex, uint256 price) external;
```

### Dual-Chain Simulation Pattern (from BridgeIntegrationTest)

The codebase uses `vm.chainId()` to simulate cross-chain interaction in Foundry tests. ArbBridgeCustody validates `sourceChainId != block.chainid`:

```solidity
// Switch to Arbitrum context for cross-chain operations
vm.chainId(ARB_CHAIN_ID);  // 42161
// ... call ArbBridgeCustody functions ...
vm.chainId(L3_CHAIN_ID);   // 111222333
// ... call L3 Index functions ...
```

**Important:** All contracts are deployed on the same test chain but `vm.chainId()` makes them behave as if on different chains. ArbBridgeCustody initialization requires `l3Index_` address parameter.

### Existing Test Patterns to Reuse

**From E2EOrderToMint.t.sol (contracts/test/integration/E2EOrderToMint.t.sol):**
- L3 Index stack deployment with MockGovernance, UUPS proxy, ITP vault
- `_submitOrder()`, `_confirmBatch()`, `_confirmFills()` helpers
- Event verification with `vm.expectEmit()`
- Fill struct construction with cycleNumber and txHash
- ITP balance assertions via `itpVault.balanceOf(user)`

**From BridgeIntegrationTest.t.sol (contracts/test/integration/BridgeIntegrationTest.t.sol):**
- Dual-chain deployment pattern (L3 + Arbitrum contracts)
- `vm.chainId()` switching for cross-chain simulation
- MockIssuerRegistry with empty BLS signature bypass
- L3_CHAIN_ID (111222333) and ARB_CHAIN_ID (42161) constants
- Separate USDC funding for L3 and Arbitrum contracts

### ArbBridgeCustody.initialize() Parameters

```solidity
function initialize(
    address issuerRegistry_,  // MockIssuerRegistry for tests
    address usdc_,            // MockERC20 address
    address l3Index_          // L3 Index contract address (can be any non-zero address for tests)
) external initializer;
```

### Shell Script Pattern (from e2e-order-mint.sh)

Key patterns to reuse:
- Color-coded logging with `log_info`, `log_warn`, `log_error`
- Deploy minimal stack via `cast send --create` (no DeployL3.s.sol)
- Simulate issuer/AP behavior via direct admin `cast send` calls
- Validate final state numerically (ITP balance, order status)
- Use `date +%s` for deadline calculation
- Return exit code 0/1 with diagnostic output
- `rm -rf` temp directory at script start

**Note:** Shell script runs on single Anvil instance (single chain). Cross-chain behavior is simulated by deploying both L3 and Arb contracts on same Anvil but calling them in the correct order. The `vm.chainId()` approach is Foundry-only.

### Constants

| Parameter | Value |
|-----------|-------|
| L3 Chain ID | 111222333 |
| Arbitrum Chain ID | 42161 |
| USDC decimals | 18 (test), 6 (production) |
| Max deadline duration | 24 hours |
| Max slippage tier | 2 |
| Order ID starts at | 0 (increments: 0, 1, 2...) |

### Known Gaps

1. **Issuer CrossChainOrder processing not automated:** Issuers don't yet have logic to observe `CrossChainOrderCreated` events on Arbitrum and create corresponding L3 orders. E2E test simulates this via direct admin calls on L3 Index. This is the correct approach for contract-layer E2E testing.

2. **USDC stays in ArbBridgeCustody:** The cross-chain buy locks USDC on Arbitrum permanently. There is no automated mechanism to bridge this USDC back to L3 or use it for inventory. This is by design (USDC becomes custody inventory).

3. **ITP vault setup not automated:** `setITPVault()` must be called manually after `createITP()`. The ITP vault must be a deployed ITP contract pointing to the correct Index.

4. **slippageTier not stored in CrossChainOrder:** The slippage tier is validated at submission but dropped from storage. The issuer must infer or use a default slippage tier when creating the L3 order.

5. **No refund mechanism on ArbBridgeCustody:** If the cross-chain order cannot be fulfilled (e.g., L3 order expires), there is no `refundCrossChainOrder()` function. USDC remains in ArbBridgeCustody. This is a production gap documented in backlog.md.

### Previous Story Intelligence

**Story 6.10 (E2E Order to Mint) -- Done:**
- 9 Foundry tests covering full order-to-mint lifecycle
- Shell script deploys minimal stack without IssuerRegistry (BLS bypass)
- Key learning: ITP vault MUST be set via `setITPVault()` before fills work
- Key learning: Index expects `Side` enum parameter, not uint8 in Foundry

**Story 6.8 (Bridge Integration Test) -- Done:**
- 34 bridge integration tests with dual-chain simulation
- PendingLock uses `bool released/reversed` (not LockStatus enum)
- ReleaseProof has 4 fields including `sourceChainId`
- Key learning: `vm.chainId()` switching works reliably for cross-chain simulation
- Key learning: ArbBridgeCustody rejects `sourceChainId == block.chainid`

**Story 2-10 (ArbBridgeCustody) -- Done:**
- `buyITPFromArbitrum()` stores CrossChainOrder with all fields
- `getCrossChainOrder()` view function verified working
- Order IDs start at 0 and increment sequentially
- 57 unit tests passing

### Git Intelligence

Recent commits (last 5):
```
565dbb4 Mark Story 6.8 done, log reversed-fund governance gap to backlog
561c238 Story 6.8: Bridge integration tests + code review fixes
d1fc425 Story 5.9: Add TokenRegistry and mock RPC error tests
81e8cce Fix code review issues for Story 5-7 (1inch Fusion+ Client)
d21d866 Add common crate dependencies and module exports
```

Bridge contracts and ArbBridgeCustody are stable. No recent changes.

### Project Structure Notes

Files to create:
```
contracts/test/integration/E2ECrossChainBuy.t.sol  -- Foundry E2E integration test
scripts/e2e-crosschain-buy.sh                       -- Shell E2E test script
```

Files to reference (DO NOT modify):
```
contracts/src/custody/ArbBridgeCustody.sol          -- Cross-chain buy contract
contracts/src/core/Index.sol                        -- L3 order/batch/fill logic
contracts/src/core/ITP.sol                          -- ERC4626 vault for minting
contracts/src/libraries/TypesLib.sol                -- CrossChainOrder, LimitOrder, Fill structs
contracts/src/libraries/ErrorsLib.sol               -- E058, E059, E060, E011 errors
contracts/src/libraries/EventsLib.sol               -- CrossChainOrderCreated event
contracts/src/mocks/MockERC20.sol                   -- Test USDC
contracts/src/mocks/MockGovernance.sol              -- Test governance
contracts/src/mocks/MockIssuerRegistry.sol          -- BLS bypass mock
contracts/test/integration/E2EOrderToMint.t.sol     -- L3 E2E test patterns
contracts/test/integration/BridgeIntegrationTest.t.sol -- Cross-chain test patterns
scripts/e2e-order-mint.sh                           -- Shell script pattern
deployments/local.json                              -- Contract addresses
```

### Testing Standards

- Foundry test: `forge test --match-contract E2ECrossChainBuyTest -vvv`
- Shell test: `./scripts/e2e-crosschain-buy.sh`
- All existing tests must continue passing: `forge test` (contracts), `cargo test` (Rust)
- Use `vm.chainId()` for dual-chain simulation in Foundry tests
- Use MockIssuerRegistry with empty BLS signatures for Phase 1 bypass
- Test file in `contracts/test/integration/` directory

### Architecture Compliance

- Cross-chain ITP purchase per architecture Section 6
- All orders are limit orders (no market orders) -- architecture Section 6
- USDC custody in ArbBridgeCustody during cross-chain order -- architecture Section 13
- ITP minted via Index.sol -> ITP.mint() on L3 only -- architecture Section 5
- Slippage tiers enforced: 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%) -- architecture Section 6
- Max deadline: 24 hours -- architecture Section 6
- Cross-chain order stored for issuer retrieval -- architecture Section 6
- Issuers and AP communicate ONLY via on-chain events -- architecture Section 3

### Anti-Patterns to Avoid

- DO NOT modify ArbBridgeCustody or Index contracts for test convenience -- test as-is
- DO NOT skip BLS verification handling -- use MockIssuerRegistry for empty-pubkey bypass
- DO NOT hardcode chain IDs -- use constants (111222333 for L3, 42161 for Arb)
- DO NOT assume vm.chainId() affects contract storage -- all contracts share same storage in test
- DO NOT forget to approve USDC before buyITPFromArbitrum (uses safeTransferFrom)
- DO NOT forget setITPVault() before confirmFills -- minting silently skips without vault
- DO NOT test slippageTier storage in CrossChainOrder -- the field is NOT stored (validated only)
- DO NOT duplicate unit tests from ArbBridgeCustody.t.sol -- focus on cross-contract integration

### References

- [Source: architecture.md#Section-6] - Cross-Chain ITP Purchase, Order System
- [Source: architecture.md#Section-13] - Multi-Chain Collateral & Custody
- [Source: architecture.md#Section-3] - Actors & Roles (issuers observe on-chain events)
- [Source: contracts/src/custody/ArbBridgeCustody.sol] - buyITPFromArbitrum, getCrossChainOrder
- [Source: contracts/src/libraries/TypesLib.sol] - CrossChainOrder struct (6 fields, no slippageTier)
- [Source: contracts/src/libraries/ErrorsLib.sol] - E058, E059, E060, E011 error codes
- [Source: contracts/src/libraries/EventsLib.sol] - CrossChainOrderCreated event
- [Source: contracts/test/integration/E2EOrderToMint.t.sol] - L3 order-to-mint test patterns
- [Source: contracts/test/integration/BridgeIntegrationTest.t.sol] - Dual-chain simulation patterns
- [Source: contracts/test/ArbBridgeCustody.t.sol] - Unit tests for buyITPFromArbitrum (57 tests)
- [Source: scripts/e2e-order-mint.sh] - Shell E2E test script pattern
- [Source: _bmad-output/implementation-artifacts/6-10-e2e-order-to-mint.md] - Order-to-mint learnings
- [Source: _bmad-output/implementation-artifacts/6-8-bridge-integration-test.md] - Bridge test learnings
- [Source: deployments/local.json] - Local deployment addresses
- [Source: epics.md#Story-6.12] - Original acceptance criteria
- [Source: backlog.md] - Known gaps and design decisions

## Change Log

- 2026-01-31: Story 6.12 implemented — 14 Foundry E2E tests + shell E2E script for cross-chain buy flow
- 2026-01-31: Code review fixes — H1: happy path now mints ITP to user1 (AC4), M1: dynamic event sigs in shell, M2: zero-amount edge case in shell, M3: limitPrice continuity assertion, M4: expired deadline uses past timestamp

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed `CrossChainOrderCreated` event declaration: `address indexed user` (3 indexed params, not 2). Story Dev Notes had incorrect non-indexed user param. Fixed test event declaration and log parsing.
- Fixed `vm.expectEmit` by specifying emitter address `address(arbBridge)` for proxy contract events.
- Fixed shell script value comparisons: `cast call` returns Foundry-annotated values (e.g., `100...000 [1e20]`). Used `awk '{print $1}'` to strip annotations before numeric comparison.

### Completion Notes List

- **Task 1 (Foundry E2E):** Created `E2ECrossChainBuy.t.sol` with 14 tests covering:
  - Happy path: full cross-chain buy flow (Arb buy -> L3 order -> batch -> fill -> ITP mint)
  - Multiple users: 3 users buy from Arb, processed in single L3 batch
  - Edge cases: expired deadline, invalid slippage tier, zero amount, zero itpId, insufficient USDC
  - State verification: order storage, sequential IDs, higher fill price, USDC custody balances
  - Task 3 tests: getCrossChainOrder fields, currentOrderId increments, event-storage consistency
- **Task 2 (Shell E2E):** Created `e2e-crosschain-buy.sh` that deploys full stack (USDC, MockGovernance, Index proxy, MockIssuerRegistry, ArbBridgeCustody proxy, ITP vault), executes cross-chain buy flow, and validates all state transitions. Returns exit code 0/1.
- **Task 3 (Order retrieval):** Covered by 3 dedicated Foundry tests (3.1, 3.2, 3.3) verifying getCrossChainOrder, currentOrderId, and event-storage data consistency.
- All 808 Foundry tests pass (0 failures, 5 skipped). No regressions.

### Code Review Fixes Applied

- **H1 (AC4 gap):** Happy path now funds user1 with L3 USDC and submits L3 order as user1 via `_submitOrderOnL3AsUser`. ITP minted to user1, not admin. AC4 "user's ITP balance increases" is now properly verified.
- **M1 (hardcoded event sigs):** Shell script now computes event topic hashes dynamically via `cast sig-event` instead of hardcoded hex strings.
- **M2 (shell negative test):** Added Step 11b to shell script: verifies zero-amount `buyITPFromArbitrum` reverts (E059).
- **M3 (limitPrice continuity):** Happy path now asserts `l3Order.limitPrice == ccOrder.limitPrice` after L3 order submission.
- **M4 (expired deadline):** Changed `pastDeadline = block.timestamp` to `block.timestamp - 1` for a truly past deadline.
- All 810 Foundry tests pass after fixes (0 failures, 5 skipped). No regressions.

### File List

- `contracts/test/integration/E2ECrossChainBuy.t.sol` (new) — 14 Foundry E2E integration tests
- `scripts/e2e-crosschain-buy.sh` (new) — Shell-based E2E test script
- `_bmad-output/implementation-artifacts/6-12-e2e-cross-chain-buy.md` (modified) — Story file updates
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — Status: in-progress -> review
