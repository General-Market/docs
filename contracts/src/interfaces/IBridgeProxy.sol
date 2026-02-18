// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IIssuerRegistry.sol";
import "./IBridgedItpFactory.sol";

/// @title IBridgeProxy - Cross-chain ITP creation and token bridging
/// @notice Interface for the BridgeProxy contract deployed on Arbitrum
/// @dev UUPS upgradeable, pausable, with BLS signature verification
interface IBridgeProxy {
    // ============ Structs ============

    /// @notice Pending ITP creation request
    struct PendingItpCreation {
        address admin;           // Creator address
        string name;             // ITP name (max 32 chars)
        string symbol;           // ITP symbol (max 10 chars)
        uint256[] weights;       // Asset weights (sum to 1e18)
        address[] assets;        // Asset addresses
        uint256[] prices;        // Asset prices for inventory computation
        uint64 createdAt;        // Block timestamp when created
        bool completed;          // Whether creation is complete
    }

    /// @notice Pending rebalance request
    struct PendingRebalanceRequest {
        address deployer;        // Deployer who requested rebalance
        bytes32 itpId;           // ITP to rebalance
        uint256[] newWeights;    // Target weights
        uint64 createdAt;        // Block timestamp when created
        bool completed;          // Whether rebalance is complete
    }

    /// @notice Deployer display profile (display-only metadata)
    struct DeployerProfile {
        string displayName;
        string websiteUrl;
    }

    // ============ View Functions ============

    /// @notice Maximum number of assets per ITP
    function MAX_ASSETS() external view returns (uint256);

    /// @notice Minimum weight per asset (0.25%)
    function MIN_WEIGHT() external view returns (uint256);

    /// @notice Required weight sum (100%)
    function WEIGHT_SUM() external view returns (uint256);

    /// @notice Maximum name length
    function MAX_NAME_LENGTH() external view returns (uint256);

    /// @notice Maximum symbol length
    function MAX_SYMBOL_LENGTH() external view returns (uint256);

    /// @notice IssuerRegistry for BLS key lookup
    function issuerRegistry() external view returns (IIssuerRegistry);

    /// @notice Factory for deploying BridgedITP tokens
    function bridgedItpFactory() external view returns (IBridgedItpFactory);

    /// @notice Next nonce for creation requests
    function nextCreationNonce() external view returns (uint256);

    /// @notice L3 orbitItpId => Arbitrum bridgedItp address
    function orbitToArbitrum(bytes32 orbitItpId) external view returns (address);

    /// @notice Arbitrum bridgedItp address => L3 orbitItpId
    function arbitrumToOrbit(address bridgedItp) external view returns (bytes32);

    /// @notice Get full pending creation details
    function getPendingCreation(uint256 nonce) external view returns (
        address admin,
        string memory name,
        string memory symbol,
        uint256[] memory weights,
        address[] memory assets,
        uint256[] memory prices,
        uint64 createdAt,
        bool completed
    );

    /// @notice Check if a request is pending (exists and not completed)
    function isPending(uint256 nonce) external view returns (bool);

    /// @notice Get bridged ITP address for L3 ITP
    function getBridgedItp(bytes32 orbitItpId) external view returns (address);

    /// @notice Get L3 ITP ID for bridged ITP
    function getOrbitItpId(address bridgedItp) external view returns (bytes32);

    /// @notice Get the deployer for an ITP
    function itpDeployer(bytes32 itpId) external view returns (address);

    /// @notice Next nonce for rebalance requests
    function nextRebalanceNonce() external view returns (uint256);

    /// @notice Get pending rebalance request details
    function getPendingRebalance(uint256 nonce) external view returns (
        address deployer,
        bytes32 itpId,
        uint256[] memory newWeights,
        uint64 createdAt,
        bool completed
    );

    /// @notice Check if a rebalance request is pending
    function isRebalancePending(uint256 nonce) external view returns (bool);

    // ============ External Functions ============

    /// @notice Request creation of a new ITP
    /// @param name ITP name (max 32 characters)
    /// @param symbol ITP symbol (max 10 characters)
    /// @param weights Asset weights (must sum to 1e18)
    /// @param assets Asset addresses (same length as weights)
    /// @param prices Asset prices for inventory computation (18 decimals)
    /// @return nonce Unique identifier for this request
    function requestCreateItp(
        string calldata name,
        string calldata symbol,
        uint256[] calldata weights,
        address[] calldata assets,
        uint256[] calldata prices
    ) external returns (uint256 nonce);

    /// @notice Complete ITP creation with BLS signature from issuers
    /// @dev Atomically creates ITP on L3 via indexContract.createITP() and deploys BridgedITP
    /// @param nonce Request nonce from requestCreateItp
    /// @param signerBitmap Bitmap of which issuers signed
    /// @param aggregatedPubkey Aggregated BLS public key (128 bytes G2)
    /// @param blsSignature Aggregated BLS signature (64 bytes G1)
    /// @return bridgedItpAddress Deployed BridgedITP token address
    function completeCreateItp(
        uint256 nonce,
        bytes32 orbitItpId,
        uint256 signerBitmap,
        bytes calldata aggregatedPubkey,
        bytes calldata blsSignature
    ) external returns (address bridgedItpAddress);

    /// @notice Request a rebalance (permissionless, event-only)
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
    ) external returns (uint256 nonce);

    /// @notice Execute rebalance on L3 Index via cross-chain BLS consensus
    /// @param itpId The L3 ITP identifier
    /// @param removeIndices Indices to remove (sorted descending)
    /// @param addAssets New asset addresses to add
    /// @param newWeights Weights for the final asset list
    /// @param prices Prices for inventory computation
    /// @param signerBitmap Bitmap of which issuers signed
    /// @param aggregatedPubkey Aggregated BLS public key (128 bytes G2)
    /// @param blsSignature Aggregated BLS signature (64 bytes G1)
    function rebalance(
        bytes32 itpId,
        uint256[] calldata removeIndices,
        address[] calldata addAssets,
        uint256[] calldata newWeights,
        uint256[] calldata prices,
        uint256 signerBitmap,
        bytes calldata aggregatedPubkey,
        bytes calldata blsSignature
    ) external;

    /// @notice Transfer deployer role for an ITP
    /// @param itpId The L3 ITP identifier
    /// @param newDeployer The new deployer address
    function transferDeployer(bytes32 itpId, address newDeployer) external;

    /// @notice Mint BridgedITP shares after cross-chain buy order fill on L3
    /// @param itpId The L3 ITP identifier
    /// @param user The user who bought ITP via bridge
    /// @param amount Amount of shares to mint (18 decimals)
    /// @param blsSignature Aggregated BLS signature
    function mintBridgedShares(
        bytes32 itpId,
        address user,
        uint256 amount,
        bytes calldata blsSignature
    ) external;

    /// @notice Burn BridgedITP shares (e.g., after sell order completion)
    /// @param itpId The L3 ITP identifier
    /// @param from Address holding the BridgedITP tokens
    /// @param amount Amount of shares to burn (18 decimals)
    /// @param blsSignature Aggregated BLS signature
    function burnBridgedShares(
        bytes32 itpId,
        address from,
        uint256 amount,
        bytes calldata blsSignature
    ) external;

    /// @notice Set the Index contract address for atomic ITP creation
    /// @param indexContract_ Address of the Index contract on L3
    function setIndexContract(address indexContract_) external;

    // ============ Admin Functions ============

    /// @notice Admin: deploy BridgedITP and register mappings without BLS
    /// @param orbitItpId The L3 ITP identifier
    /// @param name BridgedITP token name
    /// @param symbol BridgedITP token symbol
    /// @return bridgedItpAddress Deployed BridgedITP token address
    function adminCreateBridgedItp(
        bytes32 orbitItpId,
        string calldata name,
        string calldata symbol
    ) external returns (address bridgedItpAddress);

    /// @notice Update IssuerRegistry address
    function setIssuerRegistry(address _issuerRegistry) external;

    /// @notice Update BridgedItpFactory address
    function setBridgedItpFactory(address _bridgedItpFactory) external;

    /// @notice Pause the contract
    function pause() external;

    /// @notice Unpause the contract
    function unpause() external;

    // ============ Events ============

    /// @notice Emitted when user requests ITP creation
    event CreateItpRequested(
        address indexed admin,
        uint256 indexed nonce,
        string name,
        string symbol,
        uint256[] weights,
        address[] assets
    );

    /// @notice Emitted when ITP creation is completed
    event ItpCreated(
        bytes32 indexed orbitItpId,
        address indexed bridgedItpAddress,
        uint256 indexed nonce,
        address admin
    );

    /// @notice Emitted when a rebalance request is submitted
    event RebalanceRequested(
        address indexed requester,
        bytes32 indexed itpId,
        uint256 indexed nonce,
        uint256[] removeIndices,
        address[] addAssets,
        uint256[] newWeights,
        string note
    );

    /// @notice Emitted when rebalance is executed via cross-chain BLS consensus
    event RebalanceCompleted(
        bytes32 indexed itpId,
        uint256 indexed nonce
    );

    /// @notice Emitted when deployer role is transferred
    event DeployerTransferred(
        bytes32 indexed itpId,
        address indexed oldDeployer,
        address indexed newDeployer
    );

    /// @notice Emitted when BridgedITP shares are minted (cross-chain buy fill)
    event BridgedSharesMinted(
        bytes32 indexed itpId,
        address indexed user,
        uint256 amount
    );

    /// @notice Emitted when BridgedITP shares are burned (cross-chain sell)
    event BridgedSharesBurned(
        bytes32 indexed itpId,
        address indexed from,
        uint256 amount
    );

    /// @notice Emitted when a deployer updates their profile
    event DeployerProfileUpdated(
        address indexed deployer,
        string displayName,
        string websiteUrl
    );

    // ============ Deployer Profile Functions ============

    /// @notice Set the caller's deployer profile (display name + website URL)
    function setDeployerProfile(string calldata displayName, string calldata websiteUrl) external;

    /// @notice Get a deployer's profile
    function getDeployerProfile(address deployer) external view returns (string memory displayName, string memory websiteUrl);

    /// @notice Maximum URL length for deployer profiles
    function MAX_URL_LENGTH() external view returns (uint256);
}
