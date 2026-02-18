//! Real chain adapter implementations for Index L3
//!
//! Provides RPC-based implementations of ChainReader and ChainWriter traits,
//! connecting to deployed L3 contracts via ethers Provider.

pub mod abi;
pub mod bitget_vault_reader;
pub mod deployment_config;
pub mod rpc_chain_reader;
pub mod rpc_chain_writer;

pub use bitget_vault_reader::{BitgetVaultFill, BitgetVaultReader, BitgetVaultReaderError};
pub use deployment_config::DeploymentConfig;
pub use rpc_chain_reader::RpcChainReader;
pub use rpc_chain_writer::RpcChainWriter;
