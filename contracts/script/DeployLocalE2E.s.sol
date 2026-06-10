// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";
import {MockBitgetVault} from "../test/mocks/MockBitgetVault.sol";

/// @title DeployLocalE2E - Local E2E deployment for asset tokens
/// @notice Deploys mock asset tokens and MockUSDT; vault uses mint/burn (no pre-funding)
/// @dev Story 7.18: Mint/burn model — vault mints buyToken on demand, no pre-funding needed.
///      USDC uses 6 decimals, USDT uses 6 decimals (real format).
contract DeployLocalE2E is Script {
    function run() external {
        uint256 anvilKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address deployer = vm.addr(anvilKey);

        // Existing addresses from DeployFullSystemE2E deployment
        address mockBitgetVault = 0xc6e7DF5E7b4f2A278906862b61205850344D4e7d;
        // Story 7-6b: L3_WUSDC uses 18 decimals (internal protocol standard)
        address usdc = 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9;

        vm.startBroadcast(anvilKey);

        // Deploy mock asset tokens
        MockERC20 wbtc = new MockERC20("Wrapped Bitcoin", "WBTC", 8);
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        MockERC20 matic = new MockERC20("Polygon", "MATIC", 18);
        MockERC20 link = new MockERC20("Chainlink", "LINK", 18);
        MockERC20 uni = new MockERC20("Uniswap", "UNI", 18);

        // Story 7.18: Deploy MockUSDT (6 decimals, same as real USDT)
        MockERC20 usdt = new MockERC20("Mock USDT", "USDT", 6);

        console.log("Asset tokens deployed:");
        console.log("  WBTC:", address(wbtc));
        console.log("  WETH:", address(weth));
        console.log("  MATIC:", address(matic));
        console.log("  LINK:", address(link));
        console.log("  UNI:", address(uni));
        console.log("  USDT:", address(usdt));

        // Story 7.18: Mint/burn model — no vault pre-funding needed.
        // Mint tokens to deployer (AP) for testing — AP's ERC20 balanceOf is source of truth.
        uint256 usdcAmount = 1_000_000 * 10**6;  // 1M USDC (6 decimals)
        uint256 usdtAmount = 1_000_000 * 10**6;  // 1M USDT (6 decimals)
        MockERC20(usdc).mint(deployer, usdcAmount);
        usdt.mint(deployer, usdtAmount);

        // Approve vault to take USDC and USDT from AP (for executeTrade and swapStable)
        MockERC20(usdc).approve(mockBitgetVault, type(uint256).max);
        usdt.approve(mockBitgetVault, type(uint256).max);

        // Story 7.18: Register USDC and USDT as stable tokens for swapStable
        MockBitgetVault vault = MockBitgetVault(mockBitgetVault);
        vault.setStableTokens(usdc, 18, address(usdt), 18);

        console.log("Vault configured with mint/burn model (no pre-funding)");
        console.log("AP funded with 1M USDC and 1M USDT");
        console.log("Stable tokens registered: USDC + USDT");
        console.log("MOCK_USDT:", address(usdt));

        vm.stopBroadcast();
    }
}
