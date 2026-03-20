// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

/// @title ConstantsLib
/// @author Morpho Labs
/// @custom:contact security@morpho.org
/// @notice Library exposing constants.
library ConstantsLib {
    /// @dev The maximum delay of a timelock.
    uint256 internal constant MAX_TIMELOCK = 2 weeks;

    /// @dev The minimum delay of a timelock (set to 0 for testnet — no waiting).
    uint256 internal constant MIN_TIMELOCK = 0;

    /// @dev The maximum number of markets in the supply/withdraw queue.
    /// Raised from 30 to 500. At 500 markets: totalAssets() ~10M gas, safe on L3.
    /// Beyond 500: gas per deposit/withdraw scales linearly, reconsider architecture.
    uint256 internal constant MAX_QUEUE_LENGTH = 500;

    /// @dev The maximum fee the vault can have (50%).
    uint256 internal constant MAX_FEE = 0.5e18;
}
