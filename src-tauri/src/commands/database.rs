use crate::db::connection::create_client;
use crate::db::queries::fetch_user_databases;
use crate::models::types::ServerProfile;

const DEFAULT_CONNECT_TIMEOUT_MS: u64 = 30_000;

#[specta::specta]
#[tauri::command]
pub async fn test_connection(profile: ServerProfile) -> Result<(), String> {
    let mut client = create_client(&profile, Some("master"), DEFAULT_CONNECT_TIMEOUT_MS).await?;
    client
        .simple_query("SELECT 1")
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[specta::specta]
#[tauri::command]
pub async fn get_databases(profile: ServerProfile) -> Result<Vec<String>, String> {
    let mut client = create_client(&profile, Some("master"), DEFAULT_CONNECT_TIMEOUT_MS).await?;
    fetch_user_databases(&mut client).await
}
