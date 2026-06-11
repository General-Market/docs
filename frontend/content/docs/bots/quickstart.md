---
title: Run the reference bot in 5 minutes
navTitle: Quickstart
description: Clone, add a key, run bot.py — and what every log line means.
order: 2
group: Build a bot
mode: tutorial
---

```gmplain
You copy one file with your wallet key in it, install two Python packages, and run one command. The bot then gets play money from the faucet by itself, finds the open prediction blocks, and starts placing picks every round. This page shows exactly what you will see — including what happens when the faucet says no.
```

```gmsummary
What you need :: A wallet key, Python 3.10+, and five minutes
Step 1 — install :: Copy .env, install web3 and requests
Step 2 — configure :: Add your key; the shipped config works as-is
Step 3 — run :: python bot.py — faucet, register, join, loop
What you should see :: The startup log, line by line
If the faucet refuses you :: The waitlist gate and the bot-faucet fallback
```

## What you need

- A wallet private key (a fresh one — not your main wallet).
- Python 3.10 or newer.
- The General Market repository on disk — the reference bot is `bot.py` at its root, with `.env.example`, `config.toml`, and `requirements.txt` beside it.

**Testnet only.** Everything the bot deposits, wins, or loses is faucet money.

## Step 1 — install

From the repository root:

```bash
cp .env.example .env
pip install -r requirements.txt
```

That installs the bot's only two dependencies: `web3` and `requests`.

## Step 2 — configure

1. Open `.env` and set your key:

   ```bash
   BOT_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
   ```

2. The shipped `config.toml` works as-is — it points at the live Vision contract and pins nothing. Nothing to edit beyond your key.

```gmnote
On an older checkout, check two lines in config.toml: `vision_address` must be the live contract from the [Network reference](/docs/get-started/network) (~2 min), and `batch_ids` must be empty or absent — blocks live one round, so a pinned id goes stale after one tick. A stale address makes the bot refuse to start and print the exact fix (`No contract at 0x... Set VISION_ADDRESS=...`); a stale pin makes it start but join nothing. An old `stake` line is read but ignored — the live `joinBatchDirect` has no stake parameter; the deposit is the stake. `VISION_ADDRESS=...` in `.env` beats config.toml.
```

## Step 3 — run

```bash
python bot.py
```

In order, the bot: connects to the RPC and checks the chain id, verifies the Vision contract has code, requests faucet funds if the balance is below one deposit, registers itself in the BotRegistry, then loops — joining each round's new blocks and sleeping `poll_interval` seconds (default 30) between cycles.

`python bot.py --once` runs a single cycle and exits. `STRATEGY=momentum python bot.py` switches strategy — all five are listed in [Prediction strategies](/docs/bots/strategies) (~4 min).

## What you should see

```
17:02:01 [INFO] USDC from Vision contract: 0xaddB799BC1499b224DC4368e92b9042a54908553
17:02:01 [INFO] Vision Bot starting
17:02:01 [INFO]   Strategy:    random
17:02:01 [INFO]   Bot address: 0xYourBotAddress
17:02:01 [INFO]   RPC:         https://rpc.generalmarket.io/
17:02:01 [INFO]   API:         https://generalmarket.io/api
17:02:01 [INFO]   Deposit:     10 USDC per round (the deposit is the stake)
17:02:02 [INFO]   Chain ID:    111222333
17:02:02 [INFO] Balance 0 USDC — requesting 1000 from faucet
17:02:06 [INFO] Faucet OK: 1000 USDC
17:02:06 [INFO]   USDC balance: 1000
17:02:09 [INFO] Bot registered
17:02:12 [INFO] Batch 301270: 24 markets, 13 UP / 11 DOWN
17:02:16 [INFO] Bitmap accepted by 1 oracle(s)
17:02:16 [INFO] Batch 301270: joined (24 markets)
17:02:45 [INFO] Joined 12 new batch(es) this round (lifetime total: 12)
```

Addresses, batch ids, and market counts will differ; the sequence will not. On later cycles you will often see `No new batches to join this cycle` — that is normal between ticks. When a source's tick ends, the oracle settles the old block and mints a new one, and the next cycle joins the new id.

**L3 USDC has 18 decimals.** The log prints whole USDC; on-chain, 10 USDC is 1e19.

## If the faucet refuses you

The main faucet (`POST /api/faucet`) checks a waitlist before it pays.

**The faucet is waitlist-gated by default.** A fresh address gets HTTP 403 `WAITLIST_REQUIRED` until it is whitelisted.

The bot handles each refusal and tells you what it did:

- **403 from the main faucet** — the bot automatically falls back to the bot faucet (`POST /api/bot/faucet`): a fixed drip of 100 USDC + 1 GM gas, one claim per IP and per address every 24 hours. You will see `Trying the bot faucet instead...` followed by `Bot faucet OK: 100 USDC + 1 GM`.
- **403 from the bot faucet too** — both faucets are gated for your address. The log prints the waitlist URL; join the waitlist with the bot's address, then rerun.
- **429** — a cooldown. The main faucet allows one claim per address per 30 seconds; the bot faucet one per IP and per address per 24 hours. The log prints how long to wait.

If the bot ends with `No USDC`, funding failed — resolve the waitlist or cooldown above and run it again. Faucet request and response shapes are in the [Faucet API reference](/docs/developers/vision-api/faucet) (~3 min).

```gmseealso
[{"title": "Join a block", "href": "/docs/bots/join-a-block"}, {"title": "Errors and fixes", "href": "/docs/bots/errors"}]
```

Next: [Join a block](/docs/bots/join-a-block) (~6 min)
