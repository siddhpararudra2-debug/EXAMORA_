# EXAMORA

**Run fair, beautiful online exams — without the overhead.**

Examora is a 100% free and open-source AI-proctored online exam platform. Teachers create assessments in minutes, students join anonymously via a simple link or QR code, and AI monitors the entire session — face presence, gaze direction, and tab-switching — with automatic grading and class-level analytics. No per-seat fees, no vendor lock-in, no dark patterns.

<p>
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" />
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20-339933?logo=node.js" />
  <img alt="Express" src="https://img.shields.io/badge/Express-4-000000?logo=express" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql" />
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma" />
  <img alt="Socket.io" src="https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io" />
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss" />
  <img alt="Playwright" src="https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright" />
  <img alt="TensorFlow.js" src="https://img.shields.io/badge/TensorFlow.js-4-FF6F00?logo=tensorflow" />
  <img alt="Build" src="https://img.shields.io/badge/build-passing-brightgreen" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-jest+playwright-important" />
  <img alt="Coverage" src="https://img.shields.io/badge/coverage-API+unit-9cf" />
  <img alt="Docs" src="https://img.shields.io/badge/docs-API_Reference-blueviolet" />
</p>

> 📖 Full endpoint documentation (Zod schemas, curl examples, error codes): **[docs/API_REFERENCE.md](docs/API_REFERENCE.md)**

---

## Key Features

| Feature | Description |
| --- | --- |
| 🤖 **AI proctoring in the browser** | Blazeface (TensorFlow.js) head & gaze detection runs entirely client-side — no video leaves the student's device. |
| ⚠️ **3-warning beep escalation** | The student hears a beep on every violation (looking away, no face, tab switch). After 3 warnings the session is **automatically terminated** and the teacher is alerted in real time. |
| 🪟 **Tab-switch & visibility tracking** | `visibilitychange` detection flags every attempt to leave the exam window. |
| ⚡ **Instant auto-grading** | MCQs and true/false are graded automatically on submit; short answers are graded with per-question scorecards. |
| 📄 **PDF scorecards** | Per-student results export as clean, printable PDF scorecards. |
| 📱 **QR access & join links** | Students join any exam anonymously with a shareable link or QR code — no account required. |
| 🛡️ **Live proctoring monitor** | Teachers watch active sessions in real time over Socket.io: warnings, terminations, and per-student status. |
| 🎯 **Draft → publish workflow** | Exams stay `DRAFT` until the teacher publishes them; only `ACTIVE` exams can be joined. |
| 📊 **Class-level analytics** | Results and stats across sessions, right in the teacher dashboard. |
| 🧑‍🏫 **Teacher accounts** | JWT-based sign-up / sign-in with per-teacher exam isolation. |
| 🔓 **100% free & open-source** | MIT license. Self-host anywhere — your data stays yours. |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui, react-hook-form + Zod |
| Backend | Node.js, Express 4, Socket.io |
| Database | PostgreSQL 15 via Prisma ORM |
| Cache / pub-sub | Redis 7 (Socket.io adapter for multi-instance scaling) |
| AI proctoring | TensorFlow.js + Blazeface (runs in the browser) |
| Realtime | Socket.io rooms: one room per exam, teacher & student namespaces |
| Testing | Playwright (E2E happy path), ESLint, `tsc --noEmit` |
| Auth | Teacher JWT (API) + Auth.js / NextAuth v5 (session), anonymous student session tokens |
| Infra | Docker Compose (dev & prod), Nginx reverse proxy |

---

## Architecture

```mermaid
flowchart LR
    subgraph Browser
        S[Student - Join link / QR]
        T[Teacher Dashboard]
        P[Proctoring - TensorFlow.js Blazeface]
    end

    subgraph "Next.js App (:3000)"
        APP[App Router pages]
        REW["/api/** rewrites to Express<br/>(/api/auth/login &amp; register too)"]
    end

    subgraph "Express + Socket.io (:4000)"
        API[REST API - /api/exams, /api/auth]
        IO[Socket.io rooms - exam_room]
        AUTH[JWT + session validation]
        GRADE[Grading service]
    end

    subgraph Data
        DB[(PostgreSQL 15)]
        CACHE[(Redis 7 - adapter)]
    end

    S -->|HTTPS / join page| APP
    T --> APP
    P -->|violations: look-away, tab-switch, no-face| S
    S -->|beep x3 → termination| S
    APP --> REW --> API
    T <-->|warnings, status, termination| IO
    S <-->|answers, warnings, status| IO
    IO -->|redis adapter| CACHE
    API --> DB
    GRADE --> DB
    DB -->|Prisma Client| API
```

**Request flow:** the Next.js app serves the UI on `:3000` and proxies every `/api/*` call (including `/api/auth/login` and `/api/auth/register`) to the Express API on `:4000`. Socket.io connects directly for live proctoring events. The database layer (Prisma client + exam/grading services) is shared between the API and server code.

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL + Redis) — or your own Postgres/Redis instances
- npm

### 1. Start the infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL 15 on `:5432` and Redis 7 on `:6379`.

### 2. Configure environment variables

```bash
cp .env.example .env
```

| Variable | Description | Example |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://examora:examora_password@localhost:5432/examora_db?schema=public` |
| `PORT` | Express API / Socket.io port | `4000` |
| `NODE_ENV` | Runtime environment | `development` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3000` |
| `REDIS_URL` | Redis connection string (optional) | `redis://localhost:6379` |
| `JWT_SECRET` | Secret used to sign teacher JWTs | change in production |
| `SESSION_SECRET` | Server-side session secret | change in production |
| `AUTH_SECRET` | Auth.js (NextAuth v5) JWT secret | 32-byte base64 |
| `AUTH_TRUST_HOST` | Trust the host header behind a proxy | `true` |

### 3. Install dependencies & prepare the database

```bash
npm install
npx prisma generate        # generates the Prisma client
npx prisma db push         # applies the schema (dev); or: npm run prisma:migrate
```

### 4. Run the app

```bash
npm run dev        # Next.js frontend on http://localhost:3000
npm run server     # Express API + Socket.io on http://localhost:4000
```

Open [http://localhost:3000](http://localhost:3000), create a teacher account, publish your first exam, and share the join link with students.

---

## End-to-End Testing

```bash
npm run test:e2e          # headless run
npm run test:e2e:ui       # interactive UI mode
npm run test:e2e:install  # install the Chromium browser
```

The happy-path suite (`e2e/exam-flow.spec.ts`) walks the entire product:

1. Registers a teacher through the API
2. Signs the teacher in through the UI
3. Creates an exam with 2 MCQ questions via the wizard
4. Publishes the exam
5. Joins as a student (camera permission granted, fake media stream)
6. Answers both questions and submits
7. Verifies the success screen and the already-completed guard

> Requires PostgreSQL + Redis running and the schema applied (`docker compose up -d` + `npx prisma db push`), since both dev servers (`npm run dev` + `npm run server`) are booted automatically by Playwright.

---

## Testing

| Command | What it runs |
| --- | --- |
| `npm test` | Unit tests (Jest) — grading logic with a mocked Prisma client |
| `npm run test:api` | API integration tests (Jest + Supertest) — full request/response flows against the real app |
| `npm run test:coverage` | All tests with a coverage report (`text` + `lcov` + `html`) |
| `npm run test:e2e` | Playwright browser tests — the full product happy path |

The API suite (`apps/backend/tests/api.test.ts`) covers:

- Teacher registration & login (JWT verification)
- Exam creation + **transaction rollback** when a question is invalid
- Student join flow (UUID session token generation, reuse, DRAFT rejection)
- Submission + **auto-grading** score verification
- **Proctoring event logging** (REST) + the 3-warning termination rule
- Bulk email invite with **mocked Nodemailer** (JSON + CSV upload)
- AI question generation with **mocked Groq SDK** + built-in fallback

> The API suite needs PostgreSQL running with the schema applied (`docker compose up -d` + `npx prisma migrate dev`). It truncates the `User`, `Exam`, `Question`, `StudentSession`, `Submission`, and `ProctoringEvent` tables at startup — do not point it at a database you care about.

---

## Production Deployment

### Option A — Docker Compose (self-hosted, recommended)

```bash
# 1. Configure the required variables (see .env.example)
export DOMAIN_NAME=exam.example.com
export LETSENCRYPT_EMAIL=admin@example.com
export POSTGRES_PASSWORD=change-me
export JWT_SECRET=change-me
export SMTP_USER=youraddress@gmail.com
export SMTP_PASS=your-gmail-app-password
export GROQ_API_KEY=your-groq-key

# 2. Start the full stack (Postgres + Redis + backend + frontend + nginx)
docker compose -f docker-compose.prod.yml up -d --build

# 3. Obtain a Let's Encrypt certificate (once)
docker compose -f docker-compose.prod.yml run --rm certbot
```

All services run with `restart: unless-stopped` and health checks. Certificates auto-renew via the `certbot` service. Data persists in named volumes (`postgres_prod_data`, `uploads_prod_data`, …).

> Before first build, set `ssl_certificate` paths + `server_name` in `nginx.prod.conf` to your domain.

### Option B — Render.com (managed)

Deploy the backend blueprint (`apps/backend/render.yaml` or root `render.yaml`) directly from the Render dashboard:

1. Create a free PostgreSQL instance and copy its connection string.
2. Create a **Blueprint** pointing at this repo's `render.yaml`.
3. Fill in the `sync: false` env vars (`DATABASE_URL`, `FRONTEND_URL`, SMTP, Groq).
4. Deploy a separate frontend service (or host the Next.js app on Vercel).

Health checks hit `/health` on the backend and `/` on the frontend.

---

## Troubleshooting

### CORS errors in the browser console

- Ensure `FRONTEND_URL` (backend `.env`) exactly matches your frontend origin (`http://localhost:3000` locally).
- Behind Nginx, set `X-Forwarded-Proto`/`Host` headers (already configured in `nginx.conf` / `nginx.prod.conf`).
- Socket.io errors like `Cross-Origin Request Blocked` → check the `io` CORS origin in `server/app.ts` mirrors `FRONTEND_URL`.

### WebSocket / Socket.io won't connect

- Confirm the Express server (`npm run server`) is running on port `4000` and `NEXT_PUBLIC_SOCKET_URL` points at it.
- Behind a reverse proxy, `/socket.io/` must be proxied with `Upgrade`/`Connection: upgrade` headers (both configs included).
- Redis must be reachable for multi-instance scaling; without it the server falls back to the in-memory adapter with a warning.

### Webcam / proctoring doesn't start

- The browser must be served over `http://localhost` (or HTTPS) — camera access is blocked on plain LAN IPs.
- CSP allows `media-src 'self' blob:` — if you customize Helmet directives, keep `blob:` for the webcam stream.
- Playwright tests auto-grant camera via fake media stream flags (`--use-fake-device-for-media-stream`).

### Database connection failures (`P1001`)

- Start Postgres: `docker compose up -d postgres` and verify `DATABASE_URL` in `.env`.
- Run `npx prisma migrate dev` (or `npx prisma db push`) to apply the schema before starting the server.

### Rate limiting (HTTP 429)

- Auth routes: 15 attempts/15 min per IP. Join route: 10/min per IP. Global API: 100/min per IP.
- Behind Nginx, ensure `X-Forwarded-For` is set (configured) so limits apply to real client IPs.

---

## Project Structure

```
examora/
├── app/                        # Next.js App Router (frontend)
│   ├── (landing)/              # Marketing / landing pages
│   ├── dashboard/              # Teacher dashboard, exam creation wizard
│   ├── exam/[examId]/          # Student join + take + status pages
│   └── api/auth/[...nextauth]/ # NextAuth route (session)
├── components/                 # UI components (shadcn/ui + custom)
├── lib/                        # Client helpers (auth token, utils)
├── server/                     # Express API + Socket.io server
│   ├── controllers/            # auth, exams, student routes
│   ├── routes/                 # REST route definitions
│   ├── middleware/             # JWT auth, rate limiting, security
│   ├── validators/             # Zod schemas
│   └── socket/                 # Proctoring socket handlers
├── apps/backend/src/           # Shared backend modules (proctoring handler, security)
├── apps/frontend/src/          # Shared frontend modules (proctoring engine)
├── packages/database/src/      # Prisma-backed services (exams, grading)
├── prisma/                     # Prisma schema
├── e2e/                        # Playwright end-to-end tests
├── docker-compose.yml          # Dev: Postgres + Redis
├── docker-compose.prod.yml     # Prod: full stack + Nginx
├── playwright.config.ts        # E2E configuration
└── next.config.mjs             # /api rewrites → Express on :4000
```

---

## API Overview

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create a teacher account → returns JWT |
| POST | `/api/auth/login` | Public | Sign in → returns JWT |
| GET | `/api/exams` | Teacher JWT | List my exams |
| POST | `/api/exams` | Teacher JWT | Create exam with questions |
| GET | `/api/exams/:id/status` | Public | Exam existence + joinability check |
| GET | `/api/exams/:id/student-view` | Session token | Exam questions (no answers) |
| POST | `/api/exams/:id/join` | Public | Start an anonymous student session |
| POST | `/api/exams/:id/submit` | Session token | Submit answers |
| POST | `/api/exams/:id/grade-all` | Teacher JWT | Grade all submitted sessions |
| POST | `/api/exams/:id/publish` | Teacher JWT | Publish a DRAFT exam |
| POST | `/api/exams/:id/proctoring-event` | Session token | Log a violation; enforces the 3-warning rule |
| GET | `/api/exams/:examId/sessions/:sessionId/events` | Teacher JWT | Proctoring event timeline |
| POST | `/api/exams/generate-questions` | Teacher JWT | AI question generation (Groq free tier + fallback) |
| POST | `/api/exams/:examId/invite-bulk` | Teacher JWT | Bulk invite via CSV upload or JSON (email join links) |
| DELETE | `/api/exams/:id` | Teacher JWT | Delete exam + cascade |

Socket.io events: `join_exam_room`, `student_warning`, `student_status_update`, `exam_terminated`, `teacher_join_exam_room` / `teacher_leave_exam_room`.

---

## Screenshots

| Landing page | Teacher dashboard | Exam creation |
| --- | --- | --- |
| _(add screenshot)_ | _(add screenshot)_ | _(add screenshot)_ |

| Student join | Exam taking (proctored) | Results / scorecard |
| --- | --- | --- |
| _(add screenshot)_ | _(add screenshot)_ | _(add screenshot)_ |

---

## License

[MIT](LICENSE) © Examora. Free forever — self-host it, modify it, ship it.
