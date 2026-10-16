use crate::models::TaxBreakdown;

/// Indian GST tax calculation engine.
///
/// GST is calculated as either CGST+SGST (same state, intra-state)
/// or IGST (different state, inter-state).
///
/// # Arguments
/// * `amount` - The taxable base amount
/// * `gst_rate` - The total GST rate percentage (e.g., 18.0 means 18% total GST)
/// * `same_state` - True if supplier and customer are in the same state
///   (resulting in CGST+SGST), false for IGST
pub fn calculate_tax(
    amount: f64,
    gst_rate: f64,
    same_state: bool,
) -> TaxBreakdown {
    let total_gst = amount * gst_rate / 100.0;

    if same_state {
        // CGST + SGST split equally
        let half = total_gst / 2.0;
        TaxBreakdown {
            cgst_rate: gst_rate / 2.0,
            sgst_rate: gst_rate / 2.0,
            igst_rate: 0.0,
            cgst_amount: half,
            sgst_amount: half,
            igst_amount: 0.0,
        }
    } else {
        // IGST only
        TaxBreakdown {
            cgst_rate: 0.0,
            sgst_rate: 0.0,
            igst_rate: gst_rate,
            cgst_amount: 0.0,
            sgst_amount: 0.0,
            igst_amount: total_gst,
        }
    }
}

/// Calculate the total tax amount from a TaxBreakdown.
pub fn total_tax(tb: &TaxBreakdown) -> f64 {
    tb.cgst_amount + tb.sgst_amount + tb.igst_amount
}

/// Round a monetary value to 2 decimal places (standard for financial calculations).
pub fn round_money(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

/// Tauri command to calculate GST tax breakdown.
#[tauri::command]
pub async fn calculate_tax_command(
    amount: f64,
    gst_rate: f64,
    same_state: bool,
) -> TaxBreakdown {
    calculate_tax(amount, gst_rate, same_state)
}

/// Calculate final invoice total from subtotal with tax breakdown.
/// Returns (subtotal_after_discount, total_tax_amount, grand_total)
pub fn calculate_invoice_totals(
    subtotal: f64,
    discount: f64,
    gst_rate: f64,
    same_state: bool,
) -> (f64, f64, f64) {
    let taxable = subtotal - discount;
    let tb = calculate_tax(taxable, gst_rate, same_state);
    let tax = total_tax(&tb);
    let grand_total = taxable + tax;
    (round_money(taxable), round_money(tax), round_money(grand_total))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cgst_sgst_same_state() {
        let result = calculate_tax(100.0, 18.0, true);
        assert!((result.cgst_amount - 9.0).abs() < 0.001);
        assert!((result.sgst_amount - 9.0).abs() < 0.001);
        assert!((result.igst_amount - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_igst_different_state() {
        let result = calculate_tax(100.0, 18.0, false);
        assert!((result.cgst_amount - 0.0).abs() < 0.001);
        assert!((result.sgst_amount - 0.0).abs() < 0.001);
        assert!((result.igst_amount - 18.0).abs() < 0.001);
    }

    #[test]
    fn test_five_percent_gst() {
        let result = calculate_tax(100.0, 5.0, true);
        assert!((result.cgst_amount - 2.5).abs() < 0.001);
        assert!((result.sgst_amount - 2.5).abs() < 0.001);
    }

    #[test]
    fn test_round_money() {
        assert!((round_money(123.456) - 123.46).abs() < 0.001);
        assert!((round_money(123.4) - 123.40).abs() < 0.001);
        assert!((round_money(123.455) - 123.46).abs() < 0.001);
    }

    #[test]
    fn test_invoice_totals() {
        let (taxable, tax, total) = calculate_invoice_totals(1000.0, 50.0, 18.0, true);
        assert!((taxable - 950.0).abs() < 0.001);
        assert!((tax - 171.0).abs() < 0.001);
        assert!((total - 1121.0).abs() < 0.001);
    }

    #[test]
    fn test_zero_rate() {
        let result = calculate_tax(100.0, 0.0, true);
        assert!((result.cgst_amount - 0.0).abs() < 0.001);
        assert!((result.sgst_amount - 0.0).abs() < 0.001);
        assert!((result.igst_amount - 0.0).abs() < 0.001);
    }
}
