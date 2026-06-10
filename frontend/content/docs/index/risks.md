---
title: What can go wrong
navTitle: Risks
description: DTF, lending, and bridge risks — every limitation stated plainly.
order: 9
group: System
mode: explanation
---

```gmplain
This page lists the ways things break: a fund's price depends on an oracle network, a loan can be liquidated by anyone, a bridge can stall, and an interest rate can jump to 100% if its keeper goes quiet. None of it is hidden in fine print — each risk is named here, with what you can do about it. And above all of it: this is a test network, so no real money is ever at stake.
```

```gmsummary
Is any of this real money? :: No — testnet only, faucet funds, test-grade contracts
What can go wrong with a DTF? :: NAV is oracle-fed; fills wait on oracles; baskets are unvetted
What can go wrong when lending? :: Liquidation at 77%, rate spikes to 100%, idle yield
What can go wrong at the bridge? :: Oracle-orchestrated completion — if oracles stop, funds wait
```

## Is any of this real money?

No.

**Testnet only.** Every balance — USDC, DTF shares, vault deposits, debts — is testnet money from the faucet. It cannot be cashed out, and losing it costs you nothing real.

**The contracts are test-grade.** They carry admin functions a mainnet system would not, including one that mints DTF shares outside the order pipeline for seeding test liquidity. Treat the deployment as an environment for learning the mechanics, not a custody arrangement.

## What can go wrong with a DTF?

- **NAV depends entirely on the oracle network.** A DTF's price per share is computed off-chain and pushed on-chain under BLS signature. **There is no on-chain pricing formula** — if the oracle network stops pushing, the on-chain NAV freezes where it was. How the feed works: [How DTFs are priced](/docs/index/pricing-and-nav) (~4 min).
- **Fills wait on oracles too.** Every order is batched, filled, and settled by oracle consensus. If the network stalls, orders sit. Your money is recoverable on a timer, not by goodwill: cancel any PENDING order yourself at any time, and after an order's deadline plus 24 hours, **anyone** may trigger the refund (`claimExpiredOrder`) — nobody can strand your funds. Details: [What happens to my order?](/docs/index/order-lifecycle) (~4 min).
- **Partial fills are normal, not a failure.** An order may fill below its full amount; the unfilled remainder is refunded immediately in the same transaction. There is no resting remainder.
- **Tracking is honest only at oracle cadence.** Between NAV pushes, the displayed price and the basket's true value can drift. Deviations are corrected at the next push, not continuously.
- **Anyone can create a DTF.** Creation is permissionless and unvetted. A creator chooses the basket; a bogus creation price is corrected by the next oracle NAV push, but a bad *basket* is simply a bad basket. Read the holdings before you buy.
- **Liquidity is not guaranteed.** Fills come from the oracle execution pipeline, not an order book with committed market makers. Thin assets fill worse. A limit price is your protection: set one and the fill cannot cross it.

## What can go wrong when lending?

- **Liquidation is permissionless and immediate.** Cross the 77% LLTV line and anyone may liquidate you — no grace period, no warning. The liquidator takes your collateral at a discount. Watch the health factor; the borrow quote shows your liquidation price before you sign. Mechanics: [Earn yield or borrow](/docs/index/lending) (~6 min).
- **Your collateral's price is a NAV oracle.** Liquidation triggers on the DTF's oracle NAV, not on what you believe the basket is worth. The two facts above compound: an oracle push that moves NAV down can make you liquidatable in one update (each push is bounded to a 10% move per cycle).
- **The on-chain staleness check is effectively off.** The NAV oracle's staleness limit is set to 365 days for testnet — **a stale collateral price will not cause reverts; positions can be priced by an old NAV without any on-chain complaint.**
- **The borrow rate can jump to 100% APR.** Rates are set by a curator, not a formula. **If the curator does not refresh a market's rate for 48 hours, the rate becomes a punitive 100% APR** until refreshed. The hard ceiling is 200% APR.
- **Supply yield can be zero.** Suppliers earn borrow interest times utilization. No borrowers, no yield.

## What can go wrong at the bridge?

- **Completion is oracle-orchestrated.** You lock on one chain; the oracle network releases on the other. **If the oracle network halts, bridged funds wait in custody until it resumes** — standard operations need 11 of 20 oracle signatures, and reversing a stuck lock needs 15 of 20.
- **Dust truncation on the way out.** Converting an 18-decimal L3 amount to 6-decimal settlement USDC truncates anything below $0.000001. Bounded, but real. The decimal split: [Two chains, one balance](/docs/index/settlement-and-bridge) (~5 min).
- **Cross-chain orders add a hop.** A buy from the settlement chain escrows there, executes on the L3, and mints a mirror token back to you — three steps, each oracle-driven. More steps, more places to wait.

**L3 USDC has 18 decimals.** When checking any balance or debt by hand, remember the scale: 1 USDC = 1e18 on the L3, 1e6 on the settlement chain.

```gmseealso
[{"title": "Earn yield or borrow", "href": "/docs/index/lending"}, {"title": "What happens to my order?", "href": "/docs/index/order-lifecycle"}, {"title": "Two chains, one balance", "href": "/docs/index/settlement-and-bridge"}]
```

Next: [What is a DTF?](/docs/index/what-is-a-dtf) (~3 min)
