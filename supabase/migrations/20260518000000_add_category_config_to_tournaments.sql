ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS category_config jsonb;

COMMENT ON COLUMN public.tournaments.category_config IS
'Configuracion estructurada de categoria del torneo. Soporta SINGLE, RANGE y MIXED_SUM sin crear categorias nuevas.';
