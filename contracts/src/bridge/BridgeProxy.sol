// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IBridgeProxy} from "../interfaces/IBridgeProxy.sol";
import {IBridgedItpFactory} from "../interfaces/IBridgedItpFactory.sol";
import {IBridgedITP} from "../interfaces/IBridgedITP.sol";
import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";
import {IIndex} from "../interfaces/IIndex.sol";
import {BLSLib} from "../libraries/BLSLib.sol";
import {ErrorsLib} from "../libraries/ErrorsLib.sol";

/// @title BridgeProxy - Cross-chain ITP creation with BLS consensus
/// @notice UUPS upgradeable proxy on Arbitrum for bridged ITP creation
contract BridgeProxy is Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable, IBridgeProxy {
    // ============ CONSTANTS ============

    uint256 public constant override MAX_ASSETS = 1000;
    uint256 public constant override MIN_WEIGHT = 2.5e15; // 0.25%
    uint256 public constant override WEIGHT_SUM = 1e18;   // 100%
    uint256 public constant override MAX_NAME_LENGTH = 32;
    uint256 public constant override MAX_SYMBOL_LENGTH = 10;
    uint256 public constant override MAX_URL_LENGTH = 128;

    // ============ STORAGE ============

    IIssuerRegistry public override issuerRegistry;
    IBridgedItpFactory public override bridgedItpFactory;
    uint256 public override nextCreationNonce;

    /// @notice nonce => PendingItpCreation
    mapping(uint256 => PendingItpCreation) private _pendingCreations;

    /// @notice L3 orbitItpId => Arbitrum bridgedItp address
    mapping(bytes32 => address) public override orbitToArbitrum;

    /// @notice Arbitrum bridgedItp address => L3 orbitItpId
    mapping(address => bytes32) public override arbitrumToOrbit;

    /// @notice Required number of BLS signers
    uint256 public signerThreshold;

    /// @notice Index contract on L3 for atomic ITP creation
    IIndex public indexContract;

    /// @notice L3 itpId => deployer address (set during completeCreateItp)
    mapping(bytes32 => address) public override itpDeployer;

    /// @notice Next nonce for rebalance requests
    uint256 public override nextRebalanceNonce;

    /// @notice Pending rebalance requests
    mapping(uint256 => PendingRebalanceRequest) private _pendingRebalanceRequests;

    /// @notice Deployer display profiles (append-only, UUPS safe)
    mapping(address => DeployerProfile) private _deployerProfiles;

    // ============ CONSTRUCTOR ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ INITIALIZER ============

    function initialize(
        address _issuerRegistry,
        address _bridgedItpFactory,
        address _owner
    ) external initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __Pausable_init();

        issuerRegistry = IIssuerRegistry(_issuerRegistry);
        bridgedItpFactory = IBridgedItpFactory(_bridgedItpFactory);
    }

    // ============ EXTERNAL FUNCTIONS ============

    function requestCreateItp(
        string calldata name,
        string calldata symbol,
        uint256[] calldata weights,
        address[] calldata assets,
        uint256[] calldata prices
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

        nonce = nextCreationNonce++;

        PendingItpCreation storage pending = _pendingCreations[nonce];
        pending.admin = msg.sender;
        pending.name = name;
        pending.symbol = symbol;
        pending.weights = weights;
        pending.assets = assets;
        pending.prices = prices;
        pending.createdAt = uint64(block.timestamp);

        emit CreateItpRequested(msg.sender, nonce, name, symbol, weights, assets);
    }

    function completeCreateItp(
        uint256 nonce,
        bytes32 orbitItpId,
        uint256 signerBitmap,
        bytes calldata aggregatedPubkey,
        bytes calldata blsSignature
    ) external override whenNotPaused returns (address bridgedItpAddress) {
        PendingItpCreation storage pending = _pendingCreations[nonce];
        if (pending.admin == address(0)) revert ErrorsLib.E072_CreationNotFound(nonce);
        if (pending.completed) revert ErrorsLib.E070_AlreadyCompleted(nonce);

        // Validate pubkey length
        if (aggregatedPubkey.length != 128)
            revert ErrorsLib.E07E_InvalidAggregatedPubkeyLength(aggregatedPubkey.length);

        // Count signers from bitmap and verify threshold
        uint256 signerCount = _countBits(signerBitmap);
        if (signerCount < signerThreshold)
            revert ErrorsLib.E07D_InsufficientSigners(signerCount, signerThreshold);

        // Build message hash: chainid + bridgeProxy + admin + nonce + weightsHash + assetsHash
        bytes32 weightsHash = keccak256(abi.encodePacked(pending.weights));
        bytes32 assetsHash = keccak256(abi.encodePacked(pending.assets));
        bytes32 messageHash = keccak256(
            abi.encodePacked(block.chainid, address(this), pending.admin, nonce, weightsHash, assetsHash)
        );

        // Verify BLS signature
        if (!BLSLib.verifyBLS(aggregatedPubkey, messageHash, blsSignature))
            revert ErrorsLib.E071_InvalidBLSSignature();

        // Mark completed
        pending.completed = true;

        // orbitItpId was created on L3 by the issuer before calling this function.
        // Index.sol only exists on L3 — BridgeProxy stores the mapping here on Arb.
        if (orbitItpId == bytes32(0)) revert ErrorsLib.E072_CreationNotFound(nonce);

        // Store deployer for future rebalance/transfer authorization
        itpDeployer[orbitItpId] = pending.admin;

        // Check orbitItpId not already mapped (defense-in-depth, should be prevented by idempotent createITP)
        if (orbitToArbitrum[orbitItpId] != address(0))
            revert ErrorsLib.E07C_OrbitItpAlreadyMapped(orbitItpId, orbitToArbitrum[orbitItpId]);

        // Deploy BridgedITP via factory
        bridgedItpAddress = bridgedItpFactory.deployBridgedItp(pending.name, pending.symbol, orbitItpId);

        // Store bidirectional mappings
        orbitToArbitrum[orbitItpId] = bridgedItpAddress;
        arbitrumToOrbit[bridgedItpAddress] = orbitItpId;

        emit ItpCreated(orbitItpId, bridgedItpAddress, nonce, pending.admin);
    }

    // ============ REBALANCE FUNCTIONS (V2 - Asset Changes) ============

    /// @notice Request a rebalance (permissionless, event-only)
    /// @dev Stores request and emits event for issuers to pick up
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

    /// @notice Execute rebalance on L3 Index via cross-chain BLS consensus
    /// @dev BLS verified on Arbitrum, then calls Index.rebalance on L3
    function rebalance(
        bytes32 itpId,
        uint256[] calldata removeIndices,
        address[] calldata addAssets,
        uint256[] calldata newWeights,
        uint256[] calldata prices,
        uint256 signerBitmap,
        bytes calldata aggregatedPubkey,
        bytes calldata blsSignature
    ) external override whenNotPaused {
        // Validate pubkey length
        if (aggregatedPubkey.length != 128)
            revert ErrorsLib.E07E_InvalidAggregatedPubkeyLength(aggregatedPubkey.length);

        // Count signers from bitmap and verify threshold
        uint256 signerCount = _countBits(signerBitmap);
        if (signerCount < signerThreshold)
            revert ErrorsLib.E07D_InsufficientSigners(signerCount, signerThreshold);

        // Build message hash matching L3 Index.rebalance format
        bytes32 messageHash = keccak256(abi.encode(
            block.chainid, address(this), "rebalance",
            itpId, removeIndices, addAssets, newWeights, prices
        ));

        // Verify BLS signature
        if (!BLSLib.verifyBLS(aggregatedPubkey, messageHash, blsSignature))
            revert ErrorsLib.E071_InvalidBLSSignature();

        // Index.sol only exists on L3 — issuer relays rebalance to L3 separately
        emit RebalanceCompleted(itpId, 0);
    }

    function transferDeployer(bytes32 itpId, address newDeployer) external override whenNotPaused {
        address currentDeployer = itpDeployer[itpId];
        if (currentDeployer == address(0)) revert ErrorsLib.E099_BridgeItpNotFound(itpId);
        if (msg.sender != currentDeployer) revert ErrorsLib.E100_NotBridgeDeployer(itpId, msg.sender, currentDeployer);
        if (newDeployer == address(0)) revert ErrorsLib.E106_ZeroAddressNotAllowed();

        // Update deployer on BridgeProxy
        itpDeployer[itpId] = newDeployer;

        // Index.sol only exists on L3 — issuer relays transferCreator to L3 separately
        emit DeployerTransferred(itpId, currentDeployer, newDeployer);
    }

    // ============ DEPLOYER PROFILE ============

    function setDeployerProfile(
        string calldata displayName,
        string calldata websiteUrl
    ) external override {
        if (bytes(displayName).length > MAX_NAME_LENGTH)
            revert ErrorsLib.E121_ProfileNameTooLong(bytes(displayName).length, MAX_NAME_LENGTH);
        if (bytes(websiteUrl).length > MAX_URL_LENGTH)
            revert ErrorsLib.E122_ProfileUrlTooLong(bytes(websiteUrl).length, MAX_URL_LENGTH);
        _deployerProfiles[msg.sender] = DeployerProfile(displayName, websiteUrl);
        emit DeployerProfileUpdated(msg.sender, displayName, websiteUrl);
    }

    // ============ VIEW FUNCTIONS ============

    function getDeployerProfile(address deployer)
        external view override
        returns (string memory displayName, string memory websiteUrl)
    {
        DeployerProfile storage p = _deployerProfiles[deployer];
        return (p.displayName, p.websiteUrl);
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
        return orbitToArbitrum[orbitItpId];
    }

    function getOrbitItpId(address bridgedItp) external view override returns (bytes32) {
        return arbitrumToOrbit[bridgedItp];
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
    /// @dev Called by issuers after BLS consensus confirms the fill
    /// @param itpId The L3 ITP identifier
    /// @param user The user who bought ITP via bridge
    /// @param amount Amount of shares to mint (18 decimals)
    /// @param blsSignature Aggregated BLS signature (empty = skip in testing)
    function mintBridgedShares(
        bytes32 itpId,
        address user,
        uint256 amount,
        bytes calldata blsSignature
    ) external override whenNotPaused {
        address bridgedItp = orbitToArbitrum[itpId];
        if (bridgedItp == address(0)) revert ErrorsLib.E099_BridgeItpNotFound(itpId);
        if (amount == 0) revert ErrorsLib.E106_ZeroAddressNotAllowed();

        // BLS verification (skipped if aggregated pubkey not set — local dev / testing)
        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "mintBridgedShares", itpId, user, amount
        ));
        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

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
        bytes calldata blsSignature
    ) external override whenNotPaused {
        address bridgedItp = orbitToArbitrum[itpId];
        if (bridgedItp == address(0)) revert ErrorsLib.E099_BridgeItpNotFound(itpId);
        if (amount == 0) revert ErrorsLib.E106_ZeroAddressNotAllowed();

        bytes32 message = keccak256(abi.encode(
            block.chainid, address(this), "burnBridgedShares", itpId, from, amount
        ));
        bytes memory aggregatedPubkey = issuerRegistry.getAggregatedPubkey();
        if (aggregatedPubkey.length > 0 && !BLSLib.verifyBLS(aggregatedPubkey, message, blsSignature)) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        IBridgedITP(bridgedItp).burn(from, amount);

        emit BridgedSharesBurned(itpId, from, amount);
    }

    // ============ ADMIN FUNCTIONS ============

    /// @notice Admin: deploy BridgedITP and register bidirectional mappings without BLS
    /// @dev Useful for bootstrapping local dev or migrating existing L3 ITPs
    function adminCreateBridgedItp(
        bytes32 orbitItpId,
        string calldata name,
        string calldata symbol
    ) external override onlyOwner returns (address bridgedItpAddress) {
        if (orbitToArbitrum[orbitItpId] != address(0))
            revert ErrorsLib.E07C_OrbitItpAlreadyMapped(orbitItpId, orbitToArbitrum[orbitItpId]);

        bridgedItpAddress = bridgedItpFactory.deployBridgedItp(name, symbol, orbitItpId);

        orbitToArbitrum[orbitItpId] = bridgedItpAddress;
        arbitrumToOrbit[bridgedItpAddress] = orbitItpId;
        itpDeployer[orbitItpId] = msg.sender;

        emit ItpCreated(orbitItpId, bridgedItpAddress, 0, msg.sender);
    }

    function setIssuerRegistry(address _issuerRegistry) external override onlyOwner {
        issuerRegistry = IIssuerRegistry(_issuerRegistry);
    }

    function setBridgedItpFactory(address _bridgedItpFactory) external override onlyOwner {
        bridgedItpFactory = IBridgedItpFactory(_bridgedItpFactory);
    }

    function setSignerThreshold(uint256 _threshold) external onlyOwner {
        signerThreshold = _threshold;
    }

    function setIndexContract(address indexContract_) external override onlyOwner {
        indexContract = IIndex(indexContract_);
    }

    function pause() external override onlyOwner {
        _pause();
    }

    function unpause() external override onlyOwner {
        _unpause();
    }

    // ============ INTERNAL ============

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function _countBits(uint256 bitmap) private pure returns (uint256 count) {
        while (bitmap != 0) {
            count += bitmap & 1;
            bitmap >>= 1;
        }
    }
}
