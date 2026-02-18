// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
contract DeployUSDC is Script {
    function run() external returns (address) {
        vm.startBroadcast(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        console.log("USDC:", address(usdc));
        vm.stopBroadcast();
        return address(usdc);
    }
}
