use serde::{Deserialize, Serialize};
use specta::Type;

// ---------------------------------------------------------------------------
// Authentication type
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Type)]
#[serde(rename_all = "camelCase")]
pub enum AuthType {
    SqlServer,
}

impl Default for AuthType {
    fn default() -> Self {
        AuthType::SqlServer
    }
}

// ---------------------------------------------------------------------------
// Server profile — in-memory (includes password)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct ServerProfile {
    pub id: String,
    pub name: String,
    pub server: String,
    pub port: u16,
    #[serde(default)]
    pub auth_type: AuthType,
    pub username: String,
    pub password: String,
    pub encrypt: bool,
    pub trust_server_certificate: bool,
}

impl Default for ServerProfile {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            server: String::new(),
            port: 1433,
            auth_type: AuthType::SqlServer,
            username: String::new(),
            password: String::new(),
            encrypt: true,
            trust_server_certificate: true,
        }
    }
}

// ---------------------------------------------------------------------------
// Server profile — on-disk (no password; stored in OS keychain)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerProfileOnDisk {
    pub id: String,
    pub name: String,
    pub server: String,
    pub port: u16,
    #[serde(default)]
    pub auth_type: AuthType,
    pub username: String,
    pub encrypt: bool,
    pub trust_server_certificate: bool,
}

impl From<ServerProfile> for ServerProfileOnDisk {
    fn from(p: ServerProfile) -> Self {
        Self {
            id: p.id,
            name: p.name,
            server: p.server,
            port: p.port,
            auth_type: p.auth_type,
            username: p.username,
            encrypt: p.encrypt,
            trust_server_certificate: p.trust_server_certificate,
        }
    }
}

impl ServerProfileOnDisk {
    pub fn into_profile(self, password: String) -> ServerProfile {
        ServerProfile {
            id: self.id,
            name: self.name,
            server: self.server,
            port: self.port,
            auth_type: self.auth_type,
            username: self.username,
            password,
            encrypt: self.encrypt,
            trust_server_certificate: self.trust_server_certificate,
        }
    }
}

// ---------------------------------------------------------------------------
// Maintenance options
// ---------------------------------------------------------------------------

fn default_true() -> bool { true }
fn default_rebuild_threshold() -> f64 { 30.0 }
fn default_reorganize_threshold() -> f64 { 10.0 }
fn default_retry_max_attempts() -> u32 { 3 }
fn default_retry_base_delay_ms() -> u64 { 1000 }
fn default_retry_max_delay_ms() -> u64 { 30000 }
fn default_connection_timeout_ms() -> u64 { 30000 }
fn default_max_parallel_databases() -> u32 { 4 }

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct MaintenanceOptions {
    #[serde(default = "default_true")]
    pub rebuild_online: bool,
    #[serde(default)]
    pub free_proc_cache: bool,
    #[serde(default = "default_rebuild_threshold")]
    pub rebuild_threshold: f64,
    #[serde(default = "default_reorganize_threshold")]
    pub reorganize_threshold: f64,
    #[serde(default = "default_retry_max_attempts")]
    pub retry_max_attempts: u32,
    #[serde(default = "default_retry_base_delay_ms")]
    pub retry_base_delay_ms: u64,
    #[serde(default = "default_retry_max_delay_ms")]
    pub retry_max_delay_ms: u64,
    #[serde(default = "default_connection_timeout_ms")]
    pub connection_timeout_ms: u64,
    #[serde(default)]
    pub request_timeout_ms: u64,
    #[serde(default)]
    pub parallel_databases: bool,
    #[serde(default = "default_max_parallel_databases")]
    pub max_parallel_databases: u32,
}

impl Default for MaintenanceOptions {
    fn default() -> Self {
        Self {
            rebuild_online: true,
            free_proc_cache: false,
            rebuild_threshold: 30.0,
            reorganize_threshold: 10.0,
            retry_max_attempts: 3,
            retry_base_delay_ms: 1000,
            retry_max_delay_ms: 30000,
            connection_timeout_ms: 30000,
            request_timeout_ms: 0,
            parallel_databases: false,
            max_parallel_databases: 4,
        }
    }
}

// ---------------------------------------------------------------------------
// Index types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct IndexInfo {
    pub database_name: String,
    pub schema_name: String,
    pub table_name: String,
    pub index_name: String,
    pub fragmentation_percent: f64,
    pub page_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Type)]
#[serde(rename_all = "UPPERCASE")]
pub enum MaintenanceAction {
    Rebuild,
    Reorganize,
    Skip,
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct IndexResult {
    pub schema_name: String,
    pub table_name: String,
    pub index_name: String,
    pub fragmentation_percent: f64,
    pub page_count: i64,
    pub action: MaintenanceAction,
    pub success: bool,
    pub duration_secs: f64,
    pub retry_attempts: u32,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct DatabaseResult {
    pub database_name: String,
    pub success: bool,
    pub indexes_processed: u32,
    pub indexes_rebuilt: u32,
    pub indexes_reorganized: u32,
    pub indexes_skipped: u32,
    pub total_duration_secs: f64,
    pub errors: Vec<String>,
    pub critical_failure: bool,
    pub manually_skipped: bool,
    #[serde(default)]
    pub index_results: Vec<IndexResult>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct MaintenanceSummary {
    pub databases_processed: u32,
    pub databases_failed: u32,
    pub databases_skipped: u32,
    pub total_indexes_rebuilt: u32,
    pub total_indexes_reorganized: u32,
    pub total_indexes_skipped: u32,
    pub total_duration_secs: f64,
    pub database_results: Vec<DatabaseResult>,
}

// ---------------------------------------------------------------------------
// Run history record (returned by history commands)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
pub struct RunRecord {
    pub id: i64,
    pub profile_id: String,
    pub profile_name: String,
    pub server: String,
    pub started_at: String,
    pub finished_at: String,
    pub databases_processed: u32,
    pub databases_failed: u32,
    pub databases_skipped: u32,
    pub total_indexes_rebuilt: u32,
    pub total_indexes_reorganized: u32,
    pub total_indexes_skipped: u32,
    pub total_duration_secs: f64,
    pub database_results: Vec<DatabaseResult>,
}
