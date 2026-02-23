// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title VisionMerkleProof
/// @notice Merkle tree verification for P2P trade resolution
/// @dev Story 15-1: Supports up to 1M trades (depth ~20)
///      Uses sorted hash pairs for consistency with off-chain TypeScript implementation
///      Renamed from MerkleProof to avoid OpenZeppelin collision
/// @custom:security-contact security@indexprotocol.com
library VisionMerkleProof {
    // ============================================================================
    // Trade Structs
    // ============================================================================

    /// @notice Trade data structure matching off-chain format
    struct Trade {
        bytes32 tradeId;      // keccak256(snapshotId, index)
        string ticker;        // e.g., "BTC", "ETH", "AAPL"
        string source;        // "coingecko", "stocks", "polymarket"
        string method;        // "price", "binary", "drop30", "drop80", "pump2x", "pump10x"
        uint8 position;       // 0=LONG/YES, 1=SHORT/NO
        uint256 entryPrice;   // Price at bet creation (18 decimals)
        uint256 exitPrice;    // Price at resolution (18 decimals, 0 until resolved)
        bool won;             // Outcome (false until resolved)
        bool cancelled;       // Invalid trade (bad data)
    }

    /// @notice Trade outcome for resolution
    struct TradeOutcome {
        bytes32 tradeId;
        uint256 exitPrice;
        bool won;
        bool cancelled;
    }

    // ============================================================================
    // Proof Verification
    // ============================================================================

    /// @notice Verify a Merkle proof
    /// @param leaf The leaf hash to verify
    /// @param proof Array of sibling hashes from leaf to root
    /// @param index The index of the leaf in the original tree
    /// @param root The expected Merkle root
    /// @return True if proof is valid
    function verify(
        bytes32 leaf,
        bytes32[] memory proof,
        uint256 index,
        bytes32 root
    ) internal pure returns (bool) {
        bytes32 hash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 sibling = proof[i];

            // Hash with sorted ordering to match off-chain implementation
            if (index % 2 == 0) {
                hash = hashPairSorted(hash, sibling);
            } else {
                hash = hashPairSorted(sibling, hash);
            }

            index = index / 2;
        }

        return hash == root;
    }

    /// @notice Verify multiple proofs efficiently
    /// @param leaves Array of leaf hashes
    /// @param proofs Array of proof arrays (one per leaf)
    /// @param indices Array of leaf indices
    /// @param root The expected Merkle root
    /// @return True if all proofs are valid
    function verifyMultiple(
        bytes32[] memory leaves,
        bytes32[][] memory proofs,
        uint256[] memory indices,
        bytes32 root
    ) internal pure returns (bool) {
        require(leaves.length == proofs.length, "VisionMerkleProof: length mismatch");
        require(leaves.length == indices.length, "VisionMerkleProof: length mismatch");

        for (uint256 i = 0; i < leaves.length; i++) {
            if (!verify(leaves[i], proofs[i], indices[i], root)) {
                return false;
            }
        }

        return true;
    }

    // ============================================================================
    // Trade Hashing
    // ============================================================================

    /// @notice Hash a trade to create a Merkle leaf
    /// @dev Must match off-chain TypeScript hashTrade() exactly
    function hashTrade(Trade memory trade) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                trade.tradeId,
                trade.ticker,
                trade.source,
                trade.method,
                trade.position,
                trade.entryPrice,
                trade.exitPrice,
                trade.won,
                trade.cancelled
            )
        );
    }

    /// @notice Generate trade ID from snapshot and index
    /// @dev Must match off-chain TypeScript generateTradeId() exactly
    function generateTradeId(
        string memory snapshotId,
        uint256 index
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(snapshotId, index));
    }

    // ============================================================================
    // Root Computation
    // ============================================================================

    /// @notice Compute Merkle root from leaves
    /// @dev Used for on-chain verification when all leaves are provided
    /// @param leaves Array of leaf hashes
    /// @return Merkle root
    function computeRoot(bytes32[] memory leaves) internal pure returns (bytes32) {
        if (leaves.length == 0) {
            return keccak256("");
        }

        // Pad to power of 2 (minimum 2)
        uint256 targetSize = nextPowerOf2(leaves.length);
        bytes32[] memory level = new bytes32[](targetSize);

        // Copy leaves
        for (uint256 i = 0; i < leaves.length; i++) {
            level[i] = leaves[i];
        }

        // Pad with empty leaf hash
        bytes32 emptyLeaf = keccak256("");
        for (uint256 i = leaves.length; i < targetSize; i++) {
            level[i] = emptyLeaf;
        }

        // Build tree level by level
        while (level.length > 1) {
            uint256 nextLevelSize = level.length / 2;
            bytes32[] memory nextLevel = new bytes32[](nextLevelSize);

            for (uint256 i = 0; i < nextLevelSize; i++) {
                nextLevel[i] = hashPairSorted(level[i * 2], level[i * 2 + 1]);
            }

            level = nextLevel;
        }

        return level[0];
    }

    // ============================================================================
    // Resolution Helpers
    // ============================================================================

    /// @notice Compute trade outcome based on entry/exit prices
    /// @param trade The trade with entry price
    /// @param exitPrice Exit price at resolution
    /// @return outcome The computed trade outcome
    function resolveTradeOutcome(
        Trade memory trade,
        uint256 exitPrice
    ) internal pure returns (TradeOutcome memory outcome) {
        outcome.tradeId = trade.tradeId;
        outcome.exitPrice = exitPrice;

        // Invalid data = cancelled
        if (exitPrice == 0) {
            outcome.won = false;
            outcome.cancelled = true;
            return outcome;
        }

        // Zero entry for percentage-based methods = cancelled
        bytes32 methodHash = keccak256(bytes(trade.method));
        if (trade.entryPrice == 0 && (
            methodHash == keccak256("drop30") ||
            methodHash == keccak256("drop80") ||
            methodHash == keccak256("pump2x") ||
            methodHash == keccak256("pump10x")
        )) {
            outcome.won = false;
            outcome.cancelled = true;
            return outcome;
        }

        // Entry equals exit = cancelled (no price movement)
        if (trade.entryPrice == exitPrice) {
            outcome.won = false;
            outcome.cancelled = true;
            return outcome;
        }

        // Compute condition based on method
        bool conditionMet;

        if (methodHash == keccak256("price")) {
            conditionMet = exitPrice > trade.entryPrice;
        } else if (methodHash == keccak256("binary")) {
            conditionMet = exitPrice == 1e18; // 1.0 with 18 decimals
        } else if (methodHash == keccak256("drop30")) {
            conditionMet = calculateDropPercent(trade.entryPrice, exitPrice) >= 30;
        } else if (methodHash == keccak256("drop80")) {
            conditionMet = calculateDropPercent(trade.entryPrice, exitPrice) >= 80;
        } else if (methodHash == keccak256("pump2x")) {
            conditionMet = exitPrice >= trade.entryPrice * 2;
        } else if (methodHash == keccak256("pump10x")) {
            conditionMet = exitPrice >= trade.entryPrice * 10;
        } else {
            // Unknown method = cancelled
            outcome.won = false;
            outcome.cancelled = true;
            return outcome;
        }

        // LONG/YES (0) wins if condition met, SHORT/NO (1) wins if condition not met
        outcome.won = trade.position == 0 ? conditionMet : !conditionMet;
        outcome.cancelled = false;

        return outcome;
    }

    // ============================================================================
    // Internal Helpers
    // ============================================================================

    /// @notice Hash two nodes with sorted ordering for consistency
    /// @dev Smaller hash goes first to ensure deterministic results
    function hashPairSorted(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        if (a < b) {
            return keccak256(abi.encode(a, b));
        } else {
            return keccak256(abi.encode(b, a));
        }
    }

    /// @notice Calculate drop percentage: (entry - exit) / entry * 100
    function calculateDropPercent(uint256 entry, uint256 exit) internal pure returns (uint256) {
        if (entry == 0) return 0;
        if (exit >= entry) return 0; // No drop
        return ((entry - exit) * 100) / entry;
    }

    /// @notice Get next power of 2 >= n (minimum 2)
    function nextPowerOf2(uint256 n) internal pure returns (uint256) {
        if (n <= 2) return 2;

        n--;
        n |= n >> 1;
        n |= n >> 2;
        n |= n >> 4;
        n |= n >> 8;
        n |= n >> 16;
        n |= n >> 32;
        n |= n >> 64;
        n |= n >> 128;
        n++;

        return n;
    }
}
