-- ================================================================
-- AGREGAR ADMIN AL TIPO ENUM "ROLE"
-- ================================================================
-- Esta migración debe ejecutarse ANTES de crear usuarios con rol ADMIN
-- debido a restricciones de PostgreSQL con ENUMs
-- ================================================================

-- Verificar si ADMIN ya existe en el ENUM
DO $$
BEGIN
  -- Intentar agregar ADMIN al ENUM si no existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'ADMIN'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ROLE')
  ) THEN
    ALTER TYPE "ROLE" ADD VALUE 'ADMIN';
    RAISE NOTICE 'Valor ADMIN agregado al tipo ENUM ROLE exitosamente';
  ELSE
    RAISE NOTICE 'Valor ADMIN ya existe en el tipo ENUM ROLE';
  END IF;
END $$;

-- Verificar que se agregó correctamente
SELECT 'ENUM "ROLE" actualizado' as status;
SELECT enumlabel as roles_disponibles
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ROLE')
ORDER BY enumsortorder;
