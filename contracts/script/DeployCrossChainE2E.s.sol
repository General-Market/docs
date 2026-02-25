// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/mocks/MockERC20.sol";
import "../src/Governance.sol";
import "../src/registry/IssuerRegistry.sol";
import "../src/mocks/MockBitgetVault.sol";
import "../src/core/Investment.sol";
import "../src/registry/AssetPairRegistry.sol";
import "../src/bridge/BridgeProxy.sol";
import "../src/bridge/BridgedItpFactory.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./helpers/DeployBLSHelper.sol";

/// @title DeployCrossChainE2E - Cross-chain ITP Creation E2E (Story 6.21)
/// @notice Deploys ALL contracts (L3 + Bridge) on single L3 chain for E2E testing
contract DeployCrossChainE2E is DeployBLSHelper {
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

        address indexImpl = address(new Investment());
        bytes memory indexInit = abi.encodeWithSelector(Investment.initialize.selector, governance, usdc);
        indexProxy = address(new ERC1967Proxy(indexImpl, indexInit));
        console.log("Index:", indexProxy);

        IssuerRegistry regImpl = new IssuerRegistry();
        issuerRegistry = address(new ERC1967Proxy(address(regImpl), abi.encodeWithSelector(IssuerRegistry.initialize.selector, governance)));
        console.log("IssuerRegistry:", issuerRegistry);

        assetPairRegistry = address(new AssetPairRegistry(admin, issuerRegistry));
        console.log("AssetPairRegistry:", assetPairRegistry);

        MockBitgetVault vault = new MockBitgetVault();
        vault.initialize(admin);
        mockBitgetVault = address(vault);
        console.log("MockBitgetVault:", mockBitgetVault);

        Investment(indexProxy).setIssuerRegistry(issuerRegistry);

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
        Investment(indexProxy).setAuthorizedBridge(bridgeProxy);
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

        // Must snapshot (setAggregatedPubkey) after EACH addIssuer due to PendingSnapshot constraint
        // Issuer 0
        {
            bytes memory pubkey = blsPubkey(0);
            bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, issuerRegistry, issuers[0], pubkey));
            bytes memory popSig = blsSign("0", popMsg);
            IssuerRegistry(issuerRegistry).addIssuer(issuers[0], bytes32(bytes("127.0.0.1:9000")), pubkey, popSig);
            IssuerRegistry(issuerRegistry).setAggregatedPubkey(blsPubkey(0), 1);
        }

        // Issuer 1
        {
            bytes memory pubkey = blsPubkey(1);
            bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, issuerRegistry, issuers[1], pubkey));
            bytes memory popSig = blsSign("1", popMsg);
            IssuerRegistry(issuerRegistry).addIssuer(issuers[1], bytes32(bytes("127.0.0.1:9000")), pubkey, popSig);
            IssuerRegistry(issuerRegistry).setAggregatedPubkey(blsAggPubkey("0,1"), 2);
        }

        // Issuer 2
        {
            bytes memory pubkey = blsPubkey(2);
            bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, issuerRegistry, issuers[2], pubkey));
            bytes memory popSig = blsSign("2", popMsg);
            IssuerRegistry(issuerRegistry).addIssuer(issuers[2], bytes32(bytes("127.0.0.1:9000")), pubkey, popSig);
            IssuerRegistry(issuerRegistry).setAggregatedPubkey(blsAggPubkey("0,1,2"), 3);
        }
    }

    function _whitelistAssets() internal {
        AssetPairRegistry apr = AssetPairRegistry(assetPairRegistry);

        // Propose all 627 assets with real BLS signatures
        // referenceNonce=0, signersBitmask=7 (3 test issuers = bits 0,1,2)
        for (uint256 i = 1; i <= 627; i++) {
            address asset = address(uint160(i));
            uint256 nonce = apr.getNonce();
            bytes32 msg_ = keccak256(abi.encode("PROPOSE_ASSET", block.chainid, address(apr), asset, nonce));
            apr.proposeAsset(asset, blsSign("0,1,2", msg_), 3, 7);
        }
        // Warp past timelock and activate assets + propose pairs
        vm.warp(block.timestamp + 2 days + 1);
        for (uint256 i = 1; i <= 627; i++) {
            address asset = address(uint160(i));
            apr.activateAsset(asset);
            uint256 nonce = apr.getNonce();
            bytes32 msg_ = keccak256(abi.encode("PROPOSE_PAIR", block.chainid, address(apr), asset, BITGET_SOURCE, MOCK_USDC_QUOTE, uint256(0), nonce));
            apr.proposePair(asset, BITGET_SOURCE, MOCK_USDC_QUOTE, 0, blsSign("0,1,2", msg_), 3, 7);
        }
        // Warp past timelock and activate pairs
        vm.warp(block.timestamp + 2 days + 1);
        for (uint256 i = 1; i <= 627; i++) {
            address asset = address(uint160(i));
            bytes32 pairId = apr.computePairId(asset, BITGET_SOURCE, MOCK_USDC_QUOTE, 0);
            apr.activatePair(pairId);
        }
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
