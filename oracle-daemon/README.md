# prediction-market-oracle

Stateless oracle daemon for the Solana prediction-market program. Closes markets
at their close time, resolves them at settlement, cranks claims for every
resolved position. Users never click.

Nothing is cached. Chain is the source of truth. The only persistent artifact
on disk is the ed25519 keypair.

## What it does

Every `POLL_INTERVAL_SECS` the daemon asks the RPC three questions:

1. Which `Market` accounts have `baseline_price == 0` and `close_time <= now`?
   Submit `close_market(baseline, sig)`.
2. Which `Market` accounts have `baseline_price > 0`, `!resolved`, and
   `settlement_time <= now`? Submit `resolve_market(final, sig)`.
3. Which `Position` accounts are attached to a resolved `Market`? Submit
   `claim(position)` — payout and rent flow to `position.owner`.

The signed payloads are 29 bytes each, domain-tagged to prevent replay across
the two oracle ixs:

```
close:   source_id(4 LE) || close_time(8 LE)      || baseline_price(16 LE) || 0x01
resolve: source_id(4 LE) || settlement_time(8 LE) || final_price(16 LE)    || 0x02
```

Signatures are ed25519 over these bytes. Submission attaches a hand-built
ed25519 precompile instruction ahead of the program ix.

## Data-node contract

The daemon fetches prices from a data-node via HTTP:

```
GET {DATA_NODE_URL}/v1/sources/{source_id}/price
→ 200 OK
{
  "price": "1000000000000000000",   // or a numeric literal ≤ 2^63-1
  "ts":    1700000000
}
```

`price` is a `u128` normalized to 1e18 decimals (SA9). Accepted as either a
JSON number (when representable in `u64`) or a decimal string.

## Environment

All configuration is environment-driven.

| Variable | Required | Default | Meaning |
|----------|----------|---------|---------|
| `RPC_URL` | yes | — | Solana RPC endpoint |
| `PROGRAM_ID` | no | `DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA` | Deployed program ID |
| `ORACLE_KEYPAIR` | yes | — | Path to Solana keypair JSON |
| `DATA_NODE_URL` | yes | — | Data-node base URL (no trailing slash) |
| `METRICS_PORT` | no | `9091` | Prometheus exporter bind port |
| `POLL_INTERVAL_SECS` | no | `30` | Seconds between chain scans |
| `MIN_SOL_BALANCE` | no | `0.1` | Boot floor; below → refuse to start |

## Metrics

The Prometheus exporter serves `/metrics` on `METRICS_PORT`. Series:

- `oracle_keypair_sol_balance` — current SOL balance of the daemon keypair.
- `markets_awaiting_close` — count at last scan.
- `markets_awaiting_resolve` — count at last scan.
- `markets_awaiting_claim` — count at last scan.
- `last_tx_success_ts` — unix timestamp of the last confirmed transaction.
- `tx_failures_total` — cumulative transaction failures since boot.

## Run

### Locally

```bash
cd oracle-daemon
cargo build --release
RPC_URL=http://localhost:8899 \
ORACLE_KEYPAIR=./oracle.json \
DATA_NODE_URL=http://localhost:8080 \
./target/release/prediction-market-oracle
```

### As a systemd service

1. `cargo build --release`
2. Copy the binary:
   ```bash
   sudo install -m 0755 target/release/prediction-market-oracle /usr/local/bin/
   sudo install -m 0755 deploy/preflight-balance.sh /usr/local/bin/oracle-preflight-balance.sh
   ```
3. Create the oracle user + state dir:
   ```bash
   sudo useradd --system --home /var/lib/prediction-oracle --create-home oracle
   sudo chmod 0700 /var/lib/prediction-oracle
   # Place the keypair JSON:
   sudo install -m 0400 -o oracle -g oracle /path/to/keypair.json \
        /var/lib/prediction-oracle/oracle-keypair.json
   ```
4. Install the unit and edit environment overrides to match your deployment:
   ```bash
   sudo cp deploy/systemd/prediction-oracle.service /etc/systemd/system/
   sudoedit /etc/systemd/system/prediction-oracle.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now prediction-oracle
   ```
5. Verify:
   ```bash
   systemctl status prediction-oracle
   curl -s localhost:9091/metrics | grep oracle_
   ```

## Tests

```bash
cargo test
```

Unit tests cover payload byte layout (cross-checked against the program's own
`build_close_payload`/`build_resolve_payload`), ed25519 precompile instruction
byte layout (cross-checked against `solana_ed25519_program`), identity
derivation, and scanner offset arithmetic. The integration test loads the
compiled program into LiteSVM, registers the daemon as the sole oracle signer,
places a bet, and drives the full close → resolve → claim lifecycle through the
daemon's own builders.

## Security notes

- The keypair's first 32 bytes are the ed25519 seed. The daemon derives the
  `SigningKey` from that seed and asserts `VerifyingKey::from_seed(seed) ==
  keypair.pubkey()` at boot. If that assertion ever fails, we refuse to sign.
- The daemon never accepts input from the network beyond the RPC and the
  data-node. It signs only the two payload shapes above.
- Below the SOL balance floor the process exits immediately. Systemd restarts
  it; the restart loop is visible to operators.

## What this daemon does not do

- No local baseline cache. Baselines live on the `Market` account between
  `close_market` and `resolve_market`.
- No tick history. Every price comes fresh from the data-node on demand.
- No market discovery file. `getProgramAccounts` is the discovery mechanism.
- No admin surface. Admin operations (pause, fee changes, signer rotation)
  happen via the program's own admin ixs.
