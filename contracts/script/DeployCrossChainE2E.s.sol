// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/mocks/MockERC20.sol";
import "../src/Governance.sol";
import "../src/registry/IssuerRegistry.sol";
import "../src/mocks/MockBitgetVault.sol";
import "../src/core/Index.sol";
import "../src/registry/AssetPairRegistry.sol";
import "../src/bridge/BridgeProxy.sol";
import "../src/bridge/BridgedItpFactory.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployCrossChainE2E - Cross-chain ITP Creation E2E (Story 6.21)
/// @notice Deploys ALL contracts (L3 + Bridge) on single L3 chain for E2E testing
contract DeployCrossChainE2E is Script {
    bytes32 constant BITGET_SOURCE = keccak256("BITGET");
    address constant MOCK_USDC_QUOTE = address(0xdead000000000000000000000000000000000001);

    // Storage to avoid stack issues
    address usdc;
    address indexProxy;
    address issuerRegistry;
    address assetPairRegistry;
    address mockBitgetVault;
    address bridgeProxy;
    address bridgedItpFactory;

    function run() external {
        console.log("=== CROSS-CHAIN E2E DEPLOYMENT ===");
        uint256 key = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address admin = vm.addr(key);

        vm.startBroadcast(key);

        // L3 Side
        // Story 7-6b: L3 USDC uses 18 decimals (internal protocol standard)
        usdc = address(new MockERC20("L3 USDC", "L3_USDC", 18));
        console.log("L3_USDC (18 dec):", usdc);

        Governance govImpl = new Governance();
        address governance = address(new ERC1967Proxy(address(govImpl), abi.encodeWithSelector(Governance.initialize.selector, admin)));
        console.log("Governance:", governance);

        address indexImpl = address(new Index());
        bytes memory indexInit = abi.encodeWithSelector(Index.initialize.selector, governance, usdc);
        indexProxy = address(new ERC1967Proxy(indexImpl, indexInit));
        console.log("Index:", indexProxy);

        IssuerRegistry regImpl = new IssuerRegistry();
        issuerRegistry = address(new ERC1967Proxy(address(regImpl), abi.encodeWithSelector(IssuerRegistry.initialize.selector, governance)));
        console.log("IssuerRegistry:", issuerRegistry);

        assetPairRegistry = address(new AssetPairRegistry(admin, true));
        console.log("AssetPairRegistry:", assetPairRegistry);

        MockBitgetVault vault = new MockBitgetVault();
        vault.initialize(admin);
        mockBitgetVault = address(vault);
        console.log("MockBitgetVault:", mockBitgetVault);

        Index(indexProxy).setIssuerRegistry(issuerRegistry);

        // Bridge Side
        address bridgeImpl = address(new BridgeProxy());
        bytes memory bridgeInit = abi.encodeWithSelector(
            BridgeProxy.initialize.selector,
            issuerRegistry,
            address(0),
            admin
        );
        bridgeProxy = address(new ERC1967Proxy(bridgeImpl, bridgeInit));
        console.log("BridgeProxy:", bridgeProxy);

        bridgedItpFactory = address(new BridgedItpFactory(bridgeProxy));
        console.log("BridgedItpFactory:", bridgedItpFactory);

        BridgeProxy(bridgeProxy).setBridgedItpFactory(bridgedItpFactory);

        // Set Index contract on BridgeProxy (needed for atomic ITP creation)
        BridgeProxy(bridgeProxy).setIndexContract(indexProxy);
        console.log("Index contract set on BridgeProxy");

        // Set authorized bridge on Index for cross-chain rebalance/transfer
        Index(indexProxy).setAuthorizedBridge(bridgeProxy);
        console.log("Authorized bridge set on Index");

        // Setup
        _registerIssuers();
        _whitelistAssets();

        address user = 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc;
        MockERC20(usdc).mint(user, 100_000 * 1e18);

        vm.stopBroadcast();

        _exportDeployment();
    }

    function _registerIssuers() internal {
        address[3] memory issuers = [
            address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8),
            address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC),
            address(0x90F79bf6EB2c4f870365E785982E1f101E93b906)
        ];
        for (uint256 i = 0; i < 3; i++) {
            // Real IssuerRegistry requires 128-byte G2 BLS pubkeys
            bytes memory blsPubkey = new bytes(128);
            for (uint256 j = 0; j < 128; j++) {
                blsPubkey[j] = bytes1(uint8(i + 1 + j));
            }
            // Deployer (admin) is the broadcast sender, so no vm.prank needed
            IssuerRegistry(issuerRegistry).addIssuer(issuers[i], bytes32(bytes("127.0.0.1:9000")), blsPubkey);
        }
        // Aggregated pubkey: empty by default (computed off-chain)
    }

    function _whitelistAssets() internal {
        AssetPairRegistry apr = AssetPairRegistry(assetPairRegistry);
        for (uint256 batch = 0; batch < 7; batch++) {
            uint256 start = batch * 100 + 1;
            uint256 end = batch == 6 ? 627 : (batch + 1) * 100;
            _batchWhitelist(apr, start, end);
            _batchActivate(apr, start, end);
        }
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

    function _exportDeployment() internal {
        string memory obj = "d";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "Index", indexProxy);
        vm.serializeAddress(obj, "USDC", usdc);
        vm.serializeAddress(obj, "IssuerRegistry", issuerRegistry);
        vm.serializeAddress(obj, "AssetPairRegistry", assetPairRegistry);
        vm.serializeAddress(obj, "MockBitgetVault", mockBitgetVault);
        vm.serializeAddress(obj, "BridgeProxy", bridgeProxy);
        string memory json = vm.serializeAddress(obj, "BridgedItpFactory", bridgedItpFactory);
        vm.writeJson(json, "../deployments/e2e-crosschain.json");
        console.log("Saved to deployments/e2e-crosschain.json");
    }
}
