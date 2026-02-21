// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IFeeRegistry.sol";
import "../libraries/TypesLib.sol";
import "../libraries/BLSLib.sol";
import "../libraries/BLSVerifier.sol";
import "../interfaces/IIssuerRegistry.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title FeeRegistry - Fee calculation and distribution for Index L3
/// @notice Tracks trading fees, management fees, bridge costs, and gas costs per ITP
/// @dev UUPS upgradeable. All fee movements require BLS signature from 11/20 issuers.
contract FeeRegistry is IFeeRegistry, Initializable, UUPSUpgradeable, BLSVerifier {
    // ============ ERRORS ============

    /// @notice Caller is not authorized for this operation
    error Unauthorized();

    /// @notice Zero address not allowed
    error ZeroAddress();

    /// @notice BLS signature verification failed
    error InvalidBLSSignature();

    /// @notice Zero amount not allowed
    error ZeroAmount();

    /// @notice Fee rate exceeds maximum (10%)
    /// @param rate The submitted rate
    /// @param maxRate The maximum allowed rate (1000 bps)
    error FeeRateExceedsMax(uint256 rate, uint256 maxRate);

    /// @notice Deployer share exceeds maximum (100%)
    /// @param share The submitted share
    error InvalidDeployerShare(uint256 share);

    /// @notice No fees available to claim
    /// @param itpId The ITP identifier
    error NoFeesToClaim(bytes32 itpId);

    /// @notice Only ITP deployer can claim fees
    /// @param itpId The ITP identifier
    /// @param caller The caller address
    /// @param deployer The actual deployer address
    error NotITPDeployer(bytes32 itpId, address caller, address deployer);

    /// @notice Division by zero in fee calculation
    error DivisionByZero();

    // ============ EVENTS ============

    /// @notice Emitted when admin is changed
    /// @param previousAdmin The previous admin address
    /// @param newAdmin The new admin address
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);

    /// @notice Emitted when aggregated pubkey is updated
    /// @param pubkey The new aggregated public key
    event AggregatedPubkeyUpdated(bytes pubkey);

    /// @notice Emitted when an authorized caller is added or removed
    /// @param caller The caller address
    /// @param authorized Whether the caller is now authorized
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    /// @notice Emitted when ITP deployer is registered
    /// @param itpId The ITP identifier
    /// @param deployer The deployer address
    event ITPDeployerRegistered(bytes32 indexed itpId, address indexed deployer);

    /// @notice Emitted when BLS library address is updated
    /// @param blsLibrary The new BLS library address
    event BLSLibraryUpdated(address indexed blsLibrary);

    // ============ CONSTANTS ============

    /// @notice Maximum fee rate in basis points (10% = 1000 bps)
    uint256 public constant MAX_FEE_RATE = 1000;

    /// @notice High fee warning threshold (2% = 200 bps)
    uint256 public constant HIGH_FEE_THRESHOLD = 200;

    /// @notice Default deployer share (70% = 7000 bps)
    uint256 public constant DEFAULT_DEPLOYER_SHARE = 7000;

    /// @notice Basis points denominator (10000 = 100%)
    uint256 public constant BASIS_POINTS = 10000;

    // ============ STORAGE ============

    /// @notice Fee rate per ITP in basis points (10000 = 100%)
    /// @dev Max 1000 (10% annualized management fee)
    mapping(bytes32 => uint256) private _feeRates;

    /// @notice Accumulated fees per ITP per fee type (18 decimals)
    mapping(bytes32 => mapping(TypesLib.FeeType => uint256)) private _accumulatedFees;

    /// @notice Total fees deployer has claimed their share from (18 decimals)
    /// @dev Tracks the fee base that deployer has processed, not the actual amount received
    mapping(bytes32 => uint256) private _deployerClaimedFromTotal;

    /// @notice Total fees protocol has claimed their share from (18 decimals)
    /// @dev Tracks the fee base that protocol has processed, not the actual amount received
    mapping(bytes32 => uint256) private _protocolClaimedFromTotal;

    /// @notice Deployer share in basis points (default 7000 = 70%)
    uint256 public deployerShareBps;

    /// @notice DEPRECATED: was aggregatedPubkey, slot preserved for UUPS layout
    bytes private _deprecated_aggregatedPubkey;

    /// @notice DEPRECATED: was blsLibrary, slot preserved for UUPS layout
    address private _deprecated_blsLibrary;

    /// @dev Replay-protection nonce. Domain-separated by including the function name
    /// string in each signed payload (e.g. "setFees", "setGlobalFee"), so nonces from
    /// one function cannot be replayed against another.
    uint256 private _nonce;

    /// @notice Admin address
    address public admin;

    /// @notice Authorized callers (for fee recording and ITP registration)
    mapping(address => bool) public authorizedCallers;

    /// @notice ITP deployer addresses for claim authorization
    mapping(bytes32 => address) private _itpDeployers;

    // ============ STORAGE GAP ============

    /// @dev Reserved storage slots for future upgrades.
    ///      Slot accounting (each mapping/variable = 1 slot):
    ///        _feeRates(0), _accumulatedFees(1), _deployerClaimedFromTotal(2),
    ///        _protocolClaimedFromTotal(3), deployerShareBps(4), _deprecated_aggregatedPubkey(5),
    ///        _deprecated_blsLibrary(6), _nonce(7), admin(8), authorizedCallers(9),
    ///        _itpDeployers(10) = 11 slots used
    ///      BLSVerifier adds 1 slot (_blsIssuerRegistry) = 12 slots used
    ///      Target: 50 total slots for upgradeability buffer
    ///      Gap: 50 - 12 = 38 slots
    uint256[38] private __gap;

    // ============ MODIFIERS ============

    /// @notice Restricts function to admin only
    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    /// @notice Restricts function to authorized callers (includes Investment.sol for ITP registration)
    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender]) revert Unauthorized();
        _;
    }

    // ============ INITIALIZER ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the FeeRegistry with an admin address
    /// @param _admin The admin address for configuration operations
    function initialize(address _admin) external initializer {
        __UUPSUpgradeable_init();

        if (_admin == address(0)) revert ZeroAddress();
        admin = _admin;
        authorizedCallers[_admin] = true;
        deployerShareBps = DEFAULT_DEPLOYER_SHARE;
        emit AuthorizedCallerUpdated(_admin, true);
    }

    /// @notice Set the IssuerRegistry for BLS verification (admin only, one-time setup)
    /// @param issuerRegistry_ Address of the IssuerRegistry contract
    function setIssuerRegistry(address issuerRegistry_) external onlyAdmin {
        __BLSVerifier_init(issuerRegistry_);
    }

    // ============ FEE RATE MANAGEMENT ============

    /// @inheritdoc IFeeRegistry
    function setFeeRate(bytes32 itpId, uint256 feeRate, bytes calldata blsSignature) external override onlyAuthorized {
        // Validate fee rate
        if (feeRate > MAX_FEE_RATE) revert FeeRateExceedsMax(feeRate, MAX_FEE_RATE);

        // Build message for BLS verification
        bytes32 message = keccak256(
            abi.encode(block.chainid, address(this), "setFeeRate", itpId, feeRate, _nonce++)
        );

        // Verify BLS signature
        _verifyBLS(message, blsSignature);

        // Update fee rate
        uint256 oldRate = _feeRates[itpId];
        _feeRates[itpId] = feeRate;

        emit FeeRateUpdated(itpId, oldRate, feeRate);
    }

    /// @inheritdoc IFeeRegistry
    function getFeeRate(bytes32 itpId) external view override returns (uint256 feeRate) {
        return _feeRates[itpId];
    }

    // ============ FEE RECORDING ============

    /// @inheritdoc IFeeRegistry
    function recordFeeCharge(
        address user,
        bytes32 itpId,
        uint256 feeAmount,
        TypesLib.FeeType feeType,
        bytes calldata blsSignature
    ) external override onlyAuthorized {
        // Validate inputs
        if (user == address(0)) revert ZeroAddress();
        if (feeAmount == 0) revert ZeroAmount();

        // Build message for BLS verification
        bytes32 message = keccak256(
            abi.encode(block.chainid, address(this), "recordFeeCharge", user, itpId, feeAmount, feeType, _nonce++)
        );

        // Verify BLS signature
        _verifyBLS(message, blsSignature);

        // Record fee
        _accumulatedFees[itpId][feeType] += feeAmount;

        emit FeeCharged(user, itpId, feeAmount, feeType);
    }

    // ============ FEE QUERIES ============

    /// @inheritdoc IFeeRegistry
    function getAccumulatedFees(bytes32 itpId)
        external
        view
        override
        returns (uint256 trading, uint256 management, uint256 bridge, uint256 gas)
    {
        trading = _accumulatedFees[itpId][TypesLib.FeeType.TRADING];
        management = _accumulatedFees[itpId][TypesLib.FeeType.MANAGEMENT];
        bridge = _accumulatedFees[itpId][TypesLib.FeeType.BRIDGE];
        gas = _accumulatedFees[itpId][TypesLib.FeeType.GAS];
    }

    /// @inheritdoc IFeeRegistry
    function getTotalFees(bytes32 itpId) external view override returns (uint256 total) {
        total = _accumulatedFees[itpId][TypesLib.FeeType.TRADING]
            + _accumulatedFees[itpId][TypesLib.FeeType.MANAGEMENT]
            + _accumulatedFees[itpId][TypesLib.FeeType.BRIDGE]
            + _accumulatedFees[itpId][TypesLib.FeeType.GAS];
    }

    // ============ FEE DISTRIBUTION ============

    /// @inheritdoc IFeeRegistry
    function setFeeSplit(uint256 _deployerShareBps, bytes calldata blsSignature) external override onlyAuthorized {
        // Validate share
        if (_deployerShareBps > BASIS_POINTS) revert InvalidDeployerShare(_deployerShareBps);

        // Build message for BLS verification
        bytes32 message = keccak256(
            abi.encode(block.chainid, address(this), "setFeeSplit", _deployerShareBps, _nonce++)
        );

        // Verify BLS signature
        _verifyBLS(message, blsSignature);

        // Update deployer share
        deployerShareBps = _deployerShareBps;

        emit FeeSplitUpdated(_deployerShareBps);
    }

    /// @inheritdoc IFeeRegistry
    function claimFees(bytes32 itpId, address recipient) external override {
        // Validate recipient
        if (recipient == address(0)) revert ZeroAddress();

        // Check caller is ITP deployer
        address deployer = _itpDeployers[itpId];
        if (deployer == address(0)) revert NotITPDeployer(itpId, msg.sender, address(0));
        if (msg.sender != deployer) revert NotITPDeployer(itpId, msg.sender, deployer);

        // Calculate claimable amount (deployer's share of unclaimed fees)
        uint256 claimable = _calculateDeployerClaimable(itpId);
        if (claimable == 0) revert NoFeesToClaim(itpId);

        // Get current total for tracking
        uint256 total = _getTotalAccumulated(itpId);

        // Update deployer's claimed tracking to current total
        // This marks all current fees as processed FOR THE DEPLOYER
        // Protocol can still claim their share independently
        _deployerClaimedFromTotal[itpId] = total;

        // NOTE: Actual token transfer happens via separate custody mechanism
        // FeeRegistry only tracks amounts, doesn't hold tokens

        emit FeesClaimed(itpId, recipient, claimable);
    }

    /// @inheritdoc IFeeRegistry
    function getClaimableFees(bytes32 itpId) external view override returns (uint256 claimable) {
        return _calculateDeployerClaimable(itpId);
    }

    /// @inheritdoc IFeeRegistry
    function getClaimedFees(bytes32 itpId) external view override returns (uint256 claimed) {
        // Return the higher of the two tracking values as the "total processed" indicator
        // This represents how much of the fee pool has been claimed from
        uint256 deployerBase = _deployerClaimedFromTotal[itpId];
        uint256 protocolBase = _protocolClaimedFromTotal[itpId];
        return deployerBase > protocolBase ? deployerBase : protocolBase;
    }

    /// @inheritdoc IFeeRegistry
    function getProtocolClaimableFees(bytes32 itpId) external view override returns (uint256 claimable) {
        return _calculateProtocolClaimable(itpId);
    }

    // ============ FEE CALCULATION HELPERS ============

    /// @inheritdoc IFeeRegistry
    function isHighFeeOrder(uint256 orderAmount, uint256 estimatedFee) external pure override returns (bool isHigh) {
        if (orderAmount == 0) return true; // Edge case: zero order always "high fee"
        // High fee if estimatedFee / orderAmount > 2% (200 bps)
        // Rearranged to avoid division: estimatedFee * 10000 > orderAmount * 200
        return estimatedFee * BASIS_POINTS > orderAmount * HIGH_FEE_THRESHOLD;
    }

    /// @inheritdoc IFeeRegistry
    function calculateFeeShare(
        uint256 orderAmount,
        uint256 totalBatchAmount,
        uint256 totalFee
    ) external pure override returns (uint256 feeShare) {
        if (totalBatchAmount == 0) revert DivisionByZero();
        // Proportional share: totalFee * orderAmount / totalBatchAmount
        return (totalFee * orderAmount) / totalBatchAmount;
    }

    // ============ ADMIN FUNCTIONS ============

    /// @inheritdoc IFeeRegistry
    function setAdmin(address newAdmin) external override onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        address previousAdmin = admin;
        admin = newAdmin;
        emit AdminChanged(previousAdmin, newAdmin);
    }

    /// @inheritdoc IFeeRegistry
    function setAuthorizedCaller(address caller, bool authorized) external override onlyAdmin {
        if (caller == address(0)) revert ZeroAddress();
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    /// @inheritdoc IFeeRegistry
    /// @dev Callable by authorized callers (including Investment.sol) to register deployers when ITPs are created
    function registerITPDeployer(bytes32 itpId, address deployer) external override onlyAuthorized {
        if (deployer == address(0)) revert ZeroAddress();
        _itpDeployers[itpId] = deployer;
        emit ITPDeployerRegistered(itpId, deployer);
    }

    /// @inheritdoc IFeeRegistry
    function getNonce() external view override returns (uint256) {
        return _nonce;
    }

    /// @inheritdoc IFeeRegistry
    function getITPDeployer(bytes32 itpId) external view override returns (address deployer) {
        return _itpDeployers[itpId];
    }

    /// @inheritdoc IFeeRegistry
    function claimProtocolFees(bytes32 itpId, address recipient) external override onlyAdmin {
        if (recipient == address(0)) revert ZeroAddress();

        // Calculate protocol's claimable amount
        uint256 protocolAmount = _calculateProtocolClaimable(itpId);
        if (protocolAmount == 0) revert NoFeesToClaim(itpId);

        // Get current total for tracking
        uint256 total = _getTotalAccumulated(itpId);

        // Update protocol's claimed tracking to current total
        // This marks all current fees as processed FOR THE PROTOCOL
        // Deployer can still claim their share independently
        _protocolClaimedFromTotal[itpId] = total;

        // NOTE: Actual token transfer happens via separate custody mechanism
        // FeeRegistry only tracks amounts, doesn't hold tokens

        emit FeesClaimed(itpId, recipient, protocolAmount);
    }

    // ============ INTERNAL FUNCTIONS ============

    /// @notice Get total accumulated fees for an ITP
    /// @param itpId The ITP identifier
    /// @return total Sum of all fee types
    function _getTotalAccumulated(bytes32 itpId) internal view returns (uint256 total) {
        total = _accumulatedFees[itpId][TypesLib.FeeType.TRADING]
            + _accumulatedFees[itpId][TypesLib.FeeType.MANAGEMENT]
            + _accumulatedFees[itpId][TypesLib.FeeType.BRIDGE]
            + _accumulatedFees[itpId][TypesLib.FeeType.GAS];
    }

    /// @notice Calculate claimable fees for an ITP deployer
    /// @dev Deployer and protocol claims are tracked separately to avoid race conditions
    /// @param itpId The ITP identifier
    /// @return claimable Amount claimable by deployer (their share of unprocessed fees)
    function _calculateDeployerClaimable(bytes32 itpId) internal view returns (uint256 claimable) {
        uint256 total = _getTotalAccumulated(itpId);
        uint256 deployerClaimedFrom = _deployerClaimedFromTotal[itpId];

        if (total <= deployerClaimedFrom) {
            return 0;
        }

        uint256 unprocessed = total - deployerClaimedFrom;
        // Deployer gets deployerShareBps / 10000 of unprocessed fees
        claimable = (unprocessed * deployerShareBps) / BASIS_POINTS;
    }

    /// @notice Calculate claimable fees for the protocol
    /// @dev Deployer and protocol claims are tracked separately to avoid race conditions
    /// @param itpId The ITP identifier
    /// @return claimable Amount claimable by protocol (their share of unprocessed fees)
    function _calculateProtocolClaimable(bytes32 itpId) internal view returns (uint256 claimable) {
        uint256 total = _getTotalAccumulated(itpId);
        uint256 protocolClaimedFrom = _protocolClaimedFromTotal[itpId];

        if (total <= protocolClaimedFrom) {
            return 0;
        }

        uint256 unprocessed = total - protocolClaimedFrom;
        // Protocol gets (BASIS_POINTS - deployerShareBps) / BASIS_POINTS of unprocessed fees
        uint256 protocolShareBps = BASIS_POINTS - deployerShareBps;
        claimable = (unprocessed * protocolShareBps) / BASIS_POINTS;
    }

    // BLS verification via inherited BLSVerifier._verifyBLS()

    /// @notice Authorize upgrade (UUPS pattern)
    /// @dev Only admin can upgrade
    function _authorizeUpgrade(address newImplementation) internal view override {
        if (msg.sender != admin) revert Unauthorized();
        (newImplementation); // Suppress unused parameter warning
    }
}
