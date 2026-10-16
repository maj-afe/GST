-- Create items table: pharmacy medication inventory
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hsn_code TEXT,
    gst_rate REAL NOT NULL DEFAULT 18.0,
    unit TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_items_hsn_code ON items(hsn_code);
