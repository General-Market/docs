---
title: How do I win?
navTitle: Payouts
description: Parimutuel scoring per market, the zero-sum pool, and one worked example.
order: 6
group: Money
mode: explanation
---

```gmplain
Everyone who joins a block puts money in. When the round ends, each market checks who guessed right. The players who guessed wrong pay the players who guessed right — the protocol only moves money between players, and takes a small cut of winnings only. If a market cannot be judged fairly, your money is not lost: it is returned, or moved onto the markets that can be judged.
```

```gmsummary
How is my deposit split? :: Evenly across the markets with fresh data
Who wins inside one market? :: Losers' matched stakes pay winners; unmatched stake is refunded
How does a full round add up? :: Three players, two markets, every wei accounted for
When does a market refund instead? :: Flat, one-sided, or unresolvable markets return stakes
What if I never sent a bitmap? :: You are voided — full deposit back
Why can the pool never leak? :: The contract rejects any settlement that is not zero-sum
```

## How is my deposit split?

Evenly — across the markets that can be judged. Before anything is scored, the oracle drops any market whose source data is stale or missing. Your deposit is then divided by the number of markets left, and that slice — your *per-market stake* — rides on each one independently. Deposit 2 USDC into a block where 2 markets have fresh data and you have 1 USDC on each. If the division leaves a remainder, the leftover wei are added one each to the first markets, so the whole deposit is always in play — nothing is silently dropped.

From here on, each market is scored as its own small pool. Winning one market and losing another are independent events; your round result is the sum.

## Who wins inside one market?

The players who picked the wrong direction pay the players who picked the right one — but only up to the amount the smaller side staked. This is parimutuel scoring: you bet against the other players, not against the house.

For one market:

- Players split into an UP side and a DOWN side, each player carrying their per-market stake.
- The **matched amount** is the smaller side's total. Only matched money is at risk.
- Each player's matched stake is their share of that amount, in proportion to what they staked on their side.
- Winners receive **2× their matched stake** — their own matched money back, plus an equal amount from the losers' pool.
- Unmatched stake is refunded. If your side staked more than the other side, the excess was never at risk and comes back untouched.
- Losers lose only their matched stake; their unmatched excess is refunded too.

So you can never win more from a market than the other side actually staked against you.

```gmflow
vision-parimutuel
```

## How does a full round add up?

Three players each deposit 2 USDC into a block with two markets, so each has a 1 USDC stake per market. Market 1 resolves UP; Market 2 resolves DOWN.

**Market 1 (UP wins):** Alice and Bob are UP with 1 USDC each (side total 2); Carol is DOWN with 1 USDC. Matched amount = 1 USDC. Alice and Bob each have 0.5 USDC matched → each receives 1.0 USDC (2× matched) plus their 0.5 USDC unmatched refund. Carol's full 1 USDC was matched and is lost.

**Market 2 (DOWN wins):** Alice is UP with 1 USDC; Bob and Carol are DOWN with 1 USDC each. Matched amount = 1 USDC. Bob and Carol each take 1.0 USDC plus 0.5 USDC refund. Alice loses her 1 USDC.

| Player | Picks | Market 1 returns | Market 2 returns | Round payout | Profit | Fee (0.05% of profit) | Receives |
|---|---|---|---|---|---|---|---|
| Alice | UP / UP | 1.5 | 0 | 1.5 | 0 | 0 | 1.5 USDC |
| Bob | UP / DOWN | 1.5 | 1.5 | 3.0 | 1.0 | 0.0005 | 2.9995 USDC |
| Carol | DOWN / DOWN | 0 | 1.5 | 1.5 | 0 | 0 | 1.5 USDC |

Round payouts sum to 6.0 USDC — exactly the 6.0 USDC deposited. Only Bob made a profit, so only Bob pays the fee: `1.0 × 5 / 10000 = 0.0005 USDC`, deducted at settlement before the transfer to his wallet.

**L3 USDC has 18 decimals.** In raw units: each deposit is `2000000000000000000`, Bob's fee is `500000000000000`, and his net payout is `2999500000000000000`. The minimum deposit is 0.1 USDC = `1e17`.

**Testnet only.** Every amount above is testnet money.

## When does a market refund instead?

When the market cannot produce a fair winner, every player gets their per-market stake back in full. Three cases:

- **Flat** — the value did not move, or moved less than the market's flat threshold; neither UP nor DOWN is right.
- **All same side** — everyone picked the same direction, so there is no one to win from.
- **Cancelled** — the market's resolution rule could not produce an outcome.

A refunded market is neutral: it neither costs you nor pays you, whatever you picked.

**Stale data is handled earlier, not refunded.** A market whose source data is stale or missing is removed before your deposit is split — your whole deposit rides on the remaining markets instead, in larger slices. If no market in the block can resolve at all, settlement becomes a universal refund.

## What if I never sent a bitmap?

You are *voided* and your full deposit comes back. Joining puts your money in, but only your bitmap — the sealed list of picks — enters scoring. No bitmap by resolution time means you never actually played, so the settlement returns your entire deposit, fee-free.

The same protection applies in slices: if your bitmap is shorter than the market list, the stakes allocated to the uncovered markets are refunded rather than lost.

## Why can the pool never leak?

Because the contract checks the books before paying anyone. The oracle computes payouts off-chain, but the Vision contract re-verifies the one invariant that matters at settlement: **total payouts must equal total deposits, exactly**. If they differ by a single wei, the settlement reverts and nobody is paid.

Two details keep that exactness honest:

- Integer division leaves rounding dust; the oracle reassigns it deterministically so every oracle node computes the identical, balanced payout list.
- If *every* market in a block is cancelled, the settlement short-circuits to a universal refund — each player receives precisely their deposit.

The protocol fee never touches this invariant. It is carved out of each player's *profit* only, after the zero-sum pool is balanced. The mechanism is here; the numbers live in [Fees and minimums](/docs/vision/fees) (~2 min).

```gmseealso
[{"title": "Fees and minimums", "href": "/docs/vision/fees"}, {"title": "Where is my money?", "href": "/docs/vision/your-money"}, {"title": "What is a block? What is a tick?", "href": "/docs/vision/blocks-and-ticks"}]
```

Next: [Fees and minimums](/docs/vision/fees) (~2 min)
