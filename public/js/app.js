/**
 * SmartQ - Main Frontend Application Controller
 * Handles tabs, scenario loading, live simulation, comparative benchmarks, and charting.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const visualizer = new SmartQVisualizer();
  let currentPresetConfig = null;
  let presetsList = [];
  let currentComparisonData = null;

  // Initialize Elements
  const tabs = document.querySelectorAll('.nav-tab');
  const tabViews = document.querySelectorAll('.tab-view');
  const scenarioPills = document.querySelectorAll('.pill-btn');
  const speedSlider = document.getElementById('speedSlider');
  const speedLabel = document.getElementById('speedLabel');

  // Tab Navigation
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabViews.forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      const targetId = tab.dataset.tab;
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.add('active');

      // Refresh charts when tab becomes visible
      if (targetId === 'tab-comparison' && currentComparisonData) {
        renderComparisonCharts(currentComparisonData);
      }
      if (targetId === 'tab-forecast') {
        runForecastAnalysis();
      }
    });
  });

  // Speed Slider
  if (speedSlider) {
    speedSlider.addEventListener('input', (e) => {
      visualizer.speed = Number(e.target.value);
      if (speedLabel) speedLabel.textContent = `${e.target.value}x`;
    });
  }

  // Load Presets from API
  try {
    const res = await SmartQApi.fetchPresets();
    presetsList = res.presets || [];
    if (presetsList.length > 0) {
      loadScenario(presetsList[0].id);
    }
  } catch (err) {
    console.warn('Could not load presets from server:', err);
  }

  // Scenario Switcher Buttons
  scenarioPills.forEach(pill => {
    pill.addEventListener('click', () => {
      scenarioPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const presetId = pill.dataset.preset;
      loadScenario(presetId);
    });
  });

  async function loadScenario(presetId) {
    const preset = presetsList.find(p => p.id === presetId) || presetsList[0];
    if (!preset) return;

    currentPresetConfig = preset.config;
    const descEl = document.getElementById('scenarioDescription');
    if (descEl) {
      descEl.textContent = `${preset.title}: ${preset.description}`;
    }

    // Populate form fields
    const custCountInput = document.getElementById('cfgCustomerCount');
    const arrivalPatternInput = document.getElementById('cfgArrivalPattern');
    const arrivalIntervalInput = document.getElementById('cfgArrivalInterval');
    if (custCountInput) custCountInput.value = preset.customerCount;
    if (arrivalPatternInput) arrivalPatternInput.value = preset.arrivalPattern;
    if (arrivalIntervalInput) arrivalIntervalInput.value = preset.meanInterval;

    // Run comparison and update dashboard
    await runFullComparison();
  }

  // Visualizer Playback Buttons
  const btnPlay = document.getElementById('btnPlay');
  const btnPause = document.getElementById('btnPause');
  const btnStep = document.getElementById('btnStep');
  const btnReset = document.getElementById('btnReset');

  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      visualizer.start();
      btnPlay.classList.add('active');
      if (btnPause) btnPause.classList.remove('active');
    });
  }

  if (btnPause) {
    btnPause.addEventListener('click', () => {
      visualizer.stop();
      if (btnPlay) btnPlay.classList.remove('active');
      btnPause.classList.add('active');
    });
  }

  if (btnStep) {
    btnStep.addEventListener('click', () => {
      visualizer.stop();
      visualizer.step(1.0);
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      visualizer.stop();
      if (btnPlay) btnPlay.classList.remove('active');
      if (btnPause) btnPause.classList.remove('active');
      runFullComparison();
    });
  }

  // Run Full Comparison Across Strategies
  async function runFullComparison() {
    const count = Number(document.getElementById('cfgCustomerCount')?.value || 120);
    const arrivalPattern = document.getElementById('cfgArrivalPattern')?.value || 'SURGE_PEAKS';
    const meanInterval = Number(document.getElementById('cfgArrivalInterval')?.value || 2.5);
    const activeStrategy = document.getElementById('simStrategySelect')?.value || 'PREDICTIVE_SURGE';

    const config = {
      ...(currentPresetConfig || {}),
      count: Math.max(100, count),
      arrivalPattern,
      meanArrivalInterval: meanInterval,
      seed: 42,
    };

    try {
      const res = await SmartQApi.runComparison(
        ['BASELINE', 'DYNAMIC_LOAD_BALANCED', 'PREDICTIVE_SURGE', 'PRIORITY_AWARE'],
        config,
        null,
        5 // 3 base + 2 surge
      );

      currentComparisonData = res;
      const comp = res.comparison;

      // Update KPI Cards from selected strategy or PREDICTIVE_SURGE
      const selectedResult = comp.results[activeStrategy] || comp.results['PREDICTIVE_SURGE'];
      updateKPICards(selectedResult.summary, comp.comparativeMetrics[activeStrategy]);

      // Render Comparative Benchmark Table
      renderComparisonTable(comp);

      // Render Charts
      renderComparisonCharts(res);

      // Initialize visualizer with the generated cohort
      const singleSimRes = await SmartQApi.runSimulation(activeStrategy, config, null, 5);
      if (singleSimRes.customerCohort) {
        visualizer.init(
          singleSimRes.result.counterMetrics.map(c => ({
            id: c.id,
            name: c.name,
            efficiency: c.efficiency,
            isSurgeCounter: c.isSurgeCounter,
          })),
          singleSimRes.customerCohort,
          activeStrategy
        );
      }
    } catch (err) {
      console.error('Error running comparison:', err);
    }
  }

  function updateKPICards(summary, deltas = {}) {
    const kpiAvgWait = document.getElementById('kpiAvgWait');
    const kpiMaxWait = document.getElementById('kpiMaxWait');
    const kpiPeakQueue = document.getElementById('kpiPeakQueue');
    const kpiSlaPct = document.getElementById('kpiSlaPct');
    const kpiCsat = document.getElementById('kpiCsat');

    if (kpiAvgWait) {
      kpiAvgWait.textContent = `${summary.avgWaitMinutes} min`;
      const sub = document.getElementById('kpiAvgWaitSub');
      if (sub && deltas && deltas.avgWaitReductionPct) {
        sub.innerHTML = `<span style="color: #34d399; font-weight: 700;">↓ ${deltas.avgWaitReductionPct}% vs Baseline</span>`;
      }
    }

    if (kpiMaxWait) {
      kpiMaxWait.textContent = `${summary.maxWaitMinutes} min`;
      const sub = document.getElementById('kpiMaxWaitSub');
      if (sub && deltas && deltas.maxWaitReductionPct) {
        sub.innerHTML = `<span style="color: #34d399; font-weight: 700;">↓ ${deltas.maxWaitReductionPct}% vs Baseline</span>`;
      }
    }

    if (kpiPeakQueue) {
      kpiPeakQueue.textContent = `${summary.peakQueueLength} customers`;
      const sub = document.getElementById('kpiPeakQueueSub');
      if (sub && deltas && deltas.peakQueueReductionPct) {
        sub.innerHTML = `<span style="color: #34d399; font-weight: 700;">↓ ${deltas.peakQueueReductionPct}% peak backlog</span>`;
      }
    }

    if (kpiSlaPct) {
      kpiSlaPct.textContent = `${summary.slaCompliancePct}%`;
      const sub = document.getElementById('kpiSlaSub');
      if (sub) {
        sub.textContent = `Target: < 10m wait (${summary.totalCustomers} served)`;
      }
    }

    if (kpiCsat) {
      kpiCsat.textContent = `⭐ ${summary.csatScore} / 5.0`;
    }
  }

  function renderComparisonTable(comp) {
    const tableBody = document.getElementById('comparisonTableBody');
    if (!tableBody) return;

    const strats = [
      { key: 'BASELINE', name: 'Baseline (Static FIFO / No Rebalance)', badge: 'Baseline' },
      { key: 'DYNAMIC_LOAD_BALANCED', name: 'Dynamic Load Balancing & Skill Routing', badge: 'Strategy 1' },
      { key: 'PREDICTIVE_SURGE', name: 'SmartQ AI Predictive Surge Allocation', badge: 'SmartQ Recommended' },
      { key: 'PRIORITY_AWARE', name: 'Priority-Weighted Starvation-Free', badge: 'Strategy 3' },
    ];

    tableBody.innerHTML = strats.map(s => {
      const res = comp.results[s.key];
      const delta = comp.comparativeMetrics[s.key];
      if (!res) return '';

      let waitBadge = '';
      if (s.key === 'BASELINE') {
        waitBadge = `<span class="improvement-badge imp-neutral">Reference</span>`;
      } else {
        const sign = delta.avgWaitReductionPct >= 0 ? '↓ ' : '↑ ';
        const cssClass = delta.avgWaitReductionPct >= 0 ? 'imp-positive' : 'imp-neutral';
        waitBadge = `<span class="improvement-badge ${cssClass}">${sign}${Math.abs(delta.avgWaitReductionPct)}%</span>`;
      }

      let qBadge = '';
      if (s.key !== 'BASELINE') {
        const sign = delta.peakQueueReductionPct >= 0 ? '↓ ' : '↑ ';
        const cssClass = delta.peakQueueReductionPct >= 0 ? 'imp-positive' : 'imp-neutral';
        qBadge = `<span class="improvement-badge ${cssClass}">${sign}${Math.abs(delta.peakQueueReductionPct)}%</span>`;
      }

      return `
        <tr>
          <td>
            <strong>${s.name}</strong><br>
            <span style="font-size: 0.7rem; color: #9ca3af;">${s.badge}</span>
          </td>
          <td><strong>${res.summary.avgWaitMinutes} min</strong> ${waitBadge}</td>
          <td>${res.summary.maxWaitMinutes} min</td>
          <td><strong>${res.summary.peakQueueLength}</strong> ${qBadge}</td>
          <td>${res.summary.overallUtilizationPct}%</td>
          <td>
            <span style="color: ${res.summary.slaCompliancePct >= 90 ? '#34d399' : '#fbbf24'}; font-weight: 700;">
              ${res.summary.slaCompliancePct}%
            </span>
          </td>
          <td>⭐ ${res.summary.csatScore}</td>
          <td>${res.summary.counterHoursConsumed} hrs</td>
        </tr>
      `;
    }).join('');
  }

  function renderComparisonCharts(res) {
    const comp = res.comparison;
    if (!comp) return;

    // 1. Bar Chart: Average Wait & Max Wait Comparison
    const labels = ['Baseline', 'Load Balanced', 'SmartQ Surge', 'Priority Aware'];
    const avgWaits = [
      comp.results['BASELINE']?.summary.avgWaitMinutes || 0,
      comp.results['DYNAMIC_LOAD_BALANCED']?.summary.avgWaitMinutes || 0,
      comp.results['PREDICTIVE_SURGE']?.summary.avgWaitMinutes || 0,
      comp.results['PRIORITY_AWARE']?.summary.avgWaitMinutes || 0,
    ];
    const maxWaits = [
      comp.results['BASELINE']?.summary.maxWaitMinutes || 0,
      comp.results['DYNAMIC_LOAD_BALANCED']?.summary.maxWaitMinutes || 0,
      comp.results['PREDICTIVE_SURGE']?.summary.maxWaitMinutes || 0,
      comp.results['PRIORITY_AWARE']?.summary.maxWaitMinutes || 0,
    ];

    SmartQCharts.drawBarChart(
      'chartWaitComparison',
      labels,
      [
        { name: 'Average Wait (min)', data: avgWaits, color: '#3b82f6' },
        { name: 'Max Wait (min)', data: maxWaits, color: '#f43f5e' },
      ],
      { yLabel: 'Minutes' }
    );

    // 2. Queue Length Over Time Series Chart (Baseline vs SmartQ Surge)
    const baseTelemetry = comp.results['BASELINE']?.telemetry;
    const surgeTelemetry = comp.results['PREDICTIVE_SURGE']?.telemetry;

    if (baseTelemetry && surgeTelemetry) {
      const basePoints = baseTelemetry.timestamps.map((t, idx) => ({ x: t, y: baseTelemetry.queueLengths[idx] || 0 }));
      const surgePoints = surgeTelemetry.timestamps.map((t, idx) => ({ x: t, y: surgeTelemetry.queueLengths[idx] || 0 }));

      SmartQCharts.drawTimeSeries(
        'chartQueueTimeline',
        [
          { name: 'Baseline Queue Length', data: basePoints, color: '#f43f5e', fill: false },
          { name: 'SmartQ Adaptive Surge Queue', data: surgePoints, color: '#10b981', fill: true, fillColorStart: 'rgba(16, 185, 129, 0.25)' },
        ],
        { xLabel: 'Simulation Time (min)', yLabel: 'Customers in Queue' }
      );
    }

    // 3. Gauges
    const surgeSummary = comp.results['PREDICTIVE_SURGE']?.summary;
    if (surgeSummary) {
      SmartQCharts.drawGauge('gaugeUtilization', surgeSummary.overallUtilizationPct, 'Counter Utilization', '#3b82f6');
      SmartQCharts.drawGauge('gaugeSla', surgeSummary.slaCompliancePct, 'SLA Compliance (<10m)', '#10b981');
    }
  }

  // Forecast Tab Execution
  async function runForecastAnalysis() {
    const count = Number(document.getElementById('cfgCustomerCount')?.value || 120);
    try {
      const forecastRes = await SmartQApi.fetchForecast(
        { ...(currentPresetConfig || {}), count, arrivalPattern: 'SURGE_PEAKS' },
        3,
        15
      );
      const forecast = forecastRes.forecast;

      const riskBadge = document.getElementById('forecastRiskBadge');
      if (riskBadge) {
        riskBadge.textContent = `Overall Congestion Risk: ${forecast.overallRiskScore}% (${forecast.overallRiskLevel})`;
        riskBadge.className = `alert-box ${forecast.overallRiskScore > 70 ? 'alert-danger' : forecast.overallRiskScore > 40 ? 'alert-warning' : 'alert-success'}`;
      }

      // Render Heatmap Timeline
      SmartQCharts.drawHeatmapTimeline('chartHeatmap', forecast.timelineBuckets);

      // Render Peak Windows List
      const peakList = document.getElementById('peakWindowsList');
      if (peakList) {
        if (forecast.peakCongestionWindows.length === 0) {
          peakList.innerHTML = `<div style="color: #34d399; padding: 12px;">✓ No severe congestion periods predicted! Counter capacity is well-sized for current demand.</div>`;
        } else {
          peakList.innerHTML = forecast.peakCongestionWindows.map(pw => `
            <div style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; font-weight: 700; color: #fb7185;">
                <span>⚠️ Peak Window: ${pw.startTimeLabel} - ${pw.endTimeLabel}</span>
                <span>Risk: ${pw.peakRiskScore}%</span>
              </div>
              <div style="font-size: 0.8rem; color: #d1d5db; margin-top: 4px;">
                Expected Peak Queue: <strong>${pw.maxQueue} customers</strong> | Max Wait: <strong>${pw.maxWaitMinutes} mins</strong>
              </div>
              <div style="font-size: 0.75rem; color: #34d399; margin-top: 4px;">
                💡 Recommended Action: Activate <strong>+${pw.recommendedExtraCounters} Surge Counter(s)</strong> during this window.
              </div>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Forecast error:', err);
    }
  }

  // Interactive Queueing Theory Calculator
  const calcInputs = ['theoryLambda', 'theoryMu', 'theoryC', 'theoryCs2', 'theoryTarget'];
  calcInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateTheoryCalculations);
  });

  async function updateTheoryCalculations() {
    const lambda = Number(document.getElementById('theoryLambda')?.value || 0.5);
    const mu = Number(document.getElementById('theoryMu')?.value || 0.25);
    const c = Number(document.getElementById('theoryC')?.value || 3);
    const cs2 = Number(document.getElementById('theoryCs2')?.value || 1.0);
    const targetWait = Number(document.getElementById('theoryTarget')?.value || 5.0);

    try {
      const res = await SmartQApi.calculateTheory(lambda, mu, c, cs2, targetWait);
      const mmc = res.mmc;
      const rec = res.recommendation;

      const outRho = document.getElementById('outRho');
      const outWq = document.getElementById('outWq');
      const outLq = document.getElementById('outLq');
      const outPq = document.getElementById('outPq');
      const outRecCounters = document.getElementById('outRecCounters');
      const theoryAlert = document.getElementById('theoryStabilityAlert');

      if (outRho) outRho.textContent = `${mmc.utilizationPct}% (ρ = ${mmc.rho})`;
      if (outWq) outWq.textContent = mmc.isStable ? `${mmc.wqMinutes} min` : '∞ (Unstable)';
      if (outLq) outLq.textContent = mmc.isStable ? `${mmc.lq} customers` : '∞';
      if (outPq) outPq.textContent = mmc.isStable ? `${(mmc.pq * 100).toFixed(1)}%` : '100%';
      if (outRecCounters) outRecCounters.textContent = `${rec.recommendedCounters} Counters`;

      if (theoryAlert) {
        if (!mmc.isStable) {
          theoryAlert.className = 'alert-box alert-danger';
          theoryAlert.textContent = mmc.warning;
          theoryAlert.style.display = 'flex';
        } else {
          theoryAlert.className = 'alert-box alert-success';
          theoryAlert.textContent = `✓ System is mathematically stable (ρ = ${mmc.rho} < 1.0). Probability of waiting > 5 mins is ${mmc.probWaitOver5Min}%.`;
          theoryAlert.style.display = 'flex';
        }
      }
    } catch (err) {
      console.error('Theory error:', err);
    }
  }
  updateTheoryCalculations();

  // Constrained Staff Optimizer Tab
  const btnRunOptimizer = document.getElementById('btnRunOptimizer');
  if (btnRunOptimizer) {
    btnRunOptimizer.addEventListener('click', runOptimizerAnalysis);
  }

  async function runOptimizerAnalysis() {
    const wage = Number(document.getElementById('optHourlyWage')?.value || 25);
    const maxCounters = Number(document.getElementById('optMaxCounters')?.value || 6);
    const slaTarget = Number(document.getElementById('optSlaTarget')?.value || 10);
    const slaGoal = Number(document.getElementById('optSlaGoal')?.value || 90);

    try {
      const res = await SmartQApi.runOptimization(
        { ...(currentPresetConfig || {}), count: 120, arrivalPattern: 'SURGE_PEAKS' },
        {
          hourlyCostPerCounter: wage,
          maxCountersAllowed: maxCounters,
          targetSlaWaitMinutes: slaTarget,
          slaComplianceGoal: slaGoal,
        }
      );

      const opt = res.optimization;
      const rec = opt.recommendedPolicy;
      const sav = opt.savingsSummary;

      const recBox = document.getElementById('optRecommendationBox');
      if (recBox) {
        recBox.innerHTML = `
          <div style="font-weight: 700; font-size: 1.05rem; color: #34d399; margin-bottom: 6px;">
            Recommended Policy: ${rec.name}
          </div>
          <div style="font-size: 0.85rem; color: #d1d5db; line-height: 1.5;">
            Achieves <strong>${rec.slaCompliancePct}% SLA compliance</strong> with an average wait time of <strong>${rec.avgWaitMinutes} mins</strong>.<br>
            Total labor cost: <strong>$${rec.laborCost}</strong> (${rec.laborHours} counter-hours).<br>
            <span style="color: #60a5fa; font-weight: 600;">
              💰 Estimated Savings vs Full Static Staffing: $${sav.dollarsSaved} (${sav.costReductionPct}% cost reduction, saving ${sav.laborHoursSaved} staff-hours)!
            </span>
          </div>
        `;
      }

      // Render Pareto frontier table
      const tbody = document.getElementById('optParetoBody');
      if (tbody) {
        tbody.innerHTML = opt.paretoFrontier.map(r => `
          <tr style="${r.name === rec.name ? 'background: rgba(16, 185, 129, 0.1); font-weight: 700;' : ''}">
            <td>${r.name}</td>
            <td>${r.laborHours} hrs</td>
            <td>$${r.laborCost}</td>
            <td>${r.avgWaitMinutes}m</td>
            <td>${r.maxWaitMinutes}m</td>
            <td>
              <span style="color: ${r.isSlaMet ? '#34d399' : '#f43f5e'};">
                ${r.slaCompliancePct}% (${r.isSlaMet ? 'PASS' : 'FAIL'})
              </span>
            </td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Optimizer error:', err);
    }
  }

  // Export Data Buttons
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnExportJson = document.getElementById('btnExportJson');

  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      if (!currentComparisonData) return;
      const comp = currentComparisonData.comparison;
      let csv = 'Strategy,Average Wait (min),Max Wait (min),Peak Queue,Utilization (%),SLA Compliance (%),CSAT Stars\n';
      for (const [key, res] of Object.entries(comp.results)) {
        const s = res.summary;
        csv += `"${res.strategyName}",${s.avgWaitMinutes},${s.maxWaitMinutes},${s.peakQueueLength},${s.overallUtilizationPct},${s.slaCompliancePct},${s.csatScore}\n`;
      }
      downloadFile(csv, 'smartq_benchmark_results.csv', 'text/csv');
    });
  }

  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      if (!currentComparisonData) return;
      downloadFile(JSON.stringify(currentComparisonData, null, 2), 'smartq_full_data.json', 'application/json');
    });
  }

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Re-run on parameter change
  const btnApplyConfig = document.getElementById('btnApplyConfig');
  if (btnApplyConfig) {
    btnApplyConfig.addEventListener('click', () => {
      runFullComparison();
    });
  }
});
