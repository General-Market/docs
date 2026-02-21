# Solver Pre-Fill Architecture for Instant ITP Buy & Sell

**Date:** 2026-02-18 (updated 2026-02-19)
**Author:** max + Winston (Architect Agent)
**Status:** SUPERSEDED BY V2 (see below)

---

## Context

**Problem:** Buying/selling an ITP takes ~60 seconds (bridge → fill → mint). Users want instant delivery.

**Solution:** Pre-mint all ITPs into a SolverVault. Solver deposits USDC collateral as repo. Users get instant ITP (buy) or instant USDC (sell) in 1 tx. Pipeline replenishes in background.

**V1 Scope:** Single solver (team acts as solver). 1000 ITPs pre-minted. One shared USDC collateral pool.

---

## The Setup: 1000 ITPs, 1 Collateral Pool

SolverVault (on-chain contract on Arbitrum) holds:

```
inventory[itp_1]    = 10,000 shares (pre-minted, unbacked)
inventory[itp_2]    = 10,000 shares
...
inventory[itp_1000] = 10,000 shares
usdcCollateral      = $500,000 (solver deposited)
lockedCollateral    = $0
```

**Solver CANNOT:**
- Withdraw ITP from vault (no function exists)
- Transfer ITP except through `instantBuy()` which checks collateral
- Change price (BLS-gated by 11/20 issuers)
- Withdraw locked collateral

**Solver CAN:**
- Deposit more collateral
- Deposit more ITP inventory
- Withdraw FREE collateral only (`usdcCollateral - lockedCollateral`)
- Set `tipBps` (capped at `MAX_TIP_BPS`)

---

## Collateral Math: Why Solver Can't Oversell

```
Solver: $500k collateral, $0 locked, 1000 ITPs pre-minted

User A buys $100k of ITP #7
  → lock $200k (2x) → freeCollateral = $300k ✓

User B buys $80k of ITP #422
  → lock $160k (2x) → freeCollateral = $140k ✓

User C buys $50k of ITP #3
  → lock $100k (2x) → freeCollateral = $40k ✓

User D buys $30k of ITP #891
  → lock $60k (2x) → require(free >= $60k) → $40k < $60k → REVERTS ✗

Solver has inventory for ALL 1000 ITPs but can only front
$250k total across ALL of them (because 2x lock on $500k).

Pipeline settles User A → unlock $200k → freeCollateral = $240k
Now User D can buy again.
```

---

## Current Pipeline (Corrected)

```
1. Lock USDC on Arb (ArbBridgeCustody)
2. Bridge ARB→L3 & Submit order on L3
3. Issuers confirm collateral routing and submit orders on L3
4. Bridge L3→ARB USDC to BLSCustody
5. Transfer to Bitget
6. Fill trades on Bitget
7. Issuers update inventory and mint ITP on L3
8. Bridge ITP L3→ARB
```

---

## Instant Buy Flow (with 0x for Price Discovery)

0x is **price discovery only**. Settlement goes through SolverVault. Why: 0x ExchangeProxy does raw ERC20 transfers with no collateral check. If solver approved ExchangeProxy directly, it would bypass all security.

```
    User                   0x API            Our RFQ Server        SolverVault (on-chain)
     │                       │                     │                        │
 1.  │─"quote: 1000 USDC    │                     │                        │
     │  → ITP-TOP-100"─────▶│                     │                        │
     │                       │                     │                        │
 2.  │                       │──POST /rfq/quote──▶│                        │
     │                       │                     │                        │
 3.  │                       │                     │─view: inventory?       │
     │                       │                     │─view: freeCollateral?──▶│
     │                       │                     │◀─$300k free, 500 ITP──│
     │                       │                     │                        │
 4.  │                       │◀─quote: 998 shares  │                        │
     │                       │  at price $1.002    │                        │
     │                       │  (nav + 0.2% tip)   │                        │
     │                       │  settle via:        │                        │
     │                       │  SolverVault        │                        │
     │                       │  .instantBuy()      │                        │
     │                       │                     │                        │
 5.  │◀─quote response──────│                     │                        │
     │  "998 ITP for $1000"  │                     │                        │
     │  "call SolverVault    │                     │                        │
     │   .instantBuy()"      │                     │                        │
     │                       │                     │                        │
 6.  │─tx: SolverVault.instantBuy(itp_42, 1000 USDC, deadline)────────────▶│
     │                       │                     │                        │
     │                       │                     │           ON-CHAIN:    │
     │                       │                     │   a. nav = prices[42]  │
     │                       │                     │   b. shares = 1000/nav │
     │                       │                     │   c. require(          │
     │                       │                     │       inventory[42]    │
     │                       │                     │       >= shares)       │
     │                       │                     │   d. require(          │
     │                       │                     │       freeCollateral   │
     │                       │                     │       >= 2 * 1000)     │
     │                       │                     │   e. lockedCollateral  │
     │                       │                     │       += 2000          │
     │                       │                     │   f. USDC.transferFrom │
     │                       │                     │       (user → vault)   │
     │                       │                     │   g. BridgedITP        │
     │                       │                     │       .transfer(user,  │
     │                       │                     │        shares)         │
     │                       │                     │   h. inventory[42]     │
     │                       │                     │       -= shares        │
     │                       │                     │   i. forward USDC →    │
     │                       │                     │     ArbBridgeCustody   │
     │                       │                     │     .buyITPFromArb()   │
     │                       │                     │                        │
 7.  │◀─ITP in wallet ✓─────────────────────────────────────────────────────│
```

**User DONE. Every check was on-chain. Solver had zero control.**

### Background Replenishment (~60s, user doesn't see)

After step (i) triggers the pipeline:

```
R1. Bridge ARB→L3 & Submit order on L3
R2. Issuers confirm collateral routing, submit orders on L3
R3. Bridge L3→ARB USDC to BLSCustody
R4. Transfer to Bitget
R5. Fill trades on Bitget
R6. Issuers update inventory, mint ITP on L3
R7. Bridge ITP L3→ARB → BridgeProxy.mintBridgedShares(itpId, SolverVault, shares)
    • New ITP minted to SolverVault → inventory replenished
R8. Issuers BLS sign → SolverVault.settleFill(fillId, shares, blsSig)
    • lockedCollateral -= collateralLocked
    • inventory[itpId] += shares
    • Tip paid to solver
```

---

## Instant Sell Flow

```
    User                   0x API            Our RFQ Server        SolverVault (on-chain)
     │                       │                     │                        │
 1.  │─"quote: sell 500      │                     │                        │
     │  ITP-TOP-100          │                     │                        │
     │  for USDC"───────────▶│                     │                        │
     │                       │                     │                        │
 2.  │                       │──POST /rfq/quote──▶│                        │
     │                       │                     │─view: freeCollateral?──▶│
     │                       │                     │◀─enough to pay user───│
     │                       │                     │                        │
 3.  │◀─quote: 498 USDC─────│                     │                        │
     │  (nav - 0.2% tip)     │                     │                        │
     │  settle via:          │                     │                        │
     │  SolverVault          │                     │                        │
     │  .instantSell()       │                     │                        │
     │                       │                     │                        │
 4.  │─tx: SolverVault.instantSell(itp_42, 500 shares, minUsdc, deadline)─▶│
     │                       │                     │                        │
     │                       │                     │           ON-CHAIN:    │
     │                       │                     │   a. nav = prices[42]  │
     │                       │                     │   b. grossUsdc =       │
     │                       │                     │      (500 * nav)/1e18  │
     │                       │                     │   c. require(          │
     │                       │                     │       freeCollateral   │
     │                       │                     │       >= 2 * gross)    │
     │                       │                     │   d. lockedCollateral  │
     │                       │                     │       += 2 * gross     │
     │                       │                     │   e. BridgedITP        │
     │                       │                     │       .transferFrom    │
     │                       │                     │       (user → vault)   │
     │                       │                     │   f. inventory[42]     │
     │                       │                     │       += 500           │
     │                       │                     │   g. USDC.transfer     │
     │                       │                     │       (user, netUsdc)  │
     │                       │                     │   h. forward sell →    │
     │                       │                     │     ArbBridgeCustody   │
     │                       │                     │     .sellITPFromArb()  │
     │                       │                     │                        │
 5.  │◀─USDC in wallet ✓────────────────────────────────────────────────────│
```

### Background Sell Settlement (~60s)

```
S1. Reverse pipeline: burn ITP on L3, sell assets on Bitget
S2. Bridge USDC back to Arb
S3. ArbBridgeCustody.completeSellOrder() → USDC sent to SolverVault
S4. Issuers BLS sign → SolverVault.settleRedemption(id, usdcReturned, blsSig)
    • lockedCollateral -= collateralLocked
    • usdcCollateral += usdcReturned (replenishes solver's USDC pool)
    • inventory[itpId] -= itpAmount (ITP was burned by pipeline)
    • Tip paid to solver
```

---

## Price Update Flow (Permissionless)

`updatePrice()` is **fully permissionless**. Anyone can call it. Security = BLS signature verification, not caller identity.

### How It Works

Each issuer already exposes a public endpoint (`GET /api/nav-sign?itp=0x...`) that returns a BLS-signed NAV price. Individual signatures are harmless — only aggregated signatures (11/20+) pass on-chain verification.

```
    Anyone (user, bot, frontend, MEV searcher)
     │
     │  1. Poll each issuer's public endpoint:
     │       GET issuer1.example.com/api/nav-sign?itp=0x...
     │       GET issuer2.example.com/api/nav-sign?itp=0x...
     │       ... (collect 11+ of 20)
     │
     │     Each issuer independently:
     │       a. Read ITP inventory from chain (per-share quantities)
     │       b. Fetch live prices from Bitget API
     │       c. Compute NAV = Σ(qty[i] * price[i]) / 1e18
     │       d. BLS sign: keccak256(encodePacked(itpAddress, nav, timestamp, cycleNumber))
     │       e. Return { price, timestamp, cycleNumber, blsSignature, issuerId, pubkey }
     │
     │  2. Aggregate 11+ individual BLS sigs off-chain (simple math, no private keys)
     │
     │  3. Call SolverVault.updatePrice(itpId, nav, timestamp, cycleNumber, aggregatedBlsSig)
     │
     ▼
  SolverVault (on-chain):
     a. message = keccak256(encodePacked(itpAddress, nav, timestamp, cycleNumber))
     b. BLSLib.verifyBLS(issuerRegistry.getAggregatedPubkey(), message, blsSig) ✓
     c. Check drift: |nav - prices[itpId]| / prices[itpId] > 50%
     d. prices[itpId] = nav
```

### Why No Keeper Is Needed

- Issuer endpoints are already public (existing `/api/nav-sign`)
- BLS aggregation is simple off-chain math (no private keys required)
- `updatePrice()` has no `onlySolver` or `onlyIssuer` modifier — anyone can submit
- Incentive: if price is stale, buyers/sellers who want accurate pricing just aggregate sigs themselves before calling `instantBuy()`/`instantSell()`
- Frontend can do it automatically as a multicall: `updatePrice()` + `instantBuy()` in same tx

### Why Solver Cannot Manipulate Price

- Solver has no BLS keys → cannot produce valid signatures
- Only 11/20 issuer consensus can produce an aggregated sig that passes `BLSLib.verifyBLS()`
- Even if solver calls `updatePrice()`, they'd need a valid BLS sig from issuers

### Overcollateralization Covers Price Swing Window

Between updates, 2x collateral covers the 50% drift threshold:

```
Price goes UP 50%:   ITP worth 1.5x, collateral = 2x → still 1.33x covered
Price goes DOWN 50%: ITP worth 0.5x, collateral = 2x → still 4x covered
```

---

## Security: Attack-by-Attack Analysis

| Attack | Prevention |
|---|---|
| **Sell ITP without collateral** | `instantBuy()` step (d): `require(freeCollateral >= 2x)`. On-chain. Reverts. |
| **Double-spend same ITP to 2 users** | step (c): `require(inventory >= shares)`, step (h): inventory decremented atomically. EVM sequential execution — tx 2 sees tx 1's state. |
| **Drain all 1000 ITPs at once** | Each sell locks 2x from SHARED collateral pool. $500k collateral = max $250k of ITP across all 1000 products. Remaining millions of shares are stuck in vault. |
| **Withdraw ITP directly** | No `withdrawInventory()` function. Only `instantBuy()` moves ITP out, and it requires user paying USDC + collateral check. |
| **Set fake price** | `updatePrice()` is BLS-gated: requires 11/20 issuer signatures. Solver has zero write access. |
| **Front-run price update** | Price updates only when NAV drifts >50%. 100% overcollateralization (2x) covers worst case in both directions. |
| **Never replenish, take tips forever** | Pipeline runs automatically (triggered in step i). Inventory depletes → can't sell more. Collateral stays locked until settlement. |
| **Sell via 0x ExchangeProxy to bypass collateral** | ITP is in SolverVault contract, NOT solver's wallet. Solver never has ERC20 approval. Only `instantBuy()` can transfer ITP out. |

---

## What Each Party Controls

| Party | Controls |
|---|---|
| **Solver** | How much collateral to deposit (more = more capacity). Tip rate (capped). Withdraw FREE collateral only. |
| **Issuers (BLS 11/20)** | Sign prices and settlement data. Never need to call SolverVault directly — anyone can relay their aggregated signatures. |
| **Anyone** | Can call `updatePrice()`, `settleFill()`, `settleRedemption()` — all BLS-verified. Can call `instantBuy()`, `instantSell()`. Incentive-compatible: users update prices themselves if stale. |
| **On-chain contract** | Collateral >= 2x for every instant buy/sell. Inventory check before every transfer. No ITP withdrawal without user paying. No price change without valid BLS (11/20). |
| **0x** | Price discovery — users find ITP quotes on Coinbase, MetaMask, etc. Does NOT handle settlement (SolverVault does). |

---

## Contract Interface (V1 — Single Solver)

```solidity
contract SolverVault is UUPSUpgradeable, ReentrancyGuardUpgradeable {

    // ── Constants ──
    uint256 public constant COLLATERAL_RATIO = 2;      // 100% overcollateralization
    uint256 public constant MAX_TIP_BPS = 100;          // 1% max tip
    uint256 public constant GRACE_PERIOD = 2 hours;

    // ── Single Solver State (V1) ──
    address public solver;
    uint256 public usdcCollateral;       // Total deposited (18 dec)
    uint256 public lockedCollateral;     // Currently locked by pending fills/sells
    uint256 public tipBps;

    // ── Price (BLS-gated) ──
    mapping(bytes32 => uint256) public prices;  // itpId → cached NAV

    // ── Inventory ──
    mapping(bytes32 => uint256) public inventory;  // itpId → pre-minted shares

    // ── Pending Operations ──
    struct PendingFill {
        address user;
        bytes32 itpId;
        uint256 usdcAmount;
        uint256 itpAmount;
        uint256 collateralLocked;
        uint256 tipAmount;
        uint256 arbOrderId;
        uint256 deadline;
        bool settled;
    }

    struct PendingRedemption {
        address user;
        bytes32 itpId;
        uint256 itpAmount;
        uint256 usdcPaid;
        uint256 collateralLocked;
        uint256 tipAmount;
        uint256 arbSellOrderId;
        uint256 deadline;
        bool settled;
    }

    mapping(uint256 => PendingFill) public pendingFills;
    mapping(uint256 => PendingRedemption) public pendingRedemptions;
    uint256 public nextFillId;
    uint256 public nextRedemptionId;

    // ── External references ──
    IArbBridgeCustody public arbBridgeCustody;
    IIssuerRegistry public issuerRegistry;
    IERC20 public usdc;

    // ── Permissionless functions (anyone can call) ──
    function instantBuy(bytes32 itpId, uint256 usdcAmount, uint256 deadline) external;
    function instantSell(bytes32 itpId, uint256 itpAmount, uint256 minUsdcOut, uint256 deadline) external;
    function timeoutFill(uint256 fillId) external;
    function timeoutRedemption(uint256 redemptionId) external;
    function updatePrice(bytes32 itpId, uint256 newNav, uint256 timestamp, uint64 cycleNumber, bytes calldata blsSig) external;  // BLS-verified, anyone submits
    function settleFill(uint256 fillId, uint256 itpSharesMinted, bytes calldata blsSig) external;  // BLS-verified, anyone submits
    function settleRedemption(uint256 redemptionId, uint256 usdcReturned, bytes calldata blsSig) external;  // BLS-verified, anyone submits

    // ── Solver-only functions ──
    function depositCollateral(uint256 usdcAmount) external;
    function withdrawFreeCollateral(uint256 usdcAmount) external;
    function depositInventory(bytes32 itpId, uint256 amount) external;
    function setTipBps(uint256 newTipBps) external;

    // ── View ──
    function freeCollateral() public view returns (uint256) {
        return usdcCollateral - lockedCollateral;
    }
}
```

---

## Bootstrap (Once, Before Users Can Buy)

```
B1. Deploy SolverVault with solver = teamAddress
B2. For each of the 1000 ITPs:
    • Issuers BLS sign → BridgeProxy.mintBridgedShares(itpId, SolverVault, shares)
    • Pre-mints unbacked BridgedITP into SolverVault inventory
B3. Solver deposits USDC collateral:
    • SolverVault.depositCollateral(usdcAmount)
    • On-chain for atomic locking, issuers bridge to Bitget for custody
B4. Issuers BLS sign → SolverVault.updatePrice(itpId, nav, blsSig) for each ITP
B5. Deploy RFQ quote server, register with 0x as market maker
```

---

## Required Pipeline Changes

### Change 0: Implement `mintBridgedShares` Phase (PREREQUISITE)

Missing today. Needed regardless of solver.

| File | Change |
|---|---|
| `issuer/src/bridge/types.rs` | Add `MintedOnArb` to `BridgeOrderStatus` enum |
| `issuer/src/bridge/types.rs` | Add `MintBridgedSharesProposal` struct |
| `issuer/src/bridge/types.rs` | Add `build_mint_bridged_shares_calldata()` helper |
| `issuer/src/bridge/orchestrator.rs` | Add `run_mint_bridged_shares_phase()` — BLS consensus + call `BridgeProxy.mintBridgedShares()` on Arb |
| `issuer/src/consensus/protocol.rs` | Add consensus message type for mint phase |
| `issuer/src/main.rs` | Wire new phase after `run_fills_confirm_phase()` |

### Change 1: SolverVault Contract

| File | Change |
|---|---|
| `contracts/src/solver/SolverVault.sol` | **New** — full contract (buy + sell + price + settlement) |
| `contracts/src/interfaces/ISolverVault.sol` | **New** — interface |
| `contracts/src/libraries/ErrorsLib.sol` | Add error codes `E125_*` through `E135_*` |
| `contracts/test/SolverVault.t.sol` | **New** — Foundry tests |
| `contracts/script/DeploySolverVault.s.sol` | **New** — deploy script |

### Change 2: Settlement Phases in Orchestrator

| File | Change |
|---|---|
| `issuer/src/bridge/types.rs` | Add `Settled`, `RedeemedOnArb` statuses. Add `SettleFillProposal`, `SettleRedemptionProposal` structs. Add `solver_vault_address: Option<Address>` to `BridgeConfig`. |
| `issuer/src/bridge/orchestrator.rs` | Add `run_settle_solver_fill_phase()` and `run_settle_solver_redemption_phase()` — BLS consensus to call SolverVault |
| `issuer/src/main.rs` | Wire after `MintedOnArb` phase, only for solver orders |
| Issuer CLI args | Add `--solver-vault <address>` flag |

### Change 3: start.sh + Deployment

| File | Change |
|---|---|
| `start.sh` | Add step: deploy SolverVault, pre-mint ITPs, fund solver, deposit collateral, set prices |
| `deployments/active-deployment.json` | Add `SolverVault` address |

### Change 4: Frontend

| File | Change |
|---|---|
| `frontend/components/domain/BuyItpModal.tsx` | Add "Instant Buy" option when solver has inventory |
| `frontend/components/domain/SellItpModal.tsx` | Add "Instant Sell" option when solver has free collateral |
| `frontend/hooks/useSolverVault.ts` | **New** — read solver status, inventory, free collateral, prices |
| `frontend/hooks/useInstantBuy.ts` | **New** — call `SolverVault.instantBuy()` |
| `frontend/hooks/useInstantSell.ts` | **New** — call `SolverVault.instantSell()` |

### Change 5: RFQ Quote Server (for 0x discovery)

| File | Change |
|---|---|
| `rfq-server/` | **New** — HTTP server responding to 0x RFQ requests |
| `rfq-server/src/main.rs` | Quote endpoint: check SolverVault inventory + collateral, return price |
| `rfq-server/src/fill_watcher.rs` | Watch SolverVault events, track pending fills/redemptions |

---

## Implementation Order

| Phase | What | Effort | Depends On |
|---|---|---|---|
| **0** | Implement `mintBridgedShares` in issuer pipeline | 3-4 days | Nothing (prerequisite) |
| **1** | SolverVault contract (buy + sell + price + settlement + tests) | 5-6 days | Phase 0 |
| **2** | Settlement + redemption phases in orchestrator | 3-4 days | Phase 0 + 1 |
| **3** | Deploy script + start.sh integration | 1 day | Phase 1 |
| **4** | Frontend instant buy + sell UI | 2-3 days | Phase 1 + 2 |
| **5** | RFQ quote server (0x integration) | 3-4 days | Phase 1 |
| **6** | E2E tests | 2 days | All above |
| **Total** | | **~19-24 days** | |

---

## Verification Plan

1. **Unit tests** (Foundry): SolverVault — deposit, instantBuy, instantSell, settleFill, settleRedemption, updatePrice, timeout, double-spend rejection across multiple ITPs
2. **Integration test** (Rust): Full buy pipeline — instantBuy → bridge → fill → mint → settleFill
3. **Integration test** (Rust): Full sell pipeline — instantSell → bridge sell → burn → release USDC → settleRedemption
4. **Invariant test**: `lockedCollateral <= usdcCollateral` always (combined buy + sell locks across all 1000 ITPs)
5. **Stress test**: Concurrent buys on different ITPs — verify shared collateral pool limits total exposure
6. **E2E test** (Playwright): User instant buy → ITP in wallet same block → solver settles in background
7. **E2E test** (Playwright): User instant sell → USDC in wallet same block → solver settles in background
8. **RFQ test**: 0x quote server returns valid quote, user fills via SolverVault

---

## Related Research

- [RFQ Infrastructure Market Research](research/market-dex-cex-rfq-infrastructure-research-2026-02-18.md) — Full mapping of RFQ backends (0x, 1inch, Li.Fi, etc.)
- [0x & Li.Fi Integration Analysis](research/architecture-0x-lifi-integration-analysis-2026-02-18.md) — 4-approach comparison for underlying asset execution

---
---

# V2: Permit2-Native Solver with BLS-Gated Capacity + Price Bands

**Date:** 2026-02-19
**Author:** max + Claude (Adversarial Review → Redesign)
**Status:** DRAFT — replaces V1 above

---

## Why V1 Is Wrong

V1's design routes settlement through a custom `SolverVault.instantBuy()`. This is **incompatible with 0x v2**, which settles RFQ orders via dual Permit2 transfers (maker→user + user→maker) through the [Settler contract](https://github.com/0xProject/0x-settler). 0x-powered interfaces (MetaMask, Coinbase Wallet) generate calldata targeting Settler, not arbitrary contracts. You cannot use 0x for "price discovery only" — 0x IS the settlement.

Additional V1 issues found in adversarial review:
- USDC decimal mismatch (6 dec on Arb, contract assumes 18)
- No slippage protection on `instantBuy` (no `minSharesOut`)
- 50% drift threshold = free arbitrage window
- `mintBridgedShares` already exists (Phase 0 is wasted effort)
- Sell-side collateral accounting doesn't account for USDC payout reducing freeCollateral
- Timeout behavior undefined
- Function names wrong (`buyITPFromArb` vs actual `buyITPFromArbitrum`)
- 2x overcollateralization makes $200K collateral → $100K capacity (capital-inefficient for $20M inventory)

---

## Core Design: Three-Layer Security

```
Layer 0: BLS-signed prices stored on-chain (issuers update periodically)

Layer 1: isValidSignature (real-time, on-chain, in Permit2 flow)
         ├─ Price staleness check: REVERTS if price too old
         └─ Price band check: REVERTS if trade price outside band

Layer 2: ERC20 allowance cap (real-time, on-chain)
         └─ Issuers BLS-sign to set allowance from vault to Permit2
         └─ Hard ceiling on total transfers, enforced by EVM

Layer 3: Post-trade issuer monitoring (near-real-time)
         └─ Issuers verify actual trade prices from on-chain events
         └─ Slash solver collateral if fraud detected
```

**Issuers control:**
- Prices (BLS-signed NAV stored on-chain)
- Capacity (BLS-signed ERC20 allowance to Permit2)
- Emergency shutdown (revoke all allowances via BLS)
- Fraud punishment (slash collateral via BLS)

**Solver controls:**
- Individual trade execution (RFQ server signs Permit2 within issuer-set bounds)
- Nothing else

---

## Architecture

```
Issuers (BLS 11/20)
        │
        ├─ BLS sign: updatePrice(itpId, nav, blsSig)
        │  → prices[itpId] = nav (on-chain)
        │
        ├─ BLS sign: authorizeItpCapacity(itpId, amount, blsSig)
        │  → bridgedITP.approve(permit2, amount) (ERC20 allowance)
        │
        ├─ BLS sign: authorizeUsdcCapacity(amount, blsSig)
        │  → usdc.approve(permit2, amount) (ERC20 allowance)
        │
        └─ BLS sign: slashSolver(...) / revokeAllCapacity(...)
                     (post-trade enforcement / emergency)
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ SolverVault (on-chain, Arbitrum)                             │
│                                                              │
│ Holds: BridgedITP + USDC + solver fraud bond                 │
│ Implements: ERC-1271 (isValidSignature) + BLSVerifier        │
│                                                              │
│ isValidSignature(hash, sig):          ← called by Permit2    │
│   1. Verify RFQ server ECDSA sig      (staticcall, read-only)│
│   2. Check price freshness            → REVERT if stale      │
│   3. Check price band                 → REVERT if out of band│
│   4. Return ERC-1271 magic            → Permit2 proceeds     │
│                                                              │
│ ERC20 allowance to Permit2:           ← set by issuers (BLS) │
│   bridgedITP.allowance(vault, permit2) = X                   │
│   usdc.allowance(vault, permit2) = Y                         │
│   Hard cap. Even compromised RFQ key can't exceed.           │
└──────────────────────────────────────────────────────────────┘
        │                    ▲
        │ ERC20 allowance    │ isValidSignature (staticcall)
        ▼                    │
┌──────────────────────────────────────────────────────────────┐
│ Permit2 → 0x Settler                                         │
│ Standard 0x RFQ settlement. No custom contracts in this path.│
│ Dual Permit2 transfers: user USDC→vault, vault ITP→user      │
└──────────────────────────────────────────────────────────────┘
```

**SolverVault is NEVER called during settlement** (except `isValidSignature` as a read-only staticcall). Settlement is 100% standard 0x.

---

## Buy Flow (Fully 0x-Native)

```
    User              0x API         RFQ Server          SolverVault         Permit2/Settler
     │                  │                │                    │                     │
     │                  │                │    ┌───────────────────────────────┐     │
     │                  │                │    │ PRECONDITION (periodic):      │     │
     │                  │                │    │ Issuers BLS-signed:           │     │
     │                  │                │    │  • prices[itp42] = $1.00      │     │
     │                  │                │    │  • ITP-42 allowance = 5000    │     │
     │                  │                │    │  • USDC allowance = $500K     │     │
     │                  │                │    └───────────────────────────────┘     │
     │                  │                │                    │                     │
 1.  │─"swap 1000 USDC  │                │                    │                     │
     │  for ITP-42"────▶│                │                    │                     │
     │                  │──POST /price──▶│                    │                     │
     │                  │                │                    │                     │
 2.  │                  │          Server checks:             │                     │
     │                  │          a. ITP-42 allowance > 0    │                     │
     │                  │          b. Fetch issuer NAV        │                     │
     │                  │          c. price = nav + spread    │                     │
     │                  │          d. shares = 1000 / price   │                     │
     │                  │                │                    │                     │
 3.  │                  │          Signs Permit2 permit:      │                     │
     │                  │          "Transfer 998 ITP-42       │                     │
     │                  │           from vault, nonce=N,      │                     │
     │                  │           deadline=now+60s"         │                     │
     │                  │          sig = encode(ecdsaSig,     │                     │
     │                  │            itpId, 998, 1000_USDC)   │                     │
     │                  │                │                    │                     │
 4.  │                  │◀─signed order──│                    │                     │
     │◀─0x calldata────│  (standard 0x RFQ response)         │                     │
     │  (targets Settler)                │                    │                     │
     │                  │                │                    │                     │
 5.  │─submit tx────────────────────────────────────────────────────────────────▶│
     │                  │                │                    │          Settler:   │
     │                  │                │                    │  a. Permit2 xfer:   │
     │                  │                │                    │     user 1000 USDC  │
     │                  │                │                    │     → vault         │
     │                  │                │                    │                     │
     │                  │                │                    │  b. Permit2 calls   │
     │                  │                │                    │◀─isValidSignature()─│
     │                  │                │                    │   (staticcall):     │
     │                  │                │                    │   i.  ECDSA check ✓ │
     │                  │                │                    │   ii. price age ✓   │
     │                  │                │                    │   iii. band check:  │
     │                  │                │                    │     $1000/998       │
     │                  │                │                    │     = $1.002/share  │
     │                  │                │                    │     vs NAV $1.00    │
     │                  │                │                    │     → 0.2% dev ✓   │
     │                  │                │                    │   iv. return magic──▶│
     │                  │                │                    │                     │
     │                  │                │                    │  c. ERC20 xfer:     │
     │                  │                │                    │     vault ITP-42    │
     │                  │                │                    │     → user (998)    │
     │                  │                │                    │     allowance -= 998│
     │                  │                │                    │                     │
 6.  │◀─ITP in wallet ✓─────────────────────────────────────────────────────────│
     │  (standard 0x swap receipt)       │                    │                     │
```

**User experience: identical to any 0x swap.** Works on MetaMask, Coinbase Wallet, any 0x aggregator.

---

## Sell Flow (Same Pattern, Reversed)

RFQ server signs Permit2 for USDC (vault → user). User signs Permit2 for ITP (user → vault).

`isValidSignature` for USDC side: same checks — price freshness, band, ECDSA.

USDC allowance (set by issuers) caps total sell payouts.

---

## `isValidSignature` — The On-Chain Price Guard

```solidity
function isValidSignature(
    bytes32 hash,
    bytes calldata sig
) external view returns (bytes4) {
    // Unpack: RFQ server packs trade metadata into signature bytes
    (
        bytes memory ecdsaSig,
        bytes32 itpId,
        uint256 itpAmount,
        uint256 usdcCounterparty
    ) = abi.decode(sig, (bytes, bytes32, uint256, uint256));

    // 1. RFQ server must have signed the Permit2 hash
    if (ECDSA.recover(hash, ecdsaSig) != rfqSigner) return 0xffffffff;

    // 2. BLS-signed price must be fresh
    if (block.timestamp - priceTimestamps[itpId] > MAX_PRICE_AGE) {
        return 0xffffffff; // FORCES price update before any trade
    }

    // 3. Effective price must be within band of BLS-signed NAV
    uint256 nav = prices[itpId];
    uint256 effectivePrice = (usdcCounterparty * 1e18) / itpAmount;
    uint256 deviation = effectivePrice > nav
        ? effectivePrice - nav
        : nav - effectivePrice;
    if (deviation * 10000 / nav > priceBandBps) {
        return 0xffffffff; // FORCES recomputation at correct price
    }

    return ERC1271_MAGIC; // 0x1626ba7e
}
```

**Key behaviors:**
- **Stale price → ALL trades blocked.** RFQ server (or anyone) must get issuers to `updatePrice()` first. No trading on old prices.
- **Price outside band → trade rejected.** Even if RFQ server is compromised, it can't sell ITP at a discount beyond `priceBandBps`.
- **Read-only.** `staticcall`-safe. No state changes. Just reads `prices[]` and `priceTimestamps[]`.

---

## Price Update Flow (Same as V1, Reused)

`updatePrice()` is permissionless. Anyone submits BLS-aggregated issuer signatures.

```solidity
function updatePrice(
    bytes32 itpId,
    uint256 newNav,
    uint256 timestamp,
    bytes calldata blsSig
) external {
    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "updatePrice",
        itpId, newNav, timestamp
    ));
    _verifyBLS(message, blsSig);

    prices[itpId] = newNav;
    priceTimestamps[itpId] = timestamp;

    emit PriceUpdated(itpId, newNav, timestamp);
}
```

Frontend multicalls: `updatePrice()` + swap in same tx if price is stale.

---

## Capacity Authorization (Issuers Set the Ceiling)

```solidity
function authorizeItpCapacity(
    bytes32 itpId,
    uint256 amount,
    bytes calldata blsSig
) external {
    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "authorizeItpCapacity",
        itpId, amount
    ));
    _verifyBLS(message, blsSig);

    IERC20(bridgedItps[itpId]).approve(permit2, amount);
    emit CapacityAuthorized(itpId, amount);
}

function authorizeUsdcCapacity(
    uint256 amount,
    bytes calldata blsSig
) external {
    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "authorizeUsdcCapacity", amount
    ));
    _verifyBLS(message, blsSig);

    usdc.approve(permit2, amount);
    emit UsdcCapacityAuthorized(amount);
}

function revokeAllCapacity(bytes calldata blsSig) external {
    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "revokeAllCapacity"
    ));
    _verifyBLS(message, blsSig);

    // Zero all ITP allowances
    for (uint i = 0; i < registeredItps.length; i++) {
        IERC20(bridgedItps[registeredItps[i]]).approve(permit2, 0);
    }
    usdc.approve(permit2, 0);

    emit AllCapacityRevoked();
}
```

**Issuers decide the number.** Not a formula. They look at:
- Pipeline health (is it settling reliably?)
- Solver collateral (fraud bond size)
- Market volatility
- And authorize what they're comfortable with.

The capacity is a **flow**, not a stock. Issuers re-authorize frequently as pipeline replenishes.

---

## Post-Trade Verification & Slashing (Layer 3)

Issuers monitor Permit2 `Transfer` events. Both sides of each trade are visible on-chain:
- ITP transfer: vault → user, X shares
- USDC transfer: user → vault, Y USDC

```
effectivePrice = Y / X
if |effectivePrice - nav_at_time| / nav_at_time > priceBandBps:
    → evidence of fraud or malfunction
```

```solidity
function slashSolver(
    uint256 slashAmount,
    address recipient,
    bytes calldata evidence,
    bytes calldata blsSig
) external {
    bytes32 message = keccak256(abi.encode(
        block.chainid, address(this), "slashSolver",
        slashAmount, recipient, keccak256(evidence)
    ));
    _verifyBLS(message, blsSig);

    // Transfer from solver's fraud bond
    uint256 actual = Math.min(slashAmount, fraudBond);
    fraudBond -= actual;
    usdc.transfer(recipient, actual);

    emit SolverSlashed(slashAmount, recipient);
}
```

---

## Collateral Is a Fraud Bond, Not a Trade Lock

| | V1 (Original) | V2 (This) |
|---|---|---|
| **Purpose** | Lock 2x per trade | Fraud bond — slashed if solver cheats |
| **When touched** | Every trade | Never (unless fraud or pipeline failure) |
| **Capacity formula** | capacity = collateral / 2 | capacity = whatever issuers authorize |
| **$200K collateral** | $100K total trades | Issuers can authorize $2M+ if pipeline is healthy |
| **Capital efficiency** | 50% of collateral | Collateral decoupled from capacity |
| **What it protects** | "Solver can't oversell" | "If solver cheats, there's money to seize" |

---

## Contract Interface (V2)

```solidity
contract SolverVault is BLSVerifier, ReentrancyGuard {

    // ── Constants ──
    uint256 public constant MAX_PRICE_AGE = 5 minutes;
    uint256 public constant MAX_PRICE_BAND_BPS = 500;  // 5% max deviation

    // ── Config (BLS-gated) ──
    address public rfqSigner;
    uint256 public priceBandBps;       // e.g., 200 = 2%

    // ── Price (BLS-gated) ──
    mapping(bytes32 => uint256) public prices;
    mapping(bytes32 => uint256) public priceTimestamps;

    // ── Fraud bond ──
    uint256 public fraudBond;

    // ── ITP registry ──
    mapping(bytes32 => address) public bridgedItps;  // itpId → BridgedITP address
    bytes32[] public registeredItps;

    // ── External references ──
    IIssuerRegistry public issuerRegistry;
    address public permit2;
    IERC20 public usdc;
    address public solver;

    // ── ERC-1271 (Permit2 calls this) ──
    function isValidSignature(bytes32 hash, bytes calldata sig)
        external view returns (bytes4);

    // ── BLS-gated: issuers control everything ──
    function updatePrice(bytes32 itpId, uint256 nav, uint256 timestamp,
        bytes calldata blsSig) external;
    function authorizeItpCapacity(bytes32 itpId, uint256 amount,
        bytes calldata blsSig) external;
    function authorizeUsdcCapacity(uint256 amount,
        bytes calldata blsSig) external;
    function revokeAllCapacity(bytes calldata blsSig) external;
    function slashSolver(uint256 amount, address recipient,
        bytes calldata evidence, bytes calldata blsSig) external;
    function setRfqSigner(address newSigner,
        bytes calldata blsSig) external;
    function setPriceBandBps(uint256 newBandBps,
        bytes calldata blsSig) external;

    // ── Solver-only ──
    function depositFraudBond(uint256 usdcAmount) external;
    function withdrawFraudBond(uint256 usdcAmount) external;
    function depositItp(bytes32 itpId, uint256 amount) external;
    function depositUsdc(uint256 amount) external;
    function registerItp(bytes32 itpId, address bridgedItp) external;

    // ── View ──
    function getRemainingItpCapacity(bytes32 itpId)
        external view returns (uint256);
    function getRemainingUsdcCapacity()
        external view returns (uint256);
    function isPriceFresh(bytes32 itpId)
        external view returns (bool);
}
```

~150 lines of implementation. No fill tracking, no timeout logic, no collateral locking/unlocking, no decimal conversion, no tip accounting.

---

## Background Replenishment (Unchanged from V1)

After buy settles via 0x, vault has user's USDC and fewer ITP:

```
R1. RFQ server detects: vault USDC increased, ITP allowance decreased
R2. Forwards USDC → ArbBridgeCustody.buyITPFromArbitrum()
R3. Pipeline: bridge → fill → mint
R4. BridgeProxy.mintBridgedShares(itpId, solverVault, shares, blsSig)
    → New BridgedITP in vault
R5. Issuers re-authorize capacity:
    authorizeItpCapacity(itpId, newAmount, blsSig)
```

After sell, vault has user's ITP and less USDC:

```
S1. BridgeProxy.burnBridgedShares(itpId, solverVault, amount, blsSig)
S2. Pipeline: sell underlying → bridge USDC back
S3. USDC arrives in vault
S4. Issuers re-authorize USDC capacity:
    authorizeUsdcCapacity(newAmount, blsSig)
```

---

## Security: Attack-by-Attack Analysis (V2)

| Attack | Prevention |
|---|---|
| **Sell ITP below NAV (compromised RFQ key)** | `isValidSignature` checks price band → REVERTS if effective price outside band. Post-trade: issuers detect, slash fraud bond, revoke capacity. |
| **Sell ITP with stale price** | `isValidSignature` checks `priceTimestamps[itpId]` → REVERTS if price older than `MAX_PRICE_AGE`. Forces `updatePrice()` first. |
| **Drain all inventory via compromised key** | ERC20 allowance caps total transfers. Attacker limited to current allowance, NOT full vault balance. Issuers `revokeAllCapacity()` to stop the bleed. |
| **Solver withdraws ITP/USDC directly** | Solver can only withdraw what's NOT approved to Permit2. `withdraw` checks: `balance - allowance(permit2)`. Can't touch capacity-reserved tokens. |
| **Flash loan to drain capacity** | Attacker pays fair price (band-enforced). Draining capacity = buying all available ITP at fair price = normal trading. Capacity is the limit. |
| **Set fake price** | `updatePrice()` requires BLS 11/20. Same as V1. |
| **RFQ server self-reports wrong USDC amount** | If server inflates USDC to pass band check but actual trade has less USDC: server is cheating itself (vault receives less). Post-trade: issuers detect mismatch, slash. |
| **Stale allowance after price crash** | Issuers revoke + re-authorize at new price. Stale allowance = amount-based, not value-based. If ITP was $1 and drops to $0.50, the same 1000-share allowance is now worth $500 not $1000 — natural de-risking. |

---

## What Each Party Controls (V2)

| Party | Controls |
|---|---|
| **Issuers (BLS 11/20)** | Prices. Capacity (ERC20 allowances). Emergency shutdown. Slashing. RFQ key rotation. Price band width. Everything that matters. |
| **Solver (team)** | Deposit collateral (fraud bond). Deposit ITP/USDC. Nothing else. |
| **RFQ Server (ECDSA key, held by solver)** | Individual trade authorization within issuer-set bounds. Verified by ERC-1271. Capped by allowance. |
| **Anyone** | Submit `updatePrice()` with BLS sig. Frontend multicalls price update + swap. |
| **0x Settler** | Standard settlement. No custom logic. |
| **EVM (ERC20 allowance)** | Hard ceiling. Immune to software bugs, key compromises, or logic errors. `transferFrom` reverts when allowance = 0. |

---

## Bootstrap (V2)

```
B1. Deploy SolverVault on Arbitrum
B2. Solver deposits fraud bond (USDC)
B3. Solver deposits USDC for sell liquidity
B4. For each ITP:
    • Issuers BLS sign → BridgeProxy.mintBridgedShares(itpId, solverVault, shares, blsSig)
      (function already exists in BridgeProxy.sol:334)
    • Solver calls registerItp(itpId, bridgedItpAddress)
B5. Issuers BLS sign → updatePrice(itpId, nav, blsSig) for each ITP
B6. Issuers BLS sign → authorizeItpCapacity(itpId, amount, blsSig) for each ITP
B7. Issuers BLS sign → authorizeUsdcCapacity(totalAmount, blsSig)
B8. Deploy RFQ server, apply for 0x maker registration
    (BUSINESS DEPENDENCY: 0x reviews applications — start early)
```

---

## Required Changes (V2)

### New: SolverVault Contract (~150 lines)

| File | Change |
|---|---|
| `contracts/src/solver/SolverVault.sol` | **New** — BLSVerifier + ERC-1271 + capacity authorization |
| `contracts/src/interfaces/ISolverVault.sol` | **New** — interface |
| `contracts/test/SolverVault.t.sol` | **New** — Foundry tests |
| `contracts/script/DeploySolverVault.s.sol` | **New** — deploy script |

### New: RFQ Server

| File | Change |
|---|---|
| `rfq-server/src/main.rs` | **New** — 0x RFQ quote endpoint, Permit2 signing |
| `rfq-server/src/price_fetcher.rs` | **New** — fetch NAV from issuer endpoints |
| `rfq-server/src/capacity_watcher.rs` | **New** — watch on-chain allowances + vault balances |

### Changed: Issuer Capacity Signing

| File | Change |
|---|---|
| `issuer/src/bridge/orchestrator.rs` | Add `run_authorize_capacity_phase()` — BLS consensus to set allowances after replenishment |
| `issuer/src/bridge/types.rs` | Add `AuthorizeCapacityProposal` struct |
| `issuer/src/api/routes.rs` | Add `GET /api/nav-sign?itp=0x...` if not already exposed |

### Changed: Post-Trade Monitoring

| File | Change |
|---|---|
| `issuer/src/bridge/watchdog.rs` | Add Permit2 event monitoring for solver trades, price band verification |

### Not Needed (Eliminated from V1)

| V1 Component | Why Eliminated |
|---|---|
| `mintBridgedShares` phase (Change 0) | Already exists in `BridgeProxy.sol:334-360` |
| Settlement phases in orchestrator (Change 2) | Pipeline mints/burns directly to vault, issuers re-authorize capacity instead |
| Complex SolverVault (400+ lines) | Replaced by ~150-line version with no fill tracking/timeout/collateral locking |
| Frontend instant buy/sell hooks | Standard 0x swap — no custom UI needed for the trade itself |
| `start.sh` SolverVault deploy complexity | Simpler: deploy vault, deposit, authorize |

---

## Implementation Order (V2)

| Phase | What | Effort | Depends On |
|---|---|---|---|
| **0** | Apply for 0x RFQ maker registration | 0 days (start NOW) | Nothing — business dependency, long pole |
| **1** | SolverVault contract + tests | 2-3 days | Nothing |
| **2** | RFQ server (quote + Permit2 signing + capacity watching) | 4-5 days | Phase 1 |
| **3** | Issuer capacity authorization phase | 2 days | Phase 1 |
| **4** | Issuer post-trade monitoring (watchdog) | 1 day | Phase 1 |
| **5** | Bootstrap script + deploy | 1 day | Phase 1 + 3 |
| **6** | Frontend: capacity display + price freshness indicator | 0.5 days | Phase 1 |
| **7** | E2E tests | 2 days | All above |
| **Total** | | **~12-14 days** + 0x onboarding | |

---

## Verification Plan (V2)

1. **Unit tests** (Foundry): `isValidSignature` — valid sig, wrong signer, stale price, out-of-band price, expired deadline
2. **Unit tests** (Foundry): `authorizeItpCapacity` / `authorizeUsdcCapacity` — BLS verification, allowance set correctly
3. **Unit tests** (Foundry): `slashSolver` — BLS verification, fraud bond reduced, USDC transferred
4. **Unit tests** (Foundry): `withdrawFraudBond` — can't withdraw below zero, can't touch capacity-reserved tokens
5. **Integration test**: Permit2 transfer with SolverVault as ERC-1271 signer — full flow through real Permit2 contract
6. **Integration test**: Price staleness → transfer reverts → `updatePrice()` → transfer succeeds
7. **Integration test**: Price band → trade at NAV+1% succeeds, trade at NAV+10% reverts (with 5% band)
8. **Invariant test**: `bridgedITP.balanceOf(vault) >= bridgedITP.allowance(vault, permit2)` always
9. **E2E test**: Full 0x swap via Settler with SolverVault as maker
10. **E2E test**: Capacity exhaustion → swap reverts → issuers re-authorize → swap succeeds
