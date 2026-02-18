//! bls-tool: CLI utility to read active issuers from IssuerRegistry and print
//! the aggregated BLS G2 public key.
//!
//! Usage:
//!   bls-tool --rpc <RPC_URL> --issuer-registry <CONTRACT_ADDRESS>
//!
//! Output: 0x{hex} aggregated G2 pubkey (128 bytes = 256 hex chars)

use clap::Parser;
use ethers::prelude::*;
use ethers::types::{Address, Bytes, H256, U256};
use std::sync::Arc;

#[derive(Parser)]
#[command(name = "bls-tool", about = "Compute aggregated BLS G2 pubkey from IssuerRegistry")]
struct Args {
    /// RPC endpoint URL
    #[arg(long)]
    rpc: String,

    /// IssuerRegistry contract address
    #[arg(long)]
    issuer_registry: Address,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();

    let provider = Provider::<Http>::try_from(&args.rpc)
        .unwrap_or_else(|e| {
            eprintln!("Failed to connect to RPC: {e}");
            std::process::exit(1);
        });
    let provider = Arc::new(provider);

    // getActiveIssuerEndpoints() selector = keccak256("getActiveIssuerEndpoints()")[..4]
    let selector = &ethers::utils::keccak256("getActiveIssuerEndpoints()")[..4];

    let tx = TransactionRequest::new()
        .to(args.issuer_registry)
        .data(selector.to_vec());

    let result = provider
        .call(&tx.into(), None)
        .await
        .unwrap_or_else(|e| {
            eprintln!("Contract call failed: {e}");
            std::process::exit(1);
        });

    // Decode ABI: returns (uint256[] ids, bytes32[] ips, bytes[] pubkeys)
    let tokens = ethers::abi::decode(
        &[
            ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Uint(256))),
            ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::FixedBytes(32))),
            ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Bytes)),
        ],
        &result,
    )
    .unwrap_or_else(|e| {
        eprintln!("ABI decode failed: {e}");
        std::process::exit(1);
    });

    let ids = tokens[0]
        .clone()
        .into_array()
        .expect("ids is array");
    let ips = tokens[1]
        .clone()
        .into_array()
        .expect("ips is array");
    let pubkeys = tokens[2]
        .clone()
        .into_array()
        .expect("pubkeys is array");

    if ids.len() != ips.len() || ids.len() != pubkeys.len() {
        eprintln!("Mismatched array lengths from contract");
        std::process::exit(1);
    }

    if ids.is_empty() {
        eprintln!("No active issuers found");
        std::process::exit(1);
    }

    // Build Issuer structs — all returned issuers are active (the contract
    // function is getActiveIssuerEndpoints), so we set status = 1.
    let issuers: Vec<common::types::Issuer> = ids
        .iter()
        .zip(ips.iter())
        .zip(pubkeys.iter())
        .map(|((id_tok, ip_tok), pk_tok)| {
            let _id = id_tok
                .clone()
                .into_uint()
                .expect("id is uint");
            let ip_bytes: [u8; 32] = ip_tok
                .clone()
                .into_fixed_bytes()
                .expect("ip is bytes32")
                .try_into()
                .expect("ip is 32 bytes");
            let pubkey_bytes = pk_tok
                .clone()
                .into_bytes()
                .expect("pubkey is bytes");

            common::types::Issuer {
                addr: Address::zero(),
                ip: H256::from(ip_bytes),
                bls_pubkey: Bytes::from(pubkey_bytes),
                status: U256::from(1), // active
                registered_at: U256::zero(),
            }
        })
        .collect();

    let aggregated = issuer::registry_sync::compute_aggregated_pubkey(&issuers)
        .unwrap_or_else(|e| {
            eprintln!("Failed to compute aggregated pubkey: {e}");
            std::process::exit(1);
        });

    println!("0x{}", hex::encode(&aggregated));
}
