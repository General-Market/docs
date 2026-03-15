// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Governance} from "../../src/Governance.sol";
import {OracleRegistry} from "../../src/registry/OracleRegistry.sol";
import {BLSCustody} from "../../src/core/BLSCustody.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployBLSCustody - Generic BLSCustody deployment script for any EVM chain
/// @notice Deploys Governance, OracleRegistry, and BLSCustody as UUPS proxies
/// @dev Story 6.6: Generic multi-chain deployment. Chain-specific parameters come from env vars.
///      Supports reusing an existing OracleRegistry via ORACLE_REGISTRY_ADDRESS env var.
///      Whitelist proposal is conditional (SKIP_WHITELIST=true to skip) because proposeWhitelist()
///      calls BLSLib.verifyBLS() which may fail if aggregated pubkey is non-empty but G1 (64 bytes)
///      rather than the expected G2 format (128 bytes). Phase 1 with empty aggregated pubkey works.
contract DeployBLSCustody is Script {
    // Deployed addresses
    address public governanceProxy;
    address public governanceImpl;
    address public oracleRegistryProxy;
    address public oracleRegistryImpl;
    address public blsCustodyProxy;
    address public blsCustodyImpl;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Optional: reuse an already-deployed OracleRegistry
        address existingOracleRegistry = vm.envOr("ORACLE_REGISTRY_ADDRESS", address(0));

        console2.log("===========================================");
        console2.log("BLSCustody DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        if (existingOracleRegistry != address(0)) {
            oracleRegistryProxy = existingOracleRegistry;
            console2.log("Using existing OracleRegistry:", existingOracleRegistry);
        } else {
            _deployGovernance(deployer);
            _deployOracleRegistry();
        }

        _deployBLSCustody();

        vm.stopBroadcast();

        // Post-deploy verification (outside broadcast)
        _verify(existingOracleRegistry);

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

    function _deployOracleRegistry() internal {
        console2.log("Deploying OracleRegistry...");

        OracleRegistry impl = new OracleRegistry();
        oracleRegistryImpl = address(impl);
        console2.log("  Implementation:", oracleRegistryImpl);

        ERC1967Proxy proxy = new ERC1967Proxy(
            oracleRegistryImpl,
            abi.encodeCall(OracleRegistry.initialize, (governanceProxy))
        );
        oracleRegistryProxy = address(proxy);
        console2.log("  Proxy:", oracleRegistryProxy);

        // Inline verification: fail fast before deploying BLSCustody
        OracleRegistry registry = OracleRegistry(oracleRegistryProxy);
        require(address(registry.governance()) == governanceProxy, "OracleRegistry: governance mismatch");
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
            abi.encodeCall(BLSCustody.initialize, (oracleRegistryProxy))
        );
        blsCustodyProxy = address(proxy);
        console2.log("  Proxy:", blsCustodyProxy);
        console2.log("");
    }

    function _verify(address existingOracleRegistry) internal view {
        console2.log("Verifying deployment...");

        // Verify BLSCustody initialization
        BLSCustody custody = BLSCustody(blsCustodyProxy);
        require(
            address(custody.oracleRegistry()) == oracleRegistryProxy,
            "BLSCustody: oracleRegistry mismatch"
        );
        require(custody.nonce() == 0, "BLSCustody: nonce should be 0");
        console2.log("  BLSCustody oracleRegistry:", address(custody.oracleRegistry()));
        console2.log("  BLSCustody nonce:", custody.nonce());

        // Verify Governance + OracleRegistry if freshly deployed
        if (existingOracleRegistry == address(0)) {
            Governance gov = Governance(governanceProxy);
            require(!gov.isPaused(), "Governance: should not be paused");
            console2.log("  Governance admin:", gov.admin());

            OracleRegistry registry = OracleRegistry(oracleRegistryProxy);
            require(
                address(registry.governance()) == governanceProxy,
                "OracleRegistry: governance mismatch"
            );
            require(registry.activeOracleCount() == 0, "OracleRegistry: active count should be 0");
            console2.log("  OracleRegistry governance:", address(registry.governance()));
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

        // Include Governance and OracleRegistry only if freshly deployed
        if (governanceImpl != address(0)) {
            json = string.concat(json,
                '    "Governance": {\n',
                '      "proxy": "', vm.toString(governanceProxy), '",\n',
                '      "implementation": "', vm.toString(governanceImpl), '"\n',
                '    },\n'
            );
            json = string.concat(json,
                '    "OracleRegistry": {\n',
                '      "proxy": "', vm.toString(oracleRegistryProxy), '",\n',
                '      "implementation": "', vm.toString(oracleRegistryImpl), '"\n',
                '    },\n'
            );
        } else {
            json = string.concat(json,
                '    "OracleRegistry": {\n',
                '      "proxy": "', vm.toString(oracleRegistryProxy), '"\n',
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
