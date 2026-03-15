// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BLSCustody} from "../src/core/BLSCustody.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployIssuerCustodyL3 - Deploy IssuerCustody contract on L3
/// @notice Deploys BLSCustody as IssuerCustody L3 for holding L3Usdc after bridge from Settlement
/// @dev Story 7.7: IssuerCustody L3 is a BLSCustody instance with Index contract whitelisted
///      Uses existing IssuerRegistry for BLS verification
contract DeployIssuerCustodyL3 is Script {
    // Deployed addresses
    address public issuerCustodyL3Proxy;
    address public issuerCustodyL3Impl;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Required: IssuerRegistry address
        address issuerRegistryProxy = vm.envAddress("ISSUER_REGISTRY");

        console2.log("===========================================");
        console2.log("IssuerCustody L3 DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);
        console2.log("IssuerRegistry:", issuerRegistryProxy);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        _deployIssuerCustodyL3(issuerRegistryProxy);

        vm.stopBroadcast();

        // Post-deploy verification
        _verify(issuerRegistryProxy);

        // Save deployment output
        _saveDeployment(deployer);

        console2.log("");
        console2.log("===========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("===========================================");
        console2.log("IssuerCustody L3:", issuerCustodyL3Proxy);
    }

    function _deployIssuerCustodyL3(address issuerRegistryProxy) internal {
        console2.log("Deploying IssuerCustody L3 (BLSCustody instance)...");

        BLSCustody impl = new BLSCustody();
        issuerCustodyL3Impl = address(impl);
        console2.log("  Implementation:", issuerCustodyL3Impl);

        ERC1967Proxy proxy = new ERC1967Proxy(
            issuerCustodyL3Impl,
            abi.encodeCall(BLSCustody.initialize, (issuerRegistryProxy))
        );
        issuerCustodyL3Proxy = address(proxy);
        console2.log("  Proxy:", issuerCustodyL3Proxy);
        console2.log("");
    }

    function _verify(address issuerRegistryProxy) internal view {
        console2.log("Verifying deployment...");

        BLSCustody custody = BLSCustody(issuerCustodyL3Proxy);
        require(
            address(custody.issuerRegistry()) == issuerRegistryProxy,
            "IssuerCustody L3: issuerRegistry mismatch"
        );
        require(custody.nonce() == 0, "IssuerCustody L3: nonce should be 0");
        console2.log("  IssuerCustody L3 issuerRegistry:", address(custody.issuerRegistry()));
        console2.log("  IssuerCustody L3 nonce:", custody.nonce());
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
            '    "IssuerCustodyL3": {\n',
            '      "proxy": "', vm.toString(issuerCustodyL3Proxy), '",\n',
            '      "implementation": "', vm.toString(issuerCustodyL3Impl), '"\n',
            '    }\n',
            '  }\n',
            '}'
        );

        string memory outputPath = vm.envOr("DEPLOYMENT_OUTPUT", string("../deployments/issuer-custody-l3.json"));
        vm.writeFile(outputPath, json);
        console2.log("Addresses saved to:", outputPath);
    }
}
