// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/core/Index.sol";
import "../../src/mocks/MockERC20.sol";
import "../../src/mocks/MockTokenFactory.sol";
import "../helpers/TestHelper.sol";
import {Governance} from "../../src/Governance.sol";
import {TypesLib} from "../../src/libraries/TypesLib.sol";
import {ErrorsLib} from "../../src/libraries/ErrorsLib.sol";
import {EventsLib} from "../../src/libraries/EventsLib.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title RegisteredAssetsStressTest
/// @notice Stress tests for large ITP creation (100+ assets, up to MAX_ASSETS=1000)
contract RegisteredAssetsStressTest is TestHelper {
    Index public implementation;
    Index public index;
    Governance public governance;
    MockERC20 public usdc;
    MockTokenFactory public factory;

    address public admin = address(0x1);
    address public user1 = address(0x2);

    uint256 constant WEIGHT_SUM = 1e18;

    function setUp() public {
        governance = deployGovernance(admin);
        usdc = new MockERC20("USDC", "USDC", 18);
        factory = new MockTokenFactory();

        implementation = new Index();
        bytes memory initData = abi.encodeWithSelector(Index.initialize.selector, address(governance), address(usdc));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        index = Index(address(proxy));

        vm.label(admin, "Admin");
        vm.label(user1, "User1");
    }

    /// @notice Deploy N mock tokens using factory batches of up to 200
    function _deployTokens(uint256 count) internal returns (address[] memory tokens) {
        tokens = new address[](count);
        uint256 batchSize = 200;
        uint256 deployed = 0;

        while (deployed < count) {
            uint256 thisBatch = count - deployed;
            if (thisBatch > batchSize) thisBatch = batchSize;

            uint256[] memory ids = new uint256[](thisBatch);
            string[] memory symbols = new string[](thisBatch);
            string[] memory pairs = new string[](thisBatch);

            for (uint256 i = 0; i < thisBatch; i++) {
                ids[i] = deployed + i;
                symbols[i] = string.concat("T", vm.toString(deployed + i));
                pairs[i] = string.concat("T", vm.toString(deployed + i), "USDC");
            }

            address[] memory batch = factory.deployBatch(ids, symbols, pairs);
            for (uint256 i = 0; i < thisBatch; i++) {
                tokens[deployed + i] = batch[i];
            }
            deployed += thisBatch;
        }
    }

    /// @notice Build a prices array for createITP (all assets at $1)
    function _buildPrices(uint256 count) internal pure returns (uint256[] memory prices) {
        prices = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            prices[i] = 1e18; // $1 each
        }
    }

    /// @notice Create ITP with 100 assets, 1% weight each
    function test_createITP_100Assets_stressTest() public {
        uint256 assetCount = 100;
        address[] memory tokens = _deployTokens(assetCount);
        uint256[] memory prices = _buildPrices(assetCount);

        uint256[] memory weights = new uint256[](assetCount);
        uint256 weightPerAsset = 1e16; // 1% each
        uint256 remainder = WEIGHT_SUM - (weightPerAsset * assetCount);

        for (uint256 i = 0; i < assetCount; i++) {
            weights[i] = weightPerAsset;
        }
        weights[0] += remainder;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Stress 100", "S100", weights, tokens, prices, type(uint256).max);

        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.assetCount, 100, "Should create 100-asset ITP");
        assertEq(itp.name, "Stress 100");
        assertEq(itp.symbol, "S100");
    }

    /// @notice Create ITP with 200 assets, 0.5% weight each
    function test_createITP_200Assets_stressTest() public {
        uint256 assetCount = 200;
        address[] memory tokens = _deployTokens(assetCount);
        uint256[] memory prices = _buildPrices(assetCount);

        uint256[] memory weights = new uint256[](assetCount);
        uint256 weightPerAsset = 5e15; // 0.5% each
        uint256 remainder = WEIGHT_SUM - (weightPerAsset * assetCount);

        for (uint256 i = 0; i < assetCount; i++) {
            weights[i] = weightPerAsset;
        }
        weights[0] += remainder;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Stress 200", "S200", weights, tokens, prices, type(uint256).max);

        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.assetCount, 200, "Should create 200-asset ITP");
    }

    /// @notice Verify 400 assets hits practical MIN_WEIGHT limit (0.25% * 400 = 100%)
    function test_createITP_400Assets_minWeightLimit() public {
        uint256 assetCount = 400;
        address[] memory tokens = _deployTokens(assetCount);
        uint256[] memory prices = _buildPrices(assetCount);

        uint256[] memory weights = new uint256[](assetCount);
        // MIN_WEIGHT = 25e14 = 0.25%, 400 * 0.25% = 100%
        uint256 weightPerAsset = 25e14;
        uint256 remainder = WEIGHT_SUM - (weightPerAsset * assetCount);

        for (uint256 i = 0; i < assetCount; i++) {
            weights[i] = weightPerAsset;
        }
        weights[0] += remainder;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Stress 400", "S400", weights, tokens, prices, type(uint256).max);

        TypesLib.ITPCore memory itp = index.getITP(itpId);
        assertEq(itp.assetCount, 400, "Should create 400-asset ITP at MIN_WEIGHT boundary");
    }

    /// @notice Deploy 627 mock tokens in batches, verify factory can handle it
    function test_deployTokens_627Batch() public {
        address[] memory tokens = _deployTokens(627);
        assertEq(tokens.length, 627);
        // Verify all addresses are unique and non-zero
        for (uint256 i = 0; i < 627; i++) {
            assertTrue(tokens[i] != address(0), "Token should be non-zero");
            for (uint256 j = i + 1; j < 627; j++) {
                assertTrue(tokens[i] != tokens[j], "Tokens should be unique");
            }
        }
    }

    /// @notice Submit an order on a 100-asset ITP
    function test_submitOrder_100AssetITP() public {
        uint256 assetCount = 100;
        address[] memory tokens = _deployTokens(assetCount);
        uint256[] memory prices = _buildPrices(assetCount);

        uint256[] memory weights = new uint256[](assetCount);
        uint256 weightPerAsset = 1e16;
        uint256 remainder = WEIGHT_SUM - (weightPerAsset * assetCount);
        for (uint256 i = 0; i < assetCount; i++) {
            weights[i] = weightPerAsset;
        }
        weights[0] += remainder;

        vm.prank(user1);
        bytes32 itpId = index.createITP("Order Test", "OT100", weights, tokens, prices, type(uint256).max);

        // Fund user and submit buy order
        uint256 orderAmount = 1000e18;
        usdc.mint(user1, orderAmount);
        uint256 nav = index.getNAV(itpId);

        vm.startPrank(user1);
        usdc.approve(address(index), orderAmount);
        uint256 orderId = index.submitOrder(
            itpId,
            TypesLib.Side.BUY,
            orderAmount,
            nav,  // limitPrice (use current NAV)
            1,    // slippageTier
            block.timestamp + 3600
        );
        vm.stopPrank();

        assertTrue(orderId > 0, "Order should be created");
    }
}
