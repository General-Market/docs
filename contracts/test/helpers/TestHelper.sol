// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Governance} from "../../src/Governance.sol";
import {IssuerRegistry} from "../../src/registry/IssuerRegistry.sol";
import {IGovernance} from "../../src/interfaces/IGovernance.sol";
import {IIssuerRegistry} from "../../src/interfaces/IIssuerRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

abstract contract TestHelper is Test {
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

    function registerIssuer(
        IssuerRegistry registry,
        address admin,
        address issuerAddr,
        bytes32 ipPort,
        uint8 seed
    ) internal returns (uint256 issuerId) {
        bytes memory pubkey = generateTestPubkey(seed);
        vm.prank(admin);
        issuerId = registry.addIssuer(issuerAddr, ipPort, pubkey);
    }

    function generateTestPubkey(uint8 seed) internal pure returns (bytes memory) {
        bytes memory pubkey = new bytes(128);
        for (uint256 i = 0; i < 128; i++) {
            pubkey[i] = bytes1(uint8(seed + uint8(i % 256)));
        }
        return pubkey;
    }
}
