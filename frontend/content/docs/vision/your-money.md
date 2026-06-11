---
title: Custody and refunds
navTitle: Custody & refunds
description: Where your deposit sits from join to settlement, and the refund right if settlement never comes.
order: 8
group: Your money
mode: explanation
---

```gmplain
When you join a block, your USDC moves from your wallet into the Vision contract — a program on the chain that nobody can quietly change. When the round settles, your payout moves straight back to your wallet. Nothing sits in any account in between. And if the system ever fails to settle your round, you can take your full deposit back yourself, without asking anyone.
```

```gmsummary
Where does my deposit go when I join? :: Straight from your wallet into the Vision contract
How does it come back? :: Settlement pays your wallet directly, then the round is final
What if the block never settles? :: After the grace window, your refund right opens
How do I claim a refund? :: Four steps, full deposit, no fee
```

## Where does my deposit go when I join?

Into the Vision contract, in the same transaction that joins you to the block. `joinBatchDirect` transfers your USDC from your wallet to the contract and records your position — your deposit amount and the hash of your sealed predictions.

There is no account in between. Vision keeps no balance for you to top up, no internal wallet to withdraw from, no custodian holding funds on your behalf. Money exists in exactly two places: your wallet, or the contract of a round you are currently in.

## How does it come back?

Settlement pays your wallet directly. When the oracle settles the block, the contract computes your fee (on profit only) and transfers your net payout straight to your address in the same transaction. Your position is deleted, the block is marked settled, and a settled block is immutable — it can never be re-settled, drained, or replayed.

There is no claim step for a normal settlement. If you won, the money is already in your wallet.

## What if the block never settles?

Then the money becomes claimable by you, and *only* by the rules. Every block carries a settlement grace window — between 60 seconds and 24 hours, typically twice the block's tick length. The deadline is `end of the block's tick + grace window`. The contract enforces a hard cliff at that moment:

- **Before the deadline:** only the oracle (with a valid BLS quorum signature) can settle. You cannot withdraw mid-round.
- **After the deadline:** settlement becomes *illegal* — the contract rejects it outright — and the refund right opens for every player in the block.

The refund is the full deposit. **No fee is charged on refunds.** The protocol earned nothing if it did not deliver a settlement.

## How do I claim a refund?

1. Note the block's batch id (visible on the block page or via `getBatch`).
2. Wait until the deadline has passed — `batchExpirationTime(batchId)` on the Vision contract returns the exact timestamp.
3. Call `claimRefund(batchId)` from the wallet that joined. Anyone may instead call `claimRefundFor(batchId, yourAddress)` on your behalf — the funds always go to the player who deposited, never to the caller.
4. Your full deposit lands in your wallet. The position is deleted, so the refund can only happen once.

**The app has no refund button yet.** `claimRefund` is a direct contract call — use any wallet or tool that can call a contract function. The Vision address lives on the [Network reference](/docs/get-started/network) (~2 min).

```gmwarning
If the claim reverts with NotYetRefundable, the grace window has not passed. If it reverts with BatchAlreadySettled, the block settled normally — check your wallet, the payout is already there.
```

**L3 USDC has 18 decimals.** A 0.1 USDC deposit is 1e17 raw units, and the refund returns exactly the raw amount you deposited.

**Testnet only.**

```gmseealso
[{"title": "How payouts work", "href": "/docs/vision/payouts"}, {"title": "Risks and recovery", "href": "/docs/vision/risks"}, {"title": "Network reference", "href": "/docs/get-started/network"}]
```

Next: [Managed vaults](/docs/vision/vaults) (~4 min)
