// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../../src/Governance.sol";
import "../../src/registry/IssuerRegistry.sol";
import "../../src/core/BLSCustody.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployBLSCustodySettlement - Deploy BLSCustody and dependencies to Settlement
/// @notice Deploys Governance, IssuerRegistry, and BLSCustody as UUPS proxies on Settlement One
/// @dev Story 6.5: Deploys the full Settlement custody chain.
///      Whitelist proposal is attempted but may fail if IssuerRegistry returns a non-empty
///      aggregated pubkey (G1 64 bytes), because BLSCustody.proposeWhitelist(, 3, 7) calls
///      BLSLib.verifyBLS() which expects G2 pubkeys (128 bytes). This is a known Phase 1
///      limitation. Set SKIP_WHITELIST=true to skip whitelist proposals.
///      When whitelist succeeds, activation requires a separate call after the 2-day timelock.
contract DeployBLSCustodySettlement is Script {
    // Settlement mainnet addresses
    address constant ONEINCH_ROUTER_V6 = 0x111111125421cA6dc452d289314280a0f8842A65;
    address constant USDC_SETTLEMENT = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    uint256 constant SETTLEMENT_CHAIN_ID = 42161;

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

        // Optional: allow overriding IssuerRegistry address if already deployed
        address existingIssuerRegistry = vm.envOr("ISSUER_REGISTRY_ADDRESS", address(0));

        console2.log("===========================================");
        console2.log("SETTLEMENT BLSCustody DEPLOYMENT");
        console2.log("===========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        if (existingIssuerRegistry != address(0)) {
            // Use existing IssuerRegistry
            issuerRegistryProxy = existingIssuerRegistry;
            console2.log("Using existing IssuerRegistry:", existingIssuerRegistry);
        } else {
            // Deploy Governance (needed by IssuerRegistry)
            _deployGovernance(deployer);

            // Deploy IssuerRegistry
            _deployIssuerRegistry();
        }

        // Deploy BLSCustody
        _deployBLSCustody();

        // Propose initial whitelist targets (conditional - may fail if BLS verification active)
        bool skipWhitelist = vm.envOr("SKIP_WHITELIST", false);
        if (!skipWhitelist) {
            _proposeWhitelist();
        } else {
            console2.log("Skipping whitelist proposals (SKIP_WHITELIST=true)");
            console2.log("Whitelist must be proposed separately once BLS verification is configured.");
        }

        vm.stopBroadcast();

        // Save deployment output
        _saveDeployment(deployer);

        console2.log("");
        console2.log("===========================================");
        console2.log("DEPLOYMENT COMPLETE");
        console2.log("===========================================");

        if (!skipWhitelist) {
            console2.log("");
            console2.log("NOTE: Whitelist targets have been PROPOSED.");
            console2.log("Activation requires a separate call after the 2-day timelock.");
            console2.log("Run activateWhitelist() for each target after timelock expires.");
        }
    }

    function _deployGovernance(address deployer) internal {
        console2.log("Deploying Governance...");

        Governance govImpl = new Governance();
        governanceImpl = address(govImpl);
        console2.log("  Implementation:", governanceImpl);

        ERC1967Proxy govProxy = new ERC1967Proxy(
            governanceImpl,
            abi.encodeCall(Governance.initialize, (deployer))
        );
        governanceProxy = address(govProxy);
        console2.log("  Proxy:", governanceProxy);

        // Verify
        Governance gov = Governance(governanceProxy);
        require(gov.admin() == deployer, "Governance admin mismatch");
        console2.log("  Admin:", gov.admin());
        console2.log("");
    }

    function _deployIssuerRegistry() internal {
        console2.log("Deploying IssuerRegistry...");

        IssuerRegistry irImpl = new IssuerRegistry();
        issuerRegistryImpl = address(irImpl);
        console2.log("  Implementation:", issuerRegistryImpl);

        ERC1967Proxy irProxy = new ERC1967Proxy(
            issuerRegistryImpl,
            abi.encodeCall(IssuerRegistry.initialize, (governanceProxy))
        );
        issuerRegistryProxy = address(irProxy);
        console2.log("  Proxy:", issuerRegistryProxy);

        // Verify
        IssuerRegistry ir = IssuerRegistry(issuerRegistryProxy);
        require(address(ir.governance()) == governanceProxy, "IssuerRegistry governance mismatch");
        console2.log("  Governance:", address(ir.governance()));
        console2.log("");
    }

    function _deployBLSCustody() internal {
        console2.log("Deploying BLSCustody...");

        BLSCustody custodyImpl = new BLSCustody();
        blsCustodyImpl = address(custodyImpl);
        console2.log("  Implementation:", blsCustodyImpl);

        ERC1967Proxy custodyProxy = new ERC1967Proxy(
            blsCustodyImpl,
            abi.encodeCall(BLSCustody.initialize, (issuerRegistryProxy))
        );
        blsCustodyProxy = address(custodyProxy);
        console2.log("  Proxy:", blsCustodyProxy);

        // Verify
        BLSCustody custody = BLSCustody(blsCustodyProxy);
        require(address(custody.issuerRegistry()) == issuerRegistryProxy, "BLSCustody registry mismatch");
        console2.log("  IssuerRegistry:", address(custody.issuerRegistry()));
        console2.log("");
    }

    function _proposeWhitelist() internal {
        console2.log("Proposing whitelist targets...");

        BLSCustody custody = BLSCustody(blsCustodyProxy);
        // Empty BLS signature — proposeWhitelist() skips BLS verification when
        // IssuerRegistry.getAggregatedPubkey() returns empty bytes (0 issuers registered).
        // With a real IssuerRegistry that has issuers, this will revert (G1/G2 mismatch).
        // Use SKIP_WHITELIST=true in that case and propose whitelist separately.
        bytes memory emptySignature = "";

        // Propose 1inch Router V6
        custody.proposeWhitelist(ONEINCH_ROUTER_V6, emptySignature, 3, 7);
        console2.log("  Proposed: 1inch Router V6 ", ONEINCH_ROUTER_V6);

        // Propose USDC
        custody.proposeWhitelist(USDC_SETTLEMENT, emptySignature, 3, 7);
        console2.log("  Proposed: USDC            ", USDC_SETTLEMENT);

        console2.log("");
        console2.log("  Whitelist timelock: 2 days from now");
    }

    /// @dev Called after vm.stopBroadcast(). block.chainid and block.timestamp reflect the
    ///      RPC state at script execution time, not the mined block. vm.writeFile is a
    ///      cheatcode that operates outside broadcast context. Values serialized are addresses
    ///      and numbers (hex/decimal) — safe for string concatenation without JSON escaping.
    function _saveDeployment(address deployer) internal {
        string memory json = string.concat(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "contracts": {\n',
            '    "Governance": "', vm.toString(governanceProxy), '",\n',
            '    "GovernanceImpl": "', vm.toString(governanceImpl), '",\n',
            '    "IssuerRegistry": "', vm.toString(issuerRegistryProxy), '",\n',
            '    "IssuerRegistryImpl": "', vm.toString(issuerRegistryImpl), '",\n',
            '    "BLSCustody": "', vm.toString(blsCustodyProxy), '",\n',
            '    "BLSCustodyImpl": "', vm.toString(blsCustodyImpl), '"\n',
            '  },\n',
            '  "whitelisted": {\n',
            '    "1inchRouterV6": "', vm.toString(ONEINCH_ROUTER_V6), '",\n',
            '    "USDC": "', vm.toString(USDC_SETTLEMENT), '"\n',
            '  }\n',
            '}'
        );

        vm.writeFile("../deployments/settlement.json", json);
        console2.log("Addresses saved to: deployments/settlement.json");
    }
}
