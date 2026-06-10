---
title: Buy and sell a DTF
navTitle: Buy & sell
description: Your first DTF trade — fund, buy, watch the fill, sell.
order: 2
group: Trade
mode: tutorial
---

```gmplain
This is your first trade, start to finish. You pick a fund from the list, type how much test money to spend, and press one button. The app walks the order through the system in about a minute and shows you the shares you got. Selling is the same trip in reverse.
```

```gmsummary
What do I need first? :: A connected wallet and test USDC — about two minutes
How do I find a DTF? :: Browse the grid, every card has a Buy button
How do I buy? :: Enter an amount, press Approve & Buy, watch the ring
Where is my position? :: In the modal right away, in your portfolio after
How do I sell? :: Press Sell, enter shares, one transaction, USDC returns
```

**Testnet only.** Everything you spend and receive here is test money from a faucet.

## What do I need first?

A connected wallet and some test USDC — nothing else. If you have not connected yet, [How do I connect and get funds?](/docs/get-started/connect-and-fund) (~3 min) covers the wallet and the faucet. You can also fund yourself from inside the buy flow below.

**The faucet is waitlist-gated.** A wallet that is not whitelisted gets refused until it joins the waitlist; the app prompts you through it.

## How do I find a DTF?

Open the DTF browser at `generalmarket.io/itps`. Every card shows the fund's name, NAV, and performance, with **Buy** and **Sell** buttons on the card itself. Clicking a card opens the fund's own page — chart, holdings, history — with the same Buy button.

```gm-shot
The DTF browser grid at /itps — cards with NAV, performance sparkline, and Buy/Sell buttons.
```

Pick any fund. The flow is identical for all of them.

## How do I buy?

1. Press **Buy** on a card. The buy panel opens with a price chart and an amount field.
2. Type an amount in the **Amount (USDC)** field — `100` is plenty. Your balance shows next to the field.
   If your balance is zero, a **Mint 10,000 Test USDC** button appears below the field — press it and wait for "Minted!".
3. Leave **Max Price (USDC/share)** empty. Empty means market order: you take the next fill at NAV. (Setting a price caps what you will pay — the contract rejects any fill above it.)
4. Press **Approve & Buy**. Your wallet asks for two confirmations: one approval letting the protocol take your USDC, then the order itself. Approve both. On later buys, with the allowance already in place, the button reads **Buy DTF** and there is one confirmation.
5. Watch the progress ring: **Submit → Batch → Fill**. The oracle network is batching your order and filling it — typically about a minute. The page is safe to close; the order keeps going without you.

```gm-shot
The buy modal: amount field with balance, Max Price field, Approve & Buy button.
```

When the ring completes, the **Fill Details** panel shows your fill price, the USDC amount filled, the shares you received, and the exact slice of each underlying asset now backing them.

```gm-shot
Fill Details after a completed buy — fill price, shares received, per-asset backing breakdown.
```

**L3 USDC has 18 decimals.** The 100 USDC you typed is 1e20 base units on-chain. The app does the conversion; you only ever type whole numbers.

## Where is my position?

Right where you finished: the buy panel shows your share balance the moment the fill lands. After you close it, the Portfolio section of the Index home page (`generalmarket.io/index`) lists every DTF you hold, with current value and profit — and its own Buy and Sell buttons.

```gm-shot
The Portfolio section listing a held DTF position with value and PnL.
```

## How do I sell?

1. Press **Sell** on the fund's card or in your portfolio. The panel shows **Your Shares**.
2. Enter the number of shares in **Shares to Sell**.
3. Press **Sell Shares**. One wallet confirmation — selling needs no approval, because the protocol already holds the share ledger.
4. The same ring runs: Submit → Batch → Fill. At fill, the USDC lands directly in your wallet, and the panel shows the assets your shares released.

```gm-shot
The sell modal: Your Shares balance, Shares to Sell field, Sell Shares button.
```

That is the whole loop: USDC in, shares, USDC out. To see what the system actually did with your order between Submit and Fill, read on.

```gmseealso
[{"title": "What happens to my order?", "href": "/docs/index/order-lifecycle"}, {"title": "How DTFs are priced", "href": "/docs/index/pricing-and-nav"}, {"title": "How do I connect and get funds?", "href": "/docs/get-started/connect-and-fund"}]
```

Next: [What happens to my order?](/docs/index/order-lifecycle) (~5 min)
