#!/usr/bin/env bash
# Deploy PgBouncer on VPS 2, then update data-node to connect through it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VPS2="index-maker/prod/postgres"
VPS1="index-maker/prod/be"
REMOTE_DIR="/home/max/index/docker/testnet/pgbouncer"

echo "=== 1. Sync PgBouncer config to VPS 2 ==="
ssh "$VPS2" "mkdir -p $REMOTE_DIR"
scp "$SCRIPT_DIR/pgbouncer.ini" "$VPS2:$REMOTE_DIR/pgbouncer.ini"
scp "$SCRIPT_DIR/userlist.txt"  "$VPS2:$REMOTE_DIR/userlist.txt"
scp "$SCRIPT_DIR/docker-compose.yml" "$VPS2:$REMOTE_DIR/docker-compose.yml"

echo "=== 2. Start PgBouncer on VPS 2 ==="
ssh "$VPS2" "cd $REMOTE_DIR && docker compose up -d"

echo "=== 3. Wait for PgBouncer health ==="
for i in $(seq 1 10); do
    if ssh "$VPS2" "pg_isready -h 127.0.0.1 -p 6432 2>/dev/null"; then
        echo "PgBouncer is ready on port 6432"
        break
    fi
    echo "Waiting... ($i/10)"
    sleep 2
done

echo "=== 4. Verify PgBouncer can reach Postgres ==="
ssh "$VPS2" "psql -h 127.0.0.1 -p 6432 -U max -d index_prices -c 'SELECT 1 AS pgbouncer_ok;'" || {
    echo "ERROR: PgBouncer cannot reach Postgres"
    exit 1
}

echo ""
echo "=== PgBouncer deployed ==="
echo "Services should now connect to: postgres://max@159.195.79.153:6432/index_prices"
echo ""
echo "To update data-node, edit docker-compose.override.yml:"
echo "  --database-url postgres://max@159.195.79.153:6432/index_prices"
echo "Then restart: docker compose -f ... down && docker compose -f ... up -d"
