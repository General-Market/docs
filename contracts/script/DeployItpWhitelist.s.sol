// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/registry/AssetPairRegistry.sol";
import "./helpers/DeployBLSHelper.sol";

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
contract DeployItpWhitelist is DeployBLSHelper {
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
        address issuerReg = vm.envOr("ISSUER_REGISTRY", address(0x1));
        registry = new AssetPairRegistry(admin, issuerReg);
        console.log("  AssetPairRegistry deployed:", address(registry));

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
        console.log("Phase 1: Propose Assets");

        uint256 deployerKey = _getDeployerKey();
        vm.startBroadcast(deployerKey);

        // Propose all 627 assets with real BLS signatures
        for (uint256 i = 1; i <= 627; i++) {
            address asset = assetIdToAddress(i);
            uint256 nonce = registry.getNonce();
            bytes32 msg_ = keccak256(abi.encode("PROPOSE_ASSET", block.chainid, address(registry), asset, nonce));
            registry.proposeAsset(asset, blsSign("0,1,2", msg_), 3, 7);
        }
        console.log("  All 627 assets proposed");

        // Warp past timelock, activate assets and propose pairs
        vm.warp(block.timestamp + 2 days + 1);
        console.log("");
        console.log("Phase 2: Activate Assets + Propose Pairs");
        for (uint256 i = 1; i <= 627; i++) {
            address asset = assetIdToAddress(i);
            registry.activateAsset(asset);
            uint256 nonce = registry.getNonce();
            bytes32 msg_ = keccak256(abi.encode("PROPOSE_PAIR", block.chainid, address(registry), asset, BITGET_SOURCE, MOCK_USDC, CEX_CHAIN_ID, nonce));
            registry.proposePair(asset, BITGET_SOURCE, MOCK_USDC, CEX_CHAIN_ID, blsSign("0,1,2", msg_), 3, 7);
        }
        console.log("  All 627 assets activated, pairs proposed");

        // Warp past timelock and activate pairs
        vm.warp(block.timestamp + 2 days + 1);
        console.log("");
        console.log("Phase 3: Activate Pairs");
        for (uint256 i = 1; i <= 627; i++) {
            address asset = assetIdToAddress(i);
            bytes32 pairId = registry.computePairId(asset, BITGET_SOURCE, MOCK_USDC, CEX_CHAIN_ID);
            registry.activatePair(pairId);
        }
        console.log("  All 627 pairs activated");

        vm.stopBroadcast();
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
