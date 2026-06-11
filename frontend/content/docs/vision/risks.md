---
title: Risks and recovery
navTitle: Risks
description: Every failure mode, named plainly, with the path out of each one.
order: 11
group: Leaderboard & risks
mode: explanation
---

```gmplain
Most failures here fail safely: your deposit either comes back through settlement or through a refund you can trigger yourself. The risks that remain are the ones no protocol can remove — a vault manager predicting badly, or a bug in the contracts themselves. And the whole chain is a test network: the money is practice money.
```

```gmsummary
What happens when a block is paused? :: New joins stop; your existing position is untouched
What if my block never settles? :: After the grace window, claim your full deposit back
What if a market's data goes stale? :: It is dropped; your deposit rides the remaining markets
What if the oracle goes down? :: The game stops; your money falls back to the refund path
What about vault managers? :: Their bad predictions are your loss
What about the contracts themselves? :: Bugs are possible; the zero-sum check limits, not removes, them
Is this real money? :: No — testnet only
```

## What happens when a block is paused?

**A paused block stops new joins — nothing else.** Pausing a block takes a BLS quorum signature from the oracle network — the same authority that creates and settles blocks. If you already joined, your position stands: you can still update your predictions (the pause gate sits only on joining; `updateBitmap` ignores it), and the block still settles or refunds on its normal schedule. Pausing is a gate on the door, not a seizure of the room.

## What if my block never settles?

**An unsettled block turns into a full refund — claimable by you.** Every block has a settlement deadline: the end of its tick plus a grace window (60 seconds to 24 hours, typically twice the tick length). Past that deadline the contract refuses late settlement and opens `claimRefund`: full deposit, no fee. The exact claim steps are in [Custody and refunds](/docs/vision/your-money) (~3 min).

## What if a market's data goes stale?

**A market with stale data is dropped before scoring — your money moves to the markets that still work.** When a data source cannot produce fresh values for one market, the oracle removes that market before deposits are split: your whole deposit is divided across the remaining markets instead. A market that fails *during* resolution — flat value, everyone on one side, or a rule that cannot produce an outcome — refunds every player's stake on it, whatever they picked. If no market in the block can resolve at all, settlement becomes a universal refund: each player receives exactly their deposit.

## What if the oracle goes down?

**Oracle downtime stops the game — not your money.** The oracle network creates blocks, resolves markets, and signs settlements; while it is down, no new blocks appear and open blocks miss their settlement deadline. Every missed settlement falls back to the refund path above. The contract accepts no substitute authority: only a BLS quorum of registered oracles can create, pause, or settle, so an outage degrades to refunds rather than to someone else deciding outcomes.

## What about vault managers?

**A vault manager's bad predictions are your loss.** A vault's structural protections stop theft, not bad judgment — the manager cannot withdraw your money, but they decide every prediction the vault makes. Read [Managed vaults](/docs/vision/vaults) (~4 min) before depositing, and judge the manager by their record.

## What about the contracts themselves?

**Smart-contract risk is yours.** The Vision contract enforces hard invariants — settlement must be exactly zero-sum, settled blocks are immutable, refunds can only happen once — and these cap what a faulty settlement could move. They do not make the code bug-free. A defect in the contracts or the oracle could still lock or misdirect funds. Stake only what you can afford to lose entirely.

## Is this real money?

**Testnet only.** The L3 chain, the USDC on it, and everything you win or lose are testnet assets with no real-world value. The faucet hands the money out; see [Connect a wallet and get test USDC](/docs/get-started/connect-and-fund) (~3 min).

```gmseealso
[{"title": "Custody and refunds", "href": "/docs/vision/your-money"}, {"title": "Managed vaults", "href": "/docs/vision/vaults"}, {"title": "How payouts work", "href": "/docs/vision/payouts"}]
```

Next: [What a bot does](/docs/bots/overview) (~3 min)
