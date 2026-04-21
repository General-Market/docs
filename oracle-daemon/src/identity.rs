//! Signing identity — derive an ed25519 signing key from the Solana keypair.
//!
//! Solana pubkeys are ed25519 verifying keys. A `solana_keypair::Keypair` is
//! 64 bytes: `[0..32]` is the ed25519 seed, `[32..64]` is the derived public
//! key. We rebuild the `SigningKey` from the seed and assert the derived
//! verifying key equals `keypair.pubkey()` byte-for-byte. If the SDK ever
//! rearranges that layout, the assertion incinerates the process — better a
//! noisy death than signed garbage on-chain (MR8).

use anyhow::{anyhow, Context, Result};
use ed25519_dalek::SigningKey;
use solana_keypair::Keypair;
use solana_pubkey::Pubkey;
use solana_signer::Signer;

pub struct Identity {
    pub keypair: Keypair,
    pub signing_key: SigningKey,
    pub pubkey: Pubkey,
}

impl Identity {
    pub fn load(keypair_path: &str) -> Result<Self> {
        let keypair = solana_keypair::read_keypair_file(keypair_path)
            .map_err(|e| anyhow!("read_keypair_file({keypair_path}): {e}"))?;
        Self::from_keypair(keypair)
    }

    pub fn from_keypair(keypair: Keypair) -> Result<Self> {
        let bytes = keypair.to_bytes();
        let seed: [u8; 32] = bytes[0..32]
            .try_into()
            .context("solana keypair serialization is not 64 bytes")?;
        let signing_key = SigningKey::from_bytes(&seed);
        let derived_pk = signing_key.verifying_key().to_bytes();
        let solana_pk = keypair.pubkey().to_bytes();
        if derived_pk != solana_pk {
            return Err(anyhow!(
                "ed25519 verifying key diverged from Solana pubkey — refusing to sign. \
                 derived={} solana={}",
                bs58::encode(derived_pk).into_string(),
                bs58::encode(solana_pk).into_string(),
            ));
        }
        Ok(Self {
            pubkey: keypair.pubkey(),
            keypair,
            signing_key,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use solana_keypair::Keypair;

    #[test]
    fn derived_verifying_key_matches_solana_pubkey() {
        let kp = Keypair::new();
        let id = Identity::from_keypair(kp.insecure_clone()).unwrap();
        assert_eq!(id.pubkey, kp.pubkey());
        // Sign something with the derived key and verify against the pubkey.
        use ed25519_dalek::Signer;
        let msg = b"cioran would hate this";
        let sig = id.signing_key.sign(msg);
        let vk = ed25519_dalek::VerifyingKey::from_bytes(&id.pubkey.to_bytes()).unwrap();
        vk.verify_strict(msg, &sig).unwrap();
    }
}
