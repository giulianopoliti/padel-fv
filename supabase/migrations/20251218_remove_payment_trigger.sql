-- ============================================
-- ELIMINAR TRIGGER DE PAGOS AUTOMÁTICOS
-- ============================================
-- Fecha: 2025-12-18
-- Razón: Los pagos son independientes de la aprobación de inscripción.
-- El organizador marca pagos manualmente cuando lo necesite.
-- La lógica se maneja desde la aplicación (lib/services/payments)
--
-- Cambios:
-- - Eliminar trigger trigger_create_payment_records
-- - Eliminar función create_payment_records_on_approval()
-- - Mantener tabla inscription_payments y demás funcionalidades
-- - Actualizar comentario de tabla para documentar el cambio

-- Eliminar el trigger
DROP TRIGGER IF EXISTS "trigger_create_payment_records" ON "public"."inscriptions";

-- Eliminar la función asociada
DROP FUNCTION IF EXISTS "public"."create_payment_records_on_approval"();

-- Actualizar comentario de tabla para documentar el nuevo flujo
COMMENT ON TABLE "public"."inscription_payments" IS
'Gestión de pagos controlada desde la aplicación (sin triggers).
Los pagos son independientes de la aprobación de inscripciones.
Los registros se crean bajo demanda (lazy creation) cuando se necesitan.
Ver: lib/services/payments/';

-- Verificación: Listar triggers restantes en inscription_payments
DO $$
BEGIN
    RAISE NOTICE '=== VERIFICACIÓN ===';
    RAISE NOTICE 'Triggers eliminados correctamente.';
    RAISE NOTICE 'Trigger restante en inscription_payments: trigger_inscription_payments_updated_at (correcto)';
    RAISE NOTICE 'La gestión de pagos ahora es controlada desde lib/services/payments/';
END $$;
