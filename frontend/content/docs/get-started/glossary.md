---
title: Glossary
navTitle: Glossary
description: Every term the docs use, defined in one or two sentences.
order: 4
group: Get Started
mode: reference
---

```gmplain
Short definitions for every special word these docs use. Each term is defined once, here — other pages use the words freely and point back to this page.
```

## Terms

Alphabetical. Where a term has a full page, the definition links to it.

| Term | Meaning |
|---|---|
| **Batch** | The contract-level word for one prediction round on one source. The app calls it a block; the two words name the same thing. |
| **Bitmap** | Your predictions as a string of bits — one bit per market, UP = 1, DOWN = 0. Only its keccak256 hash goes on-chain. |
| **Block** | The player-facing word for one batch: one round of predictions on one source, lasting one tick, settled once. See [What is a block?](/docs/vision/blocks-and-ticks) (~4 min). |
| **BLS** | A signature scheme that lets many oracle nodes co-sign one message as a single aggregate signature. Every batch creation, settlement, pause, fill, and NAV push is BLS-signed by the oracle set. |
| **Config hash** | The keccak256 of a batch's ABI-encoded market list — the only on-chain record of which markets the round covers. |
| **Data-node** | The service that polls every external data source and serves prices and snapshots to the oracles and the app. |
| **DTF (Dex Traded Fund)** | An on-chain fund tracking a weighted basket of assets, priced by NAV. The user-facing name for an ITP. See [What is a DTF?](/docs/index/what-is-a-dtf) (~4 min). |
| **GM** | The native gas token of the L3 chain. The faucet drips it alongside USDC. |
| **Grace window** | The period after a batch's tick ends during which only the oracle may settle (60 seconds to 24 hours, set per batch). After it, any player can claim a full refund of an unsettled batch. |
| **ITP (Index Token Product)** | The contract-level name of a DTF. API parameters use `itpId`. |
| **L3** | General Market's own Orbit rollup, chain id 111222333, where Vision and Index trading run. Gas is GM; USDC there has 18 decimals. |
| **Lock window** | The final stretch of a tick during which joins and prediction updates are rejected, so picks are frozen before resolution. |
| **NAV (Net Asset Value)** | The per-share value of a DTF: the basket's total value divided by shares outstanding. Computed off-chain by the oracle network and pushed on-chain. |
| **Oracle** | A node that reads real-world data, reaches BLS consensus with its peers, and writes the result on-chain — creating, settling, and pausing batches, filling DTF orders, pushing NAV. |
| **Parimutuel** | A pool-splitting payout: all stakes on a market form one pool, and losers' stakes are paid to winners in proportion to their stakes. Zero-sum by construction. See [How payouts work](/docs/vision/payouts) (~4 min). |
| **Sealed commitment** | Before a round resolves, only the hash of your bitmap exists on-chain — nobody, including the operators, can read your picks from the chain until resolution. |
| **Settlement chain** | The second chain (Sonic Testnet, id 14601) behind the bridge, used for cross-chain DTF orders. USDC there has 6 decimals. |
| **Source** | One external data feed — defi, weather, congress, twitch — that a block's markets are built from. 47 sources across 16 categories. |
| **Tick** | One round's duration on a source, from 60 seconds to 7 days. When the tick ends, the markets resolve against fresh data. |
| **Vault** | A managed on-chain fund (ERC-7540) whose manager plays Vision rounds with depositors' USDC. See [Managed vaults](/docs/vision/vaults) (~4 min). |

```gmseealso
[{"title": "What is General Market?", "href": "/docs/get-started/overview"}, {"title": "Network reference", "href": "/docs/get-started/network"}]
```

Next: [FAQ](/docs/get-started/faq) (~2 min)
