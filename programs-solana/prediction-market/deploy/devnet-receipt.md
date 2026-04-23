# Devnet Deploy Receipt

Something landed on devnet. It works. For now. All working things are temporary.

## Timestamp

`2026-04-17` (UTC, approximate — Solana doesn't care what hour you thought it was).

## Program

| Item | Value |
| --- | --- |
| Program ID | `DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA` |
| Cluster | `devnet` (`https://api.devnet.solana.com`) |
| Deploy signature | `2HQyiLmUSGT86tQEegNYsbu4jZu3c1A8otLtABZeETcLAGLuwEo3pnpk8deZYXsTBKtKXrShurpXMMAMXD3vTL8X` |
| Binary | `target/deploy/prediction_market.so` |
| Anchor | `1.0.0` |
| `declare_id!` vs keypair | matched on first build — no rewrite, no second deploy |

## Keypairs

| Role | Pubkey | Path |
| --- | --- | --- |
| Admin | `FdmxwdK1nSGqp4r14YZyGjyxs6HgZ3opEdnLZBUQViQK` | `~/.config/solana/id.json` |
| Oracle daemon | `FRGz1weU6eWnqX1nnfd8ZtsixcdVgpmE3PiiQnVdcGLH` | `oracle-daemon/oracle.json` |
| Program upgrade | `DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA` | `programs-solana/prediction-market/target/deploy/prediction_market-keypair.json` |

## Stake Mint

Fresh SPL mint standing in for USDC. Devnet isn't picky.

| Item | Value |
| --- | --- |
| Mint | `5BNaj6SeidyLp9PKRFTEKCTGsww9SQmsTp7yEqgHiEkT` |
| Decimals | `6` |
| Mint-creation tx | `3rrw2oWaTz4be1v4cDnG6GSswVYPz3euQ4MSH7j4NKxj7fW372GmzcJed8cts9Sgj6Zybp5YBRFtCt9xjjNJvJWN` |

## PDAs

| PDA | Address |
| --- | --- |
| `config` | `B7VkNuRB9cfrN7UzstgcfJ5p9CorKfCrLtmjwipygAVV` |
| `fee_vault` | `3BZaV8EzPSUBjWenrCmxVJuS2hQKxYTk5B4bowEdUv7s` |
| `oracle_config` | `6zAV6WVjCtteFontwdqU4k1NrJnMkaJPATg34mq453Lt` |
| `source` id=1 (BTC/USD) | `EarX1BfphjYgjAKrhGxfE5Maxd347gscYPCddz7avoD1` |
| `source` id=2 (ETH/USD) | `A4pb4ToWVXmjZFqPSdqMsyjeepH1dLujXVeM2nS8QyWj` |
| `source` id=3 (SOL/USD) | `71iQEg1SkMdV1bK2y5y569JReP2TtCz9wteVxZyUYLXT` |

## Bootstrap Transactions

| Call | Signature |
| --- | --- |
| `initialize_config(50)` | `4SGxQTbwxbUjGwXGj2B6GX4tcixo5s7muE3y2cHNu8x2E7bv3NdNyizoUZbCYQyXNjSkmN4pzKQG58ub9LJt3cQA` |
| `upsert_source(1, BTC/USD)` | `73H5GpFTxHyZz7Gkkq9syL138tscpzZQEDdFrfQTouTuGPcaq6X14R2Ub5GzHDB5EvsMRpDqMGRw8qhWnZUjmDU` |
| `upsert_source(2, ETH/USD)` | `2hsv2em4aPu2eFYCD3CMYTL79hrqMvRQL8d281vkTYmJEtsES3oCSpx658ADo6pekiVV6Rfu8isb91gVBm5MpdDc` |
| `upsert_source(3, SOL/USD)` | `52KdkYbaTYgJhohcRf3v8ZLqsgto5k94XgzjHY7W7cNdNach593c3uP7WWzQpw38AnQefmRXUmvM9imG9hN85viV` |
| `propose_oracle_signers([oracle], 1)` | `49Vttvjt1FmwFjh3CRTRPV52crk663Gb4nZzo8s54QjfeCBnAqn4z7qjzB9jPdNs391eJCwG8o5Bw76AKVDcb9by` |

## Explorer URLs

- Program — https://explorer.solana.com/address/DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA?cluster=devnet
- Admin — https://explorer.solana.com/address/FdmxwdK1nSGqp4r14YZyGjyxs6HgZ3opEdnLZBUQViQK?cluster=devnet
- Oracle daemon — https://explorer.solana.com/address/FRGz1weU6eWnqX1nnfd8ZtsixcdVgpmE3PiiQnVdcGLH?cluster=devnet
- Stake mint — https://explorer.solana.com/address/5BNaj6SeidyLp9PKRFTEKCTGsww9SQmsTp7yEqgHiEkT?cluster=devnet
- Config PDA — https://explorer.solana.com/address/B7VkNuRB9cfrN7UzstgcfJ5p9CorKfCrLtmjwipygAVV?cluster=devnet
- Fee vault PDA — https://explorer.solana.com/address/3BZaV8EzPSUBjWenrCmxVJuS2hQKxYTk5B4bowEdUv7s?cluster=devnet
- Oracle config PDA — https://explorer.solana.com/address/6zAV6WVjCtteFontwdqU4k1NrJnMkaJPATg34mq453Lt?cluster=devnet
- Source 1 (BTC/USD) — https://explorer.solana.com/address/EarX1BfphjYgjAKrhGxfE5Maxd347gscYPCddz7avoD1?cluster=devnet
- Source 2 (ETH/USD) — https://explorer.solana.com/address/A4pb4ToWVXmjZFqPSdqMsyjeepH1dLujXVeM2nS8QyWj?cluster=devnet
- Source 3 (SOL/USD) — https://explorer.solana.com/address/71iQEg1SkMdV1bK2y5y569JReP2TtCz9wteVxZyUYLXT?cluster=devnet

## Funding Note

The devnet faucet refused to cooperate today — 429 on every endpoint, public and private. Admin (`id.json`) was funded by transfer from `nsgame-dev1.json`, which still held leftover SOL from an earlier session. Oracle daemon likewise. This is devnet lamports moving between devnet wallets; no mainnet money touched anything.

## Next Step

Wait 24 hours. The on-chain timer is not negotiable. Then — with the same admin keypair at `~/.config/solana/id.json` — run:

```bash
cd /Users/maxguillabert/Downloads/index/programs-solana/prediction-market/deploy
./activate-oracle.sh
```

Do not start the oracle daemon before activation completes. The daemon without an active signer set is a fact without consequences.
