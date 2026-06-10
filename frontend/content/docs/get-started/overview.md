---
title: What is General Market?
navTitle: Overview
description: The two products, the chain they run on, and where to start.
order: 1
group: Get Started
mode: explanation
---

```gmplain
General Market is a place to test two ideas with play money. The first: predict whether real-world numbers — crypto prices, weather readings, subway delays — go up or down, and win from people who predicted worse. The second: build and trade on-chain funds that hold baskets of assets. Everything runs on its own test blockchain, and the money comes from a free tap. None of it is real.
```

```gmsummary
What is General Market? :: One testnet, two products: predictions and on-chain funds
What is Vision? :: Sealed up/down predictions; better predictors win worse predictors' stakes
What is Index? :: Create and trade on-chain funds (DTFs); lend against them
What chain does this run on? :: An Orbit L3, chain id 111222333, testnet only
How does the system fit together? :: Data sources feed oracles; oracles drive the contracts
Where do I start? :: Pick your tab: player, bot builder, trader, integrator
```

## What is General Market?

General Market is two products sharing one testnet chain and one currency. **Vision** is a prediction market: you predict UP or DOWN on many real-world data feeds at once, and each round the worse predictors pay the better ones. **Index** is an on-chain fund platform: anyone can create a fund tracking a basket of assets — a *DTF*, Dex Traded Fund — and anyone can trade it, or lend and borrow against it.

Both run on the same chain, settle in the same USDC, and are driven by the same oracle network.

## What is Vision?

Vision is a sealed, pool-splitting prediction game. Every round — a *block* — covers one data source, and you predict UP or DOWN on every market in it at once. Your predictions are sealed: only a hash of them goes on-chain before the round resolves, so nobody can see or copy your picks. When the round's timer — its *tick* — ends, the oracle network checks the real data and splits each market's pool: losers' stakes pay winners.

There are 47 data sources across 16 categories: DeFi prices, weather, earthquakes, congressional trading, anime rankings, NYC subway delays, and more. Ticks run from one minute to one week depending on the source.

Start at [How Vision works](/docs/vision/how-vision-works) (~5 min).

## What is Index?

Index lets anyone create and trade on-chain funds. A DTF holds a weighted basket of assets and is priced by its *NAV* — net asset value, the basket's worth divided by shares. Creating one is permissionless: pick assets, set weights, deploy. Trading goes through an order pipeline the oracle network fills at real prices. On top of that sits a lending market — supply USDC to earn, or borrow against DTF shares as collateral.

Start at [What is a DTF?](/docs/index/what-is-a-dtf) (~4 min).

## What chain does this run on?

An Orbit L3 chain — General Market's own rollup, chain id 111222333. Gas is paid in GM, the chain's native token. The faucet hands out both USDC and gas, so you never need to buy anything.

**Testnet only.** Every token on this chain — USDC, GM, DTF shares — is test money. It is minted freely and cannot be withdrawn to a real network.

A second chain, the settlement chain, sits behind a bridge and carries cross-chain orders. You will rarely touch it directly. All ids, RPC endpoints, and contract addresses live on one page: [Network reference](/docs/get-started/network) (~2 min).

## How does the system fit together?

```gmflow
gm-system
```

Real-world data enters through the *data-node*, the service that polls every external source and serves prices and snapshots. Independent *oracle* nodes read the data-node, reach consensus, and co-sign every protocol action — creating rounds, settling them, filling DTF orders, pushing NAV — with a single aggregate *BLS* signature the contracts verify. The contracts on the L3 hold the money and enforce the rules. The app at generalmarket.io is a window onto all of it; everything the app does, you can do directly against the contracts and the public API.

## Where do I start?

Each tab of these docs is written for one reader. Pick yours.

```gmcards
[{"title": "Vision", "desc": "Play: predict, win, and understand where the money goes.", "href": "/docs/vision/how-vision-works"}, {"title": "Bots", "desc": "Build: run an autonomous bot that predicts every round.", "href": "/docs/bots/overview"}, {"title": "Index", "desc": "Trade: buy, create, and rebalance on-chain funds.", "href": "/docs/index/what-is-a-dtf"}, {"title": "Developers", "desc": "Integrate: the full API and contract reference.", "href": "/docs/developers/overview"}]
```

Whatever you pick, you need a connected wallet and test funds first.

Next: [How do I connect and get funds?](/docs/get-started/connect-and-fund) (~4 min)
