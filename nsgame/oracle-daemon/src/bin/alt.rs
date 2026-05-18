//! `alt` — Address Lookup Table management CLI for market makers.
//!
//! Batched bets on the Solana prediction-market program can reference up to
//! 256 markets through a single ALT. This binary is the operator's scalpel:
//! create the table, extend it in 20-address chunks, freeze it once the set
//! is stable, deactivate it when obsolete, close it after the cool-down.
//!
//! Nothing here is stateful. Every subcommand is one-shot, idempotent where
//! the runtime allows, and prints the on-chain address it touched. Operators
//! compose these primitives into the lifecycle their trading system demands.
//!
//! ALT is not `solana-sdk` territory in the 3.x line — the instruction
//! builders live in the `solana-address-lookup-table-interface` crate. We
//! depend on it directly and convert signer types at the boundary.
//!
//! Plan: H14. Scope: `oracle-daemon/src/bin/alt.rs` only.

use anyhow::{anyhow, bail, Context, Result};
use clap::{Args, Parser, Subcommand};
use solana_address_lookup_table_interface::instruction as alt_ix;
use solana_address_lookup_table_interface::state::AddressLookupTable;
use solana_client::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_keypair::Keypair;
use solana_message::{Message, VersionedMessage};
use solana_pubkey::Pubkey;
use solana_sdk::signature::Signature;
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;
use std::path::Path;
use std::process::ExitCode;
use std::str::FromStr;

/// Solana caps the serialized instruction data; 20 addresses per
/// `extend_lookup_table` tx is the proven ceiling. Past this the runtime
/// rejects the transaction for exceeding the 1232-byte packet budget.
const EXTEND_CHUNK_SIZE: usize = 20;

// -----------------------------------------------------------------------------
// CLI surface
// -----------------------------------------------------------------------------

#[derive(Parser, Debug)]
#[command(
    name = "alt",
    about = "Address Lookup Table management.",
    version,
    disable_help_subcommand = true
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Create a new lookup table.
    Create(CreateArgs),
    /// Append addresses to an existing table.
    Extend(ExtendArgs),
    /// Freeze a table. Irreversible.
    Freeze(FreezeArgs),
    /// Begin deactivation. Cool-down follows.
    Deactivate(DeactivateArgs),
    /// Close a deactivated table and reclaim rent.
    Close(CloseArgs),
    /// Decode and print table contents.
    Show(ShowArgs),
}

#[derive(Args, Debug)]
struct CreateArgs {
    /// Path to the authority keypair JSON. Also pays rent.
    #[arg(long)]
    authority: String,
    /// Informational only; ALTs always allocate room for 256 addresses.
    #[arg(long)]
    max_addresses: Option<usize>,
}

#[derive(Args, Debug)]
struct ExtendArgs {
    /// Base58 address of the lookup table.
    #[arg(long)]
    alt: String,
    /// Path to the authority keypair JSON.
    #[arg(long)]
    authority: String,
    /// Either a filesystem path (one pubkey per line) or a comma-separated list.
    #[arg(long)]
    addresses: String,
}

#[derive(Args, Debug)]
struct FreezeArgs {
    #[arg(long)]
    alt: String,
    #[arg(long)]
    authority: String,
}

#[derive(Args, Debug)]
struct DeactivateArgs {
    #[arg(long)]
    alt: String,
    #[arg(long)]
    authority: String,
}

#[derive(Args, Debug)]
struct CloseArgs {
    #[arg(long)]
    alt: String,
    #[arg(long)]
    authority: String,
    /// Base58 pubkey that receives the reclaimed rent lamports.
    #[arg(long)]
    recipient: String,
}

#[derive(Args, Debug)]
struct ShowArgs {
    #[arg(long)]
    alt: String,
}

// -----------------------------------------------------------------------------
// Entry
// -----------------------------------------------------------------------------

fn main() -> ExitCode {
    let cli = Cli::parse();
    match dispatch(cli) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("alt: {err:#}");
            ExitCode::FAILURE
        }
    }
}

fn dispatch(cli: Cli) -> Result<()> {
    let rpc = connect_rpc()?;
    match cli.command {
        Command::Create(a) => cmd_create(&rpc, a),
        Command::Extend(a) => cmd_extend(&rpc, a),
        Command::Freeze(a) => cmd_freeze(&rpc, a),
        Command::Deactivate(a) => cmd_deactivate(&rpc, a),
        Command::Close(a) => cmd_close(&rpc, a),
        Command::Show(a) => cmd_show(&rpc, a),
    }
}

fn connect_rpc() -> Result<RpcClient> {
    let url = std::env::var("RPC_URL").context("RPC_URL is required")?;
    Ok(RpcClient::new_with_commitment(url, CommitmentConfig::confirmed()))
}

// -----------------------------------------------------------------------------
// Keypair loading — mirrors `identity.rs` without depending on it, to stay
// isolated from unrelated edits in the daemon library.
// -----------------------------------------------------------------------------

fn load_keypair(path: &str) -> Result<Keypair> {
    solana_keypair::read_keypair_file(path)
        .map_err(|e| anyhow!("read_keypair_file({path}): {e}"))
}

fn parse_pubkey(label: &str, s: &str) -> Result<Pubkey> {
    Pubkey::from_str(s).with_context(|| format!("{label} is not a valid base58 pubkey: {s}"))
}

// -----------------------------------------------------------------------------
// Address-list input: a path to a file (one per line, `#` comments allowed)
// or a comma-separated inline list. Empty input is rejected — a no-op extend
// would burn a fee for nothing.
// -----------------------------------------------------------------------------

fn load_addresses(input: &str) -> Result<Vec<Pubkey>> {
    let raw = if Path::new(input).exists() {
        std::fs::read_to_string(input)
            .with_context(|| format!("read addresses file {input}"))?
    } else {
        input.to_string()
    };

    let mut out = Vec::new();
    for (i, raw_line) in raw.split(|c| c == '\n' || c == ',').enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let pk = Pubkey::from_str(line)
            .with_context(|| format!("entry {} is not a valid base58 pubkey: {line}", i + 1))?;
        out.push(pk);
    }
    if out.is_empty() {
        bail!("no addresses parsed from input");
    }
    Ok(out)
}

// -----------------------------------------------------------------------------
// Subcommand: create
// -----------------------------------------------------------------------------

fn cmd_create(rpc: &RpcClient, args: CreateArgs) -> Result<()> {
    let authority = load_keypair(&args.authority)?;

    // The ALT PDA is derived from (authority, recent_slot). Use the most
    // recent finalized slot we can see — anything older risks the program
    // rejecting the derivation.
    let recent_slot = rpc
        .get_slot_with_commitment(CommitmentConfig::finalized())
        .context("get_slot for ALT derivation")?;

    let (ix, alt_address) =
        alt_ix::create_lookup_table(authority.pubkey(), authority.pubkey(), recent_slot);

    let sig = send_signed_tx(rpc, &authority, &[ix])?;

    println!("alt address : {alt_address}");
    println!("signature   : {sig}");
    println!("recent slot : {recent_slot}");
    if let Some(max) = args.max_addresses {
        println!("capacity    : {max} (informational; protocol cap is 256)");
    }
    println!(
        "note        : ALTs become usable after the creation slot exits the \
                       recent-slots window (a few slots). Extend now; use later."
    );
    Ok(())
}

// -----------------------------------------------------------------------------
// Subcommand: extend
// -----------------------------------------------------------------------------

fn cmd_extend(rpc: &RpcClient, args: ExtendArgs) -> Result<()> {
    let authority = load_keypair(&args.authority)?;
    let alt_addr = parse_pubkey("--alt", &args.alt)?;
    let addresses = load_addresses(&args.addresses)?;
    let chunks = chunk_addresses(&addresses, EXTEND_CHUNK_SIZE);
    let total_chunks = chunks.len();

    println!(
        "extending {} with {} addresses across {} tx(s)",
        alt_addr,
        addresses.len(),
        total_chunks
    );

    for (idx, chunk) in chunks.into_iter().enumerate() {
        let ix = alt_ix::extend_lookup_table(
            alt_addr,
            authority.pubkey(),
            Some(authority.pubkey()),
            chunk.to_vec(),
        );
        let sig = send_signed_tx(rpc, &authority, &[ix])
            .with_context(|| format!("chunk {}/{}", idx + 1, total_chunks))?;
        println!(
            "chunk {}/{}: +{} addrs  sig={}",
            idx + 1,
            total_chunks,
            chunk.len(),
            sig
        );
    }
    Ok(())
}

/// Split `addrs` into contiguous slices of at most `size`. Pure; tested.
fn chunk_addresses<'a>(addrs: &'a [Pubkey], size: usize) -> Vec<&'a [Pubkey]> {
    assert!(size > 0, "chunk size must be positive");
    addrs.chunks(size).collect()
}

// -----------------------------------------------------------------------------
// Subcommand: freeze
// -----------------------------------------------------------------------------

fn cmd_freeze(rpc: &RpcClient, args: FreezeArgs) -> Result<()> {
    let authority = load_keypair(&args.authority)?;
    let alt_addr = parse_pubkey("--alt", &args.alt)?;
    let ix = alt_ix::freeze_lookup_table(alt_addr, authority.pubkey());
    let sig = send_signed_tx(rpc, &authority, &[ix])?;
    println!("frozen      : {alt_addr}");
    println!("signature   : {sig}");
    println!("note        : the table is now immutable. Addresses cannot be added or removed.");
    Ok(())
}

// -----------------------------------------------------------------------------
// Subcommand: deactivate
// -----------------------------------------------------------------------------

fn cmd_deactivate(rpc: &RpcClient, args: DeactivateArgs) -> Result<()> {
    let authority = load_keypair(&args.authority)?;
    let alt_addr = parse_pubkey("--alt", &args.alt)?;
    let ix = alt_ix::deactivate_lookup_table(alt_addr, authority.pubkey());
    let sig = send_signed_tx(rpc, &authority, &[ix])?;
    println!("deactivated : {alt_addr}");
    println!("signature   : {sig}");
    println!(
        "note        : the table enters a cool-down (~512 slots, a few minutes \
                       on mainnet) before `alt close` will succeed. Premature \
                       close attempts revert on-chain."
    );
    Ok(())
}

// -----------------------------------------------------------------------------
// Subcommand: close
// -----------------------------------------------------------------------------

fn cmd_close(rpc: &RpcClient, args: CloseArgs) -> Result<()> {
    let authority = load_keypair(&args.authority)?;
    let alt_addr = parse_pubkey("--alt", &args.alt)?;
    let recipient = parse_pubkey("--recipient", &args.recipient)?;
    let ix = alt_ix::close_lookup_table(alt_addr, authority.pubkey(), recipient);
    let sig = send_signed_tx(rpc, &authority, &[ix])?;
    println!("closed      : {alt_addr}");
    println!("recipient   : {recipient}");
    println!("signature   : {sig}");
    Ok(())
}

// -----------------------------------------------------------------------------
// Subcommand: show
// -----------------------------------------------------------------------------

fn cmd_show(rpc: &RpcClient, args: ShowArgs) -> Result<()> {
    let alt_addr = parse_pubkey("--alt", &args.alt)?;
    let account = rpc
        .get_account(&alt_addr)
        .with_context(|| format!("fetch account {alt_addr}"))?;
    let table = AddressLookupTable::deserialize(&account.data)
        .map_err(|e| anyhow!("decode ALT: {e:?}"))?;

    println!("alt address          : {alt_addr}");
    println!("owner                : {}", account.owner);
    println!("lamports             : {}", account.lamports);
    println!("stored addresses     : {}", table.addresses.len());
    println!(
        "authority            : {}",
        table
            .meta
            .authority
            .map(|a| a.to_string())
            .unwrap_or_else(|| "<frozen: none>".to_string())
    );
    println!("deactivation_slot    : {}", table.meta.deactivation_slot);
    println!("last_extended_slot   : {}", table.meta.last_extended_slot);
    println!(
        "last_extended_start  : {}",
        table.meta.last_extended_slot_start_index
    );
    println!("---");
    for (i, pk) in table.addresses.iter().enumerate() {
        println!("{i:>3}  {pk}");
    }
    Ok(())
}

// -----------------------------------------------------------------------------
// Transaction send — legacy message, signed by the authority as fee payer.
// Every ALT ix requires a single signer; we keep the signing path identical
// across subcommands.
// -----------------------------------------------------------------------------

fn send_signed_tx(
    rpc: &RpcClient,
    payer: &Keypair,
    ixs: &[solana_instruction::Instruction],
) -> Result<Signature> {
    let blockhash = rpc.get_latest_blockhash().context("get_latest_blockhash")?;
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer])
        .map_err(|e| anyhow!("sign tx: {e}"))?;
    rpc.send_and_confirm_transaction(&tx)
        .map_err(|e| anyhow!("send_and_confirm_transaction: {e}"))
}

// -----------------------------------------------------------------------------
// Tests — pure chunking logic. Network paths are exercised manually or via
// optional validator harnesses (see README).
// -----------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn fake_keys(n: usize) -> Vec<Pubkey> {
        (0..n).map(|_| Pubkey::new_unique()).collect()
    }

    #[test]
    fn chunk_size_is_twenty() {
        assert_eq!(EXTEND_CHUNK_SIZE, 20);
    }

    #[test]
    fn fifty_addresses_split_into_three_chunks() {
        let keys = fake_keys(50);
        let chunks = chunk_addresses(&keys, EXTEND_CHUNK_SIZE);
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].len(), 20);
        assert_eq!(chunks[1].len(), 20);
        assert_eq!(chunks[2].len(), 10);
        let round_trip: Vec<Pubkey> = chunks.iter().flat_map(|c| c.iter().copied()).collect();
        assert_eq!(round_trip, keys);
    }

    #[test]
    fn exact_multiple_has_no_remainder_chunk() {
        let keys = fake_keys(40);
        let chunks = chunk_addresses(&keys, EXTEND_CHUNK_SIZE);
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].len(), 20);
        assert_eq!(chunks[1].len(), 20);
    }

    #[test]
    fn single_address_yields_single_chunk() {
        let keys = fake_keys(1);
        let chunks = chunk_addresses(&keys, EXTEND_CHUNK_SIZE);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].len(), 1);
    }

    #[test]
    fn empty_input_yields_no_chunks() {
        let keys: Vec<Pubkey> = Vec::new();
        let chunks = chunk_addresses(&keys, EXTEND_CHUNK_SIZE);
        assert!(chunks.is_empty());
    }

    #[test]
    fn parse_inline_comma_list() {
        let a = Pubkey::new_unique().to_string();
        let b = Pubkey::new_unique().to_string();
        let input = format!("{a},{b}");
        let parsed = load_addresses(&input).unwrap();
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].to_string(), a);
        assert_eq!(parsed[1].to_string(), b);
    }

    #[test]
    fn parse_addresses_from_file_with_comments() {
        use std::io::Write;
        let a = Pubkey::new_unique().to_string();
        let b = Pubkey::new_unique().to_string();
        let mut f = tempfile::NamedTempFile::new().unwrap();
        writeln!(f, "# header comment").unwrap();
        writeln!(f, "{a}").unwrap();
        writeln!(f, "").unwrap();
        writeln!(f, "{b}").unwrap();
        let parsed = load_addresses(f.path().to_str().unwrap()).unwrap();
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].to_string(), a);
        assert_eq!(parsed[1].to_string(), b);
    }

    #[test]
    fn empty_input_is_rejected() {
        let err = load_addresses("   ").unwrap_err();
        assert!(err.to_string().contains("no addresses parsed"));
    }

    #[test]
    fn invalid_pubkey_surfaces_position() {
        let err = load_addresses("not-a-pubkey").unwrap_err();
        // The error chain includes the offending entry and index.
        let msg = format!("{err:#}");
        assert!(msg.contains("entry 1"), "unexpected error: {msg}");
    }
}
