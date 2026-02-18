// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IAssetPairRegistry - Global asset and trading pair whitelist interface
/// @notice Manages which assets and trading pairs can be used in ITP creation and trading
/// @dev All modifications require BLS signature from issuer consensus (11/20 standard, 15/20 emergency)
/// @dev Pairs are identified by pairId = keccak256(asset, source, quoteToken, chainId)
interface IAssetPairRegistry {
    // ============ ASSET MANAGEMENT ============

    /// @notice Propose a new asset for whitelisting with BLS signature
    /// @dev Requires 11/20 issuer threshold. Asset enters PENDING status with 2-day timelock.
    /// @dev Message format: keccak256(abi.encode("PROPOSE_ASSET", chainid, this, asset, nonce))
    /// @param asset The asset address to propose
    /// @param blsSignature Aggregated BLS signature from 11/20 issuers
    function proposeAsset(address asset, bytes calldata blsSignature) external;

    /// @notice Activate a pending asset after timelock period
    /// @dev Anyone can call after 2-day timelock has passed. Asset moves from PENDING to ACTIVE.
    /// @param asset The asset address to activate
    function activateAsset(address asset) external;

    /// @notice Delist an active asset (marks as DELISTING, not immediate removal)
    /// @dev Requires 11/20 issuer threshold. Affected ITPs should be identified for forced rebalance.
    /// @dev Message format: keccak256(abi.encode("DELIST_ASSET", chainid, this, asset, nonce))
    /// @param asset The asset address to delist
    /// @param blsSignature Aggregated BLS signature from 11/20 issuers
    function delistAsset(address asset, bytes calldata blsSignature) external;

    /// @notice Emergency removal of an asset (immediate, for security situations)
    /// @dev Requires 15/20 issuer threshold. Asset immediately becomes INACTIVE.
    /// @dev Message format: keccak256(abi.encode("EMERGENCY_REMOVE_ASSET", chainid, this, asset, nonce))
    /// @param asset The asset address to remove
    /// @param blsSignature Aggregated BLS signature from 15/20 issuers
    function emergencyRemoveAsset(address asset, bytes calldata blsSignature) external;

    // ============ PAIR MANAGEMENT ============

    /// @notice Propose a new trading pair for whitelisting
    /// @dev Requires 11/20 issuer threshold. Asset must be ACTIVE. Pair enters PENDING status with 2-day timelock.
    /// @dev Message format: keccak256(abi.encode("PROPOSE_PAIR", chainid, this, asset, source, quoteToken, chainId, nonce))
    /// @param asset The asset address for this pair
    /// @param source The trading source (e.g., keccak256("BITGET"), keccak256("1INCH"))
    /// @param quoteToken The quote token address (e.g., USDC)
    /// @param chainId The chain ID where this pair is traded (0 for CEX)
    /// @param blsSignature Aggregated BLS signature from 11/20 issuers
    function proposePair(
        address asset,
        bytes32 source,
        address quoteToken,
        uint256 chainId,
        bytes calldata blsSignature
    ) external;

    /// @notice Activate a pending pair after timelock period
    /// @dev Anyone can call after 2-day timelock has passed. Pair moves from PENDING to ACTIVE.
    /// @param pairId The pair identifier to activate
    function activatePair(bytes32 pairId) external;

    /// @notice Delist a trading pair (marks as DELISTED)
    /// @dev Requires 11/20 issuer threshold. Prevents new orders but existing orders can complete.
    /// @dev Message format: keccak256(abi.encode("DELIST_PAIR", chainid, this, pairId, nonce))
    /// @param pairId The pair identifier to delist
    /// @param blsSignature Aggregated BLS signature from 11/20 issuers
    function delistPair(bytes32 pairId, bytes calldata blsSignature) external;

    // ============ PROPOSAL CANCELLATION ============

    /// @notice Cancel a pending asset proposal during timelock period
    /// @dev Requires 11/20 issuer threshold. Resets asset to INACTIVE status.
    /// @dev Message format: keccak256(abi.encode("CANCEL_ASSET_PROPOSAL", chainid, this, asset, nonce))
    /// @param asset The asset address to cancel
    /// @param blsSignature Aggregated BLS signature from 11/20 issuers
    function cancelAssetProposal(address asset, bytes calldata blsSignature) external;

    /// @notice Cancel a pending pair proposal during timelock period
    /// @dev Requires 11/20 issuer threshold. Resets pair to INACTIVE status.
    /// @dev Message format: keccak256(abi.encode("CANCEL_PAIR_PROPOSAL", chainid, this, pairId, nonce))
    /// @param pairId The pair identifier to cancel
    /// @param blsSignature Aggregated BLS signature from 11/20 issuers
    function cancelPairProposal(bytes32 pairId, bytes calldata blsSignature) external;

    // ============ VIEW FUNCTIONS ============

    /// @notice Check if an asset is whitelisted (ACTIVE status)
    /// @param asset The asset address to check
    /// @return True if asset is ACTIVE
    function isAssetWhitelisted(address asset) external view returns (bool);

    /// @notice Check if an asset is in DELISTING status
    /// @param asset The asset address to check
    /// @return True if asset is DELISTING
    function isAssetDelisting(address asset) external view returns (bool);

    /// @notice Check if a trading pair is active
    /// @param pairId The pair identifier to check
    /// @return True if pair is ACTIVE
    function isPairActive(bytes32 pairId) external view returns (bool);

    /// @notice Get asset information
    /// @param asset The asset address
    /// @return assetAddr The asset address
    /// @return status The asset status (0=INACTIVE, 1=PENDING, 2=ACTIVE, 3=DELISTING)
    /// @return proposedAt When the asset was proposed (activation timestamp)
    /// @return activatedAt When the asset was activated
    function getAsset(address asset)
        external
        view
        returns (address assetAddr, uint8 status, uint256 proposedAt, uint256 activatedAt);

    /// @notice Get pair information
    /// @param pairId The pair identifier
    /// @return asset The asset address
    /// @return source The trading source
    /// @return quoteToken The quote token address
    /// @return chainId The chain ID
    /// @return status The pair status (0=INACTIVE, 1=PENDING, 2=ACTIVE, 3=DELISTED)
    /// @return proposedAt When the pair was proposed (activation timestamp)
    /// @return activatedAt When the pair was activated
    function getPair(bytes32 pairId)
        external
        view
        returns (
            address asset,
            bytes32 source,
            address quoteToken,
            uint256 chainId,
            uint8 status,
            uint256 proposedAt,
            uint256 activatedAt
        );

    /// @notice Get all active asset addresses
    /// @return Array of active asset addresses
    function getActiveAssets() external view returns (address[] memory);

    /// @notice Get all active pair IDs
    /// @return Array of active pair IDs
    function getActivePairs() external view returns (bytes32[] memory);

    /// @notice Get all pairs for a specific asset (includes all statuses)
    /// @param asset The asset address
    /// @return Array of pair IDs that use this asset
    function getPairsForAsset(address asset) external view returns (bytes32[] memory);

    /// @notice Get only active pairs for a specific asset
    /// @param asset The asset address
    /// @return Array of active pair IDs that use this asset
    function getActivePairsForAsset(address asset) external view returns (bytes32[] memory);

    /// @notice Compute pair ID from components
    /// @param asset The asset address
    /// @param source The trading source
    /// @param quoteToken The quote token address
    /// @param chainId The chain ID
    /// @return The computed pair ID
    function computePairId(address asset, bytes32 source, address quoteToken, uint256 chainId)
        external
        pure
        returns (bytes32);

    /// @notice Get current nonce for replay protection
    /// @return The current nonce value
    function getNonce() external view returns (uint256);

    // ============ ADMIN FUNCTIONS ============

    /// @notice Set the aggregated BLS public key for signature verification
    /// @param pubkey The new aggregated public key
    function setAggregatedPubkey(bytes calldata pubkey) external;

    /// @notice Transfer admin role to a new address
    /// @param newAdmin The new admin address
    function setAdmin(address newAdmin) external;

    // ============ ADMIN E2E TESTING FUNCTIONS ============
    // WARNING: These functions bypass BLS signatures and timelocks.
    // DO NOT use in production deployments.

    /// @notice Admin-only batch whitelist assets (bypasses BLS + timelock for E2E testing)
    /// @dev DO NOT use in production - only for local/testnet E2E testing
    /// @param assets Array of asset addresses to whitelist
    function adminBatchWhitelistAssets(address[] calldata assets) external;

    /// @notice Admin-only batch activate pairs (bypasses BLS + timelock for E2E testing)
    /// @dev DO NOT use in production - only for local/testnet E2E testing
    /// @param assetAddrs Array of asset addresses
    /// @param sources Array of trading sources (e.g., keccak256("BITGET"))
    /// @param quoteTokens Array of quote token addresses
    /// @param chainIds Array of chain IDs
    function adminBatchActivatePairs(
        address[] calldata assetAddrs,
        bytes32[] calldata sources,
        address[] calldata quoteTokens,
        uint256[] calldata chainIds
    ) external;

    // ============ EVENTS ============

    /// @notice Emitted when an asset is proposed for whitelisting
    /// @param asset The asset address
    /// @param proposer The address that proposed the asset
    /// @param activationTime The timestamp when the asset can be activated
    event AssetProposed(address indexed asset, address indexed proposer, uint256 activationTime);

    /// @notice Emitted when an asset is activated
    /// @param asset The asset address
    /// @param activator The address that activated the asset
    event AssetActivated(address indexed asset, address indexed activator);

    /// @notice Emitted when an asset is marked for delisting
    /// @param asset The asset address
    event AssetDelisting(address indexed asset);

    /// @notice Emitted when an asset is emergency removed
    /// @param asset The asset address
    event AssetEmergencyRemoved(address indexed asset);

    /// @notice Emitted when a pair is proposed for whitelisting
    /// @param pairId The pair identifier
    /// @param asset The asset address
    /// @param source The trading source
    /// @param quoteToken The quote token address
    /// @param chainId The chain ID
    /// @param proposer The address that proposed the pair
    /// @param activationTime The timestamp when the pair can be activated
    event PairProposed(
        bytes32 indexed pairId,
        address indexed asset,
        bytes32 source,
        address quoteToken,
        uint256 chainId,
        address indexed proposer,
        uint256 activationTime
    );

    /// @notice Emitted when a pair is activated
    /// @param pairId The pair identifier
    /// @param activator The address that activated the pair
    event PairActivated(bytes32 indexed pairId, address indexed activator);

    /// @notice Emitted when a pair is delisted
    /// @param pairId The pair identifier
    event PairDelisted(bytes32 indexed pairId);

    /// @notice Emitted when an asset proposal is cancelled
    /// @param asset The asset address
    event AssetProposalCancelled(address indexed asset);

    /// @notice Emitted when a pair proposal is cancelled
    /// @param pairId The pair identifier
    event PairProposalCancelled(bytes32 indexed pairId);

    /// @notice Emitted when admin is changed
    /// @param previousAdmin The previous admin address
    /// @param newAdmin The new admin address
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);

    /// @notice Emitted when aggregated pubkey is updated
    /// @param pubkey The new aggregated public key
    event AggregatedPubkeyUpdated(bytes pubkey);
}
