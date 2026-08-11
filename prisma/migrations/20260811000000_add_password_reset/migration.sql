-- P01: password reset tokens for the teacher forgot-password flow
ALTER TABLE "teachers" ADD COLUMN "reset_token" TEXT;

ALTER TABLE "teachers" ADD COLUMN "reset_token_expires" TIMESTAMP(3);

CREATE UNIQUE INDEX "teachers_reset_token_key" ON "teachers"("reset_token");
