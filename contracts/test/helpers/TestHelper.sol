// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Governance} from "../../src/Governance.sol";
import {OracleRegistry} from "../../src/registry/OracleRegistry.sol";
import {IGovernance} from "../../src/interfaces/IGovernance.sol";
import {IOracleRegistry} from "../../src/interfaces/IOracleRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {BLSTestHelper} from "./BLSTestHelper.sol";

abstract contract TestHelper is BLSTestHelper {
    /// @notice Standard test values for consensus-hardening params
    /// @dev REF_NONCE = 3 because registerTestOraclesWithBLS creates snapshots at nonces 1, 2, 3
    uint256 constant REF_NONCE = 3;
    uint256 constant SIGNERS_BITMASK = 7; // binary 111 = 3 oracles active

    function deployGovernance(address admin) internal returns (Governance) {
        Governance impl = new Governance();
        bytes memory initData = abi.encodeWithSelector(Governance.initialize.selector, admin);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        return Governance(address(proxy));
    }

    function deployOracleRegistry(address governanceAddr) internal returns (OracleRegistry) {
        OracleRegistry impl = new OracleRegistry();
        bytes memory initData = abi.encodeWithSelector(OracleRegistry.initialize.selector, governanceAddr);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        return OracleRegistry(address(proxy));
    }

    /// @notice Register an oracle with a REAL BLS public key from deterministic seed
    /// @param registry The OracleRegistry to register in
    /// @param admin The admin address (must have governance permissions)
    /// @param oracleAddr The oracle's Ethereum address
    /// @param ipPort The oracle's IP:port packed as bytes32
    /// @param seed The seed index for deterministic key generation
    /// @return oracleId The assigned oracle ID
    function registerOracle(
        OracleRegistry registry,
        address admin,
        address oracleAddr,
        bytes32 ipPort,
        uint8 seed
    ) internal returns (uint256 oracleId) {
        bytes memory pubkey = blsPubkey(seed);
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), oracleAddr, pubkey));
        bytes memory popSig = blsSign(vm.toString(uint256(seed)), popMsg);
        vm.prank(admin);
        oracleId = registry.addOracle(oracleAddr, ipPort, pubkey, popSig);

        // Auto-snapshot to satisfy PendingSnapshot constraint for subsequent mutations
        // Uses individual key as placeholder aggregate — tests needing proper BLS verification
        // should use registerTestOraclesWithBLS which overrides with correct aggregate keys
        uint256 nonce = registry.registryNonce();
        vm.prank(admin);
        registry.setAggregatedPubkey(pubkey, nonce);
    }

    /// @notice Create a snapshot after a non-addOracle mutation (remove, rotate, etc.)
    /// @dev Call after removeOracle or other state changes that increment registryNonce
    function snapshotRegistry(OracleRegistry registry, address admin) internal {
        uint256 nonce = registry.registryNonce();
        bytes memory pubkey = registry.getAggregatedPubkey();
        if (pubkey.length == 0) pubkey = new bytes(128); // dummy for empty registry
        vm.prank(admin);
        registry.setAggregatedPubkey(pubkey, nonce);
    }

    /// @notice Generate a real BLS public key from a seed index via FFI
    /// @dev Backward-compatible wrapper around blsPubkey() for existing tests
    function generateTestPubkey(uint8 seed) internal returns (bytes memory) {
        return blsPubkey(seed);
    }

    /// @notice Register 3 test oracles (seeds 0,1,2) and set aggregated pubkey
    /// @param registry The OracleRegistry to register in
    /// @param admin The admin address (must have governance permissions)
    /// @return oracleIds Array of 3 oracle IDs
    function registerTestOraclesWithBLS(
        OracleRegistry registry,
        address admin
    ) internal returns (uint256[3] memory oracleIds) {
        address[3] memory addrs = [
            makeAddr("oracle0"),
            makeAddr("oracle1"),
            makeAddr("oracle2")
        ];
        bytes32[3] memory ips = [
            bytes32(uint256(0x7f000001_1F90)), // 127.0.0.1:8080
            bytes32(uint256(0x7f000001_1F91)), // 127.0.0.1:8081
            bytes32(uint256(0x7f000001_1F92))  // 127.0.0.1:8082
        ];

        // registerOracle auto-snapshots after each addOracle (with individual key)
        for (uint8 i = 0; i < 3; i++) {
            oracleIds[i] = registerOracle(registry, admin, addrs[i], ips[i], i);
        }

        // Override final snapshot with correct aggregate key for BLS verification
        bytes memory aggPubkey = blsAggPubkey("0,1,2");
        vm.prank(admin);
        registry.setAggregatedPubkey(aggPubkey, 3);
    }

    /// @notice Authorize a protocol contract to call incrementMissedCounts on the registry
    /// @param registry The OracleRegistry to authorize on
    /// @param admin The admin address
    /// @param caller The protocol contract to authorize
    function authorizeMissedCountCaller(OracleRegistry registry, address admin, address caller) internal {
        vm.prank(admin);
        registry.setAuthorizedMissedCountCaller(caller, true);
    }

    /// @notice Sign a message hash with the 3 test oracles (seeds 0,1,2)
    function signWithTestOracles(bytes32 messageHash) internal returns (bytes memory) {
        return blsSign("0,1,2", messageHash);
    }
}
