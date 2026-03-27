// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

interface IIndex {
    function getItpCount() external view returns (uint256);
    function getITPState(bytes32 itpId) external view returns (
        address creator, uint256 totalSupply, uint256 nav,
        address[] memory assets, uint256[] memory weights, uint256[] memory inventory
    );
    function seedMint(bytes32 itpId, address to, uint256 shares) external;
}

/// @title SeedMint — Directly mint ITP shares for testnet seeding
/// @notice Bypasses the order pipeline entirely. Admin calls seedMint on each ITP
///         with a pseudo-random amount between 100 and 1000 shares (1e20 to 1e21).
contract SeedMint is Script {
    address constant BUYER = 0xa0Ee7A142d267C1f36714E4a8F75612F20a79720;
    uint256 constant MIN_SHARES = 100e18;   // 100 shares (18 decimals)
    uint256 constant MAX_SHARES = 1000e18;  // 1000 shares

    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address indexAddr = vm.envAddress("INDEX_ADDRESS");

        IIndex idx = IIndex(indexAddr);
        uint256 itpCount = idx.getItpCount();

        console.log("Total ITPs:", itpCount);
        console.log("Buyer:", BUYER);

        vm.startBroadcast(key);

        uint256 minted = 0;
        uint256 totalShares = 0;

        for (uint256 i = 1; i <= itpCount; i++) {
            bytes32 itpId = bytes32(i);

            (address creator,,,,,) = idx.getITPState(itpId);
            if (creator == address(0)) continue;

            // Pseudo-random amount: hash(block.timestamp, i) -> 100-1000 shares
            uint256 pseudoRandom = uint256(keccak256(abi.encode(block.timestamp, i, "seedMint")));
            uint256 shares = MIN_SHARES + (pseudoRandom % (MAX_SHARES - MIN_SHARES));

            idx.seedMint(itpId, BUYER, shares);

            console.log("ITP %d seeded %d shares", i, shares / 1e18);
            minted++;
            totalShares += shares;
        }

        vm.stopBroadcast();

        console.log("Seeded", minted, "ITPs, total shares:", totalShares / 1e18);
    }
}
