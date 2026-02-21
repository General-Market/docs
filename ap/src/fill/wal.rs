//! Write-Ahead Log (WAL) for fill persistence (P2.3)
//!
//! JSON-lines append-only WAL that survives AP crashes.
//! Fills are appended before on-chain submission and tombstoned after confirmation.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use tracing::{info, warn};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FillEntry {
    pub order_id: u64,
    pub cycle: u64,
    pub asset: String,
    pub amount: String,
    pub timestamp: u64,
    pub tx_hash: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
enum WalRecord {
    Fill(FillEntry),
    Tombstone { order_id: u64 },
}

pub struct FillWal {
    path: PathBuf,
}

impl FillWal {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn append(&self, fill: &FillEntry) -> std::io::Result<()> {
        let mut file = OpenOptions::new().create(true).append(true).open(&self.path)?;
        let record = WalRecord::Fill(fill.clone());
        let line = serde_json::to_string(&record).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        writeln!(file, "{}", line)?;
        file.sync_all()?;
        Ok(())
    }

    pub fn append_tombstone(&self, order_id: u64) -> std::io::Result<()> {
        let mut file = OpenOptions::new().create(true).append(true).open(&self.path)?;
        let record = WalRecord::Tombstone { order_id };
        let line = serde_json::to_string(&record).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        writeln!(file, "{}", line)?;
        file.sync_all()?;
        Ok(())
    }

    pub fn replay(&self) -> std::io::Result<HashMap<u64, FillEntry>> {
        let mut fills: HashMap<u64, FillEntry> = HashMap::new();
        if !self.path.exists() {
            return Ok(fills);
        }
        let file = File::open(&self.path)?;
        let reader = BufReader::new(file);
        for line in reader.lines() {
            let line = line?;
            if line.trim().is_empty() { continue; }
            match serde_json::from_str::<WalRecord>(&line) {
                Ok(WalRecord::Fill(entry)) => { fills.insert(entry.order_id, entry); }
                Ok(WalRecord::Tombstone { order_id }) => { fills.remove(&order_id); }
                Err(e) => { warn!(error = %e, line = %line, "Skipping corrupt WAL entry"); }
            }
        }
        info!(recovered = fills.len(), path = %self.path.display(), "WAL replay complete");
        Ok(fills)
    }

    pub fn compact(&self) -> std::io::Result<()> {
        let fills = self.replay()?;
        let tmp = self.path.with_extension("tmp");
        {
            let mut file = File::create(&tmp)?;
            for fill in fills.values() {
                let record = WalRecord::Fill(fill.clone());
                let line = serde_json::to_string(&record).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
                writeln!(file, "{}", line)?;
            }
            file.sync_all()?;
        }
        std::fs::rename(&tmp, &self.path)?;
        info!(entries = fills.len(), "WAL compacted");
        Ok(())
    }
}
