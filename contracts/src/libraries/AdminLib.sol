// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/TypesLib.sol";
import "../libraries/ErrorsLib.sol";
import "../libraries/EventsLib.sol";
import "../interfaces/IGovernance.sol";

/// @title AdminLib - External library for admin configuration functions
/// @notice Extracted from Investment.sol to reduce contract size below the 24,576 byte limit
/// @dev Uses external functions that compile to delegatecall, preserving caller's storage context
library AdminLib {

    /// @notice Configure per-asset minimum buy amounts in batch
    function setBatchMinBuyAmounts(
        address[] calldata assets,
        uint256[] calldata amounts,
        mapping(address => uint256) storage minBuyAmount,
        IGovernance governance
    ) external {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        if (assets.length != amounts.length) {
            revert ErrorsLib.E015_LengthMismatch(assets.length, amounts.length);
        }
        for (uint256 i = 0; i < assets.length;) {
            minBuyAmount[assets[i]] = amounts[i];
            emit EventsLib.MinBuyAmountUpdated(assets[i], amounts[i]);
            unchecked { ++i; }
        }
    }

    /// @notice Configure staleness limits for multiple asset types in batch
    function setStalenessLimitsBatch(
        uint256[] calldata assetTypes,
        uint256[] calldata maxSeconds,
        mapping(uint256 => uint256) storage stalenessLimits,
        IGovernance governance
    ) external {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        if (assetTypes.length != maxSeconds.length) {
            revert ErrorsLib.E015_LengthMismatch(assetTypes.length, maxSeconds.length);
        }
        for (uint256 i = 0; i < assetTypes.length;) {
            stalenessLimits[assetTypes[i]] = maxSeconds[i];
            emit EventsLib.StalenessLimitUpdated(assetTypes[i], maxSeconds[i]);
            unchecked { ++i; }
        }
    }

    /// @notice Configure a venue pool for inventory tracking
    function configureVenuePool(
        uint256 venueId,
        uint256 targetBalance,
        uint256 minThreshold,
        mapping(uint256 => TypesLib.VenuePool) storage venuePools,
        IGovernance governance
    ) external {
        if (msg.sender != governance.admin()) {
            revert ErrorsLib.E061_Unauthorized(msg.sender, governance.admin());
        }
        TypesLib.VenuePool storage pool = venuePools[venueId];
        pool.targetBalance = targetBalance;
        pool.minThreshold = minThreshold;
        emit EventsLib.VenuePoolConfigured(venueId, targetBalance, minThreshold);
    }

    /// @notice Update venue pool balance after bridge operations (BLS-signed)
    /// @dev BLS verification must be done by caller
    function updateVenueBalance(
        uint256 venueId,
        uint256 newBalance,
        mapping(uint256 => TypesLib.VenuePool) storage venuePools
    ) external {
        TypesLib.VenuePool storage pool = venuePools[venueId];
        pool.currentBalance = newBalance;
        pool.lastRebalance = block.timestamp;

        if (newBalance < pool.minThreshold && pool.minThreshold > 0) {
            uint256 deficit = pool.targetBalance > newBalance ? pool.targetBalance - newBalance : 0;
            emit EventsLib.PoolRebalanceNeeded(venueId, deficit);
        }
    }
}
