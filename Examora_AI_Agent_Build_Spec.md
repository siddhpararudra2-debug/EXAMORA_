# Examora — Build Specification for Coding Agent

**Purpose of this document:** this is the single source of truth to hand to an AI coding agent (Claude Code or equivalent) working on `siddhpararudra2-debug/EXAMORA_`. It covers everything that must be done, everything currently missing that should exist, and every decision that would otherwise require the agent to guess. Where this document makes a judgment call instead of leaving something open, treat that call as final unless the human owner (Hiren) overrides it — do not silently re-decide it differently.

This document is written to be read top-to-bottom once, then used as a reference during work. Section 3 ("Mandatory Step 0") must be executed before any other task, no exceptions.

---

## 1. Non-negotiable ground rules

These override any instinct to "improve while you're in there." Violating any of these is a failed task even if the feature works.

1. **Never guess a file path, model name, or field name.** If you need to know whether something exists (a component, a route, a Prisma field), open the file and check. This spec gives you the *known-true* facts pulled from the API reference and configs that were verifiable from outside the repo — everything else must be confirmed by reading the actual code before you touch it (see Step 0).
2. **Never invent new naming conventions.** Match what's already there exactly:
   - Prisma models: PascalCase, singular (`Exam`, `Question`, `StudentSession`, `Submission`, `ProctoringEvent`).
   - Prisma fields: camelCase (`durationMinutes`, `totalMarks`, `warningsCount`, `enrollmentNo`).
   - Enum values: SCREAMING_SNAKE_CASE (`DRAFT`, `ACTIVE`, `COMPLETED`, `MCQ`, `TRUE_FALSE`, `SHORT_ANSWER`, `TAB_SWITCH`, `APP_SWITCH`, `MINIMIZE`, `MOBILE_BUTTON`, `AI_OVERLAY`, `DEVTOOLS`, `SCREEN_CAPTURE`, `KEYBOARD_SHORTCUT`).
   - API response envelope: always `{ "status": "success" | "error", "data": {...} }` on success, `{ "status": "error", "message": "...", "errors": [...] }` on failure. Every new endpoint must follow this exactly — no exceptions, no alternate shapes.
   - Route prefix conventions: teacher/exam-authoring routes live under `/api/exams/...`; the one legacy exception is the violation-reporting route, which lives under `/api/v1/exam-session/:token/violation` — do not "fix" this inconsistency by moving it; it's a documented, versioned public contract students' browsers already call. Add new versioned public routes under `/api/v1/...` going forward if they are session-token-authenticated student-facing routes; keep teacher/admin routes under `/api/...` (unversioned) to match the existing pattern.
3. **Every schema change requires a Prisma migration**, never a manual `db push` used as a substitute for a tracked migration once the project has real (non-dev) data. Use `npx prisma migrate dev --name <descriptive_name>` locally, commit the generated migration folder.
4. **Every new or changed API endpoint must have a Zod schema** in `server/validators/`, matching the existing pattern (see `auth.ts` and `exam.ts` referenced in the API doc) — do not validate inline in the controller.
5. **Every state-changing endpoint must check ownership and session state server-side**, per the PRD's own non-functional requirement: "All state-changing operations must validate ownership and session state on the server." No endpoint may trust a client-supplied educator ID or session status.
6. **Do not touch or refactor working code paths** listed in Section 4 ("Verified as solid") unless a task in Section 9 explicitly calls for it. If you notice something you think is a bug in a "solid" path, log it in a `NOTES_FOR_HUMAN.md` file at the repo root instead of fixing it unprompted — the human owner decides whether it's actually a bug.
7. **No gamification (leaderboards, points, streaks, memes, sound effects beyond the existing warning beep) on anything tagged as a proctored `EXAM`.** It is allowed only on the new `PRACTICE_QUIZ` assessment type defined in Section 6. This is a product-positioning rule, not a technical one — do not "helpfully" add a leaderboard to the exam results screen.
8. **Never remove or weaken an existing security control** (rate limits, Zod validation, ownership checks, CSP headers, Helmet config) while implementing a feature. If a new feature seems to require weakening one, stop and write the conflict in `NOTES_FOR_HUMAN.md` instead of proceeding.
9. **Every task below has explicit acceptance criteria.** A task is not done until every acceptance criterion is met and the relevant automated test (unit, API/integration, or E2E — as specified per task) passes. "It renders in the browser" is not sufficient acceptance for anything that touches money-equivalent correctness (grading, scoring, session state, warnings).
10. **Commit granularity:** one logical task (as numbered in Section 9) per commit or small group of commits, with a commit message that references the task ID (e.g. `[P0-2] Fix Vercel BACKEND_URL rewrite config`). Do not batch unrelated tasks into one commit.

---

## 2. Project snapshot (verified facts — trust these)

- **Stack:** Next.js 14 (App Router) + React 18 + TypeScript frontend; Express 4 + Socket.io backend; PostgreSQL 15 via Prisma 5; Redis 7 for Socket.io adapter; FastAPI (Python) AI microservice for document parsing; TensorFlow.js + Blazeface for on-device proctoring; Groq (`llama-3.3-70b-versatile` / `llama3-70b-8192`) for AI question generation and document parsing, both with deterministic fallback when the API key is absent or the call fails.
- **Repo layout** (from the README's own Project Structure section — verify exact contents in Step 0, but paths are correct):
  ```
  app/                      Next.js App Router pages (landing, dashboard, exam/[examId])
  components/                UI + feature components
    proctoring/               useExamLockdown, useAIFaceDetection, ProctoringWrapper, ProctoringTimeline
    exams/                     AI question generator, bulk invite wizards
    ui/                        shadcn/ui primitives
    layout/                    dashboard shell (sidebar, top nav)
  hooks/                      client hooks (use-toast)
  lib/                        client helpers (auth token, socket, utils)
  server/
    controllers/               auth, exams, student routes
    routes/                    REST route definitions
    middleware/                JWT auth, rate limiting, security
    validators/                Zod schemas
    jobs/                      background jobs (auto-submit sweep)
  apps/backend/src/           shared backend modules (proctoring handler, security)
  packages/database/src/      Prisma-backed services (exams, grading)
  prisma/                     Prisma schema + migrations
  services/ai-service/        FastAPI AI service
  e2e/                        Playwright tests
  ```
- **Deployment topology as configured:** Next.js frontend is meant to run separately from the Express+Socket.io backend. `next.config.mjs` rewrites `/api/*` and `/socket.io/*` to `process.env.BACKEND_URL` (falls back to `http://localhost:4000`, which is only valid in local dev). The live Vercel deployment (`examora-delta.vercel.app`) currently has no confirmed working `BACKEND_URL`, which is Task P0-1.
- **Data model (confirmed via API reference — treat as ground truth for these fields, extend rather than rename):**
  - `User` (teacher): `id`, `name`, `email`, `password` (hashed), `createdAt`.
  - `Exam`: `id`, `title`, `description?`, `durationMinutes`, `totalMarks`, `status` (`DRAFT | ACTIVE | COMPLETED`), owner relation to `User`, `questions[]`, `sessions[]`.
  - `Question`: `id`, `type` (`MCQ | TRUE_FALSE | SHORT_ANSWER`), `questionText`, `options[]?` (required for MCQ ≥2, exactly 2 for TRUE_FALSE), `correctAnswer`, `marks`.
  - `StudentSession`: `id`, `sessionToken` (UUID), `studentName`, `studentEmail`, `enrollmentNo`, `startedAt`, `warningsCount`, status implied (`ACTIVE | SUBMITTED | TERMINATED`).
  - `Submission`: linked to session, `answers[]` (`questionId`, `answerText`), `score`, `totalMarks`, `submittedAt`.
  - `ProctoringEvent`: `id`, `sessionId`, `eventType` (the 8-value enum above), `timestamp`, `metadata`.
  - Bank questions and email logs exist per the PRD (§8) and README project structure but their exact shape is **not yet confirmed** — confirm in Step 0.
- **Auth:** Teacher = JWT Bearer token. Student = anonymous session token (UUID), passed as `?sessionToken=`, `x-session-token` header, or in body depending on route; the violation route uses it as a Bearer token specifically.
- **Realtime:** Socket.io rooms, one per exam. Events: `join_exam_room`, `student_status_update`, `exam_terminated`, `proctoring_error`, `teacher_join_exam_room`/`teacher_leave_exam_room` (teacher JWT required in handshake, owner-only), `exam_room_joined`.
- **Rate limits (existing, do not change without a task saying so):** global `/api/*` 100/min/IP, `/api/auth/*` 15/15min/IP, `/api/exams/:id/join` 10/min/IP.

---

## 3. Mandatory Step 0 — repo audit (run before any other task)

Do this first, every time you start a fresh session on this project, even if you believe you already know the state from a previous session.

1. Open and read in full: `prisma/schema.prisma`, `next.config.mjs`, `package.json`, `server/app.ts` (or equivalent entrypoint), `server/routes/*`, `server/validators/*`, `.env.example`, `docs/API_REFERENCE.md`, `README.md`.
2. For every feature listed in Section 4 ("claimed as solid") and Section 5 ("claimed as missing or broken") below, actually check the code and mark it as one of: **CONFIRMED PRESENT AND WORKING**, **PRESENT BUT INCOMPLETE** (describe exactly what's missing — e.g. "API route exists, no frontend page calls it"), or **CONFIRMED ABSENT**. Write this as `AUDIT_RESULTS.md` at the repo root before writing any feature code. This file is the actual task list going forward — Section 9 of this spec tells you *what to build if the audit says it's missing*, it does not assume the audit's outcome.
3. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:api` (against a real local Postgres — use `docker compose up -d` first) and record pass/fail in `AUDIT_RESULTS.md`. Do not proceed to write new features on top of a codebase with failing existing tests — fix those first (Task P0-5) or explicitly flag why you're deferring them.
4. Confirm whether `.github/workflows` contains a real CI pipeline and whether it's green. If it exists and passes, wire the README badges to it for real (Task P0-4). If it doesn't exist, create a minimal one (lint + typecheck + unit tests on push) as part of P0-4.

---

## 4. Claimed as solid — verify, do not rebuild

The previous audit found these implemented correctly. Confirm in Step 0; if confirmed, leave alone unless a specific task in Section 9 says otherwise.

- JWT teacher auth with bcrypt password hashing, per-owner exam isolation.
- Zod validation on every existing route.
- Transactional exam creation (a bad question rolls back the whole exam).
- Rate limiting tiered by route.
- Helmet + CSP headers, `X-Content-Type-Options`, `X-Frame-Options: DENY`.
- Server-side 3-warning termination logic (not just client-side) — but note: the threshold must become configurable per Task P2-3, so this logic needs to read from `Exam.maxWarnings` instead of a hardcoded `3` once that task is done.
- Session reuse on rejoin (same exam + email + enrollmentNo returns the existing session token).
- AI question generation with Groq + deterministic fallback, always HTTP 200.
- On-device proctoring via TensorFlow.js Blazeface — no video leaves the browser by default.

---

## 5. Claimed as missing or broken — this is what Section 9 fixes

1. **Vercel deployment is non-functional end-to-end** — `BACKEND_URL` not confirmed set; Socket.io not confirmed reachable in production.
2. **Landing page copy describes WebRTC live video streaming**, which contradicts the actual (and correct) on-device, no-video-upload architecture.
3. **README status badges are static images**, not wired to real CI.
4. **README screenshots are placeholders.**
5. **Educator onboarding / first-run empty states** — not confirmed to exist; PRD explicitly flags this gap.
6. **Question bank reuse UI** — API route may exist; UI wiring unconfirmed.
7. **Document import review screen** — parsing endpoint exists; a review/edit-before-import UI step is required by EXAM-08 and is unconfirmed.
8. **PDF scorecard generation and download** — `pdf-lib` is a dependency; UI wiring and exact endpoint unconfirmed.
9. **Bulk email invite UI** — backend endpoint exists (`POST /api/exams/:examId/invite-bulk`); frontend wizard unconfirmed.
10. **AI-assisted subjective grading rationale + educator-editable override** — required by GRADE-07; not confirmed present at all.
11. **Configurable per-exam warning threshold** — currently hardcoded at 3 system-wide per the API doc's `"maxWarnings": 3` in the violation response; PRD requires this be configuration, not hidden logic.
12. **AI-generated question mandatory human review gate before publish** — PRD leaves this as an open decision; this spec resolves it (Section 6) and it needs implementing.
13. **Retention policy for student identity/answers/violations** — PRD leaves this open; this spec resolves it (Section 6) and it needs implementing as a background job.
14. **Take-home / async assessment mode** — does not exist; new feature (Section 6, Phase 4).
15. **Practice quiz mode with instant feedback and optional gamification** — does not exist; new feature (Section 6, Phase 4), strictly scoped away from `EXAM` type per ground rule 7.
16. **Item-level analytics on the Results screen** (per-question correctness rate / difficulty) — not confirmed to exist; new feature (Section 6, Phase 3).
17. **Mobile-width verification** for dashboard and student test-taking screen — PRD's own acceptance criteria require no horizontal overflow at mobile width; not verified.

---

## 6. Canonical decisions (resolves every ambiguity a coding agent could otherwise get stuck on)

These are final decisions, not options to re-litigate mid-task.

### 6.1 Warning threshold
- Add `maxWarnings Int @default(3)` to the `Exam` model.
- Exam creation/edit Zod schema gets an optional `maxWarnings: z.number().int().min(1).max(10).default(3)`.
- The violation endpoint (`POST /api/v1/exam-session/:token/violation`) must read `exam.maxWarnings` instead of a hardcoded `3`, and the response's `maxWarnings` field must reflect the actual per-exam value.
- Exam editor UI: an optional "Integrity strictness" field, default 3, editable 1–10, with helper text: "Session ends automatically after this many recorded warnings."

### 6.2 AI-generated question review gate
- Add `aiGenerated Boolean @default(false)` and `educatorReviewed Boolean @default(false)` to the `Question` model.
- Any question created via `/api/exams/generate-questions` or `/api/exams/parse-document` is inserted (or staged — see 6.3) with `aiGenerated: true, educatorReviewed: false`.
- Manually authored questions get `aiGenerated: false, educatorReviewed: true` (a human wrote it, no review gate needed).
- **Publish validation** (`POST /api/exams/:id/publish`) must reject with `400` and a clear message (`"N AI-generated question(s) have not been reviewed. Review them before publishing."`) if any question on the exam has `aiGenerated: true && educatorReviewed: false`.
- The exam editor must let an educator mark a question reviewed (e.g., an explicit "Approve" action per AI-sourced question, or opening it in the editor and saving auto-marks it reviewed). Editing any field of an AI-generated question sets `educatorReviewed: true`.

### 6.3 Document import review flow
- `POST /api/exams/parse-document` continues to return parsed questions in the response body — it must **not** write anything to the database directly. It is a preview-only endpoint.
- The frontend document-import wizard must show the parsed questions in an editable table (question text, type, options, correct answer, marks — all editable inline), with per-question include/exclude checkboxes, before calling the existing `POST /api/exams` (or an "append questions to existing draft" endpoint — see 6.6) with the reviewed set.
- Every question that arrives via this path gets `aiGenerated: true, educatorReviewed: true` once the educator has actually reviewed it in this screen (the act of passing through this screen and hitting "Add to exam" counts as review — do not require a second separate approval step for the same content).

### 6.4 Retention policy
- **Violation event metadata** (the `metadata` JSON field on `ProctoringEvent`, which may contain detailed browser/device signals): purge after **90 days** from the exam's completion date (`status = COMPLETED` or exam `durationMinutes` window fully elapsed for all sessions). Keep the row's `eventType` and `timestamp` (needed for aggregate warning counts and any future audit), null out `metadata`.
- **Student identity fields** (`studentName`, `studentEmail`, `enrollmentNo`) and **answer text**: retained indefinitely until the owning educator explicitly deletes the exam (existing `DELETE /api/exams/:id` cascade already handles this) — **no automatic purge** for MVP. Do not build an auto-purge job for identity/answers; only for violation metadata as specified above.
- Implement the 90-day metadata purge as a scheduled job in `server/jobs/` (same location as the existing auto-submit sweep), run daily. Add a migration-safe `purgedAt DateTime?` field to `ProctoringEvent` if you want to make purges idempotent and auditable (recommended).
- Add one line to the platform's privacy copy (wherever proctoring/privacy is currently explained to students) stating the 90-day metadata retention, per PRD §9's requirement to "clearly state how signals are used."

### 6.5 Assessment modes (resolves the take-home / practice-quiz features)
- Add an enum `AssessmentType { EXAM, PRACTICE_QUIZ }` and a field `assessmentType AssessmentType @default(EXAM)` on `Exam`.
- Add an enum `DeliveryMode { LIVE, TAKE_HOME }` and a field `deliveryMode DeliveryMode @default(LIVE)` on `Exam`. `TAKE_HOME` is only valid when `assessmentType = EXAM` (a practice quiz doesn't need this distinction — treat `PRACTICE_QUIZ` as always self-paced within its own availability window, don't apply `deliveryMode` to it).
- `TAKE_HOME` exams get two new nullable fields: `availableFrom DateTime?`, `availableUntil DateTime?`. The student join flow (`GET /api/exams/:id/status`) must reject joins outside this window with a `400` and a message stating the window, instead of the current binary DRAFT/ACTIVE check alone.
- `PRACTICE_QUIZ`:
  - Proctoring lockdown (`ProctoringWrapper`, tab-switch tracking, warnings, termination) is **disabled entirely** — do not even mount the proctoring hooks for this type.
  - Add `instantFeedback Boolean @default(false)` on `Exam`; when true, the student sees correct/incorrect immediately after each answer (objective types only — `SHORT_ANSWER` still queues for review since it isn't auto-gradable).
  - Gamification (points, a simple post-quiz score reveal with a lightweight celebratory state) is allowed **only** here, per ground rule 7. Keep it minimal — a score summary and a "nice work" state is enough; do not build a leaderboard system unless a future task explicitly asks for one.
- Exam creation wizard: add an assessment-type selector as the very first step ("Proctored Exam" vs "Practice Quiz"), since it changes which subsequent fields are shown (delivery mode + window fields only appear for `EXAM`; instant-feedback toggle only appears for `PRACTICE_QUIZ`).

### 6.6 New/changed API endpoints needed (exact contracts)

All follow the existing `{ status, data }` / `{ status, message, errors? }` envelope. All teacher endpoints require `Authorization: Bearer <JWT>` and owner-only access exactly like existing exam routes.

**`GET /api/exams/:id/analytics`** — item-level analytics, teacher JWT, owner only.
```
Response 200:
{
  "status": "success",
  "data": {
    "examId": "...",
    "totalSessions": 42,
    "submittedSessions": 39,
    "averageScorePercent": 71.4,
    "questions": [
      {
        "questionId": "...",
        "questionText": "...",
        "correctCount": 30,
        "incorrectCount": 9,
        "unansweredCount": 0,
        "correctRatePercent": 76.9
      }
    ]
  }
}
```

**`PATCH /api/exams/:examId/sessions/:sessionId/grade`** — manual educator override on a submission's score, teacher JWT, owner only. Used for subjective grading review (GRADE-07).
```
Request:
{ "finalScore": 8, "gradingNote": "Partial credit for correct method, wrong final answer." }

Response 200:
{
  "status": "success",
  "data": {
    "sessionId": "...",
    "aiSuggestedScore": 6,
    "finalScore": 8,
    "gradingNote": "...",
    "gradedBy": "educator"
  }
}
```
Requires new `Submission` fields: `aiSuggestedScore Int?`, `aiRationale String?`, `finalScore Int?`, `gradingNote String?`. When AI subjective grading runs (existing or new grading service for `SHORT_ANSWER`), it must populate `aiSuggestedScore` + `aiRationale` and leave `finalScore` null until an educator confirms or overrides it via this endpoint. The score shown anywhere in the UI as "the" score is `finalScore ?? aiSuggestedScore ?? autoGradedScore` in that priority order — implement this exact fallback chain, do not invent a different priority order.

**`GET /api/questions/bank`** — list the teacher's saved bank questions, teacher JWT.
```
Response 200:
{ "status": "success", "data": { "questions": [ { "id","type","questionText","options","correctAnswer","marks","tags":[] } ] } }
```

**`POST /api/questions/bank`** — save a question to the bank, teacher JWT. Same Zod shape as a single item in the exam-creation `questions[]` array, plus optional `tags: z.array(z.string()).optional()`.

**`POST /api/exams/:id/questions/from-bank`** — attach existing bank questions to a draft exam, teacher JWT, owner only, exam must be `DRAFT`.
```
Request: { "questionIds": ["...", "..."] }
Response 200: { "status": "success", "data": { "exam": { ...exam with nested questions... } } }
```

**`GET /api/exams/:examId/sessions/:sessionId/scorecard.pdf`** — generate and stream a PDF scorecard, teacher JWT, owner only (or a signed-but-unauthenticated variant for the student's own link — decide per 6.7 below).
- Content: student name/email/enrollmentNo, exam title, score/totalMarks/percentage, per-question correctness table, submission timestamp. Use the existing `pdf-lib` dependency.
- Response: `Content-Type: application/pdf`, not the JSON envelope (binary file responses are the one documented exception to rule 1's envelope requirement).

**`POST /api/exams/:examId/sessions/:sessionId/scorecard/email`** — send the scorecard to the student's own email (reuses the existing Nodemailer setup from bulk invite), teacher JWT, owner only.
```
Response 200: { "status": "success", "data": { "sentTo": "student@example.com" } }
```

### 6.7 Student-facing scorecard access decision
Students do not have accounts, so a student cannot "log in" to view their scorecard after the fact. Resolve this by: on the terminal "submitted" screen shown immediately after submission, offer a "Download your scorecard" button that calls the PDF endpoint using the same `sessionToken` the student already holds (add a session-token-authenticated variant of the scorecard route: `GET /api/v1/exam-session/:token/scorecard.pdf`, valid only while the session is `SUBMITTED`, not `TERMINATED` — a terminated session does not get a scorecard, it gets the termination explanation screen instead). Do not build any new login/magic-link system for this — it's out of scope.

---

## 7. Environment variables — canonical full list

Add any of these missing from `.env.example` as part of Task P0-1. Do not introduce a differently-named variable for something already covered here.

| Variable | Required in | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | Postgres connection |
| `REDIS_URL` | backend | Socket.io adapter (optional but strongly recommended in prod) |
| `PORT` | backend | Express port |
| `NODE_ENV` | both | `development` / `production` |
| `FRONTEND_URL` | backend | CORS origin |
| `JWT_SECRET` | backend | Teacher JWT signing |
| `SESSION_SECRET` | backend | Server-side session secret |
| `BACKEND_URL` | frontend (Vercel) | Where `/api/*` and `/socket.io/*` rewrite to — **must be the public URL of the deployed Express service**, not localhost |
| `NEXT_PUBLIC_SOCKET_URL` | frontend | Socket.io client connection target |
| `GROQ_API_KEY` | ai-service + backend | Optional; enables real AI generation/parsing over the fallback |
| `LOCAL_LLM_URL` | ai-service | Optional self-hosted LLM alternative to Groq |
| `AI_SERVICE_URL` | backend | Where the Express `/api/exams/parse-document` proxy sends uploads |
| `SMTP_USER` / `SMTP_PASS` | backend | Gmail SMTP for bulk invite + scorecard emails |
| `TRUST_PROXY` | backend | Rate-limiter proxy header trust, needed behind Nginx/Render/Vercel |
| `ENABLE_REMOTE_MEDIA_SUPERVISION` | backend + frontend | Explicit opt-in flag for any future video-based supervision; **must default to false/unset**, and must never be silently turned on by a feature task in this spec |

---

## 8. Naming & terminology glossary (use exactly these terms everywhere — UI copy, code, comments)

- Say **"on-device AI proctoring"**, never "live video proctoring" or "WebRTC proctoring," anywhere in landing copy, in-app copy, or code comments, unless `ENABLE_REMOTE_MEDIA_SUPERVISION` is on and you are specifically building that opt-in feature.
- Say **"warning"** for a single recorded proctoring event that counts toward termination, and **"violation"** only when referring to the raw `ProctoringEvent` row / API field names that already use that word (`type ProctoringEvent`, the violation endpoint). Do not use "violation" in student-facing UI copy — it presumes guilt, which conflicts with PRD requirement PROC-06 ("avoid asserting guilt automatically"). Student-facing copy says "warning"; backend/API naming stays as `violation` since that's already the shipped contract.
- **"Exam"** = proctored assessment (`assessmentType: EXAM`). **"Quiz"** or **"Practice Quiz"** = the new low-stakes mode (`assessmentType: PRACTICE_QUIZ`). Never call a `PRACTICE_QUIZ` an "exam" in UI copy, and never call an `EXAM` a "quiz" — the distinction is load-bearing for the trust framing in PRD §7.
- **"Educator"** in PRD/spec language = **"Teacher"** in the actual codebase (models, routes, JWT claims all say `teacher`/`User`). Use "Teacher" in code, "Educator" is fine in PRD-facing docs/prose. Do not introduce a third term ("Instructor", "Admin") for this role anywhere.

---

## 9. Phased task list

Execute in this order. Do not start a later phase's tasks before the previous phase's are complete and their acceptance criteria pass, unless a task is explicitly marked "parallelizable."

### Phase 0 — Make the deployment real (blocks everything else being demoable)

**P0-1: Fix production backend reachability.**
- Deploy the Express+Socket.io service (use the existing `render.yaml`) to Render (or the human owner's chosen host) with a managed Postgres and Redis instance attached.
- Set `BACKEND_URL` and `NEXT_PUBLIC_SOCKET_URL` on the Vercel project to point at that deployed backend's public URL.
- Set `FRONTEND_URL` on the backend to the Vercel deployment's public URL (for CORS).
- **Acceptance criteria:** from the live Vercel URL, a fresh browser session can complete the entire PRD §12 acceptance flow (register → create exam → publish → join as student in a second browser/incognito → answer → submit → teacher runs grade-all → teacher views scorecard → teacher views proctoring timeline) with zero console errors and zero failed network requests.
- **Test:** extend `e2e/exam-flow.spec.ts` to optionally run against a `PLAYWRIGHT_BASE_URL` env var pointing at the live deployment, and run it once against production after this task to confirm.

**P0-2: Fix landing page copy.**
- Remove every instance of "WebRTC," "live camera streams," "video feeds," "grid layout" of student video from all marketing copy (`app/(landing)/...`).
- Replace with copy describing the actual on-device proctoring per the glossary in Section 8. Suggested framing: privacy is a selling point, not a limitation — say so explicitly (e.g., "AI proctoring that runs entirely in the student's browser — no camera footage ever touches our servers").
- **Acceptance criteria:** grep the entire `app/` and `components/` tree for the strings `WebRTC`, `webrtc`, `camera feed`, `video stream` (case-insensitive) — zero matches outside of code that is actually behind `ENABLE_REMOTE_MEDIA_SUPERVISION`.

**P0-3: Real screenshots.**
- Using seeded demo data (create a seed script in `prisma/seed.ts` if one doesn't exist — check Step 0 first), capture and commit real screenshots for: landing page, teacher dashboard, exam creation wizard, student join screen, exam-taking screen (proctored), results/scorecard screen. Replace the `*(add screenshot)*` placeholders in `README.md`.
- **Acceptance criteria:** no placeholder text remains in the README's Screenshots section.

**P0-4: Real CI badges.**
- If `.github/workflows` has a working pipeline (confirmed in Step 0), point the README badges at its actual status badge URL. If it doesn't exist or doesn't pass, build a minimal workflow (typecheck + lint + unit tests) first, get it green, then wire the badge.
- **Acceptance criteria:** clicking each badge in the rendered README goes to a real, currently-passing GitHub Actions run.

**P0-5: Fix any failing tests found in Step 0.**
- Before adding new features, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:api`, and `npm run test:e2e` must all pass on `main`. Fix whatever's broken; do not skip or delete failing tests to make this pass — fix the underlying issue, or if a test is testing removed/changed behavior, update the test to match intended behavior and note why in the commit message.
- **Acceptance criteria:** all five commands exit 0 on a clean checkout.

### Phase 1 — Core lifecycle stabilization

**P1-1: Educator first-run onboarding.**
- On first login with zero exams, show a guided empty state on the dashboard: a short checklist ("Create your first exam" → "Publish it" → "Share the join link") instead of a blank exam list. This can be a simple component, not a multi-step tour.
- **Acceptance criteria:** a newly registered teacher account with 0 exams sees this state; a teacher with ≥1 exam sees the normal dashboard.

**P1-2: Unambiguous student warning UI.**
- The student exam-taking screen must show a persistent (not toast-only) warning counter, e.g. "Warnings: 1 / 3" (using the exam's actual `maxWarnings` once P2-3 lands — until then, the current system-wide value), with a visually distinct state change at the final warning before termination (e.g., counter turns red/amber at N-1).
- **Acceptance criteria:** manually trigger 1, then 2, then 3 warnings in a test session and confirm the UI state changes are visible at each step, and the termination screen appears immediately on the 3rd (or `maxWarnings`-th) warning.

**P1-3: "Signal, not verdict" copy audit (PROC-06).**
- Audit every place proctoring events are shown to the teacher (live proctoring grid, candidate timeline) and confirm copy reads as observational ("Tab switch detected at 14:32") not accusatory ("Student cheated"). Add a persistent short disclaimer on the Live Proctoring and candidate-timeline screens: "These are automated signals for your review, not confirmed findings."
- **Acceptance criteria:** the disclaimer text is present and visible without scrolling on both screens; no accusatory language remains (grep for "cheat", "cheating", "fraud" in `components/proctoring/` and fix any hits).

**P1-4: Extend E2E coverage.**
- Add Playwright coverage for: termination at the (default) 3rd warning, and the grading/results view after grade-all. The existing happy-path suite doesn't cover termination per the earlier audit — confirm and fill the gap.
- **Acceptance criteria:** `npm run test:e2e` includes and passes these new scenarios.

### Phase 2 — Close out scaffolded-but-unwired features

**P2-1: Document import review screen.** Per Section 6.3 exactly. New/updated component in `components/exams/`.
- **Acceptance criteria:** uploading a document shows an editable table of parsed questions before anything is persisted; unchecking a question excludes it; editing any field is possible before adding to the exam; nothing is written to the DB until the educator confirms.

**P2-2: Question bank UI.** Build the `GET/POST /api/questions/bank` and `POST /api/exams/:id/questions/from-bank` endpoints per 6.6, plus a picker UI in the exam editor ("Add from bank") and a "Save to bank" action on any question in the editor.
- **Acceptance criteria:** a question saved to the bank from Exam A can be attached to Exam B via the picker; attaching does not mutate the original bank question (creates a new `Question` row linked to Exam B, `aiGenerated: false, educatorReviewed: true` since it's already human-authored).

**P2-3: Configurable warning threshold.** Per Section 6.1 exactly, including the migration.
- **Acceptance criteria:** creating an exam with `maxWarnings: 5` results in termination only on the 5th warning, confirmed via API test hitting the violation endpoint 5 times and checking the `terminated` flag only flips true on the 5th call.

**P2-4: AI-generated question review gate.** Per Section 6.2 exactly.
- **Acceptance criteria:** an exam with at least one unreviewed AI-generated question returns `400` on publish with the exact message format given in 6.2; after marking it reviewed (via edit-and-save or explicit approve), publish succeeds.

**P2-5: PDF scorecard + email delivery.** Per Section 6.6 (`scorecard.pdf` and `scorecard/email` endpoints) and 6.7 (student-facing token-authenticated variant). Wire "Download PDF" and "Email to student" buttons into the teacher's results screen, and "Download your scorecard" into the student's post-submission screen.
- **Acceptance criteria:** downloaded PDF opens and shows correct score/question breakdown matching the DB; email delivery test uses the existing mocked-Nodemailer pattern from the bulk-invite tests.

**P2-6: Subjective grading rationale + override.** Per Section 6.6 (`PATCH .../grade`), including the `Submission` model fields and the exact score-priority fallback chain (`finalScore ?? aiSuggestedScore ?? autoGradedScore`).
- **Acceptance criteria:** a `SHORT_ANSWER` submission graded by the AI grading path shows both the AI's suggested score and rationale in the teacher UI, editable; saving an override updates `finalScore` and the results/scorecard everywhere reflect the override, not the AI suggestion.

**P2-7: Bulk invite UI polish.**
- Add a downloadable CSV template button, and change the invite result display from an aggregate count to a per-row success/failure table (the API's `errors[]` array already supports this — just surface it).
- **Acceptance criteria:** uploading a CSV with one malformed row shows that specific row's error inline, not just a generic failure count.

### Phase 3 — Analytics

**P3-1: Item-level analytics.** Build `GET /api/exams/:id/analytics` per 6.6 and a results-screen panel showing per-question correct-rate, sorted worst-to-best so the teacher immediately sees which questions tripped up the most students.
- **Acceptance criteria:** analytics numbers match a manual count against seeded test data for at least one exam with ≥3 questions and ≥3 submitted sessions.

### Phase 4 — New assessment modes (only after Phases 0–3 are done and stable)

**P4-1: Take-home / async delivery mode.** Per Section 6.5 (`deliveryMode`, `availableFrom`, `availableUntil`).
- **Acceptance criteria:** a `TAKE_HOME` exam rejects joins outside its window with a clear message including the window times; joins inside the window behave identically to a `LIVE` exam otherwise (same proctoring, same timer-per-session-once-started behavior — the window governs *joining*, not a shared clock across all students).

**P4-2: Practice quiz mode.** Per Section 6.5 (`assessmentType: PRACTICE_QUIZ`, `instantFeedback`), including disabling proctoring hooks entirely for this type and the scoped-only gamification per ground rule 7.
- **Acceptance criteria:** a `PRACTICE_QUIZ` session never mounts `ProctoringWrapper`/`useExamLockdown`/`useAIFaceDetection` (confirm via a test asserting the relevant hooks are not called, e.g. by checking no `MediaDevices.getUserMedia`/camera-permission prompt fires for this mode); with `instantFeedback: true`, the student sees correct/incorrect immediately after each MCQ/TRUE_FALSE answer, with no such reveal for `SHORT_ANSWER`.

---

## 10. Mobile-width verification (run once after Phase 1, and again after Phase 4)

Test at 375px and 414px viewport widths (iPhone SE / standard) on: teacher dashboard, exam editor, live proctoring grid, results screen, student join screen, student exam-taking screen. **Acceptance criteria:** no horizontal scrollbar/overflow on any of these at either width; the dashboard sidebar collapses to a drawer per the PRD's own requirement; all primary actions remain reachable without horizontal scrolling.

---

## 11. Global Definition of Done (applies to every task above)

A task is only complete when **all** of the following are true:
1. The specific acceptance criteria listed under that task pass.
2. `npm run typecheck` and `npm run lint` pass with no new errors.
3. Relevant automated tests (unit/API/E2E as specified) pass, and were actually added/extended if the task involved new logic — not just manually verified once and left untested.
4. No ground rule in Section 1 was violated.
5. If the task touched the data model, a Prisma migration was created and committed, not just a local schema edit.
6. If the task changed or added an API contract, `docs/API_REFERENCE.md` was updated to match exactly — this file must never drift from reality.
7. The commit message references the task ID from Section 9.

---

## 12. Explicitly out of scope — do not build these unless a future revision of this spec adds them

- Any form of program-administrator / multi-tenant organization role (PRD names this as intentionally post-MVP).
- Real video-based remote supervision (`ENABLE_REMOTE_MEDIA_SUPERVISION` path) — flag stays off; do not build the feature behind it speculatively.
- Any login/account system for students.
- Leaderboards, streak mechanics, or badges anywhere in the `EXAM` assessment type.
- Migrating off Prisma/Postgres, or off Socket.io, as part of any task in this document — if Socket.io reliability on the chosen host becomes a real problem after Phase 0, that's a separate decision for the human owner, not something to solve proactively here.
- Rebranding, renaming the product, or changing the "Educator"/"Teacher" terminology split described in Section 8.

---

## 13. If you hit something this document doesn't cover

Do not guess and do not silently make a product decision. Write the open question plainly into `NOTES_FOR_HUMAN.md` at the repo root (create it if absent) with: what you were doing, exactly what's ambiguous, and the options you see. Then either skip to the next task that isn't blocked by it, or stop and surface it, whichever leaves the codebase in a working, tested state.
