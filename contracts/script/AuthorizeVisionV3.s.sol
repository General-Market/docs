// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";

interface IOracleRegistry {
    function setAuthorizedMissedCountCaller(address caller, bool authorized) external;
    function authorizedMissedCountCallers(address) external view returns (bool);
}

contract AuthorizeVisionV3 is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address registry = vm.envAddress("ORACLE_REGISTRY");
        address vision = vm.envAddress("VISION");

        vm.startBroadcast(key);
        IOracleRegistry(registry).setAuthorizedMissedCountCaller(vision, true);
        vm.stopBroadcast();

        console.log("Authorized:", vision);
    }
}
