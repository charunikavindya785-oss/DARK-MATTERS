
// MEMBER 03 - QUEUE MANAGEMENT

/**
 * @typedef {Object} Student
 * @property {number} id
 * @property {string} name
 * @property {Date} arrivalTime
 * @property {number} serviceTime
 * @property {string} status
 */

// Store student details
/** @type {Student[]} */
let studentQueue = [];

// Generate queue numbers
let queueNumber = 1;


// Add a student to the queue

/**
 * @param {string} name
 * @param {number} serviceTime
 * @param {Date} arrivalTime
 */
function addStudent(name, serviceTime, arrivalTime = new Date()) {

    // Validate inputs
    if (!name || name.trim() === "") {
        alert("Please enter student name");
        return;
    }

    if (!Number.isFinite(Number(serviceTime)) || Number(serviceTime) <= 0) {
        alert("Please enter a valid service time");
        return;
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

    // Add student to queue
    studentQueue.push(student);

    // Arrange students by arrival time
    studentQueue.sort((a, b) =>
        a.arrivalTime.getTime() - b.arrivalTime.getTime()
    );

    queueNumber++;

    console.log("Student added successfully");

    displayQueue();
}


// Display queue details
function displayQueue() {

    console.log("----- STUDENT QUEUE -----");

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


// Get all students in the queue
/**
 * @returns {Student[]}
 */
function getStudentQueue() {
    return studentQueue;
}


// Get the number of waiting students
function getQueueLength() {

    return studentQueue.filter(
        student => student.status === "Waiting"
    ).length;
}


// Make functions available to browser
if (typeof window !== "undefined") {

    window.QueueManager = {
        addStudent,
        displayQueue,
        getStudentQueue,
        getQueueLength
    };

}
