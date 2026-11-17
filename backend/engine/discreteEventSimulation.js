/**
 * SmartQ - Discrete-Event Simulation (DES) Core Engine
 * Implements priority-heap event calendar, reproducible PRNG, customer generation,
 * multi-counter state machine, and continuous metric telemetry.
 */

// Mulberry32 32-bit PRNG for 100% deterministic, reproducible simulations
class SeededRandom {
  constructor(seed = 123456789) {
    this.seed = seed;
  }

  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Exponential distribution (mean = 1 / lambda)
  exponential(lambda) {
    return -Math.log(1 - this.next()) / lambda;
  }

  // Normal distribution using Box-Muller transform
  normal(mean, stdDev) {
    const u1 = Math.max(1e-7, this.next());
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return Math.max(0.5, mean + z0 * stdDev);
  }

  // Uniform distribution [min, max]
  uniform(min, max) {
    return min + this.next() * (max - min);
  }
}

// Priority Queue for Event Calendar (Min-Heap by event timestamp)
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(item) {
    this.heap.push(item);
    this._siftUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._siftDown(0);
    }
    return top;
  }

  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  get length() {
    return this.heap.length;
  }

  _siftUp(idx) {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.heap[idx].time < this.heap[parentIdx].time) {
        [this.heap[idx], this.heap[parentIdx]] = [this.heap[parentIdx], this.heap[idx]];
        idx = parentIdx;
      } else {
        break;
      }
    }
  }

  _siftDown(idx) {
    const len = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;

      if (left < len && this.heap[left].time < this.heap[smallest].time) {
        smallest = left;
      }
      if (right < len && this.heap[right].time < this.heap[smallest].time) {
        smallest = right;
      }
      if (smallest !== idx) {
        [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
        idx = smallest;
      } else {
        break;
      }
    }
  }
}

class DiscreteEventSimulation {
  /**
   * Generate realistic synthetic customer cohort
   * @param {Object} config - Configuration options
   * @returns {Array} List of customer objects
   */
  static generateCustomers(config = {}) {
    const {
      count = 100,
      arrivalPattern = 'POISSON', // 'POISSON', 'UNIFORM', 'SURGE_PEAKS', 'FLASH_CROWD'
      meanArrivalInterval = 3.0,  // minutes between arrivals on average
      serviceTypes = [
        { type: 'GENERAL_INQUIRY', weight: 45, meanDuration: 3.5, stdDev: 1.0 },
        { type: 'DOCUMENT_VERIFICATION', weight: 30, meanDuration: 6.0, stdDev: 2.0 },
        { type: 'PAYMENT_BILLING', weight: 15, meanDuration: 4.0, stdDev: 1.2 },
        { type: 'COMPLEX_CONSULTATION', weight: 10, meanDuration: 12.0, stdDev: 3.5 },
      ],
      priorityMix = {
        STANDARD: 75,
        PRIORITY: 15, // Senior, VIP, Pregnant
        EMERGENCY: 10, // Hospital emergency, urgent deadline
      },
      seed = 42,
      shockTime = null, // e.g., minute 60 where 30 customers arrive at once
    } = config;

    const rng = new SeededRandom(seed);
    const customers = [];
    let currentClock = 0;

    // Helper to pick weighted item
    const pickWeighted = (items, weightKey = 'weight') => {
      const totalWeight = items.reduce((acc, item) => acc + item[weightKey], 0);
      let rand = rng.next() * totalWeight;
      for (const item of items) {
        rand -= item[weightKey];
        if (rand <= 0) return item;
      }
      return items[0];
    };

    // Priority selector helper
    const pickPriority = () => {
      const rand = rng.next() * 100;
      if (rand < priorityMix.EMERGENCY) return { category: 'EMERGENCY', weight: 3 };
      if (rand < priorityMix.EMERGENCY + priorityMix.PRIORITY) return { category: 'PRIORITY', weight: 2 };
      return { category: 'STANDARD', weight: 1 };
    };

    for (let i = 0; i < count; i++) {
      // Determine inter-arrival time based on arrival pattern
      let interval = 0;
      const minuteOfDay = currentClock % 480; // 8-hour workday (0 to 480 min)

      if (arrivalPattern === 'POISSON') {
        interval = rng.exponential(1 / meanArrivalInterval);
      } else if (arrivalPattern === 'UNIFORM') {
        interval = rng.uniform(meanArrivalInterval * 0.5, meanArrivalInterval * 1.5);
      } else if (arrivalPattern === 'SURGE_PEAKS') {
        // Peaks at 60-120 min (morning surge) and 240-300 min (afternoon surge)
        const isMorningPeak = minuteOfDay >= 60 && minuteOfDay <= 120;
        const isAfternoonPeak = minuteOfDay >= 240 && minuteOfDay <= 300;
        const effectiveMean = (isMorningPeak || isAfternoonPeak) ? meanArrivalInterval * 0.35 : meanArrivalInterval * 1.4;
        interval = rng.exponential(1 / effectiveMean);
      } else if (arrivalPattern === 'FLASH_CROWD') {
        // Unexpected huge surge in middle of day
        const isShock = minuteOfDay >= 90 && minuteOfDay <= 140;
        const effectiveMean = isShock ? meanArrivalInterval * 0.2 : meanArrivalInterval * 1.2;
        interval = rng.exponential(1 / effectiveMean);
      } else {
        interval = rng.exponential(1 / meanArrivalInterval);
      }

      currentClock += Math.max(0.1, interval);

      // Pick service type
      const st = pickWeighted(serviceTypes, 'weight');
      const duration = Math.max(1.0, rng.normal(st.meanDuration, st.stdDev));
      const priorityInfo = pickPriority();

      customers.push({
        id: `C-${(i + 1).toString().padStart(3, '0')}`,
        sequence: i + 1,
        arrivalTime: Number(currentClock.toFixed(2)),
        category: priorityInfo.category,
        priorityWeight: priorityInfo.weight,
        serviceType: st.type,
        serviceName: st.type.replace(/_/g, ' '),
        nominalDuration: Number(duration.toFixed(2)),
        actualServiceDuration: Number(duration.toFixed(2)),
        serviceStartTime: null,
        serviceEndTime: null,
        waitingTime: 0,
        assignedCounterId: null,
        servedByCounterName: null,
        status: 'PENDING', // PENDING, WAITING, IN_SERVICE, COMPLETED
      });
    }

    return customers;
  }

  /**
   * Create standard service counters configuration
   * @param {number} count - Number of counters (minimum 3)
   * @param {Array} customCounters - Optional custom counters array
   * @returns {Array} Counter objects
   */
  static createDefaultCounters(count = 3, customCounters = null) {
    if (customCounters && customCounters.length >= 3) {
      return customCounters.map((c, idx) => ({
        id: c.id || `counter-${idx + 1}`,
        name: c.name || `Counter ${idx + 1}`,
        efficiency: c.efficiency || 1.0,
        skills: c.skills || ['ALL'],
        isSurgeCounter: !!c.isSurgeCounter,
        status: c.isSurgeCounter ? 'OFFLINE' : (c.status || 'IDLE'),
        currentCustomer: null,
        totalBusyMinutes: 0,
        customersServed: 0,
        statusHistory: [],
      }));
    }

    const counterNames = ['Counter 1 (General)', 'Counter 2 (Inquiries & Docs)', 'Counter 3 (Express & Cashier)', 'Counter 4 (Surge Standby)', 'Counter 5 (Surge Standby)'];
    const counters = [];
    for (let i = 0; i < count; i++) {
      const isSurge = i >= 3;
      counters.push({
        id: `counter-${i + 1}`,
        name: counterNames[i] || `Counter ${i + 1}`,
        efficiency: 1.0 + (i === 0 ? 0.05 : i === 1 ? -0.05 : 0.1), // small realistic variance
        skills: ['ALL'],
        isSurgeCounter: isSurge,
        status: isSurge ? 'OFFLINE' : 'IDLE',
        currentCustomer: null,
        totalBusyMinutes: 0,
        customersServed: 0,
        statusHistory: [],
      });
    }
    return counters;
  }
}

module.exports = {
  DiscreteEventSimulation,
  SeededRandom,
  MinHeap,
};
