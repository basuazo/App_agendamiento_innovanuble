-- CreateEnum
CREATE TYPE "CompanionRelation" AS ENUM ('CUIDADOS', 'AMISTAD', 'OTRO');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "attendees" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "companionRelation" "CompanionRelation";
