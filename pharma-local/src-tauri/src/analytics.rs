use crate::db::DbState;
use crate::models::{ExpiryAlert, FsnResult, GrossMarginEntry};
use sqlx::SqlitePool;
use tauri::State;

/// FSN (Fast-Moving, Slow-Moving, Non-Moving) Analysis.
///
/// Returns items categorized based on their sales velocity in the last 90 days.
///
/// - **FAST**: Items with sales volume >= 75th percentile of all selling items.
/// - **SLOW**: Items with sales volume >= 25th percentile but < 75th percentile.
/// - **NON_MOVING**: Items with no sales in the last 90 days.
pub(crate) async fn get_fsn_analysis_impl(
    pool: &SqlitePool,
) -> Result<Vec<FsnResult>, String> {
    // Get total quantity sold per item in the last 90 days
    let rows: Vec<(uuid::Uuid, String, f64)> = sqlx::query_as(
        r#"
        SELECT i.id, i.name, COALESCE(SUM(si.quantity), 0) as total_sold
        FROM items i
        LEFT JOIN batches b ON b.item_id = i.id
        LEFT JOIN sales_items si ON si.batch_id = b.id
        LEFT JOIN sales_invoices s ON s.id = si.invoice_id
            AND s.created_at >= datetime('now', '-90 days')
        GROUP BY i.id, i.name
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    if rows.is_empty() {
        return Ok(vec![]);
    }

    // Calculate percentiles
    // Collect all non-zero sales for percentile calculation
    let non_zero_sales: Vec<f64> = rows.iter()
        .map(|(_, _, sold)| *sold)
        .filter(|s| *s > 0.0)
        .collect::<Vec<_>>();

    let sorted_sales = {
        let mut s = non_zero_sales.clone();
        s.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        s
    };

    let p75 = if sorted_sales.is_empty() {
        0.0
    } else {
        let idx = (sorted_sales.len() as f64 * 0.75).floor() as usize;
        sorted_sales[idx.min(sorted_sales.len() - 1)]
    };

    let p25 = if sorted_sales.is_empty() {
        0.0
    } else {
        let idx = (sorted_sales.len() as f64 * 0.25).floor() as usize;
        sorted_sales[idx.min(sorted_sales.len() - 1)]
    };

    // Get last sale date for each item
    let last_sale_dates: std::collections::HashMap<uuid::Uuid, Option<i64>> = sqlx::query_as(
        r#"
        SELECT i.id, MAX(julianday(s.created_at)) as last_sale_jd
        FROM items i
        LEFT JOIN batches b ON b.item_id = i.id
        LEFT JOIN sales_items si ON si.batch_id = b.id
        LEFT JOIN sales_invoices s ON s.id = si.invoice_id
        WHERE s.created_at >= datetime('now', '-90 days')
        GROUP BY i.id
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?
    .into_iter()
    .map(|(id, jd): (uuid::Uuid, Option<f64>)| (id, jd.map(|j| j as i64)))
    .collect();

    // Categorize items
    let now_ts = chrono::Utc::now().timestamp();
    let mut results: Vec<FsnResult> = Vec::new();

    for (id, name, sold) in rows {
        let category = if sold == 0.0 {
            "NON_MOVING".to_string()
        } else if sold >= p75 {
            "FAST".to_string()
        } else if sold >= p25 {
            "SLOW".to_string()
        } else {
            "SLOW".to_string() // Below 25th percentile is still "Slow"
        };

        let days_since_sale = last_sale_dates.get(&id)
            .and_then(|jd| jd.as_ref())
            .map(|jd| {
                let sale_date = chrono::DateTime::from_timestamp(*jd, 0)
                    .unwrap_or_else(|| chrono::Utc::now());
                (now_ts - sale_date.timestamp()) / 86400
            });

        results.push(FsnResult {
            item_id: id,
            item_name: name,
            category,
            units_sold: sold,
            days_since_last_sale: days_since_sale,
        });
    }

    Ok(results)
}

/// Tauri command wrapper for FSN analysis.
#[tauri::command]
pub async fn get_fsn_analysis(
    state: State<'_, DbState>,
) -> Result<Vec<FsnResult>, String> {
    get_fsn_analysis_impl(&state.0).await
}

/// Gross Margin Report.
///
/// Calculates the profit per item and margin percentage based on:
/// - Revenue from sales (sales_items.total_amount)
/// - Cost from purchases (purchase_items.rate * quantity)
pub(crate) async fn get_gross_margin_report_impl(
    pool: &SqlitePool,
) -> Result<Vec<GrossMarginEntry>, String> {
    let rows: Vec<(
        uuid::Uuid,    // item_id
        String,        // item_name
        f64,           // total_revenue
        f64,           // total_cost
    )> = sqlx::query_as(
        r#"
        SELECT
            i.id,
            i.name,
            COALESCE(SUM(si.total_amount), 0) as total_revenue,
            COALESCE(SUM(pi.rate * pi.quantity), 0) as total_cost
        FROM items i
        LEFT JOIN batches b ON b.item_id = i.id
        LEFT JOIN sales_items si ON si.batch_id = b.id
        LEFT JOIN purchase_items pi ON pi.item_id = i.id
        GROUP BY i.id, i.name
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut results: Vec<GrossMarginEntry> = Vec::new();

    for (id, name, revenue, cost) in rows {
        let profit = revenue - cost;
        let margin_pct = if revenue > 0.0 {
            (profit / revenue) * 100.0
        } else {
            0.0
        };

        results.push(GrossMarginEntry {
            item_id: id,
            item_name: name,
            total_revenue: revenue,
            total_cost: cost,
            gross_profit: profit,
            margin_percentage: margin_pct,
        });
    }

    // Sort by gross profit descending
    results.sort_by(|a, b| {
        b.gross_profit
            .partial_cmp(&a.gross_profit)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(results)
}

/// Tauri command wrapper for gross margin report.
#[tauri::command]
pub async fn get_gross_margin_report(
    state: State<'_, DbState>,
) -> Result<Vec<GrossMarginEntry>, String> {
    get_gross_margin_report_impl(&state.0).await
}

/// Expiry Alerts.
///
/// Returns all batches expiring in the next 90 days with stock > 0.
pub(crate) async fn get_expiry_alerts_impl(
    pool: &SqlitePool,
) -> Result<Vec<ExpiryAlert>, String> {
    let rows: Vec<(
        uuid::Uuid,    // batch_id
        String,        // item_name
        String,        // batch_number
        String,        // expiry_date (ISO string)
        i64,           // days_until_expiry
        f64,           // current_stock
    )> = sqlx::query_as(
        r#"
        SELECT
            b.id as batch_id,
            i.name as item_name,
            b.batch_number,
            b.expiry_date,
            CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) as days_until_expiry,
            b.stock as current_stock
        FROM batches b
        JOIN items i ON i.id = b.item_id
        WHERE b.stock > 0
        AND b.expiry_date <= datetime('now', '+90 days')
        ORDER BY b.expiry_date ASC
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut results: Vec<ExpiryAlert> = Vec::new();

    for (batch_id, item_name, batch_number, expiry_date_str, days_until, stock) in rows {
        let expiry_date = chrono::DateTime::parse_from_rfc3339(&expiry_date_str)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());

        results.push(ExpiryAlert {
            batch_id,
            item_name,
            batch_number,
            expiry_date,
            days_until_expiry: days_until,
            current_stock: stock,
        });
    }

    Ok(results)
}

/// Tauri command wrapper for expiry alerts.
#[tauri::command]
pub async fn get_expiry_alerts(
    state: State<'_, DbState>,
) -> Result<Vec<ExpiryAlert>, String> {
    get_expiry_alerts_impl(&state.0).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;
    use crate::db::DbState;

    async fn setup_test_db() -> DbState {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();

        // Create minimal schema for testing
        sqlx::query(
            r#"
            CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT NOT NULL, hsn_code TEXT,
                gst_rate REAL NOT NULL DEFAULT 18.0, unit TEXT NOT NULL,
                description TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)
            "#
        ).execute(&pool).await.unwrap();

        sqlx::query(
            r#"
            CREATE TABLE batches (id TEXT PRIMARY KEY, item_id TEXT NOT NULL,
                batch_number TEXT NOT NULL, expiry_date TEXT NOT NULL,
                mrp REAL NOT NULL, rate REAL NOT NULL, stock REAL NOT NULL DEFAULT 0.0,
                min_stock REAL NOT NULL DEFAULT 0.0, created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL, FOREIGN KEY (item_id) REFERENCES items(id))
            "#
        ).execute(&pool).await.unwrap();

        sqlx::query(
            r#"
            CREATE TABLE sales_invoices (id TEXT PRIMARY KEY, invoice_number TEXT NOT NULL,
                customer_id TEXT, subtotal REAL NOT NULL, discount_amount REAL NOT NULL DEFAULT 0.0,
                tax_amount REAL NOT NULL DEFAULT 0.0, total_amount REAL NOT NULL,
                payment_mode TEXT NOT NULL, payment_status TEXT NOT NULL DEFAULT 'PENDING',
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL)
            "#
        ).execute(&pool).await.unwrap();

        sqlx::query(
            r#"
            CREATE TABLE sales_items (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL,
                batch_id TEXT NOT NULL, quantity REAL NOT NULL, rate REAL NOT NULL,
                discount_amount REAL NOT NULL DEFAULT 0.0, tax_amount REAL NOT NULL DEFAULT 0.0,
                total_amount REAL NOT NULL)
            "#
        ).execute(&pool).await.unwrap();

        sqlx::query(
            r#"
            CREATE TABLE purchase_items (id TEXT PRIMARY KEY, purchase_id TEXT NOT NULL,
                item_id TEXT NOT NULL, batch_number TEXT NOT NULL, expiry_date TEXT NOT NULL,
                quantity REAL NOT NULL, rate REAL NOT NULL, tax_amount REAL NOT NULL DEFAULT 0.0,
                total_amount REAL NOT NULL)
            "#
        ).execute(&pool).await.unwrap();

        DbState(pool)
    }

    #[tokio::test]
    async fn test_fsn_analysis_empty() {
        let db = setup_test_db().await;
        let result = get_fsn_analysis_impl(&db.0).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_gross_margin_empty() {
        let db = setup_test_db().await;
        let result = get_gross_margin_report_impl(&db.0).await;
        assert!(result.is_ok());
        // Should return 0 results since no data
    }

    #[tokio::test]
    async fn test_expiry_alerts_empty() {
        let db = setup_test_db().await;
        let result = get_expiry_alerts_impl(&db.0).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }
}
