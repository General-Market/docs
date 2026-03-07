// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/vision/Vision.sol";
import "../src/registry/IssuerRegistry.sol";
import "./helpers/DeployBLSHelper.sol";

/// @title DeployVision - Deploy Vision.sol (P2Pool prediction market) on L3
/// @notice Deploys Vision contract on L3 (Index Orbit chain).
///         Vision uses dual-balance architecture with real + virtual balances.
///         USDC is L3 USDC (18 decimals). No L3BridgeCustody needed — withdrawToSettlement
///         is a virtual debit, and issuers release from SettlementBridgeCustody on Settlement.
///
/// Required env vars:
///   - ISSUER_REGISTRY: address of IssuerRegistry on L3 (for BLS verification)
///   - USDC_ADDRESS: address of L3 USDC token (18 decimals)
///   - FEE_COLLECTOR: (optional) fee collector address; defaults to deployer
contract DeployVision is DeployBLSHelper {
    uint256 public constant LOCAL_CHAIN_ID = 111222333;

    address public visionAddress;

    function run() external {
        uint256 deployerPrivateKey = _getDeployerKey();
        address deployer = vm.addr(deployerPrivateKey);

        // Read required addresses from env
        address issuerRegistry = vm.envAddress("ISSUER_REGISTRY");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        address feeCollector = vm.envOr("FEE_COLLECTOR", deployer);

        console.log("===========================================");
        console.log("VISION (P2Pool) DEPLOYMENT");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("IssuerRegistry:", issuerRegistry);
        console.log("USDC:", usdcAddress);
        console.log("Fee Collector:", feeCollector);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Vision contract
        Vision vision = new Vision(usdcAddress, issuerRegistry, feeCollector);
        visionAddress = address(vision);
        console.log("  Vision deployed:", visionAddress);

        // Authorize Vision for incrementMissedCounts (non-signer liveness tracking)
        IssuerRegistry(issuerRegistry).setAuthorizedMissedCountCaller(visionAddress, true);
        console.log("  IssuerRegistry: authorized Vision for incrementMissedCounts");

        vm.stopBroadcast();

        // Export deployment JSON
        _exportDeployment(deployer);

        console.log("");
        console.log("===========================================");
        console.log("VISION DEPLOYMENT COMPLETE");
        console.log("===========================================");
        console.log("Vision:", visionAddress);
        console.log("");
    }

    function _getDeployerKey() internal view returns (uint256) {
        uint256 DEFAULT_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        if (block.chainid == LOCAL_CHAIN_ID) {
            return vm.envOr("PRIVATE_KEY", DEFAULT_KEY);
        }
        uint256 key = vm.envUint("PRIVATE_KEY");
        require(key != DEFAULT_KEY, "Cannot use default Anvil key on non-local chain");
        return key;
    }

    function _exportDeployment(address deployer) internal {
        string memory json = string.concat(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "contracts": {\n',
            '    "Vision": "', vm.toString(visionAddress), '"\n',
            '  }\n',
            '}'
        );
        vm.writeFile("../deployments/vision-deployment.json", json);
        console.log("  Saved to deployments/vision-deployment.json");
    }
}
