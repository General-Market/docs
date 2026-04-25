# nsgame load bot

A small Python process that bets on every open nsgame cohort and keeps
betting until told to stop. The chain is empty without it. That is the
point.

## What it does

Every cohort rotation, it sweeps. Twenty-five markets, twenty-five random
positions. Between sweeps it places small bets on random pairs every
twenty to fifty seconds. It refills its own SOL via airdrop and its own
USDC by signing `mintTo` with the admin keypair. It refuses to run on
anything that is not Solana devnet.

## Why it exists

So the order book is not a graveyard. So the data-node has events to
chew on. So the indexer's pipelines have something to settle. So the
oracle has work. The markets need to look alive while we onboard real
users — and load itself is a kind of test. Everything that survives the
bot is something a human can survive too.

## Cost

Twenty-five live markets per cohort. Fifteen stars on a four-hour
window, ten cams on a two-minute window.

| flow      | rate                   | per day     |
|-----------|------------------------|-------------|
| sweep cams  | 10 bets / 2 min        | 7,200       |
| sweep stars | 15 bets / 4 h          | 90          |
| micro     | 1 bet / 35 s avg       | 2,469       |
| **total** |                        | **~9,759**  |

That is roughly 293,000 bets a month. SOL gas at ~10,000 lamports per tx
is ~0.1 SOL/day, ~3 SOL/month — within an hourly airdrop cadence.
USDC burn averages out to ~370k per day (sweep at ~50 USDC mean,
micro at ~2.5 USDC mean), so the bot mints from the admin keypair often.
The hard cap on minting is 1M USDC per UTC day. Operator may lift it.

## Setup

```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env — point at your keypairs and RPC
python bot.py
```

## Deployment on VPS 3

The Solana stack lives on VPS 3. The bot belongs there.

```
# on the VPS
ssh vps3
cd /root && git clone <mono-repo> && cd index/bot-nsgame
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# generate the bot keypair if it does not exist
test -f /root/.secrets/nsgame-bot.json || \
  solana-keygen new --no-bip39-passphrase -o /root/.secrets/nsgame-bot.json

# the admin keypair already exists at /root/.secrets/nsgame-faucet.json
# from the user-facing faucet — re-use it.

cp .env.example /etc/nsgame-bot.env
# edit /etc/nsgame-bot.env

cp systemd/nsgame-bot.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now nsgame-bot
```

## Killing it

```
systemctl stop nsgame-bot
```

The bot does not auto-restart from a stop. `systemctl start nsgame-bot`
brings it back. State persists between runs in `state.json`.

## Monitoring

```
journalctl -u nsgame-bot -f
```

Look for `[sweep]`, `[micro]`, and `[health]` prefixes. The summary line
lands every thirty minutes. Failures count separately from bets.

## Hard caps

- **Devnet only.** Genesis hash is verified at startup. Mainnet, even
  by accident, returns to the bash prompt without sending a single
  transaction.
- **One airdrop per hour.** Tightened to keep faucets calm.
- **One million USDC minted per UTC day.** When the cap hits, the bot
  pauses one hour and resumes. Operator can raise it via
  `NSGAME_MAX_DAILY_USDC_MINT`. The risk is theirs.

The bot is a load test. It will dominate devnet volume. That is what it
is for.
