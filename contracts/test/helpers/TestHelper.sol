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
        vm.prank(admin);
        issuerId = registry.addIssuer(issuerAddr, ipPort, pubkey);
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

        for (uint8 i = 0; i < 3; i++) {
            issuerIds[i] = registerIssuer(registry, admin, addrs[i], ips[i], i);
        }

        // Set the aggregated pubkey
        bytes memory aggPubkey = blsAggPubkey("0,1,2");
        vm.prank(admin);
        registry.setAggregatedPubkey(aggPubkey);
    }
}
