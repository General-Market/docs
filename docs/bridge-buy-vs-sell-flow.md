# Bridge Buy vs Bridge Sell — Full Execution Flow

**Test timing**: Buy = 1.5min | Sell = 7.0s

---

## Test 08: Arb Bridge Buy (1.5 min)

```
STEP   FUNCTION                        CHAIN   WHAT IT DOES
─────────────────────────────────────────────────────────────────────────────
 0     startArbBlockMiner(1000)        ARB     setInterval: mine 1 block/sec

 1     getL3UserShares(user, itpId)    L3      eth_call → Index.getUserShares()
       erc20BalanceOf(BRIDGED_ITP)     ARB     eth_call → BridgedITP.balanceOf()
       ↳ Records sharesBefore, bridgedItpBefore

 2     getItpStateL3(itpId)            L3      eth_call → Index.getITPState()
       ↳ Reads NAV → sets limitPrice = NAV * 2

 3     placeBuyOrderDirect(...)        ARB     ← THIS IS THE ORDER PLACEMENT
       │
       ├─ anvil_setBalance(user)       ARB     Fund user with 100 ETH
       ├─ mint USDC to user            ARB     deployer calls USDC.mint(user, 100e6)
       ├─ anvil_impersonateAccount     ARB     Impersonate user
       ├─ USDC.approve(ArbCustody)     ARB     eth_sendTransaction
       ├─ read crossChainOrderId       ARB     eth_call → next order ID
       ├─ read block.timestamp         ARB     For deadline = now + 3600
       └─ buyITPFromArbitrum(          ARB     eth_sendTransaction → ArbBridgeCustody
            itpId, 100e6, limitPrice,
            slippage=1, deadline
          )
       ↳ Emits CrossChainOrderCreated event on ARB

═══════════════════════════════════════════════════════════════════════════════
  ⏳ WAITING FOR ORACLE RELAY (this is the 1.5 min)
═══════════════════════════════════════════════════════════════════════════════
  Oracles must:
    a) Detect CrossChainOrderCreated on Arb (polling Arb chain)
    b) Submit order to L3 Index (BLS consensus, submit tx)
    c) Batch the order on L3 (BLS consensus, batch tx)
    d) Fill the order on L3 (BLS consensus, fill tx)
       → mints L3 shares to user
    e) Mint BridgedITP on Arb (BLS consensus, bridge tx)
       → calls BridgeProxy → BridgedITP.mint()
═══════════════════════════════════════════════════════════════════════════════

 4     pollUntil(                      L3      Poll every 3s, timeout 240s
         getL3UserShares(user),
         shares > sharesBefore
       )
       ↳ Waits for L3 shares to INCREASE (proves oracle filled on L3)

 5     pollUntil(                      ARB     Poll every 3s, timeout 60s
         erc20BalanceOf(BRIDGED_ITP),
         balance > bridgedItpBefore
       )
       ↳ Waits for BridgedITP to be MINTED on Arb (proves bridge relay)

 6     stopMiner()                     ARB     clearInterval
```

**Total steps requiring oracle consensus**: 4 (submit + batch + fill + bridge mint)
**Each consensus round**: ~1s cycle time + BLS aggregation + tx confirmation
**Why 1.5 min**: Real cross-chain flow. All 4 BLS consensus rounds must complete.

---

## Test 09: Arb Bridge Sell (7.0 sec)

```
STEP   FUNCTION                        CHAIN   WHAT IT DOES
─────────────────────────────────────────────────────────────────────────────
 0     startArbBlockMiner(1000)        ARB     setInterval: mine 1 block/sec

 1     mintBridgedItp(user, 10e18)     ARB     ← PRE-MINT (no oracle needed!)
       │
       ├─ anvil_setBalance(BridgeProxy) ARB    Fund proxy with 100 ETH
       ├─ anvil_impersonateAccount      ARB    Impersonate BridgeProxy
       └─ BridgedITP.mint(user, 10e18)  ARB    Direct mint, bypass BLS
       ↳ User now has 10 BridgedITP on Arb

 2     mintL3Shares(user, 10e18)       L3      ← PRE-MINT (no oracle needed!)
       │
       ├─ anvil_setStorageAt            L3     Set _userShares[itpId][user] = 10e18
       ├─ anvil_setStorageAt            L3     Increase _itps[itpId].totalSupply
       ├─ anvil_impersonateAccount      L3     Impersonate L3 Index contract
       └─ ITPVault.mint(user, 10e18)    L3     Mint vault ERC20 tokens
       ↳ User now has 10 L3 shares (for fill to burn)

 3     erc20BalanceOf(ARB_USDC)        ARB     Record usdcBefore
       erc20BalanceOf(BRIDGED_ITP)     ARB     Record bridgedItpBefore
       getL3UserShares(user)           L3      Record l3SharesBefore

 4     placeSellOrderDirect(...)       ARB     ← THIS IS THE ORDER PLACEMENT
       │
       ├─ anvil_setBalance(user)       ARB     Fund user with 100 ETH
       ├─ anvil_impersonateAccount     ARB     Impersonate user
       ├─ BridgedITP.approve(Custody)  ARB     eth_sendTransaction
       ├─ verify approve receipt       ARB     eth_getTransactionReceipt (5 retries)
       ├─ read crossChainOrderId       ARB     eth_call → next order ID
       ├─ read block.timestamp         ARB     For deadline = now + 3600
       ├─ re-impersonate user          ARB     Safety re-impersonate
       ├─ sellITPFromArbitrum(         ARB     eth_sendTransaction → ArbBridgeCustody
       │    itpId, 10e18, limitPrice=0,
       │    slippage=1, deadline
       │  )
       └─ verify sell receipt          ARB     eth_getTransactionReceipt (5 retries)
       ↳ Emits CrossChainSellOrderCreated event on ARB

═══════════════════════════════════════════════════════════════════════════════
  ⏳ WAITING FOR ORACLE RELAY (should take ~1-2 min like buy)
═══════════════════════════════════════════════════════════════════════════════
  Oracles must:
    a) Detect CrossChainSellOrderCreated on Arb
    b) Submit sell order to L3 Index (BLS consensus)
    c) Batch the order on L3 (BLS consensus)
    d) Fill the order on L3 — burns shares, releases USDC (BLS consensus)
    e) Send USDC to user on Arb (BLS consensus, bridge tx)
═══════════════════════════════════════════════════════════════════════════════

 5     pollUntil(                      ARB     Poll every 3s, timeout 240s
         erc20BalanceOf(ARB_USDC),
         balance > usdcBefore
       )
       ↳ Waits for Arb USDC to INCREASE (proves full sell flow completed)

 6     erc20BalanceOf(BRIDGED_ITP)     ARB     Log bridgedItpAfter (informational)
       getL3UserShares(user)           L3      Log l3SharesAfter (informational)

 7     stopMiner()                     ARB     clearInterval
```

---

## Side-by-Side Comparison

```
                    BRIDGE BUY (1.5 min)          BRIDGE SELL (7.0 sec)
                    ────────────────────          ─────────────────────
Pre-setup:          None                          mintBridgedItp (Arb)
                                                  mintL3Shares (L3)

Order placement:    placeBuyOrderDirect            placeSellOrderDirect
                    (mints USDC, approves,         (approves BridgedITP,
                     calls buyITPFromArbitrum)       calls sellITPFromArbitrum)

Oracle relay:       4 consensus rounds             4 consensus rounds
                    submit → batch → fill →        submit → batch → fill →
                    bridge mint BridgedITP          bridge send USDC

Verification:       pollUntil L3 shares ↑          pollUntil Arb USDC ↑
                    pollUntil BridgedITP ↑          (log BridgedITP, L3 shares)

EXPECTED TIME:      ~1-2 min                       ~1-2 min
ACTUAL TIME:        1.5 min ✅                      7.0 sec ⚠️
```

---

## Diagnosis

**7.0s is TOO FAST for a real bridge sell flow.** The oracle relay alone (4 BLS consensus rounds) takes ~1-2 min minimum.

### Possible explanations:

1. **Previous test's buy already filled something** — The buy test (08) runs before sell test (09). If the buy test left residual USDC in the user's Arb balance (from a previous run or test ordering), the `pollUntil(usdcBalance > usdcBefore)` check could pass IMMEDIATELY because `usdcBefore` was measured AFTER the buy test deposited USDC into custody but before oracles returned change.

2. **Sell order never actually relayed** — The test passes because the USDC balance check was already satisfied from the buy test's bridge relay (which sends USDC back as change if the buy amount exceeds what was needed). The sell test would "pass" without the oracles doing anything.

3. **Pre-existing USDC from test 08** — Test 08 places a buy for 100 USDC. If NAV is ~$1 and the buy mints shares, there could be leftover USDC returned via the bridge. Test 09 records `usdcBefore` and then places a sell — but if oracles are still processing test 08's bridge return, the USDC balance increases from test 08, not test 09.

### The smoking gun:
Test 09 takes 7s = time for steps 1-4 (pre-mint + place order) with zero wait in step 5's poll. The `pollUntil` returned on its FIRST check, meaning `usdcAfter > usdcBefore` was already true before the sell order was even relayed.
