/**
 * ===================================================================
 * SMART Q - QUEUE MANAGEMENT SYSTEM
 * Member 02: Student Management Module
 * ===================================================================
 * Tasks:
 * 1. Student details ඇතුළත් කිරීම (Student Registration & Details Input)
 * 2. Queue number එක generate කිරීම (Automatic Queue Number Generation)
 * ===================================================================
 */

// 1. Student Class / Model
class Student {
    /**
     * @param {string} studentId - Unique Student ID (e.g., IT21004567, S1001)
     * @param {string} name - Student's Full Name
     * @param {string} contact - Phone number or email
     * @param {string} serviceType - Purpose of visit (e.g., "Registration", "Payment", "General")
     * @param {string} queueNumber - Auto-generated Queue Number (e.g., Q-001, REG-001)
     */
    constructor(studentId, name, contact, serviceType, queueNumber) {
        this.studentId = (studentId || "").toString().trim();
        this.name = (name || "").toString().trim();
        this.contact = (contact || "").toString().trim();
        this.contactNumber = this.contact; // Alias for compatibility
        this.serviceType = (serviceType || "").toString().trim();
        this.queueNumber = (queueNumber || "").toString().trim();
        this.queueNo = this.queueNumber; // Alias for compatibility
        this.registeredAt = new Date();
        this.status = "Waiting"; // Status: "Waiting", "Serving", "Completed", "Cancelled"
    }

    // Format registration time nicely
    getFormattedTime() {
        return this.registeredAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // Convert student object to JSON or plain object
    toJSON() {
        return {
            studentId: this.studentId,
            name: this.name,
            contact: this.contact,
            contactNumber: this.contactNumber,
            serviceType: this.serviceType,
            queueNumber: this.queueNumber,
            queueNo: this.queueNo,
            registeredAt: this.registeredAt.toISOString(),
            formattedTime: this.getFormattedTime(),
            status: this.status
        };
    }
}

// 2. Student Management Controller / Service
class StudentManager {
    constructor() {
        this.students = [];
        this.queueCounter = 1;
        this.queuePrefix = "Q";
        this.loadFromStorage();
    }

    /**
     * Generate a new unique queue number.
     * Example outputs: "Q-001", "Q-002", "REG-001", etc.
     */
    generateQueueNumber(serviceType = "") {
        let prefix = this.queuePrefix;

        const s = (serviceType || "").toLowerCase();
        if (s.includes("reg")) {
            prefix = "REG";
        } else if (s.includes("pay") || s.includes("fee")) {
            prefix = "PAY";
        } else if (s.includes("exam") || s.includes("exm")) {
            prefix = "EXM";
        } else if (s.includes("gen")) {
            prefix = "GEN";
        }

        const paddedNumber = String(this.queueCounter).padStart(3, '0');
        const queueNumber = `${prefix}-${paddedNumber}`;

        this.queueCounter++;
        this.saveToStorage();

        return queueNumber;
    }

    /**
     * Validates input fields before registration.
     */
    validateStudentDetails(studentId, name, contact, serviceType) {
        if (!studentId || studentId.trim() === "") {
            return { isValid: false, error: "Student ID is required." };
        }
        if (!name || name.trim() === "") {
            return { isValid: false, error: "Student Name is required." };
        }
        if (!contact || contact.trim() === "") {
            return { isValid: false, error: "Contact number is required." };
        }
        if (!serviceType || serviceType.trim() === "") {
            return { isValid: false, error: "Please select a service type." };
        }

        // Check if student with this ID is already waiting in queue
        const existingWaitingStudent = this.students.find(
            s => s.studentId.toLowerCase() === studentId.trim().toLowerCase() && s.status === "Waiting"
        );
        if (existingWaitingStudent) {
            return { 
                isValid: false, 
                error: `Student ${studentId} is already in the queue with Token: ${existingWaitingStudent.queueNo || existingWaitingStudent.queueNumber}.` 
            };
        }

        return { isValid: true, error: null };
    }

    /**
     * Registers a student and generates a new queue number.
     * Supports both registerStudent(id, name, contact, service) AND registerStudent({studentId, name...})
     */
    registerStudent(param1, param2, param3, param4) {
        let studentId, name, contact, serviceType;

        if (typeof param1 === 'object' && param1 !== null) {
            studentId = param1.studentId;
            name = param1.name;
            contact = param1.contact || param1.contactNumber;
            serviceType = param1.serviceType || param1.service;
        } else {
            studentId = param1;
            name = param2;
            contact = param3;
            serviceType = param4;
        }

        // Validate
        const validation = this.validateStudentDetails(studentId, name, contact, serviceType);
        if (!validation.isValid) {
            throw new Error(validation.error);
        }

        // Generate Queue Number
        const queueNumber = this.generateQueueNumber(serviceType);

        // Create new Student record
        const newStudent = new Student(studentId, name, contact, serviceType, queueNumber);

        // Save
        this.students.push(newStudent);
        this.saveToStorage();

        return newStudent;
    }

    getAllStudents() {
        return this.students;
    }

    getWaitingStudents() {
        return this.students.filter(student => student.status === "Waiting");
    }

    findStudentByQueue(queueNumber) {
        return this.students.find(
            s => (s.queueNumber && s.queueNumber.toLowerCase() === queueNumber.trim().toLowerCase()) ||
                 (s.queueNo && s.queueNo.toLowerCase() === queueNumber.trim().toLowerCase())
        );
    }

    findStudentById(studentId) {
        return this.students.find(
            s => s.studentId.toLowerCase() === studentId.trim().toLowerCase()
        );
    }

    updateStatus(queueNumber, newStatus) {
        const student = this.findStudentByQueue(queueNumber);
        if (student) {
            student.status = newStatus;
            this.saveToStorage();
            return true;
        }
        return false;
    }

    resetDailyQueue() {
        this.queueCounter = 1;
        this.saveToStorage();
    }

    saveToStorage() {
        if (typeof localStorage !== "undefined") {
            try {
                localStorage.setItem("smartq_students", JSON.stringify(this.students));
                localStorage.setItem("smartq_counter", this.queueCounter.toString());
            } catch (e) {
                console.warn("Storage save failed:", e);
            }
        }
    }

    loadFromStorage() {
        if (typeof localStorage !== "undefined") {
            try {
                const storedStudents = localStorage.getItem("smartq_students");
                const storedCounter = localStorage.getItem("smartq_counter");

                if (storedCounter) {
                    this.queueCounter = parseInt(storedCounter, 10);
                }

                if (storedStudents) {
                    const parsed = JSON.parse(storedStudents);
                    this.students = parsed.map(s => {
                        const student = new Student(s.studentId, s.name, s.contact || s.contactNumber, s.serviceType, s.queueNumber || s.queueNo);
                        student.registeredAt = new Date(s.registeredAt);
                        student.status = s.status;
                        return student;
                    });
                }
            } catch (e) {
                console.warn("Storage load failed:", e);
            }
        }
    }
}

// Global instance for browser
const studentManager = new StudentManager();
if (typeof window !== "undefined") {
    window.studentManager = studentManager;
    window.Student = Student;
    window.StudentManager = StudentManager;
}

// Export for Node.js
if (typeof module !== "undefined" && module.exports) {
    module.exports = { Student, StudentManager, studentManager };
}
