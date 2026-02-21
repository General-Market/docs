// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IReferralVault - Referral reward vault interface
/// @notice Merkle-based referral reward distribution vault
/// @dev Admin posts merkle roots per epoch, referrers claim with proof
interface IReferralVault {
    // ============ Custom Errors ============

    error NotAdmin();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidProof();
    error AlreadyClaimed(uint256 epoch, address user);
    error EpochNotSet(uint256 epoch);
    error InsufficientVaultBalance(uint256 available, uint256 required);

    // ============ Events ============

    event RewardClaimed(address indexed user, uint256 indexed epoch, uint256 amount);
    event EpochSet(uint256 indexed epoch, bytes32 root);
    event VaultFunded(address indexed funder, uint256 amount);
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);

    // ============ Admin Functions ============

    /// @notice Set merkle root for the next epoch
    /// @param root The merkle root for reward claims
    /// @dev Increments currentEpoch and sets the root
    function setMerkleRoot(bytes32 root) external;

    /// @notice Fund the vault with WIND tokens for rewards
    /// @param amount Amount of WIND to deposit
    function fundVault(uint256 amount) external;

    /// @notice Transfer admin role
    /// @param newAdmin New admin address
    function setAdmin(address newAdmin) external;

    // ============ Claim Functions ============

    /// @notice Claim referral reward for a specific epoch
    /// @param epoch The epoch to claim for
    /// @param amount The reward amount
    /// @param proof Merkle proof for the claim
    function claim(uint256 epoch, uint256 amount, bytes32[] calldata proof) external;

    // ============ View Functions ============

    /// @notice Check if a user has claimed for an epoch
    /// @param epoch The epoch to check
    /// @param user The user address
    /// @return Whether the user has claimed
    function hasClaimed(uint256 epoch, address user) external view returns (bool);

    /// @notice Get the vault's WIND balance
    /// @return The current WIND balance available for rewards
    function vaultBalance() external view returns (uint256);

    // ============ Public State Accessors ============

    /// @notice The WIND token used for rewards
    function wind() external view returns (address);

    /// @notice Current admin address
    function admin() external view returns (address);

    /// @notice Current epoch number
    function currentEpoch() external view returns (uint256);

    /// @notice Mapping of epoch to merkle root
    function epochRoots(uint256 epoch) external view returns (bytes32);

    /// @notice Mapping of epoch and user to claimed status
    function claimed(uint256 epoch, address user) external view returns (bool);
}
