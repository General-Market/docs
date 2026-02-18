# Intent-Based ITP Lending Architecture

**Session ID:** 20260211-1545-k8m3
**Status:** Architecture Specification (v2 — Intent-Based Rewrite)
**Author:** Winston (Architect Agent)

---

## Executive Summary

The curator is an **independent market maker** for ITP lending. It prices risk globally across all ITP markets using a Shared Exposure Rate Model (SERM), sets interest rates directly via a custom IRM contract, and runs its own liquidation loop.

Users interact with the curator API to get a **quote** (rate, health factor, max borrow), then execute everything themselves on-chain via Morpho Bundler — including pushing the BLS-signed oracle price.

**Key design decisions:**
- **Intent-based**: User gets quote from curator → user executes all on-chain txs
- **Curator-managed rates**: Custom `CuratorRateIRM` replaces AdaptiveCurveIRM — the curator IS the market, organic per-pool utilization is meaningless
- **Global utilization**: Base rate driven by total USDC borrowed / total vault assets — one pool, one utilization. Kink curve incentivizes early borrowers (cheap) and attracts lenders when vault gets low (expensive)
- **Correlated risk pricing**: SERM algorithm prices ITPs sharing underlying assets together — ETF-aware risk model
- **Liquidity-aware**: Per-ITP rates factor in weighted-average liquidity of underlying assets. Illiquid baskets pay more because liquidation sell has more slippage
- **Self-funding liquidation**: Curator bot uses USDC → liquidate → sell ITP on Index.sol → recover USDC → loop
- **No issuer dependency**: Curator operates independently. BLS price data is collected on the curator's own cadence

---

## Existing Deployment Context

All contracts live on Index L3 (Orbit chain, ID 111222333).

| Contract | Address | Role |
|----------|---------|------|
| Morpho Blue | `0xAd3E631c01798f9aAE4692dabF791a62c226C5D4` | Core lending primitive |
| MetaMorpho Vault | `0x427EE58a6c574032085AEB90Dd05dEa6F054930` | USDC pool ("ilUSDC") |
| AdaptiveCurveIRM | `0x0Ac85d55ebFc7f7b0cF4c13bb3BD6Eaf3909d62d` | OLD IRM (being replaced) |
| Index.sol | `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853` | ITP creation, orders, fills |
| IssuerRegistry | `0x8A791620dd6260079BF849Dc5567aDC3F2FdC318` | BLS key management |
| L3_WUSDC | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` | USDC on L3 (6 decimals) |
| Existing market LLTV | 77% (`770000000000000000`) | Current test market |

Existing markets use AdaptiveCurveIRM. New markets use CuratorRateIRM.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CURATOR (Independent Market Maker)          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Quote API   │  │  Rate Engine │  │  Liquidation Bot         │  │
│  │              │  │  (SERM)      │  │                          │  │
│  │  Off-chain   │  │              │  │  USDC → liquidate        │  │
│  │  only. Zero  │  │  Computes    │  │  → seize ITP             │  │
│  │  on-chain    │  │  global rate │  │  → sell on Index.sol     │  │
│  │  actions.    │  │  per market. │  │  → recover USDC          │  │
│  │              │  │  Pushes to   │  │  → loop                  │  │
│  │  Returns:    │  │  CuratorRate │  │                          │  │
│  │  - quote     │  │  IRM on-chain│  │  Async state machine     │  │
│  │  - BLS data  │  │              │  │  (liquidate → sell →     │  │
│  │  - user txs  │  │  On-demand   │  │   wait fill → repeat)   │  │
│  └──────┬───────┘  │  (not timed) │  └──────────────────────────┘  │
│         │          └──────┬───────┘                                 │
│         │                 │                                         │
│  ┌──────▼─────────────────▼────────────────────────────────────┐   │
│  │  Oracle Collector (existing, runs on cadence)                │   │
│  │  Collects BLS-signed NAV from issuer network.               │   │
│  │  Curator always has fresh BLS data ready to serve.          │   │
│  │  NEW: on-demand fetch mode for quote API freshness.         │   │
│  └──────┬──────────────────────────────────────────────────────┘   │
│         │                                                           │
│  ┌──────▼──────────────────────────────────────────────────────┐   │
│  │  Health Monitor + Allocation Bot (existing, enhanced)        │   │
│  │  Crisis detection → feeds stress levels into SERM.           │   │
│  │  Allocation moves USDC across markets via vault.reallocate() │   │
│  │  NEW: SERM-aware allocation targets.                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
         │                              │
         │ User calls API               │ Curator pushes rates +
         │                              │ manages vault + liquidates
         ▼                              ▼
┌──────────────────┐         ┌──────────────────────────────────┐
│      USER        │         │          ON-CHAIN                │
│                  │         │                                  │
│  1. GET quote    │         │  ITPNAVOracle (BLS-verified)     │
│  2. Push price   │         │  CuratorRateIRM (curator-set)    │
│  3. Deposit ITP  │         │  Morpho Blue (immutable)         │
│  4. Borrow USDC  │         │  MetaMorpho Vault (USDC pool)    │
│                  │         │                                  │
│  All txs signed  │         │                                  │
│  by user.        │         │                                  │
└──────────────────┘         └──────────────────────────────────┘
```

---

## User Flows

### Flow 1: Borrow (Intent-Based)

The curator performs **zero on-chain actions** during the borrow flow. The user does everything.

#### Step 1: User Requests Quote

```
USER                             CURATOR API                        ON-CHAIN
  │                                   │                                │
  │  POST /api/lending/quote          │                                │
  │  { itp, collateral, borrow }      │                                │
  │──────────────────────────────────►│                                │
  │                                   │                                │
  │                        [Curator already has:                       │
  │                         - fresh BLS-signed NAV (from collector)    │
  │                         - market params (cached)                   │
  │                         - current utilization (periodic read)      │
  │                         - correlated stress (SERM engine)]         │
  │                                   │                                │
  │                        [If BLS data older than 2 min:              │
  │                         trigger on-demand fetch from collector]    │
  │                                   │                                │
  │                        [Compute off-chain:                         │
  │                         1. Look up market for this ITP             │
  │                         2. Read current oracle price               │
  │                         3. Get rate from SERM for this market      │
  │                         4. Compute HF, max borrow, liq price      │
  │                         5. Check crisis level for min HF           │
  │                         6. Build ABI-encoded calldata for user]    │
  │                                   │                                │
  │  { quote, blsData, txs }         │                                │
  │◄──────────────────────────────────│                                │
  │                                   │                                │
  │  [Review terms, sign bundle]      │                                │
  │                                   │                                │
  │  User submits atomic bundle via Morpho Bundler (multicall):        │
  │    TX1: oracle.updatePrice(blsData)                                │
  │    TX2: itp.approve(morpho)                                        │
  │    TX3: morpho.supplyCollateral()                                  │
  │    TX4: morpho.borrow()                                            │
  │  ──────────────────────────────────────────────────────────────────►
  │                                   │                                │
  │  Done. USDC in wallet.            │                                │
  │  All 4 ops atomic — reverts if any fails. No MEV sandwich risk.   │
```

#### Quote API Specification

**Authentication & Rate Limiting:**
- API key required (`X-API-Key` header) — issued per frontend/integration partner
- Rate limit: 10 requests/minute per API key, 2 requests/minute per IP without key
- On-demand BLS fetch (when data > 2 min stale) is rate-limited separately: max 1 trigger per ITP per 30 seconds to prevent issuer network DDoS

```
POST /api/lending/quote
Headers: X-API-Key: <key>

Request:
{
  "itpAddress": "0x...",
  "collateralAmount": "100000000000000000000",   // 100 ITP (18 dec)
  "borrowAmount": "5000000000"                    // 5000 USDC (6 dec)
}

Response:
{
  "quoteId": "q-abc123",
  "expiresAt": 1707000000,                        // 2-5 min TTL

  "terms": {
    "borrowRate": "4.8",                           // APR % — current CuratorRateIRM rate
    "healthFactor": "1.54",
    "liquidationPrice": "64.94",
    "maxBorrow": "7700000000"                      // max USDC at current NAV + LLTV
  },

  "market": {
    "marketId": "0x...",
    "lltv": "770000000000000000",
    "oracleAddress": "0x...",
    "currentOraclePrice": "1000000000000000000000000"
  },

  "oracleUpdate": {
    "price": "1000000000000000000000000",
    "timestamp": 1706999700,
    "cycleNumber": 42,
    "blsSignature": "0x...",
    "signersBitmask": 7,
    "alreadyFresh": false                          // hint: skip TX1 if true
  },

  "bundler": {
    "to": "0x...(morpho bundler)",
    "data": "0x...(multicall calldata)",
    "description": "Atomic bundle: push oracle → approve → supply collateral → borrow",
    "steps": [
      "Push BLS-signed NAV price",
      "Approve ITP as collateral",
      "Deposit ITP collateral",
      "Borrow USDC"
    ]
  }
}
```

#### Quote API Internal Flow

1. Look up market for ITP → error if not found
2. Get fresh BLS data (on-demand fetch if > 2 min stale)
3. Read on-chain state (oracle price, market state)
4. Run SERM for this market → compute rate → push to CuratorRateIRM if changed
5. Compute quote terms (HF, max borrow, liquidation price)
6. Check crisis level → enforce min HF (1.2 normal, 1.3 elevated, 1.5 stress, reject on emergency)
7. Build Morpho Bundler multicall calldata for user

#### Quote API Error Handling

| Error | HTTP | Response |
|---|---|---|
| Market not found for ITP | 404 | `{ "error": "MARKET_NOT_FOUND", "message": "No lending market exists for this ITP" }` |
| Insufficient collateral (HF below minimum) | 400 | `{ "error": "INSUFFICIENT_COLLATERAL", "requiredHf": "1.5", "actualHf": "1.2" }` |
| Market frozen (emergency crisis) | 503 | `{ "error": "MARKET_FROZEN", "message": "New borrows suspended during emergency" }` |
| BLS data unavailable (issuers down) | 503 | `{ "error": "ORACLE_UNAVAILABLE", "message": "Cannot get fresh price data" }` |
| Rate limited | 429 | `{ "error": "RATE_LIMITED", "retryAfter": 30 }` |
| Internal error | 500 | `{ "error": "INTERNAL_ERROR" }` |

**Frontend degradation:** If quote API is unreachable, frontend shows "Lending temporarily unavailable" with a retry button. No fallback direct-to-Morpho flow — all borrows go through the quote API to ensure rate is fresh.

#### Oracle No-Op Safety

The oracle contract must `return` (not `revert`) when `cycleNumber <= lastCycleNumber`. This way if another user already pushed the same price, the multicall doesn't break. One-line change in `ITPNAVOracle.sol`:

```solidity
// CHANGE at line 83: revert → return (silent no-op)
if (cycleNumber <= lastCycleNumber) {
    return;  // Price already current, skip. Was: revert ErrorsLib.E094_StaleCycleNumber(...)
}
```

This is safe: BLS verification hasn't run yet, so we're just skipping redundant work. No state change, no gas wasted on BLS verify.

### Flow 2: Repay & Withdraw

```
USER                                   MORPHO BLUE
  │                                         │
  │  1. IERC20(usdc).approve(morpho, amt)   │
  │────────────────────────────────────────►│
  │                                         │
  │  2. morpho.repay(                       │
  │       marketParams, usdcAmt,            │
  │       0, user, "")                      │
  │────────────────────────────────────────►│
  │                              [Debt reduced/cleared]
  │                                         │
  │  3. morpho.withdrawCollateral(          │
  │       marketParams, itpAmt,             │
  │       user, user)                       │
  │────────────────────────────────────────►│
  │                              [ITP returned to user]
```

No quote API needed for repay. User interacts directly with Morpho Blue. Rate they pay is whatever the CuratorRateIRM currently returns for that market.

### Flow 3: USDC Lender Deposits

```
LENDER                                 METAMORPHO VAULT
  │                                         │
  │  1. IERC20(usdc).approve(vault, amt)    │
  │────────────────────────────────────────►│
  │                                         │
  │  2. vault.deposit(amt, lender)          │
  │────────────────────────────────────────►│
  │                              [USDC deposited into vault]
  │                              [Vault shares (ilUSDC) minted to lender]
  │                              [Curator allocates across ITP markets]
```

**What changes for lenders:** Nothing at the deposit level. The MetaMorpho vault still works as standard ERC4626. The difference is that yields now come from curator-set rates (CuratorRateIRM) instead of organic utilization (AdaptiveCurveIRM). During stress, the SERM spikes rates → lenders earn more → attracted to deposit more USDC. This is the mechanism that attracts capital when the vault needs it most.

---

## Global Rate Pricing: CuratorRateIRM + SERM

### Rate Model: SERM (Shared Exposure Rate Model)

The curator computes rates off-chain from four multiplied components plus a flat tier add-on. Only the final per-second rate gets pushed on-chain to `CuratorRateIRM`.

```
rate = kink(global_util) × (1 + stress × 0.5) × (1 + concentration) × liquidity_mult + tier_premium
```

| Component | What it captures | Range | Input source |
|---|---|---|---|
| **Base rate** `kink(global_util)` | Total USDC demand across all markets. Same for everyone. Kink at 80% makes rates spike when vault gets low. | 2% → 100% | Morpho vault state |
| **Stress** `(1 + stress × 0.5)` | Per-asset price drops, computed independently per asset (no cross-asset correlation). When BTC drops 10% at 2% baseline vol → stress=5 → ×3.5. Stable assets stay at ×1.0. | ×1.0 → ×3.5 | Curator price feeds |
| **Concentration** `(1 + concentration)` | How much of the vault's total capital is exposed to this ITP's underlying assets through all markets combined. Penalizes crowded trades. | ×1.0 → ×2.0 | Morpho market states + ITP compositions |
| **Liquidity** `liquidity_mult` | Weighted-average liquidation difficulty of the basket's assets. Static scores configured by curator (BTC: 1.0, small-cap: 0.2). Illiquid baskets = more slippage on liquidation sell. | ×1.0 → ×2.0 | Curator config (static) |
| **Tier premium** | Flat risk class add-on. A: +50bps, B: +150bps, C: +300bps, D: +500bps. | +0.5% → +5.0% | Curator tier assignment |

The stress multiplier is the critical component — it makes rates react to per-asset crashes automatically, even when global utilization hasn't moved. Without it, a BTC crash with stable utilization would leave rates unchanged.

### CuratorRateIRM Contract

A simple IRM where the curator directly sets per-market borrow rates. Morpho Blue calls this IRM; it returns whatever rate the curator last pushed.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIrm} from "@morpho-blue/interfaces/IIrm.sol";
import {Id, MarketParams, Market} from "@morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";

/// @title CuratorRateIRM
/// @notice Curator-managed interest rate model for ITP lending.
/// @dev The curator pushes borrow rates per market based on the SERM algorithm.
///      Morpho Blue calls borrowRate() on every interaction — returns the curator-set rate.
///      If the curator hasn't updated in 48h, a punitive rate protects lenders.
contract CuratorRateIRM is IIrm {
    using MarketParamsLib for MarketParams;

    // ============ CONSTANTS ============

    /// @notice Punitive rate if curator goes offline (100% APR ≈ 3.17e10 per-second WAD)
    uint256 public constant PUNITIVE_RATE = 31709791983e0;

    /// @notice Max staleness before punitive rate kicks in
    uint256 public constant MAX_RATE_STALENESS = 48 hours;

    /// @notice Minimum rate curator can set (0.5% APR — prevents zero-rate exploit)
    uint256 public constant MIN_RATE = 158548960;  // 0.5% APR per-second WAD

    /// @notice Maximum rate curator can set (200% APR — prevents absurd rates)
    uint256 public constant MAX_RATE = 63419583967e0;  // 200% APR per-second WAD

    // ============ IMMUTABLES ============

    /// @notice Morpho Blue address (only Morpho can call borrowRate)
    address public immutable MORPHO;

    /// @notice Curator address (only curator can set rates)
    address public curator;

    // ============ STATE ============

    /// @notice Per-second borrow rate per market (WAD-scaled)
    mapping(Id => uint256) public rates;

    /// @notice Last rate update timestamp per market
    mapping(Id => uint256) public lastRateUpdate;

    // ============ EVENTS ============

    event RateSet(Id indexed id, uint256 ratePerSecond, uint256 aprBps);
    event RatesBatchSet(uint256 count);
    event CuratorChanged(address indexed oldCurator, address indexed newCurator);

    // ============ ERRORS ============

    error NotMorpho();
    error NotCurator();
    error ArrayLengthMismatch();
    error RateOutOfBounds();

    // ============ CONSTRUCTOR ============

    constructor(address _morpho, address _curator) {
        MORPHO = _morpho;
        curator = _curator;
    }

    // ============ MORPHO IRM INTERFACE ============

    /// @notice Returns the borrow rate per second for a market.
    /// @dev Called by Morpho Blue on every interaction (supply, borrow, repay, liquidate).
    ///      Returns curator-set rate, or punitive rate if stale.
    function borrowRate(
        MarketParams memory marketParams,
        Market memory /* market */
    ) external override returns (uint256) {
        if (msg.sender != MORPHO) revert NotMorpho();
        return _getRate(marketParams.id());
    }

    /// @notice View version of borrowRate.
    function borrowRateView(
        MarketParams memory marketParams,
        Market memory /* market */
    ) external view override returns (uint256) {
        return _getRate(marketParams.id());
    }

    function _getRate(Id id) internal view returns (uint256) {
        uint256 rate = rates[id];
        uint256 lastUpdate = lastRateUpdate[id];

        // No rate set or stale → punitive rate to protect lenders
        if (rate == 0 || block.timestamp - lastUpdate > MAX_RATE_STALENESS) {
            return PUNITIVE_RATE;
        }

        return rate;
    }

    // ============ CURATOR RATE MANAGEMENT ============

    /// @notice Set borrow rate for a single market.
    /// @param id The Morpho market ID
    /// @param ratePerSecond Per-second borrow rate (WAD-scaled)
    function setRate(Id id, uint256 ratePerSecond) external {
        if (msg.sender != curator) revert NotCurator();
        if (ratePerSecond < MIN_RATE || ratePerSecond > MAX_RATE) revert RateOutOfBounds();
        rates[id] = ratePerSecond;
        lastRateUpdate[id] = block.timestamp;
        emit RateSet(id, ratePerSecond, ratePerSecond * 31557600 * 10000 / 1e18);
    }

    /// @notice Batch set rates for multiple markets (gas efficient).
    /// @param ids Array of market IDs
    /// @param ratesPerSecond Array of per-second borrow rates
    function setRates(Id[] calldata ids, uint256[] calldata ratesPerSecond) external {
        if (msg.sender != curator) revert NotCurator();
        if (ids.length != ratesPerSecond.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < ids.length; i++) {
            if (ratesPerSecond[i] < MIN_RATE || ratesPerSecond[i] > MAX_RATE) revert RateOutOfBounds();
            rates[ids[i]] = ratesPerSecond[i];
            lastRateUpdate[ids[i]] = block.timestamp;
        }
        emit RatesBatchSet(ids.length);
    }

    /// @notice Transfer curator role.
    function setCurator(address newCurator) external {
        if (msg.sender != curator) revert NotCurator();
        emit CuratorChanged(curator, newCurator);
        curator = newCurator;
    }
}
```

**Rate conversion:** `rate_per_second = apr_percent * 1e18 / 100 / 31_536_000` (e.g., 5% APR ≈ 1,585,489,599 WAD per second)

### SERM: Shared Exposure Rate Model

#### The Algorithm

```
INPUTS:
  For each ITP market:
    - composition: { asset → weight_bps }          (from on-chain _itpAssets + _itpWeights)
    - total_borrowed: U256                           (from Morpho market state)
    - risk_tier: A | B | C | D                       (from curator tier config)

  For each underlying asset:
    - price: current price                           (from curator's price feeds)
    - price_24h_ago: price 24 hours ago
    - baseline_vol: normal daily volatility          (configured per asset)
    - liquidity_score: 0.0 to 1.0                    (configured per asset by curator)

  Global:
    - vault_total_assets: total USDC in MetaMorpho vault
    - total_borrowed_all_markets: Σ borrowed across ALL ITP markets


STEP 1: Compute global vault utilization (ONE number, drives all base rates)

  global_util = total_borrowed_all_markets / vault_total_assets

  // This is the only utilization that matters.
  // The curator controls per-market supply via reallocate(), so per-market
  // utilization is meaningless — it's whatever the curator decides.
  // Global util reflects actual USDC demand vs actual USDC available.


STEP 2: Base rate from global utilization (kink curve — see below)

  base_rate = kink_curve(global_util)

  // Same base rate for ALL markets. Every borrower draws from the same USDC pool.
  // Low global util = cheap rates (attract borrowers).
  // High global util = expensive rates (attract lenders, push borrowers to repay).


STEP 3: Compute per-asset stress (independent, no cross-asset correlation)

  For each underlying asset A:
    price_change = (price[A] - price_24h_ago[A]) / price_24h_ago[A]
    stress[A] = clamp(0, 5, -price_change / baseline_vol[A])

    // stress = 0 when price stable or up
    // stress = 1 when dropping at 1x normal volatility
    // stress = 5 (max) when dropping at 5x normal volatility
    //
    // NOTE: Stress is computed per-asset independently. No cross-asset correlation
    // modeling (e.g., altcoins dropping in sympathy with BTC). This is intentional —
    // the global vault utilization (Step 1) already captures systemic stress since
    // a broad crash raises utilization across all markets. Per-asset stress handles
    // the idiosyncratic component only.


STEP 4: Compute per-asset global exposure

  For each underlying asset A:
    global_exposure[A] = Σ (weight[itp][A] * borrowed[itp])  for all ITP markets
    concentration[A] = global_exposure[A] / vault_total_assets

    // How much of the vault's total capital is exposed to asset A
    // through all ITP markets combined


STEP 5: Compute per-ITP rate (base rate × per-market multipliers + premium)

  For each ITP market:

    // a) Correlated stress: weighted avg of underlying asset stress
    correlated_stress = Σ (weight[itp][A] * stress[A])  for all A in basket
    // Range: 0 (calm) to 5 (extreme)

    // b) Concentration factor: how exposed is the vault to this ITP's assets
    concentration_factor = Σ (weight[itp][A] * concentration[A])  for all A
    // Range: 0 (no exposure) to 1 (fully concentrated)

    // c) Liquidity factor: how liquid are this ITP's underlying assets
    avg_liquidity = Σ (weight[itp][A] * liquidity_score[A])  for all A
    liquidity_multiplier = 1 + (1 - avg_liquidity)
    // Range: 1.0 (all assets perfectly liquid) to 2.0 (all assets illiquid)
    //
    // Liquidity scores (configured by curator, updated periodically):
    //   BTC: 1.0, ETH: 1.0, SOL: 0.85, LINK: 0.7, ARB: 0.6
    //   Small-cap: 0.2-0.4, New token: 0.1
    //
    // Illiquid baskets cost more because:
    //   - Liquidation sell (via Index.sol AP) has more slippage
    //   - Harder to exit in a crash → more risk for the vault

    // d) Risk tier premium
    tier_premium = { A: 50bps, B: 150bps, C: 300bps, D: 500bps }

    // e) Final rate
    rate = base_rate                                 // from global util (same for all)
         * (1 + correlated_stress * 0.5)             // stress multiplier (1x to 3.5x)
         * (1 + concentration_factor)                // concentration multiplier (1x to 2x)
         * liquidity_multiplier                      // liquidity multiplier (1x to 2x)
         + tier_premium                              // flat risk tier add-on

  Push rate to CuratorRateIRM contract via setRates()
```

#### Kink Curve Definition

The base rate is a piecewise linear function of **global vault utilization** (total borrowed across ALL markets / vault total assets). NOT per-market utilization — the curator controls per-market supply, so per-market util is meaningless.

```
kink_curve(global_util):

  KINK = 0.80   (80% global utilization)

  If global_util <= KINK:
    // Slope 1: 2% at 0%, 5% at 80% — gentle, attracts borrowers
    rate = 2% + (global_util / KINK) * (5% - 2%)
    rate = 2% + global_util * 3.75%

  If global_util > KINK:
    // Slope 2: 5% at 80%, 100% at 100% — steep, pushes repayment + attracts lenders
    rate = 5% + ((global_util - KINK) / (1 - KINK)) * (100% - 5%)
    rate = 5% + (global_util - 0.80) * 475%

  Examples:
    0%   global_util → 2.0% APR    ← vault full of USDC, come borrow!
    25%  global_util → 2.9% APR
    50%  global_util → 3.9% APR
    75%  global_util → 4.8% APR
    80%  global_util → 5.0% APR    ← kink point
    85%  global_util → 28.75% APR  ← steep! vault getting low
    90%  global_util → 52.5% APR
    95%  global_util → 76.25% APR
    100% global_util → 100.0% APR  ← vault empty, max pressure

  Self-balancing incentives:
    Too many borrowers → global_util rises → rates spike → lenders deposit → util drops
    Too many lenders   → global_util drops → rates drop  → borrowers come → util rises
```

**Implementation note:** Production code MUST use fixed-point arithmetic (e.g., `ethnum::U256` with WAD scaling) instead of `f64`.

#### When Rates Are Pushed On-Chain

Rates are NOT pushed on a cadence. They are pushed **on-demand** when an action needs them:

| Trigger | What happens |
|---|---|
| **Quote API request** | SERM computes rate for that market. If rate changed since last push, push `setRate()` before returning quote. Rate is fresh when user executes borrow. |
| **Before liquidation** | Bot computes rate for the market being liquidated. Pushes `setRate()` so Morpho accrues interest correctly before liquidation call. |
| **Health monitor detects crisis** | Batch recompute all rates, push `setRates()` for any that changed. This is the only "proactive" push — triggered by crisis detection, not a timer. |

This avoids wasting gas on periodic pushes when nothing changed. The 48h `MAX_RATE_STALENESS` punitive rate is the safety net if no actions happen for a long time (which implies no borrowing activity anyway).

---

## Liquidation Bot

The curator runs its own liquidation bot. It uses a USDC reserve (separate from the MetaMorpho vault) to self-fund a liquidation loop.

### Health Factor Formula

```
HF = (collateral_amount * oracle_price / 1e36) * (lltv / 1e18) / debt_amount

Where:
  collateral_amount = user's ITP collateral in the market (18 decimals)
  oracle_price = ITPNAVOracle.price() (36 decimals, Morpho format)
  lltv = market LLTV (18 decimals, e.g., 770000000000000000 for 77%)
  debt_amount = user's borrow including accrued interest (USDC, 6 decimals)

Health status:
  HF >= 1.2   → Healthy
  1.05 - 1.2  → Warning
  1.0 - 1.05  → Critical
  HF < 1.0    → Liquidatable
```

### Liquidation Money Flow

```
                         CURATOR RESERVE (separate wallet)
                         ┌─────────────────────────────┐
                         │  USDC reserve (5% of vault)  │
                         │  e.g., 50,000 USDC           │
                         └──────────┬──────────────────┘
                                    │
                    ┌───────────────┼───────────────────────────────────┐
                    │               │ Budget: reserve / max_concurrent  │
                    │               │ e.g., 10,000 USDC per slot       │
                    │               ▼                                   │
                    │   ┌─────────────────────────┐                    │
                    │   │  SLOT 1 (borrower 0xA)  │  ... up to 5 slots│
                    │   └───────────┬─────────────┘                    │
                    │               │                                   │
                    └───────────────┼───────────────────────────────────┘
                                    │
          ┌─────────────────────────┼──────────────────────────────┐
          │                         │                               │
          │  STEP 0: Push oracle    │                               │
          │  (curator has BLS)      │                               │
          │                         ▼                               │
          │         ┌──────────────────────────────┐                │
          │         │        MORPHO BLUE            │                │
          │         │                               │                │
          │  ──────►│  STEP 1: liquidate()          │                │
          │  10,000 │                               │                │
          │  USDC   │  Bot repays 10,000 of         │                │
          │  ──────►│  borrower's debt              │                │
          │         │                               │                │
          │         │  Morpho seizes collateral     │                │
          │         │  at LLTV=77% → 7.41% bonus    │                │
          │         │                               │                │
          │         │  Bot receives:                │                │
          │         │  10,741 USDC worth of ITP     │◄── collateral
          │         └──────────────────────────────┘    released
          │                         │
          │                         │ Bot now holds ITP (not USDC!)
          │                         │ Must convert back to USDC
          │                         ▼
          │         ┌──────────────────────────────┐
          │         │        INDEX.SOL              │
          │         │                               │
          │         │  STEP 2: submitOrder(SELL)    │
          │         │  - ITP amount: 10,741 worth   │
          │         │  - limit: NAV × 0.97          │
          │         │  - slippage: Tier2 (1%)       │
          │         │  - deadline: 10 min           │
          │         │                               │
          │         │  Order escrowed on Index.sol   │
          │         └──────────┬───────────────────┘
          │                    │
          │                    │ Issuer cycle (seconds):
          │                    │ confirmBatch → AP trades
          │                    │ on external DEXes → confirmFills
          │                    ▼
          │         ┌──────────────────────────────┐
          │         │        AP (Market Maker)      │
          │         │                               │
          │         │  Sells ITP underlying assets  │
          │         │  on external markets           │
          │         │  Returns USDC to Index.sol    │
          │         └──────────┬───────────────────┘
          │                    │
          │                    │ STEP 3: Fill event
          │                    ▼
          │         ┌──────────────────────────────┐
          │         │  Bot receives USDC            │
          │         │                               │
          │         │  Sent:     10,000 USDC        │
          │         │  Seized:   10,741 USDC worth  │
          │         │  Slippage: ~1% ≈ -107         │
          │         │  Received: ~10,634 USDC       │
          │         │  ─────────────────────        │
          │         │  Net gain: +634 USDC (+6.3%)  │
          │         └──────────┬───────────────────┘
          │                    │
          │         STEP 4:    │ Position still HF < 1.0?
          │         ┌──────────┴──────────┐
          │         │                     │
          │         ▼ YES                 ▼ NO
          │    Loop back to           Return USDC
          │    STEP 1 with            to reserve
          │    10,634 USDC            (10,634 USDC)
          │    (growing balance)           │
          │                               │
          └───────────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────────────┐
                         │  CURATOR RESERVE             │
                         │  Was: 50,000 USDC            │
                         │  Now: 50,634 USDC (+1.3%)    │
                         │                              │
                         │  Self-replenishing:          │
                         │  each liquidation returns    │
                         │  principal + ~6% bonus       │
                         └─────────────────────────────┘
```

### Bad Debt Policy: Socialize, Don't Subsidize

The curator bot **only liquidates when profitable** (bonus > slippage). When liquidation becomes unprofitable (deep crash, illiquid ITP), the bot stops and lets Morpho Blue's built-in bad debt socialization handle the shortfall.

```
Bot decision on each iteration:

  estimated_recovery = seized_itp_value * (1 - expected_slippage)
  cost = usdc_to_repay

  IF estimated_recovery > cost:
    → Liquidate. Bot profits. Position improves.

  IF estimated_recovery <= cost:
    → STOP. Do not liquidate at a loss.
    → Bad debt socializes across lenders in that market.
    → Morpho Blue handles this natively: totalBorrowAssets -= bad_debt
    → All lenders in that specific market lose proportionally.
    → Other markets in the vault are NOT affected.
```

**Why not liquidate at a loss to protect lenders?**
- The curator reserve is finite — burning it on unprofitable liquidations depletes capital needed for future profitable liquidations
- MetaMorpho supply caps already limit max bad debt per market (Tier C: 10% vault, Tier D: 5%)
- SERM rates spike well before bad debt — most borrowers repay voluntarily
- Bad debt socialization is a known, accepted risk for DeFi lenders

**Defense layers that make bad debt rare:**

| Layer | When | Effect |
|---|---|---|
| SERM rate spike | Hours before liquidation | Borrowers repay voluntarily |
| Profitable liquidation | HF just below 1.0 | Bot + MEV bots race to liquidate |
| Permissionless liquidation | Anytime | Anyone can liquidate, not just curator |
| Bad debt socialization | Last resort | Lenders in that market absorb the loss |
| Supply caps per tier | Always | Caps max exposure per market |

### Liquidation State Machine

The bot is an async state machine per borrower: `Ready → PendingSell → Recovered → (loop or done)`. Profitability check at each iteration — stops if bonus <= expected slippage. Up to 5 concurrent liquidations, USDC budget partitioned per slot.

### Sell Order Safety

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `limitPrice` | NAV * 0.97 | 3% below NAV — accept slippage, prioritize speed |
| `slippageTier` | Tier2 (1%) | Normal slippage tolerance |
| `deadline` | now + 10 min | Tight — if sell doesn't fill fast, refund and retry |

If the order expires without filling (e.g., issuers are slow), the bot calls `refundExpiredOrder()` to recover the escrowed ITP, then retries with a wider limit price (5% below NAV, Tier3 slippage).

### USDC Reserve Management

The curator maintains a separate USDC reserve (NOT in the MetaMorpho vault) for liquidations:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Minimum reserve | 5% of total vault assets | Enough to seed liquidation loops |
| Max concurrent liquidations | 5 | Limits capital spread |
| Per-liquidation budget | reserve / max_concurrent | Even distribution |
| After liquidation | Recovered USDC returns to reserve | Self-replenishing |
| Excess reserve | Curator may deposit into vault | Earn yield on idle capital |

**USDC recovery back to market after liquidation:**

After the liquidation loop completes for a borrower:
1. Recovered USDC (original + incentive) returns to the curator's reserve
2. If the market is still stressed (high utilization due to other positions):
   - Curator can supply excess reserve USDC into the vault via `vault.deposit()`
   - Allocator bot then moves it to stressed markets via `vault.reallocate()`
   - This increases supply → normalizes utilization → brings rates down
3. If the market has calmed:
   - Reserve retains the USDC for future liquidations
   - Excess above minimum reserve can be deposited for yield

---

## Risk Management

### Crisis Levels

The health monitor assigns a crisis level per market based on aggregate signals:

```
LEVEL 0: NORMAL              LEVEL 1: ELEVATED           LEVEL 2: STRESS
──────────────               ─────────────────           ───────────────
Trigger:                     Trigger:                    Trigger:
  All positions HF > 1.3      Avg HF < 1.3 in any        Avg HF < 1.15, OR
  No asset stress              market, OR                  any asset stress > 3
                               any asset stress > 1

Actions:                     Actions:                    Actions:
  Rates via on-demand SERM     Alert ops (Telegram)        Rates spike (SERM)
  Min HF for new borrows:     Rates rise (SERM)           Quote API: require
    1.2                        Min HF: 1.3                   HF > 1.5 for new
                               Oracle refresh 2x cadence     borrows


LEVEL 3: EMERGENCY
──────────────────
Trigger:
  Any position liquidatable, OR
  any asset stress > 4 (flash crash), OR
  NAV drop > 15% in 24h for any ITP

Actions:
  Batch SERM recompute + push all rates
  Liquidation bot active
  Quote API: reject new borrows on affected markets
  Curator may reduce supply caps (prevent new lending)
  Oracle refresh immediate (every block if needed)
```

### Failure Modes & Circuit Breakers

The crash timeline (T=0→T=5) describes the happy path. Below are the failure modes when self-balancing breaks down. Key insight: **the curator bot is the first liquidator, not the only one.** Morpho Blue's permissionless liquidation and bad debt socialization are backstops that already exist.

| Failure Mode | Trigger | Response |
|---|---|---|
| **USDC bank run** | Lenders panic-withdraw during crash → global util > 95% | Vault withdrawal queue (MetaMorpho native). Rates hit 75-100% APR via kink curve. Curator can reduce supply caps to zero on stressed markets → no new lending, forces repayment only. |
| **Liquidation reserve depleted** | All 5 slots active, reserve at zero, more positions underwater | Fall back to **permissionless liquidation** — anyone (MEV bots) can push oracle + liquidate. Curator is not the only liquidator. Expose unhealthy positions via API so external liquidators see opportunities. |
| **Sell orders not filling** | APs overwhelmed, order book empty for illiquid ITPs | After 2 failed retries with widening slippage (3% → 5%), bot holds seized ITP rather than selling at massive loss. Marks position as "pending manual resolution." Alerts ops via Telegram. |
| **Oracle goes stale** | Issuer network down → no BLS consensus → oracle price frozen | Oracle's built-in 24h `MAX_STALENESS` blocks new borrows automatically. Existing positions freeze (can't accrue on stale price). Curator pauses rate pushing. System enters safe-halt. |
| **Cascading liquidation spiral** | Liquidation sell pressure pushes NAV down → more positions underwater → more liquidations | Rate-limit liquidation volume: max 20% of a market's total collateral liquidated per hour. Accept that some bad debt may accrue — Morpho socializes bad debt across lenders in that market (built-in mechanism). |

### Natural Defense Mechanisms (Already Working)

These are inherited from the existing Morpho setup and should NOT be broken:

| Mechanism | How it works |
|-----------|-------------|
| **Permissionless liquidation** | Anyone can push oracle + liquidate. No single point of failure. MEV bots compete with curator bot. |
| **Oracle staleness protection** | If BLS consensus can't be reached, `price()` reverts after 24h → blocks new borrows, prevents stale liquidations. |
| **BLS verification** | Curator cannot fake prices. Needs 2/3 issuer signatures (BN254 on-chain verification). |
| **MetaMorpho timelock** | 24h delay on new supply caps prevents instant malicious changes. Guardian can revoke pending actions. |
| **Morpho Blue immutability** | Core lending primitive is immutable. Curator cannot drain user collateral. |
| **Partial liquidation** | Morpho supports seizing any amount of collateral — no need to liquidate entire positions. Reduces market impact. |

---

## Contracts

### New: CuratorRateIRM

See full contract code in the **CuratorRateIRM Contract** section above.

**Deployment:**
1. Deploy `CuratorRateIRM(morpho, curatorAddress)`
2. Morpho owner calls `morpho.enableIrm(curatorRateIRM)` — whitelist the new IRM
3. Create new markets using `CuratorRateIRM` instead of `AdaptiveCurveIRM`

### Existing (No Changes)

| Contract | Role |
|----------|------|
| Morpho Blue | Core lending primitive. Immutable. |
| MetaMorpho Vault | USDC pool for lenders. Curator allocates. |
| ITPNAVOracle | BLS-verified NAV per ITP. User pushes price. |
| MirrorIssuerRegistry | Issuer set on L3. Oracle reads pubkey from here. |
| Index.sol | ITP management, order submission, fills. Used by liquidation bot sell flow. |

### Market Pre-Warming Strategy

Pre-create markets for all known ITPs to avoid the 24h MetaMorpho timelock on first borrow:

1. Deploy `ITPNAVOracle` per ITP (instant, uses `initialPrice` from constructor)
2. Call `morpho.createMarket({USDC, ITP, oracle, curatorRateIRM, lltv})` — instant, permissionless
3. Call `vault.submitCap(marketParams, supplyCap)` — starts 24h timelock
4. Wait 24h → `vault.acceptCap(marketParams)` → add to supply queue
5. Curator rate engine starts pushing rates for this market
6. Allocator bot can now direct USDC to this market

**Batch script**: Automate steps 1-3 for top 20-50 ITPs. Steps 4-6 happen after timelock.

---

## Curator Service Changes

### New Modules

| Module | Description |
|--------|-------------|
| `quote.rs` | `POST /api/lending/quote` — off-chain computation, packages BLS data + user txs. See full implementation above. |
| `serm.rs` | Shared Exposure Rate Model — computes per-market rate from asset correlations + stress. See full Rust implementation above. |
| `rate_pusher.rs` | Pushes rates on-demand: called by quote API (before returning quote), liquidation bot (before liquidating), and health monitor (on crisis detection). No timer/cadence. |
| `liquidator.rs` | Async state machine: liquidate → sell on Index.sol → wait fill → loop. Parallel liquidation manager. See full implementation above. |

### Modified Modules

| Module | Change |
|--------|--------|
| `collector.rs` | Add **on-demand BLS fetch** mode. When quote API needs data fresher than 2 min, collector triggers an immediate poll of issuers and returns the result. Existing cadence-based collection continues in parallel. |
| `health_monitor.rs` | Add **crisis level detection** per market. Inputs: position health factors, asset stress from SERM, oracle freshness, vault utilization. Output: `CrisisLevel` enum (Normal, Elevated, Stress, Emergency) per market. Feeds into SERM and quote API. |
| `allocator.rs` | **SERM-aware allocation targets**: instead of targeting raw 70-85% utilization per market, allocator reads the SERM's computed rates and adjusts allocation to ensure enough USDC is available in stressed markets for liquidations. If SERM has spiked rates for a market, allocator ensures that market has extra USDC headroom (not just utilization-based). Also manages excess liquidation reserve USDC back into vault. |

---

## Frontend Changes

### Updated Components

| Component | Change |
|-----------|--------|
| `LendItpModal.tsx` | **Major**: Instead of direct Morpho contract calls, call curator quote API first → display terms (rate, HF, liq price) → user reviews → user signs the returned tx bundle. The modal becomes a quote-driven flow. |
| `PositionCard.tsx` | Add **crisis indicator** badge (yellow for elevated, red for stress/emergency) when market is in a non-normal crisis level. Show current SERM-computed rate (may differ from on-chain accrued rate). |
| `BorrowUsdc.tsx` | Replace direct `morpho.borrow()` calldata building with quote API response calldata. User signs txs from the quote. |
| `MarketsTable.tsx` | Show CuratorRateIRM rate (from quote API or on-chain read) instead of AdaptiveCurveIRM estimated rate. Highlight markets in crisis. |
| Rate display | Show "current rate" from CuratorRateIRM. This is a variable rate — it changes as the SERM runs. Quote shows rate at time of quote. |

---

## Implementation Plan

### Phase 1: CuratorRateIRM + SERM

1. Write and test `CuratorRateIRM.sol` (see contract spec above)
2. Write deploy script. Enable CuratorRateIRM on Morpho Blue (`morpho.enableIrm()`)
3. Create test market with CuratorRateIRM
4. Implement `serm.rs` — SERM algorithm (see Rust implementation above)
5. Implement `rate_pusher.rs` — pushes rates on-demand (called by quote API, liquidation bot, health monitor)
6. Test: rate changes propagate to Morpho borrow rate
7. Test: punitive rate kicks in after 48h staleness

### Phase 2: Quote API

1. Implement `quote.rs` — off-chain quote computation (see implementation above)
2. Add on-demand BLS fetch to `collector.rs`
3. Build pre-built transaction calldata generation (ABI encoding)
4. ITPNAVOracle no-op change (return instead of revert on stale cycle)
5. Test: user calls API → gets quote → executes txs → borrows USDC
6. Test: quote API rejects during emergency crisis level

### Phase 3: Liquidation Bot

1. Implement `liquidator.rs` — async state machine (see implementation above)
2. Implement `LiquidationManager` — parallel liquidation across multiple borrowers
3. Integrate with Index.sol sell flow (submitOrder → wait fill → refund on expiry)
4. Handle edge cases: expired orders (retry with wider limit), partial fills, oracle refresh before liquidation
5. Test: position goes underwater → bot liquidates → sells ITP → recovers USDC → loops
6. Test: multiple simultaneous liquidations with partitioned USDC reserves
7. Test: sell order expiry → refund → retry with wider slippage

### Phase 4: Frontend Integration

1. Update `LendItpModal` — call quote API, display terms, user signs returned txs
2. Oracle price push included in user's tx bundle (TX1)
3. Rate display shows curator-set rate from CuratorRateIRM
4. Crisis indicators on market/position cards

### Phase 5: Crisis Management

1. Add crisis level detection to `health_monitor.rs`
2. Wire crisis levels into SERM (affects stress multipliers + quote API restrictions)
3. Quote API restrictions during stress/emergency
4. SERM-aware allocation in `allocator.rs`
5. Alerting (Telegram/PagerDuty)
6. Test: simulated crash scenario (T=0 through T=5 walkthrough)

---

## Risk Tiers (Unchanged)

| Tier | LLTV | Max % of Vault | Rate Premium | Oracle Cadence | Description |
|------|------|----------------|-------------|----------------|-------------|
| A | 77-82% | 30% | +50 bps | 4h | Blue-chip, diversified, liquid |
| B | 70-77% | 20% | +150 bps | 6h | Moderate diversification or newer |
| C | 60-70% | 10% | +300 bps | 12h | Concentrated, volatile, limited liquidity |
| D | 50-60% | 5% | +500 bps | 24h | Watch list, new/unknown |

New unknown ITPs default to **Tier D** (most conservative).

---

## Curator Key Management

The curator EOA signs rate pushes (`setRate`/`setRates`) and vault reallocation. This is a hot key — it must be available to the curator service at all times.

| Aspect | Approach |
|---|---|
| **Key type** | EOA (externally owned account). No multisig — rate pushes need to happen in milliseconds during crisis. |
| **Storage** | Encrypted keystore file on the curator server. Decrypted at service start via environment variable passphrase. Never in plaintext on disk. |
| **Rotation** | `CuratorRateIRM.setCurator(newAddress)` + `vault.setCurator(newAddress)`. Deploy new key first, transfer roles, then decommission old key. |
| **Compromise response** | Guardian (multisig) can call `vault.revokePendingCap()` to block malicious cap changes. CuratorRateIRM rates are bounded by MIN_RATE/MAX_RATE, limiting damage. Worst case: attacker sets MAX_RATE (200% APR) — punitive but not catastrophic. Deploy new CuratorRateIRM with new curator address and migrate markets. |
| **Guardian** | Separate multisig (2-of-3). Can revoke pending vault actions. Does NOT have curator hot-key access. |

---

## Monitoring & Observability

| Metric | Source | Alert Threshold |
|---|---|---|
| Rate staleness per market | `CuratorRateIRM.lastRateUpdate[id]` | > 1 hour (warning), > 24 hours (critical — 24h before punitive) |
| Global vault utilization | `vault.totalAssets()` vs total borrowed | > 80% (kink crossed), > 90% (critical) |
| Liquidation reserve balance | Curator reserve wallet | < 3% of vault total (warning), < 1% (critical) |
| Quote API latency | Application metrics | p99 > 2s (warning), > 5s (critical) |
| Quote API error rate | Application metrics | > 5% (warning), > 20% (critical) |
| BLS data freshness | `collector.rs` last successful fetch | > 5 min (warning), > 15 min (critical) |
| Crisis level changes | `health_monitor.rs` | Any transition to Level 2+ triggers Telegram alert |
| Bad debt events | Morpho Blue `BadDebtRealized` event | Any occurrence — investigate immediately |
| Positions near liquidation | Health monitor scan | Any HF < 1.05 → alert with position details |

**Alerting:** Telegram bot for Level 1+. PagerDuty for Level 2+ (wakes someone up). Dashboard (Grafana or equivalent) for all metrics.

---

## Allocator Strategy

The allocator bot manages USDC distribution across ITP markets via `vault.reallocate()`. Goal: ensure each market has enough USDC for borrows and liquidations without over-allocating idle capital.

```
For each ITP market:

  target_supply = max(
    borrowed[market] * 1.25,          // 25% headroom above current borrows
    min_liquidity_floor                // minimum USDC per active market (e.g., 1000 USDC)
  )

  // During stress, add extra headroom for liquidation needs
  IF crisis_level[market] >= ELEVATED:
    target_supply *= 1.5              // 50% extra buffer for liquidation flow

  // Cap at the market's MetaMorpho supply cap
  target_supply = min(target_supply, supply_cap[market])

Rebalance:
  Compute target_supply for all markets.
  Markets over target → withdraw excess.
  Markets under target → supply from excess + idle vault USDC.
  If total targets > vault total → prioritize by crisis level (Emergency > Stress > Elevated > Normal).
```

**Reallocation frequency:** On-demand, triggered by:
- Quote API request (if target market is undersupplied)
- Crisis level change
- After liquidation completes (recovered USDC available)
- Periodic check every 10 minutes as backstop

---

## Supply Caps Per Tier

MetaMorpho supply caps limit maximum USDC exposure per market. Caps are expressed as a percentage of total vault assets.

| Tier | Max % of Vault | Example (1M USDC vault) | Rationale |
|---|---|---|---|
| A | 30% | 300,000 USDC | Blue-chip, diversified — low risk of bad debt |
| B | 20% | 200,000 USDC | Moderate risk — cap limits concentration |
| C | 10% | 100,000 USDC | Higher risk — smaller cap contains losses |
| D | 5% | 50,000 USDC | Watch list — minimal exposure, prove it first |

**Cap lifecycle:**
1. New market starts at Tier D cap (5%)
2. Curator submits `vault.submitCap(marketParams, capAmount)` → 24h timelock
3. After timelock: `vault.acceptCap()` → market can receive USDC
4. Tier promotion (D→C→B→A) happens manually after curator reviews market health history
5. Caps are recalculated when vault total assets changes significantly (>20% change)

**Scaling:** Caps are set as absolute USDC amounts, not dynamic percentages. When the vault grows, curator must resubmit caps to reflect the new total. This is intentional — it forces human review before increasing exposure.

---

## Accrued Interest

Morpho Blue handles interest accrual natively. On every interaction (`supply`, `borrow`, `repay`, `liquidate`, `withdrawCollateral`), Morpho calls `_accrueInterest()` internally, which:
1. Reads the current `borrowRate()` from CuratorRateIRM
2. Compounds interest since `lastUpdate` timestamp
3. Updates `totalBorrowAssets` and `totalSupplyAssets`

No custom implementation needed. The curator only sets the rate — Morpho handles compounding, per-position debt tracking, and lender yield distribution.

---

## Constraints

| Constraint | Detail |
|-----------|--------|
| **MetaMorpho 24h timelock** | New supply caps take 24h. Pre-warm markets for known ITPs. |
| **Market immutability** | Market tuple (loan, collateral, oracle, irm, lltv) is fixed at creation. To change IRM, create new market. |
| **Oracle staleness** | 24h MAX_STALENESS on ITPNAVOracle. Users push price themselves in borrow flow; curator pushes during liquidation. |
| **CuratorRateIRM staleness** | 48h MAX_RATE_STALENESS. If curator goes offline, punitive 100% APR protects lenders. |
| **IRM enablement** | Morpho owner must call `enableIrm()` for CuratorRateIRM. We control Morpho on L3. |
| **Sell latency** | Liquidation sell via Index.sol takes issuer cycles (confirmBatch → AP trade → confirmFills). Bot must handle async fills with timeout/retry. |
| **USDC reserve** | Liquidation bot needs separate USDC reserve (not in vault). Minimum 5% of vault total. Self-replenishing via liquidation incentives. |
| **Parallel liquidations** | Max 5 concurrent. USDC reserve partitioned per liquidation. |

---

*Document generated by Winston (Architect Agent)*
