-- Create sync_outbox table: offline-first sync pattern
CREATE TABLE sync_outbox (
    id TEXT PRIMARY KEY,
    action_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_log TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_sync_outbox_status ON sync_outbox(status);
CREATE INDEX idx_sync_outbox_action ON sync_outbox(action_type);
CREATE INDEX idx_sync_outbox_created_at ON sync_outbox(created_at);
