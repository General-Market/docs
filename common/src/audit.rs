//! Structured audit trail for order lifecycle tracking.
//!
//! Writes JSONL (one JSON object per line) to `logs/audit-trail.jsonl`.
//! Thread-safe, append-only, flushed after each write.

use serde_json::Value;
use std::fs::{self, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::Path;
use std::sync::{Arc, Mutex};

/// Thread-safe JSONL audit trail writer.
#[derive(Clone)]
pub struct AuditTrail {
    writer: Arc<Mutex<BufWriter<std::fs::File>>>,
}

impl AuditTrail {
    /// Opens (or creates) `audit-trail.jsonl` in the given directory.
    pub fn new(dir: &Path) -> std::io::Result<Self> {
        fs::create_dir_all(dir)?;
        let path = dir.join("audit-trail.jsonl");
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)?;
        Ok(Self {
            writer: Arc::new(Mutex::new(BufWriter::new(file))),
        })
    }

    /// Write one JSONL record: `{"ts":..., "component":..., "event":..., "data":...}`
    pub fn log(&self, component: &str, event: &str, data: &Value) {
        let record = serde_json::json!({
            "ts": chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            "component": component,
            "event": event,
            "data": data,
        });
        if let Ok(mut w) = self.writer.lock() {
            let _ = serde_json::to_writer(&mut *w, &record);
            let _ = w.write_all(b"\n");
            let _ = w.flush();
        }
    }
}
