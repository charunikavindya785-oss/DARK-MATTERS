/**
 * SmartQ - Strategy Simulation Runner
 * Implements Baseline and Advanced Resource Allocation Strategies with
 * high-fidelity event-driven simulation, metrics collection, and side-by-side comparison.
 */

const { MinHeap } = require('./discreteEventSimulation');

class StrategyRunner {
  /**
   * Run simulation under a specified resource allocation strategy
   * @param {string} strategyType - 'BASELINE', 'DYNAMIC_LOAD_BALANCED', 'PREDICTIVE_SURGE', 'PRIORITY_AWARE'
   * @param {Array} rawCustomers - Master customer cohort (will be deep cloned)
   * @param {Array} initialCounters - Initial counters configuration
   * @param {Object} options - Strategy-specific tuning knobs
   * @returns {Object} Comprehensive simulation results and analytics
   */
  static runSimulation(strategyType, rawCustomers, initialCounters, options = {}) {
    // Deep clone inputs to ensure pristine independent runs on identical cohorts
    const customers = JSON.parse(JSON.stringify(rawCustomers));
    const counters = JSON.parse(JSON.stringify(initialCounters)).map(c => ({
      ...c,
      status: c.isSurgeCounter ? 'OFFLINE' : (c.status || 'IDLE'),
      currentCustomer: null,
      totalBusyMinutes: 0,
      totalIdleMinutes: 0,
      customersServed: 0,
      stateHistory: [],
    }));

    const eventQueue = new MinHeap();
    let currentClock = 0;
    const completedCustomers = [];
    const queue = []; // Waiting customers
    const telemetry = {
      timestamps: [],
      queueLengths: [],
      activeCounters: [],
      averageWaits: [],
    };

    // Strategy parameters
    const surgeThresholdQueue = options.surgeThresholdQueue || 10;
    const surgeThresholdWait = options.surgeThresholdWait || 12;
    const recoveryThresholdQueue = options.recoveryThresholdQueue || 3;
    const maxSurgeCounters = options.maxSurgeCounters || 2;
    let surgeCountersActivated = 0;

    // Load initial customer arrival events into Event Calendar
    for (const cust of customers) {
      eventQueue.push({
        time: cust.arrivalTime,
        type: 'CUSTOMER_ARRIVAL',
        customerId: cust.id,
      });
    }

    // Add periodic monitoring heartbeat every 5 minutes
    const maxTime = Math.max(...customers.map(c => c.arrivalTime)) + 120;
    for (let t = 5; t <= maxTime; t += 5) {
      eventQueue.push({
        time: t,
        type: 'HEARTBEAT_MONITOR',
      });
    }

    // Map for fast customer lookup
    const customerMap = new Map();
    for (const c of customers) {
      customerMap.set(c.id, c);
    }

    // Helper: Select next customer based on strategy
    const getNextCustomerForCounter = (counter, clock) => {
      if (queue.length === 0) return null;

      if (strategyType === 'BASELINE') {
        // Strict FIFO
        return queue.shift();
      }

      if (strategyType === 'PRIORITY_AWARE') {
        // Priority with aging to avoid starvation
        // Score = PriorityWeight * 10 + WaitingTimeInQueue * 1.5
        let bestIdx = 0;
        let highestScore = -Infinity;

        for (let i = 0; i < queue.length; i++) {
          const cust = queue[i];
          const timeInQueue = clock - cust.arrivalTime;
          const score = cust.priorityWeight * 10 + timeInQueue * 1.5;
          if (score > highestScore) {
            highestScore = score;
            bestIdx = i;
          }
        }
        return queue.splice(bestIdx, 1)[0];
      }

      if (strategyType === 'DYNAMIC_LOAD_BALANCED') {
        // If counter has express specialty, favor express/short tasks
        if (counter.name.includes('Express') || counter.efficiency > 1.05) {
          const expressIdx = queue.findIndex(c => c.nominalDuration <= 4.0 || c.category === 'EXPRESS');
          if (expressIdx !== -1) {
            return queue.splice(expressIdx, 1)[0];
          }
        }
        // Otherwise standard FIFO
        return queue.shift();
      }

      // PREDICTIVE_SURGE: Balanced FIFO with priority boost
      let bestIdx = 0;
      let highestScore = -Infinity;
      for (let i = 0; i < queue.length; i++) {
        const cust = queue[i];
        const wait = clock - cust.arrivalTime;
        const score = (cust.category === 'EMERGENCY' ? 25 : cust.category === 'PRIORITY' ? 10 : 0) + wait;
        if (score > highestScore) {
          highestScore = score;
          bestIdx = i;
        }
      }
      return queue.splice(bestIdx, 1)[0];
    };

    // Helper: Find available counter
    const getAvailableCounter = (customer) => {
      const activeIdle = counters.filter(c => c.status === 'IDLE');
      if (activeIdle.length === 0) return null;

      if (strategyType === 'DYNAMIC_LOAD_BALANCED') {
        // Assign to most suitable idle counter based on efficiency & task duration
        if (customer.nominalDuration > 8.0) {
          // Complex task: give to highest efficiency clerk
          return activeIdle.sort((a, b) => b.efficiency - a.efficiency)[0];
        } else if (customer.nominalDuration <= 4.0) {
          // Quick task: give to express or standard clerk
          const express = activeIdle.find(c => c.name.includes('Express'));
          return express || activeIdle[0];
        }
      }

      // Default: pick least loaded counter to balance wear & tear
      return activeIdle.sort((a, b) => a.totalBusyMinutes - b.totalBusyMinutes)[0];
    };

    // Helper: Check surge scaling conditions
    const evaluateSurgeScaling = (clock) => {
      if (strategyType !== 'PREDICTIVE_SURGE') return;

      const currentQueueSize = queue.length;
      const avgWaitCurrent = queue.length > 0 
        ? queue.reduce((sum, c) => sum + (clock - c.arrivalTime), 0) / queue.length 
        : 0;

      // Scale Up Condition: Backlog surge
      if ((currentQueueSize >= surgeThresholdQueue || avgWaitCurrent >= surgeThresholdWait) && 
          surgeCountersActivated < maxSurgeCounters) {
        const offlineSurge = counters.find(c => c.isSurgeCounter && c.status === 'OFFLINE');
        if (offlineSurge) {
          offlineSurge.status = 'IDLE';
          surgeCountersActivated++;
          offlineSurge.stateHistory.push({ time: clock, action: 'ACTIVATED_SURGE' });

          // Immediately assign a customer if queue is not empty
          if (queue.length > 0) {
            const nextCust = getNextCustomerForCounter(offlineSurge, clock);
            if (nextCust) {
              startService(offlineSurge, nextCust, clock);
            }
          }
        }
      }

      // Scale Down Condition: System normal and queue dissipated
      if (currentQueueSize <= recoveryThresholdQueue && surgeCountersActivated > 0) {
        const activeSurge = counters.find(c => c.isSurgeCounter && c.status === 'IDLE');
        if (activeSurge) {
          activeSurge.status = 'OFFLINE';
          surgeCountersActivated--;
          activeSurge.stateHistory.push({ time: clock, action: 'DEACTIVATED_SURGE' });
        }
      }
    };

    // Helper: Start service
    const startService = (counter, customer, clock) => {
      counter.status = 'BUSY';
      counter.currentCustomer = customer;
      customer.status = 'IN_SERVICE';
      customer.serviceStartTime = Number(clock.toFixed(2));
      customer.waitingTime = Number(Math.max(0, clock - customer.arrivalTime).toFixed(2));
      customer.assignedCounterId = counter.id;
      customer.servedByCounterName = counter.name;

      // Calculate actual service duration adjusted for counter efficiency
      const adjustedDuration = Math.max(0.5, customer.nominalDuration / counter.efficiency);
      customer.actualServiceDuration = Number(adjustedDuration.toFixed(2));
      customer.serviceEndTime = Number((clock + adjustedDuration).toFixed(2));

      // Push service completion event
      eventQueue.push({
        time: customer.serviceEndTime,
        type: 'SERVICE_COMPLETION',
        counterId: counter.id,
        customerId: customer.id,
      });
    };

    // Main Discrete-Event Simulation Loop
    while (eventQueue.length > 0) {
      const event = eventQueue.pop();
      currentClock = event.time;

      if (event.type === 'CUSTOMER_ARRIVAL') {
        const customer = customerMap.get(event.customerId);
        customer.status = 'WAITING';

        const availableCounter = getAvailableCounter(customer);
        if (availableCounter) {
          startService(availableCounter, customer, currentClock);
        } else {
          queue.push(customer);
        }

        // Check surge trigger
        evaluateSurgeScaling(currentClock);

      } else if (event.type === 'SERVICE_COMPLETION') {
        const counter = counters.find(c => c.id === event.counterId);
        const customer = customerMap.get(event.customerId);

        if (counter && customer) {
          customer.status = 'COMPLETED';
          completedCustomers.push(customer);
          counter.customersServed++;
          counter.totalBusyMinutes += customer.actualServiceDuration;
          counter.currentCustomer = null;
          counter.status = 'IDLE';

          // Try to serve next customer from queue
          const nextCustomer = getNextCustomerForCounter(counter, currentClock);
          if (nextCustomer) {
            startService(counter, nextCustomer, currentClock);
          } else {
            // Check if surge counter should power down
            if (counter.isSurgeCounter && queue.length <= recoveryThresholdQueue) {
              counter.status = 'OFFLINE';
              surgeCountersActivated = Math.max(0, surgeCountersActivated - 1);
              counter.stateHistory.push({ time: currentClock, action: 'DEACTIVATED_SURGE' });
            }
          }

          evaluateSurgeScaling(currentClock);
        }

      } else if (event.type === 'HEARTBEAT_MONITOR') {
        // Record telemetry snapshot
        const activeCount = counters.filter(c => c.status === 'BUSY' || c.status === 'IDLE').length;
        const currentWaits = completedCustomers.length > 0
          ? completedCustomers.reduce((acc, c) => acc + c.waitingTime, 0) / completedCustomers.length
          : 0;

        telemetry.timestamps.push(Number(currentClock.toFixed(1)));
        telemetry.queueLengths.push(queue.length);
        telemetry.activeCounters.push(activeCount);
        telemetry.averageWaits.push(Number(currentWaits.toFixed(2)));

        evaluateSurgeScaling(currentClock);
      }
    }

    // Final calculations & Performance Metrics
    const totalSimDuration = currentClock > 0 ? currentClock : 1;
    const waitingTimes = completedCustomers.map(c => c.waitingTime);
    const sortedWaits = [...waitingTimes].sort((a, b) => a - b);

    const avgWait = waitingTimes.length > 0 
      ? waitingTimes.reduce((acc, w) => acc + w, 0) / waitingTimes.length 
      : 0;

    const medianWait = sortedWaits.length > 0 
      ? sortedWaits[Math.floor(sortedWaits.length * 0.5)] 
      : 0;

    const p95Wait = sortedWaits.length > 0 
      ? sortedWaits[Math.floor(sortedWaits.length * 0.95)] 
      : 0;

    const maxWait = sortedWaits.length > 0 
      ? sortedWaits[sortedWaits.length - 1] 
      : 0;

    const avgServiceTime = completedCustomers.length > 0
      ? completedCustomers.reduce((acc, c) => acc + c.actualServiceDuration, 0) / completedCustomers.length
      : 0;

    // SLA Compliance: Percentage of customers waiting under 10 minutes
    const slaTarget = 10.0;
    const compliantCount = completedCustomers.filter(c => c.waitingTime <= slaTarget).length;
    const slaCompliancePct = completedCustomers.length > 0 
      ? Number(((compliantCount / completedCustomers.length) * 100).toFixed(1)) 
      : 100;

    // Counter utilization metrics
    const counterMetrics = counters.map(c => {
      const activeSpan = totalSimDuration;
      const utilPct = Math.min(100, Number(((c.totalBusyMinutes / Math.max(1, activeSpan)) * 100).toFixed(1)));
      return {
        id: c.id,
        name: c.name,
        efficiency: c.efficiency,
        isSurgeCounter: c.isSurgeCounter,
        customersServed: c.customersServed,
        totalBusyMinutes: Number(c.totalBusyMinutes.toFixed(1)),
        utilizationPct: utilPct,
      };
    });

    // Compute standard deviation of utilization across base counters (Fairness index)
    const baseCounters = counterMetrics.filter(c => !c.isSurgeCounter);
    const meanBaseUtil = baseCounters.reduce((acc, c) => acc + c.utilizationPct, 0) / Math.max(1, baseCounters.length);
    const utilVariance = baseCounters.reduce((acc, c) => acc + Math.pow(c.utilizationPct - meanBaseUtil, 2), 0) / Math.max(1, baseCounters.length);
    const utilStdDev = Number(Math.sqrt(utilVariance).toFixed(2));

    const peakQueue = telemetry.queueLengths.length > 0 ? Math.max(...telemetry.queueLengths) : 0;
    const avgQueue = telemetry.queueLengths.length > 0 
      ? Number((telemetry.queueLengths.reduce((a, b) => a + b, 0) / telemetry.queueLengths.length).toFixed(2)) 
      : 0;

    // Customer Satisfaction (CSAT 1 to 5 stars) heuristic
    // 5 stars if avg wait <= 3 min; drops to 1 star if wait >= 20 min
    const csatScore = Math.max(1.0, Math.min(5.0, Number((5.0 - (avgWait / 4.0)).toFixed(2))));

    // Total staff-hours consumed (operational cost metric)
    const totalActiveCounterHours = Number((counters.reduce((acc, c) => {
      return acc + (c.isSurgeCounter ? c.totalBusyMinutes / 60 : totalSimDuration / 60);
    }, 0)).toFixed(2));

    return {
      strategyType,
      strategyName: strategyType === 'BASELINE' ? 'Baseline (Static FIFO / No Rebalancing)'
        : strategyType === 'DYNAMIC_LOAD_BALANCED' ? 'Dynamic Load Balancing & Skill Routing'
        : strategyType === 'PREDICTIVE_SURGE' ? 'SmartQ AI Predictive Surge Allocation'
        : 'Priority-Weighted Starvation-Free Scheduling',
      summary: {
        totalCustomers: completedCustomers.length,
        totalDurationMinutes: Number(totalSimDuration.toFixed(1)),
        avgWaitMinutes: Number(avgWait.toFixed(2)),
        medianWaitMinutes: Number(medianWait.toFixed(2)),
        p95WaitMinutes: Number(p95Wait.toFixed(2)),
        maxWaitMinutes: Number(maxWait.toFixed(2)),
        avgServiceMinutes: Number(avgServiceTime.toFixed(2)),
        avgTurnaroundMinutes: Number((avgWait + avgServiceTime).toFixed(2)),
        peakQueueLength: peakQueue,
        avgQueueLength: avgQueue,
        slaCompliancePct,
        utilizationFairnessStdDev: utilStdDev,
        overallUtilizationPct: Number(meanBaseUtil.toFixed(1)),
        csatScore,
        counterHoursConsumed: totalActiveCounterHours,
      },
      counterMetrics,
      telemetry,
      sampleCustomers: completedCustomers.slice(0, 50), // Sample for table display
    };
  }

  /**
   * Run comparison across multiple strategies on the identical customer cohort
   * Computes precise percentage improvements against Baseline!
   * @param {Array} strategies - List of strategy types to compare
   * @param {Array} customers - Identical customer cohort
   * @param {Array} counters - Initial counters
   * @returns {Object} Comparative analysis report
   */
  static compareStrategies(strategies, customers, counters) {
    const results = {};
    for (const strat of strategies) {
      results[strat] = this.runSimulation(strat, customers, counters);
    }

    const baseline = results['BASELINE'] || Object.values(results)[0];

    // Compute delta improvements against Baseline
    const comparativeMetrics = {};
    for (const [stratKey, res] of Object.entries(results)) {
      if (stratKey === 'BASELINE') {
        comparativeMetrics[stratKey] = {
          avgWaitReductionPct: 0,
          maxWaitReductionPct: 0,
          peakQueueReductionPct: 0,
          slaImprovementPct: 0,
          fairnessImprovementPct: 0,
          csatDelta: 0,
        };
      } else {
        const baseAvgWait = Math.max(0.1, baseline.summary.avgWaitMinutes);
        const baseMaxWait = Math.max(0.1, baseline.summary.maxWaitMinutes);
        const basePeakQ = Math.max(1, baseline.summary.peakQueueLength);
        const baseSla = Math.max(1, baseline.summary.slaCompliancePct);

        const avgWaitDelta = ((baseAvgWait - res.summary.avgWaitMinutes) / baseAvgWait) * 100;
        const maxWaitDelta = ((baseMaxWait - res.summary.maxWaitMinutes) / baseMaxWait) * 100;
        const peakQDelta = ((basePeakQ - res.summary.peakQueueLength) / basePeakQ) * 100;
        const slaDelta = res.summary.slaCompliancePct - baseSla;
        const fairnessDelta = baseline.summary.utilizationFairnessStdDev - res.summary.utilizationFairnessStdDev;
        const csatDelta = Number((res.summary.csatScore - baseline.summary.csatScore).toFixed(2));

        comparativeMetrics[stratKey] = {
          avgWaitReductionPct: Number(avgWaitDelta.toFixed(1)),
          maxWaitReductionPct: Number(maxWaitDelta.toFixed(1)),
          peakQueueReductionPct: Number(peakQDelta.toFixed(1)),
          slaImprovementPct: Number(slaDelta.toFixed(1)),
          fairnessImprovementPct: Number(fairnessDelta.toFixed(2)),
          csatDelta,
        };
      }
    }

    return {
      timestamp: new Date().toISOString(),
      customerCount: customers.length,
      baselineMetrics: baseline.summary,
      results,
      comparativeMetrics,
    };
  }
}

module.exports = StrategyRunner;
