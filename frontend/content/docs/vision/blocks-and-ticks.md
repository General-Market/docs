---
title: What is a block? What is a tick?
navTitle: Blocks & ticks
description: The round model — a block lives exactly one tick, settles once, and a fresh block opens.
order: 3
group: Play
mode: explanation
---

```gmplain
A block is one round of the game for one data source. A tick is the clock for that round — anywhere from one minute to one week, depending on the source. When the clock runs out, the round is scored and paid, and a brand-new round opens. Nothing moves from one round to the next: each round you join again, with a new deposit and new predictions.
```

```gmsummary
What is a block? :: One round of predictions on one source — it lives once
What is a tick? :: The fixed clock that starts and ends every round
When does a block lock? :: In the final lockOffset seconds before the tick ends
What happens when the tick ends? :: The oracle scores, settles, and pays — the block closes forever
What carries over to the next round? :: Nothing — new block, new join, new predictions
What if a block never settles? :: After the grace window, your full deposit is refundable
```

## What is a block?

A block is one round of predictions on one source — and it lives exactly once. On-chain it is called a *batch*; "block" is the player-facing word for the same thing. A block is created against a single source (say, `defi`), carries that source's current market list, accepts players for one tick, resolves, settles, and is then finished. It never hosts a second round.

When a block is created, the contract pins down everything about its round:

- **The market list**, recorded as a `configHash` — the keccak256 fingerprint of the exact set of markets you are predicting. Your join must quote the same fingerprint, so you can never be scored against a different list than the one you saw.
- **`tickDuration`** — how long the round's clock runs.
- **`lockOffset`** — how long before the end the block stops accepting changes.
- **`settlementGrace`** — how long after the end the oracle has to settle before refunds open.

```gmflow
vision-block-lifecycle
```

## What is a tick?

A tick is the fixed clock that starts and ends every round. Time is divided into equal slices of `tickDuration` seconds — a fixed grid, the same for everyone. A block belongs to the tick it was created in, and its round ends exactly when that tick ends.

Every source sets its own cadence, between the contract's bounds of 60 seconds and 1 week. DeFi prices tick every 2 minutes; interest rates tick daily; World Bank indicators tick weekly. The per-source cadence is listed in [What markets can I predict?](/docs/vision/markets) (~2 min).

The oracle creates blocks on this same heartbeat — so in practice a block opens at a tick boundary and you have roughly one full tick to join, minus the lock window at the end.

## When does a block lock?

In the final `lockOffset` seconds before the tick ends. Inside that window the contract rejects both new joins and prediction changes — the transaction reverts with `TickLocked`. The lock exists so that the round has a quiet closing stretch: no one can slip in a commitment at the last instant, racing the resolution itself.

Until the lock, you can join the block and change your predictions freely — see [How predictions are sealed](/docs/vision/predictions-and-bitmaps) (~4 min).

One more way a block can stop accepting players: the oracle can **pause** it. A paused block rejects new joins but does not refund the players already in it — see [What can go wrong](/docs/vision/risks) (~3 min).

## What happens when the tick ends?

The oracle scores the round and the contract pays out — once, and finally. On its next heartbeat, the oracle:

1. **Resolves each market.** It compares the price snapshotted when the block was created against the price frozen at the tick's end. Higher means UP won; lower means DOWN won.
2. **Computes the payouts.** Parimutuel, market by market: the wrong side's stakes go to the right side, and the totals stay zero-sum — payouts equal deposits, enforced by the contract. The math is in [How do I win?](/docs/vision/payouts) (~4 min).
3. **Settles on-chain.** The oracle group co-signs the result with one combined *BLS signature* (a single signature proving the oracles agreed) and calls `settleBatch`. The contract transfers each player's payout straight to their wallet — minus the fee, charged on profit only ([Fees and minimums](/docs/vision/fees) (~2 min)).

Settlement lands about one tick after the block was created: the heartbeat that ends round N is the same one that scores it. Once settled, the block is immutable — its result can never be changed, and the same heartbeat has already opened the next round.

**Testnet only.** Payouts are testnet USDC, not real funds.

## What carries over to the next round?

Nothing. Not your deposit, not your predictions, not your position. Every tick, the oracle mints a brand-new block for the source — a new block id, with a fresh market list fetched at creation time. To play the next round you join the new block: a new `joinBatchDirect`, a new deposit, a new set of predictions. The app always shows the latest open block per source, so in practice you just play the round in front of you.

This is the whole round model: one block, one tick, one settlement — then a clean slate.

## What if a block never settles?

Then your money comes back — all of it. Every block carries a grace window, `settlementGrace`: between 60 seconds and 24 hours, normally twice the tick length. The oracle must settle before the round's end plus that grace. After the deadline, settlement becomes illegal on-chain — and the refund right opens instead. Calling `claimRefund` returns your **full deposit, with no fee**: the protocol earned nothing if it didn't deliver a round.

The short claim path is in [Where is my money?](/docs/vision/your-money) (~3 min).

```gmseealso
[{"title": "How Vision works", "href": "/docs/vision/how-vision-works"}, {"title": "How predictions are sealed", "href": "/docs/vision/predictions-and-bitmaps"}, {"title": "Where is my money?", "href": "/docs/vision/your-money"}]
```

Next: [What markets can I predict?](/docs/vision/markets) (~2 min)
