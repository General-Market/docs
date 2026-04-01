// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VisionVault} from "../src/vision/VisionVault.sol";
import {VisionVaultFactory} from "../src/vision/VisionVaultFactory.sol";

/// @title DeployVisionVaults - Deploy VisionVault implementation and factory
/// @notice Deploys the VisionVault implementation contract (used as EIP-1167 clone template)
///         and the VisionVaultFactory for creating manager-controlled vaults.
///
/// Required env vars:
///   - VISION_ADDRESS: address of Vision contract on L3
///   - USDC_ADDRESS: address of L3 USDC token (18 decimals)
///   - DEPLOYER_PRIVATE_KEY: deployer account private key
contract DeployVisionVaults is Script {
    address public vaultImplementation;
    address public vaultFactory;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address vision = vm.envAddress("VISION_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");

        console.log("===========================================");
        console.log("VISION VAULT DEPLOYMENT");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Vision:", vision);
        console.log("USDC:", usdc);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy VisionVault implementation contract
        VisionVault impl = new VisionVault();
        vaultImplementation = address(impl);
        console.log("  VisionVault implementation:", vaultImplementation);

        // Deploy VisionVaultFactory
        VisionVaultFactory factory = new VisionVaultFactory(
            vaultImplementation,
            vision,
            usdc
        );
        vaultFactory = address(factory);
        console.log("  VisionVaultFactory:", vaultFactory);

        vm.stopBroadcast();

        // Export deployment JSON
        _exportDeployment(deployer);

        console.log("");
        console.log("===========================================");
        console.log("VISION VAULT DEPLOYMENT COMPLETE");
        console.log("===========================================");
        console.log("VisionVault Implementation:", vaultImplementation);
        console.log("VisionVaultFactory:", vaultFactory);
        console.log("");
    }

    function _exportDeployment(address deployer) internal {
        string memory json = string.concat(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "contracts": {\n',
            '    "VisionVault": "', vm.toString(vaultImplementation), '",\n',
            '    "VisionVaultFactory": "', vm.toString(vaultFactory), '"\n',
            '  }\n',
            '}'
        );
        vm.writeFile("../deployments/vision-vault-deployment.json", json);
        console.log("  Saved to deployments/vision-vault-deployment.json");
    }
}
