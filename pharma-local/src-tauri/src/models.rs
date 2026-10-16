use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A pharmacy medication item.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Item {
    pub id: Uuid,
    pub name: String,
    pub hsn_code: Option<String>,
    pub gst_rate: f64,        // e.g., 5.0, 12.0, 18.0
    pub unit: String,         // e.g., "Strip", "Bottle", "Tablet"
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A batch of stock for an item with expiry tracking.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Batch {
    pub id: Uuid,
    pub item_id: Uuid,
    pub batch_number: String,
    pub expiry_date: DateTime<Utc>,
    pub mrp: f64,
    pub rate: f64,
    pub stock: f64,
    pub min_stock: f64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A customer (pharmacy client).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Customer {
    pub id: Uuid,
    pub name: String,
    pub phone: String,
    pub address: Option<String>,
    pub email: Option<String>,
    pub gstin: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A supplier of pharmaceutical products.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Supplier {
    pub id: Uuid,
    pub name: String,
    pub phone: String,
    pub address: Option<String>,
    pub email: Option<String>,
    pub gstin: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A line item in a sales invoice.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SalesItem {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub batch_id: Uuid,
    pub quantity: f64,
    pub rate: f64,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub total_amount: f64,
}

/// A sales invoice (billing).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SalesInvoice {
    pub id: Uuid,
    pub invoice_number: String,
    pub customer_id: Option<Uuid>,
    pub subtotal: f64,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub total_amount: f64,
    pub payment_mode: String,
    pub payment_status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A line item in a purchase invoice.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PurchaseItem {
    pub id: Uuid,
    pub purchase_id: Uuid,
    pub item_id: Uuid,
    pub batch_number: String,
    pub expiry_date: DateTime<Utc>,
    pub quantity: f64,
    pub rate: f64,
    pub tax_amount: f64,
    pub total_amount: f64,
}

/// A purchase invoice.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Purchase {
    pub id: Uuid,
    pub invoice_number: String,
    pub supplier_id: Uuid,
    pub subtotal: f64,
    pub tax_amount: f64,
    pub total_amount: f64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// An outbox record for the offline-first sync pattern.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SyncOutbox {
    pub id: Uuid,
    pub action_type: String,
    pub payload: String,
    pub status: String,          // PENDING, SUCCESS, FAILED
    pub retry_count: i32,
    pub error_log: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// An audit log entry.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AuditLog {
    pub id: Uuid,
    pub table_name: String,
    pub record_id: String,
    pub action: String,          // INSERT, UPDATE, DELETE
    pub old_values: Option<String>,
    pub new_values: Option<String>,
    pub user_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// A user account.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub password_hash: String,
    pub role_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A role with permissions.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Role {
    pub id: Uuid,
    pub name: String,
    pub permissions: String,
    pub created_at: DateTime<Utc>,
}

/// Tax breakdown for an invoice line.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TaxBreakdown {
    pub cgst_rate: f64,
    pub sgst_rate: f64,
    pub igst_rate: f64,
    pub cgst_amount: f64,
    pub sgst_amount: f64,
    pub igst_amount: f64,
}

/// FSN (Fast-Moving, Slow-Moving, Non-Moving) analysis result.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FsnResult {
    pub item_id: Uuid,
    pub item_name: String,
    pub category: String,       // "FAST", "SLOW", "NON_MOVING"
    pub units_sold: f64,
    pub days_since_last_sale: Option<i64>,
}

/// Gross margin report entry.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GrossMarginEntry {
    pub item_id: Uuid,
    pub item_name: String,
    pub total_revenue: f64,
    pub total_cost: f64,
    pub gross_profit: f64,
    pub margin_percentage: f64,
}

/// Expiry alert record.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ExpiryAlert {
    pub batch_id: Uuid,
    pub item_name: String,
    pub batch_number: String,
    pub expiry_date: DateTime<Utc>,
    pub days_until_expiry: i64,
    pub current_stock: f64,
}
