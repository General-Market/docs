// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {CuratorRateIRM} from "../src/irm/CuratorRateIRM.sol";
import {Morpho} from "@morpho-blue/Morpho.sol";

/// @title DeployCuratorRateIRM
/// @notice Deploys CuratorRateIRM and enables it on Morpho Blue.
/// @dev After deployment, new markets can be created using CuratorRateIRM instead of AdaptiveCurveIRM.
///      Existing markets with AdaptiveCurveIRM are unaffected (market tuples are immutable).
contract DeployCuratorRateIRM is Script {
    using MarketParamsLib for MarketParams;

    function run() external {
        uint256 anvilKey = vm.envOr(
            "DEPLOYER_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(anvilKey);

        address morphoAddr = vm.envAddress("MORPHO");
        address curatorAddr = vm.envOr("CURATOR_ADDRESS", deployer);

        console.log("Deployer:", deployer);
        console.log("Morpho:", morphoAddr);
        console.log("Curator:", curatorAddr);

        Morpho morpho = Morpho(morphoAddr);

        vm.startBroadcast(anvilKey);

        // 1. Deploy CuratorRateIRM
        CuratorRateIRM curatorIrm = new CuratorRateIRM(morphoAddr, curatorAddr);
        console.log("CuratorRateIRM deployed:", address(curatorIrm));
        console.log("  MORPHO:", curatorIrm.MORPHO());
        console.log("  curator:", curatorIrm.curator());
        console.log("  PUNITIVE_RATE:", curatorIrm.PUNITIVE_RATE());
        console.log("  MIN_RATE:", curatorIrm.MIN_RATE());
        console.log("  MAX_RATE:", curatorIrm.MAX_RATE());

        // 2. Enable CuratorRateIRM on Morpho Blue (requires Morpho owner)
        morpho.enableIrm(address(curatorIrm));
        console.log("CuratorRateIRM enabled on Morpho Blue");

        vm.stopBroadcast();

        // 3. Write deployment output
        string memory json = string.concat(
            '{\n  "chainId": ', vm.toString(block.chainid),
            ',\n  "deployer": "', vm.toString(deployer),
            '",\n  "timestamp": ', vm.toString(block.timestamp),
            ',\n  "contracts": {\n',
            '    "MORPHO": "', vm.toString(morphoAddr),
            '",\n    "CURATOR_RATE_IRM": "', vm.toString(address(curatorIrm)),
            '",\n    "CURATOR_ADDRESS": "', vm.toString(curatorAddr),
            '"\n  }\n}\n'
        );
        vm.writeFile(
            string.concat(vm.projectRoot(), "/../deployments/curator-rate-irm.json"),
            json
        );
        console.log("Deployment written to deployments/curator-rate-irm.json");
    }
}
