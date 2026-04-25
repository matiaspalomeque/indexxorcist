use crate::commands::profiles::load_full_profile;
use crate::db::connection::create_client;
use crate::db::queries::fetch_user_databases;
use crate::models::types::ServerProfile;
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
    test_profile(profile).await
}

#[specta::specta]
#[tauri::command]
pub async fn test_profile_connection(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    mut profile: ServerProfile,
    fallback_password_profile_id: Option<String>,
) -> Result<(), String> {
    if profile.password.is_empty() {
        let fallback_id = fallback_password_profile_id
            .as_deref()
            .ok_or_else(|| "Password is required to test this connection".to_string())?;
        let saved = load_full_profile(&app, &state.profile_io_lock, fallback_id).await?;
        profile.password = saved.password;
    }

    if profile.password.is_empty() {
        return Err("Password is required to test this connection".to_string());
    }

    test_profile(profile).await
}

async fn test_profile(profile: ServerProfile) -> Result<(), String> {
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
