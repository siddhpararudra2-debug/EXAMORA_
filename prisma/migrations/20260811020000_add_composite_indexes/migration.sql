-- Composite indexes for hot query paths:
--  * exams(created_by, status)   — teacher's dashboard list filtered by status
--  * exam_sessions(exam_id, status) — grade-all / results by exam + status
CREATE INDEX IF NOT EXISTS "exams_created_by_status_idx"
  ON "exams" ("created_by", "status");

CREATE INDEX IF NOT EXISTS "exam_sessions_exam_id_status_idx"
  ON "exam_sessions" ("exam_id", "status");
