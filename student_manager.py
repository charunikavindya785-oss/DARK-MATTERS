
from datetime import datetime
from typing import Dict, List, Optional


class Student:
    """Represents a student registered in the Smart Q system."""
    
    def __init__(self, student_id: str, name: str, contact: str, service_type: str, queue_number: str):
        self.student_id = student_id.strip()
        self.name = name.strip()
        self.contact = contact.strip()
        self.service_type = service_type.strip()
        self.queue_number = queue_number
        self.registered_at = datetime.now()
        self.status = "Waiting"  # "Waiting", "Serving", "Completed", "Cancelled"

    def get_formatted_time(self) -> str:
        return self.registered_at.strftime("%I:%M:%S %p")

    def to_dict(self) -> Dict:
        return {
            "student_id": self.student_id,
            "name": self.name,
            "contact": self.contact,
            "service_type": self.service_type,
            "queue_number": self.queue_number,
            "registered_at": self.registered_at.isoformat(),
            "formatted_time": self.get_formatted_time(),
            "status": self.status
        }

    def __str__(self) -> str:
        return f"[{self.queue_number}] {self.name} (ID: {self.student_id}) - Service: {self.service_type} - Status: {self.status}"


class StudentManager:
    """Handles student registrations and queue number generation."""

    def __init__(self, prefix: str = "Q"):
        self.students: List[Student] = []
        self.queue_counter: int = 1
        self.default_prefix: str = prefix

    def generate_queue_number(self, service_type: str = "") -> str:
        """
        Generates a sequential unique queue number.
        Example outputs: Q-001, REG-002, PAY-003
        """
        prefix = self.default_prefix

        # Categorized prefixes
        if "reg" in service_type.lower():
            prefix = "REG"
        elif "pay" in service_type.lower() or "fee" in service_type.lower():
            prefix = "PAY"
        elif "exam" in service_type.lower():
            prefix = "EXM"
        elif "inquiry" in service_type.lower():
            prefix = "GEN"

        # Format number with 3 digits (e.g. 001, 002)
        queue_number = f"{prefix}-{self.queue_counter:03d}"
        self.queue_counter += 1
        return queue_number

    def validate_student_details(self, student_id: str, name: str, contact: str, service_type: str) -> tuple[bool, Optional[str]]:
        """Validates student inputs before issuing a token."""
        if not student_id or not student_id.strip():
            return False, "Student ID cannot be empty."
        if not name or not name.strip():
            return False, "Student Name cannot be empty."
        if not contact or not contact.strip():
            return False, "Contact details are required."
        if not service_type or not service_type.strip():
            return False, "Please specify a service type."

        # Check for duplicate active student in queue
        for student in self.students:
            if student.student_id.lower() == student_id.strip().lower() and student.status == "Waiting":
                return False, f"Student {student_id} is already waiting with Queue No: {student.queue_number}"

        return True, None

    def register_student(self, student_id: str, name: str, contact: str, service_type: str) -> Dict:
        """
        Registers a new student and generates their queue number.
        """
        is_valid, error = self.validate_student_details(student_id, name, contact, service_type)
        if not is_valid:
            return {"success": False, "message": error, "student": None}

        # Generate unique queue number
        queue_number = self.generate_queue_number(service_type)

        # Create new student object
        new_student = Student(student_id, name, contact, service_type, queue_number)
        self.students.append(new_student)

        return {
            "success": True,
            "message": f"Student registered successfully with Queue No: {queue_number}",
            "student": new_student
        }

    def get_all_students(self) -> List[Student]:
        """Returns all registered students."""
        return self.students

    def get_waiting_students(self) -> List[Student]:
        """Returns students waiting in queue (to hand over to Member 03)."""
        return [s for s in self.students if s.status == "Waiting"]

    def find_student_by_queue(self, queue_number: str) -> Optional[Student]:
        """Find student by token number."""
        for s in self.students:
            if s.queue_number.lower() == queue_number.strip().lower():
                return s
        return None

    def update_status(self, queue_number: str, new_status: str) -> bool:
        """Updates the status of a student (e.g. Waiting -> Serving -> Completed)."""
        student = self.find_student_by_queue(queue_number)
        if student:
            student.status = new_status
            return True
        return False


# ===================================================================
# Console Testing / Interactive CLI
# ===================================================================
if __name__ == "__main__":
    manager = StudentManager()

    print("=====================================================")
    print("      SMART Q - MEMBER 02: STUDENT MANAGEMENT        ")
    print("=====================================================")

    while True:
        print("\nMenu:")
        print("1. Register Student & Generate Queue Number")
        print("2. View All Registered Students")
        print("3. View Waiting Students (For Member 03 Queue)")
        print("4. Exit")

        choice = input("Enter choice (1-4): ").strip()

        if choice == "1":
            print("\n--- Student Details Input ---")
            s_id = input("Student ID: ").strip()
            name = input("Student Name: ").strip()
            contact = input("Contact Number: ").strip()
            print("Services: 1) Course Registration  2) Fee Payment  3) Exam Inquiry  4) General Inquiry")
            service = input("Service Required: ").strip()

            result = manager.register_student(s_id, name, contact, service)
            if result["success"]:
                st = result["student"]
                print("\n========================================")
                print("             QUEUE TOKEN                ")
                print(f"      Token Number : {st.queue_number}  ")
                print(f"      Student Name : {st.name}          ")
                print(f"      Student ID   : {st.student_id}    ")
                print(f"      Service      : {st.service_type}  ")
                print(f"      Issued Time  : {st.get_formatted_time()}")
                print("========================================")
            else:
                print(f"\n❌ Error: {result['message']}")

        elif choice == "2":
            students = manager.get_all_students()
            print("\n--- All Registered Students ---")
            if not students:
                print("No students registered yet.")
            for s in students:
                print(s)

        elif choice == "3":
            waiting = manager.get_waiting_students()
            print("\n--- Waiting Students for Queue ---")
            if not waiting:
                print("No students waiting.")
            for s in waiting:
                print(s)

        elif choice == "4":
            print("Exiting Smart Q Student Management. Goodbye!")
            break
        else:
            print("Invalid selection! Please enter 1-4.")
