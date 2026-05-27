/*
  Warnings:

  - You are about to drop the column `type` on the `Resource` table. All the data in the column will be lost.
  - Added the required column `category` to the `Resource` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ResourceCategory" AS ENUM ('RECTA_CASERA', 'OVERLOCK_CASERA', 'COLLERETERA', 'BORDADORA', 'IMPRESORA_SUBLIMACION', 'PLOTTER_CORTE', 'PLANCHA_SUBLIMACION', 'INDUSTRIAL', 'PLANCHA_VAPOR');

-- CreateEnum
CREATE TYPE "CertReqStatus" AS ENUM ('PENDING', 'SCHEDULED', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'PENDING';
ALTER TYPE "BookingStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Resource" DROP COLUMN "type",
ADD COLUMN     "category" "ResourceCategory" NOT NULL,
ADD COLUMN     "requiresCertification" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceCategory" "ResourceCategory" NOT NULL,
    "certifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "certifiedById" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceCategory" "ResourceCategory" NOT NULL,
    "status" "CertReqStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledDate" TIMESTAMP(3),
    "notes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Certification_userId_resourceCategory_key" ON "Certification"("userId", "resourceCategory");

-- CreateIndex
CREATE UNIQUE INDEX "CertificationRequest_userId_resourceCategory_key" ON "CertificationRequest"("userId", "resourceCategory");

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_certifiedById_fkey" FOREIGN KEY ("certifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificationRequest" ADD CONSTRAINT "CertificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
