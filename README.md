# SmartQ

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

## Installation instructions
1. Ensure Python 3 and Node.js are installed.
2. Open a terminal in the project folder.
3. Install any dependencies if needed, or simply use the built-in runtime.

## Execution instructions
Run the demo locally:

```bash
python -m http.server 8000
```

Then open this URL:

```text
http://localhost:8000
```

To run the simulation tests:

```bash
node --test
```

## Dataset and API information
This project uses simulated customer demand rather than a live external dataset. The arrival process is generated from configurable hourly demand, peak periods, and service-time variance so the application can run without external API dependencies.

## Known limitations
- The model uses simulated demand rather than real institutional data.
- It assumes counters can be reallocated instantly without setup delays.
- The current version focuses on queue prediction and aggregate operational insight rather than deep forecasting or live staff scheduling integration.

## Future improvements
- Priority-aware service windows for vulnerable or urgent customers.
- More realistic arrival distributions and peak forecasting models.
- Dynamic staff reallocation based on live queue telemetry.
- Exporting results to CSV or PDF reports.
