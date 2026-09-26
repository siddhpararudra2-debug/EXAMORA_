-- AlterTable
ALTER TABLE "answers" ADD COLUMN     "ai_rationale" TEXT,
ADD COLUMN     "ai_suggested_score" DECIMAL(10,2),
ADD COLUMN     "final_score" DECIMAL(10,2),
ADD COLUMN     "grading_note" TEXT;
