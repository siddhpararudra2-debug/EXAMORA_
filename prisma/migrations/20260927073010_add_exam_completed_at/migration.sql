-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "completed_at" TIMESTAMP(3);

-- Backfill: already-completed exams never recorded a completion date, so
-- approximate with updated_at (the declare-results write touches the row).
UPDATE "exams" SET "completed_at" = "updated_at" WHERE "status" = 'COMPLETED' AND "completed_at" IS NULL;
