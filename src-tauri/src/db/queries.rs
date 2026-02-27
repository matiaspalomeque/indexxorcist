use crate::models::types::IndexInfo;
use tiberius::{Client, Row};
use tokio::net::TcpStream;
use tokio_util::compat::Compat;

pub const GET_USER_DATABASES: &str = "
    SELECT name
    FROM sys.databases
    WHERE database_id > 4
      AND state_desc = 'ONLINE'
      AND name NOT IN ('master', 'tempdb', 'model', 'msdb')
    ORDER BY name;
";

pub const GET_FRAGMENTED_INDEXES: &str = "
    SELECT
      s.name AS SchemaName,
      t.name AS TableName,
      i.name AS IndexName,
      CAST(ips.avg_fragmentation_in_percent AS float) AS FragmentationPercent,
      CAST(ips.page_count AS bigint) AS PageCount
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') AS ips
    INNER JOIN sys.indexes AS i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
    INNER JOIN sys.tables AS t ON i.object_id = t.object_id
    INNER JOIN sys.schemas AS s ON t.schema_id = s.schema_id
    WHERE ips.index_id > 0
      AND ips.page_count > 100
      AND t.is_ms_shipped = 0
      AND i.name IS NOT NULL
    ORDER BY ips.avg_fragmentation_in_percent DESC;
";

pub const FREE_PROC_CACHE: &str = "DBCC FREEPROCCACHE;";

/// Escapes a SQL Server identifier for use inside `[...]` brackets.
/// A `]` inside an identifier is escaped as `]]`.
fn bracket_escape(s: &str) -> String {
    s.replace(']', "]]")
}

pub fn rebuild_index_sql(schema: &str, table: &str, index: &str, online: bool) -> String {
    format!(
        "ALTER INDEX [{}] ON [{}].[{}] REBUILD WITH (ONLINE = {});",
        bracket_escape(index),
        bracket_escape(schema),
        bracket_escape(table),
        if online { "ON" } else { "OFF" }
    )
}

pub fn reorganize_index_sql(schema: &str, table: &str, index: &str) -> String {
    format!(
        "ALTER INDEX [{}] ON [{}].[{}] REORGANIZE;",
        bracket_escape(index),
        bracket_escape(schema),
        bracket_escape(table),
    )
}

pub fn update_statistics_sql(schema: &str, table: &str, index: &str) -> String {
    format!(
        "UPDATE STATISTICS [{}].[{}] [{}] WITH FULLSCAN;",
        bracket_escape(schema),
        bracket_escape(table),
        bracket_escape(index),
    )
}

fn row_to_index_info(row: &Row, db_name: &str) -> Option<IndexInfo> {
    let schema_name: &str = row.get(0)?;
    let table_name: &str = row.get(1)?;
    let index_name: &str = row.get(2)?;
    let frag_percent = row
        .get::<f64, _>(3)
        .or_else(|| row.get::<f32, _>(3).map(f64::from))?;
    let page_count = row
        .get::<i64, _>(4)
        .or_else(|| row.get::<i32, _>(4).map(i64::from))?;

    Some(IndexInfo {
        database_name: db_name.to_string(),
        schema_name: schema_name.to_string(),
        table_name: table_name.to_string(),
        index_name: index_name.to_string(),
        fragmentation_percent: frag_percent,
        page_count,
    })
}

pub async fn fetch_fragmented_indexes(
    client: &mut Client<Compat<TcpStream>>,
    db_name: &str,
) -> Result<Vec<IndexInfo>, String> {
    let stream = client
        .query(GET_FRAGMENTED_INDEXES, &[])
        .await
        .map_err(|e| e.to_string())?;

    let rows = stream.into_results().await.map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .flatten()
        .filter_map(|row| row_to_index_info(&row, db_name))
        .collect())
}

pub async fn fetch_user_databases(
    client: &mut Client<Compat<TcpStream>>,
) -> Result<Vec<String>, String> {
    let stream = client
        .query(GET_USER_DATABASES, &[])
        .await
        .map_err(|e| e.to_string())?;

    let rows = stream.into_results().await.map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .flatten()
        .filter_map(|row| {
            let name: Option<&str> = row.get(0);
            name.map(|s| s.to_string())
        })
        .collect())
}
