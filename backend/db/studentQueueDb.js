/**
 * SmartQ - Student Queue Database Access Layer (DAO)
 * Powered by Node.js native SQLite (node:sqlite)
 * Member 03 - Queue Management & Student Data Persistence
 */

const path = require('path');
const fs = require('fs');

let DatabaseSync = null;
try {
  const sqlite = require('node:sqlite');
  DatabaseSync = sqlite.DatabaseSync;
} catch (e) {
  console.warn('node:sqlite not natively supported, fallback to memory storage');
}

class StudentQueueDb {
  constructor() {
    this.isNative = false;
    this.memoryStore = [];
    this.nextQueueNo = 1;
    this.init();
  }

  init() {
    if (DatabaseSync) {
      try {
        const dbPath = path.join(__dirname, 'student_queue.db');
        this.db = new DatabaseSync(dbPath);
        this.isNative = true;

        // Create table and indexes
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS student_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            queue_number INTEGER NOT NULL,
            name TEXT NOT NULL,
            arrival_time TEXT NOT NULL,
            service_time REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'Waiting',
            counter_assigned TEXT DEFAULT NULL,
            service_start_time TEXT DEFAULT NULL,
            service_end_time TEXT DEFAULT NULL,
            waiting_time REAL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
          );

          CREATE INDEX IF NOT EXISTS idx_student_status ON student_queue(status);
          CREATE INDEX IF NOT EXISTS idx_student_arrival ON student_queue(arrival_time);
        `);

        // Sync nextQueueNo with current max queue_number in DB
        const row = this.db.prepare('SELECT MAX(queue_number) as max_no FROM student_queue').get();
        if (row && row.max_no) {
          this.nextQueueNo = row.max_no + 1;
        }

        console.log(`[StudentQueueDb] SQLite initialized successfully. Next Queue Number: ${this.nextQueueNo}`);
        return;
      } catch (err) {
        console.warn('[StudentQueueDb] Disk SQLite failed, using in-memory store:', err.message);
      }
    }

    // Fallback in-memory
    this.isNative = false;
  }

  /**
   * Add a new student to the queue
   * @param {string} name 
   * @param {number} serviceTime 
   * @param {string|Date} arrivalTime 
   */
  addStudent(name, serviceTime, arrivalTime = new Date()) {
    const arrTimeStr = (arrivalTime instanceof Date) ? arrivalTime.toISOString() : new Date(arrivalTime).toISOString();
    const qNo = this.nextQueueNo++;

    if (this.isNative) {
      const stmt = this.db.prepare(`
        INSERT INTO student_queue (queue_number, name, arrival_time, service_time, status)
        VALUES (?, ?, ?, ?, 'Waiting')
      `);
      const result = stmt.run(qNo, name.trim(), arrTimeStr, Number(serviceTime));

      return {
        id: Number(result.lastInsertRowid),
        queue_number: qNo,
        name: name.trim(),
        arrival_time: arrTimeStr,
        service_time: Number(serviceTime),
        status: 'Waiting',
        counter_assigned: null,
        waiting_time: 0
      };
    } else {
      const student = {
        id: this.memoryStore.length + 1,
        queue_number: qNo,
        name: name.trim(),
        arrival_time: arrTimeStr,
        service_time: Number(serviceTime),
        status: 'Waiting',
        counter_assigned: null,
        waiting_time: 0
      };
      this.memoryStore.push(student);
      return student;
    }
  }

  /**
   * Get all students in the queue, ordered by arrival time
   * @param {string|null} statusFilter - Optional filter ('Waiting', 'In Service', 'Completed')
   */
  getQueue(statusFilter = null) {
    if (this.isNative) {
      if (statusFilter) {
        const stmt = this.db.prepare(`
          SELECT * FROM student_queue 
          WHERE status = ? 
          ORDER BY datetime(arrival_time) ASC
        `);
        return stmt.all(statusFilter);
      } else {
        const stmt = this.db.prepare(`
          SELECT * FROM student_queue 
          ORDER BY datetime(arrival_time) ASC
        `);
        return stmt.all();
      }
    }

    let list = [...this.memoryStore];
    if (statusFilter) {
      list = list.filter(s => s.status.toLowerCase() === statusFilter.toLowerCase());
    }
    return list.sort((a, b) => new Date(a.arrival_time).getTime() - new Date(b.arrival_time).getTime());
  }

  /**
   * Get number of currently waiting students
   */
  getQueueLength() {
    if (this.isNative) {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM student_queue WHERE status = 'Waiting'`);
      const res = stmt.get();
      return res ? res.count : 0;
    }
    return this.memoryStore.filter(s => s.status === 'Waiting').length;
  }

  /**
   * Update student status (e.g. 'In Service', 'Completed', 'Cancelled')
   */
  updateStudentStatus(id, newStatus, counterAssigned = null) {
    const nowStr = new Date().toISOString();

    if (this.isNative) {
      if (newStatus === 'In Service') {
        const stmt = this.db.prepare(`
          UPDATE student_queue 
          SET status = ?, counter_assigned = ?, service_start_time = ?
          WHERE id = ?
        `);
        stmt.run(newStatus, counterAssigned, nowStr, id);
      } else if (newStatus === 'Completed') {
        // Calculate waiting time
        const student = this.db.prepare('SELECT arrival_time, service_start_time FROM student_queue WHERE id = ?').get(id);
        let waitMins = 0;
        if (student) {
          const arr = new Date(student.arrival_time).getTime();
          const start = student.service_start_time ? new Date(student.service_start_time).getTime() : Date.now();
          waitMins = Number(((start - arr) / 60000).toFixed(2));
        }

        const stmt = this.db.prepare(`
          UPDATE student_queue 
          SET status = ?, service_end_time = ?, waiting_time = ?
          WHERE id = ?
        `);
        stmt.run(newStatus, nowStr, Math.max(0, waitMins), id);
      } else {
        const stmt = this.db.prepare(`UPDATE student_queue SET status = ? WHERE id = ?`);
        stmt.run(newStatus, id);
      }
      return this.db.prepare('SELECT * FROM student_queue WHERE id = ?').get(id);
    }

    const s = this.memoryStore.find(item => item.id === Number(id));
    if (s) {
      s.status = newStatus;
      if (counterAssigned) s.counter_assigned = counterAssigned;
      if (newStatus === 'In Service') s.service_start_time = nowStr;
      if (newStatus === 'Completed') s.service_end_time = nowStr;
    }
    return s;
  }

  /**
   * Clear or reset the queue
   */
  clearQueue() {
    if (this.isNative) {
      this.db.exec('DELETE FROM student_queue');
      this.nextQueueNo = 1;
      return true;
    }
    this.memoryStore = [];
    this.nextQueueNo = 1;
    return true;
  }
}

module.exports = new StudentQueueDb();
