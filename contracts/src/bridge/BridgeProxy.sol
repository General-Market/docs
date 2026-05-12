// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IBridgeProxy} from "../interfaces/IBridgeProxy.sol";
import {IBridgedItpFactory} from "../interfaces/IBridgedItpFactory.sol";
import {IBridgedITP} from "../interfaces/IBridgedITP.sol";
import {IOracleRegistry} from "../interfaces/IOracleRegistry.sol";
import {IIndex} from "../interfaces/IIndex.sol";
import {BLSLib} from "../libraries/BLSLib.sol";
import {BLSVerifier} from "../libraries/BLSVerifier.sol";
import {ErrorsLib} from "../libraries/ErrorsLib.sol";

/// @title BridgeProxy - Cross-chain ITP creation with BLS consensus
/// @notice UUPS upgradeable proxy on Settlement for bridged ITP creation
/// @custom:security-contact security@indexprotocol.com
contract BridgeProxy is Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable, BLSVerifier, IBridgeProxy {
    /// @notice Thrown when bundled-call array lengths disagree or are empty.
    error BundleLengthMismatch();

    // ============ CONSTANTS ============

    uint256 public constant override MAX_ASSETS = 1000;
    uint256 public constant override MIN_WEIGHT = 2.5e15; // 0.25%
    uint256 public constant override WEIGHT_SUM = 1e18;   // 100%
    uint256 public constant override MAX_NAME_LENGTH = 32;
    uint256 public constant override MAX_SYMBOL_LENGTH = 10;
    uint256 public constant override MAX_DESCRIPTION_LENGTH = 280;
    uint256 public constant override MAX_URL_LENGTH = 128;
    uint256 public constant override MAX_VIDEO_URL_LENGTH = 256;
    uint256 public constant MAX_DEPLOYER_NAME_LENGTH = 64;

    // ============ STORAGE ============

    IOracleRegistry public override oracleRegistry;
    IBridgedItpFactory public override bridgedItpFactory;
    uint256 public override nextCreationNonce;

    /// @notice nonce => PendingItpCreation
    mapping(uint256 => PendingItpCreation) private _pendingCreations;

    /// @notice L3 orbitItpId => Settlement bridgedItp address
    mapping(bytes32 => address) public override orbitToSettlement;

    /// @notice Settlement bridgedItp address => L3 orbitItpId
    mapping(address => bytes32) public override settlementToOrbit;

    /// @notice DEPRECATED: was signerThreshold, slot preserved for UUPS layout
    uint256 private _deprecated_signerThreshold;

    /// @notice Investment contract on L3 for atomic ITP creation
    IIndex public indexContract;

    /// @notice L3 itpId => deployer address (set during completeCreateItp)
    mapping(bytes32 => address) public override itpDeployer;

    /// @notice Next nonce for rebalance requests
    uint256 public override nextRebalanceNonce;

    /// @notice Pending rebalance requests
    mapping(uint256 => PendingRebalanceRequest) private _pendingRebalanceRequests;

    /// @notice Per-ITP metadata (append-only, UUPS safe)
    mapping(bytes32 => ItpMetadata) private _itpMetadata;

    /// @notice Deployer display names
    mapping(address => string) private _deployerNames;

    /// @notice Pending metadata for ITP creation (nonce => metadata, consumed by completeCreateItp)
    mapping(uint256 => ItpMetadata) private _pendingMetadata;

    /// @notice Replay protection: orderId => already minted
    mapping(uint256 => bool) public mintProcessed;

    /// @notice Replay protection: orderId => already burned
    mapping(uint256 => bool) public burnProcessed;

    /// @notice Settlement custody contract (only caller for burnFromCustody)
    address public settlementBridgeCustody;

    // ============ CONSTRUCTOR ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ INITIALIZER ============

    function initialize(
        address _oracleRegistry,
        address _bridgedItpFactory,
        address _owner
    ) external initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __Pausable_init();

        oracleRegistry = IOracleRegistry(_oracleRegistry);
        __BLSVerifier_init(_oracleRegistry);
        bridgedItpFactory = IBridgedItpFactory(_bridgedItpFactory);
    }

    // ============ EXTERNAL FUNCTIONS ============

    function requestCreateItp(
        string calldata name,
        string calldata symbol,
        uint256[] calldata weights,
        address[] calldata assets,
        uint256[] calldata prices,
        ItpMetadata calldata metadata
    ) external override whenNotPaused returns (uint256 nonce) {
        // Validate inputs
        if (weights.length != assets.length)
            revert ErrorsLib.E075_BridgeLengthMismatch(weights.length, assets.length);
        if (prices.length != assets.length)
            revert ErrorsLib.E075_BridgeLengthMismatch(assets.length, prices.length);
        if (assets.length == 0) revert ErrorsLib.E076_NoAssets();
        if (assets.length > MAX_ASSETS)
            revert ErrorsLib.E077_TooManyAssets(assets.length, MAX_ASSETS);
        if (bytes(name).length > MAX_NAME_LENGTH)
            revert ErrorsLib.E07A_NameTooLong(bytes(name).length, MAX_NAME_LENGTH);
        if (bytes(symbol).length > MAX_SYMBOL_LENGTH)
            revert ErrorsLib.E07B_SymbolTooLong(bytes(symbol).length, MAX_SYMBOL_LENGTH);

        // Validate weights
        uint256 weightSum;
        for (uint256 i = 0; i < weights.length; i++) {
            if (weights[i] < MIN_WEIGHT)
                revert ErrorsLib.E074_WeightBelowMinimum(i, weights[i], MIN_WEIGHT);
            weightSum += weights[i];
        }
        if (weightSum != WEIGHT_SUM)
            revert ErrorsLib.E073_InvalidWeightsSum(weightSum, WEIGHT_SUM);

        // Check for duplicates and zero addresses
        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i] == address(0)) revert ErrorsLib.E079_ZeroAddressAsset();
            for (uint256 j = 0; j < i; j++) {
                if (assets[i] == assets[j])
                    revert ErrorsLib.E078_DuplicateAsset(assets[i]);
            }
        }

        // Validate metadata lengths
        if (bytes(metadata.description).length > MAX_DESCRIPTION_LENGTH)
            revert ErrorsLib.E121_DescriptionTooLong(bytes(metadata.description).length, MAX_DESCRIPTION_LENGTH);
        if (bytes(metadata.websiteUrl).length > MAX_URL_LENGTH)
            revert ErrorsLib.E122_UrlTooLong(bytes(metadata.websiteUrl).length, MAX_URL_LENGTH);
        if (bytes(metadata.videoUrl).length > MAX_VIDEO_URL_LENGTH)
            revert ErrorsLib.E123_VideoUrlTooLong(bytes(metadata.videoUrl).length, MAX_VIDEO_URL_LENGTH);

        nonce = nextCreationNonce++;

        PendingItpCreation storage pending = _pendingCreations[nonce];
        pending.admin = msg.sender;
        pending.name = name;
        pending.symbol = symbol;
        pending.weights = weights;
        pending.assets = assets;
        pending.prices = prices;
        pending.createdAt = uint64(block.timestamp);

        // Store metadata separately (consumed by completeCreateItp)
        if (bytes(metadata.description).length > 0 || bytes(metadata.websiteUrl).length > 0 || bytes(metadata.videoUrl).length > 0) {
            _pendingMetadata[nonce] = metadata;
        }

        emit CreateItpRequested(msg.sender, nonce, name, symbol, weights, assets);
    }

    function completeCreateItp(
        uint256 nonce,
        bytes32 orbitItpId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external override whenNotPaused returns (address bridgedItpAddress) {
        PendingItpCreation storage pending = _pendingCreations[nonce];
        if (pending.admin == address(0)) revert ErrorsLib.E072_CreationNotFound(nonce);
        if (pending.completed) revert ErrorsLib.E070_AlreadyCompleted(nonce);

        // Build message hash: chainid + bridgeProxy + admin + nonce + weightsHash + assetsHash
        bytes32 weightsHash = keccak256(abi.encodePacked(pending.weights));
        bytes32 assetsHash = keccak256(abi.encodePacked(pending.assets));
        bytes32 messageHash = keccak256(
            abi.encodePacked(block.chainid, address(this), pending.admin, nonce, weightsHash, assetsHash)
        );

        // Verify BLS signature via BLSVerifier
        _verifyBLS(messageHash, blsSignature, referenceNonce, signersBitmask);

        // Mark completed
        pending.completed = true;

        // orbitItpId was created on L3 by the oracle before calling this function.
        // Investment.sol only exists on L3 — BridgeProxy stores the mapping here on Settlement.
        if (orbitItpId == bytes32(0)) revert ErrorsLib.E072_CreationNotFound(nonce);

        // Store deployer for future rebalance/transfer authorization
        itpDeployer[orbitItpId] = pending.admin;

        // Check orbitItpId not already mapped (defense-in-depth, should be prevented by idempotent createITP)
        if (orbitToSettlement[orbitItpId] != address(0))
            revert ErrorsLib.E07C_OrbitItpAlreadyMapped(orbitItpId, orbitToSettlement[orbitItpId]);

        // Deploy BridgedITP via factory
        bridgedItpAddress = bridgedItpFactory.deployBridgedItp(pending.name, pending.symbol, orbitItpId);

        // Store bidirectional mappings
        orbitToSettlement[orbitItpId] = bridgedItpAddress;
        settlementToOrbit[bridgedItpAddress] = orbitItpId;

        // Auto-store metadata from creation request (if any provided)
        ItpMetadata storage meta = _pendingMetadata[nonce];
        if (bytes(meta.description).length > 0 || bytes(meta.websiteUrl).length > 0 || bytes(meta.videoUrl).length > 0) {
            _itpMetadata[orbitItpId] = ItpMetadata(meta.description, meta.websiteUrl, meta.videoUrl);
            emit ItpMetadataUpdated(orbitItpId, pending.admin, meta.description, meta.websiteUrl, meta.videoUrl);
        }

        emit ItpCreated(orbitItpId, bridgedItpAddress, nonce, pending.admin);
    }

    // ============ REBALANCE FUNCTIONS (V2 - Asset Changes) ============

    /// @notice Request a rebalance (permissionless, event-only)
    /// @dev Stores request and emits event for oracles to pick up
    /// @param itpId The ITP to rebalance
    /// @param removeIndices Indices of assets to remove (sorted descending)
    /// @param addAssets Addresses of assets to add
    /// @param newWeights Target weights for the final asset list
    /// @param note Human-readable reason
    /// @return nonce Unique identifier for this request
    function requestRebalance(
        bytes32 itpId,
        uint256[] calldata removeIndices,
        address[] calldata addAssets,
        uint256[] calldata newWeights,
        string calldata note
    ) external returns (uint256 nonce) {
        nonce = nextRebalanceNonce++;
        _pendingRebalanceRequests[nonce] = PendingRebalanceRequest({
            deployer: msg.sender,
            itpId: itpId,
            newWeights: newWeights,
            createdAt: uint64(block.timestamp),
            completed: false
        });

        emit RebalanceRequested(msg.sender, itpId, nonce, removeIndices, addAssets, newWeights, note);
    }

    /// @notice Execute rebalance on L3 Investment via cross-chain BLS consensus
    /// @dev BLS verified on Settlement, then calls Investment.rebalance on L3
    function rebalance(
        bytes32 itpId,
        uint256[] calldata removeIndices,
        address[] calldata addAssets,
        uint256[] calldata newWeights,
        uint256[] calldata prices,
        address[] calldata quoteTokens,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external override whenNotPaused {
        // Build message hash matching L3 Investment.rebalance format
        bytes32 messageHash = keccak256(abi.encode(
            block.chainid, address(this), "rebalance",
            itpId, removeIndices, addAssets, newWeights, prices, quoteTokens
        ));

        // Verify BLS signature via BLSVerifier
        _verifyBLS(messageHash, blsSignature, referenceNonce, signersBitmask);

        // Investment.sol only exists on L3 — oracle relays rebalance to L3 separately
        emit RebalanceCompleted(itpId, 0);
    }

    function transferDeployer(bytes32 itpId, address newDeployer) external override whenNotPaused {
        address currentDeployer = itpDeployer[itpId];
        if (currentDeployer == address(0)) revert ErrorsLib.E099_BridgeItpNotFound(itpId);
        if (msg.sender != currentDeployer) revert ErrorsLib.E100_NotBridgeDeployer(itpId, msg.sender, currentDeployer);
        if (newDeployer == address(0)) revert ErrorsLib.E106_ZeroAddressNotAllowed();

        // Update deployer on BridgeProxy
        itpDeployer[itpId] = newDeployer;

        // Investment.sol only exists on L3 — oracle relays transferCreator to L3 separately
        emit DeployerTransferred(itpId, currentDeployer, newDeployer);
    }

    // ============ ITP METADATA ============

    function setItpMetadata(
        bytes32 itpId,
        string calldata description,
        string calldata websiteUrl,
        string calldata videoUrl
    ) external override {
        address deployer = itpDeployer[itpId];
        if (deployer == address(0)) revert ErrorsLib.E099_BridgeItpNotFound(itpId);
        if (msg.sender != deployer) revert ErrorsLib.E124_NotItpDeployer(itpId, msg.sender, deployer);
        if (bytes(description).length > MAX_DESCRIPTION_LENGTH)
            revert ErrorsLib.E121_DescriptionTooLong(bytes(description).length, MAX_DESCRIPTION_LENGTH);
        if (bytes(websiteUrl).length > MAX_URL_LENGTH)
            revert ErrorsLib.E122_UrlTooLong(bytes(websiteUrl).length, MAX_URL_LENGTH);
        if (bytes(videoUrl).length > MAX_VIDEO_URL_LENGTH)
            revert ErrorsLib.E123_VideoUrlTooLong(bytes(videoUrl).length, MAX_VIDEO_URL_LENGTH);
        _itpMetadata[itpId] = ItpMetadata(description, websiteUrl, videoUrl);
        emit ItpMetadataUpdated(itpId, msg.sender, description, websiteUrl, videoUrl);
    }

    // ============ DEPLOYER NAME ============

    function setDeployerName(string calldata name) external override {
        if (bytes(name).length > MAX_DEPLOYER_NAME_LENGTH)
            revert ErrorsLib.E127_DeployerNameTooLong(bytes(name).length, MAX_DEPLOYER_NAME_LENGTH);
        _deployerNames[msg.sender] = name;
        emit DeployerNameUpdated(msg.sender, name);
    }

    function getDeployerName(address deployer) external view override returns (string memory) {
        return _deployerNames[deployer];
    }

    // ============ VIEW FUNCTIONS ============

    function getItpMetadata(bytes32 itpId)
        external view override
        returns (string memory description, string memory websiteUrl, string memory videoUrl)
    {
        ItpMetadata storage m = _itpMetadata[itpId];
        return (m.description, m.websiteUrl, m.videoUrl);
    }

    function getPendingCreation(uint256 nonce)
        external
        view
        override
        returns (
            address admin,
            string memory name,
            string memory symbol,
            uint256[] memory weights,
            address[] memory assets,
            uint256[] memory prices,
            uint64 createdAt,
            bool completed
        )
    {
        PendingItpCreation storage p = _pendingCreations[nonce];
        return (p.admin, p.name, p.symbol, p.weights, p.assets, p.prices, p.createdAt, p.completed);
    }

    function isPending(uint256 nonce) external view override returns (bool) {
        PendingItpCreation storage p = _pendingCreations[nonce];
        return p.admin != address(0) && !p.completed;
    }

    function getBridgedItp(bytes32 orbitItpId) external view override returns (address) {
        return orbitToSettlement[orbitItpId];
    }

    function getOrbitItpId(address bridgedItp) external view override returns (bytes32) {
        return settlementToOrbit[bridgedItp];
    }

    function getPendingRebalance(uint256 nonce)
        external
        view
        override
        returns (
            address deployer,
            bytes32 itpId,
            uint256[] memory newWeights,
            uint64 createdAt,
            bool completed
        )
    {
        PendingRebalanceRequest storage p = _pendingRebalanceRequests[nonce];
        return (p.deployer, p.itpId, p.newWeights, p.createdAt, p.completed);
    }

    function isRebalancePending(uint256 nonce) external view override returns (bool) {
        PendingRebalanceRequest storage p = _pendingRebalanceRequests[nonce];
        return p.deployer != address(0) && !p.completed;
    }

    // ============ CROSS-CHAIN SHARE BRIDGING ============

    /// @notice Mint BridgedITP shares after cross-chain buy order fill on L3
    /// @dev Called by oracles after BLS consensus confirms the fill
    /// @param itpId The L3 ITP identifier
    /// @param user The user who bought ITP via bridge
    /// @param amount Amount of shares to mint (18 decimals)
    /// @param orderId Settlement order ID for replay protection
    /// @param blsSignature Aggregated BLS signature (empty = skip in testing)
    function mintBridgedShares(
        bytes32 itpId,
        address user,
        uint256 amount,
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external override whenNotPaused {
        _mintBridgedSharesOne(itpId, user, amount, orderId, blsSignature, referenceNonce, signersBitmask);
    }

    /// @notice Bundle of `mintBridgedShares` calls in one transaction.
    /// @dev Each item keeps its own BLS signature, reference nonce, and signers
    ///      bitmask. Reverts on the first sub-failure — chunking is the caller's
    ///      responsibility. One pause-check covers the bundle.
    function mintBridgedSharesMany(
        bytes32[] calldata itpIds,
        address[] calldata users,
        uint256[] calldata amounts,
        uint256[] calldata orderIds,
        bytes[] calldata blsSignatures,
        uint256[] calldata referenceNonces,
        uint256[] calldata signersBitmasks
    ) external whenNotPaused {
        uint256 n = orderIds.length;
        if (n == 0) revert BundleLengthMismatch();
        if (
            itpIds.length != n
            || users.length != n
            || amounts.length != n
            || blsSignatures.length != n
            || referenceNonces.length != n
            || signersBitmasks.length != n
        ) revert BundleLengthMismatch();

        for (uint256 i = 0; i < n; ++i) {
            _mintBridgedSharesOne(
                itpIds[i],
                users[i],
                amounts[i],
                orderIds[i],
                blsSignatures[i],
                referenceNonces[i],
                signersBitmasks[i]
            );
        }
    }

    /// @notice Single-mint body. Shared by `mintBridgedShares` and the bundled
    ///         variant. The outer entry holds the `whenNotPaused` modifier.
    function _mintBridgedSharesOne(
        bytes32 itpId,
        address user,
        uint256 amount,
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) internal {
        address bridgedItp = orbitToSettlement[itpId];
        if (bridgedItp == address(0)) revert ErrorsLib.E099_BridgeItpNotFound(itpId);
        if (amount == 0) revert ErrorsLib.E106_ZeroAddressNotAllowed();
        if (mintProcessed[orderId]) revert ErrorsLib.E139_MintAlreadyProcessed(orderId);

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "mintBridgedShares", itpId, user, amount, orderId
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        mintProcessed[orderId] = true;

        IBridgedITP(bridgedItp).mint(user, amount);

        emit BridgedSharesMinted(itpId, user, amount);
    }

    /// @notice Burn BridgedITP shares (e.g., after sell order completion)
    /// @param itpId The L3 ITP identifier
    /// @param from Address holding the BridgedITP tokens
    /// @param amount Amount of shares to burn (18 decimals)
    /// @param blsSignature Aggregated BLS signature (empty = skip in testing)
    function burnBridgedShares(
        bytes32 itpId,
        address from,
        uint256 amount,
        uint256 orderId,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external override whenNotPaused {
        // v5: Custody-held tokens must be burned via burnFromCustody (called by burnSellOrderShares)
        if (from == settlementBridgeCustody) revert ErrorsLib.E149_UseBurnFromCustody();
        address bridgedItp = orbitToSettlement[itpId];
        if (bridgedItp == address(0)) revert ErrorsLib.E099_BridgeItpNotFound(itpId);
        if (amount == 0) revert ErrorsLib.E106_ZeroAddressNotAllowed();
        if (burnProcessed[orderId]) revert ErrorsLib.E140_BurnAlreadyProcessed(orderId);

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "burnBridgedShares", itpId, from, amount, orderId
        ));
        _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);

        burnProcessed[orderId] = true;

        IBridgedITP(bridgedItp).burn(from, amount);

        emit BridgedSharesBurned(itpId, from, amount);
    }

    /// @notice Burn BridgedITP held by custody contract. No BLS needed — only custody can call.
    /// @dev Called atomically from SettlementBridgeCustody.burnSellOrderShares
    /// @param itpId The L3 ITP identifier
    /// @param from Address holding the tokens (custody contract)
    /// @param amount Amount of shares to burn
    function burnFromCustody(bytes32 itpId, address from, uint256 amount) external whenNotPaused {
        if (msg.sender != settlementBridgeCustody) revert ErrorsLib.E141_OnlyCustody();
        address bridgedItp = orbitToSettlement[itpId];
        if (bridgedItp == address(0)) revert ErrorsLib.E099_BridgeItpNotFound(itpId);
        IBridgedITP(bridgedItp).burn(from, amount);
        emit BridgedSharesBurned(itpId, from, amount);
    }

    /// @notice Mint BridgedITP for custody contract — recovery for failed sells.
    /// @dev Only callable by settlementBridgeCustody. No BLS needed at this level.
    ///      Intentionally NOT whenNotPaused: recovery must work even when paused
    ///      to prevent permanent fund trapping after burnSellOrderShares.
    /// @param itpId The L3 ITP identifier
    /// @param to Address to receive minted tokens (user)
    /// @param amount Amount of shares to mint
    function mintFromCustody(bytes32 itpId, address to, uint256 amount) external {
        if (msg.sender != settlementBridgeCustody) revert ErrorsLib.E141_OnlyCustody();
        address bridgedItp = orbitToSettlement[itpId];
        if (bridgedItp == address(0)) revert ErrorsLib.E099_BridgeItpNotFound(itpId);
        IBridgedITP(bridgedItp).mint(to, amount);
        emit BridgedSharesMinted(itpId, to, amount);
    }

    // ============ ADMIN FUNCTIONS ============

    /// @notice Register an existing L3 ITP for bridge use (owner-only bootstrapping)
    function registerExistingItp(
        bytes32 orbitItpId,
        string calldata name,
        string calldata symbol,
        address deployer
    ) external override onlyOwner returns (address bridgedItpAddress) {
        if (orbitItpId == bytes32(0)) revert ErrorsLib.E106_ZeroAddressNotAllowed();
        if (deployer == address(0)) revert ErrorsLib.E106_ZeroAddressNotAllowed();
        if (orbitToSettlement[orbitItpId] != address(0))
            revert ErrorsLib.E07C_OrbitItpAlreadyMapped(orbitItpId, orbitToSettlement[orbitItpId]);

        itpDeployer[orbitItpId] = deployer;
        bridgedItpAddress = bridgedItpFactory.deployBridgedItp(name, symbol, orbitItpId);
        orbitToSettlement[orbitItpId] = bridgedItpAddress;
        settlementToOrbit[bridgedItpAddress] = orbitItpId;

        emit ItpCreated(orbitItpId, bridgedItpAddress, type(uint256).max, deployer);
    }

    function setOracleRegistry(address _oracleRegistry) external override onlyOwner {
        oracleRegistry = IOracleRegistry(_oracleRegistry);
        __BLSVerifier_init(_oracleRegistry);
    }

    function setBridgedItpFactory(address _bridgedItpFactory) external override onlyOwner {
        bridgedItpFactory = IBridgedItpFactory(_bridgedItpFactory);
    }

    function setIndexContract(address indexContract_) external override onlyOwner {
        indexContract = IIndex(indexContract_);
    }

    function setSettlementBridgeCustody(address _settlementBridgeCustody) external onlyOwner {
        if (_settlementBridgeCustody == address(0)) revert ErrorsLib.E106_ZeroAddressNotAllowed();
        // One-shot: cannot overwrite once set (mirrors SettlementBridgeCustody.setBridgeProxy)
        if (settlementBridgeCustody != address(0)) revert ErrorsLib.E143_BridgeProxyAlreadySet();
        settlementBridgeCustody = _settlementBridgeCustody;
    }

    function pause() external override onlyOwner {
        _pause();
    }

    function unpause() external override onlyOwner {
        _unpause();
    }

    // ============ INTERNAL ============

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
