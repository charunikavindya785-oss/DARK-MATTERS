/**
 * SmartQ - Standalone Browser Bundle
 * Allows opening index.html directly in Chrome via file:// without CORS restrictions.
 */
(function () {
  'use strict';

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function normalRandom(mean, stdDev) {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * stdDev;
  }

  function formatMinutes(minutes) {
    if (minutes < 0) return '0.0 min';
    return `${minutes.toFixed(1)} min`;
  }

  function buildDemand({
    customerCount = 120,
    arrivalRate = 22,
    serviceMean = 8,
    serviceStd = 3,
    peakIntensity = 0.65,
  } = {}) {
    const customers = [];
    let currentTime = 0;

    for (let index = 0; index < customerCount; index += 1) {
      const progress = customerCount > 1 ? index / (customerCount - 1) : 0;
      const demandShift = 1 + peakIntensity * Math.sin(progress * Math.PI * 2.1 - 0.8);
      const interArrival = clamp((12 / arrivalRate) * (1 / Math.max(0.55, demandShift)), 0.25, 5);
      currentTime += interArrival;

      customers.push({
        id: index + 1,
        arrivalTime: Number(currentTime.toFixed(2)),
        serviceTime: Number(clamp(normalRandom(serviceMean, serviceStd), 2, 28).toFixed(2)),
        priority: Math.random() < 0.18 ? 'priority' : 'standard',
      });
    }

    return customers.sort((left, right) => left.arrivalTime - right.arrivalTime);
  }

  // ==========================================
  // MEMBER 04 & 05: WAITING TIME & ALLOCATION
  // ==========================================

  function calculateWaitingTime(arrivalTime, serviceStartTime) {
    if (serviceStartTime <= arrivalTime) return 0;
    return Number((serviceStartTime - arrivalTime).toFixed(2));
  }

  function calculateCustomerWait(customer, counter) {
    const serviceStartTime = Math.max(customer.arrivalTime, counter.nextAvailable || 0);
    const waitingTime = calculateWaitingTime(customer.arrivalTime, serviceStartTime);
    return {
      serviceStartTime: Number(serviceStartTime.toFixed(2)),
      waitingTime,
    };
  }

  function calculateAverageWaitingTime(waitData, count) {
    if (Array.isArray(waitData)) {
      if (waitData.length === 0) return 0;
      const total = waitData.reduce((sum, item) => {
        const wait = typeof item === 'object' && item !== null
          ? (item.waitingTime ?? item.waitTime ?? 0)
          : Number(item || 0);
        return sum + wait;
      }, 0);
      return Number((total / waitData.length).toFixed(2));
    }

    const customerCount = Number(count) || 0;
    if (customerCount <= 0) return 0;
    const totalWait = Number(waitData) || 0;
    return Number((totalWait / customerCount).toFixed(2));
  }

  function allocateCounter(counters, customer, strategy) {
    if (!counters || counters.length === 0) {
      throw new Error('No counters available.');
    }

    // Strategy 1: Baseline (Static Round-Robin)
    if (strategy === 'baseline') {
      return counters[(customer.id - 1) % counters.length];
    }

    // Strategy 2: Shortest Queue First
    if (strategy === 'shortest-queue') {
      return [...counters].sort((left, right) => {
        if (left.queueLength !== right.queueLength) {
          return left.queueLength - right.queueLength;
        }
        if (left.nextAvailable !== right.nextAvailable) {
          return left.nextAvailable - right.nextAvailable;
        }
        return left.id - right.id;
      })[0];
    }

    // Strategy 3: Dynamic Load Balancing
    return [...counters].sort((left, right) => {
      const leftWait = Math.max(0, left.nextAvailable - customer.arrivalTime);
      const rightWait = Math.max(0, right.nextAvailable - customer.arrivalTime);

      if (customer.priority === 'priority') {
        if (leftWait !== rightWait) return leftWait - rightWait;
        return left.nextAvailable - right.nextAvailable;
      }

      const leftScore = leftWait + left.queueLength * 1.2;
      const rightScore = rightWait + right.queueLength * 1.2;
      if (leftScore !== rightScore) return leftScore - rightScore;
      return left.nextAvailable - right.nextAvailable;
    })[0];
  }

  function simulateStrategy(customers, counterCount, strategy) {
    const counters = Array.from({ length: counterCount }, (_, index) => ({
      id: index + 1,
      nextAvailable: 0,
      totalBusyMinutes: 0,
      customersServed: 0,
      queueLength: 0,
      departureTimes: [],
      totalWaitTime: 0,
      averageWaitTime: 0,
    }));

    let totalWait = 0;
    let peakQueue = 0;
    const customerRecords = [];

    for (const customer of customers) {
      for (const counter of counters) {
        counter.departureTimes = counter.departureTimes.filter((d) => d > customer.arrivalTime);
        counter.queueLength = counter.departureTimes.length;
      }

      const selectedCounter = allocateCounter(counters, customer, strategy);
      const { serviceStartTime, waitingTime } = calculateCustomerWait(customer, selectedCounter);
      const finishTime = Number((serviceStartTime + customer.serviceTime).toFixed(2));

      selectedCounter.departureTimes.push(finishTime);
      selectedCounter.queueLength = selectedCounter.departureTimes.length;
      selectedCounter.nextAvailable = finishTime;
      selectedCounter.totalBusyMinutes += customer.serviceTime;
      selectedCounter.customersServed += 1;
      selectedCounter.totalWaitTime += waitingTime;
      selectedCounter.averageWaitTime = calculateAverageWaitingTime(
        selectedCounter.totalWaitTime,
        selectedCounter.customersServed
      );

      totalWait += waitingTime;
      peakQueue = Math.max(peakQueue, selectedCounter.queueLength);

      customerRecords.push({
        id: customer.id,
        arrivalTime: customer.arrivalTime,
        serviceTime: customer.serviceTime,
        counterId: selectedCounter.id,
        serviceStartTime,
        finishTime,
        waitingTime,
        priority: customer.priority,
      });
    }

    const averageWait = calculateAverageWaitingTime(totalWait, customers.length);
    const maxArrivalTime = customers.length > 0 ? Math.max(...customers.map((c) => c.arrivalTime)) : 0;
    const totalAvailableMinutes = counterCount * maxArrivalTime || 1;
    const averageUtilisation =
      counters.reduce((sum, c) => sum + c.totalBusyMinutes / totalAvailableMinutes, 0) / counters.length;

    const counterUtilisation = counters.map((c) => ({
      id: c.id,
      utilisation: Number(((c.totalBusyMinutes / totalAvailableMinutes) * 100).toFixed(1)),
      totalBusyMinutes: Number(c.totalBusyMinutes.toFixed(1)),
      customersServed: c.customersServed,
      totalWaitTime: Number(c.totalWaitTime.toFixed(1)),
      averageWait: Number(c.averageWaitTime.toFixed(1)),
    }));

    const congestionBuckets = buildCongestionBuckets(customers, counterCount);
    const peakBucket = congestionBuckets.reduce((best, b) => (!best || b.customers > best.customers ? b : best), null);

    return {
      strategy,
      averageWait,
      totalWait: Number(totalWait.toFixed(1)),
      peakQueue,
      averageUtilisation: Number((averageUtilisation * 100).toFixed(1)),
      counterUtilisation,
      peakCongestion: peakBucket,
      customersServed: customers.length,
      customerRecords,
    };
  }

  function buildCongestionBuckets(customers, counterCount) {
    const bucketSizeMinutes = 15;
    const buckets = {};
    const totalServiceMinutes = customers.reduce((sum, customer) => sum + customer.serviceTime, 0);
    const meanService = customers.length > 0 ? totalServiceMinutes / customers.length : 0;
    const nominalCapacity = counterCount * (60 / Math.max(meanService, 1));

    for (const customer of customers) {
      const bucketStart = Math.floor(customer.arrivalTime / bucketSizeMinutes) * bucketSizeMinutes;
      buckets[bucketStart] = (buckets[bucketStart] || 0) + 1;
    }

    return Object.entries(buckets)
      .map(([start, customersInBucket]) => ({
        label: `${Number(start).toFixed(0)}-${(Number(start) + bucketSizeMinutes).toFixed(0)} min`,
        customers: Number(customersInBucket),
        projectedQueue: Math.max(0, Math.ceil(customersInBucket - nominalCapacity * (bucketSizeMinutes / 60))),
      }))
      .sort((left, right) => right.customers - left.customers);
  }

  function compareStrategies(customers, counterCount) {
    const strategies = ['baseline', 'shortest-queue', 'dynamic'];
    const results = strategies.map((strategy) => simulateStrategy(customers, counterCount, strategy));
    const baseline = results.find((result) => result.strategy === 'baseline');

    return results.map((result) => ({
      ...result,
      improvement: baseline && baseline.averageWait > 0 ? ((baseline.averageWait - result.averageWait) / baseline.averageWait) * 100 : 0,
    }));
  }

  function recommendAllocation(results) {
    const sorted = [...results].sort((left, right) => left.averageWait - right.averageWait);
    const winner = sorted[0];
    const baseline = results.find((result) => result.strategy === 'baseline');
    const gain = baseline && baseline.averageWait > 0 ? ((baseline.averageWait - winner.averageWait) / baseline.averageWait) * 100 : 0;

    return {
      strategy: winner.strategy,
      improvement: Number(gain.toFixed(1)),
      message: `${winner.strategy === 'dynamic' ? 'Dynamic redistribution' : winner.strategy === 'shortest-queue' ? 'Shortest-queue balancing' : 'Baseline static assignment'} is the preferred option. It lowers the average wait from ${formatMinutes(baseline?.averageWait ?? 0)} to ${formatMinutes(winner.averageWait)}, which is about ${Number(gain.toFixed(1))}% faster.`,
    };
  }

  // ==========================================
  // UI CONTROLLER
  // ==========================================

  function initApp() {
    window.__smartq_bundle = true;
    const form = document.getElementById('simulator-form');
    const runButton = document.getElementById('runSimulation');
    const recommendationBox = document.getElementById('recommendation');
    const strategyTable = document.getElementById('strategyTable');
    const congestionBars = document.getElementById('congestionBars');
    const counterUtilisation = document.getElementById('counterUtilisation');

    const metricEls = {
      avgWait: document.getElementById('avgWait'),
      peakQueue: document.getElementById('peakQueue'),
      utilisation: document.getElementById('utilisation'),
      improvement: document.getElementById('improvement'),
    };

    function readForm() {
      return {
        counterCount: Number(document.getElementById('counterCount').value || 3),
        customerCount: Number(document.getElementById('customerCount').value || 120),
        arrivalRate: Number(document.getElementById('arrivalRate').value || 22),
        serviceMean: Number(document.getElementById('serviceMean').value || 8),
        serviceStd: Number(document.getElementById('serviceStd').value || 3),
        peakIntensity: Number(document.getElementById('peakIntensity').value || 0.65),
      };
    }

    function renderComparison(results) {
      const baseline = results.find((result) => result.strategy === 'baseline');
      const best = [...results].sort((left, right) => left.averageWait - right.averageWait)[0];

      strategyTable.innerHTML = results
        .map((result) => {
          const improvement = baseline ? ((baseline.averageWait - result.averageWait) / baseline.averageWait) * 100 : 0;
          const bestClass = result.strategy === best.strategy ? 'best-row' : '';
          return `
            <tr class="${bestClass}">
              <td><strong>${result.strategy}</strong></td>
              <td>${formatMinutes(result.averageWait)}</td>
              <td>${result.peakQueue}</td>
              <td>${result.averageUtilisation}%</td>
              <td>${result.strategy === best.strategy ? '<span class="tag">Best</span>' : `${improvement.toFixed(1)}%`}</td>
            </tr>
          `;
        })
        .join('');
    }

    function renderCongestion(customers, counterCount) {
      const buckets = buildCongestionBuckets(customers, counterCount).slice(0, 6);
      const maxCustomers = Math.max(...buckets.map((bucket) => bucket.customers), 1);

      congestionBars.innerHTML = buckets
        .map(
          (bucket) => `
            <div class="congestion-bar">
              <div class="bar" style="height:${(bucket.customers / maxCustomers) * 100}%" title="${bucket.label}: ${bucket.customers} customers"></div>
              <span class="bar-label">${bucket.label.split('-')[0]}m</span>
            </div>
          `,
        )
        .join('');
    }

    function renderCounterUtilisation(results) {
      const best = [...results].sort((left, right) => left.averageWait - right.averageWait)[0];

      counterUtilisation.innerHTML = best.counterUtilisation
        .map(
          (counter) => `
            <div class="counter-card">
              <div class="counter-header">
                <strong>Counter ${counter.id}</strong>
                <span class="counter-badge">${counter.utilisation}% Busy</span>
              </div>
              <div class="progress">
                <div class="progress-bar" style="width:${Math.min(counter.utilisation, 100)}%"></div>
              </div>
              <div class="counter-stats-grid">
                <div class="counter-stat">
                  <span class="stat-title">Avg Wait</span>
                  <strong class="stat-value">${formatMinutes(counter.averageWait)}</strong>
                </div>
                <div class="counter-stat">
                  <span class="stat-title">Served</span>
                  <strong class="stat-value">${counter.customersServed}</strong>
                </div>
                <div class="counter-stat">
                  <span class="stat-title">Total Wait</span>
                  <strong class="stat-value">${formatMinutes(counter.totalWaitTime)}</strong>
                </div>
              </div>
            </div>
          `,
        )
        .join('');
    }

    function renderSummary(results, recommendation) {
      const baseline = results.find((result) => result.strategy === 'baseline');
      const winner = [...results].sort((left, right) => left.averageWait - right.averageWait)[0];

      metricEls.avgWait.textContent = formatMinutes(winner.averageWait).replace(' min', '');
      metricEls.peakQueue.textContent = String(winner.peakQueue);
      metricEls.utilisation.textContent = `${winner.averageUtilisation}%`;
      metricEls.improvement.textContent = `${recommendation.improvement}%`;

      recommendationBox.innerHTML = `
        <strong>${recommendation.strategy}</strong> is recommended.<br />
        ${recommendation.message}<br />
        Baseline queue peak: <strong>${baseline.peakQueue}</strong> customers versus projected <strong>${winner.peakQueue}</strong> under the recommended strategy.
      `;
    }

    function runSimulation() {
      const config = readForm();
      const customers = buildDemand(config);
      const results = compareStrategies(customers, config.counterCount);
      const recommendation = recommendAllocation(results);

      renderComparison(results);
      renderCongestion(customers, config.counterCount);
      renderCounterUtilisation(results);
      renderSummary(results, recommendation);
    }

    if (runButton) runButton.addEventListener('click', runSimulation);
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        runSimulation();
      });
    }

    runSimulation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
