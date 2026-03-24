// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {CuratorRateIRM} from "../src/irm/CuratorRateIRM.sol";

/// @title SetVariedRates — Set per-market borrow rates from parallel CSV env vars
/// @notice Reads MARKET_IDS and MARKET_RATES as comma-separated parallel arrays.
///
///      Environment variables:
///        CURATOR_RATE_IRM   — CuratorRateIRM address
///        MARKET_IDS         — Comma-separated market ID hex strings
///        MARKET_RATES       — Comma-separated per-second WAD rates (parallel to MARKET_IDS)
///        DEPLOYER_KEY       — Private key of curator
contract SetVariedRates is Script {
    function run() external {
        uint256 key = vm.envOr(
            "DEPLOYER_KEY", uint256(0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537)
        );
        address curatorIrmAddr = vm.envAddress("CURATOR_RATE_IRM");
        string memory idsRaw = vm.envString("MARKET_IDS");
        string memory ratesRaw = vm.envString("MARKET_RATES");

        string[] memory idParts = vm.split(idsRaw, ",");
        string[] memory rateParts = vm.split(ratesRaw, ",");
        uint256 count = idParts.length;
        require(count > 0, "No market IDs");
        require(count == rateParts.length, "IDs and rates length mismatch");

        console.log("CuratorRateIRM:", curatorIrmAddr);
        console.log("Market count:", count);

        Id[] memory ids = new Id[](count);
        uint256[] memory rates = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = Id.wrap(vm.parseBytes32(idParts[i]));
            rates[i] = vm.parseUint(rateParts[i]);
        }

        vm.startBroadcast(key);
        CuratorRateIRM(curatorIrmAddr).setRates(ids, rates);
        vm.stopBroadcast();

        console.log("Varied rates set for", count, "markets");
    }
}
