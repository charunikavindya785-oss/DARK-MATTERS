# SmartQ System Architecture

## 1. High-Level Architecture Overview

SmartQ is architected as an end-to-end, high-performance intelligent queue prediction and dynamic service allocation platform. It bridges theoretical queueing mechanics with discrete-event operational simulation and proactive capacity management.

```
+------------------------------------------------------------------------------+
|                              SMARTQ CLIENT (SPA)                             |
|  - Real-Time Simulation Canvas     - Multi-Strategy Comparison Dashboard     |
|  - Queue Velocity Heatmap          - Analytical Queueing Theory Playground   |
|  - Pareto Staff Budget Optimizer   - Zero-Dependency High-DPI Canvas Charts  |
+------------------------------------------------------------------------------+
                                       |
                       REST API (HTTP / JSON Payload)
                                       |
+------------------------------------------------------------------------------+
|                            BACKEND APPLICATION LAYER                         |
|  [backend/server.js]       - Native Node.js HTTP Server & Static Asset Stream|
|  [backend/routes/apiRoutes.js] - Request Parsing, Route Handlers, Validation |
+------------------------------------------------------------------------------+
                                       |
+------------------------------------------------------------------------------+
|                           CORE COMPUTATIONAL ENGINES                         |
|  1. Discrete-Event Simulation Engine (MinHeap Event Calendar, PRNG)          |
|  2. Queueing Theory Engine (M/M/c Erlang-C, Allen-Cunneen M/G/c)             |
|  3. Predictive Congestion Forecaster (Velocity dλ/dt, Risk Heatmaps)         |
|  4. Strategy Simulation Runner (Baseline, Load Balanced, Predictive, Priority)|
|  5. Constrained Resource Optimizer (Pareto Budget Frontier, SLA Solver)      |
+------------------------------------------------------------------------------+
                                       |
+------------------------------------------------------------------------------+
|                            PERSISTENCE LAYER                                 |
|  [backend/db/database.js]  - SQLite (Native node:sqlite / Fallback)          |
|  - scenario_presets        - simulation_runs telemetry                       |
+------------------------------------------------------------------------------+
```

---

## 2. Component Breakdown

### A. Discrete-Event Simulation (DES) Engine (`backend/engine/discreteEventSimulation.js`)
- **Event Calendar**: Implemented as a binary Min-Heap sorted by simulation timestamp $t$. Events include `CUSTOMER_ARRIVAL`, `SERVICE_COMPLETION`, and periodic `HEARTBEAT_MONITOR`.
- **Reproducible PRNG**: Mulberry32 32-bit pseudo-random number generator ensuring 100% deterministic reproducibility across strategy comparisons.
- **Continuous Metrics Collection**: Measures queue lengths, active servers, turnaround times, and counter busy durations per simulated time step.

### B. Queueing Theory Engine (`backend/engine/queueingTheory.js`)
- Solves classical Kendall notation models ($M/M/c$ and $M/G/c$).
- Evaluates stability conditions ($\rho = \frac{\lambda}{c \mu} < 1$).
- Calculates delay probabilities using Erlang-C and verifies steady-state Little's Law ($L_q = \lambda W_q$).
- Generates capacity recommendations based on user-defined target waiting times.

### C. Predictive Congestion Forecaster (`backend/engine/congestionPredictor.js`)
- Aggregates forward arrivals into time buckets (e.g., 10 or 15-minute windows).
- Tracks arrival velocity $V(t) = \frac{\Delta \text{Arrivals}}{\Delta t}$ against aggregate counter throughput.
- Predicts upcoming backlog $\hat{Q}(t + \Delta t)$ and alerts operators with Green / Amber / Red risk scores and recommended surge counter activations.

### D. Strategy Runner & Allocation Models (`backend/engine/strategies.js`)
1. **Baseline**: Static FIFO single queue, static 3 counters, no dynamic rebalancing.
2. **Strategy 1 (Dynamic Load Balancing)**: Shortest expected backlog dispatching and skill-based matching for express vs complex cases.
3. **Strategy 2 (SmartQ Predictive Surge Allocation)**: Autonomous activation of standby surge counters during backlog spikes, followed by graceful deactivation during recovery periods.
4. **Strategy 3 (Priority-Weighted Starvation-Free)**: Multi-class priority scheduling with dynamic aging weight ($Score = PriorityWeight \times 10 + TimeInQueue \times 1.5$) to prevent starvation of standard customers.

### E. Constrained Resource Optimizer (`backend/engine/resourceOptimizer.js`)
- Evaluates static staffing curves vs adaptive dynamic counter schedules under labor wage constraints.
- Identifies the minimum-cost staffing policy that satisfies a given SLA compliance goal (e.g. 90% served under 10 minutes).
- Calculates exact dollar and staff-hour savings compared to over-provisioned static staffing.

---

## 3. Data Flow Diagram

```
User Input / Preset Selection
          │
          ▼
Generate Customer Cohort (Seedable PRNG, >= 100 customers)
          │
          ├───► Send Identical Cohort to Baseline Strategy
          ├───► Send Identical Cohort to Dynamic Load Balancing Strategy
          ├───► Send Identical Cohort to SmartQ Predictive Surge Strategy
          └───► Send Identical Cohort to Priority-Aware Strategy
          │
Collect Event Traces & Performance Metrics
          │
          ├───► Compute Delta Improvements (% wait drop, peak queue drop)
          ├───► Compute Theoretical M/M/c & M/G/c Comparison
          └───► Store Run in SQLite Database
          │
Render Web Dashboard:
  • Live Visual Counter Desks & Queue Lane
  • Comparative Metric Tables & Delta Badges
  • High-DPI Canvas Time-Series & Multi-Bar Charts
  • Congestion Risk Heatmap & Staffing Pareto Frontier
```
