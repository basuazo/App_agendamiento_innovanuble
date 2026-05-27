-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ResourceCategory" ADD VALUE 'MESON_CORTE';
ALTER TYPE "ResourceCategory" ADD VALUE 'ESPACIO_REUNION';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 1;
