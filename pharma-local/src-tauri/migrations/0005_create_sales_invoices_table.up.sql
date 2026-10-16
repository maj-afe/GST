-- Create sales_invoices table
CREATE TABLE sales_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id TEXT,
    subtotal REAL NOT NULL,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    payment_mode TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE INDEX idx_sales_invoices_customer ON sales_invoices(customer_id);
CREATE INDEX idx_sales_invoices_created_at ON sales_invoices(created_at);
CREATE INDEX idx_sales_invoices_payment_status ON sales_invoices(payment_status);
