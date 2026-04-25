// Primitive union types (AuthType, MaintenanceAction) are derived from the
// tauri-specta-generated bindings (src/bindings.ts). These are the cheap wins
// for drift resistance — when Rust adds/removes an enum variant, tsc fails
// here automatically. Composite types stay hand-written below because
// `Required<>` does not propagate into nested type references (a derived
// RunRecord would still reach the generated DatabaseResult with its optional
// serde-defaulted fields), and tauri-specta-generated event types would
// require a `collect_events!` wiring that isn't in place yet.
//
// The compile-time assertions at the bottom of this file guarantee the
// hand-written composite types remain structurally compatible with the
// generated ones. If any Rust struct field changes shape, one of those
// assertions will fail to compile.

import type {
  AuthType as GenAuthType,
  DatabaseResult as GenDatabaseResult,
  Environment as GenEnvironment,
  IndexResult as GenIndexResult,
  MaintenanceAction as GenMaintenanceAction,
  MaintenanceOptions as GenMaintenanceOptions,
  RunRecord as GenRunRecord,
  ServerProfile as GenServerProfile,
} from "../bindings";

export type AuthType = GenAuthType;
export type MaintenanceAction = GenMaintenanceAction;
export type Environment = GenEnvironment;

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
  environment: Environment;
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

export interface IndexInfo {
  database_name: string;
  schema_name: string;
  table_name: string;
  index_name: string;
  fragmentation_percent: number;
  page_count: number;
}

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
  // `null` matches the wire format — Rust's `Option<String>` serializes as
  // null when None, not as a missing field. Use `error ?? undefined` at sites
  // passing this to DOM attributes that expect `string | undefined`.
  error: string | null;
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
  interrupted: boolean;
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

export type DatabaseCardState = "queued" | "running" | "done" | "error" | "skipped" | "stopped";

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

// Event payload types — tauri-specta's `collect_events!` is not wired up, so
// these are hand-mirrored against the `...Event` structs in
// src-tauri/src/commands/maintenance.rs.

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

export type View = "profiles" | "databases" | "dashboard" | "summary" | "history" | "insights";

// WizardView excludes global views (profiles home, history, insights) that aren't wizard steps
export type WizardView = Exclude<View, "profiles" | "history" | "insights">;

// ---------------------------------------------------------------------------
// Compile-time drift assertions — verify hand-written types are structurally
// compatible with the tauri-specta-generated ones. Any mismatch fails `tsc`.
// ---------------------------------------------------------------------------

type AssertCompat<Hand, Gen> =
  // Hand must be assignable to Gen (we may have extra required where Gen is optional)…
  Hand extends Gen
    // …and Gen's required keys must all appear in Hand.
    ? keyof Gen extends keyof Hand
      ? true
      : { missingFromHand: Exclude<keyof Gen, keyof Hand> }
    : { handNotAssignableToGen: Hand };

// Each alias constrains to `true` — if AssertCompat resolves to an error
// object, the constraint fails and tsc reports it. Type aliases don't trip
// `noUnusedLocals`, so we don't need `const` declarations with disables.
type AssertTrue<T extends true> = T;

// Exported so `noUnusedLocals` doesn't flag them. Each must resolve to `true`
// or the constraint fails — any Rust-side drift surfaces as a tsc error here.
export type _CheckServerProfile = AssertTrue<AssertCompat<ServerProfile, GenServerProfile>>;
export type _CheckMaintenanceOptions = AssertTrue<AssertCompat<MaintenanceOptions, GenMaintenanceOptions>>;
export type _CheckDatabaseResult = AssertTrue<AssertCompat<DatabaseResult, GenDatabaseResult>>;
export type _CheckIndexResult = AssertTrue<AssertCompat<IndexResult, GenIndexResult>>;
export type _CheckRunRecord = AssertTrue<AssertCompat<RunRecord, GenRunRecord>>;
