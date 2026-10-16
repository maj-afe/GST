-- Create roles table
CREATE TABLE roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    permissions TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_roles_name ON roles(name);
