---
title: Rebalance a DTF
navTitle: Rebalancing
description: Change a DTF's weights and holdings without changing its price per share.
order: 6
group: Create
mode: how-to
---

```gmplain
Rebalancing changes what a fund holds — new percentages, new tokens, or dropped tokens. You file a request from the fund's page; the oracle network checks it and carries it out. The price per share does not move at the moment of the change: the fund swaps what it holds, not what it is worth.
```

```gmsummary
Who can rebalance? :: The UI shows it to the creator; the chain does not check
How do I request a rebalance? :: Edit weights on your DTF page, sign on the settlement chain
What happens on execution? :: Oracles re-price the basket under BLS; NAV stays constant
What are the constraints? :: Same weight rules as creation, plus ordering rules
```

## Who can rebalance?

In the app: the creator. Your DTF's detail page shows the **Rebalance** section only when your connected wallet matches the creator on record.

On-chain, the picture is wider, and we state it plainly: **the request function is permissionless — any address may submit a rebalance request for any DTF.** A request is only a request. It moves no funds and changes no state beyond logging itself; the oracle network decides whether to verify and execute it. The actual `rebalance` execution is gated by BLS signature from the oracle network, never by the caller.

**Testnet only.** All of this runs on testnet funds.

## How do I request a rebalance?

1. Open your DTF's detail page. If you are the creator, the **Rebalance** section is visible.
2. Adjust the weights, add holdings, or remove them. Add a short note describing why (it travels with the request).
3. Click **Request Rebalance**. The app switches your wallet to the **settlement chain** — rebalance requests are filed there, on the BridgeProxy contract, not on the L3.
4. Sign the transaction. Once it is mined, you see **Rebalance request submitted** — that is the success state for your part.

What happens next is asynchronous: the oracle network picks up the `RebalanceRequested` event, verifies the new basket, prices it, and executes on the L3 under BLS consensus. There is no fixed execution time to promise — your request is done when the transaction mines; the rebalance is done when the oracles execute it.

If it fails: the one failure branch on your side is the chain switch. If your wallet refuses to switch, the app stops with *"Switch to the Settlement chain to rebalance"* — approve the switch and submit again.

```gm-shot
The Rebalance section on a DTF detail page: weight editor, note field, Request Rebalance button.
```

## What happens on execution?

The oracles call `rebalance` on the Investment contract with your changes plus current prices, under a BLS signature. Three things happen in one transaction:

- **Assets are removed and added.** Removed assets leave the basket; added assets enter with a starting quantity of zero.
- **Inventory is recomputed at current prices.** Each asset's per-share quantity becomes `qty[i] = newWeight[i] × NAV / price[i]`.
- **NAV is held constant.** The contract reads the NAV before any change and writes the same value back after. Your share is worth the same the moment before and the moment after — what changed is what it holds, not what it is worth.

The difference between old and new inventory is emitted as per-asset trade requests, which drive the actual buying and selling that brings the real holdings in line.

## What are the constraints?

Execution enforces the same weight rules as creation, plus ordering rules for the change itself:

| Rule | Requirement |
|---|---|
| Weight total | exactly 1e18 (100%) |
| Minimum weight | 0.25% per asset (`MIN_WEIGHT = 25e14`) |
| Remove indices | sorted descending |
| Final weights count | must match the final asset list |
| Prices | one per final asset, none zero |
| Duplicates | no asset twice, no re-adding an existing asset |
| Result | at least one asset must remain |

The app builds requests that satisfy these for you; they matter if you submit requests directly against the contract.

```gmseealso
[{"title": "Create your own DTF", "href": "/docs/index/create-a-dtf"}, {"title": "How DTFs are priced", "href": "/docs/index/pricing-and-nav"}, {"title": "Two chains, one balance", "href": "/docs/index/settlement-and-bridge"}]
```

Next: [Earn yield or borrow](/docs/index/lending) (~6 min)
