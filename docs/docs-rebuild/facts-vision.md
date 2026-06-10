# Vision fact sheet — verified against code, with citations

Every claim below was read from primary sources. Writers re-verify before citing; verifiers re-verify after. Where this file and the code disagree, the code wins — fix this file.

## Contract: Vision.sol (`contracts/src/vision/Vision.sol`)

- **Constants:** `PROTOCOL_FEE_BPS = 5` (0.05%, line 20) — charged on **profit only**: `fee = profit * 5 / 10000` (line 449). `MIN_DEPOSIT = 1e17` (0.1 USDC at 18 decimals, line 21). `tickDuration` valid 60–604,800s (line 124). `settlementGrace` valid 60–86,400s (lines 25–26, 126–127).
- **createBatch** (lines 97–158): oracle-BLS-signed; stores `configHash` (keccak256 of ABI-encoded config — the only on-chain record of the market list), `tickDuration`, `lockOffset`, `settlementGrace`, `createdAtTick = block.timestamp / tickDuration`.
- **joinBatchDirect** (lines 181–209): **4 params — (batchId, configHash, depositAmount, bitmapHash)**. Direct USDC transfer wallet→contract. Requires configHash match, deposit ≥ MIN_DEPOSIT, not already joined. No per-tick stake parameter.
- **updateBitmap** (lines 212–228): replace your bitmapHash before the lock window; `_requireNotLocked` (lines 70–80) blocks joins/updates inside `lockOffset` of the tick end.
- **Settlement:** `settleBatch` (361–370, oracle, per batch), `settleBatchesSingle` (379–415, one BLS signature over many batches: `keccak256(chainid, vision, "SETTLE_BATCHES_SINGLE_V1", batchIds, payoutsHashes)`), `settleBatches` (470–498, per-batch BLS). Payout math (445–451): `profit = max(payout - totalDeposited, 0)`; `fee = profit*5/10000`; `netPayout = payout - fee`; direct USDC transfer to the wallet (455, 560). Once `settled = true` the batch is immutable.
- **Refunds:** `claimRefund` / `claimRefundFor` (579–607). Expiration = `(createdAtTick + 1) * tickDuration + settlementGrace` (lines 90–92). After it, an unsettled batch refunds the full deposit, **no fee**.
- **Pause:** oracle can pause/unpause a batch via BLS (316–357). Pause blocks new joins; it does not refund existing players.
- **Fees custody:** `accumulatedRealFees`; `collectFees` only by feeCollector (283–294); feeCollector updated via BLS (297–311).
- **BotRegistry surface in Vision** (236–278): `registerBot(endpoint, pubkeyHash)` free; `deregisterBot`; `getAllActiveBots`. Purpose: off-chain discovery. No on-chain enforcement of bot signatures. Full registry: `contracts/src/vision/BotRegistry.sol`.

**Structs** (`contracts/src/interfaces/IVision.sol`): `Batch { creator, sourceId (keccak256 of source string), configHash, tickDuration, lockOffset, settlementGrace, createdAtTick, paused, settled }` (lines 19–29). `PlayerPosition { bitmapHash, configHash, joinTimestamp, totalDeposited }` (33–38; `totalDeposited != 0` is the joined sentinel).

**Versions:** Vision (original), Vision_v3, VisionV4 (UUPS proxy). deployment.json tracks current. See facts-gaps.md for which is live.

## Oracle (`oracle/src/vision/`)

- **Bitmap store** (`bitmap_store.rs`): two slots — **pending** (incoming POST /vision/bitmap) and **active** (used for the round). At the tick boundary `flip(batch_id)` merges pending→active; resubmitting overwrites pending; not submitting keeps your active bitmap. Writes flushed every 100ms or 200 rows. Submission is idempotent — safe to resubmit after a crash.
- **Settlement** (`settlement.rs`, lines 15–133): parimutuel per market — each market's outcome (UP/DOWN/CANCELLED) maps losers' stakes to winners. Players with no bitmap are voided → full deposit back (49–52). **Zero-sum invariant: total payouts == total deposits**; rounding remainder assigned deterministically to the last player sorted by address (90–116). If ALL markets cancelled → universal refund (75–89). Output sorted by address (contract requirement, 55–63).
- **Data-node Vision API** (`data-node/src/vision_api.rs`): MarketSnapshot { asset_id, value (Decimal), value_scaled (i128, 1e8 scale), change_pct, volume_24h, market_cap, category } (64–83); player-profile proxy cached 30s (18–58).

## API (frontend `app/api/vision/*` → data-node/oracle)

Base: `https://generalmarket.io/api`. No auth (verify rate limits — facts-gaps item 5).

| Endpoint | Method | Notes |
|---|---|---|
| `/vision/batches` | GET | active batches; zero configHashes patched from vision-batches.json; sourceId hashes resolved to names; dedup latest non-paused per source (`batches/route.ts:115–145`) |
| `/vision/batch/{id}/state` | GET | Batch struct |
| `/vision/bitmap` | POST | body `{player, batch_id, bitmap_hex, expected_hash}`; frontend fans out to all issuer URLs, returns `{acceptedCount, totalCount, results[]}` (`bitmap/route.ts`) |
| `/vision/balance` | GET | **DEAD** — handler exists in the oracle (`get_balance`, `oracle/src/vision/api.rs:1352`) but is never mounted on the router (`api.rs:134–162`); every call 404s |
| `/vision/rounds`, `/vision/rounds/{id}/bitmaps`, `/vision/rounds/{id}/results` | GET | round history, revealed bitmaps, per-tick results |
| `/vision/leaderboard` | GET | `?source_id&batch_id&page&limit` (limit ≤ 200); returns `{leaderboard, total, page, limit, pages, updatedAt}` |
| `/vision/player/{addr}/profile`, `/vision/player/{addr}/rounds` | GET | stats, PnL, rounds |
| `/vision/config/{source}`, `/vision/config/by-hash/{hash}` | GET | market list for a source / configHash |
| `/vision/sources`, `/vision/snapshot`, `/vision/snapshot/meta`, `/vision/search`, `/vision/featured-charts`, `/vision/icon/{source}/{id}` | GET | discovery & prices |
| `/vision/source/{id}/history`, `/vision/asset/{src}/{id}/settlements`, `/vision/batch/{id}/ratios` | GET | history & ratios |
| `/vision/stats/global`, `/vision/activity`, `/vision/bots/trending`, `/vision/explorer/*` | GET | stats & explorer |
| `/vision/vault/{address}/*` | GET | vault endpoints — verify per facts-gaps item 3 before documenting |
| `/api/faucet` | POST | `{address, amount?}` → L3 USDC (default 100, clamp 10,000) + 1 GM gas; waitlist-gated (403 `WAITLIST_REQUIRED`). Fallback `/api/bot/faucet`: fixed 100 USDC + 1 GM, one claim per IP **and** per address per 24 h (`frontend/app/api/bot/faucet/route.ts:40–42,124–151`), same waitlist gate |

## markets.json (repo root)

47 sources, categories array; per source: `name`, `batchId`, `tickDuration` (60s–604,800s), `description`. Examples: defi (batchId 0, 120s), rates (1, 86,400s), worldbank (3, 604,800s), mta_subway (46, 300s).

## bot.py (repo root, reference bot)

- Bitmap encoding (222–228): `bitmap[i // 8] |= 1 << (7 - (i % 8))` — big-endian, market 0 = MSB of byte 0, padded to ceil(count/8); hash = keccak256(bytes).
- Lifecycle: load config → read USDC address from Vision contract → balance check → auto-faucet (`POST /api/faucet`, 312–334) → discover batches (API, chain fallback 355–389) → fetch config by hash → predict → encode → approve once → join (408–486) → `POST /api/vision/bitmap` (488–519) → sleep, repeat.
- Strategies (237–253): random, momentum, contrarian, bullish, bearish — seeded by `sha256(private_key:name)`.
- **FIXED 2026-06-10:** bot.py previously shipped a 5-param `joinBatchDirect` ABI (phantom `stakePerTick`) and the dead default address `0x821D7c…`. It now carries the live 4-param ABI (selector `0xa092fd46`, bot.py:125–139), defaults to the live address `0x36a28967…` (bot.py:75), and falls back to the waitlist-aware bot faucet on 403 (bot.py:379). The bot copies `example-vision-bot/` and `examples/vision-bot-python/` remain stale (5-param ABI with `stakePerTick`, dead address `0x821D7c…`); do not copy their ABIs into docs. (`vision-bot/` is current — its `framework/chain.py:225–236` carries the live 4-param ABI.)

## Invariants (all verified)

- **L3 USDC = 18 decimals** (`frontend/lib/vision/constants.ts:15`). 0.1 USDC = 1e17; 1 USDC = 1e18.
- **Chain id 111222333** (`frontend/lib/contracts/deployment.json:2`).
- **Fee 0.05% on profit only.** **Min deposit 0.1 USDC.**
- **Sealed commitment:** only the hash goes on-chain; the bitmap goes to the oracle; revealed at resolution.
- **No escrow:** USDC wallet→contract on join, contract→wallet on settle/refund.
- **BLS governance:** create, settle, pause, fee changes all oracle-BLS-signed.

## Frontend surfaces (for gm-shot placement + ABI ground truth)

Pages: `/(app)/page.tsx` (VisionPage/HomeDashboard), `/(app)/vision/floor`, `/(app)/leaderboard`, `/(app)/explorer`, `/(app)/build-bot`, `/(app)/first-trade`, `/(app)/welcome`. Hooks (`frontend/hooks/vision/`): useBatches, useBatchState, useVisionLeaderboard, **useJoinBatch (ABI ground truth)**, useSubmitBitmap, usePlayerPosition, useBitmapEditor, useBatchMetadata.
