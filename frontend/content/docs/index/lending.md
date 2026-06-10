---
title: Earn yield or borrow
navTitle: Lending
description: Supply USDC to earn, or borrow USDC against your DTF shares on Morpho Blue.
order: 7
group: Earn & Borrow
mode: how-to
---

```gmplain
There is a lending market on the chain. If you hold USDC, you can deposit it and earn interest paid by borrowers. If you hold DTF shares, you can pledge them and borrow USDC against them — up to 77% of their value. If your debt grows past that line, anyone may repay it for you and take some of your collateral at a discount.
```

```gmsummary
What is this market? :: Real Morpho Blue on the L3 — USDC against DTF shares
How do I supply USDC to earn? :: Deposit into the USDC vault; yield comes from borrowers
How do I borrow against a DTF? :: Pledge shares, get a quote, borrow up to 77%
What rate will I pay? :: Curator-set, 0.5%–200% APR — punitive 100% if stale
When do I get liquidated? :: Health factor below 1 — anyone may liquidate you
```

## What is this market?

Real Morpho Blue, deployed on the L3 — the same lending contract used on Ethereum mainnet, not a mock. Each market pairs one loan token against one collateral token:

- **Loan token:** L3 USDC. **L3 USDC has 18 decimals** — 1 USDC = 1e18.
- **Collateral token:** a DTF's share token (also 18 decimals).
- **LLTV 77%** — the loan-to-value line. Borrow up to 77% of your collateral's value; cross it and you are liquidatable.
- **Price feed:** a NAV oracle per DTF, pushed by the oracle network under BLS signature.

The Lending page lists every market in a table — collateral, borrow APY, TVL, available liquidity, LLTV — with filters for **All**, **Your positions**, and **Has Liquidity**.

**Testnet only.** Deposits, debts, and liquidations all run on faucet money.

## How do I supply USDC to earn?

Supplying goes through a shared USDC vault that allocates across the markets — you do not pick a borrower.

1. Open **Lending** from the navigation.
2. Scroll to **Supply — USDC Vault** and open the **Deposit** panel.
3. Enter an amount and click **Approve & Deposit**. The first deposit is two transactions: an approval, then the deposit. Later deposits are one.
4. Your position shows under **Position** — vault shares and their current value.

To exit, click **Withdraw All** in the Position panel: it redeems all your vault shares back to USDC in one transaction.

What you earn: supply APY = borrow APY × utilization. The yield comes entirely from borrowers' interest. **If nothing is borrowed, your deposit earns nothing** — the panel says so out loud when there are no active borrows.

If it fails: the only common failure is an amount above your balance — the button stays disabled with *Insufficient USDC balance*.

## How do I borrow against a DTF?

You need DTF shares first — buy some, or create your own ([Buy and sell a DTF](/docs/index/buy-and-sell) (~4 min)).

1. Open **Lending** and click your DTF's row in the markets table. The action panel on the right locks onto that market.
2. **Supply tab:** enter how many shares to pledge, approve, then deposit. This is your collateral.
3. **Borrow tab:** enter the USDC amount. The app fetches a quote — borrow rate, projected health factor, liquidation price, and your max borrow. Quotes expire; a stale quote refreshes before you sign.
4. Click borrow. Before the transaction, the app asks the curator to position liquidity for your loan — this can take up to ~90 seconds on a cold market. Then your wallet signs, and the USDC lands in your wallet.

Paying back and exiting:

- **Repay tab** — repay part of the debt by amount, or all of it. "Repay all" settles by debt shares, so no dust is left behind.
- **Withdraw tab** — pull collateral back out. With debt outstanding you can only withdraw down to a healthy position; with the debt cleared you can withdraw everything, which closes the position.

If it fails: a borrow above your max is rejected by the quote before you ever sign; if the curator cannot position liquidity in time, the prepare step fails with an explicit error and nothing is signed.

```gm-shot
The Lending page: markets table on the left, action panel with Supply / Withdraw / Borrow / Repay tabs on the right.
```

## What rate will I pay?

A rate set by a curator — not a utilization curve. The interest rate model (`CuratorRateIRM`) holds one per-second rate per market, and only the curator can set it, within hard bounds:

| Bound | Value |
|---|---|
| Minimum rate | 0.5% APR |
| Maximum rate | 200% APR |
| Punitive rate | 100% APR |

**If the curator does not refresh the rate for 48 hours, the market charges the punitive 100% APR** — on purpose. A stale rate could underprice risk and hurt lenders, so staleness is made expensive for borrowers instead. The displayed APY is the per-second rate compounded over a year; supply APY is that times utilization.

## When do I get liquidated?

When your debt exceeds 77% of your collateral's oracle value. Your collateral is priced by the DTF's NAV oracle; the quote you saw when borrowing included your **liquidation price** — the NAV at which your position crosses the line.

Liquidation is **permissionless**: anyone, human or bot, may call `liquidate` on an unhealthy position. The liquidator repays your debt and takes collateral at a discount — about 7% for a 77%-LLTV market, capped at 15%. There is no grace period and no committee.

Therefore: watch the health factor, and repay or add collateral before it reaches 1. The risks that sit underneath this — rate spikes, oracle staleness — are spelled out in [What can go wrong](/docs/index/risks) (~4 min).

```gmseealso
[{"title": "What can go wrong", "href": "/docs/index/risks"}, {"title": "How DTFs are priced", "href": "/docs/index/pricing-and-nav"}, {"title": "Lending API", "href": "/docs/developers/index-api/lending"}]
```

Next: [Two chains, one balance](/docs/index/settlement-and-bridge) (~5 min)
