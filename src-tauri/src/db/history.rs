use crate::models::types::{DatabaseResult, MaintenanceSummary, RunRecord};
use rusqlite::{params, Connection, Result};

// Numbered, idempotent-in-order schema migrations. Each slot index + 1 is the
// target PRAGMA user_version it installs. Appending a new entry is the only
// way to evolve the schema — never edit or reorder existing ones.
const MIGRATIONS: &[&str] = &[
    // v1 — initial run_history table (pre-database_results column).
    "CREATE TABLE IF NOT EXISTS run_history (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id                TEXT    NOT NULL,
        profile_name              TEXT    NOT NULL,
        server                    TEXT    NOT NULL,
        started_at                TEXT    NOT NULL,
        finished_at               TEXT    NOT NULL,
        databases_processed       INTEGER NOT NULL DEFAULT 0,
        databases_failed          INTEGER NOT NULL DEFAULT 0,
        databases_skipped         INTEGER NOT NULL DEFAULT 0,
        total_indexes_rebuilt     INTEGER NOT NULL DEFAULT 0,
        total_indexes_reorganized INTEGER NOT NULL DEFAULT 0,
        total_indexes_skipped     INTEGER NOT NULL DEFAULT 0,
        total_duration_secs       REAL    NOT NULL DEFAULT 0
    );",
    // v2 — per-run JSON blob of per-database results.
    "ALTER TABLE run_history ADD COLUMN database_results TEXT NOT NULL DEFAULT '[]';",
    // v3 — composite index for `WHERE profile_id = ? ORDER BY id DESC`.
    "CREATE INDEX IF NOT EXISTS idx_run_history_profile_id_desc
     ON run_history (profile_id, id DESC);",
];

pub fn run_migrations(conn: &Connection) -> Result<()> {
    bootstrap_legacy_version(conn)?;
    let mut current: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    for (i, sql) in MIGRATIONS.iter().enumerate() {
        let target = (i + 1) as i64;
        if target > current {
            // Bundle the schema change and version stamp into a single
            // transaction so a crash between them can't leave the DB at the
            // new shape with the old version — which would re-run the same
            // migration on next startup and fail (e.g. duplicate ADD COLUMN).
            // user_version doesn't accept bound parameters; safe to format
            // because target is derived from a static slice index, not input.
            conn.execute_batch(&format!(
                "BEGIN;\n{sql}\nPRAGMA user_version = {target};\nCOMMIT;"
            ))?;
            current = target;
        }
    }
    Ok(())
}

/// Pre-`user_version` users may already have run_history at v1 or v2 shape
/// with `user_version = 0`. Detect the shape once and stamp the correct
/// version so the numbered migration loop can pick up from there.
fn bootstrap_legacy_version(conn: &Connection) -> Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version != 0 {
        return Ok(());
    }
    let table_exists: bool = conn
        .prepare(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='run_history'",
        )?
        .query_row([], |row| row.get::<_, i64>(0))
        .map(|count| count > 0)?;
    if !table_exists {
        return Ok(());
    }
    let has_results_col: bool = conn
        .prepare(
            "SELECT COUNT(*) FROM pragma_table_info('run_history') WHERE name='database_results'",
        )?
        .query_row([], |row| row.get::<_, i64>(0))
        .map(|count| count > 0)?;
    let inferred = if has_results_col { 2 } else { 1 };
    conn.execute_batch(&format!("PRAGMA user_version = {inferred};"))?;
    Ok(())
}

pub fn insert_run(
    conn: &Connection,
    profile_id: &str,
    profile_name: &str,
    server: &str,
    started_at: &str,
    finished_at: &str,
    summary: &MaintenanceSummary,
) -> Result<()> {
    let db_results_json =
        serde_json::to_string(&summary.database_results).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "INSERT INTO run_history (
            profile_id, profile_name, server, started_at, finished_at,
            databases_processed, databases_failed, databases_skipped,
            total_indexes_rebuilt, total_indexes_reorganized, total_indexes_skipped,
            total_duration_secs, database_results
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            profile_id,
            profile_name,
            server,
            started_at,
            finished_at,
            summary.databases_processed,
            summary.databases_failed,
            summary.databases_skipped,
            summary.total_indexes_rebuilt,
            summary.total_indexes_reorganized,
            summary.total_indexes_skipped,
            summary.total_duration_secs,
            db_results_json,
        ],
    )?;
    Ok(())
}

pub fn get_runs(
    conn: &Connection,
    profile_id: Option<&str>,
    limit: u32,
) -> Result<Vec<RunRecord>> {
    let (sql, params_opt): (&str, Option<&str>) = match profile_id {
        Some(id) => (
            "SELECT id, profile_id, profile_name, server, started_at, finished_at,
                databases_processed, databases_failed, databases_skipped,
                total_indexes_rebuilt, total_indexes_reorganized, total_indexes_skipped,
                total_duration_secs, database_results
             FROM run_history WHERE profile_id = ?1 ORDER BY id DESC LIMIT ?2",
            Some(id),
        ),
        None => (
            "SELECT id, profile_id, profile_name, server, started_at, finished_at,
                databases_processed, databases_failed, databases_skipped,
                total_indexes_rebuilt, total_indexes_reorganized, total_indexes_skipped,
                total_duration_secs, database_results
             FROM run_history ORDER BY id DESC LIMIT ?1",
            None,
        ),
    };

    let mut stmt = conn.prepare(sql)?;

    let rows = if let Some(id) = params_opt {
        stmt.query_map(params![id, limit], row_to_record)?
            .collect::<Result<Vec<_>>>()
    } else {
        stmt.query_map(params![limit], row_to_record)?
            .collect::<Result<Vec<_>>>()
    };

    rows
}

fn row_to_record(row: &rusqlite::Row) -> Result<RunRecord> {
    let db_results_json: String = row.get(13).unwrap_or_else(|_| "[]".to_string());
    let database_results: Vec<DatabaseResult> =
        serde_json::from_str(&db_results_json).unwrap_or_default();

    Ok(RunRecord {
        id: row.get(0)?,
        profile_id: row.get(1)?,
        profile_name: row.get(2)?,
        server: row.get(3)?,
        started_at: row.get(4)?,
        finished_at: row.get(5)?,
        databases_processed: row.get::<_, i64>(6)? as u32,
        databases_failed: row.get::<_, i64>(7)? as u32,
        databases_skipped: row.get::<_, i64>(8)? as u32,
        total_indexes_rebuilt: row.get::<_, i64>(9)? as u32,
        total_indexes_reorganized: row.get::<_, i64>(10)? as u32,
        total_indexes_skipped: row.get::<_, i64>(11)? as u32,
        total_duration_secs: row.get(12)?,
        database_results,
    })
}

pub fn delete_runs(conn: &Connection, profile_id: Option<&str>) -> Result<()> {
    match profile_id {
        Some(id) => {
            conn.execute("DELETE FROM run_history WHERE profile_id = ?1", params![id])?;
        }
        None => {
            conn.execute("DELETE FROM run_history", [])?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod migration_tests {
    use super::*;

    fn user_version(conn: &Connection) -> i64 {
        conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap()
    }

    fn has_column(conn: &Connection, column: &str) -> bool {
        conn.prepare("SELECT COUNT(*) FROM pragma_table_info('run_history') WHERE name=?1")
            .unwrap()
            .query_row(params![column], |row| row.get::<_, i64>(0))
            .map(|c| c > 0)
            .unwrap()
    }

    fn has_index(conn: &Connection, name: &str) -> bool {
        conn.prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name=?1")
            .unwrap()
            .query_row(params![name], |row| row.get::<_, i64>(0))
            .map(|c| c > 0)
            .unwrap()
    }

    #[test]
    fn fresh_database_migrates_to_latest() {
        let conn = Connection::open_in_memory().unwrap();
        assert_eq!(user_version(&conn), 0);

        run_migrations(&conn).unwrap();

        assert_eq!(user_version(&conn), MIGRATIONS.len() as i64);
        assert!(has_column(&conn, "database_results"));
        assert!(has_index(&conn, "idx_run_history_profile_id_desc"));
    }

    #[test]
    fn legacy_v1_shape_is_detected_and_migrated() {
        // Pre-user_version DB at v1 shape (no database_results column).
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(MIGRATIONS[0]).unwrap();
        assert_eq!(user_version(&conn), 0);
        assert!(!has_column(&conn, "database_results"));

        run_migrations(&conn).unwrap();

        assert_eq!(user_version(&conn), MIGRATIONS.len() as i64);
        assert!(has_column(&conn, "database_results"));
        assert!(has_index(&conn, "idx_run_history_profile_id_desc"));
    }

    #[test]
    fn legacy_v2_shape_is_detected_without_duplicate_column() {
        // Pre-user_version DB at v2 shape (table already has database_results).
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(MIGRATIONS[0]).unwrap();
        conn.execute_batch(MIGRATIONS[1]).unwrap();
        assert_eq!(user_version(&conn), 0);
        assert!(has_column(&conn, "database_results"));

        run_migrations(&conn).unwrap();

        assert_eq!(user_version(&conn), MIGRATIONS.len() as i64);
        assert!(has_index(&conn, "idx_run_history_profile_id_desc"));
    }

    #[test]
    fn migrations_are_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let after_first = user_version(&conn);
        run_migrations(&conn).unwrap();
        assert_eq!(user_version(&conn), after_first);
    }
}
