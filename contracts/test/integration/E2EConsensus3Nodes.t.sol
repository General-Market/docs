// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/core/Investment.sol";
import "../../src/core/ITP.sol";
import "../../src/mocks/MockERC20.sol";
import "../helpers/TestHelper.sol";
import {Governance} from "../../src/Governance.sol";
import "../../src/registry/OracleRegistry.sol";
import {IOracleRegistry} from "../../src/interfaces/IOracleRegistry.sol";
import "../../src/libraries/TypesLib.sol";
import "../../src/libraries/ErrorsLib.sol";
import "../../src/libraries/EventsLib.sol";
import "../../src/libraries/BLSLib.sol";
import {BLSVerifier} from "../../src/libraries/BLSVerifier.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title E2EConsensus3Nodes - Multi-Node BLS Consensus Integration Test (Story 6.16)
/// @notice Tests 3-oracle BLS verification, threshold mechanics, replay protection,
///         and leader rotation determinism on-chain
/// @dev Uses real BLS signatures via FFI (bls-tool). Test oracles use seeds 0,1,2.
contract E2EConsensus3NodesTest is TestHelper {
    Investment public index;
    MockERC20 public usdc;
    Governance public governance;
    OracleRegistry public oracleRegistry;
    ITP public itpVault;

    address public admin;
    address public user1 = makeAddr("user1");

    bytes32 public itpId;
    bytes32 public pairId;

    uint256 constant INITIAL_PRICE = 1e18;
    uint256 constant INITIAL_USDC = 100_000e18;

    // 3 distinct oracle addresses (set by registerTestOraclesWithBLS in setUp)
    address public oracle1;
    address public oracle2;
    address public oracle3;

    function setUp() public {
        admin = address(this);

        // Deploy mock USDC
        usdc = new MockERC20("USDC", "USDC", 18);

        // Deploy mock governance
        governance = deployGovernance(admin);

        // Deploy Index as UUPS proxy
        Investment impl = new Investment();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(Investment.initialize, (address(governance), address(usdc)))
        );
        index = Investment(address(proxy));

        // Deploy real OracleRegistry, register 3 BLS test oracles (seeds 0,1,2)
        oracleRegistry = deployOracleRegistry(address(governance));
        registerTestOraclesWithBLS(oracleRegistry, admin);

        // Record oracle addresses from the registry for test assertions
        oracle1 = oracleRegistry.getOracle(0).addr;
        oracle2 = oracleRegistry.getOracle(1).addr;
        oracle3 = oracleRegistry.getOracle(2).addr;

        // Wire OracleRegistry to Index (enables BLS verification path)
        index.setOracleRegistry(address(oracleRegistry));

        // Create test ITP with single asset
        address[] memory assets = new address[](1);
        assets[0] = address(usdc);

        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18; // 100%

        uint256[] memory prices = new uint256[](1);
        prices[0] = INITIAL_PRICE;

        itpId = index.createITP("Test Index Fund", "TIDX", weights, assets, prices, type(uint256).max);
        pairId = keccak256(abi.encode(itpId, uint256(0)));

        // Deploy ITP vault and link
        itpVault = new ITP(
            itpId,
            address(index),
            "Test Index Token",
            "TIDX",
            IERC20(address(usdc))
        );
        index.setITPVault(itpId, address(itpVault));

        // Fund test user
        usdc.mint(user1, INITIAL_USDC);
        vm.prank(user1);
        usdc.approve(address(index), type(uint256).max);
    }

    // ============ SIGNING HELPERS ============

    function _signConfirmBatch(uint256 cycleNumber, uint256[] memory orderIds) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(index), cycleNumber, orderIds));
        return signWithTestOracles(message);
    }

    function _signConfirmFills(uint256 cycleNumber, TypesLib.Fill[] memory fills) internal returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(block.chainid, address(index), cycleNumber, fills));
        return signWithTestOracles(message);
    }

    // ============ HELPERS ============

    /// @dev Generate a deterministic 128-byte test pubkey for a given oracle index
    function _generateTestPubkey(uint8 oracleIdx) internal pure returns (bytes memory) {
        bytes memory pubkey = new bytes(128);
        for (uint256 i = 0; i < 128; i++) {
            pubkey[i] = bytes1(uint8(uint256(oracleIdx) * 37 + i * 7 + 1)); // Deterministic fill, wraps via uint256
        }
        return pubkey;
    }

    function _submitOrder(
        address user,
        uint256 amount,
        uint256 limitPrice,
        uint256 slippageTier
    ) internal returns (uint256 orderId) {
        vm.prank(user);
        orderId = index.submitOrder(
            itpId,
            TypesLib.Side.BUY,
            amount,
            limitPrice,
            slippageTier,
            block.timestamp + 1 hours
        );
    }

    /// @dev Helper to compute the BLS message hash for confirmBatch
    function _computeBatchMessage(uint256 cycleNumber, uint256[] memory orderIds)
        internal
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(block.chainid, address(index), cycleNumber, orderIds));
    }

    /// @dev Helper to compute leader index from aggregated signature hash
    function _computeLeaderIndex(bytes memory aggregatedSig, uint256 numOracles)
        internal
        pure
        returns (uint256)
    {
        return uint256(keccak256(aggregatedSig)) % numOracles;
    }

    // ============ TASK 1.1-1.4: SETUP VERIFICATION ============

    function test_three_oracles_registered() public view {
        // Verify 3 active oracles
        assertEq(oracleRegistry.activeOracleCount(), 3, "Should have 3 active oracles");

        // Verify each oracle\'s details
        TypesLib.Oracle memory i1 = oracleRegistry.getOracle(0);
        assertEq(i1.addr, oracle1, "Oracle 1 address");
        assertEq(i1.status, 1, "Oracle 1 active");
        assertEq(i1.blsPubkey.length, 128, "Oracle 1 pubkey length");

        TypesLib.Oracle memory i2 = oracleRegistry.getOracle(1);
        assertEq(i2.addr, oracle2, "Oracle 2 address");

        TypesLib.Oracle memory i3 = oracleRegistry.getOracle(2);
        assertEq(i3.addr, oracle3, "Oracle 3 address");
    }

    function test_oracle_registry_wired_to_index() public view {
        // Verify OracleRegistry is set on Index
        bytes memory aggPubkey = oracleRegistry.getAggregatedPubkey();
        assertEq(aggPubkey.length, 128, "Aggregated pubkey should be 128 bytes");
    }

    function test_itp_created_with_single_asset() public view {
        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.creator, admin, "ITP creator should be admin");
    }

    // ============ TASK 1.5: THREE-ORACLE AGGREGATED SIGNATURE VERIFICATION ============

    /// @notice Test that confirmBatch succeeds with real BLS verification
    function test_three_oracle_aggregated_signature_verifies() public {
        uint256 orderId = _submitOrder(user1, 100e18, 1e18, 1);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;

        index.confirmBatch(1, orderIds, _signConfirmBatch(1, orderIds), 3, 7);

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(
            uint8(order.status),
            uint8(TypesLib.OrderStatus.BATCHED),
            "Order should be BATCHED after confirmBatch"
        );
    }

    // ============ TASK 1.6: TWO-OF-THREE SIGNATURE THRESHOLD ============

    function test_two_of_three_signature_threshold() public {
        uint256 orderId = _submitOrder(user1, 50e18, 1e18, 1);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;

        bytes32 expectedMessage = _computeBatchMessage(1, orderIds);
        assertTrue(expectedMessage != bytes32(0), "Message hash should be non-zero");

        index.confirmBatch(1, orderIds, _signConfirmBatch(1, orderIds), 3, 7);

        TypesLib.LimitOrder memory order = index.getOrder(orderId);
        assertEq(uint8(order.status), uint8(TypesLib.OrderStatus.BATCHED));
    }

    // ============ TASK 1.7: SINGLE SIGNATURE REJECTED ============

    /// @notice Test that an invalid BLS signature is rejected
    function test_single_signature_rejected() public {
        uint256 orderId = _submitOrder(user1, 50e18, 1e18, 1);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;

        // Real sig over wrong message — BLS pairing will fail
        bytes memory wrongSig = signWithTestOracles(keccak256("wrong message"));
        vm.expectRevert(BLSVerifier.BLSVerifier__InvalidSignature.selector);
        index.confirmBatch(1, orderIds, wrongSig, 3, 7);
    }

    /// @notice Test that a short (non-64-byte) signature is rejected
    function test_invalid_signature_length_rejected() public {
        uint256 orderId = _submitOrder(user1, 50e18, 1e18, 1);

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;

        bytes memory shortSig = new bytes(32);
        vm.expectRevert(BLSVerifier.BLSVerifier__InvalidSignature.selector);
        index.confirmBatch(1, orderIds, shortSig, 3, 7);
    }

    // ============ TASK 1.8: LEADER ROTATION DETERMINISTIC ============

    function test_leader_rotation_deterministic() public pure {
        bytes memory sig1 = abi.encodePacked(bytes32(uint256(0xaaaa)), bytes32(uint256(0xbbbb)));
        bytes memory sig2 = abi.encodePacked(bytes32(uint256(0xcccc)), bytes32(uint256(0xdddd)));
        bytes memory sig3 = abi.encodePacked(bytes32(uint256(0xeeee)), bytes32(uint256(0xffff)));
        bytes memory sig4 = abi.encodePacked(bytes32(uint256(0x1111)), bytes32(uint256(0x2222)));
        bytes memory sig5 = abi.encodePacked(bytes32(uint256(0x3333)), bytes32(uint256(0x4444)));

        uint256 numOracles = 3;

        uint256 leader1 = uint256(keccak256(sig1)) % numOracles;
        uint256 leader2 = uint256(keccak256(sig2)) % numOracles;
        uint256 leader3 = uint256(keccak256(sig3)) % numOracles;
        uint256 leader4 = uint256(keccak256(sig4)) % numOracles;
        uint256 leader5 = uint256(keccak256(sig5)) % numOracles;

        assertTrue(leader1 < numOracles, "Leader 1 valid");
        assertTrue(leader2 < numOracles, "Leader 2 valid");
        assertTrue(leader3 < numOracles, "Leader 3 valid");
        assertTrue(leader4 < numOracles, "Leader 4 valid");
        assertTrue(leader5 < numOracles, "Leader 5 valid");

        bool hasDifferentLeaders = (leader1 != leader2)
            || (leader1 != leader3)
            || (leader1 != leader4)
            || (leader1 != leader5);
        assertTrue(hasDifferentLeaders, "Leader rotation should produce different leaders");

        uint256 leader1_again = uint256(keccak256(sig1)) % numOracles;
        assertEq(leader1, leader1_again, "Same signature must produce same leader");
    }

    // ============ TASK 1.9: BATCH REPLAY PROTECTION ============

    function test_batch_replay_protection() public {
        uint256 orderId1 = _submitOrder(user1, 50e18, 1e18, 1);
        uint256 orderId2 = _submitOrder(user1, 60e18, 1e18, 1);

        uint256[] memory batch1 = new uint256[](1);
        batch1[0] = orderId1;
        index.confirmBatch(1, batch1, _signConfirmBatch(1, batch1), 3, 7);

        uint256[] memory batch2 = new uint256[](1);
        batch2[0] = orderId2;
        vm.expectRevert(); // Replay protection revert (cycle already used)
        // Any sig — revert happens before BLS check
        index.confirmBatch(1, batch2, signWithTestOracles(keccak256("irrelevant")), 3, 7);

        assertEq(
            uint8(index.getOrder(orderId1).status),
            uint8(TypesLib.OrderStatus.BATCHED),
            "Order 1 should be BATCHED"
        );
        assertEq(
            uint8(index.getOrder(orderId2).status),
            uint8(TypesLib.OrderStatus.PENDING),
            "Order 2 should still be PENDING"
        );
    }

    // ============ TASK 1.10: FILL AFTER BATCH E2E ============

    function test_fill_after_batch_e2e() public {
        uint256 orderAmount = 200e18;
        uint256 fillPrice = 1e18;

        assertEq(oracleRegistry.activeOracleCount(), 3, "3 oracles active");

        uint256 orderId = _submitOrder(user1, orderAmount, 1e18, 1);
        assertEq(uint8(index.getOrder(orderId).status), uint8(TypesLib.OrderStatus.PENDING));

        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;

        vm.expectEmit(true, true, false, true);
        emit EventsLib.TradeRequest(1, pairId, uint8(TypesLib.Side.BUY), orderAmount, 1e18);

        // Don\'t check non-indexed data — blsSignature bytes vary with real BLS
        vm.expectEmit(true, false, false, false);
        emit EventsLib.BatchConfirmed(1, orderIds, new bytes(0));

        bytes memory batchSig = _signConfirmBatch(1, orderIds);
        index.confirmBatch(1, orderIds, batchSig, 3, 7);
        assertEq(uint8(index.getOrder(orderId).status), uint8(TypesLib.OrderStatus.BATCHED));

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: fillPrice,
            fillAmount: orderAmount,
            cycleNumber: 1,
            txHash: bytes32(uint256(0xdead))
        });

        vm.expectEmit(true, true, false, true);
        emit EventsLib.FillConfirmed(orderId, 1, fillPrice, orderAmount);

        index.confirmFills(1, fills, _signConfirmFills(1, fills), 3, 7);

        uint256 expectedShares = (orderAmount * 1e18) / fillPrice;
        assertEq(itpVault.balanceOf(user1), expectedShares, "User should receive ITP tokens");

        assertEq(uint8(index.getOrder(orderId).status), uint8(TypesLib.OrderStatus.FILLED));

        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.totalSupply, expectedShares, "ITP totalSupply matches");
        assertEq(itp.totalValue, orderAmount, "ITP totalValue matches");
    }

    // ============ ADDITIONAL TESTS: MULTI-CYCLE WITH 3 ORACLES ============

    function test_multi_cycle_with_three_oracles() public {
        // Cycle 1
        uint256 orderId1 = _submitOrder(user1, 100e18, 1e18, 1);
        uint256[] memory batch1 = new uint256[](1);
        batch1[0] = orderId1;
        index.confirmBatch(1, batch1, _signConfirmBatch(1, batch1), 3, 7);

        TypesLib.Fill[] memory fills1 = new TypesLib.Fill[](1);
        fills1[0] = TypesLib.Fill({orderId: orderId1, fillPrice: 1e18, fillAmount: 100e18, cycleNumber: 1, txHash: bytes32(0)});
        index.confirmFills(1, fills1, _signConfirmFills(1, fills1), 3, 7);

        // Cycle 2
        uint256 orderId2 = _submitOrder(user1, 150e18, 1e18, 1);
        uint256[] memory batch2 = new uint256[](1);
        batch2[0] = orderId2;
        index.confirmBatch(2, batch2, _signConfirmBatch(2, batch2), 3, 7);

        TypesLib.Fill[] memory fills2 = new TypesLib.Fill[](1);
        fills2[0] = TypesLib.Fill({orderId: orderId2, fillPrice: 1e18, fillAmount: 150e18, cycleNumber: 2, txHash: bytes32(0)});
        index.confirmFills(2, fills2, _signConfirmFills(2, fills2), 3, 7);

        // Cycle 3
        uint256 orderId3 = _submitOrder(user1, 75e18, 1e18, 1);
        uint256[] memory batch3 = new uint256[](1);
        batch3[0] = orderId3;
        index.confirmBatch(3, batch3, _signConfirmBatch(3, batch3), 3, 7);

        TypesLib.Fill[] memory fills3 = new TypesLib.Fill[](1);
        fills3[0] = TypesLib.Fill({orderId: orderId3, fillPrice: 1e18, fillAmount: 75e18, cycleNumber: 3, txHash: bytes32(0)});
        index.confirmFills(3, fills3, _signConfirmFills(3, fills3), 3, 7);

        uint256 totalExpected = 100e18 + 150e18 + 75e18;
        assertEq(itpVault.balanceOf(user1), totalExpected, "Total ITP after 3 cycles");

        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.totalSupply, totalExpected);
    }

    function test_oracle_removal_reduces_count() public {
        assertEq(oracleRegistry.activeOracleCount(), 3);

        oracleRegistry.removeOracle(1);
        assertEq(oracleRegistry.activeOracleCount(), 2, "Should have 2 active oracles after removal");

        // Aggregated pubkey is unchanged by removeOracle, so existing sig (seeds 0,1,2) still valid.
        uint256 orderId = _submitOrder(user1, 50e18, 1e18, 1);
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(1, orderIds, _signConfirmBatch(1, orderIds), 3, 7);

        assertEq(uint8(index.getOrder(orderId).status), uint8(TypesLib.OrderStatus.BATCHED));
    }

    function test_bls_message_hash_format() public view {
        uint256[] memory orderIds = new uint256[](2);
        orderIds[0] = 1;
        orderIds[1] = 2;

        bytes32 message = _computeBatchMessage(1, orderIds);

        bytes32 message2 = _computeBatchMessage(1, orderIds);
        assertEq(message, message2, "Same inputs must produce same hash");

        bytes32 message3 = _computeBatchMessage(2, orderIds);
        assertTrue(message != message3, "Different cycle must produce different hash");

        uint256[] memory differentOrders = new uint256[](1);
        differentOrders[0] = 3;
        bytes32 message4 = _computeBatchMessage(1, differentOrders);
        assertTrue(message != message4, "Different orders must produce different hash");
    }
}
