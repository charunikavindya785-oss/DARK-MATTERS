/**
 * SmartQ - Resource & Staffing Constrained Optimizer
 * Implements Pareto frontier search, budget-constrained scheduling,
 * and SLA-driven capacity recommendation.
 */

const StrategyRunner = require('./strategies');
const { DiscreteEventSimulation } = require('./discreteEventSimulation');

class ResourceOptimizer {
  /**
   * Optimize staffing schedule under budget or counter limits
   * @param {Array} customers - Customer cohort
   * @param {Object} constraints - Optimization parameters
   * @returns {Object} Optimization curve, Pareto frontier, and recommended allocation
   */
  static optimizeStaffing(customers, constraints = {}) {
    const {
      maxCountersAllowed = 6,
      minCountersRequired = 3,
      hourlyCostPerCounter = 25.0, // $25/hr
      targetSlaWaitMinutes = 10.0,
      slaComplianceGoal = 90.0, // 90%
    } = constraints;

    const evaluationRounds = [];

    // Evaluate static counter levels
    for (let c = minCountersRequired; c <= maxCountersAllowed; c++) {
      const counters = DiscreteEventSimulation.createDefaultCounters(c);
      // Mark all as active regular counters
      counters.forEach(cnt => {
        cnt.isSurgeCounter = false;
        cnt.status = 'IDLE';
      });

      const simResult = StrategyRunner.runSimulation('BASELINE', customers, counters);
      const totalSimHours = simResult.summary.totalDurationMinutes / 60;
      const totalLaborHours = c * totalSimHours;
      const totalLaborCost = totalLaborHours * hourlyCostPerCounter;

      evaluationRounds.push({
        type: 'STATIC',
        counterCount: c,
        name: `${c} Counters (Static All Day)`,
        avgWaitMinutes: simResult.summary.avgWaitMinutes,
        maxWaitMinutes: simResult.summary.maxWaitMinutes,
        peakQueue: simResult.summary.peakQueueLength,
        slaCompliancePct: simResult.summary.slaCompliancePct,
        laborHours: Number(totalLaborHours.toFixed(1)),
        laborCost: Number(totalLaborCost.toFixed(2)),
        isSlaMet: simResult.summary.slaCompliancePct >= slaComplianceGoal,
      });
    }

    // Evaluate SmartQ Adaptive Surge strategy (e.g. 3 base + 2 dynamic surge counters)
    const adaptiveCounters = DiscreteEventSimulation.createDefaultCounters(5);
    const adaptiveResult = StrategyRunner.runSimulation('PREDICTIVE_SURGE', customers, adaptiveCounters);
    const adaptiveSimHours = adaptiveResult.summary.totalDurationMinutes / 60;
    // Calculate actual active hours: base 3 counters * total hours + surge counters * busy hours
    const baseHours = 3 * adaptiveSimHours;
    const surgeHours = adaptiveResult.counterMetrics
      .filter(c => c.isSurgeCounter)
      .reduce((sum, c) => sum + (c.totalBusyMinutes / 60), 0);
    const totalAdaptiveHours = baseHours + surgeHours;
    const totalAdaptiveCost = totalAdaptiveHours * hourlyCostPerCounter;

    evaluationRounds.push({
      type: 'SMARTQ_ADAPTIVE',
      counterCount: '3 Base + 2 Dynamic Surge',
      name: 'SmartQ Adaptive (3 Base + Dynamic Surge)',
      avgWaitMinutes: adaptiveResult.summary.avgWaitMinutes,
      maxWaitMinutes: adaptiveResult.summary.maxWaitMinutes,
      peakQueue: adaptiveResult.summary.peakQueueLength,
      slaCompliancePct: adaptiveResult.summary.slaCompliancePct,
      laborHours: Number(totalAdaptiveHours.toFixed(1)),
      laborCost: Number(totalAdaptiveCost.toFixed(2)),
      isSlaMet: adaptiveResult.summary.slaCompliancePct >= slaComplianceGoal,
    });

    // Identify Recommended Policy (minimum labor hours that satisfies SLA compliance goal)
    const compliantPolicies = evaluationRounds.filter(r => r.isSlaMet);
    const recommendedPolicy = compliantPolicies.length > 0
      ? compliantPolicies.sort((a, b) => a.laborCost - b.laborCost)[0]
      : evaluationRounds.find(r => r.type === 'SMARTQ_ADAPTIVE') || evaluationRounds[evaluationRounds.length - 1];

    // Compute cost savings compared to brute-force full static staffing
    const maxStaticPolicy = evaluationRounds.find(r => r.counterCount === maxCountersAllowed) || evaluationRounds[evaluationRounds.length - 2];
    const savingsCost = Math.max(0, maxStaticPolicy.laborCost - recommendedPolicy.laborCost);
    const savingsLaborHours = Math.max(0, maxStaticPolicy.laborHours - recommendedPolicy.laborHours);
    const savingsPct = maxStaticPolicy.laborCost > 0 ? Number(((savingsCost / maxStaticPolicy.laborCost) * 100).toFixed(1)) : 0;

    return {
      constraints: {
        maxCountersAllowed,
        minCountersRequired,
        hourlyCostPerCounter,
        targetSlaWaitMinutes,
        slaComplianceGoal,
      },
      recommendedPolicy,
      savingsSummary: {
        dollarsSaved: Number(savingsCost.toFixed(2)),
        laborHoursSaved: Number(savingsLaborHours.toFixed(1)),
        costReductionPct: savingsPct,
        benchmarkVersus: maxStaticPolicy.name,
      },
      paretoFrontier: evaluationRounds,
    };
  }
}

module.exports = ResourceOptimizer;
