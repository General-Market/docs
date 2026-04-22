# Index L3 Error Codes Reference

This document is the canonical reference for all error codes in the Index L3 protocol. Error codes are used consistently across Solidity contracts and Rust services to ensure actionable, debuggable error reporting.

## Error Code Ranges

| Range | Category | Defined In |
|-------|----------|------------|
| E001-E006 | Core Protocol | `ErrorsLib.sol` + `common/src/errors.rs` |
| E011-E018 | ITP Configuration | `ErrorsLib.sol` |
| E019-E024 | Batch & Fill | `ErrorsLib.sol` |
| E025-E032 | BLS Custody & Whitelist | `ErrorsLib.sol` |
| E034-E037 | Order & Fill Validation | `ErrorsLib.sol` |
| E038-E044 | Upgrades | `ErrorsLib.sol` |
| E045-E053 | L3 Bridge Custody | `ErrorsLib.sol` |
| E054-E060 | Arb Bridge Custody | `ErrorsLib.sol` |
| E061-E064 | Access Control & Validation | `ErrorsLib.sol` |
| E065-E069 | Rebalance | `ErrorsLib.sol` |
| E070-E07E | Bridge Proxy & ITP Creation | `ErrorsLib.sol` |
| E07F-E080 | Decimal Conversion | `ErrorsLib.sol` |
| E081 | Sell Orders | `ErrorsLib.sol` |
| E082-E085 | Production Hardening | `ErrorsLib.sol` |
| E086-E088 | Architecture Gap Fixes | `ErrorsLib.sol` |
| E089 | Queue Thresholds | `ErrorsLib.sol` |
| E090-E093 | Mirror Registry | `ErrorsLib.sol` |
| E094-E096 | NAV Oracle | `ErrorsLib.sol` |
| INFRA-001 to INFRA-013 | Infrastructure | `common/src/error.rs` |

---

## Core Protocol Errors (E001-E006)

These errors exist in both Solidity (`ErrorsLib.sol`) and Rust (`common/src/errors.rs`).

### E001 - OrderBelowMin

| Field | Value |
|-------|-------|
| **Code** | E001 |
| **Name** | `E001_OrderBelowMin` (Solidity) / `OrderBelowMin` (Rust) |
| **Description** | Order amount below minimum threshold |
| **Parameters** | `amount: uint256/u128` - submitted amount; `minimum: uint256/u128` - required minimum (0.001 USDC = 1e15 wei) |
| **Triggering Condition** | User submits an order with amount < 0.001 USDC |
| **Components** | `Index.sol` (order submission), AP order validation |
| **Resolution** | Increase order amount to at least 0.001 USDC (1e15 in 18-decimal representation) |

### E002 - InsufficientBalance

| Field | Value |
|-------|-------|
| **Code** | E002 |
| **Name** | `E002_InsufficientBalance` (Solidity) / `InsufficientBalance` (Rust) |
| **Description** | User has insufficient balance to complete order |
| **Parameters** | `user: address/String` - user address; `required: uint256/u128` - amount needed; `available: uint256/u128` - current balance |
| **Triggering Condition** | User's USDC balance is less than the order amount |
| **Components** | `Index.sol` (order submission) |
| **Resolution** | Deposit sufficient USDC before placing the order |

### E003 - ITPPaused

| Field | Value |
|-------|-------|
| **Code** | E003 |
| **Name** | `E003_ITPPaused` (Solidity) / `ITPPaused` (Rust) |
| **Description** | The specified ITP is currently paused |
| **Parameters** | `itpId: bytes32/String` - the paused ITP identifier |
| **Triggering Condition** | User attempts an operation on an ITP that governance has paused |
| **Components** | `Index.sol`, `ITP.sol` |
| **Resolution** | Wait for governance to unpause the ITP, or use a different ITP |

### E004 - SystemPaused

| Field | Value |
|-------|-------|
| **Code** | E004 |
| **Name** | `E004_SystemPaused` (Solidity) / `SystemPaused` (Rust) |
| **Description** | System is in emergency pause mode |
| **Parameters** | None |
| **Triggering Condition** | Any operation attempted while the global emergency pause is active |
| **Components** | `Governance.sol`, all contracts |
| **Resolution** | Wait for governance to lift the emergency pause |

### E005 - LimitOutOfBounds

| Field | Value |
|-------|-------|
| **Code** | E005 |
| **Name** | `E005_LimitOutOfBounds` (Solidity) / `LimitOutOfBounds` (Rust) |
| **Description** | Limit order price deviates too far from current price |
| **Parameters** | `limitPrice: uint256/u128` - submitted limit price; `currentPrice: uint256/u128` - current market price; `maxDeviation: uint256/u128` - maximum allowed deviation (50% = 5000 bps) |
| **Triggering Condition** | User's limit price is >50% away from the current market price |
| **Components** | `Index.sol` (order submission), AP limit enforcer |
| **Resolution** | Adjust limit price to be within 50% of the current market price |

### E006 - ITPNotFound

| Field | Value |
|-------|-------|
| **Code** | E006 |
| **Name** | `E006_ITPNotFound` (Solidity) / `ITPNotFound` (Rust) |
| **Description** | The specified ITP identifier does not exist |
| **Parameters** | `itpId: bytes32/String` - the unknown ITP identifier |
| **Triggering Condition** | Reference to an ITP that has not been registered |
| **Components** | `Index.sol` |
| **Resolution** | Verify the ITP ID is correct and has been registered on-chain |

---

## ITP Configuration Errors (E011-E018)

### E011 - InvalidSlippageTier

| Field | Value |
|-------|-------|
| **Code** | E011 |
| **Name** | `E011_InvalidSlippageTier` |
| **Description** | Invalid slippage tier specified |
| **Parameters** | `tier: uint256` - the invalid tier |
| **Triggering Condition** | Slippage tier is not 0 (0.3%), 1 (1%), or 2 (3%) |
| **Components** | `Index.sol` |
| **Resolution** | Use tier 0, 1, or 2 |

### E012 - InvalidDeadline

| Field | Value |
|-------|-------|
| **Code** | E012 |
| **Name** | `E012_InvalidDeadline` |
| **Description** | Order deadline is invalid |
| **Parameters** | `deadline: uint256` - submitted deadline; `currentTime: uint256` - current timestamp; `maxDuration: uint256` - max allowed (24h) |
| **Triggering Condition** | Deadline is in the past or more than 24 hours in the future |
| **Components** | `Index.sol` |
| **Resolution** | Set deadline between now and 24 hours from now |

### E013 - WeightBelowMinimum

| Field | Value |
|-------|-------|
| **Code** | E013 |
| **Name** | `E013_WeightBelowMinimum` |
| **Description** | ITP weight below minimum threshold |
| **Parameters** | `weight: uint256` - submitted weight; `minimum: uint256` - required minimum (0.25% = 2.5e15) |
| **Triggering Condition** | An asset weight in ITP creation is below 0.25% |
| **Components** | `Index.sol` |
| **Resolution** | Increase weight to at least 0.25% (2.5e15 in 18-decimal representation) |

### E014 - InvalidWeightSum

| Field | Value |
|-------|-------|
| **Code** | E014 |
| **Name** | `E014_InvalidWeightSum` |
| **Description** | ITP weights do not sum to 100% |
| **Parameters** | `actual: uint256` - actual weight sum; `expected: uint256` - expected sum (1e18) |
| **Triggering Condition** | Sum of all asset weights != 1e18 |
| **Components** | `Index.sol` |
| **Resolution** | Ensure all weights sum to exactly 1e18 (100%) |

### E015 - LengthMismatch

| Field | Value |
|-------|-------|
| **Code** | E015 |
| **Name** | `E015_LengthMismatch` |
| **Description** | ITP assets and weights arrays have different lengths |
| **Parameters** | `assetsLength: uint256`; `weightsLength: uint256` |
| **Triggering Condition** | Assets array and weights array are different sizes |
| **Components** | `Index.sol` |
| **Resolution** | Provide matching arrays of equal length |

### E016 - NoAssets

| Field | Value |
|-------|-------|
| **Code** | E016 |
| **Name** | `E016_NoAssets` |
| **Description** | ITP must have at least one asset |
| **Parameters** | None |
| **Triggering Condition** | Empty assets array in ITP creation |
| **Components** | `Index.sol` |
| **Resolution** | Provide at least one asset |

### E017 - DuplicateAsset

| Field | Value |
|-------|-------|
| **Code** | E017 |
| **Name** | `E017_DuplicateAsset` |
| **Description** | Duplicate asset in ITP creation |
| **Parameters** | `asset: address` - the duplicate asset |
| **Triggering Condition** | Same asset address appears twice in the assets array |
| **Components** | `Index.sol` |
| **Resolution** | Remove duplicate and consolidate weight |

### E018 - ZeroAssetAddress

| Field | Value |
|-------|-------|
| **Code** | E018 |
| **Name** | `E018_ZeroAssetAddress` |
| **Description** | Zero address not allowed for asset |
| **Parameters** | None |
| **Triggering Condition** | `address(0)` passed as an asset address |
| **Components** | `Index.sol` |
| **Resolution** | Provide a valid non-zero asset address |

---

## Batch & Fill Errors (E019-E024)

### E019 - CycleAlreadyProcessed

| Field | Value |
|-------|-------|
| **Code** | E019 |
| **Name** | `E019_CycleAlreadyProcessed` |
| **Description** | Cycle has already been processed |
| **Parameters** | `cycleNumber: uint256` |
| **Triggering Condition** | Attempting to submit a batch for a cycle that was already settled |
| **Components** | `Index.sol` |
| **Resolution** | Submit for the current or next cycle number |

### E020 - InvalidBLSSignature

| Field | Value |
|-------|-------|
| **Code** | E020 |
| **Name** | `E020_InvalidBLSSignature` |
| **Description** | Invalid BLS signature |
| **Parameters** | None |
| **Triggering Condition** | BLS signature verification fails on batch submission |
| **Components** | `Index.sol`, `BLSCustody.sol`, `CollateralRegistry.sol` |
| **Resolution** | Verify signing keys and message encoding match the expected format |

### E021 - OrderAlreadyBatched

| Field | Value |
|-------|-------|
| **Code** | E021 |
| **Name** | `E021_OrderAlreadyBatched` |
| **Description** | Order already batched or processed |
| **Parameters** | `orderId: uint256` |
| **Triggering Condition** | Attempting to include an order that's already in a batch |
| **Components** | `Index.sol` |
| **Resolution** | Remove the duplicate order from the batch |

### E022 - OrderNotFound

| Field | Value |
|-------|-------|
| **Code** | E022 |
| **Name** | `E022_OrderNotFound` |
| **Description** | Order not found |
| **Parameters** | `orderId: uint256` |
| **Triggering Condition** | Referencing an order ID that doesn't exist on-chain |
| **Components** | `Index.sol` |
| **Resolution** | Verify the order ID is correct |

### E023 - FillExceedsOrder

| Field | Value |
|-------|-------|
| **Code** | E023 |
| **Name** | `E023_FillExceedsOrder` |
| **Description** | Fill amount exceeds order amount |
| **Parameters** | `orderId: uint256`; `fillAmount: uint256`; `orderAmount: uint256` |
| **Triggering Condition** | Fill struct specifies more than the order's remaining unfilled amount |
| **Components** | `Index.sol` |
| **Resolution** | Reduce fill amount to at most the order amount |

### E024 - InvalidOrderStatus

| Field | Value |
|-------|-------|
| **Code** | E024 |
| **Name** | `E024_InvalidOrderStatus` |
| **Description** | Order not in correct status for this operation |
| **Parameters** | `orderId: uint256`; `currentStatus: uint256`; `requiredStatus: uint256` |
| **Triggering Condition** | Operation requires order to be in a specific state (e.g., PENDING) but it's in a different state |
| **Components** | `Index.sol` |
| **Resolution** | Check order status before attempting the operation |

---

## BLS Custody & Whitelist Errors (E025-E032)

### E025 - NonceAlreadyUsed

| Field | Value |
|-------|-------|
| **Code** | E025 |
| **Name** | `E025_NonceAlreadyUsed` |
| **Description** | Nonce already used |
| **Parameters** | `nonce: uint256` |
| **Triggering Condition** | Replay attack prevention - nonce has been consumed |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Use the next available nonce |

### E026 - TargetNotWhitelisted

| Field | Value |
|-------|-------|
| **Code** | E026 |
| **Name** | `E026_TargetNotWhitelisted` |
| **Description** | Target not whitelisted |
| **Parameters** | `target: address` |
| **Triggering Condition** | BLS custody execution attempted against a non-whitelisted contract |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Propose and approve the target through the whitelist governance process |

### E027 - ExecutionFailed

| Field | Value |
|-------|-------|
| **Code** | E027 |
| **Name** | `E027_ExecutionFailed` |
| **Description** | Execution call failed |
| **Parameters** | `target: address`; `data: bytes` |
| **Triggering Condition** | Low-level call from BLS custody to target contract reverted |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Check the target contract state and calldata encoding |

### E028 - WhitelistAlreadyProposed

| Field | Value |
|-------|-------|
| **Code** | E028 |
| **Name** | `E028_WhitelistAlreadyProposed` |
| **Description** | Whitelist already proposed |
| **Parameters** | `target: address` |
| **Triggering Condition** | Proposing a target that already has a pending whitelist proposal |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Wait for the existing proposal to be approved or expire |

### E029 - WhitelistNotProposed

| Field | Value |
|-------|-------|
| **Code** | E029 |
| **Name** | `E029_WhitelistNotProposed` |
| **Description** | Whitelist not proposed |
| **Parameters** | `target: address` |
| **Triggering Condition** | Attempting to approve a whitelist that was never proposed |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Propose the target first using the proposal function |

### E030 - TimelockNotExpired

| Field | Value |
|-------|-------|
| **Code** | E030 |
| **Name** | `E030_TimelockNotExpired` |
| **Description** | Timelock not expired |
| **Parameters** | `target: address`; `unlockTime: uint256`; `currentTime: uint256` |
| **Triggering Condition** | Attempting to finalize whitelist before timelock period ends |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Wait until `unlockTime` has passed |

### E031 - TargetAlreadyWhitelisted

| Field | Value |
|-------|-------|
| **Code** | E031 |
| **Name** | `E031_TargetAlreadyWhitelisted` |
| **Description** | Target already whitelisted |
| **Parameters** | `target: address` |
| **Triggering Condition** | Proposing a target that is already on the whitelist |
| **Components** | `BLSCustody.sol` |
| **Resolution** | No action needed - target is already approved |

### E032 - TargetNotCurrentlyWhitelisted

| Field | Value |
|-------|-------|
| **Code** | E032 |
| **Name** | `E032_TargetNotCurrentlyWhitelisted` |
| **Description** | Target not currently whitelisted |
| **Parameters** | `target: address` |
| **Triggering Condition** | Attempting to remove a target that is not on the whitelist |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Verify the target address is correct |

---

## Order & Fill Validation Errors (E034-E037)

### E034 - OrderNotYetExpired

| Field | Value |
|-------|-------|
| **Code** | E034 |
| **Name** | `E034_OrderNotYetExpired` |
| **Description** | Order has not yet expired (deadline still in future) |
| **Parameters** | `orderId: uint256`; `deadline: uint256`; `currentTime: uint256` |
| **Triggering Condition** | Attempting to cancel/refund an order whose deadline has not passed |
| **Components** | `Index.sol` |
| **Resolution** | Wait until the deadline passes, or the order may be filled before then |

### E035 - OracleRegistryNotSet

| Field | Value |
|-------|-------|
| **Code** | E035 |
| **Name** | `E035_OracleRegistryNotSet` |
| **Description** | OracleRegistry not configured |
| **Parameters** | None |
| **Triggering Condition** | Batch submission attempted before OracleRegistry is configured |
| **Components** | `Index.sol` |
| **Resolution** | Admin must set the OracleRegistry address via `setOracleRegistry()` |

### E036 - FillCycleMismatch

| Field | Value |
|-------|-------|
| **Code** | E036 |
| **Name** | `E036_FillCycleMismatch` |
| **Description** | Fill cycle number mismatch |
| **Parameters** | `fillCycleNumber: uint256`; `expectedCycleNumber: uint256` |
| **Triggering Condition** | Fill struct's cycle number doesn't match the batch's expected cycle |
| **Components** | `Index.sol` |
| **Resolution** | Ensure fill data references the correct cycle number |

### E037 - ZeroSharesCalculated

| Field | Value |
|-------|-------|
| **Code** | E037 |
| **Name** | `E037_ZeroSharesCalculated` |
| **Description** | Shares calculation resulted in zero |
| **Parameters** | `fillAmount: uint256`; `fillPrice: uint256` |
| **Triggering Condition** | Fill amount and price produce zero shares due to precision loss |
| **Components** | `Index.sol` |
| **Resolution** | Increase fill amount or adjust price to produce non-zero shares |

---

## Upgrade Errors (E038-E044)

### E038 - ZeroImplementation

| Field | Value |
|-------|-------|
| **Code** | E038 |
| **Name** | `E038_ZeroImplementation` |
| **Description** | Zero address not allowed for implementation |
| **Parameters** | None |
| **Triggering Condition** | Upgrade proposed with `address(0)` as new implementation |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Provide a valid non-zero implementation address |

### E039 - UpgradeAlreadyPending

| Field | Value |
|-------|-------|
| **Code** | E039 |
| **Name** | `E039_UpgradeAlreadyPending` |
| **Description** | Upgrade already pending |
| **Parameters** | None |
| **Triggering Condition** | Proposing an upgrade when one is already queued |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Cancel or finalize the existing upgrade first |

### E040 - NoPendingUpgrade

| Field | Value |
|-------|-------|
| **Code** | E040 |
| **Name** | `E040_NoPendingUpgrade` |
| **Description** | No pending upgrade |
| **Parameters** | None |
| **Triggering Condition** | Attempting to finalize or cancel an upgrade when none is pending |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Propose an upgrade first |

### E041 - ImplementationMismatch

| Field | Value |
|-------|-------|
| **Code** | E041 |
| **Name** | `E041_ImplementationMismatch` |
| **Description** | Implementation address mismatch |
| **Parameters** | `expected: address`; `actual: address` |
| **Triggering Condition** | Finalization address doesn't match the proposed implementation |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Use the exact implementation address from the proposal |

### E042 - UpgradeTimelockActive

| Field | Value |
|-------|-------|
| **Code** | E042 |
| **Name** | `E042_UpgradeTimelockActive` |
| **Description** | Upgrade timelock not expired |
| **Parameters** | `unlockTime: uint256`; `currentTime: uint256` |
| **Triggering Condition** | Attempting to finalize upgrade before timelock expires |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Wait until `unlockTime` has passed |

### E043 - ZeroOracleRegistry

| Field | Value |
|-------|-------|
| **Code** | E043 |
| **Name** | `E043_ZeroOracleRegistry` |
| **Description** | Zero address not allowed for oracle registry |
| **Parameters** | None |
| **Triggering Condition** | Setting oracle registry to `address(0)` |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Provide a valid non-zero OracleRegistry address |

### E044 - StandardUpgradePending

| Field | Value |
|-------|-------|
| **Code** | E044 |
| **Name** | `E044_StandardUpgradePending` |
| **Description** | Cannot use emergency upgrade when standard upgrade pending |
| **Parameters** | None |
| **Triggering Condition** | Emergency upgrade attempted while a standard upgrade is queued |
| **Components** | `BLSCustody.sol` |
| **Resolution** | Cancel the standard upgrade before using emergency upgrade |

---

## L3 Bridge Custody Errors (E045-E053)

### E045 - LockAlreadyReleased

| Field | Value |
|-------|-------|
| **Code** | E045 |
| **Name** | `E045_LockAlreadyReleased` |
| **Description** | Lock already released |
| **Parameters** | `nonce: uint256` |
| **Triggering Condition** | Attempting to release a lock that was already released |
| **Components** | `L3BridgeCustody.sol` |
| **Resolution** | No action needed - lock was already processed |

### E046 - LockAlreadyReversed

| Field | Value |
|-------|-------|
| **Code** | E046 |
| **Name** | `E046_LockAlreadyReversed` |
| **Description** | Lock already reversed |
| **Parameters** | `nonce: uint256` |
| **Triggering Condition** | Attempting to reverse a lock that was already reversed |
| **Components** | `L3BridgeCustody.sol` |
| **Resolution** | No action needed - lock was already reversed |

### E047 - LockTimeoutNotReached

| Field | Value |
|-------|-------|
| **Code** | E047 |
| **Name** | `E047_LockTimeoutNotReached` |
| **Description** | Lock timeout not reached yet |
| **Parameters** | `nonce: uint256`; `lockedAt: uint256`; `currentTime: uint256` |
| **Triggering Condition** | Attempting emergency reversal before timeout period |
| **Components** | `L3BridgeCustody.sol` |
| **Resolution** | Wait for the timeout period to elapse |

### E048 - InsufficientSignerCount

| Field | Value |
|-------|-------|
| **Code** | E048 |
| **Name** | `E048_InsufficientSignerCount` |
| **Description** | Insufficient signer count for emergency operation |
| **Parameters** | `provided: uint256`; `required: uint256` |
| **Triggering Condition** | Emergency operation submitted without enough signers |
| **Components** | `L3BridgeCustody.sol` |
| **Resolution** | Gather more signer approvals to meet the threshold |

### E049 - LockNotFound

| Field | Value |
|-------|-------|
| **Code** | E049 |
| **Name** | `E049_LockNotFound` |
| **Description** | Lock not found |
| **Parameters** | `nonce: uint256` |
| **Triggering Condition** | Referencing a lock nonce that doesn't exist |
| **Components** | `L3BridgeCustody.sol` |
| **Resolution** | Verify the nonce is correct |

### E050 - ZeroUSDCAddress

| Field | Value |
|-------|-------|
| **Code** | E050 |
| **Name** | `E050_ZeroUSDCAddress` |
| **Description** | Zero address for USDC |
| **Parameters** | None |
| **Triggering Condition** | USDC address set to `address(0)` during initialization |
| **Components** | `L3BridgeCustody.sol` |
| **Resolution** | Provide the correct USDC contract address |

### E051 - TooManyAssets

| Field | Value |
|-------|-------|
| **Code** | E051 |
| **Name** | `E051_TooManyAssets` |
| **Description** | ITP has too many assets |
| **Parameters** | `count: uint256`; `maximum: uint256` |
| **Triggering Condition** | ITP creation with more assets than the maximum allowed |
| **Components** | `Index.sol` |
| **Resolution** | Reduce the number of assets to at most the maximum |

### E052 - ZeroAmount

| Field | Value |
|-------|-------|
| **Code** | E052 |
| **Name** | `E052_ZeroAmount` |
| **Description** | Zero amount not allowed for bridge |
| **Parameters** | None |
| **Triggering Condition** | Bridge operation with zero amount |
| **Components** | `L3BridgeCustody.sol` |
| **Resolution** | Provide a non-zero amount |

### E053 - InvalidDestChainId

| Field | Value |
|-------|-------|
| **Code** | E053 |
| **Name** | `E053_InvalidDestChainId` |
| **Description** | Invalid destination chain ID |
| **Parameters** | `destChainId: uint256` |
| **Triggering Condition** | Bridge destination chain ID is zero or unsupported |
| **Components** | `L3BridgeCustody.sol` |
| **Resolution** | Use a valid, supported destination chain ID |

---

## Arb Bridge Custody Errors (E054-E060)

### E054 - BridgeAlreadyCompleted

| Field | Value |
|-------|-------|
| **Code** | E054 |
| **Name** | `E054_BridgeAlreadyCompleted` |
| **Description** | Bridge already completed for this source chain + nonce |
| **Parameters** | `sourceChainId: uint256`; `nonce: uint256` |
| **Triggering Condition** | Attempting to complete a bridge operation that was already processed |
| **Components** | `ArbBridgeCustody.sol` |
| **Resolution** | No action needed - bridge was already completed |

### E055 - InvalidSourceChainId

| Field | Value |
|-------|-------|
| **Code** | E055 |
| **Name** | `E055_InvalidSourceChainId` |
| **Description** | Invalid source chain ID |
| **Parameters** | `sourceChainId: uint256` |
| **Triggering Condition** | Source chain ID is zero or same as the current chain |
| **Components** | `ArbBridgeCustody.sol` |
| **Resolution** | Use a valid source chain ID different from the current chain |

### E056 - ZeroL3IndexAddress

| Field | Value |
|-------|-------|
| **Code** | E056 |
| **Name** | `E056_ZeroL3IndexAddress` |
| **Description** | Zero address for L3 Index contract |
| **Parameters** | None |
| **Triggering Condition** | L3 Index address set to `address(0)` |
| **Components** | `ArbBridgeCustody.sol` |
| **Resolution** | Provide the correct L3 Index contract address |

### E057 - InvalidProof

| Field | Value |
|-------|-------|
| **Code** | E057 |
| **Name** | `E057_InvalidProof` |
| **Description** | Invalid proof (zero values not allowed) |
| **Parameters** | None |
| **Triggering Condition** | Cross-chain proof contains zero values |
| **Components** | `ArbBridgeCustody.sol` |
| **Resolution** | Provide valid non-zero proof data |

### E058 - InvalidDeadline (Cross-Chain)

| Field | Value |
|-------|-------|
| **Code** | E058 |
| **Name** | `E058_InvalidDeadline` |
| **Description** | Invalid deadline for cross-chain order |
| **Parameters** | `deadline: uint256`; `minDeadline: uint256`; `maxDeadline: uint256` |
| **Triggering Condition** | Cross-chain order deadline is outside the allowed range |
| **Components** | `ArbBridgeCustody.sol` |
| **Resolution** | Set deadline between `minDeadline` and `maxDeadline` |

### E059 - CrossChainOrderZeroAmount

| Field | Value |
|-------|-------|
| **Code** | E059 |
| **Name** | `E059_CrossChainOrderZeroAmount` |
| **Description** | Zero amount for cross-chain order |
| **Parameters** | None |
| **Triggering Condition** | Cross-chain order submitted with zero amount |
| **Components** | `ArbBridgeCustody.sol` |
| **Resolution** | Provide a non-zero order amount |

### E060 - ZeroITPId

| Field | Value |
|-------|-------|
| **Code** | E060 |
| **Name** | `E060_ZeroITPId` |
| **Description** | Zero ITP ID for cross-chain order |
| **Parameters** | None |
| **Triggering Condition** | Cross-chain order submitted with zero ITP ID |
| **Components** | `ArbBridgeCustody.sol` |
| **Resolution** | Provide a valid non-zero ITP identifier |

---

## Access Control & Validation Errors (E061-E064)

### E061 - Unauthorized

| Field | Value |
|-------|-------|
| **Code** | E061 |
| **Name** | `E061_Unauthorized` |
| **Description** | Caller is not authorized (admin-only function) |
| **Parameters** | `caller: address` - the unauthorized caller; `requiredRole: address` - the required role (admin address) |
| **Triggering Condition** | Non-admin address calls an admin-only function |
| **Components** | `Index.sol` |
| **Resolution** | Call from the authorized admin address |

### E062 - AlreadyInitialized

| Field | Value |
|-------|-------|
| **Code** | E062 |
| **Name** | `E062_AlreadyInitialized` |
| **Description** | Contract or field already initialized |
| **Parameters** | None |
| **Triggering Condition** | Attempting to re-initialize a field that can only be set once |
| **Components** | `Index.sol` |
| **Resolution** | This field has already been configured and cannot be changed |

### E063 - MintFailed

| Field | Value |
|-------|-------|
| **Code** | E063 |
| **Name** | `E063_MintFailed` |
| **Description** | External call to mint ITP tokens failed |
| **Parameters** | `vault: address` - the vault that failed; `itpId: bytes32` - the ITP identifier |
| **Triggering Condition** | ITP vault's `mint()` function reverted during fill processing |
| **Components** | `Index.sol` |
| **Resolution** | Check ITP vault contract state and minting permissions |

### E064 - StringTooLong

| Field | Value |
|-------|-------|
| **Code** | E064 |
| **Name** | `E064_StringTooLong` |
| **Description** | String exceeds maximum bytes32 length |
| **Parameters** | `length: uint256` - actual string length; `maximum: uint256` - max allowed (32) |
| **Triggering Condition** | String conversion to bytes32 fails because the string is longer than 32 bytes |
| **Components** | `Index.sol` |
| **Resolution** | Use a string of at most 32 bytes |

---

## Infrastructure Errors (INFRA-001 to INFRA-013)

These errors are defined in `common/src/error.rs` and cover system-level failures in Rust services. They use the `INFRA-XXX` prefix to distinguish from protocol errors (E001-E006).

### INFRA-001 - ChainRead

| Field | Value |
|-------|-------|
| **Code** | INFRA-001 |
| **Name** | `ChainRead` |
| **Description** | Chain read error (RPC query failure) |
| **Parameters** | `message: String` - error details |
| **Triggering Condition** | RPC call to read on-chain state fails (network timeout, node error) |
| **Components** | AP event monitor, oracle chain reader, common RPC client |
| **Resolution** | Check RPC endpoint connectivity and node health |

### INFRA-002 - ChainWrite

| Field | Value |
|-------|-------|
| **Code** | INFRA-002 |
| **Name** | `ChainWrite` |
| **Description** | Chain write error (transaction submission failure) |
| **Parameters** | `message: String` - error details |
| **Triggering Condition** | Transaction submission fails (nonce issues, gas estimation, signing) |
| **Components** | Oracle chain writer, AP fill reporter |
| **Resolution** | Check wallet balance, nonce state, and gas price settings |

### INFRA-003 - TransactionFailed

| Field | Value |
|-------|-------|
| **Code** | INFRA-003 |
| **Name** | `TransactionFailed` |
| **Description** | Transaction failed on-chain |
| **Parameters** | `message: String` - error details |
| **Triggering Condition** | Transaction was mined but reverted |
| **Components** | Oracle chain writer |
| **Resolution** | Check transaction revert reason in explorer. Likely a contract-level error (E001-E064) |

### INFRA-004 - BlsSigning

| Field | Value |
|-------|-------|
| **Code** | INFRA-004 |
| **Name** | `BlsSigning` |
| **Description** | BLS signing error |
| **Parameters** | `message: String` - error details |
| **Triggering Condition** | BLS private key operation fails |
| **Components** | Oracle consensus module |
| **Resolution** | Check BLS key configuration and key file integrity |

### INFRA-005 - BlsVerification

| Field | Value |
|-------|-------|
| **Code** | INFRA-005 |
| **Name** | `BlsVerification` |
| **Description** | BLS verification failed |
| **Parameters** | `message: String` - error details |
| **Triggering Condition** | BLS signature verification on received message fails |
| **Components** | Oracle consensus module |
| **Resolution** | Verify the signing oracle's public key is registered correctly |

### INFRA-006 - SignatureAggregation

| Field | Value |
|-------|-------|
| **Code** | INFRA-006 |
| **Name** | `SignatureAggregation` |
| **Description** | Signature aggregation failed |
| **Parameters** | `message: String` - error details |
| **Triggering Condition** | Combining multiple BLS signatures into an aggregate fails |
| **Components** | Oracle consensus module |
| **Resolution** | Verify all individual signatures are valid before aggregation |

### INFRA-007 - P2PConnection

| Field | Value |
|-------|-------|
| **Code** | INFRA-007 |
| **Name** | `P2PConnection` |
| **Description** | P2P connection error |
| **Parameters** | `message: String` - error details |
| **Triggering Condition** | Failed to establish or maintain connection to a peer oracle |
| **Components** | Oracle P2P networking |
| **Resolution** | Check peer address, port, and firewall settings |

### INFRA-008 - P2PBroadcast

| Field | Value |
|-------|-------|
| **Code** | INFRA-008 |
| **Name** | `P2PBroadcast` |
| **Description** | P2P broadcast failed |
| **Parameters** | `message: String` - error details |
| **Triggering Condition** | Failed to send a message to one or more peers |
| **Components** | Oracle P2P networking |
| **Resolution** | Check peer connectivity and network configuration |

### INFRA-009 - P2PReceive

| Field | Value |
|-------|-------|
| **Code** | INFRA-009 |
| **Name** | `P2PReceive` |
| **Description** | P2P message receive error |
| **Parameters** | `message: String` - error details |
| **Triggering Condition** | Error receiving or deserializing a peer message |
| **Components** | Oracle P2P networking |
| **Resolution** | Check message format compatibility between peers |

### INFRA-010 - ApClient

| Field | Value |
|-------|-------|
| **Code** | INFRA-010 |
| **Name** | `ApClient` |
| **Description** | AP client error |
| **Parameters** | `message: String` - error details |
| **Triggering Condition** | Internal AP client communication failure |
| **Components** | Oracle AP client |
| **Resolution** | Check AP service availability and endpoint configuration |

### INFRA-011 - Authentication

| Field | Value |
|-------|-------|
| **Code** | INFRA-011 |
| **Name** | `Authentication` |
| **Description** | Authentication error |
| **Parameters** | `message: String` - error details |
| **Triggering Condition** | API key, signature, or credential verification fails for external service |
| **Components** | AP external integrations (Bitget, 1inch) |
| **Resolution** | Verify API credentials are correct and not expired |

### INFRA-012 - RateLimit

| Field | Value |
|-------|-------|
| **Code** | INFRA-012 |
| **Name** | `RateLimit` |
| **Description** | Rate limit exceeded |
| **Parameters** | `message: String` - error details |
| **Triggering Condition** | External API rate limit reached |
| **Components** | AP external integrations, common HTTP client |
| **Resolution** | Reduce request frequency or increase rate limit allocation |

### INFRA-013 - ExternalService

| Field | Value |
|-------|-------|
| **Code** | INFRA-013 |
| **Name** | `ExternalService` |
| **Description** | External service error |
| **Parameters** | `message: String` - error details |
| **Triggering Condition** | External service returns unexpected response or is down |
| **Components** | AP external integrations (DEX quotes, price feeds) |
| **Resolution** | Check external service status and API compatibility |

---

## Cross-Language Reference

### Protocol Errors (Solidity <-> Rust)

The following errors are defined in both languages with matching names, parameters, and semantics:

| Code | Solidity (`ErrorsLib.sol`) | Rust (`common/src/errors.rs`) | Parameters Match |
|------|---------------------------|-------------------------------|-----------------|
| E001 | `E001_OrderBelowMin(uint256, uint256)` | `IndexError::OrderBelowMin { amount, minimum }` | Yes |
| E002 | `E002_InsufficientBalance(address, uint256, uint256)` | `IndexError::InsufficientBalance { user, required, available }` | Yes (address -> String) |
| E003 | `E003_ITPPaused(bytes32)` | `IndexError::ITPPaused { itp_id }` | Yes (bytes32 -> String) |
| E004 | `E004_SystemPaused()` | `IndexError::SystemPaused` | Yes (no params) |
| E005 | `E005_LimitOutOfBounds(uint256, uint256, uint256)` | `IndexError::LimitOutOfBounds { limit_price, current_price, max_deviation }` | Yes |
| E006 | `E006_ITPNotFound(bytes32)` | `IndexError::ITPNotFound { itp_id }` | Yes (bytes32 -> String) |

### Solidity-Only Errors (E011-E064)

Errors E011-E064 exist only in Solidity (`ErrorsLib.sol`). They cover contract-specific concerns (ITP configuration, batch processing, custody, upgrades, bridging, access control) that don't have direct Rust counterparts since Rust services interact with these through ABI decoding of contract reverts.

### Infrastructure Errors (Rust-Only)

INFRA-001 through INFRA-013 exist only in Rust (`common/src/error.rs`). They cover system-level failures that don't have Solidity equivalents since they represent off-chain infrastructure issues.

### AP-Specific Errors (Rust-Only)

The `APError` enum in `ap/src/error.rs` provides additional AP-specific error types that map to protocol codes:

| AP Error | Protocol Code | Description |
|----------|---------------|-------------|
| `APError::Subscription` | INFRA | Event subscription failure |
| `APError::SourceUnavailable` | INFRA | Liquidity source offline |
| `APError::APSuspended` | INFRA | AP suspended due to source failure |
| `APError::OrderAutoRefunded` | INFRA | Order pending timeout triggered refund |
| `APError::OrderExpired` | INFRA | Order age exceeded limit |
| `APError::OrderTimeout` | INFRA | Order execution timeout (60s) |

---

## Log Examples

All services use the `tracing` crate with JSON output. Error codes appear as structured fields.

### WARN Level - Limit Violation (E005)

```json
{
  "timestamp": "2025-01-15T14:30:10.000Z",
  "level": "WARN",
  "code": "E005",
  "order_id": "67891",
  "limit_price": "1500000000000000000",
  "current_price": "1000000000000000000",
  "message": "Order limit price exceeds bounds",
  "target": "ap::limit_enforcer"
}
```

### ERROR Level - Chain Write Failure (INFRA-002)

```json
{
  "timestamp": "2025-01-15T14:30:15.000Z",
  "level": "ERROR",
  "code": "INFRA-002",
  "cycle_number": 12345,
  "message": "Failed to submit batch transaction",
  "error": "nonce too low",
  "target": "oracle::chain::writer"
}
```

### ERROR Level - P2P Connection (INFRA-007)

```json
{
  "timestamp": "2025-01-15T14:30:20.000Z",
  "level": "ERROR",
  "code": "INFRA-007",
  "peer_id": "0xabc123",
  "message": "Failed to connect to peer",
  "error": "connection refused",
  "target": "oracle::consensus::p2p"
}
```

### DEBUG Level - Stack Trace (debug-only)

```json
{
  "timestamp": "2025-01-15T14:30:25.000Z",
  "level": "DEBUG",
  "code": "INFRA-001",
  "message": "Chain read error with trace",
  "error": "RPC timeout after 30s",
  "backtrace": "0: ap::event_monitor::poll_events\n1: tokio::runtime::task::harness\n...",
  "target": "ap::event_monitor"
}
```

### INFO Level - Normal Operation

```json
{
  "timestamp": "2025-01-15T14:31:00.000Z",
  "level": "INFO",
  "cycle_number": 12346,
  "orders_processed": 15,
  "orders_refunded": 0,
  "message": "Cycle completed successfully",
  "target": "oracle::cycle"
}
```

---

## Log Level Guidelines

| Level | Usage | Error Code Required | Retention |
|-------|-------|---------------------|-----------|
| **ERROR** | Failures requiring operator attention | Yes | 90 days |
| **WARN** | Unusual conditions, degraded state | Yes (when applicable) | 90 days |
| **INFO** | Normal operations (cycle start, fills) | No | 30 days |
| **DEBUG** | Detailed debugging, stack traces | Optional | 7 days |

**Stack traces** appear only at DEBUG level (not in ERROR/WARN/INFO output) to keep production logs clean while preserving debugging capability.
