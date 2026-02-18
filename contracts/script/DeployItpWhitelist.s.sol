// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/registry/AssetPairRegistry.sol";

/// @title DeployItpWhitelist - Whitelist 627 tradeable assets for E2E testing
/// @notice Creates SYNTHETIC asset addresses (derived from asset IDs) and whitelists them with Bitget pairs
/// @dev For Story 6.20 Frontend ITP Creation E2E Test
/// @dev IMPORTANT: This script does NOT use real ERC20 token addresses from assets.json.
///      Instead, it creates deterministic addresses from asset IDs (1-627) using assetIdToAddress().
///      Example: Asset 110 (Bitcoin) → address(0x000...006E)
///      This is suitable for E2E testing where we verify the whitelist flow, not actual token transfers.
/// @dev TERMINOLOGY:
///      - Asset = Individual tradeable crypto (Bitcoin, Ethereum, etc.) - 627 in assets.json
///      - Pair = Trading configuration (asset + source + quote token + chain)
///      - ITP = Index Tracking Product - user-created basket/ETF containing assets
contract DeployItpWhitelist is Script {
    // ============ CONSTANTS ============

    uint256 public constant CHAIN_ID = 111222333;

    // Source identifiers for trading venues
    bytes32 public constant BITGET_SOURCE = keccak256("BITGET");

    // Quote token for all pairs (USDC on CEX, chainId=0)
    address public constant MOCK_USDC = address(0xdead000000000000000000000000000000000001);

    // CEX pairs have chainId=0 (off-chain trading)
    uint256 public constant CEX_CHAIN_ID = 0;

    // ============ STATE ============

    AssetPairRegistry public registry;

    // We'll create synthetic asset addresses for each asset ID
    // Address = 0x{id} where id is zero-padded to 40 hex chars
    function assetIdToAddress(uint256 assetId) public pure returns (address) {
        // Create deterministic address from asset ID
        // Format: 0x0000000000000000000000000000000000{id:06x}
        return address(uint160(assetId));
    }

    function run() external {
        _logHeader();

        address registryAddr = vm.envOr("ASSET_PAIR_REGISTRY", address(0));
        if (registryAddr == address(0)) {
            console.log("  Deploying new AssetPairRegistry...");
            _deployRegistry();
        } else {
            console.log("  Using existing AssetPairRegistry:", registryAddr);
            registry = AssetPairRegistry(registryAddr);
        }

        _whitelistAllAssets();
        _verifyWhitelist();
        _logComplete();
    }

    function _logHeader() internal view {
        console.log("===========================================");
        console.log("ASSET WHITELIST DEPLOYMENT (Story 6.20)");
        console.log("===========================================");
        console.log("Whitelisting 627 tradeable assets for ITP creation");
        console.log("Chain ID:", block.chainid);
        console.log("");
    }

    function _deployRegistry() internal {
        uint256 deployerKey = _getDeployerKey();
        vm.startBroadcast(deployerKey);

        address admin = vm.addr(deployerKey);
        // Enable test mode for E2E testing (allows admin batch functions)
        registry = new AssetPairRegistry(admin, true);
        console.log("  AssetPairRegistry deployed:", address(registry));
        console.log("  Test mode enabled: true");

        vm.stopBroadcast();
    }

    function _getDeployerKey() internal view returns (uint256) {
        uint256 DEFAULT_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        if (block.chainid == CHAIN_ID) {
            return vm.envOr("PRIVATE_KEY", DEFAULT_KEY);
        }
        uint256 key = vm.envUint("PRIVATE_KEY");
        require(key != DEFAULT_KEY, "Cannot use default Anvil key on non-local chain");
        return key;
    }

    function _whitelistAllAssets() internal {
        console.log("");
        console.log("Phase 1: Whitelist Assets");

        uint256 deployerKey = _getDeployerKey();
        vm.startBroadcast(deployerKey);

        // Batch 1: Asset IDs 1-100
        _whitelistAssetBatch(1, 100);

        // Batch 2: Asset IDs 101-200
        _whitelistAssetBatch(101, 200);

        // Batch 3: Asset IDs 201-300
        _whitelistAssetBatch(201, 300);

        // Batch 4: Asset IDs 301-400
        _whitelistAssetBatch(301, 400);

        // Batch 5: Asset IDs 401-500
        _whitelistAssetBatch(401, 500);

        // Batch 6: Asset IDs 501-600
        _whitelistAssetBatch(501, 600);

        // Batch 7: Asset IDs 601-627
        _whitelistAssetBatch(601, 627);

        console.log("  All 627 assets whitelisted");

        console.log("");
        console.log("Phase 2: Activate Pairs");

        // Same batches for pairs
        _activatePairBatch(1, 100);
        _activatePairBatch(101, 200);
        _activatePairBatch(201, 300);
        _activatePairBatch(301, 400);
        _activatePairBatch(401, 500);
        _activatePairBatch(501, 600);
        _activatePairBatch(601, 627);

        console.log("  All 627 pairs activated");

        vm.stopBroadcast();
    }

    function _whitelistAssetBatch(uint256 startId, uint256 endId) internal {
        uint256 count = endId - startId + 1;
        address[] memory assets = new address[](count);

        for (uint256 i = 0; i < count;) {
            uint256 assetId = startId + i;
            assets[i] = assetIdToAddress(assetId);
            unchecked { ++i; }
        }

        registry.adminBatchWhitelistAssets(assets);
        console.log("  Whitelisted assets", startId, "-", endId);
    }

    function _activatePairBatch(uint256 startId, uint256 endId) internal {
        uint256 count = endId - startId + 1;
        address[] memory assets = new address[](count);
        bytes32[] memory sources = new bytes32[](count);
        address[] memory quoteTokens = new address[](count);
        uint256[] memory chainIds = new uint256[](count);

        for (uint256 i = 0; i < count;) {
            uint256 assetId = startId + i;
            assets[i] = assetIdToAddress(assetId);
            sources[i] = BITGET_SOURCE;
            quoteTokens[i] = MOCK_USDC;
            chainIds[i] = CEX_CHAIN_ID;
            unchecked { ++i; }
        }

        registry.adminBatchActivatePairs(assets, sources, quoteTokens, chainIds);
        console.log("  Activated pairs", startId, "-", endId);
    }

    function _verifyWhitelist() internal view {
        console.log("");
        console.log("Phase 3: Verify Whitelist");

        // Sample check: verify a few asset IDs
        uint256[] memory sampleIds = new uint256[](5);
        sampleIds[0] = 1;    // First
        sampleIds[1] = 110;  // Bitcoin
        sampleIds[2] = 193;  // Ethereum
        sampleIds[3] = 494;  // Solana
        sampleIds[4] = 627;  // Last

        for (uint256 i = 0; i < sampleIds.length;) {
            address asset = assetIdToAddress(sampleIds[i]);
            bool isWhitelisted = registry.isAssetWhitelisted(asset);

            bytes32 pairId = registry.computePairId(asset, BITGET_SOURCE, MOCK_USDC, CEX_CHAIN_ID);
            bool isPairActive = registry.isPairActive(pairId);

            console.log("  Asset %d: Whitelisted=%s Pair=%s", sampleIds[i], isWhitelisted ? "OK" : "FAIL", isPairActive ? "OK" : "FAIL");
            unchecked { ++i; }
        }

        // Get total counts
        address[] memory activeAssets = registry.getActiveAssets();
        bytes32[] memory activePairs = registry.getActivePairs();
        console.log("  Total active assets:", activeAssets.length);
        console.log("  Total active pairs:", activePairs.length);
    }

    function _logComplete() internal view {
        console.log("");
        console.log("===========================================");
        console.log("ASSET WHITELIST COMPLETE");
        console.log("===========================================");
        console.log("AssetPairRegistry:", address(registry));
        console.log("Total assets whitelisted: 627");
        console.log("");
        console.log("Asset address format: assetIdToAddress(assetId)");
        console.log("  Asset 110 (BTC):", assetIdToAddress(110));
        console.log("  Asset 193 (ETH):", assetIdToAddress(193));
        console.log("  Asset 494 (SOL):", assetIdToAddress(494));
        console.log("===========================================");
    }
}
