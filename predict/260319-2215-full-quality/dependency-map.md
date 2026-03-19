---
commit_hash: c57d6882a4f44cfb7ac9f086f5540b51b0b80eb1
---

## Import Graph (Cross-Subsystem)

| File | Imports From | Symbols |
|------|-------------|---------|
| Investment.sol | BLSVerifier.sol | _verifyBLS (inherited) |
| Investment.sol | InvestmentStorage.sol | All storage vars |
| Investment.sol | ITP.sol | mint, burn |
| Investment.sol | FeeRegistry.sol | registerITPDeployer, recordFee |
| Investment.sol | RebalanceLib.sol | rebalance |
| ITP.sol | Investment.sol (via interface) | getNAV (circular!) |
| BLSVerifier.sol | OracleRegistry.sol | getSnapshotAtNonce, verifyBLSMultiPairing |
| BLSCustody.sol | BLSVerifier.sol | _verifyBLS |
| L3BridgeCustody.sol | BLSVerifier.sol | _verifyBLS |
| SettlementBridgeCustody.sol | BridgedITP.sol | mint, burn |
| BridgeProxy.sol | Investment.sol | createITP (cross-chain) |
| Vision.sol | BLSVerifier.sol | _verifyBLS |
| oracle/consensus | common/traits | ChainReader, ChainWriter, PriceFetcher |
| oracle/consensus | oracle/price/bitget | BitgetPriceFetcher |
| oracle/consensus | oracle/batcher | OrderBatcher |
| oracle/consensus | oracle/bridge | BridgeOrchestrator |
| ap/main | common/traits | APClient |
| ap/main | ap/external/bitget | BitgetClient |
| ap/main | ap/event_monitor | EventMonitor |
| ap/main | ap/timeout | TimeoutHandler |
| frontend hooks | frontend/lib/config | All URLs, constants |
| frontend SSE hooks | EventSource API | Browser native |
| frontend chain hooks | wagmi | useWriteContract, useSwitchChain |
| frontend API routes | frontend/lib/config | Backend URLs |

## Call Graph (Critical Paths)

| Caller | Callee | File:Line | Type |
|--------|--------|-----------|------|
| User → submitOrder | _createOrder → IERC20.safeTransferFrom | Investment.sol:289 | USDC escrow |
| Oracle → confirmBatch | _verifyBLS → OracleRegistry | BLSVerifier.sol:78 | BLS consensus |
| Oracle → confirmFills | _processFill → ITP.mint | Investment.sol:498 | Share mint |
| Oracle → confirmFills | _processFill → ITP.burn | Investment.sol:524 | Share burn |
| Oracle → confirmFills | _safeTransferOrEscrow | Investment.sol:546 | USDC release |
| User → initiateBridge | safeTransferFrom → PendingLock | L3BridgeCustody.sol:124 | Bridge escrow |
| Oracle → markReleased | _verifyBLS → release | L3BridgeCustody.sol:156 | Bridge release |
| Oracle → run_consensus | fetch_prices → vote → sign | consensus/protocol.rs:650+ | Price consensus |
| AP → process_events | bitget.place_limit_order | bitget/client.rs:153 | CEX order |
| AP → process_events | chain_writer.confirm_fills | ap/main.rs:1050+ | Settlement confirm |
| Frontend → useBetsSSE | EventSource → QueryClient | useBetsSSE.ts:283 | Real-time feed |
| Frontend → useChainWrite | wagmi.writeContract | useChainWrite.ts:95 | On-chain TX |

## Data Flows

| Source | Transform | Sink | Risk Areas |
|--------|-----------|------|------------|
| User USDC → submitOrder | TransferFrom escrow | orders[orderId].amount | Dust (MIN=1e15) |
| orders → confirmFills | Fill price × amount ÷ NAV = shares | _userShares | Truncation → 0 shares → revert |
| ITPCore.inventory + prices → NAV | ∑(qty[i] × price[i]) / 1e18 | _itpNavs[itpId] | Oracle-pushed, no freshness check |
| L3 USDC → initiateBridge | Lock with no TTL | PendingLock | Permanent lock if oracle unavailable |
| Settlement → completeBuyOrder | Release USDC → AP buys assets → mint shares | L3 Investment | Non-atomic two-phase commit |
| Bitget prices → oracle | Cache (30s TTL) → consensus vote | Price consensus | Stale if round > 30s |
| L3 events → AP EventMonitor | Block cursor scan → event queue (10K) | process_events | Missed events if cursor corrupted |
| AP → Bitget order | place_limit_order → 30s timeout | CEX order book | No retry on timeout |
| Frontend SSE → QueryClient | JSON.parse with no type guard | React state | Silent parse errors |
| Frontend → useItpNav | 1.5s poll → /api/itp-price | Display NAV | Stale on API failure |
| Vision dual-balance | realBalance + virtualBalance | USDC reserves | No runtime invariant check |
