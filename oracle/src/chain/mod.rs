//! Chain interaction module for the Issuer node
//!
//! Provides implementations for reading from and writing to the blockchain.
//! - `EthersChainReader` - reads blockchain state (Story 3.2)
//! - `EthersChainWriter` - submits transactions (Story 3.3)
//! - `SettlementChainReader` - reads BridgeProxy events from Settlement chain (Story 6.21)
//! - `events` - cross-chain event parsing (Story 6.21)
//!
//! Both use ethers-rs to interact with the Index L3 chain.

pub mod data_node_settlement_reader;
pub mod settlement_reader;
pub mod settlement_trait;
pub mod settlement_writer;
pub mod custody_writer;
pub mod events;
mod gas;
mod nonce;
mod reader;
mod retry;
mod writer;

pub use settlement_reader::{
    SettlementChainReader, SettlementChainReaderConfig, SettlementReaderError,
};
pub use data_node_settlement_reader::DataNodeSettlementReader;
pub use settlement_trait::{SettlementOrderReader, SettlementReader};
pub use settlement_writer::{SettlementChainWriter, SettlementChainWriterConfig, SettlementWriterError};
pub use custody_writer::{CustodyWriter, CustodyWriterConfig, CustodyWriterError};
pub use events::{
    CrossChainOrder, CrossChainOrderData, CrossChainOrderEvent, CrossChainOrderParseError,
    CrossChainSellOrderEvent, cross_chain_sell_order_topic,
    cross_chain_event_into_full_order, cross_chain_order_dedup_key,
    cross_chain_order_has_suspicious_amount, cross_chain_order_is_expired,
    cross_chain_order_is_expired_at, cross_chain_order_log_if_expired,
    cross_chain_order_log_if_suspicious_amount, cross_chain_order_validate,
    cross_chain_order_validate_at, parse_cross_chain_order_event,
    parse_cross_chain_sell_order_event,
    ItpCreatedEvent, ItpCreationRequest, ParseError, ValidationError,
    parse_create_itp_requested, parse_itp_created, validate_itp_creation_request,
    RebalanceRequestedEvent, RebalanceParseError, parse_rebalance_requested,
    CREATE_ITP_REQUESTED_SIGNATURE, CROSS_CHAIN_ORDER_CREATED_SIGNATURE,
    CROSS_CHAIN_SELL_ORDER_CREATED_SIGNATURE,
    ITP_CREATED_SIGNATURE, MAX_ASSETS, MAX_NAME_LENGTH, MAX_SYMBOL_LENGTH, MIN_WEIGHT, WEIGHT_SUM,
};
pub use gas::{GasConfig, GasEstimator, GasPriceResult};
pub use nonce::NonceManager;
pub use reader::{ChainReaderConfig, ContractAddresses, EthersChainReader};
pub use retry::{is_retryable_error, with_retry, RetryConfig, RetryError};
pub use writer::{ChainWriterConfig, EthersChainWriter, WriterContractAddresses};
