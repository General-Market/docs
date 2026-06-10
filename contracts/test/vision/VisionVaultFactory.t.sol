// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Vision} from "../../src/vision/Vision.sol";
import {VisionVault} from "../../src/vision/VisionVault.sol";
import {VisionVaultFactory} from "../../src/vision/VisionVaultFactory.sol";
import {IVisionVault, IVisionVaultFactory} from "../../src/interfaces/IVisionVault.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {OracleRegistry} from "../../src/registry/OracleRegistry.sol";
import {Governance} from "../../src/Governance.sol";
import "../helpers/TestHelper.sol";

contract VisionVaultFactoryTest is TestHelper {
    Vision public vision;
    VisionVault public implementation;
    VisionVaultFactory public factory;
    MockERC20 public usdc;
    OracleRegistry public oracleRegistry;
    Governance public governance;

    address public manager1;
    address public manager2;

    string constant NAME = "Vision Vault Alpha";
    string constant SYMBOL = "vVALPHA";
    uint256 constant FEE_RATE = 2000; // 20%

    function setUp() public {
        manager1 = makeAddr("manager1");
        manager2 = makeAddr("manager2");

        usdc = new MockERC20("USDC", "USDC", 18);

        governance = deployGovernance(address(this));
        oracleRegistry = deployOracleRegistry(address(governance));
        registerTestOraclesWithBLS(oracleRegistry, address(this));

        address collector = makeAddr("feeCollector");
        vision = new Vision(address(usdc), address(oracleRegistry), collector);

        implementation = new VisionVault();
        factory = new VisionVaultFactory(address(implementation), address(vision), address(usdc));
    }

    // ── Immutables ────────────────────────────────────────────────────

    function test_immutables() public view {
        assertEq(factory.implementation(), address(implementation));
        assertEq(factory.vision(), address(vision));
        assertEq(factory.usdc(), address(usdc));
        assertEq(factory.MAX_PERFORMANCE_FEE(), 5000);
    }

    // ── createVault: happy path ───────────────────────────────────────

    function test_createVault_deploysAndInitializes() public {
        address vault = factory.createVault(NAME, SYMBOL, FEE_RATE, manager1);

        assertTrue(vault != address(0));
        assertEq(IVisionVault(vault).manager(), manager1);
        assertEq(IVisionVault(vault).performanceFeeRate(), FEE_RATE);
        assertEq(IVisionVault(vault).highWaterMark(), 1e18);
        assertEq(IVisionVault(vault).asset(), address(usdc));
        assertEq(IVisionVault(vault).name(), NAME);
        assertEq(IVisionVault(vault).symbol(), SYMBOL);
    }

    function test_createVault_emitsEvent() public {
        vm.expectEmit(false, true, false, true);
        emit IVisionVaultFactory.VaultCreated(address(0), manager1, NAME, SYMBOL, FEE_RATE);
        factory.createVault(NAME, SYMBOL, FEE_RATE, manager1);
    }

    function test_createVault_isCloneOfImplementation() public {
        address vault = factory.createVault(NAME, SYMBOL, FEE_RATE, manager1);

        // EIP-1167 clones share bytecode length (45 bytes for minimal proxy)
        // Verify it is NOT the implementation itself
        assertTrue(vault != address(implementation));

        // Minimal proxy bytecode is 45 bytes
        assertEq(vault.code.length, 45);
    }

    // ── createVault: fee guard ────────────────────────────────────────

    function test_createVault_revertsFeeTooHigh() public {
        vm.expectRevert(IVisionVaultFactory.FeeTooHigh.selector);
        factory.createVault(NAME, SYMBOL, 5001, manager1);
    }

    function test_createVault_allowsMaxFee() public {
        address vault = factory.createVault(NAME, SYMBOL, 5000, manager1);
        assertEq(IVisionVault(vault).performanceFeeRate(), 5000);
    }

    function test_createVault_allowsZeroFee() public {
        address vault = factory.createVault(NAME, SYMBOL, 0, manager1);
        assertEq(IVisionVault(vault).performanceFeeRate(), 0);
    }

    // ── Registry: all vaults ─────────────────────────────────────────

    function test_registry_tracksAllVaults() public {
        assertEq(factory.getVaultCount(), 0);
        assertEq(factory.getAllVaults().length, 0);

        address v1 = factory.createVault(NAME, SYMBOL, FEE_RATE, manager1);
        assertEq(factory.getVaultCount(), 1);

        address v2 = factory.createVault("Vault 2", "vV2", 1000, manager2);
        assertEq(factory.getVaultCount(), 2);

        address[] memory all = factory.getAllVaults();
        assertEq(all.length, 2);
        assertEq(all[0], v1);
        assertEq(all[1], v2);
    }

    // ── Registry: by manager ─────────────────────────────────────────

    function test_registry_tracksByManager() public {
        address v1 = factory.createVault(NAME, SYMBOL, FEE_RATE, manager1);
        address v2 = factory.createVault("Vault 2", "vV2", 1000, manager2);
        address v3 = factory.createVault("Vault 3", "vV3", 500, manager1);

        address[] memory m1Vaults = factory.getVaultsByManager(manager1);
        assertEq(m1Vaults.length, 2);
        assertEq(m1Vaults[0], v1);
        assertEq(m1Vaults[1], v3);

        address[] memory m2Vaults = factory.getVaultsByManager(manager2);
        assertEq(m2Vaults.length, 1);
        assertEq(m2Vaults[0], v2);
    }

    function test_registry_emptyManagerReturnsEmpty() public view {
        address[] memory vaults = factory.getVaultsByManager(manager1);
        assertEq(vaults.length, 0);
    }

    // ── Registry: isRegisteredVault ──────────────────────────────────

    function test_isRegisteredVault_trueForDeployed() public {
        address vault = factory.createVault(NAME, SYMBOL, FEE_RATE, manager1);
        assertTrue(factory.isRegisteredVault(vault));
    }

    function test_isRegisteredVault_falseForRandom() public view {
        assertFalse(factory.isRegisteredVault(address(0xdead)));
        assertFalse(factory.isRegisteredVault(address(implementation)));
    }

    // ── Multiple vaults from same manager get different addresses ─────

    function test_multipleVaults_differentAddresses() public {
        address v1 = factory.createVault(NAME, SYMBOL, FEE_RATE, manager1);
        address v2 = factory.createVault(NAME, SYMBOL, FEE_RATE, manager1);
        address v3 = factory.createVault(NAME, SYMBOL, FEE_RATE, manager1);

        assertTrue(v1 != v2);
        assertTrue(v2 != v3);
        assertTrue(v1 != v3);

        assertEq(factory.getVaultCount(), 3);
        assertEq(factory.getVaultsByManager(manager1).length, 3);
    }

    // ── Clone isolation: re-initialization blocked ───────────────────

    function test_clone_cannotBeReinitialized() public {
        address vault = factory.createVault(NAME, SYMBOL, FEE_RATE, manager1);

        vm.expectRevert(IVisionVault.AlreadyInitialized.selector);
        IVisionVault(vault).initialize("hack", "HACK", address(this), address(vision), address(usdc), 0);
    }

    // ── Clone isolation: independent state ───────────────────────────

    function test_clones_haveIndependentState() public {
        address v1 = factory.createVault(NAME, SYMBOL, 1000, manager1);
        address v2 = factory.createVault("Vault 2", "vV2", 3000, manager2);

        assertEq(IVisionVault(v1).manager(), manager1);
        assertEq(IVisionVault(v2).manager(), manager2);
        assertEq(IVisionVault(v1).performanceFeeRate(), 1000);
        assertEq(IVisionVault(v2).performanceFeeRate(), 3000);

        // Deposit into v1 doesn't affect v2
        usdc.mint(address(this), 100 ether);
        usdc.approve(v1, type(uint256).max);
        IVisionVault(v1).requestDeposit(100 ether, address(this), address(this));

        assertEq(IVisionVault(v1).totalAssets(), 100 ether);
        assertEq(IVisionVault(v2).totalAssets(), 0);
    }
}
