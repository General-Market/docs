# Curator Reform — Design Spec

## Problem

The lending system has 77 ITP markets but MetaMorpho's queue cap (30) prevents the curator from managing them all. The CuratorRateIRM was deployed with `curator=0x0`, permanently bricking rate-setting. The frontend reads a single market for stats. The curator bot isn't running.

## Decision

Fork MetaMorpho: `MAX_QUEUE_LENGTH = 100000` (no practical limit). Redeploy vault + CuratorRateIRM. Curator bot auto-deploys all markets on startup. Full redeploy, no migration.

## Changes

### Phase 1: Contract Changes

| File | Change |
|------|--------|
| `contracts/lib/metamorpho/src/libraries/ConstantsLib.sol` | `MAX_QUEUE_LENGTH = 100000` |
| `contracts/script/DeployBatchMarkets.s.sol` | Remove `maxQueue = 20` cap, deploy all markets |
| `contracts/script/DeployMorphoE2E.s.sol` | Replace AdaptiveCurveIrm with CuratorRateIRM, call `enableIrm`, output `CURATOR_RATE_IRM` key |
| `scripts/deploy-batch-markets.sh` | Remove 30-market cap logic |

### Phase 2: testnet.sh

- Read `CURATOR_RATE_IRM` from morpho-e2e.json (fall back to `ADAPTIVE_IRM`)
- Curator docker starts unified mode with all market IDs from batch-markets.json
- Market deployer auto-discovers ITPs without markets, deploys oracle + market + cap
- Allocator rebalances USDC across all markets via `vault.reallocate()`
- SERM pushes per-market borrow rates via `CuratorRateIRM.setRate()`

### Phase 3: Frontend

| File | Change |
|------|--------|
| `hooks/useMetaMorphoVault.ts` | Remove singleton market reads (lines 130-153), aggregate stats from `useAllMorphoMarkets` |
| `hooks/useMorphoMarkets.ts` | Delete entirely (replaced by `useAllMorphoMarkets`) |
| `hooks/useMorphoPosition.ts` | Accept optional `MorphoMarketEntry` param for per-market positions |
| `components/domain/VaultModal.tsx` | Batch ITP name/balance fetches into multicall; borrow panel shows "No position" instead of "$0.00"; aggregate vault stats from all markets |

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

| Operation | Markets | Gas | Verdict |
|-----------|---------|-----|---------|
| `totalAssets()` (every deposit/withdraw) | 77 | ~2.5M | OK on L3 |
| `reallocate()` (curator periodic) | 77 | ~5M | OK on L3 |
| `setSupplyQueue()` | 77 | ~300K | Trivial |
| Calldata for 77-market reallocate | — | ~17KB | Trivial |

## Contracts Redeployed

| Contract | Reason |
|----------|--------|
| MetaMorpho Vault | Queue limit raised |
| CuratorRateIRM | curator=deployer (was 0x0) |
| ITPNAVOracle (x77) | New markets need new oracles |
| Morpho markets (x77) | New oracles = new market IDs |

Morpho Blue core, Index contract, ITP vaults, Governance — all stay.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| MetaMorpho `_supplyMorpho` silently skips broken markets | Medium | Monitor for markets with zero supply despite being in queue |
| `totalAssets()` cost scales with market count | Low | Orbit L3 gas is cheap; monitor if ITP count exceeds 200 |
| Divergence from upstream MetaMorpho audit | Low | Already forked (MIN_TIMELOCK=0); one more constant |
| Multicall3 not on Orbit L3 | Low | Verify with `eth_getCode`; deploy if absent |
