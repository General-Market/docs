// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BridgeProxy} from "../../src/bridge/BridgeProxy.sol";
import {BridgedItpFactory} from "../../src/bridge/BridgedItpFactory.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployBridgeProxy - Deployment script for BridgeProxy and BridgedItpFactory
/// @notice Deploys BridgeProxy with UUPS proxy pattern and BridgedItpFactory
/// @dev Run with: forge script scripts/deploy/DeployBridgeProxy.s.sol --rpc-url $RPC_URL --broadcast
///
/// Required environment variables:
///   PRIVATE_KEY - Deployer private key
///   ISSUER_REGISTRY - IssuerRegistry address on this chain
///
/// Optional environment variables:
///   ADMIN_ADDRESS - Admin address (defaults to deployer)
///
/// Example:
///   PRIVATE_KEY=0x... ISSUER_REGISTRY=0x... forge script scripts/deploy/DeployBridgeProxy.s.sol \
///     --rpc-url https://arb1.arbitrum.io/rpc --broadcast --verify
contract DeployBridgeProxy is Script {
    function run() public returns (
        address proxy,
        address implementation,
        address factory
    ) {
        // Get deployer from environment - required for broadcast
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));

        // In broadcast mode, PRIVATE_KEY is required
        if (deployerPrivateKey == 0) {
            console.log("WARNING: No PRIVATE_KEY set. Using msg.sender for simulation only.");
        }

        address deployer = deployerPrivateKey != 0 ? vm.addr(deployerPrivateKey) : msg.sender;

        // Admin can be different from deployer
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);

        // IssuerRegistry is required
        address issuerRegistry = vm.envAddress("ISSUER_REGISTRY");
        require(issuerRegistry != address(0), "ISSUER_REGISTRY not set");

        console.log("=== BridgeProxy Deployment ===");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Admin:", admin);
        console.log("IssuerRegistry:", issuerRegistry);

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy BridgeProxy implementation
        BridgeProxy impl = new BridgeProxy();
        implementation = address(impl);
        console.log("BridgeProxy implementation:", implementation);

        // Step 2: Prepare initialization data (factory address will be set after factory deployment)
        // Initialize with zero factory address first
        bytes memory initData = abi.encodeWithSelector(
            BridgeProxy.initialize.selector,
            issuerRegistry,
            address(0), // Factory will be set after deployment
            admin
        );

        // Step 3: Deploy proxy
        ERC1967Proxy proxyContract = new ERC1967Proxy(implementation, initData);
        proxy = address(proxyContract);
        console.log("BridgeProxy proxy:", proxy);

        // Step 4: Deploy BridgedItpFactory with proxy address
        BridgedItpFactory factoryContract = new BridgedItpFactory(proxy);
        factory = address(factoryContract);
        console.log("BridgedItpFactory:", factory);

        // Step 5: Set factory in BridgeProxy
        BridgeProxy(proxy).setBridgedItpFactory(factory);
        console.log("Factory set in BridgeProxy");

        // Verify deployment
        BridgeProxy bridgeProxy = BridgeProxy(proxy);
        require(bridgeProxy.owner() == admin, "Owner not set correctly");
        require(address(bridgeProxy.issuerRegistry()) == issuerRegistry, "IssuerRegistry not set correctly");
        require(address(bridgeProxy.bridgedItpFactory()) == factory, "Factory not set correctly");
        require(!bridgeProxy.paused(), "Should not be paused initially");

        console.log("=== Deployment Verified ===");
        console.log("");
        console.log("Add to deployment config:");
        console.log("  bridgeProxy:", proxy);
        console.log("  bridgeProxyImpl:", implementation);
        console.log("  bridgedItpFactory:", factory);

        vm.stopBroadcast();

        return (proxy, implementation, factory);
    }

    /// @notice Deploy for local testing (Anvil)
    /// @dev Uses default Anvil private key
    function runLocal() public returns (
        address proxy,
        address implementation,
        address factory
    ) {
        // Default Anvil private key (first account)
        uint256 anvilKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

        // For local testing, we may not have an IssuerRegistry deployed
        // Deploy a mock or use address(0) for testing
        address mockRegistry = vm.envOr("ISSUER_REGISTRY", address(0x1)); // Placeholder

        vm.startBroadcast(anvilKey);

        // Deploy implementation
        BridgeProxy impl = new BridgeProxy();
        implementation = address(impl);

        // Initialize with mock registry
        bytes memory initData = abi.encodeWithSelector(
            BridgeProxy.initialize.selector,
            mockRegistry,
            address(0),
            vm.addr(anvilKey)
        );

        // Deploy proxy
        ERC1967Proxy proxyContract = new ERC1967Proxy(implementation, initData);
        proxy = address(proxyContract);

        // Deploy factory
        BridgedItpFactory factoryContract = new BridgedItpFactory(proxy);
        factory = address(factoryContract);

        // Set factory
        BridgeProxy(proxy).setBridgedItpFactory(factory);

        console.log("Local deployment complete:");
        console.log("  BridgeProxy:", proxy);
        console.log("  BridgeProxyImpl:", implementation);
        console.log("  BridgedItpFactory:", factory);

        vm.stopBroadcast();

        return (proxy, implementation, factory);
    }
}
