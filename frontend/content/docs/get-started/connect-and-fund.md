---
title: How do I connect and get funds?
navTitle: Connect & fund
description: Connect a wallet, add the L3 chain, and claim test USDC from the faucet.
order: 2
group: Get Started
mode: how-to
---

```gmplain
You need a browser wallet like MetaMask, and nothing else. The site connects it and adds the test network for you, then a free tap — the faucet — gives you play money. One catch: brand-new wallets are refused by the faucet until they redeem a waitlist code, which you can get on the spot with your X handle.
```

```gmsummary
What do I need? :: A browser wallet. No email, no KYC, no real funds
How do I connect my wallet? :: Click Login; approve the connection and the network prompt
How do I get test USDC? :: Click Get USDC; the faucet mints 1,000 USDC plus gas
What is the waitlist gate? :: New wallets get 403 until they redeem a code
```

## What do I need?

A browser with an injected wallet — MetaMask or any wallet that injects `window.ethereum`. That is the whole list. No email, no sign-up form, no KYC, no real funds: gas and USDC both come from the faucet.

**Testnet only.** Everything you receive here is test money with no real-world value.

## How do I connect my wallet?

1. Open [generalmarket.io](https://generalmarket.io).
2. Click **Login** in the header.
3. Approve the connection request in your wallet.
4. Approve the network prompt when it appears. The app asks your wallet to add **Index L3** — chain id 111222333, RPC `https://rpc.generalmarket.io/` — the first time it needs it.

What happens: the **Login** button becomes your shortened address. You are connected.

The branches:

- **No wallet installed.** The button reads **Install MetaMask** and links to the download. On mobile without a wallet, the in-app guide forwards you to MetaMask's app link so the site reopens inside MetaMask's built-in browser.
- **Wrong network.** If your wallet sits on another chain, an orange **Switch to Index Settlement** button appears. Click it and approve — it moves your wallet to chain 111222333.
- **Adding the chain by hand.** All chain parameters live on the [Network reference](/docs/get-started/network) (~2 min).

## How do I get test USDC?

1. Connect your wallet (above).
2. With a zero balance, a **Get USDC** button appears in the header.
3. Click it. The faucet mints **1,000 L3 USDC** to your address and drips **1 GM** for gas.
4. Within a few seconds the button reads **1,000 USDC sent** and your balance appears in the header.

**Testnet only.**
**L3 USDC has 18 decimals.** 1,000 USDC on this chain is the raw integer 1000 × 10¹⁸.

The same faucet step also appears in the step-by-step guide shown on every market page. One claim per address per 30 seconds — claim faster and the faucet answers with a cooldown error; wait and retry. If the claim fails, the button shows **Retry**: click it again after a few seconds.

```gmtip
Claiming from a script instead of the app? The faucet is a plain POST endpoint with a request cap of 10,000 USDC per call. Full request and response shapes: [Faucet API](/docs/developers/vision-api/faucet) (~3 min).
```

## What is the waitlist gate?

The faucet refuses wallets that are not on the whitelist — and the gate is **on by default**.

**A fresh wallet gets `403 WAITLIST_REQUIRED` from the faucet until it redeems a waitlist code.** In the app you never see the raw 403: clicking a gated action (the faucet, a buy) opens the waitlist window for you instead.

What you do:

1. Open the waitlist window — it opens itself when you hit the gate, or go to `generalmarket.io/?waitlist=1` directly.
2. Enter your X handle. The site issues you a code on the spot. (Already have a code? Enter it instead.)
3. Connect your wallet and redeem the code.
4. Done. Your wallet is whitelisted — claim the faucet again and it works.

The branches:

- **"This code has already been used"** — codes are single-use; get a fresh one with your handle.
- **"This wallet is already on a different code"** — one wallet binds to one code; the wallet is most likely already whitelisted, so just retry the faucet.
- **"Too many tries"** — code issuing is rate-limited; wait a few minutes.

**The gate also blocks bots.** A bot's auto-faucet fails with the same 403 until its wallet is whitelisted the same way — see [Run the reference bot](/docs/bots/quickstart) (~5 min).

```gmseealso
[{"title": "Network reference", "href": "/docs/get-started/network"}, {"title": "Place your first predictions", "href": "/docs/vision/first-predictions"}, {"title": "Faucet API", "href": "/docs/developers/vision-api/faucet"}]
```

Next: [Network reference](/docs/get-started/network) (~2 min)
