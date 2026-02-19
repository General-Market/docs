// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/TypesLib.sol";

/// @title IFeeRegistry - Interface for fee calculation and distribution
/// @notice Tracks trading fees, management fees, bridge costs, and gas costs per ITP
/// @dev All monetary values use 18 decimals precision
interface IFeeRegistry {
    // ============ EVENTS ============

    /// @notice Emitted when ITP fee rate is updated
    /// @param itpId The ITP identifier
    /// @param oldRate Previous fee rate in basis points
    /// @param newRate New fee rate in basis points
    event FeeRateUpdated(bytes32 indexed itpId, uint256 oldRate, uint256 newRate);

    /// @notice Emitted when a fee is charged (per-order or batch)
    /// @param user Address of the user charged
    /// @param itpId The ITP identifier
    /// @param amount Fee amount (18 decimals)
    /// @param feeType Type of fee charged
    event FeeCharged(
        address indexed user,
        bytes32 indexed itpId,
        uint256 amount,
        TypesLib.FeeType feeType
    );

    /// @notice Emitted when fee split ratios are updated
    /// @param deployerShareBps New deployer share in basis points
    event FeeSplitUpdated(uint256 deployerShareBps);

    /// @notice Emitted when fees are claimed by deployer
    /// @param itpId The ITP identifier
    /// @param recipient Address receiving the fees
    /// @param amount Amount claimed (18 decimals)
    event FeesClaimed(
        bytes32 indexed itpId,
        address indexed recipient,
        uint256 amount
    );

    // ============ FEE RATE MANAGEMENT ============

    /// @notice Set the fee rate for an ITP
    /// @dev Requires BLS signature from issuer consensus
    /// @param itpId The ITP identifier
    /// @param feeRate Fee rate in basis points (max 1000 = 10%)
    /// @param blsSignature BLS signature from issuer consensus
    function setFeeRate(bytes32 itpId, uint256 feeRate, bytes calldata blsSignature) external;

    /// @notice Get the current fee rate for an ITP
    /// @param itpId The ITP identifier
    /// @return feeRate Fee rate in basis points
    function getFeeRate(bytes32 itpId) external view returns (uint256 feeRate);

    // ============ FEE RECORDING ============

    /// @notice Record a fee charge for a user
    /// @dev Requires BLS signature from issuer consensus
    /// @param user Address of the user being charged
    /// @param itpId The ITP identifier
    /// @param feeAmount Fee amount (18 decimals)
    /// @param feeType Type of fee being charged
    /// @param blsSignature BLS signature from issuer consensus
    function recordFeeCharge(
        address user,
        bytes32 itpId,
        uint256 feeAmount,
        TypesLib.FeeType feeType,
        bytes calldata blsSignature
    ) external;

    // ============ FEE QUERIES ============

    /// @notice Get accumulated fees for an ITP by type
    /// @param itpId The ITP identifier
    /// @return trading Accumulated trading fees
    /// @return management Accumulated management fees
    /// @return bridge Accumulated bridge fees
    /// @return gas Accumulated gas fees
    function getAccumulatedFees(bytes32 itpId)
        external
        view
        returns (uint256 trading, uint256 management, uint256 bridge, uint256 gas);

    /// @notice Get total accumulated fees for an ITP (all types)
    /// @param itpId The ITP identifier
    /// @return total Sum of all fee types
    function getTotalFees(bytes32 itpId) external view returns (uint256 total);

    // ============ FEE DISTRIBUTION ============

    /// @notice Set the fee split ratio between deployer and protocol
    /// @dev Requires BLS signature from issuer consensus
    /// @param deployerShareBps Deployer share in basis points (default 7000 = 70%)
    /// @param blsSignature BLS signature from issuer consensus
    function setFeeSplit(uint256 deployerShareBps, bytes calldata blsSignature) external;

    /// @notice Claim accumulated fees for an ITP
    /// @dev Only callable by ITP deployer
    /// @param itpId The ITP identifier
    /// @param recipient Address to receive the fees
    function claimFees(bytes32 itpId, address recipient) external;

    /// @notice Get claimable fees for an ITP deployer
    /// @param itpId The ITP identifier
    /// @return claimable Amount claimable by deployer
    function getClaimableFees(bytes32 itpId) external view returns (uint256 claimable);

    /// @notice Get total claimed fees for an ITP (for transparency/auditing)
    /// @param itpId The ITP identifier
    /// @return claimed Total fees that have been claimed (processed)
    function getClaimedFees(bytes32 itpId) external view returns (uint256 claimed);

    /// @notice Get claimable fees for the protocol
    /// @param itpId The ITP identifier
    /// @return claimable Amount claimable by protocol (admin)
    function getProtocolClaimableFees(bytes32 itpId) external view returns (uint256 claimable);

    // ============ FEE CALCULATION HELPERS ============

    /// @notice Check if order has high fees relative to amount (warning threshold)
    /// @param orderAmount Order amount (18 decimals)
    /// @param estimatedFee Estimated fee amount (18 decimals)
    /// @return isHigh True if fee > 2% of order amount
    function isHighFeeOrder(uint256 orderAmount, uint256 estimatedFee) external pure returns (bool isHigh);

    /// @notice Calculate proportional fee share for an order in a batch
    /// @param orderAmount Individual order amount (18 decimals)
    /// @param totalBatchAmount Total batch amount (18 decimals)
    /// @param totalFee Total fee for the batch (18 decimals)
    /// @return feeShare Proportional fee for this order
    function calculateFeeShare(
        uint256 orderAmount,
        uint256 totalBatchAmount,
        uint256 totalFee
    ) external pure returns (uint256 feeShare);

    // ============ ADMIN FUNCTIONS ============

    /// @notice Set the IssuerRegistry for BLS verification
    /// @param issuerRegistry_ Address of the IssuerRegistry contract
    function setIssuerRegistry(address issuerRegistry_) external;

    /// @notice Transfer admin role to a new address
    /// @param newAdmin The new admin address
    function setAdmin(address newAdmin) external;

    /// @notice Add or remove an authorized caller
    /// @param caller The address to authorize or deauthorize
    /// @param authorized Whether the caller should be authorized
    function setAuthorizedCaller(address caller, bool authorized) external;

    /// @notice Register an ITP deployer for fee claiming
    /// @param itpId The ITP identifier
    /// @param deployer The deployer address
    function registerITPDeployer(bytes32 itpId, address deployer) external;

    /// @notice Set the BLS library address for signature verification
    /// @param _blsLibrary The BLS library contract address
    function setBLSLibrary(address _blsLibrary) external;

    /// @notice Claim protocol's share of accumulated fees
    /// @dev Only callable by admin. Protocol share = (100% - deployerShare)
    /// @param itpId The ITP identifier
    /// @param recipient Address to receive the protocol fees
    function claimProtocolFees(bytes32 itpId, address recipient) external;

    /// @notice Get the current nonce value
    /// @return The current nonce
    function getNonce() external view returns (uint256);

    /// @notice Get the ITP deployer address
    /// @param itpId The ITP identifier
    /// @return deployer The deployer address
    function getITPDeployer(bytes32 itpId) external view returns (address deployer);
}
