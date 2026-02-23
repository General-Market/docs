// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../libraries/TypesLib.sol";
import "../libraries/ErrorsLib.sol";
import "../libraries/EventsLib.sol";
import "../interfaces/IGovernance.sol";

/// @title RebalanceLib - External library for ITP rebalance operations (V2 - asset changes)
/// @notice Supports add/remove assets during rebalance. Single BLS call replaces old 3-step flow.
/// @dev Uses external functions that compile to delegatecall, preserving caller's storage context
/// @custom:security-contact security@indexprotocol.com
library RebalanceLib {
    /// @notice Weight must sum to 1e18 (100%)
    uint256 internal constant WEIGHT_SUM = 1e18;

    /// @notice Minimum weight per asset: 0.25% = 25e14
    uint256 internal constant MIN_WEIGHT = 25e14;

    /// @notice Emit AssetTradeRequest events for inventory deltas between old and new state
    /// @dev Extracted to avoid stack-too-deep in rebalance()
    /// @param quoteTokens Per-asset quote token for settlement (USDC or USDT); address(0) = default USDC
    function _emitAssetTradeDeltas(
        address[] memory finalAssets,
        uint256[] memory finalInventory,
        uint256[] calldata prices,
        address[] memory oldAssets,
        uint256[] memory oldInventory,
        address[] calldata quoteTokens
    ) internal {
        uint256 rebalanceCycle = 3_000_000_000 + block.number;
        uint256 len = finalAssets.length;
        for (uint256 i = 0; i < len;) {
            address asset = finalAssets[i];
            uint256 newQty = finalInventory[i];
            address qt = i < quoteTokens.length ? quoteTokens[i] : address(0);
            // Find old qty for this asset
            uint256 oldQty = 0;
            for (uint256 j = 0; j < oldAssets.length;) {
                if (oldAssets[j] == asset) {
                    oldQty = oldInventory[j];
                    break;
                }
                unchecked { ++j; }
            }
            if (newQty > oldQty) {
                uint256 usdcAmount = ((newQty - oldQty) * prices[i]) / 1e18;
                if (usdcAmount > 0) {
                    emit EventsLib.AssetTradeRequest(rebalanceCycle, asset, 0, usdcAmount, prices[i], qt);
                }
            } else if (oldQty > newQty) {
                uint256 usdcAmount = ((oldQty - newQty) * prices[i]) / 1e18;
                if (usdcAmount > 0) {
                    emit EventsLib.AssetTradeRequest(rebalanceCycle, asset, 1, usdcAmount, prices[i], qt);
                }
            }
            unchecked { ++i; }
        }
    }

    /// @notice Execute a full rebalance: remove assets, add assets, update weights + inventory
    /// @dev BLS verification must be done by caller before invoking this function.
    /// @param itpId The ITP to rebalance
    /// @param removeIndices Indices to remove from asset arrays (MUST be sorted descending), can be empty
    /// @param addAssets New asset addresses to add, can be empty
    /// @param newWeights Weights for the final asset list (after removals + additions)
    /// @param prices Prices for the final asset list (for inventory computation)
    /// @param _itps ITP core storage
    /// @param _itpAssets ITP assets storage
    /// @param _itpWeights ITP weights storage
    /// @param _itpInventory ITP inventory storage
    /// @param _itpNavs ITP NAV storage
    /// @param governance Governance contract for pause check
    function rebalance(
        bytes32 itpId,
        uint256[] calldata removeIndices,
        address[] calldata addAssets,
        uint256[] calldata newWeights,
        uint256[] calldata prices,
        address[] calldata quoteTokens,
        mapping(bytes32 => TypesLib.ITPCore) storage _itps,
        mapping(bytes32 => address[]) storage _itpAssets,
        mapping(bytes32 => uint256[]) storage _itpWeights,
        mapping(bytes32 => uint256[]) storage _itpInventory,
        mapping(bytes32 => uint256) storage _itpNavs,
        IGovernance governance
    ) external {
        if (governance.isPaused()) {
            revert ErrorsLib.E004_SystemPaused();
        }

        TypesLib.ITPCore storage itp = _itps[itpId];
        if (itp.status != uint256(TypesLib.ITPStatus.ACTIVE)) {
            revert ErrorsLib.E066_ITPNotActive(itpId, itp.status);
        }

        // --- Step 1: Compute current NAV before any changes ---
        uint256 nav = _itpNavs[itpId];

        // --- Snapshot old inventory (before any mutations) for AssetTradeRequest deltas ---
        address[] memory oldAssets;
        uint256[] memory oldInventory;
        {
            uint256 len = _itpAssets[itpId].length;
            oldAssets = new address[](len);
            oldInventory = new uint256[](len);
            for (uint256 i = 0; i < len;) {
                oldAssets[i] = _itpAssets[itpId][i];
                oldInventory[i] = _itpInventory[itpId][i];
                unchecked { ++i; }
            }
        }

        // --- Step 2: Swap-and-pop removed assets (descending order) ---
        address[] storage assets = _itpAssets[itpId];
        uint256[] storage weights = _itpWeights[itpId];
        uint256[] storage inventory = _itpInventory[itpId];
        uint256 currentLen = assets.length;

        if (removeIndices.length > 0) {
            // Validate descending order and bounds
            for (uint256 i = 0; i < removeIndices.length;) {
                if (removeIndices[i] >= currentLen) {
                    revert ErrorsLib.E110_RemoveIndexOutOfBounds(removeIndices[i], currentLen);
                }
                if (i > 0 && removeIndices[i] >= removeIndices[i - 1]) {
                    revert ErrorsLib.E109_RemoveIndicesNotDescending();
                }
                unchecked { ++i; }
            }

            // Swap-and-pop each index (safe because descending)
            for (uint256 i = 0; i < removeIndices.length;) {
                uint256 idx = removeIndices[i];
                uint256 lastIdx = assets.length - 1;

                if (idx != lastIdx) {
                    assets[idx] = assets[lastIdx];
                    weights[idx] = weights[lastIdx];
                    inventory[idx] = inventory[lastIdx];
                }

                assets.pop();
                weights.pop();
                inventory.pop();

                unchecked { ++i; }
            }
        }

        // --- Step 3: Push added assets ---
        if (addAssets.length > 0) {
            for (uint256 i = 0; i < addAssets.length;) {
                if (addAssets[i] == address(0)) {
                    revert ErrorsLib.E018_ZeroAssetAddress();
                }
                // Check for duplicates: added asset must not exist in current list
                for (uint256 j = 0; j < assets.length;) {
                    if (assets[j] == addAssets[i]) {
                        revert ErrorsLib.E114_DuplicateAssetInRebalance(addAssets[i]);
                    }
                    unchecked { ++j; }
                }
                // Check for duplicates within addAssets itself
                for (uint256 j = 0; j < i;) {
                    if (addAssets[j] == addAssets[i]) {
                        revert ErrorsLib.E114_DuplicateAssetInRebalance(addAssets[i]);
                    }
                    unchecked { ++j; }
                }

                assets.push(addAssets[i]);
                weights.push(0); // placeholder, overwritten below
                inventory.push(0); // placeholder, overwritten below

                unchecked { ++i; }
            }
        }

        // --- Step 4: Validate final asset count ---
        uint256 finalLen = assets.length;
        if (finalLen == 0) {
            revert ErrorsLib.E115_RebalanceResultsInNoAssets();
        }
        if (newWeights.length != finalLen) {
            revert ErrorsLib.E111_FinalAssetCountMismatch(finalLen, newWeights.length);
        }
        if (prices.length != finalLen) {
            revert ErrorsLib.E112_PricesLengthMismatch(newWeights.length, prices.length);
        }

        // --- Step 5: Validate weights sum and minimums ---
        uint256 totalWeight;
        for (uint256 i = 0; i < newWeights.length;) {
            if (newWeights[i] < MIN_WEIGHT) {
                revert ErrorsLib.E013_WeightBelowMinimum(newWeights[i], MIN_WEIGHT);
            }
            totalWeight += newWeights[i];
            unchecked { ++i; }
        }
        if (totalWeight != WEIGHT_SUM) {
            revert ErrorsLib.E014_InvalidWeightSum(totalWeight, WEIGHT_SUM);
        }

        // --- Step 6: Compute new inventory: qty[i] = (newWeights[i] * nav) / prices[i] ---
        for (uint256 i = 0; i < finalLen;) {
            if (prices[i] == 0) {
                revert ErrorsLib.E113_ZeroPriceInRebalance(i);
            }
            weights[i] = newWeights[i];
            inventory[i] = (newWeights[i] * nav) / prices[i];
            unchecked { ++i; }
        }

        // --- Step 7: Update ITP metadata ---
        itp.assetCount = finalLen;
        _itpNavs[itpId] = nav; // NAV preserved through rebalance

        // --- Step 8: Emit events ---
        // Build final arrays for event (read from storage)
        address[] memory finalAssets = _itpAssets[itpId];
        uint256[] memory finalWeights = new uint256[](finalLen);
        uint256[] memory finalInventory = new uint256[](finalLen);
        for (uint256 i = 0; i < finalLen;) {
            finalWeights[i] = weights[i];
            finalInventory[i] = inventory[i];
            unchecked { ++i; }
        }

        emit EventsLib.Rebalanced(itpId, finalAssets, finalWeights, finalInventory, nav);

        // Emit per-asset AssetTradeRequest events for inventory deltas
        _emitAssetTradeDeltas(finalAssets, finalInventory, prices, oldAssets, oldInventory, quoteTokens);
    }
}
