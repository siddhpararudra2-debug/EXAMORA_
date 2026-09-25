-- CreateEnum
CREATE TYPE "exam_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "question_type" AS ENUM ('MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'SHORT_ANSWER', 'LONG_ANSWER', 'FILL_BLANK', 'DROPDOWN', 'LINEAR_SCALE', 'CHECKBOX_GRID', 'RADIO_GRID', 'DATE', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "violation_type" AS ENUM ('TAB_SWITCH', 'APP_SWITCH', 'MINIMIZE', 'MOBILE_BUTTON', 'AI_OVERLAY', 'DEVTOOLS', 'SCREEN_CAPTURE', 'KEYBOARD_SHORTCUT', 'HEARTBEAT_TIMEOUT');

-- CreateEnum
CREATE TYPE "creation_mode" AS ENUM ('MANUAL', 'UPLOAD', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "graded_by" AS ENUM ('AUTO', 'AI', 'TEACHER');

-- CreateEnum
CREATE TYPE "email_log_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "google_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" VARCHAR(255),
    "college_name" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "reset_token" TEXT,
    "reset_token_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "college_name" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "total_marks" INTEGER NOT NULL,
    "creation_mode" "creation_mode" NOT NULL DEFAULT 'MANUAL',
    "access_uuid" TEXT NOT NULL,
    "qr_code_url" TEXT,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "settings" JSONB,
    "status" "exam_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL,
    "duration_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "section_id" TEXT,
    "type" "question_type" NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" JSONB,
    "correct_answer" TEXT,
    "image_url" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "explanation" TEXT,
    "metadata" JSONB,
    "marks" INTEGER NOT NULL,
    "negative_marks" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_sessions" (
    "id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "enrollment_number" TEXT,
    "student_email" TEXT,
    "status" "submission_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "total_score" DECIMAL(10,2),
    "percentage" DECIMAL(5,2),
    "shuffle_seed" INTEGER,
    "last_heartbeat_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exam_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_text" TEXT NOT NULL,
    "is_correct" BOOLEAN,
    "marks_awarded" DECIMAL(10,2),
    "graded_by" "graded_by",
    "teacher_feedback" TEXT,
    "ai_confidence" DECIMAL(5,4),
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "type" "violation_type" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_log" (
    "id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "session_id" TEXT,
    "recipient_email" TEXT NOT NULL,
    "pdf_url" TEXT,
    "status" "email_log_status" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_questions" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "type" "question_type" NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" JSONB,
    "correct_answer" TEXT,
    "explanation" TEXT,
    "marks" INTEGER NOT NULL,
    "negative_marks" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bank_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teachers_google_id_key" ON "teachers"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_reset_token_key" ON "teachers"("reset_token");

-- CreateIndex
CREATE INDEX "teachers_deleted_at_idx" ON "teachers"("deleted_at");

-- CreateIndex
CREATE INDEX "exams_created_by_idx" ON "exams"("created_by");

-- CreateIndex
CREATE INDEX "exams_status_idx" ON "exams"("status");

-- CreateIndex
CREATE INDEX "exams_created_by_status_idx" ON "exams"("created_by", "status");

-- CreateIndex
CREATE INDEX "exams_deleted_at_idx" ON "exams"("deleted_at");

-- CreateIndex
CREATE INDEX "sections_exam_id_order_index_idx" ON "sections"("exam_id", "order_index");

-- CreateIndex
CREATE INDEX "sections_deleted_at_idx" ON "sections"("deleted_at");

-- CreateIndex
CREATE INDEX "questions_exam_id_idx" ON "questions"("exam_id");

-- CreateIndex
CREATE INDEX "questions_section_id_idx" ON "questions"("section_id");

-- CreateIndex
CREATE INDEX "questions_exam_id_order_index_idx" ON "questions"("exam_id", "order_index");

-- CreateIndex
CREATE INDEX "questions_deleted_at_idx" ON "questions"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "exam_sessions_session_token_key" ON "exam_sessions"("session_token");

-- CreateIndex
CREATE INDEX "exam_sessions_exam_id_idx" ON "exam_sessions"("exam_id");

-- CreateIndex
CREATE INDEX "exam_sessions_status_idx" ON "exam_sessions"("status");

-- CreateIndex
CREATE INDEX "exam_sessions_exam_id_status_idx" ON "exam_sessions"("exam_id", "status");

-- CreateIndex
CREATE INDEX "exam_sessions_exam_id_student_email_enrollment_number_idx" ON "exam_sessions"("exam_id", "student_email", "enrollment_number");

-- CreateIndex
CREATE INDEX "exam_sessions_last_heartbeat_at_idx" ON "exam_sessions"("last_heartbeat_at");

-- CreateIndex
CREATE INDEX "exam_sessions_deleted_at_idx" ON "exam_sessions"("deleted_at");

-- CreateIndex
CREATE INDEX "answers_question_id_idx" ON "answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "answers_session_id_question_id_key" ON "answers"("session_id", "question_id");

-- CreateIndex
CREATE INDEX "violations_session_id_occurred_at_idx" ON "violations"("session_id", "occurred_at");

-- CreateIndex
CREATE INDEX "email_log_exam_id_idx" ON "email_log"("exam_id");

-- CreateIndex
CREATE INDEX "email_log_session_id_idx" ON "email_log"("session_id");

-- CreateIndex
CREATE INDEX "email_log_status_idx" ON "email_log"("status");

-- CreateIndex
CREATE INDEX "bank_questions_teacher_id_idx" ON "bank_questions"("teacher_id");

-- CreateIndex
CREATE INDEX "bank_questions_type_idx" ON "bank_questions"("type");

-- CreateIndex
CREATE INDEX "bank_questions_deleted_at_idx" ON "bank_questions"("deleted_at");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
