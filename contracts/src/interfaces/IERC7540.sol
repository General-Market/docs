// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IERC7540Deposit — Async deposit requests (ERC-7540)
interface IERC7540Deposit {
    event DepositRequest(address indexed controller, address indexed owner, uint256 requestId, address sender, uint256 assets);

    function requestDeposit(uint256 assets, address controller, address owner) external returns (uint256 requestId);
    function pendingDepositRequest(uint256 requestId, address controller) external view returns (uint256 assets);
    function claimDeposit(address receiver, address controller) external returns (uint256 shares);
}

/// @title IERC7540Redeem — Async withdrawal requests (ERC-7540)
interface IERC7540Redeem {
    event RedeemRequest(address indexed controller, address indexed owner, uint256 requestId, address sender, uint256 shares);

    function requestRedeem(uint256 shares, address controller, address owner) external returns (uint256 requestId);
    function pendingRedeemRequest(uint256 requestId, address controller) external view returns (uint256 shares);
    function claimRedeem(address receiver, address controller) external returns (uint256 assets);
}
