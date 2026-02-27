# Deploy Orbit L3 on Sonic Testnet

## Context
- **Wallet**: `0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4`
- **Parent chain**: Sonic Testnet (chain ID 14601, RPC `https://rpc.testnet.soniclabs.com`)
- **L3 chain ID**: 111222333
- **Gas token**: Native S (ETH-equivalent on Sonic)
- **Node infrastructure**: VPS 2 (142.132.164.24)

## Status: FULLY OPERATIONAL

All phases complete. L3 is live, processing transactions, posting batches, and explorer is running.

## Deployed Addresses (Sonic Testnet - chain 14601)

| Contract | Address |
|----------|---------|
| RollupCreator | `0xF3043937E763Ae40E8CF1D5F20AEc0eD1490d748` |
| RollupProxy | `0xd7a2fE4c534cD0F4488a373eEB221d162083a42B` |
| Bridge | `0xE5939Ef9a7dBc0D50D4C016c4022c23423acD822` |
| Inbox | `0xb821962682614Ff395bDf5e0371ba594d5ED80Cf` |
| SequencerInbox | `0x5b128313221DC6760Dd0979c36bfD1601d4FFa1a` |
| Outbox | `0xFB47C6504e1cDAe1f305FD0a8FD27E025ce4B01c` |
| RollupEventInbox | `0xf8Cf79e668391f0AC927e6925A949E00824C5e07` |
| ChallengeManager | `0xA3B8D47f238a484202F931B03Bfe00c15875Db01` |
| AdminProxy | `0xefD41EB50906d4B4E84845AccCb5078551a4c4DD` |
| UpgradeExecutor | `0x018c085B73732B71E15d5A81505ef4Af5b0b4135` |
| ValidatorUtils | `0xC458095Cd0DbA5e06c547E937561B347Fc79d0aB` |
| ValidatorWalletCreator | `0x3087009358BFf0dA7b2B9e391AeDAc0D7E3e1d66` |
| DeployHelper | `0x420CC0E94FE7dbf6159568e0bF2527E57bd5bb41` |
| BridgeCreator | `0x71a1EEda52F22DdDdbA6D0BffaF593a362bcaEfb` |
| OneStepProofEntry | `0x70A10aAfb3EcD547FAb36C9635C97929479394b6` |

**Deployed at block**: 12127732

## L3 RPC Endpoints

| Endpoint | URL |
|----------|-----|
| HTTP RPC | `http://142.132.164.24/` |
| Block Explorer | `http://142.132.164.24/` (GET requests) |
| Private network RPC | `http://10.2.0.2:3001` |
| WebSocket (internal) | `ws://10.2.0.2:8548` |
| Sequencer Feed | `ws://10.2.0.2:9642` |

**Note**: HTTP RPC and Blockscout share the same URL. POST requests go to the sequencer, GET requests go to Blockscout.

## Node Setup (VPS 2)

- Docker image: `offchainlabs/nitro-node:v3.5.5-90ee45c`
- Config path: `~/orbit-l3-testnet/`
- Mode: Single sequencer (batch-poster + staker + sequencer)
- Exposed via existing nginx on port 80 → Docker port 3001 → nginx proxy → sequencer/blockscout
- SSH access: `ssh index-maker/prod/postgres` (via bastion, port 3189)

### Docker Containers
- `orbit-l3-testnet-sequencer-1` — Nitro node (sequencer + batch poster + staker)
- `orbit-l3-testnet-proxy-1` — nginx (routes POST→RPC, GET→Blockscout)
- `orbit-l3-testnet-postgres-1` — PostgreSQL (Blockscout DB)
- `orbit-l3-testnet-blockscout-1` — Blockscout explorer

## Verification

- Chain ID confirmed: `0x6a11e3d` (111222333)
- Test tx hash: `0x67d79603dabf969ffc57f3291090360d4949cca2c7b0f1092bd8cd55892ee0c2`
- Batch #3 posted to Sonic Testnet (messages 11-14), sequencerBatchCount=4
- Block 15+ confirmed and advancing
- Blockscout indexing: 15 blocks, 32+ transactions, 21 wallet addresses
- L3 deployer balance: 6.0 ETH
- New transactions accepted and processed (0.001 ETH test transfer confirmed)

## Funding

| Action | Amount | Remaining on Sonic |
|--------|--------|--------------------|
| Contract deployment | ~0.29 S | ~9.71 S |
| depositEth (1 S) | 1 S | ~8.71 S |
| depositEth (5 S) | 5 S | ~3.71 S |
| Batch posting fees | ~0.01 S | ~3.71 S |

## Token Bridge (Sonic Testnet ↔ L3)

Deployed via `token-bridge-contracts v1.2.5`. Deployment TX: `0x102a17e4350701de75837886494f5f927f1734348562ea0d6e320cc6ec97204a`

**WETH9 on Sonic Testnet**: `0xF6E271BE9740403fa68B5138491F61c4642F9452` (deployed for bridge)

### Parent Chain (Sonic Testnet) Contracts
| Contract | Address |
|----------|---------|
| L1TokenBridgeCreator | `0x4Ce21D353114d5895f0937f209E91c23baC2B9C8` |
| L1GatewayRouter | `0xe15c56068641AE5C69c2f7a22647b951704F3553` |
| L1ERC20Gateway | `0xafe2C8B6c3c0D338628221C9F0946fFfe380299a` |
| L1CustomGateway | `0xb8AFcF7Adbbb296f9bB971aDb514230cB8205576` |
| L1WethGateway | `0x18e5Fd4d22126a144A4763C87F9B6420FEb1DC43` |

### Child Chain (L3) Contracts
| Contract | Address |
|----------|---------|
| L2AtomicTokenBridgeFactory | `0xdca5409ec41D7f0D32433B9612260bAFB025925D` |
| L2GatewayRouter | `0x07c9dDE053210710BE5EFc01cD1CCCD9BB71E32f` |
| L2ERC20Gateway | `0x88604350ce419d5712027F5663D08Af8EE63e83e` |
| L2CustomGateway | `0x11ee25972CdEB0A7135c24c5dB90C958643B437b` |
| L2WethGateway | `0x702153Ce84a0203cdB16c6526a9fF33090246063` |
| L2WETH (aeWETH) | `0x6B0809dCBa8735d8A9f6Ecb92bF744c612Fd658E` |

## Completion Status

- [x] Deploy rollup contracts to Sonic Testnet
- [x] Run Nitro sequencer node
- [x] Fund L3 accounts (6 ETH deposited)
- [x] External HTTP RPC access
- [x] Set up Blockscout block explorer
- [x] Token bridge deployment (Sonic ↔ L3)
- [ ] WebSocket external access (host nginx needs Upgrade header support — no sudo)
