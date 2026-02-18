// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/interfaces/IIndex.sol";
import "../src/libraries/TypesLib.sol";

contract NewOrder is Script {
    IIndex index = IIndex(0x0B306BF915C4d645ff596e518fAf3F9669b97016);
    uint256 userKey = 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a;
    
    function run() external {
        bytes32 itpId = bytes32(uint256(4));
        uint256 amount = 10e18; // 10 USDC
        uint256 limitPrice = 50000e18; // $50k per share
        uint256 deadline = block.timestamp + 3600;
        
        vm.startBroadcast(userKey);
        uint256 orderId = index.submitOrder(
            itpId,
            TypesLib.Side.BUY,
            amount,
            limitPrice,
            1, // slippageTier
            deadline
        );
        console.log("Submitted BUY order:", orderId);
        vm.stopBroadcast();
    }
}
