---
title: Fees and minimums
navTitle: Fees
description: Every number that touches your money — the fee on profit, the minimum deposit, gas.
order: 7
group: Money
mode: reference
---

```gmplain
Playing is close to free. The protocol takes 0.05% of your winnings — and only when you win. Losing costs no fee. Refunds cost no fee. The smallest amount you can play with is 0.1 USDC, and every transaction needs a sliver of gas, which the faucet gives you along with your play money.
```

```gmsummary
The numbers :: 0.05% on profit only; 0.1 USDC minimum; gas in GM
The fee formula :: profit × 5 / 10000, deducted at settlement
Vault fees :: Vaults add their own performance fee on top
Where fees go :: Accumulated in the contract, withdrawable only by the fee collector
```

## The numbers

| Item | Value | Raw units (18 decimals) | When it applies |
|---|---|---|---|
| Protocol fee | 0.05% of profit (`PROTOCOL_FEE_BPS = 5`) | — | Settlement, winners only |
| Fee on losses | none | — | never |
| Fee on refunds | none | — | never |
| Minimum deposit | 0.1 USDC (`MIN_DEPOSIT`) | `100000000000000000` (1e17) | every `joinBatchDirect` |
| Maximum deposit | none | — | — |
| Gas | paid in GM, the L3 gas token | — | every transaction |

**L3 USDC has 18 decimals.** 0.1 USDC = 1e17; 1 USDC = 1e18.

**Testnet only.** The faucet supplies both USDC and 1 GM of gas — see [How do I connect and get funds?](/docs/get-started/connect-and-fund) (~3 min).

## The fee formula

The fee is computed per player at settlement, on the whole-round result:

```
profit    = payout − deposit        (0 if the payout is not larger)
fee       = profit × 5 / 10000
netPayout = payout − fee
```

Deposit 2 USDC, win a 3 USDC payout: profit is 1 USDC, the fee is 0.0005 USDC, and 2.9995 USDC arrives in your wallet. Deposit 2 USDC and get 1.5 USDC back: profit is zero, fee is zero. A refund after a failed settlement returns the full deposit with no fee at all.

How payouts themselves are computed: [How do I win?](/docs/vision/payouts) (~5 min).

## Vault fees

Vault depositors pay one more fee that direct players do not: the vault's own performance fee, set by its manager at creation, charged in basis points on profits above the vault's high-water mark, and capped at 50%. Each vault shows its rate in the app. Details: [Can someone play for me?](/docs/vision/vaults) (~4 min).

## Where fees go

Collected fees accumulate inside the Vision contract (`accumulatedRealFees`). Only the designated fee collector address can withdraw them, and changing that address requires an oracle BLS signature. Fees never come out of the player pool — the pool is zero-sum before fees, and the fee is carved from individual profits after.

```gmseealso
[{"title": "How do I win?", "href": "/docs/vision/payouts"}, {"title": "Where is my money?", "href": "/docs/vision/your-money"}, {"title": "Network reference", "href": "/docs/get-started/network"}]
```

Next: [Where is my money?](/docs/vision/your-money) (~3 min)
