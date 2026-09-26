# Notes for Human

This document tracks intentional deviations from the original `Examora_AI_Agent_Build_Spec.md` based on discoveries made in the shipped codebase. Per Ground Rule 6 ("Never touch or refactor working code paths..."), we prioritize the existing working implementation over the strict letter of the spec.

## Schema Deviations

### P2-6 Field Placement (Grading Rationale)
- **Spec:** Dictates placing `aiSuggestedScore`, `aiRationale`, `finalScore`, and `gradingNote` on a `Submission` model.
- **Reality:** There is no `Submission` model. Sessions are tracked via `ExamSession` and answers via `Answer`. Grading is evaluated per-question.
- **Decision:** The fields are placed on the `Answer` model to support per-question editable AI rationale, which matches the existing schema's granularity (e.g., `Answer.marks_awarded`, `needs_review`).

### P2-3 Warning Threshold Config
- **Spec:** Add `maxWarnings` to the `Exam` model.
- **Reality:** The existing implementation relies on a JSON field `settings.warningThreshold`.
- **Decision:** We will make `Exam.maxWarnings` authoritative. We'll implement a fallback reading `settings.warningThreshold` for legacy sessions, but all new writes will use the typed `maxWarnings` column.
- **Naming:** Implemented as `max_warnings` (snake_case) to match every other `Exam` field (`duration_minutes`, `total_marks`, …), against spec §1's camelCase claim which the shipped schema contradicts throughout.
- **Validation:** Zod field is optional (no `.default(3)`) — the default is applied server-side via `resolveMaxWarningsForWrite`, so legacy callers sending only `settings.warningThreshold` keep their policy instead of being reset to 3 on update.

## API Route Deviations

### P2-5 Scorecard Endpoints
- **Spec:** `/scorecard.pdf` and `/scorecard/email`
- **Reality:** The codebase already uses `/marksheet` and `/declare-results` for these exact functions.
- **Decision:** Keep the existing `/marksheet` and `/declare-results` routes to avoid breaking existing integrations.

### P2-2 Question Bank Endpoints
- **Spec:** `/api/questions/bank`
- **Reality:** Shipped code uses `/api/v1/question-bank`.
- **Decision:** Reuse the shipped `/api/v1/question-bank` route.
