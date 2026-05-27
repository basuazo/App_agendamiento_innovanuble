-- CreateTable
CREATE TABLE "BusinessHours" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHours_dayOfWeek_key" ON "BusinessHours"("dayOfWeek");

-- Seed default business hours (Lun-Sáb abierto 09:00-17:00, Dom cerrado)
INSERT INTO "BusinessHours" ("id", "dayOfWeek", "isOpen", "openTime", "closeTime", "updatedAt") VALUES
    ('bh_day_0', 0, false, '09:00', '17:00', now()),
    ('bh_day_1', 1, true,  '09:00', '17:00', now()),
    ('bh_day_2', 2, true,  '09:00', '17:00', now()),
    ('bh_day_3', 3, true,  '09:00', '17:00', now()),
    ('bh_day_4', 4, true,  '09:00', '17:00', now()),
    ('bh_day_5', 5, true,  '09:00', '17:00', now()),
    ('bh_day_6', 6, true,  '09:00', '17:00', now());
