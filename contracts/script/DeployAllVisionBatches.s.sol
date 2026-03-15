// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/vision/Vision.sol";
import "../src/interfaces/IOracleRegistry.sol";
import "./helpers/DeployBLSHelper.sol";

/// @title VisionBulkCreate - Ephemeral helper to create batches in bulk
contract VisionBulkCreate {
    function createAll(
        address vision,
        bytes32[] calldata sourceIds,
        bytes32[] calldata configHashes,
        uint256[] calldata tickDurations,
        uint256[] calldata lockOffsets,
        bytes[] calldata blsSignatures,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external returns (uint256[] memory batchIds) {
        batchIds = new uint256[](sourceIds.length);
        for (uint i = 0; i < sourceIds.length; i++) {
            batchIds[i] = Vision(vision).createBatch(
                sourceIds[i],
                configHashes[i],
                tickDurations[i],
                lockOffsets[i],
                blsSignatures[i],
                referenceNonce,
                signersBitmask
            );
        }
    }
}

/// @title DeployAllVisionBatches - Deploy only sources that have live data
/// @notice Creates Vision batches using config hashes from the data-node's
///         recommended batch configs (deployments/vision-recommended-configs.json).
///
///         Each source gets its own tick duration and lock offset from the config.
///
///         Requires:
///           - Vision contract deployed (reads from active-deployment.json or env VISION_ADDRESS)
///           - OracleRegistry with BLS keys registered (from DeployFullSystemE2E)
///           - bls-tool built (target/release/bls-tool)
///           - vision-recommended-configs.json generated from data-node API
///
/// Usage:
///   # 1. Generate config file from data-node:
///   #    curl -s http://DATA_NODE_URL/batches/recommended | python3 -c "..."
///   #    (see scripts/generate-vision-configs.sh)
///   #
///   # 2. Deploy:
///   forge script script/DeployAllVisionBatches.s.sol:DeployAllVisionBatches \
///     --broadcast --slow --rpc-url http://localhost:8546
contract DeployAllVisionBatches is DeployBLSHelper {
    uint256 constant SIGNERS_BITMASK = 7;  // 0b111 = 3 oracles

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

        // Read OracleRegistry from Vision contract
        address registryAddr = address(Vision(visionAddr).oracleRegistry());
        uint256 refNonce = IOracleRegistry(registryAddr).lastSnapshotNonce();

        // Read recommended configs from data-node generated JSON
        string memory configJson = vm.readFile("../deployments/vision-recommended-configs.json");
        string[] memory sourceNames = vm.parseJsonKeys(configJson, "$.configs");
        uint256 count = sourceNames.length;

        console.log("===========================================");
        console.log("VISION BULK BATCH DEPLOYMENT");
        console.log("===========================================");
        console.log("Vision:          ", visionAddr);
        console.log("OracleRegistry:  ", registryAddr);
        console.log("Reference nonce: ", refNonce);
        console.log("Sources from config:", count);
        console.log("");

        // Version suffix to create fresh batches (bump when redeploying)
        string memory version = vm.envOr("BATCH_VERSION", string("v2"));

        // Pre-compute sourceIds, configHashes, tickDurations, lockOffsets, and BLS signatures
        bytes32[] memory sourceIds = new bytes32[](count);
        bytes32[] memory configHashes = new bytes32[](count);
        uint256[] memory tickDurations = new uint256[](count);
        uint256[] memory lockOffsets = new uint256[](count);
        bytes[] memory blsSigs = new bytes[](count);

        console.log("Signing", count, "batch creation messages...");

        for (uint i = 0; i < count; i++) {
            string memory name = sourceNames[i];
            sourceIds[i] = keccak256(bytes(string.concat(name, "_", version)));

            // Read config hash, tick duration, lock offset from JSON
            string memory basePath = string.concat("$.configs.", name);
            configHashes[i] = vm.parseJsonBytes32(configJson, string.concat(basePath, ".configHash"));
            tickDurations[i] = vm.parseJsonUint(configJson, string.concat(basePath, ".tickDurationSecs"));
            lockOffsets[i] = vm.parseJsonUint(configJson, string.concat(basePath, ".lockOffsetSecs"));

            // Compute BLS message hash (must match Vision._createBatch)
            bytes32 messageHash = keccak256(abi.encode(
                block.chainid,
                visionAddr,
                "CREATE_BATCH",
                sourceIds[i],
                configHashes[i],
                tickDurations[i],
                lockOffsets[i]
            ));

            // Sign via FFI with test oracles (seeds 0,1,2)
            blsSigs[i] = blsSign("0,1,2", messageHash);
        }

        console.log("All signatures computed. Deploying bulk helper...");

        // Split into 2 halves to stay under block gas limit
        uint256 half = count / 2;

        vm.startBroadcast(deployerKey);

        // Deploy ephemeral bulk creator (tx 1)
        VisionBulkCreate bulk = new VisionBulkCreate();

        // First half (tx 2)
        {
            bytes32[] memory ids1 = new bytes32[](half);
            bytes32[] memory hashes1 = new bytes32[](half);
            uint256[] memory tds1 = new uint256[](half);
            uint256[] memory los1 = new uint256[](half);
            bytes[] memory sigs1 = new bytes[](half);
            for (uint i = 0; i < half; i++) {
                ids1[i] = sourceIds[i];
                hashes1[i] = configHashes[i];
                tds1[i] = tickDurations[i];
                los1[i] = lockOffsets[i];
                sigs1[i] = blsSigs[i];
            }
            bulk.createAll(
                visionAddr, ids1, hashes1, tds1, los1, sigs1, refNonce, SIGNERS_BITMASK
            );
        }

        // Second half (tx 3)
        uint256 remaining = count - half;
        uint256[] memory batchIds;
        {
            bytes32[] memory ids2 = new bytes32[](remaining);
            bytes32[] memory hashes2 = new bytes32[](remaining);
            uint256[] memory tds2 = new uint256[](remaining);
            uint256[] memory los2 = new uint256[](remaining);
            bytes[] memory sigs2 = new bytes[](remaining);
            for (uint i = 0; i < remaining; i++) {
                ids2[i] = sourceIds[half + i];
                hashes2[i] = configHashes[half + i];
                tds2[i] = tickDurations[half + i];
                los2[i] = lockOffsets[half + i];
                sigs2[i] = blsSigs[half + i];
            }
            bulk.createAll(
                visionAddr, ids2, hashes2, tds2, los2, sigs2, refNonce, SIGNERS_BITMASK
            );
        }

        vm.stopBroadcast();

        // Collect batch IDs by reading from Vision contract
        batchIds = new uint256[](count);
        for (uint i = 0; i < count; i++) {
            batchIds[i] = Vision(visionAddr).sourceIdToBatchId(sourceIds[i]);
        }

        // Report results
        console.log("");
        console.log("===========================================");
        console.log("BATCH DEPLOYMENT COMPLETE");
        console.log("===========================================");
        console.log("Total batches created:", count);

        for (uint i = 0; i < count; i++) {
            console.log("  Batch", batchIds[i], ":", sourceNames[i]);
        }

        // Export batch mapping as JSON
        _exportBatchMapping(sourceNames, batchIds, configHashes, tickDurations, lockOffsets, visionAddr);
    }

    function _exportBatchMapping(
        string[] memory sourceNames,
        uint256[] memory batchIds,
        bytes32[] memory configHashes,
        uint256[] memory tickDurations,
        uint256[] memory lockOffsets,
        address visionAddr
    ) internal {
        // Build JSON manually (Forge doesn't have great JSON building)
        string memory json = '{\n  "vision": "';
        json = string.concat(json, vm.toString(visionAddr), '",\n');
        json = string.concat(json, '  "batchCount": ', vm.toString(batchIds.length), ',\n');
        json = string.concat(json, '  "batches": {\n');

        for (uint i = 0; i < sourceNames.length; i++) {
            json = string.concat(
                json,
                '    "', sourceNames[i], '": { "batchId": ',
                vm.toString(batchIds[i]),
                ', "configHash": "',
                vm.toString(configHashes[i]),
                '", "tickDuration": ',
                vm.toString(tickDurations[i]),
                ', "lockOffset": ',
                vm.toString(lockOffsets[i]),
                ' }'
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
