---
title: Place your first predictions
navTitle: First predictions
description: A guided first run — connect, fund, pick a block, predict UP/DOWN, and watch the payout land.
order: 2
group: Play
mode: tutorial
---

```gmplain
You will connect a wallet, claim free test money, open one block of markets, guess UP or DOWN on each market, put in a small deposit, and watch the round settle. Winners are paid automatically — there is no claim button. None of the money is real; this is a test network. The whole run takes about ten minutes.
```

```gmsummary
What do I need? :: A browser wallet and ten minutes — nothing else
How do I log in? :: Click Login top-right; the app switches your wallet to L3
How do I get test money? :: The Get USDC button mints 1,000 test USDC plus gas
How do I pick a block? :: Open a source from Top markets; the block is right-rail
How do I set my predictions? :: Click UP or DOWN on every market card
How do I deposit and confirm? :: Set a stake, approve, sign — your picks lock
When does the round settle? :: Betting closes, settlement lands about one tick later
Where is my payout? :: Positions card and your wallet balance — paid automatically
```

## What do I need?

A browser wallet (MetaMask, Rabby, or anything WalletConnect speaks) and about ten minutes. No email, no account, no real money.

**Testnet only.** Everything on this chain — the USDC, the gas, the payouts — is test money. You cannot lose or win anything real.

If you have never installed a wallet: add MetaMask as a browser extension, create a wallet, and come back. That detour takes about two minutes. Chain setup is covered in [How do I connect and get funds?](/docs/get-started/connect-and-fund) (~3 min) — but you will not need it, because the app configures the chain for you in the next step.

## How do I log in?

Click **Login** in the top-right corner of [generalmarket.io](https://generalmarket.io). Your wallet pops up and asks to connect; approve it. On first connect the app asks your wallet to switch to the General Market L3 chain — approve that too. There is no separate "add network" chore; the switch prompt carries the chain config.

```gm-shot
Home dashboard with the Login button highlighted in the top-right corner.
```

If the switch prompt is rejected by accident, the header shows a **Switch network** button — click it and approve.

## How do I get test money?

Click the **Get USDC** button in the top bar. It appears once you are logged in with an empty balance, and it mints **1,000 test USDC** to your wallet, plus **1 GM** — the chain's gas token, enough to sign transactions. The button reads "Minting…", then "1,000 USDC sent". Your balance replaces the button within a few seconds.

```gm-shot
Top bar of a freshly connected wallet showing the Get USDC faucet button.
```

**The faucet is waitlist-gated by default.** If your address is not whitelisted yet, a waitlist window opens instead of a mint. The faucet will not pay until your address is on the list.

Two smaller branches:

- The faucet has a **30-second cooldown** per address. Clicking twice shows "Just sent some — check your balance in a few seconds."
- If you skip this step, the block panel on any source page shows the same warning with its own **Get Test USDC** button. You cannot get stuck.

**L3 USDC has 18 decimals.** 0.1 USDC = 1e17 base units. The app shows human numbers everywhere; the decimals matter only when you read the chain directly.

## How do I pick a block?

From the home page, scroll to **Top markets** and click a source card — **Twitch** is a good first pick because its rounds are the fastest in the catalog (one-minute ticks), so you will not wait long for a result.

A *source* is one real-world data feed (Twitch viewer counts, earthquake magnitudes, DeFi protocol metrics). Inside it, each *market* is one thing being measured right now. A *block* is one timed prediction round over all of a source's markets — the contract calls it a batch. One block lives exactly one round: it opens, locks, settles once, and a fresh block replaces it. The full lifecycle is in [What is a block? What is a tick?](/docs/vision/blocks-and-ticks) (~4 min).

On the source page, the right rail shows the open block: **Batch #N**, a **Closes in** countdown (when betting ends), and a **This batch settles** countdown (when results land).

```gm-shot
Source page for Twitch: market cards on the left, the block panel with Batch number and the two countdowns in the right rail.
```

## How do I set my predictions?

Every market card carries an **UP** and a **DOWN** button under its chart. Click one on *every* card: will this market's value be higher or lower when the round resolves? Your choice colors the card green or red.

You must pick a direction on every market in the block — the confirm button counts you down ("3 / 10 filled") until the set is complete. You are not making one bet; you are making a pattern of bets across the whole block. More correct calls than the other players means a bigger share of the pool. The mechanism is in [How Vision works](/docs/vision/how-vision-works) (~3 min).

```gm-shot
A market card with the UP button selected and the card tinted green.
```

## How do I deposit and confirm?

In the right rail, set your stake. The **Stake** box takes a dollar amount, with quick picks from $1 to $50. Below it, the panel shows the split: your stake divides evenly across the markets — "$0.50 × 10 markets" for a $5 stake. The page requires at least **$0.10 per market**, and the contract's own floor is a **0.1 USDC minimum deposit**.

Click **Confirm**. Three things happen, in order, each named on the button:

1. **Approving…** — your wallet asks you to approve USDC spending. Sign it.
2. **Committing…** — your wallet asks you to sign the join itself. This moves your deposit from your wallet into the Vision contract, together with a sealed fingerprint (a hash) of your picks. Other players can see that you joined, but not which directions you picked.
3. **Publishing…** — the app sends your actual picks to the oracle network. No wallet prompt; it takes a second.

The button turns green: **In custody**. You are in the round, and your picks are locked on this page.

```gm-shot
The stake box with $5 set and the blue Confirm button active, wallet popup open.
```

If publishing fails (the button turns orange: **Retry reveal**), click it — resending is safe and changes nothing on-chain. Your deposit is already in the contract either way, and if a round can never settle, the full deposit comes back to you under the refund rule in [Where is my money?](/docs/vision/your-money) (~3 min).

```gmnote
The contract accepts changed predictions until shortly before the round ends, but this page locks your picks at confirm — changing a live prediction is a bot workflow. See [How predictions are sealed](/docs/vision/predictions-and-bitmaps) (~3 min).
```

## When does the round settle?

Watch the right rail. When **Closes in** hits zero, betting closes and the panel switches to **Round Closed — Awaiting settlement**, with a countdown. Settlement lands about one tick after close: data comes in from the real world, each market resolves UP or DOWN, every player's picks are revealed and graded, and the contract pays the winners — all in one transaction.

```gm-shot
The block panel in Round Closed state, amber dot, settlement countdown running.
```

While you wait, two ways to watch it live: the source page's round history updates in place, and [the Floor](https://generalmarket.io/vision/floor) — a full-screen live settlement view across all sources — shows every round resolving in real time.

## Where is my payout?

Three places, no action required from you:

- **The Positions card** on the source page shows your settled round with its realized profit or loss, and a running "Realized" total for this source.
- **Your wallet balance** in the top bar — settlement transfers USDC straight back to your wallet. There is no claim step and no balance held by the app.
- **Your profile** at `/profile/your-address` keeps the full history across every source, with a P&L chart. The leaderboard ranks you against everyone else — reading both is covered in [Leaderboard and your stats](/docs/vision/leaderboard) (~3 min).

```gm-shot
Positions card showing one settled round with a green realized P&L figure.
```

How the winnings are computed — who pays whom, and the 0.05% fee on profit only — is the subject of [How do I win?](/docs/vision/payouts) (~4 min).

You have now done the whole loop once: join, predict, settle, get paid. A new block opens on the same source every round — joining the next one is the same flow with a fresh block number.

```gmseealso
[{"title": "How Vision works", "href": "/docs/vision/how-vision-works"}, {"title": "What is a block? What is a tick?", "href": "/docs/vision/blocks-and-ticks"}, {"title": "How do I win?", "href": "/docs/vision/payouts"}, {"title": "What markets can I predict?", "href": "/docs/vision/markets"}]
```

Next: [What is a block? What is a tick?](/docs/vision/blocks-and-ticks) (~4 min)
