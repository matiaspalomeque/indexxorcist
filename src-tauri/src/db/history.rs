use crate::models::types::{DatabaseResult, MaintenanceSummary, RunRecord};
use rusqlite::{params, Connection, Result};

pub fn create_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(
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
            total_duration_secs       REAL    NOT NULL DEFAULT 0,
            database_results          TEXT    NOT NULL DEFAULT '[]'
        );",
    )?;

    // Per-column migration: each new column gets its own pragma_table_info check.
    // If more columns are added in the future, consider replacing this with a
    // schema_version table and sequential numbered migrations.
    let has_col: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('run_history') WHERE name='database_results'")?
        .query_row([], |row| row.get::<_, i64>(0))
        .map(|count| count > 0)?;
    if !has_col {
        conn.execute_batch(
            "ALTER TABLE run_history ADD COLUMN database_results TEXT NOT NULL DEFAULT '[]';",
        )?;
    }

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
