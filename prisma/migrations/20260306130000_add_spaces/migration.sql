-- Agregar SUPER_ADMIN al enum Role
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- Agregar SPACE_CREATED, SPACE_UPDATED, SPACE_DELETED al enum AuditAction
ALTER TYPE "AuditAction" ADD VALUE 'SPACE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'SPACE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SPACE_DELETED';

-- Crear tabla Space
CREATE TABLE "Space" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- Insertar 3 espacios iniciales (IDs fijos para referencia en el resto de la migración)
INSERT INTO "Space" ("id", "name", "isActive", "createdAt", "updatedAt") VALUES
    ('space_puente_alto', 'Puente Alto', true, now(), now()),
    ('space_chillan',     'Chillán',    true, now(), now()),
    ('space_valparaiso',  'Valparaíso', true, now(), now());

-- ── User: agregar spaceId (nullable, SUPER_ADMIN no tiene espacio) ─────────────
ALTER TABLE "User" ADD COLUMN "spaceId" TEXT;
-- Asignar todos los usuarios actuales a Puente Alto
UPDATE "User" SET "spaceId" = 'space_puente_alto';

-- ── Resource: agregar spaceId ─────────────────────────────────────────────────
ALTER TABLE "Resource" ADD COLUMN "spaceId" TEXT;
-- Asignar todos los recursos actuales a TODOS los espacios
-- Primero asignamos a Puente Alto
UPDATE "Resource" SET "spaceId" = 'space_puente_alto';

-- Luego duplicamos los recursos para Chillán y Valparaíso
INSERT INTO "Resource" ("id", "name", "description", "category", "requiresCertification", "capacity", "imageUrl", "isActive", "spaceId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "name", "description", "category", "requiresCertification", "capacity", "imageUrl", "isActive", 'space_chillan', "createdAt", now()
FROM "Resource" WHERE "spaceId" = 'space_puente_alto';

INSERT INTO "Resource" ("id", "name", "description", "category", "requiresCertification", "capacity", "imageUrl", "isActive", "spaceId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "name", "description", "category", "requiresCertification", "capacity", "imageUrl", "isActive", 'space_valparaiso', "createdAt", now()
FROM "Resource" WHERE "spaceId" = 'space_puente_alto';

-- Hacer spaceId NOT NULL en Resource
ALTER TABLE "Resource" ALTER COLUMN "spaceId" SET NOT NULL;

-- ── Training: agregar spaceId ─────────────────────────────────────────────────
ALTER TABLE "Training" ADD COLUMN "spaceId" TEXT;
UPDATE "Training" SET "spaceId" = 'space_puente_alto';
ALTER TABLE "Training" ALTER COLUMN "spaceId" SET NOT NULL;

-- ── Comment: agregar spaceId ──────────────────────────────────────────────────
ALTER TABLE "Comment" ADD COLUMN "spaceId" TEXT;
UPDATE "Comment" SET "spaceId" = 'space_puente_alto';
ALTER TABLE "Comment" ALTER COLUMN "spaceId" SET NOT NULL;

-- ── BusinessHours: cambiar unique de dayOfWeek a (spaceId, dayOfWeek) ─────────
-- 1. Eliminar el índice único actual
DROP INDEX IF EXISTS "BusinessHours_dayOfWeek_key";

-- 2. Agregar columna spaceId
ALTER TABLE "BusinessHours" ADD COLUMN "spaceId" TEXT;

-- 3. Asignar filas existentes a Puente Alto
UPDATE "BusinessHours" SET "spaceId" = 'space_puente_alto';

-- 4. Duplicar para Chillán
INSERT INTO "BusinessHours" ("id", "spaceId", "dayOfWeek", "isOpen", "openTime", "closeTime", "updatedAt")
SELECT gen_random_uuid()::text, 'space_chillan', "dayOfWeek", "isOpen", "openTime", "closeTime", now()
FROM "BusinessHours" WHERE "spaceId" = 'space_puente_alto';

-- 5. Duplicar para Valparaíso
INSERT INTO "BusinessHours" ("id", "spaceId", "dayOfWeek", "isOpen", "openTime", "closeTime", "updatedAt")
SELECT gen_random_uuid()::text, 'space_valparaiso', "dayOfWeek", "isOpen", "openTime", "closeTime", now()
FROM "BusinessHours" WHERE "spaceId" = 'space_puente_alto';

-- 6. Hacer spaceId NOT NULL
ALTER TABLE "BusinessHours" ALTER COLUMN "spaceId" SET NOT NULL;

-- 7. Crear nuevo índice único compuesto
CREATE UNIQUE INDEX "BusinessHours_spaceId_dayOfWeek_key" ON "BusinessHours"("spaceId", "dayOfWeek");

-- ── Foreign Keys ──────────────────────────────────────────────────────────────
ALTER TABLE "User"     ADD CONSTRAINT "User_spaceId_fkey"         FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_spaceId_fkey"     FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Training" ADD CONSTRAINT "Training_spaceId_fkey"     FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment"  ADD CONSTRAINT "Comment_spaceId_fkey"      FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
