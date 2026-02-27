use crate::models::types::RunRecord;
use crate::AppState;
use std::sync::Arc;
use tauri::State;

#[specta::specta]
#[tauri::command]
pub async fn get_run_history(
    state: State<'_, AppState>,
    profile_id: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<RunRecord>, String> {
    let history_db = state.history_db.clone();
    run_blocking(history_db, move |conn| {
        crate::db::history::get_runs(&conn, profile_id.as_deref(), limit.unwrap_or(200))
    })
    .await
}

#[specta::specta]
#[tauri::command]
pub async fn clear_run_history(
    state: State<'_, AppState>,
    profile_id: Option<String>,
) -> Result<(), String> {
    let history_db = state.history_db.clone();
    run_blocking(history_db, move |conn| {
        crate::db::history::delete_runs(&conn, profile_id.as_deref())
    })
    .await
}

/// Runs a synchronous SQLite operation on a blocking thread to avoid stalling
/// the async runtime. Acquires the mutex via `blocking_lock` inside `spawn_blocking`.
async fn run_blocking<T, F>(
    db: Arc<tokio::sync::Mutex<rusqlite::Connection>>,
    f: F,
) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(tokio::sync::MutexGuard<'_, rusqlite::Connection>) -> rusqlite::Result<T>
        + Send
        + 'static,
{
    tokio::task::spawn_blocking(move || {
        let conn = db.blocking_lock();
        f(conn).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}
