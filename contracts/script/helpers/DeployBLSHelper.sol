// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

/// @title DeployBLSHelper - FFI-based BLS signing for deploy scripts
/// @dev Mirror of BLSTestHelper but extends Script instead of Test.
///      Requires `ffi = true` in foundry.toml and bls-tool to be built.
abstract contract DeployBLSHelper is Script {
    string constant BLS_TOOL = "../target/release/bls-tool";

    /// @notice Sign a message hash with deterministic keypairs via FFI
    function blsSign(string memory seedIndices, bytes32 messageHash) internal returns (bytes memory) {
        string[] memory cmd = new string[](6);
        cmd[0] = BLS_TOOL;
        cmd[1] = "sign";
        cmd[2] = "--seed-indices";
        cmd[3] = seedIndices;
        cmd[4] = "--message-hash";
        cmd[5] = _bytes32ToHex(messageHash);
        return vm.ffi(cmd);
    }

    /// @notice Get aggregated G2 public key from deterministic seed indices
    function blsAggPubkey(string memory seedIndices) internal returns (bytes memory) {
        string[] memory cmd = new string[](4);
        cmd[0] = BLS_TOOL;
        cmd[1] = "agg-pubkey-from-seeds";
        cmd[2] = "--seed-indices";
        cmd[3] = seedIndices;
        return vm.ffi(cmd);
    }

    /// @notice Get a single oracle's G2 public key from seed index
    function blsPubkey(uint8 seedIndex) internal returns (bytes memory) {
        string[] memory cmd = new string[](4);
        cmd[0] = BLS_TOOL;
        cmd[1] = "pubkey";
        cmd[2] = "--seed-index";
        cmd[3] = vm.toString(uint256(seedIndex));
        return vm.ffi(cmd);
    }

    /// @notice Convert bytes32 to 0x-prefixed hex string
    function _bytes32ToHex(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(66);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }
}
