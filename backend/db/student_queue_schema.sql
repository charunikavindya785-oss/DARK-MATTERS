-- ============================================================
-- SmartQ - Student Queue Management Database Schema
-- Member 03 - Queue Management & Student Tracking
-- ============================================================

-- Table: student_queue
-- Stores live and historical queue tickets for students
CREATE TABLE IF NOT EXISTS student_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    arrival_time TEXT NOT NULL,          -- ISO 8601 string or timestamp
    service_time REAL NOT NULL,          -- Estimated service duration in minutes
    status TEXT NOT NULL DEFAULT 'Waiting', -- 'Waiting', 'In Service', 'Completed', 'Cancelled'
    counter_assigned TEXT DEFAULT NULL,  -- Counter ID or Counter Name
    service_start_time TEXT DEFAULT NULL,
    service_end_time TEXT DEFAULT NULL,
    waiting_time REAL DEFAULT 0,         -- Actual wait time in minutes
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Indexes for high-speed queue lookup and sorting
CREATE INDEX IF NOT EXISTS idx_student_status ON student_queue(status);
CREATE INDEX IF NOT EXISTS idx_student_arrival ON student_queue(arrival_time);
CREATE INDEX IF NOT EXISTS idx_student_queue_no ON student_queue(queue_number);

-- Sample Data for Initial Verification
INSERT INTO student_queue (queue_number, name, arrival_time, service_time, status)
VALUES 
    (1, 'Kasun Perera', datetime('now', '-20 minutes', 'localtime'), 5.0, 'Waiting'),
    (2, 'Dilani Silva', datetime('now', '-15 minutes', 'localtime'), 3.5, 'Waiting'),
    (3, 'Nimal Fernando', datetime('now', '-10 minutes', 'localtime'), 8.0, 'Waiting');
