use anyhow::Result as AnyhowResult;
use sqlx::sqlite::SqlitePool;
use std::path::PathBuf;
use tauri::{State, Manager};

/// Shared application state wrapping the SQLite connection pool.
/// This is managed by Tauri and accessible from all commands via `State<'_, DbState>`.
pub struct DbState(pub SqlitePool);

/// Initializes the SQLite database at the given path and runs migrations.
///
/// The database file is created in the user's data directory under a
/// `pharmalocal` folder. If this is the first run, the migrations are applied
/// to set up the schema.
pub async fn init_db(app: &tauri::App) -> AnyhowResult<DbState> {
    let data_dir = app.path().app_data_dir()
        .unwrap_or_else(|_| {
            // Fallback: use executable directory
            let exe = std::env::current_exe().unwrap_or(PathBuf::from("."));
            exe.parent().unwrap().to_path_buf()
        });

    std::fs::create_dir_all(&data_dir).map_err(|e| {
        anyhow::anyhow!("Failed to create data directory: {}", e)
    })?;

    let db_path = data_dir.join("pharmalocal.db");
    let db_url = format!("sqlite://{}", db_path.display());

    // Create connection pool
    let pool = SqlitePool::connect(&db_url).await?;

    // Enable foreign keys
    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(&pool)
        .await?;

    // Run migrations from the bundled migrations directory
    let migrations = sqlx::migrate!("./migrations");
    migrations.run(&pool).await?;

    Ok(DbState(pool))
}

/// Returns a reference to the inner SqlitePool.
/// Convenience for extracting the pool from Tauri state inside submodules.
pub fn get_pool<'a>(state: &'a State<'a, DbState>) -> &'a SqlitePool {
    &state.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_db_state_wraps_pool() {
        // In-memory SQLite pool for testing
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        let db = DbState(pool);
        // Verify we can run a simple query
        let result: (i64,) = sqlx::query_as("SELECT 1")
            .fetch_one(&db.0)
            .await
            .unwrap();
        assert_eq!(result.0, 1i64);
    }
}
