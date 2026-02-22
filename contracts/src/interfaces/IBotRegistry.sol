// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IBotRegistry - Bot registry interface
/// @notice Registry for P2P trading bots with free registration
interface IBotRegistry {
    // ============ Structs ============

    /// @notice Bot registration data
    struct Bot {
        string endpoint;      // P2P HTTP endpoint URL (e.g., "https://bot1.example.com:8080")
        bytes32 pubkeyHash;   // keccak256 of bot's signing public key
        uint256 registeredAt; // Block timestamp of registration
        bool isActive;        // True if bot is registered and active
    }

    // ============ Custom Errors ============

    error AlreadyRegistered();
    error NotRegistered();
    error EmptyEndpoint();
    error ZeroPubkeyHash();

    // ============ Events ============

    /// @notice Emitted when a bot is registered
    event BotRegistered(address indexed bot, string endpoint, bytes32 pubkeyHash);

    /// @notice Emitted when a bot's endpoint is updated
    event BotUpdated(address indexed bot, string newEndpoint);

    /// @notice Emitted when a bot is deregistered
    event BotDeregistered(address indexed bot);

    // ============ External Functions ============

    /// @notice Register a bot with endpoint
    /// @param endpoint The P2P HTTP endpoint URL for the bot
    /// @param pubkeyHash The keccak256 hash of the bot's signing public key
    function registerBot(string calldata endpoint, bytes32 pubkeyHash) external;

    /// @notice Update the endpoint for a registered bot
    /// @param newEndpoint The new P2P HTTP endpoint URL
    function updateEndpoint(string calldata newEndpoint) external;

    /// @notice Deregister a bot
    function deregisterBot() external;

    // ============ View Functions ============

    /// @notice Get all active bots with their endpoints
    /// @return addresses Array of active bot addresses
    /// @return endpoints Array of corresponding endpoints
    function getAllActiveBots() external view returns (address[] memory addresses, string[] memory endpoints);

    /// @notice Get bot data for a specific address
    /// @param bot The bot address to query
    /// @return The Bot struct for the address
    function getBot(address bot) external view returns (Bot memory);

    /// @notice Check if a bot is active
    /// @param bot The bot address to check
    /// @return True if the bot is registered and active
    function isActive(address bot) external view returns (bool);

    // ============ Public State Accessors ============

    /// @notice Mapping from bot address to bot data
    function bots(address bot) external view returns (
        string memory endpoint,
        bytes32 pubkeyHash,
        uint256 registeredAt,
        bool isActive
    );

    /// @notice Array of all registered bot addresses (for iteration)
    function botAddresses(uint256 index) external view returns (address);
}
