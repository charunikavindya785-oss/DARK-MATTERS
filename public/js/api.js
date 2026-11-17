/**
 * SmartQ - Backend REST API Client
 */

class SmartQApi {
  static async request(endpoint, options = {}) {
    try {
      const res = await fetch(endpoint, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  }

  static async fetchPresets() {
    return this.request('/api/presets');
  }

  static async runSimulation(strategy, config, counters = null, counterCount = 3) {
    return this.request('/api/simulate', {
      method: 'POST',
      body: JSON.stringify({ strategy, config, counters, counterCount }),
    });
  }

  static async runComparison(strategies, config, counters = null, counterCount = 5) {
    return this.request('/api/compare', {
      method: 'POST',
      body: JSON.stringify({ strategies, config, counters, counterCount }),
    });
  }

  static async fetchForecast(config, activeCounters = 3, windowSizeMinutes = 15) {
    return this.request('/api/forecast', {
      method: 'POST',
      body: JSON.stringify({ config, activeCounters, windowSizeMinutes }),
    });
  }

  static async calculateTheory(lambda, mu, c, cs2 = 1.0, targetWait = 5.0) {
    return this.request('/api/theory', {
      method: 'POST',
      body: JSON.stringify({ lambda, mu, c, cs2, targetWait }),
    });
  }

  static async runOptimization(config, constraints = {}) {
    return this.request('/api/optimize', {
      method: 'POST',
      body: JSON.stringify({ config, constraints }),
    });
  }

  static async fetchHistory(limit = 15) {
    return this.request(`/api/history?limit=${limit}`);
  }
}

window.SmartQApi = SmartQApi;
