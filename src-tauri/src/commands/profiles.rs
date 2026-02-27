use crate::models::types::{ServerProfile, ServerProfileOnDisk};
use crate::AppState;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{Manager, State};

const KEYRING_SERVICE: &str = "indexxorcist";

fn profiles_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("Failed to get app data dir")
        .join("profiles.json")
}

/// Legacy passwords.json path — used only for one-time migration to keychain.
fn legacy_passwords_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("Failed to get app data dir")
        .join("passwords.json")
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

/// Load the legacy passwords.json (if it exists) for one-time migration.
fn load_legacy_passwords(app: &tauri::AppHandle) -> HashMap<String, String> {
    let path = legacy_passwords_path(app);
    if !path.exists() {
        return HashMap::new();
    }
    let content = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_default()
}

/// Delete passwords.json after all entries have been migrated to keychain.
fn remove_legacy_passwords_file(app: &tauri::AppHandle) {
    let path = legacy_passwords_path(app);
    if path.exists() {
        let _ = fs::remove_file(path);
    }
}

fn store_password(profile_id: &str, password: &str) {
    if password.is_empty() {
        return;
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, profile_id);
    if let Ok(entry) = entry {
        if let Err(e) = entry.set_password(password) {
            eprintln!("Failed to store password in keychain for {profile_id}: {e}");
        }
    }
}

fn retrieve_password(profile_id: &str) -> String {
    let entry = keyring::Entry::new(KEYRING_SERVICE, profile_id);
    match entry {
        Ok(entry) => entry.get_password().unwrap_or_default(),
        Err(_) => String::new(),
    }
}

fn delete_password(profile_id: &str) {
    let entry = keyring::Entry::new(KEYRING_SERVICE, profile_id);
    if let Ok(entry) = entry {
        let _ = entry.delete_credential();
    }
}

#[specta::specta]
#[tauri::command]
pub async fn get_server_profiles(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<ServerProfile>, String> {
    let _guard = state.profile_io_lock.lock().await;

    // Load legacy passwords.json (if any) for one-time migration to keychain.
    let mut legacy_passwords = load_legacy_passwords(&app);

    let disk_profiles = load_disk_profiles(&app);
    let profiles = disk_profiles
        .into_iter()
        .map(|mut p| {
            let pw = match p.password.take() {
                // Migration path 1: password was embedded in profiles.json (oldest format)
                Some(legacy_pw) if !legacy_pw.is_empty() => {
                    store_password(&p.id, &legacy_pw);
                    legacy_pw
                }
                _ => {
                    // Try keychain first
                    let keychain_pw = retrieve_password(&p.id);
                    if !keychain_pw.is_empty() {
                        keychain_pw
                    } else if let Some(json_pw) = legacy_passwords.remove(&p.id) {
                        // Migration path 2: password was in passwords.json (intermediate format)
                        if !json_pw.is_empty() {
                            store_password(&p.id, &json_pw);
                        }
                        json_pw
                    } else {
                        String::new()
                    }
                }
            };
            p.into_profile(pw)
        })
        .collect();

    // Clean up passwords.json after migrating all entries
    remove_legacy_passwords_file(&app);

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
