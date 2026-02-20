//! Market data provider implementations (12 providers)

pub mod bls;
pub mod congress;
pub mod ecb;
pub mod eia;
pub mod finnhub;
pub mod finra;
pub mod fred;
pub mod nasdaq;
pub mod openmeteo;
pub mod sec_edgar;
pub mod treasury;
pub mod worldbank;

pub use bls::BlsMarketSource;
pub use congress::CongressMarketSource;
pub use ecb::EcbMarketSource;
pub use eia::EiaMarketSource;
pub use finnhub::FinnhubClient as FinnhubMarketSource;
pub use finra::FinraMarketSource;
pub use fred::FredMarketSource;
pub use nasdaq::{BchainMarketSource, CftcMarketSource, ChrisMarketSource, ImfMarketSource, OpecMarketSource};
pub use openmeteo::OpenMeteoMarketSource;
pub use sec_edgar::SecEdgarMarketSource;
pub use treasury::TreasuryMarketSource;
pub use worldbank::WorldBankMarketSource;
