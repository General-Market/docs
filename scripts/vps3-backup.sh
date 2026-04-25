#!/bin/bash
#
# Nightly Postgres backup for VPS 3.
#
# Deploy:
#   scp -P 3189 scripts/vps3-backup.sh root@178.104.243.94:/root/scripts/
#   ssh vps3 'chmod +x /root/scripts/vps3-backup.sh'
#
# Cron (run on VPS 3, not locally):
#   30 4 * * * /root/scripts/vps3-backup.sh
#
# Two databases worth saving:
#   prediction_market_indexer  — indexer event history. Rebuildable from chain,
#                                slowly. A backup turns 12 hours of replay into
#                                a 2-minute restore.
#   nsgame_data_node           — data-node observations. Not rebuildable. The
#                                upstream sources do not expose deep history.
#                                Lose this and you lose it for good.
#
# Retention: 14 days. Anything older gets incinerated.

set -euo pipefail

BACKUP_DIR="/var/backups/postgres"
LOG_FILE="/var/log/vps3-backup.log"
RETENTION_DAYS=14
DATE="$(date +%F)"
TIMESTAMP="$(date +'%F %T')"

mkdir -p "${BACKUP_DIR}"

log() {
  echo "[${TIMESTAMP}] $*" >> "${LOG_FILE}"
}

dump() {
  local DB="$1"
  local OUT="${BACKUP_DIR}/${DB}-${DATE}.sql.gz"
  if sudo -u postgres pg_dump "${DB}" | gzip > "${OUT}"; then
    log "ok ${DB} -> ${OUT} ($(stat -c%s "${OUT}") bytes)"
  else
    log "FAIL ${DB}"
    return 1
  fi
}

FAILED=0
dump "prediction_market_indexer" || FAILED=1
dump "nsgame_data_node"          || FAILED=1

# Retention sweep. -mtime +N matches files modified more than N days ago.
find "${BACKUP_DIR}" -type f -name 'indexer-*.sql.gz'         -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -type f -name 'nsgame-data-node-*.sql.gz' -mtime +${RETENTION_DAYS} -delete

if [ "${FAILED}" -eq 0 ]; then
  log "retention sweep done; ${RETENTION_DAYS}-day window held"
  exit 0
else
  log "one or more dumps failed; investigate"
  exit 1
fi
