// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {VisionV4} from "../src/vision/VisionV4.sol";

/// @notice Deploys VisionV4 — a UUPS-upgradeable Vision behind an ERC1967
///         proxy. v3 was non-upgradeable; every future change to v4 ships as
///         a 30-second `upgradeTo`, never another cutover ceremony.
///         The deployer is not granted any upgrade authority — upgrades flow
///         through BLS-governed `proposeUpgrade` / `executeUpgrade`.
contract DeployVisionV4 is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address usdc = vm.envAddress("VISION_USDC");
        address oracleRegistry = vm.envAddress("VISION_ORACLE_REGISTRY");
        address feeCollector = vm.envAddress("VISION_FEE_COLLECTOR");

        vm.startBroadcast(key);

        VisionV4 impl = new VisionV4();

        bytes memory initData = abi.encodeWithSelector(
            VisionV4.initialize.selector,
            usdc,
            oracleRegistry,
            feeCollector
        );

        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        vm.stopBroadcast();

        console.log("Vision v4 implementation:", address(impl));
        console.log("Vision v4 proxy:         ", address(proxy));
        console.log("  usdc:                  ", usdc);
        console.log("  oracleRegistry:        ", oracleRegistry);
        console.log("  feeCollector:          ", feeCollector);
    }
}
