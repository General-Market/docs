// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/mocks/MockERC20.sol";
import "../src/Governance.sol";
import "../src/registry/OracleRegistry.sol";
import "../src/mocks/MockBitgetVault.sol";
import "../src/core/Investment.sol";
import "../src/core/BLSCustody.sol";
import "../src/registry/CollateralRegistry.sol";
import "../src/custody/L3BridgeCustody.sol";
import "../src/custody/SettlementBridgeCustody.sol";
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
/// - SETTLEMENT_WUSDC: 6 decimals (real USDC on Settlement)
/// - Protocol converts at boundaries: 6→18 on entry, 18→6 on exit
contract DeployFullSystemE2E is DeployBLSHelper {
    // ============ CONSTANTS ============

    uint256 public constant CHAIN_ID = 111222333;
    uint256 public constant SETTLEMENT_CHAIN_ID = 421611337;

    // L3 amounts use 18 decimals (internal protocol standard)
    uint256 public constant VAULT_INITIAL_BALANCE_18DEC = 1_000_000 * 1e18;
    uint256 public constant CUSTODY_INITIAL_BALANCE_18DEC = 100_000 * 1e18;
    uint256 public constant AP_INITIAL_BALANCE_18DEC = 500_000 * 1e18;
    uint256 public constant USER_INITIAL_BALANCE_18DEC = 50_000 * 1e18;

    // Settlement amounts use 6 decimals (real USDC)
    uint256 public constant VAULT_INITIAL_BALANCE_6DEC = 1_000_000 * 1e6;
    uint256 public constant CUSTODY_INITIAL_BALANCE_6DEC = 100_000 * 1e6;
    uint256 public constant USER_INITIAL_BALANCE_6DEC = 50_000 * 1e6;

    // Legacy aliases for non-USDC tokens (always 18 decimals)
    uint256 public constant VAULT_INITIAL_BALANCE = VAULT_INITIAL_BALANCE_18DEC;
    uint256 public constant CUSTODY_INITIAL_BALANCE = CUSTODY_INITIAL_BALANCE_18DEC;
    uint256 public constant AP_INITIAL_BALANCE = AP_INITIAL_BALANCE_18DEC;
    uint256 public constant USER_INITIAL_BALANCE = USER_INITIAL_BALANCE_18DEC;

    // ============ DEPLOY SALT ============
    // Uses block.timestamp so each redeploy on the same chain gets unique proxy addresses.
    // Prevents stale storage from previous deploys bleeding through ERC1967 proxy reuse.
    uint256 private _saltCounter;

    function _nextSalt() internal returns (bytes32) {
        // MUST NOT use block.timestamp — it differs between simulation and broadcast on Orbit L3,
        // causing CREATE2 addresses to diverge. Use only deterministic values.
        return keccak256(abi.encode("INDEX_DEPLOY_V2", block.chainid, ++_saltCounter));
    }

    function _deployProxy(address impl, bytes memory initData) internal returns (address) {
        bytes32 salt = _nextSalt();
        return address(new ERC1967Proxy{salt: salt}(impl, initData));
    }

    // ============ DEPLOYED ADDRESSES ============

    address public l3Wusdc;
    address public settlementUsdc;
    address public mockUsdt;
    address public governance;
    address public indexProxy;
    address public oracleRegistry;
    address public collateralRegistry;
    address public l3BridgeCustodyProxy;
    address public settlementBridgeCustodyProxy;
    address public blsCustodyProxy;
    address public mockBitgetVault;
    address public bridgeProxyAddr;
    address public bridgedItpFactory;

    // Anvil accounts
    address public admin;
    address public oracle1;
    address public oracle2;
    address public oracle3;
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
        _registerOracles();
        _fundContracts();
        _fundUser();

        vm.stopBroadcast();

        _exportDeployment();
        _logComplete();
    }

    function _setupAccounts() internal {
        uint256 deployerKey = _getDeployerKey();
        admin = vm.addr(deployerKey);
        oracle1 = vm.addr(0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d);
        oracle2 = vm.addr(0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a);
        oracle3 = vm.addr(0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6);
        ap = vm.addr(0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a);
        // Anvil account 5 for user
        user = vm.addr(0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba);
    }

    function _getDeployerKey() internal view returns (uint256) {
        uint256 DEFAULT_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        if (block.chainid == CHAIN_ID || block.chainid == SETTLEMENT_CHAIN_ID) {
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
        // Story 7-6b: Settlement USDC uses 6 decimals (real USDC on Settlement/mainnet)
        settlementUsdc = address(new MockERC20("Settlement USDC", "SETTLEMENT_USDC", 6));
        // MockUSDT for USDT-pair settlement (18 decimals on L3, same as L3_WUSDC)
        mockUsdt = address(new MockERC20("Mock USDT", "MOCK_USDT", 18));
        console.log("  L3_WUSDC (18 dec):", l3Wusdc);
        console.log("  SETTLEMENT_USDC (6 dec):", settlementUsdc);
        console.log("  MOCK_USDT (18 dec):", mockUsdt);
    }

    function _deployCore() internal {
        console.log("Phase 2: Deploy Core");
        Governance govImpl = new Governance();
        governance = _deployProxy(address(govImpl), abi.encodeWithSelector(Governance.initialize.selector, admin));

        address indexImpl = address(new Investment());
        bytes memory initData = abi.encodeWithSelector(Investment.initialize.selector, governance, l3Wusdc);
        indexProxy = _deployProxy(indexImpl, initData);

        console.log("  Governance:", governance);
        console.log("  Index:", indexProxy);
    }

    function _deployRegistries() internal {
        console.log("Phase 3: Deploy Registries");
        OracleRegistry regImpl = new OracleRegistry();
        oracleRegistry = _deployProxy(address(regImpl), abi.encodeWithSelector(OracleRegistry.initialize.selector, governance));
        collateralRegistry = address(new CollateralRegistry(admin, oracleRegistry));
        console.log("  OracleRegistry:", oracleRegistry);
        console.log("  CollateralRegistry:", collateralRegistry);
    }

    function _deployCustody() internal {
        console.log("Phase 4: Deploy Custody");

        // L3BridgeCustody
        address l3Impl = address(new L3BridgeCustody());
        bytes memory l3Init = abi.encodeWithSelector(L3BridgeCustody.initialize.selector, oracleRegistry, l3Wusdc);
        l3BridgeCustodyProxy = _deployProxy(l3Impl, l3Init);

        // SettlementBridgeCustody (with indexContract for cross-chain buy)
        // bridgeProxyAddr set during initialize to avoid BLS-gated setBridgeProxy call
        address settlementImpl = address(new SettlementBridgeCustody());
        bytes memory settlementInit = abi.encodeWithSelector(SettlementBridgeCustody.initialize.selector, oracleRegistry, settlementUsdc, indexProxy, bridgeProxyAddr);
        settlementBridgeCustodyProxy = _deployProxy(settlementImpl, settlementInit);

        // BLSCustody
        address blsImpl = address(new BLSCustody());
        bytes memory blsInit = abi.encodeWithSelector(BLSCustody.initialize.selector, oracleRegistry);
        blsCustodyProxy = _deployProxy(blsImpl, blsInit);

        console.log("  L3BridgeCustody:", l3BridgeCustodyProxy);
        console.log("  SettlementBridgeCustody:", settlementBridgeCustodyProxy);
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
            oracleRegistry,
            address(0), // factory not yet deployed
            admin
        );
        bridgeProxyAddr = _deployProxy(address(bridgeImpl), bridgeInit);

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
        Investment(indexProxy).setOracleRegistry(oracleRegistry);
        console.log("  Index wired to OracleRegistry");
        Investment(indexProxy).setAuthorizedBridge(bridgeProxyAddr);
        console.log("  Index authorized bridge set to BridgeProxy");
        // BridgeProxy set on SettlementBridgeCustody during initialize() (avoids BLS-gated setBridgeProxy)
        console.log("  SettlementBridgeCustody wired to BridgeProxy (via initialize)");
        // Vault approves SettlementBridgeCustody for USDC spending (for completeSellOrder vault→user pull)
        MockBitgetVault(mockBitgetVault).approveSpender(settlementUsdc, settlementBridgeCustodyProxy, type(uint256).max);
        console.log("  MockBitgetVault: approved SettlementBridgeCustody for SETTLEMENT_USDC spending");
        // Authorize all BLS-verifying contracts for incrementMissedCounts
        OracleRegistry(oracleRegistry).setAuthorizedMissedCountCaller(indexProxy, true);
        OracleRegistry(oracleRegistry).setAuthorizedMissedCountCaller(blsCustodyProxy, true);
        OracleRegistry(oracleRegistry).setAuthorizedMissedCountCaller(l3BridgeCustodyProxy, true);
        OracleRegistry(oracleRegistry).setAuthorizedMissedCountCaller(bridgeProxyAddr, true);
        OracleRegistry(oracleRegistry).setAuthorizedMissedCountCaller(settlementBridgeCustodyProxy, true);
        console.log("  OracleRegistry: authorized BLS-verifying contracts for incrementMissedCounts");
    }

    function _registerOracles() internal {
        console.log("Phase 7: Register 3 Oracles");

        // Must snapshot (setAggregatedPubkey) after EACH addOracle due to PendingSnapshot constraint
        _registerOracle(0, oracle1, "127.0.0.1:9001");
        OracleRegistry(oracleRegistry).setAggregatedPubkey(blsPubkey(0), 1);

        _registerOracle(1, oracle2, "127.0.0.1:9002");
        OracleRegistry(oracleRegistry).setAggregatedPubkey(blsAggPubkey("0,1"), 2);

        _registerOracle(2, oracle3, "127.0.0.1:9003");
        OracleRegistry(oracleRegistry).setAggregatedPubkey(blsAggPubkey("0,1,2"), 3);

        console.log("  Aggregated pubkey set on OracleRegistry (snapshot after each addOracle)");
    }

    function _fundContracts() internal {
        console.log("Phase 9: Fund Contracts");

        // Mint L3 tokens (18 decimals) to admin for distribution
        // +VAULT_INITIAL_BALANCE_18DEC for MockBitgetVault (AP settlement uses L3_WUSDC, not SETTLEMENT_USDC)
        MockERC20(l3Wusdc).mint(admin, CUSTODY_INITIAL_BALANCE_18DEC * 2 + VAULT_INITIAL_BALANCE_18DEC * 2);

        // Mint Settlement USDC (6 decimals) to admin for distribution
        // Story 7-6b: Use 6-decimal amounts for real USDC
        // +VAULT_INITIAL_BALANCE_6DEC for MockBitgetVault (AP quote token for on-chain settlement)
        MockERC20(settlementUsdc).mint(admin, VAULT_INITIAL_BALANCE_6DEC * 2 + CUSTODY_INITIAL_BALANCE_6DEC * 2);

        // Mint MockUSDT (18 decimals) to admin for vault funding (USDT-pair swapStable)
        MockERC20(mockUsdt).mint(admin, VAULT_INITIAL_BALANCE_18DEC);

        // Fund L3BridgeCustody with L3_WUSDC (18 decimals, for bridge L3→Settlement in Phase 2)
        MockERC20(l3Wusdc).transfer(l3BridgeCustodyProxy, CUSTODY_INITIAL_BALANCE_18DEC);
        console.log("  L3BridgeCustody funded with L3_WUSDC (18 dec)");

        // Fund SettlementBridgeCustody with SETTLEMENT_USDC (6 decimals, for cross-chain buy in Phase 4)
        // Story 7-6b: Use 6-decimal amounts for Settlement USDC
        MockERC20(settlementUsdc).transfer(settlementBridgeCustodyProxy, CUSTODY_INITIAL_BALANCE_6DEC);
        console.log("  SettlementBridgeCustody funded with SETTLEMENT_USDC (6 dec)");

        // Fund MockBitgetVault with L3_WUSDC (18 decimals — AP settlement uses L3_WUSDC)
        _fundVault(l3Wusdc);
        console.log("  MockBitgetVault funded with L3_WUSDC (18 dec)");

        // Fund MockBitgetVault with SETTLEMENT_USDC (6 decimals — AP quote token for on-chain settlement)
        _fundVaultSettlement(settlementUsdc, VAULT_INITIAL_BALANCE_6DEC);
        console.log("  MockBitgetVault funded with SETTLEMENT_USDC (6 dec)");

        // Fund MockBitgetVault with MockUSDT (18 decimals — for USDT-pair swapStable)
        _fundVault(mockUsdt);
        console.log("  MockBitgetVault funded with MOCK_USDT (18 dec)");
    }

    function _fundUser() internal {
        console.log("Phase 10: Fund Users");

        // Fund Anvil user (Account 5)
        MockERC20(l3Wusdc).mint(user, USER_INITIAL_BALANCE_18DEC);
        MockERC20(settlementUsdc).mint(user, USER_INITIAL_BALANCE_6DEC);
        console.log("  Anvil user funded (L3_WUSDC 18dec + SETTLEMENT_USDC 6dec)");

        // Fund test user (MetaMask wallet)
        MockERC20(l3Wusdc).mint(TEST_USER, USER_INITIAL_BALANCE_18DEC);
        MockERC20(settlementUsdc).mint(TEST_USER, USER_INITIAL_BALANCE_6DEC);
        console.log("  Test user 0xC0D3..3850 funded (L3_WUSDC 18dec + SETTLEMENT_USDC 6dec)");

        // Fund oracle and AP accounts with gas (GM/ETH)
        // Uses call instead of transfer (2300 gas stipend too low on some chains like Sonic)
        uint256 gasFunding = 10 ether;
        uint256 totalNeeded = gasFunding * 5;
        if (address(admin).balance > totalNeeded + 1 ether) {
            address[5] memory recipients = [oracle1, oracle2, oracle3, ap, user];
            for (uint256 r = 0; r < recipients.length; r++) {
                (bool ok,) = payable(recipients[r]).call{value: gasFunding}("");
                require(ok, "gas funding transfer failed");
            }
            console.log("  Oracles + AP + user funded with 10 ETH each for gas");
        } else {
            console.log("  Skipping gas funding (deployer balance too low)");
        }
    }

    function _fundVault(address token) internal {
        MockERC20(token).approve(mockBitgetVault, VAULT_INITIAL_BALANCE);
        MockBitgetVault(mockBitgetVault).fundVault(token, VAULT_INITIAL_BALANCE);
    }

    /// @notice Fund vault with a specific amount (for tokens with non-18 decimals)
    /// @dev Story 7-6b: Use this for Settlement USDC (6 decimals)
    function _fundVaultSettlement(address token, uint256 amount) internal {
        MockERC20(token).approve(mockBitgetVault, amount);
        MockBitgetVault(mockBitgetVault).fundVault(token, amount);
    }

    function _registerOracle(uint256 idx, address oracle, string memory ipPort) internal {
        bytes memory ipBytes = bytes(ipPort);
        bytes32 ipBytes32;
        assembly { ipBytes32 := mload(add(ipBytes, 32)) }

        // Real BLS G2 pubkey from deterministic seed via FFI
        bytes memory pubkey = blsPubkey(uint8(idx));

        // Generate Proof of Possession signature
        bytes32 popMsg = keccak256(abi.encode("INDEX_BLS_POP", block.chainid, oracleRegistry, oracle, pubkey));
        bytes memory popSig = blsSign(vm.toString(idx), popMsg);

        // Deployer (admin) is the broadcast sender, so no vm.prank needed
        OracleRegistry(oracleRegistry).addOracle(oracle, ipBytes32, pubkey, popSig);
        console.log("  Registered oracle", idx + 1, ":", oracle);
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
            '    "OracleRegistry": "', vm.toString(oracleRegistry), '",\n',
            '    "CollateralRegistry": "', vm.toString(collateralRegistry), '",\n'
        );
        string memory p2 = string.concat(
            '    "L3BridgeCustody": "', vm.toString(l3BridgeCustodyProxy), '",\n',
            '    "SettlementBridgeCustody": "', vm.toString(settlementBridgeCustodyProxy), '",\n',
            '    "BLSCustody": "', vm.toString(blsCustodyProxy), '",\n',
            '    "MockBitgetVault": "', vm.toString(mockBitgetVault), '",\n',
            '    "BridgeProxy": "', vm.toString(bridgeProxyAddr), '",\n',
            '    "BridgedItpFactory": "', vm.toString(bridgedItpFactory), '",\n'
        );
        string memory p3 = string.concat(
            '    "L3_WUSDC": "', vm.toString(l3Wusdc), '",\n',
            '    "L3_WUSDC_DECIMALS": "18",\n',
            '    "SETTLEMENT_USDC": "', vm.toString(settlementUsdc), '",\n',
            '    "SETTLEMENT_USDC_DECIMALS": "6",\n',
            '    "MOCK_USDT": "', vm.toString(mockUsdt), '",\n',
            '    "USDC": "', vm.toString(l3Wusdc), '"\n'
        );
        return string.concat(p1, p2, p3);
    }

    function _buildAccountsJson() internal view returns (string memory) {
        return string.concat(
            '  "accounts": {\n',
            '    "admin": "', vm.toString(admin), '",\n',
            '    "oracle1": "', vm.toString(oracle1), '",\n',
            '    "oracle2": "', vm.toString(oracle2), '",\n',
            '    "oracle3": "', vm.toString(oracle3), '",\n',
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
        console.log("  SETTLEMENT_USDC: 6 decimals (real USDC)");
        console.log("");
        console.log("Next steps (in E2E script):");
        console.log("  1. User approves Index for L3_WUSDC spending");
        console.log("  2. User approves SettlementBridgeCustody for SETTLEMENT_USDC spending");
        console.log("  3. AP approves MockBitgetVault for token spending");
        console.log("===========================================");
    }
}
