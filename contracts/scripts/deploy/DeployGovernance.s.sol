// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Governance} from "../../src/Governance.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployGovernance - Deployment script for Governance contract
/// @notice Deploys Governance with UUPS proxy pattern
/// @dev Run with: forge script scripts/deploy/DeployGovernance.s.sol --rpc-url $RPC_URL --broadcast
contract DeployGovernance is Script {
    function run() public returns (address proxy, address implementation) {
        // Get deployer from environment - required for broadcast
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));

        // In broadcast mode, PRIVATE_KEY is required
        if (deployerPrivateKey == 0) {
            // Allow simulation without key (msg.sender used), but warn
            console.log("WARNING: No PRIVATE_KEY set. Using msg.sender for simulation only.");
        }

        address deployer = deployerPrivateKey != 0 ? vm.addr(deployerPrivateKey) : msg.sender;

        // Admin can be different from deployer
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);

        console.log("Deployer:", deployer);
        console.log("Initial Admin:", admin);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy implementation
        Governance impl = new Governance();
        implementation = address(impl);
        console.log("Implementation deployed at:", implementation);

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(Governance.initialize.selector, admin);

        // Deploy proxy pointing to implementation
        ERC1967Proxy proxyContract = new ERC1967Proxy(implementation, initData);
        proxy = address(proxyContract);
        console.log("Proxy deployed at:", proxy);

        // Verify deployment
        Governance governance = Governance(proxy);
        require(governance.admin() == admin, "Admin not set correctly");
        require(!governance.isPaused(), "System should not be paused initially");

        console.log("Governance deployment verified successfully");

        vm.stopBroadcast();

        return (proxy, implementation);
    }
}
