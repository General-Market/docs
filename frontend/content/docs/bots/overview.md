---
title: What a bot does
navTitle: Overview
description: The loop a Vision bot runs every round, and what you need to start.
order: 1
group: Build a bot
mode: explanation
---

```gmplain
A bot is a small program that plays Vision for you. Every round it looks at the open prediction blocks, picks UP or DOWN for every market inside them, and places those picks on-chain with a deposit. Good picks win money from bad picks. You need a wallet key and Python — nothing else.
```

```gmsummary
What does a bot do? :: Predicts UP/DOWN on every market, every round, across all sources
What is the loop? :: Discover new blocks, predict, encode, join, submit, sleep, repeat
What do I need? :: A private key, Python 3.10+, and testnet USDC from the faucet
What is the BotRegistry? :: Free on-chain listing of bot endpoints, used for discovery
```

## What does a bot do?

A bot predicts every round, on every market, across every source — wider and faster than any human can click. Vision runs 47 data sources, each minting a fresh prediction block (the contract calls it a *batch*: one round of predictions on one source) every tick, from 60 seconds to 7 days apart. A human follows a handful. A bot follows all of them.

Each round the bot picks UP or DOWN per market, packs the picks into a bitmap — one bit per market — and joins the block with a single USDC deposit. The deposit *is* the stake: `joinBatchDirect` has no separate stake parameter. At settlement the deposit is split evenly across the block's markets, and parimutuel scoring moves losers' stakes to winners, market by market. How the pool splits is covered in [How payouts work](/docs/vision/payouts) (~4 min).

**Testnet only.** Every balance a bot wins or loses is testnet money from the faucet.

## What is the loop?

```gmflow
bot-loop
```

The loop has six beats, repeated every poll interval:

1. **Discover** the open blocks — `GET /vision/batches`, with an on-chain scan as fallback.
2. **Fetch the config** — resolve each block's `configHash` to its market list.
3. **Predict** — run a strategy over the markets to get UP/DOWN picks.
4. **Encode** — pack the picks into a bitmap and hash it with keccak256.
5. **Join and submit** — put the hash on-chain with a deposit, send the bitmap itself to the oracle.
6. **Sleep**, then start again.

One fact shapes the whole loop: **a block lives exactly one round.** The oracle settles it one tick after creation and mints a brand-new block per source, with a new id. So the loop is never "join once, predict forever" — it re-discovers and joins new block ids every round, with a fresh deposit and a fresh bitmap each time. The round model is explained in [Blocks, ticks, and rounds](/docs/vision/blocks-and-ticks) (~4 min).

## What do I need?

- A wallet private key. Use a fresh key for the bot, not your main wallet.
- Python 3.10 or newer, plus two packages: `web3` and `requests` (both in `requirements.txt`).
- Testnet USDC and GM gas from the faucet. **The faucet is waitlist-gated by default** — see [Connect a wallet and get test USDC](/docs/get-started/connect-and-fund) (~3 min).
- The reference bot: `bot.py` at the repository root. One file, self-contained.

**L3 USDC has 18 decimals.** 0.1 USDC = 1e17 — that is also the minimum deposit per block.

## What is the BotRegistry?

The BotRegistry is a free on-chain listing: `registerBot(endpoint, pubkeyHash)` stores your bot's endpoint string and a public-key hash so explorers and the API can discover active bots, and `deregisterBot()` removes you. Registration is optional — `joinBatchDirect` enforces no bot check, so an unregistered bot plays exactly like a registered one. The full contract surface is in the [Contract reference](/docs/developers/contracts) (~8 min).

```gmcards
[{"title": "Run the reference bot", "desc": "Clone, add a key, run — in 5 minutes.", "href": "/docs/bots/quickstart"}, {"title": "Join a block", "desc": "Discovery, configHash, approval, and the real joinBatchDirect.", "href": "/docs/bots/join-a-block"}, {"title": "Bitmap encoding", "desc": "The byte-level spec for your predictions.", "href": "/docs/bots/bitmap-encoding"}, {"title": "Prediction strategies", "desc": "The 5 built-ins and how to write your own.", "href": "/docs/bots/strategies"}]
```

Next: [Run the reference bot in 5 minutes](/docs/bots/quickstart) (~5 min)
