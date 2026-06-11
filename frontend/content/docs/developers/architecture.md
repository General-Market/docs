---
title: System architecture
navTitle: Architecture
description: Data sources, the data-node, the BLS oracle network, the contracts, and the invariants that keep settlement exact.
order: 2
group: Foundations
mode: explanation
---

```gmplain
General Market is a pipeline. Machines fetch numbers from the outside world — prices, weather, sports scores. One service collects and cleans those numbers. A group of watcher machines votes on what happened. Their joint signature is the only thing the blockchain accepts, and the blockchain is the only thing that moves money. The app you see is a window onto this pipeline, not the pipeline itself.
```

```gmsummary
What are the moving parts? :: Five stages — sources, data-node, oracles, contracts, app
How does data get in? :: The data-node polls 47 sources and serves snapshots
Who decides what happens on-chain? :: Oracles co-sign with BLS; one heartbeat per source
Where do predictions live before they count? :: A two-slot store — pending, then active
What keeps settlement zero-sum? :: Checked twice — by the oracle, then by the contract
What is a vault in this machine? :: An ERC-7540 fund a manager plays with
How does the Index side run? :: BLS-batched orders, pushed NAV, a two-chain bridge
```

## What are the moving parts?

Five stages, in one direction: external data sources feed the **data-node**, the data-node feeds the **oracle network**, the oracles write to the **contracts** on the L3 chain, and the **app** reads it all back out.

```gmflow
gm-system
```

- **Data sources** — the outside world: crypto exchanges, weather stations, sports feeds, government datasets. 47 sources across 16 categories.
- **Data-node** — one service that polls every source, normalizes the values, and serves them as market snapshots.
- **Oracle network** — independent nodes that watch the data-node, agree on outcomes, and co-sign every state change with a BLS threshold signature (one aggregate signature standing for a quorum of oracles).
- **Contracts** — Vision (prediction market), the Index core (DTF orders and NAV), vaults, and the bridge, all on the L3 chain. They verify the BLS signature and move the USDC.
- **App** — reads contract state and the API; writes only what any user could write (joins, orders, refund claims).

The design rule underneath: the contracts never trust a single machine. Creation, settlement, pause, fills, NAV — every administrative write requires the oracle quorum's aggregate signature, and the contracts re-check the money math themselves before any transfer.

## How does data get in?

The data-node polls each source on its own cadence and stores normalized values. For Vision, those values become the markets you predict on — each one a number that will be UP or DOWN one tick later. For Index, asset prices come from an exchange feed first (Bitget), with CoinGecko backfill and a DEX fallback; the oracle network cross-checks prices across sources and rejects values that drift outside tolerance bands (0.5% for stablecoins, 2% for BTC/ETH and everything else).

Two outputs matter downstream:

- **Snapshots** — the bulk current state of every market in a source, cached around 15 seconds. When the deployment configures a signing secret, snapshots carry an HMAC signature header so bots can verify the payload was not altered in transit.
- **Recommended configs** — the exact market list a new block will be created against. The config is hashed (keccak256), and that `configHash` is the only record of the market list that ever goes on-chain. Everyone — players, bots, oracles — fetches the full list from the data-node by that hash.

## Who decides what happens on-chain?

The oracle network, and only by quorum. Each oracle holds a BLS key; a message is valid when enough oracles co-sign it and the contract verifies the single aggregated signature. On Vision, batch creation, settlement, pause/unpause, and fee-collector changes are all BLS-gated. On Index, order batching, fills, NAV pushes, rebalances, and bridge operations are too.

The engine that drives Vision is the **BatchLifecycleManager** — a per-source heartbeat:

- Every source has its own heartbeat, firing once per `tick_duration` (60 seconds to 7 days, depending on the source).
- Each source is owned by exactly one oracle, assigned by hashing the source name modulo the number of oracles. Ownership is claimed atomically in Postgres, so restarts and concurrent nodes never double-fire a heartbeat.
- One heartbeat performs the whole round turn for its source: rotate the current block to "previous", wait for its betting window to close, flip the bitmap store, resolve every market against the start prices saved at creation, compute the parimutuel settlement, gather BLS co-signatures, and submit the settlement on-chain — with three inline retries (3s, 6s, 12s backoff) so a transient failure does not miss the window.
- The same heartbeat then creates the next block: fresh config from the data-node, BLS-co-signed `createBatch`, new batch id. A block lives exactly one round; nothing carries over.

If settlement misses its window — the grace period defaults to twice the tick, clamped between 60 seconds and 24 hours — the contract makes settlement permanently illegal for that block and opens the refund path instead. The oracle loses the right to decide; players get their full deposit back, no fee.

## Where do predictions live before they count?

In a two-slot store inside the oracle, not on-chain. The chain only ever holds the keccak256 hash of your prediction bitmap; the bitmap itself goes to the oracle and lands in the **pending** slot for that block. Resubmitting overwrites pending — you can change your mind until the lock window. Submission is idempotent: the same bitmap sent twice is harmless, which makes crash-recovery a simple resubmit.

At the tick boundary the engine **flips** pending into **active** in one atomic move, and the active set is what resolution reads. After settlement, the block's bitmaps are purged.

This is the seal in "sealed predictions": until the flip, no participant — not even another oracle reader — can act on your picks, because only the hash is public. Submissions are batched to disk every 100 ms (or every 200 rows) to survive the ~10k-submissions-per-second bursts a busy tick produces.

## What keeps settlement zero-sum?

The settlement engine computes a parimutuel result per market: losers' stakes pay winners, market by market, inside each block. Players who deposited but never delivered a bitmap are voided and refunded in full. If no market in the block resolved at all, every player is refunded in full.

The invariant is zero-sum: **total payouts must equal total deposits.** It is enforced twice, by different machines:

- The oracle computes payouts and assigns any integer-rounding remainder deterministically to the last player sorted by address — so every oracle derives byte-identical payouts and the aggregate signature can form.
- The contract independently sums payouts against deposits and reverts the whole settlement if they differ. A dishonest or buggy payout list cannot clear, no matter how many signatures it carries.

The only money the protocol takes is the fee: 0.05% of profit, deducted at payout, on-chain. No fee on losses, none on refunds.

## What is a vault in this machine?

A managed fund that plays Vision so its depositors don't have to. Each vault is an ERC-7540 asynchronous vault — deposits and redemptions are requested first, claimed later — deployed as a cheap EIP-1167 clone from a factory. Only the vault's manager can join blocks with the pooled USDC, capped at 5% of vault assets per block. Redemptions queue FIFO and are fulfilled as idle USDC becomes available after each block settles; the manager earns a performance fee only above the vault's high-water mark. Withdrawals are a queue the manager's settlements feed — there is no separate proof system in the withdrawal path, and a permissionless rescue function can pull a stuck deposit back from Vision if a block ever goes unsettled.

The player-facing story: [Managed vaults](/docs/vision/vaults) (~4 min). The endpoint surface: [Vault contract and endpoints](/docs/developers/vision-api/vaults) (~5 min).

## How does the Index side run?

The same trust shape, applied to trading. A DTF order is escrowed on-chain the moment you submit it — USDC for buys, shares for sells — and then the oracle network drives it through three BLS-signed steps:

- **Batch.** Oracles group pending orders into a cycle and co-sign one message over the cycle's order ids. One signature confirms the whole batch.
- **Execute.** Off-chain, the oracle netting engine cancels opposing flow against itself, applies slippage-tier filters, and routes the residual to venues.
- **Fill.** Oracles co-sign the fills. The contract checks each fill against the order's limit price, mints shares (buys) or returns USDC (sells), and refunds any unfilled remainder immediately. If even the refund transfer fails, the funds park in an escrow the user can claim.

NAV — the price of one DTF share — is computed off-chain by the oracle network and pushed on-chain under BLS signature. The contract stores the number; it has no NAV formula of its own.

Money lives on two chains. Trading happens on the **L3**; a settlement chain holds the other side of the bridge. **L3 USDC has 18 decimals.** Settlement-chain USDC has 6 — the bridge converts by a factor of 1e12. Outbound locks on the L3 require 11 oracle co-signatures; emergency reversals require 15. Both numbers are constants in the bridge contract — they fix how many signatures it demands, not how many oracles are running. Users never complete a bridge transfer themselves — that step is oracle-orchestrated.

```gmwarning
Testnet only. Every contract, balance, and feed described here runs on a testnet. Faucet money is not real money.
```

```gmseealso
[{"title": "Contract reference", "href": "/docs/developers/contracts"}, {"title": "Blocks, ticks, and rounds", "href": "/docs/vision/blocks-and-ticks"}, {"title": "Settlement and the bridge", "href": "/docs/index/settlement-and-bridge"}]
```

Next: [Contract reference](/docs/developers/contracts) (~10 min)
