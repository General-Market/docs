# Curator Reform — Design Spec

## Problem

The lending system has 77 ITP markets but MetaMorpho's queue cap (30) prevents the curator from managing them all. The CuratorRateIRM was deployed with `curator=0x0`, permanently bricking rate-setting. The frontend reads a single market for stats. The curator bot isn't running.

## Decision

Fork MetaMorpho: `MAX_QUEUE_LENGTH = 500` (6.5x headroom over 77 ITPs; beyond 500, reconsider architecture). Redeploy vault + CuratorRateIRM. Curator bot auto-deploys all markets on startup. Full redeploy, no migration, no backward compatibility.

## Verified by 6 agents across 2 rounds

### Confirmed safe
- Gas at 77 markets: `totalAssets()` ~1.5M, `reallocate()` ~5M — fine on L3
- Calldata: ~17KB for 77-market reallocate — trivial
- E2E tests read deployment JSONs dynamically — no hardcoded addresses
- DoS vector (filling queue with garbage): safe, `submitCap` requires curator role

### Corrected from initial design
- **100000 → 500**: `totalAssets()` iterates full withdraw queue on every deposit/withdraw. At 100k: ~1.5B gas = bricked vault. At 500: ~10M gas = safe on L3.
- **`lending/MarketsTable.tsx`**: agent flagged as CRITICAL breakage from deleting `useMorphoMarkets`. Cross-check: dead code, zero importers. Delete alongside hook.
- **Punitive rate timing**: CuratorRateIRM returns 100% APR after 48h if no rate set. Not immediate — 48h grace. Fix: set initial rate in deploy script.

## Changes

### Phase 1: Contract Changes

| File | Change |
|------|--------|
| `contracts/lib/metamorpho/src/libraries/ConstantsLib.sol` | `MAX_QUEUE_LENGTH = 500` |
| `contracts/script/DeployBatchMarkets.s.sol` | Remove `maxQueue = 20` cap, deploy all markets |
| `contracts/script/DeployMorphoE2E.s.sol` | Replace AdaptiveCurveIrm with CuratorRateIRM, call `enableIrm`, set initial rate for each market |
| `scripts/deploy-batch-markets.sh` | Remove 30-market cap logic |

### Phase 2: testnet.sh

- `DeployMorphoE2E` deploys CuratorRateIRM with `curator = deployer`
- Deploy script calls `setRate()` for initial market immediately (avoids 48h punitive rate)
- Read `CURATOR_RATE_IRM` key from morpho-e2e.json
- Curator docker starts unified mode
- Market deployer auto-discovers ITPs without markets, deploys oracle + market + cap
- Allocator rebalances USDC across all markets via `vault.reallocate()`
- SERM pushes per-market borrow rates via `CuratorRateIRM.setRate()`

### Phase 3: Frontend

| File | Change |
|------|--------|
| `hooks/useMetaMorphoVault.ts` | Remove singleton market reads, use `useAllMorphoMarkets` for aggregate stats |
| `hooks/useMorphoMarkets.ts` | Delete (replaced by `useAllMorphoMarkets`) |
| `components/lending/MarketsTable.tsx` | Delete (dead code, zero importers) |
| `hooks/useMorphoPosition.ts` | Already accepts optional market param — no change needed |
| `components/domain/VaultModal.tsx` | Batch ITP name/balance into multicall; stats panel aggregates from all markets; borrow panel shows "No position" instead of "$0.00" |
| `lib/contracts/morpho-addresses.ts` | `getDefaultMarketParams()`: use `curatorRateIrm` instead of `adaptiveIrm` |

### Phase 4: E2E

New test `48-lending-curator.spec.ts`:
- Markets exist with non-zero supply in vault queue
- Borrow rates are non-zero (curator has set them)
- User can deposit ITP collateral and borrow USDC
- Markets table shows real TVL and APY (no `--` placeholders)

### Phase 5: Seeding

`scripts/seed-lending.sh` (Python):
- Buy random ITP amounts ($1-$100 per market)
- Supply USDC directly to each market
- Borrow random amounts ($5-$50 per market)
- Varied utilization ratios for different APYs

## Gas Analysis (Orbit L3)

| Operation | 77 markets | 200 markets | 500 markets |
|-----------|-----------|-------------|-------------|
| `totalAssets()` (every deposit/withdraw) | ~1.5M | ~4M | ~10M |
| `reallocate()` (curator periodic) | ~5M | ~13M | ~32M |
| `updateWithdrawQueue()` | ~300K | ~800K | ~2M |
| `_withdrawMorpho()` (worst case) | ~1.5M | ~4M | ~10M |

All safe on Orbit L3. Ethereum mainnet limit (30M) would cap at ~200 markets.

## Contracts Redeployed

| Contract | Reason |
|----------|--------|
| MetaMorpho Vault | Queue limit raised to 500 |
| CuratorRateIRM | curator=deployer (was 0x0) |
| ITPNAVOracle (x77) | New markets need new oracles |
| Morpho markets (x77) | New oracles = new market IDs |

Morpho Blue core, Index contract, ITP vaults, Governance — all stay.

## Cross-Checked Risks

| Risk | Severity | Cross-check result |
|------|----------|--------------------|
| Punitive rate (100% APR) if rate not set within 48h | HIGH | Real. Set initial rate in deploy script. |
| Stats panel loses borrowApy after hook deletion | HIGH | Real. Aggregate from `useAllMorphoMarkets`. |
| `fetchMorphoPosition` has no market discriminator | MEDIUM | Pre-existing bug. Fix: add market ID param to REST endpoint. |
| `_supplyMorpho` silently skips broken markets | MEDIUM | Real. Monitor for zero-supply markets in queue. |
| `MarketsTable.tsx` breaks on hook deletion | NOT AN ISSUE | Dead code. Zero importers. Delete it. |
| Multicall3 not on Orbit L3 | LOW | Likely present in genesis. Verify with `eth_getCode`. |
