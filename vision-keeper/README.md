# vision-keeper

The protocol gives up the right to be late. The keeper makes sure no one stays inside.

A small daemon that watches Vision batches on the Index L3. When the oracle misses
its grace window, the keeper pulls every player's deposit back to where it belongs.
Vaults get `refundStuckBatch`. Wallets get `claimRefundFor`. Nothing rots.

## What it does

Every `POLL_INTERVAL_SECS` (default 60):

1. Read the chain head.
2. Walk `BatchCreated` over the last `LOOKBACK_SECONDS` (default 7 days).
3. Drop the settled. Drop the unexpired. Whatever remains is stuck.
4. List `PlayerJoined`. Subtract `PlayerRefunded`. Whatever remains is owed.
5. For each owed player, send the refund.
   - Registered vault → `vault.refundStuckBatch(batchId)` (atomic accounting).
   - Otherwise → `vision.claimRefundFor(batchId, player)`.
6. Log it. Sleep. Wake up. Do it again.

It double-checks `getPosition(batchId, player).totalDeposited` immediately before
each send. If another keeper got there first, it skips. No double broadcast.

## Setup

```bash
cd vision-keeper
npm install
npm run typecheck
npm run build
```

## Run

```bash
KEEPER_PRIVATE_KEY=0x... \
L3_RPC_URL=https://rpc.generalmarket.io/ \
node dist/index.js
```

Or for development:

```bash
npm run dev
```

## Environment

| Var | Default | Notes |
|---|---|---|
| `KEEPER_PRIVATE_KEY` | required | 32-byte hex, with or without `0x`. Pays gas. Receives nothing. |
| `L3_RPC_URL` | `https://rpc.generalmarket.io/` | Index L3 RPC. |
| `POLL_INTERVAL_SECS` | `60` | Time between sweeps. |
| `LOOKBACK_SECONDS` | `604800` | How far back to look for stuck batches. |
| `KEEPER_HEALTH_PORT` | `9201` | `GET /health` returns liveness JSON. |
| `VAULT_REFRESH_SECS` | `900` | How often to re-pull `getAllVaults()`. |
| `LOG_EVENT_CHUNK` | `5000` | Block range per `eth_getLogs`. Tune for the RPC. |
| `DEPLOYMENT_JSON` | auto | Path override for `active-deployment.json`. |

The keeper reads contract addresses from `deployments/active-deployment.json`
(also tries `contracts/deployments/...` and `envs/testnet/...`). Override with
`DEPLOYMENT_JSON=/abs/path.json` if you must.

## Health

```
GET http://127.0.0.1:9201/health
```

Returns:

```json
{
  "ok": true,
  "startedAt": 1777126015,
  "lastTickAt": 1777126075,
  "lastError": null,
  "rescuedThisRun": 0,
  "rescuedTotal": 3,
  "knownVaults": 9
}
```

`lastError` is sticky — it's the most recent failure, not the current one. If
`lastTickAt` stops advancing, the loop is stuck.

## systemd (VPS 1)

```ini
# /etc/systemd/system/vision-keeper.service
[Unit]
Description=Vision refund keeper
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=max
WorkingDirectory=/home/max/index/vision-keeper
EnvironmentFile=/home/max/index/vision-keeper/.env
ExecStart=/usr/bin/node /home/max/index/vision-keeper/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Then `sudo systemctl enable --now vision-keeper`. Logs via `journalctl -u vision-keeper -f`.

## What it won't do

- It will not settle batches. Settlement is the oracle's job — and its right, until
  the grace expires.
- It will not refund a settled batch. That would revert anyway.
- It will not pay you for running it. Refunds go to the player, gas comes from you.
  This is infrastructure, not yield.

## Running multiple keepers

Two keepers on two VPS will both notice a stuck batch. Both will broadcast.
One transaction wins. The losers revert with a no-op error and the loop keeps going.
The on-chain idempotency check (`totalDeposited == 0` after the winner) does the
work. Run as many as you want. Redundancy is the point.
