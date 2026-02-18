// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {MockTokenFactory} from "../src/mocks/MockTokenFactory.sol";

/// @title DeployMockTokenFactory - Deploy MockTokenFactory for batch token deployment
contract DeployMockTokenFactory is Script {
    address public factory;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("===========================================");
        console2.log("MOCK TOKEN FACTORY DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        MockTokenFactory factoryContract = new MockTokenFactory();
        factory = address(factoryContract);

        vm.stopBroadcast();

        console2.log("MockTokenFactory:", factory);

        // Write address to file for JS script to read
        string memory json = string.concat(
            '{"factory": "', vm.toString(factory), '"}'
        );
        vm.writeFile("../deployments/mock-token-factory.json", json);
    }
}
