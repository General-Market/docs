// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/interfaces/IIndex.sol";
import "../src/libraries/TypesLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SubmitOrderScript is Script {
    function run() external {
        address index = 0x0B306BF915C4d645ff596e518fAf3F9669b97016;
        address user = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;
        uint256 userKey = 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a;
        
        bytes32 itpId = bytes32(uint256(4));
        uint256 amount = 50e18;
        uint256 limitPrice = 50000e18;
        uint256 deadline = block.timestamp + 3600;
        
        vm.startBroadcast(userKey);
        uint256 orderId = IIndex(index).submitOrder(
            itpId,
            TypesLib.Side.BUY,
            amount,
            limitPrice,
            1, // slippageTier
            deadline
        );
        console.log("Order submitted with ID:", orderId);
        vm.stopBroadcast();
    }
}
