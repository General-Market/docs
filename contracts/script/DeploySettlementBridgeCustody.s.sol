// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {SettlementBridgeCustody} from "../src/custody/SettlementBridgeCustody.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeploySettlementBridgeCustody - Deploy SettlementBridgeCustody contract for cross-chain ITP purchases
/// @notice Deploys SettlementBridgeCustody as UUPS proxy for handling cross-chain orders from Settlement
/// @dev Story 7.8: SettlementBridgeCustody locks user's SettlementUSDC when buying ITP from Settlement
///      Issuers observe CrossChainOrderCreated events and process via BLS consensus
contract DeploySettlementBridgeCustody is Script {
    // Deployed addresses
    address public settlementBridgeCustodyProxy;
    address public settlementBridgeCustodyImpl;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Required: IssuerRegistry address
        address issuerRegistryProxy = vm.envAddress("ISSUER_REGISTRY");
        // Required: SettlementUSDC token address (USDC on "mock Settlement")
        address settlementUsdc = vm.envAddress("SETTLEMENT_USDC");
        // Required: Index contract address on L3
        address l3Index = vm.envAddress("INDEX");

        console2.log("===========================================");
        console2.log("SettlementBridgeCustody DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);
        console2.log("IssuerRegistry:", issuerRegistryProxy);
        console2.log("SettlementUSDC:", settlementUsdc);
        console2.log("L3 Index:", l3Index);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        _deploySettlementBridgeCustody(issuerRegistryProxy, settlementUsdc, l3Index);

        vm.stopBroadcast();

        // Post-deploy verification
        _verify(issuerRegistryProxy, settlementUsdc, l3Index);

        // Save deployment output
        _saveDeployment(deployer);

        console2.log("");
        console2.log("===========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("===========================================");
        console2.log("SettlementBridgeCustody:", settlementBridgeCustodyProxy);
    }

    function _deploySettlementBridgeCustody(address issuerRegistryProxy, address settlementUsdc, address l3Index) internal {
        console2.log("Deploying SettlementBridgeCustody...");

        SettlementBridgeCustody impl = new SettlementBridgeCustody();
        settlementBridgeCustodyImpl = address(impl);
        console2.log("  Implementation:", settlementBridgeCustodyImpl);

        ERC1967Proxy proxy = new ERC1967Proxy(
            settlementBridgeCustodyImpl,
            abi.encodeCall(SettlementBridgeCustody.initialize, (issuerRegistryProxy, settlementUsdc, l3Index, address(0)))
        );
        settlementBridgeCustodyProxy = address(proxy);
        console2.log("  Proxy:", settlementBridgeCustodyProxy);
        console2.log("");
    }

    function _verify(address issuerRegistryProxy, address settlementUsdc, address l3Index) internal view {
        console2.log("Verifying deployment...");

        SettlementBridgeCustody custody = SettlementBridgeCustody(settlementBridgeCustodyProxy);
        require(
            address(custody.issuerRegistry()) == issuerRegistryProxy,
            "SettlementBridgeCustody: issuerRegistry mismatch"
        );
        require(
            address(custody.usdc()) == settlementUsdc,
            "SettlementBridgeCustody: usdc mismatch"
        );
        require(
            custody.l3IndexContract() == l3Index,
            "SettlementBridgeCustody: l3Index mismatch"
        );
        require(custody.currentOrderId() == 0, "SettlementBridgeCustody: orderId should be 0");

        console2.log("  SettlementBridgeCustody issuerRegistry:", address(custody.issuerRegistry()));
        console2.log("  SettlementBridgeCustody usdc:", address(custody.usdc()));
        console2.log("  SettlementBridgeCustody l3Index:", custody.l3IndexContract());
        console2.log("  SettlementBridgeCustody currentOrderId:", custody.currentOrderId());
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
            '    "SettlementBridgeCustody": {\n',
            '      "proxy": "', vm.toString(settlementBridgeCustodyProxy), '",\n',
            '      "implementation": "', vm.toString(settlementBridgeCustodyImpl), '"\n',
            '    }\n',
            '  }\n',
            '}'
        );

        string memory outputPath = vm.envOr("DEPLOYMENT_OUTPUT", string("../deployments/settlement-bridge-custody.json"));
        vm.writeFile(outputPath, json);
        console2.log("Addresses saved to:", outputPath);
    }
}
