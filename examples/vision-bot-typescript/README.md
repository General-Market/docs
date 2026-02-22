# Vision Bot (TypeScript)

A minimal bot that joins Vision prediction market batches with random bets on Arbitrum using viem.

## Setup

1. Clone this repo and `cd examples/vision-bot-typescript`
2. Copy `.env.example` to `.env` and fill in your private key
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the bot:
   ```bash
   npm start
   ```

## What it does

- Registers your wallet as a Vision bot on-chain
- Polls the Vision API for active batches
- For each new batch: generates random UP/DOWN bets, encodes them into a bitmap, approves USDC, joins the batch on-chain, and submits the bitmap to the API
- Periodically checks for claimable rewards

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `RPC_URL` | Arbitrum RPC endpoint | `https://arb1.arbitrum.io/rpc` |
| `VISION_API_URL` | Vision API base URL | `https://generalmarket.io/api/vision` |
| `VISION_ADDRESS` | Vision contract address | -- |
| `USDC_ADDRESS` | USDC token address | -- |
| `BOT_PRIVATE_KEY` | Wallet private key (with USDC funded) | -- |
| `DEPOSIT_AMOUNT` | USDC deposit per batch (whole tokens) | `10` |
| `STAKE_PER_TICK` | USDC stake per tick (whole tokens) | `1` |
| `POLL_INTERVAL` | Seconds between poll cycles | `30` |

## License

MIT
