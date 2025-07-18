-- Run manually via command-line (sqlite3 database.sqlite < db/schema.sql) or
-- Run automatically in your app startup (Node: read file, run SQL with db.exec or similar).

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT 1
);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT, -- e.g., 'phone', 'tablet', 'computer'
    push_subscription TEXT,
    mqtt_topic TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT 1,
    FOREIGN KEY(userId) REFERENCES users(id)
);

-- SmartTimers table
CREATE TABLE IF NOT EXISTS smartTimers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    duration INTEGER NOT NULL, -- duration in seconds
    initial_duration INTEGER NOT NULL,
    state TEXT NOT NULL,       -- e.g., 'pending', 'running', 'paused', 'canceled', 'finished'
    start_time DATETIME,
    end_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT 1
);

-- Recipients table (associates devices/users with timers)
CREATE TABLE IF NOT EXISTS recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    smartTimerId INTEGER NOT NULL,
    deviceId INTEGER,    -- device recipient (nullable)
    userId INTEGER,      -- user recipient (nullable)
    type TEXT NOT NULL,  -- e.g., 'push', 'mqtt', 'ip'
    target TEXT,         -- for custom targets (e.g., IP address)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(smartTimerId) REFERENCES smartTimers(id),
    FOREIGN KEY(deviceId) REFERENCES devices(id),
    FOREIGN KEY(userId) REFERENCES users(id)
);
