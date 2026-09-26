-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "max_warnings" INTEGER NOT NULL DEFAULT 3;

-- Backfill the new authoritative column from legacy JSON settings so exams
-- previously configured with a non-default warningThreshold keep their policy.
UPDATE "exams"
SET "max_warnings" = CASE
  WHEN ("settings" ->> 'warningThreshold') ~ '^[0-9]+$'
  THEN LEAST(10, GREATEST(1, ("settings" ->> 'warningThreshold')::INTEGER))
  ELSE 3
END
WHERE "settings" IS NOT NULL AND "settings" ? 'warningThreshold';
