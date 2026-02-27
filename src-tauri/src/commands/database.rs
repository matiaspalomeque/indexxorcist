use crate::commands::profiles::load_full_profile;
use crate::db::connection::create_client;
use crate::db::queries::fetch_user_databases;
use crate::AppState;
use tauri::State;

const DEFAULT_CONNECT_TIMEOUT_MS: u64 = 30_000;

#[specta::specta]
#[tauri::command]
pub async fn test_connection(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<(), String> {
    let profile = load_full_profile(&app, &state.profile_io_lock, &profile_id).await?;
    let mut client = create_client(&profile, Some("master"), DEFAULT_CONNECT_TIMEOUT_MS).await?;
    client
        .simple_query("SELECT 1")
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[specta::specta]
#[tauri::command]
pub async fn get_databases(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<Vec<String>, String> {
    let profile = load_full_profile(&app, &state.profile_io_lock, &profile_id).await?;
    let mut client = create_client(&profile, Some("master"), DEFAULT_CONNECT_TIMEOUT_MS).await?;
    fetch_user_databases(&mut client).await
}
