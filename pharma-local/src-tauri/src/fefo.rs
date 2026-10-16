use crate::models::Batch;
use chrono::{DateTime, Utc};
use uuid::Uuid;

/// A batch allocation result for a requested quantity.
#[derive(Debug, Clone)]
pub struct BatchAllocation {
    pub batch_id: Uuid,
    pub batch_number: String,
    pub expiry_date: DateTime<Utc>,
    pub allocated_quantity: f64,
    pub rate: f64,
    pub mrp: f64,
}

/// Result of FEFO allocation: the allocations and the total quantity fulfilled.
#[derive(Debug, Clone)]
pub struct FefoResult {
    pub allocations: Vec<BatchAllocation>,
    pub total_allocated: f64,
    pub remaining: f64,
}

/// First Expiry First Out (FEFO) batch selection algorithm.
///
/// Given a list of available batches for an item and a requested quantity,
/// this algorithm sorts batches by expiry date (ascending) and picks from
/// the earliest-expiring batches first, ensuring that stock closest to expiry
/// is sold before older stock.
///
/// # Arguments
/// * `batches` - All available batches for the item (with stock > 0)
/// * `requested_quantity` - The total quantity needed
///
/// # Returns
/// Allocations for each batch, the total allocated, and remaining unfilled.
pub fn select_batches_fefo(batches: &[Batch], requested_quantity: f64) -> FefoResult {
    // Sort batches by expiry date ascending (earliest expiry first)
    let mut sorted: Vec<&Batch> = batches
        .iter()
        .filter(|b| b.stock > 0.0)
        .collect();
    sorted.sort_by(|a, b| a.expiry_date.cmp(&b.expiry_date));

    let mut allocations = Vec::new();
    let mut total_allocated = 0.0;

    for batch in sorted {
        if total_allocated >= requested_quantity {
            break;
        }

        let remaining_needed = requested_quantity - total_allocated;
        let allocate = remaining_needed.min(batch.stock);

        allocations.push(BatchAllocation {
            batch_id: batch.id,
            batch_number: batch.batch_number.clone(),
            expiry_date: batch.expiry_date,
            allocated_quantity: allocate,
            rate: batch.rate,
            mrp: batch.mrp,
        });

        total_allocated += allocate;
    }

    let remaining = (requested_quantity - total_allocated).max(0.0);

    FefoResult {
        allocations,
        total_allocated,
        remaining,
    }
}

/// Check if any batch is expired (past its expiry date) as of the given time.
pub fn is_batch_expired(batch: &Batch, now: DateTime<Utc>) -> bool {
    batch.expiry_date < now
}

/// Get the number of days until a batch expires.
pub fn days_until_expiry(expiry: DateTime<Utc>, now: DateTime<Utc>) -> i64 {
    (expiry - now).num_days()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn make_batch(id: Uuid, stock: f64, days_ahead: i64, rate: f64) -> Batch {
        Batch {
            id,
            item_id: Uuid::nil(),
            batch_number: format!("BATCH-{:?}", id),
            expiry_date: Utc.timestamp_opt(chrono::Utc::now().timestamp() + days_ahead * 86400, 0).unwrap(),
            mrp: rate * 2.0,
            rate,
            stock,
            min_stock: 0.0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_fefo_selects_earliest_expiry_first() {
        let _now = Utc::now();
        let batch1 = make_batch(Uuid::nil(), 100.0, 60, 10.0);  // expires in 60 days
        let batch2 = make_batch(Uuid::nil(), 50.0, 30, 12.0);   // expires in 30 days
        let batch3 = make_batch(Uuid::nil(), 25.0, 90, 8.0);    // expires in 90 days

        // Need 70 units: should take 50 from batch2 (earliest), then 20 from batch1
        let batches = vec![batch1, batch2, batch3];
        let result = select_batches_fefo(&batches, 70.0);

        assert_eq!(result.allocations.len(), 2);
        assert!((result.total_allocated - 70.0).abs() < 0.001);
        assert!((result.remaining - 0.0).abs() < 0.001);

        // First allocation should be from the 30-day batch (batch2)
        assert_eq!(result.allocations[0].allocated_quantity, 50.0);
        // Second allocation should be from the 60-day batch (batch1)
        assert_eq!(result.allocations[1].allocated_quantity, 20.0);
    }

    #[test]
    fn test_fefo_partial_fulfillment() {
        let batch1 = make_batch(Uuid::nil(), 30.0, 60, 10.0);
        let batches = vec![batch1];

        let result = select_batches_fefo(&batches, 50.0);
        assert!((result.total_allocated - 30.0).abs() < 0.001);
        assert!((result.remaining - 20.0).abs() < 0.001);
    }

    #[test]
    fn test_fefo_zero_quantity() {
        let batch1 = make_batch(Uuid::nil(), 100.0, 60, 10.0);
        let batches = vec![batch1];

        let result = select_batches_fefo(&batches, 0.0);
        assert_eq!(result.allocations.len(), 0);
        assert!((result.total_allocated - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_fefo_skips_zero_stock_batches() {
        let batch1 = make_batch(Uuid::nil(), 0.0, 30, 10.0);  // expired stock
        let batch2 = make_batch(Uuid::nil(), 50.0, 60, 12.0);
        let batches = vec![batch1, batch2];

        let result = select_batches_fefo(&batches, 50.0);
        assert_eq!(result.allocations.len(), 1);
        assert!((result.total_allocated - 50.0).abs() < 0.001);
    }
}
