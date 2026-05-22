use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceDisplay {
    #[serde(rename = "sourceId")]
    pub source_id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub logo: String,
    #[serde(rename = "brandBg")]
    pub brand_bg: String,
    pub prefixes: Vec<String>,
    #[serde(rename = "valueLabel")]
    pub value_label: String,
    #[serde(rename = "valueUnit")]
    pub value_unit: String,
    #[serde(rename = "isPrice", default)]
    pub is_price: bool,
    #[serde(rename = "internalIds", default)]
    pub internal_ids: Vec<String>,
    #[serde(rename = "syncIntervalSecs", default = "default_sync_interval")]
    pub sync_interval_secs: u64,
    #[serde(rename = "batchEligible", default)]
    pub batch_eligible: bool,
    /// When set, this source maps to a *curated subset* of its parent
    /// (internal_ids[0]). The data-node treats `batch_subsource_key` as the
    /// on-chain batch source_id and filters the parent's healthy assets by
    /// the corresponding allowlist in `dl-curated.json`. Lets one ingested
    /// firehose serve many editorial sub-pages, each with its own batch.
    #[serde(rename = "batchSubsourceKey", default)]
    pub batch_subsource_key: Option<String>,
}

fn default_sync_interval() -> u64 {
    600
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryDisplay {
    pub key: String,
    pub label: String,
    pub order: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceRegistry {
    pub sources: Vec<SourceDisplay>,
    pub categories: Vec<CategoryDisplay>,
}

impl SourceRegistry {
    pub fn load(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let data = std::fs::read_to_string(path)?;
        Ok(serde_json::from_str(&data)?)
    }

    /// Build a lookup from internal_id → (display_name, sync_interval_secs).
    /// Each source may map multiple internal IDs (e.g. "sec" → sec_13f, sec_efts, sec_insider).
    pub fn internal_id_meta(&self) -> HashMap<String, (&str, u64)> {
        let mut map = HashMap::new();
        for s in &self.sources {
            for iid in &s.internal_ids {
                map.insert(iid.clone(), (s.name.as_str(), s.sync_interval_secs));
            }
        }
        map
    }

    /// Return all batch-eligible sources as (internal_id, display_name, sync_interval_secs) tuples.
    /// Flattens multi-internal-ID sources so each internal ID gets its own entry.
    ///
    /// Curated sub-sources (those with `batch_subsource_key`) are skipped here;
    /// the parent firehose source still appears once via its `internal_ids`.
    /// Use [`curated_batch_subsources`] to get the per-sub-source filter specs.
    pub fn batch_sources(&self) -> Vec<(String, String, u64)> {
        let mut out = Vec::new();
        for s in &self.sources {
            if !s.batch_eligible {
                continue;
            }
            if s.batch_subsource_key.is_some() {
                continue;
            }
            for iid in &s.internal_ids {
                out.push((iid.clone(), s.name.clone(), s.sync_interval_secs));
            }
        }
        out
    }

    /// Return curated-subsource batch specs as (batch_source_id, parent_internal_id,
    /// display_name, sync_interval_secs).
    ///
    /// Each entry corresponds to one editorial sub-page (e.g. defillama-bridges) that
    /// shares an ingested firehose with its siblings. The batch engine queries the
    /// parent's healthy assets and filters them by the dl-curated.json allowlist
    /// keyed on `batch_source_id`.
    pub fn curated_batch_subsources(&self) -> Vec<(String, String, String, u64)> {
        let mut out = Vec::new();
        for s in &self.sources {
            if !s.batch_eligible {
                continue;
            }
            let Some(key) = s.batch_subsource_key.as_ref() else { continue };
            let Some(parent) = s.internal_ids.first() else { continue };
            out.push((key.clone(), parent.clone(), s.name.clone(), s.sync_interval_secs));
        }
        out
    }

    /// Return all sources (batch + non-batch) as (internal_id, display_name, sync_interval_secs).
    pub fn all_source_meta(&self) -> Vec<(String, String, u64)> {
        let mut out = Vec::new();
        for s in &self.sources {
            for iid in &s.internal_ids {
                out.push((iid.clone(), s.name.clone(), s.sync_interval_secs));
            }
        }
        out
    }

    /// Look up sync_interval_secs for an internal_id. Returns 600 if not found.
    pub fn sync_interval_for(&self, internal_id: &str) -> u64 {
        for s in &self.sources {
            for iid in &s.internal_ids {
                if iid == internal_id {
                    return s.sync_interval_secs;
                }
            }
        }
        600
    }

    /// Look up display name for an internal_id. Returns the internal_id itself if not found.
    pub fn display_name_for(&self, internal_id: &str) -> String {
        for s in &self.sources {
            for iid in &s.internal_ids {
                if iid == internal_id {
                    return s.name.clone();
                }
            }
        }
        internal_id.replace('_', " ")
    }

    /// Check whether a given internal_id is known.
    pub fn has_internal_id(&self, internal_id: &str) -> bool {
        self.sources.iter().any(|s| s.internal_ids.iter().any(|iid| iid == internal_id))
    }
}
