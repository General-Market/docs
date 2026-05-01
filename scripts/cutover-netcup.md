# Hetzner → Netcup cutover runbook

Single-flight playbook. Read once. Execute the cutover sections in a single window with eyes on the chain. Each section says exactly which keystrokes are irreversible and which are not.

## Targets

| Role | Old (Hetzner) | New (Netcup) |
|------|---------------|--------------|
| VPS 1 backend | 116.203.156.98 (`vps1-old`) | 159.195.78.238 (`vps1-new`) |
| VPS 2 chain | 142.132.164.24 (`vps2-old`) | 159.195.79.153 (`vps2-new`) |
| VPS 3 frontend + Solana | 178.104.243.94 (`vps3-old`) | 159.195.77.160 (`vps3-new`) |

DNS goal:
```
generalmarket.io       A → 159.195.77.160 (VPS 3)
www.generalmarket.io   A → 159.195.77.160
rpc.generalmarket.io   A → 159.195.79.153 (VPS 2)
api.generalmarket.io   A → 159.195.78.238 (VPS 1)
nsgame.org             A → 159.195.77.160
www.nsgame.org         A → 159.195.77.160
```

## Pre-flight (already done — verify only)

- [x] LE certs present on all three new boxes (`api.generalmarket.io`, `rpc.generalmarket.io`, `generalmarket.io`, `nsgame.org`).
- [x] nginx vhosts installed and reload-clean on all three new boxes.
- [x] Dokploy DB on new VPS 3 carries the same `frontend` and `nsgame` apps with the same SSH key id `O4QYFym70Ho1zoX191GC3`.
- [x] Postgres `index_prices` and `data_node` databases restored on new VPS 1 (klines as of 2026-05-01 14:02 UTC at restore time — fresh poll on data-node start will fill the gap).
- [x] Sequencer chain volume staged at `/home/max/sequencer-data-stage/` on new VPS 2 (3.3 GB, 179 files).
- [x] data-node + oracle binaries built at `/home/max/index/target/release/` on new VPS 1.
- [x] All required config/data files copied (assets.json, deployments/*.json, fund-branding.json, sources-display.json, symbol-map.json, data-node/migrations).
- [x] CF token at `/root/.secrets/cloudflare-dns.ini` (mode 600) on all three new boxes.
- [x] Solana binaries `/usr/local/bin/{prediction-market-oracle,prediction-indexer,nsgame-data-node}` installed on new VPS 3, units present but disabled.

## Step A — deploy frontend + nsgame on new VPS 3 (already triggered)

These do not impact production until DNS flips.

```bash
ssh vps3-new 'curl -s -X POST "http://127.0.0.1:3000/api/deploy/hDH6dhH6bGa-P0sbD684_" \
  -H "X-GitHub-Event: push" -H "Content-Type: application/json" \
  -d "{\"ref\":\"refs/heads/main\"}"'
ssh vps3-new 'curl -s -X POST "http://127.0.0.1:3000/api/deploy/sbIOAWK7EU0hkMneh7skz" \
  -H "X-GitHub-Event: push" -H "Content-Type: application/json" \
  -d "{\"ref\":\"refs/heads/main\"}"'
```

Watch:

```bash
ssh vps3-new 'sudo docker exec $(sudo docker ps --filter name=dokploy-postgres --format "{{.Names}}" | head -1) \
  psql -U dokploy -d dokploy -c "SELECT \"deploymentId\", LEFT(title,40), status FROM deployment ORDER BY \"createdAt\" DESC LIMIT 5;"'
ssh vps3-new 'sudo docker ps --filter name=app- --format "{{.Names}}\t{{.Status}}"'
ssh vps3-new 'sudo docker ps --filter name=nsgame --format "{{.Names}}\t{{.Status}}"'
```

Expect after ~10 min: containers running, Traefik returning `200` instead of `404`:

```bash
ssh vps3-new 'curl -sI -H "Host: generalmarket.io" http://127.0.0.1:8080/ | head -5'
ssh vps3-new 'curl -sI -H "Host: nsgame.org" http://127.0.0.1:8080/ | head -5'
```

## Step B — bring up the L3 chain on new VPS 2 (irreversible: 30s pause)

Final delta rsync. Needs sudo on old VPS 2 (`ans` / password from vps.md).

```bash
# On old VPS 2 — STOP the sequencer, then push final state.
ssh vps2-old
sudo systemctl stop docker  # or: sudo docker stop orbit-l3-testnet-sequencer-1
sudo rsync -aHAX --delete \
  -e "ssh -p 3189" \
  /var/lib/docker/volumes/orbit-l3-testnet_sequencer-data/_data/ \
  root@159.195.79.153:/home/max/sequencer-data-stage/
```

Populate the Docker volume on new VPS 2 and start:

```bash
ssh vps2-new
docker volume create orbit-l3-testnet_sequencer-data
cp -a /home/max/sequencer-data-stage/. \
  /var/lib/docker/volumes/orbit-l3-testnet_sequencer-data/_data/
chown -R 1000:1000 /var/lib/docker/volumes/orbit-l3-testnet_sequencer-data/_data
cd /home/max/orbit-l3-testnet
docker compose up -d
sleep 15
curl -s -X POST http://127.0.0.1:3001 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}'
```

Expected: a hex block number that increments on subsequent calls. If `null` or empty, the sequencer didn't pick up the volume — check `docker compose logs sequencer --tail 100` for chain config errors.

## Step C — install systemd units on new VPS 1

Templates ready at `/Users/maxguillabert/Downloads/index/scripts/systemd/` (see Step C.1 below — generate locally, scp to new box).

C.1 generate:

```bash
mkdir -p /Users/maxguillabert/Downloads/index/scripts/systemd
```

`testnet-data-node.service`:
```ini
[Unit]
Description=Index data-node
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=max
WorkingDirectory=/home/max/index
EnvironmentFile=/home/max/index/system.env
EnvironmentFile=/home/max/index/data-node/.env
ExecStart=/home/max/index/target/release/data-node serve \
  --database-url postgres://max@localhost/index_prices \
  --symbol-map /home/max/index/data/symbol-map.json \
  --rpc-url https://rpc.generalmarket.io/ \
  --settlement-rpc-url http://127.0.0.1:8547 \
  --deployment-file /home/max/index/deployments/active-deployment.json \
  --morpho-deployment-file /home/max/index/deployments/morpho-e2e.json \
  --openmeteo-sync-interval 300 \
  --index-address 0x3eb3bbbad5aa815d408fc06fb44ff2011b99c4ba \
  --explorer-token 20b8dfdd244827f7a88d31dbe96b448938f1731437a9340e3a616ba63f2dc267 \
  --oracle-health-urls http://127.0.0.1:10001,http://127.0.0.1:10002,http://127.0.0.1:10003 \
  --oracle-health-poll-interval 60 \
  --sources-display-file /home/max/index/frontend/data/sources-display.json
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

`testnet-oracle@.service` (templated, `1`/`2`/`3`):
```ini
[Unit]
Description=Index oracle %i
After=network.target testnet-data-node.service
Wants=testnet-data-node.service

[Service]
Type=simple
User=max
WorkingDirectory=/home/max/index
EnvironmentFile=/home/max/index/system.env
Environment=BLS_KEY_SEED_INDEX=%I_MINUS_ONE
ExecStartPre=/usr/bin/printf "%%s" "${ORACLE_PRIVATE_KEY_HEX_%i}" >/tmp/oracle-key-%i.txt
ExecStartPre=/bin/chmod 600 /tmp/oracle-key-%i.txt
ExecStart=/home/max/index/target/release/oracle \
  --node-id %i --port 900%i --rpc https://rpc.generalmarket.io/ \
  --cycle-duration-ms 1500 --min-cycle-gap-ms 50 \
  --consensus-timeout-ms 1200 --no-tls --test-key-seeds \
  --bls-key-seed-index ${BLS_SEED_%i} --num-oracles 3 \
  --registry-sync --data-node-url http://localhost:8200 \
  --deployment-file /home/max/index/deployments/active-deployment.json \
  --symbol-map-file /home/max/index/data/symbol-map.json \
  --wal-path /home/max/index/logs/consensus-%i.wal \
  --log-level info --from-block 851169 --sign-timeout-ms 5000 \
  --itp-id 0x0000000000000000000000000000000000000000000000000000000000000001 \
  --bridge-proxy 0x19d9F7A778A30f8a73158Be5028C19571D9102d5 \
  --settlement-custody 0x9632509C878Fccb37Ec314d5FaC57bbA951F93b2 \
  --vision-enabled --vision-address 0x94d540bb45975bd5a0c7ba9a15a0d34e378f6c61 \
  --vision-database-url postgres://max@localhost/index_prices \
  --vision-data-node-url http://localhost:8200 \
  --vision-rpc-ws-url https://rpc.generalmarket.io/ \
  --vision-settlement-bridge-custody 0x9632509C878Fccb37Ec314d5FaC57bbA951F93b2 \
  --vision-settlement-rpc-url http://127.0.0.1:8547
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

These are templates — the `%I_MINUS_ONE`, `BLS_SEED_*`, and `ORACLE_PRIVATE_KEY_HEX_*` vars need to be sourced from the existing testnet-oracle-N container env. Per the migration plan, the simpler path is `docker run` the same images on new VPS 1 with a copied compose override.

**Recommended: copy the existing oracle docker-compose to new VPS 1.**

```bash
ssh vps1-old 'sudo tar czf /tmp/oracle-compose.tgz -C /home/max/index/docker/testnet/oracle .'
scp -P 3189 max@116.203.156.98:/tmp/oracle-compose.tgz /tmp/oracle-compose.tgz
scp -P 3189 /tmp/oracle-compose.tgz vps1-new:/home/max/index/docker/testnet/oracle/
ssh vps1-new 'cd /home/max/index/docker/testnet/oracle && tar xzf oracle-compose.tgz'
# Edit any URLs referencing 142.132.164.24 → http://127.0.0.1:3001 (now the L3 lives on this same VPS via SSH tunnel?)
# Actually — VPS 1 doesn't have L3 locally. Oracles must hit either:
#   - https://rpc.generalmarket.io (after DNS flip) — recursive risk
#   - http://159.195.79.153 directly (new VPS 2) — preferred, bypasses DNS
# Edit ORACLE_RPC_URL=http://159.195.79.153/ in the compose env.
ssh vps1-new 'cd /home/max/index/docker/testnet/oracle && sudo docker compose up -d'
```

## Step D — start data-node first, watch lag, THEN flip oracles (rolling)

```bash
# Start data-node on new VPS 1
ssh vps1-new 'cd /home/max/index/docker/testnet/data-node && sudo docker compose up -d'
# OR for systemd path:
ssh vps1-new 'sudo systemctl daemon-reload && sudo systemctl enable --now testnet-data-node.service'

# Watch klines fresh — wait until max(open_time) < 60s old
watch -n 5 "ssh vps1-new 'sudo -u postgres psql -d index_prices -tAc \"SELECT EXTRACT(EPOCH FROM (NOW() - max(open_time))) FROM klines;\"'"
```

Once lag stable < 60s, rotate oracles one at a time:

```bash
# Oracle 1
ssh vps1-old 'sudo docker stop testnet-oracle-1'
ssh vps1-new 'cd /home/max/index/docker/testnet/oracle && sudo docker compose up -d oracle-1'
sleep 30
# Confirm chain still progressing
curl -s -X POST http://142.132.164.24/ -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}'
# If chain stuck > 60s → rollback: ssh vps1-old 'sudo docker start testnet-oracle-1'
```

Repeat for oracle-2, oracle-3.

Then drain the rest:
```bash
ssh vps1-old 'sudo docker stop testnet-data-node fund-manager testnet-itp-bot testnet-curator testnet-sonic-proxy'
ssh vps1-new 'cd /home/max/index/docker/testnet/{fund-manager,itp-bot,curator,sonic-proxy} && sudo docker compose up -d'
```

## Step E — AP + sequencer fully cut over on new VPS 2

```bash
ssh vps2-old 'sudo docker stop testnet-ap'
ssh vps2-new 'cd /home/max/index/ap && sudo docker compose up -d'
# AP env: DATA_NODE_URL=http://159.195.78.238:8200, RPC_URL=http://localhost:8547
```

## Step F — Solana stack (single shot)

```bash
ssh vps3-old 'systemctl stop prediction-oracle prediction-indexer nsgame-data-node nsgame-bot'
ssh vps3-new 'systemctl enable --now prediction-oracle prediction-indexer nsgame-data-node nsgame-bot'
ssh vps3-new 'journalctl -u prediction-indexer --since "3 minutes ago" -n 30'
```

## Step G — DNS swap via Cloudflare

```bash
TOKEN=cfut_zrNlvMT7Xmnho9fqhcBImkJwtC2GEfyOS05zV1oK1a6cb659
update_record() {
  local zone="$1" name="$2" ip="$3"
  ZID=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "https://api.cloudflare.com/client/v4/zones?name=$zone" | jq -r '.result[0].id')
  RID=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "https://api.cloudflare.com/client/v4/zones/$ZID/dns_records?name=$name&type=A" | jq -r '.result[0].id')
  curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones/$ZID/dns_records/$RID" \
    --data "{\"content\":\"$ip\",\"ttl\":60}"
  echo
}
update_record generalmarket.io generalmarket.io       159.195.77.160
update_record generalmarket.io www.generalmarket.io   159.195.77.160
update_record generalmarket.io rpc.generalmarket.io   159.195.79.153
update_record generalmarket.io api.generalmarket.io   159.195.78.238
update_record nsgame.org       nsgame.org             159.195.77.160
update_record nsgame.org       www.nsgame.org         159.195.77.160
```

## Step H — verification

```bash
dig +short generalmarket.io @1.1.1.1
dig +short rpc.generalmarket.io @1.1.1.1
dig +short api.generalmarket.io @1.1.1.1
dig +short nsgame.org @1.1.1.1

curl -sI https://generalmarket.io | head -3
curl -sI https://nsgame.org | head -3
curl -s -X POST https://rpc.generalmarket.io \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}'   # → 0x6a1f3a3
curl -s https://api.generalmarket.io/data-node/explorer/health | head

ssh vps3-new 'journalctl -u prediction-indexer --since "5 minutes ago" -n 20'
ssh vps3-new 'journalctl -u nsgame-bot --since "5 minutes ago" -n 20'
```

## Step I — persist new state

```bash
cd /Users/maxguillabert/Downloads/index
# Update vps.md and CLAUDE.md to reflect new IPs
# Update ~/.ssh/config so canonical aliases point at new IPs
git add vps.md CLAUDE.md
git commit -m "vps(migration): cut over from Hetzner to Netcup"
git push mono main
```

## Rollback windows

- DNS flip — instant rollback by re-pointing to old IPs (TTL 60s).
- Oracle rotation — start old container back, pull-the-new oracle out.
- Sequencer cutover — restart old sequencer; only safe if the new one wrote fewer than ~10 blocks.
- Solana stop/start — `systemctl start` on the old box, no chain risk.

## Post-cutover

- Hetzner boxes stay up for **at least one week**. Rollback window costs €X/week. Cheap.
- Cancel old VPS only after 7 days of green canaries.

## Known degradations

- Klines history on new VPS 1 has a gap from snapshot moment to data-node start. Bitget polls will fill ~last hour from REST; older data stays only in pg_dumps. Acceptable.
- Vision sources may show one missing tick across the cutover boundary. The chain itself does not freeze longer than ~30s.

The migration is rote. The chain is an animal — feed it slowly. If anything resists, stop. Old box still works.
