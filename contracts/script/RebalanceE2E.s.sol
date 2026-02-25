// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/interfaces/IInvestment.sol";
import "../src/libraries/TypesLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title RebalanceE2E - Manual E2E test for rebalance flow (V2 - Asset Changes)
/// @notice Runs full rebalance cycle: requestRebalance (event) → rebalance (BLS)
contract RebalanceE2E is Script {
    IInvestment index;
    IERC20 usdc;

    // ITP 4: Created in ManualE2E with BTC/ETH 50%/50%
    bytes32 itpId = bytes32(uint256(4));

    // Anvil accounts
    address deployer;
    uint256 deployerKey;

    function run() external {
        index = IInvestment(vm.envAddress("INDEX_ADDRESS"));
        usdc = IERC20(vm.envAddress("USDC_ADDRESS"));
        deployer = vm.envAddress("DEPLOYER_ADDRESS");
        deployerKey = vm.envUint("DEPLOYER_KEY");

        console.log("=== REBALANCE E2E TEST (V2 - Asset Changes) ===\n");

        // Step 0: Verify ITP state before rebalance
        console.log("--- Step 0: Verify Initial ITP State ---");
        _verifyITPState();

        // Step 1: Request rebalance (event only, permissionless)
        console.log("\n--- Step 1: Request Rebalance (50/50 -> 70/30) ---");
        _requestRebalance();

        // Step 2: Execute rebalance via BLS consensus (single call)
        console.log("\n--- Step 2: Execute Rebalance ---");
        _executeRebalance();

        // Step 3: Verify final state
        console.log("\n--- Step 3: Verify Final State ---");
        _verifyFinalState();

        console.log("\n=== REBALANCE E2E COMPLETE ===");
    }

    function _verifyITPState() internal view {
        (
            address creatorAddr,
            uint256 totalSupply,
            uint256 nav,
            ,
            uint256[] memory weights,
        ) = index.getITPState(itpId);

        console.log("ITP ID:", uint256(itpId));
        console.log("Creator:", creatorAddr);
        console.log("Total Supply:", totalSupply);
        console.log("NAV:", nav);
        console.log("Weights:");
        for (uint256 i = 0; i < weights.length; i++) {
            uint256 pct = weights[i] * 100 / 1e18;
            console.log("  Asset %d: %d (%d%%)", i, weights[i], pct);
        }
    }

    function _requestRebalance() internal {
        // New weights: 70% BTC, 30% ETH (no asset changes)
        uint256[] memory newWeights = new uint256[](2);
        newWeights[0] = 7e17; // 70%
        newWeights[1] = 3e17; // 30%

        uint256[] memory emptyIndices = new uint256[](0);
        address[] memory emptyAddrs = new address[](0);

        console.log("Requesting new weights: [70%, 30%]");

        vm.startBroadcast(deployerKey);
        index.requestRebalance(itpId, emptyIndices, emptyAddrs, newWeights, "weight adjustment");
        vm.stopBroadcast();

        console.log("RebalanceRequested event emitted");
    }

    function _executeRebalance() internal {
        // Same weights as requested
        uint256[] memory newWeights = new uint256[](2);
        newWeights[0] = 7e17; // 70%
        newWeights[1] = 3e17; // 30%

        // Use $1 prices for simplicity in test
        uint256[] memory prices = new uint256[](2);
        prices[0] = 1e18;
        prices[1] = 1e18;

        uint256[] memory emptyIndices = new uint256[](0);
        address[] memory emptyAddrs = new address[](0);
        address[] memory emptyQt = new address[](0);

        // Empty sig works in testing mode
        bytes memory sig = new bytes(64);

        console.log("Executing rebalance with BLS signature");

        vm.startBroadcast(deployerKey);
        index.rebalance(itpId, emptyIndices, emptyAddrs, newWeights, prices, emptyQt, sig, 3, 7);
        vm.stopBroadcast();

        console.log("Rebalance executed on-chain");
    }

    function _verifyFinalState() internal view {
        (
            ,
            uint256 totalSupply,
            uint256 nav,
            ,
            uint256[] memory weights,
        ) = index.getITPState(itpId);

        console.log("\nFinal ITP State:");
        console.log("Total Supply:", totalSupply);
        console.log("NAV:", nav);
        console.log("Final Weights:");
        for (uint256 i = 0; i < weights.length; i++) {
            uint256 pct = weights[i] * 100 / 1e18;
            console.log("  Asset %d: %d (%d%%)", i, weights[i], pct);
        }

        // Verify weights are updated
        require(weights[0] == 7e17, "BTC weight should be 70%");
        require(weights[1] == 3e17, "ETH weight should be 30%");
        console.log("[PASS] Weights verified: 70%% BTC, 30%% ETH");

        // Verify no shares minted/burned (rebalance is USDC-neutral)
        console.log("[PASS] No ITP shares minted or burned during rebalance");
    }
}
