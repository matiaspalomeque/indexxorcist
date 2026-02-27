use std::collections::HashMap;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::{watch, Mutex};

pub mod commands;
pub mod db;
pub mod models;

#[derive(Debug, Clone, PartialEq)]
pub enum MaintenanceControl {
    Running,
    Paused,
    SkipDatabase,
    Stop,
}

pub struct AppState {
    pub control_txs: Arc<Mutex<HashMap<String, watch::Sender<MaintenanceControl>>>>,
    /// Serializes profile file reads and writes to prevent concurrent save races.
    pub profile_io_lock: Arc<Mutex<()>>,
    /// SQLite connection for run history persistence.
    pub history_db: Arc<tokio::sync::Mutex<rusqlite::Connection>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri_specta::Builder::<tauri::Wry>::new().commands(
        tauri_specta::collect_commands![
            commands::profiles::get_server_profiles,
            commands::profiles::save_server_profile,
            commands::profiles::delete_server_profile,
            commands::database::test_connection,
            commands::database::get_databases,
            commands::maintenance::run_maintenance,
            commands::maintenance::pause_maintenance,
            commands::maintenance::resume_maintenance,
            commands::maintenance::skip_database,
            commands::maintenance::stop_maintenance,
            commands::history::get_run_history,
            commands::history::clear_run_history,
        ],
    );

    #[cfg(debug_assertions)]
    builder
        .export(
            specta_typescript::Typescript::default()
                .bigint(specta_typescript::BigIntExportBehavior::Number),
            "../src/bindings.ts",
        )
        .expect("Failed to export TypeScript bindings");

    tauri::Builder::default()
        .setup(|app| {
            let db_path = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir")
                .join("history.db");
            std::fs::create_dir_all(db_path.parent().unwrap())
                .expect("Failed to create app data dir");
            let conn = rusqlite::Connection::open(&db_path)
                .expect("Failed to open history database");
            db::history::create_tables(&conn).expect("Failed to create history tables");

            app.manage(AppState {
                control_txs: Arc::new(Mutex::new(HashMap::new())),
                profile_io_lock: Arc::new(Mutex::new(())),
                history_db: Arc::new(tokio::sync::Mutex::new(conn)),
            });
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
