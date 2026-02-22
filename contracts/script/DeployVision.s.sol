// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/vision/Vision.sol";
import "../src/mocks/MockERC20.sol";
import "./helpers/DeployBLSHelper.sol";

/// @title DeployVision - Deploy Vision.sol (P2Pool prediction market)
/// @notice Deploys Vision contract for local E2E or testnet use.
///         Reads USDC + IssuerRegistry from active deployment; deploys mock WIND
///         if no WIND_TOKEN env var is provided.
///
/// Required env vars (read from active-deployment.json or env):
///   - ISSUER_REGISTRY: address of IssuerRegistry (for BLS verification)
///   - USDC_ADDRESS: address of USDC token (L3_WUSDC on L3, ARB_USDC on Arb)
///   - WIND_TOKEN: (optional) address of WIND token; if empty, deploys a new MockERC20
///   - FEE_COLLECTOR: (optional) fee collector address; defaults to deployer
contract DeployVision is DeployBLSHelper {
    uint256 public constant LOCAL_CHAIN_ID = 111222333;
    uint256 public constant ARB_CHAIN_ID = 421611337;

    // Initial WIND supply for mock token (10M WIND)
    uint256 public constant MOCK_WIND_SUPPLY = 10_000_000 * 1e18;

    address public visionAddress;
    address public windTokenAddress;

    function run() external {
        uint256 deployerPrivateKey = _getDeployerKey();
        address deployer = vm.addr(deployerPrivateKey);

        // Read required addresses from env
        address issuerRegistry = vm.envAddress("ISSUER_REGISTRY");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        address feeCollector = vm.envOr("FEE_COLLECTOR", deployer);
        windTokenAddress = vm.envOr("WIND_TOKEN", address(0));

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

        // Deploy mock WIND token if not provided
        if (windTokenAddress == address(0)) {
            windTokenAddress = address(new MockERC20("WIND Token", "WIND", 18));
            // Mint initial supply to deployer (for bot staking in tests)
            MockERC20(windTokenAddress).mint(deployer, MOCK_WIND_SUPPLY);
            console.log("  Mock WIND deployed:", windTokenAddress);
            console.log("  Minted", MOCK_WIND_SUPPLY / 1e18, "WIND to deployer");
        } else {
            console.log("  Using existing WIND:", windTokenAddress);
        }

        // Deploy Vision contract
        Vision vision = new Vision(usdcAddress, windTokenAddress, issuerRegistry, feeCollector);
        visionAddress = address(vision);
        console.log("  Vision deployed:", visionAddress);

        vm.stopBroadcast();

        // Export deployment JSON
        _exportDeployment(deployer);

        console.log("");
        console.log("===========================================");
        console.log("VISION DEPLOYMENT COMPLETE");
        console.log("===========================================");
        console.log("Vision:", visionAddress);
        console.log("WIND:", windTokenAddress);
        console.log("");
    }

    function _getDeployerKey() internal view returns (uint256) {
        uint256 DEFAULT_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        if (block.chainid == LOCAL_CHAIN_ID || block.chainid == ARB_CHAIN_ID) {
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
            '    "Vision": "', vm.toString(visionAddress), '",\n',
            '    "WIND": "', vm.toString(windTokenAddress), '"\n',
            '  }\n',
            '}'
        );
        vm.writeFile("../deployments/vision-deployment.json", json);
        console.log("  Saved to deployments/vision-deployment.json");
    }
}
