# Infrastructure

**TL;DR.** 3 VPS in Netcup Nürnberg. Direct SSH on port 3189 as root. No bastion. RTT 0.4–0.6 ms between them over UFW-gated public IPs. Full host inventory in `vps.md`.

## VPS inventory

| Role | IP | SSH alias |
|------|-----|-----------|
| VPS 1 backend | 159.195.78.238 | `index-maker/prod/be` |
| VPS 2 chain + AP | 159.195.79.153 | `index-maker/prod/postgres` |
| VPS 3 frontend + Solana | 159.195.77.160 | `vps3`, `index-maker/prod/fe` |

NIC is `eth0`. Sudo: root user, no password (Netcup direct-SSH model).

## Wallet RPC URL

The dapp force-pushes `https://rpc.generalmarket.io/` to the wallet's stored chain config once per browser. Done via `ensureWalletRpcRefreshed` in `frontend/lib/wagmi.ts`, gated on `WALLET_RPC_REWRITE_VERSION`.

**Bump that constant when the canonical URL changes.** Wallets cache aggressively and otherwise hold a stale value forever.

## Networks

| Network | Chain ID | RPC | Collateral |
|---------|----------|-----|------------|
| Index L3 (Orbit) | 111222333 | https://rpc.generalmarket.io/ (nginx+LE on VPS 2, or http://159.195.79.153/ direct) | GM (18 dec) |
| Local Settlement (Anvil) | 421611337 | http://localhost:8546 | — |

## Frontend HTTPS origins

Added 2026-04-21 for browser preconnect + mixed-content fix.

- `https://rpc.generalmarket.io` → VPS 2 L3 RPC / Blockscout. `/ap` route → AP service on `:9100`.
- `https://api.generalmarket.io` → VPS 1 data-node / oracle1-3 / explorer.

Both use Let's Encrypt DNS-01 via Cloudflare token at `/root/.secrets/cloudflare-dns.ini`. DNS-only (gray-cloud). Renewals on `certbot.timer`.

## Environment switching

```bash
./switch-env.sh local    # Local Anvil dev
./switch-env.sh testnet  # VPS testnet
./switch-env.sh mainnet  # Future
```

Copies `envs/{env}/.env` → `frontend/.env.local` and syncs 3 deployment JSONs. `.active-env` tracks current.

**Config sources of truth:**

- Frontend server-side URLs → `frontend/lib/config.ts`. API routes import from there. Never read `process.env` directly.
- E2E config → `frontend/e2e/env.ts`. Helpers and specs import from there.
- Flag: `IS_ANVIL` (not `IS_TESTNET`) — true against local Anvil.

After a local contract deploy, `start.sh` syncs deployment JSONs back to `envs/local/`. After testnet deploy, `testnet.sh` syncs back to `envs/testnet/`.

## Common file paths

- VPS 1 repo: `/home/max/index`
- Issuer key files: write with `printf "%s" "0xKEY" > /tmp/issuer-key-N.txt`. Shell variable expansion through SSH breaks with single quotes.

## Nginx

All three VPS run nginx for external-facing connections. Never expose raw ports externally. Use nginx for HTTPS termination + reverse proxy.
