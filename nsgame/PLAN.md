# nsgame — Master Plan

A Solana program landed on devnet. A daemon talks to the wrong data source. A frontend shows the wrong markets. Three correct pieces, none of them yet pointed at each other. This document exists so that the next person opening this folder knows that — and what to do about it.

---

## 1. What nsgame is

A prediction-market frontend on Solana devnet, settling bets on adult-tube-site signals: star view counts, listing ranks, cam-room viewer counts. Eight market types, roughly one hundred concrete instances waiting to ship. The program is on-chain. The catalog is not yet connected to it.

## 2. What nsgame is not

It is not generalmarket.io. It shares a monorepo with the Index project — Ethereum L3, oracle BLS, ITP shares, all of that — and shares nothing else. Different chain. Different oracles. Different data-node. Different markets. They live in the same git tree the way two strangers live in the same building. Do not cross the wires.

## 3. Current state

Ground truth as of 2026-04-24. Read this before changing anything else.

| Component                  | Status     | Detail                                                                 |
|---------------------------|-----------|------------------------------------------------------------------------|
| Solana program             | DEPLOYED  | `DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA` — devnet                |
| Oracle daemon              | RUNNING   | VPS 3, `prediction-oracle.service`, signer set active, polls 30 s     |
| Event indexer              | RUNNING   | VPS 3, `prediction-indexer.service`, schema applied, cursor at tip    |
| Postgres (indexer DB)      | RUNNING   | VPS 3, `127.0.0.1:5432`, 8 tables, all empty                          |
| Registered on-chain sources| WRONG     | id=1 BTC/USD, id=2 ETH/USD, id=3 SOL/USD — crypto placeholders         |
| Oracle `DATA_NODE_URL`     | WRONG     | Points at `https://api.generalmarket.io` — the L3 RPC, returns HTTP 405|
| Frontend catalog           | WRONG     | `lib/solana/catalog.ts` — six BTC/ETH/SOL markets, not tube markets   |
| nsgame ↔ Postgres wiring   | UNRESOLVED| Postgres bound to localhost only; frontend hosting TBD                 |
| Independent tube data-node | MISSING   | Oracle has nothing valid to read                                       |
| End-to-end cycle           | UNTRIED   | Zero markets, zero bets, zero closes, zero claims                     |

Three correct components and four missing wires. The program works; nothing has yet asked anything of it.

## 4. Market catalog overview

Eight market types, one hundred-plus instances. Full spec lives in [`/Users/maxguillabert/Downloads/index/data-node/data/tube-rate-tests/MARKETS_LIST.md`](../data-node/data/tube-rate-tests/MARKETS_LIST.md). Do not duplicate it here.

| Type | Subject                                  | Horizon   | Source       | Count |
|------|------------------------------------------|-----------|--------------|------:|
| A    | Star gains ≥ N views in 24 h             | 24 h      | Xvideos      | 16    |
| B    | Star A vs Star B — who gains more in 24 h| 24 h      | Xvideos      | 15    |
| C    | Pornhub rank moves up or down in 24 h    | 24 h      | Pornhub      | 10    |
| D    | Will today's xvideos #1 survive rollover | up to 26 h| Xvideos      | 11    |
| E    | Video view count at next rollover (range)| ~14 h     | Xvideos      | 15    |
| F    | Cam model still online in 10 min         | 10 min    | Chaturbate   | 20    |
| G    | Top cam model viewer count over/under N  | 5 min     | Chaturbate   | 15    |
| H    | Video gains ≥ N views in 2 h             | 2 h       | Xvideos      | 15    |

**Ship order** — preserved from `MARKETS_LIST.md` and `MARKET_DESIGN.md`:

1. **F / G** — cam markets. Chaturbate source already exists; least new infrastructure.
2. **H** — 2 h video view threshold. Smallest data-node addition; validates the bulletproof per-video signal (zero CDN flips).
3. **E** — same per-video data as H, longer horizon.
4. **A / B** — star view threshold and head-to-head. Reuses existing star scrapers.
5. **C** — Pornhub rank. Requires re-enabling the PH source with an SSR/headless path.
6. **D** — rollover survival. Needs rollover-detection trigger.

What we deliberately do not ship: tier-A markets on tubes (the data does not move at seconds), Xnxx head-to-head involving the four bot accounts (`candice-price-model`, `cedric-extra-model`, `johnny-liberty-model`, `violet-haze-extra-model`), Pornhub markets without a headless-browser path, Eporner markets without an age-gate bypass.

## 5. Architecture

A small picture of what talks to what — with the wires that are not yet connected drawn dotted.

```
+----------------------+        +-----------------------------+
|  Tube sites          |        |  Solana devnet              |
|  xvideos / xnxx /    |        |  Program                    |
|  pornhub / chaturbate|        |  DQwMnwQGYuLDvciSFZNgUvc... |
+----------+-----------+        +--------+--------+-----------+
           |                             ^        |
           | scrape (HTTP / API)         |        | logs
           v                             |        v
+----------+-----------+   reads   +-----+--------+-----------+
| nsgame data-node     |<----------+  Oracle daemon (VPS 3)   |
|   ON VPS 3 — TBD     |  (HTTP)   |  /etc/prediction-oracle  |
+----------+-----------+           +--------------------------+
           |                                      ^
           |                                      | (none yet — empty markets)
           v                                      |
   tube_*  prices                          +------+------------+
                                           | Event indexer     |
                                           | (VPS 3)           |
                                           +------+------------+
                                                  |
                                                  v
                                           +------+------------+
                                           | Postgres          |
                                           | 127.0.0.1:5432    |
                                           | 8 tables, empty   |
                                           +------+------------+
                                                  ^
                                                  |  TBD (Dokploy / tunnel / proxy)
                                                  |
+--------------------------------------------+    |
|  nsgame frontend                           +----+
|  Next.js, hosting TBD                      |
|  lib/solana/catalog.ts (today: wrong)      |
+--------------------------------------------+
```

Three components live on VPS 3 and only on VPS 3: oracle daemon, event indexer, Postgres. The data-node will join them. The frontend will reach into Postgres through one of three doors — see punch-list item 5.

## 6. Punch list

Six items. Each is necessary; none is sufficient alone. The cycle in item 6 is the only proof that any of this works.

### 1. Stand up the independent tube-only data-node on VPS 3

**What.** A new data-node service that scrapes tube sites and exposes a single read endpoint the oracle can poll. Independent from the Index data-node — different binary, different port, different metric prefix, different config.

**Why.** The current oracle reads from `https://api.generalmarket.io`, which routes to the L3 RPC and returns HTTP 405. The oracle is doing its job against a wall.

**Where.** Spec: [`docs/data-node-spec.md`](docs/data-node-spec.md).

**Blocking.** Required by items 3, 4, 6. Nothing downstream resolves correctly until this exists.

### 2. Decide and register the on-chain source-id mapping

**What.** Disable the BTC/ETH/SOL sources (ids 1–3, currently registered on chain), choose a source-id layout for tube markets, register them via `upsert_source`. Identifiers like `tubes_xv_star_skye-young2` need to map to small integers the program can hold in 32 bytes.

**Why.** Each market PDA references a `source_id`. The current ids point at imaginary crypto feeds. The frontend cannot ship until the integers it stamps onto markets are honest.

**Where.** Spec: [`docs/source-id-mapping.md`](docs/source-id-mapping.md).

**Blocking.** Required by items 3 and 6. `upsert_source` is idempotent — the disablement is a single tx per stale id.

### 3. Rewrite `lib/solana/catalog.ts` from MARKETS_LIST.md

**What.** Replace the six BTC/ETH/SOL placeholder entries with the canonical tube markets. Start with type F and G (cams) — fastest to validate end-to-end because Chaturbate already returns clean numbers in seconds.

**Why.** Today the catalog markets a product nsgame does not run. The frontend currently lies to anyone who opens it.

**Where.** File: `lib/solana/catalog.ts`. Source of truth for content: [`/Users/maxguillabert/Downloads/index/data-node/data/tube-rate-tests/MARKETS_LIST.md`](../data-node/data/tube-rate-tests/MARKETS_LIST.md). A separate agent owns this rewrite — do not pre-empt.

**Blocking.** Depends on item 2 (source ids must be registered before catalog entries reference them).

### 4. Update oracle `DATA_NODE_URL` on VPS 3 and restart the daemon

**What.** Edit `/etc/prediction-oracle.env`, replace `DATA_NODE_URL=https://api.generalmarket.io` with the URL the new data-node serves on VPS 3 (likely `http://127.0.0.1:<port>` since both processes live on the same host), `systemctl restart prediction-oracle`.

**Why.** Single config line stands between a working oracle and a confused one.

**Where.** Daemon env file documented in [`programs-solana/prediction-market/deploy/vps3-receipt.md`](../programs-solana/prediction-market/deploy/vps3-receipt.md).

**Blocking.** Depends on item 1. Trivial once the data-node is up.

### 5. Wire nsgame frontend to the indexer Postgres

**What.** Decide how the frontend reads from a Postgres bound to `127.0.0.1` on VPS 3. Three options on the table; option A wins on simplicity.

- **A.** Migrate the nsgame frontend to Dokploy on VPS 3 — same pattern as the index frontend, same machine, same loopback access.
- **B.** Cloudflare Tunnel or Tailscale, exposing the indexer Postgres to wherever the frontend lives.
- **C.** Read-only HTTP proxy on VPS 3 that serves indexer tables to anyone who asks.

**Why.** With no path from frontend to Postgres, the entire `app/api/events/*` surface returns nothing.

**Where.** Spec: [`docs/indexer-wiring.md`](docs/indexer-wiring.md). Background: [`programs-solana/prediction-market/deploy/vps3-receipt.md`](../programs-solana/prediction-market/deploy/vps3-receipt.md), step 3.

**Blocking.** Required by item 6. Independent of items 1–4 in implementation order.

### 6. Run one full bet → close → settle → claim cycle on devnet

**What.** Create one market via the frontend (or a script), place a bet, let close time pass, let the oracle resolve it, claim. The first time end-to-end works, write down every PDA, every signature, every error you hit. Stop tracking estimates after that — track invariants.

**Why.** No piece of this stack has ever served a real bet. Until one does, the system is a sequence of plausibly-correct artifacts. Writing software that has never been used is a private hobby.

**Where.** Frontend at `nsgame/`, program at devnet `DQwMnwQGYuLDvciSFZNgUvc...`, daemon at VPS 3.

**Blocking.** Depends on items 1, 2, 3, 4, 5. The cycle is the integration test — and the only way to discover the bugs we have not yet noticed.

## 7. Addresses & receipts

Single source of truth — do not duplicate the address tables.

- Program ID, admin pubkey, oracle pubkey, stake mint, all PDA addresses, every bootstrap tx signature: [`programs-solana/prediction-market/deploy/devnet-receipt.md`](../programs-solana/prediction-market/deploy/devnet-receipt.md)
- VPS 3 binaries, env files, systemd units, smoke results, indexer schema: [`programs-solana/prediction-market/deploy/vps3-receipt.md`](../programs-solana/prediction-market/deploy/vps3-receipt.md)
- Bootstrap procedure, env-var reference, security model: [`programs-solana/prediction-market/deploy/README.md`](../programs-solana/prediction-market/deploy/README.md)

## 8. Legacy / to-be-deprecated

Two artifacts in this folder pre-date the Solana integration and contain claims that no longer hold:

- `nsgame/ACTION-PLAN.md` — claims `@solana/web3.js` is unused and proposes pruning it. Wrong. nsgame depends on `@solana/web3.js` and `@coral-xyz/anchor` for everything in `lib/solana/`. The audit was run against an older snapshot of the project.
- `nsgame/FULL-AUDIT-REPORT.md` — same vintage, same blind spot.

Both are still readable for their bundle-size observations on non-Solana code, but their core recommendations are incompatible with the current architecture. Treat as historical. Recommend deleting them once this PLAN.md is adopted; until then, anyone reading them should know they describe a different version of the project.

## 9. Where to find things

| Concern                                  | Path                                                                                       |
|------------------------------------------|--------------------------------------------------------------------------------------------|
| Master plan (this file)                  | `nsgame/PLAN.md`                                                                           |
| Frontend catalog (to be rewritten)       | `nsgame/lib/solana/catalog.ts`                                                             |
| Solana program IDL                       | `nsgame/lib/solana/idl/prediction_market.json`                                             |
| Program source                           | `programs-solana/prediction-market/programs/prediction-market/`                            |
| Deploy scripts and bootstrap docs        | `programs-solana/prediction-market/deploy/`                                                |
| Devnet deploy receipt (program / PDAs)   | `programs-solana/prediction-market/deploy/devnet-receipt.md`                               |
| VPS 3 deploy receipt (oracle / indexer)  | `programs-solana/prediction-market/deploy/vps3-receipt.md`                                 |
| Oracle daemon source                     | `oracle-daemon/`                                                                           |
| Event indexer source                     | `event-indexer/`                                                                           |
| Market design and tier rationale         | `data-node/data/tube-rate-tests/MARKET_DESIGN.md`                                          |
| Canonical ship list (100+ markets)       | `data-node/data/tube-rate-tests/MARKETS_LIST.md`                                           |
| Rate-limit empirics                      | `data-node/data/tube-rate-tests/FINDINGS.md`                                               |
| Update-cadence empirics (3 runs)         | `data-node/data/tube-rate-tests/UPDATE_FREQUENCY_V3.md`                                    |
| Trending rollover behaviour              | `data-node/data/tube-rate-tests/TRENDING_CADENCE.md`                                       |
| Baseline 48h dataset                     | `data-node/data/tube-rate-tests/collect-48h/run-20260421-2333/events.jsonl`                |
| Source-id mapping spec                   | `nsgame/docs/source-id-mapping.md`                                                         |
| Independent data-node spec               | `nsgame/docs/data-node-spec.md`                                                            |
| Indexer-wiring spec                      | `nsgame/docs/indexer-wiring.md`                                                            |
| Stale audit (do not act on)              | `nsgame/ACTION-PLAN.md`, `nsgame/FULL-AUDIT-REPORT.md`                                     |

---

The program is on devnet. The daemon polls. The indexer waits for an event that has not yet happened. None of this matters until the wires meet — and the wires meet through six small unfinished tasks. There is no rollback. There is only forward.
