// ============================================================
// MEMBER 03 - QUEUE MANAGEMENT (WITH SQLITE DATABASE PERSISTENCE)
// SmartQ - Intelligent Queue Prediction & Service Allocation
// ============================================================

/**
 * @typedef {Object} Student
 * @property {number} id
 * @property {string} name
 * @property {Date} arrivalTime
 * @property {number} serviceTime
 * @property {string} status
 * @property {string} [counterAssigned]
 * @property {number} [waitingTime]
 */

// In-Memory Queue Store
/** @type {Student[]} */
let studentQueue = [];

// Generate queue numbers
let queueNumber = 1;

// API Base URL for database sync
const API_BASE_URL = typeof window !== "undefined" 
    ? (window.location.origin ? `${window.location.origin}/api/student-queue` : "http://localhost:3000/api/student-queue")
    : "http://localhost:3000/api/student-queue";

// Node.js direct DB DAO (when running on server/Node)
let nodeDb = null;
if (typeof window === "undefined") {
    try {
        nodeDb = require('./backend/db/studentQueueDb');
    } catch (e) {
        // Fallback if imported from different path
    }
}

/**
 * Add a student to the queue (In-Memory + Optional DB Sync)
 * @param {string} name
 * @param {number} serviceTime
 * @param {Date|string} arrivalTime
 * @returns {Student|null}
 */
function addStudent(name, serviceTime, arrivalTime = new Date()) {
    // Validate inputs
    if (!name || name.trim() === "") {
        if (typeof alert !== "undefined") alert("Please enter student name");
        else console.warn("Please enter student name");
        return null;
    }

    if (!Number.isFinite(Number(serviceTime)) || Number(serviceTime) <= 0) {
        if (typeof alert !== "undefined") alert("Please enter a valid service time");
        else console.warn("Please enter a valid service time");
        return null;
    }

    // Create student object
    /** @type {Student} */
    let student = {
        id: queueNumber,
        name: name.trim(),
        arrivalTime: new Date(arrivalTime),
        serviceTime: Number(serviceTime),
        status: "Waiting"
    };

    // Add student to in-memory queue
    studentQueue.push(student);

    // Arrange students by arrival time (FIFO Order)
    studentQueue.sort((a, b) =>
        a.arrivalTime.getTime() - b.arrivalTime.getTime()
    );

    queueNumber++;

    console.log("Student added successfully to local queue:", student);
    displayQueue();

    // If Node.js server context, persist directly to SQLite
    if (nodeDb) {
        try {
            nodeDb.addStudent(student.name, student.serviceTime, student.arrivalTime);
        } catch (err) {
            console.error("Error saving to SQLite database:", err.message);
        }
    }

    return student;
}

/**
 * Add a student and save to SQLite Database via REST API
 * @param {string} name 
 * @param {number} serviceTime 
 * @param {Date|string} arrivalTime 
 */
async function addStudentToDb(name, serviceTime, arrivalTime = new Date()) {
    // 1. Add locally
    const localStudent = addStudent(name, serviceTime, arrivalTime);
    if (!localStudent) return null;

    // 2. Persist to SQLite via API if in browser / fetch available
    if (typeof fetch !== "undefined") {
        try {
            const res = await fetch(API_BASE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: localStudent.name,
                    serviceTime: localStudent.serviceTime,
                    arrivalTime: localStudent.arrivalTime.toISOString()
                })
            });
            const data = await res.json();
            console.log("Student saved to SQLite Database:", data);
            return data.student || localStudent;
        } catch (err) {
            console.warn("Could not sync with database API (offline mode):", err.message);
        }
    }

    return localStudent;
}

/**
 * Load all students from the SQLite Database into memory
 */
async function fetchQueueFromDb() {
    if (typeof fetch !== "undefined") {
        try {
            const res = await fetch(API_BASE_URL);
            const data = await res.json();
            if (data.success && Array.isArray(data.queue)) {
                studentQueue = data.queue.map(item => ({
                    id: item.queue_number,
                    name: item.name,
                    arrivalTime: new Date(item.arrival_time),
                    serviceTime: item.service_time,
                    status: item.status,
                    counterAssigned: item.counter_assigned,
                    waitingTime: item.waiting_time
                }));

                if (studentQueue.length > 0) {
                    queueNumber = Math.max(...studentQueue.map(s => s.id)) + 1;
                }
                displayQueue();
                return studentQueue;
            }
        } catch (err) {
            console.warn("Could not fetch from database:", err.message);
        }
    } else if (nodeDb) {
        const rows = nodeDb.getQueue();
        studentQueue = rows.map(item => ({
            id: item.queue_number,
            name: item.name,
            arrivalTime: new Date(item.arrival_time),
            serviceTime: item.service_time,
            status: item.status,
            counterAssigned: item.counter_assigned,
            waitingTime: item.waiting_time
        }));
        return studentQueue;
    }
    return studentQueue;
}

/**
 * Update student status in Database ('Waiting' -> 'In Service' -> 'Completed')
 * @param {number} id 
 * @param {string} status 
 * @param {string|null} counterAssigned 
 */
async function updateStudentStatus(id, status, counterAssigned = null) {
    // Update locally
    const s = studentQueue.find(item => item.id === id);
    if (s) {
        s.status = status;
        if (counterAssigned) s.counterAssigned = counterAssigned;
    }

    // Update in SQLite
    if (typeof fetch !== "undefined") {
        try {
            await fetch(API_BASE_URL, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status, counterAssigned })
            });
        } catch (err) {
            console.warn("Database status update failed:", err.message);
        }
    } else if (nodeDb) {
        nodeDb.updateStudentStatus(id, status, counterAssigned);
    }

    displayQueue();
}

/**
 * Display queue details in console
 */
function displayQueue() {
    console.log("----- STUDENT QUEUE (DATABASE SYNCED) -----");
    studentQueue.forEach((student, index) => {
        console.log(
            "Position:", index + 1,
            "| Queue No:", student.id,
            "| Name:", student.name,
            "| Arrival:", student.arrivalTime.toLocaleTimeString(),
            "| Service Time:", student.serviceTime,
            "| Status:", student.status
        );
    });
}

/**
 * Get all students in the queue
 * @returns {Student[]}
 */
function getStudentQueue() {
    return studentQueue;
}

/**
 * Get the number of waiting students
 * @returns {number}
 */
function getQueueLength() {
    return studentQueue.filter(
        student => student.status === "Waiting"
    ).length;
}

// Make functions available to browser
if (typeof window !== "undefined") {
    window.QueueManager = {
        addStudent,
        addStudentToDb,
        fetchQueueFromDb,
        updateStudentStatus,
        displayQueue,
        getStudentQueue,
        getQueueLength
    };
}

// Export for Node.js environments
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        addStudent,
        addStudentToDb,
        fetchQueueFromDb,
        updateStudentStatus,
        displayQueue,
        getStudentQueue,
        getQueueLength
    };
}
