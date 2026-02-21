// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { ReferralVault } from "../../src/vision/ReferralVault.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mock WIND token for testing
contract MockWINDReferral is ERC20 {
    constructor() ERC20("WIND Token", "WIND") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ReferralVaultTest is Test {
    ReferralVault public vault;
    MockWINDReferral public wind;

    address public admin;
    address public user1 = address(0x1111);
    address public user2 = address(0x2222);
    address public user3 = address(0x3333);

    // Events (redeclared for testing)
    event RewardClaimed(address indexed user, uint256 indexed epoch, uint256 amount);
    event EpochSet(uint256 indexed epoch, bytes32 root);
    event VaultFunded(address indexed funder, uint256 amount);
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);

    function setUp() public {
        admin = address(this);
        wind = new MockWINDReferral();
        vault = new ReferralVault(address(wind));

        // Fund vault with WIND
        wind.mint(admin, 100_000e18);
        wind.approve(address(vault), type(uint256).max);
        vault.fundVault(10_000e18);
    }

    // ============ Constructor Tests ============

    function test_ConstructorSetsWind() public view {
        assertEq(address(vault.wind()), address(wind));
    }

    function test_ConstructorSetsAdmin() public view {
        assertEq(vault.admin(), admin);
    }

    function test_ConstructorRevertsZeroAddress() public {
        vm.expectRevert(ReferralVault.ZeroAddress.selector);
        new ReferralVault(address(0));
    }

    function test_InitialEpochIsZero() public view {
        assertEq(vault.currentEpoch(), 0);
    }

    // ============ setMerkleRoot Tests ============

    function test_SetMerkleRootHappyPath() public {
        bytes32 root = keccak256("test_root");
        vault.setMerkleRoot(root);

        assertEq(vault.currentEpoch(), 1);
        assertEq(vault.epochRoots(1), root);
    }

    function test_SetMerkleRootIncrementsEpoch() public {
        vault.setMerkleRoot(keccak256("root1"));
        vault.setMerkleRoot(keccak256("root2"));
        vault.setMerkleRoot(keccak256("root3"));

        assertEq(vault.currentEpoch(), 3);
        assertEq(vault.epochRoots(1), keccak256("root1"));
        assertEq(vault.epochRoots(2), keccak256("root2"));
        assertEq(vault.epochRoots(3), keccak256("root3"));
    }

    function test_SetMerkleRootEmitsEvent() public {
        bytes32 root = keccak256("test_root");

        vm.expectEmit(true, false, false, true);
        emit EpochSet(1, root);
        vault.setMerkleRoot(root);
    }

    function test_SetMerkleRootNotAdminReverts() public {
        vm.prank(user1);
        vm.expectRevert(ReferralVault.NotAdmin.selector);
        vault.setMerkleRoot(keccak256("root"));
    }

    // ============ Claim Tests ============

    function test_ClaimHappyPath() public {
        // Create merkle tree with user1 getting 100e18
        uint256 amount = 100e18;
        bytes32 leaf = keccak256(abi.encodePacked(user1, amount));
        bytes32 root = leaf; // Single-leaf tree

        vault.setMerkleRoot(root);

        bytes32[] memory proof = new bytes32[](0); // No proof needed for single leaf

        uint256 balBefore = wind.balanceOf(user1);

        vm.prank(user1);
        vault.claim(1, amount, proof);

        assertEq(wind.balanceOf(user1), balBefore + amount);
        assertTrue(vault.hasClaimed(1, user1));
    }

    function test_ClaimEmitsEvent() public {
        uint256 amount = 100e18;
        bytes32 leaf = keccak256(abi.encodePacked(user1, amount));
        vault.setMerkleRoot(leaf);

        bytes32[] memory proof = new bytes32[](0);

        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit RewardClaimed(user1, 1, amount);
        vault.claim(1, amount, proof);
    }

    function test_ClaimWithTwoLeafTree() public {
        // Two users: user1 gets 100e18, user2 gets 200e18
        uint256 amount1 = 100e18;
        uint256 amount2 = 200e18;

        bytes32 leaf1 = keccak256(abi.encodePacked(user1, amount1));
        bytes32 leaf2 = keccak256(abi.encodePacked(user2, amount2));

        // Root = hash of sorted pair
        bytes32 root;
        if (leaf1 < leaf2) {
            root = keccak256(abi.encodePacked(leaf1, leaf2));
        } else {
            root = keccak256(abi.encodePacked(leaf2, leaf1));
        }

        vault.setMerkleRoot(root);

        // User1 claims with leaf2 as proof
        bytes32[] memory proof1 = new bytes32[](1);
        proof1[0] = leaf2;

        vm.prank(user1);
        vault.claim(1, amount1, proof1);
        assertEq(wind.balanceOf(user1), amount1);

        // User2 claims with leaf1 as proof
        bytes32[] memory proof2 = new bytes32[](1);
        proof2[0] = leaf1;

        vm.prank(user2);
        vault.claim(1, amount2, proof2);
        assertEq(wind.balanceOf(user2), amount2);
    }

    function test_ClaimDoubleClaimReverts() public {
        uint256 amount = 100e18;
        bytes32 leaf = keccak256(abi.encodePacked(user1, amount));
        vault.setMerkleRoot(leaf);

        bytes32[] memory proof = new bytes32[](0);

        vm.prank(user1);
        vault.claim(1, amount, proof);

        // Second claim should revert
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(ReferralVault.AlreadyClaimed.selector, 1, user1));
        vault.claim(1, amount, proof);
    }

    function test_ClaimWrongProofReverts() public {
        uint256 amount = 100e18;
        bytes32 leaf = keccak256(abi.encodePacked(user1, amount));
        vault.setMerkleRoot(leaf);

        bytes32[] memory proof = new bytes32[](0);

        // User2 tries to claim with user1's leaf
        vm.prank(user2);
        vm.expectRevert(ReferralVault.InvalidProof.selector);
        vault.claim(1, amount, proof);
    }

    function test_ClaimWrongAmountReverts() public {
        uint256 amount = 100e18;
        bytes32 leaf = keccak256(abi.encodePacked(user1, amount));
        vault.setMerkleRoot(leaf);

        bytes32[] memory proof = new bytes32[](0);

        // Try to claim wrong amount
        vm.prank(user1);
        vm.expectRevert(ReferralVault.InvalidProof.selector);
        vault.claim(1, 200e18, proof);
    }

    function test_ClaimEpochNotSetReverts() public {
        bytes32[] memory proof = new bytes32[](0);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(ReferralVault.EpochNotSet.selector, 99));
        vault.claim(99, 100e18, proof);
    }

    function test_ClaimZeroAmountReverts() public {
        vault.setMerkleRoot(keccak256("root"));
        bytes32[] memory proof = new bytes32[](0);

        vm.prank(user1);
        vm.expectRevert(ReferralVault.ZeroAmount.selector);
        vault.claim(1, 0, proof);
    }

    function test_ClaimInsufficientVaultBalanceReverts() public {
        // Create a claim for more than vault balance
        uint256 amount = 100_000e18; // More than the 10,000 funded
        bytes32 leaf = keccak256(abi.encodePacked(user1, amount));
        vault.setMerkleRoot(leaf);

        bytes32[] memory proof = new bytes32[](0);

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(ReferralVault.InsufficientVaultBalance.selector, 10_000e18, amount)
        );
        vault.claim(1, amount, proof);
    }

    function test_ClaimAcrossMultipleEpochs() public {
        // Epoch 1
        uint256 amount1 = 50e18;
        bytes32 leaf1 = keccak256(abi.encodePacked(user1, amount1));
        vault.setMerkleRoot(leaf1);

        // Epoch 2
        uint256 amount2 = 75e18;
        bytes32 leaf2 = keccak256(abi.encodePacked(user1, amount2));
        vault.setMerkleRoot(leaf2);

        bytes32[] memory proof = new bytes32[](0);

        // Claim epoch 1
        vm.prank(user1);
        vault.claim(1, amount1, proof);

        // Claim epoch 2
        vm.prank(user1);
        vault.claim(2, amount2, proof);

        assertEq(wind.balanceOf(user1), amount1 + amount2);
        assertTrue(vault.hasClaimed(1, user1));
        assertTrue(vault.hasClaimed(2, user1));
    }

    // ============ fundVault Tests ============

    function test_FundVaultHappyPath() public {
        uint256 balBefore = vault.vaultBalance();
        vault.fundVault(1_000e18);
        assertEq(vault.vaultBalance(), balBefore + 1_000e18);
    }

    function test_FundVaultEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit VaultFunded(admin, 500e18);
        vault.fundVault(500e18);
    }

    function test_FundVaultZeroAmountReverts() public {
        vm.expectRevert(ReferralVault.ZeroAmount.selector);
        vault.fundVault(0);
    }

    // ============ setAdmin Tests ============

    function test_SetAdminHappyPath() public {
        vault.setAdmin(user1);
        assertEq(vault.admin(), user1);
    }

    function test_SetAdminEmitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit AdminUpdated(admin, user1);
        vault.setAdmin(user1);
    }

    function test_SetAdminNotAdminReverts() public {
        vm.prank(user1);
        vm.expectRevert(ReferralVault.NotAdmin.selector);
        vault.setAdmin(user2);
    }

    function test_SetAdminZeroAddressReverts() public {
        vm.expectRevert(ReferralVault.ZeroAddress.selector);
        vault.setAdmin(address(0));
    }

    // ============ View Function Tests ============

    function test_HasClaimedFalseByDefault() public view {
        assertFalse(vault.hasClaimed(1, user1));
    }

    function test_VaultBalance() public view {
        assertEq(vault.vaultBalance(), 10_000e18);
    }
}
