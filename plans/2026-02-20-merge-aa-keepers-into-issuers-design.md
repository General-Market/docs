# Merge AA Keepers into Index Issuers — Design

**Date**: 2026-02-20
**Status**: Approved
**Session**: 20260220-1500-k7m3

## Goal

The 20-node issuer network gains betting arbitration as an additional responsibility. The AA keeper binary is eliminated. All AA domain logic (bilateral resolution, portfolio scoring, arbitration listening, market data for exit prices) is adapted to Index patterns and infrastructure.

## Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Merger approach | Modular subsystem (`issuer/src/arbitration/`) | Clean separation, testable independently, minimal disruption to existing issuer |
| Cycle integration | Separate async task | Arbitration is event-driven (30s polling), doesn't block 1s trading cycle |
| BLS implementation | Delete AA's `bls_bn254.rs`, use `common/src/bls/` | Index's is modular, Solidity-compatible, already proven |
| P2P transport | Delete AA's HTTP API, use Index's TCP+TLS+MessagePack | Production-grade encryption, persistent connections, existing message routing |
| Signature threshold | Configurable, default 2 (upgradable, not hardcoded) | Start with 2-of-N for parity with AA, upgrade path to higher threshold |
| AA contracts | Keep CollateralVault, new resolution contract using IssuerRegistry BLS | Hybrid — vault logic unchanged, verification aligned with Index |
| Market data | Query data-node REST API (already merged) | AA market data providers already in data-node |

## Architecture

```
issuer binary
├── Existing: 1-second trading cycle (ITP orders, netting, fills, bridging)
├── NEW: Arbitration subsystem (async, event-driven)
│   ├── Listens for ArbitrationRequested events from CollateralVault
│   ├── Runs independent consensus rounds per bet (not tied to cycle)
│   ├── Uses Index's P2P (TCP+TLS+MessagePack) for arbitration messages
│   ├── Uses common/src/bls/ for signing
│   ├── Fetches exit prices from data-node /market/prices/* endpoints
│   └── Submits resolution via ChainWriter to ArbitrationSettlement contract
└── Shared: BLS keys, P2P transport, chain reader/writer, config
```

## New P2P Message Types

Added to `common/src/types/p2p.rs` `P2PMessage` enum:

```rust
ArbitrationPriceProposal {
    bet_id: U256,
    prices: Vec<ArbitrationTradePrice>,  // trade_index, symbol, exit_price
    timestamp: u64,
    proposer_signature: BLSSignature,
}
ArbitrationPriceVote {
    bet_id: U256,
    accept: bool,
    voter_signature: BLSSignature,
}
ArbitrationResolutionSign {
    bet_id: U256,
    outcome_hash: H256,  // keccak256(abi.encode(betId, winner))
    signer_signature: BLSSignature,
}
```

Dispatched by `ConsensusMessageHandler` to the arbitration subsystem.

## Module Structure

```
issuer/src/arbitration/
├── mod.rs              — ArbitrationSubsystem (spawns listener + processor)
├── listener.rs         — ArbitrationListener (polls CollateralVault events)
├── processor.rs        — ArbitrationProcessor (runs consensus per bet)
├── consensus.rs        — 4-phase consensus (adapted from AA, uses Index P2P)
├── resolution.rs       — BilateralResolution + PortfolioResolution (integer math)
├── types.rs            — ArbitrationRequest, TradePrice, ConsensusResult
└── market_data.rs      — DataNodePriceFetcher (queries data-node REST API)
```

### Migration Map (AA → Index)

| AA Source | Index Destination | Adaptation |
|-----------|-------------------|------------|
| `bls_bn254.rs` | **DELETED** — use `common/src/bls/` | Remove `tiny_keccak`, adopt `ethers` keccak |
| `bilateral_resolution.rs` | `arbitration/resolution.rs` | Keep integer math, adapt error types |
| `voter.rs` (portfolio scoring) | `arbitration/resolution.rs` | Merge into same module |
| `arbitration_listener.rs` | `arbitration/listener.rs` | Replace ethers polling with ChainReader |
| `consensus/protocol.rs` | `arbitration/consensus.rs` | Replace HTTP calls with P2P message sends |
| `consensus/aggregator.rs` | Reuse `consensus/aggregator.rs` | Use existing Index aggregator, configurable threshold |
| `chain/submitter.rs` | Use Index's `ChainWriter` | Add `settle_bet()` method |
| `chain/nonce.rs` | **DELETED** — use Index's | Already exists |
| `chain/retry.rs` | **DELETED** — use Index's | Already exists |
| `http_api.rs` | **DELETED** | Replaced by P2P message variants |
| `heartbeat/` | **DELETED** | Index's existing heartbeat |
| `config.rs` | Merged into issuer config | New `[arbitration]` section |
| `rpc.rs`, `discovery.rs` | **DELETED** | Index's chain reader + peer discovery |
| `backend_client.rs` | `arbitration/market_data.rs` | Query data-node REST API instead |

## New Solidity Contract: ArbitrationSettlement

Replaces `ResolutionDAOVoting`. Uses `IssuerRegistry` for BLS verification.

```solidity
contract ArbitrationSettlement {
    IssuerRegistry public issuerRegistry;
    CollateralVault public collateralVault;
    uint256 public signatureThreshold;  // configurable, default 2

    function settleBet(
        uint256 betId,
        bool creatorWins,
        bytes calldata aggregatedSignature,  // G1 point (64 bytes)
        uint256 signerBitmap                  // bit i = issuer i signed
    ) external {
        // 1. Verify popcount(signerBitmap) >= signatureThreshold
        // 2. Compute aggregated pubkey from IssuerRegistry for set bits
        // 3. Verify BLS pairing: e(sig, G2) == e(H(betId||winner), aggPubkey)
        // 4. Call collateralVault.settleBet(betId, creatorWins)
    }

    function setThreshold(uint256 newThreshold) external onlyGovernance {
        signatureThreshold = newThreshold;
    }
}
```

## Data Flow (End-to-End)

```
User requests arbitration on CollateralVault
    ↓
[ArbitrationListener] polls CollateralVault events via ChainReader
    ↓
[ArbitrationProcessor] spawns consensus round
    ↓
Phase 1: Leader fetches exit prices from data-node (/market/prices/*)
         Broadcasts ArbitrationPriceProposal via P2P
    ↓
Phase 2: Followers validate prices against own data-node query
         Send ArbitrationPriceVote via P2P
    ↓
Phase 3: If accepted (threshold votes), each signs keccak256(betId, winner)
         Send ArbitrationResolutionSign via P2P
    ↓
Phase 4: Aggregate BLS signatures (threshold = configurable, default 2)
         Submit via ChainWriter → ArbitrationSettlement.settleBet()
    ↓
On-chain: IssuerRegistry BLS verification → CollateralVault settlement
```

## Configuration Additions

New fields in issuer config:

```yaml
arbitration:
  enabled: true
  collateral_vault_address: "0x..."
  settlement_contract_address: "0x..."
  signature_threshold: 2            # configurable, default 2
  poll_interval_secs: 30
  consensus_timeout_ms: 1100        # 500 + 300 + 300
  data_node_url: "http://localhost:8200"
  price_tolerance_bps: 50           # 0.5% price deviation tolerance
```

New env vars:
```
ARBITRATION_ENABLED=true
ARBITRATION_COLLATERAL_VAULT=0x...
ARBITRATION_SETTLEMENT_CONTRACT=0x...
ARBITRATION_THRESHOLD=2
ARBITRATION_POLL_INTERVAL=30
ARBITRATION_DATA_NODE_URL=http://localhost:8200
```

## What Gets Deleted

After merger, `AA/keeper/` becomes dead code:
- All `keeper/src/` — replaced by `issuer/src/arbitration/`
- `keeper/Cargo.toml` — dependencies absorbed into issuer/common
- Contract `ResolutionDAOVoting` — replaced by `ArbitrationSettlement`
- Contract `KeeperRegistry` — replaced by `IssuerRegistry`
- Contract `ResolutionDAO` (keeper discovery) — no longer needed

**Preserved:** `CollateralVault` contract (unchanged).

## Threshold Configuration

The signature threshold is **not hardcoded**:
- Stored on-chain in `ArbitrationSettlement.signatureThreshold`
- Configurable via governance (`setThreshold()`)
- Issuer config mirrors it for local validation
- Default: 2 (current AA parity)
- Future: upgradable to higher values (e.g., 11/20) via governance
