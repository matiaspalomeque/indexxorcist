use crate::models::types::{ServerProfile, ServerProfileOnDisk};
use crate::AppState;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{Manager, State};

const KEYRING_SERVICE: &str = "indexxorcist";
const KEYRING_ACCOUNT: &str = "passwords";

fn profiles_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("Failed to get app data dir")
        .join("profiles.json")
}

fn load_disk_profiles(app: &tauri::AppHandle) -> Result<Vec<ServerProfileOnDisk>, String> {
    let path = profiles_path(app);
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read profiles file: {e}"))?;
    serde_json::from_str(&content).map_err(|e| {
        format!(
            "Profiles file is corrupted ({e}); the file may need to be repaired or deleted at {}",
            path.display()
        )
    })
}

/// Load a fully-populated profile (including password from keychain) by ID.
/// Holds the profile I/O lock for the duration of the read.
pub async fn load_full_profile(
    app: &tauri::AppHandle,
    profile_io_lock: &tokio::sync::Mutex<()>,
    profile_id: &str,
) -> Result<ServerProfile, String> {
    let _guard = profile_io_lock.lock().await;
    let disk_profiles = load_disk_profiles(app)?;
    let disk_profile = disk_profiles
        .into_iter()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| format!("Profile '{profile_id}' not found"))?;
    let password_map = load_password_map();
    let password = password_map.get(profile_id).cloned().unwrap_or_default();
    Ok(disk_profile.into_profile(password))
}

fn write_disk_profiles(
    app: &tauri::AppHandle,
    profiles: &[ServerProfileOnDisk],
) -> Result<(), String> {
    let path = profiles_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(profiles).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

/// Read the consolidated password map from a single keychain entry.
fn load_password_map() -> HashMap<String, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT);
    match entry {
        Ok(entry) => {
            let json = entry.get_password().unwrap_or_default();
            if json.is_empty() {
                return HashMap::new();
            }
            serde_json::from_str(&json).unwrap_or_default()
        }
        Err(_) => HashMap::new(),
    }
}

/// Write the consolidated password map to a single keychain entry.
fn save_password_map(map: &HashMap<String, String>) {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT);
    if let Ok(entry) = entry {
        let json = serde_json::to_string(map).unwrap_or_default();
        if let Err(e) = entry.set_password(&json) {
            eprintln!("Failed to store consolidated passwords in keychain: {e}");
        }
    }
}

fn store_password(profile_id: &str, password: &str) {
    // Empty password means "do not update" — preserves the existing keychain entry.
    // SQL Server auth always requires a password, so an empty value here signals
    // that the user left the field blank during an edit (intending no change).
    if password.is_empty() {
        return;
    }
    let mut map = load_password_map();
    map.insert(profile_id.to_string(), password.to_string());
    save_password_map(&map);
}

fn delete_password(profile_id: &str) {
    let mut map = load_password_map();
    if map.remove(profile_id).is_some() {
        save_password_map(&map);
    }
}

#[specta::specta]
#[tauri::command]
pub async fn get_server_profiles(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<ServerProfile>, String> {
    let _guard = state.profile_io_lock.lock().await;

    // Passwords are never returned to the frontend — they live only in the OS keychain
    // and are fetched server-side when a connection is actually needed.
    let profiles = load_disk_profiles(&app)?
        .into_iter()
        .map(|p| p.into_profile(String::new()))
        .collect();

    Ok(profiles)
}

#[specta::specta]
#[tauri::command]
pub async fn save_server_profile(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    profile: ServerProfile,
) -> Result<(), String> {
    let _guard = state.profile_io_lock.lock().await;

    // Store password in OS keychain; never write it to profiles.json
    store_password(&profile.id, &profile.password);

    let disk_profile = ServerProfileOnDisk::from(profile.clone());
    let mut profiles = load_disk_profiles(&app)?;
    match profiles.iter_mut().find(|p| p.id == disk_profile.id) {
        Some(existing) => *existing = disk_profile,
        None => profiles.push(disk_profile),
    }
    write_disk_profiles(&app, &profiles)
}

#[specta::specta]
#[tauri::command]
pub async fn delete_server_profile(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let _guard = state.profile_io_lock.lock().await;
    delete_password(&id);
    let mut profiles = load_disk_profiles(&app)?;
    profiles.retain(|p| p.id != id);
    write_disk_profiles(&app, &profiles)
}
