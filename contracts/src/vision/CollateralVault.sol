// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { BLSLib } from "../libraries/BLSLib.sol";

/// @title CollateralVault
/// @notice Bilateral custody vault for bot P2P trading with 2-of-2 signature commitment
/// @dev Part of the new bilateral custody system replacing AgiArenaCore
contract CollateralVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

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

    // ============ Constants ============

    IERC20 public immutable WIND;
    bytes32 public immutable DOMAIN_SEPARATOR;

    bytes32 public constant BET_COMMITMENT_TYPEHASH = keccak256(
        "BetCommitment(bytes32 tradesRoot,address creator,address filler,uint256 creatorAmount,uint256 fillerAmount,uint256 deadline,uint256 nonce,uint256 expiry)"
    );

    bytes32 public constant SETTLEMENT_AGREEMENT_TYPEHASH = keccak256(
        "SettlementAgreement(uint256 betId,address winner,uint256 nonce,uint256 expiry)"
    );

    // ============ State Variables ============

    mapping(address => uint256) public availableBalance;
    mapping(address => uint256) public lockedBalance;
    mapping(uint256 => Bet) public bets;
    mapping(address => uint256) public nonces;
    uint256 public nextBetId;

    /// @notice Address of the KeeperRegistry contract for BLS key lookups
    address public keeperRegistry;

    /// @notice Contract deployer (owner for admin functions)
    address public immutable owner;

    /// @notice Protocol fee in basis points (100 = 1%, max 500 = 5%)
    uint256 public protocolFeeBps;

    /// @notice Address that receives accumulated protocol fees
    address public feeCollector;

    /// @notice Total uncollected protocol fees (tracked but credited to feeCollector's availableBalance)
    uint256 public accumulatedFees;

    /// @notice Maximum allowed fee in basis points (5%)
    uint256 public constant MAX_FEE_BPS = 500;

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

    // ============ Constructor ============

    constructor(address _windToken) {
        if (_windToken == address(0)) revert ZeroAddress();

        WIND = IERC20(_windToken);
        owner = msg.sender;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("CollateralVault"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    // ============ External Functions ============

    /// @notice Deposit WIND tokens into the vault
    /// @param amount The amount of WIND to deposit
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        WIND.safeTransferFrom(msg.sender, address(this), amount);
        availableBalance[msg.sender] += amount;

        emit Deposit(msg.sender, amount, availableBalance[msg.sender]);
    }

    /// @notice Withdraw available WIND tokens from the vault
    /// @param amount The amount of WIND to withdraw
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (availableBalance[msg.sender] < amount) {
            revert InsufficientBalance(availableBalance[msg.sender], amount);
        }

        availableBalance[msg.sender] -= amount;
        WIND.safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount, availableBalance[msg.sender]);
    }

    /// @notice Commit a bilateral bet with 2-of-2 EIP-712 signatures
    /// @param commitment The bet commitment details
    /// @param creatorSig Creator's EIP-712 signature
    /// @param fillerSig Filler's EIP-712 signature
    /// @return betId The unique identifier for this bet
    function commitBet(
        BetCommitment calldata commitment,
        bytes calldata creatorSig,
        bytes calldata fillerSig
    ) external nonReentrant returns (uint256 betId) {
        // Validate addresses
        if (commitment.creator == address(0) || commitment.filler == address(0)) {
            revert ZeroAddress();
        }
        if (commitment.creator == commitment.filler) revert SelfBetNotAllowed();

        // Validate amounts
        if (commitment.creatorAmount == 0 || commitment.fillerAmount == 0) {
            revert ZeroAmount();
        }

        // Validate expiry
        if (block.timestamp > commitment.expiry) {
            revert SignatureExpired(commitment.expiry);
        }

        // Validate deadline is in the future
        if (commitment.deadline <= block.timestamp) {
            revert DeadlineInPast(commitment.deadline, block.timestamp);
        }

        // Validate nonces match on-chain state
        if (commitment.nonce != nonces[commitment.creator]) {
            revert InvalidNonce(commitment.creator, nonces[commitment.creator], commitment.nonce);
        }
        if (commitment.nonce != nonces[commitment.filler]) {
            revert InvalidNonce(commitment.filler, nonces[commitment.filler], commitment.nonce);
        }

        // Verify signatures
        bytes32 structHash = _hashBetCommitment(commitment);
        bytes32 digest = _toTypedDataHash(structHash);

        address recoveredCreator = ECDSA.recover(digest, creatorSig);
        if (recoveredCreator != commitment.creator) revert InvalidSignature();

        address recoveredFiller = ECDSA.recover(digest, fillerSig);
        if (recoveredFiller != commitment.filler) revert InvalidSignature();

        // Verify balances
        if (availableBalance[commitment.creator] < commitment.creatorAmount) {
            revert InsufficientBalance(availableBalance[commitment.creator], commitment.creatorAmount);
        }
        if (availableBalance[commitment.filler] < commitment.fillerAmount) {
            revert InsufficientBalance(availableBalance[commitment.filler], commitment.fillerAmount);
        }

        // Lock collateral
        availableBalance[commitment.creator] -= commitment.creatorAmount;
        lockedBalance[commitment.creator] += commitment.creatorAmount;

        availableBalance[commitment.filler] -= commitment.fillerAmount;
        lockedBalance[commitment.filler] += commitment.fillerAmount;

        // Create bet
        betId = nextBetId++;
        bets[betId] = Bet({
            tradesRoot: commitment.tradesRoot,
            creator: commitment.creator,
            filler: commitment.filler,
            creatorAmount: commitment.creatorAmount,
            fillerAmount: commitment.fillerAmount,
            deadline: commitment.deadline,
            createdAt: block.timestamp,
            status: BetStatus.Active
        });

        // Update nonces
        nonces[commitment.creator]++;
        nonces[commitment.filler]++;

        // Emit events
        emit CollateralLocked(commitment.creator, betId, commitment.creatorAmount);
        emit CollateralLocked(commitment.filler, betId, commitment.fillerAmount);
        emit BetCommitted(
            betId,
            commitment.creator,
            commitment.filler,
            commitment.tradesRoot,
            commitment.creatorAmount,
            commitment.fillerAmount,
            commitment.deadline
        );
    }

    /// @notice Settle a bet by mutual agreement with 2-of-2 EIP-712 signatures
    /// @param agreement The settlement agreement
    /// @param creatorSig Creator's EIP-712 signature
    /// @param fillerSig Filler's EIP-712 signature
    function settleByAgreement(
        SettlementAgreement calldata agreement,
        bytes calldata creatorSig,
        bytes calldata fillerSig
    ) external nonReentrant {
        Bet storage bet = bets[agreement.betId];
        if (bet.status == BetStatus.None) revert BetNotFound(agreement.betId);
        if (bet.status != BetStatus.Active) revert BetNotActive(agreement.betId);
        if (agreement.winner != bet.creator && agreement.winner != bet.filler) {
            revert InvalidWinner(agreement.winner);
        }

        // Check deadline passed
        if (block.timestamp <= bet.deadline) {
            revert DeadlineNotPassed(bet.deadline, block.timestamp);
        }

        // Validate expiry
        if (block.timestamp > agreement.expiry) {
            revert SignatureExpired(agreement.expiry);
        }

        // Validate nonces
        if (agreement.nonce != nonces[bet.creator]) {
            revert InvalidNonce(bet.creator, nonces[bet.creator], agreement.nonce);
        }

        // Verify signatures
        bytes32 structHash = _hashSettlementAgreement(agreement);
        bytes32 digest = _toTypedDataHash(structHash);

        address recoveredCreator = ECDSA.recover(digest, creatorSig);
        if (recoveredCreator != bet.creator) revert InvalidSignature();

        address recoveredFiller = ECDSA.recover(digest, fillerSig);
        if (recoveredFiller != bet.filler) revert InvalidSignature();

        // Update nonces
        nonces[bet.creator]++;
        nonces[bet.filler]++;

        // Settle
        _settleBet(agreement.betId, agreement.winner);
    }

    // ============ Admin Functions ============

    /// @notice Set the keeper registry address
    /// @param _keeperRegistry Address of the KeeperRegistry contract
    function setKeeperRegistry(address _keeperRegistry) external {
        if (msg.sender != owner) revert NotOwner();
        if (_keeperRegistry == address(0)) revert ZeroAddress();

        address old = keeperRegistry;
        keeperRegistry = _keeperRegistry;
        emit KeeperRegistryUpdated(old, _keeperRegistry);
    }

    /// @notice Set the protocol fee configuration
    /// @param _feeBps Fee in basis points (max 500 = 5%)
    /// @param _collector Address to receive fees (can be address(0) to disable)
    function setFeeConfig(uint256 _feeBps, address _collector) external {
        if (msg.sender != owner) revert NotOwner();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh(_feeBps, MAX_FEE_BPS);

        protocolFeeBps = _feeBps;
        feeCollector = _collector;

        emit FeeConfigUpdated(_feeBps, _collector);
    }

    // ============ Arbitration Functions ============

    /// @notice Request arbitration for an active bet
    /// @param betId The bet to dispute
    /// @dev Can only be called by creator or filler of an active bet
    function requestArbitration(uint256 betId) external nonReentrant {
        Bet storage bet = bets[betId];
        if (bet.status == BetStatus.None) revert BetNotFound(betId);
        if (bet.status != BetStatus.Active) revert BetNotActive(betId);
        if (msg.sender != bet.creator && msg.sender != bet.filler) {
            revert InvalidSignature();
        }

        bet.status = BetStatus.InArbitration;

        emit ArbitrationRequested(betId, msg.sender, block.timestamp);
    }

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
    ) external nonReentrant {
        if (keeperRegistry == address(0)) revert KeeperRegistryNotSet();

        Bet storage bet = bets[betId];
        if (bet.status == BetStatus.None) revert BetNotFound(betId);
        if (bet.status != BetStatus.InArbitration) revert BetNotInArbitration(betId);
        if (winner != bet.creator && winner != bet.filler) revert InvalidWinner(winner);
        if (signatures.length != signers.length) revert InsufficientSignatures(signatures.length, signers.length);

        // Get active keepers and calculate threshold
        (address[] memory activeKeepers, , bytes[] memory pubkeys) = _getActiveKeepers();
        uint256 threshold = _calculateThreshold(activeKeepers.length);

        if (signatures.length < threshold) {
            revert InsufficientSignatures(signatures.length, threshold);
        }

        // Build message hash that keepers signed: keccak256(abi.encode(betId, winner))
        bytes32 messageHash = keccak256(abi.encode(betId, winner));

        // Verify each signature
        uint256 validSignatures = 0;
        for (uint256 i = 0; i < signatures.length; i++) {
            // Check for duplicates
            for (uint256 j = 0; j < i; j++) {
                if (signers[i] == signers[j]) revert DuplicateSigner(signers[i]);
            }

            // Find keeper's pubkey
            bytes memory pubkey = _findKeeperPubkey(signers[i], activeKeepers, pubkeys);
            if (pubkey.length == 0) revert KeeperNotActive(signers[i]);

            // Verify BLS signature
            if (BLSLib.verifyBLS(pubkey, messageHash, signatures[i])) {
                validSignatures++;
            }
        }

        if (validSignatures < threshold) {
            revert InsufficientSignatures(validSignatures, threshold);
        }

        // Settle the bet
        _settleBet(betId, winner);
    }

    // ============ View Functions ============

    /// @notice Get available balance for a user
    /// @param user The address to query
    /// @return The available (unlocked) balance
    function getAvailableBalance(address user) external view returns (uint256) {
        return availableBalance[user];
    }

    /// @notice Get locked balance for a user
    /// @param user The address to query
    /// @return The locked balance in active bets
    function getLockedBalance(address user) external view returns (uint256) {
        return lockedBalance[user];
    }

    /// @notice Get total balance (available + locked) for a user
    /// @param user The address to query
    /// @return The total balance
    function getTotalBalance(address user) external view returns (uint256) {
        return availableBalance[user] + lockedBalance[user];
    }

    /// @notice Get bet details
    /// @param betId The bet ID to query
    /// @return The Bet struct
    function getBet(uint256 betId) external view returns (Bet memory) {
        return bets[betId];
    }

    /// @notice Get bet status
    /// @param betId The bet ID to query
    /// @return The current status of the bet
    function getBetStatus(uint256 betId) external view returns (BetStatus) {
        return bets[betId].status;
    }

    /// @notice Get nonce for a user
    /// @param user The address to query
    /// @return The current nonce for EIP-712 signatures
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    // ============ Internal Functions ============

    function _hashBetCommitment(BetCommitment calldata commitment) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                BET_COMMITMENT_TYPEHASH,
                commitment.tradesRoot,
                commitment.creator,
                commitment.filler,
                commitment.creatorAmount,
                commitment.fillerAmount,
                commitment.deadline,
                commitment.nonce,
                commitment.expiry
            )
        );
    }

    function _hashSettlementAgreement(SettlementAgreement calldata agreement) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                SETTLEMENT_AGREEMENT_TYPEHASH,
                agreement.betId,
                agreement.winner,
                agreement.nonce,
                agreement.expiry
            )
        );
    }

    function _toTypedDataHash(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    /// @notice Get active keepers from the registry
    /// @return addresses Array of keeper addresses
    /// @return ips Array of keeper IPs (unused here but part of interface)
    /// @return pubkeys Array of BLS public keys (128 bytes each)
    function _getActiveKeepers() internal view returns (
        address[] memory addresses,
        bytes32[] memory ips,
        bytes[] memory pubkeys
    ) {
        // Call KeeperRegistry.getActiveKeepers()
        // Interface: function getActiveKeepers() external view returns (address[], bytes32[], bytes[])
        (bool success, bytes memory data) = keeperRegistry.staticcall(
            abi.encodeWithSignature("getActiveKeepers()")
        );
        require(success, "Failed to get active keepers");
        return abi.decode(data, (address[], bytes32[], bytes[]));
    }

    /// @notice Calculate threshold for keeper signatures (2/3 majority)
    /// @param keeperCount Number of active keepers
    /// @return threshold Required number of signatures
    function _calculateThreshold(uint256 keeperCount) internal pure returns (uint256 threshold) {
        // ceil(n * 2 / 3) = (n * 2 + 2) / 3
        return (keeperCount * 2 + 2) / 3;
    }

    /// @notice Find a keeper's BLS public key
    /// @param keeper Keeper address to find
    /// @param keepers Array of active keeper addresses
    /// @param pubkeys Array of corresponding pubkeys
    /// @return pubkey The keeper's pubkey, or empty bytes if not found
    function _findKeeperPubkey(
        address keeper,
        address[] memory keepers,
        bytes[] memory pubkeys
    ) internal pure returns (bytes memory pubkey) {
        for (uint256 i = 0; i < keepers.length; i++) {
            if (keepers[i] == keeper) {
                return pubkeys[i];
            }
        }
        return "";
    }

    /// @notice Settle a bet and distribute funds (with optional protocol fee)
    /// @param betId The bet to settle
    /// @param winner The winner address (creator or filler)
    function _settleBet(uint256 betId, address winner) internal {
        Bet storage bet = bets[betId];

        uint256 totalPot = bet.creatorAmount + bet.fillerAmount;

        // Calculate fee (skip if fee disabled or no collector)
        uint256 fee = 0;
        if (protocolFeeBps > 0 && feeCollector != address(0)) {
            fee = (totalPot * protocolFeeBps) / 10000;
        }
        uint256 payout = totalPot - fee;

        // Unlock collateral
        lockedBalance[bet.creator] -= bet.creatorAmount;
        lockedBalance[bet.filler] -= bet.fillerAmount;

        // Credit winner with payout (after fee)
        availableBalance[winner] += payout;

        // Credit fee to collector (collector can withdraw() normally)
        if (fee > 0) {
            accumulatedFees += fee;
            availableBalance[feeCollector] += fee;
            emit FeeCollected(betId, fee, feeCollector);
        }

        // Payout amounts for ArbitrationSettled event
        uint256 creatorPayout = (winner == bet.creator) ? payout : 0;
        uint256 fillerPayout = (winner == bet.filler) ? payout : 0;

        // Update status
        bet.status = BetStatus.Settled;

        emit BetSettled(betId, winner, payout);
        emit ArbitrationSettled(betId, winner, creatorPayout, fillerPayout);
    }
}
