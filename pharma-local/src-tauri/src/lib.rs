// PharmaLocal - Offline-first Pharma ERP (Tauri v2 backend)
// Main library module that sets up the Tauri application, database,
// background sync worker, and exposes commands to the frontend.

pub mod analytics;
pub mod db;
pub mod fefo;
pub mod integrations;
pub mod models;
pub mod printer;
pub mod sync_worker;
pub mod tax;

use std::sync::Arc;
use tauri::Manager;

/// Setup function called by Tauri on application startup.
/// Initializes the database, spawns the background sync worker,
/// and sets up the tracing subscriber for logging.
fn setup(app: &tauri::App) -> Result<(), String> {
    let _ = tracing_subscriber::fmt()
        .with_env_filter("pharma_local_lib=info,tauri=info")
        .try_init();

    // Initialize the database (creates file if needed, runs migrations)
    let db_state = tauri::async_runtime::block_on(db::init_db(app))
        .map_err(|e| format!("Failed to initialize database: {}", e))?;

    let pool = db_state.0.clone();
    app.manage(db_state);

    // Spawn the Outbox Pattern background sync worker (runs every 30 seconds)
    let pool_arc = Arc::new(pool);
    sync_worker::spawn_sync_worker(pool_arc);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| Ok(setup(app)?))
        .invoke_handler(tauri::generate_handler![
            // Outbox Pattern
            sync_worker::process_outbox_now,
            // Analytics
            analytics::get_fsn_analysis,
            analytics::get_gross_margin_report,
            analytics::get_expiry_alerts,
            // Printer
            printer::print_receipt,
            // Integrations
            integrations::generate_e_invoice_command,
            integrations::push_to_tally_command,
            // Tax
            tax::calculate_tax_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
