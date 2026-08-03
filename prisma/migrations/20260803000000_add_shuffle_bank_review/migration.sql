-- E15: deterministic per-session shuffle seed for question/option shuffling
ALTER TABLE "exam_sessions" ADD COLUMN "shuffle_seed" INTEGER;

-- G05: flag answers needing manual review (low AI confidence / file upload / AI outage)
ALTER TABLE "answers" ADD COLUMN "needs_review" BOOLEAN NOT NULL DEFAULT false;

-- E16: teacher question bank for save/reuse across exams
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

    CONSTRAINT "bank_questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_questions_teacher_id_idx" ON "bank_questions"("teacher_id");
CREATE INDEX "bank_questions_type_idx" ON "bank_questions"("type");

ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
