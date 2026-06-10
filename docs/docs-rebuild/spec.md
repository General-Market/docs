# General Market docs rebuild — restructure spec

This is the contract for the full docs rebuild. Every writer, porter, and verifier obeys this file.
Method (how to write): `method.md`. Facts (what is true): `facts-vision.md`, `facts-index.md`, `facts-gaps.md`.

## What we are building

- **Layout:** the CRX handbook system (from `~/Downloads/crx-mono/frontend`) ported into `frontend/`, rebranded for General Market. Plain `.md` content + custom fences, NOT the old MDX system.
- **Content:** all docs restarted from scratch. The old `frontend/content/docs/{blocks,index}` MDX pages are source material only — never copied, always re-derived from code.
- **Naming:** the product is **Vision**. A **block** is the player-facing word for one on-chain prediction batch ("batch" is the contract-level term, defined on first use). The word "Blocks" as a product name is retired.
- **URL base:** `/docs/{section}/{slug}`. Old `/docs/blocks/*` URLs get permanent redirects to their new homes.

## Sections (5 tabs)

| Tab | Slug | Reader | Pages |
|---|---|---|---|
| Get Started | `get-started` | anyone landing fresh | 5 |
| Vision | `vision` | the player who wants to predict and win | 11 |
| Bots | `bots` | the developer running an autonomous bot | 7 |
| Index | `index` | the DTF trader and the DTF creator | 10 |
| Developers | `developers` | the integrator / protocol developer | 14 |

Total: 47 pages. Fewer than the old 60 — each one load-bearing.

## Frozen contract (writers and porter both obey)

**Frontmatter schema:**
```yaml
title: string            # a question or a short noun phrase
navTitle: string         # optional, short sidebar label
description: string      # one line, used in search
order: number            # sort within group
group: string            # sidebar group heading
mode: tutorial | how-to | reference | explanation
method: GET | POST       # API reference pages only — renders the method pill
```

**Fence vocabulary (gm prefix — the only fences writers may use):**

| Fence | Renders |
|---|---|
| ` ```gmplain ` | "In plain words" callout — ONE paragraph, plain-words restatement of the page |
| ` ```gmsummary ` | numbered section stepper — one line per `##`: `Heading :: ≤12-word sumup` |
| ` ```gmseealso ` | related-page chips (JSON: `[{"title","href"}]`) |
| ` ```gmcards ` | card grid (JSON spec) |
| ` ```gmflow ` | diagram by id — ONLY ids from the registry below |
| ` ```gmnote ` / ` ```gmtip ` / ` ```gmwarning ` | blue info / green tip / orange warning callouts |
| ` ```gm-try ` | live API explorer panel (API reference pages) |
| ` ```gm-shot ` | screenshot placeholder with caption |

**Diagram registry (porter implements exactly these ids; writers reference no others):**

| id | Shows |
|---|---|
| `vision-block-lifecycle` | block created → join window → lock → tick resolves → settle (or grace → refund) |
| `vision-sealed-commitment` | hash on-chain + bitmap to oracle → pending/active flip → revealed at resolution |
| `vision-parimutuel` | per-market pool: losers' share → winners, zero-sum, 0.05% fee on profit only |
| `bot-loop` | discover → fetch config → predict → encode bitmap → join/update → submit → sleep |
| `index-order-lifecycle` | order submitted → oracle consensus → fill → settlement |
| `index-two-chain` | L3 (18-dec USDC) ↔ bridge ↔ settlement chain (6-dec USDC) |
| `gm-system` | data sources → data-node → oracle (BLS) → contracts (L3) → app |

**Honesty lines that must appear (bolded, own line) wherever relevant:**
- **Testnet only.** The L3 and all funds on it are testnet; faucet money is not real money.
- **L3 USDC has 18 decimals.** 0.1 USDC = 1e17. (Every page that shows an amount.)
- Anything mocked, roadmap, or unverified gets its own bolded line — never buried.

---

## Page map

Format per page: `slug` — Title *(mode, group, order)* — the questions it owns; key facts + where to verify them.

### 1 · Get Started (`content/docs/get-started/`)

1. `overview` — What is General Market? *(explanation, "Get Started", 1)*
   Owns: what is this place; the two products (Vision: sealed parimutuel prediction market; Index: on-chain DTFs + lending); the L3 chain in one paragraph; who each section of the docs is for.
   Fence: `gmflow gm-system`, `gmcards` linking the 4 other tabs.
2. `connect-and-fund` — How do I connect and get funds? *(how-to, "Get Started", 2)*
   Owns: wallet connect, adding chain 111222333, the faucet (`POST /api/faucet` — address, optional amount; returns L3 USDC + gas). Click-path + outcome per max-doc law 10. **Testnet only** line.
3. `network` — Network reference *(reference, "Get Started", 3)*
   Owns: the ONLY home for chain id, RPC URL, explorer, and every deployed contract address (source of truth: `frontend/lib/contracts/deployment.json`, cross-checked per facts-gaps.md). USDC decimals stated here.
4. `glossary` — Glossary *(reference, "Get Started", 4)*
   Owns: block/batch, tick, bitmap, sealed commitment, parimutuel, source, DTF/ITP, NAV, BLS, oracle, data-node, settlement chain. Every other page links here instead of re-defining beyond first use.
5. `faq` — FAQ *(reference, "Get Started", 5)*
   Owns: the questions that fit nowhere else (is this real money; is there an airdrop/fees on deposits; can I play manually AND with a bot; where to get help). No question answered elsewhere may be answered here — link instead.

### 2 · Vision (`content/docs/vision/`)

Group "Play":
1. `how-vision-works` — How Vision works *(explanation, 1)*
   Owns: the one mechanism — everyone predicts UP/DOWN on many markets at once, predictions are sealed until the tick resolves, better predictors win the stakes of worse predictors. WHY sealed (no front-running, no copying, no alpha decay — you cannot see anyone's predictions before you commit). `gmflow vision-sealed-commitment`. This page is the eli5-register flagship: plain words, one picture, technical level kept.
2. `first-predictions` — Place your first predictions *(tutorial, 2)*
   Owns: the guided first run in the app: connect → faucet → pick a block → set UP/DOWN on markets → deposit → watch the tick resolve → see the payout. Always-works path, no choices, no theory. `gm-shot` placeholders at each screen.
3. `blocks-and-ticks` — What is a block? What is a tick? *(explanation, 3)*
   Owns: the batch lifecycle — created against one source, tickDuration (60s–7d per source), the lock window (lockOffset) before resolution, settlement, the next round. THE ROUND MODEL per facts-gaps.md — this page must state exactly whether a block lives one tick and a new one opens, and how predictions carry forward. `gmflow vision-block-lifecycle`.
4. `markets` — What markets can I predict? *(reference, 4)*
   Owns: the source catalog — 47 sources, 16 categories, per-source tick cadence. Table from `markets.json`. Link to developers/add-a-source for adding one.
5. `predictions-and-bitmaps` — How predictions are sealed *(explanation, 5)*
   Owns: the mechanics of the commitment — your picks become a bitmap (one bit per market), only its keccak256 hash goes on-chain, the bitmap itself goes to the oracle; updating before lock; reveal at resolution. Player-level; the byte-level encoding belongs to bots/bitmap-encoding (link out).
Group "Money":
6. `payouts` — How do I win? *(explanation, 6)*
   Owns: parimutuel scoring per market; deposit split across markets; zero-sum (total payouts == total deposits, `oracle/src/vision/settlement.rs`); voided players refunded; cancelled markets refund; worked numeric example with 18-decimal honesty. `gmflow vision-parimutuel`.
7. `fees` — Fees and minimums *(reference, 7)*
   Owns: the numbers — 0.05% on PROFIT only (`PROTOCOL_FEE_BPS = 5`, Vision.sol:20, applied line 449), min deposit 0.1 USDC = 1e17 (Vision.sol:21), no fee on losses or refunds, gas. One table.
8. `your-money` — Where is my money? *(explanation, 8)*
   Owns: custody model — USDC moves wallet→contract on join, contract→wallet at settlement, no intermediary balance; the refund right — if the oracle never settles, after the grace window (60s–24h) `claimRefund` returns the full deposit, no fee (Vision.sol:579–607). Steps to claim as a short numbered path.
9. `vaults` — Can someone play for me? *(explanation, 9)*
   Owns: the player-facing vault story — managed vaults per source (ERC-7540 async deposit/redeem, manager-fulfilled FIFO redeem queue), how depositing differs from playing yourself, where vault performance shows in the UI. Facts: facts-gaps.md item 3. **The phrase "BLS-signed withdrawal proofs" is banned — that system does not exist.** Protocol mechanics → developers/vision-api/vaults (link out).
Group "Standing":
10. `leaderboard` — Leaderboard and your stats *(how-to, 10)*
    Owns: reading the leaderboard, player profile (PnL, accuracy), where the data comes from.
11. `risks` — What can go wrong *(explanation, 11)*
    Owns: paused blocks, unsettled blocks → refund path, cancelled markets, oracle downtime, vault manager risk (one line, link to vaults), **testnet only**, smart-contract risk. Every limitation bolded.

### 3 · Bots (`content/docs/bots/`)

Group "Build":
1. `overview` — Why run a bot? *(explanation, 1)*
   Owns: what a bot does (predict every tick across all sources, faster and wider than a human), the lifecycle at a glance, what you need (a private key, Python, nothing else). `gmflow bot-loop`. BotRegistry in two sentences (registration is free, stores endpoint + pubkey hash, used for discovery — Vision.sol:236–278), link to developers for depth.
2. `quickstart` — Run the reference bot in 5 minutes *(tutorial, 2)*
   Owns: clone → `.env` with BOT_PRIVATE_KEY → `pip install` → `python bot.py` → what you should see (auto-faucet, discovery, join, loop). Source: `bot.py` + facts-gaps.md ABI verdict. **State out loud** anything in bot.py that is stale, per the verified facts.
3. `join-a-block` — How a bot joins a block *(how-to, 3)*
   Owns: discover batches (API `GET /vision/batches`, chain fallback), read configHash on-chain, fetch the market list by hash, approve USDC, call `joinBatchDirect` — with the DEPLOYED signature per facts-gaps.md (frontend `useJoinBatch` is ground truth), already-joined handling.
4. `bitmap-encoding` — Bitmap encoding *(reference, 4)*
   Owns: the byte-level spec — one bit per market, UP=1 DOWN=0, big-endian, market 0 = MSB of byte 0, length = ceil(count/8), hash = keccak256(bytes). Python + pseudocode. This is the single home for encoding; vision/predictions-and-bitmaps links here.
5. `update-predictions` — Update predictions each tick *(how-to, 5)*
   Owns: `updateBitmap` before the lock window, `POST /vision/bitmap` (body: player, batch_id, bitmap_hex, expected_hash), the two-slot pending/active store (resubmit overwrites pending; no update persists active — `oracle/src/vision/bitmap_store.rs`), idempotent resubmission after oracle restarts.
6. `strategies` — Strategies *(how-to, 6)*
   Owns: the 5 built-ins (random, momentum, contrarian, bullish, bearish) with their exact logic, and how to write your own (the strategy interface in bot.py, deterministic seeding).
7. `errors` — Errors and fixes *(reference, 7)*
   Owns: symptom → fix table: AlreadyJoined, InsufficientDeposit, StakeBelowMinimum, BatchPaused, TickLocked, bitmap 404 (indexer lag, retry 5s), bitmap 400 (hash mismatch). Links to developers/error-codes for the full selector list.

### 4 · Index (`content/docs/index/`)

Group "Trade":
1. `what-is-a-dtf` — What is a DTF? *(explanation, 1)*
   Owns: a DTF/ITP = an on-chain fund tracking a basket of assets; how it differs from holding the assets; NAV in one plain paragraph. Facts: facts-index.md.
2. `buy-and-sell` — Buy and sell a DTF *(tutorial, 2)*
   Owns: the guided first trade — connect, fund, pick a DTF, buy, see the position, sell.
3. `order-lifecycle` — What happens to my order? *(explanation, 3)*
   Owns: submission → oracle consensus/blocking → fill → settlement; limit prices; partial fills if real. `gmflow index-order-lifecycle`.
4. `pricing-and-nav` — How DTFs are priced *(explanation, 4)*
   Owns: NAV computation, oracle price feeds, where prices come from (data-node, 90+ sources).
Group "Create":
5. `create-a-dtf` — Create your own DTF *(how-to, 5)*
   Owns: deploying a custom DTF — assets, weights, the deploy flow, what you control afterwards.
6. `rebalancing` — Rebalance a DTF *(how-to, 6)*
   Owns: changing weights while preserving NAV; when rebalances execute; constraints.
Group "Earn & Borrow":
7. `lending` — Earn yield or borrow *(how-to, 7)*
   Owns: the Morpho market — supply to earn, borrow against DTFs, rates, liquidation in one honest paragraph.
Group "System":
8. `settlement-and-bridge` — Two chains, one balance *(explanation, 8)*
   Owns: L3 vs settlement chain, the bridge, **USDC decimals differ: 18 on L3, 6 on settlement** as a bolded line, what settles where. `gmflow index-two-chain`.
9. `legal-structure` — How is this structured legally? *(explanation, 9)*
   Owns: the legal architecture from the anonymized structuring memorandum (hosted at `/download/indexmaker-structuring-memorandum.pdf`, committed clean in 71e2bcdb8): Marshall Islands Master–Series DAO LLC (one Series per index), Panama Authorized Participant (custody/execution), Panama interface operator, Labs software agreement, Howey/decentralization rationale, sortition governance, progressive-decentralization roadmap with founder-led start stated honestly. **The originating law firm is never named anywhere — liability requirement.** Pointer entry lives in get-started/faq ("Who runs this, legally?").
10. `risks` — What can go wrong *(explanation, 10)*
    Owns: DTF risks (tracking, oracle, liquidity), lending risks (liquidation), **testnet only**.

### 5 · Developers (`content/docs/developers/`)

Group "Start":
1. `overview` — API overview *(reference, 1)*
   Owns: base URL `https://generalmarket.io/api`, no auth, rate limits if any (verify or state unknown), the endpoint families, how to read these pages. `gm-try` ping example.
2. `architecture` — System architecture *(explanation, 2)*
   Owns: the whole machine — data-node (source aggregation), oracle nodes (BLS consensus; batch create/settle/pause are BLS-signed), Vision contracts, Index contracts, the two-slot bitmap store, the settlement engine and its zero-sum invariant, vaults/balance-proofs IF verified per facts-gaps.md (else one honest line). `gmflow gm-system`.
Group "Vision API" (each page `method:` frontmatter + `gm-try` + request/response from route code):
3. `vision-api/batches` — Blocks & state *(reference, 3)* — GET /vision/batches, /vision/batch/{id}/state, /vision/config/{source}, /vision/config/by-hash/{hash}.
4. `vision-api/bitmap` — Submit a bitmap *(reference, 4)* — POST /vision/bitmap: body, validation, fan-out behavior, 400/404 semantics.
5. `vision-api/players` — Players & balances *(reference, 5)* — /vision/balance, /vision/player/{addr}/profile, /vision/player/{addr}/rounds.
6. `vision-api/history` — Rounds, results & history *(reference, 6)* — /vision/rounds, /vision/rounds/{id}/bitmaps, /vision/rounds/{id}/results, /vision/source/{id}/history, /vision/asset/{src}/{id}/settlements, /vision/batch/{id}/ratios.
7. `vision-api/discovery` — Sources, snapshots & search *(reference, 7)* — /vision/sources, /vision/snapshot(+meta), /vision/search, /vision/featured-charts, /vision/icon.
8. `vision-api/stats` — Leaderboard & stats *(reference, 8)* — /vision/leaderboard (pagination), /vision/stats/global, /vision/activity, /vision/bots/trending, explorer endpoints in one table.
9. `vision-api/vaults` — Vaults *(reference, 9)* — /vision/vault/{address}/* endpoints + the ERC-7540 mechanics (async deposit/redeem, clone factory, redeem queue) per facts-gaps.md item 3.
10. `vision-api/faucet` — Faucet *(reference, 10)* — POST /api/faucet (default 100 USDC + 1 GM gas, cap 10,000, 30s cooldown, waitlist gate 403) AND POST /api/bot/faucet (fixed grant, one per IP per 24h) per facts-gaps.md item 4.
Group "Index API":
11. `index-api/markets` — Prices & DTFs *(reference, 11)* — prices, itps/NAV/rankings endpoints.
12. `index-api/portfolio` — Portfolio & simulation *(reference, 12)* — portfolio, trade history, backtesting/simulation endpoints.
13. `index-api/lending` — Lending *(reference, 13)* — Morpho endpoints.
Group "Contracts":
14. `contracts` — Contract reference *(reference, 14)*
    Owns: Vision.sol surface (createBatch, joinBatchDirect, updateBitmap, settleBatch/settleBatchesSingle/settleBatches, claimRefund, registerBot; Batch + PlayerPosition structs; events; error selectors), BotRegistry, Index core contracts at the same depth per facts-index.md. Addresses live on get-started/network — link, don't repeat. Error selector table is THE home for contract errors (bots/errors links here).

Pages 3–12 may be split or merged ±2 pages by the writer if an endpoint family is thinner/fatter than expected — the MECE verifier checks the result.

---

## MECE check (resolved overlaps)

- Sealed commitment: WHY → vision/how-vision-works; player mechanics → vision/predictions-and-bitmaps; byte spec → bots/bitmap-encoding; oracle internals → developers/architecture.
- Errors: symptom→fix for bot builders → bots/errors; full selector reference → developers/contracts.
- Addresses & chain info: ONLY get-started/network.
- Fees mechanism → vision/payouts; fee numbers → vision/fees.
- Faucet: how-to → get-started/connect-and-fund; API shape → developers/vision-api/faucet.
- Vaults: player story → vision/vaults; endpoints + ERC-7540 mechanics → developers/vision-api/vaults.

## Old → new redirects (porter wires into next.config.ts)

- `/docs/blocks/introduction|getting-started` → `/docs/vision/how-vision-works|first-predictions`
- `/docs/blocks/concepts/*` → matching `/docs/vision/*` pages
- `/docs/blocks/bots/*` → `/docs/bots/*`
- `/docs/blocks/api/*` → `/docs/developers/vision-api/*`
- `/docs/blocks/architecture/*`, `/docs/blocks/reference/*` → `/docs/developers/*`
- `/docs/index/*` (old MDX slugs) → matching new `/docs/index/*` pages
- Catch-alls: `/docs/blocks/:path*` → `/docs/vision`, old `/docs/vision/:path*` redirect updated to the new section root.

## Open items — RESOLVED, see facts-gaps.md (writers MUST read it)

1. **Round model:** one batch = one round of one tick; the oracle settles the previous batch and mints a fresh one every `tick_duration`; nothing carries between rounds — you join the new batch id each round. (`oracle/src/vision/lifecycle.rs`)
2. **Live contract:** Vision.sol (not V4) at `0x36a28967544c301a3c66dcfb6c6c90e548412693`; `joinBatchDirect` is 4-param, selector `0xa092fd46` verified in deployed bytecode. bot.py and root AGENTS.md are stale on both counts.
3. **Vaults:** real and live (ERC-7540 async vaults, clone factory, FIFO redeem queue, routed UI). "BLS-signed withdrawal proofs" do not exist — banned phrase.
4. **Faucet:** `/api/faucet` default 100 L3 USDC + 1 GM gas, cap 10,000, 30s per-address cooldown, **waitlist gate ON by default (403 WAITLIST_REQUIRED)**; separate `/api/bot/faucet` fixed grant, one per IP per 24h.
5. **Auth/rate limits:** none in code on `/api/vision/*`; limits exist only on faucet/waitlist routes (+ nginx 60 r/m on `/bot-api/`).

## Code fix rolled into this rebuild

`bot.py` (repo root) is broken as shipped: 5-param `joinBatchDirect` ABI (selector mismatch → revert), default address with zero bytecode, auto-faucet blind to the waitlist gate. The Bots-A writer fixes bot.py to the verified truth (4-param ABI, deployment.json address, `/api/bot/faucet` fallback handling), then documents the fixed bot. Other bot copies (vision-bot/, example-vision-bot/, examples/) are flagged, not fixed.
