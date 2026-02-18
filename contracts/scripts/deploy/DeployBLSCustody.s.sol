// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Governance} from "../../src/Governance.sol";
import {IssuerRegistry} from "../../src/registry/IssuerRegistry.sol";
import {BLSCustody} from "../../src/core/BLSCustody.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployBLSCustody - Generic BLSCustody deployment script for any EVM chain
/// @notice Deploys Governance, IssuerRegistry, and BLSCustody as UUPS proxies
/// @dev Story 6.6: Generic multi-chain deployment. Chain-specific parameters come from env vars.
///      Supports reusing an existing IssuerRegistry via ISSUER_REGISTRY_ADDRESS env var.
///      Whitelist proposal is conditional (SKIP_WHITELIST=true to skip) because proposeWhitelist()
///      calls BLSLib.verifyBLS() which may fail if aggregated pubkey is non-empty but G1 (64 bytes)
///      rather than the expected G2 format (128 bytes). Phase 1 with empty aggregated pubkey works.
contract DeployBLSCustody is Script {
    // Deployed addresses
    address public governanceProxy;
    address public governanceImpl;
    address public issuerRegistryProxy;
    address public issuerRegistryImpl;
    address public blsCustodyProxy;
    address public blsCustodyImpl;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Optional: reuse an already-deployed IssuerRegistry
        address existingIssuerRegistry = vm.envOr("ISSUER_REGISTRY_ADDRESS", address(0));

        console2.log("===========================================");
        console2.log("BLSCustody DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        if (existingIssuerRegistry != address(0)) {
            issuerRegistryProxy = existingIssuerRegistry;
            console2.log("Using existing IssuerRegistry:", existingIssuerRegistry);
        } else {
            _deployGovernance(deployer);
            _deployIssuerRegistry();
        }

        _deployBLSCustody();

        vm.stopBroadcast();

        // Post-deploy verification (outside broadcast)
        _verify(existingIssuerRegistry);

        // Save deployment output
        _saveDeployment(deployer);

        console2.log("");
        console2.log("===========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("===========================================");
    }

    function _deployGovernance(address deployer) internal {
        console2.log("Deploying Governance...");

        Governance impl = new Governance();
        governanceImpl = address(impl);
        console2.log("  Implementation:", governanceImpl);

        ERC1967Proxy proxy = new ERC1967Proxy(
            governanceImpl,
            abi.encodeCall(Governance.initialize, (deployer))
        );
        governanceProxy = address(proxy);
        console2.log("  Proxy:", governanceProxy);

        // Inline verification: fail fast before deploying downstream contracts
        Governance gov = Governance(governanceProxy);
        require(gov.admin() == deployer, "Governance: admin mismatch");
        console2.log("  Verified: admin =", gov.admin());
        console2.log("");
    }

    function _deployIssuerRegistry() internal {
        console2.log("Deploying IssuerRegistry...");

        IssuerRegistry impl = new IssuerRegistry();
        issuerRegistryImpl = address(impl);
        console2.log("  Implementation:", issuerRegistryImpl);

        ERC1967Proxy proxy = new ERC1967Proxy(
            issuerRegistryImpl,
            abi.encodeCall(IssuerRegistry.initialize, (governanceProxy))
        );
        issuerRegistryProxy = address(proxy);
        console2.log("  Proxy:", issuerRegistryProxy);

        // Inline verification: fail fast before deploying BLSCustody
        IssuerRegistry registry = IssuerRegistry(issuerRegistryProxy);
        require(address(registry.governance()) == governanceProxy, "IssuerRegistry: governance mismatch");
        console2.log("  Verified: governance =", address(registry.governance()));
        console2.log("");
    }

    function _deployBLSCustody() internal {
        console2.log("Deploying BLSCustody...");

        BLSCustody impl = new BLSCustody();
        blsCustodyImpl = address(impl);
        console2.log("  Implementation:", blsCustodyImpl);

        ERC1967Proxy proxy = new ERC1967Proxy(
            blsCustodyImpl,
            abi.encodeCall(BLSCustody.initialize, (issuerRegistryProxy))
        );
        blsCustodyProxy = address(proxy);
        console2.log("  Proxy:", blsCustodyProxy);
        console2.log("");
    }

    function _verify(address existingIssuerRegistry) internal view {
        console2.log("Verifying deployment...");

        // Verify BLSCustody initialization
        BLSCustody custody = BLSCustody(blsCustodyProxy);
        require(
            address(custody.issuerRegistry()) == issuerRegistryProxy,
            "BLSCustody: issuerRegistry mismatch"
        );
        require(custody.nonce() == 0, "BLSCustody: nonce should be 0");
        console2.log("  BLSCustody issuerRegistry:", address(custody.issuerRegistry()));
        console2.log("  BLSCustody nonce:", custody.nonce());

        // Verify Governance + IssuerRegistry if freshly deployed
        if (existingIssuerRegistry == address(0)) {
            Governance gov = Governance(governanceProxy);
            require(!gov.isPaused(), "Governance: should not be paused");
            console2.log("  Governance admin:", gov.admin());

            IssuerRegistry registry = IssuerRegistry(issuerRegistryProxy);
            require(
                address(registry.governance()) == governanceProxy,
                "IssuerRegistry: governance mismatch"
            );
            require(registry.activeIssuerCount() == 0, "IssuerRegistry: active count should be 0");
            console2.log("  IssuerRegistry governance:", address(registry.governance()));
        }

        console2.log("  Deployment verified successfully!");
        console2.log("");
    }

    function _saveDeployment(address deployer) internal {
        string memory json = string.concat(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "contracts": {\n'
        );

        // Include Governance and IssuerRegistry only if freshly deployed
        if (governanceImpl != address(0)) {
            json = string.concat(json,
                '    "Governance": {\n',
                '      "proxy": "', vm.toString(governanceProxy), '",\n',
                '      "implementation": "', vm.toString(governanceImpl), '"\n',
                '    },\n'
            );
            json = string.concat(json,
                '    "IssuerRegistry": {\n',
                '      "proxy": "', vm.toString(issuerRegistryProxy), '",\n',
                '      "implementation": "', vm.toString(issuerRegistryImpl), '"\n',
                '    },\n'
            );
        } else {
            json = string.concat(json,
                '    "IssuerRegistry": {\n',
                '      "proxy": "', vm.toString(issuerRegistryProxy), '"\n',
                '    },\n'
            );
        }

        json = string.concat(json,
            '    "BLSCustody": {\n',
            '      "proxy": "', vm.toString(blsCustodyProxy), '",\n',
            '      "implementation": "', vm.toString(blsCustodyImpl), '"\n',
            '    }\n'
        );

        json = string.concat(json, '  }\n', '}');

        // Output file path determined by chain-specific shell script
        string memory outputPath = vm.envOr("DEPLOYMENT_OUTPUT", string("../deployments/deployment.json"));
        vm.writeFile(outputPath, json);
        console2.log("Addresses saved to:", outputPath);
    }
}
