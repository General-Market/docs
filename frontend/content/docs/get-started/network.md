---
title: Network reference
navTitle: Network
description: Chain ids, RPC endpoints, explorers, and every deployed contract address.
order: 3
group: Get Started
mode: reference
---

```gmplain
This page lists the connection details for everything General Market runs on: the two test blockchains, the money tokens on each, and every deployed contract address. When any other page mentions an address, this is where it lives.
```

```gmsummary
Chains :: Index L3 (111222333) and Sonic Testnet (14601), both testnets
USDC and tokens :: L3 USDC has 18 decimals; settlement USDC has 6
Vision contracts :: The live Vision, the vault factory, and two legacy entries
Index and bridge contracts :: DTF core, registries, custody, and bridge on L3
Settlement-chain contracts :: The bridge's far side on Sonic Testnet
Lending contracts :: The Morpho stack: pool, rate model, NAV oracle, vault
Where the app reads addresses :: GET /api/deployment serves this data live, with liveness checks
```

## Chains

| | Index L3 | Settlement chain |
|---|---|---|
| Name | Index L3 (Orbit rollup) | Sonic Testnet |
| Chain id | 111222333 | 14601 |
| RPC | `https://rpc.generalmarket.io/` | `https://rpc.testnet.soniclabs.com` |
| Gas token | GM (18 decimals) | S |
| Explorer | Blockscout at `http://159.195.79.153` | `https://testnet.sonicscan.org` |

**Testnet only.** Both chains are testnets; nothing on them has real-world value.

The settlement chain id comes from deployment configuration — `deployment.json`'s `settlementChainId` (14601), fed through the `NEXT_PUBLIC_SETTLEMENT_CHAIN_ID` env var; the code fallback in `wagmi.ts` hardcodes a different id (421611337), so the configured value is the authoritative one.

Almost everything — Vision, DTF trading, lending — happens on the L3. The settlement chain carries the bridge's far side and cross-chain DTF orders; see [Two chains, one balance](/docs/index/settlement-and-bridge) (~5 min).

**The L3 explorer is served over plain HTTP on a bare IP.** Browsers may warn; the address is correct. For protocol activity in a friendlier form, the app has its own explorer at [generalmarket.io/explorer](https://generalmarket.io/explorer).

The app routes browser RPC traffic through same-origin proxies (`generalmarket.io/api/rpc` for L3, `/api/settlement-rpc` for settlement). Wallets and scripts should use the canonical URLs in the table.

## USDC and tokens

**L3 USDC has 18 decimals.** 0.1 USDC = 1e17 (100000000000000000). 1 USDC = 1e18.

Settlement USDC has **6 decimals**. The bridge converts between the two at a fixed factor of 1e12.

| Token | Chain | Address | Decimals |
|---|---|---|---|
| L3 USDC (`L3_WUSDC` / `USDC`) | L3 | `0xaddB799BC1499b224DC4368e92b9042a54908553` | 18 |
| Settlement USDC | Settlement | `0x7124c493571397383CE2102441Ca740309E3438D` | 6 |
| Mock USDT | L3 | `0x1fcda75431dad318b3b6336458ec7e9235fce103` | — (mock, testnet stand-in) |

## Vision contracts

All on the L3.

| Contract | Address | Status |
|---|---|---|
| Vision | `0x36a28967544c301a3c66dcfb6c6c90e548412693` | **Live** — the contract the app calls |
| VisionVaultFactory | `0x73dbd15d872b80e7a9e90be3cacedf4ad00407ca` | Live |
| VisionVault (implementation) | `0x761add2bec841a8cf623ee2437cd8cd45ec0a1b9` | Live — clone target for managed vaults, read from `VisionVaultFactory.implementation()` |
| VisionReconciler | `0xfee75222Bb00337135341ce543D5612B31FE20c6` | Live |
| Vision_v3 | `0x8d3cb936504d25772fb62bd537e67eb48e2d4d62` | **Idle** — deployed but inactive; not the live target |
| Vision_legacy | `0x36a28967544c301a3c66dcfb6c6c90e548412693` | Alias — same address as the live Vision |

The live Vision is a plain (non-upgradeable) contract, verified directly on-chain: bytecode present and the 4-parameter `joinBatchDirect` selector (`0xa092fd46`) in place. Its full function surface is documented in the [Contract reference](/docs/developers/contracts) (~6 min).

```gmwarning
Two stale addresses to ignore. Older copies of the reference bot and some README files carry a Vision address with no bytecode on this chain. And the deployment data's own `VisionVault` entry (`0x7437F064E416C93aC4EaB882e9A488443FaE03c0`) is also empty on-chain — the live clone target in the table above was read from `VisionVaultFactory.implementation()`. Trust this page first, then GET /api/deployment.
```

## Index and bridge contracts

All on the L3.

| Contract | Address | Notes |
|---|---|---|
| Index | `0x3eb3bbbad5aa815d408fc06fb44ff2011b99c4ba` | DTF core (Investment.sol) — orders, fills, NAV, ITP registry |
| Governance | `0xcc448bb20cf2910d2e1df3fb8b9b3e85f9f74767` | |
| OracleRegistry | `0xd4c6b4a1A3579150993EdD6B5f46aA45d395480b` | Oracle set + BLS keys |
| CollateralRegistry | `0xc712b4fa587eecc952289dd2c05590228f1a00c0` | |
| BLSCustody | `0x3df0918dd838f8bfebae6ab06f1fa9a9efbb6584` | |
| L3BridgeCustody | `0x07a069fb142f5faacbeb3aba498abd3e9abc772e` | Locks L3 USDC outbound |
| L3BridgeProxy | `0x9395cDfbb0ff99d2400471c4515B1893e6699CFB` | |
| BridgeProxy | `0xe6c45ab51c1b2f35d3a460105fefa5a1ea7ab57c` | |
| BridgedItpFactory | `0xa9b67569f256a8825bfa4da1b359f2d8d7618696` | |
| MockBitgetVault | `0xbf30b85611e47d1cb82ba90eb17c933f54b59768` | **Mock** — testnet stand-in |

## Settlement-chain contracts

All on Sonic Testnet (14601).

| Contract | Address |
|---|---|
| SettlementBridgeCustody | `0x9632509C878Fccb37Ec314d5FaC57bbA951F93b2` |
| SettlementBridgeProxy | `0x19d9F7A778A30f8a73158Be5028C19571D9102d5` |
| SettlementOracleRegistry | `0x4AD1A55078075ae4551eb2105b1f3dB9729c2f6a` |
| SettlementBridgedItpFactory | `0xC7f7A091201e613d24A185166846fB2f3cfbC410` |

## Lending contracts

The Morpho lending stack, all on the L3. How lending works: [Earn yield or borrow](/docs/index/lending) (~4 min).

| Contract | Address | Notes |
|---|---|---|
| Morpho | `0x24c9B172B5BaC939Aa87dBadc478A2c9445BB48F` | Morpho Blue pool |
| CuratorRateIRM | `0x821f79f9E45C24D7662B5F4b869E7B60923E05DE` | Curator-set interest rates |
| ITPNAVOracle | `0x9Ee254aA64742170bCb0f6da57d8C4F782339FeC` | NAV price feed for Morpho |
| MetaMorpho vault | `0xC86aEa4488D1b0eA202585CfbF15542e9d342933` | Supply-side vault |
| Collateral token | `0xa9ac1076632589fA785dBa265f182025b4b6BDb1` | An ITP share token (LLTV 77%) |
| Market id | `0x21cabe92c3f8c1911a9bf7bb6a4db8b694d2ccc2c920db2de2d4cbe6e5a5a029` | Morpho market identifier (not an address) |

## Where the app reads addresses

`GET https://generalmarket.io/api/deployment` returns the same deployment data the app itself uses, plus a `_liveness` check on the core entries — Vision, USDC, and Index — reporting the bytecode length found at each address, and the `_rpc` it was checked against. If this page and that endpoint disagree on a liveness-checked entry, the endpoint wins — it reflects the running deployment. The one known stale row in that data, `VisionVault`, is flagged above.

The deployment data also lists every managed-vault clone address — hundreds of them, five per data source. Fetch the endpoint rather than copying them from anywhere; the list grows as vaults deploy.

```gmseealso
[{"title": "Glossary", "href": "/docs/get-started/glossary"}, {"title": "Contract reference", "href": "/docs/developers/contracts"}, {"title": "Two chains, one balance", "href": "/docs/index/settlement-and-bridge"}]
```

Next: [Glossary](/docs/get-started/glossary) (~3 min)
