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
}
