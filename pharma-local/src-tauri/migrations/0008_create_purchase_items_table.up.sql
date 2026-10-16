-- Create purchase_items table
CREATE TABLE purchase_items (
    id TEXT PRIMARY KEY,
    purchase_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    quantity REAL NOT NULL,
    rate REAL NOT NULL,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT
);

CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_item ON purchase_items(item_id);
