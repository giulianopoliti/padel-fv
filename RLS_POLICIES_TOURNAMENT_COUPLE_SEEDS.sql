-- RLS Policies para tournament_couple_seeds
-- Aplicar en producción para mantener la seguridad

-- 1. Política de SELECT (lectura pública)
CREATE POLICY "tournament_couple_seeds_public_select" 
ON "public"."tournament_couple_seeds" 
AS PERMISSIVE 
FOR SELECT 
TO public 
USING (true);

-- 2. Política de INSERT (solo dueños del club pueden insertar)
CREATE POLICY "tournament_couple_seeds_club_manage" 
ON "public"."tournament_couple_seeds" 
AS PERMISSIVE 
FOR INSERT 
TO public 
WITH CHECK (
  auth.uid() IN (
    SELECT c.user_id
    FROM clubes c
    JOIN tournaments t ON c.id = t.club_id
    WHERE t.id = tournament_couple_seeds.tournament_id
  )
);

-- 3. Política de UPDATE (solo dueños del club pueden actualizar)
CREATE POLICY "tournament_couple_seeds_club_update" 
ON "public"."tournament_couple_seeds" 
AS PERMISSIVE 
FOR UPDATE 
TO public 
USING (
  auth.uid() IN (
    SELECT c.user_id
    FROM clubes c
    JOIN tournaments t ON c.id = t.club_id
    WHERE t.id = tournament_couple_seeds.tournament_id
  )
);

-- 4. Política de DELETE (solo dueños del club pueden eliminar)
CREATE POLICY "tournament_couple_seeds_club_delete" 
ON "public"."tournament_couple_seeds" 
AS PERMISSIVE 
FOR DELETE 
TO public 
USING (
  auth.uid() IN (
    SELECT c.user_id
    FROM clubes c
    JOIN tournaments t ON c.id = t.club_id
    WHERE t.id = tournament_couple_seeds.tournament_id
  )
);

-- IMPORTANTE: Estas políticas aseguran que:
-- 1. Cualquiera puede leer los seeds (necesario para mostrar brackets públicos)
-- 2. Solo el dueño del club puede crear/modificar/eliminar seeds de sus torneos
-- 3. El sistema de autenticación de Supabase valida automáticamente

-- NOTA PARA MIGRACIÓN A PRODUCCIÓN:
-- Ejecutar estos comandos SQL en el dashboard de Supabase Production
-- o via CLI con: npx supabase db remote commit