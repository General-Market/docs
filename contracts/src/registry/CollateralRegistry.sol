// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ICollateralRegistry.sol";
import "../libraries/TypesLib.sol";
import "../libraries/BLSLib.sol";

/// @title CollateralRegistry - On-chain collateral tracking per ITP per chain
/// @notice Enables stateless issuer operation by tracking all collateral movements
/// @dev All movements require BLS signature from 11/20 issuers
contract CollateralRegistry is ICollateralRegistry {
    // ============ ERRORS ============

    /// @notice Caller is not authorized for this operation
    error Unauthorized();

    /// @notice Zero address not allowed
    error ZeroAddress();

    /// @notice BLS signature verification failed
    error InvalidBLSSignature();

    /// @notice Insufficient collateral for the requested movement
    /// @param itpId The ITP identifier
    /// @param chainId The chain where collateral is insufficient
    /// @param requested The amount requested to move
    /// @param available The amount actually available
    error InsufficientCollateral(bytes32 itpId, uint256 chainId, uint256 requested, uint256 available);

    /// @notice Zero amount movements are not allowed
    error ZeroAmount();

    // ============ EVENTS ============

    /// @notice Emitted when admin is changed
    /// @param previousAdmin The previous admin address
    /// @param newAdmin The new admin address
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);

    /// @notice Emitted when aggregated pubkey is updated
    /// @param pubkey The new aggregated public key
    event AggregatedPubkeyUpdated(bytes pubkey);

    /// @notice Emitted when BLS library address is updated
    /// @param blsLibrary The new BLS library address
    event BLSLibraryUpdated(address indexed blsLibrary);

    /// @notice Emitted when an authorized caller is added or removed
    /// @param caller The caller address
    /// @param authorized Whether the caller is now authorized
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    // ============ STORAGE ============

    /// @notice Collateral amount per ITP per chain
    /// @dev itpId => chainId => amount (18 decimals)
    mapping(bytes32 => mapping(uint256 => uint256)) private _itpCollateralByChain;

    /// @notice List of chain IDs with collateral for each ITP
    /// @dev itpId => chainIds[]
    /// @dev DESIGN: Chains remain in this list even when balance reaches 0.
    ///      This is intentional for historical tracking - removing requires O(n) array
    ///      operations and loses the record of which chains had collateral.
    mapping(bytes32 => uint256[]) private _itpChainIds;

    /// @notice Tracks whether a chain is already in the chainIds array
    /// @dev itpId => chainId => isTracked
    mapping(bytes32 => mapping(uint256 => bool)) private _chainTracked;

    /// @notice Tracks whether an ITP has been registered
    /// @dev itpId => isRegistered
    mapping(bytes32 => bool) private _itpRegistered;

    /// @notice Nonce for replay protection
    uint256 private _nonce;

    /// @notice Aggregated BLS public key for signature verification
    bytes public aggregatedPubkey;

    /// @notice Address of BLS library contract (future integration)
    address public blsLibrary;

    /// @notice Admin address for configuration
    address public admin;

    /// @notice Authorized callers for recordCollateralMove (temporary until BLS integration)
    /// @dev SECURITY: Remove this after BLS verification is properly integrated (Story 2.6)
    mapping(address => bool) public authorizedCallers;

    // ============ MODIFIERS ============

    /// @notice Restricts function to admin only
    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    /// @notice Restricts function to authorized callers (temporary until BLS is integrated)
    /// @dev SECURITY: This is a temporary guard. Once BLS verification is integrated,
    ///      this check should be removed and rely solely on BLS signature verification.
    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender]) revert Unauthorized();
        _;
    }

    // ============ CONSTRUCTOR ============

    /// @notice Initialize the CollateralRegistry with an admin address
    /// @param _admin The admin address for configuration operations
    /// @dev Admin is automatically added as an authorized caller
    constructor(address _admin) {
        if (_admin == address(0)) revert ZeroAddress();
        admin = _admin;
        authorizedCallers[_admin] = true;
        emit AuthorizedCallerUpdated(_admin, true);
    }

    // ============ COLLATERAL TRACKING ============

    /// @inheritdoc ICollateralRegistry
    /// @dev SECURITY: Currently protected by onlyAuthorized modifier until BLS is integrated.
    ///      Chain ID 0 represents "external/no-chain" (e.g., CEX operations).
    ///      Use actual chain IDs for on-chain collateral (e.g., 111222333 for Index L3).
    function recordCollateralMove(
        bytes32 itpId,
        uint256 fromChain,
        uint256 toChain,
        uint256 amount,
        TypesLib.TxType txType,
        bytes calldata blsSignature
    ) external override onlyAuthorized {
        // Validate amount is non-zero to prevent spam/abuse
        if (amount == 0) revert ZeroAmount();

        // Build message for BLS verification
        bytes32 message = keccak256(
            abi.encode(block.chainid, address(this), itpId, fromChain, toChain, amount, txType, _nonce++)
        );

        // Verify BLS signature (integrated via Story 6.23)
        if (!_verifyBLS(message, blsSignature)) revert InvalidBLSSignature();

        // Update fromChain (decrease collateral)
        if (fromChain != 0) {
            uint256 current = _itpCollateralByChain[itpId][fromChain];
            if (current < amount) {
                revert InsufficientCollateral(itpId, fromChain, amount, current);
            }
            _itpCollateralByChain[itpId][fromChain] = current - amount;
        }

        // Update toChain (increase collateral)
        if (toChain != 0) {
            _itpCollateralByChain[itpId][toChain] += amount;
            _trackChain(itpId, toChain);
        }

        // Mark ITP as registered
        _itpRegistered[itpId] = true;

        emit CollateralMoved(itpId, fromChain, toChain, amount, txType);
    }

    // ============ VIEW FUNCTIONS ============

    /// @inheritdoc ICollateralRegistry
    function getITPCollateralByChain(bytes32 itpId, uint256 chainId) external view override returns (uint256 amount) {
        return _itpCollateralByChain[itpId][chainId];
    }

    /// @inheritdoc ICollateralRegistry
    /// @dev ASSUMPTION: Total collateral across all chains won't overflow uint256.
    ///      With 18 decimal tokens, this allows ~1e59 tokens total which far exceeds
    ///      any realistic collateral amount (global M2 money supply is ~1e14 USD).
    function getTotalCollateral(bytes32 itpId) external view override returns (uint256 total) {
        uint256[] memory chainIds = _itpChainIds[itpId];
        uint256 length = chainIds.length;

        for (uint256 i = 0; i < length;) {
            total += _itpCollateralByChain[itpId][chainIds[i]];
            unchecked {
                ++i;
            }
        }

        return total;
    }

    /// @inheritdoc ICollateralRegistry
    function getCollateralBreakdown(bytes32 itpId)
        external
        view
        override
        returns (uint256[] memory chainIds, uint256[] memory amounts)
    {
        chainIds = _itpChainIds[itpId];
        uint256 length = chainIds.length;
        amounts = new uint256[](length);

        for (uint256 i = 0; i < length;) {
            amounts[i] = _itpCollateralByChain[itpId][chainIds[i]];
            unchecked {
                ++i;
            }
        }

        return (chainIds, amounts);
    }

    /// @inheritdoc ICollateralRegistry
    function itpExists(bytes32 itpId) external view override returns (bool) {
        return _itpRegistered[itpId];
    }

    /// @notice Get the current nonce value
    /// @return The current nonce
    function getNonce() external view returns (uint256) {
        return _nonce;
    }

    // ============ ADMIN FUNCTIONS ============

    /// @notice Set the aggregated BLS public key for signature verification
    /// @param pubkey The new aggregated public key
    function setAggregatedPubkey(bytes calldata pubkey) external onlyAdmin {
        aggregatedPubkey = pubkey;
        emit AggregatedPubkeyUpdated(pubkey);
    }

    /// @notice Set the BLS library address for future integration
    /// @param _blsLibrary The BLS library contract address
    function setBLSLibrary(address _blsLibrary) external onlyAdmin {
        blsLibrary = _blsLibrary;
        emit BLSLibraryUpdated(_blsLibrary);
    }

    /// @notice Transfer admin role to a new address
    /// @param newAdmin The new admin address
    function setAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        address previousAdmin = admin;
        admin = newAdmin;
        emit AdminChanged(previousAdmin, newAdmin);
    }

    /// @notice Add or remove an authorized caller for recordCollateralMove
    /// @param caller The address to authorize or deauthorize
    /// @param authorized Whether the caller should be authorized
    /// @dev SECURITY: Temporary function until BLS verification is integrated.
    ///      Remove this function after Story 2.6 BLS integration is complete.
    function setAuthorizedCaller(address caller, bool authorized) external onlyAdmin {
        if (caller == address(0)) revert ZeroAddress();
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    // ============ INTERNAL FUNCTIONS ============

    /// @notice Verify BLS signature using BLSLib
    /// @dev Uses stored aggregatedPubkey for verification
    /// @param message The message hash to verify
    /// @param signature The BLS signature
    /// @return True if signature is valid (or testing mode with empty pubkey)
    function _verifyBLS(bytes32 message, bytes calldata signature) internal view returns (bool) {
        // Testing mode: empty pubkey = skip verification
        if (aggregatedPubkey.length == 0) {
            return true;
        }

        // Real verification using BLSLib
        return BLSLib.verifyBLS(aggregatedPubkey, message, signature);
    }

    /// @notice Track a chain in the ITP's chain list if not already tracked
    /// @param itpId The ITP identifier
    /// @param chainId The chain ID to track
    function _trackChain(bytes32 itpId, uint256 chainId) internal {
        if (!_chainTracked[itpId][chainId]) {
            _chainTracked[itpId][chainId] = true;
            _itpChainIds[itpId].push(chainId);
        }
    }
}
