// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../test/mocks/MockERC20.sol";

/**
 * Batch deploy MockERC20 tokens from a JSON list.
 *
 * Usage:
 *   BATCH_FILE=data/batch-0.json forge script script/BatchDeployTokens.s.sol:BatchDeployTokens \
 *     --rpc-url http://localhost:8545 --broadcast
 *
 * The JSON file format: [["BTCUSDT","BTC-USDT"], ["ETHUSDT","ETH-USDT"], ...]
 * Each entry: [bitgetSymbol, tokenName]
 *
 * Outputs deployed addresses to stdout for capture.
 */
contract BatchDeployTokens is Script {
    function run() external {
        uint256 key = vm.envOr(
            "DEPLOYER_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        string memory batchFile = vm.envString("BATCH_FILE");
        string memory json = vm.readFile(batchFile);

        // Parse array length
        uint256 count = abi.decode(vm.parseJson(json, ".length"), (uint256));

        vm.startBroadcast(key);

        for (uint256 i = 0; i < count; i++) {
            string memory key0 = string(abi.encodePacked("[", vm.toString(i), "][0]"));
            string memory key1 = string(abi.encodePacked("[", vm.toString(i), "][1]"));
            string memory symbol = abi.decode(vm.parseJson(json, key0), (string));
            string memory name = abi.decode(vm.parseJson(json, key1), (string));

            MockERC20 token = new MockERC20(name, symbol, 18);
            console.log(symbol, address(token));
        }

        vm.stopBroadcast();
    }
}
