---
title: Run the reference bot in 5 minutes
navTitle: Quickstart
description: Clone, add a key, fix config.toml, run bot.py — and what every log line means.
order: 2
group: Build
mode: tutorial
---

```gmplain
You copy one file with your wallet key in it, install two Python packages, fix two lines in a config file, and run one command. The bot then gets play money from the faucet by itself, finds the open prediction blocks, and starts placing picks every round. This page shows exactly what you will see — including what happens when the faucet says no.
```

```gmsummary
What you need :: A wallet key, Python 3.10+, and five minutes
Step 1 — install :: Copy .env, install web3 and requests
Step 2 — configure :: Add your key; fix the stale lines in config.toml
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

2. Open `config.toml` and fix two stale lines. The shipped file still points at a retired Vision contract and pins a block id that died long ago — and config.toml *overrides* the bot's correct built-in defaults:

   ```toml
   vision_address = "0x36a28967544c301a3c66dcfb6c6c90e548412693"
   batch_ids = []
   ```

   The address is the live Vision contract, the same one listed in the [Network reference](/docs/get-started/network) (~2 min). `batch_ids` must be empty because blocks live one round — a pinned id goes stale after one tick. Setting `VISION_ADDRESS=...` in `.env` also works; environment variables beat config.toml.

   If you skip this step the bot refuses to start and prints the exact fix: `No contract at 0x... Set VISION_ADDRESS=...`.

```gmnote
The `stake` line in config.toml is read but ignored. The live `joinBatchDirect` has no stake parameter — the deposit is the stake.
```

## Step 3 — run

```bash
python bot.py
```

In order, the bot: connects to the RPC and checks the chain id, verifies the Vision contract has code, requests faucet funds if the balance is below one deposit, registers itself in the BotRegistry, then loops — joining each round's new blocks and sleeping `poll_interval` seconds (default 30) between cycles.

`python bot.py --once` runs a single cycle and exits. `STRATEGY=momentum python bot.py` switches strategy — all five are listed in [Strategies](/docs/bots/strategies) (~4 min).

## What you should see

```
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

- **403 from the main faucet** — the bot automatically falls back to the bot faucet (`POST /api/bot/faucet`): a fixed drip of 100 USDC + 1 GM gas, one claim per IP per 24 hours. You will see `Trying the bot faucet instead...` followed by `Bot faucet OK: 100 USDC + 1 GM`.
- **403 from the bot faucet too** — both faucets are gated for your address. The log prints the waitlist URL; join the waitlist with the bot's address, then rerun.
- **429** — a cooldown. The main faucet allows one claim per address per 30 seconds; the bot faucet one per IP per 24 hours. The log prints how long to wait.

If the bot ends with `No USDC`, funding failed — resolve the waitlist or cooldown above and run it again. Faucet request and response shapes are in the [Faucet API reference](/docs/developers/vision-api/faucet) (~3 min).

```gmseealso
[{"title": "How a bot joins a block", "href": "/docs/bots/join-a-block"}, {"title": "Errors and fixes", "href": "/docs/bots/errors"}]
```

Next: [How a bot joins a block](/docs/bots/join-a-block) (~6 min)
