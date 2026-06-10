---
title: What is a DTF?
navTitle: What is a DTF
description: An on-chain fund tracking a weighted basket of assets, priced by NAV.
order: 1
group: Trade
mode: explanation
---

```gmplain
A DTF is a fund that lives on the blockchain. It holds a basket of crypto assets in fixed proportions — say 50% bitcoin, 30% ether, 20% solana — and you buy shares of the whole basket in one trade. One share is one slice of everything inside. Anyone can create one, and the price of a share simply follows the value of what it holds.
```

```gmsummary
What is a DTF? :: An on-chain fund holding a weighted basket of assets
How is it different from holding the assets myself? :: One position, fixed weights, entry and exit through orders
Who can create one? :: Anyone — creation is permissionless, with on-chain guardrails
What is NAV? :: The basket value behind one share, starting at $1
```

## What is a DTF?

A DTF — Dex Traded Fund — is an on-chain fund that tracks a weighted basket of crypto assets. In the contracts the same object is called an **ITP (Index Token Product)**; the docs say DTF, the code and API say ITP (`itpId` in every endpoint). They are one thing.

Each DTF is defined on-chain by:

- **An asset list and weights.** Weights are 18-decimal fractions that sum to exactly 1e18 — that is, exactly 100%.
- **An inventory.** The quantity of each asset backing one share, fixed at creation from the weights and the launch prices, and changed only by a [rebalance](/docs/index/rebalancing) (~4 min).
- **A creator, a status, and a share supply.** Status is one of ACTIVE, PAUSED, INACTIVE, or DELISTING; only ACTIVE DTFs accept orders.

You hold a DTF as **shares**. Shares are 18-decimal units tracked inside the protocol contract; when a DTF has a share token deployed, the same balance also exists as a standard ERC20 in your wallet.

**Testnet only.** Every DTF, share, and dollar figure in these docs lives on a test network. None of it is real money.

## How is it different from holding the assets myself?

You hold one position instead of many, and the protocol keeps the proportions for you.

| Holding the assets yourself | Holding a DTF |
|---|---|
| One wallet balance per asset | One share balance |
| Proportions drift as prices move | Weights are fixed; rebalances adjust them deliberately |
| You trade each asset separately | One order buys or sells the whole basket |
| Prices come from wherever you trade | One share price: the NAV, enforced at fill time |

The exchange is the deepest difference. You do not swap into a DTF on an AMM. You submit an **order** — buy with USDC, sell for USDC — and the oracle network fills it at NAV. Direct deposit and withdrawal against the fund are blocked at the contract level; every entry and exit goes through the order pipeline. [What happens to my order?](/docs/index/order-lifecycle) (~5 min) walks the whole path.

**L3 USDC has 18 decimals.** 1 USDC = 1e18 on the L3 chain. Every amount in the Index protocol — orders, NAV, shares — uses 18 decimals.

## Who can create one?

Anyone. Creation is permissionless — any wallet can call `createITP` with a name, a symbol, an asset list, and weights. There is no creation fee. The contract enforces the guardrails:

- 1 to 1,000 assets (the app caps it at 100)
- every weight at least 0.25% (the app requires at least 1%)
- weights summing to exactly 100%
- no duplicate or zero-address assets

The creator is recorded on-chain and registered for fee accounting. Creating a DTF does not give the creator any shares — the creator buys in like everyone else. The full flow is in [Create your own DTF](/docs/index/create-a-dtf) (~5 min).

## What is NAV?

NAV — net asset value per share — is the market value of the slice of the basket that backs one share. Every DTF launches at a NAV of $1 (1e18 in 18-decimal terms). From then on, NAV moves with the prices of the assets inside: if the basket gains 10%, a share is worth $1.10. NAV is computed off-chain by the oracle network from the DTF's inventory and live asset prices, and pushed on-chain under an oracle signature — [How DTFs are priced](/docs/index/pricing-and-nav) (~4 min) shows exactly how.

```gmseealso
[{"title": "Buy and sell a DTF", "href": "/docs/index/buy-and-sell"}, {"title": "How DTFs are priced", "href": "/docs/index/pricing-and-nav"}, {"title": "Create your own DTF", "href": "/docs/index/create-a-dtf"}, {"title": "How is this structured legally?", "href": "/docs/index/legal-structure"}]
```

Next: [Buy and sell a DTF](/docs/index/buy-and-sell) (~4 min)
