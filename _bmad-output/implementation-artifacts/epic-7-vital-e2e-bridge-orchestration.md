# Epic 7: Vital E2E Bridge Orchestration

## Overview

**Primary Goal:** Make `/docs/vital-test.md` work end-to-end.

This epic implements the missing orchestration components required to run the vital E2E test. The test runs everything through a bridge path from mock Arbitrum with real BLS signatures. **Every story in this epic must be validated against vital-test.md** - that document is the source of truth for expected behavior, contract interactions, and success criteria.

### Key Reference: vital-test.md

Before implementing any story, read `/docs/vital-test.md` thoroughly. It defines:
- The complete architecture (single Anvil chain simulating Arbitrum + L3)
- Two distinct USDC tokens: `ArbUSDC` (Arbitrum) and `L3Usdc` (L3)
- Flow 1: Create ITP via Bridge (user → BridgeProxy → issuers BLS → ITP created)
- Flow 2: Buy ITP via Bridge (user locks ArbUSDC → issuers handle everything with BLS)
- All contract interfaces, events, and expected parameters
- Environment variables and deployment expectations

### Gap Analysis Summary

| Component | Status | Gap |
|-----------|--------|-----|
| BridgeProxy contract | ✅ Ready | - |
| ArbBridgeCustody contract | ✅ Ready | - |
| Index.sol (submitOrder, confirmBatch, confirmFills) | ✅ Ready | - |
| MockBitgetVault contract | ✅ Ready | - |
| IssuerRegistry (BLS keys) | ✅ Ready | - |
| Issuer ITP Creation Handler | ✅ Ready | - |
| AP TradeRequest Listener | 🟡 Verify | Needs verification with bridge flow |
| AP MockBitgetVault Client | 🟡 Verify | Needs verification executeTrade() works |
| **Issuer CrossChainOrder Bridge Handler** | 🔴 Missing | Handle `CrossChainOrderCreated` events |
| **Issuer Bridge USDC Orchestrator** | 🔴 Missing | Bridge USDC Arb→L3→Arb with BLS |
| **Issuer Batch/Fill Orchestrator** | 🟡 Partial | Coordinate full flow after bridging |
| **Custody Release Handler** | 🔴 Missing | Release USDC to MockBitgetVault with BLS |
| **IssuerCustody (Arbitrum)** | 🔴 Missing | BLS-controlled custody for USDC after bridge back |
| **IssuerCustody (L3)** | 🔴 Missing | Holds L3Usdc before submitOrder |
| **local-e2e-deploy.sh completion** | 🟡 Partial | Missing custody contracts, full token setup |

### Architecture Reference

From vital-test.md, the **Buy ITP via Bridge** flow (Issuers = Bridge):

```
Step 1: User calls buyITPFromArbitrum() - locks ArbUSDC in ArbBridgeCustody
Step 2: Issuers (BLS) bridge USDC from Arbitrum → L3
Step 3: Issuers (BLS) call submitOrder() on L3 Index (on behalf of user)
Step 4: Issuers (BLS) call confirmBatch()
Step 5: Issuers (BLS) bridge USDC back from L3 → Arbitrum (to issuer custody)
Step 6: Issuers (BLS) release USDC from custody to MockBitgetVault
Step 7: AP executes trades on MockBitgetVault
Step 8: Issuers (BLS) call confirmFills()
```

---

## Story 7.1: CrossChainOrderCreated Event Handler

As an **issuer node**,
I want **to listen for CrossChainOrderCreated events from ArbBridgeCustody**,
So that **I can initiate the bridge flow when users buy ITPs from Arbitrum**.

**Acceptance Criteria:**

**Given** ArbBridgeCustody emits `CrossChainOrderCreated(orderId, itpId, user, amount)` when user calls `buyITPFromArbitrum()`
**When** issuer node is running and connected to the chain
**Then** issuer subscribes to `CrossChainOrderCreated` events from ArbBridgeCustody address
**And** event is parsed with orderId, itpId, user, amount from event
**And** additional order params (limitPrice, slippageTier, deadline) fetched via `getCrossChainOrder(orderId)` call
**And** full order stored as `CrossChainOrder { order_id, itp_id, user, amount, limit_price, slippage_tier, deadline }`
**And** parsed order is queued for bridge orchestration
**And** duplicate events (reorgs) are deduplicated by `(chain_id, order_id)`
**And** orders past deadline are skipped with warning log
**And** unit tests verify event parsing matches Solidity event signature

**Technical Notes:**
- Add to `issuer/src/chain/arbitrum_reader.rs`
- Event signature: `CrossChainOrderCreated(uint256,bytes32,address,uint256)` - only 4 fields
- Full order params require on-chain read via `getCrossChainOrder(orderId)`
- Must track block confirmations (3 blocks before processing)
- Reference: vital-test.md "ArbBridgeCustody" section

**Definition of Done:**
- [ ] Event subscription implemented in ArbitrumReader
- [ ] CrossChainOrder struct defined in common/src/types/
- [ ] Deduplication logic tested
- [ ] Integration test with mock event emission

---

## Story 7.2: Bridge USDC Orchestrator (Arb→L3)

As an **issuer node**,
I want **to orchestrate bridging USDC from Arbitrum to L3 with BLS consensus**,
So that **user's locked USDC can be used to submit orders on L3**.

**Acceptance Criteria:**

**Given** a `CrossChainOrder` is received (Story 7.1)
**When** issuers process the order
**Then** lead issuer proposes `BRIDGE_ARB_TO_L3` message with order details
**And** followers validate: order exists on-chain, user has locked ArbUSDC in ArbBridgeCustody, deadline not passed
**And** 2/3 issuers sign the bridge proposal with BLS
**And** aggregated signature is used to call bridge contract (simulated in local E2E)
**And** L3Usdc is minted/transferred to **IssuerCustody on L3** (not to user)
**And** `BridgeCompleted` event logged with order_id, amount, source_chain, dest_chain
**And** order status updated to `BRIDGED_TO_L3`
**And** unit tests verify BLS consensus for bridge messages

**Technical Notes:**
- **Two USDC tokens**: ArbUSDC (locked in ArbBridgeCustody) → L3Usdc (to IssuerCustody L3)
- In local E2E, bridge is simulated by minting L3Usdc to IssuerCustody L3 address
- Message hash format must match any contract verification
- Add `BridgeOrchestrator` module to `issuer/src/bridge/`
- Reference: vital-test.md Step 2 "ISSUERS bridge USDC from Arbitrum → L3"

**Definition of Done:**
- [ ] BridgeOrchestrator module created
- [ ] BRIDGE_ARB_TO_L3 consensus message type added
- [ ] Bridge simulation logic for local E2E
- [ ] Order status tracking updated
- [ ] Integration test with 3 nodes

---

## Story 7.3: Submit Order on Behalf of User

As an **issuer node**,
I want **to submit orders on L3 Index on behalf of the Arbitrum user**,
So that **bridge users don't need to interact with L3 directly**.

**Acceptance Criteria:**

**Given** L3Usdc has been bridged to IssuerCustody L3 (Story 7.2)
**When** issuers have L3Usdc in IssuerCustody L3
**Then** lead issuer proposes `SUBMIT_ORDER_FOR_USER` with order params
**And** followers validate: IssuerCustody L3 has sufficient L3Usdc, ITP exists, deadline valid
**And** 2/3 issuers sign the submit proposal with BLS
**And** issuer approves Index to spend L3Usdc from IssuerCustody L3
**And** issuer submits `Index.submitOrder()` on L3 with:
  - itpId from CrossChainOrder
  - amount from CrossChainOrder
  - limitPrice from CrossChainOrder
  - slippageTier from CrossChainOrder
  - deadline from CrossChainOrder
**And** L3Usdc is transferred from IssuerCustody L3 to Index contract (escrowed)
**And** `OrderSubmitted` event captured with new L3 orderId
**And** mapping created: `(arb_order_id) → (l3_order_id)` for tracking
**And** order status updated to `SUBMITTED_ON_L3`

**Technical Notes:**
- Issuer needs ETH key to submit tx on L3 (use Anvil test keys)
- Transaction must include proper gas estimation
- Add to chain writer: `build_submit_order_for_user_tx()`
- L3Usdc flows: IssuerCustody L3 → Index contract (escrow)
- Reference: vital-test.md Step 3 "ISSUERS submit order on L3 Index"

**Definition of Done:**
- [ ] SUBMIT_ORDER_FOR_USER consensus message added
- [ ] ChainWriter method for submitOrder tx
- [ ] Order ID mapping stored
- [ ] Integration test verifying order appears on L3

---

## Story 7.4: Batch and Fill Orchestration (Bridged Orders)

As an **issuer node**,
I want **to process bridged orders through the normal batch/fill cycle**,
So that **bridge orders are executed alongside regular L3 orders**.

**Acceptance Criteria:**

**Given** orders are submitted on L3 (Story 7.3)
**When** the next cycle runs
**Then** order batcher includes bridged orders in the batch
**And** netting engine processes bridged orders normally
**And** `confirmBatch()` is called with aggregated BLS signature
**And** `TradeRequest` events are emitted for AP
**And** after AP fills, `confirmFills()` is called with BLS signature
**And** ITP shares are minted via ERC4626 vault to the **original Arbitrum user address** on L3
**And** user's ITP share balance verifiable via `ITP_VAULT.balanceOf(user)`

**Technical Notes:**
- Existing batch/fill logic should work, just need integration
- Important: shares go to `CrossChainOrder.user`, not issuer
- Index.sol must support specifying recipient for bridged orders (verify Index.sol interface)
- ERC4626 vault mints shares - verify vault is deployed per ITP via BridgedItpFactory
- Reference: vital-test.md Step 7 "Mint ITP shares to user (via ERC4626 vault on L3)"

**Definition of Done:**
- [ ] Bridged orders included in batch cycle
- [ ] Recipient address correctly set to original user
- [ ] Full cycle integration test (submit → batch → fill → mint)

---

## Story 7.5: Bridge USDC Back to Arbitrum (L3→Arb)

As an **issuer node**,
I want **to bridge USDC back from L3 to Arbitrum custody after batch confirmation**,
So that **AP can execute trades on MockBitgetVault**.

**Acceptance Criteria:**

**Given** batch is confirmed and TradeRequest is emitted
**When** issuers need to send USDC to AP for trading on Arbitrum
**Then** lead issuer proposes `BRIDGE_L3_TO_ARB` with trade amounts
**And** 2/3 issuers sign with BLS
**And** L3Usdc released from Index escrow (or IssuerCustody L3)
**And** ArbUSDC minted/transferred to **IssuerCustody on Arbitrum** (BLS-controlled)
**And** order status updated to `USDC_BRIDGED_BACK`
**And** bridge netting applied if multiple orders need bridging both ways

**Technical Notes:**
- **USDC flow**: L3Usdc (Index escrow) → ArbUSDC (IssuerCustody Arbitrum)
- In local E2E, simulate by minting ArbUSDC to IssuerCustody Arbitrum address
- IssuerCustody Arbitrum is BLS-controlled (Story 7.7)
- Bridge netting reduces actual transfers when orders flow both directions
- Reference: vital-test.md Step 5 "ISSUERS bridge USDC back from L3 → Arbitrum"

**Definition of Done:**
- [ ] BRIDGE_L3_TO_ARB consensus message added
- [ ] Bridge simulation for local E2E
- [ ] Bridge netting logic applied
- [ ] Integration test with multiple orders

---

## Story 7.6: Custody Release to MockBitgetVault

As an **issuer node**,
I want **to release USDC from issuer custody to MockBitgetVault with BLS**,
So that **AP can execute trades with real token transfers**.

**Acceptance Criteria:**

**Given** USDC is in issuer custody on Arbitrum (Story 7.5)
**When** AP needs USDC to trade
**Then** lead issuer proposes `RELEASE_TO_VAULT` with vault address and amount
**And** 2/3 issuers sign with BLS
**And** BLSCustody.execute() called to transfer ArbUSDC to MockBitgetVault
**And** `CustodyRelease` event logged with vault, amount, trade_ids
**And** AP is notified (via TradeRequest event already emitted)

**Technical Notes:**
- Uses existing BLSCustody.execute() with whitelisted target
- MockBitgetVault must be whitelisted in BLSCustody
- Builds calldata for `IERC20.transfer(vault, amount)`

**Definition of Done:**
- [ ] RELEASE_TO_VAULT consensus message added
- [ ] BLSCustody.execute() calldata builder for ERC20 transfer
- [ ] MockBitgetVault whitelisting in deploy script
- [ ] Integration test: custody → vault transfer

---

## Story 7.7: IssuerCustody Contracts (BLS-Controlled, Both Chains)

As a **contract deployer**,
I want **IssuerCustody contracts on both Arbitrum and L3 that hold USDC during bridge flow**,
So that **issuers control fund flow with BLS signatures at each stage**.

**Acceptance Criteria:**

**Given** need for BLS-controlled custody on both chains per vital-test.md
**When** deploying local E2E

**Then IssuerCustody L3:**
- IssuerCustody L3 deployed (holds L3Usdc after bridge from Arbitrum)
- Inherits from BLSCustody with aggregated pubkey
- Index contract whitelisted as transfer target (for submitOrder)
- Can hold L3Usdc
- Only BLS-signed execute() can transfer out

**And IssuerCustody Arbitrum:**
- IssuerCustody Arbitrum deployed (holds ArbUSDC after bridge back from L3)
- Inherits from BLSCustody with same aggregated pubkey
- MockBitgetVault whitelisted as transfer target
- Can hold ArbUSDC
- Only BLS-signed execute() can transfer out

**And** Foundry tests verify BLS-controlled transfers on both

**Technical Notes:**
- May use existing BLSCustody.sol with appropriate whitelist per deployment
- Same BLS pubkey as other custody contracts
- Two separate deployments with different whitelist targets
- Reference: vital-test.md shows `ISSUER_CUSTODY_L3` and `Issuer Custody (Arbitrum)`

**Definition of Done:**
- [ ] IssuerCustody L3 deployed, holds L3Usdc, Index whitelisted
- [ ] IssuerCustody Arbitrum deployed, holds ArbUSDC, MockBitgetVault whitelisted
- [ ] Deploy script updated for both
- [ ] Foundry tests for custody release on both chains

---

## Story 7.8: Complete local-e2e-deploy.sh

As a **developer**,
I want **local-e2e-deploy.sh to deploy all contracts needed for vital test**,
So that **I can run the full E2E with one command**.

**Acceptance Criteria:**

**Given** vital-test.md requirements (this is the source of truth)
**When** running `./scripts/local-e2e-deploy.sh`
**Then** Anvil starts on chain ID 1234567890

**And** Deploys "L3" contracts:
  - Index.sol, IssuerRegistry, CollateralRegistry, FeeRegistry
  - L3Usdc (MockERC20) - **distinct from ArbUSDC**
  - BridgeProxy
  - IssuerCustody L3 (BLS-controlled, holds L3Usdc before submitOrder)
  - ITP Vault (ERC4626) via BridgedItpFactory

**And** Deploys "Arbitrum" contracts (same chain, different addresses):
  - ArbUSDC (MockERC20) - **distinct from L3Usdc**
  - ArbBridgeCustody (locks user's ArbUSDC)
  - IssuerCustody Arbitrum (BLS-controlled, holds ArbUSDC after bridge back)
  - MockBitgetVault
  - 627 Mock ERC20 tokens from assets.json

**And** Registers 3 test issuers with deterministic BLS keys in IssuerRegistry
**And** Creates test ITPs (Crypto Blend, DeFi Index) with ERC4626 vaults
**And** Funds MockBitgetVault with 1M of each token
**And** Generates data/symbol-map.json for AP price mapping

**And** Starts 3 issuer nodes with correct flags:
  - `--test-key-seeds --bls-key-seed-index N`
  - `--bridge-proxy $BRIDGE_PROXY`
  - `--arb-custody $ARB_CUSTODY`
  - `--issuer-custody-arb $ISSUER_CUSTODY_ARB`
  - `--issuer-custody-l3 $ISSUER_CUSTODY_L3`

**And** Starts AP with flags:
  - `--mock-bitget`
  - `--bitget-vault $MOCK_VAULT`
  - `--index-contract $INDEX`

**And** Outputs deployments/local-e2e.json with all addresses matching vital-test.md env vars:
  - `INDEX`, `L3_USDC`, `BRIDGE_PROXY`, `ISSUER_REGISTRY`
  - `ARB_CUSTODY`, `ARB_USDC`, `ISSUER_CUSTODY_ARB`, `ISSUER_CUSTODY_L3`
  - `MOCK_VAULT`, `ITP_VAULT`

**And** Prints verification commands from vital-test.md

**Definition of Done:**
- [ ] Deploy script deploys all L3 contracts (Index, L3Usdc, BridgeProxy, IssuerCustody L3, ITP Vault)
- [ ] Deploy script deploys all Arbitrum contracts (ArbUSDC, ArbBridgeCustody, IssuerCustody Arb, MockBitgetVault, 627 tokens)
- [ ] Two distinct USDC tokens deployed (L3Usdc ≠ ArbUSDC)
- [ ] All contract addresses written to deployments/local-e2e.json matching vital-test.md env vars
- [ ] Symbol map generated at data/symbol-map.json
- [ ] 3 issuer nodes start successfully with both custody addresses
- [ ] AP starts successfully and connects to MockBitgetVault
- [ ] Verification commands from vital-test.md work

---

## Story 7.9: Vital E2E Integration Test

As a **developer**,
I want **an automated test that verifies the complete vital E2E flow**,
So that **I can validate the system works end-to-end**.

**Acceptance Criteria:**

**Given** local-e2e-deploy.sh has been run (Story 7.8)
**When** running `./scripts/vital-e2e-test.sh`

**Then** **Flow 1 - Create ITP via Bridge** (per vital-test.md Scenario A):
  - User calls `BridgeProxy.requestCreateItp(assets, weights, name, symbol)`
  - `CreateItpRequested` event emitted
  - Issuers observe event and reach BLS consensus (2/3 threshold)
  - Lead issuer calls `completeCreateItp()` with aggregated BLS signature
  - `CreateItpCompleted` event emitted
  - Test asserts: ITP exists in Index.sol, ERC4626 vault deployed

**And** **Flow 2 - Buy ITP via Bridge** (per vital-test.md Scenario B):
  - Mint ArbUSDC to test user on "Arbitrum"
  - User approves ArbBridgeCustody
  - User calls `ArbBridgeCustody.buyITPFromArbitrum()` - **only user action**
  - Assert: ArbUSDC locked in ArbBridgeCustody, `CrossChainOrderCreated` emitted
  - Wait for issuers to:
    - Bridge ArbUSDC → L3Usdc (to IssuerCustody L3)
    - Submit order on L3 Index (from IssuerCustody L3)
    - Confirm batch with BLS
    - Bridge L3Usdc back → ArbUSDC (to IssuerCustody Arbitrum)
    - Release ArbUSDC from IssuerCustody Arbitrum to MockBitgetVault
  - Assert: AP received `TradeRequest` event
  - Assert: AP executed `MockBitgetVault.executeTrade()`
  - Wait for issuers to confirm fills with BLS
  - Assert: User has ITP shares on L3 via `ITP_VAULT.balanceOf(user)`
  - Assert: AP has asset tokens from MockBitgetVault

**And** All logs written to logs/vital-e2e/
**And** Test outputs PASS/FAIL with summary per assertion
**And** Test follows vital-test.md verification commands exactly

**Definition of Done:**
- [ ] Test script created matching vital-test.md scenarios
- [ ] Flow 1 (Create ITP via Bridge) passing
- [ ] Flow 2 (Buy ITP via Bridge) passing
- [ ] AP integration verified (TradeRequest → executeTrade)
- [ ] All assertions from vital-test.md success checklist pass
- [ ] CI integration (optional)

---

## Dependencies

```
Story 7.7 (IssuerCustody Contracts - L3 + Arb) ◄─── Must exist first
           │
           ├─────────────────────────────────────────────────────────┐
           │                                                         │
           ▼                                                         │
Story 7.1 (Event Handler) ────────────────────────────────┐          │
           │                                              │          │
           ▼                                              │          │
Story 7.2 (Bridge Arb→L3) ◄── needs IssuerCustody L3 ─────┤          │
           │                                              │          │
           ▼                                              │          │
Story 7.3 (Submit Order) ◄── from IssuerCustody L3 ───────┤          │
           │                                              │          │
           ▼                                              │          │
Story 7.4 (Batch/Fill) ◄──────────────────────────────────┤          │
           │                                              │          │
           ▼                                              │          │
Story 7.5 (Bridge L3→Arb) ◄── needs IssuerCustody Arb ────┼──────────┘
           │                                              │
           ▼                                              │
Story 7.6 (Custody Release) ◄── from IssuerCustody Arb ───┤
                                                          │
Story 7.8 (Deploy Script) ◄───────────────────────────────┘
           │
           ▼
Story 7.9 (E2E Test)
```

**Key:** Story 7.7 (custody contracts) should be implemented early as it unblocks both bridge directions.

---

## Estimates

| Story | Complexity | Notes |
|-------|------------|-------|
| 7.1 | Small | Event parsing + on-chain read for full order params |
| 7.2 | Medium | New consensus message type + orchestration |
| 7.3 | Medium | Chain writer extension, IssuerCustody L3 integration |
| 7.4 | Small | Integration of existing components, verify ERC4626 |
| 7.5 | Medium | Mirror of 7.2, reverse direction |
| 7.6 | Small | BLSCustody.execute() calldata |
| 7.7 | Medium | Two custody contracts (L3 + Arbitrum), both BLS-controlled |
| 7.8 | Medium | Script work, many contracts, env var alignment |
| 7.9 | Medium | Test automation matching vital-test.md exactly |

**Total: ~9 stories, mostly medium complexity**

**Reference:** All stories must validate against `/docs/vital-test.md`

---

## Success Criteria

**The epic is complete when `/docs/vital-test.md` works end-to-end.**

Per vital-test.md Success Checklist:
- [ ] ITP creation via bridge works with real BLS (Flow 1)
- [ ] Buy ITP via bridge completes full 8-step flow (Flow 2)
- [ ] User receives ITP shares on L3 (via ERC4626 vault)
- [ ] AP executes trades on MockBitgetVault
- [ ] All 3 issuers participate in BLS consensus (2/3 threshold)
- [ ] Two USDC tokens work correctly (ArbUSDC ↔ L3Usdc)
- [ ] Both IssuerCustody contracts (L3 and Arbitrum) function with BLS
- [ ] All verification commands from vital-test.md pass
- [ ] Logs show complete flow progression per vital-test.md Logs section
