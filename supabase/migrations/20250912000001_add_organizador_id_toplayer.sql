ALTER TABLE players ADD COLUMN organizador_id UUID REFERENCES organizaciones(id);
COMMENT ON COLUMN public.players.organizador_id IS 'Organizadores para ranking';
