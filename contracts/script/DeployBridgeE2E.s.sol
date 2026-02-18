// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/mocks/MockBitgetVault.sol";
import "../src/registry/AssetPairRegistry.sol";
import "../src/core/Index.sol";
import "../src/bridge/BridgeProxy.sol";
import "../src/bridge/BridgedItpFactory.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployBridgeE2E - Deploy Bridge + MockBitget on existing L3 deployment
/// @notice Uses existing IssuerRegistry, Index, AssetPairRegistry from L3 deployment
contract DeployBridgeE2E is Script {
    bytes32 constant BITGET_SOURCE = keccak256("BITGET");
    address constant MOCK_USDC_QUOTE = address(0xdead000000000000000000000000000000000001);

    function run() external {
        console.log("=== BRIDGE E2E DEPLOYMENT ===");

        // Get existing contract addresses from env or use deployed defaults
        address issuerRegistry = vm.envOr("ISSUER_REGISTRY_ADDRESS", address(0xae3DcC43AC2E735C43b2a2bCd9C25FcA00441785));
        address assetPairRegistry = vm.envOr("ASSET_PAIR_REGISTRY_ADDRESS", address(0x9705f5D06C229FAb0A284aBB12aA521eF7E8E070));
        address indexContract = vm.envOr("INDEX_ADDRESS", address(0xeD31026718e15Ffcff000831dD568a351354ADC2));

        console.log("Using existing contracts:");
        console.log("  IssuerRegistry:", issuerRegistry);
        console.log("  AssetPairRegistry:", assetPairRegistry);
        console.log("  Index:", indexContract);

        uint256 key = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(key != 0, "No private key set");
        address admin = vm.addr(key);
        console.log("  Admin:", admin);

        vm.startBroadcast(key);

        // Deploy MockBitgetVault
        MockBitgetVault vault = new MockBitgetVault();
        vault.initialize(admin);
        address mockBitgetVault = address(vault);
        console.log("MockBitgetVault:", mockBitgetVault);

        // Deploy BridgeProxy with existing IssuerRegistry
        address bridgeImpl = address(new BridgeProxy());
        bytes memory bridgeInit = abi.encodeWithSelector(
            BridgeProxy.initialize.selector,
            issuerRegistry,
            address(0), // factory not yet deployed
            admin
        );
        address bridgeProxy = address(new ERC1967Proxy(bridgeImpl, bridgeInit));
        console.log("BridgeProxy:", bridgeProxy);

        // Deploy BridgedItpFactory
        address bridgedItpFactory = address(new BridgedItpFactory(bridgeProxy));
        console.log("BridgedItpFactory:", bridgedItpFactory);

        // Wire factory to bridge
        BridgeProxy(bridgeProxy).setBridgedItpFactory(bridgedItpFactory);

        // Set Index contract on BridgeProxy (needed for atomic ITP creation)
        BridgeProxy(bridgeProxy).setIndexContract(indexContract);
        console.log("Index contract set on BridgeProxy");

        // Set signer threshold to 2 (2-of-3)
        BridgeProxy(bridgeProxy).setSignerThreshold(2);
        console.log("Signer threshold set to 2");

        // Set authorized bridge on Index for cross-chain rebalance/transfer
        Index(indexContract).setAuthorizedBridge(bridgeProxy);
        console.log("Authorized bridge set on Index");

        // Whitelist 627 assets on AssetPairRegistry
        console.log("Whitelisting 627 assets...");
        AssetPairRegistry apr = AssetPairRegistry(assetPairRegistry);

        for (uint256 batch = 0; batch < 7; batch++) {
            uint256 start = batch * 100 + 1;
            uint256 end = batch == 6 ? 627 : (batch + 1) * 100;
            _batchWhitelist(apr, start, end);
            _batchActivate(apr, start, end);
        }
        console.log("627 assets whitelisted and activated");

        vm.stopBroadcast();

        // Export deployment
        _exportDeployment(issuerRegistry, assetPairRegistry, indexContract, mockBitgetVault, bridgeProxy, bridgedItpFactory);
    }

    function _batchWhitelist(AssetPairRegistry apr, uint256 start, uint256 end) internal {
        uint256 count = end - start + 1;
        address[] memory assets = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            assets[i] = address(uint160(start + i));
        }
        apr.adminBatchWhitelistAssets(assets);
    }

    function _batchActivate(AssetPairRegistry apr, uint256 start, uint256 end) internal {
        uint256 count = end - start + 1;
        address[] memory assets = new address[](count);
        bytes32[] memory sources = new bytes32[](count);
        address[] memory quotes = new address[](count);
        uint256[] memory chains = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            assets[i] = address(uint160(start + i));
            sources[i] = BITGET_SOURCE;
            quotes[i] = MOCK_USDC_QUOTE;
            chains[i] = 0;
        }
        apr.adminBatchActivatePairs(assets, sources, quotes, chains);
    }

    function _exportDeployment(
        address issuerRegistry,
        address assetPairRegistry,
        address indexContract,
        address mockBitgetVault,
        address bridgeProxy,
        address bridgedItpFactory
    ) internal {
        string memory obj = "d";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "IssuerRegistry", issuerRegistry);
        vm.serializeAddress(obj, "AssetPairRegistry", assetPairRegistry);
        vm.serializeAddress(obj, "Index", indexContract);
        vm.serializeAddress(obj, "MockBitgetVault", mockBitgetVault);
        vm.serializeAddress(obj, "BridgeProxy", bridgeProxy);
        string memory json = vm.serializeAddress(obj, "BridgedItpFactory", bridgedItpFactory);
        vm.writeJson(json, "../deployments/e2e-bridge.json");
        console.log("Saved to deployments/e2e-bridge.json");
    }
}
