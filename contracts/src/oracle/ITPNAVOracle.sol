// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BLSVerifier} from "../libraries/BLSVerifier.sol";
import {ErrorsLib} from "../libraries/ErrorsLib.sol";
import {EventsLib} from "../libraries/EventsLib.sol";
import {IITPNAVOracle} from "../interfaces/IITPNAVOracle.sol";
import {IOracle} from "@morpho-blue/interfaces/IOracle.sol";

/// @title ITPNAVOracle
/// @notice BLS-verified ITP NAV oracle for Morpho Blue markets
/// @dev One oracle instance per ITP. Fully permissionless — security comes from BLS verification.
///      Anyone can push a price update as long as it carries a valid BLS signature
///      from the issuer network. Uses BLSVerifier (multi-pairing, 2/3 threshold, snapshot-based)
///      — the SAME verification path as BridgeProxy, ArbBridgeCustody, and Investment.
///      The registry is MirrorIssuerRegistry (which implements IIssuerRegistry).
/// @custom:security-contact security@indexprotocol.com
contract ITPNAVOracle is IITPNAVOracle, IOracle, BLSVerifier {
    // ============ CONSTANTS ============

    /// @notice Morpho Blue base price scaling factor (36 decimals)
    /// @dev Effective precision = 36 + loanTokenDecimals - collateralTokenDecimals.
    ///      For ITP(18dec)/USDC(6dec): effective precision = 24 decimals.
    ///      Callers of updatePrice() must provide prices in the correct Morpho format.
    uint256 public constant PRICE_DECIMALS = 36;

    /// @notice Maximum staleness before price() reverts (24 hours)
    uint256 public constant MAX_STALENESS = 24 hours;

    /// @notice Maximum price deviation per update (10% = 1000 bps)
    uint256 public constant MAX_DEVIATION_BPS = 1000;

    /// @notice Maximum cycle gap allowed (prevents unbounded skip)
    uint256 public constant MAX_CYCLE_GAP = 10000;

    // ============ IMMUTABLES ============

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
    /// @param _issuerRegistry Address of the MirrorIssuerRegistry (implements IIssuerRegistry)
    /// @param _itpAddress Address of the ITP token this oracle prices
    /// @param _initialPrice Initial price to bootstrap the oracle (Morpho-scaled, see PRICE_DECIMALS)
    constructor(
        address _issuerRegistry,
        address _itpAddress,
        uint256 _initialPrice
    ) {
        if (_initialPrice == 0) {
            revert ErrorsLib.E095_InvalidOraclePrice();
        }
        __BLSVerifier_init(_issuerRegistry);
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
        uint256 referenceNonce,
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

        // Reject unbounded cycle skips
        if (cycleNumber > lastCycleNumber + MAX_CYCLE_GAP) {
            revert ErrorsLib.E133_CycleGapTooLarge();
        }

        // Price deviation check (skip on first update when lastCycleNumber == 0)
        if (lastCycleNumber > 0) {
            uint256 deviation = newPrice > currentPrice
                ? ((newPrice - currentPrice) * 10000) / currentPrice
                : ((currentPrice - newPrice) * 10000) / currentPrice;
            if (deviation > MAX_DEVIATION_BPS) {
                revert ErrorsLib.E134_PriceDeviationTooHigh();
            }
        }

        // Hash includes chainId + address(this) for cross-chain replay protection
        // Uses abi.encode (NOT abi.encodePacked) for unambiguous encoding
        bytes32 messageHash = keccak256(
            abi.encode(block.chainid, address(this), itpAddress, newPrice, timestamp, cycleNumber)
        );

        // Same verification as BridgeProxy, ArbBridgeCustody, Investment
        // Multi-pairing, 2/3 threshold, snapshot-based
        _verifyBLS(messageHash, blsSignature, referenceNonce, signersBitmask);

        // Update state — use block.timestamp for staleness (not issuer timestamp)
        currentPrice = newPrice;
        lastUpdated = block.timestamp;
        lastCycleNumber = cycleNumber;

        // Emit event (signersBitmask included for off-chain indexing)
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
