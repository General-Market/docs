// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title VisionVaultAccounting — Pure math for Vision vault share/NAV/fee calculations
/// @dev All values use 18-decimal precision. Fee rates use basis points (10000 = 100%).
library VisionVaultAccounting {
    function sharesForDeposit(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    ) internal pure returns (uint256) {
        if (totalShares == 0 || totalAssets == 0) return assets;
        return (assets * totalShares) / totalAssets;
    }

    function assetsForRedeem(
        uint256 shares,
        uint256 totalAssets,
        uint256 totalShares
    ) internal pure returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares * totalAssets) / totalShares;
    }

    function performanceFeeShares(
        uint256 newNAVPerShare,
        uint256 hwm,
        uint256 totalShares,
        uint256 feeRate
    ) internal pure returns (uint256) {
        if (newNAVPerShare <= hwm || feeRate == 0) return 0;

        uint256 profitPerShare = newNAVPerShare - hwm;
        uint256 totalProfit = (profitPerShare * totalShares) / 1e18;
        uint256 feeAssets = (totalProfit * feeRate) / 10000;
        uint256 totalAssetsAfterFee = (newNAVPerShare * totalShares) / 1e18 - feeAssets;

        if (totalAssetsAfterFee == 0) return 0;
        return (feeAssets * totalShares) / totalAssetsAfterFee;
    }

    function navPerShare(uint256 totalAssets, uint256 totalShares) internal pure returns (uint256) {
        if (totalShares == 0) return 1e18;
        return (totalAssets * 1e18) / totalShares;
    }
}
