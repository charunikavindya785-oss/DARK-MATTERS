# Mathematical Foundations & Queueing Theory Guide

## 1. Kendall's Notation

In queueing theory, systems are formally represented using David G. Kendall's notation:
$$A / B / c / K / m / Z$$

Where:
- **$A$ (Arrival Process)**: $M$ for Markovian (Poisson arrivals, exponentially distributed inter-arrival times), $G$ for General arrival distributions.
- **$B$ (Service Time Distribution)**: $M$ for Exponential service times, $G$ for General service times (Normal, Uniform, Log-Normal).
- **$c$ (Number of Parallel Servers)**: The count of parallel service counters ($c \ge 3$ in SmartQ).
- **$K$ (System Capacity)**: Maximum allowed customers in system ($\infty$ in our primary model).
- **$m$ (Population Size)**: Size of the calling population ($\infty$).
- **$Z$ (Queue Discipline)**: Service discipline (FIFO, Priority, Shortest Job First).

---

## 2. The $M/M/c$ Multiserver Queueing Model

### 2.1 Traffic Intensity & Stability Condition
Given an arrival rate $\lambda$ (customers/min) and mean service rate $\mu$ per counter:
$$\text{Offered Load } a = \frac{\lambda}{\mu}$$
$$\text{Traffic Intensity / Server Utilization } \rho = \frac{a}{c} = \frac{\lambda}{c \cdot \mu}$$

**Fundamental Stability Theorem**:
- If $\rho < 1.0$: The system reaches a steady-state equilibrium.
- If $\rho \ge 1.0$: The system is **unstable**. Arriving customers exceed maximum service capacity, and queue backlog $Q(t) \to \infty$ without dynamic intervention.

### 2.2 Steady-State Probability of Zero Customers ($P_0$)
$$P_0 = \left[ \sum_{k=0}^{c-1} \frac{a^k}{k!} + \frac{a^c}{c! \cdot (1 - \rho)} \right]^{-1}$$

### 2.3 The Erlang-C Delay Formula ($P_q$)
The Erlang-C formula determines the probability that an arriving customer finds all $c$ counters busy and must wait in queue:
$$P_q = \frac{\frac{a^c}{c! \cdot (1 - \rho)}}{\sum_{k=0}^{c-1} \frac{a^k}{k!} + \frac{a^c}{c! \cdot (1 - \rho)}} = \frac{a^c}{c! \cdot (1 - \rho)} \cdot P_0$$

### 2.4 Expected Waiting Times & Little's Law
- **Expected Waiting Time in Queue ($W_q$)**:
  $$W_q = \frac{P_q}{c \cdot \mu - \lambda} = \frac{P_q}{c \cdot \mu \cdot (1 - \rho)}$$
- **Total Time in System ($W$)**:
  $$W = W_q + \frac{1}{\mu}$$
- **Little's Law**:
  $$L_q = \lambda \cdot W_q \quad \text{(Average queue length)}$$
  $$L = \lambda \cdot W \quad \text{(Average total customers in system)}$$

---

## 3. General Service Times: The $M/G/c$ Model (Allen-Cunneen Approximation)

In real-world institutions (hospitals, universities), service durations rarely follow a pure exponential distribution. They exhibit variance depending on transaction complexity.

To model this, SmartQ applies the **Allen-Cunneen approximation**:
$$W_q(M/G/c) \approx W_q(M/M/c) \cdot \left( \frac{C_a^2 + C_s^2}{2} \right)$$

Where:
- $C_a^2 = \frac{\sigma_a^2}{(E[A])^2}$ is the squared coefficient of variation for inter-arrival times ($= 1.0$ for Poisson arrivals).
- $C_s^2 = \frac{\sigma_s^2}{(E[S])^2}$ is the squared coefficient of variation for service times.

**Insight**: When transaction complexity varies widely ($C_s^2 > 1.0$), queue lengths and waiting times increase dramatically compared to exponential assumptions, making intelligent load balancing crucial.

---

## 4. Why Static Allocation Fails: Non-Stationary Arrival Surges

Standard queueing theory assumes stationary arrival rates ($\lambda = \text{const}$). In real life, institutions face non-stationary burst periods:
- **Hospital Triage**: Ambulance arrivals, shift handovers.
- **University Registrar**: Morning enrollment deadlines, fee cutoffs.
- **Government Centers**: Opening rush, post-lunch surges.

During a surge where $\lambda(t) > c \cdot \mu$, static counters accumulate backlog at rate:
$$\frac{dQ}{dt} = \lambda(t) - c \cdot \mu$$

SmartQ solves this by monitoring predicted queue velocity and activating standby surge units $c_{surge}$, restoring instantaneous stability ($\lambda(t) < (c + c_{surge}) \mu$) and preventing wait-time divergence.
