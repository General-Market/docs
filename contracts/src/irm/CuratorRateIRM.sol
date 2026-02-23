// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IIrm} from "@morpho-blue/interfaces/IIrm.sol";
import {Id, MarketParams, Market} from "@morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";

/// @title CuratorRateIRM
/// @notice Curator-managed interest rate model for ITP lending.
/// @dev The curator pushes borrow rates per market based on the SERM algorithm.
///      Morpho Blue calls borrowRate() on every interaction — returns the curator-set rate.
///      If the curator hasn't updated in 48h, a punitive rate protects lenders.
/// @custom:security-contact security@indexprotocol.com
contract CuratorRateIRM is IIrm {
    using MarketParamsLib for MarketParams;

    // ============ CONSTANTS ============

    /// @notice Punitive rate if curator goes offline (100% APR ~ 3.17e-9 per-second WAD)
    /// @dev 1e18 / 31_536_000 = ~31_709_791_983
    uint256 public constant PUNITIVE_RATE = 31709791983;

    /// @notice Max staleness before punitive rate kicks in
    uint256 public constant MAX_RATE_STALENESS = 48 hours;

    /// @notice Minimum rate curator can set (0.5% APR — prevents zero-rate exploit)
    /// @dev 0.005 * 1e18 / 31_536_000 = ~158_548_960
    uint256 public constant MIN_RATE = 158548960;

    /// @notice Maximum rate curator can set (200% APR — prevents absurd rates)
    /// @dev 2.0 * 1e18 / 31_536_000 = ~63_419_583_966
    uint256 public constant MAX_RATE = 63419583966;

    // ============ IMMUTABLES ============

    /// @notice Morpho Blue address (only Morpho can call borrowRate)
    address public immutable MORPHO;

    // ============ STATE ============

    /// @notice Curator address (only curator can set rates)
    address public curator;

    /// @notice Per-second borrow rate per market (WAD-scaled)
    mapping(Id => uint256) public rates;

    /// @notice Last rate update timestamp per market
    mapping(Id => uint256) public lastRateUpdate;

    // ============ EVENTS ============

    event RateSet(Id indexed id, uint256 ratePerSecond, uint256 aprBps);
    event RatesBatchSet(uint256 count);
    event CuratorChanged(address indexed oldCurator, address indexed newCurator);

    // ============ ERRORS ============

    error NotMorpho();
    error NotCurator();
    error ZeroCurator();
    error ArrayLengthMismatch();
    error RateOutOfBounds();

    // ============ CONSTRUCTOR ============

    constructor(address _morpho, address _curator) {
        MORPHO = _morpho;
        curator = _curator;
    }

    // ============ MORPHO IRM INTERFACE ============

    /// @notice Returns the borrow rate per second for a market.
    /// @dev Called by Morpho Blue on every interaction (supply, borrow, repay, liquidate).
    ///      Returns curator-set rate, or punitive rate if stale.
    function borrowRate(
        MarketParams memory marketParams,
        Market memory /* market */
    ) external override returns (uint256) {
        if (msg.sender != MORPHO) revert NotMorpho();
        return _getRate(marketParams.id());
    }

    /// @notice View version of borrowRate.
    function borrowRateView(
        MarketParams memory marketParams,
        Market memory /* market */
    ) external view override returns (uint256) {
        return _getRate(marketParams.id());
    }

    function _getRate(Id id) internal view returns (uint256) {
        uint256 rate = rates[id];
        uint256 lastUpdate = lastRateUpdate[id];

        // No rate set or stale -> punitive rate to protect lenders
        if (rate == 0 || block.timestamp - lastUpdate > MAX_RATE_STALENESS) {
            return PUNITIVE_RATE;
        }

        return rate;
    }

    // ============ CURATOR RATE MANAGEMENT ============

    /// @notice Set borrow rate for a single market.
    /// @param id The Morpho market ID
    /// @param ratePerSecond Per-second borrow rate (WAD-scaled)
    function setRate(Id id, uint256 ratePerSecond) external {
        if (msg.sender != curator) revert NotCurator();
        if (ratePerSecond < MIN_RATE || ratePerSecond > MAX_RATE) revert RateOutOfBounds();
        rates[id] = ratePerSecond;
        lastRateUpdate[id] = block.timestamp;
        emit RateSet(id, ratePerSecond, ratePerSecond * 31557600 * 10000 / 1e18);
    }

    /// @notice Batch set rates for multiple markets (gas efficient).
    /// @param ids Array of market IDs
    /// @param ratesPerSecond Array of per-second borrow rates
    function setRates(Id[] calldata ids, uint256[] calldata ratesPerSecond) external {
        if (msg.sender != curator) revert NotCurator();
        if (ids.length != ratesPerSecond.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < ids.length; i++) {
            if (ratesPerSecond[i] < MIN_RATE || ratesPerSecond[i] > MAX_RATE) revert RateOutOfBounds();
            rates[ids[i]] = ratesPerSecond[i];
            lastRateUpdate[ids[i]] = block.timestamp;
        }
        emit RatesBatchSet(ids.length);
    }

    /// @notice Transfer curator role.
    function setCurator(address newCurator) external {
        if (msg.sender != curator) revert NotCurator();
        if (newCurator == address(0)) revert ZeroCurator();
        emit CuratorChanged(curator, newCurator);
        curator = newCurator;
    }
}
