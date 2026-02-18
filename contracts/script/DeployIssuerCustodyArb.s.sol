// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BLSCustody} from "../src/core/BLSCustody.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployIssuerCustodyArb - Deploy IssuerCustody contract on Arbitrum
/// @notice Deploys BLSCustody as IssuerCustody Arbitrum for holding ArbUSDC after bridge from L3
/// @dev Story 7.7: IssuerCustody Arb is a BLSCustody instance with MockBitgetVault whitelisted
///      Uses existing IssuerRegistry for BLS verification
contract DeployIssuerCustodyArb is Script {
    // Deployed addresses
    address public issuerCustodyArbProxy;
    address public issuerCustodyArbImpl;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Required: IssuerRegistry address
        address issuerRegistryProxy = vm.envAddress("ISSUER_REGISTRY");

        console2.log("===========================================");
        console2.log("IssuerCustody Arbitrum DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);
        console2.log("IssuerRegistry:", issuerRegistryProxy);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        _deployIssuerCustodyArb(issuerRegistryProxy);

        vm.stopBroadcast();

        // Post-deploy verification
        _verify(issuerRegistryProxy);

        // Save deployment output
        _saveDeployment(deployer);

        console2.log("");
        console2.log("===========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("===========================================");
        console2.log("IssuerCustody Arbitrum:", issuerCustodyArbProxy);
    }

    function _deployIssuerCustodyArb(address issuerRegistryProxy) internal {
        console2.log("Deploying IssuerCustody Arbitrum (BLSCustody instance)...");

        BLSCustody impl = new BLSCustody();
        issuerCustodyArbImpl = address(impl);
        console2.log("  Implementation:", issuerCustodyArbImpl);

        ERC1967Proxy proxy = new ERC1967Proxy(
            issuerCustodyArbImpl,
            abi.encodeCall(BLSCustody.initialize, (issuerRegistryProxy))
        );
        issuerCustodyArbProxy = address(proxy);
        console2.log("  Proxy:", issuerCustodyArbProxy);
        console2.log("");
    }

    function _verify(address issuerRegistryProxy) internal view {
        console2.log("Verifying deployment...");

        BLSCustody custody = BLSCustody(issuerCustodyArbProxy);
        require(
            address(custody.issuerRegistry()) == issuerRegistryProxy,
            "IssuerCustody Arb: issuerRegistry mismatch"
        );
        require(custody.nonce() == 0, "IssuerCustody Arb: nonce should be 0");
        console2.log("  IssuerCustody Arb issuerRegistry:", address(custody.issuerRegistry()));
        console2.log("  IssuerCustody Arb nonce:", custody.nonce());
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
            '    "IssuerCustodyArb": {\n',
            '      "proxy": "', vm.toString(issuerCustodyArbProxy), '",\n',
            '      "implementation": "', vm.toString(issuerCustodyArbImpl), '"\n',
            '    }\n',
            '  }\n',
            '}'
        );

        string memory outputPath = vm.envOr("DEPLOYMENT_OUTPUT", string("../deployments/issuer-custody-arb.json"));
        vm.writeFile(outputPath, json);
        console2.log("Addresses saved to:", outputPath);
    }
}
