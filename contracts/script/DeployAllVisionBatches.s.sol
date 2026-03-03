// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/vision/Vision.sol";
import "../src/interfaces/IIssuerRegistry.sol";
import "./helpers/DeployBLSHelper.sol";

/// @title VisionBulkCreate - Ephemeral helper to create all batches in 1 tx
contract VisionBulkCreate {
    function createAll(
        address vision,
        bytes32[] calldata sourceIds,
        bytes32[] calldata configHashes,
        uint256 tickDuration,
        uint256 lockOffset,
        bytes[] calldata blsSignatures,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external returns (uint256[] memory batchIds) {
        batchIds = new uint256[](sourceIds.length);
        for (uint i = 0; i < sourceIds.length; i++) {
            batchIds[i] = Vision(vision).createBatch(
                sourceIds[i],
                configHashes[i],
                tickDuration,
                lockOffset,
                blsSignatures[i],
                referenceNonce,
                signersBitmask
            );
        }
    }
}

/// @title DeployAllVisionBatches - Deploy only sources that have live data
/// @notice Creates Vision batches for sources with active batch engine configs.
///         Requires:
///           - Vision contract deployed (reads from active-deployment.json or env VISION_ADDRESS)
///           - IssuerRegistry with BLS keys registered (from DeployFullSystemE2E)
///           - bls-tool built (target/release/bls-tool)
///
/// Usage:
///   forge script script/DeployAllVisionBatches.s.sol:DeployAllVisionBatches \
///     --broadcast --slow --rpc-url http://localhost:8546
contract DeployAllVisionBatches is DeployBLSHelper {
    uint256 constant TICK_DURATION = 30;   // 30 seconds per tick (local dev)
    uint256 constant LOCK_OFFSET = 5;      // 5 second lock window
    uint256 constant SIGNERS_BITMASK = 7;  // 0b111 = 3 issuers

    function run() external {
        uint256 deployerKey = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        // Read Vision address from env or active-deployment.json
        address visionAddr = vm.envOr("VISION_ADDRESS", address(0));
        if (visionAddr == address(0)) {
            string memory deployJson = vm.readFile("../deployments/active-deployment.json");
            visionAddr = vm.parseJsonAddress(deployJson, ".contracts.Vision");
        }
        require(visionAddr != address(0), "Vision address not found");

        // Read IssuerRegistry from Vision contract
        address registryAddr = address(Vision(visionAddr).blsIssuerRegistry());
        uint256 refNonce = IIssuerRegistry(registryAddr).lastSnapshotNonce();

        console.log("===========================================");
        console.log("VISION BULK BATCH DEPLOYMENT");
        console.log("===========================================");
        console.log("Vision:          ", visionAddr);
        console.log("IssuerRegistry:  ", registryAddr);
        console.log("Reference nonce: ", refNonce);
        console.log("Tick duration:   ", TICK_DURATION);
        console.log("Lock offset:     ", LOCK_OFFSET);
        console.log("");

        // Build source list (only sources with active batch engine configs)
        string[54] memory sourceNames = _getSourceNames();
        uint256 count = sourceNames.length;

        // Pre-compute sourceIds, configHashes, and BLS signatures
        bytes32[] memory sourceIds = new bytes32[](count);
        bytes32[] memory configHashes = new bytes32[](count);
        bytes[] memory blsSigs = new bytes[](count);

        console.log("Signing", count, "batch creation messages...");

        // Version suffix to create fresh batches (bump when redeploying)
        string memory version = vm.envOr("BATCH_VERSION", string("v1"));

        for (uint i = 0; i < count; i++) {
            sourceIds[i] = keccak256(bytes(string.concat(sourceNames[i], "_", version)));
            // configHash uses ORIGINAL source name so data-node can resolve it
            bytes32 originalSourceId = keccak256(bytes(sourceNames[i]));
            configHashes[i] = keccak256(abi.encode(originalSourceId, "default_config_v1"));

            // Compute BLS message hash (must match Vision._createBatch)
            bytes32 messageHash = keccak256(abi.encode(
                block.chainid,
                visionAddr,
                "CREATE_BATCH",
                sourceIds[i],
                configHashes[i],
                TICK_DURATION,
                LOCK_OFFSET
            ));

            // Sign via FFI with test issuers (seeds 0,1,2)
            blsSigs[i] = blsSign("0,1,2", messageHash);
        }

        console.log("All signatures computed. Deploying bulk helper...");

        // Split into 2 halves to stay under Anvil's 30M block gas limit
        uint256 half = count / 2;

        vm.startBroadcast(deployerKey);

        // Deploy ephemeral bulk creator (tx 1)
        VisionBulkCreate bulk = new VisionBulkCreate();

        // First half (tx 2)
        bytes32[] memory ids1 = new bytes32[](half);
        bytes32[] memory hashes1 = new bytes32[](half);
        bytes[] memory sigs1 = new bytes[](half);
        for (uint i = 0; i < half; i++) {
            ids1[i] = sourceIds[i];
            hashes1[i] = configHashes[i];
            sigs1[i] = blsSigs[i];
        }
        uint256[] memory batchIds1 = bulk.createAll(
            visionAddr, ids1, hashes1, TICK_DURATION, LOCK_OFFSET, sigs1, refNonce, SIGNERS_BITMASK
        );

        // Second half (tx 3)
        uint256 remaining = count - half;
        bytes32[] memory ids2 = new bytes32[](remaining);
        bytes32[] memory hashes2 = new bytes32[](remaining);
        bytes[] memory sigs2 = new bytes[](remaining);
        for (uint i = 0; i < remaining; i++) {
            ids2[i] = sourceIds[half + i];
            hashes2[i] = configHashes[half + i];
            sigs2[i] = blsSigs[half + i];
        }
        uint256[] memory batchIds2 = bulk.createAll(
            visionAddr, ids2, hashes2, TICK_DURATION, LOCK_OFFSET, sigs2, refNonce, SIGNERS_BITMASK
        );

        vm.stopBroadcast();

        // Merge results
        uint256[] memory batchIds = new uint256[](count);
        for (uint i = 0; i < half; i++) batchIds[i] = batchIds1[i];
        for (uint i = 0; i < remaining; i++) batchIds[half + i] = batchIds2[i];

        // Report results
        console.log("");
        console.log("===========================================");
        console.log("BATCH DEPLOYMENT COMPLETE");
        console.log("===========================================");
        console.log("Total batches created:", batchIds.length);

        for (uint i = 0; i < count; i++) {
            console.log("  Batch", batchIds[i], ":", sourceNames[i]);
        }

        // Export batch mapping as JSON for downstream consumption
        _exportBatchMapping(sourceNames, batchIds, configHashes, visionAddr);
    }

    function _getSourceNames() internal pure returns (string[54] memory names) {
        // Only sources with active batch engine configs (verified 2026-02-26).
        // Removed: coingecko (rate-limited), nasdaq, twse, bls, courtlistener,
        //          github, npm, pypi, crates_io, stackexchange, openalex,
        //          twitch, reddit, bgg, volcano, weather, openmeteo, flights,
        //          tomtom_traffic, tomtom_evcharge, faa_delays, aisstream,
        //          maritime, ebird, movebank, e2e_test_0-4
        //
        // ── Finance (8) ──
        names[0]  = "pumpfun";
        names[1]  = "defillama";
        names[2]  = "finnhub";
        names[3]  = "zillow";
        names[4]  = "polymarket";
        names[5]  = "finra";
        names[6]  = "yahoo_drinks";
        names[7]  = "bestbuy";
        // ── Economic (6) ──
        names[8]  = "fred";
        names[9]  = "eia";
        names[10] = "treasury";
        names[11] = "ecb";
        names[12] = "worldbank";
        names[13] = "adzuna";
        // ── Government (3) ──
        names[14] = "usa_spending";
        names[15] = "sec";
        names[16] = "congress";
        // ── Tech & Dev (2) ──
        names[17] = "hackernews";
        names[18] = "cloudflare";
        // ── Academic (2) ──
        names[19] = "crossref";
        names[20] = "pubmed";
        // ── Entertainment (10) ──
        names[21] = "tmdb";
        names[22] = "lastfm";
        names[23] = "steam";
        names[24] = "anilist";
        names[25] = "chaturbate";
        names[26] = "backpacktf";
        names[27] = "fourchan";
        names[28] = "sports";
        names[29] = "pandascore";
        names[30] = "queue_times";
        // ── Geophysical (10) ──
        names[31] = "earthquake";
        names[32] = "weather_alerts";
        names[33] = "airnow";
        names[34] = "usgs_water";
        names[35] = "noaa_met";
        names[36] = "noaa_tides";
        names[37] = "ndbc";
        names[38] = "nwps";
        names[39] = "nrc_nuclear";
        names[40] = "wildfire";
        names[41] = "epidemic";
        // ── Transport (4) ──
        names[42] = "gtfs_rt";
        names[43] = "citybikes";
        names[44] = "parking";
        names[45] = "cbp_border";
        // ── Nature (2) ──
        names[46] = "animals";
        names[47] = "shelter";
        // ── Space (3) ──
        names[48] = "spaceweather";
        names[49] = "iss";
        names[50] = "mil_aircraft";
        // ── Rail (1) ──
        names[51] = "db_trains";
        // ── Viral/Meme (2) ──
        names[52] = "mcbroken";
        names[53] = "nyc311";
    }

    function _exportBatchMapping(
        string[54] memory sourceNames,
        uint256[] memory batchIds,
        bytes32[] memory configHashes,
        address visionAddr
    ) internal {
        // Build JSON manually (Forge doesn't have great JSON building)
        string memory json = '{\n  "vision": "';
        json = string.concat(json, vm.toString(visionAddr), '",\n');
        json = string.concat(json, '  "tickDuration": ', vm.toString(TICK_DURATION), ',\n');
        json = string.concat(json, '  "lockOffset": ', vm.toString(LOCK_OFFSET), ',\n');
        json = string.concat(json, '  "batchCount": ', vm.toString(batchIds.length), ',\n');
        json = string.concat(json, '  "batches": {\n');

        for (uint i = 0; i < sourceNames.length; i++) {
            json = string.concat(
                json,
                '    "', sourceNames[i], '": { "batchId": ',
                vm.toString(batchIds[i]),
                ', "configHash": "',
                vm.toString(configHashes[i]),
                '" }'
            );
            if (i < sourceNames.length - 1) {
                json = string.concat(json, ',');
            }
            json = string.concat(json, '\n');
        }

        json = string.concat(json, '  }\n}');
        vm.writeFile("../deployments/vision-batches.json", json);
        console.log("  Saved batch mapping to deployments/vision-batches.json");
    }
}
