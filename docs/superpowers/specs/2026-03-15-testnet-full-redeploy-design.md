# Testnet Full-Redeploy Upgrade

**Date:** 2026-03-15
**Status:** Approved
**Goal:** Make `testnet.sh deploy` + `testnet.sh start` a complete from-scratch deployment — all 621 Bitget tokens, 96 ITPs with vaults, all services including vision swarm.

## Problem

Three gaps prevent a clean fresh redeploy:

1. **Token deployment assumes prior state.** `Deploy107ITPs_Tokens.s.sol` hardcodes 84 token addresses in `_setExisting()`. On a fresh chain, those addresses are void. Only 231 tokens are handled; `assets.json` has 621.
2. **ITP vault deployment never runs.** `testnet.sh` calls token deploy + ITP create but never calls `Deploy107ITPs_Vaults.s.sol`. ITPs exist on-chain but are untradeable.
3. **Vision swarm requires separate manual script.** The 10 bots need `deploy-swarm.sh` run independently with pre-generated `swarm.env`.

## Design

### 1. New script: `scripts/deploy-all-tokens.py`

Generates `contracts/script/DeployAllTokens.s.sol` from `assets.json`.

**Input:** `assets.json` (622 entries, 621 unique symbols — one ETH duplicate).
Note: `assets.json` has `address` and `bitget` fields (e.g. `BTCUSDT`). The symbol is derived by stripping the quote suffix (USDT/USDC) — same regex already used in `testnet.sh`'s token registry sync.

**Output:** Solidity forge script that:
- Deploys all 621 tokens as `MockERC20("Mock {SYM}", "{SYM}", 18)`
- Funds `MockBitgetVault` with 1M (1e24) of each token
- Exports `data/all-token-addresses.csv` — format: `index,address\n` (Solidity-compatible, same format as current `itp-107-token-addresses.csv`)
- ceil(621/25) = 25 `_deployBatch` functions (last batch has 21 tokens)
- No `_setExisting()` — everything deployed fresh

The Python generator also writes `data/all-token-symbols.json` — a `{symbol: index}` map for `deploy-107-itps.py` to resolve ITP token references. This keeps the Solidity CSV format simple (two columns) while giving Python the symbol mapping it needs.

**Deduplication:** Skip the second ETH entry (ETHUSDC duplicate in `assets.json`).

### 2. Modify `scripts/deploy-107-itps.py`

- **Remove** `gen_tokens_script()` entirely — no more `Deploy107ITPs_Tokens.s.sol`
- **Remove** token-related code from `gen_shell_script()`
- `gen_create_script()` reads `data/all-token-symbols.json` to build `sym_idx` map, then generates Solidity that reads `data/all-token-addresses.csv` (same `index,address` format — Solidity parser unchanged)
- `gen_vaults_script()` unchanged
- Shell script becomes 2 phases: create ITPs → deploy vaults
- The `existing` vs `new` token distinction eliminated entirely

**Token resolution:** Python reads `all-token-symbols.json` to get `sym_idx[symbol] → array_index`. The generated Solidity uses `t[index]` as before. The Solidity `_parseTokens` function stays identical — it still parses `index,address\n`.

### 3. Modify `testnet.sh` `cmd_deploy`

New deployment order (renumbered):

| Step | What | Script |
|------|------|--------|
| 1 | RPC check | existing |
| 2 | bls-tool check | existing |
| 3 | Core contracts | `DeployFullSystemE2E` |
| 3b | Settlement (Sonic) | `DeployFullSystemE2E` |
| 4 | Fund gas | existing cast sends |
| 5 | Morpho | `DeployMorphoE2E` |
| 6 | Vision + batches | `DeployVision` + `DeployAllVisionBatches` |
| 7 | Fund USDC | existing cast sends |
| **8** | **Generate token deploy script** | `python3 scripts/deploy-all-tokens.py` |
| **9** | **Deploy all 621 tokens + fund vault** | `DeployAllTokens` |
| **10** | **Generate ITP scripts** | `python3 scripts/deploy-107-itps.py` |
| **11** | **Create 96 ITPs** | `Deploy107ITPs_Create` |
| **12** | **Deploy 96 ITP vaults** | `Deploy107ITPs_Vaults` |
| 13 | Sync deployments + switch env | existing |
| 14 | Frontend to Vercel | existing |
| 15 | Sync token registries | existing |

The current `testnet.sh` numbering is already inconsistent (steps 1-7 labeled `/7`, then 8-10 labeled `/10`). This spec renumbers everything cleanly as `/15`.

Steps 8-9 replace old step `[8/10]` (token deploy). Steps 10-12 add ITP generation, ITP creation (old `[9/10]`), and the missing vault deploy.

**Key detail:** Steps 8 and 10 run Python generators before the forge scripts. This ensures the Solidity is always regenerated from current data — no stale generated code. If the generator fails, `testnet.sh` exits before running forge on potentially stale `.sol` files.

### 4. Modify `testnet.sh` `cmd_start` — add vision swarm

After all core services start, add:

```
[8/8] Deploying vision swarm...
```

Logic extracted from `deploy-swarm.sh`:
- Check if `docker/testnet/vision-swarm/swarm.env` exists — if not, print warning and skip (bots are optional)
- If present: sync files, build on VPS, fund 10 bot wallets, start swarm
- Same rsync + cast send + docker compose up flow as `deploy-swarm.sh`

`deploy-swarm.sh` remains as a standalone script for manual re-deployment of just the swarm.

### 5. Token registry sync

The existing `deployed-assets.json` + `symbol-map.json` regeneration at the end of `cmd_deploy` stays unchanged. It reads `assets.json` and populates both files. On a fresh deploy, the on-chain addresses from `DeployAllTokens` are in the CSV and symbol JSON — `deployed-assets.json` is regenerated by the Python sync step at the end using `assets.json` addresses (which are stale on fresh chain).

**Fix:** After step 9 (token deploy), `testnet.sh` runs a small Python step that reads `data/all-token-addresses.csv` + `data/all-token-symbols.json` and writes the fresh addresses back into `assets.json` and `frontend/public/deployed-assets.json`. This ensures the final sync step and `deploy-107-itps.py` both see correct addresses.

## Files Changed

| File | Change |
|------|--------|
| `scripts/deploy-all-tokens.py` | **New** — generates DeployAllTokens.s.sol |
| `scripts/deploy-107-itps.py` | Remove token generation, read CSV for addresses |
| `testnet.sh` | Add token deploy, vault deploy, swarm start |
| `contracts/script/DeployAllTokens.s.sol` | **New** (auto-generated) |
| `contracts/script/Deploy107ITPs_Tokens.s.sol` | **Deleted** (no longer needed) |
| `scripts/deploy-107-itps.sh` | Updated (2-phase: create + vaults, no token deploy) |

## Files NOT Changed

- `DeployFullSystemE2E.s.sol` — still deploys 3 system tokens (L3_WUSDC, SETTLEMENT_USDC, MOCK_USDT)
- `DeployVision.s.sol`, `DeployAllVisionBatches.s.sol` — untouched
- `itp-bot/manifest.json` — untouched
- `docs/itp-backtest-results.json` — untouched
- `deploy-swarm.sh` — kept as standalone, logic duplicated into testnet.sh

## Invariants

- Every symbol in `assets.json` gets an on-chain MockERC20 on fresh deploy
- Every ITP in the manifest (that has backtest data) gets created with a vault
- MockBitgetVault holds 1M of every token
- No hardcoded addresses survive a chain wipe
- Vision swarm starts automatically if `swarm.env` exists
