// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/mocks/MockBitgetVault.sol";
import "../src/registry/AssetPairRegistry.sol";
import "../src/core/Investment.sol";
import "../src/bridge/BridgeProxy.sol";
import "../src/bridge/BridgedItpFactory.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./helpers/DeployBLSHelper.sol";

/// @title DeployBridgeE2E - Deploy Bridge + MockBitget on existing L3 deployment
/// @notice Uses existing OracleRegistry, Index, AssetPairRegistry from L3 deployment
contract DeployBridgeE2E is DeployBLSHelper {
    bytes32 constant BITGET_SOURCE = keccak256("BITGET");
    address constant MOCK_USDC_QUOTE = address(0xdead000000000000000000000000000000000001);

    function run() external {
        console.log("=== BRIDGE E2E DEPLOYMENT ===");

        // Get existing contract addresses from env or use deployed defaults
        address oracleRegistry = vm.envOr("ORACLE_REGISTRY_ADDRESS", address(0xae3DcC43AC2E735C43b2a2bCd9C25FcA00441785));
        address assetPairRegistry = vm.envOr("ASSET_PAIR_REGISTRY_ADDRESS", address(0x9705f5D06C229FAb0A284aBB12aA521eF7E8E070));
        address indexContract = vm.envOr("INDEX_ADDRESS", address(0xeD31026718e15Ffcff000831dD568a351354ADC2));

        console.log("Using existing contracts:");
        console.log("  OracleRegistry:", oracleRegistry);
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

        // Deploy BridgeProxy with existing OracleRegistry
        address bridgeImpl = address(new BridgeProxy());
        bytes memory bridgeInit = abi.encodeWithSelector(
            BridgeProxy.initialize.selector,
            oracleRegistry,
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

        // Set authorized bridge on Index for cross-chain rebalance/transfer
        Investment(indexContract).setAuthorizedBridge(bridgeProxy);
        console.log("Authorized bridge set on Index");

        // Whitelist 627 assets on AssetPairRegistry using propose/activate flow with real BLS
        console.log("Whitelisting 627 assets (propose/activate flow with real BLS)...");
        AssetPairRegistry apr = AssetPairRegistry(assetPairRegistry);

        for (uint256 i = 1; i <= 627; i++) {
            address asset = address(uint160(i));
            uint256 nonce = apr.getNonce();
            bytes32 msg_ = keccak256(abi.encode("PROPOSE_ASSET", block.chainid, address(apr), asset, nonce));
            apr.proposeAsset(asset, blsSign("0,1,2", msg_), 3, 7);
        }
        vm.warp(block.timestamp + 2 days + 1);
        for (uint256 i = 1; i <= 627; i++) {
            address asset = address(uint160(i));
            apr.activateAsset(asset);
            uint256 nonce = apr.getNonce();
            bytes32 msg_ = keccak256(abi.encode("PROPOSE_PAIR", block.chainid, address(apr), asset, BITGET_SOURCE, MOCK_USDC_QUOTE, uint256(0), nonce));
            apr.proposePair(asset, BITGET_SOURCE, MOCK_USDC_QUOTE, 0, blsSign("0,1,2", msg_), 3, 7);
        }
        vm.warp(block.timestamp + 2 days + 1);
        for (uint256 i = 1; i <= 627; i++) {
            address asset = address(uint160(i));
            bytes32 pairId = apr.computePairId(asset, BITGET_SOURCE, MOCK_USDC_QUOTE, 0);
            apr.activatePair(pairId);
        }
        console.log("627 assets whitelisted and activated");

        vm.stopBroadcast();

        // Export deployment
        _exportDeployment(oracleRegistry, assetPairRegistry, indexContract, mockBitgetVault, bridgeProxy, bridgedItpFactory);
    }

    function _exportDeployment(
        address oracleRegistry,
        address assetPairRegistry,
        address indexContract,
        address mockBitgetVault,
        address bridgeProxy,
        address bridgedItpFactory
    ) internal {
        string memory obj = "d";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "OracleRegistry", oracleRegistry);
        vm.serializeAddress(obj, "AssetPairRegistry", assetPairRegistry);
        vm.serializeAddress(obj, "Index", indexContract);
        vm.serializeAddress(obj, "MockBitgetVault", mockBitgetVault);
        vm.serializeAddress(obj, "BridgeProxy", bridgeProxy);
        string memory json = vm.serializeAddress(obj, "BridgedItpFactory", bridgedItpFactory);
        vm.writeJson(json, "../deployments/e2e-bridge.json");
        console.log("Saved to deployments/e2e-bridge.json");
    }
}
