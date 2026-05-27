-- Migración: eliminar valor LIDER_TECNICA del enum Role
-- Estrategia: convertir a TEXT como paso intermedio para evitar errores de cast.

-- 1. Reasignar usuarios con rol LIDER_TECNICA a LIDER_COMUNITARIA
UPDATE "User" SET "role" = 'LIDER_COMUNITARIA' WHERE "role" = 'LIDER_TECNICA';

-- 2. Quitar el default tipado
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

-- 3. Convertir la columna a TEXT primero (elimina la dependencia del enum viejo)
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT;

-- 4. Renombrar el enum viejo y crear el nuevo
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'LIDER_COMUNITARIA', 'USER');

-- 5. Convertir la columna TEXT al nuevo enum
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING "role"::"Role";

-- 6. Restaurar el default con el nuevo tipo
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER'::"Role";

-- 7. Eliminar el enum viejo
DROP TYPE "Role_old";
