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

fn load_disk_profiles(app: &tauri::AppHandle) -> Vec<ServerProfileOnDisk> {
    let path = profiles_path(app);
    if !path.exists() {
        return vec![];
    }
    let content = fs::read_to_string(path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_default()
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

    let disk_profiles = load_disk_profiles(&app);
    let password_map = load_password_map();

    let profiles = disk_profiles
        .into_iter()
        .map(|p| {
            let pw = password_map.get(&p.id).cloned().unwrap_or_default();
            p.into_profile(pw)
        })
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
    let mut profiles = load_disk_profiles(&app);
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
    let mut profiles = load_disk_profiles(&app);
    profiles.retain(|p| p.id != id);
    write_disk_profiles(&app, &profiles)
}
