// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IITP, IERC4626Minimal} from "../interfaces/IITP.sol";
import {IIndex} from "../interfaces/IIndex.sol";

/// @title ITP - Index Token Product
/// @notice ERC4626-compliant vault token for Index products
/// @dev Thin wrapper - all state lives in Index.sol except ERC20 balances
/// @dev NOT upgradeable - each ITP is immutable once deployed
contract ITP is ERC4626, IITP {
    // ============ CUSTOM ERRORS ============

    /// @notice Caller is not the Index contract
    error OnlyIndexAllowed();

    /// @notice Direct deposits are not allowed - use Index.submitOrder
    error DirectDepositNotAllowed();

    /// @notice Direct withdrawals are not allowed - use Index.submitOrder with SELL
    error DirectWithdrawNotAllowed();

    /// @notice Zero address provided where non-zero required
    error ZeroAddress();

    // ============ IMMUTABLE STATE ============

    /// @notice Unique identifier for this ITP
    bytes32 public immutable override itpId;

    /// @notice Address of the Index contract that controls this ITP
    address public immutable override indexContract;

    // ============ MODIFIERS ============

    /// @notice Restricts function to Index.sol only
    modifier onlyIndex() {
        if (msg.sender != indexContract) revert OnlyIndexAllowed();
        _;
    }

    // ============ CONSTRUCTOR ============

    /// @notice Creates a new ITP vault
    /// @param _itpId Unique identifier for this ITP
    /// @param _index Address of the Index contract
    /// @param _name Token name (e.g., "Index Crypto Blend")
    /// @param _symbol Token symbol (e.g., "ICRYPTO")
    /// @param _asset Underlying asset address (USDC)
    constructor(
        bytes32 _itpId,
        address _index,
        string memory _name,
        string memory _symbol,
        IERC20 _asset
    ) ERC20(_name, _symbol) ERC4626(_asset) {
        if (_index == address(0)) revert ZeroAddress();
        if (address(_asset) == address(0)) revert ZeroAddress();
        itpId = _itpId;
        indexContract = _index;
    }

    // ============ ERC4626 VIEW OVERRIDES ============

    /// @notice Total assets under management
    /// @dev Computed from NAV * totalSupply
    /// @return Total value in underlying asset (USDC, 18 decimals)
    function totalAssets() public view override(ERC4626, IERC4626Minimal) returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        uint256 nav = IIndex(indexContract).getNAV(itpId);
        return (nav * supply) / 1e18;
    }

    /// @notice Convert assets to shares using NAV
    /// @param assets Amount of assets (USDC) to convert
    /// @return Amount of shares that would be received
    function convertToShares(uint256 assets) public view override(ERC4626, IERC4626Minimal) returns (uint256) {
        uint256 nav = IIndex(indexContract).getNAV(itpId);
        if (nav == 0) return assets; // 1:1 when NAV not set
        return (assets * 1e18) / nav;
    }

    /// @notice Convert shares to assets using NAV
    /// @param shares Amount of shares to convert
    /// @return Amount of assets (USDC) that would be received
    function convertToAssets(uint256 shares) public view override(ERC4626, IERC4626Minimal) returns (uint256) {
        uint256 nav = IIndex(indexContract).getNAV(itpId);
        return (shares * nav) / 1e18;
    }

    /// @notice Preview deposit - always returns 0 (direct deposits not allowed)
    function previewDeposit(uint256) public pure override(ERC4626, IERC4626Minimal) returns (uint256) {
        return 0;
    }

    /// @notice Preview mint - always returns type(uint256).max (direct mints not allowed)
    function previewMint(uint256) public pure override(ERC4626, IERC4626Minimal) returns (uint256) {
        return type(uint256).max; // Infinite assets required (impossible)
    }

    /// @notice Preview withdraw - always returns type(uint256).max (direct withdrawals not allowed)
    function previewWithdraw(uint256) public pure override(ERC4626, IERC4626Minimal) returns (uint256) {
        return type(uint256).max; // Infinite shares required (impossible)
    }

    /// @notice Preview redeem - always returns 0 (direct redemptions not allowed)
    function previewRedeem(uint256) public pure override(ERC4626, IERC4626Minimal) returns (uint256) {
        return 0;
    }

    /// @notice Maximum deposit - always 0 (direct deposits not allowed)
    function maxDeposit(address) public pure override(ERC4626, IERC4626Minimal) returns (uint256) {
        return 0;
    }

    /// @notice Maximum mint - always 0 (direct mints not allowed)
    function maxMint(address) public pure override(ERC4626, IERC4626Minimal) returns (uint256) {
        return 0;
    }

    /// @notice Maximum withdraw - always 0 (direct withdrawals not allowed)
    function maxWithdraw(address) public pure override(ERC4626, IERC4626Minimal) returns (uint256) {
        return 0;
    }

    /// @notice Maximum redeem - always 0 (direct redemptions not allowed)
    function maxRedeem(address) public pure override(ERC4626, IERC4626Minimal) returns (uint256) {
        return 0;
    }

    // ============ BLOCKED ERC4626 FUNCTIONS ============

    /// @notice Direct deposits not allowed - use Index.submitOrder
    /// @dev Always reverts with DirectDepositNotAllowed error
    function deposit(uint256, address) public pure override(ERC4626, IITP) returns (uint256) {
        revert DirectDepositNotAllowed();
    }

    /// @notice Direct mints not allowed - use Index.submitOrder
    /// @dev Always reverts with DirectDepositNotAllowed error
    function mint(uint256, address) public pure override(ERC4626) returns (uint256) {
        revert DirectDepositNotAllowed();
    }

    /// @notice Direct withdrawals not allowed - use Index.submitOrder with SELL
    /// @dev Always reverts with DirectWithdrawNotAllowed error
    function withdraw(uint256, address, address) public pure override(ERC4626, IITP) returns (uint256) {
        revert DirectWithdrawNotAllowed();
    }

    /// @notice Direct redemptions not allowed - use Index.submitOrder with SELL
    /// @dev Always reverts with DirectWithdrawNotAllowed error
    function redeem(uint256, address, address) public pure override(ERC4626, IITP) returns (uint256) {
        revert DirectWithdrawNotAllowed();
    }

    // ============ RESTRICTED FUNCTIONS (INDEX.SOL ONLY) ============

    /// @notice Mint shares to user (Index.sol only)
    /// @dev Called by Index.sol when buy orders are filled
    /// @param to Recipient address
    /// @param shares Amount of shares to mint
    function mint(address to, uint256 shares) external override onlyIndex {
        _mint(to, shares);
    }

    /// @notice Burn shares from user (Index.sol only)
    /// @dev Called by Index.sol when sell orders are filled
    /// @param from Address to burn from
    /// @param shares Amount of shares to burn
    function burn(address from, uint256 shares) external override onlyIndex {
        _burn(from, shares);
    }

    // ============ IERC4626Minimal IMPLEMENTATION ============

    /// @notice Returns the underlying asset address (inherited from ERC4626)
    /// @dev Override required to resolve diamond inheritance between ERC4626 and IERC4626Minimal
    /// @return The USDC address configured at deployment
    function asset() public view override(ERC4626, IERC4626Minimal) returns (address) {
        return super.asset();
    }

    /// @notice Returns the decimals for this token (inherited from ERC20)
    /// @dev Override required to resolve diamond inheritance between ERC4626 and IERC4626Minimal
    /// @return The number of decimals (18, matching USDC on Index L3)
    function decimals() public view override(ERC4626, IERC4626Minimal) returns (uint8) {
        return super.decimals();
    }
}
