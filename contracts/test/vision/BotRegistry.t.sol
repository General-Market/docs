// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { BotRegistry } from "../../src/vision/BotRegistry.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockWINDBot
/// @notice Simple ERC20 mock for testing (18 decimals like WIND)
contract MockWINDBot is ERC20 {
    constructor() ERC20("WIND Token", "WIND") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title BotRegistryTest
/// @notice Unit tests for BotRegistry contract
contract BotRegistryTest is Test {
    BotRegistry public registry;
    MockWINDBot public wind;

    address public bot1 = address(0xB01);
    address public bot2 = address(0xB02);
    address public bot3 = address(0xB03);

    uint256 constant INITIAL_BALANCE = 1000e18;
    uint256 constant MIN_STAKE = 1e18;
    string constant ENDPOINT_1 = "https://bot1.example.com:8080";
    string constant ENDPOINT_2 = "https://bot2.example.com:8080";
    string constant ENDPOINT_3 = "https://bot3.example.com:8080";
    bytes32 constant PUBKEY_HASH_1 = keccak256("pubkey1");
    bytes32 constant PUBKEY_HASH_2 = keccak256("pubkey2");
    bytes32 constant PUBKEY_HASH_3 = keccak256("pubkey3");

    // Events
    event BotRegistered(address indexed bot, string endpoint, bytes32 pubkeyHash, uint256 stake);
    event BotUpdated(address indexed bot, string newEndpoint);
    event BotDeregistered(address indexed bot, uint256 stakeReturned);

    function setUp() public {
        wind = new MockWINDBot();
        registry = new BotRegistry(address(wind));

        // Fund accounts
        wind.mint(bot1, INITIAL_BALANCE);
        wind.mint(bot2, INITIAL_BALANCE);
        wind.mint(bot3, INITIAL_BALANCE);

        // Approve registry for all bots
        vm.prank(bot1);
        wind.approve(address(registry), type(uint256).max);
        vm.prank(bot2);
        wind.approve(address(registry), type(uint256).max);
        vm.prank(bot3);
        wind.approve(address(registry), type(uint256).max);
    }

    // ============ Constructor Tests ============

    function test_Constructor_SetsWindToken() public view {
        assertEq(address(registry.WIND_TOKEN()), address(wind));
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(BotRegistry.ZeroAddress.selector);
        new BotRegistry(address(0));
    }

    function test_MinStake_IsCorrect() public view {
        assertEq(registry.MIN_STAKE(), 1e18);
    }

    // ============ Task 2.1: Test happy path registration with stake ============

    function test_RegisterBot_Success() public {
        uint256 balanceBefore = wind.balanceOf(bot1);

        vm.expectEmit(true, false, false, true);
        emit BotRegistered(bot1, ENDPOINT_1, PUBKEY_HASH_1, MIN_STAKE);

        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        // Verify state
        BotRegistry.Bot memory bot = registry.getBot(bot1);
        assertEq(bot.endpoint, ENDPOINT_1);
        assertEq(bot.pubkeyHash, PUBKEY_HASH_1);
        assertEq(bot.stakedAmount, MIN_STAKE);
        assertGt(bot.registeredAt, 0);
        assertTrue(bot.isActive);

        // Verify stake transferred
        assertEq(wind.balanceOf(bot1), balanceBefore - MIN_STAKE);
        assertEq(wind.balanceOf(address(registry)), MIN_STAKE);
    }

    function test_RegisterBot_MultipleBots() public {
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        vm.prank(bot2);
        registry.registerBot(ENDPOINT_2, PUBKEY_HASH_2);

        assertTrue(registry.isActive(bot1));
        assertTrue(registry.isActive(bot2));
        assertEq(wind.balanceOf(address(registry)), 2 * MIN_STAKE);
    }

    // ============ Task 2.2: Test registration with insufficient stake reverts ============

    function test_RegisterBot_RevertsWithInsufficientStake() public {
        // Create a bot with insufficient balance
        address poorBot = address(0x9001);
        wind.mint(poorBot, MIN_STAKE / 2); // Less than MIN_STAKE

        vm.prank(poorBot);
        wind.approve(address(registry), type(uint256).max);

        // Should revert on transfer (ERC20 revert, not custom error)
        vm.prank(poorBot);
        vm.expectRevert();
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);
    }

    function test_RegisterBot_RevertsWithNoApproval() public {
        address noApprovalBot = address(0xBA40);
        wind.mint(noApprovalBot, INITIAL_BALANCE);

        // No approval given
        vm.prank(noApprovalBot);
        vm.expectRevert();
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);
    }

    // ============ Task 2.3: Test duplicate registration reverts ============

    function test_RegisterBot_RevertsDuplicate() public {
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        vm.expectRevert(BotRegistry.AlreadyRegistered.selector);
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_2, PUBKEY_HASH_2);
    }

    // ============ Task 2.4: Test updateEndpoint success ============

    function test_UpdateEndpoint_Success() public {
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        string memory newEndpoint = "https://new-endpoint.example.com:9090";

        vm.expectEmit(true, false, false, true);
        emit BotUpdated(bot1, newEndpoint);

        vm.prank(bot1);
        registry.updateEndpoint(newEndpoint);

        BotRegistry.Bot memory bot = registry.getBot(bot1);
        assertEq(bot.endpoint, newEndpoint);
        // Stake should remain unchanged
        assertEq(bot.stakedAmount, MIN_STAKE);
    }

    function test_UpdateEndpoint_RevertsNotRegistered() public {
        vm.expectRevert(BotRegistry.NotRegistered.selector);
        vm.prank(bot1);
        registry.updateEndpoint("https://new.example.com");
    }

    function test_UpdateEndpoint_RevertsEmptyEndpoint() public {
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        vm.expectRevert(BotRegistry.EmptyEndpoint.selector);
        vm.prank(bot1);
        registry.updateEndpoint("");
    }

    // ============ Task 2.5: Test deregisterBot returns stake ============

    function test_DeregisterBot_Success() public {
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        uint256 balanceBefore = wind.balanceOf(bot1);
        uint256 registryBalanceBefore = wind.balanceOf(address(registry));

        vm.expectEmit(true, false, false, true);
        emit BotDeregistered(bot1, MIN_STAKE);

        vm.prank(bot1);
        registry.deregisterBot();

        // Verify bot is inactive
        assertFalse(registry.isActive(bot1));

        BotRegistry.Bot memory bot = registry.getBot(bot1);
        assertFalse(bot.isActive);
        assertEq(bot.stakedAmount, 0);

        // Verify stake returned
        assertEq(wind.balanceOf(bot1), balanceBefore + MIN_STAKE);
        assertEq(wind.balanceOf(address(registry)), registryBalanceBefore - MIN_STAKE);
    }

    function test_DeregisterBot_RevertsNotRegistered() public {
        vm.expectRevert(BotRegistry.NotRegistered.selector);
        vm.prank(bot1);
        registry.deregisterBot();
    }

    function test_DeregisterBot_RevertsAlreadyDeregistered() public {
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        vm.prank(bot1);
        registry.deregisterBot();

        vm.expectRevert(BotRegistry.NotRegistered.selector);
        vm.prank(bot1);
        registry.deregisterBot();
    }

    // ============ Task 2.6: Test getAllActiveBots returns correct list ============

    function test_GetAllActiveBots_Empty() public view {
        (address[] memory addresses, string[] memory endpoints) = registry.getAllActiveBots();
        assertEq(addresses.length, 0);
        assertEq(endpoints.length, 0);
    }

    function test_GetAllActiveBots_SingleBot() public {
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        (address[] memory addresses, string[] memory endpoints) = registry.getAllActiveBots();

        assertEq(addresses.length, 1);
        assertEq(endpoints.length, 1);
        assertEq(addresses[0], bot1);
        assertEq(endpoints[0], ENDPOINT_1);
    }

    function test_GetAllActiveBots_MultipleBots() public {
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        vm.prank(bot2);
        registry.registerBot(ENDPOINT_2, PUBKEY_HASH_2);

        vm.prank(bot3);
        registry.registerBot(ENDPOINT_3, PUBKEY_HASH_3);

        (address[] memory addresses, string[] memory endpoints) = registry.getAllActiveBots();

        assertEq(addresses.length, 3);
        assertEq(endpoints.length, 3);

        // Verify all bots are in the list
        bool foundBot1 = false;
        bool foundBot2 = false;
        bool foundBot3 = false;

        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] == bot1) {
                foundBot1 = true;
                assertEq(endpoints[i], ENDPOINT_1);
            } else if (addresses[i] == bot2) {
                foundBot2 = true;
                assertEq(endpoints[i], ENDPOINT_2);
            } else if (addresses[i] == bot3) {
                foundBot3 = true;
                assertEq(endpoints[i], ENDPOINT_3);
            }
        }

        assertTrue(foundBot1);
        assertTrue(foundBot2);
        assertTrue(foundBot3);
    }

    function test_GetAllActiveBots_ExcludesDeregistered() public {
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        vm.prank(bot2);
        registry.registerBot(ENDPOINT_2, PUBKEY_HASH_2);

        vm.prank(bot3);
        registry.registerBot(ENDPOINT_3, PUBKEY_HASH_3);

        // Deregister bot2
        vm.prank(bot2);
        registry.deregisterBot();

        (address[] memory addresses, string[] memory endpoints) = registry.getAllActiveBots();

        assertEq(addresses.length, 2);
        assertEq(endpoints.length, 2);

        // Verify bot2 is not in the list
        for (uint256 i = 0; i < addresses.length; i++) {
            assertTrue(addresses[i] != bot2);
        }
    }

    // ============ Task 2.7: Test access control (only owner can update/deregister) ============

    function test_UpdateEndpoint_RevertsNonOwner() public {
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        // bot2 tries to update bot1's endpoint
        vm.expectRevert(BotRegistry.NotRegistered.selector);
        vm.prank(bot2);
        registry.updateEndpoint("https://hacker.example.com");
    }

    function test_DeregisterBot_RevertsNonOwner() public {
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        // bot2 tries to deregister bot1
        vm.expectRevert(BotRegistry.NotRegistered.selector);
        vm.prank(bot2);
        registry.deregisterBot();
    }

    // ============ Task 2.8: Fuzz test stake amounts ============

    function testFuzz_RegisterBot_AlwaysUsesMinStake(bytes32 randomPubkeyHash) public {
        vm.assume(randomPubkeyHash != bytes32(0)); // Zero pubkeyHash is invalid
        // No matter what, registration uses MIN_STAKE
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, randomPubkeyHash);

        BotRegistry.Bot memory bot = registry.getBot(bot1);
        assertEq(bot.stakedAmount, MIN_STAKE);
    }

    function testFuzz_DeregisterBot_ReturnsExactStake(bytes32 randomPubkeyHash) public {
        vm.assume(randomPubkeyHash != bytes32(0)); // Zero pubkeyHash is invalid
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, randomPubkeyHash);

        uint256 balanceBefore = wind.balanceOf(bot1);

        vm.prank(bot1);
        registry.deregisterBot();

        // Should always return exactly MIN_STAKE
        assertEq(wind.balanceOf(bot1), balanceBefore + MIN_STAKE);
    }

    // ============ Additional Edge Cases ============

    function test_RegisterBot_RevertsEmptyEndpoint() public {
        vm.expectRevert(BotRegistry.EmptyEndpoint.selector);
        vm.prank(bot1);
        registry.registerBot("", PUBKEY_HASH_1);
    }

    function test_RegisterBot_RevertsZeroPubkeyHash() public {
        vm.expectRevert(BotRegistry.ZeroPubkeyHash.selector);
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, bytes32(0));
    }

    function test_GetBot_UnregisteredReturnsDefaults() public view {
        BotRegistry.Bot memory bot = registry.getBot(address(0xDEAD));
        assertEq(bytes(bot.endpoint).length, 0);
        assertEq(bot.pubkeyHash, bytes32(0));
        assertEq(bot.stakedAmount, 0);
        assertEq(bot.registeredAt, 0);
        assertFalse(bot.isActive);
    }

    function test_IsActive_ReturnsFalseForUnregistered() public view {
        assertFalse(registry.isActive(address(0xDEAD)));
    }

    function test_BotAddresses_TracksAllRegistrations() public {
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        assertEq(registry.botAddresses(0), bot1);

        vm.prank(bot2);
        registry.registerBot(ENDPOINT_2, PUBKEY_HASH_2);

        assertEq(registry.botAddresses(1), bot2);
    }

    function test_RegisteredAt_IsBlockTimestamp() public {
        uint256 expectedTimestamp = block.timestamp;

        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        BotRegistry.Bot memory bot = registry.getBot(bot1);
        assertEq(bot.registeredAt, expectedTimestamp);
    }

    function test_CanReregisterAfterDeregister() public {
        // First registration
        vm.prank(bot1);
        registry.registerBot(ENDPOINT_1, PUBKEY_HASH_1);

        // Deregister
        vm.prank(bot1);
        registry.deregisterBot();

        assertFalse(registry.isActive(bot1));

        // Re-register with new endpoint
        string memory newEndpoint = "https://new-bot1.example.com:8080";
        vm.prank(bot1);
        registry.registerBot(newEndpoint, PUBKEY_HASH_1);

        assertTrue(registry.isActive(bot1));
        BotRegistry.Bot memory bot = registry.getBot(bot1);
        assertEq(bot.endpoint, newEndpoint);
        assertEq(bot.stakedAmount, MIN_STAKE);
    }
}
