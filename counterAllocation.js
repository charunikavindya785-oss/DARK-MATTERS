export function createCounters(count = 3) {
  const counters = [];
  for (let i = 1; i <= count; i += 1) {
    counters.push({
      id: i,
      name: `Counter 0${i}`,
      status: 'AVAILABLE',
      currentStudent: null, 
      queue: [],           
      totalServed: 0,      
      totalBusyMinutes: 0, 
      nextAvailableTime: 0 
    });
  }
  return counters;
}


export function getCounterQueueLength(counter) {
  const inService = counter.currentStudent ? 1 : 0;
  return inService + counter.queue.length;
}


export function getShortestQueueCounter(counters) {
  if (!counters || counters.length === 0) {
    throw new Error('Counters array is empty or undefined.');
  }

  const availableCounter = counters.find((c) => c.status === 'AVAILABLE');
  if (availableCounter) {
    return availableCounter;
  }

  return [...counters].sort((left, right) => {
    const leftLen = getCounterQueueLength(left);
    const rightLen = getCounterQueueLength(right);

    if (leftLen !== rightLen) {
      return leftLen - rightLen; 
    }
  
    return left.nextAvailableTime - right.nextAvailableTime;
  })[0];
}


export function selectBestCounter(counters, student, currentTime = 0) {
  if (!counters || counters.length === 0) {
    throw new Error('No counters available.');
  }

  if (student && student.priority === 'priority') {
    return [...counters].sort((a, b) => {
      const waitA = Math.max(0, a.nextAvailableTime - currentTime);
      const waitB = Math.max(0, b.nextAvailableTime - currentTime);
      if (waitA !== waitB) return waitA - waitB;
      return getCounterQueueLength(a) - getCounterQueueLength(b);
    })[0];
  }


  return getShortestQueueCounter(counters);
}


export function assignStudentToCounter(counters, student, targetCounterId = null, currentTime = 0) {
  let counter;

  if (targetCounterId) {
    counter = counters.find((c) => c.id === targetCounterId);
    if (!counter) {
      throw new Error(`Counter ${targetCounterId} does not exist.`);
    }
  } else {
  
    counter = selectBestCounter(counters, student, currentTime);
  }

  const arrivalTime = student.arrivalTime !== undefined ? student.arrivalTime : currentTime;
  const serviceTime = student.serviceTime || 5;


  if (counter.status === 'AVAILABLE') {
    counter.status = 'BUSY';
    counter.currentStudent = {
      ...student,
      serviceStartTime: Math.max(arrivalTime, currentTime),
      waitingTime: 0,
      counterId: counter.id,
    };
    counter.nextAvailableTime = counter.currentStudent.serviceStartTime + serviceTime;

    return {
      success: true,
      counterId: counter.id,
      counterName: counter.name,
      assignedAs: 'IN_SERVICE',
      waitingTime: 0,
      message: `Student ${student.name || student.queueNumber || student.id} is now being served at ${counter.name}.`,
    };
  }


  const estimatedWait = Math.max(0, counter.nextAvailableTime - arrivalTime);
  const queuedStudent = {
    ...student,
    assignedCounterId: counter.id,
    queuePosition: counter.queue.length + 1,
    estimatedWait,
  };

  counter.queue.push(queuedStudent);
  counter.nextAvailableTime += serviceTime;


  balanceQueues(counters);

  return {
    success: true,
    counterId: counter.id,
    counterName: counter.name,
    assignedAs: 'QUEUED',
    queuePosition: queuedStudent.queuePosition,
    estimatedWait,
    message: `Student ${student.name || student.queueNumber || student.id} added to ${counter.name} queue (Position: ${queuedStudent.queuePosition}).`,
  };
}


export function balanceQueues(counters) {
  const rebalancedActions = [];
  let balanced = false;

  while (!balanced) {
  
    const sorted = [...counters].sort(
      (a, b) => b.queue.length - a.queue.length
    );

    const busiest = sorted[0];
    const leastBusy = sorted[sorted.length - 1];

  
    if (busiest.queue.length - leastBusy.queue.length >= 2 && busiest.queue.length > 0) {
      const studentToMove = busiest.queue.pop();
      studentToMove.assignedCounterId = leastBusy.id;
      studentToMove.queuePosition = leastBusy.queue.length + 1;
      leastBusy.queue.push(studentToMove);

      rebalancedActions.push({
        studentId: studentToMove.id || studentToMove.queueNumber,
        fromCounter: busiest.name,
        toCounter: leastBusy.name,
        timestamp: new Date().toISOString(),
      });
    } else {
      balanced = true;
    }
  }

  return rebalancedActions;
}


export function completeCounterService(counters, counterId, currentTime = 0) {
  const counter = counters.find((c) => c.id === counterId);
  if (!counter) {
    throw new Error(`Counter ${counterId} not found.`);
  }

  const completed = counter.currentStudent;
  if (!completed) {
    return null;
  }

  counter.totalServed += 1;
  counter.totalBusyMinutes += (completed.serviceTime || 5);
  counter.currentStudent = null;


  if (counter.queue.length > 0) {
    const nextStudent = counter.queue.shift();
    counter.status = 'BUSY';
    counter.currentStudent = {
      ...nextStudent,
      serviceStartTime: currentTime,
      waitingTime: Math.max(0, currentTime - (nextStudent.arrivalTime || 0)),
    };
    counter.nextAvailableTime = currentTime + (nextStudent.serviceTime || 5);
  } else {
  queue
    const busiest = [...counters]
      .filter((c) => c.id !== counter.id && c.queue.length > 1)
      .sort((a, b) => b.queue.length - a.queue.length)[0];

    if (busiest) {
    
      const stolenStudent = busiest.queue.shift();
      counter.status = 'BUSY';
      counter.currentStudent = {
        ...stolenStudent,
        assignedCounterId: counter.id,
        serviceStartTime: currentTime,
        waitingTime: Math.max(0, currentTime - (stolenStudent.arrivalTime || 0)),
      };
      counter.nextAvailableTime = currentTime + (stolenStudent.serviceTime || 5);
    } else {
      counter.status = 'AVAILABLE';
      counter.nextAvailableTime = currentTime;
    }
  }

  return completed;
}


export function getCountersSummary(counters) {
  return counters.map((counter) => ({
    id: counter.id,
    name: counter.name,
    status: counter.status,
    currentStudent: counter.currentStudent
      ? (counter.currentStudent.name || counter.currentStudent.queueNumber || `Student #${counter.currentStudent.id}`)
      : 'None (Idle)',
    waitingCount: counter.queue.length,
    waitingList: counter.queue.map((s, idx) => ({
      position: idx + 1,
      name: s.name || s.queueNumber || `Student #${s.id}`,
      queueNumber: s.queueNumber || `Q-${s.id}`,
    })),
    totalServed: counter.totalServed,
    totalBusyMinutes: Number(counter.totalBusyMinutes.toFixed(1)),
  }));
}
