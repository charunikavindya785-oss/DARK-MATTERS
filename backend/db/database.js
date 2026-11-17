/**
 * SmartQ - Database Storage & Persistence Layer
 * Powered by Node.js native node:sqlite (zero external dependencies)
 */

const path = require('path');
const fs = require('fs');

let db = null;
let DatabaseSync = null;

try {
  const sqlite = require('node:sqlite');
  DatabaseSync = sqlite.DatabaseSync;
} catch (e) {
  console.warn('node:sqlite not natively supported, fallback to in-memory mock');
}

class Database {
  constructor() {
    this.isNative = false;
    this.memoryRuns = [];
    this.init();
  }

  init() {
    if (DatabaseSync) {
      try {
        const dbPath = path.join(__dirname, 'smartq.db');
        this.db = new DatabaseSync(dbPath);
        this.isNative = true;
        this.createTables();
        this.seedPresets();
        return;
      } catch (err) {
        console.warn('Failed to initialize SQLite on disk, falling back to memory DB:', err.message);
      }
    }

    // In-memory fallback if disk SQLite is unavailable
    this.seedInMemoryPresets();
  }

  createTables() {
    if (!this.isNative) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS simulation_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_timestamp TEXT NOT NULL,
        strategy TEXT NOT NULL,
        customer_count INTEGER NOT NULL,
        avg_wait REAL NOT NULL,
        max_wait REAL NOT NULL,
        peak_queue INTEGER NOT NULL,
        sla_pct REAL NOT NULL,
        csat_score REAL NOT NULL,
        details_json TEXT
      );

      CREATE TABLE IF NOT EXISTS scenario_presets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        organization_type TEXT NOT NULL,
        description TEXT NOT NULL,
        customer_count INTEGER NOT NULL,
        mean_interval REAL NOT NULL,
        arrival_pattern TEXT NOT NULL,
        config_json TEXT NOT NULL
      );
    `);
  }

  seedPresets() {
    if (!this.isNative) return;

    const countStmt = this.db.prepare('SELECT COUNT(*) as cnt FROM scenario_presets');
    const res = countStmt.get();
    if (res && res.cnt > 0) return;

    const insertStmt = this.db.prepare(`
      INSERT INTO scenario_presets (id, title, organization_type, description, customer_count, mean_interval, arrival_pattern, config_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const presets = this.getDefaultPresets();
    for (const p of presets) {
      insertStmt.run(
        p.id,
        p.title,
        p.organizationType,
        p.description,
        p.customerCount,
        p.meanInterval,
        p.arrivalPattern,
        JSON.stringify(p.config)
      );
    }
  }

  getDefaultPresets() {
    return [
      {
        id: 'hospital-triage',
        title: 'Hospital Emergency & Outpatient Triage',
        organizationType: 'Healthcare',
        description: 'Simulates acute hospital triage with emergency arrivals, severe service variance, and high risk of queue bottleneck.',
        customerCount: 150,
        meanInterval: 2.5,
        arrivalPattern: 'SURGE_PEAKS',
        config: {
          count: 150,
          meanArrivalInterval: 2.5,
          arrivalPattern: 'SURGE_PEAKS',
          serviceTypes: [
            { type: 'TRIAGE_ASSESSMENT', weight: 40, meanDuration: 3.0, stdDev: 1.0 },
            { type: 'CLINICAL_CONSULTATION', weight: 30, meanDuration: 8.0, stdDev: 3.0 },
            { type: 'DIAGNOSTIC_LAB_TEST', weight: 20, meanDuration: 5.0, stdDev: 1.5 },
            { type: 'URGENT_TRAUMA_PROCEDURE', weight: 10, meanDuration: 18.0, stdDev: 5.0 },
          ],
          priorityMix: { STANDARD: 55, PRIORITY: 30, EMERGENCY: 15 },
        },
      },
      {
        id: 'university-hub',
        title: 'University Student Services & Registrar',
        organizationType: 'Education',
        description: 'Simulates student enrollment and fee payment deadline rush with extreme morning surge.',
        customerCount: 180,
        meanInterval: 2.2,
        arrivalPattern: 'SURGE_PEAKS',
        config: {
          count: 180,
          meanArrivalInterval: 2.2,
          arrivalPattern: 'SURGE_PEAKS',
          serviceTypes: [
            { type: 'GENERAL_INQUIRY', weight: 50, meanDuration: 3.0, stdDev: 1.0 },
            { type: 'COURSE_ENROLLMENT_OVERRIDE', weight: 25, meanDuration: 6.5, stdDev: 2.0 },
            { type: 'FINANCIAL_AID_CLEARANCE', weight: 15, meanDuration: 7.0, stdDev: 2.5 },
            { type: 'ACADEMIC_PETITION', weight: 10, meanDuration: 12.0, stdDev: 3.5 },
          ],
          priorityMix: { STANDARD: 80, PRIORITY: 15, EMERGENCY: 5 },
        },
      },
      {
        id: 'government-licensing',
        title: 'Government Citizen Center & Licensing',
        organizationType: 'Public Administration',
        description: 'Simulates citizen ID verification, driving permits, and document approvals under fixed counter constraints.',
        customerCount: 120,
        meanInterval: 3.0,
        arrivalPattern: 'POISSON',
        config: {
          count: 120,
          meanArrivalInterval: 3.0,
          arrivalPattern: 'POISSON',
          serviceTypes: [
            { type: 'IDENTITY_VERIFICATION', weight: 40, meanDuration: 4.5, stdDev: 1.2 },
            { type: 'LICENSE_RENEWAL', weight: 30, meanDuration: 5.5, stdDev: 1.5 },
            { type: 'PAYMENT_RECEIPT', weight: 20, meanDuration: 3.0, stdDev: 0.8 },
            { type: 'DISPUTE_HEARING', weight: 10, meanDuration: 15.0, stdDev: 4.0 },
          ],
          priorityMix: { STANDARD: 70, PRIORITY: 25, EMERGENCY: 5 },
        },
      },
      {
        id: 'shock-surge',
        title: 'Unexpected Shock Arrival (Flash Crowd)',
        organizationType: 'Stress Test',
        description: 'Simulates an unexpected surge in customer arrivals (+300% arrival rate) to test system resilience and dynamic counter failover.',
        customerCount: 200,
        meanInterval: 1.8,
        arrivalPattern: 'FLASH_CROWD',
        config: {
          count: 200,
          meanArrivalInterval: 1.8,
          arrivalPattern: 'FLASH_CROWD',
          serviceTypes: [
            { type: 'EXPRESS_TASK', weight: 50, meanDuration: 3.0, stdDev: 1.0 },
            { type: 'STANDARD_SERVICE', weight: 35, meanDuration: 6.0, stdDev: 2.0 },
            { type: 'COMPLEX_SERVICE', weight: 15, meanDuration: 11.0, stdDev: 3.0 },
          ],
          priorityMix: { STANDARD: 75, PRIORITY: 15, EMERGENCY: 10 },
        },
      },
    ];
  }

  seedInMemoryPresets() {
    this.memoryPresets = this.getDefaultPresets();
  }

  getPresets() {
    if (this.isNative) {
      const rows = this.db.prepare('SELECT * FROM scenario_presets').all();
      return rows.map(r => ({
        id: r.id,
        title: r.title,
        organizationType: r.organization_type,
        description: r.description,
        customerCount: r.customer_count,
        meanInterval: r.mean_interval,
        arrivalPattern: r.arrival_pattern,
        config: JSON.parse(r.config_json),
      }));
    }
    return this.memoryPresets;
  }

  saveRun(summary, strategy, customerCount) {
    if (this.isNative) {
      const stmt = this.db.prepare(`
        INSERT INTO simulation_runs (run_timestamp, strategy, customer_count, avg_wait, max_wait, peak_queue, sla_pct, csat_score, details_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        new Date().toISOString(),
        strategy,
        customerCount,
        summary.avgWaitMinutes,
        summary.maxWaitMinutes,
        summary.peakQueueLength,
        summary.slaCompliancePct,
        summary.csatScore,
        JSON.stringify(summary)
      );
    } else {
      this.memoryRuns.unshift({
        id: this.memoryRuns.length + 1,
        run_timestamp: new Date().toISOString(),
        strategy,
        customer_count: customerCount,
        avg_wait: summary.avgWaitMinutes,
        max_wait: summary.maxWaitMinutes,
        peak_queue: summary.peakQueueLength,
        sla_pct: summary.slaCompliancePct,
        csat_score: summary.csatScore,
      });
      if (this.memoryRuns.length > 50) this.memoryRuns.pop();
    }
  }

  getRecentRuns(limit = 10) {
    if (this.isNative) {
      return this.db.prepare(`
        SELECT id, run_timestamp, strategy, customer_count, avg_wait, max_wait, peak_queue, sla_pct, csat_score
        FROM simulation_runs ORDER BY id DESC LIMIT ?
      `).all(limit);
    }
    return this.memoryRuns.slice(0, limit);
  }
}

module.exports = new Database();
