#!/usr/bin/env bash
# vision-lifecycle-watchdog — flag vision sources whose heartbeat has stalled.
#
# A source is "stuck" if last_heartbeat_at + 2 * tick_duration_secs < NOW().
# That means it has missed two consecutive ticks, which after the
# rewind-on-failure patch can only happen if the rewind itself failed or
# the on-chain reverts are persistent (bad BLS, wrong nonce, oracle down).
#
# Designed to run on VPS 1 as a systemd timer or cron:
#   * * * * * /home/max/index/scripts/vision-lifecycle-watchdog.sh >> /home/max/index/logs/lifecycle-watchdog.log 2>&1
#
# Exits 0 always — never block a cron. The output is the signal.

set -euo pipefail

PG_PASSWORD="${PG_PASSWORD:-m_f310f8cc478d54483105863917900d31}"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-6432}"
PG_USER="${PG_USER:-max}"
PG_DB="${PG_DB:-index_prices}"

ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

stuck=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -At -F '|' -c "
  SELECT
    source_name,
    tick_duration_secs,
    EXTRACT(EPOCH FROM NOW() - last_heartbeat_at)::int AS lag_secs,
    current_batch_id IS NULL AS no_current
  FROM vision_source_state
  WHERE tick_duration_secs > 0
    AND last_heartbeat_at + make_interval(secs => tick_duration_secs * 2) < NOW()
  ORDER BY lag_secs DESC;
" 2>/dev/null)

if [[ -z "$stuck" ]]; then
  echo "[$ts] lifecycle ok"
  exit 0
fi

echo "[$ts] STUCK sources (missed two consecutive ticks):"
while IFS='|' read -r name tick lag nocur; do
  [[ -z "$name" ]] && continue
  echo "  $name  tick=${tick}s  lag=${lag}s  no_current_batch=${nocur}"
done <<< "$stuck"
