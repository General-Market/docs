// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {OracleRegistry} from "../../src/registry/OracleRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployOracleRegistry - Deployment script for OracleRegistry
/// @notice Deploys OracleRegistry with UUPS proxy pattern
/// @dev Story 2.12 - Task 12
contract DeployOracleRegistry is Script {
    function run() external returns (address proxy, address implementation) {
        // Get deployment parameters from environment
        address governance = vm.envAddress("GOVERNANCE_ADDRESS");

        console2.log("Deploying OracleRegistry...");
        console2.log("Governance:", governance);

        vm.startBroadcast();

        // Deploy implementation
        implementation = address(new OracleRegistry());
        console2.log("Implementation deployed at:", implementation);

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            OracleRegistry.initialize.selector,
            governance
        );

        // Deploy proxy
        proxy = address(new ERC1967Proxy(implementation, initData));
        console2.log("Proxy deployed at:", proxy);

        vm.stopBroadcast();

        // Verify deployment
        OracleRegistry registry = OracleRegistry(proxy);
        require(address(registry.governance()) == governance, "Governance mismatch");
        require(registry.activeOracleCount() == 0, "Active count should be 0");

        console2.log("Deployment verified successfully!");
    }

    /// @notice Deploy with specific governance address (for testing)
    function deploy(address governance) external returns (address proxy, address implementation) {
        vm.startBroadcast();

        implementation = address(new OracleRegistry());

        bytes memory initData = abi.encodeWithSelector(
            OracleRegistry.initialize.selector,
            governance
        );

        proxy = address(new ERC1967Proxy(implementation, initData));

        vm.stopBroadcast();
    }
}
