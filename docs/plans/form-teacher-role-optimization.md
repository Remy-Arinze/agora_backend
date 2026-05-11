# Plan: Form Teacher Role Optimization

This plan outlines the enhancements to elevate the **Form Teacher** role from a static label to a functional administrative "Class Owner" within the Agora ecosystem.

## 1. Objective
Enable Form Teachers (Homeroom Teachers) to have primary oversight of their assigned students' academic, behavioral, and administrative lifecycle, independent of their specific subject assignments.

## 2. Dashboard Enhancements: "My Form" View
A dedicated section in the Teacher Dashboard for Form Teachers that provides holistic class oversight:
- **Class Health Snapshot**: Real-time attendance percentage, average grade across all subjects, and recent behavioral flags.
- **Unified Gradebook Access**: Read-only (or comment-only) access to the performance of form students in subjects taught by other teachers.
- **Direct Messaging**: Broadcast channel to all parents of students in that specific Form.
- **Student Profiles**: Quick access to health information, sibling details, and emergency contacts for every student in their class.

## 3. Workflow & Notification Integration
The Form Teacher must be kept in the loop for all major student life events:
- **Student Reassignment Workflow**: 
    - When a student is moved **out** of their class, the source Form Teacher must receive a notification.
    - When a student is moved **into** their class, the target Form Teacher must be notified.
    - **Approval vs. Informed**: 
        - *Standard Flow*: Form Teachers are "Informed" (Reviewer role).
        - *Advanced Flow*: Schools can enable "Form Teacher Acknowledge" where a move is pending until the target teacher acknowledges readiness.
    - *Benefits*: Prevents administrative "surprises" and ensures teachers have prepared seating and materials for new arrivals.
- **Inter-Teacher Communication**: Automatic notification when a Subject Teacher flags/merits a student in their form.
- **Attendance Alerts**: Automatic notification if a student is absent for more than X consecutive days.

## 4. Security & Permissions
- **Contextual Elevation**: A teacher assigned as a "Form Teacher" should automatically receive elevated "Read" permissions for student-related resources within that specific Class Arm, even if they don't have global administrative roles.
- **Audit Logging**: All administrative actions performed by a Form Teacher (e.g., final report card remarks) should be logged under their specific role context.

## 5. Implementation Roadmap
### Phase 1: Notifications
- Integrate Form Teacher lookups into the `reassignStudent` service.
- Trigger in-app and email notifications to both source and target Form Teachers during class movements.

### Phase 2: Teacher Dashboard Update
- Implement a "My Class" tab in the Teacher UI.
- Fetch and display the student list for the class where the current user is recorded as a Form Teacher.

### Phase 3: Pastoral Tools
- Add "Form Teacher's Remarks" field to the results/report card generation pipeline.
- Implement specialized attendance views for daily registration.
