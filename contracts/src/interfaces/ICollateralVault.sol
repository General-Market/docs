// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ICollateralVault - Bilateral custody vault interface
/// @notice Bilateral custody vault for bot P2P trading with 2-of-2 signature commitment
/// @dev Part of the bilateral custody system replacing AgiArenaCore
interface ICollateralVault {
    // ============ Enums ============

    enum BetStatus {
        None,           // Bet doesn't exist
        Active,         // Committed, awaiting settlement
        InArbitration,  // Dispute requested
        Settled,        // Resolved by agreement or arbitration
        CustomPayout    // Resolved via custom split
    }

    // ============ Structs ============

    /// @notice Bet commitment data structure
    struct Bet {
        bytes32 tradesRoot;         // Merkle root of trades (for verification)
        address creator;            // Party A
        address filler;             // Party B
        uint256 creatorAmount;      // Creator's locked stake
        uint256 fillerAmount;       // Filler's locked stake
        uint256 deadline;           // Resolution deadline (unix timestamp)
        uint256 createdAt;          // Commitment timestamp
        BetStatus status;           // Current state
    }

    /// @notice EIP-712 commitment struct for signing
    struct BetCommitment {
        bytes32 tradesRoot;
        address creator;
        address filler;
        uint256 creatorAmount;
        uint256 fillerAmount;
        uint256 deadline;
        uint256 nonce;
        uint256 expiry;
    }

    /// @notice EIP-712 settlement agreement struct
    struct SettlementAgreement {
        uint256 betId;
        address winner;
        uint256 nonce;
        uint256 expiry;
    }

    // ============ Custom Errors ============

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance(uint256 available, uint256 required);
    error InvalidSignature();
    error SignatureExpired(uint256 expiry);
    error InvalidNonce(address user, uint256 expected, uint256 provided);
    error DeadlineInPast(uint256 deadline, uint256 currentTime);
    error SelfBetNotAllowed();
    error BetNotFound(uint256 betId);
    error BetNotActive(uint256 betId);
    error BetAlreadyExists(uint256 betId);
    error CreatorFillerMismatch();
    error BetNotInArbitration(uint256 betId);
    error InvalidWinner(address winner);
    error InsufficientSignatures(uint256 provided, uint256 required);
    error KeeperNotActive(address keeper);
    error DuplicateSigner(address keeper);
    error KeeperRegistryNotSet();
    error DeadlineNotPassed(uint256 deadline, uint256 currentTime);
    error FeeTooHigh(uint256 feeBps, uint256 maxBps);
    error NotOwner();

    // ============ Events ============

    event Deposit(address indexed user, uint256 amount, uint256 newAvailableBalance);
    event Withdraw(address indexed user, uint256 amount, uint256 newAvailableBalance);
    event BetCommitted(
        uint256 indexed betId,
        address indexed creator,
        address indexed filler,
        bytes32 tradesRoot,
        uint256 creatorAmount,
        uint256 fillerAmount,
        uint256 deadline
    );
    event CollateralLocked(address indexed user, uint256 indexed betId, uint256 amount);
    event ArbitrationRequested(
        uint256 indexed betId,
        address indexed requestedBy,
        uint256 timestamp
    );
    event ArbitrationSettled(
        uint256 indexed betId,
        address indexed winner,
        uint256 creatorPayout,
        uint256 fillerPayout
    );
    event BetSettled(uint256 indexed betId, address indexed winner, uint256 payout);
    event FeeCollected(uint256 indexed betId, uint256 feeAmount, address collector);
    event FeeConfigUpdated(uint256 feeBps, address collector);
    event KeeperRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    // ============ External Functions ============

    /// @notice Deposit WIND tokens into the vault
    /// @param amount The amount of WIND to deposit
    function deposit(uint256 amount) external;

    /// @notice Withdraw available WIND tokens from the vault
    /// @param amount The amount of WIND to withdraw
    function withdraw(uint256 amount) external;

    /// @notice Commit a bilateral bet with 2-of-2 EIP-712 signatures
    /// @param commitment The bet commitment details
    /// @param creatorSig Creator's EIP-712 signature
    /// @param fillerSig Filler's EIP-712 signature
    /// @return betId The unique identifier for this bet
    function commitBet(
        BetCommitment calldata commitment,
        bytes calldata creatorSig,
        bytes calldata fillerSig
    ) external returns (uint256 betId);

    /// @notice Settle a bet by mutual agreement with 2-of-2 EIP-712 signatures
    /// @param agreement The settlement agreement
    /// @param creatorSig Creator's EIP-712 signature
    /// @param fillerSig Filler's EIP-712 signature
    function settleByAgreement(
        SettlementAgreement calldata agreement,
        bytes calldata creatorSig,
        bytes calldata fillerSig
    ) external;

    /// @notice Request arbitration for an active bet
    /// @param betId The bet to dispute
    /// @dev Can only be called by creator or filler of an active bet
    function requestArbitration(uint256 betId) external;

    /// @notice Settle a bet by arbitration with keeper BLS signatures
    /// @param betId The bet to settle
    /// @param winner The address to receive the funds (must be creator or filler)
    /// @param signatures Array of BLS signatures (64 bytes each, G1 points)
    /// @param signers Array of keeper addresses who signed
    /// @dev Requires 2-of-3 valid keeper signatures
    function settleByArbitration(
        uint256 betId,
        address winner,
        bytes[] calldata signatures,
        address[] calldata signers
    ) external;

    // ============ Admin Functions ============

    /// @notice Set the keeper registry address
    /// @param _keeperRegistry Address of the KeeperRegistry contract
    function setKeeperRegistry(address _keeperRegistry) external;

    /// @notice Set the protocol fee configuration
    /// @param _feeBps Fee in basis points (max 500 = 5%)
    /// @param _collector Address to receive fees (can be address(0) to disable)
    function setFeeConfig(uint256 _feeBps, address _collector) external;

    // ============ View Functions ============

    /// @notice Get available balance for a user
    /// @param user The address to query
    /// @return The available (unlocked) balance
    function getAvailableBalance(address user) external view returns (uint256);

    /// @notice Get locked balance for a user
    /// @param user The address to query
    /// @return The locked balance in active bets
    function getLockedBalance(address user) external view returns (uint256);

    /// @notice Get total balance (available + locked) for a user
    /// @param user The address to query
    /// @return The total balance
    function getTotalBalance(address user) external view returns (uint256);

    /// @notice Get bet details
    /// @param betId The bet ID to query
    /// @return The Bet struct
    function getBet(uint256 betId) external view returns (Bet memory);

    /// @notice Get bet status
    /// @param betId The bet ID to query
    /// @return The current status of the bet
    function getBetStatus(uint256 betId) external view returns (BetStatus);

    /// @notice Get nonce for a user
    /// @param user The address to query
    /// @return The current nonce for EIP-712 signatures
    function getNonce(address user) external view returns (uint256);

    // ============ Public State Accessors ============

    /// @notice The WIND token used for collateral
    function WIND() external view returns (address);

    /// @notice EIP-712 domain separator
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @notice EIP-712 typehash for BetCommitment
    function BET_COMMITMENT_TYPEHASH() external view returns (bytes32);

    /// @notice EIP-712 typehash for SettlementAgreement
    function SETTLEMENT_AGREEMENT_TYPEHASH() external view returns (bytes32);

    /// @notice Mapping of user addresses to available balances
    function availableBalance(address user) external view returns (uint256);

    /// @notice Mapping of user addresses to locked balances
    function lockedBalance(address user) external view returns (uint256);

    /// @notice Mapping of bet IDs to bet data
    function bets(uint256 betId) external view returns (
        bytes32 tradesRoot,
        address creator,
        address filler,
        uint256 creatorAmount,
        uint256 fillerAmount,
        uint256 deadline,
        uint256 createdAt,
        BetStatus status
    );

    /// @notice Mapping of user addresses to nonces
    function nonces(address user) external view returns (uint256);

    /// @notice The next bet ID to be assigned
    function nextBetId() external view returns (uint256);

    /// @notice Address of the KeeperRegistry contract
    function keeperRegistry() external view returns (address);

    /// @notice Contract deployer (owner for admin functions)
    function owner() external view returns (address);

    /// @notice Protocol fee in basis points (100 = 1%, max 500 = 5%)
    function protocolFeeBps() external view returns (uint256);

    /// @notice Address that receives accumulated protocol fees
    function feeCollector() external view returns (address);

    /// @notice Total uncollected protocol fees
    function accumulatedFees() external view returns (uint256);

    /// @notice Maximum allowed fee in basis points (5%)
    function MAX_FEE_BPS() external view returns (uint256);
}
