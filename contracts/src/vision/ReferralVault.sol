// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ReferralVault
/// @notice Merkle-based referral reward distribution vault
/// @dev Admin posts merkle roots per epoch, referrers claim with proof
contract ReferralVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Custom Errors ============

    error NotAdmin();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidProof();
    error AlreadyClaimed(uint256 epoch, address user);
    error EpochNotSet(uint256 epoch);
    error InsufficientVaultBalance(uint256 available, uint256 required);

    // ============ State Variables ============

    IERC20 public immutable wind;
    address public admin;
    uint256 public currentEpoch;

    /// @notice epoch -> merkle root
    mapping(uint256 => bytes32) public epochRoots;

    /// @notice epoch -> user -> claimed?
    mapping(uint256 => mapping(address => bool)) public claimed;

    // ============ Events ============

    event RewardClaimed(address indexed user, uint256 indexed epoch, uint256 amount);
    event EpochSet(uint256 indexed epoch, bytes32 root);
    event VaultFunded(address indexed funder, uint256 amount);
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);

    // ============ Constructor ============

    constructor(address _wind) {
        if (_wind == address(0)) revert ZeroAddress();
        wind = IERC20(_wind);
        admin = msg.sender;
    }

    // ============ Admin Functions ============

    /// @notice Set merkle root for the next epoch
    /// @param root The merkle root for reward claims
    /// @dev Increments currentEpoch and sets the root
    function setMerkleRoot(bytes32 root) external {
        if (msg.sender != admin) revert NotAdmin();

        currentEpoch++;
        epochRoots[currentEpoch] = root;

        emit EpochSet(currentEpoch, root);
    }

    /// @notice Fund the vault with WIND tokens for rewards
    /// @param amount Amount of WIND to deposit
    function fundVault(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        wind.safeTransferFrom(msg.sender, address(this), amount);
        emit VaultFunded(msg.sender, amount);
    }

    /// @notice Transfer admin role
    /// @param newAdmin New admin address
    function setAdmin(address newAdmin) external {
        if (msg.sender != admin) revert NotAdmin();
        if (newAdmin == address(0)) revert ZeroAddress();
        address old = admin;
        admin = newAdmin;
        emit AdminUpdated(old, newAdmin);
    }

    // ============ Claim Functions ============

    /// @notice Claim referral reward for a specific epoch
    /// @param epoch The epoch to claim for
    /// @param amount The reward amount
    /// @param proof Merkle proof for the claim
    function claim(uint256 epoch, uint256 amount, bytes32[] calldata proof) external nonReentrant {
        if (epochRoots[epoch] == bytes32(0)) revert EpochNotSet(epoch);
        if (claimed[epoch][msg.sender]) revert AlreadyClaimed(epoch, msg.sender);
        if (amount == 0) revert ZeroAmount();

        // Verify merkle proof: leaf = keccak256(abi.encodePacked(userAddress, amount))
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        if (!MerkleProof.verify(proof, epochRoots[epoch], leaf)) revert InvalidProof();

        // Check vault has enough balance
        uint256 available = wind.balanceOf(address(this));
        if (available < amount) revert InsufficientVaultBalance(available, amount);

        // Mark claimed
        claimed[epoch][msg.sender] = true;

        // Transfer reward
        wind.safeTransfer(msg.sender, amount);

        emit RewardClaimed(msg.sender, epoch, amount);
    }

    // ============ View Functions ============

    /// @notice Check if a user has claimed for an epoch
    /// @param epoch The epoch to check
    /// @param user The user address
    /// @return Whether the user has claimed
    function hasClaimed(uint256 epoch, address user) external view returns (bool) {
        return claimed[epoch][user];
    }

    /// @notice Get the vault's WIND balance
    /// @return The current WIND balance available for rewards
    function vaultBalance() external view returns (uint256) {
        return wind.balanceOf(address(this));
    }
}
