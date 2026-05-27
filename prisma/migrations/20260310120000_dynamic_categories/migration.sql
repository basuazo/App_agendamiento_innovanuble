-- Migration: dynamic_categories
-- Replaces the ResourceCategory enum with a Category model per space.

-- 1. Create Category table
CREATE TABLE "Category" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "color"     TEXT NOT NULL DEFAULT '#6b7280',
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "order"     INTEGER NOT NULL DEFAULT 0,
  "spaceId"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_spaceId_slug_key" ON "Category"("spaceId", "slug");

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "Space"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Insert the 11 default categories for every existing space
INSERT INTO "Category" ("id", "name", "slug", "color", "order", "spaceId", "updatedAt")
SELECT
  gen_random_uuid()::text,
  cat.name,
  cat.slug,
  cat.color,
  cat.ord,
  s.id,
  NOW()
FROM "Space" s
CROSS JOIN (VALUES
  ('Recta Casera',           'RECTA_CASERA',           '#3b82f6', 0),
  ('Overlock Casera',        'OVERLOCK_CASERA',        '#8b5cf6', 1),
  ('Collaretera',            'COLLERETERA',            '#ec4899', 2),
  ('Bordadora',              'BORDADORA',              '#f59e0b', 3),
  ('Impresora Sublimación',  'IMPRESORA_SUBLIMACION',  '#10b981', 4),
  ('Plotter de Corte',       'PLOTTER_CORTE',          '#ef4444', 5),
  ('Plancha Sublimación',    'PLANCHA_SUBLIMACION',    '#f97316', 6),
  ('Industrial',             'INDUSTRIAL',             '#6b7280', 7),
  ('Plancha de Vapor',       'PLANCHA_VAPOR',          '#06b6d4', 8),
  ('Mesón de Corte',         'MESON_CORTE',            '#84cc16', 9),
  ('Espacio de Reuniones',   'ESPACIO_REUNION',        '#0ea5e9', 10)
) AS cat(name, slug, color, ord);

-- 3. Add categoryId to Resource (nullable first for data migration)
ALTER TABLE "Resource" ADD COLUMN "categoryId" TEXT;

UPDATE "Resource" r
SET "categoryId" = c.id
FROM "Category" c
WHERE c."spaceId" = r."spaceId"
  AND c."slug"    = r."category"::text;

ALTER TABLE "Resource" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "Resource"
  ADD CONSTRAINT "Resource_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Resource" DROP COLUMN "category";

-- 4. Add categoryId to Certification
ALTER TABLE "Certification" ADD COLUMN "categoryId" TEXT;

UPDATE "Certification"
SET "categoryId" = c.id
FROM "Category" c, "User" u
WHERE "Certification"."userId" = u.id
  AND c."spaceId" = u."spaceId"
  AND c."slug"    = "Certification"."resourceCategory"::text;

-- Remove orphans (users without spaceId, e.g. super_admin — shouldn't exist but just in case)
DELETE FROM "Certification" WHERE "categoryId" IS NULL;

ALTER TABLE "Certification" ALTER COLUMN "categoryId" SET NOT NULL;

DROP INDEX "Certification_userId_resourceCategory_key";
CREATE UNIQUE INDEX "Certification_userId_categoryId_key" ON "Certification"("userId", "categoryId");

ALTER TABLE "Certification"
  ADD CONSTRAINT "Certification_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Certification" DROP COLUMN "resourceCategory";

-- 5. Add categoryId to CertificationRequest
ALTER TABLE "CertificationRequest" ADD COLUMN "categoryId" TEXT;

UPDATE "CertificationRequest"
SET "categoryId" = c.id
FROM "Category" c, "User" u
WHERE "CertificationRequest"."userId" = u.id
  AND c."spaceId" = u."spaceId"
  AND c."slug"    = "CertificationRequest"."resourceCategory"::text;

DELETE FROM "CertificationRequest" WHERE "categoryId" IS NULL;

ALTER TABLE "CertificationRequest" ALTER COLUMN "categoryId" SET NOT NULL;

DROP INDEX "CertificationRequest_userId_resourceCategory_key";
CREATE UNIQUE INDEX "CertificationRequest_userId_categoryId_key" ON "CertificationRequest"("userId", "categoryId");

ALTER TABLE "CertificationRequest"
  ADD CONSTRAINT "CertificationRequest_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CertificationRequest" DROP COLUMN "resourceCategory";

-- 6. Drop the now-unused enum
DROP TYPE "ResourceCategory";
