# Examora API Reference

Base URL: `http://localhost:4000` (development) or your deployed backend URL.
All JSON endpoints return `{ status: "success" | "error", ... }`.

Authentication:

- **Teacher endpoints** require `Authorization: Bearer <JWT>` (obtained from `/api/auth/login`).
- **Student endpoints** require an anonymous session token — sent as `?sessionToken=` query param, `x-session-token` header, or inside the request body depending on the route.

Rate limits (per IP):

| Route group | Limit |
| --- | --- |
| `/api/*` (global) | 100 requests / minute |
| `/api/auth/*` | 15 requests / 15 minutes |
| `/api/exams/:id/join` | 10 requests / minute |

---

## Auth

### POST `/api/auth/register` — Create teacher account

Zod schema (`server/validators/auth.ts`):

```ts
z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
})
```

Response `201`:

```json
{
  "status": "success",
  "data": {
    "user": { "id": "…", "name": "…", "email": "…", "createdAt": "…" },
    "token": "<jwt>"
  }
}
```

Errors: `400` validation, `409` email already registered, `429` rate limited.

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada","email":"ada@example.com","password":"secret123"}'
```

### POST `/api/auth/login` — Sign in

Zod schema: `{ email: z.string().email(), password: z.string().min(1) }`

Response `200`: same shape as register (`user` + `token`).
Errors: `401` invalid credentials, `429` rate limited.

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"secret123"}'
```

---

## Exams (teacher)

### GET `/api/exams` — List my exams

Auth: Teacher JWT. Returns the teacher's exams with question/session counts.

Response `200`:

```json
{
  "status": "success",
  "data": {
    "exams": [{ "id": "…", "title": "…", "status": "DRAFT", "_count": { "questions": 5, "sessions": 12 } }]
  }
}
```

Errors: `401` missing/invalid token.

### POST `/api/exams` — Create exam with questions

Auth: Teacher JWT. Zod schema (`server/validators/exam.ts`):

```ts
z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  totalMarks: z.number().int().positive(),
  status: z.enum(["DRAFT","ACTIVE","COMPLETED"]).default("DRAFT"),
  questions: z.array(z.object({
    type: z.enum(["MCQ","TRUE_FALSE","SHORT_ANSWER"]),
    questionText: z.string().min(1),
    options: z.array(z.string().min(1)).optional(),
    correctAnswer: z.string().min(1),
    marks: z.number().int().positive(),
  })).min(1),
})
```

- MCQ requires ≥ 2 options; TRUE_FALSE requires exactly 2 options.
- Created inside a transaction — a failed question rolls back the whole exam.

Response `201`: `data.exam` (exam with nested questions, answers excluded).
Errors: `400` validation, `401` unauthorized.

```bash
curl -X POST http://localhost:4000/api/exams \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "title": "Midterm",
    "durationMinutes": 30,
    "totalMarks": 4,
    "questions": [
      { "type":"MCQ", "questionText":"Capital of France?", "options":["Paris","London"], "correctAnswer":"Paris", "marks":2 }
    ]
  }'
```

### POST `/api/exams/:id/publish` — Publish a DRAFT exam

Auth: Teacher JWT (owner only). Transitions `DRAFT → ACTIVE`; idempotent for already-ACTIVE exams.

Response `200`: `{ "data": { "exam": { "id", "status" } } }`
Errors: `403` not the owner, `404` not found, `409` completed exams cannot be republished.

### POST `/api/exams/:id/grade-all` — Grade all submitted sessions

Auth: Teacher JWT (owner only). Runs the auto-grading service on every `SUBMITTED` session.

Response `200`:

```json
{
  "status": "success",
  "data": {
    "message": "1 session(s) graded",
    "gradedSessions": [{ "sessionId": "…", "score": 4, "totalMarks": 4, "correctAnswers": 2, "totalQuestions": 2 }]
  }
}
```

### GET `/api/exams/:examId/sessions/:sessionId/events` — Proctoring event timeline

Auth: Teacher JWT (owner only). Returns all `ProctoringEvent` rows for a session, oldest first.

Response `200`: `{ "status":"success", "data": { "events": [{ "id","sessionId","eventType","timestamp","metadata" }] } }`

### DELETE `/api/exams/:id` — Delete exam

Auth: Teacher JWT (owner only). Cascades to questions, sessions, submissions, proctoring events.

---

## Exams (student — anonymous)

### GET `/api/exams/:id/status` — Is this exam joinable?

Public. Response `200`: `{ "data": { "exam": { "id","title","status" } } }`
Errors: `404` not found.

### POST `/api/exams/:id/join` — Start an anonymous session

Rate limit: 10/min/IP. Zod schema:

```ts
z.object({
  studentName: z.string().min(2),
  studentEmail: z.string().email(),
  enrollmentNo: z.string().min(2),
})
```

- Only `ACTIVE` exams are joinable (others → `400`).
- Joining again with the same email + enrollment reuses the existing session token.

Response `201` (new) / `200` (existing):

```json
{
  "status": "success",
  "data": { "sessionToken": "<uuid>", "studentName": "…", "studentEmail": "…", "enrollmentNo": "…" }
}
```

### GET `/api/exams/:id/student-view` — Fetch questions (no answers)

Public, session-authenticated: `?sessionToken=` or `x-session-token` header.

Response `200`:

```json
{
  "status": "success",
  "data": {
    "exam": { "id","title","description","durationMinutes","totalMarks","questions": [{ "id","questionText","type","options","marks" }] },
    "session": { "id","studentName","startedAt","warningsCount" }
  }
}
```

Errors: `401` invalid token, `403` session already submitted/terminated, `400` exam not active.

### POST `/api/exams/:id/submit` — Submit answers

Zod schema:

```ts
z.object({
  sessionToken: z.string().uuid(),
  answers: z.array(z.object({
    questionId: z.string().min(1),
    answerText: z.string().min(1),
  })).min(1),
})
```

- `questionId`s are validated against the exam; unknown ids → `400`.
- Submissions are written and the session marked `SUBMITTED` in one transaction.

Response `200`: `{ "data": { "message", "submittedAt", "answersRecorded" } }`
Errors: `400` invalid question/session not active/already submitted, `401` bad token.

### POST `/api/v1/exam-session/:token/violation` — Report a proctoring violation

Public, authenticated by the anonymous Bearer session token. Enforces the **3-warning rule**: each violation increments `warningsCount`; at 3 the session is automatically `TERMINATED` and the teacher's live room is notified via Socket.io.

Zod schema:

```ts
z.object({
  type: z.enum(["TAB_SWITCH","APP_SWITCH","MINIMIZE","MOBILE_BUTTON","AI_OVERLAY","DEVTOOLS","SCREEN_CAPTURE","KEYBOARD_SHORTCUT"]),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
```

Response `201`:

```json
{
  "status": "success",
  "data": {
    "violation": { "id": "…", "type": "TAB_SWITCH", "occurred_at": "…" },
    "warningsCount": 2,
    "terminated": false,
    "maxWarnings": 3
  }
}
```

Errors: `400` invalid body, `401` bad token, `403` session already closed / exam inactive.

---

## AI + Email (teacher)

### POST `/api/exams/generate-questions` — AI question generation (Groq free tier)

Auth: Teacher JWT. Zod schema:

```ts
z.object({
  topic: z.string().min(2),
  count: z.number().int().min(1).max(20).optional(),
  difficulty: z.enum(["easy","medium","hard","Easy","Medium","Hard"]).optional(),
  type: z.enum(["MCQ","TRUE_FALSE","SHORT_ANSWER"]).optional(),
})
```

Uses Groq `llama-3.3-70b-versatile` when `GROQ_API_KEY` is set; otherwise (or on API failure) falls back to a built-in generator. Response is always `200` with:

```json
{
  "status": "success",
  "questions": [{ "id","type","questionText","options","correctAnswer","marks" }]
}
```

### POST `/api/exams/:examId/invite-bulk` — Bulk invite students by CSV or JSON

Auth: Teacher JWT (owner only).

- **CSV**: multipart form, field name `file` (columns `Name`, `Email`, `EnrollmentNo` — case-insensitive), max 5 MB.
- **JSON**: body `{ "students": [{ "Name","Email","EnrollmentNo" }] }`.

Creates a `StudentSession` per row (UUID session token) and emails a personalized join link via Nodemailer (Gmail SMTP).

Response `200`:

```json
{
  "status": "success",
  "data": { "total": 2, "successful": 2, "failed": 0, "errors": [] }
}
```

Errors: `400` no file/students or malformed JSON, `403` not the owner, `404` exam not found.

---

## WebSocket (Socket.io)

Endpoint: `/socket.io` — same origin as the API.

| Event | Direction | Payload |
| --- | --- | --- |
| `join_exam_room` | Student → server | `{ sessionToken, examId }` (ack: `{ status }`) |
| `student_status_update` | Server → room | live warning/termination broadcast for teachers |
| `exam_terminated` | Server → student | `{ examId, sessionId, reason, warnings, warningsLimit }` |
| `proctoring_error` | Server → client | `{ message }` |
| `teacher_join_exam_room` / `teacher_leave_exam_room` | Teacher | `{ examId }` (join requires a teacher JWT in the handshake; only the exam owner is admitted) |
| `exam_room_joined` | Server → teacher | `{ examId }` |

---

## Standard error responses

```json
{ "status": "error", "message": "Human-readable message" }
{ "status": "error", "message": "Validation error", "errors": [{ "field": "email", "message": "Invalid email address" }] }
```

| Status | Meaning |
| --- | --- |
| `400` | Validation failure (Zod), bad session state |
| `401` | Missing/invalid teacher JWT or session token |
| `403` | Not the exam owner / forbidden |
| `404` | Resource not found |
| `409` | Conflict (duplicate email, republish completed exam) |
| `429` | Rate limit exceeded |
| `500` | Internal error (generic message in production, stack trace in development) |
