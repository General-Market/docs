# Hypothesis Queue

Ranked hypotheses formatted for downstream chain consumption.

| Rank | ID | Hypothesis | Confidence | Location | Source Persona |
|------|----|-----------|-----------|----------|----------------|
| 1 | H-01 | Oracle consensus round hangs indefinitely when P2P peer is unresponsive or crashes mid-round | HIGH | oracle/src/consensus/protocol.rs:650+ | Reliability Engineer + Consensus Expert (confirmed 7/8) |
| 2 | H-02 | Bridge funds lock permanently when oracle quorum unavailable for reverseLock (15/20 threshold, current testnet has 3 oracles) | HIGH | L3BridgeCustody.sol:96-151 | Cross-Chain Bridge (confirmed 7/8) |
| 3 | H-03 | ITP shares minted against unbacked USDC when settlement TX reverts after bridge confirmation signal | MEDIUM | SettlementBridgeCustody.sol, Investment.sol:498 | Financial Precision + Cross-Chain Bridge (confirmed 6/8) |
| 4 | H-04 | Frontend network errors invisible to operators — 16+ silent catch blocks swallow SSE, REST, and EventSource failures | HIGH | useBetsSSE.ts:291, useLeaderboardSSE.ts:225, +13 locations | Reliability Engineer (confirmed 8/8) |
| 5 | H-05 | Cross-chain USDC balance diverges silently — no automated reconciliation between L3 locked and Settlement released | HIGH | L3BridgeCustody.sol, SettlementBridgeCustody.sol | Cross-Chain Bridge (confirmed 7/8) |
| 6 | H-06 | AP crash leaves orders stuck indefinitely — TimeoutHandler is in-memory only, no on-chain permissionless refund | HIGH | ap/src/main.rs:946-1046 | Reliability Engineer (confirmed 7/8) |
| 7 | H-07 | Oracle fails to boot when RPC is temporarily unreachable — no retry on Provider creation at startup | HIGH | oracle/src/chain/reader.rs:137-139 | Reliability Engineer (confirmed 7/8) |
| 8 | H-08 | Small fill amounts produce 0 shares via integer truncation — user's order filled but receives nothing | HIGH | Investment.sol:481 | Financial Precision (confirmed 6/8) |
| 9 | H-09 | Settlement RPC death mid-session silently disables all vault operations — no reconnection | HIGH | ap/src/main.rs:708-719 | Reliability Engineer (confirmed 6/8) |
| 10 | H-10 | Vision dual-balance invariant (∑real + ∑virtual + fees = USDC reserves) never validated at runtime | HIGH | Vision.sol | Reliability Engineer (confirmed 6/8) |
| 11 | H-11 | AP validates fill price tolerance off-chain only — silent drop, no on-chain enforcement or rejection event | HIGH | ap/src/main.rs:978-1000 | Financial Precision (confirmed 6/8) |
| 12 | H-12 | BLSCustody.execute allows any function on whitelisted targets — no selector-level whitelist | HIGH | BLSCustody.sol:104-141 | Security Analyst (confirmed 5/8) |
| 13 | H-13 | P2P messages have no delivery acknowledgment — lost messages cause silent consensus failures | HIGH | oracle/src/p2p/transport.rs | Consensus Expert (confirmed 5/8) |
| 14 | H-14 | NAV can regress when overlapping oracle rounds push older NAV after newer one | MEDIUM | Investment.sol:885-890 | Financial Precision (confirmed 6/8) |
| 15 | H-15 | Concurrent consensus rounds produce duplicate nonces via thread-unsafe nonce manager | MEDIUM | oracle/src/chain/nonce.rs | Consensus Expert (confirmed 6/8) |
| 16 | H-16 | Bridge double-submission possible if BLS consensus succeeds twice for same proposal | MEDIUM | oracle/src/bridge/orchestrator.rs | Security Analyst (confirmed 5/8) |
| 17 | H-17 | PENDING orders without confirmBatch have no timeout mechanism — can persist indefinitely | HIGH | Investment.sol:404-472 | Reliability Engineer (confirmed 6/8) |
| 18 | H-18 | HomeClient prop drilling cascade causes state desync across 6+ component levels | HIGH | HomeClient.tsx:114-120 | Architecture Reviewer (confirmed 5/8) |
| 19 | H-19 | BigInt(nav.total_supply) throws unhandled exception on null/undefined — crashes ItpListing | HIGH | ItpListing.tsx:61 | Financial Precision (confirmed 5/8) |
| 20 | H-20 | AP process_events is 420-line monolith — untestable, hides bugs in nested match arms | HIGH | ap/src/main.rs:884-1304 | Architecture Reviewer (confirmed 5/8) |
