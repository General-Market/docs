//! Chain interaction module for the Issuer node
//!
//! Provides implementations for reading from and writing to the blockchain.
//! - `EthersChainReader` - reads blockchain state (Story 3.2)
//! - `EthersChainWriter` - submits transactions (Story 3.3)
//! - `ArbitrumChainReader` - reads BridgeProxy events from Arbitrum (Story 6.21)
//! - `events` - cross-chain event parsing (Story 6.21)
//!
//! Both use ethers-rs to interact with the Index L3 chain.

pub mod arbitrum_reader;
pub mod arbitrum_writer;
pub mod custody_writer;
pub mod events;
mod gas;
mod nonce;
mod reader;
mod retry;
mod writer;

pub use arbitrum_reader::{
    ArbitrumChainReader, ArbitrumChainReaderConfig, ArbitrumReaderError, CrossChainOrderData,
};
pub use arbitrum_writer::{ArbitrumChainWriter, ArbitrumChainWriterConfig, ArbitrumWriterError};
pub use custody_writer::{CustodyWriter, CustodyWriterConfig, CustodyWriterError};
pub use events::{
    CrossChainOrder, CrossChainOrderEvent, CrossChainOrderParseError,
    CrossChainSellOrderEvent, cross_chain_sell_order_topic,
    ItpCreatedEvent, ItpCreationRequest, ParseError, ValidationError,
    CREATE_ITP_REQUESTED_SIGNATURE, CROSS_CHAIN_ORDER_CREATED_SIGNATURE,
    CROSS_CHAIN_SELL_ORDER_CREATED_SIGNATURE,
    ITP_CREATED_SIGNATURE, MAX_ASSETS, MAX_NAME_LENGTH, MAX_SYMBOL_LENGTH, MIN_WEIGHT, WEIGHT_SUM,
};
pub use gas::{GasConfig, GasEstimator, GasPriceResult};
pub use nonce::NonceManager;
pub use reader::{ChainReaderConfig, ContractAddresses, EthersChainReader};
pub use retry::{is_retryable_error, with_retry, RetryConfig, RetryError};
pub use writer::{ChainWriterConfig, EthersChainWriter, WriterContractAddresses};
