use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WALEntry {
    pub cycle_number: u64,
    pub phase: String, // ConsensusPhase as string
    pub from: [u8; 32], // PeerId
    pub message_bytes: Vec<u8>, // Serialized P2PMessage
    pub role: WalRole,
    pub timestamp_ms: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum WalRole {
    Leader,
    Follower,
}

pub enum WalSyncMode {
    Fdatasync,
    Fsync,
    None,
}

const MAX_WAL_SIZE: u64 = 10 * 1024 * 1024; // 10 MB

pub struct ConsensusWAL {
    file: std::fs::File,
    path: PathBuf,
    sync_mode: WalSyncMode,
}

impl ConsensusWAL {
    pub fn open(path: impl Into<PathBuf>, sync_mode: WalSyncMode) -> Result<Self, std::io::Error> {
        let path = path.into();
        let file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .read(true)
            .open(&path)?;
        Ok(Self {
            file,
            path,
            sync_mode,
        })
    }

    pub fn append(&mut self, entry: &WALEntry) -> Result<(), Box<dyn std::error::Error>> {
        // Hard cap check
        if self.file.metadata()?.len() > MAX_WAL_SIZE {
            tracing::error!(code = "INFRA-022", "WAL exceeded 10 MB, disabling writes");
            return Ok(());
        }

        let payload = rmp_serde::to_vec(entry)?;
        let crc = crc32fast::hash(&payload);
        let len = payload.len() as u32;

        self.file.write_all(&len.to_be_bytes())?;
        self.file.write_all(&payload)?;
        self.file.write_all(&crc.to_be_bytes())?;

        match self.sync_mode {
            WalSyncMode::Fdatasync => self.file.sync_data()?,
            WalSyncMode::Fsync => self.file.sync_all()?,
            WalSyncMode::None => {}
        }
        Ok(())
    }

    pub fn read_all(&self) -> Result<Vec<WALEntry>, Box<dyn std::error::Error>> {
        let mut file = std::fs::File::open(&self.path)?;
        let mut entries = Vec::new();

        loop {
            // Read length prefix
            let mut len_buf = [0u8; 4];
            if file.read_exact(&mut len_buf).is_err() {
                break;
            }
            let len = u32::from_be_bytes(len_buf) as usize;

            // Read payload
            let mut payload = vec![0u8; len];
            if file.read_exact(&mut payload).is_err() {
                break;
            }

            // Read and verify CRC
            let mut crc_buf = [0u8; 4];
            if file.read_exact(&mut crc_buf).is_err() {
                break;
            }
            let expected_crc = u32::from_be_bytes(crc_buf);
            let actual_crc = crc32fast::hash(&payload);

            if expected_crc != actual_crc {
                tracing::warn!(
                    code = "INFRA-022",
                    "CRC mismatch, stopping WAL read (truncated last write)"
                );
                break;
            }

            match rmp_serde::from_slice(&payload) {
                Ok(entry) => entries.push(entry),
                Err(e) => {
                    tracing::warn!(
                        code = "INFRA-022",
                        "Failed to deserialize WAL entry: {e}"
                    );
                    break;
                }
            }
        }

        Ok(entries)
    }

    pub fn read_cycle(
        &self,
        cycle_number: u64,
    ) -> Result<Vec<WALEntry>, Box<dyn std::error::Error>> {
        let all = self.read_all()?;
        Ok(all
            .into_iter()
            .filter(|e| e.cycle_number == cycle_number)
            .collect())
    }

    /// GC: keep only current cycle entries. Atomic via rename.
    pub fn gc(&mut self, current_cycle: u64) -> Result<(), Box<dyn std::error::Error>> {
        let entries = self.read_cycle(current_cycle)?;
        let tmp_path = self.path.with_extension("wal.tmp");

        {
            let mut tmp = std::fs::File::create(&tmp_path)?;
            for entry in &entries {
                let payload = rmp_serde::to_vec(entry)?;
                let crc = crc32fast::hash(&payload);
                let len = payload.len() as u32;
                tmp.write_all(&len.to_be_bytes())?;
                tmp.write_all(&payload)?;
                tmp.write_all(&crc.to_be_bytes())?;
            }
            tmp.sync_all()?;
        }

        std::fs::rename(&tmp_path, &self.path)?;
        self.file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .read(true)
            .open(&self.path)?;

        Ok(())
    }
}
