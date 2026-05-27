-- AlterTable: agregar updatedAt con DEFAULT NOW() para filas existentes
ALTER TABLE "Booking" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "Resource" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Quitar el default (Prisma lo maneja vía triggers)
ALTER TABLE "Booking" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Resource" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");
CREATE INDEX "Booking_resourceId_idx" ON "Booking"("resourceId");
CREATE INDEX "Booking_status_idx" ON "Booking"("status");
CREATE INDEX "Booking_startTime_endTime_idx" ON "Booking"("startTime", "endTime");
CREATE INDEX "CertificationRequest_userId_idx" ON "CertificationRequest"("userId");
CREATE INDEX "CertificationRequest_status_idx" ON "CertificationRequest"("status");
