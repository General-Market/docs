# Solana 5-Minute Parimutuel Prediction Market Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Solana program that runs 5-minute binary prediction markets on whether an external data source will be up/down by ±X% — parimutuel payout, lazy market instantiation on first trade against oracle-registered market types, 2.5-minute trading window followed by 2.5-minute locked window, oracle multisig resolution with 24h admin-change delay.

**Architecture:** Anchor program on Solana plus a dedicated off-chain mini oracle daemon. Admin registers `Source(source_id, name)` entries — a whitelist of data feeds the oracle will settle. Users open markets directly: a bet carries `(source_id, close_time, settlement_time, threshold_bps, side, amount)`. The `Market` PDA is seeded by `(source_id, close_time, settlement_time, threshold_bps)` — identical tuples from different users collide to the same PDA, so duplicates are impossible by construction. First `place_bet` with a given tuple instantiates the Market; subsequent bets with the same tuple join it. No admin bottleneck per market; no separate MarketType layer. The mini oracle daemon (single-node, reads data-node feeds directly) discovers Markets via event subscription + startup scan, captures the baseline at `close_time`, the final price at `settlement_time`, signs the combined payload with ed25519, and submits the `resolve_market` instruction on-chain. Multisig machinery preserved for future scaling; day-one runs threshold=1. Winners claim pro-rata; the fee applies only to winners on payout. Batch entry is optimized for market-maker tx cost: single-tx multi-market open via `batch_bets` + Address Lookup Tables.

**Scope split:** This plan covers (a) the Anchor program, (b) on-chain tests, (c) the mini oracle daemon. The user-facing frontend is a separate project and is **not** in this plan.

---

## Simplifications Applied (agreed across three convergence rounds)

Before executing, apply these cuts to the tasks below. They eliminate redundancy that accumulated across Phase 1 + Phase 2 without removing any feature.

**State cuts:**
- **SA1.** Drop `source_id` and `threshold_bps` from `Market`. Re-read via `market_type` account where needed (always a cheap extra account in `resolve_market` / `claim` / `force_resolve`).
- **SA2.** Drop `force_resolved: bool` from `Market`. Keep only in the `MarketResolved` event — indexers read logs.

**Instruction merges:**
- **SA3.** Fold `reclaim_stranded` into `claim`. When `winning_total == 0`, refund `yes_amount + no_amount` instead of `NotWinner`. Task 11b deleted.
- **SA4.** Fold `close_losing_position` into `claim`. When `stake == 0 && market.resolved`, close the Position to `rent_receiver = position.owner` with no transfer. H6's second ix deleted.
- **SA5.** Merge `cancel_pending_oracle_signers` into `propose_oracle_signers`. Empty vector + threshold 0 clears pending. Cancel ix deleted.
- **SA6.** Merge `register_market_type` + `set_market_type_enabled` into `upsert_market_type(source_id, threshold_bps, lock_duration, settlement_duration, enabled)`. Durations mutable only while `enabled == false`; `source_id` frozen forever.

**Structural merges:**
- **SA7.** Auto-ATA (`init_if_needed associated_token`) ships directly in Task 6 `place_bet` accounts, and mirrored in `exit_bet`, `claim`. Task H1 deleted.
- **SA8.** Every `#[event]` emission ships in its originating Task-1-through-12 handler. Tasks H3, H4, H5 deleted; `MarketInstantiated` remains a distinct event (not folded into `BetPlaced`).
- **SA9.** Fold `crates/payload-spec/` back into `programs/prediction-market/src/oracle.rs` as `pub fn build_payload`. Daemon duplicates the 10-line function; a Rust golden-vector test pins the two in sync.
- **SA10.** `instructions/admin.rs` absorbs oracle-signer ixs (propose/activate) AND market-type ixs (upsert). Files `oracle_signers.rs` and `market_type.rs` deleted. One authority surface, one file.
- **SA11.** Daemon `Deps` struct replaced by a bare `RuntimeState` struct with free functions `capture_baseline(&state, ...)` and `resolve_window(&state, ...)`. No methods.

**Code cuts:**
- **SA12.** Drop `SigEntry.signer`. The ed25519 precompile already carries the pubkey; the verifier reads it there. `SigEntry = [u8; 64]`. Saves 32 bytes per sig and one class of mismatch.
- **SA13.** Drop the `pending_threshold`/`pending_activation_ts` zeroing in `activate_oracle_signers`. `pending_signers.is_empty()` is the single source of truth. Set `bump` unconditionally in `init_if_needed`.
- **SA14.** Drop the bash preflight in H12. One Rust balance query at daemon boot, refuse start below 0.1 SOL. Systemd restart loop surfaces the failure.

**Test cuts:**
- **SA15.** Collapse `reclaim_stranded.spec.ts` and `close_losing_position.spec.ts` into `claim.spec.ts` — winner payout, stranded refund, loser close, double-claim guard, one file, four shapes.

**Round 4–7 additions (convergence after further simplification passes):**
- **SA16.** `FORCE_RESOLVE_DELAY` constant deleted. Admin may force-resolve after `resolve_ts + settlement_duration` — one full window late, proportional to each type's cadence. A 5-minute type unlocks at 10 minutes; a daily type unlocks after two days.
- **SA17.** Delete the `SigEntry` struct entirely. `ResolveArgs.signatures: Vec<[u8; 64]>`. The precompile carries the pubkey; verifier reads it there. SA12 removed the field; SA17 removes the wrapper.
- **SA18.** Drop `BatchEntry.market_index`. Entry `i` reads remaining_accounts `[4i..4i+4]`. Position IS the index.
- **SA19.** Delete H11 tick cache. On daemon boot, compute current `window_start` per type; if no baseline exists and the window is still open, capture immediately. No continuous polling, no SQLite tick table.
- **SA20.** Delete daemon rediscovery loop. List MarketTypes once at boot. Startup asserts configured set matches on-chain state; mismatch = crash. Adding a type means restarting the daemon; systemd handles it.
- **SA21.** `claim` always closes Position on success. Winner, stranded, AND loser paths all close the Position to `position.owner`. One rule, one exit. Double-claim guarded by account-closed.
- **SA22.** Merge H2 + H9 into one `docs/solana-protocol.md` with three sections: rent, decimals, payload. Module doc comments stay with code.
- **SA23.** Delete H13 `seed-markets.ts`. `batch_bets` uses `init_if_needed` per entry — markets auto-create in the batch. One tx for the MM, not two.
- **SA24.** Collapse `signer.rs` into `submitter.rs`. Daemon has one file for payload build + sign + submit. `build_and_submit(state, mt, window_start, baseline, final)`.
- **SA25.** Delete `AdminOnly` accounts wrapper. Each admin ix declares its own `Accounts`; shared `require_admin(&config, signer)` helper.

**Kept against pressure (rejected simplifications):**
- **SR1.** Manual PDA-derivation checks in `batch_bets`. Macro-generated nested Anchor `Accounts` for MAX_BATCH=24 would explode IDL size and compile time for checks that are six lines.
- **SR2.** OracleConfig stays two-state (active + pending). Collapsing to a single epoch with `effective_ts` would freeze the oracle for 24h after every rotation — availability loss dressed as minimalism.
- **SR3.** Signed payload stays 80 bytes (not `keccak256`). Forty-eight bytes saved is nothing; an auditable preimage on-chain is everything.
- **SR4.** `MarketInstantiated` event kept distinct from `BetPlaced`. An indexer shouldn't have to infer instantiation from the absence of prior events.
- **SR5.** `Ed25519Offsets` Pod struct + compile-time size assertion + CI hash test retained. The ed25519 precompile layout is load-bearing crypto; raw `u16::from_le_bytes` indexing is how silent breakage ships.
- **SR6.** Instant cancel via propose-with-empty-vector retained. A timelock on the escape hatch is a locked door during the fire.

Net effect: four Phase-2 tasks disappear (H1, H3, H4, H5, H11, H13), four files never exist (`oracle_signers.rs`, `market_type.rs`, `signer.rs` in daemon, `payload-spec` crate), three instructions disappear (`reclaim_stranded`, `cancel_pending_oracle_signers`, `set_market_type_enabled`), one bash preflight disappears, the 12h hardcoded constant disappears, the `SigEntry` wrapper disappears, the `BatchEntry.market_index` field disappears, the daemon rediscovery loop disappears, `Market::force_resolved` disappears, `Market` sheds `source_id` and `threshold_bps`. Roughly 40 bytes of on-chain state and ~600 LOC of plan text saved without losing one feature.

---

## Model Revisions (override earlier task text where they conflict)

Late-round design shifts. These supersede the task bodies where they collide. Apply these semantics; treat the earlier task text as scaffolding.

### MR1. `Source` replaces `MarketType`

Admin whitelists data sources only. No durations, no threshold on the source.
- `Source` PDA seeded by `[b"source", source_id_le]`
- Fields: `source_id: u32`, `name: [u8; 32]`, `enabled: bool`, `bump: u8`
- Single ix `upsert_source(source_id, name, enabled)` — admin only, `init_if_needed`
- Files: `instructions/source.rs` (replaces `market_type.rs`), absorbed into `admin.rs` per SA10

### MR2. Bet params live on the bet, not on a registered type

A bet carries everything needed to identify a market: `(source_id, close_time, settlement_time, threshold_bps, side, amount)`. The `Market` PDA seeds normalize duplicates — identical parameter tuples collide to the same account.

- `Market` PDA seeds: `[b"market", source_id_le, close_time_le_i64, settlement_time_le_i64, threshold_bps_le_i32]`
- First `place_bet` with a tuple instantiates the Market. Subsequent bets with the same tuple join.
- No admin gatekeeping per market. Normalization is PDA-level.

### MR3. Contract validation on bet params

The frontend ships a curated menu, but the contract is the backstop against scripted callers:

```rust
require!(source.enabled, SourceDisabled);
require!(threshold_bps != 0 && threshold_bps.abs() <= 10_000, BadThreshold);
require!(close_time > now, BadTime);
require!(close_time - now >= 10, BadTime);                        // min trading window
require!(settlement_time - close_time >= 10, BadTime);            // min observation
require!(settlement_time - now <= 30 * 86_400, BadTime);          // max TTL
// Optional grid: require!(close_time % 60 == 0 && settlement_time % 60 == 0, BadTime);
```

### MR4. Baseline captured at `close_time`, not bundled into resolve

Two oracle txs per market. Baseline on-chain the moment trading stops.

- `close_market(baseline_price, sigs)` — oracle-signed, fires at `close_time`. Writes `Market.baseline_price`, emits `MarketClosed`. Gated `now >= close_time && Market.baseline_price == 0`.
- `resolve_market(final_price, sigs)` — oracle-signed, fires at `settlement_time`. Reads `Market.baseline_price` from state, captures `Market.final_price`, computes outcome, emits `MarketResolved`. Gated `now >= settlement_time && Market.baseline_price > 0 && !resolved`.

Signed payload for each differs by a domain tag:
- Close: `source_id || close_time || baseline_price || TAG_CLOSE(1)`
- Resolve: `source_id || settlement_time || final_price || TAG_RESOLVE(2)`

Domain tag prevents a close-time signature from being replayed as a resolve-time signature.

### MR5. Claim is permissionless — users never click

`claim` drops the user signer. Cranker signs; payout flows to `position.owner`, fee to `fee_vault`, Position closes to `position.owner`. A keeper (the oracle daemon or a separate bot) sweeps resolved Markets and cranks every Position.

```rust
#[derive(Accounts)]
pub struct Claim<'info> {
    // ... market, position, vault, fee_vault as before ...
    #[account(mut, address = position.owner)]
    /// CHECK: receives payout and reclaimed rent
    pub owner: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = cranker,
        associated_token::mint = stake_mint,
        associated_token::authority = owner,
    )]
    pub owner_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub cranker: Signer<'info>,
    // ...
}
```

Position close goes to `owner` (rent back to trader), not cranker. Cranker pays the tx fee — keeper bots swallow that cost.

### MR6. Admin force-resolve timing

Replaces SA16's `settlement_duration` formulation (which referred to the removed MarketType field).

`admin_force_resolve` unlocks at `now >= settlement_time + (settlement_time - close_time)` — one full observation window past the missed settlement. A 5-minute market (2.5m trade + 2.5m observation) unlocks after a second 2.5-minute window past settlement. A 30-day market unlocks 30 days past settlement. Proportional, per-market.

### MR7. No ops CLI (H10 deleted)

Admin monitors markets via their own channels — block explorer, custom dashboards, whatever. When a stuck market is noticed, `admin_force_resolve` is called directly. H10 (`oracle-daemon/src/bin/ops.rs`) deleted from the plan.

### MR8. Daemon is fully stateless

Baseline lives on-chain from `close_time`. Tick cache was already killed (SA19). SQLite gone entirely. The daemon on wake:

1. `getProgramAccounts Market` filtered by `baseline_price == 0 && close_time <= now` — these need `close_market`.
2. `getProgramAccounts Market` filtered by `baseline_price > 0 && !resolved && settlement_time <= now` — these need `resolve_market`.
3. `getProgramAccounts Market` filtered by `resolved && any_position_unclaimed` — these need `claim` crank.

No SQLite file. No baseline store. No tick cache. `oracle-daemon/src/baselines.rs` deleted.

### MR9. Negative threshold semantics

`threshold_bps` is signed. Sign picks direction of the YES bet:
```rust
pub fn outcome_yes(baseline: u128, final_price: u128, threshold_bps: i32) -> bool {
    let bps = threshold_bps as i128;
    let target = (baseline as i128) * (10_000 + bps) / 10_000;
    if threshold_bps >= 0 { (final_price as i128) >= target }
    else                  { (final_price as i128) <= target }
}
```

Walkthrough at baseline = 100, threshold_bps:
- `+50` → target 100.5. YES if final ≥ 100.5. Market: "price up by ≥ 0.5%".
- `-50` → target 99.5. YES if final ≤ 99.5. Market: "price down by ≥ 0.5%".
- `0` → rejected at bet validation (`BadThreshold`).

Same `(source, close, settlement)` with `threshold_bps = +50` vs `-50` are **distinct markets** (different PDA seeds). Economically different bets, physically separate pools.

### MR10. Admin events — open question

After relaxing invariant 3 to "at least one event describing the effect": admin-surface ixs (`set_pause`, `set_fee_bps`, `upsert_source`, `propose_admin`, `accept_admin`, `withdraw_fees`, `propose_oracle_signers`) currently emit nothing. Decide before shipping: (a) emit for each to get a full audit stream, or (b) rely on tx history. The plan leaves them silent; flag for review.

---

---

**Tech Stack:** Rust + Anchor 0.30 for the program, `solana-program` ed25519 precompile for signature verification, SPL-token for stake (USDC), Anchor + Bankrun + Mocha/TypeScript for program tests, Rust + `solana-client` + `anchor-client` for the mini oracle daemon (consistent with the existing index project's data-node stack).

---

## Spec → Task Map

> **Partially superseded by MR1–MR10 and SA1–SA25.** The authoritative coverage map is in the Self-Review Notes at the bottom. The table below maps the original 12-point spec to Phase-1 tasks; read in concert with the Model Revisions above.

| Spec item | Tasks |
|---|---|
| 1. 1-click trading | 6 (single-ix `place_bet`, no signatures — the frontend project consumes this) |
| 2. Batch open positions (market-maker gas savings) | 8 (`batch_bets` + ALT support) |
| 3, 4. Enter/exit pool in 2.5-min window | 6 (`place_bet`), 7 (`exit_bet`) |
| 5. 2.5-min locked window | 7 (lock constraint), 10 (resolve-after constraint) |
| 6. Oracle pushes resolution on-chain | 10 (`resolve_market` handler), 14 (mini oracle daemon submits the ix) |
| 7. Binary yes/no, ±X% threshold at creation | 5 (MarketType schema pre-registered by oracle admin) |
| 8. First trade "creates" market (instantiates type for current window) | 6 (`init_if_needed` on Market PDA, referencing existing MarketType) |
| 9. Parimutuel + fee on winners only | 11 (`claim` — losers never claim, fee taken from winning payout) |
| 10. Oracle mocked in program tests | 4 (mock helper), 10 (tests) |
| 11. Multisig on CLOSE ONLY | 3 (OracleConfig), 9 (sig verify), 10 (resolve) — absent from `place_bet`/`exit_bet`/`batch_bets` |
| 12. Admin sets signers + threshold with 24h delay | 3 (propose), 3 (activate) |

---

## File Structure

> **Superseded by MR1, MR8, SA9, SA10, SA24.** The authoritative file layout after all revisions:
>
> **Program (`programs/prediction-market/src/`):**
> - `lib.rs`, `state.rs`, `errors.rs`, `math.rs`, `oracle.rs` (hosts `build_close_payload`, `build_resolve_payload`, `verify_multisig`, `Ed25519Offsets`).
> - `instructions/initialize.rs` (config + fee_vault PDA), `place_bet.rs`, `exit_bet.rs`, `batch_bets.rs`, `close_market.rs`, `resolve_market.rs`, `claim.rs`, `admin.rs` (absorbs oracle-signer ixs, `upsert_source`, pause/fee, admin handoff, `withdraw_fees`, `admin_force_resolve`).
> - No `market_type.rs`, no `oracle_signers.rs` (both folded into `admin.rs`). No separate `reclaim_stranded.rs`, `close_losing_position.rs`. No `crates/payload-spec/`.
>
> **Mini Oracle Daemon (`oracle-daemon/src/`):**
> - `main.rs`, `config.rs`, `feed.rs`, `submitter.rs` (absorbs payload build + sign per SA24), `metrics.rs`.
> - No `baselines.rs`, no `signer.rs`, no `discovery.rs`, no SQLite. Daemon is fully stateless (MR8).
> - One binary: `ops` / `alt` CLIs deleted (MR7) and folded (H14 `alt.rs` remains as separate operator CLI).
>
> The body below is the pre-MR layout kept as scaffolding reference.

**~~Shared crate (`crates/payload-spec/`)~~** — deleted per SA9. `build_payload` lives in `programs/prediction-market/src/oracle.rs` as `pub fn`. Daemon duplicates the function verbatim (~10 lines); a Rust golden-vector test pins the two in sync. TS test helper mirrors from the same vectors.

> **Modified by MR4:** payload is now TWO shapes (close + resolve) with domain tags. `build_close_payload` and `build_resolve_payload` both live in `oracle.rs`. Both 49 bytes: `source_id(4) || timestamp(8) || price(16) || tag(1)` (close uses `close_time` + `baseline`, resolve uses `settlement_time` + `final`). Exact byte count: pick based on whether the signed tuple needs to be collision-resistant against future ix additions.

**Program (`programs/prediction-market/src/`):**
- `lib.rs` — program ID, `#[program]` module exposing all instructions
- `state.rs` — `GlobalConfig`, `OracleConfig`, `MarketType`, `Market`, `Position`
- `errors.rs` — `ErrorCode` enum
- `oracle.rs` — ed25519 signature verification against OracleConfig threshold
- `math.rs` — parimutuel payout computation, fee split
- `instructions/initialize.rs` — `initialize_config`
- `instructions/oracle_signers.rs` — `propose_oracle_signers`, `activate_oracle_signers`
- `instructions/market_type.rs` — `register_market_type`, `set_market_type_enabled`
- `instructions/place_bet.rs` — `place_bet` (lazy per-window market instantiation, no sigs)
- `instructions/exit_bet.rs` — `exit_bet`
- `instructions/batch_bets.rs` — `batch_bets` (ALT-friendly)
- `instructions/resolve.rs` — `resolve_market` (multisig-gated)
- `instructions/claim.rs` — `claim` (fee on winning payout)
- `instructions/admin.rs` — `set_pause`, `set_fee_bps`

**Tests (`tests/`):**
- `helpers/mock-oracle.ts` — ed25519 keypair pool, sign resolution payloads
- `helpers/time.ts` — bankrun warp helpers aligned to 150-second windows
- `helpers/factories.ts` — initialize config, register market types, oracle set
- `config.spec.ts` — initialize_config, propose/activate signers (24h delay)
- `market-type.spec.ts` — register_market_type, enable/disable
- `trading.spec.ts` — place_bet, exit_bet, batch, lazy instantiation, window boundaries
- `resolve.spec.ts` — resolve_market (sig threshold, baseline+final payload, outcome math, timing)
- `claim.spec.ts` — parimutuel payout, fee extraction from winner gross, double-claim guard
- `e2e.spec.ts` — full 5-minute lifecycle with mock oracle

**Mini Oracle Daemon (`oracle-daemon/`):**
- `Cargo.toml` — Rust crate separate from the program
- `src/main.rs` — entrypoint, config loading, tokio runtime
- `src/config.rs` — env/TOML config: RPC URL, program ID, keypair path, data-node URL, signing threshold (expected 1 for day-one)
- `src/feed.rs` — data-node HTTP client, price fetcher keyed by `source_id`
- `src/discovery.rs` — scan on-chain `MarketType` PDAs via `getProgramAccounts`, cache
- `src/scheduler.rs` — window-aligned ticker: at each `window_start` record baselines, at each `resolve_ts` trigger resolve
- `src/baselines.rs` — durable baseline store (SQLite or JSON file) so restarts don't lose captured window starts
- `src/signer.rs` — ed25519 signing of `(market_type, window_start, baseline, final, resolve_ts)`
- `src/submitter.rs` — build Ed25519 precompile ix + `resolve_market` ix, send v0 tx with retry/backoff
- `src/metrics.rs` — per-window success/failure counters, last-resolve timestamp, Prometheus export

**Out of scope for this plan:** user-facing frontend (separate project — will consume the same program IDL and PDAs).

---

## Key Constants

> **Superseded by MR1, MR2, MR3, MR6.** `MarketType` no longer exists — durations live on the Market PDA seeds, not on a registered type. There is no `FORCE_RESOLVE_DELAY` constant. The bounds below still apply in spirit but are enforced in `place_bet` validation rather than at type-registration time. The current rule set is:
>
> - `threshold_bps != 0 && |threshold_bps| <= 10_000`
> - `close_time - now >= 10` (min trading window)
> - `settlement_time - close_time >= 10` (min observation window)
> - `settlement_time - now <= 30 * 86_400` (max TTL, 30 days)
> - `MAX_SIGNERS = 16`, `MAX_BATCH = 24`, `MULTISIG_DELAY = 86_400`
>
> Force-resolve unlocks at `settlement_time + (settlement_time - close_time)` (MR6). The body below documents the old per-MarketType formulation.

Durations are **per-MarketType**, not global. Admin picks `lock_duration` and `settlement_duration` when registering a MarketType and they're frozen for that type. Each type gets its own window cadence.

```rust
// Hard bounds, validated at register_market_type:
pub const MIN_LOCK_DURATION: i64 = 10;                 // 10 seconds
pub const MAX_SETTLEMENT_DURATION: i64 = 30 * 86_400;  // 30 days
// lock_duration < settlement_duration always.

pub const MULTISIG_DELAY: i64 = 86_400;        // 24h for admin signer changes
pub const FORCE_RESOLVE_DELAY: i64 = 12 * 3600; // 12h past resolve_ts before admin force-resolve unlocks
pub const MAX_SIGNERS: usize = 16;
pub const MAX_BATCH: usize = 24;
pub const BPS: u64 = 10_000;
```

**Window alignment** (per-MarketType, using its own `settlement_duration`):
```
window_start_ts = (now / settlement_duration) * settlement_duration
lock_ts         = window_start_ts + lock_duration
resolve_ts      = window_start_ts + settlement_duration
```

A MarketType with `settlement_duration=300` runs 5-minute windows aligned to :00/:05/:10. A type with `settlement_duration=3600` runs hourly windows aligned to the top of each hour. Different types tick on different schedules — that's the feature.

---

## Task 1: Scaffold Anchor workspace

**Files:**
- Create: `Anchor.toml`
- Create: `Cargo.toml`
- Create: `programs/prediction-market/Cargo.toml`
- Create: `programs/prediction-market/src/lib.rs`
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Initialize the workspace**

```bash
anchor init prediction-market --no-git --template multiple
cd prediction-market
anchor keys list
```

- [ ] **Step 2: Replace `programs/prediction-market/src/lib.rs` with stub**

```rust
use anchor_lang::prelude::*;

declare_id!("REPLACE_WITH_anchor_keys_list_OUTPUT");

#[program]
pub mod prediction_market {
    use super::*;
}
```

- [ ] **Step 3: Add dependencies to `programs/prediction-market/Cargo.toml`**

```toml
[dependencies]
anchor-lang = { version = "0.30.1", features = ["init-if-needed"] }
anchor-spl = "0.30.1"
solana-program = "1.18"
```

- [ ] **Step 4: Add test dependencies to `package.json`**

```json
{
  "scripts": { "test": "anchor test" },
  "devDependencies": {
    "@coral-xyz/anchor": "0.30.1",
    "@solana/spl-token": "0.4.0",
    "@solana/web3.js": "1.95.0",
    "anchor-bankrun": "0.5.0",
    "solana-bankrun": "0.4.0",
    "chai": "4.3.10",
    "mocha": "10.2.0",
    "ts-mocha": "10.0.0",
    "typescript": "5.3.3"
  }
}
```

- [ ] **Step 5: Build and verify**

Run: `anchor build`
Expected: `Finished release [optimized] target(s)`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(solana): scaffold prediction-market anchor workspace"
```

---

## Task 2: GlobalConfig + `initialize_config`

**Files:**
- Create: `programs/prediction-market/src/state.rs`
- Create: `programs/prediction-market/src/errors.rs`
- Create: `programs/prediction-market/src/instructions/mod.rs`
- Create: `programs/prediction-market/src/instructions/initialize.rs`
- Modify: `programs/prediction-market/src/lib.rs`
- Create: `tests/config.spec.ts`
- Create: `tests/helpers/factories.ts`

- [ ] **Step 1: Write the failing test `tests/config.spec.ts`**

```ts
import * as anchor from "@coral-xyz/anchor";
import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { expect } from "chai";

describe("initialize_config", () => {
  it("stores admin + fee_bps, provisions fee_vault PDA", async () => {
    const ctx = await startAnchor(".", [], []);
    const provider = new BankrunProvider(ctx);
    anchor.setProvider(provider);
    const program = anchor.workspace.PredictionMarket;

    const admin = provider.wallet.publicKey;
    const stakeMint = await createMint(ctx, admin, 6);
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")], program.programId,
    );
    const [feeVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("fee_vault")], program.programId,
    );

    await program.methods
      .initializeConfig(50)
      .accounts({
        config: configPda, feeVault: feeVaultPda,
        stakeMint, admin,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const cfg = await program.account.globalConfig.fetch(configPda);
    expect(cfg.admin.toBase58()).to.eq(admin.toBase58());
    expect(cfg.feeBps).to.eq(50);
    expect(cfg.stakeMint.toBase58()).to.eq(stakeMint.toBase58());
    expect(cfg.feeVault.toBase58()).to.eq(feeVaultPda.toBase58());
    expect(cfg.pendingAdmin.toBase58()).to.eq(anchor.web3.PublicKey.default.toBase58());
    expect(cfg.paused).to.eq(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `anchor test --skip-local-validator`
Expected: FAIL — `initializeConfig is not a function`.

- [ ] **Step 3: Define state in `state.rs`**

```rust
//! # PDA seed conventions
//!
//! All integer seeds use Rust `to_le_bytes()` — little-endian, two's-complement
//! for signed types. `threshold_bps: i32 = 50`  → `[0x32, 0x00, 0x00, 0x00]`.
//! `threshold_bps: i32 = -50` → `[0xCE, 0xFF, 0xFF, 0xFF]`.
//! TS consumers MUST use `Buffer.writeInt32LE` / `writeBigInt64LE`.
//!
//! # Price decimals
//!
//! All on-chain prices are `u128 = native_price * 10^18`. The daemon normalizes
//! before signing. Contract math assumes this without verification.

use anchor_lang::prelude::*;

#[account]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub pending_admin: Pubkey,   // Pubkey::default() when no pending handoff
    pub fee_bps: u16,
    pub stake_mint: Pubkey,
    pub fee_vault: Pubkey,       // derived: [b"fee_vault"] PDA, authority = same PDA
    pub fee_vault_bump: u8,
    pub paused: bool,
    pub bump: u8,
}

impl GlobalConfig {
    pub const LEN: usize = 8 + 32 + 32 + 2 + 32 + 32 + 1 + 1 + 1;
}
```

- [ ] **Step 4: Define errors in `errors.rs`**

```rust
use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("fee_bps exceeds 10_000")] FeeTooHigh,
    #[msg("unauthorized")] Unauthorized,
    #[msg("paused")] Paused,
    #[msg("window open")] WindowOpen,
    #[msg("window closed")] WindowClosed,
    #[msg("before resolve_ts")] NotResolvable,
    #[msg("already resolved")] AlreadyResolved,
    #[msg("unresolved")] Unresolved,
    #[msg("signature threshold not met")] ThresholdNotMet,
    #[msg("bad signature")] BadSignature,
    #[msg("pending not ready")] PendingNotReady,
    #[msg("no pending change")] NoPending,
    #[msg("already claimed")] AlreadyClaimed,
    #[msg("not a winner")] NotWinner,
    #[msg("insufficient balance")] InsufficientBalance,
    #[msg("batch too large")] BatchTooLarge,
    #[msg("source disabled")] SourceDisabled,
    #[msg("invalid duration")] BadDuration,
    #[msg("too early to force-resolve")] ForceResolveTooEarly,
    #[msg("pending already queued")] PendingAlreadyQueued,
    #[msg("stranded pool only")] StrandedOnly,
}
```

- [ ] **Step 5: Implement `initialize_config` in `instructions/initialize.rs`**

The fee vault is a program-owned token account. Its address AND its authority are the same PDA seeded at `[b"fee_vault"]`. Creating it in `initialize_config` means no externally-supplied fee vault — admin cannot re-target fees.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::GlobalConfig;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(init, payer = admin, space = GlobalConfig::LEN, seeds = [b"config"], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        init,
        payer = admin,
        token::mint = stake_mint,
        token::authority = fee_vault,      // self-owned PDA token account
        seeds = [b"fee_vault"],
        bump,
    )]
    pub fee_vault: Account<'info, TokenAccount>,
    pub stake_mint: Account<'info, Mint>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<InitializeConfig>,
    fee_bps: u16,
) -> Result<()> {
    require!(fee_bps <= 10_000, ErrorCode::FeeTooHigh);
    let cfg = &mut ctx.accounts.config;
    cfg.admin = ctx.accounts.admin.key();
    cfg.pending_admin = Pubkey::default();
    cfg.fee_bps = fee_bps;
    cfg.stake_mint = ctx.accounts.stake_mint.key();
    cfg.fee_vault = ctx.accounts.fee_vault.key();
    cfg.fee_vault_bump = ctx.bumps.fee_vault;
    cfg.paused = false;
    cfg.bump = ctx.bumps.config;
    Ok(())
}
```

- [ ] **Step 6: Wire up `lib.rs`**

```rust
use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod instructions;

use instructions::*;

declare_id!("REPLACE_WITH_anchor_keys_list_OUTPUT");

#[program]
pub mod prediction_market {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: u16,
    ) -> Result<()> {
        initialize::handler(ctx, fee_bps)
    }
}
```

And `instructions/mod.rs`:

```rust
pub mod initialize;
pub use initialize::*;
```

- [ ] **Step 7: Run test and verify pass**

Run: `anchor test`
Expected: 1 passing.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(solana): initialize_config instruction"
```

---

## Task 3: OracleConfig — propose + activate with 24h delay

> **Modified by SA5.** Do NOT implement a separate `cancel_pending_oracle_signers` ix. Instead, `propose_oracle_signers([], 0)` (empty vector + zero threshold) clears pending instantly. The handler below shows the cancel ix as scaffolding — merge its clearing logic into `propose` per SA5, then delete the separate ix.

**Files:**
- Modify: `programs/prediction-market/src/state.rs`
- Create: `programs/prediction-market/src/instructions/oracle_signers.rs`
- Modify: `programs/prediction-market/src/instructions/mod.rs`
- Modify: `programs/prediction-market/src/lib.rs`
- Modify: `tests/config.spec.ts`

- [ ] **Step 1: Add failing tests for propose + activate**

```ts
it("propose_oracle_signers stores pending and activation_ts = now + 86400", async () => {
  // helper `initializeConfigWith(ctx)` returns provider, program, admin
  const { program, provider, ctx } = await factories.init();
  const signers = [kp(), kp(), kp()].map(k => k.publicKey);
  const now = Number((await ctx.banksClient.getClock()).unixTimestamp);

  const [oraclePda] = pda(["oracle_config"], program.programId);
  await program.methods
    .proposeOracleSigners(signers, 2)
    .accounts({ config: configPda, oracleConfig: oraclePda, admin: provider.wallet.publicKey })
    .rpc();

  const oc = await program.account.oracleConfig.fetch(oraclePda);
  expect(oc.pendingSigners.length).to.eq(3);
  expect(oc.pendingThreshold).to.eq(2);
  expect(Number(oc.pendingActivationTs)).to.be.closeTo(now + 86_400, 5);
  expect(oc.activeSigners.length).to.eq(0);
});

it("activate_oracle_signers rejects before 24h", async () => {
  // ... same as above, then warp 1 hour
  await warp(ctx, 3_600);
  await expect(program.methods.activateOracleSigners().accounts({ oracleConfig: oraclePda }).rpc())
    .to.be.rejectedWith(/PendingNotReady/);
});

it("activate_oracle_signers promotes pending after 24h", async () => {
  await warp(ctx, 86_400 + 1);
  await program.methods.activateOracleSigners().accounts({ oracleConfig: oraclePda }).rpc();
  const oc = await program.account.oracleConfig.fetch(oraclePda);
  expect(oc.activeSigners.length).to.eq(3);
  expect(oc.activeThreshold).to.eq(2);
  expect(oc.pendingSigners.length).to.eq(0);
});
```

- [ ] **Step 2: Run test; verify failures**

Run: `anchor test`
Expected: 3 failing.

- [ ] **Step 3: Add OracleConfig to `state.rs`**

```rust
#[account]
pub struct OracleConfig {
    pub active_signers: Vec<Pubkey>,
    pub active_threshold: u8,
    pub pending_signers: Vec<Pubkey>,
    pub pending_threshold: u8,
    pub pending_activation_ts: i64,
    pub bump: u8,
}

impl OracleConfig {
    pub const MAX_SIGNERS: usize = 16;
    pub const LEN: usize = 8
        + 4 + 32 * Self::MAX_SIGNERS
        + 1
        + 4 + 32 * Self::MAX_SIGNERS
        + 1
        + 8
        + 1;
}
```

- [ ] **Step 4: Implement in `instructions/oracle_signers.rs`**

```rust
use anchor_lang::prelude::*;
use crate::state::{GlobalConfig, OracleConfig};
use crate::errors::ErrorCode;

pub const MULTISIG_DELAY: i64 = 86_400;

#[derive(Accounts)]
pub struct ProposeSigners<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        init_if_needed,
        payer = admin,
        space = OracleConfig::LEN,
        seeds = [b"oracle_config"],
        bump,
    )]
    pub oracle_config: Account<'info, OracleConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn propose(
    ctx: Context<ProposeSigners>,
    signers: Vec<Pubkey>,
    threshold: u8,
) -> Result<()> {
    require!(signers.len() <= OracleConfig::MAX_SIGNERS, ErrorCode::BatchTooLarge);
    require!(
        threshold as usize >= 1 && (threshold as usize) <= signers.len(),
        ErrorCode::ThresholdNotMet
    );
    let oc = &mut ctx.accounts.oracle_config;
    // A pending proposal blocks new proposals until it's either activated or cancelled.
    // This prevents an admin (or compromised admin) from silently extending the 24h clock
    // by re-proposing mid-delay.
    require!(oc.pending_signers.is_empty(), ErrorCode::PendingAlreadyQueued);
    oc.pending_signers = signers;
    oc.pending_threshold = threshold;
    oc.pending_activation_ts = Clock::get()?.unix_timestamp + MULTISIG_DELAY;
    if oc.bump == 0 { oc.bump = ctx.bumps.oracle_config; }
    Ok(())
}

#[derive(Accounts)]
pub struct CancelPendingSigners<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, crate::state::GlobalConfig>,
    #[account(mut, seeds = [b"oracle_config"], bump = oracle_config.bump)]
    pub oracle_config: Account<'info, OracleConfig>,
    pub admin: Signer<'info>,
}

pub fn cancel_pending(ctx: Context<CancelPendingSigners>) -> Result<()> {
    let oc = &mut ctx.accounts.oracle_config;
    require!(!oc.pending_signers.is_empty(), ErrorCode::NoPending);
    oc.pending_signers = Vec::new();
    oc.pending_threshold = 0;
    oc.pending_activation_ts = 0;
    Ok(())
}

#[derive(Accounts)]
pub struct ActivateSigners<'info> {
    #[account(mut, seeds = [b"oracle_config"], bump = oracle_config.bump)]
    pub oracle_config: Account<'info, OracleConfig>,
}

pub fn activate(ctx: Context<ActivateSigners>) -> Result<()> {
    let oc = &mut ctx.accounts.oracle_config;
    require!(!oc.pending_signers.is_empty(), ErrorCode::NoPending);
    require!(
        Clock::get()?.unix_timestamp >= oc.pending_activation_ts,
        ErrorCode::PendingNotReady
    );
    oc.active_signers = std::mem::take(&mut oc.pending_signers);
    oc.active_threshold = oc.pending_threshold;
    oc.pending_threshold = 0;
    oc.pending_activation_ts = 0;
    Ok(())
}
```

- [ ] **Step 5: Wire into `lib.rs` and `instructions/mod.rs`**

```rust
// mod.rs
pub mod oracle_signers;
pub use oracle_signers::*;

// lib.rs inside #[program]
pub fn propose_oracle_signers(
    ctx: Context<ProposeSigners>,
    signers: Vec<Pubkey>,
    threshold: u8,
) -> Result<()> { oracle_signers::propose(ctx, signers, threshold) }

pub fn activate_oracle_signers(ctx: Context<ActivateSigners>) -> Result<()> {
    oracle_signers::activate(ctx)
}

pub fn cancel_pending_oracle_signers(ctx: Context<CancelPendingSigners>) -> Result<()> {
    oracle_signers::cancel_pending(ctx)
}
```

- [ ] **Step 6: Write `helpers/time.ts` warp helper**

```ts
import { ProgramTestContext } from "solana-bankrun";

export async function warp(ctx: ProgramTestContext, seconds: number) {
  const clock = await ctx.banksClient.getClock();
  ctx.setClock(new Clock(
    clock.slot,
    clock.epochStartTimestamp,
    clock.epoch,
    clock.leaderScheduleEpoch,
    clock.unixTimestamp + BigInt(seconds),
  ));
}
```

- [ ] **Step 7: Run and verify all 3 tests pass**

Run: `anchor test`
Expected: all config tests green.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(solana): oracle multisig with 24h activation delay"
```

---

## Task 4: Mock oracle test helper

**Files:**
- Create: `tests/helpers/mock-oracle.ts`

The mock produces ed25519 signatures over the same payload the program verifies — a deterministic byte string encoding market identity and price.

- [ ] **Step 1: Write `helpers/mock-oracle.ts`**

```ts
import * as ed from "@noble/ed25519";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export class MockOracleSet {
  public members: Keypair[];
  constructor(size: number) {
    this.members = Array.from({ length: size }, () => Keypair.generate());
  }
  get pubkeys(): PublicKey[] { return this.members.map(m => m.publicKey); }

  // payload = market_type (32) | window_start (i64 LE) | baseline (u128 LE) | final (u128 LE) | resolve_ts (i64 LE)
  static encodePayload(
    marketType: PublicKey, windowStart: BN, baseline: BN, final: BN, resolveTs: BN,
  ): Buffer {
    const buf = Buffer.alloc(32 + 8 + 16 + 16 + 8);
    marketType.toBuffer().copy(buf, 0);
    windowStart.toBuffer("le", 8).copy(buf, 32);
    baseline.toBuffer("le", 16).copy(buf, 40);
    final.toBuffer("le", 16).copy(buf, 56);
    resolveTs.toBuffer("le", 8).copy(buf, 72);
    return buf;
  }

  async sign(
    indexes: number[],
    marketType: PublicKey, windowStart: BN, baseline: BN, final: BN, resolveTs: BN,
  ): Promise<{ signer: PublicKey; sig: Uint8Array }[]> {
    const payload = MockOracleSet.encodePayload(marketType, windowStart, baseline, final, resolveTs);
    const out: { signer: PublicKey; sig: Uint8Array }[] = [];
    for (const i of indexes) {
      const kp = this.members[i];
      const sig = await ed.sign(payload, kp.secretKey.slice(0, 32));
      out.push({ signer: kp.publicKey, sig });
    }
    return out;
  }
}
```

- [ ] **Step 2: Smoke test the helper**

```ts
// tests/helpers/mock-oracle.spec.ts
it("produces verifiable ed25519 sigs", async () => {
  const set = new MockOracleSet(3);
  const mt = Keypair.generate().publicKey;
  const sigs = await set.sign([0, 2], mt, new BN(0), new BN(100), new BN(101), new BN(300));
  expect(sigs.length).to.eq(2);
  const payload = MockOracleSet.encodePayload(mt, new BN(0), new BN(100), new BN(101), new BN(300));
  const ok = await ed.verify(sigs[0].sig, payload, sigs[0].signer.toBytes());
  expect(ok).to.be.true;
});
```

- [ ] **Step 3: Run helper test**

Run: `anchor test`
Expected: helper smoke test green.

- [ ] **Step 4: Commit**

```bash
git add tests/helpers/mock-oracle.ts tests/helpers/mock-oracle.spec.ts
git commit -m "test(solana): mock oracle ed25519 signer"
```

---

## Task 5: Source + Market + Position schema, `upsert_source`

> **Superseded by MR1, MR2, MR3.** The body below describes the older `MarketType` model. When executing, implement `Source` (admin-registered whitelist only — no threshold, no durations) and `Market` PDA seeded by `(source_id, close_time, settlement_time, threshold_bps)`. Validation per MR3 lives in `place_bet`, not here.

**Files:**
- Modify: `programs/prediction-market/src/state.rs`
- Create: `programs/prediction-market/src/instructions/market_type.rs`
- Modify: `programs/prediction-market/src/instructions/mod.rs`
- Modify: `programs/prediction-market/src/lib.rs`
- Create: `tests/market-type.spec.ts`

Only the oracle admin can register a `(source_id, threshold_bps)` pair. A `Market` for a given `(market_type, window_start)` exists only if its `MarketType` is registered and enabled — this is what binds tradable markets to ones the oracle actually watches. No baseline on the Market; captured at resolve time.

- [ ] **Step 1: Add to `state.rs`**

```rust
#[account]
pub struct MarketType {
    pub source_id: u32,
    pub threshold_bps: i32,   // signed: positive = YES means "up by X%", negative = "down by X%"
    pub lock_duration: i64,   // seconds from window_start before entry/exit closes
    pub settlement_duration: i64, // seconds from window_start before resolve unlocks
    pub enabled: bool,
    pub bump: u8,
}
impl MarketType {
    pub const LEN: usize = 8 + 4 + 4 + 8 + 8 + 1 + 1;
}

#[account]
pub struct Market {
    pub market_type: Pubkey,    // references the MarketType PDA
    pub source_id: u32,
    pub threshold_bps: i32,     // cached from MarketType for cheap reads
    pub window_start_ts: i64,
    pub lock_ts: i64,
    pub resolve_ts: i64,
    pub total_yes: u64,
    pub total_no: u64,
    pub resolved: bool,
    pub outcome_yes: bool,
    pub force_resolved: bool,   // true if admin force-resolved after 12h oracle silence
    pub baseline_price: u128,   // filled at resolve time
    pub final_price: u128,      // filled at resolve time
    pub vault: Pubkey,          // SPL token account holding pooled stake
    pub bump: u8,
}
impl Market {
    pub const LEN: usize = 8 + 32 + 4 + 4 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 16 + 16 + 32 + 1;
}

#[account]
pub struct Position {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub yes_amount: u64,
    pub no_amount: u64,
    pub claimed: bool,
    pub bump: u8,
}
impl Position {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1 + 1;
}
```

- [ ] **Step 2: Implement `market_type.rs`**

```rust
use anchor_lang::prelude::*;
use crate::state::{GlobalConfig, MarketType};
use crate::errors::ErrorCode;

pub const MIN_LOCK_DURATION: i64 = 10;
pub const MAX_SETTLEMENT_DURATION: i64 = 30 * 86_400;

#[derive(Accounts)]
#[instruction(source_id: u32, threshold_bps: i32, lock_duration: i64, settlement_duration: i64)]
pub struct RegisterMarketType<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        init,
        payer = admin,
        space = MarketType::LEN,
        seeds = [b"type", &source_id.to_le_bytes(), &threshold_bps.to_le_bytes()],
        bump,
    )]
    pub market_type: Account<'info, MarketType>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn register(
    ctx: Context<RegisterMarketType>,
    source_id: u32,
    threshold_bps: i32,
    lock_duration: i64,
    settlement_duration: i64,
) -> Result<()> {
    require!(lock_duration >= MIN_LOCK_DURATION, ErrorCode::BadDuration);
    require!(settlement_duration > lock_duration, ErrorCode::BadDuration);
    require!(settlement_duration <= MAX_SETTLEMENT_DURATION, ErrorCode::BadDuration);
    let t = &mut ctx.accounts.market_type;
    t.source_id = source_id;
    t.threshold_bps = threshold_bps;
    t.lock_duration = lock_duration;
    t.settlement_duration = settlement_duration;
    t.enabled = true;
    t.bump = ctx.bumps.market_type;
    Ok(())
}

#[derive(Accounts)]
pub struct SetMarketTypeEnabled<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        mut,
        seeds = [b"type", &market_type.source_id.to_le_bytes(), &market_type.threshold_bps.to_le_bytes()],
        bump = market_type.bump,
    )]
    pub market_type: Account<'info, MarketType>,
    pub admin: Signer<'info>,
}

pub fn set_enabled(ctx: Context<SetMarketTypeEnabled>, enabled: bool) -> Result<()> {
    ctx.accounts.market_type.enabled = enabled;
    Ok(())
}
```

- [ ] **Step 3: Wire into `lib.rs` and `instructions/mod.rs`**

```rust
pub fn register_market_type(
    ctx: Context<RegisterMarketType>,
    source_id: u32,
    threshold_bps: i32,
    lock_duration: i64,
    settlement_duration: i64,
) -> Result<()> { market_type::register(ctx, source_id, threshold_bps, lock_duration, settlement_duration) }

pub fn set_market_type_enabled(
    ctx: Context<SetMarketTypeEnabled>,
    enabled: bool,
) -> Result<()> { market_type::set_enabled(ctx, enabled) }
```

- [ ] **Step 4: Write tests**

```ts
it("admin registers a market type with durations", async () => {
  const { program, provider } = await factories.init();
  const [mt] = pda(["type", u32le(7), i32le(50)], program.programId);
  await program.methods.registerMarketType(7, 50, new BN(150), new BN(300))
    .accounts({ config: configPda, marketType: mt, admin: provider.wallet.publicKey })
    .rpc();
  const t = await program.account.marketType.fetch(mt);
  expect(t.sourceId).to.eq(7);
  expect(t.thresholdBps).to.eq(50);
  expect(Number(t.lockDuration)).to.eq(150);
  expect(Number(t.settlementDuration)).to.eq(300);
  expect(t.enabled).to.be.true;
});

it("rejects lock_duration < 10s", async () => {
  await expect(program.methods.registerMarketType(7, 50, new BN(5), new BN(300))
    .accounts({ ... }).rpc()).to.be.rejectedWith(/BadDuration/);
});

it("rejects settlement_duration <= lock_duration", async () => {
  await expect(program.methods.registerMarketType(7, 50, new BN(300), new BN(300))
    .accounts({ ... }).rpc()).to.be.rejectedWith(/BadDuration/);
});

it("rejects settlement_duration > 30 days", async () => {
  await expect(program.methods.registerMarketType(7, 50, new BN(150), new BN(31 * 86400))
    .accounts({ ... }).rpc()).to.be.rejectedWith(/BadDuration/);
});

it("non-admin cannot register a market type", async () => {
  const stranger = Keypair.generate();
  await fundSol(ctx, stranger.publicKey, 1e9);
  await expect(program.methods.registerMarketType(7, 50, new BN(150), new BN(300))
    .accounts({ config: configPda, marketType: mt, admin: stranger.publicKey })
    .signers([stranger]).rpc()).to.be.rejectedWith(/Unauthorized/);
});

it("disabled market type blocks new place_bet (checked in trading tests)", () => { /* covered in Task 6 */ });
```

- [ ] **Step 5: Run; commit**

```bash
anchor test --grep market-type
git add -A && git commit -m "feat(solana): MarketType schema + register/enable"
```

---

## Task 6: `place_bet` — lazy market instantiation, no signatures on entry

> **Superseded by MR2 + MR3.** Take `(source_id, close_time, settlement_time, threshold_bps, side, amount)` as args. Market PDA seeds are `[b"market", source_id, close_time_le, settlement_time_le, threshold_bps_le]`. Apply validation bounds from MR3: `threshold_bps != 0 && abs <= 10_000`, `close_time > now + 10`, `settlement_time - close_time >= 10`, `settlement_time - now <= 30 days`. First bet instantiates the Market; duplicates with identical tuples collide to the same PDA automatically.

**Files:**
- Create: `programs/prediction-market/src/instructions/place_bet.rs`
- Modify: `programs/prediction-market/src/instructions/mod.rs`
- Modify: `programs/prediction-market/src/lib.rs`
- Create: `tests/trading.spec.ts`

The first bet of a window for a given `MarketType` instantiates the `Market` PDA. No oracle interaction at entry — the existence of the `MarketType` is the oracle's pre-commitment to settle it.

- [ ] **Step 1: Write failing tests**

```ts
// tests/trading.spec.ts
it("first place_bet instantiates market for a registered MarketType", async () => {
  const { program, provider, ctx, marketType, user, stakeMint, userAta } =
    await factories.trading(); // factory pre-registers MarketType(source=7, threshold=50)

  const clock = await ctx.banksClient.getClock();
  const windowStart = alignWindow(Number(clock.unixTimestamp));
  const [marketPda] = pda(
    ["market", marketType.toBuffer(), i64le(windowStart)],
    program.programId,
  );

  await program.methods
    .placeBet({
      windowStart: new BN(windowStart),
      side: { yes: {} },
      amount: new BN(1_000_000),
    })
    .accounts({ marketType, market: marketPda, /* position, vault, userAta, user */ })
    .rpc();

  const m = await program.account.market.fetch(marketPda);
  expect(m.thresholdBps).to.eq(50);
  expect(m.sourceId).to.eq(7);
  expect(m.totalYes.toString()).to.eq("1000000");
});

it("second bet in same window skips init, increments totals", async () => {
  // place first bet from alice, then second from bob; assert totalYes and totalNo update.
});

it("place_bet against disabled MarketType rejected", async () => {
  // register MarketType, disable it, attempt bet, expect SourceDisabled.
});

it("bet after lock_ts rejected with WindowClosed", async () => {
  // place first bet; warp 150s+1; attempt place_bet; expect WindowClosed.
});

it("place_bet against unregistered (source, threshold) fails", async () => {
  // derive market PDA referencing a MarketType PDA that doesn't exist; expect AccountNotInitialized.
});
```

- [ ] **Step 2: Run; verify failures**

Run: `anchor test --grep trading`
Expected: red.

- [ ] **Step 3: Implement `place_bet`**

```rust
// instructions/place_bet.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::state::{GlobalConfig, MarketType, Market, Position};
use crate::errors::ErrorCode;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum Side { Yes, No }

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PlaceBetArgs {
    pub window_start: i64,
    pub side: Side,
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(args: PlaceBetArgs)]
pub struct PlaceBet<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        seeds = [b"type", &market_type.source_id.to_le_bytes(), &market_type.threshold_bps.to_le_bytes()],
        bump = market_type.bump,
        constraint = market_type.enabled @ ErrorCode::SourceDisabled,
    )]
    pub market_type: Account<'info, MarketType>,
    #[account(
        init_if_needed,
        payer = user,
        space = Market::LEN,
        seeds = [b"market", market_type.key().as_ref(), &args.window_start.to_le_bytes()],
        bump,
    )]
    pub market: Account<'info, Market>,
    #[account(
        init_if_needed,
        payer = user,
        space = Position::LEN,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub position: Account<'info, Position>,
    #[account(
        init_if_needed,
        payer = user,
        token::mint = stake_mint,
        token::authority = market,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(address = config.stake_mint)]
    pub stake_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_ata.mint == stake_mint.key())]
    pub user_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<PlaceBet>, args: PlaceBetArgs) -> Result<()> {
    require!(!ctx.accounts.config.paused, ErrorCode::Paused);

    let mt = &ctx.accounts.market_type;
    let now = Clock::get()?.unix_timestamp;
    // Per-type window alignment: each MarketType has its own settlement cadence.
    let aligned = (now / mt.settlement_duration) * mt.settlement_duration;
    require!(args.window_start == aligned, ErrorCode::WindowClosed);
    require!(now < args.window_start + mt.lock_duration, ErrorCode::WindowClosed);

    let market = &mut ctx.accounts.market;
    let is_first = market.window_start_ts == 0;

    if is_first {
        market.market_type = mt.key();
        market.source_id = mt.source_id;
        market.threshold_bps = mt.threshold_bps;
        market.window_start_ts = args.window_start;
        market.lock_ts = args.window_start + mt.lock_duration;
        market.resolve_ts = args.window_start + mt.settlement_duration;
        market.vault = ctx.accounts.vault.key();
        market.bump = ctx.bumps.market;
    }

    let position = &mut ctx.accounts.position;
    if position.bump == 0 {
        position.market = market.key();
        position.owner = ctx.accounts.user.key();
        position.bump = ctx.bumps.position;
    }

    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.user_ata.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        }),
        args.amount,
    )?;

    match args.side {
        Side::Yes => {
            market.total_yes = market.total_yes.checked_add(args.amount).unwrap();
            position.yes_amount = position.yes_amount.checked_add(args.amount).unwrap();
        }
        Side::No => {
            market.total_no = market.total_no.checked_add(args.amount).unwrap();
            position.no_amount = position.no_amount.checked_add(args.amount).unwrap();
        }
    }
    Ok(())
}
```

- [ ] **Step 4: Wire into `lib.rs` and `instructions/mod.rs`**

```rust
pub fn place_bet(ctx: Context<PlaceBet>, args: PlaceBetArgs) -> Result<()> {
    place_bet::handler(ctx, args)
}
```

- [ ] **Step 5: Run trading tests; green**

Run: `anchor test --grep trading`
Expected: 5 passing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(solana): place_bet with lazy market instantiation"
```

---

## Task 7: `exit_bet` — exit during 2.5-minute window

**Files:**
- Create: `programs/prediction-market/src/instructions/exit_bet.rs`
- Modify: `programs/prediction-market/src/instructions/mod.rs`
- Modify: `programs/prediction-market/src/lib.rs`
- Modify: `tests/trading.spec.ts`

- [ ] **Step 1: Add failing tests**

```ts
it("exit_bet refunds stake during window", async () => {
  await placeBet(user, Side.Yes, 1_000_000);
  await program.methods.exitBet({ side: { yes: {} }, amount: new BN(400_000) }).accounts(...).rpc();
  const m = await program.account.market.fetch(marketPda);
  expect(m.totalYes.toString()).to.eq("600000");
  const ataBal = await getAccount(ctx.banksClient, userAta);
  expect(ataBal.amount.toString()).to.eq("-400000"); // relative assertion
});

it("exit_bet after lock_ts rejected", async () => {
  await placeBet(...);
  await warp(ctx, LOCK_AT + 1);
  await expect(program.methods.exitBet(...).rpc()).to.be.rejectedWith(/WindowClosed/);
});

it("exit_bet more than staked rejected", async () => {
  await placeBet(user, Side.Yes, 1_000_000);
  await expect(program.methods.exitBet({ side: { yes: {} }, amount: new BN(2_000_000) }).rpc())
    .to.be.rejectedWith(/InsufficientBalance/);
});
```

- [ ] **Step 2: Run; verify red**

- [ ] **Step 3: Implement `exit_bet.rs`**

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{Market, Position};
use crate::errors::ErrorCode;
use crate::instructions::place_bet::Side;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ExitBetArgs { pub side: Side, pub amount: u64 }

#[derive(Accounts)]
pub struct ExitBet<'info> {
    #[account(mut, seeds = [b"market", market.market_type.as_ref(), &market.window_start_ts.to_le_bytes()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"position", market.key().as_ref(), user.key().as_ref()], bump = position.bump)]
    pub position: Account<'info, Position>,
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ExitBet>, args: ExitBetArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(now < ctx.accounts.market.lock_ts, ErrorCode::WindowClosed);

    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    match args.side {
        Side::Yes => {
            require!(position.yes_amount >= args.amount, ErrorCode::InsufficientBalance);
            position.yes_amount -= args.amount;
            market.total_yes -= args.amount;
        }
        Side::No => {
            require!(position.no_amount >= args.amount, ErrorCode::InsufficientBalance);
            position.no_amount -= args.amount;
            market.total_no -= args.amount;
        }
    }

    let mt_key = market.market_type;
    let window_bytes = market.window_start_ts.to_le_bytes();
    let seeds: &[&[u8]] = &[b"market", mt_key.as_ref(), &window_bytes, &[market.bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_ata.to_account_info(),
                authority: market.to_account_info(),
            },
            &[seeds],
        ),
        args.amount,
    )?;
    Ok(())
}
```

- [ ] **Step 4: Wire into `lib.rs`; run; commit**

---

## Task 8: `batch_bets` — open multiple positions in one ix, ALT-friendly

> **Modified by SA18 + SA23.** `BatchEntry` has NO `market_index` field — entry `i` reads `remaining_accounts[4i..4i+4]`. Position in the args list IS the index. Also: entries may carry full bet params `(close_time, settlement_time, threshold_bps, side, amount)` and the handler does `init_if_needed` per entry (inherits from `place_bet` pattern), so MM batches open markets that don't exist yet — no separate seed script. The body below predates these changes; read with the caveat.

**Files:**
- Create: `programs/prediction-market/src/instructions/batch_bets.rs`
- Modify: `programs/prediction-market/src/instructions/mod.rs`
- Modify: `programs/prediction-market/src/lib.rs`
- Modify: `tests/trading.spec.ts`
- Create: `app/lib/alt.ts` (frontend ALT helper, referenced in Task 15)

**Goal:** minimize tx cost for market makers. Solana's raw tx size cap (1232 bytes) limits naive batches to ~4–6 markets because each entry requires 4 writable accounts (market, position, vault, user_ata). Solution: Address Lookup Tables (ALTs). Pre-publish an ALT per MM keyed on their common accounts — the tx then carries 1-byte indexes instead of 32-byte pubkeys. Realistic batch depth with ALT: 16–24 markets. `MAX_BATCH = 24`.

All markets in a batch must already exist (one seed bet per market per window). The batch ix does NOT create markets — it joins them. `remaining_accounts` is walked in 4-account strides: `(market, position, vault, user_ata)` per entry.

- [ ] **Step 1: Add failing tests**

```ts
it("batch_bets credits N markets atomically", async () => {
  // Seed 3 markets with 1 dust bet each
  // Then batch into all 3 with 100k each
  const args = {
    entries: [
      { marketIndex: 0, side: { yes: {} }, amount: new BN(100_000) },
      { marketIndex: 1, side: { no:  {} }, amount: new BN(100_000) },
      { marketIndex: 2, side: { yes: {} }, amount: new BN(100_000) },
    ],
  };
  await program.methods.batchBets(args)
    .accounts({ user: u.publicKey, tokenProgram: TOKEN_PROGRAM_ID })
    .remainingAccounts(buildBatchAccounts(markets, positions, vaults, userAta))
    .rpc();
  // assert each market total incremented by 100_000
});

it("batch_bets rejects when any market is locked (whole tx reverts)", async () => {
  // warp past lock_ts on one market; expect whole batch to fail atomically.
});

it("batch_bets with 16 markets fits in one tx when accounts come from an ALT", async () => {
  // Publish an ALT holding all market/position/vault/userAta pubkeys, then send tx.
  // Assert all 16 markets credited.
});

it("batch_bets rejects entries where position.owner != signer", async () => { /* ... */ });
```

- [ ] **Step 2: Implement `batch_bets.rs`**

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use crate::state::{GlobalConfig, Market, Position};
use crate::errors::ErrorCode;
use crate::instructions::place_bet::Side;

pub const MAX_BATCH: usize = 24;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BatchEntry { pub market_index: u8, pub side: Side, pub amount: u64 }

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BatchBetsArgs { pub entries: Vec<BatchEntry> }

#[derive(Accounts)]
pub struct BatchBets<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)] pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, BatchBets<'info>>,
    args: BatchBetsArgs,
) -> Result<()> {
    require!(!ctx.accounts.config.paused, ErrorCode::Paused);
    require!(args.entries.len() <= MAX_BATCH, ErrorCode::BatchTooLarge);
    let now = Clock::get()?.unix_timestamp;
    let ra = ctx.remaining_accounts;

    // Stride-4 layout: [market, position, vault, user_ata] per entry.
    // Indexes reference the (ALT-deduplicated) remaining_accounts.
    for entry in args.entries.iter() {
        let base = entry.market_index as usize * 4;
        require!(ra.len() >= base + 4, ErrorCode::BatchTooLarge);
        let market_info = &ra[base];
        let position_info = &ra[base + 1];
        let vault_info = &ra[base + 2];
        let user_ata_info = &ra[base + 3];

        let mut market: Account<Market> = Account::try_from(market_info)?;
        let mut position: Account<Position> = Account::try_from(position_info)?;
        require!(now < market.lock_ts, ErrorCode::WindowClosed);
        require!(position.owner == ctx.accounts.user.key(), ErrorCode::Unauthorized);
        require!(position.market == market.key(), ErrorCode::Unauthorized);
        require!(market.vault == vault_info.key(), ErrorCode::Unauthorized);

        // PDA derivation checks — Anchor's macro isn't running for these
        // stride-4 accounts, so forgery attempts must die here.
        let expected_market = Pubkey::create_program_address(
            &[b"market", market.market_type.as_ref(),
              &market.window_start_ts.to_le_bytes(), &[market.bump]],
            &crate::ID,
        ).map_err(|_| error!(ErrorCode::Unauthorized))?;
        require_keys_eq!(market_info.key(), expected_market, ErrorCode::Unauthorized);

        let expected_position = Pubkey::create_program_address(
            &[b"position", market.key().as_ref(), position.owner.as_ref(), &[position.bump]],
            &crate::ID,
        ).map_err(|_| error!(ErrorCode::Unauthorized))?;
        require_keys_eq!(position_info.key(), expected_position, ErrorCode::Unauthorized);

        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
                from: user_ata_info.to_account_info(),
                to: vault_info.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            }),
            entry.amount,
        )?;

        match entry.side {
            Side::Yes => {
                market.total_yes = market.total_yes.checked_add(entry.amount).unwrap();
                position.yes_amount = position.yes_amount.checked_add(entry.amount).unwrap();
            }
            Side::No => {
                market.total_no = market.total_no.checked_add(entry.amount).unwrap();
                position.no_amount = position.no_amount.checked_add(entry.amount).unwrap();
            }
        }
        market.exit(&crate::ID)?;
        position.exit(&crate::ID)?;
    }
    Ok(())
}
```

- [ ] **Step 3: ALT smoke test — build `tests/helpers/alt.ts`**

```ts
import {
  AddressLookupTableProgram, PublicKey, Transaction,
  TransactionMessage, VersionedTransaction,
} from "@solana/web3.js";

export async function createALT(
  ctx: ProgramTestContext, payer: Keypair, entries: PublicKey[],
): Promise<PublicKey> {
  const recent = await ctx.banksClient.getLatestBlockhash();
  const [createIx, altAddr] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: (await ctx.banksClient.getClock()).slot - 1n,
  });
  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: altAddr,
    addresses: entries,
  });
  // build + send v0 tx with createIx + extendIx; return altAddr
  return altAddr;
}
```

- [ ] **Step 4: Wire + run + commit**

```bash
anchor test --grep batch
git add -A && git commit -m "feat(solana): batch_bets with ALT support, MAX_BATCH=24"
```

---

## Task 9: ed25519 multisig verification

> **Modified by SA17 + MR4.** No `SigEntry` wrapper struct — pass `Vec<[u8; 64]>` directly; the verifier reads the signer pubkey from the ed25519 precompile ix data (SA12). Also: TWO signed payload shapes per MR4 — close payload carries `TAG_CLOSE`, resolve payload carries `TAG_RESOLVE`. Both flow through this verifier with different `expected` byte strings. Body below shows the single-shape form.

**Files:**
- Modify: `programs/prediction-market/src/oracle.rs`
- Create: `tests/oracle-verify.spec.ts`

Solana's native ed25519 precompile (`Ed25519SigVerify111111111111111111111111111`) verifies signatures *outside* of program execution — the program reads the sysvar `Instructions` to confirm the precompile ran with the right inputs. This pattern is standard for Solana governance systems.

- [ ] **Step 1: Write failing tests**

```ts
it("resolve_market fails if fewer than threshold sigs", async () => { /* ... */ });
it("resolve_market accepts exactly threshold sigs", async () => { /* ... */ });
it("resolve_market rejects signature from non-member", async () => { /* ... */ });
it("resolve_market rejects sig over wrong price payload", async () => { /* ... */ });
```

- [ ] **Step 2: Implement `oracle.rs`**

```rust
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    ed25519_program::ID as ED25519_ID,
    instruction::Instruction,
    sysvar::instructions::{load_instruction_at_checked, ID as IX_SYSVAR_ID},
};
use bytemuck::{Pod, Zeroable};
use crate::state::OracleConfig;
use crate::errors::ErrorCode;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SigEntry { pub signer: Pubkey, pub sig: [u8; 64] }

/// Mirrors the ed25519 precompile record layout (14 bytes, little-endian offsets).
/// Pinned to solana-program = "=1.18.26". CI test hashes the upstream bytes
/// and fails the build if the SDK ever drifts.
#[repr(C, packed)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct Ed25519Offsets {
    pub signature_offset: u16,
    pub signature_instruction_index: u16,
    pub public_key_offset: u16,
    pub public_key_instruction_index: u16,
    pub message_data_offset: u16,
    pub message_data_size: u16,
    pub message_instruction_index: u16,
}
const _: () = assert!(core::mem::size_of::<Ed25519Offsets>() == 14);

/// Re-export of the single source of truth for the signed payload.
/// Canonical spec lives in `crates/payload-spec/`.
pub use payload_spec::build_payload;

/// For each entry `i` in `sigs`, the instruction at `position i` in the
/// current transaction must be a call to the ed25519 precompile that
/// verified `sigs[i].sig` against `sigs[i].signer` over the expected payload.
pub fn verify_multisig(
    oracle: &Account<OracleConfig>,
    market_type: &Pubkey,
    window_start: i64,
    baseline_price: u128,
    final_price: u128,
    resolve_ts: i64,
    sigs: &[SigEntry],
    ix_sysvar: &AccountInfo,
) -> Result<()> {
    require!(ix_sysvar.key == &IX_SYSVAR_ID, ErrorCode::BadSignature);
    require!(sigs.len() >= oracle.active_threshold as usize, ErrorCode::ThresholdNotMet);

    let expected = build_payload(market_type, window_start, baseline_price, final_price, resolve_ts);

    let mut seen: Vec<Pubkey> = Vec::with_capacity(sigs.len());
    for (i, entry) in sigs.iter().enumerate() {
        require!(oracle.active_signers.contains(&entry.signer), ErrorCode::BadSignature);
        require!(!seen.contains(&entry.signer), ErrorCode::BadSignature);
        seen.push(entry.signer);

        let ix: Instruction = load_instruction_at_checked(i, ix_sysvar)
            .map_err(|_| error!(ErrorCode::BadSignature))?;
        require!(ix.program_id == ED25519_ID, ErrorCode::BadSignature);

        // Layout: [num_sigs (u8), padding (u8), Ed25519Offsets (14 bytes), sig || pk || msg].
        let data = &ix.data;
        require!(data[0] == 1, ErrorCode::BadSignature);
        let offsets: &Ed25519Offsets = bytemuck::from_bytes(&data[2..16]);
        let pk_off = offsets.public_key_offset as usize;
        let msg_off = offsets.message_data_offset as usize;
        let msg_len = offsets.message_data_size as usize;
        let sig_off = offsets.signature_offset as usize;
        require!(&data[pk_off..pk_off + 32] == entry.signer.as_ref(), ErrorCode::BadSignature);
        require!(&data[msg_off..msg_off + msg_len] == &expected[..], ErrorCode::BadSignature);
        require!(&data[sig_off..sig_off + 64] == &entry.sig[..], ErrorCode::BadSignature);
    }
    Ok(())
}
```

- [ ] **Step 3: Move `SigEntry` into `oracle.rs` (now lives there, not in `place_bet.rs`)**

- [ ] **Step 4: `resolve_market` (next task) passes `ix_sysvar` — `place_bet` never calls `verify_multisig`**

- [ ] **Step 5: Run tests; commit**

```bash
anchor test --grep oracle
git add -A && git commit -m "feat(solana): ed25519 multisig verification via sysvar"
```

---

## Task 10: `close_market` (new) + `resolve_market` (final-only)

> **Superseded by MR4.** Split into two oracle-signed ixs:
> - **`close_market(final_price unused, baseline_price, sigs)`** — fires at `close_time`. Writes `Market.baseline_price`, emits `MarketClosed`. Signed payload: `source_id || close_time || baseline_price || TAG_CLOSE(1)`.
> - **`resolve_market(final_price, sigs)`** — fires at `settlement_time`. Reads stored baseline, writes `Market.final_price` + `outcome_yes` + `resolved`, emits `MarketResolved`. Signed payload: `source_id || settlement_time || final_price || TAG_RESOLVE(2)`.
>
> Domain tags prevent a close signature from being replayed as a resolve signature. The body below shows the one-shot form; implement two-shot per MR4.

**Files:**
- Create: `programs/prediction-market/src/instructions/resolve.rs`
- Modify: `programs/prediction-market/src/instructions/mod.rs`
- Modify: `programs/prediction-market/src/lib.rs`
- Create: `tests/resolve.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
it("resolve_market before resolve_ts rejected", async () => { /* ... */ });
it("resolve_market sets outcome_yes=true when final >= baseline*(1+bps/10000)", async () => { /* ... */ });
it("resolve_market sets outcome_yes=false otherwise", async () => { /* ... */ });
it("resolve_market stores baseline_price + final_price from signed payload", async () => { /* ... */ });
it("resolve_market rejects double-resolve", async () => { /* ... */ });
it("resolve_market rejects if signed payload doesn't match market_type / window", async () => { /* ... */ });
```

- [ ] **Step 2: Implement**

```rust
// instructions/resolve.rs
use anchor_lang::prelude::*;
use crate::state::{Market, OracleConfig};
use crate::errors::ErrorCode;
use crate::oracle::{verify_multisig, SigEntry};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ResolveArgs {
    pub baseline_price: u128,
    pub final_price: u128,
    pub signatures: Vec<SigEntry>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut, seeds = [b"market", market.market_type.as_ref(), &market.window_start_ts.to_le_bytes()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(seeds = [b"oracle_config"], bump = oracle_config.bump)]
    pub oracle_config: Account<'info, OracleConfig>,
    /// CHECK: sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub ix_sysvar: AccountInfo<'info>,
    pub caller: Signer<'info>,
}

pub fn handler(ctx: Context<ResolveMarket>, args: ResolveArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let m = &mut ctx.accounts.market;
    require!(!m.resolved, ErrorCode::AlreadyResolved);
    require!(now >= m.resolve_ts, ErrorCode::NotResolvable);

    verify_multisig(
        &ctx.accounts.oracle_config,
        &m.market_type,
        m.window_start_ts,
        args.baseline_price,
        args.final_price,
        m.resolve_ts,
        &args.signatures,
        &ctx.accounts.ix_sysvar,
    )?;

    m.baseline_price = args.baseline_price;
    m.final_price = args.final_price;
    m.outcome_yes = outcome_yes(args.baseline_price, args.final_price, m.threshold_bps);
    m.resolved = true;
    Ok(())
}

pub fn outcome_yes(baseline: u128, final_price: u128, threshold_bps: i32) -> bool {
    // target = baseline * (10_000 + threshold_bps) / 10_000
    // YES if final >= target (when threshold positive) or final <= target (when negative).
    let bps = threshold_bps as i128;
    let num = 10_000i128 + bps;
    let target = (baseline as i128) * num / 10_000;
    if threshold_bps >= 0 { (final_price as i128) >= target } else { (final_price as i128) <= target }
}
```

- [ ] **Step 3: Run; verify; commit**

```bash
anchor test --grep resolve
git add -A && git commit -m "feat(solana): resolve_market with multisig verification"
```

---

## Task 11: `claim` — permissionless payout + fee + Position close

> **Superseded by MR5.** Drop the `user: Signer` constraint. Replace with `cranker: Signer`. Payout flows to `position.owner`'s ATA (init_if_needed via MR5 pattern). Fee flows to `fee_vault`. Position closes with rent returning to `position.owner` (not the cranker). The handler handles three paths (winner, stranded refund, loser close) uniformly — see SA21. A keeper bot (or the oracle daemon) sweeps resolved markets and cranks every Position. Users never click.

**Files:**
- Create: `programs/prediction-market/src/instructions/claim.rs`
- Create: `programs/prediction-market/src/math.rs`
- Modify: `programs/prediction-market/src/instructions/mod.rs`
- Modify: `programs/prediction-market/src/lib.rs`
- Create: `tests/claim.spec.ts`

Payout math (fee hits winners only — losers never claim, so no fee path for them):
```
total_pool = total_yes + total_no
winning_stake = user_yes_amount (if YES) else user_no_amount
winning_total = total_yes (if YES) else total_no
gross = total_pool * winning_stake / winning_total
fee = gross * fee_bps / 10_000
net = gross - fee
```

Edge case: if `winning_total == 0` (pool entirely on the losing side — possible if e.g. a surprise candle flips the outcome), nothing to claim and no one calls `claim`. The opposite case (pool entirely on the winning side) degenerates to refund-with-fee: every bettor gets stake back minus fee.

- [ ] **Step 1: Write failing tests**

```ts
it("claim pays winner pro-rata", async () => {
  // YES total 3M, NO total 1M. User has 1M YES. Resolve YES.
  // gross = 4M * 1M / 3M = 1_333_333
  // fee 50bps = 6_666; net = 1_326_667
});

it("claim rejects loser", async () => { /* ... */ });
it("double claim rejected", async () => { /* ... */ });
it("claim refunds all if winning_total == 0", async () => { /* only losers present */ });
```

- [ ] **Step 2: Implement math**

```rust
// math.rs
/// Returns (net_to_user, fee_to_treasury). Caller must guarantee winning_total > 0
/// (enforced in `claim` handler via NotWinner check when stake == 0).
pub fn payout(total_pool: u128, winning_stake: u128, winning_total: u128, fee_bps: u16) -> (u64, u64) {
    debug_assert!(winning_total > 0);
    let gross = total_pool * winning_stake / winning_total;
    let fee = gross * fee_bps as u128 / 10_000;
    ((gross - fee) as u64, fee as u64)
}
```

- [ ] **Step 3: Implement `claim.rs`**

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{GlobalConfig, Market, Position};
use crate::errors::ErrorCode;
use crate::math::payout;

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut, seeds = [b"market", market.market_type.as_ref(), &market.window_start_ts.to_le_bytes()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"position", market.key().as_ref(), user.key().as_ref()], bump = position.bump)]
    pub position: Account<'info, Position>,
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"fee_vault"], bump = config.fee_vault_bump)]
    pub fee_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Claim>) -> Result<()> {
    let m = &ctx.accounts.market;
    require!(m.resolved, ErrorCode::Unresolved);
    let position = &mut ctx.accounts.position;
    require!(!position.claimed, ErrorCode::AlreadyClaimed);

    let stake = if m.outcome_yes { position.yes_amount } else { position.no_amount };
    let winning_total = if m.outcome_yes { m.total_yes } else { m.total_no };
    let total_pool = m.total_yes as u128 + m.total_no as u128;
    require!(stake > 0, ErrorCode::NotWinner);
    require!(winning_total > 0, ErrorCode::NotWinner);

    // No counterparty, no fee: if the entire pool is on one side, every bettor
    // wins their own stake back. Taxing a pool with no losers is theft.
    let effective_fee_bps = if m.total_yes == 0 || m.total_no == 0 {
        0
    } else {
        ctx.accounts.config.fee_bps
    };
    let (net, fee) = payout(total_pool, stake as u128, winning_total as u128, effective_fee_bps);
    position.claimed = true;

    let mt_key = m.market_type;
    let window_bytes = m.window_start_ts.to_le_bytes();
    let seeds: &[&[u8]] = &[b"market", mt_key.as_ref(), &window_bytes, &[m.bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_ata.to_account_info(),
                authority: m.to_account_info(),
            },
            &[seeds],
        ),
        net,
    )?;
    if fee > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                    authority: m.to_account_info(),
                },
                &[seeds],
            ),
            fee,
        )?;
    }
    Ok(())
}
```

- [ ] **Step 4: Wire, run, commit**

```bash
anchor test --grep claim
git add -A && git commit -m "feat(solana): parimutuel claim with fee-on-payout"
```

---

## Task 11b: `reclaim_stranded` — ~~separate ix~~ FOLDED INTO `claim`

> **Superseded by SA3 + MR5.** The stranded-pool refund path lives inside `claim` (winner / stranded / loser unified). Do not implement a separate `reclaim_stranded` ix. The body below documents the original separate-ix design for historical context.

**Files:**
- Create: `programs/prediction-market/src/instructions/reclaim_stranded.rs`
- Modify: `programs/prediction-market/src/instructions/mod.rs`
- Modify: `programs/prediction-market/src/lib.rs`

If a market resolves with `winning_total == 0` (every bettor picked the losing side), `claim` is unreachable — stakes would sit forever. `reclaim_stranded` refunds each position their full combined stake. Permissionless — anyone can crank it per position.

- [ ] **Step 1: Tests**

```ts
it("reclaim_stranded refunds full stake when winning_total == 0", async () => {
  // Construct a market where everyone bets YES, outcome resolves NO → winning_total == 0
  // Call reclaim_stranded per position, assert each user's ATA balance returns to pre-bet.
});
it("reclaim_stranded rejects when winning_total > 0", async () => { /* ... */ });
it("reclaim_stranded rejects unresolved market", async () => { /* ... */ });
```

- [ ] **Step 2: Implement**

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{Market, Position};
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct ReclaimStranded<'info> {
    #[account(mut, seeds = [b"market", market.market_type.as_ref(), &market.window_start_ts.to_le_bytes()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), position.owner.as_ref()],
        bump = position.bump,
        close = rent_receiver,
    )]
    pub position: Account<'info, Position>,
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub owner_ata: Account<'info, TokenAccount>,
    /// CHECK: matches position.owner
    #[account(mut, address = position.owner)]
    pub rent_receiver: UncheckedAccount<'info>,
    pub cranker: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ReclaimStranded>) -> Result<()> {
    let m = &ctx.accounts.market;
    require!(m.resolved, ErrorCode::Unresolved);
    let winning_total = if m.outcome_yes { m.total_yes } else { m.total_no };
    require!(winning_total == 0, ErrorCode::StrandedOnly);

    let refund = ctx.accounts.position.yes_amount
        .checked_add(ctx.accounts.position.no_amount).unwrap();

    let mt_key = m.market_type;
    let window_bytes = m.window_start_ts.to_le_bytes();
    let seeds: &[&[u8]] = &[b"market", mt_key.as_ref(), &window_bytes, &[m.bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.owner_ata.to_account_info(),
                authority: m.to_account_info(),
            },
            &[seeds],
        ),
        refund,
    )?;
    Ok(())
}
```

- [ ] **Step 3: Wire, run, commit**

```bash
anchor test --grep reclaim_stranded
git commit -m "feat(solana): reclaim_stranded for fully one-sided losing pools"
```

---

## Task 12: Admin ops — pause, fee adjust, proportional force-resolve

> **Superseded by MR6, MR7.** Force-resolve unlocks at `now >= settlement_time + (settlement_time - close_time)` (one full observation window past missed settlement), not the hardcoded 12h. No ops CLI — admin monitors manually and calls `admin_force_resolve` directly.

**Files:**
- Create: `programs/prediction-market/src/instructions/admin.rs`
- Modify: `lib.rs`, `instructions/mod.rs`

**Force-resolve semantics:** if the oracle daemon dies and doesn't push `resolve_market` within 12 hours of `resolve_ts`, admin can unilaterally resolve. Admin passes `baseline_price` and `final_price` directly — no multisig. The market records `force_resolved = true` so post-mortem inspection distinguishes admin-resolved markets from normal ones. Until the 12h window elapses, force-resolve is rejected — the daemon's normal path remains the only resolution route.

- [ ] **Step 1: Tests**

```ts
it("non-admin cannot pause", async () => { /* ... */ });
it("admin can pause; place_bet rejected while paused", async () => { /* ... */ });
it("admin can update fee_bps; rejected > 10000", async () => { /* ... */ });
it("force_resolve rejected before resolve_ts + 12h", async () => {
  // warp to resolve_ts + 12h - 1; expect ForceResolveTooEarly
});
it("force_resolve allowed after 12h silence", async () => {
  // warp to resolve_ts + 12h + 1; admin calls with baseline/final; market resolves
  const m = await program.account.market.fetch(marketPda);
  expect(m.resolved).to.be.true;
  expect(m.forceResolved).to.be.true;
});
it("force_resolve blocked if market already resolved normally", async () => {
  // Daemon resolves normally; admin tries force_resolve; expect AlreadyResolved
});
it("non-admin cannot force_resolve", async () => { /* ... */ });
```

- [ ] **Step 2: Implement**

```rust
use anchor_lang::prelude::*;
use crate::state::{GlobalConfig, Market};
use crate::errors::ErrorCode;
use crate::instructions::resolve::outcome_yes;

pub const FORCE_RESOLVE_DELAY: i64 = 12 * 3600;

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
}

pub fn set_pause(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
    ctx.accounts.config.paused = paused; Ok(())
}

pub fn set_fee_bps(ctx: Context<AdminOnly>, fee_bps: u16) -> Result<()> {
    require!(fee_bps <= 10_000, ErrorCode::FeeTooHigh);
    ctx.accounts.config.fee_bps = fee_bps; Ok(())
}

#[derive(Accounts)]
pub struct ForceResolve<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        mut,
        seeds = [b"market", market.market_type.as_ref(), &market.window_start_ts.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
    pub admin: Signer<'info>,
}

pub fn force_resolve(
    ctx: Context<ForceResolve>,
    baseline_price: u128,
    final_price: u128,
) -> Result<()> {
    let m = &mut ctx.accounts.market;
    require!(!m.resolved, ErrorCode::AlreadyResolved);
    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= m.resolve_ts + FORCE_RESOLVE_DELAY,
        ErrorCode::ForceResolveTooEarly
    );
    m.baseline_price = baseline_price;
    m.final_price = final_price;
    m.outcome_yes = outcome_yes(baseline_price, final_price, m.threshold_bps);
    m.resolved = true;
    m.force_resolved = true;
    Ok(())
}
```

- [ ] **Step 3: `force_resolved: bool` already declared on `Market` in Task 5 and counted in `Market::LEN` — no schema change here. Task 12 only writes the flag.**

- [ ] **Step 4: Wire in `lib.rs`**

```rust
pub fn admin_force_resolve(
    ctx: Context<ForceResolve>,
    baseline_price: u128,
    final_price: u128,
) -> Result<()> { admin::force_resolve(ctx, baseline_price, final_price) }
```

- [ ] **Step 5: Run; commit**

---

## Task 13: End-to-end lifecycle test

**Files:**
- Create: `tests/e2e.spec.ts`

Flow: init → register MarketType(source=7, threshold=+50) → propose signers → warp 24h → activate → alice bets YES 1M (instantiates Market for this window) → bob bets NO 500k → warp 100s (still pre-lock) → bob exits 100k → warp 300s (past resolve_ts) → submit signed `(baseline=1e18, final=1.01e18)` payload → alice claims → bob blocked.

- [ ] **Step 1: Write e2e test**

```ts
it("full 5-minute lifecycle", async () => {
  const f = await factories.e2e(); // init config, register MarketType, activate oracle, fund ATAs
  const start = alignWindow(await nowSec(f.ctx));

  await f.placeBet(f.alice, Side.Yes, 1_000_000, start);
  await f.placeBet(f.bob,   Side.No,    500_000, start);
  expect((await f.market(start)).totalYes.toString()).to.eq("1000000");

  await warp(f.ctx, 100); // still pre-lock
  await f.exitBet(f.bob, Side.No, 100_000);
  expect((await f.market(start)).totalNo.toString()).to.eq("400000");

  await warp(f.ctx, 300); // past resolve_ts
  const baseline = new BN("1000000000000000000"); // 1.0
  const final_   = new BN("1010000000000000000"); // +1%, above +0.5% threshold → YES
  await f.resolve(start, baseline, final_, [0, 1]);

  const before = await f.balanceOf(f.alice);
  await f.claim(f.alice, start);
  const after = await f.balanceOf(f.alice);
  // gross = 1_400_000 * 1_000_000 / 1_000_000 = 1_400_000; fee 50bps = 7_000; net = 1_393_000
  expect((after - before).toString()).to.eq("1393000");

  await expect(f.claim(f.bob, start)).to.be.rejectedWith(/NotWinner/);
});
```

- [ ] **Step 2: Run; commit**

```bash
anchor test --grep e2e
git add -A && git commit -m "test(solana): full 5-minute lifecycle e2e"
```

---

## Task 14: Mini oracle daemon — stateless close + resolve + claim cranking

> **Superseded by MR4, MR5, MR8.** The daemon is fully stateless (no SQLite, no tick cache, no baselines file). On each wake the daemon queries chain state three ways:
> 1. `Market` where `baseline_price == 0 && close_time <= now` → submit `close_market(baseline, sigs)`.
> 2. `Market` where `baseline_price > 0 && !resolved && settlement_time <= now` → submit `resolve_market(final, sigs)`.
> 3. `Market` where `resolved && Position.claimed == false` (optional, can live in a separate keeper) → submit `claim(position)` as the cranker.
>
> Delete `baselines.rs`, `tick_cache`, `discovery_interval`, `Deps` struct. The daemon's only persistent artifact is its ed25519 keypair on disk.

**Files:**
- Create: `oracle-daemon/Cargo.toml`
- Create: `oracle-daemon/src/main.rs`
- Create: `oracle-daemon/src/config.rs`
- Create: `oracle-daemon/src/feed.rs`
- Create: `oracle-daemon/src/discovery.rs`
- Create: `oracle-daemon/src/baselines.rs`
- Create: `oracle-daemon/src/scheduler.rs`
- Create: `oracle-daemon/src/signer.rs`
- Create: `oracle-daemon/src/submitter.rs`
- Create: `oracle-daemon/src/metrics.rs`
- Create: `oracle-daemon/tests/integration.rs`

**Design:** single-node Rust daemon. Threshold=1 signer at launch, multisig machinery on-chain intact for later. The daemon is stateful on exactly one thing — captured baselines per `(market_type, window_start)` — persisted to SQLite so a restart mid-window doesn't drop a baseline.

**Per-MarketType scheduling:** every MarketType has its own `settlement_duration` (and therefore its own window cadence). The daemon tracks each type independently — a 5-minute type fires on 300s boundaries, a 1-hour type fires on 3600s boundaries. Baselines are captured at `window_start` for that type. Resolution fires at `window_start + settlement_duration` for that type.

**Lifecycle per MarketType per window:**
1. At `T = window_start_for_type`: fetch current price from data-node, write to `baselines` table.
2. At `T + lock_duration`: nothing — the daemon doesn't participate in lock enforcement.
3. At `T + settlement_duration`: fetch final price, look up baseline, sign payload, submit `resolve_market`. On success delete baseline row. On failure retry with exponential backoff. If still unresolved at `T + settlement_duration + 12h`, alert — admin may `admin_force_resolve`.

**Discovery loop** (every 30s): refresh the in-memory list of enabled MarketTypes from chain. Each type carries its own `(source_id, threshold_bps, lock_duration, settlement_duration)`. New types get picked up at their next window boundary.

**Batching:** one v0 tx per market at launch. If resolve volume grows, a follow-up could pack multiple `resolve_market` calls into one tx (not in this task).

- [ ] **Step 1: `Cargo.toml`**

```toml
[package]
name = "prediction-market-oracle"
version = "0.1.0"
edition = "2021"

[dependencies]
anchor-client = "0.30.1"
solana-client = "1.18"
solana-sdk = "1.18"
solana-program = "1.18"
ed25519-dalek = "2.1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
anyhow = "1"
tracing = "0.1"
tracing-subscriber = "0.3"
prometheus = "0.13"
clap = { version = "4", features = ["derive"] }
```

- [ ] **Step 2: `config.rs` — env-driven config**

```rust
use serde::Deserialize;

#[derive(Deserialize, Clone)]
pub struct Config {
    pub rpc_url: String,
    pub program_id: String,
    pub oracle_keypair_path: String,
    pub data_node_url: String,
    pub baseline_db: String,           // path to SQLite
    pub metrics_port: u16,
    pub discovery_interval_secs: u64,  // default 30
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            rpc_url: std::env::var("RPC_URL")?,
            program_id: std::env::var("PROGRAM_ID")?,
            oracle_keypair_path: std::env::var("ORACLE_KEYPAIR")?,
            data_node_url: std::env::var("DATA_NODE_URL")?,
            baseline_db: std::env::var("BASELINE_DB").unwrap_or("baselines.db".into()),
            metrics_port: std::env::var("METRICS_PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(9091),
            discovery_interval_secs: 30,
        })
    }
}
```

- [ ] **Step 3: `feed.rs` — data-node HTTP client**

```rust
use serde::Deserialize;

pub struct Feed { base: String, client: reqwest::Client }

#[derive(Deserialize)]
pub struct PriceResponse { pub price: u128, pub ts: i64 }

impl Feed {
    pub fn new(base: String) -> Self { Self { base, client: reqwest::Client::new() } }

    pub async fn price(&self, source_id: u32) -> anyhow::Result<PriceResponse> {
        let url = format!("{}/v1/sources/{}/price", self.base, source_id);
        Ok(self.client.get(url).send().await?.error_for_status()?.json().await?)
    }
}
```

- [ ] **Step 4: `baselines.rs` — SQLite-backed baseline cache**

```rust
use rusqlite::{params, Connection};
use solana_sdk::pubkey::Pubkey;

pub struct Baselines { conn: Connection }

impl Baselines {
    pub fn open(path: &str) -> anyhow::Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS baselines (
                market_type TEXT NOT NULL,
                window_start INTEGER NOT NULL,
                price TEXT NOT NULL,
                captured_at INTEGER NOT NULL,
                PRIMARY KEY (market_type, window_start)
            )", [],
        )?;
        Ok(Self { conn })
    }

    pub fn put(&self, mt: &Pubkey, window_start: i64, price: u128) -> anyhow::Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO baselines VALUES (?1, ?2, ?3, strftime('%s','now'))",
            params![mt.to_string(), window_start, price.to_string()],
        )?;
        Ok(())
    }

    pub fn get(&self, mt: &Pubkey, window_start: i64) -> anyhow::Result<Option<u128>> {
        let mut stmt = self.conn.prepare(
            "SELECT price FROM baselines WHERE market_type = ?1 AND window_start = ?2",
        )?;
        let price: Option<String> = stmt.query_row(
            params![mt.to_string(), window_start],
            |r| r.get(0),
        ).ok();
        Ok(price.map(|s| s.parse().unwrap()))
    }

    pub fn delete(&self, mt: &Pubkey, window_start: i64) -> anyhow::Result<()> {
        self.conn.execute(
            "DELETE FROM baselines WHERE market_type = ?1 AND window_start = ?2",
            params![mt.to_string(), window_start],
        )?;
        Ok(())
    }
}
```

- [ ] **Step 5: `discovery.rs` — list registered `MarketType` PDAs**

```rust
use anchor_client::{Client, Cluster, Program};
use solana_sdk::pubkey::Pubkey;
use std::sync::Arc;

#[derive(Clone)]
pub struct MarketTypeInfo {
    pub pda: Pubkey,
    pub source_id: u32,
    pub threshold_bps: i32,
    pub lock_duration: i64,
    pub settlement_duration: i64,
    pub enabled: bool,
}

pub async fn list_market_types(program: &Program<Arc<solana_sdk::signer::keypair::Keypair>>) -> anyhow::Result<Vec<MarketTypeInfo>> {
    let accounts: Vec<(Pubkey, prediction_market::state::MarketType)> =
        program.accounts(vec![]).await?;
    Ok(accounts.into_iter().map(|(pda, t)| MarketTypeInfo {
        pda,
        source_id: t.source_id,
        threshold_bps: t.threshold_bps,
        lock_duration: t.lock_duration,
        settlement_duration: t.settlement_duration,
        enabled: t.enabled,
    }).filter(|m| m.enabled).collect())
}
```

- [ ] **Step 6: `signer.rs` — build signed payload**

```rust
use ed25519_dalek::{Signer, SigningKey};
use solana_sdk::pubkey::Pubkey;

pub fn build_payload(
    market_type: &Pubkey, window_start: i64,
    baseline: u128, final_: u128, resolve_ts: i64,
) -> Vec<u8> {
    let mut buf = Vec::with_capacity(32 + 8 + 16 + 16 + 8);
    buf.extend_from_slice(market_type.as_ref());
    buf.extend_from_slice(&window_start.to_le_bytes());
    buf.extend_from_slice(&baseline.to_le_bytes());
    buf.extend_from_slice(&final_.to_le_bytes());
    buf.extend_from_slice(&resolve_ts.to_le_bytes());
    buf
}

pub fn sign(sk: &SigningKey, payload: &[u8]) -> [u8; 64] {
    sk.sign(payload).to_bytes()
}
```

- [ ] **Step 7: `submitter.rs` — build + send v0 tx with Ed25519 precompile + resolve**

```rust
use solana_sdk::{
    ed25519_program,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::Signer,
    transaction::Transaction,
};
use anchor_client::{Client, Program};
use std::sync::Arc;

/// Build the ed25519 precompile instruction by hand. Mirrors the layout
/// consumed by the program's `oracle::verify_multisig`: a 1-byte count,
/// 1-byte padding, a 14-byte Ed25519Offsets record, then sig || pk || msg.
/// No solana-sdk helper — that surface drifts, and drift in crypto is silent failure.
fn build_ed25519_ix(pubkey: &[u8; 32], signature: &[u8; 64], message: &[u8]) -> Instruction {
    const HEADER: usize = 2 + 14;
    let sig_offset = HEADER as u16;
    let pk_offset  = sig_offset + 64;
    let msg_offset = pk_offset + 32;

    let mut data = Vec::with_capacity(HEADER + 64 + 32 + message.len());
    data.push(1);                              // num_signatures
    data.push(0);                              // padding
    data.extend_from_slice(&sig_offset.to_le_bytes());
    data.extend_from_slice(&u16::MAX.to_le_bytes()); // sig_instruction_index (same ix)
    data.extend_from_slice(&pk_offset.to_le_bytes());
    data.extend_from_slice(&u16::MAX.to_le_bytes());
    data.extend_from_slice(&msg_offset.to_le_bytes());
    data.extend_from_slice(&(message.len() as u16).to_le_bytes());
    data.extend_from_slice(&u16::MAX.to_le_bytes());
    data.extend_from_slice(signature);
    data.extend_from_slice(pubkey);
    data.extend_from_slice(message);

    Instruction { program_id: ed25519_program::ID, accounts: vec![], data }
}

pub async fn submit_resolve(
    program: &Program<Arc<solana_sdk::signer::keypair::Keypair>>,
    market: Pubkey,
    oracle_config: Pubkey,
    signer_pubkey: Pubkey,
    signature: [u8; 64],
    payload: Vec<u8>,
    baseline: u128,
    final_: u128,
) -> anyhow::Result<String> {
    let ed_ix = build_ed25519_ix(&signer_pubkey.to_bytes(), &signature, &payload);

    let resolve_ix = program
        .request()
        .accounts(prediction_market::accounts::ResolveMarket {
            market,
            oracle_config,
            ix_sysvar: solana_sdk::sysvar::instructions::id(),
            caller: program.payer(),
        })
        .args(prediction_market::instruction::ResolveMarket {
            args: prediction_market::instructions::resolve::ResolveArgs {
                baseline_price: baseline,
                final_price: final_,
                signatures: vec![prediction_market::oracle::SigEntry {
                    signer: signer_pubkey,
                    sig: signature,
                }],
            },
        })
        .instructions()?
        .pop()
        .unwrap();

    let sig = program.rpc().send_and_confirm_transaction(
        &Transaction::new_signed_with_payer(
            &[ed_ix, resolve_ix],
            Some(&program.payer()),
            &[program.payer_keypair().as_ref()],
            program.rpc().get_latest_blockhash()?,
        ),
    )?;
    Ok(sig.to_string())
}
```

- [ ] **Step 8: `scheduler.rs` — window-aligned ticker**

```rust
use tokio::time::{sleep_until, Instant};
use std::time::{SystemTime, UNIX_EPOCH, Duration};

pub fn now_unix() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64
}

pub fn next_boundary(now: i64, settlement_duration: i64) -> i64 {
    (now / settlement_duration + 1) * settlement_duration
}

pub async fn sleep_until_unix(target: i64) {
    let now = now_unix();
    if target <= now { return; }
    sleep_until(Instant::now() + Duration::from_secs((target - now) as u64)).await;
}

/// One tokio task per MarketType — each type ticks on its own cadence.
/// On every boundary for that type: capture baseline for this window, resolve the prior window.
pub async fn run_type_loop(
    deps: std::sync::Arc<super::Deps>,
    mt: super::discovery::MarketTypeInfo,
) -> anyhow::Result<()> {
    let d = mt.settlement_duration;
    loop {
        // Re-read the MarketType from chain each iteration so we pick up durations changes.
        // (Current design freezes durations at registration — this is a forward-compat hook.)
        let boundary = next_boundary(now_unix(), d);
        sleep_until_unix(boundary).await;

        // At `boundary`: capture baseline for the window that STARTS now.
        deps.capture_baseline_for(&mt, boundary).await.ok();

        // Resolve the PRIOR window for this type. Its window_start = boundary - settlement_duration.
        let prior_window = boundary - d;
        if prior_window >= 0 {
            deps.resolve_window_for(&mt, prior_window).await.ok();
        }
    }
}

/// Top-level: discover types, spawn a loop per type, rediscover every 30s to pick up new types.
pub async fn run(deps: std::sync::Arc<super::Deps>) -> anyhow::Result<()> {
    let mut known: std::collections::HashSet<solana_sdk::pubkey::Pubkey> = Default::default();
    loop {
        let types = super::discovery::list_market_types(&deps.program).await?;
        for mt in types {
            if known.insert(mt.pda) {
                let d = deps.clone();
                tokio::spawn(async move {
                    if let Err(e) = run_type_loop(d, mt.clone()).await {
                        tracing::error!(market_type=%mt.pda, error=%e, "type loop died");
                    }
                });
            }
        }
        tokio::time::sleep(Duration::from_secs(30)).await;
    }
}
```

- [ ] **Step 9: `main.rs` — wire everything**

```rust
use anchor_client::{Client, Cluster};
use solana_sdk::{commitment_config::CommitmentConfig, signature::read_keypair_file};
use std::sync::Arc;

mod baselines; mod config; mod discovery; mod feed; mod metrics;
mod scheduler; mod signer; mod submitter;

pub struct Deps {
    pub feed: feed::Feed,
    pub baselines: baselines::Baselines,
    pub program: anchor_client::Program<Arc<solana_sdk::signer::keypair::Keypair>>,
    pub signing_key: ed25519_dalek::SigningKey,
    pub signer_pubkey: solana_sdk::pubkey::Pubkey,
}

impl Deps {
    pub async fn capture_baseline_for(
        &self,
        mt: &discovery::MarketTypeInfo,
        window_start: i64,
    ) -> anyhow::Result<()> {
        match self.feed.price(mt.source_id).await {
            Ok(p) => {
                self.baselines.put(&mt.pda, window_start, p.price)?;
                tracing::info!(source=%mt.source_id, window=%window_start, price=%p.price, "baseline captured");
            }
            Err(e) => tracing::error!(source=%mt.source_id, error=%e, "baseline fetch failed"),
        }
        Ok(())
    }

    pub async fn resolve_window_for(
        &self,
        mt: &discovery::MarketTypeInfo,
        window_start: i64,
    ) -> anyhow::Result<()> {
        let Some(baseline) = self.baselines.get(&mt.pda, window_start)? else {
            tracing::warn!(market_type=%mt.pda, window=%window_start, "no baseline — skipping");
            return Ok(());
        };
        let final_price = match self.feed.price(mt.source_id).await {
            Ok(p) => p.price,
            Err(e) => { tracing::error!(error=%e, "final fetch failed"); return Ok(()); }
        };
        let resolve_ts = window_start + mt.settlement_duration;
        let payload = signer::build_payload(&mt.pda, window_start, baseline, final_price, resolve_ts);
        let sig = signer::sign(&self.signing_key, &payload);

        let (market, _) = solana_sdk::pubkey::Pubkey::find_program_address(
            &[b"market", mt.pda.as_ref(), &window_start.to_le_bytes()],
            &self.program.id(),
        );
        let (oracle_config, _) = solana_sdk::pubkey::Pubkey::find_program_address(
            &[b"oracle_config"], &self.program.id(),
        );

        match submitter::submit_resolve(
            &self.program, market, oracle_config,
            self.signer_pubkey, sig, payload, baseline, final_price,
        ).await {
            Ok(tx) => {
                tracing::info!(tx=%tx, market=%market, "resolved");
                self.baselines.delete(&mt.pda, window_start)?;
            }
            Err(e) => tracing::error!(error=%e, market=%market, "resolve failed"),
        }
        Ok(())
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    let cfg = config::Config::from_env()?;
    let kp = Arc::new(read_keypair_file(&cfg.oracle_keypair_path).map_err(|e| anyhow::anyhow!("{e}"))?);
    let client = Client::new_with_options(
        Cluster::Custom(cfg.rpc_url.clone(), cfg.rpc_url.clone()),
        kp.clone(),
        CommitmentConfig::confirmed(),
    );
    let program_id = cfg.program_id.parse()?;
    let program = client.program(program_id)?;

    // Solana pubkeys ARE ed25519 public keys. We derive the signing key from
    // the same 32-byte seed and assert the derived verifying key matches the
    // Solana pubkey. If the SDK ever breaks this invariant, we panic at boot
    // instead of shipping bad signatures.
    let signing_key = ed25519_dalek::SigningKey::from_bytes(
        &kp.to_bytes()[0..32].try_into()?,
    );
    let signer_pubkey = solana_sdk::pubkey::Pubkey::new_from_array(
        signing_key.verifying_key().to_bytes(),
    );
    assert_eq!(signer_pubkey, kp.pubkey(),
        "ed25519 verifying key diverged from Solana pubkey — refusing to start");

    let deps = Deps {
        feed: feed::Feed::new(cfg.data_node_url.clone()),
        baselines: baselines::Baselines::open(&cfg.baseline_db)?,
        program, signing_key, signer_pubkey,
    };

    metrics::spawn_server(cfg.metrics_port);
    scheduler::run(std::sync::Arc::new(deps)).await
}
```

- [ ] **Step 10: Integration test `tests/integration.rs` — end-to-end with program + daemon against `solana-test-validator`**

```rust
// pseudocode for the integration harness:
// 1. spawn solana-test-validator
// 2. deploy the program
// 3. initialize_config + register MarketType(7, 50) + propose + activate signers with the daemon's pubkey
// 4. start the daemon
// 5. user places a bet
// 6. wait for the window to roll, assert daemon resolved the market
// 7. user claims, asserts payout matches expectation
```

- [ ] **Step 11: Build, test, commit**

```bash
cd oracle-daemon
cargo build --release
cargo test --release
git add -A
git commit -m "feat(oracle): mini single-node oracle daemon — discover, capture, resolve"
```

---

## Task 15: Devnet deployment + program and daemon smoke

**Files:**
- Create: `scripts/deploy-devnet.sh`
- Create: `scripts/smoke-devnet.ts`
- Create: `oracle-daemon/systemd/prediction-oracle.service`

- [ ] **Step 1: Deploy script**

```bash
#!/usr/bin/env bash
set -euo pipefail
solana config set --url devnet
anchor build
anchor deploy --provider.cluster devnet
PROGRAM_ID=$(solana address -k target/deploy/prediction_market-keypair.json)
echo "Deployed program: $PROGRAM_ID"

# Generate oracle keypair if missing, fund it, register as signer
test -f oracle-daemon/oracle.json || solana-keygen new --no-bip39-passphrase -o oracle-daemon/oracle.json
solana airdrop 2 $(solana address -k oracle-daemon/oracle.json) --url devnet

echo "Run: ts-node scripts/smoke-devnet.ts $PROGRAM_ID oracle-daemon/oracle.json"
```

- [ ] **Step 2: Smoke script `scripts/smoke-devnet.ts`**

```ts
// 1. initialize_config
// 2. register MarketType(source=7, threshold=50)
// 3. propose_oracle_signers([oracle.pubkey], 1)
// 4. assert pending visible; do NOT wait 24h (devnet smoke)
// 5. print addresses for wiring the daemon env vars
```

- [ ] **Step 3: Systemd unit for the daemon (VPS deployment)**

```ini
[Unit]
Description=Prediction Market Oracle Daemon
After=network.target

[Service]
Type=simple
User=oracle
Environment=RPC_URL=https://api.devnet.solana.com
Environment=PROGRAM_ID=...
Environment=ORACLE_KEYPAIR=/etc/prediction-oracle/oracle.json
Environment=DATA_NODE_URL=http://159.195.78.238:8200  # post-Netcup VPS 1; was http://10.2.0.3:8200 on Hetzner. See CLAUDE.md "Netcup migration".
Environment=BASELINE_DB=/var/lib/prediction-oracle/baselines.db
ExecStart=/usr/local/bin/prediction-market-oracle
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 4: Deploy, run smoke, commit**

```bash
bash scripts/deploy-devnet.sh
ts-node scripts/smoke-devnet.ts <PROGRAM_ID> oracle-daemon/oracle.json
git add -A && git commit -m "chore(solana): devnet deployment + oracle systemd unit"
```

---

## Phase 2 — Hardening Tasks

Fourteen gaps identified by parallel user-journey scans, solutions converged across two agent rounds. Each item below closes a specific failure mode. Complete Phase 1 (Tasks 1–15) first — these assume the core ships.

---

### Task H1: Auto-create user ATA in `place_bet` — ~~FOLDED INTO TASK 6 (SA7)~~

> **Deleted.** Auto-ATA ships in Task 6 directly. Body below kept only as scaffolding reference.

**Files:**
- Modify: `programs/prediction-market/src/instructions/place_bet.rs`

- [ ] **Step 1: Add `associated_token` import and replace `user_ata` constraint**

```rust
use anchor_spl::associated_token::AssociatedToken;

// In PlaceBet accounts struct, replace existing user_ata:
#[account(
    init_if_needed,
    payer = user,
    associated_token::mint = stake_mint,
    associated_token::authority = user,
)]
pub user_ata: Account<'info, TokenAccount>,

pub associated_token_program: Program<'info, AssociatedToken>,
```

- [ ] **Step 2: Mirror in `exit_bet.rs` and `claim.rs`** so refunds and payouts to first-touch wallets also self-create.

- [ ] **Step 3: Test — bet from a wallet with no USDC ATA, assert ATA exists after tx, assert balance correct**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(solana): auto-init user USDC ATA in place_bet/exit/claim"
```

---

### Task H2: Document first-bettor rent cost

**Files:**
- Create: `docs/solana-rent-costs.md`

- [ ] **Step 1: Write the doc**

Content: enumerate the PDAs a first bettor funds (`Market`, `Position`, `vault` TokenAccount, and now `user_ata`). Give current rent figures (~0.002 SOL per TokenAccount, ~0.00089 SOL per 128-byte PDA). Total first-click cost: ~0.01 SOL. Recommend that any frontend consumer run `connection.getBalance(user)` pre-flight and refuse to submit below 0.02 SOL with a human-readable message.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: first-bettor SOL rent requirement"
```

---

### Task H3: MarketType directory — ~~FOLDED INTO TASK 5 (SA8) + OBSOLETE (MR1)~~

> **Deleted.** The `name` field moves to `Source` (MR1). `MarketTypeRegistered` event becomes `SourceRegistered` if emitted at all (MR10 open question). Body below is historical.

**Files:**
- Modify: `programs/prediction-market/src/state.rs`
- Modify: `programs/prediction-market/src/instructions/market_type.rs`
- Modify: `programs/prediction-market/src/lib.rs`

- [ ] **Step 1: Add field to `MarketType`**

```rust
#[account]
pub struct MarketType {
    pub source_id: u32,
    pub threshold_bps: i32,
    pub lock_duration: i64,
    pub settlement_duration: i64,
    pub name: [u8; 32],   // UTF-8 bytes, admin-supplied; "BTC/USD +0.5% 5m" etc.
    pub enabled: bool,
    pub bump: u8,
}
impl MarketType { pub const LEN: usize = 8 + 4 + 4 + 8 + 8 + 32 + 1 + 1; }
```

- [ ] **Step 2: Update `register_market_type` to accept `name: [u8; 32]`**

- [ ] **Step 3: Emit event**

```rust
#[event]
pub struct MarketTypeRegistered {
    pub market_type: Pubkey,
    pub source_id: u32,
    pub threshold_bps: i32,
    pub lock_duration: i64,
    pub settlement_duration: i64,
    pub name: [u8; 32],
}

emit!(MarketTypeRegistered { /* ... */ });
```

- [ ] **Step 4: Test — decode event log after registration, assert name matches**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(solana): MarketType name + registration event"
```

---

### Task H4: `BetPlaced` / `BetExited` events — ~~FOLDED INTO TASKS 6/7/8 (SA8)~~

> **Deleted.** Event emissions ship inline in `place_bet`, `exit_bet`, and `batch_bets`. Body below is reference for the event struct definitions.

**Files:**
- Modify: `programs/prediction-market/src/instructions/place_bet.rs`
- Modify: `programs/prediction-market/src/instructions/exit_bet.rs`
- Modify: `programs/prediction-market/src/instructions/batch_bets.rs`

- [ ] **Step 1: Define events**

```rust
#[event]
pub struct BetPlaced {
    pub position: Pubkey,
    pub market: Pubkey,
    pub owner: Pubkey,
    pub side: u8,   // 0 = YES, 1 = NO
    pub amount: u64,
    pub total_yes: u64,
    pub total_no: u64,
}

#[event]
pub struct BetExited {
    pub position: Pubkey,
    pub market: Pubkey,
    pub owner: Pubkey,
    pub side: u8,
    pub amount: u64,
}
```

- [ ] **Step 2: Emit at end of each handler, including every entry in `batch_bets`**

- [ ] **Step 3: Test — bet, then decode tx logs, assert one event per entry**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(solana): BetPlaced / BetExited events"
```

---

### Task H5: Remaining events — ~~FOLDED INTO TASKS 5/10/11 (SA8)~~

> **Deleted.** Events ship inline in their originating handlers. Plus `MarketClosed` added for MR4's `close_market` ix. Body below is reference only.

**Files:**
- Modify: `programs/prediction-market/src/instructions/resolve.rs`
- Modify: `programs/prediction-market/src/instructions/admin.rs` (force_resolve)
- Modify: `programs/prediction-market/src/instructions/claim.rs`
- Modify: `programs/prediction-market/src/instructions/place_bet.rs` (MarketInstantiated on is_first branch)
- Modify: `programs/prediction-market/src/instructions/oracle_signers.rs`

- [ ] **Step 1: Define events**

```rust
#[event]
pub struct MarketInstantiated {
    pub market: Pubkey, pub market_type: Pubkey, pub window_start_ts: i64,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey, pub baseline_price: u128, pub final_price: u128,
    pub outcome_yes: bool, pub force_resolved: bool,
}

#[event]
pub struct Claimed {
    pub market: Pubkey, pub owner: Pubkey, pub net: u64, pub fee: u64,
}

#[event]
pub struct OracleSignersActivated {
    pub signers: Vec<Pubkey>, pub threshold: u8, pub activated_at: i64,
}
```

- [ ] **Step 2: Emit at each handler's terminal success path**

- [ ] **Step 3: Test — assert every mutating path produces exactly one event**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(solana): full event set for indexers"
```

---

### Task H6: Rent reclamation — ~~FOLDED INTO TASK 11 (SA3 + SA4 + MR5)~~

> **Deleted.** `claim` uniformly closes Position on all three paths (winner, stranded, loser). No separate `close_losing_position` ix. Body below is historical.

**Files:**
- Modify: `programs/prediction-market/src/instructions/claim.rs`
- Create: `programs/prediction-market/src/instructions/close_losing_position.rs`
- Modify: `programs/prediction-market/src/instructions/mod.rs`
- Modify: `programs/prediction-market/src/lib.rs`

- [ ] **Step 1: Winners' Position closes automatically**

In `Claim` accounts struct, add `close = user` to the `position` account. Rent returns to the claimant at end of ix.

- [ ] **Step 2: Implement `close_losing_position.rs` — permissionless crank**

```rust
#[derive(Accounts)]
pub struct CloseLosingPosition<'info> {
    #[account(seeds = [b"market", market.market_type.as_ref(), &market.window_start_ts.to_le_bytes()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), position.owner.as_ref()],
        bump = position.bump,
        close = rent_receiver,
    )]
    pub position: Account<'info, Position>,
    /// CHECK: arbitrary wallet, receives the reclaimed rent (typically = position.owner)
    #[account(mut, address = position.owner)]
    pub rent_receiver: UncheckedAccount<'info>,
    pub cranker: Signer<'info>,
}

pub fn handler(ctx: Context<CloseLosingPosition>) -> Result<()> {
    let m = &ctx.accounts.market;
    let p = &ctx.accounts.position;
    require!(m.resolved, ErrorCode::Unresolved);
    let stake = if m.outcome_yes { p.yes_amount } else { p.no_amount };
    require!(stake == 0, ErrorCode::NotWinner); // only losers are eligible
    Ok(())
}
```

- [ ] **Step 3: Market PDAs stay** — historical record, small fixed rent. No `close_market` ix.

- [ ] **Step 4: Test — resolve a market, have a loser's position closed via crank, assert rent returns to loser's wallet**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(solana): reclaim Position rent on claim + loser crank"
```

---

### Task H7: `withdraw_fees`

**Files:**
- Modify: `programs/prediction-market/src/instructions/admin.rs`
- Modify: `programs/prediction-market/src/lib.rs`

- [ ] **Step 1: Implement**

The `fee_vault` is a self-owned PDA token account seeded at `[b"fee_vault"]` (Task 2). The same PDA is both the token account address AND its authority. `withdraw_fees` signs transfers with those seeds.

```rust
#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut, seeds = [b"fee_vault"], bump = config.fee_vault_bump)]
    pub fee_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
    let bump = ctx.accounts.config.fee_vault_bump;
    let seeds: &[&[u8]] = &[b"fee_vault", &[bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.fee_vault.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.fee_vault.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;
    Ok(())
}
```

- [ ] **Step 2: Test — admin withdraws X from fee_vault, balance delta matches; non-admin rejected**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(solana): admin withdraw_fees"
```

---

### Task H8: `propose_admin` + `accept_admin` two-step

**Files:**
- Modify: `programs/prediction-market/src/state.rs`
- Modify: `programs/prediction-market/src/instructions/admin.rs`
- Modify: `programs/prediction-market/src/lib.rs`

- [ ] **Step 1: `pending_admin` already declared on `GlobalConfig` in Task 2 and counted in `LEN`. Nothing to add here.**

- [ ] **Step 2: Implement ixs**

```rust
pub fn propose_admin(ctx: Context<AdminOnly>, new_admin: Pubkey) -> Result<()> {
    ctx.accounts.config.pending_admin = new_admin; Ok(())
}

#[derive(Accounts)]
pub struct AcceptAdmin<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(address = config.pending_admin @ ErrorCode::Unauthorized)]
    pub new_admin: Signer<'info>,
}

pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    require!(cfg.pending_admin != Pubkey::default(), ErrorCode::NoPending);
    cfg.admin = cfg.pending_admin;
    cfg.pending_admin = Pubkey::default();
    Ok(())
}
```

- [ ] **Step 3: Test — propose + accept by new admin succeeds; accept by anyone else rejected; no pending rejected**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(solana): two-step admin transfer"
```

---

### Task H9: Pin price decimals in docs

**Files:**
- Modify: `programs/prediction-market/src/state.rs` (module doc comment)
- Modify: `oracle-daemon/src/feed.rs` (module doc comment)
- Create: `docs/solana-oracle-protocol.md`

- [ ] **Step 1: Write the convention**

```rust
//! All prices on-chain are u128 normalized to 18 decimals:
//!     stored_price = native_price * 10^18 / 10^native_decimals
//! The daemon is responsible for normalization before signing.
//! Contract math assumes this invariant without verification.
```

- [ ] **Step 2: Document in `docs/solana-oracle-protocol.md`** — payload byte layout, signature format, decimal convention, canonical sample.

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: pin on-chain price decimals at 1e18"
```

---

### Task H10: Stuck-market ops CLI — ~~DELETED (MR7)~~

> **Deleted by MR7.** Admin monitors manually; no CLI ships.

**Files:**
- Create: `oracle-daemon/src/bin/ops.rs`

- [ ] **Step 1: Implement**

```rust
use clap::{Parser, Subcommand};

#[derive(Parser)]
struct Cli { #[command(subcommand)] cmd: Cmd }

#[derive(Subcommand)]
enum Cmd {
    /// List Market PDAs past resolve_ts + N hours with resolved=false
    ListStuck { #[arg(long, default_value = "12")] older_than: i64 },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let cfg = prediction_market_oracle::config::Config::from_env()?;
    let client = /* build anchor client as in main daemon */;
    let program = client.program(cfg.program_id.parse()?)?;

    match cli.cmd {
        Cmd::ListStuck { older_than } => {
            let now = prediction_market_oracle::scheduler::now_unix();
            let cutoff = now - older_than * 3600;
            let markets: Vec<(Pubkey, Market)> = program.accounts(vec![]).await?;
            for (pda, m) in markets.into_iter().filter(|(_, m)| !m.resolved && m.resolve_ts < cutoff) {
                println!("{}\t{}\tresolve_ts={}\tage_hours={}",
                    pda, m.market_type, m.resolve_ts, (now - m.resolve_ts) / 3600);
            }
        }
    }
    Ok(())
}
```

- [ ] **Step 2: Add to `oracle-daemon/Cargo.toml`**

```toml
[[bin]]
name = "ops"
path = "src/bin/ops.rs"
```

- [ ] **Step 3: Document usage in `oracle-daemon/README.md`** — "run daily via cron, pipe to operator alerting."

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(oracle): ops CLI for stuck-market enumeration"
```

---

### Task H11: Baseline tick cache — ~~DELETED (SA19, reinforced by MR8)~~

> **Deleted.** Baseline lives on-chain from `close_time` onward. Daemon is stateless. No SQLite, no tick cache.

**Files:**
- Modify: `oracle-daemon/src/feed.rs`
- Modify: `oracle-daemon/src/baselines.rs`
- Modify: `oracle-daemon/src/main.rs` (Deps)
- Modify: `oracle-daemon/src/scheduler.rs`

- [ ] **Step 1: Extend `baselines.rs` with a tick cache**

```rust
conn.execute(
    "CREATE TABLE IF NOT EXISTS tick_cache (
        source_id INTEGER NOT NULL,
        ts INTEGER NOT NULL,
        price TEXT NOT NULL,
        PRIMARY KEY (source_id, ts)
    )", [],
)?;
// Retention: DELETE WHERE ts < strftime('%s','now') - 48*3600 on every insert.
```

- [ ] **Step 2: `feed.rs` adds a subscription task**

Poll data-node every 1 second (or subscribe via WS if available), insert each `(source_id, ts, price)` into `tick_cache`. One tokio task spawned at daemon start.

- [ ] **Step 3: `scheduler.capture_baseline_for` falls back to cache on miss**

```rust
let price = match self.feed.price(mt.source_id).await {
    Ok(p) => p.price,
    Err(_) => self.baselines.get_closest_tick(mt.source_id, window_start)?
        .ok_or_else(|| anyhow::anyhow!("no tick cached"))?,
};
```

- [ ] **Step 4: Test — kill daemon at `T - 1s`, restart at `T + 3s`, assert baseline captured from cache**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(oracle): tick cache with 48h retention for baseline backfill"
```

---

### Task H12: Daemon SOL balance monitoring + systemd preflight

**Files:**
- Modify: `oracle-daemon/src/metrics.rs`
- Modify: `oracle-daemon/systemd/prediction-oracle.service`
- Create: `oracle-daemon/scripts/preflight-balance.sh`

- [ ] **Step 1: Prometheus gauge**

```rust
use prometheus::Gauge;
lazy_static::lazy_static! {
    pub static ref ORACLE_SOL_BALANCE: Gauge = Gauge::new(
        "oracle_keypair_sol_balance", "current SOL balance of oracle signer"
    ).unwrap();
}

pub async fn balance_poller(rpc: Arc<RpcClient>, pubkey: Pubkey) {
    loop {
        if let Ok(lamports) = rpc.get_balance(&pubkey).await {
            ORACLE_SOL_BALANCE.set(lamports as f64 / 1e9);
        }
        tokio::time::sleep(Duration::from_secs(60)).await;
    }
}
```

- [ ] **Step 2: Spawn from `main.rs`**

- [ ] **Step 3: Preflight script**

```bash
#!/usr/bin/env bash
BAL=$(solana balance "$ORACLE_KEYPAIR" --url "$RPC_URL" | awk '{print $1}')
awk -v b="$BAL" 'BEGIN{ exit (b < 0.1) }' || {
    echo "Oracle balance $BAL SOL below 0.1 — refusing to start"
    exit 1
}
```

- [ ] **Step 4: Wire into systemd unit**

```ini
ExecStartPre=/usr/local/bin/preflight-balance.sh
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(oracle): SOL balance gauge + systemd preflight"
```

---

### Task H13: `seed-markets.ts` — ~~DELETED (SA23)~~

> **Deleted.** `batch_bets` inlines `init_if_needed` per entry, so MMs open markets and stake in one tx. No seed script required.

**Files:**
- Create: `scripts/seed-markets.ts`
- Modify: `package.json` — add script entry

- [ ] **Step 1: Implement**

```ts
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.PredictionMarket;
  const types: Array<{ pda: PublicKey; settlementDuration: number }> =
    (await program.account.marketType.all())
      .filter(t => t.account.enabled)
      .map(t => ({ pda: t.publicKey, settlementDuration: Number(t.account.settlementDuration) }));

  const now = Math.floor(Date.now() / 1000);
  const DUST = new BN(1_000);

  const txs = await Promise.all(types.map(t => {
    const ws = Math.floor(now / t.settlementDuration) * t.settlementDuration;
    // derive market, position, vault, user_ata ...
    return program.methods
      .placeBet({ windowStart: new BN(ws), side: { yes: {} }, amount: DUST })
      .accounts({ /* ... */ })
      .rpc();
  }));

  console.log(`Seeded ${txs.length} markets.`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Document in `docs/market-maker-playbook.md`** — MM runs this once per window before `batchBets`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(tooling): seed-markets script for MM bootstrap"
```

---

### Task H14: ALT management CLI

**Files:**
- Create: `oracle-daemon/src/bin/alt.rs`
- Modify: `oracle-daemon/src/config.rs` — optional `alt_address`

- [ ] **Step 1: Implement subcommands**

```rust
use clap::{Parser, Subcommand};
use solana_sdk::{
    address_lookup_table::{instruction as alt_ix, AddressLookupTableAccount},
    pubkey::Pubkey,
};

#[derive(Subcommand)]
enum Cmd {
    Create { #[arg(long)] authority: String },
    Extend { #[arg(long)] alt: String, #[arg(long)] addresses: Vec<String> },
    Freeze { #[arg(long)] alt: String },
    Close  { #[arg(long)] alt: String, #[arg(long)] recipient: String },
}
```

Each subcommand builds the appropriate Solana `address_lookup_table` instruction, signs with the authority, submits, prints the ALT address.

- [ ] **Step 2: Document intended flow in `oracle-daemon/README.md`**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(oracle): ALT management CLI for MM batch optimization"
```

---

## Self-Review Notes

*Updated to reflect Model Revisions MR1–MR10.*

**Spec coverage:**
- 1-click trading — `place_bet` is one ix, no signatures, auto-ATA, auto-market-creation. Frontend is out of scope.
- Batch open positions (MM gas goal) — Task 8 (`batch_bets`) + ALTs, MAX_BATCH=24. Inline `init_if_needed` per entry so batches can open markets that don't yet exist.
- Enter/exit pool during the trading window — `place_bet` (Task 6), `exit_bet` (Task 7). Window defined by `close_time` on the Market.
- Locked observation window — `close_time` through `settlement_time`. All betting ixs reject when `now >= close_time`.
- Resolution pushed on-chain — Task 14 daemon submits `close_market(baseline)` at `close_time` and `resolve_market(final)` at `settlement_time`. Two ed25519-signed txs per market.
- Yes/no with ±X% threshold — carried on the bet (`threshold_bps: i32`), stored in the Market PDA seed. Negative threshold = YES bets on a drop. Rejected at `0` and beyond ±10_000 bps.
- Close + settlement times chosen per-bet by the user (contract) / from a curated menu (frontend). Normalized via PDA seeds — identical tuples collide to the same Market.
- First trade "creates" market — `init_if_needed` on Market PDA seeded by `(source, close_time, settlement_time, threshold_bps)`. Contract validates only `Source.enabled` + bounds (MR3).
- Parimutuel + fee on winners only — Task 11 (`claim` + `math::payout`). Fee skipped when pool is fully one-sided (SA5b). Stranded-pool refund unified into `claim` (SA3).
- **Users never click claim (MR5)** — `claim` is permissionless. Cranker signs; payout and rent flow to `position.owner`. Keeper bot (daemon or separate) sweeps resolved markets.
- Oracle mocked in program tests — Task 4 `MockOracleSet`. Two payload variants: close + resolve (MR4), each domain-tagged to prevent replay across ixs.
- Multisig ONLY on close AND settle — enforced in `close_market` and `resolve_market`. No signatures on any user-facing ix.
- 24h admin delay for oracle signer rotation — Task 3; active set keeps operating during pending change.
- Admin force-resolve (MR6) — unlocks at `settlement_time + (settlement_time - close_time)`. Done manually; no ops CLI (MR7).

**Design decisions locked in:**
- Admin whitelists only `Source` (MR1). User picks `(close_time, settlement_time, threshold_bps, side)` on every bet. Dedup is free via PDA collision.
- Frontend curates the menu of typical markets (hardcoded in its build). Contract accepts any valid tuple inside bounds (MR3) — backstop against scripted callers, not the primary UX gate.
- Baseline captured at `close_time` on-chain via `close_market` (MR4). `resolve_market` only carries final. Two oracle txs per market; cleaner audit trail; baseline observable between close and settle.
- Claim is permissionless (MR5). Traders never click anything after placing a bet. A keeper cranks winners + stranded refunds + loser-position closures.
- Daemon is fully stateless (MR8). No SQLite, no tick cache, no discovery list. Chain is the source of truth.
- `MarketType` removed. `Market` sheds cached `source_id`/`threshold_bps` — both live in the PDA seeds AND are re-readable from the Market fields if needed for events/audits.
- Force-resolve timing is proportional to the observation window (MR6). 5-min markets unlock force-resolve 2.5 min after settlement; 30-day markets unlock 30 days after settlement.

**Remaining open questions before execution:**
- **Admin event emissions (MR10):** admin ixs currently silent. Decide: emit for each (full audit stream) or rely on tx history.
- **Grid alignment on times:** contract can optionally `require!(close_time % 60 == 0 && settlement_time % 60 == 0)` to prevent sparse-pool fragmentation. The frontend will already align; the contract guard is a defensive backstop. Add or skip.
- **Keeper economics:** claim cranker pays tx fee, doesn't earn a bounty. Either the protocol runs the keeper (daemon doubles as one), or a dedicated bot is funded out-of-band, or the fee vault reimburses. Decide before mainnet.
- **Refund path when pool is fully one-sided:** handled by SA5b — fee skipped when `total_yes == 0 || total_no == 0`. The literal edge case of both sides having zero stake is impossible (Market only instantiates on a bet).
- **Data-node feed contract:** daemon assumes `GET /v1/sources/{id}/price` returns `{price: u128, ts}`. Pin shape and decimals before wiring. Price decimals fixed at 1e18 (SA9, MR4 payload format).
- **Replay protection on signed payloads (MR4):** domain tags `TAG_CLOSE(1)` and `TAG_RESOLVE(2)` prevent cross-ix replay. Verify bytes layout matches between Rust `oracle.rs` and daemon's `build_and_submit`. Golden-vector tests live in both.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-17-solana-prediction-market.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
