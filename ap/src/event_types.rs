//! Event type definitions for AP event monitoring
//!
//! Structs match Solidity event signatures from EventsLib.sol.

use common::types::Side;
use ethers::types::{H256, U256};
use serde::{Deserialize, Serialize};

use crate::error::APError;

/// TradeRequest event from Index.sol
///
/// Event signature: `TradeRequest(uint256 indexed cycleNumber, bytes32 indexed pairId, uint8 side, uint256 amount, uint256 limitPrice)`
///
/// Topic0: keccak256("TradeRequest(uint256,bytes32,uint8,uint256,uint256)")
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TradeRequestEvent {
    /// Cycle number requesting the trade (indexed)
    pub cycle_number: u64,
    /// Asset pair identifier (indexed)
    pub pair_id: H256,
    /// Trade side: 0=BUY, 1=SELL
    pub side: Side,
    /// Amount to trade in USDC (18 decimals)
    pub amount: U256,
    /// Limit price for the trade (18 decimals)
    pub limit_price: U256,
    /// Block number where event was emitted
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: H256,
    /// Log index within the block
    pub log_index: u64,
}

impl TradeRequestEvent {
    /// Event topic hash: keccak256("TradeRequest(uint256,bytes32,uint8,uint256,uint256)")
    /// Computed via: cast keccak "TradeRequest(uint256,bytes32,uint8,uint256,uint256)"
    /// = 0xce1d92007c417e020617618635f2cb188a383de2632e89e67197ccff2776360a
    pub const TOPIC: [u8; 32] = [
        0xce, 0x1d, 0x92, 0x00, 0x7c, 0x41, 0x7e, 0x02,
        0x06, 0x17, 0x61, 0x86, 0x35, 0xf2, 0xcb, 0x18,
        0x8a, 0x38, 0x3d, 0xe2, 0x63, 0x2e, 0x89, 0xe6,
        0x71, 0x97, 0xcc, 0xff, 0x27, 0x76, 0x36, 0x0a,
    ];

    /// Parse TradeRequestEvent from raw log data
    ///
    /// # Arguments
    /// * `topics` - Log topics (topic0 is event signature, topic1 is cycleNumber, topic2 is pairId)
    /// * `data` - ABI-encoded non-indexed parameters (side, amount, limitPrice)
    /// * `block_number` - Block where event was emitted
    /// * `tx_hash` - Transaction hash
    /// * `log_index` - Log index within block
    pub fn from_log(
        topics: &[H256],
        data: &[u8],
        block_number: u64,
        tx_hash: H256,
        log_index: u64,
    ) -> Result<Self, APError> {
        // Validate we have enough topics
        if topics.len() < 3 {
            return Err(APError::EventParse(format!(
                "TradeRequest requires 3 topics, got {}",
                topics.len()
            )));
        }

        // Validate data length (side: 32 bytes, amount: 32 bytes, limitPrice: 32 bytes = 96 bytes)
        if data.len() < 96 {
            return Err(APError::EventParse(format!(
                "TradeRequest data too short: expected 96 bytes, got {}",
                data.len()
            )));
        }

        // topic[1] = cycleNumber (indexed)
        let cycle_number = topics[1].to_low_u64_be();

        // topic[2] = pairId (indexed)
        let pair_id = topics[2];

        // data[0..32] = side (u8 padded to 32 bytes)
        let side_byte = data[31]; // Last byte of first 32-byte word
        let side = Side::try_from_u8(side_byte).map_err(|e| {
            APError::EventParse(format!("Invalid side value: {}", e))
        })?;

        // data[32..64] = amount
        let amount = U256::from_big_endian(&data[32..64]);

        // data[64..96] = limitPrice
        let limit_price = U256::from_big_endian(&data[64..96]);

        Ok(Self {
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

    /// Generate unique identifier for deduplication
    pub fn event_id(&self) -> String {
        format!(
            "{}:{}:{}",
            self.block_number,
            self.tx_hash,
            self.log_index
        )
    }

    /// Construct from parsed chain event fields (ChainEvent -> TradeRequestEvent)
    ///
    /// Single construction path for converting ChainEvent variants into typed events.
    pub fn from_chain_fields(
        cycle_number: u64,
        pair_id: [u8; 32],
        side: u8,
        amount: U256,
        limit_price: U256,
        block_number: u64,
        tx_hash: [u8; 32],
        log_index: u64,
    ) -> Result<Self, APError> {
        Ok(Self {
            cycle_number,
            pair_id: H256::from(pair_id),
            side: Side::try_from_u8(side).map_err(|e| {
                APError::EventParse(format!("Invalid side: {}", e))
            })?,
            amount,
            limit_price,
            block_number,
            tx_hash: H256::from(tx_hash),
            log_index,
        })
    }
}

/// AssetTradeRequest event from Index.sol (issuer-driven per-asset trades)
///
/// Event signature: `AssetTradeRequest(uint256 indexed cycleNumber, address indexed asset, uint8 side, uint256 usdcAmount, uint256 price, address quoteToken)`
///
/// Emitted after issuers decompose ITP orders into per-asset amounts and net across all ITPs.
/// AP monitors this to execute one vault trade per asset — no on-chain state reads needed.
/// quoteToken tells the AP which token to settle against (USDC or USDT).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetTradeRequestEvent {
    /// Cycle number (indexed)
    pub cycle_number: u64,
    /// Asset token address (indexed)
    pub asset: [u8; 20],
    /// Trade side: 0=BUY, 1=SELL (per-asset after cross-ITP netting)
    pub side: u8,
    /// Net USDC amount for this asset (18 decimals)
    pub usdc_amount: U256,
    /// Asset price used for decomposition (18 decimals)
    pub price: U256,
    /// Quote token for settlement (USDC or USDT; all-zeros = default USDC)
    pub quote_token: [u8; 20],
    /// Block number where event was emitted
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: H256,
    /// Log index within the block
    pub log_index: u64,
}

impl AssetTradeRequestEvent {
    /// Event topic hash: keccak256("AssetTradeRequest(uint256,address,uint8,uint256,uint256,address)")
    pub fn topic() -> [u8; 32] {
        use ethers::utils::keccak256;
        keccak256("AssetTradeRequest(uint256,address,uint8,uint256,uint256,address)")
    }

    /// Parse AssetTradeRequestEvent from raw log data
    pub fn from_log(
        topics: &[H256],
        data: &[u8],
        block_number: u64,
        tx_hash: H256,
        log_index: u64,
    ) -> Result<Self, APError> {
        if topics.len() < 3 {
            return Err(APError::EventParse(format!(
                "AssetTradeRequest requires 3 topics, got {}",
                topics.len()
            )));
        }

        if data.len() < 128 {
            return Err(APError::EventParse(format!(
                "AssetTradeRequest data too short: expected 128 bytes, got {}",
                data.len()
            )));
        }

        let cycle_number = topics[1].to_low_u64_be();

        // topic[2] = address (right-aligned in 32 bytes)
        let asset: [u8; 20] = {
            let bytes: [u8; 32] = topics[2].into();
            let mut addr = [0u8; 20];
            addr.copy_from_slice(&bytes[12..32]);
            addr
        };

        let side = data[31];
        let usdc_amount = U256::from_big_endian(&data[32..64]);
        let price = U256::from_big_endian(&data[64..96]);
        // quoteToken: address at data[96..128], right-aligned in 32 bytes
        let quote_token: [u8; 20] = {
            let mut addr = [0u8; 20];
            addr.copy_from_slice(&data[108..128]);
            addr
        };

        Ok(Self {
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

    /// Generate unique identifier for deduplication
    pub fn event_id(&self) -> String {
        format!(
            "{}:{}:{}",
            self.block_number,
            self.tx_hash,
            self.log_index
        )
    }

    /// Construct from parsed chain event fields
    pub fn from_chain_fields(
        cycle_number: u64,
        asset: [u8; 20],
        side: u8,
        usdc_amount: U256,
        price: U256,
        quote_token: [u8; 20],
        block_number: u64,
        tx_hash: [u8; 32],
        log_index: u64,
    ) -> Self {
        Self {
            cycle_number,
            asset,
            side,
            usdc_amount,
            price,
            quote_token,
            block_number,
            tx_hash: H256::from(tx_hash),
            log_index,
        }
    }
}

/// WithdrawalRequest event (placeholder - event not yet defined in contracts)
///
/// This is a placeholder for when the WithdrawalRequest event is added to EventsLib.sol.
/// The AP will need to monitor this to push withdrawals to CEX.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WithdrawalRequestEvent {
    /// ITP requesting the withdrawal
    pub itp_id: H256,
    /// Amount to withdraw (18 decimals)
    pub amount: U256,
    /// Destination address
    pub destination: [u8; 20],
    /// Block number where event was emitted
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: H256,
    /// Log index within the block
    pub log_index: u64,
}

impl WithdrawalRequestEvent {
    /// Event topic hash: placeholder zero bytes — stays this way until the contract
    /// defines the WithdrawalRequest event in EventsLib.sol with a real signature.
    pub const TOPIC: [u8; 32] = [0u8; 32];

    /// Parse WithdrawalRequestEvent from raw log data
    ///
    /// # Note
    /// Currently returns error as the event is not yet defined in contracts.
    pub fn from_log(
        _topics: &[H256],
        _data: &[u8],
        _block_number: u64,
        _tx_hash: H256,
        _log_index: u64,
    ) -> Result<Self, APError> {
        Err(APError::EventParse(
            "WithdrawalRequest event not yet defined in contracts".to_string(),
        ))
    }

    /// Generate unique identifier for deduplication
    pub fn event_id(&self) -> String {
        format!(
            "{}:{}:{}",
            self.block_number,
            self.tx_hash,
            self.log_index
        )
    }

    /// Construct from parsed chain event fields (ChainEvent -> WithdrawalRequestEvent)
    pub fn from_chain_fields(
        itp_id: [u8; 32],
        amount: U256,
        destination: [u8; 20],
        block_number: u64,
        tx_hash: [u8; 32],
        log_index: u64,
    ) -> Self {
        Self {
            itp_id: H256::from(itp_id),
            amount,
            destination,
            block_number,
            tx_hash: H256::from(tx_hash),
            log_index,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::utils::keccak256;

    #[test]
    fn test_topic_hash_is_correct() {
        // Verify the hardcoded TOPIC matches keccak256 of the event signature
        let computed = keccak256("TradeRequest(uint256,bytes32,uint8,uint256,uint256)");
        assert_eq!(
            TradeRequestEvent::TOPIC,
            computed,
            "TradeRequestEvent::TOPIC does not match computed keccak256 hash"
        );
    }

    #[test]
    fn test_trade_request_parsing() {
        // Create test data
        let mut topics = vec![H256::zero(); 3];
        topics[1] = H256::from_low_u64_be(42); // cycleNumber = 42
        topics[2] = H256::random(); // pairId

        // Encode data: side(0=BUY), amount(1000e18), limitPrice(50e18)
        let mut data = vec![0u8; 96];
        data[31] = 0; // side = BUY
        let amount = U256::from(1000u64) * U256::exp10(18);
        amount.to_big_endian(&mut data[32..64]);
        let limit_price = U256::from(50u64) * U256::exp10(18);
        limit_price.to_big_endian(&mut data[64..96]);

        let tx_hash = H256::random();
        let event = TradeRequestEvent::from_log(&topics, &data, 100, tx_hash, 5).unwrap();

        assert_eq!(event.cycle_number, 42);
        assert_eq!(event.pair_id, topics[2]);
        assert_eq!(event.side, Side::Buy);
        assert_eq!(event.amount, amount);
        assert_eq!(event.limit_price, limit_price);
        assert_eq!(event.block_number, 100);
        assert_eq!(event.tx_hash, tx_hash);
        assert_eq!(event.log_index, 5);
    }

    #[test]
    fn test_trade_request_sell_side() {
        let mut topics = vec![H256::zero(); 3];
        topics[1] = H256::from_low_u64_be(1);
        topics[2] = H256::random();

        let mut data = vec![0u8; 96];
        data[31] = 1; // side = SELL

        let event = TradeRequestEvent::from_log(&topics, &data, 1, H256::zero(), 0).unwrap();
        assert_eq!(event.side, Side::Sell);
    }

    #[test]
    fn test_trade_request_invalid_side() {
        let topics = vec![H256::zero(); 3];
        let mut data = vec![0u8; 96];
        data[31] = 5; // Invalid side value

        let result = TradeRequestEvent::from_log(&topics, &data, 1, H256::zero(), 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid side"));
    }

    #[test]
    fn test_trade_request_insufficient_topics() {
        let topics = vec![H256::zero(); 2]; // Only 2 topics
        let data = vec![0u8; 96];

        let result = TradeRequestEvent::from_log(&topics, &data, 1, H256::zero(), 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("requires 3 topics"));
    }

    #[test]
    fn test_trade_request_insufficient_data() {
        let topics = vec![H256::zero(); 3];
        let data = vec![0u8; 64]; // Only 64 bytes

        let result = TradeRequestEvent::from_log(&topics, &data, 1, H256::zero(), 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("data too short"));
    }

    #[test]
    fn test_event_id_uniqueness() {
        let topics = vec![H256::zero(); 3];
        let data = vec![0u8; 96];

        let event1 = TradeRequestEvent::from_log(&topics, &data, 100, H256::zero(), 0).unwrap();
        let event2 = TradeRequestEvent::from_log(&topics, &data, 100, H256::zero(), 1).unwrap();
        let event3 = TradeRequestEvent::from_log(&topics, &data, 101, H256::zero(), 0).unwrap();

        assert_ne!(event1.event_id(), event2.event_id());
        assert_ne!(event1.event_id(), event3.event_id());
        assert_ne!(event2.event_id(), event3.event_id());
    }
}
