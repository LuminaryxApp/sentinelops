use super::file_ops::ApiResponse;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteTable {
    pub name: String,
    pub table_type: String, // "table" or "view"
    pub row_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteColumn {
    pub cid: i64,
    pub name: String,
    pub column_type: String,
    pub notnull: bool,
    pub dflt_value: Option<String>,
    pub pk: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteIndex {
    pub name: String,
    pub table_name: String,
    pub unique: bool,
    pub columns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: usize,
    pub affected_rows: Option<usize>,
    pub execution_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteSchemaInfo {
    pub tables: Vec<SqliteTable>,
    pub version: String,
    pub database_size: u64,
    pub page_size: i64,
    pub page_count: i64,
}

// ============================================================================
// Commands
// ============================================================================

/// Open a SQLite database and get schema info
#[tauri::command]
pub async fn sqlite_get_schema(path: String) -> Result<ApiResponse<SqliteSchemaInfo>, String> {
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;

    // Get SQLite version
    let version: String = conn.query_row("SELECT sqlite_version()", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    // Get page size and count
    let page_size: i64 = conn.query_row("PRAGMA page_size", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let page_count: i64 = conn.query_row("PRAGMA page_count", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let database_size = (page_size * page_count) as u64;

    // Get tables
    let mut tables: Vec<SqliteTable> = Vec::new();
    let mut stmt = conn.prepare(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let table_iter = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;

    for table_result in table_iter {
        if let Ok((name, table_type)) = table_result {
            // Get row count for tables (not views, as that could be slow)
            let row_count = if table_type == "table" {
                let count_sql = format!("SELECT COUNT(*) FROM \"{}\"", name.replace('"', "\"\""));
                conn.query_row(&count_sql, [], |row| row.get::<_, i64>(0)).ok()
            } else {
                None
            };

            tables.push(SqliteTable {
                name,
                table_type,
                row_count,
            });
        }
    }

    Ok(ApiResponse::success(SqliteSchemaInfo {
        tables,
        version,
        database_size,
        page_size,
        page_count,
    }))
}

/// Get columns for a table
#[tauri::command]
pub async fn sqlite_get_columns(path: String, table: String) -> Result<ApiResponse<Vec<SqliteColumn>>, String> {
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;

    let sql = format!("PRAGMA table_info(\"{}\")", table.replace('"', "\"\""));
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let columns: Vec<SqliteColumn> = stmt.query_map([], |row| {
        Ok(SqliteColumn {
            cid: row.get(0)?,
            name: row.get(1)?,
            column_type: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            notnull: row.get::<_, i32>(3)? != 0,
            dflt_value: row.get(4)?,
            pk: row.get::<_, i32>(5)? != 0,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(ApiResponse::success(columns))
}

/// Get indexes for a table
#[tauri::command]
pub async fn sqlite_get_indexes(path: String, table: String) -> Result<ApiResponse<Vec<SqliteIndex>>, String> {
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;

    let sql = format!("PRAGMA index_list(\"{}\")", table.replace('"', "\"\""));
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let mut indexes: Vec<SqliteIndex> = Vec::new();

    let index_iter = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(1)?, // name
            row.get::<_, i32>(2)? != 0, // unique
        ))
    }).map_err(|e| e.to_string())?;

    for index_result in index_iter {
        if let Ok((name, unique)) = index_result {
            // Get columns for this index
            let col_sql = format!("PRAGMA index_info(\"{}\")", name.replace('"', "\"\""));
            let columns: Vec<String> = conn.prepare(&col_sql)
                .map_err(|e| e.to_string())?
                .query_map([], |row| row.get::<_, String>(2))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();

            indexes.push(SqliteIndex {
                name,
                table_name: table.clone(),
                unique,
                columns,
            });
        }
    }

    Ok(ApiResponse::success(indexes))
}

/// Execute a query and return results
#[tauri::command]
pub async fn sqlite_execute_query(path: String, query: String) -> Result<ApiResponse<SqliteQueryResult>, String> {
    let start_time = std::time::Instant::now();
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;

    // Determine if this is a SELECT or other query
    let trimmed = query.trim().to_uppercase();
    let is_select = trimmed.starts_with("SELECT") ||
                    trimmed.starts_with("PRAGMA") ||
                    trimmed.starts_with("EXPLAIN");

    if is_select {
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

        // Get column names
        let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
        let column_count = columns.len();

        // Fetch rows
        let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
        let mut rows_iter = stmt.query([]).map_err(|e| e.to_string())?;

        while let Some(row) = rows_iter.next().map_err(|e| e.to_string())? {
            let mut row_values: Vec<serde_json::Value> = Vec::new();

            for i in 0..column_count {
                let value = row.get_ref(i).map_err(|e| e.to_string())?;
                let json_value = sqlite_value_to_json(value);
                row_values.push(json_value);
            }

            rows.push(row_values);
        }

        let row_count = rows.len();
        let execution_time_ms = start_time.elapsed().as_millis() as u64;

        Ok(ApiResponse::success(SqliteQueryResult {
            columns,
            rows,
            row_count,
            affected_rows: None,
            execution_time_ms,
        }))
    } else {
        // Execute non-SELECT query
        let affected = conn.execute(&query, []).map_err(|e| e.to_string())?;
        let execution_time_ms = start_time.elapsed().as_millis() as u64;

        Ok(ApiResponse::success(SqliteQueryResult {
            columns: vec![],
            rows: vec![],
            row_count: 0,
            affected_rows: Some(affected),
            execution_time_ms,
        }))
    }
}

/// Get table data with pagination
#[tauri::command]
pub async fn sqlite_get_table_data(
    path: String,
    table: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<ApiResponse<SqliteQueryResult>, String> {
    let start_time = std::time::Instant::now();
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;

    let limit_val = limit.unwrap_or(100);
    let offset_val = offset.unwrap_or(0);

    // Escape table name for SQL
    let safe_table = table.replace('"', "\"\"");
    let query = format!(
        "SELECT * FROM \"{}\" LIMIT {} OFFSET {}",
        safe_table, limit_val, offset_val
    );

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    // Get column names
    let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let column_count = columns.len();

    // Fetch rows
    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    let mut rows_iter = stmt.query([]).map_err(|e| e.to_string())?;

    while let Some(row) = rows_iter.next().map_err(|e| e.to_string())? {
        let mut row_values: Vec<serde_json::Value> = Vec::new();

        for i in 0..column_count {
            let value = row.get_ref(i).map_err(|e| e.to_string())?;
            let json_value = sqlite_value_to_json(value);
            row_values.push(json_value);
        }

        rows.push(row_values);
    }

    let row_count = rows.len();
    let execution_time_ms = start_time.elapsed().as_millis() as u64;

    Ok(ApiResponse::success(SqliteQueryResult {
        columns,
        rows,
        row_count,
        affected_rows: None,
        execution_time_ms,
    }))
}

// ============================================================================
// Helpers
// ============================================================================

fn sqlite_value_to_json(value: rusqlite::types::ValueRef) -> serde_json::Value {
    match value {
        rusqlite::types::ValueRef::Null => serde_json::Value::Null,
        rusqlite::types::ValueRef::Integer(i) => serde_json::json!(i),
        rusqlite::types::ValueRef::Real(f) => serde_json::json!(f),
        rusqlite::types::ValueRef::Text(t) => {
            serde_json::json!(String::from_utf8_lossy(t).to_string())
        }
        rusqlite::types::ValueRef::Blob(b) => {
            // Convert blob to hex string for display
            let hex_str: String = b.iter().map(|byte| format!("{:02x}", byte)).collect();
            serde_json::json!(format!("x'{}'", hex_str))
        }
    }
}
