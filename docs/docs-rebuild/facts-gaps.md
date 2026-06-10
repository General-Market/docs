# Fact gaps — verdicts with evidence

Scout run 2026-06-10. Every claim read from primary sources or the live chain. Where this file and the code disagree, the code wins — fix this file. Live-site checks were made while generalmarket.io returned 502 (origin down at scan time); chain checks went through `https://rpc.generalmarket.io/` directly and are authoritative.

## 1 · The round model

**VERDICT: a batch lives exactly ONE round (one tick) and settles once. Play continues because the oracle mints a brand-new batch per source every tick. Nothing carries over between rounds — not the deposit, not the bitmap.**

The canonical narrative, with citations:

1. **Heartbeat.** Each source has a heartbeat every `tick_duration` seconds, driven from Postgres `vision_source_state` (`oracle/src/vision/lifecycle.rs:309–355`). Sources are sharded across oracles by `hashtext(source_name) % num_oracles` (lifecycle.rs:301–307). "All sources are round-based" (lifecycle.rs:264).
2. **A block is born.** The owning oracle fetches a fresh market config from the data-node, BLS-co-signs a `createBatch` proposal with peers, and submits on-chain (`create_new_round`, lifecycle.rs:1307–1539; submitter loop 1551–1685). The contract stores `createdAtTick = block.timestamp / tickDuration` (Vision.sol:152). Start prices are snapshotted at creation (lifecycle.rs:1360–1365).
3. **Join window.** Players call `joinBatchDirect` and may `updateBitmap` until the lock: both revert inside `lockOffset` of the tick end (`_requireNotLocked`, Vision.sol:68–79). Bitmaps POSTed to the oracle land in the **pending** slot; resubmitting overwrites pending (`bitmap_store.rs:217–262`).
4. **Resolution + settlement — one tick later.** The next heartbeat rotates current→previous (lifecycle.rs:384–417), waits for `betting_end <= NOW()` (lifecycle.rs:426–442), flips pending→active (lifecycle.rs:1147; `flip`, bitmap_store.rs:302–311), resolves each market from saved start prices vs DB-frozen end prices (lifecycle.rs:976–1144), computes the parimutuel settlement (lifecycle.rs:1156–1161; settlement.rs), BLS-signs payouts and submits `settleBatch` with 3 inline retries (lifecycle.rs:506–540). The contract transfers `netPayout` straight to each wallet; the batch is then immutable.
5. **Next round.** The SAME heartbeat creates the next batch — a new batch id, fresh config (lifecycle.rs:610–664). The frontend shows only the highest (latest) active batch per source (`useBatches.ts:41–45`: "highest ID = most recent round", 10s polling). To play again you join the new batch: new `joinBatchDirect`, new deposit, new bitmap. After settle, the old batch's bitmaps are purged (lifecycle.rs:568).
6. **Refund cliff.** If the oracle misses the window, settlement becomes illegal and refunds open at `(createdAtTick + 1) * tickDuration + settlementGrace` (Vision.sol:88–92); `claimRefund` returns the full deposit, no fee (Vision.sol:579–607). Grace defaults to `2 × tick`, clamped 60s–24h (lifecycle.rs:1322–1330).

The two-slot pending/active flip operates WITHIN one batch — it lets a player resubmit until lock, with one flip at resolution. The bitmap_store header's "prediction persists across ticks" (bitmap_store.rs:5–9) is legacy wording from the retired multi-tick engine; the resolver runs with `tick_id = 0` ("single-round batches", lifecycle.rs:1149–1152). **Nothing carries into the next round.**

Which contract: the live one is the non-upgradeable **Vision.sol** ("Each batch = one round", Vision.sol:12). See item 2.

**What writers must say:**
- A block = one batch = one round of one tick. It settles once, then it is history.
- Play continues because the oracle creates a new block per source every tick — joining is per-round, deposits and predictions never carry forward.
- Predictions can be changed (resubmit bitmap / `updateBitmap`) any time before the lock window (`lockOffset` before tick end).
- Settlement happens ~one tick after creation; if it never comes, the refund right opens after the grace window.
- Do NOT describe multi-tick batches or prediction carry-over — that machinery is retired.

## 2 · Deployed address + ABI ground truth

**VERDICT: the live Vision is `0x36a28967544c301a3c66dcfb6c6c90e548412693` (Vision.sol, not a proxy), and `joinBatchDirect` takes 4 params: `(uint256 batchId, bytes32 configHash, uint256 depositAmount, bytes32 bitmapHash)`. bot.py's address and 5-param ABI are both dead wrong.**

Evidence:
- Frontend resolves addresses at runtime: `useDeployment.ts:22–38` fetches `/api/deployment`, which serves `frontend/lib/contracts/deployment.json` (route: `app/api/deployment/route.ts:113–127`; `DEPLOYMENT_FILE` env can override, none set in `.env.local`). `deployment.json:22` → Vision `0x36a28967…`.
- `useJoinBatch.ts:215–220` calls `joinBatchDirect` with exactly 4 args; `vision-abi.ts` declares the 4-param signature (selector `0xa092fd46`).
- Live chain (rpc.generalmarket.io, 2026-06-10): `0x36a28967…` has 9,049 bytes of code, selector `0xa092fd46` present, 5-param selector `0xfc4bdb37` ABSENT, `nextBatchId = 301,268`, **39,084 events in the last 50k blocks**. ERC-1967 impl slot is zero → not a proxy → not VisionV4.
- `0x821D7c212344dd4E5EB837B01B0FFfE3BcAc1649` (bot.py:66, repo AGENTS.md) has **zero bytecode** — nothing was ever live there on this chain.
- `Vision_v3` `0x8d3cb936…` (deployment.json:30) exists on-chain (`nextBatchId = 211`) but has **0 events** in the last 50k blocks — deployed, idle, not the live target. `VisionV4.sol` (UUPS) has source + `script/DeployVisionV4.s.sol` but no deployment.json entry — built, not shipped.

**What writers must say:**
- Document `0x36a28967544c301a3c66dcfb6c6c90e548412693` as THE Vision address (only on get-started/network), sourced from `deployment.json` / `GET /api/deployment`.
- Document the 4-param `joinBatchDirect`. There is no stake parameter; the deposit is the stake.
- Describe Vision.sol's surface (per facts-vision.md). Do not document VisionV4's upgrade machinery — it is not deployed.
- bots/quickstart must state out loud: bot.py's hardcoded address (`0x821D7c…`, zero bytecode on-chain) and its 5-param ABI are both stale; the bot does not self-correct. A reader must set `VISION_ADDRESS=0x36a28967…` and use the 4-param ABI. Repo AGENTS.md carries the same stale address.

## 3 · Vaults & balance proofs

**VERDICT: vaults are real and live — document them. "BLS-signed withdrawal proofs" do not exist anywhere — kill that phrase.**

Evidence:
- Contract: `VisionVault.sol` — ERC-7540 async deposit/redeem managed vault for Vision trading, manager-only trading, performance fee with high-water mark, deployed as EIP-1167 clones (VisionVault.sol:12–15). Factory + impl in `deployment.json:23–24`; ~260 `whitelistedVaults` and 5 `sourceVaults` per source (deployment.json:43–417, 418+).
- API: `app/api/vision/vault/[address]/{stats,history,rounds,assets,assets/[assetId]/fills}/route.ts` — they read the vault's on-chain `PlayerJoined`/`PlayerSettled` events (stats/route.ts:27–32) over a 24h lookback.
- UI: routed pages `app/[locale]/(app)/source/[sourceId]/vault/page.tsx` and `…/vault/[vaultAddress]/page.tsx`; components `components/domain/vision/vault/*` and `components/domain/vaults/VaultActions.tsx`; hooks `hooks/vaults/useVaultStats.ts`, `useVaultHistory.ts`. Which sources show a vault is driven by `data/fund-branding.json` via `lib/vision/sources-vaults.ts:6–10`.
- "withdrawal proof" / "WithdrawalProof": **zero grep hits** across contracts/src, oracle/src, frontend. Redeems are an on-contract FIFO queue the manager fulfils (VisionVault.sol:44–55) — no BLS proof anywhere in the withdrawal path.

**What writers must say:**
- Vaults exist: each source has managed vaults (on-chain funds) that play Vision rounds with depositors' USDC; ERC-7540 async deposit/redeem, manager trades, performance fee.
- Mention in developers/architecture and the vault API endpoints in the Vision API reference; depth beyond that is optional, not owed.
- Never write "BLS-signed withdrawal proofs" — that mechanism is not in the code. Withdrawals are a FIFO redeem queue fulfilled by the vault manager. State that plainly.

## 4 · Faucet

**VERDICT: there are TWO faucets. `POST /api/faucet` (UI + bot.py) takes `{address, amount?, scope?}`, default 100 L3 USDC + 1 GM gas, capped at 10,000, 30s per-address cooldown, and a waitlist gate that is ON by default. `POST /api/bot/faucet` is a separate fixed-drip faucet (100 USDC + 1 GM, one claim per IP per 24h).**

`app/api/faucet/route.ts`:
- Request: `{ address: 0x…, amount?: string|number, scope?: 'vision'|'itp'|'both' }` (route.ts:8, 67–71). Default scope `vision`, default amount 100, cap `MAX_MINT = 10_000` (route.ts:44, 234).
- Vision leg: mints `amount` L3 USDC (18 dec) to the address (token read from `Vision.USDC()`, fallback deployment.json) + drips **1 GM** L3 gas (route.ts:46, 73–133). `itp`/`both` legs (Settlement USDC 6-dec + 0.5 S) are for admin/E2E only, "Not used by the UI" (route.ts:15–16).
- Response 200: `{ success: true, to, scope, vision: { usdc: {hash, amount} | {error}, gas: {hash, amount} | {error} } }` — each leg reports independently; a leg `{error}` still returns 200 (route.ts:257–266).
- Errors: 400 invalid address or amount (route.ts:215–216, 235–236); **403 `{error:'WAITLIST_REQUIRED', waitlistUrl}`** when the address is not whitelisted and `WAITLIST_GATE_ENABLED !== 'false'` (default ON; route.ts:28, 219–232); **429 `{error:'COOLDOWN', retryAfter}`** + `Retry-After` header, 30s per address (route.ts:26, 242–252); 500 otherwise.
- `app/api/bot/faucet/route.ts`: `{address}` → fixed 100 USDC + 1 GM, per-IP one claim/24h via Upstash, **fails closed 503 in prod without Upstash** (route.ts:6–23, 41–43), same waitlist gate. Its response `{success, usdc, l3Gas}` is the shape repo AGENTS.md wrongly attributes to `/api/faucet`.

**What writers must say:**
- Document `POST /api/faucet` with the exact request/response above; state the 30s cooldown and the 10,000 cap.
- **The faucet is waitlist-gated by default** — a fresh wallet gets 403 until whitelisted. Bolded honesty line; this also breaks bot.py's auto-faucet for non-whitelisted keys.
- Amounts: default 100 L3 USDC (18 dec) + 1 GM gas. **Testnet only.**
- Mention `/api/bot/faucet` (fixed drip, 24h/IP) on the bots pages if at all; don't conflate the two.

## 5 · Public API auth / rate limits

**VERDICT: no auth anywhere on `/api/vision/*`; no rate limits on it in code. Rate limiting exists only on `/api/faucet` (30s/address), `/api/bot/faucet` (24h/IP), `/api/waitlist/*`, and the nginx `/bot-api/` cache (60 r/m per IP).**

Evidence:
- `middleware.ts` does locale routing only, and its matcher EXCLUDES `/api` entirely (`matcher: ['/((?!api|dn|rpc|…).*)']`, middleware.ts:78–80).
- Grep over `app/api/vision/**` for auth headers: only an outbound `GITHUB_TOKEN` in `bots/trending/route.ts:43`. No inbound auth check in any vision route.
- `lib/rate-limit.ts` (Upstash Redis, in-memory fallback) is imported only by `app/api/faucet/route.ts` and `app/api/waitlist/{check-code,redeem,issue-code}/route.ts`. Nothing under `app/api/vision/` uses it.
- Repo nginx snippets: `docker/bot-api-cache/nginx-snippet.conf:8` rate-limits **only `/bot-api/`** (Varnish cache in front of the data-node): `60 r/m` per IP, burst 30. That surface is separate from `/api/vision/*`. No `limit_req` for `/api` in the repo.
- Caveat: production nginx/Cloudflare config outside the repo could not be inspected; the live origin was 502 at scan time. In-repo truth: none.

**What writers must say:**
- developers/overview: "No authentication. No rate limits enforced by the API itself" — with the exceptions named explicitly: faucet cooldown (30s/address), bot faucet (1/24h/IP), and `/bot-api/` (60 req/min/IP) if that surface is documented.
- Do not promise unlimited throughput; say limits may exist at the proxy layer and the API may change.
