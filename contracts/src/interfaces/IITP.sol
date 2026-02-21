// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IERC4626Minimal - Minimal ERC4626 interface
/// @notice Minimal interface for ERC4626 vault standard
/// @dev Full implementation would inherit from OpenZeppelin's IERC4626
interface IERC4626Minimal {
    /// @notice Returns the address of the underlying asset token
    /// @return The address of the underlying ERC20 token
    function asset() external view returns (address);

    /// @notice Returns the number of decimals used for vault shares
    /// @return The number of decimals (typically same as underlying asset)
    function decimals() external view returns (uint8);

    /// @notice Returns the total amount of underlying assets held by the vault
    function totalAssets() external view returns (uint256);

    /// @notice Converts a given amount of assets to shares
    /// @param assets The amount of assets to convert
    /// @return shares The equivalent amount of shares
    function convertToShares(uint256 assets) external view returns (uint256 shares);

    /// @notice Converts a given amount of shares to assets
    /// @param shares The amount of shares to convert
    /// @return assets The equivalent amount of assets
    function convertToAssets(uint256 shares) external view returns (uint256 assets);

    /// @notice Returns the maximum amount of assets that can be deposited
    /// @param receiver The address receiving the shares
    /// @return maxAssets The maximum deposit amount
    function maxDeposit(address receiver) external view returns (uint256 maxAssets);

    /// @notice Returns the maximum amount of shares that can be minted
    /// @param receiver The address receiving the shares
    /// @return maxShares The maximum mint amount
    function maxMint(address receiver) external view returns (uint256 maxShares);

    /// @notice Returns the maximum amount of assets that can be withdrawn
    /// @param owner The address that owns the shares
    /// @return maxAssets The maximum withdraw amount
    function maxWithdraw(address owner) external view returns (uint256 maxAssets);

    /// @notice Returns the maximum amount of shares that can be redeemed
    /// @param owner The address that owns the shares
    /// @return maxShares The maximum redeem amount
    function maxRedeem(address owner) external view returns (uint256 maxShares);

    /// @notice Preview how many shares would be received for a deposit
    /// @param assets The amount of assets to deposit
    /// @return shares The shares that would be received
    function previewDeposit(uint256 assets) external view returns (uint256 shares);

    /// @notice Preview how many assets are needed to mint shares
    /// @param shares The amount of shares to mint
    /// @return assets The assets needed
    function previewMint(uint256 shares) external view returns (uint256 assets);

    /// @notice Preview how many shares are needed to withdraw assets
    /// @param assets The amount of assets to withdraw
    /// @return shares The shares needed
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);

    /// @notice Preview how many assets would be received for a redemption
    /// @param shares The amount of shares to redeem
    /// @return assets The assets that would be received
    function previewRedeem(uint256 shares) external view returns (uint256 assets);
}

/// @title IITP - Index Token Product interface
/// @notice ERC4626-compliant vault for ITP tokens
/// @dev Extends ERC4626 with restricted mint/burn callable only by Investment.sol
/// @dev Direct deposit() and withdraw() MUST revert - all orders go through Investment.sol
interface IITP is IERC4626Minimal {
    // ============ RESTRICTED FUNCTIONS ============

    /// @notice Mint ITP shares to a user
    /// @dev ONLY callable by Investment.sol after order fill confirmation
    /// @dev Reverts if caller is not the Investment contract
    /// @param to Address to receive the shares
    /// @param shares Amount of shares to mint
    function mint(address to, uint256 shares) external;

    /// @notice Burn ITP shares from a user
    /// @dev ONLY callable by Investment.sol after sell order fill confirmation
    /// @dev Reverts if caller is not the Investment contract
    /// @param from Address to burn shares from
    /// @param shares Amount of shares to burn
    function burn(address from, uint256 shares) external;

    // ============ BLOCKED FUNCTIONS ============

    /// @notice Deposit assets for shares
    /// @dev MUST REVERT - direct deposits not allowed, use Investment.submitOrder
    /// @param assets Amount of assets to deposit
    /// @param receiver Address to receive shares
    /// @return shares Amount of shares minted (always reverts)
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    /// @notice Withdraw assets by burning shares
    /// @dev MUST REVERT - direct withdrawals not allowed, use Investment.submitOrder with SELL
    /// @param assets Amount of assets to withdraw
    /// @param receiver Address to receive assets
    /// @param owner Address that owns the shares
    /// @return shares Amount of shares burned (always reverts)
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

    /// @notice Redeem shares for assets
    /// @dev MUST REVERT - direct redemptions not allowed, use Investment.submitOrder with SELL
    /// @param shares Amount of shares to redeem
    /// @param receiver Address to receive assets
    /// @param owner Address that owns the shares
    /// @return assets Amount of assets received (always reverts)
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

    // ============ VIEW FUNCTIONS ============

    /// @notice Returns the Investment contract address
    /// @return The address of the Investment contract that can call mint/burn
    function indexContract() external view returns (address);

    /// @notice Returns the ITP identifier
    /// @return The bytes32 ITP ID
    function itpId() external view returns (bytes32);
}
