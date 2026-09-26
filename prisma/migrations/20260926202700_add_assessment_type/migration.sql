-- CreateEnum
CREATE TYPE "assessment_type" AS ENUM ('EXAM', 'PRACTICE_QUIZ');

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "assessment_type" "assessment_type" NOT NULL DEFAULT 'EXAM',
ADD COLUMN     "instant_feedback" BOOLEAN NOT NULL DEFAULT false;
