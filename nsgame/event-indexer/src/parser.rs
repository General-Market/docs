//! Anchor event decoder.
//!
//! Anchor emits events via `msg!` with a two-line convention:
//!
//! ```text
//! Program <program_id> invoke [1]
//! Program data: <base64-of-discriminator-and-payload>
//! Program <program_id> success
//! ```
//!
//! The base64 payload is `[8-byte discriminator][borsh-encoded fields]`.
//! Discriminators are sha256("event:<Name>")[0..8] — but the IDL already
//! pins them, so we hardcode the values and skip the hashing dance.
//!
//! Borsh primitive layouts we rely on:
//!   - `u8`, `u16`, `u32`, `u64`, `u128`   → little-endian, fixed width
//!   - `i32`, `i64`                         → little-endian two's complement
//!   - `bool`                               → 1 byte, 0 or 1
//!   - `Pubkey`                             → 32 raw bytes
//!
//! No length prefixes appear in any of our events — they are flat structs.

use anyhow::{bail, Context, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine};

const PROGRAM_DATA_PREFIX: &str = "Program data: ";

// Discriminators lifted directly from target/idl/prediction_market.json.
pub const DISC_BET_EXITED: [u8; 8]          = [254, 122, 26, 245, 244, 114, 163, 137];
pub const DISC_BET_PLACED: [u8; 8]          = [88, 88, 145, 226, 126, 206, 32, 0];
pub const DISC_CLAIMED: [u8; 8]             = [217, 192, 123, 72, 108, 150, 248, 33];
pub const DISC_MARKET_CLOSED: [u8; 8]       = [86, 91, 119, 43, 94, 0, 217, 113];
pub const DISC_MARKET_INSTANTIATED: [u8; 8] = [77, 166, 134, 236, 215, 190, 81, 148];
pub const DISC_MARKET_RESOLVED: [u8; 8]     = [89, 67, 230, 95, 143, 106, 199, 202];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Event {
    BetPlaced          { market: [u8; 32], owner: [u8; 32], side: u8, amount: u64 },
    BetExited          { market: [u8; 32], owner: [u8; 32], side: u8, amount: u64 },
    MarketInstantiated { market: [u8; 32], source_id: u32, close_time: i64, settlement_time: i64, threshold_bps: i32, creator: [u8; 32] },
    MarketClosed       { market: [u8; 32], baseline_price: u128 },
    MarketResolved     { market: [u8; 32], baseline_price: u128, final_price: u128, outcome_yes: bool, force_resolved: bool },
    Claimed            { market: [u8; 32], owner: [u8; 32], net: u64, fee: u64, stranded: bool },
}

/// Walk a transaction's log messages and extract every decodable event.
pub fn parse_logs(logs: &[String]) -> Vec<Event> {
    let mut out = Vec::new();
    for line in logs {
        if let Some(payload) = line.strip_prefix(PROGRAM_DATA_PREFIX) {
            match decode_line(payload) {
                Ok(Some(ev)) => out.push(ev),
                Ok(None) => {} // unknown discriminator — not an event we care about
                Err(e) => tracing::debug!(error = %e, line = %line, "failed to decode program data"),
            }
        }
    }
    out
}

fn decode_line(b64: &str) -> Result<Option<Event>> {
    let bytes = B64.decode(b64.trim())
        .context("base64 decode failed")?;
    if bytes.len() < 8 {
        bail!("payload shorter than discriminator");
    }
    let (disc, rest) = bytes.split_at(8);
    let disc: [u8; 8] = disc.try_into().unwrap();

    let ev = match disc {
        DISC_BET_PLACED => {
            let f = decode_bet_fields(rest)?;
            Event::BetPlaced { market: f.0, owner: f.1, side: f.2, amount: f.3 }
        }
        DISC_BET_EXITED => {
            let f = decode_bet_fields(rest)?;
            Event::BetExited { market: f.0, owner: f.1, side: f.2, amount: f.3 }
        }
        DISC_MARKET_INSTANTIATED => decode_market_instantiated(rest)?,
        DISC_MARKET_CLOSED       => decode_market_closed(rest)?,
        DISC_MARKET_RESOLVED     => decode_market_resolved(rest)?,
        DISC_CLAIMED             => decode_claimed(rest)?,
        _ => return Ok(None),
    };
    Ok(Some(ev))
}

// BetPlaced and BetExited share an identical field layout. One decoder
// feeds both variants.
fn decode_bet_fields(b: &[u8]) -> Result<([u8; 32], [u8; 32], u8, u64)> {
    let mut c = Cursor::new(b);
    let market = c.pubkey()?;
    let owner  = c.pubkey()?;
    let side   = c.u8()?;
    let amount = c.u64()?;
    Ok((market, owner, side, amount))
}

fn decode_market_instantiated(b: &[u8]) -> Result<Event> {
    let mut c = Cursor::new(b);
    let market          = c.pubkey()?;
    let source_id       = c.u32()?;
    let close_time      = c.i64()?;
    let settlement_time = c.i64()?;
    let threshold_bps   = c.i32()?;
    let creator         = c.pubkey()?;
    Ok(Event::MarketInstantiated { market, source_id, close_time, settlement_time, threshold_bps, creator })
}

fn decode_market_closed(b: &[u8]) -> Result<Event> {
    let mut c = Cursor::new(b);
    let market         = c.pubkey()?;
    let baseline_price = c.u128()?;
    Ok(Event::MarketClosed { market, baseline_price })
}

fn decode_market_resolved(b: &[u8]) -> Result<Event> {
    let mut c = Cursor::new(b);
    let market         = c.pubkey()?;
    let baseline_price = c.u128()?;
    let final_price    = c.u128()?;
    let outcome_yes    = c.bool()?;
    let force_resolved = c.bool()?;
    Ok(Event::MarketResolved { market, baseline_price, final_price, outcome_yes, force_resolved })
}

fn decode_claimed(b: &[u8]) -> Result<Event> {
    let mut c = Cursor::new(b);
    let market   = c.pubkey()?;
    let owner    = c.pubkey()?;
    let net      = c.u64()?;
    let fee      = c.u64()?;
    let stranded = c.bool()?;
    Ok(Event::Claimed { market, owner, net, fee, stranded })
}

// Minimal byte cursor. tokio-postgres pulls in bytes::Buf but we want no
// dependency here beyond std so the parser stays trivial to audit.
struct Cursor<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Cursor<'a> {
    fn new(buf: &'a [u8]) -> Self { Self { buf, pos: 0 } }

    fn take(&mut self, n: usize) -> Result<&'a [u8]> {
        if self.pos + n > self.buf.len() {
            bail!("unexpected end of buffer ({} + {} > {})", self.pos, n, self.buf.len());
        }
        let s = &self.buf[self.pos..self.pos + n];
        self.pos += n;
        Ok(s)
    }

    fn u8(&mut self)  -> Result<u8>  { Ok(self.take(1)?[0]) }
    fn u32(&mut self) -> Result<u32> { Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap())) }
    fn u64(&mut self) -> Result<u64> { Ok(u64::from_le_bytes(self.take(8)?.try_into().unwrap())) }
    fn u128(&mut self) -> Result<u128> { Ok(u128::from_le_bytes(self.take(16)?.try_into().unwrap())) }
    fn i32(&mut self) -> Result<i32> { Ok(i32::from_le_bytes(self.take(4)?.try_into().unwrap())) }
    fn i64(&mut self) -> Result<i64> { Ok(i64::from_le_bytes(self.take(8)?.try_into().unwrap())) }
    fn bool(&mut self) -> Result<bool> {
        match self.u8()? {
            0 => Ok(false),
            1 => Ok(true),
            n => bail!("invalid bool byte {n}"),
        }
    }
    fn pubkey(&mut self) -> Result<[u8; 32]> {
        Ok(self.take(32)?.try_into().unwrap())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD as B64, Engine};

    fn pubkey32(byte: u8) -> [u8; 32] { [byte; 32] }

    // Helper: build a "Program data: <b64>" log line from raw event bytes.
    fn line(bytes: &[u8]) -> String {
        format!("{}{}", PROGRAM_DATA_PREFIX, B64.encode(bytes))
    }

    #[test]
    fn decodes_bet_placed() {
        let mut buf = Vec::new();
        buf.extend_from_slice(&DISC_BET_PLACED);
        buf.extend_from_slice(&pubkey32(1));             // market
        buf.extend_from_slice(&pubkey32(2));             // owner
        buf.push(0u8);                                   // side = YES
        buf.extend_from_slice(&(123_456_u64).to_le_bytes()); // amount

        let events = parse_logs(&[line(&buf)]);
        assert_eq!(events.len(), 1);
        match &events[0] {
            Event::BetPlaced { market, owner, side, amount } => {
                assert_eq!(*market, pubkey32(1));
                assert_eq!(*owner, pubkey32(2));
                assert_eq!(*side, 0);
                assert_eq!(*amount, 123_456);
            }
            other => panic!("wrong variant: {other:?}"),
        }
    }

    #[test]
    fn decodes_bet_exited() {
        let mut buf = Vec::new();
        buf.extend_from_slice(&DISC_BET_EXITED);
        buf.extend_from_slice(&pubkey32(3));
        buf.extend_from_slice(&pubkey32(4));
        buf.push(1u8);
        buf.extend_from_slice(&(999_u64).to_le_bytes());

        let events = parse_logs(&[line(&buf)]);
        match &events[0] {
            Event::BetExited { side, amount, .. } => {
                assert_eq!(*side, 1);
                assert_eq!(*amount, 999);
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn decodes_market_instantiated() {
        let mut buf = Vec::new();
        buf.extend_from_slice(&DISC_MARKET_INSTANTIATED);
        buf.extend_from_slice(&pubkey32(9));
        buf.extend_from_slice(&(42_u32).to_le_bytes());
        buf.extend_from_slice(&(1_700_000_000_i64).to_le_bytes());
        buf.extend_from_slice(&(1_700_003_600_i64).to_le_bytes());
        buf.extend_from_slice(&(500_i32).to_le_bytes());
        buf.extend_from_slice(&pubkey32(10));

        let events = parse_logs(&[line(&buf)]);
        match &events[0] {
            Event::MarketInstantiated { source_id, close_time, settlement_time, threshold_bps, .. } => {
                assert_eq!(*source_id, 42);
                assert_eq!(*close_time, 1_700_000_000);
                assert_eq!(*settlement_time, 1_700_003_600);
                assert_eq!(*threshold_bps, 500);
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn decodes_market_closed() {
        let mut buf = Vec::new();
        buf.extend_from_slice(&DISC_MARKET_CLOSED);
        buf.extend_from_slice(&pubkey32(5));
        buf.extend_from_slice(&(u128::MAX).to_le_bytes());

        let events = parse_logs(&[line(&buf)]);
        match &events[0] {
            Event::MarketClosed { baseline_price, .. } => {
                assert_eq!(*baseline_price, u128::MAX);
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn decodes_market_resolved() {
        let mut buf = Vec::new();
        buf.extend_from_slice(&DISC_MARKET_RESOLVED);
        buf.extend_from_slice(&pubkey32(7));
        buf.extend_from_slice(&(1_000_u128).to_le_bytes());
        buf.extend_from_slice(&(2_000_u128).to_le_bytes());
        buf.push(1u8);  // outcome_yes = true
        buf.push(0u8);  // force_resolved = false

        let events = parse_logs(&[line(&buf)]);
        match &events[0] {
            Event::MarketResolved { baseline_price, final_price, outcome_yes, force_resolved, .. } => {
                assert_eq!(*baseline_price, 1_000);
                assert_eq!(*final_price, 2_000);
                assert!(*outcome_yes);
                assert!(!*force_resolved);
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn decodes_claimed() {
        let mut buf = Vec::new();
        buf.extend_from_slice(&DISC_CLAIMED);
        buf.extend_from_slice(&pubkey32(6));
        buf.extend_from_slice(&pubkey32(7));
        buf.extend_from_slice(&(10_000_u64).to_le_bytes());
        buf.extend_from_slice(&(100_u64).to_le_bytes());
        buf.push(0u8);

        let events = parse_logs(&[line(&buf)]);
        match &events[0] {
            Event::Claimed { net, fee, stranded, .. } => {
                assert_eq!(*net, 10_000);
                assert_eq!(*fee, 100);
                assert!(!*stranded);
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn ignores_non_event_lines_and_unknown_discriminators() {
        let unknown_disc = [0u8; 8];
        let mut buf = Vec::new();
        buf.extend_from_slice(&unknown_disc);
        buf.extend_from_slice(&[0u8; 64]);

        let events = parse_logs(&[
            "Program DQwMnwQG...invoke [1]".to_string(),
            line(&buf),                                   // unknown discriminator
            "Program log: some log message".to_string(),
            "Program DQwMnwQG...success".to_string(),
        ]);
        assert!(events.is_empty());
    }

    #[test]
    fn parses_multiple_events_in_one_tx() {
        // A transaction may emit multiple events — e.g., a MarketInstantiated
        // followed by a BetPlaced on the same place_bet call.
        let mut inst = Vec::new();
        inst.extend_from_slice(&DISC_MARKET_INSTANTIATED);
        inst.extend_from_slice(&pubkey32(1));
        inst.extend_from_slice(&(1_u32).to_le_bytes());
        inst.extend_from_slice(&(1_700_000_000_i64).to_le_bytes());
        inst.extend_from_slice(&(1_700_003_600_i64).to_le_bytes());
        inst.extend_from_slice(&(500_i32).to_le_bytes());
        inst.extend_from_slice(&pubkey32(2));

        let mut bet = Vec::new();
        bet.extend_from_slice(&DISC_BET_PLACED);
        bet.extend_from_slice(&pubkey32(1));
        bet.extend_from_slice(&pubkey32(2));
        bet.push(0u8);
        bet.extend_from_slice(&(500_u64).to_le_bytes());

        let events = parse_logs(&[line(&inst), line(&bet)]);
        assert_eq!(events.len(), 2);
        assert!(matches!(events[0], Event::MarketInstantiated { .. }));
        assert!(matches!(events[1], Event::BetPlaced { .. }));
    }
}
