// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IssuerRegistry} from "../../src/registry/IssuerRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployIssuerRegistry - Deployment script for IssuerRegistry
/// @notice Deploys IssuerRegistry with UUPS proxy pattern
/// @dev Story 2.12 - Task 12
contract DeployIssuerRegistry is Script {
    function run() external returns (address proxy, address implementation) {
        // Get deployment parameters from environment
        address governance = vm.envAddress("GOVERNANCE_ADDRESS");

        console2.log("Deploying IssuerRegistry...");
        console2.log("Governance:", governance);

        vm.startBroadcast();

        // Deploy implementation
        implementation = address(new IssuerRegistry());
        console2.log("Implementation deployed at:", implementation);

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            IssuerRegistry.initialize.selector,
            governance
        );

        // Deploy proxy
        proxy = address(new ERC1967Proxy(implementation, initData));
        console2.log("Proxy deployed at:", proxy);

        vm.stopBroadcast();

        // Verify deployment
        IssuerRegistry registry = IssuerRegistry(proxy);
        require(address(registry.governance()) == governance, "Governance mismatch");
        require(registry.activeIssuerCount() == 0, "Active count should be 0");

        console2.log("Deployment verified successfully!");
    }

    /// @notice Deploy with specific governance address (for testing)
    function deploy(address governance) external returns (address proxy, address implementation) {
        vm.startBroadcast();

        implementation = address(new IssuerRegistry());

        bytes memory initData = abi.encodeWithSelector(
            IssuerRegistry.initialize.selector,
            governance
        );

        proxy = address(new ERC1967Proxy(implementation, initData));

        vm.stopBroadcast();
    }
}
