use crate::models::{SalesInvoice, SalesItem};
use sqlx::SqlitePool;
use std::io::Write;
use std::path::PathBuf;
use uuid::Uuid;

// ─── ESC/POS Command Constants ───────────────────────────────────────────────

pub const ESC: u8 = 0x1B;
pub const GS: u8 = 0x1D;
pub const LF: u8 = 0x0A;

/// Initialize printer (reset to defaults).
pub fn cmd_initialize() -> Vec<u8> {
    vec![ESC, 0x40]
}

/// Select justification: 0 = left, 1 = center, 2 = right.
pub fn cmd_align(justify: u8) -> Vec<u8> {
    vec![ESC, b'a', justify]
}

/// Toggle bold mode: 0 = off, 1 = on.
pub fn cmd_bold(on: bool) -> Vec<u8> {
    vec![ESC, b'E', if on { 1 } else { 0 }]
}

/// Select font: 0 = font A, 1 = font B.
#[allow(unused_variables)]
pub fn cmd_font(font: u8) -> Vec<u8> {
    vec![ESC, b'2'] // Font A by default; full impl would switch fonts
}

/// Feed n lines.
pub fn cmd_feed(n: u8) -> Vec<u8> {
    vec![LF; n as usize]
}

/// Cut paper (partial cut).
pub fn cmd_cut() -> Vec<u8> {
    vec![GS, b'V', 0x00]
}

/// Print a QR code (simplified implementation).
/// Uses the GS k command for basic QR code printing.
pub fn cmd_qr_code(data: &str) -> Vec<u8> {
    let mut bytes = Vec::new();

    // Select QR code model
    bytes.extend_from_slice(&[GS, b'k', 0x01]);

    // Set QR code size
    bytes.extend_from_slice(&[GS, b'(', b'k', 0x03, 0x00, 0x31, 0x30, 0x02]);

    // Store data
    let data_bytes = data.as_bytes();
    let p1 = (data_bytes.len() + 3) as u8 & 0xFF;
    let p2 = ((data_bytes.len() + 3) >> 8) as u8;
    bytes.extend_from_slice(&[GS, b'(', b'k']);
    bytes.push(p1);
    bytes.push(p2);
    bytes.push(0x31); // FN 0x31 = Write data
    bytes.push(0x55); // Error correction: U
    bytes.extend_from_slice(data_bytes);
    bytes.push(0x00);

    // Print QR code
    bytes.extend_from_slice(&[GS, b'(', b'k', 0x03, 0x00, 0x31, 0x31, 0x00]);

    // Feed after QR
    bytes.push(LF);

    bytes
}

/// ─── Receipt Builder ─────────────────────────────────────────────────────────

/// Represents a line on the receipt (either text or a command).
enum ReceiptLine {
    Text(String),
    Raw(Vec<u8>),
    NewLine,
}

/// A builder that composes a thermal receipt as ESC/POS byte sequences.
#[allow(dead_code)]
pub struct ReceiptBuilder {
    pharmacy_name: String,
    pharmacy_address: String,
    pharmacy_gstin: String,
    lines: Vec<ReceiptLine>,
}

impl ReceiptBuilder {
    pub fn new(pharmacy_name: &str, address: &str, gstin: &str) -> Self {
        Self {
            pharmacy_name: pharmacy_name.to_string(),
            pharmacy_address: address.to_string(),
            pharmacy_gstin: gstin.to_string(),
            lines: vec![
                ReceiptLine::Raw(cmd_initialize()),
                ReceiptLine::Raw(cmd_feed(2)),
            ],
        }
    }

    /// Add a centered text line.
    pub fn center_text(&mut self, text: &str) -> &mut Self {
        self.lines.push(ReceiptLine::Raw(cmd_align(1)));
        self.lines.push(ReceiptLine::Text(text.to_string()));
        self.lines.push(ReceiptLine::NewLine);
        self
    }

    /// Add a left-aligned text line.
    pub fn left_text(&mut self, text: &str) -> &mut Self {
        self.lines.push(ReceiptLine::Raw(cmd_align(0)));
        self.lines.push(ReceiptLine::Text(text.to_string()));
        self.lines.push(ReceiptLine::NewLine);
        self
    }

    /// Add a right-aligned text line.
    pub fn right_text(&mut self, text: &str) -> &mut Self {
        self.lines.push(ReceiptLine::Raw(cmd_align(2)));
        self.lines.push(ReceiptLine::Text(text.to_string()));
        self.lines.push(ReceiptLine::NewLine);
        self
    }

    /// Toggle bold for subsequent lines.
    pub fn bold(&mut self, on: bool) -> &mut Self {
        self.lines.push(ReceiptLine::Raw(cmd_bold(on)));
        self
    }

    /// Add a separator line.
    pub fn separator(&mut self) -> &mut Self {
        self.left_text("----------------------------------------");
        self
    }

    /// Add a QR code for the given data.
    pub fn qr_code(&mut self, data: &str) -> &mut Self {
        self.lines.push(ReceiptLine::Raw(cmd_align(1)));
        self.lines.push(ReceiptLine::Raw(cmd_qr_code(data)));
        self
    }

    /// Feed lines and cut the paper.
    pub fn feed_and_cut(&mut self, n: u8) -> &mut Self {
        self.lines.push(ReceiptLine::Raw(cmd_feed(n)));
        self.lines.push(ReceiptLine::Raw(cmd_cut()));
        self
    }

    /// Build the final byte vector.
    pub fn build(&self) -> Vec<u8> {
        let mut output = Vec::new();
        for line in &self.lines {
            match line {
                ReceiptLine::Text(s) => {
                    output.extend_from_slice(s.as_bytes());
                    output.push(LF);
                }
                ReceiptLine::Raw(bytes) => {
                    output.extend_from_slice(bytes);
                }
                ReceiptLine::NewLine => {
                    output.push(LF);
                }
            }
        }
        output
    }
}

/// ─── Printer Drivers ─────────────────────────────────────────────────────────

/// Trait for printer drivers that can send raw ESC/POS bytes.
pub trait PrintDriver {
    /// Send raw bytes to the printer.
    fn print(&mut self, bytes: &[u8]) -> anyhow::Result<()>;
    /// Close the printer connection.
    fn close(&mut self) -> anyhow::Result<()>;
}

/// Virtual printer driver: writes ESC/POS commands to a text file instead of
/// a physical port. Used for testing invoice layouts without wasting paper
/// (Section 14.2 of the PRD).
pub struct VirtualPrinter {
    pub output_path: PathBuf,
    pub buffer: Vec<u8>,
}

impl VirtualPrinter {
    pub fn new(output_path: PathBuf) -> Self {
        Self {
            output_path,
            buffer: Vec::new(),
        }
    }
}

impl PrintDriver for VirtualPrinter {
    fn print(&mut self, bytes: &[u8]) -> anyhow::Result<()> {
        self.buffer.extend_from_slice(bytes);
        Ok(())
    }

    fn close(&mut self) -> anyhow::Result<()> {
        std::fs::write(&self.output_path, &self.buffer)?;
        tracing::info!("Virtual receipt written to: {}", self.output_path.display());
        Ok(())
    }
}

/// USB/Serial printer driver: sends raw ESC/POS commands directly to the
/// device path (e.g., /dev/usb/lp0 on Linux, COM1 on Windows).
/// Does NOT use the OS print spooler (per spec).
pub struct UsbSerialPrinter {
    pub device_path: String,
    file: Option<std::fs::File>,
}

impl UsbSerialPrinter {
    pub fn new(device_path: &str) -> Self {
        Self {
            device_path: device_path.to_string(),
            file: None,
        }
    }
}

impl PrintDriver for UsbSerialPrinter {
    fn print(&mut self, bytes: &[u8]) -> anyhow::Result<()> {
        if self.file.is_none() {
            // Try to open the device
            #[cfg(target_os = "linux")]
            {
                use std::os::unix::fs::OpenOptionsExt;
                self.file = Some(
                    std::fs::OpenOptions::new()
                        .write(true)
                        .read(true)
                        .create(false)
                        .mode(0o666)
                        .open(&self.device_path)?,
                );
            }
            #[cfg(target_os = "windows")]
            {
                self.file = Some(
                    std::fs::OpenOptions::new()
                        .write(true)
                        .read(true)
                        .open(&self.device_path)?,
                );
            }
            #[cfg(not(any(target_os = "linux", target_os = "windows")))]
            {
                return Err(anyhow::anyhow!("Unsupported platform for USB/Serial printing"));
            }
        }

        self.file
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Printer not initialized"))?
            .write_all(bytes)?;
        Ok(())
    }

    fn close(&mut self) -> anyhow::Result<()> {
        self.file = None;
        Ok(())
    }
}

/// Print a thermal receipt for the given invoice.
///
/// Fetches the invoice and all line items from the database, formats a
/// thermal receipt, and sends the ESC/POS commands to the printer.
///
/// # Arguments
/// * `invoice_id` - The UUID of the sales invoice to print
/// * `pool` - The SQLite connection pool
/// * `output_path` - Optional path for the virtual printer (for testing).
///   If None, attempts to print to the default USB/Serial printer.
pub async fn print_thermal_receipt(
    invoice_id: Uuid,
    pool: &SqlitePool,
    output_path: Option<PathBuf>,
) -> anyhow::Result<()> {
    // Fetch invoice
    let invoice: SalesInvoice = sqlx::query_as::<_, SalesInvoice>(
        "SELECT * FROM sales_invoices WHERE id = ?1",
    )
    .bind(invoice_id)
    .fetch_one(pool)
    .await?;

    // Fetch line items with item and batch info
    let sales_items: Vec<SalesItem> = sqlx::query_as::<_, SalesItem>(
        "SELECT * FROM sales_items WHERE invoice_id = ?1",
    )
    .bind(invoice_id)
    .fetch_all(pool)
    .await?;

    // Get pharmacy info from environment (set during setup wizard)
    let pharmacy_name =
        std::env::var("PHARMA_NAME").unwrap_or_else(|_| "PharmaLocal".to_string());
    let pharmacy_address =
        std::env::var("PHARMA_ADDRESS").unwrap_or_else(|_| "123 Pharmacy St".to_string());
    let pharmacy_gstin =
        std::env::var("PHARMA_GSTIN").unwrap_or_else(|_| "GSTIN: 000000000000".to_string());

    // Build receipt
    let mut builder = ReceiptBuilder::new(&pharmacy_name, &pharmacy_address, &pharmacy_gstin);

    // Header
    builder
        .center_text(&pharmacy_name)
        .bold(true)
        .center_text(&pharmacy_name)
        .bold(false)
        .center_text(&pharmacy_address)
        .center_text(&format!("GSTIN: {}", pharmacy_gstin))
        .separator();

    // Invoice details
    builder
        .left_text(&format!("Invoice #: {}", invoice.invoice_number))
        .left_text(&format!("Date: {}", invoice.created_at.format("%d/%m/%Y %H:%M")))
        .left_text(&format!("Payment: {} ({})", invoice.payment_mode, invoice.payment_status));

    // Add customer info if available
    if let Some(customer_id) = invoice.customer_id {
        let customer: (String,) = sqlx::query_as("SELECT name FROM customers WHERE id = ?1")
            .bind(customer_id)
            .fetch_optional(pool)
            .await?
            .unwrap_or_else(|| (String::from("N/A"),));
        builder.left_text(&format!("Customer: {}", customer.0));
    }

    builder.separator();

    // Line items
    builder.left_text(&format!(
        "{:<20} {:>6} {:>8} {:>10}",
        "Item", "Qty", "Rate", "Total"
    ));
    builder.separator();

    for si in &sales_items {
        // Fetch item and batch details
        let _batch: (String,) = sqlx::query_as("SELECT batch_number FROM batches WHERE id = ?1")
            .bind(si.batch_id)
            .fetch_one(pool)
            .await
            .unwrap_or_else(|_| (String::from("-"),));

        let item: (String,) = sqlx::query_as("SELECT name FROM items WHERE id = ?1")
            .bind(
                sqlx::query_as::<_, (String,)>("SELECT item_id FROM batches WHERE id = ?1")
                    .bind(si.batch_id)
                    .fetch_one(pool)
                    .await
                    .map(|r| r.0)
                    .unwrap_or_default(),
            )
            .fetch_one(pool)
            .await
            .unwrap_or_else(|_| (String::from("Unknown"),));

        builder.left_text(&format!(
            "{:<20} {:>6.1} {:>8.2} {:>10.2}",
            item.0.chars().take(20).collect::<String>(),
            si.quantity,
            si.rate,
            si.total_amount
        ));
    }

    builder.separator();

    // Totals
    builder
        .left_text(&format!("Subtotal:              Rs. {:>10.2}", invoice.subtotal))
        .left_text(&format!("Discount:              Rs. {:>10.2}", invoice.discount_amount))
        .left_text(&format!("Tax:                   Rs. {:>10.2}", invoice.tax_amount))
        .bold(true)
        .right_text(&format!("TOTAL:              Rs. {:>10.2}", invoice.total_amount))
        .bold(false);

    builder.separator();

    // Tax breakdown (CGST/SGST)
    let cgst = invoice.tax_amount / 2.0;
    let sgst = invoice.tax_amount / 2.0;
    builder
        .left_text(&format!("CGST:                  Rs. {:>10.2}", cgst))
        .left_text(&format!("SGST:                  Rs. {:>10.2}", sgst))
        .left_text(&format!("Taxable Amount:        Rs. {:>10.2}", invoice.subtotal - invoice.discount_amount));

    builder.separator();

    // Thank you
    builder.center_text("Thank you for visiting!");
    builder.center_text("Visit again soon!");
    builder.feed_and_cut(5);

    // Add QR code with invoice reference
    let qr_data = format!(
        "INVOICE: {} | AMOUNT: Rs. {:.2} | PHARMALOCAL",
        invoice.invoice_number, invoice.total_amount
    );
    let _ = builder.qr_code(&qr_data);

    // Build and send bytes
    let bytes = builder.build();

    // Use virtual printer or actual hardware printer
    if let Some(path) = output_path {
        let mut driver = VirtualPrinter::new(path);
        driver.print(&bytes)?;
        driver.close()?;
    } else {
        // Try default USB/Serial device
        let device = std::env::var("PRINTER_DEVICE")
            .unwrap_or_else(|_| "/dev/usb/lp0".to_string());
        let mut driver = UsbSerialPrinter::new(&device);
        match driver.print(&bytes) {
            Ok(_) => {
                driver.close()?;
                tracing::info!("Receipt printed successfully");
            }
            Err(e) => {
                tracing::error!("Failed to print receipt: {}", e);
                // Fallback: write to file so the receipt isn't lost
                let fallback_path = std::env::temp_dir()
                    .join(format!("receipt_{}.txt", invoice.invoice_number));
                std::fs::write(&fallback_path, &bytes)?;
                tracing::warn!("Receipt saved to fallback: {}", fallback_path.display());
            }
        }
    }

    Ok(())
}

/// Tauri command to print a thermal receipt.
#[tauri::command]
pub async fn print_receipt(
    invoice_id: Uuid,
    state: tauri::State<'_, crate::db::DbState>,
) -> Result<String, String> {
    let pool = &state.0;
    print_thermal_receipt(invoice_id, pool, None)
        .await
        .map(|_| format!("Receipt printed for invoice {}", invoice_id))
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_receipt_builder_basic() {
        let mut builder = ReceiptBuilder::new("TestPharma", "123 Test St", "GSTIN123");
        builder
            .center_text("TestPharma")
            .bold(true)
            .center_text("TestPharma")
            .bold(false)
            .separator()
            .left_text("Test line")
            .feed_and_cut(3);

        let bytes = builder.build();
        assert!(!bytes.is_empty());
        // Should contain initialize command
        assert!(bytes.contains(&ESC));
    }

    #[test]
    fn test_cmd_initialize() {
        let cmd = cmd_initialize();
        assert_eq!(cmd, vec![ESC, 0x40]);
    }

    #[test]
    fn test_cmd_align() {
        assert_eq!(cmd_align(1), vec![ESC, b'a', 1]);
    }

    #[test]
    fn test_cmd_bold() {
        assert_eq!(cmd_bold(true), vec![ESC, b'E', 1]);
        assert_eq!(cmd_bold(false), vec![ESC, b'E', 0]);
    }

    #[test]
    fn test_virtual_printer() {
        let path = std::env::temp_dir().join("test_receipt.txt");
        let mut vp = VirtualPrinter::new(path.clone());

        let bytes = b"Test receipt\x0a";
        vp.print(bytes).unwrap();
        vp.close().unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("Test receipt"));
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn test_cmd_qr_code() {
        let bytes = cmd_qr_code("test data");
        assert!(!bytes.is_empty());
        // Should contain GS k command
        assert!(bytes.contains(&GS));
    }
}
