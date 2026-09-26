-- CreateEnum
CREATE TYPE "delivery_mode" AS ENUM ('LIVE', 'TAKE_HOME');

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "available_from" TIMESTAMP(3),
ADD COLUMN     "available_until" TIMESTAMP(3),
ADD COLUMN     "delivery_mode" "delivery_mode" NOT NULL DEFAULT 'LIVE';
