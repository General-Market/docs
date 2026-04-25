//! Per-pair PvP markets.
//!
//! 25 hand-curated head-to-head pairs spanning two boards (Stars / Cams)
//! and two formats (F1 gain race / F2 viewer total). Source of truth is
//! `data-node/data/tube-rate-tests/MARKETS_PVP_25.md`. Anything that
//! changes here must change there first.
//!
//! Each `PairSpec` resolves to one Postgres `(source, asset_id)` row per
//! side. Stars come from `market_prices` rows where
//! `source = 'tubes'` and `asset_id = format!("tubes_xvideos_star_{slug}")`.
//! Cams come from `source = 'chaturbate'`, `asset_id = format!("cb_model_{user}")`.
//! See `data-node/src/api.rs::source_id_to_tube` for the inverse mapping.

/// Which board a pair belongs to.
///
/// The board determines the window length, the format set, and the
/// `(source, asset_id)` shape used to look up observations.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Board {
    Stars,
    Cams,
}

impl Board {
    pub fn as_str(self) -> &'static str {
        match self {
            Board::Stars => "stars",
            Board::Cams => "cams",
        }
    }
}

/// Resolution format. F1 sums deltas over the window. F2 reads the closing
/// instant directly. Same fight; different question.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Format {
    /// Larger Δ over the window wins. `score = ΔA - ΔB`.
    F1GainRace,
    /// Larger absolute value at T+window wins. `score = value_a - value_b`.
    F2ViewerTotal,
}

impl Format {
    pub fn as_str(self) -> &'static str {
        match self {
            Format::F1GainRace => "f1-gain-race",
            Format::F2ViewerTotal => "f2-viewer-total",
        }
    }
}

/// A single pair entry. `slug_a` / `slug_b` are the strings appended to the
/// board-specific prefix to form the full `asset_id`.
#[derive(Debug, Clone, Copy)]
pub struct PairSpec {
    pub pair_index: u32,
    pub board: Board,
    pub format: Format,
    pub window_secs: i64,
    pub slug_a: &'static str,
    pub slug_b: &'static str,
}

impl PairSpec {
    /// `(source, asset_id_a, asset_id_b)` used to query market_prices.
    pub fn db_keys(&self) -> (&'static str, String, String) {
        match self.board {
            Board::Stars => (
                "tubes",
                format!("tubes_xvideos_star_{}", self.slug_a),
                format!("tubes_xvideos_star_{}", self.slug_b),
            ),
            Board::Cams => (
                "chaturbate",
                format!("cb_model_{}", self.slug_a),
                format!("cb_model_{}", self.slug_b),
            ),
        }
    }

    /// Cohort boundary at or before `now_secs`. Cohorts tile time deterministically:
    /// `cohort_start = floor(now / window) * window`. Both boards inherit the same rule.
    pub fn cohort_start_at(&self, now_secs: i64) -> i64 {
        (now_secs / self.window_secs) * self.window_secs
    }

    pub fn cohort_end_at(&self, now_secs: i64) -> i64 {
        self.cohort_start_at(now_secs) + self.window_secs
    }
}

/// Window lengths from the spec. Stars: 4h. Cams: 2m.
const STARS_WINDOW: i64 = 4 * 60 * 60;
const CAMS_WINDOW: i64 = 2 * 60;

/// Hardcoded pair registry. Mirrors `MARKETS_PVP_25.md` table-for-table.
/// Index 1..25, no holes, no duplicates. Editing here without editing the
/// spec is a contract violation — keep them in lockstep.
pub const PAIR_REGISTRY: &[PairSpec] = &[
    // ---- Board 1: Stars (15 pairs, 4h, F1 only) ----
    PairSpec { pair_index: 1,  board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "carlacute3",            slug_b: "siri-dahl" },
    PairSpec { pair_index: 2,  board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "cleagaultier-official1", slug_b: "kendra-lust" },
    PairSpec { pair_index: 3,  board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "skye-young2",            slug_b: "liza-del-sierra" },
    PairSpec { pair_index: 4,  board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "hot-pearl2",             slug_b: "lia-lin" },
    PairSpec { pair_index: 5,  board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "nicole-aniston",         slug_b: "shinaryen27" },
    PairSpec { pair_index: 6,  board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "lexi-luna",              slug_b: "dani-daniels" },
    PairSpec { pair_index: 7,  board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "angela-white",           slug_b: "stacy-cruz" },
    PairSpec { pair_index: 8,  board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "natalie-cherie",         slug_b: "adriana-chechik" },
    PairSpec { pair_index: 9,  board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "luna-rival1",            slug_b: "brandi-love" },
    PairSpec { pair_index: 10, board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "alexis-texas",           slug_b: "mia-malkova" },
    PairSpec { pair_index: 11, board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "eva-elfie",              slug_b: "sharon-lee" },
    PairSpec { pair_index: 12, board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "abella-danger",          slug_b: "sweetie-fox1" },
    PairSpec { pair_index: 13, board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "lana-rhoades",           slug_b: "katty-west" },
    PairSpec { pair_index: 14, board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "riley-reid",             slug_b: "anissa-kate1" },
    PairSpec { pair_index: 15, board: Board::Stars, format: Format::F1GainRace, window_secs: STARS_WINDOW, slug_a: "gina-gerson2",           slug_b: "vale_nappi3" },

    // ---- Board 2: Cams (10 pairs, 2m, F1 + F2 alternating) ----
    PairSpec { pair_index: 16, board: Board::Cams, format: Format::F1GainRace,    window_secs: CAMS_WINDOW, slug_a: "aria_blue",     slug_b: "sasha_riot" },
    PairSpec { pair_index: 17, board: Board::Cams, format: Format::F2ViewerTotal, window_secs: CAMS_WINDOW, slug_a: "amelia_couple", slug_b: "jade_xo" },
    PairSpec { pair_index: 18, board: Board::Cams, format: Format::F1GainRace,    window_secs: CAMS_WINDOW, slug_a: "ruby_couple",   slug_b: "carmen_latina" },
    PairSpec { pair_index: 19, board: Board::Cams, format: Format::F2ViewerTotal, window_secs: CAMS_WINDOW, slug_a: "yui_asian",     slug_b: "zara_tease" },
    PairSpec { pair_index: 20, board: Board::Cams, format: Format::F1GainRace,    window_secs: CAMS_WINDOW, slug_a: "diva_milf",     slug_b: "lola_petite" },
    PairSpec { pair_index: 21, board: Board::Cams, format: Format::F2ViewerTotal, window_secs: CAMS_WINDOW, slug_a: "mona_ebony",    slug_b: "viv_french" },
    PairSpec { pair_index: 22, board: Board::Cams, format: Format::F1GainRace,    window_secs: CAMS_WINDOW, slug_a: "rhea_german",   slug_b: "elena_es" },
    PairSpec { pair_index: 23, board: Board::Cams, format: Format::F2ViewerTotal, window_secs: CAMS_WINDOW, slug_a: "nova_german",   slug_b: "nadia_trans" },
    PairSpec { pair_index: 24, board: Board::Cams, format: Format::F1GainRace,    window_secs: CAMS_WINDOW, slug_a: "kai_solo_male", slug_b: "domme_velvet" },
    PairSpec { pair_index: 25, board: Board::Cams, format: Format::F2ViewerTotal, window_secs: CAMS_WINDOW, slug_a: "mei_solo",      slug_b: "foot_mistress" },
];

pub fn lookup(pair_index: u32) -> Option<&'static PairSpec> {
    PAIR_REGISTRY.iter().find(|p| p.pair_index == pair_index)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_is_dense() {
        for i in 1..=25u32 {
            assert!(lookup(i).is_some(), "pair {i} missing");
        }
        assert_eq!(PAIR_REGISTRY.len(), 25);
    }

    #[test]
    fn no_slug_appears_twice() {
        let mut all = Vec::new();
        for p in PAIR_REGISTRY {
            all.push(p.slug_a);
            all.push(p.slug_b);
        }
        let mut sorted = all.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(sorted.len(), all.len(), "duplicate slug detected");
    }

    #[test]
    fn cohort_math_tiles_time() {
        let p = lookup(16).unwrap(); // 2-min window
        assert_eq!(p.cohort_start_at(1_777_110_540), 1_777_110_480);
        assert_eq!(p.cohort_end_at(1_777_110_540),   1_777_110_600);
    }
}
