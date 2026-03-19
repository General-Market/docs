---
commit_hash: c57d6882a4f44cfb7ac9f086f5540b51b0b80eb1
---

## Clusters

| Cluster | Files | Key Entities | External Deps | Risk Areas |
|---------|-------|-------------|---------------|------------|
| **ITP Order Engine** | Investment.sol, InvestmentStorage.sol, ITP.sol, TypesLib.sol | submitOrder, confirmBatch, confirmFills, _processFill, createITP | BLSVerifier, FeeRegistry, IERC20 | Share truncation on fill, orphaned PENDING orders, dust on secondary assets |
| **BLS Consensus** | BLSVerifier.sol, BLSLib.sol, OracleRegistry.sol | _verifyBLS, verifyBLSMultiPairing, aggregatedPubkey | BN254 precompile | Threshold off-by-one for small n, BN254 point validation incomplete, ~500k gas per call |
| **Bridge System** | L3BridgeCustody.sol, SettlementBridgeCustody.sol, BridgeProxy.sol, BridgedITP.sol | initiateBridge, markReleased, reverseLock, completeBridge | BLSVerifier, IERC20 | No TTL on locks, non-atomic two-phase commit, nonce gaps undetected, 18↔6 decimal conversion |
| **Vision Prediction** | Vision.sol | createBatch, joinBatch, updateBitmap, realBalance, virtualBalance | BLSVerifier, IERC20 | Dual-balance invariant unchecked, tick duration epoch desync, config promotion edge cases |
| **Governance & Access** | Governance.sol, BLSCustody.sol, AssetPairRegistry.sol, FeeRegistry.sol | pause/unpause, execute, proposeWhitelist, claimFees | BLSVerifier, OracleRegistry | BLSCustody execute = arbitrary calldata on whitelist, fee claim initial state bug, pause idempotency |
| **Oracle Consensus (Rust)** | oracle/consensus/protocol.rs, oracle/batcher, oracle/price, oracle/bridge, oracle/p2p | run_consensus, fetch_prices, OrderBatcher, BridgeOrchestrator | Bitget API, RPC, P2P TCP | No consensus timeout, P2P message loss invisible, unwrap_or_default on serialization |
| **Authorized Participant** | ap/main.rs, ap/event_monitor.rs, ap/timeout, ap/external/bitget | process_events, EventMonitor, TimeoutHandler, BitgetClient | Bitget REST API, RPC (L3 + Settlement) | 1300-line monolith, no retry on Bitget timeout, order timeout off-chain only, RwLock on event receiver |
| **Data Node** | data-node/src/main.rs, collector_loop, market_data sources | run_serve, CollectorLoop, AppState | PostgreSQL, Bitget, CoinGecko, OpenMeteo | DB migration not idempotent, expect() on truncate, no circuit breaker |
| **Frontend Core** | HomeClient.tsx, PortfolioSection, ItpListing, VisionMarketsGrid | Page shell, portfolio display, ITP listing, Vision grid | framer-motion, recharts, react-virtual, wagmi | Prop drilling cascade, no error boundaries, 97% untested |
| **Frontend Hooks** | useBetsSSE, useLeaderboardSSE, useChainWrite, useSubmitBitmap, useItpNav | Real-time feeds, chain writes, bitmap submission | EventSource, wagmi, React Query | 16+ silent catch blocks, SSE cleanup races, `as any` casts (13+), `catch (e: any)` (12+) |
| **Frontend API** | api/vision/*, api/itp-price, api/backend/[...path], api/oracle/[...path] | Proxy routes to backend services | Backend URLs from config | No auth on any route, unvalidated response types, generic proxy passthrough |
| **Shared (Rust)** | common/src/types.rs, common/src/traits.rs, common/src/error.rs | LimitOrder, Price, ChainReader, ChainWriter, Error enum | ethers | Type definitions manually duplicated from Solidity ABI, error code collision risk |
