/**
 * SmartQ - Automated Verification & Test Suite
 * Validates Queueing Theory, Discrete-Event Simulation, Strategies, and Measurable Improvements
 */

const assert = require('assert');
const QueueingTheory = require('../backend/engine/queueingTheory');
const CongestionPredictor = require('../backend/engine/congestionPredictor');
const { DiscreteEventSimulation } = require('../backend/engine/discreteEventSimulation');
const StrategyRunner = require('../backend/engine/strategies');
const ResourceOptimizer = require('../backend/engine/resourceOptimizer');
const db = require('../backend/db/database');

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log('\n======================================================');
console.log('🧪 RUNNING SMARTQ VERIFICATION TEST SUITE');
console.log('======================================================\n');

// 1. Queueing Theory Tests
console.log('--- Suite 1: Queueing Theory (M/M/c & Little\'s Law) ---');

it('calculates M/M/c metrics accurately for stable queue', () => {
  // 3 servers, lambda = 0.5/min (1 arrival every 2 min), mu = 0.25/min (service time 4 min)
  // rho = 0.5 / (3 * 0.25) = 0.6667
  const res = QueueingTheory.calculateMMC(0.5, 0.25, 3);
  assert.strictEqual(res.isStable, true);
  assert.strictEqual(res.c, 3);
  assert.strictEqual(res.rho, 0.6667);
  assert.strictEqual(res.utilizationPct, 66.7);
  assert(res.wqMinutes > 0, 'Wait time must be positive');
  assert(res.lq > 0, 'Queue length must be positive');

  // Verify Little's Law: Lq = lambda * Wq (within rounding margin)
  const calculatedLq = res.lambda * res.wqMinutes;
  assert(Math.abs(calculatedLq - res.lq) < 0.05, `Little's law violated: Lq=${res.lq}, calc=${calculatedLq}`);
});

it('detects unstable queue when arrival rate exceeds capacity (rho >= 1.0)', () => {
  // 3 servers, lambda = 1.0/min, mu = 0.25/min (capacity = 0.75/min) -> rho = 1.33 > 1.0
  const res = QueueingTheory.calculateMMC(1.0, 0.25, 3);
  assert.strictEqual(res.isStable, false);
  assert(res.rho >= 1.0);
  assert.strictEqual(res.wqMinutes, Infinity);
  assert(res.recommendedCounters >= 4);
});

it('calculates M/G/c approximation with high service time variance', () => {
  // With Cs^2 = 2.0 (high variance), Wq should be higher than standard M/M/c (Cs^2 = 1.0)
  const mmc = QueueingTheory.calculateMMC(0.5, 0.25, 3, 1.0);
  const mgc = QueueingTheory.calculateMMC(0.5, 0.25, 3, 2.0);
  assert(mgc.wqMinutes > mmc.wqMinutes, 'M/G/c with high variance must have higher wait time than M/M/c');
});

// 2. Discrete Event Simulation Tests
console.log('\n--- Suite 2: Discrete-Event Simulation Engine ---');

it('generates reproducible customer cohort (>= 100 customers) with seed', () => {
  const cohort1 = DiscreteEventSimulation.generateCustomers({ count: 120, seed: 999 });
  const cohort2 = DiscreteEventSimulation.generateCustomers({ count: 120, seed: 999 });
  assert.strictEqual(cohort1.length, 120);
  assert.strictEqual(cohort2.length, 120);
  assert.strictEqual(cohort1[0].arrivalTime, cohort2[0].arrivalTime);
  assert.strictEqual(cohort1[50].nominalDuration, cohort2[50].nominalDuration);
  assert.strictEqual(cohort1[119].id, cohort2[119].id);
});

it('creates at least three service counters with proper initial states', () => {
  const counters = DiscreteEventSimulation.createDefaultCounters(3);
  assert.strictEqual(counters.length, 3);
  assert(counters.every(c => c.status === 'IDLE' || c.status === 'OFFLINE'));
});

// 3. Strategy Comparison & Improvement Tests
console.log('\n--- Suite 3: Strategy Comparison & Measurable Improvements ---');

it('demonstrates measurable wait time reduction for SmartQ Adaptive Surge vs Baseline', () => {
  const customers = DiscreteEventSimulation.generateCustomers({
    count: 150,
    meanArrivalInterval: 2.2,
    arrivalPattern: 'SURGE_PEAKS',
    seed: 42,
  });
  const counters = DiscreteEventSimulation.createDefaultCounters(5);

  const baselineRes = StrategyRunner.runSimulation('BASELINE', customers, counters);
  const adaptiveRes = StrategyRunner.runSimulation('PREDICTIVE_SURGE', customers, counters);

  assert.strictEqual(baselineRes.summary.totalCustomers, 150);
  assert.strictEqual(adaptiveRes.summary.totalCustomers, 150);

  console.log(`    [Metrics Check] Baseline Avg Wait: ${baselineRes.summary.avgWaitMinutes}m, Max Wait: ${baselineRes.summary.maxWaitMinutes}m, Peak Q: ${baselineRes.summary.peakQueueLength}`);
  console.log(`    [Metrics Check] Adaptive Avg Wait: ${adaptiveRes.summary.avgWaitMinutes}m, Max Wait: ${adaptiveRes.summary.maxWaitMinutes}m, Peak Q: ${adaptiveRes.summary.peakQueueLength}`);

  // Measurable improvement check:
  assert(adaptiveRes.summary.avgWaitMinutes < baselineRes.summary.avgWaitMinutes, 'Adaptive strategy must reduce average wait time!');
  assert(adaptiveRes.summary.peakQueueLength < baselineRes.summary.peakQueueLength, 'Adaptive strategy must reduce peak queue length!');

  const waitReductionPct = ((baselineRes.summary.avgWaitMinutes - adaptiveRes.summary.avgWaitMinutes) / baselineRes.summary.avgWaitMinutes) * 100;
  console.log(`    [Measurable Improvement] Waiting Time Reduction: ${waitReductionPct.toFixed(1)}%`);
  assert(waitReductionPct > 15, 'Wait time reduction should be significant (>15%)');
});

it('compares all 4 strategies on identical customer cohort', () => {
  const customers = DiscreteEventSimulation.generateCustomers({
    count: 120,
    meanArrivalInterval: 2.3,
    arrivalPattern: 'SURGE_PEAKS',
    seed: 101,
  });
  const counters = DiscreteEventSimulation.createDefaultCounters(5);

  const comparison = StrategyRunner.compareStrategies(
    ['BASELINE', 'DYNAMIC_LOAD_BALANCED', 'PREDICTIVE_SURGE', 'PRIORITY_AWARE'],
    customers,
    counters
  );

  assert(comparison.results['BASELINE']);
  assert(comparison.results['DYNAMIC_LOAD_BALANCED']);
  assert(comparison.results['PREDICTIVE_SURGE']);
  assert(comparison.results['PRIORITY_AWARE']);
  assert(comparison.comparativeMetrics['PREDICTIVE_SURGE'].avgWaitReductionPct > 0, 'PREDICTIVE_SURGE must reduce wait time during surge peaks');
});

// 4. Congestion Forecasting Tests
console.log('\n--- Suite 4: Congestion Forecaster & Peak Predictor ---');

it('identifies peak congestion windows in surge scenarios', () => {
  const customers = DiscreteEventSimulation.generateCustomers({
    count: 140,
    arrivalPattern: 'SURGE_PEAKS',
    seed: 55,
  });
  const forecast = CongestionPredictor.analyzeCongestion(customers, 300, 3, 5.0, 15);
  assert(forecast.timelineBuckets.length > 0);
  assert(forecast.peakCongestionWindows.length > 0, 'Must detect peak congestion windows');
  console.log(`    [Forecast Check] Detected ${forecast.peakCongestionWindows.length} peak congestion window(s)`);
});

// 5. Resource Optimizer Tests
console.log('\n--- Suite 5: Staff Constrained Resource Optimizer ---');

it('calculates Pareto staffing frontier and identifies cost savings', () => {
  const customers = DiscreteEventSimulation.generateCustomers({ count: 100, seed: 77 });
  const opt = ResourceOptimizer.optimizeStaffing(customers, {
    maxCountersAllowed: 5,
    minCountersRequired: 3,
    hourlyCostPerCounter: 30,
    slaComplianceGoal: 85,
  });

  assert(opt.paretoFrontier.length >= 3);
  assert(opt.recommendedPolicy);
  console.log(`    [Optimizer Check] Recommended: ${opt.recommendedPolicy.name}, Savings: $${opt.savingsSummary.dollarsSaved} (${opt.savingsSummary.costReductionPct}%)`);
});

// 6. Database Storage Tests
console.log('\n--- Suite 6: Database Storage & Presets ---');

it('loads presets and persists simulation runs', () => {
  const presets = db.getPresets();
  assert(presets.length >= 4, 'Must have at least 4 presets');
  db.saveRun({ avgWaitMinutes: 4.2, maxWaitMinutes: 12.0, peakQueueLength: 8, slaCompliancePct: 95.0, csatScore: 4.2 }, 'PREDICTIVE_SURGE', 100);
  const recent = db.getRecentRuns(5);
  assert(recent.length > 0);
});

console.log('\n======================================================');
console.log(`📊 TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${((passedTests/totalTests)*100).toFixed(0)}%)`);
console.log('======================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
