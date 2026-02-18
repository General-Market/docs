// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IBridgedItpFactory - Factory for deploying BridgedITP tokens
/// @notice Interface for the BridgedITP token factory
/// @dev Only callable by BridgeProxy
interface IBridgedItpFactory {
    /// @notice BridgeProxy address (only caller allowed)
    /// @return The bridge proxy address
    function bridgeProxy() external view returns (address);

    /// @notice Deployed BridgedITP tokens by orbitItpId
    /// @param orbitItpId L3 ITP ID
    /// @return The deployed BridgedITP address (or zero if not deployed)
    function deployedItps(bytes32 orbitItpId) external view returns (address);

    /// @notice Deploy a new BridgedITP token
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param orbitItpId L3 ITP ID (used as CREATE2 salt)
    /// @return bridgedItp Deployed token address
    function deployBridgedItp(
        string calldata name,
        string calldata symbol,
        bytes32 orbitItpId
    ) external returns (address bridgedItp);

    /// @notice Compute address of BridgedITP before deployment
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param orbitItpId L3 ITP ID
    /// @return Predicted address
    function computeAddress(
        string calldata name,
        string calldata symbol,
        bytes32 orbitItpId
    ) external view returns (address);

    /// @notice Emitted when a BridgedITP is deployed
    /// @param orbitItpId L3 ITP ID
    /// @param bridgedItp Deployed token address
    /// @param name Token name
    /// @param symbol Token symbol
    event BridgedItpDeployed(
        bytes32 indexed orbitItpId,
        address indexed bridgedItp,
        string name,
        string symbol
    );
}
