// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

/// @title BLSTestHelper - FFI-based BLS signing for Forge tests
/// @dev Calls the bls-tool binary via vm.ffi() to produce real BLS signatures.
///      Requires `ffi = true` in foundry.toml and bls-tool to be built.
abstract contract BLSTestHelper is Test {
    /// @notice Path to the bls-tool binary (relative to contracts/ directory)
    string constant BLS_TOOL = "../target/release/bls-tool";

    /// @notice Sign a message hash with deterministic keypairs via FFI
    /// @param seedIndices Comma-separated seed indices (e.g. "0,1,2")
    /// @param messageHash The 32-byte message hash to sign
    /// @return signature The aggregated BLS signature (64 bytes)
    function blsSign(string memory seedIndices, bytes32 messageHash) internal returns (bytes memory) {
        string[] memory cmd = new string[](6);
        cmd[0] = BLS_TOOL;
        cmd[1] = "sign";
        cmd[2] = "--seed-indices";
        cmd[3] = seedIndices;
        cmd[4] = "--message-hash";
        cmd[5] = _bytes32ToHex(messageHash);
        bytes memory result = vm.ffi(cmd);
        return result;
    }

    /// @notice Get aggregated G2 public key from deterministic seed indices via FFI
    /// @param seedIndices Comma-separated seed indices (e.g. "0,1,2")
    /// @return pubkey The aggregated G2 public key (128 bytes)
    function blsAggPubkey(string memory seedIndices) internal returns (bytes memory) {
        string[] memory cmd = new string[](4);
        cmd[0] = BLS_TOOL;
        cmd[1] = "agg-pubkey-from-seeds";
        cmd[2] = "--seed-indices";
        cmd[3] = seedIndices;
        bytes memory result = vm.ffi(cmd);
        return result;
    }

    /// @notice Get a single oracle's G2 public key from seed index via FFI
    /// @param seedIndex The seed index
    /// @return pubkey The G2 public key (128 bytes)
    function blsPubkey(uint8 seedIndex) internal returns (bytes memory) {
        string[] memory cmd = new string[](4);
        cmd[0] = BLS_TOOL;
        cmd[1] = "pubkey";
        cmd[2] = "--seed-index";
        cmd[3] = vm.toString(uint256(seedIndex));
        bytes memory result = vm.ffi(cmd);
        return result;
    }

    /// @notice Convert bytes32 to 0x-prefixed hex string
    function _bytes32ToHex(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(66); // "0x" + 64 hex chars
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }
}
