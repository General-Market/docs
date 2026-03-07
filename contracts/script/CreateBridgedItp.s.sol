// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/console.sol";
import "../src/bridge/BridgeProxy.sol";
import "./helpers/DeployBLSHelper.sol";

/// @title CreateBridgedItp - Create a BridgedITP on Settlement via requestCreateItp + completeCreateItp
/// @notice Replaces the old adminCreateBridgedItp admin bypass with proper BLS-signed flow
/// @dev Reads ITP data from env vars (set by start.sh), creates pending request, then completes with BLS
contract CreateBridgedItp is DeployBLSHelper {
    uint256 public constant NUM_ASSETS = 100;
    uint256 public constant WEIGHT_PER_ASSET = 1e16; // 1%

    function run() external {
        console.log("=== CREATE BRIDGED ITP (BLS-signed) ===");

        address bridgeProxyAddr = vm.envAddress("BRIDGE_PROXY");
        bytes32 orbitItpId = vm.envBytes32("ITP_ID");
        string memory itpName = vm.envOr("ITP_NAME", string("Top 100 ITP"));
        string memory itpSymbol = vm.envOr("ITP_SYMBOL", string("ITP100"));

        // Read token addresses from ITP_TOKENS env (comma-separated)
        string memory tokensEnv = vm.envString("ITP_TOKENS");
        address[] memory assets = _parseAddresses(tokensEnv, NUM_ASSETS);

        console.log("  BridgeProxy:", bridgeProxyAddr);
        console.log("  orbitItpId:", vm.toString(orbitItpId));
        console.log("  name:", itpName);
        console.log("  symbol:", itpSymbol);
        console.log("  assets:", assets.length);

        uint256 key = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address admin = vm.addr(key);

        // Build weights (equal weight 1% each) and prices (1e18 each)
        uint256[] memory weights = new uint256[](NUM_ASSETS);
        uint256[] memory prices = new uint256[](NUM_ASSETS);
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            weights[i] = WEIGHT_PER_ASSET;
            prices[i] = 1e18;
        }

        vm.startBroadcast(key);

        BridgeProxy bridge = BridgeProxy(bridgeProxyAddr);

        // Step 1: requestCreateItp
        uint256 nonce = bridge.requestCreateItp(itpName, itpSymbol, weights, assets, prices, IBridgeProxy.ItpMetadata("", "", ""));
        console.log("  requestCreateItp nonce:", nonce);

        // Step 2: Compute message hash matching completeCreateItp
        bytes32 weightsHash = keccak256(abi.encodePacked(weights));
        bytes32 assetsHash = keccak256(abi.encodePacked(assets));
        bytes32 messageHash = keccak256(
            abi.encodePacked(block.chainid, bridgeProxyAddr, admin, nonce, weightsHash, assetsHash)
        );

        // Step 3: Sign with BLS
        bytes memory blsSig = blsSign("0,1,2", messageHash);

        // Step 4: completeCreateItp
        address bridgedItp = bridge.completeCreateItp(nonce, orbitItpId, blsSig, 3, 7);
        console.log("  BridgedITP created:", bridgedItp);

        vm.stopBroadcast();

        // Export result
        string memory obj = "d";
        string memory json = vm.serializeAddress(obj, "BridgedITP", bridgedItp);
        vm.writeJson(json, "../deployments/bridged-itp.json");
        console.log("  Saved to deployments/bridged-itp.json");
    }

    /// @notice Parse comma-separated hex addresses from env string
    function _parseAddresses(string memory csv, uint256 expected) internal pure returns (address[] memory) {
        address[] memory result = new address[](expected);
        bytes memory b = bytes(csv);
        uint256 idx = 0;
        uint256 start = 0;

        for (uint256 i = 0; i <= b.length; i++) {
            if (i == b.length || b[i] == ",") {
                if (i > start && idx < expected) {
                    // Extract substring
                    bytes memory addrBytes = new bytes(i - start);
                    for (uint256 j = start; j < i; j++) {
                        addrBytes[j - start] = b[j];
                    }
                    result[idx] = _parseAddress(string(addrBytes));
                    idx++;
                }
                start = i + 1;
            }
        }

        require(idx == expected, "Wrong number of addresses");
        return result;
    }

    /// @notice Parse a single hex address string to address
    function _parseAddress(string memory s) internal pure returns (address) {
        bytes memory b = bytes(s);
        uint256 offset = 0;
        // Skip 0x prefix
        if (b.length >= 2 && b[0] == "0" && (b[1] == "x" || b[1] == "X")) {
            offset = 2;
        }
        uint160 result = 0;
        for (uint256 i = offset; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            uint8 val;
            if (c >= 48 && c <= 57) val = c - 48;        // 0-9
            else if (c >= 65 && c <= 70) val = c - 55;    // A-F
            else if (c >= 97 && c <= 102) val = c - 87;   // a-f
            else continue; // skip whitespace/newlines
            result = result * 16 + val;
        }
        return address(result);
    }
}
