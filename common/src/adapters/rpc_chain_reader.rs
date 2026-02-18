//! RpcChainReader — real chain adapter implementing ChainReader trait
//!
//! Uses ethers Provider<Http> to read blockchain state from an L3 Orbit node.
//! Polling-based event subscription (no WebSocket needed for L3 Orbit).

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use ethers::prelude::*;
use ethers::types::{Address, Filter, Log, H256, U256, U64};
use tracing::{debug, warn};

use crate::error::Error;
use crate::traits::{ChainEvent, ChainReader, EventFilter, EventStream};
use crate::types::{ITPCore, Issuer, LimitOrder, OrderStatus, Price, Side};

use super::abi::{IndexContract, IssuerRegistryContract};
use super::deployment_config::DeploymentConfig;

/// RPC-based chain reader for real L3 contracts
pub struct RpcChainReader {
    provider: Arc<Provider<Http>>,
    index_contract: IndexContract<Provider<Http>>,
    issuer_registry: IssuerRegistryContract<Provider<Http>>,
    index_address: Address,
    poll_interval: Duration,
}

impl RpcChainReader {
    /// Create a new RpcChainReader from a provider and deployment config
    pub fn new(
        provider: Arc<Provider<Http>>,
        deployment: &DeploymentConfig,
    ) -> Result<Self, Error> {
        let index_address = deployment.index_address()?;
        let issuer_registry_address = deployment.issuer_registry_address()?;

        let index_contract =
            IndexContract::new(index_address, provider.clone());
        let issuer_registry =
            IssuerRegistryContract::new(issuer_registry_address, provider.clone());

        Ok(Self {
            provider,
            index_contract,
            issuer_registry,
            index_address,
            poll_interval: Duration::from_millis(250),
        })
    }

    /// Get the Index contract address
    pub fn index_address(&self) -> Address {
        self.index_address
    }

    /// Convert an on-chain order tuple to our LimitOrder type
    fn convert_order(raw: (U256, Address, [u8; 32], u8, U256, U256, U256, U256, [u8; 32], U256, u8)) -> LimitOrder {
        LimitOrder {
            id: raw.0,
            user: raw.1,
            pair_id: H256::from(raw.2),
            side: match raw.3 {
                0 => Side::Buy,
                _ => Side::Sell,
            },
            amount: raw.4,
            limit_price: raw.5,
            slippage_tier: raw.6,
            deadline: raw.7,
            itp_id: H256::from(raw.8),
            timestamp: raw.9,
            status: match raw.10 {
                0 => OrderStatus::Pending,
                1 => OrderStatus::Batched,
                2 => OrderStatus::Filled,
                3 => OrderStatus::Cancelled,
                _ => OrderStatus::Pending,
            },
        }
    }

    /// Convert an on-chain ITP tuple to our ITPCore type
    fn convert_itp(raw: ([u8; 32], [u8; 32], Address, U256, U256, U256, U256, U256, U256)) -> ITPCore {
        ITPCore {
            name: H256::from(raw.0),
            symbol: H256::from(raw.1),
            creator: raw.2,
            created_at: raw.3,
            fee_rate: raw.4,
            status: raw.5,
            total_supply: raw.6,
            total_value: raw.7,
            asset_count: raw.8,
        }
    }

    /// Parse a TradeRequest event from a log entry
    fn parse_trade_request_log(log: &Log) -> Option<ChainEvent> {
        // TradeRequest has 2 indexed params (cycleNumber, pairId) and 3 non-indexed (side, amount, limitPrice)
        if log.topics.len() < 3 {
            return None;
        }

        let cycle_number = log.topics[1].into_uint().as_u64();
        let pair_id: [u8; 32] = log.topics[2].into();

        // Decode non-indexed data: (uint8 side, uint256 amount, uint256 limitPrice)
        let data = &log.data.0;
        if data.len() < 96 {
            return None;
        }

        let side = data[31]; // uint8 padded to 32 bytes
        let amount = U256::from_big_endian(&data[32..64]);
        let limit_price = U256::from_big_endian(&data[64..96]);

        let block_number = log.block_number.unwrap_or(U64::zero()).as_u64();
        let tx_hash: [u8; 32] = log.transaction_hash.unwrap_or(H256::zero()).into();
        let log_index = log.log_index.unwrap_or(U256::zero()).as_u64();

        Some(ChainEvent::TradeRequest {
            cycle_number,
            pair_id,
            side,
            amount,
            limit_price,
            block_number,
            tx_hash,
            log_index,
        })
    }

    /// Parse an AssetTradeRequest event from a log entry
    ///
    /// Event: AssetTradeRequest(uint256 indexed cycleNumber, address indexed asset, uint8 side, uint256 usdcAmount, uint256 price, address quoteToken)
    fn parse_asset_trade_request_log(log: &Log) -> Option<ChainEvent> {
        // AssetTradeRequest has 2 indexed params (cycleNumber, asset) and 4 non-indexed (side, usdcAmount, price, quoteToken)
        if log.topics.len() < 3 {
            return None;
        }

        let cycle_number = log.topics[1].into_uint().as_u64();
        // asset is an address in topic[2], right-aligned in 32 bytes
        let asset: [u8; 20] = {
            let bytes: [u8; 32] = log.topics[2].into();
            let mut addr = [0u8; 20];
            addr.copy_from_slice(&bytes[12..32]);
            addr
        };

        let data = &log.data.0;
        if data.len() < 128 {
            return None;
        }

        let side = data[31]; // uint8 padded to 32 bytes
        let usdc_amount = U256::from_big_endian(&data[32..64]);
        let price = U256::from_big_endian(&data[64..96]);
        // quoteToken: address at data[96..128], right-aligned in 32 bytes
        let quote_token: [u8; 20] = {
            let mut addr = [0u8; 20];
            addr.copy_from_slice(&data[108..128]);
            addr
        };

        let block_number = log.block_number.unwrap_or(U64::zero()).as_u64();
        let tx_hash: [u8; 32] = log.transaction_hash.unwrap_or(H256::zero()).into();
        let log_index = log.log_index.unwrap_or(U256::zero()).as_u64();

        Some(ChainEvent::AssetTradeRequest {
            cycle_number,
            asset,
            side,
            usdc_amount,
            price,
            quote_token,
            block_number,
            tx_hash,
            log_index,
        })
    }
}

#[async_trait]
impl ChainReader for RpcChainReader {
    async fn get_pending_orders(&self) -> Result<Vec<LimitOrder>, Error> {
        // Note: Real implementation would query an order enumeration function.
        // Index.sol uses getOrder(orderId) for individual lookups.
        // For now, return empty — AP monitors events, not order lists.
        Ok(vec![])
    }

    async fn get_itp(&self, itp_id: [u8; 32]) -> Result<ITPCore, Error> {
        let result = self
            .index_contract
            .get_itp(itp_id)
            .call()
            .await
            .map_err(|e| Error::ChainRead(format!("getITP call failed: {}", e)))?;
        Ok(Self::convert_itp(result))
    }

    async fn get_prices(&self) -> Result<Vec<Price>, Error> {
        // Price fetching is handled by the issuer's PriceFetcher (Story 3.13),
        // not by the AP. Return empty for now.
        Ok(vec![])
    }

    async fn get_issuer_registry(&self) -> Result<Vec<Issuer>, Error> {
        let count: U256 = self
            .issuer_registry
            .active_issuer_count()
            .call()
            .await
            .map_err(|e| Error::ChainRead(format!("activeIssuerCount call failed: {}", e)))?;

        let mut issuers = Vec::new();
        for i in 1..=count.as_u64() {
            match self
                .issuer_registry
                .get_issuer(U256::from(i))
                .call()
                .await
            {
                Ok(raw) => {
                    issuers.push(Issuer {
                        addr: raw.0,
                        ip: H256::from(raw.1),
                        bls_pubkey: raw.2,
                        registered_at: raw.3,
                        status: U256::from(raw.4),
                    });
                }
                Err(e) => {
                    warn!(code = "INFRA-001", issuer_id = i, error = %e, "Failed to load issuer, skipping");
                }
            }
        }

        Ok(issuers)
    }

    async fn subscribe_events(&self, filter: EventFilter) -> Result<EventStream, Error> {
        // Build ethers Filter for TradeRequest + AssetTradeRequest events
        // Use topic0 OR filter to match both event signatures in a single query.
        let trade_request_topic = H256::from(ethers::utils::keccak256(
            b"TradeRequest(uint256,bytes32,uint8,uint256,uint256)",
        ));
        let asset_trade_request_topic = H256::from(ethers::utils::keccak256(
            b"AssetTradeRequest(uint256,address,uint8,uint256,uint256,address)",
        ));

        let mut log_filter = Filter::new()
            .address(self.index_address)
            .topic0(vec![trade_request_topic, asset_trade_request_topic]);

        if let Some(from_block) = filter.from_block {
            log_filter = log_filter.from_block(from_block);
        }

        let provider = self.provider.clone();
        let poll_interval = self.poll_interval;
        let base_filter = log_filter;

        // Polling-based event subscription for L3 Orbit
        // NOTE: No reorg protection — if L3 reorgs, events in already-processed blocks may be
        // missed or duplicated. For L3 Orbit this is rare, but a production hardening pass should
        // add confirmation-depth lag or dedup to guard against shallow reorgs.
        let stream = async_stream::stream! {
            let mut current_from_block = filter.from_block.unwrap_or(0);
            loop {
                // Query latest block
                let latest = match provider.get_block_number().await {
                    Ok(n) => n.as_u64(),
                    Err(e) => {
                        warn!(code = "INFRA-001", error = %e, "Failed to get latest block");
                        tokio::time::sleep(poll_interval).await;
                        continue;
                    }
                };

                if current_from_block > latest {
                    tokio::time::sleep(poll_interval).await;
                    continue;
                }

                let query = base_filter.clone()
                    .from_block(current_from_block)
                    .to_block(latest);

                match provider.get_logs(&query).await {
                    Ok(logs) => {
                        for log in logs {
                            // Dispatch based on topic[0]
                            if log.topics.first() == Some(&trade_request_topic) {
                                if let Some(event) = RpcChainReader::parse_trade_request_log(&log) {
                                    yield Ok(event);
                                }
                            } else if log.topics.first() == Some(&asset_trade_request_topic) {
                                if let Some(event) = RpcChainReader::parse_asset_trade_request_log(&log) {
                                    yield Ok(event);
                                }
                            }
                        }
                        current_from_block = latest + 1;
                    }
                    Err(e) => {
                        debug!(error = %e, "eth_getLogs poll error, retrying");
                        tokio::time::sleep(poll_interval).await;
                        continue;
                    }
                }

                tokio::time::sleep(poll_interval).await;
            }
        };

        Ok(Box::pin(stream))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::{Bytes, Log, H256, U256, U64};

    #[test]
    fn test_parse_trade_request_log() {
        // Build a synthetic log matching TradeRequest event
        let trade_request_topic = H256::from(ethers::utils::keccak256(
            b"TradeRequest(uint256,bytes32,uint8,uint256,uint256)",
        ));
        let cycle_number = H256::from_low_u64_be(42);
        let pair_id = H256::from([1u8; 32]);

        // Non-indexed data: side=0 (Buy), amount=1000, limitPrice=50
        let mut data = vec![0u8; 96];
        data[31] = 0; // side = Buy
        U256::from(1000).to_big_endian(&mut data[32..64]);
        U256::from(50).to_big_endian(&mut data[64..96]);

        let log = Log {
            address: Address::zero(),
            topics: vec![trade_request_topic, cycle_number, pair_id],
            data: Bytes::from(data),
            block_hash: Some(H256::zero()),
            block_number: Some(U64::from(100)),
            transaction_hash: Some(H256::from([2u8; 32])),
            transaction_index: Some(U64::from(0)),
            log_index: Some(U256::from(5)),
            transaction_log_index: None,
            log_type: None,
            removed: Some(false),
        };

        let event = RpcChainReader::parse_trade_request_log(&log).unwrap();

        match event {
            ChainEvent::TradeRequest {
                cycle_number,
                pair_id,
                side,
                amount,
                limit_price,
                block_number,
                log_index,
                ..
            } => {
                assert_eq!(cycle_number, 42);
                assert_eq!(pair_id, [1u8; 32]);
                assert_eq!(side, 0);
                assert_eq!(amount, U256::from(1000));
                assert_eq!(limit_price, U256::from(50));
                assert_eq!(block_number, 100);
                assert_eq!(log_index, 5);
            }
            _ => panic!("Expected TradeRequest event"),
        }
    }

    #[test]
    fn test_parse_trade_request_log_insufficient_topics() {
        let log = Log {
            address: Address::zero(),
            topics: vec![H256::zero()], // Only 1 topic, need 3
            data: Bytes::from(vec![0u8; 96]),
            block_hash: None,
            block_number: None,
            transaction_hash: None,
            transaction_index: None,
            log_index: None,
            transaction_log_index: None,
            log_type: None,
            removed: None,
        };

        assert!(RpcChainReader::parse_trade_request_log(&log).is_none());
    }

    #[test]
    fn test_parse_trade_request_log_insufficient_data() {
        let log = Log {
            address: Address::zero(),
            topics: vec![H256::zero(), H256::zero(), H256::zero()],
            data: Bytes::from(vec![0u8; 32]), // Only 32 bytes, need 96
            block_hash: None,
            block_number: None,
            transaction_hash: None,
            transaction_index: None,
            log_index: None,
            transaction_log_index: None,
            log_type: None,
            removed: None,
        };

        assert!(RpcChainReader::parse_trade_request_log(&log).is_none());
    }

    #[test]
    fn test_convert_order() {
        let raw = (
            U256::from(1),                // id
            Address::zero(),              // user
            [2u8; 32],                    // pairId
            0u8,                          // side (Buy)
            U256::from(1000),             // amount
            U256::from(50),               // limitPrice
            U256::from(1),                // slippageTier
            U256::from(u64::MAX),         // deadline
            [3u8; 32],                    // itpId
            U256::from(1234567890u64),    // timestamp
            0u8,                          // status (Pending)
        );

        let order = RpcChainReader::convert_order(raw);
        assert_eq!(order.id, U256::from(1));
        assert_eq!(order.side, Side::Buy);
        assert_eq!(order.amount, U256::from(1000));
        assert_eq!(order.status, OrderStatus::Pending);
    }

    #[test]
    fn test_convert_itp() {
        let raw = (
            [1u8; 32],                   // name
            [2u8; 32],                   // symbol
            Address::zero(),             // creator
            U256::from(1000),            // createdAt
            U256::from(100),             // feeRate
            U256::from(0),               // status (Active)
            U256::from(1000000),         // totalSupply
            U256::from(2000000),         // totalValue
            U256::from(5),               // assetCount
        );

        let itp = RpcChainReader::convert_itp(raw);
        assert_eq!(itp.name, H256::from([1u8; 32]));
        assert_eq!(itp.status, U256::from(0));
        assert_eq!(itp.asset_count, U256::from(5));
    }
}
