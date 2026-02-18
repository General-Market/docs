// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

// Contracts for interface calls
import {Governance} from "../../src/Governance.sol";
import {IssuerRegistry} from "../../src/registry/IssuerRegistry.sol";
import {FeeRegistry} from "../../src/registry/FeeRegistry.sol";
import {AssetPairRegistry} from "../../src/registry/AssetPairRegistry.sol";
import {CollateralRegistry} from "../../src/registry/CollateralRegistry.sol";
import {BLSCustody} from "../../src/core/BLSCustody.sol";
import {L3BridgeCustody} from "../../src/custody/L3BridgeCustody.sol";
import {Index} from "../../src/core/Index.sol";

/// @title VerifyL3Deployment - Post-deployment verification for L3 testnet
/// @notice Reads l3-testnet.json and verifies all contracts are correctly initialized
/// @dev Run with: forge script scripts/deploy/VerifyL3Deployment.s.sol --rpc-url $TESTNET_RPC -vvvv
contract VerifyL3Deployment is Script {
    uint256 public checks;
    uint256 public passed;
    uint256 public failed;

    function run() external {
        // Load addresses from environment (set by reading l3-testnet.json or manually)
        address governanceProxy = vm.envAddress("GOVERNANCE_ADDRESS");
        address issuerRegistryProxy = vm.envAddress("ISSUER_REGISTRY_ADDRESS");
        address feeRegistryProxy = vm.envAddress("FEE_REGISTRY_ADDRESS");
        address assetPairRegistryAddr = vm.envAddress("ASSET_PAIR_REGISTRY_ADDRESS");
        address collateralRegistryAddr = vm.envAddress("COLLATERAL_REGISTRY_ADDRESS");
        address blsCustodyProxy = vm.envAddress("BLS_CUSTODY_ADDRESS");
        address l3BridgeCustodyProxy = vm.envAddress("L3_BRIDGE_CUSTODY_ADDRESS");
        address indexProxy = vm.envAddress("INDEX_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address admin = vm.envAddress("ADMIN_ADDRESS");

        console2.log("===========================================");
        console2.log("L3 DEPLOYMENT VERIFICATION");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("");

        // ============ Governance ============
        console2.log("--- Governance ---");
        {
            Governance gov = Governance(governanceProxy);
            _check("admin is correct", gov.admin() == admin);
            _check("system not paused", !gov.isPaused());
            _checkHasCode("proxy has code", governanceProxy);
        }

        // ============ IssuerRegistry ============
        console2.log("--- IssuerRegistry ---");
        {
            IssuerRegistry reg = IssuerRegistry(issuerRegistryProxy);
            _check("governance matches", address(reg.governance()) == governanceProxy);
            _check("active issuers >= 3", reg.activeIssuerCount() >= 3);
            bytes memory aggKey = reg.getAggregatedPubkey();
            _check("aggregated pubkey is 64 bytes", aggKey.length == 64);
            _checkHasCode("proxy has code", issuerRegistryProxy);
        }

        // ============ FeeRegistry ============
        console2.log("--- FeeRegistry ---");
        {
            FeeRegistry reg = FeeRegistry(feeRegistryProxy);
            _check("admin is correct", reg.admin() == admin);
            _checkHasCode("proxy has code", feeRegistryProxy);
        }

        // ============ AssetPairRegistry ============
        console2.log("--- AssetPairRegistry ---");
        {
            AssetPairRegistry reg = AssetPairRegistry(assetPairRegistryAddr);
            _check("admin is correct", reg.admin() == admin);
            _checkHasCode("has code", assetPairRegistryAddr);
        }

        // ============ CollateralRegistry ============
        console2.log("--- CollateralRegistry ---");
        {
            CollateralRegistry reg = CollateralRegistry(collateralRegistryAddr);
            _check("admin is correct", reg.admin() == admin);
            _checkHasCode("has code", collateralRegistryAddr);
        }

        // ============ BLSCustody ============
        console2.log("--- BLSCustody ---");
        {
            BLSCustody custody = BLSCustody(blsCustodyProxy);
            _check("issuerRegistry matches", address(custody.issuerRegistry()) == issuerRegistryProxy);
            _checkHasCode("proxy has code", blsCustodyProxy);
        }

        // ============ L3BridgeCustody ============
        console2.log("--- L3BridgeCustody ---");
        {
            L3BridgeCustody custody = L3BridgeCustody(l3BridgeCustodyProxy);
            _check("issuerRegistry matches", address(custody.issuerRegistry()) == issuerRegistryProxy);
            _check("usdc matches", address(custody.usdc()) == usdc);
            _checkHasCode("proxy has code", l3BridgeCustodyProxy);
        }

        // ============ Index ============
        console2.log("--- Index ---");
        {
            Index idx = Index(indexProxy);
            _check("governance matches", address(idx.governance()) == governanceProxy);
            _check("usdc matches", address(idx.usdc()) == usdc);
            _checkHasCode("proxy has code", indexProxy);
        }

        // ============ UUPS Proxy Checks ============
        console2.log("--- UUPS Proxy Verification ---");
        // Check proxiableUUID on all UUPS proxied contracts
        // ERC1967 implementation slot: 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
        bytes32 implSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);

        _checkProxySlot("Governance proxy", governanceProxy, implSlot);
        _checkProxySlot("IssuerRegistry proxy", issuerRegistryProxy, implSlot);
        _checkProxySlot("FeeRegistry proxy", feeRegistryProxy, implSlot);
        _checkProxySlot("BLSCustody proxy", blsCustodyProxy, implSlot);
        _checkProxySlot("L3BridgeCustody proxy", l3BridgeCustodyProxy, implSlot);
        _checkProxySlot("Index proxy", indexProxy, implSlot);

        // ============ Summary ============
        console2.log("");
        console2.log("===========================================");
        console2.log("VERIFICATION COMPLETE");
        console2.log("===========================================");
        console2.log("Checks:", checks);
        console2.log("Passed:", passed);
        console2.log("Failed:", failed);
        require(failed == 0, "Verification FAILED: one or more checks did not pass");
    }

    function _check(string memory name, bool condition) internal {
        checks++;
        if (condition) {
            passed++;
            console2.log(string.concat("  PASS: ", name));
        } else {
            failed++;
            console2.log(string.concat("  FAIL: ", name));
        }
    }

    function _checkHasCode(string memory name, address addr) internal {
        _check(name, addr.code.length > 0);
    }

    function _checkProxySlot(string memory name, address proxy, bytes32 slot) internal {
        bytes32 implAddr = vm.load(proxy, slot);
        bool hasImpl = implAddr != bytes32(0) && address(uint160(uint256(implAddr))).code.length > 0;
        _check(string.concat(name, " has valid impl"), hasImpl);
        if (hasImpl) {
            console2.log("    impl:", vm.toString(address(uint160(uint256(implAddr)))));
        }
    }
}
