// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/TypesLib.sol";

/// @title ICollateralRegistry - Cross-chain collateral tracking interface
/// @notice Tracks collateral positions across multiple chains for each ITP
/// @dev All collateral movements require BLS signature verification
/// @dev Message format: keccak256(abi.encode(chainid, this, functionSpecificData...))
interface ICollateralRegistry {
    // ============ COLLATERAL TRACKING ============

    /// @notice Record a collateral movement between chains or positions
    /// @dev Called by issuer consensus to update collateral state
    /// @dev Message: keccak256(abi.encode(chainid, this, itpId, fromChain, toChain, amount, txType, nonce))
    /// @dev Chain ID 0 = external/no-chain (CEX operations). Use actual chain IDs for on-chain collateral.
    /// @param itpId The ITP this collateral belongs to
    /// @param fromChain Source chain ID (0 for external/CEX, 111222333 for L3, other EVM chain IDs)
    /// @param toChain Destination chain ID (0 for external/CEX, 111222333 for L3, other EVM chain IDs)
    /// @param amount Amount of collateral moved (18 decimals)
    /// @param txType Transaction type (BRIDGE, SWAP_IN, SWAP_OUT, BUY, SELL)
    /// @param blsSignature Aggregated BLS signature from 11/20 issuers
    function recordCollateralMove(
        bytes32 itpId,
        uint256 fromChain,
        uint256 toChain,
        uint256 amount,
        TypesLib.TxType txType,
        bytes calldata blsSignature,
        uint256 referenceNonce,
        uint256 signersBitmask
    ) external;

    // ============ VIEW FUNCTIONS ============

    /// @notice Get collateral amount for an ITP on a specific chain
    /// @param itpId The ITP identifier
    /// @param chainId The chain ID to query (0 for external/CEX, 111222333 for L3)
    /// @return amount The collateral amount on that chain (18 decimals)
    function getITPCollateralByChain(bytes32 itpId, uint256 chainId) external view returns (uint256 amount);

    /// @notice Get total collateral for an ITP across all chains
    /// @param itpId The ITP identifier
    /// @return total The total collateral across all chains (18 decimals)
    function getTotalCollateral(bytes32 itpId) external view returns (uint256 total);

    /// @notice Get collateral breakdown for an ITP
    /// @param itpId The ITP identifier
    /// @return chainIds Array of chain IDs with collateral
    /// @return amounts Array of collateral amounts per chain (18 decimals each)
    function getCollateralBreakdown(bytes32 itpId)
        external
        view
        returns (uint256[] memory chainIds, uint256[] memory amounts);

    /// @notice Check if an ITP exists in the registry
    /// @param itpId The ITP identifier
    /// @return Whether the ITP has been registered
    function itpExists(bytes32 itpId) external view returns (bool);

    // ============ EVENTS ============

    /// @notice Emitted when collateral is moved between chains or positions
    /// @param itpId The ITP this collateral belongs to
    /// @param fromChain Source chain ID (0 for external/CEX, 111222333 for L3)
    /// @param toChain Destination chain ID (0 for external/CEX, 111222333 for L3)
    /// @param amount Amount moved (18 decimals)
    /// @param txType Type of movement (BRIDGE, SWAP_IN, etc.)
    event CollateralMoved(
        bytes32 indexed itpId,
        uint256 fromChain,
        uint256 toChain,
        uint256 amount,
        TypesLib.TxType txType
    );
}
