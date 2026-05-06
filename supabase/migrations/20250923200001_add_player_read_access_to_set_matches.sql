-- Política RLS para permitir a los players leer sets de matches de torneos en los que participan
CREATE POLICY "Players can read set_matches of tournaments they participate in"
ON set_matches
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM matches m
    JOIN tournaments t ON m.tournament_id = t.id
    JOIN inscriptions i ON i.tournament_id = t.id
    JOIN players p ON p.id = i.player_id
    WHERE m.id = set_matches.match_id
      AND p.user_id = auth.uid()
  )
);

-- También agregar política para que cualquier usuario autenticado pueda leer sets
-- Esto es más permisivo pero más simple para el caso de uso de viewing brackets
CREATE POLICY "Authenticated users can read set_matches"
ON set_matches
FOR SELECT
TO authenticated
USING (true);