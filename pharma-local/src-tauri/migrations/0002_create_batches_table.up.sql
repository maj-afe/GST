-- Create batches table: stock batches with expiry tracking
CREATE TABLE batches (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    mrp REAL NOT NULL,
    rate REAL NOT NULL,
    stock REAL NOT NULL DEFAULT 0.0,
    min_stock REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX idx_batches_item_batch ON batches(item_id, batch_number);
CREATE INDEX idx_batches_expiry ON batches(expiry_date);
CREATE INDEX idx_batches_stock ON batches(stock);
