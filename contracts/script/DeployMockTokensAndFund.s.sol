// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/mocks/MockERC20.sol";
import "../src/mocks/MockBitgetVault.sol";

/// @title DeployMockTokensAndFund
/// @notice Deploy mock tokens and fund MockBitgetVault with 627 tokens each
/// @dev Story 7-6b Note: For real USDC on Settlement/mainnet, use 6 decimals.
///      This script uses 18 decimals for simplified mock testing.
///      For production-like decimals, use DeployFullSystemE2E or DeployRebalanceE2E.
contract DeployMockTokensAndFund is Script {
    uint256 public constant FUND_AMOUNT = 627 * 1e18; // 627 tokens with 18 decimals

    function run() external {
        // Get config from environment
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // Get existing MockBitgetVault address (or deploy new one)
        address vaultAddress = vm.envOr("BITGET_VAULT", address(0));

        console.log("=== Mock Token Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Vault:", vaultAddress);

        vm.startBroadcast(deployerKey);

        // Deploy mock tokens
        MockERC20 mockUSDC = new MockERC20("Mock USDC", "mUSDC", 18);
        MockERC20 mockBTC = new MockERC20("Mock Bitcoin", "mBTC", 18);
        MockERC20 mockETH = new MockERC20("Mock Ethereum", "mETH", 18);

        console.log("mUSDC deployed:", address(mockUSDC));
        console.log("mBTC deployed:", address(mockBTC));
        console.log("mETH deployed:", address(mockETH));

        // Deploy MockBitgetVault if not provided
        MockBitgetVault vault;
        if (vaultAddress == address(0)) {
            vault = new MockBitgetVault();
            vault.initialize(deployer);
            vaultAddress = address(vault);
            console.log("New MockBitgetVault deployed:", vaultAddress);
        } else {
            vault = MockBitgetVault(vaultAddress);
            console.log("Using existing vault:", vaultAddress);
        }

        // Mint 627 of each token to deployer
        mockUSDC.mint(deployer, FUND_AMOUNT);
        mockBTC.mint(deployer, FUND_AMOUNT);
        mockETH.mint(deployer, FUND_AMOUNT);
        console.log("Minted 627 of each token to deployer");

        // Vault starts at ZERO — only real user deposits fund it.
        console.log("MockBitgetVault: 0 (funded only by completeBuyOrder)");

        // Verify balances
        uint256 vaultUSDC = mockUSDC.balanceOf(vaultAddress);
        uint256 vaultBTC = mockBTC.balanceOf(vaultAddress);
        uint256 vaultETH = mockETH.balanceOf(vaultAddress);

        console.log("=== Vault Balances ===");
        console.log("mUSDC:", vaultUSDC / 1e18);
        console.log("mBTC:", vaultBTC / 1e18);
        console.log("mETH:", vaultETH / 1e18);

        // Mint extra tokens to deployer for testing
        mockUSDC.mint(deployer, 10000 * 1e18);
        console.log("Minted 10000 mUSDC to deployer for testing");

        vm.stopBroadcast();

        // Output summary
        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("mUSDC:", address(mockUSDC));
        console.log("mBTC:", address(mockBTC));
        console.log("mETH:", address(mockETH));
        console.log("MockBitgetVault:", vaultAddress);
    }
}
