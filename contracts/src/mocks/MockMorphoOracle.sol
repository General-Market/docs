// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IOracle } from "@morpho-blue/interfaces/IOracle.sol";

/// @title MockMorphoOracle
/// @notice Mock oracle implementing Morpho Blue's IOracle interface for E2E testing
/// @dev Returns a configurable price with 36 + loanDecimals - collateralDecimals precision
///      For ITP (18 dec) collateral / SettlementUSDC (6 dec) loan: precision = 36 + 6 - 18 = 24
///      So 1 ITP = 1 USDC → price() returns 1e24
contract MockMorphoOracle is IOracle {
    /// @notice The current price (scaled per Morpho convention)
    uint256 private _price;

    /// @notice Owner who can update the price
    address public owner;

    constructor(uint256 initialPrice) {
        _price = initialPrice;
        owner = msg.sender;
    }

    /// @notice Returns the price of 1 unit of collateral quoted in loan token, scaled by 1e36
    /// @dev For ITP(18dec)/USDC(6dec): precision = 36 + 6 - 18 = 24 decimals
    function price() external view override returns (uint256) {
        return _price;
    }

    /// @notice Update the oracle price (owner only, for testing)
    /// @param newPrice The new price (must follow Morpho's decimal convention)
    function setPrice(uint256 newPrice) external {
        require(msg.sender == owner, "MockMorphoOracle: not owner");
        _price = newPrice;
    }

    /// @notice Transfer ownership (for multi-step deployments where a different caller needs price control)
    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "MockMorphoOracle: not owner");
        require(newOwner != address(0), "MockMorphoOracle: zero address");
        owner = newOwner;
    }

    /// @notice Returns the current price (alias for price() for frontend compatibility)
    function currentPrice() external view returns (uint256) {
        return _price;
    }

    /// @notice Returns the last update timestamp (stub for frontend compatibility)
    function lastUpdated() external view returns (uint256) {
        return block.timestamp;
    }

    /// @notice Returns the last cycle number (stub for frontend compatibility)
    function lastCycleNumber() external view returns (uint256) {
        return 0;
    }
}
