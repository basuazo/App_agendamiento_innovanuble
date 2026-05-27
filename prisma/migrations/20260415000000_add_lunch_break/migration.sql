-- AlterTable: agrega campos de hora de colación al modelo Space
ALTER TABLE "Space" ADD COLUMN "lunchBreakEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Space" ADD COLUMN "lunchBreakStart" TEXT;
ALTER TABLE "Space" ADD COLUMN "lunchBreakEnd" TEXT;
