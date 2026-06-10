// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../test/mocks/MockERC20.sol";

contract DeployMockITP is Script {
    function run() external {
        uint256 key = vm.envOr(
            "DEPLOYER_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        vm.startBroadcast(key);
        MockERC20 token = new MockERC20("Mock ITP Token", "mITP", 18);
        vm.stopBroadcast();
        console.log("MockITP deployed:", address(token));
    }
}
