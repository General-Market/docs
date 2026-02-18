# Architecture vs Implementation Gap Analysis

**Generated:** 2026-02-04
**Architecture Version:** 2.1
**Analysis Scope:** Full codebase comparison against architecture.md

---

## Executive Summary

After thorough comparison of the architecture document (3900+ lines) against the actual codebase, key gaps exist in:

1. **Smart Contracts:** BLS-signed price updates (admin-only currently), NAV computation stub, missing minBuyAmount/queue depth enforcement
2. **Issuer Node:** NTP integration stub, TLS trait not wired, DEX price source not integrated into main flow
3. **AP Node:** Fill reporter fully built but not wired into main loop, withdrawal processing not started
4. **Deployment/Ops:** Multi-chain custody not yet deployed (contracts are reusable), no monitoring dashboard

---

## 1. SMART CONTRACTS GAPS

### 1.1 Index.sol - Order System

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| `submitOrder()` | Full limit order with pairId, slippageTier, deadline | ✅ IMPLEMENTED | - |
| `confirmBatch()` | BLS-signed batch confirmation | ✅ IMPLEMENTED | - |
| `confirmFills()` | BLS-signed fill confirmation with validation | ✅ IMPLEMENTED | - |
| `refundExpiredOrder()` | BLS-signed refund for expired orders | ✅ IMPLEMENTED | - |
| `createITP()` | ITP creation with weights validation | ✅ IMPLEMENTED | - |
| **BLS-signed price updates** | Prices updated via BLS consensus (Section 7) | ⚠️ PARTIAL | `setPrice()` is admin-only, not BLS-signed. Architecture says "Prices updated by issuers via BLS" |
| **NAV Calculation** | `NAV = Σ(quantity[i] * price[i]) / totalSupply` | ⚠️ STUB | `_getCurrentPrice()` TODO at line 942-943: "needs ITP-specific weighted price calculation using actual assets and weights (currently uses first asset only for MVP)" |
| **minBuyAmount enforcement** | Per-asset minimum from on-chain mapping | ❌ NOT FOUND | Architecture Section 9: `mapping(address => uint256) public minBuyAmount` - not implemented in Index.sol |
| **Queue depth monitoring** | Pause new orders at depth > 500 | ❌ NOT FOUND | Architecture Section 10: No on-chain queue depth tracking |

### 1.2 ITP.sol - ERC4626 Vault

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| ERC4626 compliance | Full vault standard | ✅ IMPLEMENTED | - |
| Block direct deposits | Prevent bypass of Index.sol | ✅ IMPLEMENTED | deposit(), mint(), withdraw(), redeem() all revert |
| `onlyIndex` modifier | Mint/burn only via Index.sol | ✅ IMPLEMENTED | - |
| **Per-ITP pause** | Individual ITP pause (Section 16) | ✅ IMPLEMENTED | Via Governance.pauseITP() |

### 1.3 BLSCustody.sol - Multi-Chain Custody

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| `execute()` with nonce bitmap | Non-sequential nonce for gap attack prevention | ✅ IMPLEMENTED | - |
| `proposeWhitelist()` | 11/20 BLS + 2-day timelock | ✅ IMPLEMENTED | - |
| `activateWhitelist()` | After timelock | ✅ IMPLEMENTED | - |
| `emergencyRemoveWhitelist()` | 15/20 BLS, immediate | ✅ IMPLEMENTED | - |
| `proposeUpgrade()` | 15/20 BLS + 7-day timelock | ✅ IMPLEMENTED | - |
| `proposeEmergencyUpgrade()` | 17/20 BLS + 24h timelock | ✅ IMPLEMENTED | - |
| `executeUpgrade()` | After timelock | ✅ IMPLEMENTED | - |
| **Chain ID in signed message** | Cross-chain replay protection | ✅ IMPLEMENTED | `block.chainid` included |

### 1.4 IssuerRegistry.sol - Key Management

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| `requestKeyRotation()` | Issuer signs with old key | ⚠️ DESIGN DIVERGENCE | Admin-only (Option B from Dev Notes, lines 238-241). Deliberate choice to ship faster with admin oversight. Architecture specifies issuer signs with old key. Upgrade path documented in code comments |
| `approveRotation()` | 10/19 other issuers approve | ⚠️ DESIGN DIVERGENCE | Admin-only (same Option B). Signature parameters exist but are ignored. Architecture specifies BLS verification per approver. Future upgrade can add full BLS verification |
| `executeRotation()` | After 24h timelock + safe period | ✅ IMPLEMENTED | - |
| `forceRotationWindow()` | Admin escape after 48h | ✅ IMPLEMENTED | - |
| Grace period (10 cycles) | Old key valid post-rotation | ✅ IMPLEMENTED | - |
| **G2 aggregation** | Aggregated pubkey computation | ⚠️ BY DESIGN | `getAggregatedPubkey()` returns empty - G2 aggregation impossible on-chain, computed off-chain |

### 1.5 Bridge Contracts (L3BridgeCustody, ArbBridgeCustody)

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| Two-phase bridge (lock→verify→release) | Full two-phase pattern | ✅ IMPLEMENTED | - |
| `initiateBridge()` | BLS-signed lock with proof | ✅ IMPLEMENTED | - |
| `markReleased()` | Confirm destination release | ✅ IMPLEMENTED | - |
| `reverseLock()` | 15/20 BLS after 1h timeout | ✅ IMPLEMENTED | - |
| `completeBridge()` | Verify + release on destination | ✅ IMPLEMENTED | - |
| `buyITPFromArbitrum()` | Cross-chain ITP purchase | ✅ IMPLEMENTED | - |
| Decimal conversion (6↔18) | Via DecimalLib | ✅ IMPLEMENTED | - |

### 1.6 BridgeProxy.sol - Cross-Chain ITP Creation

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| `requestCreateItp()` | User requests ITP creation | ✅ IMPLEMENTED | - |
| `completeCreateItp()` | BLS-signed completion | ✅ IMPLEMENTED | - |
| BridgedItpFactory | Deploy BridgedITP tokens | ✅ IMPLEMENTED | - |
| BridgedITP | ERC20 L3 ITP representation | ✅ IMPLEMENTED | - |

### 1.7 Registry Contracts

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| CollateralRegistry.recordCollateralMove() | BLS-signed collateral tracking | ✅ IMPLEMENTED | - |
| AssetPairRegistry (assets + pairs) | Full asset/pair lifecycle | ✅ IMPLEMENTED | - |
| FeeRegistry | Fee calculation + distribution | ✅ IMPLEMENTED | - |
| **IssuerRegistry peer discovery** | On-chain IP registry (Section 3) | ⚠️ PARTIAL | IP field exists but not verified for peer discovery |

### 1.8 Libraries

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| BLSLib (ecAdd, ecNegate, verifyBLS) | BN254 precompile usage | ✅ IMPLEMENTED | - |
| TypesLib (all structs/enums) | Consolidated types | ✅ IMPLEMENTED | - |
| ErrorsLib (E001-E081+) | Custom errors | ✅ IMPLEMENTED | - |
| EventsLib | Event definitions | ✅ IMPLEMENTED | - |
| DecimalLib | 6↔18 decimal conversion | ✅ IMPLEMENTED | - |

### 1.9 Missing Contracts/Features

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| **Governance.sol** | Pause, upgrade auth | ✅ IMPLEMENTED | - |
| **Market order blocking** | "All orders are limit orders" (Section 6) | ✅ BY DESIGN | TypesLib.sol:71 explicitly states "All orders are limit orders (no market orders in the system)." All `submitOrder()` calls require `limitPrice` with validation against current price. This is deliberate design, not a gap |
| **VenuePool tracking** | Pool configuration per venue (Section 14) | ❌ NOT FOUND | Architecture shows VenuePool struct, not in contracts |
| **Price staleness on-chain** | Per-asset staleness limits | ❌ NOT FOUND | Architecture Section 7.1 shows on-chain staleness mapping |

---

## 2. ISSUER NODE GAPS (Rust)

### 2.1 Core Cycle Management

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| 5-phase cycle (1 second) | ProcessFills→Netting→Inventory→Batch→Sign | ✅ IMPLEMENTED | - |
| Phase timeouts (~200ms each) | Configurable durations | ✅ IMPLEMENTED | - |
| **NTP time synchronization** | ±200ms tolerance (Section 7) | ❌ STUB | `reference_time` field is stub - "story not implemented yet" at cycle/manager.rs:89-92 |

### 2.2 Consensus Protocol

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| BLS signature collection | 11/20 threshold | ✅ IMPLEMENTED | - |
| Price consensus (500ms timeout) | Leader broadcasts, followers vote | ✅ IMPLEMENTED | - |
| Batch consensus (500ms timeout) | Leader broadcasts, followers sign | ✅ IMPLEMENTED | - |
| 20% disagreement detection | Cancel round, retry | ✅ IMPLEMENTED | - |
| Max 3 retries → emergency pause | Escalation path | ✅ IMPLEMENTED | - |
| ITP creation consensus | ITP_CREATION_PROPOSAL/SIGN | ✅ IMPLEMENTED | - |

### 2.3 Leader Election

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| `hash(lastBLSSig) mod numIssuers` | Deterministic election | ✅ IMPLEMENTED | - |
| 500ms leader timeout | Failover to next issuer | ✅ IMPLEMENTED | - |
| 3 consecutive misses → kick vote | Track missed rounds | ✅ IMPLEMENTED | - |

### 2.4 P2P Transport

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| TCP + MessagePack | Length-prefixed framing | ✅ IMPLEMENTED | - |
| TLS mutual auth | Optional for dev | ⚠️ PARTIAL | Real `connect_tls()`/`accept_tls()` methods exist using tokio-rustls, and TLS config is loaded in bootstrap/p2p.rs:70-78. However, the legacy `wrap_stream()` at p2p/tls.rs:88 still returns plaintext. Conditional TLS application at connection.rs:200-201. TODO remains to remove plaintext fallback path |
| All message types | PRICE_*, BATCH_*, HEARTBEAT, etc. | ✅ IMPLEMENTED | - |

### 2.5 Netting Engine (7 Steps)

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| Step 1: Pair Netting | Merge same-pair orders | ✅ IMPLEMENTED | - |
| Step 2: Fill Priority | Query liquidity at 25/50/75/100% | ⚠️ SIMPLIFIED | Uses static thresholds, not dynamic liquidity queries |
| Step 3: Slippage Filter | Exclude orders above tier limit | ✅ IMPLEMENTED | - |
| Step 4: Chain Grouping | Batch by destination chain | ✅ IMPLEMENTED | - |
| Step 5: Bridge Netting | Net opposite-direction bridges | ✅ IMPLEMENTED | - |
| Step 6: USDT Netting | Net USDC↔USDT with depeg check | ✅ IMPLEMENTED | - |
| Step 7: Fee Allocation | Proportional to order size | ✅ IMPLEMENTED | - |

### 2.6 Price Handling

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| Bitget price fetching | Real-time via read-only API | ✅ IMPLEMENTED | - |
| Staleness validation | 10s CEX, 30s DEX, 60s on-chain | ✅ IMPLEMENTED | - |
| Price tolerance | 0.5% stables, 2% BTC/ETH | ✅ IMPLEMENTED | - |
| **DEX price source** | 1inch quotes | ⚠️ NOT WIRED | DexPriceSource adapter fully built (bootstrap/price.rs:34-35, stored in PriceComponents as `dex_source: Option<Arc<DexPriceSource>>`). Includes 1inch API → on-chain reserves fallback chain. Not passed to ConsensusProtocol — consensus uses BitgetPriceFetcher only |

### 2.7 State Reconstruction

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| Stateless design (NFR19) | Reconstruct from on-chain | ✅ IMPLEMENTED | - |
| Checkpoint support | Faster restart | ✅ IMPLEMENTED | - |
| Multi-chain state | CollateralRegistry queries | ✅ IMPLEMENTED | - |

### 2.8 Heartbeat & Monitoring

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| 1s heartbeat interval | Broadcast to all peers | ✅ IMPLEMENTED | - |
| 5s unhealthy threshold | Mark peer unhealthy | ✅ IMPLEMENTED | - |
| **Auto kick vote** | After 3 consecutive misses | ⚠️ DESIGN DIVERGENCE | Kick vote is proposed but deliberately NOT auto-executed — stored for admin review instead (heartbeat/monitor.rs:170). Test `test_kick_proposal_not_auto_executed()` enforces this. Architecture says auto-execute; implementation chose manual review for safety |
| HTTP /health endpoint | Metrics exposure | ✅ IMPLEMENTED | - |

### 2.9 Bridge Orchestration

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| Bridge Arb→L3 (Story 7.2) | Cross-chain consensus | ✅ IMPLEMENTED | - |
| Submit order for user (Story 7.3) | BLS-signed submission | ✅ IMPLEMENTED | - |
| Batch fill orchestration (Story 7.4) | Consensus-driven | ✅ IMPLEMENTED | - |
| Bridge L3→Arb (Story 7.5) | Reverse bridge | ✅ IMPLEMENTED | - |
| Custody release (Story 7.6) | Release to vault | ✅ IMPLEMENTED | - |

### 2.10 Missing Issuer Features

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| **Rebalance execution** | Weight update flow (Section 11) | ⚠️ PARTIAL | Rebalance netting, BLS consensus for rebalance batches (bridge/orchestrator.rs:3370-3449), update weights proposal + signature collection (consensus/protocol.rs:5165-5218), and calldata building (bridge/types.rs:1302+) all implemented. Final on-chain transaction submission step not confirmed |
| **AP fill verification** | Verify via Bitget read-only API | ✅ IMPLEMENTED | BitgetVaultReader created in bootstrap/consensus.rs:283-296, wired into ConsensusProtocol via `fill_verifier` field, and actively used during batch confirmation at consensus/protocol.rs:1543-1569 to verify fill amounts against on-chain MockBitgetVault |
| **Fusion+ execution** | Cross-chain swap via 1inch | ✅ IMPLEMENTED | FusionPlusClient wired into CrossChainOrchestrator at execution/crosschain_orchestrator.rs:148. Orchestrator creates Fusion+ intents via execute() method. Bootstrapped at bootstrap/execution.rs:129-148 |
| **Solana/Squads integration** | Ed25519 multisig (Section 13) | ⚠️ NOT WIRED | Common crate has full Squads client (client, instructions, PDA derivation, accounts, tests). Not yet integrated into issuer execution flow |

---

## 3. AP NODE GAPS (Rust)

### 3.1 Core Components

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| Buffer manager | Debt tracking, replenishment | ✅ IMPLEMENTED | - |
| Priority queue (4 buckets) | Small/Medium/Large/XL | ✅ IMPLEMENTED | - |
| Timeout handler | 60s, max 3 retries | ✅ IMPLEMENTED | - |
| Source failure state machine | Active/Paused/Suspended | ✅ IMPLEMENTED | - |

### 3.2 Event Processing

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| TradeRequest event monitoring | Read from chain | ✅ IMPLEMENTED | - |
| Deduplication | Prevent double-processing | ✅ IMPLEMENTED | - |
| Reorg handling | Block tracker rollback | ✅ IMPLEMENTED | - |
| **WithdrawalRequest handling** | Process withdrawals | ❌ NOT STARTED | TODO at main.rs:883: "Queue for withdrawal processing" |

### 3.3 Bitget Integration

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| Limit order placement | Place on Bitget | ✅ IMPLEMENTED | - |
| Fill queries | Get execution status | ✅ IMPLEMENTED | - |
| HMAC-SHA256 auth | Signed requests | ✅ IMPLEMENTED | - |
| Rate limiting | Tier-based throttling | ✅ IMPLEMENTED | - |
| **Fill reporting to chain** | Submit fills on-chain | ⚠️ NOT WIRED | FillReporter (1052 lines) and batch logic (397 lines) are fully implemented with report_fill(), submit_batch() with retry, start_batch_timer(), ChainWriter integration via confirm_fills(), and comprehensive tests. Only gap: not yet called from AP main loop |

### 3.4 Missing AP Features

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| **1inch DEX execution** | BLS-piloted swaps (Section 14) | ❌ NOT STARTED | Listed as future module |
| **Uniswap fallback** | On-chain fallback pricing | ❌ NOT STARTED | Listed as future module |
| **Multi-AP redundancy** | Multiple APs per source (Section 24) | ❌ FUTURE | Listed as open item |

---

## 4. COMMON CRATE GAPS

### 4.1 BLS Cryptography

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| BN254 keypair generation | 32-byte private, 128-byte public | ✅ IMPLEMENTED | - |
| BLS signing | Raw + pre-hashed modes | ✅ IMPLEMENTED | - |
| BLS verification | Pairing check | ✅ IMPLEMENTED | - |
| Signature aggregation | Point addition on G1 | ✅ IMPLEMENTED | - |
| Pubkey aggregation | G2 point addition | ✅ IMPLEMENTED | Warning: rogue-key attack |

### 4.2 Key Management

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| Ed25519 for Solana | Keypair, signing | ✅ IMPLEMENTED | - |
| AES-256-GCM encryption | Encrypted key storage | ✅ IMPLEMENTED | - |
| Argon2id KDF | Key derivation | ✅ IMPLEMENTED | - |

### 4.3 Integrations

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| Bitget read-only API | Trade history, fills | ✅ IMPLEMENTED | - |
| 1inch Quote API | Swap quotes | ✅ IMPLEMENTED | - |
| 1inch rate limiting | Multi-key + backoff | ✅ IMPLEMENTED | - |
| Quote caching (5s TTL) | Reduce API calls | ✅ IMPLEMENTED | - |
| **1inch Fusion+** | Cross-chain swaps | ✅ IMPLEMENTED | Full FusionPlusClient (893 lines): create_intent(), get_intent_status(), get_quote(), retry with exponential backoff, comprehensive test suite |
| On-chain quote fallback | Uniswap V3 + Sushiswap | ✅ IMPLEMENTED | - |
| **Jupiter (Solana)** | DEX aggregator | ✅ IMPLEMENTED | Full client + route parsing + types + error handling. Tests (703 lines) cover get_route_from_quote, multi-hop routing, DEX label parsing |
| **Squads (Solana)** | Multisig governance | ✅ IMPLEMENTED | Full client + instructions + PDA derivation + accounts. Tests (788 lines) cover proposal lifecycle, threshold enforcement, transaction building |

### 4.4 Missing Common Features

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| **Uniswap V3 tick math** | Accurate price impact | ⚠️ TODO | price_math.rs:216: "TODO: Implement proper Uniswap V3 price impact calculation using tick math" |

---

## 5. CROSS-CUTTING GAPS

### 5.1 Multi-Chain Deployment

> **Note:** BLSCustody.sol is a reusable contract — the gap below is deployment/ops work, not new engineering. Solana requires a separate Squads program (different from EVM custody).

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| Index L3 (Orbit) | Primary chain | ✅ DEPLOYED | - |
| Arbitrum custody | USDC inventory + swaps | ✅ CONTRACTS EXIST | - |
| **Ethereum custody** | ETH, AAVE, UNI, LINK | ❌ NOT DEPLOYED | Deployment task: reuse BLSCustody.sol on Ethereum |
| **Base custody** | AERO, cbBTC | ❌ NOT DEPLOYED | Deployment task: reuse BLSCustody.sol on Base |
| **Optimism custody** | OP, VELO | ❌ NOT DEPLOYED | Deployment task: reuse BLSCustody.sol on Optimism |
| **Solana custody** | Squads multisig | ❌ NOT DEPLOYED | Requires Squads program deployment. Client/orchestration implemented in common crate |

### 5.2 Monitoring & Operations

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| **Monitoring dashboard** | Real-time metrics UI | ❌ NOT FOUND | Architecture Section 21: "UI Panel Required" |
| Log specification | JSON format, retention | ⚠️ PARTIAL | Logging exists but no retention policy |
| Error code system | E001-E033+ | ✅ IMPLEMENTED | - |

### 5.3 Security Features

| Feature | Architecture Spec | Implementation Status | Gap Details |
|---------|------------------|----------------------|-------------|
| BLS replay protection | Cycle-based + nonce bitmap | ✅ IMPLEMENTED | - |
| Cross-chain replay | chainId in message | ✅ IMPLEMENTED | - |
| **HSM support** | Production key storage | ❌ FUTURE | Architecture Section 16: Phase 2+ |
| **Threshold BLS** | Decentralized key management | ❌ FUTURE | Architecture Section 24: Open item |

---

## 6. SUMMARY BY PRIORITY

### Critical Gaps (Blocking Production)

**Wiring tasks** (component exists, needs integration):
1. **Fill reporting to chain** (AP) — FillReporter + batch logic fully built, needs wiring into AP main loop

**New implementation required:**
2. **NTP time sync** (Issuer) — Stub only, needs real NTP client or documented external sync requirement
3. **BLS-signed price updates** (Contracts) — `setPrice()` is admin-only; architecture requires BLS-signed updates

### High Priority Gaps

4. **Withdrawal processing** (AP) — Not started (TODO at main.rs:883)
5. **NAV calculation** (Contracts) — `_getCurrentPrice()` uses single asset; needs weighted calculation per ITP
6. **minBuyAmount enforcement** (Contracts) — Per-asset minimum mapping not implemented (only global MIN_ORDER_AMOUNT exists)
7. **Rebalance on-chain execution** (Issuer) — Consensus + calldata building complete, final tx submission not confirmed

### Medium Priority Gaps

8. **Dynamic liquidity queries** (Issuer netting) — Step 2 uses static slippage tiers, not dynamic liquidity queries
9. **TLS plaintext fallback removal** (Issuer P2P) — Real TLS methods exist (`connect_tls`/`accept_tls`), but legacy `wrap_stream()` still returns plaintext
10. **DEX price source integration** (Issuer) — DexPriceSource adapter built and instantiated but not passed to ConsensusProtocol
11. **Squads wiring into issuer** (Issuer) — Common crate client is complete; not wired into issuer execution



### Design Divergences (Not Gaps — Intentional Choices)

These deviate from the architecture but are deliberate decisions documented in code:

- **IssuerRegistry key rotation** — Admin-only (Option B) instead of BLS-signed. Documented upgrade path exists
- **Auto kick vote** — Manual admin review instead of auto-execution, for safety
- **Market order blocking** — Enforced by requiring limitPrice on all orders, explicitly documented in TypesLib

---

## 7. RECOMMENDATIONS

### Immediate Actions (Wiring — Components Already Built)

1. **Wire FillReporter into AP main loop** — Call `report_fill()` from the fill processing path in `ap/src/main.rs`, invoke `submit_pending_fills()` on batch timer. The reporter, batch logic, and ChainWriter integration are all implemented and tested
2. **Wire Squads client into issuer** — The Squads client in `common/src/integrations/squads/` is complete. Integrate into issuer execution for Solana custody operations
3. **Wire DexPriceSource into consensus** — Pass the already-instantiated `dex_source` from PriceComponents to ConsensusProtocol so DEX prices participate in price consensus alongside Bitget

### Before Mainnet (New Implementation Required)

4. **Implement NTP client** — Replace the stub at `issuer/src/cycle/manager.rs:89-92`. Either integrate a Rust NTP crate (e.g., `ntp` or `sntpc`) or document that nodes must run `ntpd`/`chrony` externally and remove the stub field
5. **Add BLS verification to setPrice()** — Modify `Index.sol:860-873` to verify BLS signatures instead of checking `governance.admin()`. Signature parameters and BLS verification are already available via BLSLib
6. **Implement proper NAV calculation** — Replace `_getCurrentPrice()` at `Index.sol:939-950` with weighted price calculation: iterate ITP's asset weights and sum `weight[i] * assetPrices[assetIdx[i]]`
7. **Add minBuyAmount enforcement** — Add `mapping(address => uint256) public minBuyAmount` to IndexStorage.sol and validate against it in `submitOrder()`
8. **Complete AP withdrawal flow** — Implement withdrawal processing at `ap/src/main.rs:883` where the TODO exists
9. **Remove TLS plaintext fallback** — Real `connect_tls()`/`accept_tls()` using tokio-rustls already exist. Remove the legacy `wrap_stream()` plaintext path at p2p/tls.rs:88 and ensure all connections use TLS methods
10. **Confirm rebalance on-chain execution** — Consensus, calldata building, and signature collection are done. Verify the final `chain_writer` call actually submits the transaction, or add it if missing

### Post-Launch

11. Deploy BLSCustody.sol to Ethereum, Base, Optimism (deployment/ops — no new contract code needed)
12. Deploy Squads program to Solana (client already wired in common crate)
13. Build monitoring dashboard (Architecture Section 21)
14. Add queue depth tracking and auto-pause at >500 orders
15. Add on-chain price staleness mapping and enforcement
16. Implement Uniswap V3 tick math for accurate price impact (replace simplified estimation in price_math.rs)
17. Upgrade to HSM key storage (Phase 2+)

### Caveat: Test Coverage Not Assessed

This report catalogs feature presence/absence but does not assess test coverage of implemented features. Items marked "IMPLEMENTED" have not been verified for adequate test coverage, edge case handling, or integration test completeness. A separate test coverage analysis is recommended before production deployment.

---

*Generated by Business Analyst Agent — Corrected 2026-02-04 after adversarial review. Re-verified 2026-02-04: Fusion+ wiring and AP fill verification confirmed fixed.*
