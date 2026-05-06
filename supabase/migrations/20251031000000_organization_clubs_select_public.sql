-- Asegura que RLS esté activo
ALTER TABLE public.organization_clubs ENABLE ROW LEVEL SECURITY;

-- Concede SELECT a roles públicos (RLS aplicará igual)
GRANT SELECT ON public.organization_clubs TO anon, authenticated;

-- Elimina TODAS las políticas de SELECT existentes para evitar reglas en OR
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organization_clubs'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organization_clubs;', p.policyname);
  END LOOP;
END $$;

-- Crea una única política de lectura pública
CREATE POLICY "Public can view organization clubs"
ON public.organization_clubs
FOR SELECT
TO anon, authenticated
USING (true);