import {
  buildCongestionBuckets,
  buildDemand,
  compareStrategies,
  formatMinutes,
  recommendAllocation,
} from './simulator.js';

// If standalone bundle already initialized the app, avoid duplicate listeners
if (window.__smartq_bundle) {
  // Bundle active
} else {

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
    counterCount: Number(document.getElementById('counterCount').value || 4),
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

runButton.addEventListener('click', runSimulation);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  runSimulation();
}
});

runSimulation();
