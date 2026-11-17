/**
 * SmartQ - Live Visual Simulation & Counter Stage Engine
 * Manages frame-by-frame customer flow animation, counter pods, and queue line
 */

class SmartQVisualizer {
  constructor() {
    this.counters = [];
    this.customers = [];
    this.queue = [];
    this.completed = [];
    this.currentClock = 0;
    this.speed = 10; // multiplier
    this.isRunning = false;
    this.timerId = null;
    this.onTick = null;
  }

  init(counters, customers, strategy = 'PREDICTIVE_SURGE') {
    this.stop();
    this.strategy = strategy;
    this.counters = JSON.parse(JSON.stringify(counters)).map(c => ({
      ...c,
      status: c.isSurgeCounter ? 'OFFLINE' : 'IDLE',
      currentCustomer: null,
      serviceFinishTime: null,
      customersServed: 0,
      totalBusyMinutes: 0,
    }));
    this.customers = JSON.parse(JSON.stringify(customers)).sort((a, b) => a.arrivalTime - b.arrivalTime);
    this.customerIdx = 0;
    this.queue = [];
    this.completed = [];
    this.currentClock = 0;
    this.renderCounters();
    this.renderQueue();
    this.updateStats();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const intervalMs = 100;

    this.timerId = setInterval(() => {
      // Advance clock by (speed * dt)
      const dtMinutes = (intervalMs / 1000) * (this.speed / 10);
      this.step(dtMinutes);
    }, intervalMs);
  }

  stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  step(dtMinutes = 0.5) {
    this.currentClock += dtMinutes;

    // 1. Check for new arrivals up to currentClock
    while (this.customerIdx < this.customers.length && this.customers[this.customerIdx].arrivalTime <= this.currentClock) {
      const arrivingCust = this.customers[this.customerIdx];
      arrivingCust.status = 'WAITING';
      this.queue.push(arrivingCust);
      this.customerIdx++;
    }

    // 2. Check for service completions at counters
    this.counters.forEach(cnt => {
      if (cnt.status === 'BUSY' && cnt.serviceFinishTime !== null && cnt.serviceFinishTime <= this.currentClock) {
        // Complete customer
        const cust = cnt.currentCustomer;
        if (cust) {
          cust.status = 'COMPLETED';
          cust.serviceEndTime = cnt.serviceFinishTime;
          cust.waitingTime = Math.max(0, cust.serviceStartTime - cust.arrivalTime);
          this.completed.push(cust);
          cnt.customersServed++;
          cnt.totalBusyMinutes += cust.actualServiceDuration;
        }
        cnt.currentCustomer = null;
        cnt.serviceFinishTime = null;
        cnt.status = 'IDLE';

        // Check if surge counter should power down
        if (cnt.isSurgeCounter && this.queue.length <= 2) {
          cnt.status = 'OFFLINE';
        }
      }
    });

    // 3. Surge trigger check (for Predictive Surge)
    if (this.strategy === 'PREDICTIVE_SURGE') {
      if (this.queue.length >= 8) {
        const offlineSurge = this.counters.find(c => c.isSurgeCounter && c.status === 'OFFLINE');
        if (offlineSurge) {
          offlineSurge.status = 'IDLE';
        }
      }
    }

    // 4. Assign waiting customers to available idle counters
    const availableCounters = this.counters.filter(c => c.status === 'IDLE');
    for (const cnt of availableCounters) {
      if (this.queue.length === 0) break;

      // Customer selection based on strategy
      let nextCust = null;
      if (this.strategy === 'PRIORITY_AWARE') {
        let bestIdx = 0;
        let bestScore = -Infinity;
        for (let i = 0; i < this.queue.length; i++) {
          const c = this.queue[i];
          const wait = this.currentClock - c.arrivalTime;
          const score = c.priorityWeight * 10 + wait * 1.5;
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
        nextCust = this.queue.splice(bestIdx, 1)[0];
      } else {
        nextCust = this.queue.shift();
      }

      if (nextCust) {
        cnt.status = 'BUSY';
        cnt.currentCustomer = nextCust;
        nextCust.status = 'IN_SERVICE';
        nextCust.serviceStartTime = this.currentClock;
        nextCust.assignedCounterId = cnt.id;
        const dur = Math.max(0.5, nextCust.nominalDuration / cnt.efficiency);
        nextCust.actualServiceDuration = dur;
        cnt.serviceFinishTime = this.currentClock + dur;
      }
    }

    // Render updates
    this.renderCounters();
    this.renderQueue();
    this.updateStats();

    if (this.onTick) {
      this.onTick(this.currentClock, this.queue.length, this.completed.length);
    }

    // Check if simulation ended
    if (this.customerIdx >= this.customers.length && this.queue.length === 0 && !this.counters.some(c => c.status === 'BUSY')) {
      this.stop();
    }
  }

  renderCounters() {
    const stage = document.getElementById('countersStage');
    if (!stage) return;

    stage.innerHTML = this.counters.map(c => {
      let statusTag = 'tag-idle';
      let statusText = 'IDLE';
      let podClass = '';

      if (c.status === 'BUSY') {
        statusTag = 'tag-busy';
        statusText = 'BUSY';
        podClass = 'status-busy';
      } else if (c.status === 'OFFLINE') {
        statusTag = 'tag-offline';
        statusText = 'OFFLINE';
        podClass = 'status-offline';
      }

      if (c.isSurgeCounter && c.status === 'BUSY') {
        statusTag = 'tag-surge';
        statusText = 'SURGE ACTIVE';
        podClass = 'status-surge';
      }

      let custHtml = `<span style="color: #6b7280;">No customer</span>`;
      if (c.currentCustomer) {
        const remaining = Math.max(0, (c.serviceFinishTime - this.currentClock)).toFixed(1);
        custHtml = `
          <div>
            <strong style="color: #60a5fa;">${c.currentCustomer.id}</strong> 
            <span style="font-size: 0.65rem; color: #9ca3af;">(${c.currentCustomer.serviceName})</span>
            <div style="font-size: 0.7rem; color: #34d399; margin-top: 2px;">⏱ Remaining: ${remaining}m</div>
          </div>
        `;
      }

      return `
        <div class="counter-pod ${podClass}">
          <div class="counter-header">
            <span class="counter-name">${c.name}</span>
            <span class="counter-status-tag ${statusTag}">${statusText}</span>
          </div>
          <div class="counter-clerk">
            <div class="clerk-avatar">${c.isSurgeCounter ? '⚡' : '🧑‍💼'}</div>
            <div>
              <div style="font-size: 0.75rem; font-weight: 600;">Speed: ${(c.efficiency * 100).toFixed(0)}%</div>
              <div style="font-size: 0.65rem; color: #9ca3af;">${c.isSurgeCounter ? 'Dynamic Surge Unit' : 'Standard Counter'}</div>
            </div>
          </div>
          <div class="counter-cust-box">
            ${custHtml}
          </div>
          <div class="counter-stats-bar">
            <span>Served: ${c.customersServed}</span>
            <span>Busy: ${c.totalBusyMinutes.toFixed(1)}m</span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderQueue() {
    const queueStream = document.getElementById('queueStream');
    const queueCountBadge = document.getElementById('queueCountBadge');
    if (!queueStream) return;

    if (queueCountBadge) {
      queueCountBadge.textContent = `${this.queue.length} waiting`;
    }

    if (this.queue.length === 0) {
      queueStream.innerHTML = `<div style="color: #6b7280; font-size: 0.8rem; padding: 12px 0;">Queue empty. Counters ready for arrivals.</div>`;
      return;
    }

    queueStream.innerHTML = this.queue.slice(0, 25).map(c => {
      let chipClass = 'chip-standard';
      let categoryTag = 'Standard';
      if (c.category === 'EMERGENCY') {
        chipClass = 'chip-emergency';
        categoryTag = '🚨 Emergency';
      } else if (c.category === 'PRIORITY') {
        chipClass = 'chip-priority';
        categoryTag = '⭐ Priority';
      }

      const waitSoFar = Math.max(0, this.currentClock - c.arrivalTime).toFixed(1);

      return `
        <div class="customer-chip ${chipClass}">
          <div class="chip-id">
            <span>${c.id}</span>
            <span style="font-size: 0.6rem; color: #9ca3af;">${categoryTag}</span>
          </div>
          <div class="chip-service">${c.serviceName}</div>
          <div class="chip-timer">Wait: ${waitSoFar}m</div>
        </div>
      `;
    }).join('');

    if (this.queue.length > 25) {
      queueStream.innerHTML += `<div style="color: #9ca3af; font-size: 0.75rem; padding: 10px;">+${this.queue.length - 25} more...</div>`;
    }
  }

  updateStats() {
    const simClockEl = document.getElementById('simClockDisplay');
    const kpiQueueEl = document.getElementById('kpiCurrentQueue');
    const kpiAvgWaitEl = document.getElementById('kpiLiveAvgWait');
    const kpiServedEl = document.getElementById('kpiLiveServed');
    const kpiActiveCountersEl = document.getElementById('kpiLiveActiveCounters');

    if (simClockEl) {
      const hours = Math.floor(this.currentClock / 60);
      const mins = Math.floor(this.currentClock % 60);
      simClockEl.textContent = `${hours}h ${mins.toString().padStart(2, '0')}m`;
    }

    if (kpiQueueEl) kpiQueueEl.textContent = this.queue.length;
    if (kpiServedEl) kpiServedEl.textContent = `${this.completed.length} / ${this.customers.length}`;

    if (kpiAvgWaitEl) {
      const avgWait = this.completed.length > 0
        ? (this.completed.reduce((sum, c) => sum + c.waitingTime, 0) / this.completed.length).toFixed(1)
        : '0.0';
      kpiAvgWaitEl.textContent = `${avgWait} min`;
    }

    if (kpiActiveCountersEl) {
      const active = this.counters.filter(c => c.status === 'BUSY' || c.status === 'IDLE').length;
      kpiActiveCountersEl.textContent = `${active} / ${this.counters.length}`;
    }
  }
}

window.SmartQVisualizer = SmartQVisualizer;
