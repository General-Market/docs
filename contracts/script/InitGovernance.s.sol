// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
interface IGov { function admin() external view returns (address); function initialize(address) external; }
contract InitGov is Script {
    function run() external {
        IGov gov = IGov(0xb6Fd4b3955A474f959a793F67465888B21ae2bad);
        console.log("Current admin:", gov.admin());
        vm.startBroadcast();
        gov.initialize(0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4);
        vm.stopBroadcast();
        console.log("New admin:", gov.admin());
    }
}
