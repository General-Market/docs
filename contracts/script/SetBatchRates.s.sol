// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {CuratorRateIRM} from "../src/irm/CuratorRateIRM.sol";

/// @title SetBatchRates — Set borrow rates for all deployed batch markets
/// @notice Reads market IDs from batch-markets.json (via env) and calls setRates().
///
///      Environment variables:
///        CURATOR_RATE_IRM   — CuratorRateIRM address
///        BORROW_RATE        — Per-second rate in WAD (default: 1585489599 = 5% APR)
///        MARKET_IDS         — Comma-separated market ID hex strings
///        DEPLOYER_KEY       — Private key of curator
contract SetBatchRates is Script {
    function run() external {
        uint256 key = vm.envOr(
            "DEPLOYER_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address curatorIrmAddr = vm.envAddress("CURATOR_RATE_IRM");
        uint256 rate = vm.envOr("BORROW_RATE", uint256(1585489599)); // 5% APR default
        string memory idsRaw = vm.envString("MARKET_IDS");

        // Parse comma-separated market IDs
        string[] memory parts = vm.split(idsRaw, ",");
        uint256 count = parts.length;
        require(count > 0, "No market IDs provided");

        console.log("CuratorRateIRM:", curatorIrmAddr);
        console.log("Rate per-sec WAD:", rate);
        console.log("Market count:", count);

        Id[] memory ids = new Id[](count);
        uint256[] memory rates = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            bytes32 idBytes = vm.parseBytes32(parts[i]);
            ids[i] = Id.wrap(idBytes);
            rates[i] = rate;
        }

        vm.startBroadcast(key);
        CuratorRateIRM(curatorIrmAddr).setRates(ids, rates);
        vm.stopBroadcast();

        console.log("Rates set for", count, "markets");
    }
}
