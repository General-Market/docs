# Oracles

**TL;DR.** Oracles run only on VPS, never locally. Ethereum L3 BLS oracles run on VPS 1 via Docker Compose.

## Do not

- Do not create local oracle startup scripts.
- Do not test oracles on localhost.

## Ethereum L3 BLS oracles

All EVM-side oracle infrastructure lives in `docker/testnet/oracle/` and runs via Docker Compose on **VPS 1**.

| Action | Command |
|--------|---------|
| SSH | `ssh index-maker/prod/be` |
| Logs | `docker logs oracle-1 --tail 100` (oracle-1, oracle-2, oracle-3) |
| Restart | `cd /home/max/index && docker compose -f docker/testnet/oracle/docker-compose.yml restart` |

Full host inventory in `vps.md`.
