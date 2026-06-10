// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Script, console} from "forge-std/Script.sol";
import {MockBitgetVault} from "../test/mocks/MockBitgetVault.sol";
contract DeployMockVault is Script {
    function run() external returns (address) {
        vm.startBroadcast(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);
        MockBitgetVault vault = new MockBitgetVault();
        vault.initialize(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
        console.log("MockBitgetVault:", address(vault));
        vm.stopBroadcast();
        return address(vault);
    }
}
