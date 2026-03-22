---
name: Settlement pipeline session 2026-03-22
description: Full session fixing ITP backing, settlement on Sonic, oracle guards, AP status
type: project
---

## Settlement Pipeline — Built and Verified 2026-03-22

**Buy via Sonic settlement works end-to-end:**
User deposits USDC on Sonic → SettlementBridgeCustody → Oracle detects CrossChainOrderCreated → BLS consensus → Bridge to L3 → submitOrder → completeBuyOrder (USDC → AP vault on Sonic) → confirmFills (shares minted on L3)

**Key addresses (Sonic testnet, chain 14601):**
- SettlementBridgeCustody: 0xC12D450f482c875F8673a60f536c1A2d6eA1232E
- MockBitgetVault (AP): 0xB4daA64068Ec9d9aaF7EF30017665107De099594
- SETTLEMENT_USDC: 0xE1DE28c3Dc7E87132CEbd3F3f2DE466d24F0cC81
- BridgeProxy: 0xcC91e5800a5Fa61Cf01c1F95960141e9A4075c51
- OracleRegistry (Sonic): 0xBABE22b57d6a7b34d0fab09F67807d976a35aFC3

**Critical fixes made:**
1. L3-native orders now process normally (were blocked, then unblocked)
2. Settlement contracts redeployed to Sonic (were pointing to dead Anvil)
3. Oracle Dockerfile changed to multi-stage (compiles from source, not stale binary)
4. Sonic proxy runs as Docker container with restart:always
5. Follower oracles clear mirror_sync_first after grace period
6. BLS snapshot refresh added to testnet.sh cmd_start
7. ORACLE_MIRROR_REGISTRY_ADDRESS removed from env override (reads from deployment.json)
8. Deploy scripts no longer pre-fund vault/custody (start at 0)
9. --settlement-custody flag added to oracle CLI in testnet.sh
10. itp-bot reads INDEX_ADDRESS from deployment.json via --deployment-file

**AP status (VPS 2):**
- Running and healthy on VPS 2 (index-maker/prod/postgres)
- Cannot connect to data-node SSE endpoint (doesn't exist)
- Zero orders processed — completely deaf
- **Next task: implement SSE chain-events endpoint in data-node**

**How to apply:** Before any deploy, read this to understand the settlement infrastructure state. The AP SSE integration is the next critical blocker.
