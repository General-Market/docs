// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";

/// @title Multicall3 — aggregate multiple calls in one RPC round-trip
/// @notice Minimal but complete Multicall3 compatible with wagmi/viem
contract Multicall3 {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    /// @notice Aggregate calls, reverting on failure unless allowFailure is true
    function aggregate3(Call3[] calldata calls) public payable returns (Result[] memory returnData) {
        uint256 length = calls.length;
        returnData = new Result[](length);
        for (uint256 i = 0; i < length; i++) {
            (bool success, bytes memory ret) = calls[i].target.call(calls[i].callData);
            if (!calls[i].allowFailure && !success) {
                revert("Multicall3: call failed");
            }
            returnData[i] = Result(success, ret);
        }
    }

    function getBlockNumber() public view returns (uint256) {
        return block.number;
    }

    function getCurrentBlockTimestamp() public view returns (uint256) {
        return block.timestamp;
    }

    function getChainId() public view returns (uint256) {
        return block.chainid;
    }
}

contract DeployMulticall3 is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(key);
        Multicall3 mc = new Multicall3();
        console.log("Multicall3:", address(mc));
        vm.stopBroadcast();
    }
}
