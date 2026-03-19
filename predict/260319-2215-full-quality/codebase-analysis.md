---
commit_hash: c57d6882a4f44cfb7ac9f086f5540b51b0b80eb1
analyzed_at: 2026-03-19T22:15:00Z
scope: "**/*.{ts,tsx,sol,rs,mjs,js}"
files_analyzed: 1310
---

## Functions (Key — Full Inventory in Agent Logs)

| File | Function | Signature | Lines | Calls | Called By |
|------|----------|-----------|-------|-------|-----------|
| Investment.sol | submitOrder | `(bytes32, Side, uint256, uint256, uint256, uint256) → uint256` | 160-168 | _createOrder | Users |
| Investment.sol | _createOrder | `(address, address, bytes32, Side, uint256, ...) → uint256` | 195-308 | IERC20.safeTransferFrom | submitOrder, submitOrderFor |
| Investment.sol | confirmBatch | `(uint256, uint256[], bytes, uint256, uint256)` | 311-367 | _verifyBLS | Oracles |
| Investment.sol | confirmFills | `(uint256, Fill[], bytes, uint256, uint256)` | 404-472 | _verifyBLS, _processFill | Oracles |
| Investment.sol | _processFill | `(Fill, LimitOrder)` | 477-539 | ITP.mint/burn, _safeTransferOrEscrow | confirmFills |
| Investment.sol | createITP | `(string, string, uint256[], address[], uint256[], uint256) → bytes32` | 679-801 | FeeRegistry | Users/bridge |
| Investment.sol | rebalance | `(bytes32, uint256[], address[], uint256[], ..., bytes, uint256, uint256)` | 831-856 | _verifyBLS, RebalanceLib | Oracles |
| Investment.sol | setItpNav | `(bytes32, uint256, bytes, uint256, uint256)` | 885-890 | _verifyBLS | Oracles |
| Investment.sol | cancelStalePendingOrders | `(uint256[], bytes, uint256, uint256)` | 1091-1131 | _verifyBLS | Oracles |
| ITP.sol | totalAssets | `() → uint256` | 72-77 | Investment.getNAV | Frontend views |
| BLSVerifier.sol | _verifyBLS | `(bytes32, bytes, uint256, uint256)` | 62-100 | OracleRegistry.getSnapshotAtNonce | All consensus fns |
| BLSCustody.sol | execute | `(address, bytes, bytes, uint256, uint256, uint256) → (bool, bytes)` | 104-141 | _verifyBLS, target.call | Oracles |
| L3BridgeCustody.sol | initiateBridge | `(uint256, uint256, bytes, uint256, uint256) → uint256` | 96-151 | _verifyBLS, safeTransferFrom | Users |
| L3BridgeCustody.sol | markReleased | `(uint256, bytes32, bytes, uint256, uint256)` | 156-192 | _verifyBLS | Oracles |
| L3BridgeCustody.sol | reverseLock | `(uint256, bytes, uint256, uint256, uint256)` | 195-200+ | _verifyBLS (15/20) | Oracles |
| Vision.sol | createBatchAndJoin | various | 200+ | safeTransferFrom | Users |
| oracle consensus | run_consensus | `async (&self, cycle: u64) → Result<(), ConsensusError>` | 650+ | price_fetcher, bls_signer, p2p | main |
| oracle price | fetch_prices | `async (&self, assets: &[Address]) → Result<Vec<Price>>` | 36-47 | bitget_client | consensus |
| ap main | process_events | `async (...)` | 884-1304 | bitget.place_order, chain_writer | tokio::spawn |
| ap timeout | track_order | `pub async (&self, order_id)` | 71-77 | HashMap | process_events |
| data-node | run_serve | `async (args) → Result<()>` | 81-500+ | db::create_pool, collector_loop | main |

## Contracts & Types

| File | Name | Kind | Key Properties | Methods |
|------|------|------|----------------|---------|
| Investment.sol | Investment | UUPS Proxy | Core order/ITP engine | submitOrder, createITP, confirmBatch, confirmFills, rebalance |
| ITP.sol | ITP | ERC4626 Wrapper | itpId, indexContract (immutable) | mint/burn (onlyIndex), ERC4626 blocked |
| BLSCustody.sol | BLSCustody | UUPS Proxy | 11/20 standard, 15/20 emergency, timelock | execute, proposeWhitelist, proposeUpgrade |
| BLSVerifier.sol | BLSVerifier | Mixin | OracleRegistry snapshots | _verifyBLS (internal) |
| OracleRegistry.sol | OracleRegistry | UUPS Proxy | 20 oracle quorum, BLS keys | addOracle, setAggregatedPubkey |
| Governance.sol | Governance | UUPS Proxy | Single admin (Phase 1), pause | pause/unpause (global + per-ITP) |
| L3BridgeCustody.sol | L3BridgeCustody | UUPS Proxy | Two-phase commit, sequential nonces | initiateBridge, markReleased, reverseLock |
| SettlementBridgeCustody.sol | SettlementBridgeCustody | UUPS Proxy | Cross-chain orders + Vision deposits | completeBridge, completeBuyOrder |
| BridgeProxy.sol | BridgeProxy | UUPS Proxy | Atomic ITP creation + metadata | requestCreateItp, completeCreateItp |
| Vision.sol | Vision | Contract | Dual-balance (real + virtual), auto-batch | createBatch, joinBatch, updateBitmap |
| FeeRegistry.sol | FeeRegistry | UUPS Proxy | Fee tracking, deployer + protocol split | recordFee, claimFees |
| AssetPairRegistry.sol | AssetPairRegistry | Contract | BLS-gated whitelist, 2-day timelock | proposeAsset, activateAsset |
| TypesLib.sol | TypesLib | Library | Side, OrderStatus, ITPCore, Fill | — |
| BLSLib.sol | BLSLib | Library | BN254 precompile wrappers | ecAdd, ecMul, verifyBLS |
| RebalanceLib.sol | RebalanceLib | Library | Swap-and-pop, weight rebalance | rebalance (delegatecall) |

## Routes / Endpoints (Frontend)

| Method | Path | File | Handler | Auth | Input |
|--------|------|------|---------|------|-------|
| GET | /api/vision/leaderboard | vision/leaderboard/route.ts | Proxy ISSUER_VISION_URL | None | source_id |
| GET | /api/vision/snapshot | vision/snapshot/route.ts | Proxy AA_DATA_NODE | None | sourceFilter |
| POST | /api/vision/bitmap | vision/bitmap/route.ts | Fan-out VISION_ISSUER_URLS | None | player, batch_id, bitmap_hex |
| GET | /api/itp-price | itp-price/route.ts | Compute NAV | None | itp_id |
| GET | /api/backend/[...path] | backend/[...path]/route.ts | Generic proxy | None | Path passthrough |
| GET | /api/oracle/[...path] | oracle/[...path]/route.ts | Generic proxy | None | Path passthrough |

## Frontend Components (Key)

| File | Name | Kind | Dependencies |
|------|------|------|-------------|
| HomeClient.tsx | HomeClient | Page Client | framer-motion, usePostHog, SSE hooks |
| PortfolioSection.tsx | PortfolioSection | Section | usePortfolio, useSSEBalances, useSSENav, recharts |
| ItpListing.tsx | ItpListing | Section | useSSENav, blacklistedItps JSON |
| VisionMarketsGrid.tsx | VisionMarketsGrid | Section | useMarketSnapshot, @tanstack/react-virtual |
| BetCard.tsx | BetCard | Component | useTranslations, useCategories |
| useBetsSSE.ts | useBetsSSE | Hook | EventSource, exponential backoff, React Query |
| useChainWrite.ts | useChainWrite | Hook | wagmi, chain auto-switch |
| useSubmitBitmap.ts | useSubmitBitmap | Hook | VISION_ISSUER_URLS, fan-out, retry 5x |
| useItpNav.ts | useItpNav | Hook | fetch /api/itp-price, 1.5s poll |
| useSimulation.ts | useSimulation | Hook | EventSource SSE, progress tracking |

## Rust Structs (Key)

| File | Name | Kind | Key Fields |
|------|------|------|------------|
| oracle consensus | ConsensusProtocol<F,W,P,B> | struct | runtime_config, price_fetcher, chain_writer, p2p_transport, bls_signer |
| oracle price | BitgetPriceFetcher<C> | struct | client, symbol_map, ticker_cache (RwLock, 30s TTL) |
| oracle chain | EthersChainReader<M> | struct | provider, config, order_cursor, caches |
| ap main | OnChainSettlement | struct | vault_client, quote_token, symbol_map |
| ap timeout | TimeoutHandler | struct | config, tracked_orders (RwLock), retry_queue (Mutex) |
| ap bitget | BitgetClient | struct | config, http_client, credentials |
| data-node | AppState | struct | pool (PgPool), shared_config, collectors, broadcast_hub |
| common types | LimitOrder | struct | id, user, pair_id, side, amount, limit_price, deadline, status |
| common types | Price | struct | asset, price, timestamp, source |
