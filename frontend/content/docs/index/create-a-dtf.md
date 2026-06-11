---
title: Create your own DTF
navTitle: Create a DTF
description: Deploy a custom DTF — pick assets, set weights, sign one transaction.
order: 5
group: Create
mode: how-to
---

```gmplain
You pick tokens and give each one a percentage. The app turns that into a fund anyone can buy and sell. There is no creation fee — you pay only a little testnet gas — and once it is live, the price per share is tracked automatically.
```

```gmsummary
What do I need first? :: A connected wallet on the L3 with gas
How do I create one? :: Pick assets, set weights to 100%, name it, deploy
What does the contract allow? :: Looser limits than the app — 1000 assets, 0.25% floor
What do I control afterwards? :: You are the creator — rebalances and fee registration
```

## What do I need first?

A wallet connected to the L3 chain, with a little gas. The faucet gives you both USDC and gas — see [Connect a wallet and get test USDC](/docs/get-started/connect-and-fund) (~3 min).

**Testnet only.** Nothing you deploy or spend here is real money.

Every asset you pick must have a live price from the data-node. The app checks this while you build the basket and marks unpriced assets in red — you cannot deploy with them.

## How do I create one?

1. Open the app and choose **Create Index** in the home navigation.
2. **Select assets.** Search the list and click a token to add it. The app allows up to **100** assets per DTF.
3. **Configure weights.** Each asset gets a whole-number percentage. The total must be exactly **100%**, and no asset may sit at 0%. **Equal** splits evenly; **MCap** weights by price as a rough size proxy.
4. Click **Continue →**. The **Finalize DTF** modal opens: enter a name (up to 32 characters) and a symbol (up to 10 characters, upper-case — auto-suggested from the name). Description, website, and video are optional.
5. Click **Finalize & Deploy**. The app fetches live prices for your basket, simulates the transaction, then prompts your wallet to sign on the L3.

What happens next: your wallet calls `createITP(name, symbol, weights, assets, prices, bridgeNonce)` on the Investment contract — the contracts call a DTF an **ITP (Index Token Product)** — directly on the L3, no bridge involved. Your percentages are scaled to 18 decimals (1% = 1e16) so they sum to exactly 1e18. The new DTF starts at a NAV of $1.00 per share, and its starting inventory is computed from the prices you deployed with: `qty[i] = weight[i] × 1e18 / price[i]`.

The app then waits for the oracle network to pick up the new DTF. When it appears in the live price stream, you see **Live on L3** — the DTF is tradeable by anyone.

If it fails: the most common reverts are decoded for you before the wallet even opens — an asset below the weight floor, or a paused system. A missing or implausible price (below $0.0001 or above $100M) blocks the deploy with the asset named, so you can swap it out.

```gm-shot
The Create Index screen: asset chips on the left, weight editor at 100% on the right, Continue button active.
```

## What does the contract allow?

Creation is **permissionless** — any address may call `createITP` directly; the app's limits are tighter than the chain's. There is **no creation fee** on either path.

| Rule | In the app | On-chain |
|---|---|---|
| Assets per DTF | ≤ 100 | 1–1000 (`MAX_ASSETS`) |
| Minimum weight | 1% (whole percents) | 0.25% (`MIN_WEIGHT = 25e14`) |
| Weight total | exactly 100% | exactly 1e18 (`WEIGHT_SUM`) |
| Name | ≤ 32 characters | ≤ 32 bytes, non-empty |
| Symbol | ≤ 10 characters, upper-case | packs to bytes32, non-empty |
| Duplicate or zero-address assets | blocked | blocked |
| Creation fee | none | none |

**L3 USDC has 18 decimals.** All weights, prices, and NAV values on the L3 use the same 18-decimal scale.

## What do I control afterwards?

You are recorded as the DTF's **creator**. That gives you two things:

- **Fee registration.** Creation registers you as the deployer in the fee registry — the accounting home for any fees attributed to your DTF.
- **The Rebalance panel.** Your DTF's detail page shows a Rebalance section only to your wallet, where you change weights and holdings — see [Rebalance a DTF](/docs/index/rebalancing) (~4 min).

What you do *not* control: minting and burning. Shares enter and exit only through the order pipeline — there is no direct deposit or withdraw on the share token. Your DTF trades like any other; see [Buy and sell a DTF](/docs/index/buy-and-sell) (~4 min).

```gmseealso
[{"title": "Rebalance a DTF", "href": "/docs/index/rebalancing"}, {"title": "How DTFs are priced", "href": "/docs/index/pricing-and-nav"}, {"title": "Network reference", "href": "/docs/get-started/network"}]
```

Next: [Rebalance a DTF](/docs/index/rebalancing) (~4 min)
