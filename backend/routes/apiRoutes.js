/**
 * SmartQ - REST API Request Router & Controllers
 */

const { DiscreteEventSimulation } = require('../engine/discreteEventSimulation');
const StrategyRunner = require('../engine/strategies');
const QueueingTheory = require('../engine/queueingTheory');
const CongestionPredictor = require('../engine/congestionPredictor');
const ResourceOptimizer = require('../engine/resourceOptimizer');
const db = require('../db/database');

class ApiRoutes {
  static handleRequest(req, res, pathname, query, body) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    const sendError = (statusCode, message) => {
      sendJson(statusCode, { error: true, message });
    };

    // 1. Health check
    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(200, {
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: 'SmartQ Intelligent Queue Management & Service Allocation Engine',
        version: '1.0.0',
        nodeVersion: process.version,
      });
      return true;
    }

    // 2. Presets
    if (pathname === '/api/presets' && req.method === 'GET') {
      sendJson(200, { presets: db.getPresets() });
      return true;
    }

    // 3. Queueing Theory Calculations
    if (pathname === '/api/theory' && req.method === 'POST') {
      try {
        const { lambda = 0.5, mu = 0.25, c = 3, cs2 = 1.0, targetWait = 5.0 } = body || {};
        const mmc = QueueingTheory.calculateMMC(Number(lambda), Number(mu), Number(c), Number(cs2));
        const recommendation = QueueingTheory.recommendCounters(Number(lambda), Number(mu), Number(targetWait));
        sendJson(200, { mmc, recommendation });
      } catch (err) {
        sendError(400, err.message);
      }
      return true;
    }

    // 4. Single Strategy Simulation
    if (pathname === '/api/simulate' && req.method === 'POST') {
      try {
        const {
          strategy = 'BASELINE',
          config = {},
          counters: userCounters = null,
          counterCount = 3,
        } = body || {};

        const customerCount = Math.max(100, config.count || 100);
        const simConfig = { ...config, count: customerCount };
        const customers = DiscreteEventSimulation.generateCustomers(simConfig);
        const counters = userCounters || DiscreteEventSimulation.createDefaultCounters(Math.max(3, counterCount));

        const result = StrategyRunner.runSimulation(strategy, customers, counters);

        // Theoretical benchmark comparison
        const avgArrivalInterval = customers.length > 1
          ? (customers[customers.length - 1].arrivalTime - customers[0].arrivalTime) / (customers.length - 1)
          : 3.0;
        const lambda = 1 / Math.max(0.1, avgArrivalInterval);
        const mu = 1 / Math.max(0.5, result.summary.avgServiceMinutes);
        const theoretical = QueueingTheory.calculateMMC(lambda, mu, counters.filter(c => !c.isSurgeCounter).length);

        // Save run to DB
        db.saveRun(result.summary, strategy, customerCount);

        sendJson(200, {
          success: true,
          strategy,
          result,
          theoretical,
          customerCohort: customers.slice(0, 100), // Return cohort for visualization
        });
      } catch (err) {
        console.error('Simulation error:', err);
        sendError(500, err.message);
      }
      return true;
    }

    // 5. Side-by-Side Comparison (Benchmark across multiple strategies)
    if (pathname === '/api/compare' && req.method === 'POST') {
      try {
        const {
          strategies = ['BASELINE', 'DYNAMIC_LOAD_BALANCED', 'PREDICTIVE_SURGE', 'PRIORITY_AWARE'],
          config = {},
          counters: userCounters = null,
          counterCount = 5, // 3 regular + 2 surge
        } = body || {};

        const customerCount = Math.max(100, config.count || 120);
        const simConfig = { ...config, count: customerCount };
        // Generate ONE single customer cohort so all strategies are tested on IDENTICAL data!
        const masterCustomers = DiscreteEventSimulation.generateCustomers(simConfig);
        const masterCounters = userCounters || DiscreteEventSimulation.createDefaultCounters(Math.max(3, counterCount));

        const comparison = StrategyRunner.compareStrategies(strategies, masterCustomers, masterCounters);

        // Calculate congestion forecast for this cohort
        const meanServiceTime = masterCustomers.reduce((acc, c) => acc + c.nominalDuration, 0) / masterCustomers.length;
        const totalDuration = Math.max(...masterCustomers.map(c => c.arrivalTime)) + 60;
        const congestionForecast = CongestionPredictor.analyzeCongestion(
          masterCustomers,
          totalDuration,
          3, // active base counters
          meanServiceTime,
          15 // 15-min buckets
        );

        sendJson(200, {
          success: true,
          comparison,
          congestionForecast,
          masterCustomersCount: masterCustomers.length,
        });
      } catch (err) {
        console.error('Comparison error:', err);
        sendError(500, err.message);
      }
      return true;
    }

    // 6. Congestion Forecast & Peak Windows
    if (pathname === '/api/forecast' && req.method === 'POST') {
      try {
        const { config = {}, activeCounters = 3, windowSizeMinutes = 10 } = body || {};
        const customerCount = Math.max(100, config.count || 100);
        const customers = DiscreteEventSimulation.generateCustomers({ ...config, count: customerCount });
        const meanServiceTime = customers.reduce((a, c) => a + c.nominalDuration, 0) / customers.length;
        const totalDuration = Math.max(...customers.map(c => c.arrivalTime)) + 60;

        const forecast = CongestionPredictor.analyzeCongestion(
          customers,
          totalDuration,
          activeCounters,
          meanServiceTime,
          windowSizeMinutes
        );

        sendJson(200, { success: true, forecast });
      } catch (err) {
        sendError(500, err.message);
      }
      return true;
    }

    // 7. Resource & Staffing Cost Optimization
    if (pathname === '/api/optimize' && req.method === 'POST') {
      try {
        const { config = {}, constraints = {} } = body || {};
        const customerCount = Math.max(100, config.count || 120);
        const customers = DiscreteEventSimulation.generateCustomers({ ...config, count: customerCount });
        const optimization = ResourceOptimizer.optimizeStaffing(customers, constraints);
        sendJson(200, { success: true, optimization });
      } catch (err) {
        sendError(500, err.message);
      }
      return true;
    }

    // 8. Run History
    if (pathname === '/api/history' && req.method === 'GET') {
      const limit = Number(query.limit) || 15;
      sendJson(200, { runs: db.getRecentRuns(limit) });
      return true;
    }

    return false; // Not an API route
  }
}

module.exports = ApiRoutes;
