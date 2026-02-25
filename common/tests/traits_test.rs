//! Tests for trait definitions
//!
//! Verifies that traits can be implemented and used correctly.
//! These are compile-time verification tests with minimal mock implementations.

use async_trait::async_trait;
use common::{
    error::Error,
    traits::{
        APClient, BLSSigner, ChainReader, ChainWriter, EventFilter, EventStream, MessageStream,
        P2PTransport,
    },
    types::{
        BLSPublicKey, BLSSignature, Fill, ITPCore, Issuer, LimitOrder, OrderId, OrderStatus,
        P2PMessage, PeerId, PeerInfo, Price, Side, TxHash,
    },
};
use ethers::types::{Address, H256, U256};
use futures::stream;

// =============================================================================
// Mock Implementations
// =============================================================================

/// Mock implementation of ChainReader for testing
struct MockChainReader;

#[async_trait]
impl ChainReader for MockChainReader {
    async fn get_pending_orders(&self) -> Result<Vec<LimitOrder>, Error> {
        Ok(vec![LimitOrder {
            id: U256::from(1),
            user: Address::zero(),
            pair_id: H256::zero(),
            side: Side::Buy,
            amount: U256::from(1000),
            limit_price: U256::from(100),
            slippage_tier: U256::from(1),
            deadline: U256::from(1700000000),
            itp_id: H256::zero(),
            timestamp: U256::from(1699999000),
            status: OrderStatus::Pending,
        }])
    }

    async fn get_itp(&self, _itp_id: [u8; 32]) -> Result<ITPCore, Error> {
        Ok(ITPCore {
            name: H256::zero(),
            symbol: H256::zero(),
            creator: Address::zero(),
            created_at: U256::from(1699999000),
            fee_rate: U256::from(100),
            status: U256::from(1),
            total_supply: U256::from(1000000),
            total_value: U256::from(1000000),
            asset_count: U256::from(5),
        })
    }

    async fn get_prices(&self) -> Result<Vec<Price>, Error> {
        Ok(vec![Price {
            asset: Address::zero(),
            price: U256::from(1000),
            timestamp: U256::from(1699999000),
            source: U256::from(0),
        }])
    }

    async fn get_issuer_registry(&self) -> Result<Vec<Issuer>, Error> {
        Ok(vec![])
    }

    async fn subscribe_events(&self, _filter: EventFilter) -> Result<EventStream, Error> {
        Ok(Box::pin(stream::empty()))
    }
}

/// Mock implementation of ChainWriter for testing
struct MockChainWriter;

#[async_trait]
impl ChainWriter for MockChainWriter {
    async fn submit_batch(
        &self,
        _cycle_number: u64,
        _order_ids: Vec<u64>,
        _bls_signature: Vec<u8>,
        _reference_nonce: u64,
        _signers_bitmask: U256,
    ) -> Result<TxHash, Error> {
        Ok(H256::zero())
    }

    async fn confirm_fills(
        &self,
        _cycle_number: u64,
        _fills: Vec<Fill>,
        _bls_signature: Vec<u8>,
        _reference_nonce: u64,
        _signers_bitmask: U256,
    ) -> Result<TxHash, Error> {
        Ok(H256::zero())
    }

    async fn submit_bridge(
        &self,
        _dest_chain_id: u64,
        _amount: U256,
        _bls_signature: Vec<u8>,
        _reference_nonce: u64,
        _signers_bitmask: U256,
    ) -> Result<TxHash, Error> {
        Ok(H256::zero())
    }

    async fn create_itp(
        &self,
        _name: &str,
        _symbol: &str,
        _weights: &[U256],
        _assets: &[Address],
        _prices: &[U256],
        _bridge_nonce: U256,
    ) -> Result<H256, Error> {
        Ok(H256::zero())
    }

    async fn send_transaction(
        &self,
        _to: Address,
        _calldata: Vec<u8>,
        _value: U256,
    ) -> Result<TxHash, Error> {
        Ok(H256::zero())
    }
}

/// Mock implementation of BLSSigner for testing
struct MockBLSSigner;

impl BLSSigner for MockBLSSigner {
    fn sign(&self, _private_key: &[u8], _message: &[u8]) -> Result<BLSSignature, Error> {
        Ok(BLSSignature(vec![0u8; 64]))
    }

    fn aggregate_signatures(&self, _signatures: Vec<BLSSignature>) -> Result<BLSSignature, Error> {
        Ok(BLSSignature(vec![0u8; 64]))
    }

    fn verify(
        &self,
        _public_key: &BLSPublicKey,
        _message: &[u8],
        _signature: &BLSSignature,
    ) -> Result<bool, Error> {
        Ok(true)
    }
}

/// Mock implementation of P2PTransport for testing
struct MockP2PTransport;

#[async_trait]
impl P2PTransport for MockP2PTransport {
    async fn connect_peers(&self, _peers: Vec<PeerInfo>) -> Result<(), Error> {
        Ok(())
    }

    async fn broadcast(&self, _message: P2PMessage) -> Result<(), Error> {
        Ok(())
    }

    async fn send_to(&self, _peer_id: PeerId, _message: P2PMessage) -> Result<(), Error> {
        Ok(())
    }

    async fn receive(&self) -> Result<MessageStream, Error> {
        Ok(Box::pin(stream::empty()))
    }
}

/// Mock implementation of APClient for testing
struct MockAPClient;

#[async_trait]
impl APClient for MockAPClient {
    async fn place_order(
        &self,
        _pair: String,
        _side: Side,
        _amount: U256,
        _price: U256,
    ) -> Result<OrderId, Error> {
        Ok(U256::from(1))
    }

    async fn get_fills(&self, _order_id: OrderId) -> Result<Vec<Fill>, Error> {
        Ok(vec![])
    }

    async fn get_order_status(&self, _order_id: OrderId) -> Result<OrderStatus, Error> {
        Ok(OrderStatus::Pending)
    }
}

// =============================================================================
// Tests
// =============================================================================

#[tokio::test]
async fn test_chain_reader_trait() {
    let reader = MockChainReader;

    // Test get_pending_orders
    let orders = reader.get_pending_orders().await.unwrap();
    assert_eq!(orders.len(), 1);
    assert_eq!(orders[0].id, U256::from(1));
    assert_eq!(orders[0].status, OrderStatus::Pending);

    // Test get_itp
    let itp = reader.get_itp([0u8; 32]).await.unwrap();
    assert_eq!(itp.asset_count, U256::from(5));

    // Test get_prices
    let prices = reader.get_prices().await.unwrap();
    assert_eq!(prices.len(), 1);

    // Test get_issuer_registry
    let issuers = reader.get_issuer_registry().await.unwrap();
    assert!(issuers.is_empty());

    // Test subscribe_events
    let filter = EventFilter {
        address: None,
        topics: vec![],
        from_block: None,
        to_block: None,
    };
    let _stream = reader.subscribe_events(filter).await.unwrap();
}

#[tokio::test]
async fn test_chain_writer_trait() {
    let writer = MockChainWriter;

    // Test submit_batch
    let tx_hash = writer
        .submit_batch(1, vec![1, 2, 3], vec![0u8; 64])
        .await
        .unwrap();
    assert_eq!(tx_hash, H256::zero());

    // Test confirm_fills
    let tx_hash = writer
        .confirm_fills(1, vec![], vec![0u8; 64])
        .await
        .unwrap();
    assert_eq!(tx_hash, H256::zero());

    // Test submit_bridge
    let tx_hash = writer
        .submit_bridge(42161, U256::from(1000), vec![0u8; 64])
        .await
        .unwrap();
    assert_eq!(tx_hash, H256::zero());
}

#[test]
fn test_bls_signer_trait() {
    let signer = MockBLSSigner;

    // Test sign
    let signature = signer.sign(&[0u8; 32], b"test message").unwrap();
    assert_eq!(signature.0.len(), 64);

    // Test aggregate_signatures
    let aggregated = signer
        .aggregate_signatures(vec![signature.clone(), signature.clone()])
        .unwrap();
    assert_eq!(aggregated.0.len(), 64);

    // Test verify
    let pubkey = BLSPublicKey(vec![0u8; 48]);
    let is_valid = signer.verify(&pubkey, b"test message", &signature).unwrap();
    assert!(is_valid);
}

#[tokio::test]
async fn test_p2p_transport_trait() {
    let transport = MockP2PTransport;

    // Test connect_peers
    let peer = PeerInfo {
        peer_id: [0u8; 32],
        ip: "127.0.0.1".to_string(),
        port: 8080,
    };
    transport.connect_peers(vec![peer]).await.unwrap();

    // Test broadcast
    let message = P2PMessage::Heartbeat {
        sender_id: [0u8; 32],
        timestamp: 1699999000,
    };
    transport.broadcast(message.clone()).await.unwrap();

    // Test send_to
    transport.send_to([0u8; 32], message).await.unwrap();

    // Test receive
    let _stream = transport.receive().await.unwrap();
}

#[tokio::test]
async fn test_ap_client_trait() {
    let client = MockAPClient;

    // Test place_order
    let order_id = client
        .place_order(
            "BTC/USDC".to_string(),
            Side::Buy,
            U256::from(1000),
            U256::from(50000),
        )
        .await
        .unwrap();
    assert_eq!(order_id, U256::from(1));

    // Test get_fills
    let fills = client.get_fills(order_id, U256::zero()).await.unwrap();
    assert!(fills.is_empty());

    // Test get_order_status
    let status = client.get_order_status(order_id).await.unwrap();
    assert_eq!(status, OrderStatus::Pending);
}

#[test]
fn test_enum_try_from_valid() {
    use common::types::{ITPStatus, IssuerStatus, PriceSource, TxType};

    // Test valid conversions using try_from_u8
    assert_eq!(Side::try_from_u8(0).unwrap(), Side::Buy);
    assert_eq!(Side::try_from_u8(1).unwrap(), Side::Sell);

    assert_eq!(OrderStatus::try_from_u8(0).unwrap(), OrderStatus::Pending);
    assert_eq!(OrderStatus::try_from_u8(4).unwrap(), OrderStatus::Expired);

    assert_eq!(ITPStatus::try_from_u8(1).unwrap(), ITPStatus::Active);
    assert_eq!(IssuerStatus::try_from_u8(2).unwrap(), IssuerStatus::Suspended);
    assert_eq!(PriceSource::try_from_u8(1).unwrap(), PriceSource::OneInch);
    assert_eq!(TxType::try_from_u8(3).unwrap(), TxType::Buy);
}

#[test]
fn test_enum_try_from_invalid() {
    // Test invalid conversions return errors instead of panicking
    let result = Side::try_from_u8(99);
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.enum_name, "Side");
    assert_eq!(err.invalid_value, 99);

    let result = OrderStatus::try_from_u8(99);
    assert!(result.is_err());
}

#[test]
fn test_enum_from_defaults_on_invalid() {
    // Test that From<u8> returns defaults instead of panicking
    assert_eq!(Side::from(99u8), Side::Buy); // Default
    assert_eq!(OrderStatus::from(99u8), OrderStatus::Pending); // Default
}
