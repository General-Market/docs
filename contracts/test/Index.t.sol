// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/Index.sol";
import "../src/mocks/MockERC20.sol";
import "./helpers/TestHelper.sol";
import {Governance} from "../src/Governance.sol";
import "../src/libraries/TypesLib.sol";
import "../src/libraries/ErrorsLib.sol";
import "../src/libraries/EventsLib.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title Index.t.sol - Tests for Index.sol ITP creation functionality
/// @notice Tests for Story 2.2: Index.sol - Storage & ITP Creation
contract IndexTest is TestHelper {
    Index public implementation;
    Index public index;
    Governance public governance;
    MockERC20 public usdc;

    address public admin = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);

    // Sample assets for testing
    address public asset1 = address(0x100);
    address public asset2 = address(0x101);
    address public asset3 = address(0x102);
    address public asset4 = address(0x103);

    // Dummy BLS signature (64 bytes for G1 point) — pairing precompile is mocked
    bytes public dummyBlsSignature = new bytes(64);

    // Weight constants
    uint256 constant WEIGHT_50_PERCENT = 5e17; // 50% = 0.5e18
    uint256 constant WEIGHT_25_PERCENT = 25e16; // 25% = 0.25e18
    uint256 constant WEIGHT_MIN = 25e14; // 0.25% = 25e14 (minimum)
    uint256 constant WEIGHT_SUM = 1e18; // 100% = 1e18

    // Default asset price for tests ($100)
    uint256 constant DEFAULT_ASSET_PRICE = 100e18;

    function setUp() public {
        // Deploy mock contracts
        governance = deployGovernance(admin);
        usdc = new MockERC20("USDC", "USDC", 18);

        // Deploy Index implementation
        implementation = new Index();

        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(Index.initialize.selector, address(governance), address(usdc));

        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        index = Index(address(proxy));

        // Setup IssuerRegistry with dummy aggregated pubkey for BLS verification
        IssuerRegistry issuerRegistry = deployIssuerRegistry(address(governance));
        vm.startPrank(admin);
        issuerRegistry.setAggregatedPubkey(new bytes(128));
        index.setIssuerRegistry(address(issuerRegistry));
        vm.stopPrank();

        // Mock BN254 pairing precompile to always return true
        vm.mockCall(address(0x08), bytes(""), abi.encode(uint256(1)));

        // Setup test environment
        vm.label(admin, "Admin");
        vm.label(user1, "User1");
        vm.label(user2, "User2");
        vm.label(asset1, "Asset1");
        vm.label(asset2, "Asset2");
        vm.label(asset3, "Asset3");
        vm.label(asset4, "Asset4");
    }

    // ============ TEST: Successful ITP creation (AC #1) ============

    function test_createITP_success() public {
        address[] memory assets = new address[](2);
        assets[0] = asset1;
        assets[1] = asset2;

        uint256[] memory weights = new uint256[](2);
        weights[0] = WEIGHT_50_PERCENT;
        weights[1] = WEIGHT_50_PERCENT;

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Test ITP", "TITP", weights, assets, prices, type(uint256).max);

        // Verify ITP was created
        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.creator, user1, "Creator should be user1");
        assertEq(itp.assetCount, 2, "Asset count should be 2");
        assertEq(itp.status, uint256(TypesLib.ITPStatus.ACTIVE), "Status should be ACTIVE");
        assertEq(itp.totalSupply, 0, "Total supply should be 0");
        assertEq(itp.totalValue, 0, "Total value should be 0");
        assertEq(itp.feeRate, 0, "Fee rate should be 0");
        assertGt(itp.createdAt, 0, "CreatedAt should be set");
    }

    function test_createITP_singleAsset() public {
        address[] memory assets = new address[](1);
        assets[0] = asset1;

        uint256[] memory weights = new uint256[](1);
        weights[0] = WEIGHT_SUM; // 100%

        uint256[] memory prices = new uint256[](1);
        prices[0] = DEFAULT_ASSET_PRICE;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Single Asset ITP", "SITP", weights, assets, prices, type(uint256).max);

        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.assetCount, 1, "Asset count should be 1");
    }

    function test_createITP_manyAssets() public {
        // Create ITP with 4 assets
        address[] memory assets = new address[](4);
        assets[0] = asset1;
        assets[1] = asset2;
        assets[2] = asset3;
        assets[3] = asset4;

        uint256[] memory weights = new uint256[](4);
        weights[0] = WEIGHT_25_PERCENT;
        weights[1] = WEIGHT_25_PERCENT;
        weights[2] = WEIGHT_25_PERCENT;
        weights[3] = WEIGHT_25_PERCENT;

        uint256[] memory prices = new uint256[](4);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;
        prices[2] = DEFAULT_ASSET_PRICE;
        prices[3] = DEFAULT_ASSET_PRICE;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Multi Asset ITP", "MITP", weights, assets, prices, type(uint256).max);

        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.assetCount, 4, "Asset count should be 4");
    }

    // ============ TEST: Weight validation - sum to 1e18 (AC #2) ============

    function test_createITP_revertIfWeightsDontSumTo1e18_tooHigh() public {
        address[] memory assets = new address[](2);
        assets[0] = asset1;
        assets[1] = asset2;

        uint256[] memory weights = new uint256[](2);
        weights[0] = 6e17; // 60%
        weights[1] = 5e17; // 50% - total 110%

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E014_InvalidWeightSum.selector, 11e17, WEIGHT_SUM));

        vm.prank(user1);
        index.createITP("Invalid ITP", "IITP", weights, assets, prices, type(uint256).max);
    }

    function test_createITP_revertIfWeightsDontSumTo1e18_tooLow() public {
        address[] memory assets = new address[](2);
        assets[0] = asset1;
        assets[1] = asset2;

        uint256[] memory weights = new uint256[](2);
        weights[0] = 4e17; // 40%
        weights[1] = 4e17; // 40% - total 80%

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E014_InvalidWeightSum.selector, 8e17, WEIGHT_SUM));

        vm.prank(user1);
        index.createITP("Invalid ITP", "IITP", weights, assets, prices, type(uint256).max);
    }

    // ============ TEST: Minimum weight per asset 0.25% (AC #3) ============

    function test_createITP_revertIfWeightBelowMinimum() public {
        address[] memory assets = new address[](2);
        assets[0] = asset1;
        assets[1] = asset2;

        uint256[] memory weights = new uint256[](2);
        weights[0] = 24e14; // 0.24% - below minimum!
        weights[1] = WEIGHT_SUM - 24e14; // Remainder to make sum = 1e18

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E013_WeightBelowMinimum.selector, 24e14, WEIGHT_MIN));

        vm.prank(user1);
        index.createITP("Invalid ITP", "IITP", weights, assets, prices, type(uint256).max);
    }

    function test_createITP_successWithMinimumWeight() public {
        address[] memory assets = new address[](2);
        assets[0] = asset1;
        assets[1] = asset2;

        uint256[] memory weights = new uint256[](2);
        weights[0] = WEIGHT_MIN; // Exactly 0.25%
        weights[1] = WEIGHT_SUM - WEIGHT_MIN; // 99.75%

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Min Weight ITP", "MWITP", weights, assets, prices, type(uint256).max);

        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.assetCount, 2, "Should create ITP with minimum weight");
    }

    // ============ TEST: Revert if weights.length != assets.length ============

    function test_createITP_revertIfLengthMismatch_moreWeights() public {
        address[] memory assets = new address[](2);
        assets[0] = asset1;
        assets[1] = asset2;

        uint256[] memory weights = new uint256[](3);
        weights[0] = WEIGHT_25_PERCENT;
        weights[1] = WEIGHT_25_PERCENT;
        weights[2] = WEIGHT_50_PERCENT;

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E015_LengthMismatch.selector, 2, 3));

        vm.prank(user1);
        index.createITP("Invalid ITP", "IITP", weights, assets, prices, type(uint256).max);
    }

    function test_createITP_revertIfLengthMismatch_moreAssets() public {
        address[] memory assets = new address[](3);
        assets[0] = asset1;
        assets[1] = asset2;
        assets[2] = asset3;

        uint256[] memory weights = new uint256[](2);
        weights[0] = WEIGHT_50_PERCENT;
        weights[1] = WEIGHT_50_PERCENT;

        uint256[] memory prices = new uint256[](3);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;
        prices[2] = DEFAULT_ASSET_PRICE;

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E015_LengthMismatch.selector, 3, 2));

        vm.prank(user1);
        index.createITP("Invalid ITP", "IITP", weights, assets, prices, type(uint256).max);
    }

    function test_createITP_revertIfNoAssets() public {
        address[] memory assets = new address[](0);
        uint256[] memory weights = new uint256[](0);
        uint256[] memory prices = new uint256[](0);

        vm.expectRevert(ErrorsLib.E016_NoAssets.selector);

        vm.prank(user1);
        index.createITP("Empty ITP", "EITP", weights, assets, prices, type(uint256).max);
    }

    // ============ TEST: Unique itpId generation (AC #4) ============

    function test_createITP_uniqueItpIds() public {
        address[] memory assets = new address[](2);
        assets[0] = asset1;
        assets[1] = asset2;

        uint256[] memory weights = new uint256[](2);
        weights[0] = WEIGHT_50_PERCENT;
        weights[1] = WEIGHT_50_PERCENT;

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        // Create first ITP
        vm.prank(user1);
        bytes32 itpId1 = index.createITP("ITP One", "ITP1", weights, assets, prices, type(uint256).max);

        // Create second ITP (same params, different ID expected)
        vm.prank(user1);
        bytes32 itpId2 = index.createITP("ITP Two", "ITP2", weights, assets, prices, type(uint256).max);

        // Create third ITP from different user
        vm.prank(user2);
        bytes32 itpId3 = index.createITP("ITP Three", "ITP3", weights, assets, prices, type(uint256).max);

        assertNotEq(itpId1, itpId2, "ITP IDs should be unique (1 vs 2)");
        assertNotEq(itpId1, itpId3, "ITP IDs should be unique (1 vs 3)");
        assertNotEq(itpId2, itpId3, "ITP IDs should be unique (2 vs 3)");
    }

    function test_createITP_itpIdIsBytes32() public {
        address[] memory assets = new address[](1);
        assets[0] = asset1;

        uint256[] memory weights = new uint256[](1);
        weights[0] = WEIGHT_SUM;

        uint256[] memory prices = new uint256[](1);
        prices[0] = DEFAULT_ASSET_PRICE;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Test ITP", "TITP", weights, assets, prices, type(uint256).max);

        // Verify it's a valid bytes32 (non-zero for a real ITP)
        assertNotEq(itpId, bytes32(0), "ITP ID should be non-zero");
    }

    // ============ TEST: ITPCreated event emission (AC #5) ============

    function test_createITP_emitsEventWithAllParams() public {
        address[] memory assets = new address[](2);
        assets[0] = asset1;
        assets[1] = asset2;

        uint256[] memory weights = new uint256[](2);
        weights[0] = WEIGHT_50_PERCENT;
        weights[1] = WEIGHT_50_PERCENT;

        vm.recordLogs();

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Event ITP", "EITP", weights, assets, prices, type(uint256).max);

        Vm.Log[] memory entries = vm.getRecordedLogs();

        // Find the ITPCreated event
        bool found = false;
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics[0] == keccak256("ITPCreated(bytes32,address,bytes32,bytes32,address[],uint256[])")) {
                found = true;
                // topic1 = itpId (indexed)
                assertEq(entries[i].topics[1], itpId, "Event itpId mismatch");
                // topic2 = creator (indexed)
                assertEq(entries[i].topics[2], bytes32(uint256(uint160(user1))), "Event creator mismatch");
                // Decode data: name, symbol, assets, weights
                (bytes32 name, bytes32 symbol, address[] memory eventAssets, uint256[] memory eventWeights) =
                    abi.decode(entries[i].data, (bytes32, bytes32, address[], uint256[]));
                assertNotEq(name, bytes32(0), "Event name should not be empty");
                assertNotEq(symbol, bytes32(0), "Event symbol should not be empty");
                assertEq(eventAssets.length, 2, "Event should have 2 assets");
                assertEq(eventAssets[0], asset1, "Event asset0 mismatch");
                assertEq(eventAssets[1], asset2, "Event asset1 mismatch");
                assertEq(eventWeights.length, 2, "Event should have 2 weights");
                assertEq(eventWeights[0], WEIGHT_50_PERCENT, "Event weight0 mismatch");
                assertEq(eventWeights[1], WEIGHT_50_PERCENT, "Event weight1 mismatch");
                break;
            }
        }
        assertTrue(found, "ITPCreated event not emitted");
    }

    // ============ TEST: getITP returns correct data (AC #6) ============

    function test_getITP_returnsCorrectData() public {
        address[] memory assets = new address[](2);
        assets[0] = asset1;
        assets[1] = asset2;

        uint256[] memory weights = new uint256[](2);
        weights[0] = WEIGHT_50_PERCENT;
        weights[1] = WEIGHT_50_PERCENT;

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Test ITP", "TITP", weights, assets, prices, type(uint256).max);

        TypesLib.ITPCore memory itp = index.getITP(itpId);

        assertEq(itp.creator, user1, "Creator mismatch");
        assertEq(itp.assetCount, 2, "Asset count mismatch");
        assertEq(itp.status, uint256(TypesLib.ITPStatus.ACTIVE), "Status mismatch");
        assertEq(itp.totalSupply, 0, "Total supply should be 0");
        assertEq(itp.totalValue, 0, "Total value should be 0");
        assertGt(itp.createdAt, 0, "CreatedAt should be set");
    }

    function test_getITP_revertsForNonExistentITP() public {
        bytes32 fakeItpId = keccak256("fake");

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E006_ITPNotFound.selector, fakeItpId));

        index.getITP(fakeItpId);
    }

    // ============ TEST: getITPState returns complete state ============

    function test_getITPState_returnsCompleteState() public {
        address[] memory assets = new address[](2);
        assets[0] = asset1;
        assets[1] = asset2;

        uint256[] memory weights = new uint256[](2);
        weights[0] = WEIGHT_50_PERCENT;
        weights[1] = WEIGHT_50_PERCENT;

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        vm.prank(user1);
        bytes32 itpId = index.createITP("State ITP", "SITP", weights, assets, prices, type(uint256).max);

        (
            address creator,
            uint256 totalSupply,
            uint256 nav,
            address[] memory returnedAssets,
            uint256[] memory returnedWeights,
            uint256[] memory inventory
        ) = index.getITPState(itpId);

        assertEq(creator, user1, "Creator mismatch");
        assertEq(totalSupply, 0, "Total supply should be 0");
        // NAV = Σ(inventory[i] * price[i]) / 1e18
        // With 50/50 weights at $100 price, inventory = (0.5e18 * 1e18) / 100e18 = 5e15 per asset
        // NAV = 2 * (5e15 * 100e18) / 1e18 = 2 * 5e17 / 1 = 1e18 ($1)
        assertEq(nav, 1e18, "NAV should be $1 for newly created ITP");
        assertEq(returnedAssets.length, 2, "Should have 2 assets");
        assertEq(returnedAssets[0], asset1, "Asset 0 mismatch");
        assertEq(returnedAssets[1], asset2, "Asset 1 mismatch");
        assertEq(returnedWeights[0], WEIGHT_50_PERCENT, "Weight 0 mismatch");
        assertEq(returnedWeights[1], WEIGHT_50_PERCENT, "Weight 1 mismatch");
        assertEq(inventory.length, 2, "Should have 2 inventory slots");
        // qty = (weight * 1e18) / price = (5e17 * 1e18) / 100e18 = 5e15
        assertEq(inventory[0], 5e15, "Inventory 0 should be qty for 50% weight at $100");
        assertEq(inventory[1], 5e15, "Inventory 1 should be qty for 50% weight at $100");
    }

    // ============ TEST: Multiple ITPs can share assets (global registry) ============

    function test_multipleITPs_canShareAssets() public {
        address[] memory assets1 = new address[](2);
        assets1[0] = asset1;
        assets1[1] = asset2;

        address[] memory assets2 = new address[](2);
        assets2[0] = asset1; // Shared with ITP1
        assets2[1] = asset3;

        uint256[] memory weights = new uint256[](2);
        weights[0] = WEIGHT_50_PERCENT;
        weights[1] = WEIGHT_50_PERCENT;

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        // Create first ITP
        vm.prank(user1);
        bytes32 itpId1 = index.createITP("ITP One", "ITP1", weights, assets1, prices, type(uint256).max);

        // Create second ITP sharing asset1
        vm.prank(user2);
        bytes32 itpId2 = index.createITP("ITP Two", "ITP2", weights, assets2, prices, type(uint256).max);

        // Both ITPs should be created successfully
        TypesLib.ITPCore memory itp1 = index.getITP(itpId1);
        TypesLib.ITPCore memory itp2 = index.getITP(itpId2);

        assertEq(itp1.assetCount, 2, "ITP1 should have 2 assets");
        assertEq(itp2.assetCount, 2, "ITP2 should have 2 assets");

        // Verify both ITPs have correct assets
        (,,,address[] memory itp1Assets,,) = index.getITPState(itpId1);
        (,,,address[] memory itp2Assets,,) = index.getITPState(itpId2);

        assertEq(itp1Assets[0], asset1, "ITP1 asset0 should be asset1");
        assertEq(itp2Assets[0], asset1, "ITP2 asset0 should also be asset1");
    }

    // ============ TEST: getITPState reverts for non-existent ITP ============

    function test_getITPState_revertsForNonExistentITP() public {
        bytes32 fakeItpId = keccak256("fake");

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E006_ITPNotFound.selector, fakeItpId));

        index.getITPState(fakeItpId);
    }

    // ============ TEST: createITP reverts when system is paused (H4) ============

    function test_createITP_revertsWhenSystemPaused() public {
        // Pause the system
        vm.prank(admin);
        governance.pause();

        address[] memory assets = new address[](1);
        assets[0] = asset1;

        uint256[] memory weights = new uint256[](1);
        weights[0] = WEIGHT_SUM;

        uint256[] memory prices = new uint256[](1);
        prices[0] = DEFAULT_ASSET_PRICE;

        vm.expectRevert(ErrorsLib.E004_SystemPaused.selector);

        vm.prank(user1);
        index.createITP("Paused ITP", "PITP", weights, assets, prices, type(uint256).max);
    }

    // ============ TEST: Edge cases ============

    function test_createITP_revertIfDuplicateAsset() public {
        address[] memory assets = new address[](2);
        assets[0] = asset1;
        assets[1] = asset1; // Duplicate!

        uint256[] memory weights = new uint256[](2);
        weights[0] = WEIGHT_50_PERCENT;
        weights[1] = WEIGHT_50_PERCENT;

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E017_DuplicateAsset.selector, asset1));

        vm.prank(user1);
        index.createITP("Dup ITP", "DITP", weights, assets, prices, type(uint256).max);
    }

    function test_createITP_revertIfZeroAddressAsset() public {
        address[] memory assets = new address[](2);
        assets[0] = address(0); // Zero address!
        assets[1] = asset2;

        uint256[] memory weights = new uint256[](2);
        weights[0] = WEIGHT_50_PERCENT;
        weights[1] = WEIGHT_50_PERCENT;

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        vm.expectRevert(ErrorsLib.E018_ZeroAssetAddress.selector);

        vm.prank(user1);
        index.createITP("Zero ITP", "ZITP", weights, assets, prices, type(uint256).max);
    }

    function test_createITP_nameAndSymbolPacking() public {
        address[] memory assets = new address[](1);
        assets[0] = asset1;

        uint256[] memory weights = new uint256[](1);
        weights[0] = WEIGHT_SUM;

        uint256[] memory prices = new uint256[](1);
        prices[0] = DEFAULT_ASSET_PRICE;

        vm.prank(user1);
        bytes32 itpId = index.createITP("My Test Name", "MTSYM", weights, assets, prices, type(uint256).max);

        TypesLib.ITPCore memory itp = index.getITP(itpId);

        // Name and symbol should be packed as bytes32
        assertNotEq(itp.name, bytes32(0), "Name should be packed");
        assertNotEq(itp.symbol, bytes32(0), "Symbol should be packed");
    }

    // ============ TEST: String length validation (M3 fix) ============

    function test_createITP_revertIfNameTooLong() public {
        address[] memory assets = new address[](1);
        assets[0] = asset1;

        uint256[] memory weights = new uint256[](1);
        weights[0] = WEIGHT_SUM;

        // Name longer than 32 bytes (51 chars)
        string memory longName = "This name is way too long to fit in bytes32 storage";

        uint256[] memory prices = new uint256[](1);
        prices[0] = DEFAULT_ASSET_PRICE;

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E064_StringTooLong.selector, bytes(longName).length, 32));

        vm.prank(user1);
        index.createITP(longName, "SYM", weights, assets, prices, type(uint256).max);
    }

    function test_createITP_revertIfSymbolTooLong() public {
        address[] memory assets = new address[](1);
        assets[0] = asset1;

        uint256[] memory weights = new uint256[](1);
        weights[0] = WEIGHT_SUM;

        // Symbol longer than 32 bytes (34 chars)
        string memory longSymbol = "THISSSYMBOLISTOOLONGTOFITIN32BYTES";

        uint256[] memory prices = new uint256[](1);
        prices[0] = DEFAULT_ASSET_PRICE;

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E064_StringTooLong.selector, bytes(longSymbol).length, 32));

        vm.prank(user1);
        index.createITP("Name", longSymbol, weights, assets, prices, type(uint256).max);
    }

    // ============ TEST: Max assets validation (M2 fix) ============

    function test_createITP_revertIfTooManyAssets() public {
        uint256 assetCount = 1001; // MAX_ASSETS is 1000
        address[] memory assets = new address[](assetCount);
        uint256[] memory weights = new uint256[](assetCount);
        uint256[] memory prices = new uint256[](assetCount);

        // Create unique addresses and equal weights
        uint256 weightPerAsset = WEIGHT_SUM / assetCount;
        uint256 remainder = WEIGHT_SUM - (weightPerAsset * assetCount);

        for (uint256 i = 0; i < assetCount; i++) {
            assets[i] = address(uint160(0x1000 + i));
            weights[i] = weightPerAsset;
            prices[i] = 1e18;
        }
        // Add remainder to first weight to ensure sum = 1e18
        weights[0] += remainder;

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E051_TooManyAssets.selector, assetCount, 1000));

        vm.prank(user1);
        index.createITP("Too Many", "MANY", weights, assets, prices, type(uint256).max);
    }

    function test_createITP_successWithMaxAssets() public {
        uint256 assetCount = 200; // Well within MAX_ASSETS=1000
        address[] memory assets = new address[](assetCount);
        uint256[] memory weights = new uint256[](assetCount);
        uint256[] memory prices = new uint256[](assetCount);

        // Create unique addresses and equal weights
        uint256 weightPerAsset = WEIGHT_SUM / assetCount; // 5e15 per asset (0.5%)
        uint256 remainder = WEIGHT_SUM - (weightPerAsset * assetCount);

        for (uint256 i = 0; i < assetCount; i++) {
            assets[i] = address(uint160(0x1000 + i));
            weights[i] = weightPerAsset;
            prices[i] = DEFAULT_ASSET_PRICE;
        }
        // Add remainder to first weight to ensure sum = 1e18
        weights[0] += remainder;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Max Assets", "MAX", weights, assets, prices, type(uint256).max);

        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.assetCount, 200, "Should create ITP with 200 assets");
    }

    function test_createITP_100Assets() public {
        uint256 assetCount = 100; // 100-asset ITP, 1% weight each
        address[] memory assets = new address[](assetCount);
        uint256[] memory weights = new uint256[](assetCount);
        uint256[] memory prices = new uint256[](assetCount);

        // 1% each = 1e16
        uint256 weightPerAsset = 1e16;
        uint256 remainder = WEIGHT_SUM - (weightPerAsset * assetCount);

        for (uint256 i = 0; i < assetCount; i++) {
            assets[i] = address(uint160(0x2000 + i));
            weights[i] = weightPerAsset;
            prices[i] = DEFAULT_ASSET_PRICE;
        }
        // Add remainder to first weight to ensure sum = 1e18
        weights[0] += remainder;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Hundred Assets", "H100", weights, assets, prices, type(uint256).max);

        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.assetCount, 100, "Should create ITP with 100 assets");
    }

    // ============ TEST: Fuzz tests ============

    function testFuzz_createITP_validWeights(uint256 weight1) public {
        // Bound weight1 to valid range [MIN_WEIGHT, 1e18 - MIN_WEIGHT]
        weight1 = bound(weight1, WEIGHT_MIN, WEIGHT_SUM - WEIGHT_MIN);
        uint256 weight2 = WEIGHT_SUM - weight1;

        address[] memory assets = new address[](2);
        assets[0] = asset1;
        assets[1] = asset2;

        uint256[] memory weights = new uint256[](2);
        weights[0] = weight1;
        weights[1] = weight2;

        uint256[] memory prices = new uint256[](2);
        prices[0] = DEFAULT_ASSET_PRICE;
        prices[1] = DEFAULT_ASSET_PRICE;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Fuzz ITP", "FITP", weights, assets, prices, type(uint256).max);

        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.assetCount, 2, "Should create ITP with fuzzed weights");
    }

    // ============ STALENESS LIMIT TESTS (Story 7.17, AC #4) ============

    function test_setStalenessLimit_success() public {
        vm.prank(admin);
        index.setStalenessLimit(0, 10); // CEX: 10s

        assertEq(index.stalenessLimits(0), 10);
    }

    function test_setStalenessLimit_revertsNonAdmin() public {
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E061_Unauthorized.selector, user1, admin));
        vm.prank(user1);
        index.setStalenessLimit(0, 10);
    }

    function test_setStalenessLimitsBatch_success() public {
        uint256[] memory types = new uint256[](3);
        types[0] = 0; // CEX
        types[1] = 1; // DEX
        types[2] = 2; // low-liquidity

        uint256[] memory limits = new uint256[](3);
        limits[0] = 10;
        limits[1] = 30;
        limits[2] = 60;

        vm.prank(admin);
        index.setStalenessLimitsBatch(types, limits);

        assertEq(index.stalenessLimits(0), 10);
        assertEq(index.stalenessLimits(1), 30);
        assertEq(index.stalenessLimits(2), 60);
    }

    function test_setStalenessLimitsBatch_revertsLengthMismatch() public {
        uint256[] memory types = new uint256[](2);
        types[0] = 0;
        types[1] = 1;

        uint256[] memory limits = new uint256[](1);
        limits[0] = 10;

        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E015_LengthMismatch.selector, 2, 1));
        vm.prank(admin);
        index.setStalenessLimitsBatch(types, limits);
    }

    function test_setStalenessLimit_zeroDisablesCheck() public {
        vm.prank(admin);
        index.setStalenessLimit(0, 0); // 0 means no limit

        assertEq(index.stalenessLimits(0), 0);
    }

    function test_setStalenessLimit_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit EventsLib.StalenessLimitUpdated(0, 10);

        vm.prank(admin);
        index.setStalenessLimit(0, 10);
    }

    // ============ VENUE POOL TESTS (Story 7.17, AC #6) ============

    function test_configureVenuePool_success() public {
        vm.prank(admin);
        index.configureVenuePool(1, 1000e18, 100e18);

        (uint256 target, uint256 current, uint256 threshold, uint256 lastRebalance) = index.venuePools(1);
        assertEq(target, 1000e18);
        assertEq(current, 0);
        assertEq(threshold, 100e18);
        assertEq(lastRebalance, 0);
    }

    function test_configureVenuePool_revertsNonAdmin() public {
        vm.expectRevert(abi.encodeWithSelector(ErrorsLib.E061_Unauthorized.selector, user1, admin));
        vm.prank(user1);
        index.configureVenuePool(1, 1000e18, 100e18);
    }

    function test_configureVenuePool_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit EventsLib.VenuePoolConfigured(1, 1000e18, 100e18);

        vm.prank(admin);
        index.configureVenuePool(1, 1000e18, 100e18);
    }

    function test_updateVenueBalance_aboveThreshold_noEvent() public {
        vm.prank(admin);
        index.configureVenuePool(1, 1000e18, 100e18);

        // Update balance above threshold (no PoolRebalanceNeeded event)
        // BLS sig verification skipped since issuerRegistry not set (test mode)
        index.updateVenueBalance(1, 500e18, dummyBlsSignature);

        (,uint256 current,,uint256 lastRebalance) = index.venuePools(1);
        assertEq(current, 500e18);
        assertGt(lastRebalance, 0);
    }

    function test_updateVenueBalance_belowThreshold_emitsEvent() public {
        vm.prank(admin);
        index.configureVenuePool(1, 1000e18, 100e18);

        // Update balance below threshold
        vm.expectEmit(true, false, false, true);
        emit EventsLib.PoolRebalanceNeeded(1, 950e18); // 1000 - 50

        index.updateVenueBalance(1, 50e18, dummyBlsSignature);
    }

    function test_updateVenueBalance_zeroBalance() public {
        vm.prank(admin);
        index.configureVenuePool(1, 1000e18, 100e18);

        vm.expectEmit(true, false, false, true);
        emit EventsLib.PoolRebalanceNeeded(1, 1000e18);

        index.updateVenueBalance(1, 0, dummyBlsSignature);

        (,uint256 current,,) = index.venuePools(1);
        assertEq(current, 0);
    }

    function test_configureVenuePool_preservesBalance() public {
        vm.prank(admin);
        index.configureVenuePool(1, 1000e18, 100e18);

        // Set some balance
        index.updateVenueBalance(1, 500e18, dummyBlsSignature);

        // Reconfigure pool - balance should be preserved
        vm.prank(admin);
        index.configureVenuePool(1, 2000e18, 200e18);

        (uint256 target, uint256 current, uint256 threshold,) = index.venuePools(1);
        assertEq(target, 2000e18);
        assertEq(current, 500e18);
        assertEq(threshold, 200e18);
    }

    // ============ BRIDGE NONCE IDEMPOTENCY TESTS ============

    function test_createITP_sameBridgeNonce_returnsSameItpId() public {
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18;
        address[] memory assets = new address[](1);
        assets[0] = asset1;
        uint256[] memory prices = new uint256[](1);
        prices[0] = DEFAULT_ASSET_PRICE;

        uint256 bridgeNonce = 42;

        vm.startPrank(user1);
        bytes32 itpId1 = index.createITP("Idempotent ITP", "IITP", weights, assets, prices, bridgeNonce);
        bytes32 itpId2 = index.createITP("Idempotent ITP", "IITP", weights, assets, prices, bridgeNonce);
        vm.stopPrank();

        assertEq(itpId1, itpId2, "Same bridgeNonce should return same itpId");
        assertEq(uint256(index.getItpCount()), 1, "Should only create 1 ITP");
    }

    function test_createITP_sentinelNonce_createsDifferentItps() public {
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18;
        address[] memory assets = new address[](1);
        assets[0] = asset1;
        uint256[] memory prices = new uint256[](1);
        prices[0] = DEFAULT_ASSET_PRICE;

        vm.startPrank(user1);
        bytes32 itpId1 = index.createITP("ITP A", "ITPA", weights, assets, prices, type(uint256).max);
        bytes32 itpId2 = index.createITP("ITP B", "ITPB", weights, assets, prices, type(uint256).max);
        vm.stopPrank();

        assertFalse(itpId1 == itpId2, "Sentinel nonce should create different ITPs each time");
        assertEq(uint256(index.getItpCount()), 2, "Should create 2 ITPs");
    }

    function test_createITP_differentBridgeNonces_createDifferentItps() public {
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18;
        address[] memory assets = new address[](1);
        assets[0] = asset1;
        uint256[] memory prices = new uint256[](1);
        prices[0] = DEFAULT_ASSET_PRICE;

        vm.startPrank(user1);
        bytes32 itpId1 = index.createITP("ITP 1", "ITP1", weights, assets, prices, 1);
        bytes32 itpId2 = index.createITP("ITP 2", "ITP2", weights, assets, prices, 2);
        vm.stopPrank();

        assertFalse(itpId1 == itpId2, "Different bridgeNonces should create different ITPs");
        assertEq(uint256(index.getItpCount()), 2, "Should create 2 ITPs");
    }

    function test_createITP_bridgeNonceToItpId_mapping() public {
        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18;
        address[] memory assets = new address[](1);
        assets[0] = asset1;
        uint256[] memory prices = new uint256[](1);
        prices[0] = DEFAULT_ASSET_PRICE;

        uint256 bridgeNonce = 99;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Mapped ITP", "MITP", weights, assets, prices, bridgeNonce);

        assertEq(index._bridgeNonceToItpId(bridgeNonce), itpId, "Nonce mapping should be stored");
        assertEq(index._bridgeNonceToItpId(100), bytes32(0), "Unused nonce should be zero");
    }
}
