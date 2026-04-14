use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use crate::p2p::metrics::P2PMetrics;

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

/// Soft cap on WAL file size. When exceeded, the WAL attempts inline GC
/// (prune non-current-cycle entries) before the next append. If the current
/// cycle alone still exceeds this cap, `append` returns a hard error rather
/// than silently dropping writes — an unbacked replay log is worse than a
/// crashing oracle.
///
/// 64 MB gives comfortable headroom versus the historical 10 MB footgun:
/// a price cycle with ~3 peers × 4 phases × realistic proposal sizes fits
/// well inside, with an order of magnitude to spare for bridge cycles and
/// large batch confirmations.
const MAX_WAL_SIZE: u64 = 64 * 1024 * 1024;

/// An overflow error — the WAL could not accept the write without exceeding
/// the size cap, even after inline GC. Callers must escalate, not swallow.
#[derive(Debug)]
pub struct WalOverflowError {
    pub file_size: u64,
    pub cap: u64,
    pub cycle_number: u64,
}

impl std::fmt::Display for WalOverflowError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "WAL overflow: {} bytes exceeds cap {} bytes for cycle {} (current-cycle entries alone exceed the cap; raise MAX_WAL_SIZE or reduce per-cycle payload)",
            self.file_size, self.cap, self.cycle_number
        )
    }
}

impl std::error::Error for WalOverflowError {}

pub struct ConsensusWAL {
    file: std::fs::File,
    path: PathBuf,
    sync_mode: WalSyncMode,
    metrics: Option<Arc<P2PMetrics>>,
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
            metrics: None,
        })
    }

    /// Attach the P2P metrics handle so WAL writes/overflows/failures are
    /// surfaced through `/health`. Optional — the WAL functions without it.
    pub fn with_metrics(mut self, metrics: Arc<P2PMetrics>) -> Self {
        self.metrics = Some(metrics);
        self
    }

    pub fn append(&mut self, entry: &WALEntry) -> Result<(), Box<dyn std::error::Error>> {
        // Size check: if the file is above the soft cap, try inline GC first.
        // The WAL is cycle-scoped — GC keeping only the current cycle's entries
        // should reclaim the vast majority of the file. If it doesn't, we've
        // hit a genuine overflow and must escalate rather than silently drop.
        let size = self.file.metadata()?.len();
        if size > MAX_WAL_SIZE {
            if let Some(m) = &self.metrics {
                m.wal_overflows_total.fetch_add(1, Ordering::Relaxed);
            }
            tracing::warn!(
                code = "INFRA-022",
                size,
                cap = MAX_WAL_SIZE,
                cycle = entry.cycle_number,
                "WAL soft cap exceeded, running inline GC"
            );
            // Inline GC: keep only the current cycle. If GC itself fails
            // (rename, I/O), surface the error — do not swallow.
            self.gc(entry.cycle_number)?;

            // Re-check after GC. If still over cap, the current cycle alone
            // has outgrown the file — an actionable condition, not silence.
            let size_after = self.file.metadata()?.len();
            if size_after > MAX_WAL_SIZE {
                if let Some(m) = &self.metrics {
                    m.wal_write_failures.fetch_add(1, Ordering::Relaxed);
                }
                tracing::error!(
                    code = "INFRA-022",
                    size = size_after,
                    cap = MAX_WAL_SIZE,
                    cycle = entry.cycle_number,
                    "WAL overflow — current cycle exceeds cap, escalating"
                );
                return Err(Box::new(WalOverflowError {
                    file_size: size_after,
                    cap: MAX_WAL_SIZE,
                    cycle_number: entry.cycle_number,
                }));
            }
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

        if let Some(m) = &self.metrics {
            m.wal_entries_written.fetch_add(1, Ordering::Relaxed);
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
    fn test_overflow_escalates_when_current_cycle_exceeds_cap() {
        // When a single cycle produces more than MAX_WAL_SIZE, GC cannot
        // reclaim anything and append MUST return an error — never Ok(()).
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.wal");
        let mut wal = ConsensusWAL::open(&path, WalSyncMode::None).unwrap();

        // Payload larger than MAX_WAL_SIZE, all on cycle 1.
        let big_entry = WALEntry {
            cycle_number: 1,
            phase: "Price".to_string(),
            from: [1u8; 32],
            message_bytes: vec![0u8; (MAX_WAL_SIZE + 1024) as usize],
            role: WalRole::Follower,
            timestamp_ms: 1234567890,
        };
        wal.append(&big_entry).unwrap();

        let size_after_first = std::fs::metadata(&path).unwrap().len();
        assert!(
            size_after_first > MAX_WAL_SIZE,
            "File should exceed MAX_WAL_SIZE after oversized write"
        );

        // Next append for the same cycle must fail — GC cannot help.
        let err = wal
            .append(&make_entry(1))
            .expect_err("append must escalate when current cycle alone exceeds cap");
        assert!(
            err.downcast_ref::<WalOverflowError>().is_some(),
            "expected WalOverflowError, got {err:?}"
        );
    }

    #[test]
    fn test_overflow_inline_gc_reclaims_old_cycles() {
        // When GC can reclaim old cycles, append should succeed after the
        // inline GC pass. No errors, no silent drops.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.wal");
        let mut wal = ConsensusWAL::open(&path, WalSyncMode::None).unwrap();

        // Fill with old-cycle entries totalling more than MAX_WAL_SIZE.
        let filler = WALEntry {
            cycle_number: 1,
            phase: "Price".to_string(),
            from: [1u8; 32],
            message_bytes: vec![0u8; (MAX_WAL_SIZE + 4096) as usize],
            role: WalRole::Follower,
            timestamp_ms: 1,
        };
        wal.append(&filler).unwrap();
        let size_before = std::fs::metadata(&path).unwrap().len();
        assert!(size_before > MAX_WAL_SIZE);

        // New cycle small entry — should trigger inline GC (which drops cycle 1)
        // and then write successfully.
        let fresh = make_entry(2);
        wal.append(&fresh).expect("append must succeed after inline GC");

        let size_after = std::fs::metadata(&path).unwrap().len();
        assert!(
            size_after < size_before,
            "Inline GC should have reclaimed the old cycle: before={size_before} after={size_after}"
        );

        let entries = wal.read_all().unwrap();
        assert_eq!(entries.len(), 1, "only cycle 2 should survive");
        assert_eq!(entries[0].cycle_number, 2);
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
