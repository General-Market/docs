// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ErrorsLib
/// @notice Standardized error codes for Index L3 protocol (E001-E010)
/// @dev All errors prefixed with E00X for easy identification and grep/search
/// @dev Custom errors save ~2,500 gas vs require strings per revert
/// @custom:security-contact security@indexprotocol.com
library ErrorsLib {
    /// @notice E001: Order amount below minimum threshold
    /// @dev Minimum order amount is 0.001 USDC (1e15 wei with 18 decimals)
    /// @param amount The submitted order amount
    /// @param minimum The required minimum (0.001 USDC = 1e15 wei)
    error E001_OrderBelowMin(uint256 amount, uint256 minimum);

    /// @notice E002: User has insufficient balance to complete order
    /// @dev Check user's USDC balance before order submission
    /// @param user The user address attempting the order
    /// @param required The amount required for the order
    /// @param available The user's current available balance
    error E002_InsufficientBalance(address user, uint256 required, uint256 available);

    /// @notice E003: The specified ITP is currently paused
    /// @dev ITP can be paused by governance for maintenance or emergency
    /// @param itpId The bytes32 identifier of the paused ITP
    error E003_ITPPaused(bytes32 itpId);

    /// @notice E004: System is in emergency pause mode
    /// @dev Global emergency pause affects all operations across all ITPs
    error E004_SystemPaused();

    /// @notice E006: The specified ITP identifier does not exist
    /// @dev ITP must be registered before orders can be placed
    /// @param itpId The bytes32 identifier that was not found
    error E006_ITPNotFound(bytes32 itpId);

    /// @notice E007: Asset in this ITP is being delisted
    /// @dev No new orders accepted for assets in delisting process
    /// @param asset The address of the asset being delisted
    error E007_AssetDelisting(address asset);

    /// @notice E008: Liquidity source is currently unavailable
    /// @dev External liquidity source (AP, DEX) is offline or unreachable
    /// @param sourceId The identifier of the unavailable source
    error E008_SourceUnavailable(bytes32 sourceId);

    /// @notice E009: Order has expired past its deadline
    /// @dev Orders auto-cancel after 1 hour (default deadline), user receives full refund
    /// @param orderId The unique identifier of the expired order
    /// @param deadline The order's expiration timestamp
    /// @param currentTime The current block timestamp
    error E009_OrderExpired(uint256 orderId, uint256 deadline, uint256 currentTime);

    /// @notice E010: Order was only partially filled
    /// @dev Remainder is automatically refunded to user
    /// @param orderId The unique identifier of the partially filled order
    /// @param requested The original requested amount
    /// @param filled The actual filled amount
    error E010_FillIncomplete(uint256 orderId, uint256 requested, uint256 filled);

    /// @notice E011: Invalid slippage tier specified
    /// @dev Valid slippage tiers are 0 (0.3%), 1 (1%), or 2 (3%)
    /// @param tier The invalid tier that was submitted
    error E011_InvalidSlippageTier(uint256 tier);

    /// @notice E012: Order deadline is invalid
    /// @dev Deadline must be in the future and within 24 hours
    /// @param deadline The submitted deadline timestamp
    /// @param currentTime The current block timestamp
    /// @param maxDuration The maximum allowed duration (24 hours)
    error E012_InvalidDeadline(uint256 deadline, uint256 currentTime, uint256 maxDuration);

    /// @notice E013: ITP weight below minimum threshold
    /// @dev Minimum weight per asset is 0.25% (2.5e15 with 18 decimals)
    /// @param weight The submitted weight
    /// @param minimum The required minimum weight
    error E013_WeightBelowMinimum(uint256 weight, uint256 minimum);

    /// @notice E014: ITP weights do not sum to 100%
    /// @dev Weights must sum to exactly 1e18 (100%)
    /// @param actual The actual sum of weights
    /// @param expected The expected sum (1e18)
    error E014_InvalidWeightSum(uint256 actual, uint256 expected);

    /// @notice E015: ITP assets and weights arrays have different lengths
    /// @param assetsLength Length of assets array
    /// @param weightsLength Length of weights array
    error E015_LengthMismatch(uint256 assetsLength, uint256 weightsLength);

    /// @notice E016: ITP must have at least one asset
    error E016_NoAssets();

    /// @notice E017: Duplicate asset in ITP creation
    /// @param asset The duplicate asset address
    error E017_DuplicateAsset(address asset);

    /// @notice E018: Zero address not allowed for asset
    error E018_ZeroAssetAddress();

    /// @notice E051: ITP has too many assets
    /// @param count Number of assets provided
    /// @param maximum Maximum allowed assets
    error E051_TooManyAssets(uint256 count, uint256 maximum);

    // ============ BATCH & FILL ERRORS (Story 2.4) ============

    /// @notice E019: Cycle has already been processed
    /// @param cycleNumber The cycle that was already processed
    error E019_CycleAlreadyProcessed(uint256 cycleNumber);

    /// @notice E020: Invalid BLS signature
    error E020_InvalidBLSSignature();

    /// @notice E021: Order already batched or processed
    /// @param orderId The order ID that was already batched
    error E021_OrderAlreadyBatched(uint256 orderId);

    /// @notice E022: Order not found
    /// @param orderId The order ID that was not found
    error E022_OrderNotFound(uint256 orderId);

    /// @notice E023: Fill amount exceeds order amount
    /// @param orderId The order ID
    /// @param fillAmount The fill amount attempted
    /// @param orderAmount The original order amount
    error E023_FillExceedsOrder(uint256 orderId, uint256 fillAmount, uint256 orderAmount);

    /// @notice E024: Order not in correct status for this operation
    /// @param orderId The order ID
    /// @param currentStatus The current order status
    /// @param requiredStatus The required order status
    error E024_InvalidOrderStatus(uint256 orderId, uint256 currentStatus, uint256 requiredStatus);

    // ============ BLS CUSTODY ERRORS (Story 2.7) ============

    /// @notice E025: Nonce already used
    /// @param nonce The nonce that was already used
    error E025_NonceAlreadyUsed(uint256 nonce);

    /// @notice E026: Target not whitelisted
    /// @param target The target address that is not whitelisted
    error E026_TargetNotWhitelisted(address target);

    /// @notice E027: Execution call failed
    /// @param target The target address
    /// @param data The calldata that failed
    error E027_ExecutionFailed(address target, bytes data);

    // ============ WHITELIST ERRORS (Story 2.8) ============

    /// @notice E028: Whitelist already proposed
    /// @param target The target that was already proposed
    error E028_WhitelistAlreadyProposed(address target);

    /// @notice E029: Whitelist not proposed
    /// @param target The target that was not proposed
    error E029_WhitelistNotProposed(address target);

    /// @notice E030: Timelock not expired
    /// @param target The target address
    /// @param unlockTime When the timelock expires
    /// @param currentTime Current block timestamp
    error E030_TimelockNotExpired(address target, uint256 unlockTime, uint256 currentTime);

    /// @notice E031: Target already whitelisted
    /// @param target The target that is already whitelisted
    error E031_TargetAlreadyWhitelisted(address target);

    /// @notice E032: Target not currently whitelisted
    /// @param target The target that is not whitelisted
    error E032_TargetNotCurrentlyWhitelisted(address target);

    /// @notice E034: Order has not yet expired (deadline still in future)
    /// @param orderId The order ID
    /// @param deadline The order's deadline timestamp
    /// @param currentTime Current block timestamp
    error E034_OrderNotYetExpired(uint256 orderId, uint256 deadline, uint256 currentTime);

    /// @notice E035: IssuerRegistry not configured (required for production)
    /// @dev In production, issuerRegistry must be set for BLS verification
    error E035_IssuerRegistryNotSet();

    // ============ UPGRADE ERRORS (Story 2.7 Code Review) ============

    /// @notice E038: Zero address not allowed for implementation
    error E038_ZeroImplementation();

    /// @notice E039: Upgrade already pending
    error E039_UpgradeAlreadyPending();

    /// @notice E040: No pending upgrade
    error E040_NoPendingUpgrade();

    /// @notice E041: Implementation address mismatch
    /// @param expected Expected implementation address
    /// @param actual Actual implementation address
    error E041_ImplementationMismatch(address expected, address actual);

    /// @notice E042: Upgrade timelock not expired
    /// @param unlockTime When the timelock expires
    /// @param currentTime Current block timestamp
    error E042_UpgradeTimelockActive(uint256 unlockTime, uint256 currentTime);

    /// @notice E043: Zero address not allowed for issuer registry
    error E043_ZeroIssuerRegistry();

    /// @notice E044: Cannot use emergency upgrade when standard upgrade pending
    error E044_StandardUpgradePending();

    /// @notice E036: Fill cycle number mismatch
    /// @param fillCycleNumber Cycle number in the fill struct
    /// @param expectedCycleNumber Cycle number passed to function
    error E036_FillCycleMismatch(uint256 fillCycleNumber, uint256 expectedCycleNumber);

    /// @notice E037: Shares calculation resulted in zero
    /// @param fillAmount The fill amount
    /// @param fillPrice The fill price
    error E037_ZeroSharesCalculated(uint256 fillAmount, uint256 fillPrice);

    // ============ L3 BRIDGE CUSTODY ERRORS (Story 2.9) ============

    /// @notice E045: Lock already released (note: E045_TooManyAssets exists, using E055)
    /// @param nonce The nonce of the lock
    error E045_LockAlreadyReleased(uint256 nonce);

    /// @notice E046: Lock already reversed
    /// @param nonce The nonce of the lock
    error E046_LockAlreadyReversed(uint256 nonce);

    /// @notice E047: Lock timeout not reached yet
    /// @param nonce The nonce of the lock
    /// @param lockedAt Timestamp when lock was created
    /// @param currentTime Current block timestamp
    error E047_LockTimeoutNotReached(uint256 nonce, uint256 lockedAt, uint256 currentTime);

    /// @notice E048: Insufficient signer count for emergency operation
    /// @param provided Number of signers provided
    /// @param required Minimum required signers
    error E048_InsufficientSignerCount(uint256 provided, uint256 required);

    /// @notice E049: Lock not found (nonce doesn't exist)
    /// @param nonce The nonce that was not found
    error E049_LockNotFound(uint256 nonce);

    /// @notice E050: Zero address for USDC
    error E050_ZeroUSDCAddress();

    /// @notice E052: Zero amount not allowed for bridge
    error E052_ZeroAmount();

    /// @notice E053: Invalid destination chain ID
    /// @param destChainId The invalid chain ID
    error E053_InvalidDestChainId(uint256 destChainId);

    // ============ ARB BRIDGE CUSTODY ERRORS (Story 2.10) ============

    /// @notice E054: Bridge already completed for this source chain + nonce
    /// @param sourceChainId Source chain ID
    /// @param nonce Nonce that was already completed
    error E054_BridgeAlreadyCompleted(uint256 sourceChainId, uint256 nonce);

    /// @notice E055: Invalid source chain ID (zero or same as current)
    /// @param sourceChainId The invalid chain ID
    error E055_InvalidSourceChainId(uint256 sourceChainId);

    /// @notice E056: Zero address for L3 Investment contract
    error E056_ZeroL3IndexAddress();

    /// @notice E057: Invalid proof (zero values not allowed)
    error E057_InvalidProof();

    /// @notice E058: Invalid deadline for cross-chain order
    /// @param deadline The provided deadline
    /// @param minDeadline Minimum allowed deadline
    /// @param maxDeadline Maximum allowed deadline
    error E058_InvalidDeadline(uint256 deadline, uint256 minDeadline, uint256 maxDeadline);

    /// @notice E059: Zero amount for cross-chain order
    error E059_CrossChainOrderZeroAmount();

    /// @notice E060: Zero ITP ID for cross-chain order
    error E060_ZeroITPId();

    // ============ ERROR HANDLING AUDIT ADDITIONS (Story 6.15) ============

    /// @notice E061: Caller is not authorized (admin-only function)
    /// @param caller The unauthorized caller address
    /// @param requiredRole The required role (e.g., admin address)
    error E061_Unauthorized(address caller, address requiredRole);

    /// @notice E062: Contract or field already initialized
    error E062_AlreadyInitialized();

    /// @notice E063: External call to mint ITP tokens failed
    /// @param vault The vault address that failed
    /// @param itpId The ITP identifier
    error E063_MintFailed(address vault, bytes32 itpId);

    /// @notice E064: String exceeds maximum bytes32 length
    /// @param length The actual string length
    /// @param maximum The maximum allowed length (32)
    error E064_StringTooLong(uint256 length, uint256 maximum);

    // ============ REBALANCE ERRORS (Story 6.11) ============

    /// @notice E065: Caller is not the ITP creator (required for proposeRebalance)
    /// @param caller The unauthorized caller
    /// @param creator The ITP creator address
    error E065_NotITPCreator(address caller, address creator);

    /// @notice E066: ITP is not active (required for rebalance)
    /// @param itpId The ITP identifier
    /// @param status Current ITP status
    error E066_ITPNotActive(bytes32 itpId, uint256 status);

    /// @notice E067: A pending rebalance already exists for this ITP
    /// @param itpId The ITP identifier
    error E067_RebalanceAlreadyPending(bytes32 itpId);

    /// @notice E068: No active pending rebalance for this ITP
    /// @param itpId The ITP identifier
    error E068_NoActiveRebalance(bytes32 itpId);

    /// @notice E069: Weights mismatch with pending rebalance target
    /// @param itpId The ITP identifier
    error E069_WeightsMismatch(bytes32 itpId);

    // ============ BRIDGE PROXY ERRORS (Story 6.21) ============

    /// @notice E070: ITP creation request has already been completed
    /// @param nonce The request nonce
    error E070_AlreadyCompleted(uint256 nonce);

    /// @notice E071: BLS signature verification failed
    error E071_InvalidBLSSignature();

    /// @notice E072: No pending creation request found for nonce
    /// @param nonce The request nonce
    error E072_CreationNotFound(uint256 nonce);

    /// @notice E073: Weights do not sum to 1e18 (100%)
    /// @param actual The actual sum of weights
    /// @param expected The expected sum (1e18)
    error E073_InvalidWeightsSum(uint256 actual, uint256 expected);

    /// @notice E074: Weight below minimum threshold (0.25%)
    /// @param index The index of the asset with invalid weight
    /// @param weight The invalid weight value
    /// @param minimum The minimum allowed weight (2.5e15)
    error E074_WeightBelowMinimum(uint256 index, uint256 weight, uint256 minimum);

    /// @notice E075: Weights and assets arrays have different lengths
    /// @param weightsLength Length of weights array
    /// @param assetsLength Length of assets array
    error E075_BridgeLengthMismatch(uint256 weightsLength, uint256 assetsLength);

    /// @notice E076: No assets provided in ITP creation request
    error E076_NoAssets();

    /// @notice E077: Too many assets in ITP creation request (max 50)
    /// @param count Number of assets provided
    /// @param maximum Maximum allowed (50)
    error E077_TooManyAssets(uint256 count, uint256 maximum);

    /// @notice E078: Duplicate asset address in ITP creation request
    /// @param asset The duplicate asset address
    error E078_DuplicateAsset(address asset);

    /// @notice E079: Zero address not allowed in assets array
    error E079_ZeroAddressAsset();

    /// @notice E07A: Name exceeds maximum length (32 bytes)
    /// @param length The actual length
    /// @param maximum The maximum allowed (32)
    error E07A_NameTooLong(uint256 length, uint256 maximum);

    /// @notice E07B: Symbol exceeds maximum length (10 bytes)
    /// @param length The actual length
    /// @param maximum The maximum allowed (10)
    error E07B_SymbolTooLong(uint256 length, uint256 maximum);

    /// @notice E07C: OrbitItpId already has a mapped BridgedITP
    /// @param orbitItpId The L3 ITP ID that is already mapped
    /// @param existingBridgedItp The existing BridgedITP address
    error E07C_OrbitItpAlreadyMapped(bytes32 orbitItpId, address existingBridgedItp);

    /// @notice E07D: Insufficient signers for threshold BLS verification
    /// @param provided Number of valid signers in bitmap
    /// @param required Minimum required signers
    error E07D_InsufficientSigners(uint256 provided, uint256 required);

    /// @notice E07E: Invalid aggregated pubkey length (must be 128 bytes for G2)
    /// @param length The actual length
    error E07E_InvalidAggregatedPubkeyLength(uint256 length);

    // ============ DECIMAL CONVERSION ERRORS (Story 7.6b) ============

    /// @notice E07F: USDC amount too small (must be at least 0.001 USDC = 1000 units in 6 decimals)
    /// @param amount The submitted amount in 6-decimal USDC
    /// @param minimum The minimum required (1000 = 0.001 USDC)
    error E07F_UsdcAmountTooSmall(uint256 amount, uint256 minimum);

    /// @notice E080: Invalid USDC decimals (expected 18 for L3, 6 for Arbitrum)
    /// @param actual The actual decimals
    /// @param expected The expected decimals
    error E080_InvalidUsdcDecimals(uint8 actual, uint8 expected);

    // ============ SELL ORDER ERRORS (Story 7.14) ============

    /// @notice E081: User has insufficient ITP shares for SELL order
    /// @param user The user address
    /// @param required The shares required
    /// @param available The user's current share balance
    error E081_InsufficientShares(address user, uint256 required, uint256 available);

    // ============ PRODUCTION HARDENING ERRORS (Story 7.16) ============

    /// @notice E082: Order amount below per-asset minimum buy amount
    /// @param amount The submitted order amount
    /// @param minimum The per-asset minimum buy amount
    error E082_BelowMinBuyAmount(uint256 amount, uint256 minimum);

    /// @notice E083: Order queue is full (too many pending orders)
    /// @param currentDepth Current number of pending orders
    /// @param maxDepth Maximum allowed pending orders
    error E083_QueueFull(uint256 currentDepth, uint256 maxDepth);

    /// @notice E084: BLS signature verification failed for price update
    error E084_InvalidBLSPriceSignature();

    /// @notice E085: Asset price is stale (timestamp too old)
    /// @param assetIdx The asset index
    /// @param priceAge Age of the price in seconds
    /// @param maxAge Maximum allowed age in seconds
    error E085_StalePrice(uint256 assetIdx, uint256 priceAge, uint256 maxAge);

    // ============ ARCHITECTURE GAP FIX ERRORS (Story 7.17) ============

    /// @notice E086: Invalid BLS signature for key rotation request
    error E086_InvalidRotationSignature();

    /// @notice E087: Invalid BLS signature for rotation approval
    error E087_InvalidApprovalSignature();

    /// @notice E088: Invalid BLS signature for IP update
    error E088_InvalidIpUpdateSignature();

    // ============ CODE REVIEW FIX ERRORS (Story 7.16 Review) ============

    /// @notice E089: Queue thresholds invalid (warning must be <= pause when pause > 0)
    /// @param warning The warning threshold
    /// @param pause The pause threshold
    error E089_InvalidQueueThresholds(uint256 warning, uint256 pause);

    // ============ MIRROR REGISTRY ERRORS (Story 8.2) ============

    /// @notice E090: Sync nonce is not greater than current
    /// @param provided The nonce provided in the sync call
    /// @param current The current registry nonce
    error E090_StaleNonce(uint256 provided, uint256 current);

    /// @notice E091: Aggregated pubkey has invalid length (must be 128 bytes for G2)
    error E091_InvalidAggPubkey();

    /// @notice E092: Admin address cannot be zero
    error E092_ZeroAdmin();

    /// @notice E093: Invalid threshold configuration (must be > 0 and <= activeCount)
    /// @param threshold The threshold provided
    /// @param activeCount The activeCount provided
    error E093_InvalidThreshold(uint256 threshold, uint256 activeCount);

    // ============ NAV ORACLE ERRORS (Story 8.6) ============

    /// @notice E094: Cycle number is stale (must be greater than last processed)
    /// @param provided The cycle number provided
    /// @param current The current (last processed) cycle number
    error E094_StaleCycleNumber(uint256 provided, uint256 current);

    /// @notice E095: Oracle price cannot be zero
    error E095_InvalidOraclePrice();

    /// @notice E096: Oracle price is stale (exceeds MAX_STALENESS)
    /// @param lastUpdated Timestamp of last price update
    /// @param maxStaleness Maximum allowed staleness in seconds
    error E096_StaleOraclePrice(uint256 lastUpdated, uint256 maxStaleness);

    /// @notice E097: Caller is not a registered active issuer
    /// @param caller The unauthorized caller address
    error E097_NotActiveIssuer(address caller);

    /// @notice E098: Beneficiary address cannot be zero
    error E098_ZeroBeneficiary();

    // ============ CROSS-CHAIN REBALANCE ERRORS ============

    /// @notice E099: ITP not found in bridge deployer tracking
    /// @param itpId The ITP that was not found
    error E099_BridgeItpNotFound(bytes32 itpId);

    /// @notice E100: Caller is not the ITP deployer on the bridge
    /// @param itpId The ITP identifier
    /// @param caller The actual caller
    /// @param deployer The expected deployer
    error E100_NotBridgeDeployer(bytes32 itpId, address caller, address deployer);

    /// @notice E101: Rebalance request has empty weights array
    error E101_EmptyRebalanceWeights();

    /// @notice E102: Rebalance weight below minimum (0.25%)
    /// @param index The weight index
    /// @param weight The invalid weight value
    error E102_RebalanceWeightTooLow(uint256 index, uint256 weight);

    /// @notice E103: Rebalance weights do not sum to 1e18
    /// @param totalWeight The actual sum
    error E103_RebalanceWeightsSumInvalid(uint256 totalWeight);

    /// @notice E104: Rebalance request not found for nonce
    /// @param nonce The missing nonce
    error E104_RebalanceNotFound(uint256 nonce);

    /// @notice E105: Rebalance request already completed
    /// @param nonce The already-completed nonce
    error E105_RebalanceAlreadyCompleted(uint256 nonce);

    /// @notice E106: Zero address not allowed
    error E106_ZeroAddressNotAllowed();

    /// @notice E107: Caller is not the authorized bridge
    /// @param caller The actual caller
    /// @param bridge The authorized bridge
    error E107_NotAuthorizedBridge(address caller, address bridge);

    /// @notice E108: Rebalance weights length mismatch with ITP assets
    /// @param expected Expected length (number of assets)
    /// @param actual Actual length provided
    error E108_RebalanceWeightsLengthMismatch(uint256 expected, uint256 actual);

    // ============ REBALANCE V2 ERRORS (Asset Changes) ============

    /// @notice E109: Remove indices must be sorted in descending order
    error E109_RemoveIndicesNotDescending();

    /// @notice E110: Remove index out of bounds for current asset list
    /// @param index The invalid index
    /// @param assetCount Current number of assets
    error E110_RemoveIndexOutOfBounds(uint256 index, uint256 assetCount);

    /// @notice E111: New weights length does not match final asset count after removals/additions
    /// @param expected Expected length (assets - removals + additions)
    /// @param actual Actual length provided
    error E111_FinalAssetCountMismatch(uint256 expected, uint256 actual);

    /// @notice E112: Prices array length does not match new weights length
    /// @param weightsLen Length of weights array
    /// @param pricesLen Length of prices array
    error E112_PricesLengthMismatch(uint256 weightsLen, uint256 pricesLen);

    /// @notice E113: Price cannot be zero for NAV/inventory computation
    /// @param index The index with zero price
    error E113_ZeroPriceInRebalance(uint256 index);

    /// @notice E114: Duplicate asset in add list or already exists in ITP
    /// @param asset The duplicate asset address
    error E114_DuplicateAssetInRebalance(address asset);

    /// @notice E115: ITP must have at least one asset after rebalance
    error E115_RebalanceResultsInNoAssets();

    // ============ CROSS-CHAIN SELL ERRORS ============

    /// @notice E116: BridgedITP address not found for this ITP ID
    /// @param itpId The ITP ID that has no mapped BridgedITP
    error E116_BridgedItpNotFound(bytes32 itpId);

    /// @notice E117: Zero amount for cross-chain sell order
    error E117_CrossChainSellZeroAmount();

    /// @notice E118: Zero address for BridgeProxy
    error E118_ZeroBridgeProxy();

    /// @notice E119: Sell order not found
    /// @param orderId The order ID that was not found
    error E119_SellOrderNotFound(uint256 orderId);

    /// @notice E120: Sell order already completed or refunded
    /// @param orderId The order ID that was already processed
    error E120_SellOrderAlreadyCompleted(uint256 orderId);

    // ============ ITP METADATA ERRORS ============

    /// @notice E121: ITP description exceeds maximum length
    /// @param length The actual length
    /// @param maxLength The maximum allowed length (280)
    error E121_DescriptionTooLong(uint256 length, uint256 maxLength);

    /// @notice E122: ITP website URL exceeds maximum length
    /// @param length The actual length
    /// @param maxLength The maximum allowed length (128)
    error E122_UrlTooLong(uint256 length, uint256 maxLength);

    /// @notice E123: ITP video URL exceeds maximum length
    /// @param length The actual length
    /// @param maxLength The maximum allowed length (256)
    error E123_VideoUrlTooLong(uint256 length, uint256 maxLength);

    /// @notice E124: Caller is not the deployer of this ITP
    /// @param itpId The ITP identifier
    /// @param caller The actual caller
    /// @param deployer The expected deployer
    error E124_NotItpDeployer(bytes32 itpId, address caller, address deployer);

    /// @notice E125: Buy order not found (orderId has no cross-chain order)
    /// @param orderId The order ID that was not found
    error E125_BuyOrderNotFound(uint256 orderId);

    // ============ LIMIT PRICE ENFORCEMENT ERRORS ============

    /// @notice E126: Fill price violates order limit price
    /// @param orderId The order that was violated
    /// @param fillPrice The price in the fill
    /// @param limitPrice The limit price on the order
    /// @param side 0=BUY (fill too high), 1=SELL (fill too low)
    error E126_FillPriceViolatesLimit(uint256 orderId, uint256 fillPrice, uint256 limitPrice, uint8 side);

    /// @notice E127: Deployer name exceeds maximum length
    /// @param length Actual length
    /// @param maxLength Maximum allowed length
    error E127_DeployerNameTooLong(uint256 length, uint256 maxLength);

    // ============ VISION (BILATERAL P2P) ERRORS (E200+) ============

    /// @notice E200: Insufficient available collateral for bet
    /// @param user The user address
    /// @param required Amount required
    /// @param available Amount available
    error E200_InsufficientCollateral(address user, uint256 required, uint256 available);

    /// @notice E201: Bet already exists with this ID
    /// @param betId The duplicate bet ID
    error E201_BetAlreadyExists(bytes32 betId);

    /// @notice E202: Invalid EIP-712 signature for bet commitment
    error E202_InvalidBetSignature();

    /// @notice E203: Bet not found
    /// @param betId The bet ID that was not found
    error E203_BetNotFound(bytes32 betId);

    /// @notice E204: Bet is not in Active status
    /// @param betId The bet ID
    /// @param status Current bet status
    error E204_BetNotActive(bytes32 betId, uint8 status);

    /// @notice E205: Bet deadline has not passed yet (required for settlement)
    /// @param betId The bet ID
    /// @param deadline The bet deadline
    /// @param currentTime Current timestamp
    error E205_DeadlineNotPassed(bytes32 betId, uint256 deadline, uint256 currentTime);

    /// @notice E206: Arbitration not requested for this bet
    /// @param betId The bet ID
    error E206_ArbitrationNotRequested(bytes32 betId);

    /// @notice E207: Insufficient valid keeper signatures for arbitration threshold
    /// @param validCount Number of valid signatures
    /// @param required Required threshold
    error E207_InsufficientKeeperSignatures(uint256 validCount, uint256 required);

    /// @notice E208: Caller is not a party to this bet
    /// @param betId The bet ID
    /// @param caller The unauthorized caller
    error E208_NotBetParty(bytes32 betId, address caller);

    /// @notice E209: Custom payout amounts exceed total pot
    /// @param creatorPayout Payout to creator
    /// @param fillerPayout Payout to filler
    /// @param totalPot Total collateral in bet
    error E209_PayoutExceedsPot(uint256 creatorPayout, uint256 fillerPayout, uint256 totalPot);

    /// @notice E210: Bot already registered
    /// @param bot The bot address
    error E210_BotAlreadyRegistered(address bot);

    /// @notice E211: Bot not registered or inactive
    /// @param bot The bot address
    error E211_BotNotActive(address bot);

    /// @notice E212: Insufficient stake for bot registration
    /// @param provided Amount provided
    /// @param required Minimum required
    error E212_InsufficientBotStake(uint256 provided, uint256 required);

    /// @notice E213: Keeper already registered
    /// @param keeper The keeper address
    error E213_KeeperAlreadyRegistered(address keeper);

    /// @notice E214: Invalid BLS public key length (must be 128 bytes for G2)
    error E214_InvalidKeeperPubkey();

    /// @notice E215: Keeper not found or inactive
    /// @param keeper The keeper address
    error E215_KeeperNotActive(address keeper);

    /// @notice E216: Keeper is suspended
    /// @param keeper The keeper address
    error E216_KeeperSuspended(address keeper);

    /// @notice E217: No pending key rotation for this keeper
    /// @param keeper The keeper address
    error E217_NoRotationPending(address keeper);

    /// @notice E218: Key rotation threshold not met
    /// @param approvals Current approvals
    /// @param required Required approvals
    error E218_RotationThresholdNotMet(uint256 approvals, uint256 required);

    /// @notice E219: Cannot approve own key rotation
    /// @param keeper The keeper trying to self-approve
    error E219_CannotSelfApprove(address keeper);

    /// @notice E220: Key rotation already approved by this keeper
    /// @param keeper The keeper that already approved
    error E220_AlreadyApproved(address keeper);

    /// @notice E221: Force rotation timeout not reached
    /// @param requestedAt When rotation was requested
    /// @param timeoutAt When force rotation becomes available
    error E221_ForceRotationTooEarly(uint256 requestedAt, uint256 timeoutAt);

    /// @notice E222: Invalid endpoint (empty string)
    error E222_InvalidEndpoint();

    /// @notice E223: Referral epoch already has a Merkle root
    /// @param epoch The epoch number
    error E223_EpochAlreadySet(uint256 epoch);

    /// @notice E224: Referral already claimed for this epoch
    /// @param epoch The epoch number
    /// @param claimer The address that already claimed
    error E224_AlreadyClaimed(uint256 epoch, address claimer);

    /// @notice E225: Invalid Merkle proof for referral claim
    error E225_InvalidMerkleProof();

    /// @notice E226: Withdraw amount exceeds available balance
    /// @param requested Amount requested
    /// @param available Amount available
    error E226_InsufficientBalance(uint256 requested, uint256 available);

    // ============ SECURITY AUDIT FIXES ============

    /// @notice E128: Cycle has not been confirmed yet
    /// @param cycleNumber The cycle that hasn't been confirmed
    error E128_CycleNotConfirmed(uint256 cycleNumber);

    /// @notice E129: Caller is not the order owner
    /// @param caller The actual caller
    /// @param owner The order owner
    error E129_NotOrderOwner(address caller, address owner);

    /// @notice E130: Batched timeout has not been reached
    /// @param orderId The order ID
    /// @param batchedAt Timestamp when order was batched
    /// @param currentTime Current block timestamp
    error E130_BatchedTimeoutNotReached(uint256 orderId, uint256 batchedAt, uint256 currentTime);
}
