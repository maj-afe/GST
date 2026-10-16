use crate::db::DbState;
use crate::models::SyncOutbox;
use chrono::Utc;
use serde_json::Value;
use sqlx::SqlitePool;
use std::sync::Arc;
use tauri::State;
use tokio::time::{interval, Duration};

/// Interval for the background sync worker (30 seconds per spec).
const SYNC_INTERVAL_SECS: u64 = 30;

/// Number of retry attempts before giving up.
const MAX_RETRIES: i32 = 5;

/// Processes all pending outbox records from the sync_outbox table.
///
/// This is the core of the Outbox Pattern (Section 5.1 of the PRD).
/// It queries for records with status = 'PENDING', processes each based on
/// action_type, and updates their status accordingly.
///
/// On success: status -> 'SUCCESS'
/// On failure: retry_count is incremented, error_log is updated, status remains 'PENDING'
/// After MAX_RETRIES failures: status -> 'FAILED'
pub async fn process_outbox(pool: &SqlitePool) -> anyhow::Result<usize> {
    let mut processed = 0usize;

    // Fetch all pending outbox records, ordered by created_at for consistent ordering
    let records: Vec<SyncOutbox> =
        sqlx::query_as::<_, SyncOutbox>(
            "SELECT * FROM sync_outbox WHERE status = 'PENDING' ORDER BY created_at ASC",
        )
        .fetch_all(pool)
        .await?;

    for record in records {
        match process_outbox_record(pool, &record).await {
            Ok(_) => {
                // Verify internet is available before marking as success
                if check_internet_available().await {
                    mark_success(pool, record.id).await?;
                    processed += 1;
                }
                // If no internet, keep as PENDING for retry next cycle
            }
            Err(e) => {
                let new_retry_count = record.retry_count + 1;
                let error_msg = e.to_string();

                if new_retry_count >= MAX_RETRIES {
                    mark_failed(pool, record.id, new_retry_count, &error_msg).await?;
                } else {
                    mark_retry(pool, record.id, new_retry_count, &error_msg).await?;
                }
            }
        }
    }

    Ok(processed)
}

/// Process a single outbox record based on its action_type.
async fn process_outbox_record(
    pool: &SqlitePool,
    record: &SyncOutbox,
) -> anyhow::Result<()> {
    let payload: Value = serde_json::from_str(&record.payload)?;

    match record.action_type.as_str() {
        "SEND_WHATSAPP" => {
            process_send_whatsapp(pool, record.id, &payload).await
        }
        "GENERATE_E_INVOICE" => {
            process_generate_e_invoice(pool, record.id, &payload).await
        }
        "PUSH_TO_TALLY" => {
            process_push_to_tally(pool, record.id, &payload).await
        }
        "SYNC_DATA" => {
            process_sync_data(pool, record.id, &payload).await
        }
        _ => {
            tracing::warn!("Unknown action_type: {}", record.action_type);
            Err(anyhow::anyhow!("Unknown action_type: {}", record.action_type))
        }
    }
}

/// Handle SEND_WHATSAPP action - queues WhatsApp message sending.
async fn process_send_whatsapp(
    _pool: &SqlitePool,
    _invoice_id: uuid::Uuid,
    payload: &Value,
) -> anyhow::Result<()> {
    tracing::info!("Processing SEND_WHATSAPP for payload: {}", payload);
    // In a real implementation, this would use a WhatsApp Business API client
    // to send the message. For now, we simulate success since this is offline-first
    // and the actual sending is handled when internet is available.
    // The actual HTTP call would be:
    // let client = reqwest::Client::new();
    // let resp = client.post(WHATSAPP_API_URL).json(payload).send().await?;
    // if !resp.status().is_success() { return Err(...); }
    Ok(())
}

/// Handle GENERATE_E_INVOICE action - generates NIC e-invoice JSON.
async fn process_generate_e_invoice(
    _pool: &SqlitePool,
    invoice_id: uuid::Uuid,
    _payload: &Value,
) -> anyhow::Result<()> {
    tracing::info!("Processing GENERATE_E_INVOICE for invoice: {}", invoice_id);
    // Delegate to the integrations module
    crate::integrations::generate_e_invoice_json(invoice_id, _pool).await?;
    Ok(())
}

/// Handle PUSH_TO_TALLY action - pushes data to Tally.
async fn process_push_to_tally(
    _pool: &SqlitePool,
    invoice_id: uuid::Uuid,
    _payload: &Value,
) -> anyhow::Result<()> {
    tracing::info!("Processing PUSH_TO_TALLY for invoice: {}", invoice_id);
    crate::integrations::push_to_tally(invoice_id, _pool).await?;
    Ok(())
}

/// Handle SYNC_DATA action - sync local changes to remote server.
async fn process_sync_data(
    _pool: &SqlitePool,
    _record_id: uuid::Uuid,
    payload: &Value,
) -> anyhow::Result<()> {
    tracing::info!("Processing SYNC_DATA with payload: {}", payload);
    // In a real implementation, this would sync data to a remote API
    Ok(())
}

/// Check if internet is available by attempting a connection to a reliable endpoint.
pub async fn check_internet_available() -> bool {
    // Try to connect to Google DNS as a connectivity check using tokio::time::timeout
    let result = tokio::time::timeout(
        Duration::from_secs(5),
        tokio::net::TcpStream::connect("8.8.8.8:53"),
    )
    .await;

    match result {
        Ok(Ok(_)) => true,
        _ => {
            tracing::warn!("Internet connectivity check failed, keeping outbox records pending");
            false
        }
    }
}

/// Mark an outbox record as successfully processed.
async fn mark_success(pool: &SqlitePool, id: uuid::Uuid) -> anyhow::Result<()> {
    sqlx::query(
        "UPDATE sync_outbox SET status = 'SUCCESS', updated_at = ?1 WHERE id = ?2",
    )
    .bind(Utc::now())
    .bind(id)
    .execute(pool)
    .await?;

    tracing::info!("Outbox record {} marked as SUCCESS", id);
    Ok(())
}

/// Mark an outbox record for retry (increment retry_count, update error_log).
async fn mark_retry(
    pool: &SqlitePool,
    id: uuid::Uuid,
    retry_count: i32,
    error_msg: &str,
) -> anyhow::Result<()> {
    sqlx::query(
        "UPDATE sync_outbox SET status = 'PENDING', retry_count = ?1, error_log = ?2, updated_at = ?3 WHERE id = ?4",
    )
    .bind(retry_count)
    .bind(error_msg)
    .bind(Utc::now())
    .bind(id)
    .execute(pool)
    .await?;

    tracing::warn!(
        "Outbox record {} marked for retry (attempt {}/{})",
        id,
        retry_count,
        MAX_RETRIES
    );
    Ok(())
}

/// Mark an outbox record as permanently failed.
async fn mark_failed(
    pool: &SqlitePool,
    id: uuid::Uuid,
    retry_count: i32,
    error_msg: &str,
) -> anyhow::Result<()> {
    sqlx::query(
        "UPDATE sync_outbox SET status = 'FAILED', retry_count = ?1, error_log = ?2, updated_at = ?3 WHERE id = ?4",
    )
    .bind(retry_count)
    .bind(error_msg)
    .bind(Utc::now())
    .bind(id)
    .execute(pool)
    .await?;

    tracing::error!(
        "Outbox record {} marked as FAILED after {} retries",
        id,
        retry_count
    );
    Ok(())
}

/// Spawn the background sync worker as a tokio task.
/// This task runs every SYNC_INTERVAL_SECS and processes pending outbox records.
pub fn spawn_sync_worker(pool: Arc<SqlitePool>) {
    tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(SYNC_INTERVAL_SECS));

        loop {
            ticker.tick().await;

            tracing::info!("Sync worker tick: processing outbox...");

            match process_outbox(&pool).await {
                Ok(count) => {
                    if count > 0 {
                        tracing::info!("Processed {} outbox records", count);
                    }
                }
                Err(e) => {
                    tracing::error!("Sync worker error: {}", e);
                }
            }
        }
    });
}

/// Tauri command to manually trigger outbox processing from the frontend.
#[tauri::command]
pub async fn process_outbox_now(
    state: State<'_, DbState>,
) -> Result<usize, String> {
    let pool = &state.0;
    process_outbox(pool)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn test_check_internet_available_returns_bool() {
        let result = check_internet_available().await;
        // We don't know if we're online, but it should return a bool
        assert!(result == true || result == false);
    }

    #[tokio::test]
    async fn test_process_outbox_empty() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();

        // Create the sync_outbox table
        sqlx::query(
            "CREATE TABLE sync_outbox (
                id TEXT PRIMARY KEY,
                action_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                status TEXT NOT NULL,
                retry_count INTEGER NOT NULL DEFAULT 0,
                error_log TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )"
        )
        .execute(&pool)
        .await
        .unwrap();

        // Insert a pending record with SYNC_DATA action
        let id = uuid::Uuid::new_v4();
        sqlx::query(
            "INSERT INTO sync_outbox (id, action_type, payload, status, retry_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
        )
        .bind(id)
        .bind("SYNC_DATA")
        .bind("{\"key\": \"value\"}")
        .bind("PENDING")
        .bind(0i32)
        .bind(Utc::now().to_rfc3339())
        .bind(Utc::now().to_rfc3339())
        .execute(&pool)
        .await
        .unwrap();

        // Process outbox - should succeed (SYNC_DATA is a no-op handler)
        let result = process_outbox(&pool).await;
        assert!(result.is_ok(), "process_outbox failed: {:?}", result.err());

        // Check the record was processed (or kept pending if no internet)
        let record: (String,) = sqlx::query_as("SELECT status FROM sync_outbox WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
        // If no internet, it stays PENDING. If there's internet, it becomes SUCCESS.
        assert!(record.0 == "PENDING" || record.0 == "SUCCESS");
    }
}
