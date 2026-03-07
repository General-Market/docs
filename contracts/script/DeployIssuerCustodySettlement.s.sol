// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BLSCustody} from "../src/core/BLSCustody.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployIssuerCustodySettlement - Deploy IssuerCustody contract on Settlement
/// @notice Deploys BLSCustody as IssuerCustody Settlement for holding SettlementUSDC after bridge from L3
/// @dev Story 7.7: IssuerCustody Settlement is a BLSCustody instance with MockBitgetVault whitelisted
///      Uses existing IssuerRegistry for BLS verification
contract DeployIssuerCustodySettlement is Script {
    // Deployed addresses
    address public issuerCustodySettlementProxy;
    address public issuerCustodySettlementImpl;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Required: IssuerRegistry address
        address issuerRegistryProxy = vm.envAddress("ISSUER_REGISTRY");

        console2.log("===========================================");
        console2.log("IssuerCustody Settlement DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);
        console2.log("IssuerRegistry:", issuerRegistryProxy);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        _deployIssuerCustodySettlement(issuerRegistryProxy);

        vm.stopBroadcast();

        // Post-deploy verification
        _verify(issuerRegistryProxy);

        // Save deployment output
        _saveDeployment(deployer);

        console2.log("");
        console2.log("===========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("===========================================");
        console2.log("IssuerCustody Settlement:", issuerCustodySettlementProxy);
    }

    function _deployIssuerCustodySettlement(address issuerRegistryProxy) internal {
        console2.log("Deploying IssuerCustody Settlement (BLSCustody instance)...");

        BLSCustody impl = new BLSCustody();
        issuerCustodySettlementImpl = address(impl);
        console2.log("  Implementation:", issuerCustodySettlementImpl);

        ERC1967Proxy proxy = new ERC1967Proxy(
            issuerCustodySettlementImpl,
            abi.encodeCall(BLSCustody.initialize, (issuerRegistryProxy))
        );
        issuerCustodySettlementProxy = address(proxy);
        console2.log("  Proxy:", issuerCustodySettlementProxy);
        console2.log("");
    }

    function _verify(address issuerRegistryProxy) internal view {
        console2.log("Verifying deployment...");

        BLSCustody custody = BLSCustody(issuerCustodySettlementProxy);
        require(
            address(custody.issuerRegistry()) == issuerRegistryProxy,
            "IssuerCustody Settlement: issuerRegistry mismatch"
        );
        require(custody.nonce() == 0, "IssuerCustody Settlement: nonce should be 0");
        console2.log("  IssuerCustody Settlement issuerRegistry:", address(custody.issuerRegistry()));
        console2.log("  IssuerCustody Settlement nonce:", custody.nonce());
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
            '    "IssuerCustodySettlement": {\n',
            '      "proxy": "', vm.toString(issuerCustodySettlementProxy), '",\n',
            '      "implementation": "', vm.toString(issuerCustodySettlementImpl), '"\n',
            '    }\n',
            '  }\n',
            '}'
        );

        string memory outputPath = vm.envOr("DEPLOYMENT_OUTPUT", string("../deployments/issuer-custody-settlement.json"));
        vm.writeFile(outputPath, json);
        console2.log("Addresses saved to:", outputPath);
    }
}
