// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/mocks/MockERC20.sol";
import "../src/Governance.sol";
import "../src/registry/IssuerRegistry.sol";
import "../src/mocks/MockBitgetVault.sol";
import "../src/core/Investment.sol";
import "../src/core/BLSCustody.sol";
import "../src/registry/CollateralRegistry.sol";
import "../src/custody/L3BridgeCustody.sol";
import "../src/custody/ArbBridgeCustody.sol";
import "../src/bridge/BridgeProxy.sol";
import "../src/bridge/BridgedItpFactory.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./helpers/DeployBLSHelper.sol";

/// @title DeployFullSystemE2E - Full E2E deployment for 4-phase system testing
/// @notice Deploys all contracts needed for Story 6.18 E2E full system tests
/// @dev Extends 6.17 pattern with: user funding, cross-chain buy setup, ITP creation
///
/// ## Decimal Handling (Story 7-6b)
/// - L3_WUSDC: 18 decimals (internal protocol standard)
/// - ARB_WUSDC: 6 decimals (real USDC on Arbitrum)
/// - Protocol converts at boundaries: 6→18 on entry, 18→6 on exit
contract DeployFullSystemE2E is DeployBLSHelper {
    // ============ CONSTANTS ============

    uint256 public constant CHAIN_ID = 111222333;
    uint256 public constant ARB_CHAIN_ID = 421611337;

    // L3 amounts use 18 decimals (internal protocol standard)
    uint256 public constant VAULT_INITIAL_BALANCE_18DEC = 1_000_000 * 1e18;
    uint256 public constant CUSTODY_INITIAL_BALANCE_18DEC = 100_000 * 1e18;
    uint256 public constant AP_INITIAL_BALANCE_18DEC = 500_000 * 1e18;
    uint256 public constant USER_INITIAL_BALANCE_18DEC = 50_000 * 1e18;

    // Arb amounts use 6 decimals (real USDC)
    uint256 public constant VAULT_INITIAL_BALANCE_6DEC = 1_000_000 * 1e6;
    uint256 public constant CUSTODY_INITIAL_BALANCE_6DEC = 100_000 * 1e6;
    uint256 public constant USER_INITIAL_BALANCE_6DEC = 50_000 * 1e6;

    // Legacy aliases for non-USDC tokens (always 18 decimals)
    uint256 public constant VAULT_INITIAL_BALANCE = VAULT_INITIAL_BALANCE_18DEC;
    uint256 public constant CUSTODY_INITIAL_BALANCE = CUSTODY_INITIAL_BALANCE_18DEC;
    uint256 public constant AP_INITIAL_BALANCE = AP_INITIAL_BALANCE_18DEC;
    uint256 public constant USER_INITIAL_BALANCE = USER_INITIAL_BALANCE_18DEC;

    // ============ DEPLOYED ADDRESSES ============

    address public l3Wusdc;
    address public arbWusdc;
    address public mockUsdt;
    address public governance;
    address public indexProxy;
    address public issuerRegistry;
    address public collateralRegistry;
    address public l3BridgeCustodyProxy;
    address public arbBridgeCustodyProxy;
    address public blsCustodyProxy;
    address public mockBitgetVault;
    address public bridgeProxyAddr;
    address public bridgedItpFactory;

    // Anvil accounts
    address public admin;
    address public issuer1;
    address public issuer2;
    address public issuer3;
    address public ap;
    address public user;
    address public constant TEST_USER = 0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4;

    function run() external {
        _setupAccounts();
        _logHeader();

        uint256 deployerPrivateKey = _getDeployerKey();
        vm.startBroadcast(deployerPrivateKey);

        _deployTokens();
        _deployCore();
        _deployRegistries();
        _deployExchange();
        _deployBridge();
        _deployCustody();
        _wireContracts();
        _registerIssuers();
        _fundContracts();
        _fundUser();

        vm.stopBroadcast();

        _exportDeployment();
        _logComplete();
    }

    function _setupAccounts() internal {
        uint256 DEFAULT_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        admin = vm.addr(DEFAULT_KEY);
        issuer1 = vm.addr(0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d);
        issuer2 = vm.addr(0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a);
        issuer3 = vm.addr(0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6);
        ap = vm.addr(0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a);
        // Anvil account 5 for user
        user = vm.addr(0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba);
    }

    function _getDeployerKey() internal view returns (uint256) {
        uint256 DEFAULT_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        if (block.chainid == CHAIN_ID || block.chainid == ARB_CHAIN_ID) {
            return vm.envOr("PRIVATE_KEY", DEFAULT_KEY);
        }
        uint256 key = vm.envUint("PRIVATE_KEY");
        require(key != DEFAULT_KEY, "Cannot use default Anvil key on non-local chain");
        return key;
    }

    function _logHeader() internal view {
        console.log("===========================================");
        console.log("FULL SYSTEM E2E DEPLOYMENT (Story 6.18)");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", admin);
        console.log("AP:", ap);
        console.log("User:", user);
        console.log("");
    }

    function _deployTokens() internal {
        console.log("Phase 1: Deploy Tokens");
        // Story 7-6b: L3 USDC uses 18 decimals (internal protocol standard)
        l3Wusdc = address(new MockERC20("L3 Wrapped USDC", "L3_WUSDC", 18));
        // Story 7-6b: Arb USDC uses 6 decimals (real USDC on Arbitrum/mainnet)
        arbWusdc = address(new MockERC20("Arbitrum USDC", "ARB_USDC", 6));
        // MockUSDT for USDT-pair settlement (18 decimals on L3, same as L3_WUSDC)
        mockUsdt = address(new MockERC20("Mock USDT", "MOCK_USDT", 18));
        console.log("  L3_WUSDC (18 dec):", l3Wusdc);
        console.log("  ARB_USDC (6 dec):", arbWusdc);
        console.log("  MOCK_USDT (18 dec):", mockUsdt);
    }

    function _deployCore() internal {
        console.log("Phase 2: Deploy Core");
        Governance govImpl = new Governance();
        governance = address(new ERC1967Proxy(address(govImpl), abi.encodeWithSelector(Governance.initialize.selector, admin)));

        address indexImpl = address(new Investment());
        bytes memory initData = abi.encodeWithSelector(Investment.initialize.selector, governance, l3Wusdc);
        indexProxy = address(new ERC1967Proxy(indexImpl, initData));
        console.log("  Governance:", governance);
        console.log("  Index:", indexProxy);
    }

    function _deployRegistries() internal {
        console.log("Phase 3: Deploy Registries");
        IssuerRegistry regImpl = new IssuerRegistry();
        issuerRegistry = address(new ERC1967Proxy(address(regImpl), abi.encodeWithSelector(IssuerRegistry.initialize.selector, governance)));
        collateralRegistry = address(new CollateralRegistry(admin, issuerRegistry));
        console.log("  IssuerRegistry:", issuerRegistry);
        console.log("  CollateralRegistry:", collateralRegistry);
    }

    function _deployCustody() internal {
        console.log("Phase 4: Deploy Custody");

        // L3BridgeCustody
        address l3Impl = address(new L3BridgeCustody());
        bytes memory l3Init = abi.encodeWithSelector(L3BridgeCustody.initialize.selector, issuerRegistry, l3Wusdc);
        l3BridgeCustodyProxy = address(new ERC1967Proxy(l3Impl, l3Init));

        // ArbBridgeCustody (with indexContract for cross-chain buy)
        // bridgeProxyAddr set during initialize to avoid BLS-gated setBridgeProxy call
        address arbImpl = address(new ArbBridgeCustody());
        bytes memory arbInit = abi.encodeWithSelector(ArbBridgeCustody.initialize.selector, issuerRegistry, arbWusdc, indexProxy, bridgeProxyAddr);
        arbBridgeCustodyProxy = address(new ERC1967Proxy(arbImpl, arbInit));

        // BLSCustody
        address blsImpl = address(new BLSCustody());
        bytes memory blsInit = abi.encodeWithSelector(BLSCustody.initialize.selector, issuerRegistry);
        blsCustodyProxy = address(new ERC1967Proxy(blsImpl, blsInit));

        console.log("  L3BridgeCustody:", l3BridgeCustodyProxy);
        console.log("  ArbBridgeCustody:", arbBridgeCustodyProxy);
        console.log("  BLSCustody:", blsCustodyProxy);
    }

    function _deployExchange() internal {
        console.log("Phase 5: Deploy Exchange");
        MockBitgetVault vault = new MockBitgetVault();
        vault.initialize(admin);
        mockBitgetVault = address(vault);
        console.log("  MockBitgetVault:", mockBitgetVault);
    }

    function _deployBridge() internal {
        console.log("Phase 5b: Deploy Bridge Contracts");

        // 1. Deploy BridgeProxy implementation
        BridgeProxy bridgeImpl = new BridgeProxy();

        // 2. Deploy ERC1967Proxy wrapping BridgeProxy (factory set to address(0) initially)
        bytes memory bridgeInit = abi.encodeWithSelector(
            BridgeProxy.initialize.selector,
            issuerRegistry,
            address(0), // factory not yet deployed
            admin
        );
        bridgeProxyAddr = address(new ERC1967Proxy(address(bridgeImpl), bridgeInit));

        // 3. Deploy BridgedItpFactory with the proxy address
        bridgedItpFactory = address(new BridgedItpFactory(bridgeProxyAddr));

        // 4. Wire factory into proxy
        BridgeProxy(bridgeProxyAddr).setBridgedItpFactory(bridgedItpFactory);

        // 5. Set Index contract on BridgeProxy (needed for atomic ITP creation)
        BridgeProxy(bridgeProxyAddr).setIndexContract(indexProxy);

        console.log("  BridgeProxy:", bridgeProxyAddr);
        console.log("  BridgedItpFactory:", bridgedItpFactory);
        console.log("  Index wired to BridgeProxy");
    }

    function _wireContracts() internal {
        console.log("Phase 6: Wire Contracts");
        Investment(indexProxy).setIssuerRegistry(issuerRegistry);
        console.log("  Index wired to IssuerRegistry");
        Investment(indexProxy).setAuthorizedBridge(bridgeProxyAddr);
        console.log("  Index authorized bridge set to BridgeProxy");
        // BridgeProxy set on ArbBridgeCustody during initialize() (avoids BLS-gated setBridgeProxy)
        console.log("  ArbBridgeCustody wired to BridgeProxy (via initialize)");
        // Vault approves ArbBridgeCustody for USDC spending (for fundSellOrder pull)
        MockBitgetVault(mockBitgetVault).approveSpender(arbWusdc, arbBridgeCustodyProxy, type(uint256).max);
        console.log("  MockBitgetVault: approved ArbBridgeCustody for ARB_USDC spending");
    }

    function _registerIssuers() internal {
        console.log("Phase 7: Register 3 Issuers");

        // Must snapshot (setAggregatedPubkey) after EACH addIssuer due to PendingSnapshot constraint
        _registerIssuer(0, issuer1, "127.0.0.1:9001");
        IssuerRegistry(issuerRegistry).setAggregatedPubkey(blsPubkey(0), 1);

        _registerIssuer(1, issuer2, "127.0.0.1:9002");
        IssuerRegistry(issuerRegistry).setAggregatedPubkey(blsAggPubkey("0,1"), 2);

        _registerIssuer(2, issuer3, "127.0.0.1:9003");
        IssuerRegistry(issuerRegistry).setAggregatedPubkey(blsAggPubkey("0,1,2"), 3);

        console.log("  Aggregated pubkey set on IssuerRegistry (snapshot after each addIssuer)");
    }

    function _fundContracts() internal {
        console.log("Phase 9: Fund Contracts");

        // Mint L3 tokens (18 decimals) to admin for distribution
        // +VAULT_INITIAL_BALANCE_18DEC for MockBitgetVault (AP settlement uses L3_WUSDC, not ARB_USDC)
        MockERC20(l3Wusdc).mint(admin, CUSTODY_INITIAL_BALANCE_18DEC * 2 + VAULT_INITIAL_BALANCE_18DEC * 2);

        // Mint Arb USDC (6 decimals) to admin for distribution
        // Story 7-6b: Use 6-decimal amounts for real USDC
        // +VAULT_INITIAL_BALANCE_6DEC for MockBitgetVault (AP quote token for on-chain settlement)
        MockERC20(arbWusdc).mint(admin, VAULT_INITIAL_BALANCE_6DEC * 2 + CUSTODY_INITIAL_BALANCE_6DEC * 2);

        // Mint MockUSDT (18 decimals) to admin for vault funding (USDT-pair swapStable)
        MockERC20(mockUsdt).mint(admin, VAULT_INITIAL_BALANCE_18DEC);

        // Fund L3BridgeCustody with L3_WUSDC (18 decimals, for bridge L3→Arb in Phase 2)
        MockERC20(l3Wusdc).transfer(l3BridgeCustodyProxy, CUSTODY_INITIAL_BALANCE_18DEC);
        console.log("  L3BridgeCustody funded with L3_WUSDC (18 dec)");

        // Fund ArbBridgeCustody with ARB_USDC (6 decimals, for cross-chain buy in Phase 4)
        // Story 7-6b: Use 6-decimal amounts for Arbitrum USDC
        MockERC20(arbWusdc).transfer(arbBridgeCustodyProxy, CUSTODY_INITIAL_BALANCE_6DEC);
        console.log("  ArbBridgeCustody funded with ARB_USDC (6 dec)");

        // Fund MockBitgetVault with L3_WUSDC (18 decimals — AP settlement uses L3_WUSDC)
        _fundVault(l3Wusdc);
        console.log("  MockBitgetVault funded with L3_WUSDC (18 dec)");

        // Fund MockBitgetVault with ARB_USDC (6 decimals — AP quote token for on-chain settlement)
        _fundVaultArb(arbWusdc, VAULT_INITIAL_BALANCE_6DEC);
        console.log("  MockBitgetVault funded with ARB_USDC (6 dec)");

        // Fund MockBitgetVault with MockUSDT (18 decimals — for USDT-pair swapStable)
        _fundVault(mockUsdt);
        console.log("  MockBitgetVault funded with MOCK_USDT (18 dec)");
    }

    function _fundUser() internal {
        console.log("Phase 10: Fund Users");

        // Fund Anvil user (Account 5)
        MockERC20(l3Wusdc).mint(user, USER_INITIAL_BALANCE_18DEC);
        MockERC20(arbWusdc).mint(user, USER_INITIAL_BALANCE_6DEC);
        console.log("  Anvil user funded (L3_WUSDC 18dec + ARB_USDC 6dec)");

        // Fund test user (MetaMask wallet)
        MockERC20(l3Wusdc).mint(TEST_USER, USER_INITIAL_BALANCE_18DEC);
        MockERC20(arbWusdc).mint(TEST_USER, USER_INITIAL_BALANCE_6DEC);
        console.log("  Test user 0xC0D3..3850 funded (L3_WUSDC 18dec + ARB_USDC 6dec)");
    }

    function _fundVault(address token) internal {
        MockERC20(token).approve(mockBitgetVault, VAULT_INITIAL_BALANCE);
        MockBitgetVault(mockBitgetVault).fundVault(token, VAULT_INITIAL_BALANCE);
    }

    /// @notice Fund vault with a specific amount (for tokens with non-18 decimals)
    /// @dev Story 7-6b: Use this for Arb USDC (6 decimals)
    function _fundVaultArb(address token, uint256 amount) internal {
        MockERC20(token).approve(mockBitgetVault, amount);
        MockBitgetVault(mockBitgetVault).fundVault(token, amount);
    }

    function _registerIssuer(uint256 idx, address issuer, string memory ipPort) internal {
        bytes memory ipBytes = bytes(ipPort);
        bytes32 ipBytes32;
        assembly { ipBytes32 := mload(add(ipBytes, 32)) }

        // Real BLS G2 pubkey from deterministic seed via FFI
        bytes memory pubkey = blsPubkey(uint8(idx));

        // Generate Proof of Possession signature
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, issuerRegistry, issuer, pubkey));
        bytes memory popSig = blsSign(vm.toString(idx), popMsg);

        // Deployer (admin) is the broadcast sender, so no vm.prank needed
        IssuerRegistry(issuerRegistry).addIssuer(issuer, ipBytes32, pubkey, popSig);
        console.log("  Registered issuer", idx + 1, ":", issuer);
    }

    function _exportDeployment() internal {
        console.log("Phase 11: Export Deployment");
        string memory json = string.concat(
            '{\n  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "deployer": "', vm.toString(admin), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "contracts": {\n',
            _buildContractsJson(),
            '  },\n',
            _buildAccountsJson(),
            '}'
        );
        vm.writeFile("../deployments/e2e-full-system.json", json);
        console.log("  Saved to deployments/e2e-full-system.json");
    }

    function _buildContractsJson() internal view returns (string memory) {
        string memory p1 = string.concat(
            '    "Index": "', vm.toString(indexProxy), '",\n',
            '    "Governance": "', vm.toString(governance), '",\n',
            '    "IssuerRegistry": "', vm.toString(issuerRegistry), '",\n',
            '    "CollateralRegistry": "', vm.toString(collateralRegistry), '",\n'
        );
        string memory p2 = string.concat(
            '    "L3BridgeCustody": "', vm.toString(l3BridgeCustodyProxy), '",\n',
            '    "ArbBridgeCustody": "', vm.toString(arbBridgeCustodyProxy), '",\n',
            '    "BLSCustody": "', vm.toString(blsCustodyProxy), '",\n',
            '    "MockBitgetVault": "', vm.toString(mockBitgetVault), '",\n',
            '    "BridgeProxy": "', vm.toString(bridgeProxyAddr), '",\n',
            '    "BridgedItpFactory": "', vm.toString(bridgedItpFactory), '",\n'
        );
        string memory p3 = string.concat(
            '    "L3_WUSDC": "', vm.toString(l3Wusdc), '",\n',
            '    "L3_WUSDC_DECIMALS": "18",\n',
            '    "ARB_USDC": "', vm.toString(arbWusdc), '",\n',
            '    "ARB_USDC_DECIMALS": "6",\n',
            '    "MOCK_USDT": "', vm.toString(mockUsdt), '",\n',
            '    "USDC": "', vm.toString(l3Wusdc), '"\n'
        );
        return string.concat(p1, p2, p3);
    }

    function _buildAccountsJson() internal view returns (string memory) {
        return string.concat(
            '  "accounts": {\n',
            '    "admin": "', vm.toString(admin), '",\n',
            '    "issuer1": "', vm.toString(issuer1), '",\n',
            '    "issuer2": "', vm.toString(issuer2), '",\n',
            '    "issuer3": "', vm.toString(issuer3), '",\n',
            '    "ap": "', vm.toString(ap), '",\n',
            '    "user": "', vm.toString(user), '",\n',
            '    "testUser": "', vm.toString(TEST_USER), '"\n',
            '  }\n'
        );
    }

    function _logComplete() internal view {
        console.log("");
        console.log("===========================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("===========================================");
        console.log("User:", user);
        console.log("");
        console.log("DECIMAL CONFIGURATION (Story 7-6b):");
        console.log("  L3_WUSDC: 18 decimals (internal protocol)");
        console.log("  ARB_USDC: 6 decimals (real USDC)");
        console.log("");
        console.log("Next steps (in E2E script):");
        console.log("  1. User approves Index for L3_WUSDC spending");
        console.log("  2. User approves ArbBridgeCustody for ARB_USDC spending");
        console.log("  3. AP approves MockBitgetVault for token spending");
        console.log("===========================================");
    }
}
