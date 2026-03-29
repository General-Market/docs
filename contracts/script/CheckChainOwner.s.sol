// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
interface ArbOwnerPublic { function getAllChainOwners() external view returns (address[] memory); }
contract CheckChainOwner is Script {
    function run() external view {
        address[] memory owners = ArbOwnerPublic(0x000000000000000000000000000000000000006b).getAllChainOwners();
        for (uint i = 0; i < owners.length; i++) {
            console.log("Chain owner:", owners[i]);
        }
        console.log("Total owners:", owners.length);
    }
}
