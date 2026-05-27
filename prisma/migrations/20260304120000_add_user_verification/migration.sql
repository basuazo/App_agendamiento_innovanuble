-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'USER_VERIFIED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- Set all existing users as verified (only new self-registered users start as unverified)
UPDATE "User" SET "isVerified" = true;
