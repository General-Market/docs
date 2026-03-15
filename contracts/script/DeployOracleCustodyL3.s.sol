// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BLSCustody} from "../src/core/BLSCustody.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployOracleCustodyL3 - Deploy OracleCustody contract on L3
/// @notice Deploys BLSCustody as OracleCustody L3 for holding L3Usdc after bridge from Settlement
/// @dev Story 7.7: OracleCustody L3 is a BLSCustody instance with Index contract whitelisted
///      Uses existing OracleRegistry for BLS verification
contract DeployOracleCustodyL3 is Script {
    // Deployed addresses
    address public oracleCustodyL3Proxy;
    address public oracleCustodyL3Impl;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Required: OracleRegistry address
        address oracleRegistryProxy = vm.envAddress("ORACLE_REGISTRY");

        console2.log("===========================================");
        console2.log("OracleCustody L3 DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);
        console2.log("OracleRegistry:", oracleRegistryProxy);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        _deployOracleCustodyL3(oracleRegistryProxy);

        vm.stopBroadcast();

        // Post-deploy verification
        _verify(oracleRegistryProxy);

        // Save deployment output
        _saveDeployment(deployer);

        console2.log("");
        console2.log("===========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("===========================================");
        console2.log("OracleCustody L3:", oracleCustodyL3Proxy);
    }

    function _deployOracleCustodyL3(address oracleRegistryProxy) internal {
        console2.log("Deploying OracleCustody L3 (BLSCustody instance)...");

        BLSCustody impl = new BLSCustody();
        oracleCustodyL3Impl = address(impl);
        console2.log("  Implementation:", oracleCustodyL3Impl);

        ERC1967Proxy proxy = new ERC1967Proxy(
            oracleCustodyL3Impl,
            abi.encodeCall(BLSCustody.initialize, (oracleRegistryProxy))
        );
        oracleCustodyL3Proxy = address(proxy);
        console2.log("  Proxy:", oracleCustodyL3Proxy);
        console2.log("");
    }

    function _verify(address oracleRegistryProxy) internal view {
        console2.log("Verifying deployment...");

        BLSCustody custody = BLSCustody(oracleCustodyL3Proxy);
        require(
            address(custody.oracleRegistry()) == oracleRegistryProxy,
            "OracleCustody L3: oracleRegistry mismatch"
        );
        require(custody.nonce() == 0, "OracleCustody L3: nonce should be 0");
        console2.log("  OracleCustody L3 oracleRegistry:", address(custody.oracleRegistry()));
        console2.log("  OracleCustody L3 nonce:", custody.nonce());
        console2.log("  Deployment verified successfully!");
        console2.log("");
    }

    function _saveDeployment(address deployer) internal {
        string memory json = string.concat(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "contracts": {\n',
            '    "OracleCustodyL3": {\n',
            '      "proxy": "', vm.toString(oracleCustodyL3Proxy), '",\n',
            '      "implementation": "', vm.toString(oracleCustodyL3Impl), '"\n',
            '    }\n',
            '  }\n',
            '}'
        );

        string memory outputPath = vm.envOr("DEPLOYMENT_OUTPUT", string("../deployments/oracle-custody-l3.json"));
        vm.writeFile(outputPath, json);
        console2.log("Addresses saved to:", outputPath);
    }
}
