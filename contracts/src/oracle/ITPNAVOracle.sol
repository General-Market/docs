// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BLSLib} from "../libraries/BLSLib.sol";
import {ErrorsLib} from "../libraries/ErrorsLib.sol";
import {EventsLib} from "../libraries/EventsLib.sol";
import {IITPNAVOracle} from "../interfaces/IITPNAVOracle.sol";
import {IOracle} from "@morpho-blue/interfaces/IOracle.sol";
import {IMirrorIssuerRegistry} from "../interfaces/IMirrorIssuerRegistry.sol";

/// @title ITPNAVOracle
/// @notice BLS-verified ITP NAV oracle for Morpho Blue markets
/// @dev One oracle instance per ITP. Fully permissionless — security comes from BLS verification.
///      Anyone can push a price update as long as it carries a valid aggregated BLS signature
///      from the issuer network. The oracle reads the aggregated pubkey from MirrorIssuerRegistry.
/// @custom:security-contact security@indexprotocol.com
contract ITPNAVOracle is IITPNAVOracle, IOracle {
    // ============ CONSTANTS ============

    /// @notice Morpho Blue base price scaling factor (36 decimals)
    /// @dev Effective precision = 36 + loanTokenDecimals - collateralTokenDecimals.
    ///      For ITP(18dec)/USDC(6dec): effective precision = 24 decimals.
    ///      Callers of updatePrice() must provide prices in the correct Morpho format.
    uint256 public constant PRICE_DECIMALS = 36;

    /// @notice Maximum staleness before price() reverts (24 hours)
    uint256 public constant MAX_STALENESS = 24 hours;

    // ============ IMMUTABLES ============

    /// @notice MirrorIssuerRegistry for reading aggregated pubkey
    IMirrorIssuerRegistry public immutable mirrorRegistry;

    /// @notice The ITP token address this oracle prices
    address public immutable itpAddress;

    // ============ STATE ============

    /// @notice Current NAV price (Morpho-scaled, see PRICE_DECIMALS)
    uint256 public currentPrice;

    /// @notice Block timestamp of last price update
    uint256 public lastUpdated;

    /// @notice Last processed cycle number (monotonically increasing)
    uint256 public lastCycleNumber;

    // ============ CONSTRUCTOR ============

    /// @notice Deploy a new ITPNAVOracle for a specific ITP
    /// @param _mirrorRegistry Address of the MirrorIssuerRegistry
    /// @param _itpAddress Address of the ITP token this oracle prices
    /// @param _initialPrice Initial price to bootstrap the oracle (Morpho-scaled, see PRICE_DECIMALS)
    constructor(
        address _mirrorRegistry,
        address _itpAddress,
        uint256 _initialPrice
    ) {
        if (_initialPrice == 0) {
            revert ErrorsLib.E095_InvalidOraclePrice();
        }
        mirrorRegistry = IMirrorIssuerRegistry(_mirrorRegistry);
        itpAddress = _itpAddress;
        currentPrice = _initialPrice;
        lastUpdated = block.timestamp;
    }

    // ============ PRICE UPDATE ============

    /// @inheritdoc IITPNAVOracle
    function updatePrice(
        uint256 newPrice,
        uint256 timestamp,
        uint256 cycleNumber,
        bytes calldata blsSignature,
        uint256 signersBitmask
    ) external {
        // Validate price is non-zero
        if (newPrice == 0) {
            revert ErrorsLib.E095_InvalidOraclePrice();
        }

        // Silent no-op if cycle number not newer (enables atomic bundler multicall
        // where another user may have already pushed the same price)
        if (cycleNumber <= lastCycleNumber) {
            return;
        }

        // Compute message hash matching what issuers sign off-chain
        bytes32 messageHash = keccak256(
            abi.encodePacked(itpAddress, newPrice, timestamp, cycleNumber)
        );

        // Read aggregated pubkey from MirrorIssuerRegistry
        bytes memory aggPubkey = mirrorRegistry.getAggregatedPubkey();

        // Verify BLS signature
        bool valid = BLSLib.verifyBLS(aggPubkey, messageHash, blsSignature);
        if (!valid) {
            revert ErrorsLib.E020_InvalidBLSSignature();
        }

        // Update state — use block.timestamp for staleness (not issuer timestamp)
        currentPrice = newPrice;
        lastUpdated = block.timestamp;
        lastCycleNumber = cycleNumber;

        // Emit event (signersBitmask included for off-chain indexing, not stored on-chain)
        emit EventsLib.NAVPriceUpdated(itpAddress, newPrice, block.timestamp, cycleNumber, signersBitmask);
    }

    // ============ MORPHO ORACLE INTERFACE ============

    /// @inheritdoc IITPNAVOracle
    function price() external view override(IITPNAVOracle, IOracle) returns (uint256) {
        // Check staleness
        if (block.timestamp - lastUpdated > MAX_STALENESS) {
            revert ErrorsLib.E096_StaleOraclePrice(lastUpdated, MAX_STALENESS);
        }

        return currentPrice;
    }
}
