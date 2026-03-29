// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

interface IOracleRegistry {
    function lastSnapshotNonce() external view returns (uint256);
    function getAggregatedPubkey() external view returns (bytes memory);
    function setAggregatedPubkey(bytes calldata pubkey, uint256 nonce) external;
}

interface IGovernance {
    function admin() external view returns (address);
    function transferAdmin(address newAdmin) external;
}

/// @notice One-off script to refresh the L3 OracleRegistry snapshot.
///         The snapshot's blockNumber gets stale after 86400 blocks, causing
///         BLSVerifier__SnapshotTooOld on all BLS-verified calls (createBatch, settleBatch).
///         This calls setAggregatedPubkey with the SAME pubkey to refresh blockNumber.
contract RefreshL3Snapshot is Script {
    function run() external {
        address registryAddr = vm.envAddress("ORACLE_REGISTRY");
        address governanceAddr = vm.envAddress("GOVERNANCE");
        IOracleRegistry registry = IOracleRegistry(registryAddr);
        IGovernance governance = IGovernance(governanceAddr);

        uint256 nonce = registry.lastSnapshotNonce();
        bytes memory pubkey = registry.getAggregatedPubkey();
        address admin = governance.admin();

        console.log("Current lastSnapshotNonce:", nonce);
        console.log("Pubkey length:", pubkey.length);
        console.log("Governance admin:", admin);
        console.log("Broadcaster (deployer):", msg.sender);

        vm.startBroadcast();
        registry.setAggregatedPubkey(pubkey, nonce);
        vm.stopBroadcast();

        uint256 newNonce = registry.lastSnapshotNonce();
        console.log("New lastSnapshotNonce:", newNonce);
        console.log("Snapshot refreshed - SnapshotTooOld should be resolved");
    }
}
