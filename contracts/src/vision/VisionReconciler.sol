// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title VisionReconciler — stateless fan-out for post-settlement vault reconciles
/// @notice After `Vision.settleBatch` (or its bundled cousin) lands, the oracle
///         calls `reconcile(batchId, payout)` on each player address so vault
///         contracts can update their NAV. Non-vault players revert harmlessly.
///         This helper collapses the per-player loop into one transaction,
///         removing the EOA nonce-queue bottleneck on the oracle leader.
/// @dev The reconcile selector is `keccak256("reconcile(uint256,uint256)")[:4]`.
///      Failures are intentionally swallowed: most player addresses are EOAs and
///      revert on the `reconcile` selector, and that is the expected state.
contract VisionReconciler {
    error LengthMismatch();
    error EmptyInput();

    event Reconciled(uint256 indexed batchId, uint256 count);

    /// @notice Bundle reconciles for one batch across N vault candidates.
    /// @param vaults   Player addresses (vault contracts or EOAs).
    /// @param batchId  The Vision batch being reconciled.
    /// @param payouts  Per-vault gross payout (matches `vaults` index-for-index).
    function reconcileMany(
        address[] calldata vaults,
        uint256 batchId,
        uint256[] calldata payouts
    ) external {
        uint256 n = vaults.length;
        if (n == 0) revert EmptyInput();
        if (payouts.length != n) revert LengthMismatch();

        bytes4 sel = 0x49e27d69; // reconcile(uint256,uint256)

        for (uint256 i = 0; i < n; ++i) {
            bytes memory data = abi.encodeWithSelector(sel, batchId, payouts[i]);
            (bool ok, ) = vaults[i].call(data);
            ok; // failures are expected for non-vault addresses
        }

        emit Reconciled(batchId, n);
    }
}
