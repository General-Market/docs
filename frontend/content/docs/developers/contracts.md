---
title: Contract reference
navTitle: Contracts
description: The full on-chain surface — Vision, BotRegistry, VisionVault, the Index core, and every error selector.
order: 14
group: Contracts
mode: reference
---

```gmplain
This page lists every function, struct, event, and error of the contracts behind General Market — the prediction market, the bot registry, the managed vaults, and the fund engine. When a transaction fails, the chain gives you four bytes; the tables at the bottom turn those four bytes back into a name and a reason.
```

```gmsummary
Vision.sol :: Round-based prediction market — join, update, settle, refund
BotRegistry.sol :: Standalone registry, source-only; the live one is inside Vision
VisionVault.sol :: ERC-7540 managed vault clones with a FIFO redeem queue
Investment.sol (Index core) :: Permissionless DTF creation, escrowed orders, BLS fills
Error selectors :: Every revert, four bytes to name, in one place
```

```gmnote
Addresses are not on this page on purpose. Chain id, RPC URL, and every deployed contract address live only at the [Network reference](/docs/get-started/network) (~2 min).
```

**Testnet only.** Everything below runs on a testnet.
**L3 USDC has 18 decimals.** 0.1 USDC = 1e17. Every amount on this page is a raw 18-decimal unit.

## Vision.sol

The round-based prediction market. Each batch (a *block* in the app) is one round: USDC goes in through `joinBatchDirect`, comes out through settlement or refund. No persistent balances, no escrow account in between.

### Constants

| Constant | Value | Meaning |
|---|---|---|
| `PROTOCOL_FEE_BPS` | `5` | 0.05% fee, charged on profit only |
| `MIN_DEPOSIT` | `1e17` | 0.1 USDC minimum deposit |
| `BPS_DENOMINATOR` | `10000` | basis-points denominator |
| `MIN_TICK_DURATION` / `MAX_TICK_DURATION` | `60` / `604800` | tick length bounds: 1 minute to 1 week |
| `MIN_SETTLEMENT_GRACE` / `MAX_SETTLEMENT_GRACE` | `60` / `86400` | grace-window bounds: 1 minute to 24 hours |

### Player functions

```solidity
function joinBatchDirect(
    uint256 batchId,
    bytes32 configHash,
    uint256 depositAmount,
    bytes32 bitmapHash
) external
```

Selector `0xa092fd46`. Four parameters — there is no stake parameter; the deposit *is* the stake. Transfers `depositAmount` USDC from your wallet to the contract (approve first). Reverts: `BatchNotFound` (bad id or configHash mismatch), `BatchPaused`, `TickLocked` (inside the lock window), `AlreadyJoined`, `DepositBelowMinimum`.

```solidity
function updateBitmap(uint256 batchId, bytes32 configHash, bytes32 newBitmapHash) external
```

Replaces your bitmap hash before the lock window. Reverts: `NotJoined`, `TickLocked`, `BatchNotFound` (configHash mismatch).

```solidity
function claimRefund(uint256 batchId) external
function claimRefundFor(uint256 batchId, address player) external
```

If the oracle never settled the batch, the full deposit comes back — no fee. Refunds open at `(createdAtTick + 1) × tickDuration + settlementGrace` (exposed as `batchExpirationTime(batchId)`). `claimRefundFor` is permissionless: anyone may pay the gas, the USDC always goes to `player`. Reverts: `BatchNotFound`, `BatchAlreadySettled`, `NotYetRefundable`, `NotJoined`.

Views: `getBatch(batchId)`, `getPosition(batchId, player)`, `getBatchIdBySourceId(sourceId)`, `latestBatchForSource(sourceId)`, `currentTickId(batchId)`, `batchExpirationTime(batchId)`, `nextBatchId()`, `accumulatedRealFees()`.

### Bot registry surface (embedded in Vision)

| Function | Behaviour |
|---|---|
| `registerBot(string endpoint, bytes32 pubkeyHash)` | Free registration; stores endpoint + pubkey hash for off-chain discovery. Reverts `BotAlreadyRegistered`. |
| `deregisterBot()` | Removes the caller (swap-and-pop). Reverts `BotNotRegistered`. |
| `getAllActiveBots()` | Returns `(address[], Bot[])` — every registered bot. |

No on-chain enforcement of bot signatures — the registry exists so bots can find each other.

### Oracle functions (BLS-gated)

Every function below verifies one aggregated BLS signature over a message of the form `keccak256(abi.encode(block.chainid, address(this), TAG, …params))`:

| Function | Message tag | What it does |
|---|---|---|
| `createBatch(sourceId, configHash, tickDuration, lockOffset, settlementGrace, sig, nonce, bitmask)` | `"CREATE_BATCH"` | Mints the next batch id, stores the config hash and timing. Returns `batchId`. |
| `settleBatch(batchId, players[], payouts[], sig, nonce, bitmask)` | `"SETTLE_BATCH"` + `keccak256(abi.encode(players, payouts))` | Settles one batch: verifies zero-sum, transfers net payouts directly to wallets, deletes positions, marks `settled`. |
| `settleBatchesSingle(batchIds[], players[][], payouts[][], sig, nonce, bitmask)` | `"SETTLE_BATCHES_SINGLE_V1"` + per-batch payout hashes | Settles many batches under ONE aggregate signature — saves ~100k gas per batch versus `settleBatches`. |
| `settleBatches(batchIds[], players[][], payouts[][], sigs[], nonces[], bitmasks[])` | `"SETTLE_BATCH"` per batch | Bundles N independent settlements, each with its own signature. |
| `pause(batchId, sig, nonce, bitmask)` / `unpause(…)` | `"PAUSE"` / `"UNPAUSE"` | Pause blocks new joins; it does not refund existing players. |
| `updateFeeCollector(newCollector, sig, nonce, bitmask)` | `"UPDATE_FEE_COLLECTOR"` | Rotates the fee collector. |

`collectFees()` is not BLS-gated — it is callable only by the current `feeCollector` and sweeps `accumulatedRealFees`.

Settlement math, per player: `profit = max(payout − totalDeposited, 0)`; `fee = profit × 5 / 10000`; `netPayout = payout − fee`. The contract requires `players[]` strictly ascending by address, every listed player joined, and `Σ payouts == Σ deposits` — otherwise `NonZeroSum`. Settlement past the grace window reverts `SettlementWindowClosed`; the refund path has taken over.

### Structs

```solidity
struct Batch {
    address creator;          // sender of the createBatch tx
    bytes32 sourceId;         // keccak256 of the versioned source name
    bytes32 configHash;       // keccak256 of the ABI-encoded market config
    uint256 tickDuration;     // seconds per tick
    uint256 lockOffset;       // lock window, seconds before tick end
    uint256 settlementGrace;  // seconds after tick end before refund opens
    uint256 createdAtTick;    // block.timestamp / tickDuration at creation
    bool paused;
    bool settled;
}

struct PlayerPosition {
    bytes32 bitmapHash;       // keccak256 of the player's bitmap
    bytes32 configHash;       // config the bitmap was built against
    uint256 joinTimestamp;
    uint256 totalDeposited;   // != 0 is the "joined" sentinel
}

struct Bot {
    string endpoint;
    bytes32 pubkeyHash;
    uint256 registeredAt;
    bool isActive;
}
```

### Events

| Event | Emitted when |
|---|---|
| `BatchCreated(batchId, sourceId, creator, configHash, tickDuration, lockOffset, settlementGrace)` | a new batch is created |
| `PlayerJoined(batchId, player, deposit, bitmapHash, configHash)` | a player joins (the `deposit` parameter name is kept for ABI compatibility; it is the full deposit, not a per-tick stake) |
| `BitmapUpdated(batchId, player, newBitmapHash, configHash)` | a player updates their bitmap hash |
| `PlayerSettled(batchId, player, payout, fee)` | a player's net payout transfers |
| `BatchSettled(batchId, playerCount)` | a batch finishes settling |
| `PlayerRefunded(batchId, player, amount)` | a refund is claimed after the grace window |
| `BatchPausedEvent(batchId)` / `BatchUnpaused(batchId)` | oracle pause / unpause |
| `BotRegistered(bot, endpoint)` / `BotDeregistered(bot)` | bot registry changes |
| `FeeCollectorUpdated(oldCollector, newCollector)` / `FeeCollected(amount)` | fee administration |

## BotRegistry.sol

**Source-only.** A standalone registry contract exists in the codebase, but it has no entry in the deployment manifest — the live registry surface is the one embedded in Vision (above). Documented here because its ABI differs where it matters:

- `registerBot(endpoint, pubkeyHash)` rejects empty endpoints (`EmptyEndpoint`) and zero pubkey hashes (`ZeroPubkeyHash`) — the embedded Vision registry does not.
- `deregisterBot()` is soft: it marks the bot inactive and keeps history (Vision's removes the entry).
- `updateEndpoint(newEndpoint)` exists here only.
- `getAllActiveBots()` returns `(address[], string[])` — addresses and endpoints — not `(address[], Bot[])`.
- Extra views: `getBot(address)`, `isActive(address)`.

If you are integrating today, call the registry functions on the Vision contract.

## VisionVault.sol

An ERC-7540 asynchronous managed vault for Vision trading, deployed as an EIP-1167 minimal-proxy clone — `initialize(name, symbol, manager, vision, usdc, performanceFeeRate)` replaces the constructor, and the factory's `createVault(…)` clones and initializes in one call (emitting `VaultCreated`). The vault share token is a manually implemented ERC-20 with 18 decimals.

| Constant | Value | Meaning |
|---|---|---|
| `MAX_FEE` | `5000` | performance fee capped at 50% |
| `MAX_BATCH_BPS` | `500` | a single block join may use at most 5% of `totalAssets` |

### Asynchronous deposit and redeem (ERC-7540)

| Function | Behaviour |
|---|---|
| `requestDeposit(assets, controller, owner)` | Pulls USDC into the vault; recorded as a pending request. |
| `pendingDepositRequest(_, controller)` | Pending deposit amount for a controller. |
| `claimDeposit(receiver, controller)` | Mints shares at current NAV (the pending amount is excluded from NAV so it is not counted twice). |
| `requestRedeem(shares, controller, owner)` | Locks the shares. If idle USDC covers the value, fulfilled immediately; otherwise queued FIFO. |
| `pendingRedeemRequest(_, controller)` | Shares still waiting in the queue. |
| `claimRedeem(receiver, controller)` | Pays out fulfilled redemptions in USDC. Reverts `NothingToClaim`. |

The synchronous ERC-4626 entry points — `deposit`, `mint`, `withdraw`, `redeem` — all revert `SyncDisabled`. The `preview*` functions return 0; `maxWithdraw`/`maxRedeem` return 0. Use the async path; the 4626 views (`asset`, `totalAssets`, `convertToShares`, `convertToAssets`) work normally. `totalAssets = idle USDC + capital deployed in live blocks`.

### Manager and reconciliation

| Function | Access | Behaviour |
|---|---|---|
| `joinBatch(batchId, configHash, depositAmount, bitmapHash)` | manager only | Joins a Vision block with pooled USDC. Reverts `InsufficientIdleCapital` or `ExceedsMaxBatchAllocation` (over 5% of assets). |
| `updateBitmap(batchId, configHash, newBitmapHash)` | manager only | Forwards to Vision. |
| `reconcile(batchId, settlementPayout)` | permissionless | Books PnL after settlement, mints performance-fee shares to the manager only above the high-water mark, then sweeps the redeem queue. |
| `refundStuckBatch(batchId)` | permissionless | Rescue path: pulls an unsettled deposit back via Vision's `claimRefundFor` after the grace window, books PnL = 0, sweeps the queue. |

Events: `BatchJoined`, `BitmapUpdated`, `Reconciled(batchId, pnl, feeSharesMinted, withdrawalsFulfilled)`, `DepositClaimed`, `WithdrawClaimed`, plus the ERC-7540 `DepositRequest`/`RedeemRequest` and ERC-20/4626 standards.

## Investment.sol (Index core)

The fund engine: DTF creation, escrowed limit orders, BLS-confirmed fills, pushed NAV. It is deployed behind a UUPS proxy listed as `Index` in the deployment manifest — the source contract is `Investment.sol`. A DTF in the app is an **ITP** (Index Token Product) at the contract level; `itpId` is a sequential `bytes32` counter starting at 1.

### Constants

| Constant | Value | Meaning |
|---|---|---|
| `MIN_ORDER_AMOUNT` | `1e15` | 0.001 USDC minimum order |
| `MAX_DEADLINE_DURATION` | `24 hours` | order deadlines must be within 24h |
| `MIN_WEIGHT` | `25e14` | 0.25% minimum weight per asset |
| `WEIGHT_SUM` | `1e18` | weights must sum to exactly 100% |
| `MIN_SHARES` | `1e12` | minimum shares a fill may mint (dust guard) |
| `MAX_ASSETS` | `1000` | maximum assets per ITP |
| `EXPIRY_GRACE_PERIOD` | `24 hours` | wait after deadline before permissionless claim |
| `BATCHED_TIMEOUT` | `300` | seconds a BATCHED order may wait before timeout refund |

### Create

```solidity
function createITP(
    string name,            // ≤ 32 bytes
    string symbol,          // packs to bytes32
    uint256[] weights,      // 18-dec, each ≥ 25e14, sum exactly 1e18
    address[] assets,       // 1–1000, no zeros, no duplicates
    uint256[] prices,       // 18-dec, for initial inventory
    uint256 bridgeNonce     // type(uint256).max for direct calls
) external returns (bytes32 itpId)
```

Permissionless — any EOA. No creation fee; the only side effect beyond storage is registering the creator as the ITP's deployer in the FeeRegistry. Initial NAV is set to 1e18 ($1); per-share inventory is `qty[i] = weights[i] × 1e18 / prices[i]`. Any `bridgeNonce` other than the sentinel is an idempotency key for bridge-originated creation — reusing one returns the existing `itpId` instead of creating twice.

### Trade

```solidity
function submitOrder(
    bytes32 itpId,
    Side side,              // 0 = BUY, 1 = SELL
    uint256 amount,         // BUY: USDC (18-dec); SELL: shares
    uint256 limitPrice,     // 18-dec USD per share; 0 = market order
    uint256 slippageTier,   // 0, 1, or 2
    uint256 deadline        // (now, now + 24h]
) external returns (uint256 orderId)
```

Escrow happens at submit: BUY transfers the USDC in, SELL locks the shares. The order sits `PENDING` until the oracle cycle picks it up. Slippage tiers map to ≤0.3% / ≤1% / ≤3% — stored on-chain, enforced off-chain in the oracle netting stage; the tier is not a contract guarantee. `submitOrderFor(beneficiary, …)` is the same call restricted to registered oracles (used by the bridge flow).

Limit prices *are* a contract guarantee: a BUY fill above `limitPrice`, or a SELL fill below it, reverts `E126`. Fill math: BUY mints `shares = fillAmount × 1e18 / fillPrice` (at least `MIN_SHARES`); SELL returns `usdc = fillAmount × fillPrice / 1e18`. Partial fills are real — the unfilled remainder is refunded immediately, and the order still ends `FILLED`. If a USDC transfer to the user fails, the funds park in `failedFillEscrow` and `claimFailedFill(orderId)` releases them to the order's owner.

### Cancel and recover

| Function | Access | Behaviour |
|---|---|---|
| `cancelOrder(orderId)` | order owner | `PENDING` only. Full refund, no oracle involvement. |
| `claimExpiredOrder(orderId)` | **anyone** | After `deadline + 24h`, refunds a stuck `PENDING`/`BATCHED` order to its owner. Nobody can strand your money. |
| `claimFailedFill(orderId)` | order owner | Releases escrow from a failed fill transfer. |

Order lifecycle states: `PENDING → BATCHED → FILLED`, with exits to `CANCELLED` (user) and `EXPIRED` (refund paths).

### Oracle functions (BLS-gated)

| Function | Message | What it does |
|---|---|---|
| `confirmBatch(cycleNumber, orderIds[], sig, nonce, bitmask)` | `keccak256(chainid, this, cycleNumber, orderIds)` | Marks orders `BATCHED`; one signature covers the cycle. Replay-guarded per cycle. |
| `confirmFills(cycleNumber, fills[], sig, nonce, bitmask)` | `keccak256(chainid, this, cycleNumber, fills)` | Executes fills: limit-price check, mint/return, partial-fill refund. Accepts `PENDING` orders too (late-batch tolerance). |
| `emitAssetTrades(cycleNumber, trades[], …)` | tag `"assetTrades"` | Event-only: emits netted per-asset trade instructions. |
| `setItpNav(itpId, nav, …)` | tag `"setItpNav"` | Pushes the off-chain-computed NAV (18-dec). `getNAV` returns this stored value — there is no on-chain NAV formula. |
| `rebalance(itpId, removeIndices[], addAssets[], newWeights[], prices[], quoteTokens[], …)` | tag `"rebalance"` | Executes asset removals/additions and weight changes. |
| `refundExpiredOrder(orderId, …)` | tag `"refund"` | Oracle refund after deadline. |
| `refundTimedOutBatchedOrder(orderId, …)` | tag `"refundBatched"` | Refund for `BATCHED` orders stuck longer than 300s. |
| `cancelStalePendingOrders(orderIds[], …)` | tag `"cancelStale"` | Sweeps zombie `PENDING` orders with refunds. |

`requestRebalance(itpId, removeIndices[], addAssets[], newWeights[], note)` is **permissionless and event-only** — it changes no state; oracles watch the event, verify, and execute the BLS `rebalance`. The UI frames it as a creator action, but no contract gate restricts it to the creator.

**Testnet only:** `seedMint(itpId, to, shares)` is an admin function that mints shares outside the order pipeline, used for testnet seeding.

Views: `getOrder(orderId)`, `getITP(itpId)`, `getNAV(itpId)`, `getITPState(itpId)` (creator, supply, NAV, assets, weights, inventory), `getUserShares(itpId, user)`, `getItpCount()`.

### Structs

```solidity
enum Side { BUY, SELL }
enum OrderStatus { PENDING, BATCHED, FILLED, CANCELLED, EXPIRED }

struct LimitOrder {
    uint256 id;
    address user;
    bytes32 pairId;
    Side side;
    uint256 amount;        // BUY: USDC; SELL: shares (18-dec)
    uint256 limitPrice;    // 18-dec; 0 = market
    uint256 slippageTier;  // 0 | 1 | 2
    uint256 deadline;
    bytes32 itpId;
    uint256 timestamp;
    OrderStatus status;
}

struct ITPCore {
    bytes32 name;          // packed
    bytes32 symbol;        // packed
    address creator;
    uint256 createdAt;
    uint256 feeRate;       // bps
    uint256 status;        // INACTIVE | ACTIVE | PAUSED | DELISTING
    uint256 totalSupply;
    uint256 totalValue;
    uint256 assetCount;
}

struct Fill {
    uint256 orderId;
    uint256 fillPrice;     // 18-dec
    uint256 fillAmount;    // 18-dec
    uint256 cycleNumber;
    bytes32 txHash;        // optional venue reference
}
```

### Events

| Event | Emitted when |
|---|---|
| `OrderSubmitted(orderId, user, itpId, pairId, side, amount, limitPrice, slippageTier, deadline)` | an order is created |
| `BatchConfirmed(cycleNumber, orderIds, blsSignature)` | a cycle is batched |
| `TradeRequest(cycleNumber, pairId, side, amount, limitPrice)` | per batched order, for the execution layer |
| `AssetTradeRequest(cycleNumber, asset, side, usdcAmount, price, quoteToken)` | netted per-asset instructions |
| `FillConfirmed(orderId, cycleNumber, fillPrice, fillAmount)` | a fill executes |
| `FillFailed(orderId, user, amount)` / `EscrowClaimed(orderId, user, amount)` | transfer fell back to escrow / escrow claimed |
| `OrderCancelled(orderId, user, amount, side)` | user cancel |
| `OrderRefunded(orderId, user, amount)` | oracle refund paths |
| `ExpiredOrderClaimed(orderId, user, caller, amount)` | permissionless expiry claim |
| `ITPCreated(itpId, creator, name, symbol, assets, weights)` | a DTF is created |
| `ItpNavUpdated(itpId, nav)` | NAV push |
| `RebalanceRequested(requester, itpId, removeIndices, addAssets, newWeights, note)` / `Rebalanced(…)` | rebalance request / execution |

## Error selectors

A revert carries the first 4 bytes of `keccak256` of the error's signature. Match the bytes below. For symptom → fix guidance while building a bot, read [Errors and fixes](/docs/bots/errors) (~3 min) — this page is the complete lookup.

### Vision

| Selector | Error | When |
|---|---|---|
| `0x9e15e1bc` | `BatchNotFound()` | batch id does not exist, or your configHash does not match the batch |
| `0xe4532790` | `BatchPaused()` | joins are blocked while paused |
| `0x82b42900` | `Unauthorized()` | caller is not the fee collector / zero address given |
| `0xc24b1b61` | `DepositBelowMinimum()` | deposit < 0.1 USDC (1e17) |
| `0x003b2682` | `AlreadyJoined()` | one position per batch per address |
| `0xc394a433` | `NotJoined()` | no position to update, settle, or refund |
| `0xc4835971` | `InvalidTickDuration()` | outside 60–604800 s |
| `0x1ebff285` | `InvalidLockOffset()` | lockOffset ≥ tickDuration |
| `0x8a5d8291` | `InvalidSettlementGrace()` | outside 60–86400 s |
| `0x7b3ed4b3` | `NonZeroSum()` | settlement payouts ≠ deposits |
| `0xab1d0e42` | `BotAlreadyRegistered()` | one registration per address |
| `0x73be802b` | `BotNotRegistered()` | deregistering an unknown bot |
| `0xa7d34f77` | `TickLocked()` | join/update inside the lock window |
| `0x9d89020a` | `InvalidArrayLength()` | empty, mismatched, or unsorted settlement arrays |
| `0x9f8e1a9c` | `BatchAlreadySettled()` | settle/refund on a settled batch |
| `0xb4e6a84c` | `SettlementWindowClosed()` | grace window passed — refunds now own the batch |
| `0x5048bd79` | `NotYetRefundable()` | refund before the grace window expires |

### BotRegistry (standalone, source-only)

| Selector | Error | When |
|---|---|---|
| `0x3a81d6fc` | `AlreadyRegistered()` | bot already active |
| `0xaba47339` | `NotRegistered()` | bot not active |
| `0x885062b4` | `EmptyEndpoint()` | endpoint string empty |
| `0x6d0cb168` | `ZeroPubkeyHash()` | pubkey hash is zero |

### VisionVault

| Selector | Error | When |
|---|---|---|
| `0xc0fc8a8a` | `NotManager()` | manager-only function |
| `0x0dc149f0` | `AlreadyInitialized()` | clone initialized twice |
| `0x870a3f17` | `InsufficientIdleCapital()` | join exceeds idle USDC |
| `0x4c03a47b` | `BatchAlreadyReconciled()` | reconcile/refund on a cleared batch |
| `0x969bf728` | `NothingToClaim()` | claimRedeem with no claimable assets |
| `0xcd4e6167` | `FeeTooHigh()` | performance fee > 50% |
| `0x8194a7e2` | `SyncDisabled()` | synchronous 4626 deposit/mint/withdraw/redeem |
| `0x7372410d` | `ExceedsMaxBatchAllocation()` | join > 5% of totalAssets |

### Index protocol (ErrorsLib)

Shared by Investment, the bridge custody contracts, the registries, and the NAV oracle. Codes are grep-friendly (`E0xx_`) but **match on the selector, not the code number** — two distinct errors share the code E052.

| Selector | Error | When |
|---|---|---|
| `0x84c638c9` | `E001_OrderBelowMin(uint256,uint256)` | order < 0.001 USDC (1e15) |
| `0xfc2f0b83` | `E002_InsufficientBalance(address,uint256,uint256)` | payer USDC balance too low for BUY |
| `0x5018252d` | `E003_ITPPaused(bytes32)` | this ITP is paused |
| `0x3432baf7` | `E004_SystemPaused()` | global emergency pause |
| `0x32b9e9b7` | `E006_ITPNotFound(bytes32)` | unknown itpId |
| `0xb22e6b46` | `E011_InvalidSlippageTier(uint256)` | tier not 0, 1, or 2 |
| `0x0cc2df45` | `E012_InvalidDeadline(uint256,uint256,uint256)` | deadline in the past or beyond 24h |
| `0x6d1495aa` | `E013_WeightBelowMinimum(uint256,uint256)` | weight < 0.25% at creation |
| `0x56bc4cff` | `E014_InvalidWeightSum(uint256,uint256)` | weights ≠ 1e18 |
| `0x4577cc76` | `E015_LengthMismatch(uint256,uint256)` | assets/weights/prices arrays differ |
| `0x66e9d184` | `E016_NoAssets()` | empty asset list |
| `0x29c16e50` | `E017_DuplicateAsset(address)` | duplicate asset at creation |
| `0x806491d3` | `E018_ZeroAssetAddress()` | zero address in assets |
| `0x3b3c6416` | `E019_CycleAlreadyProcessed(uint256)` | batch/asset-trade replay for a cycle |
| `0x620fca9c` | `E020_InvalidBLSSignature()` | aggregate signature failed |
| `0x7a5425d1` | `E021_OrderAlreadyBatched(uint256)` | order not PENDING at confirmBatch |
| `0x0cf46178` | `E022_OrderNotFound(uint256)` | unknown orderId |
| `0xa1f4d58b` | `E023_FillExceedsOrder(uint256,uint256,uint256)` | fillAmount > order amount |
| `0x6e6e29cb` | `E024_InvalidOrderStatus(uint256,uint256,uint256)` | wrong status for this operation |
| `0x61be0fb7` | `E025_NonceAlreadyUsed(uint256)` | custody nonce replay |
| `0x0c12a830` | `E026_TargetNotWhitelisted(address)` | custody execution target not whitelisted |
| `0x236724a8` | `E027_ExecutionFailed(address,bytes)` | custody call failed |
| `0xab36850c` | `E028_WhitelistAlreadyProposed(address)` | duplicate whitelist proposal |
| `0x66a5d146` | `E029_WhitelistNotProposed(address)` | activating an unproposed target |
| `0xfcfac2b3` | `E030_TimelockNotExpired(address,uint256,uint256)` | whitelist timelock active |
| `0x1835e193` | `E031_TargetAlreadyWhitelisted(address)` | already whitelisted |
| `0x5e46f0c9` | `E032_TargetNotCurrentlyWhitelisted(address)` | removing a non-whitelisted target |
| `0xed993e5f` | `E034_OrderNotYetExpired(uint256,uint256,uint256)` | refund before deadline |
| `0xe6aac9f3` | `E036_FillCycleMismatch(uint256,uint256)` | fill's cycle ≠ call's cycle |
| `0xda652d10` | `E037_ZeroSharesCalculated(uint256,uint256)` | zero fill price or shares < 1e12 |
| `0x9f0644a4` | `E038_ZeroImplementation()` | upgrade to zero address |
| `0x454fac5d` | `E039_UpgradeAlreadyPending()` | upgrade already queued |
| `0x9e0ee5e5` | `E040_NoPendingUpgrade()` | nothing queued |
| `0xbf4afda3` | `E041_ImplementationMismatch(address,address)` | queued ≠ executed implementation |
| `0x62218525` | `E042_UpgradeTimelockActive(uint256,uint256)` | upgrade timelock not expired |
| `0x1003b63b` | `E043_ZeroOracleRegistry()` | zero registry address |
| `0xf4f270ee` | `E045_LockAlreadyReleased(uint256)` | bridge lock already released |
| `0xaaea1113` | `E046_LockAlreadyReversed(uint256)` | bridge lock already reversed |
| `0xef7c27b7` | `E047_LockTimeoutNotReached(uint256,uint256,uint256)` | reversal before lock timeout |
| `0x907764b7` | `E048_InsufficientSignerCount(uint256,uint256)` | below the emergency 15/20 threshold |
| `0xd3504fd4` | `E049_LockNotFound(uint256)` | unknown bridge nonce |
| `0x3a257e4f` | `E050_ZeroUSDCAddress()` | zero USDC address |
| `0x14144ea0` | `E052_EmptyNameOrSymbol()` | empty ITP name/symbol |
| `0x7c3fabf9` | `E052_ZeroAmount()` | zero bridge amount (duplicate code, distinct selector) |
| `0xf62d28f8` | `E053_InvalidDestChainId(uint256)` | zero or same-chain destination |
| `0xe78257d0` | `E054_BridgeAlreadyCompleted(uint256,uint256)` | bridge completion replay |
| `0xd9a8aa5d` | `E055_InvalidSourceChainId(uint256)` | bad source chain |
| `0x40f80915` | `E056_ZeroL3IndexAddress()` | zero L3 Investment address |
| `0x14c8796b` | `E057_InvalidProof()` | zero values in bridge proof |
| `0x7496b437` | `E058_InvalidDeadline(uint256,uint256,uint256)` | cross-chain order deadline out of range |
| `0x3585e598` | `E059_CrossChainOrderZeroAmount()` | zero cross-chain buy |
| `0x557a40dd` | `E060_ZeroITPId()` | zero itpId cross-chain |
| `0xeac2915e` | `E061_Unauthorized(address,address)` | admin-only function |
| `0xbf852914` | `E062_AlreadyInitialized()` | one-time setter called twice |
| `0xadca3cef` | `E063_MintFailed(address,bytes32)` | ITP vault mint/burn call failed |
| `0xf06fc32d` | `E064_StringTooLong(uint256,uint256)` | string > 32 bytes |
| `0x892fe924` | `E066_ITPNotActive(bytes32,uint256)` | rebalance on a non-active ITP |
| `0x53831bf9` | `E070_AlreadyCompleted(uint256)` | bridged ITP-creation replay |
| `0x1ea9ed4b` | `E072_CreationNotFound(uint256)` | unknown creation nonce |
| `0x620ace69` | `E073_InvalidWeightsSum(uint256,uint256)` | bridge-side weight sum ≠ 1e18 |
| `0xfb25c4bc` | `E074_WeightBelowMinimum(uint256,uint256,uint256)` | bridge-side weight < 0.25% |
| `0x6d678f37` | `E075_BridgeLengthMismatch(uint256,uint256)` | bridge-side array mismatch |
| `0xf9d1e7f1` | `E076_NoAssets()` | bridge-side empty assets |
| `0x1e5cdb3a` | `E077_TooManyAssets(uint256,uint256)` | bridge-side asset cap (50) |
| `0x1315bdfb` | `E078_DuplicateAsset(address)` | bridge-side duplicate asset |
| `0x9d542e15` | `E079_ZeroAddressAsset()` | bridge-side zero asset |
| `0xc29d7b05` | `E07A_NameTooLong(uint256,uint256)` | name > 32 bytes |
| `0xf42de015` | `E07B_SymbolTooLong(uint256,uint256)` | symbol > 10 bytes |
| `0xe7510582` | `E07C_OrbitItpAlreadyMapped(bytes32,address)` | BridgedITP already exists for this ITP |
| `0x914191af` | `E07F_UsdcAmountTooSmall(uint256,uint256)` | 6-dec amount < 0.001 USDC |
| `0xedf9fc18` | `E080_InvalidUsdcDecimals(uint8,uint8)` | USDC decimals ≠ expected (18 L3 / 6 settlement) |
| `0x16d2d583` | `E081_InsufficientShares(address,uint256,uint256)` | not enough shares for SELL |
| `0xfbe21225` | `E082_BelowMinBuyAmount(uint256,uint256)` | below per-asset minimum buy |
| `0xd36933c3` | `E083_QueueFull(uint256,uint256)` | pending-order queue full |
| `0x1687bf83` | `E086_InvalidRotationSignature()` | bad key-rotation signature |
| `0xde8d3ced` | `E087_InvalidApprovalSignature()` | bad rotation-approval signature |
| `0x62eb8e8d` | `E088_InvalidIpUpdateSignature()` | bad IP-update signature |
| `0xaf69feec` | `E089_InvalidQueueThresholds(uint256,uint256)` | warning > pause threshold |
| `0x8fc64d90` | `E090_StaleNonce(uint256,uint256)` | registry sync nonce not increasing |
| `0x10154e04` | `E091_InvalidAggPubkey()` | aggregated pubkey ≠ 128 bytes |
| `0x7a275ea5` | `E092_ZeroAdmin()` | zero admin address |
| `0x01bc83db` | `E093_InvalidThreshold(uint256,uint256)` | bad BLS threshold config |
| `0x8ba79e8b` | `E095_InvalidOraclePrice()` | zero oracle price |
| `0x7dcbb7c0` | `E096_StaleOraclePrice(uint256,uint256)` | price older than max staleness |
| `0xda69c559` | `E097_NotActiveOracle(address)` | caller not a registered oracle |
| `0x56e1d9dd` | `E098_ZeroBeneficiary()` | zero beneficiary in submitOrderFor |
| `0xe59f73e7` | `E099_BridgeItpNotFound(bytes32)` | ITP unknown to bridge deployer tracking |
| `0x872646c8` | `E100_NotBridgeDeployer(bytes32,address,address)` | caller ≠ ITP deployer on bridge |
| `0xeafff2d8` | `E106_ZeroAddressNotAllowed()` | zero address argument |
| `0x9d6950fa` | `E107_NotAuthorizedBridge(address,address)` | caller ≠ authorized bridge |
| `0x6884ab34` | `E109_RemoveIndicesNotDescending()` | rebalance removals must be sorted descending |
| `0xfc11c92a` | `E110_RemoveIndexOutOfBounds(uint256,uint256)` | rebalance remove index out of range |
| `0x0d67f6ca` | `E111_FinalAssetCountMismatch(uint256,uint256)` | weights length ≠ final asset count |
| `0xc48d937e` | `E112_PricesLengthMismatch(uint256,uint256)` | prices length ≠ weights length |
| `0x67d5caa8` | `E113_ZeroPriceInRebalance(uint256)` | zero price in rebalance |
| `0xd6a4e662` | `E114_DuplicateAssetInRebalance(address)` | duplicate asset in rebalance |
| `0xbcdaf3c8` | `E115_RebalanceResultsInNoAssets()` | rebalance would leave zero assets |
| `0xb650014d` | `E116_BridgedItpNotFound(bytes32)` | no BridgedITP mapped for itpId |
| `0xe1252c7e` | `E117_CrossChainSellZeroAmount()` | zero cross-chain sell |
| `0x32ae9e7e` | `E118_ZeroBridgeProxy()` | zero BridgeProxy address |
| `0xd09b0a6c` | `E119_SellOrderNotFound(uint256)` | unknown cross-chain sell order |
| `0x05c93d1a` | `E121_DescriptionTooLong(uint256,uint256)` | ITP description > 280 chars |
| `0x7132cd80` | `E122_UrlTooLong(uint256,uint256)` | ITP website URL > 128 chars |
| `0x4e5269d3` | `E123_VideoUrlTooLong(uint256,uint256)` | ITP video URL > 256 chars |
| `0xdaf9b92d` | `E124_NotItpDeployer(bytes32,address,address)` | caller ≠ ITP deployer |
| `0x52e7ca4b` | `E125_BuyOrderNotFound(uint256)` | unknown cross-chain buy order |
| `0xcbaa4cd6` | `E126_FillPriceViolatesLimit(uint256,uint256,uint256,uint8)` | fill breaks the order's limit price |
| `0xc6ea35c3` | `E127_DeployerNameTooLong(uint256,uint256)` | deployer name too long |
| `0xb0bd5edf` | `E129_NotOrderOwner(address,address)` | caller ≠ order owner |
| `0x6e88a5ea` | `E130_BatchedTimeoutNotReached(uint256,uint256,uint256)` | batched-timeout refund too early (< 300s) |
| `0x5be09064` | `E131_VisionDepositNotFound(uint256)` | unknown Vision deposit order |
| `0x4faad9a0` | `E132_VisionWithdrawAlreadyProcessed(uint256)` | Vision withdrawal replay |
| `0xce82e9bb` | `E134_PriceDeviationTooHigh()` | NAV-oracle price jumped past the deviation cap |
| `0xec7f4794` | `E135_MissingOraclePubkey(uint256)` | registry missing an oracle pubkey |
| `0xfe99fd12` | `E136_NotAuthorizedMissedCountCaller(address)` | unauthorized missed-count caller |
| `0xcc326db5` | `E137_PubkeysIdsLengthMismatch(uint256,uint256)` | registry array mismatch |
| `0x1a255493` | `E138_OrderNotCancellable(uint256,uint256)` | cancel on a non-PENDING order |
| `0xdaacd248` | `E139_MintAlreadyProcessed(uint256)` | bridged mint replay |
| `0xec7285ea` | `E140_BurnAlreadyProcessed(uint256)` | bridged burn replay |
| `0x8f58e220` | `E141_OnlyCustody()` | caller ≠ settlement custody |
| `0x5c703f0a` | `E142_MintNotYetProcessed(uint256)` | clearing a mint that has not processed |
| `0x5abd6465` | `E143_BridgeProxyAlreadySet()` | one-shot setter called twice |
| `0xf1577ae9` | `E147_SellOrderAlreadyBurned(uint256)` | sell shares already burned |
| `0x83d8d5ce` | `E148_SellSharesNotBurned(uint256)` | completing a sell before the burn |
| `0x9ea0b04d` | `E149_UseBurnFromCustody()` | wrong burn path for custody-held tokens |
| `0xdf63d14a` | `E151_RemintTooEarly(uint256,uint256)` | remint before the minimum delay |
| `0x565d36ca` | `E152_BelowMinSellAmount(uint256,uint256)` | sell below minimum |
| `0x7e9c24e3` | `E153_RefundTooEarly(uint256)` | Vision-deposit refund before timeout |
| `0x1e770268` | `E154_GracePeriodNotElapsed(uint256,uint256,uint256)` | permissionless claim before deadline + 24h |

```gmseealso
[{"title": "Network reference", "href": "/docs/get-started/network"}, {"title": "Errors and fixes", "href": "/docs/bots/errors"}, {"title": "System architecture", "href": "/docs/developers/architecture"}]
```

Next: [Network reference](/docs/get-started/network) (~2 min)
