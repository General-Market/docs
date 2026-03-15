// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BLSCustody} from "../src/core/BLSCustody.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployOracleCustodySettlement - Deploy OracleCustody contract on Settlement
/// @notice Deploys BLSCustody as OracleCustody Settlement for holding SettlementUSDC after bridge from L3
/// @dev Story 7.7: OracleCustody Settlement is a BLSCustody instance with MockBitgetVault whitelisted
///      Uses existing OracleRegistry for BLS verification
contract DeployOracleCustodySettlement is Script {
    // Deployed addresses
    address public oracleCustodySettlementProxy;
    address public oracleCustodySettlementImpl;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Required: OracleRegistry address
        address oracleRegistryProxy = vm.envAddress("ORACLE_REGISTRY");

        console2.log("===========================================");
        console2.log("OracleCustody Settlement DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);
        console2.log("OracleRegistry:", oracleRegistryProxy);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        _deployOracleCustodySettlement(oracleRegistryProxy);

        vm.stopBroadcast();

        // Post-deploy verification
        _verify(oracleRegistryProxy);

        // Save deployment output
        _saveDeployment(deployer);

        console2.log("");
        console2.log("===========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("===========================================");
        console2.log("OracleCustody Settlement:", oracleCustodySettlementProxy);
    }

    function _deployOracleCustodySettlement(address oracleRegistryProxy) internal {
        console2.log("Deploying OracleCustody Settlement (BLSCustody instance)...");

        BLSCustody impl = new BLSCustody();
        oracleCustodySettlementImpl = address(impl);
        console2.log("  Implementation:", oracleCustodySettlementImpl);

        ERC1967Proxy proxy = new ERC1967Proxy(
            oracleCustodySettlementImpl,
            abi.encodeCall(BLSCustody.initialize, (oracleRegistryProxy))
        );
        oracleCustodySettlementProxy = address(proxy);
        console2.log("  Proxy:", oracleCustodySettlementProxy);
        console2.log("");
    }

    function _verify(address oracleRegistryProxy) internal view {
        console2.log("Verifying deployment...");

        BLSCustody custody = BLSCustody(oracleCustodySettlementProxy);
        require(
            address(custody.oracleRegistry()) == oracleRegistryProxy,
            "OracleCustody Settlement: oracleRegistry mismatch"
        );
        require(custody.nonce() == 0, "OracleCustody Settlement: nonce should be 0");
        console2.log("  OracleCustody Settlement oracleRegistry:", address(custody.oracleRegistry()));
        console2.log("  OracleCustody Settlement nonce:", custody.nonce());
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
            '    "OracleCustodySettlement": {\n',
            '      "proxy": "', vm.toString(oracleCustodySettlementProxy), '",\n',
            '      "implementation": "', vm.toString(oracleCustodySettlementImpl), '"\n',
            '    }\n',
            '  }\n',
            '}'
        );

        string memory outputPath = vm.envOr("DEPLOYMENT_OUTPUT", string("../deployments/oracle-custody-settlement.json"));
        vm.writeFile(outputPath, json);
        console2.log("Addresses saved to:", outputPath);
    }
}
