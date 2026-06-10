// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MockERC20.sol";

/// @title MockTokenFactory
/// @notice Batch deploys MockERC20 tokens for E2E testing
/// @dev Deploys up to 200 tokens per call to avoid gas limits
contract MockTokenFactory {
    event TokenDeployed(uint256 indexed id, address token, string symbol);

    /// @notice Deploy multiple MockERC20 tokens in a single transaction
    /// @param ids Numeric IDs from assets.json
    /// @param symbols Token symbols (e.g., "BTC", "ETH")
    /// @param bitgetPairs Full Bitget pair names (e.g., "BTCUSDC", "ETHUSDC")
    /// @return tokens Array of deployed token addresses
    function deployBatch(
        uint256[] calldata ids,
        string[] calldata symbols,
        string[] calldata bitgetPairs
    ) external returns (address[] memory tokens) {
        require(ids.length == symbols.length && symbols.length == bitgetPairs.length, "Length mismatch");
        require(ids.length <= 200, "Max 200 tokens per batch");

        tokens = new address[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            string memory name = string.concat("Mock ", symbols[i]);
            MockERC20 token = new MockERC20(name, symbols[i], 18);
            tokens[i] = address(token);
            emit TokenDeployed(ids[i], address(token), bitgetPairs[i]);
        }
    }

    /// @notice Deploy tokens and mint initial supply to a vault
    /// @param ids Numeric IDs from assets.json
    /// @param symbols Token symbols
    /// @param bitgetPairs Full Bitget pair names
    /// @param vault Address to receive minted tokens
    /// @param mintAmount Amount to mint per token (in wei, e.g., 1e24 for 1M tokens)
    /// @return tokens Array of deployed token addresses
    function deployBatchAndFund(
        uint256[] calldata ids,
        string[] calldata symbols,
        string[] calldata bitgetPairs,
        address vault,
        uint256 mintAmount
    ) external returns (address[] memory tokens) {
        require(ids.length == symbols.length && symbols.length == bitgetPairs.length, "Length mismatch");
        require(ids.length <= 200, "Max 200 tokens per batch");
        require(vault != address(0), "Invalid vault");

        tokens = new address[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            string memory name = string.concat("Mock ", symbols[i]);
            MockERC20 token = new MockERC20(name, symbols[i], 18);
            tokens[i] = address(token);

            // Mint tokens to vault
            token.mint(vault, mintAmount);

            emit TokenDeployed(ids[i], address(token), bitgetPairs[i]);
        }
    }
}
