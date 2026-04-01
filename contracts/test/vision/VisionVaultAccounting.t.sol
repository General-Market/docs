// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {VisionVaultAccounting} from "../../src/libraries/VisionVaultAccounting.sol";

contract VisionVaultAccountingTest is Test {
    using VisionVaultAccounting for *;

    function test_sharesForDeposit_firstDepositor() public pure {
        uint256 shares = VisionVaultAccounting.sharesForDeposit(100e18, 0, 0);
        assertEq(shares, 100e18);
    }

    function test_sharesForDeposit_existingVault() public pure {
        uint256 shares = VisionVaultAccounting.sharesForDeposit(50e18, 200e18, 100e18);
        assertEq(shares, 25e18);
    }

    function test_sharesForDeposit_zeroAssets() public pure {
        uint256 shares = VisionVaultAccounting.sharesForDeposit(0, 200e18, 100e18);
        assertEq(shares, 0);
    }

    function test_assetsForRedeem_proportional() public pure {
        uint256 assets = VisionVaultAccounting.assetsForRedeem(50e18, 200e18, 100e18);
        assertEq(assets, 100e18);
    }

    function test_assetsForRedeem_allShares() public pure {
        uint256 assets = VisionVaultAccounting.assetsForRedeem(100e18, 200e18, 100e18);
        assertEq(assets, 200e18);
    }

    function test_performanceFee_aboveHWM() public pure {
        uint256 feeShares = VisionVaultAccounting.performanceFeeShares(
            1.2e18, 1.0e18, 100e18, 2000
        );
        assertApproxEqAbs(feeShares, 3448275862068965517, 1e15);
    }

    function test_performanceFee_belowHWM() public pure {
        uint256 feeShares = VisionVaultAccounting.performanceFeeShares(
            0.8e18, 1.0e18, 100e18, 2000
        );
        assertEq(feeShares, 0);
    }

    function test_performanceFee_atHWM() public pure {
        uint256 feeShares = VisionVaultAccounting.performanceFeeShares(
            1.0e18, 1.0e18, 100e18, 2000
        );
        assertEq(feeShares, 0);
    }

    function test_performanceFee_zeroFeeRate() public pure {
        uint256 feeShares = VisionVaultAccounting.performanceFeeShares(
            1.5e18, 1.0e18, 100e18, 0
        );
        assertEq(feeShares, 0);
    }

    function test_navPerShare_normal() public pure {
        uint256 nav = VisionVaultAccounting.navPerShare(200e18, 100e18);
        assertEq(nav, 2e18);
    }

    function test_navPerShare_zeroSupply() public pure {
        uint256 nav = VisionVaultAccounting.navPerShare(200e18, 0);
        assertEq(nav, 1e18);
    }
}
