# Solidity Smart Contract Security Audit Report

**Date:** 2026-02-25
**Scope:** All contracts under `contracts/src/` (~50 files)
**Methodology:** Map-Hunt-Attack with Slither/Aderyn integration, 3 parallel audit rounds + cross-validation
**Compiler:** Solidity 0.8.24, UUPS upgradeable pattern
**Tools:** Slither (378 findings), Aderyn (failed — Prague EVM), Cyfrin checklist, Solodit DB

---

## Executive Summary

11 findings identified across core Investment, BLS verification, bridge, custody, oracle, and Vision contracts. **1 CRITICAL** (infinite token mint via replay), **7 HIGH** (DoS, accounting corruption, liveness, front-running), **3 MEDIUM**.

The protocol's BLS verification is never bypassed, but several BLS-verified functions lack replay protection, domain separation, or proper threshold enforcement. The critical finding (C-1) allows unlimited BridgedITP minting via signature replay and must be fixed immediately.

| # | Title | Severity | Confidence | Contract | Lines |
|---|-------|----------|------------|----------|-------|
| C-1 | BridgeProxy `mintBridgedShares`/`burnBridgedShares` BLS signature replay | **CRITICAL** | Confirmed (3/3) | BridgeProxy.sol | 389–436 |
| H-1 | ITP ERC4626 token transfers desync `_userShares` — fill batch DoS | **HIGH** | Confirmed (2/2) | ITP.sol, Investment.sol | 219–254, 489–492 |
| H-2 | Assert unit mismatch in `_safeTransferOrEscrow` — DoS on SELL fills | **HIGH** | Confirmed | Investment.sol | 519 |
| H-3 | BLS verification requires 100% signer participation — liveness risk | **HIGH** | Confirmed (2/2) | BLSVerifier.sol | 85–90 |
| H-4 | Missing `_disableInitializers()` in custody constructors | **HIGH** | Confirmed (2/2) | ArbBridgeCustody.sol, L3BridgeCustody.sol | — |
| H-5 | ITPNAVOracle missing `chainId`/`address(this)` in BLS message | **HIGH** | Confirmed (2/2) | ITPNAVOracle.sol | 90–92 |
| H-6 | ITPNAVOracle bypasses BLSVerifier — no threshold, snapshot, or liveness | **HIGH** | Confirmed (2/2) | ITPNAVOracle.sol | 95–101 |
| H-7 | SELL order `totalSupply` inflation on refund/cancel | **HIGH** | Confirmed | Investment.sol | 254, 592–593, 1048–1049, 1112–1113 |
| H-8 | `ArbBridgeCustody.completeBridge` sends USDC to `msg.sender` — front-run theft | **HIGH** | Confirmed | ArbBridgeCustody.sol | 158, 173 |
| M-1 | Silent `totalSupply`/`totalValue` skip on underflow | **MEDIUM** | Confirmed | Investment.sol | 479–484 |
| M-2 | `reverseLock` signerCount not derived from bitmask | **MEDIUM** | Likely | L3BridgeCustody.sol | 225 |
| M-3 | `rebalance`/`setItpNav` replay — theoretical stale NAV rollback | **MEDIUM** | Possible | Investment.sol | 760–785, 814–819 |

### Slither False Positives Dismissed

- **unprotected-upgrade (3 High):** Expected UUPS — `_authorizeUpgrade` is BLS/owner-gated everywhere
- **reentrancy-no-eth (45 Medium):** All from `incrementMissedCounts` calls — advisory-only state writes on trusted contract
- **incorrect-equality (13 Medium):** Enum comparisons (`== OrderStatus.PENDING`) — correct Solidity
- **arbitrary-send-erc20 (1 High):** `ArbBridgeCustody.completeSellOrder` — vault address is BLS-verified

### Hypotheses Falsified During Audit

- **Vision withdraw() double-pay after claimRewards** — `finalBalance` is BLS-signed by issuers who account for prior claims
- **Vision withdraw() double-fee** — depends on above; issuers sign correct remaining balance
- **ERC4626 inflation attack on ITP** — `deposit()`/`mint()` revert unconditionally; shares only via Investment
- **Reentrancy in BLS-gated functions** — `incrementMissedCounts` is advisory on trusted contract

---

## C-1: BridgeProxy BLS Signature Replay — Infinite Token Minting (CRITICAL)

### Location
`contracts/src/bridge/BridgeProxy.sol:389-436`

### Description

`mintBridgedShares` and `burnBridgedShares` have **zero replay protection**. The BLS message hash contains no nonce, orderId, or unique identifier. `BLSVerifier._verifyBLS` does not consume or track used signatures — `referenceNonce` is only a snapshot lookup key, not a consumed nonce.

The same valid BLS signature can be submitted unlimited times within the snapshot window (~86,400 blocks / ~3.5 days on Arbitrum). The function is permissionless (no `msg.sender` check).

### Code Path

```
mintBridgedShares(itpId, user, amount, blsSig, refNonce, bitmask):
  message = keccak256(abi.encode(chainid, this, "mintBridgedShares", itpId, user, amount))  // NO NONCE
  _verifyBLS(message, blsSig, refNonce, bitmask)  // stateless — no nonce consumption
  IBridgedITP(bridgedItp).mint(user, amount)  // mints unconditionally
  // NO state change preventing replay
```

### Contrast With Protected Functions

The codebase knows how to do replay protection but failed to apply it here:
- `BLSCustody`: `usedNonces` bitmap + `_isNonceUsed` / `_markNonceUsed`
- `ArbBridgeCustody.completeBridge`: `bridgeCompleted[sourceChainId][nonce]`
- `BridgeProxy.completeCreateItp`: `pending.completed = true`

### Attack Scenario

1. Issuers sign a legitimate `mintBridgedShares(itpX, Alice, 1000e18)` message
2. Relayer broadcasts the tx. Anyone observing the mempool copies the calldata
3. Attacker replays the exact same call N times. Each call mints 1000e18 tokens
4. BLS signature passes every time (same message hash, same pubkey, stateless verifier)
5. Attacker mints unlimited BridgedITP → redeems for USDC via sell orders → drains custody

### Impact

Protocol drain. Unlimited BridgedITP minting breaks supply conservation invariant. If BridgedITP is redeemable for USDC, the entire ArbBridgeCustody can be drained.

`burnBridgedShares` has the same issue — replay burns more tokens than intended.

### Proposed Fix

Add a unique nonce to the message hash and track consumed nonces:

```diff
+mapping(bytes32 => bool) public mintNonceUsed;

 function mintBridgedShares(
-    bytes32 itpId, address user, uint256 amount,
+    bytes32 itpId, address user, uint256 amount, uint256 mintNonce,
     bytes calldata blsSignature, uint256 referenceNonce, uint256 signersBitmask
 ) external override whenNotPaused {
+    bytes32 nonceKey = keccak256(abi.encode("mint", itpId, user, amount, mintNonce));
+    if (mintNonceUsed[nonceKey]) revert ErrorsLib.E_NONCE_USED();
+    mintNonceUsed[nonceKey] = true;
+
     bytes32 message = keccak256(abi.encode(
-        block.chainid, address(this), "mintBridgedShares", itpId, user, amount
+        block.chainid, address(this), "mintBridgedShares", itpId, user, amount, mintNonce
     ));
     _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);
     // ...
 }
```

Apply same pattern to `burnBridgedShares`.

---

## H-1: ITP ERC4626 Token Transfers Desync `_userShares` (HIGH)

### Location
`contracts/src/core/ITP.sol` (no transfer override), `contracts/src/core/Investment.sol:219-254, 489-492`

### Description

ITP inherits OpenZeppelin's ERC4626/ERC20 and does NOT override `transfer()` or `transferFrom()`. Investment.sol maintains a parallel `_userShares` mapping that is never updated on ERC20 transfers.

### Code Path

```
1. Alice buys ITP shares → _userShares[Alice] = 100, ERC20 balance = 100
2. Alice calls ITP.transfer(Bob, 100) → ERC20 balance Alice=0, Bob=100. _userShares unchanged.
3. Alice calls submitOrder(SELL, 100) → passes _userShares check (line 219), _userShares[Alice] -= 100
4. confirmFills() → vault.burn(Alice, 100) → Alice ERC20 balance is 0 → REVERT
5. Entire confirmFills batch DOSed (line 492: revert E063_MintFailed)
```

### Impact

A single malicious user can DoS the fill pipeline indefinitely by creating unsettleable sell orders. Every batch containing their order reverts, blocking all legitimate fills.

### Proposed Fix

```solidity
// In ITP.sol — disable ERC20 transfers
function transfer(address, uint256) public pure override returns (bool) {
    revert("ITP: use Investment");
}
function transferFrom(address, address, uint256) public pure override returns (bool) {
    revert("ITP: use Investment");
}
```

---

## H-2: Assert Unit Mismatch in `_safeTransferOrEscrow` (HIGH)

### Location
`contracts/src/core/Investment.sol:519`

### Description

`_safeTransferOrEscrow` compares `failedFillEscrow[orderId]` (USDC) against `orders[orderId].amount` (shares for SELL orders). When NAV > $1, USDC value exceeds share amount, causing assert to panic-revert the entire `confirmFills()` batch.

### Code Path

```
confirmFills() → _processFill() [SELL, line 496]:
  usdcToReturn = (10e18 shares * 5e18 price) / 1e18 = 50e18 USDC
  _safeTransferOrEscrow(orderId, user, 50e18)

_safeTransferOrEscrow() [line 518-519]:
  failedFillEscrow[orderId] += 50e18     // USDC
  assert(failedFillEscrow[orderId] <= orders[orderId].amount)  // 50e18 <= 10e18 → PANIC
```

### Impact

Any poisoned SELL order at NAV > $1 (receive-reverting contract, USDC-blacklisted address) DoSes the entire fill batch.

### Proposed Fix

Delete the assert. Escrow is bounded by actual contract USDC balance.

```diff
  if (!transferred) {
      failedFillEscrow[orderId] += amount;
-     assert(failedFillEscrow[orderId] <= orders[orderId].amount);
      emit EventsLib.FillFailed(orderId, user, amount);
  }
```

---

## H-3: BLS Verification Requires 100% Signer Participation (HIGH)

### Location
`contracts/src/libraries/BLSVerifier.sol:85-90`

### Description

`_verifyBLS()` checks `popcount(signersBitmask) >= activeCount * 2/3 + 1` (line 85) as a threshold gate, then verifies the BLS signature against the FULL `snap.aggregatedPubkey` (line 88-89). In standard BLS aggregation, a signature from k < n issuers does NOT verify against the n-issuer aggregated key.

There is no non-signer pubkey subtraction (no EigenLayer-style G2 point negation). The threshold check is **decorative** — the BLS pairing check is the binding constraint and requires **ALL** active issuers.

### Impact

Zero fault tolerance. Single issuer offline → all BLS operations halt: fills, refunds, rebalances, bridges, Vision payouts. User funds locked in pending orders.

### Proposed Fix

Implement EigenLayer-style non-signer subtraction:

```solidity
function _verifyBLS(
    bytes32 messageHash,
    bytes calldata blsSignature,
    uint256 referenceNonce,
    uint256 signersBitmask,
    bytes32[4][] calldata nonSignerPubkeys  // NEW
) internal {
    // ... existing checks ...

    // Subtract non-signer keys from aggregated pubkey
    bytes memory effectivePubkey = _fixedToPubkey(snap.aggregatedPubkey);
    for (uint256 i = 0; i < nonSignerPubkeys.length; i++) {
        effectivePubkey = BLSLib.subtractG2(effectivePubkey, _fixedToPubkey(nonSignerPubkeys[i]));
    }

    if (!BLSLib.verifyBLS(effectivePubkey, messageHash, blsSignature))
        revert BLSVerifier__InvalidSignature();
}
```

**Breaking change:** All ~55 BLS call sites need updated. Off-chain issuers must include non-signer pubkeys in payloads.

---

## H-4: Missing `_disableInitializers()` in Custody Constructors (HIGH)

### Location
`contracts/src/custody/ArbBridgeCustody.sol`, `contracts/src/custody/L3BridgeCustody.sol`

### Description

Both UUPS upgradeable contracts inherit `Initializable` but have NO constructor. OpenZeppelin v5 does NOT auto-disable initializers. Anyone can call `initialize()` on the implementation contract directly.

6 other contracts in the codebase correctly implement `_disableInitializers()` in their constructors: Governance, FeeRegistry, MirrorIssuerRegistry, IssuerRegistry, BridgeProxy, BLSCustody.

### Proposed Fix

```solidity
/// @custom:oz-upgrades-unsafe-allow constructor
constructor() {
    _disableInitializers();
}
```

---

## H-5: ITPNAVOracle Missing Domain Separation in BLS Message (HIGH)

### Location
`contracts/src/oracle/ITPNAVOracle.sol:90-92`

### Description

```solidity
bytes32 messageHash = keccak256(
    abi.encodePacked(itpAddress, newPrice, timestamp, cycleNumber)
);
```

This is the **only** BLS-verified function in the entire codebase that omits `block.chainid` and `address(this)`. Every other BLS operation (20+ call sites) uses `keccak256(abi.encode(block.chainid, address(this), ...))`.

### Impact

Cross-chain replay: a valid price update signed for Chain A can be replayed on Chain B if the same ITP address and issuer set exist on both chains. Since the oracle feeds Morpho Blue lending markets, stale/incorrect prices enable under-collateralized borrowing or unfair liquidations.

### Proposed Fix

```diff
-bytes32 messageHash = keccak256(
-    abi.encodePacked(itpAddress, newPrice, timestamp, cycleNumber)
-);
+bytes32 messageHash = keccak256(
+    abi.encode(block.chainid, address(this), itpAddress, newPrice, timestamp, cycleNumber)
+);
```

Update off-chain signing code to include `chainId` and `oracleAddress`.

---

## H-6: ITPNAVOracle Bypasses BLSVerifier (HIGH)

### Location
`contracts/src/oracle/ITPNAVOracle.sol:95-101`

### Description

The oracle uses `BLSLib.verifyBLS()` directly instead of inheriting `BLSVerifier`. This skips:

1. **Snapshot-based verification** — reads CURRENT pubkey, not historical snapshot. Key rotation between signing and execution can fail valid signatures or pass stale ones.
2. **Signer bitmask validation** — `signersBitmask` parameter is accepted but only emitted in events. Never checked as subset of active issuers.
3. **Threshold enforcement** — no popcount check.
4. **Liveness tracking** — `incrementMissedCounts` never called.

### Proposed Fix

Inherit `BLSVerifier` and use `_verifyBLS()` like every other contract. Or at minimum: add threshold validation by reading active issuer count from mirror registry and validating `popcount(signersBitmask) >= activeCount * 2 / 3 + 1`.

---

## H-7: SELL Order `totalSupply` Inflation on Refund/Cancel (HIGH)

### Location
`contracts/src/core/Investment.sol:254, 592-593, 1048-1049, 1112-1113`

### Description

On SELL submission (line 254): only `_userShares` is decremented, NOT `totalSupply`. On every refund path: BOTH `_userShares` AND `totalSupply` are incremented.

```
submitOrder(SELL):     _userShares -= amount        // totalSupply unchanged
refundExpiredOrder:    _userShares += amount; totalSupply += amount  // INFLATION
cancelStalePending:    _userShares += amount; totalSupply += amount  // INFLATION
refundTimedOutBatch:   _userShares += amount; totalSupply += amount  // INFLATION
```

Each SELL-then-refund cycle permanently inflates `totalSupply` by `order.amount`.

### Impact

Cumulative accounting corruption. `totalSupply` is used in NAV derivation, ERC4626 accounting, and off-chain state reconstruction. Inflated `totalSupply` means inflated `totalValue`, corrupting issuer decision-making.

### Proposed Fix

**Option A:** Decrement `totalSupply` in `submitOrder` SELL path (symmetric with refund):
```diff
  _userShares[itpId][user] -= amount;
+ _itps[itpId].totalSupply -= amount;
```

**Option B:** Don't increment `totalSupply` in refund paths (only increment `_userShares`).

---

## H-8: `completeBridge` Sends USDC to `msg.sender` — Front-Running (HIGH)

### Location
`contracts/src/custody/ArbBridgeCustody.sol:158, 173`

### Description

BLS message: `keccak256(abi.encode(chainid, this, proof, amount, nonce))` — **no recipient**. USDC transfer: `usdc.safeTransfer(msg.sender, usdcAmount)`. Anyone who observes the BLS signature can front-run and receive the USDC.

### Attack Vectors

1. **L1 force-inclusion**: When sequencer is down, transactions enter L1 mempool where MEV bots can extract the BLS signature
2. **Sequencer collusion**: Centralized Arbitrum sequencer can reorder to front-run
3. **BLS signature leakage**: P2P network observation or compromised non-threshold issuer node

The `bridgeCompleted[nonce]` flag then blocks the legitimate caller.

### Proposed Fix

```diff
 function completeBridge(
     uint256 sourceChainId,
     uint256 amount,
     uint256 nonce,
+    address recipient,
     TypesLib.ReleaseProof calldata proof,
     bytes calldata blsSignature,
     uint256 referenceNonce,
     uint256 signersBitmask
 ) external override {
-    bytes32 message = keccak256(abi.encode(block.chainid, address(this), proof, amount, nonce));
+    bytes32 message = keccak256(abi.encode(block.chainid, address(this), proof, amount, nonce, recipient));
     _verifyBLS(message, blsSignature, referenceNonce, signersBitmask);
     // ...
-    usdc.safeTransfer(msg.sender, usdcAmount);
+    usdc.safeTransfer(recipient, usdcAmount);
 }
```

---

## M-1: Silent `totalSupply`/`totalValue` Skip on Underflow (MEDIUM)

### Location
`contracts/src/core/Investment.sol:479-484`

### Description

```solidity
if (itp.totalSupply >= fill.fillAmount) {
    itp.totalSupply -= fill.fillAmount;
}
```

Silent skip instead of revert. Requires pre-existing broken state (e.g., from H-7) to trigger. Defensive but creates invisible state corruption.

### Proposed Fix

Replace with `require` or emit an event when the guard triggers to make corruption observable.

---

## M-2: `reverseLock` signerCount Not Derived From Bitmask (MEDIUM)

### Location
`contracts/src/custody/L3BridgeCustody.sol:225`

### Description

`signerCount` is a caller-provided parameter checked against `REVERSAL_THRESHOLD` (15). The actual signer count from `popcount(signersBitmask)` is only checked against the standard 2/3+1 threshold (14). No validation that `signerCount == popcount(signersBitmask)`.

Currently moot due to H-3 (all issuers must sign). If H-3 is fixed, 14 colluding issuers could bypass the 15/20 emergency threshold.

### Proposed Fix

Replace `signerCount` parameter with `_popcount(signersBitmask)`.

---

## M-3: `rebalance`/`setItpNav` Replay Risk (MEDIUM)

### Location
`contracts/src/core/Investment.sol:760-785, 814-819`

### Description

Neither function has per-call nonce consumption. `BLSVerifier._verifyBLS` is stateless — same signature passes multiple times within the 256-nonce snapshot window. While replay of identical parameters is idempotent, replaying an old `setItpNav` after a new one was set could roll back NAV to a stale value.

### Impact

Theoretical — requires attacker to possess a previously-valid BLS signature. Bounded by snapshot window. Lower priority than C-1 which has the same root cause but with unbounded impact.

### Proposed Fix

Add cycle-based or nonce-based replay protection, similar to `confirmBatch`'s `cycleProcessed[cycleNumber]`.

---

## Remediation Priority

| Priority | Finding | Effort | Breaking Change | Risk if Unpatched |
|----------|---------|--------|-----------------|-------------------|
| **1 (now)** | C-1: Bridge replay | Low | Yes (message hash) | Protocol drain via infinite mint |
| **2 (now)** | H-8: completeBridge front-run | Low | Yes (message hash) | Direct USDC theft per bridge |
| **3 (now)** | H-7: totalSupply inflation | Low | No | Permanent accounting corruption |
| **4 (now)** | H-2: Delete assert | 5 min | No | Fill batch DoS at NAV > $1 |
| **5 (now)** | H-1: Disable ITP transfers | Low | No | Fill batch DoS via griefing |
| **6 (soon)** | H-5 + H-6: Oracle fixes | Medium | Yes (message hash + inheritance) | Morpho market manipulation |
| **7 (soon)** | H-4: _disableInitializers | Trivial | No | Implementation takeover |
| **8 (planned)** | H-3: Non-signer subtraction | High | Yes (all BLS callers) | Zero fault tolerance |
| **9 (planned)** | M-1, M-2, M-3 | Low-Medium | Mixed | Secondary concerns |

Priorities 1-5 are one-line to low-effort fixes with no architectural change. Priorities 6-7 are medium effort. Priority 8 (H-3) is a major architectural change affecting ~55 call sites and the off-chain issuer nodes.
