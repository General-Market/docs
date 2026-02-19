// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/mocks/MockERC20.sol";
import "../src/Governance.sol";
import "../src/registry/IssuerRegistry.sol";
import "../src/mocks/MockBitgetVault.sol";
import "../src/core/Index.sol";
import "../src/core/ITP.sol";
import "../src/core/BLSCustody.sol";
import "../src/registry/CollateralRegistry.sol";
import "../src/custody/L3BridgeCustody.sol";
import "../src/custody/ArbBridgeCustody.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployRebalanceE2E - Full E2E deployment for rebalance testing
/// @notice Deploys all contracts needed for Story 6.17 E2E rebalance tests
/// @dev Includes: Core, Registries, Custody, Tokens, Exchange (MockBitgetVault)
///
/// ## Decimal Handling (Story 7-6b)
/// - L3_WUSDC: 18 decimals (internal protocol standard)
/// - ARB_USDC: 6 decimals (real USDC on Arbitrum)
contract DeployRebalanceE2E is Script {
    // ============ CONSTANTS ============

    uint256 public constant CHAIN_ID = 111222333;
    uint256 public constant ARB_CHAIN_ID = 421611337;

    // L3 amounts use 18 decimals (internal protocol standard)
    uint256 public constant VAULT_INITIAL_BALANCE = 1_000_000 * 1e18;
    uint256 public constant CUSTODY_INITIAL_BALANCE = 100_000 * 1e18;
    uint256 public constant AP_INITIAL_BALANCE = 500_000 * 1e18;

    // Arb amounts use 6 decimals (real USDC) - Story 7-6b
    uint256 public constant ARB_CUSTODY_INITIAL_BALANCE = 100_000 * 1e6;
    uint256 public constant ARB_VAULT_INITIAL_BALANCE = 1_000_000 * 1e6;

    uint256 public constant WEIGHT_BTC = 5e17; // 50%
    uint256 public constant WEIGHT_ETH = 5e17; // 50%

    // ============ DEPLOYED ADDRESSES ============

    address public l3Wusdc;
    address public arbWusdc;
    address public btc;
    address public eth;
    address public governance;
    address public indexProxy;
    address public issuerRegistry;
    address public collateralRegistry;
    address public l3BridgeCustodyProxy;
    address public arbBridgeCustodyProxy;
    address public blsCustodyProxy;
    address public mockBitgetVault;
    address public itpVault;
    bytes32 public itpId;

    // Anvil accounts
    address public admin;
    address public issuer1;
    address public issuer2;
    address public issuer3;
    address public ap;

    function run() external {
        _setupAccounts();
        _logHeader();

        uint256 deployerPrivateKey = _getDeployerKey();
        vm.startBroadcast(deployerPrivateKey);

        _deployTokens();
        _deployCore();
        _deployRegistries();
        _deployCustody();
        _deployExchange();
        _wireContracts();
        _registerIssuers();
        _createITP();
        _fundContracts();

        vm.stopBroadcast();

        _exportDeployment();
        _exportSymbolMap();
        _logComplete();
    }

    function _setupAccounts() internal {
        uint256 DEFAULT_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        admin = vm.addr(DEFAULT_KEY);
        issuer1 = vm.addr(0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d);
        issuer2 = vm.addr(0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a);
        issuer3 = vm.addr(0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6);
        ap = vm.addr(0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a);
    }

    function _getDeployerKey() internal view returns (uint256) {
        uint256 DEFAULT_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        if (block.chainid == CHAIN_ID) {
            return vm.envOr("PRIVATE_KEY", DEFAULT_KEY);
        }
        uint256 key = vm.envUint("PRIVATE_KEY");
        require(key != DEFAULT_KEY, "Cannot use default Anvil key on non-local chain");
        return key;
    }

    function _logHeader() internal view {
        console.log("===========================================");
        console.log("REBALANCE E2E FULL DEPLOYMENT");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", admin);
        console.log("AP:", ap);
        console.log("");
    }

    function _deployTokens() internal {
        console.log("Phase 1: Deploy Tokens");
        // Story 7-6b: L3 USDC uses 18 decimals (internal protocol standard)
        l3Wusdc = address(new MockERC20("L3 Wrapped USDC", "L3_WUSDC", 18));
        // Story 7-6b: Arb USDC uses 6 decimals (real USDC on Arbitrum/mainnet)
        arbWusdc = address(new MockERC20("Arbitrum USDC", "ARB_USDC", 6));
        btc = address(new MockERC20("Mock BTC", "BTC", 18));
        eth = address(new MockERC20("Mock ETH", "ETH", 18));
        console.log("  L3_WUSDC (18 dec):", l3Wusdc);
        console.log("  ARB_USDC (6 dec):", arbWusdc);
        console.log("  BTC:", btc);
    }

    function _deployCore() internal {
        console.log("Phase 2: Deploy Core");
        Governance govImpl = new Governance();
        governance = address(new ERC1967Proxy(address(govImpl), abi.encodeWithSelector(Governance.initialize.selector, admin)));

        address indexImpl = address(new Index());
        bytes memory initData = abi.encodeWithSelector(Index.initialize.selector, governance, l3Wusdc);
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
    }

    function _deployCustody() internal {
        console.log("Phase 4: Deploy Custody");

        // L3BridgeCustody
        address l3Impl = address(new L3BridgeCustody());
        bytes memory l3Init = abi.encodeWithSelector(L3BridgeCustody.initialize.selector, issuerRegistry, l3Wusdc);
        l3BridgeCustodyProxy = address(new ERC1967Proxy(l3Impl, l3Init));

        // ArbBridgeCustody
        address arbImpl = address(new ArbBridgeCustody());
        bytes memory arbInit = abi.encodeWithSelector(ArbBridgeCustody.initialize.selector, issuerRegistry, arbWusdc, indexProxy, address(0));
        arbBridgeCustodyProxy = address(new ERC1967Proxy(arbImpl, arbInit));

        // BLSCustody
        address blsImpl = address(new BLSCustody());
        bytes memory blsInit = abi.encodeWithSelector(BLSCustody.initialize.selector, issuerRegistry);
        blsCustodyProxy = address(new ERC1967Proxy(blsImpl, blsInit));

        console.log("  L3BridgeCustody:", l3BridgeCustodyProxy);
    }

    function _deployExchange() internal {
        console.log("Phase 5: Deploy Exchange");
        MockBitgetVault vault = new MockBitgetVault();
        vault.initialize(admin);
        mockBitgetVault = address(vault);
        console.log("  MockBitgetVault:", mockBitgetVault);
    }

    function _wireContracts() internal {
        console.log("Phase 6: Wire Contracts");
        Index(indexProxy).setIssuerRegistry(issuerRegistry);
    }

    function _registerIssuers() internal {
        console.log("Phase 7: Register 3 Issuers");
        _registerIssuer(0, issuer1, "127.0.0.1:9000");
        _registerIssuer(1, issuer2, "127.0.0.1:9001");
        _registerIssuer(2, issuer3, "127.0.0.1:9002");
        // Aggregated pubkey: empty by default (computed off-chain)
    }

    function _createITP() internal {
        console.log("Phase 8: Skip ITP creation (done in E2E script via cast)");
        // ITP creation via Forge Script has timing issues with block.timestamp
        // being used in itpId generation. The E2E shell script will create
        // the ITP using cast send commands which properly wait for tx confirmation.
        // This keeps itpId and itpVault as zero - they'll be set by E2E script.
    }

    function _fundContracts() internal {
        console.log("Phase 9: Fund Contracts");

        // Mint L3 tokens (18 decimals) to admin
        MockERC20(l3Wusdc).mint(admin, CUSTODY_INITIAL_BALANCE + VAULT_INITIAL_BALANCE);
        // Mint Arb USDC (6 decimals) to admin - Story 7-6b
        MockERC20(arbWusdc).mint(admin, ARB_VAULT_INITIAL_BALANCE + ARB_CUSTODY_INITIAL_BALANCE);
        // Mint trading tokens (18 decimals)
        MockERC20(btc).mint(admin, VAULT_INITIAL_BALANCE + AP_INITIAL_BALANCE);
        MockERC20(eth).mint(admin, VAULT_INITIAL_BALANCE + AP_INITIAL_BALANCE);

        // Fund L3 custody (18 decimals)
        MockERC20(l3Wusdc).transfer(l3BridgeCustodyProxy, CUSTODY_INITIAL_BALANCE);
        console.log("  L3BridgeCustody funded with L3_WUSDC (18 dec)");
        // Fund Arb custody (6 decimals) - Story 7-6b
        MockERC20(arbWusdc).transfer(arbBridgeCustodyProxy, ARB_CUSTODY_INITIAL_BALANCE);
        console.log("  ArbBridgeCustody funded with ARB_USDC (6 dec)");

        // Fund vault with trading tokens (18 decimals)
        _fundVault(btc);
        _fundVault(eth);
        // Fund vault with Arb USDC (6 decimals) - Story 7-6b
        _fundVaultArb(arbWusdc, ARB_VAULT_INITIAL_BALANCE);
        console.log("  MockBitgetVault funded");

        // Fund AP
        MockERC20(btc).mint(ap, AP_INITIAL_BALANCE);
        MockERC20(eth).mint(ap, AP_INITIAL_BALANCE);
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

        // Real IssuerRegistry requires 128-byte G2 BLS pubkeys
        bytes memory blsPubkey = new bytes(128);
        for (uint256 i = 0; i < 128; i++) {
            blsPubkey[i] = bytes1(uint8(idx + 1 + i));
        }

        // Deployer (admin) is the broadcast sender, so no vm.prank needed
        IssuerRegistry(issuerRegistry).addIssuer(issuer, ipBytes32, blsPubkey);
    }

    function _exportDeployment() internal {
        console.log("Phase 10: Export Deployment");
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
        vm.writeFile("../deployments/e2e-rebalance.json", json);
        console.log("  Saved to deployments/e2e-rebalance.json");
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
            '    "MockBitgetVault": "', vm.toString(mockBitgetVault), '",\n'
        );
        string memory p3 = string.concat(
            '    "L3_WUSDC": "', vm.toString(l3Wusdc), '",\n',
            '    "L3_WUSDC_DECIMALS": "18",\n',
            '    "ARB_USDC": "', vm.toString(arbWusdc), '",\n',
            '    "ARB_USDC_DECIMALS": "6",\n',
            '    "BTC": "', vm.toString(btc), '",\n',
            '    "ETH": "', vm.toString(eth), '",\n',
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
            '    "ap": "', vm.toString(ap), '"\n',
            '  }\n'
        );
    }

    function _exportSymbolMap() internal {
        string memory map = string.concat(
            '{\n',
            '  "', vm.toLowercase(vm.toString(btc)), '": {"pair": "BTCUSDC", "source": "bitget"},\n',
            '  "', vm.toLowercase(vm.toString(eth)), '": {"pair": "ETHUSDC", "source": "bitget"}\n',
            '}'
        );
        vm.writeFile("../data/symbol-map.json", map);
        console.log("  Saved data/symbol-map.json");
    }

    function _logComplete() internal pure {
        console.log("");
        console.log("===========================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("===========================================");
    }
}
