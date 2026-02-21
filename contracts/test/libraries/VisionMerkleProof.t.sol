// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { VisionMerkleProof } from "../../src/libraries/VisionMerkleProof.sol";

/// @title VisionMerkleProof Tests
/// @notice Tests for Merkle tree verification matching TypeScript implementation
contract VisionMerkleProofTest is Test {
    // ============================================================================
    // Trade Hashing Tests
    // ============================================================================

    function test_generateTradeId_consistent() public pure {
        bytes32 id1 = VisionMerkleProof.generateTradeId("snapshot-123", 0);
        bytes32 id2 = VisionMerkleProof.generateTradeId("snapshot-123", 0);
        bytes32 id3 = VisionMerkleProof.generateTradeId("snapshot-123", 1);

        assertEq(id1, id2, "Same inputs should produce same ID");
        assertTrue(id1 != id3, "Different inputs should produce different IDs");
    }

    function test_hashTrade_deterministic() public pure {
        VisionMerkleProof.Trade memory trade = _createTrade(0);

        bytes32 hash1 = VisionMerkleProof.hashTrade(trade);
        bytes32 hash2 = VisionMerkleProof.hashTrade(trade);

        assertEq(hash1, hash2, "Same trade should produce same hash");
    }

    function test_hashTrade_differentForDifferentTrades() public pure {
        VisionMerkleProof.Trade memory trade1 = _createTrade(0);
        VisionMerkleProof.Trade memory trade2 = _createTrade(1);

        bytes32 hash1 = VisionMerkleProof.hashTrade(trade1);
        bytes32 hash2 = VisionMerkleProof.hashTrade(trade2);

        assertTrue(hash1 != hash2, "Different trades should produce different hashes");
    }

    // ============================================================================
    // Proof Verification Tests
    // ============================================================================

    function test_verify_validProof() public pure {
        // Create 4 trades and build tree
        bytes32[] memory leaves = new bytes32[](4);
        for (uint256 i = 0; i < 4; i++) {
            leaves[i] = VisionMerkleProof.hashTrade(_createTrade(i));
        }

        bytes32 root = VisionMerkleProof.computeRoot(leaves);

        // Generate proof for leaf 0 (left-most)
        // In a 4-leaf tree: [L0, L1, L2, L3]
        // Level 1: [H(L0,L1), H(L2,L3)]
        // Level 2: root = H(H(L0,L1), H(L2,L3))
        // Proof for L0: [L1, H(L2,L3)]

        bytes32 sibling0 = leaves[1]; // Direct sibling
        bytes32 level1Right = VisionMerkleProof.hashPairSorted(leaves[2], leaves[3]);

        bytes32[] memory proof = new bytes32[](2);
        proof[0] = sibling0;
        proof[1] = level1Right;

        bool isValid = VisionMerkleProof.verify(leaves[0], proof, 0, root);
        assertTrue(isValid, "Valid proof should verify");
    }

    function test_verify_invalidProof() public pure {
        bytes32[] memory leaves = new bytes32[](4);
        for (uint256 i = 0; i < 4; i++) {
            leaves[i] = VisionMerkleProof.hashTrade(_createTrade(i));
        }

        bytes32 root = VisionMerkleProof.computeRoot(leaves);

        // Create invalid proof
        bytes32[] memory proof = new bytes32[](2);
        proof[0] = bytes32(uint256(1)); // Wrong sibling
        proof[1] = bytes32(uint256(2)); // Wrong sibling

        bool isValid = VisionMerkleProof.verify(leaves[0], proof, 0, root);
        assertFalse(isValid, "Invalid proof should not verify");
    }

    // ============================================================================
    // Root Computation Tests
    // ============================================================================

    function test_computeRoot_empty() public pure {
        bytes32[] memory leaves = new bytes32[](0);
        bytes32 root = VisionMerkleProof.computeRoot(leaves);

        assertEq(root, keccak256(""), "Empty tree should have empty leaf as root");
    }

    function test_computeRoot_singleLeaf() public pure {
        bytes32[] memory leaves = new bytes32[](1);
        leaves[0] = VisionMerkleProof.hashTrade(_createTrade(0));

        bytes32 root = VisionMerkleProof.computeRoot(leaves);

        // Single leaf padded to 2, hashed with empty
        bytes32 emptyLeaf = keccak256("");
        bytes32 expectedRoot = VisionMerkleProof.hashPairSorted(leaves[0], emptyLeaf);

        assertEq(root, expectedRoot, "Single leaf root should match expected");
    }

    function test_computeRoot_deterministic() public pure {
        bytes32[] memory leaves = new bytes32[](8);
        for (uint256 i = 0; i < 8; i++) {
            leaves[i] = VisionMerkleProof.hashTrade(_createTrade(i));
        }

        bytes32 root1 = VisionMerkleProof.computeRoot(leaves);
        bytes32 root2 = VisionMerkleProof.computeRoot(leaves);

        assertEq(root1, root2, "Same leaves should produce same root");
    }

    // ============================================================================
    // Resolution Tests
    // ============================================================================

    function test_resolveTradeOutcome_priceMethod_longWins() public pure {
        VisionMerkleProof.Trade memory trade = _createTrade(0);
        trade.method = "price";
        trade.position = 0; // LONG
        trade.entryPrice = 100e18;

        VisionMerkleProof.TradeOutcome memory outcome = VisionMerkleProof.resolveTradeOutcome(trade, 150e18);

        assertTrue(outcome.won, "LONG should win when exit > entry");
        assertFalse(outcome.cancelled, "Should not be cancelled");
    }

    function test_resolveTradeOutcome_priceMethod_longLoses() public pure {
        VisionMerkleProof.Trade memory trade = _createTrade(0);
        trade.method = "price";
        trade.position = 0; // LONG
        trade.entryPrice = 100e18;

        VisionMerkleProof.TradeOutcome memory outcome = VisionMerkleProof.resolveTradeOutcome(trade, 50e18);

        assertFalse(outcome.won, "LONG should lose when exit < entry");
        assertFalse(outcome.cancelled, "Should not be cancelled");
    }

    function test_resolveTradeOutcome_priceMethod_shortWins() public pure {
        VisionMerkleProof.Trade memory trade = _createTrade(0);
        trade.method = "price";
        trade.position = 1; // SHORT
        trade.entryPrice = 100e18;

        VisionMerkleProof.TradeOutcome memory outcome = VisionMerkleProof.resolveTradeOutcome(trade, 50e18);

        assertTrue(outcome.won, "SHORT should win when exit < entry");
    }

    function test_resolveTradeOutcome_cancelled_entryEqualsExit() public pure {
        VisionMerkleProof.Trade memory trade = _createTrade(0);
        trade.method = "price";
        trade.entryPrice = 100e18;

        VisionMerkleProof.TradeOutcome memory outcome = VisionMerkleProof.resolveTradeOutcome(trade, 100e18);

        assertTrue(outcome.cancelled, "Should be cancelled when entry == exit");
    }

    function test_resolveTradeOutcome_cancelled_zeroExit() public pure {
        VisionMerkleProof.Trade memory trade = _createTrade(0);

        VisionMerkleProof.TradeOutcome memory outcome = VisionMerkleProof.resolveTradeOutcome(trade, 0);

        assertTrue(outcome.cancelled, "Should be cancelled when exit is zero");
    }

    function test_resolveTradeOutcome_drop30() public pure {
        VisionMerkleProof.Trade memory trade = _createTrade(0);
        trade.method = "drop30";
        trade.position = 0; // YES (betting on 30% drop)
        trade.entryPrice = 100e18;

        // 35% drop (exit = 65)
        VisionMerkleProof.TradeOutcome memory outcome1 = VisionMerkleProof.resolveTradeOutcome(trade, 65e18);
        assertTrue(outcome1.won, "YES should win on 35% drop");

        // 20% drop (exit = 80)
        VisionMerkleProof.TradeOutcome memory outcome2 = VisionMerkleProof.resolveTradeOutcome(trade, 80e18);
        assertFalse(outcome2.won, "YES should lose on 20% drop");
    }

    function test_resolveTradeOutcome_pump2x() public pure {
        VisionMerkleProof.Trade memory trade = _createTrade(0);
        trade.method = "pump2x";
        trade.position = 0; // YES (betting on 2x pump)
        trade.entryPrice = 100e18;

        // 2.5x pump (exit = 250)
        VisionMerkleProof.TradeOutcome memory outcome1 = VisionMerkleProof.resolveTradeOutcome(trade, 250e18);
        assertTrue(outcome1.won, "YES should win on 2.5x pump");

        // 1.5x pump (exit = 150)
        VisionMerkleProof.TradeOutcome memory outcome2 = VisionMerkleProof.resolveTradeOutcome(trade, 150e18);
        assertFalse(outcome2.won, "YES should lose on 1.5x pump");
    }

    // ============================================================================
    // Helper Functions
    // ============================================================================

    function _createTrade(uint256 index) internal pure returns (VisionMerkleProof.Trade memory) {
        return VisionMerkleProof.Trade({
            tradeId: VisionMerkleProof.generateTradeId("test-snapshot", index),
            ticker: "BTC",
            source: "coingecko",
            method: "price",
            position: 0,
            entryPrice: 100e18 * (index + 1),
            exitPrice: 0,
            won: false,
            cancelled: false
        });
    }
}
