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
- **Web UI**: Open [`student_registration.html`](file:///c:/Users/User/Desktop/smart%20Q/student_registration.html) in any web browser.
- **Python CLI**: Run `python student_manager.py` in the terminal.
