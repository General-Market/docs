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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_entry(cycle_number: u64) -> WALEntry {
        WALEntry {
            cycle_number,
            phase: "Price".to_string(),
            from: [1u8; 32],
            message_bytes: vec![0xAA, 0xBB, 0xCC],
            role: WalRole::Follower,
            timestamp_ms: 1234567890,
        }
    }

    #[test]
    fn test_write_read_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.wal");
        let mut wal = ConsensusWAL::open(&path, WalSyncMode::None).unwrap();

        let e1 = WALEntry {
            cycle_number: 1,
            phase: "Price".to_string(),
            from: [1u8; 32],
            message_bytes: vec![0xAA, 0xBB, 0xCC],
            role: WalRole::Follower,
            timestamp_ms: 1000,
        };
        let e2 = WALEntry {
            cycle_number: 2,
            phase: "Commit".to_string(),
            from: [2u8; 32],
            message_bytes: vec![0x01, 0x02],
            role: WalRole::Leader,
            timestamp_ms: 2000,
        };
        let e3 = WALEntry {
            cycle_number: 3,
            phase: "Aggregate".to_string(),
            from: [3u8; 32],
            message_bytes: vec![0xFF],
            role: WalRole::Follower,
            timestamp_ms: 3000,
        };

        wal.append(&e1).unwrap();
        wal.append(&e2).unwrap();
        wal.append(&e3).unwrap();

        let entries = wal.read_all().unwrap();
        assert_eq!(entries.len(), 3);

        assert_eq!(entries[0].cycle_number, 1);
        assert_eq!(entries[0].phase, "Price");
        assert_eq!(entries[0].from, [1u8; 32]);
        assert_eq!(entries[0].message_bytes, vec![0xAA, 0xBB, 0xCC]);
        assert_eq!(entries[0].timestamp_ms, 1000);

        assert_eq!(entries[1].cycle_number, 2);
        assert_eq!(entries[1].phase, "Commit");
        assert_eq!(entries[1].from, [2u8; 32]);
        assert_eq!(entries[1].message_bytes, vec![0x01, 0x02]);
        assert_eq!(entries[1].timestamp_ms, 2000);

        assert_eq!(entries[2].cycle_number, 3);
        assert_eq!(entries[2].phase, "Aggregate");
        assert_eq!(entries[2].from, [3u8; 32]);
        assert_eq!(entries[2].message_bytes, vec![0xFF]);
        assert_eq!(entries[2].timestamp_ms, 3000);
    }

    #[test]
    fn test_read_cycle_filter() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.wal");
        let mut wal = ConsensusWAL::open(&path, WalSyncMode::None).unwrap();

        // Write entries for cycles 5, 6, 6, 7
        wal.append(&make_entry(5)).unwrap();
        wal.append(&make_entry(6)).unwrap();
        wal.append(&make_entry(6)).unwrap();
        wal.append(&make_entry(7)).unwrap();

        let cycle6 = wal.read_cycle(6).unwrap();
        assert_eq!(cycle6.len(), 2, "Expected exactly 2 entries for cycle 6");
        for e in &cycle6 {
            assert_eq!(e.cycle_number, 6);
        }

        let cycle5 = wal.read_cycle(5).unwrap();
        assert_eq!(cycle5.len(), 1);

        let cycle7 = wal.read_cycle(7).unwrap();
        assert_eq!(cycle7.len(), 1);

        let cycle99 = wal.read_cycle(99).unwrap();
        assert_eq!(cycle99.len(), 0);
    }

    #[test]
    fn test_crc_truncation_recovery() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.wal");

        // Write 2 valid entries
        {
            let mut wal = ConsensusWAL::open(&path, WalSyncMode::None).unwrap();
            wal.append(&make_entry(1)).unwrap();
            wal.append(&make_entry(2)).unwrap();
        }

        // Append corrupt bytes (wrong CRC) directly to the file
        // Format: [4-byte len][payload][4-byte CRC]
        // We write a valid-looking length but garbage payload and wrong CRC
        {
            let mut file = std::fs::OpenOptions::new()
                .append(true)
                .open(&path)
                .unwrap();

            // Write a fake entry: 8-byte "payload" + wrong CRC
            let fake_payload = b"GARBAGE!";
            let fake_len = fake_payload.len() as u32;
            let wrong_crc: u32 = 0xDEADBEEF;

            file.write_all(&fake_len.to_be_bytes()).unwrap();
            file.write_all(fake_payload).unwrap();
            file.write_all(&wrong_crc.to_be_bytes()).unwrap();
        }

        // read_all should stop at the corrupt entry and return exactly 2
        let wal = ConsensusWAL::open(&path, WalSyncMode::None).unwrap();
        let entries = wal.read_all().unwrap();
        assert_eq!(
            entries.len(),
            2,
            "Expected 2 valid entries, got {}",
            entries.len()
        );
        assert_eq!(entries[0].cycle_number, 1);
        assert_eq!(entries[1].cycle_number, 2);
    }

    #[test]
    fn test_gc_keeps_current_cycle() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.wal");
        let mut wal = ConsensusWAL::open(&path, WalSyncMode::None).unwrap();

        // Write entries for cycles 10, 11, 12
        wal.append(&make_entry(10)).unwrap();
        wal.append(&make_entry(10)).unwrap();
        wal.append(&make_entry(11)).unwrap();
        wal.append(&make_entry(12)).unwrap();
        wal.append(&make_entry(12)).unwrap();
        wal.append(&make_entry(12)).unwrap();

        // GC keeping only cycle 12
        wal.gc(12).unwrap();

        let entries = wal.read_all().unwrap();
        assert_eq!(
            entries.len(),
            3,
            "Expected 3 entries for cycle 12, got {}",
            entries.len()
        );
        for e in &entries {
            assert_eq!(
                e.cycle_number, 12,
                "Found entry with wrong cycle: {}",
                e.cycle_number
            );
        }
    }

    #[test]
    fn test_hard_cap() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.wal");
        let mut wal = ConsensusWAL::open(&path, WalSyncMode::None).unwrap();

        // Write a large entry to push past MAX_WAL_SIZE (10 MB)
        let big_entry = WALEntry {
            cycle_number: 1,
            phase: "Price".to_string(),
            from: [1u8; 32],
            // ~11 MB payload to exceed the cap in one write
            message_bytes: vec![0u8; 11 * 1024 * 1024],
            role: WalRole::Follower,
            timestamp_ms: 1234567890,
        };
        wal.append(&big_entry).unwrap();

        // Record file size after the first (large) write
        let size_after_first = std::fs::metadata(&path).unwrap().len();
        assert!(
            size_after_first > MAX_WAL_SIZE,
            "File should exceed MAX_WAL_SIZE after large write"
        );

        // Further appends should silently succeed but NOT grow the file
        let small_entry = make_entry(2);
        wal.append(&small_entry).unwrap(); // must return Ok(())
        wal.append(&small_entry).unwrap();

        let size_after_capped = std::fs::metadata(&path).unwrap().len();
        assert_eq!(
            size_after_first, size_after_capped,
            "File must not grow after hard cap is reached"
        );
    }

    #[test]
    fn test_empty_wal_read() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.wal");
        let wal = ConsensusWAL::open(&path, WalSyncMode::None).unwrap();

        let entries = wal.read_all().unwrap();
        assert_eq!(entries.len(), 0, "Empty WAL should return empty vec");
    }
}
