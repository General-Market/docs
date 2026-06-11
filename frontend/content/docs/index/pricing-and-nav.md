---
title: How DTFs are priced
navTitle: Pricing & NAV
description: NAV computed off-chain, pushed on-chain by the oracles; where asset prices come from.
order: 4
group: Trade
mode: explanation
---

```gmplain
A fund's share price is just the value of what one share holds: count up each asset inside, multiply by its current price, and you have it. The counting happens on machines that watch live exchange prices, and the result is written to the blockchain under a group signature. The app shows you that number live, with two backup routes in case the fast one breaks.
```

```gmsummary
What is the price of a DTF? :: NAV — the basket value behind one share
Who computes NAV? :: The oracle network, off-chain, pushed on-chain under BLS
Where do asset prices come from? :: The data-node's live exchange feed, oracle-checked
How does the app show me prices? :: Live stream first, API second, chain last
```

## What is the price of a DTF?

The price of one share is its NAV — the market value of the assets backing it. The formula is plain multiplication: for each asset in the fund, take the per-share quantity (the *inventory*, fixed at creation and changed only by rebalances) and multiply by the asset's current price; the sum is the NAV. Every DTF launches at a NAV of $1 — 1e18 in the protocol's 18-decimal terms — and moves with its basket from there.

**L3 USDC has 18 decimals.** NAV, like every amount in the protocol, is an 18-decimal figure: $1.00 = 1e18.

NAV is also the price your orders fill at, and your limit price is checked against the fill on-chain — see [How orders fill](/docs/index/order-lifecycle) (~5 min).

## Who computes NAV?

The oracle network — and only off-chain. A quorum of oracle nodes computes each DTF's NAV from its inventory and live prices, agrees on the value, and pushes it to the contract with `setItpNav` (the contracts call a DTF an **ITP — Index Token Product**) under an aggregated BLS signature — one signature proving the quorum agreed. The contract verifies the signature and stores the number; `getNAV` returns whatever was last pushed.

**There is no on-chain NAV formula.** The contract does not multiply inventories by prices — it cannot, because asset prices are not on the chain. It stores the oracle-signed value and nothing else. The arithmetic, the price feeds, and the agreement all live in the oracle network.

## Where do asset prices come from?

From the **data-node** — the service that collects market data for the whole system. Its live collector polls exchange tickers (Bitget) on a fixed interval and stores every price in its database; a separate collector backfills price history from CoinGecko. Before prices are used in consensus, the oracle network cross-checks them against tolerance bands: 0.5% for stablecoins, 2% for BTC and ETH, 2% for everything else. A price outside its band is rejected rather than averaged in.

```gmnote
The data-node also computes a live NAV for display, directly from inventory × freshest prices. Between oracle pushes, this display NAV can differ slightly from the value stored on-chain — the display is fresher; the chain is the settled record.
```

## How does the app show me prices?

Three routes, tried in order, so a price almost always renders. The app first listens to the data-node's live stream (server-sent events carrying NAV updates as they happen — no polling). If the stream has delivered nothing within 3 seconds, it makes one REST call to the price API. And if the data-node itself is down, that API falls back to reading the last oracle-pushed NAV straight from the contract on-chain. You will see the freshest number available — but on the rare chain-fallback, it is the last settled value, not a live one.

**Testnet only.** Every price, NAV, and dollar figure here belongs to a test network.

```gmseealso
[{"title": "What is a DTF?", "href": "/docs/index/what-is-a-dtf"}, {"title": "How orders fill", "href": "/docs/index/order-lifecycle"}, {"title": "Rebalance a DTF", "href": "/docs/index/rebalancing"}]
```

Next: [Create your own DTF](/docs/index/create-a-dtf) (~5 min)
