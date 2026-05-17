# itp-trader-bot

Synthetic rotation traffic for the Index L3 testnet. Five wallets, one random action every twelve minutes (jittered ±90s). Buy ITP, sell ITP, lend USDC to the MetaMorpho USDC vault, borrow USDC against an ITP collateral position. The bot exists to make the chain look like it has users. It is not a trading strategy.

## Local

```
pnpm install            # or npm install
pnpm dry                # generates keys.json on first run, dry-runs every action once
pnpm dev                # live loop, --dry-run via DRY_RUN env if you prefer
```

On first run with no `keys.json`, the bot generates five private keys and writes them to `keys.json` (0600). It then prints the five addresses. Fund each one:

- ~10 GM (native gas on L3)
- ~100 USDC L3 (`0xaddB799BC1499b224DC4368e92b9042a54908553`, 18 dec — yes, eighteen, see `CLAUDE.md`)
- ~1 share of one or two ITPs (so the borrow path has collateral to draw on)

The bot will skip the actions it cannot afford rather than spamming reverts.

## Deploy on VPS 3

```
# from your laptop, in itp-trader-bot/
docker build -t itp-trader-bot:latest .
docker save itp-trader-bot:latest | gzip | ssh vps3 'gunzip | docker load'
scp docker-compose.yml vps3:/opt/itp-trader-bot/docker-compose.yml
ssh vps3 'mkdir -p /opt/itp-trader-bot/data && cd /opt/itp-trader-bot && docker compose up -d'

# tail the logs to confirm
ssh vps3 'docker logs -f itp-trader-bot --tail 50'

# the bot writes /opt/itp-trader-bot/data/keys.json on first run — copy it down
# to grab the addresses to fund:
ssh vps3 'cat /opt/itp-trader-bot/data/keys.json'
```

`/health` is bound to 127.0.0.1:8090 inside VPS 3. To inspect from your laptop, port-forward:

```
ssh vps3 -L 8090:127.0.0.1:8090
curl http://127.0.0.1:8090/health | jq
```

## What it logs

Every tick prints a single JSON line: `kind` (buy/sell/lend/borrow), `status` (ok/skip/error), `wallet`, `tx` (when applicable), and a one-line `note`. Skipped ticks are normal — they happen when a wallet has no USDC to buy with, no shares to sell, or no collateral to borrow against.
