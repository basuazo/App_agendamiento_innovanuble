-- CreateEnum
CREATE TYPE "CommentTag" AS ENUM ('GENERAL', 'MACHINE_ISSUE', 'ORDER', 'CLEANING');

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "tag" "CommentTag" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingExemption" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,

    CONSTRAINT "TrainingExemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingExemption_trainingId_resourceId_key" ON "TrainingExemption"("trainingId", "resourceId");

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingExemption" ADD CONSTRAINT "TrainingExemption_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingExemption" ADD CONSTRAINT "TrainingExemption_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
