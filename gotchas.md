# Gotchas

Patterns that bit us. Written to prevent repeats.

## Infrastructure

- **Disk full on a shared host is never one failure**. Postgres dies, pgbouncer caches connections and keeps reporting healthy, data-node swallows stale reads, oracles starve silently. When the disk recovers, every DB on that host — Postgres, Blockscout's private PG, Nitro's pebble/freezer, RocksDB, anything that writes — must be integrity-checked. The Apr 12 outage broke Postgres and Nitro's freezer tables. Recovery fixed the first, missed the second for three days.
- **"Healthy" heartbeats lie when the work is zero**. `orders_processed=0 health_status=healthy` is not health. Every long-lived service must expose a `did-you-do-work` endpoint that tracks throughput over a window. Presence of process ≠ presence of function.
- **Docker default log driver has no size cap**. A single nginx proxy container filled 65 GB on VPS 1 before we noticed. Install `/etc/logrotate.d/docker-container` on every host that runs Docker, use `copytruncate`, 50 MB × 5.
- **pgbouncer reports healthy while its upstream is dead**. It answers its own TCP handshake. Real health is `SELECT 1` round-tripping to the backend.

## Configuration

- **Mock exchange against real chain is a distinct failure class**. If `exchange_mode=mock` while `chain_mode=real`, fail-fast at startup. Never trust manual env correctness across environment switches. The AP spent days flipping testnet orders through a mock Bitget because nobody wired the interlock.
- **Docker Compose `${VAR}` in `environment:` interpolates from HOST shell, not `env_file`**. Unsourced variables silently become empty strings. Use `env_file:` exclusively for secrets; `environment:` only for static values.
- **env_file layering order matters**. Load `.env` then `system.env` as override. If reversed, secrets from `system.env` get stomped. Data-node lost Bitget creds this way.

## Oracles & Consensus

- **Log lines like `INFO ... signer_count=0 ... consensus agreed` are placeholders, not facts**. Verify against on-chain state (emitted events, stored signatures) before concluding BLS is bypassed. The Apr 14 investigation wasted hours here until `cast logs` confirmed real signatures. Fix the log, don't the code — but fix the log. NAV branch done (`ee97857a`), price branch pending.
- **Oracle P2P WAL is unbounded by default**. Errors `INFRA-022 WAL exceeded 10 MB, disabling writes` mean replay recovery is now broken. Add disk-bounded rotation before it degrades silently.

## Events & Ordering

- **`N` events vs `nextOrderId=N+1` is the correct invariant, not a bug**. `nextOrderId` is the ID that will be assigned next. The Apr 14 "111 ghost orderIds vs 112 nextOrderId" panic was just the off-by-one. Always subtract one before claiming a gap.

## MetaMorpho / Curator

- **"Wrong address" can mean "no address"**. If `eth_getCode` returns `0x` at the vault you're curating, the vault was never deployed — not redeployed elsewhere. Curator must check code length at startup and refuse to run against zero-code addresses.

## Chain-level

- **Nitro freezer table corruption survives container restart**. A clean Docker restart loop on `orbit-l3-testnet-sequencer-1` with `Failed to open database: freezer table ... is corrupted` means the pebble DB's ancient segments are torn. Only fixes: restore snapshot, or full L1 resync. No config edit will help.

## Parallel Agents

- **`git add` then `git commit` is not safe when multiple agents share the working tree**. The index is shared state. Agent A stages its file, Agent B stages its file before A commits, then A's `git commit` sweeps both into one commit — and B's later `git commit` finds nothing to do. Symptom from May 4 swarm: the UpNextRail diff landed inside the OnboardingCompass agent's commit (`7e6da13d`), with the wrong subject line. Work shipped, attribution drifted. Fix: every agent uses the atomic form — `git commit -m "<msg>" -- <path>` — which stages and commits the named paths in one operation. The index outside those paths is left untouched. No `git add` step at all.
