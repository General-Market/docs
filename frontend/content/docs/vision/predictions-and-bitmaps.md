---
title: How predictions are sealed
navTitle: Predictions & bitmaps
description: Picks become a bitmap, only its hash goes on-chain, and the oracle reveals it at resolution.
order: 5
group: Play
mode: explanation
---

```gmplain
Your picks are written down as a row of single up/down marks — one per market. That row stays secret with the referee until the round is scored. The only thing the public sees before then is a fingerprint of the row: it proves what you committed to, without showing anyone what you picked. You can rewrite the row as often as you like until the round locks.
```

```gmsummary
What does my prediction actually look like? :: A bitmap — one bit per market, UP=1, DOWN=0
What goes on-chain, and what goes to the oracle? :: The hash on-chain; the bitmap itself to the oracle
Can I change my predictions? :: Yes, freely, until the lock window
When are my picks revealed? :: At resolution — scored, then public, when copying is useless
What if my bitmap never reaches the oracle? :: You are voided — full deposit back at settlement
```

## What does my prediction actually look like?

A row of bits — a *bitmap*, one bit per market in the block. UP is 1, DOWN is 0, in the exact order of the block's market list. A block with 40 markets means a 40-bit row: your entire position in a handful of bytes.

The order matters: bit 0 is the first market in the block's config, bit 1 the second, and so on. That config is pinned by the block's `configHash`, so your bits and the market list can never drift apart.

The byte-level layout — bit order inside each byte, padding, the hashing code — lives in [Bitmap encoding](/docs/bots/bitmap-encoding) (~3 min). You only need it if you are building a bot; the app encodes for you.

## What goes on-chain, and what goes to the oracle?

The commitment splits in two, and each half goes to a different place:

- **On-chain: the hash.** When you join a block, `joinBatchDirect` records the keccak256 hash of your bitmap — along with the block id, the `configHash` of the market list, and your deposit. The hash is a one-way fingerprint: it pins down your exact picks, but nobody can run it backwards to read them.
- **To the oracle: the bitmap.** The app sends your actual bitmap to the oracle — the service that scores rounds — over an API call (`POST /vision/bitmap`, made for you behind the scenes). The oracle checks the bitmap against your on-chain commitment and rejects anything that doesn't hash to it; if its own record looks stale, it re-reads your commitment from the chain before deciding.

Neither half betrays you alone. The chain shows everyone a fingerprint that reveals nothing. The oracle holds your real picks but cannot alter them — a doctored bitmap would no longer match the hash you committed, and the chain's copy of that hash is beyond its reach.

## Can I change my predictions?

Yes — freely, until the block locks. A change has the same two halves as the original commitment, and the app performs both when you save:

1. **On-chain**, `updateBitmap` replaces your committed hash with the new one.
2. **To the oracle**, the new bitmap is submitted, replacing your previous one. Only your latest accepted submission counts at scoring.

Both halves stop working in the final `lockOffset` seconds of the tick — the contract reverts with `TickLocked`, and the round closes for changes. The lock window is part of the round clock, explained in [What is a block? What is a tick?](/docs/vision/blocks-and-ticks) (~4 min).

```gmtip
Resubmitting the same bitmap twice is harmless — submission is idempotent. If you are ever unsure your picks arrived, send them again.
```

## When are my picks revealed?

At resolution — the moment they can no longer help anyone. When the tick ends, the oracle takes your latest accepted bitmap, scores it market by market against the round's outcomes, and computes the payouts. After that, the round's predictions and results become public history: you can see what every player picked, and they can see yours. Round-by-round results are served by the history API — see [Rounds, results & history](/docs/developers/vision-api/history) (~4 min).

Copying is dead on arrival here. By the time a prediction is visible, the round it belonged to is already settled, and the next round's predictions are sealed all over again.

## What if my bitmap never reaches the oracle?

You are *voided* — and voided players get their full deposit back at settlement. If the round resolves and the oracle holds no bitmap for you, it does not guess: you are excluded from every market's scoring, and your entire deposit is returned in the settlement payout. No fee applies — the fee touches profit only, and a refund is not profit.

So the worst case of a failed submission is a round you sat out, not a round you lost.

```gmseealso
[{"title": "Bitmap encoding", "href": "/docs/bots/bitmap-encoding"}, {"title": "Update predictions each tick", "href": "/docs/bots/update-predictions"}, {"title": "How Vision works", "href": "/docs/vision/how-vision-works"}]
```

Next: [How do I win?](/docs/vision/payouts) (~4 min)
