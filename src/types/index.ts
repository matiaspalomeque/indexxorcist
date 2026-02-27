// Rust-mirrored types — kept locally as fully-required interfaces to prevent
// optional-field ambiguity that the auto-generated bindings.ts uses for
// serde-defaulted fields. bindings.ts is the source of truth for IPC schema;
// this file is the source of truth for frontend component usage.
//
// AuthType values match Rust's #[serde(rename_all = "camelCase")]

export type AuthType = "sqlServer" | "windowsIntegrated" | "windowsCredentials";

export interface ServerProfile {
  id: string;
  name: string;
  server: string;
  port: number;
  auth_type: AuthType;
  username: string;
  password: string;
  encrypt: boolean;
  trust_server_certificate: boolean;
}

export interface MaintenanceOptions {
  rebuild_online: boolean;
  free_proc_cache: boolean;
  rebuild_threshold: number;
  reorganize_threshold: number;
  retry_max_attempts: number;
  retry_base_delay_ms: number;
  retry_max_delay_ms: number;
  connection_timeout_ms: number;
  request_timeout_ms: number;
  parallel_databases: boolean;
  max_parallel_databases: number;
}

export const DEFAULT_OPTIONS: MaintenanceOptions = {
  rebuild_online: true,
  free_proc_cache: false,
  rebuild_threshold: 30,
  reorganize_threshold: 10,
  retry_max_attempts: 3,
  retry_base_delay_ms: 1000,
  retry_max_delay_ms: 30000,
  connection_timeout_ms: 30000,
  request_timeout_ms: 0,
  parallel_databases: false,
  max_parallel_databases: 4,
};

// Legacy alias kept for backwards-compat (no existing code should still reference it)
export type GlobalSettings = MaintenanceOptions;
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = { ...DEFAULT_OPTIONS };

export interface IndexInfo {
  database_name: string;
  schema_name: string;
  table_name: string;
  index_name: string;
  fragmentation_percent: number;
  page_count: number;
}

export type MaintenanceAction = "REBUILD" | "REORGANIZE" | "SKIP";

export interface IndexResult {
  schema_name: string;
  table_name: string;
  index_name: string;
  fragmentation_percent: number;
  page_count: number;
  action: MaintenanceAction;
  success: boolean;
  duration_secs: number;
  retry_attempts: number;
  error?: string;
}

export interface DatabaseResult {
  database_name: string;
  success: boolean;
  indexes_processed: number;
  indexes_rebuilt: number;
  indexes_reorganized: number;
  indexes_skipped: number;
  total_duration_secs: number;
  errors: string[];
  critical_failure: boolean;
  manually_skipped: boolean;
  index_results: IndexResult[];
}

export interface MaintenanceSummary {
  databases_processed: number;
  databases_failed: number;
  databases_skipped: number;
  total_indexes_rebuilt: number;
  total_indexes_reorganized: number;
  total_indexes_skipped: number;
  total_duration_secs: number;
  database_results: DatabaseResult[];
}

export interface RunRecord {
  id: number;
  profile_id: string;
  profile_name: string;
  server: string;
  started_at: string;
  finished_at: string;
  databases_processed: number;
  databases_failed: number;
  databases_skipped: number;
  total_indexes_rebuilt: number;
  total_indexes_reorganized: number;
  total_indexes_skipped: number;
  total_duration_secs: number;
  database_results: DatabaseResult[];
}

// UI-only types

export type DatabaseCardState = "queued" | "running" | "done" | "error" | "skipped";

export type IndexStatus = "pending" | "processing" | "done" | "skipped" | "error";

export interface IndexDetail extends IndexInfo {
  status: IndexStatus;
  action?: MaintenanceAction;
  duration_secs?: number;
  retry_attempts?: number;
  error?: string;
}

export interface DatabaseCardData {
  name: string;
  state: DatabaseCardState;
  indexes: IndexDetail[];
  indexes_processed: number;
  indexes_rebuilt: number;
  indexes_reorganized: number;
  indexes_skipped: number;
  duration_secs: number;
  errors: string[];
}

// Event payload types

export interface DbStartPayload {
  profile_id: string;
  db_name: string;
  current: number;
  total: number;
}

export interface IndexActionPayload {
  profile_id: string;
  db_name: string;
  schema_name: string;
  table_name: string;
  index_name: string;
  action: MaintenanceAction;
}

export interface IndexCompletePayload {
  profile_id: string;
  db_name: string;
  schema_name: string;
  table_name: string;
  index_name: string;
  action: MaintenanceAction;
  success: boolean;
  duration_secs: number;
  retry_attempts: number;
  error?: string;
}

export interface MaintenanceControlPayload {
  profile_id: string;
  state: "running" | "paused" | "stopped";
}

export interface IndexFoundPayload {
  profile_id: string;
  index: IndexInfo;
}

export interface DbCompletePayload {
  profile_id: string;
  result: DatabaseResult;
}

export interface MaintenanceFinishedPayload {
  profile_id: string;
  summary: MaintenanceSummary;
}

export interface MaintenanceErrorPayload {
  profile_id: string;
  message: string;
}

export type RunState = "idle" | "running" | "paused" | "finished" | "stopped";

export type View = "profiles" | "databases" | "dashboard" | "summary" | "history";

// WizardView excludes global views (profiles home, history) that aren't wizard steps
export type WizardView = Exclude<View, "profiles" | "history">;
