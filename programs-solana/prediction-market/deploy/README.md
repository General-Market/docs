# deploy

Scripts for landing the prediction-market program on devnet and arming its admin surface. Nothing here is executed by CI. An operator runs each step by hand. The program does not forgive. Neither do the scripts.

## prerequisites

- Solana CLI (`solana --version`)
- Anchor 1.0 — both the CLI and the TS client. The program is built against `anchor-lang = "1.0.0"`; this folder's `package.json` pins `@anchor-lang/core@1.0.0` to match
- Node.js >= 18 (for `npx ts-node`)
- A funded devnet keypair at `~/.config/solana/id.json` with at least 2 SOL
- An SPL mint on the target cluster to serve as `stake_mint` (USDC devnet, or a mint you control)
- A base58 pubkey for the oracle signer

Check them.

```bash
solana --version
anchor --version
solana address
solana balance
```

### version lockstep

The TS client talks to the on-chain program through the IDL. Different Anchor majors generate different IDL shapes, different account-resolution semantics, different event discriminators. A 0.30 client speaking to a 1.0 program fails quietly and then catastrophically.

If anyone ever bumps `anchor-lang` in `programs/prediction-market/Cargo.toml`, `deploy/package.json` MUST be bumped to the same version in the same commit. No exceptions. The program and its deploy client are a single artifact wearing two masks.

## run order

```
devnet.sh   →   bootstrap.sh   →   [24h wait]   →   activate-oracle.sh   →   daemon
```

Each step is a door that locks behind you.

### 1. `devnet.sh`

Sets the CLI to devnet, runs `anchor build`, deploys the `.so`, and copies the freshly generated IDL into `nsgame/lib/solana/idl/`. Fails hard if the IDL's embedded address does not match the deployed program ID — a stale `declare_id!` ships a bomb to the client.

```bash
bash deploy/devnet.sh
```

### 2. `bootstrap.sh`

Runs the admin ixs in order. Requires two env vars:

```bash
export ORACLE_PUBKEY=<base58 oracle signer pubkey>
export STAKE_MINT=<base58 SPL mint for bets>
# optional — default 50 (0.50%)
export FEE_BPS=50

bash deploy/bootstrap.sh
```

What it does:

| step | ix | args |
|---|---|---|
| 1 | `initialize_config` | `fee_bps` |
| 2 | `upsert_source` | `source_id=1`, name=`"BTC/USD"` (padded to `[u8; 32]`), `enabled=true` |
| 3 | `upsert_source` | `source_id=2`, name=`"ETH/USD"`, `enabled=true` |
| 4 | `upsert_source` | `source_id=3`, name=`"SOL/USD"`, `enabled=true` |
| 5 | `propose_oracle_signers` | `signers=[ORACLE_PUBKEY]`, `threshold=1` |

`initialize_config` is idempotent against a pre-existing config PDA — the script skips it. The other ixs are not. Re-running `propose_oracle_signers` while one is pending reverts with `PendingAlreadyQueued`.

### 3. wait 24 hours

`MULTISIG_DELAY = 86_400` seconds. Not negotiable. The program refuses activation until the wall clock has crossed the deadline. Good rules feel cruel the one night you need them to.

### 4. `activate-oracle.sh`

Permissionless — anyone with gas can call it. You, a cron job, a stranger. All equivalent.

```bash
bash deploy/activate-oracle.sh
```

Prints `oracle multisig live — start the daemon`. Start the daemon.

## env vars

| var | required by | default | notes |
|---|---|---|---|
| `ORACLE_PUBKEY` | bootstrap | — | base58 pubkey of the oracle signer |
| `STAKE_MINT` | bootstrap | — | base58 SPL mint used for bets |
| `FEE_BPS` | bootstrap | `50` | integer, 0–10_000 |
| `SOLANA_URL` | bootstrap, activate-oracle | `https://api.devnet.solana.com` | override RPC |
| `ANCHOR_WALLET` | bootstrap, activate-oracle | `~/.config/solana/id.json` | override signer keypair path |

## security

The keypair that signed `initialize_config` **is the admin**. Every admin ix checks `has_one = admin`. Lose the keypair, lose the program.

Rotate before mainnet. Two steps, not one:

```
propose_admin(new_admin)      # current admin signs
accept_admin()                # new admin signs
```

No timelock. `pending_admin` is overwritten by any subsequent `propose_admin`. The two-step dance exists so a fat-fingered pubkey cannot brick the program.

## rollback

There is no rollback. There is only forward.

- **program upgrade** — build, then `solana program deploy target/deploy/prediction_market.so --program-id <existing-keypair>`. The program ID is stable. The IDL is regenerated on every `anchor build`; re-run `devnet.sh` to propagate it.
- **bad config** — `initialize_config` cannot be called twice. The PDA exists, Anchor's `init` constraint rejects. A new config means a new program ID means a new deploy.
- **bad source** — `upsert_source` is idempotent by `source_id`. Re-call with `enabled=false` to disable.
- **bad oracle signers** — call `propose_oracle_signers([], 0)` to instantly cancel the pending set (SA5). For an already-activated set, propose a replacement and wait the 24h again.

Every upgrade path is slower than the mistake that created it. This is by design.
