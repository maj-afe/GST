-- Create sales_items table
CREATE TABLE sales_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    quantity REAL NOT NULL,
    rate REAL NOT NULL,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT
);

CREATE INDEX idx_sales_items_invoice ON sales_items(invoice_id);
CREATE INDEX idx_sales_items_batch ON sales_items(batch_id);
