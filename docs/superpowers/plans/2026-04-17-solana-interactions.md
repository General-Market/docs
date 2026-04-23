# Solana Prediction Market — Full Interaction Graph

Every actor, every instruction, every inter-party call, every state transition. The picture you look at before you ship, so you see what talks to what.

Companion to `2026-04-17-solana-prediction-market.md`. The plan builds it; this graph explains it.

---

## 1. Actors

| Actor | Kind | Runs where | Holds keys | Writes to chain |
|---|---|---|---|---|
| **Trader** | wallet user (retail) | browser | own wallet | place_bet, exit_bet (never claim — keeper cranks) |
| **Market Maker** | wallet user (advanced) | browser + scripts | own wallet | batch_bets, place_bet, exit_bet |
| **Admin** | governance key (day-one pubkey, later multisig) | hardware wallet | admin key | bootstrap, upsert_source, rotate oracle, pause, fee, force-resolve, withdraw |
| **Oracle Daemon / Keeper** | Rust binary | VPS under systemd | oracle keypair (= ed25519 signer) | close_market, resolve_market, claim (permissionless crank) |
| **Data Node** | existing Rust service (index project) | VPS | none | none (read-only HTTP) |
| **Solana Program** | Anchor Rust program | Solana cluster | none (program ID) | target of all txs |
| **Frontend** | Next.js app (separate project) | Vercel + user's browser | none (delegates to wallet) | none (builds txs the wallet signs) |
| **SPL Token Program** | system | Solana cluster | — | CPI target |
| **Ed25519 Precompile** | system | Solana cluster | — | CPI target (from daemon tx) |
| **Indexer** | optional (Helius / own) | off-chain | none | none |
| **Prometheus** | metrics scraper | ops infra | none | none |

---

## 2. System topology

```mermaid
graph LR
    subgraph Humans
        Trader[Trader]
        MM[Market Maker]
        Admin[Admin]
    end

    subgraph "Browser / Scripts"
        FE[Frontend separate project]
        Wallet[Wallet extension]
        AltCli[alt CLI for MMs]
    end

    subgraph VPS
        Daemon[Oracle Daemon + claim keeper]
        DataNode[Data Node]
        Prom[Prometheus + alerts]
    end

    subgraph "Solana cluster"
        Prog[Prediction Market Program]
        Token[SPL Token Program]
        Ed25519[Ed25519 Precompile]
        ATA[Associated Token Program]
    end

    Indexer[Event Indexer optional]

    Trader --> FE
    MM --> FE
    MM --> AltCli
    Admin -.->|cold signing| Wallet
    FE <--> Wallet
    Wallet -->|signed v0 tx| Prog
    AltCli -->|ALT mgmt tx| Prog

    Prog <-->|CPI| Token
    Prog <-->|CPI| ATA
    Prog -->|emit event| Indexer

    Daemon -->|HTTP GET price| DataNode
    Daemon -->|signed v0 tx ed25519 + close_market| Ed25519
    Daemon -->|signed v0 tx ed25519 + resolve_market| Ed25519
    Daemon -->|same txs| Prog
    Daemon -->|claim crank tx permissionless| Prog
    Daemon -->|getProgramAccounts, getBalance| Prog
    Daemon --> Prom

    Indexer --> FE
```

What the diagram encodes: frontend never talks to the daemon. The daemon never talks to the frontend. Both talk to the program. The data node only talks to the daemon. The admin signs out-of-band; the wallet is the signing boundary.

---

## 3. Instruction surface — who calls what

Ordered by phase. Columns: who's allowed to sign, what accounts it writes, what CPIs it performs, what events it emits, guard errors.

| Instruction | Signer | Writes | Reads | CPIs | Events | Main error paths |
|---|---|---|---|---|---|---|
| `initialize_config` | admin | `GlobalConfig`, `fee_vault` | `stake_mint` | Token (init fee_vault) | — | FeeTooHigh |
| `upsert_source` | admin | `Source` | `GlobalConfig` | System (init if new) | — (silent per MR10) | Unauthorized |
| `propose_oracle_signers` | admin | `OracleConfig` (pending slots) | `GlobalConfig` | — | — | Unauthorized, PendingAlreadyQueued, ThresholdNotMet |
| `activate_oracle_signers` | anyone | `OracleConfig` (promote) | Clock | — | `OracleSignersActivated` | PendingNotReady, NoPending |
| `set_pause` | admin | `GlobalConfig.paused` | — | — | — | Unauthorized |
| `set_fee_bps` | admin | `GlobalConfig.fee_bps` | — | — | — | Unauthorized, FeeTooHigh |
| `propose_admin` | admin | `GlobalConfig.pending_admin` | — | — | — | Unauthorized |
| `accept_admin` | pending_admin | `GlobalConfig.admin` | — | — | — | Unauthorized, NoPending |
| `withdraw_fees` | admin | `fee_vault`, destination | — | Token (transfer, PDA-signed) | — | Unauthorized |
| `place_bet` | user | `Market` (init if first), `Position` (init if first), `vault` (init if first), `user_ata` (init if first) | `GlobalConfig`, `Source`, `stake_mint`, Clock | Token (transfer in), ATA (init) | `BetPlaced`, `MarketInstantiated` (first only) | Paused, SourceDisabled, BadThreshold, BadTime |
| `exit_bet` | user | `Market.totals`, `Position` | Clock | Token (transfer out, market-signed) | `BetExited` | WindowClosed, InsufficientBalance |
| `batch_bets` | user | N × `Market` (init if new) and `Position` | `GlobalConfig`, Clock | Token × N | N × `BetPlaced` (+ `MarketInstantiated` for newly created) | Paused, BatchTooLarge, Unauthorized, WindowClosed |
| `close_market` | anyone (daemon in practice) | `Market.baseline_price` | `OracleConfig`, Instructions sysvar, Clock | — | `MarketClosed` | AlreadyClosed, NotClosable, ThresholdNotMet, BadSignature |
| `resolve_market` | anyone (daemon in practice) | `Market` (final, outcome, resolved) | `OracleConfig`, `Market.baseline_price`, Instructions sysvar, Clock | — | `MarketResolved` | NotResolvable, AlreadyResolved, BaselineMissing, ThresholdNotMet, BadSignature |
| `admin_force_resolve` | admin | `Market` | `GlobalConfig`, Clock | — | `MarketResolved { force_resolved: true }` | Unauthorized, AlreadyResolved, ForceResolveTooEarly |
| `claim` | **cranker (permissionless)** | `Market`, `Position` (closed), `vault`, `fee_vault`, `owner_ata` (init if needed) | `GlobalConfig`, `Source`, Clock | Token × up to 2 (payout to owner, fee to fee_vault, market-signed), ATA (init) | `Claimed` | Unresolved, AlreadyClaimed |

**Note on `claim`**: after the Round 4–7 simplifications, `claim` uniformly closes the Position regardless of branch. Three internal paths:
- Winner (stake > 0, on winning side): compute parimutuel payout, transfer net to user + fee to fee_vault (or zero fee if one-sided pool), close Position to owner.
- Stranded (winning_total == 0, impossible to win): refund `yes_amount + no_amount` to owner, close Position.
- Loser (stake > 0 but on losing side): zero transfer, close Position, rent returned to owner.

---

## 4. Lifecycle — admin bootstrap

```mermaid
sequenceDiagram
    participant Admin
    participant Wallet
    participant Prog as Program
    participant Daemon

    Admin->>Wallet: sign initialize_config(fee_bps=50)
    Wallet->>Prog: initialize_config
    Note over Prog: GlobalConfig + fee_vault PDA created
    Admin->>Wallet: sign upsert_source(source_id=7, name="BTC/USD", enabled=true)
    Wallet->>Prog: upsert_source
    Note over Prog: Source PDA created or updated
    Admin->>Wallet: sign propose_oracle_signers(daemon_pubkey, threshold=1)
    Wallet->>Prog: propose_oracle_signers
    Note over Prog: OracleConfig.pending filled<br/>activation_ts = now + 24h
    Note over Admin: wait 24h
    Daemon->>Prog: activate_oracle_signers (anyone can crank)
    Note over Prog: emit OracleSignersActivated
    Note over Daemon: single stateless loop — on each wake queries chain<br/>for Markets needing close_market, resolve_market, or claim crank (MR8)<br/>no per-type tokio loops, no local state
```

---

## 5. Lifecycle — trader: first bet through claim

```mermaid
sequenceDiagram
    participant Alice as Alice (Trader)
    participant Wallet
    participant FE as Frontend
    participant Prog as Program
    participant ATA as ATA Program
    participant Token as SPL Token
    participant Daemon
    participant DN as Data Node

    Note over Alice,FE: Alice picks a market from frontend menu<br/>close_time = now + 150s, settlement_time = now + 300s, threshold = +50 bps

    Alice->>FE: click "Bet YES, 1 USDC"
    FE->>Wallet: request sign place_bet(source=7, close_time, settlement_time, threshold=+50, Yes, 1_000_000)
    Wallet->>Prog: place_bet (signed)
    Prog->>ATA: init_if_needed user_ata
    Prog->>Prog: init Market, Position, vault (first bet)<br/>Market PDA seeded by (source, close, settle, threshold)
    Prog->>Token: CPI transfer 1 USDC user_ata to vault
    Note over Prog: emit MarketInstantiated<br/>emit BetPlaced
    Prog-->>Wallet: tx confirmed

    Note over Daemon: daemon queries chain, finds Market needing close_market at close_time

    Note over Daemon,DN: at close_time
    Daemon->>DN: GET /v1/sources/7/price
    DN-->>Daemon: price 1e18, ts
    Note over Daemon: sign payload source || close_time || 1e18 || TAG_CLOSE
    Daemon->>Prog: tx ed25519_ix, close_market(baseline=1e18, sigs)
    Prog->>Prog: verify_multisig, write baseline_price
    Note over Prog: emit MarketClosed

    Note over Daemon,DN: at settlement_time
    Daemon->>DN: GET /v1/sources/7/price
    DN-->>Daemon: price 1.01e18, ts
    Note over Daemon: sign payload source || settlement_time || 1.01e18 || TAG_RESOLVE
    Daemon->>Prog: tx ed25519_ix, resolve_market(final=1.01e18, sigs)
    Prog->>Prog: verify_multisig, read Market.baseline_price, compute outcome
    Note over Prog: outcome_yes = true (1.01e18 >= 1e18*1.005)<br/>emit MarketResolved

    Note over Daemon: keeper sweep — finds resolved Market with unclaimed Position
    Daemon->>Prog: claim (permissionless, daemon signs)
    Prog->>ATA: init_if_needed owner_ata for Alice
    Prog->>Token: transfer net payout vault to owner_ata
    Prog->>Token: transfer fee vault to fee_vault
    Prog->>Prog: close Position, rent to Alice
    Note over Prog: emit Claimed
    Note over Alice: Alice sees USDC arrive in her wallet — never clicked
```

---

## 6. Lifecycle — market maker batch

```mermaid
sequenceDiagram
    participant MM as Market Maker
    participant AltCli as Alt CLI
    participant Wallet
    participant Prog as Program

    Note over MM,AltCli: one-time per MM cohort
    MM->>AltCli: alt create
    AltCli->>Prog: AddressLookupTableProgram.createLookupTable
    MM->>AltCli: alt extend (market1, position1, vault1, ata1, ...)
    AltCli->>Prog: extendLookupTable
    Note over Prog: ALT holds up to 256 pubkeys<br/>referenced by 1-byte index in v0 txs

    Note over MM: for each window
    MM->>Wallet: sign batch_bets with ALT reference
    Wallet->>Prog: v0 tx
    loop 24 entries
        Prog->>Prog: derive + verify Market PDA, Position PDA<br/>init_if_needed where missing
        Prog->>Prog: transfer stake, update totals
        Note over Prog: emit BetPlaced per entry<br/>emit MarketInstantiated for newly-created
    end
```

---

## 7. Lifecycle — oracle resolution (sig verification detail)

Two oracle txs per market — one at `close_time` pushing baseline, one at `settlement_time` pushing final. Both gated by ed25519 multisig.

```mermaid
sequenceDiagram
    participant Daemon
    participant Ed as Ed25519 Precompile
    participant Prog as Program
    participant Sysvar as Instructions Sysvar

    Note over Daemon: at close_time: payload = source_id || close_time || baseline_price || tag_close
    Daemon->>Ed: tx ix 0 Ed25519 precompile pubkey sig payload
    Daemon->>Prog: tx ix 1 close_market(baseline, sigs)
    Prog->>Sysvar: load_instruction_at_checked 0
    Sysvar-->>Prog: ix 0 bytes
    Prog->>Prog: parse offsets, verify pk in active_signers, verify message
    Note over Prog: write Market.baseline_price<br/>emit MarketClosed

    Note over Daemon: at settlement_time: payload = source_id || settlement_time || final_price || tag_resolve
    Daemon->>Ed: tx ix 0 Ed25519 precompile pubkey sig payload
    Daemon->>Prog: tx ix 1 resolve_market(final, sigs)
    Prog->>Sysvar: load_instruction_at_checked 0
    Sysvar-->>Prog: ix 0 bytes
    Prog->>Prog: same verification path
    Prog->>Prog: read stored baseline, compute outcome vs final + threshold_bps
    Note over Prog: write Market.final_price, outcome_yes, resolved<br/>emit MarketResolved
```

Critical: the ed25519 precompile has already cryptographically verified the signature. The program only verifies the precompile was called with the right arguments — pubkey is a known oracle, message is the expected payload. Baseline is captured and committed on-chain at `close_time`; `resolve_market` reads it from Market state and only carries the final price.

---

## 8. Lifecycle — admin escape hatch (proportional delay)

Admin monitors markets via their own channels — block explorers, custom dashboards, the daemon's own logs. When a stuck market is spotted, force-resolve is called directly. No ops CLI ships.

```mermaid
sequenceDiagram
    participant Admin
    participant Wallet
    participant Prog as Program

    Note over Admin: spots stuck Market in monitoring
    Admin->>Wallet: sign admin_force_resolve(market, baseline, final)
    Wallet->>Prog: admin_force_resolve
    Note over Prog: require now >= settlement_time + (settlement_time - close_time)<br/>(one full observation window past missed settlement)<br/>emit MarketResolved { force_resolved: true }
```

Claim path identical after force-resolve — the permissionless keeper cranks it the same way, payout still flows to the Position owner. Traders never notice whether the daemon or the admin wrote the outcome.

---

## 9. State machine — `Market` PDA

```mermaid
stateDiagram-v2
    [*] --> Uninstantiated
    Uninstantiated --> Open: first place_bet<br/>init_if_needed<br/>emit MarketInstantiated + BetPlaced
    Open --> Open: additional place_bet / exit_bet<br/>emit BetPlaced or BetExited
    Open --> Locked: now >= close_time<br/>(implicit, no ix fires)
    Locked --> Locked: place_bet / exit_bet rejected WindowClosed
    Locked --> Closed: close_market by daemon at close_time<br/>writes baseline_price<br/>emit MarketClosed
    Closed --> Resolved: resolve_market by daemon at settlement_time<br/>or admin_force_resolve one observation window later<br/>writes final_price + outcome<br/>emit MarketResolved
    Resolved --> Resolved: claim crank per Position<br/>emit Claimed<br/>Position closed, rent returned to owner
    Resolved --> [*]: all Positions claimed<br/>Market PDA persists as history
```

Three notable properties: (1) there is no `Uninstantiated -> Locked` path — a window with zero bets is never a Market. (2) The `Locked -> Closed` transition is the first oracle touch; `Closed -> Resolved` is the second. (3) Claim is cranked by a keeper, not by the trader.

---

## 10. State machine — `OracleConfig`

```mermaid
stateDiagram-v2
    [*] --> Empty: initialize_config
    Empty --> Active: propose_oracle_signers([S], threshold)<br/>pending filled
    Active --> PendingChange: propose_oracle_signers(newS, newT)<br/>pending_activation_ts = now + 24h
    PendingChange --> Active: activate_oracle_signers after 24h<br/>or propose_oracle_signers([], 0) = instant cancel
    Active --> Active: verify_multisig reads active_signers<br/>during PendingChange window too<br/>(active keeps operating)
```

Key property: during a pending change window, the oracle keeps resolving markets. There is no 24h freeze — active stays authoritative until explicitly promoted.

---

## 11. Data flows — every byte path

```mermaid
graph LR
    subgraph "Off-chain"
        DN[Data Node prices]
        OK[Oracle keypair on disk]
    end

    subgraph "Daemon process (stateless)"
        Scan[chain scan<br/>getProgramAccounts Market]
        Fetch[feed price fetch]
        Sign[build_payload + sign]
        Sub[build_and_submit]
    end

    subgraph "Solana cluster"
        Ed[Ed25519 precompile]
        Prog[Program]
        IxSys[Instructions sysvar]
    end

    Prog -->|Market state| Scan
    Scan -->|"markets needing close / resolve / claim"| Fetch
    DN -->|HTTP GET| Fetch
    Fetch -->|price + ts| Sign
    OK -->|32-byte seed| Sign
    Sign -->|49-byte payload + 64-byte sig| Sub
    Sub -->|tx ix 0| Ed
    Sub -->|tx ix 1| Prog
    Ed -.->|ix recorded| IxSys
    Prog -->|load_instruction_at_checked| IxSys
    Prog -->|verify against expected payload| Prog
```

Three distinct byte surfaces: HTTP (daemon to data-node), ed25519 bytes (signed payload, TAG_CLOSE or TAG_RESOLVE), Solana tx bytes. No local persistence beyond the oracle keypair file — the chain is the source of truth for what needs doing.

---

## 12. Per-actor surface — what each party calls and never calls

### Trader (retail wallet)

**Calls:** `place_bet`, `exit_bet`.
**Never calls:** `claim` (permissionless, the keeper does it). Not `activate_oracle_signers`, not `resolve_market`, not `close_market`, not any admin ix.
**Reads (via RPC):** `Source` PDAs (whitelist), `Market` PDAs (pool state + resolution), own `Position` PDAs (stake + claim status).
**Watches (via events):** `BetPlaced` (own), `MarketResolved` (markets held), `Claimed` (own — arrives automatically via keeper crank).

### Market Maker

**Calls:** `place_bet`, `exit_bet`, `batch_bets`. Runs the `alt` CLI out-of-band to manage their Address Lookup Table.
**Never calls:** `claim` (keeper cranks), admin ixs, oracle ixs.

### Admin

**Calls:** `initialize_config` (once), `upsert_source` (per source), `propose_oracle_signers` + `activate_oracle_signers` (rotation), `set_pause`, `set_fee_bps`, `propose_admin` + `accept_admin` (handoff), `withdraw_fees` (revenue), `admin_force_resolve` (escape hatch).
**Never calls:** `place_bet`, `exit_bet`, `claim`, `close_market`, `resolve_market`. Admin is not a trader and not the oracle.

### Oracle Daemon

**Calls:** `close_market` and `resolve_market`. Also cranks `claim` on resolved markets (can be a separate bot; same pubkey either way).
**Never calls:** `place_bet`, `exit_bet`, `batch_bets`, anything admin.
**Reads (via RPC):** `Market` PDAs on every wake (stateless discovery), own signer balance (`getBalance`).
**HTTP clients:** data-node `/v1/sources/{id}/price`.
**Writes locally:** nothing. Oracle keypair file on disk is the only persistent artifact.

### Data Node

**Serves:** HTTP `GET /v1/sources/{id}/price` returning `{price: u128, ts: i64}`.
**Knows nothing about:** Solana, markets, signatures, the oracle daemon. It's an upstream feed.

### Frontend

**Builds txs for:** `place_bet`, `exit_bet`, `batch_bets` (MM mode). All signed by the user's wallet, submitted via Solana RPC. Frontend ships with a hardcoded catalog of `(source, threshold, close_offset, settle_offset)` combinations; resolves them to concrete timestamps at click time.
**Reads (via RPC):** `Source` PDAs, `Market` PDAs, `Position` PDAs.
**Consumes events:** via an indexer (Helius / custom). Never talks to the daemon directly.
**Never:** builds txs for `claim` (keeper does), signs oracle payloads, calls any admin ix.

### Indexer (optional)

**Subscribes to:** program events. Reindexes `BetPlaced`, `BetExited`, `MarketInstantiated`, `MarketClosed`, `MarketResolved`, `Claimed`, `OracleSignersActivated`.
**Serves:** historical queries for the frontend — "all markets for source X", "user's claim history", etc.

---

## 13. Failure matrix — what dies when what breaks

| Failure | Impact | Recovery |
|---|---|---|
| Data-node down | Daemon can't fetch price for `close_market` or `resolve_market` | Markets whose `close_time` or `settlement_time` fall during outage miss their oracle tx. Admin force-resolve unlocks `settlement_time + (settlement_time - close_time)` past settlement. |
| Daemon crashes mid-window | Stateless daemon — on restart queries chain, retries pending `close_market` / `resolve_market` / `claim` actions. No local state to lose. | Systemd restart, daemon resumes. If crash persists past force-resolve threshold, admin steps in. |
| Daemon keypair drained of SOL | Txs fail silently to land | Prometheus gauge alerts; boot refuses < 0.1 SOL (SA14). Refill from treasury. |
| Ed25519 SDK layout drift | Signature verification breaks | CI test (SR5) hashes upstream layout — build fails before deploy. |
| RPC cluster partial outage | Daemon retries with backoff | If partition exceeds one observation window, admin force-resolve. |
| Admin key lost | Protocol frozen for upgrades; resolutions continue via daemon; claims continue via keeper | Inevitable. `propose_admin` + `accept_admin` only help if BOTH old and new keys are usable. Document disaster scenarios. |
| Oracle key compromised | Attacker can `close_market` / `resolve_market` with arbitrary prices | Admin calls `propose_oracle_signers` with new set; 24h later `activate`. Compromised period loses markets resolved during it. Consider shorter rotation for this path. |
| Frontend down | Users can't open new bets via browser | MMs still have scripts. Direct-RPC access via CLI survives. Claims continue regardless (keeper). Frontend is non-critical infra. |
| Fee vault overfills | None — tokens accrue indefinitely | Admin `withdraw_fees`. |
| Keeper (claim cranker) stops | Resolved markets sit unclaimed; rent not reclaimed | Any third party can run a keeper — the ix is permissionless. Protocol runs one alongside the daemon. |

---

## 14. What is NOT here (deliberate)

- Cross-chain bridges. This is Solana-only.
- Long-running stateful LP positions. This is parimutuel, not orderbook.
- Governance tokens or staking. Admin is a plain pubkey, rotatable via two-step handoff.
- Off-chain solver networks for resolution. One daemon, one key, one source.
- Anything front-running-sensitive at the pool level — 2.5-minute window + lazy creation make timing attacks uneconomic at small size, though MEV analysis remains on the open-questions list.

---

## 15. Sanity invariants the reader should confirm

1. **Wallet signatures are never forged.** The wallet signs trader / MM / admin txs; the daemon signs oracle txs (`close_market`, `resolve_market`). Permissionless cranks exist (`activate_oracle_signers`, `claim`) — anyone can sign them, but the program enforces that value flows to the rightful on-chain owner. Cranking is not impersonation.

2. **Program never calls out to anything untrusted.** CPIs go only to SPL Token and Associated Token Program — both Solana system programs. No external oracles, no custom CPIs.

3. **Every mutating ix emits at least one event describing its effect.** `batch_bets` emits one per entry. `place_bet` emits `MarketInstantiated` + `BetPlaced` on first touch of a new Market. Admin-surface ixs currently lack events — `set_pause`, `set_fee_bps`, `propose_admin`, `accept_admin`, `withdraw_fees`, `upsert_source`, `propose_oracle_signers`. If audit trails matter, add events for each; otherwise accept that admin actions are discoverable only via tx history.

4. **Every PDA has an enumerated writer list.**
   - `Market` — written by `place_bet`, `exit_bet`, `batch_bets`, `close_market`, `resolve_market`, `admin_force_resolve`, `claim`.
   - `Position` — written by `place_bet`, `exit_bet`, `batch_bets`; closed by `claim`.
   - `Source` — written only by `upsert_source`. (Replaces the former `MarketType`.)
   - `OracleConfig` — written by `propose_oracle_signers` and `activate_oracle_signers`.
   - `GlobalConfig` — written by `initialize_config`, `set_pause`, `set_fee_bps`, `propose_admin`, `accept_admin`.
   - Fee vault — CPI-written by `claim` (fee inflow) and `withdraw_fees` (admin outflow).

5. **The daemon is fully stateless.** Baseline lives on-chain from `close_time` onward; SQLite and the tick cache are gone. On wake the daemon queries chain state (`getProgramAccounts Market`) and decides what to do — submit `close_market` for markets where `close_time <= now` and no baseline, submit `resolve_market` for markets where `settlement_time <= now` and not yet resolved. Restart loses nothing.

6. **Admin cannot alter outcomes until one full observation window past settlement.** `admin_force_resolve` rejects until `now >= settlement_time + (settlement_time - close_time)`. The admin must wait a second observation window beyond the missed settlement before stepping in. Nothing else the admin does touches user positions, mints tokens, or bypasses the signed-oracle path.

If any of these reads wrong, the plan has a bug.
