---
title: How Vision works
navTitle: How Vision works
description: Sealed UP/DOWN predictions across many markets — better predictors win the stakes of worse predictors.
order: 1
group: Gameplay
mode: explanation
---

```gmplain
Vision is a prediction game. Every round you answer one question for many real-world numbers at once: will this go up or down? Your answers are kept secret until the round is scored, so nobody can copy you or react to you. When the round ends, the players who predicted better win money from the players who predicted worse. There is no house to beat — only the other players.
```

```gmsummary
What am I predicting? :: UP or DOWN on every market in a block
Who pays the winners? :: The losers — every round is zero-sum
Why are predictions sealed? :: Visible predictions get copied; sealed ones stay yours
How does the sealing work? :: Hash on-chain, bitmap to the oracle, revealed at scoring
What happens every round? :: A fresh block opens per source every tick
```

## What am I predicting?

Whether real-world numbers go up or down. Crypto prices, weather readings, sports stats, earthquake counts, subway traffic — dozens of live data sources, each broken into individual *markets* (one number each). The full catalog is in [The market catalog](/docs/vision/markets) (~2 min).

Markets are grouped by source into a *block* — one round of the game for one source. When you join a block, you predict UP or DOWN for **every market in it at once**, and you back the whole set with one USDC deposit. The deposit is split evenly across the block's markets, so each prediction carries equal weight.

You don't pick one market and wager on it. You take a position on the entire set, and your accuracy across the set decides what you win or lose.

## Who pays the winners?

The other players. Vision is *parimutuel*: in each market, the stakes of everyone who predicted wrong are shared among everyone who predicted right, in proportion to their stakes. Summed across the block, every round is zero-sum — total payouts equal total deposits. No house takes the other side of your prediction, and no house can lose to you or win from you.

The protocol charges one fee: 0.05% of your **profit**, never of your deposit. Predict badly and you pay nothing on top of what you lost. The worked math lives in [How payouts work](/docs/vision/payouts) (~4 min) and the exact numbers in [Fees and minimums](/docs/vision/fees) (~2 min).

**Testnet only.** All USDC on this chain is testnet money — winnings are not real funds.

## Why are predictions sealed?

Because a visible prediction is a free gift to everyone else. If picks were public before the round closed:

- Anyone could **copy** the best player's picks and earn their accuracy without their skill.
- Anyone could **react** to the crowd — wait, watch where the stakes pile up, and position against the late information.
- Any edge a good predictor found would **decay instantly**, because the moment it appeared on-chain it would belong to everyone.

So Vision seals every prediction until the round resolves. No player can see any other player's picks before scoring — not yours, not the leaderboard leader's, not a bot's. You commit blind, everyone commits blind, and skill is the only thing left to compete on.

One honest detail: the *oracle* — the service that scores rounds — does hold your sealed picks before resolution. It cannot alter them, because your on-chain fingerprint would expose any tampering. The next section shows how.

## How does the sealing work?

Your picks travel as two pieces that are useless apart.

First, your picks become a *bitmap* — a row of bits, one per market, UP = 1 and DOWN = 0. Then the two pieces separate:

- The **hash** of the bitmap — its keccak256 fingerprint — goes **on-chain** when you join the block. A hash proves exactly what you committed to, but reveals nothing about the picks inside; it cannot be run backwards.
- The **bitmap itself** goes to the **oracle**, the referee that scores the round. The oracle only accepts a bitmap whose hash matches the fingerprint you committed on-chain.

```gmflow
vision-sealed-commitment
```

Think of it as a sealed envelope handed to the referee, with the envelope's fingerprint pinned to a public noticeboard. Other players see only the fingerprint — nothing to copy. The referee holds the envelope but cannot swap its contents — the fingerprint would no longer match. When the round resolves, the envelope is opened and scored against your on-chain commitment. The round's *results* — who won what, market by market — become public history; the picks themselves are discarded once the round settles, so there is never a moment when they can help anyone.

The full player-level mechanics — updating before lock, what happens if your bitmap never arrives — are in [How predictions are sealed](/docs/vision/predictions-and-bitmaps) (~4 min).

## What happens every round?

Every source runs on a clock. Each beat of that clock is a *tick* — minutes for the fastest sources, a week for the slowest. Every tick, the oracle scores and pays out the source's previous block, and opens a brand-new one. Nothing carries over: each round you join fresh, with a new deposit and new predictions.

That round model — block lifetimes, the lock window, settlement timing — is the subject of [Blocks, ticks, and rounds](/docs/vision/blocks-and-ticks) (~4 min).

```gmseealso
[{"title": "Blocks, ticks, and rounds", "href": "/docs/vision/blocks-and-ticks"}, {"title": "How predictions are sealed", "href": "/docs/vision/predictions-and-bitmaps"}, {"title": "How payouts work", "href": "/docs/vision/payouts"}]
```

Next: [Place your first predictions](/docs/vision/first-predictions) (~15 min)
