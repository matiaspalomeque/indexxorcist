use crate::db::connection::create_client;
use crate::db::queries::{
    fetch_fragmented_indexes, rebuild_index_sql, reorganize_index_sql, update_statistics_sql,
    FREE_PROC_CACHE,
};
use crate::models::types::{
    DatabaseResult, IndexInfo, IndexResult, MaintenanceAction, MaintenanceOptions,
    MaintenanceSummary, ServerProfile,
};
use crate::{AppState, MaintenanceControl};
use serde::Serialize;
use specta::Type;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{watch, Mutex};
use tokio::time::{sleep, timeout, Duration};

// ---------------------------------------------------------------------------
// Typed event payloads — all fields are owned (no lifetimes) for specta compat.
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone, Type)]
pub struct ControlEvent {
    pub profile_id: String,
    pub state: String,
}

#[derive(Serialize, Clone, Type)]
pub struct DbStartEvent {
    pub profile_id: String,
    pub db_name: String,
    pub current: u32,
    pub total: u32,
}

#[derive(Serialize, Clone, Type)]
pub struct IndexFoundEvent {
    pub profile_id: String,
    pub index: IndexInfo,
}

#[derive(Serialize, Clone, Type)]
pub struct IndexActionEvent {
    pub profile_id: String,
    pub db_name: String,
    pub schema_name: String,
    pub table_name: String,
    pub index_name: String,
    pub action: MaintenanceAction,
}

#[derive(Serialize, Clone, Type)]
pub struct IndexCompleteEvent {
    pub profile_id: String,
    pub db_name: String,
    pub schema_name: String,
    pub table_name: String,
    pub index_name: String,
    pub action: MaintenanceAction,
    pub success: bool,
    pub duration_secs: f64,
    pub retry_attempts: u32,
    pub error: Option<String>,
}

#[derive(Serialize, Clone, Type)]
pub struct DbCompleteEvent {
    pub profile_id: String,
    pub result: DatabaseResult,
}

#[derive(Serialize, Clone, Type)]
pub struct MaintenanceFinishedEvent {
    pub profile_id: String,
    pub summary: MaintenanceSummary,
}

#[derive(Serialize, Clone, Type)]
pub struct MaintenanceErrorEvent {
    pub profile_id: String,
    pub message: String,
}

// ---------------------------------------------------------------------------
// Maintenance context — groups shared state to avoid too-many-arguments
// ---------------------------------------------------------------------------

struct MaintenanceCtx {
    app: AppHandle,
    control_txs: Arc<Mutex<HashMap<String, watch::Sender<MaintenanceControl>>>>,
    history_db: Arc<tokio::sync::Mutex<rusqlite::Connection>>,
    ctrl_rx: watch::Receiver<MaintenanceControl>,
    profile_id: Arc<str>,
    profile: ServerProfile,
    options: MaintenanceOptions,
}

// ---------------------------------------------------------------------------
// Control signal helpers
// ---------------------------------------------------------------------------

fn emit_control(app: &AppHandle, profile_id: &str, state: &str) {
    let _ = app.emit(
        "maintenance:control",
        ControlEvent { profile_id: profile_id.to_string(), state: state.to_string() },
    );
}

async fn reset_control(
    control_txs: &Arc<Mutex<HashMap<String, watch::Sender<MaintenanceControl>>>>,
    profile_id: &str,
) {
    if let Some(tx) = control_txs.lock().await.get(profile_id) {
        let _ = tx.send(MaintenanceControl::Running);
    }
}

/// Returns None if Running (continue), Some(ctrl) if Stop or SkipDatabase.
/// Blocks in a poll loop while Paused.
async fn check_ctrl(ctrl_rx: &watch::Receiver<MaintenanceControl>) -> Option<MaintenanceControl> {
    loop {
        let ctrl = ctrl_rx.borrow().clone();
        match ctrl {
            MaintenanceControl::Running => return None,
            MaintenanceControl::Stop | MaintenanceControl::SkipDatabase => return Some(ctrl),
            MaintenanceControl::Paused => {
                sleep(Duration::from_millis(150)).await;
            }
        }
    }
}

async fn wait_delay_with_ctrl(
    total_ms: u64,
    ctrl_rx: &watch::Receiver<MaintenanceControl>,
) -> Option<MaintenanceControl> {
    let mut elapsed = 0u64;
    while elapsed < total_ms {
        match check_ctrl(ctrl_rx).await {
            Some(ctrl) => return Some(ctrl),
            None => {}
        }
        let step = (total_ms - elapsed).min(100);
        sleep(Duration::from_millis(step)).await;
        elapsed += step;
    }
    None
}

// ---------------------------------------------------------------------------
// Fragmentation thresholds
// ---------------------------------------------------------------------------

fn determine_action(
    fragmentation: f64,
    reorganize_threshold: f64,
    rebuild_threshold: f64,
) -> MaintenanceAction {
    // Ensure rebuild_threshold >= reorganize_threshold even if user misconfigured
    let effective_rebuild = rebuild_threshold.max(reorganize_threshold);
    if fragmentation >= effective_rebuild {
        MaintenanceAction::Rebuild
    } else if fragmentation >= reorganize_threshold {
        MaintenanceAction::Reorganize
    } else {
        MaintenanceAction::Skip
    }
}

fn is_transient_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    ["timeout", "connection", "deadlock", "throttl", "busy", "reset"]
        .iter()
        .any(|pat| lower.contains(pat))
}

// ---------------------------------------------------------------------------
// Result for a single index operation
// ---------------------------------------------------------------------------

enum IndexOpResult {
    Success { attempts: u32, duration_secs: f64 },
    Failure { attempts: u32, duration_secs: f64, error: String },
    Interrupted(MaintenanceControl),
}

/// Execute one ALTER INDEX with retry + pause/skip/stop interruptibility.
async fn execute_index_operation(
    client: &mut tiberius::Client<tokio_util::compat::Compat<tokio::net::TcpStream>>,
    sql: &str,
    options: &MaintenanceOptions,
    ctrl_rx: &watch::Receiver<MaintenanceControl>,
) -> IndexOpResult {
    let op_start = std::time::Instant::now();
    let mut last_err = String::new();
    let mut attempt = 0u32;
    for att in 1..=options.retry_max_attempts {
        attempt = att;

        let execute_result = if options.request_timeout_ms == 0 {
            Ok(client.execute(sql, &[]).await)
        } else {
            timeout(
                Duration::from_millis(options.request_timeout_ms),
                client.execute(sql, &[]),
            )
            .await
        };

        match execute_result {
            Ok(Ok(_)) => {
                return IndexOpResult::Success {
                    attempts: attempt,
                    duration_secs: op_start.elapsed().as_secs_f64(),
                };
            }
            Ok(Err(e)) => {
                last_err = e.to_string();
            }
            Err(_elapsed) => {
                last_err =
                    format!("SQL request timed out after {}ms", options.request_timeout_ms);
            }
        }

        if att == options.retry_max_attempts || !is_transient_error(&last_err) {
            break;
        }

        let delay_ms = ((options.retry_base_delay_ms as f64) * 2f64.powi(att as i32 - 1))
            .min(options.retry_max_delay_ms as f64) as u64;

        if let Some(ctrl) = wait_delay_with_ctrl(delay_ms, ctrl_rx).await {
            return IndexOpResult::Interrupted(ctrl);
        }
    }

    IndexOpResult::Failure {
        attempts: attempt,
        duration_secs: op_start.elapsed().as_secs_f64(),
        error: last_err,
    }
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

fn build_summary(results: Vec<DatabaseResult>, total_secs: f64) -> MaintenanceSummary {
    let databases_processed = results.len() as u32;
    let databases_failed = results.iter().filter(|r| r.critical_failure).count() as u32;
    let databases_skipped = results.iter().filter(|r| r.manually_skipped).count() as u32;
    let total_indexes_rebuilt = results.iter().map(|r| r.indexes_rebuilt).sum();
    let total_indexes_reorganized = results.iter().map(|r| r.indexes_reorganized).sum();
    let total_indexes_skipped = results.iter().map(|r| r.indexes_skipped).sum();

    MaintenanceSummary {
        databases_processed,
        databases_failed,
        databases_skipped,
        total_indexes_rebuilt,
        total_indexes_reorganized,
        total_indexes_skipped,
        total_duration_secs: total_secs,
        database_results: results,
    }
}

fn make_skipped_result(db_name: &str) -> DatabaseResult {
    DatabaseResult {
        database_name: db_name.to_string(),
        success: true,
        indexes_processed: 0,
        indexes_rebuilt: 0,
        indexes_reorganized: 0,
        indexes_skipped: 0,
        total_duration_secs: 0.0,
        errors: vec![],
        critical_failure: false,
        manually_skipped: true,
        index_results: vec![],
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[specta::specta]
#[tauri::command]
pub async fn run_maintenance(
    app: AppHandle,
    state: State<'_, AppState>,
    profile: ServerProfile,
    databases: Vec<String>,
    options: MaintenanceOptions,
) -> Result<(), String> {
    // Validate thresholds before spawning the task
    if options.reorganize_threshold <= 0.0 || options.rebuild_threshold <= 0.0 {
        return Err("Fragmentation thresholds must be positive".to_string());
    }

    let (tx, rx) = watch::channel(MaintenanceControl::Running);
    let control_txs = state.control_txs.clone();
    let history_db = state.history_db.clone();
    let profile_id: Arc<str> = Arc::from(profile.id.as_str());
    {
        let mut guard = control_txs.lock().await;
        if guard.contains_key(profile_id.as_ref()) {
            return Err("Maintenance run is already active for this profile".to_string());
        }
        guard.insert(profile_id.to_string(), tx);
    }

    let ctx = MaintenanceCtx {
        app,
        control_txs,
        history_db,
        ctrl_rx: rx,
        profile_id,
        profile,
        options,
    };

    tauri::async_runtime::spawn(async move {
        maintenance_task(ctx, databases).await;
    });

    Ok(())
}

#[specta::specta]
#[tauri::command]
pub async fn pause_maintenance(
    app: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<(), String> {
    let tx = state
        .control_txs
        .lock()
        .await
        .get(&profile_id)
        .cloned()
        .ok_or_else(|| "No active maintenance run for this profile".to_string())?;
    tx.send(MaintenanceControl::Paused).map_err(|e| e.to_string())?;
    emit_control(&app, &profile_id, "paused");
    Ok(())
}

#[specta::specta]
#[tauri::command]
pub async fn resume_maintenance(
    app: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<(), String> {
    let tx = state
        .control_txs
        .lock()
        .await
        .get(&profile_id)
        .cloned()
        .ok_or_else(|| "No active maintenance run for this profile".to_string())?;
    tx.send(MaintenanceControl::Running).map_err(|e| e.to_string())?;
    emit_control(&app, &profile_id, "running");
    Ok(())
}

#[specta::specta]
#[tauri::command]
pub async fn skip_database(state: State<'_, AppState>, profile_id: String) -> Result<(), String> {
    let tx = state
        .control_txs
        .lock()
        .await
        .get(&profile_id)
        .cloned()
        .ok_or_else(|| "No active maintenance run for this profile".to_string())?;
    tx.send(MaintenanceControl::SkipDatabase).map_err(|e| e.to_string())?;
    Ok(())
}

#[specta::specta]
#[tauri::command]
pub async fn stop_maintenance(
    app: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<(), String> {
    let tx = state
        .control_txs
        .lock()
        .await
        .get(&profile_id)
        .cloned()
        .ok_or_else(|| "No active maintenance run for this profile".to_string())?;
    tx.send(MaintenanceControl::Stop).map_err(|e| e.to_string())?;
    emit_control(&app, &profile_id, "stopped");
    Ok(())
}

// ---------------------------------------------------------------------------
// Maintenance task dispatcher
// ---------------------------------------------------------------------------

async fn maintenance_task(ctx: MaintenanceCtx, databases: Vec<String>) {
    if ctx.options.parallel_databases {
        maintenance_task_parallel(ctx, databases).await;
    } else {
        maintenance_task_sequential(ctx, databases).await;
    }
}

// ---------------------------------------------------------------------------
// Shared post-run: emit summary, persist history, clean up control channel
// ---------------------------------------------------------------------------

async fn finish_run(ctx: &MaintenanceCtx, results: Vec<DatabaseResult>, run_start: std::time::Instant, started_at: &str) {
    let summary = build_summary(results, run_start.elapsed().as_secs_f64());
    let _ = ctx.app.emit(
        "maintenance:finished",
        MaintenanceFinishedEvent { profile_id: ctx.profile_id.to_string(), summary: summary.clone() },
    );

    persist_history(
        &ctx.history_db,
        &ctx.profile_id,
        &ctx.profile.name,
        &ctx.profile.server,
        started_at,
        &summary,
    )
    .await;

    ctx.control_txs.lock().await.remove(ctx.profile_id.as_ref());
}

// ---------------------------------------------------------------------------
// Sequential maintenance task
// ---------------------------------------------------------------------------

async fn maintenance_task_sequential(ctx: MaintenanceCtx, databases: Vec<String>) {
    emit_control(&ctx.app, &ctx.profile_id, "running");
    let total_dbs = databases.len() as u32;
    let mut all_results: Vec<DatabaseResult> = Vec::new();
    let run_start = std::time::Instant::now();
    let started_at = chrono::Utc::now().to_rfc3339();

    'outer: for (idx, db_name) in databases.iter().enumerate() {
        match check_ctrl(&ctx.ctrl_rx).await {
            Some(MaintenanceControl::Stop) => {
                emit_control(&ctx.app, &ctx.profile_id, "stopped");
                break 'outer;
            }
            Some(MaintenanceControl::SkipDatabase) => {
                reset_control(&ctx.control_txs, &ctx.profile_id).await;
                emit_control(&ctx.app, &ctx.profile_id, "running");
                let result = make_skipped_result(db_name);
                let _ = ctx.app.emit(
                    "maintenance:db-complete",
                    DbCompleteEvent { profile_id: ctx.profile_id.to_string(), result: result.clone() },
                );
                all_results.push(result);
                continue;
            }
            _ => {}
        }

        let _ = ctx.app.emit(
            "maintenance:db-start",
            DbStartEvent {
                profile_id: ctx.profile_id.to_string(),
                db_name: db_name.clone(),
                current: (idx + 1) as u32,
                total: total_dbs,
            },
        );

        let (result, should_stop) = process_database(
            &ctx.app,
            &ctx.profile_id,
            &ctx.profile,
            db_name,
            &ctx.options,
            &ctx.ctrl_rx,
            &ctx.control_txs,
        )
        .await;

        let _ = ctx.app.emit(
            "maintenance:db-complete",
            DbCompleteEvent { profile_id: ctx.profile_id.to_string(), result: result.clone() },
        );
        all_results.push(result);

        if should_stop {
            emit_control(&ctx.app, &ctx.profile_id, "stopped");
            break 'outer;
        }
    }

    finish_run(&ctx, all_results, run_start, &started_at).await;
}

// ---------------------------------------------------------------------------
// Parallel maintenance task
// ---------------------------------------------------------------------------

async fn maintenance_task_parallel(ctx: MaintenanceCtx, databases: Vec<String>) {
    emit_control(&ctx.app, &ctx.profile_id, "running");
    let total_dbs = databases.len() as u32;
    let run_start = std::time::Instant::now();
    let started_at = chrono::Utc::now().to_rfc3339();

    let max_par = ctx.options.max_parallel_databases.max(1) as usize;
    let semaphore = Arc::new(tokio::sync::Semaphore::new(max_par));
    let mut join_set: tokio::task::JoinSet<bool> = tokio::task::JoinSet::new();
    let ordered_results: Arc<Mutex<Vec<(usize, DatabaseResult)>>> =
        Arc::new(Mutex::new(Vec::new()));

    for (idx, db_name) in databases.iter().enumerate() {
        // Acquire semaphore BEFORE spawn — backpressure at task creation
        let permit = semaphore.clone().acquire_owned().await.unwrap();

        let app_clone = ctx.app.clone();
        let profile_clone = ctx.profile.clone();
        let options_clone = ctx.options.clone();
        let ctrl_rx_clone = ctx.ctrl_rx.clone();
        let control_txs_clone = ctx.control_txs.clone();
        let profile_id_clone = ctx.profile_id.clone();
        let db_name_clone = db_name.clone();
        let results_clone = ordered_results.clone();

        // Emit db-start immediately (in parallel mode current/total is informational)
        let _ = ctx.app.emit(
            "maintenance:db-start",
            DbStartEvent {
                profile_id: ctx.profile_id.to_string(),
                db_name: db_name.clone(),
                current: (idx + 1) as u32,
                total: total_dbs,
            },
        );

        join_set.spawn(async move {
            let _permit = permit;
            let (result, should_stop) = process_database(
                &app_clone,
                &profile_id_clone,
                &profile_clone,
                &db_name_clone,
                &options_clone,
                &ctrl_rx_clone,
                &control_txs_clone,
            )
            .await;

            let _ = app_clone.emit(
                "maintenance:db-complete",
                DbCompleteEvent { profile_id: profile_id_clone.to_string(), result: result.clone() },
            );

            results_clone.lock().await.push((idx, result));
            should_stop
        });
    }

    // Collect results; if any task signals stop, broadcast Stop to remaining tasks
    let mut any_stopped = false;
    while let Some(task_result) = join_set.join_next().await {
        if let Ok(should_stop) = task_result {
            if should_stop && !any_stopped {
                any_stopped = true;
                if let Some(tx) = ctx.control_txs.lock().await.get(ctx.profile_id.as_ref()) {
                    let _ = tx.send(MaintenanceControl::Stop);
                }
            }
        }
    }

    if any_stopped {
        emit_control(&ctx.app, &ctx.profile_id, "stopped");
    }

    // Sort by original insertion index to maintain deterministic summary order
    let mut results = ordered_results.lock().await;
    results.sort_by_key(|(i, _)| *i);
    let ordered: Vec<DatabaseResult> = results.drain(..).map(|(_, r)| r).collect();

    finish_run(&ctx, ordered, run_start, &started_at).await;
}

// ---------------------------------------------------------------------------
// History persistence helper — uses spawn_blocking to avoid stalling async runtime
// ---------------------------------------------------------------------------

async fn persist_history(
    history_db: &Arc<tokio::sync::Mutex<rusqlite::Connection>>,
    profile_id: &str,
    profile_name: &str,
    server: &str,
    started_at: &str,
    summary: &MaintenanceSummary,
) {
    let db = history_db.clone();
    let profile_id = profile_id.to_string();
    let profile_name = profile_name.to_string();
    let server = server.to_string();
    let started_at = started_at.to_string();
    let summary = summary.clone();
    let finished_at = chrono::Utc::now().to_rfc3339();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.blocking_lock();
        crate::db::history::insert_run(
            &conn,
            &profile_id,
            &profile_name,
            &server,
            &started_at,
            &finished_at,
            &summary,
        )
    })
    .await;

    match result {
        Ok(Err(e)) => eprintln!("Failed to persist run history: {e}"),
        Err(e) => eprintln!("History persistence task panicked: {e}"),
        _ => {}
    }
}

// ---------------------------------------------------------------------------
// Per-database orchestration
// ---------------------------------------------------------------------------

/// Returns (DatabaseResult, should_stop: bool)
async fn process_database(
    app: &AppHandle,
    profile_id: &str,
    profile: &ServerProfile,
    db_name: &str,
    options: &MaintenanceOptions,
    ctrl_rx: &watch::Receiver<MaintenanceControl>,
    control_txs: &Arc<Mutex<HashMap<String, watch::Sender<MaintenanceControl>>>>,
) -> (DatabaseResult, bool) {
    let db_start = std::time::Instant::now();
    let mut result = DatabaseResult {
        database_name: db_name.to_string(),
        success: true,
        indexes_processed: 0,
        indexes_rebuilt: 0,
        indexes_reorganized: 0,
        indexes_skipped: 0,
        total_duration_secs: 0.0,
        errors: vec![],
        critical_failure: false,
        manually_skipped: false,
        index_results: vec![],
    };

    let mut client =
        match create_client(profile, Some(db_name), options.connection_timeout_ms).await {
            Ok(c) => c,
            Err(e) => {
                result.success = false;
                result.critical_failure = true;
                result.errors.push(format!("Connection failed: {}", e));
                let _ = app.emit(
                    "maintenance:error",
                    MaintenanceErrorEvent {
                        profile_id: profile_id.to_string(),
                        message: format!("{}: {}", db_name, e),
                    },
                );
                result.total_duration_secs = db_start.elapsed().as_secs_f64();
                return (result, false);
            }
        };

    let indexes = match fetch_fragmented_indexes(&mut client, db_name).await {
        Ok(idxs) => idxs,
        Err(e) => {
            result.success = false;
            result.critical_failure = true;
            result.errors.push(format!("Failed to fetch indexes: {}", e));
            let _ = app.emit(
                "maintenance:error",
                MaintenanceErrorEvent {
                    profile_id: profile_id.to_string(),
                    message: format!("{}: {}", db_name, e),
                },
            );
            result.total_duration_secs = db_start.elapsed().as_secs_f64();
            return (result, false);
        }
    };

    for idx in &indexes {
        let _ = app.emit(
            "maintenance:index-found",
            IndexFoundEvent { profile_id: profile_id.to_string(), index: idx.clone() },
        );
    }

    let mut stopped = false;
    let mut manually_skipped = false;

    'indexes: for index in &indexes {
        match check_ctrl(ctrl_rx).await {
            Some(MaintenanceControl::Stop) => {
                stopped = true;
                break 'indexes;
            }
            Some(MaintenanceControl::SkipDatabase) => {
                reset_control(control_txs, profile_id).await;
                emit_control(app, profile_id, "running");
                manually_skipped = true;
                break 'indexes;
            }
            _ => {}
        }

        result.indexes_processed += 1;
        let action = determine_action(
            index.fragmentation_percent,
            options.reorganize_threshold,
            options.rebuild_threshold,
        );

        let _ = app.emit(
            "maintenance:index-action",
            IndexActionEvent {
                profile_id: profile_id.to_string(),
                db_name: index.database_name.clone(),
                schema_name: index.schema_name.clone(),
                table_name: index.table_name.clone(),
                index_name: index.index_name.clone(),
                action: action.clone(),
            },
        );

        if action == MaintenanceAction::Skip {
            result.indexes_skipped += 1;
            result.index_results.push(IndexResult {
                schema_name: index.schema_name.clone(),
                table_name: index.table_name.clone(),
                index_name: index.index_name.clone(),
                fragmentation_percent: index.fragmentation_percent,
                page_count: index.page_count,
                action: action.clone(),
                success: true,
                duration_secs: 0.0,
                retry_attempts: 0,
                error: None,
            });
            let _ = app.emit(
                "maintenance:index-complete",
                IndexCompleteEvent {
                    profile_id: profile_id.to_string(),
                    db_name: index.database_name.clone(),
                    schema_name: index.schema_name.clone(),
                    table_name: index.table_name.clone(),
                    index_name: index.index_name.clone(),
                    action,
                    success: true,
                    duration_secs: 0.0,
                    retry_attempts: 0,
                    error: None,
                },
            );
            continue 'indexes;
        }

        let sql = match action {
            MaintenanceAction::Rebuild => rebuild_index_sql(
                &index.schema_name,
                &index.table_name,
                &index.index_name,
                options.rebuild_online,
            ),
            MaintenanceAction::Reorganize => reorganize_index_sql(
                &index.schema_name,
                &index.table_name,
                &index.index_name,
            ),
            MaintenanceAction::Skip => unreachable!(),
        };

        let op_result = execute_index_operation(&mut client, &sql, options, ctrl_rx).await;

        match op_result {
            IndexOpResult::Interrupted(ctrl) => {
                match ctrl {
                    MaintenanceControl::Stop => stopped = true,
                    MaintenanceControl::SkipDatabase => {
                        reset_control(control_txs, profile_id).await;
                        emit_control(app, profile_id, "running");
                        manually_skipped = true;
                    }
                    _ => {}
                }
                break 'indexes;
            }

            IndexOpResult::Failure { attempts, duration_secs, error: err_msg } => {
                result.success = false;
                result.errors.push(format!(
                    "{}.{}.{}: {}",
                    index.schema_name, index.table_name, index.index_name, err_msg
                ));
                result.index_results.push(IndexResult {
                    schema_name: index.schema_name.clone(),
                    table_name: index.table_name.clone(),
                    index_name: index.index_name.clone(),
                    fragmentation_percent: index.fragmentation_percent,
                    page_count: index.page_count,
                    action: action.clone(),
                    success: false,
                    duration_secs,
                    retry_attempts: attempts,
                    error: Some(err_msg.clone()),
                });
                let _ = app.emit(
                    "maintenance:index-complete",
                    IndexCompleteEvent {
                        profile_id: profile_id.to_string(),
                        db_name: index.database_name.clone(),
                        schema_name: index.schema_name.clone(),
                        table_name: index.table_name.clone(),
                        index_name: index.index_name.clone(),
                        action,
                        success: false,
                        duration_secs,
                        retry_attempts: attempts,
                        error: Some(err_msg),
                    },
                );
            }

            IndexOpResult::Success { attempts, duration_secs } => {
                match action {
                    MaintenanceAction::Rebuild => result.indexes_rebuilt += 1,
                    MaintenanceAction::Reorganize => result.indexes_reorganized += 1,
                    _ => {}
                }

                result.index_results.push(IndexResult {
                    schema_name: index.schema_name.clone(),
                    table_name: index.table_name.clone(),
                    index_name: index.index_name.clone(),
                    fragmentation_percent: index.fragmentation_percent,
                    page_count: index.page_count,
                    action: action.clone(),
                    success: true,
                    duration_secs,
                    retry_attempts: attempts,
                    error: None,
                });

                // Update statistics — best effort, swallow errors
                let stats_sql = update_statistics_sql(
                    &index.schema_name,
                    &index.table_name,
                    &index.index_name,
                );
                let _ = client.execute(stats_sql.as_str(), &[]).await;

                let _ = app.emit(
                    "maintenance:index-complete",
                    IndexCompleteEvent {
                        profile_id: profile_id.to_string(),
                        db_name: index.database_name.clone(),
                        schema_name: index.schema_name.clone(),
                        table_name: index.table_name.clone(),
                        index_name: index.index_name.clone(),
                        action,
                        success: true,
                        duration_secs,
                        retry_attempts: attempts,
                        error: None,
                    },
                );
            }
        }
    }

    // DBCC FREEPROCCACHE — best effort
    if options.free_proc_cache && (result.indexes_rebuilt > 0 || result.indexes_reorganized > 0) {
        let _ = client.execute(FREE_PROC_CACHE, &[]).await;
    }

    result.total_duration_secs = db_start.elapsed().as_secs_f64();
    result.manually_skipped = manually_skipped;

    (result, stopped)
}
