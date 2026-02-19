// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IAssetPairRegistry.sol";
import "../libraries/TypesLib.sol";
import "../libraries/BLSLib.sol";
import "../libraries/BLSVerifier.sol";

/// @title AssetPairRegistry - Global asset and trading pair whitelist
/// @notice Manages which assets and pairs can be used in ITPs
/// @dev All modifications require BLS signature from issuer consensus
contract AssetPairRegistry is IAssetPairRegistry, BLSVerifier {
    // ============ ERRORS ============

    /// @notice Caller is not authorized for this operation
    error Unauthorized();

    /// @notice Zero address not allowed
    error ZeroAddress();

    /// @notice BLS signature verification failed
    error InvalidBLSSignature();

    /// @notice Asset is not whitelisted (not ACTIVE)
    error AssetNotWhitelisted();

    /// @notice Asset already exists in registry
    error AssetAlreadyExists();

    /// @notice Pair already exists in registry
    error PairAlreadyExists();

    /// @notice Timelock period has not passed yet
    error TimelockNotPassed();

    /// @notice Asset is not in PENDING status
    error AssetNotPending();

    /// @notice Pair is not in PENDING status
    error PairNotPending();

    /// @notice Asset is not in ACTIVE status (for delisting)
    error AssetNotActive();

    /// @notice Pair is not in ACTIVE status (for delisting)
    error PairNotActive();

    /// @notice Pair does not exist
    error PairNotFound();

    // ============ CONSTANTS ============

    /// @notice Timelock period for asset activation (2 days)
    uint256 public constant ASSET_TIMELOCK = 2 days;

    /// @notice Timelock period for pair activation (2 days)
    uint256 public constant PAIR_TIMELOCK = 2 days;

    /// @notice Standard BLS threshold (11/20 issuers)
    uint256 public constant STANDARD_THRESHOLD = 11;

    /// @notice Emergency BLS threshold (15/20 issuers)
    uint256 public constant EMERGENCY_THRESHOLD = 15;

    // ============ STORAGE ============

    /// @notice Asset information by address
    mapping(address => TypesLib.AssetInfo) private _assets;

    /// @notice List of all asset addresses for enumeration
    address[] private _assetList;

    /// @notice Tracks whether an asset is already in _assetList
    mapping(address => bool) private _assetTracked;

    /// @notice Pair information by pairId
    mapping(bytes32 => TypesLib.PairInfo) private _pairs;

    /// @notice List of all pair IDs for enumeration
    bytes32[] private _pairList;

    /// @notice Tracks whether a pair is already in _pairList
    mapping(bytes32 => bool) private _pairTracked;

    /// @notice Mapping from asset to its pairs
    mapping(address => bytes32[]) private _assetPairs;

    /// @notice Nonce for replay protection
    uint256 private _nonce;

    /// @notice Admin address for configuration
    address public admin;

    // ============ MODIFIERS ============

    /// @notice Restricts function to admin only
    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    // ============ CONSTRUCTOR ============

    /// @notice Initialize the AssetPairRegistry with an admin and issuer registry
    /// @param _admin The admin address for configuration operations
    /// @param _issuerRegistry The IssuerRegistry address for BLS verification
    constructor(address _admin, address _issuerRegistry) {
        if (_admin == address(0)) revert ZeroAddress();
        admin = _admin;
        __BLSVerifier_init(_issuerRegistry);
    }

    // ============ ASSET MANAGEMENT ============

    /// @inheritdoc IAssetPairRegistry
    function proposeAsset(address asset, bytes calldata blsSignature) external override {
        if (asset == address(0)) revert ZeroAddress();

        // Check asset doesn't already exist or is inactive
        TypesLib.AssetInfo storage assetInfo = _assets[asset];
        if (assetInfo.status != TypesLib.AssetStatus.INACTIVE) revert AssetAlreadyExists();

        // Build message for BLS verification
        bytes32 message = keccak256(
            abi.encode("PROPOSE_ASSET", block.chainid, address(this), asset, _nonce++)
        );

        // Verify BLS signature (11/20 threshold)
        _verifyBLS(message, blsSignature);

        // Set asset to PENDING with activation time
        uint256 activationTime = block.timestamp + ASSET_TIMELOCK;
        assetInfo.asset = asset;
        assetInfo.status = TypesLib.AssetStatus.PENDING;
        assetInfo.proposedAt = activationTime;

        // Track asset for enumeration
        if (!_assetTracked[asset]) {
            _assetTracked[asset] = true;
            _assetList.push(asset);
        }

        emit AssetProposed(asset, msg.sender, activationTime);
    }

    /// @inheritdoc IAssetPairRegistry
    function activateAsset(address asset) external override {
        TypesLib.AssetInfo storage assetInfo = _assets[asset];

        // Must be in PENDING status
        if (assetInfo.status != TypesLib.AssetStatus.PENDING) revert AssetNotPending();

        // Timelock must have passed
        if (block.timestamp < assetInfo.proposedAt) revert TimelockNotPassed();

        // Activate the asset
        assetInfo.status = TypesLib.AssetStatus.ACTIVE;
        assetInfo.activatedAt = block.timestamp;

        emit AssetActivated(asset, msg.sender);
    }

    /// @inheritdoc IAssetPairRegistry
    function delistAsset(address asset, bytes calldata blsSignature) external override {
        TypesLib.AssetInfo storage assetInfo = _assets[asset];

        // Must be in ACTIVE status
        if (assetInfo.status != TypesLib.AssetStatus.ACTIVE) revert AssetNotActive();

        // Build message for BLS verification
        bytes32 message = keccak256(
            abi.encode("DELIST_ASSET", block.chainid, address(this), asset, _nonce++)
        );

        // Verify BLS signature (11/20 threshold)
        _verifyBLS(message, blsSignature);

        // Mark as DELISTING (not immediate removal)
        assetInfo.status = TypesLib.AssetStatus.DELISTING;

        emit AssetDelisting(asset);
    }

    /// @inheritdoc IAssetPairRegistry
    function emergencyRemoveAsset(address asset, bytes calldata blsSignature) external override {
        TypesLib.AssetInfo storage assetInfo = _assets[asset];

        // Must be in ACTIVE or DELISTING status
        if (
            assetInfo.status != TypesLib.AssetStatus.ACTIVE
                && assetInfo.status != TypesLib.AssetStatus.DELISTING
        ) revert AssetNotActive();

        // Build message for BLS verification
        bytes32 message = keccak256(
            abi.encode("EMERGENCY_REMOVE_ASSET", block.chainid, address(this), asset, _nonce++)
        );

        // Verify BLS signature (15/20 threshold)
        _verifyBLS(message, blsSignature);

        // Immediately set to INACTIVE
        assetInfo.status = TypesLib.AssetStatus.INACTIVE;

        emit AssetEmergencyRemoved(asset);
    }

    // ============ PAIR MANAGEMENT ============

    /// @inheritdoc IAssetPairRegistry
    function proposePair(
        address asset,
        bytes32 source,
        address quoteToken,
        uint256 chainId,
        bytes calldata blsSignature
    ) external override {
        if (asset == address(0)) revert ZeroAddress();
        if (quoteToken == address(0)) revert ZeroAddress();

        // Asset must be ACTIVE
        if (_assets[asset].status != TypesLib.AssetStatus.ACTIVE) revert AssetNotWhitelisted();

        // Compute pairId
        bytes32 pairId = computePairId(asset, source, quoteToken, chainId);

        // Check pair doesn't already exist
        TypesLib.PairInfo storage pairInfo = _pairs[pairId];
        if (pairInfo.status != TypesLib.PairStatus.INACTIVE) revert PairAlreadyExists();

        // Build message for BLS verification
        bytes32 message = keccak256(
            abi.encode(
                "PROPOSE_PAIR", block.chainid, address(this), asset, source, quoteToken, chainId, _nonce++
            )
        );

        // Verify BLS signature (11/20 threshold)
        _verifyBLS(message, blsSignature);

        // Set pair to PENDING with activation time
        uint256 activationTime = block.timestamp + PAIR_TIMELOCK;
        pairInfo.pairId = pairId;
        pairInfo.asset = asset;
        pairInfo.source = source;
        pairInfo.quoteToken = quoteToken;
        pairInfo.chainId = chainId;
        pairInfo.status = TypesLib.PairStatus.PENDING;
        pairInfo.proposedAt = activationTime;

        // Track pair for enumeration
        if (!_pairTracked[pairId]) {
            _pairTracked[pairId] = true;
            _pairList.push(pairId);
            _assetPairs[asset].push(pairId);
        }

        emit PairProposed(pairId, asset, source, quoteToken, chainId, msg.sender, activationTime);
    }

    /// @inheritdoc IAssetPairRegistry
    function activatePair(bytes32 pairId) external override {
        TypesLib.PairInfo storage pairInfo = _pairs[pairId];

        // Must be in PENDING status
        if (pairInfo.status != TypesLib.PairStatus.PENDING) revert PairNotPending();

        // Timelock must have passed
        if (block.timestamp < pairInfo.proposedAt) revert TimelockNotPassed();

        // Verify underlying asset is still active (HIGH-3 fix)
        if (_assets[pairInfo.asset].status != TypesLib.AssetStatus.ACTIVE) {
            revert AssetNotWhitelisted();
        }

        // Activate the pair
        pairInfo.status = TypesLib.PairStatus.ACTIVE;
        pairInfo.activatedAt = block.timestamp;

        emit PairActivated(pairId, msg.sender);
    }

    /// @inheritdoc IAssetPairRegistry
    function delistPair(bytes32 pairId, bytes calldata blsSignature) external override {
        TypesLib.PairInfo storage pairInfo = _pairs[pairId];

        // Must be in ACTIVE status
        if (pairInfo.status != TypesLib.PairStatus.ACTIVE) revert PairNotActive();

        // Build message for BLS verification
        bytes32 message = keccak256(
            abi.encode("DELIST_PAIR", block.chainid, address(this), pairId, _nonce++)
        );

        // Verify BLS signature (11/20 threshold)
        _verifyBLS(message, blsSignature);

        // Mark as DELISTED
        pairInfo.status = TypesLib.PairStatus.DELISTED;

        emit PairDelisted(pairId);
    }

    // ============ PROPOSAL CANCELLATION ============

    /// @inheritdoc IAssetPairRegistry
    function cancelAssetProposal(address asset, bytes calldata blsSignature) external override {
        TypesLib.AssetInfo storage assetInfo = _assets[asset];

        // Must be in PENDING status
        if (assetInfo.status != TypesLib.AssetStatus.PENDING) revert AssetNotPending();

        // Build message for BLS verification
        bytes32 message = keccak256(
            abi.encode("CANCEL_ASSET_PROPOSAL", block.chainid, address(this), asset, _nonce++)
        );

        // Verify BLS signature (11/20 threshold)
        _verifyBLS(message, blsSignature);

        // Reset to INACTIVE
        assetInfo.status = TypesLib.AssetStatus.INACTIVE;

        emit AssetProposalCancelled(asset);
    }

    /// @inheritdoc IAssetPairRegistry
    function cancelPairProposal(bytes32 pairId, bytes calldata blsSignature) external override {
        TypesLib.PairInfo storage pairInfo = _pairs[pairId];

        // Must be in PENDING status
        if (pairInfo.status != TypesLib.PairStatus.PENDING) revert PairNotPending();

        // Build message for BLS verification
        bytes32 message = keccak256(
            abi.encode("CANCEL_PAIR_PROPOSAL", block.chainid, address(this), pairId, _nonce++)
        );

        // Verify BLS signature (11/20 threshold)
        _verifyBLS(message, blsSignature);

        // Reset to INACTIVE
        pairInfo.status = TypesLib.PairStatus.INACTIVE;

        emit PairProposalCancelled(pairId);
    }

    // ============ VIEW FUNCTIONS ============

    /// @inheritdoc IAssetPairRegistry
    function isAssetWhitelisted(address asset) external view override returns (bool) {
        return _assets[asset].status == TypesLib.AssetStatus.ACTIVE;
    }

    /// @inheritdoc IAssetPairRegistry
    function isAssetDelisting(address asset) external view override returns (bool) {
        return _assets[asset].status == TypesLib.AssetStatus.DELISTING;
    }

    /// @inheritdoc IAssetPairRegistry
    function isPairActive(bytes32 pairId) external view override returns (bool) {
        return _pairs[pairId].status == TypesLib.PairStatus.ACTIVE;
    }

    /// @inheritdoc IAssetPairRegistry
    function getAsset(address asset)
        external
        view
        override
        returns (address assetAddr, uint8 status, uint256 proposedAt, uint256 activatedAt)
    {
        TypesLib.AssetInfo storage info = _assets[asset];
        return (info.asset, uint8(info.status), info.proposedAt, info.activatedAt);
    }

    /// @inheritdoc IAssetPairRegistry
    function getPair(bytes32 pairId)
        external
        view
        override
        returns (
            address asset,
            bytes32 source,
            address quoteToken,
            uint256 chainId,
            uint8 status,
            uint256 proposedAt,
            uint256 activatedAt
        )
    {
        TypesLib.PairInfo storage info = _pairs[pairId];
        return (
            info.asset,
            info.source,
            info.quoteToken,
            info.chainId,
            uint8(info.status),
            info.proposedAt,
            info.activatedAt
        );
    }

    /// @inheritdoc IAssetPairRegistry
    function getActiveAssets() external view override returns (address[] memory) {
        // Count active assets
        uint256 count = 0;
        uint256 length = _assetList.length;
        for (uint256 i = 0; i < length;) {
            if (_assets[_assetList[i]].status == TypesLib.AssetStatus.ACTIVE) {
                count++;
            }
            unchecked {
                ++i;
            }
        }

        // Build result array
        address[] memory result = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < length;) {
            if (_assets[_assetList[i]].status == TypesLib.AssetStatus.ACTIVE) {
                result[idx++] = _assetList[i];
            }
            unchecked {
                ++i;
            }
        }

        return result;
    }

    /// @inheritdoc IAssetPairRegistry
    function getActivePairs() external view override returns (bytes32[] memory) {
        // Count active pairs
        uint256 count = 0;
        uint256 length = _pairList.length;
        for (uint256 i = 0; i < length;) {
            if (_pairs[_pairList[i]].status == TypesLib.PairStatus.ACTIVE) {
                count++;
            }
            unchecked {
                ++i;
            }
        }

        // Build result array
        bytes32[] memory result = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < length;) {
            if (_pairs[_pairList[i]].status == TypesLib.PairStatus.ACTIVE) {
                result[idx++] = _pairList[i];
            }
            unchecked {
                ++i;
            }
        }

        return result;
    }

    /// @inheritdoc IAssetPairRegistry
    function getPairsForAsset(address asset) external view override returns (bytes32[] memory) {
        return _assetPairs[asset];
    }

    /// @inheritdoc IAssetPairRegistry
    function getActivePairsForAsset(address asset) external view override returns (bytes32[] memory) {
        bytes32[] memory allPairs = _assetPairs[asset];

        // Count active pairs
        uint256 count = 0;
        uint256 length = allPairs.length;
        for (uint256 i = 0; i < length;) {
            if (_pairs[allPairs[i]].status == TypesLib.PairStatus.ACTIVE) {
                count++;
            }
            unchecked {
                ++i;
            }
        }

        // Build result array
        bytes32[] memory result = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < length;) {
            if (_pairs[allPairs[i]].status == TypesLib.PairStatus.ACTIVE) {
                result[idx++] = allPairs[i];
            }
            unchecked {
                ++i;
            }
        }

        return result;
    }

    /// @inheritdoc IAssetPairRegistry
    function computePairId(address asset, bytes32 source, address quoteToken, uint256 chainId)
        public
        pure
        override
        returns (bytes32)
    {
        return keccak256(abi.encode(asset, source, quoteToken, chainId));
    }

    /// @inheritdoc IAssetPairRegistry
    function getNonce() external view override returns (uint256) {
        return _nonce;
    }

    // ============ ADMIN FUNCTIONS ============

    /// @inheritdoc IAssetPairRegistry
    function setAdmin(address newAdmin) external override onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        address previousAdmin = admin;
        admin = newAdmin;
        emit AdminChanged(previousAdmin, newAdmin);
    }


    // BLS verification via inherited BLSVerifier._verifyBLS()
}
