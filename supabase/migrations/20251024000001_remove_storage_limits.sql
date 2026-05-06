-- ============================================================================
-- Migration: Remove storage size limits for image uploads
-- Date: 2025-10-24
-- Description: Remove file size limits and MIME type restrictions from storage
--              buckets to allow high-quality image uploads without restrictions
-- ============================================================================

-- Remover límites de tamaño para permitir fotos de cualquier tamaño
-- Esto permite que organizadores, clubs y jugadores suban fotos de alta calidad
UPDATE storage.buckets
SET
  file_size_limit = NULL,
  allowed_mime_types = NULL
WHERE id IN ('avatars', 'clubes', 'organizaciones');

-- Verificar que los buckets estén públicos (deben estar públicos para acceso directo)
UPDATE storage.buckets
SET public = true
WHERE id IN ('avatars', 'clubes', 'organizaciones');

-- Verificación: Mostrar configuración actual de los buckets
-- Descomenta la siguiente línea para verificar los cambios:
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets
-- WHERE id IN ('avatars', 'clubes', 'organizaciones')
-- ORDER BY name;
