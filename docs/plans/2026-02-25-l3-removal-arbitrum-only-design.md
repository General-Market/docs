# L3 Removal — Arbitrum-Only ITP System (v2)

## What Stays / What Goes

### Contracts (Solidity)

```
contracts/src/
├── core/
│   ├── Investment.sol          ✅ STAYS  (major rewrite — new settleBatch, decimal conversion, no bridge, delete emitAssetTrades)
│   ├── InvestmentStorage.sol   ✅ STAYS  (new storage layout — lastBatchNonce, custody, no authorizedBridge)
│   ├── ITP.sol                 ✅ STAYS  (plain ERC20, drop ERC4626 inheritance)
│   ├── BLSCustody.sol          ✅ STAYS  (governance multisig, unchanged)
│   └── ItpCustody.sol          🆕 NEW   (single contract, mapping(itpId => balance))
│
├── custody/
│   ├── ArbBridgeCustody.sol    ❌ DELETE
│   └── L3BridgeCustody.sol     ❌ DELETE
│
├── bridge/
│   ├── BridgeProxy.sol         ❌ DELETE
│   ├── BridgedITP.sol          ❌ DELETE
│   └── BridgedItpFactory.sol   ❌ DELETE
│
├── oracle/
│   └── ITPNAVOracle.sol        ❌ DELETE (NAV now inside settleBatch, no separate oracle)
│
├── registry/
│   ├── IssuerRegistry.sol      ✅ STAYS  (fresh deploy on Arbitrum, same contract)
│   ├── MirrorIssuerRegistry.sol ❌ DELETE (was Arb mirror of L3 registry, no longer needed)
│   ├── AssetPairRegistry.sol   ✅ STAYS
│   ├── CollateralRegistry.sol  ✅ STAYS
│   └── FeeRegistry.sol         ✅ STAYS
│
├── libraries/
│   ├── BLSLib.sol              ✅ STAYS
│   ├── BLSVerifier.sol         ✅ STAYS  (switch staleness to block.timestamp)
│   ├── DecimalLib.sol          ✅ STAYS  (6↔18 conversion, now used in Investment.sol directly)
│   ├── TypesLib.sol            ✅ STAYS  (new enum: PENDING/FILLED/CANCELLED/EXPIRED/FAILED)
│   ├── EventsLib.sol           ✅ STAYS  (new events: FillFailed, OrderCancelled)
│   ├── RebalanceLib.sol        ✅ STAYS
│   └── AdminLib.sol            ✅ STAYS
│
├── interfaces/
│   ├── IInvestment.sol         ✅ STAYS  (new interface — submitOrder, settleBatch, cancelOrder, etc.)
│   ├── IIssuerRegistry.sol     ✅ STAYS
│   ├── IITP.sol                ✅ STAYS
│   ├── IBLSCustody.sol         ✅ STAYS
│   ├── IBridgeProxy.sol        ❌ DELETE
│   ├── IBridge.sol             ❌ DELETE
│   ├── IBridgedITP.sol         ❌ DELETE
│   ├── IBridgedItpFactory.sol  ❌ DELETE
│   ├── IITPNAVOracle.sol       ❌ DELETE
│   └── IMirrorIssuerRegistry.sol ❌ DELETE
│
├── vision/                     ✅ STAYS  (unrelated to ITP settlement)
└── Governance.sol              ✅ STAYS
```

**Score**: 12 files deleted, 17 files stay, 1 new file.

### Issuer Node (Rust)

```
issuer/src/
├── main.rs                     ✅ STAYS  (rewire: remove bridge, add settlement loop)
├── config.rs                   ✅ STAYS  (remove L3 RPC, add Arbitrum-only config)
├── lib.rs                      ✅ STAYS
│
├── consensus/
│   ├── protocol.rs             🔄 MAJOR REWRITE (remove 15+ bridge message types, add settle_batch + cancel)
│   ├── messages.rs             🔄 MAJOR REWRITE (new: build_settle_batch_hash, build_cancel_order_hash)
│   ├── aggregator.rs           ✅ STAYS  (BLS partial sig aggregation, unchanged)
│   ├── keys.rs                 ✅ STAYS
│   ├── state.rs                ✅ STAYS
│   ├── itp_creation.rs         ✅ STAYS
│   ├── rebalance_request.rs    ✅ STAYS
│   ├── equivocation.rs         ✅ STAYS
│   └── mod.rs                  ✅ STAYS
│
├── cycle/                      ❌ DELETE ENTIRE MODULE
│   ├── manager.rs              ❌ DELETE (5-phase cycle manager → replaced by settlement loop)
│   ├── phase.rs                ❌ DELETE (ProcessFills/Netting/InventoryCheck/GenerateBatch/SignSubmit)
│   ├── state.rs                ❌ DELETE
│   ├── ntp.rs                  ❌ DELETE (wall-clock alignment)
│   ├── tests.rs                ❌ DELETE
│   └── mod.rs                  ❌ DELETE
│
├── bridge/                     ❌ DELETE ENTIRE MODULE
│   ├── orchestrator.rs         ❌ DELETE (cross-chain order flow)
│   ├── types.rs                ❌ DELETE
│   ├── watchdog.rs             ❌ DELETE (bridge timeout monitoring)
│   └── mod.rs                  ❌ DELETE
│
├── settlement/                 🆕 NEW MODULE (replaces cycle/ + bridge/)
│   ├── loop.rs                 🆕 NEW   (1s timer, read orders → compute → sign → submit)
│   ├── compute.rs              🆕 NEW   (compute_settlement: NAV, filter, fills)
│   └── mod.rs                  🆕 NEW
│
├── chain/
│   ├── arbitrum_reader.rs      ✅ STAYS  (now the ONLY chain reader — reads Investment events)
│   ├── writer.rs               🔄 REWRITE (settleBatch calldata to Arbitrum, not confirmBatch to L3)
│   ├── reader.rs               ❌ DELETE (L3 chain reader)
│   ├── custody_writer.rs       ❌ DELETE (L3BridgeCustody writes)
│   ├── gas.rs                  ✅ STAYS
│   ├── nonce.rs                ✅ STAYS
│   ├── retry.rs                ✅ STAYS
│   ├── events/
│   │   ├── cross_chain_order.rs ❌ DELETE
│   │   ├── registry_sync.rs    ✅ STAYS
│   │   ├── rebalance.rs        ✅ STAYS
│   │   ├── itp_creation.rs     ✅ STAYS
│   │   └── mod.rs              ✅ STAYS
│   └── mod.rs                  ✅ STAYS
│
├── netting/
│   ├── pair.rs                 ✅ STAYS  (asset decomposition for NAV)
│   ├── asset_decompose.rs      ✅ STAYS
│   ├── fees.rs                 ✅ STAYS
│   ├── rebalance.rs            ✅ STAYS
│   ├── bridge.rs               ❌ DELETE (bridge netting)
│   ├── usdt.rs                 ✅ STAYS
│   ├── types.rs                ✅ STAYS
│   ├── tests.rs                ✅ STAYS
│   └── mod.rs                  ✅ STAYS
│
├── execution/
│   ├── swap_orchestrator.rs    ❌ DELETE (on-chain DEX execution via BLSCustody — replaced by AP)
│   ├── order_router.rs         ❌ DELETE (CEX/DEX/CrossChain routing — AP handles all execution)
│   ├── crosschain_orchestrator.rs ❌ DELETE
│   └── mod.rs                  ✅ STAYS  (re-exports ap_client only)
│
├── ap/                         🆕 NEW MODULE (TCP client to AP service)
│   ├── client.rs               🆕 NEW   (persistent TCP connection, send TradeRequest, receive TradeResult)
│   ├── types.rs                🆕 NEW   (TradeRequest, TradeResult, AssetTrade, ExecutedTrade)
│   └── mod.rs                  🆕 NEW
│
├── price/
│   ├── fetcher.rs              ✅ STAYS  (unchanged)
│   ├── bitget.rs               ✅ STAYS  (unchanged)
│   ├── backend.rs              ✅ STAYS
│   ├── symbol_map.rs           ✅ STAYS
│   ├── dex_price_source.rs     ✅ STAYS
│   ├── validator.rs            ✅ STAYS
│   └── mod.rs                  ✅ STAYS
│
├── slippage/
│   ├── fill_allocator.rs       ✅ STAYS  (moved into compute_settlement, but logic stays)
│   └── mod.rs                  ✅ STAYS
│
├── p2p/                        ✅ STAYS  (all files unchanged)
├── bootstrap/                  ✅ STAYS  (all files, rewire init)
├── leader/                     ✅ STAYS  (proposer election, update to use lastBatchHash)
├── heartbeat/                  ✅ STAYS
├── api/                        ✅ STAYS
├── state/                      ✅ STAYS
├── registry_sync/              ✅ STAYS
├── vision/                     ✅ STAYS  (unrelated)
├── arbitration/                ✅ STAYS
├── batcher/                    ✅ STAYS
├── delisting_watchdog.rs       ✅ STAYS
└── bin/bls_tool.rs             ✅ STAYS
```

**Score**: 17 files deleted, ~48 files stay, 6 new files, 3 major rewrites.

### Buy Flow: Before → After

```
BEFORE (8 steps, ~45s, 2 chains):
═══════════════════════════════════════════════════════════════════════

  User                    Arbitrum                      L3 Orbit
  ────                    ────────                      ────────
  1. approve USDC ──────► ArbBridgeCustody
  2. deposit USDC ──────► ArbBridgeCustody
                          3. bridge USDC ─────────────► L3BridgeCustody
                          ···· wait for bridge ····
                                                        4. wrap to 18-dec USDC
                                                        5. submitOrder on L3 Investment
                          ···· issuers run 5-phase cycle on L3 ····
                                                        6. confirmBatch + confirmFills
                                                        7. mint ITP on L3
                          8. bridge ITP back ◄─────────
                          ···· wait for bridge ····
  User gets BridgedITP on Arbitrum (can't sell directly — need to bridge back)


AFTER (3 steps, ~5-10s, 1 chain):
═══════════════════════════════════════════════════════════════════════

  User                    Arbitrum              Issuer (proposer)        AP → Bitget
  ────                    ────────              ─────────────────        ───────────
  1. approve USDC ──────► Investment.sol
  2. submitOrder ───────► Investment.sol
                          │ 6→18 dec, escrow
                          │ emit OrderSubmitted
                          │                     sees event
                          │                     compute fills + net
                          │                           │
                          │                           ├──TCP──► TradeRequest
                          │                           │         buy underlying
                          │                           │         ···· 3-8s ····
                          │                           │◄──TCP── TradeResult
                          │                           │
                          │  BLSCustody ──USDC──►     │         AP deposit (if net BUY)
                          │                           │
                          │                     BLS sign + P2P
                          │                     collect sigs
                          │                           │
                          │◄── settleBatch() ─────────┘
                          │ mint ITP, USDC → ItpCustody
  3. FILLED ◄─────────────┘

  Latency: ~5-10s (dominated by AP/Bitget execution)
```

### Sell Flow: Before → After

```
BEFORE (6+ steps, ~45s, 2 chains):
═══════════════════════════════════════════════════════════════════════

  User                    Arbitrum                      L3 Orbit
  ────                    ────────                      ────────
  1. initiate sell ─────► ArbBridgeCustody
                          2. bridge ITP ──────────────► L3BridgeCustody
                          ···· wait for bridge ····
                                                        3. submitOrder(SELL) on L3
                          ···· issuers run 5-phase cycle ····
                                                        4. confirmFills, burn ITP
                                                        5. bridge USDC back
                          ···· wait for bridge ····
  6. receive USDC ◄─────  ArbBridgeCustody


AFTER (3 steps, ~5-10s, 1 chain):
═══════════════════════════════════════════════════════════════════════

  User                    Arbitrum              Issuer (proposer)        AP → Bitget
  ────                    ────────              ─────────────────        ───────────
  1. approve ITP ───────► Investment.sol  (one-time per ITP)
  2. submitOrder(SELL) ─► Investment.sol
                          │ transferFrom ITP
                          │ to escrow
                          │ emit OrderSubmitted
                          │                     sees event
                          │                     compute fills + net
                          │                           │
                          │                           ├──TCP──► TradeRequest
                          │                           │         sell underlying
                          │                           │         ···· 3-8s ····
                          │                           │◄──TCP── TradeResult
                          │                           │
                          │  AP ──USDC──►  BLSCustody │         (if net SELL)
                          │                           │
                          │                     BLS sign + P2P
                          │                     collect sigs
                          │                           │
                          │◄── settleBatch() ─────────┘
                          │ burn ITP, USDC → user from ItpCustody
  3. FILLED ◄─────────────┘
```

### Issuer Settlement: Before → After

```
BEFORE (5-phase cycle, wall-clock aligned):
═══════════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────────┐
  │  cycle/manager.rs — CycleManager                                │
  │                                                                 │
  │  Phase 1: ProcessFills                                          │
  │    └─ Read L3 pending orders                                    │
  │    └─ Match fills against _userShares                           │
  │    └─ Compute shares = amount * 1e18 / NAV                     │
  │                                                                 │
  │  Phase 2: Netting                                               │
  │    └─ netting/bridge.rs — cross-chain netting                   │
  │    └─ netting/pair.rs — asset pair decomposition                │
  │    └─ Aggregate buy/sell across all orders                      │
  │                                                                 │
  │  Phase 3: InventoryCheck                                        │
  │    └─ Verify ITP inventory covers fills                         │
  │    └─ Check ArbBridgeCustody + L3BridgeCustody balances         │
  │                                                                 │
  │  Phase 4: GenerateBatch                                         │
  │    └─ Build confirmBatch + confirmFills calldata for L3         │
  │    └─ Build bridge proposals (Arb→L3 or L3→Arb)                │
  │    └─ Build setItpNav calldata (separate on-chain call)         │
  │                                                                 │
  │  Phase 5: SignSubmit                                            │
  │    └─ BLS sign all messages                                     │
  │    └─ Broadcast via P2P                                         │
  │    └─ Collect sigs, submit to L3 chain                          │
  │    └─ Submit bridge txs to Arbitrum                             │
  │                                                                 │
  │  Wall-clock: aligned to 1s ticks via NTP                        │
  │  Demand-driven: fast-cycle if pending orders detected           │
  │  State: CycleState tracks phase transitions                     │
  └─────────────────────────────────────────────────────────────────┘

  Files involved: cycle/manager.rs, cycle/phase.rs, cycle/state.rs,
                  cycle/ntp.rs, bridge/orchestrator.rs, bridge/types.rs,
                  netting/bridge.rs, chain/reader.rs (L3),
                  chain/custody_writer.rs, consensus/protocol.rs (15+ bridge msgs)


AFTER (single loop, event-driven, ~5-10s per batch):
═══════════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────────┐
  │  settlement/loop.rs                                             │
  │                                                                 │
  │  loop {                                                         │
  │      sleep(1s);                                                 │
  │      orders = chain.get_pending_orders();   // Arbitrum         │
  │      if orders.empty() { continue; }                            │
  │                                                                 │
  │  ┌─ COMPUTE ──────────────────────────────────────────────────┐ │
  │  │  prices = data_node.get_prices();                          │ │
  │  │  (nav_updates, fills) = compute_settlement(orders, prices);│ │
  │  │  if fills.empty() { continue; }                            │ │
  │  │  net_positions = pair_netting(fills);  // reduce volume    │ │
  │  └────────────────────────────────────────────────────────────┘ │
  │                                                                 │
  │  ┌─ EXECUTE via AP (TCP) ────────────────── ~3-8s ───────────┐ │
  │  │  trade_result = ap_client.execute(TradeRequest {           │ │
  │  │      batch_nonce, trades: net_positions                    │ │
  │  │  });  // AP trades on Bitget, returns execution results    │ │
  │  │                                                            │ │
  │  │  if trade_result.net_usdc_needed > 0:                      │ │
  │  │      bls_custody_transfer(amount, ap_deposit_addr);        │ │
  │  └────────────────────────────────────────────────────────────┘ │
  │                                                                 │
  │  ┌─ SIGN + SUBMIT ───────────────────────── ~1-2s ───────────┐ │
  │  │  sig = bls.sign(encode_batch(nav_updates, fills, nonce));  │ │
  │  │  p2p.broadcast(batch + sig);                               │ │
  │  │                                                            │ │
  │  │  if sig_collector.threshold_reached() {                    │ │
  │  │      chain.submit_settle_batch(aggregated_sig);  // Arb    │ │
  │  │  }                                                         │ │
  │  └────────────────────────────────────────────────────────────┘ │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘

  Total per batch: ~5-10s (Bitget dominates, BLS + on-chain is fast)

  Files involved: settlement/loop.rs, settlement/compute.rs,
                  netting/pair.rs, ap/client.rs, ap/types.rs,
                  consensus/protocol.rs (2 msg types: settle_batch, cancel)
```

### USDC Flow: Before → After

```
BEFORE (USDC scattered across 3 contracts, 2 chains):
═══════════════════════════════════════════════════════════════════════

  User USDC (6-dec)
       │
       ▼
  ArbBridgeCustody (Arbitrum) ──bridge──► L3BridgeCustody (L3)
       │                                        │
       │  holds ITP backing USDC                 │  wraps to 18-dec
       │  (6-dec Arbitrum native)                │  holds escrowed order USDC
       │                                        │
       ▼                                        ▼
  DecimalLib conversion                    Investment.sol (L3)
  at bridge boundary                       all math in 18-dec


AFTER (single chain, single custody + Bitget hedge):
═══════════════════════════════════════════════════════════════════════

  User USDC (6-dec)
       │
       ▼
  Investment.sol (Arbitrum)
       │  DecimalLib.toInternal(6→18)
       │  all internal math in 18-dec
       │                                              Off-chain
       │                                         ┌──────────────────┐
       ├── BUY fill:                             │  Bitget (CEX)    │
       │   │                                     │                  │
       │   │  on-chain:                          │  Issuer buys     │
       │   │  ├─ mint ITP shares to user         │  underlying      │
       │   │  └─ ItpCustody.deposit(itpId, amt)  │  assets to hedge │
       │   │     └─ balances[itpId] += amount    │  ITP exposure    │
       │   │     └─ USDC → Custody               │                  │
       │   │                                     │  (net position   │
       │   │                                     │   after netting) │
       │                                         │                  │
       └── SELL fill:                            │  Issuer sells    │
           │                                     │  underlying      │
           │  on-chain:                          │  to unwind hedge │
           │  ├─ burn escrowed ITP shares        │                  │
           │  └─ ItpCustody.withdraw → user      └──────────────────┘
           │     └─ balances[itpId] -= amount
           │     └─ USDC → user
```

### Full Settlement Flow (BUY example)

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │  ON-CHAIN (Arbitrum)                                                 │
  │                                                                      │
  │  User                                                                │
  │   │ approve USDC (one-time)                                          │
  │   │ submitOrder(itpId, amount, BUY, limitPrice, slippageTier, deadline)
  │   ▼                                                                  │
  │  Investment.sol                                                      │
  │   │  USDC.transferFrom(user, this, amount)  // 6-dec                 │
  │   │  order.amount = toInternal(amount)      // → 18-dec              │
  │   │  order.status = PENDING                                          │
  │   │  pendingOrderCount++                                             │
  │   │  emit OrderSubmitted(orderId, itpId, user, amount, ...)          │
  │   │                                                                  │
  └───┼──────────────────────────────────────────────────────────────────┘
      │
      │  ┌──────────────────────────────────────────────────────────────┐
      │  │  OFF-CHAIN (Issuer Nodes)                          ~5-10s   │
      │  │                                                             │
      ├──┤  1. EVENT WATCHER sees OrderSubmitted on Arbitrum           │
      │  │       │                                                     │
      │  │       ▼                                                     │
      │  │  2. COMPUTE (proposer)                                      │
      │  │       │  prices = data_node.get_prices()                    │
      │  │       │  nav = compute_nav(prices, _itpInventory)           │
      │  │       │  fills = filter_eligible(orders, nav, slippage)     │
      │  │       │  shares[i] = amount[i] * 1e18 / nav                │
      │  │       │                                                     │
      │  │       ▼                                                     │
      │  │  3. NET across ITPs                               ~instant  │
      │  │       │  pair_netting(fills) → net positions per asset      │
      │  │       │  e.g. ITP-A buys $10k BTC, ITP-B sells $3k BTC    │
      │  │       │       → net BUY $7k BTC (30% volume reduction)     │
      │  │       │                                                     │
      │  │       ▼                                                     │
      │  │  4. SEND TO AP via TCP                            ~3-8s     │
      │  │       │  ap_client.execute(TradeRequest { trades, nonce })  │
      │  │       │  AP executes on Bitget (market orders)              │
      │  │       │  AP returns TradeResult (fill prices, fees)         │
      │  │       │                                                     │
      │  │       │  if net BUY: BLS-signed USDC transfer               │
      │  │       │    BLSCustody → AP deposit address                  │
      │  │       │  if net SELL: AP sends USDC back                    │
      │  │       │    AP → BLSCustody (Arbitrum)                       │
      │  │       │                                                     │
      │  │       ▼                                                     │
      │  │  5. BLS SIGN + P2P                                ~1-2s    │
      │  │       │  msg = encode_batch(nav_updates, fills, nonce)      │
      │  │       │  sig = bls.sign(msg)                                │
      │  │       │  p2p.broadcast(BatchProposal { payload, sig })      │
      │  │       │                                                     │
      │  │       ▼                                                     │
      │  │  6. Other issuers VALIDATE:                                 │
      │  │       │  - NAV within tolerance of own data-node?           │
      │  │       │  - fills correct (shares = amount * 1e18 / nav)?    │
      │  │       │  - orders PENDING, deadline ok, limit price ok?     │
      │  │       │  If valid → return PartialSignature via P2P         │
      │  │       │                                                     │
      │  │       ▼                                                     │
      │  │  7. Proposer collects floor(2N/3)+1 → AGGREGATE            │
      │  │       │                                                     │
      │  └───────┼─────────────────────────────────────────────────────┘
      │          │
      │          │  settleBatch(navUpdates, fills, blsSig, nonce, bitmask)
      │          ▼
  ┌───┼──────────────────────────────────────────────────────────────────┐
  │   │  ON-CHAIN: Investment.sol                                        │
  │   │   │                                                              │
  │   │   │  verify BLS signature (IssuerRegistry)                       │
  │   │   │  require(nonce > lastBatchNonce && <= lastBatchNonce + 5)     │
  │   │   │  require(block.timestamp >= lastBatchTimestamp + 3)           │
  │   │   │  update _itpNavs[itpId] (informational, for cancelOutOfRange)│
  │   │   │                                                              │
  │   │   │  for each fill:                                              │
  │   │   │    try this._executeFill{gas: 500k}(fill):                   │
  │   │   │      │                                                       │
  │   │   │      │  if order.status != PENDING → return (skip)           │
  │   │   │      │  order.status = FILLED  // atomic claim               │
  │   │   │      │                                                       │
  │   │   │      ├─ BUY:                                                 │
  │   │   │      │   require(fillPrice <= limitPrice)                    │
  │   │   │      │   ITP.mint(user, shares)                              │
  │   │   │      │   ItpCustody.deposit(itpId, fillAmount)               │
  │   │   │      │                                                       │
  │   │   │      └─ SELL:                                                │
  │   │   │          require(fillPrice >= limitPrice)                    │
  │   │   │          ITP.burn(address(this), shares)  // escrowed        │
  │   │   │          ItpCustody.withdraw(itpId, user, payout)            │
  │   │   │                                                              │
  │   │   │    catch:                                                    │
  │   │   │      order.status = FAILED                                   │
  │   │   │      BUY  → failedFillEscrow[orderId] = order.amount         │
  │   │   │      SELL → ITP.transfer(user, order.amount)  // return      │
  │   │   │      emit FillFailed(orderId)                                │
  │   │   │                                                              │
  │   │   ▼                                                              │
  │   │  lastBatchNonce = nonce                                          │
  │   │  lastBatchTimestamp = block.timestamp                             │
  │   │  Done. User has ITP tokens (BUY) or USDC (SELL).                │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘
```

## Motivation

Single chain (Arbitrum only), no bridge, no L3. Settlement in ~5-10s (dominated by Bitget execution).

## USDC Decimal Strategy

Arbitrum USDC is 6 decimals. Investment.sol uses 18-decimal internal representation. Convert at the contract boundary.

- `submitOrder` (BUY): user sends 6-decimal USDC → contract scales to 18-decimal via `DecimalLib.toInternal(amount)` before storing
- `submitOrder` (SELL): `amount` is a share count (already 18-decimal), passed as-is — NO `toInternal` conversion. The frontend sends the raw 18-decimal share amount.
- `settleBatch` fills: USDC transfers out scale back via `DecimalLib.toExternal(amount)` at transfer time
- `claimExpired`: refund scales back to 6-decimal for USDC transfer
- `MIN_ORDER_AMOUNT` stays `1e15` (= $0.001 in 18-decimal = 1000 in 6-decimal = $0.001 ✓)
- All internal math (`shares = amount * 1e18 / fillPrice`) unchanged — operates on 18-decimal amounts

**Implementation**: `DecimalLib.toInternal()` / `toExternal()` calls in `Investment.sol` at the USDC transfer boundaries. Single internal helper `_transferUsdcOut(address to, uint256 internal18)` wraps the conversion so no callsite can forget.

**All USDC boundary conversion sites** (exhaustive — every site must use `DecimalLib`):

| Direction | Function | Conversion |
|-----------|----------|------------|
| IN (6→18) | `submitOrder` — user deposits | `DecimalLib.toInternal(externalAmount)` |
| OUT (18→6) | `_executeFill` — BUY fill, USDC from Investment to ItpCustody | `custody.deposit(itpId, amount)` — custody does `transferFrom` + balance increment atomically |
| OUT (18→6) | `_executeFill` — SELL fill, USDC from ItpCustody to user | `custody.withdraw(itpId, user, amount)` — custody does balance decrement + transfer atomically |
| OUT (18→6) | `claimExpired` — refund expired order | `_transferUsdcOut(order.user, order.amount)` |
| OUT (18→6) | `claimFailed` — refund failed fill | `_transferUsdcOut(order.user, failedFillEscrow[orderId])` |
| OUT (18→6) | `cancelOrder` — refund cancelled BUY order | `_transferUsdcOut(order.user, order.amount)` (SELL cancel restores shares, no USDC transfer) |

`failedFillEscrow[orderId]` stores 18-decimal internal amounts. `claimFailed` converts to 6-dec at transfer time.

```solidity
// Single internal helper — all USDC outflows go through this
function _transferUsdcOut(address to, uint256 internalAmount) internal {
    uint256 externalAmount = DecimalLib.toExternal(internalAmount);
    IERC20(usdc).safeTransfer(to, externalAmount);
}
```

**ITP.sol — Plain ERC20 (18 decimals)**. Not ERC4626 vaults. Rationale: ERC4626 vault functions (`deposit`, `withdraw`, `convertToShares`, etc.) would all be blocked anyway — Investment.sol manages all custody. The vault abstraction adds nothing and creates a dangerous `decimals()` coupling to the underlying asset (would return 6 with Arbitrum USDC instead of 18). ITP tokens are plain ERC20 with hardcoded `decimals() == 18`.

**USDC initializer check**: `if (usdcDecimals != 6) revert` — validate we're pointed at real Arbitrum USDC (6 decimals).

## Architecture

### Arbitrum Contracts

**Investment.sol** (UUPS upgradeable proxy) — Order submission + batch settlement

- `submitOrder(bytes32 itpId, uint256 amount, TypesLib.Side side, uint256 limitPrice, uint8 slippageTier, uint256 deadline)` — converts 6-dec USDC to 18-dec internal, escrows, emits `OrderSubmitted`
- `settleBatch(NavUpdate[] navUpdates, Fill[] fills, bytes blsSignature, uint256 batchNonce, uint256 signersBitmask)` — BLS-verified, settles fills with per-fill fault isolation
- `cancelOrder(uint256 orderId, bytes blsSignature, uint256 referenceNonce, uint256 signersBitmask)` — BLS-gated cancel, returns escrowed USDC (BUY) or restores escrowed shares (SELL)
- `cancelOutOfRange(uint256 orderId)` — permissionless, user cancels own order when on-chain NAV proves it's unfillable within limit price
- `claimExpired(uint256 orderId)` — permissionless, user reclaims USDC after deadline, only if order status == PENDING
- `claimFailed(uint256 orderId)` — permissionless, user reclaims escrowed USDC from failed fill, only if order status == FAILED
- Stores: `orders[]`, NAV per ITP, `_itpInventory[]`, `_itpWeights[]`

**ItpCustody.sol** — ITP collateral vault

Single contract holding all ITP USDC backing with internal per-ITP accounting. Not one-proxy-per-ITP — same bytecode across N proxies provides no real isolation (same bug = same exploit on all instances, attacker drains sequentially). A single contract with a mapping is simpler, cheaper, and equally secure.

- `mapping(bytes32 itpId => uint256) public balances` — 18-decimal internal USDC backing per ITP
- `onlyInvestment` modifier — only callable by Investment contract
- `deposit(bytes32 itpId, uint256 amount)` — `balances[itpId] += amount`, USDC `transferFrom(investment, this, toExternal(amount))` atomically. Called during BUY fill.
- `withdraw(bytes32 itpId, address to, uint256 amount)` — `require(balances[itpId] >= amount)`, `balances[itpId] -= amount`, `usdc.safeTransfer(to, toExternal(amount))` atomically. Debits before transfer. Called during SELL fill.
- Holds all USDC (6-dec on-chain, 18-dec in accounting)
- Per-ITP invariant: `balances[itpId]` only decremented by fills for that ITP's orders — logical isolation via accounting
- Global invariant: `sum(all balances) <= usdc.balanceOf(address(this)) * 1e12` — can be checked off-chain, not enforced per-call (gas)

**BLSCustody.sol** — Unchanged. Remains a generic BLS-gated multisig for governance operations.

**ITP.sol** — ERC20 per ITP (18 decimals). Minted/burned by Investment during settlement. ERC20 balance IS the source of truth for sell eligibility (no more `_userShares` dual accounting). Tokens acquired via DEX transfer are fully sellable through Investment.

**IssuerRegistry** — Fresh deploy on Arbitrum. `BLSVerifier._verifyBLS()` calls `_blsIssuerRegistry.getSnapshotAtNonce()`, `incrementMissedCounts()`, `getActiveBitmask()`, etc. — the full `IIssuerRegistry` interface. Initialized with:
- All active issuers registered with their BLS pubkeys
- `aggregatedPubkey` set
- Initial snapshot (nonce 1) with correct `activeBitmask`, `activeCount`, `stateHash`
- `blockNumber` set to deployment block

Issuers manage the registry directly via BLS-gated calls.

**BLSVerifier staleness check**: Use `block.timestamp` not `block.number` — Arbitrum block times are elastic (~0.25s under load, >1s during low activity), making block-number-based staleness unreliable. `if (block.timestamp - snap.timestamp > 86400) revert`. Add a `timestamp` field to `RegistrySnapshot` alongside `blockNumber`.

### ITP ID Type

All ITP IDs are `bytes32` across the entire stack:

- Solidity: `bytes32 itpId`
- Rust: `H256` / `FixedBytes<32>`
- Frontend: hex string

ITP IDs are generated as `bytes32(_itpCount)`.

### Settlement Batch Structure

Pushed to Arbitrum after Bitget execution + BLS threshold (typically ~5-10s).

```solidity
struct NavUpdate {
    bytes32 itpId;
    uint256 nav;       // 18 decimals
}

struct Fill {
    uint256 orderId;
    uint256 fillPrice;  // BLS-signed off-chain NAV at fill time (not validated against on-chain _itpNavs)
    uint256 fillAmount; // USDC amount being filled (18-dec). For partial fills: fillAmount <= order.amount
    uint256 shares;     // For BUY: shares minted = fillAmount * 1e18 / fillPrice
                        // For SELL: shares consumed = fillAmount (fillAmount IS the share count for sells)
}
// fillAmount retained (not just shares) because:
// - SELL payout = fillAmount * fillPrice / 1e18 (needs fillAmount explicitly)
// - Partial fill tracking: unfilled = order.amount - fillAmount
// - On-chain sanity check: require(fill.shares == fillAmount * 1e18 / fillPrice) for BUY fills (catches Rust rounding bugs)

function settleBatch(
    NavUpdate[] calldata navUpdates,
    Fill[] calldata fills,
    bytes calldata blsSignature,
    uint256 batchNonce,
    uint256 signersBitmask
) external;
```

**BLS message hash** (exact format):

```solidity
bytes32 message = keccak256(abi.encode(
    block.chainid,        // 42161 (Arbitrum One)
    address(this),        // Investment proxy address
    batchNonce,
    keccak256(abi.encode(navUpdates)),
    keccak256(abi.encode(fills))
));
```

Rust equivalent must produce identical hash using `alloy::sol_types::SolValue::abi_encode`.

**Replay protection**: monotonic nonce with gap tolerance + minimum time interval.

```solidity
uint256 public lastBatchNonce;      // storage slot in InvestmentStorage gap
uint256 public lastBatchTimestamp;   // storage slot in InvestmentStorage gap
uint256 public constant MIN_BATCH_INTERVAL = 3; // seconds — prevents rapid-fire batches
uint256 public constant MAX_NONCE_GAP = 5;      // tolerate small gaps, block unbounded jumps

// In settleBatch:
require(batchNonce > lastBatchNonce, "stale nonce");
require(batchNonce <= lastBatchNonce + MAX_NONCE_GAP, "nonce too far ahead");
require(block.timestamp >= lastBatchTimestamp + MIN_BATCH_INTERVAL, "too fast");
lastBatchNonce = batchNonce;
lastBatchTimestamp = block.timestamp;
```

Gap tolerance instead of strict `== +1`: if a nonce is permanently lost (sequencer hiccup, monitoring desync, gas estimation bug causing permanent revert before state update), the next proposer can skip it. Small gaps are tolerable. Unbounded jumps are still blocked. No bricking from a single lost nonce. Off-chain, proposers always try `lastBatchNonce + 1` first — gaps are the exception, not the norm.

The contract has no concept of "cycles" or "rounds" — it only sees monotonic batch nonces. Off-chain, issuers propose and sign batches reactively (see Reactive Settlement section). If no orders are pending, no batches are produced. No on-chain bricking possible from off-chain inactivity.

**Per-fill fault isolation** (carry forward `_safeTransferOrEscrow` pattern):

```solidity
for (uint i = 0; i < fills.length; i++) {
    try this._executeFill{gas: MAX_FILL_GAS}(fills[i]) {
        // fill succeeded
    } catch {
        // fill failed (USDC blacklist, mint failure, etc.)
        Order storage order = orders[fills[i].orderId];
        order.status = Status.FAILED;
        if (order.side == Side.BUY) {
            // BUY: USDC was escrowed in Investment at submitOrder time — record for claim
            failedFillEscrow[fills[i].orderId] = order.amount;
        } else {
            // SELL: ITP shares were transferFrom'd to Investment at submitOrder time — transfer back
            ITP(itpAddress[order.itpId]).transfer(order.user, order.amount);
        }
        emit FillFailed(fills[i].orderId);
    }
}

uint256 constant MAX_FILL_GAS = 500_000; // explicit gas cap per fill — reserves gas for catch block

// _executeFill must be `external` for try/catch but guarded against direct calls:
modifier onlySelf() { require(msg.sender == address(this)); _; }
function _executeFill(Fill calldata fill) external onlySelf { ... }
```

Individual fill failures do NOT revert the batch. Failed orders get `FAILED` status — user calls `claimFailed(orderId)` (separate from `claimExpired`) to reclaim escrowed USDC (BUY) or restored shares (SELL).

**Order status enum**: `PENDING(0), FILLED(1), CANCELLED(2), EXPIRED(3), FAILED(4)`. No `BATCHED` status — orders go directly from PENDING to FILLED/CANCELLED/EXPIRED/FAILED.

**`claimFailed(uint256 orderId)`**: permissionless, requires `failedFillEscrow[orderId] > 0` AND `order.status ∈ {FAILED, FILLED}` (FILLED covers partial-fill remainder failures). Returns escrowed USDC from `failedFillEscrow[orderId]` via `_transferUsdcOut`. Sets `failedFillEscrow[orderId] = 0`. If `order.status == FAILED`, transitions to `EXPIRED` (terminal). If `order.status == FILLED`, status unchanged (partial fill already succeeded).

**Fill price validation** (off-chain NAV, on-chain limit check):

Fill prices are the NAV agreed upon by BLS consensus at the time each fill was matched. The BLS signature over the entire batch — including all fills with their fillPrices — is the validation that prices are correct. The contract does NOT validate fillPrice against `_itpNavs` — BLS committee trust is the defense, not on-chain price bounds. The `navUpdates` in the batch update `_itpNavs` to the latest value (informational — used by `cancelOutOfRange` and frontend display, not for fill validation).

```solidity
// Inside _executeFill:
Order storage order = orders[fill.orderId];

// Status check MUST be first — atomic claim prevents race with claimExpired
if (order.status != Status.PENDING) return; // skip, no revert
order.status = Status.FILLED; // atomically claim before any state changes

// No on-chain NAV circuit breaker or fill price banding — BLS committee trust is the defense.
// If the committee goes rogue, governance can withdraw all funds in a single tx.
// The user's limitPrice is the only on-chain price bound.

// Limit price enforcement (on-chain — user's hard price bound)
if (order.side == Side.BUY) {
    require(fill.fillPrice <= order.limitPrice, "above limit");
} else {
    require(fill.fillPrice >= order.limitPrice, "below limit");
}
```

**NAV update** (informational, no circuit breaker):

```solidity
// Inside settleBatch, when processing navUpdates:
// No circuit breaker — BLS committee trust is the defense. If compromised,
// governance can withdraw all funds in a single emergency tx.
// NAV is stored for: cancelOutOfRange checks, frontend display, custody invariant checks.
_itpNavs[navUpdate.itpId] = navUpdate.nav;
```

### Order Lifecycle

```
User → submitOrder() on Arbitrum
       6-dec USDC transferred, scaled to 18-dec internal, escrowed
       Event: OrderSubmitted(orderId, itpId, user, amount, side, limitPrice, slippageTier, deadline)
            ↓
All issuers see OrderSubmitted event
            ↓
Designated proposer (deterministic, see Reactive Settlement):
  - Fetches current NAV per ITP from data-node
  - Selects eligible PENDING orders, computes fills (shares = amount * 1e18 / NAV)
  - Nets across ITPs (pair_netting), routes to execution venues
  - Executes net positions on Bitget (CEX) or 1inch (DEX) — ~3-8s
  - Builds settleBatch payload, signs, broadcasts via P2P
            ↓
Other issuers validate proposal, return BLS partial signatures
            ↓
Proposer collects floor(2N/3)+1 signatures → submits settleBatch() to Arbitrum
  - BLS signature verified on-chain
  - NAV updated per ITP (informational)
  - Fills executed per-fill with try/catch isolation
  - fillPrice validated against user's limitPrice (BLS guarantees price integrity)
  - Orders marked FILLED (or FAILED on error)
            ↓
User has ITP tokens on Arbitrum. Done. (Typical: ~5-10s from order to fill)
```

### Order Expiry and Cancellation

**Expiry** — permissionless, safe because of status check:

- Orders have a `deadline` timestamp set at submission
- `claimExpired(orderId)` requires:
  ```solidity
  require(order.status == Status.PENDING, "not pending");
  require(block.timestamp > order.deadline, "not expired");
  require(lastBatchTimestamp > order.deadline, "wait for settlement after expiry");
  ```
- The third check is the **settlement-based grace period**: the user can only claim after at least one `settleBatch` has landed on-chain since the order's deadline passed. This proves issuers have had the opportunity to fill the order and chose not to (because it expired). Not time-based — triggers when the system has actually moved past the order.
  - If the system is settling reactively (~5-10s), the grace is near-instant
  - If the system is down/paused, you can't claim until it's back — correct, because a fill may be in the sequencer queue
  - If no orders exist (system quiescent, no batches), `lastBatchTimestamp` won't advance — edge case handled by fallback: `|| block.timestamp > order.deadline + 120` (2-minute hard cap for when the system is completely idle)
- BUY expiry: refunds escrowed USDC via `_transferUsdcOut`
- SELL expiry: transfers escrowed ITP shares back to user via `ITP.transfer(order.user, order.amount)`
- Status transitions to EXPIRED atomically — if `settleBatch` tries to fill an EXPIRED order, `_executeFill` sees non-PENDING status and returns early (no revert, no state change)
- Issuers skip expired orders when building proposals off-chain

**Cancellation — permissionless out-of-range**:

Users can cancel their own orders without BLS consensus when the on-chain NAV proves the order is unfillable within their limit price.

```solidity
function cancelOutOfRange(uint256 orderId) external {
    Order storage order = orders[orderId];
    require(order.user == msg.sender, "not your order");
    require(order.status == Status.PENDING, "not pending");

    uint256 currentNav = _itpNavs[order.itpId];
    require(currentNav > 0, "no NAV");

    // BUY: unfillable when NAV is ABOVE limit price (user won't pay more)
    // SELL: unfillable when NAV is BELOW limit price (user won't sell for less)
    if (order.side == Side.BUY) {
        require(currentNav > order.limitPrice, "still in range");
    } else {
        require(currentNav < order.limitPrice, "still in range");
    }

    order.status = Status.CANCELLED;
    pendingOrderCount--;

    if (order.side == Side.BUY) {
        _transferUsdcOut(order.user, order.amount);
    } else {
        ITP(itpAddress[order.itpId]).transfer(order.user, order.amount);
    }

    emit OrderCancelled(orderId, order.user, "out_of_range");
}
```

- **No BLS required** — the on-chain `_itpNavs` (pushed by issuers in every `settleBatch`) is the proof that the order is out of range
- **Only the order owner** can call — prevents griefing where someone else cancels in-range orders right before a fill
- **Safe against stale NAV**: if `_itpNavs` is stale (issuers haven't settled recently), the NAV might not reflect current reality. This is fine — a stale NAV that shows out-of-range is still a valid signal (the user knows their order is stuck). If NAV later moves back in range, the order is already cancelled and the user can resubmit.
- **Race with `settleBatch`**: same pattern as `claimExpired` — `_executeFill` checks `status == PENDING` first and returns early if cancelled. Try/catch isolates.

**Cancellation — BLS-gated** (for any reason):

- `cancelOrder(orderId, blsSignature, referenceNonce, signersBitmask)` — issuer consensus required
- Transitions PENDING → CANCELLED
- **BUY cancel**: refunds escrowed USDC via `_transferUsdcOut(order.user, order.amount)`
- **SELL cancel**: transfers escrowed ITP shares back to user via `ITP.transfer(order.user, order.amount)`
- Needed for cases where `cancelOutOfRange` doesn't apply (e.g., user wants to cancel an in-range order, or NAV hasn't been updated yet)
- `MAX_DEADLINE_DURATION` reduced from 24h → 1h to limit capital lockup

**Race condition prevention** (`claimExpired` / `cancelOutOfRange` vs in-flight `settleBatch`):

The `_executeFill` function checks `order.status == PENDING` as its first operation inside the try/catch. If a user calls `claimExpired` or `cancelOutOfRange` in the same block as `settleBatch`, one of two things happens:
1. User tx executes first → order becomes EXPIRED/CANCELLED → `_executeFill` sees non-PENDING status, returns early (no revert)
2. `settleBatch` executes first → order becomes FILLED → user tx sees non-PENDING status, reverts

No double-spend possible. No batch poisoning possible (try/catch isolates).

**`cancelOutOfRange` specific race**: a `settleBatch` in the same block may update `_itpNavs` to bring the order back in range. If `cancelOutOfRange` executes before `settleBatch`, it reads the pre-update NAV (out of range) and cancels. The subsequent `_executeFill` skips the now-cancelled order. If `settleBatch` executes first, `_itpNavs` updates to the new (in-range) value, the order gets filled, and `cancelOutOfRange` reverts on the status check. Both orderings are safe.

### Rebalance

Same formula, directly on Arbitrum:

```solidity
function rebalance(
    bytes32 itpId,
    uint256[] calldata removeIndices,
    address[] calldata addAssets,
    uint256[] calldata newWeights,
    uint256[] calldata prices,
    address[] calldata quoteTokens,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask
) external;
```

- Issuers reach BLS consensus on new weights
- Contract updates `_itpInventory[itpId]` and `_itpWeights[itpId]`
- NAV preserved: `qty_new[i] = (w_new[i] * currentNAV) / price[i]`
- BLS message includes chain ID 42161 (Arbitrum)

## Reactive Settlement (New Component)

### Purpose

Eliminates fixed-interval cycles entirely. Settlement is **event-driven**: when orders exist, any issuer proposes a batch, collects BLS signatures via P2P, and submits to Arbitrum as soon as the threshold is met. No waiting, no accumulator, no cycles.

### Design Principles

- **No cycles**: there is no 1-second tick, no 5-second flush. The system is fully reactive.
- **Propose-sign-submit**: any issuer can propose a batch at any time. Other issuers validate and return partial BLS signatures. The proposer aggregates and submits.
- **Sequential execution**: proposer computes fills → nets across ITPs → executes net positions on Bitget → then BLS signs and submits. Typical end-to-end: ~5-10s (dominated by Bitget execution, BLS + on-chain is ~1-2s).
- **Batching is opportunistic**: a proposal may include 1 fill or 50 fills. If multiple orders are pending simultaneously, the proposer batches them for gas efficiency. If only one order is pending, it gets its own batch.

### Flow

```
OrderSubmitted event on Arbitrum
            ↓
All issuers see the event (via Arbitrum watcher)
            ↓
Designated proposer (deterministic: see election below):
  1. Fetch current NAV per ITP from data-node
  2. Select all PENDING orders eligible for fill
  3. Compute fills (shares = amount * 1e18 / NAV)
  4. Net across ITPs — pair_netting reduces exchange volume
  5. Execute net positions on Bitget (CEX) or 1inch (DEX)       ← ~3-8s
     Wait for all executions to confirm
  6. Build settleBatch payload (navUpdates, fills, batchNonce)
  7. Compute BLS message hash
  8. Sign with own BLS key → partial signature
  9. Broadcast BatchProposal(payload, partialSig) via P2P
            ↓
Other issuers receive BatchProposal:
  1. Validate payload (NAV within tolerance of own data-node, fills are correct,
     orders are PENDING, deadline not expired, fillPrice within band)
  2. If valid: sign the same message hash → return PartialSignature via P2P
  3. If invalid: broadcast Rejection(reason) — proposer can revise or yield
            ↓
Proposer collects partial signatures:                            ← ~1-2s
  - Once floor(2N/3)+1 collected: aggregate into full BLS signature
  - Submit settleBatch() to Arbitrum immediately
  - No waiting for stragglers — threshold is sufficient
            ↓
On-chain settlement:
  - BLS signature verified
  - NAV updated per ITP (informational)
  - Fills executed per-fill with try/catch
  - Orders marked FILLED (or FAILED)
```

### Proposer Election

**Deterministic, unpredictable**: `proposer = keccak256(lastBatchHash, batchNonce) % num_active_issuers`, where `lastBatchHash` is the on-chain transaction hash of the previous `settleBatch` call. This is:

- **Deterministic**: all issuers compute the same proposer independently.
- **Unpredictable**: the proposer for batch N+1 is unknown until batch N's tx hash is finalized on-chain (depends on Arbitrum sequencer inclusion). Prevents targeted attacks where a Byzantine actor prepares manipulation for their known-future slots.
- **Verifiable**: any issuer can verify who should be proposing by reading `lastBatchHash` from on-chain.

For the very first batch (`batchNonce == 1`), the seed is `keccak256(bytes32(0), 1)` — deterministic bootstrap.

### Proposer Timeout & Rotation

If the designated proposer does not broadcast a `BatchProposal` within **3 seconds** of an eligible order becoming visible:

1. Next issuer in the rotation (`keccak256(lastBatchHash, batchNonce, rotationAttempt) % remaining_issuers`) takes over as proposer.
2. The replacement proposer builds and broadcasts its own `BatchProposal`.
3. Issuers sign whichever valid proposal they see first (duplicate signing for the same `batchNonce` is prevented by tracking `signedNonces` locally).
4. If the replacement also fails (another 3s), rotation continues.
5. After `num_issuers` rotation attempts (all issuers failed), wait 10s and restart the rotation from the beginning. This handles transient network issues.

### Key Rules

- **Proposal trigger**: an issuer proposes when (a) it is the designated proposer AND (b) there is at least one PENDING order whose `deadline > block.timestamp + 10s` (safety margin). If no eligible orders exist, no proposal is made (system is quiescent).
- **Batching window**: the proposer MAY wait up to **500ms** after seeing the first eligible order to batch additional orders that arrive in rapid succession. This is optional — the proposer can submit immediately with just one fill if latency is prioritized over gas efficiency.
- **Max fills per batch**: 50 (same gas limit). If >50 orders are pending, proposer builds multiple sequential batches.
- **Signature collection timeout**: if the proposer cannot collect `floor(2N/3)+1` signatures within **2 seconds** of broadcasting the proposal, it re-broadcasts with any corrections suggested by rejecting issuers. After 2 failed attempts, the proposer yields and the next in rotation takes over.
- **NAV freshness**: the proposer fetches NAV from the data-node at proposal time. Validators compare against their own data-node's NAV. If the delta exceeds a tolerance (e.g., 0.5%), the validator rejects. This ensures NAV agreement without a separate "price phase."
- **No buffer**: there is no accumulated state between batches. Each batch is self-contained. If a proposal fails (not enough signatures), the pending orders remain on-chain as PENDING. The next proposer (rotation or triggered by new order) will include them.
- **Confirmation tracking**: after submission, the proposer monitors the tx. If it reverts, the proposer retries with higher gas (1.5x, then 2x, max 2 retries). If still failing, yields to rotation. Other issuers watch `lastBatchNonce` on-chain — once it advances, they know the batch landed and can propose the next one.
- **Order deadline check**: before including an order, check `deadline > block.timestamp + 10s` (safety margin for tx inclusion delay on Arbitrum).

### Convergence Guarantee

Unlike the old cycle-based accumulator (which could deadlock on buffer divergence), the reactive model converges naturally:

1. **No shared buffer to diverge**: each proposer builds a fresh batch from on-chain state (PENDING orders). There is no local buffer that can get out of sync.
2. **Validators check independently**: each validator fetches its own NAV, computes its own expected fills, and validates the proposal. Disagreement means rejection, not deadlock.
3. **Proposer rotation handles disagreement**: if >1/3 of issuers reject a proposal, the proposer cannot reach threshold. After timeout, rotation hands off to a new proposer who may produce a different (consensus-compatible) batch.
4. **Worst case is delay, not deadlock**: if no proposer can get threshold (e.g., data-node NAVs diverge wildly across issuers), orders simply stay PENDING until NAVs converge. Users can `claimExpired` after deadline. No funds locked beyond the deadline.

### Arbitrum Sequencer Considerations

- Arbitrum sequencer is controlled by Offchain Labs, not us. Transactions can be delayed or reordered.
- The `batchNonce == lastBatchNonce + 1` check prevents out-of-order settlement and replay.
- Sequencer downtime halts settlement — orders stay PENDING and are filled when sequencer recovers. No unbounded accumulation (no buffer).
- No MEV protection on `settleBatch` contents in the mempool — the sequencer can see fill prices before inclusion. Mitigation: Arbitrum's FCFS sequencer ordering + the BLS signature means only the valid proposer's tx is accepted. A front-runner who copies the tx cannot produce a valid BLS signature with different contents.

### Quiescent Mode

When no PENDING orders exist, the system is fully idle:
- No proposals broadcast
- No signatures collected
- No on-chain transactions
- Zero gas cost during inactivity
- Issuers only run the event watcher (listening for `OrderSubmitted`)

## AP Communication (TCP, not on-chain)

### Before (on-chain events)

```
Issuers ──BLS sign──► Investment.emitAssetTrades() on L3
                        │  emit AssetTradeRequest(cycleNumber, asset, side, usdcAmount, price, quoteToken)
                        │
                        ▼
                      AP watches L3 events ──► executes on Bitget
                        │
                        ▼
                      MockBitgetVault.getFill() ──► issuers read fill data on-chain
```

Problems: gas cost per trade event, latency (wait for L3 block), L3 dependency, on-chain data leak.

### After (direct TCP)

```
Proposer ──TCP──► AP service (localhost or remote)
                   │
                   │  TradeRequest { trades: [AssetTrade], batch_nonce }
                   │
                   ▼
                 AP executes on Bitget
                   │  - market orders for each net position
                   │  - returns execution results (fill price, qty, fees)
                   │
                   ▼
                 AP ──TCP──► Proposer
                              TradeResult { fills: [ExecutedTrade], batch_nonce }
```

**No on-chain AP communication.** `emitAssetTrades()` deleted from Investment.sol. `MockBitgetVault` deleted. AP is a TCP service that receives trade orders and returns execution results.

### AP Protocol (TCP)

Simple request/response over persistent TCP connection. Proposer connects to AP on startup.

```rust
// Proposer → AP
struct TradeRequest {
    batch_nonce: u64,
    trades: Vec<AssetTrade>,  // netted per-asset positions
}

struct AssetTrade {
    asset_id: String,         // e.g. "BTC", "ETH" (symbol, not address)
    side: Side,               // BUY or SELL
    usdc_amount: U256,        // 18-dec internal amount
    quote_token: String,      // e.g. "USDT"
}

// AP → Proposer
struct TradeResult {
    batch_nonce: u64,
    executions: Vec<ExecutedTrade>,
    total_usdc_spent: U256,   // net USDC sent to Bitget (BUY)
    total_usdc_received: U256, // net USDC received from Bitget (SELL)
}

struct ExecutedTrade {
    asset_id: String,
    side: Side,
    filled_qty: f64,          // actual qty filled on Bitget
    avg_price: f64,           // execution price
    fees: f64,                // Bitget trading fees
}
```

### USDC Transfers (AP ↔ Custody)

The AP needs USDC to buy assets on Bitget, and returns USDC when selling. These transfers go through BLSCustody (BLS-gated multisig):

```
BUY flow (USDC → Bitget):
  1. Proposer computes net BUY amount across all fills
  2. BLS-signed transfer: BLSCustody → AP's Bitget deposit address
  3. AP receives USDC on Bitget, executes market orders
  4. AP returns TradeResult via TCP

SELL flow (USDC ← Bitget):
  1. AP sells underlying on Bitget, receives USDC
  2. AP withdraws USDC from Bitget → BLSCustody address on Arbitrum
  3. AP returns TradeResult via TCP (includes tx hash of USDC return)
  4. Proposer verifies USDC received before submitting settleBatch

NET flow (buys and sells in same batch):
  1. pair_netting may produce mixed positions (some BUY, some SELL)
  2. Net USDC delta = sum(SELL USDC received) - sum(BUY USDC spent)
  3. If net positive: AP sends surplus USDC back to BLSCustody
  4. If net negative: BLSCustody sends deficit USDC to AP
  5. Only the NET transfer happens on-chain (one tx, not per-trade)
```

**Key invariant**: USDC leaves BLSCustody only via BLS-signed tx. AP cannot pull USDC — issuers push it after consensus on the trade set.

### Settlement Loop with AP

```
loop {
    sleep(1s);
    orders = chain.get_pending_orders();
    if orders.empty() { continue; }

    // 1. COMPUTE
    (nav_updates, fills) = compute_settlement(orders, prices);
    net_positions = pair_netting(fills);

    // 2. SEND TO AP via TCP (blocking, ~3-8s)
    trade_request = TradeRequest { batch_nonce, trades: net_positions };
    trade_result = ap_client.execute(trade_request).await;  // TCP call

    // 3. TRANSFER USDC (if net BUY → send USDC to AP)
    if trade_result.net_usdc_needed > 0 {
        // BLS-sign USDC transfer from BLSCustody → AP deposit address
        bls_custody_transfer(trade_result.net_usdc_needed, ap_deposit_address);
    }

    // 4. SIGN + SUBMIT settleBatch
    sig = bls.sign(encode_batch(nav_updates, fills, nonce));
    p2p.broadcast(batch + sig);
    if sig_collector.threshold_reached() {
        chain.submit_settle_batch(aggregated_sig);
    }
}
```

## Node Layer

### Settlement Loop (replaces cycle/ module)

No phases, no cycle manager, no phase enum, no wall-clock alignment. One function on a 1-second timer:

```rust
loop {
    sleep_until_next_second();
    let orders = chain.get_pending_orders().await;
    if orders.is_empty() { continue; }

    // 1. COMPUTE
    let prices = data_node.get_prices().await;
    let itp_state = chain.get_itp_state().await;
    let (nav_updates, fills) = compute_settlement(&orders, &prices, &itp_state);
    if fills.is_empty() { continue; }

    // 2. NET — reduce exchange volume across ITPs
    let net_positions = pair_netting(&fills);

    // 3. SEND TO AP via TCP (blocking, ~3-8s)
    let trade_result = ap_client.execute(TradeRequest {
        batch_nonce: next_nonce,
        trades: net_positions,
    }).await;

    // 4. TRANSFER USDC if needed (BLS-signed, BLSCustody ↔ AP)
    if trade_result.net_usdc_needed > 0 {
        bls_custody_transfer(trade_result.net_usdc_needed, ap_deposit_addr).await;
    }

    // 5. SIGN + SUBMIT
    let nonce = chain.last_batch_nonce().await + 1;
    let msg = encode_batch(&nav_updates, &fills, nonce);
    let sig = bls.sign(&msg);
    p2p.broadcast(SignedBatch { nav_updates, fills, nonce, sig });

    if let Some(agg) = sig_collector.try_aggregate() {
        chain.submit_settle_batch(agg).await;
    }
}
```

**Eliminated**: `cycle/` module (`phase.rs`, `manager.rs`), `ProcessFills` phase, `Netting` phase, `InventoryCheck` phase, `GenerateBatch` phase, `SignSubmit` phase, wall-clock alignment, demand-driven fast cycle triggers.

**Timing breakdown** per batch:
- Compute + net: ~instant
- Bitget execution: ~3-8s (dominates)
- BLS sign + P2P + aggregate: ~1-2s
- On-chain `settleBatch`: ~0.25s (Arbitrum block)
- **Total: ~5-10s** (vs ~45s with bridges)

**`compute_settlement`** does:
1. Compute NAV per ITP from data-node prices + `_itpInventory`
2. Filter eligible orders (PENDING, deadline not expired, limit price in range)
3. Apply slippage tier filter
4. Compute fills: `shares = amount * 1e18 / nav`
5. Build `NavUpdate[]` + `Fill[]` arrays

### BLS Message Types

- `build_settle_batch_hash` — settlement (single message type for all fills + NAV updates)
- `build_cancel_order_hash` — BLS-gated cancellation
- `build_rebalance_hash` / `build_update_weights_hash` — rebalance
- All BLS message hashes use chain ID `42161` (Arbitrum)

### Netting

`netting/pair.rs` and `netting/asset_decompose.rs` for NAV computation. `netting/fees.rs` for fee calculations. No bridge netting.

### Event Watcher

Watches Arbitrum (chain 42161) for `OrderSubmitted` events emitted by Investment.sol. Wakes the settlement loop.

### Chain Writer

Encodes and submits `settleBatch()` calldata to Arbitrum. Single chain target.

### Data Node

Price collection from 50+ sources — unchanged. NAV is embedded in `settleBatch`'s `navUpdates[]` (not pushed via a separate on-chain call).

### Unchanged

- BLS signing / aggregation (key format, threshold logic, registry)
- P2P layer (gossip, peer discovery)
- Bitget integration (AP/market-maker execution venue for actual asset trades)

## `_userShares` — Unified with ERC20

No `_userShares` mapping. ERC20 balance is the sole source of truth for sell eligibility. ITP tokens acquired via DEX transfer are fully sellable through Investment.

**SELL flow**:
- `submitOrder(SELL)`: `ITP(itp).transferFrom(user, address(this), amount)` — escrow shares in Investment contract. Requires user to `approve` Investment for ITP tokens (one-time, like USDC approve for BUY).
- `_executeFill(SELL)`: burn escrowed shares from `address(this)`, pay out USDC from ItpCustody.
- `claimExpired(SELL)` / `cancelOrder(SELL)` / `cancelOutOfRange(SELL)` / catch block (SELL): transfer escrowed shares back to user via `ITP(itp).transfer(order.user, order.amount)`.

**ITP.sol**: No `_update` override needed — standard ERC20 transfers work. DEX-acquired tokens are fully sellable. SELL `submitOrder` requires user to `approve` Investment for ITP tokens (same UX pattern as BUY USDC approve).

**Frontend SELL flow**:
```
1. APPROVE  — approve ITP token spend on Investment contract (one-time per ITP)
2. SUBMIT   — submitOrder(itpId, amount, SELL, limitPrice, slippageTier, deadline)
3. FILLED   — wait for settleBatch (~5-10s typical), receive 6-decimal USDC
```

**`totalValue` field**: Not used for any calculation. The authoritative NAV is `_itpNavs[itpId]` (pushed by issuers). `totalValue` is informational/logging only — never used in share calculations.

## Frontend Changes

Buy flow — 3 steps:

```
1. APPROVE  — approve USDC spend on Investment contract (6-decimal USDC amount)
2. SUBMIT   — submitOrder(itpId, amount, BUY, limitPrice, slippageTier, deadline)
3. FILLED   — wait for settleBatch (~5-10s typical, ~15s worst case with proposer rotation)
```

Sell flow — 3 steps:

```
1. APPROVE  — approve ITP token spend on Investment contract (one-time per ITP)
2. SUBMIT   — submitOrder(itpId, amount, SELL, limitPrice, slippageTier, deadline)
3. FILLED   — wait for settleBatch (~5-10s typical), receive 6-decimal USDC
```

No bridge steps. Native ITP tokens on Arbitrum.

### Frontend Details

- ABI for `Investment.submitOrder` (direct call)
- ABI for `Investment.cancelOrder` (BLS-gated, triggered by issuer backend)
- ABI for `Investment.cancelOutOfRange` (permissionless, user-initiated when order is out of limit price range)
- `ItpCustody` contract address in deployment.json (single address)
- E2E tests (`02-buy-itp.spec.ts`, `04-sell-itp.spec.ts`)
- USDC amounts displayed in 6 decimals (user-facing), sent as 6 decimals (contract converts internally)

## Gas Considerations

- Order submission: ~120k gas (USDC transferFrom + DecimalLib conversion + storage write + event)
- Settlement batch: ~80k base + ~130k per fill (cold storage reads/writes + USDC transfers + mint/burn + DecimalLib + try/catch overhead)
- Single fill batch: ~210k gas (80k base + 130k fill). Most common case during low volume.
- Max 50 fills per batch: ~6.6M gas (within Arbitrum's 32M block gas limit)
- Arbitrum L2 execution gas is cheap (~0.1 gwei)
- **L1 data posting fee**: variable, can spike 10-50x during Ethereum congestion. A single-fill batch has ~1KB calldata. At normal L1 gas (~30 gwei): ~$0.05. A 50-fill batch has ~8KB calldata. At normal: ~$0.50. At spike (~500 gwei): ~$8. Still viable but not "negligible."
- **Gas efficiency vs latency tradeoff**: proposers MAY wait up to 500ms to batch concurrent orders. During high volume, batching amortizes the 80k base + 25k BLS overhead across many fills. During low volume, single-fill batches are acceptable.
- `incrementMissedCounts` in `_verifyBLS` adds ~25k gas per settlement (writes to BLSIssuerRegistry). Acceptable — during low volume, settlements are infrequent; during high volume, cost is amortized.

## Security Model

- **BLS threshold**: floor(2N/3)+1 signatures required for all settlements, cancellations, rebalances
- **USDC custody**: single ItpCustody contract with per-ITP accounting (`mapping(itpId => balance)`). Logical isolation via accounting — each ITP's balance is only decremented by that ITP's fills. Not per-proxy isolation (same bytecode across N proxies = same bug, no real isolation).
- **Order safety**: USDC escrowed on submission, only released by BLS-verified fill, BLS-verified cancel, permissionless out-of-range cancel (NAV-gated, owner-only), or permissionless expiry claim (deadline-gated)
- **Fill price binding**: `fillPrice` is BLS-signed by issuer consensus (off-chain NAV at fill time). On-chain, the user's `limitPrice` is the only price bound. BLS signature integrity guarantees price correctness.
- **No NAV circuit breaker**: deliberately omitted. The BLS committee trust assumption is the primary and sole defense against price manipulation. If the committee is compromised, governance can emergency-withdraw all funds in a single tx — no point rate-limiting the drain. Circuit breakers add gas cost and complexity for a threat model (colluding supermajority) that they can't actually prevent (compounding bypasses them in <60s anyway).
- **Per-fill fault isolation**: single fill failure doesn't revert the batch (try/catch)
- **No admin bypass**: no skipping BLS verification anywhere
- **Sequencer dependency**: Arbitrum sequencer is trusted for ordering/inclusion. Sequencer censorship halts settlement but not consensus. Accumulated fills land when sequencer recovers.

### Trust Assumptions (Explicit)

- **BLS committee is honest**: 2/3+1 issuers must be honest for correct NAV and fair fills. Colluding supermajority can manipulate NAV and fill prices without on-chain constraint. Defense: governance emergency withdrawal (drain all funds in 1 tx if committee is compromised).
- **No on-chain NAV verification**: NAV is an issuer-asserted value, not computed on-chain from oracle feeds. This is by design (50+ price sources can't be verified on-chain economically). No circuit breaker — the BLS committee IS the security model.
- **Arbitrum sequencer is available**: settlement liveness depends on sequencer uptime. Historical Arbitrum outages have been <1 hour.
- **Slippage tiers are enforced off-chain only**: the contract enforces `limitPrice` but not the slippage tier percentage bands. Off-chain `filter_by_slippage` in the issuer Rust code is the actual enforcement point. On-chain, only the hard limit price is checked.
- **P2P liveness for signatures**: reactive settlement requires issuers to be online and responsive for BLS signature collection. If >1/3 of issuers are offline, no batch can reach threshold. Orders stay PENDING until issuers recover or users `claimExpired`. This is the same liveness assumption as before — just more visible without the cycle-based abstraction.

## Deployment Plan

Fresh deployment on Arbitrum — no migration from an existing live system.

### Contract Deployment Order

1. **Deploy IssuerRegistry** — new proxy, register all issuers with BLS pubkeys, set `aggregatedPubkey`, create initial snapshot (nonce 1)
2. **Deploy ItpCustody.sol** — single contract, initialized with Investment address and USDC address (`0xaf88d065e77c8cC2239327C5EDb3A432268e5831`)
3. **Deploy Investment.sol** (UUPS proxy) — initializer sets:
   - `usdc = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (Arbitrum native USDC, 6 decimals)
   - `lastBatchNonce = 0`
   - `_blsIssuerRegistry = <IssuerRegistry proxy>`
   - `custody = <ItpCustody address>`
4. **Deploy ITP.sol** contracts — one per ITP, plain ERC20 (18 decimals), mintable/burnable by Investment
5. **Update deployment.json** — IssuerRegistry, ItpCustody, Investment addresses. Must happen before frontend deploy.
6. **Deploy issuer nodes** — new binary with reactive settlement (propose-sign-submit), chain writer targeting Arbitrum, chain ID 42161 in all BLS hashes
7. **Deploy frontend** — direct Investment interaction, no bridge flows. Config:
   - `COLLATERAL_DECIMALS = 6`, `COLLATERAL_TOKEN_ADDRESS = ARB_USDC`
   - Chain: Arbitrum One (42161) only
   - `NEXT_PUBLIC_CHAIN_ID=42161`
   - E2E tests targeting new contract ABIs

### Post-Deployment Verification

- Confirm `lastBatchNonce` advances when orders are submitted (reactive — no fixed interval)
- Confirm buy/sell round-trip works end-to-end
- Monitor `FillFailed` events for fault isolation triggers
- Verify `pendingOrderCount` tracks correctly
- Verify `custody.balances(itpId)` accounting after first fills
