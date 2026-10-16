-- Create purchases table
CREATE TABLE purchases (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    supplier_id TEXT NOT NULL,
    subtotal REAL NOT NULL,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);

CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX idx_purchases_created_at ON purchases(created_at);
