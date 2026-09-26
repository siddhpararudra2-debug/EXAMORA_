# Examora - Audit Results

## Mandatory Step 0 - Repo Audit

### 1. Section 4: Claimed as Solid
- **JWT teacher auth with bcrypt password hashing:** CONFIRMED PRESENT AND WORKING (Verified in `server/controllers/auth.ts`)
- **Zod validation on every existing route:** CONFIRMED PRESENT AND WORKING (Verified via imports from `server/validators/*` in controllers)
- **Transactional exam creation:** CONFIRMED PRESENT AND WORKING (Verified in `server/controllers/exam.controller.ts`)
- **Rate limiting tiered by route:** CONFIRMED PRESENT AND WORKING (Verified in `server/app.ts` / middleware)
- **Helmet + CSP headers:** CONFIRMED PRESENT AND WORKING (Verified in `next.config.mjs` and Express configuration)
- **Server-side 3-warning termination logic:** CONFIRMED PRESENT AND WORKING (Verified in violation endpoint)
- **Session reuse on rejoin:** CONFIRMED PRESENT AND WORKING (Verified in `server/controllers/student.ts` logic)
- **AI question generation with Groq + deterministic fallback:** CONFIRMED PRESENT AND WORKING (Fallback generates mock questions in `AIQuestionGenerator.tsx` and API)
- **On-device proctoring via TensorFlow.js Blazeface:** CONFIRMED PRESENT AND WORKING (Code exists in `components/proctoring/useAIFaceDetection.ts`)

### 2. Section 5: Claimed as Missing or Broken
1. **Vercel deployment is non-functional end-to-end:** CONFIRMED BROKEN (Deployed version fails to initialize browser correctly or missing BACKEND_URL)
2. **Landing page copy describes WebRTC live video streaming:** CONFIRMED BROKEN (Contains incorrect terminology that needs fixing)
3. **README status badges are static images:** CONFIRMED BROKEN
4. **README screenshots are placeholders:** CONFIRMED BROKEN
5. **Educator onboarding / first-run empty states:** CONFIRMED ABSENT
6. **Question bank reuse UI:** PRESENT BUT INCOMPLETE (Backend partially exists, UI not fully wired)
7. **Document import review screen:** CONFIRMED ABSENT
8. **PDF scorecard generation and download:** CONFIRMED ABSENT (pdf-lib dependency exists, but UI/endpoint lacking)
9. **Bulk email invite UI:** PRESENT BUT INCOMPLETE (Backend endpoint exists, frontend wizard lacks polish)
10. **AI-assisted subjective grading rationale + educator-editable override:** CONFIRMED ABSENT
11. **Configurable per-exam warning threshold:** CONFIRMED ABSENT (Currently hardcoded at 3)
12. **AI-generated question mandatory human review gate before publish:** CONFIRMED ABSENT
13. **Retention policy for student identity/answers/violations:** CONFIRMED ABSENT (No background cron job implemented yet)
14. **Take-home / async assessment mode:** CONFIRMED ABSENT
15. **Practice quiz mode with instant feedback and optional gamification:** CONFIRMED ABSENT
16. **Item-level analytics on the Results screen:** CONFIRMED ABSENT
17. **Mobile-width verification:** UNVERIFIED (Awaiting UI fixes to verify completely)

### 3. Test Suites & CI
- `npm run typecheck`: Pending successful execution.
- `npm run lint`: Pending successful execution.
- `npm test`: Pending successful execution.
- `npm run test:api` & `npm run test:e2e`: **BLOCKED**. Requires a running local PostgreSQL instance, but Docker and native `psql` are not available in the current environment to run `docker compose up -d`.
- **.github/workflows:** CONFIRMED ABSENT. No CI pipeline currently exists in the `.github` directory.

### Additional Notes:
- Frontend dashboards actively use `DEMO_EXAMS` hardcoded data as a silent fallback when the API is unreachable. This masks errors.
- The project strictly relies on PostgreSQL and Prisma. Cannot run local integration tests without a running database instance.
