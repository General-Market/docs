// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/Investment.sol";
import "../src/mocks/MockERC20.sol";
import "./helpers/TestHelper.sol";
import {Governance} from "../src/Governance.sol";
import "../src/libraries/TypesLib.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {OracleRegistry} from "../src/registry/OracleRegistry.sol";

/// @title InvestmentPriceStaleness.t.sol
/// @notice Exercises the proposal-phase _requireFreshPrice guard. Zero is
///         the default and preserves current behaviour; a non-zero value
///         reverts BUY fills whose last-fill timestamp is too old.
contract InvestmentPriceStalenessTest is TestHelper {
    Investment public index;
    MockERC20 public usdc;
    Governance public governance;

    address public user = address(0x1);

    bytes32 public itpId;

    uint256 internal _cycleCounter = 1;

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 18);
        governance = deployGovernance(address(this));

        Investment impl = new Investment();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(Investment.initialize, (address(governance), address(usdc)))
        );
        index = Investment(address(proxy));

        OracleRegistry registry = deployOracleRegistry(address(governance));
        registerTestOraclesWithBLS(registry, address(this));
        index.setOracleRegistry(address(registry));

        uint256[] memory weights = new uint256[](1);
        weights[0] = 1e18;
        address[] memory assets = new address[](1);
        assets[0] = address(usdc);
        uint256[] memory prices = new uint256[](1);
        prices[0] = 1e18;
        itpId = index.createITP("Stale ITP", "STL", weights, assets, prices, type(uint256).max);

        usdc.mint(user, 1_000_000e18);
        vm.prank(user);
        usdc.approve(address(index), type(uint256).max);
    }

    function _nextCycle() internal returns (uint256) {
        return _cycleCounter++;
    }

    function _signBatch(uint256 cycleNumber, uint256[] memory orderIds) internal returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encode(block.chainid, address(index), cycleNumber, orderIds));
        return signWithTestOracles(msgHash);
    }

    function _signFills(uint256 cycleNumber, TypesLib.Fill[] memory fills) internal returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encode(block.chainid, address(index), cycleNumber, fills));
        return signWithTestOracles(msgHash);
    }

    function _buyAndFill(uint256 amount, uint256 fillPrice) internal {
        vm.prank(user);
        uint256 orderId = index.submitOrder(
            itpId, TypesLib.Side.BUY, amount, 0, 1, block.timestamp + 1 hours
        );
        uint256 cycle = _nextCycle();
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(cycle, orderIds, _signBatch(cycle, orderIds), 3, 7);

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: fillPrice,
            fillAmount: amount,
            cycleNumber: cycle,
            txHash: bytes32(0)
        });
        index.confirmFills(cycle, fills, _signFills(cycle, fills), 3, 7);
    }

    function test_default_disabled_allowsAnyAge() public {
        assertEq(index.maxPriceAgeSeconds(), 0, "guard should default to disabled");

        // First fill seeds lastFillTimestamp.
        _buyAndFill(1e18, 1e18);

        // Skip long enough that any reasonable guard would fire.
        skip(30 days);

        // Still passes with guard disabled.
        _buyAndFill(1e18, 1e18);
    }

    function test_enabled_firstFillAllowed() public {
        // Admin activates the guard.
        index.setMaxPriceAgeSeconds(600);

        // No prior fill exists — bootstrap allowance lets the first one through.
        _buyAndFill(1e18, 1e18);
    }

    function test_enabled_freshFillSucceeds() public {
        index.setMaxPriceAgeSeconds(600);
        _buyAndFill(1e18, 1e18);

        skip(60);
        _buyAndFill(1e18, 1e18); // within the 600s window
    }

    function test_enabled_staleFillReverts() public {
        index.setMaxPriceAgeSeconds(600);
        _buyAndFill(1e18, 1e18);

        skip(601);

        // The next BUY fill should revert inside _processFill.
        vm.prank(user);
        uint256 orderId = index.submitOrder(
            itpId, TypesLib.Side.BUY, 1e18, 0, 1, block.timestamp + 1 hours
        );
        uint256 cycle = _nextCycle();
        uint256[] memory orderIds = new uint256[](1);
        orderIds[0] = orderId;
        index.confirmBatch(cycle, orderIds, _signBatch(cycle, orderIds), 3, 7);

        TypesLib.Fill[] memory fills = new TypesLib.Fill[](1);
        fills[0] = TypesLib.Fill({
            orderId: orderId,
            fillPrice: 1e18,
            fillAmount: 1e18,
            cycleNumber: cycle,
            txHash: bytes32(0)
        });

        vm.expectRevert(bytes("Investment: price stale"));
        index.confirmFills(cycle, fills, _signFills(cycle, fills), 3, 7);
    }

    function test_onlyAdmin_canSetMaxAge() public {
        vm.prank(address(0xdeadbeef));
        vm.expectRevert();
        index.setMaxPriceAgeSeconds(600);
    }
}
