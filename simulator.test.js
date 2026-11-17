import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDemand,
  compareStrategies,
  recommendAllocation,
  calculateWaitingTime,
  calculateCustomerWait,
  calculateAverageWaitingTime,
  allocateCounter,
  simulateStrategy,
} from './simulator.js';

test('buildDemand creates a realistic queued customer sample', () => {
  const customers = buildDemand({
    customerCount: 120,
    arrivalRate: 22,
    serviceMean: 8,
    serviceStd: 3,
    peakIntensity: 0.65,
  });

  assert.equal(customers.length, 120);
  assert.ok(customers.every((customer) => customer.arrivalTime >= 0));
  assert.ok(customers.every((customer) => customer.serviceTime > 0));
  assert.ok(customers.some((customer) => customer.priority === 'priority'));
});

test('calculateWaitingTime correctly calculates customer wait time', () => {
  // Case 1: Counter is immediately available (serviceStartTime == arrivalTime)
  assert.equal(calculateWaitingTime(10, 10), 0);

  // Case 2: Counter was idle before customer arrived (serviceStartTime < arrivalTime)
  assert.equal(calculateWaitingTime(15, 12), 0);

  // Case 3: Counter is busy; customer has to wait
  assert.equal(calculateWaitingTime(10, 14.5), 4.5);
  assert.equal(calculateWaitingTime(20.25, 25.75), 5.5);
});

test('calculateCustomerWait computes serviceStartTime and waitingTime from customer and counter', () => {
  const customer = { id: 1, arrivalTime: 12, serviceTime: 6 };
  const counterIdle = { id: 1, nextAvailable: 10 };
  const resultIdle = calculateCustomerWait(customer, counterIdle);

  assert.equal(resultIdle.serviceStartTime, 12);
  assert.equal(resultIdle.waitingTime, 0);

  const counterBusy = { id: 2, nextAvailable: 16.5 };
  const resultBusy = calculateCustomerWait(customer, counterBusy);

  assert.equal(resultBusy.serviceStartTime, 16.5);
  assert.equal(resultBusy.waitingTime, 4.5);
});

test('calculateAverageWaitingTime accurately averages wait times', () => {
  // Array of numbers
  assert.equal(calculateAverageWaitingTime([0, 4, 8]), 4);
  assert.equal(calculateAverageWaitingTime([2.5, 3.5]), 3);

  // Array of customer objects
  const customerObjects = [
    { id: 1, waitingTime: 2 },
    { id: 2, waitingTime: 4 },
    { id: 3, waitingTime: 6 },
  ];
  assert.equal(calculateAverageWaitingTime(customerObjects), 4);

  // Total wait and count
  assert.equal(calculateAverageWaitingTime(30, 6), 5);
  assert.equal(calculateAverageWaitingTime(10, 4), 2.5);

  // Empty or zero cases
  assert.equal(calculateAverageWaitingTime([], 0), 0);
  assert.equal(calculateAverageWaitingTime(0, 0), 0);
  assert.equal(calculateAverageWaitingTime(25, 0), 0);
});

test('allocateCounter allocates correctly based on strategy', () => {
  const counters = [
    { id: 1, nextAvailable: 10, queueLength: 2 },
    { id: 2, nextAvailable: 5, queueLength: 0 },
    { id: 3, nextAvailable: 15, queueLength: 3 },
  ];

  // Baseline: Round-robin by customer ID
  assert.equal(allocateCounter(counters, { id: 1 }, 'baseline').id, 1);
  assert.equal(allocateCounter(counters, { id: 2 }, 'baseline').id, 2);
  assert.equal(allocateCounter(counters, { id: 3 }, 'baseline').id, 3);
  assert.equal(allocateCounter(counters, { id: 4 }, 'baseline').id, 1);

  // Shortest-queue: Picks counter with smallest queueLength (Counter 2 has queueLength 0)
  assert.equal(allocateCounter(counters, { id: 5, arrivalTime: 8 }, 'shortest-queue').id, 2);

  // Dynamic: Picks counter minimizing wait and congestion
  assert.equal(allocateCounter(counters, { id: 6, arrivalTime: 8, priority: 'standard' }, 'dynamic').id, 2);
});

test('simulateStrategy tracks counter-level waiting times and overall average', () => {
  const customers = [
    { id: 1, arrivalTime: 0, serviceTime: 10, priority: 'standard' },
    { id: 2, arrivalTime: 2, serviceTime: 8, priority: 'standard' },
    { id: 3, arrivalTime: 4, serviceTime: 6, priority: 'standard' },
    { id: 4, arrivalTime: 6, serviceTime: 5, priority: 'standard' },
  ];

  const simulation = simulateStrategy(customers, 2, 'shortest-queue');

  assert.equal(simulation.customersServed, 4);
  assert.ok(simulation.averageWait >= 0);
  assert.equal(simulation.counterUtilisation.length, 2);

  // Check each counter has valid waiting time stats
  for (const counter of simulation.counterUtilisation) {
    assert.ok(counter.customersServed >= 0);
    assert.ok(counter.totalWaitTime >= 0);
    assert.ok(counter.averageWait >= 0);
  }
});

test('dynamic strategy outperforms baseline in a typical simulation', () => {
  const customers = buildDemand({
    customerCount: 150,
    arrivalRate: 26,
    serviceMean: 9,
    serviceStd: 3,
    peakIntensity: 0.8,
  });

  const results = compareStrategies(customers, 4);
  const baseline = results.find((result) => result.strategy === 'baseline');
  const dynamic = results.find((result) => result.strategy === 'dynamic');

  assert.ok(baseline);
  assert.ok(dynamic);
  assert.ok(dynamic.averageWait <= baseline.averageWait);
});

test('recommendation chooses the best strategy with a positive improvement', () => {
  const customers = buildDemand({
    customerCount: 140,
    arrivalRate: 24,
    serviceMean: 8,
    serviceStd: 2.5,
    peakIntensity: 0.7,
  });

  const results = compareStrategies(customers, 4);
  const recommendation = recommendAllocation(results);

  assert.ok(recommendation.strategy);
  assert.ok(recommendation.improvement >= 0);
  assert.match(recommendation.message, /preferred option/i);
});
