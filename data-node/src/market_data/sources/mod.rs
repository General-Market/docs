//! Market data provider implementations (17 providers)

pub mod bls;
pub mod congress;
pub mod ecb;
pub mod eia;
pub mod finnhub;
pub mod finra;
pub mod finra_short_vol;
pub mod fred;
pub mod nasdaq;
pub mod openmeteo;
pub mod polymarket;
pub mod sec_edgar;
pub mod sec_efts;
pub mod sec_insider;
pub mod tracked_tickers;
pub mod treasury;
pub mod twitch;
pub mod worldbank;

pub use bls::BlsMarketSource;
pub use congress::CongressMarketSource;
pub use ecb::EcbMarketSource;
pub use eia::EiaMarketSource;
pub use finnhub::FinnhubClient as FinnhubMarketSource;
pub use finra::FinraMarketSource;
pub use finra_short_vol::FinraShortVolMarketSource;
pub use fred::FredMarketSource;
pub use nasdaq::{BchainMarketSource, CftcMarketSource, ChrisMarketSource, ImfMarketSource, OpecMarketSource};
pub use openmeteo::OpenMeteoMarketSource;
pub use polymarket::PolymarketSource;
pub use sec_edgar::SecEdgarMarketSource;
pub use sec_efts::SecEftsMarketSource;
pub use sec_insider::SecInsiderMarketSource;
pub use treasury::TreasuryMarketSource;
pub use twitch::TwitchSource;
pub use worldbank::WorldBankMarketSource;
