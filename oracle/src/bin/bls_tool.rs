//! bls-tool: CLI utility for BLS operations
//!
//! Subcommands:
//!   sign                  Sign a message hash with deterministic keypairs
//!   pubkey                Get G2 public key for a single seed index
//!   agg-pubkey-from-seeds Get aggregated G2 pubkey from seed indices
//!   from-registry         Read active issuers from IssuerRegistry and print aggregated pubkey
//!
//! The first three use deterministic seed-based keys for tests/deploy scripts.
//! The last reads from a live IssuerRegistry contract.

use clap::{Parser, Subcommand};
use ethers::prelude::*;
use ethers::types::{Address, Bytes, H256, U256};
use std::sync::Arc;

use common::bls::keypair::BLSKeyPair;
use common::bls::signer::Bn254BLSSigner;
use common::bls::{aggregate_pubkeys, deserialize_g1_point, serialize_g1_point};

#[derive(Parser)]
#[command(name = "bls-tool", about = "BLS signing and pubkey utility")]
struct Args {
    #[command(subcommand)]
    command: Option<Command>,

    // Legacy flags for backwards-compat with old single-mode usage
    /// RPC endpoint URL (legacy: same as `from-registry --rpc`)
    #[arg(long)]
    rpc: Option<String>,

    /// IssuerRegistry contract address (legacy: same as `from-registry --issuer-registry`)
    #[arg(long)]
    issuer_registry: Option<Address>,
}

#[derive(Subcommand)]
enum Command {
    /// Sign a message hash with aggregated BLS from deterministic seed keypairs
    Sign {
        /// Comma-separated seed indices (e.g. "0,1,2")
        #[arg(long)]
        seed_indices: String,
        /// 0x-prefixed message hash (32 bytes)
        #[arg(long)]
        message_hash: String,
    },
    /// Get G2 public key for a single deterministic seed
    Pubkey {
        /// Seed index (0-255)
        #[arg(long)]
        seed_index: u8,
    },
    /// Get aggregated G2 pubkey from deterministic seed indices
    AggPubkeyFromSeeds {
        /// Comma-separated seed indices (e.g. "0,1,2")
        #[arg(long)]
        seed_indices: String,
    },
    /// Read active issuers from IssuerRegistry and print aggregated pubkey
    FromRegistry {
        /// RPC endpoint URL
        #[arg(long)]
        rpc: String,
        /// IssuerRegistry contract address
        #[arg(long)]
        issuer_registry: Address,
    },
}

fn parse_seed_indices(s: &str) -> Vec<u8> {
    s.split(',')
        .map(|idx| idx.trim().parse::<u8>().expect("invalid seed index"))
        .collect()
}

fn keypair_from_seed_index(idx: u8) -> BLSKeyPair {
    let seed = vec![idx; 32];
    BLSKeyPair::from_seed(&seed)
        .unwrap_or_else(|e| {
            eprintln!("Failed to create keypair from seed {idx}: {e}");
            std::process::exit(1);
        })
}

fn parse_message_hash(s: &str) -> [u8; 32] {
    let hex_str = s.strip_prefix("0x").unwrap_or(s);
    let bytes = hex::decode(hex_str).unwrap_or_else(|e| {
        eprintln!("Invalid hex message hash: {e}");
        std::process::exit(1);
    });
    if bytes.len() != 32 {
        eprintln!("Message hash must be 32 bytes, got {}", bytes.len());
        std::process::exit(1);
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    arr
}

/// Output raw bytes to stdout as 0x-prefixed hex (for FFI consumption by Forge's vm.ffi)
fn output_hex(bytes: &[u8]) {
    use std::io::Write;
    print!("0x{}", hex::encode(bytes));
    std::io::stdout().flush().unwrap();
}

fn cmd_sign(seed_indices: &str, message_hash: &str) {
    let indices = parse_seed_indices(seed_indices);
    let msg = parse_message_hash(message_hash);
    let signer = Bn254BLSSigner::new();

    // Sign with each keypair, collect G1 signature points
    let mut sig_points = Vec::new();
    for &idx in &indices {
        let kp = keypair_from_seed_index(idx);
        let sig = signer.sign_message_hash(&kp, &msg)
            .unwrap_or_else(|e| {
                eprintln!("Failed to sign with seed {idx}: {e}");
                std::process::exit(1);
            });
        // Deserialize the BLSSignature bytes back to G1 point for aggregation
        let point = deserialize_g1_point(&sig.0)
            .unwrap_or_else(|e| {
                eprintln!("Failed to deserialize signature from seed {idx}: {e}");
                std::process::exit(1);
            });
        sig_points.push(point);
    }

    // Aggregate: sum all G1 points
    let mut aggregated = sig_points[0];
    for point in &sig_points[1..] {
        aggregated += point;
    }

    // Serialize back to bytes
    let result = serialize_g1_point(&aggregated);
    output_hex(&result);
}

fn cmd_pubkey(seed_index: u8) {
    let kp = keypair_from_seed_index(seed_index);
    let pubkey_bytes = kp.public_key_bytes();
    output_hex(&pubkey_bytes);
}

fn cmd_agg_pubkey_from_seeds(seed_indices: &str) {
    let indices = parse_seed_indices(seed_indices);

    let pubkeys: Vec<common::types::BLSPublicKey> = indices
        .iter()
        .map(|&idx| {
            let kp = keypair_from_seed_index(idx);
            kp.public_key()
        })
        .collect();

    let aggregated = aggregate_pubkeys(&pubkeys)
        .unwrap_or_else(|e| {
            eprintln!("Failed to aggregate pubkeys: {e}");
            std::process::exit(1);
        });

    output_hex(&aggregated.0);
}

#[tokio::main]
async fn main() {
    let args = Args::parse();

    match args.command {
        Some(Command::Sign { seed_indices, message_hash }) => {
            cmd_sign(&seed_indices, &message_hash);
        }
        Some(Command::Pubkey { seed_index }) => {
            cmd_pubkey(seed_index);
        }
        Some(Command::AggPubkeyFromSeeds { seed_indices }) => {
            cmd_agg_pubkey_from_seeds(&seed_indices);
        }
        Some(Command::FromRegistry { rpc, issuer_registry }) => {
            run_from_registry(&rpc, issuer_registry).await;
        }
        None => {
            // Legacy mode: --rpc + --issuer-registry
            if let (Some(rpc), Some(registry)) = (args.rpc, args.issuer_registry) {
                run_from_registry(&rpc, registry).await;
            } else {
                eprintln!("Usage: bls-tool <COMMAND>");
                eprintln!("  sign                  Sign message hash with seed keypairs");
                eprintln!("  pubkey                Get pubkey for a seed index");
                eprintln!("  agg-pubkey-from-seeds Get aggregated pubkey from seeds");
                eprintln!("  from-registry         Read from IssuerRegistry contract");
                eprintln!("");
                eprintln!("Legacy: bls-tool --rpc <RPC> --issuer-registry <ADDR>");
                std::process::exit(1);
            }
        }
    }
}

async fn run_from_registry(rpc: &str, issuer_registry: Address) {
    let provider = Provider::<Http>::try_from(rpc)
        .unwrap_or_else(|e| {
            eprintln!("Failed to connect to RPC: {e}");
            std::process::exit(1);
        });
    let provider = Arc::new(provider);

    let selector = &ethers::utils::keccak256("getActiveIssuerEndpoints()")[..4];

    let tx = TransactionRequest::new()
        .to(issuer_registry)
        .data(selector.to_vec());

    let result = provider
        .call(&tx.into(), None)
        .await
        .unwrap_or_else(|e| {
            eprintln!("Contract call failed: {e}");
            std::process::exit(1);
        });

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

    let ids = tokens[0].clone().into_array().expect("ids is array");
    let ips = tokens[1].clone().into_array().expect("ips is array");
    let pubkeys = tokens[2].clone().into_array().expect("pubkeys is array");

    if ids.len() != ips.len() || ids.len() != pubkeys.len() {
        eprintln!("Mismatched array lengths from contract");
        std::process::exit(1);
    }

    if ids.is_empty() {
        eprintln!("No active issuers found");
        std::process::exit(1);
    }

    let issuers: Vec<common::types::Issuer> = ids
        .iter()
        .zip(ips.iter())
        .zip(pubkeys.iter())
        .map(|((id_tok, ip_tok), pk_tok)| {
            let id = id_tok.clone().into_uint().expect("id is uint").as_u64();
            let ip_bytes: [u8; 32] = ip_tok
                .clone()
                .into_fixed_bytes()
                .expect("ip is bytes32")
                .try_into()
                .expect("ip is 32 bytes");
            let pubkey_bytes = pk_tok.clone().into_bytes().expect("pubkey is bytes");

            common::types::Issuer {
                id,
                addr: Address::zero(),
                ip: H256::from(ip_bytes),
                bls_pubkey: Bytes::from(pubkey_bytes),
                status: U256::from(1),
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
