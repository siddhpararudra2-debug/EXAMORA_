-- S01: per-session expiry so old anonymous session tokens cannot be reused after the exam window
ALTER TABLE "exam_sessions" ADD COLUMN "expires_at" TIMESTAMP(3);
