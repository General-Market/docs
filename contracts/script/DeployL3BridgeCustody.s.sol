// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/custody/L3BridgeCustody.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployL3BridgeCustody
/// @notice Deploy L3BridgeCustody for E2E testing
contract DeployL3BridgeCustody is Script {
    function run() external returns (address proxy) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address oracleRegistry = vm.envAddress("ORACLE_REGISTRY");
        address usdc = vm.envAddress("USDC");

        console.log("=== L3BridgeCustody Deployment ===");
        console.log("OracleRegistry:", oracleRegistry);
        console.log("USDC:", usdc);

        vm.startBroadcast(deployerKey);

        // Deploy implementation
        L3BridgeCustody impl = new L3BridgeCustody();
        console.log("Implementation:", address(impl));

        // Initialize data
        bytes memory initData = abi.encodeWithSelector(
            L3BridgeCustody.initialize.selector,
            oracleRegistry,
            usdc
        );

        // Deploy proxy
        ERC1967Proxy proxyContract = new ERC1967Proxy(address(impl), initData);
        proxy = address(proxyContract);
        console.log("Proxy:", proxy);

        vm.stopBroadcast();

        console.log("");
        console.log("L3BridgeCustody deployed at:", proxy);
    }
}
