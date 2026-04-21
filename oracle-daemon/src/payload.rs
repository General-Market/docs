//! Oracle payload builders — byte-for-byte mirror of `prediction-market`'s
//! `oracle::build_close_payload` / `build_resolve_payload` (MR4).
//!
//! Two 29-byte payloads, domain-tagged to prevent cross-ix replay:
//!   close:   `source_id(4) || close_time(8) || baseline_price(16) || TAG_CLOSE(1)`
//!   resolve: `source_id(4) || settlement_time(8) || final_price(16) || TAG_RESOLVE(2)`
//!
//! Drift between the daemon and the program here is the worst failure mode
//! short of unbacked shares. Golden-vector tests cross-check our bytes
//! against the program's own builders.

pub const TAG_CLOSE: u8 = 1;
pub const TAG_RESOLVE: u8 = 2;
pub const PAYLOAD_LEN: usize = 4 + 8 + 16 + 1;

pub fn build_close_payload(
    source_id: u32,
    close_time: i64,
    baseline_price: u128,
) -> [u8; PAYLOAD_LEN] {
    build(source_id, close_time, baseline_price, TAG_CLOSE)
}

pub fn build_resolve_payload(
    source_id: u32,
    settlement_time: i64,
    final_price: u128,
) -> [u8; PAYLOAD_LEN] {
    build(source_id, settlement_time, final_price, TAG_RESOLVE)
}

fn build(source_id: u32, ts: i64, price: u128, tag: u8) -> [u8; PAYLOAD_LEN] {
    let mut out = [0u8; PAYLOAD_LEN];
    out[0..4].copy_from_slice(&source_id.to_le_bytes());
    out[4..12].copy_from_slice(&ts.to_le_bytes());
    out[12..28].copy_from_slice(&price.to_le_bytes());
    out[28] = tag;
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use prediction_market::oracle as program_oracle;

    #[test]
    fn close_payload_matches_program_builder() {
        let tuples = [
            (0u32, 0i64, 0u128),
            (7, 1_700_000_000, 1_000_000_000_000_000_000u128),
            (u32::MAX, i64::MIN, u128::MAX),
            (42, i64::MAX, 1u128),
        ];
        for (src, ts, price) in tuples {
            let ours = build_close_payload(src, ts, price);
            let theirs = program_oracle::build_close_payload(src, ts, price);
            assert_eq!(&ours[..], &theirs[..], "close payload mismatch for {src}/{ts}/{price}");
            assert_eq!(ours[28], program_oracle::TAG_CLOSE);
        }
    }

    #[test]
    fn resolve_payload_matches_program_builder() {
        let tuples = [
            (0u32, 0i64, 0u128),
            (7, 1_700_000_300, 1_010_000_000_000_000_000u128),
            (1, -1, u128::MAX),
            (u32::MAX, i64::MAX, 12345u128),
        ];
        for (src, ts, price) in tuples {
            let ours = build_resolve_payload(src, ts, price);
            let theirs = program_oracle::build_resolve_payload(src, ts, price);
            assert_eq!(&ours[..], &theirs[..], "resolve payload mismatch for {src}/{ts}/{price}");
            assert_eq!(ours[28], program_oracle::TAG_RESOLVE);
        }
    }

    #[test]
    fn close_and_resolve_payloads_differ_by_tag_only() {
        let close = build_close_payload(7, 1_700_000_000, 123);
        let resolve = build_resolve_payload(7, 1_700_000_000, 123);
        assert_eq!(&close[..28], &resolve[..28]);
        assert_ne!(close[28], resolve[28]);
    }

    #[test]
    fn golden_vector_close() {
        // Hand-computed, cross-verified against Python's int.to_bytes(...,'little'):
        //   source_id=7                     → 07 00 00 00
        //   close_time=1_700_000_000        → 00 F1 53 65 00 00 00 00
        //   baseline_price=1e18 (as u128)   → 00 00 64 A7 B3 B6 E0 0D 00 00 00 00 00 00 00 00
        //   tag=TAG_CLOSE                   → 01
        let got = build_close_payload(7, 1_700_000_000, 1_000_000_000_000_000_000);
        let expected: [u8; 29] = [
            0x07, 0x00, 0x00, 0x00,
            0x00, 0xF1, 0x53, 0x65, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x64, 0xA7, 0xB3, 0xB6, 0xE0, 0x0D,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x01,
        ];
        assert_eq!(got, expected);
    }
}
