// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Morpho, Id, MarketParams, Position, Market} from "@morpho-blue/Morpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {AdaptiveCurveIrm} from "@morpho-blue-irm/adaptive-curve-irm/AdaptiveCurveIrm.sol";
import {CuratorRateIRM} from "../../src/irm/CuratorRateIRM.sol";
import {MirrorIssuerRegistry} from "../../src/registry/MirrorIssuerRegistry.sol";
import {ITPNAVOracle} from "../../src/oracle/ITPNAVOracle.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./TestHelper.sol";

/// @title MorphoTestHelper
/// @notice Reusable deployment logic for Morpho Blue tests
/// @dev Deploys full Morpho stack: Morpho Blue, AdaptiveCurveIrm, ITPNAVOracle,
///      creates market, and seeds USDC liquidity
abstract contract MorphoTestHelper is TestHelper {
    using MarketParamsLib for MarketParams;

    // ============ DEPLOYED CONTRACTS ============

    Morpho public morpho;
    AdaptiveCurveIrm public irm;
    CuratorRateIRM public curatorIrm;
    ITPNAVOracle public oracle;
    MirrorIssuerRegistry public mirrorRegistry;
    MockERC20 public itp;
    MockERC20 public usdc;
    MarketParams public marketParams;
    Id public marketId;

    // ============ ADDRESSES ============

    address public morphoOwner = address(0xAA);
    address public lender = address(0xBB);
    address public borrower = address(0xCC);
    address public mirrorAdmin = address(0xDD);

    // ============ CONSTANTS ============

    /// @notice 77% LLTV (Tier A)
    uint256 public constant LLTV = 0.77e18;

    /// @notice Oracle price: 1 ITP (18 dec) = 1 USDC (6 dec)
    /// @dev Formula: price = collateralPrice * 10^(36 + loanDecimals - collateralDecimals)
    ///      For 1:1 price: 1 * 10^(36 + 6 - 18) = 10^24
    uint256 public constant ORACLE_PRICE = 1e24;

    /// @notice Lender USDC seed amount: 1,000,000 USDC
    uint256 public constant LENDER_USDC = 1_000_000e6;

    /// @notice Borrower ITP amount: 1,000 ITP
    uint256 public constant BORROWER_ITP = 1_000e18;

    // ============ BLS MOCK ============

    address constant PRECOMPILE_PAIRING = address(0x08);

    // ============ SETUP ============

    /// @notice Deploy the full Morpho test stack
    function _deployMorphoStack() internal {
        // Set realistic block timestamp and mock BLS precompile
        vm.warp(1_700_000_000);
        vm.mockCall(PRECOMPILE_PAIRING, bytes(""), abi.encode(uint256(1)));

        // 1. Deploy mock tokens
        itp = new MockERC20("Index Token Product", "ITP", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);

        // 2. Deploy MirrorIssuerRegistry (UUPS proxy)
        bytes memory aggPubkey = generateTestPubkey(1);
        MirrorIssuerRegistry mirrorImpl = new MirrorIssuerRegistry();
        ERC1967Proxy mirrorProxy = new ERC1967Proxy(
            address(mirrorImpl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (aggPubkey, 2, 3, mirrorAdmin))
        );
        mirrorRegistry = MirrorIssuerRegistry(address(mirrorProxy));

        // 3. Deploy ITPNAVOracle with initial price, then push BLS-signed update
        oracle = new ITPNAVOracle(address(mirrorRegistry), address(itp), ORACLE_PRICE);
        bytes memory mockSig = new bytes(64);
        oracle.updatePrice(ORACLE_PRICE, block.timestamp, 1, mockSig, 0x07);

        // 4. Deploy Morpho Blue core
        morpho = new Morpho(morphoOwner);

        // 5. Deploy AdaptiveCurveIrm
        irm = new AdaptiveCurveIrm(address(morpho));

        // 6. Enable IRM and LLTV on Morpho
        vm.startPrank(morphoOwner);
        morpho.enableIrm(address(irm));
        morpho.enableLltv(LLTV);
        vm.stopPrank();

        // 7. Build market params and create market
        marketParams = MarketParams({
            loanToken: address(usdc),
            collateralToken: address(itp),
            oracle: address(oracle),
            irm: address(irm),
            lltv: LLTV
        });
        morpho.createMarket(marketParams);
        marketId = marketParams.id();

        // 8. Seed USDC liquidity (lender deposits into market)
        usdc.mint(lender, LENDER_USDC);
        vm.startPrank(lender);
        usdc.approve(address(morpho), type(uint256).max);
        morpho.supply(marketParams, LENDER_USDC, 0, lender, "");
        vm.stopPrank();

        // 9. Mint ITP to borrower
        itp.mint(borrower, BORROWER_ITP);
    }

    // ============ HELPERS ============

    /// @notice Set up a borrow position: approve → supplyCollateral → borrow
    function _setupBorrowPosition(uint256 collateral, uint256 borrow) internal {
        vm.startPrank(borrower);
        itp.approve(address(morpho), collateral);
        morpho.supplyCollateral(marketParams, collateral, borrower, "");
        morpho.borrow(marketParams, borrow, 0, borrower, borrower);
        vm.stopPrank();
    }

    // ============ ACCESSORS ============

    function getMorpho() public view returns (address) {
        return address(morpho);
    }

    function getIrm() public view returns (address) {
        return address(irm);
    }

    function getOracle() public view returns (address) {
        return address(oracle);
    }

    function getMirrorRegistry() public view returns (address) {
        return address(mirrorRegistry);
    }

    function getItp() public view returns (address) {
        return address(itp);
    }

    function getUsdc() public view returns (address) {
        return address(usdc);
    }

    function getMarketParams() public view returns (MarketParams memory) {
        return marketParams;
    }

    function getMarketId() public view returns (Id) {
        return marketId;
    }

    // ============ CURATOR IRM VARIANT ============

    /// @notice Deploy Morpho stack with CuratorRateIRM instead of AdaptiveCurveIRM
    /// @param _curator Address of the curator who can set rates
    function _deployMorphoStackWithCuratorIRM(address _curator) internal {
        // Set realistic block timestamp and mock BLS precompile
        vm.warp(1_700_000_000);
        vm.mockCall(PRECOMPILE_PAIRING, bytes(""), abi.encode(uint256(1)));

        // 1. Deploy mock tokens
        itp = new MockERC20("Index Token Product", "ITP", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);

        // 2. Deploy MirrorIssuerRegistry (UUPS proxy)
        bytes memory aggPubkey = generateTestPubkey(1);
        MirrorIssuerRegistry mirrorImpl = new MirrorIssuerRegistry();
        ERC1967Proxy mirrorProxy = new ERC1967Proxy(
            address(mirrorImpl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (aggPubkey, 2, 3, mirrorAdmin))
        );
        mirrorRegistry = MirrorIssuerRegistry(address(mirrorProxy));

        // 3. Deploy ITPNAVOracle with initial price, then push BLS-signed update
        oracle = new ITPNAVOracle(address(mirrorRegistry), address(itp), ORACLE_PRICE);
        bytes memory mockSig = new bytes(64);
        oracle.updatePrice(ORACLE_PRICE, block.timestamp, 1, mockSig, 0x07);

        // 4. Deploy Morpho Blue core
        morpho = new Morpho(morphoOwner);

        // 5. Deploy CuratorRateIRM
        curatorIrm = new CuratorRateIRM(address(morpho), _curator);

        // 6. Enable IRM and LLTV on Morpho
        vm.startPrank(morphoOwner);
        morpho.enableIrm(address(curatorIrm));
        morpho.enableLltv(LLTV);
        vm.stopPrank();

        // 7. Build market params and create market (using curatorIrm)
        marketParams = MarketParams({
            loanToken: address(usdc),
            collateralToken: address(itp),
            oracle: address(oracle),
            irm: address(curatorIrm),
            lltv: LLTV
        });
        morpho.createMarket(marketParams);
        marketId = marketParams.id();

        // 8. Seed USDC liquidity (lender deposits into market)
        usdc.mint(lender, LENDER_USDC);
        vm.startPrank(lender);
        usdc.approve(address(morpho), type(uint256).max);
        morpho.supply(marketParams, LENDER_USDC, 0, lender, "");
        vm.stopPrank();

        // 9. Mint ITP to borrower
        itp.mint(borrower, BORROWER_ITP);
    }

    function getCuratorIrm() public view returns (address) {
        return address(curatorIrm);
    }
}
