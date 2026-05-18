# VPS 3 — operator bootstrap

Three rituals. Perform them in order on a fresh box, or whenever drift returns.

## 1. Apply pg_hba rules

Postgres on VPS 3 hosts `prediction_market_indexer` and `nsgame_data_node`.
Containers reach it over the docker bridge; the data-node binary reaches it
over the private network. The script reads the current `pg_hba.conf`, appends
only what is missing, and reloads. Running it twice changes nothing.

```bash
bash scripts/sync-vps3-pg-hba.sh
```

## 2. Deploy the data-node

VPS 3 holds only `common/` and `data-node/`. The mono `Cargo.toml` lists
members that do not exist on the box; cargo refuses to build until told the
truth. `Cargo.vps3.toml` is that truth — a slim workspace listing only the
two members VPS 3 actually has. The deploy script syncs source, installs the
slim manifest, builds release, and restarts the systemd unit.

```bash
bash scripts/deploy-data-node.sh
```

## 3. Install nightly Postgres backups

The indexer DB is rebuildable from chain — slowly. The data-node DB is not.
Deep history from the upstream sources does not exist anywhere else. Lose
the volume without a backup and the observation record dies with it.

Install script and cron entry:

```bash
scp -P 3189 scripts/vps3-backup.sh root@178.104.243.94:/root/scripts/
ssh vps3 'chmod +x /root/scripts/vps3-backup.sh && (crontab -l 2>/dev/null; echo "30 4 * * * /root/scripts/vps3-backup.sh") | crontab -'
```

Verify the cron is in place:

```bash
ssh vps3 'crontab -l | grep vps3-backup'
```

Force one run to confirm the dump path is writable:

```bash
ssh vps3 '/root/scripts/vps3-backup.sh && tail -n 5 /var/log/vps3-backup.log'
```

## Retention and recovery

- Dumps live in `/var/backups/postgres/` on VPS 3.
- Retention: 14 days. Older files are removed by the same script.
- Restore: `gunzip -c <file>.sql.gz | sudo -u postgres psql <dbname>`.

Backups are not infrastructure. They are penance for assuming the box will
keep working.
