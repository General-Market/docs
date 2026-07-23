// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/console.sol";
import "../src/bridge/BridgeProxy.sol";
import "./helpers/DeployBLSHelper.sol";

interface IIndexRead {
    function getITPState(bytes32 itpId) external view returns (
        address creator,
        uint256 totalSupply,
        uint256 nav,
        address[] memory assets,
        uint256[] memory weights,
        uint256[] memory inventory
    );
}

interface IRegistryRead {
    function lastSnapshotNonce() external view returns (uint256);
}

/// @notice Backfill BridgedITP shadows on Settlement for L3 ITPs that were
///         created via Index.createITP directly (deploy fast-path) and never
///         received their bridge counterpart. Reads the original assets and
///         weights from L3, opens a fresh requestCreateItp on Sonic, then
///         BLS-signs the completion against the existing L3 orbitItpId.
///
/// Usage:
///   ITP_IDS=0x...01,0x...02,... \
///   L3_RPC=https://rpc.generalmarket.io \
///   BRIDGE_PROXY=0x19d9... \
///   PRIVATE_KEY=0x... \
///   forge script script/MirrorL3ItpsToSonic.s.sol --rpc-url $SETTLEMENT_RPC \
///     --broadcast --ffi --legacy
contract MirrorL3ItpsToSonic is DeployBLSHelper {
    function run() external {
        address bridgeProxyAddr = vm.envAddress("BRIDGE_PROXY");
        string memory l3Rpc = vm.envString("L3_RPC");
        address indexAddr = vm.envAddress("INDEX");
        bytes32[] memory itpIds = _parseItpIds(vm.envString("ITP_IDS"));
        uint256 key = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(key);

        // referenceNonce passed in via env var — Sonic eth_getStorageAt
        // occasionally returns a pending-state nonce higher than what's
        // mined by the time the broadcast tx executes, which reverts with
        // NonceFuture. Reading it through forge made things worse, not
        // better. The wrapper script reads the live nonce via cast call
        // and computes a safe value.
        uint256 referenceNonce = vm.envUint("REFERENCE_NONCE");
        // 3-of-3 oracle bitmask — registry has activeCount=3 in this deploy.
        uint256 signersBitmask = 7;

        console.log("=== MIRROR L3 ITPs -> SONIC BridgedITP ===");
        console.log("  bridgeProxy:", bridgeProxyAddr);
        console.log("  index (L3):", indexAddr);
        console.log("  l3Rpc:", l3Rpc);
        console.log("  itp count:", itpIds.length);
        console.log("  admin:", admin);

        BridgeProxy bridge = BridgeProxy(bridgeProxyAddr);

        // Snapshot Settlement chain id for the message hash; vm.createSelectFork
        // would change block.chainid otherwise.
        uint256 settlementChainId = block.chainid;

        // Read ITP state from L3 (separate fork, doesn't disturb the Sonic fork
        // we'll broadcast against)
        uint256 l3Fork = vm.createFork(l3Rpc);
        address[][] memory allAssets = new address[][](itpIds.length);
        uint256[][] memory allWeights = new uint256[][](itpIds.length);
        for (uint256 i = 0; i < itpIds.length; i++) {
            vm.selectFork(l3Fork);
            (, , , address[] memory assets, uint256[] memory weights, ) =
                IIndexRead(indexAddr).getITPState(itpIds[i]);
            allAssets[i] = assets;
            allWeights[i] = weights;
        }

        // Switch back to Settlement (default fork) for broadcasting
        vm.selectFork(0);
        require(block.chainid == settlementChainId, "Wrong chain after fork switch");

        vm.startBroadcast(key);

        uint256 mirrored;
        uint256 skipped;
        for (uint256 i = 0; i < itpIds.length; i++) {
            bytes32 itpId = itpIds[i];

            // Skip if already mirrored
            if (bridge.getBridgedItp(itpId) != address(0)) {
                console.log("  [skip] already mirrored:", vm.toString(itpId));
                skipped++;
                continue;
            }

            address[] memory assets = allAssets[i];
            uint256[] memory weights = allWeights[i];
            uint256[] memory prices = new uint256[](assets.length);
            for (uint256 j = 0; j < prices.length; j++) prices[j] = 1e18;

            string memory shortHex = _toHexShort(itpId);
            string memory name = string(abi.encodePacked("BR-", shortHex));
            string memory symbol = string(abi.encodePacked("BR", shortHex));

            uint256 nonce = bridge.requestCreateItp(
                name, symbol, weights, assets, prices,
                IBridgeProxy.ItpMetadata("", "", "")
            );

            bytes32 weightsHash = keccak256(abi.encodePacked(weights));
            bytes32 assetsHash = keccak256(abi.encodePacked(assets));
            bytes32 messageHash = keccak256(abi.encodePacked(
                settlementChainId, bridgeProxyAddr, admin, nonce, weightsHash, assetsHash
            ));

            bytes memory blsSig = blsSign("0,1,2", messageHash);
            address bridgedItp = bridge.completeCreateItp(nonce, itpId, blsSig, referenceNonce, signersBitmask);
            console.log("  [ok] itpId mirrored, BridgedITP at:");
            console.log("    itpId:", vm.toString(itpId));
            console.log("    bridgedItp:", bridgedItp);
            mirrored++;
        }

        vm.stopBroadcast();

        console.log("=== DONE ===");
        console.log("  mirrored:", mirrored);
        console.log("  skipped (already mirrored):", skipped);
        console.log("  total:", itpIds.length);
    }

    function _parseItpIds(string memory csv) internal pure returns (bytes32[] memory) {
        bytes memory b = bytes(csv);
        // Count commas + 1
        uint256 count = 1;
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == ",") count++;
        }
        bytes32[] memory result = new bytes32[](count);
        uint256 idx = 0;
        uint256 start = 0;
        for (uint256 i = 0; i <= b.length; i++) {
            if (i == b.length || b[i] == ",") {
                bytes memory sub = new bytes(i - start);
                for (uint256 j = start; j < i; j++) sub[j - start] = b[j];
                result[idx++] = _parseBytes32(string(sub));
                start = i + 1;
            }
        }
        return result;
    }

    function _parseBytes32(string memory s) internal pure returns (bytes32) {
        bytes memory b = bytes(s);
        uint256 offset = 0;
        if (b.length >= 2 && b[0] == "0" && (b[1] == "x" || b[1] == "X")) offset = 2;
        bytes32 result = 0;
        for (uint256 i = offset; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            uint8 v;
            if (c >= 48 && c <= 57) v = c - 48;
            else if (c >= 65 && c <= 70) v = c - 55;
            else if (c >= 97 && c <= 102) v = c - 87;
            else continue;
            result = (result << 4) | bytes32(uint256(v));
        }
        return result;
    }

    /// @notice 8-char hex slice for symbol building (last 4 bytes of itpId)
    function _toHexShort(bytes32 v) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789ABCDEF";
        bytes memory out = new bytes(8);
        for (uint256 i = 0; i < 4; i++) {
            uint8 b = uint8(uint256(v) >> (8 * (3 - i)));
            out[i * 2] = alphabet[b >> 4];
            out[i * 2 + 1] = alphabet[b & 0x0f];
        }
        return string(out);
    }
}
