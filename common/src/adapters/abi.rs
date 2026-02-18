//! Ethers abigen! contract bindings for Index L3 contracts
//!
//! Generates type-safe Rust bindings from minimal ABI JSON files.
//! Only includes functions/events needed by the AP service.

use ethers::contract::abigen;

abigen!(
    IndexContract,
    "src/adapters/abi/index_abi.json"
);

abigen!(
    IssuerRegistryContract,
    "src/adapters/abi/issuer_registry_abi.json"
);

abigen!(
    L3BridgeCustodyContract,
    "src/adapters/abi/l3_bridge_custody_abi.json"
);

abigen!(
    MockBitgetVaultContract,
    "src/adapters/abi/mock_bitget_vault_abi.json"
);

abigen!(
    ERC20Contract,
    "src/adapters/abi/erc20_abi.json"
);
