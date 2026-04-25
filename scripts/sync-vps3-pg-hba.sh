#!/bin/bash
#
# Idempotently apply the pg_hba.conf rules nsgame needs on VPS 3.
#
# Postgres on VPS 3 serves two databases that talk to containers and to the
# data-node binary:
#   prediction_market_indexer  (role: indexer)        — Solana event indexer
#   nsgame_data_node           (role: nsgame_dn)      — data-node observations
#
# Containers reach Postgres over the docker bridge (172.17.x, 172.18.x). The
# binary, when run outside docker, comes in over the private network (10.x).
# This script reads the current pg_hba.conf, appends any missing rule from the
# desired set, and reloads Postgres. Running it twice is a no-op.
#
# Usage: bash scripts/sync-vps3-pg-hba.sh
# Requires SSH config alias `vps3` (port 3189, root).

set -euo pipefail

PG_HBA="/etc/postgresql/17/main/pg_hba.conf"

read -r -d '' DESIRED_RULES <<'EOF' || true
# nsgame: indexer DB, docker bridge + private network
host    prediction_market_indexer    indexer      172.17.0.0/16    scram-sha-256
host    prediction_market_indexer    indexer      172.18.0.0/16    scram-sha-256
host    prediction_market_indexer    indexer      10.0.0.0/8       scram-sha-256
# nsgame: data-node DB, docker bridge + private network
host    nsgame_data_node             nsgame_dn    172.17.0.0/16    scram-sha-256
host    nsgame_data_node             nsgame_dn    172.18.0.0/16    scram-sha-256
host    nsgame_data_node             nsgame_dn    10.0.0.0/8       scram-sha-256
EOF

# Each rule is a single line. Hand them to the remote host one by one and let
# it decide whether the line is already there.
APPENDED=0
while IFS= read -r RULE; do
  # Skip blank lines and comments.
  [[ -z "${RULE// }" ]] && continue
  [[ "$RULE" =~ ^# ]] && continue

  # grep -F: literal match. -q: quiet. Exit 0 when present, 1 when absent.
  if ssh vps3 "sudo grep -Fq -- $(printf '%q' "$RULE") '${PG_HBA}'"; then
    echo "[sync-pg-hba] present: ${RULE}"
  else
    echo "[sync-pg-hba] appending: ${RULE}"
    ssh vps3 "echo $(printf '%q' "$RULE") | sudo tee -a '${PG_HBA}' >/dev/null"
    APPENDED=$((APPENDED + 1))
  fi
done <<< "$DESIRED_RULES"

if [ "$APPENDED" -gt 0 ]; then
  echo "[sync-pg-hba] reloading postgresql (${APPENDED} new rules)"
  ssh vps3 'sudo systemctl reload postgresql'
else
  echo "[sync-pg-hba] no changes; skipping reload"
fi

echo "[sync-pg-hba] done"
