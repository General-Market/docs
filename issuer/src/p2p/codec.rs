//! MessagePack codec with length-prefixed framing
//!
//! Message format:
//! ```text
//! [4 bytes: length (big-endian)] [N bytes: MessagePack payload]
//! ```

use common::error::Error;
use common::types::P2PMessage;

/// Length prefix size in bytes
const LENGTH_PREFIX_SIZE: usize = 4;

/// Maximum message size (1 MB)
const MAX_MESSAGE_SIZE: usize = 1024 * 1024;

/// Encode a P2P message with length-prefixed framing
///
/// # Arguments
/// * `message` - The message to encode
///
/// # Returns
/// Encoded bytes with 4-byte big-endian length prefix followed by MessagePack payload
pub fn encode(message: &P2PMessage) -> Result<Vec<u8>, Error> {
    let payload = rmp_serde::to_vec(message)
        .map_err(|e| Error::Serialization(format!("MessagePack encode error: {}", e)))?;

    if payload.len() > MAX_MESSAGE_SIZE {
        return Err(Error::Serialization(format!(
            "Message too large: {} bytes (max {})",
            payload.len(),
            MAX_MESSAGE_SIZE
        )));
    }

    let len = payload.len() as u32;
    let mut result = Vec::with_capacity(LENGTH_PREFIX_SIZE + payload.len());
    result.extend_from_slice(&len.to_be_bytes());
    result.extend_from_slice(&payload);

    Ok(result)
}

/// Decode a P2P message from bytes (without length prefix)
///
/// # Arguments
/// * `bytes` - The MessagePack payload (without length prefix)
///
/// # Returns
/// Decoded P2P message
pub fn decode(bytes: &[u8]) -> Result<P2PMessage, Error> {
    rmp_serde::from_slice(bytes)
        .map_err(|e| Error::Serialization(format!("MessagePack decode error: {}", e)))
}

/// Streaming codec for handling TCP byte streams
///
/// Accumulates bytes and extracts complete messages as they become available.
pub struct Codec {
    /// Buffer for accumulated bytes
    buffer: Vec<u8>,
}

impl Codec {
    /// Create a new codec
    pub fn new() -> Self {
        Self { buffer: Vec::new() }
    }

    /// Feed bytes into the codec
    pub fn feed(&mut self, bytes: &[u8]) {
        self.buffer.extend_from_slice(bytes);
    }

    /// Try to decode the next complete message
    ///
    /// Returns `Some(Ok(message))` if a complete message was decoded,
    /// `Some(Err(e))` if decoding failed, or `None` if more bytes are needed.
    pub fn decode_next(&mut self) -> Option<Result<P2PMessage, Error>> {
        // Need at least length prefix
        if self.buffer.len() < LENGTH_PREFIX_SIZE {
            return None;
        }

        // Read length prefix
        let len_bytes: [u8; 4] = self.buffer[..LENGTH_PREFIX_SIZE].try_into().unwrap();
        let payload_len = u32::from_be_bytes(len_bytes) as usize;

        // Validate length
        if payload_len > MAX_MESSAGE_SIZE {
            // Clear the invalid data and return error
            self.buffer.clear();
            return Some(Err(Error::Serialization(format!(
                "Message too large: {} bytes",
                payload_len
            ))));
        }

        // Check if we have the complete message
        let total_len = LENGTH_PREFIX_SIZE + payload_len;
        if self.buffer.len() < total_len {
            return None;
        }

        // Extract the payload
        let payload = &self.buffer[LENGTH_PREFIX_SIZE..total_len];

        // Decode the message
        let result = decode(payload);

        // Remove processed bytes from buffer
        self.buffer.drain(..total_len);

        Some(result)
    }

    /// Get the number of buffered bytes
    pub fn buffered_len(&self) -> usize {
        self.buffer.len()
    }

    /// Clear the buffer
    pub fn clear(&mut self) {
        self.buffer.clear();
    }
}

impl Default for Codec {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::types::BLSSignature;

    fn test_peer_id(n: u8) -> [u8; 32] {
        let mut id = [0u8; 32];
        id[0] = n;
        id
    }

    #[test]
    fn test_encode_decode_roundtrip_heartbeat() {
        let message = P2PMessage::Heartbeat {
            sender_id: test_peer_id(42),
            timestamp: 1234567890,
        };

        let encoded = encode(&message).unwrap();

        // Verify length prefix
        let len_bytes: [u8; 4] = encoded[..4].try_into().unwrap();
        let payload_len = u32::from_be_bytes(len_bytes) as usize;
        assert_eq!(payload_len, encoded.len() - 4);

        // Decode
        let decoded = decode(&encoded[4..]).unwrap();
        assert_eq!(decoded, message);
    }

    #[test]
    fn test_encode_decode_roundtrip_cycle_start() {
        let message = P2PMessage::CycleStart {
            cycle_number: 999,
            leader_id: test_peer_id(1),
        };

        let encoded = encode(&message).unwrap();
        let decoded = decode(&encoded[4..]).unwrap();
        assert_eq!(decoded, message);
    }

    #[test]
    fn test_encode_decode_roundtrip_kick_vote() {
        let message = P2PMessage::KickVote {
            target_id: test_peer_id(5),
            voter_id: test_peer_id(1),
            reason: "Timeout exceeded".to_string(),
            signature: BLSSignature(vec![1, 2, 3, 4]),
        };

        let encoded = encode(&message).unwrap();
        let decoded = decode(&encoded[4..]).unwrap();
        assert_eq!(decoded, message);
    }

    #[test]
    fn test_codec_streaming() {
        let msg1 = P2PMessage::Heartbeat {
            sender_id: test_peer_id(1),
            timestamp: 111,
        };
        let msg2 = P2PMessage::CycleStart {
            cycle_number: 42,
            leader_id: test_peer_id(2),
        };

        let encoded1 = encode(&msg1).unwrap();
        let encoded2 = encode(&msg2).unwrap();

        let mut codec = Codec::new();

        // Feed partial data
        codec.feed(&encoded1[..5]);
        assert!(codec.decode_next().is_none());

        // Feed rest of first message
        codec.feed(&encoded1[5..]);
        let decoded1 = codec.decode_next().unwrap().unwrap();
        assert_eq!(decoded1, msg1);
        assert!(codec.decode_next().is_none());

        // Feed complete second message
        codec.feed(&encoded2);
        let decoded2 = codec.decode_next().unwrap().unwrap();
        assert_eq!(decoded2, msg2);
        assert!(codec.decode_next().is_none());
    }

    #[test]
    fn test_codec_multiple_messages_at_once() {
        let messages = vec![
            P2PMessage::Heartbeat {
                sender_id: test_peer_id(1),
                timestamp: 100,
            },
            P2PMessage::Heartbeat {
                sender_id: test_peer_id(2),
                timestamp: 200,
            },
            P2PMessage::Heartbeat {
                sender_id: test_peer_id(3),
                timestamp: 300,
            },
        ];

        let mut all_encoded = Vec::new();
        for msg in &messages {
            all_encoded.extend(encode(msg).unwrap());
        }

        let mut codec = Codec::new();
        codec.feed(&all_encoded);

        for expected in messages {
            let decoded = codec.decode_next().unwrap().unwrap();
            assert_eq!(decoded, expected);
        }

        assert!(codec.decode_next().is_none());
    }

    #[test]
    fn test_codec_empty_buffer() {
        let mut codec = Codec::new();
        assert!(codec.decode_next().is_none());
        assert_eq!(codec.buffered_len(), 0);
    }

    #[test]
    fn test_length_prefix_format() {
        let message = P2PMessage::Heartbeat {
            sender_id: test_peer_id(1),
            timestamp: 42,
        };

        let encoded = encode(&message).unwrap();

        // First 4 bytes should be big-endian length
        let len = u32::from_be_bytes([encoded[0], encoded[1], encoded[2], encoded[3]]);
        assert_eq!(len as usize, encoded.len() - 4);
    }
}
