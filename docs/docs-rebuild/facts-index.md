# Index fact sheet — verified against code, with citations

Every claim below was read from primary sources. Writers re-verify before citing; verifiers re-verify after. Where this file and the code disagree, the code wins — fix this file.

## Naming

- **Code/contracts:** "ITP = Index Token Product" (`contracts/src/core/ITP.sol:10`; `Investment.sol:23` "submitting limit orders and managing Index Token Products"). The central contract is `Investment.sol`; interfaces `IInvestment` (primary) and `IIndex` (parallel/legacy — OPEN below).
- **UI/user-facing:** "Dex Traded Fund (DTF)" (`frontend/messages/en/create-itp.json:8` "Create a Dex Traded Fund (DTF) with custom weights"; legal copy `messages/en/pages.json:418–431` "on-chain Dex Traded Funds (DTFs)… tokenized baskets… priced by Net Asset Value (NAV)"). Nav label "Create Index" (`pages.json:8`). "Dynamic Token Folio" appears nowhere.
- **Docs ruling:** call it **DTF** to users; define **ITP (Index Token Product)** once as the contract-level term (mirror of Vision's block/batch split). API params use `itpId`/`itp_id` everywhere.

## Core contract: Investment.sol (`contracts/src/core/Investment.sol`, storage in `InvestmentStorage.sol`)

- **What defines an ITP:** `ITPCore { name, symbol (bytes32), creator, createdAt, feeRate (bps), status (INACTIVE/ACTIVE/PAUSED/DELISTING), totalSupply, totalValue, assetCount }` (`contracts/src/libraries/TypesLib.sol:97–118`) plus parallel arrays `_itpAssets`, `_itpWeights` (18-dec, sum 1e18), `_itpInventory` (`InvestmentStorage.sol:40–46`), BLS-pushed `_itpNavs[itpId]` (line 134), and optional `itpVaults[itpId]` ERC20 share token (line 66).
- **Creation is permissionless:** `createITP(name, symbol, weights[], assets[], prices[], bridgeNonce)` (Investment.sol:708–710) — any EOA. Constraints: 1–1000 assets (`MAX_ASSETS = 1000`, line 50), each weight ≥ 0.25% (`MIN_WEIGHT = 25e14`, line 44), weights sum exactly 1e18 (line 41), no zero/duplicate assets (767–777), name ≤ 32 bytes / symbol packs to bytes32 (731–734). itpId is a sequential counter (784–788). Initial NAV set to 1e18 = $1 (line 831); inventory `qty[i] = weight[i]*1e18/price[i]` (820). **No creation fee** — only `feeRegistry.registerITPDeployer(itpId, creator)` (834–836). `bridgeNonce = type(uint256).max` for direct creation; other values are idempotency keys for bridge-originated creation (721–727).
- **Constants:** `MIN_ORDER_AMOUNT = 1e15` (0.001 USDC, line 32); `MAX_DEADLINE_DURATION = 24 hours` (35); `MIN_SHARES = 1e12` (47); `EXPIRY_GRACE_PERIOD = 24 hours` (55); `BATCHED_TIMEOUT = 300s` (InvestmentStorage.sol:161). Share tokens are 18 decimals (`ITPVault.sol:45`).
- **Share custody:** user shares tracked internally (`getUserShares`); when a vault is set, fills also mint/burn the ITPVault ERC20 (Investment.sol:525–531, 550–556; mint/burn restricted to Investment, `ITPVault.sol:37–43`). `ITP.sol` is an ERC4626-view wrapper — `convertToShares/convertToAssets` from NAV (ITP.sol:72–94) with direct deposit/withdraw/mint/redeem **blocked** (140–160); all entry/exit goes through orders.
- **Testnet-only:** `seedMint(itpId, to, shares)` admin function bypasses the order pipeline (Investment.sol:1212–1235).

## Order lifecycle (submit → batch → fill → settle)

- **Submit:** `submitOrder(itpId, side, amount, limitPrice, slippageTier, deadline) → orderId` (Investment.sol:179–188). BUY: `amount` = 18-dec USDC, transferred wallet→contract on submit (306–308). SELL: `amount` = shares, escrowed (311–312). Checks: amount ≥ 1e15, slippageTier ≤ 2, deadline in (now, now+24h], queue not full, ITP active (224–280). Status → PENDING. `submitOrderFor(beneficiary, …)` is oracle-only (191–209, E097).
- **Batch (BLS):** `confirmBatch(cycleNumber, orderIds[], blsSignature, referenceNonce, signersBitmask)` (330) — message `keccak256(abi.encode(chainid, this, cycleNumber, orderIds))` (337–341); each PENDING order → BATCHED, `batchedTimestamp` stamped, per-cycle replay guard `cycleProcessed` (332–333). One batch signature covers all orders in the cycle.
- **Fill (BLS):** `confirmFills(cycleNumber, fills[], …)` (430), message over `(chainid, this, cycleNumber, fills)`. `Fill { orderId, fillPrice, fillAmount, cycleNumber, txHash }` (TypesLib.sol:126–132). BUY mints `shares = fillAmount*1e18/fillPrice` (509), min 1e12; SELL returns `usdc = fillAmount*fillPrice/1e18` (540). Direct USDC transfer to wallet, with `failedFillEscrow` fallback + `claimFailedFill(orderId)` if the transfer fails (571–608).
- **Limit prices are real:** 18-dec USD per share; BUY reverts if `fillPrice > limitPrice`, SELL if `fillPrice < limitPrice` (E126, Investment.sol:470–475; proven `contracts/test/LimitPriceFill.t.sol:169–309`). `limitPrice = 0` disables the check (market order).
- **Partial fills are real:** `fillAmount < order.amount` allowed; order still ends FILLED; BUY refunds unfilled USDC, SELL restores unfilled shares (Investment.sol:534–537, 562–565; proven `IndexBatchFillConfirmation.t.sol:388–419, 656–662`). No resting remainder — one shot per order.
- **Cancellation:** `cancelOrder(orderId)` — owner only, PENDING only, full refund, no BLS (Investment.sol:616–650).
- **Expiry, three paths:** oracle `refundExpiredOrder` after deadline (653–703); oracle `refundTimedOutBatchedOrder` for BATCHED orders stuck > 300s (1107–1150); **permissionless** `claimExpiredOrder(orderId)` 24h after deadline — nobody can strand your money (1160–1208). Oracle can also sweep zombies: `cancelStalePendingOrders` (1058–1098).
- **Off-chain execution:** the oracle nets orders before filling — pair netting, slippage-tier filter (tier 0 ≤ 0.3%, 1 ≤ 1%, 2 ≤ 3%), bridge netting, fee allocation (`oracle/src/netting/mod.rs:5–13, 169–214`); routed to venues via `oracle/src/execution/mod.rs:8–14` (same-chain swaps / cross-chain intents). Slippage tier is stored on-chain but enforced off-chain.

## Pricing / NAV

- **NAV is computed off-chain by the oracle network and pushed on-chain:** `setItpNav(itpId, nav, blsSig, …)` (Investment.sol:924–929), message `keccak256(chainid, this, "setItpNav", itpId, nav)`. `getNAV(itpId)` returns the stored value (957–959). No on-chain NAV formula.
- **Frontend NAV:** SSE stream `nav_per_share` first, REST fallback `GET /api/itp-price?itp_id=` after 3s (`frontend/hooks/useItpNav.ts:30–99`); route falls back to on-chain `getITPState` if data-node is down (`app/api/itp-price/route.ts:44–87`). History: `GET /api/dn/nav-series?itp_id&from&to&interval` → OHLC (`useItpNavSeries.ts:67–73`).
- **Morpho's price feed** is a separate contract: `ITPNAVOracle` — permissionless submit with valid BLS sig, 36-dec Morpho scale, ≤ 10% deviation per cycle, strictly increasing cycle numbers (`contracts/src/oracle/`-side impl; ITPNAVOracle.sol:12–24, 93–104). **MAX_STALENESS = 365 days — staleness check effectively disabled** (ITPNAVOracle.sol:28, 131–133).
- **Asset prices** come from the data-node (Bitget primary, CoinGecko backfill, DEX fallback — `data-node/src/collector.rs:43–95`); oracle validates cross-source tolerance (stables 0.5%, BTC/ETH 2%, default 2% — `oracle/src/price/mod.rs:58–65`).

## Create a DTF (frontend)

- `components/domain/CreateItpSection.tsx` calls `Investment.createITP` on L3 directly (lines 418–424) with `weights = pct * 1e16`, prices fetched from the data-node (330–362), sentinel bridgeNonce. Simulates before prompting the wallet (397–416); decodes itpId from the `ITPCreated` log (479–485); waits for oracle SSE consensus (514–523).
- **UI constraints tighter than the contract:** max **100** assets (line 186; contract allows 1000), min weight **1%** (line 410; contract floor 0.25%), name ≤ 32 chars / symbol ≤ 10 upper-case (828, 836), weights must sum to exactly 100% with no zero weight (178), all assets must have live prices (270–294). No fee shown or charged at creation.

## Rebalancing

- **Two-step:** anyone may emit `requestRebalance(itpId, removeIndices[], addAssets[], newWeights[], note)` — event-only, no state change (Investment.sol:851–859); oracles verify and execute `rebalance(…, prices[], quoteTokens[], blsSig, …)` under BLS (870–895, RebalanceLib). Constraints mirror creation (errors E109–E115 `libraries/ErrorsLib.sol:446–474`: descending removeIndices, length matches, no zero prices, no duplicates, ≥ 1 asset).
- **Frontend path is via the settlement chain:** `useRebalance.ts` calls `requestRebalance` on `INDEX_PROTOCOL.settlementBridgeProxy` with `BRIDGE_PROXY_ABI`, switching the wallet to the settlement chain first (`hooks/useRebalance.ts:73, 85–95`). Success = tx mined (event-only).
- **OPEN:** on-chain `requestRebalance` is permissionless; the UI exposes it from a creator-context modal but no contract gate restricts it to the creator. State this honestly. NAV-preservation math lives in RebalanceLib — not re-verified line-by-line here (OPEN for the writer citing exact behavior).

## Lending (Morpho)

- **Real Morpho Blue on the L3** (chainId 111222333): Morpho `0x24c9B172…`, CuratorRateIRM `0x821f79f9…`, ITPNAVOracle `0x9Ee254aA…`, MetaMorpho vault `0xC86aEa44…`, marketId `0x21cabe92…` (`frontend/lib/contracts/morpho-deployment.json:2–11`). Market: loanToken = L3 USDC 18-dec (`0xaddB799B…` = `L3_WUSDC`, `deployment.json:16–17`), collateralToken = an ITP share token (`morpho-deployment.json:15`), **LLTV 77%** (`lltv: 770000000000000000`, line 18).
- **Rates are curator-set, not a curve:** `CuratorRateIRM.setRate(marketId, perSecondRate)` curator-only (`contracts/src/irm/CuratorRateIRM.sol:109–115`); bounds MIN ≈ 0.5% APR (158548960/s, line 28), MAX ≈ 200% APR (line 32); **punitive 100% APR if the rate is unset or stale > 48h** (lines 21, 24, 96–98; proven `CuratorRateIRM.t.sol:287–318`).
- **User flows (all live in frontend):** supplyCollateral / borrow / repay / repayAll (shares, dust-free) / withdrawCollateral via `hooks/useMorphoActions.ts:78–194`; borrow quotes from the curator API (`useLendingQuote.ts:55–94` → terms: borrowRate, healthFactor, liquidationPrice, maxBorrow); `POST /api/lending/prepare` proxies `{marketId, borrowAmount}` to the curator to pre-position vault liquidity, 95s timeout (`app/api/lending/prepare/route.ts:12–46` → `{alreadyFunded, txHash, blockNumber}`).
- **Liquidation is permissionless** — anyone may call `morpho.liquidate` on an unhealthy position; trigger = ITPNAVOracle price vs LLTV (proven `contracts/test/MorphoPermissionlessLiquidation.t.sol:229–248, 314–357`).
- **APY display:** SSE `borrow_rate_per_second` → `APY = rate × 365.25×86400 × 100`; supply APY = borrow APY × utilization (`hooks/useAllMorphoMarkets.ts:79–83`).
- **OPEN:** `contracts/script/DeployMorphoMarket.s.sol` comments assume a 6-dec loan token ("100 USDC = 100e24", vault seed `100_000 * 1e6`, lines 26–28, 153) while the deployed loanToken is the 18-dec L3 USDC and the frontend prices at 36-dec scale (`useLendingData.ts:120, 135`). Script comments are stale — frontend wiring is ground truth. Also OPEN: which ITP the collateral token `0xa9ac1076…` belongs to (only named in morpho-deployment.json).

## Two-chain settlement & bridge

- **L3** (Orbit, 111222333, USDC **18 dec** — `L3BridgeCustody.sol:87–91`, `deployment.json:17`) ↔ **settlement chain** (id **14601**, "Sonic Testnet" default, env-overridable — `deployment.json:42`, `frontend/lib/wagmi.ts:45–46`; USDC **6 dec**, `0x7124c493…`, `deployment.json:18–19`).
- **Conversion factor 1e12:** `DecimalLib.toInternal` (×1e12) / `toUsdc` (÷1e12, truncates ≤ $0.000001 dust; round-trip from 6-dec is lossless) — `contracts/src/libraries/DecimalLib.sol:22–65`.
- **L3BridgeCustody** locks 18-dec USDC outbound under BLS (`initiateBridge`, message `keccak256(chainid, this, destChainId, amount, nonce)`, L3BridgeCustody.sol:100–156); sequential nonce (54, 143); `reverseLock` needs the emergency 15/20 threshold (lines 31–34, 248–249). **SettlementBridgeCustody** releases 6-dec USDC on `completeBridge` with per-source-chain nonce replay guard (SettlementBridgeCustody.sol:185–240, 77).
- **Cross-chain DTF trading from the settlement chain:** `buyITPFromSettlement(itpId, usdcAmount6dec, limitPrice, slippageTier, deadline)` escrows USDC, oracles execute on L3, user receives **BridgedITP** (18-dec mirror token, CREATE2 by BridgedItpFactory, mint/burn only by BridgeProxy — `SettlementBridgeCustody.sol:254–311`; `bridge/BridgedItpFactory.sol:32–34`; `bridge/BridgedITP.sol:31–41`). `sellITPFromSettlement` is the reverse (517–579). Mappings `orbitToSettlement`/`settlementToOrbit` (`bridge/BridgeProxy.sol:46–49`).
- **What users see:** primary trading is direct on L3 (Buy/Sell modals); the settlement path also carries `requestRebalance` (frontend) and cross-chain orders. Bridge completion is oracle-orchestrated — users never call `completeBridge`.

## API (frontend `app/api/*` — Index-relevant)

Base `https://generalmarket.io/api`. No auth observed in route code.

| Endpoint | Method | Notes |
|---|---|---|
| `/itp-price?itp_id=` | GET | `{nav (18-dec string), nav_display, assets_priced, assets_total, source}`; on-chain `getITPState` fallback (`itp-price/route.ts:22–87`) |
| `/itp-enrichment?itp_id=` | GET | `{holdings[]}` for a 0x-prefixed 64-hex itpId (`itp-enrichment/route.ts:7–29`) |
| `/dn/portfolio?user=` (+`/history?days=`, `/trades`) | GET | data-node proxy → `{positions[], total_value, total_pnl…}`, history points, trades (`hooks/usePortfolio.ts:57–112`) |
| `/dn/nav-series?itp_id&from&to&interval` | GET | OHLC NAV series (`useItpNavSeries.ts:67`) |
| `/dn/itp-orderbook?itp_id&levels&aggregation_bps` | GET | bids/asks/mid_price/spread_bps, polled 500ms (`useItpOrderbook.ts:6–31`) |
| `/dn/sim/run-stream`, `/dn/sim/sweep-stream` | GET (SSE) | real backtester: category, top_n, weighting, rebalance_days, fees, regime overlays → progress + `{stats, nav_series}` (`useSimulation.ts:79–178`, `useSimSweep.ts:57–174`) |
| `/dn/sim/categories`, `/dn/sim/holdings?run_id&date` | GET | sim inputs/outputs (`useSimCategories.ts:23–77`, `useSimHoldings.ts:21–64`) |
| `/lending/prepare` | POST | `{marketId, borrowAmount}` → curator reallocation `{alreadyFunded, txHash, blockNumber}` (`lending/prepare/route.ts:12–46`) |
| `/explorer/dtf?endpoint=&range=` | GET | endpoint ∈ fills\|order-lifecycle\|tvl\|orders-per-hour; range 1h–30d (`explorer/dtf/route.ts:9–55`) |
| `/account/{address}/pnl-history?range=` | GET | `{range, bucket_secs, points[], last_updated}` (`pnl-history/route.ts:5–29`) |
| `/market/history`, `/market/batch-history` (≤16 assets), `/market/history-bulk` | GET | asset price history proxies (`market/*/route.ts`) |
| `/rpc`, `/settlement-rpc` | POST | caching JSON-RPC proxies to L3 / settlement chain (`rpc/route.ts:104–220`) |
| `/config?type=`, `/deployment` | GET | itp-id-names / blacklists / display config; deployment JSON + liveness (`config/route.ts:25–50`, `deployment/route.ts:77–139`) |
| `/backend/[...path]`, `/dn/[...path]`, `/oracle/[...path]` | GET/POST | raw proxies to backend (:3001), data-node, oracle (:9001) (`backend/[...path]/route.ts:4–8`, `dn/[...path]/route.ts:5`) |

## Fees & invariants

- **No fee charged in the on-chain fill path.** Investment.sol deducts nothing on submit/fill/cancel/refund; FeeRegistry only registers the deployer at creation (Investment.sol:834–836). Fee *accounting* lives in FeeRegistry — types TRADING/MANAGEMENT/BRIDGE/GAS, per-ITP rate cap 10% (1000 bps), default deployer share 70%, BLS-set (`registry/FeeRegistry.sol:81–99, 187–204, 267–311`); frontend reads accumulated fees per ITP (`hooks/useItpFees.ts:8–28`). The oracle's netting pipeline has a "fee allocation" stage (`oracle/src/netting/mod.rs:13`). **OPEN: the exact trading fee a DTF trader pays today is not provable from the contracts alone — verify against the oracle fee stage before printing a number.**
- **Invariants for every page:** **Testnet only.** **L3 USDC = 18 decimals** (orders, NAV, lending all 18-dec on L3); **settlement USDC = 6 decimals**, factor 1e12. Min order 0.001 USDC; order deadline ≤ 24h; limit price 0 = market order; partial fills refund the remainder immediately; `claimExpiredOrder` makes refunds permissionless after deadline + 24h; ITP creation permissionless, weights sum to 100%, floor 0.25% (UI: 1%, ≤ 100 assets); all batch/fill/NAV/rebalance/bridge mutations are oracle-BLS-signed (`contracts/test/BLSEnforcement.t.sol`); BLS thresholds 11/20 standard, 15/20 emergency (`L3BridgeCustody.sol:31–34`).

## OPEN flags (do not guess — resolve or state honestly)

1. **Trading fee number** — none on-chain; oracle netting "fee allocation" unquantified here.
2. **IIndex.sol vs IInvestment.sol** — duplicate interfaces; IInvestment is the one Investment.sol implements. Treat IIndex as legacy until contradicted.
3. **Morpho deploy-script decimal comments stale** (6-dec assumptions vs 18-dec deployed loan token).
4. **Morpho collateral ITP identity** (`0xa9ac1076…`) unnamed outside morpho-deployment.json; `batch-markets.json` exists with more markets — verify which are live before documenting multiple markets.
5. **ITPNAVOracle staleness effectively off** (365-day MAX_STALENESS).
6. **Rebalance authorization** — permissionless on-chain, creator-framed in UI.
7. **RebalanceLib NAV-preservation math** not line-verified.
8. **Settlement chain identity** — "Sonic Testnet" id 14601 is env-overridable; confirm the live value before printing.
9. **`seedMint`** exists (admin, testnet seeding) — mention only if explaining genesis liquidity.
10. **Slippage tiers** — stored on-chain, enforced off-chain in oracle netting (0.3%/1%/3%); don't describe as a contract guarantee.
