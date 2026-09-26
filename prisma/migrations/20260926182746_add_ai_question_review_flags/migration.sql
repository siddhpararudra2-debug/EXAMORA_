-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "ai_generated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "educator_reviewed" BOOLEAN NOT NULL DEFAULT true;
