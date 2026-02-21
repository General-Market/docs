//! Shared ticker watchlist for per-ticker EDGAR/FINRA feeds.
//!
//! 50 securities tracked across multiple daily data sources.
//! Each entry: (ticker, asset_suffix, company_name)

/// 50 securities tracked across per-ticker EDGAR/FINRA feeds
pub const TRACKED_TICKERS: &[(&str, &str, &str)] = &[
    // Original 25 from FINRA short interest
    ("GME", "gme", "GameStop"),
    ("AMC", "amc", "AMC Entertainment"),
    ("TSLA", "tsla", "Tesla"),
    ("AAPL", "aapl", "Apple"),
    ("NVDA", "nvda", "NVIDIA"),
    ("MSFT", "msft", "Microsoft"),
    ("AMZN", "amzn", "Amazon"),
    ("META", "meta", "Meta Platforms"),
    ("GOOGL", "googl", "Alphabet"),
    ("RIVN", "rivn", "Rivian"),
    ("LCID", "lcid", "Lucid Motors"),
    ("NIO", "nio", "NIO"),
    ("MRNA", "mrna", "Moderna"),
    ("BNTX", "bntx", "BioNTech"),
    ("COIN", "coin", "Coinbase"),
    ("HOOD", "hood", "Robinhood"),
    ("SOFI", "sofi", "SoFi"),
    ("CVNA", "cvna", "Carvana"),
    ("UPST", "upst", "Upstart"),
    ("W", "w", "Wayfair"),
    ("BYND", "bynd", "Beyond Meat"),
    ("SPCE", "spce", "Virgin Galactic"),
    ("PLTR", "pltr", "Palantir"),
    ("SNOW", "snow", "Snowflake"),
    ("RBLX", "rblx", "Roblox"),
    // 25 additional mega-cap / high-interest
    ("GOOG", "goog", "Alphabet C"),
    ("NFLX", "nflx", "Netflix"),
    ("AMD", "amd", "AMD"),
    ("INTC", "intc", "Intel"),
    ("CRM", "crm", "Salesforce"),
    ("UBER", "uber", "Uber"),
    ("SQ", "sq", "Block"),
    ("SHOP", "shop", "Shopify"),
    ("ABNB", "abnb", "Airbnb"),
    ("DKNG", "dkng", "DraftKings"),
    ("MSTR", "mstr", "MicroStrategy"),
    ("ARM", "arm", "ARM Holdings"),
    ("SMCI", "smci", "Super Micro"),
    ("MARA", "mara", "Marathon Digital"),
    ("RIOT", "riot", "Riot Platforms"),
    ("IONQ", "ionq", "IonQ"),
    ("RDDT", "rddt", "Reddit"),
    ("DJT", "djt", "Trump Media"),
    ("HIMS", "hims", "Hims & Hers"),
    ("AFRM", "afrm", "Affirm"),
    ("PATH", "path", "UiPath"),
    ("U", "u", "Unity"),
    ("CRWD", "crwd", "CrowdStrike"),
    ("JPM", "jpm", "JPMorgan"),
    ("BAC", "bac", "Bank of America"),
];

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn test_ticker_count() {
        assert_eq!(TRACKED_TICKERS.len(), 50);
    }

    #[test]
    fn test_no_duplicate_tickers() {
        let tickers: HashSet<&str> = TRACKED_TICKERS.iter().map(|(t, _, _)| *t).collect();
        assert_eq!(tickers.len(), TRACKED_TICKERS.len());
    }

    #[test]
    fn test_no_duplicate_suffixes() {
        let suffixes: HashSet<&str> = TRACKED_TICKERS.iter().map(|(_, s, _)| *s).collect();
        assert_eq!(suffixes.len(), TRACKED_TICKERS.len());
    }
}
