// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BotRegistry
/// @notice Registry for P2P trading bots with stake-based registration
/// @dev Bots register with WIND token stake to enable peer discovery
contract BotRegistry is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Custom Errors ============

    error AlreadyRegistered();
    error NotRegistered();
    error InsufficientStake(uint256 required, uint256 provided);
    error ZeroAddress();
    error EmptyEndpoint();
    error ZeroPubkeyHash();

    // ============ Structs ============

    /// @notice Bot registration data
    struct Bot {
        string endpoint;      // P2P HTTP endpoint URL (e.g., "https://bot1.example.com:8080")
        bytes32 pubkeyHash;   // keccak256 of bot's signing public key
        uint256 stakedAmount; // Amount of WIND staked (always MIN_STAKE for v1)
        uint256 registeredAt; // Block timestamp of registration
        bool isActive;        // True if bot is registered and active
    }

    // ============ Constants ============

    /// @notice Minimum stake required to register a bot (1 WIND with 18 decimals)
    uint256 public constant MIN_STAKE = 1 * 10 ** 18;

    /// @notice The WIND token used for staking
    IERC20 public immutable WIND_TOKEN;

    // ============ State Variables ============

    /// @notice Mapping from bot address to bot data
    mapping(address => Bot) public bots;

    /// @notice Array of all registered bot addresses (for iteration)
    /// @dev Note: This array only grows, never shrinks. Deregistered bots remain in array
    ///      but are filtered out by getAllActiveBots(). Acceptable for <100 total registrations.
    address[] public botAddresses;

    // ============ Events ============

    /// @notice Emitted when a bot is registered
    event BotRegistered(address indexed bot, string endpoint, bytes32 pubkeyHash, uint256 stake);

    /// @notice Emitted when a bot's endpoint is updated
    event BotUpdated(address indexed bot, string newEndpoint);

    /// @notice Emitted when a bot is deregistered and stake returned
    event BotDeregistered(address indexed bot, uint256 stakeReturned);

    // ============ Constructor ============

    /// @notice Deploy the BotRegistry with WIND token address
    /// @param _windToken Address of the WIND ERC20 token
    constructor(address _windToken) {
        if (_windToken == address(0)) revert ZeroAddress();
        WIND_TOKEN = IERC20(_windToken);
    }

    // ============ External Functions ============

    /// @notice Register a bot with stake and endpoint
    /// @param endpoint The P2P HTTP endpoint URL for the bot
    /// @param pubkeyHash The keccak256 hash of the bot's signing public key
    function registerBot(string calldata endpoint, bytes32 pubkeyHash) external nonReentrant {
        if (bytes(endpoint).length == 0) revert EmptyEndpoint();
        if (pubkeyHash == bytes32(0)) revert ZeroPubkeyHash();
        if (bots[msg.sender].isActive) revert AlreadyRegistered();

        // Transfer stake from bot operator
        WIND_TOKEN.safeTransferFrom(msg.sender, address(this), MIN_STAKE);

        // Register bot
        bots[msg.sender] = Bot({
            endpoint: endpoint,
            pubkeyHash: pubkeyHash,
            stakedAmount: MIN_STAKE,
            registeredAt: block.timestamp,
            isActive: true
        });

        botAddresses.push(msg.sender);

        emit BotRegistered(msg.sender, endpoint, pubkeyHash, MIN_STAKE);
    }

    /// @notice Update the endpoint for a registered bot
    /// @param newEndpoint The new P2P HTTP endpoint URL
    function updateEndpoint(string calldata newEndpoint) external {
        if (!bots[msg.sender].isActive) revert NotRegistered();
        if (bytes(newEndpoint).length == 0) revert EmptyEndpoint();

        bots[msg.sender].endpoint = newEndpoint;

        emit BotUpdated(msg.sender, newEndpoint);
    }

    /// @notice Deregister a bot and return the staked amount
    function deregisterBot() external nonReentrant {
        Bot storage bot = bots[msg.sender];
        if (!bot.isActive) revert NotRegistered();

        uint256 stakeToReturn = bot.stakedAmount;

        // Mark as inactive (keep history)
        bot.isActive = false;
        bot.stakedAmount = 0;

        // Return stake
        WIND_TOKEN.safeTransfer(msg.sender, stakeToReturn);

        emit BotDeregistered(msg.sender, stakeToReturn);
    }

    // ============ View Functions ============

    /// @notice Get all active bots with their endpoints
    /// @dev O(2n) implementation - iterates twice (count then fill). Acceptable for <100 bots.
    ///      For larger scale, consider maintaining a separate active bot list.
    /// @return addresses Array of active bot addresses
    /// @return endpoints Array of corresponding endpoints
    function getAllActiveBots() external view returns (address[] memory addresses, string[] memory endpoints) {
        // Count active bots (first pass)
        uint256 activeCount = 0;
        for (uint256 i = 0; i < botAddresses.length; i++) {
            if (bots[botAddresses[i]].isActive) activeCount++;
        }

        // Allocate arrays
        addresses = new address[](activeCount);
        endpoints = new string[](activeCount);
        uint256 idx = 0;

        // Fill arrays with active bots
        for (uint256 i = 0; i < botAddresses.length; i++) {
            if (bots[botAddresses[i]].isActive) {
                addresses[idx] = botAddresses[i];
                endpoints[idx] = bots[botAddresses[i]].endpoint;
                idx++;
            }
        }

        return (addresses, endpoints);
    }

    /// @notice Get bot data for a specific address
    /// @param bot The bot address to query
    /// @return The Bot struct for the address
    function getBot(address bot) external view returns (Bot memory) {
        return bots[bot];
    }

    /// @notice Check if a bot is active
    /// @param bot The bot address to check
    /// @return True if the bot is registered and active
    function isActive(address bot) external view returns (bool) {
        return bots[bot].isActive;
    }
}
