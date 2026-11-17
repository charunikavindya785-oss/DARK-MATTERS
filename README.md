# SmartQ - Intelligent Queue Prediction & Adaptive Service Allocation Engine

**BuildX 0.1 Applied Computing & Innovation Hackathon**  
**Challenge 10: Intelligent Queue Prediction and Service Allocation**

---

## 1. Project Name
**SmartQ**: Intelligent Queue Prediction, Congestion Forecasting, and Adaptive Service Allocation Engine.

---

## 2. Team Identifier
**Team BuildX-Alpha** (Hackathon Registration ID: `BX-CH10-ALPHA`)

---

## 3. Problem Being Addressed
Universities, hospitals, and citizen service centers frequently suffer from severe, uneven customer arrival spikes. When arrivals surge beyond counter capacity, massive waiting lines develop:
- **Electronic Queue Numbers Are Ineffective On Their Own**: Simply issuing a ticket number does not solve the fundamental capacity and resource bottleneck.
- **Service Time Variability**: Complex cases (trauma diagnosis, disputed registration) tie up counters, causing queue backlogs to cascade.
- **Static Staffing Inefficiency**: Operating a fixed number of counters either leads to unacceptable peak customer waiting times (>50 minutes) or expensive overstaffing during idle periods.

Organizations urgently require an intelligent system that models arrival dynamics, predicts upcoming congestion windows, estimates waiting times mathematically, and dynamically allocates service counters and staff to meet strict Service Level Agreements (SLAs).

---

## 4. Proposed Solution
SmartQ is an intelligent queue management and service allocation platform that integrates:
1. **Mathematical Queueing Theory ($M/M/c$ and $M/G/c$)**: Evaluates traffic intensity ($\rho = \frac{\lambda}{c \mu}$), Erlang-C delay probabilities ($P_q$), and steady-state Little's Law ($L_q = \lambda W_q$) to establish rigorous theoretical capacity benchmarks.
2. **High-Fidelity Discrete-Event Simulation (DES)**: An event-calendar-driven simulation engine with microsecond precision, simulating customer cohorts ($\ge 100$ customers) across multiple counters with non-stationary arrival surges.
3. **Predictive Congestion Forecaster**: Analyzes arrival velocity ($\frac{d\lambda}{dt}$) and current backlog to pinpoint future peak congestion windows and generate proactive surge recommendations.
4. **Adaptive Resource Allocation Strategies**:
   - **Baseline**: Static FIFO queue with fixed counters (reference benchmark).
   - **Strategy 1 (Dynamic Load Balancing)**: Dispatches customers to counters with the shortest expected completion time, routing express tasks to fast-track desks.
   - **Strategy 2 (SmartQ Predictive Surge Allocation - Recommended)**: Autonomously scales up dynamic surge counters during congestion bursts and scales down during recovery periods.
   - **Strategy 3 (Priority-Weighted Starvation-Free Scheduling)**: Multi-class priority tiering (Emergency / Senior / Standard) with dynamic priority aging to prevent starvation.
5. **Staff Budget & Pareto Frontier Optimizer**: Finds the minimum-cost counter staffing schedule that meets target SLA wait times, calculating labor cost savings compared to brute-force staffing.
6. **Zero-Dependency Interactive Web Dashboard**: High-DPI canvas charting, live animated counter desks, customer queue lane visualization, and instant side-by-side strategy benchmark comparisons.

---

## 5. Technology Stack
- **Backend & Simulation Core**: Node.js v24 (Native ES & CommonJS runtime), Discrete-Event Min-Heap Calendar, Linear Congruential / Mulberry32 Seedable PRNG.
- **Queueing Theory Models**: $M/M/c$ Erlang-C model, Allen-Cunneen $M/G/c$ high-variance approximation, Little's Law equations.
- **Database & Persistence**: Node.js native `node:sqlite` (`DatabaseSync` engine) with in-memory fallback.
- **Frontend & Visualizations**: Vanilla HTML5, Modern Glassmorphic CSS3, High-Performance Canvas 2D charting engine (zero external CDN or script dependencies).
- **Communication Protocol**: Native Node.js HTTP REST API with JSON payloads.
- **Testing & Verification**: Built-in automated verification test suite (`tests/unitTests.js`).

---

## 6. Architecture Overview
```
+------------------------------------------------------------------------------+
|                              SMARTQ CLIENT (SPA)                             |
|  - Real-Time Simulation Canvas     - Multi-Strategy Comparison Dashboard     |
|  - Queue Velocity Heatmap          - Analytical Queueing Theory Playground   |
|  - Pareto Staff Budget Optimizer   - Zero-Dependency High-DPI Canvas Charts  |
+------------------------------------------------------------------------------+
                                       │
                       REST API (HTTP / JSON Payload)
                                       │
+------------------------------------------------------------------------------+
|                            BACKEND APPLICATION LAYER                         |
|  [backend/server.js]       - Native Node.js HTTP Server & Static Asset Stream|
|  [backend/routes/apiRoutes.js] - Request Parsing, Route Handlers, Validation │
+------------------------------------------------------------------------------+
                                       │
+------------------------------------------------------------------------------+
|                           CORE COMPUTATIONAL ENGINES                         |
|  1. Discrete-Event Simulation Engine (MinHeap Event Calendar, PRNG)          |
|  2. Queueing Theory Engine (M/M/c Erlang-C, Allen-Cunneen M/G/c)             |
|  3. Predictive Congestion Forecaster (Velocity dλ/dt, Risk Heatmaps)         |
|  4. Strategy Simulation Runner (Baseline, Load Balanced, Predictive, Priority)|
|  5. Constrained Resource Optimizer (Pareto Budget Frontier, SLA Solver)      |
+------------------------------------------------------------------------------+
                                       │
+------------------------------------------------------------------------------+
|                            PERSISTENCE LAYER                                 |
|  [backend/db/database.js]  - SQLite (Native node:sqlite / Fallback)          |
|  - scenario_presets        - simulation_runs telemetry                       |
+------------------------------------------------------------------------------+
```

---

## 7. Installation Instructions
SmartQ is designed to be **100% self-contained** with zero external package installation requirements.

### Prerequisites:
- Windows, macOS, or Linux with Node.js installed (v18, v20, v22, or v24).
- On Windows systems with the Antigravity runtime, the included `node.cmd` automatically wraps the embedded Node.js engine.

### Setup:
1. Clone or extract the repository to your local directory:
   ```powershell
   cd c:\Users\charu\Desktop\SmartQ
   ```
2. No `npm install` is required because all mathematical algorithms, simulation components, database engines, and UI charts are natively implemented!

---

## 8. Execution Instructions

### Option 1: Quick Launch (Windows Batch File)
Double-click `start.bat` or run:
```cmd
start.bat
```
This automatically starts the HTTP server on port 3000 and opens your default browser at `http://localhost:3000`.

### Option 2: Running via Node Wrapper
```powershell
.\node.cmd backend\server.js
```
Open your browser to: **`http://localhost:3000`**

### Option 3: Running Automated Test Suite
To execute the automated verification test suite (validating Queueing Theory, Little's Law, Simulation reproducibility, and Measurable Improvements):
```powershell
.\node.cmd tests\unitTests.js
```

---

## 9. Dataset and API Information

### 9.1 Synthetic & Simulated Datasets
In compliance with Hackathon Guidelines Section 4.2:
- All customer arrival and service duration cohorts are **clearly identified as simulated datasets**.
- Arrivals are generated via stochastic processes (Poisson arrivals, Uniform intervals, Surge Wave peaks, and Shock Flash Crowds).
- Service durations follow calibrated empirical distributions for four organizational presets:
  1. **Hospital Emergency & Triage**: 150 patients, acute triage variance, trauma procedures up to 18 mins.
  2. **University Student Services & Registrar**: 180 students, morning deadline surge, override petitions.
  3. **Government Citizen Licensing**: 120 citizens, identity verification, biometric reviews.
  4. **Unexpected Shock Flash Crowd**: 200 arrivals, +300% burst test.
- Every run uses a deterministic seed (`seed = 42`) so that all comparative strategies are evaluated on the exact same customer cohort.

### 9.2 REST API Endpoints
- `GET /api/health`: Returns service health status and Node runtime version.
- `GET /api/presets`: Returns available organizational scenario configurations.
- `POST /api/simulate`: Runs a single strategy simulation and returns summary, counter telemetry, and customer traces.
- `POST /api/compare`: Runs an apples-to-apples side-by-side comparison across all 4 strategies on identical customer arrival sequences.
- `POST /api/forecast`: Generates arrival velocity analysis, congestion risk score, and peak alert windows.
- `POST /api/theory`: Solves theoretical $M/M/c$ and $M/G/c$ queueing models and capacity recommendations.
- `POST /api/optimize`: Solves labor-hour and budget-constrained staffing schedules along the Pareto frontier.
- `GET /api/history`: Retrieves recent simulation benchmark runs from the SQLite database.

---

## 10. Known Limitations
1. **Human Server Fatigue**: The model currently assumes a constant counter efficiency multiplier (e.g. 1.05x or 0.95x). In actual environments, staff efficiency fluctuates slightly with fatigue over continuous 8-hour shifts.
2. **Customer Reneging (Balking / Abandonment)**: The current simulation model assumes all customers remain in queue until served. In real life, some customers leave if waiting times exceed 45 minutes ($M/M/c/K$ or balking queue).
3. **Simultaneous Multi-Counter Tasks**: Each customer is currently served by one counter at a time. Multi-step routing across sequential counters (Triage $\to$ Doctor $\to$ Pharmacy) is represented as discrete transactions rather than a tandem Jackson network.

---

## 11. Measurable Improvements Summary (Demonstration Proof)

Simulating 150 customers arriving in surge waves across 3 baseline counters vs SmartQ Adaptive Surge:

| Metric | Baseline Strategy | SmartQ Adaptive Surge | Measurable Improvement |
| :--- | :--- | :--- | :--- |
| **Average Waiting Time** | 18.37 minutes | **4.03 minutes** | **↓ 78.1% Reduction** |
| **Maximum Waiting Time** | 51.64 minutes | **13.77 minutes** | **↓ 73.3% Reduction** |
| **Peak Queue Backlog** | 29 customers | **9 customers** | **↓ 69.0% Reduction** |
| **SLA Compliance ($W < 10\text{m}$)** | 44.7% | **97.3%** | **+ 52.6% Improvement** |
| **Labor Cost Savings** | Fixed 5 Desks: $757.50 | SmartQ: $495.00 | **34.7% Budget Saved ($262.50)** |

---

## Previous Repository Documentation

### Previous Project Overview

## Team identifier
Team: SmartQ BuildX Challenge 10

## Problem being addressed
Many service organisations struggle with uneven demand, long queues, and slow customer service when staffing levels are fixed. Long waiting times reduce service quality, frustrate customers, and limit staff productivity. SmartQ tackles this by simulating customer arrivals, estimating queue delays, and recommending improved resource allocation strategies.

## Proposed solution
SmartQ models multiple service counters and simulates customer arrival patterns, service times, and queue behaviour. It compares a baseline static assignment against dynamic allocation strategies and highlights when demand is likely to create congestion. The dashboard gives staff a practical recommendation on how to distribute workload and reassign the service counter mix to reduce waiting times.

## Technology stack
- HTML5, CSS3 and vanilla JavaScript
- Node.js for test execution
- Python HTTP server for local demo hosting

## Architecture overview
SmartQ follows a lightweight client-side architecture:
1. The simulation engine builds customer arrival and service-time data.
2. Multiple queueing strategies are simulated and compared via counter allocation.
3. Performance metrics are computed for customer waiting times, average waiting time, peak queue length, and counter utilisation.
4. The UI renders comparison tables, recommendation text, counter allocation performance, and congestion forecast charts.

### Counter Allocation & Waiting Time Calculation Module
The simulation engine provides dedicated functions for counter allocation and waiting time metrics:
- **`calculateWaitingTime(arrivalTime, serviceStartTime)`**:
  $$\text{Waiting Time} = \max(0, \text{serviceStartTime} - \text{arrivalTime})$$
  Calculates the exact waiting time (in minutes) for each arriving customer before service commences.
- **`calculateCustomerWait(customer, counter)`**:
  Determines the service start time based on counter availability ($\max(\text{arrivalTime}, \text{nextAvailable})$) and calculates the resulting wait time.
- **`calculateAverageWaitingTime(waitData, count)`**:
  $$\text{Average Waiting Time} = \frac{\sum_{i=1}^N \text{waitingTime}_i}{N}$$
  Computes the average wait time overall as well as for individual counters.
- **`allocateCounter(counters, customer, strategy)`**:
  Allocates an arriving customer to a counter based on one of three strategies:
  - `baseline`: Static round-robin assignment based on customer sequence.
  - `shortest-queue`: Selects the counter with the minimum number of customers currently waiting.
  - `dynamic`: Balances load by selecting the counter that minimizes customer wait time and congestion.

## Installation & Execution Instructions
1. Ensure Python 3 and Node.js are installed.
2. Open a terminal in the project folder.
3. Run the demo locally:
   ```bash
   python -m http.server 8000
   ```
4. Open your browser at:
   ```text
   http://localhost:8000
   ```

---

## Member 02: Student Management Module

### 1. Project Overview
The Student Management System is a core part of the Smart Q Queue Management System. It is responsible for registering students, validating student information, preventing duplicate registrations, and automatically generating sequential queue numbers.

### 2. Responsibilities
- **2.1 Student Registration**:
  - Accept Student ID, Name, Contact Number, and Service Type.
  - Validate all input fields and prevent duplicate active registrations.
- **2.2 Automatic Queue Token Generation**:
  - Generate sequential queue numbers based on service type:
    - General: `GEN-001`, `GEN-002` (or `Q-001`)
    - Registration: `REG-001`, `REG-002`
    - Payment: `PAY-001`, `PAY-002`
    - Exam Inquiry: `EXM-001`, `EXM-002`

### 3. Project Files
| File Name | Description |
|---|---|
| `studentManager.js` | Contains the `Student` and `StudentManager` classes. Handles registration, validation, token generation, and localStorage caching. |
| `student_registration.html` | Provides the student registration interface with registration form, ticket slip display, and dynamic student list table. |
| `student_manager.py` | Python implementation of the Student Management System with interactive command-line interface. |

### 4. Integration with Other Team Members
- **Member 01 (Frontend Developer)**:
  - Embeds the student registration form and token display card into the homepage.
- **Member 03 (Queue Management)**:
  - Uses `studentManager.getWaitingStudents()` to populate the active queue.
- **Member 04 (Algorithm Developer)**:
  - Uses `student.registeredAt` timestamp to compute real-time waiting times.
- **Member 05 (Counter Allocation)**:
  - Updates student status when called (`studentManager.updateStatus("Q-001", "Serving")`).
- **Member 06 (Dashboard & Integration)**:
  - Retrieves active students and logs via `studentManager.getAllStudents()` and `localStorage.getItem("smartq_students")`.

### 5. Running Member 02 Module
- **Web UI**: Open `student_registration.html` in any web browser.
- **Python CLI**: Run `python student_manager.py` in the terminal.
