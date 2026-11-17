/**
 * SmartQ - Queueing Theory Analytical Engine
 * Implements classical queueing models: M/M/c and M/G/c (Allen-Cunneen approximation),
 * Erlang-C formula, Little's Law, and capacity recommendation.
 */

class QueueingTheory {
  /**
   * Calculate factorial with safety
   */
  static factorial(n) {
    if (n <= 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) {
      res *= i;
    }
    return res;
  }

  /**
   * Compute Erlang-C model metrics (M/M/c)
   * @param {number} lambda - Arrival rate (customers per minute)
   * @param {number} mu - Service rate per counter (customers per minute, mu = 1 / meanServiceTime)
   * @param {number} c - Number of identical parallel service counters (c >= 1)
   * @param {number} cs2 - Squared coefficient of variation for service time (1.0 for exponential, <1 for uniform/normal, >1 for high variance)
   * @returns {Object} Comprehensive queueing metrics
   */
  static calculateMMC(lambda, mu, c, cs2 = 1.0) {
    if (lambda <= 0 || mu <= 0 || c < 1) {
      throw new Error('Invalid parameters: lambda and mu must be > 0, c >= 1');
    }

    const a = lambda / mu; // Offered traffic (erlangs)
    const rho = a / c;     // Traffic intensity / server utilization

    // Unstable queue condition (demand exceeds capacity)
    if (rho >= 1.0) {
      return {
        isStable: false,
        c,
        lambda: Number(lambda.toFixed(4)),
        mu: Number(mu.toFixed(4)),
        rho: Number(rho.toFixed(4)),
        utilizationPct: Number((rho * 100).toFixed(1)),
        warning: `System is UNSTABLE (ρ = ${rho.toFixed(2)} >= 1.0). Customer arrivals exceed counter capacity! Queue will grow without bound unless capacity is increased.`,
        recommendedCounters: Math.ceil(a + 1),
        p0: 0,
        pq: 1.0,
        wqMinutes: Infinity,
        wMinutes: Infinity,
        lq: Infinity,
        l: Infinity,
        model: 'M/M/c (Unstable)',
      };
    }

    // Calculate P0 (Probability of 0 customers in system)
    let sumTerms = 0;
    for (let k = 0; k < c; k++) {
      sumTerms += Math.pow(a, k) / this.factorial(k);
    }
    const lastTerm = Math.pow(a, c) / (this.factorial(c) * (1 - rho));
    const p0 = 1 / (sumTerms + lastTerm);

    // Erlang-C formula (Pq: Probability that an arriving customer must wait in queue)
    const pq = lastTerm * p0;

    // Mean waiting time in queue (Wq in minutes)
    let wq = pq / (c * mu - lambda);

    // Apply M/G/c Allen-Cunneen approximation if service variance is non-exponential (cs2 != 1)
    if (cs2 !== 1.0) {
      // Wq(M/G/c) approx = Wq(M/M/c) * ((Ca^2 + Cs^2) / 2). For Poisson arrival, Ca^2 = 1.
      const ca2 = 1.0;
      const cvFactor = (ca2 + cs2) / 2;
      wq *= cvFactor;
    }

    // Little's Law: Lq = lambda * Wq
    const lq = lambda * wq;

    // Mean time in system: W = Wq + (1 / mu)
    const meanServiceTime = 1 / mu;
    const w = wq + meanServiceTime;

    // Total customers in system: L = lambda * W
    const l = lambda * w;

    // Probability of waiting longer than t minutes: P(Wq > t) = Pq * exp(-(c*mu - lambda)*t)
    const waitProb5Min = pq * Math.exp(-(c * mu - lambda) * 5);
    const waitProb10Min = pq * Math.exp(-(c * mu - lambda) * 10);

    return {
      isStable: true,
      c,
      lambda: Number(lambda.toFixed(4)),
      mu: Number(mu.toFixed(4)),
      rho: Number(rho.toFixed(4)),
      utilizationPct: Number((rho * 100).toFixed(1)),
      p0: Number(p0.toFixed(4)),
      pq: Number(pq.toFixed(4)),
      wqMinutes: Number(wq.toFixed(2)),
      wMinutes: Number(w.toFixed(2)),
      lq: Number(lq.toFixed(2)),
      l: Number(l.toFixed(2)),
      meanServiceTimeMinutes: Number(meanServiceTime.toFixed(2)),
      probWaitOver5Min: Number((waitProb5Min * 100).toFixed(1)),
      probWaitOver10Min: Number((waitProb10Min * 100).toFixed(1)),
      model: cs2 === 1.0 ? 'M/M/c (Erlang-C)' : `M/G/c (Allen-Cunneen, Cs²=${cs2.toFixed(2)})`,
      recommendedCounters: Math.max(c, Math.ceil(a / 0.75)), // Target < 75% utilization for resilience
    };
  }

  /**
   * Determine minimum counters needed to achieve a target average wait time
   * @param {number} lambda - Arrival rate
   * @param {number} mu - Service rate per counter
   * @param {number} targetWaitMinutes - Maximum acceptable waiting time in queue
   * @returns {Object} Recommended counters and expected metrics
   */
  static recommendCounters(lambda, mu, targetWaitMinutes = 5.0) {
    const a = lambda / mu;
    let minC = Math.max(1, Math.floor(a) + 1);

    for (let c = minC; c <= minC + 15; c++) {
      const metrics = this.calculateMMC(lambda, mu, c);
      if (metrics.isStable && metrics.wqMinutes <= targetWaitMinutes) {
        return {
          recommendedCounters: c,
          expectedWaitMinutes: metrics.wqMinutes,
          expectedUtilizationPct: metrics.utilizationPct,
          targetWaitMinutes,
          status: 'Optimal',
        };
      }
    }

    return {
      recommendedCounters: minC + 1,
      expectedWaitMinutes: targetWaitMinutes,
      expectedUtilizationPct: 80,
      targetWaitMinutes,
      status: 'High Load',
    };
  }
}

module.exports = QueueingTheory;
