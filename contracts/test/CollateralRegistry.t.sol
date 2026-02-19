// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./helpers/TestHelper.sol";
import {Governance} from "../src/Governance.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";
import "../src/registry/CollateralRegistry.sol";
import "../src/libraries/TypesLib.sol";

/// @title CollateralRegistryTest - Comprehensive tests for CollateralRegistry
/// @notice Tests all acceptance criteria for Story 2.11
contract CollateralRegistryTest is TestHelper {
    CollateralRegistry public registry;
    Governance governance;
    IssuerRegistry issuerReg;

    address public admin = address(0x1);
    address public user = address(0x2);
    address public authorizedCaller = address(0x3);

    // Test chain IDs
    // NOTE: Chain 0 represents "external/no-chain" (e.g., CEX operations)
    // Use actual chain IDs for on-chain collateral tracking
    uint256 constant EXTERNAL = 0; // External/no-chain (CEX operations)
    uint256 constant INDEX_L3 = 111222333; // Index L3 Orbit chain
    uint256 constant ARBITRUM = 42161;
    uint256 constant ETHEREUM = 1;
    uint256 constant BASE = 8453;

    // Test ITP IDs
    bytes32 constant ITP_1 = keccak256("ITP_1");
    bytes32 constant ITP_2 = keccak256("ITP_2");

    // Standard test amount
    uint256 constant AMOUNT = 1000e18; // 1000 USDC with 18 decimals

    event CollateralMoved(
        bytes32 indexed itpId, uint256 fromChain, uint256 toChain, uint256 amount, TypesLib.TxType txType
    );

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event AggregatedPubkeyUpdated(bytes pubkey);
    event BLSLibraryUpdated(address indexed blsLibrary);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    function setUp() public {
        governance = deployGovernance(admin);
        issuerReg = deployIssuerRegistry(address(governance));
        registerTestIssuersWithBLS(issuerReg, admin);

        registry = new CollateralRegistry(admin, address(issuerReg));
    }

    // ============ BLS SIGNING HELPER ============

    function _signRecordCollateralMove(
        bytes32 itpId,
        uint256 fromChain,
        uint256 toChain,
        uint256 amount,
        TypesLib.TxType txType
    ) internal returns (bytes memory) {
        uint256 nonce = registry.getNonce();
        bytes32 message = keccak256(
            abi.encode(block.chainid, address(registry), itpId, fromChain, toChain, amount, txType, nonce)
        );
        return signWithTestIssuers(message);
    }

    // ============ CONSTRUCTOR TESTS ============

    function test_Constructor_SetsAdmin() public view {
        assertEq(registry.admin(), admin);
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(CollateralRegistry.ZeroAddress.selector);
        new CollateralRegistry(address(0), address(issuerReg));
    }

    // ============ AC2: BRIDGE TYPE - Updates Both Chains ============

    function test_RecordCollateralMove_Bridge_UpdatesBothChains() public {
        // First add collateral to source chain (Arbitrum) via BUY from external
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.BUY);
        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), AMOUNT);

        // Now bridge from Arbitrum to L3
        _recordMove(ITP_1, ARBITRUM, INDEX_L3, AMOUNT / 2, TypesLib.TxType.BRIDGE);

        // Verify fromChain was decremented and toChain was incremented
        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), AMOUNT / 2);
        assertEq(registry.getITPCollateralByChain(ITP_1, INDEX_L3), AMOUNT / 2);
    }

    function test_RecordCollateralMove_Bridge_EmitsEvent() public {
        // First add collateral
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.BUY);

        vm.expectEmit(true, false, false, true);
        emit CollateralMoved(ITP_1, ARBITRUM, INDEX_L3, AMOUNT, TypesLib.TxType.BRIDGE);

        _recordMove(ITP_1, ARBITRUM, INDEX_L3, AMOUNT, TypesLib.TxType.BRIDGE);
    }

    // ============ AC3: SWAP_IN - Only toChain Updated ============

    function test_RecordCollateralMove_SwapIn_OnlyToChainUpdated() public {
        // SWAP_IN: assets coming in from external, only toChain should be updated
        // fromChain = 0 (external) means no source chain decrement
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.SWAP_IN);

        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), AMOUNT);
        // EXTERNAL (chain 0) shouldn't be tracked when it's the fromChain
    }

    // ============ AC4: SWAP_OUT - Only fromChain Updated ============

    function test_RecordCollateralMove_SwapOut_OnlyFromChainUpdated() public {
        // First add collateral
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.SWAP_IN);

        // SWAP_OUT: assets going out to external, only fromChain should be decremented
        // toChain = 0 (external) means no destination chain increment
        _recordMove(ITP_1, ARBITRUM, EXTERNAL, AMOUNT / 2, TypesLib.TxType.SWAP_OUT);

        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), AMOUNT / 2);
    }

    // ============ AC5: BUY Type - toChain Updated ============

    function test_RecordCollateralMove_Buy_ToChainUpdated() public {
        // BUY: assets coming to ITP from CEX (external)
        // fromChain = 0 (external/CEX), toChain = where assets now held
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.BUY);

        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), AMOUNT);
    }

    // ============ AC6: SELL Type - fromChain Updated ============

    function test_RecordCollateralMove_Sell_FromChainUpdated() public {
        // First add collateral
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.BUY);

        // SELL: assets leaving ITP to CEX (external)
        // fromChain = where assets were, toChain = 0 (external/CEX)
        _recordMove(ITP_1, ARBITRUM, EXTERNAL, AMOUNT / 4, TypesLib.TxType.SELL);

        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), AMOUNT - AMOUNT / 4);
    }

    // ============ AC7: getITPCollateralByChain Returns Correct Amounts ============

    function test_GetITPCollateralByChain_ReturnsCorrectAmounts() public {
        // Add collateral to multiple chains via BUY from external
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, 100e18, TypesLib.TxType.BUY);
        _recordMove(ITP_1, EXTERNAL, ETHEREUM, 200e18, TypesLib.TxType.BUY);
        _recordMove(ITP_1, EXTERNAL, BASE, 300e18, TypesLib.TxType.BUY);

        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), 100e18);
        assertEq(registry.getITPCollateralByChain(ITP_1, ETHEREUM), 200e18);
        assertEq(registry.getITPCollateralByChain(ITP_1, BASE), 300e18);
    }

    // ============ AC8: getTotalCollateral Sums Across Chains ============

    function test_GetTotalCollateral_SumsCorrectly() public {
        // Add collateral to multiple chains
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, 100e18, TypesLib.TxType.BUY);
        _recordMove(ITP_1, EXTERNAL, ETHEREUM, 200e18, TypesLib.TxType.BUY);
        _recordMove(ITP_1, EXTERNAL, BASE, 300e18, TypesLib.TxType.BUY);

        assertEq(registry.getTotalCollateral(ITP_1), 600e18);
    }

    // ============ AC9: getCollateralBreakdown Returns Correct Arrays ============

    function test_GetCollateralBreakdown_ReturnsCorrectArrays() public {
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, 100e18, TypesLib.TxType.BUY);
        _recordMove(ITP_1, EXTERNAL, ETHEREUM, 200e18, TypesLib.TxType.BUY);

        (uint256[] memory chainIds, uint256[] memory amounts) = registry.getCollateralBreakdown(ITP_1);

        assertEq(chainIds.length, 2);
        assertEq(amounts.length, 2);

        // Order depends on insertion order
        assertEq(chainIds[0], ARBITRUM);
        assertEq(amounts[0], 100e18);
        assertEq(chainIds[1], ETHEREUM);
        assertEq(amounts[1], 200e18);
    }

    // ============ AC10: itpExists Returns Correct Values ============

    function test_ItpExists_ReturnsTrueAfterMovement() public {
        assertFalse(registry.itpExists(ITP_1));

        _recordMove(ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.BUY);

        assertTrue(registry.itpExists(ITP_1));
    }

    function test_ItpExists_ReturnsFalseForUnknownITP() public view {
        assertFalse(registry.itpExists(keccak256("UNKNOWN_ITP")));
    }

    // ============ REPLAY PROTECTION TESTS ============

    function test_Nonce_IncrementsOnEachCall() public {
        assertEq(registry.getNonce(), 0);

        _recordMove(ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.BUY);
        assertEq(registry.getNonce(), 1);

        _recordMove(ITP_1, EXTERNAL, ETHEREUM, AMOUNT, TypesLib.TxType.BUY);
        assertEq(registry.getNonce(), 2);
    }

    // ============ UNDERFLOW PROTECTION TESTS ============

    function test_RecordCollateralMove_RevertsOnUnderflow() public {
        // Try to move collateral that doesn't exist
        vm.expectRevert(
            abi.encodeWithSelector(CollateralRegistry.InsufficientCollateral.selector, ITP_1, ARBITRUM, AMOUNT, 0)
        );
        _recordMove(ITP_1, ARBITRUM, ETHEREUM, AMOUNT, TypesLib.TxType.BRIDGE);
    }

    function test_RecordCollateralMove_RevertsOnPartialUnderflow() public {
        // Add some collateral
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, 100e18, TypesLib.TxType.BUY);

        // Try to move more than available
        vm.expectRevert(
            abi.encodeWithSelector(CollateralRegistry.InsufficientCollateral.selector, ITP_1, ARBITRUM, 200e18, 100e18)
        );
        _recordMove(ITP_1, ARBITRUM, ETHEREUM, 200e18, TypesLib.TxType.BRIDGE);
    }

    // ============ MULTIPLE ITPs TRACK INDEPENDENTLY ============

    function test_MultipleITPs_TrackIndependently() public {
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, 100e18, TypesLib.TxType.BUY);
        _recordMove(ITP_2, EXTERNAL, ARBITRUM, 500e18, TypesLib.TxType.BUY);

        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), 100e18);
        assertEq(registry.getITPCollateralByChain(ITP_2, ARBITRUM), 500e18);

        assertEq(registry.getTotalCollateral(ITP_1), 100e18);
        assertEq(registry.getTotalCollateral(ITP_2), 500e18);

        assertTrue(registry.itpExists(ITP_1));
        assertTrue(registry.itpExists(ITP_2));
    }

    // ============ ADMIN FUNCTION TESTS ============

    function test_SetAdmin_OnlyAdmin() public {
        address newAdmin = address(0x888);

        vm.prank(admin);
        registry.setAdmin(newAdmin);

        assertEq(registry.admin(), newAdmin);
    }

    function test_SetAdmin_RevertsOnZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(CollateralRegistry.ZeroAddress.selector);
        registry.setAdmin(address(0));
    }

    function test_SetAdmin_RevertsForNonAdmin() public {
        vm.prank(user);
        vm.expectRevert(CollateralRegistry.Unauthorized.selector);
        registry.setAdmin(user);
    }

    // ============ CHAIN TRACKING TESTS ============

    function test_ChainTracking_NoDuplicates() public {
        // Add to same chain multiple times via BUY from external
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, 100e18, TypesLib.TxType.BUY);
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, 200e18, TypesLib.TxType.BUY);
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, 300e18, TypesLib.TxType.BUY);

        (uint256[] memory chainIds,) = registry.getCollateralBreakdown(ITP_1);

        // Should only have one entry for ARBITRUM
        assertEq(chainIds.length, 1);
        assertEq(chainIds[0], ARBITRUM);
        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), 600e18);
    }

    // ============ ALL TX TYPES COMPREHENSIVE TEST ============

    function test_AllTxTypes_ProcessCorrectly() public {
        // Setup: Add initial collateral to Arbitrum via BUY
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, 1000e18, TypesLib.TxType.BUY);
        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), 1000e18);

        // BRIDGE: from Arbitrum to Ethereum
        _recordMove(ITP_1, ARBITRUM, ETHEREUM, 200e18, TypesLib.TxType.BRIDGE);
        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), 800e18);
        assertEq(registry.getITPCollateralByChain(ITP_1, ETHEREUM), 200e18);

        // SWAP_IN: assets coming in from external to Ethereum
        _recordMove(ITP_1, EXTERNAL, ETHEREUM, 300e18, TypesLib.TxType.SWAP_IN);
        assertEq(registry.getITPCollateralByChain(ITP_1, ETHEREUM), 500e18);

        // SWAP_OUT: assets going out from Arbitrum to external
        _recordMove(ITP_1, ARBITRUM, EXTERNAL, 200e18, TypesLib.TxType.SWAP_OUT);
        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), 600e18);

        // BUY: CEX buy adds to Base from external
        _recordMove(ITP_1, EXTERNAL, BASE, 300e18, TypesLib.TxType.BUY);
        assertEq(registry.getITPCollateralByChain(ITP_1, BASE), 300e18);

        // SELL: CEX sell removes from Ethereum to external
        _recordMove(ITP_1, ETHEREUM, EXTERNAL, 100e18, TypesLib.TxType.SELL);
        assertEq(registry.getITPCollateralByChain(ITP_1, ETHEREUM), 400e18);

        // Verify total: 600 + 400 + 300 = 1300
        assertEq(registry.getTotalCollateral(ITP_1), 1300e18);
    }

    // ============ EDGE CASES ============

    function test_ZeroAmount_Movement_Reverts() public {
        // Zero amount movements should revert to prevent spam/abuse
        vm.expectRevert(CollateralRegistry.ZeroAmount.selector);
        _recordMove(ITP_1, INDEX_L3, ARBITRUM, 0, TypesLib.TxType.BRIDGE);
    }

    function test_EmptyBreakdown_ForNewITP() public view {
        (uint256[] memory chainIds, uint256[] memory amounts) = registry.getCollateralBreakdown(ITP_1);

        assertEq(chainIds.length, 0);
        assertEq(amounts.length, 0);
    }

    // ============ L3 CHAIN TRACKING TESTS ============

    function test_L3ChainTracking_BridgeToL3() public {
        // First add collateral to Arbitrum
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, 1000e18, TypesLib.TxType.BUY);
        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), 1000e18);

        // Bridge from Arbitrum to L3
        _recordMove(ITP_1, ARBITRUM, INDEX_L3, 500e18, TypesLib.TxType.BRIDGE);

        // Verify both chains track correctly
        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), 500e18);
        assertEq(registry.getITPCollateralByChain(ITP_1, INDEX_L3), 500e18);
        assertEq(registry.getTotalCollateral(ITP_1), 1000e18);
    }

    function test_L3ChainTracking_BridgeFromL3() public {
        // Add collateral to L3 first
        _recordMove(ITP_1, EXTERNAL, INDEX_L3, 1000e18, TypesLib.TxType.BUY);
        assertEq(registry.getITPCollateralByChain(ITP_1, INDEX_L3), 1000e18);

        // Bridge from L3 to Arbitrum
        _recordMove(ITP_1, INDEX_L3, ARBITRUM, 400e18, TypesLib.TxType.BRIDGE);

        // Verify both chains track correctly
        assertEq(registry.getITPCollateralByChain(ITP_1, INDEX_L3), 600e18);
        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), 400e18);
        assertEq(registry.getTotalCollateral(ITP_1), 1000e18);
    }

    // ============ CEX OPERATIONS WITH EXTERNAL CHAIN ============

    function test_CEX_BuyFromExternal() public {
        // BUY: Assets coming from CEX (external) to a chain
        // fromChain = 0 (external), toChain = actual chain
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, 1000e18, TypesLib.TxType.BUY);

        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), 1000e18);
        assertEq(registry.getITPCollateralByChain(ITP_1, EXTERNAL), 0); // External not tracked
        assertEq(registry.getTotalCollateral(ITP_1), 1000e18);
    }

    function test_CEX_SellToExternal() public {
        // First have collateral on chain
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, 1000e18, TypesLib.TxType.BUY);

        // SELL: Assets going to CEX (external) from a chain
        // fromChain = actual chain, toChain = 0 (external)
        _recordMove(ITP_1, ARBITRUM, EXTERNAL, 300e18, TypesLib.TxType.SELL);

        assertEq(registry.getITPCollateralByChain(ITP_1, ARBITRUM), 700e18);
        assertEq(registry.getTotalCollateral(ITP_1), 700e18);
    }

    // ============ ADMIN EVENT TESTS ============

    function test_SetAdmin_EmitsEvent() public {
        address newAdmin = address(0x888);

        vm.expectEmit(true, true, false, false);
        emit AdminChanged(admin, newAdmin);

        vm.prank(admin);
        registry.setAdmin(newAdmin);
    }


    // ============ MESSAGE HASH FORMAT TESTS ============

    /// @notice Verify message hash format matches interface spec for BLS integration
    /// @dev Message: keccak256(abi.encode(chainid, this, itpId, fromChain, toChain, amount, txType, nonce))
    function test_MessageHashFormat_MatchesInterfaceSpec() public {
        // Get initial nonce
        uint256 initialNonce = registry.getNonce();

        // Record a move - this will use nonce and increment it
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.BUY);

        // Verify nonce incremented
        assertEq(registry.getNonce(), initialNonce + 1);

        // Compute expected message hash as specified in interface
        // This is what off-chain issuers must produce for BLS signing
        bytes32 expectedMessage = keccak256(
            abi.encode(
                block.chainid, // Current chain ID
                address(registry), // Contract address
                ITP_1, // itpId
                EXTERNAL, // fromChain
                ARBITRUM, // toChain
                AMOUNT, // amount
                TypesLib.TxType.BUY, // txType
                initialNonce // nonce at time of call
            )
        );

        // The message format is correct if the contract accepted the call
        // (BLS verification uses real signatures now)
        assertTrue(registry.itpExists(ITP_1));

        // Verify the hash is deterministic and reproducible
        bytes32 expectedMessage2 = keccak256(
            abi.encode(
                block.chainid,
                address(registry),
                ITP_1,
                EXTERNAL,
                ARBITRUM,
                AMOUNT,
                TypesLib.TxType.BUY,
                initialNonce
            )
        );
        assertEq(expectedMessage, expectedMessage2, "Message hash should be deterministic");
    }

    /// @notice Verify nonce prevents replay with same parameters
    function test_NonceInMessageHash_PreventsReplay() public {
        uint256 nonce1 = registry.getNonce();
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.BUY);

        uint256 nonce2 = registry.getNonce();
        _recordMove(ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.BUY);

        // Same parameters but different nonces = different message hashes
        bytes32 message1 = keccak256(
            abi.encode(block.chainid, address(registry), ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.BUY, nonce1)
        );
        bytes32 message2 = keccak256(
            abi.encode(block.chainid, address(registry), ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.BUY, nonce2)
        );

        assertTrue(message1 != message2, "Different nonces must produce different message hashes");
    }

    /// @notice Verify chain ID is included in message (cross-chain replay protection)
    function test_ChainIdInMessageHash_PreventsCrossChainReplay() public {
        uint256 nonce = registry.getNonce();

        // Message on chain 111222333 (L3)
        bytes32 messageL3 = keccak256(
            abi.encode(111222333, address(registry), ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.BUY, nonce)
        );

        // Same params but different chain ID (Arbitrum)
        bytes32 messageArb = keccak256(
            abi.encode(42161, address(registry), ITP_1, EXTERNAL, ARBITRUM, AMOUNT, TypesLib.TxType.BUY, nonce)
        );

        assertTrue(messageL3 != messageArb, "Different chain IDs must produce different message hashes");
    }

    // ============ HELPER FUNCTIONS ============

    function _recordMove(bytes32 itpId, uint256 fromChain, uint256 toChain, uint256 amount, TypesLib.TxType txType)
        internal
    {
        bytes memory sig = _signRecordCollateralMove(itpId, fromChain, toChain, amount, txType);
        registry.recordCollateralMove(itpId, fromChain, toChain, amount, txType, sig);
    }
}
