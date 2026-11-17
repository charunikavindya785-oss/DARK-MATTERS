export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function normalRandom(mean, stdDev) {
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = Math.random();
  }
  while (v === 0) {
    v = Math.random();
  }
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

export function formatMinutes(minutes) {
  if (minutes < 0) {
    return '0.0 min';
  }
  return `${minutes.toFixed(1)} min`;
}

export function buildDemand({
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

/**
 * ==============================================================================
 * COUNTER ALLOCATION & WAITING TIME CALCULATION MODULE
 * ==============================================================================
 */

/**
 * Calculates the waiting time for an individual customer.
 * Waiting time is the difference between when service begins and when the customer arrived.
 * If the counter is already idle when the customer arrives, the waiting time is 0.
 *
 * @param {number} arrivalTime - The time the customer arrived at the queue.
 * @param {number} serviceStartTime - The time the counter begins serving the customer.
 * @returns {number} The waiting time in minutes (>= 0).
 */
export function calculateWaitingTime(arrivalTime, serviceStartTime) {
  if (serviceStartTime <= arrivalTime) {
    return 0;
  }
  return Number((serviceStartTime - arrivalTime).toFixed(2));
}

/**
 * Determines the service start time and calculates the waiting time for a customer at a given counter.
 *
 * @param {Object} customer - The customer object with arrivalTime and serviceTime.
 * @param {Object} counter - The counter object with nextAvailable time.
 * @returns {{ serviceStartTime: number, waitingTime: number }} Service start time and waiting time.
 */
export function calculateCustomerWait(customer, counter) {
  const serviceStartTime = Math.max(customer.arrivalTime, counter.nextAvailable || 0);
  const waitingTime = calculateWaitingTime(customer.arrivalTime, serviceStartTime);
  return {
    serviceStartTime: Number(serviceStartTime.toFixed(2)),
    waitingTime,
  };
}

/**
 * Calculates the average waiting time for a set of customers or a given total wait time and customer count.
 * Average Waiting Time = Total Waiting Time / Total Customers
 *
 * @param {number|Array<number|Object>} waitData - Total wait time in minutes, or an array of wait times/customer objects.
 * @param {number} [count] - The total number of customers (used if waitData is a numeric total).
 * @returns {number} The average waiting time in minutes (rounded to 2 decimal places).
 */
export function calculateAverageWaitingTime(waitData, count) {
  if (Array.isArray(waitData)) {
    if (waitData.length === 0) {
      return 0;
    }
    const total = waitData.reduce((sum, item) => {
      const wait = typeof item === 'object' && item !== null
        ? (item.waitingTime ?? item.waitTime ?? 0)
        : Number(item || 0);
      return sum + wait;
    }, 0);
    return Number((total / waitData.length).toFixed(2));
  }

  const customerCount = Number(count) || 0;
  if (customerCount <= 0) {
    return 0;
  }
  const totalWait = Number(waitData) || 0;
  return Number((totalWait / customerCount).toFixed(2));
}

/**
 * Allocates an arriving customer to an appropriate service counter based on the selected allocation strategy.
 *
 * Strategies:
 * - 'baseline': Static round-robin assignment based on customer ID.
 * - 'shortest-queue': Allocates to the counter with the shortest queue length.
 * - 'dynamic': Balances load by allocating to the counter offering the earliest available service / lowest wait time.
 *
 * @param {Array<Object>} counters - Array of active counters.
 * @param {Object} customer - The customer to allocate.
 * @param {string} strategy - Allocation strategy name ('baseline' | 'shortest-queue' | 'dynamic').
 * @returns {Object} The allocated counter.
 */
export function allocateCounter(counters, customer, strategy) {
  if (!counters || counters.length === 0) {
    throw new Error('No counters available for allocation.');
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

  // Strategy 3: Dynamic Load Balancing (Minimum Waiting Time)
  return [...counters].sort((left, right) => {
    const leftWait = Math.max(0, left.nextAvailable - customer.arrivalTime);
    const rightWait = Math.max(0, right.nextAvailable - customer.arrivalTime);

    // If customer has priority, strictly select the counter with earliest availability
    if (customer.priority === 'priority') {
      if (leftWait !== rightWait) {
        return leftWait - rightWait;
      }
      return left.nextAvailable - right.nextAvailable;
    }

    // Dynamic scoring considering both estimated wait and queue depth
    const leftScore = leftWait + left.queueLength * 1.2;
    const rightScore = rightWait + right.queueLength * 1.2;

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }
    return left.nextAvailable - right.nextAvailable;
  })[0];
}

/**
 * Backward compatibility alias for allocateCounter.
 */
export function chooseCounter(counters, customer, strategy) {
  return allocateCounter(counters, customer, strategy);
}

/**
 * Simulates customer queueing and counter allocation under a specified strategy.
 * Computes individual waiting times, counter-level statistics, and overall average waiting times.
 *
 * @param {Array<Object>} customers - List of customer objects.
 * @param {number} counterCount - Total number of service counters.
 * @param {string} strategy - 'baseline' | 'shortest-queue' | 'dynamic'
 * @returns {Object} Simulation metrics including average waiting time and counter utilisation.
 */
export function simulateStrategy(customers, counterCount, strategy) {
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
    // 1. Update each counter's active queue by clearing customers who finished before current arrival
    for (const counter of counters) {
      counter.departureTimes = counter.departureTimes.filter(
        (deptTime) => deptTime > customer.arrivalTime
      );
      counter.queueLength = counter.departureTimes.length;
    }

    // 2. Allocate counter using allocateCounter
    const selectedCounter = allocateCounter(counters, customer, strategy);

    // 3. Calculate waiting time for this customer at the chosen counter
    const { serviceStartTime, waitingTime } = calculateCustomerWait(customer, selectedCounter);
    const finishTime = Number((serviceStartTime + customer.serviceTime).toFixed(2));

    // 4. Update selected counter state and tracking
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

    // 5. Update global metrics
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

  // Calculate overall average waiting time across all customers
  const averageWait = calculateAverageWaitingTime(totalWait, customers.length);

  const maxArrivalTime = customers.length > 0 ? Math.max(...customers.map((c) => c.arrivalTime)) : 0;
  const totalAvailableMinutes = counterCount * maxArrivalTime || 1;
  const averageUtilisation =
    counters.reduce((sum, counter) => sum + counter.totalBusyMinutes / totalAvailableMinutes, 0) / counters.length;

  const counterUtilisation = counters.map((counter) => ({
    id: counter.id,
    utilisation: Number(((counter.totalBusyMinutes / totalAvailableMinutes) * 100).toFixed(1)),
    totalBusyMinutes: Number(counter.totalBusyMinutes.toFixed(1)),
    customersServed: counter.customersServed,
    totalWaitTime: Number(counter.totalWaitTime.toFixed(1)),
    averageWait: Number(counter.averageWaitTime.toFixed(1)),
  }));

  const congestionBuckets = buildCongestionBuckets(customers, counterCount);
  const peakBucket = congestionBuckets.reduce((currentBest, bucket) => {
    if (!currentBest || bucket.customers > currentBest.customers) {
      return bucket;
    }
    return currentBest;
  }, null);

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

export function buildCongestionBuckets(customers, counterCount) {
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

export function compareStrategies(customers, counterCount) {
  const strategies = ['baseline', 'shortest-queue', 'dynamic'];
  const results = strategies.map((strategy) => simulateStrategy(customers, counterCount, strategy));
  const baseline = results.find((result) => result.strategy === 'baseline');

  return results.map((result) => ({
    ...result,
    improvement: baseline && baseline.averageWait > 0 ? ((baseline.averageWait - result.averageWait) / baseline.averageWait) * 100 : 0,
  }));
}

export function recommendAllocation(results) {
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
