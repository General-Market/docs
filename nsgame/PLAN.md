# nsgame — Master Plan

A Solana program landed on devnet. A daemon talks to the wrong data source. A frontend shows the wrong markets. Three correct pieces, none of them yet pointed at each other. This document exists so that the next person opening this folder knows that — and what to do about it.

---

## 1. What nsgame is

A prediction-market frontend on Solana devnet, settling bets on adult-tube-site signals: star view counts, listing ranks, cam-room viewer counts. Eight market types, roughly one hundred concrete instances waiting to ship. The program is on-chain. The catalog is not yet connected to it.

## 2. What nsgame is not

It is not generalmarket.io. It shares a monorepo with the Index project — Ethereum L3, oracle BLS, ITP shares, all of that — and shares nothing else. Different chain. Different oracles. Different data-node. Different markets. They live in the same git tree the way two strangers live in the same building. Do not cross the wires.

## 3. Decisions log

Settled 2026-04-25 — recorded here so no one relitigates them in another conversation.

- **No new domain yet.** `nsgame.dev` and `api.nsgame.dev` are deferred. Until a domain exists, the data-node binds to localhost on VPS 3 and the oracle reaches it via `http://127.0.0.1:8201`. The frontend stays on local development. Public HTTPS for nsgame is a problem we will buy when we need it, not before.
- **Single monorepo.** No `nsgame-frontend.git` mirror, no second remote, no second deploy pipeline. nsgame ships from this mono repo or it does not ship.
- **Solana RPC: Helius free tier.** Oracle on VPS 3 switched 2026-04-25 from public devnet to `https://devnet.helius-rpc.com/?api-key=…` (key reused from `.env.data-node`). Backup of the previous env file at `/etc/prediction-oracle.env.bak-2026-04-25`. Boot verified, scheduler restarted.
- **Frontend catalog rewritten.** `lib/solana/catalog.ts` now holds 35 cam-room markets (Types F + G from `MARKETS_LIST.md`). Crypto placeholders gone.
- **Catalog rewrite intentionally narrow.** Types A, B, C, D, E, H stay in the roadmap. The first cycle ships on cams because Chaturbate already returns clean integers in seconds.

Open question that did not survive the day: whether to fork a `tube-data-node` crate. Rejected — second binary, double maintenance, no win. Spec assumes a single binary, allowlist-gated.

## 4. Current state

Ground truth as of 2026-04-25. Read this before changing anything else.

| Component                  | Status     | Detail                                                                 |
|---------------------------|-----------|------------------------------------------------------------------------|
| Solana program             | DEPLOYED  | `DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA` — devnet                |
| Oracle daemon              | RUNNING   | VPS 3, `prediction-oracle.service`, Helius RPC, signer set active     |
| Event indexer              | RUNNING   | VPS 3, `prediction-indexer.service`, schema applied, cursor at tip    |
| Postgres (indexer DB)      | RUNNING   | VPS 3, `127.0.0.1:5432`, 8 tables, all empty                          |
| Registered on-chain sources| WRONG     | id=1 BTC/USD, id=2 ETH/USD, id=3 SOL/USD — crypto placeholders         |
| Oracle `DATA_NODE_URL`     | WRONG     | Points at `https://api.generalmarket.io` — the L3 RPC, returns HTTP 405|
| Frontend catalog           | DONE      | `lib/solana/catalog.ts` — 35 cam markets (F1–F20, G1–G15)             |
| nsgame ↔ Postgres wiring   | UNRESOLVED| Postgres bound to localhost; SSH tunnel for local dev, Dokploy later   |
| Independent tube data-node | MISSING   | Oracle has nothing valid to read                                       |
| End-to-end cycle           | UNTRIED   | Zero markets, zero bets, zero closes, zero claims                     |

Three correct components, three missing wires, one corrected. The program works; nothing has yet asked anything of it.

## 5. Market catalog overview

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

## 6. Architecture

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

## 7. Punch list

Five items now that the catalog is rewritten and the RPC is settled. Item 5 is the only proof that any of this works.

### 1. Stand up the independent tube-only data-node on VPS 3

**What.** A second instance of the existing `data-node` binary on VPS 3, gated by `SOURCE_ALLOWLIST=tubes,chaturbate`. Binds to `127.0.0.1:8201`. No public HTTPS yet — the oracle sits on the same host and reads via loopback.

**Why.** The current oracle reads from `https://api.generalmarket.io`, which routes to the L3 RPC and returns HTTP 405. The oracle is doing its job against a wall.

**Where.** Spec: [`docs/data-node-spec.md`](docs/data-node-spec.md).

**Blocking.** Required by items 3 and 5. Nothing downstream resolves correctly until this exists. Public exposure deferred until the frontend needs to call it directly — today only the oracle does, and the oracle lives on the same machine.

### 2. Register the on-chain source-id mapping

**What.** Repurpose the BTC/ETH/SOL source PDAs (ids 1–3, currently registered) by re-`upsert_source`-ing them with tube names: `1=tubes_xv, 2=tubes_xn, 3=tubes_ph`. Add `4=tubes_cb` and `5=tubes_ep`. The crypto-named PDAs live on devnet forever as artifacts; we just rewrite their names and enable state.

**Why.** Each market PDA references a `source_id`. The current ids point at imaginary crypto feeds. The frontend cannot ship until the integers it stamps onto markets are honest.

**Where.** Spec: [`docs/source-id-mapping.md`](docs/source-id-mapping.md).

**Blocking.** Required by item 5. `upsert_source` is idempotent — five admin-signed txs.

### 3. Update oracle `DATA_NODE_URL` on VPS 3 and restart the daemon

**What.** Edit `/etc/prediction-oracle.env`, replace `DATA_NODE_URL=https://api.generalmarket.io` with `http://127.0.0.1:8201`, `systemctl restart prediction-oracle`.

**Why.** Single config line stands between a working oracle and a confused one.

**Where.** Daemon env file documented in [`programs-solana/prediction-market/deploy/vps3-receipt.md`](../programs-solana/prediction-market/deploy/vps3-receipt.md).

**Blocking.** Depends on item 1. Trivial once the data-node is up.

### 4. Wire nsgame frontend to the indexer Postgres — local dev first

**What.** For now: SSH tunnel from a developer laptop to VPS 3 Postgres. `ssh -L 5433:127.0.0.1:5432 vps3` and point local `POSTGRES_URL` at `localhost:5433`. nsgame runs on `npm run dev`. No production hosting, no Dokploy app, no domain.

**Why.** Postgres listens where we told it to listen. The service that needs it must come to it. A tunnel is the cheapest door.

**Where.** Spec: [`docs/indexer-wiring.md`](docs/indexer-wiring.md). Phase 0 is the SSH tunnel; Phase 1 (Dokploy from a mono-repo subpath) waits until a domain exists.

**Blocking.** Required by item 5. Independent of items 1–3 in implementation order.

### 5. Run one full bet → close → settle → claim cycle on devnet

**What.** Create one market via the frontend (or a script), place a bet, let close time pass, let the oracle resolve it, claim. The first time end-to-end works, write down every PDA, every signature, every error you hit. Stop tracking estimates after that — track invariants.

**Why.** No piece of this stack has ever served a real bet. Until one does, the system is a sequence of plausibly-correct artifacts. Writing software that has never been used is a private hobby.

**Where.** Frontend at `nsgame/` (run locally), program at devnet `DQwMnwQGYuLDvciSFZNgUvc...`, daemon at VPS 3.

**Blocking.** Depends on items 1, 2, 3, 4. The cycle is the integration test — and the only way to discover the bugs we have not yet noticed.

## 8. Addresses & receipts

Single source of truth — do not duplicate the address tables.

- Program ID, admin pubkey, oracle pubkey, stake mint, all PDA addresses, every bootstrap tx signature: [`programs-solana/prediction-market/deploy/devnet-receipt.md`](../programs-solana/prediction-market/deploy/devnet-receipt.md)
- VPS 3 binaries, env files, systemd units, smoke results, indexer schema: [`programs-solana/prediction-market/deploy/vps3-receipt.md`](../programs-solana/prediction-market/deploy/vps3-receipt.md)
- Bootstrap procedure, env-var reference, security model: [`programs-solana/prediction-market/deploy/README.md`](../programs-solana/prediction-market/deploy/README.md)

## 9. Legacy / to-be-deprecated

Two artifacts in this folder pre-date the Solana integration and contain claims that no longer hold:

- `nsgame/ACTION-PLAN.md` — claims `@solana/web3.js` is unused and proposes pruning it. Wrong. nsgame depends on `@solana/web3.js` and `@coral-xyz/anchor` for everything in `lib/solana/`. The audit was run against an older snapshot of the project.
- `nsgame/FULL-AUDIT-REPORT.md` — same vintage, same blind spot.

Both are still readable for their bundle-size observations on non-Solana code, but their core recommendations are incompatible with the current architecture. Treat as historical. Recommend deleting them once this PLAN.md is adopted; until then, anyone reading them should know they describe a different version of the project.

## 10. Where to find things

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
