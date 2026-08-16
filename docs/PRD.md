# Examora — Product Requirements Document

**Document status:** Product baseline and implementation guide  
**Version:** 1.0  
**Author:** Manus AI  
**Date:** 17 August 2026  
**Repository:** [siddhpararudra2-debug/EXAMORA_](https://github.com/siddhpararudra2-debug/EXAMORA_)

## 1. Product Summary

Examora is a secure online assessment platform for educators, universities, and training teams. It combines exam authoring, AI-assisted question generation, anonymous student access, browser-side integrity monitoring, live supervision, automatic grading, and result distribution in one workflow.

The product has two deliberately different experiences. **Educators** use an authenticated command center to create, publish, supervise, grade, and distribute assessments. **Students** use a low-friction join flow that does not require an account: they enter an exam PIN or link, provide identity details, complete the assessment, and receive a clear submission outcome. This role separation is reflected in the current route structure, API contract, and database model.[1][2]

> **Product promise:** Create a rigorous assessment in minutes, run it with visible integrity controls, and turn submissions into useful scorecards without spreadsheet work.

## 2. Problem Statement

Educators currently assemble online exams across disconnected tools: a document editor for questions, a form or learning-management system for delivery, a video call for supervision, and spreadsheets or scripts for grading. The resulting workflow is slow, difficult to audit, and especially fragile during live assessments. Students also experience unnecessary friction when joining an exam, while educators lack a single view of candidate progress, warnings, submissions, and results.

Examora addresses this by providing one assessment lifecycle: **draft → publish → join → supervise → submit → grade → distribute**. The system must remain understandable to educators who are not technical administrators and must preserve a simple, anonymous entry path for students.

## 3. Goals and Non-Goals

### 3.1 Goals

| Goal | Definition of success |
|---|---|
| Reduce exam setup time | An educator can create a complete draft manually or with AI assistance, review it, and publish it without leaving Examora. |
| Improve assessment integrity | The platform records relevant browser and proctoring events, surfaces warnings in real time, and terminates a session after the configured warning threshold. |
| Remove student account friction | A student can join an active exam using a shared link or PIN and identity fields without creating a platform account. |
| Accelerate grading | Objective answers are graded automatically, while subjective answers can be reviewed or supported by AI workflows. |
| Make results actionable | Educators can inspect exam-level results, open a candidate timeline, generate scorecards, and distribute results in bulk. |
| Keep the system deployable and affordable | The core product should run with open-source infrastructure and optional AI services, as described by the repository setup. |

### 3.2 Non-Goals for the first release

Examora will not attempt to replace a full learning-management system, manage course enrollment or attendance, provide a marketplace for exams, or guarantee that automated proctoring can determine academic misconduct without human review. Video and device signals are evidence for educator review, not an autonomous disciplinary decision.

## 4. Target Users and Personas

### Educator / Assessment Owner

An instructor, professor, instructional designer, or training manager who needs to produce and run assessments for a class or cohort. This user values speed, control over question quality, a clear live status view, and exportable results. They own the exam and are the only role permitted to publish, monitor, grade, delete, or distribute its results.

### Student / Candidate

A learner who receives an exam link or PIN. The student may be using a laptop under time pressure and should not need to understand the platform’s backend. They need clear instructions, a visible timer, predictable navigation, an understandable warning state, and a definitive submission or termination result.

### Program Administrator — future role

An institution-level operator who may eventually manage multiple educators, retention policies, shared templates, and organization-level reporting. This role is intentionally outside the MVP and should not complicate the first-run educator experience.

## 5. Core User Journeys

### 5.1 Educator creates and publishes an exam

The educator registers or signs in, selects **Create Assessment**, and chooses between manual authoring, AI generation from a topic, importing a document, or selecting questions from a bank. They configure title, instructions, duration, total marks, question types, answer keys, and marks. The system validates the exam, saves it as a draft, and presents a review state. The educator publishes only when the exam has at least one valid question and a complete scoring configuration. Publishing transitions the exam from `DRAFT` to `ACTIVE`.[2]

### 5.2 Student joins and completes an exam

The student opens a shared join link or the public join portal, enters the exam identifier, and sees the exam title, duration, and participation requirements. After submitting name, email, and enrollment number, the system creates or reuses an anonymous session token. The student enters the exam, answers questions, and sees remaining time. Browser focus changes and other configured events are recorded. The student may submit manually; if time expires, the platform auto-submits the saved answers. A session that reaches the warning threshold is terminated and shown a dedicated termination state.[2]

### 5.3 Educator supervises a live exam

The educator opens **Live Proctoring**, selects an active exam, and views candidate cards with session status, question progress, warning count, and recent events. Realtime status changes arrive through the exam room. The educator can open a candidate’s proctoring timeline to understand why a warning or termination occurred. The interface must distinguish “signal recorded” from “confirmed misconduct.”

### 5.4 Educator grades and distributes results

After submissions arrive, the educator opens the results area, runs grading for eligible sessions, reviews score summaries, and optionally adjusts subjective marks. The educator can open a candidate scorecard, generate a PDF, and send results through bulk email. Completed exams become read-only for publishing purposes, while result review remains available.

## 6. Functional Requirements

### 6.1 Authentication and access control

| ID | Requirement | Priority |
|---|---|---|
| AUTH-01 | The system shall support educator registration with name, email, and password validation. | Must |
| AUTH-02 | The system shall support educator sign-in, sign-out, and session persistence through a signed token. | Must |
| AUTH-03 | The system shall isolate each educator’s exams and candidate data by owner. | Must |
| AUTH-04 | The system shall provide password recovery and reset flows. | Should |
| AUTH-05 | Student access shall use an anonymous exam session token rather than a platform account. | Must |

### 6.2 Exam authoring

| ID | Requirement | Priority |
|---|---|---|
| EXAM-01 | Educators shall create an exam with title, description, duration, total marks, status, and one or more questions. | Must |
| EXAM-02 | The authoring flow shall support multiple-choice, true/false, and short-answer questions. | Must |
| EXAM-03 | The system shall validate option counts, correct answers, marks, and required text before saving or publishing. | Must |
| EXAM-04 | Educators shall be able to save incomplete work as a draft and return to edit it. | Must |
| EXAM-05 | Educators shall be able to publish a valid draft and share a student join link or exam identifier. | Must |
| EXAM-06 | Educators shall be able to delete an exam with explicit confirmation and clear cascade consequences. | Must |
| EXAM-07 | Educators shall be able to generate questions from a topic with configurable count, difficulty, and question type. | Should |
| EXAM-08 | Educators shall be able to upload a supported document and review parsed questions before importing them. | Should |
| EXAM-09 | Educators shall be able to reuse questions from a question bank. | Should |

### 6.3 Student assessment experience

| ID | Requirement | Priority |
|---|---|---|
| STUD-01 | The public join flow shall show whether an exam exists and is currently active before collecting student details. | Must |
| STUD-02 | The student shall enter name, email, and enrollment number with inline validation. | Must |
| STUD-03 | The system shall reuse an existing session for the same exam, email, and enrollment combination where applicable. | Must |
| STUD-04 | The student shall see one question at a time or a clearly segmented question list with progress and remaining time. | Must |
| STUD-05 | The student shall be able to navigate without losing answers already entered. | Must |
| STUD-06 | The platform shall prevent access to answer keys from the student payload. | Must |
| STUD-07 | The system shall submit answers transactionally and prevent duplicate submission. | Must |
| STUD-08 | The system shall show dedicated states for already completed, times up, not found, and terminated sessions. | Must |

### 6.4 Proctoring and integrity signals

| ID | Requirement | Priority |
|---|---|---|
| PROC-01 | The browser shall record configured integrity events such as tab switch, app switch, minimize, keyboard shortcut, and screen capture attempts where detectable. | Must |
| PROC-02 | The system shall maintain a warning count per student session and display it clearly to the student. | Must |
| PROC-03 | The default policy shall terminate a session on the third recorded warning, with the threshold treated as configuration rather than hidden business logic. | Must |
| PROC-04 | The educator live view shall receive status updates through a realtime channel. | Must |
| PROC-05 | The educator shall be able to inspect the chronological event timeline for a session. | Must |
| PROC-06 | The UI shall explain that proctoring events are review signals and shall avoid asserting guilt automatically. | Must |
| PROC-07 | Face detection or other device-side AI may be enabled only with explicit student notice and should fail safely when unavailable. | Should |

### 6.5 Grading and results

| ID | Requirement | Priority |
|---|---|---|
| GRADE-01 | The system shall auto-grade objective question types using the stored answer key. | Must |
| GRADE-02 | The system shall expose score, total marks, percentage, question-level correctness, and submission time. | Must |
| GRADE-03 | Educators shall be able to run grading across all eligible submitted sessions. | Must |
| GRADE-04 | Educators shall be able to inspect results by exam and by student session. | Must |
| GRADE-05 | The system shall generate a downloadable scorecard suitable for sharing with a student. | Should |
| GRADE-06 | The system shall support bulk result email with per-student join or scorecard information. | Should |
| GRADE-07 | AI-assisted subjective grading, when enabled, shall show its rubric or rationale and remain editable by the educator. | Should |

## 7. Information Architecture and UX Requirements

The public surface should lead with two clear actions: **Start as Educator** and **Join Exam as Student**. The authenticated surface should use a persistent sidebar on desktop and a drawer on mobile. The primary navigation should remain stable across dashboard, exams, live proctoring, and results.

| Surface | Primary content | Primary action |
|---|---|---|
| Marketing home | Product value, platform capabilities, workflow, trust and integrity framing | Start as Educator / Join Exam |
| Educator dashboard | Assessment metrics, exam directory, live status, quick command center | Create Assessment |
| Exam editor | Exam metadata, question authoring, AI/import tools, validation summary | Save Draft / Publish |
| Live proctoring | Candidate status grid, warnings, connection state, recent events | Open candidate timeline |
| Results | Gradebook, distributions, candidate scorecards, distribution tools | Grade All / Export / Email |
| Student join | Exam lookup, identity fields, requirements | Start Exam |
| Student test | Timer, question content, answer controls, progress, warning banner | Save / Submit |
| Terminal states | Clear reason, next safe action, support guidance | Return to join or close |

The visual language should remain calm and trustworthy rather than punitive. The existing product direction uses an indigo-to-blue gradient, slate surfaces, glass-like cards, emerald live states, and compact data-dense controls. The implementation should preserve that hierarchy while ensuring sufficient contrast, visible focus states, responsive layout, and reduced-motion support.

## 8. Data and API Requirements

The product must preserve the existing domain entities: educators, exams, sections, questions, exam sessions, answers, violations, email logs, and bank questions. API responses should use consistent success and error envelopes. Teacher endpoints must require a valid educator token; student endpoints must require a valid anonymous session token where a session is needed.[2]

All state-changing operations must validate ownership and session state on the server. Exam creation and submission should be transactional. A completed or terminated student session must not accept another submission. The client may use demo or fallback data for presentation resilience, but it must not present fallback data as persisted production data without a clear environment distinction.

## 9. Non-Functional Requirements

### Security and privacy

The platform shall use secure password hashing, rate limits on authentication and join routes, ownership checks on educator endpoints, validation of uploaded file types and sizes, and safe error messages in production. Student answers and proctoring events are sensitive educational data; the product should minimize retention, restrict access to the owning educator, and clearly state how signals are used. Video or camera data should remain on the student device unless a future consented feature explicitly changes that boundary.

### Reliability and performance

The dashboard should render a usable shell quickly, show component-level loading states, and avoid blocking the entire page on a single failing API request. Live status updates should degrade to a last-known state with a visible connection indicator. Exam answers should remain available locally during transient network interruptions and reconcile safely when connectivity resumes, subject to the server’s session state.

### Accessibility and responsive behavior

All primary flows must be keyboard navigable, use semantic labels, provide visible focus indicators, and maintain readable contrast. The student flow must work on common laptop and tablet widths. The educator dashboard must collapse navigation on small screens without hiding critical actions.

## 10. Success Metrics

| Metric | Initial target | Measurement point |
|---|---:|---|
| Educator first-exam completion | ≥ 70% of new educators create or import a draft | From registration to first saved draft |
| Publish success | ≥ 60% of created drafts reach active status | From first draft to publish |
| Student join completion | ≥ 90% of valid join attempts enter the exam | From join form submit to test view |
| Submission reliability | ≥ 98% of started sessions end in submitted or explicitly terminated state | Session lifecycle |
| Grading turnaround | ≥ 80% of objective submissions graded within 60 seconds of educator action | Grade-all workflow |
| Live supervision clarity | ≥ 85% of pilot educators can identify a candidate with a warning without assistance | Usability test |
| Critical error rate | 0 unhandled authorization bypasses or cross-owner data leaks | Automated and manual security tests |

These are product targets for validation rather than claims about current production performance.

## 11. MVP Release Scope

The MVP release includes educator authentication, exam CRUD, draft-to-active publishing, manual question authoring, topic-based question generation with fallback behavior, public student join, anonymous sessions, timed assessment, transactional submission, browser integrity events, three-warning termination, live candidate status, objective grading, results review, and responsive dashboard navigation.

Document parsing, bulk invites, question banks, PDF scorecards, email delivery, and AI-assisted subjective grading are valuable extensions already represented in the repository and should be treated as high-priority post-MVP capabilities unless they are required for a target deployment.

## 12. Acceptance Criteria

The release is acceptable when an educator can register, create a valid assessment with at least one question, save it as a draft, publish it, and retrieve its join path. A student can join that active assessment without creating an educator account, answer questions, submit once, and see a terminal outcome. The educator can see the session in results, run objective grading, inspect the score, and open a chronological proctoring timeline.

The release must also demonstrate that invalid exams are rejected without partial persistence, an unauthorized educator cannot access another educator’s exam, a session cannot submit after termination or prior submission, and a third warning produces the documented termination state. At mobile width, the same core journeys must remain navigable without horizontal overflow.

## 13. Roadmap

### Now

Stabilize the core assessment lifecycle, finish the educator dashboard and live supervision surfaces, make the student timer and warning states unambiguous, and validate the end-to-end flow with seeded data and automated tests.

### Next

Complete document import review, bulk invitations, PDF scorecards, richer question-bank reuse, and educator-controlled proctoring policy settings. Add better empty states and onboarding so a new educator understands the first action immediately.

### Later

Add organization workspaces, role-based administration, exam templates, analytics across cohorts, accommodations and accessibility settings, auditable rubric-based subjective grading, and institution-level retention policies.

## 14. Open Decisions

The product team should decide whether live supervision means only event/status telemetry or also educator-visible media streams; the current product framing should default to telemetry and explicit consent. The team should also define the retention period for student identity, answers, and violation records, choose whether educators can customize the warning threshold, and establish which AI-generated question fields require mandatory human review before publishing.

## References

[1]: https://github.com/siddhpararudra2-debug/EXAMORA_ "Examora repository"

[2]: https://github.com/siddhpararudra2-debug/EXAMORA_/blob/main/docs/API_REFERENCE.md "Examora API reference"
