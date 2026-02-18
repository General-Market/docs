// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @title DeployMockUSDC - Deploy mock USDC tokens for local E2E testing
/// @notice Deploys L3Usdc (18 decimals) and/or ArbUSDC (6 decimals)
contract DeployMockUSDC is Script {
    address public l3Usdc;
    address public arbUsdc;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Check which token to deploy (or both)
        bool deployL3 = vm.envOr("DEPLOY_L3_USDC", true);
        bool deployArb = vm.envOr("DEPLOY_ARB_USDC", true);

        console2.log("===========================================");
        console2.log("MOCK USDC DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Deploy L3 USDC:", deployL3);
        console2.log("Deploy Arb USDC:", deployArb);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        if (deployL3) {
            // L3Usdc - USDC on Index L3 (18 decimals for L3 standard)
            MockERC20 l3Token = new MockERC20("Index L3 USDC", "L3USDC", 18);
            l3Usdc = address(l3Token);
            console2.log("L3Usdc deployed:", l3Usdc);
        }

        if (deployArb) {
            // ArbUSDC - USDC on "mock Arbitrum" (6 decimals like real USDC)
            MockERC20 arbToken = new MockERC20("Arbitrum USDC", "ArbUSDC", 6);
            arbUsdc = address(arbToken);
            console2.log("ArbUSDC deployed:", arbUsdc);
        }

        vm.stopBroadcast();

        // Save deployment output
        _saveDeployment(deployer);

        console2.log("");
        console2.log("===========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("===========================================");
        if (deployL3) console2.log("L3_USDC:", l3Usdc);
        if (deployArb) console2.log("ARB_USDC:", arbUsdc);
    }

    function _saveDeployment(address deployer) internal {
        string memory json = string.concat(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "contracts": {\n',
            l3Usdc != address(0) ? string.concat('    "L3_USDC": "', vm.toString(l3Usdc), '"') : '',
            l3Usdc != address(0) && arbUsdc != address(0) ? ',\n' : '\n',
            arbUsdc != address(0) ? string.concat('    "ARB_USDC": "', vm.toString(arbUsdc), '"\n') : '',
            '  }\n',
            '}'
        );

        string memory outputPath = vm.envOr("DEPLOYMENT_OUTPUT", string("../deployments/mock-usdc.json"));
        vm.writeFile(outputPath, json);
        console2.log("Addresses saved to:", outputPath);
    }
}
