// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/TypesLib.sol";
import "./IBridgeProxy.sol";

/// @title IL3BridgeCustody - L3 source chain bridge custody interface
/// @notice Handles locking USDC on L3 for cross-chain transfers
/// @dev Deployed on Index L3 chain
/// @dev Message format: keccak256(abi.encode(chainid, this, functionSpecificData...))
interface IL3BridgeCustody {
    // ============ BRIDGE INITIATION ============

    /// @notice Initiate a bridge transfer by locking USDC
    /// @dev Called by oracle consensus to lock funds for bridge
    /// @dev Message: keccak256(abi.encode(chainid, this, destChainId, amount, nonce))
    /// @param destChainId Destination chain ID
    /// @param amount Amount to lock (18 decimals)
    /// @param blsSignature Aggregated BLS signature from 11/20 oracles
    /// @return nonce The unique nonce for this lock
    function initiateBridge(
        uint256 destChainId,
        uint256 amount,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external returns (uint256 nonce);

    /// @notice Mark a lock as released on destination
    /// @dev Called after successful release on destination chain
    /// @dev Message: keccak256(abi.encode(chainid, this, nonce, destTxHash))
    /// @param nonce The lock nonce
    /// @param destTxHash Transaction hash on destination chain
    /// @param blsSignature Aggregated BLS signature from 11/20 oracles
    function markReleased(
        uint256 nonce,
        bytes32 destTxHash,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Reverse a lock after timeout (1 hour)
    /// @dev Requires 15/20 oracle signatures (emergency threshold)
    /// @dev Can only be called if lock is older than 1 hour and not released
    /// @dev Message: keccak256(abi.encode(chainid, this, "reverse", nonce, signerCount))
    /// @param nonce The lock nonce to reverse
    /// @param blsSignature Aggregated BLS signature from 15/20 oracles
    /// @param signerCount Number of signers (must be >= 15)
    function reverseLock(
        uint256 nonce,
        bytes calldata blsSignature,
        uint256 signerCount,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    // ============ VIEW FUNCTIONS ============

    /// @notice Get details of a pending lock
    /// @param nonce The lock nonce
    /// @return lock The pending lock struct
    function getPendingLock(uint256 nonce) external view returns (TypesLib.PendingLock memory lock);

    /// @notice Get the current nonce
    /// @return The next nonce to be used
    function currentNonce() external view returns (uint256);

    /// @notice Check if a lock can be reversed (timeout passed)
    /// @param nonce The lock nonce
    /// @return Whether the lock timeout has passed
    function canReverseLock(uint256 nonce) external view returns (bool);

    // ============ EVENTS ============

    /// @notice Emitted when a bridge transfer is initiated
    /// @param nonce The unique lock nonce
    /// @param destChainId Destination chain ID
    /// @param amount Amount locked (18 decimals)
    event BridgeInitiated(uint256 indexed nonce, uint256 destChainId, uint256 amount);

    /// @notice Emitted when a lock is marked as released on destination
    /// @param nonce The lock nonce
    /// @param destTxHash Transaction hash on destination chain
    event LockReleased(uint256 indexed nonce, bytes32 destTxHash);

    /// @notice Emitted when a lock is reversed after timeout
    /// @param nonce The lock nonce that was reversed
    event LockReversed(uint256 indexed nonce);
}

/// @title ISettlementBridgeCustody - Settlement destination chain bridge custody interface
/// @notice Handles releasing USDC on Settlement and cross-chain ITP purchases
/// @dev Deployed on Settlement chain
/// @dev Message format: keccak256(abi.encode(chainid, this, functionSpecificData...))
interface ISettlementBridgeCustody {
    // ============ BRIDGE COMPLETION ============

    /// @notice Complete a bridge transfer by releasing USDC
    /// @dev Called after verifying source chain lock
    /// @dev Message: keccak256(abi.encode(chainid, this, proof, amount, nonce))
    /// @param sourceChainId Chain where funds were locked
    /// @param amount Amount to release (18 decimals)
    /// @param nonce Nonce from source chain lock
    /// @param proof Release proof with source chain verification
    /// @param blsSignature Aggregated BLS signature from 11/20 oracles
    function completeBridge(
        uint256 sourceChainId,
        uint256 amount,
        uint256 nonce,
        TypesLib.ReleaseProof calldata proof,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Buy ITP tokens from Settlement (cross-chain purchase)
    /// @dev Locks USDC on Settlement, signals L3 to mint ITP
    /// @dev User's USDC is transferred to custody
    /// @param itpId The ITP to purchase
    /// @param amount USDC amount to spend (18 decimals)
    /// @param limitPrice Maximum price to pay per ITP token (18 decimals)
    /// @param slippageTier Tolerance: 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%)
    /// @param deadline Unix timestamp - order expires after this
    /// @return orderId The order ID on L3 (will be bridged)
    function buyITPFromSettlement(
        bytes32 itpId,
        uint256 amount,
        uint256 limitPrice,
        uint256 slippageTier,
        uint256 deadline
    ) external returns (uint256 orderId);

    // ============ BUY/SELL ORDER CUSTODY ============

    /// @notice Complete a buy order by transferring escrowed USDC to vault
    /// @dev Called by oracles after L3 order processing. Deletes the cross-chain order.
    /// @param orderId The cross-chain order ID
    /// @param vault Destination vault address for USDC
    /// @param blsSignature Aggregated BLS signature
    function completeBuyOrder(uint256 orderId, address vault, bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask) external;

    /// @notice Emitted when a buy order is completed (USDC sent to vault)
    event BuyOrderCompleted(uint256 indexed orderId, address indexed vault, uint256 usdcAmount);

    /// @notice Clear pending mint data after successful mintBridgedShares
    /// @param orderId The order whose pending mint to clear
    function clearPendingMint(uint256 orderId) external;

    /// @notice Refund a failed/expired buy order — returns escrowed USDC to user
    /// @dev Emergency escape hatch for permanently unfillable orders
    /// @param orderId The cross-chain order ID
    /// @param blsSignature Aggregated BLS signature
    /// @param referenceNonce BLSVerifier snapshot nonce
    /// @param signersBitmask Bitmask of signing oracles
    function refundBuyOrder(
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Emitted when a buy order is refunded (USDC returned to user)
    event BuyOrderRefunded(uint256 indexed orderId, address indexed user, uint256 usdcAmount);

    // ============ VIEW FUNCTIONS ============

    /// @notice Check if a nonce has been used (release completed)
    /// @param sourceChainId Source chain ID
    /// @param nonce The nonce to check
    /// @return Whether this nonce has been released
    function isNonceUsed(uint256 sourceChainId, uint256 nonce) external view returns (bool);

    /// @notice Get the L3 Investment contract address
    /// @return The address of the Investment contract on L3
    function l3IndexContract() external view returns (address);

    /// @notice Get the next order ID to be assigned
    /// @return The current order ID counter
    function currentOrderId() external view returns (uint256);

    /// @notice Get cross-chain order details
    /// @param orderId The order ID to query
    /// @return order The cross-chain order struct
    function getCrossChainOrder(uint256 orderId) external view returns (TypesLib.CrossChainOrder memory order);

    // ============ EVENTS ============

    /// @notice Emitted when a bridge transfer is completed (funds released)
    /// @param sourceChainId Chain where funds were locked
    /// @param amount Amount released (18 decimals)
    /// @param nonce Nonce from source chain
    event BridgeCompleted(uint256 indexed sourceChainId, uint256 amount, uint256 nonce);

    /// @notice Emitted when a cross-chain ITP purchase order is created
    /// @param orderId The order ID that will be processed on L3
    /// @param itpId The ITP being purchased
    /// @param user The user who initiated the purchase
    /// @param amount USDC amount spent
    event CrossChainOrderCreated(
        uint256 indexed orderId,
        bytes32 indexed itpId,
        address indexed user,
        uint256 amount
    );

    // ============ CROSS-CHAIN SELL ============

    /// @notice Sell ITP tokens from Settlement (cross-chain sell)
    /// @dev Escrows BridgedITP tokens, signals oracles to sell on L3
    /// @param itpId The ITP to sell
    /// @param amount Amount of BridgedITP tokens to sell (18 decimals)
    /// @param limitPrice Minimum price per ITP token (18 decimals)
    /// @param slippageTier Tolerance: 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%)
    /// @param deadline Unix timestamp - order expires after this
    /// @return orderId The sell order ID
    function sellITPFromSettlement(
        bytes32 itpId,
        uint256 amount,
        uint256 limitPrice,
        uint256 slippageTier,
        uint256 deadline
    ) external returns (uint256 orderId);

    /// @notice Complete a sell order after L3 execution
    /// @dev Called by oracles after selling on L3. Pulls USDC from vault directly to user.
    /// @param orderId The sell order ID
    /// @param usdcProceeds USDC proceeds to send to user (6 decimals)
    /// @param vault Source vault address to pull USDC from
    /// @param blsSignature Aggregated BLS signature
    function completeSellOrder(
        uint256 orderId,
        uint256 usdcProceeds,
        address vault,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Refund a failed/expired sell order
    /// @dev Returns escrowed BridgedITP tokens to user
    /// @param orderId The sell order ID
    /// @param blsSignature Aggregated BLS signature
    function refundSellOrder(
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Get the BridgeProxy address
    /// @return The BridgeProxy contract address
    function bridgeProxy() external view returns (IBridgeProxy);

    /// @notice Get cross-chain sell order details
    /// @param orderId The sell order ID to query
    /// @return order The cross-chain sell order struct
    function getCrossChainSellOrder(uint256 orderId) external view returns (TypesLib.CrossChainSellOrder memory order);

    /// @notice Burn escrowed BridgedITP for a sell order — MUST be called before L3 confirmFills
    /// @dev This is the sell-side gate: BridgedITP destroyed before L3 shares burned.
    /// @param orderId The sell order ID
    /// @param blsSignature Aggregated BLS signature
    function burnSellOrderShares(
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Atomic recovery: re-mint BridgedITP to user after permanently failed sell
    /// @dev One-shot: mints to user + deletes order. No intermediate state, no replay.
    /// @param orderId The sell order ID
    /// @param blsSignature Aggregated BLS signature
    function remintAndRefundFailedSell(
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Emitted when a cross-chain sell order is created
    /// @param orderId The sell order ID
    /// @param itpId The ITP being sold
    /// @param user The user who initiated the sell
    /// @param bridgedItpAddress The BridgedITP token address
    /// @param amount Amount of BridgedITP escrowed
    /// @param limitPrice User's minimum acceptable price per ITP token
    event CrossChainSellOrderCreated(
        uint256 indexed orderId,
        bytes32 indexed itpId,
        address indexed user,
        address bridgedItpAddress,
        uint256 amount,
        uint256 limitPrice
    );

    /// @notice Emitted when sell order BridgedITP shares are burned (gate passed)
    /// @param orderId The sell order ID
    /// @param itpId The ITP identifier
    /// @param amount Amount of BridgedITP burned
    event SellOrderSharesBurned(uint256 indexed orderId, bytes32 indexed itpId, uint256 amount);

    /// @notice Emitted when a sell order is completed
    /// @param orderId The sell order ID
    /// @param usdcProceeds USDC proceeds sent to user
    event SellOrderCompleted(uint256 indexed orderId, uint256 usdcProceeds);

    /// @notice Emitted when a sell order is refunded
    /// @param orderId The sell order ID
    event SellOrderRefunded(uint256 indexed orderId);

    /// @notice Emitted when a failed sell order is recovered via remint
    /// @param orderId The sell order ID
    /// @param itpId The ITP identifier
    /// @param amount Amount of BridgedITP reminted to user
    event SellOrderReminted(uint256 indexed orderId, bytes32 indexed itpId, uint256 amount);

    /// @notice Emitted when BridgedITP burn fails during sell order completion
    /// @param orderId The sell order ID
    /// @param itpId The ITP identifier
    /// @param amount Amount that failed to burn
    event BurnFailed(uint256 indexed orderId, bytes32 indexed itpId, uint256 amount);

    // ============ VISION DEPOSIT/WITHDRAW ============

    /// @notice Deposit USDC for Vision on L3 (locks on Settlement, credited on L3)
    /// @param usdcAmount Amount of USDC in 6 decimals
    /// @return orderId The unique order ID for this deposit
    function depositToVision(uint256 usdcAmount) external returns (uint256 orderId);

    /// @notice Mark a Vision deposit as completed (oracles call after L3 credit confirmed)
    /// @param orderId The deposit order ID
    /// @param blsSignature Aggregated BLS signature
    /// @param referenceNonce BLSVerifier snapshot nonce
    /// @param signersBitmask Bitmask of signing oracles
    function completeVisionDeposit(
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Refund a failed Vision deposit (oracles call if L3 credit fails)
    /// @param orderId The deposit order ID
    /// @param blsSignature Aggregated BLS signature
    /// @param referenceNonce BLSVerifier snapshot nonce
    /// @param signersBitmask Bitmask of signing oracles
    function refundVisionDeposit(
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Release USDC to user after Vision.withdrawToSettlement on L3
    /// @dev Sends USDC to `user`, NOT to msg.sender. Has replay protection.
    /// @param withdrawId The withdraw ID from Vision.sol
    /// @param user User address to receive USDC
    /// @param amount Amount in 18 decimals (internal format)
    /// @param blsSignature Aggregated BLS signature
    /// @param referenceNonce BLSVerifier snapshot nonce
    /// @param signersBitmask Bitmask of signing oracles
    function completeVisionWithdraw(
        uint256 withdrawId,
        address user,
        uint256 amount,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    /// @notice Get a Vision deposit by order ID
    function getVisionDeposit(uint256 orderId) external view returns (address user, uint256 amount, uint256 createdAt);

    /// @notice Whether a Vision withdraw has been processed
    function withdrawProcessed(uint256 withdrawId) external view returns (bool);

    /// @notice USDC reserve tracker for Vision pool
    function visionReserve() external view returns (uint256);

    // ============ VISION EVENTS ============

    /// @notice Emitted when a Vision deposit is created (USDC locked on Settlement)
    event VisionDepositCreated(uint256 indexed orderId, address indexed user, uint256 amount);

    /// @notice Emitted when a Vision deposit is completed (L3 credit confirmed)
    event VisionDepositCompleted(uint256 indexed orderId);

    /// @notice Emitted when a Vision deposit is refunded (L3 credit failed)
    event VisionDepositRefunded(uint256 indexed orderId, address indexed user, uint256 usdcAmount);

    /// @notice Emitted when a Vision withdrawal is completed (USDC sent to user on Settlement)
    event VisionWithdrawCompleted(uint256 indexed withdrawId, address indexed user, uint256 usdcAmount);
}

/// @title IBridge - Combined bridge interface for convenience
/// @notice Aggregates both L3 and Settlement bridge custody interfaces
/// @dev Implementations should inherit from both IL3BridgeCustody and ISettlementBridgeCustody as needed
interface IBridge is IL3BridgeCustody, ISettlementBridgeCustody {}
