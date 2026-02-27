# Index L3

Decentralized Index Token Product (ITP) platform on Arbitrum Orbit L3.

## Local Development

### Prerequisites

- [Foundry](https://getfoundry.sh/) - Solidity development toolkit
- [Rust](https://rustup.rs/) - 1.83+ with cargo
- Docker (optional, for containerized development)

### Quick Start

```bash
# Start the full local environment
./start.sh

# Or with options
./start.sh --issuers 5        # Run 5 issuer nodes
./start.sh --skip-deploy      # Skip contract deployment
./start.sh --no-tail          # Don't tail logs after startup
./start.sh --help             # Show all options

# Stop all services
./stop.sh
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Anvil | 8545 | Local chain (chain ID 111222333) |
| Issuer 1-N | 9001-900N | Issuer nodes (consensus, batching) |
| AP | 9100 | Authorized Participant (mock Bitget) |

### Docker Alternative

```bash
# Start with Docker Compose
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### CLI Reference

#### Issuer Node

```bash
issuer --node-id <ID>        # Required: issuer ID (1-20)
issuer --port <PORT>         # Optional: P2P listen port (default 9000 + node_id)
issuer --rpc <URL>           # Optional: chain RPC (default http://localhost:8545)
issuer --config <PATH>       # Optional: config file path
issuer --log-level <LEVEL>   # Optional: trace/debug/info/warn/error
issuer --log-dir <DIR>       # Optional: log output directory
issuer --json-logs           # Optional: output JSON formatted logs
issuer --version             # Show version info
issuer --help                # Show help
```

#### AP (Authorized Participant)

```bash
ap --port <PORT>             # Optional: API listen port (default 9100)
ap --rpc <URL>               # Optional: chain RPC (default http://localhost:8545)
ap --mock-bitget             # Use mock Bitget client (local dev)
ap --config <PATH>           # Optional: config file path
ap --log-level <LEVEL>       # Optional: trace/debug/info/warn/error
ap --log-dir <DIR>           # Optional: log output directory
ap --json-logs               # Optional: output JSON formatted logs
ap --version                 # Show version info
ap --help                    # Show help
```

### Logs

All logs are written to the `./logs/` directory:

- `anvil.log` - Local chain logs
- `issuer-{N}.log` - Issuer node logs
- `ap.log` - AP service logs
- `deploy.log` - Contract deployment logs

### Deployed Addresses

After running `start.sh`, deployed contract addresses are saved to `deployments/local.json`:

```json
{
  "chainId": 111222333,
  "contracts": {
    "Governance": "0x...",
    "Index": "0x...",
    "ITP": "0x...",
    "BLSCustody": "0x...",
    "CollateralRegistry": "0x...",
    "IssuerRegistry": "0x...",
    "Bridge": "0x..."
  }
}
```

### Project Structure

```
index/
├── start.sh                 # Launch local environment
├── stop.sh                  # Stop all services
├── docker-compose.yml       # Docker alternative
├── contracts/               # Solidity (Foundry)
│   ├── src/interfaces/      # Contract interfaces
│   ├── src/libraries/       # Shared libraries
│   └── script/Deploy.s.sol  # Deployment script
├── issuer/                  # Rust issuer node
│   └── src/main.rs          # Binary entry point
├── ap/                      # Rust AP/Keeper service
│   └── src/main.rs          # Binary entry point
├── common/                  # Shared Rust crate
│   ├── src/traits/          # Core traits
│   ├── src/types/           # Shared types
│   └── src/mocks/           # Mock implementations
├── logs/                    # Runtime logs (gitignored)
└── deployments/             # Contract addresses
    └── local.json           # Local deployment addresses
```

## Network Configuration

| Network | Chain ID | RPC | Collateral |
|---------|----------|-----|------------|
| Index L3 (Local) | 111222333 | http://localhost:8545 | ETH |
| Index L3 (Testnet) | 111222333 | http://142.132.164.24/ | GM (18 dec) |

## License

MIT
