# Deployment & prod operations

**TL;DR.** Monitor long-running operations actively. Use `nohup` on VPS for anything > 5 min. Never redeploy ALL if you can fix in-place.

## Known timings (when things work)

| Step | Time | Notes |
|------|------|-------|
| Core contracts (step 3) | ~3 min | 47 txs with `--slow` |
| Token deploy (step 9) | ~10 min | 621 txs |
| ITP creation (step 11) | ~3 min | 96 txs |
| Vault deploy (step 12) | ~3 min | 96 txs |
| Batch markets (step 12b) | ~5 min | 96 markets |
| Oracle Docker build | ~8–12 min | Rust compilation |
| Seed buy orders + fills | ~15 min | 96 orders at ~10/min |
| Settlement delay | = `tick_duration` per source | Symmetric — 2m source settles in 2m, 10m in 10m |
| Vision batch first cycle | `tick_duration` × 2 | Betting + settlement |
| Full `testnet.sh deploy --seed` | 40–60 min | |

**If something exceeds 2× the expected time, it is stuck. Investigate immediately.**

## Rules

- Use `nohup` on VPS for anything > 5 min — SSH drops kill foreground processes after ~5 min of idle output.
- Don't redeploy ALL if you can fix in-place. Check first: can we just `setITPVault`, `refreshSnapshot`, `recoverAdmin`, or `resetOrderState`?
- Don't rebuild Docker if the code didn't change (`find -newer` check).
- Track deployer nonce. If it jumps unexpectedly, something is sending txs concurrently.
- `active-deployment.json` is the single source of truth. Read on-chain addresses from the Index contract to verify.

## Orbit L3 specific

- CREATE addresses diverge between forge simulation and broadcast.
- Always read actual addresses from broadcast receipts, not simulation output.
- `--slow` prevents most nonce drift, not all.
- Settlement delay window (= `tick_duration`) must pass before oracles resolve batches.
