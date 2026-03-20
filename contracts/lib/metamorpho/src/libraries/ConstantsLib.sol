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
    /// Raised from 30 — no practical limit on Orbit L3 with cheap gas.
    uint256 internal constant MAX_QUEUE_LENGTH = 100000;

    /// @dev The maximum fee the vault can have (50%).
    uint256 internal constant MAX_FEE = 0.5e18;
}
