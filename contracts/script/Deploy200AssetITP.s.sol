// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../test/mocks/MockERC20.sol";
import "../src/core/Investment.sol";

/// @title Deploy200AssetITP - Deploy 200 mock tokens and create a 200-asset ITP
/// @notice Creates a 200-asset ITP for sell flow E2E testing with vital-test.md
/// @dev Each token gets equal weight: 5e15 (0.5%), total = 200 * 5e15 = 1e18 (100%)
contract Deploy200AssetITP is Script {
    uint256 public constant NUM_ASSETS = 200;
    uint256 public constant WEIGHT_PER_ASSET = 5e15; // 0.5% each = 1e18 / 200

    address[] public tokens;
    bytes32 public itpId;

    function run() external {
        uint256 deployerPrivateKey = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(deployerPrivateKey);
        address indexProxy = vm.envAddress("INDEX_ADDRESS");
        address mockBitgetVault = vm.envAddress("MOCK_BITGET_VAULT");

        console.log("===========================================");
        console.log("200-ASSET ITP DEPLOYMENT");
        console.log("===========================================");
        console.log("Deployer:", deployer);
        console.log("Index:", indexProxy);
        console.log("MockBitgetVault:", mockBitgetVault);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Phase 1: Deploy 200 mock tokens
        console.log("Phase 1: Deploying 200 mock tokens...");
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            string memory symbol = string.concat("TKN", vm.toString(i));
            string memory name = string.concat("Mock Token ", vm.toString(i));
            MockERC20 token = new MockERC20(name, symbol, 18);
            tokens.push(address(token));

            if (i % 50 == 0) {
                console.log("  Deployed token", i, ":", address(token));
            }
        }
        console.log("  Total tokens deployed:", tokens.length);

        // Phase 2: Build weights array (equal weight)
        console.log("Phase 2: Building 200-asset ITP...");
        uint256[] memory weights = new uint256[](NUM_ASSETS);
        address[] memory assets = new address[](NUM_ASSETS);
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            weights[i] = WEIGHT_PER_ASSET;
            assets[i] = tokens[i];
        }

        // Verify weights sum
        uint256 totalWeight;
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            totalWeight += weights[i];
        }
        console.log("  Total weight:", totalWeight);
        require(totalWeight == 1e18, "Weight sum must be 1e18");

        // Build prices array (all $1)
        uint256[] memory prices = new uint256[](NUM_ASSETS);
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            prices[i] = 1e18;
        }

        // Phase 3: Create ITP
        itpId = Investment(indexProxy).createITP("ITP-200", "ITP200", weights, assets, prices, type(uint256).max);
        console.log("  ITP-200 created, ID:", vm.toString(itpId));

        vm.stopBroadcast();

        // Export deployment info
        _exportDeployment(deployer, indexProxy);

        console.log("");
        console.log("===========================================");
        console.log("200-ASSET ITP DEPLOYMENT COMPLETE");
        console.log("===========================================");
        console.log("ITP ID:", vm.toString(itpId));
        console.log("First token:", tokens[0]);
        console.log("Last token:", tokens[NUM_ASSETS - 1]);
    }

    function _exportDeployment(address deployer, address indexProxy) internal {
        // Build token list (first 5 + last 5 for brevity)
        string memory tokenList = "[";
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            if (i > 0) tokenList = string.concat(tokenList, ",");
            tokenList = string.concat(tokenList, '"', vm.toString(tokens[i]), '"');
        }
        tokenList = string.concat(tokenList, "]");

        string memory json = string.concat(
            '{\n  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "indexProxy": "', vm.toString(indexProxy), '",\n',
            '  "itpId": "', vm.toString(itpId), '",\n',
            '  "numAssets": ', vm.toString(NUM_ASSETS), ',\n',
            '  "weightPerAsset": "', vm.toString(WEIGHT_PER_ASSET), '",\n',
            '  "tokens": ', tokenList, '\n',
            '}'
        );
        vm.writeFile("../deployments/itp-200-asset.json", json);
        console.log("  Deployment saved to deployments/itp-200-asset.json");
    }
}
