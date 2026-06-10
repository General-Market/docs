---
title: What happens to my order?
navTitle: Order lifecycle
description: Submit, batch, fill — limit prices, partial fills, cancels, and the refund guarantee.
order: 3
group: Trade
mode: explanation
---

```gmplain
When you press Buy, your money goes into the protocol's hands right away and your order joins a queue. A network of oracle machines picks the queue up in batches, finds the matching sellers, and fills everyone at the fund's fair price. Your shares — or your money back — always arrive: even if every machine goes dark, a built-in claim lets anyone trigger your refund after a waiting period.
```

```gmsummary
What happens when I press Buy? :: Funds escrow immediately; the order is stored PENDING
How does the order get processed? :: Oracles batch it, fill it, and settle under one signature
What does my limit price do? :: A hard cap enforced on-chain at fill time
Can my order fill partially? :: Yes — the unfilled remainder refunds immediately
Can I cancel? :: Yes, any time while the order is still PENDING
What if my order never fills? :: After deadline + 24h, anyone can trigger your refund
```

## What happens when I press Buy?

Your funds move first, before anything else happens. A buy order transfers your USDC into the protocol contract the moment you submit; a sell order escrows your shares the same way. Then the order is stored on-chain with status **PENDING**, carrying everything the system needs: the DTF, the side, the amount, your limit price, a slippage tier, and a deadline.

The contract enforces the bounds at the door:

- minimum order: 0.001 USDC (1e15 base units)
- deadline: at most 24 hours ahead
- the DTF must exist and be active, and the queue must not be full

**L3 USDC has 18 decimals.** 0.001 USDC = 1e15; 1 USDC = 1e18. Limit prices and shares use the same scale.

```gmflow
index-order-lifecycle
```

## How does the order get processed?

The oracle network drives every step after submission; nothing fills without its collective signature. Each processing cycle:

1. **Batch.** The oracles gather the PENDING orders and confirm the batch on-chain under one aggregated BLS signature — a single signature proving a quorum of oracle nodes agreed. Your order's status becomes **BATCHED**.
2. **Net and execute.** Off-chain, the oracles net buys against sells on the same DTF, filter by slippage tier, and route what remains to trading venues.
3. **Fill.** The oracles confirm the fills on-chain, again under a BLS signature. Your order becomes **FILLED**, and settlement is immediate: a buy mints you `fillAmount × 1e18 / fillPrice` shares; a sell sends `fillAmount × fillPrice / 1e18` USDC straight to your wallet.

A late order can also jump straight from PENDING to FILLED — the fill signature alone is sufficient proof, so a missed batching step never strands an order.

One edge case is handled in your favor: if the USDC transfer to your wallet fails at settlement, the amount is parked in escrow on the contract, and `claimFailedFill(orderId)` releases it to you whenever you call it.

| Status | Meaning |
|---|---|
| PENDING | Submitted, funds escrowed, waiting for the oracles |
| BATCHED | Included in a cycle, execution underway |
| FILLED | Executed and settled — terminal |
| CANCELLED | You cancelled before batching — fully refunded, terminal |
| EXPIRED | Refunded without a fill — by expiry, batch timeout, or oracle sweep — terminal |

## What does my limit price do?

It is a hard cap, enforced by the contract itself at fill time. A buy reverts if the fill price is above your limit; a sell reverts if it is below. The oracles cannot fill you through your limit even if they wanted to — the transaction fails on-chain. A limit price of 0 disables the check entirely: a market order. Prices are 18-decimal USD per share.

## Can my order fill partially?

Yes — and the remainder comes back at once. If the oracles can only fill part of your amount, the order still ends FILLED, and in the same transaction the unfilled portion refunds: USDC back to your wallet on a buy, shares restored to your balance on a sell. There is no resting remainder. One order, one shot; if you want the rest, submit again.

## Can I cancel?

Yes, while the order is PENDING. `cancelOrder` is yours alone — only the order's owner can call it, it needs no oracle signature, and it refunds the full escrow immediately. Once the order is BATCHED, execution is already underway and it can no longer be cancelled; from there it either fills or expires.

## What if my order never fills?

You get your money back — that is a guarantee, not a promise. Three routes lead to the refund, in order of how bad things have gotten:

1. **Normal expiry.** The deadline passes unfilled, and the oracles refund the order. (They can also sweep a stale PENDING order early — the same full refund, just sooner.)
2. **Stuck batch.** An order sitting BATCHED for more than 300 seconds without a fill gets refunded by the oracles as timed out.
3. **The safety net.** `claimExpiredOrder(orderId)` is **permissionless**: 24 hours after your order's deadline, *anyone* — you, a bot, a stranger — can call it and the contract refunds the escrow to the order's owner, no oracle signature required.

The third route is the one that matters. It means your refund does not depend on the oracle network, the operators, or anyone's goodwill. If every machine in the system goes dark, the money still has a way home.

```gmnote
The refund always goes to the order's owner, no matter who triggers the claim. Calling claimExpiredOrder on someone else's order just does them a favor.
```

**Testnet only.** The guarantee mechanics are real, but every balance they protect is test money.

```gmseealso
[{"title": "Buy and sell a DTF", "href": "/docs/index/buy-and-sell"}, {"title": "How DTFs are priced", "href": "/docs/index/pricing-and-nav"}, {"title": "Contract reference", "href": "/docs/developers/contracts"}]
```

Next: [How DTFs are priced](/docs/index/pricing-and-nav) (~4 min)
