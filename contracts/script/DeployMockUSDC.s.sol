// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @title DeployMockUSDC - Deploy mock USDC tokens for local E2E testing
/// @notice Deploys L3Usdc (18 decimals) and/or SettlementUSDC (6 decimals)
contract DeployMockUSDC is Script {
    address public l3Usdc;
    address public settlementUsdc;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Check which token to deploy (or both)
        bool deployL3 = vm.envOr("DEPLOY_L3_USDC", true);
        bool deploySettlement = vm.envOr("DEPLOY_SETTLEMENT_USDC", true);

        console2.log("===========================================");
        console2.log("MOCK USDC DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Deploy L3 USDC:", deployL3);
        console2.log("Deploy Settlement USDC:", deploySettlement);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        if (deployL3) {
            // L3Usdc - USDC on Index L3 (18 decimals for L3 standard)
            MockERC20 l3Token = new MockERC20("Index L3 USDC", "L3USDC", 18);
            l3Usdc = address(l3Token);
            console2.log("L3Usdc deployed:", l3Usdc);
        }

        if (deploySettlement) {
            // SettlementUSDC - USDC on "mock Settlement" (6 decimals like real USDC)
            MockERC20 settlementToken = new MockERC20("Settlement USDC", "SettlementUSDC", 6);
            settlementUsdc = address(settlementToken);
            console2.log("SettlementUSDC deployed:", settlementUsdc);
        }

        vm.stopBroadcast();

        // Save deployment output
        _saveDeployment(deployer);

        console2.log("");
        console2.log("===========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("===========================================");
        if (deployL3) console2.log("L3_USDC:", l3Usdc);
        if (deploySettlement) console2.log("SETTLEMENT_USDC:", settlementUsdc);
    }

    function _saveDeployment(address deployer) internal {
        string memory json = string.concat(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "contracts": {\n',
            l3Usdc != address(0) ? string.concat('    "L3_USDC": "', vm.toString(l3Usdc), '"') : '',
            l3Usdc != address(0) && settlementUsdc != address(0) ? ',\n' : '\n',
            settlementUsdc != address(0) ? string.concat('    "SETTLEMENT_USDC": "', vm.toString(settlementUsdc), '"\n') : '',
            '  }\n',
            '}'
        );

        string memory outputPath = vm.envOr("DEPLOYMENT_OUTPUT", string("../deployments/mock-usdc.json"));
        vm.writeFile(outputPath, json);
        console2.log("Addresses saved to:", outputPath);
    }
}
