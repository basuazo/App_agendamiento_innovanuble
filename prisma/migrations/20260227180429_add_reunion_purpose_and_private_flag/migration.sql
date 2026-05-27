-- AlterEnum
ALTER TYPE "BookingPurpose" ADD VALUE 'REUNION';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;
