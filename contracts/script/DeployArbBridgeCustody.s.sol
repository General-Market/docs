// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ArbBridgeCustody} from "../src/custody/ArbBridgeCustody.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployArbBridgeCustody - Deploy ArbBridgeCustody contract for cross-chain ITP purchases
/// @notice Deploys ArbBridgeCustody as UUPS proxy for handling cross-chain orders from "Arbitrum"
/// @dev Story 7.8: ArbBridgeCustody locks user's ArbUSDC when buying ITP from Arbitrum
///      Issuers observe CrossChainOrderCreated events and process via BLS consensus
contract DeployArbBridgeCustody is Script {
    // Deployed addresses
    address public arbBridgeCustodyProxy;
    address public arbBridgeCustodyImpl;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Required: IssuerRegistry address
        address issuerRegistryProxy = vm.envAddress("ISSUER_REGISTRY");
        // Required: ArbUSDC token address (USDC on "mock Arbitrum")
        address arbUsdc = vm.envAddress("ARB_USDC");
        // Required: Index contract address on L3
        address l3Index = vm.envAddress("INDEX");

        console2.log("===========================================");
        console2.log("ArbBridgeCustody DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);
        console2.log("IssuerRegistry:", issuerRegistryProxy);
        console2.log("ArbUSDC:", arbUsdc);
        console2.log("L3 Index:", l3Index);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        _deployArbBridgeCustody(issuerRegistryProxy, arbUsdc, l3Index);

        vm.stopBroadcast();

        // Post-deploy verification
        _verify(issuerRegistryProxy, arbUsdc, l3Index);

        // Save deployment output
        _saveDeployment(deployer);

        console2.log("");
        console2.log("===========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("===========================================");
        console2.log("ArbBridgeCustody:", arbBridgeCustodyProxy);
    }

    function _deployArbBridgeCustody(address issuerRegistryProxy, address arbUsdc, address l3Index) internal {
        console2.log("Deploying ArbBridgeCustody...");

        ArbBridgeCustody impl = new ArbBridgeCustody();
        arbBridgeCustodyImpl = address(impl);
        console2.log("  Implementation:", arbBridgeCustodyImpl);

        ERC1967Proxy proxy = new ERC1967Proxy(
            arbBridgeCustodyImpl,
            abi.encodeCall(ArbBridgeCustody.initialize, (issuerRegistryProxy, arbUsdc, l3Index, address(0)))
        );
        arbBridgeCustodyProxy = address(proxy);
        console2.log("  Proxy:", arbBridgeCustodyProxy);
        console2.log("");
    }

    function _verify(address issuerRegistryProxy, address arbUsdc, address l3Index) internal view {
        console2.log("Verifying deployment...");

        ArbBridgeCustody custody = ArbBridgeCustody(arbBridgeCustodyProxy);
        require(
            address(custody.issuerRegistry()) == issuerRegistryProxy,
            "ArbBridgeCustody: issuerRegistry mismatch"
        );
        require(
            address(custody.usdc()) == arbUsdc,
            "ArbBridgeCustody: usdc mismatch"
        );
        require(
            custody.l3IndexContract() == l3Index,
            "ArbBridgeCustody: l3Index mismatch"
        );
        require(custody.currentOrderId() == 0, "ArbBridgeCustody: orderId should be 0");

        console2.log("  ArbBridgeCustody issuerRegistry:", address(custody.issuerRegistry()));
        console2.log("  ArbBridgeCustody usdc:", address(custody.usdc()));
        console2.log("  ArbBridgeCustody l3Index:", custody.l3IndexContract());
        console2.log("  ArbBridgeCustody currentOrderId:", custody.currentOrderId());
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
            '    "ArbBridgeCustody": {\n',
            '      "proxy": "', vm.toString(arbBridgeCustodyProxy), '",\n',
            '      "implementation": "', vm.toString(arbBridgeCustodyImpl), '"\n',
            '    }\n',
            '  }\n',
            '}'
        );

        string memory outputPath = vm.envOr("DEPLOYMENT_OUTPUT", string("../deployments/arb-bridge-custody.json"));
        vm.writeFile(outputPath, json);
        console2.log("Addresses saved to:", outputPath);
    }
}
