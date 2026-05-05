//! Real chain adapter implementations for Index L3
//!
//! Provides RPC-based implementations of ChainReader and ChainWriter traits,
//! connecting to deployed L3 contracts via ethers Provider.

pub mod abi;
pub mod bitget_vault_reader;
pub mod data_node_chain_reader;
pub mod deployment_config;
pub mod deployment_verifier;
pub mod rpc_chain_reader;
pub mod rpc_chain_writer;

pub use bitget_vault_reader::{BitgetVaultFill, BitgetVaultReader, BitgetVaultReaderError};
pub use data_node_chain_reader::DataNodeChainReader;
pub use deployment_config::DeploymentConfig;
pub use deployment_verifier::{DeploymentVerifier, VerifierError};
pub use rpc_chain_reader::RpcChainReader;
pub use rpc_chain_writer::RpcChainWriter;
