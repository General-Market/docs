// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IBridgedITP - ERC20 representation of L3 ITP on Arbitrum
/// @notice Interface for the bridged ITP token
/// @dev Mint/burn controlled by BridgeProxy only
interface IBridgedITP is IERC20 {
    /// @notice L3 ITP ID this token represents
    /// @return The orbit ITP ID (bytes32)
    function orbitItpId() external view returns (bytes32);

    /// @notice BridgeProxy address (only minter/burner)
    /// @return The bridge proxy address
    function bridgeProxy() external view returns (address);

    /// @notice Mint tokens (bridge from L3)
    /// @param to Recipient address
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) external;

    /// @notice Burn tokens (bridge to L3)
    /// @param from Address to burn from
    /// @param amount Amount to burn
    function burn(address from, uint256 amount) external;
}
