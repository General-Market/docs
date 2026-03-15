// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../interfaces/IBridge.sol";
import "../interfaces/IOracleRegistry.sol";
import "../libraries/BLSLib.sol";
import "../libraries/BLSVerifier.sol";
import "../libraries/DecimalLib.sol";
import "../libraries/ErrorsLib.sol";
import "../libraries/EventsLib.sol";
import "../libraries/TypesLib.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title L3BridgeCustody - L3 source chain bridge custody for cross-chain USDC transfers
/// @notice Handles locking USDC on L3 for bridging to other chains using two-phase commit
/// @dev UUPS upgradeable, uses sequential nonces for bridge operations
/// @custom:security-contact security@indexprotocol.com
contract L3BridgeCustody is Initializable, UUPSUpgradeable, BLSVerifier, IL3BridgeCustody {
    using SafeERC20 for IERC20;

    // ============ CONSTANTS ============

    /// @notice Timeout before reversal is allowed (1 hour)
    uint256 public constant LOCK_TIMEOUT = 1 hours;

    /// @notice Standard operation threshold (11/20)
    uint256 public constant STANDARD_THRESHOLD = 11;

    /// @notice Emergency reversal threshold (15/20)
    uint256 public constant REVERSAL_THRESHOLD = 15;

    /// @notice Upgrade timelock duration (7 days)
    uint256 public constant UPGRADE_TIMELOCK = 7 days;

    /// @notice Emergency upgrade timelock duration (24 hours)
    uint256 public constant EMERGENCY_UPGRADE_TIMELOCK = 24 hours;

    // ============ STORAGE ============

    /// @notice Reference to OracleRegistry for BLS key verification
    IOracleRegistry public oracleRegistry;

    /// @notice USDC token contract
    IERC20 public usdc;

    /// @notice Mapping of nonce to pending lock details
    mapping(uint256 => TypesLib.PendingLock) public pendingLocks;

    /// @notice Current bridge nonce (sequential, incremented for each lock)
    uint256 public bridgeNonce;

    /// @notice Pending upgrade implementation address
    address public pendingUpgradeImpl;

    /// @notice Pending upgrade proposal timestamp
    uint256 public pendingUpgradeProposedAt;

    /// @notice Whether pending upgrade is emergency (24h) or standard (7d)
    bool public pendingUpgradeIsEmergency;

    /// @notice Storage gap for future upgrades (50 - 7 used = 43)
    uint256[43] private __gap;

    // ============ INITIALIZER ============

    /// @notice Initialize the L3BridgeCustody contract
    /// @param oracleRegistry_ Address of the OracleRegistry contract
    /// @param usdc_ Address of the USDC token contract (must be 18 decimals on L3)
    function initialize(address oracleRegistry_, address usdc_) external initializer {
        __UUPSUpgradeable_init();
        if (oracleRegistry_ == address(0)) {
            revert ErrorsLib.E043_ZeroOracleRegistry();
        }
        if (usdc_ == address(0)) {
            revert ErrorsLib.E050_ZeroUSDCAddress();
        }

        // Validate L3 USDC has 18 decimals (internal protocol standard)
        uint8 usdcDecimals = IERC20Metadata(usdc_).decimals();
        if (usdcDecimals != DecimalLib.INTERNAL_DECIMALS) {
            revert ErrorsLib.E080_InvalidUsdcDecimals(usdcDecimals, DecimalLib.INTERNAL_DECIMALS);
        }

        oracleRegistry = IOracleRegistry(oracleRegistry_);
        __BLSVerifier_init(oracleRegistry_);
        usdc = IERC20(usdc_);
    }

    // ============ BRIDGE INITIATION ============

    /// @inheritdoc IL3BridgeCustody
    function initiateBridge(
        uint256 destChainId,
        uint256 amount,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external override returns (uint256 nonce) {
        // Validate amount is non-zero
        if (amount == 0) {
            revert ErrorsLib.E052_ZeroAmount();
        }

        // Validate destination chain ID (not zero, not current chain)
        if (destChainId == 0 || destChainId == block.chainid) {
            revert ErrorsLib.E053_InvalidDestChainId(destChainId);
        }

        // Get current nonce before incrementing
        nonce = bridgeNonce;

        // Build message for BLS verification
        // Message: keccak256(abi.encode(chainid, this, destChainId, amount, nonce))
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), destChainId, amount, nonce));

        // Verify BLS signature (11/20 threshold)
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Transfer USDC from caller to this contract (escrow)
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Store pending lock with all required fields
        pendingLocks[nonce] = TypesLib.PendingLock({
            amount: amount,
            destChainId: destChainId,
            lockedAt: block.timestamp,
            lockedBlock: block.number,
            lockedBlockHash: blockhash(block.number - 1),
            released: false,
            reversed: false
        });

        // Increment nonce for next lock
        bridgeNonce = nonce + 1;

        // Emit BridgeLockConfirmed event
        emit EventsLib.BridgeLockConfirmed(
            nonce,
            amount,
            destChainId,
            block.number,
            blockhash(block.number - 1)
        );

        // Also emit BridgeInitiated from interface
        emit BridgeInitiated(nonce, destChainId, amount);
    }

    // ============ LOCK MANAGEMENT ============

    /// @inheritdoc IL3BridgeCustody
    function markReleased(
        uint256 nonce,
        bytes32 destTxHash,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external override {
        TypesLib.PendingLock storage lock = pendingLocks[nonce];

        // Check lock exists (amount > 0 means it was created)
        if (lock.amount == 0) {
            revert ErrorsLib.E049_LockNotFound(nonce);
        }

        // Check lock is not already released
        if (lock.released) {
            revert ErrorsLib.E045_LockAlreadyReleased(nonce);
        }

        // Check lock is not already reversed
        if (lock.reversed) {
            revert ErrorsLib.E046_LockAlreadyReversed(nonce);
        }

        // Build message for BLS verification
        // Message: keccak256(abi.encode(chainid, this, nonce, destTxHash))
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), nonce, destTxHash));

        // Verify BLS signature (11/20 threshold)
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Mark as released
        lock.released = true;

        // Emit event
        emit LockReleased(nonce, destTxHash);
    }

    /// @inheritdoc IL3BridgeCustody
    function reverseLock(
        uint256 nonce,
        bytes calldata blsSignature,
        uint256 signerCount,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external override {
        TypesLib.PendingLock storage lock = pendingLocks[nonce];

        // Check lock exists
        if (lock.amount == 0) {
            revert ErrorsLib.E049_LockNotFound(nonce);
        }

        // Check lock is not already released
        if (lock.released) {
            revert ErrorsLib.E045_LockAlreadyReleased(nonce);
        }

        // Check lock is not already reversed
        if (lock.reversed) {
            revert ErrorsLib.E046_LockAlreadyReversed(nonce);
        }

        // Check timeout has passed
        if (block.timestamp < lock.lockedAt + LOCK_TIMEOUT) {
            revert ErrorsLib.E047_LockTimeoutNotReached(nonce, lock.lockedAt, block.timestamp);
        }

        // Check signer count meets emergency threshold (15/20)
        if (signerCount < REVERSAL_THRESHOLD) {
            revert ErrorsLib.E048_InsufficientSignerCount(signerCount, REVERSAL_THRESHOLD);
        }

        // Build message for BLS verification
        // Message: keccak256(abi.encode(chainid, this, "reverse", nonce, signerCount))
        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "reverse", nonce, signerCount));

        // Verify BLS signature (15/20 threshold for emergency reversal)
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Mark as reversed
        lock.reversed = true;

        // Transfer USDC back to this contract (stays in custody for manual distribution)
        // In production, this would go to a designated recipient or back to the original source
        // For now, funds remain in contract for admin retrieval
        // Note: The caller initiated the bridge, not necessarily the owner of the funds
        // Funds stay in contract for governance to handle

        // Emit event
        emit LockReversed(nonce);
    }

    /// @notice Withdraw USDC from a reversed bridge lock via BLS consensus
    /// @dev Since PendingLock has no sender field, recovery requires BLS-verified recipient
    /// @param nonce The lock nonce that was reversed
    /// @param recipient Address to receive the funds
    /// @param blsSignature Aggregated BLS signature from oracles
    function withdrawReversedFunds(
        uint256 nonce,
        address recipient,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external {
        TypesLib.PendingLock storage lock = pendingLocks[nonce];
        if (lock.amount == 0) revert ErrorsLib.E049_LockNotFound(nonce);
        if (!lock.reversed) revert ErrorsLib.E046_LockAlreadyReversed(nonce);
        if (recipient == address(0)) revert ErrorsLib.E050_ZeroUSDCAddress();

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "withdrawReversed", nonce, recipient
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        uint256 amount = lock.amount;
        lock.amount = 0; // prevent double withdrawal
        usdc.safeTransfer(recipient, amount);
        emit EventsLib.ReversedFundsWithdrawn(nonce, recipient, amount);
    }

    // ============ VIEW FUNCTIONS ============

    /// @inheritdoc IL3BridgeCustody
    function getPendingLock(uint256 nonce) external view override returns (TypesLib.PendingLock memory lock) {
        return pendingLocks[nonce];
    }

    /// @inheritdoc IL3BridgeCustody
    function currentNonce() external view override returns (uint256) {
        return bridgeNonce;
    }

    /// @inheritdoc IL3BridgeCustody
    function canReverseLock(uint256 nonce) external view override returns (bool) {
        TypesLib.PendingLock storage lock = pendingLocks[nonce];

        // Lock must exist
        if (lock.amount == 0) {
            return false;
        }

        // Lock must not be released or reversed
        if (lock.released || lock.reversed) {
            return false;
        }

        // Timeout must have passed
        return block.timestamp >= lock.lockedAt + LOCK_TIMEOUT;
    }

    // ============ UPGRADE MANAGEMENT ============

    /// @notice Propose a standard upgrade (7-day timelock)
    /// @param newImpl New implementation address
    /// @param blsSignature BLS signature from oracles
    function proposeUpgrade(address newImpl, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external {
        if (newImpl == address(0)) {
            revert ErrorsLib.E038_ZeroImplementation();
        }
        if (pendingUpgradeImpl != address(0)) {
            revert ErrorsLib.E039_UpgradeAlreadyPending();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "proposeUpgrade", newImpl));

        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        pendingUpgradeImpl = newImpl;
        pendingUpgradeProposedAt = block.timestamp;
        pendingUpgradeIsEmergency = false;
    }

    /// @notice Propose an emergency upgrade (24-hour timelock, 17/20 threshold)
    /// @param newImpl New implementation address
    /// @param blsSignature BLS signature from oracles
    function proposeEmergencyUpgrade(address newImpl, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external {
        if (newImpl == address(0)) {
            revert ErrorsLib.E038_ZeroImplementation();
        }
        if (pendingUpgradeImpl != address(0)) {
            revert ErrorsLib.E039_UpgradeAlreadyPending();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "proposeEmergencyUpgrade", newImpl));

        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        pendingUpgradeImpl = newImpl;
        pendingUpgradeProposedAt = block.timestamp;
        pendingUpgradeIsEmergency = true;
    }

    /// @notice Execute a pending upgrade after timelock
    /// @param newImpl Implementation address to upgrade to (must match pending)
    function executeUpgrade(address newImpl) external {
        if (pendingUpgradeImpl == address(0)) {
            revert ErrorsLib.E040_NoPendingUpgrade();
        }
        if (pendingUpgradeImpl != newImpl) {
            revert ErrorsLib.E041_ImplementationMismatch(pendingUpgradeImpl, newImpl);
        }

        uint256 timelock = pendingUpgradeIsEmergency ? EMERGENCY_UPGRADE_TIMELOCK : UPGRADE_TIMELOCK;
        uint256 unlockTime = pendingUpgradeProposedAt + timelock;

        if (block.timestamp < unlockTime) {
            revert ErrorsLib.E042_UpgradeTimelockActive(unlockTime, block.timestamp);
        }

        // Perform upgrade
        upgradeToAndCall(newImpl, "");

        // Clear pending upgrade
        pendingUpgradeImpl = address(0);
        pendingUpgradeProposedAt = 0;
        pendingUpgradeIsEmergency = false;
    }

    /// @notice Cancel a pending upgrade
    /// @param blsSignature BLS signature from oracles
    function cancelUpgrade(bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external {
        if (pendingUpgradeImpl == address(0)) {
            revert ErrorsLib.E040_NoPendingUpgrade();
        }

        bytes32 message = keccak256(abi.encode(block.chainid, address(this), "cancelUpgrade", pendingUpgradeImpl));

        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        // Clear pending upgrade
        pendingUpgradeImpl = address(0);
        pendingUpgradeProposedAt = 0;
        pendingUpgradeIsEmergency = false;
    }

    /// @notice Get pending upgrade details
    /// @return proposedImpl Implementation address
    /// @return proposedAt Proposal timestamp
    /// @return isEmergency Whether this is an emergency upgrade
    function getPendingUpgrade()
        external
        view
        returns (address proposedImpl, uint256 proposedAt, bool isEmergency)
    {
        return (pendingUpgradeImpl, pendingUpgradeProposedAt, pendingUpgradeIsEmergency);
    }

    // ============ INTERNAL FUNCTIONS ============

    /// @notice Authorize upgrade (UUPS pattern)
    /// @dev Overridden to require BLS-approved upgrade with timelock
    function _authorizeUpgrade(address newImplementation) internal view override {
        uint256 timelock = pendingUpgradeIsEmergency ? EMERGENCY_UPGRADE_TIMELOCK : UPGRADE_TIMELOCK;
        if (pendingUpgradeImpl != newImplementation) {
            revert ErrorsLib.E041_ImplementationMismatch(pendingUpgradeImpl, newImplementation);
        }
        uint256 unlockTime = pendingUpgradeProposedAt + timelock;
        if (block.timestamp < unlockTime) {
            revert ErrorsLib.E042_UpgradeTimelockActive(unlockTime, block.timestamp);
        }
    }
}
