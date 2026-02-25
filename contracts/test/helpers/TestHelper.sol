// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Governance} from "../../src/Governance.sol";
import {IssuerRegistry} from "../../src/registry/IssuerRegistry.sol";
import {IGovernance} from "../../src/interfaces/IGovernance.sol";
import {IIssuerRegistry} from "../../src/interfaces/IIssuerRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {BLSTestHelper} from "./BLSTestHelper.sol";

abstract contract TestHelper is BLSTestHelper {
    /// @notice Standard test values for consensus-hardening params
    /// @dev REF_NONCE = 3 because registerTestIssuersWithBLS creates snapshots at nonces 1, 2, 3
    uint256 constant REF_NONCE = 3;
    uint256 constant SIGNERS_BITMASK = 7; // binary 111 = 3 issuers active

    function deployGovernance(address admin) internal returns (Governance) {
        Governance impl = new Governance();
        bytes memory initData = abi.encodeWithSelector(Governance.initialize.selector, admin);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        return Governance(address(proxy));
    }

    function deployIssuerRegistry(address governanceAddr) internal returns (IssuerRegistry) {
        IssuerRegistry impl = new IssuerRegistry();
        bytes memory initData = abi.encodeWithSelector(IssuerRegistry.initialize.selector, governanceAddr);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        return IssuerRegistry(address(proxy));
    }

    /// @notice Register an issuer with a REAL BLS public key from deterministic seed
    /// @param registry The IssuerRegistry to register in
    /// @param admin The admin address (must have governance permissions)
    /// @param issuerAddr The issuer's Ethereum address
    /// @param ipPort The issuer's IP:port packed as bytes32
    /// @param seed The seed index for deterministic key generation
    /// @return issuerId The assigned issuer ID
    function registerIssuer(
        IssuerRegistry registry,
        address admin,
        address issuerAddr,
        bytes32 ipPort,
        uint8 seed
    ) internal returns (uint256 issuerId) {
        bytes memory pubkey = blsPubkey(seed);
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, address(registry), issuerAddr, pubkey));
        bytes memory popSig = blsSign(vm.toString(uint256(seed)), popMsg);
        vm.prank(admin);
        issuerId = registry.addIssuer(issuerAddr, ipPort, pubkey, popSig);

        // Auto-snapshot to satisfy PendingSnapshot constraint for subsequent mutations
        // Uses individual key as placeholder aggregate — tests needing proper BLS verification
        // should use registerTestIssuersWithBLS which overrides with correct aggregate keys
        uint256 nonce = registry.registryNonce();
        vm.prank(admin);
        registry.setAggregatedPubkey(pubkey, nonce);
    }

    /// @notice Create a snapshot after a non-addIssuer mutation (remove, rotate, etc.)
    /// @dev Call after removeIssuer or other state changes that increment registryNonce
    function snapshotRegistry(IssuerRegistry registry, address admin) internal {
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

    /// @notice Register 3 test issuers (seeds 0,1,2) and set aggregated pubkey
    /// @param registry The IssuerRegistry to register in
    /// @param admin The admin address (must have governance permissions)
    /// @return issuerIds Array of 3 issuer IDs
    function registerTestIssuersWithBLS(
        IssuerRegistry registry,
        address admin
    ) internal returns (uint256[3] memory issuerIds) {
        address[3] memory addrs = [
            makeAddr("issuer0"),
            makeAddr("issuer1"),
            makeAddr("issuer2")
        ];
        bytes32[3] memory ips = [
            bytes32(uint256(0x7f000001_1F90)), // 127.0.0.1:8080
            bytes32(uint256(0x7f000001_1F91)), // 127.0.0.1:8081
            bytes32(uint256(0x7f000001_1F92))  // 127.0.0.1:8082
        ];

        // registerIssuer auto-snapshots after each addIssuer (with individual key)
        for (uint8 i = 0; i < 3; i++) {
            issuerIds[i] = registerIssuer(registry, admin, addrs[i], ips[i], i);
        }

        // Override final snapshot with correct aggregate key for BLS verification
        bytes memory aggPubkey = blsAggPubkey("0,1,2");
        vm.prank(admin);
        registry.setAggregatedPubkey(aggPubkey, 3);
    }

    /// @notice Sign a message hash with the 3 test issuers (seeds 0,1,2)
    function signWithTestIssuers(bytes32 messageHash) internal returns (bytes memory) {
        return blsSign("0,1,2", messageHash);
    }
}
