---
title: Two chains, one balance
navTitle: Settlement & bridge
description: The L3, the settlement chain, the 18-vs-6 decimal split, and the bridge between them.
order: 8
group: System
mode: explanation
---

```gmplain
General Market runs on two blockchains. The fast one — the L3 — is where you trade, predict, and lend. The second one — the settlement chain — is where money enters and leaves, and where some requests are filed. A bridge run by the oracle network moves USDC between them. The same dollar is written differently on each side, which is why the decimals matter.
```

```gmflow
index-two-chain
```

```gmsummary
Why two chains? :: The L3 is the app; the settlement chain is the doorway
Why do the decimals differ? :: 18 on L3, 6 on settlement — factor 1e12
How does the bridge move money? :: Lock under BLS on one side, release on the other
What is a BridgedITP? :: An 18-decimal mirror of a DTF on the settlement chain
What settles where? :: Trading and lending on L3; requests and cross-chain orders on settlement
```

## Why two chains?

The L3 (chain id 111222333, an Orbit chain) is the application chain: Vision, DTF trading, and lending all execute there, fast and cheap. The settlement chain (id 14601) is the doorway: USDC enters and exits the system there, cross-chain DTF orders originate there, and rebalance requests are filed there.

Most of the time you only touch the L3. The app switches your wallet to the settlement chain in exactly the moments that need it — and switches back. Chain details and contract addresses live in one place: [Network reference](/docs/get-started/network) (~2 min).

## Why do the decimals differ?

**USDC decimals differ: 18 on the L3, 6 on the settlement chain.**

The settlement chain uses the conventional 6-decimal USDC. The L3 represents the same dollar with 18 decimals, like ETH — so 1 USDC = 1e18 on the L3 and 1e6 on settlement. The conversion factor is **1e12**, and the protocol converts in a fixed library:

- Settlement → L3: multiply by 1e12. Always lossless.
- L3 → settlement: divide by 1e12. Truncates anything below 6 decimal places — at most $0.000001 of dust per conversion.

This single fact explains most "wrong balance" confusion: an amount that looks a trillion times too big is an 18-decimal L3 amount read with 6-decimal eyes.

## How does the bridge move money?

By lock-and-release, with the oracle network signing every step. No single party can move bridged funds.

1. **Lock.** On the L3, the bridge custody contract escrows 18-decimal USDC. The operation requires an aggregate BLS signature from the oracle network — the signed message binds the chain id, the contract, the destination chain, the amount, and a sequential nonce, so a signature can never be replayed elsewhere.
2. **Release.** On the settlement chain, the counterpart custody contract releases 6-decimal USDC for that nonce. A per-source-chain replay guard means each lock can be completed exactly once.

You never call the release yourself — bridge completion is orchestrated by the oracle network. Two signature thresholds exist: **11 of 20** oracles for standard operations, **15 of 20** for emergency reversals of a stuck lock.

## What is a BridgedITP?

An 18-decimal ERC-20 mirror of a DTF, living on the settlement chain. It exists so you can buy a DTF without leaving the settlement chain:

1. You call the settlement custody contract's buy entry with 6-decimal USDC. It escrows your USDC and records the order in 18 decimals internally.
2. The oracle network executes the order on the L3, where the real DTF lives.
3. You receive a **BridgedITP** token on the settlement chain — minted only by the bridge, deployed deterministically with CREATE2 using the L3 DTF id as the salt, so the mirror's address is computable before it exists.

Selling is the reverse: the mirror is burned, and 6-decimal USDC comes back. Two on-chain mappings tie every mirror to its L3 original, in both directions. Order rules match the L3: minimum 0.001 USDC, deadline up to 24 hours, optional limit price.

## What settles where?

| Action | Chain |
|---|---|
| Buy/sell a DTF (normal path) | L3 |
| Vision predictions and payouts | L3 |
| Lending — supply, borrow, repay, liquidate | L3 |
| DTF creation | L3 |
| Rebalance request | settlement chain |
| Cross-chain DTF buy/sell | starts on settlement, executes on L3 |
| Bridge lock → release | L3 → settlement (and back) |

**Testnet only.** Both chains, and every balance on them, are testnet.

```gmseealso
[{"title": "Network reference", "href": "/docs/get-started/network"}, {"title": "Rebalance a DTF", "href": "/docs/index/rebalancing"}, {"title": "What happens to my order?", "href": "/docs/index/order-lifecycle"}]
```

Next: [What can go wrong](/docs/index/risks) (~4 min)
